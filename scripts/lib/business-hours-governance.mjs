import fs from "node:fs";
import path from "node:path";

export const BUSINESS_HOURS_STATUSES = Object.freeze([
  "OPEN_VERIFIED",
  "CLOSED_VERIFIED",
  "HOURS_UNKNOWN",
  "HOURS_STALE",
  "SPECIAL_HOURS_UNVERIFIED"
]);

export const HOURS_FRESHNESS_STATUSES = Object.freeze([
  "FRESH",
  "STALE",
  "MISSING"
]);

export const HOURS_CONFIDENCE_VALUES = Object.freeze([
  "HIGH",
  "MEDIUM",
  "LOW",
  "NONE"
]);

export const DEFAULT_BUSINESS_HOURS_POLICY = Object.freeze({
  providerRefreshIntervalHours: 24,
  statusEvaluationIntervalMinutes: 15,
  freshnessThresholdHours: 168,
  fieldObservationFreshnessMinutes: 240,
  staleStatus: "HOURS_STALE",
  missingStatus: "HOURS_UNKNOWN",
  unverifiedSpecialHoursStatus: "SPECIAL_HOURS_UNVERIFIED"
});

export const BUSINESS_HOURS_WORKSPACES = Object.freeze({
  fitness_connection: Object.freeze({
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    protectedWorkspaceIds: Object.freeze(["smoothie_depot"])
  })
});

const DAY_INDEX = Object.freeze({
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6
});
const MINUTES_PER_DAY = 24 * 60;
const MINUTES_PER_WEEK = 7 * MINUTES_PER_DAY;

function governanceError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value || {}, key);
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function nullableBoolean(value) {
  return typeof value === "boolean" ? value : null;
}

function nullableInteger(value, minimum, maximum) {
  return Number.isInteger(value) && value >= minimum && value <= maximum ? value : null;
}

function normalizeDate(value) {
  const year = nullableInteger(value?.year, 1, 9999);
  const month = nullableInteger(value?.month, 1, 12);
  const day = nullableInteger(value?.day, 1, 31);
  if (year === null || month === null || day === null) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function dateParts(date) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || ""));
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3])
  };
}

function localDateOrdinal(date) {
  const parts = dateParts(date);
  if (!parts) return null;
  return Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / 86_400_000);
}

function addLocalDays(date, days) {
  const parts = dateParts(date);
  if (!parts) return null;
  const next = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
}

function localStamp(date, hour, minute) {
  const ordinal = localDateOrdinal(date);
  if (ordinal === null) return null;
  return ordinal * MINUTES_PER_DAY + hour * 60 + minute;
}

function sanitizeFailureMessage(message) {
  return String(message || "provider refresh failed")
    .replace(/AIza[0-9A-Za-z_-]+/g, "[REDACTED_API_KEY]")
    .replace(/([?&](?:key|api_key)=)[^&\s]+/gi, "$1[REDACTED]")
    .slice(0, 300);
}

export function assertBusinessHoursWorkspace(workspaceId, operatingProfileId = "") {
  const workspace = BUSINESS_HOURS_WORKSPACES[workspaceId];
  if (!workspace) {
    throw governanceError("business_hours_unknown_workspace", `Unknown business-hours workspace: ${workspaceId || "missing"}`);
  }
  if (operatingProfileId && operatingProfileId !== workspace.operatingProfileId) {
    throw governanceError(
      "business_hours_operating_profile_mismatch",
      `Business-hours workspace ${workspaceId} requires operating profile ${workspace.operatingProfileId}.`
    );
  }
  return workspace;
}

export function isValidBusinessTimeZone(timeZone) {
  if (!nonEmpty(timeZone)) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

export function businessLocalDateTime(at, timeZone) {
  if (!isValidBusinessTimeZone(timeZone)) {
    throw governanceError("business_hours_timezone_invalid", `Invalid or missing business timezone: ${timeZone || "missing"}`);
  }
  const instant = at instanceof Date ? at : new Date(at);
  if (Number.isNaN(instant.getTime())) {
    throw governanceError("business_hours_evaluation_time_invalid", `Invalid business-hours evaluation time: ${at}`);
  }
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(instant).filter(part => part.type !== "literal").map(part => [part.type, part.value]));
  const dayIndex = DAY_INDEX[parts.weekday];
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    dayIndex,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    time: `${parts.hour}:${parts.minute}`,
    timeZone,
    instant: instant.toISOString()
  };
}

export function normalizeHoursPoint(point) {
  if (!point || typeof point !== "object") return null;
  return {
    date: normalizeDate(point.date),
    day: nullableInteger(point.day, 0, 6),
    hour: nullableInteger(point.hour, 0, 23),
    minute: nullableInteger(point.minute, 0, 59),
    truncated: nullableBoolean(point.truncated)
  };
}

export function normalizeHoursPeriods(periods) {
  if (!Array.isArray(periods)) return null;
  return periods.map(period => ({
    open: normalizeHoursPoint(period?.open),
    close: normalizeHoursPoint(period?.close)
  })).filter(period => period.open !== null);
}

function normalizeRegularHours(hours) {
  if (!hours || typeof hours !== "object") return null;
  return {
    periods: normalizeHoursPeriods(hours.periods),
    sourceOpenNowAtRetrieval: nullableBoolean(hours.openNow)
  };
}

function normalizeCurrentHours(hours, retrievedAt, timeZone) {
  if (!hours || typeof hours !== "object") return null;
  const localRetrieved = businessLocalDateTime(retrievedAt, timeZone);
  return {
    coverageStartDate: localRetrieved.date,
    coverageEndDate: addLocalDays(localRetrieved.date, 6),
    periods: normalizeHoursPeriods(hours.periods),
    specialDays: Array.isArray(hours.specialDays)
      ? hours.specialDays.map(day => normalizeDate(day?.date)).filter(Boolean)
      : [],
    sourceOpenNowAtRetrieval: nullableBoolean(hours.openNow),
    nextOpenTime: nonEmpty(hours.nextOpenTime) ? hours.nextOpenTime : null,
    nextCloseTime: nonEmpty(hours.nextCloseTime) ? hours.nextCloseTime : null
  };
}

function periodTouchesDate(period, date) {
  if (!period?.open) return false;
  return period.open.date === date || period.close?.date === date;
}

function normalizeSpecialHours(currentHours) {
  if (!currentHours) return [];
  return currentHours.specialDays.map(date => ({
    date,
    verificationStatus: Array.isArray(currentHours.periods) ? "VERIFIED" : "UNVERIFIED",
    periods: Array.isArray(currentHours.periods)
      ? currentHours.periods.filter(period => periodTouchesDate(period, date))
      : null,
    source: "GOOGLE_PLACES_CURRENT_OPENING_HOURS"
  }));
}

function weeklyPeriodIsOpen(period, local) {
  const open = period?.open;
  if (open?.day === null || open?.hour === null || open?.minute === null) return false;
  if (!period.close) return true;
  const close = period.close;
  if (close.day === null || close.hour === null || close.minute === null) return false;

  const openMinute = open.day * MINUTES_PER_DAY + open.hour * 60 + open.minute;
  let closeMinute = close.day * MINUTES_PER_DAY + close.hour * 60 + close.minute;
  if (closeMinute <= openMinute) closeMinute += MINUTES_PER_WEEK;
  const currentMinute = local.dayIndex * MINUTES_PER_DAY + local.hour * 60 + local.minute;
  return (currentMinute >= openMinute && currentMinute < closeMinute) ||
    (currentMinute + MINUTES_PER_WEEK >= openMinute && currentMinute + MINUTES_PER_WEEK < closeMinute);
}

function datedPeriodIsOpen(period, local) {
  const open = period?.open;
  if (!open?.date || open.hour === null || open.minute === null) return false;
  const start = localStamp(open.date, open.hour, open.minute);
  const current = localStamp(local.date, local.hour, local.minute);
  if (start === null || current === null || current < start) return false;
  if (!period.close) return true;
  const close = period.close;
  if (!close.date || close.hour === null || close.minute === null) return false;
  const end = localStamp(close.date, close.hour, close.minute);
  return end !== null && current < end;
}

function statusResult(status, reasonCode, reason, local = null, freshnessStatus = "FRESH") {
  return {
    status,
    reasonCode,
    reason,
    hoursFreshnessStatus: freshnessStatus,
    businessLocalDate: local?.date ?? null,
    businessLocalTime: local?.time ?? null
  };
}

function freshnessFor(record, evaluatedAt, policy) {
  if (!record.hoursVerifiedAt) return { status: "MISSING", ageHours: null };
  const verifiedAt = new Date(record.hoursVerifiedAt);
  if (Number.isNaN(verifiedAt.getTime())) return { status: "MISSING", ageHours: null };
  const ageHours = (evaluatedAt.getTime() - verifiedAt.getTime()) / 3_600_000;
  if (ageHours < 0) return { status: "MISSING", ageHours };
  if (ageHours > Number(policy.freshnessThresholdHours)) return { status: "STALE", ageHours };
  return { status: "FRESH", ageHours };
}

export function evaluateBusinessHoursRecord(record, at = new Date(), policy = DEFAULT_BUSINESS_HOURS_POLICY) {
  assertBusinessHoursWorkspace(record?.workspaceId, record?.operatingProfileId);
  const evaluatedAt = at instanceof Date ? at : new Date(at);
  if (Number.isNaN(evaluatedAt.getTime())) {
    throw governanceError("business_hours_evaluation_time_invalid", `Invalid business-hours evaluation time: ${at}`);
  }

  const freshness = freshnessFor(record, evaluatedAt, policy);
  if (freshness.status === "MISSING") {
    return statusResult("HOURS_UNKNOWN", "HOURS_SOURCE_MISSING", "No verified business-hours source is available.", null, "MISSING");
  }
  if (freshness.status === "STALE") {
    return statusResult(
      "HOURS_STALE",
      "HOURS_SOURCE_STALE",
      `Verified business hours are older than the ${policy.freshnessThresholdHours}-hour freshness threshold.`,
      null,
      "STALE"
    );
  }

  if (!isValidBusinessTimeZone(record.businessTimezone)) {
    return statusResult("HOURS_UNKNOWN", "BUSINESS_TIMEZONE_MISSING", "Business-local timezone is missing or invalid.", null, "FRESH");
  }
  const local = businessLocalDateTime(evaluatedAt, record.businessTimezone);

  if (["CLOSED_PERMANENTLY", "CLOSED_TEMPORARILY"].includes(record.permanentOperationalStatus)) {
    return statusResult(
      "CLOSED_VERIFIED",
      `PERMANENT_STATUS_${record.permanentOperationalStatus}`,
      `Provider business status is ${record.permanentOperationalStatus}; current hours remain a separate field.`,
      local
    );
  }

  const special = (record.specialOrHolidayHours || []).find(entry => entry.date === local.date);
  if (special) {
    if (special.verificationStatus !== "VERIFIED" || !Array.isArray(special.periods)) {
      return statusResult(
        "SPECIAL_HOURS_UNVERIFIED",
        "SPECIAL_HOURS_NOT_VERIFIED",
        `Special or holiday hours for ${local.date} are not verified.`,
        local
      );
    }
    const isOpen = special.periods.some(period => datedPeriodIsOpen(period, local));
    return statusResult(
      isOpen ? "OPEN_VERIFIED" : "CLOSED_VERIFIED",
      isOpen ? "VERIFIED_SPECIAL_PERIOD_OPEN" : "VERIFIED_SPECIAL_PERIOD_CLOSED",
      `Verified special or holiday hours show the business ${isOpen ? "open" : "closed"} at ${local.time} ${record.businessTimezone}.`,
      local
    );
  }

  const currentWindow = record.currentOpeningHoursWindow;
  if (currentWindow && Array.isArray(currentWindow.periods) && local.date >= currentWindow.coverageStartDate && local.date <= currentWindow.coverageEndDate) {
    const isOpen = currentWindow.periods.some(period => datedPeriodIsOpen(period, local));
    return statusResult(
      isOpen ? "OPEN_VERIFIED" : "CLOSED_VERIFIED",
      isOpen ? "VERIFIED_CURRENT_WINDOW_OPEN" : "VERIFIED_CURRENT_WINDOW_CLOSED",
      `Verified provider current-hours data show the business ${isOpen ? "open" : "closed"} at ${local.time} ${record.businessTimezone}.`,
      local
    );
  }

  const regular = record.regularWeeklyBusinessHours;
  if (!regular || !Array.isArray(regular.periods)) {
    return statusResult("HOURS_UNKNOWN", "REGULAR_HOURS_MISSING", "Regular weekly business hours are missing.", local, "FRESH");
  }
  const isOpen = regular.periods.some(period => weeklyPeriodIsOpen(period, local));
  return statusResult(
    isOpen ? "OPEN_VERIFIED" : "CLOSED_VERIFIED",
    isOpen ? "VERIFIED_REGULAR_PERIOD_OPEN" : "VERIFIED_REGULAR_PERIOD_CLOSED",
    `Verified regular hours show the business ${isOpen ? "open" : "closed"} at ${local.time} ${record.businessTimezone}.`,
    local
  );
}

function identityFromCandidate(candidate, workspace, activePlaceIds) {
  return {
    workspaceId: workspace.workspaceId,
    operatingProfileId: workspace.operatingProfileId,
    googlePlaceId: candidate.google_place_id,
    businessName: candidate.business_name,
    address: candidate.full_address,
    category: candidate.category,
    latitude: Number.isFinite(Number(candidate.latitude)) ? Number(candidate.latitude) : null,
    longitude: Number.isFinite(Number(candidate.longitude)) ? Number(candidate.longitude) : null,
    activePoolMember: activePlaceIds.has(candidate.google_place_id),
    sourceDatasetVersion: candidate.source_dataset_version || "google-qualified-businesses-v2",
    permanentOperationalStatus: candidate.business_status || "UNKNOWN"
  };
}

function applyEvaluation(record, evaluatedAt, policy) {
  const evaluation = evaluateBusinessHoursRecord(record, evaluatedAt, policy);
  return {
    ...record,
    hoursFreshnessStatus: evaluation.hoursFreshnessStatus,
    currentOpenClosedEligibilityStatus: evaluation.status,
    currentStatusReasonCode: evaluation.reasonCode,
    currentStatusReason: evaluation.reason,
    currentStatusEvaluatedAt: (evaluatedAt instanceof Date ? evaluatedAt : new Date(evaluatedAt)).toISOString(),
    currentStatusBusinessLocalDate: evaluation.businessLocalDate,
    currentStatusBusinessLocalTime: evaluation.businessLocalTime
  };
}

export function normalizeGoogleBusinessHours({
  candidate,
  place,
  workspaceId = "fitness_connection",
  retrievedAt = new Date(),
  evaluatedAt = retrievedAt,
  activePlaceIds = new Set(),
  fieldEvidence = [],
  fieldMask = [],
  policy = DEFAULT_BUSINESS_HOURS_POLICY
}) {
  const workspace = assertBusinessHoursWorkspace(workspaceId);
  if (!candidate?.google_place_id || place?.id !== candidate.google_place_id) {
    throw governanceError(
      "business_hours_place_id_mismatch",
      `Business-hours provider Place ID did not match the verified source identity for ${candidate?.business_name || "unknown business"}.`
    );
  }
  const retrieved = retrievedAt instanceof Date ? retrievedAt : new Date(retrievedAt);
  if (Number.isNaN(retrieved.getTime())) {
    throw governanceError("business_hours_retrieval_time_invalid", `Invalid source retrieval timestamp: ${retrievedAt}`);
  }
  const retrievedIso = retrieved.toISOString();
  const businessTimezone = nonEmpty(place.timeZone?.id) ? place.timeZone.id : null;
  const hasRegularHours = hasOwn(place, "regularOpeningHours") && place.regularOpeningHours !== null;
  const hasCurrentHours = hasOwn(place, "currentOpeningHours") && place.currentOpeningHours !== null;
  const regularWeeklyBusinessHours = hasRegularHours ? normalizeRegularHours(place.regularOpeningHours) : null;
  const currentOpeningHoursWindow = hasCurrentHours && isValidBusinessTimeZone(businessTimezone)
    ? normalizeCurrentHours(place.currentOpeningHours, retrieved, businessTimezone)
    : null;
  const hasVerifiedRegularPeriods = Array.isArray(regularWeeklyBusinessHours?.periods);
  const hasVerifiedCurrentPeriods = Array.isArray(currentOpeningHoursWindow?.periods);
  const hoursVerifiedAt = hasVerifiedRegularPeriods || hasVerifiedCurrentPeriods ? retrievedIso : null;
  const record = {
    ...identityFromCandidate(candidate, workspace, activePlaceIds),
    permanentOperationalStatus: place.businessStatus || candidate.business_status || "UNKNOWN",
    regularWeeklyBusinessHours,
    specialOrHolidayHours: normalizeSpecialHours(currentOpeningHoursWindow),
    currentOpeningHoursWindow,
    businessTimezone,
    currentHoursSource: "GOOGLE_PLACES_API_NEW",
    sourceRetrievedAt: retrievedIso,
    hoursVerifiedAt,
    hoursFreshnessStatus: hoursVerifiedAt ? "FRESH" : "MISSING",
    hoursConfidence: hasVerifiedCurrentPeriods ? "HIGH" : hasVerifiedRegularPeriods ? "MEDIUM" : "NONE",
    hoursProvenance: {
      sourceSystem: "GOOGLE_PLACES_API_NEW",
      sourceMethod: "places.get",
      sourcePlaceId: place.id,
      fieldMask: [...fieldMask],
      retrievedAt: retrievedIso,
      normalizedAt: retrievedIso,
      providerBusinessName: place.displayName?.text || null,
      providerAddress: place.formattedAddress || null,
      fieldEvidenceIds: fieldEvidence.map(evidence => evidence.evidenceId)
    },
    lastSuccessfulRefreshAt: retrievedIso,
    lastFailedRefreshAt: null,
    refreshFailure: null,
    currentOpenClosedEligibilityStatus: "HOURS_UNKNOWN",
    currentStatusReasonCode: "NOT_EVALUATED",
    currentStatusReason: "Business hours have not been evaluated.",
    currentStatusEvaluatedAt: null,
    currentStatusBusinessLocalDate: null,
    currentStatusBusinessLocalTime: null
  };
  return applyEvaluation(record, evaluatedAt, policy);
}

export function unknownBusinessHoursRecord({
  candidate,
  workspaceId = "fitness_connection",
  evaluatedAt = new Date(),
  activePlaceIds = new Set(),
  fieldEvidence = [],
  failedAt = null,
  failure = null,
  policy = DEFAULT_BUSINESS_HOURS_POLICY
}) {
  const workspace = assertBusinessHoursWorkspace(workspaceId);
  const failedIso = failedAt ? new Date(failedAt).toISOString() : null;
  const record = {
    ...identityFromCandidate(candidate, workspace, activePlaceIds),
    regularWeeklyBusinessHours: null,
    specialOrHolidayHours: [],
    currentOpeningHoursWindow: null,
    businessTimezone: null,
    currentHoursSource: null,
    sourceRetrievedAt: null,
    hoursVerifiedAt: null,
    hoursFreshnessStatus: "MISSING",
    hoursConfidence: "NONE",
    hoursProvenance: {
      sourceSystem: null,
      sourceMethod: null,
      sourcePlaceId: candidate.google_place_id || null,
      fieldMask: [],
      retrievedAt: null,
      normalizedAt: (evaluatedAt instanceof Date ? evaluatedAt : new Date(evaluatedAt)).toISOString(),
      providerBusinessName: null,
      providerAddress: null,
      fieldEvidenceIds: fieldEvidence.map(evidence => evidence.evidenceId)
    },
    lastSuccessfulRefreshAt: null,
    lastFailedRefreshAt: failedIso,
    refreshFailure: failure ? {
      code: failure.code || "business_hours_provider_error",
      message: sanitizeFailureMessage(failure.message)
    } : null,
    currentOpenClosedEligibilityStatus: "HOURS_UNKNOWN",
    currentStatusReasonCode: "NOT_EVALUATED",
    currentStatusReason: "Business hours have not been evaluated.",
    currentStatusEvaluatedAt: null,
    currentStatusBusinessLocalDate: null,
    currentStatusBusinessLocalTime: null
  };
  return applyEvaluation(record, evaluatedAt, policy);
}

export function preserveBusinessHoursAfterRefreshFailure({
  candidate,
  previousRecord = null,
  workspaceId = "fitness_connection",
  failedAt = new Date(),
  evaluatedAt = failedAt,
  activePlaceIds = new Set(),
  fieldEvidence = [],
  failure,
  policy = DEFAULT_BUSINESS_HOURS_POLICY
}) {
  if (!previousRecord) {
    return unknownBusinessHoursRecord({
      candidate,
      workspaceId,
      evaluatedAt,
      activePlaceIds,
      fieldEvidence,
      failedAt,
      failure,
      policy
    });
  }
  const workspace = assertBusinessHoursWorkspace(workspaceId);
  assertBusinessHoursWorkspace(previousRecord.workspaceId, previousRecord.operatingProfileId);
  if (previousRecord.workspaceId !== workspace.workspaceId || previousRecord.googlePlaceId !== candidate.google_place_id) {
    throw governanceError("business_hours_previous_record_mismatch", "Previous business-hours record does not match the workspace and Place ID being refreshed.");
  }
  const failedIso = (failedAt instanceof Date ? failedAt : new Date(failedAt)).toISOString();
  const preserved = {
    ...previousRecord,
    ...identityFromCandidate(candidate, workspace, activePlaceIds),
    permanentOperationalStatus: previousRecord.permanentOperationalStatus,
    hoursProvenance: {
      ...previousRecord.hoursProvenance,
      fieldEvidenceIds: [...new Set([
        ...(previousRecord.hoursProvenance?.fieldEvidenceIds || []),
        ...fieldEvidence.map(evidence => evidence.evidenceId)
      ])]
    },
    lastFailedRefreshAt: failedIso,
    refreshFailure: {
      code: failure?.code || "business_hours_provider_error",
      message: sanitizeFailureMessage(failure?.message)
    }
  };
  return applyEvaluation(preserved, evaluatedAt, policy);
}

export function recalculateBusinessHoursArtifact(artifact, evaluatedAt = new Date()) {
  assertBusinessHoursWorkspace(artifact?.workspaceId, artifact?.operatingProfileId);
  const policy = artifact.freshnessPolicy || DEFAULT_BUSINESS_HOURS_POLICY;
  const instant = evaluatedAt instanceof Date ? evaluatedAt : new Date(evaluatedAt);
  if (Number.isNaN(instant.getTime())) {
    throw governanceError("business_hours_evaluation_time_invalid", `Invalid artifact evaluation time: ${evaluatedAt}`);
  }
  return {
    ...artifact,
    generatedAt: instant.toISOString(),
    statusEvaluatedAt: instant.toISOString(),
    refreshMode: "offline-status-evaluation",
    records: (artifact.records || []).map(record => applyEvaluation(record, instant, policy))
  };
}

export function validateBusinessHoursArtifact(artifact, expectedWorkspaceId = "fitness_connection") {
  const failures = [];
  try {
    assertBusinessHoursWorkspace(expectedWorkspaceId);
  } catch (error) {
    failures.push(error.message);
    return failures;
  }
  if (!artifact || typeof artifact !== "object") return ["Business-hours artifact is missing or invalid."];
  if (artifact.schemaVersion !== "prometheus-data-business-hours-v1") failures.push("Business-hours schemaVersion mismatch.");
  if (artifact.artifactVersion !== "business-hours-v1") failures.push("Business-hours artifactVersion mismatch.");
  if (artifact.workspaceId !== expectedWorkspaceId) failures.push("Business-hours workspace mismatch.");
  if (artifact.operatingProfileId !== BUSINESS_HOURS_WORKSPACES[expectedWorkspaceId].operatingProfileId) failures.push("Business-hours operating profile mismatch.");
  if (artifact.routeEligibilityActivated !== false) failures.push("Business-hours artifact must not activate route eligibility.");
  if (artifact.runtimeBehaviorChanged !== false) failures.push("Business-hours artifact must preserve runtime behavior.");
  if (artifact.scoringChanged !== false) failures.push("Business-hours artifact must preserve scoring.");
  if (!Array.isArray(artifact.records)) failures.push("Business-hours records must be an array.");
  if (artifact.recordCount !== (artifact.records || []).length) failures.push("Business-hours recordCount mismatch.");
  if (!Number.isFinite(Number(artifact.freshnessPolicy?.freshnessThresholdHours))) failures.push("Business-hours freshness threshold is missing.");

  const seen = new Set();
  for (const record of artifact.records || []) {
    const label = record.googlePlaceId || record.businessName || "unknown record";
    if (seen.has(record.googlePlaceId)) failures.push(`Duplicate business-hours Place ID: ${label}`);
    seen.add(record.googlePlaceId);
    if (record.workspaceId !== expectedWorkspaceId) failures.push(`Cross-workspace business-hours record: ${label}`);
    if (!nonEmpty(record.googlePlaceId)) failures.push(`Missing business-hours Place ID: ${label}`);
    if (!nonEmpty(record.businessName)) failures.push(`Missing business-hours business name: ${label}`);
    if (!nonEmpty(record.address)) failures.push(`Missing business-hours address: ${label}`);
    if (!nonEmpty(record.permanentOperationalStatus)) failures.push(`Missing permanent operational status: ${label}`);
    if (!BUSINESS_HOURS_STATUSES.includes(record.currentOpenClosedEligibilityStatus)) failures.push(`Invalid current hours status: ${label}`);
    if (!HOURS_FRESHNESS_STATUSES.includes(record.hoursFreshnessStatus)) failures.push(`Invalid hours freshness status: ${label}`);
    if (!HOURS_CONFIDENCE_VALUES.includes(record.hoursConfidence)) failures.push(`Invalid hours confidence: ${label}`);
    if (typeof record.currentOpenClosedEligibilityStatus === "boolean" || typeof record.hoursFreshnessStatus === "boolean") {
      failures.push(`Boolean false certainty is prohibited for business hours: ${label}`);
    }
    if (record.regularWeeklyBusinessHours === false || record.currentOpeningHoursWindow === false || record.businessTimezone === false) {
      failures.push(`Missing business-hours values must use null, not false: ${label}`);
    }
    if (!record.hoursProvenance || typeof record.hoursProvenance !== "object") failures.push(`Missing business-hours provenance: ${label}`);
    if (!nonEmpty(record.currentStatusReasonCode) || !nonEmpty(record.currentStatusReason)) failures.push(`Missing explainable hours status reason: ${label}`);
  }
  return failures;
}

export function readBusinessHoursArtifact(filePath, workspaceId = "fitness_connection") {
  assertBusinessHoursWorkspace(workspaceId);
  if (!fs.existsSync(filePath)) {
    throw governanceError("business_hours_artifact_missing", `Business-hours artifact is missing: ${filePath}`);
  }
  const artifact = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const failures = validateBusinessHoursArtifact(artifact, workspaceId);
  if (failures.length) {
    throw governanceError("business_hours_artifact_invalid", failures.join("\n"));
  }
  return artifact;
}

export function writeBusinessHoursArtifactAtomic(filePath, artifact, workspaceId = "fitness_connection") {
  const failures = validateBusinessHoursArtifact(artifact, workspaceId);
  if (failures.length) {
    throw governanceError("business_hours_artifact_invalid", failures.join("\n"));
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify(artifact, null, 2) + "\n");
  fs.renameSync(temporaryPath, filePath);
}
