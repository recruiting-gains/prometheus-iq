#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { FULL_SYSTEM_HARMONY_AUDIT_POLICY } from "./run-full-system-harmony-audit-v1.mjs";
import { verifyRouteIqPublicCrmEdgeBoundaryInfrastructure } from "./verify-route-iq-public-crm-edge-boundary-infrastructure.mjs";

const root = resolve(import.meta.dirname, "..");

export function verifyFullSystemHarmonyWorkflowText(workflow, contract) {
  assert.match(workflow, /^name: Full-System Harmony Audit v1$/mu);
  const trigger = workflow.slice(workflow.indexOf("on:\n"), workflow.indexOf("permissions:\n"));
  assert.deepEqual([...trigger.matchAll(/^  ([a-z_]+):$/gmu)].map(match => match[1]), ["workflow_dispatch"]);
  for (const forbidden of ["push:", "pull_request:", "schedule:", "repository_dispatch:", "workflow_call:"]) {
    assert.equal(trigger.includes(forbidden), false);
  }
  for (const required of [
    "github.actor == 'PrometheusRouteIQ'",
    "github.triggering_actor == 'PrometheusRouteIQ'",
    "github.sha == inputs.candidate_commit",
    "git rev-parse HEAD^{tree}",
    "npm test",
    "npm run security:check",
    "npm run security:aegis:verify",
    "run-full-system-harmony-audit-v1.mjs inspect",
    "run-full-system-harmony-audit-v1.mjs qualify",
    "run-full-system-harmony-audit-v1.mjs verify-artifact",
    "run-full-system-harmony-audit-v1.mjs deploy",
    "inputs.runtime_repair_required == true",
    FULL_SYSTEM_HARMONY_AUDIT_POLICY.deploymentConfirmation,
    "prometheus-private-worker-production"
  ]) assert.ok(workflow.includes(required), required);

  assert.equal(contract.runtimeIdentity.runnerImage, "ubuntu-24.04");
  assert.equal(contract.runtimeIdentity.checkoutRef, "main");
  assert.deepEqual(contract.runtimeIdentity.requiredJobs, ["qualify", "reverify", "deploy"]);
  for (const [index, job] of contract.runtimeIdentity.requiredJobs.entries()) {
    const start = workflow.indexOf(`  ${job}:\n`);
    const steps = workflow.indexOf("    steps:\n", start);
    const nextJob = contract.runtimeIdentity.requiredJobs[index + 1];
    const end = nextJob ? workflow.indexOf(`  ${nextJob}:\n`, steps) : workflow.length;
    assert.ok(start >= 0 && steps > start, `${job} job structure`);
    const jobConfiguration = workflow.slice(start, steps);
    const jobText = workflow.slice(start, end);
    assert.equal(jobConfiguration.includes("runner.temp"), false,
      `${job} job-level contexts must not reference runner.temp`);
    assert.match(jobConfiguration, /^      PROMETHEUS_RUNNER_IMAGE: ubuntu-24\.04$/mu,
      `${job} exact governed runner identity`);
    assert.equal((jobText.match(/^          ref: main$/gmu) || []).length, 1,
      `${job} exact synchronized main checkout`);
    assert.equal(jobText.includes("          ref: ${{ inputs.candidate_commit }}"), false,
      `${job} detached candidate checkout prohibited`);
  }
  assert.equal(/prometheusrouteiq-website[^\n]*(?:deploy|wrangler)/iu.test(workflow), false);
  assert.equal(/(?:POST|PUT|PATCH|DELETE) \/api\/partner-intake/iu.test(workflow), false);
  assert.match(workflow, /GET\/HEAD acceptance/u);
}

export function verifyFullSystemHarmonyAuditV1(repositoryRoot = root) {
  const workflow = readFileSync(resolve(repositoryRoot, ".github/workflows/full-system-harmony-audit-v1.yml"), "utf8");
  const worker = readFileSync(resolve(repositoryRoot, "workers/prometheus-iq-worker.js"), "utf8");
  const contract = JSON.parse(readFileSync(
    resolve(repositoryRoot, "workers/infrastructure/full-system-harmony-audit-v1.json"),
    "utf8"
  ));
  const revenue = JSON.parse(readFileSync(
    resolve(repositoryRoot, "workers/infrastructure/paid-customer-revenue-readiness-v1.json"),
    "utf8"
  ));
  const rollback = JSON.parse(readFileSync(
    resolve(repositoryRoot, "workers/infrastructure/route-iq-private-forward-rollback-candidate-v3.json"),
    "utf8"
  ));

  assert.equal(contract.owner, "Prometheus Infrastructure");
  assert.equal(contract.trigger, "workflow_dispatch");
  assert.equal(contract.acceptedRevenueDeployment.runId, 30627469584);
  assert.equal(contract.acceptedRevenueDeployment.privateWorkerVersion, "UNKNOWN");
  assert.equal(contract.acceptedRevenueDeployment.privateWorkerVersionPrefix, "b121a01a");
  assert.equal(contract.acceptedRevenueDeployment.resolution, "READ_ONLY_PROTECTED_HOSTED_PROBE_REQUIRED");
  assert.equal(revenue.acceptedDeployment.runId, 30627469584);
  assert.equal(revenue.acceptedDeployment.privateWorkerVersion, "UNKNOWN");
  assert.equal(rollback.currentPrivateProduction.workerVersion, "b8cba784-dfd3-4f8e-8356-816cccf6aecc");
  assert.equal(rollback.acceptedRevenueDeploymentProvenance.workerVersion, "UNKNOWN");
  assert.equal(rollback.acceptedRevenueDeploymentProvenance.workerVersionPrefix, "b121a01a");
  assert.equal(rollback.acceptedRevenueDeploymentProvenance.fullVersionGuessingAllowed, false);

  verifyFullSystemHarmonyWorkflowText(workflow, contract);

  for (const path of [
    "/api/dashboard/route-iq/founder/session",
    "/api/dashboard/route-iq/founder/system-status",
    "workspace_id",
    "FOUNDER_FIELD_RESEARCH",
    "NOT_A_CUSTOMER",
    "NO_PAID_CUSTOMER_CONFIGURATION",
    "SERVER_VERIFIED_CLOUDFLARE_ACCESS",
    "CONTINUE_FOUNDER_FIELD_RESEARCH",
    "administratorRoleProjected: false",
    "customerPwaLaunch: \"OFF\"",
    "recommendationInfluence: \"OFF\""
  ]) assert.ok(worker.includes(path), path);
  assert.equal(worker.includes("synthetic-orion-commercial-rehearsal-v1"), false);

  verifyRouteIqPublicCrmEdgeBoundaryInfrastructure(repositoryRoot);
  return Object.freeze({ status: "FULL_SYSTEM_HARMONY_AUDIT_V1_VERIFIED" });
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    process.stdout.write(`${verifyFullSystemHarmonyAuditV1().status}\n`);
  } catch {
    process.stdout.write("FULL_SYSTEM_HARMONY_AUDIT_V1_FAILED\n");
    process.exitCode = 1;
  }
}
