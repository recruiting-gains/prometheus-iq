import assert from "node:assert/strict";
import test from "node:test";

import {
  verifyCloudflareToolchainRepositoryContext,
  verifyOverwatchRouteIqCloudflareToolchainRequalification
} from "../scripts/verify-overwatch-route-iq-cloudflare-toolchain-requalification.mjs";

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
  assert.equal(result.publicLaneQualificationRepairCommit, result.head);
  assert.equal(result.compatibility, "121/121 PASS");
  assert.equal(result.allDependencyHigh, 0);
  assert.equal(result.productionHigh, 0);
  assert.equal(result.releaseIdentitiesUnchanged, true);
  assert.equal(result.publicRollbackArtifactSha256,
    "e3330c71600364e4e22404d005902bdcf07e5ec12fe9aa098febd01e18a3b2c6");
  assert.equal(result.augustReadinessPackageSuccessorCurrent, true);
  assert.equal(result.cloudflareContactCount, 0);
  assert.equal(result.deploymentCount, 0);
  assert.equal(result.productionMutationCount, 0);
});
