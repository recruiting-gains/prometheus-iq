import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const readOnlyFieldSessionLearningVersion = "read-only-field-session-learning-v1";
export const readOnlyFieldSessionLearningWorkspaceId = "fitness_connection";
export const readOnlyFieldSessionLearningOperatingProfileId = "fitness";

const moduleDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(moduleDir, "..");
const millisecondsPerDay = 24 * 60 * 60 * 1000;

export class ReadOnlyFieldSessionLearningError extends Error {
  constructor(message, code = "field_session_learning_error", details = {}) {
    super(message);
    this.name = "ReadOnlyFieldSessionLearningError";
    this.code = code;
    this.details = details;
  }
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(resolve(repoRoot, relativePath), "utf8"));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
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

function maximumIso(values = []) {
  const valid = values
    .map(value => ({ value, milliseconds: new Date(value).getTime() }))
    .filter(item => item.value && Number.isFinite(item.milliseconds))
    .sort((left, right) => right.milliseconds - left.milliseconds);
  return valid[0]?.value || "";
}

function unique(values = []) {
  return [...new Set(values.filter(value => value !== null && value !== undefined && value !== ""))];
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function thresholdMetricName(thresholdName) {
  const withoutPrefix = thresholdName.replace(/^minimum/, "");
  return withoutPrefix ? `${withoutPrefix[0].toLowerCase()}${withoutPrefix.slice(1)}` : "";
}

function rate(numerator, denominator) {
  if (!Number.isFinite(Number(numerator)) || !Number.isFinite(Number(denominator)) || Number(denominator) <= 0) return null;
  return round((Number(numerator) / Number(denominator)) * 100, 2);
}

function addNullable(current, value) {
  const numeric = nullableNumber(value);
  if (numeric === null) return current;
  return finiteNumber(current) + numeric;
}

function mergeMemberships(current, value) {
  const numeric = nullableNumber(value);
  if (current === undefined) return numeric;
  if (numeric === null || current === null) return null;
  return finiteNumber(current) + numeric;
}

export function loadReadOnlyFieldSessionLearningContract() {
  return readJson("intelligence/contracts/read-only-field-session-learning-contracts.json");
}

export function loadReadOnlyFieldSessionLearningPolicy() {
  return readJson("intelligence/config/read-only-field-session-learning-policy-v1.json");
}

export function loadReadOnlyFieldSessionDataContract(contract = loadReadOnlyFieldSessionLearningContract()) {
  return readJson(contract.independentAuthorization.sourceDataContractPath);
}

export function loadCanonicalArchivedFieldSessionPackages(contract = loadReadOnlyFieldSessionLearningContract()) {
  const paths = contract.canonicalSourceArtifacts;
  return [{
    paths: clone(paths),
    manifest: readJson(paths.manifest),
    verifiedFieldSession: readJson(paths.verifiedFieldSession),
    calculatedMetrics: readJson(paths.calculatedMetrics),
    historyUpdates: readJson(paths.historyUpdates)
  }];
}

export function validateReadOnlyFieldSessionLearningPolicy(policy) {
  const failures = [];
  const fail = (condition, reason) => {
    if (!condition) failures.push(reason);
  };
  fail(policy?.policyVersion === "read-only-field-session-learning-policy-v1", "policy_version_mismatch");
  fail(policy?.status === "active", "policy_not_active");
  fail(policy?.workspaceId === readOnlyFieldSessionLearningWorkspaceId, "policy_workspace_mismatch");
  fail(policy?.operatingProfileId === readOnlyFieldSessionLearningOperatingProfileId, "policy_operating_profile_mismatch");
  fail(Array.isArray(policy?.admission?.authorizedSessionIds) && policy.admission.authorizedSessionIds.length > 0, "policy_authorized_sessions_missing");
  fail(policy?.admission?.rawEvidenceConsumptionAllowed === false, "policy_raw_evidence_not_prohibited");
  fail(policy?.admission?.stressTestObservationConsumptionAllowed === false, "policy_stress_test_evidence_not_prohibited");
  fail(policy?.admission?.failedSubmissionConsumptionAllowed === false, "policy_failed_submission_not_prohibited");
  fail(policy?.admission?.partialSessionConsumptionAllowed === false, "policy_partial_session_not_prohibited");
  fail(policy?.admission?.unverifiedEvidenceConsumptionAllowed === false, "policy_unverified_evidence_not_prohibited");
  for (const domain of ["representative", "territory", "category", "business"]) {
    const thresholds = policy?.evidenceThresholds?.[domain];
    fail(Boolean(thresholds), `policy_thresholds_missing:${domain}`);
    for (const [name, value] of Object.entries(thresholds || {})) {
      if (name.startsWith("minimum")) fail(Number.isFinite(Number(value)) && Number(value) >= 0, `policy_threshold_invalid:${domain}:${name}`);
    }
  }
  const weights = Object.values(policy?.confidenceModel?.metricWeights || {});
  fail(weights.length > 0, "policy_confidence_weights_missing");
  fail(round(weights.reduce((sum, value) => sum + finiteNumber(value), 0), 6) === 1, "policy_confidence_weights_must_total_one");
  fail(Number(policy?.recencyWeighting?.halfLifeDays) > 0, "policy_recency_half_life_invalid");
  fail(policy?.evidenceDecay?.neverChangesArchivedEvidence === true, "policy_archive_decay_mutation_allowed");
  fail(policy?.evidenceDecay?.affectsLearningConfidenceOnly === true, "policy_decay_scope_invalid");
  fail(policy?.recommendationInfluence?.activationStatus === "disabled_pending_future_handoff", "policy_recommendation_influence_not_disabled");
  fail(policy?.recommendationInfluence?.singleSessionInfluenceAllowed === false, "policy_single_session_influence_allowed");
  fail(policy?.recommendationInfluence?.routeScoringWeightMutationAllowed === false, "policy_route_weight_mutation_allowed");
  fail(policy?.recommendationInfluence?.recommendationMutationAllowed === false, "policy_recommendation_mutation_allowed");
  return failures;
}

export function validateReadOnlyFieldSessionLearningContract(contract, dataContract) {
  const failures = [];
  const fail = (condition, reason) => {
    if (!condition) failures.push(reason);
  };
  fail(contract?.version === "read-only-field-session-learning-contracts-v1", "contract_version_mismatch");
  fail(contract?.status === "active_read_only", "contract_not_active_read_only");
  fail(contract?.ownerSubsystem === "Prometheus Intelligence Engine", "contract_owner_mismatch");
  fail(contract?.workspaceId === readOnlyFieldSessionLearningWorkspaceId, "contract_workspace_mismatch");
  fail(contract?.operatingProfileId === readOnlyFieldSessionLearningOperatingProfileId, "contract_operating_profile_mismatch");
  fail(contract?.independentAuthorization?.status === "AUTHORIZED_ACTIVE", "independent_authorization_inactive");
  fail(contract?.independentAuthorization?.sourceDataContractId === dataContract?.contractId, "source_data_contract_id_mismatch");
  fail(contract?.independentAuthorization?.sourceContractIndependentAuthorizationRequirementSatisfied === true, "independent_authorization_requirement_unsatisfied");
  fail(contract?.independentAuthorization?.authorizedConsumerSubsystem === "Prometheus Intelligence Engine", "independent_authorization_consumer_mismatch");
  fail(contract?.independentAuthorization?.accessMode === "read_only", "independent_authorization_not_read_only");
  fail(dataContract?.intelligenceFieldSessionLearningHandoff?.accessMode === "read_only", "data_handoff_not_read_only");
  fail(dataContract?.intelligenceFieldSessionLearningHandoff?.independentAuthorizationRequiredBeforeConsumption === true, "data_handoff_independent_authorization_not_required");
  fail(dataContract?.intelligenceFieldSessionLearningHandoff?.rawEvidenceDirectConsumptionAllowed === false, "data_handoff_raw_evidence_allowed");
  fail(dataContract?.intelligenceFieldSessionLearningHandoff?.scoringMutationAllowed === false, "data_handoff_scoring_mutation_allowed");
  fail(dataContract?.intelligenceFieldSessionLearningHandoff?.recommendationMutationAllowed === false, "data_handoff_recommendation_mutation_allowed");
  for (const kind of contract?.approvedRecordKinds || []) {
    fail(dataContract?.intelligenceFieldSessionLearningHandoff?.approvedRecordTypes?.includes(kind), `record_kind_not_approved_by_data_handoff:${kind}`);
  }
  for (const operation of ["modifyData", "deleteArchives", "rewriteSessions", "replaySessions", "createHistoricalEvidence", "consumeRawEvidence", "consumeStressTestObservations"]) {
    fail(contract?.allowedOperations?.[operation] === false, `prohibited_operation_enabled:${operation}`);
  }
  fail(contract?.productionSafety?.readOnlyArchivedSessionLearningActive === true, "read_only_learning_not_active");
  fail(contract?.productionSafety?.productionRecommendationInfluenceActive === false, "recommendation_influence_active");
  fail(contract?.productionSafety?.routeScoringWeightsChanged === false, "route_scoring_weights_changed");
  fail(contract?.productionSafety?.historicalReplayActive === false, "historical_replay_active");
  fail(contract?.productionSafety?.archiveMutationAllowed === false, "archive_mutation_allowed");
  return failures;
}

export function validateArchivedFieldSessionPackage(archivePackage, context = {}) {
  const { contract, policy, dataContract } = context;
  const failures = [];
  const fail = (condition, reason) => {
    if (!condition) failures.push(reason);
  };
  const manifest = archivePackage?.manifest;
  const verified = archivePackage?.verifiedFieldSession;
  const metrics = archivePackage?.calculatedMetrics;
  const history = archivePackage?.historyUpdates;
  const sessionId = cleanText(manifest?.sessionId, 240);
  const scopedRecords = [manifest, verified, metrics, history];

  fail(Boolean(manifest && verified && metrics && history), "archive_package_incomplete");
  fail(policy?.admission?.authorizedSessionIds?.includes(sessionId), `session_not_authorized:${sessionId || "missing"}`);
  fail(manifest?.status === policy?.admission?.requiredManifestStatus, "session_not_archived");
  fail(policy?.admission?.requiredSourceFinality?.includes(manifest?.sourceFinality), "session_source_finality_unapproved");
  fail(scopedRecords.every(record => record?.workspaceId === context.workspaceId), "session_workspace_mismatch");
  fail(scopedRecords.every(record => record?.operatingProfileId === context.operatingProfileId), "session_operating_profile_mismatch");
  fail(scopedRecords.every(record => record?.sessionId === sessionId), "session_identity_mismatch");
  fail(verified?.recordKind === policy?.admission?.requiredRecordKinds?.[0], "verified_session_record_kind_invalid");
  fail(metrics?.recordKind === policy?.admission?.requiredRecordKinds?.[1], "calculated_metrics_record_kind_invalid");
  fail(history?.recordKind === policy?.admission?.requiredRecordKinds?.[2], "history_updates_record_kind_invalid");
  fail(verified?.sourceProvenance?.finalExportConfirmed === policy?.admission?.requiredFinalExportConfirmed, "final_export_not_confirmed");
  fail(verified?.fieldClassification?.calculatedFieldsStoredSeparately === true, "verified_and_calculated_fields_not_separated");
  fail(verified?.fieldClassification?.unavailableValuesRemainNull === true, "unavailable_values_not_preserved");
  fail(verified?.fieldClassification?.notesAreNotParsedIntoFollowUpOrObjectionClaims === true, "notes_claim_boundary_missing");
  fail(manifest?.rawSha256 === verified?.sourceProvenance?.rawSha256, "manifest_verified_raw_hash_mismatch");
  fail(manifest?.rawSha256 === metrics?.calculationProvenance?.sourceRawSha256, "manifest_metrics_raw_hash_mismatch");
  fail(metrics?.calculationProvenance?.sourceSessionId === sessionId, "metrics_source_session_mismatch");
  fail(history?.intelligenceLearningHandoff?.readOnly === true, "history_handoff_not_read_only");
  fail(history?.intelligenceLearningHandoff?.scoringMutationAllowed === false, "history_handoff_scoring_mutation_allowed");
  fail(contract?.independentAuthorization?.status === "AUTHORIZED_ACTIVE", "session_consumer_authorization_inactive");
  fail(dataContract?.intelligenceFieldSessionLearningHandoff?.approvedRecordTypes?.every(kind => contract?.approvedRecordKinds?.includes(kind)), "data_and_intelligence_record_kinds_unlinked");

  const identifierText = `${sessionId} ${verified?.sourceProvenance?.sourceKind || ""} ${verified?.sourceProvenance?.originalFileName || ""}`.toLowerCase();
  for (const fragment of policy?.admission?.disallowedIdentifierFragments || []) {
    fail(!identifierText.includes(String(fragment).toLowerCase()), `session_identifier_prohibited:${fragment}`);
  }

  const visits = verified?.verifiedFields?.completedVisits || [];
  const totals = verified?.verifiedFields?.totals || {};
  fail(Array.isArray(visits), "verified_visits_missing");
  fail(visits.length === totals.totalVisits, "verified_visit_count_mismatch");
  fail(history?.representativeHistory?.totals?.totalVisits === totals.totalVisits, "representative_history_visit_count_mismatch");
  fail(visits.every(visit => visit?.governedBusinessIdentity?.matchStatus === "exact_runtime_id"), "unverified_business_identity_present");
  fail(visits.every(visit => Boolean(visit?.governedBusinessIdentity?.googlePlaceId)), "business_google_place_identity_missing");
  fail(visits.every(visit => visit?.followUpRequirement === null && visit?.objections === null), "unverified_structured_claim_present");
  fail(verified?.verifiedFields?.totals?.totalMemberships === null, "membership_count_inferred_from_outcome_label");
  fail(metrics?.calculationProvenance?.membershipCountInferredFromOutcomeLabel === false, "membership_inference_prohibition_missing");
  return failures;
}

function recencyWeight(sourceTimestamp, asOf, policy) {
  const sourceMilliseconds = new Date(sourceTimestamp).getTime();
  const asOfMilliseconds = new Date(asOf).getTime();
  if (!Number.isFinite(sourceMilliseconds) || !Number.isFinite(asOfMilliseconds)) return policy.confidenceModel.unknownMetricProgress;
  const ageDays = Math.max(0, (asOfMilliseconds - sourceMilliseconds) / millisecondsPerDay);
  const halfLifeDays = Number(policy.recencyWeighting.halfLifeDays);
  const calculated = 0.5 ** (ageDays / halfLifeDays);
  return round(Math.max(Number(policy.recencyWeighting.minimumWeight), calculated));
}

function confidenceBand(score, policy, sufficientEvidence) {
  if (!sufficientEvidence) return policy.confidenceModel.insufficientEvidenceBand;
  const bands = [...policy.confidenceModel.bands].sort((left, right) => Number(left.minimum) - Number(right.minimum));
  let selected = bands[0]?.band || policy.confidenceModel.insufficientEvidenceBand;
  for (const band of bands) if (score >= Number(band.minimum)) selected = band.band;
  return selected;
}

function buildLearningConfidence({ domain, targetId, metrics, recency, policy, evidenceUsed, lastUpdated, scope }) {
  const thresholds = policy.evidenceThresholds[domain];
  const thresholdChecks = [];
  const metricProgress = {};
  for (const [thresholdName, requiredValue] of Object.entries(thresholds)) {
    if (!thresholdName.startsWith("minimum") || thresholdName === "minimumConfidence") continue;
    const metricName = thresholdMetricName(thresholdName);
    const actualValue = nullableNumber(metrics[metricName]);
    const required = Number(requiredValue);
    const met = required <= 0 || (actualValue !== null && actualValue >= required);
    const progress = actualValue === null
      ? Number(policy.confidenceModel.unknownMetricProgress)
      : required <= 0 ? 1 : Math.min(1, actualValue / required);
    thresholdChecks.push({ metric: metricName, actual: actualValue, required, met });
    metricProgress[metricName] = round(progress);
  }
  metricProgress.recency = recency;
  const weights = policy.confidenceModel.metricWeights;
  const confidenceScore = round(Object.entries(weights).reduce((score, [metric, weight]) => {
    return score + finiteNumber(metricProgress[metric], policy.confidenceModel.unknownMetricProgress) * Number(weight);
  }, 0));
  const territoryIdentityMet = thresholds.requiresTerritoryIdentity !== true || Boolean(scope.territoryId);
  const evidenceThresholdsMet = territoryIdentityMet && thresholdChecks.every(check => check.met);
  const confidenceThresholdMet = confidenceScore >= Number(thresholds.minimumConfidence);
  const thresholdQualified = evidenceThresholdsMet && confidenceThresholdMet;
  const recommendationActivationEnabled = policy.recommendationInfluence.activationStatus === "active";
  const recommendationInfluenceEligible = recommendationActivationEnabled
    && thresholdQualified
    && policy.recommendationInfluence.requiresHumanReview === false;
  const limitingFactors = thresholdChecks.filter(check => !check.met).map(check => `${check.metric}_below_threshold`);
  if (!territoryIdentityMet) limitingFactors.push("territory_identity_unavailable");
  if (!confidenceThresholdMet) limitingFactors.push("confidence_below_threshold");
  if (!recommendationActivationEnabled) limitingFactors.push("recommendation_influence_disabled_pending_future_handoff");

  return {
    confidenceId: stableId("learning-confidence", [domain, targetId, metrics, evidenceUsed]),
    domain,
    targetId,
    score: confidenceScore,
    band: confidenceBand(confidenceScore, policy, evidenceThresholdsMet),
    thresholdQualified,
    recommendationInfluenceEligible,
    recencyWeight: recency,
    metricProgress,
    thresholdChecks,
    territoryIdentityRequired: thresholds.requiresTerritoryIdentity === true,
    territoryIdentityAvailable: Boolean(scope.territoryId),
    limitingFactors,
    evidenceUsed: [...evidenceUsed],
    evidenceCount: {
      sessions: finiteNumber(metrics.verifiedSessions),
      visits: finiteNumber(metrics.visits),
      conversations: finiteNumber(metrics.conversations),
      leads: finiteNumber(metrics.leads),
      memberships: nullableNumber(metrics.memberships)
    },
    lastUpdated,
    applicableWorkspace: scope.workspaceId,
    applicableRepresentative: scope.representativeId || null,
    applicableTerritory: scope.territoryId || null,
    policyVersion: policy.policyVersion
  };
}

function explanationFor({ conclusion, evidenceUsed, confidence, lastUpdated, scope }) {
  return {
    conclusion,
    evidenceUsed: [...evidenceUsed],
    evidenceCount: clone(confidence.evidenceCount),
    confidence: {
      score: confidence.score,
      band: confidence.band,
      thresholdQualified: confidence.thresholdQualified,
      recommendationInfluenceEligible: confidence.recommendationInfluenceEligible,
      limitingFactors: [...confidence.limitingFactors]
    },
    lastUpdated,
    applicableWorkspace: scope.workspaceId,
    applicableRepresentative: scope.representativeId || null,
    applicableTerritory: scope.territoryId || null
  };
}

function sourceContribution(archivePackage, asOf, policy) {
  const verified = archivePackage.verifiedFieldSession;
  const history = archivePackage.historyUpdates;
  const metrics = archivePackage.calculatedMetrics;
  const sourceTimestamp = verified.sourceProvenance.ingestedAt || verified.verifiedFields.exportTimestamp;
  return {
    sessionId: verified.sessionId,
    representativeId: verified.verifiedFields.representative.id,
    territoryId: verified.verifiedFields.territoryId,
    fieldSessionDate: verified.verifiedFields.fieldSessionDate,
    lastUpdated: sourceTimestamp,
    recencyWeight: recencyWeight(sourceTimestamp, asOf, policy),
    totals: clone(history.representativeHistory.totals),
    categoryOutcomes: clone(history.categoryOutcomeHistory || []),
    businessOutcomes: clone(history.customerOutcomeHistory || []),
    calculatedMetrics: clone(metrics.calculations),
    completedVisits: clone(verified.verifiedFields.completedVisits || []),
    unavailableFields: clone(verified.unavailableFields || []),
    sourceRawSha256: verified.sourceProvenance.rawSha256
  };
}

function buildRepresentativeIntelligence(contributions, policy, scope) {
  const grouped = new Map();
  for (const contribution of contributions) {
    const current = grouped.get(contribution.representativeId) || {
      representativeId: contribution.representativeId,
      sessionIds: [],
      visits: 0,
      conversations: 0,
      leads: 0,
      units: 0,
      laterUnits: 0,
      memberships: 0,
      membershipUnavailable: false,
      categories: new Map(),
      timeWindows: new Map(),
      outcomes: new Map(),
      sourceTimestamps: [],
      recencyWeights: []
    };
    current.sessionIds.push(contribution.sessionId);
    current.visits += finiteNumber(contribution.totals.totalVisits);
    current.conversations += finiteNumber(contribution.totals.totalConversations);
    current.leads += finiteNumber(contribution.totals.totalLeads);
    current.units += finiteNumber(contribution.totals.totalUnits);
    current.laterUnits += finiteNumber(contribution.totals.totalLaterUnits);
    if (contribution.totals.totalMemberships === null) current.membershipUnavailable = true;
    else current.memberships += finiteNumber(contribution.totals.totalMemberships);
    current.sourceTimestamps.push(contribution.lastUpdated);
    current.recencyWeights.push(contribution.recencyWeight);
    for (const category of contribution.categoryOutcomes) {
      const categoryTotals = current.categories.get(category.category) || { visits: 0, conversations: 0, leads: 0, units: 0, laterUnits: 0 };
      for (const metric of ["visits", "conversations", "leads", "units", "laterUnits"]) categoryTotals[metric] += finiteNumber(category[metric]);
      current.categories.set(category.category, categoryTotals);
    }
    for (const visit of contribution.completedVisits) {
      const window = cleanText(visit.sourceReport?.timeWindow, 80) || "unavailable";
      const windowTotals = current.timeWindows.get(window) || { visits: 0, conversations: 0, leads: 0, units: 0 };
      windowTotals.visits += 1;
      windowTotals.conversations += finiteNumber(visit.sourceReport?.conversations);
      windowTotals.leads += finiteNumber(visit.sourceReport?.leads);
      windowTotals.units += finiteNumber(visit.sourceReport?.units) + finiteNumber(visit.sourceReport?.laterUnits);
      current.timeWindows.set(window, windowTotals);
      const outcome = cleanText(visit.sourceReport?.outcome, 120) || "unavailable";
      current.outcomes.set(outcome, (current.outcomes.get(outcome) || 0) + 1);
    }
    grouped.set(contribution.representativeId, current);
  }

  return [...grouped.values()].sort((left, right) => left.representativeId.localeCompare(right.representativeId)).map(current => {
    const lastUpdated = maximumIso(current.sourceTimestamps);
    const metrics = {
      verifiedSessions: unique(current.sessionIds).length,
      visits: current.visits,
      conversations: current.conversations,
      leads: current.leads,
      memberships: current.membershipUnavailable ? null : current.memberships
    };
    const recordScope = { ...scope, representativeId: current.representativeId, territoryId: null };
    const confidence = buildLearningConfidence({
      domain: "representative",
      targetId: current.representativeId,
      metrics,
      recency: Math.max(...current.recencyWeights),
      policy,
      evidenceUsed: unique(current.sessionIds),
      lastUpdated,
      scope: recordScope
    });
    const conclusion = `${current.representativeId} has ${current.visits} verified visits, ${current.conversations} conversations, and ${current.leads} leads across ${metrics.verifiedSessions} archived session(s).`;
    return {
      intelligenceId: stableId("representative-intelligence", [recordScope, current.sessionIds]),
      status: confidence.thresholdQualified ? "threshold_qualified_observation" : "observation_only_insufficient_evidence",
      representativeId: current.representativeId,
      operatingProfileId: scope.operatingProfileId,
      industryPerformance: {
        status: "observation_only",
        profileId: scope.operatingProfileId,
        verifiedSessions: metrics.verifiedSessions
      },
      categoryPerformance: Object.fromEntries([...current.categories.entries()].sort(([left], [right]) => left.localeCompare(right))),
      conversationOutcomes: {
        visits: current.visits,
        conversations: current.conversations,
        conversationRatePercent: rate(current.conversations, current.visits),
        outcomes: Object.fromEntries([...current.outcomes.entries()].sort(([left], [right]) => left.localeCompare(right)))
      },
      leadQuality: {
        leads: current.leads,
        leadPerVisitRatePercent: rate(current.leads, current.visits),
        unitPerLeadRatePercent: rate(current.units + current.laterUnits, current.leads),
        status: confidence.thresholdQualified ? "threshold_qualified" : "insufficient_evidence"
      },
      followUpBehavior: {
        status: "unavailable",
        reason: "Structured follow-up requirements are unavailable in the canonical session."
      },
      timeOfDayEffectiveness: Object.fromEntries([...current.timeWindows.entries()].sort(([left], [right]) => left.localeCompare(right))),
      visitFrequency: {
        status: metrics.verifiedSessions >= policy.evidenceThresholds.representative.minimumVerifiedSessions
          ? "observable"
          : "insufficient_evidence",
        verifiedSessions: metrics.verifiedSessions
      },
      closeBehavior: {
        units: current.units,
        laterUnits: current.laterUnits,
        memberships: metrics.memberships,
        membershipStatus: metrics.memberships === null ? "unavailable" : "verified"
      },
      confidence,
      explainability: explanationFor({ conclusion, evidenceUsed: unique(current.sessionIds), confidence, lastUpdated, scope: recordScope })
    };
  });
}

function buildCategoryIntelligence(contributions, policy, scope) {
  const grouped = new Map();
  for (const contribution of contributions) {
    for (const category of contribution.categoryOutcomes) {
      const current = grouped.get(category.category) || {
        category: category.category,
        sessionIds: [],
        representativeIds: [],
        visits: 0,
        conversations: 0,
        leads: 0,
        units: 0,
        laterUnits: 0,
        memberships: undefined,
        sourceTimestamps: [],
        recencyWeights: []
      };
      current.sessionIds.push(contribution.sessionId);
      current.representativeIds.push(contribution.representativeId);
      for (const metric of ["visits", "conversations", "leads", "units", "laterUnits"]) current[metric] += finiteNumber(category[metric]);
      current.memberships = mergeMemberships(current.memberships, category.memberships);
      current.sourceTimestamps.push(contribution.lastUpdated);
      current.recencyWeights.push(contribution.recencyWeight);
      grouped.set(category.category, current);
    }
  }
  return [...grouped.values()].sort((left, right) => left.category.localeCompare(right.category)).map(current => {
    const representativeIds = unique(current.representativeIds);
    const recordScope = { ...scope, representativeId: representativeIds.length === 1 ? representativeIds[0] : null, territoryId: null };
    const lastUpdated = maximumIso(current.sourceTimestamps);
    const metrics = {
      verifiedSessions: unique(current.sessionIds).length,
      visits: current.visits,
      conversations: current.conversations,
      leads: current.leads,
      memberships: current.memberships ?? null
    };
    const evidenceUsed = unique(current.sessionIds);
    const confidence = buildLearningConfidence({
      domain: "category",
      targetId: current.category,
      metrics,
      recency: Math.max(...current.recencyWeights),
      policy,
      evidenceUsed,
      lastUpdated,
      scope: recordScope
    });
    const conclusion = `${current.category} has ${current.visits} verified visits, ${current.conversations} conversations, ${current.leads} leads, and ${current.units + current.laterUnits} verified units.`;
    return {
      intelligenceId: stableId("category-intelligence", [current.category, evidenceUsed]),
      status: confidence.thresholdQualified ? "threshold_qualified_observation" : "observation_only_insufficient_evidence",
      category: current.category,
      metrics: {
        ...metrics,
        units: current.units,
        laterUnits: current.laterUnits,
        conversationRatePercent: rate(current.conversations, current.visits),
        leadRatePercent: rate(current.leads, current.visits),
        conversionRatePercent: rate(current.units + current.laterUnits, current.visits)
      },
      bestCategoryDeclared: false,
      confidence,
      explainability: explanationFor({ conclusion, evidenceUsed, confidence, lastUpdated, scope: recordScope })
    };
  });
}

function buildBusinessIntelligence(contributions, policy, scope) {
  const grouped = new Map();
  for (const contribution of contributions) {
    for (const outcome of contribution.businessOutcomes) {
      const key = outcome.googlePlaceId;
      const current = grouped.get(key) || {
        googlePlaceId: key,
        businessName: outcome.businessName,
        category: outcome.category,
        sessionIds: [],
        representativeIds: [],
        interactions: [],
        visits: 0,
        conversations: 0,
        leads: 0,
        units: 0,
        laterUnits: 0,
        memberships: undefined,
        recencyWeights: []
      };
      current.sessionIds.push(contribution.sessionId);
      current.representativeIds.push(contribution.representativeId);
      current.interactions.push({
        sessionId: contribution.sessionId,
        visitId: outcome.visitId,
        timestamp: outcome.timestamp,
        loggedOutcome: outcome.loggedOutcome,
        conversations: outcome.conversations,
        leads: outcome.leads,
        units: outcome.units,
        laterUnits: outcome.laterUnits
      });
      current.visits += 1;
      current.conversations += finiteNumber(outcome.conversations);
      current.leads += finiteNumber(outcome.leads);
      current.units += finiteNumber(outcome.units);
      current.laterUnits += finiteNumber(outcome.laterUnits);
      current.memberships = mergeMemberships(current.memberships, outcome.memberships);
      current.recencyWeights.push(contribution.recencyWeight);
      grouped.set(key, current);
    }
  }
  return [...grouped.values()].sort((left, right) => left.googlePlaceId.localeCompare(right.googlePlaceId)).map(current => {
    current.interactions.sort((left, right) => left.timestamp.localeCompare(right.timestamp) || left.visitId.localeCompare(right.visitId));
    const representativeIds = unique(current.representativeIds);
    const recordScope = { ...scope, representativeId: representativeIds.length === 1 ? representativeIds[0] : null, territoryId: null };
    const evidenceUsed = current.interactions.map(interaction => `${interaction.sessionId}:${interaction.visitId}`);
    const lastUpdated = maximumIso(current.interactions.map(interaction => interaction.timestamp));
    const metrics = {
      verifiedSessions: unique(current.sessionIds).length,
      visits: current.visits,
      conversations: current.conversations,
      leads: current.leads,
      memberships: current.memberships ?? null
    };
    const confidence = buildLearningConfidence({
      domain: "business",
      targetId: current.googlePlaceId,
      metrics,
      recency: Math.max(...current.recencyWeights),
      policy,
      evidenceUsed,
      lastUpdated,
      scope: recordScope
    });
    const timestamps = current.interactions.map(interaction => new Date(interaction.timestamp).getTime()).filter(Number.isFinite);
    const spacingDays = timestamps.length > 1
      ? timestamps.slice(1).map((timestamp, index) => round((timestamp - timestamps[index]) / millisecondsPerDay, 2))
      : [];
    const conclusion = `${current.businessName} has ${current.visits} verified historical interaction(s), ${current.conversations} conversations, and ${current.leads} leads.`;
    return {
      intelligenceId: stableId("business-intelligence", [current.googlePlaceId, evidenceUsed]),
      status: confidence.thresholdQualified ? "threshold_qualified_observation" : "observation_only_insufficient_evidence",
      googlePlaceId: current.googlePlaceId,
      businessName: current.businessName,
      category: current.category,
      historicalInteractions: current.interactions,
      priorOutcomes: current.interactions.map(interaction => interaction.loggedOutcome),
      visitSpacing: spacingDays.length ? { status: "available", intervalsDays: spacingDays } : { status: "insufficient_evidence", intervalsDays: [] },
      leadHistory: {
        leads: current.leads,
        verifiedInteractions: current.visits
      },
      membershipHistory: {
        memberships: current.memberships,
        status: current.memberships === null ? "unavailable" : "verified"
      },
      confidence,
      explainability: explanationFor({ conclusion, evidenceUsed, confidence, lastUpdated, scope: recordScope })
    };
  });
}

function buildTerritoryIntelligence(contributions, policy, scope) {
  const identified = contributions.filter(contribution => Boolean(contribution.territoryId));
  if (!identified.length) {
    const evidenceUsed = contributions.map(contribution => contribution.sessionId);
    const lastUpdated = maximumIso(contributions.map(contribution => contribution.lastUpdated));
    const representativeIds = unique(contributions.map(contribution => contribution.representativeId));
    const recordScope = { ...scope, representativeId: representativeIds.length === 1 ? representativeIds[0] : null, territoryId: null };
    const metrics = {
      verifiedSessions: unique(evidenceUsed).length,
      visits: contributions.reduce((sum, contribution) => sum + finiteNumber(contribution.totals.totalVisits), 0),
      conversations: contributions.reduce((sum, contribution) => sum + finiteNumber(contribution.totals.totalConversations), 0),
      leads: contributions.reduce((sum, contribution) => sum + finiteNumber(contribution.totals.totalLeads), 0),
      memberships: null
    };
    const confidence = buildLearningConfidence({
      domain: "territory",
      targetId: "territory-unavailable",
      metrics,
      recency: Math.max(...contributions.map(contribution => contribution.recencyWeight)),
      policy,
      evidenceUsed,
      lastUpdated,
      scope: recordScope
    });
    const conclusion = "Territory intelligence is unavailable because canonical field-session evidence does not identify a territory.";
    return [{
      intelligenceId: stableId("territory-intelligence", [scope.workspaceId, evidenceUsed]),
      status: "unavailable",
      territoryId: null,
      geographicPerformance: { status: "unavailable" },
      shoppingCenterPerformance: { status: "unavailable" },
      commercialCorridorPerformance: { status: "unavailable" },
      categoryDensity: { status: "unavailable" },
      conversionDensity: { status: "unavailable" },
      unavailableReason: "The canonical field-session record contains no territory identifier or geographic grouping evidence.",
      confidence,
      explainability: explanationFor({ conclusion, evidenceUsed, confidence, lastUpdated, scope: recordScope })
    }];
  }

  const grouped = new Map();
  for (const contribution of identified) {
    const current = grouped.get(contribution.territoryId) || { territoryId: contribution.territoryId, contributions: [] };
    current.contributions.push(contribution);
    grouped.set(contribution.territoryId, current);
  }
  return [...grouped.values()].sort((left, right) => left.territoryId.localeCompare(right.territoryId)).map(group => {
    const evidenceUsed = group.contributions.map(contribution => contribution.sessionId);
    const representativeIds = unique(group.contributions.map(contribution => contribution.representativeId));
    const recordScope = { ...scope, representativeId: representativeIds.length === 1 ? representativeIds[0] : null, territoryId: group.territoryId };
    const lastUpdated = maximumIso(group.contributions.map(contribution => contribution.lastUpdated));
    const metrics = {
      verifiedSessions: unique(evidenceUsed).length,
      visits: group.contributions.reduce((sum, contribution) => sum + finiteNumber(contribution.totals.totalVisits), 0),
      conversations: group.contributions.reduce((sum, contribution) => sum + finiteNumber(contribution.totals.totalConversations), 0),
      leads: group.contributions.reduce((sum, contribution) => sum + finiteNumber(contribution.totals.totalLeads), 0),
      memberships: group.contributions.some(contribution => contribution.totals.totalMemberships === null)
        ? null
        : group.contributions.reduce((sum, contribution) => sum + finiteNumber(contribution.totals.totalMemberships), 0)
    };
    const confidence = buildLearningConfidence({
      domain: "territory",
      targetId: group.territoryId,
      metrics,
      recency: Math.max(...group.contributions.map(contribution => contribution.recencyWeight)),
      policy,
      evidenceUsed,
      lastUpdated,
      scope: recordScope
    });
    const conclusion = `${group.territoryId} has ${metrics.visits} verified visits across ${metrics.verifiedSessions} archived session(s).`;
    return {
      intelligenceId: stableId("territory-intelligence", [group.territoryId, evidenceUsed]),
      status: confidence.thresholdQualified ? "threshold_qualified_observation" : "observation_only_insufficient_evidence",
      territoryId: group.territoryId,
      geographicPerformance: { status: "observed", metrics },
      shoppingCenterPerformance: { status: "unavailable" },
      commercialCorridorPerformance: { status: "unavailable" },
      categoryDensity: { status: "unavailable" },
      conversionDensity: { status: "unavailable" },
      confidence,
      explainability: explanationFor({ conclusion, evidenceUsed, confidence, lastUpdated, scope: recordScope })
    };
  });
}

function buildEvidenceConfidence(archivePackages, contract) {
  return archivePackages.map(archivePackage => {
    const manifest = archivePackage.manifest;
    const verified = archivePackage.verifiedFieldSession;
    const checks = {
      archived: manifest.status === "archived",
      finalExportConfirmed: verified.sourceProvenance.finalExportConfirmed === true,
      sourceHashLinked: manifest.rawSha256 === verified.sourceProvenance.rawSha256,
      verifiedRecordKind: verified.recordKind === "verified_field_session",
      calculatedMetricsSeparated: archivePackage.calculatedMetrics.recordKind === "calculated_field_session_metrics",
      historySeparated: archivePackage.historyUpdates.recordKind === "field_session_history_updates",
      rawEvidenceConsumed: false,
      stressTestObservationsConsumed: false
    };
    const affirmativeChecks = Object.entries(checks).filter(([name]) => !name.endsWith("Consumed"));
    const passed = affirmativeChecks.filter(([, value]) => value === true).length;
    return {
      evidenceConfidenceId: stableId("evidence-confidence", [manifest.sessionId, checks]),
      sessionId: manifest.sessionId,
      score: round(passed / Math.max(1, affirmativeChecks.length)),
      band: passed === affirmativeChecks.length ? "verified" : "rejected",
      checks,
      evidenceUsed: [manifest.sessionId],
      evidenceCount: {
        sessions: 1,
        visits: verified.verifiedFields.totals.totalVisits
      },
      confidence: {
        sourceFinality: manifest.sourceFinality,
        rawSha256: manifest.rawSha256,
        approvedRecordKinds: [...contract.approvedRecordKinds]
      },
      lastUpdated: verified.sourceProvenance.ingestedAt,
      applicableWorkspace: manifest.workspaceId,
      applicableRepresentative: verified.verifiedFields.representative.id,
      applicableTerritory: verified.verifiedFields.territoryId
    };
  });
}

function allConclusions(snapshot) {
  return [
    ...snapshot.representativeIntelligence,
    ...snapshot.territoryIntelligence,
    ...snapshot.categoryIntelligence,
    ...snapshot.businessIntelligence
  ];
}

export function buildReadOnlyFieldSessionLearningSnapshot(options = {}) {
  const contract = options.contract || loadReadOnlyFieldSessionLearningContract();
  const policy = options.policy || loadReadOnlyFieldSessionLearningPolicy();
  const dataContract = options.dataContract || loadReadOnlyFieldSessionDataContract(contract);
  const archivePackages = clone(options.archivePackages || loadCanonicalArchivedFieldSessionPackages(contract));
  const workspaceId = options.workspaceId || contract.workspaceId;
  const operatingProfileId = options.operatingProfileId || contract.operatingProfileId;

  if (workspaceId !== readOnlyFieldSessionLearningWorkspaceId) {
    throw new ReadOnlyFieldSessionLearningError(`Unknown field-session learning workspace: ${workspaceId || "missing"}.`, "field_session_learning_workspace_unknown");
  }
  if (operatingProfileId !== readOnlyFieldSessionLearningOperatingProfileId) {
    throw new ReadOnlyFieldSessionLearningError(`Field-session learning operating profile mismatch: ${operatingProfileId || "missing"}.`, "field_session_learning_operating_profile_mismatch");
  }

  const policyFailures = validateReadOnlyFieldSessionLearningPolicy(policy);
  const contractFailures = validateReadOnlyFieldSessionLearningContract(contract, dataContract);
  if (policyFailures.length || contractFailures.length) {
    throw new ReadOnlyFieldSessionLearningError(
      `Read-only field-session learning authorization is invalid: ${[...policyFailures, ...contractFailures].join(" | ")}`,
      "field_session_learning_authorization_invalid",
      { failures: [...policyFailures, ...contractFailures] }
    );
  }

  const beforeHash = stableHash(archivePackages);
  const seenSessions = new Set();
  const validationFailures = [];
  for (const archivePackage of archivePackages) {
    const sessionId = archivePackage?.manifest?.sessionId;
    if (seenSessions.has(sessionId)) validationFailures.push(`duplicate_session_replay_rejected:${sessionId}`);
    seenSessions.add(sessionId);
    validationFailures.push(...validateArchivedFieldSessionPackage(archivePackage, {
      contract,
      policy,
      dataContract,
      workspaceId,
      operatingProfileId
    }).map(reason => `${sessionId || "unknown_session"}:${reason}`));
  }
  if (validationFailures.length) {
    throw new ReadOnlyFieldSessionLearningError(
      `Archived field-session evidence failed closed: ${validationFailures.join(" | ")}`,
      "field_session_learning_evidence_rejected",
      { failures: validationFailures }
    );
  }

  const sourceAsOf = maximumIso(archivePackages.map(archivePackage => (
    archivePackage.verifiedFieldSession.sourceProvenance.ingestedAt
      || archivePackage.verifiedFieldSession.verifiedFields.exportTimestamp
  )));
  const scope = { workspaceId, operatingProfileId };
  const contributions = archivePackages.map(archivePackage => sourceContribution(archivePackage, sourceAsOf, policy));
  const representativeIntelligence = buildRepresentativeIntelligence(contributions, policy, scope);
  const territoryIntelligence = buildTerritoryIntelligence(contributions, policy, scope);
  const categoryIntelligence = buildCategoryIntelligence(contributions, policy, scope);
  const businessIntelligence = buildBusinessIntelligence(contributions, policy, scope);
  const evidenceConfidence = buildEvidenceConfidence(archivePackages, contract);
  const learningConfidence = [
    ...representativeIntelligence,
    ...territoryIntelligence,
    ...categoryIntelligence,
    ...businessIntelligence
  ].map(record => clone(record.confidence));
  const learningHistory = contributions.map(contribution => ({
    historyId: stableId("learning-history", [contribution.sessionId, contribution.sourceRawSha256]),
    sessionId: contribution.sessionId,
    mode: "read_only_snapshot_contribution",
    replayed: false,
    historicalEvidenceCreated: false,
    representativeId: contribution.representativeId,
    territoryId: contribution.territoryId,
    fieldSessionDate: contribution.fieldSessionDate,
    sourceRawSha256: contribution.sourceRawSha256,
    totals: clone(contribution.totals),
    lastUpdated: contribution.lastUpdated,
    applicableWorkspace: workspaceId,
    applicableRepresentative: contribution.representativeId,
    applicableTerritory: contribution.territoryId
  }));
  const snapshot = {
    schemaVersion: "prometheus-intelligence-read-only-field-session-learning-snapshot-v1",
    artifactKind: "read_only_field_session_learning_snapshot",
    artifactId: stableId("field-session-learning-snapshot", [workspaceId, operatingProfileId, [...seenSessions].sort(), policy.policyVersion]),
    generatedAt: sourceAsOf,
    status: "observation_only",
    workspaceId,
    operatingProfileId,
    ownerSubsystem: "Prometheus Intelligence Engine",
    sourceSubsystem: "Prometheus Data",
    sourceAccessMode: "read_only",
    learningVersion: {
      engine: readOnlyFieldSessionLearningVersion,
      contract: contract.version,
      policy: policy.policyVersion,
      sourceArchive: archivePackages[0]?.manifest?.schemaVersion || null
    },
    sourceEvidence: {
      approvedRecordKinds: [...contract.approvedRecordKinds],
      sessionIds: [...seenSessions].sort(),
      verifiedSessionCount: seenSessions.size,
      rawEvidenceConsumed: false,
      stressTestObservationsConsumed: false,
      failedSubmissionsConsumed: false,
      partialSessionsConsumed: false,
      unverifiedEvidenceConsumed: false,
      syntheticEvidenceConsumed: false,
      sourceMutationDetected: false
    },
    representativeIntelligence,
    territoryIntelligence,
    categoryIntelligence,
    businessIntelligence,
    learningConfidence,
    evidenceConfidence,
    learningHistory,
    recommendationSafety: {
      recommendationBehaviorChanged: false,
      routeScoringWeightsChanged: false,
      recommendationInfluenceActive: false,
      thresholdQualifiedConclusionCount: learningConfidence.filter(confidence => confidence.thresholdQualified).length,
      recommendationEligibleConclusionCount: learningConfidence.filter(confidence => confidence.recommendationInfluenceEligible).length,
      noRecommendationDriftWithoutEvidence: true
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

  const afterHash = stableHash(archivePackages);
  if (beforeHash !== afterHash) {
    throw new ReadOnlyFieldSessionLearningError("Archived field-session evidence changed during projection.", "field_session_learning_archive_mutation_detected");
  }
  const snapshotFailures = validateReadOnlyFieldSessionLearningSnapshot(snapshot, contract);
  if (snapshotFailures.length) {
    throw new ReadOnlyFieldSessionLearningError(
      `Read-only field-session learning snapshot is invalid: ${snapshotFailures.join(" | ")}`,
      "field_session_learning_snapshot_invalid",
      { failures: snapshotFailures }
    );
  }
  return deepFreeze(snapshot);
}

export function validateReadOnlyFieldSessionLearningSnapshot(snapshot, contract = loadReadOnlyFieldSessionLearningContract()) {
  const failures = [];
  const fail = (condition, reason) => {
    if (!condition) failures.push(reason);
  };
  fail(snapshot?.schemaVersion === "prometheus-intelligence-read-only-field-session-learning-snapshot-v1", "snapshot_schema_version_mismatch");
  fail(snapshot?.workspaceId === contract.workspaceId, "snapshot_workspace_mismatch");
  fail(snapshot?.operatingProfileId === contract.operatingProfileId, "snapshot_operating_profile_mismatch");
  fail(snapshot?.ownerSubsystem === "Prometheus Intelligence Engine", "snapshot_owner_mismatch");
  fail(snapshot?.sourceSubsystem === "Prometheus Data", "snapshot_source_owner_mismatch");
  fail(snapshot?.sourceAccessMode === "read_only", "snapshot_source_access_not_read_only");
  for (const output of contract.requiredOutputs || []) fail(snapshot?.[output] !== undefined, `snapshot_required_output_missing:${output}`);
  fail(snapshot?.sourceEvidence?.rawEvidenceConsumed === false, "snapshot_consumed_raw_evidence");
  fail(snapshot?.sourceEvidence?.stressTestObservationsConsumed === false, "snapshot_consumed_stress_test_observations");
  fail(snapshot?.sourceEvidence?.failedSubmissionsConsumed === false, "snapshot_consumed_failed_submission");
  fail(snapshot?.sourceEvidence?.partialSessionsConsumed === false, "snapshot_consumed_partial_session");
  fail(snapshot?.sourceEvidence?.unverifiedEvidenceConsumed === false, "snapshot_consumed_unverified_evidence");
  fail(snapshot?.sourceEvidence?.syntheticEvidenceConsumed === false, "snapshot_consumed_synthetic_evidence");
  fail(snapshot?.recommendationSafety?.recommendationBehaviorChanged === false, "snapshot_changed_recommendation_behavior");
  fail(snapshot?.recommendationSafety?.routeScoringWeightsChanged === false, "snapshot_changed_route_scoring_weights");
  fail(snapshot?.recommendationSafety?.recommendationInfluenceActive === false, "snapshot_activated_recommendation_influence");
  fail(snapshot?.recommendationSafety?.recommendationEligibleConclusionCount === 0, "snapshot_contains_recommendation_eligible_conclusion");
  fail(Object.values(snapshot?.archiveSafety || {}).every(value => value === false), "snapshot_archive_safety_regressed");
  for (const conclusion of allConclusions(snapshot || {})) {
    for (const field of contract.explainabilityRequiredFields || []) {
      fail(Object.prototype.hasOwnProperty.call(conclusion.explainability || {}, field), `snapshot_explainability_missing:${conclusion.intelligenceId}:${field}`);
    }
    fail(conclusion.confidence?.recommendationInfluenceEligible === false, `snapshot_conclusion_influences_recommendations:${conclusion.intelligenceId}`);
  }
  return failures;
}
