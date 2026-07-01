# Prometheus Administration

Purpose: make Administration the operational control center for Prometheus beta operations.

Administration owns operating procedures, beta records, pilot records, documentation indexes, release operations, and founder administrative requirements. It does not own product engineering, runtime route logic, data refresh infrastructure, CRM automation, Companion behavior, external integrations, or deployment configuration.

## Operating Boundary

Administration may create and maintain:

- Beta tester registry and lifecycle status.
- NDA tracking references.
- Tester onboarding procedure.
- Device inventory records.
- Tester permission model.
- Release notes and version history.
- Bug intake and feature request workflow.
- Pilot company records.
- Founder administrative dashboard requirements.
- Beta documentation and internal procedures.

Administration must not modify:

- Dashboard product source.
- Companion source or founder-only runtime behavior.
- CRM workflows or communications automation.
- Infrastructure, Cloudflare, Wrangler, GitHub, or security configuration.
- Integrations or third-party service connections.

## Foundation Files

- `architecture.md`: Administration architecture and scaling model.
- `operating-model.md`: beta operations cadence, control rules, and escalation model.
- `registers/`: machine-readable operational records.
- `workflows/`: reusable procedures for beta operations.
- `templates/`: reusable intake and operating templates.
- `schemas/`: lightweight register contract documentation.

## Required Gate

Run the Administration foundation validation before treating Administration changes as complete:

```bash
node scripts/validate-administration-foundation.mjs
node --test tests/administration-foundation.test.mjs
```

## Current Beta Truth

Prometheus IQ is in private beta. Anthony is the first production field tester. Existing beta evidence and release procedures remain in `docs/beta-sharing-plan.md`, `docs/pilot-support-system.md`, `docs/prometheus-release-checklist.md`, `docs/prometheus-pilot-execution-playbook.md`, and `legal/README.md`.

This subsystem indexes and operationalizes those sources. It does not replace them and does not claim legal, deployment, or product status that has not been verified.
