# Route IQ Workspace Configuration v2

Administration owns admission of companies, workspaces, named users, roles, capabilities, territories, and configuration versions. Data owns business facts and provider evidence. Intelligence owns route eligibility and ranking. Dashboard owns reusable rendering. Infrastructure owns authenticated enforcement and runtime delivery.

Each territory carries versioned US ZIP coverage bound explicitly to its workspace, company, and territory. Coverage accepts one or more five-digit ZIP codes, rejects duplicate or cross-owner assignments, and can be added, removed, or reassigned by changing validated configuration only. Runtime consumers must use the governed ZIP authorization projection and fail closed when coverage is missing, invalid, inactive, or unauthorized.

The v2 registry proves two different industries without a customer-specific code fork:

- Fitness is recorded only as Founder field research. It is not a customer, partner, sponsor, or committed pilot.
- Northstar Field Supply is synthetic and noncanonical. It has no production admission and its Data-owned opportunity artifact remains pending.

The registry is intentionally dark:

- Collection is `OFF`.
- Active cohorts are `0`.
- Recommendation influence is `OFF`.
- Cruz is the only attended Founder identity.
- Cruz's exact-principal mapping status and authorized workspace IDs are recorded once at the Founder boundary. Raw principal material remains outside Administration.
- Anthony is unmapped and has no admitted v2 user record.
- No external tester access is authorized.

## Admission Rules

Every configuration must pass the strict validator before any owner may consume it. Missing or invalid configuration, an unknown profile, a mismatched territory, a cross-company role, an unapproved source, or a demo/fallback catalog produces a fail-closed empty state.

A Data-owned manifest is referenced by exact registry path, manifest ID, workspace, operating profile, and artifact path. Administration does not copy business records or independently claim their approval state. The Fitness source remains pending Founder approval and stale in the current Data manifest. The synthetic outside-sales source is approved only for noncanonical validation. Neither source is production eligible.

The 24-hour freshness ceiling is a maximum. Only freshly verified open businesses or verified access windows may be immediately recommendation-eligible. Closed, stale, missing, invalid, appointment-unverified, or provider-failed availability is not an immediate recommendation.

## Validation

Run:

```sh
node scripts/route-iq-cross-industry-administration-verify.mjs
node --test tests/route-iq-cross-industry-administration.test.mjs
```

The validator and schema are versioned under `administration/contracts/`. Runtime owners must consume an immutable resolved projection and must not silently substitute embedded, demo, fallback, or another workspace's business catalog.

`route-iq-72-hour-onboarding-rehearsal-v1.json` is a separate, synthetic, nonproduction rehearsal. Tests replace the existing synthetic slot with that workspace so the exercise never exceeds the canonical two-company limit. It demonstrates terminology, roles, workspace-local users, Founder-boundary access, territories and ZIPs, card fields, actions, outcomes, KPIs, availability policy, retention, training, support, and incident metadata without adding a customer-specific application path.
