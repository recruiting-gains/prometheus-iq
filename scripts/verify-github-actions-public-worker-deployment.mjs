#!/usr/bin/env node

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  PUBLIC_WORKER_DEPLOYMENT_POLICY,
  buildPublicWranglerInvocation,
  verifyPublicStaticDeploymentPolicy,
  verifyPublicWranglerPin
} from "./lib/github-actions-public-worker-deployment.mjs";
import { fixedCloudflarePublicWorkerSmokePlan } from "./run-cloudflare-public-worker-smoke.mjs";

const root = resolve(import.meta.dirname, "..");
const paths = Object.freeze([
  PUBLIC_WORKER_DEPLOYMENT_POLICY.workflowPath,
  PUBLIC_WORKER_DEPLOYMENT_POLICY.contractPath,
  PUBLIC_WORKER_DEPLOYMENT_POLICY.rollbackContractPath,
  "scripts/lib/github-actions-public-worker-deployment.mjs",
  "scripts/lib/route-iq-public-forward-rollback.mjs",
  "scripts/run-github-actions-public-worker-deployment.mjs",
  "scripts/run-cloudflare-public-worker-smoke.mjs",
  "scripts/verify-route-iq-public-forward-rollback.mjs",
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

export function verifyGithubActionsPublicWorkerDeployment() {
  for (const path of paths) assert.equal(existsSync(resolve(root, path)), true, `${path} must exist`);
  const workflow = read(PUBLIC_WORKER_DEPLOYMENT_POLICY.workflowPath);
  const trigger = section(workflow, "on:\n", "permissions:\n");
  const verification = section(workflow, "  verification:\n", "  deploy:\n");
  const deploy = workflow.slice(workflow.indexOf("  deploy:\n"));
  const library = read("scripts/lib/github-actions-public-worker-deployment.mjs");
  const documentation = read("docs/github-actions-founder-triggered-public-worker-deployment-v1.md");

  assert.match(workflow, /^name: Deploy Prometheus Public Worker$/mu);
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
    "git fsck --full --strict"
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
  assert.match(documentation, /cannot be attached while retaining the current live public Worker version/u);
  assert.match(library, /assertPublicBindingsPreserved/u);
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
