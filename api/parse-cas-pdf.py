from __future__ import annotations

import hashlib
import json
import os
from http.server import BaseHTTPRequestHandler

from api._cas_parser import parse_cas_pdf_bytes
from api._cdsl_nsdl_parser import HoldingsOnlyError


PARSER_SECRET = os.environ.get("CAS_PARSER_SHARED_SECRET", "")


def _json(handler: BaseHTTPRequestHandler, status: int, body: dict) -> None:
    payload = json.dumps(body).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(payload)))
    handler.end_headers()
    handler.wfile.write(payload)


def _hash_prefix(value: str) -> str:
    """Return first 8 hex chars of sha256(value), or 'empty' for falsy input.

    Used in the 401 diagnostic only — comparing hashes of the env-loaded secret
    against the secret the caller sent reveals whether they differ without
    exposing either value. Caller's hash and ours match → values are byte-for-
    byte identical; mismatched hashes → different value (typo, whitespace,
    missing env, wrong project)."""
    if not value:
        return "empty"
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:8]


class handler(BaseHTTPRequestHandler):
    def do_POST(self) -> None:
        if not PARSER_SECRET or self.headers.get("x-parser-secret") != PARSER_SECRET:
            received = self.headers.get("x-parser-secret", "") or ""
            diag = (
                f"env_present={bool(PARSER_SECRET)} "
                f"env_hash={_hash_prefix(PARSER_SECRET)} "
                f"env_len={len(PARSER_SECRET)} "
                f"recv_hash={_hash_prefix(received)} "
                f"recv_len={len(received)}"
            )
            _json(self, 401, {"error": "Unauthorized", "diag": diag})
            return

        password = self.headers.get("x-password", "").strip()
        if not password:
            _json(self, 400, {"error": "Missing PDF password"})
            return

        cdsl_password = self.headers.get("x-password-cdsl", "").strip() or None

        content_length = int(self.headers.get("content-length", "0"))
        pdf_bytes = self.rfile.read(content_length)
        if not pdf_bytes:
            _json(self, 400, {"error": "Empty file received"})
            return

        try:
            parsed = parse_cas_pdf_bytes(pdf_bytes, password, cdsl_password)
        except HoldingsOnlyError as exc:
            _json(self, 422, {"error": str(exc)})
            return
        except Exception as exc:
            message = str(exc)
            lowered = message.lower()
            is_password_error = (
                "password" in lowered
                or "decrypt" in lowered
                or "encrypted" in lowered
                or "invalid key" in lowered
            )
            _json(
                self,
                422 if is_password_error else 500,
                {"error": message},
            )
            return

        _json(self, 200, parsed)
