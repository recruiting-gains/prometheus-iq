import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import {
  PRIVATE_WORKER_DEPLOYMENT_POLICY,
  buildWranglerInvocation,
  verifyStaticDeploymentPolicy,
  verifyWranglerPin
} from "./lib/github-actions-private-worker-deployment.mjs";
import { fixedCloudflareUnattendedSmokePlan } from "./run-cloudflare-unattended-smoke.mjs";

const root = resolve(import.meta.dirname, "..");
const paths = Object.freeze({
  workflow: ".github/workflows/deploy-prometheus-private-worker.yml",
  library: "scripts/lib/github-actions-private-worker-deployment.mjs",
  runner: "scripts/run-github-actions-private-worker-deployment.mjs",
  verifier: "scripts/verify-github-actions-private-worker-deployment.mjs",
  tests: "tests/github-actions-private-worker-deployment.test.mjs",
  contract: "workers/infrastructure/github-actions-founder-triggered-private-worker-deployment-v1.json",
  documentation: "docs/github-actions-founder-triggered-private-worker-deployment-v1.md"
});

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function section(source, start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `missing section ${start}`);
  assert.notEqual(endIndex, -1, `missing section boundary ${end}`);
  return source.slice(startIndex, endIndex);
}

function count(source, pattern) {
  return [...source.matchAll(pattern)].length;
}

export function assertSetupNodeCachingDisabled(workflow) {
  assert.equal(
    count(workflow, /^\s*uses: actions\/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020$/gmu),
    2
  );
  assert.doesNotMatch(
    workflow,
    /^\s+(?:cache|cache-dependency-path|package-manager-cache):/mu
  );
}

export function assertFounderDispatchAuthorization(workflow) {
  const trigger = section(workflow, "on:\n", "permissions:\n");
  const verificationJob = section(workflow, "  verification:\n", "  deploy:\n");
  const deployJob = workflow.slice(workflow.indexOf("  deploy:\n"));
  const triggerNames = [...trigger.matchAll(/^  ([a-z_]+):$/gmu)].map(match => match[1]);
  const inputNames = [...trigger.matchAll(/^      ([a-z_]+):$/gmu)].map(match => match[1]);

  assert.deepEqual(triggerNames, ["workflow_dispatch"]);
  assert.deepEqual(inputNames, [
    "approved_commit",
    "approved_tree",
    "batch_id",
    "current_production_version",
    "founder_authorization"
  ]);
  assert.equal(count(trigger, /^        required: true$/gmu), 5);
  assert.equal(count(trigger, /^        type: string$/gmu), 5);
  assert.match(
    trigger,
    /description: Type exactly I AUTHORIZE THIS EXACT PROMETHEUS PRIVATE WORKER DEPLOYMENT/u
  );

  for (const predicate of [
    "github.event_name == 'workflow_dispatch'",
    "github.repository == 'PrometheusRouteIQ/prometheus-iq'",
    "github.actor == 'PrometheusRouteIQ'",
    "github.triggering_actor == 'PrometheusRouteIQ'",
    "github.ref == 'refs/heads/main'",
    "github.ref_name == 'main'",
    "github.ref_type == 'branch'",
    "github.workflow == 'Deploy Prometheus Private Worker'",
    "github.workflow_ref == 'PrometheusRouteIQ/prometheus-iq/.github/workflows/deploy-prometheus-private-worker.yml@refs/heads/main'",
    "github.run_attempt == 1",
    "inputs.founder_authorization == 'I AUTHORIZE THIS EXACT PROMETHEUS PRIVATE WORKER DEPLOYMENT'"
  ]) {
    assert.ok(verificationJob.includes(predicate), `preflight missing ${predicate}`);
  }
  assert.equal(count(workflow, /^          PROMETHEUS_FOUNDER_AUTHORIZATION: \$\{\{ inputs\.founder_authorization \}\}$/gmu), 4);
  assert.equal(count(workflow, /^          PROMETHEUS_DISPATCH_INPUTS_JSON: \$\{\{ toJSON\(github\.event\.inputs\) \}\}$/gmu), 4);
  assert.doesNotMatch(verificationJob, /\$\{\{\s*secrets\./u);
  assert.doesNotMatch(verificationJob, /prometheus-private-worker-production/u);
  assert.match(deployJob, /^    needs: verification$/mu);
  assert.match(deployJob, /^    if: \$\{\{ needs\.verification\.result == 'success' \}\}$/mu);
  assert.match(deployJob, /environment:\n      name: prometheus-private-worker-production/u);

  const inputReferences = [...workflow.matchAll(/\$\{\{\s*inputs\.([a-z_]+)\s*\}\}/gu)]
    .map(match => match[1]);
  assert.deepEqual([...new Set(inputReferences)].sort(), inputNames.toSorted());
}

export function verifyGithubActionsPrivateWorkerDeployment() {
  for (const path of Object.values(paths)) {
    assert.equal(existsSync(resolve(root, path)), true, `${path} must exist`);
  }

  const workflow = read(paths.workflow);
  const library = read(paths.library);
  const runner = read(paths.runner);
  const documentation = read(paths.documentation);
  const contract = JSON.parse(read(paths.contract));
  const permissions = section(workflow, "permissions:\n", "concurrency:\n");
  const verificationJob = section(workflow, "  verification:\n", "  deploy:\n");
  const deployJob = workflow.slice(workflow.indexOf("  deploy:\n"));

  assert.match(workflow, /^name: Deploy Prometheus Private Worker$/mu);
  assertFounderDispatchAuthorization(workflow);
  assert.equal(permissions.trim(), "permissions:\n  contents: read");
  assert.match(workflow, /concurrency:\n  group: deploy-prometheus-private-worker\n  cancel-in-progress: false/u);

  const actionReferences = [...workflow.matchAll(/^\s*uses:\s*(\S+)$/gmu)].map(match => match[1]);
  assert.deepEqual(actionReferences, [
    "actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5",
    "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020",
    "actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5",
    "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020"
  ]);
  assert.equal(count(workflow, /^          repository: PrometheusRouteIQ\/prometheus-iq$/gmu), 2);
  assert.equal(count(workflow, /^          ref: main$/gmu), 2);
  assert.equal(count(workflow, /^          fetch-depth: 0$/gmu), 2);
  assert.equal(count(workflow, /^          persist-credentials: false$/gmu), 2);
  assertSetupNodeCachingDisabled(workflow);
  assert.doesNotMatch(workflow, /actions\/(?:cache|upload-artifact|download-artifact)@/u);

  for (const command of [
    "npm ci",
    "npm test",
    "npm run lint",
    "npm run typecheck",
    "npm run security:check",
    "node scripts/check-cloudflare-unattended-secret-presence.mjs --source=environment",
    "npm run security:aegis:verify",
    "node scripts/verify-cross-subsystem-artifact-contracts.mjs",
    "node scripts/verify-github-actions-private-worker-deployment.mjs",
    "node --test tests/github-actions-private-worker-deployment.test.mjs",
    "npm run build",
    "git diff --exit-code",
    "git diff --cached --exit-code",
    "git status --porcelain=v1 --untracked-files=all",
    "git fsck --full --strict"
  ]) {
    assert.ok(verificationJob.includes(command), `verification job missing ${command}`);
  }

  assert.match(deployJob, /needs: verification/u);
  assert.match(deployJob, /if: \$\{\{ needs\.verification\.result == 'success' \}\}/u);
  assert.match(deployJob, /environment:\n      name: prometheus-private-worker-production/u);
  assert.equal(count(deployJob, /run: node scripts\/run-github-actions-private-worker-deployment\.mjs verify/gmu), 2);
  assert.equal(count(deployJob, /run: timeout 120s node scripts\/run-cloudflare-unattended-smoke\.mjs --execute-fixed-profile/gmu), 2);
  assert.equal(count(deployJob, /run: node scripts\/run-github-actions-private-worker-deployment\.mjs deploy/gmu), 1);
  assert.doesNotMatch(workflow, /prometheusrouteiq-website/u);
  assert.doesNotMatch(workflow, /wrangler(?:\.js)?\s+deploy/u);

  const secretReferences = [...workflow.matchAll(/\$\{\{\s*secrets\.([A-Z0-9_]+)\s*\}\}/gu)]
    .map(match => match[1]);
  const expectedSecretReferences = [
    "CLOUDFLARE_ACCESS_CLIENT_ID",
    "CLOUDFLARE_ACCESS_CLIENT_SECRET",
    "CLOUDFLARE_API_TOKEN",
    "CLOUDFLARE_ACCOUNT_ID",
    "CLOUDFLARE_ACCESS_CLIENT_ID",
    "CLOUDFLARE_ACCESS_CLIENT_SECRET"
  ];
  assert.deepEqual(secretReferences, expectedSecretReferences);
  const expectedSecretCounts = new Map([
    [expectedSecretReferences[0], 2],
    [expectedSecretReferences[1], 2],
    [expectedSecretReferences[2], 1],
    [expectedSecretReferences[3], 1]
  ]);
  for (const [name, expectedCount] of expectedSecretCounts) {
    const assignment = new RegExp(`^          ${name}:`, "gmu");
    assert.equal(count(deployJob, assignment), expectedCount);
  }

  assert.equal(contract.contractVersion, PRIVATE_WORKER_DEPLOYMENT_POLICY.contractVersion);
  assert.equal(contract.batchId, "BATCH-20260715-011");
  assert.equal(contract.owner, "Prometheus Infrastructure");
  assert.equal(contract.implementationStatus, "PRIVATE_REPOSITORY_COMPATIBILITY_IMPLEMENTED_NOT_EXECUTED");
  assert.equal(contract.releaseWiringOwner, "Prometheus Overwatch");
  assert.equal(contract.deploymentPerformed, false);
  assert.equal(contract.productionMutationPerformed, false);
  assert.equal(contract.target.repository, PRIVATE_WORKER_DEPLOYMENT_POLICY.repository);
  assert.equal(contract.target.branch, PRIVATE_WORKER_DEPLOYMENT_POLICY.branch);
  assert.equal(contract.target.privateWorker, PRIVATE_WORKER_DEPLOYMENT_POLICY.privateWorker);
  assert.equal(contract.target.publicWorker, PRIVATE_WORKER_DEPLOYMENT_POLICY.publicWorker);
  assert.equal(contract.target.publicWorkerDeploymentAllowed, false);
  assert.equal(contract.founderAuthorization.actor, PRIVATE_WORKER_DEPLOYMENT_POLICY.founderActor);
  assert.equal(contract.founderAuthorization.triggeringActor, PRIVATE_WORKER_DEPLOYMENT_POLICY.founderActor);
  assert.equal(contract.founderAuthorization.rerunAllowed, false);
  assert.equal(contract.founderAuthorization.exactPhrase, PRIVATE_WORKER_DEPLOYMENT_POLICY.founderAuthorization);
  assert.equal(contract.founderAuthorization.requiredReviewerProtectionAvailable, false);
  assert.equal(contract.founderAuthorization.dispatchIsExplicitApproval, true);
  assert.equal(contract.runtimeBoundaries.collection, "OFF");
  assert.equal(contract.runtimeBoundaries.activeCohortCount, 0);
  assert.equal(contract.runtimeBoundaries.recommendationInfluence, "OFF");
  assert.equal(contract.workflow.actions.setupNode.dependencyCaching, "DISABLED_BY_OMISSION");
  assert.deepEqual(contract.workflow.actions.setupNode.omittedInputs, [
    "cache",
    "cache-dependency-path"
  ]);
  assert.equal(contract.workflow.actions.setupNode.unsupportedInputPresent, false);
  assert.equal(contract.cloudflareReadBoundary.publicDeploymentIdentityCapturedBeforeMutation, true);
  assert.equal(contract.postDeployment.publicDeploymentIdMustRemainUnchanged, true);
  assert.equal(contract.postDeployment.publicVersionMustRemainUnchanged, true);
  assert.equal(contract.rollback.nativeRollbackAllowed, false);

  verifyStaticDeploymentPolicy(root);
  verifyWranglerPin(root);
  const syntheticInputs = Object.freeze({
    approvedCommit: "a".repeat(40),
    approvedTree: "b".repeat(40),
    batchId: "BATCH-20260715-011",
    currentProductionVersion: "11111111-1111-1111-1111-111111111111",
    founderAuthorization: PRIVATE_WORKER_DEPLOYMENT_POLICY.founderAuthorization
  });
  const dryRun = buildWranglerInvocation("dry-run", syntheticInputs);
  const deployment = buildWranglerInvocation("deploy", syntheticInputs);
  assert.deepEqual(deployment.slice(0, 8), [
    "node_modules/wrangler/bin/wrangler.js",
    "deploy",
    "--config",
    "wrangler.jsonc",
    "--name",
    "prometheus-iq",
    "--keep-vars",
    "--strict"
  ]);
  assert.equal(dryRun.includes("--dry-run"), true);
  assert.equal(deployment.includes("--dry-run"), false);
  assert.equal(dryRun.includes("wrangler.prometheusrouteiq-website.jsonc"), false);
  assert.equal(deployment.includes("prometheusrouteiq-website"), false);

  const smokePlan = fixedCloudflareUnattendedSmokePlan();
  assert.ok(smokePlan.length > 0);
  for (const request of smokePlan) {
    assert.ok(["GET", "HEAD"].includes(request.method));
    assert.equal(request.redirect, "manual");
    assert.equal(request.credentials, "omit");
    assert.equal(request.body, false);
  }
  assert.equal(smokePlan.some(request => !["GET", "HEAD"].includes(request.method)), false);

  assert.doesNotMatch(library, /console\.(?:log|error|warn)/u);
  assert.doesNotMatch(library, /prometheusrouteiq-website\.jsonc["']\s*,\s*["']--name/u);
  assert.match(runner, /console\.log\(result\.status\)/u);
  assert.match(runner, /console\.error\(code\)/u);
  assert.doesNotMatch(runner, /console\.(?:log|error)\([^\n]*(?:apiToken|accountId|response|headers|body)/iu);

  for (const requiredText of [
    "One-Time Founder Setup",
    "prometheus-private-worker-production",
    "required-reviewer protection",
    "unavailable for this private repository",
    "PrometheusRouteIQ",
    PRIVATE_WORKER_DEPLOYMENT_POLICY.founderAuthorization,
    "first run attempt",
    "main-only deployment branch rule",
    "PrometheusRouteIQ/prometheus-iq",
    "prometheus-iq",
    "prometheusrouteiq-website",
    "CLOUDFLARE_API_TOKEN",
    "CLOUDFLARE_ACCOUNT_ID",
    "CLOUDFLARE_ACCESS_CLIENT_ID",
    "CLOUDFLARE_ACCESS_CLIENT_SECRET",
    "Actions workflow permissions",
    "phone",
    "Forward-Only Recovery",
    "new Founder-approved forward-revert commit",
    "No deployment was performed"
  ]) {
    assert.ok(documentation.includes(requiredText), `documentation missing ${requiredText}`);
  }

  return Object.freeze({
    status: "passed",
    batchId: contract.batchId,
    owner: contract.owner,
    implementationStatus: contract.implementationStatus,
    workflow: contract.workflow.name,
    privateWorker: contract.target.privateWorker,
    publicWorkerDeploymentAllowed: contract.target.publicWorkerDeploymentAllowed,
    networkRequestsPerformed: 0,
    productionMutationPerformed: false
  });
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    console.log(JSON.stringify(verifyGithubActionsPrivateWorkerDeployment(), null, 2));
  } catch (error) {
    console.error(`GitHub Actions private Worker deployment verification failed: ${error.message}`);
    process.exitCode = 1;
  }
}
