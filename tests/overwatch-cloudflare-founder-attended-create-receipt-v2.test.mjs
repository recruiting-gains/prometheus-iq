import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_SERVICE_TOKEN_DURATION,
  CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_SERVICE_TOKEN_NAME
} from "../scripts/lib/cloudflare-founder-attended-create-receipt-v2-constants.mjs";
import {
  classifyFounderAttendedCreateReceiptV2ResponseTestOnly
} from "../scripts/lib/cloudflare-founder-attended-create-receipt-v2-workflow.mjs";
import {
  evaluateFounderAttendedCreateReceiptV2Governance,
  evaluateFounderAttendedSuccessfulResponseReconciliationGovernance,
  verifyOverwatchFounderAttendedCreateReceiptV2
} from "../scripts/verify-overwatch-cloudflare-founder-attended-create-receipt-v2.mjs";

const root = resolve(import.meta.dirname, "..");
const readJson = path => JSON.parse(readFileSync(resolve(root, path), "utf8"));
const governance = readJson(
  "overwatch/governance/cloudflare-founder-attended-live-create-receipt-safe-provisioning-repair-v2.json"
);
const report = readJson(
  "overwatch/reports/BATCH-20260715-004-cloudflare-live-create-receipt-safe-provisioning-repair-v2.json"
);
const reconciliationGovernance = readJson(
  "overwatch/governance/cloudflare-founder-attended-successful-response-reconciliation-v1.json"
);
const reconciliationReport = readJson(
  "overwatch/reports/BATCH-20260715-005-cloudflare-founder-attended-successful-response-reconciliation.json"
);
const clone = value => structuredClone(value);
const evaluate = (nextGovernance = governance, nextReport = report) =>
  evaluateFounderAttendedCreateReceiptV2Governance({
    governance: nextGovernance,
    report: nextReport
  });
const evaluateReconciliation = (
  nextGovernance = reconciliationGovernance,
  nextReport = reconciliationReport
) => evaluateFounderAttendedSuccessfulResponseReconciliationGovernance({
  governance: nextGovernance,
  report: nextReport
});

function createResponse({ status = 200, omit = [] } = {}) {
  const result = {
    id: "f174e90a-fafe-4643-bbbc-4a0ed4fc8415",
    name: CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_SERVICE_TOKEN_NAME,
    duration: CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_SERVICE_TOKEN_DURATION,
    client_id: `${"d".repeat(32)}.access.example.com`,
    client_secret: "synthetic-overwatch-client-secret-value-5005",
    created_at: "2026-07-15T23:00:01.12345Z",
    updated_at: "2026-07-15T23:00:01.12345Z"
  };
  for (const key of omit) delete result[key];
  return { status, body: JSON.stringify({ success: true, result }) };
}

test("Overwatch independently verifies the Infrastructure-owned v2 repair", () => {
  const result = verifyOverwatchFounderAttendedCreateReceiptV2();
  assert.equal(result.status, "passed");
  assert.equal(result.batchId, "BATCH-20260715-005");
  assert.equal(result.implementationOwner, "Prometheus Infrastructure");
  assert.equal(result.verificationOwner, "Prometheus Overwatch");
  assert.equal(result.focusedOwnerTests, 32);
  assert.equal(result.cloudflareApiContacted, false);
  assert.equal(result.realKeychainValuesRead, false);
});

test("Overwatch independently exercises documented, alternate, and rejected status classes", () => {
  const documented = classifyFounderAttendedCreateReceiptV2ResponseTestOnly(createResponse());
  assert.equal(documented.accepted, true);
  assert.equal(documented.httpStatusClass, "DOCUMENTED_200");

  const alternate = classifyFounderAttendedCreateReceiptV2ResponseTestOnly(
    createResponse({ status: 201 })
  );
  assert.equal(alternate.accepted, true);
  assert.equal(alternate.httpStatusClass, "ALTERNATE_2XX");

  const emptyAlternate = classifyFounderAttendedCreateReceiptV2ResponseTestOnly({
    status: 204,
    body: ""
  });
  assert.equal(emptyAlternate.accepted, false);
  assert.equal(emptyAlternate.reasonCode, "CREATE_BODY_REJECTED");
  assert.equal(emptyAlternate.httpStatusClass, "ALTERNATE_2XX");

  const rejectedBody = Buffer.from(createResponse({ status: 503 }).body, "utf8");
  const rejected = classifyFounderAttendedCreateReceiptV2ResponseTestOnly({
    status: 503,
    body: rejectedBody
  });
  assert.equal(rejected.accepted, false);
  assert.equal(rejected.httpStatusClass, "NON_2XX");
  assert.equal(rejected.compensationCandidate, false);
  assert.equal(rejectedBody.every(value => value === 0), true);

  const missingSecret = classifyFounderAttendedCreateReceiptV2ResponseTestOnly(
    createResponse({ omit: ["client_secret"] })
  );
  assert.equal(missingSecret.accepted, false);
  assert.equal(missingSecret.reasonCode, "CREATE_CLIENT_SECRET_MISSING");
  assert.equal(missingSecret.compensationCandidate, true);

  const output = JSON.stringify([documented, alternate, rejected, missingSecret]);
  assert.doesNotMatch(output, /synthetic-overwatch-client-secret|access\.example\.com/u);
});

test("Overwatch rejects reconciliation ownership, evidence, or status weakening", () => {
  for (const mutate of [
    value => { value.dispatchAudit.implementationOwner = "Prometheus Overwatch"; },
    value => { value.dispatchAudit.overwatchModifiedInfrastructureImplementation = true; },
    value => { value.dispatchAudit.implementationCommit.commit = "0".repeat(40); },
    value => { value.ownerEvidence[0].sha256AtOwnerCommit = "0".repeat(64); },
    value => { value.observedLiveEvidence.historicalExactHttpStatusRecoverable = true; },
    value => { value.statusReconciliation.rawHttpStatusPersisted = true; },
    value => { value.statusReconciliation.bounded2xxEligibleOnlyForFurtherValidation = false; },
    value => { value.statusReconciliation.statusAloneCanReachSuccess = true; },
    value => { value.statusReconciliation.non2xxCanReachSuccess = true; },
    value => { value.statusReconciliation.successRequiresValidClientSecret = false; },
    value => { value.statusReconciliation.successRequiresExactNameProof = false; }
  ]) {
    const changed = clone(reconciliationGovernance);
    mutate(changed);
    assert.equal(evaluateReconciliation(changed).ok, false);
  }
});

test("Overwatch rejects retry, compensation, secret, or external-action widening", () => {
  for (const mutate of [
    value => { value.safetyBoundary.createAttemptsMaximumPerFreshControl = 2; },
    value => { value.safetyBoundary.automaticRetryAllowed = true; },
    value => { value.safetyBoundary.consumedOrAmbiguousControlReusable = true; },
    value => { value.safetyBoundary.keychainPairAllOrRollback = false; },
    value => { value.safetyBoundary.returnedIdAloneAuthorizesDelete = true; },
    value => { value.safetyBoundary.ambiguousMismatchedOrDuplicateProofDeleteAttempts = 1; },
    value => { value.safetyBoundary.compensationRequiresSeparateFounderAuthorization = false; },
    value => { value.safetyBoundary.unrelatedTokenDeletionAllowed = true; },
    value => { value.safetyBoundary.credentialValuesPrintedLoggedHashedMeasuredOrExposed = true; },
    value => { value.executionBoundary.cloudflareApiContacted = true; },
    value => { value.executionBoundary.realKeychainValuesReadOrWritten = true; },
    value => { value.releaseBoundary.provisioningAuthorized = true; },
    value => { value.releaseBoundary.tokenCreationOrDeletionAuthorized = true; }
  ]) {
    const changed = clone(reconciliationGovernance);
    mutate(changed);
    assert.equal(evaluateReconciliation(changed).ok, false);
  }
});

test("Overwatch rejects ownership or owner-commit substitution", () => {
  for (const mutate of [
    value => { value.dispatchAudit.implementationOwner = "Prometheus Overwatch"; },
    value => { value.dispatchAudit.verificationOwner = "Prometheus Infrastructure"; },
    value => { value.dispatchAudit.overwatchModifiedSubsystemImplementation = true; },
    value => { value.dispatchAudit.implementationCommit.commit = "0".repeat(40); },
    value => { value.ownerEvidence[0].sha256AtOwnerCommit = "0".repeat(64); }
  ]) {
    const changed = clone(governance);
    mutate(changed);
    assert.equal(evaluate(changed).ok, false);
  }
});

test("Overwatch rejects provider-contract or credential weakening", () => {
  for (const mutate of [
    value => { value.officialResponseContracts.create.httpStatus = 201; },
    value => { value.officialResponseContracts.create.nameEchoOptionalInProviderSchema = false; },
    value => { value.officialResponseContracts.create.exactRequestDuration = "1y"; },
    value => { value.officialResponseContracts.list.maximumPages = 101; },
    value => { value.officialResponseContracts.delete.responseAloneConfirmsCleanup = true; },
    value => { value.credentialBoundary.keychainPairAllOrRollback = false; },
    value => { value.credentialBoundary.valuesPrintedLoggedHashedMeasuredOrPersisted = true; }
  ]) {
    const changed = clone(governance);
    mutate(changed);
    assert.equal(evaluate(changed).ok, false);
  }
});

test("Overwatch rejects retries, ID-only deletion, or broadened compensation", () => {
  for (const mutate of [
    value => { value.createReceiptBoundary.freshAttendedGetRequired = false; },
    value => { value.createReceiptBoundary.predecessorControlOrReceiptReuseAllowed = true; },
    value => { value.createReceiptBoundary.createAttemptsMaximum = 2; },
    value => { value.createReceiptBoundary.automaticRetryAllowed = true; },
    value => { value.createReceiptBoundary.returnedIdAloneAuthorizesDelete = true; },
    value => { value.createReceiptBoundary.wrongNameOrDurationDeleteAttempts = 1; },
    value => { value.createReceiptBoundary.ambiguousMalformedMismatchedOrDuplicateProofDeleteAttempts = 1; },
    value => { value.createReceiptBoundary.compensationRequiresSeparateNativeTtyConfirmation = false; },
    value => { value.createReceiptBoundary.compensationDeleteAttemptsMaximum = 2; }
  ]) {
    const changed = clone(governance);
    mutate(changed);
    assert.equal(evaluate(changed).ok, false);
  }
});

test("Overwatch rejects reason-code or final-output widening", () => {
  const reason = clone(governance);
  reason.reasonEvidence.allowedReasonCodes.push("SECRET_DETAILS");
  assert.equal(evaluate(reason).ok, false);

  const outcome = clone(governance);
  outcome.reasonEvidence.finalCliOutcomes.push("RETRY");
  assert.equal(evaluate(outcome).ok, false);
});

test("Overwatch rejects external-action or activation claims", () => {
  for (const field of [
    "cloudflareApiContacted",
    "realKeychainValuesRead",
    "credentialCreatedDeletedStoredOrChanged",
    "realControlReceiptOrReasonEvidenceCreated",
    "temporaryProvisioningApiTokenChanged",
    "deploymentPerformed",
    "productionMutationPerformed"
  ]) {
    const changed = clone(governance);
    changed.executionBoundary[field] = true;
    assert.equal(evaluate(changed).ok, false, field);
  }
  for (const field of ["prospectiveCollection", "cohortActivation", "recommendationInfluence"]) {
    const changed = clone(governance);
    changed.executionBoundary[field] = "ON";
    assert.equal(evaluate(changed).ok, false, field);
  }
  for (const field of [
    "deploymentAuthorized",
    "liveGetAuthorizedByThisBatch",
    "controlPreparationAuthorized",
    "provisioningAuthorized"
  ]) {
    const changed = clone(governance);
    changed.releaseBoundary[field] = true;
    assert.equal(evaluate(changed).ok, false, field);
  }
});
