# Prometheus Administration

Purpose: make Administration the operational control center for Prometheus beta operations.

Administration owns operating procedures, beta records, company and workspace lifecycle, named-user admission, roles, capabilities, territories, documentation indexes, release operations, and founder administrative requirements. It does not own product engineering, business facts, runtime route logic, data refresh infrastructure, CRM automation, Companion behavior, external integrations, or deployment configuration.

## Operating Boundary

Administration may create and maintain:

- Beta tester registry and lifecycle status.
- NDA tracking references.
- Tester onboarding procedure.
- Device inventory records.
- Test session history.
- Tester permission model.
- Release notes and version history.
- Bug intake and feature request workflow.
- Positive feedback, workflow observations, route quality observations, and performance observations.
- Release verification, regression verification, subsystem routing, and tester sign-off records.
- Pilot company records.
- Versioned Route IQ workspace and company configuration admission.
- Approved named-user, role, capability, location, and territory configuration.
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
- `contracts/`: strict versioned Administration configuration contracts and validators.
- `workspace-configurations/`: admitted Founder-research and synthetic validation configurations.
- `workspace-configurations/route-iq-cross-industry-workspaces-v2.json`: canonical Route IQ workspace configuration registry.
- `contracts/route-iq-workspace-configuration-v2.schema.json`: canonical strict configuration schema.
- `contracts/route-iq-workspace-configuration-v2-validation.mjs`: canonical browser-safe validation and authorization rules.
- `contracts/route-iq-workspace-configuration-v2.mjs`: Node-only compatibility loader for repository tooling.

## Integration Contract Boundary

The versioned Route IQ workspace registry, schema, and pure validator are the canonical Administration admission boundary. Customer-specific operating-artifact contracts are not active configuration and must not be used as a fallback source.

Consumers must use the validated workspace, company, role, territory, capability, and approved-source projection. No workspace may consume another workspace's operating records, missing configuration fails closed, and fixture/demo operations data is prohibited in production.

## Private Beta Stabilization Intake

Private beta stabilization intake is Administration-owned. Engineering fixes are routed to the owning subsystem after intake classification.

The permanent intake path is:

1. Record tester, company, device, and session context.
2. Classify the issue or observation.
3. Route confirmed engineering work to the subsystem owner.
4. Record release and regression verification after subsystem handoff.
5. Capture tester sign-off before closing beta-impacting issues.

The unified issue record lives in `registers/stabilization-issues.json`. Observation records live in `registers/beta-observations.json`. Classification and routing rules live in `registers/intake-classification.json`.

## Required Gate

Run the Administration foundation validation before treating Administration changes as complete:

```bash
node scripts/validate-administration-foundation.mjs
node --test tests/administration-foundation.test.mjs
```

## Current Route IQ Truth

Route IQ is the only active Prometheus product. Fitness Connection is Founder field research, not a customer, partner, sponsor, or committed pilot. Cruz is the only attended Founder identity in the v2 configuration boundary. Anthony remains unmapped and has no current runtime access authorization. Collection is `OFF`, active cohorts are `0`, and recommendation influence is `OFF`.

This subsystem indexes and operationalizes those sources. It does not replace them and does not claim legal, deployment, or product status that has not been verified.
