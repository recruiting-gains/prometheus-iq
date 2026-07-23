import {
  BUSINESS_HOURS_STATUSES,
  DEFAULT_BUSINESS_HOURS_POLICY,
  HOURS_CONFIDENCE_VALUES,
  HOURS_FRESHNESS_STATUSES,
  validateBusinessHoursArtifact
} from "../scripts/lib/business-hours-governance.mjs";
import {
  assertGovernedCandidateAdmission,
  assertGovernedRouteRuntimeScope,
  createGovernedRouteRuntimeScopeFromBusinessHoursArtifact,
  governedApprovedBusinessIdentitySet,
  routeIqGovernedRuntimeAuthorizations
} from "./route-iq-governed-runtime-scope.mjs";

export const routeBusinessHoursEligibilityVersion = "route-iq-closed-now-eligibility-v1";
export const routeBusinessHoursWorkspaceId = "fitness_connection";
export const routeBusinessHoursOperatingProfileId = "fitness";
export const hoursNotVerifiedMarker = "HOURS_NOT_VERIFIED";

const dayIndex = Object.freeze({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 });
const dayLabels = Object.freeze(["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]);
const minutesPerDay = 1440;
const minutesPerWeek = 10080;
const uncertainStatuses = new Set(["HOURS_UNKNOWN", "HOURS_STALE", "SPECIAL_HOURS_UNVERIFIED"]);

function cleanText(value, maximum = 500) {
  return String(value ?? "").replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, maximum);
}

function evaluationInstant(value) {
  const instant = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(instant.getTime())) throw new Error(`Invalid Route IQ business-hours evaluation time: ${value}`);
  return instant;
}

function validTimezone(value) {
  try {
    if (!cleanText(value, 120)) return false;
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

function localDateTime(instant, timeZone) {
  if (!validTimezone(timeZone)) return null;
  const values = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(instant).filter(part => part.type !== "literal").map(part => [part.type, part.value]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    day: dayIndex[values.weekday],
    hour: Number(values.hour),
    minute: Number(values.minute),
    time: `${values.hour}:${values.minute}`,
    timeZone
  };
}

function dateParts(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(cleanText(value, 10));
  if (!match) return null;
  const parts = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return date.getUTCFullYear() === parts.year
    && date.getUTCMonth() === parts.month - 1
    && date.getUTCDate() === parts.day
    ? parts
    : null;
}

function addDays(value, days) {
  const parts = dateParts(value);
  if (!parts) return null;
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function dateOrdinal(value) {
  const parts = dateParts(value);
  return parts ? Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / 86_400_000) : null;
}

function localStamp(date, hour, minute) {
  const ordinal = dateOrdinal(date);
  return ordinal === null ? null : ordinal * minutesPerDay + hour * 60 + minute;
}

function displayTime(hour, minute) {
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
}

function localEvent(date, hour, minute, timeZone, source) {
  return {
    localDate: date,
    localTime: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    displayTime: displayTime(hour, minute),
    timeZone,
    source
  };
}

function validPoint(point, mode) {
  if (!point || typeof point !== "object") return false;
  if (!Number.isInteger(point.hour) || point.hour < 0 || point.hour > 23
    || !Number.isInteger(point.minute) || point.minute < 0 || point.minute > 59) return false;
  if (mode === "weekly") return point.date == null && Number.isInteger(point.day) && point.day >= 0 && point.day <= 6;
  return dateParts(point.date) !== null;
}

function normalizedPeriods(periods, mode, allowTwentyFourHours = false) {
  if (!Array.isArray(periods)) return null;
  const normalized = periods.map(period => ({
    open: period?.open ? { ...period.open } : null,
    close: period?.close ? { ...period.close } : null
  }));
  const valid = normalized.every(period => {
    if (!validPoint(period.open, mode)) return false;
    if (mode === "weekly" && period.close === null) {
      return allowTwentyFourHours
        && normalized.length === 1
        && period.open.day === 0
        && period.open.hour === 0
        && period.open.minute === 0;
    }
    if (!validPoint(period.close, mode)) return false;
    if (mode === "dated") {
      const start = localStamp(period.open.date, period.open.hour, period.open.minute);
      const end = localStamp(period.close.date, period.close.hour, period.close.minute);
      return start !== null && end !== null && end > start;
    }
    const start = period.open.day * minutesPerDay + period.open.hour * 60 + period.open.minute;
    let end = period.close.day * minutesPerDay + period.close.hour * 60 + period.close.minute;
    if (end <= start) end += minutesPerWeek;
    return end > start && end - start <= minutesPerWeek;
  });
  return valid ? normalized : null;
}

function weeklyBounds(period, periods, local, source) {
  if (!period.close) {
    return periods.length === 1
      && period.open.day === 0
      && period.open.hour === 0
      && period.open.minute === 0
      ? { source, twentyFourHours: true, start: null, end: null }
      : null;
  }
  const start = period.open.day * minutesPerDay + period.open.hour * 60 + period.open.minute;
  let end = period.close.day * minutesPerDay + period.close.hour * 60 + period.close.minute;
  if (end <= start) end += minutesPerWeek;
  const current = local.day * minutesPerDay + local.hour * 60 + local.minute;
  const matched = [current, current + minutesPerWeek].find(value => value >= start && value < end);
  if (matched === undefined) return null;
  const weekShift = matched === current ? 0 : -7;
  const closeDay = period.close.day + (end >= minutesPerWeek ? 7 : 0);
  return {
    source,
    twentyFourHours: false,
    start: localEvent(
      addDays(local.date, period.open.day - local.day + weekShift),
      period.open.hour,
      period.open.minute,
      local.timeZone,
      source
    ),
    end: localEvent(
      addDays(local.date, closeDay - local.day + weekShift),
      period.close.hour,
      period.close.minute,
      local.timeZone,
      source
    )
  };
}

function nextWeeklyOpening(periods, local, source) {
  if (periods.length === 1 && periods[0].close === null) return null;
  const current = local.day * minutesPerDay + local.hour * 60 + local.minute;
  let next = null;
  for (const period of periods) {
    const opening = period.open.day * minutesPerDay + period.open.hour * 60 + period.open.minute;
    let delta = (opening - current + minutesPerWeek) % minutesPerWeek;
    if (delta === 0) delta = minutesPerWeek;
    if (!next || delta < next.delta) next = { delta, point: period.open };
  }
  if (!next) return null;
  const dayOffset = Math.floor((local.hour * 60 + local.minute + next.delta) / minutesPerDay);
  return localEvent(addDays(local.date, dayOffset), next.point.hour, next.point.minute, local.timeZone, source);
}

function datedBounds(period, local, source) {
  const start = localStamp(period.open.date, period.open.hour, period.open.minute);
  const end = localStamp(period.close.date, period.close.hour, period.close.minute);
  const current = localStamp(local.date, local.hour, local.minute);
  if (start === null || end === null || current === null || current < start || current >= end) return null;
  return {
    source,
    twentyFourHours: false,
    start: localEvent(period.open.date, period.open.hour, period.open.minute, local.timeZone, source),
    end: localEvent(period.close.date, period.close.hour, period.close.minute, local.timeZone, source)
  };
}

function nextDatedOpening(periods, local, source) {
  const current = localStamp(local.date, local.hour, local.minute);
  let next = null;
  for (const period of periods) {
    const start = localStamp(period.open.date, period.open.hour, period.open.minute);
    if (start !== null && start > current && (!next || start < next.start)) next = { start, point: period.open };
  }
  return next
    ? localEvent(next.point.date, next.point.hour, next.point.minute, local.timeZone, source)
    : null;
}

function freshness(record, instant, policy) {
  const threshold = Math.min(24, Math.max(1, Number(policy.freshnessThresholdHours || 24)));
  const verifiedAt = new Date(record?.hoursVerifiedAt);
  if (!record?.hoursVerifiedAt || Number.isNaN(verifiedAt.getTime())) {
    return { state: "MISSING", ageHours: null, verifiedAt: null, expiresAt: null, threshold };
  }
  const ageHours = (instant.getTime() - verifiedAt.getTime()) / 3_600_000;
  return {
    state: ageHours < 0 ? "INVALID" : ageHours > threshold ? "STALE" : "FRESH",
    ageHours,
    verifiedAt: verifiedAt.toISOString(),
    expiresAt: new Date(verifiedAt.getTime() + threshold * 3_600_000).toISOString(),
    threshold
  };
}

function statusDisplay(status, interval, nextOpening) {
  if (status === "HOURS_STALE") return "Hours outdated · verification required";
  if (status === "HOURS_UNKNOWN" || status === "SPECIAL_HOURS_UNVERIFIED") {
    return "Hours unavailable · not route eligible";
  }
  if (status === "OPEN_VERIFIED" && interval?.source === "VERIFIED_APPOINTMENT_WINDOW") {
    return "Appointment window verified";
  }
  if (status === "OPEN_VERIFIED" && interval?.twentyFourHours) return "Open 24 hours";
  if (status === "OPEN_VERIFIED" && interval?.end?.displayTime) return `Open now · closes ${interval.end.displayTime}`;
  if (status === "CLOSED_VERIFIED" && nextOpening?.localDate && nextOpening?.displayTime) {
    const parts = dateParts(nextOpening.localDate);
    const weekday = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12)).getUTCDay();
    return `Closed · opens ${dayLabels[weekday]} at ${nextOpening.displayTime}`;
  }
  return status === "CLOSED_VERIFIED" ? "Closed" : "Hours unavailable · not route eligible";
}

function evaluatedStatus(status, reasonCode, reason, {
  local = null,
  freshnessState = "FRESH",
  sourceState = "VERIFIED",
  interval = null,
  nextOpening = null
} = {}) {
  return {
    status,
    reasonCode,
    reason,
    freshnessState,
    sourceState,
    businessLocalDate: local?.date ?? null,
    businessLocalTime: local?.time ?? null,
    effectiveInterval: interval,
    nextOpening,
    nextClosing: interval?.end ?? null,
    displayStatus: statusDisplay(status, interval, nextOpening)
  };
}

function providerFailureIsCurrent(record) {
  if (!record?.refreshFailure || !record?.lastFailedRefreshAt) return false;
  const failedAt = new Date(record.lastFailedRefreshAt);
  const succeededAt = new Date(record.lastSuccessfulRefreshAt || record.hoursVerifiedAt || 0);
  return !Number.isNaN(failedAt.getTime())
    && (Number.isNaN(succeededAt.getTime()) || failedAt.getTime() >= succeededAt.getTime());
}

function evaluateAvailability(record, instant, policy) {
  const local = validTimezone(record?.businessTimezone)
    ? localDateTime(instant, record.businessTimezone)
    : null;
  if (["CLOSED_PERMANENTLY", "CLOSED_TEMPORARILY"].includes(record?.permanentOperationalStatus)) {
    return evaluatedStatus(
      "CLOSED_VERIFIED",
      `PERMANENT_STATUS_${record.permanentOperationalStatus}`,
      `Provider business status is ${record.permanentOperationalStatus}.`,
      { local }
    );
  }

  const currentFreshness = freshness(record, instant, policy);
  if (currentFreshness.state === "MISSING") {
    return evaluatedStatus("HOURS_UNKNOWN", "HOURS_SOURCE_MISSING", "No verified business-hours source is available.", {
      freshnessState: "MISSING",
      sourceState: "UNAVAILABLE"
    });
  }
  if (currentFreshness.state === "INVALID") {
    return evaluatedStatus("HOURS_UNKNOWN", "HOURS_SOURCE_TIME_INVALID", "Business-hours verification time is invalid.", {
      freshnessState: "MISSING",
      sourceState: "INVALID"
    });
  }
  if (currentFreshness.state === "STALE") {
    return evaluatedStatus(
      "HOURS_STALE",
      "HOURS_SOURCE_STALE",
      `Verified business hours are older than the ${currentFreshness.threshold}-hour freshness ceiling.`,
      { freshnessState: "STALE", sourceState: "STALE" }
    );
  }
  if (providerFailureIsCurrent(record)) {
    return evaluatedStatus(
      "HOURS_UNKNOWN",
      "HOURS_PROVIDER_FAILURE",
      "The latest governed provider refresh failed; prior evidence was preserved but cannot authorize an immediate stop.",
      { local, freshnessState: "FRESH", sourceState: "PROVIDER_FAILURE" }
    );
  }
  if (!local) {
    return evaluatedStatus("HOURS_UNKNOWN", "BUSINESS_TIMEZONE_INVALID", "Business-local timezone is missing or invalid.", {
      freshnessState: "FRESH",
      sourceState: "INVALID"
    });
  }

  if (record.appointmentAccessRequired === true) {
    if (!Array.isArray(record.appointmentAccessWindows)) {
      return evaluatedStatus("HOURS_UNKNOWN", "APPOINTMENT_WINDOWS_INVALID", "Appointment-only access windows are invalid.", {
        local,
        sourceState: "INVALID"
      });
    }
    const verified = record.appointmentAccessWindows.filter(window => window?.verificationStatus === "VERIFIED");
    const periods = normalizedPeriods(verified.map(window => ({ open: window.start, close: window.end })), "dated");
    if (periods === null) {
      return evaluatedStatus("HOURS_UNKNOWN", "APPOINTMENT_WINDOWS_INVALID", "Appointment-only access windows are invalid.", {
        local,
        sourceState: "INVALID"
      });
    }
    const interval = periods.map(period => datedBounds(period, local, "VERIFIED_APPOINTMENT_WINDOW")).find(Boolean) || null;
    const nextOpening = nextDatedOpening(periods, local, "VERIFIED_APPOINTMENT_WINDOW");
    return evaluatedStatus(
      interval ? "OPEN_VERIFIED" : "CLOSED_VERIFIED",
      interval ? "VERIFIED_APPOINTMENT_WINDOW_OPEN" : "VERIFIED_APPOINTMENT_WINDOW_CLOSED",
      interval ? "A verified appointment or access window is active." : "No verified appointment or access window is active.",
      { local, interval, nextOpening }
    );
  }

  const special = (record.specialOrHolidayHours || []).find(entry => entry?.date === local.date);
  if (special) {
    const periods = normalizedPeriods(special.periods, "dated");
    if (special.verificationStatus !== "VERIFIED" || periods === null) {
      return evaluatedStatus(
        "SPECIAL_HOURS_UNVERIFIED",
        "SPECIAL_HOURS_NOT_VERIFIED",
        `Special or holiday hours for ${local.date} are not verified.`,
        { local, sourceState: "UNAVAILABLE" }
      );
    }
    const interval = periods.map(period => datedBounds(period, local, "VERIFIED_SPECIAL_HOURS")).find(Boolean) || null;
    const regular = normalizedPeriods(record.regularWeeklyBusinessHours?.periods, "weekly", true) || [];
    const nextOpening = nextDatedOpening(periods, local, "VERIFIED_SPECIAL_HOURS")
      || nextWeeklyOpening(regular, local, "VERIFIED_REGULAR_HOURS");
    return evaluatedStatus(
      interval ? "OPEN_VERIFIED" : "CLOSED_VERIFIED",
      interval ? "VERIFIED_SPECIAL_PERIOD_OPEN" : "VERIFIED_SPECIAL_PERIOD_CLOSED",
      `Verified special hours show the business ${interval ? "open" : "closed"}.`,
      { local, interval, nextOpening }
    );
  }

  const currentWindow = record.currentOpeningHoursWindow;
  if (currentWindow && local.date >= currentWindow.coverageStartDate && local.date <= currentWindow.coverageEndDate) {
    const periods = normalizedPeriods(currentWindow.periods, "dated");
    if (periods === null) {
      return evaluatedStatus("HOURS_UNKNOWN", "CURRENT_HOURS_STRUCTURE_INVALID", "Current-hours periods are invalid.", {
        local,
        sourceState: "INVALID"
      });
    }
    const interval = periods.map(period => datedBounds(period, local, "VERIFIED_CURRENT_HOURS")).find(Boolean) || null;
    const regular = normalizedPeriods(record.regularWeeklyBusinessHours?.periods, "weekly", true) || [];
    const nextOpening = nextDatedOpening(periods, local, "VERIFIED_CURRENT_HOURS")
      || nextWeeklyOpening(regular, local, "VERIFIED_REGULAR_HOURS");
    return evaluatedStatus(
      interval ? "OPEN_VERIFIED" : "CLOSED_VERIFIED",
      interval ? "VERIFIED_CURRENT_WINDOW_OPEN" : "VERIFIED_CURRENT_WINDOW_CLOSED",
      `Verified current-hours data show the business ${interval ? "open" : "closed"}.`,
      { local, interval, nextOpening }
    );
  }

  const periods = normalizedPeriods(record.regularWeeklyBusinessHours?.periods, "weekly", true);
  if (periods === null) {
    return evaluatedStatus("HOURS_UNKNOWN", "REGULAR_HOURS_INVALID", "Regular weekly business hours are missing or invalid.", {
      local,
      sourceState: "INVALID"
    });
  }
  const interval = periods.map(period => weeklyBounds(period, periods, local, "VERIFIED_REGULAR_HOURS")).find(Boolean) || null;
  const nextOpening = nextWeeklyOpening(periods, local, "VERIFIED_REGULAR_HOURS");
  return evaluatedStatus(
    interval ? "OPEN_VERIFIED" : "CLOSED_VERIFIED",
    interval ? "VERIFIED_REGULAR_PERIOD_OPEN" : "VERIFIED_REGULAR_PERIOD_CLOSED",
    `Verified regular hours show the business ${interval ? "open" : "closed"}.`,
    { local, interval, nextOpening }
  );
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

function visitDuration(candidate) {
  const source = candidate?.estimatedVisitDurationMinutes || candidate?.visitDurationMinutes;
  const minimum = Number(source?.minimum ?? source?.min ?? candidate?.estimatedVisitMinimumMinutes);
  const maximum = Number(source?.maximum ?? source?.max ?? candidate?.estimatedVisitMaximumMinutes);
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum <= 0 || maximum < minimum) return null;
  return {
    semantic: "ESTIMATED_VISIT_DURATION",
    minimumMinutes: minimum,
    maximumMinutes: maximum,
    display: `Estimated visit: ${minimum}\u2013${maximum} min`
  };
}

function admissionFor({ governedRuntimeScope, candidate, record, workspaceId, operatingProfileId, territoryId }) {
  const admission = assertGovernedCandidateAdmission({
    governedRuntimeScope,
    candidate,
    workspaceId,
    operatingProfileId,
    territoryId
  });
  const recordIdentity = cleanText(record?.googlePlaceId ?? record?.recordId, 180);
  if (!recordIdentity || recordIdentity !== admission.candidateIdentity
    || record?.workspaceId !== admission.workspaceId
    || record?.operatingProfileId !== admission.operatingProfileId) {
    throw new Error("Route IQ business-hours record does not match the admitted candidate identity and scope.");
  }
  return admission;
}

function decision({
  record = null,
  candidate = null,
  evaluatedAt,
  availability,
  admission = null,
  admissionError = null,
  workspaceId,
  operatingProfileId,
  freshnessInfo
}) {
  const coverageEligible = Boolean(admission) && !["INVALID", "UNAVAILABLE"].includes(availability.sourceState);
  const immediateRecommendationEligible = coverageEligible
    && availability.status === "OPEN_VERIFIED"
    && availability.freshnessState === "FRESH"
    && availability.sourceState === "VERIFIED";
  const uncertain = uncertainStatuses.has(availability.status);
  const confidence = cleanText(record?.hoursConfidence, 20) || "NONE";
  const provenance = hoursProvenance(record);
  const reasonCode = admissionError
    ? "BUSINESS_MANIFEST_ADMISSION_REJECTED"
    : availability.reasonCode;
  const reason = admissionError
    ? cleanText(admissionError.message, 600)
    : availability.reason;
  return {
    version: routeBusinessHoursEligibilityVersion,
    workspaceId,
    operatingProfileId,
    territoryId: cleanText(candidate?.territoryId, 120) || null,
    googlePlaceId: cleanText(record?.googlePlaceId || candidate?.googlePlaceId, 180) || null,
    recordId: cleanText(record?.recordId || candidate?.recordId, 180) || null,
    permanentOperationalStatus: cleanText(record?.permanentOperationalStatus || candidate?.businessStatus, 40) || "UNKNOWN",
    status: availability.status,
    eligible: immediateRecommendationEligible,
    coverageEligible,
    immediateRecommendationEligible,
    coverageOnly: coverageEligible && !immediateRecommendationEligible,
    selectionTier: immediateRecommendationEligible ? 0 : 99,
    internalMarker: uncertain ? hoursNotVerifiedMarker : availability.status === "CLOSED_VERIFIED" ? "CLOSED_NOW" : null,
    hoursConfidence: confidence,
    hoursFreshness: availability.freshnessState,
    sourceState: availability.sourceState,
    reasonCode,
    reason,
    availabilityReasonCode: availability.reasonCode,
    availabilityReason: availability.reason,
    evaluatedAt: evaluatedAt.toISOString(),
    businessLocalDate: availability.businessLocalDate,
    businessLocalTime: availability.businessLocalTime,
    businessTimezone: cleanText(record?.businessTimezone, 120) || null,
    effectiveInterval: availability.effectiveInterval,
    nextClosing: availability.nextClosing,
    nextOpening: availability.nextOpening,
    verifiedAt: freshnessInfo.verifiedAt,
    expiresAt: freshnessInfo.expiresAt,
    sourceRetrievedAt: cleanText(record?.sourceRetrievedAt, 40) || null,
    hoursVerifiedAt: cleanText(record?.hoursVerifiedAt, 40) || null,
    sourceStatus: cleanText(record?.currentOpenClosedEligibilityStatus, 40) || null,
    sourceStatusEvaluatedAt: cleanText(record?.currentStatusEvaluatedAt, 40) || null,
    provenance,
    admission: admission ? {
      manifestId: admission.manifestId,
      manifestVersion: admission.manifestVersion,
      manifestArtifactSha256: admission.manifestArtifactSha256,
      configurationVersion: admission.configurationVersion,
      administrationConfigurationVersion: admission.administrationConfigurationVersion,
      manifestConfigurationVersion: admission.manifestConfigurationVersion,
      classification: admission.classification,
      opportunitySourceId: admission.opportunitySourceId
    } : null,
    failClosed: !immediateRecommendationEligible && Boolean(admissionError),
    scoringChanged: false,
    availability: {
      status: availability.status,
      localTimezone: cleanText(record?.businessTimezone, 120) || null,
      effectiveInterval: availability.effectiveInterval,
      nextClosing: availability.nextClosing,
      nextOpening: availability.nextOpening,
      verifiedAt: freshnessInfo.verifiedAt,
      expiresAt: freshnessInfo.expiresAt,
      freshness: availability.freshnessState,
      sourceState: availability.sourceState,
      sourceSystem: provenance.sourceSystem,
      display: availability.displayStatus
    },
    visitDuration: visitDuration(candidate),
    explanation: {
      recommendationScore: "UNCHANGED",
      businessHoursEligibility: availability.status,
      immediateRecommendationEligible,
      coverageEligible,
      hoursConfidence: confidence,
      hoursFreshness: availability.freshnessState,
      reasonCode,
      reason,
      provenance
    },
    displayLabel: availability.displayStatus
  };
}

function isHistoricalFitnessScope(workspaceId, operatingProfileId) {
  return workspaceId === routeBusinessHoursWorkspaceId
    && operatingProfileId === routeBusinessHoursOperatingProfileId;
}

function validateGovernedBusinessHoursArtifact(artifact, workspaceId, operatingProfileId) {
  const failures = [];
  if (!artifact || typeof artifact !== "object" || Array.isArray(artifact)) return ["Business-hours artifact is missing or invalid."];
  if (artifact.schemaVersion !== "prometheus-data-business-hours-v1") failures.push("Business-hours schemaVersion mismatch.");
  if (artifact.workspaceId !== workspaceId) failures.push("Business-hours workspace mismatch.");
  if (artifact.operatingProfileId !== operatingProfileId) failures.push("Business-hours operating profile mismatch.");
  if (!Array.isArray(artifact.records)) failures.push("Business-hours records must be an array.");
  if (artifact.recordCount !== (artifact.records || []).length) failures.push("Business-hours recordCount mismatch.");
  if (Number(artifact.freshnessPolicy?.freshnessThresholdHours) > 24) failures.push("Business-hours freshness ceiling exceeds 24 hours.");
  const seen = new Set();
  for (const record of artifact.records || []) {
    const identity = cleanText(record?.googlePlaceId ?? record?.recordId, 180);
    if (!identity || seen.has(identity)) failures.push("Business-hours record identity is missing or duplicated.");
    seen.add(identity);
    if (record?.workspaceId !== workspaceId || record?.operatingProfileId !== operatingProfileId) {
      failures.push("Business-hours artifact contains a cross-scope record.");
    }
    if (!HOURS_CONFIDENCE_VALUES.includes(record?.hoursConfidence)) failures.push("Business-hours confidence is invalid.");
  }
  return failures;
}

export function buildRouteBusinessHoursIndex(artifact, options = {}) {
  const workspaceId = options.workspaceId || artifact?.workspaceId || routeBusinessHoursWorkspaceId;
  const operatingProfileId = options.operatingProfileId || artifact?.operatingProfileId || routeBusinessHoursOperatingProfileId;
  const governedRuntimeScope = options.governedRuntimeScope
    || (!isHistoricalFitnessScope(workspaceId, operatingProfileId) && artifact?.routeIqRuntimeScope
      ? createGovernedRouteRuntimeScopeFromBusinessHoursArtifact(artifact)
      : null);
  if (governedRuntimeScope) {
    assertGovernedRouteRuntimeScope({
      workspaceId,
      operatingProfileId,
      governedRuntimeScope,
      requiredAuthorization: routeIqGovernedRuntimeAuthorizations.businessHoursEligibility
    });
  }
  const failures = governedRuntimeScope
    ? validateGovernedBusinessHoursArtifact(artifact, workspaceId, operatingProfileId)
    : isHistoricalFitnessScope(workspaceId, operatingProfileId)
      ? validateBusinessHoursArtifact(artifact, workspaceId)
      : validateGovernedBusinessHoursArtifact(artifact, workspaceId, operatingProfileId);
  if (failures.length) throw new Error(`Route IQ business-hours artifact is invalid: ${failures.join(" | ")}`);
  const recordsByIdentity = new Map();
  for (const record of artifact.records) {
    const identity = cleanText(record.googlePlaceId ?? record.recordId, 180);
    recordsByIdentity.set(identity, record);
  }
  const approvedIdentities = governedApprovedBusinessIdentitySet(governedRuntimeScope);
  return {
    version: routeBusinessHoursEligibilityVersion,
    workspaceId,
    operatingProfileId,
    generatedAt: artifact.generatedAt,
    statusEvaluatedAt: artifact.statusEvaluatedAt,
    sourceDatasetVersion: artifact.sourceDatasetVersion,
    governedRuntimeScope,
    freshnessPolicy: {
      ...DEFAULT_BUSINESS_HOURS_POLICY,
      ...(artifact.freshnessPolicy || {}),
      freshnessThresholdHours: Math.min(24, Number(artifact.freshnessPolicy?.freshnessThresholdHours || 24))
    },
    recordCount: recordsByIdentity.size,
    approvedRecordCount: [...recordsByIdentity.keys()].filter(identity => approvedIdentities.has(identity)).length,
    recordsByIdentity,
    recordsByPlaceId: recordsByIdentity
  };
}

export function evaluateRouteBusinessHoursEligibility({
  record = null,
  candidate = null,
  evaluatedAt = new Date(),
  policy = DEFAULT_BUSINESS_HOURS_POLICY,
  artifactAvailable = true,
  workspaceId = candidate?.workspaceId || record?.workspaceId || routeBusinessHoursWorkspaceId,
  operatingProfileId = candidate?.operatingProfileId || record?.operatingProfileId || routeBusinessHoursOperatingProfileId,
  territoryId = candidate?.territoryId,
  governedRuntimeScope = null
} = {}) {
  const instant = evaluationInstant(evaluatedAt);
  let availability;
  if (!artifactAvailable) {
    availability = evaluatedStatus(
      "HOURS_UNKNOWN",
      "BUSINESS_HOURS_ARTIFACT_UNAVAILABLE",
      "The governed business-hours artifact is unavailable.",
      { freshnessState: "MISSING", sourceState: "UNAVAILABLE" }
    );
  } else if (!record) {
    availability = evaluatedStatus(
      "HOURS_UNKNOWN",
      "BUSINESS_HOURS_RECORD_UNAVAILABLE",
      "No governed business-hours record is available for this candidate.",
      { freshnessState: "MISSING", sourceState: "UNAVAILABLE" }
    );
  } else if (record.workspaceId !== workspaceId || record.operatingProfileId !== operatingProfileId) {
    availability = evaluatedStatus(
      "HOURS_UNKNOWN",
      "HOURS_RECORD_SCOPE_MISMATCH",
      "The business-hours record does not belong to the active workspace and operating profile.",
      { freshnessState: "MISSING", sourceState: "INVALID" }
    );
  } else {
    try {
      availability = evaluateAvailability(record, instant, policy);
    } catch (error) {
      availability = evaluatedStatus(
        "HOURS_UNKNOWN",
        cleanText(error?.code, 160) || "HOURS_EVALUATION_FAILED",
        cleanText(error?.message, 600) || "Business-hours evaluation failed.",
        { freshnessState: "MISSING", sourceState: "INVALID" }
      );
    }
  }
  if (!BUSINESS_HOURS_STATUSES.includes(availability.status)) {
    availability = evaluatedStatus("HOURS_UNKNOWN", "HOURS_STATUS_INVALID", "The hours evaluator returned an invalid status.", {
      freshnessState: "MISSING",
      sourceState: "INVALID"
    });
  }

  let admission = null;
  let admissionError = null;
  try {
    admission = admissionFor({
      governedRuntimeScope,
      candidate,
      record,
      workspaceId,
      operatingProfileId,
      territoryId
    });
  } catch (error) {
    admissionError = error;
  }
  return decision({
    record,
    candidate,
    evaluatedAt: instant,
    availability,
    admission,
    admissionError,
    workspaceId,
    operatingProfileId,
    freshnessInfo: freshness(record, instant, policy)
  });
}

export function applyHoursEligibilityToScore(scoreResult, eligibility) {
  const normalized = typeof scoreResult === "number" ? { score: scoreResult, signals: [] } : { ...(scoreResult || {}) };
  const score = Number(normalized.score);
  if (!Number.isFinite(score)) throw new Error("Route IQ score must remain finite when hours eligibility is applied.");
  const hoursSignal = eligibility.immediateRecommendationEligible
    ? "business hours verified open"
    : "business hours not immediate-route eligible";
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
    coverageEligible: 0,
    immediateRecommendationEligible: 0,
    excludedFromImmediateRecommendation: 0,
    hoursUnverified: 0,
    statuses: Object.fromEntries(BUSINESS_HOURS_STATUSES.map(status => [status, 0])),
    reasonCodes: {}
  };
  for (const item of decisions) {
    if (!item) continue;
    summary.evaluated += 1;
    if (item.coverageEligible) summary.coverageEligible += 1;
    if (item.immediateRecommendationEligible) summary.immediateRecommendationEligible += 1;
    else summary.excludedFromImmediateRecommendation += 1;
    if (item.internalMarker === hoursNotVerifiedMarker) summary.hoursUnverified += 1;
    if (summary.statuses[item.status] !== undefined) summary.statuses[item.status] += 1;
    summary.reasonCodes[item.reasonCode] = (summary.reasonCodes[item.reasonCode] || 0) + 1;
  }
  return summary;
}
