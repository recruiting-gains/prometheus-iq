import {
  createHash,
  createHmac,
  timingSafeEqual
} from "node:crypto";

export const routeIqRetentionMaximumCalendarMonths = 18;
export const routeIqRetentionGovernanceEventVersion = "route-iq-retention-governance-event-v1";
export const routeIqRetentionOperationAuthorizationVersion = "route-iq-retention-operation-authorization-v2";
export const routeIqRetentionDeletionAuthorizationVersion = "route-iq-retention-deletion-authorization-v1";
export const routeIqRetentionAuthorityAssertionVersion = "route-iq-retention-authority-assertion-v1";
export const routeIqRetentionOperationReceiptVersion = "route-iq-retention-operation-receipt-v1";
export const routeIqRetentionDeletionEventVersion = "route-iq-retention-deletion-event-v1";
export const routeIqCustomerRetentionOverrideAuthorityVersion = "route-iq-customer-retention-override-authority-v1";
export const routeIqDeidentifiedAggregateVersion = "route-iq-deidentified-aggregate-v1";
export const routeIqDeidentifiedAggregateAttestationVersion = "route-iq-deidentified-aggregate-attestation-v1";
export const routeIqRetentionProductionLegalHoldAuthorityVersion = "route-iq-retention-production-legal-hold-authority-v1";
export const routeIqRetentionProductionLegalHoldReadinessVersion = "route-iq-retention-production-legal-hold-readiness-v1";
export const routeIqRetentionProductionLegalHoldRevalidationVersion = "route-iq-retention-production-legal-hold-revalidation-v1";
export const routeIqRetentionProductionLegalHoldMaximumAgeMilliseconds = 60_000;
export const routeIqRetentionAdministrativeDispositionTarget = deepFreeze({
  workspaceId: "fitness_connection",
  operatingProfileId: "fitness",
  sessionId: "route-iq-field-session-fitness-connection-fitness-cruz-2026-07-14",
  sourceRawSha256: "ceb72963ab4e98d6039c1a4a1a409d281bf9e41e6001bd78cca4c04364815765",
  authorizationBatchId: "BATCH-20260714-001",
  reason: "AUTOMATION_SMOKE_TEST_ACCIDENTAL_FINALIZATION",
  state: "EXCLUDED_FROM_ANALYTICS",
  protectedArtifactCount: 7
});
export const routeIqRetentionEmptyLegalHoldLedgerSha256 = sha256(stableJson([]));

const RETENTION_RECORD_CLASSES = new Set(["field_session_raw_evidence", "prospective_shadow_evidence"]);
const RETENTION_OPERATIONS = new Set(["administrative_disposition", "physical_deletion"]);
const RETENTION_DELETION_EVENT_TYPES = new Set([
  "DELETION_STARTED",
  "ARTIFACT_DELETED",
  "DELETION_COMPLETED"
]);
const LEGAL_HOLD_EVENT_TYPES = new Set(["LEGAL_HOLD_APPLIED", "LEGAL_HOLD_RELEASED"]);
const LEGAL_HOLD_AUTHORITIES = new Set(["prometheus_founder", "authorized_counsel"]);
const PRODUCTION_LEGAL_HOLD_ATTESTATION_AUTHORITIES = new Set(["prometheus_data_legal_hold_authority"]);
const LEGAL_HOLD_SOURCE_CLASSIFICATIONS = new Set(["authoritative_production", "source_only_fixture"]);
const OPERATION_AUTHORITIES = new Set(["prometheus_founder"]);
const RETENTION_AUDIT_OWNER = "prometheus_data";
const AUTHORIZATION_PATTERN = /^riq_retention_auth_[a-f0-9]{64}$/;
const KEY_VERSION_PATTERN = /^riq_retention_key_[a-f0-9]{64}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const CONTINUATION_CURSOR_PATTERN = /^riq_retention_cursor_[a-f0-9]{64}$/;
const VERIFIER_STATE = new WeakMap();
const LEDGER_STATE = new WeakMap();

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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
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

function assertExactRequiredKeys(value, keys, scope) {
  assertExactKeys(value, keys, scope);
  assertRequiredKeys(value, keys, scope);
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
  const keys = new Set(["workspaceId", "operatingProfileId", "recordClass", "sourceRecordSha256"]);
  assertExactRequiredKeys(subject, keys, "retention_subject");
  if (subject.workspaceId !== "fitness_connection" || subject.operatingProfileId !== "fitness") {
    fail("route_iq_retention_scope_unauthorized", "Retention governance scope is not authorized.");
  }
  if (!RETENTION_RECORD_CLASSES.has(subject.recordClass)) {
    fail("route_iq_retention_record_class_invalid", "Retention governance record class is not authorized.");
  }
  requireSha256(subject.sourceRecordSha256, "Retention source record hash");
  return deepFreeze({
    workspaceId: subject.workspaceId,
    operatingProfileId: subject.operatingProfileId,
    recordClass: subject.recordClass,
    sourceRecordSha256: subject.sourceRecordSha256
  });
}

function requireRetentionScopeIdentifier(value, label) {
  if (typeof value !== "string"
    || value.length < 1
    || value.length > 128
    || !/^[a-z0-9](?:[a-z0-9._:-]*[a-z0-9])?$/.test(value)) {
    fail("route_iq_retention_scope_identifier_invalid", `${label} is invalid.`);
  }
  return value;
}

function normalizeProductionLegalHoldScope(scope) {
  const keys = new Set([
    "workspaceId",
    "operatingProfileId",
    "representativeId",
    "recordClass",
    "sourceRecordSha256",
    "evidenceIdentitySha256"
  ]);
  assertExactRequiredKeys(scope, keys, "production_legal_hold_scope");
  const subject = normalizeSubject({
    workspaceId: scope.workspaceId,
    operatingProfileId: scope.operatingProfileId,
    recordClass: scope.recordClass,
    sourceRecordSha256: scope.sourceRecordSha256
  });
  return deepFreeze({
    ...subject,
    representativeId: requireRetentionScopeIdentifier(
      scope.representativeId,
      "Retention legal-hold representative identity"
    ),
    evidenceIdentitySha256: requireSha256(
      scope.evidenceIdentitySha256,
      "Retention legal-hold evidence identity hash"
    )
  });
}

function retentionSubjectFromProductionScope(scope) {
  return deepFreeze({
    workspaceId: scope.workspaceId,
    operatingProfileId: scope.operatingProfileId,
    recordClass: scope.recordClass,
    sourceRecordSha256: scope.sourceRecordSha256
  });
}

function sameCanonical(left, right) {
  return stableJson(left) === stableJson(right);
}

function daysInUtcMonth(year, month) {
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month + 1, 0);
  return date.getUTCDate();
}

export function addRouteIqRetentionCalendarMonths(createdAt, months = routeIqRetentionMaximumCalendarMonths) {
  const created = canonicalIso(createdAt, "Retention source creation time");
  if (!Number.isInteger(months) || months < 1) {
    fail("route_iq_retention_month_count_invalid", "Retention month count must be a positive integer.");
  }
  const source = new Date(created.milliseconds);
  const absoluteMonth = source.getUTCMonth() + months;
  const targetYear = source.getUTCFullYear() + Math.floor(absoluteMonth / 12);
  const targetMonth = absoluteMonth % 12;
  if (targetYear > 9999) {
    fail("route_iq_retention_time_out_of_range", "Retention expiry exceeds the canonical timestamp range.");
  }
  const targetDay = Math.min(source.getUTCDate(), daysInUtcMonth(targetYear, targetMonth));
  const target = new Date(0);
  target.setUTCHours(
    source.getUTCHours(),
    source.getUTCMinutes(),
    source.getUTCSeconds(),
    source.getUTCMilliseconds()
  );
  target.setUTCFullYear(targetYear, targetMonth, targetDay);
  return canonicalIso(target.toISOString(), "Retention expiry").iso;
}

export function createRouteIqRetentionHmacAuthorityVerifier(input = {}) {
  const keys = new Set(["verificationKey", "keyVersion"]);
  assertExactRequiredKeys(input, keys, "retention_authority_verifier");
  const verificationKey = typeof input.verificationKey === "string"
    ? Buffer.from(input.verificationKey, "utf8")
    : Buffer.from(input.verificationKey || []);
  if (verificationKey.byteLength < 32 || !KEY_VERSION_PATTERN.test(input.keyVersion)) {
    fail("route_iq_retention_authority_verifier_invalid", "Retention authority verifier is invalid.");
  }
  const verifier = deepFreeze({
    version: "route-iq-retention-hmac-authority-verifier-v1",
    keyVersion: input.keyVersion
  });
  VERIFIER_STATE.set(verifier, {
    verificationKey,
    keyVersion: input.keyVersion,
    authorizationUses: new Map()
  });
  return verifier;
}

function normalizeAuthorityAssertion(assertion, scope) {
  const keys = new Set([
    "version",
    "authority",
    "authorizationReference",
    "keyVersion",
    "auditEventSha256",
    "signature"
  ]);
  assertExactRequiredKeys(assertion, keys, scope);
  if (assertion.version !== routeIqRetentionAuthorityAssertionVersion
    || !AUTHORIZATION_PATTERN.test(assertion.authorizationReference)
    || !KEY_VERSION_PATTERN.test(assertion.keyVersion)) {
    fail("route_iq_retention_authority_assertion_invalid", "Retention authority assertion is invalid.");
  }
  requireSha256(assertion.auditEventSha256, "Retention authority audit event hash");
  requireSha256(assertion.signature, "Retention authority signature");
  return clone(assertion);
}

function verifyAuthorityAssertion(verifier, assertion, claims, allowedAuthorities, scope) {
  const verifierState = VERIFIER_STATE.get(verifier);
  if (!verifierState) {
    fail("route_iq_retention_authority_verifier_missing", "An authenticated Data retention authority verifier is required.");
  }
  const normalized = normalizeAuthorityAssertion(assertion, scope);
  if (!allowedAuthorities.has(normalized.authority) || normalized.keyVersion !== verifierState.keyVersion) {
    fail("route_iq_retention_authority_unauthorized", "Retention authority is not authorized for this operation.");
  }
  const signedBody = {
    version: normalized.version,
    authority: normalized.authority,
    authorizationReference: normalized.authorizationReference,
    keyVersion: normalized.keyVersion,
    auditEventSha256: normalized.auditEventSha256,
    claims
  };
  const expected = createHmac("sha256", verifierState.verificationKey)
    .update(stableJson(signedBody))
    .digest();
  const actual = Buffer.from(normalized.signature, "hex");
  if (actual.byteLength !== expected.byteLength || !timingSafeEqual(actual, expected)) {
    fail("route_iq_retention_authority_signature_invalid", "Retention authority signature verification failed.");
  }
  const useDigest = sha256(stableJson(signedBody));
  const priorUse = verifierState.authorizationUses.get(normalized.authorizationReference);
  if (priorUse && priorUse !== useDigest) {
    fail("route_iq_retention_authority_replay_invalid", "Retention authority reference was replayed for different claims.");
  }
  verifierState.authorizationUses.set(normalized.authorizationReference, useDigest);
  return deepFreeze(normalized);
}

function normalizeBoundaryRecord(boundary, authorityVerifier) {
  const keys = new Set([
    "subject",
    "customerAccountId",
    "creationTimeBasis",
    "createdAt",
    "maximumCalendarMonths",
    "policyMaximumExpiresAt",
    "customerOverrideState",
    "customerContractExpiresAt",
    "customerOverrideAuthority",
    "expiresAt"
  ]);
  assertExactRequiredKeys(boundary, keys, "retention_boundary");
  const normalized = calculateRouteIqRetentionBoundary({
    subject: boundary.subject,
    customerAccountId: boundary.customerAccountId,
    createdAt: boundary.createdAt,
    customerContractExpiresAt: boundary.customerContractExpiresAt,
    customerOverrideAuthority: boundary.customerOverrideAuthority
  }, { authorityVerifier });
  if (!sameCanonical(normalized, boundary)) {
    fail("route_iq_retention_boundary_mismatch", "Retention boundary does not match its authenticated source inputs.");
  }
  return normalized;
}

export function calculateRouteIqRetentionBoundary(input = {}, options = {}) {
  const inputKeys = new Set([
    "subject",
    "customerAccountId",
    "createdAt",
    "customerContractExpiresAt",
    "customerOverrideAuthority"
  ]);
  assertExactRequiredKeys(input, inputKeys, "retention_boundary_calculation");
  assertExactKeys(options, new Set(["authorityVerifier"]), "retention_boundary_options");
  const subject = normalizeSubject(input.subject);
  if (input.customerAccountId !== "fitness_connection") {
    fail("route_iq_retention_customer_scope_invalid", "Customer retention scope is not authorized.");
  }
  const created = canonicalIso(input.createdAt, "Retention source creation time");
  const policyMaximumExpiresAt = addRouteIqRetentionCalendarMonths(created.iso);
  const policyMaximum = canonicalIso(policyMaximumExpiresAt, "Policy maximum expiry");
  let customerContractExpiresAt = null;
  let customerOverrideState = "none";
  let customerOverrideAuthority = null;

  if (input.customerContractExpiresAt === null) {
    if (input.customerOverrideAuthority !== null) {
      fail("route_iq_retention_customer_override_authority_unexpected", "Customer override authority is not allowed without an override.");
    }
  } else {
    const customerExpiry = canonicalIso(input.customerContractExpiresAt, "Customer contract expiry");
    if (customerExpiry.milliseconds <= created.milliseconds) {
      fail("route_iq_retention_customer_override_expired", "Customer retention override must end after source creation.");
    }
    if (customerExpiry.milliseconds >= policyMaximum.milliseconds) {
      fail("route_iq_retention_customer_override_not_shorter", "Customer retention override may only shorten the Founder maximum.");
    }
    const claims = {
      purpose: "customer_retention_override",
      authorityVersion: routeIqCustomerRetentionOverrideAuthorityVersion,
      subject,
      customerAccountId: input.customerAccountId,
      sourceCreatedAt: created.iso,
      customerContractExpiresAt: customerExpiry.iso,
      policyMaximumExpiresAt
    };
    customerOverrideAuthority = verifyAuthorityAssertion(
      options.authorityVerifier,
      input.customerOverrideAuthority,
      claims,
      new Set(["prometheus_data_customer_contract_authority"]),
      "customer_retention_override.authority"
    );
    customerContractExpiresAt = customerExpiry.iso;
    customerOverrideState = "authenticated_shortening";
  }

  return deepFreeze({
    subject,
    customerAccountId: input.customerAccountId,
    creationTimeBasis: "canonical_authoritative_source_record_time",
    createdAt: created.iso,
    maximumCalendarMonths: routeIqRetentionMaximumCalendarMonths,
    policyMaximumExpiresAt,
    customerOverrideState,
    customerContractExpiresAt,
    customerOverrideAuthority,
    expiresAt: customerContractExpiresAt || policyMaximumExpiresAt
  });
}

function validateAggregateArtifact(artifact) {
  const topKeys = new Set(["schemaVersion", "aggregationLevel", "dimensions", "metrics"]);
  assertExactRequiredKeys(artifact, topKeys, "deidentified_aggregate_artifact");
  assertExactRequiredKeys(artifact.dimensions, new Set(["month"]), "deidentified_aggregate_artifact.dimensions");
  const metricKeys = new Set(["recordCount", "visitCount", "conversationCount", "leadCount", "unitCount"]);
  assertExactRequiredKeys(artifact.metrics, metricKeys, "deidentified_aggregate_artifact.metrics");
  if (artifact.schemaVersion !== routeIqDeidentifiedAggregateVersion
    || artifact.aggregationLevel !== "multi_record_summary"
    || typeof artifact.dimensions.month !== "string"
    || !/^\d{4}-(0[1-9]|1[0-2])$/.test(artifact.dimensions.month)
    || [...metricKeys].some(key => !Number.isSafeInteger(artifact.metrics[key]) || artifact.metrics[key] < 0)
    || artifact.metrics.recordCount < 2) {
    fail("route_iq_retention_aggregate_artifact_invalid", "De-identified aggregate artifact is invalid.");
  }
  return artifact;
}

function aggregateSourceSetSha256(subjects) {
  return sha256(stableJson(subjects
    .map(subject => ({ subject, subjectSha256: sha256(stableJson(subject)) }))
    .sort((left, right) => left.subjectSha256.localeCompare(right.subjectSha256))));
}

function aggregateLegalHoldLedgerSetSha256(snapshots) {
  return sha256(stableJson(snapshots
    .map(({ subject, snapshot }) => ({
      subjectSha256: sha256(stableJson(subject)),
      legalHoldLedgerSha256: snapshot.ledgerSha256
    }))
    .sort((left, right) => left.subjectSha256.localeCompare(right.subjectSha256))));
}

export async function evaluateRouteIqDeidentifiedAggregateRetention(input = {}, options = {}) {
  const inputKeys = new Set(["artifactBytes", "artifactSha256", "attestation", "sourceGovernance"]);
  assertExactRequiredKeys(input, inputKeys, "deidentified_aggregate");
  assertExactRequiredKeys(options, new Set(["authorityVerifier"]), "deidentified_aggregate_options");
  if (typeof input.artifactBytes !== "string") {
    fail("route_iq_retention_aggregate_bytes_invalid", "Aggregate artifact bytes are invalid.");
  }
  requireSha256(input.artifactSha256, "Aggregate artifact hash");
  if (sha256(input.artifactBytes) !== input.artifactSha256) {
    fail("route_iq_retention_aggregate_hash_mismatch", "Aggregate artifact bytes do not match their hash.");
  }
  let artifact;
  try {
    artifact = JSON.parse(input.artifactBytes);
  } catch {
    fail("route_iq_retention_aggregate_json_invalid", "Aggregate artifact is not canonical JSON.");
  }
  if (stableJson(artifact) !== input.artifactBytes) {
    fail("route_iq_retention_aggregate_json_noncanonical", "Aggregate artifact bytes are not canonical.");
  }
  validateAggregateArtifact(artifact);

  if (!Array.isArray(input.sourceGovernance)
    || input.sourceGovernance.length < 2
    || input.sourceGovernance.length !== artifact.metrics.recordCount) {
    fail("route_iq_retention_aggregate_source_set_invalid", "Aggregate source governance is invalid.");
  }
  const governedSources = input.sourceGovernance.map((source, index) => {
    assertExactRequiredKeys(
      source,
      new Set(["subject", "retentionGovernanceLedger"]),
      `deidentified_aggregate.source_governance.${index}`
    );
    return {
      subject: normalizeSubject(source.subject),
      retentionGovernanceLedger: source.retentionGovernanceLedger
    };
  });
  const subjects = governedSources.map(source => source.subject);
  const uniqueSubjectCount = new Set(subjects.map(subject => stableJson(subject))).size;
  if (uniqueSubjectCount !== subjects.length) {
    fail("route_iq_retention_aggregate_source_set_invalid", "Aggregate source governance contains duplicate subjects.");
  }

  const attestationKeys = new Set([
    "version",
    "artifactSha256",
    "attestedAt",
    "sourceSetSha256",
    "legalHoldLedgerSetSha256",
    "claims",
    "authority"
  ]);
  assertExactRequiredKeys(input.attestation, attestationKeys, "deidentified_aggregate.attestation");
  const claimKeys = new Set([
    "aggregateOnly",
    "deidentified",
    "containsRepresentativeIdentity",
    "containsCustomerIdentity",
    "containsSpecificVisitIdentity",
    "containsPreciseLocationTrail",
    "containsReidentificationLinkage",
    "containsHiddenRawRows"
  ]);
  assertExactRequiredKeys(input.attestation.claims, claimKeys, "deidentified_aggregate.attestation.claims");
  if (input.attestation.version !== routeIqDeidentifiedAggregateAttestationVersion
    || input.attestation.artifactSha256 !== input.artifactSha256) {
    fail("route_iq_retention_aggregate_attestation_mismatch", "Aggregate attestation does not bind the exact artifact.");
  }
  const attestedAt = canonicalIso(input.attestation.attestedAt, "Aggregate attestation time");
  const sourceSnapshots = [];
  for (const source of governedSources) {
    let snapshot;
    try {
      snapshot = await readAuthoritativeRouteIqRetentionLegalHoldSnapshot(
        source.retentionGovernanceLedger,
        source.subject,
        attestedAt.iso
      );
    } catch {
      fail(
        "route_iq_retention_aggregate_legal_hold_unknown",
        "Aggregate eligibility requires authoritative legal-hold state for every source."
      );
    }
    sourceSnapshots.push({ subject: source.subject, snapshot });
  }
  const sourceSetSha256 = aggregateSourceSetSha256(subjects);
  const legalHoldLedgerSetSha256 = aggregateLegalHoldLedgerSetSha256(sourceSnapshots);
  if (input.attestation.sourceSetSha256 !== sourceSetSha256
    || input.attestation.legalHoldLedgerSetSha256 !== legalHoldLedgerSetSha256) {
    fail("route_iq_retention_aggregate_attestation_mismatch", "Aggregate attestation does not bind the governed source set.");
  }
  const authorityClaims = {
    purpose: "deidentified_aggregate_attestation",
    attestationVersion: input.attestation.version,
    artifactSha256: input.artifactSha256,
    attestedAt: attestedAt.iso,
    sourceSetSha256,
    legalHoldLedgerSetSha256,
    claimsSha256: sha256(stableJson(input.attestation.claims))
  };
  const authority = verifyAuthorityAssertion(
    options.authorityVerifier,
    input.attestation.authority,
    authorityClaims,
    new Set(["prometheus_data"]),
    "deidentified_aggregate.attestation.authority"
  );
  const reasons = [];
  if (input.attestation.claims.aggregateOnly !== true) reasons.push("aggregate_only_required");
  if (input.attestation.claims.deidentified !== true) reasons.push("deidentification_not_verified");
  if (input.attestation.claims.containsRepresentativeIdentity !== false) reasons.push("representative_identity_present_or_unknown");
  if (input.attestation.claims.containsCustomerIdentity !== false) reasons.push("customer_identity_present_or_unknown");
  if (input.attestation.claims.containsSpecificVisitIdentity !== false) reasons.push("specific_visit_identity_present_or_unknown");
  if (input.attestation.claims.containsPreciseLocationTrail !== false) reasons.push("precise_location_trail_present_or_unknown");
  if (input.attestation.claims.containsReidentificationLinkage !== false) reasons.push("reidentification_linkage_present_or_unknown");
  if (input.attestation.claims.containsHiddenRawRows !== false) reasons.push("hidden_raw_rows_present_or_unknown");
  if (sourceSnapshots.some(({ snapshot }) => snapshot.state !== "none")) reasons.push("legal_hold_active");
  return deepFreeze({
    artifactSha256: input.artifactSha256,
    attestationSha256: sha256(stableJson(input.attestation)),
    authorityAuditEventSha256: authority.auditEventSha256,
    sourceSetSha256,
    legalHoldLedgerSetSha256,
    indefiniteRetentionEligible: reasons.length === 0,
    state: reasons.length === 0
      ? "DEIDENTIFIED_AGGREGATE_RETENTION_ELIGIBLE"
      : "DEIDENTIFIED_AGGREGATE_RETENTION_BLOCKED",
    reasons,
    rawEvidenceRetentionBoundaryApplies: reasons.length !== 0,
    productionMutationAuthorized: false
  });
}

function legalHoldStateFromRecords(records, asOfMilliseconds) {
  let state = "none";
  for (const record of records) {
    if (Date.parse(record.recordedAt) > asOfMilliseconds) break;
    if (record.recordKind === "route_iq_retention_legal_hold_event") state = record.stateAfter;
  }
  return state;
}

function snapshotFromRecords(records, asOf) {
  const canonicalAsOf = canonicalIso(asOf, "Retention ledger snapshot time");
  const included = records.filter(record => Date.parse(record.recordedAt) <= canonicalAsOf.milliseconds);
  return deepFreeze({
    state: legalHoldStateFromRecords(included, canonicalAsOf.milliseconds),
    asOf: canonicalAsOf.iso,
    recordCount: included.length,
    lastRecordSha256: included.at(-1)?.recordSha256 || null,
    ledgerSha256: sha256(stableJson(included.map(record => record.recordSha256))),
    authoritative: true,
    subjectBound: true
  });
}

function operationInputClaims(input, boundary, subject) {
  const claims = {
    purpose: "retention_operation",
    authorizationVersion: input.operation === "physical_deletion"
      ? routeIqRetentionDeletionAuthorizationVersion
      : routeIqRetentionOperationAuthorizationVersion,
    operation: input.operation,
    requestedAt: input.requestedAt,
    subject,
    administrativeDispositionTarget: input.administrativeDispositionTarget,
    retentionBoundarySha256: sha256(stableJson(boundary))
  };
  if (input.operation === "physical_deletion") {
    claims.deletionPlanSha256 = input.deletionPlanSha256;
  }
  return claims;
}

function normalizeAdministrativeDispositionTarget(value, operation, subject) {
  if (operation === "physical_deletion") {
    if (value !== null) {
      fail("route_iq_retention_disposition_target_invalid", "Physical deletion cannot inherit disposition authorization.");
    }
    return null;
  }
  const targetKeys = new Set(Object.keys(routeIqRetentionAdministrativeDispositionTarget));
  assertExactRequiredKeys(value, targetKeys, "retention_operation.administrative_disposition_target");
  if (!sameCanonical(value, routeIqRetentionAdministrativeDispositionTarget)
    || subject.workspaceId !== routeIqRetentionAdministrativeDispositionTarget.workspaceId
    || subject.operatingProfileId !== routeIqRetentionAdministrativeDispositionTarget.operatingProfileId
    || subject.recordClass !== "field_session_raw_evidence"
    || subject.sourceRecordSha256 !== routeIqRetentionAdministrativeDispositionTarget.sourceRawSha256) {
    fail(
      "route_iq_retention_disposition_target_unauthorized",
      "Administrative disposition authorization is limited to the exact accidental archive."
    );
  }
  return routeIqRetentionAdministrativeDispositionTarget;
}

function evaluateOperationAgainstRecords(input, { subject: expectedSubject, records, authorityVerifier, ledgerKnown }) {
  const keys = new Set([
    "operation",
    "requestedAt",
    "subject",
    "retentionBoundary",
    "administrativeDispositionTarget",
    "authorization"
  ]);
  if (input?.operation === "physical_deletion") keys.add("deletionPlanSha256");
  assertExactRequiredKeys(input, keys, "retention_operation");
  if (!RETENTION_OPERATIONS.has(input.operation)) {
    fail("route_iq_retention_operation_invalid", "Retention operation is not governed.");
  }
  const subject = normalizeSubject(input.subject);
  if (expectedSubject && !sameCanonical(subject, expectedSubject)) {
    fail("route_iq_retention_ledger_subject_mismatch", "Retention operation does not match the authoritative ledger subject.");
  }
  const requestedAt = canonicalIso(input.requestedAt, "Retention operation time");
  if (input.operation === "physical_deletion") {
    requireSha256(input.deletionPlanSha256, "Retention deletion plan hash");
  }
  const boundary = normalizeBoundaryRecord(input.retentionBoundary, authorityVerifier);
  if (!sameCanonical(boundary.subject, subject)) {
    fail("route_iq_retention_boundary_subject_mismatch", "Retention boundary does not match the operation subject.");
  }
  const administrativeDispositionTarget = normalizeAdministrativeDispositionTarget(
    input.administrativeDispositionTarget,
    input.operation,
    subject
  );
  const authority = verifyAuthorityAssertion(
    authorityVerifier,
    input.authorization,
    operationInputClaims(input, boundary, subject),
    OPERATION_AUTHORITIES,
    "retention_operation.authorization"
  );
  const reasons = [];
  let legalHoldSnapshot = deepFreeze({
    state: "unknown",
    asOf: requestedAt.iso,
    recordCount: 0,
    lastRecordSha256: null,
    ledgerSha256: null,
    authoritative: false,
    subjectBound: false
  });
  if (!ledgerKnown) {
    reasons.push("legal_hold_state_unknown");
  } else {
    legalHoldSnapshot = snapshotFromRecords(records, requestedAt.iso);
    if (legalHoldSnapshot.state === "active") reasons.push("legal_hold_active");
  }
  if (requestedAt.milliseconds < Date.parse(boundary.createdAt)) {
    reasons.push("operation_precedes_source_creation");
  }
  if (input.operation === "physical_deletion") {
    if (requestedAt.milliseconds < Date.parse(boundary.expiresAt)) reasons.push("retention_not_expired");
  }
  const uniqueReasons = [...new Set(reasons)];
  return deepFreeze({
    operation: input.operation,
    allowed: uniqueReasons.length === 0,
    state: uniqueReasons.length === 0 ? "RETENTION_OPERATION_AUTHORIZED" : "RETENTION_OPERATION_BLOCKED",
    reasons: uniqueReasons,
    requestedAt: requestedAt.iso,
    subject,
    retentionBoundary: boundary,
    administrativeDispositionTarget,
    legalHoldSnapshot,
    authority,
    requiresAppendOnlyAuditRecord: true,
    historicalArchiveRewriteAllowed: false,
    physicalMutationPerformed: false,
    productionMutationAuthorized: false
  });
}

function requireLedger(ledger, subject = null) {
  const state = LEDGER_STATE.get(ledger);
  if (!state) {
    fail("route_iq_retention_authoritative_ledger_missing", "An authoritative Data retention ledger is required.");
  }
  if (subject && !sameCanonical(state.subject, normalizeSubject(subject))) {
    fail("route_iq_retention_ledger_subject_mismatch", "Retention ledger is bound to a different subject.");
  }
  return state;
}

export function validateRouteIqRetentionBoundaryForLedger(boundary, ledger, subject) {
  const state = requireLedger(ledger, subject);
  const normalized = normalizeBoundaryRecord(boundary, state.authorityVerifier);
  if (!sameCanonical(normalized.subject, state.subject)) {
    fail("route_iq_retention_boundary_subject_mismatch", "Retention boundary does not match the authoritative ledger subject.");
  }
  return deepFreeze(clone(normalized));
}

export function readRouteIqRetentionLegalHoldSnapshot(ledger, subject, asOf) {
  const state = requireLedger(ledger, subject);
  return snapshotFromRecords(state.records, asOf);
}

export async function readAuthoritativeRouteIqRetentionLegalHoldSnapshot(ledger, subject, asOf) {
  const state = requireLedger(ledger, subject);
  await refreshAuthoritativeState(state);
  return snapshotFromRecords(state.records, asOf);
}

export function readRouteIqRetentionLedgerRecords(ledger) {
  return deepFreeze(clone(requireLedger(ledger).records));
}

function legalHoldEnvironmentForClassification(sourceClassification) {
  if (sourceClassification === "authoritative_production") return "production";
  if (sourceClassification === "source_only_fixture") return "source_fixture";
  fail("route_iq_retention_production_legal_hold_source_invalid", "Legal-hold authority source is invalid.");
}

function normalizeLegalHoldAuthoritySource(source, expectedClassification) {
  if (!source) {
    fail(
      "route_iq_retention_production_legal_hold_unavailable",
      "Authoritative production legal-hold authority is unavailable."
    );
  }
  const keys = new Set([
    "version",
    "sourceClassification",
    "environment",
    "bindingIdentitySha256",
    "readAuthorityAssertions"
  ]);
  assertExactRequiredKeys(source, keys, "production_legal_hold_authority_source");
  if (source.version !== routeIqRetentionProductionLegalHoldAuthorityVersion
    || !LEGAL_HOLD_SOURCE_CLASSIFICATIONS.has(source.sourceClassification)
    || source.environment !== legalHoldEnvironmentForClassification(source.sourceClassification)
    || typeof source.readAuthorityAssertions !== "function") {
    fail("route_iq_retention_production_legal_hold_source_invalid", "Legal-hold authority source is invalid.");
  }
  requireSha256(source.bindingIdentitySha256, "Legal-hold authority binding identity hash");
  if (source.sourceClassification !== expectedClassification) {
    fail(
      expectedClassification === "authoritative_production"
        ? "route_iq_retention_production_legal_hold_source_not_production"
        : "route_iq_retention_fixture_legal_hold_source_invalid",
      "Legal-hold authority source classification does not match the requested execution boundary."
    );
  }
  return source;
}

export function createRouteIqRetentionProductionLegalHoldAuthorityClaims(input = {}) {
  const keys = new Set([
    "sourceClassification",
    "environment",
    "bindingIdentitySha256",
    "evaluatedAt",
    "observedAt",
    "validUntil",
    "scope",
    "subjectSha256",
    "legalHoldState",
    "ledgerRecordCount",
    "ledgerLastRecordSha256",
    "ledgerSha256"
  ]);
  assertExactRequiredKeys(input, keys, "production_legal_hold_authority_claims");
  if (!LEGAL_HOLD_SOURCE_CLASSIFICATIONS.has(input.sourceClassification)
    || input.environment !== legalHoldEnvironmentForClassification(input.sourceClassification)) {
    fail("route_iq_retention_production_legal_hold_source_invalid", "Legal-hold authority source is invalid.");
  }
  const scope = normalizeProductionLegalHoldScope(input.scope);
  const subject = retentionSubjectFromProductionScope(scope);
  const evaluatedAt = canonicalIso(input.evaluatedAt, "Legal-hold evaluation time");
  const observedAt = canonicalIso(input.observedAt, "Legal-hold observation time");
  const validUntil = canonicalIso(input.validUntil, "Legal-hold authority validity time");
  requireSha256(input.bindingIdentitySha256, "Legal-hold authority binding identity hash");
  requireSha256(input.subjectSha256, "Legal-hold subject identity hash");
  requireSha256(input.ledgerSha256, "Legal-hold ledger hash");
  if (input.ledgerLastRecordSha256 !== null) {
    requireSha256(input.ledgerLastRecordSha256, "Legal-hold ledger head hash");
  }
  if (!Number.isSafeInteger(input.ledgerRecordCount)
    || input.ledgerRecordCount < 0
    || !new Set(["none", "active"]).has(input.legalHoldState)
    || input.subjectSha256 !== sha256(stableJson(subject))
    || validUntil.milliseconds <= observedAt.milliseconds
    || validUntil.milliseconds - observedAt.milliseconds
      > routeIqRetentionProductionLegalHoldMaximumAgeMilliseconds) {
    fail(
      "route_iq_retention_production_legal_hold_attestation_invalid",
      "Production legal-hold attestation is invalid."
    );
  }
  return deepFreeze({
    purpose: "production_legal_hold_snapshot",
    authorityVersion: routeIqRetentionProductionLegalHoldAuthorityVersion,
    sourceClassification: input.sourceClassification,
    environment: input.environment,
    bindingIdentitySha256: input.bindingIdentitySha256,
    evaluatedAt: evaluatedAt.iso,
    observedAt: observedAt.iso,
    validUntil: validUntil.iso,
    scope,
    subjectSha256: input.subjectSha256,
    legalHoldState: input.legalHoldState,
    ledgerRecordCount: input.ledgerRecordCount,
    ledgerLastRecordSha256: input.ledgerLastRecordSha256,
    ledgerSha256: input.ledgerSha256
  });
}

function legalHoldSnapshotIdentity(input) {
  return sha256(stableJson({
    authorityVersion: routeIqRetentionProductionLegalHoldAuthorityVersion,
    sourceClassification: input.sourceClassification,
    environment: input.environment,
    bindingIdentitySha256: input.bindingIdentitySha256,
    scope: input.scope,
    subjectSha256: input.subjectSha256,
    legalHoldState: input.legalHoldState,
    ledgerRecordCount: input.ledgerRecordCount,
    ledgerLastRecordSha256: input.ledgerLastRecordSha256,
    ledgerSha256: input.ledgerSha256
  }));
}

function validateLegalHoldAuthorityAssertion(assertion, expected, source, authorityVerifier) {
  const keys = new Set([
    "version",
    "sourceClassification",
    "environment",
    "bindingIdentitySha256",
    "evaluatedAt",
    "observedAt",
    "validUntil",
    "scope",
    "subjectSha256",
    "legalHoldState",
    "ledgerRecordCount",
    "ledgerLastRecordSha256",
    "ledgerSha256",
    "authority"
  ]);
  assertExactRequiredKeys(assertion, keys, "production_legal_hold_authority_assertion");
  if (assertion.version !== routeIqRetentionProductionLegalHoldAuthorityVersion) {
    fail(
      "route_iq_retention_production_legal_hold_attestation_invalid",
      "Production legal-hold attestation is invalid."
    );
  }
  const claims = createRouteIqRetentionProductionLegalHoldAuthorityClaims({
    sourceClassification: assertion.sourceClassification,
    environment: assertion.environment,
    bindingIdentitySha256: assertion.bindingIdentitySha256,
    evaluatedAt: assertion.evaluatedAt,
    observedAt: assertion.observedAt,
    validUntil: assertion.validUntil,
    scope: assertion.scope,
    subjectSha256: assertion.subjectSha256,
    legalHoldState: assertion.legalHoldState,
    ledgerRecordCount: assertion.ledgerRecordCount,
    ledgerLastRecordSha256: assertion.ledgerLastRecordSha256,
    ledgerSha256: assertion.ledgerSha256
  });
  if (assertion.sourceClassification !== source.sourceClassification
    || assertion.environment !== source.environment
    || assertion.bindingIdentitySha256 !== source.bindingIdentitySha256
    || !sameCanonical(assertion.scope, expected.scope)
    || assertion.subjectSha256 !== expected.subjectSha256
    || assertion.evaluatedAt !== expected.evaluatedAt
    || assertion.legalHoldState !== expected.legalHoldState
    || assertion.ledgerRecordCount !== expected.ledgerRecordCount
    || assertion.ledgerLastRecordSha256 !== expected.ledgerLastRecordSha256
    || assertion.ledgerSha256 !== expected.ledgerSha256) {
    fail(
      "route_iq_retention_production_legal_hold_scope_mismatch",
      "Production legal-hold authority does not match the exact governed scope and ledger."
    );
  }
  const evaluatedAt = Date.parse(assertion.evaluatedAt);
  const observedAt = Date.parse(assertion.observedAt);
  const validUntil = Date.parse(assertion.validUntil);
  if (observedAt > evaluatedAt) {
    fail("route_iq_retention_production_legal_hold_future", "Future legal-hold authority is invalid.");
  }
  if (evaluatedAt - observedAt > routeIqRetentionProductionLegalHoldMaximumAgeMilliseconds
    || validUntil < evaluatedAt) {
    fail("route_iq_retention_production_legal_hold_stale", "Stale legal-hold authority is invalid.");
  }
  const authority = verifyAuthorityAssertion(
    authorityVerifier,
    assertion.authority,
    claims,
    PRODUCTION_LEGAL_HOLD_ATTESTATION_AUTHORITIES,
    "production_legal_hold_authority_assertion.authority"
  );
  return { claims, authority };
}

async function readLegalHoldReadiness(input, options, expectedClassification) {
  assertExactRequiredKeys(input, new Set(["scope", "evaluatedAt"]), "production_legal_hold_readiness");
  assertExactKeys(
    options,
    new Set(["retentionGovernanceLedger", "legalHoldAuthoritySource"]),
    "production_legal_hold_readiness_options"
  );
  if (!options.retentionGovernanceLedger) {
    fail("route_iq_retention_authoritative_ledger_missing", "An authoritative Data retention ledger is required.");
  }
  const scope = normalizeProductionLegalHoldScope(input.scope);
  const subject = retentionSubjectFromProductionScope(scope);
  const evaluatedAt = canonicalIso(input.evaluatedAt, "Legal-hold evaluation time");
  const state = requireLedger(options.retentionGovernanceLedger, subject);
  const source = normalizeLegalHoldAuthoritySource(options.legalHoldAuthoritySource, expectedClassification);
  await refreshAuthoritativeState(state);
  if (state.records.some(record => Date.parse(record.recordedAt) > evaluatedAt.milliseconds)) {
    fail("route_iq_retention_production_legal_hold_future", "Future legal-hold ledger state is invalid.");
  }
  const snapshot = snapshotFromRecords(state.records, evaluatedAt.iso);
  const expected = deepFreeze({
    sourceClassification: source.sourceClassification,
    environment: source.environment,
    bindingIdentitySha256: source.bindingIdentitySha256,
    evaluatedAt: evaluatedAt.iso,
    scope,
    subjectSha256: sha256(stableJson(subject)),
    legalHoldState: snapshot.state,
    ledgerRecordCount: snapshot.recordCount,
    ledgerLastRecordSha256: snapshot.lastRecordSha256,
    ledgerSha256: snapshot.ledgerSha256
  });
  let result;
  try {
    result = await source.readAuthorityAssertions(deepFreeze(clone(expected)));
  } catch {
    fail(
      "route_iq_retention_production_legal_hold_unavailable",
      "Authoritative production legal-hold authority is unavailable."
    );
  }
  assertExactRequiredKeys(result, new Set(["assertions"]), "production_legal_hold_authority_result");
  if (!Array.isArray(result.assertions)) {
    fail(
      "route_iq_retention_production_legal_hold_attestation_invalid",
      "Production legal-hold authority result is invalid."
    );
  }
  if (result.assertions.length === 0) {
    fail("route_iq_retention_production_legal_hold_missing", "Production legal-hold state is missing.");
  }
  if (result.assertions.length !== 1) {
    fail("route_iq_retention_production_legal_hold_ambiguous", "Production legal-hold state is ambiguous.");
  }
  const assertion = result.assertions[0];
  const { authority } = validateLegalHoldAuthorityAssertion(
    assertion,
    expected,
    source,
    state.authorityVerifier
  );
  const legalHoldSnapshotIdentitySha256 = legalHoldSnapshotIdentity(expected);
  const production = expectedClassification === "authoritative_production";
  return deepFreeze({
    schemaVersion: routeIqRetentionProductionLegalHoldReadinessVersion,
    sourceClassification: source.sourceClassification,
    environment: source.environment,
    bindingIdentitySha256: source.bindingIdentitySha256,
    scope,
    subjectSha256: expected.subjectSha256,
    evaluatedAt: evaluatedAt.iso,
    observedAt: assertion.observedAt,
    validUntil: assertion.validUntil,
    legalHoldState: snapshot.state,
    recordCount: snapshot.recordCount,
    lastRecordSha256: snapshot.lastRecordSha256,
    ledgerSha256: snapshot.ledgerSha256,
    legalHoldSnapshotIdentitySha256,
    attestationSha256: sha256(stableJson(assertion)),
    authorityAuditEventSha256: authority.auditEventSha256,
    authority: deepFreeze(clone(assertion.authority)),
    authoritative: true,
    productionReady: production && snapshot.state === "none",
    sourceOnly: !production,
    deletionEligibleByLegalHold: snapshot.state === "none",
    revalidationRequiredImmediatelyBeforeMutation: true,
    physicalMutationAuthorized: false,
    overrideAllowed: false
  });
}

export async function readRouteIqRetentionProductionLegalHoldReadiness(input = {}, options = {}) {
  return readLegalHoldReadiness(input, options, "authoritative_production");
}

export async function readRouteIqRetentionSourceFixtureLegalHoldReadiness(input = {}, options = {}) {
  return readLegalHoldReadiness(input, options, "source_only_fixture");
}

function validateProductionLegalHoldReadiness(readiness, authorityVerifier) {
  const keys = new Set([
    "schemaVersion",
    "sourceClassification",
    "environment",
    "bindingIdentitySha256",
    "scope",
    "subjectSha256",
    "evaluatedAt",
    "observedAt",
    "validUntil",
    "legalHoldState",
    "recordCount",
    "lastRecordSha256",
    "ledgerSha256",
    "legalHoldSnapshotIdentitySha256",
    "attestationSha256",
    "authorityAuditEventSha256",
    "authority",
    "authoritative",
    "productionReady",
    "sourceOnly",
    "deletionEligibleByLegalHold",
    "revalidationRequiredImmediatelyBeforeMutation",
    "physicalMutationAuthorized",
    "overrideAllowed"
  ]);
  assertExactRequiredKeys(readiness, keys, "production_legal_hold_readiness_record");
  const scope = normalizeProductionLegalHoldScope(readiness.scope);
  const subject = retentionSubjectFromProductionScope(scope);
  canonicalIso(readiness.evaluatedAt, "Legal-hold readiness evaluation time");
  canonicalIso(readiness.observedAt, "Legal-hold readiness observation time");
  canonicalIso(readiness.validUntil, "Legal-hold readiness validity time");
  for (const [value, label] of [
    [readiness.bindingIdentitySha256, "Legal-hold authority binding identity hash"],
    [readiness.subjectSha256, "Legal-hold subject identity hash"],
    [readiness.ledgerSha256, "Legal-hold ledger hash"],
    [readiness.legalHoldSnapshotIdentitySha256, "Legal-hold snapshot identity hash"],
    [readiness.attestationSha256, "Legal-hold attestation hash"],
    [readiness.authorityAuditEventSha256, "Legal-hold authority audit event hash"]
  ]) requireSha256(value, label);
  if (readiness.lastRecordSha256 !== null) {
    requireSha256(readiness.lastRecordSha256, "Legal-hold ledger head hash");
  }
  const authorityClaimInput = {
    sourceClassification: readiness.sourceClassification,
    environment: readiness.environment,
    bindingIdentitySha256: readiness.bindingIdentitySha256,
    evaluatedAt: readiness.evaluatedAt,
    observedAt: readiness.observedAt,
    validUntil: readiness.validUntil,
    scope,
    subjectSha256: readiness.subjectSha256,
    legalHoldState: readiness.legalHoldState,
    ledgerRecordCount: readiness.recordCount,
    ledgerLastRecordSha256: readiness.lastRecordSha256,
    ledgerSha256: readiness.ledgerSha256
  };
  const claims = createRouteIqRetentionProductionLegalHoldAuthorityClaims(authorityClaimInput);
  const verifiedAuthority = verifyAuthorityAssertion(
    authorityVerifier,
    readiness.authority,
    claims,
    PRODUCTION_LEGAL_HOLD_ATTESTATION_AUTHORITIES,
    "production_legal_hold_readiness_record.authority"
  );
  const assertion = {
    version: routeIqRetentionProductionLegalHoldAuthorityVersion,
    ...authorityClaimInput,
    authority: readiness.authority
  };
  const expectedSnapshotIdentitySha256 = legalHoldSnapshotIdentity({
    ...authorityClaimInput,
    ledgerRecordCount: readiness.recordCount,
    ledgerLastRecordSha256: readiness.lastRecordSha256
  });
  if (readiness.schemaVersion !== routeIqRetentionProductionLegalHoldReadinessVersion
    || readiness.sourceClassification !== "authoritative_production"
    || readiness.environment !== "production"
    || readiness.subjectSha256 !== sha256(stableJson(subject))
    || readiness.attestationSha256 !== sha256(stableJson(assertion))
    || readiness.authorityAuditEventSha256 !== verifiedAuthority.auditEventSha256
    || readiness.legalHoldSnapshotIdentitySha256 !== expectedSnapshotIdentitySha256
    || readiness.legalHoldState !== "none"
    || !Number.isSafeInteger(readiness.recordCount)
    || readiness.recordCount < 0
    || readiness.authoritative !== true
    || readiness.productionReady !== true
    || readiness.sourceOnly !== false
    || readiness.deletionEligibleByLegalHold !== true
    || readiness.revalidationRequiredImmediatelyBeforeMutation !== true
    || readiness.physicalMutationAuthorized !== false
    || readiness.overrideAllowed !== false) {
    fail(
      "route_iq_retention_production_legal_hold_readiness_invalid",
      "Production legal-hold readiness record is invalid."
    );
  }
  return deepFreeze(clone(readiness));
}

export async function revalidateRouteIqRetentionProductionLegalHoldImmediatelyBeforeMutation(
  input = {},
  options = {}
) {
  assertExactRequiredKeys(
    input,
    new Set(["priorReadiness", "revalidatedAt"]),
    "production_legal_hold_immediate_revalidation"
  );
  assertExactKeys(
    options,
    new Set(["retentionGovernanceLedger", "legalHoldAuthoritySource"]),
    "production_legal_hold_readiness_options"
  );
  const priorScope = normalizeProductionLegalHoldScope(input.priorReadiness?.scope);
  const priorState = requireLedger(
    options.retentionGovernanceLedger,
    retentionSubjectFromProductionScope(priorScope)
  );
  const priorReadiness = validateProductionLegalHoldReadiness(
    input.priorReadiness,
    priorState.authorityVerifier
  );
  const revalidatedAt = canonicalIso(input.revalidatedAt, "Legal-hold immediate revalidation time");
  if (revalidatedAt.milliseconds < Date.parse(priorReadiness.evaluatedAt)) {
    fail(
      "route_iq_retention_production_legal_hold_revalidation_time_invalid",
      "Legal-hold revalidation cannot precede the prior readiness evaluation."
    );
  }
  const current = await readRouteIqRetentionProductionLegalHoldReadiness({
    scope: priorReadiness.scope,
    evaluatedAt: revalidatedAt.iso
  }, options);
  if (current.legalHoldSnapshotIdentitySha256 !== priorReadiness.legalHoldSnapshotIdentitySha256) {
    fail("route_iq_retention_legal_hold_changed", "Legal-hold state changed before mutation.");
  }
  if (current.legalHoldState !== "none") {
    fail("route_iq_retention_legal_hold_active", "An active legal hold blocks physical mutation.");
  }
  return deepFreeze({
    schemaVersion: routeIqRetentionProductionLegalHoldRevalidationVersion,
    state: "PRODUCTION_LEGAL_HOLD_REVALIDATED_NONE",
    revalidatedAt: revalidatedAt.iso,
    scope: current.scope,
    priorLegalHoldSnapshotIdentitySha256: priorReadiness.legalHoldSnapshotIdentitySha256,
    currentLegalHoldSnapshotIdentitySha256: current.legalHoldSnapshotIdentitySha256,
    currentAttestationSha256: current.attestationSha256,
    validUntil: current.validUntil,
    authoritative: true,
    revalidatedImmediatelyBeforeMutation: true,
    exactPlanBoundFounderDeletionAuthorityRequired: true,
    physicalMutationAuthorized: false,
    overrideAllowed: false
  });
}

export function evaluateRouteIqRetentionOperation(input = {}, options = {}) {
  assertExactKeys(options, new Set(["retentionGovernanceLedger"]), "retention_operation_options");
  if (!options.retentionGovernanceLedger) {
    const keys = new Set([
      "operation",
      "requestedAt",
      "subject",
      "retentionBoundary",
      "administrativeDispositionTarget",
      "authorization"
    ]);
    if (input?.operation === "physical_deletion") keys.add("deletionPlanSha256");
    assertExactRequiredKeys(input, keys, "retention_operation");
    if (!RETENTION_OPERATIONS.has(input.operation)) {
      fail("route_iq_retention_operation_invalid", "Retention operation is not governed.");
    }
    const subject = normalizeSubject(input.subject);
    const requestedAt = canonicalIso(input.requestedAt, "Retention operation time");
    if (input.operation === "physical_deletion") {
      requireSha256(input.deletionPlanSha256, "Retention deletion plan hash");
    }
    const boundary = normalizeBoundaryRecord(input.retentionBoundary, null);
    const authority = normalizeAuthorityAssertion(input.authorization, "retention_operation.authorization");
    if (boundary.customerOverrideState !== "none") {
      fail("route_iq_retention_authority_verifier_missing", "Customer override verification requires the authoritative ledger verifier.");
    }
    if (!sameCanonical(boundary.subject, subject)) {
      fail("route_iq_retention_boundary_subject_mismatch", "Retention boundary does not match the operation subject.");
    }
    const administrativeDispositionTarget = normalizeAdministrativeDispositionTarget(
      input.administrativeDispositionTarget,
      input.operation,
      subject
    );
    if (!OPERATION_AUTHORITIES.has(authority.authority)) {
      fail("route_iq_retention_authority_unauthorized", "Retention authority is not authorized for this operation.");
    }
    const reasons = ["legal_hold_state_unknown", "operation_authority_unverified"];
    if (requestedAt.milliseconds < Date.parse(boundary.createdAt)) {
      reasons.push("operation_precedes_source_creation");
    }
    if (input.operation === "physical_deletion") {
      if (requestedAt.milliseconds < Date.parse(boundary.expiresAt)) reasons.push("retention_not_expired");
    }
    return deepFreeze({
      operation: input.operation,
      allowed: false,
      state: "RETENTION_OPERATION_BLOCKED",
      reasons,
      requestedAt: requestedAt.iso,
      subject,
      retentionBoundary: boundary,
      administrativeDispositionTarget,
      legalHoldSnapshot: {
        state: "unknown",
        asOf: input.requestedAt,
        recordCount: 0,
        lastRecordSha256: null,
        ledgerSha256: null,
        authoritative: false,
        subjectBound: false
      },
      authority: null,
      requiresAppendOnlyAuditRecord: true,
      historicalArchiveRewriteAllowed: false,
      physicalMutationPerformed: false,
      productionMutationAuthorized: false
    });
  }
  const ledgerState = requireLedger(options.retentionGovernanceLedger, input.subject);
  return evaluateOperationAgainstRecords(input, {
    subject: ledgerState.subject,
    records: ledgerState.records,
    authorityVerifier: ledgerState.authorityVerifier,
    ledgerKnown: true
  });
}

function identityBody(record, identityKey) {
  const { [identityKey]: ignoredIdentity, recordSha256: ignoredHash, ...body } = record;
  return body;
}

function recordBody(record) {
  const { recordSha256: ignoredHash, ...body } = record;
  return body;
}

function priorHoldState(records) {
  return legalHoldStateFromRecords(records, Number.POSITIVE_INFINITY);
}

function assertGlobalChronology(record, previousRecord) {
  if (previousRecord && Date.parse(record.recordedAt) <= Date.parse(previousRecord.recordedAt)) {
    fail("route_iq_retention_ledger_chronology_invalid", "Retention ledger records must be strictly chronological.");
  }
}

function validateLegalHoldRecord(record, context, priorRecords) {
  const keys = new Set([
    "schemaVersion",
    "recordKind",
    "eventId",
    "eventType",
    "ledgerSequence",
    "recordedAt",
    "authority",
    "subject",
    "stateBefore",
    "stateAfter",
    "reasonCode",
    "auditOwner",
    "appendOnly",
    "historicalArchiveRewriteAllowed",
    "previousRecordSha256",
    "recordSha256"
  ]);
  assertExactRequiredKeys(record, keys, "legal_hold_record");
  const subject = normalizeSubject(record.subject);
  if (!sameCanonical(subject, context.subject)) {
    fail("route_iq_retention_ledger_subject_mismatch", "Legal-hold record has a different subject.");
  }
  const recordedAt = canonicalIso(record.recordedAt, "Legal-hold record time");
  const previous = priorRecords.at(-1) || null;
  assertGlobalChronology(record, previous);
  const stateBefore = priorHoldState(priorRecords);
  const stateAfter = record.eventType === "LEGAL_HOLD_APPLIED" ? "active" : "none";
  const reasonCode = record.eventType === "LEGAL_HOLD_APPLIED"
    ? "LEGAL_HOLD_REQUIRED"
    : "LEGAL_HOLD_RELEASED_BY_AUTHORITY";
  if (!LEGAL_HOLD_EVENT_TYPES.has(record.eventType)
    || (record.eventType === "LEGAL_HOLD_APPLIED" && stateBefore !== "none")
    || (record.eventType === "LEGAL_HOLD_RELEASED" && stateBefore !== "active")) {
    fail("route_iq_retention_legal_hold_transition_invalid", "Legal-hold transition is invalid.");
  }
  const authority = verifyAuthorityAssertion(
    context.authorityVerifier,
    record.authority,
    {
      purpose: "legal_hold_transition",
      eventType: record.eventType,
      recordedAt: recordedAt.iso,
      subject
    },
    LEGAL_HOLD_AUTHORITIES,
    "legal_hold_record.authority"
  );
  const expectedPreviousHash = previous?.recordSha256 || null;
  if (record.schemaVersion !== routeIqRetentionGovernanceEventVersion
    || record.recordKind !== "route_iq_retention_legal_hold_event"
    || record.ledgerSequence !== priorRecords.length + 1
    || record.stateBefore !== stateBefore
    || record.stateAfter !== stateAfter
    || record.reasonCode !== reasonCode
    || record.auditOwner !== RETENTION_AUDIT_OWNER
    || record.appendOnly !== true
    || record.historicalArchiveRewriteAllowed !== false
    || record.previousRecordSha256 !== expectedPreviousHash
    || !sameCanonical(record.authority, authority)) {
    fail("route_iq_retention_legal_hold_record_invalid", "Legal-hold record failed canonical validation.");
  }
  requireSha256(record.recordSha256, "Legal-hold record hash");
  const expectedEventId = `riq_retention_event_${sha256(stableJson(identityBody(record, "eventId")))}`;
  if (record.eventId !== expectedEventId || sha256(stableJson(recordBody(record))) !== record.recordSha256) {
    fail("route_iq_retention_legal_hold_integrity_invalid", "Legal-hold record integrity verification failed.");
  }
  return record;
}

function receiptDecision(decision) {
  return {
    allowed: decision.allowed,
    state: decision.state,
    reasons: [...decision.reasons]
  };
}

function validateOperationReceiptRecord(record, context, priorRecords) {
  const keys = new Set([
    "schemaVersion",
    "recordKind",
    "receiptId",
    "ledgerSequence",
    "recordedAt",
    "operationInput",
    "decision",
    "legalHoldSnapshot",
    "auditOwner",
    "payloadRetained",
    "appendOnly",
    "historicalArchiveRewriteAllowed",
    "physicalMutationPerformed",
    "productionMutationAuthorized",
    "previousRecordSha256",
    "recordSha256"
  ]);
  assertExactRequiredKeys(record, keys, "retention_operation_receipt");
  assertExactRequiredKeys(record.decision, new Set(["allowed", "state", "reasons"]), "retention_operation_receipt.decision");
  const previous = priorRecords.at(-1) || null;
  canonicalIso(record.recordedAt, "Retention operation receipt time");
  assertGlobalChronology(record, previous);
  const recomputed = evaluateOperationAgainstRecords(record.operationInput, {
    subject: context.subject,
    records: priorRecords,
    authorityVerifier: context.authorityVerifier,
    ledgerKnown: true
  });
  const expectedDecision = receiptDecision(recomputed);
  if (record.schemaVersion !== routeIqRetentionOperationReceiptVersion
    || record.recordKind !== "route_iq_retention_operation_receipt"
    || record.ledgerSequence !== priorRecords.length + 1
    || record.recordedAt !== recomputed.requestedAt
    || !sameCanonical(record.decision, expectedDecision)
    || !sameCanonical(record.legalHoldSnapshot, recomputed.legalHoldSnapshot)
    || record.auditOwner !== RETENTION_AUDIT_OWNER
    || record.payloadRetained !== false
    || record.appendOnly !== true
    || record.historicalArchiveRewriteAllowed !== false
    || record.physicalMutationPerformed !== false
    || record.productionMutationAuthorized !== false
    || record.previousRecordSha256 !== (previous?.recordSha256 || null)) {
    fail("route_iq_retention_receipt_semantics_invalid", "Retention receipt does not match recomputed operation semantics.");
  }
  requireSha256(record.recordSha256, "Retention receipt hash");
  const expectedReceiptId = `riq_retention_receipt_${sha256(stableJson(identityBody(record, "receiptId")))}`;
  if (record.receiptId !== expectedReceiptId || sha256(stableJson(recordBody(record))) !== record.recordSha256) {
    fail("route_iq_retention_receipt_integrity_invalid", "Retention receipt integrity verification failed.");
  }
  return record;
}

function normalizeDeletionArtifact(value, scope) {
  if (value === null) return null;
  const keys = new Set([
    "ordinal",
    "storageClass",
    "artifactIdentitySha256",
    "artifactSha256",
    "byteLength"
  ]);
  assertExactRequiredKeys(value, keys, scope);
  if (!Number.isSafeInteger(value.ordinal) || value.ordinal < 1
    || !new Set(["field_session_kv", "prospective_coordinator_sqlite"]).has(value.storageClass)
    || !Number.isSafeInteger(value.byteLength) || value.byteLength < 0) {
    fail("route_iq_retention_deletion_artifact_invalid", "Retention deletion artifact progress is invalid.");
  }
  requireSha256(value.artifactIdentitySha256, "Retention deletion artifact identity hash");
  requireSha256(value.artifactSha256, "Retention deletion artifact hash");
  return clone(value);
}

function validateDeletionEventRecord(record, context, priorRecords) {
  const keys = new Set([
    "schemaVersion",
    "recordKind",
    "eventId",
    "eventType",
    "ledgerSequence",
    "recordedAt",
    "subject",
    "deletionPlanSha256",
    "operationReceiptSha256",
    "legalHoldSnapshotIdentitySha256",
    "artifact",
    "totalArtifactCount",
    "completedArtifactCount",
    "continuationCursor",
    "stateAfter",
    "auditOwner",
    "payloadRetained",
    "appendOnly",
    "historicalArchiveRewriteAllowed",
    "physicalMutationPerformed",
    "productionMutationAuthorized",
    "previousRecordSha256",
    "recordSha256"
  ]);
  assertExactRequiredKeys(record, keys, "retention_deletion_event");
  const subject = normalizeSubject(record.subject);
  if (!sameCanonical(subject, context.subject)) {
    fail("route_iq_retention_ledger_subject_mismatch", "Retention deletion event has a different subject.");
  }
  if (!RETENTION_DELETION_EVENT_TYPES.has(record.eventType)) {
    fail("route_iq_retention_deletion_event_type_invalid", "Retention deletion event type is invalid.");
  }
  requireSha256(record.deletionPlanSha256, "Retention deletion plan hash");
  requireSha256(record.operationReceiptSha256, "Retention operation receipt hash");
  requireSha256(record.legalHoldSnapshotIdentitySha256, "Retention legal-hold snapshot identity hash");
  if (!Number.isSafeInteger(record.totalArtifactCount) || record.totalArtifactCount < 1
    || !Number.isSafeInteger(record.completedArtifactCount)
    || record.completedArtifactCount < 0
    || record.completedArtifactCount > record.totalArtifactCount
    || (record.continuationCursor !== null
      && (typeof record.continuationCursor !== "string"
        || !CONTINUATION_CURSOR_PATTERN.test(record.continuationCursor)))) {
    fail("route_iq_retention_deletion_progress_invalid", "Retention deletion progress is invalid.");
  }
  const artifact = normalizeDeletionArtifact(record.artifact, "retention_deletion_event.artifact");
  const previous = priorRecords.at(-1) || null;
  canonicalIso(record.recordedAt, "Retention deletion event time");
  assertGlobalChronology(record, previous);
  const operationReceipt = priorRecords.find(candidate => candidate.recordKind === "route_iq_retention_operation_receipt"
    && candidate.recordSha256 === record.operationReceiptSha256);
  if (!operationReceipt
    || operationReceipt.operationInput.operation !== "physical_deletion"
    || operationReceipt.operationInput.deletionPlanSha256 !== record.deletionPlanSha256
    || operationReceipt.decision.allowed !== true) {
    fail("route_iq_retention_deletion_authorization_receipt_invalid", "Retention deletion event is not bound to an allowed operation receipt.");
  }
  const planEvents = priorRecords.filter(candidate => candidate.recordKind === "route_iq_retention_deletion_event"
    && candidate.deletionPlanSha256 === record.deletionPlanSha256);
  const priorEvent = planEvents.at(-1) || null;
  const expectedPreviousHash = previous?.recordSha256 || null;
  let expectedState;
  let expectedPhysicalMutation;
  if (record.eventType === "DELETION_STARTED") {
    if (priorEvent || artifact !== null || record.completedArtifactCount !== 0
      || record.continuationCursor === null) {
      fail("route_iq_retention_deletion_transition_invalid", "Retention deletion start transition is invalid.");
    }
    expectedState = "DELETION_IN_PROGRESS";
    expectedPhysicalMutation = false;
  } else if (record.eventType === "ARTIFACT_DELETED") {
    const priorCompleted = priorEvent?.completedArtifactCount;
    if (!priorEvent || priorEvent.stateAfter !== "DELETION_IN_PROGRESS" || artifact === null
      || artifact.ordinal !== priorCompleted + 1
      || record.completedArtifactCount !== artifact.ordinal
      || record.totalArtifactCount !== priorEvent.totalArtifactCount
      || record.legalHoldSnapshotIdentitySha256 !== priorEvent.legalHoldSnapshotIdentitySha256
      || (record.completedArtifactCount < record.totalArtifactCount && record.continuationCursor === null)
      || (record.completedArtifactCount === record.totalArtifactCount && record.continuationCursor !== null)) {
      fail("route_iq_retention_deletion_transition_invalid", "Retention artifact deletion transition is invalid.");
    }
    expectedState = "DELETION_IN_PROGRESS";
    expectedPhysicalMutation = true;
  } else {
    if (!priorEvent || priorEvent.stateAfter !== "DELETION_IN_PROGRESS" || artifact !== null
      || priorEvent.completedArtifactCount !== priorEvent.totalArtifactCount
      || record.completedArtifactCount !== record.totalArtifactCount
      || record.totalArtifactCount !== priorEvent.totalArtifactCount
      || record.legalHoldSnapshotIdentitySha256 !== priorEvent.legalHoldSnapshotIdentitySha256
      || record.continuationCursor !== null) {
      fail("route_iq_retention_deletion_transition_invalid", "Retention deletion completion transition is invalid.");
    }
    expectedState = "DELETION_COMPLETED";
    expectedPhysicalMutation = true;
  }
  if (record.schemaVersion !== routeIqRetentionDeletionEventVersion
    || record.recordKind !== "route_iq_retention_deletion_event"
    || record.ledgerSequence !== priorRecords.length + 1
    || record.stateAfter !== expectedState
    || record.auditOwner !== RETENTION_AUDIT_OWNER
    || record.payloadRetained !== false
    || record.appendOnly !== true
    || record.historicalArchiveRewriteAllowed !== false
    || record.physicalMutationPerformed !== expectedPhysicalMutation
    || record.productionMutationAuthorized !== false
    || record.previousRecordSha256 !== expectedPreviousHash) {
    fail("route_iq_retention_deletion_event_semantics_invalid", "Retention deletion event failed canonical validation.");
  }
  requireSha256(record.recordSha256, "Retention deletion event hash");
  const expectedEventId = `riq_retention_deletion_event_${sha256(stableJson(identityBody(record, "eventId")))}`;
  if (record.eventId !== expectedEventId || sha256(stableJson(recordBody(record))) !== record.recordSha256) {
    fail("route_iq_retention_deletion_event_integrity_invalid", "Retention deletion event integrity verification failed.");
  }
  return record;
}

function recordAuthorizationReference(record) {
  if (record.recordKind === "route_iq_retention_legal_hold_event") {
    return record.authority.authorizationReference;
  }
  if (record.recordKind === "route_iq_retention_operation_receipt") {
    return record.operationInput.authorization.authorizationReference;
  }
  return null;
}

function validateLedgerRecords(records, context) {
  if (!Array.isArray(records)) {
    fail("route_iq_retention_ledger_records_invalid", "Retention ledger records are invalid.");
  }
  const priorRecords = [];
  const authorizationReferences = new Set();
  for (const record of records) {
    if (record?.recordKind === "route_iq_retention_legal_hold_event") {
      validateLegalHoldRecord(record, context, priorRecords);
    } else if (record?.recordKind === "route_iq_retention_operation_receipt") {
      validateOperationReceiptRecord(record, context, priorRecords);
    } else if (record?.recordKind === "route_iq_retention_deletion_event") {
      validateDeletionEventRecord(record, context, priorRecords);
    } else {
      fail("route_iq_retention_ledger_record_kind_invalid", "Retention ledger record kind is invalid.");
    }
    const authorizationReference = recordAuthorizationReference(record);
    if (authorizationReference && authorizationReferences.has(authorizationReference)) {
      fail("route_iq_retention_ledger_authorization_reused", "Retention ledger authority reference was reused.");
    }
    if (authorizationReference) authorizationReferences.add(authorizationReference);
    priorRecords.push(record);
  }
  return records;
}

async function readAuthoritativeStore(state) {
  const stored = await state.store.readRetentionLedger({ subjectKey: state.subjectKey });
  const resultKeys = new Set(["records", "head"]);
  assertExactRequiredKeys(stored, resultKeys, "retention_store_read");
  assertExactRequiredKeys(stored.head, new Set(["recordCount", "lastRecordSha256"]), "retention_store_head");
  const records = clone(stored.records);
  validateLedgerRecords(records, state);
  const expectedLastHash = records.at(-1)?.recordSha256 || null;
  if (stored.head.recordCount !== records.length || stored.head.lastRecordSha256 !== expectedLastHash) {
    fail("route_iq_retention_ledger_head_mismatch", "Retention ledger head does not match append-only records.");
  }
  return records;
}

async function refreshAuthoritativeState(state) {
  const priorRecords = state.records;
  const records = await readAuthoritativeStore(state);
  if (records.length < priorRecords.length) {
    fail("route_iq_retention_ledger_truncated", "Retention ledger history was truncated.");
  }
  for (let index = 0; index < priorRecords.length; index += 1) {
    if (records[index]?.recordSha256 !== priorRecords[index].recordSha256) {
      fail("route_iq_retention_ledger_rewritten", "Retention ledger history was reordered or rewritten.");
    }
  }
  state.records = records;
  return records;
}

async function persistAndVerifyRecord(ledger, record) {
  const state = requireLedger(ledger);
  const previous = state.records.at(-1) || null;
  await state.store.appendRetentionRecord({
    subjectKey: state.subjectKey,
    expectedRecordCount: state.records.length,
    expectedPreviousRecordSha256: previous?.recordSha256 || null,
    record: clone(record)
  });
  const records = await readAuthoritativeStore(state);
  const persisted = records.at(-1);
  if (!persisted || persisted.recordSha256 !== record.recordSha256 || records.length !== state.records.length + 1) {
    fail("route_iq_retention_ledger_readback_failed", "Retention ledger append failed read-back verification.");
  }
  state.records = records;
  return deepFreeze(clone(persisted));
}

async function appendLegalHold(ledger, input = {}) {
  const state = requireLedger(ledger);
  await refreshAuthoritativeState(state);
  const keys = new Set(["eventType", "recordedAt", "authority"]);
  assertExactRequiredKeys(input, keys, "legal_hold_append");
  if (!LEGAL_HOLD_EVENT_TYPES.has(input.eventType)) {
    fail("route_iq_retention_legal_hold_transition_invalid", "Legal-hold transition is invalid.");
  }
  const recordedAt = canonicalIso(input.recordedAt, "Legal-hold event time");
  const previous = state.records.at(-1) || null;
  if (previous && recordedAt.milliseconds <= Date.parse(previous.recordedAt)) {
    fail("route_iq_retention_ledger_chronology_invalid", "Retention ledger records must be strictly chronological.");
  }
  const stateBefore = priorHoldState(state.records);
  if ((input.eventType === "LEGAL_HOLD_APPLIED" && stateBefore !== "none")
    || (input.eventType === "LEGAL_HOLD_RELEASED" && stateBefore !== "active")) {
    fail("route_iq_retention_legal_hold_transition_invalid", "Legal-hold transition is invalid.");
  }
  const authority = verifyAuthorityAssertion(
    state.authorityVerifier,
    input.authority,
    {
      purpose: "legal_hold_transition",
      eventType: input.eventType,
      recordedAt: recordedAt.iso,
      subject: state.subject
    },
    LEGAL_HOLD_AUTHORITIES,
    "legal_hold_append.authority"
  );
  if (state.records.some(record => recordAuthorizationReference(record) === authority.authorizationReference)) {
    fail("route_iq_retention_ledger_authorization_reused", "Retention ledger authority reference was reused.");
  }
  const body = {
    schemaVersion: routeIqRetentionGovernanceEventVersion,
    recordKind: "route_iq_retention_legal_hold_event",
    eventType: input.eventType,
    ledgerSequence: state.records.length + 1,
    recordedAt: recordedAt.iso,
    authority,
    subject: state.subject,
    stateBefore,
    stateAfter: input.eventType === "LEGAL_HOLD_APPLIED" ? "active" : "none",
    reasonCode: input.eventType === "LEGAL_HOLD_APPLIED" ? "LEGAL_HOLD_REQUIRED" : "LEGAL_HOLD_RELEASED_BY_AUTHORITY",
    auditOwner: RETENTION_AUDIT_OWNER,
    appendOnly: true,
    historicalArchiveRewriteAllowed: false,
    previousRecordSha256: previous?.recordSha256 || null
  };
  const event = {
    ...body,
    eventId: `riq_retention_event_${sha256(stableJson(body))}`
  };
  const record = deepFreeze({ ...event, recordSha256: sha256(stableJson(event)) });
  validateLegalHoldRecord(record, state, state.records);
  return persistAndVerifyRecord(ledger, record);
}

async function appendOperationReceipt(ledger, input = {}) {
  const state = requireLedger(ledger, input.subject);
  await refreshAuthoritativeState(state);
  const canonicalInput = deepFreeze(clone(input));
  const existing = state.records.find(record => record.recordKind === "route_iq_retention_operation_receipt"
    && sameCanonical(record.operationInput, canonicalInput));
  if (existing) return deepFreeze(clone(existing));
  const decision = evaluateOperationAgainstRecords(canonicalInput, {
    subject: state.subject,
    records: state.records,
    authorityVerifier: state.authorityVerifier,
    ledgerKnown: true
  });
  const previous = state.records.at(-1) || null;
  if (previous && Date.parse(decision.requestedAt) <= Date.parse(previous.recordedAt)) {
    fail("route_iq_retention_ledger_chronology_invalid", "Retention ledger records must be strictly chronological.");
  }
  if (state.records.some(record => recordAuthorizationReference(record) === decision.authority.authorizationReference)) {
    fail("route_iq_retention_ledger_authorization_reused", "Retention ledger authority reference was reused.");
  }
  const body = {
    schemaVersion: routeIqRetentionOperationReceiptVersion,
    recordKind: "route_iq_retention_operation_receipt",
    ledgerSequence: state.records.length + 1,
    recordedAt: decision.requestedAt,
    operationInput: canonicalInput,
    decision: receiptDecision(decision),
    legalHoldSnapshot: decision.legalHoldSnapshot,
    auditOwner: RETENTION_AUDIT_OWNER,
    payloadRetained: false,
    appendOnly: true,
    historicalArchiveRewriteAllowed: false,
    physicalMutationPerformed: false,
    productionMutationAuthorized: false,
    previousRecordSha256: previous?.recordSha256 || null
  };
  const receipt = {
    ...body,
    receiptId: `riq_retention_receipt_${sha256(stableJson(body))}`
  };
  const record = deepFreeze({ ...receipt, recordSha256: sha256(stableJson(receipt)) });
  validateOperationReceiptRecord(record, state, state.records);
  return persistAndVerifyRecord(ledger, record);
}

async function appendDeletionEvent(ledger, input = {}) {
  const state = requireLedger(ledger);
  await refreshAuthoritativeState(state);
  const keys = new Set([
    "eventType",
    "recordedAt",
    "deletionPlanSha256",
    "operationReceiptSha256",
    "legalHoldSnapshotIdentitySha256",
    "artifact",
    "totalArtifactCount",
    "completedArtifactCount",
    "continuationCursor"
  ]);
  assertExactRequiredKeys(input, keys, "retention_deletion_event_append");
  if (!RETENTION_DELETION_EVENT_TYPES.has(input.eventType)) {
    fail("route_iq_retention_deletion_event_type_invalid", "Retention deletion event type is invalid.");
  }
  const recordedAt = canonicalIso(input.recordedAt, "Retention deletion event time");
  const artifact = normalizeDeletionArtifact(input.artifact, "retention_deletion_event_append.artifact");
  const existing = state.records.find(record => record.recordKind === "route_iq_retention_deletion_event"
    && record.deletionPlanSha256 === input.deletionPlanSha256
    && record.eventType === input.eventType
    && record.recordedAt === input.recordedAt
    && record.operationReceiptSha256 === input.operationReceiptSha256
    && record.legalHoldSnapshotIdentitySha256 === input.legalHoldSnapshotIdentitySha256
    && record.totalArtifactCount === input.totalArtifactCount
    && record.completedArtifactCount === input.completedArtifactCount
    && record.continuationCursor === input.continuationCursor
    && sameCanonical(record.artifact, artifact));
  if (existing) return deepFreeze(clone(existing));
  const previous = state.records.at(-1) || null;
  if (previous && recordedAt.milliseconds <= Date.parse(previous.recordedAt)) {
    fail("route_iq_retention_ledger_chronology_invalid", "Retention ledger records must be strictly chronological.");
  }
  const body = {
    schemaVersion: routeIqRetentionDeletionEventVersion,
    recordKind: "route_iq_retention_deletion_event",
    eventType: input.eventType,
    ledgerSequence: state.records.length + 1,
    recordedAt: recordedAt.iso,
    subject: state.subject,
    deletionPlanSha256: requireSha256(input.deletionPlanSha256, "Retention deletion plan hash"),
    operationReceiptSha256: requireSha256(input.operationReceiptSha256, "Retention operation receipt hash"),
    legalHoldSnapshotIdentitySha256: requireSha256(
      input.legalHoldSnapshotIdentitySha256,
      "Retention legal-hold snapshot identity hash"
    ),
    artifact,
    totalArtifactCount: input.totalArtifactCount,
    completedArtifactCount: input.completedArtifactCount,
    continuationCursor: input.continuationCursor,
    stateAfter: input.eventType === "DELETION_COMPLETED" ? "DELETION_COMPLETED" : "DELETION_IN_PROGRESS",
    auditOwner: RETENTION_AUDIT_OWNER,
    payloadRetained: false,
    appendOnly: true,
    historicalArchiveRewriteAllowed: false,
    physicalMutationPerformed: input.eventType !== "DELETION_STARTED",
    productionMutationAuthorized: false,
    previousRecordSha256: previous?.recordSha256 || null
  };
  const event = {
    ...body,
    eventId: `riq_retention_deletion_event_${sha256(stableJson(body))}`
  };
  const record = deepFreeze({ ...event, recordSha256: sha256(stableJson(event)) });
  validateDeletionEventRecord(record, state, state.records);
  return persistAndVerifyRecord(ledger, record);
}

export async function openRouteIqRetentionGovernanceLedger(input = {}) {
  const keys = new Set(["store", "subject", "authorityVerifier"]);
  assertExactRequiredKeys(input, keys, "retention_ledger_open");
  if (!input.store
    || input.store.persistenceMode !== "durable_append_only"
    || typeof input.store.readRetentionLedger !== "function"
    || typeof input.store.appendRetentionRecord !== "function") {
    fail("route_iq_retention_store_invalid", "A durable append-only retention store is required.");
  }
  if (!VERIFIER_STATE.has(input.authorityVerifier)) {
    fail("route_iq_retention_authority_verifier_missing", "An authenticated Data retention authority verifier is required.");
  }
  const subject = normalizeSubject(input.subject);
  const ledger = {};
  const state = {
    store: input.store,
    authorityVerifier: input.authorityVerifier,
    subject,
    subjectKey: `riq_retention_subject_${sha256(stableJson(subject))}`,
    records: []
  };
  LEDGER_STATE.set(ledger, state);
  state.records = await readAuthoritativeStore(state);
  Object.defineProperties(ledger, {
    subjectKey: { value: state.subjectKey, enumerable: true },
    persistenceMode: { value: "durable_append_only", enumerable: true },
    authorityClassification: { value: "source_fixture_or_local", enumerable: true },
    productionAuthorityAvailable: { value: false, enumerable: true },
    appendLegalHold: { value: inputValue => appendLegalHold(ledger, inputValue), enumerable: true },
    appendOperationReceipt: { value: inputValue => appendOperationReceipt(ledger, inputValue), enumerable: true },
    appendDeletionEvent: { value: inputValue => appendDeletionEvent(ledger, inputValue), enumerable: true }
  });
  return deepFreeze(ledger);
}

export function validateRouteIqRetentionOperationReceipt(receipt, ledger) {
  const state = requireLedger(ledger);
  const index = state.records.findIndex(record => record.recordSha256 === receipt?.recordSha256);
  if (index < 0 || !sameCanonical(state.records[index], receipt)) {
    fail("route_iq_retention_receipt_not_persisted", "Retention receipt is not the exact durable ledger record.");
  }
  return deepFreeze(clone(validateOperationReceiptRecord(receipt, state, state.records.slice(0, index))));
}

export function validateRouteIqRetentionDeletionEvent(event, ledger) {
  const state = requireLedger(ledger);
  const index = state.records.findIndex(record => record.recordSha256 === event?.recordSha256);
  if (index < 0 || !sameCanonical(state.records[index], event)) {
    fail("route_iq_retention_deletion_event_not_persisted", "Retention deletion event is not the exact durable ledger record.");
  }
  return deepFreeze(clone(validateDeletionEventRecord(event, state, state.records.slice(0, index))));
}

export function readRouteIqRetentionDeletionStatus(ledger, subject) {
  const state = requireLedger(ledger, subject);
  const events = state.records.filter(record => record.recordKind === "route_iq_retention_deletion_event");
  const latest = events.at(-1) || null;
  if (!latest) {
    return deepFreeze({
      state: "AVAILABLE",
      deletionStarted: false,
      deletionCompleted: false,
      deletionPlanSha256: null,
      lastEventSha256: null,
      completedArtifactCount: 0,
      totalArtifactCount: 0
    });
  }
  return deepFreeze({
    state: latest.stateAfter,
    deletionStarted: true,
    deletionCompleted: latest.stateAfter === "DELETION_COMPLETED",
    deletionPlanSha256: latest.deletionPlanSha256,
    lastEventSha256: latest.recordSha256,
    completedArtifactCount: latest.completedArtifactCount,
    totalArtifactCount: latest.totalArtifactCount
  });
}
