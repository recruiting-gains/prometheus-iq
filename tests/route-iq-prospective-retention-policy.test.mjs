import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  evaluateRouteIqProspectiveRetentionEnvelope,
  routeIqProspectiveRetentionBoundaryContractVersion,
  routeIqProspectiveRetentionBoundaryKeys,
  routeIqProspectiveRetentionCurrentState,
  routeIqProspectiveRetentionEnvelopeKeys,
  routeIqProspectiveRetentionPolicyVersion
} from "../data/route-iq-field-sessions-v1/route-iq-prospective-retention-policy.mjs";

const POLICY_PATH = "data/route-iq-field-sessions-v1/route-iq-prospective-shadow-retention-policy-v1.json";
const CONTRACT_PATH = "overwatch/artifact-contracts/data/fitness-connection-runtime-artifact-contract-v1.json";

function json(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function envelope(overrides = {}) {
  return {
    policyVersion: routeIqProspectiveRetentionPolicyVersion,
    collectionState: "on",
    recommendationInfluence: "off",
    recordOrigin: "prospective",
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    representativeId: "cruz",
    evaluatedAt: "2026-07-14T12:00:00.000Z",
    retentionBoundary: {
      contractVersion: routeIqProspectiveRetentionBoundaryContractVersion,
      authorizationState: "authorized_existing_field_session_boundary",
      source: "authenticated_data_retention_contract",
      expiresAt: "2026-08-14T12:00:00.000Z"
    },
    legalHoldState: "none",
    deletionCapabilityStatus: "verified_not_activated",
    derivedProjectionExpiresAt: "2026-08-14T12:00:00.000Z",
    ...overrides
  };
}

function assertUnknownFieldRejected(input, envelopeLevel) {
  assert.throws(
    () => evaluateRouteIqProspectiveRetentionEnvelope(input),
    error => {
      assert.equal(error.code, "route_iq_prospective_retention_fields_invalid");
      assert.equal(error.message, "Prospective retention input contains unsupported fields.");
      assert.deepEqual(error.details, { envelopeLevel, unknownFieldCount: 1 });
      assert.deepEqual(Object.keys(error.details).sort(), ["envelopeLevel", "unknownFieldCount"]);
      return true;
    }
  );
}

test("Data policy defines a fail-closed retention envelope without selecting or extending a duration", () => {
  const policy = json(POLICY_PATH);
  const contract = json(CONTRACT_PATH);
  const retention = contract.prospectiveShadowEvidenceLifecycleContract.retentionAndCollection;

  assert.equal(policy.policyVersion, routeIqProspectiveRetentionPolicyVersion);
  assert.equal(policy.status, "defined_fail_closed_pending_explicit_retention_boundary");
  assert.equal(routeIqProspectiveRetentionCurrentState, "blocked_pending_explicit_retention_boundary");
  assert.equal(policy.retentionDecision.newRetentionPeriodIntroduced, false);
  assert.equal(policy.retentionDecision.existingRetentionPeriodExtended, false);
  assert.equal(policy.retentionDecision.numericDurationSelected, false);
  assert.equal(policy.retentionDecision.durationDays, null);
  assert.equal(policy.retentionDecision.activationEligible, false);
  assert.equal(policy.expiryAndDeletion.physicalDeletionActivated, false);
  assert.equal(policy.legalHold.implementationStatus, "not_implemented");
  assert.equal(policy.activationBoundary.collectionDefault, "off");
  assert.equal(policy.activationBoundary.productionConsumerActivated, false);
  assert.equal(policy.activationBoundary.productionEvidenceRecords, 0);
  assert.equal(policy.activationBoundary.productionMutationPerformed, false);
  assert.equal(retention.retentionPolicyVersion, policy.policyVersion);
  assert.equal(retention.retentionBoundaryContractVersion, routeIqProspectiveRetentionBoundaryContractVersion);
  assert.equal(retention.activationEligibleUnderRetentionPolicy, false);
});

test("field-level policy uses only governed opaque or structured evidence and prohibits PII expansion", () => {
  const policy = json(POLICY_PATH);
  assert.equal(policy.fieldLevelRetention.length, 5);
  assert.equal(policy.fieldLevelRetention.every(group => group.pii === false), true);
  assert.equal(policy.fieldLevelRetention.every(group => group.retentionBoundary === "governing_field_session"), true);
  for (const prohibited of [
    "names", "email", "phone", "raw_notes", "free_form_text", "audio", "transcripts",
    "addresses", "coordinates", "precise_location", "background_tracking", "cross_workspace_data",
    "cross_representative_data"
  ]) {
    assert.equal(policy.prohibitedCollection.includes(prohibited), true, prohibited);
  }
  assert.equal(policy.auditExceptions.prospectiveIndefiniteRetentionAllowed, false);
  assert.equal(policy.auditExceptions.administrativeDispositionArchiveRetentionExpandedByThisPolicy, false);
  assert.deepEqual(policy.canonicality.topLevelEnvelopeExactAllowlist, routeIqProspectiveRetentionEnvelopeKeys);
  assert.deepEqual(policy.canonicality.retentionBoundaryExactAllowlist, routeIqProspectiveRetentionBoundaryKeys);
  assert.equal(policy.canonicality.additionalPropertiesAllowed, false);
  assert.equal(policy.canonicality.unknownFieldValuesPersistedOrEchoed, false);
});

test("top-level additional fields are rejected before eligibility without echoing names or values", () => {
  const adversarialFields = [
    ["name", "Founder Name"],
    ["address", "123 Private Street"],
    ["notes", "unrestricted free text"],
    ["contact", { email: "private@example.com" }],
    ["rawPayload", { arbitrary: "payload" }],
    ["arbitraryText", "anything"]
  ];

  for (const [key, value] of adversarialFields) {
    assertUnknownFieldRejected({ ...envelope(), [key]: value }, "top_level");
  }
});

test("nested retention-boundary additions are rejected before eligibility and cannot carry PII", () => {
  const adversarialFields = [
    ["name", "Founder Name"],
    ["address", "123 Private Street"],
    ["notes", "unrestricted free text"],
    ["contact", { phone: "555-555-5555" }],
    ["rawPayload", { arbitrary: "payload" }],
    ["arbitraryText", "anything"]
  ];

  for (const [key, value] of adversarialFields) {
    const input = envelope({
      retentionBoundary: { ...envelope().retentionBoundary, [key]: value }
    });
    assertUnknownFieldRejected(input, "retention_boundary");
  }
});

test("current OFF, missing, malformed, expired, and unauthorized envelopes fail closed", () => {
  const cases = [
    [envelope({ collectionState: "off" }), "collection_not_on"],
    [envelope({ retentionBoundary: null }), "retention_boundary_missing"],
    [envelope({ retentionBoundary: { ...envelope().retentionBoundary, expiresAt: "later" } }), "retention_deadline_missing_or_invalid"],
    [envelope({ retentionBoundary: { ...envelope().retentionBoundary, expiresAt: "2026-07-14T12:00:00.000Z" } }), "retention_deadline_expired"],
    [envelope({ legalHoldState: "unknown" }), "legal_hold_state_unknown"],
    [envelope({ legalHoldState: "active" }), "legal_hold_requires_separate_authorized_handling"],
    [envelope({ deletionCapabilityStatus: "unknown" }), "retention_deletion_capability_unverified"],
    [envelope({ workspaceId: "smoothie_depot" }), "scope_unauthorized"],
    [envelope({ representativeId: "unknown" }), "representative_unauthorized"],
    [envelope({ recordOrigin: "synthetic" }), "record_origin_noncanonical"],
    [envelope({ recordOrigin: "historical" }), "record_origin_noncanonical"],
    [envelope({ recommendationInfluence: "on" }), "recommendation_influence_not_off"]
  ];

  for (const [input, reason] of cases) {
    const result = evaluateRouteIqProspectiveRetentionEnvelope(input);
    assert.equal(result.eligible, false, reason);
    assert.equal(result.state, "RETENTION_ENVELOPE_BLOCKED", reason);
    assert.equal(result.reasons.includes(reason), true, reason);
    assert.equal(result.currentProductionActivationAuthorized, false, reason);
  }
});

test("future local fixture accepts only an authenticated existing boundary and source-bounded projection", () => {
  const valid = evaluateRouteIqProspectiveRetentionEnvelope(envelope());
  assert.equal(valid.eligible, true);
  assert.equal(valid.state, "RETENTION_ENVELOPE_VERIFIED");
  assert.equal(valid.expiresAt, "2026-08-14T12:00:00.000Z");
  assert.equal(valid.currentProductionActivationAuthorized, false);

  const untrusted = evaluateRouteIqProspectiveRetentionEnvelope(envelope({
    retentionBoundary: { ...envelope().retentionBoundary, source: "browser" }
  }));
  assert.equal(untrusted.eligible, false);
  assert.equal(untrusted.reasons.includes("retention_boundary_source_untrusted"), true);

  const projectionExpansion = evaluateRouteIqProspectiveRetentionEnvelope(envelope({
    derivedProjectionExpiresAt: "2026-08-15T12:00:00.000Z"
  }));
  assert.equal(projectionExpansion.eligible, false);
  assert.equal(projectionExpansion.reasons.includes("derived_projection_outlives_source"), true);
});

test("administrative disposition remains audit-visible but excluded from every governed consumer class", () => {
  const policy = json(POLICY_PATH);
  const disposition = policy.administrativeDispositionConsumerBoundary;
  assert.equal(disposition.sessionId, "route-iq-field-session-fitness-connection-fitness-cruz-2026-07-14");
  assert.equal(disposition.rawSha256, "ceb72963ab4e98d6039c1a4a1a409d281bf9e41e6001bd78cca4c04364815765");
  assert.equal(disposition.originalRecordCount, 7);
  assert.equal(disposition.originalRecordsRemainImmutable, true);
  assert.equal(disposition.auditReadRemainsAvailable, true);
  assert.equal(disposition.analyticsLearningReadinessBaselineProductivityAdmissionAllowed, false);
});
