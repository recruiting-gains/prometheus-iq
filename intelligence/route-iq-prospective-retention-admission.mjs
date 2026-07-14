import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  evaluateRouteIqProspectiveRetentionEnvelope,
  routeIqProspectiveRetentionBoundaryKeys,
  routeIqProspectiveRetentionBoundaryContractVersion,
  routeIqProspectiveRetentionEnvelopeKeys,
  routeIqProspectiveRetentionPolicyVersion,
} from "../data/route-iq-field-sessions-v1/route-iq-prospective-retention-policy.mjs";

export const routeIqProspectiveIntelligenceRetentionAdmissionVersion =
  "route-iq-prospective-intelligence-retention-admission-v1";
export const routeIqProspectiveRetentionPolicyPath =
  "data/route-iq-field-sessions-v1/route-iq-prospective-shadow-retention-policy-v1.json";

const moduleDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(moduleDir, "..");
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const SESSION_ID_PATTERN =
  /^route-iq-field-session-fitness-connection-fitness-[a-z0-9_-]+-\d{4}-\d{2}-\d{2}$/;
const COORDINATOR_SESSION_ID_PATTERN = /^riq_session_[a-f0-9]{64}$/;
const REPRESENTATIVE_IDS = new Set(["anthony", "cruz"]);
const LEGAL_HOLD_STATES = new Set(["none", "active", "unknown"]);
const DISPOSED_SESSION_ID =
  "route-iq-field-session-fitness-connection-fitness-cruz-2026-07-14";
const DISPOSED_RAW_SHA256 =
  "ceb72963ab4e98d6039c1a4a1a409d281bf9e41e6001bd78cca4c04364815765";
const DISPOSITION_STATE = "EXCLUDED_FROM_ANALYTICS";
const DISPOSITION_REASON = "AUTOMATION_SMOKE_TEST_ACCIDENTAL_FINALIZATION";
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

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
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
  if (!Number.isFinite(time) || new Date(time).toISOString() !== value) {
    return null;
  }
  return { iso: value, time };
}

function arrayEqual(left, right) {
  return canonical(left) === canonical(right);
}

export function loadRouteIqProspectiveRetentionPolicy() {
  return JSON.parse(
    readFileSync(resolve(repoRoot, routeIqProspectiveRetentionPolicyPath), "utf8"),
  );
}

export function computeRouteIqProspectiveRetentionPolicySha256() {
  return sha256(
    readFileSync(resolve(repoRoot, routeIqProspectiveRetentionPolicyPath), "utf8"),
  );
}

export function validateRouteIqProspectiveRetentionPolicy(policy) {
  if (
    policy?.policyVersion !== routeIqProspectiveRetentionPolicyVersion ||
    policy?.owningSubsystem !== "Prometheus Data" ||
    policy?.status !==
      "defined_fail_closed_pending_explicit_retention_boundary" ||
    policy?.scope?.workspaceId !== "fitness_connection" ||
    policy?.scope?.operatingProfileId !== "fitness" ||
    policy?.scope?.opportunityType !== "next_stop" ||
    policy?.scope?.collectionActivated !== false ||
    policy?.scope?.activeCohorts !== 0 ||
    policy?.scope?.recommendationInfluence !== "off" ||
    policy?.retentionDecision?.activationEligible !== false ||
    policy?.retentionDecision?.durationDays !== null ||
    policy?.retentionDecision?.numericDurationSelected !== false ||
    policy?.retentionDecision?.missingBoundaryBehavior !==
      "fail_closed_no_collection" ||
    policy?.canonicality?.allowedRecordOrigin !== "prospective" ||
    !arrayEqual(
      policy?.canonicality?.topLevelEnvelopeExactAllowlist,
      routeIqProspectiveRetentionEnvelopeKeys,
    ) ||
    !arrayEqual(
      policy?.canonicality?.retentionBoundaryExactAllowlist,
      routeIqProspectiveRetentionBoundaryKeys,
    ) ||
    policy?.canonicality?.additionalPropertiesAllowed !== false ||
    policy?.canonicality?.unknownFieldValuesPersistedOrEchoed !== false ||
    policy?.canonicality
      ?.syntheticTestDemoFixtureHistoricalBackfillReplayExcluded !== true ||
    policy?.canonicality?.historicalPromotionAllowed !== false ||
    policy?.canonicality?.identicalReplayReturnsOriginal !== true ||
    policy?.canonicality?.changedReplayCreatesDurableConflict !== true ||
    policy?.expiryAndDeletion?.expiredEvidenceEvaluationAllowed !== false ||
    policy?.expiryAndDeletion?.derivedProjectionMayOutliveSource !== false ||
    policy?.expiryAndDeletion?.unknownExpiryBehavior !== "fail_closed" ||
    policy?.legalHold?.unknownStateBehavior !==
      "fail_closed_no_collection_or_deletion" ||
    policy?.legalHold?.activeHoldMayAuthorizeAnalytics !== false ||
    policy?.activationBoundary?.collectionDefault !== "off" ||
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
    disposition?.originalRecordCount !== 7 ||
    disposition?.state !== DISPOSITION_STATE ||
    disposition?.reason !== DISPOSITION_REASON ||
    disposition?.originalRecordsRemainImmutable !== true ||
    disposition?.auditReadRemainsAvailable !== true ||
    disposition?.analyticsLearningReadinessBaselineProductivityAdmissionAllowed !==
      false
  ) {
    fail("route_iq_retention_policy_disposition_invalid");
  }
  return true;
}

function independentRetentionReasons(input) {
  const reasons = [];
  if (
    input.workspaceId !== "fitness_connection" ||
    input.operatingProfileId !== "fitness"
  ) {
    reasons.push("scope_unauthorized");
  } else if (!REPRESENTATIVE_IDS.has(input.representativeId)) {
    reasons.push("representative_unauthorized");
  }
  if (input.collectionState !== "on") reasons.push("collection_not_on");
  if (input.recommendationInfluence !== "off") {
    reasons.push("recommendation_influence_not_off");
  }
  if (input.recordOrigin !== "prospective") {
    reasons.push("record_origin_noncanonical");
  }
  if (input.policyVersion !== routeIqProspectiveRetentionPolicyVersion) {
    reasons.push("retention_policy_version_invalid");
  }

  const boundary = input.retentionBoundary;
  if (!isPlainObject(boundary)) {
    reasons.push("retention_boundary_missing");
  } else {
    if (
      boundary.contractVersion !==
      routeIqProspectiveRetentionBoundaryContractVersion
    ) {
      reasons.push("retention_boundary_contract_invalid");
    }
    if (
      boundary.authorizationState !==
      "authorized_existing_field_session_boundary"
    ) {
      reasons.push("retention_boundary_not_authorized");
    }
    if (boundary.source !== "authenticated_data_retention_contract") {
      reasons.push("retention_boundary_source_untrusted");
    }
  }

  const evaluatedAt = canonicalTimestamp(input.evaluatedAt);
  const expiresAt = canonicalTimestamp(boundary?.expiresAt);
  if (!evaluatedAt) reasons.push("retention_evaluation_time_invalid");
  if (!expiresAt) reasons.push("retention_deadline_missing_or_invalid");
  if (evaluatedAt && expiresAt && expiresAt.time <= evaluatedAt.time) {
    reasons.push("retention_deadline_expired");
  }
  if (input.deletionCapabilityStatus !== "verified_not_activated") {
    reasons.push("retention_deletion_capability_unverified");
  }
  if (!LEGAL_HOLD_STATES.has(input.legalHoldState)) {
    reasons.push("legal_hold_state_invalid");
  } else if (input.legalHoldState === "unknown") {
    reasons.push("legal_hold_state_unknown");
  } else if (input.legalHoldState === "active") {
    reasons.push("legal_hold_requires_separate_authorized_handling");
  }
  if (
    input.derivedProjectionExpiresAt !== null &&
    input.derivedProjectionExpiresAt !== undefined
  ) {
    const projectionExpiry = canonicalTimestamp(input.derivedProjectionExpiresAt);
    if (!projectionExpiry) {
      reasons.push("derived_projection_deadline_invalid");
    } else if (expiresAt && projectionExpiry.time > expiresAt.time) {
      reasons.push("derived_projection_outlives_source");
    }
  }
  return [...new Set(reasons)];
}

function validateSourceSession(sourceSession) {
  assertExactKeys(
    sourceSession,
    [
      "coordinatorSessionId",
      "fieldSessionId",
      "rawSha256",
      "consumptionEligibility",
    ],
    "route_iq_retention_source_session_invalid",
  );
  if (
    typeof sourceSession.coordinatorSessionId !== "string" ||
    !COORDINATOR_SESSION_ID_PATTERN.test(
      sourceSession.coordinatorSessionId,
    ) ||
    typeof sourceSession.fieldSessionId !== "string" ||
    !SESSION_ID_PATTERN.test(sourceSession.fieldSessionId) ||
    typeof sourceSession.rawSha256 !== "string" ||
    !SHA256_PATTERN.test(sourceSession.rawSha256)
  ) {
    fail("route_iq_retention_source_session_invalid");
  }
  const eligibility = sourceSession.consumptionEligibility;
  if (!isPlainObject(eligibility)) {
    fail("route_iq_retention_source_eligibility_invalid");
  }
  const allowedKeys = new Set([
    "eligible",
    "state",
    "reason",
    "auditOnly",
    "excludedDomains",
    "dispositionRecordSha256",
  ]);
  if (Object.keys(eligibility).some((key) => !allowedKeys.has(key))) {
    fail("route_iq_retention_source_eligibility_invalid");
  }

  const policyDisposedSession =
    sourceSession.fieldSessionId === DISPOSED_SESSION_ID;
  if (policyDisposedSession && sourceSession.rawSha256 !== DISPOSED_RAW_SHA256) {
    fail("route_iq_retention_disposed_session_hash_mismatch");
  }
  if (policyDisposedSession) {
    return {
      admitted: false,
      reason: "administrative_disposition_policy_exclusion",
      audit: {
        sourceRawSha256: sourceSession.rawSha256,
        dispositionRecordSha256:
          typeof eligibility.dispositionRecordSha256 === "string" &&
          SHA256_PATTERN.test(eligibility.dispositionRecordSha256)
            ? eligibility.dispositionRecordSha256
            : null,
      },
    };
  }

  if (eligibility.eligible === false) {
    if (
      eligibility.state !== DISPOSITION_STATE ||
      eligibility.auditOnly !== true ||
      !arrayEqual(eligibility.excludedDomains, REQUIRED_EXCLUDED_DOMAINS) ||
      typeof eligibility.dispositionRecordSha256 !== "string" ||
      !SHA256_PATTERN.test(eligibility.dispositionRecordSha256)
    ) {
      fail("route_iq_retention_source_eligibility_invalid");
    }
    return {
      admitted: false,
      reason: "administratively_disposed_session_excluded",
      audit: {
        sourceRawSha256: sourceSession.rawSha256,
        dispositionRecordSha256: eligibility.dispositionRecordSha256,
      },
    };
  }
  if (
    eligibility.eligible !== true ||
    eligibility.state !== "NOT_ADMINISTRATIVELY_EXCLUDED" ||
    eligibility.reason !== null ||
    eligibility.auditOnly !== false ||
    !Array.isArray(eligibility.excludedDomains) ||
    eligibility.excludedDomains.length !== 0 ||
    Object.hasOwn(eligibility, "dispositionRecordSha256")
  ) {
    fail("route_iq_retention_source_eligibility_invalid");
  }
  return { admitted: true, reason: null, audit: null };
}

export function evaluateRouteIqProspectiveIntelligenceRetentionAdmission(
  input = {},
  { policy = loadRouteIqProspectiveRetentionPolicy() } = {},
) {
  validateRouteIqProspectiveRetentionPolicy(policy);
  assertExactKeys(
    input,
    [
      "workspaceId",
      "operatingProfileId",
      "representativeId",
      "collectionState",
      "recommendationInfluence",
      "recordOrigin",
      "policyVersion",
      "retentionBoundary",
      "evaluatedAt",
      "deletionCapabilityStatus",
      "legalHoldState",
      "derivedProjectionExpiresAt",
      "sourceSession",
    ],
    "route_iq_retention_admission_input_invalid",
  );

  const independentReasons = independentRetentionReasons(input);
  const dataResult = evaluateRouteIqProspectiveRetentionEnvelope({
    policyVersion: input.policyVersion,
    collectionState: input.collectionState,
    recommendationInfluence: input.recommendationInfluence,
    recordOrigin: input.recordOrigin,
    workspaceId: input.workspaceId,
    operatingProfileId: input.operatingProfileId,
    representativeId: input.representativeId,
    evaluatedAt: input.evaluatedAt,
    retentionBoundary: input.retentionBoundary,
    legalHoldState: input.legalHoldState,
    deletionCapabilityStatus: input.deletionCapabilityStatus,
    derivedProjectionExpiresAt: input.derivedProjectionExpiresAt,
  });
  if (
    !arrayEqual([...dataResult.reasons].sort(), [...independentReasons].sort()) ||
    dataResult.eligible !== (independentReasons.length === 0)
  ) {
    fail("route_iq_retention_data_semantic_parity_failed");
  }

  const source = validateSourceSession(input.sourceSession);
  const reasonCodes = [
    ...independentReasons,
    ...(source.reason ? [source.reason] : []),
  ];
  const admitted = reasonCodes.length === 0 && source.admitted;
  const boundary = input.retentionBoundary;
  const result = {
    admissionVersion: routeIqProspectiveIntelligenceRetentionAdmissionVersion,
    dataPolicyVersion: routeIqProspectiveRetentionPolicyVersion,
    dataPolicySha256: computeRouteIqProspectiveRetentionPolicySha256(),
    state: admitted ? "RETENTION_ADMITTED" : "RETENTION_EXCLUDED",
    admitted,
    reasonCodes,
    sourceEvidence: {
      coordinatorSessionSha256: sha256(
        input.sourceSession.coordinatorSessionId,
      ),
      fieldSessionSha256: sha256(input.sourceSession.fieldSessionId),
      sourceRawSha256: input.sourceSession.rawSha256,
      retentionBoundarySha256: isPlainObject(boundary)
        ? sha256(boundary)
        : null,
    },
    evaluatedAt: canonicalTimestamp(input.evaluatedAt)?.iso ?? null,
    expiresAt: canonicalTimestamp(boundary?.expiresAt)?.iso ?? null,
    legalHoldState: LEGAL_HOLD_STATES.has(input.legalHoldState)
      ? input.legalHoldState
      : "unknown",
    collectionState: input.collectionState ?? null,
    recommendationInfluence: input.recommendationInfluence ?? null,
    audit: source.audit,
    representativeOutputAllowed: false,
    recommendationInfluenceAllowed: false,
    canonicalProductionEvaluationAllowed: admitted,
  };
  return deepFreeze(result);
}

export function requireRouteIqProspectiveIntelligenceRetentionAdmission(input) {
  const admission = evaluateRouteIqProspectiveIntelligenceRetentionAdmission(input);
  if (!admission.admitted) {
    fail("route_iq_retention_admission_blocked", {
      reasonCodes: [...admission.reasonCodes],
      audit: admission.audit,
    });
  }
  return admission;
}

export const routeIqProspectiveRetentionExcludedDomains =
  REQUIRED_EXCLUDED_DOMAINS;
