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
import {
  verifyOverwatchGithubActionsNode24PinSuccessor
} from "./verify-overwatch-github-actions-node24-pin-successor.mjs";
import {
  validateAugust1ReadinessSuccessors
} from "./verify-overwatch-route-iq-august-1-launch-readiness.mjs";
import {
  hasGovernedLearningPayloadInfrastructureSuccessor,
  hasOutcomeSemanticIntegrityPayloadInfrastructureSuccessor,
  hasPrivateWorkflowV2DashboardVisualDeployParitySuccessor
} from "./verify-overwatch-github-actions-private-worker-deployment.mjs";

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
const rollbackQualificationCommit = "3d646bffde28b1ef995ae03af5976a6db1105430";
const rollbackQualificationTree = "d914cbc195982ac27b6b93e045579b191a52eb7d";
const activeDeploymentPolicyCommit = "d55a983134be40bf10777df293ca593e7583f138";
const activeDeploymentPolicyTree = "fcc850958e92d1f75eece476d6047b58972249d0";
const governedLearningPayloadCommit = "a80916d6281b3e584de46508d9d4b2e08f582391";
const outcomeSemanticIntegrityPayloadCommit =
  "9c85a32f296eb44cff59cf101615e133960fdd93";
const dashboardVisualDeployParityCommit =
  "6f77e2ae856e3bc90d3a44e1b0c53fc302dd2741";
const activePolicyQualificationCommit = "ab081a9e9f56f4db87d20c6b02aecf082b96ac4b";
const activePolicyQualificationTree = "6b77b299971a860ae40c0207c83c588674f352d2";
const verificationCompositionRepairCommit = "057ae93b538fb26f95193530914830d3633852d8";
const verificationCompositionRepairTree = "f22e12258129023de1e620fd9074234b1295bbec";
const publicLaneQualificationRepairCommit = "6555c88543534fb330b22cb321a88b1ab43c89fb";
const publicLaneQualificationRepairTree = "d3dbc60e9a0c1dfe356ff86cde691881b422846b";
const controlledRehearsalRuntimeGuardRepairCommit =
  "f55b3b78d805f2d59b18fa0fb08817c95a3ea2ea";
const controlledRehearsalRuntimeGuardRepairTree =
  "93e42d7d24a5eb373d369a177ba76e5223d7af44";
const keychainInteroperabilityLauncherRepairCommit =
  "0a4e7aae6e1c86de1750159b073cbc40955f5773";
const keychainInteroperabilityLauncherRepairTree =
  "ffec971b2c66d0b049c2872fcd8ce0c36cb2cab1";
const hostedRegressionFixtureRepairCommit =
  "da547614ad0968352240dba314e23aa6111341a2";
const hostedRegressionFixtureRepairTree =
  "7e3c8f53884b88d0c17964d888f11c23ebb1d239";
const augustReadinessPublicVerifierFixtureRepairCommit =
  "f49692d9bb6a18b1fdb5d8038e13df902d96d8a5";
const augustReadinessPublicVerifierFixtureRepairTree =
  "e7a1a31af6a52b1564ac0ee65e295f8c65ce9275";
const governancePath =
  "overwatch/governance/route-iq-wrangler-miniflare-major-transition-requalification-v1.json";
const reportPath =
  "overwatch/reports/BATCH-20260810-001-route-iq-wrangler-miniflare-major-transition-requalification.json";
const infrastructurePath =
  "workers/infrastructure/route-iq-cloudflare-toolchain-compatibility-v1.json";
const securityPath = "security/npm-high-advisory-triage-batch-20260810-001.json";
const augustReadinessSuccessorsPath =
  "overwatch/governance/route-iq-august-1-readiness-successors-v1.json";
const privateWorkflowGovernancePath =
  "overwatch/governance/github-actions-private-worker-deployment-v2.json";
const fieldSessionReportTypeGovernancePath =
  "overwatch/governance/field-session-report-type-contract-drift-repair-v1.json";
const liveCanonicalIdentityGovernancePath =
  "overwatch/governance/live-canonical-identity-migration-v1.json";
const gymPreviewGovernancePath =
  "overwatch/governance/route-iq-gym-first-dual-track-public-website-preview-v1.json";
const dashboardVisualGovernancePath =
  "overwatch/governance/route-iq-public-navigation-dashboard-visual-successor-v1.json";

const read = path => readFileSync(resolve(root, path), "utf8");
const readJson = path => JSON.parse(read(path));
const sha256 = path => createHash("sha256").update(readFileSync(resolve(root, path))).digest("hex");
const sha256At = (commit, path) => createHash("sha256").update(execFileSync("git", [
  "show", `${commit}:${path}`
], { cwd: root, encoding: null })).digest("hex");
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
const activeDeploymentPolicyFiles = Object.freeze([
  "docs/cloudflare-unattended-deployment-access-v1.md",
  "docs/github-actions-founder-triggered-private-worker-deployment-v1.md",
  "docs/github-actions-public-worker-deployment-v2.md",
  "docs/route-iq-prospective-shadow-infrastructure-v1.md",
  "scripts/lib/github-actions-private-worker-deployment.mjs",
  "scripts/lib/github-actions-public-worker-deployment.mjs",
  "scripts/verify-cloudflare-unattended-access-architecture.mjs",
  "scripts/verify-cloudflare-unattended-runtime-guard.mjs",
  "tests/github-actions-public-worker-deployment.test.mjs",
  "tests/route-iq-cloudflare-toolchain-compatibility.test.mjs",
  "workers/infrastructure/cloudflare-unattended-deployment-access-v1.json",
  "workers/infrastructure/github-actions-founder-triggered-private-worker-deployment-v1.json",
  "workers/infrastructure/github-actions-founder-triggered-public-worker-deployment-v1.json",
  "workers/infrastructure/github-actions-private-worker-deployment-v2.json",
  "workers/infrastructure/github-actions-public-worker-deployment-v2.json"
]);
const activePolicyQualificationFiles = Object.freeze([
  governancePath,
  reportPath,
  "scripts/verify-overwatch-cloudflare-unattended-access.mjs",
  "scripts/verify-overwatch-github-actions-private-worker-deployment.mjs",
  "scripts/verify-overwatch-route-iq-cloudflare-toolchain-requalification.mjs",
  "tests/overwatch-cloudflare-unattended-access.test.mjs",
  "tests/overwatch-github-actions-private-worker-deployment.test.mjs",
  "tests/overwatch-route-iq-cloudflare-toolchain-requalification.test.mjs"
]);
const publicLaneQualificationRepairFiles = Object.freeze([
  governancePath,
  reportPath,
  "scripts/verify-overwatch-route-iq-cloudflare-toolchain-requalification.mjs",
  "scripts/verify-overwatch-route-iq-paid-customer-onboarding-foundation.mjs",
  "tests/overwatch-route-iq-cloudflare-toolchain-requalification.test.mjs",
  "tests/overwatch-route-iq-paid-customer-onboarding-foundation.test.mjs"
]);
const controlledRehearsalRuntimeGuardRepairFiles = Object.freeze([
  governancePath,
  reportPath,
  "scripts/verify-overwatch-controlled-paid-customer-onboarding-rehearsal-v1.mjs",
  "scripts/verify-overwatch-route-iq-cloudflare-toolchain-requalification.mjs",
  "tests/overwatch-controlled-paid-customer-onboarding-rehearsal-v1.test.mjs",
  "tests/overwatch-route-iq-cloudflare-toolchain-requalification.test.mjs"
]);
const keychainInteroperabilityLauncherRepairFiles = Object.freeze([
  governancePath,
  reportPath,
  "scripts/verify-overwatch-cloudflare-unattended-keychain-interoperability.mjs",
  "scripts/verify-overwatch-route-iq-cloudflare-toolchain-requalification.mjs",
  "tests/overwatch-cloudflare-unattended-keychain-interoperability.test.mjs",
  "tests/overwatch-route-iq-cloudflare-toolchain-requalification.test.mjs"
]);
const hostedRegressionFixtureRepairFiles = Object.freeze([
  governancePath,
  reportPath,
  "scripts/verify-overwatch-route-iq-cloudflare-toolchain-requalification.mjs",
  "tests/overwatch-auto-push-governance.test.mjs",
  "tests/overwatch-public-deployment-workflow-v2.test.mjs",
  "tests/overwatch-route-iq-cloudflare-toolchain-requalification.test.mjs"
]);
const augustReadinessPublicVerifierFixtureRepairFiles = Object.freeze([
  augustReadinessSuccessorsPath,
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

export function verifyCloudflareToolchainPackageSuccessor({
  evidence,
  historicalSha256,
  currentSha256
}) {
  const byPrevious = new Map();
  for (const item of evidence.filter(candidate => candidate.path === "package.json")) {
    assert.equal(byPrevious.has(item.previousSha256), false,
      "package successor evidence branches");
    byPrevious.set(item.previousSha256, item.successorSha256);
  }
  const visited = new Set();
  let candidate = historicalSha256;
  while (candidate !== currentSha256) {
    assert.equal(visited.has(candidate), false, "package successor evidence cycles");
    visited.add(candidate);
    assert.equal(byPrevious.has(candidate), true,
      "package successor evidence is incomplete");
    candidate = byPrevious.get(candidate);
  }
  return true;
}

export function hasGymPreviewPublicRollbackBuildSourceSuccessor({
  governance,
  path,
  previousSha256,
  currentSha256
}) {
  const successor = governance?.toolchainReleaseReproducibilitySuccessor;
  return governance?.batchId === "BATCH-20260814-002"
    && governance?.ownerSubsystem === "Prometheus Overwatch"
    && successor?.classification ===
      "GYM_PREVIEW_PUBLIC_ROLLBACK_BUILD_SOURCE_SUCCESSOR"
    && successor?.ownerCommit ===
      "15f1d58d4d0fcf689d2ead9591a6f3c4a6598bac"
    && successor?.path === path
    && successor?.previousSha256 === previousSha256
    && successor?.currentSha256 === currentSha256
    && successor?.rollbackContractPath ===
      "workers/infrastructure/route-iq-public-forward-rollback-v1.json"
    && successor?.rollbackContractPreviousSha256 ===
      "4477ddff8777d95e74023a09f2e9a7895060e1d290eeb5d9b2557ca620d827c7"
    && successor?.deploymentAssetSha256 ===
      governance?.releaseIdentities?.deploymentAssetSha256
    && successor?.rollbackContractSha256 ===
      governance?.releaseIdentities?.rollbackContractSha256
    && successor?.rollbackBundleSha256 ===
      governance?.releaseIdentities?.rollbackBundleSha256
    && successor?.productionDeploymentAuthorized === false;
}

export function hasDashboardVisualPublicRollbackBuildSourceSuccessor({
  governance,
  path,
  previousSha256,
  currentSha256
}) {
  const ownerCommit = governance?.implementationCommits?.find(entry =>
    entry.commit === "441e4f2c829c0eb5d04078711314d9481d4ccbd4");
  return governance?.version ===
      "route-iq-overwatch-public-navigation-dashboard-visual-successor-v1"
    && governance?.batchId === "BATCH-20260815-001"
    && governance?.ownerSubsystem === "Prometheus Overwatch"
    && governance?.status === "INDEPENDENTLY_VERIFIED_SOURCE_SUCCESSOR"
    && ownerCommit?.identity ===
      "Prometheus Infrastructure <infrastructure@prometheus.local>"
    && ownerCommit?.subject === "infrastructure: regenerate public visual rollback"
    && ownerCommit?.changedFiles?.includes(path)
    && previousSha256 === sha256At(`${ownerCommit.commit}^`, path)
    && currentSha256 === sha256At(ownerCommit.commit, path)
    && governance?.currentContracts?.forwardRollback?.sha256 ===
      governance?.releaseIdentities?.rollbackContractSha256
    && governance?.releaseBoundary?.productionDeploymentAuthorized === false
    && governance?.releaseBoundary?.productionStorageAccessAllowed === false
    && governance?.protectedState?.productionDeployments === 0
    && governance?.protectedState?.productionDataMutations === 0;
}

export function verifyOverwatchRouteIqCloudflareToolchainRequalification() {
  const governance = readJson(governancePath);
  const report = readJson(reportPath);
  const infrastructure = readJson(infrastructurePath);
  const security = readJson(securityPath);
  const augustReadinessSuccessors = validateAugust1ReadinessSuccessors(
    readJson(augustReadinessSuccessorsPath),
    { root }
  );
  const privateWorkflowGovernance = readJson(privateWorkflowGovernancePath);
  const fieldSessionReportTypeGovernance = readJson(
    fieldSessionReportTypeGovernancePath
  );
  const liveCanonicalIdentityGovernance = readJson(
    liveCanonicalIdentityGovernancePath
  );
  const gymPreviewGovernance = readJson(gymPreviewGovernancePath);
  const dashboardVisualGovernance = readJson(dashboardVisualGovernancePath);
  const predecessor = readJson(
    "overwatch/governance/route-iq-dormant-retention-maintenance-deployment-readiness-v1.json"
  );
  const packageJson = readJson("package.json");
  const packageLock = readJson("package-lock.json");
  const node24Infrastructure = readJson(
    "workers/infrastructure/github-actions-official-node24-pin-successor-v1.json"
  );
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
    rollbackQualificationCommit,
    rollbackLockAttestationCommit,
    "Prometheus Overwatch <overwatch@prometheus.local>",
    "overwatch: qualify rollback lock attestation successor",
    rollbackQualificationSuccessorFiles
  );
  assert.equal(git("show", "-s", "--format=%T", rollbackQualificationCommit),
    rollbackQualificationTree);
  verifyOwnerCommit(
    activeDeploymentPolicyCommit,
    rollbackQualificationCommit,
    "Prometheus Infrastructure <infrastructure@prometheus.local>",
    "infrastructure: align active Wrangler deployment policies",
    activeDeploymentPolicyFiles
  );
  assert.equal(git("show", "-s", "--format=%T", activeDeploymentPolicyCommit),
    activeDeploymentPolicyTree);
  verifyOwnerCommit(
    activePolicyQualificationCommit,
    activeDeploymentPolicyCommit,
    "Prometheus Overwatch <overwatch@prometheus.local>",
    "overwatch: compose active Wrangler policy successor",
    activePolicyQualificationFiles
  );
  assert.equal(git("show", "-s", "--format=%T", activePolicyQualificationCommit),
    activePolicyQualificationTree);
  verifyOwnerCommit(
    verificationCompositionRepairCommit,
    activePolicyQualificationCommit,
    "Prometheus Overwatch <overwatch@prometheus.local>",
    "overwatch: repair active Wrangler successor composition",
    activePolicyQualificationFiles
  );
  assert.equal(git("show", "-s", "--format=%T", verificationCompositionRepairCommit),
    verificationCompositionRepairTree);
  verifyOwnerCommit(
    publicLaneQualificationRepairCommit,
    verificationCompositionRepairCommit,
    "Prometheus Overwatch <overwatch@prometheus.local>",
    "overwatch: compose public policy successor into paid-customer gate",
    publicLaneQualificationRepairFiles
  );
  assert.equal(git("show", "-s", "--format=%T", publicLaneQualificationRepairCommit),
    publicLaneQualificationRepairTree);
  verifyOwnerCommit(
    controlledRehearsalRuntimeGuardRepairCommit,
    publicLaneQualificationRepairCommit,
    "Prometheus Overwatch <overwatch@prometheus.local>",
    "overwatch: compose runtime guard successor into rehearsal gate",
    controlledRehearsalRuntimeGuardRepairFiles
  );
  assert.equal(git("show", "-s", "--format=%T",
    controlledRehearsalRuntimeGuardRepairCommit),
  controlledRehearsalRuntimeGuardRepairTree);
  verifyOwnerCommit(
    keychainInteroperabilityLauncherRepairCommit,
    controlledRehearsalRuntimeGuardRepairCommit,
    "Prometheus Overwatch <overwatch@prometheus.local>",
    "overwatch: compose launcher successor into keychain gate",
    keychainInteroperabilityLauncherRepairFiles
  );
  assert.equal(git("show", "-s", "--format=%T", keychainInteroperabilityLauncherRepairCommit),
    keychainInteroperabilityLauncherRepairTree);
  verifyOwnerCommit(
    hostedRegressionFixtureRepairCommit,
    keychainInteroperabilityLauncherRepairCommit,
    "Prometheus Overwatch <overwatch@prometheus.local>",
    "overwatch: align hosted regression fixtures",
    hostedRegressionFixtureRepairFiles
  );
  assert.equal(git("show", "-s", "--format=%T", hostedRegressionFixtureRepairCommit),
    hostedRegressionFixtureRepairTree);
  verifyOwnerCommit(
    augustReadinessPublicVerifierFixtureRepairCommit,
    hostedRegressionFixtureRepairCommit,
    "Prometheus Overwatch <overwatch@prometheus.local>",
    "overwatch: compose public verifier fixture successor",
    augustReadinessPublicVerifierFixtureRepairFiles
  );
  assert.equal(git("show", "-s", "--format=%T",
    augustReadinessPublicVerifierFixtureRepairCommit),
  augustReadinessPublicVerifierFixtureRepairTree);
  assert.equal(git("merge-base", "--is-ancestor",
    augustReadinessPublicVerifierFixtureRepairCommit, head), "");

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
  const currentPackageSha256 = sha256("package.json");
  assert.equal(verifyCloudflareToolchainPackageSuccessor({
    evidence: augustReadinessSuccessors.overwatchCurrentEvidence,
    historicalSha256:
      "f6b097932650a9a504bf81b217e4efe6092d1bebc6b863bc9dd0748192e2d5d8",
    currentSha256: currentPackageSha256
  }), true);
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
  const rollbackBuildSourcePath = "scripts/lib/route-iq-public-forward-rollback.mjs";
  const rollbackBuildSourceCurrentSha256 = sha256(rollbackBuildSourcePath);
  const gymPreviewRollbackSuccessor =
    gymPreviewGovernance.toolchainReleaseReproducibilitySuccessor;
  assert.equal(
    hasGymPreviewPublicRollbackBuildSourceSuccessor({
      governance: gymPreviewGovernance,
      path: rollbackBuildSourcePath,
      previousSha256: governance.releaseReproducibilityRepair.changedPathSha256,
      currentSha256: gymPreviewRollbackSuccessor.currentSha256
    }) && (
      rollbackBuildSourceCurrentSha256 === gymPreviewRollbackSuccessor.currentSha256
      || hasDashboardVisualPublicRollbackBuildSourceSuccessor({
        governance: dashboardVisualGovernance,
        path: rollbackBuildSourcePath,
        previousSha256: gymPreviewRollbackSuccessor.currentSha256,
        currentSha256: rollbackBuildSourceCurrentSha256
      })
    ),
    true
  );
  assert.equal(sha256At(`${gymPreviewRollbackSuccessor.ownerCommit}^`,
    rollbackBuildSourcePath), gymPreviewRollbackSuccessor.previousSha256);
  assert.equal(sha256At(gymPreviewRollbackSuccessor.ownerCommit,
    rollbackBuildSourcePath), gymPreviewRollbackSuccessor.currentSha256);
  assert.equal(git("show", "-s", "--format=%an <%ae>",
    gymPreviewRollbackSuccessor.ownerCommit),
  "Prometheus Infrastructure <infrastructure@prometheus.local>");
  assert.equal(governance.releaseReproducibilityRepair.currentPackageLockSha256,
    sha256("package-lock.json"));
  assert.equal(governance.releaseReproducibilityRepair.publicRollbackArtifactSha256,
    release.publicRollbackArtifactSha256);
  assert.equal(governance.releaseReproducibilityRepair.artifactByteIdentical, true);
  assert.equal(report.publicRollbackReproducibilityRepair.infrastructureCommit,
    rollbackLockAttestationCommit);
  assert.equal(report.publicRollbackReproducibilityRepair.byteIdentical, true);
  const activePolicy = governance.activeDeploymentPolicySuccessor;
  assert.equal(activePolicy.infrastructureCommit, activeDeploymentPolicyCommit);
  assert.equal(activePolicy.infrastructureTree, activeDeploymentPolicyTree);
  assert.equal(activePolicy.wranglerVersion, "4.120.1");
  assert.deepEqual(Object.keys(activePolicy.currentEvidence).sort(),
    [...activeDeploymentPolicyFiles].sort());
  for (const [path, expected] of Object.entries(activePolicy.currentEvidence)) {
    const actual = sha256(path);
    assert.equal(actual === expected
      || hasOutcomeSemanticIntegrityPayloadInfrastructureSuccessor({
        governance: privateWorkflowGovernance,
        fieldSessionReportTypeGovernance,
        liveCanonicalIdentityGovernance,
        readinessSuccessors: augustReadinessSuccessors,
        path,
        previousSha256: expected,
        currentSha256: actual
      })
      || hasGovernedLearningPayloadInfrastructureSuccessor({
        governance: privateWorkflowGovernance,
        fieldSessionReportTypeGovernance,
        liveCanonicalIdentityGovernance,
        readinessSuccessors: augustReadinessSuccessors,
        path,
        previousSha256: expected,
        currentSha256: actual
      })
      || hasPrivateWorkflowV2DashboardVisualDeployParitySuccessor({
        governance: privateWorkflowGovernance,
        path,
        previousSha256: privateWorkflowGovernance
          .dashboardVisualDeployParitySuccessor.evidence
          .find(evidence => evidence.path === path)?.previousSha256,
        currentSha256: actual
      }), true, path);
  }
  assert.equal(activePolicy.historicalRecordsRewritten, false);
  assert.equal(activePolicy.workflowChanged, false);
  assert.equal(activePolicy.deploymentPerformed, false);
  assert.equal(activePolicy.productionMutationCount, 0);
  assert.equal(report.activeDeploymentPolicySuccessor.infrastructureCommit,
    activeDeploymentPolicyCommit);
  assert.equal(report.activeDeploymentPolicySuccessor.focusedTests, 269);
  assert.equal(report.activeDeploymentPolicySuccessor.focusedFailures, 0);
  assert.deepEqual(governance.verificationCompositionRepair, {
    classification: "HISTORICAL_AND_ACTIVE_SUCCESSOR_STATE_COMPOSED_SEPARATELY",
    parent: activePolicyQualificationCommit,
    historicalEvidenceRewritten: false,
    sharedIntegrationPathOwnershipInferredFromCommit: true,
    applicationPayloadChanged: false,
    releaseIdentityChanged: false,
    deploymentPerformed: false,
    cloudflareContactCount: 0,
    productionMutationCount: 0
  });
  assert.equal(report.verificationCompositionRepair.classification,
    governance.verificationCompositionRepair.classification);
  assert.equal(report.verificationCompositionRepair
    .sharedIntegrationPathOwnershipInferredFromCommit, true);
  assert.equal(report.verificationCompositionRepair.focusedFailuresAfterRepair, 0);
  assert.deepEqual(governance.publicLaneQualificationRepair, {
    failedHostedRun: 31434488496,
    classification: "PAID_CUSTOMER_PUBLIC_LANE_MISSING_ACTIVE_TOOLCHAIN_SUCCESSOR",
    parent: verificationCompositionRepairCommit,
    exactPublicContractPath:
      "workers/infrastructure/github-actions-public-worker-deployment-v2.json",
    historicalPublicSuccessorPreserved: true,
    applicationPayloadChanged: false,
    publicWorkflowChanged: false,
    deploymentPerformed: false,
    cloudflareContactCount: 0,
    productionMutationCount: 0
  });
  assert.equal(report.publicLaneQualificationRepair.failedHostedRun,
    governance.publicLaneQualificationRepair.failedHostedRun);
  assert.equal(report.publicLaneQualificationRepair.focusedFailuresAfterRepair, 0);
  assert.deepEqual(governance.controlledRehearsalRuntimeGuardRepair, {
    failedHostedRun: 31434809725,
    classification:
      "CONTROLLED_REHEARSAL_RUNTIME_GUARD_VERIFIER_SUCCESSOR_NOT_COMPOSED",
    parent: publicLaneQualificationRepairCommit,
    exactRuntimeGuardVerifierPath:
      "scripts/verify-cloudflare-unattended-runtime-guard.mjs",
    infrastructureSuccessorCommit: activeDeploymentPolicyCommit,
    historicalRehearsalEvidencePreserved: true,
    applicationPayloadChanged: false,
    workflowChanged: false,
    deploymentPerformed: false,
    cloudflareContactCount: 0,
    productionMutationCount: 0
  });
  assert.equal(report.controlledRehearsalRuntimeGuardRepair.failedHostedRun,
    governance.controlledRehearsalRuntimeGuardRepair.failedHostedRun);
  assert.equal(report.controlledRehearsalRuntimeGuardRepair.infrastructureSuccessorCommit,
    activeDeploymentPolicyCommit);
  assert.equal(report.controlledRehearsalRuntimeGuardRepair.focusedFailuresAfterRepair, 0);
  assert.deepEqual(governance.hostedQualification.failedRunClassifications.at(-3), {
    run: 31435309144,
    classification: "KEYCHAIN_INTEROPERABILITY_LAUNCHER_SUCCESSOR_NOT_COMPOSED"
  });
  assert.deepEqual(governance.keychainInteroperabilityLauncherRepair, {
    failedHostedRun: 31435309144,
    classification: "KEYCHAIN_INTEROPERABILITY_LAUNCHER_SUCCESSOR_NOT_COMPOSED",
    parent: controlledRehearsalRuntimeGuardRepairCommit,
    exactLauncherPath: "scripts/lib/cloudflare-unattended-launcher.mjs",
    infrastructureSuccessorCommit: infrastructureCommit,
    historicalKeychainEvidencePreserved: true,
    applicationPayloadChanged: false,
    workflowChanged: false,
    deploymentPerformed: false,
    cloudflareContactCount: 0,
    productionMutationCount: 0
  });
  assert.equal(report.keychainInteroperabilityLauncherRepair.failedHostedRun,
    governance.keychainInteroperabilityLauncherRepair.failedHostedRun);
  assert.equal(report.keychainInteroperabilityLauncherRepair.focusedFailuresAfterRepair, 0);
  assert.deepEqual(governance.hostedQualification.failedRunClassifications.at(-2), {
    run: 31436345331,
    classification: "HOSTED_MASTER_STATE_AND_PUBLIC_VERIFIER_FIXTURES_STALE"
  });
  assert.deepEqual(governance.hostedRegressionFixtureRepair, {
    failedHostedRun: 31436345331,
    classification: "HOSTED_MASTER_STATE_AND_PUBLIC_VERIFIER_FIXTURES_STALE",
    parent: keychainInteroperabilityLauncherRepairCommit,
    currentNextTask: "OFFICIAL_NODE24_ACTION_PIN_SUCCESSOR",
    currentPublicVerifierSha256:
      "57554fbe63092130df5df1f305c1f9e7eff93d97141b593ffbdd9c40c0bae9c3",
    staleNextTaskRejected: true,
    staleVerifierSha256Rejected: true,
    applicationPayloadChanged: false,
    workflowChanged: false,
    deploymentPerformed: false,
    cloudflareContactCount: 0,
    productionMutationCount: 0
  });
  assert.equal(report.hostedRegressionFixtureRepair.failedHostedRun,
    governance.hostedRegressionFixtureRepair.failedHostedRun);
  assert.equal(report.hostedRegressionFixtureRepair.focusedFailuresAfterRepair, 0);
  assert.deepEqual(governance.hostedQualification.failedRunClassifications.at(-1), {
    run: 31437235624,
    classification: "AUGUST_READINESS_PUBLIC_VERIFIER_FIXTURE_SUCCESSOR_NOT_COMPOSED"
  });
  assert.deepEqual(governance.augustReadinessPublicVerifierFixtureRepair, {
    failedHostedRun: 31437235624,
    classification: "AUGUST_READINESS_PUBLIC_VERIFIER_FIXTURE_SUCCESSOR_NOT_COMPOSED",
    parent: hostedRegressionFixtureRepairCommit,
    readinessLedgerPath: augustReadinessSuccessorsPath,
    exactTestPath: "tests/overwatch-public-deployment-workflow-v2.test.mjs",
    previousSha256: "b2d20e95fb7baec1b0ec1acf3f12aaf914503af59fc26a2b298ee8effc991db4",
    successorSha256: "2165324ae8773102e3d74f072856373248bc1d67b8dcef8e73d0dcd23bfbea5d",
    historicalReadinessEvidencePreserved: true,
    applicationPayloadChanged: false,
    workflowChanged: false,
    deploymentPerformed: false,
    cloudflareContactCount: 0,
    productionMutationCount: 0
  });
  assert.equal(report.augustReadinessPublicVerifierFixtureRepair.failedHostedRun,
    governance.augustReadinessPublicVerifierFixtureRepair.failedHostedRun);
  assert.equal(report.augustReadinessPublicVerifierFixtureRepair.focusedFailuresAfterRepair, 0);

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

  const privateDeploymentContractPath = predecessor.releasePackage.privateWorkflowContinuity.path;
  assert.equal(privateDeploymentContractPath,
    "workers/infrastructure/github-actions-private-worker-deployment-v2.json");
  const protectedReleasePaths = [
    predecessor.releasePackage.contract.path,
    predecessor.releasePackage.builder.path,
    predecessor.releasePackage.runtimeContract.path,
    predecessor.releasePackage.admissionProducer.path,
    predecessor.forwardRollback.path,
    "workers/infrastructure/route-iq-private-forward-rollback-candidate-v3.json",
    "workers/infrastructure/route-iq-public-forward-rollback-v1.json"
  ];
  const changedProtectedReleasePaths = git(
    "diff", "--name-only", startCommit, head, "--", ...protectedReleasePaths
  ).split("\n").filter(Boolean);
  assert.deepEqual(changedProtectedReleasePaths,
    [gymPreviewRollbackSuccessor.rollbackContractPath]);
  assert.equal(sha256At(startCommit,
    gymPreviewRollbackSuccessor.rollbackContractPath),
    gymPreviewRollbackSuccessor.rollbackContractPreviousSha256);
  assert.equal(sha256At(gymPreviewRollbackSuccessor.ownerCommit,
    gymPreviewRollbackSuccessor.rollbackContractPath),
    gymPreviewRollbackSuccessor.rollbackContractSha256);
  const dashboardVisualRollbackOwner = dashboardVisualGovernance.implementationCommits
    .find(entry => entry.commit === "441e4f2c829c0eb5d04078711314d9481d4ccbd4");
  assert.ok(dashboardVisualRollbackOwner.changedFiles.includes(
    gymPreviewRollbackSuccessor.rollbackContractPath));
  assert.equal(sha256At(`${dashboardVisualRollbackOwner.commit}^`,
    gymPreviewRollbackSuccessor.rollbackContractPath),
  gymPreviewRollbackSuccessor.rollbackContractSha256);
  assert.equal(sha256At(dashboardVisualRollbackOwner.commit,
    gymPreviewRollbackSuccessor.rollbackContractPath),
  dashboardVisualGovernance.releaseIdentities.rollbackContractSha256);
  assert.equal(sha256(gymPreviewRollbackSuccessor.rollbackContractPath),
    dashboardVisualGovernance.releaseIdentities.rollbackContractSha256);
  assert.deepEqual(git(
    "log", "--format=%H", "--reverse", `${startCommit}..${head}`, "--",
    privateDeploymentContractPath
  ).split("\n"), [
    activeDeploymentPolicyCommit,
    governedLearningPayloadCommit,
    outcomeSemanticIntegrityPayloadCommit,
    dashboardVisualDeployParityCommit
  ]);
  assert.equal(sha256At(activeDeploymentPolicyCommit, privateDeploymentContractPath),
    activePolicy.currentEvidence[privateDeploymentContractPath]);
  assert.equal(sha256At(`${activeDeploymentPolicyCommit}^`, privateDeploymentContractPath),
    sha256At(startCommit, privateDeploymentContractPath));
  const governedLearningContractEvidence = privateWorkflowGovernance
    .governedLearningPayloadSuccessor.evidence.find(
      item => item.path === privateDeploymentContractPath
    );
  assert.equal(
    sha256At(governedLearningPayloadCommit, privateDeploymentContractPath),
    governedLearningContractEvidence.successorSha256
  );
  assert.equal(
    sha256At(`${governedLearningPayloadCommit}^`, privateDeploymentContractPath),
    governedLearningContractEvidence.previousSha256
  );
  const outcomeSemanticContractEvidence = privateWorkflowGovernance
    .outcomeSemanticIntegrityPayloadSuccessor.evidence.find(
      item => item.path === privateDeploymentContractPath
    );
  assert.equal(
    sha256At(outcomeSemanticIntegrityPayloadCommit, privateDeploymentContractPath),
    outcomeSemanticContractEvidence.successorSha256
  );
  assert.equal(
    sha256At(`${outcomeSemanticIntegrityPayloadCommit}^`,
      privateDeploymentContractPath),
    outcomeSemanticContractEvidence.previousSha256
  );
  const dashboardVisualDeployParityEvidence = privateWorkflowGovernance
    .dashboardVisualDeployParitySuccessor.evidence.find(
      item => item.path === privateDeploymentContractPath
    );
  assert.equal(
    sha256At(dashboardVisualDeployParityCommit, privateDeploymentContractPath),
    dashboardVisualDeployParityEvidence.successorSha256
  );
  assert.equal(
    sha256At(`${dashboardVisualDeployParityCommit}^`, privateDeploymentContractPath),
    dashboardVisualDeployParityEvidence.previousSha256
  );
  assert.equal(git("diff", "--name-only", startCommit,
    augustReadinessPublicVerifierFixtureRepairCommit, "--", ".github/workflows"), "");
  const node24Verification = verifyOverwatchGithubActionsNode24PinSuccessor();
  assert.equal(node24Verification.status, "OFFICIAL_NODE24_ACTION_PIN_OVERWATCH_VERIFIED");
  assert.equal(node24Verification.successorWorkflowFiles, 1);
  assert.equal(node24Verification.activeWorkflowFiles, 16);
  const workflowDiff = git("diff", "--name-only",
    augustReadinessPublicVerifierFixtureRepairCommit, head, "--", ".github/workflows");
  assert.deepEqual(
    workflowDiff ? workflowDiff.split("\n").sort() : [],
    [...node24Infrastructure.workflows.map(item => item.path),
      gymPreviewGovernance.contracts.workflow.path].sort()
  );

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
    rollbackQualificationCommit,
    activeDeploymentPolicyCommit,
    activePolicyQualificationCommit,
    verificationCompositionRepairCommit,
    publicLaneQualificationRepairCommit,
    controlledRehearsalRuntimeGuardRepairCommit,
    keychainInteroperabilityLauncherRepairCommit,
    hostedRegressionFixtureRepairCommit,
    augustReadinessPublicVerifierFixtureRepairCommit,
    node24ActionPinStatus: node24Verification.status,
    compatibility: governance.compatibility.supportedCandidate,
    allDependencyHigh: security.auditDisposition.after.allDependencies.high,
    productionHigh: security.auditDisposition.after.productionOnly.high,
    releaseIdentitiesUnchanged: true,
    publicRollbackArtifactSha256: release.publicRollbackArtifactSha256,
    augustReadinessPackageSuccessorCurrent: true,
    currentPackageSha256,
    cloudflareContactCount: 0,
    deploymentCount: 0,
    productionMutationCount: 0
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.stdout.write(`${JSON.stringify(verifyOverwatchRouteIqCloudflareToolchainRequalification())}\n`);
}
