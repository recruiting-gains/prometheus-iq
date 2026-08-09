import { createHash } from "node:crypto";

import routeIqProspectiveRetentionPolicy from "../data/route-iq-field-sessions-v1/route-iq-prospective-shadow-retention-policy-v1.json" with {
  type: "json",
};

import {
  evaluateRouteIqProspectiveRetentionEnvelope,
  routeIqProspectiveRetentionBoundaryKeys,
  routeIqProspectiveRetentionBoundaryContractVersion,
  routeIqProspectiveRetentionEnvelopeKeys,
  routeIqProspectiveRetentionPolicyVersion,
} from "../data/route-iq-field-sessions-v1/route-iq-prospective-retention-policy.mjs";
import {
  evaluateRouteIqDeidentifiedAggregateRetention,
  readRouteIqRetentionDeletionStatus,
  routeIqDeidentifiedAggregateAttestationVersion,
  routeIqDeidentifiedAggregateVersion,
  routeIqRetentionMaximumCalendarMonths,
} from "../data/route-iq-field-sessions-v1/route-iq-retention-governance.mjs";

export const routeIqProspectiveIntelligenceRetentionAdmissionVersion =
  "route-iq-prospective-intelligence-retention-admission-v1";
export const routeIqProspectiveRetentionPolicyPath =
  "data/route-iq-field-sessions-v1/route-iq-prospective-shadow-retention-policy-v1.json";
export const routeIqProspectiveRetentionPolicySha256 =
  "a0a60f3ffb693d9fadd2b1637d22fc6f6f035f8fa2533af96dc3a0c1644e1a9f";

const routeIqProspectiveRetentionPolicySnapshot = JSON.stringify(
  routeIqProspectiveRetentionPolicy,
);
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const SESSION_ID_PATTERN =
  /^route-iq-field-session-fitness-connection-fitness-[a-z0-9_-]+-\d{4}-\d{2}-\d{2}$/;
const COORDINATOR_SESSION_ID_PATTERN = /^riq_session_[a-f0-9]{64}$/;
const DISPOSED_SESSION_ID =
  "route-iq-field-session-fitness-connection-fitness-cruz-2026-07-14";
const DISPOSED_RAW_SHA256 =
  "ceb72963ab4e98d6039c1a4a1a409d281bf9e41e6001bd78cca4c04364815765";
const REQUIRED_EXCLUDED_DOMAINS = Object.freeze([
  "learning",
  "readiness",
  "evaluation",
  "representative_performance",
  "territory_metrics",
  "customer_metrics",
  "productivity_counts",
  "dashboards",
  "leaderboards",
  "baselines",
  "calibration",
  "recommendation_inputs",
]);

export class RouteIqProspectiveIntelligenceRetentionError extends Error {
  constructor(code, details = {}) {
    super(code);
    this.name = "RouteIqProspectiveIntelligenceRetentionError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, details = {}) {
  throw new RouteIqProspectiveIntelligenceRetentionError(code, details);
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256")
    .update(typeof value === "string" ? value : canonical(value))
    .digest("hex");
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertExactKeys(value, keys, code) {
  if (!isPlainObject(value)) fail(code);
  const expected = new Set(keys);
  if (
    Object.keys(value).some((key) => !expected.has(key)) ||
    keys.some((key) => !Object.hasOwn(value, key))
  ) {
    fail(code);
  }
}

function canonicalTimestamp(value) {
  if (typeof value !== "string") return null;
  const time = Date.parse(value);
  if (!Number.isFinite(time) || new Date(time).toISOString() !== value) return null;
  return { iso: value, time };
}

export function loadRouteIqProspectiveRetentionPolicy() {
  return JSON.parse(routeIqProspectiveRetentionPolicySnapshot);
}

export function computeRouteIqProspectiveRetentionPolicySha256() {
  return routeIqProspectiveRetentionPolicySha256;
}

export function validateRouteIqProspectiveRetentionPolicy(policy) {
  if (
    policy?.policyVersion !== routeIqProspectiveRetentionPolicyVersion ||
    policy?.batchId !== "BATCH-20260714-004" ||
    policy?.owningSubsystem !== "Prometheus Data" ||
    policy?.status !==
      "founder_authorized_18_month_maximum_source_deletion_runtime_dormant" ||
    policy?.scope?.collectionActivated !== false ||
    policy?.scope?.activeCohorts !== 0 ||
    policy?.scope?.recommendationInfluence !== "off" ||
    policy?.retentionDecision?.maximumCalendarMonths !==
      routeIqRetentionMaximumCalendarMonths ||
    policy?.retentionDecision?.creationTimeBasis !==
      "canonical_authoritative_source_record_time" ||
    policy?.retentionDecision?.customerContractMayShorten !== true ||
    policy?.retentionDecision?.customerContractMayExpand !== false ||
    policy?.retentionDecision?.activationEligible !== false ||
    policy?.canonicality?.allowedRecordOrigin !== "prospective" ||
    canonical(policy?.canonicality?.topLevelEnvelopeExactAllowlist) !==
      canonical(routeIqProspectiveRetentionEnvelopeKeys) ||
    canonical(policy?.canonicality?.retentionBoundaryExactAllowlist) !==
      canonical(routeIqProspectiveRetentionBoundaryKeys) ||
    policy?.canonicality?.syntheticTestDemoFixtureHistoricalBackfillReplayExcluded !==
      true ||
    policy?.expiryAndDeletion?.expiredEvidenceAdmissionAllowed !== false ||
    policy?.expiryAndDeletion?.derivedProjectionMayOutliveSource !== false ||
    policy?.legalHold?.unknownStateBehavior !==
      "fail_closed_no_mutation_or_admission" ||
    policy?.legalHold?.activeHoldMayAuthorizeAnalytics !== false ||
    policy?.aggregateRetention?.indefiniteRetentionAllowed !== true ||
    policy?.aggregateRetention?.artifactHashAndAttestationBindingRequired !== true ||
    policy?.aggregateRetention?.sourceSetAndLegalHoldLedgerBindingRequired !==
      true ||
    policy?.aggregateRetention?.representativeIdentificationAllowed !== false ||
    policy?.aggregateRetention?.customerIdentificationAllowed !== false ||
    policy?.aggregateRetention?.specificVisitIdentificationAllowed !== false ||
    policy?.aggregateRetention?.preciseLocationTrailAllowed !== false ||
    policy?.activationBoundary?.productionConsumerActivated !== false ||
    policy?.activationBoundary?.productionEvidenceRecords !== 0 ||
    policy?.activationBoundary?.deploymentPerformed !== false ||
    policy?.activationBoundary?.productionMutationPerformed !== false
  ) {
    fail("route_iq_retention_policy_semantics_invalid");
  }
  const disposition = policy.administrativeDispositionConsumerBoundary;
  if (
    disposition?.sessionId !== DISPOSED_SESSION_ID ||
    disposition?.rawSha256 !== DISPOSED_RAW_SHA256 ||
    disposition?.state !== "EXCLUDED_FROM_ANALYTICS" ||
    disposition?.reason !== "AUTOMATION_SMOKE_TEST_ACCIDENTAL_FINALIZATION" ||
    disposition?.analyticsLearningReadinessBaselineProductivityAdmissionAllowed !==
      false
  ) {
    fail("route_iq_retention_policy_disposition_invalid");
  }
  return true;
}

function validateDataAuthenticatedSource(sourceSession) {
  assertExactKeys(
    sourceSession,
    ["coordinatorSessionId", "fieldSessionId", "rawSha256"],
    "route_iq_retention_data_source_binding_invalid",
  );
  if (
    !COORDINATOR_SESSION_ID_PATTERN.test(sourceSession.coordinatorSessionId) ||
    !SESSION_ID_PATTERN.test(sourceSession.fieldSessionId) ||
    !SHA256_PATTERN.test(sourceSession.rawSha256)
  ) {
    fail("route_iq_retention_data_source_binding_invalid");
  }
  if (
    sourceSession.fieldSessionId === DISPOSED_SESSION_ID &&
    sourceSession.rawSha256 !== DISPOSED_RAW_SHA256
  ) {
    fail("route_iq_retention_disposed_session_hash_mismatch");
  }
  return sourceSession;
}

function validateDataAdmission(input) {
  assertExactKeys(
    input,
    ["envelope", "sourceSession", "dataPolicySha256"],
    "route_iq_retention_data_admission_invalid",
  );
  assertExactKeys(
    input.envelope,
    routeIqProspectiveRetentionEnvelopeKeys,
    "route_iq_retention_data_envelope_invalid",
  );
  assertExactKeys(
    input.envelope.retentionBoundary,
    routeIqProspectiveRetentionBoundaryKeys,
    "route_iq_retention_data_boundary_invalid",
  );
  if (input.dataPolicySha256 !== computeRouteIqProspectiveRetentionPolicySha256()) {
    fail("route_iq_retention_data_policy_hash_mismatch");
  }
  return {
    envelope: input.envelope,
    sourceSession: validateDataAuthenticatedSource(input.sourceSession),
  };
}

function disposalAudit(sourceSession) {
  if (
    sourceSession.fieldSessionId !== DISPOSED_SESSION_ID &&
    sourceSession.rawSha256 !== DISPOSED_RAW_SHA256
  ) {
    return null;
  }
  return { sourceRawSha256: sourceSession.rawSha256 };
}

export function evaluateRouteIqProspectiveIntelligenceRetentionAdmission(
  input = {},
  { policy = loadRouteIqProspectiveRetentionPolicy(), retentionGovernanceLedger } = {},
) {
  validateRouteIqProspectiveRetentionPolicy(policy);
  assertExactKeys(
    input,
    ["dataAdmission"],
    "route_iq_retention_admission_input_invalid",
  );
  const dataAdmission = validateDataAdmission(input.dataAdmission);
  let dataResult;
  try {
    dataResult = evaluateRouteIqProspectiveRetentionEnvelope(
      dataAdmission.envelope,
      { retentionGovernanceLedger },
    );
  } catch (error) {
    dataResult = {
      eligible: false,
      reasons: [error?.code || "data_retention_admission_unavailable"],
      sourceRecordSha256: null,
      evaluatedAt: null,
    };
  }
  const audit = disposalAudit(dataAdmission.sourceSession);
  let deletionStarted = false;
  if (retentionGovernanceLedger) {
    try {
      deletionStarted = readRouteIqRetentionDeletionStatus(
        retentionGovernanceLedger,
        dataAdmission.envelope.retentionBoundary.subject,
      ).deletionStarted;
    } catch {
      deletionStarted = true;
    }
  }
  const reasonCodes = [
    ...dataResult.reasons,
    ...(audit ? ["administrative_disposition_policy_exclusion"] : []),
    ...(deletionStarted ? ["retention_deletion_started"] : []),
  ];
  const admitted = dataResult.eligible === true && audit === null && !deletionStarted;
  const boundary = dataAdmission.envelope.retentionBoundary;
  const result = {
    admissionVersion: routeIqProspectiveIntelligenceRetentionAdmissionVersion,
    dataPolicyVersion: routeIqProspectiveRetentionPolicyVersion,
    dataPolicySha256: computeRouteIqProspectiveRetentionPolicySha256(),
    state: admitted ? "RETENTION_ADMITTED" : "RETENTION_EXCLUDED",
    admitted,
    reasonCodes: [...new Set(reasonCodes)],
    sourceEvidence: {
      coordinatorSessionSha256: sha256(dataAdmission.sourceSession.coordinatorSessionId),
      fieldSessionSha256: sha256(dataAdmission.sourceSession.fieldSessionId),
      sourceRawSha256: dataAdmission.sourceSession.rawSha256,
      sourceRecordSha256: dataResult.sourceRecordSha256,
      retentionBoundarySha256: sha256(boundary),
    },
    evaluatedAt: dataResult.evaluatedAt,
    retentionBoundary: boundary,
    collectionState: dataAdmission.envelope.collectionState,
    recommendationInfluence: dataAdmission.envelope.recommendationInfluence,
    audit,
    representativeOutputAllowed: false,
    recommendationInfluenceAllowed: false,
    canonicalProductionEvaluationAllowed: admitted,
  };
  return deepFreeze(result);
}

export function requireRouteIqProspectiveIntelligenceRetentionAdmission(
  input,
  options,
) {
  const admission = evaluateRouteIqProspectiveIntelligenceRetentionAdmission(
    input,
    options,
  );
  if (!admission.admitted) {
    fail("route_iq_retention_admission_blocked", {
      reasonCodes: [...admission.reasonCodes],
      audit: admission.audit,
    });
  }
  return admission;
}

export async function evaluateRouteIqIndefiniteAggregateIntelligenceAdmission(
  input = {},
  { authorityVerifier } = {},
) {
  assertExactKeys(
    input,
    ["artifactBytes", "artifactSha256", "attestation", "sourceGovernance"],
    "route_iq_aggregate_admission_input_invalid",
  );
  const result = await evaluateRouteIqDeidentifiedAggregateRetention(input, {
    authorityVerifier,
  });
  if (
    result.state !== "DEIDENTIFIED_AGGREGATE_RETENTION_ELIGIBLE" ||
    result.indefiniteRetentionEligible !== true
  ) {
    fail("route_iq_aggregate_admission_blocked", { reasonCodes: result.reasons });
  }
  return deepFreeze({
    admissionVersion: routeIqProspectiveIntelligenceRetentionAdmissionVersion,
    aggregateArtifactVersion: routeIqDeidentifiedAggregateVersion,
    aggregateAttestationVersion: routeIqDeidentifiedAggregateAttestationVersion,
    dataPolicySha256: computeRouteIqProspectiveRetentionPolicySha256(),
    admitted: true,
    state: "DEIDENTIFIED_AGGREGATE_ADMITTED",
    artifactSha256: result.artifactSha256,
    attestationSha256: result.attestationSha256,
    authorityAuditEventSha256: result.authorityAuditEventSha256,
    sourceSetSha256: result.sourceSetSha256,
    legalHoldLedgerSetSha256: result.legalHoldLedgerSetSha256,
    representativeOutputAllowed: false,
    recommendationInfluenceAllowed: false,
  });
}

export const routeIqProspectiveRetentionExcludedDomains = REQUIRED_EXCLUDED_DOMAINS;
