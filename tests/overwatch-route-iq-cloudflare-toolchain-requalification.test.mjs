import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  hasGymPreviewPublicRollbackBuildSourceSuccessor,
  verifyCloudflareToolchainPackageSuccessor,
  verifyCloudflareToolchainRepositoryContext,
  verifyOverwatchRouteIqCloudflareToolchainRequalification
} from "../scripts/verify-overwatch-route-iq-cloudflare-toolchain-requalification.mjs";

const packageSuccessorEvidence = Object.freeze([
  Object.freeze({
    path: "package.json",
    previousSha256: "f6b097932650a9a504bf81b217e4efe6092d1bebc6b863bc9dd0748192e2d5d8",
    successorSha256: "a1fd91b3cd45b89b7cb5f9f4fb5e488f42aa2af805bd855f5065f62990c64c90"
  })
]);

test("toolchain qualification follows only the governed package successor", () => {
  const input = {
    evidence: packageSuccessorEvidence,
    historicalSha256:
      "f6b097932650a9a504bf81b217e4efe6092d1bebc6b863bc9dd0748192e2d5d8",
    currentSha256:
      "a1fd91b3cd45b89b7cb5f9f4fb5e488f42aa2af805bd855f5065f62990c64c90"
  };
  assert.equal(verifyCloudflareToolchainPackageSuccessor(input), true);
  for (const evidence of [
    [],
    [{ ...packageSuccessorEvidence[0], path: "package-lock.json" }],
    [{ ...packageSuccessorEvidence[0], previousSha256: "0".repeat(64) }],
    [{ ...packageSuccessorEvidence[0], successorSha256: "0".repeat(64) }],
    [
      packageSuccessorEvidence[0],
      { ...packageSuccessorEvidence[0], successorSha256: "0".repeat(64) }
    ]
  ]) {
    assert.throws(() => verifyCloudflareToolchainPackageSuccessor({
      ...input,
      evidence
    }));
  }
});

test("toolchain qualification composes only the exact gym preview rollback source", () => {
  const governance = JSON.parse(readFileSync(
    new URL(
      "../overwatch/governance/route-iq-gym-first-dual-track-public-website-preview-v1.json",
      import.meta.url
    ),
    "utf8"
  ));
  const successor = governance.toolchainReleaseReproducibilitySuccessor;
  const input = {
    governance,
    path: successor.path,
    previousSha256: successor.previousSha256,
    currentSha256: successor.currentSha256
  };
  assert.equal(hasGymPreviewPublicRollbackBuildSourceSuccessor(input), true);
  for (const candidate of [
    { ...input, path: "scripts/unapproved.mjs" },
    { ...input, previousSha256: "0".repeat(64) },
    { ...input, currentSha256: "0".repeat(64) },
    {
      ...input,
      governance: {
        ...governance,
        toolchainReleaseReproducibilitySuccessor: {
          ...successor,
          productionDeploymentAuthorized: true
        }
      }
    }
  ]) assert.equal(hasGymPreviewPublicRollbackBuildSourceSuccessor(candidate), false);
});

test("exact hosted detached checkout remains bound to main, SHA, and origin/main", () => {
  const head = "a".repeat(40);
  assert.doesNotThrow(() => verifyCloudflareToolchainRepositoryContext({
    head,
    originMain: head,
    currentBranch: "",
    environment: {
      GITHUB_ACTIONS: "true",
      GITHUB_SHA: head,
      GITHUB_REF: "refs/heads/main"
    }
  }));
  assert.throws(() => verifyCloudflareToolchainRepositoryContext({
    head,
    originMain: head,
    currentBranch: "",
    environment: {
      GITHUB_ACTIONS: "true",
      GITHUB_SHA: head,
      GITHUB_REF: "refs/heads/not-main"
    }
  }));
  assert.throws(() => verifyCloudflareToolchainRepositoryContext({
    head,
    originMain: "b".repeat(40),
    currentBranch: "",
    environment: {
      GITHUB_ACTIONS: "true",
      GITHUB_SHA: head,
      GITHUB_REF: "refs/heads/main"
    }
  }));
});

test("Overwatch binds the exact zero-high toolchain owner chain and release continuity", () => {
  const result = verifyOverwatchRouteIqCloudflareToolchainRequalification();
  assert.equal(result.batchId, "BATCH-20260810-001");
  assert.equal(result.qualificationProvenanceCommit,
    "cbeb848ef571cca913fcc7191350756129d65522");
  assert.equal(result.controlledRehearsalProvenanceCommit,
    "43b8564b515e9aca02c23cf370aaf7626ad3e617");
  assert.equal(result.hostedCheckoutCommit,
    "26cc9712bf1f303ae6971a17639b56968c3d9006");
  assert.equal(result.retentionRuntimeGuardCommit,
    "e4c88b4f449aac021ea9f95e24fc4a062c37c055");
  assert.equal(result.retentionMaintenanceCommit,
    "d104cd10eec5d093c95cc87ff60e6644b8759bb7");
  assert.equal(result.rollbackLockAttestationCommit,
    "014fd82e2106734bdcf7df14fa01ca284c21f847");
  assert.equal(result.rollbackQualificationCommit,
    "3d646bffde28b1ef995ae03af5976a6db1105430");
  assert.equal(result.activeDeploymentPolicyCommit,
    "d55a983134be40bf10777df293ca593e7583f138");
  assert.equal(result.activePolicyQualificationCommit,
    "ab081a9e9f56f4db87d20c6b02aecf082b96ac4b");
  assert.equal(result.verificationCompositionRepairCommit,
    "057ae93b538fb26f95193530914830d3633852d8");
  assert.equal(result.publicLaneQualificationRepairCommit,
    "6555c88543534fb330b22cb321a88b1ab43c89fb");
  assert.equal(result.controlledRehearsalRuntimeGuardRepairCommit,
    "f55b3b78d805f2d59b18fa0fb08817c95a3ea2ea");
  assert.equal(result.keychainInteroperabilityLauncherRepairCommit,
    "0a4e7aae6e1c86de1750159b073cbc40955f5773");
  assert.equal(result.hostedRegressionFixtureRepairCommit,
    "da547614ad0968352240dba314e23aa6111341a2");
  assert.equal(result.augustReadinessPublicVerifierFixtureRepairCommit,
    "f49692d9bb6a18b1fdb5d8038e13df902d96d8a5");
  assert.equal(result.node24ActionPinStatus,
    "OFFICIAL_NODE24_ACTION_PIN_OVERWATCH_VERIFIED");
  assert.equal(result.compatibility, "121/121 PASS");
  assert.equal(result.allDependencyHigh, 0);
  assert.equal(result.productionHigh, 0);
  assert.equal(result.releaseIdentitiesUnchanged, true);
  assert.equal(result.publicRollbackArtifactSha256,
    "e3330c71600364e4e22404d005902bdcf07e5ec12fe9aa098febd01e18a3b2c6");
  assert.equal(result.augustReadinessPackageSuccessorCurrent, true);
  assert.equal(result.currentPackageSha256,
    "279131b040ea4db64e1f4081a6a6fb072b00070d05fa434d880d16a95b6d0582");
  assert.equal(result.cloudflareContactCount, 0);
  assert.equal(result.deploymentCount, 0);
  assert.equal(result.productionMutationCount, 0);
});
