import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export const routeIqDailyIntelligenceSnapshotVersion = "route-iq-daily-intelligence-snapshot-v1";
export const routeIqDailyEvidenceVersion = "route-iq-governed-daily-evidence-v1";
export const routeIqDailyLearningAssessmentVersion = "route-iq-governed-learning-assessment-v1";
export const routeIqBusinessIntelligenceContextVersion = "route-iq-business-intelligence-context-v1";

const contractUrl = new URL("./contracts/route-iq-commercial-readiness-intelligence-v1.json", import.meta.url);
const strictOpaqueIdPattern = /^[a-z0-9][a-z0-9._:-]{2,159}$/;
const sha256Pattern = /^[a-f0-9]{64}$/;
const allowedRecordKinds = new Set(["field_session", "visit", "outcome", "learning_observation"]);
const allowedQualityStatuses = new Set(["VERIFIED", "PARTIAL", "UNKNOWN"]);
const allowedFreshnessStatuses = new Set(["FRESH", "STALE", "UNKNOWN"]);
const allowedLearningStates = new Set(["INSUFFICIENT_EVIDENCE", "OBSERVING"]);
const forbiddenInputKeys = new Set([
  "address",
  "businessAddress",
  "businessName",
  "contact",
  "contactName",
  "email",
  "latitude",
  "longitude",
  "name",
  "notes",
  "phone",
  "rawEvidence",
  "secret",
  "token"
]);
const metricNames = Object.freeze([
  "visits",
  "outcomes",
  "conversations",
  "leads",
  "appointments",
  "memberships",
  "units",
  "followUps"
]);

export class RouteIqDailyIntelligenceSnapshotError extends Error {
  constructor(message, code = "route_iq_daily_snapshot_error", details = {}) {
    super(message);
    this.name = "RouteIqDailyIntelligenceSnapshotError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, details = {}) {
  throw new RouteIqDailyIntelligenceSnapshotError(code, code, details);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, sortObject(value[key])]));
}

export function canonicalRouteIqIntelligenceJson(value) {
  return JSON.stringify(sortObject(value));
}

export function computeRouteIqIntelligenceSha256(value) {
  return createHash("sha256").update(canonicalRouteIqIntelligenceJson(value), "utf8").digest("hex");
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function isIsoTimestamp(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function assertOpaqueId(value, field) {
  if (!strictOpaqueIdPattern.test(String(value || ""))) fail("invalid_opaque_identifier", {field});
}

function getPath(value, path) {
  return path.split(".").reduce((current, key) => current?.[key], value);
}

function assertNoForbiddenInput(value, path = "input") {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenInputKeys.has(key)) fail("unauthorized_field_present", {path: `${path}.${key}`});
    assertNoForbiddenInput(child, `${path}.${key}`);
  }
}

function normalizeStringArray(values, field) {
  if (!Array.isArray(values)) fail("invalid_string_array", {field});
  return [...new Set(values.map(value => String(value || "").trim()).filter(Boolean))].sort();
}

function normalizeMetrics(metrics = {}) {
  const normalized = {};
  for (const name of metricNames) {
    const value = Number(metrics[name] ?? 0);
    if (!Number.isSafeInteger(value) || value < 0) fail("invalid_evidence_metric", {metric: name});
    normalized[name] = value;
  }
  return normalized;
}

function normalizeEvidenceRecord(record, context) {
  if (!record || typeof record !== "object" || Array.isArray(record)) fail("invalid_evidence_record");
  assertNoForbiddenInput(record, "evidenceRecord");
  if (record.schemaVersion !== routeIqDailyEvidenceVersion) fail("evidence_schema_mismatch");
  for (const [field, expected] of [["workspaceId", context.workspaceId], ["operatingProfileId", context.operatingProfileId]]) {
    if (record[field] !== expected) fail("evidence_scope_mismatch", {field});
  }
  for (const field of ["evidenceId", "workspaceId", "operatingProfileId", "representativeId"]) {
    assertOpaqueId(record[field], field);
  }
  if (record.locationId !== null && record.locationId !== undefined) assertOpaqueId(record.locationId, "locationId");
  if (record.territoryId !== null && record.territoryId !== undefined) assertOpaqueId(record.territoryId, "territoryId");
  if (!allowedRecordKinds.has(record.recordKind)) fail("unsupported_evidence_record_kind");
  if (!isIsoTimestamp(record.occurredAt)) fail("invalid_evidence_timestamp");
  if (!sha256Pattern.test(String(record.sourceRecordSha256 || ""))) fail("invalid_source_record_hash");
  if (!allowedQualityStatuses.has(record.qualityStatus)) fail("invalid_quality_status");
  if (!allowedFreshnessStatuses.has(record.freshnessStatus)) fail("invalid_freshness_status");
  if (record.authorized !== true) fail("unauthorized_evidence_record");
  if (record.excludedFromAnalytics !== false) fail("excluded_evidence_admission_denied");

  return {
    schemaVersion: routeIqDailyEvidenceVersion,
    evidenceId: record.evidenceId,
    recordKind: record.recordKind,
    workspaceId: record.workspaceId,
    operatingProfileId: record.operatingProfileId,
    representativeId: record.representativeId,
    locationId: record.locationId ?? null,
    territoryId: record.territoryId ?? null,
    occurredAt: record.occurredAt,
    sourceRecordSha256: record.sourceRecordSha256,
    authorized: true,
    excludedFromAnalytics: false,
    qualityStatus: record.qualityStatus,
    freshnessStatus: record.freshnessStatus,
    metrics: normalizeMetrics(record.metrics),
    qualityReasons: normalizeStringArray(record.qualityReasons || [], "qualityReasons"),
    sourceVersions: sortObject(record.sourceVersions || {})
  };
}

function normalizeBusinessContext(context, contract) {
  if (!context || typeof context !== "object" || Array.isArray(context)) fail("business_context_missing");
  assertNoForbiddenInput(context, "businessContext");
  if (context.schemaVersion !== routeIqBusinessIntelligenceContextVersion) fail("business_context_schema_mismatch");
  if (context.sourceOwner !== contract.businessContextInput.sourceOwner) fail("business_context_owner_mismatch");
  if (context.sourceMode !== contract.businessContextInput.sourceMode) fail("business_context_source_mode_mismatch");
  if (context.callerSupplied !== false) fail("caller_supplied_business_context_denied");
  for (const field of ["workspaceId", "operatingProfileId", "configurationVersion", "retentionPolicyVersion"]) {
    assertOpaqueId(context[field], field);
  }
  if (!sha256Pattern.test(String(context.canonicalConfigurationSha256 || ""))) fail("business_configuration_hash_invalid");
  if (!contract.businessContextInput.allowedEvidenceClassifications.includes(context.evidenceClassification)) {
    fail("evidence_classification_not_allowed");
  }
  if (context.classificationAuthority !== contract.businessContextInput.sourceOwner) fail("evidence_classification_authority_mismatch");
  if (context.workspaceId === "fitness_connection"
    && context.evidenceClassification !== contract.businessContextInput.fitnessConnectionRequiredClassification) {
    fail("fitness_connection_research_classification_required");
  }
  return {
    schemaVersion: routeIqBusinessIntelligenceContextVersion,
    sourceOwner: context.sourceOwner,
    sourceMode: context.sourceMode,
    callerSupplied: false,
    workspaceId: context.workspaceId,
    operatingProfileId: context.operatingProfileId,
    configurationVersion: context.configurationVersion,
    canonicalConfigurationSha256: context.canonicalConfigurationSha256,
    evidenceClassification: context.evidenceClassification,
    classificationAuthority: context.classificationAuthority,
    retentionPolicyVersion: context.retentionPolicyVersion
  };
}

function normalizeLearningAssessment(assessment, governedEvidenceSha256) {
  if (!assessment || typeof assessment !== "object" || Array.isArray(assessment)) fail("learning_assessment_missing");
  assertNoForbiddenInput(assessment, "learningAssessment");
  if (assessment.schemaVersion !== routeIqDailyLearningAssessmentVersion) fail("learning_assessment_schema_mismatch");
  if (assessment.sourceEvidenceSha256 !== governedEvidenceSha256) fail("learning_assessment_evidence_hash_mismatch");
  if (!allowedLearningStates.has(assessment.state)) fail("learning_assessment_state_invalid");
  if (assessment.recommendationInfluence !== "OFF") fail("recommendation_influence_must_remain_off");
  for (const flag of ["advisoryOnly", "readOnly"]) {
    if (assessment[flag] !== true) fail("learning_assessment_boundary_invalid", {flag});
  }
  for (const flag of ["routeOrderingChanged", "routeScoringWeightsChanged", "predictionClaimed", "causalClaimed"]) {
    if (assessment[flag] !== false) fail("learning_assessment_boundary_invalid", {flag});
  }
  const score = assessment.confidenceScore;
  if (score !== null && (!Number.isFinite(Number(score)) || Number(score) < 0 || Number(score) > 1)) {
    fail("learning_confidence_invalid");
  }
  const conclusionCount = Number(assessment.thresholdQualifiedConclusionCount);
  if (!Number.isSafeInteger(conclusionCount) || conclusionCount < 0) fail("learning_conclusion_count_invalid");
  if (assessment.state === "INSUFFICIENT_EVIDENCE" && conclusionCount > 0) fail("insufficiency_conclusion_conflict");

  return {
    schemaVersion: routeIqDailyLearningAssessmentVersion,
    sourceEvidenceSha256: governedEvidenceSha256,
    state: assessment.state,
    confidenceScore: score === null ? null : Number(score),
    confidenceBand: String(assessment.confidenceBand || "").trim(),
    thresholdQualifiedConclusionCount: conclusionCount,
    limitations: normalizeStringArray(assessment.limitations || [], "limitations"),
    advisoryOnly: true,
    readOnly: true,
    recommendationInfluence: "OFF",
    routeOrderingChanged: false,
    routeScoringWeightsChanged: false,
    predictionClaimed: false,
    causalClaimed: false
  };
}

function sumMetrics(records) {
  const totals = Object.fromEntries(metricNames.map(name => [name, 0]));
  for (const record of records) {
    for (const name of metricNames) totals[name] += record.metrics[name];
  }
  return totals;
}

function countBy(records, field) {
  const counts = new Map();
  for (const record of records) counts.set(record[field], (counts.get(record[field]) || 0) + 1);
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

function buildDailySeries(records) {
  const days = new Map();
  for (const record of records) {
    const day = record.occurredAt.slice(0, 10);
    if (!days.has(day)) days.set(day, []);
    days.get(day).push(record);
  }
  return [...days.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([date, dayRecords]) => ({
    date,
    evidenceRecords: dayRecords.length,
    ...sumMetrics(dayRecords)
  }));
}

function latest(values) {
  return [...values].sort().at(-1) || null;
}

function earliest(values) {
  return [...values].sort().at(0) || null;
}

function delta(current, previous) {
  return current - Number(previous || 0);
}

function buildChanges(current, previousSnapshot) {
  if (!previousSnapshot) {
    return {
      previousSnapshotId: null,
      governedEvidenceChanged: true,
      changeBasis: "INITIAL_GOVERNED_SNAPSHOT",
      evidenceRecordDelta: current.evidenceCollected.totalRecords,
      visitDelta: current.visitAndOutcomeTrends.totals.visits,
      outcomeDelta: current.visitAndOutcomeTrends.totals.outcomes,
      learningStateChanged: true
    };
  }
  return {
    previousSnapshotId: previousSnapshot.snapshotId,
    governedEvidenceChanged: true,
    changeBasis: "GOVERNED_EVIDENCE_HASH_CHANGED",
    evidenceRecordDelta: delta(current.evidenceCollected.totalRecords, previousSnapshot.evidenceCollected.totalRecords),
    visitDelta: delta(current.visitAndOutcomeTrends.totals.visits, previousSnapshot.visitAndOutcomeTrends.totals.visits),
    outcomeDelta: delta(current.visitAndOutcomeTrends.totals.outcomes, previousSnapshot.visitAndOutcomeTrends.totals.outcomes),
    learningStateChanged: current.confidence.state !== previousSnapshot.confidence.state
  };
}

function assertPreviousSnapshot(previousSnapshot, context) {
  if (!previousSnapshot) return;
  const failures = validateRouteIqDailyIntelligenceSnapshot(previousSnapshot);
  if (failures.length) fail("previous_snapshot_invalid", {failures});
  if (previousSnapshot.workspaceId !== context.workspaceId
    || previousSnapshot.operatingProfileId !== context.operatingProfileId) {
    fail("previous_snapshot_scope_mismatch");
  }
}

export function loadRouteIqCommercialReadinessIntelligenceContract() {
  return JSON.parse(readFileSync(contractUrl, "utf8"));
}

export function authorizeRouteIqFounderIntelligencePrincipal(principal, contract = loadRouteIqCommercialReadinessIntelligenceContract()) {
  if (!principal || typeof principal !== "object" || Array.isArray(principal)) fail("founder_principal_missing");
  if (principal.identityContextSource !== contract.founderAccess.identityContextSource) fail("identity_context_source_invalid");
  if (principal.authenticationAuthority !== contract.founderAccess.authenticationAuthority) fail("authentication_authority_invalid");
  if (principal.authenticated !== true || principal.callerSupplied !== false) fail("server_verified_authentication_required");
  if (principal.role !== contract.founderAccess.requiredRole) fail("founder_role_required");
  const mapping = contract.founderAccess.authorizedMappings.find(candidate => (
    candidate.mappingId === principal.mappingId
    && candidate.immutablePrincipalId === principal.immutablePrincipalId
    && candidate.status === "securely_mapped"
  ));
  if (!mapping || principal.mappingStatus !== mapping.status) fail("founder_principal_not_authorized");
  return deepFreeze({
    authorized: true,
    audience: "founder_only",
    mappingId: mapping.mappingId,
    immutablePrincipalId: mapping.immutablePrincipalId
  });
}

export function normalizeRouteIqGovernedDailyEvidence(records, businessContext, contract = loadRouteIqCommercialReadinessIntelligenceContract()) {
  const context = normalizeBusinessContext(businessContext, contract);
  if (!Array.isArray(records) || records.length === 0) fail("governed_evidence_missing");
  const normalized = records.map(record => normalizeEvidenceRecord(record, context)).sort((left, right) => (
    left.occurredAt.localeCompare(right.occurredAt)
    || left.recordKind.localeCompare(right.recordKind)
    || left.evidenceId.localeCompare(right.evidenceId)
  ));
  const identities = new Set();
  for (const record of normalized) {
    if (identities.has(record.evidenceId)) fail("duplicate_evidence_identity", {evidenceId: record.evidenceId});
    identities.add(record.evidenceId);
  }
  return deepFreeze({context, records: normalized});
}

export function computeRouteIqGovernedEvidenceHash(records, businessContext, contract = loadRouteIqCommercialReadinessIntelligenceContract()) {
  const normalized = normalizeRouteIqGovernedDailyEvidence(records, businessContext, contract);
  return computeRouteIqIntelligenceSha256(normalized);
}

export function buildRouteIqDailyIntelligenceSnapshot({
  principal,
  businessContext,
  records,
  learningAssessment,
  previousSnapshot = null,
  contract = loadRouteIqCommercialReadinessIntelligenceContract()
} = {}) {
  authorizeRouteIqFounderIntelligencePrincipal(principal, contract);
  const governed = normalizeRouteIqGovernedDailyEvidence(records, businessContext, contract);
  assertPreviousSnapshot(previousSnapshot, governed.context);
  const governedEvidenceSha256 = computeRouteIqIntelligenceSha256(governed);
  const assessment = normalizeLearningAssessment(learningAssessment, governedEvidenceSha256);
  const governedInputSha256 = computeRouteIqIntelligenceSha256({governed, assessment});

  if (previousSnapshot?.governedInputSha256 === governedInputSha256) return deepFreeze(clone(previousSnapshot));

  const timestamps = governed.records.map(record => record.occurredAt);
  const dailySeries = buildDailySeries(governed.records);
  const totals = sumMetrics(governed.records);
  const latestEvidenceAt = latest(timestamps);
  const freshnessCounts = countBy(governed.records, "freshnessStatus");
  const qualityCounts = countBy(governed.records, "qualityStatus");
  const representatives = [...new Set(governed.records.map(record => record.representativeId))].sort();
  const locations = [...new Set(governed.records.map(record => record.locationId).filter(Boolean))].sort();
  const territories = [...new Set(governed.records.map(record => record.territoryId).filter(Boolean))].sort();
  const evidenceCollected = {
    totalRecords: governed.records.length,
    byRecordKind: countBy(governed.records, "recordKind"),
    sourceRecordHashes: governed.records.map(record => record.sourceRecordSha256).sort(),
    evidenceClassification: governed.context.evidenceClassification
  };
  const evidenceFreshness = {
    earliestEvidenceAt: earliest(timestamps),
    latestEvidenceAt,
    snapshotDate: latestEvidenceAt.slice(0, 10),
    status: freshnessCounts.STALE ? "MIXED_OR_STALE" : freshnessCounts.UNKNOWN ? "UNKNOWN_PRESENT" : "FRESH_TO_GOVERNED_EVIDENCE",
    byStatus: freshnessCounts,
    wallClockAgeCalculated: false
  };
  const dataQuality = {
    status: qualityCounts.PARTIAL || qualityCounts.UNKNOWN ? "REVIEW_REQUIRED" : "VERIFIED",
    byStatus: qualityCounts,
    exclusionRecordsAdmitted: 0,
    rawNotesConsumed: false,
    contactInformationConsumed: false,
    preciseLocationTrailsConsumed: false
  };
  const visitAndOutcomeTrends = {
    totals,
    daily: dailySeries,
    outcomeLinkRatePercent: totals.visits > 0 ? Math.round((totals.outcomes / totals.visits) * 10000) / 100 : null,
    observationalOnly: true
  };
  const learningCoverage = {
    representativesObserved: representatives.length,
    locationsObserved: locations.length,
    territoriesObserved: territories.length,
    representativeIds: representatives,
    locationIds: locations,
    territoryIds: territories,
    verifiedEvidenceRecords: qualityCounts.VERIFIED || 0,
    thresholdQualifiedConclusionCount: assessment.thresholdQualifiedConclusionCount,
    coverageState: assessment.state
  };
  const confidence = {
    state: assessment.state,
    score: assessment.confidenceScore,
    band: assessment.confidenceBand,
    limitations: assessment.limitations,
    insufficiencyIsRecommendation: false,
    predictionClaimed: false,
    causalClaimed: false
  };
  const draft = {
    schemaVersion: routeIqDailyIntelligenceSnapshotVersion,
    snapshotId: `route-iq-daily-snapshot-${governedInputSha256.slice(0, 24)}`,
    ownerSubsystem: "Prometheus Intelligence Engine",
    audience: "founder_only",
    workspaceId: governed.context.workspaceId,
    operatingProfileId: governed.context.operatingProfileId,
    businessConfigurationVersion: governed.context.configurationVersion,
    evidenceClassification: governed.context.evidenceClassification,
    classificationAuthority: governed.context.classificationAuthority,
    retentionPolicyVersion: governed.context.retentionPolicyVersion,
    generatedFromEvidenceAt: latestEvidenceAt,
    governedEvidenceSha256,
    governedInputSha256,
    evidenceCollected,
    evidenceFreshness,
    dataQuality,
    visitAndOutcomeTrends,
    learningCoverage,
    confidence,
    changesSincePrevious: null,
    safety: {
      readOnly: true,
      founderOnly: true,
      representativeReadable: false,
      recommendationInfluence: "OFF",
      routeOrderingChanged: false,
      routeScoringWeightsChanged: false,
      discoveryModeInfluenceChanged: false,
      nearbyContextInfluenceChanged: false,
      offRouteLearningInfluenceChanged: false,
      sourceEvidenceMutationAllowed: false
    }
  };
  draft.changesSincePrevious = buildChanges(draft, previousSnapshot);
  draft.snapshotSha256 = computeRouteIqIntelligenceSha256(draft);
  const failures = validateRouteIqDailyIntelligenceSnapshot(draft, contract);
  if (failures.length) fail("generated_snapshot_invalid", {failures});
  return deepFreeze(draft);
}

export function validateRouteIqCommercialReadinessIntelligenceContract(contract = loadRouteIqCommercialReadinessIntelligenceContract()) {
  const failures = [];
  const requireValue = (condition, reason) => {
    if (!condition) failures.push(reason);
  };
  requireValue(contract?.contractVersion === "route-iq-commercial-readiness-intelligence-v1", "contract_version_mismatch");
  requireValue(contract?.status === "active_read_only_founder_snapshot", "contract_status_invalid");
  requireValue(contract?.ownerSubsystem === "Prometheus Intelligence Engine", "contract_owner_invalid");
  requireValue(contract?.businessContextInput?.callerSuppliedContextAllowed === false, "caller_business_context_allowed");
  requireValue(contract?.businessContextInput?.fitnessConnectionRequiredClassification === "FOUNDER_FIELD_RESEARCH", "fitness_research_classification_missing");
  requireValue(contract?.founderAccess?.canonicalIdentitySourceOwner === "Prometheus Data", "canonical_identity_owner_invalid");
  requireValue(contract?.founderAccess?.canonicalIdentitySourcePath === "data/route-iq-commercial-readiness-v1/route-iq-commercial-workspace-registry-v1.json", "canonical_identity_source_invalid");
  requireValue(contract?.founderAccess?.canonicalIdentityRegistryVersion === "route-iq-commercial-workspace-registry-v1", "canonical_identity_registry_version_invalid");
  requireValue(contract?.founderAccess?.crossConsumerPrincipalEqualityRequired === true, "cross_consumer_principal_equality_not_required");
  requireValue(contract?.founderAccess?.displayNameAuthorizationAllowed === false, "display_name_authorization_allowed");
  requireValue(contract?.founderAccess?.representativeAccessAllowed === false, "representative_intelligence_access_allowed");
  requireValue(contract?.founderAccess?.authorizedMappings?.length === 1, "founder_mapping_count_invalid");
  requireValue(contract?.founderAccess?.authorizedMappings?.[0]?.mappingId === "route-iq-founder-access-cruz-v1", "cruz_mapping_missing");
  requireValue(contract?.founderAccess?.authorizedMappings?.[0]?.immutablePrincipalId === "riq_principal_7250bf2f7db15371eea3173c4f25953cffd6adf5b29f093ce8f9f0977a70e3c4", "cruz_canonical_principal_invalid");
  requireValue(contract?.founderAccess?.pendingMappings?.some(mapping => mapping.person === "anthony" && mapping.accessAllowed === false), "anthony_pending_mapping_missing");
  requireValue(contract?.snapshotContract?.wallClockAllowed === false, "snapshot_wall_clock_allowed");
  requireValue(contract?.snapshotContract?.unchangedEvidenceReturnsPriorSnapshotByteEquivalent === true, "unchanged_snapshot_not_stable");
  requireValue(contract?.learningBoundary?.recommendationInfluence === "OFF", "recommendation_influence_enabled");
  requireValue(contract?.safety?.routeOrderingChanged === false, "route_ordering_changed");
  requireValue(contract?.safety?.routeScoringWeightsChanged === false, "route_scoring_changed");

  for (const dependency of contract?.advisoryDependencies || []) {
    let source;
    try {
      source = JSON.parse(readFileSync(new URL(`../${dependency.contractPath.replace(/^intelligence\//, "")}`, contractUrl), "utf8"));
    } catch {
      failures.push(`advisory_contract_unreadable:${dependency.feature}`);
      continue;
    }
    requireValue(source.status === dependency.requiredStatus, `advisory_status_invalid:${dependency.feature}`);
    for (const flag of dependency.requiredFalseFlags || []) {
      requireValue(getPath(source, flag) === false, `advisory_influence_flag_enabled:${dependency.feature}:${flag}`);
    }
  }
  return failures;
}

export function validateRouteIqDailyIntelligenceSnapshot(snapshot, contract = loadRouteIqCommercialReadinessIntelligenceContract()) {
  const failures = [];
  const requireValue = (condition, reason) => {
    if (!condition) failures.push(reason);
  };
  requireValue(snapshot?.schemaVersion === routeIqDailyIntelligenceSnapshotVersion, "snapshot_schema_mismatch");
  requireValue(snapshot?.ownerSubsystem === "Prometheus Intelligence Engine", "snapshot_owner_invalid");
  requireValue(snapshot?.audience === "founder_only", "snapshot_audience_invalid");
  requireValue(strictOpaqueIdPattern.test(String(snapshot?.workspaceId || "")), "snapshot_workspace_invalid");
  requireValue(strictOpaqueIdPattern.test(String(snapshot?.operatingProfileId || "")), "snapshot_profile_invalid");
  requireValue(isIsoTimestamp(snapshot?.generatedFromEvidenceAt), "snapshot_evidence_timestamp_invalid");
  requireValue(sha256Pattern.test(String(snapshot?.governedEvidenceSha256 || "")), "snapshot_evidence_hash_invalid");
  requireValue(sha256Pattern.test(String(snapshot?.governedInputSha256 || "")), "snapshot_input_hash_invalid");
  for (const section of contract?.snapshotContract?.requiredSections || []) requireValue(Boolean(snapshot?.[section]), `snapshot_section_missing:${section}`);
  requireValue(allowedLearningStates.has(snapshot?.confidence?.state), "snapshot_confidence_state_invalid");
  requireValue(snapshot?.confidence?.insufficiencyIsRecommendation === false, "snapshot_insufficiency_presented_as_recommendation");
  requireValue(snapshot?.confidence?.predictionClaimed === false, "snapshot_prediction_claimed");
  requireValue(snapshot?.confidence?.causalClaimed === false, "snapshot_causal_claimed");
  requireValue(snapshot?.dataQuality?.exclusionRecordsAdmitted === 0, "snapshot_excluded_evidence_admitted");
  requireValue(snapshot?.dataQuality?.rawNotesConsumed === false, "snapshot_raw_notes_consumed");
  requireValue(snapshot?.safety?.readOnly === true, "snapshot_not_read_only");
  requireValue(snapshot?.safety?.founderOnly === true, "snapshot_not_founder_only");
  requireValue(snapshot?.safety?.representativeReadable === false, "snapshot_representative_readable");
  requireValue(snapshot?.safety?.recommendationInfluence === "OFF", "snapshot_recommendation_influence_enabled");
  requireValue(snapshot?.safety?.routeOrderingChanged === false, "snapshot_route_order_changed");
  requireValue(snapshot?.safety?.routeScoringWeightsChanged === false, "snapshot_route_scoring_changed");
  if (snapshot?.workspaceId === "fitness_connection") {
    requireValue(snapshot?.evidenceClassification === "FOUNDER_FIELD_RESEARCH", "snapshot_fitness_research_classification_missing");
  }
  if (sha256Pattern.test(String(snapshot?.snapshotSha256 || ""))) {
    const copy = clone(snapshot);
    delete copy.snapshotSha256;
    requireValue(computeRouteIqIntelligenceSha256(copy) === snapshot.snapshotSha256, "snapshot_hash_mismatch");
  } else {
    failures.push("snapshot_hash_invalid");
  }
  return failures;
}
