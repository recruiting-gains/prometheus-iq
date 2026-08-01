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
const lastOwnerCommit = "e290d48bad72681e654a1147fc34ffad5fe91eb7";
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
export const intelligenceProtectedConsumerSuccessor = Object.freeze({
  commit: "766a5da99c32b796143e2d6ab3f3884e3c46a407",
  parent: "aabcf0c090e92e1986125a6b9845737803d15f12",
  tree: "91f529230db9f5ff63ff928f911c63087099cac7",
  identity: "Prometheus Intelligence Engine <intelligence@prometheus.local>",
  subject: "intelligence: compose protected consumer successors",
  evidence: Object.freeze([
    Object.freeze({
      path: "intelligence/provenance/verify-paid-customer-revenue-readiness-protected-consumers-v1.mjs",
      sha256: "89529db78c45767e77f2daa0fd88c20fb7eba6aed4293b333e1e0d1afe9801ce"
    }),
    Object.freeze({
      path: "tests/intelligence-architecture.test.mjs",
      sha256: "cc0512118357d6798d6f30c0cc540769e4839f8daeedd261f3a2c34332ac02d2"
    })
  ])
});
export const intelligenceProtectedDriftFixtureSuccessor = Object.freeze({
  commit: "ff63d927c121a0030a0cbb1f041a626ffe7968bc",
  parent: "f17802246b06dbd1aca0f56fb257de34d78ecb24",
  tree: "79601cf5e229578ebc44efc07908a9352d6d3575",
  identity: "Prometheus Intelligence Engine <intelligence@prometheus.local>",
  subject: "intelligence: align protected drift rejection fixture",
  evidence: Object.freeze([
    Object.freeze({
      path: "tests/read-only-field-session-learning.test.mjs",
      sha256: "0966415b41fb51742fd8328efbec5dce6f0c1d137abb48c37726ed15824e8cdc"
    })
  ])
});
export const currentHarmonySuccessorCompositionRepair = Object.freeze({
  commit: "f52e623f0cb9c37a7f9953bec221b52417ecfc51",
  parent: "ae1978d82b2e54edbd31638649f853de1ba24ee8",
  tree: "f6d75a51c1f0ff1bee113a67483da0e60cfcd75c",
  identity: "Prometheus Overwatch <overwatch@prometheus.local>",
  subject: "overwatch: compose current harmony successors",
  evidence: Object.freeze([
    Object.freeze({
      path: "scripts/verify-overwatch-public-deployment-workflow-v2.mjs",
      sha256: "c9aca5d0af0bce1c675bffff4558e55cd7918d0e6b011f9747a716a6a2b7bdff"
    }),
    Object.freeze({
      path: "scripts/verify-release-provenance-repair.mjs",
      sha256: "f90dca1bcb0adcf5d349c2b520621dbcb2f000ab7737900ecb85eb6f230530b2"
    }),
    Object.freeze({
      path: "tests/overwatch-public-deployment-workflow-v2.test.mjs",
      sha256: "b15f05c7a03063319cf66620a4d0c1f7fcdfe4690202932666214ade5d95f18d"
    }),
    Object.freeze({
      path: "tests/release-provenance-repair.test.mjs",
      sha256: "ea4c859e23750b6e47ae063d0605ed53e2be8d836396bca4ac54448cfb40e49c"
    })
  ])
});
export const augustReadinessHarmonySuccessorRepair = Object.freeze({
  commit: "e290d48bad72681e654a1147fc34ffad5fe91eb7",
  parent: "1e59eab1dea0dc1e45fde872d62a30513af06fc8",
  tree: "914783e58b76eb47a3ca36dc4ecadae8621cf013",
  identity: "Prometheus Overwatch <overwatch@prometheus.local>",
  subject: "overwatch: compose harmony public workflow successor",
  evidence: Object.freeze([
    Object.freeze({
      path: "overwatch/governance/route-iq-august-1-readiness-successors-v1.json",
      sha256: "db8478388d8c18563d3e6ee37939141056143f387f2150475823c8f062cdc88d"
    }),
    Object.freeze({
      path: "scripts/verify-overwatch-route-iq-august-1-launch-readiness.mjs",
      sha256: "4e109e596f22deb715677b7e570699bd21131ee766152f1c4bbcc9294411fdfe"
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

export function validateIntelligenceProtectedConsumerSuccessor(
  record = intelligenceProtectedConsumerSuccessor
) {
  assert.deepEqual(record, intelligenceProtectedConsumerSuccessor,
    "Intelligence protected-consumer successor drifted");
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
  ], "Intelligence protected-consumer provenance drifted");
  const paths = git([
    "diff-tree", "--no-commit-id", "--name-only", "-r", record.commit
  ]).split("\n").filter(Boolean);
  assert.deepEqual(paths, record.evidence.map(item => item.path),
    "Intelligence protected-consumer path set drifted");
  for (const item of record.evidence) {
    const bytes = execFileSync("/usr/bin/git", [
      "show", `${record.commit}:${item.path}`
    ], { cwd: root, encoding: null, stdio: ["ignore", "pipe", "pipe"] });
    assert.equal(sha256(bytes), item.sha256,
      `Intelligence protected-consumer evidence drifted: ${item.path}`);
  }
  return record;
}

export function validateIntelligenceProtectedDriftFixtureSuccessor(
  record = intelligenceProtectedDriftFixtureSuccessor
) {
  assert.deepEqual(record, intelligenceProtectedDriftFixtureSuccessor,
    "Intelligence protected-drift fixture successor drifted");
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
  ], "Intelligence protected-drift fixture provenance drifted");
  const paths = git([
    "diff-tree", "--no-commit-id", "--name-only", "-r", record.commit
  ]).split("\n").filter(Boolean);
  assert.deepEqual(paths, record.evidence.map(item => item.path),
    "Intelligence protected-drift fixture path set drifted");
  for (const item of record.evidence) {
    const bytes = execFileSync("/usr/bin/git", [
      "show", `${record.commit}:${item.path}`
    ], { cwd: root, encoding: null, stdio: ["ignore", "pipe", "pipe"] });
    assert.equal(sha256(bytes), item.sha256,
      `Intelligence protected-drift fixture evidence drifted: ${item.path}`);
  }
  return record;
}

export function validateCurrentHarmonySuccessorCompositionRepair(
  record = currentHarmonySuccessorCompositionRepair
) {
  assert.deepEqual(record, currentHarmonySuccessorCompositionRepair,
    "Current harmony successor-composition repair drifted");
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
  ], "Current harmony successor-composition provenance drifted");
  const paths = git([
    "diff-tree", "--no-commit-id", "--name-only", "-r", record.commit
  ]).split("\n").filter(Boolean);
  assert.deepEqual(paths, record.evidence.map(item => item.path),
    "Current harmony successor-composition path set drifted");
  for (const item of record.evidence) {
    const bytes = execFileSync("/usr/bin/git", [
      "show", `${record.commit}:${item.path}`
    ], { cwd: root, encoding: null, stdio: ["ignore", "pipe", "pipe"] });
    assert.equal(sha256(bytes), item.sha256,
      `Current harmony successor-composition evidence drifted: ${item.path}`);
  }
  return record;
}

export function validateAugustReadinessHarmonySuccessorRepair(
  record = augustReadinessHarmonySuccessorRepair
) {
  assert.deepEqual(record, augustReadinessHarmonySuccessorRepair,
    "August readiness harmony-successor repair drifted");
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
  ], "August readiness harmony-successor provenance drifted");
  const paths = git([
    "diff-tree", "--no-commit-id", "--name-only", "-r", record.commit
  ]).split("\n").filter(Boolean);
  assert.deepEqual(paths, record.evidence.map(item => item.path),
    "August readiness harmony-successor path set drifted");
  for (const item of record.evidence) {
    const bytes = execFileSync("/usr/bin/git", [
      "show", `${record.commit}:${item.path}`
    ], { cwd: root, encoding: null, stdio: ["ignore", "pipe", "pipe"] });
    assert.equal(sha256(bytes), item.sha256,
      `August readiness harmony-successor evidence drifted: ${item.path}`);
  }
  return record;
}

export function verifyOverwatchFullSystemHarmonyAudit({
  governance = readJson(governancePath),
  report = readJson(reportPath)
} = {}) {
  validateDashboardFounderReadinessSuccessor();
  validateCrmResearchBoundaryValidatorSuccessor();
  validateIntelligenceProtectedConsumerSuccessor();
  validateIntelligenceProtectedDriftFixtureSuccessor();
  validateCurrentHarmonySuccessorCompositionRepair();
  validateAugustReadinessHarmonySuccessorRepair();
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
