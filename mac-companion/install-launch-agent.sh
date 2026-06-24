#!/usr/bin/env bash
set -euo pipefail

COMPANION_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$COMPANION_DIR/.." && pwd)"
LABEL="com.prometheus.os.companion"
STATIC_LABEL="com.prometheus.os.staticserver"
TTS_LABEL="com.prometheus.os.ttsbackend"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
STATIC_PLIST="$HOME/Library/LaunchAgents/$STATIC_LABEL.plist"
TTS_PLIST="$HOME/Library/LaunchAgents/$TTS_LABEL.plist"
SUPPORT_DIR="$HOME/Library/Application Support/PrometheusCompanion"
INSTALL_SCRIPT="$SUPPORT_DIR/start-prometheus-os.sh"
INSTALLED_APP="$SUPPORT_DIR/PrometheusCompanion.app"
PRESERVED_ENV="$SUPPORT_DIR/run/backend.env.preserved"

"$COMPANION_DIR/build.sh"
mkdir -p "$HOME/Library/LaunchAgents"
mkdir -p "$SUPPORT_DIR/logs" "$SUPPORT_DIR/run"

if [[ -f "$SUPPORT_DIR/prometheus-os/backend/.env" ]]; then
  cp "$SUPPORT_DIR/prometheus-os/backend/.env" "$PRESERVED_ENV"
fi

rm -rf "$SUPPORT_DIR/prometheus-os" "$INSTALLED_APP"
cp -R "$PROJECT_ROOT/prometheus-os" "$SUPPORT_DIR/prometheus-os"
cp -R "$COMPANION_DIR/.build/PrometheusCompanion.app" "$INSTALLED_APP"

if [[ -f "$PRESERVED_ENV" && ! -f "$SUPPORT_DIR/prometheus-os/backend/.env" ]]; then
  cp "$PRESERVED_ENV" "$SUPPORT_DIR/prometheus-os/backend/.env"
fi

cat > "$INSTALL_SCRIPT" <<SCRIPT
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

NODE_BIN=""
for candidate in /opt/homebrew/bin/node /usr/local/bin/node /usr/bin/node; do
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
elif [[ -z "\$NODE_BIN" ]]; then
  echo "Node was not found. Premium TTS backend skipped; macOS voice fallback remains available." >>"\$LOG_DIR/prometheus-os-tts-backend.log"
fi

PROMETHEUS_OS_URL="http://127.0.0.1:8791/prometheus-os/" /usr/bin/open "\$APP_PATH"
SCRIPT

chmod +x "$INSTALL_SCRIPT"

NODE_BIN=""
for candidate in /opt/homebrew/bin/node /usr/local/bin/node /usr/bin/node; do
  if [[ -x "$candidate" ]]; then
    NODE_BIN="$candidate"
    break
  fi
done

cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$INSTALL_SCRIPT</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <false/>
  <key>StandardOutPath</key>
  <string>$SUPPORT_DIR/logs/launch-agent.out.log</string>
  <key>StandardErrorPath</key>
  <string>$SUPPORT_DIR/logs/launch-agent.err.log</string>
</dict>
</plist>
PLIST

cat > "$STATIC_PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$STATIC_LABEL</string>
  <key>WorkingDirectory</key>
  <string>$SUPPORT_DIR</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/python3</string>
    <string>-m</string>
    <string>http.server</string>
    <string>8791</string>
    <string>--bind</string>
    <string>127.0.0.1</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <false/>
  <key>StandardOutPath</key>
  <string>$SUPPORT_DIR/logs/static-server.out.log</string>
  <key>StandardErrorPath</key>
  <string>$SUPPORT_DIR/logs/static-server.err.log</string>
</dict>
</plist>
PLIST

if [[ -n "$NODE_BIN" ]]; then
  cat > "$TTS_PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$TTS_LABEL</string>
  <key>WorkingDirectory</key>
  <string>$SUPPORT_DIR</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE_BIN</string>
    <string>prometheus-os/backend/server.js</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PROMETHEUS_OS_HOST</key>
    <string>127.0.0.1</string>
    <key>PROMETHEUS_OS_PORT</key>
    <string>8792</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <false/>
  <key>StandardOutPath</key>
  <string>$SUPPORT_DIR/logs/tts-backend.out.log</string>
  <key>StandardErrorPath</key>
  <string>$SUPPORT_DIR/logs/tts-backend.err.log</string>
</dict>
</plist>
PLIST
fi

launchctl bootout "gui/$(id -u)" "$PLIST" >/dev/null 2>&1 || true
launchctl bootout "gui/$(id -u)" "$STATIC_PLIST" >/dev/null 2>&1 || true
launchctl bootout "gui/$(id -u)" "$TTS_PLIST" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
launchctl bootstrap "gui/$(id -u)" "$STATIC_PLIST" || true
if [[ -f "$TTS_PLIST" ]]; then
  launchctl bootstrap "gui/$(id -u)" "$TTS_PLIST"
fi
launchctl kickstart -k "gui/$(id -u)/$LABEL"
launchctl kickstart -k "gui/$(id -u)/$STATIC_LABEL" >/dev/null 2>&1 || true
if [[ -f "$TTS_PLIST" ]]; then
  launchctl kickstart -k "gui/$(id -u)/$TTS_LABEL" >/dev/null 2>&1 || true
fi

echo "Installed LaunchAgent: $PLIST"
echo "Installed static server LaunchAgent: $STATIC_PLIST"
if [[ -f "$TTS_PLIST" ]]; then
  echo "Installed TTS backend LaunchAgent: $TTS_PLIST"
else
  echo "Node was not found. TTS backend LaunchAgent was not installed."
fi
echo "Installed runtime: $SUPPORT_DIR"
echo "Prometheus Companion will launch at login."
