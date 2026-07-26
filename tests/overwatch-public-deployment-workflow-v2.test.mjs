import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
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
const sha256 = value => createHash("sha256").update(value).digest("hex");
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
  const august1 = sources.governance.august1LaunchCloseoutSuccessor;
  const current = sources.governance.routeIqWebsitePositioningSuccessor;
  assert.equal(
    sources.governance.productContinuity.deploymentAssetSha256,
    "5fd9e497e7fe814aab6194b4302528c6cff0e243e76a3dd843738f1882cd8c15"
  );
  assert.equal(
    historical.files.at(-1).sha256,
    "76c56b86ff9c8a16ae585d3e3dd30a213e199dc937c678cd7aaeefb26e6924fc"
  );
  assert.equal(august1.historicalWorkflowEvidencePreserved, true);
  assert.equal(august1.historicalHashesAreCurrent, false);
  assert.equal(
    august1.currentReleaseIdentities.deploymentAssetSha256,
    "48d3b6b44b49366f3387dfc3e37d8e34d83abf5ea8bb0606b0070851802ff6a1"
  );
  assert.equal(
    august1.currentReleaseIdentities.infrastructureIntegrityContractSha256,
    "0582bc185ccf6f5e0825de25ce5fef8c65240fb0ee3b68c22bc5ba14865350c5"
  );
  assert.deepEqual(
    august1.overwatchPredecessors.map(item => item.commit),
    [
      "5c20b551820c21b02a0c25c9d38c93474457fd23",
      "59fab7bc5f307336fba52d15bc73181cb1a20b04",
      "899e4bbad0a74d2cf9514eda5ba5875b69aa6636",
      "bc5c03392580470c3549c8e3fe510458e5cdc196"
    ]
  );
  assert.equal(august1.overwatchPredecessors[0].parent, august1.provenanceAdmission.commit);
  assert.equal(august1.overwatchPredecessors[1].parent, august1.overwatchPredecessors[0].commit);
  assert.equal(august1.overwatchPredecessors[2].parent, august1.overwatchPredecessors[1].commit);
  assert.equal(august1.overwatchPredecessors[3].parent, august1.overwatchPredecessors[2].commit);
  assert.deepEqual(
    august1.qualificationPredecessors.map(item => item.commit),
    [
      "f464a6bc19e8d2e52cab258dd2cbdd7511a18a21",
      "4fb815a7e03f745685a36e24e847dbc1f109a7df",
      "1a1e130b9ffe63948ceaf7fc7d5cfff647431e3e",
      "e295f94c09d98c6ec45cf797ca51c12e62fac7be",
      "c58c44b0314598a5848599fc855c383b884fba60",
      "affd4548054ca5f2c73521820d3bd3b82afa7545",
      "325c50c4c33f18dea07f16d6214a4decdcc46c29",
      "e34259fa62a3530b0a24e9dbae3a015593c08a22",
      "95f367e03160bfeae98b722d99b6ca67d4424d72",
      "0cffd6afb7b660e61049baff330bf3b231077a89",
      "5aa41020ab857c9910b526acf138c1f7348c402f",
      "943baa9c48a85f8b0a57d5a371ff64d486926f8d"
    ]
  );
  assert.equal(august1.qualificationPredecessors[0].parent, august1.overwatchPredecessors[3].commit);
  for (let index = 1; index < august1.qualificationPredecessors.length; index += 1) {
    assert.equal(
      august1.qualificationPredecessors[index].parent,
      august1.qualificationPredecessors[index - 1].commit
    );
  }
  assert.equal(august1.overwatchSuccessor.parent, august1.qualificationPredecessors.at(-1).commit);
  assert.equal(august1.overwatchSuccessor.files.length, 8);

  assert.equal(current.classification, "CONTROLLING_PUBLIC_RELEASE_SUCCESSOR");
  assert.equal(current.historicalAugust1EvidencePreserved, true);
  assert.equal(current.historicalAugust1HashesAreCurrent, false);
  assert.equal(current.websiteSource.commit, "b83bcaf064ee7b57b28116ffb5e64cbf270605a0");
  assert.deepEqual(
    current.dataProvenanceSuccessors.map(item => item.commit),
    [
      "db70e304b77164c31fa0f95c25050fb61ea393c1",
      "c7e6a90ffc93bb7ae270365a198c740a4dc47126",
      "e1e7279e925acae69f7e32608475b98eff2c6023",
      "6e62887506e39f9dc936766ea7da4d70f688c0e4"
    ]
  );
  assert.equal(current.websiteAssets.commit, "72f3f5733f35a4ab56ae528f3a3616b455bd9ee6");
  assert.equal(current.infrastructure.commit, "a370836879b160e88c0e7e821003e66759cc97c4");
  assert.deepEqual(current.currentReleaseIdentities, {
    deploymentAssetSha256: "ce5279cb7f1b904457bb83d5b844b3f7339a586544d0a36b4eb3e41c1715276e",
    rollbackContractSha256: "df9a90e39076df62bb6c3ec521a9dd86afe8d65f0836645237dbc2d08c69302d",
    rollbackArtifactSha256: "37f215ffe57df61aaa741352111806b07ff1a97dabd07c36188080e62857e582",
    workflowContractSha256: "17ac6ac53220f77fe2d49339e7a93566c7c2419bb19c462200a2077f1df34ca7"
  });
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
      routeIqWebsitePositioningSuccessor: {
        ...sources.governance.routeIqWebsitePositioningSuccessor,
        currentReleaseIdentities: {
          ...sources.governance.routeIqWebsitePositioningSuccessor.currentReleaseIdentities,
          rollbackArtifactSha256: "0".repeat(64)
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
        qualificationPredecessors: [
          {
            ...sources.governance.august1LaunchCloseoutSuccessor.qualificationPredecessors[0],
            tree: "0".repeat(40)
          },
          ...sources.governance.august1LaunchCloseoutSuccessor.qualificationPredecessors.slice(1)
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
  assert.equal(hasGovernedPublicDeploymentWorkflowV2PackageSuccessor({
    governance: sources.governance,
    predecessorGovernanceId: transition.predecessorGovernanceId,
    historicalSha256: transition.historicalSha256,
    successorSha256: sha256(read("package.json"))
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
    successorSha256: "2df9f107770e36aa77faf9e26b98325c97e6c5b3edd24c04956d72f0710ef6d5"
  }), true);
  for (const patch of [
    { path: "src/App.jsx" },
    { historicalSha256: "0".repeat(64) },
    { successorSha256: "f".repeat(64) }
  ]) {
    assert.equal(hasGovernedPublicDeploymentWorkflowV2VerifierSuccessor({
      path: "scripts/verify-overwatch-cloudflare-unattended-access.mjs",
      historicalSha256: "766abafe2ef2d8d30b862b8b635424d622faad526732eb4893f1645b3186bf94",
      successorSha256: "2df9f107770e36aa77faf9e26b98325c97e6c5b3edd24c04956d72f0710ef6d5",
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
    files: [
      path,
      "overwatch/governance/github-actions-private-worker-deployment-v2.json",
      "scripts/verify-overwatch-github-actions-private-worker-deployment.mjs",
      "tests/overwatch-github-actions-private-worker-deployment.test.mjs"
    ]
  }), true);
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
