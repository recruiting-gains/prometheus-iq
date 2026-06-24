#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_ENV="$PROJECT_ROOT/prometheus-os/backend/.env"
INSTALLED_ENV="$HOME/Library/Application Support/PrometheusCompanion/prometheus-os/backend/.env"
INSTALLED_BACKEND_DIR="$(dirname "$INSTALLED_ENV")"
MARK_VOICE_ID="1SM7GgM6IMuvQlz2BwM3"

read_key_from_gui() {
  /usr/bin/osascript <<'APPLESCRIPT'
set dialogResult to display dialog "Paste your ElevenLabs API key here. It will be saved only to local .env files and will not be printed." default answer "" with hidden answer buttons {"Cancel", "Save Key"} default button "Save Key" cancel button "Cancel"
text returned of dialogResult
APPLESCRIPT
}

upsert_env_value() {
  local file="$1"
  local key="$2"
  local value="$3"

  if [[ -f "$file" ]] && grep -q "^${key}=" "$file"; then
    /usr/bin/perl -0pi -e "s#^${key}=.*\$#${key}=${value}#m" "$file"
  else
    printf '%s=%s\n' "$key" "$value" >> "$file"
  fi
}

write_env_file() {
  local env_file="$1"
  local key_value="$2"
  local env_dir
  env_dir="$(dirname "$env_file")"
  mkdir -p "$env_dir"
  touch "$env_file"

  upsert_env_value "$env_file" "ELEVENLABS_API_KEY" "$key_value"
  upsert_env_value "$env_file" "ELEVENLABS_VOICE_ID" "$MARK_VOICE_ID"
  upsert_env_value "$env_file" "ELEVENLABS_MODEL_ID" "eleven_multilingual_v2"

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

  write_env_file "$SOURCE_ENV" "$key_value"

  if [[ -d "$INSTALLED_BACKEND_DIR" ]]; then
    write_env_file "$INSTALLED_ENV" "$key_value"
  fi

  restart_tts_backend

  echo "ElevenLabs API key saved locally."
  echo "Mark voice ID saved locally: $MARK_VOICE_ID"
  echo "Source env: $SOURCE_ENV"
  if [[ -f "$INSTALLED_ENV" ]]; then
    echo "Installed env: $INSTALLED_ENV"
  fi
  echo "Permissions locked to 600."
  echo "Key value was not printed."
}

main "$@"
