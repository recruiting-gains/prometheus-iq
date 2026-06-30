# Prometheus Reasoning Engine Report

Date: 2026-06-24

## Mission

Replace Prometheus Companion's founder-question path so it reasons from memory and context instead of opening cards or reading module text.

## Root Cause

The memory system, timeline, knowledge graph, and founder context already existed, but the conversation path could still fall through to older status-card, node, and tool responses. There were two bypasses:

1. The provider-level path could route founder questions to older tools before the Cognitive Engine answered.
2. The Prometheus OS screen-level command handler could match a visible node/card and speak that node before the AI provider ever received the question.

That meant some founder questions were answered as module/card output instead of one synthesized Chief-of-Staff answer.

## What Changed

- Added a reasoning-first retrieval boundary.
- Added safe project-context search.
- Added knowledge search for entities, relationships, and dependencies.
- Added reusable conversation state.
- Expanded cognitive routing for pilot readiness, leadership, website, GitHub, Cloudflare, and similar company-state questions.
- Moved provider-level tool routing behind the Cognitive Engine for informational founder questions.
- Moved screen-level node/card routing behind the Cognitive Engine for informational founder questions.
- Rewrote Anthony, pilot, website, GitHub, Cloudflare, and general responses to synthesize meaning instead of reading profile/card text.
- Added a reasoning acceptance test.

## Files Created

- `prometheus-os/retrieval-engine.js`
- `prometheus-os/context-search.js`
- `prometheus-os/knowledge-search.js`
- `prometheus-os/conversation-state.js`
- `prometheus-os/docs/reasoning-engine-v1.md`
- `scripts/verify-prometheus-reasoning-engine.mjs`

## Files Updated

- `prometheus-os/app.js`
- `prometheus-os/ai-provider.js`
- `prometheus-os/cognitive-engine.js`
- `prometheus-os/context-resolver.js`
- `prometheus-os/memory-ranking.js`
- `prometheus-os/reasoning-engine.js`
- `prometheus-os/README.md`

## Security

No secrets are read, printed, committed, or exposed. The context search blocks secret-oriented queries and the Cognitive Engine remains local-only.

## Verification Results

Passed:

```bash
node scripts/verify-prometheus-reasoning-engine.mjs
node scripts/verify-prometheus-cognitive-engine.mjs
node scripts/verify-prometheus-os-routing.mjs
npm test
```

Reasoning acceptance passed for:

- What happened yesterday?
- What happened this week?
- What about Anthony?
- What about Chris?
- Why is Google Places blocked?
- What should I do next?
- What is my biggest risk?

The in-app browser crashed while loading the full Prometheus OS visual scene during manual verification, so full visual Companion verification was not completed inside that browser surface. Code-level verification confirms the screen command handler now bypasses node/card routing for Cognitive Engine questions. Final native Companion voice verification should still be performed by Cruz from the local Companion app.

Passing behavior expected in Companion: Prometheus answers naturally from memory and does not open/read cards for founder reasoning questions.

## Real Companion Routing Fix - 2026-06-24

After real-world Companion testing, Cruz confirmed the actual UI still failed for:

```text
Prometheus, what happened yesterday?
```

Actual result: Prometheus read the Project Context card.

### Exact Cause

The failing path was not the isolated Cognitive Engine. The failure was in the live Companion command execution path:

1. `mac-companion/PrometheusCompanion.swift` forwards recognized speech into the WebView with `window.prometheusOSSubmitCommand(...)`.
2. `prometheus-os/app.js` receives that command in `submitCommand(...)`.
3. If the screen handler did not force a Cognitive Engine route early enough, the command could reach `prometheus-os/ai-provider.js`.
4. `AIProvider.localAnswer(...)` still had a final fallback that returned:

```js
title: "Project context"
```

That fallback is what produced the Project Context response in the real UI.

### What Changed

- Added `prometheus-os/companion-command-router.js` as the single routing boundary for the Companion UI path.
- Updated `prometheus-os/app.js::submitCommand(...)` to use that router before any card/node behavior.
- Updated `prometheus-os/ai-provider.js::ask(...)` so Cognitive Engine questions run before clarification, tool routing, status routing, or Project Context fallback.
- Added a second Cognitive Engine guard inside `AIProvider.localAnswer(...)` so direct provider calls cannot fall through to Project Context for reasoning questions.
- Preserved explicit card/node behavior only for commands such as:
  - `open voice settings`
  - `display website status`
  - `show pilot readiness card`

### UI-Path Acceptance Harness

Created:

```bash
scripts/verify-prometheus-companion-ui-path.mjs
```

This test exercises the same JavaScript command path used by the Companion bridge:

```text
Companion speech/text command
-> resolveCompanionCommandRoute(...)
-> AIProvider.ask(...)
-> Cognitive Engine response
```

It fails if a reasoning question routes to a node/card or if the answer contains Project Context, Founder Notes, dashboard card, status card, module text, or opening-card language.

### Acceptance Results

Passed:

```bash
node scripts/verify-prometheus-companion-ui-path.mjs
node scripts/verify-prometheus-reasoning-engine.mjs
node scripts/verify-prometheus-cognitive-engine.mjs
node scripts/verify-prometheus-os-routing.mjs
npm test
```

Companion UI-path harness passed for:

- `Prometheus, what happened yesterday?`
- `what happened yesterday`
- `Prometheus what happened yesterday`
- `Hey Prometheus, what happened yesterday`
- `Prometheus, what changed this week?`
- `Prometheus, what should I do next?`
- `Prometheus, what about Anthony?`
- `Prometheus, what about Chris?`
- `Prometheus, why is Google Places blocked?`
- `Prometheus, what is my biggest risk?`

Explicit node/card commands still passed for:

- `Prometheus, open voice settings`
- `Prometheus, display website status`
- `Prometheus, show pilot readiness card`

### Remaining Manual Verification

The actual native Companion interface still needs Cruz's live test after reopening Companion. The code path used by the WebView bridge is now covered by the UI-path harness, but Codex did not claim final native acceptance because the real macOS app UI was not manually operated after the patch in this verification pass.

Manual pass condition:

```text
Prometheus, what happened yesterday?
```

Prometheus should answer with a synthesized Chief-of-Staff recap and should not read Project Context, Founder Notes, or any dashboard card.

## Installed Companion Runtime Sync - June 24, 2026

### Root Cause Found After Real Companion Failure

The repository code had the reasoning-first routing fix, but the installed macOS Companion runtime was out of sync.

Installed runtime path:

```text
/Users/cruzgarza/Library/Application Support/PrometheusCompanion/prometheus-os/
```

The installed copy had stale versions of:

- `app.js`
- `ai-provider.js`

The installed copy was missing:

- `companion-command-router.js`
- `cognitive-engine.js`
- `reasoning-engine.js`
- `retrieval-engine.js`

Because the real Companion app loads from the installed Application Support path, Cruz's live test still used the old card/project-context behavior even though the repository version had been fixed.

### Fix Applied

Synced the repository Prometheus OS runtime into the installed Companion runtime path while excluding secrets, logs, and local environment files.

Added visible installed-build marker:

```text
Reasoning Engine v1 active
```

Added a temporary diagnostic for:

```text
Prometheus, what happened yesterday?
```

Expected diagnostic:

```text
Diagnostic: route selected cognitive_engine. Cognitive engine used: yes. Card fallback used: no.
```

### Installed Runtime Verification

Verified matching file hashes between repository and installed runtime for:

- `prometheus-os/app.js`
- `prometheus-os/ai-provider.js`
- `prometheus-os/companion-command-router.js`
- `prometheus-os/cognitive-engine.js`
- `prometheus-os/reasoning-engine.js`
- `prometheus-os/retrieval-engine.js`
- `prometheus-os/index.html`
- `prometheus-os/style.css`

Verified the installed local server serves:

```text
app.js?v=reasoning-engine-v1-runtime-20260624
```

Verified installed backend health:

- Local server: running on `127.0.0.1:8792`
- Premium TTS: configured
- Backend STT: configured
- Social media: manual fallback, because Meta setup is intentionally paused

### Installed Runtime Command Test

The installed runtime command path now routes:

```text
Prometheus, what happened yesterday?
```

to:

```text
route: cognitive
title: Yesterday recap
cognitive: true
cardFallback: false
readsProjectContext: false
```

### Remaining Manual Verification

Cruz still needs to perform the final live voice test inside the actual Companion UI.

Pass condition:

```text
Prometheus, what happened yesterday?
```

Prometheus must speak a synthesized Chief-of-Staff answer and include the temporary diagnostic showing cognitive engine used and card fallback not used.

## Native Companion Runtime Fix - June 24, 2026

### Additional Root Cause

After syncing the installed `prometheus-os` files, the native macOS app still had two runtime risks:

1. The Companion app started the local static server and backend as child `Process` instances but did not retain those `Process` objects. That allowed local services to exit after launch, leaving the WebView unable to reliably reach the current reasoning runtime.
2. The native speech fallback still contained direct card/node routing. If the WebView route failed, founder reasoning questions could fall back to card-style responses instead of failing safely.

### Fix Applied

Updated:

```text
mac-companion/PrometheusCompanion.swift
```

Changes:

- Retained local background `Process` objects and log handles for the static server and backend.
- Added termination logging for local services.
- Added native detection for founder reasoning questions.
- Prevented native fallback from answering founder reasoning questions with card/node responses.
- If the WebView route is unavailable for a founder reasoning question, Companion now reports that the reasoning engine could not be reached instead of reading a card.

### Installed App Update

Rebuilt:

```text
mac-companion/.build/PrometheusCompanion.app
```

Updated installed app:

```text
/Users/cruzgarza/Library/Application Support/PrometheusCompanion/PrometheusCompanion.app
```

Verified installed executable hash matches the rebuilt app executable.

### Service Persistence Verification

After restarting the installed Companion app:

- `127.0.0.1:8791` stayed listening for the Prometheus OS static server.
- `127.0.0.1:8792` stayed listening for the local backend.
- The installed runtime served the visible marker: `Reasoning Engine v1 active`.
- The installed runtime served the cache-busted app script: `app.js?v=reasoning-engine-v1-runtime-20260624`.

### Installed Command Path Verification

The installed runtime command path routes these founder reasoning questions to cognitive responses:

- `Prometheus, what happened yesterday?`
- `Prometheus, what happened this week?`
- `Prometheus, what should I do next?`
- `Prometheus, what about Anthony?`
- `Prometheus, what about Chris?`
- `Prometheus, why is Google Places blocked?`
- `Prometheus, what is my biggest risk?`

The installed command path returns:

```text
routeType: cognitive
cardFallback: false
```

for each tested founder reasoning question.

### Remaining Manual Companion Acceptance

Codex verified the installed files, installed executable, local services, and installed command path.

Final spoken acceptance still requires Cruz to test the actual microphone/WebView/native app loop by asking:

```text
Prometheus, what happened yesterday?
```

Expected live result:

- Prometheus gives a synthesized Chief-of-Staff answer.
- Prometheus does not read Project Context.
- Prometheus includes the temporary diagnostic:

```text
Diagnostic: route selected cognitive_engine. Cognitive engine used: yes. Card fallback used: no.
```
