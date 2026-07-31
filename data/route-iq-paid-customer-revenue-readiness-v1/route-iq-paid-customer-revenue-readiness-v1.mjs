import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export const routeIqPaidCustomerRevenueDataVersion =
  "route-iq-paid-customer-revenue-readiness-data-v1";
export const routeIqPaidCustomerRevenueFixturePath =
  new URL("./fixtures/synthetic-orion-commercial-rehearsal-v1.json", import.meta.url);

const ID_PATTERN = /^[a-z][a-z0-9_]{2,127}$/u;
const VERSION_PATTERN = /^[a-z][a-z0-9_.-]{2,127}$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const LOCAL_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/u;
const WEEKDAYS = Object.freeze([
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY"
]);
const ALLOWED_LIFECYCLE_STATES = new Set(["DRAFT", "VALIDATED"]);
const ALLOWED_ROLES = new Set(["OWNER_MANAGER", "REPRESENTATIVE"]);
const ALLOWED_RESPONSIBILITIES = new Set([
  "PROMETHEUS_DATA",
  "CUSTOMER_AUTHORIZED_ADMINISTRATOR",
  "PROMETHEUS_SECURITY",
  "PROMETHEUS_INFRASTRUCTURE"
]);
const PROHIBITED_FIXTURE_TEXT = Object.freeze([
  "fitness connection",
  "anthony",
  "riq_receipt_",
  "stripe",
  "google places",
  "google maps"
]);

export class RouteIqPaidCustomerRevenueDataError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "RouteIqPaidCustomerRevenueDataError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new RouteIqPaidCustomerRevenueDataError(code, message);
}

function clone(value) {
  return structuredClone(value);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value).sort().map(key => [key, canonicalize(value[key])])
  );
}

export function stableRouteIqPaidCustomerRevenueJson(value) {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

export function routeIqPaidCustomerRevenueSha256(value) {
  const bytes = typeof value === "string" || Buffer.isBuffer(value)
    ? value
    : stableRouteIqPaidCustomerRevenueJson(value);
  return createHash("sha256").update(bytes).digest("hex");
}

function object(value, scope) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("route_iq_revenue_data_shape_invalid", `${scope} must be an object.`);
  }
  return value;
}

function exactKeys(value, keys, scope) {
  object(value, scope);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length
    || actual.some((key, index) => key !== expected[index])) {
    fail("route_iq_revenue_data_fields_invalid", `${scope} has invalid fields.`);
  }
}

function id(value, scope) {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) {
    fail("route_iq_revenue_data_identifier_invalid", `${scope} is invalid.`);
  }
}

function version(value, scope) {
  if (typeof value !== "string" || !VERSION_PATTERN.test(value)) {
    fail("route_iq_revenue_data_version_invalid", `${scope} is invalid.`);
  }
}

function timestamp(value, scope) {
  if (typeof value !== "string"
    || !ISO_DATE_PATTERN.test(value)
    || !Number.isFinite(Date.parse(value))) {
    fail("route_iq_revenue_data_timestamp_invalid", `${scope} is invalid.`);
  }
}

function unique(values, selector, scope) {
  if (!Array.isArray(values)) {
    fail("route_iq_revenue_data_list_invalid", `${scope} must be an array.`);
  }
  const identities = values.map(selector);
  if (new Set(identities).size !== identities.length) {
    fail("route_iq_revenue_data_duplicate_identity", `${scope} contains duplicate identities.`);
  }
}

function scopeOf(value) {
  return { companyId: value.companyId, workspaceId: value.workspaceId };
}

function sameScope(left, right) {
  return left.companyId === right.companyId && left.workspaceId === right.workspaceId;
}

function requireScope(value, expected, scope) {
  id(value.companyId, `${scope}.companyId`);
  id(value.workspaceId, `${scope}.workspaceId`);
  if (!sameScope(value, expected)) {
    fail("route_iq_revenue_data_cross_tenant", `${scope} crosses the governed tenant scope.`);
  }
}

function validateFixtureText(fixture) {
  const text = JSON.stringify(fixture).toLowerCase();
  if (PROHIBITED_FIXTURE_TEXT.some(fragment => text.includes(fragment))) {
    fail(
      "route_iq_revenue_data_prohibited_fixture",
      "The fictional rehearsal contains prohibited real or external data."
    );
  }
}

function validateTimeZone(value, scope) {
  if (typeof value !== "string" || value.length < 1 || value.length > 64) {
    fail("route_iq_revenue_data_timezone_invalid", `${scope} is invalid.`);
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
  } catch {
    fail("route_iq_revenue_data_timezone_invalid", `${scope} is invalid.`);
  }
}

function validateOperatingHours(value, scope) {
  if (!Array.isArray(value) || value.length !== WEEKDAYS.length) {
    fail("route_iq_revenue_data_operating_hours_invalid", `${scope} is invalid.`);
  }
  unique(value, item => item?.day, `${scope}.day`);
  const actualDays = new Set(value.map(item => item?.day));
  if (WEEKDAYS.some(day => !actualDays.has(day))) {
    fail("route_iq_revenue_data_operating_hours_invalid", `${scope} is invalid.`);
  }
  for (const [index, period] of value.entries()) {
    exactKeys(period, ["day", "opens", "closes"], `${scope}[${index}]`);
    const bothClosed = period.opens === null && period.closes === null;
    const bothTimed = typeof period.opens === "string"
      && typeof period.closes === "string"
      && LOCAL_TIME_PATTERN.test(period.opens)
      && LOCAL_TIME_PATTERN.test(period.closes);
    if (!WEEKDAYS.includes(period.day) || (!bothClosed && !bothTimed)) {
      fail("route_iq_revenue_data_operating_hours_invalid", `${scope}[${index}] is invalid.`);
    }
  }
}

function validateCommercialVersions(commercial, expectedScope) {
  exactKeys(commercial, [
    "companyId",
    "workspaceId",
    "pricingModelId",
    "currentPricingVersion",
    "currentCommercialTermsVersion",
    "liveBillingAuthorized",
    "paymentProviderObjectId",
    "history"
  ], "commercial");
  requireScope(commercial, expectedScope, "commercial");
  id(commercial.pricingModelId, "commercial.pricingModelId");
  version(commercial.currentPricingVersion, "commercial.currentPricingVersion");
  version(commercial.currentCommercialTermsVersion, "commercial.currentCommercialTermsVersion");
  if (commercial.liveBillingAuthorized !== false || commercial.paymentProviderObjectId !== null) {
    fail("route_iq_revenue_data_billing_not_blocked", "Live billing must remain blocked.");
  }
  unique(commercial.history, item => `${item.pricingVersion}:${item.commercialTermsVersion}`,
    "commercial.history");
  if (commercial.history.length < 2) {
    fail("route_iq_revenue_data_history_incomplete", "Commercial history must preserve prior versions.");
  }
  let currentFound = false;
  for (const [index, item] of commercial.history.entries()) {
    exactKeys(item, [
      "pricingVersion",
      "commercialTermsVersion",
      "effectiveAt",
      "status",
      "monthlyPriceCents",
      "currency",
      "snapshotSha256"
    ], `commercial.history[${index}]`);
    version(item.pricingVersion, `commercial.history[${index}].pricingVersion`);
    version(item.commercialTermsVersion, `commercial.history[${index}].commercialTermsVersion`);
    timestamp(item.effectiveAt, `commercial.history[${index}].effectiveAt`);
    if (!["SUPERSEDED", "CURRENT"].includes(item.status)
      || !Number.isSafeInteger(item.monthlyPriceCents)
      || item.monthlyPriceCents < 0
      || item.currency !== "USD"
      || !SHA256_PATTERN.test(item.snapshotSha256)) {
      fail("route_iq_revenue_data_commercial_history_invalid", "Commercial history is invalid.");
    }
    if (item.status === "CURRENT") {
      currentFound = item.pricingVersion === commercial.currentPricingVersion
        && item.commercialTermsVersion === commercial.currentCommercialTermsVersion;
    }
  }
  if (!currentFound) {
    fail("route_iq_revenue_data_current_version_unpinned", "Current commercial versions are not pinned.");
  }
}

function validateAudit(audit, expectedScope, declaredEvidenceIds) {
  exactKeys(audit, ["ledgerVersion", "events"], "audit");
  version(audit.ledgerVersion, "audit.ledgerVersion");
  unique(audit.events, event => event.eventId, "audit.events.eventId");
  unique(audit.events, event => event.idempotencyKey, "audit.events.idempotencyKey");
  const correlationSubjects = new Map();
  let previousEventSha256 = null;
  let previousOccurredAt = null;
  for (const [index, event] of audit.events.entries()) {
    exactKeys(event, [
      "eventId",
      "companyId",
      "workspaceId",
      "correlationId",
      "idempotencyKey",
      "eventType",
      "occurredAt",
      "lifecycleState",
      "productionWriteCount",
      "evidenceReferences",
      "previousEventSha256",
      "eventSha256"
    ], `audit.events[${index}]`);
    id(event.eventId, `audit.events[${index}].eventId`);
    id(event.correlationId, `audit.events[${index}].correlationId`);
    id(event.idempotencyKey, `audit.events[${index}].idempotencyKey`);
    requireScope(event, expectedScope, `audit.events[${index}]`);
    timestamp(event.occurredAt, `audit.events[${index}].occurredAt`);
    unique(event.evidenceReferences, reference => reference,
      `audit.events[${index}].evidenceReferences`);
    const { eventSha256, ...eventBody } = event;
    if (!ALLOWED_LIFECYCLE_STATES.has(event.lifecycleState)
      || event.productionWriteCount !== 0
      || !Array.isArray(event.evidenceReferences)
      || event.evidenceReferences.length === 0
      || event.previousEventSha256 !== previousEventSha256
      || !SHA256_PATTERN.test(event.eventSha256)
      || routeIqPaidCustomerRevenueSha256(
        JSON.stringify(canonicalize(eventBody))
      ) !== eventSha256) {
      fail("route_iq_revenue_data_audit_invalid", "Commercial audit evidence is invalid.");
    }
    if (event.evidenceReferences.some(reference => !declaredEvidenceIds.has(reference))) {
      fail(
        "route_iq_revenue_data_audit_evidence_unknown",
        "Commercial audit evidence references an undeclared record."
      );
    }
    const occurredAt = Date.parse(event.occurredAt);
    if (previousOccurredAt !== null && occurredAt < previousOccurredAt) {
      fail("route_iq_revenue_data_audit_out_of_order", "Commercial audit events are out of order.");
    }
    const eventSubject = `${event.eventType}:${event.lifecycleState}`;
    const priorSubject = correlationSubjects.get(event.correlationId);
    if (priorSubject && priorSubject !== eventSubject) {
      fail("route_iq_revenue_data_correlation_conflict", "A correlation identity was reused.");
    }
    correlationSubjects.set(event.correlationId, eventSubject);
    previousEventSha256 = event.eventSha256;
    previousOccurredAt = occurredAt;
  }
}

function validateLifecycle(fixture, expectedScope, evidenceHashesByType) {
  exactKeys(fixture.lifecycle, [
    "currentState",
    "activationAuthorized",
    "productionAdmissionAuthorized",
    "snapshots"
  ], "lifecycle");
  if (fixture.lifecycle.currentState !== "VALIDATED"
    || fixture.lifecycle.activationAuthorized !== false
    || fixture.lifecycle.productionAdmissionAuthorized !== false) {
    fail("route_iq_revenue_data_lifecycle_unsafe", "The rehearsal lifecycle is not safely non-active.");
  }
  unique(fixture.lifecycle.snapshots, item => item.snapshotId, "lifecycle.snapshots");
  const states = new Set();
  for (const [index, snapshot] of fixture.lifecycle.snapshots.entries()) {
    exactKeys(snapshot, [
      "snapshotId",
      "companyId",
      "workspaceId",
      "state",
      "recordedAt",
      "configurationVersion",
      "evidenceSha256",
      "active"
    ], `lifecycle.snapshots[${index}]`);
    id(snapshot.snapshotId, `lifecycle.snapshots[${index}].snapshotId`);
    requireScope(snapshot, expectedScope, `lifecycle.snapshots[${index}]`);
    timestamp(snapshot.recordedAt, `lifecycle.snapshots[${index}].recordedAt`);
    version(snapshot.configurationVersion, `lifecycle.snapshots[${index}].configurationVersion`);
    if (!ALLOWED_LIFECYCLE_STATES.has(snapshot.state)
      || !SHA256_PATTERN.test(snapshot.evidenceSha256)
      || snapshot.active !== false) {
      fail("route_iq_revenue_data_lifecycle_snapshot_invalid", "A lifecycle snapshot is invalid.");
    }
    const expectedEvidenceType = snapshot.state === "DRAFT"
      ? "ONBOARDING_CONFIGURATION"
      : "VALIDATION_RESULT";
    if (!evidenceHashesByType.get(expectedEvidenceType)?.has(snapshot.evidenceSha256)) {
      fail(
        "route_iq_revenue_data_lifecycle_evidence_unbound",
        "A lifecycle snapshot is not bound to its declared evidence."
      );
    }
    states.add(snapshot.state);
  }
  if (!states.has("DRAFT") || !states.has("VALIDATED")) {
    fail("route_iq_revenue_data_lifecycle_history_incomplete", "Draft and Validated evidence are required.");
  }
}

function validateProtectedState(state) {
  exactKeys(state, [
    "collection",
    "activeCohorts",
    "recommendationInfluence",
    "providerRefresh",
    "scheduler",
    "customerActivation",
    "activePool",
    "reservePool",
    "quarantinePool",
    "productionWrites",
    "crmWrites",
    "billingWrites",
    "invitationWrites",
    "capturedAt",
    "snapshotSha256"
  ], "protectedState");
  if (state.collection !== "OFF"
    || state.activeCohorts !== 0
    || state.recommendationInfluence !== "OFF"
    || state.providerRefresh !== "OFF"
    || state.scheduler !== "OFF"
    || state.customerActivation !== "OFF"
    || state.activePool !== 0
    || state.reservePool !== 0
    || state.quarantinePool !== 398
    || state.productionWrites !== 0
    || state.crmWrites !== 0
    || state.billingWrites !== 0
    || state.invitationWrites !== 0
    || !SHA256_PATTERN.test(state.snapshotSha256)) {
    fail("route_iq_revenue_data_protected_state_changed", "Protected state changed.");
  }
  timestamp(state.capturedAt, "protectedState.capturedAt");
}

function validateCleanup(cleanup, expectedScope) {
  exactKeys(cleanup, [
    "companyId",
    "workspaceId",
    "strategy",
    "quarantineEvidence",
    "removalEvidence",
    "rollbackSupported",
    "productionMutationAuthorized"
  ], "cleanup");
  requireScope(cleanup, expectedScope, "cleanup");
  if (cleanup.strategy !== "ISOLATED_FIXTURE_QUARANTINE_THEN_REMOVE"
    || cleanup.rollbackSupported !== true
    || cleanup.productionMutationAuthorized !== false) {
    fail("route_iq_revenue_data_cleanup_invalid", "Cleanup is not reversible and isolated.");
  }
  for (const [label, evidence, expectedStatus] of [
    ["quarantineEvidence", cleanup.quarantineEvidence, "QUARANTINED"],
    ["removalEvidence", cleanup.removalEvidence, "REMOVED"]
  ]) {
    exactKeys(evidence, [
      "evidenceId",
      "correlationId",
      "status",
      "recordedAt",
      "affectedProductionRecords",
      "evidenceSha256"
    ], `cleanup.${label}`);
    id(evidence.evidenceId, `cleanup.${label}.evidenceId`);
    id(evidence.correlationId, `cleanup.${label}.correlationId`);
    timestamp(evidence.recordedAt, `cleanup.${label}.recordedAt`);
    if (evidence.status !== expectedStatus
      || evidence.affectedProductionRecords !== 0
      || !SHA256_PATTERN.test(evidence.evidenceSha256)) {
      fail("route_iq_revenue_data_cleanup_evidence_invalid", "Cleanup evidence is invalid.");
    }
  }
  if (cleanup.quarantineEvidence.correlationId !== cleanup.removalEvidence.correlationId) {
    fail("route_iq_revenue_data_cleanup_correlation_invalid", "Cleanup evidence is not correlated.");
  }
  if (cleanup.quarantineEvidence.evidenceId === cleanup.removalEvidence.evidenceId
    || cleanup.quarantineEvidence.evidenceSha256 === cleanup.removalEvidence.evidenceSha256
    || Date.parse(cleanup.removalEvidence.recordedAt)
      < Date.parse(cleanup.quarantineEvidence.recordedAt)) {
    fail(
      "route_iq_revenue_data_cleanup_evidence_invalid",
      "Cleanup evidence identities, hashes, or chronology are invalid."
    );
  }
}

function validateResponsibilities(responsibilities) {
  exactKeys(responsibilities, ["retention", "export", "deletion"], "responsibilities");
  for (const [operation, value] of Object.entries(responsibilities)) {
    exactKeys(value, [
      "classification",
      "responsibleSubsystem",
      "customerAuthorizationRequired",
      "productionExecutionAuthorized"
    ], `responsibilities.${operation}`);
    if (!["GOVERNED_OPERATION", "CUSTOMER_REQUEST_OPERATION"].includes(value.classification)
      || !ALLOWED_RESPONSIBILITIES.has(value.responsibleSubsystem)
      || value.productionExecutionAuthorized !== false
      || (operation === "deletion" && value.customerAuthorizationRequired !== true)) {
      fail("route_iq_revenue_data_responsibility_invalid", "A data responsibility is invalid.");
    }
  }
}

export function validateRouteIqPaidCustomerRevenueFixture(input) {
  const fixture = clone(input);
  exactKeys(fixture, [
    "schemaVersion",
    "fixtureId",
    "classification",
    "ownerSubsystem",
    "companyId",
    "workspaceId",
    "company",
    "locations",
    "principals",
    "lifecycle",
    "commercial",
    "evidenceReferences",
    "audit",
    "cleanup",
    "protectedStateBefore",
    "protectedStateAfter",
    "responsibilities"
  ], "fixture");
  if (fixture.schemaVersion !== routeIqPaidCustomerRevenueDataVersion
    || fixture.classification !== "FICTIONAL_NONPRODUCTION_COMMERCIAL_REHEARSAL"
    || fixture.ownerSubsystem !== "Prometheus Data") {
    fail("route_iq_revenue_data_fixture_invalid", "The fixture identity is invalid.");
  }
  id(fixture.fixtureId, "fixture.fixtureId");
  id(fixture.companyId, "fixture.companyId");
  id(fixture.workspaceId, "fixture.workspaceId");
  const expectedScope = scopeOf(fixture);
  exactKeys(fixture.company, [
    "companyId",
    "workspaceId",
    "displayName",
    "fictional",
    "industry",
    "operatingTerminology"
  ], "company");
  requireScope(fixture.company, expectedScope, "company");
  if (fixture.company.fictional !== true) {
    fail("route_iq_revenue_data_real_customer_forbidden", "Only fictional customers are permitted.");
  }
  exactKeys(fixture.company.operatingTerminology, [
    "representativeSingular",
    "representativePlural",
    "locationSingular",
    "locationPlural",
    "primaryOutcome"
  ], "company.operatingTerminology");

  unique(fixture.locations, item => item.locationId, "locations");
  if (fixture.locations.length !== 2) {
    fail("route_iq_revenue_data_location_count_invalid", "Exactly two fictional locations are required.");
  }
  for (const [index, location] of fixture.locations.entries()) {
    exactKeys(location, [
      "locationId",
      "companyId",
      "workspaceId",
      "displayName",
      "fictional",
      "timeZone",
      "operatingHours",
      "active"
    ], `locations[${index}]`);
    id(location.locationId, `locations[${index}].locationId`);
    requireScope(location, expectedScope, `locations[${index}]`);
    if (location.fictional !== true || location.active !== false
      || !Array.isArray(location.operatingHours) || location.operatingHours.length !== 7) {
      fail("route_iq_revenue_data_location_invalid", "A fictional location is invalid.");
    }
    validateTimeZone(location.timeZone, `locations[${index}].timeZone`);
    validateOperatingHours(location.operatingHours, `locations[${index}].operatingHours`);
  }

  unique(fixture.principals, item => item.principalId, "principals");
  if (fixture.principals.length !== 3
    || fixture.principals.filter(item => item.role === "OWNER_MANAGER").length !== 1
    || fixture.principals.filter(item => item.role === "REPRESENTATIVE").length !== 2) {
    fail("route_iq_revenue_data_principal_roster_invalid", "The rehearsal principal roster is invalid.");
  }
  const locationIds = new Set(fixture.locations.map(item => item.locationId));
  for (const [index, principal] of fixture.principals.entries()) {
    exactKeys(principal, [
      "principalId",
      "companyId",
      "workspaceId",
      "displayName",
      "fictional",
      "role",
      "authorizedLocationIds",
      "permissions",
      "active"
    ], `principals[${index}]`);
    id(principal.principalId, `principals[${index}].principalId`);
    requireScope(principal, expectedScope, `principals[${index}]`);
    if (principal.fictional !== true || principal.active !== false
      || !ALLOWED_ROLES.has(principal.role)
      || principal.authorizedLocationIds.some(locationId => !locationIds.has(locationId))) {
      fail("route_iq_revenue_data_principal_invalid", "A fictional principal is invalid.");
    }
    if (principal.role === "REPRESENTATIVE"
      && ["founder", "billing", "governance", "cross_company"].some(
        permission => principal.permissions.includes(permission)
      )) {
      fail("route_iq_revenue_data_representative_overprivileged", "A representative is overprivileged.");
    }
  }

  validateCommercialVersions(fixture.commercial, expectedScope);
  unique(fixture.evidenceReferences, item => item.evidenceId, "evidenceReferences");
  const evidenceHashesByType = new Map();
  for (const [index, reference] of fixture.evidenceReferences.entries()) {
    exactKeys(reference, [
      "evidenceId",
      "companyId",
      "workspaceId",
      "evidenceType",
      "schemaVersion",
      "sha256",
      "productionRecord"
    ], `evidenceReferences[${index}]`);
    id(reference.evidenceId, `evidenceReferences[${index}].evidenceId`);
    requireScope(reference, expectedScope, `evidenceReferences[${index}]`);
    version(reference.schemaVersion, `evidenceReferences[${index}].schemaVersion`);
    if (!SHA256_PATTERN.test(reference.sha256) || reference.productionRecord !== false) {
      fail("route_iq_revenue_data_evidence_reference_invalid", "An evidence reference is invalid.");
    }
    const hashes = evidenceHashesByType.get(reference.evidenceType) || new Set();
    hashes.add(reference.sha256);
    evidenceHashesByType.set(reference.evidenceType, hashes);
  }
  validateLifecycle(fixture, expectedScope, evidenceHashesByType);
  validateAudit(
    fixture.audit,
    expectedScope,
    new Set(fixture.evidenceReferences.map(reference => reference.evidenceId))
  );
  validateCleanup(fixture.cleanup, expectedScope);
  validateProtectedState(fixture.protectedStateBefore);
  validateProtectedState(fixture.protectedStateAfter);
  if (stableRouteIqPaidCustomerRevenueJson(fixture.protectedStateBefore)
    !== stableRouteIqPaidCustomerRevenueJson(fixture.protectedStateAfter)) {
    fail("route_iq_revenue_data_protected_state_drift", "Protected state snapshots differ.");
  }
  validateResponsibilities(fixture.responsibilities);
  validateFixtureText(fixture);
  return fixture;
}

export function loadRouteIqPaidCustomerRevenueFixture({
  path = routeIqPaidCustomerRevenueFixturePath
} = {}) {
  return validateRouteIqPaidCustomerRevenueFixture(
    JSON.parse(readFileSync(path, "utf8"))
  );
}

export function authorizeRouteIqPaidCustomerRevenueScope(fixture, requestScope) {
  const validated = validateRouteIqPaidCustomerRevenueFixture(fixture);
  object(requestScope, "requestScope");
  id(requestScope.companyId, "requestScope.companyId");
  id(requestScope.workspaceId, "requestScope.workspaceId");
  if (!sameScope(validated, requestScope)) {
    fail("route_iq_revenue_data_cross_tenant", "The requested tenant scope is unauthorized.");
  }
  return Object.freeze({
    companyId: validated.companyId,
    workspaceId: validated.workspaceId,
    authorized: true
  });
}

export function createRouteIqPaidCustomerRevenueAuditIndex(fixture) {
  const validated = validateRouteIqPaidCustomerRevenueFixture(fixture);
  const eventIds = new Set();
  const idempotencyKeys = new Set();
  const correlations = new Map();
  for (const event of validated.audit.events) {
    if (eventIds.has(event.eventId) || idempotencyKeys.has(event.idempotencyKey)) {
      fail("route_iq_revenue_data_duplicate_identity", "Duplicate audit identity rejected.");
    }
    const subject = `${event.eventType}:${event.lifecycleState}`;
    if (correlations.has(event.correlationId)
      && correlations.get(event.correlationId) !== subject) {
      fail("route_iq_revenue_data_correlation_conflict", "Correlation reuse rejected.");
    }
    eventIds.add(event.eventId);
    idempotencyKeys.add(event.idempotencyKey);
    correlations.set(event.correlationId, subject);
  }
  return Object.freeze({
    eventCount: eventIds.size,
    eventIds: Object.freeze([...eventIds]),
    idempotencyKeys: Object.freeze([...idempotencyKeys]),
    correlations: Object.freeze(Object.fromEntries(correlations))
  });
}
