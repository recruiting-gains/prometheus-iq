import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  evaluateFounderAttendedCreateReceiptV2Governance,
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
const clone = value => structuredClone(value);
const evaluate = (nextGovernance = governance, nextReport = report) =>
  evaluateFounderAttendedCreateReceiptV2Governance({
    governance: nextGovernance,
    report: nextReport
  });

test("Overwatch independently verifies the Infrastructure-owned v2 repair", () => {
  const result = verifyOverwatchFounderAttendedCreateReceiptV2();
  assert.equal(result.status, "passed");
  assert.equal(result.implementationOwner, "Prometheus Infrastructure");
  assert.equal(result.verificationOwner, "Prometheus Overwatch");
  assert.equal(result.focusedOwnerTests, 29);
  assert.equal(result.cloudflareApiContacted, false);
  assert.equal(result.realKeychainValuesRead, false);
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
