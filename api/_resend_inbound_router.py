from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import re
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from email.utils import getaddresses
from typing import Any


INBOUND_DOMAIN = "foliolens.in"
HUMAN_ALIASES = {"hello", "support", "privacy", "security"}
TOKEN_ALPHABET_RE = r"[A-HJKMNP-Z2-9]{8}"
DEV_CAS_RE = re.compile(rf"^cas-dev-({TOKEN_ALPHABET_RE})@foliolens\.in$", re.IGNORECASE)
PROD_CAS_RE = re.compile(rf"^cas-({TOKEN_ALPHABET_RE})@foliolens\.in$", re.IGNORECASE)
SVIX_TOLERANCE_SECONDS = 5 * 60
RESEND_API_BASE_URL = os.environ.get("RESEND_API_BASE_URL", "https://api.resend.com")


class RouterError(Exception):
    status: int = 500


class MissingConfigError(RouterError):
    status = 500


class SignatureError(RouterError):
    status = 401


class UpstreamError(RouterError):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status


@dataclass(frozen=True)
class Route:
    kind: str
    recipient: str | None = None
    token: str | None = None
    alias: str | None = None


def _header(headers: dict[str, str], name: str) -> str | None:
    lower = name.lower()
    for key, value in headers.items():
        if key.lower() == lower:
            return value
    return None


def _json_loads(raw_body: bytes) -> dict[str, Any]:
    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise UpstreamError(400, "Invalid JSON") from exc
    if not isinstance(payload, dict):
        raise UpstreamError(400, "Invalid payload")
    return payload


def verify_svix_signature(raw_body: bytes, headers: dict[str, str], secret: str) -> None:
    if not secret:
        raise MissingConfigError("RESEND_INBOUND_ROUTER_SECRET is not set")

    svix_id = _header(headers, "svix-id")
    svix_timestamp = _header(headers, "svix-timestamp")
    svix_signature = _header(headers, "svix-signature")
    if not svix_id or not svix_timestamp or not svix_signature:
        raise SignatureError("Missing Svix signature headers")

    try:
        timestamp = int(svix_timestamp)
    except ValueError as exc:
        raise SignatureError("Invalid Svix timestamp") from exc
    if abs(time.time() - timestamp) > SVIX_TOLERANCE_SECONDS:
        raise SignatureError("Svix timestamp outside tolerance")

    secret_value = secret.removeprefix("whsec_")
    try:
        key = base64.b64decode(secret_value)
    except ValueError:
        key = secret_value.encode("utf-8")

    signed_content = b".".join(
        [svix_id.encode("utf-8"), svix_timestamp.encode("utf-8"), raw_body]
    )
    expected = base64.b64encode(
        hmac.new(key, signed_content, hashlib.sha256).digest()
    ).decode("ascii")

    valid = False
    for entry in svix_signature.split(" "):
        version, _, value = entry.strip().partition(",")
        if version == "v1" and hmac.compare_digest(value, expected):
            valid = True
            break
    if not valid:
        raise SignatureError("Invalid Svix signature")


def _recipient_values(data: dict[str, Any]) -> list[str]:
    values: list[str] = []
    for key in ("to", "cc", "bcc"):
        raw_value = data.get(key)
        if isinstance(raw_value, str):
            values.append(raw_value)
        elif isinstance(raw_value, list):
            for item in raw_value:
                if isinstance(item, str):
                    values.append(item)
                elif isinstance(item, dict) and isinstance(item.get("email"), str):
                    name = item.get("name")
                    if isinstance(name, str) and name:
                        values.append(f"{name} <{item['email']}>")
                    else:
                        values.append(item["email"])
    return values


def extract_recipients(event: dict[str, Any]) -> list[str]:
    data = event.get("data")
    if not isinstance(data, dict):
        return []
    recipients = []
    for _, address in getaddresses(_recipient_values(data)):
        if address:
            recipients.append(address.lower())
    return recipients


def choose_route(event: dict[str, Any]) -> Route:
    recipients = extract_recipients(event)

    for recipient in recipients:
        dev_match = DEV_CAS_RE.match(recipient)
        if dev_match:
            return Route(kind="cas_dev", recipient=recipient, token=dev_match.group(1).upper())
        prod_match = PROD_CAS_RE.match(recipient)
        if prod_match:
            return Route(kind="cas_prod", recipient=recipient, token=prod_match.group(1).upper())

    for recipient in recipients:
        local, _, domain = recipient.partition("@")
        if domain == INBOUND_DOMAIN and local in HUMAN_ALIASES:
            return Route(kind="human_forward", recipient=recipient, alias=local)

    return Route(kind="drop")


def _resend_api_key() -> str:
    api_key = os.environ.get("RESEND_API_KEY", "")
    if not api_key:
        raise MissingConfigError("RESEND_API_KEY is not set")
    return api_key


def _request_json(
    method: str,
    path: str,
    body: dict[str, Any] | None = None,
    idempotency_key: str | None = None,
) -> dict[str, Any]:
    data = None if body is None else json.dumps(body).encode("utf-8")
    headers = {
        "Authorization": f"Bearer {_resend_api_key()}",
        "Content-Type": "application/json",
    }
    if idempotency_key:
        headers["Idempotency-Key"] = idempotency_key

    request = urllib.request.Request(
        f"{RESEND_API_BASE_URL}{path}",
        data=data,
        headers=headers,
        method=method,
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            raw = response.read()
            if not raw:
                return {}
            parsed = json.loads(raw.decode("utf-8"))
            return parsed if isinstance(parsed, dict) else {}
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise UpstreamError(exc.code, f"Resend API failed: {detail}") from exc
    except urllib.error.URLError as exc:
        raise UpstreamError(502, f"Resend API unavailable: {exc.reason}") from exc


def get_received_email(email_id: str) -> dict[str, Any]:
    return _request_json("GET", f"/emails/receiving/{email_id}")


def list_received_attachments(email_id: str) -> list[dict[str, Any]]:
    response = _request_json("GET", f"/emails/receiving/{email_id}/attachments")
    data = response.get("data")
    return data if isinstance(data, list) else []


def _attachment_payloads(email_id: str) -> list[dict[str, str]]:
    payloads: list[dict[str, str]] = []
    for attachment in list_received_attachments(email_id):
        if not isinstance(attachment, dict):
            continue
        download_url = attachment.get("download_url")
        filename = attachment.get("filename")
        if not download_url or not filename:
            continue
        payload: dict[str, str] = {"path": str(download_url), "filename": str(filename)}
        content_type = attachment.get("content_type")
        if content_type:
            payload["content_type"] = str(content_type)
        content_id = attachment.get("content_id")
        if content_id:
            payload["content_id"] = str(content_id)
        payloads.append(payload)
    return payloads


def _forward_recipients() -> list[str]:
    raw_value = os.environ.get("MAIL_FORWARD_TO", "")
    recipients = [item.strip() for item in raw_value.split(",") if item.strip()]
    if not recipients:
        raise MissingConfigError("MAIL_FORWARD_TO is not set")
    return recipients


def _original_from(email: dict[str, Any], event: dict[str, Any]) -> str:
    value = email.get("from")
    if isinstance(value, str) and value:
        return value
    if isinstance(value, dict) and isinstance(value.get("email"), str):
        name = value.get("name")
        if isinstance(name, str) and name:
            return f"{name} <{value['email']}>"
        return value["email"]
    data = event.get("data")
    if isinstance(data, dict) and isinstance(data.get("from"), str):
        return data["from"]
    if isinstance(data, dict) and isinstance(data.get("from"), dict):
        from_value = data["from"]
        if isinstance(from_value.get("email"), str):
            name = from_value.get("name")
            if isinstance(name, str) and name:
                return f"{name} <{from_value['email']}>"
            return from_value["email"]
    return ""


def forward_human_email(event: dict[str, Any], route: Route, svix_id: str | None) -> dict[str, Any]:
    data = event.get("data")
    if not isinstance(data, dict) or not isinstance(data.get("email_id"), str):
        raise UpstreamError(400, "email.received payload missing data.email_id")

    email_id = data["email_id"]
    email = get_received_email(email_id)
    original_from = _original_from(email, event)

    send_body: dict[str, Any] = {
        "from": os.environ.get("MAIL_FORWARD_FROM", "FolioLens Mail <noreply@foliolens.in>"),
        "to": _forward_recipients(),
        "subject": email.get("subject") or data.get("subject") or "(no subject)",
        "headers": {
            "X-FolioLens-Inbound-Alias": route.alias or "",
            "X-FolioLens-Original-Recipient": route.recipient or "",
        },
    }
    if original_from:
        send_body["reply_to"] = original_from

    html = email.get("html")
    text = email.get("text")
    if isinstance(html, str) and html:
        send_body["html"] = html
    if isinstance(text, str) and text:
        send_body["text"] = text
    if "html" not in send_body and "text" not in send_body:
        send_body["text"] = (
            "Forwarded by FolioLens inbound mail router.\n\n"
            f"From: {original_from or '(unknown)'}\n"
            f"To: {route.recipient or '(unknown)'}\n"
        )

    attachments = _attachment_payloads(email_id)
    if attachments:
        send_body["attachments"] = attachments

    return _request_json(
        "POST",
        "/emails",
        send_body,
        idempotency_key=f"forward-{svix_id}" if svix_id else None,
    )


def _supabase_url(route: Route) -> str:
    if route.kind == "cas_dev":
        env_key = "SUPABASE_DEV_FUNCTION_URL"
    elif route.kind == "cas_prod":
        env_key = "SUPABASE_PROD_FUNCTION_URL"
    else:
        raise ValueError(f"Unsupported Supabase route: {route.kind}")
    value = os.environ.get(env_key, "")
    if not value:
        raise MissingConfigError(f"{env_key} is not set")
    return value


def forward_cas_to_supabase(route: Route, raw_body: bytes, headers: dict[str, str]) -> dict[str, Any]:
    forwarded_headers = {
        "Content-Type": _header(headers, "content-type") or "application/json",
        "svix-id": _header(headers, "svix-id") or "",
        "svix-timestamp": _header(headers, "svix-timestamp") or "",
        "svix-signature": _header(headers, "svix-signature") or "",
        "x-foliolens-router": "resend-inbound-router",
    }
    request = urllib.request.Request(
        _supabase_url(route),
        data=raw_body,
        headers=forwarded_headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=25) as response:
            body = response.read().decode("utf-8", errors="replace")
            return {"status": response.status, "body": body}
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise UpstreamError(exc.code, f"Supabase CAS webhook failed: {body}") from exc
    except urllib.error.URLError as exc:
        raise UpstreamError(502, f"Supabase CAS webhook unavailable: {exc.reason}") from exc


def route_event(raw_body: bytes, headers: dict[str, str]) -> tuple[int, dict[str, Any]]:
    verify_svix_signature(
        raw_body,
        headers,
        os.environ.get("RESEND_INBOUND_ROUTER_SECRET", ""),
    )

    event = _json_loads(raw_body)
    event_type = event.get("type")
    if event_type != "email.received":
        return 200, {"ok": True, "route": "ignored", "event_type": event_type}

    route = choose_route(event)
    if route.kind == "drop":
        return 200, {"ok": True, "route": "drop"}
    if route.kind == "human_forward":
        result = forward_human_email(event, route, _header(headers, "svix-id"))
        return 200, {"ok": True, "route": "human_forward", "resend": result}
    if route.kind in {"cas_dev", "cas_prod"}:
        result = forward_cas_to_supabase(route, raw_body, headers)
        return 200, {"ok": True, "route": route.kind, "upstream": result}

    raise UpstreamError(500, f"Unhandled route kind: {route.kind}")
