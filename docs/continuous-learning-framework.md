# Continuous Learning Framework

## Purpose

This document defines how Prometheus Route Intelligence should learn from verified field behavior over months and years.

It extends the approved Route Intelligence V2 architecture. It does not replace the existing dashboard, route engine, representative profile model, Google validation, copy/export workflow, or local beta data flow.

The purpose is to make Prometheus better at answering one question:

Why should this representative go here next?

## Existing Work Verification

Route Intelligence V2 is already designed in `docs/route-intelligence-v2-architecture.md`.

The current product is partially built in the existing Prometheus IQ dashboard source:

- `index.html`
- `deploy/cloudflare-pages/index.html`

Existing systems to reuse:

- Google-qualified business validation
- Google Place IDs
- Google Maps-safe directions
- representative profiles
- visit logging
- route history
- recommendation history
- learned preferences
- confidence adjustments
- Copy Today's Summary
- Export Today's Report
- quarantine rules
- representative-facing categories

Existing systems to improve:

- evidence admission rules
- confidence maturity rules
- exploration versus proven-path balance
- representative DNA summary
- long-term learning safeguards
- explanation quality

Do not duplicate:

- the dashboard
- the route engine
- representative profiles
- localStorage schema
- Google discovery system
- copy/export handoff
- owner/rep mode
- Route Intelligence V2 architecture

## Relationship To Route Intelligence V2

Route Intelligence V2 defines the learning architecture: what signals matter, how representative DNA should emerge, and how recommendations should become explainable.

The Continuous Learning Framework defines the operating rules for that architecture over time:

- how evidence is admitted
- how evidence is validated
- when evidence changes confidence
- when confidence should not change
- when exploration is required
- when a pattern becomes proven
- how Prometheus avoids learning the wrong lesson

This framework naturally fits into the Route Intelligence V2 phases:

- Phase 1: read-only learning audit
- Phase 2: evidence buckets
- Phase 3: bounded confidence adjustment
- Phase 4: representative DNA summary
- Phase 5: future cloud-synced learning

## Learning Philosophy

Prometheus should learn slowly, truthfully, and only from verified field evidence.

One good visit should not rewrite a representative profile. One bad visit should not bury a useful category. A lucky sale should be treated as a signal, not a law.

Prometheus should separate:

- Verified: directly supported by logged field data or Google Places validation
- Inferred: reasonably derived from repeated verified data
- Estimated: useful but not yet strongly supported
- Unknown: not known and should not be guessed

Recommendations may adapt only when the evidence is strong enough to justify the change.

## Evidence Model

An evidence event is any field interaction or route action that can help Prometheus understand representative performance.

Primary evidence sources already exist or are planned in the current architecture:

- recommendation shown
- route generated
- business visited
- visit timestamp
- Google Place ID
- verified business name
- verified street address
- representative-facing category
- distance or radius band
- day of week
- time window
- route sequence position
- conversation count
- lead count
- unit count
- later unit attribution
- notes and outcomes
- skipped or repeated business behavior when captured

A future evidence record should preserve these fields without creating a second route engine:

```js
{
  repId: "anthony",
  placeId: "google-place-id",
  businessName: "Verified Business Name",
  category: "Restaurant",
  dayOfWeek: "Friday",
  timeWindow: "late_morning",
  sequencePosition: 3,
  radiusBand: "nearby",
  outcome: {
    visited: true,
    conversations: 1,
    leads: 1,
    units: 0
  },
  truthLevel: "verified",
  confidenceWeight: 0.42,
  createdAt: "ISO timestamp"
}
```

## Evidence Validation

Evidence should enter the learning system only after basic validation.

A place is valid only when it has:

- Google Places source
- Google Place ID
- verified business name
- verified numbered street address
- Google Maps-safe directions
- representative-facing category

A visit is valid when:

- it is tied to a representative profile
- it references a valid place
- outcome fields are nonnegative numbers
- timestamp exists
- notes are stored as notes, not treated as facts

Later unit updates should strengthen the original evidence record rather than creating duplicate success events.

If a recommendation is unverified, generic, duplicated, vague, quarantined, or not direction-safe, it must not influence confidence.

## How Evidence Influences Recommendations

Continuous learning should feed the existing Route Intelligence scoring model. It should not create a second scoring system.

Evidence should influence:

- category weighting
- time-window weighting
- place-type weighting
- route sequence weighting
- freshness penalties
- repeat-visit decisions
- exploration slots
- confidence explanations

Evidence should not override Google quality gates. A high-performing category still cannot recommend a bad destination.

## Confidence Model

Confidence should rise when evidence is repeated, recent, and consistent.

Confidence can increase when:

- a representative repeatedly creates conversations in a category
- a representative repeatedly turns conversations into leads
- a time window performs better than nearby alternatives
- multiple businesses in the same pattern perform well
- later unit attribution confirms earlier route quality
- a place or category performs across more than one day

Confidence should not change when:

- the place is not Google-qualified
- the sample size is too small
- the result is a single lucky sale
- the result is a single bad visit
- the data is stale
- the note is ambiguous
- the representative did not actually visit
- the outcome is missing
- the route was manually altered in a way Prometheus cannot observe

Recommended confidence maturity levels:

- Unknown: 0-2 relevant visits
- Emerging: 3-7 relevant visits with early signal
- Supported: 8-19 visits across multiple businesses or days
- Proven: 20+ visits with repeated performance and consistent context
- Decaying: formerly useful pattern that has weakened over time

These thresholds are guidelines. Prometheus should keep them conservative until larger field data exists.

## When Confidence Becomes Proven

A place-level pattern may become proven when a specific business repeatedly produces meaningful outcomes across multiple visits.

A category-time pattern may become proven when several businesses in the same category and time window outperform alternatives across multiple days.

A representative DNA trait may become proven only after enough evidence exists to distinguish the representative from generic baseline behavior.

Prometheus should never call a pattern proven because of one sale, one visit, or one good day.

## Exploration Strategy

Prometheus should always reserve some space for exploration.

Exploration should occur when:

- the representative is new
- the territory is new
- evidence is thin
- a category is under-tested
- multiple options have similar confidence
- a route is becoming repetitive
- the representative has already met the immediate goal
- existing patterns are becoming stale

Exploration should slow when:

- the representative is behind goal late in the day
- proven options are nearby
- recent exploration produced weak results with sufficient evidence
- route quality would drop sharply
- travel time would become inefficient

Exploration should never fully stop. A small exploration reserve protects Prometheus from category lock-in.

## Representative DNA

Representative DNA is the long-term pattern profile for an individual representative.

It should describe how a representative tends to succeed, not simply what category they visited.

Prometheus should learn patterns such as:

- preferred business categories
- preferred business sizes when inferable
- preferred business types
- preferred visit time windows
- preferred route sequence positions
- repeat success patterns
- unsuccessful patterns
- category-time combinations
- radius and travel tolerance
- conversation-to-lead tendencies
- lead-to-unit tendencies

Representative DNA must remain generic enough for future industries including gyms, healthcare, roofing, insurance, SaaS, HVAC, retail, and other field-sales use cases.

Example of the correct level of reasoning:

Anthony performs well with independent, walk-in service businesses during weekday mornings after multiple conversations.

Example of the wrong level of reasoning:

Anthony sells auto.

## Knowledge Protection Safeguards

Prometheus must protect itself from learning the wrong lesson.

Required safeguards:

- sample-size floors before strong changes
- confidence caps for early data
- recency decay for old patterns
- outlier suppression for one-off wins
- negative evidence smoothing
- per-representative separation
- no cross-rep learning without explicit design
- no founder baseline overwrite of representative learning
- quarantine invalid places
- prevent duplicate recommendation learning
- truth labels for every inferred pattern
- exploration reserve to prevent lock-in
- reset versioning for beta profile corrections
- notes remain qualitative until structured safely

If evidence conflicts, Prometheus should lower confidence rather than force a conclusion.

## Learning Explainability

Every recommendation should eventually answer:

- Why was this business recommended?
- Why did confidence increase?
- Why did confidence decrease?
- Why was another business skipped?
- What evidence supports this recommendation?
- What is still unknown?

Representative-facing explanations should be short and useful:

This stop is recommended because nearby walk-in service businesses have produced stronger conversations for you this week, and this location is Google-verified with a direct route.

Owner-facing explanations can include more detail:

Confidence increased because the representative logged repeated conversations and lead creation across similar verified businesses during the same time window. The sample size is still emerging, so exploration remains active.

## Scalability

The same learning philosophy should work at every company size.

One representative:

- local profile learning
- conservative confidence
- manual export support
- simple explanation layer

Ten representatives:

- separate representative DNA
- manager comparison
- team-level category patterns
- no accidental profile mixing

Hundreds of representatives:

- backend storage required
- tenant isolation
- evidence aggregation
- batch learning jobs
- versioned learning models
- monitoring for drift

Thousands of representatives:

- formal model governance
- privacy controls
- role-based access
- audit logs
- region and industry segmentation
- explainability review

The philosophy does not change. Only the storage, governance, and processing layer expands.

## Implementation Phases

### Phase 0: Current Stable Foundation

Maintain the current Google-qualified route engine, representative profiles, localStorage beta behavior, copy/export workflow, and quarantine rules.

### Phase 1: Read-Only Learning Audit

Generate a read-only summary from existing data:

- best categories
- weakest categories
- best time windows
- strongest places
- repeated skips or repeats if available
- current evidence quality

Do not alter recommendations yet.

### Phase 2: Evidence Buckets

Create structured evidence buckets inside the existing representative profile:

- category by time window
- category by radius
- place type
- route sequence position
- repeat visit
- later unit attribution

### Phase 3: Bounded Confidence Updates

Allow evidence buckets to adjust confidence with caps:

- small sample cap
- recency decay
- exploration reserve
- verified-place requirement
- no single-event overreaction

### Phase 4: Representative DNA Summary

Generate a readable representative DNA summary:

- emerging patterns
- supported patterns
- proven patterns
- weak patterns
- unknowns

### Phase 5: Team And Manager Learning

After backend storage exists, aggregate across representatives without blending individual profiles incorrectly.

### Phase 6: Continuous Monitoring

Add drift checks, stale-pattern warnings, data-quality alerts, and periodic confidence reviews.

## Engineering Risks

Primary risks:

- overfitting early beta data
- confusing luck with repeatable skill
- learning from invalid places
- profile contamination between representatives
- stale localStorage data
- over-weighting founder baseline
- category lock-in
- false causality from time or sequence
- poor explainability
- cloud sync complexity

The safest first implementation is a read-only learning audit before any scoring changes.

## Recommended Next Implementation

The highest ROI next step is Phase 1: a read-only continuous learning audit generated from the existing representative profile and visit history.

It would give Cruz visibility into what Prometheus thinks it is learning without risking bad automatic route changes.

## Status

Architecture ready.
