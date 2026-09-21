#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
PORT="${PORT:-8765}"
echo "TayMas Desk → http://127.0.0.1:${PORT}"
export PYTHONUNBUFFERED=1
exec python3 app.py --port "$PORT"
