# Nearby Context Intelligence v2

Recorded: 2026-07-12

Related invention record: IP-001 - Route IQ Adaptive Representative Intelligence System

Related subsystem: Prometheus Intelligence Engine / Route IQ

Status: Technical invention evidence record. This document does not make patentability claims or state legal conclusions.

## Date Conceived

The relationship-aware Nearby Context expansion was documented on 2026-07-12 after Founder field testing on 2026-07-11 showed repeated false-negative nearby results at Texans Auto Repair - Blackhawk and Christian Brothers Automotive Pearland. Whether an earlier founder conception artifact exists for this exact relationship-priority mechanism requires Founder confirmation.

## Technical Problem Solved

A fixed radial search over only the currently visible route candidates can report no nearby opportunities even when the representative is standing beside multiple storefronts. Straight-line distance alone does not express whether two businesses share a building, shopping center, commercial parcel, or parking area. Expanding the radius without governance can introduce closed, duplicate, completed, quarantined, cross-workspace, or low-confidence records.

The technical problem is producing an explainable, deterministic set of operationally visitable secondary opportunities around an arrival location while keeping existing route recommendation scoring, primary recommendation order, data ownership, and runtime eligibility controls authoritative.

## Technical Solution

Nearby Context Intelligence v2 introduces a customer-workspace-scoped, relationship-prioritized advisory projection. It:

1. Accepts a primary recommendation, governed Active Pool candidates, governed Full Pool fallback candidates, canonical business-hours decisions, completed-stop identities, and optional structured commercial-location relationships.
2. Applies workspace, operating-profile, pool, quarantine, identity, completion, coordinate, and canonical business-hours gates before relationship classification.
3. Classifies qualified candidates in the order same building, same shopping center, same commercial parcel, walkable, then nearby.
4. Treats adjacent-building and shared-parking evidence as explainable relationship signals without allowing them to bypass the required priority order.
5. Distinguishes verified structured relationships from deterministic geographic inference and reports confidence and provenance for each conclusion.
6. Uses Active Pool candidates first and activates governed Full Pool fallback only when Active Pool supply cannot fill the configured nearby-opportunity target.
7. Preserves canonical verified-open preference over uncertain-hours coverage and never admits a verified-closed candidate.
8. Deduplicates by the existing Route IQ business identity and excludes the primary business and all completed businesses before composition.
9. Orders candidates by governance stage, relationship priority, relationship confidence, distance, immutable source order, and stable identity without changing recommendation scores or scoring weights.
10. Emits either explainable Nearby Opportunities or an explainable coverage-gap state. It does not invent businesses that are absent from governed data.
11. Remains advisory until a separate Dashboard activation task is authorized.

## System Impact

- Arrival context can distinguish commercial-location relationships from simple proximity.
- Nearby opportunities remain secondary to the primary recommendation and do not alter production recommendation scores or route order.
- Sparse source coverage, quarantined adjacent records, and missing commercial relationship identifiers become visible validation findings rather than false claims.
- Workspace isolation, canonical hours eligibility, Active Pool priority, Full Pool fallback, completed-stop exclusion, duplicate protection, and zero-live-Google runtime remain testable invariants.
- Existing Dashboard, Data, CRM, Companion, and production scoring behavior remain unchanged during advisory activation.

## Computer Implementation

The architecture uses:

- A versioned governed configuration for result limits, relationship priority, maximum distances, relationship evidence requirements, fallback activation, and explanation language.
- A pure deterministic projection that consumes immutable candidate and eligibility snapshots.
- Existing Route IQ identity and canonical business-hours eligibility contracts rather than parallel implementations.
- Optional structured identifiers for building, shopping center, commercial parcel, and shared parking area.
- Conservative geographic inference when structured identifiers are absent, with inferred status and lower confidence exposed in provenance.
- Bounded candidate scans and stable tie-breaking to preserve deterministic output and prevent unbounded work.
- A coverage report containing supplied, eligible, excluded, deduplicated, Active Pool, fallback, relationship-tier, and hours-status counts.
- Fail-closed validation for unknown workspaces, operating-profile mismatches, cross-workspace records, missing primary coordinates, malformed candidate coordinates, and unauthorized runtime influence.

## Workflow

```text
Primary arrival + governed candidate snapshots
                     |
                     v
Workspace / pool / quarantine / identity gates
                     |
                     v
Canonical business-hours eligibility
                     |
                     v
Exclude primary, completed, and duplicate identities
                     |
                     v
Resolve verified or inferred commercial relationship
                     |
                     v
Active verified-open opportunities available?
       |                              |
      yes                             no
       |                              v
       |                  Governed Full Pool fallback
       |                              |
       +---------------+--------------+
                       v
Governance stage -> relationship priority -> confidence -> distance
                       |
                       v
Nearby Opportunities + explanations + coverage report
                       |
                       v
No eligible supply? -> explainable coverage-gap state
```

## Relationship To Existing Route IQ Invention

This behavior extends contextual route intelligence from radial candidate display into governed arrival-area opportunity reasoning. It reuses existing recommendation eligibility, identity, queue, and explainability controls and leaves the proprietary production scoring system unchanged.

## Alternative Embodiments

- Structured relationships may come from parcel identifiers, building identifiers, shopping-center directories, commercial geofences, address-unit clusters, parking-lot polygons, or customer-approved datasets.
- Walkability may be estimated from straight-line distance, pedestrian-network distance, entrance-to-entrance distance, accessibility constraints, or an offline cached travel matrix.
- Relationship inference may use deterministic rules, spatial indexing, graph edges, or a governed confidence model, provided provenance and confidence remain visible.
- Full Pool fallback may fill a target count, activate only when Active Pool has no eligible result, or remain disabled by workspace policy.
- Results may later be consumed by Dashboard, Mobile, Companion, or a route service after explicit subsystem activation and regression approval.
- A future offline enrichment process may populate commercial-center relationships; this advisory projection does not own or mutate source data.

## Supporting Diagrams

The workflow diagram in this record is the initial supporting diagram.

Implementation evidence:

- `intelligence/nearby-context-intelligence-v2.mjs`
- `intelligence/config/nearby-context-intelligence-v2.json`
- `intelligence/contracts/nearby-context-intelligence-v2-contracts.json`
- `intelligence/artifacts/nearby-context-intelligence-v2/fitness_connection/cruz/nearby-context-audit-v2.json`
- `tests/nearby-context-intelligence-v2.test.mjs`

## Supporting Screenshots

No interface is changed in this phase. Authenticated screenshots should be preserved if a later Dashboard activation displays relationship-aware Nearby Opportunities in production.

## Preservation Decision

- Document under the existing IP-001 Route IQ evidence history as a dated implementation expansion.
- Preserve proprietary ranking details and future relationship-confidence calibration as confidential implementation information.
- Present this record to patent counsel for advice on whether any future filing review is appropriate.

No conclusion about patentability is made in this record.
