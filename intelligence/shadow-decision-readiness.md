# Route IQ Shadow Decision Validation and Readiness Gate v1

This Intelligence-owned, Founder-only read path extends the governed field-session learning architecture and calls Data's `projectRouteIqChronologicalEvidence` at each eligible visit opportunity. It creates exactly one immutable shadow record or explicit exclusion per opportunity. It has no operational import, write, or control path; recommendation influence is OFF in every state.

The canonical July 11 archive contains four visits but no historically frozen prospective candidate list or recommendation context, so all four opportunities are excluded and readiness is `INSUFFICIENT_EVIDENCE`. Validation-only fixtures are labeled non-production and are never inputs to the canonical generator.

Outcomes are append-only links. Missing, late, corrected, and conflicting observations remain separate and never rewrite a shadow decision. Equal-time evidence without proven prior availability and future evidence are excluded by the Data projection. Training and evaluation intervals are end-exclusive, chronological, non-overlapping, and overlap fails closed.

The prospective generator accepts an explicitly frozen opportunity containing candidate IDs, nonnegative weights, `availableAt`, evidence source IDs or SHA-256 hashes, and eligibility reasons. Every reference must resolve to a frozen immutable source manifest entry containing a canonical source ID, SHA-256, and `availableAt`. Candidate availability, manifest source availability, and every projected evidence timestamp must be strictly before the decision cutoff. Blank, unresolved, equal-time, future, or malformed provenance fails closed. The resolved manifest is preserved in the immutable shadow hash.

The sample requirement uses the conservative proportion confidence-interval formula `ceil(z² p(1-p) / e²)`: at 95% confidence, p=.5, and margin .10, 97 linked evaluation decisions are required. Five declared calibration bins derive `ceil(97/5)=20` observations per bin. Two evaluation windows deterministically divide support as 49 and 48. A material segment is derived as `ceil(97*.10)=10` observations. These are design calculations, not unexplained counts.

Actual representative action is evaluated separately as decision agreement and may be off-list. Each binary outcome names its `evaluatedDecisionId`. Outcome accuracy, Brier, ECE, baseline, stability, and segment metrics include it only when that ID is the selected shadow candidate. An off-list action and its outcome remain visible but cannot be scored as the selected candidate's outcome. Missing or unresolved-conflict outcomes remain unavailable.

Five reliability bins report support, predicted mean, observed rate, and support status. ECE is available only when every populated bin meets its formula-derived support; no unsupported populated bin is silently dropped. Performance stability applies governed maximum deltas to outcome accuracy, Brier, and ECE across consecutive windows. Top-decision distribution total variation remains supplemental.

The baseline is the explicit selected-candidate binary outcome rate from a strictly prior training window and requires the same formula-derived 97-outcome support as evaluation. Training and evaluation source IDs and hashes must also be disjoint. Baseline accuracy and Brier are evaluated on later windows, and deltas are observational comparisons only.

Representative, territory, customer-context, decision-type, and chronological-window segments are evaluated independently. Unknown segments remain explicit. Any materially supported segment below the governed accuracy or calibration threshold blocks eligibility even when aggregate metrics pass.

`INSUFFICIENT_EVIDENCE` means opportunity, linked-outcome, baseline, or mathematical support cannot sustain evaluation. `OBSERVING` means sufficient evaluation exists but at least one baseline, calibration, stability, or segment gate has not passed. `ELIGIBLE_FOR_FOUNDER_REVIEW` requires every computed gate and two consecutive chronological windows to pass. It never activates or authorizes recommendations.

Rollback removes or disables only this Intelligence consumer and its artifacts. No production rollback is needed because recommendation influence remains OFF.

The verifier checks protected SHA-256 baselines for Dashboard source and deploy mirror, Worker, route generation, Discovery, Nearby, Active Pool, runtime pools, business hours, and route scoring. These files are never written by this subsystem.
