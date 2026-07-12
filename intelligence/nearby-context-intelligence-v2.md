# Nearby Context Intelligence v2

Status: Intelligence-owned advisory projection active; production Dashboard consumer inactive.

Owner: Prometheus Intelligence Engine

Purpose: Produce qualified secondary opportunities around a primary Route IQ arrival without replacing the primary recommendation or changing recommendation scoring.

## Nearby Opportunity Architecture

Nearby Context v2 consumes immutable snapshots from existing governed systems:

```text
Primary Route IQ arrival
        +
Active Pool candidate projection
        +
Governed Full Pool fallback projection
        +
Canonical business-hours decisions
        +
Completed route identities
        +
Optional commercial relationship identifiers
        |
        v
Eligibility and workspace boundary
        |
        v
Canonical Route IQ identity resolution
        |
        v
Duplicate aliases removed
        |
        v
Commercial relationship resolver
        |
        v
Deterministic nearby composer
        |
        v
Nearby Opportunities or explainable coverage gap
```

This projection is secondary arrival context. It does not replace the primary recommendation, reorder the active route, mutate the production queue, or calculate a new recommendation score.

## Canonical Eligibility Boundary

The engine imports `route-business-hours-eligibility.mjs` and preserves its complete decision snapshot. It does not contain a second business-hours evaluator.

Candidate processing order is:

1. Workspace and operating-profile scope.
2. Existing pool and route eligibility.
3. Primary and completed-stop identity exclusion.
4. Canonical business-hours eligibility.
5. Coordinate and bounded search validation.
6. Canonical business identity resolution through existing `routeQueueIdentity` behavior.
7. Duplicate alias removal.
8. Commercial relationship classification over unique canonical businesses only.
9. Shopping-center inference.
10. Walkability and nearby composition.

`CLOSED_VERIFIED` candidates are excluded before relationship classification. `HOURS_UNKNOWN`, `HOURS_STALE`, and `SPECIAL_HOURS_UNVERIFIED` remain eligible only through the canonical conservative coverage tier and retain their hours-not-verified explanation.

The governed selection stages remain:

1. Active Pool verified open.
2. Full Pool verified-open fallback.
3. Active Pool hours-unverified coverage.
4. Full Pool hours-unverified coverage.

## Relationship Model

Within a governance stage, relationships are ordered:

1. Same building.
2. Same shopping center.
3. Same commercial parcel.
4. Walkable.
5. Nearby.

Structured `buildingId`, `shoppingCenterId`, `commercialParcelId`, and `parkingAreaId` values are accepted as optional inputs. Matching building, center, and parcel identifiers produce verified relationship evidence. A shared parking-area identifier supports a disclosed parcel-context inference.

When structured relationships are absent, the engine may make conservative deterministic inferences from normalized street addresses, governed candidate density, street-number span, and straight-line distance. Inference never receives a verified label. Distance alone cannot claim a verified building, shopping center, or parcel.

Governed candidate density is calculated only after canonical identity deduplication. An alias cannot increase shopping-center membership, cluster density, or any other relationship evidence count.

Adjacent buildings and shared parking are preserved as visible evidence signals. All distance thresholds, cluster membership requirements, result limits, and confidence order are governed in `config/nearby-context-intelligence-v2.json`.

## Selection Strategy

The composer uses governance stage, relationship priority, relationship confidence, distance, existing route order, and stable identity. Existing recommendation scores are retained only as immutable provenance and are not used to order Nearby Opportunities.

The scan is bounded. After eligibility, the existing Route IQ identity function prioritizes Google Place ID and retains one deterministic canonical candidate per identity before any relationship function runs. Distinct Google Place IDs remain distinct, preserving legitimate multi-tenant businesses even when they share a street address. The primary business, any completed business, any quarantined record, any cross-workspace record, and any verified-closed record are never selectable.

Active Pool candidates remain authoritative. Governed Full Pool fallback is available through the same production-safe fallback projection used by existing Route IQ quality validation. Quarantine records may be supplied for diagnostic coverage reporting but cannot enter selection.

## Explainability Model

Every opportunity answers:

- Why: the operational relationship to the primary arrival.
- Evidence: relationship verification, distance, source pool, and hours state.
- Confidence: relationship and business-hours confidence without formula disclosure.
- What changed: relationship-aware context replaced radial-only reasoning in this Intelligence projection.
- Next action: a concise secondary-stop suggestion, including hours confirmation when evidence is uncertain.

The consumer title is `Nearby Opportunities`.

When no governed candidate survives, the projection returns an explicit coverage gap. It states that nearby storefronts may exist but current governed records were absent or excluded. It never invents an observed business or weakens governance to avoid an empty result.

## Field Evidence Findings

The canonical audit preserves the July 11 observations as Founder-verified design requirements, not learning inputs.

Texans Auto Repair - Blackhawk:

- Blackhawk Dental is 112.3 feet away in the current data, but it is quarantined and therefore correctly excluded.
- Elite Dry Cleaners has no governed identity in the current candidate supply.
- The honest current result is an explainable coverage gap.

Christian Brothers Automotive Pearland:

- The field observation confirms more than five nearby businesses, but their identities were not archived.
- The nearest current governed diagnostic record is quarantined.
- The honest current result is an explainable coverage gap.

Governed capability probe:

- Fuqua Professional Auto Repair produces six verified-open Active Pool walkable opportunities from current offline data.
- Each opportunity includes complete explanation and canonical hours provenance.

These findings show that the Intelligence capability works when eligible records exist and that the two stress-test false negatives also require a future Data-owned enrichment handoff. This implementation does not mutate Data or assign missing identities.

## Configuration Model

`config/nearby-context-intelligence-v2.json` governs candidate sources, search bounds, relationship priority, address-cluster inference, walkable and nearby ranges, result limits, selection stages, explanation requirements, and activation safety.

`contracts/nearby-context-intelligence-v2-contracts.json` defines source ownership, canonical eligibility reuse, workspace isolation, full-pool fallback, output shape, protected behavior hashes, and consumer prohibitions.

The generated audit is `artifacts/nearby-context-intelligence-v2/fitness_connection/cruz/nearby-context-audit-v2.json`.

## Activation Boundary

The Intelligence advisory projection is implemented and validated. Dashboard consumption is not authorized by this task. No Dashboard, Data, CRM, Companion, route-scoring, active-queue, or live-Google runtime behavior changed.

A future Dashboard task may consume the output contract only after the required source enrichment exists and a separate explicit activation handoff verifies authenticated production behavior.

## Duplicate Prevention

Future Nearby Context work must extend this module, policy, contract, audit, and regression suite. It must reuse `routeQueueIdentity`, remove aliases before relationship inference, and keep multi-tenant Place IDs distinct. It must not create a second nearby engine, second business-hours evaluator, parallel identity rule, ungoverned map lookup, direct stress-observation learning path, or fallback that admits closed, quarantined, completed, duplicate, or cross-workspace businesses.

## Invention Documentation

The relationship-aware expansion was documented before implementation in `patents/route-iq/NEARBY_CONTEXT_INTELLIGENCE_V2.md` under the permanent Route IQ invention-documentation rule. That record makes no patentability claim.
