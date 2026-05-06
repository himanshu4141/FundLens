from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler

from api._resend_inbound_router import RouterError, route_event


def _json(handler: BaseHTTPRequestHandler, status: int, body: dict) -> None:
    payload = json.dumps(body).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(payload)))
    handler.end_headers()
    handler.wfile.write(payload)


class handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        _json(self, 200, {"ok": True, "service": "resend-inbound-router"})

    def do_POST(self) -> None:
        content_length = int(self.headers.get("content-length", "0"))
        raw_body = self.rfile.read(content_length)

        headers = {key: value for key, value in self.headers.items()}
        try:
            status, body = route_event(raw_body, headers)
        except RouterError as exc:
            _json(self, exc.status, {"ok": False, "error": str(exc)})
            return
        except Exception as exc:
            _json(self, 500, {"ok": False, "error": str(exc)})
            return

        _json(self, status, body)
