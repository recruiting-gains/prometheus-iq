# Off-Route Learning Intelligence v1

Recorded: 2026-07-12

Related invention record: IP-001 - Route IQ Adaptive Representative Intelligence System

Related subsystem: Prometheus Intelligence Engine / Route IQ

Status: Technical invention evidence record. This document does not make patentability claims or state legal conclusions.

## Date Conceived

The source-aware off-route learning expansion was documented on 2026-07-12 after Founder field testing showed that representatives intentionally visit businesses outside the primary recommended route. Whether an earlier founder conception artifact exists for this exact decision-source learning mechanism requires Founder confirmation.

## Technical Problem Solved

A completed visit outcome identifies what happened at a business, but it does not necessarily identify why the representative selected that business. A visit may originate from a Route IQ recommendation, Nearby Context, a saved place, direct field discovery, a follow-up, manual selection, or an existing relationship. Treating every completed visit as acceptance of the recommended route would corrupt recommendation-acceptance measurements and representative-learning conclusions.

The technical problem is distinguishing system-guided and representative-directed field decisions, measuring their outcomes, and comparing their performance without inferring unavailable decision context, mutating archived evidence, changing recommendation scoring, or activating recommendation influence.

## Technical Solution

Off-Route Learning Intelligence v1 introduces a deterministic, workspace-scoped, read-only projection over verified field visits. It:

1. Assigns every projected visit one governed decision source: Route IQ Recommendation, Nearby Context, Representative Saved Place, Representative Discovery, Representative Follow-up, Manual Selection, Existing Relationship, or Unknown.
2. Accepts a non-Unknown source only when canonical structured evidence explicitly records that source.
3. Keeps source-unavailable historical visits as Unknown and does not infer source from notes, category, location, business identity, or outcome.
4. Distinguishes an off-route visit from a verified recommendation override. An override requires explicit evidence that a Route IQ recommendation was available and intentionally bypassed.
5. Calculates recommendation acceptance and override rates only over visits with sufficient recommendation-decision context.
6. Calculates override, discovery, saved-place, follow-up, and representative-judgment outcomes from explicit source cohorts.
7. Compares representative-judgment and Route IQ outcome rates only after governed evidence minima are met for both cohorts.
8. Emits confidence, evidence counts, limiting factors, timestamps, representative scope, workspace scope, territory scope, outcome provenance, and reason codes for every learned conclusion.
9. Produces Intelligence-owned observation artifacts while leaving source Data records byte-identical.
10. Keeps all conclusions ineligible for recommendation influence in this phase.

## System Impact

- Route IQ can distinguish representative decision provenance from business-data provenance.
- Saved Places, field discoveries, follow-ups, existing relationships, manual choices, Nearby Context, and primary Route IQ recommendations remain separate learning cohorts.
- Unknown historical source evidence remains visible as a coverage gap rather than being silently promoted into an acceptance or override.
- Recommendation Acceptance Rate, Recommendation Override Rate, Override Success Rate, Discovery Success Rate, Representative Judgment Confidence, and Learning Confidence become governed Intelligence outputs.
- Territory and category summaries can describe where explicit off-route behavior occurs without changing route generation or scoring.
- Dashboard, Data ownership, Route IQ runtime, recommendation scoring, and production learning behavior remain unchanged.

## Computer Implementation

The implementation uses:

- A versioned decision-source taxonomy and alias map owned by Intelligence.
- A pure projection over immutable, verified field-session records admitted through the existing read-only archive contract.
- Stable visit evidence identifiers derived from canonical session and visit identities.
- Explicit recommendation-decision context fields for acceptance and override denominators.
- Governed success criteria and minimum sample thresholds stored in configuration rather than embedded in scoring logic.
- Separate source coverage, outcome coverage, recommendation-decision coverage, and comparison maturity calculations.
- Deterministic percentage calculations with unavailable states when denominators or evidence thresholds are absent.
- Fail-closed workspace, operating-profile, representative, timestamp, source, and evidence validation.
- Protected baselines for Dashboard, Data, Route IQ scoring, and route generation behavior.

## Workflow

```text
Verified canonical field visits
             |
             v
Read-only source admission and workspace validation
             |
             v
Explicit decision source present? -- no --> classify Unknown
             |
            yes
             v
Normalize governed source + preserve reason/evidence/context
             |
             v
Recommendation decision context present?
       |                         |
      yes                        no
       |                         |
       v                         v
Acceptance/override cohort    Source cohort only
       |                         |
       +------------+------------+
                    v
Outcome cohorts + confidence thresholds
                    |
                    v
Read-only Intelligence artifact and explainability
                    |
                    v
No scoring or recommendation influence
```

## Relationship To Existing Route IQ Invention

This behavior extends the documented representative intelligence loop by preserving the provenance of a representative's field decision before evaluating its outcome. It separates the quality of Route IQ recommendations from the quality of representative judgment while reusing the existing field-evidence, confidence, explainability, human-review, and workspace-isolation architecture.

## Alternative Embodiments

- Decision source may be recorded at route selection, navigation launch, visit check-in, outcome submission, or post-visit review.
- Recommendation context may identify one bypassed recommendation, a set of available recommendations, or a route position at the time of the decision.
- Success may be configured by operating profile as a conversation, lead, appointment, inspection, estimate, referral, contract, membership, sale, or another normalized outcome.
- Comparison may use simple governed cohort rates, time-window-matched cohorts, territory-matched cohorts, category-matched cohorts, or manager-approved statistical models.
- Source provenance may later be linked into the Customer Intelligence Graph as visit-to-recommendation, visit-to-saved-place, visit-to-follow-up, or visit-to-relationship edges.
- A future consumer may display source and explanation summaries after a separately authorized Dashboard or Mobile handoff.

## Supporting Diagrams

The workflow diagram in this record is the initial supporting diagram. Source contracts, canonical artifact output, regression results, and future production evidence should be linked after implementation.

## Supporting Screenshots

No interface changes are authorized in this phase. Screenshots should be preserved only if a later consumer activation displays decision-source or override intelligence.

## Preservation Decision

- Document under the existing IP-001 Route IQ evidence history as a dated implementation expansion.
- Preserve proprietary recommendation scoring and future cohort-calibration details as confidential implementation information.
- Present this record to patent counsel for advice on whether any future filing review is appropriate.

No conclusion about patentability is made in this record.
