# Prometheus OS

Private founder-only AI operating system for Cruz and Prometheus.

This is not a customer feature, not a CRM, and not a public dashboard. It is a private living intelligence network.

## Local Preview

From the project root:

```bash
python3 -m http.server 8791
```

Open:

```text
http://127.0.0.1:8791/prometheus-os/
```

## Purpose

Prometheus OS is centered around one living Prometheus core.

The main screen shows:

- Prometheus as the central intelligence
- orbiting company-system nodes
- a small listening/active status
- detail panels only after a node is clicked

The main screen intentionally does not show:

- manual push-to-talk controls
- read/stop voice buttons
- audit logs
- admin panels
- large dashboard cards
- backend internals

Prometheus OS combines:

- Founder Operating System
- AI Assistant
- Agent Layer
- Voice Interface
- Company Intelligence
- Deployment Intelligence
- Beta Intelligence
- Prometheus Project Context

## Files

- `index.html` - private OS interface
- `style.css` - Jarvis / Palantir / Tesla inspired UI
- `app.js` - living-network controller, assistant wiring, orbit-node rendering, and voice settings
- `three-scene.js` - Three.js holographic globe, route lines, and intelligence nodes
- `voice-assistant.js` - browser speech recognition and text-to-speech wrapper
- `ai-provider.js` - local demo mode plus future OpenAI/Claude provider boundary
- `project-context.js` - safe project summaries and blocked source policy
- `agent-actions.js` - permissioned agent tool registry
- `audit-log.js` - local audit log for agent activity
- `demo-data.js` - safe local Prometheus status data

## Current Mode

Prometheus OS currently runs in **local demo mode**.

That means:

- No API keys are required.
- No secrets are stored in frontend code.
- No backend commands execute from the browser.
- Agent actions are permission-gated and logged.
- Future OpenAI, Claude, Node backend, and Cloudflare Worker integrations are architected but not connected.

## Daily Chief Of Staff

Prometheus OS now includes a private Daily Chief of Staff layer for Cruz.

Supported commands:

- `Prometheus, give me today's brief.`
- `Prometheus, what changed today?`
- `Prometheus, update the daily progress log.`
- `Prometheus, prepare GitHub backup.`
- `Prometheus, draft my commit message.`
- `Prometheus, what should I do next?`
- `Prometheus, summarize Prometheus Companion progress.`
- `Prometheus, what's the move?`
- `Prometheus, what matters right now?`
- `Prometheus, where are we at?`
- `Prometheus, give me the rundown.`
- `Prometheus, what did we finish?`
- `Prometheus, what should I tell Chris?`
- `Prometheus, capture Anthony beta feedback.`
- `Prometheus, draft an email to Chris.`
- `Prometheus, check Companion health.`
- `Prometheus, end of day debrief.`

Follow-up support:

- After a recommendation, Cruz can ask `Why that?`, `Explain`, `Break that down`, or `Tell me more`.
- Prometheus uses the previous answer as session memory and explains the reasoning from a founder-leverage perspective.

Short ambiguous commands:

- `Email`, `Chris`, `Anthony`, `Website`, `GitHub`, `Backup`, and `Pilot` ask a clarification question instead of guessing.
- Specific commands such as `Pilot readiness`, `Draft an email to Chris`, and `Prepare GitHub backup` route directly.

Daily brief covers:

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

Progress log location:

```text
PROMETHEUS OPERATING SYSTEM/09 Founder Operating System/Daily Progress Log.md
```

Prometheus may prepare a GitHub backup checklist or draft commit message, but it must not commit, push, deploy, modify Anthony beta, or modify production behavior without explicit Cruz approval.

## Chief Of Staff Intelligence

Prometheus now includes local-only founder support modules:

- Daily priority engine - ranks work by business impact, pilot value, revenue potential, risk reduction, founder energy, and urgency.
- Beta feedback assistant - classifies Anthony feedback as bug, UX issue, route quality issue, data issue, feature request, or training issue.
- Email drafting mode - drafts messages only; it does not connect Gmail or send email.
- Founder conversation mode - answers direct operating questions such as what matters, what to tell Chris, and why a recommendation matters.
- Reliability monitor - explains the health-check path for local server, backend, microphone, STT, router, TTS, playback, and listening resume.
- End-of-day debrief - summarizes changed, fixed, learned, blocked, safe-to-commit status, and tomorrow's highest ROI task.

## Permission System

Level 0 - Read Only:

- summaries
- project status
- reports

Level 1 - Safe Local Checks:

- git status
- tests
- builds
- file inspection

Level 2 - Prepare Actions:

- draft commit messages
- draft deployment plans
- draft Codex prompts
- draft reports

Level 3 - Approval Required:

- git commit
- git push
- Cloudflare deployment
- production file changes
- Anthony beta changes

Level 4 - Blocked:

- deleting files
- exposing secrets
- printing API keys
- disabling security
- changing auth systems
- modifying protected credentials

## Future Backend Architecture

When Prometheus OS becomes dynamic, add a private backend layer:

1. Local Node backend for founder machine operations.
2. Cloudflare Worker backend for protected online access.
3. Cloudflare Access in front of `/prometheus-os`.
4. Server-side only API keys and model provider calls.
5. Tool approval gate before any Level 3 action.
6. Audit logs stored server-side.

## Deployment Plan

Do not deploy this publicly yet.

If deployed later:

1. Require Cloudflare Access.
2. Use a hidden route such as `/prometheus-os`.
3. Keep `noindex,nofollow`.
4. Do not link from the public homepage.
5. Keep AI provider secrets server-side only.
6. Keep Anthony beta and production app modification tools approval-gated.
7. Run a security review before release.

## Voice Layer

Current local mode:

- Browser speech recognition when available.
- Browser text-to-speech when available.
- Always-listening mode after browser permission is enabled.
- Wake phrase support for "Prometheus", "Good morning Prometheus", and "Hey Prometheus".
- Optional clap detection wake signal through Web Audio API.
- Voice selection through the Voice Settings node.
- Automatic spoken responses when voice output is available.
- Premium voice provider selection with browser fallback.

Future premium voice options:

- OpenAI Realtime / TTS through a private backend only.
- Claude-compatible backend assistant routing if needed.
- ElevenLabs or similar premium voice through a private backend only.
- Cloudflare Worker or local Node backend for server-side secrets.

Security rule:

- No voice API keys, model keys, tokens, or secrets may be placed in frontend files.

## Local Premium Voice Backend

Backend files live in:

```text
prometheus-os/backend/
```

Start local backend:

```bash
node prometheus-os/backend/server.js
```

Endpoint:

```text
POST http://127.0.0.1:8792/api/tts
```

If OpenAI or ElevenLabs-style credentials are not configured through environment variables, Prometheus OS falls back to browser text-to-speech and shows:

```text
Premium voice not configured. Using browser voice fallback.
```

Do not commit real `.env` files. Use `prometheus-os/backend/env.example` as the template only.

OpenAI premium TTS uses `OPENAI_API_KEY` server-side only.

ElevenLabs premium TTS uses `ELEVENLABS_API_KEY` server-side only. Prometheus is configured to use the selected Mark voice through:

```bash
ELEVENLABS_VOICE_ID=1SM7GgM6IMuvQlz2BwM3
```

Use the local setup helper and paste the ElevenLabs key only into the secure popup:

```bash
./mac-companion/set-elevenlabs-key-local.sh
```

Create this local file when you are ready:

```text
/Users/cruzgarza/Documents/Prometheus/prometheus-os/backend/.env
```

Add only local environment values there:

```bash
OPENAI_API_KEY=your_real_openai_api_key_here
```

Do not paste the key into Codex chat, browser code, GitHub, README files, or screenshots.

If the Mac Companion LaunchAgent is running Prometheus OS, use this installed local config instead:

```text
/Users/cruzgarza/Library/Application Support/PrometheusCompanion/prometheus-os/backend/.env
```

Full backend setup and verification steps are in:

```text
prometheus-os/backend/README.md
```

## Voice Limitations

Browser voice systems vary by browser and operating system.

- Speech recognition may work in Chrome but not every browser.
- Voice selection depends on installed system/browser voices.
- Browser text-to-speech may sound different across devices.
- Browser may stop listening after silence and Prometheus OS will attempt to restart it.
- Browser may require a user gesture before microphone or audio playback.
- Browser may stop listening when the tab is inactive.
- Mobile browsers may suspend microphone access when locked or backgrounded.
- Premium voice requires a local/private backend with server-side environment variables.
