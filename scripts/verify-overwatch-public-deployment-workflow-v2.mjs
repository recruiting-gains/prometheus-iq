#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { verifyAutomaticCommitPushGovernance } from "./verify-overwatch-auto-push-governance.mjs";
import { verifyCrossSubsystemArtifactContracts } from "./verify-cross-subsystem-artifact-contracts.mjs";
import { verifyGithubActionsPublicWorkerWorkflowV2 } from "./verify-github-actions-public-worker-workflow-v2.mjs";
import { verifyRouteIqPublicDeploymentAssets } from "./verify-route-iq-public-deployment-assets.mjs";

const root = resolve(import.meta.dirname, "..");
const GOVERNANCE_PATH = "overwatch/governance/public-deployment-workflow-v2.json";
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
const OVERWATCH_IDENTITY = "Prometheus Overwatch <overwatch@prometheus.local>";
const DEPLOYMENT_ASSET_SHA256 = "5fd9e497e7fe814aab6194b4302528c6cff0e243e76a3dd843738f1882cd8c15";
const UNATTENDED_GOVERNANCE_ID = "cloudflare-unattended-deployment-access-governance-v1";
const PACKAGE_PATH = "package.json";
const HISTORICAL_PACKAGE_SHA256 = "a150ca1b1121c779415365551efdbff970e458915ba6491716ccbfdd0a111d0d";
const CURRENT_PACKAGE_SHA256 = "8bf7f51f8dbb6310031b6d26736dfe5209b2c74d42e5e56de475592f36bb7b51";

const read = path => readFileSync(resolve(root, path), "utf8");
const readJson = path => JSON.parse(read(path));
const sha256 = value => createHash("sha256").update(value).digest("hex");
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
  require(governance.architecture?.qualificationContactsCloudflare === false, "Qualification can contact Cloudflare.");
  require(governance.architecture?.qualificationAccessesProtectedSecrets === false, "Qualification can access secrets.");
  require(governance.architecture?.qualificationBuildsArtifactExactlyOnce === true, "Qualification build count drifted.");
  require(governance.architecture?.deploymentConsumesQualifiedArtifact === true, "Deployment does not consume qualification.");
  require(governance.architecture?.deploymentRebuildAllowed === false, "Deployment rebuild is allowed.");
  require(governance.architecture?.targetWorker === "prometheusrouteiq-website", "Public target drifted.");
  require(governance.architecture?.privateWorkerMutationAllowed === false, "Private Worker mutation is allowed.");
  require(governance.architecture?.authorizationConsumedAt === "immediately_before_forward_wrangler_deploy_child", "Authorization boundary drifted.");
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
  require(JSON.stringify(governance.protectedPredecessorSuccessors) === JSON.stringify([{
    predecessorGovernanceId: UNATTENDED_GOVERNANCE_ID,
    path: PACKAGE_PATH,
    historicalSha256: HISTORICAL_PACKAGE_SHA256,
    successorSha256: CURRENT_PACKAGE_SHA256,
    owner: "Prometheus Overwatch",
    ownerCommit: "ee80a44b8a28847d4a4acfc3fae8574697661edc",
    classification: "OVERWATCH_RELEASE_GATE_REGISTRATION_ONLY"
  }]), "Protected predecessor successor mapping drifted.");

  require(ownerContract.owner === "Prometheus Infrastructure", "Infrastructure contract ownership drifted.");
  require(ownerContract.status === "SOURCE_IMPLEMENTED_NOT_QUALIFIED_NOT_DEPLOYED", "Infrastructure status drifted.");
  require(ownerContract.qualification?.cloudflareRequestAllowed === false, "Owner qualification can contact Cloudflare.");
  require(ownerContract.qualification?.secretAccessAllowed === false, "Owner qualification can access secrets.");
  require(ownerContract.qualification?.publicArtifactBuilds === 1, "Owner artifact build count drifted.");
  require(ownerContract.deployment?.rebuildAllowed === false, "Owner deployment rebuild is allowed.");
  require(ownerContract.deployment?.forwardDeploymentAttempts === 1, "Owner deployment attempt ceiling drifted.");
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

function commitIdentity(commit) {
  const fields = git(["show", "-s", "--format=%an <%ae>%n%cn <%ce>%n%P%n%T", commit]).split("\n");
  return { author: fields[0], committer: fields[1], parents: fields[2].split(" "), tree: fields[3] };
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
    assert.equal(sha256(read(evidence.path)), evidence.sha256, `Owner evidence drifted: ${evidence.path}`);
  }
  assert.equal(committedPaths.some(path => /^(?:src\/|crm\/|data\/|intelligence\/|index\.html|deploy\/prometheusrouteiq-website\/)/u.test(path)), false);

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
    assert.equal(sha256(read(evidence.path)), evidence.sha256, `Provenance repair evidence drifted: ${evidence.path}`);
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
  assert.equal(assets.deploymentAssetsSha256, DEPLOYMENT_ASSET_SHA256);
  return Object.freeze({ status: "OVERWATCH_PUBLIC_DEPLOYMENT_WORKFLOW_V2_VERIFIED" });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(`${verifyOverwatchPublicDeploymentWorkflowV2().status}\n`);
}
