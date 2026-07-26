# Route IQ Paid-Customer Onboarding Lifecycle v1

## Authority

Prometheus Administration owns the onboarding configuration, lifecycle state, preview contract,
and provisioning plan. Data, Intelligence, Dashboard, CRM, Infrastructure, and Security consume
the validated company and workspace identities within their own boundaries.

This contract prepares paid-customer infrastructure. It does not authorize a customer,
representative, provider, scheduler, collection path, cohort, recommendation influence, or CRM
production mutation.

## Configuration Boundary

Each configuration is identified by:

- immutable `companyId`
- immutable `workspaceId`
- immutable `configurationId`
- increasing `configurationRevision`
- exact `schemaVersion` and `contractVersion`
- Administration-owned provenance

Customer targeting has no inferred defaults. Included categories, exclusions, territory, ZIP
codes, travel limits, roles, schedules, goals, outcomes, terminology, metrics, freshness, and
verification rules must be explicit. Missing or contradictory targeting fails closed.

Terminology labels are presentation data. Stable metric IDs plus semantic versions preserve
historical reporting meaning when a label changes. Labels cannot contain markup, executable
templates, script schemes, control characters, or query-shaped payloads.

## Lifecycle

The allowed lifecycle is:

`DRAFT -> VALIDATED -> PREVIEW_READY -> AWAITING_APPROVAL -> PROVISIONING -> READY_FOR_ACTIVATION`

Failure and recovery paths are:

- `DRAFT -> VALIDATION_FAILED -> DRAFT`
- `PROVISIONING -> PROVISIONING_FAILED -> PROVISIONING`

Post-authorization states are:

- `READY_FOR_ACTIVATION -> ACTIVE`
- `READY_FOR_ACTIVATION -> SUSPENDED`
- `ACTIVE -> SUSPENDED`
- `SUSPENDED -> ACTIVE`
- `ACTIVE | SUSPENDED -> OFFBOARDED`

`OFFBOARDED` is terminal. An active state requires a separate activation authorization reference.
No transition function invents an approval or activation reference.

Failure states carry only a fixed safe failure code and a bounded recovery action. They do not
carry credentials, raw customer evidence, provider responses, or personal data.

## Preview

Preview is available only after validation. It shows the configured:

- company and workspace
- representative and manager terms
- metrics, goals, outcomes, and stages
- cities, ZIP codes, and travel limit
- inclusion and exclusion rules
- evidence freshness and fail-closed behavior

Preview always reports zero production mutations and keeps customer activation, collection,
cohorts, recommendation influence, provider refresh, and scheduling off.

## Idempotent Provisioning

The provisioning plan derives one deterministic idempotency key from the configuration identity
and canonical configuration content. Resource keys cover the company, workspace, territory,
roles, metrics, and CRM stages.

Applying the same plan again returns the existing registry unchanged. A changed fingerprint,
cross-company resource owner, cross-workspace resource owner, or conflicting receipt fails closed.
The registry records one append-only audit event for the first successful application.

Provisioning creates configuration resources only. It does not activate the customer or authorize
production CRM mutation.

## Suspension And Offboarding

Suspension denies operational access while preserving append-only evidence.

Offboarding denies customer access and preserves evidence under the configured retention and legal
hold boundary. Disposition remains a separate append-only Data-owned action. Onboarding code never
silently deletes or rewrites historical records.

## Synthetic Proof

`route-iq-paid-customer-synthetic-fixtures-v1.json` contains unrelated synthetic security-services
and commercial-distribution configurations. They prove reusable contracts without a customer-
specific code fork. They are not customers and are not authorized for production use.
