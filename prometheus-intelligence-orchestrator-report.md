# Prometheus Intelligence Orchestrator Report

Date: 2026-06-24

## Mission

Build Prometheus Intelligence Orchestrator v1 so Prometheus Companion answers founder questions from one central reasoning layer instead of separate cards, dashboard nodes, or module templates.

## Root Cause

The real Companion experience had two separate failure points:

1. The web Companion path could route broad founder questions through card/node or safe project-context behavior before the cognitive reasoning layer answered.
2. The installed macOS Companion runtime under `~/Library/Application Support/PrometheusCompanion/prometheus-os/` was stale compared with the repository and was missing the newer reasoning/orchestrator files.

This is why script-level fixes could pass while the real Companion still read the Project Context card.

## Architecture Change

Prometheus Companion now routes founder reasoning questions through:

Question -> Companion Router -> Intelligence Orchestrator -> Evidence Retrieval -> Evidence Ranking -> Context Builder -> Reasoning Pipeline -> Premium Voice Path

Cards and nodes remain available only for explicit card/node commands such as:

- "open voice settings"
- "display website status"
- "show pilot readiness card"

## Files Created

- `prometheus-os/intelligence-orchestrator.js`
- `prometheus-os/evidence-retriever.js`
- `prometheus-os/evidence-ranker.js`
- `prometheus-os/reasoning-pipeline.js`
- `prometheus-os/llm-context-builder.js`
- `prometheus-os/conversation-memory.js`

## Files Updated

- `prometheus-os/app.js`
- `prometheus-os/cognitive-engine.js`
- `prometheus-os/context-resolver.js`
- `prometheus-os/index.html`
- `mac-companion/PrometheusCompanion.swift`
- `scripts/verify-prometheus-companion-ui-path.mjs`

## Installed Runtime Sync

Repository runtime files were synced to:

`~/Library/Application Support/PrometheusCompanion/prometheus-os/`

The installed runtime now contains the same orchestrator files as the repository.

The installed Companion app was rebuilt and reinstalled to:

`~/Library/Application Support/PrometheusCompanion/PrometheusCompanion.app`

## Visible Build Marker

The running Companion UI now shows:

`INTELLIGENCE ORCHESTRATOR V1 ACTIVE`

This confirms the visible Companion screen is loading the orchestrator build.

## Verification Results

### Repository UI-Path Harness

Passed:

- "Prometheus, what happened yesterday?"
- "Prometheus, what happened this week?"
- "Prometheus, what major systems have been built?"
- "Prometheus, what changed in Prometheus over the last month?"
- "Prometheus, who is Anthony?"
- "Prometheus, why is Anthony important?"
- "Prometheus, what is the biggest risk to Prometheus today?"
- "Prometheus, what should I do next?"
- "Prometheus, if you were my COO, what would you tell me to do tomorrow?"
- "Prometheus, why is Google Places more important than Meta?"
- "Prometheus, how many businesses did Anthony visit today?"

All reasoning questions routed to:

`intelligence_orchestrator`

Explicit card commands still routed to cards only when explicitly requested.

### Installed Runtime Module Test

Passed:

- "Prometheus, what happened yesterday?" -> `intelligence_orchestrator`
- "Prometheus, what happened this week?" -> `intelligence_orchestrator`
- "Prometheus, what should I do next?" -> `intelligence_orchestrator`
- "Prometheus, how many businesses did Anthony visit today?" -> `intelligence_orchestrator`
- "Prometheus, show pilot readiness card" -> `node:pilot`

## Current Running App Status

Only the installed Companion process is currently running:

`~/Library/Application Support/PrometheusCompanion/PrometheusCompanion.app`

The local web runtime is serving:

`http://127.0.0.1:8791/prometheus-os/`

The local backend health check is passing on:

`http://127.0.0.1:8792/api/health`

Premium TTS configuration is present locally. Instagram API configuration remains intentionally incomplete and in manual fallback mode.

## Security Review

No `.env` files were staged or printed.

No API keys, tokens, or secrets were printed.

Secret scan found only environment variable names, placeholder examples, and source-code references to environment variables.

Sensitive values remain local-only.

## What Was Not Modified

- Anthony beta was not modified.
- Production Prometheus IQ was not modified.
- Public website behavior was not modified.
- No deployment was performed.
- No commit was made.
- No push was performed.

## Actual Companion UI Status

Computer Use confirmed the real Companion window displays:

`INTELLIGENCE ORCHESTRATOR V1 ACTIVE`

Because I cannot physically speak into Cruz's microphone from here, final spoken acceptance still requires Cruz to ask the live Companion:

`Prometheus, what happened yesterday?`

Pass condition:

Prometheus should answer with a synthesized company recap and should not read Project Context, Founder Notes, or a dashboard card.

## Safe To Commit

Yes, after Cruz confirms the real spoken Companion UI answers correctly.

## Recommended Commit Message

`feat: route Companion founder questions through intelligence orchestrator`

