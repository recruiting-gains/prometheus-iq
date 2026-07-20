#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  PUBLIC_WORKER_DEPLOYMENT_POLICY,
  verifyPublicRepositoryIntegrity
} from "./lib/github-actions-public-worker-deployment.mjs";
import { buildPublicForwardRollbackArtifact } from "./lib/route-iq-public-forward-rollback.mjs";

const root = resolve(import.meta.dirname, "..");
const contractPath = PUBLIC_WORKER_DEPLOYMENT_POLICY.integrityContractPath;
const expectedPreservedObjects = Object.freeze({
  src: "2386f04cd661cf75549c170b40ef4c01bd235b04",
  crm: "85aeb4e16887a0a1b4faf7c0d463173b322db60c",
  "deploy/prometheusrouteiq-website": "5c9a75c75e81770aa4825a911bafc6c005f46d4f",
  "workers/prometheus-iq-worker.js": "c3199013a4685ef0d9df601ff05b0052e1abb99d",
  "wrangler.prometheusrouteiq-website.jsonc": "91bf94141dc7a90ebd957ce7747f7ac27cd797dd",
  "overwatch/governance/route-iq-revised-3d-release-readiness-successor-v1.json":
    "98ba4eabf1870282230ac44bbe444acbe9d322c9"
});
const expectedOwnerFiles = Object.freeze([
  ".github/workflows/deploy-prometheus-public-worker.yml",
  ".github/workflows/verify-prometheus-public-repository-integrity.yml",
  "docs/route-iq-public-repository-integrity-repair-v1.md",
  "scripts/lib/github-actions-public-worker-deployment.mjs",
  "scripts/lib/route-iq-public-forward-rollback.mjs",
  "scripts/run-github-actions-public-worker-deployment.mjs",
  "scripts/run-public-worker-repository-integrity-diagnostic.mjs",
  "scripts/verify-github-actions-public-worker-deployment.mjs",
  "scripts/verify-route-iq-public-repository-integrity-repair.mjs",
  "tests/public-repository-integrity-repair.test.mjs",
  "workers/infrastructure/route-iq-public-repository-integrity-repair-v1.json"
]);

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(resolve(root, path))).digest("hex");
}

function git(argumentsList) {
  return execFileSync("git", argumentsList, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_TERMINAL_PROMPT: "0"
    }
  }).trim();
}

export function verifyRouteIqPublicRepositoryIntegrityRepair() {
  const contract = JSON.parse(read(contractPath));
  assert.equal(contract.version, "route-iq-public-repository-integrity-repair-v1");
  assert.equal(contract.batchId, "BATCH-20260719-008");
  assert.equal(contract.owner, "Prometheus Infrastructure");
  assert.equal(contract.status, "OWNER_REPAIR_IMPLEMENTED_NOT_PUSHED_NOT_DEPLOYED");
  assert.deepEqual(contract.ownerFiles, expectedOwnerFiles);
  assert.deepEqual(contract.baseline, {
    branch: "main",
    head: "d5174c50ee7b02f930b5fa1f50723ce9db3e447d",
    tree: "f86156dc10fb90cedc00274d3654e89edfff562a",
    originMain: "d5174c50ee7b02f930b5fa1f50723ce9db3e447d"
  });
  assert.equal(git(["rev-parse", `${contract.baseline.head}^{tree}`]), contract.baseline.tree);
  git(["merge-base", "--is-ancestor", contract.baseline.head, "HEAD"]);
  if (git(["rev-parse", "HEAD"]) !== contract.baseline.head) {
    assert.deepEqual(
      git(["diff", "--name-only", `${contract.baseline.head}..HEAD`]).split("\n").filter(Boolean),
      expectedOwnerFiles
    );
  }

  const failed = contract.failedRun;
  assert.equal(failed.runId, 29714512987);
  assert.equal(failed.verificationJobId, 88264893824);
  assert.equal(failed.deploymentJobId, 88264927103);
  assert.equal(failed.head, contract.baseline.head);
  assert.equal(failed.tree, contract.baseline.tree);
  assert.equal(failed.gitVersion, "2.54.0");
  assert.equal(failed.fetchDepth, 0);
  assert.equal(failed.command, "node scripts/run-github-actions-public-worker-deployment.mjs verify");
  assert.equal(failed.exitCode, 1);
  assert.equal(failed.sanitizedStdout, "REPOSITORY_INTEGRITY_FAILED");
  assert.equal(failed.sanitizedStderr, "");
  assert.equal(failed.reportedResult, "REPOSITORY_INTEGRITY_FAILED");
  assert.equal(failed.gitFsckExecuted, false);
  assert.equal(failed.artifactsProduced, 0);
  assert.equal(failed.deploymentJobSkipped, true);
  assert.equal(failed.protectedEnvironmentAccessed, false);
  assert.equal(failed.cloudflareContacted, false);
  assert.equal(failed.immutableEvidence, true);

  const reproduction = contract.reproduction;
  assert.equal(reproduction.suppressedDiagnostic, "ROLLBACK_HASH_MISMATCH");
  assert.equal(reproduction.previouslySuppressedGitFsckDiagnostic, "NONE_FSCK_NOT_REACHED");
  assert.equal(reproduction.failureStage, "ROLLBACK_ARTIFACT_VERIFICATION_BEFORE_GIT_FSCK");
  assert.equal(reproduction.reachableRepositoryCorruptionReproduced, false);
  assert.equal(reproduction.runnerSpecificGitCauseProven, false);
  assert.deepEqual(reproduction.localFullStrictFsck, {
    exitCode: 0,
    outputBytes: 237516,
    outputLines: 4318,
    benignDanglingLines: 4318
  });
  assert.deepEqual(reproduction.cleanFullCheckoutStrictFsck, {
    exitCode: 0,
    outputBytes: 0,
    outputLines: 0
  });
  assert.notEqual(
    reproduction.preRepairRollbackIdentity.localArtifactSha256,
    reproduction.preRepairRollbackIdentity.cleanCheckoutArtifactSha256
  );
  assert.notEqual(
    reproduction.preRepairRollbackIdentity.localGeneratedWorkerSha256,
    reproduction.preRepairRollbackIdentity.cleanCheckoutGeneratedWorkerSha256
  );

  const repair = contract.repair;
  assert.deepEqual(repair.gitIntegrityArguments, [
    "fsck", "--full", "--strict", "--no-dangling", "--no-progress"
  ]);
  assert.equal(repair.fsckCaptureLimitBytes, 131072);
  for (const field of [
    "systemGitConfigurationDisabled",
    "globalGitConfigurationDisabled",
    "shallowRepositoryRejected",
    "partialCloneRejected",
    "promisorRepositoryRejected",
    "unsupportedObjectFormatRejected",
    "boundedNonsecretDiagnostics",
    "nonemptySuccessfulFsckOutputRejected",
    "integrityRunsBeforeRollbackAndCredentialAccess",
    "exactHttpsAndSshRepositoryOriginsOnly",
    "generatedWorkerPathsCanonicalized",
    "filesystemAliasPathsCanonicalized"
  ]) assert.equal(repair[field], true, `${field} must remain enabled`);
  assert.equal(repair.fsckFailureOutputExposed, false);
  assert.equal(repair.unknownPreflightFailureClass, "PREFLIGHT_FAILED");
  assert.equal(repair.rollbackFailureClass, "ROLLBACK_INVALID");
  assert.equal(repair.repositoryFailureClass, "REPOSITORY_INTEGRITY_FAILED");

  const rollback = buildPublicForwardRollbackArtifact(root);
  assert.equal(rollback.artifactSha256, repair.canonicalRollbackIdentity.artifactSha256);
  for (const field of [
    "candidateDeploymentAssetsSha256",
    "websiteAssetsSha256",
    "configurationSha256",
    "generatedWorkerSha256",
    "generatedSourceMapSha256"
  ]) assert.equal(rollback[field], repair.canonicalRollbackIdentity[field]);

  const safeCi = contract.safeCiVerification;
  assert.equal(safeCi.workflow, PUBLIC_WORKER_DEPLOYMENT_POLICY.integrityWorkflowPath);
  assert.equal(safeCi.trigger, "workflow_dispatch");
  assert.equal(safeCi.dispatched, false);
  assert.equal(safeCi.contentsPermission, "read");
  assert.equal(safeCi.pinnedNodeVersion, "24");
  for (const field of [
    "checkoutBeforeNodeSetup",
    "nodeSetupBeforeRepositoryScripts",
    "diagnosticBeforeDependencyInstall",
    "diagnosticBeforeRollbackGeneration"
  ]) assert.equal(safeCi[field], true, `${field} must remain enabled`);
  for (const field of [
    "automaticTriggersAllowed",
    "protectedEnvironmentUsed",
    "secretsAllowed",
    "cloudflareRequestsAllowed",
    "deploymentAllowed",
    "productionMutationAllowed",
    "crmSubmissionAllowed"
  ]) assert.equal(safeCi[field], false, `${field} must remain disabled`);

  const safeWorkflow = read(PUBLIC_WORKER_DEPLOYMENT_POLICY.integrityWorkflowPath);
  const checkout = safeWorkflow.indexOf("uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5");
  const setupNode = safeWorkflow.indexOf("uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020");
  const firstRepositoryNodeScript = safeWorkflow.indexOf("run: node scripts/");
  const diagnostic = safeWorkflow.indexOf("run: node scripts/run-public-worker-repository-integrity-diagnostic.mjs");
  const npmInstall = safeWorkflow.indexOf("run: npm ci");
  const rollbackVerification = safeWorkflow.indexOf(
    "run: node scripts/verify-route-iq-public-repository-integrity-repair.mjs"
  );
  assert.ok(checkout >= 0 && checkout < setupNode);
  assert.ok(setupNode < firstRepositoryNodeScript);
  assert.equal(firstRepositoryNodeScript, diagnostic);
  assert.ok(diagnostic < npmInstall && npmInstall < rollbackVerification);

  assert.deepEqual(contract.successorRepair, {
    owner: "Prometheus Infrastructure",
    classification: "PINNED_NODE_ORDERING_REPAIR",
    predecessorCommit: "a2bcfedcd996e4d6d22adc26d20bd77a39e763e7",
    predecessorAmended: false,
    ambientHostedNodeAllowed: false,
    repositoryNodeExecutionOrder: [
      "CHECKOUT_COMPLETE_HISTORY",
      "SETUP_PINNED_NODE_24",
      "RUN_REPOSITORY_DIAGNOSTIC",
      "INSTALL_LOCKED_DEPENDENCIES",
      "VERIFY_ROLLBACK_IDENTITY"
    ]
  });

  assert.deepEqual(contract.preservation.gitObjects, expectedPreservedObjects);
  for (const [path, expected] of Object.entries(expectedPreservedObjects)) {
    assert.equal(git(["rev-parse", `HEAD:${path}`]), expected, `${path} changed`);
  }
  assert.equal(
    sha256("overwatch/governance/route-iq-revised-3d-release-readiness-successor-v1.json"),
    contract.preservation.previousReadinessSuccessorSha256
  );
  assert.equal(git([
    "diff", "--name-only", `${contract.baseline.head}..HEAD`, "--",
    "src", "crm", "deploy/prometheusrouteiq-website", "workers/prometheus-iq-worker.js",
    "wrangler.prometheusrouteiq-website.jsonc",
    "overwatch/governance/route-iq-revised-3d-release-readiness-successor-v1.json"
  ]), "");
  for (const field of [
    "websiteImplementationModified",
    "crmImplementationModified",
    "generatedDeploymentAssetsModified",
    "previousReadinessSuccessorModified"
  ]) assert.equal(contract.preservation[field], false);

  for (const field of [
    "workflowDispatched",
    "pushPerformed",
    "deploymentPerformed",
    "protectedEnvironmentAccessed",
    "secretAccessed",
    "cloudflareContacted",
    "productionDataMutated",
    "crmRequestSubmitted",
    "notificationSent",
    "privateWorkerModified"
  ]) assert.equal(contract.boundaries[field], false, `${field} boundary widened`);
  assert.equal(contract.boundaries.collection, "OFF");
  assert.equal(contract.boundaries.activeCohortCount, 0);
  assert.equal(contract.boundaries.recommendationInfluence, "OFF");

  verifyPublicRepositoryIntegrity(root);
  return Object.freeze({
    status: "ROUTE_IQ_PUBLIC_REPOSITORY_INTEGRITY_REPAIR_VERIFIED",
    rollbackArtifactSha256: rollback.artifactSha256
  });
}

try {
  process.stdout.write(`${verifyRouteIqPublicRepositoryIntegrityRepair().status}\n`);
} catch {
  process.stdout.write("FAIL\n");
  process.exitCode = 1;
}
