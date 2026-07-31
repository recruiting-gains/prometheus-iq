#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const governancePath =
  "overwatch/governance/paid-customer-revenue-readiness-v1.json";
const reportPath =
  "overwatch/reports/BATCH-20260731-001-paid-customer-revenue-readiness-v1.json";
const baseline = "f78d360c588e96fbbd91c0cbbe52a4d4cca4845c";
const lastOwnerCommit = "bf0a651f8b7ba3620be1e7fb34294804094f1a5d";
const expectedPrivate = "2f2b059b-8776-4d70-8848-1a0c5d5b18d4";
const expectedPublic = "6a8713c0-0712-4cda-8a13-daa893ca45f2";

const readJson = path =>
  JSON.parse(readFileSync(resolve(root, path), "utf8"));
const git = args => execFileSync("/usr/bin/git", args, {
  cwd: root,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"]
}).trim();

export function verifyPaidCustomerRevenueReadinessGovernance({
  governance = readJson(governancePath),
  report = readJson(reportPath)
} = {}) {
  assert.equal(governance.governanceId,
    "paid-customer-revenue-readiness-v1");
  assert.equal(governance.batchId, "BATCH-20260731-001");
  assert.equal(governance.ownerSubsystem, "Prometheus Overwatch");
  assert.equal(governance.acceptedBaseline.commit, baseline);
  assert.equal(governance.acceptedBaseline.privateWorker, expectedPrivate);
  assert.equal(governance.acceptedBaseline.publicWorker, expectedPublic);
  assert.equal(governance.commercialDecision.maximumVerdict,
    "CONDITIONAL_GO");
  assert.equal(governance.commercialDecision.liveBilling, "BLOCKED");
  assert.equal(governance.commercialDecision.customerActivation, "OFF");
  for (const key of [
    "legalEntity", "ein", "banking", "stripeAccount", "pricing", "tax",
    "refunds"
  ]) {
    assert.equal(governance.commercialDecision[key],
      "FOUNDER_DECISION_REQUIRED");
  }
  assert.deepEqual(governance.defectLedger.p0, []);
  assert.deepEqual(governance.defectLedger.p1, []);
  assert.ok(governance.defectLedger.p2.length > 0);
  assert.ok(governance.defectLedger.p3.length > 0);
  assert.deepEqual(governance.protectedState, {
    collection: "OFF",
    activeCohorts: 0,
    recommendationInfluence: "OFF",
    providerRefresh: "OFF",
    scheduler: "OFF",
    customerActivation: "OFF",
    anthonyMapped: false,
    activeBusinesses: 0,
    reserveBusinesses: 0,
    quarantinedBusinesses: 398,
    crmReceipt: "riq_receipt_e74e57903a211291a9f1f37a",
    crmMutationAllowed: false,
    publicWorkerMutationAllowed: false
  });

  const commits = git([
    "rev-list", "--reverse", `${baseline}..${lastOwnerCommit}`
  ]).split("\n");
  assert.deepEqual(commits,
    governance.ownerCommits.map(record => record.commit));
  for (const record of governance.ownerCommits) {
    const metadata = git([
      "show", "-s", "--format=%an <%ae>%n%cn <%ce>", record.commit
    ]).split("\n");
    assert.deepEqual(metadata, [record.owner, record.owner],
      `owner identity drifted for ${record.commit}`);
  }

  assert.equal(report.batchId, governance.batchId);
  assert.equal(report.sourceDetermination.verdict, "CONDITIONAL_GO");
  assert.equal(report.sourceDetermination.liveBillingReady, false);
  assert.equal(report.sourceDetermination.liveCustomerActivationReady, false);
  assert.equal(report.sourceDetermination.intelligenceInfluence, "ZERO");
  assert.equal(report.releaseBoundary.target, "prometheus-iq");
  assert.equal(report.releaseBoundary.publicWorkerMutationAllowed, false);
  assert.equal(report.releaseBoundary.productionCustomerMutationAllowed, false);
  assert.equal(report.releaseBoundary.liveBillingAllowed, false);
  assert.equal(report.releaseBoundary.workflowDispatched, false);
  assert.equal(report.releaseBoundary.deploymentPerformed, false);
  return {
    ownerCommitCount: governance.ownerCommits.length,
    verdict: report.sourceDetermination.verdict,
    protectedState: governance.protectedState
  };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const result = verifyPaidCustomerRevenueReadinessGovernance();
  process.stdout.write(
    `Paid-customer revenue readiness Overwatch verification PASS (${result.ownerCommitCount} owner commits; ${result.verdict})\n`
  );
}
