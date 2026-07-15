import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  evaluateFounderAttendedGetOnlyRecoveryGovernance,
  verifyOverwatchFounderAttendedGetOnlyRecovery
} from "../scripts/verify-overwatch-cloudflare-founder-attended-get-only-recovery.mjs";

const root = resolve(import.meta.dirname, "..");
const readJson = path => JSON.parse(readFileSync(resolve(root, path), "utf8"));
const governance = readJson(
  "overwatch/governance/cloudflare-founder-attended-get-only-recovery-v1.json"
);
const report = readJson(
  "overwatch/reports/BATCH-20260715-002-cloudflare-founder-attended-get-only-recovery.json"
);
const clone = value => structuredClone(value);
const evaluate = (nextGovernance = governance, nextReport = report) =>
  evaluateFounderAttendedGetOnlyRecoveryGovernance({
    governance: nextGovernance,
    report: nextReport
  });

test("Overwatch verifies the owner-authored GET-only recovery implementation", () => {
  const result = verifyOverwatchFounderAttendedGetOnlyRecovery();
  assert.equal(result.status, "passed");
  assert.equal(result.implementationOwner, "Prometheus Infrastructure");
  assert.equal(result.verificationOwner, "Prometheus Overwatch");
  assert.equal(result.priorInvocationClassification, "PRE_CREATE_FAIL_CLOSED");
  assert.equal(result.priorCreationPostAttempts, 0);
  assert.equal(result.cloudflareApiContacted, false);
  assert.equal(result.temporaryTokenChanged, false);
});

test("Overwatch rejects ownership, commit, and owner-hash substitution", () => {
  const owner = clone(governance);
  owner.dispatchAudit.implementationOwner = "Prometheus Overwatch";
  owner.dispatchAudit.overwatchModifiedSubsystemImplementation = true;
  assert.equal(evaluate(owner).ok, false);

  const commit = clone(governance);
  commit.dispatchAudit.implementationCommit.commit = "0".repeat(40);
  assert.equal(evaluate(commit).ok, false);

  const hash = clone(governance);
  hash.infrastructureOwnerEvidence[0].sha256AtOwnerCommit = "0".repeat(64);
  assert.equal(evaluate(hash).ok, false);
});

test("Overwatch rejects an inferred provider cause or any prior creation attempt", () => {
  const inferred = clone(governance);
  inferred.priorInvocationFinding.providerFailureClassification = "VALID_EMPTY_RESULT";
  inferred.priorInvocationFinding.providerFailureMustNotBeInferredBeforeDiagnostic = false;
  assert.equal(evaluate(inferred).ok, false);

  const post = clone(governance);
  post.priorInvocationFinding.creationPostAttempts = 1;
  assert.equal(evaluate(post).ok, false);
});

test("Overwatch rejects diagnostic method, output, or contract weakening", () => {
  for (const mutate of [
    value => { value.diagnosticBoundary.providerMethodsAllowed.push("POST"); },
    value => { value.diagnosticBoundary.fixedExactAccount = false; },
    value => { value.diagnosticBoundary.fixedServiceTokenName = "any"; },
    value => { value.diagnosticBoundary.resultOptional = false; },
    value => { value.diagnosticBoundary.resultInfoOptional = false; },
    value => { value.diagnosticBoundary.totalCountTreatedAsUnfilteredInventoryMetadata = false; },
    value => { value.diagnosticBoundary.exactNameDuplicateFailsClosed = false; },
    value => { value.diagnosticBoundary.redirectFollowingAllowed = true; },
    value => { value.diagnosticBoundary.automaticRetryAllowed = true; },
    value => { value.diagnosticBoundary.allowedOutput.push("DETAILS"); },
    value => { value.diagnosticBoundary.secretOrIdentifierOutputAllowed = true; }
  ]) {
    const changed = clone(governance);
    mutate(changed);
    assert.equal(evaluate(changed).ok, false);
  }
});

test("Overwatch rejects predecessor reuse or widened recovery execution", () => {
  for (const mutate of [
    value => { value.recoveryBoundary.predecessorControlReuseAllowed = true; },
    value => { value.recoveryBoundary.predecessorReceiptReuseAllowed = true; },
    value => { value.recoveryBoundary.requiresSuccessfulExactNameAbsenceEvidence = false; },
    value => { value.recoveryBoundary.requiresNativeControllingTty = false; },
    value => { value.recoveryBoundary.preparationProviderNetworkAllowed = true; },
    value => { value.recoveryBoundary.futureProvisioningAuthorizedByDirective = true; },
    value => { value.recoveryBoundary.futureCreateAttemptsMaximum = 2; },
    value => { value.recoveryBoundary.futureAutomaticRetryAllowed = true; },
    value => { value.recoveryBoundary.temporaryTokenDeletionAllowed = true; }
  ]) {
    const changed = clone(governance);
    mutate(changed);
    assert.equal(evaluate(changed).ok, false);
  }
});

test("Overwatch rejects deployment, production mutation, or recommendation influence", () => {
  for (const [field, value] of [
    ["deploymentPerformed", true],
    ["productionMutationPerformed", true],
    ["credentialCreatedOrDeleted", true],
    ["temporaryProvisioningTokenChanged", true],
    ["prospectiveCollection", "ON"],
    ["cohortActivation", "ON"],
    ["recommendationInfluence", "ON"]
  ]) {
    const changed = clone(governance);
    changed.executionBoundary[field] = value;
    assert.equal(evaluate(changed).ok, false, field);
  }
});
