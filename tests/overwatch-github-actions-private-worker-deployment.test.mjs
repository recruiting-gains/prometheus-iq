import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { fixedCloudflareUnattendedSmokePlan } from
  "../scripts/run-cloudflare-unattended-smoke.mjs";
import {
  evaluateGithubActionsPrivateWorkerDeploymentGovernance,
  evaluateGithubActionsPrivateWorkerSuccessorOwnership,
  evaluateGithubActionsPrivateWorkerV2Governance,
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
const governanceV2 = readJson(
  "overwatch/governance/github-actions-private-worker-deployment-v2.json"
);
const contractV2 = readJson(
  "workers/infrastructure/github-actions-private-worker-deployment-v2.json"
);
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
  assert.equal(result.immutableWorkflowV2SourceGoverned, true);
  assert.equal(result.immutableWorkflowV2QualificationPending, true);
  assert.equal(result.immutableWorkflowV2DeploymentReady, true);
  assert.equal(result.immutableWorkflowV2BootstrapRepairCommit,
    "a5ae6578bc0c030def8df5d4713d5ecbe5206212");
  assert.equal(result.immutableWorkflowV2RunnerWorkspaceRepairCommit,
    "254fea23e18fec27228e15e75986a1c6bb3dffd6");
  assert.equal(result.immutableWorkflowV2TrustedTempAliasRepairCommit,
    "6a764ad86ad4f99e0bd9ed835c8f1aba20f91a3b");
  assert.equal(result.immutableWorkflowV2WranglerScratchIsolationCommit,
    "947720badd46cb053c6e199b96b3739180b26690");
  assert.equal(result.immutableWorkflowV2Node24CleanupRepairCommit,
    "1341e8edf6e96603437b7bff95768531e2f5446a");
  assert.equal(result.immutableWorkflowV2CanonicalSmokeRepairCommit,
    "dfa52c70cd48b33771d6c85de6483c499d9b038f");
  assert.equal(result.localRealWranglerDryRunPassed, true);
  assert.equal(result.cleanRunnerRealWranglerEvidencePending, true);
  assert.equal(result.protectedEnvironmentRequiredNamesPresent, true);
  assert.equal(result.failedDeploymentRunReachedProductionMutation, false);
  assert.equal(result.runnerWorkspaceFailureReachedProductionMutation, false);
  assert.equal(result.wranglerScratchFailureReachedProductionMutation, false);
});

test("Overwatch governance accepts the immutable private Workflow v2 owner release", () => {
  assert.equal(evaluateGithubActionsPrivateWorkerV2Governance({
    governance: governanceV2,
    contract: contractV2
  }).ok, true);
});

test("immutable private Workflow v2 governance fails closed on ownership and safety drift", () => {
  const governanceMutations = [
    value => { value.version = "1.2.0"; },
    value => { value.ownership.implementationOwner = "Prometheus Overwatch"; },
    value => { value.ownership.overwatchModifiedInfrastructureImplementation = true; },
    value => { value.ownership.implementationCommit.commit = "0".repeat(40); },
    value => {
      value.ownership.implementationBootstrapRepairCommit.commit = "0".repeat(40);
    },
    value => {
      value.ownership.implementationRunnerWorkspaceRepairCommit.commit = "0".repeat(40);
    },
    value => {
      value.ownership.implementationTrustedTempAliasRepairCommit.commit = "0".repeat(40);
    },
    value => {
      value.ownership.implementationWranglerScratchIsolationCommit.commit = "0".repeat(40);
    },
    value => {
      value.ownership.implementationNode24CleanupRepairCommit.commit = "0".repeat(40);
    },
    value => {
      value.ownership.implementationCanonicalSmokeRepairCommit.commit = "0".repeat(40);
    },
    value => { value.ownership.bootstrapRepairEvidence[0].sha256 = "0".repeat(64); },
    value => { value.ownership.runnerWorkspaceRepairEvidence[0].sha256 = "0".repeat(64); },
    value => { value.ownership.trustedTempAliasRepairEvidence[0].sha256 = "0".repeat(64); },
    value => {
      value.ownership.wranglerScratchIsolationEvidence[0].sha256 = "0".repeat(64);
    },
    value => {
      value.ownership.node24CleanupRepairEvidence[0].sha256 = "0".repeat(64);
    },
    value => {
      value.ownership.canonicalSmokeRepairEvidence[0].sha256 = "0".repeat(64);
    },
    value => { value.rootCause.legacyQualificationArtifactDeployable = true; },
    value => { value.rootCause.firstDeploymentReachedProductionMutation = true; },
    value => { value.rootCause.secondDeploymentReachedProductionMutation = true; },
    value => { value.rootCause.thirdDeploymentDryRunCompleted = false; },
    value => { value.rootCause.thirdDeploymentForwardWranglerSpawned = true; },
    value => { value.rootCause.thirdDeploymentReachedProductionMutation = true; },
    value => { value.rootCause.fourthQualificationReachedArtifactBuild = true; },
    value => { value.rootCause.canonicalSmokeFailedRunsReachedProductionMutation = true; },
    value => { value.rootCause.canonicalSmokeFailedRuns = []; },
    value => {
      value.rootCause.runnerWorkspaceCause =
        "The temporary alias was rejected before the Wrangler process could start.";
    },
    value => { value.workflowBoundary.onlyTrigger = "push"; },
    value => { value.workflowBoundary.publicWorkerMutationAllowed = true; },
    value => { value.workflowBoundary.rebuildDuringDeploymentAllowed = true; },
    value => { value.workflowBoundary.forwardDeploymentAttempts = 2; },
    value => { value.workflowBoundary.automaticRetryAllowed = true; },
    value => { value.artifactBoundary.workerNameOverrideAllowed = true; },
    value => { value.artifactBoundary.phaseSpecificOutdirRequired = false; },
    value => { value.qualificationEvidence.localRealWrangler.status = "FAIL"; },
    value => {
      value.qualificationEvidence.cleanGithubRunner.qualificationMayPassWithoutEvidence = true;
    },
    value => { value.smokeBoundary.methods = ["GET", "POST"]; },
    value => { value.smokeBoundary.attemptedApplicationWrites = 1; },
    value => { value.smokeBoundary.redirectsFollowed = true; },
    value => { value.smokeBoundary.canonicalHtmlPath = "/index.html"; },
    value => { value.smokeBoundary.noncanonicalHtmlAliasesAllowed = true; },
    value => { value.runtimeBoundary.prospectiveCollection = "ON"; },
    value => { value.runtimeBoundary.activeCohorts = 1; },
    value => { value.runtimeBoundary.recommendationInfluence = "ON"; },
    value => { value.protectedEnvironment.secretValuesAccessed = true; },
    value => {
      value.protectedEnvironment.readOnlyNameAudit.CLOUDFLARE_ACCOUNT_ID = "ABSENT";
    },
    value => { value.protectedEnvironment.deploymentReady = false; },
    value => {
      value.releaseBoundary.failedDeploymentRunReachedProductionMutation = true;
    },
    value => {
      value.releaseBoundary.runnerWorkspaceFailureReachedProductionMutation = true;
    },
    value => {
      value.releaseBoundary.wranglerScratchFailureReachedProductionMutation = true;
    },
    value => { value.releaseBoundary.cleanRunnerRequalificationRequired = false; },
    value => { value.releaseBoundary.productionContactPerformedByThisGovernanceCommit = true; }
  ];
  for (const mutate of governanceMutations) {
    const changed = clone(governanceV2);
    mutate(changed);
    assert.equal(evaluateGithubActionsPrivateWorkerV2Governance({
      governance: changed,
      contract: contractV2
    }).ok, false);
  }

  const changedContract = clone(contractV2);
  changedContract.deployment.rebuildAllowed = true;
  assert.equal(evaluateGithubActionsPrivateWorkerV2Governance({
    governance: governanceV2,
    contract: changedContract
  }).ok, false);
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
