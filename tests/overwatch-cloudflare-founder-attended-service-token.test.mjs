import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  evaluateFounderAttendedProvisioningGovernance,
  verifyOverwatchFounderAttendedProvisioning
} from "../scripts/verify-overwatch-cloudflare-founder-attended-service-token.mjs";

const root = resolve(import.meta.dirname, "..");
const readJson = path => JSON.parse(readFileSync(resolve(root, path), "utf8"));
const contract = readJson("workers/infrastructure/cloudflare-founder-attended-service-token-v1.json");
const governance = readJson("overwatch/governance/cloudflare-founder-attended-service-token-provisioning-v1.json");
const report = readJson("overwatch/reports/BATCH-20260714-007-cloudflare-founder-attended-service-token-provisioning.json");
const clone = value => structuredClone(value);
const evaluate = (nextContract = contract, nextGovernance = governance, nextReport = report) =>
  evaluateFounderAttendedProvisioningGovernance({
    contract: nextContract,
    governance: nextGovernance,
    report: nextReport
  });

test("Overwatch independently verifies the attended provisioning batch", () => {
  const result = verifyOverwatchFounderAttendedProvisioning();
  assert.equal(result.status, "passed");
  assert.equal(result.implementationOwner, "Prometheus Infrastructure");
  assert.equal(result.verificationOwner, "Prometheus Overwatch");
  assert.equal(result.focusedOwnerTests, 79);
  assert.equal(result.repairCommit, "214521d99d08a0a117d81e59b9ef38105edac147");
  assert.equal(result.packageReleaseWiringCommit, "610383c4e845789859946122283e8014dae35600");
  assert.equal(result.realKeychainInteroperabilityVerified, false);
  assert.equal(result.trackedSecretFindings, 0);
  assert.equal(result.cloudflareAccessPerformed, false);
  assert.equal(result.credentialCreated, false);
});

test("Overwatch rejects endpoint, account, name, duration, body, or create-count drift", () => {
  const mutations = [
    value => { value.target.apiOrigin = "https://example.invalid"; },
    value => { value.target.accountIdSha256 = "0".repeat(64); },
    value => { value.serviceToken.name = "Another token"; },
    value => { value.serviceToken.duration = "8760h"; },
    value => { value.serviceToken.requestBody.duration = "8760h"; },
    value => { value.serviceToken.createCountMaximum = 2; }
  ];
  for (const mutate of mutations) {
    const changed = clone(contract);
    mutate(changed);
    assert.equal(evaluate(changed).ok, false);
  }
});

test("Overwatch rejects unattended, replay, retry, redirect, or value-reading expansion", () => {
  const mutations = [
    value => { value.cli.unattendedLauncherProfileAvailable = true; },
    value => { value.attendedControl.replayAllowed = true; },
    value => { value.attendedControl.controllingTtyRequiredForRealProvisioning = false; },
    value => { value.serviceToken.automaticRetryAllowed = true; },
    value => { value.serviceToken.redirectFollowAllowed = true; },
    value => { value.destinationKeychain.presenceVerification = "read_and_compare_values"; },
    value => { value.temporaryApiCredential.existingUnattendedDeploymentTokenReadable = true; }
  ];
  for (const mutate of mutations) {
    const changed = clone(contract);
    mutate(changed);
    assert.equal(evaluate(changed).ok, false);
  }
});

test("Overwatch rejects real provider, Keychain, deployment, production, or influence claims", () => {
  for (const [field, value] of [
    ["cloudflareAccessPerformed", true],
    ["realKeychainValuesAccessed", true],
    ["temporaryTokenCreated", true],
    ["serviceTokenCreated", true],
    ["accessPolicyChanged", true],
    ["deploymentPerformed", true],
    ["productionMutationPerformed", true],
    ["prospectiveCollection", "ON"],
    ["cohortActivation", "ON"],
    ["recommendationInfluence", "ON"]
  ]) {
    const changed = clone(governance);
    changed.executionBoundary[field] = value;
    assert.equal(evaluate(contract, changed).ok, false, field);
  }
});

test("Overwatch rejects ownership inversion or owner-commit substitution", () => {
  const owner = clone(governance);
  owner.dispatchAudit.implementationOwner = "Prometheus Overwatch";
  owner.dispatchAudit.overwatchModifiedSubsystemImplementation = true;
  assert.equal(evaluate(contract, owner).ok, false);

  const commit = clone(governance);
  commit.dispatchAudit.implementationCommit.commit = "0".repeat(40);
  assert.equal(evaluate(contract, commit).ok, false);

  const author = clone(governance);
  author.dispatchAudit.implementationCommit.author = "Prometheus Overwatch <overwatch@prometheus.local>";
  assert.equal(evaluate(contract, author).ok, false);

  const repair = clone(governance);
  repair.dispatchAudit.repairCommit.commit = "0".repeat(40);
  assert.equal(evaluate(contract, repair).ok, false);

  const repairEvidence = clone(governance);
  repairEvidence.infrastructureRepairEvidence[0].sha256AtRepairCommit = "0".repeat(64);
  assert.equal(evaluate(contract, repairEvidence).ok, false);
});

test("Overwatch rejects live-state, native-helper, production-composition, or rollback regression", () => {
  const mutations = [
    value => { value.attendedControl.freshValidationImmediatelyBeforeGet = false; },
    value => { value.attendedControl.freshValidationImmediatelyBeforePost = false; },
    value => { value.attendedControl.staleStructurallyValidAuthorizationConsumed = false; },
    value => { value.cli.productionAdapterInjectionAllowed = true; },
    value => { value.cli.testCoreRequiresEveryAdapterExplicitly = false; },
    value => { value.destinationKeychain.rollbackDeletesOnlyInvocationOwnedItems = false; },
    value => { value.destinationKeychain.preexistingOrReplacementItemDeletionAllowed = true; }
  ];
  for (const mutate of mutations) {
    const changed = clone(contract);
    mutate(changed);
    assert.equal(evaluate(changed).ok, false);
  }
});

test("Overwatch preserves the real-Keychain readiness blocker", () => {
  const contractClaim = clone(contract);
  contractClaim.destinationKeychain.unattendedReaderInteroperability.realKeychainRuntimeVerified = true;
  assert.equal(evaluate(contractClaim).ok, false);

  const governanceClaim = clone(governance);
  governanceClaim.credentialBoundary.realKeychainInteroperabilityExecuted = true;
  assert.equal(evaluate(contract, governanceClaim).ok, false);

  const readiness = clone(governance);
  readiness.releaseBoundary.unattendedDeploymentReady = true;
  assert.equal(evaluate(contract, readiness).ok, false);
});

test("Overwatch rejects secret-disclosure or provider-introspection overclaims", () => {
  const disclosure = clone(governance);
  disclosure.credentialBoundary.secretValuesInGitEnvironmentArgumentsOutputLogsReportsScreenshotsBrowserOrFiles = true;
  assert.equal(evaluate(contract, disclosure).ok, false);

  const read = clone(governance);
  read.credentialBoundary.verificationReadsValues = true;
  assert.equal(evaluate(contract, read).ok, false);

  const introspection = clone(governance);
  introspection.credentialBoundary.toolClaimsProviderSideScopeIntrospection = true;
  assert.equal(evaluate(contract, introspection).ok, false);
});

test("Overwatch rejects a batch report that claims execution, readiness, or deployment", () => {
  const credential = clone(report);
  credential.boundaries.credentialCreated = true;
  assert.equal(evaluate(contract, governance, credential).ok, false);

  const deployed = clone(report);
  deployed.boundaries.deploymentPerformed = true;
  assert.equal(evaluate(contract, governance, deployed).ok, false);

  const ready = clone(report);
  ready.release.unattendedDeploymentStillBlocked = false;
  assert.equal(evaluate(contract, governance, ready).ok, false);
});
