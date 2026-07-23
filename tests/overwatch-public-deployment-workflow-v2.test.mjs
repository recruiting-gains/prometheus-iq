import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  evaluatePublicDeploymentWorkflowV2Governance,
  hasGovernedPublicDeploymentWorkflowV2PackageSuccessor,
  hasGovernedPublicDeploymentWorkflowV2VerifierSuccessor,
  isGovernedPublicDeploymentWorkflowV2VerifierCommit,
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

test("historical Workflow v2 evidence remains historical beside exact current owner evidence", () => {
  const historical = sources.governance.workflowV2FixtureRepairSuccessor;
  const current = sources.governance.august1LaunchCloseoutSuccessor;
  assert.equal(
    sources.governance.productContinuity.deploymentAssetSha256,
    "5fd9e497e7fe814aab6194b4302528c6cff0e243e76a3dd843738f1882cd8c15"
  );
  assert.equal(
    historical.files.at(-1).sha256,
    "76c56b86ff9c8a16ae585d3e3dd30a213e199dc937c678cd7aaeefb26e6924fc"
  );
  assert.equal(current.historicalWorkflowEvidencePreserved, true);
  assert.equal(current.historicalHashesAreCurrent, false);
  assert.equal(
    current.currentReleaseIdentities.deploymentAssetSha256,
    "48d3b6b44b49366f3387dfc3e37d8e34d83abf5ea8bb0606b0070851802ff6a1"
  );
  assert.equal(
    current.currentReleaseIdentities.infrastructureIntegrityContractSha256,
    "0582bc185ccf6f5e0825de25ce5fef8c65240fb0ee3b68c22bc5ba14865350c5"
  );
  assert.deepEqual(
    current.overwatchPredecessors.map(item => item.commit),
    [
      "5c20b551820c21b02a0c25c9d38c93474457fd23",
      "59fab7bc5f307336fba52d15bc73181cb1a20b04"
    ]
  );
  assert.equal(current.overwatchPredecessors[0].parent, current.provenanceAdmission.commit);
  assert.equal(current.overwatchPredecessors[1].parent, current.overwatchPredecessors[0].commit);
  assert.equal(current.overwatchSuccessor.parent, current.overwatchPredecessors[1].commit);
  assert.equal(current.overwatchSuccessor.files.length, 6);
});

test("governance fails closed on ownership or production-boundary drift", () => {
  for (const patch of [
    { dispatchAudit: { ...sources.governance.dispatchAudit, implementationOwner: "Prometheus Overwatch" } },
    { provenanceRepair: { ...sources.governance.provenanceRepair, author: "Prometheus Overwatch <overwatch@prometheus.local>" } },
    { provenanceRepair: { ...sources.governance.provenanceRepair, parent: "07bf2eddc9707cb410ff6670efe9465ca68cd6b4" } },
    { authorizationBoundaryRepair: { ...sources.governance.authorizationBoundaryRepair, ownerCommit: "0".repeat(40) } },
    { authorizationBoundaryRepair: { ...sources.governance.authorizationBoundaryRepair, author: "Prometheus Overwatch <overwatch@prometheus.local>" } },
    { workflowV2FixtureRepairSuccessor: { ...sources.governance.workflowV2FixtureRepairSuccessor, ownerCommit: "0".repeat(40) } },
    { workflowV2FixtureRepairSuccessor: { ...sources.governance.workflowV2FixtureRepairSuccessor, author: "Prometheus Overwatch <overwatch@prometheus.local>" } },
    { workflowV2FixtureRepairSuccessor: { ...sources.governance.workflowV2FixtureRepairSuccessor, historicalTestSha256: "0".repeat(64) } },
    { authorizationBoundaryGovernance: { ...sources.governance.authorizationBoundaryGovernance, ownerCommit: "0".repeat(40) } },
    { authorizationBoundaryGovernance: { ...sources.governance.authorizationBoundaryGovernance, classification: "SUBSYSTEM_IMPLEMENTATION" } },
    { authorizationBoundaryProvenanceAdmission: { ...sources.governance.authorizationBoundaryProvenanceAdmission, ownerCommit: "0".repeat(40) } },
    { authorizationBoundaryProvenanceAdmission: { ...sources.governance.authorizationBoundaryProvenanceAdmission, author: "Prometheus Overwatch <overwatch@prometheus.local>" } },
    {
      august1LaunchCloseoutSuccessor: {
        ...sources.governance.august1LaunchCloseoutSuccessor,
        provenanceAdmission: {
          ...sources.governance.august1LaunchCloseoutSuccessor.provenanceAdmission,
          commit: "0".repeat(40)
        }
      }
    },
    {
      august1LaunchCloseoutSuccessor: {
        ...sources.governance.august1LaunchCloseoutSuccessor,
        overwatchPredecessors: [
          {
            ...sources.governance.august1LaunchCloseoutSuccessor.overwatchPredecessors[0],
            tree: "0".repeat(40)
          },
          sources.governance.august1LaunchCloseoutSuccessor.overwatchPredecessors[1]
        ]
      }
    },
    {
      august1LaunchCloseoutSuccessor: {
        ...sources.governance.august1LaunchCloseoutSuccessor,
        overwatchSuccessor: {
          ...sources.governance.august1LaunchCloseoutSuccessor.overwatchSuccessor,
          files: [
            ...sources.governance.august1LaunchCloseoutSuccessor.overwatchSuccessor.files,
            "workers/infrastructure/unrelated-runtime.js"
          ]
        }
      }
    },
    {
      august1LaunchCloseoutSuccessor: {
        ...sources.governance.august1LaunchCloseoutSuccessor,
        currentReleaseIdentities: {
          ...sources.governance.august1LaunchCloseoutSuccessor.currentReleaseIdentities,
          deploymentAssetSha256: "0".repeat(64)
        }
      }
    },
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

test("historical verifier successors preserve path ownership across unrelated owner commits", () => {
  const laterInfrastructureCommits = execFileSync("/usr/bin/git", [
    "log",
    "--format=%H",
    "--author=infrastructure@prometheus.local",
    "5b5b59509206578336b9671582669b600d0c74d4..HEAD"
  ], { encoding: "utf8" }).trim().split("\n").filter(Boolean);
  assert.ok(laterInfrastructureCommits.length > 0);
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

test("protected verifier ownership rejects subsystem edits without rejecting unrelated work", () => {
  const path = "scripts/verify-overwatch-cloudflare-unattended-access.mjs";
  assert.equal(isGovernedPublicDeploymentWorkflowV2VerifierCommit({
    path,
    author: "infrastructure@prometheus.local",
    committer: "infrastructure@prometheus.local",
    subject: "infrastructure: repair unrelated runtime",
    files: ["workers/infrastructure/unrelated-runtime.js"]
  }), true);
  assert.equal(isGovernedPublicDeploymentWorkflowV2VerifierCommit({
    path,
    author: "infrastructure@prometheus.local",
    committer: "infrastructure@prometheus.local",
    subject: "infrastructure: modify verifier",
    files: [path]
  }), false);
  assert.equal(isGovernedPublicDeploymentWorkflowV2VerifierCommit({
    path,
    author: "overwatch@prometheus.local",
    committer: "overwatch@prometheus.local",
    subject: "overwatch: advance verifier",
    files: [path, "workers/infrastructure/unrelated-runtime.js"]
  }), false);
  assert.equal(isGovernedPublicDeploymentWorkflowV2VerifierCommit({
    path,
    author: "overwatch@prometheus.local",
    committer: "overwatch@prometheus.local",
    subject: "overwatch: advance verifier",
    files: [path]
  }), true);
});
