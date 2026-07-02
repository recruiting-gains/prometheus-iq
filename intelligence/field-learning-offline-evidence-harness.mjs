import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { routeVisitOutcomes } from "../crm/crm-foundation.mjs";

export const offlineEvidenceHarnessVersion = "adaptive-field-learning-offline-evidence-harness-v1";

const intelligenceRoot = import.meta.dirname;
const repoRoot = resolve(intelligenceRoot, "..");
const contractPath = "intelligence/contracts/field-learning-loop-contracts.json";
const defaultFixturePath = "intelligence/fixtures/field-visit-evidence-fixtures.json";
const policyVersion = "field-learning-offline-policy-v1";
const baselineConfidenceScore = 0.25;

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

function iso(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid field learning date: ${value}`);
  return date.toISOString();
}

function confidenceBand(score, blocked) {
  if (blocked) return "blocked";
  if (score < 0.3) return "insufficient_evidence";
  if (score < 0.45) return "low";
  if (score < 0.6) return "developing";
  if (score < 0.8) return "medium";
  return "high";
}

function normalizedEvidenceFields(contract, fixture) {
  const raw = fixture.evidenceFields || {};
  return contract.evidenceFields.reduce((fields, field) => {
    if (field === "date_time") fields[field] = raw[field] || fixture.visitOccurredAt;
    else if (field === "photos_future") fields[field] = raw[field] || [];
    else if (field === "customer_objections") fields[field] = raw[field] || [];
    else if (field === "notes") fields[field] = raw[field] || fixture.notes || "";
    else fields[field] = Boolean(raw[field]);
    return fields;
  }, {});
}

function ensureRequiredFields(object, fields, label) {
  return fields.filter(field => object[field] === undefined || object[field] === null || object[field] === "");
}

function sourceAllowed(contract, sourceSubsystem) {
  return contract.contracts.FieldEvidenceEvent.allowedSourceSubsystems.includes(sourceSubsystem);
}

function truthLevelAllowed(contract, truthLevel) {
  return contract.truthLevels.includes(truthLevel);
}

export function loadFieldLearningContracts() {
  return readJson(contractPath);
}

export function loadFieldVisitFixtures(path = defaultFixturePath) {
  return readJson(path);
}

export function createHumanOverride(fixture, contract = loadFieldLearningContracts()) {
  if (!fixture.humanOverride) return null;
  const override = {
    overrideId: stableId("field_override", [fixture.scenarioId, fixture.humanOverride.overrideType, fixture.businessRef?.businessId]),
    targetRef: {
      businessId: fixture.businessRef?.businessId || "",
      googlePlaceId: fixture.businessRef?.googlePlaceId || ""
    },
    overrideType: fixture.humanOverride.overrideType,
    reason: fixture.humanOverride.reason,
    createdByRole: "founder",
    createdAt: iso(fixture.visitOccurredAt),
    expiresAt: "",
    reviewRequired: true,
    auditState: "active"
  };
  const allowed = contract.contracts.FieldHumanOverride.overrideTypes.includes(override.overrideType);
  return { ...override, valid: allowed };
}

export function normalizeFixtureToEvidence(fixture, contract = loadFieldLearningContracts()) {
  const evidence = {
    evidenceId: stableId("field_evidence", [fixture.scenarioId, fixture.sourceRecordId, fixture.visitOccurredAt]),
    contractVersion: contract.version,
    sourceSubsystem: fixture.sourceSubsystem,
    sourceRecordId: fixture.sourceRecordId,
    businessRef: clone(fixture.businessRef || {}),
    repRef: clone(fixture.repRef || {}),
    territoryRef: clone(fixture.territoryRef || {}),
    visitOccurredAt: iso(fixture.visitOccurredAt),
    capturedAt: iso(fixture.visitOccurredAt),
    evidenceFields: normalizedEvidenceFields(contract, fixture),
    truthLevel: fixture.truthLevel || "unknown",
    sensitivity: "internal_field_evidence",
    reviewState: fixture.humanOverride ? "human_review_required" : "offline_validated",
    scenarioId: fixture.scenarioId,
    label: fixture.label,
    crmOutcome: fixture.crmOutcome || "",
    productionLearningActive: false
  };
  return evidence;
}

export function admitFieldEvidence(evidence, overrides = [], contract = loadFieldLearningContracts()) {
  const rejectionReasons = [];
  const admissionReasons = [];
  const requiredMissing = ensureRequiredFields(evidence, contract.contracts.FieldEvidenceEvent.requiredFields, "FieldEvidenceEvent");
  if (requiredMissing.length) rejectionReasons.push(`missing_required_fields=${requiredMissing.join(",")}`);
  if (!sourceAllowed(contract, evidence.sourceSubsystem)) rejectionReasons.push("source_subsystem_not_allowed");
  if (!truthLevelAllowed(contract, evidence.truthLevel)) rejectionReasons.push("truth_level_not_allowed");
  if (!evidence.businessRef?.businessId && !evidence.businessRef?.googlePlaceId) rejectionReasons.push("missing_business_reference");
  if (!evidence.repRef?.repId) rejectionReasons.push("missing_rep_reference");
  if (evidence.crmOutcome && !routeVisitOutcomes[evidence.crmOutcome]) rejectionReasons.push("crm_outcome_not_supported");

  const matchingOverrides = overrides.filter(override => {
    return override?.targetRef?.businessId === evidence.businessRef?.businessId
      || override?.targetRef?.googlePlaceId === evidence.businessRef?.googlePlaceId;
  });
  const hasBlockingOverride = matchingOverrides.some(override => [
    "suppress_evidence",
    "mark_wrong_business",
    "mark_closed_business",
    "mark_duplicate_business",
    "freeze_learning_influence"
  ].includes(override.overrideType));

  if (evidence.evidenceFields.closed_business) admissionReasons.push("closed_business_evidence_requires_review");
  if (evidence.evidenceFields.wrong_business) admissionReasons.push("wrong_business_evidence_requires_review");
  if (evidence.evidenceFields.duplicate) admissionReasons.push("duplicate_evidence_requires_review");
  if (matchingOverrides.length) admissionReasons.push("human_override_attached");

  let admissionStatus = "admitted";
  if (rejectionReasons.length) admissionStatus = "rejected";
  else if (hasBlockingOverride) admissionStatus = "admitted_with_review";
  else if (admissionReasons.length) admissionStatus = "admitted_with_review";

  return {
    decisionId: stableId("field_admission", [evidence.evidenceId, admissionStatus, matchingOverrides.map(override => override.overrideId)]),
    evidenceId: evidence.evidenceId,
    admissionStatus,
    admissionReasons,
    rejectionReasons,
    policyVersion,
    reviewRequired: admissionStatus !== "admitted",
    decidedAt: evidence.capturedAt,
    humanOverrideIds: matchingOverrides.map(override => override.overrideId),
    allowedForOfflineLearning: rejectionReasons.length === 0,
    productionLearningActive: false
  };
}

function signalTemplate(evidence, family, measurements, options = {}) {
  const blocked = options.allowedInfluence === "blocked_by_human_override";
  return {
    signalId: stableId("field_signal", [evidence.evidenceId, family, measurements]),
    sourceEvidenceIds: [evidence.evidenceId],
    signalFamily: family,
    businessRef: clone(evidence.businessRef),
    territoryRef: clone(evidence.territoryRef),
    repRef: clone(evidence.repRef),
    measurements,
    confidenceWeight: Number(options.confidenceWeight ?? 0.5),
    truthLevel: evidence.truthLevel,
    learningTrend: options.learningTrend || "new",
    allowedInfluence: blocked ? "blocked_by_human_override" : "offline_validation_only",
    policyVersion,
    reviewState: options.reviewState || evidence.reviewState,
    productionLearningActive: false
  };
}

export function normalizeLearningSignals(evidence, admissionDecision, overrides = []) {
  if (!admissionDecision.allowedForOfflineLearning) return [];
  const fields = evidence.evidenceFields;
  const hasOverride = overrides.some(override => admissionDecision.humanOverrideIds.includes(override.overrideId));
  const blockedInfluence = hasOverride ? "blocked_by_human_override" : "offline_validation_only";
  const common = {
    allowedInfluence: blockedInfluence,
    reviewState: admissionDecision.reviewRequired ? "human_review_required" : "offline_validated"
  };
  const signals = [];

  if (fields.business_visited) {
    signals.push(signalTemplate(evidence, "visit_completion", { visited: true, gpsConfirmed: Boolean(fields.gps_confirmation) }, { ...common, confidenceWeight: fields.gps_confirmation ? 0.75 : 0.45, learningTrend: "new" }));
  }
  if (fields.decision_maker_reached) {
    signals.push(signalTemplate(evidence, "contact_quality", { decisionMakerReached: true }, { ...common, confidenceWeight: 0.75, learningTrend: "improving" }));
  }
  if (fields.conversation_occurred) {
    signals.push(signalTemplate(evidence, "conversation_quality", { conversationOccurred: true, gatekeeper: Boolean(fields.gatekeeper) }, { ...common, confidenceWeight: fields.gatekeeper ? 0.5 : 0.7, learningTrend: fields.gatekeeper ? "stable" : "improving" }));
  }
  if (fields.sale_made || evidence.crmOutcome === "proposal_requested" || evidence.label === "High-value opportunity") {
    signals.push(signalTemplate(evidence, "conversion_outcome", { saleMade: Boolean(fields.sale_made), crmOutcome: evidence.crmOutcome }, { ...common, confidenceWeight: fields.sale_made ? 0.9 : 0.72, learningTrend: "improving" }));
  }
  if (fields.no_decision_maker || fields.no_parking || fields.gatekeeper) {
    signals.push(signalTemplate(evidence, "access_barrier", { noDecisionMaker: Boolean(fields.no_decision_maker), noParking: Boolean(fields.no_parking), gatekeeper: Boolean(fields.gatekeeper) }, { ...common, confidenceWeight: 0.55, learningTrend: "stable" }));
  }
  if (fields.closed_business || fields.wrong_business) {
    signals.push(signalTemplate(evidence, "location_validity", { closedBusiness: Boolean(fields.closed_business), wrongBusiness: Boolean(fields.wrong_business) }, { ...common, confidenceWeight: 0.85, learningTrend: "blocked" }));
  }
  if (fields.duplicate) {
    signals.push(signalTemplate(evidence, "duplicate_risk", { duplicate: true }, { ...common, confidenceWeight: 0.85, learningTrend: "blocked" }));
  }
  if (fields.follow_up_needed) {
    signals.push(signalTemplate(evidence, "follow_up_need", { followUpNeeded: true }, { ...common, confidenceWeight: 0.65, learningTrend: "stable" }));
  }
  if (fields.competitor_present) {
    signals.push(signalTemplate(evidence, "competitor_signal", { competitorPresent: true }, { ...common, confidenceWeight: 0.6, learningTrend: "conflicting" }));
  }
  if (Array.isArray(fields.customer_objections) && fields.customer_objections.length) {
    signals.push(signalTemplate(evidence, "objection_signal", { objections: fields.customer_objections }, { ...common, confidenceWeight: 0.62, learningTrend: "stable" }));
  }
  if (fields.closed_business || fields.wrong_business || evidence.label === "Bad lead") {
    signals.push(signalTemplate(evidence, "evidence_quality", { badLead: evidence.label === "Bad lead", closedBusiness: Boolean(fields.closed_business), wrongBusiness: Boolean(fields.wrong_business) }, { ...common, confidenceWeight: 0.82, learningTrend: "blocked" }));
  }
  if (hasOverride || admissionDecision.reviewRequired) {
    signals.push(signalTemplate(evidence, "human_review", { reviewRequired: true, overrideIds: admissionDecision.humanOverrideIds }, { ...common, confidenceWeight: 1, learningTrend: "blocked" }));
  }

  return signals;
}

export function buildConfidenceSnapshot(evidence, signals, stage = "after") {
  const blocked = signals.some(signal => signal.allowedInfluence === "blocked_by_human_override")
    || signals.some(signal => ["location_validity", "duplicate_risk", "evidence_quality", "human_review"].includes(signal.signalFamily) && signal.learningTrend === "blocked");
  const positiveWeights = signals
    .filter(signal => ["contact_quality", "conversation_quality", "conversion_outcome", "follow_up_need"].includes(signal.signalFamily))
    .reduce((sum, signal) => sum + Number(signal.confidenceWeight || 0), 0);
  const negativeWeights = signals
    .filter(signal => ["location_validity", "duplicate_risk", "evidence_quality"].includes(signal.signalFamily))
    .reduce((sum, signal) => sum + Number(signal.confidenceWeight || 0), 0);
  const rawAfterScore = Math.max(0, Math.min(0.95, baselineConfidenceScore + positiveWeights * 0.18 - negativeWeights * 0.22));
  const confidenceScore = stage === "before" ? baselineConfidenceScore : (blocked ? 0 : Number(rawAfterScore.toFixed(2)));
  const hasConflictingSignal = signals.some(signal => signal.learningTrend === "conflicting");
  const hasObjectionSignal = signals.some(signal => signal.signalFamily === "objection_signal");
  const hasImprovingSignal = signals.some(signal => signal.learningTrend === "improving");
  const learningTrend = stage === "before"
    ? "new"
    : (blocked ? "blocked" : hasConflictingSignal ? "conflicting" : hasObjectionSignal ? "stable" : hasImprovingSignal ? "improving" : "stable");

  return {
    confidenceId: stableId("field_confidence", [evidence.evidenceId, stage, confidenceScore, learningTrend]),
    targetRef: clone(evidence.businessRef),
    stage,
    confidenceBand: confidenceBand(confidenceScore, blocked && stage !== "before"),
    confidenceScore,
    evidenceCount: stage === "before" ? 0 : 1,
    lastValidationAt: stage === "before" ? "" : evidence.visitOccurredAt,
    learningTrend,
    supportingEvidenceIds: stage === "before" ? [] : [evidence.evidenceId],
    limitingFactors: blocked && stage !== "before" ? ["human_or_validity_review_required"] : signals.filter(signal => ["access_barrier", "competitor_signal", "objection_signal"].includes(signal.signalFamily)).map(signal => signal.signalFamily),
    allowedInfluence: stage === "before" ? "none" : (blocked ? "review_only" : "offline_validation_only"),
    reviewState: blocked && stage !== "before" ? "human_review_required" : "offline_validated",
    policyVersion,
    productionLearningActive: false
  };
}

export function buildRecommendationExplanation(evidence, admissionDecision, signals, confidenceBefore, confidenceAfter) {
  const families = signals.map(signal => signal.signalFamily);
  const evidenceSummary = Object.entries(evidence.evidenceFields)
    .filter(([, value]) => Array.isArray(value) ? value.length : Boolean(value))
    .map(([key]) => key);
  return {
    explanationId: stableId("field_explanation", [evidence.evidenceId, families, confidenceAfter.confidenceScore]),
    recommendationRef: {
      businessId: evidence.businessRef.businessId || "",
      googlePlaceId: evidence.businessRef.googlePlaceId || "",
      offlineOnly: true
    },
    why: `${evidence.label} produced ${families.join(", ")} signal(s) for future review.`,
    whatEvidence: evidenceSummary,
    howConfident: {
      before: confidenceBefore.confidenceBand,
      after: confidenceAfter.confidenceBand,
      scoreDelta: Number((confidenceAfter.confidenceScore - confidenceBefore.confidenceScore).toFixed(2)),
      evidenceCount: confidenceAfter.evidenceCount
    },
    whatChanged: confidenceAfter.learningTrend === "blocked"
      ? "Evidence requires review before any future recommendation influence."
      : `Offline confidence moved from ${confidenceBefore.confidenceBand} to ${confidenceAfter.confidenceBand}.`,
    whatWasLearned: families.length ? `Observed ${families.join(", ")}.` : "No learning signal admitted.",
    nextRepBehavior: nextRepBehaviorForSignals(signals),
    uncertainties: admissionDecision.reviewRequired ? admissionDecision.admissionReasons : [],
    reviewState: confidenceAfter.reviewState,
    policyVersion,
    productionLearningActive: false
  };
}

function nextRepBehaviorForSignals(signals) {
  const families = new Set(signals.map(signal => signal.signalFamily));
  if (families.has("duplicate_risk")) return "Do not revisit until founder review resolves duplicate status.";
  if (families.has("location_validity")) return "Do not rely on this candidate until validity is reviewed.";
  if (families.has("conversion_outcome")) return "Prioritize follow-through and capture next account step.";
  if (families.has("follow_up_need")) return "Schedule the requested follow-up window before another cold visit.";
  if (families.has("access_barrier")) return "Use the learned access window or ask-for guidance next time.";
  if (families.has("objection_signal")) return "Bring proof and objection-specific collateral on the next visit.";
  if (families.has("competitor_signal")) return "Prepare competitive differentiation before the next contact.";
  return "Keep this evidence in review until more field outcomes accumulate.";
}

function validateScenarioResult(result, fixture) {
  const failures = [];
  const signalFamilies = result.signals.map(signal => signal.signalFamily);
  for (const family of fixture.expectedSignalFamilies || []) {
    if (!signalFamilies.includes(family)) failures.push(`${fixture.scenarioId}: missing_expected_signal=${family}`);
  }
  for (const key of ["why", "whatEvidence", "howConfident", "whatChanged"]) {
    if (!result.explanation[key] || (Array.isArray(result.explanation[key]) && !result.explanation[key].length)) {
      failures.push(`${fixture.scenarioId}: missing_explanation_${key}`);
    }
  }
  if (fixture.expectedTrend && result.confidenceAfter.learningTrend !== fixture.expectedTrend) {
    failures.push(`${fixture.scenarioId}: expected_trend=${fixture.expectedTrend}, actual=${result.confidenceAfter.learningTrend}`);
  }
  if (fixture.humanOverride) {
    const overrideBlocked = result.signals.every(signal => signal.allowedInfluence === "blocked_by_human_override")
      && result.confidenceAfter.allowedInfluence === "review_only";
    if (!overrideBlocked) failures.push(`${fixture.scenarioId}: human_override_did_not_block_learning_influence`);
  }
  if (result.evidence.productionLearningActive !== false || result.confidenceAfter.productionLearningActive !== false) {
    failures.push(`${fixture.scenarioId}: production_learning_flag_not_false`);
  }
  return failures;
}

export function runOfflineEvidenceHarness(options = {}) {
  const contract = options.contract || loadFieldLearningContracts();
  const fixtures = options.fixtures || loadFieldVisitFixtures();
  const scenarioResults = [];
  const failureReasons = [];

  for (const fixture of fixtures.scenarios || []) {
    const override = createHumanOverride(fixture, contract);
    if (override && !override.valid) failureReasons.push(`${fixture.scenarioId}: invalid_human_override_type=${override.overrideType}`);
    const overrides = override ? [override] : [];
    const evidence = normalizeFixtureToEvidence(fixture, contract);
    const admissionDecision = admitFieldEvidence(evidence, overrides, contract);
    const signals = normalizeLearningSignals(evidence, admissionDecision, overrides);
    const confidenceBefore = buildConfidenceSnapshot(evidence, [], "before");
    const confidenceAfter = buildConfidenceSnapshot(evidence, signals, "after");
    const explanation = buildRecommendationExplanation(evidence, admissionDecision, signals, confidenceBefore, confidenceAfter);
    const scenarioResult = {
      scenarioId: fixture.scenarioId,
      label: fixture.label,
      crmOutcome: fixture.crmOutcome || "",
      evidence,
      admissionDecision,
      humanOverride: override,
      signals,
      confidenceBefore,
      confidenceAfter,
      explanation
    };
    failureReasons.push(...validateScenarioResult(scenarioResult, fixture));
    scenarioResults.push(scenarioResult);
  }

  const evidenceCount = scenarioResults.length;
  const signalCount = scenarioResults.reduce((sum, result) => sum + result.signals.length, 0);
  const humanOverrideScenarios = scenarioResults.filter(result => result.humanOverride).length;
  const blockedOverrideScenarios = scenarioResults.filter(result => result.humanOverride && result.confidenceAfter.allowedInfluence === "review_only").length;
  const contractSafetyFailures = [
    ["productionBehaviorChanged", false],
    ["scoringChanged", false],
    ["dashboardRuntimeChanged", false],
    ["activePoolChanged", false],
    ["dataGovernanceChanged", false],
    ["infrastructureChanged", false],
    ["anthonyBetaChanged", false],
    ["productionLearningActive", false]
  ].filter(([key, expected]) => contract[key] !== expected);
  for (const [key] of contractSafetyFailures) failureReasons.push(`contract_safety_flag_not_false=${key}`);

  return {
    status: failureReasons.length ? "failed" : "passed",
    harnessVersion: offlineEvidenceHarnessVersion,
    fixtureVersion: fixtures.version,
    contractVersion: contract.version,
    productionSafety: {
      productionLearningActive: false,
      productionRecommendationChanges: false,
      dashboardRuntimeChanges: false,
      activePoolChanges: false,
      routeScoringChanges: false,
      crmMutations: false
    },
    summary: {
      fixtureCount: fixtures.scenarios?.length || 0,
      evidenceCount,
      signalCount,
      confidenceSnapshots: evidenceCount * 2,
      explanations: scenarioResults.length,
      humanOverrideScenarios,
      blockedOverrideScenarios
    },
    scenarioResults,
    failureReasons
  };
}
