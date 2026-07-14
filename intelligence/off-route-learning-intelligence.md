# Off-Route Learning Intelligence v1

## Purpose

Off-Route Learning Intelligence identifies why a representative visited each business and measures explicit representative decisions separately from Route IQ recommendations. It is a read-only Intelligence projection. It does not change Dashboard behavior, Data ownership, route generation, recommendation scoring, or recommendation influence.

Prospective retention and administrative-disposition admission are inherited from the canonical read-only archive boundary. Expired, noncanonical, disposed, or over-retained evidence cannot become a source cohort, representative-judgment metric, recommendation input, baseline, or calibration record. Audit visibility is hash-only.

## Existing Architecture Reused

- Canonical archived field sessions are loaded through `read-only-field-session-learning.mjs`.
- Data admission, immutable archive access, finality, and workspace checks remain owned by the existing read-only field-session contract.
- Confidence, explainability, human-review, and workspace-isolation principles come from the Adaptive Field Learning Loop.
- Route IQ scoring and continuous replenishment remain protected inputs, not consumers of this output.

No second archive reader, visit store, route engine, scoring engine, or learning activation path is created.

## Decision Source Model

Every projected visit receives one source:

1. Route IQ Recommendation
2. Nearby Context
3. Representative Saved Place
4. Representative Discovery
5. Representative Follow-up
6. Manual Selection
7. Existing Relationship
8. Unknown

A known source requires structured `visitDecisionSource` evidence containing source, reason, evidence references, confidence, and capture time. Notes, outcomes, business source type, location, and recommendation availability cannot supply a missing decision source.

Historical records without structured source evidence remain Unknown. Unknown visits are visible in source-coverage metrics and excluded from unsupported acceptance, override, discovery, and judgment-rate denominators.

## Override Boundary

Off-route and override are different facts.

- A known non-route source may establish that a visit was off-route.
- A verified override additionally requires structured recommendation decision context showing that a specific Route IQ recommendation was available and intentionally overridden.
- A Saved Place, follow-up, discovery, manual choice, existing relationship, or Nearby Context visit without that context is not automatically labeled an override.

Recommendation Acceptance Rate and Recommendation Override Rate share only the explicit accepted-or-overridden decision cohort as their denominator.

## Outcome And Success Model

Success is governed by operating-profile-compatible structured outcomes. In the Fitness policy, one or more verified leads, units, later units, appointments, sales, contracts, or referrals qualifies as success. An outcome label alone does not create success.

The projection reports:

- Recommendation Acceptance Rate
- Recommendation Override Rate
- Override Success Rate
- Discovery Success Rate
- Representative Judgment Confidence
- Learning Confidence
- Source cohort counts and outcomes
- Category off-route observations
- Territory off-route observations

Rates remain `null` when their denominator is unavailable. Zero evidence is never presented as a zero-percent performance result.

## Representative Judgment Comparison

Representative Saved Place, Representative Discovery, Representative Follow-up, Manual Selection, and Existing Relationship form the representative-judgment cohort. Nearby Context remains a system-context cohort. Route IQ Recommendation remains the system-recommendation cohort.

Representative judgment is compared with Route IQ only after both cohorts meet governed minimum outcome counts. Until then, the comparison status is insufficient evidence and no superiority conclusion is produced.

## Explainability

Every verified override preserves:

- Reason
- Evidence
- Outcome
- Confidence
- Timestamp
- Representative
- Workspace

Every metric also exposes numerator, denominator, evidence threshold, status, and limiting factors. Every source observation retains session, visit, business, category, territory, representative, workspace, timestamp, source confidence, and recommendation-decision context.

## Canonical Artifact

The canonical artifact is generated only from the currently authorized verified Data archive. The current archive does not contain `visitDecisionSource` or recommendation decision context, so all four historical visits are truthfully classified Unknown and all source-dependent rates remain unavailable.

`fixtures/off-route-learning-evidence-v1.json` is validation-only. It proves the source taxonomy, override boundary, cohort metrics, and explainability, but it cannot generate the canonical artifact or enter production learning.

## Safety

- Read-only archive access only.
- No raw evidence or stress-observation consumption.
- No archive mutation, overwrite, deletion, replay, or historical evidence creation.
- Unknown workspace and wrong operating profile fail closed.
- Cross-workspace aggregation is prohibited.
- No Dashboard or Data changes.
- No route generation or recommendation scoring changes.
- No recommendation influence.
- Protected behavior hashes are verified before canonical artifact generation.

## Future Producer Handoff

A future separately authorized producer may add structured `visitDecisionSource` and `recommendationDecisionContext` fields to canonical field-session records. This Intelligence task does not authorize or implement that producer change.
