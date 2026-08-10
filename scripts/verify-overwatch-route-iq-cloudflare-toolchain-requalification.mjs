import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  PUBLIC_FORWARD_ROLLBACK_BUILD_SOURCE,
  verifyPublicForwardRollbackBuildSource
} from "./lib/route-iq-public-forward-rollback.mjs";

const root = resolve(import.meta.dirname, "..");
const startCommit = "2d5caafc52de0c1ee42bce5b370e2232e53fd72f";
const startTree = "25bd1b7015f018edbf4c8371a33598cafb28ebff";
const infrastructureCommit = "da7504352424096869a18b66dc7c4429480393f4";
const securityCommit = "efc242a1bcf5728206fd9fae9d8fce75f642cab7";
const qualificationCommit = "05a167f86c24e935f848dad67dd9df16ee7fac84";
const qualificationTree = "cc95c63a662448007ffd692803b21965b439f4cc";
const qualificationProvenanceCommit = "cbeb848ef571cca913fcc7191350756129d65522";
const qualificationProvenanceTree = "6265cc9b262548ebeabac910c2ec894c22c73a09";
const controlledRehearsalProvenanceCommit = "43b8564b515e9aca02c23cf370aaf7626ad3e617";
const controlledRehearsalProvenanceTree = "0ce7b70b9a56a37505924aca9ba6d5337d8dfc68";
const hostedCheckoutCommit = "26cc9712bf1f303ae6971a17639b56968c3d9006";
const hostedCheckoutTree = "4a31533e398c58f0aafb74f06f9a20679183f364";
const retentionRuntimeGuardCommit = "e4c88b4f449aac021ea9f95e24fc4a062c37c055";
const retentionRuntimeGuardTree = "a518425006cf1065eab90bfcb6dd53980ec95a2e";
const retentionMaintenanceCommit = "d104cd10eec5d093c95cc87ff60e6644b8759bb7";
const retentionMaintenanceTree = "9f670fa1a9435ed553a91aaaf191f3004585d21b";
const rollbackLockAttestationCommit = "014fd82e2106734bdcf7df14fa01ca284c21f847";
const rollbackLockAttestationTree = "d81aae8ad9a2f26f2435d43696b644fc97dc6988";
const governancePath =
  "overwatch/governance/route-iq-wrangler-miniflare-major-transition-requalification-v1.json";
const reportPath =
  "overwatch/reports/BATCH-20260810-001-route-iq-wrangler-miniflare-major-transition-requalification.json";
const infrastructurePath =
  "workers/infrastructure/route-iq-cloudflare-toolchain-compatibility-v1.json";
const securityPath = "security/npm-high-advisory-triage-batch-20260810-001.json";
const augustReadinessSuccessorsPath =
  "overwatch/governance/route-iq-august-1-readiness-successors-v1.json";

const read = path => readFileSync(resolve(root, path), "utf8");
const readJson = path => JSON.parse(read(path));
const sha256 = path => createHash("sha256").update(readFileSync(resolve(root, path))).digest("hex");
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const changedPaths = commit => {
  const output = git("diff-tree", "--no-commit-id", "--name-only", "-r", commit);
  return output ? output.split("\n").sort() : [];
};

const infrastructureFiles = Object.freeze([
  "package-lock.json",
  "package.json",
  "scripts/lib/cloudflare-unattended-launcher.mjs",
  "tests/cloudflare-unattended-runtime-guard.test.mjs",
  "tests/route-iq-business-availability-infrastructure.test.mjs",
  "tests/route-iq-cloudflare-toolchain-compatibility.test.mjs",
  "tests/route-iq-prospective-shadow-infrastructure.test.mjs",
  "tests/route-iq-request-crm-infrastructure.test.mjs",
  "workers/infrastructure/route-iq-cloudflare-toolchain-compatibility-v1.json"
]);
const securityFiles = Object.freeze([
  "security/npm-high-advisory-triage-batch-20260810-001.json",
  "tests/route-iq-npm-high-advisory-triage-batch-20260810-001-security.test.mjs"
]);
const overwatchFiles = Object.freeze([
  "PROMETHEUS_MASTER_ENGINEERING_STATE.md",
  "overwatch/governance/route-iq-wrangler-miniflare-major-transition-requalification-v1.json",
  "overwatch/reports/BATCH-20260810-001-route-iq-wrangler-miniflare-major-transition-requalification.json",
  "package.json",
  "scripts/verify-overwatch-route-iq-cloudflare-toolchain-requalification.mjs",
  "tests/overwatch-route-iq-cloudflare-toolchain-requalification.test.mjs"
]);
const overwatchSuccessorFiles = Object.freeze([
  augustReadinessSuccessorsPath,
  "scripts/verify-overwatch-route-iq-august-1-launch-readiness.mjs",
  "scripts/verify-overwatch-route-iq-cloudflare-toolchain-requalification.mjs",
  "tests/overwatch-route-iq-cloudflare-toolchain-requalification.test.mjs"
]);
const controlledRehearsalSuccessorFiles = Object.freeze([
  "scripts/verify-overwatch-controlled-paid-customer-onboarding-rehearsal-v1.mjs",
  "scripts/verify-overwatch-route-iq-cloudflare-toolchain-requalification.mjs",
  "tests/overwatch-route-iq-cloudflare-toolchain-requalification.test.mjs"
]);
const hostedCheckoutSuccessorFiles = Object.freeze([
  "scripts/verify-overwatch-route-iq-cloudflare-toolchain-requalification.mjs",
  "tests/overwatch-route-iq-cloudflare-toolchain-requalification.test.mjs"
]);
const retentionRuntimeGuardSuccessorFiles = Object.freeze([
  "scripts/verify-overwatch-route-iq-cloudflare-toolchain-requalification.mjs",
  "scripts/verify-overwatch-route-iq-retention-deletion-runtime.mjs",
  "tests/overwatch-route-iq-cloudflare-toolchain-requalification.test.mjs",
  "tests/overwatch-route-iq-retention-deletion-runtime.test.mjs"
]);
const retentionMaintenanceSuccessorFiles = Object.freeze([
  "scripts/verify-overwatch-route-iq-cloudflare-toolchain-requalification.mjs",
  "scripts/verify-overwatch-route-iq-retention-maintenance-deployment-readiness.mjs",
  "tests/overwatch-route-iq-cloudflare-toolchain-requalification.test.mjs",
  "tests/overwatch-route-iq-retention-maintenance-deployment-readiness.test.mjs"
]);
const rollbackLockAttestationFiles = Object.freeze([
  "scripts/lib/route-iq-public-forward-rollback.mjs"
]);
const rollbackQualificationSuccessorFiles = Object.freeze([
  governancePath,
  reportPath,
  "scripts/verify-overwatch-route-iq-cloudflare-toolchain-requalification.mjs",
  "tests/overwatch-route-iq-cloudflare-toolchain-requalification.test.mjs"
]);

function verifyOwnerCommit(commit, parent, identity, subject, files) {
  assert.equal(git("rev-parse", `${commit}^`), parent);
  assert.equal(git("show", "-s", "--format=%an <%ae>", commit), identity);
  assert.equal(git("show", "-s", "--format=%cn <%ce>", commit), identity);
  assert.equal(git("show", "-s", "--format=%s", commit), subject);
  assert.deepEqual(changedPaths(commit), [...files].sort());
}

function lockVersion(packageLock, path) {
  const version = packageLock.packages[path]?.version;
  assert.equal(typeof version, "string", path);
  return version;
}

export function verifyCloudflareToolchainRepositoryContext({
  head,
  originMain,
  currentBranch,
  environment
}) {
  if (environment.GITHUB_ACTIONS === "true") {
    assert.equal(["", "main"].includes(currentBranch), true);
    assert.equal(head, originMain);
    assert.equal(environment.GITHUB_SHA, head);
    assert.equal(environment.GITHUB_REF, "refs/heads/main");
    return;
  }
  assert.equal(currentBranch, "main");
}

export function verifyOverwatchRouteIqCloudflareToolchainRequalification() {
  const governance = readJson(governancePath);
  const report = readJson(reportPath);
  const infrastructure = readJson(infrastructurePath);
  const security = readJson(securityPath);
  const augustReadinessSuccessors = readJson(augustReadinessSuccessorsPath);
  const predecessor = readJson(
    "overwatch/governance/route-iq-dormant-retention-maintenance-deployment-readiness-v1.json"
  );
  const packageJson = readJson("package.json");
  const packageLock = readJson("package-lock.json");
  const head = git("rev-parse", "HEAD");
  const originMain = git("rev-parse", "refs/remotes/origin/main");
  const currentBranch = git("branch", "--show-current");

  assert.equal(git("rev-parse", `${startCommit}^{tree}`), startTree);
  assert.equal(git("merge-base", "--is-ancestor", originMain, head), "");
  verifyCloudflareToolchainRepositoryContext({
    head,
    originMain,
    currentBranch,
    environment: process.env
  });

  verifyOwnerCommit(
    infrastructureCommit,
    startCommit,
    "Prometheus Infrastructure <infrastructure@prometheus.local>",
    "infrastructure: update Cloudflare compatibility toolchain",
    infrastructureFiles
  );
  verifyOwnerCommit(
    securityCommit,
    infrastructureCommit,
    "Prometheus Security <security@prometheus.local>",
    "security: accept zero-high Cloudflare toolchain graph",
    securityFiles
  );
  verifyOwnerCommit(
    qualificationCommit,
    securityCommit,
    "Prometheus Overwatch <overwatch@prometheus.local>",
    "overwatch: qualify Cloudflare toolchain transition",
    overwatchFiles
  );
  assert.equal(git("show", "-s", "--format=%T", qualificationCommit), qualificationTree);
  verifyOwnerCommit(
    qualificationProvenanceCommit,
    qualificationCommit,
    "Prometheus Overwatch <overwatch@prometheus.local>",
    "overwatch: repair toolchain qualification provenance",
    overwatchSuccessorFiles
  );
  assert.equal(git("show", "-s", "--format=%T", qualificationProvenanceCommit),
    qualificationProvenanceTree);
  verifyOwnerCommit(
    controlledRehearsalProvenanceCommit,
    qualificationProvenanceCommit,
    "Prometheus Overwatch <overwatch@prometheus.local>",
    "overwatch: repair controlled rehearsal provenance",
    controlledRehearsalSuccessorFiles
  );
  assert.equal(git("show", "-s", "--format=%T", controlledRehearsalProvenanceCommit),
    controlledRehearsalProvenanceTree);
  verifyOwnerCommit(
    hostedCheckoutCommit,
    controlledRehearsalProvenanceCommit,
    "Prometheus Overwatch <overwatch@prometheus.local>",
    "overwatch: support exact hosted detached checkout",
    hostedCheckoutSuccessorFiles
  );
  assert.equal(git("show", "-s", "--format=%T", hostedCheckoutCommit), hostedCheckoutTree);
  verifyOwnerCommit(
    retentionRuntimeGuardCommit,
    hostedCheckoutCommit,
    "Prometheus Overwatch <overwatch@prometheus.local>",
    "overwatch: narrow retention protected-path guard",
    retentionRuntimeGuardSuccessorFiles
  );
  assert.equal(git("show", "-s", "--format=%T", retentionRuntimeGuardCommit),
    retentionRuntimeGuardTree);
  verifyOwnerCommit(
    retentionMaintenanceCommit,
    retentionRuntimeGuardCommit,
    "Prometheus Overwatch <overwatch@prometheus.local>",
    "overwatch: compose toolchain lock successor into retention readiness",
    retentionMaintenanceSuccessorFiles
  );
  assert.equal(git("show", "-s", "--format=%T", retentionMaintenanceCommit),
    retentionMaintenanceTree);
  verifyOwnerCommit(
    rollbackLockAttestationCommit,
    retentionMaintenanceCommit,
    "Prometheus Infrastructure <infrastructure@prometheus.local>",
    "infrastructure: advance public rollback lock attestation",
    rollbackLockAttestationFiles
  );
  assert.equal(git("show", "-s", "--format=%T", rollbackLockAttestationCommit),
    rollbackLockAttestationTree);
  verifyOwnerCommit(
    head,
    rollbackLockAttestationCommit,
    "Prometheus Overwatch <overwatch@prometheus.local>",
    "overwatch: qualify rollback lock attestation successor",
    rollbackQualificationSuccessorFiles
  );

  assert.equal(governance.batchId, "BATCH-20260810-001");
  assert.equal(report.batchId, governance.batchId);
  assert.equal(sha256(infrastructurePath),
    governance.authoritativeRecords.infrastructure.sha256);
  assert.equal(sha256(securityPath), governance.authoritativeRecords.security.sha256);
  assert.equal(
    augustReadinessSuccessors.overwatchCurrentEvidence.some(item =>
      item.path === "package.json"
      && item.previousSha256 === "933e4e3e3cbbe4f63e3826b238b09a3c02330d90a60ee4a8bfcf64dac966fa49"
      && item.successorSha256 === "f6b097932650a9a504bf81b217e4efe6092d1bebc6b863bc9dd0748192e2d5d8"
    ),
    true
  );
  assert.equal(sha256("package.json"),
    "f6b097932650a9a504bf81b217e4efe6092d1bebc6b863bc9dd0748192e2d5d8");
  assert.equal(sha256(governance.authoritativeRecords.immutablePredecessorGovernance.path),
    governance.authoritativeRecords.immutablePredecessorGovernance.sha256);
  assert.equal(sha256(governance.authoritativeRecords.immutablePredecessorReport.path),
    governance.authoritativeRecords.immutablePredecessorReport.sha256);

  assert.deepEqual(governance.selectedToolchain.direct, {
    wrangler: "4.120.1",
    miniflare: "5.20260804.0-alpha",
    ajv: "8.20.0",
    "jsonc-parser": "3.2.0"
  });
  assert.equal(packageJson.devDependencies.wrangler, "4.120.1");
  assert.equal(packageJson.devDependencies.miniflare, "5.20260804.0-alpha");
  assert.equal(packageJson.overrides, undefined);
  assert.equal(packageJson.resolutions, undefined);

  const expectedLock = {
    "node_modules/wrangler": "4.120.1",
    "node_modules/miniflare": "5.20260804.0-alpha",
    "node_modules/workerd": "1.20260804.1",
    "node_modules/sharp": "0.35.2",
    "node_modules/undici": "7.29.0",
    "node_modules/ajv": "8.20.0",
    "node_modules/jsonc-parser": "3.2.0",
    "node_modules/@cloudflare/kv-asset-handler": "0.5.0",
    "node_modules/@cloudflare/unenv-preset": "2.16.1",
    "node_modules/blake3-wasm": "2.1.5",
    "node_modules/wrangler/node_modules/esbuild": "0.28.1",
    "node_modules/path-to-regexp": "6.3.0",
    "node_modules/unenv": "2.0.0-rc.24",
    "node_modules/ws": "8.21.0",
    "node_modules/youch": "4.1.0-beta.10",
    "node_modules/@cspotcode/source-map-support": "0.8.1"
  };
  for (const [path, version] of Object.entries(expectedLock)) {
    assert.equal(lockVersion(packageLock, path), version, path);
  }

  assert.equal(infrastructure.priorFailureRootCauses.length, 9);
  assert.deepEqual(infrastructure.priorRejectedCandidate, {
    wrangler: "4.120.0",
    miniflare: "5.20260801.1-alpha",
    workerd: "1.20260801.1",
    sharp: "0.35.2",
    undici: "7.29.0",
    tests: 121,
    passed: 112,
    failed: 9
  });
  assert.equal(infrastructure.compatibilityGroup.requiredPasses, 121);
  assert.equal(infrastructure.compatibilityGroup.requiredFailures, 0);
  assert.equal(infrastructure.compatibilityGroup.requiredSkips, 0);
  assert.equal(security.auditDisposition.after.allDependencies.total, 0);
  assert.equal(security.auditDisposition.after.productionOnly.total, 0);
  assert.deepEqual(security.auditDisposition.removedPackageLevelHighFindings,
    ["miniflare", "sharp", "undici", "wrangler"]);
  const release = governance.releaseIdentityContinuity;
  assert.deepEqual(verifyPublicForwardRollbackBuildSource(root),
    PUBLIC_FORWARD_ROLLBACK_BUILD_SOURCE);
  assert.equal(governance.releaseReproducibilityRepair.infrastructureCommit,
    rollbackLockAttestationCommit);
  assert.equal(governance.releaseReproducibilityRepair.changedPathSha256,
    sha256("scripts/lib/route-iq-public-forward-rollback.mjs"));
  assert.equal(governance.releaseReproducibilityRepair.currentPackageLockSha256,
    sha256("package-lock.json"));
  assert.equal(governance.releaseReproducibilityRepair.publicRollbackArtifactSha256,
    release.publicRollbackArtifactSha256);
  assert.equal(governance.releaseReproducibilityRepair.artifactByteIdentical, true);
  assert.equal(report.publicRollbackReproducibilityRepair.infrastructureCommit,
    rollbackLockAttestationCommit);
  assert.equal(report.publicRollbackReproducibilityRepair.byteIdentical, true);

  assert.equal(release.artifactSha256, predecessor.releasePackage.artifactSha256);
  assert.equal(release.manifestSha256, predecessor.releasePackage.manifestSha256);
  assert.equal(release.configurationSha256, predecessor.releasePackage.configurationSha256);
  assert.equal(release.contentSha256, predecessor.releasePackage.contentSha256);
  assert.equal(release.retentionPolicySha256, predecessor.releasePackage.retentionPolicySha256);
  assert.equal(release.deletionRuntimeSha256, predecessor.releasePackage.deletionRuntimeSha256);
  assert.equal(release.maintenanceRuntimeSha256, predecessor.releasePackage.maintenanceRuntimeSha256);
  assert.equal(release.privateForwardPayloadSha256,
    predecessor.releasePackage.privateWorkflowContinuity.currentForwardPayloadSha256);
  assert.equal(release.privateRollbackBundleSha256,
    predecessor.releasePackage.privateWorkflowContinuity.rollbackBundleSha256);
  assert.equal(release.forwardRevertSha256, predecessor.forwardRollback.sha256);

  const protectedReleasePaths = [
    predecessor.releasePackage.contract.path,
    predecessor.releasePackage.builder.path,
    predecessor.releasePackage.runtimeContract.path,
    predecessor.releasePackage.admissionProducer.path,
    predecessor.releasePackage.privateWorkflowContinuity.path,
    predecessor.forwardRollback.path,
    "workers/infrastructure/route-iq-private-forward-rollback-candidate-v3.json",
    "workers/infrastructure/route-iq-public-forward-rollback-v1.json"
  ];
  assert.equal(git("diff", "--name-only", startCommit, head, "--", ...protectedReleasePaths), "");
  assert.equal(git("diff", "--name-only", startCommit, head, "--", ".github/workflows"), "");

  assert.match(packageJson.scripts.pretest, /security:cloudflare-toolchain:check/u);
  assert.match(packageJson.scripts.pretest, /overwatch:cloudflare-toolchain:check/u);
  assert.equal(governance.productionBoundary.cloudflareContactCount, 0);
  assert.equal(governance.productionBoundary.deploymentCount, 0);
  assert.equal(governance.productionBoundary.productionMutationCount, 0);
  assert.equal(governance.protectedState.collection, "OFF");
  assert.equal(governance.protectedState.activeCohorts, 0);
  assert.equal(governance.protectedState.recommendationInfluence, "OFF");

  return {
    batchId: governance.batchId,
    head,
    tree: git("rev-parse", "HEAD^{tree}"),
    qualificationCommit,
    qualificationProvenanceCommit,
    controlledRehearsalProvenanceCommit,
    hostedCheckoutCommit,
    retentionRuntimeGuardCommit,
    retentionMaintenanceCommit,
    rollbackLockAttestationCommit,
    rollbackQualificationSuccessorCommit: head,
    compatibility: governance.compatibility.supportedCandidate,
    allDependencyHigh: security.auditDisposition.after.allDependencies.high,
    productionHigh: security.auditDisposition.after.productionOnly.high,
    releaseIdentitiesUnchanged: true,
    publicRollbackArtifactSha256: release.publicRollbackArtifactSha256,
    augustReadinessPackageSuccessorCurrent: true,
    cloudflareContactCount: 0,
    deploymentCount: 0,
    productionMutationCount: 0
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.stdout.write(`${JSON.stringify(verifyOverwatchRouteIqCloudflareToolchainRequalification())}\n`);
}
