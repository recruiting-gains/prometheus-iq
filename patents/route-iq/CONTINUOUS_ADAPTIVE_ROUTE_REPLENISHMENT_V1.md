# Continuous Adaptive Route Replenishment v1

Recorded: 2026-07-11

Related invention record: IP-001 - Route IQ Adaptive Representative Intelligence System

Related subsystem: Prometheus Intelligence Engine / Route IQ

Status: Technical invention evidence record. This document does not make patentability claims or state legal conclusions.

## Date Conceived

The continuous adaptive route replenishment implementation expansion was documented on 2026-07-11. Whether an earlier founder conception artifact exists for this specific queue-maintenance behavior requires Founder confirmation.

## Technical Problem Solved

Route IQ can rank an initial set of locations and can recalculate recommendations after field outcomes, but a static route list can become depleted during field execution. Requiring the representative to rebuild, refresh, or restart the route interrupts field work and delays incorporation of the newest evidence.

The technical problem is maintaining a bounded, actionable route queue while preserving recommendation quality, representative and workspace isolation, deterministic ordering, completed-stop history, and the existing Active Pool and Full Pool governance boundaries.

## Technical Solution

Continuous Adaptive Route Replenishment introduces a customer-workspace and representative-scoped active route queue. A completed visit is treated as an evidence event that causes the system to:

1. Persist the visit outcome before recommendation regeneration.
2. Update representative, territory, business, category, time-window, follow-up, objection, closing, and historical outcome summaries from the latest available evidence.
3. Remove the completed location from the active queue and preserve the remaining order.
4. Recalculate eligible candidate intelligence through the existing Route Intelligence scoring and explanation contracts.
5. Select the highest-quality eligible replacement that is not active, completed during the current route, invalid, duplicated, quarantined, or outside the current workspace.
6. Append the replacement to the queue without requiring a route rebuild or application restart.
7. Enter an explicit exhausted-pool state when no eligible location remains.

The queue target is 15 active recommendations. Outcome logging triggers immediate maintenance toward that target. A configurable low-water threshold of fewer than 5 active stops also triggers bounded recovery if a persisted queue is found below the threshold.

## System Impact

- Outcome-driven recommendation regeneration becomes part of the normal field-result lifecycle.
- Representative-specific intelligence is refreshed before a replacement is selected.
- Territory and category learning can affect the next eligible recommendation while the route is in progress.
- The active queue persists across separate browser runtime operations on the same workspace and device.
- Existing recommendation explanations remain attached to live queue entries through current Route Intelligence analysis.
- Active Pool candidates remain primary; Full Pool candidates are considered only through the existing governed fallback boundary.
- Unknown workspaces fail closed and cannot create or consume a route queue.

## Computer Implementation

The implementation uses:

- A versioned queue state keyed by workspace, representative, local route date, and operating profile.
- Stable business identity keys based on Google Place ID, with a normalized name-and-address fallback.
- A single-flight replenishment lock so concurrent completion events cannot start overlapping queue mutations.
- Bounded candidate scans and a fixed queue capacity to prevent infinite request or generation loops.
- A persisted completion set derived from visit evidence, not from transient UI state.
- Deterministic candidate tie-breaking and append-only replacement behavior to protect route order.
- Separate Active Pool and Full Pool candidate sources with explicit source provenance on each queue entry.
- A read-only status projection for Dashboard and Mobile rendering.

## Workflow

```text
Representative logs result
          |
          v
Persist visit evidence
          |
          v
Refresh scoped intelligence summaries
          |
          v
Remove completed stop and preserve remaining order
          |
          v
Recalculate eligible candidates with latest evidence
          |
          v
Active Pool candidate available? -- yes --> append best eligible stop
          |
          no
          v
Governed Full Pool fallback available? -- yes --> append best eligible stop
          |
          no
          v
Show exhausted-pool state
```

## Relationship To Existing Route IQ Invention

This behavior extends the documented adaptive representative intelligence loop by applying newly persisted field evidence before maintaining the representative's next-action queue. It connects outcome-driven regeneration, representative intelligence, territory learning, continuous queue maintenance, and real-time evidence incorporation in one bounded runtime workflow.

## Alternative Embodiments

- Replenishment may occur entirely on-device, through a server-coordinated queue, or through a hybrid offline-first model.
- The queue target and low-water threshold may vary by operating profile, territory density, shift length, or customer policy.
- Candidate regeneration may append one stop per outcome or fill the queue in a bounded batch.
- Route context may use straight-line distance, road-network travel time, scheduled commitments, traffic, or cluster membership when those sources are available.
- Durable queue coordination may use optimistic version checks, compare-and-swap storage, a per-route durable object, or another customer-scoped concurrency mechanism.
- Evidence summaries may remain local to one representative or be combined with manager-approved organization evidence while preserving customer isolation.

## Supporting Diagrams

The workflow diagram in this record is the initial supporting diagram. Source-level queue and evidence contracts, automated regression results, deployment records, and production verification artifacts should be linked after implementation.

## Supporting Screenshots

Production mobile screenshots showing a completed stop, updated progress, replacement recommendation, and exhausted-pool state should be preserved after authenticated production verification when available.

## Preservation Decision

- Document under the existing Route IQ provisional evidence record as a dated implementation expansion.
- Preserve proprietary scoring weights and internal ranking details as confidential implementation information.
- Present this record to patent counsel for advice on whether any future continuation, continuation-in-part, divisional, or other filing review is appropriate.

No conclusion about patentability is made in this record.
