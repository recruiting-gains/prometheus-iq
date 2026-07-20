#!/usr/bin/env node

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  PUBLIC_WRANGLER_FAILURE_REASON,
  PUBLIC_WRANGLER_PHASE,
  PUBLIC_WORKER_DEPLOYMENT_POLICY,
  buildPublicWranglerInvocation,
  verifyPublicStaticDeploymentPolicy,
  verifyPublicWranglerPin
} from "./lib/github-actions-public-worker-deployment.mjs";
import {
  fixedCloudflarePublicWorkerSmokePlan,
  isPublicIntakeGuardAllowHeaderValid
} from "./run-cloudflare-public-worker-smoke.mjs";
import { verifyRouteIqPublicDeploymentAssets } from "./verify-route-iq-public-deployment-assets.mjs";

const root = resolve(import.meta.dirname, "..");
const paths = Object.freeze([
  ".gitattributes",
  PUBLIC_WORKER_DEPLOYMENT_POLICY.workflowPath,
  PUBLIC_WORKER_DEPLOYMENT_POLICY.contractPath,
  PUBLIC_WORKER_DEPLOYMENT_POLICY.rollbackContractPath,
  "scripts/lib/github-actions-public-worker-deployment.mjs",
  "scripts/lib/route-iq-public-forward-rollback.mjs",
  "scripts/run-github-actions-public-worker-deployment.mjs",
  "scripts/run-public-worker-repository-integrity-diagnostic.mjs",
  "scripts/run-cloudflare-public-worker-smoke.mjs",
  "scripts/verify-route-iq-public-forward-rollback.mjs",
  "scripts/verify-route-iq-public-deployment-assets.mjs",
  "tests/github-actions-public-worker-deployment.test.mjs",
  "docs/github-actions-founder-triggered-public-worker-deployment-v1.md"
]);

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function section(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(from, -1, `missing ${start}`);
  assert.notEqual(to, -1, `missing ${end}`);
  return source.slice(from, to);
}

function count(source, pattern) {
  return [...source.matchAll(pattern)].length;
}

function assertGeneratedAssetsPrecedeVerification(job, jobName) {
  const install = job.indexOf("run: npm ci");
  const build = job.indexOf("run: npm run build");
  const verification = job.indexOf(
    "run: node scripts/run-github-actions-public-worker-deployment.mjs verify"
  );
  assert.ok(install >= 0, `${jobName} dependency installation is missing`);
  assert.ok(build > install, `${jobName} public asset generation must follow npm ci`);
  assert.ok(verification > build, `${jobName} public assets must exist before no-secret verification`);
  assert.equal(count(job, /^\s*run: npm run build$/gmu), 1, `${jobName} must generate assets exactly once`);
}

export function verifyGithubActionsPublicWorkerDeployment() {
  for (const path of paths) assert.equal(existsSync(resolve(root, path)), true, `${path} must exist`);
  const workflow = read(PUBLIC_WORKER_DEPLOYMENT_POLICY.workflowPath);
  const trigger = section(workflow, "on:\n", "permissions:\n");
  const verification = section(workflow, "  verification:\n", "  deploy:\n");
  const deploy = workflow.slice(workflow.indexOf("  deploy:\n"));
  const library = read("scripts/lib/github-actions-public-worker-deployment.mjs");
  const documentation = read("docs/github-actions-founder-triggered-public-worker-deployment-v1.md");
  const deploymentContract = JSON.parse(read(PUBLIC_WORKER_DEPLOYMENT_POLICY.contractPath));
  const rollbackContract = JSON.parse(read(PUBLIC_WORKER_DEPLOYMENT_POLICY.rollbackContractPath));
  const attributes = read(".gitattributes");

  assert.match(workflow, /^name: Deploy Prometheus Public Worker$/mu);
  assert.match(attributes, /^deploy\/prometheusrouteiq-website\/assets\/IntelligenceScene-\*\.js binary$/mu);
  assert.doesNotMatch(attributes, /deploy\/prometheusrouteiq-website\/assets\/\*\.js binary/u);
  assert.deepEqual([...trigger.matchAll(/^  ([a-z_]+):$/gmu)].map(match => match[1]), ["workflow_dispatch"]);
  assert.deepEqual([...trigger.matchAll(/^      ([a-z0-9_]+):$/gmu)].map(match => match[1]), [
    "approved_commit",
    "approved_tree",
    "batch_id",
    "current_public_version",
    "current_private_version",
    "rollback_artifact_sha256",
    "founder_authorization"
  ]);
  assert.equal(count(trigger, /^        required: true$/gmu), 7);
  assert.equal(count(trigger, /^        type: string$/gmu), 7);
  for (const forbidden of ["push:", "schedule:", "repository_dispatch:", "workflow_call:", "pull_request:"]){
    assert.equal(trigger.includes(forbidden), false);
  }
  for (const predicate of [
    "github.repository == 'PrometheusRouteIQ/prometheus-iq'",
    "github.actor == 'PrometheusRouteIQ'",
    "github.triggering_actor == 'PrometheusRouteIQ'",
    "github.ref == 'refs/heads/main'",
    "github.workflow == 'Deploy Prometheus Public Worker'",
    "github.run_attempt == 1",
    "inputs.founder_authorization == 'I AUTHORIZE THIS EXACT PROMETHEUS PUBLIC WORKER DEPLOYMENT'"
  ]) assert.ok(verification.includes(predicate), `missing ${predicate}`);
  assert.equal(section(workflow, "permissions:\n", "concurrency:\n").trim(), "permissions:\n  contents: read");
  assert.match(workflow, /concurrency:\n  group: deploy-prometheus-public-worker\n  cancel-in-progress: false/u);
  assert.doesNotMatch(verification, /\$\{\{\s*secrets\./u);
  assert.doesNotMatch(verification, /prometheus-public-worker-production/u);
  assertGeneratedAssetsPrecedeVerification(verification, "verification job");
  assertGeneratedAssetsPrecedeVerification(deploy, "deploy job");
  assert.match(deploy, /environment:\n      name: prometheus-public-worker-production/u);
  assert.equal(count(deploy, /run: node scripts\/run-github-actions-public-worker-deployment\.mjs deploy/gmu), 1);
  assert.equal(count(deploy, /run: timeout 120s node scripts\/run-cloudflare-public-worker-smoke\.mjs --execute-fixed-profile/gmu), 2);
  assert.doesNotMatch(workflow, /wrangler(?:\.js)?\s+deploy/u);
  assert.doesNotMatch(workflow, /--name/u);
  assert.doesNotMatch(workflow, /wrangler\.jsonc|--name\s+prometheus-iq/u);
  assert.equal(count(workflow, /^          repository: PrometheusRouteIQ\/prometheus-iq$/gmu), 2);
  assert.equal(count(workflow, /^          ref: main$/gmu), 2);
  assert.deepEqual([...workflow.matchAll(/^\s*uses:\s*(\S+)$/gmu)].map(match => match[1]), [
    "actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5",
    "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020",
    "actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5",
    "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020"
  ]);
  const secretNames = [...workflow.matchAll(/\$\{\{\s*secrets\.([A-Z0-9_]+)\s*\}\}/gu)].map(match => match[1]);
  assert.deepEqual(secretNames, [
    "CLOUDFLARE_API_TOKEN",
    "CLOUDFLARE_ACCOUNT_ID",
    "ROUTE_IQ_REQUEST_CRM_ACCESS_TEAM_DOMAIN",
    "ROUTE_IQ_REQUEST_CRM_ACCESS_AUDIENCE",
    "ROUTE_IQ_REQUEST_CRM_FOUNDER_SUBJECT_SHA256"
  ]);
  for (const command of [
    "npm test",
    "npm run security:check",
    "npm run security:aegis:verify",
    "npm run lint",
    "npm run typecheck",
    "npm run build",
    "node scripts/run-public-worker-repository-integrity-diagnostic.mjs"
  ]) assert.ok(verification.includes(command), `missing ${command}`);

  const syntheticInputs = Object.freeze({
    batchId: "BATCH-20260719-004",
    approvedCommit: "a".repeat(40)
  });
  for (const mode of ["dry-run", "deploy"]) {
    const invocation = buildPublicWranglerInvocation(mode, syntheticInputs, "/tmp/settings.json");
    assert.ok(invocation.includes(PUBLIC_WORKER_DEPLOYMENT_POLICY.publicConfig));
    assert.equal(invocation.includes("--name"), false);
    assert.equal(invocation.includes(PUBLIC_WORKER_DEPLOYMENT_POLICY.privateWorker), false);
  }
  const smoke = fixedCloudflarePublicWorkerSmokePlan();
  assert.ok(smoke.length > 0);
  assert.ok(smoke.every(request => ["GET", "HEAD"].includes(request.method) && request.body === false));
  for (const [method, value] of [
    ["GET", "POST"],
    ["GET", "POST, OPTIONS"],
    ["GET", "OPTIONS,POST"],
    ["HEAD", "GET, POST"],
    ["HEAD", "POST,GET"]
  ]) {
    assert.equal(isPublicIntakeGuardAllowHeaderValid(method, value), true, `${method} ${value} must be accepted`);
  }
  for (const [method, value] of [
    ["GET", null],
    ["GET", "OPTIONS"],
    ["GET", "GET, POST"],
    ["GET", "POST, PUT"],
    ["GET", "POST, POST"],
    ["GET", "POST,,OPTIONS"],
    ["HEAD", "POST"],
    ["HEAD", "POST, OPTIONS"],
    ["HEAD", "GET, PUT"],
    ["HEAD", "GET, POST, PUT"],
    ["HEAD", "GET, GET"],
    ["HEAD", "get, POST"],
    ["OPTIONS", "POST"],
    ["toString", "POST"]
  ]) assert.equal(isPublicIntakeGuardAllowHeaderValid(method, value), false, `${method} ${value} must be rejected`);
  assert.match(documentation, /cannot be attached while retaining the current live public Worker version/u);
  assert.match(documentation, /canonical deployable bundle rather than the entire repository tree/u);
  assert.match(documentation, /Run `29723618108` failed before deployment/u);
  assert.equal(deploymentContract.workflow.generatedAssetsCommand, "npm run build");
  assert.equal(deploymentContract.workflow.generatedAssetsDirectory, "dist-public");
  assert.equal(deploymentContract.workflow.generatedAssetsBeforeNoSecretVerification, true);
  assert.deepEqual(deploymentContract.workflow.generatedAssetsJobs, ["verification", "deploy"]);
  assert.equal(
    deploymentContract.workflow.assetIdentityVerifier,
    "scripts/verify-route-iq-public-deployment-assets.mjs"
  );
  assert.deepEqual(deploymentContract.cleanRunnerFailureEvidence, {
    batchId: "BATCH-20260720-002",
    runId: 29723618108,
    head: "1e4e9be843fe418ae8920ccb109b4259fda5455c",
    tree: "e0d86821386d2f3d348eb88ae25f85f367878280",
    failedStep: "Verify no-secret dispatch context, exact repository, contracts, rollback, Wrangler, and Git integrity",
    failureClassification: "GENERATED_PUBLIC_ASSETS_MISSING_BEFORE_VERIFICATION",
    missingDirectory: "dist-public",
    deploymentJobSkipped: true,
    cloudflareChanged: false,
    immutableEvidence: true
  });
  assert.deepEqual(deploymentContract.cloudflareReadFailureEvidence, {
    batchId: "BATCH-20260720-006",
    runId: 29780926642,
    head: "5c920ad7c56289791d12c756d4b9627bf18b4632",
    tree: "5db5225a8f09d5e2295a89d4a7f2a3fa1305ff8b",
    requestTimeoutMs: 15000,
    observedElapsedMs: 15016,
    observedOutput: "DEPLOY_FAILED",
    rootCause: "response_body_read_error_outside_transport_classifier",
    fixedReadPhases: [
      "PUBLIC_DEPLOYMENTS",
      "PUBLIC_SETTINGS",
      "PRIVATE_DEPLOYMENTS",
      "PRIVATE_SETTINGS"
    ],
    fixedFailureClassifications: [
      "NETWORK_UNCERTAIN",
      "REQUEST_TIMEOUT",
      "REDIRECT_DENIED",
      "HTTP_FAILED",
      "RESPONSE_BODY_FAILED",
      "RESPONSE_INVALID"
    ],
    productionRequestTimeoutMs: 30000,
    testRequestTimeoutMaximumMs: 1000,
    maximumSerializedStateReads: 12,
    maximumSerializedReadBudgetMs: 360000,
    deploymentJobTimeoutMs: 1800000,
    deadlineRationale: "double_confirmed_insufficient_deadline_with_six_minute_fail_closed_read_budget",
    automaticRetryAllowed: false,
    publicVersionCreated: false,
    publicVersionUnchanged: true,
    privateVersionUnchanged: true,
    rollbackRequired: false,
    secretOutputAllowed: false,
    immutableEvidence: true
  });
  assert.deepEqual(deploymentContract.wranglerFailureDiagnostics, {
    contractVersion: "wrangler-post-asset-failure-classification-v1",
    wranglerVersion: "4.110.0",
    phases: Object.values(PUBLIC_WRANGLER_PHASE),
    reasonCodes: Object.values(PUBLIC_WRANGLER_FAILURE_REASON),
    emittedFields: ["WRANGLER_PHASE", "WRANGLER_FAILURE_REASON"],
    rawChildOutputAllowed: false,
    outputStringMaterializationAllowed: false,
    capturedOutputZeroized: true,
    oneChildInvocationPerMode: true,
    wrapperRetryAllowed: false,
    timeoutKillsChild: true,
    overflowKillsChild: true,
    ambiguousOutputReason: "UNKNOWN_NONZERO_EXIT"
  });
  assert.deepEqual(deploymentContract.wranglerDeploymentFailureEvidence, {
    batchId: "BATCH-20260720-007",
    runId: 29786701514,
    verificationPassed: true,
    preDeploymentSmokePassed: true,
    dryRunPassed: true,
    deployChildInvoked: true,
    deployChildExitedNonzero: true,
    observedOutput: "DEPLOY_FAILED",
    matchingSuccessfulCloudflareMutationAuditEntries: 0,
    publicVersionUnchanged: true,
    privateVersionUnchanged: true,
    failureDimension: "UNCLASSIFIABLE_FROM_PRE_REPAIR_WRAPPER",
    retroactiveReasonAssignmentAllowed: false,
    automaticRetryAllowed: false,
    immutableEvidence: true
  });
  assert.deepEqual(deploymentContract.priorWranglerAssetAuditEvidence, {
    batchId: "BATCH-20260720-006",
    runId: 29780926642,
    observedLocalMinute: "2026-07-20 16:43 CDT",
    successfulAssetUploadSessionEntries: 1,
    successfulUploadAssetsEntries: 3,
    attributedToBatch20260720007: false,
    preservedSeparately: true,
    immutableEvidence: true
  });
  for (const marker of [
    "CLOUDFLARE_READ_PHASE",
    "REQUEST_TIMEOUT",
    "RESPONSE_BODY_FAILED",
    "HTTP_STATUS",
    "WRANGLER_PHASE",
    "WRANGLER_FAILURE_REASON",
    "ASSET_COMPLETION_MISSING",
    "UNKNOWN_NONZERO_EXIT"
  ]) assert.ok(library.includes(marker), `missing fixed deployment diagnostic marker ${marker}`);
  assert.equal(PUBLIC_WORKER_DEPLOYMENT_POLICY.requestTimeoutMs, 30000);
  assert.equal(PUBLIC_WORKER_DEPLOYMENT_POLICY.testRequestTimeoutMaximumMs, 1000);
  assert.equal(rollbackContract.candidateWebsiteCommit, "7a66490704ca5a7f4d3a6b720ae9c498e2f1676b");
  assert.equal(rollbackContract.candidateWebsiteTree, "b3bff85693bcaa1f23f97d9c31e3607b59e8f8a7");
  assert.match(rollbackContract.candidateDeploymentAssetsSha256, /^[0-9a-f]{64}$/u);
  assert.notEqual(rollbackContract.candidateWebsiteCommit, rollbackContract.sourceWebsiteCommit);
  assert.equal(rollbackContract.artifact.identityVersion, "route-iq-public-forward-rollback-artifact-v3");
  assert.equal(rollbackContract.artifact.unrelatedRepositoryFilesAffectIdentity, false);
  assert.deepEqual(rollbackContract.artifact.requiredGeneratedOutputs, [
    "prometheus-iq-worker.js",
    "prometheus-iq-worker.js.map"
  ]);
  assert.deepEqual(rollbackContract.artifact.excludedBuildOnlyOutputs, ["README.md"]);
  assert.match(workflow, /verify-route-iq-public-forward-rollback\.mjs "\$\{\{ inputs\.rollback_artifact_sha256 \}\}"/u);
  assert.match(library, /assertPublicBindingsPreserved/u);
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
