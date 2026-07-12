# Discovery Mode Intelligence v2

Recorded: 2026-07-11

Related invention record: IP-001 - Route IQ Adaptive Representative Intelligence System

Related subsystem: Prometheus Intelligence Engine / Route IQ

Status: Technical invention evidence record. This document does not make patentability claims or state legal conclusions.

## Date Conceived

The controlled category-exploration expansion was documented on 2026-07-11 after Founder field testing showed that Discovery Mode repeatedly selected Automotive businesses while other qualified categories were passed. Whether an earlier founder conception artifact exists for this exact queue-composition mechanism requires Founder confirmation.

## Technical Problem Solved

A discovery route can remain technically valid and highly ranked while over-sampling one business category. That concentration limits what the system can learn about a representative, territory, time window, conversation quality, lead quality, conversion behavior, and objection patterns. A fixed category rotation would create a different problem: it could select weak or unavailable candidates without responding to evidence or territory supply.

The technical problem is composing a deterministic, quality-bounded exploration queue that prevents category lock-in, adapts to accumulated evidence, respects territory supply, and remains separate from proprietary production scoring until explicitly activated.

## Technical Solution

Discovery Mode Intelligence v2 introduces a governed, customer-workspace and representative-scoped category-composition policy. It:

1. Accepts candidates only after existing runtime eligibility and quality governance.
2. Preserves each candidate's existing recommendation score and scoring explanation as immutable inputs.
3. Maps source categories into governed exploration families without a fixed rotation.
4. Measures evidence maturity and coverage gaps by category, representative, territory, and time window.
5. Allocates queue positions through deterministic constrained selection, balancing quality rank with unresolved learning objectives.
6. Enforces configurable category concentration and consecutive-category limits when sufficient alternatives exist.
7. Relaxes composition constraints only through explicit, configured fallback rules and reports every relaxation.
8. Produces natural-language reasons describing quality, learning need, confidence, change, and next action without exposing scoring formulas or proprietary weights.
9. Emits an advisory plan only until a separate activation handoff authorizes production recommendation influence.

## System Impact

- Discovery Mode can test more than one category without discarding existing quality gates.
- Early success or activity in one category does not automatically make that category the only route lane.
- Sparse or unavailable territory evidence is reported rather than inferred.
- Category concentration becomes observable and testable before runtime activation.
- Customer workspace isolation and representative scope remain mandatory.
- Existing Dashboard behavior, Active Pool governance, route scoring weights, business-hours eligibility, and continuous replenishment remain unchanged during this phase.

## Computer Implementation

The architecture uses:

- A versioned configuration defining category families, quality floors, queue size, concentration limits, evidence thresholds, learning objectives, and relaxation rules.
- A deterministic category-normalization function with an explicit unknown-category fallback.
- Immutable candidate score snapshots supplied by the existing Route Intelligence path.
- Evidence-maturity projections derived from authorized, read-only Intelligence artifacts.
- A bounded selection loop that evaluates remaining category capacity and unresolved learning coverage at each queue position.
- Stable tie-breaking by quality rank, source order, and business identity.
- A composition report containing category counts, concentration, distinct-category coverage, unresolved objectives, relaxations, and per-stop explanations.
- Fail-closed validation for unknown workspaces, operating-profile mismatches, duplicate identities, and unauthorized recommendation influence.

## Workflow

```text
Governed eligible candidates + immutable quality snapshots
                         |
                         v
Authorized read-only learning snapshot
                         |
                         v
Normalize governed exploration categories
                         |
                         v
Calculate evidence maturity and coverage gaps
                         |
                         v
Select best eligible candidate within active constraints
                         |
                         v
Category cap met? ---- no ----> continue bounded composition
       |
      yes
       v
Try another qualified category
       |
       v
No qualified alternative? ----> apply configured relaxation and report it
                         |
                         v
Advisory queue plan + explanations + validation metrics
```

## Relationship To Existing Route IQ Invention

This behavior implements the previously documented exploration reserve and category-lock-in protections as a governed queue-composition process. It extends adaptive representative intelligence by using evidence maturity to decide what the system still needs to learn while keeping existing production scoring and runtime queue behavior unchanged until a future activation decision.

## Alternative Embodiments

- Concentration may be bounded by category family, individual category, parent industry, business type, commercial center, territory ring, or a combination.
- Queue composition may use hard constraints, soft penalties, constrained optimization, bandit exploration, or a hybrid policy, provided quality and isolation gates remain authoritative.
- Evidence maturity may be representative-specific, territory-specific, organization-approved, time-window-specific, or operating-profile-specific.
- Configuration may vary by customer workspace, operating profile, route length, territory density, shift stage, or available candidate supply.
- Constraint relaxation may shorten the queue, admit a higher concentration with disclosure, expand an authorized territory ring, or use governed Full Pool fallback.
- The advisory plan may later be consumed by an on-device queue, server-side planner, or hybrid route service after explicit activation and regression approval.

## Supporting Diagrams

The workflow diagram in this record is the initial supporting diagram. Source contracts, configuration, deterministic regression results, and advisory output artifacts should be linked after implementation.

## Supporting Screenshots

No new interface is implemented in this phase. If production activation is later authorized, screenshots showing category-balanced Discovery Mode recommendations and their explanations should be preserved after authenticated field verification.

## Preservation Decision

- Document under the existing IP-001 Route IQ evidence history as a dated implementation expansion.
- Preserve proprietary scoring weights, utility calculations, and production ranking details as confidential implementation information.
- Present this record to patent counsel for advice on whether any future filing review is appropriate.

No conclusion about patentability is made in this record.
