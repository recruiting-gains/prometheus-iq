import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { fixedCloudflareUnattendedSmokePlan } from
  "../scripts/run-cloudflare-unattended-smoke.mjs";
import {
  evaluateGithubActionsPrivateWorkerDeploymentGovernance,
  evaluateGithubActionsPrivateWorkerSuccessorOwnership,
  evaluateGithubActionsPrivateWorkerWorkflow,
  verifyOverwatchGithubActionsPrivateWorkerDeployment
} from "../scripts/verify-overwatch-github-actions-private-worker-deployment.mjs";

const root = resolve(import.meta.dirname, "..");
const read = path => readFileSync(resolve(root, path), "utf8");
const readJson = path => JSON.parse(read(path));
const governance = readJson(
  "overwatch/governance/github-actions-founder-triggered-private-worker-deployment-v1.json"
);
const report = readJson(
  "overwatch/reports/BATCH-20260715-011-github-private-repository-founder-deployment-authorization.json"
);
const contract = readJson(
  "workers/infrastructure/github-actions-founder-triggered-private-worker-deployment-v1.json"
);
const workflow = read(".github/workflows/deploy-prometheus-private-worker.yml");
const clone = value => structuredClone(value);

function evaluate(nextGovernance = governance, nextReport = report, nextContract = contract) {
  return evaluateGithubActionsPrivateWorkerDeploymentGovernance({
    governance: nextGovernance,
    report: nextReport,
    contract: nextContract
  });
}

test("Overwatch verifies Founder-authenticated private-repository deployment dispatch", () => {
  const result = verifyOverwatchGithubActionsPrivateWorkerDeployment();
  assert.equal(result.status, "passed");
  assert.equal(result.batchId, "BATCH-20260715-011");
  assert.equal(result.implementationOwner, "Prometheus Infrastructure");
  assert.equal(result.verificationOwner, "Prometheus Overwatch");
  assert.equal(result.implementationCommit,
    "38e983b6d0a121d8aadf443938ab5985771eddac");
  assert.equal(result.founderActor, "PrometheusRouteIQ");
  assert.equal(result.founderTriggeringActor, "PrometheusRouteIQ");
  assert.equal(result.workflowBranch, "main");
  assert.equal(result.workflowTrigger, "workflow_dispatch");
  assert.equal(result.rerunAllowed, false);
  assert.equal(result.privateWorker, "prometheus-iq");
  assert.equal(result.publicWorkerDeploymentAllowed, false);
  assert.equal(result.writeAttemptsAllowed, 0);
  assert.equal(result.deploymentPerformed, false);
  assert.equal(result.firstDeploymentReady, false);
});

test("governance rejects ownership, authorization, secret, runtime, and release drift", () => {
  const mutations = [
    value => { value.compatibilitySuccessor.implementationOwner = "Prometheus Overwatch"; },
    value => { value.compatibilitySuccessor.overwatchModifiedInfrastructureImplementation = true; },
    value => { value.compatibilitySuccessor.implementationCommit.commit = "0".repeat(40); },
    value => { value.compatibilitySuccessor.ownerEvidence[0].sha256 = "0".repeat(64); },
    value => { value.compatibilitySuccessor.authorizationModel.actor = "AnotherActor"; },
    value => { value.compatibilitySuccessor.authorizationModel.triggeringActor = "AnotherActor"; },
    value => { value.compatibilitySuccessor.authorizationModel.rerunAllowed = true; },
    value => { value.startingStateAudit.unverifiedDiagnosticWorkPushed = true; },
    value => { value.protectedPredecessorSuccessors[0].successorOwner = "Prometheus Infrastructure"; },
    value => { value.protectedOverwatchVerifierSuccessors[0].successorSha256 = "0".repeat(64); },
    value => { value.workflowBoundary.onlyTrigger = "push"; },
    value => { value.workflowBoundary.publicWorkerDeploymentAllowed = true; },
    value => { value.workflowBoundary.environmentRequiredReviewer = true; },
    value => { value.secretBoundary.verificationJobReceivesSecrets = true; },
    value => { value.secretBoundary.deploymentJobRequiresSuccessfulPreflight = false; },
    value => { value.deploymentSafety.oneWranglerDeploymentAttemptMaximum = false; },
    value => { value.deploymentSafety.smokeWriteAttemptsAllowed = 1; },
    value => { value.runtimeBoundary.prospectiveCollection = "ON"; },
    value => { value.runtimeBoundary.activeCohorts = 1; },
    value => { value.runtimeBoundary.recommendationInfluence = "ON"; },
    value => { value.runtimeBoundary.deploymentPerformedByBatch = true; },
    value => { value.manualSetupBoundary.deploymentReadyNow = true; },
    value => { value.rollback.nativeCloudflareRollbackAllowed = true; },
    value => { value.releaseBoundary.pushMayTriggerDeployment = true; },
    value => { value.releaseBoundary.deploymentAuthorizedByThisBatch = true; }
  ];
  for (const mutate of mutations) {
    const changed = clone(governance);
    mutate(changed);
    assert.equal(evaluate(changed).ok, false);
  }
});

test("report and Infrastructure contract cannot overstate readiness or external action", () => {
  const changedReport = clone(report);
  changedReport.runtimeBoundaries.deployment = "PERFORMED";
  assert.equal(evaluate(governance, changedReport).ok, false);

  const changedContract = clone(contract);
  changedContract.runtimeBoundaries.recommendationInfluence = "ON";
  assert.equal(evaluate(governance, report, changedContract).ok, false);
});

test("workflow rejects automatic, delegated, and broader trigger routes", () => {
  for (const changed of [
    workflow.replace("  workflow_dispatch:", "  push:\n  workflow_dispatch:"),
    workflow.replace("  workflow_dispatch:", "  schedule:\n  workflow_dispatch:"),
    workflow.replace("  workflow_dispatch:", "  repository_dispatch:\n  workflow_dispatch:"),
    workflow.replace("  workflow_dispatch:", "  workflow_call:\n  workflow_dispatch:"),
    workflow.replace("  contents: read", "  contents: write"),
    workflow.replace("  cancel-in-progress: false", "  cancel-in-progress: true")
  ]) assert.equal(evaluateGithubActionsPrivateWorkerWorkflow(changed).ok, false);
});

test("workflow rejects Founder identity, branch, rerun, and phrase drift", () => {
  for (const changed of [
    workflow.replace("github.actor == 'PrometheusRouteIQ'", "github.actor == 'AnotherActor'"),
    workflow.replace("github.triggering_actor == 'PrometheusRouteIQ'",
      "github.triggering_actor == 'AnotherActor'"),
    workflow.replace("github.ref == 'refs/heads/main'", "github.ref == 'refs/heads/release'"),
    workflow.replace("github.ref_name == 'main'", "github.ref_name == 'release'"),
    workflow.replace("@refs/heads/main'", "@refs/heads/release'"),
    workflow.replace("github.run_attempt == 1", "github.run_attempt >= 1"),
    workflow.replace(
      "I AUTHORIZE THIS EXACT PROMETHEUS PRIVATE WORKER DEPLOYMENT",
      "I AUTHORIZE A BROADER DEPLOYMENT"
    )
  ]) assert.equal(evaluateGithubActionsPrivateWorkerWorkflow(changed).ok, false);
});

test("workflow rejects missing, extra, or optional Founder inputs", () => {
  const missing = workflow.replace(
    /      founder_authorization:\n(?:        .*\n){3}/u,
    ""
  );
  const extra = workflow.replace(
    "permissions:\n",
    "      bypass:\n        description: Forbidden bypass\n        required: true\n        type: string\n\npermissions:\n"
  );
  const optional = workflow.replace(
    "      founder_authorization:\n        description: Type exactly I AUTHORIZE THIS EXACT PROMETHEUS PRIVATE WORKER DEPLOYMENT\n        required: true",
    "      founder_authorization:\n        description: Type exactly I AUTHORIZE THIS EXACT PROMETHEUS PRIVATE WORKER DEPLOYMENT\n        required: false"
  );
  for (const changed of [missing, extra, optional]) {
    assert.equal(evaluateGithubActionsPrivateWorkerWorkflow(changed).ok, false);
  }
});

test("workflow rejects secret access before successful no-secret preflight", () => {
  const verificationSecret = workflow.replace(
    "      - name: Install exact locked dependencies",
    "      - name: Inject forbidden secret\n        env:\n          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}\n        run: true\n\n      - name: Install exact locked dependencies"
  );
  const verificationEnvironment = workflow.replace(
    "  verification:\n    name:",
    "  verification:\n    environment: prometheus-private-worker-production\n    name:"
  );
  const noDependency = workflow.replace("    needs: verification\n", "");
  const bypassDependency = workflow.replace(
    "if: ${{ needs.verification.result == 'success' }}",
    "if: ${{ always() }}"
  );
  for (const changed of [
    verificationSecret,
    verificationEnvironment,
    noDependency,
    bypassDependency
  ]) assert.equal(evaluateGithubActionsPrivateWorkerWorkflow(changed).ok, false);
});

test("workflow rejects public targeting, direct Wrangler, and extra deployment attempts", () => {
  for (const changed of [
    workflow.replace(
      "run: node scripts/run-github-actions-private-worker-deployment.mjs deploy",
      "run: npx wrangler deploy --name prometheusrouteiq-website"
    ),
    workflow.replace(
      "run: node scripts/run-github-actions-private-worker-deployment.mjs deploy",
      "run: node scripts/run-github-actions-private-worker-deployment.mjs deploy\n      - run: node scripts/run-github-actions-private-worker-deployment.mjs deploy"
    )
  ]) assert.equal(evaluateGithubActionsPrivateWorkerWorkflow(changed).ok, false);
});

test("workflow rejects missing gates, environment drift, action drift, and caching", () => {
  for (const changed of [
    workflow.replace("        run: npm test", "        run: true"),
    workflow.replace("      name: prometheus-private-worker-production", "      name: unprotected"),
    workflow.replace(
      "actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5",
      "actions/checkout@v4"
    ),
    workflow.replace("          node-version: \"24\"", "          node-version: \"24\"\n          cache: npm")
  ]) assert.equal(evaluateGithubActionsPrivateWorkerWorkflow(changed).ok, false);
});

test("fixed interoperability smoke is GET or HEAD only and bodyless", () => {
  const plan = fixedCloudflareUnattendedSmokePlan();
  assert.ok(plan.length > 0);
  assert.ok(plan.every(request => (
    ["GET", "HEAD"].includes(request.method)
    && request.redirect === "manual"
    && request.credentials === "omit"
    && request.body === false
  )));
});

test("canonical governance and workflow evaluations pass", () => {
  assert.equal(evaluate().ok, true);
  assert.equal(evaluateGithubActionsPrivateWorkerWorkflow(workflow).ok, true);
});

test("historical deployment gate ignores unrelated subsystem successors", () => {
  const result = evaluateGithubActionsPrivateWorkerSuccessorOwnership([{
    commit: "dashboard-successor",
    author: "Prometheus Dashboard <dashboard@prometheus.local>",
    committer: "Prometheus Dashboard <dashboard@prometheus.local>",
    paths: ["scripts/verify-dashboard-runtime-workflows.mjs"]
  }]);
  assert.equal(result.ok, true);
});

test("historical deployment gate rejects protected cross-owner successors", () => {
  const dashboardTouchesOverwatch =
    evaluateGithubActionsPrivateWorkerSuccessorOwnership([{
      commit: "dashboard-crosses-boundary",
      author: "Prometheus Dashboard <dashboard@prometheus.local>",
      committer: "Prometheus Dashboard <dashboard@prometheus.local>",
      paths: ["scripts/verify-overwatch-github-actions-private-worker-deployment.mjs"]
    }]);
  assert.equal(dashboardTouchesOverwatch.ok, false);

  const overwatchTouchesInfrastructure =
    evaluateGithubActionsPrivateWorkerSuccessorOwnership([{
      commit: "overwatch-crosses-boundary",
      author: "Prometheus Overwatch <overwatch@prometheus.local>",
      committer: "Prometheus Overwatch <overwatch@prometheus.local>",
      paths: ["scripts/lib/github-actions-private-worker-deployment.mjs"]
    }]);
  assert.equal(overwatchTouchesInfrastructure.ok, false);
});
