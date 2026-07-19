import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  CLOUDFLARE_UNATTENDED_KEYCHAIN_ITEMS,
  classifyCloudflareUnattendedKeychain,
  formatCloudflareUnattendedKeychainClassification
} from "../scripts/lib/cloudflare-unattended-keychain.mjs";
import {
  evaluateCloudflareUnattendedKeychainInteroperabilityGovernance,
  evaluateCloudflareUnattendedKeychainSuccessorOwnership,
  verifyOverwatchCloudflareUnattendedKeychainInteroperability
} from "../scripts/verify-overwatch-cloudflare-unattended-keychain-interoperability.mjs";

const root = resolve(import.meta.dirname, "..");
const readJson = path => JSON.parse(readFileSync(resolve(root, path), "utf8"));
const governance = readJson(
  "overwatch/governance/cloudflare-unattended-keychain-interoperability-v1.json"
);
const report = readJson(
  "overwatch/reports/BATCH-20260715-008-cloudflare-unattended-keychain-interoperability.json"
);
const clone = value => structuredClone(value);
const evaluate = (nextGovernance = governance, nextReport = report) =>
  evaluateCloudflareUnattendedKeychainInteroperabilityGovernance({
    governance: nextGovernance,
    report: nextReport
  });

function result(status, stdout = Buffer.alloc(0), error = undefined) {
  return { status, stdout, stderr: Buffer.alloc(0), error };
}

test("Overwatch independently verifies owner provenance and release boundaries", () => {
  const verified = verifyOverwatchCloudflareUnattendedKeychainInteroperability();
  assert.equal(verified.status, "passed");
  assert.equal(verified.batchId, "BATCH-20260715-008");
  assert.equal(verified.implementationOwner, "Prometheus Infrastructure");
  assert.equal(verified.verificationOwner, "Prometheus Overwatch");
  assert.equal(verified.focusedOwnerTests, 16);
  assert.equal(verified.cloudflareRequestPerformed, false);
  assert.equal(verified.keychainAclModified, false);
  assert.equal(verified.deploymentPerformed, false);
  assert.equal(verified.recommendationInfluence, "OFF");
});

test("Overwatch rejects ownership, classification, remediation, and release weakening", () => {
  const mutations = [
    value => { value.dispatchAudit.implementationOwner = "Prometheus Overwatch"; },
    value => { value.dispatchAudit.overwatchModifiedInfrastructureImplementation = true; },
    value => { value.ownerEvidence[0].sha256AtOwnerCommit = "0".repeat(64); },
    value => { value.ownerImplementationSuccessors[0].successorSha256 = "0".repeat(64); },
    value => { value.ownerVerifierSuccessors[0].successorSha256 = "0".repeat(64); },
    value => { value.dispatchAudit.ownerRepairCommit.commit = "0".repeat(40); },
    value => { value.dispatchAudit.ownerVerifierRepairCommit.commit = "0".repeat(40); },
    value => { value.protectedPredecessorSuccessors[0].successorSha256 = "0".repeat(64); },
    value => { value.protectedPredecessorSuccessors[1].successorOwner = "Prometheus Infrastructure"; },
    value => { value.protectedReleaseWiringTransitions[0].successorSha256 = "0".repeat(64); },
    value => { value.independentRetrievalClassification.executionIdentity = "MISMATCH"; },
    value => { value.independentRetrievalClassification.items[0].presence = "UNKNOWN"; },
    value => { value.independentRetrievalClassification.valuesDisplayedLoggedHashedReportedOrPersisted = true; },
    value => { value.staleProcessContainment.orphanedKeychainReaderTerminated = false; },
    value => { value.classificationBoundary.callerSuppliedItemAllowed = true; },
    value => { value.classificationBoundary.retrievalTimeoutMilliseconds = 0; },
    value => { value.remediationBoundary.wholeKeychainAclChangeAllowed = true; },
    value => { value.remediationBoundary.credentialValueOrIdentityChangeAllowed = true; },
    value => { value.remediationBoundary.postRemediationFourItemRetrievalPassRequired = false; },
    value => { value.remediationBoundary.partialFailureRollsBackNewTrust = false; },
    value => { value.controlBoundary.unattendedDeploymentControl = "ON"; },
    value => { value.executionBoundary.cloudflareRequestPerformed = true; },
    value => { value.executionBoundary.recommendationInfluence = "ON"; },
    value => { value.releaseBoundary.deploymentAuthorized = true; },
    value => { value.releaseBoundary.attendedAclRemediationExecutedByThisBatch = true; }
  ];
  for (const mutate of mutations) {
    const changed = clone(governance);
    mutate(changed);
    assert.equal(evaluate(changed).ok, false);
  }
});

test("Overwatch reproduces fixed safe classification states without secret output", () => {
  const scenarios = [
    [44, "ITEM_ABSENT"],
    [51, "ACL_ACCESS_DENIED"],
    [36, "INTERACTION_REQUIRED"],
    [53, "KEYCHAIN_LOCKED"]
  ];
  for (const [retrievalStatus, reason] of scenarios) {
    const locked = reason === "KEYCHAIN_LOCKED";
    const classification = classifyCloudflareUnattendedKeychain({
      executionIdentity: "MATCHED",
      keychainLockState: locked ? "LOCKED" : "UNLOCKED",
      spawnSyncImpl(_executable, args) {
        if (args.includes("-w")) return result(retrievalStatus);
        return reason === "ITEM_ABSENT" ? result(44) : result(0);
      }
    });
    assert.equal(classification.status, "FAIL");
    assert.ok(classification.items.every(item => item.reason === reason));
    const output = formatCloudflareUnattendedKeychainClassification(classification);
    assert.doesNotMatch(output, /token-value|client-secret|account-value/u);
  }
});

test("Execution-identity mismatch prevents every Keychain subprocess", () => {
  let calls = 0;
  const classification = classifyCloudflareUnattendedKeychain({
    executionIdentity: "MISMATCH",
    keychainLockState: "UNLOCKED",
    spawnSyncImpl() {
      calls += 1;
      return result(0);
    }
  });
  assert.equal(calls, 0);
  assert.equal(classification.status, "FAIL");
  assert.equal(classification.items.length, CLOUDFLARE_UNATTENDED_KEYCHAIN_ITEMS.length);
  assert.ok(classification.items.every(item => (
    item.retrieval === "NOT_RETRIEVABLE"
    && item.reason === "EXECUTION_IDENTITY_MISMATCH"
  )));
});

test("Batch report preserves OFF and no-action boundaries", () => {
  assert.equal(evaluate().ok, true);
  assert.equal(report.boundaries.cloudflareRequestPerformed, false);
  assert.equal(report.boundaries.keychainAclModified, false);
  assert.equal(report.boundaries.unattendedControl, "OFF_UNCONSUMED");
  assert.equal(report.boundaries.prospectiveCollection, "OFF");
  assert.equal(report.boundaries.activeCohorts, 0);
  assert.equal(report.boundaries.recommendationInfluence, "OFF");
});

test("Historical ownership gate ignores unrelated subsystem successors", () => {
  const result = evaluateCloudflareUnattendedKeychainSuccessorOwnership([{
    commit: "dashboard-successor",
    author: "Prometheus Dashboard <dashboard@prometheus.local>",
    committer: "Prometheus Dashboard <dashboard@prometheus.local>",
    paths: ["scripts/verify-dashboard-runtime-workflows.mjs"]
  }]);
  assert.equal(result.ok, true);
});

test("Historical ownership gate rejects protected cross-owner successors", () => {
  const dashboardTouchesOverwatch =
    evaluateCloudflareUnattendedKeychainSuccessorOwnership([{
      commit: "dashboard-crosses-boundary",
      author: "Prometheus Dashboard <dashboard@prometheus.local>",
      committer: "Prometheus Dashboard <dashboard@prometheus.local>",
      paths: [
        "scripts/verify-overwatch-cloudflare-unattended-keychain-interoperability.mjs"
      ]
    }]);
  assert.equal(dashboardTouchesOverwatch.ok, false);

  const overwatchTouchesInfrastructure =
    evaluateCloudflareUnattendedKeychainSuccessorOwnership([{
      commit: "overwatch-crosses-boundary",
      author: "Prometheus Overwatch <overwatch@prometheus.local>",
      committer: "Prometheus Overwatch <overwatch@prometheus.local>",
      paths: ["scripts/lib/cloudflare-unattended-keychain.mjs"]
    }]);
  assert.equal(overwatchTouchesInfrastructure.ok, false);
});
