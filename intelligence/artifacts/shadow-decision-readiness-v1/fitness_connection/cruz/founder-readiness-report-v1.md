# Route IQ Shadow Decision Readiness

Batch: BATCH-20260713-001

State: INSUFFICIENT_EVIDENCE

Recommendation influence: OFF. ELIGIBLE_FOR_FOUNDER_REVIEW does not authorize activation.

Exact reasons: no_eligible_shadow_decisions_with_historically_frozen_prospective_context, evaluation_sample_below_required_97, baseline_training_sample_below_required_97, outcome_link_support_incomplete, chronologically_prior_observational_baseline_unavailable, consecutive_calibration_stability_windows_not_passing, segment_safety_not_demonstrated, observational_baseline_performance_not_met.

Canonical sample: 4 opportunities; 0 eligible shadow decisions; 4 explicit exclusions. Unavailable metrics remain null.

Baseline: Chronologically prior explicit binary outcomes for the selected candidate, requiring formula-derived support; observational only, with no counterfactual, causal, or uplift interpretation. Evaluation is observational only, with no causal or uplift claim.

Equations: ceil(z^2*p*(1-p)/margin^2); mean((selected_candidate_probability-observed_binary_outcome)^2); sum(supported_bin_share*abs(predicted_mean-observed_rate)); thresholded_selected_candidate_predictions/candidates_with_explicit_binary_outcomes; top_decision_equals_actual_action/known_actual_actions; absolute consecutive-window accuracy/Brier/ECE deltas; 0.5*sum(abs(window_distribution_t-window_distribution_t-1)); shadow_outcome_accuracy-prior_training_outcome_rate_baseline_accuracy.

Segment risks: unknown_segments_explicit, material_segment_failure_blocks_eligibility, canonical_prospective_context_absent.

Unresolved risks: no_eligible_shadow_decisions_with_historically_frozen_prospective_context, evaluation_sample_below_required_97, baseline_training_sample_below_required_97, outcome_link_support_incomplete, chronologically_prior_observational_baseline_unavailable, consecutive_calibration_stability_windows_not_passing, segment_safety_not_demonstrated, observational_baseline_performance_not_met.

Rollback: remove or disable only this Intelligence consumer and its artifacts; no production rollback is required because influence is OFF.
