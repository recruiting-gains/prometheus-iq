import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  routeIqProspectiveRetentionBoundaryContractVersion,
  routeIqProspectiveRetentionPolicyVersion,
} from "../data/route-iq-field-sessions-v1/route-iq-prospective-retention-policy.mjs";
import {
  computeRouteIqProspectiveRetentionPolicySha256,
  evaluateRouteIqProspectiveIntelligenceRetentionAdmission,
  loadRouteIqProspectiveRetentionPolicy,
  routeIqProspectiveIntelligenceRetentionAdmissionVersion,
  routeIqProspectiveRetentionExcludedDomains,
  validateRouteIqProspectiveRetentionPolicy,
} from "../intelligence/route-iq-prospective-retention-admission.mjs";

const digest = (value) =>
  createHash("sha256").update(String(value)).digest("hex");

function envelope(overrides = {}) {
  const base = {
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    representativeId: "cruz",
    collectionState: "on",
    recommendationInfluence: "off",
    recordOrigin: "prospective",
    policyVersion: routeIqProspectiveRetentionPolicyVersion,
    retentionBoundary: {
      contractVersion: routeIqProspectiveRetentionBoundaryContractVersion,
      authorizationState: "authorized_existing_field_session_boundary",
      source: "authenticated_data_retention_contract",
      expiresAt: "2026-08-14T12:00:00.000Z",
    },
    evaluatedAt: "2026-07-14T12:00:00.000Z",
    deletionCapabilityStatus: "verified_not_activated",
    legalHoldState: "none",
    derivedProjectionExpiresAt: "2026-08-14T12:00:00.000Z",
    sourceSession: {
      coordinatorSessionId: `riq_session_${digest("coordinator-session")}`,
      fieldSessionId:
        "route-iq-field-session-fitness-connection-fitness-cruz-2026-07-15",
      rawSha256: digest("canonical-raw"),
      consumptionEligibility: {
        eligible: true,
        state: "NOT_ADMINISTRATIVELY_EXCLUDED",
        reason: null,
        auditOnly: false,
        excludedDomains: [],
      },
    },
  };
  return { ...base, ...overrides };
}

test("canonical Data retention policy is independently validated and hash pinned", () => {
  const policy = loadRouteIqProspectiveRetentionPolicy();
  assert.equal(validateRouteIqProspectiveRetentionPolicy(policy), true);
  assert.match(computeRouteIqProspectiveRetentionPolicySha256(), /^[a-f0-9]{64}$/);
  assert.equal(policy.scope.collectionActivated, false);
  assert.equal(policy.scope.activeCohorts, 0);
  assert.equal(policy.scope.recommendationInfluence, "off");
  assert.equal(policy.retentionDecision.activationEligible, false);
});

test("eligible local contract fixture is deterministic, hash-only, and zero influence", () => {
  const input = envelope();
  const first = evaluateRouteIqProspectiveIntelligenceRetentionAdmission(input);
  const replay = evaluateRouteIqProspectiveIntelligenceRetentionAdmission(
    structuredClone(input),
  );
  assert.deepEqual(replay, first);
  assert.equal(
    first.admissionVersion,
    routeIqProspectiveIntelligenceRetentionAdmissionVersion,
  );
  assert.equal(first.state, "RETENTION_ADMITTED");
  assert.equal(first.admitted, true);
  assert.deepEqual(first.reasonCodes, []);
  assert.equal(first.audit, null);
  assert.equal(first.representativeOutputAllowed, false);
  assert.equal(first.recommendationInfluenceAllowed, false);
  assert.equal(JSON.stringify(first).includes(input.sourceSession.fieldSessionId), false);
  assert.equal(
    JSON.stringify(first).includes(input.sourceSession.coordinatorSessionId),
    false,
  );
});

test("missing, expired, stale, malformed, or unauthorized retention fails closed", () => {
  const cases = [
    ["missing", { retentionBoundary: null }, "retention_boundary_missing"],
    [
      "expired",
      {
        retentionBoundary: {
          ...envelope().retentionBoundary,
          expiresAt: "2026-07-14T12:00:00.000Z",
        },
      },
      "retention_deadline_expired",
    ],
    [
      "stale",
      {
        retentionBoundary: {
          ...envelope().retentionBoundary,
          authorizationState: "stale",
        },
      },
      "retention_boundary_not_authorized",
    ],
    [
      "malformed",
      {
        retentionBoundary: {
          ...envelope().retentionBoundary,
          expiresAt: "not-a-time",
        },
      },
      "retention_deadline_missing_or_invalid",
    ],
    [
      "untrusted",
      {
        retentionBoundary: {
          ...envelope().retentionBoundary,
          source: "caller_assertion",
        },
      },
      "retention_boundary_source_untrusted",
    ],
  ];
  for (const [label, overrides, expectedReason] of cases) {
    const result = evaluateRouteIqProspectiveIntelligenceRetentionAdmission(
      envelope(overrides),
    );
    assert.equal(result.admitted, false, label);
    assert.equal(result.reasonCodes.includes(expectedReason), true, label);
    assert.equal(result.canonicalProductionEvaluationAllowed, false, label);
  }
});

test("noncanonical origins, legal holds, and over-retained projections fail closed", () => {
  const cases = [
    [
      { recordOrigin: "historical" },
      "record_origin_noncanonical",
    ],
    [{ legalHoldState: "unknown" }, "legal_hold_state_unknown"],
    [
      { legalHoldState: "active" },
      "legal_hold_requires_separate_authorized_handling",
    ],
    [
      { deletionCapabilityStatus: "unknown" },
      "retention_deletion_capability_unverified",
    ],
    [
      { derivedProjectionExpiresAt: "2026-08-14T12:00:00.001Z" },
      "derived_projection_outlives_source",
    ],
    [{ collectionState: "off" }, "collection_not_on"],
  ];
  for (const [overrides, expectedReason] of cases) {
    const result = evaluateRouteIqProspectiveIntelligenceRetentionAdmission(
      envelope(overrides),
    );
    assert.equal(result.admitted, false);
    assert.equal(result.reasonCodes.includes(expectedReason), true);
  }
});

test("the exact July 14 disposition is excluded with hash-only audit visibility", () => {
  const dispositionRecordSha256 = digest("disposition-record");
  const result = evaluateRouteIqProspectiveIntelligenceRetentionAdmission(
    envelope({
      sourceSession: {
        coordinatorSessionId: `riq_session_${digest("disposed-session")}`,
        fieldSessionId:
          "route-iq-field-session-fitness-connection-fitness-cruz-2026-07-14",
        rawSha256:
          "ceb72963ab4e98d6039c1a4a1a409d281bf9e41e6001bd78cca4c04364815765",
        consumptionEligibility: {
          eligible: false,
          state: "EXCLUDED_FROM_ANALYTICS",
          reason: "AUTOMATION_SMOKE_TEST_ACCIDENTAL_FINALIZATION",
          auditOnly: true,
          excludedDomains: [...routeIqProspectiveRetentionExcludedDomains],
          dispositionRecordSha256,
        },
      },
    }),
  );
  assert.equal(result.admitted, false);
  assert.equal(
    result.reasonCodes.includes("administrative_disposition_policy_exclusion"),
    true,
  );
  assert.deepEqual(result.audit, {
    sourceRawSha256:
      "ceb72963ab4e98d6039c1a4a1a409d281bf9e41e6001bd78cca4c04364815765",
    dispositionRecordSha256,
  });
  assert.deepEqual(Object.keys(result.audit).sort(), [
    "dispositionRecordSha256",
    "sourceRawSha256",
  ]);
  assert.equal(JSON.stringify(result).includes("originalRecords"), false);
});

test("the disposed session cannot bypass exclusion by omitting its disposition", () => {
  const result = evaluateRouteIqProspectiveIntelligenceRetentionAdmission(
    envelope({
      sourceSession: {
        coordinatorSessionId: `riq_session_${digest("disposed-bypass")}`,
        fieldSessionId:
          "route-iq-field-session-fitness-connection-fitness-cruz-2026-07-14",
        rawSha256:
          "ceb72963ab4e98d6039c1a4a1a409d281bf9e41e6001bd78cca4c04364815765",
        consumptionEligibility: {
          eligible: true,
          state: "NOT_ADMINISTRATIVELY_EXCLUDED",
          reason: null,
          auditOnly: false,
          excludedDomains: [],
        },
      },
    }),
  );
  assert.equal(result.admitted, false);
  assert.equal(
    result.reasonCodes.includes("administrative_disposition_policy_exclusion"),
    true,
  );
});

test("unrelated undisposed sessions are not excluded by zero-visit inference", () => {
  const result = evaluateRouteIqProspectiveIntelligenceRetentionAdmission(
    envelope(),
  );
  assert.equal(result.admitted, true);
  assert.equal(
    result.reasonCodes.includes("administrative_disposition_policy_exclusion"),
    false,
  );
});

test("unknown input fields and tampered Data policy semantics fail closed", () => {
  assert.throws(
    () =>
      evaluateRouteIqProspectiveIntelligenceRetentionAdmission({
        ...envelope(),
        rawNotes: "not allowed",
      }),
    (error) => error?.code === "route_iq_retention_admission_input_invalid",
  );
  const policy = loadRouteIqProspectiveRetentionPolicy();
  policy.activationBoundary.productionConsumerActivated = true;
  assert.throws(
    () => validateRouteIqProspectiveRetentionPolicy(policy),
    (error) => error?.code === "route_iq_retention_policy_semantics_invalid",
  );
});
