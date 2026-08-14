import { createHash } from "node:crypto";

import {
  projectCommittedRouteIqFieldSessionOutcomes,
  supportedFieldSessionWorkspaces
} from "./route-iq-field-session-archive.mjs";
import {
  evaluateRouteIqProspectiveRetentionEnvelope,
  routeIqProspectiveRetentionBoundaryKeys,
  routeIqProspectiveRetentionBoundaryContractVersion,
  routeIqProspectiveRetentionEnvelopeKeys,
  routeIqProspectiveRetentionPolicyVersion
} from "./route-iq-prospective-retention-policy.mjs";
import {
  addRouteIqRetentionCalendarMonths,
  calculateRouteIqRetentionBoundary,
  readRouteIqRetentionProductionLegalHoldReadiness,
  readRouteIqRetentionSourceFixtureLegalHoldReadiness,
  routeIqRetentionMaximumCalendarMonths,
  routeIqRetentionProductionLegalHoldMaximumAgeMilliseconds
} from "./route-iq-retention-governance.mjs";

export const routeIqProspectiveProductionRetentionAdmissionVersion =
  "route-iq-prospective-production-retention-admission-v1";
export const routeIqProspectiveProductionRetentionAdmissionProviderVersion =
  "route-iq-prospective-production-retention-admission-provider-v1";
export const routeIqProspectiveProductionRetentionAdmissionBinding =
  "DATA_ROUTE_IQ_PROSPECTIVE_RETENTION_ADMISSION_PROVIDER";
export const routeIqProspectiveProductionRetentionAdmissionMaximumAgeMilliseconds = 5 * 60 * 1000;
export const routeIqProspectiveProductionRetentionPolicySha256 =
  "a0a60f3ffb693d9fadd2b1637d22fc6f6f035f8fa2533af96dc3a0c1644e1a9f";

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const HASH_ID_PATTERNS = Object.freeze({
  coordinatorSession: /^riq_session_[a-f0-9]{64}$/,
  opportunity: /^riq_opportunity_[a-f0-9]{64}$/,
  candidate: /^riq_candidate_[a-f0-9]{64}$/,
  action: /^riq_action_[a-f0-9]{64}$/,
  outcome: /^riq_outcome_[a-f0-9]{64}$/,
  admission: /^riq_retention_admission_[a-f0-9]{64}$/,
  replay: /^riq_retention_source_[a-f0-9]{64}$/
});
const SOURCE_CLASSIFICATIONS = Object.freeze({
  authoritative_production: "production",
  source_only_fixture: "source_fixture"
});
const PROVIDER_KEYS = new Set([
  "version",
  "sourceClassification",
  "environment",
  "bindingIdentitySha256",
  "readAuthoritativeTime",
  "readCommittedArchive",
  "readOutcomeAdmissionAuthority",
  "readRetentionGovernance",
  "readGovernedRuntimeState",
  "claimAdmission"
]);
const REQUEST_KEYS = new Set([
  "scope",
  "opportunityId",
  "fieldSessionId",
  "coordinatorSessionId",
  "evaluationContextSha256",
  "evaluatedCandidateId",
  "actionArtifactId",
  "outcomeReceiptArtifactId",
  "outcomeReceiptRecordSha256",
  "sourceArchiveSessionSha256",
  "sourceArchiveRawSha256",
  "sourceOutcomeEvidenceSha256",
  "authoritativeOutcomeTime"
]);
const ADMISSION_RECORD_KEYS = new Set([
  "admissionVersion",
  "admissionState",
  "authority",
  "sourceClassification",
  "environment",
  "providerBindingIdentitySha256",
  "admissionKey",
  "replayKey",
  "issuedAt",
  "expiresAt",
  "scope",
  "opportunityId",
  "evaluationBinding",
  "committedArchive",
  "sourceOutcomeEvidenceSha256",
  "authoritativeOutcomeTime",
  "outcomeRecordSha256",
  "policyVersion",
  "policySha256",
  "evidenceIdentitySha256",
  "legalHold",
  "dataAdmission",
  "collectionState",
  "recommendationInfluence",
  "recordOrigin",
  "representativeOutputAllowed",
  "recommendationInfluenceAllowed",
  "productionMutationAuthorized",
  "claimsSha256"
]);
const ADMISSION_EXPECTED_KEYS = new Set([
  "sourceClassification",
  "providerBindingIdentitySha256",
  "scope",
  "opportunityId",
  "evaluationContextSha256",
  "evaluatedCandidateId",
  "actionArtifactId",
  "outcomeReceiptArtifactId",
  "outcomeReceiptRecordSha256",
  "fieldSessionId",
  "coordinatorSessionId",
  "sourceArchiveSessionSha256",
  "sourceArchiveRawSha256",
  "sourceArchiveNormalizedSha256",
  "committedArchiveIdentitySha256",
  "sourceOutcomeEvidenceSha256",
  "authoritativeOutcomeTime",
  "outcomeRecordSha256",
  "policyVersion",
  "policySha256",
  "retentionBoundarySha256",
  "legalHoldSnapshotIdentitySha256",
  "legalHoldLedgerSha256",
  "legalHoldAttestationSha256",
  "legalHoldObservedAt",
  "legalHoldValidUntil",
  "admissionKey",
  "replayKey"
]);

export class RouteIqProspectiveProductionRetentionAdmissionError extends Error {
  constructor(code, { status = 409, details = {} } = {}) {
    super(code);
    this.name = "RouteIqProspectiveProductionRetentionAdmissionError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function fail(code, { status = 409, details = {} } = {}) {
  throw new RouteIqProspectiveProductionRetentionAdmissionError(code, { status, details });
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function computeRouteIqProspectiveProductionRetentionAdmissionSha256(value) {
  return createHash("sha256")
    .update(typeof value === "string" ? value : stableJson(value))
    .digest("hex");
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

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertExactKeys(value, keys, scope) {
  if (!isPlainObject(value)) {
    fail("route_iq_prospective_retention_admission_structure_invalid", { details: { scope } });
  }
  const actual = Reflect.ownKeys(value);
  if (actual.some(key => typeof key !== "string" || !keys.has(key))
    || [...keys].some(key => !Object.hasOwn(value, key))) {
    fail("route_iq_prospective_retention_admission_fields_invalid", { details: { scope } });
  }
}

function canonicalIso(value, code) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    fail(code);
  }
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) fail(code);
  return { iso: value, milliseconds };
}

function requireSha256(value, code) {
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) fail(code);
  return value;
}

function requireHashId(value, pattern, code) {
  if (typeof value !== "string" || !pattern.test(value)) fail(code);
  return value;
}

function normalizeScope(scope) {
  assertExactKeys(scope, new Set(["workspaceId", "operatingProfileId", "representativeId"]), "scope");
  const workspace = supportedFieldSessionWorkspaces[scope.workspaceId];
  if (!workspace
    || workspace.operatingProfileId !== scope.operatingProfileId
    || !workspace.representativeIds.includes(scope.representativeId)) {
    fail("route_iq_prospective_retention_admission_scope_unauthorized");
  }
  return deepFreeze({
    workspaceId: scope.workspaceId,
    operatingProfileId: scope.operatingProfileId,
    representativeId: scope.representativeId
  });
}

function normalizeRequest(input) {
  assertExactKeys(input, REQUEST_KEYS, "admission_request");
  const scope = normalizeScope(input.scope);
  requireHashId(
    input.opportunityId,
    HASH_ID_PATTERNS.opportunity,
    "route_iq_prospective_retention_admission_opportunity_invalid"
  );
  requireHashId(
    input.coordinatorSessionId,
    HASH_ID_PATTERNS.coordinatorSession,
    "route_iq_prospective_retention_admission_coordinator_session_invalid"
  );
  requireSha256(
    input.evaluationContextSha256,
    "route_iq_prospective_retention_admission_evaluation_context_hash_invalid"
  );
  requireHashId(
    input.evaluatedCandidateId,
    HASH_ID_PATTERNS.candidate,
    "route_iq_prospective_retention_admission_candidate_invalid"
  );
  requireHashId(
    input.actionArtifactId,
    HASH_ID_PATTERNS.action,
    "route_iq_prospective_retention_admission_action_invalid"
  );
  requireHashId(
    input.outcomeReceiptArtifactId,
    HASH_ID_PATTERNS.outcome,
    "route_iq_prospective_retention_admission_outcome_receipt_invalid"
  );
  requireSha256(
    input.outcomeReceiptRecordSha256,
    "route_iq_prospective_retention_admission_outcome_receipt_hash_invalid"
  );
  if (typeof input.fieldSessionId !== "string"
    || !/^route-iq-field-session-[a-z0-9_-]+-\d{4}-\d{2}-\d{2}$/.test(input.fieldSessionId)) {
    fail("route_iq_prospective_retention_admission_field_session_invalid");
  }
  requireSha256(
    input.sourceArchiveSessionSha256,
    "route_iq_prospective_retention_admission_archive_session_hash_invalid"
  );
  requireSha256(
    input.sourceArchiveRawSha256,
    "route_iq_prospective_retention_admission_archive_raw_hash_invalid"
  );
  requireSha256(
    input.sourceOutcomeEvidenceSha256,
    "route_iq_prospective_retention_admission_outcome_hash_invalid"
  );
  canonicalIso(
    input.authoritativeOutcomeTime,
    "route_iq_prospective_retention_admission_outcome_time_invalid"
  );
  return deepFreeze({ ...clone(input), scope });
}

function normalizeProvider(provider, expectedClassification) {
  assertExactKeys(provider, PROVIDER_KEYS, "admission_provider");
  const expectedEnvironment = SOURCE_CLASSIFICATIONS[expectedClassification];
  if (provider.version !== routeIqProspectiveProductionRetentionAdmissionProviderVersion
    || provider.sourceClassification !== expectedClassification
    || provider.environment !== expectedEnvironment) {
    fail("route_iq_prospective_retention_admission_provider_invalid", { status: 503 });
  }
  requireSha256(
    provider.bindingIdentitySha256,
    "route_iq_prospective_retention_admission_provider_identity_invalid"
  );
  for (const method of [
    "readAuthoritativeTime",
    "readCommittedArchive",
    "readOutcomeAdmissionAuthority",
    "readRetentionGovernance",
    "readGovernedRuntimeState",
    "claimAdmission"
  ]) {
    if (typeof provider[method] !== "function") {
      fail("route_iq_prospective_retention_admission_provider_invalid", {
        status: 503,
        details: { operation: method }
      });
    }
  }
  return provider;
}

async function providerRead(provider, operation, request) {
  try {
    return await provider[operation](deepFreeze(clone(request)));
  } catch (error) {
    if (error instanceof RouteIqProspectiveProductionRetentionAdmissionError) throw error;
    fail("route_iq_prospective_retention_admission_provider_unavailable", {
      status: 503,
      details: { operation }
    });
  }
}

async function readServerTime(provider) {
  const result = await providerRead(provider, "readAuthoritativeTime", {
    purpose: "prospective_retention_admission"
  });
  assertExactKeys(result, new Set(["authoritativeTime"]), "authoritative_time_result");
  return canonicalIso(
    result.authoritativeTime,
    "route_iq_prospective_retention_admission_server_time_invalid"
  );
}

function validateRuntimeState(result, provider, issuedAt) {
  const keys = new Set([
    "schemaVersion",
    "source",
    "collectionState",
    "recommendationInfluence",
    "recordOrigin",
    "observedAt",
    "bindingIdentitySha256",
    "stateIdentitySha256"
  ]);
  assertExactKeys(result, keys, "governed_runtime_state");
  const observedAt = canonicalIso(
    result.observedAt,
    "route_iq_prospective_retention_admission_runtime_state_time_invalid"
  );
  const identityBody = {
    schemaVersion: result.schemaVersion,
    source: result.source,
    collectionState: result.collectionState,
    recommendationInfluence: result.recommendationInfluence,
    recordOrigin: result.recordOrigin,
    observedAt: result.observedAt,
    bindingIdentitySha256: result.bindingIdentitySha256
  };
  if (result.schemaVersion !== "route-iq-prospective-runtime-activation-state-v1"
    || result.source !== "server_governed"
    || result.collectionState !== "on"
    || result.recommendationInfluence !== "off"
    || result.recordOrigin !== "prospective"
    || result.bindingIdentitySha256 !== provider.bindingIdentitySha256
    || result.stateIdentitySha256 !== computeRouteIqProspectiveProductionRetentionAdmissionSha256(identityBody)
    || observedAt.milliseconds > issuedAt.milliseconds
    || issuedAt.milliseconds - observedAt.milliseconds
      > routeIqProspectiveProductionRetentionAdmissionMaximumAgeMilliseconds) {
    fail("route_iq_prospective_retention_admission_runtime_state_invalid");
  }
  return deepFreeze(clone(identityBody));
}

function validateOutcomeAuthority(result, request) {
  const keys = new Set([
    "schemaVersion",
    "authority",
    "scope",
    "opportunityId",
    "coordinatorSessionId",
    "evaluationContextSha256",
    "evaluatedCandidateId",
    "actionArtifactId",
    "outcomeReceiptArtifactId",
    "outcomeReceiptRecordSha256",
    "fieldSessionId",
    "sourceArchiveSessionSha256",
    "sourceArchiveRawSha256",
    "sourceOutcomeEvidenceSha256",
    "authoritativeOutcomeTime",
    "outcomeRecordSha256",
    "authorityIdentitySha256"
  ]);
  assertExactKeys(result, keys, "outcome_admission_authority");
  const body = Object.fromEntries(
    Object.entries(result).filter(([key]) => key !== "authorityIdentitySha256")
  );
  normalizeScope(result.scope);
  requireSha256(
    result.outcomeRecordSha256,
    "route_iq_prospective_retention_admission_outcome_record_hash_invalid"
  );
  canonicalIso(
    result.authoritativeOutcomeTime,
    "route_iq_prospective_retention_admission_outcome_time_invalid"
  );
  if (result.schemaVersion !== "route-iq-prospective-outcome-admission-authority-v1"
    || result.authority !== "prometheus_data_prospective_coordinator"
    || stableJson(result.scope) !== stableJson(request.scope)
    || result.opportunityId !== request.opportunityId
    || result.coordinatorSessionId !== request.coordinatorSessionId
    || result.evaluationContextSha256 !== request.evaluationContextSha256
    || result.evaluatedCandidateId !== request.evaluatedCandidateId
    || result.actionArtifactId !== request.actionArtifactId
    || result.outcomeReceiptArtifactId !== request.outcomeReceiptArtifactId
    || result.outcomeReceiptRecordSha256 !== request.outcomeReceiptRecordSha256
    || result.fieldSessionId !== request.fieldSessionId
    || result.sourceArchiveSessionSha256 !== request.sourceArchiveSessionSha256
    || result.sourceArchiveRawSha256 !== request.sourceArchiveRawSha256
    || result.sourceOutcomeEvidenceSha256 !== request.sourceOutcomeEvidenceSha256
    || result.authoritativeOutcomeTime !== request.authoritativeOutcomeTime
    || result.authorityIdentitySha256 !== computeRouteIqProspectiveProductionRetentionAdmissionSha256(body)) {
    fail("route_iq_prospective_retention_admission_outcome_authority_mismatch");
  }
  return deepFreeze(clone(result));
}

function deriveCommittedArchiveIdentity(archiveRead, request) {
  if (!isPlainObject(archiveRead)
    || archiveRead.ok !== true
    || archiveRead.found !== true
    || archiveRead.unavailable === true
    || !archiveRead.record) {
    fail("route_iq_prospective_retention_admission_archive_unavailable");
  }
  let projection;
  try {
    projection = projectCommittedRouteIqFieldSessionOutcomes({
      ...request.scope,
      archiveRecord: archiveRead.record
    });
  } catch {
    fail("route_iq_prospective_retention_admission_archive_invalid");
  }
  const matchingOutcomes = projection.outcomes.filter(
    outcome => outcome.evidenceSha256 === request.sourceOutcomeEvidenceSha256
  );
  const expectedSessionSha256 = computeRouteIqProspectiveProductionRetentionAdmissionSha256(
    request.fieldSessionId
  );
  if (archiveRead.record.commit?.sessionId !== request.fieldSessionId
    || projection.sourceArchive.sourceArchiveSessionSha256 !== expectedSessionSha256
    || projection.sourceArchive.sourceArchiveSessionSha256 !== request.sourceArchiveSessionSha256
    || projection.sourceArchive.rawSha256 !== request.sourceArchiveRawSha256
    || matchingOutcomes.length !== 1) {
    fail("route_iq_prospective_retention_admission_archive_binding_mismatch");
  }
  const identity = {
    contractVersion: projection.schemaVersion,
    fieldSessionId: request.fieldSessionId,
    scope: request.scope,
    handoffContractId: projection.sourceArchive.handoffContractId,
    sourceArchiveSessionSha256: projection.sourceArchive.sourceArchiveSessionSha256,
    rawSha256: projection.sourceArchive.rawSha256,
    normalizedSha256: projection.sourceArchive.normalizedSha256,
    archiveCommittedAt: projection.sourceArchive.archiveCommittedAt,
    sourceOutcomeEvidenceSha256: matchingOutcomes[0].evidenceSha256
  };
  return deepFreeze({
    ...identity,
    archiveIdentitySha256: computeRouteIqProspectiveProductionRetentionAdmissionSha256(identity)
  });
}

function normalizeRetentionGovernance(result, request) {
  const keys = new Set([
    "retentionGovernanceLedger",
    "legalHoldAuthoritySource",
    "customerAccountId",
    "customerContractExpiresAt",
    "customerOverrideAuthority",
    "customerOverrideAuthorityVerifier"
  ]);
  assertExactKeys(result, keys, "retention_governance_result");
  if (!result.retentionGovernanceLedger
    || result.customerAccountId !== request.scope.workspaceId
    || (result.customerContractExpiresAt === null) !== (result.customerOverrideAuthority === null)
    || (result.customerContractExpiresAt !== null && !result.customerOverrideAuthorityVerifier)) {
    fail("route_iq_prospective_retention_admission_governance_invalid");
  }
  return result;
}

async function readLegalHoldReadiness(classification, scope, evaluatedAt, governance) {
  const reader = classification === "authoritative_production"
    ? readRouteIqRetentionProductionLegalHoldReadiness
    : readRouteIqRetentionSourceFixtureLegalHoldReadiness;
  return reader({ scope, evaluatedAt }, {
    retentionGovernanceLedger: governance.retentionGovernanceLedger,
    legalHoldAuthoritySource: governance.legalHoldAuthoritySource
  });
}

function validateLegalHoldReadiness(readiness, classification, issuedAt) {
  const observedAt = canonicalIso(
    readiness?.observedAt,
    "route_iq_prospective_retention_admission_legal_hold_time_invalid"
  );
  const validUntil = canonicalIso(
    readiness?.validUntil,
    "route_iq_prospective_retention_admission_legal_hold_time_invalid"
  );
  if (readiness.authoritative !== true
    || readiness.sourceClassification !== classification
    || readiness.legalHoldState !== "none"
    || readiness.deletionEligibleByLegalHold !== true
    || readiness.physicalMutationAuthorized !== false
    || (classification === "authoritative_production"
      ? readiness.productionReady !== true || readiness.sourceOnly !== false
      : readiness.productionReady !== false || readiness.sourceOnly !== true)
    || observedAt.milliseconds > issuedAt.milliseconds
    || validUntil.milliseconds < issuedAt.milliseconds
    || issuedAt.milliseconds - observedAt.milliseconds
      > routeIqProspectiveProductionRetentionAdmissionMaximumAgeMilliseconds) {
    fail("route_iq_prospective_retention_admission_legal_hold_blocked");
  }
  return deepFreeze({
    state: readiness.legalHoldState,
    snapshotIdentitySha256: requireSha256(
      readiness.legalHoldSnapshotIdentitySha256,
      "route_iq_prospective_retention_admission_legal_hold_identity_invalid"
    ),
    ledgerSha256: requireSha256(
      readiness.ledgerSha256,
      "route_iq_prospective_retention_admission_legal_hold_ledger_invalid"
    ),
    attestationSha256: requireSha256(
      readiness.attestationSha256,
      "route_iq_prospective_retention_admission_legal_hold_attestation_invalid"
    ),
    observedAt: observedAt.iso,
    validUntil: validUntil.iso,
    authoritative: true
  });
}

function buildRetentionBoundary(governance, archiveIdentity, request) {
  const subject = {
    workspaceId: request.scope.workspaceId,
    operatingProfileId: request.scope.operatingProfileId,
    recordClass: "prospective_shadow_evidence",
    sourceRecordSha256: request.sourceOutcomeEvidenceSha256
  };
  const options = governance.customerOverrideAuthorityVerifier
    ? { authorityVerifier: governance.customerOverrideAuthorityVerifier }
    : {};
  const calculated = calculateRouteIqRetentionBoundary({
    subject,
    customerAccountId: governance.customerAccountId,
    createdAt: archiveIdentity.archiveCommittedAt,
    customerContractExpiresAt: governance.customerContractExpiresAt,
    customerOverrideAuthority: governance.customerOverrideAuthority
  }, options);
  if (calculated.maximumCalendarMonths !== routeIqRetentionMaximumCalendarMonths) {
    fail("route_iq_prospective_retention_admission_maximum_invalid");
  }
  return deepFreeze({
    contractVersion: routeIqProspectiveRetentionBoundaryContractVersion,
    authorizationState: "founder_authorized_18_month_maximum",
    source: "authenticated_data_retention_contract",
    ...calculated
  });
}

function buildEvidenceIdentity(request, archiveIdentity, outcomeAuthority) {
  return computeRouteIqProspectiveProductionRetentionAdmissionSha256({
    scope: request.scope,
    opportunityId: request.opportunityId,
    fieldSessionId: request.fieldSessionId,
    coordinatorSessionId: request.coordinatorSessionId,
    evaluationContextSha256: request.evaluationContextSha256,
    evaluatedCandidateId: request.evaluatedCandidateId,
    actionArtifactId: request.actionArtifactId,
    outcomeReceiptArtifactId: request.outcomeReceiptArtifactId,
    outcomeReceiptRecordSha256: request.outcomeReceiptRecordSha256,
    committedArchiveIdentitySha256: archiveIdentity.archiveIdentitySha256,
    sourceArchiveSessionSha256: request.sourceArchiveSessionSha256,
    sourceArchiveRawSha256: request.sourceArchiveRawSha256,
    sourceOutcomeEvidenceSha256: request.sourceOutcomeEvidenceSha256,
    outcomeRecordSha256: outcomeAuthority.outcomeRecordSha256,
    authoritativeOutcomeTime: request.authoritativeOutcomeTime,
    policyVersion: routeIqProspectiveRetentionPolicyVersion,
    policySha256: routeIqProspectiveProductionRetentionPolicySha256
  });
}

async function produceAdmission(input, provider, classification) {
  const request = normalizeRequest(input);
  const normalizedProvider = normalizeProvider(provider, classification);
  const issuedAt = await readServerTime(normalizedProvider);
  const outcomeTime = canonicalIso(
    request.authoritativeOutcomeTime,
    "route_iq_prospective_retention_admission_outcome_time_invalid"
  );
  if (outcomeTime.milliseconds > issuedAt.milliseconds) {
    fail("route_iq_prospective_retention_admission_caller_time_rejected");
  }

  const runtimeState = validateRuntimeState(
    await providerRead(normalizedProvider, "readGovernedRuntimeState", {
      scope: request.scope,
      issuedAt: issuedAt.iso
    }),
    normalizedProvider,
    issuedAt
  );
  const archiveIdentity = deriveCommittedArchiveIdentity(
    await providerRead(normalizedProvider, "readCommittedArchive", {
      scope: request.scope,
      fieldSessionId: request.fieldSessionId
    }),
    request
  );
  const outcomeAuthority = validateOutcomeAuthority(
    await providerRead(normalizedProvider, "readOutcomeAdmissionAuthority", {
      scope: request.scope,
      opportunityId: request.opportunityId,
      coordinatorSessionId: request.coordinatorSessionId,
      evaluationContextSha256: request.evaluationContextSha256,
      evaluatedCandidateId: request.evaluatedCandidateId,
      actionArtifactId: request.actionArtifactId,
      outcomeReceiptArtifactId: request.outcomeReceiptArtifactId,
      outcomeReceiptRecordSha256: request.outcomeReceiptRecordSha256,
      sourceOutcomeEvidenceSha256: request.sourceOutcomeEvidenceSha256
    }),
    request
  );
  if (Date.parse(archiveIdentity.archiveCommittedAt) > outcomeTime.milliseconds) {
    fail("route_iq_prospective_retention_admission_chronology_invalid");
  }
  const governance = normalizeRetentionGovernance(
    await providerRead(normalizedProvider, "readRetentionGovernance", {
      scope: request.scope,
      sourceOutcomeEvidenceSha256: request.sourceOutcomeEvidenceSha256,
      authoritativeTime: issuedAt.iso
    }),
    request
  );
  const retentionBoundary = buildRetentionBoundary(governance, archiveIdentity, request);
  if (issuedAt.milliseconds >= Date.parse(retentionBoundary.expiresAt)) {
    fail("route_iq_prospective_retention_admission_expired");
  }
  const evidenceIdentitySha256 = buildEvidenceIdentity(request, archiveIdentity, outcomeAuthority);
  const legalHoldScope = {
    workspaceId: request.scope.workspaceId,
    operatingProfileId: request.scope.operatingProfileId,
    representativeId: request.scope.representativeId,
    recordClass: "prospective_shadow_evidence",
    sourceRecordSha256: request.sourceOutcomeEvidenceSha256,
    evidenceIdentitySha256
  };
  let readiness;
  try {
    readiness = await readLegalHoldReadiness(
      classification,
      legalHoldScope,
      issuedAt.iso,
      governance
    );
  } catch (error) {
    if (error?.code) throw error;
    fail("route_iq_prospective_retention_admission_legal_hold_unavailable");
  }
  const legalHold = validateLegalHoldReadiness(readiness, classification, issuedAt);
  const envelope = {
    policyVersion: routeIqProspectiveRetentionPolicyVersion,
    collectionState: runtimeState.collectionState,
    recommendationInfluence: runtimeState.recommendationInfluence,
    recordOrigin: runtimeState.recordOrigin,
    workspaceId: request.scope.workspaceId,
    operatingProfileId: request.scope.operatingProfileId,
    representativeId: request.scope.representativeId,
    evaluatedAt: request.authoritativeOutcomeTime,
    retentionBoundary,
    derivedProjectionExpiresAt: retentionBoundary.expiresAt
  };
  const policyEvaluation = evaluateRouteIqProspectiveRetentionEnvelope(envelope, {
    retentionGovernanceLedger: governance.retentionGovernanceLedger
  });
  if (policyEvaluation.eligible !== true) {
    fail("route_iq_prospective_retention_admission_policy_blocked", {
      details: { reasonCodes: [...policyEvaluation.reasons] }
    });
  }

  const sourceSession = {
    coordinatorSessionId: request.coordinatorSessionId,
    fieldSessionId: request.fieldSessionId,
    rawSha256: request.sourceArchiveRawSha256
  };
  const binding = {
    scope: request.scope,
    opportunityId: request.opportunityId,
    evaluationContextSha256: request.evaluationContextSha256,
    evaluatedCandidateId: request.evaluatedCandidateId,
    actionArtifactId: request.actionArtifactId,
    outcomeReceiptArtifactId: request.outcomeReceiptArtifactId,
    outcomeReceiptRecordSha256: request.outcomeReceiptRecordSha256,
    sourceOutcomeEvidenceSha256: request.sourceOutcomeEvidenceSha256,
    authoritativeOutcomeTime: request.authoritativeOutcomeTime,
    committedArchiveIdentitySha256: archiveIdentity.archiveIdentitySha256,
    outcomeRecordSha256: outcomeAuthority.outcomeRecordSha256,
    evidenceIdentitySha256,
    policyVersion: routeIqProspectiveRetentionPolicyVersion,
    policySha256: routeIqProspectiveProductionRetentionPolicySha256,
    legalHoldSnapshotIdentitySha256: legalHold.snapshotIdentitySha256,
    issuedAt: issuedAt.iso
  };
  const admissionKey = `riq_retention_admission_${computeRouteIqProspectiveProductionRetentionAdmissionSha256(binding)}`;
  const replayKey = `riq_retention_source_${computeRouteIqProspectiveProductionRetentionAdmissionSha256({
    scope: request.scope,
    sourceOutcomeEvidenceSha256: request.sourceOutcomeEvidenceSha256
  })}`;
  const expiresAt = new Date(
    issuedAt.milliseconds + routeIqProspectiveProductionRetentionAdmissionMaximumAgeMilliseconds
  ).toISOString();
  const claims = {
    admissionVersion: routeIqProspectiveProductionRetentionAdmissionVersion,
    admissionState: "RETENTION_ADMITTED",
    authority: "prometheus_data_retention_admission",
    sourceClassification: classification,
    environment: normalizedProvider.environment,
    providerBindingIdentitySha256: normalizedProvider.bindingIdentitySha256,
    admissionKey,
    replayKey,
    issuedAt: issuedAt.iso,
    expiresAt,
    scope: request.scope,
    opportunityId: request.opportunityId,
    evaluationBinding: {
      evaluationContextSha256: request.evaluationContextSha256,
      evaluatedCandidateId: request.evaluatedCandidateId,
      actionArtifactId: request.actionArtifactId,
      outcomeReceiptArtifactId: request.outcomeReceiptArtifactId,
      outcomeReceiptRecordSha256: request.outcomeReceiptRecordSha256
    },
    committedArchive: archiveIdentity,
    sourceOutcomeEvidenceSha256: request.sourceOutcomeEvidenceSha256,
    authoritativeOutcomeTime: request.authoritativeOutcomeTime,
    outcomeRecordSha256: outcomeAuthority.outcomeRecordSha256,
    policyVersion: routeIqProspectiveRetentionPolicyVersion,
    policySha256: routeIqProspectiveProductionRetentionPolicySha256,
    evidenceIdentitySha256,
    legalHold,
    dataAdmission: {
      dataPolicySha256: routeIqProspectiveProductionRetentionPolicySha256,
      envelope,
      sourceSession
    },
    collectionState: runtimeState.collectionState,
    recommendationInfluence: runtimeState.recommendationInfluence,
    recordOrigin: runtimeState.recordOrigin,
    representativeOutputAllowed: false,
    recommendationInfluenceAllowed: false,
    productionMutationAuthorized: false
  };
  const claimsSha256 = computeRouteIqProspectiveProductionRetentionAdmissionSha256(claims);
  requireHashId(
    admissionKey,
    HASH_ID_PATTERNS.admission,
    "route_iq_prospective_retention_admission_identity_invalid"
  );
  requireHashId(
    replayKey,
    HASH_ID_PATTERNS.replay,
    "route_iq_prospective_retention_admission_replay_identity_invalid"
  );
  const claimResult = await providerRead(normalizedProvider, "claimAdmission", {
    admissionKey,
    replayKey,
    claimsSha256,
    scope: request.scope,
    sourceOutcomeEvidenceSha256: request.sourceOutcomeEvidenceSha256,
    legalHoldSnapshotIdentitySha256: legalHold.snapshotIdentitySha256,
    legalHoldLedgerSha256: legalHold.ledgerSha256,
    requireCurrentLegalHoldState: "none",
    expiresAt
  });
  assertExactKeys(
    claimResult,
    new Set([
      "state",
      "admissionKey",
      "replayKey",
      "claimsSha256",
      "legalHoldSnapshotIdentitySha256",
      "legalHoldLedgerSha256",
      "legalHoldState"
    ]),
    "admission_claim_result"
  );
  if (claimResult.state === "duplicate") {
    fail("route_iq_prospective_retention_admission_duplicate");
  }
  if (claimResult.state === "replay") {
    fail("route_iq_prospective_retention_admission_replay");
  }
  if (claimResult.state !== "claimed"
    || claimResult.admissionKey !== admissionKey
    || claimResult.replayKey !== replayKey
    || claimResult.claimsSha256 !== claimsSha256
    || claimResult.legalHoldSnapshotIdentitySha256 !== legalHold.snapshotIdentitySha256
    || claimResult.legalHoldLedgerSha256 !== legalHold.ledgerSha256
    || claimResult.legalHoldState !== "none") {
    fail("route_iq_prospective_retention_admission_claim_invalid");
  }
  return deepFreeze({ ...claims, claimsSha256 });
}

function validateAdmissionRecordShape(record) {
  assertExactKeys(record, ADMISSION_RECORD_KEYS, "admission_record");
  assertExactKeys(record.evaluationBinding, new Set([
    "evaluationContextSha256",
    "evaluatedCandidateId",
    "actionArtifactId",
    "outcomeReceiptArtifactId",
    "outcomeReceiptRecordSha256"
  ]), "admission_record.evaluation_binding");
  assertExactKeys(record.committedArchive, new Set([
    "contractVersion",
    "fieldSessionId",
    "scope",
    "handoffContractId",
    "sourceArchiveSessionSha256",
    "rawSha256",
    "normalizedSha256",
    "archiveCommittedAt",
    "sourceOutcomeEvidenceSha256",
    "archiveIdentitySha256"
  ]), "admission_record.committed_archive");
  assertExactKeys(record.committedArchive.scope,
    new Set(["workspaceId", "operatingProfileId", "representativeId"]),
    "admission_record.committed_archive.scope");
  assertExactKeys(record.legalHold, new Set([
    "state",
    "snapshotIdentitySha256",
    "ledgerSha256",
    "attestationSha256",
    "observedAt",
    "validUntil",
    "authoritative"
  ]), "admission_record.legal_hold");
  assertExactKeys(record.dataAdmission,
    new Set(["dataPolicySha256", "envelope", "sourceSession"]),
    "admission_record.data_admission");
  assertExactKeys(record.dataAdmission.envelope,
    new Set(routeIqProspectiveRetentionEnvelopeKeys),
    "admission_record.data_admission.envelope");
  assertExactKeys(record.dataAdmission.envelope.retentionBoundary,
    new Set(routeIqProspectiveRetentionBoundaryKeys),
    "admission_record.data_admission.retention_boundary");
  assertExactKeys(record.dataAdmission.envelope.retentionBoundary.subject,
    new Set(["workspaceId", "operatingProfileId", "recordClass", "sourceRecordSha256"]),
    "admission_record.data_admission.retention_boundary.subject");
  assertExactKeys(record.dataAdmission.sourceSession,
    new Set(["coordinatorSessionId", "fieldSessionId", "rawSha256"]),
    "admission_record.data_admission.source_session");
}

function validatePureRetentionBoundary(boundary, record) {
  const createdAt = canonicalIso(
    boundary.createdAt,
    "route_iq_prospective_retention_admission_boundary_time_invalid"
  );
  const policyMaximum = canonicalIso(
    boundary.policyMaximumExpiresAt,
    "route_iq_prospective_retention_admission_boundary_time_invalid"
  );
  const expiresAt = canonicalIso(
    boundary.expiresAt,
    "route_iq_prospective_retention_admission_boundary_time_invalid"
  );
  if (boundary.contractVersion !== routeIqProspectiveRetentionBoundaryContractVersion
    || boundary.authorizationState !== "founder_authorized_18_month_maximum"
    || boundary.source !== "authenticated_data_retention_contract"
    || boundary.creationTimeBasis !== "canonical_authoritative_source_record_time"
    || boundary.maximumCalendarMonths !== routeIqRetentionMaximumCalendarMonths
    || boundary.customerAccountId !== record.scope.workspaceId
    || boundary.subject.workspaceId !== record.scope.workspaceId
    || boundary.subject.operatingProfileId !== record.scope.operatingProfileId
    || boundary.subject.recordClass !== "prospective_shadow_evidence"
    || boundary.subject.sourceRecordSha256 !== record.sourceOutcomeEvidenceSha256
    || boundary.policyMaximumExpiresAt !== addRouteIqRetentionCalendarMonths(createdAt.iso)
    || expiresAt.milliseconds > policyMaximum.milliseconds
    || expiresAt.milliseconds <= createdAt.milliseconds) {
    fail("route_iq_prospective_retention_admission_boundary_invalid");
  }
  if (boundary.customerOverrideState === "none") {
    if (boundary.customerContractExpiresAt !== null
      || boundary.customerOverrideAuthority !== null
      || boundary.expiresAt !== boundary.policyMaximumExpiresAt) {
      fail("route_iq_prospective_retention_admission_boundary_invalid");
    }
  } else if (boundary.customerOverrideState === "authenticated_shortening") {
    const customerExpiry = canonicalIso(
      boundary.customerContractExpiresAt,
      "route_iq_prospective_retention_admission_boundary_time_invalid"
    );
    assertExactKeys(boundary.customerOverrideAuthority, new Set([
      "version",
      "authority",
      "authorizationReference",
      "keyVersion",
      "auditEventSha256",
      "signature"
    ]), "admission_record.data_admission.retention_boundary.customer_override_authority");
    if (customerExpiry.milliseconds >= policyMaximum.milliseconds
      || boundary.expiresAt !== customerExpiry.iso) {
      fail("route_iq_prospective_retention_admission_boundary_invalid");
    }
  } else {
    fail("route_iq_prospective_retention_admission_boundary_invalid");
  }
  return { createdAt, policyMaximum, expiresAt };
}

function validateExpectedBinding(record, expected) {
  assertExactKeys(expected, ADMISSION_EXPECTED_KEYS, "admission_expected_binding");
  normalizeScope(expected.scope);
  for (const [value, code] of [
    [expected.providerBindingIdentitySha256, "route_iq_prospective_retention_admission_expected_hash_invalid"],
    [expected.sourceArchiveSessionSha256, "route_iq_prospective_retention_admission_expected_hash_invalid"],
    [expected.sourceArchiveRawSha256, "route_iq_prospective_retention_admission_expected_hash_invalid"],
    [expected.sourceArchiveNormalizedSha256, "route_iq_prospective_retention_admission_expected_hash_invalid"],
    [expected.committedArchiveIdentitySha256, "route_iq_prospective_retention_admission_expected_hash_invalid"],
    [expected.sourceOutcomeEvidenceSha256, "route_iq_prospective_retention_admission_expected_hash_invalid"],
    [expected.evaluationContextSha256, "route_iq_prospective_retention_admission_expected_hash_invalid"],
    [expected.outcomeReceiptRecordSha256, "route_iq_prospective_retention_admission_expected_hash_invalid"],
    [expected.outcomeRecordSha256, "route_iq_prospective_retention_admission_expected_hash_invalid"],
    [expected.policySha256, "route_iq_prospective_retention_admission_expected_hash_invalid"],
    [expected.retentionBoundarySha256, "route_iq_prospective_retention_admission_expected_hash_invalid"],
    [expected.legalHoldSnapshotIdentitySha256, "route_iq_prospective_retention_admission_expected_hash_invalid"],
    [expected.legalHoldLedgerSha256, "route_iq_prospective_retention_admission_expected_hash_invalid"],
    [expected.legalHoldAttestationSha256, "route_iq_prospective_retention_admission_expected_hash_invalid"]
  ]) requireSha256(value, code);
  requireHashId(
    expected.opportunityId,
    HASH_ID_PATTERNS.opportunity,
    "route_iq_prospective_retention_admission_expected_opportunity_invalid"
  );
  requireHashId(
    expected.coordinatorSessionId,
    HASH_ID_PATTERNS.coordinatorSession,
    "route_iq_prospective_retention_admission_expected_coordinator_invalid"
  );
  requireHashId(
    expected.evaluatedCandidateId,
    HASH_ID_PATTERNS.candidate,
    "route_iq_prospective_retention_admission_expected_candidate_invalid"
  );
  requireHashId(
    expected.actionArtifactId,
    HASH_ID_PATTERNS.action,
    "route_iq_prospective_retention_admission_expected_action_invalid"
  );
  requireHashId(
    expected.outcomeReceiptArtifactId,
    HASH_ID_PATTERNS.outcome,
    "route_iq_prospective_retention_admission_expected_outcome_receipt_invalid"
  );
  requireHashId(
    expected.admissionKey,
    HASH_ID_PATTERNS.admission,
    "route_iq_prospective_retention_admission_expected_identity_invalid"
  );
  requireHashId(
    expected.replayKey,
    HASH_ID_PATTERNS.replay,
    "route_iq_prospective_retention_admission_expected_identity_invalid"
  );
  canonicalIso(
    expected.authoritativeOutcomeTime,
    "route_iq_prospective_retention_admission_expected_time_invalid"
  );
  canonicalIso(
    expected.legalHoldObservedAt,
    "route_iq_prospective_retention_admission_expected_time_invalid"
  );
  canonicalIso(
    expected.legalHoldValidUntil,
    "route_iq_prospective_retention_admission_expected_time_invalid"
  );
  const bindingPairs = [
    [record.sourceClassification, expected.sourceClassification],
    [record.providerBindingIdentitySha256, expected.providerBindingIdentitySha256],
    [stableJson(record.scope), stableJson(expected.scope)],
    [record.opportunityId, expected.opportunityId],
    [record.evaluationBinding.evaluationContextSha256, expected.evaluationContextSha256],
    [record.evaluationBinding.evaluatedCandidateId, expected.evaluatedCandidateId],
    [record.evaluationBinding.actionArtifactId, expected.actionArtifactId],
    [record.evaluationBinding.outcomeReceiptArtifactId, expected.outcomeReceiptArtifactId],
    [record.evaluationBinding.outcomeReceiptRecordSha256, expected.outcomeReceiptRecordSha256],
    [record.committedArchive.fieldSessionId, expected.fieldSessionId],
    [record.dataAdmission.sourceSession.coordinatorSessionId, expected.coordinatorSessionId],
    [record.committedArchive.sourceArchiveSessionSha256, expected.sourceArchiveSessionSha256],
    [record.committedArchive.rawSha256, expected.sourceArchiveRawSha256],
    [record.committedArchive.normalizedSha256, expected.sourceArchiveNormalizedSha256],
    [record.committedArchive.archiveIdentitySha256, expected.committedArchiveIdentitySha256],
    [record.sourceOutcomeEvidenceSha256, expected.sourceOutcomeEvidenceSha256],
    [record.authoritativeOutcomeTime, expected.authoritativeOutcomeTime],
    [record.outcomeRecordSha256, expected.outcomeRecordSha256],
    [record.policyVersion, expected.policyVersion],
    [record.policySha256, expected.policySha256],
    [computeRouteIqProspectiveProductionRetentionAdmissionSha256(
      record.dataAdmission.envelope.retentionBoundary
    ), expected.retentionBoundarySha256],
    [record.legalHold.snapshotIdentitySha256, expected.legalHoldSnapshotIdentitySha256],
    [record.legalHold.ledgerSha256, expected.legalHoldLedgerSha256],
    [record.legalHold.attestationSha256, expected.legalHoldAttestationSha256],
    [record.legalHold.observedAt, expected.legalHoldObservedAt],
    [record.legalHold.validUntil, expected.legalHoldValidUntil],
    [record.admissionKey, expected.admissionKey],
    [record.replayKey, expected.replayKey]
  ];
  if (bindingPairs.some(([actual, expectedValue]) => actual !== expectedValue)) {
    fail("route_iq_prospective_retention_admission_expected_binding_mismatch");
  }
}

export function validateRouteIqProspectiveProductionRetentionAdmission(
  record,
  expected,
  options = { serverNow: null, requireAuthoritativeProduction: true }
) {
  validateAdmissionRecordShape(record);
  assertExactKeys(
    options,
    new Set(["serverNow", "requireAuthoritativeProduction"]),
    "admission_validation_options"
  );
  if (typeof options.requireAuthoritativeProduction !== "boolean") {
    fail("route_iq_prospective_retention_admission_validation_options_invalid");
  }
  const serverNow = canonicalIso(
    options.serverNow,
    "route_iq_prospective_retention_admission_server_time_invalid"
  );
  const issuedAt = canonicalIso(
    record.issuedAt,
    "route_iq_prospective_retention_admission_time_invalid"
  );
  const expiresAt = canonicalIso(
    record.expiresAt,
    "route_iq_prospective_retention_admission_time_invalid"
  );
  const authoritativeOutcomeTime = canonicalIso(
    record.authoritativeOutcomeTime,
    "route_iq_prospective_retention_admission_outcome_time_invalid"
  );
  const archiveCommittedAt = canonicalIso(
    record.committedArchive.archiveCommittedAt,
    "route_iq_prospective_retention_admission_archive_time_invalid"
  );
  const legalHoldObservedAt = canonicalIso(
    record.legalHold.observedAt,
    "route_iq_prospective_retention_admission_legal_hold_time_invalid"
  );
  const legalHoldValidUntil = canonicalIso(
    record.legalHold.validUntil,
    "route_iq_prospective_retention_admission_legal_hold_time_invalid"
  );
  const authorityLifetime = expiresAt.milliseconds - issuedAt.milliseconds;
  if (authorityLifetime <= 0
    || authorityLifetime > routeIqProspectiveProductionRetentionAdmissionMaximumAgeMilliseconds
    || issuedAt.milliseconds > serverNow.milliseconds
    || serverNow.milliseconds >= expiresAt.milliseconds
    || serverNow.milliseconds - issuedAt.milliseconds
      > routeIqProspectiveProductionRetentionAdmissionMaximumAgeMilliseconds
    || authoritativeOutcomeTime.milliseconds > issuedAt.milliseconds
    || archiveCommittedAt.milliseconds > authoritativeOutcomeTime.milliseconds) {
    fail("route_iq_prospective_retention_admission_stale_or_future");
  }
  if (legalHoldObservedAt.milliseconds > issuedAt.milliseconds
    || issuedAt.milliseconds - legalHoldObservedAt.milliseconds
      > routeIqRetentionProductionLegalHoldMaximumAgeMilliseconds
    || legalHoldValidUntil.milliseconds <= serverNow.milliseconds) {
    fail("route_iq_prospective_retention_admission_legal_hold_stale_or_future");
  }

  const expectedEnvironment = SOURCE_CLASSIFICATIONS[record.sourceClassification];
  if (!expectedEnvironment
    || record.environment !== expectedEnvironment
    || (options.requireAuthoritativeProduction
      && (record.sourceClassification !== "authoritative_production" || record.environment !== "production"))) {
    fail("route_iq_prospective_retention_admission_classification_invalid");
  }
  normalizeScope(record.scope);
  normalizeScope(record.committedArchive.scope);
  if (stableJson(record.scope) !== stableJson(record.committedArchive.scope)) {
    fail("route_iq_prospective_retention_admission_scope_binding_invalid");
  }
  for (const [value, code] of [
    [record.providerBindingIdentitySha256, "route_iq_prospective_retention_admission_hash_invalid"],
    [record.committedArchive.sourceArchiveSessionSha256, "route_iq_prospective_retention_admission_hash_invalid"],
    [record.committedArchive.rawSha256, "route_iq_prospective_retention_admission_hash_invalid"],
    [record.committedArchive.normalizedSha256, "route_iq_prospective_retention_admission_hash_invalid"],
    [record.committedArchive.sourceOutcomeEvidenceSha256, "route_iq_prospective_retention_admission_hash_invalid"],
    [record.committedArchive.archiveIdentitySha256, "route_iq_prospective_retention_admission_hash_invalid"],
    [record.sourceOutcomeEvidenceSha256, "route_iq_prospective_retention_admission_hash_invalid"],
    [record.evaluationBinding.evaluationContextSha256, "route_iq_prospective_retention_admission_hash_invalid"],
    [record.evaluationBinding.outcomeReceiptRecordSha256, "route_iq_prospective_retention_admission_hash_invalid"],
    [record.outcomeRecordSha256, "route_iq_prospective_retention_admission_hash_invalid"],
    [record.policySha256, "route_iq_prospective_retention_admission_hash_invalid"],
    [record.evidenceIdentitySha256, "route_iq_prospective_retention_admission_hash_invalid"],
    [record.legalHold.snapshotIdentitySha256, "route_iq_prospective_retention_admission_hash_invalid"],
    [record.legalHold.ledgerSha256, "route_iq_prospective_retention_admission_hash_invalid"],
    [record.legalHold.attestationSha256, "route_iq_prospective_retention_admission_hash_invalid"],
    [record.claimsSha256, "route_iq_prospective_retention_admission_hash_invalid"]
  ]) requireSha256(value, code);
  requireHashId(
    record.opportunityId,
    HASH_ID_PATTERNS.opportunity,
    "route_iq_prospective_retention_admission_opportunity_invalid"
  );
  requireHashId(
    record.dataAdmission.sourceSession.coordinatorSessionId,
    HASH_ID_PATTERNS.coordinatorSession,
    "route_iq_prospective_retention_admission_coordinator_session_invalid"
  );
  requireHashId(
    record.evaluationBinding.evaluatedCandidateId,
    HASH_ID_PATTERNS.candidate,
    "route_iq_prospective_retention_admission_candidate_invalid"
  );
  requireHashId(
    record.evaluationBinding.actionArtifactId,
    HASH_ID_PATTERNS.action,
    "route_iq_prospective_retention_admission_action_invalid"
  );
  requireHashId(
    record.evaluationBinding.outcomeReceiptArtifactId,
    HASH_ID_PATTERNS.outcome,
    "route_iq_prospective_retention_admission_outcome_receipt_invalid"
  );
  requireHashId(
    record.admissionKey,
    HASH_ID_PATTERNS.admission,
    "route_iq_prospective_retention_admission_identity_invalid"
  );
  requireHashId(
    record.replayKey,
    HASH_ID_PATTERNS.replay,
    "route_iq_prospective_retention_admission_replay_identity_invalid"
  );
  const claimsBody = Object.fromEntries(
    Object.entries(record).filter(([key]) => key !== "claimsSha256")
  );
  if (record.claimsSha256 !== computeRouteIqProspectiveProductionRetentionAdmissionSha256(claimsBody)) {
    fail("route_iq_prospective_retention_admission_claims_hash_mismatch");
  }

  const archiveBody = Object.fromEntries(
    Object.entries(record.committedArchive).filter(([key]) => key !== "archiveIdentitySha256")
  );
  if (record.committedArchive.archiveIdentitySha256
      !== computeRouteIqProspectiveProductionRetentionAdmissionSha256(archiveBody)
    || record.committedArchive.sourceOutcomeEvidenceSha256 !== record.sourceOutcomeEvidenceSha256) {
    fail("route_iq_prospective_retention_admission_archive_identity_mismatch");
  }
  const boundary = record.dataAdmission.envelope.retentionBoundary;
  const boundaryTimes = validatePureRetentionBoundary(boundary, record);
  if (issuedAt.milliseconds >= boundaryTimes.expiresAt.milliseconds) {
    fail("route_iq_prospective_retention_admission_expired");
  }
  const envelope = record.dataAdmission.envelope;
  const sourceSession = record.dataAdmission.sourceSession;
  if (record.admissionVersion !== routeIqProspectiveProductionRetentionAdmissionVersion
    || record.admissionState !== "RETENTION_ADMITTED"
    || record.authority !== "prometheus_data_retention_admission"
    || record.policyVersion !== routeIqProspectiveRetentionPolicyVersion
    || record.policySha256 !== routeIqProspectiveProductionRetentionPolicySha256
    || record.dataAdmission.dataPolicySha256 !== record.policySha256
    || envelope.policyVersion !== record.policyVersion
    || envelope.collectionState !== record.collectionState
    || envelope.recommendationInfluence !== record.recommendationInfluence
    || envelope.recordOrigin !== record.recordOrigin
    || envelope.workspaceId !== record.scope.workspaceId
    || envelope.operatingProfileId !== record.scope.operatingProfileId
    || envelope.representativeId !== record.scope.representativeId
    || envelope.evaluatedAt !== record.authoritativeOutcomeTime
    || envelope.derivedProjectionExpiresAt !== boundary.expiresAt
    || sourceSession.fieldSessionId !== record.committedArchive.fieldSessionId
    || sourceSession.rawSha256 !== record.committedArchive.rawSha256
    || record.collectionState !== "on"
    || record.recommendationInfluence !== "off"
    || record.recordOrigin !== "prospective"
    || record.legalHold.state !== "none"
    || record.legalHold.authoritative !== true
    || record.representativeOutputAllowed !== false
    || record.recommendationInfluenceAllowed !== false
    || record.productionMutationAuthorized !== false) {
    fail("route_iq_prospective_retention_admission_semantics_invalid");
  }
  const evidenceIdentitySha256 = buildEvidenceIdentity({
    scope: record.scope,
    opportunityId: record.opportunityId,
    fieldSessionId: record.committedArchive.fieldSessionId,
    coordinatorSessionId: sourceSession.coordinatorSessionId,
    evaluationContextSha256: record.evaluationBinding.evaluationContextSha256,
    evaluatedCandidateId: record.evaluationBinding.evaluatedCandidateId,
    actionArtifactId: record.evaluationBinding.actionArtifactId,
    outcomeReceiptArtifactId: record.evaluationBinding.outcomeReceiptArtifactId,
    outcomeReceiptRecordSha256: record.evaluationBinding.outcomeReceiptRecordSha256,
    sourceArchiveSessionSha256: record.committedArchive.sourceArchiveSessionSha256,
    sourceArchiveRawSha256: record.committedArchive.rawSha256,
    sourceOutcomeEvidenceSha256: record.sourceOutcomeEvidenceSha256,
    authoritativeOutcomeTime: record.authoritativeOutcomeTime
  }, record.committedArchive, { outcomeRecordSha256: record.outcomeRecordSha256 });
  if (record.evidenceIdentitySha256 !== evidenceIdentitySha256) {
    fail("route_iq_prospective_retention_admission_evidence_identity_mismatch");
  }
  const expectedReplayKey = `riq_retention_source_${computeRouteIqProspectiveProductionRetentionAdmissionSha256({
    scope: record.scope,
    sourceOutcomeEvidenceSha256: record.sourceOutcomeEvidenceSha256
  })}`;
  const expectedAdmissionKey = `riq_retention_admission_${computeRouteIqProspectiveProductionRetentionAdmissionSha256({
    scope: record.scope,
    opportunityId: record.opportunityId,
    evaluationContextSha256: record.evaluationBinding.evaluationContextSha256,
    evaluatedCandidateId: record.evaluationBinding.evaluatedCandidateId,
    actionArtifactId: record.evaluationBinding.actionArtifactId,
    outcomeReceiptArtifactId: record.evaluationBinding.outcomeReceiptArtifactId,
    outcomeReceiptRecordSha256: record.evaluationBinding.outcomeReceiptRecordSha256,
    sourceOutcomeEvidenceSha256: record.sourceOutcomeEvidenceSha256,
    authoritativeOutcomeTime: record.authoritativeOutcomeTime,
    committedArchiveIdentitySha256: record.committedArchive.archiveIdentitySha256,
    outcomeRecordSha256: record.outcomeRecordSha256,
    evidenceIdentitySha256: record.evidenceIdentitySha256,
    policyVersion: record.policyVersion,
    policySha256: record.policySha256,
    legalHoldSnapshotIdentitySha256: record.legalHold.snapshotIdentitySha256,
    issuedAt: record.issuedAt
  })}`;
  if (record.replayKey !== expectedReplayKey || record.admissionKey !== expectedAdmissionKey) {
    fail("route_iq_prospective_retention_admission_identity_mismatch");
  }
  validateExpectedBinding(record, expected);
  return deepFreeze(clone(record));
}

export function createRouteIqProspectiveProductionRetentionAdmissionAdapter(env = {}) {
  const provider = env?.[routeIqProspectiveProductionRetentionAdmissionBinding];
  return deepFreeze({
    bindingName: routeIqProspectiveProductionRetentionAdmissionBinding,
    available: provider !== null && provider !== undefined,
    async read(input) {
      if (!provider) {
        fail("route_iq_prospective_retention_admission_provider_unavailable", { status: 503 });
      }
      return produceAdmission(input, provider, "authoritative_production");
    }
  });
}

export async function readRouteIqProspectiveProductionRetentionAdmission(input = {}, options = { env: {} }) {
  assertExactKeys(options, new Set(["env"]), "production_admission_options");
  return createRouteIqProspectiveProductionRetentionAdmissionAdapter(options.env).read(input);
}

export async function readRouteIqProspectiveSourceFixtureRetentionAdmission(input = {}, options = {}) {
  assertExactKeys(options, new Set(["provider"]), "source_fixture_admission_options");
  return produceAdmission(input, options.provider, "source_only_fixture");
}
