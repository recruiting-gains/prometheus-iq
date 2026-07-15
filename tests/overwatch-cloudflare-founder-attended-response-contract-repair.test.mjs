import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  evaluateFounderAttendedResponseContractGovernance,
  verifyOverwatchFounderAttendedResponseContractRepair
} from "../scripts/verify-overwatch-cloudflare-founder-attended-response-contract-repair.mjs";

const root = resolve(import.meta.dirname, "..");
const readJson = path => JSON.parse(readFileSync(resolve(root, path), "utf8"));
const governance = readJson(
  "overwatch/governance/cloudflare-founder-attended-service-token-response-contract-repair-v1.json"
);
const report = readJson(
  "overwatch/reports/BATCH-20260715-003-cloudflare-founder-attended-service-token-response-contract-repair.json"
);
const clone = value => structuredClone(value);
const evaluate = (nextGovernance = governance, nextReport = report) =>
  evaluateFounderAttendedResponseContractGovernance({
    governance: nextGovernance,
    report: nextReport
  });

test("Overwatch independently verifies the owner-authored response-contract repair", () => {
  const result = verifyOverwatchFounderAttendedResponseContractRepair();
  assert.equal(result.status, "passed");
  assert.equal(result.implementationOwner, "Prometheus Infrastructure");
  assert.equal(result.verificationOwner, "Prometheus Overwatch");
  assert.deepEqual([...result.implementationCommits], [
    "04a38d6424099824fa3760314c7b660ce30b6930",
    "e7730315fdc8e14528b1476102984697151b4303"
  ]);
  assert.equal(result.cloudflareApiContacted, false);
  assert.equal(result.realKeychainValuesRead, false);
});

test("Overwatch rejects ownership, commit order, or owner-hash substitution", () => {
  for (const mutate of [
    value => { value.dispatchAudit.implementationOwner = "Prometheus Overwatch"; },
    value => { value.dispatchAudit.overwatchModifiedSubsystemImplementation = true; },
    value => { value.dispatchAudit.implementationCommits.reverse(); },
    value => { value.primaryOwnerEvidence[0].sha256AtOwnerCommit = "0".repeat(64); },
    value => { value.ownerSuccessorEvidence[0].sha256AtSuccessorCommit = "0".repeat(64); }
  ]) {
    const changed = clone(governance);
    mutate(changed);
    assert.equal(evaluate(changed).ok, false);
  }
});

test("Overwatch rejects create, delete, or list contract weakening", () => {
  for (const mutate of [
    value => { value.officialResponseContracts.create.httpStatus = 201; },
    value => { value.officialResponseContracts.create.expiresAtRequired = true; },
    value => { value.officialResponseContracts.create.exactDurationRequired = "1y"; },
    value => { value.officialResponseContracts.create.validClientSecretRequired = false; },
    value => { value.officialResponseContracts.delete.followUpExactNameGetRequired = false; },
    value => { value.officialResponseContracts.delete.responseAloneConfirmsCleanup = true; },
    value => { value.officialResponseContracts.list.resultOptional = false; },
    value => { value.officialResponseContracts.list.maximumPages = 101; }
  ]) {
    const changed = clone(governance);
    mutate(changed);
    assert.equal(evaluate(changed).ok, false);
  }
});

test("Overwatch rejects consumed-control reuse, retries, or widened attempt ceilings", () => {
  for (const mutate of [
    value => { value.oneShotBoundary.predecessorControlReuseAllowed = true; },
    value => { value.oneShotBoundary.predecessorReceiptReuseAllowed = true; },
    value => { value.oneShotBoundary.realSuccessorControlCreated = true; },
    value => { value.oneShotBoundary.createAttemptsMaximum = 2; },
    value => { value.oneShotBoundary.automaticRetryAllowed = true; },
    value => { value.oneShotBoundary.retryAfterUncertaintyAllowed = true; },
    value => { value.oneShotBoundary.deleteRequiresFollowUpGet = false; },
    value => { value.oneShotBoundary.temporaryProvisioningTokenPreserved = false; }
  ]) {
    const changed = clone(governance);
    mutate(changed);
    assert.equal(evaluate(changed).ok, false);
  }
});

test("Overwatch rejects phase-output or external-action widening", () => {
  const phase = clone(governance);
  phase.phaseEvidence.allowedPhases.push("SECRET_DETAILS");
  assert.equal(evaluate(phase).ok, false);

  const output = clone(governance);
  output.phaseEvidence.finalCliOutcomes.push("RETRY");
  assert.equal(evaluate(output).ok, false);

  for (const field of [
    "cloudflareApiContacted",
    "realKeychainValuesRead",
    "credentialCreatedDeletedOrChanged",
    "realSuccessorControlCreated",
    "temporaryProvisioningTokenChanged",
    "deploymentPerformed",
    "productionMutationPerformed"
  ]) {
    const changed = clone(governance);
    changed.executionBoundary[field] = true;
    assert.equal(evaluate(changed).ok, false, field);
  }
});

test("Overwatch keeps collection, cohort, recommendation, and release authorization off", () => {
  for (const [field, value] of [
    ["prospectiveCollection", "ON"],
    ["cohortActivation", "ON"],
    ["recommendationInfluence", "ON"]
  ]) {
    const changed = clone(governance);
    changed.executionBoundary[field] = value;
    assert.equal(evaluate(changed).ok, false);
  }
  for (const field of [
    "deploymentAuthorized",
    "successorControlCreationAuthorized",
    "provisioningAuthorized"
  ]) {
    const changed = clone(governance);
    changed.releaseBoundary[field] = true;
    assert.equal(evaluate(changed).ok, false);
  }
});
