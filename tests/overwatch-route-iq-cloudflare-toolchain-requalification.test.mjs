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
  assert.equal(result.retentionMaintenanceSuccessorCommit, result.head);
  assert.equal(result.compatibility, "121/121 PASS");
  assert.equal(result.allDependencyHigh, 0);
  assert.equal(result.productionHigh, 0);
  assert.equal(result.releaseIdentitiesUnchanged, true);
  assert.equal(result.augustReadinessPackageSuccessorCurrent, true);
  assert.equal(result.cloudflareContactCount, 0);
  assert.equal(result.deploymentCount, 0);
  assert.equal(result.productionMutationCount, 0);
});
