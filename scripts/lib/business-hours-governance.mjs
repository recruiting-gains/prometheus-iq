const isNodeRuntime = typeof process !== "undefined" && Boolean(process.versions?.node);
const [fs, path] = isNodeRuntime
  ? await Promise.all([import("node:fs").then(module => module.default), import("node:path").then(module => module.default)])
  : [null, null];

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
  freshnessThresholdHours: 24,
  fieldObservationFreshnessMinutes: 240,
  staleStatus: "HOURS_STALE",
  missingStatus: "HOURS_UNKNOWN",
  unverifiedSpecialHoursStatus: "SPECIAL_HOURS_UNVERIFIED"
});

export const BUSINESS_HOURS_WORKSPACES = Object.freeze({
  fitness_connection: Object.freeze({
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    protectedWorkspaceIds: Object.freeze([])
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
const DAY_LABELS = Object.freeze(["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]);
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
  if (typeof value === "string") {
    return localDateOrdinal(value) === null ? null : value;
  }
  const year = nullableInteger(value?.year, 1, 9999);
  const month = nullableInteger(value?.month, 1, 12);
  const day = nullableInteger(value?.day, 1, 31);
  if (year === null || month === null || day === null) return null;
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (candidate.getUTCFullYear() !== year || candidate.getUTCMonth() !== month - 1 || candidate.getUTCDate() !== day) {
    return null;
  }
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
  const candidate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  if (candidate.getUTCFullYear() !== parts.year
    || candidate.getUTCMonth() !== parts.month - 1
    || candidate.getUTCDate() !== parts.day) return null;
  return Math.floor(candidate.getTime() / 86_400_000);
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

function twelveHourTime(hour, minute) {
  const normalizedHour = hour % 12 || 12;
  return `${normalizedHour}:${String(minute).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
}

function localEvent(date, hour, minute, timeZone, source) {
  return {
    localDate: date,
    localTime: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    displayTime: twelveHourTime(hour, minute),
    timeZone,
    source
  };
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

function validWeeklyPoint(point) {
  return point
    && point.date === null
    && point.day !== null
    && point.hour !== null
    && point.minute !== null;
}

function validDatedPoint(point) {
  return point
    && point.date !== null
    && localDateOrdinal(point.date) !== null
    && point.hour !== null
    && point.minute !== null;
}

function canonicalTwentyFourHourPeriod(period, periods) {
  return periods.length === 1
    && validWeeklyPoint(period.open)
    && period.open.day === 0
    && period.open.hour === 0
    && period.open.minute === 0
    && period.close === null;
}

function strictPeriods(periods, mode) {
  if (!Array.isArray(periods)) return null;
  const normalized = periods.map(period => ({
    open: normalizeHoursPoint(period?.open),
    close: normalizeHoursPoint(period?.close)
  }));
  const valid = normalized.every(period => {
    if (mode === "weekly") {
      if (!validWeeklyPoint(period.open)) return false;
      if (period.close === null) return canonicalTwentyFourHourPeriod(period, normalized);
      if (!validWeeklyPoint(period.close)) return false;
      const openMinute = period.open.day * MINUTES_PER_DAY + period.open.hour * 60 + period.open.minute;
      let closeMinute = period.close.day * MINUTES_PER_DAY + period.close.hour * 60 + period.close.minute;
      if (closeMinute <= openMinute) closeMinute += MINUTES_PER_WEEK;
      return closeMinute > openMinute && closeMinute - openMinute <= MINUTES_PER_WEEK;
    }
    if (!validDatedPoint(period.open) || !validDatedPoint(period.close)) return false;
    const start = localStamp(period.open.date, period.open.hour, period.open.minute);
    const end = localStamp(period.close.date, period.close.hour, period.close.minute);
    return start !== null && end !== null && end > start;
  });
  return valid ? normalized : null;
}

export function normalizeHoursPeriods(periods, mode = "weekly") {
  if (!Array.isArray(periods)) return null;
  return strictPeriods(periods, mode);
}

function normalizeRegularHours(hours) {
  if (!hours || typeof hours !== "object") return null;
  return {
    periods: normalizeHoursPeriods(hours.periods, "weekly"),
    sourceOpenNowAtRetrieval: nullableBoolean(hours.openNow)
  };
}

function normalizeCurrentHours(hours, retrievedAt, timeZone) {
  if (!hours || typeof hours !== "object") return null;
  const localRetrieved = businessLocalDateTime(retrievedAt, timeZone);
  return {
    coverageStartDate: localRetrieved.date,
    coverageEndDate: addLocalDays(localRetrieved.date, 6),
    periods: normalizeHoursPeriods(hours.periods, "dated"),
    specialDays: Array.isArray(hours.specialDays)
      ? hours.specialDays.map(day => normalizeDate(day?.date)).filter(Boolean)
      : [],
    sourceOpenNowAtRetrieval: nullableBoolean(hours.openNow),
    nextOpenTime: nonEmpty(hours.nextOpenTime) ? hours.nextOpenTime : null,
    nextCloseTime: nonEmpty(hours.nextCloseTime) ? hours.nextCloseTime : null
  };
}

export function normalizeAppointmentAccessWindows(windows) {
  if (windows === undefined || windows === null) return [];
  if (!Array.isArray(windows)) return null;
  const normalized = windows.map(window => {
    const periods = normalizeHoursPeriods([{
      open: window?.start,
      close: window?.end
    }], "dated");
    if (!periods) return null;
    return {
      appointmentId: nonEmpty(window.appointmentId) ? window.appointmentId : null,
      verificationStatus: window.verificationStatus === "VERIFIED" ? "VERIFIED" : "UNVERIFIED",
      start: periods[0].open,
      end: periods[0].close,
      source: nonEmpty(window.source) ? window.source : null,
      verifiedAt: nonEmpty(window.verifiedAt) ? window.verifiedAt : null
    };
  });
  return normalized.every(Boolean) ? normalized : null;
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

function weeklyPeriodBounds(period, local, source) {
  const open = period?.open;
  if (!validWeeklyPoint(open)) return null;
  if (!period.close) {
    return canonicalTwentyFourHourPeriod(period, [period])
      ? {
        open: true,
        twentyFourHours: true,
        source,
        start: null,
        end: null
      }
      : null;
  }
  const close = period.close;
  if (!validWeeklyPoint(close)) return null;

  const openMinute = open.day * MINUTES_PER_DAY + open.hour * 60 + open.minute;
  let closeMinute = close.day * MINUTES_PER_DAY + close.hour * 60 + close.minute;
  if (closeMinute <= openMinute) closeMinute += MINUTES_PER_WEEK;
  const currentMinute = local.dayIndex * MINUTES_PER_DAY + local.hour * 60 + local.minute;
  const currentCandidates = [currentMinute, currentMinute + MINUTES_PER_WEEK];
  const matchedCurrent = currentCandidates.find(candidate => candidate >= openMinute && candidate < closeMinute);
  if (matchedCurrent === undefined) return null;
  const weekShiftDays = matchedCurrent === currentMinute ? 0 : -7;
  const startDayOffset = open.day - local.dayIndex + weekShiftDays;
  const logicalCloseDay = close.day + (closeMinute >= MINUTES_PER_WEEK ? 7 : 0);
  const endDayOffset = logicalCloseDay - local.dayIndex + weekShiftDays;
  return {
    open: true,
    twentyFourHours: false,
    source,
    start: localEvent(
      addLocalDays(local.date, startDayOffset),
      open.hour,
      open.minute,
      local.timeZone,
      source
    ),
    end: localEvent(
      addLocalDays(local.date, endDayOffset),
      close.hour,
      close.minute,
      local.timeZone,
      source
    )
  };
}

function weeklyNextOpening(periods, local, source) {
  const currentMinute = local.dayIndex * MINUTES_PER_DAY + local.hour * 60 + local.minute;
  let next = null;
  for (const period of periods) {
    if (canonicalTwentyFourHourPeriod(period, periods)) return null;
    if (!validWeeklyPoint(period?.open)) continue;
    const openMinute = period.open.day * MINUTES_PER_DAY + period.open.hour * 60 + period.open.minute;
    let delta = (openMinute - currentMinute + MINUTES_PER_WEEK) % MINUTES_PER_WEEK;
    if (delta === 0) delta = MINUTES_PER_WEEK;
    if (!next || delta < next.delta) next = { delta, open: period.open };
  }
  if (!next) return null;
  const localMinute = local.hour * 60 + local.minute;
  const dayOffset = Math.floor((localMinute + next.delta) / MINUTES_PER_DAY);
  return localEvent(addLocalDays(local.date, dayOffset), next.open.hour, next.open.minute, local.timeZone, source);
}

function datedPeriodBounds(period, local, source) {
  const open = period?.open;
  if (!validDatedPoint(open) || !validDatedPoint(period?.close)) return null;
  const start = localStamp(open.date, open.hour, open.minute);
  const current = localStamp(local.date, local.hour, local.minute);
  if (start === null || current === null || current < start) return null;
  const close = period.close;
  const end = localStamp(close.date, close.hour, close.minute);
  if (end === null || current >= end) return null;
  return {
    open: true,
    twentyFourHours: false,
    source,
    start: localEvent(open.date, open.hour, open.minute, local.timeZone, source),
    end: localEvent(close.date, close.hour, close.minute, local.timeZone, source)
  };
}

function datedNextOpening(periods, local, source) {
  const current = localStamp(local.date, local.hour, local.minute);
  let next = null;
  for (const period of periods) {
    if (!validDatedPoint(period?.open)) continue;
    const start = localStamp(period.open.date, period.open.hour, period.open.minute);
    if (start !== null && start > current && (!next || start < next.start)) {
      next = { start, open: period.open };
    }
  }
  return next
    ? localEvent(next.open.date, next.open.hour, next.open.minute, local.timeZone, source)
    : null;
}

function verifiedAppointmentWindow(record, local) {
  for (const window of record.appointmentAccessWindows || []) {
    if (window.verificationStatus !== "VERIFIED") continue;
    const bounds = datedPeriodBounds({ open: window.start, close: window.end }, local, "VERIFIED_APPOINTMENT_WINDOW");
    if (bounds) return bounds;
  }
  return null;
}

function effectiveInterval(source, bounds) {
  if (!bounds) return null;
  return {
    source,
    twentyFourHours: bounds.twentyFourHours,
    start: bounds.start,
    end: bounds.end
  };
}

function displayStatusFor(status, interval, nextOpening) {
  if (status === "HOURS_STALE") return "Hours outdated · verification required";
  if (status === "HOURS_UNKNOWN" || status === "SPECIAL_HOURS_UNVERIFIED") {
    return "Hours unavailable · not route eligible";
  }
  if (status === "OPEN_VERIFIED" && interval?.source === "VERIFIED_APPOINTMENT_WINDOW") {
    return "Appointment window verified";
  }
  if (status === "OPEN_VERIFIED" && interval?.twentyFourHours) return "Open 24 hours";
  if (status === "OPEN_VERIFIED" && interval?.end?.displayTime) {
    return `Open now · closes ${interval.end.displayTime}`;
  }
  if (status === "CLOSED_VERIFIED" && nextOpening?.localDate && nextOpening?.displayTime) {
    const dayIndex = new Date(`${nextOpening.localDate}T12:00:00Z`).getUTCDay();
    return `Closed · opens ${DAY_LABELS[dayIndex]} at ${nextOpening.displayTime}`;
  }
  return status === "CLOSED_VERIFIED" ? "Closed" : "Hours unavailable · not route eligible";
}

function statusResult(
  status,
  reasonCode,
  reason,
  local = null,
  freshnessStatus = "FRESH",
  interval = null,
  nextOpening = null
) {
  const normalizedInterval = effectiveInterval(interval?.source || null, interval);
  return {
    status,
    reasonCode,
    reason,
    hoursFreshnessStatus: freshnessStatus,
    businessLocalDate: local?.date ?? null,
    businessLocalTime: local?.time ?? null,
    effectiveInterval: normalizedInterval,
    nextOpening,
    nextClosing: normalizedInterval?.end || null,
    displayStatus: displayStatusFor(status, normalizedInterval, nextOpening)
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

  const local = isValidBusinessTimeZone(record.businessTimezone)
    ? businessLocalDateTime(evaluatedAt, record.businessTimezone)
    : null;

  if (["CLOSED_PERMANENTLY", "CLOSED_TEMPORARILY"].includes(record.permanentOperationalStatus)) {
    return statusResult(
      "CLOSED_VERIFIED",
      `PERMANENT_STATUS_${record.permanentOperationalStatus}`,
      `Provider business status is ${record.permanentOperationalStatus}.`,
      local
    );
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

  if (record.appointmentAccessRequired === true) {
    const windows = normalizeAppointmentAccessWindows(record.appointmentAccessWindows);
    if (!windows) {
      return statusResult(
        "HOURS_UNKNOWN",
        "APPOINTMENT_WINDOWS_INVALID",
        "Appointment-only access windows are invalid.",
        local,
        "FRESH"
      );
    }
    const appointmentBounds = verifiedAppointmentWindow({ appointmentAccessWindows: windows }, local);
    const nextAppointment = datedNextOpening(
      windows
        .filter(window => window.verificationStatus === "VERIFIED")
        .map(window => ({ open: window.start, close: window.end })),
      local,
      "VERIFIED_APPOINTMENT_WINDOW"
    );
    if (appointmentBounds) {
      return statusResult(
        "OPEN_VERIFIED",
        "VERIFIED_APPOINTMENT_WINDOW_OPEN",
        `A verified appointment or restricted-access window is active at ${local.time} ${record.businessTimezone}.`,
        local,
        "FRESH",
        appointmentBounds,
        nextAppointment
      );
    }
    return statusResult(
      "CLOSED_VERIFIED",
      "VERIFIED_APPOINTMENT_WINDOW_CLOSED",
      "No verified appointment or restricted-access window is active.",
      local,
      "FRESH",
      null,
      nextAppointment
    );
  }

  const special = (record.specialOrHolidayHours || []).find(entry => entry.date === local.date);
  if (special) {
    const specialPeriods = strictPeriods(special.periods, "dated");
    if (special.verificationStatus !== "VERIFIED" || specialPeriods === null) {
      return statusResult(
        "SPECIAL_HOURS_UNVERIFIED",
        "SPECIAL_HOURS_NOT_VERIFIED",
        `Special or holiday hours for ${local.date} are not verified.`,
        local
      );
    }
    const bounds = specialPeriods.map(period => datedPeriodBounds(period, local, "VERIFIED_SPECIAL_HOURS")).find(Boolean) || null;
    const nextOpening = datedNextOpening(specialPeriods, local, "VERIFIED_SPECIAL_HOURS")
      || weeklyNextOpening(strictPeriods(record.regularWeeklyBusinessHours?.periods, "weekly") || [], local, "VERIFIED_REGULAR_HOURS");
    const isOpen = Boolean(bounds);
    return statusResult(
      isOpen ? "OPEN_VERIFIED" : "CLOSED_VERIFIED",
      isOpen ? "VERIFIED_SPECIAL_PERIOD_OPEN" : "VERIFIED_SPECIAL_PERIOD_CLOSED",
      `Verified special or holiday hours show the business ${isOpen ? "open" : "closed"} at ${local.time} ${record.businessTimezone}.`,
      local,
      "FRESH",
      bounds,
      nextOpening
    );
  }

  const currentWindow = record.currentOpeningHoursWindow;
  if (currentWindow && local.date >= currentWindow.coverageStartDate && local.date <= currentWindow.coverageEndDate) {
    const currentPeriods = strictPeriods(currentWindow.periods, "dated");
    if (currentPeriods === null) {
      return statusResult(
        "HOURS_UNKNOWN",
        "CURRENT_HOURS_STRUCTURE_INVALID",
        "Provider current-hours periods are missing or invalid.",
        local,
        "FRESH"
      );
    }
    const bounds = currentPeriods.map(period => datedPeriodBounds(period, local, "VERIFIED_CURRENT_HOURS")).find(Boolean) || null;
    const nextOpening = datedNextOpening(currentPeriods, local, "VERIFIED_CURRENT_HOURS")
      || weeklyNextOpening(strictPeriods(record.regularWeeklyBusinessHours?.periods, "weekly") || [], local, "VERIFIED_REGULAR_HOURS");
    const isOpen = Boolean(bounds);
    return statusResult(
      isOpen ? "OPEN_VERIFIED" : "CLOSED_VERIFIED",
      isOpen ? "VERIFIED_CURRENT_WINDOW_OPEN" : "VERIFIED_CURRENT_WINDOW_CLOSED",
      `Verified provider current-hours data show the business ${isOpen ? "open" : "closed"} at ${local.time} ${record.businessTimezone}.`,
      local,
      "FRESH",
      bounds,
      nextOpening
    );
  }

  const regular = record.regularWeeklyBusinessHours;
  const regularPeriods = strictPeriods(regular?.periods, "weekly");
  if (!regular || regularPeriods === null) {
    return statusResult("HOURS_UNKNOWN", "REGULAR_HOURS_MISSING", "Regular weekly business hours are missing.", local, "FRESH");
  }
  const bounds = regularPeriods.map(period => weeklyPeriodBounds(period, local, "VERIFIED_REGULAR_HOURS")).find(Boolean) || null;
  const nextOpening = weeklyNextOpening(regularPeriods, local, "VERIFIED_REGULAR_HOURS");
  const isOpen = Boolean(bounds);
  return statusResult(
    isOpen ? "OPEN_VERIFIED" : "CLOSED_VERIFIED",
    isOpen ? "VERIFIED_REGULAR_PERIOD_OPEN" : "VERIFIED_REGULAR_PERIOD_CLOSED",
    `Verified regular hours show the business ${isOpen ? "open" : "closed"} at ${local.time} ${record.businessTimezone}.`,
    local,
    "FRESH",
    bounds,
    nextOpening
  );
}

function identityFromCandidate(candidate, workspace, activePlaceIds) {
  const accessType = candidate.access_type ?? candidate.accessType;
  const appointmentAccessWindows = candidate.appointment_access_windows
    ?? candidate.appointmentAccessWindows;
  return {
    workspaceId: workspace.workspaceId,
    operatingProfileId: workspace.operatingProfileId,
    googlePlaceId: candidate.google_place_id,
    businessName: candidate.business_name,
    address: candidate.full_address,
    category: candidate.category,
    accessType: nonEmpty(accessType) ? accessType : null,
    appointmentAccessRequired: accessType === "Appointment only",
    appointmentAccessWindows: normalizeAppointmentAccessWindows(appointmentAccessWindows) || [],
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
    currentStatusBusinessLocalTime: evaluation.businessLocalTime,
    currentEffectiveInterval: evaluation.effectiveInterval,
    currentNextOpening: evaluation.nextOpening,
    currentNextClosing: evaluation.nextClosing,
    currentAvailabilityDisplay: evaluation.displayStatus
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
    currentStatusBusinessLocalTime: null,
    currentEffectiveInterval: null,
    currentNextOpening: null,
    currentNextClosing: null,
    currentAvailabilityDisplay: "Hours unavailable · not route eligible"
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
    currentStatusBusinessLocalTime: null,
    currentEffectiveInterval: null,
    currentNextOpening: null,
    currentNextClosing: null,
    currentAvailabilityDisplay: "Hours unavailable · not route eligible"
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

export function recalculateBusinessHoursArtifact(artifact, evaluatedAt = new Date(), options = {}) {
  assertBusinessHoursWorkspace(artifact?.workspaceId, artifact?.operatingProfileId);
  const policy = {
    ...DEFAULT_BUSINESS_HOURS_POLICY,
    ...(artifact.freshnessPolicy || {}),
    freshnessThresholdHours: Math.min(
      24,
      Number(artifact.freshnessPolicy?.freshnessThresholdHours || DEFAULT_BUSINESS_HOURS_POLICY.freshnessThresholdHours)
    )
  };
  const instant = evaluatedAt instanceof Date ? evaluatedAt : new Date(evaluatedAt);
  if (Number.isNaN(instant.getTime())) {
    throw governanceError("business_hours_evaluation_time_invalid", `Invalid artifact evaluation time: ${evaluatedAt}`);
  }
  return {
    ...artifact,
    projectionVersion: "route-iq-business-availability-v2",
    generatedAt: instant.toISOString(),
    statusEvaluatedAt: instant.toISOString(),
    protectedWorkspaceIds: [],
    freshnessPolicy: policy,
    refreshMode: "offline-status-evaluation",
    records: (artifact.records || []).map(record => applyEvaluation({
      ...record,
      accessType: record.accessType ?? null,
      appointmentAccessRequired: record.appointmentAccessRequired === true,
      appointmentAccessWindows: Array.isArray(record.appointmentAccessWindows) ? record.appointmentAccessWindows : [],
      activePoolMember: options.activePlaceIds instanceof Set
        ? options.activePlaceIds.has(record.googlePlaceId)
        : record.activePoolMember
    }, instant, policy))
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
  if (artifact.projectionVersion !== "route-iq-business-availability-v2") failures.push("Business-hours projectionVersion mismatch.");
  if (artifact.workspaceId !== expectedWorkspaceId) failures.push("Business-hours workspace mismatch.");
  if (artifact.operatingProfileId !== BUSINESS_HOURS_WORKSPACES[expectedWorkspaceId].operatingProfileId) failures.push("Business-hours operating profile mismatch.");
  if (artifact.routeEligibilityActivated !== false) failures.push("Business-hours artifact must not activate route eligibility.");
  if (artifact.runtimeBehaviorChanged !== false) failures.push("Business-hours artifact must preserve runtime behavior.");
  if (artifact.scoringChanged !== false) failures.push("Business-hours artifact must preserve scoring.");
  if (!Array.isArray(artifact.records)) failures.push("Business-hours records must be an array.");
  if (artifact.recordCount !== (artifact.records || []).length) failures.push("Business-hours recordCount mismatch.");
  if (!Number.isFinite(Number(artifact.freshnessPolicy?.freshnessThresholdHours))
    || Number(artifact.freshnessPolicy.freshnessThresholdHours) > 24) {
    failures.push("Business-hours freshness threshold must not exceed 24 hours.");
  }
  if (!Array.isArray(artifact.protectedWorkspaceIds) || artifact.protectedWorkspaceIds.length !== 0) {
    failures.push("Business-hours artifact must not carry inactive workspace identities.");
  }

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
    if (typeof record.appointmentAccessRequired !== "boolean" || !Array.isArray(record.appointmentAccessWindows)) {
      failures.push(`Invalid appointment access-window structure: ${label}`);
    }
    if (typeof record.currentOpenClosedEligibilityStatus === "boolean" || typeof record.hoursFreshnessStatus === "boolean") {
      failures.push(`Boolean false certainty is prohibited for business hours: ${label}`);
    }
    if (record.regularWeeklyBusinessHours === false || record.currentOpeningHoursWindow === false || record.businessTimezone === false) {
      failures.push(`Missing business-hours values must use null, not false: ${label}`);
    }
    if (!record.hoursProvenance || typeof record.hoursProvenance !== "object") failures.push(`Missing business-hours provenance: ${label}`);
    if (!nonEmpty(record.currentStatusReasonCode) || !nonEmpty(record.currentStatusReason)) failures.push(`Missing explainable hours status reason: ${label}`);
    if (!nonEmpty(record.currentAvailabilityDisplay)) failures.push(`Missing business-hours display state: ${label}`);
    if (record.currentEffectiveInterval !== null && typeof record.currentEffectiveInterval !== "object") {
      failures.push(`Invalid effective business-hours interval: ${label}`);
    }
  }
  return failures;
}

export function readBusinessHoursArtifact(filePath, workspaceId = "fitness_connection") {
  assertBusinessHoursWorkspace(workspaceId);
  if (!fs) throw governanceError("business_hours_filesystem_unavailable", "Business-hours artifact reads require the Node.js filesystem runtime.");
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
  if (!fs || !path) throw governanceError("business_hours_filesystem_unavailable", "Business-hours artifact writes require the Node.js filesystem runtime.");
  const failures = validateBusinessHoursArtifact(artifact, workspaceId);
  if (failures.length) {
    throw governanceError("business_hours_artifact_invalid", failures.join("\n"));
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify(artifact, null, 2) + "\n");
  fs.renameSync(temporaryPath, filePath);
}
