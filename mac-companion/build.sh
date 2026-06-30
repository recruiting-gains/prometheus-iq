#!/usr/bin/env bash
set -euo pipefail

COMPANION_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$COMPANION_DIR/.build/PrometheusCompanion.app"
CONTENTS_DIR="$APP_DIR/Contents"
MACOS_DIR="$CONTENTS_DIR/MacOS"
RESOURCES_DIR="$CONTENTS_DIR/Resources"

mkdir -p "$MACOS_DIR" "$RESOURCES_DIR"
cp "$COMPANION_DIR/Info.plist" "$CONTENTS_DIR/Info.plist"
cp "$COMPANION_DIR/PrometheusCompanion.icns" "$RESOURCES_DIR/PrometheusCompanion.icns"
if [[ -f "$COMPANION_DIR/companion-version.json" ]]; then
  cp "$COMPANION_DIR/companion-version.json" "$RESOURCES_DIR/companion-version.json"
fi

swiftc \
  -parse-as-library \
  "$COMPANION_DIR/PrometheusCompanion.swift" \
  -o "$MACOS_DIR/PrometheusCompanion" \
  -framework AppKit \
  -framework AVFAudio \
  -framework AVFoundation \
  -framework WebKit \
  -framework Foundation

chmod +x "$MACOS_DIR/PrometheusCompanion"

echo "Built: $APP_DIR"
