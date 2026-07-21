import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  evaluatePublicDeploymentWorkflowV2Governance,
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
