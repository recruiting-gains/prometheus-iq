import {
  computeRouteIqProspectiveProductionRetentionAdmissionSha256,
  routeIqProspectiveProductionRetentionAdmissionMaximumAgeMilliseconds,
  routeIqProspectiveProductionRetentionAdmissionVersion,
  routeIqProspectiveProductionRetentionPolicySha256,
  validateRouteIqProspectiveProductionRetentionAdmission
} from "../../data/route-iq-field-sessions-v1/route-iq-prospective-production-retention-admission.mjs";
import {
  createRouteIqProspectiveFutureWindowAssignment,
  routeIqProspectiveFutureWindowAuthorityAdmissionVersion as intelligenceFutureWindowAuthorityAdmissionVersion,
  routeIqProspectiveFutureWindowAuthorityEvidenceVersion as intelligenceFutureWindowAuthorityEvidenceVersion,
  routeIqProspectiveFutureWindowAuthorityPurpose as intelligenceFutureWindowAuthorityPurpose,
  routeIqProspectiveFutureWindowPolicyVersion as intelligenceFutureWindowPolicyVersion
} from "../../intelligence/route-iq-prospective-future-window-policy.mjs";
import {
  assertExactKeys,
  canonicalIsoTimestamp,
  failRouteIqProspective,
  isPlainObject,
  requireSha256,
  sha256Hex
} from "./route-iq-prospective-shadow-contract.js";
import {
  createRouteIqProspectiveAuthorityEnvelope,
  createRouteIqProspectiveAuthorityVerifier
} from "./route-iq-prospective-shadow-authority.js";

export const routeIqProspectiveDataRetentionAdmissionVersion =
  "route-iq-prospective-data-retention-admission-v1";
export const routeIqProspectiveFutureWindowAuthorityPurpose =
  intelligenceFutureWindowAuthorityPurpose;
export const routeIqProspectiveFutureWindowPolicyVersion =
  intelligenceFutureWindowPolicyVersion;
export const routeIqProspectiveFutureWindowAuthorityAdmissionVersion =
  intelligenceFutureWindowAuthorityAdmissionVersion;
export const routeIqProspectiveFutureWindowAuthorityEvidenceVersion =
  intelligenceFutureWindowAuthorityEvidenceVersion;
export const ROUTE_IQ_PROSPECTIVE_DATA_RETENTION_ADMISSION_MAX_LIFETIME_SECONDS = 5 * 60;

const LEGACY_CLAIM_KEYS = Object.freeze([
  "purpose",
  "admissionVersion",
  "admissionState",
  "issuedAt",
  "expiresAt",
  "scope",
  "sourceOutcomeEvidenceSha256",
  "sourceArchiveRawSha256",
  "retentionEnvelope"
]);

const SCOPE_KEYS = Object.freeze([
  "workspaceId",
  "operatingProfileId",
  "representativeId"
]);

const PRODUCTION_EXPECTED_KEYS = Object.freeze([
  "providerBindingIdentitySha256",
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
  "sourceArchiveNormalizedSha256",
  "sourceOutcomeEvidenceSha256",
  "authoritativeOutcomeTime"
]);

function sameScope(left, right) {
  return SCOPE_KEYS.every(key => left?.[key] === right?.[key]);
}

function admissionNow(now) {
  const value = now === undefined ? new Date() : now instanceof Date ? now : new Date(now);
  if (Number.isNaN(value.getTime())) {
    failRouteIqProspective(
      "Data retention admission verification time is invalid.",
      "route_iq_prospective_data_retention_admission_time_invalid",
      500
    );
  }
  return { iso: value.toISOString(), milliseconds: value.getTime() };
}

function failAdmission(message, code = "route_iq_prospective_data_retention_admission_invalid") {
  failRouteIqProspective(message, code, 403);
}

function withoutPurpose(claims) {
  return Object.fromEntries(Object.entries(claims).filter(([key]) => key !== "purpose"));
}

function validateFreshAuthority({ issuedAt, expiresAt }, now) {
  canonicalIsoTimestamp(issuedAt, "dataRetentionAdmission.issuedAt", { status: 403 });
  canonicalIsoTimestamp(expiresAt, "dataRetentionAdmission.expiresAt", { status: 403 });
  const issuedAtMs = Date.parse(issuedAt);
  const expiresAtMs = Date.parse(expiresAt);
  const maximumAge = ROUTE_IQ_PROSPECTIVE_DATA_RETENTION_ADMISSION_MAX_LIFETIME_SECONDS * 1000;
  if (issuedAtMs > now.milliseconds
    || now.milliseconds >= expiresAtMs
    || expiresAtMs <= issuedAtMs
    || expiresAtMs - issuedAtMs > maximumAge
    || now.milliseconds - issuedAtMs > maximumAge) {
    failAdmission(
      "Data retention admission is stale, expired, or outside its maximum lifetime.",
      "route_iq_prospective_data_retention_admission_stale"
    );
  }
}

function validateLegacyFixtureClaims(claims, { scope, scoreableOutcome, now }) {
  try {
    assertExactKeys(claims, LEGACY_CLAIM_KEYS, "dataRetentionAdmission.claims");
    assertExactKeys(claims.scope, SCOPE_KEYS, "dataRetentionAdmission.claims.scope");
    requireSha256(claims.sourceOutcomeEvidenceSha256, "dataRetentionAdmission.claims.sourceOutcomeEvidenceSha256");
    requireSha256(claims.sourceArchiveRawSha256, "dataRetentionAdmission.claims.sourceArchiveRawSha256");
  } catch (error) {
    if (error?.code?.startsWith?.("route_iq_prospective_")) throw error;
    failAdmission("Data retention admission claims are invalid.");
  }
  if (claims.admissionVersion !== routeIqProspectiveDataRetentionAdmissionVersion
    || claims.admissionState !== "RETENTION_ADMITTED"
    || !isPlainObject(claims.retentionEnvelope)
    || Object.keys(claims.retentionEnvelope).length === 0
    || !sameScope(claims.scope, scope)
    || claims.sourceOutcomeEvidenceSha256 !== scoreableOutcome?.sourceOutcomeEvidenceSha256
    || claims.sourceArchiveRawSha256 !== scoreableOutcome?.sourceArchiveRawSha256) {
    failAdmission("Data retention admission is not bound to the exact evaluation input.");
  }
  validateFreshAuthority(claims, now);
  return Object.freeze({
    admissionVersion: claims.admissionVersion,
    issuedAt: claims.issuedAt,
    expiresAt: claims.expiresAt,
    scope: Object.freeze({ ...claims.scope }),
    sourceOutcomeEvidenceSha256: claims.sourceOutcomeEvidenceSha256,
    sourceArchiveRawSha256: claims.sourceArchiveRawSha256,
    retentionEnvelope: structuredClone(claims.retentionEnvelope),
    admissionRecord: null
  });
}

function validateProductionExpected(expected) {
  assertExactKeys(expected, PRODUCTION_EXPECTED_KEYS, "dataRetentionAdmission.expected");
  assertExactKeys(expected.scope, SCOPE_KEYS, "dataRetentionAdmission.expected.scope");
  for (const field of [
    "providerBindingIdentitySha256",
    "evaluationContextSha256",
    "outcomeReceiptRecordSha256",
    "sourceArchiveSessionSha256",
    "sourceArchiveRawSha256",
    "sourceArchiveNormalizedSha256",
    "sourceOutcomeEvidenceSha256"
  ]) {
    requireSha256(expected[field], `dataRetentionAdmission.expected.${field}`);
  }
  canonicalIsoTimestamp(
    expected.authoritativeOutcomeTime,
    "dataRetentionAdmission.expected.authoritativeOutcomeTime",
    { status: 403 }
  );
  return expected;
}

function validateExactProductionBindings(record, expected) {
  const binding = record?.evaluationBinding;
  if (!sameScope(record?.scope, expected.scope)
    || record?.providerBindingIdentitySha256 !== expected.providerBindingIdentitySha256
    || record?.opportunityId !== expected.opportunityId
    || record?.committedArchive?.fieldSessionId !== expected.fieldSessionId
    || record?.dataAdmission?.sourceSession?.coordinatorSessionId !== expected.coordinatorSessionId
    || binding?.evaluationContextSha256 !== expected.evaluationContextSha256
    || binding?.evaluatedCandidateId !== expected.evaluatedCandidateId
    || binding?.actionArtifactId !== expected.actionArtifactId
    || binding?.outcomeReceiptArtifactId !== expected.outcomeReceiptArtifactId
    || binding?.outcomeReceiptRecordSha256 !== expected.outcomeReceiptRecordSha256
    || record?.committedArchive?.sourceArchiveSessionSha256 !== expected.sourceArchiveSessionSha256
    || record?.committedArchive?.rawSha256 !== expected.sourceArchiveRawSha256
    || record?.committedArchive?.normalizedSha256 !== expected.sourceArchiveNormalizedSha256
    || record?.sourceOutcomeEvidenceSha256 !== expected.sourceOutcomeEvidenceSha256
    || record?.authoritativeOutcomeTime !== expected.authoritativeOutcomeTime
    || record?.outcomeRecordSha256 !== expected.outcomeReceiptRecordSha256
    || record?.policySha256 !== routeIqProspectiveProductionRetentionPolicySha256) {
    failAdmission("Data retention admission is not bound to the exact evaluation input.");
  }
}

function completeDataExpected(record, expected) {
  return {
    sourceClassification: "authoritative_production",
    providerBindingIdentitySha256: expected.providerBindingIdentitySha256,
    scope: structuredClone(expected.scope),
    opportunityId: expected.opportunityId,
    evaluationContextSha256: expected.evaluationContextSha256,
    evaluatedCandidateId: expected.evaluatedCandidateId,
    actionArtifactId: expected.actionArtifactId,
    outcomeReceiptArtifactId: expected.outcomeReceiptArtifactId,
    outcomeReceiptRecordSha256: expected.outcomeReceiptRecordSha256,
    fieldSessionId: expected.fieldSessionId,
    coordinatorSessionId: expected.coordinatorSessionId,
    sourceArchiveSessionSha256: expected.sourceArchiveSessionSha256,
    sourceArchiveRawSha256: expected.sourceArchiveRawSha256,
    sourceArchiveNormalizedSha256: expected.sourceArchiveNormalizedSha256,
    committedArchiveIdentitySha256: record.committedArchive.archiveIdentitySha256,
    sourceOutcomeEvidenceSha256: expected.sourceOutcomeEvidenceSha256,
    authoritativeOutcomeTime: expected.authoritativeOutcomeTime,
    outcomeRecordSha256: expected.outcomeReceiptRecordSha256,
    policyVersion: record.policyVersion,
    policySha256: routeIqProspectiveProductionRetentionPolicySha256,
    retentionBoundarySha256:
      computeRouteIqProspectiveProductionRetentionAdmissionSha256(
        record.dataAdmission.envelope.retentionBoundary
      ),
    legalHoldSnapshotIdentitySha256: record.legalHold.snapshotIdentitySha256,
    legalHoldLedgerSha256: record.legalHold.ledgerSha256,
    legalHoldAttestationSha256: record.legalHold.attestationSha256,
    legalHoldObservedAt: record.legalHold.observedAt,
    legalHoldValidUntil: record.legalHold.validUntil,
    admissionKey: record.admissionKey,
    replayKey: record.replayKey
  };
}

async function buildFutureWindowAuthorityEvidence(record) {
  const body = {
    evidenceVersion: routeIqProspectiveFutureWindowAuthorityEvidenceVersion,
    purpose: routeIqProspectiveFutureWindowAuthorityPurpose,
    policyVersion: routeIqProspectiveFutureWindowPolicyVersion,
    issuedAt: record.issuedAt,
    expiresAt: record.expiresAt,
    authoritativeServerAnchor: record.issuedAt,
    sourceRecordSha256: record.evidenceIdentitySha256,
    authorityReceiptSha256: record.claimsSha256
  };
  return Object.freeze({ ...body, evidenceSha256: await sha256Hex(body) });
}

function createFutureWindowAuthorityVerifier(env, admittedAt) {
  const verifier = createRouteIqProspectiveAuthorityVerifier(env);
  return Object.freeze({
    async verify(envelope, expected = {}) {
      if (expected.purpose !== routeIqProspectiveFutureWindowAuthorityPurpose
        || expected.policyVersion !== routeIqProspectiveFutureWindowPolicyVersion
        || expected.admissionVersion !== routeIqProspectiveFutureWindowAuthorityAdmissionVersion
        || expected.evidenceVersion !== routeIqProspectiveFutureWindowAuthorityEvidenceVersion) {
        failAdmission("Future-window authority verification contract is invalid.");
      }
      const verified = await verifier.verify(envelope, {
        purpose: routeIqProspectiveFutureWindowAuthorityPurpose,
        channel: "infrastructure"
      });
      return Object.freeze({
        admitted: true,
        admissionVersion: routeIqProspectiveFutureWindowAuthorityAdmissionVersion,
        verificationType: verified.verificationType,
        algorithm: verified.algorithm,
        keyId: verified.keyId,
        admittedAt,
        evidence: structuredClone(verified.claims)
      });
    }
  });
}

async function createFutureWindowAssignment(record, { env, serverNow }) {
  const evidence = await buildFutureWindowAuthorityEvidence(record);
  const authorityEnvelope = await createRouteIqProspectiveAuthorityEnvelope(
    evidence,
    env,
    { channel: "infrastructure" }
  );
  return createRouteIqProspectiveFutureWindowAssignment(
    { authorityEnvelope },
    {
      authorityVerifier: createFutureWindowAuthorityVerifier(env, serverNow),
      serverNow
    }
  );
}

// Data owns retention semantics. Infrastructure authenticates and binds their
// serializable result to the exact server-derived evaluation before transport.
export async function verifyRouteIqProspectiveDataRetentionAdmission(envelope, {
  env,
  expected,
  scope,
  scoreableOutcome,
  now,
  allowNoncanonicalFixture = false
} = {}) {
  let verified;
  try {
    verified = await createRouteIqProspectiveAuthorityVerifier(env).verify(envelope, {
      purpose: "data_retention_admission",
      channel: "producer"
    });
  } catch (error) {
    if (error?.code?.startsWith?.("route_iq_prospective_")) throw error;
    failAdmission("Data retention admission verification failed.");
  }

  const claims = verified.claims;
  const sampledNow = admissionNow(now);
  if (claims?.admissionVersion === routeIqProspectiveDataRetentionAdmissionVersion) {
    if (allowNoncanonicalFixture !== true) {
      failAdmission("Noncanonical Data retention admission is prohibited.");
    }
    const legacy = validateLegacyFixtureClaims(claims, {
      scope,
      scoreableOutcome,
      now: sampledNow
    });
    return Object.freeze({
      verificationType: verified.verificationType,
      keyId: verified.keyId,
      ...legacy
    });
  }

  const productionExpected = validateProductionExpected(expected);
  const record = withoutPurpose(claims);
  validateFreshAuthority(record, sampledNow);
  validateExactProductionBindings(record, productionExpected);
  let admissionRecord;
  try {
    admissionRecord = validateRouteIqProspectiveProductionRetentionAdmission(
      record,
      completeDataExpected(record, productionExpected),
      { serverNow: sampledNow.iso, requireAuthoritativeProduction: true }
    );
  } catch (error) {
    failAdmission(
      "Authoritative Data retention admission verification failed.",
      error?.code || "route_iq_prospective_data_retention_admission_invalid"
    );
  }
  if (admissionRecord.admissionVersion !== routeIqProspectiveProductionRetentionAdmissionVersion
    || admissionRecord.sourceClassification !== "authoritative_production"
    || admissionRecord.environment !== "production"
    || routeIqProspectiveProductionRetentionAdmissionMaximumAgeMilliseconds
      !== ROUTE_IQ_PROSPECTIVE_DATA_RETENTION_ADMISSION_MAX_LIFETIME_SECONDS * 1000) {
    failAdmission("Authoritative Data retention admission classification is invalid.");
  }

  return Object.freeze({
    verificationType: verified.verificationType,
    keyId: verified.keyId,
    admissionVersion: admissionRecord.admissionVersion,
    issuedAt: admissionRecord.issuedAt,
    expiresAt: admissionRecord.expiresAt,
    scope: Object.freeze({ ...admissionRecord.scope }),
    sourceOutcomeEvidenceSha256: admissionRecord.sourceOutcomeEvidenceSha256,
    sourceArchiveRawSha256: admissionRecord.committedArchive.rawSha256,
    retentionEnvelope: Object.freeze({
      dataAdmission: structuredClone(admissionRecord.dataAdmission)
    }),
    admissionRecord
  });
}

export async function verifyAndCreateRouteIqProspectiveRetentionAuthorityEnvelope(
  envelope,
  options = {}
) {
  const sampledNow = admissionNow(options.now);
  const verified = await verifyRouteIqProspectiveDataRetentionAdmission(envelope, {
    ...options,
    now: sampledNow.iso,
    allowNoncanonicalFixture: false
  });
  const futureWindowAssignment = await createFutureWindowAssignment(
    verified.admissionRecord,
    { env: options.env, serverNow: sampledNow.iso }
  );
  return Object.freeze({
    ...verified,
    productionRetentionAdmission: verified.admissionRecord,
    futureWindowAssignment,
    retentionAuthorityEnvelope: envelope
  });
}
