#!/usr/bin/env bash
set -euo pipefail

LABEL="com.prometheus.os.companion"
STATIC_LABEL="com.prometheus.os.staticserver"
TTS_LABEL="com.prometheus.os.ttsbackend"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
STATIC_PLIST="$HOME/Library/LaunchAgents/$STATIC_LABEL.plist"
TTS_PLIST="$HOME/Library/LaunchAgents/$TTS_LABEL.plist"

launchctl bootout "gui/$(id -u)" "$PLIST" >/dev/null 2>&1 || true
launchctl bootout "gui/$(id -u)" "$STATIC_PLIST" >/dev/null 2>&1 || true
launchctl bootout "gui/$(id -u)" "$TTS_PLIST" >/dev/null 2>&1 || true
rm -f "$PLIST"
rm -f "$STATIC_PLIST"
rm -f "$TTS_PLIST"

echo "Removed LaunchAgent: $LABEL"
echo "Removed LaunchAgent: $STATIC_LABEL"
echo "Removed LaunchAgent: $TTS_LABEL"
