# Prometheus Disaster Recovery Plan

Purpose: preserve the minimum recovery facts needed to restore Prometheus after laptop loss, app corruption, or runtime drift.

## Current Certified Recovery Point

Date: June 24, 2026

Milestone: Prometheus Intelligence Orchestrator v1 routing integration.

Expected GitHub backup commit message:

```text
fix: complete Prometheus Intelligence Orchestrator routing integration
```

## Recovery Priority

1. Restore the GitHub repository.
2. Restore local `.env` files from Cruz's private secure storage, never from GitHub.
3. Rebuild Prometheus Companion from `mac-companion/`.
4. Sync the Prometheus OS runtime into:

```text
/Users/cruzgarza/Library/Application Support/PrometheusCompanion/prometheus-os/
```

5. Confirm the Companion UI shows the active Intelligence Orchestrator build marker.
6. Test:

```text
Prometheus, what happened yesterday?
```

Pass condition: synthesized Chief-of-Staff response, no dashboard card response.

## Security Rules

- Never commit `.env` files.
- Never print API keys or tokens.
- Never restore secrets from screenshots or chat messages.
- Verify Anthony beta and production Prometheus IQ are not changed unless intentionally included in a release.
