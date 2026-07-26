# Route IQ Paid-Customer Data Foundation v1

Prometheus Data owns this versioned boundary for verified-business evidence and
company/workspace-scoped downstream records.

## Admission boundary

Evidence cannot authorize itself. The normalizer requires a separately supplied
eligibility policy and an authorized immutable company/workspace scope. The policy
must explicitly provide territory and postal-code coverage, included and excluded
categories, excluded business identities, a freshness ceiling of no more than 24
hours, and minimum evidence quality.

The Data-owned projector accepts only a configuration that passes the final
Administration onboarding validator. It binds the immutable company/workspace,
configuration identity and revision, territory ZIP codes, targeting rules, and
freshness ceiling into the eligibility policy. Administration's explicit
`evidenceQualityRequired: true` rule maps to Data's minimum non-empty evidence
quality (`LOW`); false or missing quality requirements fail closed. Draft,
invalid, active, suspended, and offboarded configurations cannot be projected.
The caller must also supply an authorized company/workspace scope that exactly
matches the validated configuration.

Infrastructure handoffs are validated independently by Data without importing an
Infrastructure implementation. The exact contract identity, scope, territory,
targeting rules, evidence versions, and dark safety state must match the projected
policy. Cross-scope, malformed, contradictory, provider-enabled, scheduled,
activating, or production-mutating handoffs are rejected.

An immediate route-eligible record requires:

- verified identity, physical address, category, and source;
- an authorized territory and postal code;
- a current open operating status and current verified-open hours;
- successful source retrieval;
- unique or canonically resolved identity;
- customer inclusion with no exclusion;
- a verified target-profile match;
- a governed recommendation reason and sufficient evidence quality.

Missing, stale, closed, conflicting, provider-failed, excluded, duplicated, or
out-of-territory evidence remains ineligible. No fallback business, guessed hours,
or implicit policy default is admitted.

## Isolation and persistence

Storage and audit keys include immutable company and workspace identities.
Callers must present an authorization scope that exactly matches the requested
scope before a read or write occurs. The store exposes no unscoped enumeration
method. Audit records are append-only, bound to the stored payload hash, and
contain fixed reason codes rather than provider response bodies.

The fixtures are synthetic, unrelated-industry contract examples. They are not
production businesses, provider output, customer data, or authorization to move
any quarantined record. This package activates no provider and changes no Active,
Reserve, or Quarantine pool.
