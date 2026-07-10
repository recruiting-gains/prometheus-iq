# Prometheus OS Local Voice Backend

Local-only backend for premium text-to-speech experiments.

Do not deploy this publicly until Prometheus OS is behind founder-only authentication such as Cloudflare Access.

## Start

From the project root:

```bash
node prometheus-os/backend/server.js
```

Open the frontend:

```text
http://127.0.0.1:8791/prometheus-os/
```

The frontend can call:

```text
POST http://127.0.0.1:8792/api/tts
POST http://127.0.0.1:8792/api/stt
POST http://127.0.0.1:8792/api/assistant
```

Request body:

```json
{
  "text": "Good morning Cruz. Prometheus is online.",
  "preferredVoice": "onyx",
  "provider": "openai"
}
```

## Security

- Never put API keys in frontend files.
- Never commit real `.env` files.
- Use environment variables only.
- Do not print secret values in logs.
- Keep this backend bound to `127.0.0.1` during local testing.
- If deployed later, require Cloudflare Access or equivalent founder-only auth.

## Providers

Supported placeholders:

- `browser` - frontend fallback, no backend call needed.
- `openai` - uses `OPENAI_API_KEY` server-side.
- `elevenlabs` - uses `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` server-side.

If a provider is not configured, `/api/tts` returns a safe fallback message and the frontend uses browser speech synthesis.

## Assistant Conversation Endpoint

The Mac Companion uses this local-only endpoint for full conversation:

```text
POST http://127.0.0.1:8792/api/assistant
```

Request:

```json
{
  "message": "What should I work on next?",
  "messages": [
    { "role": "user", "content": "Good morning Prometheus" },
    { "role": "assistant", "content": "Good morning Mr. Garza. Prometheus is online." }
  ]
}
```

Response:

```json
{
  "text": "Your highest leverage task is..."
}
```

The assistant uses `OPENAI_API_KEY` server-side only.

Optional model setting:

```bash
OPENAI_ASSISTANT_MODEL=gpt-4o-mini
OPENAI_STT_MODEL=gpt-4o-mini-transcribe
OPENAI_STT_LANGUAGE=en
```

## OpenAI Premium TTS Setup

Do not paste the API key into Codex chat.

Create an OpenAI API key in the OpenAI API dashboard:

```text
https://platform.openai.com/api-keys
```

Create this local-only file:

```text
/Users/cruzgarza/Documents/Prometheus/prometheus-os/backend/.env
```

Put the key there:

```bash
OPENAI_API_KEY=your_real_openai_api_key_here
```

Optional voice settings:

```bash
OPENAI_TTS_MODEL=gpt-4o-mini-tts
OPENAI_TTS_VOICE=onyx
OPENAI_ASSISTANT_MODEL=gpt-4o-mini
```

ElevenLabs premium voice settings for Mark:

```bash
ELEVENLABS_API_KEY=your_real_elevenlabs_api_key_here
ELEVENLABS_VOICE_ID=1SM7GgM6IMuvQlz2BwM3
ELEVENLABS_MODEL_ID=eleven_multilingual_v2
ELEVENLABS_STT_MODEL_ID=scribe_v2
ELEVENLABS_STT_LANGUAGE=en
```

Fast local setup helper:

```bash
./mac-companion/set-elevenlabs-key-local.sh
```

Paste the ElevenLabs API key only into the secure popup. Do not paste it into Codex chat, frontend code, GitHub, screenshots, or documents.

Restart the backend:

```bash
node prometheus-os/backend/server.js
```

Local verification command:

```bash
curl -s -o /tmp/prometheus-openai-tts.mp3 -w "%{http_code}\n" \
  -X POST http://127.0.0.1:8792/api/tts \
  -H 'Content-Type: application/json' \
  -d '{"text":"Good morning Cruz. Prometheus is online.","provider":"openai","preferredVoice":"onyx"}'
```

Expected result when configured correctly:

```text
200
```

Then play the test file:

```bash
afplay /tmp/prometheus-openai-tts.mp3
```

ElevenLabs Mark verification command:

```bash
curl -s -o /tmp/prometheus-elevenlabs-mark.mp3 -w "%{http_code}\n" \
  -X POST http://127.0.0.1:8792/api/tts \
  -H 'Content-Type: application/json' \
  -d '{"text":"Good morning Mr. Garza. Prometheus is online.","provider":"elevenlabs"}'
```

Expected result when configured correctly:

```text
200
```

Then play the test file:

```bash
afplay /tmp/prometheus-elevenlabs-mark.mp3
```

Assistant verification command:

```bash
curl -s -X POST http://127.0.0.1:8792/api/assistant \
  -H 'Content-Type: application/json' \
  -d '{"message":"What should I work on next for Route IQ?"}'
```

Expected result when the key is missing:

```text
409
{"error":"OpenAI premium voice is not configured."}
```

## ElevenLabs Speech-To-Text Setup

Prometheus OS can transcribe short local command windows through the backend:

```text
POST http://127.0.0.1:8792/api/stt
```

Provider behavior:

- `auto` tries ElevenLabs STT first.
- If ElevenLabs STT is unauthorized or unavailable, `auto` falls back to OpenAI STT when `OPENAI_API_KEY` is configured.
- ElevenLabs Mark remains the preferred text-to-speech voice.

Security rules:

- The browser sends audio only to the local backend.
- The ElevenLabs key stays in `.env`.
- No STT key is placed in frontend code.
- No transcripts or API keys are printed in logs.
- Keep this local-only until founder-only auth exists.

Manual STT verification after recording a short local audio file:

```bash
curl -s -X POST http://127.0.0.1:8792/api/stt \
  -H 'Content-Type: audio/webm' \
  -H 'X-Prometheus-STT-Provider: auto' \
  --data-binary @/tmp/prometheus-command.webm
```

Expected successful response:

```json
{
  "text": "Route IQ status",
  "provider": "elevenlabs",
  "language": "en"
}
```

That means the secure fallback path is working.

## Mac Companion Key Location

If you use the installed Mac Companion LaunchAgent, the runtime copy lives here:

```text
/Users/cruzgarza/Library/Application Support/PrometheusCompanion/prometheus-os/backend/.env
```

You may place the same local-only `.env` there for launch-at-login premium voice.

The installer preserves that installed `.env` if you reinstall the companion later.

## Final Safety Rules

- Create an OpenAI API key in the OpenAI API dashboard.
- Paste the key only into the local `.env` file.
- Never place the key in frontend code.
- Never commit the key to GitHub.
- Never paste the key into Codex chat.
- Restart the local Prometheus OS backend with `node prometheus-os/backend/server.js`.
- Verify premium voice is active.
- Verify fallback voice still works if the key is removed.
- Verify no secrets appear in logs or browser developer tools.
