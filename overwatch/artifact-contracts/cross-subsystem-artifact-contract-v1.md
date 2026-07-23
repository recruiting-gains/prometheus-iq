# Cross-Subsystem Artifact Contract v2

## Purpose

This contract is the Route IQ connection layer. It keeps reusable product code generic while binding every business record to one Administration-owned workspace configuration, one Data-owned manifest, and one governed provenance chain.

## Canonical Flow

1. Administration defines the workspace, company, profile, roles, users, territories, Dashboard fields, actions, KPIs, availability policy, and source bindings.
2. Data publishes one approved business manifest per workspace and owns normalized availability, freshness, provenance, pools, exclusions, and evidence retention.
3. Intelligence admits only manifest-bound records and determines immediate route eligibility from fresh verified availability.
4. Infrastructure projects canonical artifacts without changing admission, identity, freshness, or eligibility.
5. Dashboard renders the generic PWA from the authenticated session and the exact four runtime assets.
6. Overwatch verifies ownership, hashes, isolation, source/deploy parity, and release boundaries.

## Required Runtime Assets

- `workspaceConfiguration`
- `businessManifestRegistry`
- `businessRoster`
- `businessHours`

Missing, malformed, stale, cross-workspace, or hash-mismatched inputs fail closed. Production may never replace missing tenant data with embedded, demo, or cross-workspace records.

## Current Profiles

- `fitness_connection` / `fitness`: Founder field research only. It is not a customer, partner, sponsor, endorsement, or committed pilot.
- `northstar_outside_sales_synthetic` / `general_outside_sales`: deterministic nonproduction configuration proof.

Both profiles use the same Dashboard module, service worker, runtime asset contract, and Intelligence availability contract. A company name may not select application behavior.

## Availability Boundary

Freshness is capped at 24 hours. Only fresh verified-open records or verified current access windows may be an immediate stop. Verified closed, stale, unavailable, invalid, provider-failure, or unverified appointment records remain non-recommended.

Operating hours and estimated visit duration are independent fields and independent presentation states.

## Safety

- Collection: `OFF`
- Active cohorts: `0`
- Recommendation influence: `OFF`
- Anthony Founder mapping: `UNMAPPED`
- Production activation: separately Founder-gated
- External provider credentials and scheduler activation: separately Founder-gated

The machine-readable registry is `overwatch/artifact-contracts/canonical-artifact-registry.json`. The release-blocking verifier is `scripts/verify-cross-subsystem-artifact-contracts.mjs`.
