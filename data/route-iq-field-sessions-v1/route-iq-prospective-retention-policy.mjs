import {
  FieldSessionArchiveError,
  supportedFieldSessionWorkspaces
} from "./route-iq-field-session-archive.mjs";
import {
  calculateRouteIqRetentionBoundary,
  routeIqRetentionMaximumCalendarMonths
} from "./route-iq-retention-governance.mjs";

export const routeIqProspectiveRetentionPolicyVersion = "route-iq-prospective-shadow-retention-policy-v1";
export const routeIqProspectiveRetentionBoundaryContractVersion = "route-iq-field-session-retention-boundary-v2";
export const routeIqProspectiveRetentionCurrentState = "founder_retention_authorized_runtime_deletion_still_inactive";
export const routeIqProspectiveRetentionEnvelopeKeys = Object.freeze([
  "policyVersion",
  "collectionState",
  "recommendationInfluence",
  "recordOrigin",
  "workspaceId",
  "operatingProfileId",
  "representativeId",
  "evaluatedAt",
  "retentionBoundary",
  "legalHoldState",
  "legalHoldLedgerSha256",
  "deletionCapabilityStatus",
  "derivedProjectionExpiresAt"
]);
export const routeIqProspectiveRetentionBoundaryKeys = Object.freeze([
  "contractVersion",
  "authorizationState",
  "source",
  "creationTimeBasis",
  "createdAt",
  "maximumCalendarMonths",
  "policyMaximumExpiresAt",
  "customerOverrideState",
  "customerContractExpiresAt",
  "expiresAt"
]);

const CANONICAL_RECORD_ORIGIN = "prospective";
const LEGAL_HOLD_STATES = new Set(["none", "active", "unknown"]);
const ENVELOPE_KEY_SET = new Set(routeIqProspectiveRetentionEnvelopeKeys);
const BOUNDARY_KEY_SET = new Set(routeIqProspectiveRetentionBoundaryKeys);

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function canonicalIso(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) return null;
  return { iso: value, milliseconds: parsed };
}

export class RouteIqProspectiveRetentionPolicyError extends FieldSessionArchiveError {
  constructor(message, { code = "route_iq_prospective_retention_policy_invalid", details = {} } = {}) {
    super(message, { code, status: 422, details });
    this.name = "RouteIqProspectiveRetentionPolicyError";
  }
}

function assertExactKeys(value, allowedKeys, envelopeLevel) {
  const unknownFieldCount = Reflect.ownKeys(value)
    .filter(key => typeof key !== "string" || !allowedKeys.has(key))
    .length;
  if (unknownFieldCount > 0) {
    throw new RouteIqProspectiveRetentionPolicyError("Prospective retention input contains unsupported fields.", {
      code: "route_iq_prospective_retention_fields_invalid",
      details: { envelopeLevel, unknownFieldCount }
    });
  }
}

function scopeReason(input) {
  const workspace = supportedFieldSessionWorkspaces[input.workspaceId];
  if (!workspace || workspace.operatingProfileId !== input.operatingProfileId) return "scope_unauthorized";
  if (!workspace.representativeIds.includes(input.representativeId)) return "representative_unauthorized";
  return null;
}

export function evaluateRouteIqProspectiveRetentionEnvelope(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new RouteIqProspectiveRetentionPolicyError("A prospective retention envelope is required.");
  }
  assertExactKeys(input, ENVELOPE_KEY_SET, "top_level");
  if (input.retentionBoundary && typeof input.retentionBoundary === "object" && !Array.isArray(input.retentionBoundary)) {
    assertExactKeys(input.retentionBoundary, BOUNDARY_KEY_SET, "retention_boundary");
  }

  const reasons = [];
  const missingEnvelopeFieldCount = routeIqProspectiveRetentionEnvelopeKeys
    .filter(key => !Object.hasOwn(input, key))
    .length;
  if (missingEnvelopeFieldCount > 0) reasons.push("retention_envelope_fields_missing");
  const scopeFailure = scopeReason(input);
  if (scopeFailure) reasons.push(scopeFailure);
  if (input.collectionState !== "on") reasons.push("collection_not_on");
  if (input.recommendationInfluence !== "off") reasons.push("recommendation_influence_not_off");
  if (input.recordOrigin !== CANONICAL_RECORD_ORIGIN) reasons.push("record_origin_noncanonical");
  if (input.policyVersion !== routeIqProspectiveRetentionPolicyVersion) reasons.push("retention_policy_version_invalid");

  const boundary = input.retentionBoundary;
  if (!boundary || typeof boundary !== "object" || Array.isArray(boundary)) {
    reasons.push("retention_boundary_missing");
  } else {
    const missingBoundaryFieldCount = routeIqProspectiveRetentionBoundaryKeys
      .filter(key => !Object.hasOwn(boundary, key))
      .length;
    if (missingBoundaryFieldCount > 0) reasons.push("retention_boundary_fields_missing");
    if (boundary.contractVersion !== routeIqProspectiveRetentionBoundaryContractVersion) {
      reasons.push("retention_boundary_contract_invalid");
    }
    if (boundary.authorizationState !== "founder_authorized_18_month_maximum") {
      reasons.push("retention_boundary_not_authorized");
    }
    if (boundary.source !== "authenticated_data_retention_contract") {
      reasons.push("retention_boundary_source_untrusted");
    }
    if (boundary.creationTimeBasis !== "canonical_authoritative_server_record_time") {
      reasons.push("retention_creation_time_basis_invalid");
    }
    if (boundary.maximumCalendarMonths !== routeIqRetentionMaximumCalendarMonths) {
      reasons.push("retention_maximum_months_invalid");
    }
  }

  const evaluatedAt = canonicalIso(input.evaluatedAt);
  const createdAt = canonicalIso(boundary?.createdAt);
  const policyMaximumExpiresAt = canonicalIso(boundary?.policyMaximumExpiresAt);
  const expiresAt = canonicalIso(boundary?.expiresAt);
  if (!evaluatedAt) reasons.push("retention_evaluation_time_invalid");
  if (!createdAt) reasons.push("retention_creation_time_invalid");
  if (!policyMaximumExpiresAt) reasons.push("retention_policy_maximum_deadline_invalid");
  if (!expiresAt) reasons.push("retention_deadline_missing_or_invalid");
  if (createdAt && evaluatedAt && evaluatedAt.milliseconds < createdAt.milliseconds) {
    reasons.push("retention_evaluation_precedes_creation");
  }
  if (createdAt && policyMaximumExpiresAt && expiresAt) {
    try {
      const expectedBoundary = calculateRouteIqRetentionBoundary({
        createdAt: createdAt.iso,
        customerContractExpiresAt: boundary.customerContractExpiresAt ?? null
      });
      if (boundary.policyMaximumExpiresAt !== expectedBoundary.policyMaximumExpiresAt) {
        reasons.push("retention_policy_maximum_deadline_mismatch");
      }
      if (boundary.customerOverrideState !== expectedBoundary.customerOverrideState) {
        reasons.push("retention_customer_override_state_mismatch");
      }
      if ((boundary.customerContractExpiresAt ?? null) !== expectedBoundary.customerContractExpiresAt) {
        reasons.push("retention_customer_override_deadline_mismatch");
      }
      if (boundary.expiresAt !== expectedBoundary.expiresAt) {
        reasons.push("retention_effective_deadline_mismatch");
      }
    } catch (error) {
      reasons.push(error?.code || "retention_boundary_calculation_invalid");
    }
  }
  if (evaluatedAt && expiresAt && expiresAt.milliseconds <= evaluatedAt.milliseconds) {
    reasons.push("retention_deadline_expired");
  }

  if (input.deletionCapabilityStatus !== "local_governance_verified_runtime_not_deployed") {
    reasons.push("retention_deletion_capability_unverified");
  }
  if (!LEGAL_HOLD_STATES.has(input.legalHoldState)) {
    reasons.push("legal_hold_state_invalid");
  } else if (input.legalHoldState === "unknown") {
    reasons.push("legal_hold_state_unknown");
  }
  if (typeof input.legalHoldLedgerSha256 !== "string" || !/^[a-f0-9]{64}$/.test(input.legalHoldLedgerSha256)) {
    reasons.push("legal_hold_ledger_hash_invalid");
  }

  if (input.derivedProjectionExpiresAt !== null && input.derivedProjectionExpiresAt !== undefined) {
    const projectionExpiry = canonicalIso(input.derivedProjectionExpiresAt);
    if (!projectionExpiry) {
      reasons.push("derived_projection_deadline_invalid");
    } else if (expiresAt && projectionExpiry.milliseconds > expiresAt.milliseconds) {
      reasons.push("derived_projection_outlives_source");
    }
  }

  const uniqueReasons = [...new Set(reasons)];
  return deepFreeze({
    policyVersion: routeIqProspectiveRetentionPolicyVersion,
    eligible: uniqueReasons.length === 0,
    state: uniqueReasons.length === 0 ? "RETENTION_ENVELOPE_VERIFIED" : "RETENTION_ENVELOPE_BLOCKED",
    reasons: uniqueReasons,
    scope: {
      workspaceId: input.workspaceId ?? null,
      operatingProfileId: input.operatingProfileId ?? null,
      representativeId: input.representativeId ?? null
    },
    collectionState: input.collectionState ?? null,
    recommendationInfluence: input.recommendationInfluence ?? null,
    recordOrigin: input.recordOrigin ?? null,
    createdAt: createdAt?.iso ?? null,
    policyMaximumExpiresAt: policyMaximumExpiresAt?.iso ?? null,
    customerOverrideState: boundary?.customerOverrideState ?? null,
    customerContractExpiresAt: canonicalIso(boundary?.customerContractExpiresAt)?.iso ?? null,
    expiresAt: expiresAt?.iso ?? null,
    evaluatedAt: evaluatedAt?.iso ?? null,
    legalHoldState: LEGAL_HOLD_STATES.has(input.legalHoldState) ? input.legalHoldState : "unknown",
    legalHoldLedgerSha256: typeof input.legalHoldLedgerSha256 === "string" && /^[a-f0-9]{64}$/.test(input.legalHoldLedgerSha256)
      ? input.legalHoldLedgerSha256
      : null,
    deletionPausedByLegalHold: input.legalHoldState === "active",
    deletionCapabilityStatus: input.deletionCapabilityStatus ?? null,
    currentProductionActivationAuthorized: false
  });
}
