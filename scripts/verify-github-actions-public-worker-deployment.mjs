#!/usr/bin/env node

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  PUBLIC_WRANGLER_FAILURE_REASON,
  PUBLIC_WRANGLER_PHASE,
  PUBLIC_WORKER_STARTUP_FAILURE_REASON,
  PUBLIC_WORKER_DEPLOYMENT_POLICY,
  buildPublicWorkerStartupInvocation,
  buildPublicWranglerInvocation,
  verifyPublicStaticDeploymentPolicy,
  verifyPublicWranglerPin
} from "./lib/github-actions-public-worker-deployment.mjs";
import {
  PUBLIC_WORKFLOW_V2_POLICY
} from "./lib/github-actions-public-worker-workflow-v2.mjs";
import { fixedCloudflarePublicWorkerSmokePlan } from "./run-cloudflare-public-worker-smoke.mjs";
import { verifyGithubActionsPublicWorkerWorkflowV2 } from "./verify-github-actions-public-worker-workflow-v2.mjs";
import { verifyRouteIqPublicDeploymentAssets } from "./verify-route-iq-public-deployment-assets.mjs";

const root = resolve(import.meta.dirname, "..");
const LEGACY_PATHS = Object.freeze([
  PUBLIC_WORKER_DEPLOYMENT_POLICY.contractPath,
  PUBLIC_WORKER_DEPLOYMENT_POLICY.rollbackContractPath,
  "scripts/lib/github-actions-public-worker-deployment.mjs",
  "scripts/lib/route-iq-public-forward-rollback.mjs",
  "scripts/run-public-worker-workerd-startup-preflight.mjs",
  "scripts/run-cloudflare-public-worker-smoke.mjs",
  "tests/github-actions-public-worker-deployment.test.mjs",
  PUBLIC_WORKER_DEPLOYMENT_POLICY.publicEntrypoint,
  "docs/github-actions-founder-triggered-public-worker-deployment-v1.md"
]);

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

export function verifyGithubActionsPublicWorkerDeployment() {
  for (const path of LEGACY_PATHS) assert.equal(existsSync(resolve(root, path)), true, `${path} must exist`);
  assert.equal(
    verifyGithubActionsPublicWorkerWorkflowV2().status,
    "GITHUB_ACTIONS_PUBLIC_WORKER_WORKFLOW_V2_VERIFIED"
  );

  const legacyContract = JSON.parse(read(PUBLIC_WORKER_DEPLOYMENT_POLICY.contractPath));
  const rollbackContract = JSON.parse(read(PUBLIC_WORKER_DEPLOYMENT_POLICY.rollbackContractPath));
  const v2Contract = JSON.parse(read(PUBLIC_WORKFLOW_V2_POLICY.contractPath));
  const legacyLibrary = read("scripts/lib/github-actions-public-worker-deployment.mjs");
  const publicEntrypoint = read(PUBLIC_WORKER_DEPLOYMENT_POLICY.publicEntrypoint);

  assert.equal(legacyContract.contractVersion, PUBLIC_WORKER_DEPLOYMENT_POLICY.contractVersion);
  assert.equal(legacyContract.owner, "Prometheus Infrastructure");
  assert.equal(v2Contract.predecessorContract, PUBLIC_WORKER_DEPLOYMENT_POLICY.contractPath);
  assert.equal(v2Contract.target.publicWorker, PUBLIC_WORKER_DEPLOYMENT_POLICY.publicWorker);
  assert.equal(v2Contract.target.privateWorker, PUBLIC_WORKER_DEPLOYMENT_POLICY.privateWorker);
  assert.equal(v2Contract.target.privateWorkerMutationAllowed, false);
  assert.equal(v2Contract.deployment.rebuildAllowed, false);
  assert.equal(v2Contract.deployment.wranglerMode, "no-bundle");
  assert.equal(v2Contract.deployment.forwardDeploymentAttempts, 1);
  assert.equal(v2Contract.deployment.automaticRetryAllowed, false);
  assert.equal(v2Contract.authorization.preAuthorizationCloudflareReadOnlyRequestsAllowed, true);
  assert.equal(v2Contract.authorization.preAuthorizationCloudflareMutationRequestsAllowed, false);
  assert.equal(v2Contract.authorization.changedCandidateRequiresNewQualificationAndAuthorization, true);

  assert.match(publicEntrypoint, /export \{ RouteIqRequestCrmCoordinator \};/u);
  assert.match(publicEntrypoint, /export default worker;/u);
  assert.doesNotMatch(publicEntrypoint, /CALLBACK_PATH|RouteIqProspectiveShadowCoordinator/u);

  const startupInvocation = buildPublicWorkerStartupInvocation(
    PUBLIC_WORKER_DEPLOYMENT_POLICY.publicConfig,
    "/tmp/prometheus-public-workerd-state"
  );
  for (const required of ["dev", "--local", "127.0.0.1", "--latest=false"]) {
    assert.ok(startupInvocation.includes(required));
  }
  for (const forbidden of ["--remote", "--tunnel", "--name"]) {
    assert.equal(startupInvocation.includes(forbidden), false);
  }

  const legacyInputs = Object.freeze({ batchId: "BATCH-20260720-009", approvedCommit: "a".repeat(40) });
  for (const mode of ["dry-run", "deploy"]) {
    const invocation = buildPublicWranglerInvocation(mode, legacyInputs, "/tmp/settings.json");
    assert.ok(invocation.includes(PUBLIC_WORKER_DEPLOYMENT_POLICY.publicConfig));
    assert.equal(invocation.includes("--name"), false);
    assert.equal(invocation.includes(PUBLIC_WORKER_DEPLOYMENT_POLICY.privateWorker), false);
  }

  assert.deepEqual(legacyContract.wranglerFailureDiagnostics.phases, Object.values(PUBLIC_WRANGLER_PHASE));
  assert.deepEqual(
    legacyContract.wranglerFailureDiagnostics.reasonCodes,
    Object.values(PUBLIC_WRANGLER_FAILURE_REASON)
  );
  assert.deepEqual(
    legacyContract.workerdStartupPreflight.failureReasons,
    Object.values(PUBLIC_WORKER_STARTUP_FAILURE_REASON)
  );
  for (const marker of [
    "CLOUDFLARE_READ_PHASE",
    "REQUEST_TIMEOUT",
    "RESPONSE_BODY_FAILED",
    "WRANGLER_PHASE",
    "WRANGLER_FAILURE_REASON",
    "WORKER_STARTUP_FAILURE_REASON",
    "ASSET_COMPLETION_MISSING",
    "UNKNOWN_NONZERO_EXIT"
  ]) assert.ok(legacyLibrary.includes(marker), `missing legacy diagnostic marker ${marker}`);

  assert.equal(rollbackContract.strategy, "new_forward_deployment");
  assert.equal(rollbackContract.nativeCloudflareRollbackAllowed, false);
  assert.equal(rollbackContract.artifact.identityVersion, "route-iq-public-forward-rollback-artifact-v4");
  assert.equal(rollbackContract.statefulCompatibility.migrationHistoryPreserved, true);
  assert.equal(rollbackContract.statefulCompatibility.acceptedRecordsPreserved, true);
  assert.equal(rollbackContract.statefulCompatibility.deletedClassesAllowed, false);

  const smoke = fixedCloudflarePublicWorkerSmokePlan();
  assert.ok(smoke.length > 0);
  assert.ok(smoke.every(request => ["GET", "HEAD"].includes(request.method) && request.body === false));
  verifyRouteIqPublicDeploymentAssets({ build: false });
  verifyPublicStaticDeploymentPolicy(root);
  verifyPublicWranglerPin(root);
  return Object.freeze({ status: "GITHUB_ACTIONS_PUBLIC_WORKER_DEPLOYMENT_VERIFIED" });
}

try {
  process.stdout.write(`${verifyGithubActionsPublicWorkerDeployment().status}\n`);
} catch {
  process.stdout.write("FAIL\n");
  process.exitCode = 1;
}
