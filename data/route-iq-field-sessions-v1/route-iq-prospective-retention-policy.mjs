import {
  FieldSessionArchiveError,
  supportedFieldSessionWorkspaces
} from "./route-iq-field-session-archive.mjs";
import {
  calculateRouteIqRetentionBoundary,
  readRouteIqRetentionLegalHoldSnapshot,
  routeIqRetentionMaximumCalendarMonths,
  validateRouteIqRetentionBoundaryForLedger
} from "./route-iq-retention-governance.mjs";

export const routeIqProspectiveRetentionPolicyVersion = "route-iq-prospective-shadow-retention-policy-v1";
export const routeIqProspectiveRetentionBoundaryContractVersion = "route-iq-field-session-retention-boundary-v3";
export const routeIqProspectiveRetentionCurrentState = "founder_retention_authorized_source_deletion_runtime_dormant_not_deployed";
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
  "derivedProjectionExpiresAt"
]);
export const routeIqProspectiveRetentionBoundaryKeys = Object.freeze([
  "contractVersion",
  "authorizationState",
  "source",
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

const ENVELOPE_KEY_SET = new Set(routeIqProspectiveRetentionEnvelopeKeys);
const BOUNDARY_KEY_SET = new Set(routeIqProspectiveRetentionBoundaryKeys);

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function canonicalIso(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return null;
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) return null;
  return { iso: value, milliseconds };
}

export class RouteIqProspectiveRetentionPolicyError extends FieldSessionArchiveError {
  constructor(message, { code = "route_iq_prospective_retention_policy_invalid", details = {} } = {}) {
    super(message, { code, status: 422, details });
    this.name = "RouteIqProspectiveRetentionPolicyError";
  }
}

function assertExactKeys(value, allowedKeys, envelopeLevel) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RouteIqProspectiveRetentionPolicyError("Prospective retention input has an invalid structure.", {
      code: "route_iq_prospective_retention_structure_invalid",
      details: { envelopeLevel }
    });
  }
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

function boundaryRecord(boundary) {
  return {
    subject: boundary.subject,
    customerAccountId: boundary.customerAccountId,
    creationTimeBasis: boundary.creationTimeBasis,
    createdAt: boundary.createdAt,
    maximumCalendarMonths: boundary.maximumCalendarMonths,
    policyMaximumExpiresAt: boundary.policyMaximumExpiresAt,
    customerOverrideState: boundary.customerOverrideState,
    customerContractExpiresAt: boundary.customerContractExpiresAt,
    customerOverrideAuthority: boundary.customerOverrideAuthority,
    expiresAt: boundary.expiresAt
  };
}

export function evaluateRouteIqProspectiveRetentionEnvelope(input = {}, options = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new RouteIqProspectiveRetentionPolicyError("A prospective retention envelope is required.");
  }
  assertExactKeys(input, ENVELOPE_KEY_SET, "top_level");
  assertExactKeys(options, new Set(["retentionGovernanceLedger"]), "options");
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
  if (input.recordOrigin !== "prospective") reasons.push("record_origin_noncanonical");
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
    if (boundary.creationTimeBasis !== "canonical_authoritative_source_record_time") {
      reasons.push("retention_creation_time_basis_invalid");
    }
    if (boundary.maximumCalendarMonths !== routeIqRetentionMaximumCalendarMonths) {
      reasons.push("retention_maximum_months_invalid");
    }
    if (boundary.subject?.workspaceId !== input.workspaceId
      || boundary.subject?.operatingProfileId !== input.operatingProfileId
      || boundary.subject?.recordClass !== "prospective_shadow_evidence") {
      reasons.push("retention_boundary_subject_invalid");
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

  let verifiedBoundary = null;
  if (boundary && createdAt && policyMaximumExpiresAt && expiresAt) {
    try {
      verifiedBoundary = options.retentionGovernanceLedger
        ? validateRouteIqRetentionBoundaryForLedger(
          boundaryRecord(boundary),
          options.retentionGovernanceLedger,
          boundary.subject
        )
        : calculateRouteIqRetentionBoundary({
          subject: boundary.subject,
          customerAccountId: boundary.customerAccountId,
          createdAt: createdAt.iso,
          customerContractExpiresAt: boundary.customerContractExpiresAt,
          customerOverrideAuthority: boundary.customerOverrideAuthority
        });
      const canonicalBoundary = {
        contractVersion: boundary.contractVersion,
        authorizationState: boundary.authorizationState,
        source: boundary.source,
        ...verifiedBoundary
      };
      if (stableJson(canonicalBoundary) !== stableJson(boundary)) {
        reasons.push("retention_boundary_mismatch");
      }
    } catch (error) {
      reasons.push(error?.code === "route_iq_retention_boundary_mismatch"
        ? "retention_boundary_mismatch"
        : error?.code || "retention_boundary_calculation_invalid");
    }
  }
  if (evaluatedAt && expiresAt && evaluatedAt.milliseconds >= expiresAt.milliseconds) {
    reasons.push("retention_deadline_expired");
  }

  let legalHoldSnapshot = {
    state: "unknown",
    ledgerSha256: null,
    authoritative: false,
    subjectBound: false
  };
  if (!options.retentionGovernanceLedger || !boundary?.subject || !evaluatedAt) {
    reasons.push("legal_hold_state_unknown");
  } else {
    try {
      legalHoldSnapshot = readRouteIqRetentionLegalHoldSnapshot(
        options.retentionGovernanceLedger,
        boundary.subject,
        evaluatedAt.iso
      );
      if (legalHoldSnapshot.state === "active") reasons.push("legal_hold_active");
    } catch {
      reasons.push("legal_hold_state_unknown");
    }
  }

  if (input.derivedProjectionExpiresAt !== null) {
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
    sourceRecordSha256: verifiedBoundary?.subject.sourceRecordSha256 ?? null,
    createdAt: createdAt?.iso ?? null,
    policyMaximumExpiresAt: policyMaximumExpiresAt?.iso ?? null,
    customerOverrideState: verifiedBoundary?.customerOverrideState ?? null,
    customerContractExpiresAt: verifiedBoundary?.customerContractExpiresAt ?? null,
    expiresAt: expiresAt?.iso ?? null,
    expiryExclusive: true,
    evaluatedAt: evaluatedAt?.iso ?? null,
    legalHoldState: legalHoldSnapshot.state,
    legalHoldLedgerSha256: legalHoldSnapshot.ledgerSha256,
    deletionPausedByLegalHold: legalHoldSnapshot.state === "active",
    deletionCapabilityStatus: "runtime_not_deployed",
    currentProductionActivationAuthorized: false
  });
}
