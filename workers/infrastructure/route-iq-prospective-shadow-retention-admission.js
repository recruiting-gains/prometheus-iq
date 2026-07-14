import {
  assertExactKeys,
  canonicalIsoTimestamp,
  failRouteIqProspective,
  isPlainObject,
  requireSha256
} from "./route-iq-prospective-shadow-contract.js";
import { createRouteIqProspectiveAuthorityVerifier } from "./route-iq-prospective-shadow-authority.js";

export const routeIqProspectiveDataRetentionAdmissionVersion =
  "route-iq-prospective-data-retention-admission-v1";
export const ROUTE_IQ_PROSPECTIVE_DATA_RETENTION_ADMISSION_MAX_LIFETIME_SECONDS = 5 * 60;

const CLAIM_KEYS = Object.freeze([
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
  return value.getTime();
}

function failAdmission(message, code = "route_iq_prospective_data_retention_admission_invalid") {
  failRouteIqProspective(message, code, 403);
}

// Data owns the retention-envelope semantics. Infrastructure verifies only the signed transport binding.
export async function verifyRouteIqProspectiveDataRetentionAdmission(envelope, {
  env,
  scope,
  scoreableOutcome,
  now
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
  try {
    assertExactKeys(claims, CLAIM_KEYS, "dataRetentionAdmission.claims");
    assertExactKeys(claims.scope, SCOPE_KEYS, "dataRetentionAdmission.claims.scope");
    canonicalIsoTimestamp(claims.issuedAt, "dataRetentionAdmission.claims.issuedAt", { status: 403 });
    canonicalIsoTimestamp(claims.expiresAt, "dataRetentionAdmission.claims.expiresAt", { status: 403 });
    requireSha256(claims.sourceOutcomeEvidenceSha256, "dataRetentionAdmission.claims.sourceOutcomeEvidenceSha256");
    requireSha256(claims.sourceArchiveRawSha256, "dataRetentionAdmission.claims.sourceArchiveRawSha256");
  } catch (error) {
    if (error?.code?.startsWith?.("route_iq_prospective_")) throw error;
    failAdmission("Data retention admission claims are invalid.");
  }

  const issuedAtMs = Date.parse(claims.issuedAt);
  const expiresAtMs = Date.parse(claims.expiresAt);
  const nowMs = admissionNow(now);
  if (claims.admissionVersion !== routeIqProspectiveDataRetentionAdmissionVersion
    || claims.admissionState !== "RETENTION_ADMITTED"
    || !isPlainObject(claims.retentionEnvelope)
    || Object.keys(claims.retentionEnvelope).length === 0
    || !sameScope(claims.scope, scope)
    || claims.sourceOutcomeEvidenceSha256 !== scoreableOutcome?.sourceOutcomeEvidenceSha256
    || claims.sourceArchiveRawSha256 !== scoreableOutcome?.sourceArchiveRawSha256) {
    failAdmission("Data retention admission is not bound to the exact evaluation input.");
  }
  if (issuedAtMs > nowMs
    || expiresAtMs <= nowMs
    || expiresAtMs <= issuedAtMs
    || expiresAtMs - issuedAtMs > ROUTE_IQ_PROSPECTIVE_DATA_RETENTION_ADMISSION_MAX_LIFETIME_SECONDS * 1000) {
    failAdmission(
      "Data retention admission is stale, expired, or outside its maximum lifetime.",
      "route_iq_prospective_data_retention_admission_stale"
    );
  }

  return Object.freeze({
    verificationType: verified.verificationType,
    keyId: verified.keyId,
    admissionVersion: claims.admissionVersion,
    issuedAt: claims.issuedAt,
    expiresAt: claims.expiresAt,
    scope: Object.freeze({ ...claims.scope }),
    sourceOutcomeEvidenceSha256: claims.sourceOutcomeEvidenceSha256,
    sourceArchiveRawSha256: claims.sourceArchiveRawSha256,
    retentionEnvelope: structuredClone(claims.retentionEnvelope)
  });
}
