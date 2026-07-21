#!/usr/bin/env node

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  PUBLIC_WORKFLOW_V2_POLICY
} from "./lib/github-actions-public-worker-workflow-v2.mjs";
import {
  PUBLIC_WORKER_DEPLOYMENT_POLICY,
  verifyPublicStaticDeploymentPolicy,
  verifyPublicWranglerPin
} from "./lib/github-actions-public-worker-deployment.mjs";
import { publicWorkerSmokeV2Plan } from "./lib/cloudflare-public-worker-smoke-v2.mjs";
import { verifyRouteIqPublicDeploymentAssets } from "./verify-route-iq-public-deployment-assets.mjs";

const root = resolve(import.meta.dirname, "..");
const REQUIRED_PATHS = Object.freeze([
  PUBLIC_WORKFLOW_V2_POLICY.qualificationWorkflowPath,
  PUBLIC_WORKFLOW_V2_POLICY.deploymentWorkflowPath,
  PUBLIC_WORKFLOW_V2_POLICY.contractPath,
  "scripts/lib/github-actions-public-worker-workflow-v2.mjs",
  "scripts/lib/cloudflare-public-worker-smoke-v2.mjs",
  "scripts/run-github-actions-public-worker-qualification.mjs",
  "scripts/run-github-actions-public-worker-deployment-v2.mjs",
  "scripts/verify-github-actions-public-worker-workflow-v2.mjs",
  "tests/github-actions-public-worker-workflow-v2.test.mjs",
  "docs/github-actions-public-worker-deployment-v2.md"
]);

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function count(source, pattern) {
  return [...source.matchAll(pattern)].length;
}

function triggerSection(workflow) {
  const start = workflow.indexOf("on:\n");
  const end = workflow.indexOf("permissions:\n", start);
  assert.ok(start >= 0 && end > start);
  return workflow.slice(start, end);
}

export function verifyGithubActionsPublicWorkerWorkflowV2() {
  for (const path of REQUIRED_PATHS) {
    assert.equal(existsSync(resolve(root, path)), true, `${path} must exist`);
  }
  const qualification = read(PUBLIC_WORKFLOW_V2_POLICY.qualificationWorkflowPath);
  const deployment = read(PUBLIC_WORKFLOW_V2_POLICY.deploymentWorkflowPath);
  const contract = JSON.parse(read(PUBLIC_WORKFLOW_V2_POLICY.contractPath));
  const library = read("scripts/lib/github-actions-public-worker-workflow-v2.mjs");
  const deploymentCommand = read("scripts/run-github-actions-public-worker-deployment-v2.mjs");
  const qualificationTrigger = triggerSection(qualification);
  const deploymentTrigger = triggerSection(deployment);
  const deploymentPreflight = deployment.slice(
    deployment.indexOf("  preflight:\n"),
    deployment.indexOf("  deploy:\n")
  );
  const deploymentJob = deployment.slice(deployment.indexOf("  deploy:\n"));

  assert.match(qualification, /^name: Qualify Prometheus Public Worker$/mu);
  assert.match(deployment, /^name: Deploy Prometheus Public Worker$/mu);
  for (const trigger of [qualificationTrigger, deploymentTrigger]) {
    assert.deepEqual([...trigger.matchAll(/^  ([a-z_]+):$/gmu)].map(match => match[1]), [
      "workflow_dispatch"
    ]);
    for (const forbidden of ["push:", "schedule:", "repository_dispatch:", "workflow_call:", "pull_request:"]) {
      assert.equal(trigger.includes(forbidden), false);
    }
  }
  assert.equal(count(qualification, /^    runs-on: ubuntu-24\.04$/gmu), 1);
  assert.equal(count(deployment, /^    runs-on: ubuntu-24\.04$/gmu), 2);
  assert.equal(count(qualification, /^          node-version: "24\.4\.1"$/gmu), 1);
  assert.equal(count(deployment, /^          node-version: "24\.4\.1"$/gmu), 2);
  assert.equal(count(qualification, /^        run: npm ci$/gmu), 1);
  assert.equal(count(deployment, /^        run: npm ci$/gmu), 2);
  assert.equal(count(qualification, /^        run: npm test$/gmu), 1);
  assert.equal(count(qualification, /^        run: npm run build$/gmu), 1);
  assert.equal(count(
    qualification,
    /^        run: node scripts\/run-github-actions-public-worker-qualification\.mjs build$/gmu
  ), 1);
  assert.equal(count(deployment, /npm run build|npm test|vite build/gmu), 0);
  assert.equal(count(deployment, /--no-bundle/gmu), 0, "the guarded library owns Wrangler arguments");
  assert.equal(count(deployment, /wrangler(?:\.js)?\s+deploy/gmu), 0);
  assert.equal(count(deployment, /^        run: node scripts\/run-github-actions-public-worker-deployment-v2\.mjs deploy$/gmu), 1);
  assert.equal(count(deployment, /actions\/download-artifact@634f93cb2916e3fdff6788551b99b062d0335ce0/gmu), 2);
  assert.equal(count(qualification, /actions\/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02/gmu), 1);
  assert.equal(count(deployment, /artifact-ids: \$\{\{ inputs\.qualification_artifact_id \}\}/gmu), 2);
  assert.equal(count(deployment, /run-id: \$\{\{ inputs\.qualification_run_id \}\}/gmu), 2);
  assert.doesNotMatch(deploymentPreflight, /secrets\.[A-Z0-9_]+/u);
  assert.doesNotMatch(deploymentPreflight, /prometheus-public-worker-production/u);
  assert.match(deploymentJob, /environment:\n      name: prometheus-public-worker-production/u);
  assert.equal(count(deploymentJob, /secrets\.CLOUDFLARE_API_TOKEN/gmu), 1);
  assert.doesNotMatch(deployment, /--name|wrangler\.jsonc|prometheus-iq\s+deploy/u);
  assert.match(deployment, /group: deploy-prometheus-public-worker/u);
  assert.match(deployment, /cancel-in-progress: false/u);
  assert.match(qualification, /compression-level: 0/u);
  assert.match(qualification, /retention-days: 30/u);
  assert.match(library, /AUTHORIZATION_CONSUMED/u);
  assert.match(library, /--no-bundle/u);
  assert.match(library, /PUBLIC_WORKER_FORWARD_ROLLBACK_VERIFIED/u);
  assert.match(library, /authorizationConsumedAt: "forward_wrangler_process_spawn_confirmed"/u);
  assert.match(library, /preAuthorizationCloudflareReadOnlyRequestsAllowed: true/u);
  assert.match(library, /preAuthorizationCloudflareMutationRequestsAllowed: false/u);
  assert.match(deploymentCommand, /onProcessStarted: onMutationBoundary/u);
  assert.match(deploymentCommand, /runPublicWorkerSmokeV2/u);
  assert.match(deploymentCommand, /runRollback/u);

  assert.equal(contract.contractVersion, PUBLIC_WORKFLOW_V2_POLICY.contractVersion);
  assert.equal(contract.owner, "Prometheus Infrastructure");
  assert.equal(contract.target.publicWorker, PUBLIC_WORKFLOW_V2_POLICY.publicWorker);
  assert.equal(contract.target.privateWorker, PUBLIC_WORKFLOW_V2_POLICY.privateWorker);
  assert.equal(contract.target.privateWorkerMutationAllowed, false);
  assert.equal(contract.successfulProductionBaseline.commit,
    PUBLIC_WORKFLOW_V2_POLICY.successfulProductionBaseline.commit);
  assert.equal(contract.successfulProductionBaseline.tree,
    PUBLIC_WORKFLOW_V2_POLICY.successfulProductionBaseline.tree);
  assert.equal(contract.successfulProductionBaseline.deploymentAssetsSha256,
    PUBLIC_WORKFLOW_V2_POLICY.successfulProductionBaseline.deploymentAssetsSha256);
  assert.equal(contract.successfulProductionBaseline.privateVersion,
    PUBLIC_WORKFLOW_V2_POLICY.successfulProductionBaseline.privateVersion);
  assert.equal(contract.qualification.runner, PUBLIC_WORKFLOW_V2_POLICY.runner);
  assert.equal(contract.qualification.nodeVersion, PUBLIC_WORKFLOW_V2_POLICY.nodeVersion);
  assert.equal(contract.qualification.sourceBuildCommand, PUBLIC_WORKFLOW_V2_POLICY.sourceBuildCommand);
  assert.equal(
    contract.qualification.completeRepositorySuiteCommand,
    PUBLIC_WORKFLOW_V2_POLICY.completeRepositorySuiteCommand
  );
  assert.equal(contract.qualification.publicArtifactBuilds, 1);
  assert.equal(contract.qualification.cloudflareRequestAllowed, false);
  assert.equal(contract.qualification.secretAccessAllowed, false);
  assert.equal(contract.deployment.rebuildAllowed, false);
  assert.equal(contract.deployment.wranglerMode, "no-bundle");
  assert.equal(contract.deployment.forwardDeploymentAttempts, 1);
  assert.equal(contract.deployment.automaticRetryAllowed, false);
  assert.equal(contract.authorization.consumedAt, "forward_wrangler_process_spawn_confirmed");
  assert.equal(contract.authorization.preAuthorizationCloudflareReadOnlyRequestsAllowed, true);
  assert.equal(
    contract.authorization.preAuthorizationCloudflareReadScope,
    "exact_public_and_private_worker_identity_and_binding_prerequisites_only"
  );
  assert.equal(contract.authorization.preAuthorizationCloudflareMutationRequestsAllowed, false);
  assert.equal(contract.authorization.preBoundaryFailureRecordsDeploymentBegan, false);
  assert.equal(contract.authorization.changedCandidateRequiresNewQualificationAndAuthorization, true);
  assert.equal(contract.smoke.crmSubmissionAllowed, false);
  assert.equal(contract.smoke.notificationAllowed, false);
  assert.equal(contract.rollback.nativeCloudflareRollbackAllowed, false);
  assert.equal(contract.rollback.rollbackAttemptsAfterCriticalSmoke, 1);
  assert.equal(contract.runtimeBoundaries.collection, "OFF");
  assert.equal(contract.runtimeBoundaries.activeCohortCount, 0);
  assert.equal(contract.runtimeBoundaries.recommendationInfluence, "OFF");
  assert.equal(contract.runtimeBoundaries.anthonyMapped, false);

  const smoke = publicWorkerSmokeV2Plan();
  assert.ok(smoke.length > 0);
  assert.ok(smoke.every(entry => ["GET", "HEAD"].includes(entry.method) && entry.body === false));
  assert.ok(smoke.some(entry => entry.critical));
  assert.ok(smoke.some(entry => !entry.critical));

  const deploymentAssets = verifyRouteIqPublicDeploymentAssets({ build: false });
  assert.equal(
    deploymentAssets.deploymentAssetsSha256,
    PUBLIC_WORKFLOW_V2_POLICY.successfulProductionBaseline.deploymentAssetsSha256
  );
  verifyPublicStaticDeploymentPolicy(root);
  verifyPublicWranglerPin(root);
  return Object.freeze({ status: "GITHUB_ACTIONS_PUBLIC_WORKER_WORKFLOW_V2_VERIFIED" });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(`${verifyGithubActionsPublicWorkerWorkflowV2().status}\n`);
}
