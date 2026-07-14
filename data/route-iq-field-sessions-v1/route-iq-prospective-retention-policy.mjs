import {
  FieldSessionArchiveError,
  supportedFieldSessionWorkspaces
} from "./route-iq-field-session-archive.mjs";

export const routeIqProspectiveRetentionPolicyVersion = "route-iq-prospective-shadow-retention-policy-v1";
export const routeIqProspectiveRetentionBoundaryContractVersion = "route-iq-field-session-retention-boundary-v1";
export const routeIqProspectiveRetentionCurrentState = "blocked_pending_explicit_retention_boundary";
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
  "deletionCapabilityStatus",
  "derivedProjectionExpiresAt"
]);
export const routeIqProspectiveRetentionBoundaryKeys = Object.freeze([
  "contractVersion",
  "authorizationState",
  "source",
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
    if (boundary.contractVersion !== routeIqProspectiveRetentionBoundaryContractVersion) {
      reasons.push("retention_boundary_contract_invalid");
    }
    if (boundary.authorizationState !== "authorized_existing_field_session_boundary") {
      reasons.push("retention_boundary_not_authorized");
    }
    if (boundary.source !== "authenticated_data_retention_contract") {
      reasons.push("retention_boundary_source_untrusted");
    }
  }

  const evaluatedAt = canonicalIso(input.evaluatedAt);
  const expiresAt = canonicalIso(boundary?.expiresAt);
  if (!evaluatedAt) reasons.push("retention_evaluation_time_invalid");
  if (!expiresAt) reasons.push("retention_deadline_missing_or_invalid");
  if (evaluatedAt && expiresAt && expiresAt.milliseconds <= evaluatedAt.milliseconds) {
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
    expiresAt: expiresAt?.iso ?? null,
    evaluatedAt: evaluatedAt?.iso ?? null,
    legalHoldState: LEGAL_HOLD_STATES.has(input.legalHoldState) ? input.legalHoldState : "unknown",
    deletionCapabilityStatus: input.deletionCapabilityStatus ?? null,
    currentProductionActivationAuthorized: false
  });
}
