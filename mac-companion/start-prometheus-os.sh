#!/usr/bin/env bash
set -euo pipefail

COMPANION_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$COMPANION_DIR/.." && pwd)"
LOG_DIR="$COMPANION_DIR/logs"
RUN_DIR="$COMPANION_DIR/run"
APP_PATH="$COMPANION_DIR/.build/PrometheusCompanion.app"

mkdir -p "$LOG_DIR" "$RUN_DIR"

is_port_open() {
  /usr/sbin/lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

if ! is_port_open 8791; then
  nohup bash -c '
    cd "$1"
    /usr/bin/python3 -m http.server 8791 --bind 127.0.0.1
  ' _ "$PROJECT_ROOT" >>"$LOG_DIR/prometheus-os-static.log" 2>&1 &
  echo $! > "$RUN_DIR/prometheus-os-static.pid"
fi

NODE_BIN=""
for candidate in /opt/homebrew/bin/node /usr/local/bin/node /usr/bin/node; do
  if [[ -x "$candidate" ]]; then
    NODE_BIN="$candidate"
    break
  fi
done

if [[ -f "$PROJECT_ROOT/prometheus-os/backend/server.js" ]] && ! is_port_open 8792 && [[ -n "$NODE_BIN" ]]; then
  nohup bash -c '
    cd "$1"
    "$2" prometheus-os/backend/server.js
  ' _ "$PROJECT_ROOT" "$NODE_BIN" >>"$LOG_DIR/prometheus-os-tts-backend.log" 2>&1 &
  echo $! > "$RUN_DIR/prometheus-os-tts-backend.pid"
elif [[ -z "$NODE_BIN" ]]; then
  echo "Node was not found. Premium TTS backend skipped; macOS voice fallback remains available." >>"$LOG_DIR/prometheus-os-tts-backend.log"
fi

if [[ ! -d "$APP_PATH" ]]; then
  "$COMPANION_DIR/build.sh"
fi

/usr/bin/open "$APP_PATH"
