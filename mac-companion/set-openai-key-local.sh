#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_ENV="$PROJECT_ROOT/prometheus-os/backend/.env"
INSTALLED_ENV="$HOME/Library/Application Support/PrometheusCompanion/prometheus-os/backend/.env"
INSTALLED_BACKEND_DIR="$(dirname "$INSTALLED_ENV")"

read_key_from_gui() {
  /usr/bin/osascript <<'APPLESCRIPT'
set dialogResult to display dialog "Paste your OpenAI API key here. It will be saved only to local .env files and will not be printed." default answer "" with hidden answer buttons {"Cancel", "Save Key"} default button "Save Key" cancel button "Cancel"
text returned of dialogResult
APPLESCRIPT
}

write_env_file() {
  local env_file="$1"
  local key_value="$2"
  local env_dir
  env_dir="$(dirname "$env_file")"
  mkdir -p "$env_dir"

  {
    printf 'OPENAI_API_KEY=%s\n' "$key_value"
    printf 'OPENAI_TTS_MODEL=gpt-4o-mini-tts\n'
    printf 'OPENAI_TTS_VOICE=onyx\n'
  } > "$env_file"

  chmod 600 "$env_file"
}

restart_tts_backend() {
  local label="com.prometheus.os.ttsbackend"
  local plist="$HOME/Library/LaunchAgents/$label.plist"

  if [[ -f "$plist" ]]; then
    launchctl kickstart -k "gui/$(id -u)/$label" >/dev/null 2>&1 || true
    return
  fi

  if /usr/sbin/lsof -nP -iTCP:8792 -sTCP:LISTEN >/dev/null 2>&1; then
    local pid
    pid="$(/usr/sbin/lsof -tiTCP:8792 -sTCP:LISTEN | head -n 1)"
    [[ -n "$pid" ]] && kill "$pid" >/dev/null 2>&1 || true
  fi

  (
    cd "$PROJECT_ROOT"
    nohup /opt/homebrew/bin/node prometheus-os/backend/server.js >> "$PROJECT_ROOT/mac-companion/logs/prometheus-os-tts-backend.log" 2>&1 &
  )
}

main() {
  local key_value
  key_value="$(read_key_from_gui)"

  if [[ -z "$key_value" ]]; then
    echo "No key entered. Nothing changed."
    exit 1
  fi

  if [[ "$key_value" != sk-* ]]; then
    echo "The value entered does not look like an OpenAI API key. Nothing changed."
    exit 1
  fi

  write_env_file "$SOURCE_ENV" "$key_value"

  if [[ -d "$INSTALLED_BACKEND_DIR" ]]; then
    write_env_file "$INSTALLED_ENV" "$key_value"
  fi

  restart_tts_backend

  echo "OpenAI API key saved locally."
  echo "Source env: $SOURCE_ENV"
  if [[ -f "$INSTALLED_ENV" ]]; then
    echo "Installed env: $INSTALLED_ENV"
  fi
  echo "Permissions locked to 600."
  echo "Key value was not printed."
}

main "$@"
