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
import {
  addRouteIqRetentionCalendarMonths,
  calculateRouteIqRetentionBoundary,
  createRouteIqRetentionLegalHoldEvent,
  evaluateRouteIqDeidentifiedAggregateRetention,
  evaluateRouteIqRetentionOperation,
  routeIqRetentionEmptyLegalHoldLedgerSha256,
  routeIqRetentionGovernanceEventVersion,
  routeIqRetentionMaximumCalendarMonths,
  routeIqRetentionOperationAuthorizationVersion,
  summarizeRouteIqRetentionLegalHold
} from "../data/route-iq-field-sessions-v1/route-iq-retention-governance.mjs";

const POLICY_PATH = "data/route-iq-field-sessions-v1/route-iq-prospective-shadow-retention-policy-v1.json";
const CONTRACT_PATH = "overwatch/artifact-contracts/data/fitness-connection-runtime-artifact-contract-v1.json";
const AUTH_REFERENCE = `riq_retention_auth_${"a".repeat(64)}`;
const SUBJECT = Object.freeze({
  workspaceId: "fitness_connection",
  operatingProfileId: "fitness",
  recordClass: "prospective_shadow_evidence",
  sourceRecordSha256: "b".repeat(64)
});

function json(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function envelope(overrides = {}) {
  const createdAt = "2026-07-14T12:00:00.000Z";
  const boundary = calculateRouteIqRetentionBoundary({ createdAt, customerContractExpiresAt: null });
  return {
    policyVersion: routeIqProspectiveRetentionPolicyVersion,
    collectionState: "on",
    recommendationInfluence: "off",
    recordOrigin: "prospective",
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    representativeId: "cruz",
    evaluatedAt: "2026-07-14T12:00:01.000Z",
    retentionBoundary: {
      contractVersion: routeIqProspectiveRetentionBoundaryContractVersion,
      authorizationState: "founder_authorized_18_month_maximum",
      source: "authenticated_data_retention_contract",
      ...boundary
    },
    legalHoldState: "none",
    legalHoldLedgerSha256: routeIqRetentionEmptyLegalHoldLedgerSha256,
    deletionCapabilityStatus: "local_governance_verified_runtime_not_deployed",
    derivedProjectionExpiresAt: boundary.expiresAt,
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

test("Data policy records the Founder-authorized 18-month maximum while activation stays off", () => {
  const policy = json(POLICY_PATH);
  const contract = json(CONTRACT_PATH);
  const retention = contract.prospectiveShadowEvidenceLifecycleContract.retentionAndCollection;

  assert.equal(policy.policyVersion, routeIqProspectiveRetentionPolicyVersion);
  assert.equal(policy.batchId, "BATCH-20260714-004");
  assert.equal(policy.status, "founder_authorized_18_month_maximum_runtime_deletion_inactive");
  assert.equal(routeIqProspectiveRetentionCurrentState, "founder_retention_authorized_runtime_deletion_still_inactive");
  assert.equal(policy.retentionDecision.numericDurationSelected, true);
  assert.equal(policy.retentionDecision.maximumCalendarMonths, 18);
  assert.equal(policy.retentionDecision.durationDays, null);
  assert.equal(policy.retentionDecision.customerContractMayShorten, true);
  assert.equal(policy.retentionDecision.customerContractMayExpand, false);
  assert.equal(policy.retentionDecision.activationEligible, false);
  assert.equal(policy.expiryAndDeletion.physicalDeletionActivated, false);
  assert.equal(policy.legalHold.implementationStatus, "local_append_only_state_machine_verified_runtime_not_deployed");
  assert.equal(policy.activationBoundary.collectionDefault, "off");
  assert.equal(policy.activationBoundary.productionConsumerActivated, false);
  assert.equal(policy.activationBoundary.productionEvidenceRecords, 0);
  assert.equal(policy.activationBoundary.productionMutationPerformed, false);
  assert.equal(policy.activationBoundary.founderRetentionDecisionStillRequired, false);
  assert.equal(retention.retentionPolicyVersion, policy.policyVersion);
  assert.equal(retention.retentionBoundaryContractVersion, routeIqProspectiveRetentionBoundaryContractVersion);
  assert.equal(retention.maximumRetentionCalendarMonths, 18);
  assert.equal(retention.activationEligibleUnderRetentionPolicy, false);
});

test("18 calendar months uses canonical UTC time and clamps month-end deterministically", () => {
  assert.equal(routeIqRetentionMaximumCalendarMonths, 18);
  assert.equal(
    addRouteIqRetentionCalendarMonths("2026-08-31T23:59:59.999Z"),
    "2028-02-29T23:59:59.999Z"
  );
  assert.equal(
    addRouteIqRetentionCalendarMonths("2027-08-31T05:04:03.002Z"),
    "2029-02-28T05:04:03.002Z"
  );
  assert.equal(
    addRouteIqRetentionCalendarMonths("2024-02-29T12:30:00.000Z"),
    "2025-08-29T12:30:00.000Z"
  );
  assert.throws(
    () => addRouteIqRetentionCalendarMonths("2026-07-14T07:00:00-05:00"),
    error => error.code === "route_iq_retention_time_invalid"
  );
});

test("customer contracts may strictly shorten but never equal or expand the Founder maximum", () => {
  const full = calculateRouteIqRetentionBoundary({
    createdAt: "2026-07-14T12:00:00.000Z",
    customerContractExpiresAt: null
  });
  assert.equal(full.policyMaximumExpiresAt, "2028-01-14T12:00:00.000Z");
  assert.equal(full.expiresAt, full.policyMaximumExpiresAt);
  assert.equal(full.customerOverrideState, "none");

  const shortened = calculateRouteIqRetentionBoundary({
    createdAt: "2026-07-14T12:00:00.000Z",
    customerContractExpiresAt: "2027-01-14T12:00:00.000Z"
  });
  assert.equal(shortened.customerOverrideState, "shortened");
  assert.equal(shortened.expiresAt, "2027-01-14T12:00:00.000Z");

  for (const customerContractExpiresAt of [
    "2028-01-14T12:00:00.000Z",
    "2028-01-14T12:00:00.001Z"
  ]) {
    assert.throws(
      () => calculateRouteIqRetentionBoundary({
        createdAt: "2026-07-14T12:00:00.000Z",
        customerContractExpiresAt
      }),
      error => error.code === "route_iq_retention_customer_override_not_shorter"
    );
  }
  assert.throws(
    () => calculateRouteIqRetentionBoundary({
      createdAt: "2026-07-14T12:00:00.000Z",
      customerContractExpiresAt: "2026-07-14T12:00:00.000Z"
    }),
    error => error.code === "route_iq_retention_customer_override_expired"
  );
  assert.throws(
    () => calculateRouteIqRetentionBoundary({ createdAt: "2026-07-14T12:00:00.000Z" }),
    error => error.code === "route_iq_retention_fields_missing"
      && error.details.missingFieldCount === 1
  );
  assert.throws(
    () => calculateRouteIqRetentionBoundary({
      createdAt: "2026-07-14T12:00:00.000Z",
      customerContractExpiresAt: undefined
    }),
    error => error.code === "route_iq_retention_time_invalid"
  );
});

test("field-level policy prohibits PII expansion and exactly pins the governed envelope", () => {
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

test("top-level and nested additions are rejected without echoing names or values", () => {
  for (const [key, value] of [
    ["name", "Founder Name"],
    ["address", "123 Private Street"],
    ["notes", "unrestricted free text"],
    ["contact", { email: "private@example.com" }],
    ["rawPayload", { arbitrary: "payload" }]
  ]) {
    assertUnknownFieldRejected({ ...envelope(), [key]: value }, "top_level");
    assertUnknownFieldRejected(envelope({
      retentionBoundary: { ...envelope().retentionBoundary, [key]: value }
    }), "retention_boundary");
  }
});

test("valid prospective admission binds exact creation, maximum, shortening, hold, and projection deadlines", () => {
  const valid = evaluateRouteIqProspectiveRetentionEnvelope(envelope());
  assert.equal(valid.eligible, true);
  assert.equal(valid.state, "RETENTION_ENVELOPE_VERIFIED");
  assert.equal(valid.createdAt, "2026-07-14T12:00:00.000Z");
  assert.equal(valid.policyMaximumExpiresAt, "2028-01-14T12:00:00.000Z");
  assert.equal(valid.expiresAt, "2028-01-14T12:00:00.000Z");
  assert.equal(valid.deletionPausedByLegalHold, false);
  assert.equal(valid.currentProductionActivationAuthorized, false);

  const activeHold = evaluateRouteIqProspectiveRetentionEnvelope(envelope({
    legalHoldState: "active",
    legalHoldLedgerSha256: "c".repeat(64)
  }));
  assert.equal(activeHold.eligible, true);
  assert.equal(activeHold.deletionPausedByLegalHold, true);

  const shorterBoundary = calculateRouteIqRetentionBoundary({
    createdAt: "2026-07-14T12:00:00.000Z",
    customerContractExpiresAt: "2027-01-14T12:00:00.000Z"
  });
  const shortened = evaluateRouteIqProspectiveRetentionEnvelope(envelope({
    retentionBoundary: {
      contractVersion: routeIqProspectiveRetentionBoundaryContractVersion,
      authorizationState: "founder_authorized_18_month_maximum",
      source: "authenticated_data_retention_contract",
      ...shorterBoundary
    },
    derivedProjectionExpiresAt: shorterBoundary.expiresAt
  }));
  assert.equal(shortened.eligible, true);
  assert.equal(shortened.customerOverrideState, "shortened");
});

test("OFF, malformed, expanded, expired, unknown, and unauthorized envelopes fail closed", () => {
  const expanded = envelope();
  expanded.retentionBoundary.expiresAt = "2028-01-14T12:00:00.001Z";
  const missingOverride = envelope();
  delete missingOverride.retentionBoundary.customerContractExpiresAt;
  const cases = [
    [envelope({ collectionState: "off" }), "collection_not_on"],
    [envelope({ retentionBoundary: null }), "retention_boundary_missing"],
    [envelope({ legalHoldState: "unknown" }), "legal_hold_state_unknown"],
    [envelope({ legalHoldLedgerSha256: null }), "legal_hold_ledger_hash_invalid"],
    [envelope({ deletionCapabilityStatus: "unknown" }), "retention_deletion_capability_unverified"],
    [envelope({ workspaceId: "smoothie_depot" }), "scope_unauthorized"],
    [envelope({ representativeId: "unknown" }), "representative_unauthorized"],
    [envelope({ recordOrigin: "synthetic" }), "record_origin_noncanonical"],
    [envelope({ recommendationInfluence: "on" }), "recommendation_influence_not_off"],
    [missingOverride, "retention_boundary_fields_missing"],
    [expanded, "retention_effective_deadline_mismatch"],
    [envelope({ evaluatedAt: "2028-01-14T12:00:00.000Z" }), "retention_deadline_expired"]
  ];
  for (const [input, reason] of cases) {
    const result = evaluateRouteIqProspectiveRetentionEnvelope(input);
    assert.equal(result.eligible, false, reason);
    assert.equal(result.reasons.includes(reason), true, reason);
    assert.equal(result.currentProductionActivationAuthorized, false, reason);
  }
});

test("indefinite aggregate retention requires complete de-identification with no reidentification path", () => {
  const aggregate = {
    aggregateOnly: true,
    deidentified: true,
    containsRepresentativeIdentifier: false,
    containsCustomerIdentifier: false,
    containsSpecificVisitIdentifier: false,
    containsPreciseLocationTrail: false,
    containsRawEvidence: false,
    reidentificationKeyAvailable: false
  };
  const valid = evaluateRouteIqDeidentifiedAggregateRetention(aggregate);
  assert.equal(valid.indefiniteRetentionEligible, true);
  assert.equal(valid.rawEvidenceRetentionBoundaryApplies, false);

  for (const key of [
    "containsRepresentativeIdentifier",
    "containsCustomerIdentifier",
    "containsSpecificVisitIdentifier",
    "containsPreciseLocationTrail",
    "containsRawEvidence",
    "reidentificationKeyAvailable"
  ]) {
    const blocked = evaluateRouteIqDeidentifiedAggregateRetention({ ...aggregate, [key]: true });
    assert.equal(blocked.indefiniteRetentionEligible, false, key);
    assert.equal(blocked.rawEvidenceRetentionBoundaryApplies, true, key);
  }
  assert.throws(
    () => evaluateRouteIqDeidentifiedAggregateRetention({ ...aggregate, representativeName: "private" }),
    error => error.code === "route_iq_retention_fields_invalid"
      && error.details.unknownFieldCount === 1
      && !JSON.stringify(error).includes("representativeName")
  );
});

test("legal holds and releases are append-only, hash-linked, authorized, and chronological", () => {
  const hold = createRouteIqRetentionLegalHoldEvent({
    eventType: "LEGAL_HOLD_APPLIED",
    recordedAt: "2026-07-15T00:00:00.000Z",
    authority: "prometheus_founder",
    authorizationReference: AUTH_REFERENCE,
    subject: SUBJECT
  });
  assert.equal(hold.schemaVersion, routeIqRetentionGovernanceEventVersion);
  assert.equal(hold.stateAfter, "active");
  assert.equal(hold.recordSequence, 1);
  assert.equal(Object.isFrozen(hold), true);
  const held = summarizeRouteIqRetentionLegalHold({ subject: SUBJECT, events: [hold] });
  assert.equal(held.state, "active");

  const release = createRouteIqRetentionLegalHoldEvent({
    eventType: "LEGAL_HOLD_RELEASED",
    recordedAt: "2026-07-16T00:00:00.000Z",
    authority: "authorized_counsel",
    authorizationReference: `riq_retention_auth_${"d".repeat(64)}`,
    subject: SUBJECT
  }, [hold]);
  const released = summarizeRouteIqRetentionLegalHold({ subject: SUBJECT, events: [hold, release] });
  assert.equal(released.state, "none");
  assert.equal(released.eventCount, 2);

  assert.throws(
    () => createRouteIqRetentionLegalHoldEvent({
      eventType: "LEGAL_HOLD_RELEASED",
      recordedAt: "2026-07-17T00:00:00.000Z",
      authority: "prometheus_founder",
      authorizationReference: AUTH_REFERENCE,
      subject: SUBJECT
    }, [hold, release]),
    error => error.code === "route_iq_retention_legal_hold_transition_invalid"
  );
  assert.throws(
    () => createRouteIqRetentionLegalHoldEvent({
      eventType: "LEGAL_HOLD_APPLIED",
      recordedAt: "2026-07-14T00:00:00.000Z",
      authority: "prometheus_founder",
      authorizationReference: AUTH_REFERENCE,
      subject: SUBJECT
    }, [hold]),
    error => [
      "route_iq_retention_legal_hold_transition_invalid",
      "route_iq_retention_legal_hold_chronology_invalid"
    ].includes(error.code)
  );
  assert.throws(
    () => summarizeRouteIqRetentionLegalHold({
      subject: SUBJECT,
      events: [{ ...hold, recordSha256: "e".repeat(64) }]
    }),
    error => error.code === "route_iq_retention_legal_hold_integrity_invalid"
  );
});

test("active or unknown holds block dispositions and physical deletion remains unimplemented", () => {
  const boundary = calculateRouteIqRetentionBoundary({
    createdAt: "2026-07-14T12:00:00.000Z",
    customerContractExpiresAt: null
  });
  const authorization = {
    version: routeIqRetentionOperationAuthorizationVersion,
    authority: "prometheus_founder",
    authorizationReference: AUTH_REFERENCE,
    scope: "single_explicit_append_only_disposition"
  };
  const base = {
    operation: "administrative_disposition",
    requestedAt: "2026-07-15T12:00:00.000Z",
    sourceCreatedAt: boundary.createdAt,
    effectiveExpiresAt: boundary.expiresAt,
    subject: SUBJECT,
    legalHoldEvents: [],
    authorization
  };
  assert.equal(evaluateRouteIqRetentionOperation(base).allowed, true);

  const hold = createRouteIqRetentionLegalHoldEvent({
    eventType: "LEGAL_HOLD_APPLIED",
    recordedAt: "2026-07-15T00:00:00.000Z",
    authority: "prometheus_founder",
    authorizationReference: AUTH_REFERENCE,
    subject: SUBJECT
  });
  const held = evaluateRouteIqRetentionOperation({ ...base, legalHoldEvents: [hold] });
  assert.equal(held.allowed, false);
  assert.equal(held.reasons.includes("legal_hold_active"), true);
  const unknown = evaluateRouteIqRetentionOperation({ ...base, legalHoldEvents: null });
  assert.equal(unknown.allowed, false);
  assert.equal(unknown.reasons.includes("legal_hold_state_unknown"), true);

  const deletion = evaluateRouteIqRetentionOperation({
    ...base,
    operation: "physical_deletion",
    requestedAt: "2028-01-15T12:00:00.000Z",
    authorization: { ...authorization, scope: "expired_source_physical_deletion" }
  });
  assert.equal(deletion.allowed, false);
  assert.equal(deletion.reasons.includes("physical_deletion_not_implemented_or_activated"), true);
  assert.equal(deletion.requiresAppendOnlyAuditRecord, true);
  assert.equal(deletion.historicalArchiveRewriteAllowed, false);
  assert.equal(deletion.physicalMutationPerformed, false);
});

test("administrative disposition remains byte-preserved and excluded from every governed consumer class", () => {
  const policy = json(POLICY_PATH);
  const disposition = policy.administrativeDispositionConsumerBoundary;
  assert.equal(disposition.sessionId, "route-iq-field-session-fitness-connection-fitness-cruz-2026-07-14");
  assert.equal(disposition.rawSha256, "ceb72963ab4e98d6039c1a4a1a409d281bf9e41e6001bd78cca4c04364815765");
  assert.equal(disposition.originalRecordCount, 7);
  assert.equal(disposition.originalRecordsRemainImmutable, true);
  assert.equal(disposition.auditReadRemainsAvailable, true);
  assert.equal(disposition.legalHoldCheckRequiredBeforeNewDisposition, true);
  assert.equal(disposition.analyticsLearningReadinessBaselineProductivityAdmissionAllowed, false);
});

test("retention governance schema permits only append-only opaque hold events", () => {
  const schema = json("data/route-iq-field-sessions-v1/route-iq-retention-governance-event-v1.schema.json");
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.schemaVersion.const, routeIqRetentionGovernanceEventVersion);
  assert.deepEqual(schema.properties.authority.properties.type.enum, ["prometheus_founder", "authorized_counsel"]);
  assert.equal(schema.properties.appendOnly.const, true);
  assert.equal(schema.properties.historicalArchiveRewriteAllowed.const, false);
  for (const forbidden of ["name", "address", "notes", "rawPayload", "customerId", "representativeId"]) {
    assert.equal(Object.hasOwn(schema.properties, forbidden), false);
  }
});
