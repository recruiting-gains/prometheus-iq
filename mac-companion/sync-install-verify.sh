#!/usr/bin/env bash
set -euo pipefail

COMPANION_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$COMPANION_DIR/.." && pwd)"
SUPPORT_DIR="${PROMETHEUS_COMPANION_SUPPORT_DIR:-$HOME/Library/Application Support/PrometheusCompanion}"
RUN_DIR="$SUPPORT_DIR/run"
LOG_DIR="$SUPPORT_DIR/logs"
APP_PATH="$SUPPORT_DIR/PrometheusCompanion.app"
RUNTIME_DIR="$SUPPORT_DIR/prometheus-os"
INTEGRATIONS_DIR="$SUPPORT_DIR/integrations"
SOCIAL_MEDIA_DIR="$SUPPORT_DIR/social-media"
SOURCE_MANIFEST="$COMPANION_DIR/companion-version.json"
INSTALLED_MANIFEST="$SUPPORT_DIR/companion-version.json"
RUNTIME_MANIFEST="$RUNTIME_DIR/companion-runtime-version.json"
REPORT_PATH="${PROMETHEUS_COMPANION_REPORT:-$COMPANION_DIR/reports/latest-companion-verification-report.md}"
PRESERVED_ENV="$RUN_DIR/backend.env.preserved"
SYNC_SUMMARY="$SUPPORT_DIR/companion-sync-summary.json"
KEEP_RUNNING="${PROMETHEUS_COMPANION_KEEP_RUNNING:-1}"
STARTED_PIDS=()

NODE_BIN=""
if command -v node >/dev/null 2>&1; then
  NODE_BIN="$(command -v node)"
fi
for candidate in "$NODE_BIN" /opt/homebrew/bin/node /usr/local/bin/node /usr/bin/node; do
  if [[ -x "$candidate" ]]; then
    NODE_BIN="$candidate"
    break
  fi
done

if [[ -z "$NODE_BIN" ]]; then
  echo "FAIL Node was not found. Companion verification requires Node for the local backend and checks." >&2
  exit 1
fi

if ! command -v swiftc >/dev/null 2>&1; then
  echo "FAIL swiftc was not found. Install Xcode command line tools before building Companion." >&2
  exit 1
fi

mkdir -p "$RUN_DIR" "$LOG_DIR" "$(dirname "$REPORT_PATH")"

is_port_open() {
  /usr/sbin/lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

sha_file() {
  if [[ -f "$1" ]]; then
    /usr/bin/shasum -a 256 "$1" | awk '{print $1}'
  else
    echo ""
  fi
}

stop_pid_if_companion() {
  local pid="$1"
  local command_line
  command_line="$(ps -p "$pid" -o command= 2>/dev/null || true)"
  if [[ "$command_line" == *"http.server 8791"* || "$command_line" == *"prometheus-os/backend/server.js"* ]]; then
    kill "$pid" >/dev/null 2>&1 || true
    sleep 0.5
    kill -9 "$pid" >/dev/null 2>&1 || true
  fi
}

stop_port_if_companion() {
  local port="$1"
  local pids
  pids="$(/usr/sbin/lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  [[ -z "$pids" ]] && return 0
  while IFS= read -r pid; do
    [[ -n "$pid" ]] && stop_pid_if_companion "$pid"
  done <<< "$pids"
}

cleanup_verification_services() {
  if [[ "$KEEP_RUNNING" == "1" ]]; then
    return 0
  fi

  for pid in "${STARTED_PIDS[@]}"; do
    [[ -n "${pid:-}" ]] && stop_pid_if_companion "$pid"
    [[ -n "${pid:-}" ]] && wait "$pid" 2>/dev/null || true
  done
}

trap cleanup_verification_services EXIT

verify_native_escape_exit() {
  if [[ "${PROMETHEUS_COMPANION_SKIP_ESC_TEST:-0}" == "1" ]]; then
    echo "SKIP native-esc: PROMETHEUS_COMPANION_SKIP_ESC_TEST=1"
    {
      echo ""
      echo "## Native ESC Regression"
      echo ""
      echo "- SKIP native-esc: PROMETHEUS_COMPANION_SKIP_ESC_TEST=1"
    } >>"$REPORT_PATH"
    return 0
  fi

  local log_file="$LOG_DIR/companion.log"
  local start_line
  mkdir -p "$LOG_DIR"
  touch "$log_file"
  start_line="$(( $(wc -l < "$log_file" | tr -d ' ') + 1 ))"

  echo "== Verify native ESC exit =="
  /usr/bin/open "$APP_PATH"

  for _ in {1..30}; do
    if tail -n +"$start_line" "$log_file" | grep -q "Prometheus OS window opened and focused."; then
      break
    fi
    sleep 0.5
  done

  if ! /usr/bin/osascript -e 'tell application "System Events" to key code 53' >/tmp/prometheus-companion-esc-test.out 2>/tmp/prometheus-companion-esc-test.err; then
    echo "FAIL native-esc: System Events could not send ESC. $(cat /tmp/prometheus-companion-esc-test.err)" >&2
    {
      echo ""
      echo "## Native ESC Regression"
      echo ""
      echo "- FAIL native-esc: System Events could not send ESC."
    } >>"$REPORT_PATH"
    exit 1
  fi

  for _ in {1..20}; do
    if tail -n +"$start_line" "$log_file" | grep -q "ESC exit completed."; then
      echo "PASS native-esc: one ESC press produced native exit completion"
      {
        echo ""
        echo "## Native ESC Regression"
        echo ""
        echo "- PASS native-esc: one ESC press produced native exit completion."
      } >>"$REPORT_PATH"
      return 0
    fi
    sleep 0.5
  done

  echo "FAIL native-esc: one ESC press did not produce native exit completion." >&2
  echo "Recent Companion log:" >&2
  tail -n +"$start_line" "$log_file" >&2
  {
    echo ""
    echo "## Native ESC Regression"
    echo ""
    echo "- FAIL native-esc: one ESC press did not produce native exit completion."
  } >>"$REPORT_PATH"
  exit 1
}

echo "== Prometheus Companion sync/install/verify =="
echo "Project: $PROJECT_ROOT"
echo "Runtime: $SUPPORT_DIR"

echo "== Clean previous runtime services =="
for pid_file in "$RUN_DIR"/*.pid "$COMPANION_DIR/run"/*.pid; do
  [[ -f "$pid_file" ]] || continue
  pid="$(cat "$pid_file" 2>/dev/null || true)"
  [[ -n "${pid:-}" ]] && stop_pid_if_companion "$pid"
  rm -f "$pid_file"
done
stop_port_if_companion 8791
stop_port_if_companion 8792

ENV_BEFORE_SHA=""
if [[ -f "$RUNTIME_DIR/backend/.env" ]]; then
  ENV_BEFORE_SHA="$(sha_file "$RUNTIME_DIR/backend/.env")"
  cp "$RUNTIME_DIR/backend/.env" "$PRESERVED_ENV"
fi

echo "== Generate source version =="
"$NODE_BIN" "$COMPANION_DIR/create-version-manifest.mjs" \
  --project-root "$PROJECT_ROOT" \
  --support-dir "$SUPPORT_DIR" \
  --scope source \
  --output "$SOURCE_MANIFEST" >/dev/null

echo "== Build Companion =="
"$COMPANION_DIR/build.sh"

echo "== Clean installed runtime =="
rm -rf "$RUNTIME_DIR" "$INTEGRATIONS_DIR" "$SOCIAL_MEDIA_DIR" "$APP_PATH" "$INSTALLED_MANIFEST"
mkdir -p "$SUPPORT_DIR" "$RUN_DIR" "$LOG_DIR"

echo "== Synchronize runtime files and assets =="
rsync -a --delete \
  --exclude 'backend/.env' \
  --exclude 'companion-runtime-version.json' \
  "$PROJECT_ROOT/prometheus-os/" \
  "$RUNTIME_DIR/"
rsync -a --delete \
  "$PROJECT_ROOT/integrations/" \
  "$INTEGRATIONS_DIR/"
rsync -a --delete \
  "$PROJECT_ROOT/social-media/" \
  "$SOCIAL_MEDIA_DIR/"

cp -R "$COMPANION_DIR/.build/PrometheusCompanion.app" "$APP_PATH"
cp "$COMPANION_DIR/start-prometheus-os.sh" "$SUPPORT_DIR/start-prometheus-os.source.sh"

if [[ -f "$PRESERVED_ENV" && ! -f "$RUNTIME_DIR/backend/.env" ]]; then
  mkdir -p "$RUNTIME_DIR/backend"
  cp "$PRESERVED_ENV" "$RUNTIME_DIR/backend/.env"
fi

echo "== Write installed version manifests =="
"$NODE_BIN" "$COMPANION_DIR/create-version-manifest.mjs" \
  --project-root "$PROJECT_ROOT" \
  --support-dir "$SUPPORT_DIR" \
  --scope installed \
  --source-manifest "$SOURCE_MANIFEST" \
  --output "$INSTALLED_MANIFEST" >/dev/null
cp "$INSTALLED_MANIFEST" "$RUNTIME_MANIFEST"

echo "== Install local startup script =="
cat > "$SUPPORT_DIR/start-prometheus-os.sh" <<SCRIPT
#!/usr/bin/env bash
set -euo pipefail

SUPPORT_DIR="$SUPPORT_DIR"
LOG_DIR="\$SUPPORT_DIR/logs"
RUN_DIR="\$SUPPORT_DIR/run"
APP_PATH="\$SUPPORT_DIR/PrometheusCompanion.app"

mkdir -p "\$LOG_DIR" "\$RUN_DIR"

is_port_open() {
  /usr/sbin/lsof -nP -iTCP:"\$1" -sTCP:LISTEN >/dev/null 2>&1
}

if ! is_port_open 8791; then
  nohup bash -c '
    cd "\$1"
    /usr/bin/python3 -m http.server 8791 --bind 127.0.0.1
  ' _ "\$SUPPORT_DIR" >>"\$LOG_DIR/prometheus-os-static.log" 2>&1 &
  echo \$! > "\$RUN_DIR/prometheus-os-static.pid"
fi

NODE_BIN="$NODE_BIN"
if [[ -z "\$NODE_BIN" ]] && command -v node >/dev/null 2>&1; then
  NODE_BIN="\$(command -v node)"
fi
for candidate in "\$NODE_BIN" /opt/homebrew/bin/node /usr/local/bin/node /usr/bin/node; do
  if [[ -x "\$candidate" ]]; then
    NODE_BIN="\$candidate"
    break
  fi
done

if [[ -f "\$SUPPORT_DIR/prometheus-os/backend/server.js" ]] && ! is_port_open 8792 && [[ -n "\$NODE_BIN" ]]; then
  nohup bash -c '
    cd "\$1"
    "\$2" prometheus-os/backend/server.js
  ' _ "\$SUPPORT_DIR" "\$NODE_BIN" >>"\$LOG_DIR/prometheus-os-tts-backend.log" 2>&1 &
  echo \$! > "\$RUN_DIR/prometheus-os-tts-backend.pid"
fi

PROMETHEUS_OS_URL="http://127.0.0.1:8791/prometheus-os/" /usr/bin/open "\$APP_PATH"
SCRIPT
chmod +x "$SUPPORT_DIR/start-prometheus-os.sh"

ENV_AFTER_SHA="$(sha_file "$RUNTIME_DIR/backend/.env")"
ENV_PRESERVED=false
if [[ -z "$ENV_BEFORE_SHA" && -z "$ENV_AFTER_SHA" ]]; then
  ENV_PRESERVED=true
elif [[ -n "$ENV_BEFORE_SHA" && "$ENV_BEFORE_SHA" == "$ENV_AFTER_SHA" ]]; then
  ENV_PRESERVED=true
fi

cat > "$SYNC_SUMMARY" <<JSON
{
  "generatedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "projectRoot": "$PROJECT_ROOT",
  "supportDir": "$SUPPORT_DIR",
  "synced": {
    "macCompanionApp": "$APP_PATH",
    "prometheusOsRuntime": "$RUNTIME_DIR",
    "founderCommunicationsContract": "$INTEGRATIONS_DIR",
    "socialMediaContract": "$SOCIAL_MEDIA_DIR",
    "versionManifest": "$INSTALLED_MANIFEST",
    "runtimeVersionManifest": "$RUNTIME_MANIFEST",
    "startupScript": "$SUPPORT_DIR/start-prometheus-os.sh"
  },
  "env": {
    "source": "$RUNTIME_DIR/backend/.env",
    "preserved": $ENV_PRESERVED,
    "existedBefore": $([[ -n "$ENV_BEFORE_SHA" ]] && echo true || echo false),
    "existsAfter": $([[ -n "$ENV_AFTER_SHA" ]] && echo true || echo false),
    "sha256Before": "$ENV_BEFORE_SHA",
    "sha256After": "$ENV_AFTER_SHA"
  },
  "startup": {
    "mode": "$([[ "$KEEP_RUNNING" == "1" ]] && echo persistent || echo transient-verification)",
    "keepRunning": $([[ "$KEEP_RUNNING" == "1" ]] && echo true || echo false)
  }
}
JSON
cp "$SYNC_SUMMARY" "$RUNTIME_DIR/companion-sync-summary.json"

if [[ "$ENV_PRESERVED" != "true" ]]; then
  echo "FAIL installed backend .env was not preserved." >&2
  exit 1
fi

echo "== Verify startup services =="
nohup bash -c '
  cd "$1"
  /usr/bin/python3 -m http.server 8791 --bind 127.0.0.1
' _ "$SUPPORT_DIR" >>"$LOG_DIR/prometheus-os-static.log" 2>&1 &
static_pid="$!"
echo "$static_pid" > "$RUN_DIR/prometheus-os-static.pid"
STARTED_PIDS+=("$static_pid")
disown "$static_pid" 2>/dev/null || true

nohup bash -c '
  cd "$1"
  "$2" prometheus-os/backend/server.js
' _ "$SUPPORT_DIR" "$NODE_BIN" >>"$LOG_DIR/prometheus-os-tts-backend.log" 2>&1 &
backend_pid="$!"
echo "$backend_pid" > "$RUN_DIR/prometheus-os-tts-backend.pid"
STARTED_PIDS+=("$backend_pid")
disown "$backend_pid" 2>/dev/null || true

for attempt in {1..30}; do
  if curl -fsS "http://127.0.0.1:8791/prometheus-os/" >/dev/null 2>&1 &&
     curl -fsS "http://127.0.0.1:8792/api/health" >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

echo "== Run Companion verification =="
PROMETHEUS_PROJECT_ROOT="$PROJECT_ROOT" \
PROMETHEUS_COMPANION_SUPPORT_DIR="$SUPPORT_DIR" \
PROMETHEUS_COMPANION_REPORT="$REPORT_PATH" \
"$NODE_BIN" "$COMPANION_DIR/verify-runtime.mjs"

verify_native_escape_exit

echo "== Complete =="
echo "Installed app: $APP_PATH"
echo "Installed runtime: $RUNTIME_DIR"
echo "Report: $REPORT_PATH"
