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
  evaluateRouteIqDeidentifiedAggregateRetention,
  evaluateRouteIqRetentionOperation,
  openRouteIqRetentionGovernanceLedger,
  readAuthoritativeRouteIqRetentionLegalHoldSnapshot,
  readRouteIqRetentionLedgerRecords,
  routeIqDeidentifiedAggregateAttestationVersion,
  routeIqDeidentifiedAggregateVersion,
  routeIqRetentionAdministrativeDispositionTarget,
  routeIqRetentionAuthorityAssertionVersion,
  routeIqRetentionEmptyLegalHoldLedgerSha256,
  routeIqRetentionGovernanceEventVersion,
  routeIqRetentionMaximumCalendarMonths,
  routeIqRetentionOperationAuthorizationVersion,
  routeIqRetentionOperationReceiptVersion,
  validateRouteIqRetentionOperationReceipt
} from "../data/route-iq-field-sessions-v1/route-iq-retention-governance.mjs";
import {
  aggregateAuthorityClaims,
  aggregateGovernanceBinding,
  createRetentionAuthority,
  createRetentionStore,
  customerOverrideAuthorityClaims,
  legalHoldAuthorityClaims,
  retentionOperationAuthorityClaims,
  retentionSha256,
  stableJson
} from "./route-iq-retention-test-support.mjs";

const POLICY_PATH = "data/route-iq-field-sessions-v1/route-iq-prospective-shadow-retention-policy-v1.json";
const CONTRACT_PATH = "overwatch/artifact-contracts/data/fitness-connection-runtime-artifact-contract-v1.json";
const PROSPECTIVE_SUBJECT = Object.freeze({
  workspaceId: "fitness_connection",
  operatingProfileId: "fitness",
  recordClass: "prospective_shadow_evidence",
  sourceRecordSha256: "b".repeat(64)
});
const DISPOSITION_SUBJECT = Object.freeze({
  workspaceId: "fitness_connection",
  operatingProfileId: "fitness",
  recordClass: "field_session_raw_evidence",
  sourceRecordSha256: routeIqRetentionAdministrativeDispositionTarget.sourceRawSha256
});

function json(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function boundary(subject = PROSPECTIVE_SUBJECT, createdAt = "2026-07-14T12:00:00.000Z") {
  return calculateRouteIqRetentionBoundary({
    subject,
    customerAccountId: "fitness_connection",
    createdAt,
    customerContractExpiresAt: null,
    customerOverrideAuthority: null
  });
}

async function ledgerFor(subject, authority = createRetentionAuthority(), store = createRetentionStore()) {
  const ledger = await openRouteIqRetentionGovernanceLedger({
    store,
    subject,
    authorityVerifier: authority.verifier
  });
  return { authority, ledger, store, subject };
}

async function appendHold(context, {
  eventType,
  recordedAt,
  authority = "prometheus_founder",
  seed
}) {
  return context.ledger.appendLegalHold({
    eventType,
    recordedAt,
    authority: context.authority.sign(
      legalHoldAuthorityClaims({ eventType, recordedAt, subject: context.subject }),
      { authority, seed }
    )
  });
}

function prospectiveEnvelope(retentionBoundary, overrides = {}) {
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
      ...retentionBoundary
    },
    derivedProjectionExpiresAt: retentionBoundary.expiresAt,
    ...overrides
  };
}

function dispositionOperationInput(context, {
  requestedAt = "2026-07-15T01:00:00.000Z",
  retentionBoundary = boundary(DISPOSITION_SUBJECT, "2026-07-14T23:30:00.000Z"),
  seed = "disposition-operation"
} = {}) {
  const unsigned = {
    operation: "administrative_disposition",
    requestedAt,
    subject: DISPOSITION_SUBJECT,
    retentionBoundary,
    administrativeDispositionTarget: routeIqRetentionAdministrativeDispositionTarget
  };
  return {
    ...unsigned,
    authorization: context.authority.sign(
      retentionOperationAuthorityClaims(unsigned),
      { seed }
    )
  };
}

test("Data policy records the Founder maximum while collection and physical deletion stay inactive", () => {
  const policy = json(POLICY_PATH);
  const contract = json(CONTRACT_PATH);
  const retention = contract.prospectiveShadowEvidenceLifecycleContract.retentionAndCollection;

  assert.equal(policy.policyVersion, routeIqProspectiveRetentionPolicyVersion);
  assert.equal(policy.batchId, "BATCH-20260714-004");
  assert.equal(policy.status, "founder_authorized_18_month_maximum_runtime_deletion_inactive");
  assert.equal(
    routeIqProspectiveRetentionCurrentState,
    "founder_retention_authorized_source_deletion_runtime_dormant_not_deployed"
  );
  assert.equal(policy.retentionDecision.maximumCalendarMonths, 18);
  assert.equal(policy.retentionDecision.durationDays, null);
  assert.equal(policy.retentionDecision.customerContractMayShorten, true);
  assert.equal(policy.retentionDecision.customerContractMayExpand, false);
  assert.equal(policy.retentionDecision.creationTimeBasis, "canonical_authoritative_source_record_time");
  assert.equal(policy.expiryAndDeletion.physicalDeletionActivated, false);
  assert.equal(policy.expiryAndDeletion.physicalDeletionEvaluatorCanPerformMutation, false);
  assert.equal(policy.legalHold.callerAssertedStateAccepted, false);
  assert.equal(policy.legalHold.activeHoldBlocksEvaluationAndAggregateEligibility, true);
  assert.equal(policy.activationBoundary.productionMutationPerformed, false);
  assert.equal(retention.retentionPolicyVersion, policy.policyVersion);
  assert.equal(retention.retentionPolicySha256, retentionSha256(readFileSync(POLICY_PATH, "utf8")));
  assert.equal(retention.retentionBoundaryContractVersion, routeIqProspectiveRetentionBoundaryContractVersion);
  assert.equal(retention.maximumRetentionCalendarMonths, 18);
  assert.equal(retention.legalHoldAuthorityAssertionVersion, routeIqRetentionAuthorityAssertionVersion);
  assert.equal(retention.callerAssertedLegalHoldStateAccepted, false);
  assert.equal(retention.retentionOperationReceiptSchemaVersion, routeIqRetentionOperationReceiptVersion);
  assert.equal(retention.retentionOperationReceiptsDeriveAllowedAndReasons, true);
  assert.equal(retention.physicalDeletionImplementationAvailable, false);
  assert.equal(retention.activationEligibleUnderRetentionPolicy, false);
  assert.equal(policy.expiryAndDeletion.physicalDeletionImplementationStatus, "source_complete_dormant_not_deployed");
  assert.equal(policy.expiryAndDeletion.authenticatedMaintenanceMutationPathAvailable, true);
  assert.equal(policy.expiryAndDeletion.deletionPlanSchemaVersion, "route-iq-retention-deletion-plan-v1");
  assert.equal(policy.expiryAndDeletion.deletionEventSchemaVersion, "route-iq-retention-deletion-event-v1");
  assert.equal(policy.expiryAndDeletion.physicalDeletionActivated, false);
});

test("18 calendar months uses canonical UTC month addition, target-day clamp, milliseconds, and exclusive expiry", () => {
  assert.equal(routeIqRetentionMaximumCalendarMonths, 18);
  assert.equal(addRouteIqRetentionCalendarMonths("2026-08-31T23:59:59.999Z"), "2028-02-29T23:59:59.999Z");
  assert.equal(addRouteIqRetentionCalendarMonths("2027-08-31T05:04:03.002Z"), "2029-02-28T05:04:03.002Z");
  assert.equal(addRouteIqRetentionCalendarMonths("2024-02-29T12:30:00.000Z"), "2025-08-29T12:30:00.000Z");
  assert.throws(
    () => addRouteIqRetentionCalendarMonths("2026-07-14T07:00:00-05:00"),
    error => error.code === "route_iq_retention_time_invalid"
  );
});

test("customer shortening is signed, subject/customer/hash-bound, replay resistant, and strictly narrower", () => {
  const authority = createRetentionAuthority();
  const createdAt = "2026-07-14T12:00:00.000Z";
  const customerContractExpiresAt = "2027-01-14T12:00:00.000Z";
  const claims = customerOverrideAuthorityClaims({
    subject: PROSPECTIVE_SUBJECT,
    customerAccountId: "fitness_connection",
    createdAt,
    customerContractExpiresAt
  });
  const authorizationReference = `riq_retention_auth_${"1".repeat(64)}`;
  const customerOverrideAuthority = authority.sign(claims, {
    authority: "prometheus_data_customer_contract_authority",
    seed: "shortening",
    authorizationReference
  });
  const shortened = calculateRouteIqRetentionBoundary({
    subject: PROSPECTIVE_SUBJECT,
    customerAccountId: "fitness_connection",
    createdAt,
    customerContractExpiresAt,
    customerOverrideAuthority
  }, { authorityVerifier: authority.verifier });
  assert.equal(shortened.customerOverrideState, "authenticated_shortening");
  assert.equal(shortened.expiresAt, customerContractExpiresAt);
  assert.equal(shortened.customerOverrideAuthority.authorizationReference, authorizationReference);

  const changedExpiry = "2027-02-14T12:00:00.000Z";
  const changedClaims = customerOverrideAuthorityClaims({
    subject: PROSPECTIVE_SUBJECT,
    customerAccountId: "fitness_connection",
    createdAt,
    customerContractExpiresAt: changedExpiry
  });
  const replayedReference = authority.sign(changedClaims, {
    authority: "prometheus_data_customer_contract_authority",
    seed: "changed-shortening",
    authorizationReference
  });
  assert.throws(
    () => calculateRouteIqRetentionBoundary({
      subject: PROSPECTIVE_SUBJECT,
      customerAccountId: "fitness_connection",
      createdAt,
      customerContractExpiresAt: changedExpiry,
      customerOverrideAuthority: replayedReference
    }, { authorityVerifier: authority.verifier }),
    error => error.code === "route_iq_retention_authority_replay_invalid"
  );

  for (const invalidExpiry of [
    createdAt,
    "2028-01-14T12:00:00.000Z",
    "2028-01-14T12:00:00.001Z"
  ]) {
    assert.throws(
      () => calculateRouteIqRetentionBoundary({
        subject: PROSPECTIVE_SUBJECT,
        customerAccountId: "fitness_connection",
        createdAt,
        customerContractExpiresAt: invalidExpiry,
        customerOverrideAuthority: {}
      }, { authorityVerifier: authority.verifier }),
      error => [
        "route_iq_retention_customer_override_expired",
        "route_iq_retention_customer_override_not_shorter"
      ].includes(error.code)
    );
  }
  assert.throws(
    () => calculateRouteIqRetentionBoundary({
      subject: PROSPECTIVE_SUBJECT,
      customerAccountId: "other_customer",
      createdAt,
      customerContractExpiresAt: null,
      customerOverrideAuthority: null
    }),
    error => error.code === "route_iq_retention_customer_scope_invalid"
  );
});

test("prospective envelopes reject unknown caller fields and derive legal-hold state from the ledger", async () => {
  const retentionBoundary = boundary();
  const context = await ledgerFor(PROSPECTIVE_SUBJECT);
  const valid = evaluateRouteIqProspectiveRetentionEnvelope(
    prospectiveEnvelope(retentionBoundary),
    { retentionGovernanceLedger: context.ledger }
  );
  assert.equal(valid.eligible, true);
  assert.equal(valid.createdAt, retentionBoundary.createdAt);
  assert.equal(valid.expiresAt, retentionBoundary.expiresAt);
  assert.equal(valid.expiryExclusive, true);
  assert.equal(valid.legalHoldState, "none");
  assert.equal(valid.legalHoldLedgerSha256, routeIqRetentionEmptyLegalHoldLedgerSha256);

  const withoutLedger = evaluateRouteIqProspectiveRetentionEnvelope(prospectiveEnvelope(retentionBoundary));
  assert.equal(withoutLedger.eligible, false);
  assert.equal(withoutLedger.reasons.includes("legal_hold_state_unknown"), true);

  await appendHold(context, {
    eventType: "LEGAL_HOLD_APPLIED",
    recordedAt: "2026-07-14T12:00:00.500Z",
    seed: "prospective-hold"
  });
  const held = evaluateRouteIqProspectiveRetentionEnvelope(
    prospectiveEnvelope(retentionBoundary),
    { retentionGovernanceLedger: context.ledger }
  );
  assert.equal(held.eligible, false);
  assert.equal(held.legalHoldState, "active");
  assert.equal(held.reasons.includes("legal_hold_active"), true);

  await appendHold(context, {
    eventType: "LEGAL_HOLD_RELEASED",
    recordedAt: "2026-07-14T12:00:02.000Z",
    authority: "authorized_counsel",
    seed: "prospective-release"
  });
  const beforeRelease = evaluateRouteIqProspectiveRetentionEnvelope(
    prospectiveEnvelope(retentionBoundary),
    { retentionGovernanceLedger: context.ledger }
  );
  assert.equal(beforeRelease.eligible, false);
  assert.equal(beforeRelease.legalHoldState, "active");
  const afterRelease = evaluateRouteIqProspectiveRetentionEnvelope(
    prospectiveEnvelope(retentionBoundary, { evaluatedAt: "2026-07-14T12:00:03.000Z" }),
    { retentionGovernanceLedger: context.ledger }
  );
  assert.equal(afterRelease.eligible, true);
  assert.equal(afterRelease.legalHoldState, "none");

  for (const [key, value] of [
    ["legalHoldState", "none"],
    ["legalHoldLedgerSha256", routeIqRetentionEmptyLegalHoldLedgerSha256],
    ["deletionCapabilityStatus", "runtime_not_deployed"],
    ["rawPayload", { private: true }]
  ]) {
    assert.throws(
      () => evaluateRouteIqProspectiveRetentionEnvelope({
        ...prospectiveEnvelope(retentionBoundary),
        [key]: value
      }, { retentionGovernanceLedger: context.ledger }),
      error => error.code === "route_iq_prospective_retention_fields_invalid"
        && error.details.unknownFieldCount === 1
        && !JSON.stringify(error).includes(key)
    );
  }
});

test("malformed, expanded, expired, cross-scope, and source-outliving projection envelopes fail closed", async () => {
  const retentionBoundary = boundary();
  const context = await ledgerFor(PROSPECTIVE_SUBJECT);
  const expanded = prospectiveEnvelope(retentionBoundary);
  expanded.retentionBoundary.expiresAt = "2028-01-14T12:00:00.001Z";
  const missing = prospectiveEnvelope(retentionBoundary);
  delete missing.retentionBoundary.customerOverrideAuthority;
  const cases = [
    [prospectiveEnvelope(retentionBoundary, { collectionState: "off" }), "collection_not_on"],
    [prospectiveEnvelope(retentionBoundary, { retentionBoundary: null }), "retention_boundary_missing"],
    [prospectiveEnvelope(retentionBoundary, { workspaceId: "synthetic_unauthorized_workspace" }), "scope_unauthorized"],
    [prospectiveEnvelope(retentionBoundary, { representativeId: "unknown" }), "representative_unauthorized"],
    [prospectiveEnvelope(retentionBoundary, { recordOrigin: "synthetic" }), "record_origin_noncanonical"],
    [prospectiveEnvelope(retentionBoundary, { recommendationInfluence: "on" }), "recommendation_influence_not_off"],
    [prospectiveEnvelope(retentionBoundary, { derivedProjectionExpiresAt: "2028-01-14T12:00:00.001Z" }), "derived_projection_outlives_source"],
    [prospectiveEnvelope(retentionBoundary, { evaluatedAt: retentionBoundary.expiresAt }), "retention_deadline_expired"],
    [missing, "retention_boundary_fields_missing"],
    [expanded, "retention_boundary_mismatch"]
  ];
  for (const [input, reason] of cases) {
    const result = evaluateRouteIqProspectiveRetentionEnvelope(input, {
      retentionGovernanceLedger: context.ledger
    });
    assert.equal(result.eligible, false, reason);
    assert.equal(result.reasons.includes(reason), true, `${reason}: ${result.reasons.join(",")}`);
    assert.equal(result.currentProductionActivationAuthorized, false);
  }
});

test("indefinite aggregate eligibility binds canonical bytes, attestation, sources, and authoritative hold ledgers", async () => {
  const authority = createRetentionAuthority();
  const secondSubject = { ...PROSPECTIVE_SUBJECT, sourceRecordSha256: "c".repeat(64) };
  const first = await ledgerFor(PROSPECTIVE_SUBJECT, authority);
  const second = await ledgerFor(secondSubject, authority);
  const sourceGovernance = [
    { subject: PROSPECTIVE_SUBJECT, retentionGovernanceLedger: first.ledger },
    { subject: secondSubject, retentionGovernanceLedger: second.ledger }
  ];
  const artifact = {
    schemaVersion: routeIqDeidentifiedAggregateVersion,
    aggregationLevel: "multi_record_summary",
    dimensions: { month: "2026-07" },
    metrics: { recordCount: 2, visitCount: 14, conversationCount: 9, leadCount: 3, unitCount: 1 }
  };
  const artifactBytes = stableJson(artifact);
  const artifactSha256 = retentionSha256(artifactBytes);
  const claims = {
    aggregateOnly: true,
    deidentified: true,
    containsRepresentativeIdentity: false,
    containsCustomerIdentity: false,
    containsSpecificVisitIdentity: false,
    containsPreciseLocationTrail: false,
    containsReidentificationLinkage: false,
    containsHiddenRawRows: false
  };
  const attestedAt = "2026-07-15T12:00:00.000Z";

  function attestation(attestationClaims, binding, seed) {
    const unsigned = {
      version: routeIqDeidentifiedAggregateAttestationVersion,
      artifactSha256,
      attestedAt,
      ...binding,
      claims: attestationClaims
    };
    return {
      ...unsigned,
      authority: authority.sign(aggregateAuthorityClaims({
        attestationVersion: unsigned.version,
        artifactSha256,
        attestedAt,
        ...binding,
        claims: attestationClaims
      }), { authority: "prometheus_data", seed })
    };
  }

  const clearBinding = aggregateGovernanceBinding(sourceGovernance, attestedAt);
  const valid = await evaluateRouteIqDeidentifiedAggregateRetention({
    artifactBytes,
    artifactSha256,
    attestation: attestation(claims, clearBinding, "aggregate-clear"),
    sourceGovernance
  }, { authorityVerifier: authority.verifier });
  assert.equal(valid.indefiniteRetentionEligible, true);
  assert.equal(valid.rawEvidenceRetentionBoundaryApplies, false);
  assert.equal(valid.sourceSetSha256, clearBinding.sourceSetSha256);

  for (const key of [
    "containsRepresentativeIdentity",
    "containsCustomerIdentity",
    "containsSpecificVisitIdentity",
    "containsPreciseLocationTrail",
    "containsReidentificationLinkage",
    "containsHiddenRawRows"
  ]) {
    const blockedClaims = { ...claims, [key]: true };
    const blocked = await evaluateRouteIqDeidentifiedAggregateRetention({
      artifactBytes,
      artifactSha256,
      attestation: attestation(blockedClaims, clearBinding, `aggregate-${key}`),
      sourceGovernance
    }, { authorityVerifier: authority.verifier });
    assert.equal(blocked.indefiniteRetentionEligible, false, key);
    assert.equal(blocked.rawEvidenceRetentionBoundaryApplies, true, key);
  }

  await appendHold(second, {
    eventType: "LEGAL_HOLD_APPLIED",
    recordedAt: "2026-07-15T11:00:00.000Z",
    seed: "aggregate-hold"
  });
  const heldBinding = aggregateGovernanceBinding(sourceGovernance, attestedAt);
  const held = await evaluateRouteIqDeidentifiedAggregateRetention({
    artifactBytes,
    artifactSha256,
    attestation: attestation(claims, heldBinding, "aggregate-held"),
    sourceGovernance
  }, { authorityVerifier: authority.verifier });
  assert.equal(held.indefiniteRetentionEligible, false);
  assert.equal(held.reasons.includes("legal_hold_active"), true);

  const nested = structuredClone(artifact);
  nested.metrics.hiddenRawRows = [{ source: "private" }];
  await assert.rejects(
    () => evaluateRouteIqDeidentifiedAggregateRetention({
      artifactBytes: stableJson(nested),
      artifactSha256: retentionSha256(stableJson(nested)),
      attestation: attestation(claims, heldBinding, "aggregate-nested"),
      sourceGovernance
    }, { authorityVerifier: authority.verifier }),
    error => error.code === "route_iq_retention_fields_invalid"
  );
  await assert.rejects(
    () => evaluateRouteIqDeidentifiedAggregateRetention({
      artifactBytes,
      artifactSha256,
      attestation: attestation(claims, heldBinding, "aggregate-unknown-hold"),
      sourceGovernance: [sourceGovernance[0], { ...sourceGovernance[1], retentionGovernanceLedger: {} }]
    }, { authorityVerifier: authority.verifier }),
    error => error.code === "route_iq_retention_aggregate_legal_hold_unknown"
  );
});

test("legal holds and releases require signed authority, durable chronology, and never change expiry", async () => {
  const context = await ledgerFor(PROSPECTIVE_SUBJECT);
  const originalBoundary = boundary();
  const hold = await appendHold(context, {
    eventType: "LEGAL_HOLD_APPLIED",
    recordedAt: "2026-07-15T00:00:00.000Z",
    seed: "ledger-hold"
  });
  assert.equal(hold.schemaVersion, routeIqRetentionGovernanceEventVersion);
  assert.equal(hold.ledgerSequence, 1);
  assert.equal(hold.authority.authority, "prometheus_founder");
  assert.equal(hold.auditOwner, "prometheus_data");
  assert.equal((await readAuthoritativeRouteIqRetentionLegalHoldSnapshot(
    context.ledger,
    PROSPECTIVE_SUBJECT,
    "2026-07-15T00:00:00.000Z"
  )).state, "active");

  await assert.rejects(
    () => appendHold(context, {
      eventType: "LEGAL_HOLD_RELEASED",
      recordedAt: "2026-07-16T00:00:00.000Z",
      authority: "prometheus_data",
      seed: "unauthorized-release"
    }),
    error => error.code === "route_iq_retention_authority_unauthorized"
  );
  const release = await appendHold(context, {
    eventType: "LEGAL_HOLD_RELEASED",
    recordedAt: "2026-07-16T00:00:00.000Z",
    authority: "authorized_counsel",
    seed: "ledger-release"
  });
  assert.equal(release.ledgerSequence, 2);
  assert.equal(release.previousRecordSha256, hold.recordSha256);
  assert.equal((await readAuthoritativeRouteIqRetentionLegalHoldSnapshot(
    context.ledger,
    PROSPECTIVE_SUBJECT,
    "2026-07-15T12:00:00.000Z"
  )).state, "active");
  assert.equal((await readAuthoritativeRouteIqRetentionLegalHoldSnapshot(
    context.ledger,
    PROSPECTIVE_SUBJECT,
    "2026-07-16T00:00:00.001Z"
  )).state, "none");
  assert.deepEqual(boundary(), originalBoundary);

  const records = readRouteIqRetentionLedgerRecords(context.ledger);
  const tampered = structuredClone(records);
  tampered[0].recordSha256 = "0".repeat(64);
  context.store.replaceRecordsForTest(context.ledger.subjectKey, tampered);
  await assert.rejects(
    () => readAuthoritativeRouteIqRetentionLegalHoldSnapshot(
      context.ledger,
      PROSPECTIVE_SUBJECT,
      "2026-07-16T00:00:00.001Z"
    ),
    error => error.code === "route_iq_retention_legal_hold_integrity_invalid"
  );
});

test("operation receipts derive decisions from a durable ledger and bind physical deletion to an exact plan", async () => {
  const disposition = await ledgerFor(DISPOSITION_SUBJECT);
  const input = dispositionOperationInput(disposition);
  const receipt = await disposition.ledger.appendOperationReceipt(input);
  assert.equal(receipt.schemaVersion, routeIqRetentionOperationReceiptVersion);
  assert.equal(receipt.ledgerSequence, 1);
  assert.equal(receipt.decision.allowed, true);
  assert.deepEqual(receipt.decision.reasons, []);
  assert.equal(receipt.payloadRetained, false);
  assert.equal(receipt.physicalMutationPerformed, false);
  assert.equal(receipt.productionMutationAuthorized, false);
  assert.deepEqual(validateRouteIqRetentionOperationReceipt(receipt, disposition.ledger), receipt);

  await assert.rejects(
    () => disposition.ledger.appendOperationReceipt({ ...input, allowed: true, reasons: [] }),
    error => error.code === "route_iq_retention_fields_invalid"
      && error.details.unknownFieldCount === 2
  );
  assert.throws(
    () => validateRouteIqRetentionOperationReceipt({ ...receipt, recordSha256: "0".repeat(64) }, disposition.ledger),
    error => error.code === "route_iq_retention_receipt_not_persisted"
  );

  const heldDisposition = await ledgerFor(DISPOSITION_SUBJECT);
  await appendHold(heldDisposition, {
    eventType: "LEGAL_HOLD_APPLIED",
    recordedAt: "2026-07-15T00:30:00.000Z",
    seed: "disposition-hold"
  });
  const heldReceipt = await heldDisposition.ledger.appendOperationReceipt(
    dispositionOperationInput(heldDisposition, { seed: "held-disposition" })
  );
  assert.equal(heldReceipt.decision.allowed, false);
  assert.equal(heldReceipt.decision.reasons.includes("legal_hold_active"), true);

  const prospective = await ledgerFor(PROSPECTIVE_SUBJECT);
  const retentionBoundary = boundary();
  const deletionUnsigned = {
    operation: "physical_deletion",
    requestedAt: "2028-01-14T12:00:00.001Z",
    subject: PROSPECTIVE_SUBJECT,
    retentionBoundary,
    administrativeDispositionTarget: null,
    deletionPlanSha256: retentionSha256("exact-deletion-plan")
  };
  const deletionInput = {
    ...deletionUnsigned,
    authorization: prospective.authority.sign(
      retentionOperationAuthorityClaims(deletionUnsigned),
      { seed: "blocked-physical-deletion" }
    )
  };
  const deletionReceipt = await prospective.ledger.appendOperationReceipt(deletionInput);
  assert.equal(deletionReceipt.decision.allowed, true);
  assert.deepEqual(deletionReceipt.decision.reasons, []);
  assert.equal(deletionReceipt.physicalMutationPerformed, false);
  assert.equal(typeof prospective.ledger.delete, "undefined");
  assert.equal(typeof prospective.ledger.physicallyDelete, "undefined");

  const withoutLedger = evaluateRouteIqRetentionOperation(deletionInput);
  assert.equal(withoutLedger.allowed, false);
  assert.equal(withoutLedger.reasons.includes("legal_hold_state_unknown"), true);
  assert.equal(withoutLedger.reasons.includes("operation_authority_unverified"), true);
  assert.equal(withoutLedger.physicalMutationPerformed, false);

  const generalized = structuredClone(input);
  generalized.administrativeDispositionTarget.sessionId = "route-iq-field-session-fitness-connection-fitness-cruz-2026-07-15";
  assert.throws(
    () => evaluateRouteIqRetentionOperation(generalized, {
      retentionGovernanceLedger: disposition.ledger
    }),
    error => error.code === "route_iq_retention_disposition_target_unauthorized"
  );
});

test("policy, schemas, and contract pin exact allowlists and the seven-record accidental disposition", () => {
  const policy = json(POLICY_PATH);
  const holdSchema = json("data/route-iq-field-sessions-v1/route-iq-retention-governance-event-v1.schema.json");
  const receiptSchema = json("data/route-iq-field-sessions-v1/route-iq-retention-operation-receipt-v1.schema.json");
  const disposition = policy.administrativeDispositionConsumerBoundary;

  assert.deepEqual(policy.canonicality.topLevelEnvelopeExactAllowlist, routeIqProspectiveRetentionEnvelopeKeys);
  assert.deepEqual(policy.canonicality.retentionBoundaryExactAllowlist, routeIqProspectiveRetentionBoundaryKeys);
  assert.equal(policy.canonicality.additionalPropertiesAllowed, false);
  assert.equal(policy.aggregateRetention.hiddenRawRowsAllowed, false);
  assert.equal(disposition.sessionId, routeIqRetentionAdministrativeDispositionTarget.sessionId);
  assert.equal(disposition.rawSha256, routeIqRetentionAdministrativeDispositionTarget.sourceRawSha256);
  assert.equal(disposition.originalRecordCount, 7);
  assert.equal(disposition.originalRecordsRemainImmutable, true);
  assert.equal(disposition.analyticsLearningReadinessBaselineProductivityAdmissionAllowed, false);

  assert.equal(holdSchema.additionalProperties, false);
  assert.equal(holdSchema.properties.schemaVersion.const, routeIqRetentionGovernanceEventVersion);
  assert.equal(holdSchema.properties.authority.properties.version.const, routeIqRetentionAuthorityAssertionVersion);
  assert.deepEqual(
    holdSchema.properties.authority.properties.authority.enum,
    ["prometheus_founder", "authorized_counsel"]
  );
  assert.equal(holdSchema.properties.auditOwner.const, "prometheus_data");
  assert.equal(holdSchema.properties.appendOnly.const, true);
  assert.equal(receiptSchema.properties.schemaVersion.const, routeIqRetentionOperationReceiptVersion);
  assert.equal(receiptSchema.properties.payloadRetained.const, false);
  assert.equal(receiptSchema.properties.physicalMutationPerformed.const, false);
  assert.equal(receiptSchema.properties.productionMutationAuthorized.const, false);
  assert.equal(
    receiptSchema.$defs.administrativeDispositionTarget.properties.protectedArtifactCount.const,
    7
  );
  for (const forbidden of ["rawPayload", "rawReportText", "name", "address", "notes", "allowed", "reasons"]) {
    assert.equal(Object.hasOwn(receiptSchema.properties, forbidden), false);
  }
  assert.equal(routeIqRetentionOperationAuthorizationVersion, "route-iq-retention-operation-authorization-v2");
});
