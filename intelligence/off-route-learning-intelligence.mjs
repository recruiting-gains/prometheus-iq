import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadCanonicalArchivedFieldSessionPackages,
  loadReadOnlyFieldSessionDataContract,
  loadReadOnlyFieldSessionLearningContract,
  loadReadOnlyFieldSessionLearningPolicy,
  validateArchivedFieldSessionPackage,
  validateReadOnlyFieldSessionLearningContract,
  validateReadOnlyFieldSessionLearningPolicy
} from "./read-only-field-session-learning.mjs";

export const offRouteLearningIntelligenceVersion = "off-route-learning-intelligence-v1";
export const offRouteLearningWorkspaceId = "fitness_connection";
export const offRouteLearningOperatingProfileId = "fitness";

const moduleDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(moduleDir, "..");

export class OffRouteLearningIntelligenceError extends Error {
  constructor(message, code = "off_route_learning_error", details = {}) {
    super(message);
    this.name = "OffRouteLearningIntelligenceError";
    this.code = code;
    this.details = details;
  }
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(resolve(repoRoot, relativePath), "utf8"));
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function stableHash(value) {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

function stableId(prefix, value) {
  return `${prefix}-${stableHash(value).slice(0, 20)}`;
}

function cleanText(value, maximum = 500) {
  return String(value ?? "").trim().slice(0, maximum);
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function nullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value, digits = 4) {
  const scale = 10 ** digits;
  return Math.round(finiteNumber(value) * scale) / scale;
}

function percentage(numerator, denominator) {
  if (finiteNumber(denominator) <= 0) return null;
  return round((finiteNumber(numerator) / finiteNumber(denominator)) * 100, 2);
}

function maximumIso(values = []) {
  return values
    .map(value => ({ value, time: new Date(value).getTime() }))
    .filter(item => item.value && Number.isFinite(item.time))
    .sort((left, right) => right.time - left.time)[0]?.value || "";
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function confidenceBand(score, policy, hasKnownEvidence) {
  if (!hasKnownEvidence) return "insufficient_evidence";
  let selected = "insufficient_evidence";
  for (const band of [...policy.confidenceModel.bands].sort((left, right) => Number(left.minimum) - Number(right.minimum))) {
    if (score >= Number(band.minimum)) selected = band.band;
  }
  return selected;
}

function sourceIndex(policy) {
  const byId = new Map();
  const byAlias = new Map();
  for (const source of policy.sourceTaxonomy || []) {
    byId.set(source.sourceId, source);
    for (const alias of source.aliases || []) byAlias.set(cleanText(alias, 100).toLowerCase(), source.sourceId);
  }
  return { byId, byAlias };
}

function normalizeSourceId(value, policy) {
  const { byId, byAlias } = sourceIndex(policy);
  const raw = cleanText(value, 100);
  if (byId.has(raw)) return raw;
  return byAlias.get(raw.toLowerCase()) || null;
}

function unknownSource(record, policy, reasonCode, reason, rawSourceId = null) {
  const unknown = sourceIndex(policy).byId.get("unknown");
  const sourceRecordId = `${cleanText(record.sessionId, 160) || "unknown-session"}:${cleanText(record.visitId, 160) || "unknown-visit"}`;
  return {
    sourceId: "unknown",
    sourceLabel: unknown.label,
    sourceClass: unknown.sourceClass,
    known: false,
    offRoute: null,
    representativeJudgment: false,
    reasonCode,
    reason,
    evidence: [{
      evidenceType: "visit_decision_source_availability",
      sourceRecordId,
      availability: "unavailable"
    }],
    confidence: {
      score: 0,
      band: "insufficient_evidence",
      basis: reasonCode
    },
    capturedAt: cleanText(record.visitOccurredAt, 50) || null,
    rawSourceId
  };
}

function normalizeKnownSource(record, policy) {
  const raw = record.visitDecisionSource;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return unknownSource(
      record,
      policy,
      "decision_source_not_recorded",
      "The canonical visit does not record why the representative selected this business."
    );
  }

  const normalizedId = normalizeSourceId(raw.sourceId, policy);
  const source = sourceIndex(policy).byId.get(normalizedId);
  if (!source || normalizedId === "unknown") {
    return unknownSource(
      record,
      policy,
      normalizedId === "unknown" ? "decision_source_explicitly_unknown" : "decision_source_unsupported",
      normalizedId === "unknown"
        ? cleanText(raw.reason, 1000) || "The visit source was explicitly recorded as Unknown."
        : "The recorded visit source is not part of the governed decision-source taxonomy.",
      cleanText(raw.sourceId, 100) || null
    );
  }

  const reason = cleanText(raw.reason, 1000);
  const evidence = Array.isArray(raw.evidence) ? raw.evidence.filter(item => item && typeof item === "object") : [];
  const confidenceScore = nullableNumber(typeof raw.confidence === "object" ? raw.confidence.score : raw.confidence);
  const capturedAt = cleanText(raw.capturedAt, 50);
  const capturedTime = new Date(capturedAt).getTime();
  const complete = Boolean(reason)
    && evidence.length > 0
    && confidenceScore !== null
    && confidenceScore >= Number(policy.sourceAdmission.minimumKnownSourceConfidence)
    && confidenceScore <= 1
    && Number.isFinite(capturedTime);
  if (!complete) {
    return unknownSource(
      record,
      policy,
      "decision_source_evidence_incomplete",
      "The recorded visit source is incomplete and cannot be admitted as known evidence.",
      cleanText(raw.sourceId, 100) || null
    );
  }

  return {
    sourceId: source.sourceId,
    sourceLabel: source.label,
    sourceClass: source.sourceClass,
    known: true,
    offRoute: source.offRoute,
    representativeJudgment: source.representativeJudgment === true,
    reasonCode: "explicit_decision_source_admitted",
    reason,
    evidence: clone(evidence),
    confidence: {
      score: round(confidenceScore),
      band: confidenceScore >= 0.8 ? "high" : confidenceScore >= 0.6 ? "medium" : "developing",
      basis: "explicit_structured_visit_decision_source"
    },
    capturedAt: new Date(capturedTime).toISOString(),
    rawSourceId: cleanText(raw.sourceId, 100)
  };
}

function normalizeOutcome(rawOutcome, policy) {
  const raw = rawOutcome && typeof rawOutcome === "object" && !Array.isArray(rawOutcome) ? rawOutcome : null;
  if (!raw) {
    return {
      status: "unavailable",
      label: null,
      measurements: Object.fromEntries(Object.keys(policy.successPolicy.signals).map(name => [name, null])),
      successful: null,
      successEvidence: []
    };
  }

  const measurements = {};
  let measurementAvailable = false;
  for (const name of Object.keys(policy.successPolicy.signals)) {
    const value = nullableNumber(raw[name]);
    measurements[name] = value;
    if (value !== null) measurementAvailable = true;
  }
  const label = cleanText(raw.label ?? raw.outcome, 160) || null;
  const available = measurementAvailable || Boolean(label);
  const successEvidence = Object.entries(policy.successPolicy.signals)
    .filter(([name, minimum]) => measurements[name] !== null && measurements[name] >= Number(minimum))
    .map(([name, minimum]) => ({ signal: name, observed: measurements[name], required: Number(minimum) }));
  return {
    status: available ? "available" : "unavailable",
    label,
    measurements,
    successful: available ? successEvidence.length > 0 : null,
    successEvidence
  };
}

function normalizeRecommendationDecision(record, source, policy) {
  const raw = record.recommendationDecisionContext;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      status: "unavailable",
      recommendationAvailable: null,
      recommendationId: null,
      decision: null,
      acceptance: null,
      override: null,
      reasonCode: "recommendation_decision_context_not_recorded"
    };
  }

  if (raw.recommendationAvailable === false) {
    return {
      status: "no_recommendation_available",
      recommendationAvailable: false,
      recommendationId: null,
      decision: null,
      acceptance: null,
      override: null,
      reasonCode: "no_route_recommendation_available"
    };
  }

  const recommendationId = cleanText(raw.recommendationId, 180);
  const decision = cleanText(raw.decision, 40).toLowerCase();
  const decisionAllowed = policy.recommendationDecisionPolicy.decisionValues.includes(decision);
  const contextComplete = raw.recommendationAvailable === true && Boolean(recommendationId) && decisionAllowed;
  const sourceCompatible = decision === "accepted"
    ? source.sourceId === "route_iq_recommendation"
    : source.known && source.offRoute === true;
  if (!contextComplete || !sourceCompatible) {
    return {
      status: "invalid_context_excluded",
      recommendationAvailable: raw.recommendationAvailable === true,
      recommendationId: recommendationId || null,
      decision: decisionAllowed ? decision : null,
      acceptance: null,
      override: null,
      reasonCode: contextComplete ? "recommendation_decision_source_conflict" : "recommendation_decision_context_incomplete"
    };
  }

  return {
    status: "verified",
    recommendationAvailable: true,
    recommendationId,
    decision,
    acceptance: decision === "accepted",
    override: decision === "overridden",
    reasonCode: decision === "accepted" ? "route_recommendation_accepted" : "route_recommendation_explicitly_overridden"
  };
}

export function loadOffRouteLearningContract() {
  return readJson("intelligence/contracts/off-route-learning-intelligence-contracts.json");
}

export function loadOffRouteLearningPolicy() {
  return readJson("intelligence/config/off-route-learning-intelligence-v1.json");
}

export function loadOffRouteLearningValidationFixture(contract = loadOffRouteLearningContract()) {
  return readJson(contract.intelligenceOwnedArtifacts.validationFixture);
}

export function validateOffRouteLearningPolicy(policy) {
  const failures = [];
  const assert = (condition, reason) => { if (!condition) failures.push(reason); };
  assert(policy?.policyVersion === "off-route-learning-intelligence-v1-policy-v1", "policy_version_mismatch");
  assert(policy?.status === "active_read_only_observation", "policy_status_invalid");
  assert(policy?.ownerSubsystem === "Prometheus Intelligence Engine", "policy_owner_invalid");
  assert(policy?.workspaceId === offRouteLearningWorkspaceId, "policy_workspace_invalid");
  assert(policy?.operatingProfileId === offRouteLearningOperatingProfileId, "policy_operating_profile_invalid");
  const sourceIds = (policy?.sourceTaxonomy || []).map(source => source.sourceId);
  const requiredSourceIds = [
    "route_iq_recommendation",
    "nearby_context",
    "representative_saved_place",
    "representative_discovery",
    "representative_follow_up",
    "manual_selection",
    "existing_relationship",
    "unknown"
  ];
  assert(JSON.stringify(sourceIds) === JSON.stringify(requiredSourceIds), "policy_source_taxonomy_invalid");
  assert(new Set(sourceIds).size === sourceIds.length, "policy_source_taxonomy_duplicate");
  assert(policy?.sourceAdmission?.explicitStructuredEvidenceRequired === true, "policy_explicit_source_not_required");
  assert(policy?.sourceAdmission?.notesInferenceAllowed === false, "policy_notes_inference_allowed");
  assert(policy?.sourceAdmission?.businessSourceTypeInferenceAllowed === false, "policy_business_origin_inference_allowed");
  assert(policy?.sourceAdmission?.outcomeInferenceAllowed === false, "policy_outcome_inference_allowed");
  assert(policy?.recommendationDecisionPolicy?.offRouteVisitAutomaticallyCountsAsOverride === false, "policy_off_route_auto_override_allowed");
  const weights = Object.values(policy?.confidenceModel?.weights || {});
  assert(round(weights.reduce((sum, value) => sum + finiteNumber(value), 0), 6) === 1, "policy_confidence_weights_must_total_one");
  for (const [name, value] of Object.entries(policy?.evidenceThresholds || {})) {
    assert(name.startsWith("minimum") && Number.isFinite(Number(value)) && Number(value) >= 0, `policy_threshold_invalid:${name}`);
  }
  assert(policy?.recommendationInfluence?.activationStatus === "disabled_observation_only", "policy_recommendation_influence_active");
  assert(policy?.recommendationInfluence?.routeScoringWeightMutationAllowed === false, "policy_route_scoring_mutation_allowed");
  assert(policy?.recommendationInfluence?.routeGenerationMutationAllowed === false, "policy_route_generation_mutation_allowed");
  assert(policy?.recommendationInfluence?.recommendationMutationAllowed === false, "policy_recommendation_mutation_allowed");
  return failures;
}

export function validateOffRouteLearningContract(contract, upstreamContract = loadReadOnlyFieldSessionLearningContract()) {
  const failures = [];
  const assert = (condition, reason) => { if (!condition) failures.push(reason); };
  assert(contract?.version === "off-route-learning-intelligence-v1-contracts-v1", "contract_version_mismatch");
  assert(contract?.status === "active_read_only_observation", "contract_status_invalid");
  assert(contract?.ownerSubsystem === "Prometheus Intelligence Engine", "contract_owner_invalid");
  assert(contract?.workspaceId === offRouteLearningWorkspaceId, "contract_workspace_invalid");
  assert(contract?.operatingProfileId === offRouteLearningOperatingProfileId, "contract_operating_profile_invalid");
  assert(contract?.upstreamReadOnlyLearning?.canonicalArchiveReaderReused === true, "contract_archive_reader_not_reused");
  assert(contract?.upstreamReadOnlyLearning?.sourceAccessMode === "read_only", "contract_source_access_not_read_only");
  assert(contract?.upstreamReadOnlyLearning?.rawEvidenceConsumptionAllowed === false, "contract_raw_evidence_allowed");
  assert(contract?.upstreamReadOnlyLearning?.archiveMutationAllowed === false, "contract_archive_mutation_allowed");
  assert(contract?.upstreamReadOnlyLearning?.historicalReplayAllowed === false, "contract_historical_replay_allowed");
  assert(upstreamContract?.version === "read-only-field-session-learning-contracts-v1", "contract_upstream_version_invalid");
  assert(upstreamContract?.independentAuthorization?.accessMode === "read_only", "contract_upstream_not_read_only");
  assert(upstreamContract?.productionSafety?.productionRecommendationInfluenceActive === false, "contract_upstream_recommendation_influence_active");
  assert(contract?.decisionSourceContract?.unknownFallbackRequired === true, "contract_unknown_fallback_missing");
  assert(contract?.decisionSourceContract?.notesMaySupplySource === false, "contract_notes_source_allowed");
  assert(contract?.recommendationDecisionContract?.overrideRequiresExplicitDecisionContext === true, "contract_override_context_not_required");
  assert(contract?.recommendationDecisionContract?.offRouteAutomaticallyMeansOverride === false, "contract_off_route_auto_override_allowed");
  for (const key of ["modifyData", "modifyDashboard", "modifyRouteRuntime", "modifyRecommendationScoring", "modifyRouteGeneration", "activateRecommendationInfluence", "createHistoricalEvidence", "parseNotesIntoDecisionSource", "consumeAdministrativelyExcludedSessions"]) {
    assert(contract?.readOnlySafety?.[key] === false, `contract_prohibited_behavior_enabled:${key}`);
  }
  assert(contract?.administrativeDispositionAdmission?.inheritedFromUpstreamReadOnlyLearning === true, "contract_administrative_disposition_not_inherited");
  assert(contract?.administrativeDispositionAdmission?.disposedSessionObservationAllowed === false, "contract_disposed_session_observation_allowed");
  assert(contract?.administrativeDispositionAdmission?.decisionSourceProjectionAllowed === false, "contract_disposed_decision_source_projection_allowed");
  assert(contract?.administrativeDispositionAdmission?.representativeJudgmentProjectionAllowed === false, "contract_disposed_representative_judgment_projection_allowed");
  assert(contract?.administrativeDispositionAdmission?.territoryOrCustomerMetricProjectionAllowed === false, "contract_disposed_segment_projection_allowed");
  assert(contract?.administrativeDispositionAdmission?.recommendationInputProjectionAllowed === false, "contract_disposed_recommendation_input_allowed");
  assert(contract?.administrativeDispositionAdmission?.automaticZeroVisitExclusionAllowed === false, "contract_automatic_zero_visit_exclusion_allowed");
  assert(contract?.administrativeDispositionAdmission?.unrelatedUndisposedZeroVisitSessionEligible === true, "contract_unrelated_zero_visit_session_blanket_excluded");
  assert(contract?.administrativeDispositionAdmission?.exactExcludedSessionId === "route-iq-field-session-fitness-connection-fitness-cruz-2026-07-14", "contract_disposed_session_id_mismatch");
  assert(contract?.administrativeDispositionAdmission?.exactExcludedRawSha256 === "ceb72963ab4e98d6039c1a4a1a409d281bf9e41e6001bd78cca4c04364815765", "contract_disposed_raw_hash_mismatch");
  assert(JSON.stringify(contract?.administrativeDispositionAdmission?.auditProjectionAllowedFields) === JSON.stringify(["sourceRawSha256", "dispositionRecordSha256"]), "contract_disposed_audit_projection_not_hash_only");
  assert(contract?.administrativeDispositionAdmission?.auditProjectionRawPayloadAllowed === false, "contract_disposed_audit_raw_payload_allowed");
  assert(contract?.prospectiveRetentionAdmission?.inheritedFromUpstreamReadOnlyLearning === true, "contract_retention_boundary_not_inherited");
  assert(contract?.prospectiveRetentionAdmission?.dataExactKeySuccessorCommit === "4803d7aca5810abfc1cbca84eb2f461046a10da4", "contract_retention_exact_key_commit_mismatch");
  for (const key of ["prospectiveEvidenceObservationAllowed", "expiredOrUnknownEvidenceObservationAllowed", "disposedSessionObservationAllowed", "derivedProjectionMayOutliveSource", "recommendationInputProjectionAllowed", "automaticZeroVisitExclusionAllowed", "productionActivationEligible"]) {
    assert(contract?.prospectiveRetentionAdmission?.[key] === false, `contract_retention_boundary_enabled:${key}`);
  }
  assert(contract?.validationFixturePolicy?.productionConsumptionAllowed === false, "contract_fixture_production_consumption_allowed");
  assert(contract?.validationFixturePolicy?.canonicalArtifactGenerationAllowed === false, "contract_fixture_canonical_generation_allowed");
  return failures;
}

export function projectCanonicalArchivedVisitEvidence(archivePackages, {
  workspaceId = offRouteLearningWorkspaceId,
  operatingProfileId = offRouteLearningOperatingProfileId
} = {}) {
  const records = [];
  for (const archivePackage of archivePackages || []) {
    const verified = archivePackage?.verifiedFieldSession || {};
    const representativeId = cleanText(verified?.verifiedFields?.representative?.id, 100)
      || cleanText(verified?.verifiedFields?.representative, 100);
    const territoryId = cleanText(verified?.verifiedFields?.territoryId, 160) || null;
    for (const visit of verified?.verifiedFields?.completedVisits || []) {
      const report = visit?.sourceReport || {};
      const business = visit?.governedBusinessIdentity || {};
      records.push({
        sessionId: cleanText(verified.sessionId, 180),
        visitId: cleanText(visit.visitId, 180),
        workspaceId: cleanText(verified.workspaceId, 100) || workspaceId,
        operatingProfileId: cleanText(verified.operatingProfileId, 100) || operatingProfileId,
        representativeId,
        territoryId,
        businessId: cleanText(business.runtimeId, 180),
        businessName: cleanText(business.businessName, 300),
        category: cleanText(business.category, 120) || "Unknown",
        visitOccurredAt: cleanText(report.timestamp, 50),
        visitDecisionSource: clone(visit.visitDecisionSource ?? null),
        recommendationDecisionContext: clone(visit.recommendationDecisionContext ?? null),
        outcome: {
          label: cleanText(report.outcome, 160) || null,
          conversations: nullableNumber(report.conversations),
          leads: nullableNumber(report.leads),
          units: nullableNumber(report.units),
          laterUnits: nullableNumber(report.laterUnits),
          appointments: nullableNumber(report.appointments),
          sales: nullableNumber(report.sales),
          contracts: nullableNumber(report.contracts),
          referrals: nullableNumber(report.referrals)
        },
        sourceProvenance: {
          sourceSubsystem: "Prometheus Data",
          sourceRecordKind: verified.recordKind,
          sourceSessionId: verified.sessionId,
          sourceVisitId: visit.visitId,
          sourceRawSha256: verified?.sourceProvenance?.rawSha256 || null,
          readOnly: true
        }
      });
    }
  }
  return records;
}

export function normalizeVisitDecisionEvidence(record, {
  policy = loadOffRouteLearningPolicy(),
  workspaceId = offRouteLearningWorkspaceId,
  operatingProfileId = offRouteLearningOperatingProfileId
} = {}) {
  if (record?.workspaceId !== workspaceId) {
    throw new OffRouteLearningIntelligenceError(
      `Unknown or cross-workspace off-route evidence: ${record?.workspaceId || "missing"}`,
      "off_route_learning_workspace_rejected"
    );
  }
  if (record?.operatingProfileId !== operatingProfileId) {
    throw new OffRouteLearningIntelligenceError(
      `Off-route evidence operating profile mismatch: ${record?.operatingProfileId || "missing"}`,
      "off_route_learning_operating_profile_rejected"
    );
  }
  const representativeId = cleanText(record.representativeId, 100);
  const visitId = cleanText(record.visitId, 180);
  const sessionId = cleanText(record.sessionId, 180);
  const visitOccurredAt = cleanText(record.visitOccurredAt, 50);
  if (!representativeId || !visitId || !sessionId || !Number.isFinite(new Date(visitOccurredAt).getTime())) {
    throw new OffRouteLearningIntelligenceError(
      `Off-route evidence identity or timestamp is incomplete: ${visitId || "unknown_visit"}`,
      "off_route_learning_evidence_identity_rejected"
    );
  }

  const source = normalizeKnownSource(record, policy);
  const outcome = normalizeOutcome(record.outcome, policy);
  const recommendationDecision = normalizeRecommendationDecision(record, source, policy);
  const evidenceId = stableId("visit-decision-evidence", [workspaceId, sessionId, visitId]);
  return {
    evidenceId,
    sessionId,
    visitId,
    workspaceId,
    operatingProfileId,
    representativeId,
    territoryId: cleanText(record.territoryId, 160) || null,
    business: {
      businessId: cleanText(record.businessId, 180) || null,
      businessName: cleanText(record.businessName, 300) || "Unknown business",
      category: cleanText(record.category, 120) || "Unknown"
    },
    visitOccurredAt: new Date(visitOccurredAt).toISOString(),
    decisionSource: source,
    recommendationDecision,
    outcome,
    isOffRoute: source.offRoute,
    isRecommendationAcceptance: recommendationDecision.acceptance,
    isRecommendationOverride: recommendationDecision.override,
    representativeJudgment: source.representativeJudgment,
    sourceProvenance: clone(record.sourceProvenance || {
      sourceSubsystem: "Intelligence Validation Fixture",
      sourceRecordKind: "validation_only",
      sourceSessionId: sessionId,
      sourceVisitId: visitId,
      readOnly: true
    }),
    explainability: {
      reason: source.reason,
      evidence: clone(source.evidence),
      outcome: clone(outcome),
      confidence: clone(source.confidence),
      timestamp: new Date(visitOccurredAt).toISOString(),
      representative: representativeId,
      workspace: workspaceId,
      territory: cleanText(record.territoryId, 160) || null
    }
  };
}

function rateMetric(metricId, label, numerator, denominator, minimumEvidence) {
  const valuePercent = percentage(numerator, denominator);
  const status = denominator <= 0
    ? "unavailable_no_evidence"
    : denominator < minimumEvidence ? "observed_insufficient_evidence" : "sufficient_evidence";
  return {
    metricId,
    label,
    valuePercent,
    numerator,
    denominator,
    minimumEvidence,
    status,
    limitingFactors: denominator <= 0
      ? ["denominator_unavailable"]
      : denominator < minimumEvidence ? ["evidence_below_governed_threshold"] : []
  };
}

function sourceCohorts(tracking, policy) {
  return policy.sourceTaxonomy.map(source => {
    const records = tracking.filter(record => record.decisionSource.sourceId === source.sourceId);
    const withOutcomes = records.filter(record => record.outcome.status === "available");
    const successes = withOutcomes.filter(record => record.outcome.successful === true).length;
    return {
      sourceId: source.sourceId,
      label: source.label,
      sourceClass: source.sourceClass,
      visits: records.length,
      outcomeEvidenceCount: withOutcomes.length,
      successes,
      successRatePercent: percentage(successes, withOutcomes.length),
      recommendationAcceptances: records.filter(record => record.isRecommendationAcceptance === true).length,
      recommendationOverrides: records.filter(record => record.isRecommendationOverride === true).length,
      representativeJudgment: source.representativeJudgment === true
    };
  });
}

function groupedOffRouteIntelligence(tracking, field, idField) {
  const groups = new Map();
  for (const record of tracking.filter(item => item.isOffRoute === true && item[field])) {
    const key = record[field];
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }
  return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([key, records]) => {
    const outcomes = records.filter(record => record.outcome.status === "available");
    const successes = outcomes.filter(record => record.outcome.successful === true).length;
    const sourceDistribution = {};
    for (const record of records) {
      sourceDistribution[record.decisionSource.sourceId] = finiteNumber(sourceDistribution[record.decisionSource.sourceId]) + 1;
    }
    return {
      intelligenceId: stableId(`off-route-${idField}`, [key, records.map(record => record.evidenceId)]),
      [idField]: key,
      visits: records.length,
      overrides: records.filter(record => record.isRecommendationOverride === true).length,
      outcomeEvidenceCount: outcomes.length,
      successes,
      successRatePercent: percentage(successes, outcomes.length),
      sourceDistribution,
      evidenceUsed: records.map(record => record.evidenceId),
      lastUpdated: maximumIso(records.map(record => record.visitOccurredAt)),
      recommendationInfluenceEligible: false
    };
  });
}

function buildRepresentativeJudgmentConfidence(tracking, policy, representativeId) {
  const judgment = tracking.filter(record => record.representativeJudgment && record.outcome.status === "available");
  const route = tracking.filter(record => record.decisionSource.sourceId === "route_iq_recommendation" && record.outcome.status === "available");
  const judgmentSuccesses = judgment.filter(record => record.outcome.successful === true).length;
  const routeSuccesses = route.filter(record => record.outcome.successful === true).length;
  const minimumJudgment = Number(policy.evidenceThresholds.minimumRepresentativeJudgmentOutcomes);
  const minimumComparison = Number(policy.evidenceThresholds.minimumComparisonOutcomesPerCohort);
  const judgmentMaturity = Math.min(1, judgment.length / Math.max(1, minimumJudgment));
  const comparisonMaturity = Math.min(1, Math.min(judgment.length, route.length) / Math.max(1, minimumComparison));
  const confidenceScore = round((judgmentMaturity * 0.6) + (comparisonMaturity * 0.4));
  const comparisonEligible = judgment.length >= minimumComparison && route.length >= minimumComparison;
  const judgmentSuccessRatePercent = percentage(judgmentSuccesses, judgment.length);
  const routeSuccessRatePercent = percentage(routeSuccesses, route.length);
  const difference = comparisonEligible ? round(judgmentSuccessRatePercent - routeSuccessRatePercent, 2) : null;
  const thresholdQualified = judgment.length >= minimumJudgment
    && confidenceScore >= Number(policy.evidenceThresholds.minimumRepresentativeJudgmentConfidence);
  return {
    confidenceId: stableId("representative-judgment-confidence", [representativeId, judgment.map(record => record.evidenceId), route.map(record => record.evidenceId)]),
    representativeId,
    score: confidenceScore,
    band: confidenceBand(confidenceScore, policy, judgment.length > 0),
    thresholdQualified,
    recommendationInfluenceEligible: false,
    representativeJudgmentOutcomes: judgment.length,
    representativeJudgmentSuccesses: judgmentSuccesses,
    representativeJudgmentSuccessRatePercent: judgmentSuccessRatePercent,
    routeRecommendationOutcomes: route.length,
    routeRecommendationSuccesses: routeSuccesses,
    routeRecommendationSuccessRatePercent: routeSuccessRatePercent,
    comparison: {
      status: comparisonEligible ? "sufficient_evidence" : "insufficient_evidence",
      minimumOutcomesPerCohort: minimumComparison,
      successRateDifferencePercentagePoints: difference,
      representativeJudgmentOutperformsRouteIq: comparisonEligible ? difference > 0 : null
    },
    evidenceUsed: [...judgment, ...route].map(record => record.evidenceId),
    limitingFactors: [
      ...(judgment.length < minimumJudgment ? ["representative_judgment_evidence_below_threshold"] : []),
      ...(route.length < minimumComparison ? ["route_recommendation_comparison_evidence_below_threshold"] : []),
      ...(confidenceScore < Number(policy.evidenceThresholds.minimumRepresentativeJudgmentConfidence) ? ["confidence_below_threshold"] : []),
      "recommendation_influence_disabled_observation_only"
    ]
  };
}

function buildLearningConfidence(tracking, policy) {
  const total = tracking.length;
  const known = tracking.filter(record => record.decisionSource.known).length;
  const outcomes = tracking.filter(record => record.outcome.status === "available").length;
  const decisions = tracking.filter(record => record.recommendationDecision.status === "verified").length;
  const sourceCoverage = total > 0 ? known / total : 0;
  const outcomeCoverage = total > 0 ? outcomes / total : 0;
  const decisionCoverage = known > 0 ? decisions / known : 0;
  const sampleMaturity = Math.min(1, known / Math.max(1, Number(policy.evidenceThresholds.minimumKnownSourceVisits)));
  const components = { sourceCoverage, outcomeCoverage, recommendationDecisionCoverage: decisionCoverage, sampleMaturity };
  const score = round(Object.entries(policy.confidenceModel.weights).reduce((sum, [name, weight]) => (
    sum + finiteNumber(components[name]) * Number(weight)
  ), 0));
  const thresholdQualified = known >= Number(policy.evidenceThresholds.minimumKnownSourceVisits)
    && decisions >= Number(policy.evidenceThresholds.minimumRecommendationDecisions)
    && score >= Number(policy.evidenceThresholds.minimumLearningConfidence);
  return {
    confidenceId: stableId("off-route-learning-confidence", tracking.map(record => record.evidenceId)),
    score,
    band: confidenceBand(score, policy, known > 0),
    thresholdQualified,
    recommendationInfluenceEligible: false,
    components: Object.fromEntries(Object.entries(components).map(([name, value]) => [name, round(value)])),
    evidenceCount: {
      totalVisits: total,
      knownSourceVisits: known,
      unknownSourceVisits: total - known,
      outcomeEvidenceVisits: outcomes,
      recommendationDecisionVisits: decisions
    },
    limitingFactors: [
      ...(known < Number(policy.evidenceThresholds.minimumKnownSourceVisits) ? ["known_source_evidence_below_threshold"] : []),
      ...(decisions < Number(policy.evidenceThresholds.minimumRecommendationDecisions) ? ["recommendation_decision_evidence_below_threshold"] : []),
      ...(score < Number(policy.evidenceThresholds.minimumLearningConfidence) ? ["confidence_below_threshold"] : []),
      "recommendation_influence_disabled_observation_only"
    ]
  };
}

export function buildOffRouteLearningSnapshot({
  records,
  contract = loadOffRouteLearningContract(),
  policy = loadOffRouteLearningPolicy(),
  workspaceId = offRouteLearningWorkspaceId,
  operatingProfileId = offRouteLearningOperatingProfileId,
  generatedAt,
  sourceMode = "canonical_verified_archive"
}) {
  const policyFailures = validateOffRouteLearningPolicy(policy);
  const contractFailures = validateOffRouteLearningContract(contract);
  if (policyFailures.length || contractFailures.length) {
    throw new OffRouteLearningIntelligenceError(
      `Off-route learning governance is invalid: ${[...policyFailures, ...contractFailures].join(" | ")}`,
      "off_route_learning_governance_invalid",
      { failures: [...policyFailures, ...contractFailures] }
    );
  }
  if (workspaceId !== contract.workspaceId || operatingProfileId !== contract.operatingProfileId) {
    throw new OffRouteLearningIntelligenceError(
      `Unknown off-route learning scope: ${workspaceId}/${operatingProfileId}`,
      "off_route_learning_scope_rejected"
    );
  }
  if (sourceMode === "validation_fixture" && contract.validationFixturePolicy.canonicalArtifactGenerationAllowed !== false) {
    throw new OffRouteLearningIntelligenceError("Validation fixture policy is unsafe.", "off_route_learning_fixture_policy_invalid");
  }

  const input = clone(records || []);
  const beforeHash = stableHash(input);
  const tracking = input.map(record => normalizeVisitDecisionEvidence(record, { policy, workspaceId, operatingProfileId }))
    .sort((left, right) => left.visitOccurredAt.localeCompare(right.visitOccurredAt) || left.evidenceId.localeCompare(right.evidenceId));
  const observedAt = generatedAt || maximumIso(tracking.map(record => record.visitOccurredAt));
  if (!Number.isFinite(new Date(observedAt).getTime())) {
    throw new OffRouteLearningIntelligenceError("Off-route learning generatedAt is invalid.", "off_route_learning_generated_at_invalid");
  }

  const decisionCohort = tracking.filter(record => record.recommendationDecision.status === "verified");
  const acceptances = decisionCohort.filter(record => record.isRecommendationAcceptance === true);
  const overrides = decisionCohort.filter(record => record.isRecommendationOverride === true);
  const overrideOutcomes = overrides.filter(record => record.outcome.status === "available");
  const overrideSuccesses = overrideOutcomes.filter(record => record.outcome.successful === true);
  const discoveries = tracking.filter(record => record.decisionSource.sourceId === "representative_discovery" && record.outcome.status === "available");
  const discoverySuccesses = discoveries.filter(record => record.outcome.successful === true);
  const cohorts = sourceCohorts(tracking, policy);
  const representativeIds = [...new Set(tracking.map(record => record.representativeId))];
  if (representativeIds.length !== 1) {
    throw new OffRouteLearningIntelligenceError("Off-route learning snapshot must be representative-scoped.", "off_route_learning_representative_scope_rejected");
  }

  const overrideObservations = overrides.map(record => ({
    overrideId: stableId("recommendation-override-observation", [record.evidenceId, record.recommendationDecision.recommendationId]),
    evidenceId: record.evidenceId,
    visitId: record.visitId,
    recommendationId: record.recommendationDecision.recommendationId,
    sourceId: record.decisionSource.sourceId,
    reason: record.explainability.reason,
    evidence: clone(record.explainability.evidence),
    outcome: clone(record.explainability.outcome),
    confidence: clone(record.explainability.confidence),
    timestamp: record.explainability.timestamp,
    representative: record.explainability.representative,
    workspace: record.explainability.workspace,
    territory: record.explainability.territory,
    recommendationInfluenceEligible: false
  }));

  const recommendationAcceptanceRate = rateMetric(
    "recommendation_acceptance_rate",
    "Recommendation Acceptance Rate",
    acceptances.length,
    decisionCohort.length,
    Number(policy.evidenceThresholds.minimumRecommendationDecisions)
  );
  const recommendationOverrideRate = rateMetric(
    "recommendation_override_rate",
    "Recommendation Override Rate",
    overrides.length,
    decisionCohort.length,
    Number(policy.evidenceThresholds.minimumRecommendationDecisions)
  );
  const overrideSuccessRate = rateMetric(
    "override_success_rate",
    "Override Success Rate",
    overrideSuccesses.length,
    overrideOutcomes.length,
    Number(policy.evidenceThresholds.minimumOverrideOutcomes)
  );
  const discoverySuccessRate = rateMetric(
    "discovery_success_rate",
    "Discovery Success Rate",
    discoverySuccesses.length,
    discoveries.length,
    Number(policy.evidenceThresholds.minimumDiscoveryOutcomes)
  );
  const representativeJudgmentConfidence = buildRepresentativeJudgmentConfidence(tracking, policy, representativeIds[0]);
  const learningConfidence = buildLearningConfidence(tracking, policy);
  const snapshot = {
    schemaVersion: "prometheus-intelligence-off-route-learning-snapshot-v1",
    artifactKind: "off_route_learning_intelligence_snapshot",
    artifactId: stableId("off-route-learning-snapshot", [workspaceId, operatingProfileId, representativeIds[0], tracking.map(record => record.evidenceId), policy.policyVersion]),
    generatedAt: new Date(observedAt).toISOString(),
    status: "observation_only",
    workspaceId,
    operatingProfileId,
    representativeId: representativeIds[0],
    ownerSubsystem: "Prometheus Intelligence Engine",
    sourceSubsystem: sourceMode === "canonical_verified_archive" ? "Prometheus Data" : "Intelligence Validation Fixture",
    sourceAccessMode: "read_only",
    learningVersion: {
      engine: offRouteLearningIntelligenceVersion,
      contract: contract.version,
      policy: policy.policyVersion,
      upstream: "read-only-field-session-learning-v1"
    },
    sourceEvidence: {
      mode: sourceMode,
      totalVisits: tracking.length,
      knownSourceVisits: tracking.filter(record => record.decisionSource.known).length,
      unknownSourceVisits: tracking.filter(record => !record.decisionSource.known).length,
      recommendationDecisionVisits: decisionCohort.length,
      sourceCoveragePercent: percentage(tracking.filter(record => record.decisionSource.known).length, tracking.length),
      rawEvidenceConsumed: false,
      stressObservationsConsumed: false,
      notesParsedIntoSource: false,
      sourceMutationDetected: false
    },
    sourceTracking: tracking,
    sourceCohorts: cohorts,
    recommendationAcceptanceRate,
    recommendationOverrideRate,
    overrideSuccessRate,
    discoverySuccessRate,
    representativeJudgmentConfidence,
    learningConfidence,
    overrideObservations,
    categoryOffRouteIntelligence: groupedOffRouteIntelligence(
      tracking.map(record => ({ ...record, categoryKey: record.business.category })),
      "categoryKey",
      "category"
    ),
    territoryOffRouteIntelligence: groupedOffRouteIntelligence(tracking, "territoryId", "territoryId"),
    learningHistory: tracking.map(record => ({
      historyId: stableId("off-route-learning-history", record.evidenceId),
      evidenceId: record.evidenceId,
      sessionId: record.sessionId,
      visitId: record.visitId,
      decisionSource: record.decisionSource.sourceId,
      sourceKnown: record.decisionSource.known,
      recommendationDecision: record.recommendationDecision.decision,
      outcomeStatus: record.outcome.status,
      successfulOutcome: record.outcome.successful,
      representativeId: record.representativeId,
      territoryId: record.territoryId,
      workspaceId: record.workspaceId,
      observedAt: record.visitOccurredAt,
      replayed: false,
      historicalEvidenceCreated: false,
      recommendationInfluenceEligible: false
    })),
    safety: {
      dashboardChanged: false,
      dataChanged: false,
      dataOwnershipChanged: false,
      routeRuntimeChanged: false,
      routeGenerationChanged: false,
      recommendationScoringChanged: false,
      recommendationBehaviorChanged: false,
      recommendationInfluenceActive: false,
      automaticLearningInfluenceActive: false,
      workspaceIsolationPassed: true,
      readOnlyLearning: true
    },
    archiveSafety: {
      archiveMutationPerformed: false,
      archiveOverwritePerformed: false,
      archiveDeletionPerformed: false,
      historicalReplayPerformed: false,
      historicalEvidenceCreated: false,
      normalizationChangesPerformed: false
    }
  };

  const afterHash = stableHash(input);
  if (beforeHash !== afterHash) {
    throw new OffRouteLearningIntelligenceError("Off-route learning mutated source evidence.", "off_route_learning_source_mutation_detected");
  }
  const snapshotFailures = validateOffRouteLearningSnapshot(snapshot, contract, policy);
  if (snapshotFailures.length) {
    throw new OffRouteLearningIntelligenceError(
      `Off-route learning snapshot is invalid: ${snapshotFailures.join(" | ")}`,
      "off_route_learning_snapshot_invalid",
      { failures: snapshotFailures }
    );
  }
  return deepFreeze(snapshot);
}

export function buildCanonicalOffRouteLearningSnapshot({
  contract = loadOffRouteLearningContract(),
  policy = loadOffRouteLearningPolicy(),
  upstreamContract = loadReadOnlyFieldSessionLearningContract(),
  upstreamPolicy = loadReadOnlyFieldSessionLearningPolicy(),
  dataContract = loadReadOnlyFieldSessionDataContract(upstreamContract),
  archivePackages = loadCanonicalArchivedFieldSessionPackages(upstreamContract),
  workspaceId = offRouteLearningWorkspaceId,
  operatingProfileId = offRouteLearningOperatingProfileId
} = {}) {
  const upstreamFailures = [
    ...validateReadOnlyFieldSessionLearningPolicy(upstreamPolicy),
    ...validateReadOnlyFieldSessionLearningContract(upstreamContract, dataContract)
  ];
  for (const archivePackage of archivePackages) {
    upstreamFailures.push(...validateArchivedFieldSessionPackage(archivePackage, {
      contract: upstreamContract,
      policy: upstreamPolicy,
      dataContract,
      workspaceId,
      operatingProfileId
    }));
  }
  if (upstreamFailures.length) {
    throw new OffRouteLearningIntelligenceError(
      `Canonical archived-session admission failed: ${upstreamFailures.join(" | ")}`,
      "off_route_learning_upstream_admission_rejected",
      { failures: upstreamFailures }
    );
  }
  const generatedAt = maximumIso(archivePackages.map(archivePackage => (
    archivePackage?.verifiedFieldSession?.sourceProvenance?.ingestedAt
      || archivePackage?.verifiedFieldSession?.verifiedFields?.exportTimestamp
  )));
  return buildOffRouteLearningSnapshot({
    records: projectCanonicalArchivedVisitEvidence(archivePackages, { workspaceId, operatingProfileId }),
    contract,
    policy,
    workspaceId,
    operatingProfileId,
    generatedAt,
    sourceMode: "canonical_verified_archive"
  });
}

export function validateOffRouteLearningSnapshot(snapshot, contract = loadOffRouteLearningContract(), policy = loadOffRouteLearningPolicy()) {
  const failures = [];
  const assert = (condition, reason) => { if (!condition) failures.push(reason); };
  assert(snapshot?.schemaVersion === "prometheus-intelligence-off-route-learning-snapshot-v1", "snapshot_schema_version_mismatch");
  assert(snapshot?.workspaceId === contract.workspaceId, "snapshot_workspace_mismatch");
  assert(snapshot?.operatingProfileId === contract.operatingProfileId, "snapshot_operating_profile_mismatch");
  assert(snapshot?.ownerSubsystem === "Prometheus Intelligence Engine", "snapshot_owner_mismatch");
  assert(snapshot?.sourceAccessMode === "read_only", "snapshot_source_access_not_read_only");
  for (const output of contract.requiredOutputs || []) {
    assert(snapshot?.[output] !== undefined, `snapshot_required_output_missing:${output}`);
  }
  const validSourceIds = new Set((policy.sourceTaxonomy || []).map(source => source.sourceId));
  assert(snapshot?.sourceTracking?.length === snapshot?.sourceEvidence?.totalVisits, "snapshot_source_tracking_count_mismatch");
  for (const record of snapshot?.sourceTracking || []) {
    assert(record.workspaceId === contract.workspaceId, `snapshot_cross_workspace_record:${record.evidenceId}`);
    assert(record.operatingProfileId === contract.operatingProfileId, `snapshot_wrong_profile_record:${record.evidenceId}`);
    assert(validSourceIds.has(record.decisionSource?.sourceId), `snapshot_unknown_source_id:${record.evidenceId}`);
    assert(record.explainability?.reason !== undefined, `snapshot_source_reason_missing:${record.evidenceId}`);
    assert(Array.isArray(record.explainability?.evidence), `snapshot_source_evidence_missing:${record.evidenceId}`);
    assert(record.explainability?.outcome !== undefined, `snapshot_source_outcome_missing:${record.evidenceId}`);
    assert(record.explainability?.confidence !== undefined, `snapshot_source_confidence_missing:${record.evidenceId}`);
    assert(record.explainability?.timestamp === record.visitOccurredAt, `snapshot_source_timestamp_mismatch:${record.evidenceId}`);
    assert(record.explainability?.representative === record.representativeId, `snapshot_source_representative_mismatch:${record.evidenceId}`);
    assert(record.explainability?.workspace === record.workspaceId, `snapshot_source_workspace_mismatch:${record.evidenceId}`);
    if (record.decisionSource?.sourceId === "unknown") {
      assert(record.isRecommendationAcceptance === null, `snapshot_unknown_source_acceptance_claim:${record.evidenceId}`);
      assert(record.isRecommendationOverride === null, `snapshot_unknown_source_override_claim:${record.evidenceId}`);
    }
    if (record.isRecommendationOverride === true) {
      assert(record.recommendationDecision?.status === "verified", `snapshot_override_context_unverified:${record.evidenceId}`);
      assert(record.decisionSource?.offRoute === true, `snapshot_override_not_off_route:${record.evidenceId}`);
    }
  }
  for (const override of snapshot?.overrideObservations || []) {
    for (const field of contract.overrideExplainabilityRequiredFields || []) {
      assert(Object.prototype.hasOwnProperty.call(override, field), `snapshot_override_explainability_missing:${override.overrideId}:${field}`);
    }
    assert(override.recommendationInfluenceEligible === false, `snapshot_override_influence_enabled:${override.overrideId}`);
  }
  const decisionDenominator = snapshot?.recommendationAcceptanceRate?.denominator;
  assert(decisionDenominator === snapshot?.recommendationOverrideRate?.denominator, "snapshot_decision_denominator_mismatch");
  if (decisionDenominator > 0) {
    assert(snapshot.recommendationAcceptanceRate.numerator + snapshot.recommendationOverrideRate.numerator === decisionDenominator, "snapshot_decision_rates_not_complementary");
  } else {
    assert(snapshot?.recommendationAcceptanceRate?.valuePercent === null, "snapshot_zero_denominator_acceptance_not_null");
    assert(snapshot?.recommendationOverrideRate?.valuePercent === null, "snapshot_zero_denominator_override_not_null");
  }
  assert(snapshot?.learningConfidence?.recommendationInfluenceEligible === false, "snapshot_learning_influence_enabled");
  assert(snapshot?.representativeJudgmentConfidence?.recommendationInfluenceEligible === false, "snapshot_judgment_influence_enabled");
  assert(Object.values(snapshot?.archiveSafety || {}).every(value => value === false), "snapshot_archive_safety_regressed");
  for (const [name, value] of Object.entries(snapshot?.safety || {})) {
    if (name.endsWith("Changed") || name.endsWith("Active")) assert(value === false, `snapshot_safety_regressed:${name}`);
  }
  assert(snapshot?.safety?.workspaceIsolationPassed === true, "snapshot_workspace_isolation_failed");
  assert(snapshot?.safety?.readOnlyLearning === true, "snapshot_not_read_only");
  return failures;
}
