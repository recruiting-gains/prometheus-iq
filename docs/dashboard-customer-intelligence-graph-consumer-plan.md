# Dashboard Customer Intelligence Graph Consumer Plan

Status: planning only.

This plan defines how Prometheus Dashboard should eventually consume Customer Intelligence Graph outputs after a future authorized handoff. It does not implement runtime graph consumption, change Dashboard behavior, change production scoring, change Active Pool behavior, or touch Companion, CRM, Mobile, Website, Infrastructure, or Intelligence Engine.

## Source Contracts

Dashboard must consume only the Intelligence-owned graph contracts:

- `intelligence/contracts/customer-intelligence-graph-contracts.json`
- `DashboardCustomerGraphContract`
- `CustomerGraphSnapshot`

Dashboard must not create a parallel graph engine, duplicate relationship vocabulary, or infer graph relationships from Dashboard state.

## Dashboard Surfaces

Future graph-derived insights fit these existing Dashboard surfaces:

- Founder Insights: executive summaries of relationship movement, opportunity clusters, confidence movement, and rep activity patterns.
- Owner Territory Intelligence: territory relationship map for nearby/similar businesses, repeated outcomes, inactive areas, and territory coverage.
- Places: business relationship context, previous visits, follow-up state, similar businesses, and nearby opportunity context.
- Route Intelligence: read-only explanation context for why businesses relate to route opportunities, without changing route scoring.
- Rep Today: prior-visit context, outstanding follow-ups, nearby related businesses, and recent outcome patterns.
- Find/Search: graph-aware filters for clusters, similar businesses, follow-up opportunities, and relationship-backed search results.

## Future Views

`territory_relationships`: Territory relationships should show how `Territory`, `Business`, `Rep`, and `Customer` nodes connect through `Nearby`, `Similar`, `Recommended`, and `Inactive` relationships.

`business_relationships`: Business relationships should show how businesses connect to visits, leads, outcomes, follow-ups, nearby businesses, and similar businesses.

`visit_outcome_history`: Visit/outcome history should show reviewed `Visit`, `Outcome`, `Lead`, and `Learning Signal` chains with source evidence and review state.

`rep_activity_patterns`: Rep activity patterns should summarize repeated visits, successful outcomes, inactive areas, and territory behavior without mutating CRM or crossing customer boundaries.

`opportunity_clusters`: Opportunity clusters should group related businesses by territory, operating profile, nearby/similar relationships, and successful evidence while preserving existing route scoring.

`confidence_propagation`: Confidence propagation should remain explanation-only until Intelligence explicitly authorizes active propagation. Dashboard may later display confidence movement, but must not activate propagation or alter recommendations.

## Activation Gates

Future runtime consumption is blocked until:

- Intelligence exposes `DashboardCustomerGraphContract.runtimeConsumptionAuthorized=true`.
- Dashboard receives a customer-scoped `CustomerGraphSnapshot` with the expected contract version.
- Every rendered node and relationship carries the active `customerId`.
- Evidence display rules define how source evidence and review state appear to Founder, Owner, and Rep users.
- Dashboard regression coverage exists for customer isolation, relationship rendering, confidence display, route-scoring non-regression, and fallback behavior.

## Non-Goals

- No runtime graph consumption in this task.
- No Dashboard UI changes in this task.
- No route scoring changes.
- No Active Pool changes.
- No CRM mutations or CRM model changes.
- No Mobile, Website, Infrastructure, or Companion work.
- No duplicate graph architecture.
