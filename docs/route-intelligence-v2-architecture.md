# Route Intelligence V2 Architecture

## Purpose

Route Intelligence V2 is the next evolution of the existing Prometheus IQ Route Intelligence engine. Its purpose is to help Prometheus learn why each representative succeeds, not only what happened after a visit.

This document is architecture only. It does not redesign the dashboard, create a duplicate learning system, or replace the current Route Intelligence implementation.

## Existing Work Verification

1. Is this already built?

Partially. Prometheus already has a stable Route Intelligence engine in `index.html`, mirrored into `deploy/cloudflare-pages/index.html`. It already supports Google-qualified places, representative profiles, route history, visit logging, category and time-window performance, confidence explanations, copy/export, and quarantine rules.

2. Is it partially built?

Yes. Current Route Intelligence learns outcomes and rotates recommendations, but it does not yet maintain a durable reasoning model that explains why a representative succeeds across category, time, place type, sequence, and context.

3. Where does it already exist?

- `index.html`: current dashboard, route scoring, profile storage, localStorage state, route rendering, copy/export, visit logging, recommendation history, Google-qualified route behavior.
- `deploy/cloudflare-pages/index.html`: deployed package copy of the dashboard.
- `docs/prometheus-enterprise-product-audit-2026-06-22.md`: prior Route Intelligence audit and exploration/exploitation design notes.
- `git:c7119fcee140ab8a130cdb888439277fdcbeb6b0:dashboard-intelligence-report.md`: exact baseline dashboard intelligence and recommendation explanation evidence.
- `git:c7119fcee140ab8a130cdb888439277fdcbeb6b0:prometheus-route-intelligence-quality-report.md`: exact baseline Google Places quality and field-sales route quality evidence.
- `data/qualified-prospects/README.md`: Google discovery and qualified prospect process.
- `scripts/lib/qualified-prospect-routing.mjs`: qualified prospect route scoring support.

4. Should it be reused?

Yes. V2 should reuse the existing route engine, rep profile model, visit records, Google place validation, recommendation history, and explanation surfaces.

5. Should it be improved?

Yes. The improvement should be an interpretation layer inside the current architecture: stronger evidence ranking, sample-size-aware confidence, representative tendency detection, and clearer explanations.

6. What should not be duplicated?

Do not create a second dashboard, second route engine, second storage model, second profile system, or separate learning service. V2 should extend the existing Route Intelligence path.

## Current Learning Assessment

| Signal | Source | Stored In | Current Effect | Strength | Weakness |
| --- | --- | --- | --- | --- | --- |
| Google place identity | Google Places data and curated qualified prospect data | `state.places`, including place IDs and Maps-safe fields where available | Gates route eligibility and powers Directions | Keeps recommendations grounded in real businesses | Static once imported unless refreshed |
| Business name and address | Google Places / qualified prospect records | `state.places` | Display, Directions, quarantine validation | Makes stops actionable | Address quality depends on Google/source freshness |
| Business category | Place record | `place.category`; summarized into `categoryPerformance` | Used in route scoring, diversity, and explanations | Helps Prometheus avoid one-note routes | Categories are still broad and do not fully explain why a rep succeeds |
| Distance and radius band | Place distance text and route logic | `place.distance`; computed radius bands | Influences route pool, expansion, and freshness | Helps balance time efficiency and exploration | Text distance is not the same as live travel time |
| Visit history | Rep Log Result action | `repProfiles[rep].visits` and active top-level visits | Drives place performance, status, freshness, and route confidence | Real field activity is captured | A visit alone does not explain quality without context |
| Conversations | Log Result | Visit record | Increases category/place signal and expected opportunity | Better than visits alone | Conversation quality is not yet structured |
| Leads | Log Result | Visit record | Increases route confidence and expected output | Strong buying-intent signal | Lead quality and follow-up outcome are not fully modeled |
| Units | Log Result | Visit record | Strongest current production signal | Clear revenue proxy | Can overfit if sample size is small |
| Later units | Log Result / daily report payload | Visit record/report export | Captured for reporting | Preserves delayed outcomes | Not yet a mature route-scoring input |
| Time window | Visit window and current time logic | Visit record; `timeWindowPerformance` | Supports current-window fit and performance summaries | Begins to show when reps perform best | Not fully crossed with category and place type |
| GPS-attached visit location | Browser geolocation at visit logging | `visit.location` with visit-only scope | Supports GPS verification and reporting | Helps prove field activity | Not yet used for path, cluster, or sequence learning |
| Recommendation history | Route rendering and recommendation recording | `state.routeHistory`; `repProfiles[rep].routeHistory` | Reduces repetition and supports route freshness | Prevents stale repeated routes | It does not always prove the rep actually followed the recommendation |
| Founder baseline | Founder profile and historical snapshot | `founderHistoricalSnapshot`, Cruz profile | Gives new reps a bounded starting point | Useful when a rep has little data | Must be capped so founder history does not overpower rep-specific learning |
| Notes and outcomes | Log Result notes/quality fields | Visit record and daily report export | Available for review/export | Captures human context | Not yet converted into structured learning signals |
| Learned preferences | Reserved profile field | `repProfiles[rep].learnedPreferences` | Limited current effect | Good place for V2 expansion | Mostly a placeholder today |
| Confidence adjustments | Reserved profile field | `repProfiles[rep].confidenceAdjustments` | Limited current effect | Good place for bounded adaptation | Needs evidence thresholds before changing recommendations |

## Current Strengths

- Route Intelligence already uses real logged outcomes instead of pure static ranking.
- Google-qualified place rules reduce invalid destinations.
- Recommendation history and freshness reduce repetition.
- Category, radius, time window, and founder baseline already exist as useful inputs.
- Copy Today Summary and Export Today Report preserve beta data without adding a premature backend.
- Current explanations already tell the representative why a stop is recommended.

## Current Weaknesses

- The system knows that a category or place produced results, but not always why.
- Small samples can make a category look stronger than it really is.
- Notes and visit quality are captured but not consistently structured for learning.
- Current learning is mostly outcome-weighted, not evidence-weighted.
- Recommendation history tracks shown routes, but does not fully distinguish accepted, skipped, ignored, visited, and successful recommendations.
- Founder baseline can help a new representative, but must remain bounded to avoid biasing that representative forever.

## Learning Philosophy

Route Intelligence V2 should treat learning as evidence, not certainty.

Prometheus should classify signals as:

- Verified: logged visit, Google place ID, business name, address, GPS-attached visit, recorded conversation, lead, unit.
- Inferred: decision-maker likelihood, walk-in accessibility, category fit, likely conversation quality.
- Estimated: expected units, confidence percentage, ROI expectation, best time window.
- Unknown: anything not supported by Google data, visit data, or logged outcomes.

The engine should avoid strong conclusions until enough evidence exists. One sale should increase attention. It should not permanently define the representative.

## Representative DNA

Representative DNA should be a pattern model built from existing data. It should not hardcode assumptions about Anthony, Cruz, gyms, or any one industry.

The model should learn combinations such as:

- representative
- category
- place type
- chain vs independent where available
- day of week
- time window
- radius band
- visit sequence
- conversation rate
- lead rate
- unit rate
- repeat-visit performance
- notes/outcome tags when structured later

The goal is not to say, "Anthony sells Auto."

The goal is to say, "This representative tends to produce stronger conversations at independent service businesses during certain windows, with enough evidence to justify a higher-confidence recommendation."

## Proposed Route Intelligence V2 State

V2 should extend the existing representative profile rather than creating a new storage system.

Recommended future structure:

```js
repProfiles[repId].learningModel = {
  version: 1,
  updatedAt: "ISO timestamp",
  evidenceBuckets: {
    categoryTimeWindow: {},
    categoryRadius: {},
    placeType: {},
    sequencePosition: {},
    repeatVisit: {}
  },
  hypotheses: [],
  confidenceAdjustments: {},
  explorationState: {}
}
```

This object should be generated from existing visits, route history, place data, and outcomes. It should not replace existing fields such as `categoryPerformance`, `timeWindowPerformance`, or `placePerformance`.

## Learning Pipeline

1. Capture field event

The current Log Result flow already captures visits, conversations, leads, units, notes, timestamps, and optional GPS-attached location.

2. Normalize signals

Convert existing visit and place data into consistent signal buckets: category, time window, radius band, place ID, visit outcome, and available quality notes.

3. Aggregate evidence

Group results by useful combinations, not only single fields. Examples: category plus time window, category plus radius, place plus repeat visit, and first stop versus later route stops.

4. Rank evidence

Rank by recency, sample size, outcome strength, consistency, and relevance to the current route decision.

5. Adjust confidence carefully

Increase or decrease confidence only when evidence clears a minimum threshold. Avoid overfitting early beta data.

6. Feed existing route scoring

Pass bounded confidence adjustments into the existing `routeAnalysis` path. Do not create a second recommendation path.

7. Explain the recommendation

Show the representative the strongest verified or inferred reasons without exposing internal complexity.

## Confidence Model

Confidence should combine:

- Google validity and direction safety.
- Business actionability.
- Rep-specific historical evidence.
- Sample size.
- Recency.
- Category/time-window consistency.
- Place-level outcomes.
- Exploration need.
- Repetition and saturation penalties.

Confidence should be capped when evidence is thin. For example:

- 0-2 visits: mostly Google/actionability confidence, not rep-DNA confidence.
- 3-9 visits: tentative rep patterns.
- 10-24 visits: stronger category and time-window evidence.
- 25+ visits: mature rep pattern detection, still with exploration budget.

## Weighting Model

V2 should use bounded weights:

- Place quality prior: Google-qualified, walk-in, business category, address safety.
- Rep outcome weight: conversations, leads, units, and repeat performance.
- Context weight: current time window, route sequence, distance/radius, freshness.
- Exploration weight: under-tested categories, under-tested radius bands, new qualified businesses.
- Risk penalty: duplicate recommendations, stale places, saturated category, repeated no-result visits.

No single signal should dominate forever. Units are powerful, but the system must still protect exploration and freshness.

## Exploration Strategy

Prometheus should always reserve some route capacity for exploration.

Recommended default:

- New representative: higher exploration, bounded by Google quality.
- Behind goal: more proven recommendations, but not zero exploration.
- At or above goal: more exploration to build future intelligence.
- Mature profile: balanced exploitation with rotating discovery slots.

Prometheus should avoid category lock-in. If one category works, it should be weighted upward, not treated as the only route forever.

## Why Success Happened

Prometheus should explain success through evidence bundles:

- Was it the category?
- Was it the time window?
- Was it the specific place?
- Was it a repeat visit?
- Was it independent versus chain-like behavior?
- Was it proximity and route sequence?
- Was it a representative-specific tendency?

If the evidence is insufficient, Prometheus should say the pattern is not yet proven.

## Why Failure Happened

Failure should be treated carefully. A bad visit does not always mean the place was bad.

Possible explanations:

- Weak category fit.
- Wrong time window.
- Decision maker unavailable.
- Place already saturated.
- Too little evidence.
- Bad directions or bad place quality.
- Representative note indicates a one-off issue.

V2 should avoid penalizing a business or category too strongly from a single no-result visit.

## Storage Strategy

Short term:

- Continue using the existing `prometheus-v1` localStorage structure.
- Keep representative profiles as the source of learning data.
- Use Copy Today Summary and Export Today Report as beta handoff mechanisms.

Medium term:

- Add generated `learningModel` summaries to representative profiles.
- Version the learning model so migrations are explicit and reversible.
- Preserve reset controls for Founder and Anthony profiles.

## Territory Intelligence Phase 1

Prometheus Route Intelligence now treats territory assignment as part of the existing route scoring path, not as a separate engine.

Current radius configuration:

- Founder / Cruz: Fitness Connection home base, 15-mile assigned territory radius.
- Anthony: Fitness Connection home base, 25-mile assigned territory radius.

Route recommendations must remain Google-qualified and direction-safe before territory scoring matters. Territory never overrides the Google quality gates, quarantine rules, duplicate protection, or representative profile rules.

## Bullseye Expansion Strategy

Prometheus should work territory like a bullseye:

1. Start with the closest verified businesses around the representative's home base.
2. Build confidence in the nearest active ring.
3. Expand outward only when the current ring has enough coverage, freshness pressure, or route-quality need.
4. Keep discovery active so the representative does not get trapped in one category or one micro-area forever.

Phase 1 uses 5-mile rings inside the representative's assigned radius. Each recommendation receives a bounded territory score based on whether it is inside the assigned radius, whether it belongs to the current active ring, and whether it is still fresh for that representative.

## Representative Territory Assignment

The territory model is representative-specific:

- Cruz and Anthony may share the same home base today.
- Their route recommendations still remain separated by profile, visit history, reset state, and overlap controls.
- Overlap is reduced through existing profile isolation, founder historical winner protection, duplicate protection, and route uniqueness limits.
- Phase 1 also uses lightweight representative lane scoring so Cruz and Anthony do not receive the same default Google-qualified route when the shared territory has enough verified alternatives.
- Lane scoring is bounded and secondary. It can separate routes, but it cannot override Google qualification, valid addresses, direction safety, quarantine rules, or route quality.
- When the live verified pool is small, Route Intelligence first prefers each representative's strongest field-sales categories before falling back to the full verified pool. This keeps Founder and rep demos from showing the same route by default while still refusing to invent or recommend unverified businesses.
- Overlap is allowed only when the available verified territory is thin or when a place is high-quality enough to justify shared learning.

Future representatives should receive an explicit home base, maximum radius, and profile-specific learning state instead of inheriting another representative's territory behavior.

## Radius Configuration

Radius limits are product controls, not visual decoration:

- Businesses outside a representative's assigned radius should not enter the active route pool.
- Businesses inside the radius still must pass Google Places verification, address validation, direction safety, category usefulness, and quarantine checks.
- Founder mode should expose assigned radius, current ring, coverage progress, and representative radius so Cruz can verify territory behavior before beta use.

## Coverage Philosophy

Coverage does not mean visiting every business. Coverage means Prometheus has enough verified field evidence to understand which parts of the territory are worth reinforcing, which parts need exploration, and which parts should be avoided.

The current implementation tracks ring-level coverage from verified route places and logged visits. It is intentionally conservative: route quality and business validity matter more than raw geographic coverage.

Long term:

- Move synchronized learning to approved backend storage only after cloud sync is intentionally designed.
- Do not add KV, D1, or database sync as part of V2 architecture unless Cruz explicitly approves.

## Explainability Strategy

Every recommendation should be explainable in plain field-sales language.

Recommended explanation layers:

- Verified: "Google-verified business with usable directions."
- Learned: "Your last 8 service-business visits produced 5 conversations and 2 leads."
- Inferred: "Likely walk-in friendly based on category and business type."
- Unknown: "Decision-maker availability is not verified yet."

Representative-facing language should stay simple:

- "Strong category for you."
- "Fresh qualified stop."
- "Good time window."
- "Needs exploration."
- "Recent repeat, testing another option first."

## Implementation Phases

### Phase 0: Current Stable Route Intelligence

Already in place. Keep the current dashboard, Google quality gates, rep profiles, route history, copy/export, and visible explanations.

### Phase 1: Read-Only Learning Audit

Generate a learning audit from existing visits without changing recommendation behavior.

Output:

- strongest categories
- weakest categories
- strongest time windows
- thin-evidence warnings
- overfit warnings
- exploration gaps

### Phase 2: Evidence Buckets

Create evidence buckets from existing data:

- category plus time window
- category plus radius
- repeat visits
- place-level outcomes
- new versus returning stop

This should still be read-only at first.

### Phase 3: Bounded Confidence Adjustments

Use evidence thresholds to adjust current `routeAnalysis` confidence.

Rules:

- require minimum sample sizes
- cap early boosts
- apply decay to older evidence
- preserve exploration budget
- never bypass Google quality gates

### Phase 4: Representative DNA Summary

Generate a concise summary of each representative's proven, tentative, and unknown patterns.

This should support questions such as:

- "What is Anthony learning?"
- "Why is this route changing?"
- "What categories need more testing?"

### Phase 5: Cloud-Synced Learning

Only after beta proves the model useful, design backend storage for multi-device and manager visibility.

This is outside the current mission.

## Migration Strategy

1. Do not change the shape of existing visit records unless a migration is versioned.
2. Add new learning summaries as derived data.
3. Keep raw visit history as the truth source.
4. Preserve reset versions for Founder and Anthony.
5. Keep V1 scoring operational while V2 summaries are built.
6. Introduce confidence adjustments only after read-only audit output looks correct.

## Engineering Risks

- Overfitting from early beta results.
- Founder history biasing new representatives too much.
- Category lock-in reducing exploration.
- Treating correlation as causation.
- LocalStorage-only learning not reaching Cruz automatically unless exported.
- Notes being too unstructured for reliable automated interpretation.
- Google place data becoming stale.
- Confidence percentages sounding more certain than the evidence supports.
- Adding too much complexity to the dashboard instead of improving intelligence behind it.

## Highest ROI Improvements

1. Add a read-only learning audit from existing visit data.
2. Add evidence-count and sample-size awareness to confidence explanations.
3. Add structured reason codes inside the existing `routeAnalysis` output.
4. Preserve an exploration budget even when one category starts performing.
5. Summarize representative DNA as proven, tentative, and unknown patterns.

## Recommended Implementation Order

1. Document V2 architecture. Completed by this document.
2. Add a read-only learning audit helper that derives signals from existing profiles.
3. Add sample-size caps to confidence language.
4. Add structured reason codes to the existing route analysis path.
5. Add bounded confidence adjustments only after read-only audit verification.
6. Add optional structured tags for skipped/rejected visits only after Cruz approves that collection.
7. Design backend synchronization later, after the beta proves what data needs to be centralized.

## Success Standard

Route Intelligence V2 succeeds when Prometheus can truthfully answer:

- Why this representative should go here.
- What evidence supports that recommendation.
- What is still unknown.
- Whether Prometheus is exploiting proven behavior or exploring new opportunity.
- How many real field results support the confidence level.

The system should remain generic enough for gyms, healthcare, roofing, insurance, SaaS, HVAC, retail, and future industries without rewriting the learning engine.

## Status

Route Intelligence V2 architecture is ready for phased implementation inside the existing Route Intelligence engine.
