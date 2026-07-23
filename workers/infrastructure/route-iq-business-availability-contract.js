export const ROUTE_IQ_BUSINESS_AVAILABILITY_PATH = "/api/dashboard/route-iq/business-availability";
export const ROUTE_IQ_BUSINESS_AVAILABILITY_BINDING = "ROUTE_IQ_BUSINESS_AVAILABILITY_COORDINATOR";
export const ROUTE_IQ_BUSINESS_AVAILABILITY_CLASS = "RouteIqBusinessAvailabilityCoordinator";
export const ROUTE_IQ_BUSINESS_AVAILABILITY_MIGRATION = "route-iq-business-availability-sqlite-v1";
export const ROUTE_IQ_BUSINESS_AVAILABILITY_PRODUCER_BINDING = "ROUTE_IQ_BUSINESS_AVAILABILITY_DATA_PRODUCER";
export const ROUTE_IQ_BUSINESS_AVAILABILITY_SCHEDULE = "0 4 * * *";

export const ROUTE_IQ_BUSINESS_AVAILABILITY_ENV = Object.freeze({
  mode: "ROUTE_IQ_BUSINESS_AVAILABILITY_MODE",
  activation: "ROUTE_IQ_BUSINESS_AVAILABILITY_ACTIVATION"
});

export const ROUTE_IQ_BUSINESS_AVAILABILITY_VERSIONS = Object.freeze({
  activation: "route-iq-business-availability-activation-v1",
  snapshot: "route-iq-business-availability-runtime-snapshot-v1",
  record: "route-iq-business-availability-runtime-record-v1",
  dataProjection: "route-iq-business-availability-v2",
  manifest: "route-iq-workspace-business-artifact-manifest-v1",
  providerAdapter: "route-iq-business-hours-provider-adapter.v1",
  normalizationInput: "route-iq-business-hours-data-normalization-input.v1",
  coordinator: "route-iq-business-availability-coordinator-v1",
  read: "route-iq-business-availability-read-v1"
});

export const ROUTE_IQ_BUSINESS_AVAILABILITY_LIMITS = Object.freeze({
  activationBytes: 64 * 1024,
  commandBytes: 2 * 1024 * 1024,
  producerResponseBytes: 2 * 1024 * 1024,
  recordsPerSnapshot: 1_000,
  scopesPerActivation: 10,
  territoriesPerScope: 64,
  providersPerScope: 8,
  snapshotsPerCoordinator: 550,
  conflictsPerCoordinator: 256,
  failuresPerCoordinator: 2_048,
  pendingOutbox: 32,
  storageBytesPerCoordinator: 768 * 1024 * 1024,
  producerTimeoutMs: 15_000,
  maximumFreshnessHours: 24,
  activationLifetimeDays: 31
});

export const ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES = Object.freeze({
  inactive: "route_iq_business_availability_inactive",
  configurationInvalid: "route_iq_business_availability_configuration_invalid",
  methodNotAllowed: "route_iq_business_availability_method_not_allowed",
  scopeUnauthorized: "route_iq_business_availability_scope_unauthorized",
  territoryUnauthorized: "route_iq_business_availability_territory_unauthorized",
  bindingMissing: "route_iq_business_availability_binding_missing",
  producerMissing: "route_iq_business_availability_producer_missing",
  producerFailed: "route_iq_business_availability_producer_failed",
  producerContractInvalid: "route_iq_business_availability_producer_contract_invalid",
  snapshotInvalid: "route_iq_business_availability_snapshot_invalid",
  manifestMismatch: "route_iq_business_availability_manifest_mismatch",
  sourceUnauthorized: "route_iq_business_availability_source_unauthorized",
  snapshotConflict: "route_iq_business_availability_snapshot_conflict",
  storageUnavailable: "route_iq_business_availability_storage_unavailable",
  storageBudgetExceeded: "route_iq_business_availability_storage_budget_exceeded",
  recordBudgetExceeded: "route_iq_business_availability_record_budget_exceeded",
  outboxBudgetExceeded: "route_iq_business_availability_outbox_budget_exceeded",
  noSnapshot: "route_iq_business_availability_snapshot_unavailable"
});

export const ROUTE_IQ_BUSINESS_AVAILABILITY_STATUSES = Object.freeze([
  "OPEN_VERIFIED",
  "CLOSED_VERIFIED",
  "HOURS_UNKNOWN",
  "HOURS_STALE",
  "SPECIAL_HOURS_UNVERIFIED",
  "APPOINTMENT_WINDOW_VERIFIED"
]);

const ID_PATTERN = /^[a-z][a-z0-9_]{2,127}$/u;
const PROVIDER_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/u;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const PERMITTED_CLASSIFICATIONS = new Set([
  "FOUNDER_FIELD_RESEARCH",
  "CUSTOMER_GOVERNED_DATA"
]);
const SOURCE_EVENT_KINDS = new Set([
  "weekly",
  "special",
  "appointment",
  "provider_window",
  "open_24_hours"
]);

export class RouteIqBusinessAvailabilityError extends Error {
  constructor(code, status = 503) {
    super("Route IQ business availability is unavailable.");
    this.name = "RouteIqBusinessAvailabilityError";
    this.code = code;
    this.status = status;
  }
}

export function failRouteIqBusinessAvailability(code, status = 503) {
  throw new RouteIqBusinessAvailabilityError(code, status);
}

export function routeIqBusinessAvailabilityExactKeys(value, expected, code = ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.snapshotInvalid) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    failRouteIqBusinessAvailability(code);
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    failRouteIqBusinessAvailability(code);
  }
}

export function routeIqBusinessAvailabilityUtf8Bytes(value) {
  return new TextEncoder().encode(String(value)).byteLength;
}

export function routeIqBusinessAvailabilityCanonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(routeIqBusinessAvailabilityCanonicalJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map(key => `${JSON.stringify(key)}:${routeIqBusinessAvailabilityCanonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export async function routeIqBusinessAvailabilitySha256(value) {
  const bytes = typeof value === "string"
    ? new TextEncoder().encode(value)
    : value;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

function canonicalTimestamp(value, code = ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.snapshotInvalid) {
  if (typeof value !== "string") failRouteIqBusinessAvailability(code);
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value) {
    failRouteIqBusinessAvailability(code);
  }
  return timestamp;
}

function opaqueId(value, code = ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.snapshotInvalid) {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) {
    failRouteIqBusinessAvailability(code);
  }
  return value;
}

function providerId(value, code = ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.snapshotInvalid) {
  if (typeof value !== "string" || !PROVIDER_ID_PATTERN.test(value)) {
    failRouteIqBusinessAvailability(code);
  }
  return value;
}

function sha256(value, code = ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.snapshotInvalid) {
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) {
    failRouteIqBusinessAvailability(code);
  }
  return value;
}

function timeZone(value) {
  if (typeof value !== "string" || value.length < 1 || value.length > 80) {
    failRouteIqBusinessAvailability(ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.snapshotInvalid);
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date(0));
  } catch {
    failRouteIqBusinessAvailability(ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.snapshotInvalid);
  }
  return value;
}

function sortedUniqueOpaqueIds(values, maximum, code) {
  if (!Array.isArray(values) || values.length < 1 || values.length > maximum) {
    failRouteIqBusinessAvailability(code);
  }
  values.forEach(value => opaqueId(value, code));
  const sorted = [...values].sort();
  if (new Set(sorted).size !== sorted.length
    || values.some((value, index) => value !== sorted[index])) {
    failRouteIqBusinessAvailability(code);
  }
  return sorted;
}

function sortedUniqueProviderIds(values, maximum, code) {
  if (!Array.isArray(values) || values.length < 1 || values.length > maximum) {
    failRouteIqBusinessAvailability(code);
  }
  values.forEach(value => providerId(value, code));
  const sorted = [...values].sort();
  if (new Set(sorted).size !== sorted.length
    || values.some((value, index) => value !== sorted[index])) {
    failRouteIqBusinessAvailability(code);
  }
  return sorted;
}

function validateActivationScope(scope, seenScopes) {
  const code = ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.configurationInvalid;
  routeIqBusinessAvailabilityExactKeys(scope, [
    "workspaceId",
    "operatingProfileId",
    "manifestId",
    "manifestVersion",
    "manifestArtifactSha256",
    "configurationVersion",
    "approvalState",
    "classification",
    "productionUseAuthorized",
    "territoryIds",
    "allowedProviderIds",
    "allowedProviderContractVersions",
    "dataProjectionVersion"
  ], code);
  opaqueId(scope.workspaceId, code);
  opaqueId(scope.operatingProfileId, code);
  opaqueId(scope.manifestId, code);
  providerId(scope.configurationVersion, code);
  sha256(scope.manifestArtifactSha256, code);
  if (scope.manifestVersion !== ROUTE_IQ_BUSINESS_AVAILABILITY_VERSIONS.manifest
    || scope.approvalState !== "APPROVED"
    || !PERMITTED_CLASSIFICATIONS.has(scope.classification)
    || scope.productionUseAuthorized !== true
    || scope.dataProjectionVersion !== ROUTE_IQ_BUSINESS_AVAILABILITY_VERSIONS.dataProjection) {
    failRouteIqBusinessAvailability(code);
  }
  sortedUniqueOpaqueIds(
    scope.territoryIds,
    ROUTE_IQ_BUSINESS_AVAILABILITY_LIMITS.territoriesPerScope,
    code
  );
  sortedUniqueProviderIds(
    scope.allowedProviderIds,
    ROUTE_IQ_BUSINESS_AVAILABILITY_LIMITS.providersPerScope,
    code
  );
  sortedUniqueProviderIds(
    scope.allowedProviderContractVersions,
    ROUTE_IQ_BUSINESS_AVAILABILITY_LIMITS.providersPerScope,
    code
  );
  const scopeKey = `${scope.workspaceId}\u0000${scope.operatingProfileId}`;
  if (seenScopes.has(scopeKey)) failRouteIqBusinessAvailability(code);
  seenScopes.add(scopeKey);
  return Object.freeze(structuredClone(scope));
}

export function validateRouteIqBusinessAvailabilityScope(scope) {
  return validateActivationScope(scope, new Set());
}

export function getRouteIqBusinessAvailabilityActivation(env = {}, { now = new Date() } = {}) {
  const mode = env?.[ROUTE_IQ_BUSINESS_AVAILABILITY_ENV.mode];
  if (mode === undefined || mode === null || mode === "" || mode === "OFF") {
    return Object.freeze({ mode: "OFF", active: false });
  }
  if (mode !== "ON") {
    failRouteIqBusinessAvailability(ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.configurationInvalid);
  }
  const source = env?.[ROUTE_IQ_BUSINESS_AVAILABILITY_ENV.activation];
  if (typeof source !== "string"
    || source.length < 2
    || routeIqBusinessAvailabilityUtf8Bytes(source) > ROUTE_IQ_BUSINESS_AVAILABILITY_LIMITS.activationBytes) {
    failRouteIqBusinessAvailability(ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.configurationInvalid);
  }
  let activation;
  try {
    activation = JSON.parse(source);
  } catch {
    failRouteIqBusinessAvailability(ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.configurationInvalid);
  }
  const code = ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.configurationInvalid;
  routeIqBusinessAvailabilityExactKeys(activation, [
    "schemaVersion",
    "configurationVersion",
    "state",
    "workerName",
    "issuedAt",
    "expiresAt",
    "scheduleCron",
    "maximumFreshnessHours",
    "producerBinding",
    "scopes"
  ], code);
  const issuedAt = canonicalTimestamp(activation.issuedAt, code);
  const expiresAt = canonicalTimestamp(activation.expiresAt, code);
  const current = now instanceof Date ? now.getTime() : new Date(now).getTime();
  if (activation.schemaVersion !== ROUTE_IQ_BUSINESS_AVAILABILITY_VERSIONS.activation
    || !PROVIDER_ID_PATTERN.test(activation.configurationVersion || "")
    || activation.state !== "ON"
    || activation.workerName !== "prometheus-iq"
    || activation.scheduleCron !== ROUTE_IQ_BUSINESS_AVAILABILITY_SCHEDULE
    || activation.maximumFreshnessHours !== ROUTE_IQ_BUSINESS_AVAILABILITY_LIMITS.maximumFreshnessHours
    || activation.producerBinding !== ROUTE_IQ_BUSINESS_AVAILABILITY_PRODUCER_BINDING
    || !Number.isFinite(current)
    || issuedAt > current + 60_000
    || expiresAt <= current
    || expiresAt <= issuedAt
    || expiresAt - issuedAt > ROUTE_IQ_BUSINESS_AVAILABILITY_LIMITS.activationLifetimeDays * 24 * 60 * 60 * 1000
    || !Array.isArray(activation.scopes)
    || activation.scopes.length < 1
    || activation.scopes.length > ROUTE_IQ_BUSINESS_AVAILABILITY_LIMITS.scopesPerActivation) {
    failRouteIqBusinessAvailability(code);
  }
  const seenScopes = new Set();
  const scopes = activation.scopes.map(scope => validateActivationScope(scope, seenScopes));
  return Object.freeze({
    mode: "ON",
    active: true,
    configurationVersion: activation.configurationVersion,
    issuedAt: activation.issuedAt,
    expiresAt: activation.expiresAt,
    scheduleCron: activation.scheduleCron,
    maximumFreshnessHours: activation.maximumFreshnessHours,
    producerBinding: activation.producerBinding,
    scopes
  });
}

export function findRouteIqBusinessAvailabilityScope(activation, workspaceId, operatingProfileId) {
  if (!activation?.active) {
    failRouteIqBusinessAvailability(ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.inactive, 404);
  }
  const scope = activation.scopes.find(candidate => (
    candidate.workspaceId === workspaceId
    && candidate.operatingProfileId === operatingProfileId
  ));
  if (!scope) {
    failRouteIqBusinessAvailability(ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.scopeUnauthorized, 403);
  }
  return scope;
}

function validateWeeklyPeriod(period) {
  routeIqBusinessAvailabilityExactKeys(period, ["openDay", "openTime", "closeDay", "closeTime"]);
  if (!Number.isInteger(period.openDay)
    || period.openDay < 0
    || period.openDay > 6
    || !TIME_PATTERN.test(period.openTime)
    || !Number.isInteger(period.closeDay)
    || period.closeDay < 0
    || period.closeDay > 6
    || !TIME_PATTERN.test(period.closeTime)) {
    failRouteIqBusinessAvailability(ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.snapshotInvalid);
  }
}

function validateSpecialPeriod(period) {
  routeIqBusinessAvailabilityExactKeys(period, ["date", "status", "openTime", "closeTime"]);
  if (!DATE_PATTERN.test(period.date || "") || !["OPEN", "CLOSED"].includes(period.status)) {
    failRouteIqBusinessAvailability(ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.snapshotInvalid);
  }
  if (period.status === "CLOSED") {
    if (period.openTime !== null || period.closeTime !== null) {
      failRouteIqBusinessAvailability(ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.snapshotInvalid);
    }
  } else if (!TIME_PATTERN.test(period.openTime || "") || !TIME_PATTERN.test(period.closeTime || "")) {
    failRouteIqBusinessAvailability(ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.snapshotInvalid);
  }
}

function validateAppointmentWindow(window) {
  routeIqBusinessAvailabilityExactKeys(window, ["startsAt", "endsAt", "verifiedAt"]);
  const startsAt = canonicalTimestamp(window.startsAt);
  const endsAt = canonicalTimestamp(window.endsAt);
  const verifiedAt = canonicalTimestamp(window.verifiedAt);
  if (startsAt >= endsAt || verifiedAt > endsAt) {
    failRouteIqBusinessAvailability(ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.snapshotInvalid);
  }
}

function validateLocalEvent(event) {
  if (event === null) return;
  routeIqBusinessAvailabilityExactKeys(event, [
    "localDate",
    "localTime",
    "displayTime",
    "timeZone",
    "source"
  ]);
  if (!DATE_PATTERN.test(event.localDate || "")
    || !TIME_PATTERN.test(event.localTime || "")
    || typeof event.displayTime !== "string"
    || event.displayTime.length < 1
    || event.displayTime.length > 32
    || /[\u0000-\u001F\u007F]/u.test(event.displayTime)
    || !SOURCE_EVENT_KINDS.has(event.source)) {
    failRouteIqBusinessAvailability(ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.snapshotInvalid);
  }
  timeZone(event.timeZone);
}

function validateEffectiveInterval(interval) {
  if (interval === null) return;
  routeIqBusinessAvailabilityExactKeys(interval, ["source", "twentyFourHours", "start", "end"]);
  if (!SOURCE_EVENT_KINDS.has(interval.source) || typeof interval.twentyFourHours !== "boolean") {
    failRouteIqBusinessAvailability(ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.snapshotInvalid);
  }
  validateLocalEvent(interval.start);
  validateLocalEvent(interval.end);
  if (interval.twentyFourHours && (interval.start !== null || interval.end !== null)) {
    failRouteIqBusinessAvailability(ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.snapshotInvalid);
  }
}

async function validateAvailabilityRecord(record, snapshot, scope, approvedIds, seenIds) {
  routeIqBusinessAvailabilityExactKeys(record, [
    "schemaVersion",
    "businessId",
    "territoryId",
    "timeZone",
    "weeklyPeriods",
    "specialPeriods",
    "appointmentWindows",
    "open24Hours",
    "appointmentOnly",
    "currentStatus",
    "currentStatusEvaluatedAt",
    "currentEffectiveInterval",
    "nextOpening",
    "nextClosing",
    "sourceRetrievedAt",
    "verifiedAt",
    "evidenceExpiresAt",
    "freshnessState",
    "provenance",
    "recordSha256"
  ]);
  opaqueId(record.businessId);
  opaqueId(record.territoryId);
  if (record.schemaVersion !== ROUTE_IQ_BUSINESS_AVAILABILITY_VERSIONS.record
    || !approvedIds.has(record.businessId)
    || seenIds.has(record.businessId)
    || !scope.territoryIds.includes(record.territoryId)
    || !Array.isArray(record.weeklyPeriods)
    || record.weeklyPeriods.length > 64
    || !Array.isArray(record.specialPeriods)
    || record.specialPeriods.length > 366
    || !Array.isArray(record.appointmentWindows)
    || record.appointmentWindows.length > 64
    || typeof record.open24Hours !== "boolean"
    || typeof record.appointmentOnly !== "boolean"
    || !ROUTE_IQ_BUSINESS_AVAILABILITY_STATUSES.includes(record.currentStatus)
    || !["FRESH", "STALE", "MISSING"].includes(record.freshnessState)) {
    failRouteIqBusinessAvailability(ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.snapshotInvalid);
  }
  seenIds.add(record.businessId);
  timeZone(record.timeZone);
  record.weeklyPeriods.forEach(validateWeeklyPeriod);
  record.specialPeriods.forEach(validateSpecialPeriod);
  record.appointmentWindows.forEach(validateAppointmentWindow);
  validateEffectiveInterval(record.currentEffectiveInterval);
  validateLocalEvent(record.nextOpening);
  validateLocalEvent(record.nextClosing);
  const evaluatedAt = canonicalTimestamp(record.currentStatusEvaluatedAt);
  const retrievedAt = canonicalTimestamp(record.sourceRetrievedAt);
  const evidenceExpiresAt = canonicalTimestamp(record.evidenceExpiresAt);
  const verifiedAt = record.verifiedAt === null ? null : canonicalTimestamp(record.verifiedAt);
  if (evaluatedAt > Date.parse(snapshot.generatedAt) + 60_000
    || retrievedAt > Date.parse(snapshot.generatedAt) + 60_000
    || (verifiedAt !== null && verifiedAt > Date.parse(snapshot.generatedAt) + 60_000)
    || (record.freshnessState === "FRESH" && (verifiedAt === null || evidenceExpiresAt <= Date.parse(snapshot.generatedAt)))
    || (["OPEN_VERIFIED", "CLOSED_VERIFIED", "APPOINTMENT_WINDOW_VERIFIED"].includes(record.currentStatus)
      && record.freshnessState !== "FRESH")
    || (record.currentStatus === "HOURS_STALE" && record.freshnessState !== "STALE")
    || (record.currentStatus === "HOURS_UNKNOWN" && record.freshnessState !== "MISSING")
    || (record.open24Hours && (record.weeklyPeriods.length > 0 || record.appointmentOnly))) {
    failRouteIqBusinessAvailability(ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.snapshotInvalid);
  }
  routeIqBusinessAvailabilityExactKeys(record.provenance, [
    "providerId",
    "providerContractVersion",
    "providerRecordId",
    "providerAdapterVersion",
    "normalizationInputVersion",
    "dataProjectionVersion",
    "normalizedAt"
  ]);
  providerId(record.provenance.providerId);
  providerId(record.provenance.providerContractVersion);
  providerId(record.provenance.providerRecordId);
  if (record.provenance.providerId !== snapshot.source.providerId
    || record.provenance.providerContractVersion !== snapshot.source.providerContractVersion
    || record.provenance.providerAdapterVersion !== ROUTE_IQ_BUSINESS_AVAILABILITY_VERSIONS.providerAdapter
    || record.provenance.normalizationInputVersion !== ROUTE_IQ_BUSINESS_AVAILABILITY_VERSIONS.normalizationInput
    || record.provenance.dataProjectionVersion !== ROUTE_IQ_BUSINESS_AVAILABILITY_VERSIONS.dataProjection
    || canonicalTimestamp(record.provenance.normalizedAt) > Date.parse(snapshot.generatedAt) + 60_000) {
    failRouteIqBusinessAvailability(ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.snapshotInvalid);
  }
  const recordCopy = structuredClone(record);
  delete recordCopy.recordSha256;
  const computed = await routeIqBusinessAvailabilitySha256(
    routeIqBusinessAvailabilityCanonicalJson(recordCopy)
  );
  if (sha256(record.recordSha256) !== computed) {
    failRouteIqBusinessAvailability(ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.snapshotInvalid);
  }
}

export async function validateRouteIqBusinessAvailabilitySnapshot(snapshot, scope, { now = new Date() } = {}) {
  routeIqBusinessAvailabilityExactKeys(snapshot, [
    "schemaVersion",
    "producerSubsystem",
    "refreshBatchId",
    "workspaceId",
    "operatingProfileId",
    "manifest",
    "source",
    "generatedAt",
    "expiresAt",
    "recordCount",
    "records",
    "canonicalPayloadSha256"
  ]);
  opaqueId(snapshot.refreshBatchId);
  opaqueId(snapshot.workspaceId);
  opaqueId(snapshot.operatingProfileId);
  const generatedAt = canonicalTimestamp(snapshot.generatedAt);
  const expiresAt = canonicalTimestamp(snapshot.expiresAt);
  const current = now instanceof Date ? now.getTime() : new Date(now).getTime();
  if (snapshot.schemaVersion !== ROUTE_IQ_BUSINESS_AVAILABILITY_VERSIONS.snapshot
    || snapshot.producerSubsystem !== "Prometheus Data"
    || snapshot.workspaceId !== scope.workspaceId
    || snapshot.operatingProfileId !== scope.operatingProfileId
    || !Number.isFinite(current)
    || generatedAt > current + 60_000
    || expiresAt <= current
    || expiresAt <= generatedAt
    || expiresAt - generatedAt > ROUTE_IQ_BUSINESS_AVAILABILITY_LIMITS.maximumFreshnessHours * 60 * 60 * 1000
    || !Number.isInteger(snapshot.recordCount)
    || snapshot.recordCount < 0
    || snapshot.recordCount > ROUTE_IQ_BUSINESS_AVAILABILITY_LIMITS.recordsPerSnapshot
    || !Array.isArray(snapshot.records)
    || snapshot.records.length !== snapshot.recordCount) {
    failRouteIqBusinessAvailability(ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.snapshotInvalid);
  }

  routeIqBusinessAvailabilityExactKeys(snapshot.manifest, [
    "manifestId",
    "manifestVersion",
    "artifactSha256",
    "configurationVersion",
    "approvalState",
    "classification",
    "productionUseAuthorized",
    "approvedRecordCount",
    "approvedRecordIds"
  ]);
  opaqueId(snapshot.manifest.manifestId);
  sha256(snapshot.manifest.artifactSha256);
  providerId(snapshot.manifest.configurationVersion);
  if (snapshot.manifest.manifestId !== scope.manifestId
    || snapshot.manifest.manifestVersion !== scope.manifestVersion
    || snapshot.manifest.artifactSha256 !== scope.manifestArtifactSha256
    || snapshot.manifest.configurationVersion !== scope.configurationVersion
    || snapshot.manifest.approvalState !== scope.approvalState
    || snapshot.manifest.classification !== scope.classification
    || snapshot.manifest.productionUseAuthorized !== true
    || !Number.isInteger(snapshot.manifest.approvedRecordCount)
    || snapshot.manifest.approvedRecordCount < 0
    || snapshot.manifest.approvedRecordCount > ROUTE_IQ_BUSINESS_AVAILABILITY_LIMITS.recordsPerSnapshot
    || !Array.isArray(snapshot.manifest.approvedRecordIds)
    || snapshot.manifest.approvedRecordIds.length !== snapshot.manifest.approvedRecordCount
    || snapshot.recordCount !== snapshot.manifest.approvedRecordCount) {
    failRouteIqBusinessAvailability(ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.manifestMismatch);
  }
  const approvedIds = new Set(
    sortedUniqueOpaqueIds(
      snapshot.manifest.approvedRecordIds,
      Math.max(1, ROUTE_IQ_BUSINESS_AVAILABILITY_LIMITS.recordsPerSnapshot),
      ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.manifestMismatch
    )
  );

  routeIqBusinessAvailabilityExactKeys(snapshot.source, [
    "providerId",
    "providerContractVersion",
    "providerAdapterVersion",
    "normalizationInputVersion",
    "dataProjectionVersion",
    "retrievedAt"
  ]);
  providerId(snapshot.source.providerId);
  providerId(snapshot.source.providerContractVersion);
  if (!scope.allowedProviderIds.includes(snapshot.source.providerId)
    || !scope.allowedProviderContractVersions.includes(snapshot.source.providerContractVersion)
    || snapshot.source.providerAdapterVersion !== ROUTE_IQ_BUSINESS_AVAILABILITY_VERSIONS.providerAdapter
    || snapshot.source.normalizationInputVersion !== ROUTE_IQ_BUSINESS_AVAILABILITY_VERSIONS.normalizationInput
    || snapshot.source.dataProjectionVersion !== ROUTE_IQ_BUSINESS_AVAILABILITY_VERSIONS.dataProjection
    || canonicalTimestamp(snapshot.source.retrievedAt) > generatedAt + 60_000) {
    failRouteIqBusinessAvailability(ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.sourceUnauthorized);
  }

  const seenIds = new Set();
  for (const record of snapshot.records) {
    await validateAvailabilityRecord(record, snapshot, scope, approvedIds, seenIds);
  }
  if (seenIds.size !== approvedIds.size) {
    failRouteIqBusinessAvailability(ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.manifestMismatch);
  }

  const copy = structuredClone(snapshot);
  delete copy.canonicalPayloadSha256;
  const computed = await routeIqBusinessAvailabilitySha256(
    routeIqBusinessAvailabilityCanonicalJson(copy)
  );
  if (sha256(snapshot.canonicalPayloadSha256) !== computed) {
    failRouteIqBusinessAvailability(ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.snapshotInvalid);
  }
  if (routeIqBusinessAvailabilityUtf8Bytes(JSON.stringify(snapshot))
    > ROUTE_IQ_BUSINESS_AVAILABILITY_LIMITS.commandBytes) {
    failRouteIqBusinessAvailability(ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.recordBudgetExceeded, 413);
  }
  return Object.freeze(structuredClone(snapshot));
}

export function routeIqBusinessAvailabilityCoordinatorName(scope) {
  opaqueId(scope.workspaceId, ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.configurationInvalid);
  opaqueId(scope.operatingProfileId, ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.configurationInvalid);
  return `${scope.workspaceId}\u0000${scope.operatingProfileId}`;
}
