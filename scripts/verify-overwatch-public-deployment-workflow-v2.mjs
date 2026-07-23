#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

import { verifyPublicForwardRollbackArtifact } from "./lib/route-iq-public-forward-rollback.mjs";
import { verifyAutomaticCommitPushGovernance } from "./verify-overwatch-auto-push-governance.mjs";
import { verifyCrossSubsystemArtifactContracts } from "./verify-cross-subsystem-artifact-contracts.mjs";
import { verifyGithubActionsPublicWorkerWorkflowV2 } from "./verify-github-actions-public-worker-workflow-v2.mjs";
import { verifyRouteIqPublicDeploymentAssets } from "./verify-route-iq-public-deployment-assets.mjs";

const root = resolve(import.meta.dirname, "..");
const GOVERNANCE_PATH = "overwatch/governance/public-deployment-workflow-v2.json";
const HISTORICAL_READINESS_GOVERNANCE_PATH =
  "overwatch/governance/route-iq-public-deployment-integrity-repair-readiness-v1.json";
const DOCUMENTATION_PATH = "overwatch/governance/public-deployment-workflow-v2.md";
const OWNER_CONTRACT_PATH = "workers/infrastructure/github-actions-public-worker-deployment-v2.json";
const OWNER_COMMIT = "30c04aca19423f448b35218491d69ecc458367c7";
const OWNER_TREE = "a46088a5c223ba763db7a7eb99a8aec1a47b4c11";
const OWNER_PARENT = "07bf2eddc9707cb410ff6670efe9465ca68cd6b4";
const OWNER_IDENTITY = "Prometheus Infrastructure <infrastructure@prometheus.local>";
const PROVENANCE_REPAIR_COMMIT = "3743db6f883f44b6d1d1dd69bc1a9c79f6d8b6de";
const PROVENANCE_REPAIR_TREE = "7cc6670f1599f32a1d7283a353495866930784fd";
const PROVENANCE_REPAIR_PARENT = "ee80a44b8a28847d4a4acfc3fae8574697661edc";
const PROVENANCE_REPAIR_SUBJECT = "infrastructure: admit public deployment workflow v2 chain";
const AUTHORIZATION_BOUNDARY_REPAIR_COMMIT = "9c6440ba3c286b06a79435a8ec7bdf477cb4fd79";
const AUTHORIZATION_BOUNDARY_REPAIR_TREE = "9e09f7c9129b0eae1618cc0316da0f1a22d7c7c2";
const AUTHORIZATION_BOUNDARY_REPAIR_PARENT = "6db68f845e91c967e34f3b825e4cbc2372cef6d8";
const AUTHORIZATION_BOUNDARY_REPAIR_SUBJECT = "infrastructure: consume deployment authorization at spawn";
const WORKFLOW_V2_FIXTURE_REPAIR_COMMIT = "9e91ccbd71cd7298fcb74de5ca6a4ced20125113";
const WORKFLOW_V2_FIXTURE_REPAIR_TREE = "1691ed5ffb5bc139a66b60cbafd5b5c60ad12892";
const WORKFLOW_V2_FIXTURE_REPAIR_PARENT = "781a9472a4bd43a998826a3a130e547907f1f36a";
const WORKFLOW_V2_FIXTURE_REPAIR_SUBJECT = "infrastructure: derive Workflow v2 rollback fixture";
const WORKFLOW_V2_FIXTURE_HISTORICAL_SHA256 =
  "4181006b560cd2a192f08f94966d35ad076ee4da22e519217f86e90ae21cd35a";
const WORKFLOW_V2_FIXTURE_SUCCESSOR_SHA256 =
  "45a7b5c8120f7a7a3a885c3ac0d92aba29756b84f792bfed0d0c572ad56383e6";
const WORKFLOW_V2_FIXTURE_PATCH_SHA256 =
  "3270a7cf5bae0e59e9ed74b16b5a5612d46bee89c8b77dd6bcd440f58b6d6ba7";
const HISTORICAL_WORKFLOW_V2_FIXTURE_ROLLBACK_ARTIFACT_SHA256 =
  "88bee90a9ff1fafe064598c5db27b59ca78606dc8938fb0dcfeea96fa4eb5863";
const AUTHORIZATION_BOUNDARY_GOVERNANCE_COMMIT = "e2465d7a28c3222626cc8c60ed0690f8a425ee6f";
const AUTHORIZATION_BOUNDARY_GOVERNANCE_TREE = "25a215fda6751214d5c8a8b2d4474531aaf6536b";
const AUTHORIZATION_BOUNDARY_GOVERNANCE_PARENT = AUTHORIZATION_BOUNDARY_REPAIR_COMMIT;
const AUTHORIZATION_BOUNDARY_GOVERNANCE_SUBJECT = "overwatch: govern deployment authorization boundary repair";
const AUTHORIZATION_BOUNDARY_PROVENANCE_ADMISSION_COMMIT = "d2963aa66e304932729cf8154ab729f5d8b71113";
const AUTHORIZATION_BOUNDARY_PROVENANCE_ADMISSION_TREE = "b589078b7c9945eb2e12db2183788778e11e7c93";
const AUTHORIZATION_BOUNDARY_PROVENANCE_ADMISSION_PARENT = "4d7f5d140a7f856a18b99c1ab49a37d7555d3b5a";
const AUTHORIZATION_BOUNDARY_PROVENANCE_ADMISSION_SUBJECT = "infrastructure: admit deployment authorization boundary repair";
const OVERWATCH_IDENTITY = "Prometheus Overwatch <overwatch@prometheus.local>";
const DEPLOYMENT_ASSET_SHA256 = "5fd9e497e7fe814aab6194b4302528c6cff0e243e76a3dd843738f1882cd8c15";
const CURRENT_DEPLOYMENT_ASSET_SHA256 =
  "48d3b6b44b49366f3387dfc3e37d8e34d83abf5ea8bb0606b0070851802ff6a1";
const CURRENT_ROLLBACK_CONTRACT_SHA256 =
  "b7be296f51db1b8e8a305a068ebc1b0aa7652813de7b5378b96ac292af8af012";
const CURRENT_ROLLBACK_ARTIFACT_SHA256 =
  "012552cf90827482c7f1309f50e492304d9094e1c53f0c7ee6b44a5e0c4e9fbe";
const CURRENT_INFRASTRUCTURE_CONTRACT_SHA256 =
  "0582bc185ccf6f5e0825de25ce5fef8c65240fb0ee3b68c22bc5ba14865350c5";
const UNATTENDED_GOVERNANCE_ID = "cloudflare-unattended-deployment-access-governance-v1";
const ROUTE_IQ_3D_GOVERNANCE_ID = "route-iq-3d-visual-continuity-v1";
const PACKAGE_PATH = "package.json";
const HISTORICAL_PACKAGE_SHA256 = "a150ca1b1121c779415365551efdbff970e458915ba6491716ccbfdd0a111d0d";
const HISTORICAL_3D_PACKAGE_SHA256 = "f34246136a294d5a7180d76a452ff8c9c69bb7d1d35419c1115426b8ea4e0247";
const CURRENT_PACKAGE_SHA256 = "8bf7f51f8dbb6310031b6d26736dfe5209b2c74d42e5e56de475592f36bb7b51";
const WORKFLOW_V2_TAIL_ANCHOR = "5b5b59509206578336b9671582669b600d0c74d4";
const WORKFLOW_V2_TAIL_PARENT = "0d828948968b8cedf3b1961c5320c74c03a8e18c";
const WORKFLOW_V2_TAIL_PATHS = Object.freeze([
  HISTORICAL_READINESS_GOVERNANCE_PATH,
  GOVERNANCE_PATH,
  "scripts/verify-overwatch-cloudflare-founder-attended-create-receipt-v2.mjs",
  "scripts/verify-overwatch-cloudflare-founder-attended-get-only-recovery.mjs",
  "scripts/verify-overwatch-cloudflare-founder-attended-response-contract-repair.mjs",
  "scripts/verify-overwatch-cloudflare-founder-attended-service-token.mjs",
  "scripts/verify-overwatch-cloudflare-founder-attended-tty-compatibility.mjs",
  "scripts/verify-overwatch-cloudflare-unattended-access.mjs",
  "scripts/verify-overwatch-public-deployment-workflow-v2.mjs",
  "scripts/verify-overwatch-route-iq-3d-visual-continuity.mjs",
  "scripts/verify-overwatch-route-iq-public-deployment-integrity-repair-readiness.mjs",
  "scripts/verify-overwatch-route-iq-revised-3d-release-readiness-successor.mjs",
  "scripts/verify-overwatch-route-iq-yc-investor-website-focus.mjs",
  "tests/overwatch-public-deployment-workflow-v2.test.mjs",
  "tests/overwatch-route-iq-3d-visual-continuity.test.mjs",
  "tests/overwatch-route-iq-public-crm-founder-access-deployment-readiness.test.mjs"
]);
const AUTHORIZATION_BOUNDARY_REPAIR_PATHS = Object.freeze([
  "docs/github-actions-public-worker-deployment-v2.md",
  "scripts/lib/github-actions-public-worker-deployment.mjs",
  "scripts/lib/github-actions-public-worker-workflow-v2.mjs",
  "scripts/run-github-actions-public-worker-deployment-v2.mjs",
  "scripts/verify-github-actions-public-worker-deployment.mjs",
  "scripts/verify-github-actions-public-worker-workflow-v2.mjs",
  "tests/github-actions-public-worker-workflow-v2.test.mjs",
  "workers/infrastructure/github-actions-public-worker-deployment-v2.json"
]);
const WORKFLOW_V2_FIXTURE_REPAIR_PATHS = Object.freeze([
  "scripts/verify-route-iq-public-repository-integrity-repair.mjs",
  "tests/github-actions-public-worker-workflow-v2.test.mjs",
  "workers/infrastructure/route-iq-public-repository-integrity-repair-v1.json"
]);
const AUTHORIZATION_BOUNDARY_GOVERNANCE_PATHS = Object.freeze([
  GOVERNANCE_PATH,
  DOCUMENTATION_PATH,
  "scripts/verify-overwatch-public-deployment-workflow-v2.mjs",
  "tests/overwatch-public-deployment-workflow-v2.test.mjs"
]);
const AUTHORIZATION_BOUNDARY_PROVENANCE_ADMISSION_PATHS = Object.freeze([
  "docs/route-iq-public-repository-integrity-repair-v1.md",
  "scripts/verify-route-iq-public-repository-integrity-repair.mjs",
  "tests/public-repository-integrity-repair.test.mjs",
  "workers/infrastructure/route-iq-public-repository-integrity-repair-v1.json"
]);
const AUGUST1_WEBSITE_SUCCESSOR_FILES = Object.freeze([
  "deploy/prometheusrouteiq-website/assets/IntelligenceScene-CqK-yX9Z.js",
  "deploy/prometheusrouteiq-website/assets/IntelligenceScene-DUlz-ixy.js",
  "deploy/prometheusrouteiq-website/assets/landing-D-Z5MAu6.js",
  "deploy/prometheusrouteiq-website/assets/landing-Dfjv-fGW.js",
  "deploy/prometheusrouteiq-website/index.html"
]);
const AUGUST1_ROLLBACK_SUCCESSOR_FILES = Object.freeze([
  Object.freeze({
    path: "scripts/verify-github-actions-public-worker-workflow-v2.mjs",
    sha256: "31e6db547928fce5e159b0d8eebebd7d56ea66ad423d5f2311331dd5e246af4c"
  }),
  Object.freeze({
    path: "tests/github-actions-public-worker-deployment.test.mjs",
    sha256: "d880b9b2f326fe01d9f8d7164e76d7910f3cb2bf10f1f9badbcc82434539d326"
  }),
  Object.freeze({
    path: "tests/github-actions-public-worker-workflow-v2.test.mjs",
    sha256: "8c00799bdec6a8973bdfd467afe21f97ec8e7f7c270a80e7a1c40978e6c042fa"
  }),
  Object.freeze({
    path: "workers/infrastructure/route-iq-public-forward-rollback-v1.json",
    sha256: CURRENT_ROLLBACK_CONTRACT_SHA256
  }),
  Object.freeze({
    path: "workers/infrastructure/route-iq-public-repository-integrity-repair-v1.json",
    sha256: "5ecd49cb7f8306e2fed6fc18629f9ce490316cba6c1db4c9d0d6c39d09ca1d74"
  })
]);
const AUGUST1_PROVENANCE_ADMISSION_FILES = Object.freeze([
  Object.freeze({
    path: "scripts/verify-route-iq-public-repository-integrity-repair.mjs",
    sha256: "85e0a267ac8272903bb01556bbcc46503ae565e18f4841bc6bacdffa3a9226c3"
  }),
  Object.freeze({
    path: "tests/public-repository-integrity-repair.test.mjs",
    sha256: "37416524fabb451e3dd05b63b24324a9b35e013f091270af446099aa333ee377"
  }),
  Object.freeze({
    path: "workers/infrastructure/route-iq-public-repository-integrity-repair-v1.json",
    sha256: CURRENT_INFRASTRUCTURE_CONTRACT_SHA256
  })
]);
const AUGUST1_OVERWATCH_SUCCESSOR_FILES = Object.freeze([
  GOVERNANCE_PATH,
  DOCUMENTATION_PATH,
  HISTORICAL_READINESS_GOVERNANCE_PATH,
  "scripts/verify-overwatch-public-deployment-workflow-v2.mjs",
  "scripts/verify-overwatch-route-iq-3d-visual-continuity.mjs",
  "scripts/verify-overwatch-route-iq-public-deployment-integrity-repair-readiness.mjs",
  "scripts/verify-overwatch-route-iq-revised-3d-release-readiness-successor.mjs",
  "tests/overwatch-public-deployment-workflow-v2.test.mjs",
  "tests/overwatch-route-iq-3d-visual-continuity.test.mjs",
  "tests/overwatch-route-iq-public-crm-founder-access-deployment-readiness.test.mjs"
]);
const AUGUST1_WEBSITE_SUCCESSOR = Object.freeze({
  commit: "710ad8a1428dd7621c5363a16fffaae828cc3421",
  tree: "7e7f5cf2ec0fe0a2bfeae41c577279faab4c111b",
  parent: "dd048c8c00804073034a89a6a4dd48f616302a75",
  subject: "website: regenerate public deployment assets",
  owner: "Prometheus Website",
  author: "Prometheus Website <website@prometheus.local>",
  committer: "Prometheus Website <website@prometheus.local>",
  files: AUGUST1_WEBSITE_SUCCESSOR_FILES
});
const AUGUST1_ROLLBACK_SUCCESSOR = Object.freeze({
  commit: "18fbe9906064bad8a0ae8e6fc224e2af0bf1a594",
  tree: "8f58a2fb6e438d57556cb4f1860d4497782f61b2",
  parent: AUGUST1_WEBSITE_SUCCESSOR.commit,
  subject: "infrastructure: advance August 1 public rollback candidate",
  owner: "Prometheus Infrastructure",
  author: OWNER_IDENTITY,
  committer: OWNER_IDENTITY,
  files: AUGUST1_ROLLBACK_SUCCESSOR_FILES
});
const AUGUST1_PROVENANCE_ADMISSION = Object.freeze({
  commit: "a558df528f0c472d28afb1c3b3041a067ca86c4b",
  tree: "7e4e8b94d61f57bbd3dcf3c50ebe3e4efff54608",
  parent: AUGUST1_ROLLBACK_SUCCESSOR.commit,
  subject: "infrastructure: admit August 1 launch closeout successors",
  owner: "Prometheus Infrastructure",
  author: OWNER_IDENTITY,
  committer: OWNER_IDENTITY,
  files: AUGUST1_PROVENANCE_ADMISSION_FILES
});
const AUGUST1_OVERWATCH_SUCCESSOR = Object.freeze({
  classification: "DYNAMIC_EXACT_HEAD_SUCCESSOR",
  parent: AUGUST1_PROVENANCE_ADMISSION.commit,
  subject: "overwatch: admit August 1 public release successors",
  author: OVERWATCH_IDENTITY,
  committer: OVERWATCH_IDENTITY,
  files: AUGUST1_OVERWATCH_SUCCESSOR_FILES
});
const AUGUST1_LAUNCH_CLOSEOUT_SUCCESSOR = Object.freeze({
  classification: "CONTROLLING_CURRENT_OWNER_SUCCESSOR",
  historicalWorkflowEvidencePreserved: true,
  historicalHashesAreCurrent: false,
  websiteSuccessor: Object.freeze({
    ...AUGUST1_WEBSITE_SUCCESSOR,
    files: AUGUST1_WEBSITE_SUCCESSOR_FILES
  }),
  rollbackSuccessor: Object.freeze({
    ...AUGUST1_ROLLBACK_SUCCESSOR,
    files: AUGUST1_ROLLBACK_SUCCESSOR_FILES
  }),
  provenanceAdmission: Object.freeze({
    ...AUGUST1_PROVENANCE_ADMISSION,
    files: AUGUST1_PROVENANCE_ADMISSION_FILES
  }),
  overwatchSuccessor: AUGUST1_OVERWATCH_SUCCESSOR,
  currentReleaseIdentities: Object.freeze({
    deploymentAssetSha256: CURRENT_DEPLOYMENT_ASSET_SHA256,
    rollbackContractSha256: CURRENT_ROLLBACK_CONTRACT_SHA256,
    rollbackArtifactSha256: CURRENT_ROLLBACK_ARTIFACT_SHA256,
    infrastructureIntegrityContractSha256: CURRENT_INFRASTRUCTURE_CONTRACT_SHA256
  }),
  deploymentPerformed: false,
  productionMutationPerformed: false
});

const read = path => readFileSync(resolve(root, path), "utf8");
const readJson = path => JSON.parse(read(path));
const sha256 = value => createHash("sha256").update(value).digest("hex");
const readAtCommit = (commit, path) => execFileSync(
  "/usr/bin/git",
  ["show", `${commit}:${path}`],
  { cwd: root, encoding: null, stdio: ["ignore", "pipe", "ignore"] }
);
const git = args => execFileSync("/usr/bin/git", args, {
  cwd: root,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "ignore"]
}).trim();

function exactTrigger(workflow) {
  const start = workflow.indexOf("on:\n");
  const end = workflow.indexOf("permissions:\n", start);
  if (start < 0 || end <= start) return [];
  return [...workflow.slice(start, end).matchAll(/^  ([a-z_]+):$/gmu)].map(match => match[1]);
}

export function evaluatePublicDeploymentWorkflowV2Governance({
  governance,
  ownerContract,
  qualification,
  deployment,
  documentation
}) {
  const failures = [];
  const require = (condition, message) => {
    if (!condition) failures.push(message);
  };

  require(governance.governanceId === "public-deployment-workflow-v2-governance-v1", "Governance ID drifted.");
  require(governance.owningSubsystem === "Prometheus Overwatch", "Governance ownership drifted.");
  require(governance.batchId === "BATCH-20260720-010", "Batch ID drifted.");
  require(governance.dispatchAudit?.implementationOwner === "Prometheus Infrastructure", "Implementation owner drifted.");
  require(governance.dispatchAudit?.verificationOwner === "Prometheus Overwatch", "Verification owner drifted.");
  require(governance.dispatchAudit?.ownershipRespected === true, "Ownership is not accepted.");
  require(governance.implementationProvenance?.ownerCommit === OWNER_COMMIT, "Owner commit drifted.");
  require(governance.implementationProvenance?.ownerTree === OWNER_TREE, "Owner tree drifted.");
  require(governance.implementationProvenance?.parent === OWNER_PARENT, "Owner parent drifted.");
  require(governance.implementationProvenance?.author === OWNER_IDENTITY, "Owner author drifted.");
  require(governance.implementationProvenance?.committer === OWNER_IDENTITY, "Owner committer drifted.");
  require(governance.implementationProvenance?.legacyProvenanceGap === false, "Unexpected provenance gap.");
  require(governance.provenanceRepair?.ownerCommit === PROVENANCE_REPAIR_COMMIT, "Provenance repair commit drifted.");
  require(governance.provenanceRepair?.ownerTree === PROVENANCE_REPAIR_TREE, "Provenance repair tree drifted.");
  require(governance.provenanceRepair?.parent === PROVENANCE_REPAIR_PARENT, "Provenance repair parent drifted.");
  require(governance.provenanceRepair?.subject === PROVENANCE_REPAIR_SUBJECT, "Provenance repair subject drifted.");
  require(governance.provenanceRepair?.author === OWNER_IDENTITY, "Provenance repair author drifted.");
  require(governance.provenanceRepair?.committer === OWNER_IDENTITY, "Provenance repair committer drifted.");
  require(governance.authorizationBoundaryRepair?.ownerCommit === AUTHORIZATION_BOUNDARY_REPAIR_COMMIT, "Authorization-boundary repair commit drifted.");
  require(governance.authorizationBoundaryRepair?.ownerTree === AUTHORIZATION_BOUNDARY_REPAIR_TREE, "Authorization-boundary repair tree drifted.");
  require(governance.authorizationBoundaryRepair?.parent === AUTHORIZATION_BOUNDARY_REPAIR_PARENT, "Authorization-boundary repair parent drifted.");
  require(governance.authorizationBoundaryRepair?.subject === AUTHORIZATION_BOUNDARY_REPAIR_SUBJECT, "Authorization-boundary repair subject drifted.");
  require(governance.authorizationBoundaryRepair?.author === OWNER_IDENTITY, "Authorization-boundary repair author drifted.");
  require(governance.authorizationBoundaryRepair?.committer === OWNER_IDENTITY, "Authorization-boundary repair committer drifted.");
  require(governance.workflowV2FixtureRepairSuccessor?.ownerCommit === WORKFLOW_V2_FIXTURE_REPAIR_COMMIT, "Workflow v2 fixture repair commit drifted.");
  require(governance.workflowV2FixtureRepairSuccessor?.ownerTree === WORKFLOW_V2_FIXTURE_REPAIR_TREE, "Workflow v2 fixture repair tree drifted.");
  require(governance.workflowV2FixtureRepairSuccessor?.parent === WORKFLOW_V2_FIXTURE_REPAIR_PARENT, "Workflow v2 fixture repair parent drifted.");
  require(governance.workflowV2FixtureRepairSuccessor?.subject === WORKFLOW_V2_FIXTURE_REPAIR_SUBJECT, "Workflow v2 fixture repair subject drifted.");
  require(governance.workflowV2FixtureRepairSuccessor?.author === OWNER_IDENTITY, "Workflow v2 fixture repair author drifted.");
  require(governance.workflowV2FixtureRepairSuccessor?.committer === OWNER_IDENTITY, "Workflow v2 fixture repair committer drifted.");
  require(governance.workflowV2FixtureRepairSuccessor?.classification === "INFRASTRUCTURE_TEST_FIXTURE_AND_OWNER_PROVENANCE_ONLY", "Workflow v2 fixture repair classification drifted.");
  require(governance.workflowV2FixtureRepairSuccessor?.historicalTestSha256 === WORKFLOW_V2_FIXTURE_HISTORICAL_SHA256, "Workflow v2 historical fixture hash drifted.");
  require(governance.workflowV2FixtureRepairSuccessor?.successorTestSha256 === WORKFLOW_V2_FIXTURE_SUCCESSOR_SHA256, "Workflow v2 successor fixture hash drifted.");
  require(governance.workflowV2FixtureRepairSuccessor?.patchSha256 === WORKFLOW_V2_FIXTURE_PATCH_SHA256, "Workflow v2 fixture patch hash drifted.");
  require(governance.workflowV2FixtureRepairSuccessor?.rollbackArtifactSha256 === HISTORICAL_WORKFLOW_V2_FIXTURE_ROLLBACK_ARTIFACT_SHA256, "Workflow v2 fixture rollback identity drifted.");
  require(governance.authorizationBoundaryGovernance?.ownerCommit === AUTHORIZATION_BOUNDARY_GOVERNANCE_COMMIT, "Authorization-boundary governance commit drifted.");
  require(governance.authorizationBoundaryGovernance?.ownerTree === AUTHORIZATION_BOUNDARY_GOVERNANCE_TREE, "Authorization-boundary governance tree drifted.");
  require(governance.authorizationBoundaryGovernance?.parent === AUTHORIZATION_BOUNDARY_GOVERNANCE_PARENT, "Authorization-boundary governance parent drifted.");
  require(governance.authorizationBoundaryGovernance?.subject === AUTHORIZATION_BOUNDARY_GOVERNANCE_SUBJECT, "Authorization-boundary governance subject drifted.");
  require(governance.authorizationBoundaryGovernance?.author === OVERWATCH_IDENTITY, "Authorization-boundary governance author drifted.");
  require(governance.authorizationBoundaryGovernance?.committer === OVERWATCH_IDENTITY, "Authorization-boundary governance committer drifted.");
  require(governance.authorizationBoundaryGovernance?.classification === "OVERWATCH_GOVERNANCE_VERIFICATION_AND_DOCUMENTATION_ONLY", "Authorization-boundary governance classification drifted.");
  require(governance.authorizationBoundaryProvenanceAdmission?.ownerCommit === AUTHORIZATION_BOUNDARY_PROVENANCE_ADMISSION_COMMIT, "Authorization-boundary provenance-admission commit drifted.");
  require(governance.authorizationBoundaryProvenanceAdmission?.ownerTree === AUTHORIZATION_BOUNDARY_PROVENANCE_ADMISSION_TREE, "Authorization-boundary provenance-admission tree drifted.");
  require(governance.authorizationBoundaryProvenanceAdmission?.parent === AUTHORIZATION_BOUNDARY_PROVENANCE_ADMISSION_PARENT, "Authorization-boundary provenance-admission parent drifted.");
  require(governance.authorizationBoundaryProvenanceAdmission?.subject === AUTHORIZATION_BOUNDARY_PROVENANCE_ADMISSION_SUBJECT, "Authorization-boundary provenance-admission subject drifted.");
  require(governance.authorizationBoundaryProvenanceAdmission?.author === OWNER_IDENTITY, "Authorization-boundary provenance-admission author drifted.");
  require(governance.authorizationBoundaryProvenanceAdmission?.committer === OWNER_IDENTITY, "Authorization-boundary provenance-admission committer drifted.");
  require(governance.authorizationBoundaryProvenanceAdmission?.classification === "INFRASTRUCTURE_OWNER_VERIFIER_PROVENANCE_ADMISSION_ONLY", "Authorization-boundary provenance-admission classification drifted.");
  require(
    isDeepStrictEqual(governance.august1LaunchCloseoutSuccessor, AUGUST1_LAUNCH_CLOSEOUT_SUCCESSOR),
    "August 1 launch closeout successor drifted."
  );
  require(governance.architecture?.qualificationContactsCloudflare === false, "Qualification can contact Cloudflare.");
  require(governance.architecture?.qualificationAccessesProtectedSecrets === false, "Qualification can access secrets.");
  require(governance.architecture?.qualificationBuildsArtifactExactlyOnce === true, "Qualification build count drifted.");
  require(governance.architecture?.deploymentConsumesQualifiedArtifact === true, "Deployment does not consume qualification.");
  require(governance.architecture?.deploymentRebuildAllowed === false, "Deployment rebuild is allowed.");
  require(governance.architecture?.targetWorker === "prometheusrouteiq-website", "Public target drifted.");
  require(governance.architecture?.privateWorkerMutationAllowed === false, "Private Worker mutation is allowed.");
  require(governance.architecture?.authorizationConsumedAt === "after_forward_wrangler_process_spawn_confirmed", "Authorization boundary drifted.");
  require(governance.architecture?.preBoundaryFailureConsumesAuthorization === false, "Pre-boundary failure consumes authorization.");
  require(governance.architecture?.forwardDeploymentAttempts === 1, "Deployment attempt ceiling drifted.");
  require(governance.architecture?.automaticRetryAllowed === false, "Automatic deployment retry is allowed.");
  require(governance.candidateStability?.sourceChangeInvalidatesCandidate === true, "Source change does not invalidate candidate.");
  require(governance.candidateStability?.preBoundaryExternalFailureInvalidatesUnchangedCandidate === false, "External pre-boundary failure invalidates candidate.");
  require(governance.candidateStability?.materiallyChangedCandidateMayReuseAuthorization === false, "Changed candidate can reuse authorization.");
  require(governance.runtimeBoundaries?.deploymentPerformedByBatch === false, "Batch reports a deployment.");
  require(governance.runtimeBoundaries?.cloudflareContactedByBatch === false, "Batch reports Cloudflare contact.");
  require(governance.runtimeBoundaries?.productionDataMutatedByBatch === false, "Batch reports production mutation.");
  require(governance.runtimeBoundaries?.collection === "OFF", "Collection is not OFF.");
  require(governance.runtimeBoundaries?.activeCohortCount === 0, "Active cohorts are not zero.");
  require(governance.runtimeBoundaries?.recommendationInfluence === "OFF", "Recommendation influence is not OFF.");
  require(governance.runtimeBoundaries?.anthonyMapped === false, "Anthony is mapped.");
  require(governance.productContinuity?.deploymentAssetSha256 === DEPLOYMENT_ASSET_SHA256, "Deployment asset identity drifted.");
  require(governance.productContinuity?.approvedWebsiteSourceChanged === false, "Website source changed.");
  require(governance.productContinuity?.crmBehaviorChanged === false, "CRM behavior changed.");
  require(JSON.stringify(governance.protectedPredecessorSuccessors) === JSON.stringify([
    {
      predecessorGovernanceId: UNATTENDED_GOVERNANCE_ID,
      path: PACKAGE_PATH,
      historicalSha256: HISTORICAL_PACKAGE_SHA256,
      successorSha256: CURRENT_PACKAGE_SHA256,
      owner: "Prometheus Overwatch",
      ownerCommit: "ee80a44b8a28847d4a4acfc3fae8574697661edc",
      classification: "OVERWATCH_RELEASE_GATE_REGISTRATION_ONLY"
    },
    {
      predecessorGovernanceId: ROUTE_IQ_3D_GOVERNANCE_ID,
      path: PACKAGE_PATH,
      historicalSha256: HISTORICAL_3D_PACKAGE_SHA256,
      successorSha256: CURRENT_PACKAGE_SHA256,
      owner: "Prometheus Overwatch",
      ownerCommit: "ee80a44b8a28847d4a4acfc3fae8574697661edc",
      classification: "OVERWATCH_RELEASE_GATE_REGISTRATION_ONLY"
    }
  ]), "Protected predecessor successor mapping drifted.");

  require(ownerContract.owner === "Prometheus Infrastructure", "Infrastructure contract ownership drifted.");
  require(ownerContract.status === "SOURCE_IMPLEMENTED_NOT_QUALIFIED_NOT_DEPLOYED", "Infrastructure status drifted.");
  require(ownerContract.qualification?.cloudflareRequestAllowed === false, "Owner qualification can contact Cloudflare.");
  require(ownerContract.qualification?.secretAccessAllowed === false, "Owner qualification can access secrets.");
  require(ownerContract.qualification?.publicArtifactBuilds === 1, "Owner artifact build count drifted.");
  require(ownerContract.deployment?.rebuildAllowed === false, "Owner deployment rebuild is allowed.");
  require(ownerContract.deployment?.forwardDeploymentAttempts === 1, "Owner deployment attempt ceiling drifted.");
  require(ownerContract.authorization?.consumedAt === "forward_wrangler_process_spawn_confirmed", "Owner authorization boundary drifted.");
  require(ownerContract.authorization?.preAuthorizationCloudflareReadOnlyRequestsAllowed === true, "Owner prerequisite reads are not governed.");
  require(ownerContract.authorization?.preAuthorizationCloudflareMutationRequestsAllowed === false, "Owner pre-authorization mutation is allowed.");
  require(ownerContract.authorization?.preBoundaryFailureRecordsDeploymentBegan === false, "Owner pre-boundary semantics drifted.");
  require(ownerContract.authorization?.changedCandidateRequiresNewQualificationAndAuthorization === true, "Owner candidate invalidation drifted.");
  require(ownerContract.runtimeBoundaries?.productionMutationPerformed === false, "Owner contract reports production mutation.");

  require(JSON.stringify(exactTrigger(qualification)) === JSON.stringify(["workflow_dispatch"]), "Qualification trigger drifted.");
  require(JSON.stringify(exactTrigger(deployment)) === JSON.stringify(["workflow_dispatch"]), "Deployment trigger drifted.");
  require(!/secrets\.[A-Z0-9_]+/u.test(qualification), "Qualification references a protected secret.");
  require(!/wrangler(?:\.js)?\s+deploy|run-github-actions-public-worker-deployment-v2/u.test(qualification), "Qualification contains a deployment route.");
  require((qualification.match(/run: npm run build/gmu) || []).length === 1, "Qualification source build count drifted.");
  require((qualification.match(/run: node scripts\/run-github-actions-public-worker-qualification\.mjs build/gmu) || []).length === 1, "Qualification artifact build count drifted.");
  require(!/npm run build|npm test|vite build/u.test(deployment), "Deployment can rebuild or rerun qualification.");
  require((deployment.match(/run: node scripts\/run-github-actions-public-worker-deployment-v2\.mjs deploy/gmu) || []).length === 1, "Deployment command count drifted.");
  require(!/--name\s+prometheus-iq|wrangler(?:\.js)?\s+deploy/u.test(deployment), "Deployment exposes an alternate target.");
  require(documentation.includes("does not request or grant deployment authorization"), "No-deployment boundary is undocumented.");

  return Object.freeze({ ok: failures.length === 0, failures: Object.freeze(failures) });
}

export function hasGovernedPublicDeploymentWorkflowV2PackageSuccessor({
  governance = readJson(GOVERNANCE_PATH),
  predecessorGovernanceId,
  historicalSha256,
  successorSha256
}) {
  const matches = governance.protectedPredecessorSuccessors?.filter(item => (
    item.predecessorGovernanceId === predecessorGovernanceId
    && item.path === PACKAGE_PATH
    && item.historicalSha256 === historicalSha256
    && item.successorSha256 === successorSha256
    && item.owner === "Prometheus Overwatch"
    && item.ownerCommit === "ee80a44b8a28847d4a4acfc3fae8574697661edc"
    && item.classification === "OVERWATCH_RELEASE_GATE_REGISTRATION_ONLY"
  )) ?? [];
  return matches.length === 1;
}

export function isGovernedPublicDeploymentWorkflowV2VerifierCommit({
  path,
  author,
  committer,
  subject,
  files
}) {
  if (!WORKFLOW_V2_TAIL_PATHS.includes(path) || !Array.isArray(files)) return false;
  if (!files.includes(path)) return true;
  return author === "overwatch@prometheus.local"
    && committer === "overwatch@prometheus.local"
    && subject.startsWith("overwatch:")
    && files.length > 0
    && files.every(file => WORKFLOW_V2_TAIL_PATHS.includes(file));
}

export function hasGovernedPublicDeploymentWorkflowV2VerifierSuccessor({
  path,
  historicalSha256,
  successorSha256
}) {
  try {
    if (!WORKFLOW_V2_TAIL_PATHS.includes(path)
      || !/^[0-9a-f]{64}$/u.test(historicalSha256)
      || !/^[0-9a-f]{64}$/u.test(successorSha256)) return false;

    const historicalGovernance = readJson(HISTORICAL_READINESS_GOVERNANCE_PATH);
    const governedTail = historicalGovernance.workflowV2ReadinessClosure?.governedOverwatchTail;
    if (governedTail?.linearHistoryRequired !== true
      || governedTail?.mergesAllowed !== false
      || governedTail?.authorAndCommitter !== "overwatch@prometheus.local"
      || governedTail?.subjectPrefix !== "overwatch:"
      || governedTail?.ownershipAppliesTo !== "COMMITS_MODIFYING_GOVERNED_PATH"
      || governedTail?.unrelatedSubsystemCommitsAllowed !== true
      || governedTail?.subsystemImplementationAllowed !== false
      || JSON.stringify(governedTail?.allowedPaths) !== JSON.stringify(WORKFLOW_V2_TAIL_PATHS)) {
      return false;
    }

    const historical = execFileSync("/usr/bin/git", [
      "show", `${WORKFLOW_V2_TAIL_PARENT}:${path}`
    ], { cwd: root, encoding: null, stdio: ["ignore", "pipe", "ignore"] });
    const committedCurrent = execFileSync("/usr/bin/git", ["show", `HEAD:${path}`], {
      cwd: root,
      encoding: null,
      stdio: ["ignore", "pipe", "ignore"]
    });
    if (sha256(historical) !== historicalSha256
      || sha256(committedCurrent) !== successorSha256
      || sha256(readFileSync(resolve(root, path))) !== successorSha256) return false;

    const commits = git([
      "rev-list", "--reverse", "--ancestry-path", `${WORKFLOW_V2_TAIL_PARENT}..HEAD`
    ]).split("\n").filter(Boolean);
    if (commits[0] !== WORKFLOW_V2_TAIL_ANCHOR) return false;

    let previous = WORKFLOW_V2_TAIL_PARENT;
    let pathChanged = false;
    let authorizationBoundaryRepairSeen = false;
    let authorizationBoundaryGovernanceSeen = false;
    let authorizationBoundaryProvenanceAdmissionSeen = false;
    let august1OwnerSuccessorsSeen = 0;
    let august1OverwatchSuccessorSeen = false;
    const head = git(["rev-parse", "HEAD"]);
    for (const commit of commits) {
      const [author, committer, parents, subject, tree] = git([
        "show", "-s", "--format=%ae%n%ce%n%P%n%s%n%T", commit
      ]).split("\n");
      const files = git(["diff-tree", "--no-commit-id", "--name-only", "-r", commit])
        .split("\n").filter(Boolean);

      if (commit === AUTHORIZATION_BOUNDARY_REPAIR_COMMIT) {
        if (authorizationBoundaryRepairSeen
          || previous !== AUTHORIZATION_BOUNDARY_REPAIR_PARENT
          || author !== "infrastructure@prometheus.local"
          || committer !== "infrastructure@prometheus.local"
          || parents !== previous
          || subject !== AUTHORIZATION_BOUNDARY_REPAIR_SUBJECT
          || tree !== AUTHORIZATION_BOUNDARY_REPAIR_TREE
          || JSON.stringify([...files].sort()) !== JSON.stringify([...AUTHORIZATION_BOUNDARY_REPAIR_PATHS].sort())) {
          return false;
        }
        authorizationBoundaryRepairSeen = true;
        previous = commit;
        continue;
      }

      if (commit === AUTHORIZATION_BOUNDARY_GOVERNANCE_COMMIT) {
        if (!authorizationBoundaryRepairSeen
          || authorizationBoundaryGovernanceSeen
          || previous !== AUTHORIZATION_BOUNDARY_GOVERNANCE_PARENT
          || author !== "overwatch@prometheus.local"
          || committer !== "overwatch@prometheus.local"
          || parents !== previous
          || subject !== AUTHORIZATION_BOUNDARY_GOVERNANCE_SUBJECT
          || tree !== AUTHORIZATION_BOUNDARY_GOVERNANCE_TREE
          || JSON.stringify([...files].sort()) !== JSON.stringify([...AUTHORIZATION_BOUNDARY_GOVERNANCE_PATHS].sort())) {
          return false;
        }
        authorizationBoundaryGovernanceSeen = true;
        if (files.includes(path)) pathChanged = true;
        previous = commit;
        continue;
      }

      if (commit === AUTHORIZATION_BOUNDARY_PROVENANCE_ADMISSION_COMMIT) {
        if (!authorizationBoundaryRepairSeen
          || !authorizationBoundaryGovernanceSeen
          || authorizationBoundaryProvenanceAdmissionSeen
          || previous !== AUTHORIZATION_BOUNDARY_PROVENANCE_ADMISSION_PARENT
          || author !== "infrastructure@prometheus.local"
          || committer !== "infrastructure@prometheus.local"
          || parents !== previous
          || subject !== AUTHORIZATION_BOUNDARY_PROVENANCE_ADMISSION_SUBJECT
          || tree !== AUTHORIZATION_BOUNDARY_PROVENANCE_ADMISSION_TREE
          || JSON.stringify([...files].sort()) !== JSON.stringify([...AUTHORIZATION_BOUNDARY_PROVENANCE_ADMISSION_PATHS].sort())) {
          return false;
        }
        authorizationBoundaryProvenanceAdmissionSeen = true;
        previous = commit;
        continue;
      }

      const expectedAugust1Owner = [
        AUGUST1_WEBSITE_SUCCESSOR,
        AUGUST1_ROLLBACK_SUCCESSOR,
        AUGUST1_PROVENANCE_ADMISSION
      ][august1OwnerSuccessorsSeen];
      if (expectedAugust1Owner && commit === expectedAugust1Owner.commit) {
        const expectedFiles = expectedAugust1Owner.files
          .map(item => typeof item === "string" ? item : item.path);
        const expectedAuthor = expectedAugust1Owner.author.match(/<([^>]+)>$/u)?.[1];
        const expectedCommitter = expectedAugust1Owner.committer.match(/<([^>]+)>$/u)?.[1];
        if (previous !== expectedAugust1Owner.parent
          || parents !== previous
          || author !== expectedAuthor
          || committer !== expectedCommitter
          || subject !== expectedAugust1Owner.subject
          || tree !== expectedAugust1Owner.tree
          || JSON.stringify([...files].sort()) !== JSON.stringify([...expectedFiles].sort())) {
          return false;
        }
        if (files.includes(path)) pathChanged = true;
        august1OwnerSuccessorsSeen += 1;
        previous = commit;
        continue;
      }

      if (previous === AUGUST1_OVERWATCH_SUCCESSOR.parent) {
        if (commit !== head
          || parents !== AUGUST1_OVERWATCH_SUCCESSOR.parent
          || author !== "overwatch@prometheus.local"
          || committer !== "overwatch@prometheus.local"
          || subject !== AUGUST1_OVERWATCH_SUCCESSOR.subject
          || JSON.stringify([...files].sort())
            !== JSON.stringify([...AUGUST1_OVERWATCH_SUCCESSOR.files].sort())) {
          return false;
        }
        if (files.includes(path)) pathChanged = true;
        august1OverwatchSuccessorSeen = true;
        previous = commit;
        continue;
      }

      if (parents !== previous) return false;
      if (!isGovernedPublicDeploymentWorkflowV2VerifierCommit({
        path,
        author,
        committer,
        subject,
        files
      })) return false;
      if (files.includes(path)) {
        pathChanged = true;
      }
      previous = commit;
    }
    return previous === head
      && pathChanged
      && authorizationBoundaryRepairSeen
      && authorizationBoundaryGovernanceSeen
      && authorizationBoundaryProvenanceAdmissionSeen
      && august1OwnerSuccessorsSeen === 3
      && august1OverwatchSuccessorSeen;
  } catch {
    return false;
  }
}

function commitIdentity(commit) {
  const fields = git(["show", "-s", "--format=%an <%ae>%n%cn <%ce>%n%P%n%T", commit]).split("\n");
  return { author: fields[0], committer: fields[1], parents: fields[2].split(" "), tree: fields[3] };
}

function commitPaths(commit) {
  return git(["diff-tree", "--no-commit-id", "--name-only", "-r", commit])
    .split("\n")
    .filter(Boolean);
}

function verifyExactCommit(expected) {
  const identity = commitIdentity(expected.commit);
  assert.equal(identity.author, expected.author);
  assert.equal(identity.committer, expected.committer);
  assert.deepEqual(identity.parents, [expected.parent]);
  assert.equal(identity.tree, expected.tree);
  assert.equal(git(["show", "-s", "--format=%s", expected.commit]), expected.subject);
  const expectedPaths = expected.files.map(item => typeof item === "string" ? item : item.path);
  assert.deepEqual(commitPaths(expected.commit).sort(), [...expectedPaths].sort());
  for (const evidence of expected.files.filter(item => typeof item !== "string")) {
    assert.equal(
      sha256(readAtCommit(expected.commit, evidence.path)),
      evidence.sha256,
      `August 1 owner evidence drifted: ${evidence.path}`
    );
  }
}

function verifyAugust1LaunchCloseoutSuccessor(governance) {
  assert.deepEqual(governance.august1LaunchCloseoutSuccessor, AUGUST1_LAUNCH_CLOSEOUT_SUCCESSOR);
  for (const expected of [
    AUGUST1_WEBSITE_SUCCESSOR,
    AUGUST1_ROLLBACK_SUCCESSOR,
    AUGUST1_PROVENANCE_ADMISSION
  ]) verifyExactCommit(expected);

  const head = git(["rev-parse", "HEAD"]);
  const identity = commitIdentity(head);
  assert.deepEqual(identity.parents, [AUGUST1_OVERWATCH_SUCCESSOR.parent]);
  assert.equal(identity.author, AUGUST1_OVERWATCH_SUCCESSOR.author);
  assert.equal(identity.committer, AUGUST1_OVERWATCH_SUCCESSOR.committer);
  assert.equal(
    git(["show", "-s", "--format=%s", head]),
    AUGUST1_OVERWATCH_SUCCESSOR.subject
  );
  assert.deepEqual(commitPaths(head).sort(), [...AUGUST1_OVERWATCH_SUCCESSOR.files].sort());

  const currentEvidence = [
    ...AUGUST1_ROLLBACK_SUCCESSOR_FILES.slice(0, 4),
    ...AUGUST1_PROVENANCE_ADMISSION_FILES
  ];
  for (const evidence of currentEvidence) {
    assert.equal(
      sha256(read(evidence.path)),
      evidence.sha256,
      `Current August 1 owner evidence drifted: ${evidence.path}`
    );
  }
}

export function verifyOverwatchPublicDeploymentWorkflowV2() {
  const governance = readJson(GOVERNANCE_PATH);
  const ownerContract = readJson(OWNER_CONTRACT_PATH);
  const qualification = read(".github/workflows/qualify-prometheus-public-worker.yml");
  const deployment = read(".github/workflows/deploy-prometheus-public-worker.yml");
  const documentation = read(DOCUMENTATION_PATH);
  const result = evaluatePublicDeploymentWorkflowV2Governance({
    governance,
    ownerContract,
    qualification,
    deployment,
    documentation
  });
  assert.equal(result.ok, true, result.failures.join("\n"));
  verifyAugust1LaunchCloseoutSuccessor(governance);

  const identity = commitIdentity(OWNER_COMMIT);
  assert.equal(identity.author, OWNER_IDENTITY);
  assert.equal(identity.committer, OWNER_IDENTITY);
  assert.deepEqual(identity.parents, [OWNER_PARENT]);
  assert.equal(identity.tree, OWNER_TREE);
  assert.doesNotThrow(() => git(["merge-base", "--is-ancestor", OWNER_COMMIT, "HEAD"]));

  const committedPaths = git(["diff-tree", "--no-commit-id", "--name-only", "-r", OWNER_COMMIT])
    .split("\n").filter(Boolean).sort();
  const governedPaths = governance.implementationProvenance.files.map(item => item.path).sort();
  assert.deepEqual(committedPaths, governedPaths);
  for (const evidence of governance.implementationProvenance.files) {
    const committedEvidence = execFileSync("/usr/bin/git", [
      "show", `${OWNER_COMMIT}:${evidence.path}`
    ], { cwd: root, encoding: null, stdio: ["ignore", "pipe", "ignore"] });
    assert.equal(sha256(committedEvidence), evidence.sha256, `Historical owner evidence drifted: ${evidence.path}`);
  }
  assert.equal(committedPaths.some(path => /^(?:src\/|crm\/|data\/|intelligence\/|index\.html|deploy\/prometheusrouteiq-website\/)/u.test(path)), false);

  const boundaryRepairIdentity = commitIdentity(AUTHORIZATION_BOUNDARY_REPAIR_COMMIT);
  assert.equal(boundaryRepairIdentity.author, OWNER_IDENTITY);
  assert.equal(boundaryRepairIdentity.committer, OWNER_IDENTITY);
  assert.deepEqual(boundaryRepairIdentity.parents, [AUTHORIZATION_BOUNDARY_REPAIR_PARENT]);
  assert.equal(boundaryRepairIdentity.tree, AUTHORIZATION_BOUNDARY_REPAIR_TREE);
  assert.equal(
    git(["show", "-s", "--format=%s", AUTHORIZATION_BOUNDARY_REPAIR_COMMIT]),
    AUTHORIZATION_BOUNDARY_REPAIR_SUBJECT
  );
  assert.doesNotThrow(() => git(["merge-base", "--is-ancestor", AUTHORIZATION_BOUNDARY_REPAIR_COMMIT, "HEAD"]));

  const boundaryRepairPaths = git([
    "diff-tree", "--no-commit-id", "--name-only", "-r", AUTHORIZATION_BOUNDARY_REPAIR_COMMIT
  ]).split("\n").filter(Boolean).sort();
  const governedBoundaryRepairPaths = governance.authorizationBoundaryRepair.files
    .map(item => item.path).sort();
  assert.deepEqual(boundaryRepairPaths, governedBoundaryRepairPaths);
  assert.deepEqual(boundaryRepairPaths, [...AUTHORIZATION_BOUNDARY_REPAIR_PATHS].sort());
  for (const evidence of governance.authorizationBoundaryRepair.files) {
    assert.equal(
      sha256(readAtCommit(AUTHORIZATION_BOUNDARY_REPAIR_COMMIT, evidence.path)),
      evidence.sha256,
      `Historical authorization-boundary repair evidence drifted: ${evidence.path}`
    );
  }
  assert.equal(boundaryRepairPaths.every(path => /^(?:docs\/|scripts\/|tests\/|workers\/infrastructure\/)/u.test(path)), true);

  const fixtureRepairIdentity = commitIdentity(WORKFLOW_V2_FIXTURE_REPAIR_COMMIT);
  assert.equal(fixtureRepairIdentity.author, OWNER_IDENTITY);
  assert.equal(fixtureRepairIdentity.committer, OWNER_IDENTITY);
  assert.deepEqual(fixtureRepairIdentity.parents, [WORKFLOW_V2_FIXTURE_REPAIR_PARENT]);
  assert.equal(fixtureRepairIdentity.tree, WORKFLOW_V2_FIXTURE_REPAIR_TREE);
  assert.equal(
    git(["show", "-s", "--format=%s", WORKFLOW_V2_FIXTURE_REPAIR_COMMIT]),
    WORKFLOW_V2_FIXTURE_REPAIR_SUBJECT
  );
  assert.doesNotThrow(() => git(["merge-base", "--is-ancestor", WORKFLOW_V2_FIXTURE_REPAIR_COMMIT, "HEAD"]));
  const fixtureRepairPaths = git([
    "diff-tree", "--no-commit-id", "--name-only", "-r", WORKFLOW_V2_FIXTURE_REPAIR_COMMIT
  ]).split("\n").filter(Boolean).sort();
  assert.deepEqual(fixtureRepairPaths, [...WORKFLOW_V2_FIXTURE_REPAIR_PATHS].sort());
  assert.deepEqual(
    governance.workflowV2FixtureRepairSuccessor.files.map(item => item.path).sort(),
    [...WORKFLOW_V2_FIXTURE_REPAIR_PATHS].sort()
  );
  for (const evidence of governance.workflowV2FixtureRepairSuccessor.files) {
    const committedEvidence = execFileSync("/usr/bin/git", [
      "show", `${WORKFLOW_V2_FIXTURE_REPAIR_COMMIT}:${evidence.path}`
    ], { cwd: root, encoding: null, stdio: ["ignore", "pipe", "ignore"] });
    assert.equal(sha256(committedEvidence), evidence.sha256, `Workflow v2 fixture repair evidence drifted: ${evidence.path}`);
  }

  const boundaryGovernanceIdentity = commitIdentity(AUTHORIZATION_BOUNDARY_GOVERNANCE_COMMIT);
  assert.equal(boundaryGovernanceIdentity.author, OVERWATCH_IDENTITY);
  assert.equal(boundaryGovernanceIdentity.committer, OVERWATCH_IDENTITY);
  assert.deepEqual(boundaryGovernanceIdentity.parents, [AUTHORIZATION_BOUNDARY_GOVERNANCE_PARENT]);
  assert.equal(boundaryGovernanceIdentity.tree, AUTHORIZATION_BOUNDARY_GOVERNANCE_TREE);
  assert.equal(
    git(["show", "-s", "--format=%s", AUTHORIZATION_BOUNDARY_GOVERNANCE_COMMIT]),
    AUTHORIZATION_BOUNDARY_GOVERNANCE_SUBJECT
  );
  assert.doesNotThrow(() => git(["merge-base", "--is-ancestor", AUTHORIZATION_BOUNDARY_GOVERNANCE_COMMIT, "HEAD"]));

  const boundaryGovernancePaths = git([
    "diff-tree", "--no-commit-id", "--name-only", "-r", AUTHORIZATION_BOUNDARY_GOVERNANCE_COMMIT
  ]).split("\n").filter(Boolean).sort();
  const governedBoundaryGovernancePaths = governance.authorizationBoundaryGovernance.files
    .map(item => item.path).sort();
  assert.deepEqual(boundaryGovernancePaths, governedBoundaryGovernancePaths);
  assert.deepEqual(boundaryGovernancePaths, [...AUTHORIZATION_BOUNDARY_GOVERNANCE_PATHS].sort());
  for (const evidence of governance.authorizationBoundaryGovernance.files) {
    const committedEvidence = execFileSync("/usr/bin/git", [
      "show", `${AUTHORIZATION_BOUNDARY_GOVERNANCE_COMMIT}:${evidence.path}`
    ], { cwd: root, encoding: null, stdio: ["ignore", "pipe", "ignore"] });
    assert.equal(sha256(committedEvidence), evidence.sha256, `Authorization-boundary governance evidence drifted: ${evidence.path}`);
  }

  const boundaryProvenanceAdmissionIdentity = commitIdentity(AUTHORIZATION_BOUNDARY_PROVENANCE_ADMISSION_COMMIT);
  assert.equal(boundaryProvenanceAdmissionIdentity.author, OWNER_IDENTITY);
  assert.equal(boundaryProvenanceAdmissionIdentity.committer, OWNER_IDENTITY);
  assert.deepEqual(boundaryProvenanceAdmissionIdentity.parents, [AUTHORIZATION_BOUNDARY_PROVENANCE_ADMISSION_PARENT]);
  assert.equal(boundaryProvenanceAdmissionIdentity.tree, AUTHORIZATION_BOUNDARY_PROVENANCE_ADMISSION_TREE);
  assert.equal(
    git(["show", "-s", "--format=%s", AUTHORIZATION_BOUNDARY_PROVENANCE_ADMISSION_COMMIT]),
    AUTHORIZATION_BOUNDARY_PROVENANCE_ADMISSION_SUBJECT
  );
  assert.doesNotThrow(() => git(["merge-base", "--is-ancestor", AUTHORIZATION_BOUNDARY_PROVENANCE_ADMISSION_COMMIT, "HEAD"]));

  const boundaryProvenanceAdmissionPaths = git([
    "diff-tree", "--no-commit-id", "--name-only", "-r", AUTHORIZATION_BOUNDARY_PROVENANCE_ADMISSION_COMMIT
  ]).split("\n").filter(Boolean).sort();
  const governedBoundaryProvenanceAdmissionPaths = governance.authorizationBoundaryProvenanceAdmission.files
    .map(item => item.path).sort();
  assert.deepEqual(boundaryProvenanceAdmissionPaths, governedBoundaryProvenanceAdmissionPaths);
  assert.deepEqual(boundaryProvenanceAdmissionPaths, [...AUTHORIZATION_BOUNDARY_PROVENANCE_ADMISSION_PATHS].sort());
  for (const evidence of governance.authorizationBoundaryProvenanceAdmission.files) {
    const committedEvidence = execFileSync("/usr/bin/git", [
      "show", `${AUTHORIZATION_BOUNDARY_PROVENANCE_ADMISSION_COMMIT}:${evidence.path}`
    ], { cwd: root, encoding: null, stdio: ["ignore", "pipe", "ignore"] });
    assert.equal(sha256(committedEvidence), evidence.sha256, `Authorization-boundary provenance-admission evidence drifted: ${evidence.path}`);
  }
  assert.equal(
    boundaryProvenanceAdmissionPaths.every(path => /^(?:docs\/|scripts\/verify-|tests\/|workers\/infrastructure\/)/u.test(path)),
    true
  );

  const repairIdentity = commitIdentity(PROVENANCE_REPAIR_COMMIT);
  assert.equal(repairIdentity.author, OWNER_IDENTITY);
  assert.equal(repairIdentity.committer, OWNER_IDENTITY);
  assert.deepEqual(repairIdentity.parents, [PROVENANCE_REPAIR_PARENT]);
  assert.equal(repairIdentity.tree, PROVENANCE_REPAIR_TREE);
  assert.equal(git(["show", "-s", "--format=%s", PROVENANCE_REPAIR_COMMIT]), PROVENANCE_REPAIR_SUBJECT);
  assert.doesNotThrow(() => git(["merge-base", "--is-ancestor", PROVENANCE_REPAIR_COMMIT, "HEAD"]));

  const repairPaths = git(["diff-tree", "--no-commit-id", "--name-only", "-r", PROVENANCE_REPAIR_COMMIT])
    .split("\n").filter(Boolean).sort();
  const governedRepairPaths = governance.provenanceRepair.files.map(item => item.path).sort();
  assert.deepEqual(repairPaths, governedRepairPaths);
  for (const evidence of governance.provenanceRepair.files) {
    const committedEvidence = execFileSync("/usr/bin/git", [
      "show", `${PROVENANCE_REPAIR_COMMIT}:${evidence.path}`
    ], { cwd: root, encoding: null, stdio: ["ignore", "pipe", "ignore"] });
    assert.equal(sha256(committedEvidence), evidence.sha256, `Historical provenance repair evidence drifted: ${evidence.path}`);
  }
  assert.equal(repairPaths.every(path => /^(?:docs\/|scripts\/verify-|tests\/|workers\/infrastructure\/)/u.test(path)), true);
  assert.equal(sha256(read(PACKAGE_PATH)), CURRENT_PACKAGE_SHA256);

  for (const path of [GOVERNANCE_PATH, DOCUMENTATION_PATH]) {
    assert.equal(git(["log", "-1", "--format=%an <%ae>", "--", path]), OVERWATCH_IDENTITY);
  }

  const registry = verifyCrossSubsystemArtifactContracts().registry;
  const entry = registry.governanceArtifacts.find(item => item.artifactId === governance.governanceId);
  assert.equal(entry?.path, GOVERNANCE_PATH);
  assert.equal(entry?.documentationPath, DOCUMENTATION_PATH);
  assert.deepEqual(entry?.writeAllowed, ["Prometheus Overwatch"]);

  verifyAutomaticCommitPushGovernance();
  verifyGithubActionsPublicWorkerWorkflowV2();
  const assets = verifyRouteIqPublicDeploymentAssets({ build: false });
  assert.equal(assets.deploymentAssetsSha256, CURRENT_DEPLOYMENT_ASSET_SHA256);
  assert.equal(assets.candidateWebsiteCommit, AUGUST1_WEBSITE_SUCCESSOR.commit);
  assert.equal(assets.candidateWebsiteTree, AUGUST1_WEBSITE_SUCCESSOR.tree);
  const rollback = verifyPublicForwardRollbackArtifact(root);
  assert.equal(rollback.artifactSha256, CURRENT_ROLLBACK_ARTIFACT_SHA256);
  assert.equal(rollback.candidateDeploymentAssetsSha256, CURRENT_DEPLOYMENT_ASSET_SHA256);
  return Object.freeze({ status: "OVERWATCH_PUBLIC_DEPLOYMENT_WORKFLOW_V2_VERIFIED" });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(`${verifyOverwatchPublicDeploymentWorkflowV2().status}\n`);
}
