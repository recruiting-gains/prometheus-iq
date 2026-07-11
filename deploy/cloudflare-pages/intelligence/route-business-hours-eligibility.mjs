import {
  BUSINESS_HOURS_STATUSES,
  DEFAULT_BUSINESS_HOURS_POLICY,
  evaluateBusinessHoursRecord,
  validateBusinessHoursArtifact
} from "../scripts/lib/business-hours-governance.mjs";

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
  failClosed = false
}) {
  const uncertain = uncertainStatuses.has(status);
  const confidence = cleanText(record?.hoursConfidence, 20) || "NONE";
  const provenance = hoursProvenance(record);
  const marker = uncertain ? hoursNotVerifiedMarker : status === "CLOSED_VERIFIED" ? "CLOSED_NOW" : null;
  return {
    version: routeBusinessHoursEligibilityVersion,
    workspaceId: cleanText(record?.workspaceId || candidate?.workspaceId, 80) || routeBusinessHoursWorkspaceId,
    operatingProfileId: cleanText(record?.operatingProfileId || candidate?.operatingProfileId, 80) || routeBusinessHoursOperatingProfileId,
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

function assertRouteBusinessHoursScope(workspaceId, operatingProfileId) {
  if (workspaceId !== routeBusinessHoursWorkspaceId) {
    throw new Error(`Unknown Route IQ business-hours workspace: ${workspaceId || "missing"}`);
  }
  if (operatingProfileId !== routeBusinessHoursOperatingProfileId) {
    throw new Error(`Route IQ business-hours operating profile mismatch: ${operatingProfileId || "missing"}`);
  }
}

export function buildRouteBusinessHoursIndex(artifact, options = {}) {
  const workspaceId = options.workspaceId || routeBusinessHoursWorkspaceId;
  const operatingProfileId = options.operatingProfileId || routeBusinessHoursOperatingProfileId;
  assertRouteBusinessHoursScope(workspaceId, operatingProfileId);
  const failures = validateBusinessHoursArtifact(artifact, workspaceId);
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
  operatingProfileId = routeBusinessHoursOperatingProfileId
} = {}) {
  const instant = evaluationInstant(evaluatedAt);
  try {
    assertRouteBusinessHoursScope(workspaceId, operatingProfileId);
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
      failClosed: true
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
      failClosed: true
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
      freshness: "MISSING"
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
      failClosed: true
    });
  }

  let evaluated;
  try {
    evaluated = evaluateBusinessHoursRecord(record, instant, policy);
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
      failClosed: true
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
      failClosed: true
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
    failClosed: false
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
