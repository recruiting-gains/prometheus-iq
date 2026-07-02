import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const recommendationExplainabilityVersion = "recommendation-explainability-engine-v1";

const repoRoot = resolve(import.meta.dirname, "..");
const contractPath = "intelligence/contracts/recommendation-explainability-contracts.json";

function readJson(path) {
  return JSON.parse(readFileSync(resolve(repoRoot, path), "utf8"));
}

function stableId(prefix, value) {
  const digest = createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex").slice(0, 16);
  return `${prefix}_${digest}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function asPercent(score) {
  const value = Number(score);
  if (!Number.isFinite(value)) return "Unknown confidence";
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}

function businessName(input) {
  return input?.recommendation?.name
    || input?.evidence?.businessRef?.name
    || input?.confidence?.targetRef?.name
    || "This business";
}

function signalFamilies(input) {
  return new Set((input.signals || []).map(signal => signal.signalFamily));
}

function hasAny(families, values) {
  return values.some(value => families.has(value));
}

function confidenceDisplay(confidence = {}) {
  return {
    label: confidence.confidenceBand || "unknown",
    display: asPercent(confidence.confidenceScore),
    evidenceCount: Number(confidence.evidenceCount || 0),
    trend: confidence.learningTrend || "unknown",
    lastValidationAt: confidence.lastValidationAt || "",
    reviewState: confidence.reviewState || "unknown"
  };
}

function factor(id, label, reason, evidenceRefs = [], strength = "supporting") {
  return {
    id,
    label,
    reason,
    evidenceRefs,
    strength
  };
}

function locationFactors(input, families) {
  const factors = [];
  const name = businessName(input);
  if (input.location?.territoryQuality) {
    factors.push(factor("territory_quality", "Territory quality", `${name} sits in a territory that currently has usable field context for review.`, input.location.evidenceRefs || []));
  }
  if (input.location?.coverageGap) {
    factors.push(factor("coverage_gap", "Coverage gap", "No recent verified visit is attached to this target, so the recommendation can help close a coverage gap.", input.location.evidenceRefs || []));
  }
  if (input.route?.travelEfficient) {
    factors.push(factor("travel_efficiency", "Travel efficiency", "It fits the current route without forcing an inefficient detour.", input.route.evidenceRefs || []));
  }
  if (!factors.length) {
    factors.push(factor("location_context_limited", "Location context", "Location evidence is limited, so this should be treated as a cautious explanation.", [], "limiting"));
  }
  return {
    group: "location_intelligence",
    label: "Location Intelligence",
    factors
  };
}

function businessFactors(input, families) {
  const factors = [];
  const name = businessName(input);
  if (hasAny(families, ["conversion_outcome", "conversation_quality", "contact_quality"])) {
    factors.push(factor("similar_business_performance", "Similar business performance", `${name} has signals that resemble useful field conversations or conversion activity.`, collectEvidenceIds(input, ["conversion_outcome", "conversation_quality", "contact_quality"])));
  }
  if (input.business?.categoryStrength) {
    factors.push(factor("category_strength", "Category strength", "This category has enough positive context to remain worth founder or rep attention.", input.business.evidenceRefs || []));
  }
  if (input.business?.opportunityLevel === "high") {
    factors.push(factor("opportunity_level", "Opportunity level", "The visit context points to a higher-value opportunity than a routine cold stop.", input.business.evidenceRefs || []));
  }
  if (hasAny(families, ["objection_signal"])) {
    factors.push(factor("objection_context", "Customer objection", "The business raised an objection that can be prepared for instead of ignored.", collectEvidenceIds(input, ["objection_signal"]), "mixed"));
  }
  if (!factors.length) {
    factors.push(factor("business_context_limited", "Business context", "Business-specific evidence is still thin and should not be overstated.", [], "limiting"));
  }
  return {
    group: "business_intelligence",
    label: "Business Intelligence",
    factors
  };
}

function historicalFactors(input, families) {
  const factors = [];
  if (input.history?.previousVisits === 0 || input.location?.coverageGap) {
    factors.push(factor("no_recent_visit", "No recent verified visit", "No verified recent visit is attached, so the next visit can create new field evidence.", input.history?.evidenceRefs || []));
  }
  if (hasAny(families, ["visit_completion"])) {
    factors.push(factor("field_visit_recorded", "Visit evidence", "A field visit has been normalized into evidence for future review.", collectEvidenceIds(input, ["visit_completion"])));
  }
  if (hasAny(families, ["human_review", "duplicate_risk", "location_validity"])) {
    factors.push(factor("review_history", "Review history", "The historical record includes a review-sensitive signal that should be resolved before influence increases.", collectEvidenceIds(input, ["human_review", "duplicate_risk", "location_validity"]), "limiting"));
  }
  if (!factors.length) {
    factors.push(factor("history_limited", "Historical context", "Historical evidence is limited for this recommendation.", [], "limiting"));
  }
  return {
    group: "historical_intelligence",
    label: "Historical Intelligence",
    factors
  };
}

function routeFactors(input, families) {
  const factors = [];
  if (input.route?.routeOptimized) {
    factors.push(factor("route_optimization", "Route optimization", "The stop can be explained as part of a coherent route sequence.", input.route.evidenceRefs || []));
  }
  if (input.route?.nearbyOpportunities) {
    factors.push(factor("nearby_opportunities", "Nearby opportunities", "Nearby context suggests this stop may pair well with other field opportunities.", input.route.evidenceRefs || []));
  }
  if (input.route?.clusterQuality) {
    factors.push(factor("cluster_quality", "Cluster quality", "The surrounding cluster is strong enough to support a planned field pass.", input.route.evidenceRefs || []));
  }
  if (!factors.length) {
    factors.push(factor("route_context_limited", "Route context", "Route-specific context is available only as a future explanation input.", [], "limiting"));
  }
  return {
    group: "route_intelligence",
    label: "Route Intelligence",
    factors
  };
}

function learningFactors(input, families) {
  const factors = [];
  const confidence = input.confidence || {};
  if (confidence.learningTrend) {
    factors.push(factor("confidence_trend", "Confidence trend", `Current confidence is ${asPercent(confidence.confidenceScore)} and the learning trend is ${humanize(confidence.learningTrend)}.`, confidence.supportingEvidenceIds || []));
  }
  if (confidence.evidenceCount !== undefined) {
    factors.push(factor("evidence_quality", "Evidence quality", `${Number(confidence.evidenceCount || 0)} evidence item(s) currently support this explanation.`, confidence.supportingEvidenceIds || []));
  }
  if (hasAny(families, ["human_review"]) || confidence.allowedInfluence === "review_only") {
    factors.push(factor("human_override", "Human review", "A human review or override state limits how much this learning can influence future recommendations.", collectEvidenceIds(input, ["human_review"]), "limiting"));
  }
  return {
    group: "learning_intelligence",
    label: "Learning Intelligence",
    factors
  };
}

function collectEvidenceIds(input, families) {
  const wanted = new Set(families);
  return [...new Set((input.signals || [])
    .filter(signal => wanted.has(signal.signalFamily))
    .flatMap(signal => signal.sourceEvidenceIds || []))];
}

function humanize(value) {
  return String(value || "unknown").replace(/_/g, " ");
}

function naturalSummary(name, factorGroups, confidence) {
  const topFactors = factorGroups
    .flatMap(group => group.factors)
    .filter(item => item.strength !== "limiting")
    .slice(0, 5)
    .map(item => item.reason);
  const intro = `${name} is explainable because Prometheus can connect the recommendation to field, route, business, and learning context.`;
  const bullets = topFactors.length ? topFactors : ["The available evidence is still thin, so this recommendation should remain cautious."];
  return [
    intro,
    "Key reasons:",
    ...bullets.map(reason => `- ${reason}`),
    `Current confidence: ${asPercent(confidence.confidenceScore)}.`
  ].join("\n");
}

function answers(input, factorGroups) {
  const name = businessName(input);
  const confidence = confidenceDisplay(input.confidence);
  const evidenceRefs = [...new Set(factorGroups.flatMap(group => group.factors.flatMap(item => item.evidenceRefs || [])))];
  const reviewRequired = input.confidence?.reviewState === "human_review_required" || input.confidence?.allowedInfluence === "review_only";
  return {
    why: `${name} is recommended because the available context shows explainable location, business, route, history, or learning reasons that can be reviewed by a human.`,
    howConfident: `Current confidence is ${confidence.display} with a ${humanize(confidence.label)} confidence band.`,
    whatEvidenceSupportsIt: evidenceRefs.length
      ? `Supporting evidence references: ${evidenceRefs.join(", ")}.`
      : "Supporting evidence is limited; treat this as a cautious recommendation explanation.",
    whatChanged: input.confidence?.learningTrend
      ? `The current learning trend is ${humanize(input.confidence.learningTrend)}.`
      : "No meaningful learning change has been recorded yet.",
    whatShouldIDoNext: reviewRequired
      ? "Review the evidence before allowing this learning to influence future recommendations."
      : nextAction(input)
  };
}

function nextAction(input) {
  const families = signalFamilies(input);
  if (families.has("follow_up_need")) return "Follow up in the requested window and capture the outcome.";
  if (families.has("conversion_outcome")) return "Prioritize the next account step and preserve the evidence trail.";
  if (families.has("objection_signal")) return "Prepare proof, ROI, or objection-specific material before the next touch.";
  if (families.has("competitor_signal")) return "Prepare competitive differentiation before returning.";
  if (families.has("access_barrier")) return "Use the learned access window or ask-for guidance on the next attempt.";
  return "Visit, verify, and capture the outcome so the recommendation can become more evidence-backed.";
}

function factorBullets(factorGroups) {
  return factorGroups
    .flatMap(group => group.factors.map(item => `${group.label}: ${item.reason}`))
    .slice(0, 7);
}

export function loadRecommendationExplainabilityContracts() {
  return readJson(contractPath);
}

export function buildRecommendationExplanationV1(input, options = {}) {
  const contract = options.contract || loadRecommendationExplainabilityContracts();
  const families = signalFamilies(input);
  const name = businessName(input);
  const factorGroups = [
    locationFactors(input, families),
    businessFactors(input, families),
    historicalFactors(input, families),
    routeFactors(input, families),
    learningFactors(input, families)
  ];
  const answerSet = answers(input, factorGroups);
  const confidence = confidenceDisplay(input.confidence);
  const explanation = {
    explanationId: stableId("rec_explanation", [recommendationExplainabilityVersion, input.recommendationRef || input.evidence?.evidenceId || input.confidence?.confidenceId, input.consumer || "shared"]),
    contractVersion: contract.version,
    recommendationRef: clone(input.recommendationRef || {
      businessId: input.evidence?.businessRef?.businessId || "",
      googlePlaceId: input.evidence?.businessRef?.googlePlaceId || "",
      offlineOnly: true
    }),
    headline: `Why ${name}?`,
    summary: naturalSummary(name, factorGroups, input.confidence || {}),
    answers: answerSet,
    factorGroups,
    evidenceSummary: {
      evidenceIds: [...new Set(factorGroups.flatMap(group => group.factors.flatMap(item => item.evidenceRefs || [])))],
      evidenceCount: confidence.evidenceCount,
      lastValidationAt: confidence.lastValidationAt,
      reviewState: confidence.reviewState
    },
    confidenceDisplay: confidence,
    nextAction: answerSet.whatShouldIDoNext,
    reviewState: confidence.reviewState,
    safety: {
      formulasExposed: false,
      proprietaryWeightsExposed: false,
      productionRecommendationChanged: false,
      dashboardRuntimeChanged: false,
      scoringChanged: false
    }
  };
  return explanation;
}

export function buildConsumerExplanationContract(explanation, consumer) {
  const supported = ["Mobile", "Dashboard", "Companion"];
  if (!supported.includes(consumer)) throw new Error(`Unsupported explanation consumer: ${consumer}`);
  const base = {
    contractVersion: explanation.contractVersion,
    consumer,
    recommendationRef: clone(explanation.recommendationRef),
    headline: explanation.headline,
    summary: explanation.summary,
    confidenceDisplay: clone(explanation.confidenceDisplay),
    nextAction: explanation.nextAction,
    reviewState: explanation.reviewState
  };
  if (consumer === "Mobile") {
    return {
      ...base,
      factorBullets: factorBullets(explanation.factorGroups)
    };
  }
  if (consumer === "Dashboard") {
    return {
      ...base,
      factorGroups: clone(explanation.factorGroups),
      evidenceSummary: clone(explanation.evidenceSummary),
      whatChanged: explanation.answers.whatChanged
    };
  }
  return {
    ...base,
    factorGroups: clone(explanation.factorGroups),
    evidenceSummary: clone(explanation.evidenceSummary),
    whatChanged: explanation.answers.whatChanged,
    founderReviewNotes: explanation.reviewState === "human_review_required"
      ? "Founder review is required before this learning can influence future recommendations."
      : "Explanation is available for founder review without changing production behavior."
  };
}

export function validateRecommendationExplanation(explanation, contract = loadRecommendationExplainabilityContracts()) {
  const failures = [];
  for (const field of contract.explanationContract.requiredFields) {
    if (explanation[field] === undefined || explanation[field] === null || explanation[field] === "") {
      failures.push(`missing_explanation_field=${field}`);
    }
  }
  for (const question of contract.requiredQuestions) {
    const map = {
      why: "why",
      how_confident: "howConfident",
      what_evidence_supports_it: "whatEvidenceSupportsIt",
      what_changed: "whatChanged",
      what_should_i_do_next: "whatShouldIDoNext"
    };
    if (!explanation.answers?.[map[question]]) failures.push(`missing_answer=${question}`);
  }
  for (const group of contract.factorGroups) {
    if (!explanation.factorGroups?.some(item => item.group === group)) failures.push(`missing_factor_group=${group}`);
  }
  const publicText = [
    explanation.headline,
    explanation.summary,
    ...Object.values(explanation.answers || {}),
    ...(explanation.factorGroups || []).flatMap(group => (group.factors || []).map(item => `${item.label} ${item.reason}`))
  ].join("\n");
  if (/\bweight(?:ed|s)?\b|formula|coefficient|multiplier|scoring recipe/i.test(publicText)) {
    failures.push("proprietary_scoring_language_exposed");
  }
  if (explanation.safety?.formulasExposed !== false) failures.push("formula_safety_flag_not_false");
  if (explanation.safety?.proprietaryWeightsExposed !== false) failures.push("weight_safety_flag_not_false");
  if (explanation.safety?.productionRecommendationChanged !== false) failures.push("production_recommendation_change_flag_not_false");
  return failures;
}

export function validateConsumerExplanationContract(payload, consumer, contract = loadRecommendationExplainabilityContracts()) {
  const key = `${consumer}RecommendationExplanation`;
  const required = contract.consumerContracts[key]?.requiredFields || [];
  const failures = [];
  for (const field of required) {
    if (payload[field] === undefined || payload[field] === null || payload[field] === "") {
      failures.push(`${consumer}: missing_consumer_field=${field}`);
    }
  }
  if (payload.consumer !== consumer) failures.push(`${consumer}: wrong_consumer=${payload.consumer}`);
  return failures;
}
