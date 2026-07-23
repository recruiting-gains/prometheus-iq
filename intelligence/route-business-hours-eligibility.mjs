import {
  BUSINESS_HOURS_STATUSES,
  DEFAULT_BUSINESS_HOURS_POLICY,
  HOURS_CONFIDENCE_VALUES,
  HOURS_FRESHNESS_STATUSES,
  evaluateBusinessHoursRecord,
  validateBusinessHoursArtifact
} from "../scripts/lib/business-hours-governance.mjs";
import {
  assertGovernedRouteRuntimeScope,
  createGovernedRouteRuntimeScopeFromBusinessHoursArtifact,
  routeIqGovernedRuntimeAuthorizations
} from "./route-iq-governed-runtime-scope.mjs";

export const routeBusinessHoursEligibilityVersion = "route-iq-closed-now-eligibility-v1";
export const routeBusinessHoursWorkspaceId = "fitness_connection";
export const routeBusinessHoursOperatingProfileId = "fitness";
export const hoursNotVerifiedMarker = "HOURS_NOT_VERIFIED";

const uncertainStatuses = new Set([
  "HOURS_UNKNOWN",
  "HOURS_STALE",
  "SPECIAL_HOURS_UNVERIFIED"
]);

function cleanText(value, maximum = 500) {
  return String(value ?? "").trim().slice(0, maximum);
}

function evaluationInstant(value) {
  const instant = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(instant.getTime())) throw new Error(`Invalid Route IQ business-hours evaluation time: ${value}`);
  return instant;
}

function hoursProvenance(record) {
  const source = record?.hoursProvenance || {};
  return {
    sourceSystem: cleanText(source.sourceSystem, 120) || null,
    sourceMethod: cleanText(source.sourceMethod, 120) || null,
    sourcePlaceId: cleanText(source.sourcePlaceId, 180) || null,
    retrievedAt: cleanText(source.retrievedAt, 40) || null,
    normalizedAt: cleanText(source.normalizedAt, 40) || null,
    fieldEvidenceIds: Array.isArray(source.fieldEvidenceIds)
      ? source.fieldEvidenceIds.map(value => cleanText(value, 180)).filter(Boolean).slice(0, 25)
      : []
  };
}

function decision({
  record = null,
  candidate = null,
  evaluatedAt,
  status,
  eligible,
  selectionTier,
  reasonCode,
  reason,
  freshness,
  businessLocalDate = null,
  businessLocalTime = null,
  failClosed = false,
  workspaceId = null,
  operatingProfileId = null
}) {
  const uncertain = uncertainStatuses.has(status);
  const confidence = cleanText(record?.hoursConfidence, 20) || "NONE";
  const provenance = hoursProvenance(record);
  const marker = uncertain ? hoursNotVerifiedMarker : status === "CLOSED_VERIFIED" ? "CLOSED_NOW" : null;
  return {
    version: routeBusinessHoursEligibilityVersion,
    workspaceId: cleanText(workspaceId || record?.workspaceId || candidate?.workspaceId, 80) || routeBusinessHoursWorkspaceId,
    operatingProfileId: cleanText(operatingProfileId || record?.operatingProfileId || candidate?.operatingProfileId, 80) || routeBusinessHoursOperatingProfileId,
    googlePlaceId: cleanText(record?.googlePlaceId || candidate?.googlePlaceId, 180) || null,
    permanentOperationalStatus: cleanText(record?.permanentOperationalStatus || candidate?.businessStatus, 40) || "UNKNOWN",
    status,
    eligible,
    coverageOnly: uncertain && eligible,
    selectionTier,
    internalMarker: marker,
    hoursConfidence: confidence,
    hoursFreshness: cleanText(freshness, 20) || "MISSING",
    reasonCode: cleanText(reasonCode, 160) || "HOURS_STATUS_UNAVAILABLE",
    reason: cleanText(reason, 600) || "Business-hours eligibility could not be verified.",
    evaluatedAt: evaluatedAt.toISOString(),
    businessLocalDate,
    businessLocalTime,
    businessTimezone: cleanText(record?.businessTimezone, 120) || null,
    sourceRetrievedAt: cleanText(record?.sourceRetrievedAt, 40) || null,
    hoursVerifiedAt: cleanText(record?.hoursVerifiedAt, 40) || null,
    sourceStatus: cleanText(record?.currentOpenClosedEligibilityStatus, 40) || null,
    sourceStatusEvaluatedAt: cleanText(record?.currentStatusEvaluatedAt, 40) || null,
    provenance,
    failClosed,
    scoringChanged: false,
    explanation: {
      recommendationScore: "UNCHANGED",
      businessHoursEligibility: status,
      hoursConfidence: confidence,
      hoursFreshness: cleanText(freshness, 20) || "MISSING",
      reasonCode: cleanText(reasonCode, 160) || "HOURS_STATUS_UNAVAILABLE",
      reason: cleanText(reason, 600) || "Business-hours eligibility could not be verified.",
      provenance
    },
    displayLabel: status === "OPEN_VERIFIED" ? "Verified open" : uncertain ? "Hours not verified" : "Closed now"
  };
}

function isHistoricalFitnessScope(workspaceId, operatingProfileId) {
  return workspaceId === routeBusinessHoursWorkspaceId
    && operatingProfileId === routeBusinessHoursOperatingProfileId;
}

function assertRouteBusinessHoursScope(workspaceId, operatingProfileId, governedRuntimeScope = null) {
  if (isHistoricalFitnessScope(workspaceId, operatingProfileId)) return null;
  return assertGovernedRouteRuntimeScope({
    workspaceId,
    operatingProfileId,
    governedRuntimeScope,
    requiredAuthorization: routeIqGovernedRuntimeAuthorizations.businessHoursEligibility
  });
}

function validateGovernedBusinessHoursArtifact(artifact, workspaceId, operatingProfileId) {
  const failures = [];
  if (!artifact || typeof artifact !== "object" || Array.isArray(artifact)) return ["Business-hours artifact is missing or invalid."];
  if (artifact.schemaVersion !== "prometheus-data-business-hours-v1") failures.push("Business-hours schemaVersion mismatch.");
  if (artifact.artifactVersion !== "business-hours-v1") failures.push("Business-hours artifactVersion mismatch.");
  if (artifact.workspaceId !== workspaceId) failures.push("Business-hours workspace mismatch.");
  if (artifact.operatingProfileId !== operatingProfileId) failures.push("Business-hours operating profile mismatch.");
  if (artifact.routeEligibilityActivated !== false) failures.push("Business-hours artifact must not activate route eligibility.");
  if (artifact.runtimeBehaviorChanged !== false) failures.push("Business-hours artifact must preserve runtime behavior.");
  if (artifact.scoringChanged !== false) failures.push("Business-hours artifact must preserve scoring.");
  if (!Array.isArray(artifact.records)) failures.push("Business-hours records must be an array.");
  if (artifact.recordCount !== (artifact.records || []).length) failures.push("Business-hours recordCount mismatch.");
  if (!Number.isFinite(Number(artifact.freshnessPolicy?.freshnessThresholdHours))) failures.push("Business-hours freshness threshold is missing.");
  const seen = new Set();
  for (const record of artifact.records || []) {
    const placeId = cleanText(record?.googlePlaceId, 180);
    if (!placeId) failures.push("Business-hours record Place ID is missing.");
    if (seen.has(placeId)) failures.push(`Duplicate business-hours Place ID: ${placeId}`);
    seen.add(placeId);
    if (record?.workspaceId !== workspaceId || record?.operatingProfileId !== operatingProfileId) {
      failures.push(`Cross-scope business-hours record: ${placeId || "unknown"}`);
    }
    if (!cleanText(record?.businessName, 180)) failures.push(`Missing business-hours business name: ${placeId || "unknown"}`);
    if (!cleanText(record?.address, 300)) failures.push(`Missing business-hours address: ${placeId || "unknown"}`);
    if (!cleanText(record?.permanentOperationalStatus, 40)) failures.push(`Missing permanent operational status: ${placeId || "unknown"}`);
    if (!BUSINESS_HOURS_STATUSES.includes(record?.currentOpenClosedEligibilityStatus)) failures.push(`Invalid current hours status: ${placeId || "unknown"}`);
    if (!HOURS_FRESHNESS_STATUSES.includes(record?.hoursFreshnessStatus)) failures.push(`Invalid hours freshness status: ${placeId || "unknown"}`);
    if (!HOURS_CONFIDENCE_VALUES.includes(record?.hoursConfidence)) failures.push(`Invalid hours confidence: ${placeId || "unknown"}`);
    if (!cleanText(record?.currentStatusReasonCode, 160) || !cleanText(record?.currentStatusReason, 600)) {
      failures.push(`Missing explainable hours status reason: ${placeId || "unknown"}`);
    }
    if (!record?.hoursProvenance || typeof record.hoursProvenance !== "object") failures.push(`Missing business-hours provenance: ${placeId || "unknown"}`);
  }
  return failures;
}

export function buildRouteBusinessHoursIndex(artifact, options = {}) {
  const workspaceId = options.workspaceId || artifact?.workspaceId || routeBusinessHoursWorkspaceId;
  const operatingProfileId = options.operatingProfileId || artifact?.operatingProfileId || routeBusinessHoursOperatingProfileId;
  let governedRuntimeScope = null;
  let failures;
  if (isHistoricalFitnessScope(workspaceId, operatingProfileId)) {
    assertRouteBusinessHoursScope(workspaceId, operatingProfileId);
    failures = validateBusinessHoursArtifact(artifact, workspaceId);
  } else {
    governedRuntimeScope = createGovernedRouteRuntimeScopeFromBusinessHoursArtifact(artifact);
    assertRouteBusinessHoursScope(workspaceId, operatingProfileId, governedRuntimeScope);
    failures = validateGovernedBusinessHoursArtifact(artifact, workspaceId, operatingProfileId);
  }
  if (failures.length) throw new Error(`Route IQ business-hours artifact is invalid: ${failures.join(" | ")}`);
  if (artifact.operatingProfileId !== operatingProfileId) throw new Error("Route IQ business-hours artifact operating profile mismatch.");
  const recordsByPlaceId = new Map();
  for (const record of artifact.records) recordsByPlaceId.set(record.googlePlaceId, record);
  return {
    version: routeBusinessHoursEligibilityVersion,
    workspaceId,
    operatingProfileId,
    generatedAt: artifact.generatedAt,
    statusEvaluatedAt: artifact.statusEvaluatedAt,
    sourceDatasetVersion: artifact.sourceDatasetVersion,
    governedRuntimeScope,
    freshnessPolicy: { ...DEFAULT_BUSINESS_HOURS_POLICY, ...(artifact.freshnessPolicy || {}) },
    recordCount: recordsByPlaceId.size,
    recordsByPlaceId
  };
}

export function evaluateRouteBusinessHoursEligibility({
  record = null,
  candidate = null,
  evaluatedAt = new Date(),
  policy = DEFAULT_BUSINESS_HOURS_POLICY,
  artifactAvailable = true,
  workspaceId = routeBusinessHoursWorkspaceId,
  operatingProfileId = routeBusinessHoursOperatingProfileId,
  governedRuntimeScope = null
} = {}) {
  const instant = evaluationInstant(evaluatedAt);
  const decisionScope = { workspaceId, operatingProfileId };
  try {
    assertRouteBusinessHoursScope(workspaceId, operatingProfileId, governedRuntimeScope);
  } catch (error) {
    return decision({
      record,
      candidate,
      evaluatedAt: instant,
      status: "HOURS_UNKNOWN",
      eligible: false,
      selectionTier: 99,
      reasonCode: "HOURS_WORKSPACE_SCOPE_REJECTED",
      reason: error.message,
      freshness: "MISSING",
      failClosed: true,
      ...decisionScope
    });
  }

  if (!artifactAvailable) {
    return decision({
      record,
      candidate,
      evaluatedAt: instant,
      status: "HOURS_UNKNOWN",
      eligible: false,
      selectionTier: 99,
      reasonCode: "BUSINESS_HOURS_ARTIFACT_UNAVAILABLE",
      reason: "The governed business-hours artifact is unavailable, so Route IQ failed closed.",
      freshness: "MISSING",
      failClosed: true,
      ...decisionScope
    });
  }

  if (!record) {
    return decision({
      candidate,
      evaluatedAt: instant,
      status: "HOURS_UNKNOWN",
      eligible: true,
      selectionTier: 1,
      reasonCode: "BUSINESS_HOURS_RECORD_UNAVAILABLE",
      reason: "No governed business-hours record is available for this candidate.",
      freshness: "MISSING",
      ...decisionScope
    });
  }

  if (record.workspaceId !== workspaceId || record.operatingProfileId !== operatingProfileId) {
    return decision({
      record,
      candidate,
      evaluatedAt: instant,
      status: "HOURS_UNKNOWN",
      eligible: false,
      selectionTier: 99,
      reasonCode: "HOURS_RECORD_SCOPE_MISMATCH",
      reason: "The governed business-hours record does not belong to the active workspace and operating profile.",
      freshness: record.hoursFreshnessStatus || "MISSING",
      failClosed: true,
      ...decisionScope
    });
  }

  let evaluated;
  try {
    // The canonical evaluator's static registry remains Fitness-only; provenance was authenticated above.
    const evaluationRecord = isHistoricalFitnessScope(workspaceId, operatingProfileId)
      ? record
      : { ...record, workspaceId: routeBusinessHoursWorkspaceId, operatingProfileId: routeBusinessHoursOperatingProfileId };
    evaluated = evaluateBusinessHoursRecord(evaluationRecord, instant, policy);
  } catch (error) {
    return decision({
      record,
      candidate,
      evaluatedAt: instant,
      status: "HOURS_UNKNOWN",
      eligible: false,
      selectionTier: 99,
      reasonCode: cleanText(error?.code, 160) || "HOURS_EVALUATION_FAILED",
      reason: cleanText(error?.message, 600) || "Business-hours evaluation failed.",
      freshness: record.hoursFreshnessStatus || "MISSING",
      failClosed: true,
      ...decisionScope
    });
  }

  if (!BUSINESS_HOURS_STATUSES.includes(evaluated.status)) {
    return decision({
      record,
      candidate,
      evaluatedAt: instant,
      status: "HOURS_UNKNOWN",
      eligible: false,
      selectionTier: 99,
      reasonCode: "HOURS_STATUS_INVALID",
      reason: "The governed business-hours evaluator returned an unsupported status.",
      freshness: evaluated.hoursFreshnessStatus || "MISSING",
      failClosed: true,
      ...decisionScope
    });
  }

  return decision({
    record,
    candidate,
    evaluatedAt: instant,
    status: evaluated.status,
    eligible: evaluated.status !== "CLOSED_VERIFIED",
    selectionTier: evaluated.status === "OPEN_VERIFIED" ? 0 : evaluated.status === "CLOSED_VERIFIED" ? 99 : 1,
    reasonCode: evaluated.reasonCode,
    reason: evaluated.reason,
    freshness: evaluated.hoursFreshnessStatus,
    businessLocalDate: evaluated.businessLocalDate,
    businessLocalTime: evaluated.businessLocalTime,
    failClosed: false,
    ...decisionScope
  });
}

export function applyHoursEligibilityToScore(scoreResult, eligibility) {
  const normalized = typeof scoreResult === "number" ? { score: scoreResult, signals: [] } : { ...(scoreResult || {}) };
  const score = Number(normalized.score);
  if (!Number.isFinite(score)) throw new Error("Route IQ score must remain finite when hours eligibility is applied.");
  const hoursSignal = eligibility.status === "OPEN_VERIFIED" ? "business hours verified open" : "business hours not verified";
  return {
    ...normalized,
    score,
    selectionTier: eligibility.selectionTier,
    eligibility,
    signals: [...new Set([...(Array.isArray(normalized.signals) ? normalized.signals : []), hoursSignal])]
  };
}

export function summarizeRouteBusinessHours(decisions = []) {
  const summary = {
    evaluated: 0,
    eligible: 0,
    excluded: 0,
    hoursUnverified: 0,
    statuses: Object.fromEntries(BUSINESS_HOURS_STATUSES.map(status => [status, 0])),
    reasonCodes: {}
  };
  for (const item of decisions) {
    if (!item) continue;
    summary.evaluated += 1;
    if (item.eligible) summary.eligible += 1;
    else summary.excluded += 1;
    if (item.internalMarker === hoursNotVerifiedMarker) summary.hoursUnverified += 1;
    if (summary.statuses[item.status] !== undefined) summary.statuses[item.status] += 1;
    summary.reasonCodes[item.reasonCode] = (summary.reasonCodes[item.reasonCode] || 0) + 1;
  }
  return summary;
}
