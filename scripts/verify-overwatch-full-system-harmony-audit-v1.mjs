#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { verifyFullSystemHarmonyAuditV1 } from "./verify-full-system-harmony-audit-v1.mjs";

const root = resolve(import.meta.dirname, "..");
const governancePath = "overwatch/governance/full-system-harmony-audit-v1.json";
const reportPath = "overwatch/reports/BATCH-20260731-002-full-system-harmony-audit-v1.json";
const baseline = "1aa1372aeb9558e117cc2d83c6553b952d268730";
const lastOwnerCommit = "7cec0871ec24f6fe75091f075abf86c4ab01f7f4";
export const dashboardFounderReadinessSuccessor = Object.freeze({
  commit: "30ea86e0a2d0176cc22bad583a01829b3f379db3",
  parent: "231cd0110186a2347479eba4f6e05806b0db9652",
  tree: "b863b743a7f54cb4ff784c60ee418addee963b97",
  identity: "Prometheus Dashboard <dashboard@prometheus.local>",
  subject: "dashboard: await Founder snapshot readiness",
  evidence: Object.freeze([
    Object.freeze({
      path: "scripts/verify-dashboard-runtime-workflows.mjs",
      sha256: "8ff5c687150a0b500dc6e8672b73156495c86021ae873e6ec13ac08ce720ee83"
    }),
    Object.freeze({
      path: "tests/dashboard-route-iq-product-focus.test.mjs",
      sha256: "8cdf3ae813a53279a18877541b3ab60e7e3e8bf8bc11d0d8524be853ecdcf5cf"
    })
  ])
});
export const crmResearchBoundaryValidatorSuccessor = Object.freeze({
  commit: "7cec0871ec24f6fe75091f075abf86c4ab01f7f4",
  parent: "96997e8857ab6008c42cba0daf757104ade23e77",
  tree: "6ed55665ea2b4116ca0b9a166d7e132ea248af24",
  identity: "Prometheus CRM <crm@prometheus.local>",
  subject: "crm: align production validator with research boundary",
  evidence: Object.freeze([
    Object.freeze({
      path: "scripts/validate-crm-production-store.mjs",
      sha256: "3032ee4837fc0e54085d89349760c5ff36bbdb987b4bacc3d688ee11c574484a"
    })
  ])
});

const readJson = path => JSON.parse(readFileSync(resolve(root, path), "utf8"));
const git = args => execFileSync("/usr/bin/git", args, {
  cwd: root,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"]
}).trim();
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");

export function validateDashboardFounderReadinessSuccessor(
  record = dashboardFounderReadinessSuccessor
) {
  assert.deepEqual(record, dashboardFounderReadinessSuccessor,
    "Dashboard Founder-readiness successor drifted");
  const metadata = git([
    "show", "-s", "--format=%H%n%P%n%T%n%an <%ae>%n%cn <%ce>%n%s",
    record.commit
  ]).split("\n");
  assert.deepEqual(metadata, [
    record.commit,
    record.parent,
    record.tree,
    record.identity,
    record.identity,
    record.subject
  ], "Dashboard Founder-readiness provenance drifted");
  const paths = git([
    "diff-tree", "--no-commit-id", "--name-only", "-r", record.commit
  ]).split("\n").filter(Boolean);
  assert.deepEqual(paths, record.evidence.map(item => item.path),
    "Dashboard Founder-readiness path set drifted");
  for (const item of record.evidence) {
    const bytes = execFileSync("/usr/bin/git", [
      "show", `${record.commit}:${item.path}`
    ], { cwd: root, encoding: null, stdio: ["ignore", "pipe", "pipe"] });
    assert.equal(sha256(bytes), item.sha256,
      `Dashboard Founder-readiness evidence drifted: ${item.path}`);
  }
  return record;
}

export function validateCrmResearchBoundaryValidatorSuccessor(
  record = crmResearchBoundaryValidatorSuccessor
) {
  assert.deepEqual(record, crmResearchBoundaryValidatorSuccessor,
    "CRM research-boundary validator successor drifted");
  const metadata = git([
    "show", "-s", "--format=%H%n%P%n%T%n%an <%ae>%n%cn <%ce>%n%s",
    record.commit
  ]).split("\n");
  assert.deepEqual(metadata, [
    record.commit,
    record.parent,
    record.tree,
    record.identity,
    record.identity,
    record.subject
  ], "CRM research-boundary validator provenance drifted");
  const paths = git([
    "diff-tree", "--no-commit-id", "--name-only", "-r", record.commit
  ]).split("\n").filter(Boolean);
  assert.deepEqual(paths, record.evidence.map(item => item.path),
    "CRM research-boundary validator path set drifted");
  for (const item of record.evidence) {
    const bytes = execFileSync("/usr/bin/git", [
      "show", `${record.commit}:${item.path}`
    ], { cwd: root, encoding: null, stdio: ["ignore", "pipe", "pipe"] });
    assert.equal(sha256(bytes), item.sha256,
      `CRM research-boundary validator evidence drifted: ${item.path}`);
  }
  return record;
}

export function verifyOverwatchFullSystemHarmonyAudit({
  governance = readJson(governancePath),
  report = readJson(reportPath)
} = {}) {
  validateDashboardFounderReadinessSuccessor();
  validateCrmResearchBoundaryValidatorSuccessor();
  assert.equal(governance.governanceId, "full-system-harmony-audit-v1");
  assert.equal(governance.batchId, "BATCH-20260731-002");
  assert.equal(governance.ownerSubsystem, "Prometheus Overwatch");
  assert.equal(governance.acceptedBaseline.commit, baseline);
  assert.equal(governance.acceptedBaseline.tree,
    "46bc310d7c798a1c4433e244cd0c38da8df4d10c");
  assert.equal(governance.acceptedBaseline.branch, "main");
  assert.equal(governance.acceptedBaseline.earlyGitHubHandoffRun, 30640693288);
  assert.equal(governance.acceptedBaseline.publicWorker,
    "6a8713c0-0712-4cda-8a13-daa893ca45f2");
  assert.equal(governance.acceptedBaseline.privateWorkerPrefix, "b121a01a");
  assert.equal(governance.acceptedBaseline.crmReceipt,
    "riq_receipt_e74e57903a211291a9f1f37a");

  const commits = git(["rev-list", "--reverse", `${baseline}..${lastOwnerCommit}`])
    .split("\n");
  assert.deepEqual(commits, governance.ownerCommits.map(record => record.commit));
  for (const record of governance.ownerCommits) {
    const identities = git([
      "show", "-s", "--format=%an <%ae>%n%cn <%ce>", record.commit
    ]).split("\n");
    assert.deepEqual(identities, [record.owner, record.owner],
      `owner identity drifted for ${record.commit}`);
  }

  assert.equal(governance.subsystems.length, 20);
  assert.equal(new Set(governance.subsystems.map(item => item.id)).size, 20);
  for (const subsystem of governance.subsystems) {
    for (const key of [
      "owner", "authority", "entry", "authentication", "tenantBoundary",
      "failure", "audit", "recovery", "activation"
    ]) assert.ok(subsystem[key], `${subsystem.id}.${key}`);
  }
  assert.equal(governance.contractMatrix.length, 19);
  assert.ok(governance.contractMatrix.every(item => item.result.startsWith("PASS")));
  assert.equal(Object.keys(governance.stateAuthorities).length, 18);
  assert.deepEqual(governance.defectLedger.p0, []);
  assert.deepEqual(governance.defectLedger.p1, []);
  assert.ok(governance.defectLedger.p2.length > 0);
  assert.ok(governance.defectLedger.p3.length > 0);
  assert.equal(governance.decision, "CONDITIONAL_GO");

  assert.deepEqual(governance.protectedState, {
    collection: "OFF",
    activeCohorts: 0,
    recommendationInfluence: "OFF",
    providerRefresh: "OFF",
    scheduler: "OFF",
    realCustomerActivation: "OFF",
    anthonyMapped: false,
    activeBusinesses: 0,
    reserveBusinesses: 0,
    quarantinedBusinesses: 398,
    productionCustomerWrites: 0,
    productionCrmWrites: 0,
    productionReceiptMutations: 0,
    stripeMode: "NOT_LIVE",
    liveModeObjectsCreated: 0,
    charges: 0,
    realRepresentativesActivated: 0,
    invitationsSent: 0,
    publicWorkerMutationAllowed: false,
    secretExposure: false
  });

  assert.equal(report.batchId, governance.batchId);
  assert.equal(report.owner, governance.ownerSubsystem);
  assert.equal(report.executiveVerdict, governance.decision);
  assert.equal(report.repairs.length, governance.ownerCommits.length);
  assert.equal(report.releaseBoundary.target, "prometheus-iq");
  assert.equal(report.releaseBoundary.runtimeRepairRequired, true);
  assert.equal(report.releaseBoundary.publicWorkerMutationAllowed, false);
  assert.equal(report.releaseBoundary.productionCustomerMutationAllowed, false);
  assert.equal(report.releaseBoundary.productionCrmMutationAllowed, false);
  assert.equal(report.releaseBoundary.liveBillingAllowed, false);
  assert.equal(report.releaseBoundary.workflowDispatched, false);
  assert.equal(report.releaseBoundary.deploymentPerformed, false);
  assert.equal(report.releaseBoundary.rollbackPerformed, false);
  assert.ok(report.externalPrerequisites.length >= 6);

  assert.equal(verifyFullSystemHarmonyAuditV1().status,
    "FULL_SYSTEM_HARMONY_AUDIT_V1_VERIFIED");
  return Object.freeze({
    status: "OVERWATCH_FULL_SYSTEM_HARMONY_AUDIT_V1_VERIFIED",
    ownerCommitCount: governance.ownerCommits.length,
    subsystemCount: governance.subsystems.length,
    contractCount: governance.contractMatrix.length,
    decision: governance.decision
  });
}

const isMain = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const result = verifyOverwatchFullSystemHarmonyAudit();
    process.stdout.write(
      `${result.status} (${result.ownerCommitCount} owner commits; `
      + `${result.subsystemCount} subsystems; ${result.contractCount} contracts; `
      + `${result.decision})\n`
    );
  } catch {
    process.stdout.write("OVERWATCH_FULL_SYSTEM_HARMONY_AUDIT_V1_FAILED\n");
    process.exitCode = 1;
  }
}
