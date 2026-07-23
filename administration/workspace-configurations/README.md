# Route IQ Workspace Configuration v2

Administration owns admission of companies, workspaces, named users, roles, capabilities, territories, and configuration versions. Data owns business facts and provider evidence. Intelligence owns route eligibility and ranking. Dashboard owns reusable rendering. Infrastructure owns authenticated enforcement and runtime delivery.

The v2 registry proves two different industries without a customer-specific code fork:

- Fitness is recorded only as Founder field research. It is not a customer, partner, sponsor, or committed pilot.
- Northstar Field Supply is synthetic and noncanonical. It has no production admission and its Data-owned opportunity artifact remains pending.

The registry is intentionally dark:

- Collection is `OFF`.
- Active cohorts are `0`.
- Recommendation influence is `OFF`.
- Cruz is the only attended Founder identity.
- Anthony is unmapped and has no admitted v2 user record.
- No external tester access is authorized.

## Admission Rules

Every configuration must pass the strict validator before any owner may consume it. Missing or invalid configuration, an unknown profile, a mismatched territory, a cross-company role, an unapproved source, or a demo/fallback catalog produces a fail-closed empty state.

An approved Data artifact is referenced by workspace and operating profile. Administration does not copy business records into configuration. Synthetic validation may name a pending Data-owned artifact, but it cannot become production eligible.

The 24-hour freshness ceiling is a maximum. Only freshly verified open businesses or verified access windows may be immediately recommendation-eligible. Closed, stale, missing, invalid, appointment-unverified, or provider-failed availability is not an immediate recommendation.

## Validation

Run:

```sh
node scripts/route-iq-cross-industry-administration-verify.mjs
node --test tests/route-iq-cross-industry-administration.test.mjs
```

The validator and schema are versioned under `administration/contracts/`. Runtime owners must consume an immutable resolved projection and must not silently substitute embedded, demo, fallback, or another workspace's business catalog.
