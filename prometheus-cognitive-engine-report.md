# Prometheus Cognitive Engine Report

Date: 2026-06-24

## Mission

Build Prometheus Cognitive Engine v1 so Prometheus Companion answers from company understanding instead of behaving like a command-driven dashboard reader.

## Root Cause

Prometheus Companion already had strong command routing, daily brief modules, memory files, and company status cards, but the answer path still favored direct command-to-tool routing. That meant a broad founder question could resolve to one card or one tool instead of retrieving context across company memory, timeline events, knowledge graph, reports, and decision state.

The architectural issue was not missing data. The issue was that memory retrieval and reasoning were not sitting above the command layer.

## What Changed

Created a Cognitive Engine layer for safe local reasoning:

- `prometheus-os/cognitive-engine.js` coordinates the cognitive answer flow.
- `prometheus-os/memory-retrieval.js` builds a safe memory corpus and retrieves relevant context.
- `prometheus-os/reasoning-engine.js` synthesizes one founder-level answer.
- `prometheus-os/conversation-manager.js` tracks short session context and follow-up state.
- `prometheus-os/context-resolver.js` resolves intents, entities, and follow-up questions.
- `prometheus-os/memory-ranking.js` ranks memories by recency, business impact, pilot impact, founder relevance, conversation relevance, and status.
- `scripts/verify-prometheus-cognitive-engine.mjs` verifies the required cognitive questions and follow-up behavior.
- `prometheus-os/ai-provider.js` now checks the Cognitive Engine before falling back to older card/tool routing for natural founder questions.
- `prometheus-os/README.md` now documents Cognitive Engine v1.

## Architecture

Current cognitive path:

```text
spoken or typed question
-> AIProvider
-> clarification and safety checks
-> Cognitive Engine eligibility
-> context resolver
-> memory retrieval
-> memory ranking
-> reasoning engine
-> natural Chief of Staff answer
-> existing TTS/playback layer
```

Operational commands still route through the existing permissioned command system. The Cognitive Engine is for reasoning, synthesis, and company memory, not for performing destructive or external actions.

## Memory Sources

The engine safely uses:

- company timeline events
- daily progress and end-of-shift summaries
- Prometheus Operating System documents
- Companion reports
- knowledge graph entities and relationships
- dependency map
- decision tasks and priority scores
- safe local company status data

It does not read:

- `.env`
- secrets
- API keys
- tokens
- credentials
- private live Meta or Google data

## Verification Results

Passed:

```bash
node scripts/verify-prometheus-cognitive-engine.mjs
node scripts/verify-prometheus-os-routing.mjs
npm run security:check
node --check prometheus-os/reasoning-engine.js
node --check prometheus-os/memory-ranking.js
```

Verified cognitive questions:

- `Prometheus, what happened yesterday?`
- `Prometheus, what happened this week?`
- `Prometheus, what changed today?`
- `Prometheus, what about Anthony?`
- `Prometheus, what about Chris?`
- `Prometheus, why is Google Places blocked?`
- `Prometheus, what is my biggest blocker?`
- `Prometheus, what should I do next?`
- `Prometheus, what should I focus on this week?`
- `Prometheus, what is the highest ROI task?`
- `Why?`

The tests confirm the engine returns cognitive answers, maintains follow-up context, and avoids dashboard-reader phrases such as `opening`, `status card`, and `dashboard card`.

## Safety Review

No deployment was performed.
No commit was performed.
No push was performed.
No files were deleted.
Anthony beta was not modified intentionally.
Production Prometheus IQ was not modified intentionally.
Public website behavior was not modified intentionally.
Meta and Google API integrations were not attempted.
Secrets were not printed.
Security scan passed.

## Remaining Work

1. Connect the Cognitive Engine more deeply to live session logs once Cruz approves a local-only storage format.
2. Add richer source attribution for internal memory answers without making responses sound like documentation.
3. Add a memory freshness check so Prometheus can warn when daily progress logs have not been updated.
4. Add UI debug visibility for cognitive mode in a hidden developer panel only.
5. Add optional voice test coverage once the Companion speech stack is stable enough for repeatable local automation.

## Highest ROI Next Task

The next highest ROI task is not another visual upgrade. It is getting real external beta feedback into the memory system so Prometheus can reason from actual field validation, not only internal build history.

## Repository Status

Safe to commit: yes, after Cruz reviews the changed files.

Recommended commit message:

```text
feat: add Prometheus Cognitive Engine v1
```
