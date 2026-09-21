#!/usr/bin/env python3
"""TayMas Desk — локальная диспетчерская. Без зависимостей, python3 app.py."""

from __future__ import annotations

import argparse
import json
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from classify import classify, classify_text, ticket_payload
from filter import critical_only, load_events

ROOT = Path(__file__).resolve().parent
WEB = ROOT / "web"

EVENT_META = {
    "disk 90%": {"title": "Диск заполнен на 90%", "host": "storage-01", "service": "диск"},
    "user login": {"title": "Вход пользователя", "host": "auth-gw", "service": "доступ"},
    "cpu 40%": {"title": "CPU 40%", "host": "api-03", "service": "нагрузка"},
    "payment failed": {"title": "Платёж не прошёл", "host": "billing", "service": "оплата"},
    "heartbeat": {"title": "Heartbeat", "host": "monitor", "service": "здоровье"},
    "db timeout": {"title": "Таймаут базы", "host": "postgres-main", "service": "бд"},
    "cache miss": {"title": "Cache miss", "host": "redis-1", "service": "кэш"},
    "deploy ok": {"title": "Деплой прошёл", "host": "ci", "service": "релиз"},
}


def boot_state() -> dict:
    tickets = [ticket_payload(ticket) for ticket in classify()]
    events = []
    for index, event in enumerate(load_events(), start=1):
        meta = EVENT_META.get(event.message, {})
        events.append(
            {
                "id": index,
                "message": event.message,
                "level": event.level,
                "title": meta.get("title", event.message),
                "host": meta.get("host", "unknown"),
                "service": meta.get("service", "система"),
            }
        )
    critical = critical_only(load_events())
    return {
        "tickets": tickets,
        "events": events,
        "summary": f"критичных {len(critical)}",
        "critical_count": len(critical),
        "total_events": len(events),
    }


STATE = boot_state()
STATE_LOCK = threading.Lock()


def json_bytes(payload: object, status: int = 200) -> tuple[int, bytes, str]:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    return status, body, "application/json; charset=utf-8"


def handle_api(method: str, path: str, raw: bytes) -> tuple[int, bytes, str]:
    if method == "GET" and path == "/api/state":
        with STATE_LOCK:
            return json_bytes(STATE)

    if method == "POST" and path == "/api/classify":
        try:
            data = json.loads(raw.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            return json_bytes({"error": "не удалось прочитать JSON"}, 400)
        text = str(data.get("text", "")).strip()
        if not text:
            return json_bytes({"error": "пустой текст"}, 400)
        with STATE_LOCK:
            next_id = max((item["id"] for item in STATE["tickets"]), default=0) + 1
            ticket = ticket_payload(classify_text(text, number=next_id))
            STATE["tickets"].insert(0, ticket)
        return json_bytes(ticket)

    return json_bytes({"error": "не найдено"}, 404)


def safe_file(url_path: str) -> Path | None:
    relative = url_path.lstrip("/") or "index.html"
    candidate = (WEB / relative).resolve()
    if WEB.resolve() not in candidate.parents and candidate != WEB.resolve():
        return None
    if candidate.is_file():
        return candidate
    return None


MIME = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".svg": "image/svg+xml",
    ".json": "application/json; charset=utf-8",
    ".ico": "image/x-icon",
}


class ReusableDeskServer(ThreadingHTTPServer):
    allow_reuse_address = True


class DeskHandler(BaseHTTPRequestHandler):
    def log_message(self, format: str, *args: object) -> None:
        print(f"  {self.address_string()}  {args[0]}")

    def _send(self, status: int, body: bytes, content_type: str) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/"):
            status, body, content_type = handle_api("GET", parsed.path, b"")
            self._send(status, body, content_type)
            return
        path = safe_file(parsed.path)
        if path is None:
            self._send(404, "не найдено".encode("utf-8"), "text/plain; charset=utf-8")
            return
        self._send(200, path.read_bytes(), MIME.get(path.suffix, "application/octet-stream"))

    def do_POST(self) -> None:
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length else b""
        parsed = urlparse(self.path)
        status, body, content_type = handle_api("POST", parsed.path, raw)
        self._send(status, body, content_type)


def main() -> None:
    parser = argparse.ArgumentParser(description="TayMas Desk")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--no-open", action="store_true", help="не открывать браузер")
    args = parser.parse_args()
    host = "127.0.0.1"
    url = f"http://{host}:{args.port}"
    server = ReusableDeskServer((host, args.port), DeskHandler)
    print(flush=True)
    print("  TayMas Desk  ·  диспетчерская", flush=True)
    print(f"  {url}", flush=True)
    print("  Ctrl+C — остановить", flush=True)
    print(flush=True)
    if not args.no_open:
        threading.Timer(0.4, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  остановлено")
        server.server_close()


if __name__ == "__main__":
    main()
