from __future__ import annotations

import json
import os
from http.server import BaseHTTPRequestHandler

from api._cas_parser import parse_cas_pdf_bytes


PARSER_SECRET = os.environ.get("CAS_PARSER_SHARED_SECRET", "")


def _json(handler: BaseHTTPRequestHandler, status: int, body: dict) -> None:
    payload = json.dumps(body).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(payload)))
    handler.end_headers()
    handler.wfile.write(payload)


class handler(BaseHTTPRequestHandler):
    def do_POST(self) -> None:
        if not PARSER_SECRET or self.headers.get("x-parser-secret") != PARSER_SECRET:
            _json(self, 401, {"error": "Unauthorized"})
            return

        password = self.headers.get("x-password", "").strip()
        if not password:
            _json(self, 400, {"error": "Missing PDF password"})
            return

        content_length = int(self.headers.get("content-length", "0"))
        pdf_bytes = self.rfile.read(content_length)
        if not pdf_bytes:
            _json(self, 400, {"error": "Empty file received"})
            return

        try:
            parsed = parse_cas_pdf_bytes(pdf_bytes, password)
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
