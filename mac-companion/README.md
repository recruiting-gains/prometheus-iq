# Prometheus Mac Companion

Private native macOS companion for Prometheus OS.

This is not a customer feature. It is a local founder-only companion that opens Prometheus OS when Cruz launches it from the Dock, loads the private WebView runtime, uses WebView MediaRecorder audio capture with local backend STT, and speaks through either the local premium TTS backend or the built-in browser/macOS voice fallback.

Current operating mode: manual Dock launch. Prometheus Companion should not auto-open at login unless Cruz explicitly reinstalls launch-at-login later.

## What This Makes Possible

- Launch Prometheus OS when Cruz opens the Companion from the Dock.
- Greet Cruz after login or unlock.
- Keep Prometheus in standby/listening mode while the Mac is awake.
- Listen for wake phrases while the companion app is running:
  - `Prometheus`
  - `Good morning Prometheus`
  - `Hey Prometheus`
- Detect a sharp clap as a local wake signal.
- Use premium TTS through the local backend when configured.
- Fall back to built-in macOS speech when premium TTS is unavailable.

## What Is Not Reliably Possible

- Listening while the Mac is fully asleep.
- Listening before macOS unlocks.
- Bypassing macOS microphone permissions.
- Guaranteeing wake-word behavior when macOS suspends the app, the microphone, or the audio engine.

macOS intentionally blocks those behaviors for privacy and battery safety.

## Files

- `PrometheusCompanion.swift` - native macOS companion app source.
- `Info.plist` - app permissions and background/menu-bar configuration.
- `build.sh` - builds `PrometheusCompanion.app`.
- `start-prometheus-os.sh` - starts local Prometheus OS services and opens the companion.
- `install-launch-agent.sh` - installs launch-at-login.
- `uninstall-launch-agent.sh` - removes launch-at-login.
- `.gitignore` - keeps build output, logs, run files, and env files local.

## Local Services

The startup script launches:

```text
http://127.0.0.1:8791/prometheus-os/
```

It also starts the private local premium voice backend if available:

```text
http://127.0.0.1:8792/api/tts
```

No public deployment is required.

## Build

From the project root:

```bash
./mac-companion/build.sh
```

The app bundle is created at:

```text
mac-companion/.build/PrometheusCompanion.app
```

## Run Once

```bash
./mac-companion/start-prometheus-os.sh
```

The first run may ask for:

- Microphone permission.

Approve microphone access for wake phrases to work. Companion no longer depends on Apple Speech Recognition for normal command capture.

If permissions do not appear, open:

```text
System Settings > Privacy & Security > Microphone
```

Then enable Prometheus Companion.

If a Speech Recognition permission dialog appears, it usually means an old runtime or diagnostic build is still active. The current source of truth is:

```text
Companion WebView microphone capture -> local /api/stt backend -> Intelligence Orchestrator -> local /api/tts backend
```

Close the stale Companion instance, rebuild from this folder, and relaunch the Dock app.

## Optional Launch At Login

Current founder preference: keep launch-at-login disabled and open Prometheus Companion manually from the Dock.

Use this only if Cruz decides to turn automatic startup back on later.

Install the user LaunchAgent:

```bash
./mac-companion/install-launch-agent.sh
```

This creates:

```text
~/Library/LaunchAgents/com.prometheus.os.companion.plist
~/Library/LaunchAgents/com.prometheus.os.staticserver.plist
~/Library/LaunchAgents/com.prometheus.os.ttsbackend.plist
```

It copies a clean local runtime to:

```text
~/Library/Application Support/PrometheusCompanion
```

Then it runs:

```text
~/Library/Application Support/PrometheusCompanion/start-prometheus-os.sh
```

This avoids macOS privacy blocks that can happen when a login agent tries to execute directly from the `Documents` folder.

The static server and premium TTS backend are installed as their own LaunchAgents so macOS can keep each local service independent.

To remove launch-at-login:

```bash
./mac-companion/uninstall-launch-agent.sh
```

## Premium TTS

Premium TTS is backend-only.

Do not place API keys in:

- frontend code
- Swift source
- Git
- README files
- browser localStorage

Use server-side environment variables for `prometheus-os/backend/server.js`.

Example:

```bash
export PROMETHEUS_TTS_PROVIDER=openai
export OPENAI_API_KEY="set-this-outside-git"
./mac-companion/start-prometheus-os.sh
```

If premium TTS is not configured, the companion uses the built-in macOS voice.

If Node is unavailable in the login environment, the premium TTS backend is skipped and macOS voice fallback still works.

For launch-at-login premium OpenAI voice, place the local-only key file here:

```text
/Users/cruzgarza/Library/Application Support/PrometheusCompanion/prometheus-os/backend/.env
```

Example:

```bash
OPENAI_API_KEY=your_real_openai_api_key_here
```

Never paste the key into Codex chat. Never commit it to GitHub. The companion installer preserves this installed `.env` during reinstall.

## Security Rules

- No API keys in this folder.
- No secrets committed to Git.
- No public deployment.
- No production Prometheus IQ behavior changes.
- No Anthony beta changes.
- Localhost only for startup services.
- If this is ever deployed online, protect it with Cloudflare Access or equivalent founder-only authentication.

## Wake Phrase Behavior

The companion listens through the Prometheus OS WebView while the Mac is awake and the app is running. Browser/WebView MediaRecorder captures short audio windows and sends them to the local backend STT endpoint.

Legacy native Swift STT capture is disabled by default so it cannot compete with the WebView/backend path. It can be enabled only for deliberate diagnostics by launching with:

```bash
PROMETHEUS_NATIVE_STT_FALLBACK=1 ./mac-companion/start-prometheus-os.sh
```

Do not enable that fallback during normal Founder Acceptance.

When it hears a wake phrase, it responds locally. Current built-in responses cover:

- morning greeting
- full OpenAI-backed conversation through the local `/api/assistant` backend
- premium OpenAI TTS response playback
- fallback macOS voice playback if premium TTS is unavailable

After Cruz says a wake phrase, Prometheus enters conversation mode. Follow-up questions can be spoken naturally without repeating the wake phrase every time.

Examples:

- `Good morning Prometheus`
- `What should I work on next?`
- `What is blocking the Anthony beta?`
- `Help me prepare for Chris and Dallas leadership.`
- `Prometheus, give me today's brief.`
- `Prometheus, what changed today?`
- `Prometheus, prepare GitHub backup.`
- `Prometheus, summarize Prometheus Companion progress.`

## Daily Chief Of Staff

Prometheus Companion can now act as Cruz's private Daily Chief of Staff.

It can brief:

- today's Prometheus status
- highest ROI task
- biggest company risk
- Anthony beta status
- Chris / leadership follow-up status
- website status
- GitHub / backup status
- Cloudflare status
- pilot readiness
- social media opportunity
- founder scorecard
- recommended next action

GitHub backup actions are preparation-only. Prometheus may draft the checklist and commit message, but commit and push still require explicit Cruz approval.

Future work can connect these responses to a private local agent layer, but any action that modifies GitHub, Cloudflare, production files, or Anthony beta must require explicit approval.
