import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  evaluatePublicDeploymentWorkflowV2Governance,
  hasGovernedPublicDeploymentWorkflowV2PackageSuccessor,
  hasGovernedPublicDeploymentWorkflowV2VerifierSuccessor,
  verifyOverwatchPublicDeploymentWorkflowV2
} from "../scripts/verify-overwatch-public-deployment-workflow-v2.mjs";

const read = path => readFileSync(path, "utf8");
const sources = Object.freeze({
  governance: JSON.parse(read("overwatch/governance/public-deployment-workflow-v2.json")),
  ownerContract: JSON.parse(read("workers/infrastructure/github-actions-public-worker-deployment-v2.json")),
  qualification: read(".github/workflows/qualify-prometheus-public-worker.yml"),
  deployment: read(".github/workflows/deploy-prometheus-public-worker.yml"),
  documentation: read("overwatch/governance/public-deployment-workflow-v2.md")
});

function evaluate(changes = {}) {
  return evaluatePublicDeploymentWorkflowV2Governance({ ...sources, ...changes });
}

test("canonical Public Deployment Workflow v2 governance verifies", () => {
  assert.equal(evaluate().ok, true);
  assert.equal(verifyOverwatchPublicDeploymentWorkflowV2().status, "OVERWATCH_PUBLIC_DEPLOYMENT_WORKFLOW_V2_VERIFIED");
});

test("governance fails closed on ownership or production-boundary drift", () => {
  for (const patch of [
    { dispatchAudit: { ...sources.governance.dispatchAudit, implementationOwner: "Prometheus Overwatch" } },
    { provenanceRepair: { ...sources.governance.provenanceRepair, author: "Prometheus Overwatch <overwatch@prometheus.local>" } },
    { provenanceRepair: { ...sources.governance.provenanceRepair, parent: "07bf2eddc9707cb410ff6670efe9465ca68cd6b4" } },
    { authorizationBoundaryRepair: { ...sources.governance.authorizationBoundaryRepair, ownerCommit: "0".repeat(40) } },
    { authorizationBoundaryRepair: { ...sources.governance.authorizationBoundaryRepair, author: "Prometheus Overwatch <overwatch@prometheus.local>" } },
    { authorizationBoundaryGovernance: { ...sources.governance.authorizationBoundaryGovernance, ownerCommit: "0".repeat(40) } },
    { authorizationBoundaryGovernance: { ...sources.governance.authorizationBoundaryGovernance, classification: "SUBSYSTEM_IMPLEMENTATION" } },
    { architecture: { ...sources.governance.architecture, authorizationConsumedAt: "before_process_spawn" } },
    { architecture: { ...sources.governance.architecture, preBoundaryFailureConsumesAuthorization: true } },
    { runtimeBoundaries: { ...sources.governance.runtimeBoundaries, deploymentPerformedByBatch: true } },
    { productContinuity: { ...sources.governance.productContinuity, approvedWebsiteSourceChanged: true } }
  ]) {
    assert.equal(evaluate({ governance: { ...sources.governance, ...patch } }).ok, false);
  }
});

test("qualification rejects secret access, deployment routes, and duplicate builds", () => {
  for (const qualification of [
    sources.qualification.replace("permissions:\n", "env:\n  TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}\n\npermissions:\n"),
    sources.qualification.replace("run: npm test", "run: node scripts/run-github-actions-public-worker-deployment-v2.mjs deploy"),
    sources.qualification.replace("run: npm run build", "run: npm run build\n      - run: npm run build")
  ]) assert.equal(evaluate({ qualification }).ok, false);
});

test("deployment rejects rebuilds, alternate targets, and extra deploy commands", () => {
  for (const deployment of [
    sources.deployment.replace("run: npm ci", "run: npm run build"),
    sources.deployment.replace("run: npm ci", "run: npx wrangler deploy --name prometheus-iq"),
    sources.deployment.replace(
      "run: node scripts/run-github-actions-public-worker-deployment-v2.mjs deploy",
      "run: node scripts/run-github-actions-public-worker-deployment-v2.mjs deploy\n      - run: node scripts/run-github-actions-public-worker-deployment-v2.mjs deploy"
    )
  ]) assert.equal(evaluate({ deployment }).ok, false);
});

test("candidate freeze cannot be weakened or reused after material change", () => {
  for (const patch of [
    { sourceChangeInvalidatesCandidate: false },
    { preBoundaryExternalFailureInvalidatesUnchangedCandidate: true },
    { materiallyChangedCandidateMayReuseAuthorization: true }
  ]) {
    assert.equal(evaluate({
      governance: {
        ...sources.governance,
        candidateStability: { ...sources.governance.candidateStability, ...patch }
      }
    }).ok, false);
  }
});

test("paused unattended access accepts only the exact Overwatch package successor", () => {
  for (const patch of [
    { successorSha256: "0".repeat(64) },
    { owner: "Prometheus Infrastructure" },
    { path: "package-lock.json" }
  ]) {
    assert.equal(evaluate({
      governance: {
        ...sources.governance,
        protectedPredecessorSuccessors: [{
          ...sources.governance.protectedPredecessorSuccessors[0],
          ...patch
        }]
      }
    }).ok, false);
  }
  assert.equal(sources.governance.protectedPredecessorSuccessors.length, 2);
  assert.equal(new Set(
    sources.governance.protectedPredecessorSuccessors.map(item => item.predecessorGovernanceId)
  ).size, 2);
});

test("historical gates accept only an exact governed Workflow v2 package successor", () => {
  const transition = sources.governance.protectedPredecessorSuccessors[1];
  assert.equal(hasGovernedPublicDeploymentWorkflowV2PackageSuccessor({
    governance: sources.governance,
    predecessorGovernanceId: transition.predecessorGovernanceId,
    historicalSha256: transition.historicalSha256,
    successorSha256: transition.successorSha256
  }), true);

  for (const patch of [
    { predecessorGovernanceId: "wrong-governance" },
    { historicalSha256: "0".repeat(64) },
    { successorSha256: "f".repeat(64) }
  ]) {
    assert.equal(hasGovernedPublicDeploymentWorkflowV2PackageSuccessor({
      governance: sources.governance,
      predecessorGovernanceId: transition.predecessorGovernanceId,
      historicalSha256: transition.historicalSha256,
      successorSha256: transition.successorSha256,
      ...patch
    }), false);
  }

  assert.equal(hasGovernedPublicDeploymentWorkflowV2PackageSuccessor({
    governance: {
      ...sources.governance,
      protectedPredecessorSuccessors: [{ ...transition, owner: "Prometheus Infrastructure" }]
    },
    predecessorGovernanceId: transition.predecessorGovernanceId,
    historicalSha256: transition.historicalSha256,
    successorSha256: transition.successorSha256
  }), false);
});

test("historical verifier successors require the exact linear Overwatch tail", () => {
  assert.equal(hasGovernedPublicDeploymentWorkflowV2VerifierSuccessor({
    path: "scripts/verify-overwatch-cloudflare-unattended-access.mjs",
    historicalSha256: "766abafe2ef2d8d30b862b8b635424d622faad526732eb4893f1645b3186bf94",
    successorSha256: "6d0bbb82091b1c9f931da80db0656e7e8a8cefbe8a8488e17b55428b439eb932"
  }), true);
  for (const patch of [
    { path: "src/App.jsx" },
    { historicalSha256: "0".repeat(64) },
    { successorSha256: "f".repeat(64) }
  ]) {
    assert.equal(hasGovernedPublicDeploymentWorkflowV2VerifierSuccessor({
      path: "scripts/verify-overwatch-cloudflare-unattended-access.mjs",
      historicalSha256: "766abafe2ef2d8d30b862b8b635424d622faad526732eb4893f1645b3186bf94",
      successorSha256: "6d0bbb82091b1c9f931da80db0656e7e8a8cefbe8a8488e17b55428b439eb932",
      ...patch
    }), false);
  }
});
