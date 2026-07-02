# Dashboard CustomerGraphSnapshot Consumer Plan

Status: planning only.

This plan defines how Prometheus Dashboard should eventually consume read-only `CustomerGraphSnapshot` payloads after a future authorized handoff. It does not implement runtime consumption, change Dashboard behavior, change scoring, change Active Pool behavior, or modify CRM, Mobile, Website, Companion, Infrastructure, or Intelligence Engine.

## Source Contracts

Dashboard must rely only on Intelligence-owned contracts:

- `CustomerGraphSnapshot`
- `CustomerGraphQueryRequest`
- `CustomerGraphQueryResult`
- `DashboardCustomerGraphQueryContract`
- `intelligence/contracts/customer-intelligence-graph-contracts.json`

Dashboard must not create a parallel snapshot format, duplicate graph vocabulary, infer graph relationships from Dashboard state, or activate confidence propagation.

Dashboard may plan future displays for the Intelligence-owned snapshot content keys only:

- `businesses`
- `visits`
- `outcomes`
- `leads`
- `opportunities`
- `rep_activity`
- `manager_activity`
- `territories`
- `opportunity_relationships`
- `evidence_history`
- `confidence`
- `operating_profile`
- `learning_provenance`

## Future Dashboard Surfaces

Customer Intelligence Overview should summarize customer-scoped businesses, territories, opportunities, confidence, operating profile context, and provenance.

Territory History should show territory evolution, repeated visits, inactive areas, opportunity relationships, and evidence history.

Visit Outcome Patterns should show read-only patterns across visits, outcomes, leads, follow-ups, repeated behavior, and successful evidence.

Rep Activity Relationships should connect reps, visits, territories, outcomes, and learning provenance without changing assignments or CRM.

Opportunity Clusters should group related businesses and opportunities by nearby, similar, recommended, converted, and successful relationships while preserving route scoring.

Confidence Provenance Summaries should show confidence band, evidence counts, source evidence, learned-at range, generatedBy, generatedAt, and human override state without activating propagation.

Operating Profile Insights should show industry/profile context from snapshot operating profile data instead of hardcoded vocabulary.

## Read-Only Display Policies

Dashboard must display snapshot data as historical/read-only intelligence. Snapshot displays must never mutate Dashboard runtime state, CRM records, Active Pool records, route scoring, recommendations, assignments, or operating-profile definitions.

Confidence must be explanation/provenance only until Intelligence explicitly authorizes active propagation. Stale, missing, rejected, or cross-customer snapshot data must render as unavailable rather than synthesized replacement facts.

Sensitive source evidence should be hidden or summarized when the active role does not need full provenance. Human override state and review state must remain visible anywhere graph-derived conclusions are presented.

## Customer/Tenant Isolation

Every future query must include the active `customerId`, and every rendered node or relationship must match that customer. Cached snapshots must be partitioned by `customerId`, `operatingProfileId`, `snapshotVersion`, and `contractVersion`.

Dashboard must not render cross-customer rollups, comparisons, or clusters from raw `CustomerGraphSnapshot` data. If tenant context is missing or ambiguous, Dashboard must render no graph data and show an unavailable state.

Rep-facing views must remain scoped to authorized customer and role context even when Founder/Owner summaries exist.

## Explainability Requirements

Every future snapshot surface must answer:

- why the insight is shown
- what evidence supports it
- how confident the system is
- what changed
- what should happen next

Dashboard must display source evidence counts, learned-at range, generatedBy, generatedAt, confidence band, and review/human override state where applicable.

Dashboard must distinguish verified evidence, reviewable evidence, stale evidence, missing evidence, and unavailable evidence. Explanations must not expose proprietary scoring weights or imply that read-only snapshot confidence changed live recommendations.

Operating profile insights must name the active `operatingProfileId` and avoid hardcoded industry vocabulary when snapshot profile context exists.

## Activation Gates

Future runtime consumption is blocked until:

- Intelligence authorizes `DashboardCustomerGraphQueryContract.runtimeConsumptionAuthorized=true`.
- Dashboard receives `CustomerGraphSnapshot` payloads with `readOnly=true`, `queryIndex.readOnly=true`, and matching `contractVersion`.
- A tenant context contract defines active customer identity and role-scoped visibility.
- Role-based provenance display policy is approved.
- Dashboard adds runtime tests for customer isolation, read-only rendering, provenance display, confidence display, stale snapshot fallback, and route-scoring non-regression.
- Production release gates pass before any snapshot surface becomes visible.

## Non-Goals

- No runtime snapshot consumption in this task.
- No Dashboard UI changes in this task.
- No scoring or recommendation changes.
- No Active Pool changes.
- No CRM, Mobile, Website, Companion, Infrastructure, or Intelligence Engine changes.
- No duplicate graph or snapshot architecture.
