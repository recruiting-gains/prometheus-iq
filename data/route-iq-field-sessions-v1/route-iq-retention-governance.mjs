import { createHash } from "node:crypto";

export const routeIqRetentionMaximumCalendarMonths = 18;
export const routeIqRetentionGovernanceEventVersion = "route-iq-retention-governance-event-v1";
export const routeIqRetentionOperationAuthorizationVersion = "route-iq-retention-operation-authorization-v1";
export const routeIqRetentionEmptyLegalHoldLedgerSha256 = sha256(stableJson([]));

const LEGAL_HOLD_EVENT_TYPES = new Set(["LEGAL_HOLD_APPLIED", "LEGAL_HOLD_RELEASED"]);
const LEGAL_HOLD_AUTHORITIES = new Set(["prometheus_founder", "authorized_counsel"]);
const RETENTION_RECORD_CLASSES = new Set(["field_session_raw_evidence", "prospective_shadow_evidence"]);
const RETENTION_OPERATIONS = new Set(["administrative_disposition", "physical_deletion"]);
const OPAQUE_AUTHORIZATION_PATTERN = /^riq_retention_auth_[a-f0-9]{64}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

export class RouteIqRetentionGovernanceError extends Error {
  constructor(message, { code = "route_iq_retention_governance_invalid", status = 422, details = {} } = {}) {
    super(message);
    this.name = "RouteIqRetentionGovernanceError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new RouteIqRetentionGovernanceError(message, { code, details });
}

function assertExactKeys(value, allowedKeys, scope) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("route_iq_retention_structure_invalid", "Retention governance input has an invalid structure.", { scope });
  }
  const unknownFieldCount = Reflect.ownKeys(value)
    .filter(key => typeof key !== "string" || !allowedKeys.has(key))
    .length;
  if (unknownFieldCount > 0) {
    fail("route_iq_retention_fields_invalid", "Retention governance input contains unsupported fields.", {
      scope,
      unknownFieldCount
    });
  }
}

function assertRequiredKeys(value, requiredKeys, scope) {
  const missingFieldCount = [...requiredKeys].filter(key => !Object.hasOwn(value, key)).length;
  if (missingFieldCount > 0) {
    fail("route_iq_retention_fields_missing", "Retention governance input is missing required fields.", {
      scope,
      missingFieldCount
    });
  }
}

function canonicalIso(value, label) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    fail("route_iq_retention_time_invalid", `${label} must be a canonical UTC timestamp.`);
  }
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) {
    fail("route_iq_retention_time_invalid", `${label} must be a canonical UTC timestamp.`);
  }
  return { iso: value, milliseconds };
}

function requireSha256(value, label) {
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) {
    fail("route_iq_retention_hash_invalid", `${label} must be a full SHA-256 digest.`);
  }
  return value;
}

function normalizeSubject(subject) {
  assertExactKeys(subject, new Set([
    "workspaceId",
    "operatingProfileId",
    "recordClass",
    "sourceRecordSha256"
  ]), "subject");
  if (subject.workspaceId !== "fitness_connection" || subject.operatingProfileId !== "fitness") {
    fail("route_iq_retention_scope_unauthorized", "Retention governance scope is not authorized.");
  }
  if (!RETENTION_RECORD_CLASSES.has(subject.recordClass)) {
    fail("route_iq_retention_record_class_invalid", "Retention governance record class is not authorized.");
  }
  requireSha256(subject.sourceRecordSha256, "Retention source record hash");
  return {
    workspaceId: subject.workspaceId,
    operatingProfileId: subject.operatingProfileId,
    recordClass: subject.recordClass,
    sourceRecordSha256: subject.sourceRecordSha256
  };
}

function daysInUtcMonth(year, month) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

export function addRouteIqRetentionCalendarMonths(createdAt, months = routeIqRetentionMaximumCalendarMonths) {
  const created = canonicalIso(createdAt, "Retention source creation time");
  if (!Number.isInteger(months) || months < 1) {
    fail("route_iq_retention_month_count_invalid", "Retention month count must be a positive integer.");
  }
  const source = new Date(created.milliseconds);
  const absoluteMonth = source.getUTCMonth() + months;
  const targetYear = source.getUTCFullYear() + Math.floor(absoluteMonth / 12);
  const targetMonth = ((absoluteMonth % 12) + 12) % 12;
  const targetDay = Math.min(source.getUTCDate(), daysInUtcMonth(targetYear, targetMonth));
  const target = new Date(Date.UTC(
    targetYear,
    targetMonth,
    targetDay,
    source.getUTCHours(),
    source.getUTCMinutes(),
    source.getUTCSeconds(),
    source.getUTCMilliseconds()
  ));
  return target.toISOString();
}

export function calculateRouteIqRetentionBoundary(input = {}) {
  const requiredKeys = new Set(["createdAt", "customerContractExpiresAt"]);
  assertExactKeys(input, requiredKeys, "retention_boundary_calculation");
  assertRequiredKeys(input, requiredKeys, "retention_boundary_calculation");
  const created = canonicalIso(input.createdAt, "Retention source creation time");
  const policyMaximumExpiresAt = addRouteIqRetentionCalendarMonths(created.iso);
  const policyMaximum = canonicalIso(policyMaximumExpiresAt, "Policy maximum expiry");
  let customerContractExpiresAt = null;
  let customerOverrideState = "none";

  if (input.customerContractExpiresAt !== null) {
    const customerExpiry = canonicalIso(input.customerContractExpiresAt, "Customer contract expiry");
    if (customerExpiry.milliseconds <= created.milliseconds) {
      fail("route_iq_retention_customer_override_expired", "Customer retention override must end after source creation.");
    }
    if (customerExpiry.milliseconds >= policyMaximum.milliseconds) {
      fail("route_iq_retention_customer_override_not_shorter", "Customer retention override may only shorten the Founder maximum.");
    }
    customerContractExpiresAt = customerExpiry.iso;
    customerOverrideState = "shortened";
  }

  return deepFreeze({
    creationTimeBasis: "canonical_authoritative_server_record_time",
    createdAt: created.iso,
    maximumCalendarMonths: routeIqRetentionMaximumCalendarMonths,
    policyMaximumExpiresAt,
    customerOverrideState,
    customerContractExpiresAt,
    expiresAt: customerContractExpiresAt || policyMaximumExpiresAt
  });
}

export function evaluateRouteIqDeidentifiedAggregateRetention(input = {}) {
  assertExactKeys(input, new Set([
    "aggregateOnly",
    "deidentified",
    "containsRepresentativeIdentifier",
    "containsCustomerIdentifier",
    "containsSpecificVisitIdentifier",
    "containsPreciseLocationTrail",
    "containsRawEvidence",
    "reidentificationKeyAvailable"
  ]), "deidentified_aggregate");
  const reasons = [];
  if (input.aggregateOnly !== true) reasons.push("aggregate_only_required");
  if (input.deidentified !== true) reasons.push("deidentification_not_verified");
  if (input.containsRepresentativeIdentifier !== false) reasons.push("representative_identification_present_or_unknown");
  if (input.containsCustomerIdentifier !== false) reasons.push("customer_identification_present_or_unknown");
  if (input.containsSpecificVisitIdentifier !== false) reasons.push("specific_visit_identification_present_or_unknown");
  if (input.containsPreciseLocationTrail !== false) reasons.push("precise_location_trail_present_or_unknown");
  if (input.containsRawEvidence !== false) reasons.push("raw_evidence_present_or_unknown");
  if (input.reidentificationKeyAvailable !== false) reasons.push("reidentification_path_present_or_unknown");
  return deepFreeze({
    indefiniteRetentionEligible: reasons.length === 0,
    state: reasons.length === 0 ? "DEIDENTIFIED_AGGREGATE_RETENTION_ELIGIBLE" : "DEIDENTIFIED_AGGREGATE_RETENTION_BLOCKED",
    reasons,
    rawEvidenceRetentionBoundaryApplies: reasons.length !== 0,
    productionMutationAuthorized: false
  });
}

function legalHoldIdentityBody(event) {
  const { eventId, recordSha256, ...body } = event;
  return body;
}

function legalHoldRecordBody(event) {
  const { recordSha256, ...body } = event;
  return body;
}

function validateLegalHoldEvent(event, expectedSubject, previousEvent, expectedSequence) {
  assertExactKeys(event, new Set([
    "schemaVersion",
    "recordKind",
    "eventId",
    "eventType",
    "recordSequence",
    "recordedAt",
    "authority",
    "subject",
    "stateBefore",
    "stateAfter",
    "reasonCode",
    "previousEventSha256",
    "appendOnly",
    "historicalArchiveRewriteAllowed",
    "recordSha256"
  ]), "legal_hold_event");
  assertExactKeys(event.authority, new Set(["type", "authorizationReference"]), "legal_hold_event.authority");
  const subject = normalizeSubject(event.subject);
  if (stableJson(subject) !== stableJson(expectedSubject)) {
    fail("route_iq_retention_legal_hold_scope_mismatch", "Legal-hold event has a different governed subject.");
  }
  if (event.schemaVersion !== routeIqRetentionGovernanceEventVersion
    || event.recordKind !== "route_iq_retention_legal_hold_event"
    || !LEGAL_HOLD_EVENT_TYPES.has(event.eventType)
    || !LEGAL_HOLD_AUTHORITIES.has(event.authority.type)
    || !OPAQUE_AUTHORIZATION_PATTERN.test(event.authority.authorizationReference)
    || event.recordSequence !== expectedSequence
    || event.appendOnly !== true
    || event.historicalArchiveRewriteAllowed !== false) {
    fail("route_iq_retention_legal_hold_event_invalid", "Legal-hold event failed canonical validation.");
  }
  canonicalIso(event.recordedAt, "Legal-hold event time");
  requireSha256(event.recordSha256, "Legal-hold event record hash");
  if (!/^riq_retention_event_[a-f0-9]{64}$/.test(event.eventId)) {
    fail("route_iq_retention_legal_hold_event_id_invalid", "Legal-hold event identifier is invalid.");
  }
  const previousState = previousEvent?.stateAfter || "none";
  const expectedPreviousHash = previousEvent?.recordSha256 || null;
  const expectedAfter = event.eventType === "LEGAL_HOLD_APPLIED" ? "active" : "none";
  const expectedReason = event.eventType === "LEGAL_HOLD_APPLIED" ? "LEGAL_HOLD_REQUIRED" : "LEGAL_HOLD_RELEASED_BY_AUTHORITY";
  if (event.stateBefore !== previousState
    || event.stateAfter !== expectedAfter
    || event.reasonCode !== expectedReason
    || event.previousEventSha256 !== expectedPreviousHash
    || (event.eventType === "LEGAL_HOLD_APPLIED" && previousState !== "none")
    || (event.eventType === "LEGAL_HOLD_RELEASED" && previousState !== "active")) {
    fail("route_iq_retention_legal_hold_transition_invalid", "Legal-hold event transition is invalid.");
  }
  if (previousEvent && Date.parse(event.recordedAt) <= Date.parse(previousEvent.recordedAt)) {
    fail("route_iq_retention_legal_hold_chronology_invalid", "Legal-hold events must be strictly chronological.");
  }
  const expectedEventId = `riq_retention_event_${sha256(stableJson(legalHoldIdentityBody(event)))}`;
  if (event.eventId !== expectedEventId || sha256(stableJson(legalHoldRecordBody(event))) !== event.recordSha256) {
    fail("route_iq_retention_legal_hold_integrity_invalid", "Legal-hold event integrity verification failed.");
  }
  return event;
}

export function summarizeRouteIqRetentionLegalHold(input = {}) {
  assertExactKeys(input, new Set(["subject", "events"]), "legal_hold_ledger");
  const subject = normalizeSubject(input.subject);
  if (!Array.isArray(input.events)) {
    fail("route_iq_retention_legal_hold_ledger_missing", "A canonical legal-hold event ledger is required.");
  }
  let previous = null;
  for (let index = 0; index < input.events.length; index += 1) {
    previous = validateLegalHoldEvent(input.events[index], subject, previous, index + 1);
  }
  return deepFreeze({
    state: previous?.stateAfter || "none",
    eventCount: input.events.length,
    lastEventSha256: previous?.recordSha256 || null,
    ledgerSha256: sha256(stableJson(input.events.map(event => event.recordSha256)))
  });
}

export function createRouteIqRetentionLegalHoldEvent(input = {}, existingEvents = []) {
  assertExactKeys(input, new Set([
    "eventType",
    "recordedAt",
    "authority",
    "authorizationReference",
    "subject"
  ]), "legal_hold_event_request");
  if (!LEGAL_HOLD_EVENT_TYPES.has(input.eventType)
    || !LEGAL_HOLD_AUTHORITIES.has(input.authority)
    || !OPAQUE_AUTHORIZATION_PATTERN.test(input.authorizationReference)) {
    fail("route_iq_retention_legal_hold_authorization_invalid", "Legal-hold event authorization is invalid.");
  }
  canonicalIso(input.recordedAt, "Legal-hold event time");
  const subject = normalizeSubject(input.subject);
  const ledger = summarizeRouteIqRetentionLegalHold({ subject, events: existingEvents });
  if ((input.eventType === "LEGAL_HOLD_APPLIED" && ledger.state !== "none")
    || (input.eventType === "LEGAL_HOLD_RELEASED" && ledger.state !== "active")) {
    fail("route_iq_retention_legal_hold_transition_invalid", "Legal-hold event transition is invalid.");
  }
  const previous = existingEvents.at(-1) || null;
  if (previous && Date.parse(input.recordedAt) <= Date.parse(previous.recordedAt)) {
    fail("route_iq_retention_legal_hold_chronology_invalid", "Legal-hold events must be strictly chronological.");
  }
  const identityBody = {
    schemaVersion: routeIqRetentionGovernanceEventVersion,
    recordKind: "route_iq_retention_legal_hold_event",
    eventType: input.eventType,
    recordSequence: existingEvents.length + 1,
    recordedAt: input.recordedAt,
    authority: {
      type: input.authority,
      authorizationReference: input.authorizationReference
    },
    subject,
    stateBefore: ledger.state,
    stateAfter: input.eventType === "LEGAL_HOLD_APPLIED" ? "active" : "none",
    reasonCode: input.eventType === "LEGAL_HOLD_APPLIED" ? "LEGAL_HOLD_REQUIRED" : "LEGAL_HOLD_RELEASED_BY_AUTHORITY",
    previousEventSha256: previous?.recordSha256 || null,
    appendOnly: true,
    historicalArchiveRewriteAllowed: false
  };
  const event = {
    ...identityBody,
    eventId: `riq_retention_event_${sha256(stableJson(identityBody))}`
  };
  const record = deepFreeze({
    ...event,
    recordSha256: sha256(stableJson(event))
  });
  validateLegalHoldEvent(record, subject, previous, existingEvents.length + 1);
  return record;
}

export function evaluateRouteIqRetentionOperation(input = {}) {
  assertExactKeys(input, new Set([
    "operation",
    "requestedAt",
    "sourceCreatedAt",
    "effectiveExpiresAt",
    "subject",
    "legalHoldEvents",
    "authorization"
  ]), "retention_operation");
  if (!RETENTION_OPERATIONS.has(input.operation)) {
    fail("route_iq_retention_operation_invalid", "Retention operation is not governed.");
  }
  const requestedAt = canonicalIso(input.requestedAt, "Retention operation time");
  const sourceCreatedAt = canonicalIso(input.sourceCreatedAt, "Retention source creation time");
  const effectiveExpiresAt = canonicalIso(input.effectiveExpiresAt, "Retention effective expiry");
  const subject = normalizeSubject(input.subject);
  const reasons = [];
  let hold = null;
  if (!Array.isArray(input.legalHoldEvents)) {
    reasons.push("legal_hold_state_unknown");
  } else {
    hold = summarizeRouteIqRetentionLegalHold({ subject, events: input.legalHoldEvents });
    if (hold.state === "active") reasons.push("legal_hold_active");
  }
  if (requestedAt.milliseconds < sourceCreatedAt.milliseconds) {
    reasons.push("operation_precedes_source_creation");
  }
  if (effectiveExpiresAt.milliseconds <= sourceCreatedAt.milliseconds) {
    reasons.push("effective_expiry_invalid");
  }
  assertExactKeys(input.authorization, new Set([
    "version",
    "authority",
    "authorizationReference",
    "scope"
  ]), "retention_operation.authorization");
  if (input.authorization.version !== routeIqRetentionOperationAuthorizationVersion
    || !LEGAL_HOLD_AUTHORITIES.has(input.authorization.authority)
    || !OPAQUE_AUTHORIZATION_PATTERN.test(input.authorization.authorizationReference)) {
    reasons.push("operation_authorization_invalid");
  }

  if (input.operation === "administrative_disposition") {
    if (input.authorization.scope !== "single_explicit_append_only_disposition") {
      reasons.push("disposition_scope_invalid");
    }
  } else {
    if (input.authorization.scope !== "expired_source_physical_deletion") {
      reasons.push("deletion_scope_invalid");
    }
    if (requestedAt.milliseconds < effectiveExpiresAt.milliseconds) {
      reasons.push("retention_not_expired");
    }
    reasons.push("physical_deletion_not_implemented_or_activated");
  }

  const uniqueReasons = [...new Set(reasons)];
  return deepFreeze({
    operation: input.operation,
    allowed: uniqueReasons.length === 0,
    state: uniqueReasons.length === 0 ? "RETENTION_OPERATION_AUTHORIZED" : "RETENTION_OPERATION_BLOCKED",
    reasons: uniqueReasons,
    requestedAt: requestedAt.iso,
    sourceCreatedAt: sourceCreatedAt.iso,
    effectiveExpiresAt: effectiveExpiresAt.iso,
    legalHoldState: hold?.state || "unknown",
    legalHoldLedgerSha256: hold?.ledgerSha256 || null,
    requiresAppendOnlyAuditRecord: true,
    historicalArchiveRewriteAllowed: false,
    physicalMutationPerformed: false,
    productionMutationAuthorized: false
  });
}
