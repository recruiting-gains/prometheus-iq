#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import {
  PUBLIC_DEPLOYMENT_FAILURE,
  PUBLIC_WORKER_DEPLOYMENT_POLICY,
  PublicDeploymentPolicyError,
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
const pinnedNodeSuccessorFiles = Object.freeze([
  ".github/workflows/verify-prometheus-public-repository-integrity.yml",
  "docs/route-iq-public-repository-integrity-repair-v1.md",
  "scripts/verify-route-iq-public-repository-integrity-repair.mjs",
  "tests/public-repository-integrity-repair.test.mjs",
  "workers/infrastructure/route-iq-public-repository-integrity-repair-v1.json"
]);
const knownOverwatchSuccessorFiles = Object.freeze([
  "overwatch/governance/route-iq-public-deployment-integrity-repair-readiness-v1.json",
  "scripts/verify-overwatch-route-iq-3d-visual-continuity.mjs",
  "scripts/verify-overwatch-route-iq-public-crm-founder-access-deployment-readiness.mjs",
  "scripts/verify-overwatch-route-iq-public-deployment-integrity-repair-readiness.mjs",
  "scripts/verify-overwatch-route-iq-revised-3d-release-readiness-successor.mjs",
  "tests/overwatch-route-iq-3d-visual-continuity.test.mjs",
  "tests/overwatch-route-iq-public-crm-founder-access-deployment-readiness.test.mjs"
]);
const ownerBoundaryRepairFiles = Object.freeze([
  "docs/route-iq-public-repository-integrity-repair-v1.md",
  "scripts/verify-route-iq-public-repository-integrity-repair.mjs",
  "tests/public-repository-integrity-repair.test.mjs",
  "workers/infrastructure/route-iq-public-repository-integrity-repair-v1.json"
]);
const ciPortabilityRepairFiles = Object.freeze([
  "docs/route-iq-public-repository-integrity-repair-v1.md",
  "scripts/lib/route-iq-public-forward-rollback.mjs",
  "scripts/verify-route-iq-public-repository-integrity-repair.mjs",
  "tests/public-repository-integrity-repair.test.mjs",
  "workers/infrastructure/route-iq-public-repository-integrity-repair-v1.json"
]);

export const INFRASTRUCTURE_OWNER_VERIFIER_FAILURE = Object.freeze({
  ROLLBACK_SOURCE_MAP_OUTSIDE_BOUNDARY:
    "OWNER_VERIFIER_ROLLBACK_SOURCE_MAP_OUTSIDE_BOUNDARY",
  ROLLBACK_GENERATION_FAILED: "OWNER_VERIFIER_ROLLBACK_GENERATION_FAILED",
  ROLLBACK_INVALID: "OWNER_VERIFIER_ROLLBACK_INVALID",
  REPOSITORY_INTEGRITY_FAILED: "OWNER_VERIFIER_REPOSITORY_INTEGRITY_FAILED",
  CONTRACT_OR_PROVENANCE_INVALID: "OWNER_VERIFIER_CONTRACT_OR_PROVENANCE_INVALID",
  INTERNAL_FAILURE: "OWNER_VERIFIER_INTERNAL_FAILURE"
});

export const INFRASTRUCTURE_OWNER_BOUNDARY = Object.freeze({
  infrastructureCommits: Object.freeze([
    Object.freeze({
      commit: "a2bcfedcd996e4d6d22adc26d20bd77a39e763e7",
      tree: "8b5202428cfdb6a3586bdc90f39cce4d3ea02e97",
      parent: "d5174c50ee7b02f930b5fa1f50723ce9db3e447d",
      authorName: "Prometheus Infrastructure",
      authorEmail: "infrastructure@prometheus.local",
      committerName: "Prometheus Infrastructure",
      committerEmail: "infrastructure@prometheus.local",
      subject: "infrastructure: repair public repository integrity diagnostics",
      files: expectedOwnerFiles,
      contractBlob: "673857de365f5c193684afd125970b7b2f65e99d"
    }),
    Object.freeze({
      commit: "a2779239fc8f2d79d4b8781966d32cc23d4acbbd",
      tree: "025d3d01cae56753f9d0c5e63af5ea369a52b4ff",
      parent: "a2bcfedcd996e4d6d22adc26d20bd77a39e763e7",
      authorName: "Prometheus Infrastructure",
      authorEmail: "infrastructure@prometheus.local",
      committerName: "Prometheus Infrastructure",
      committerEmail: "infrastructure@prometheus.local",
      subject: "infrastructure: pin safe integrity diagnostic runtime",
      files: pinnedNodeSuccessorFiles,
      contractBlob: "67fccf3fbd534f877097b33154028c84c0ffbbc2"
    })
  ]),
  knownOverwatchSuccessor: Object.freeze({
    commit: "96af76e8094beafc2de455ebb5d80755c0160a2e",
    tree: "464118922a37710452ec85009df24007e9a4ffdf",
    parent: "a2779239fc8f2d79d4b8781966d32cc23d4acbbd",
    authorName: "Prometheus Overwatch",
    authorEmail: "overwatch@prometheus.local",
    committerName: "Prometheus Overwatch",
    committerEmail: "overwatch@prometheus.local",
    subject: "overwatch: record public integrity repair readiness",
    files: knownOverwatchSuccessorFiles
  }),
  boundaryRepairSuccessor: Object.freeze({
    parent: "96af76e8094beafc2de455ebb5d80755c0160a2e",
    authorName: "Prometheus Infrastructure",
    authorEmail: "infrastructure@prometheus.local",
    committerName: "Prometheus Infrastructure",
    committerEmail: "infrastructure@prometheus.local",
    subject: "infrastructure: constrain repository integrity owner boundary",
    files: ownerBoundaryRepairFiles
  }),
  ciPortabilityRepairSuccessor: Object.freeze({
    parent: "8d312bf747a289c675eb37adf582b43c860c635e",
    authorName: "Prometheus Infrastructure",
    authorEmail: "infrastructure@prometheus.local",
    committerName: "Prometheus Infrastructure",
    committerEmail: "infrastructure@prometheus.local",
    subject: "infrastructure: repair public integrity verifier portability",
    files: ciPortabilityRepairFiles
  })
});

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(resolve(root, path))).digest("hex");
}

function git(argumentsList) {
  return gitAt(root, argumentsList);
}

function gitAt(repositoryRoot, argumentsList) {
  return execFileSync("git", argumentsList, {
    cwd: repositoryRoot,
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

function commitSnapshot(repositoryRoot, commit) {
  const [hash, tree, parents, authorName, authorEmail, committerName, committerEmail, ...subject] = gitAt(
    repositoryRoot,
    ["show", "-s", "--format=%H%n%T%n%P%n%an%n%ae%n%cn%n%ce%n%s", commit]
  ).split("\n");
  return Object.freeze({
    commit: hash,
    tree,
    parents: parents.split(" ").filter(Boolean),
    authorName,
    authorEmail,
    committerName,
    committerEmail,
    subject: subject.join("\n"),
    files: gitAt(repositoryRoot, ["diff-tree", "--no-commit-id", "--name-only", "-r", commit])
      .split("\n").filter(Boolean).sort()
  });
}

function assertCommitSnapshot(repositoryRoot, expected) {
  const actual = commitSnapshot(repositoryRoot, expected.commit);
  assert.equal(actual.commit, expected.commit);
  assert.equal(actual.tree, expected.tree);
  assert.deepEqual(actual.parents, [expected.parent]);
  for (const field of ["authorName", "authorEmail", "committerName", "committerEmail", "subject"]) {
    assert.equal(actual[field], expected[field], `${expected.commit} ${field} drifted`);
  }
  assert.deepEqual(actual.files, [...expected.files].sort(), `${expected.commit} file scope drifted`);
  if (expected.contractBlob) {
    assert.equal(
      gitAt(repositoryRoot, ["rev-parse", `${expected.commit}:${PUBLIC_WORKER_DEPLOYMENT_POLICY.integrityContractPath}`]),
      expected.contractBlob,
      `${expected.commit} contract blob drifted`
    );
  }
  return actual;
}

function isOverwatchOwnedPath(path) {
  return path.startsWith("overwatch/")
    || path.startsWith("scripts/verify-overwatch-")
    || path.startsWith("tests/overwatch-");
}

export function verifyInfrastructureOwnerBoundary(repositoryRoot, boundary = INFRASTRUCTURE_OWNER_BOUNDARY) {
  for (const expected of boundary.infrastructureCommits) {
    assertCommitSnapshot(repositoryRoot, expected);
    gitAt(repositoryRoot, ["merge-base", "--is-ancestor", expected.commit, "HEAD"]);
  }
  const terminal = boundary.infrastructureCommits.at(-1).commit;
  const descendants = gitAt(repositoryRoot, ["rev-list", "--reverse", `${terminal}..HEAD`])
    .split("\n").filter(Boolean);
  assert.ok(descendants.length >= 1, "known Overwatch successor is missing");
  assert.equal(descendants[0], boundary.knownOverwatchSuccessor.commit);
  assertCommitSnapshot(repositoryRoot, boundary.knownOverwatchSuccessor);

  let previous = terminal;
  let repairSeen = false;
  let ciPortabilityRepairSeen = false;
  for (const commit of descendants) {
    const actual = commitSnapshot(repositoryRoot, commit);
    assert.deepEqual(actual.parents, [previous], `${commit} must remain a linear non-merge successor`);
    if (commit === boundary.knownOverwatchSuccessor.commit) {
      previous = commit;
      continue;
    }
    const repair = boundary.boundaryRepairSuccessor;
    const isRepair = !repairSeen
      && actual.parents[0] === repair.parent
      && actual.authorName === repair.authorName
      && actual.authorEmail === repair.authorEmail
      && actual.committerName === repair.committerName
      && actual.committerEmail === repair.committerEmail
      && actual.subject === repair.subject
      && JSON.stringify(actual.files) === JSON.stringify([...repair.files].sort());
    if (isRepair) {
      repairSeen = true;
      previous = commit;
      continue;
    }
    const portabilityRepair = boundary.ciPortabilityRepairSuccessor;
    const isPortabilityRepair = portabilityRepair
      && !ciPortabilityRepairSeen
      && actual.parents[0] === portabilityRepair.parent
      && actual.authorName === portabilityRepair.authorName
      && actual.authorEmail === portabilityRepair.authorEmail
      && actual.committerName === portabilityRepair.committerName
      && actual.committerEmail === portabilityRepair.committerEmail
      && actual.subject === portabilityRepair.subject
      && JSON.stringify(actual.files) === JSON.stringify([...portabilityRepair.files].sort());
    if (isPortabilityRepair) {
      ciPortabilityRepairSeen = true;
      previous = commit;
      continue;
    }
    assert.equal(actual.authorName, "Prometheus Overwatch");
    assert.equal(actual.authorEmail, "overwatch@prometheus.local");
    assert.equal(actual.committerName, "Prometheus Overwatch");
    assert.equal(actual.committerEmail, "overwatch@prometheus.local");
    assert.match(actual.subject, /^overwatch: /u);
    assert.ok(actual.files.length > 0 && actual.files.every(isOverwatchOwnedPath));
    previous = commit;
  }
  return Object.freeze({
    terminalOwnerCommit: terminal,
    descendants: descendants.length,
    repairSeen,
    ciPortabilityRepairSeen
  });
}

export function classifyInfrastructureOwnerVerifierFailure(error) {
  if (error?.message === "public_forward_rollback_source_map_outside_boundary") {
    return INFRASTRUCTURE_OWNER_VERIFIER_FAILURE.ROLLBACK_SOURCE_MAP_OUTSIDE_BOUNDARY;
  }
  if (error instanceof PublicDeploymentPolicyError) {
    if (error.code === PUBLIC_DEPLOYMENT_FAILURE.REPOSITORY_INTEGRITY_FAILED) {
      return INFRASTRUCTURE_OWNER_VERIFIER_FAILURE.REPOSITORY_INTEGRITY_FAILED;
    }
    if (error.code === PUBLIC_DEPLOYMENT_FAILURE.ROLLBACK_INVALID) {
      return INFRASTRUCTURE_OWNER_VERIFIER_FAILURE.ROLLBACK_INVALID;
    }
  }
  if (typeof error?.message === "string"
    && error.message.startsWith("public_forward_rollback_")) {
    return INFRASTRUCTURE_OWNER_VERIFIER_FAILURE.ROLLBACK_GENERATION_FAILED;
  }
  if (error?.code === "ERR_ASSERTION") {
    return INFRASTRUCTURE_OWNER_VERIFIER_FAILURE.CONTRACT_OR_PROVENANCE_INVALID;
  }
  return INFRASTRUCTURE_OWNER_VERIFIER_FAILURE.INTERNAL_FAILURE;
}

export function verifyRouteIqPublicRepositoryIntegrityRepair() {
  const contract = JSON.parse(read(contractPath));
  assert.equal(contract.version, "route-iq-public-repository-integrity-repair-v1");
  assert.equal(contract.batchId, "BATCH-20260719-008");
  assert.equal(contract.owner, "Prometheus Infrastructure");
  assert.equal(
    contract.status,
    "OWNER_CI_PORTABILITY_REPAIR_IMPLEMENTED_LOCALLY_NOT_PUSHED_NOT_DEPLOYED"
  );
  assert.deepEqual(contract.ownerFiles, expectedOwnerFiles);
  assert.deepEqual(contract.ownerBoundary, INFRASTRUCTURE_OWNER_BOUNDARY);
  assert.deepEqual(contract.baseline, {
    branch: "main",
    head: "d5174c50ee7b02f930b5fa1f50723ce9db3e447d",
    tree: "f86156dc10fb90cedc00274d3654e89edfff562a",
    originMain: "d5174c50ee7b02f930b5fa1f50723ce9db3e447d"
  });
  assert.equal(git(["rev-parse", `${contract.baseline.head}^{tree}`]), contract.baseline.tree);
  git(["merge-base", "--is-ancestor", contract.baseline.head, "HEAD"]);
  const ownerBoundary = verifyInfrastructureOwnerBoundary(root);
  if (git(["rev-parse", "HEAD"]) !== INFRASTRUCTURE_OWNER_BOUNDARY.ciPortabilityRepairSuccessor.parent) {
    assert.equal(ownerBoundary.ciPortabilityRepairSeen, true);
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
    "filesystemAliasPathsCanonicalized",
    "sourceMapSourcesResolvedAgainstValidatedRoot",
    "sourceMapRealpathContainmentRequired"
  ]) assert.equal(repair[field], true, `${field} must remain enabled`);
  assert.equal(repair.genericOwnerVerifierFailureAllowed, false);
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
  assert.equal(safeCi.dispatched, true);
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

  assert.deepEqual(contract.safeCiFailure, {
    runId: 29717192952,
    jobId: 88272671229,
    head: "8d312bf747a289c675eb37adf582b43c860c635e",
    tree: "36f163193fdb91cf241ddb0ff03bce200c7506c6",
    runner: "ubuntu-24.04",
    gitVersion: "2.54.0",
    nodeVersion: "24.18.0",
    npmVersion: "11.16.0",
    refCount: 7,
    origin: "HTTPS_EXACT_REPOSITORY",
    tagsPresent: false,
    repositoryIntegrityDiagnostic: "PUBLIC_REPOSITORY_INTEGRITY_VERIFIED",
    ownerVerifierOutput: "FAIL",
    exactFailure: "PUBLIC_FORWARD_ROLLBACK_SOURCE_MAP_OUTSIDE_BOUNDARY",
    rejectedSourceCount: 53,
    sourceMapRootValidated: true,
    deployCapabilityPresent: false,
    protectedEnvironmentAccessed: false,
    secretsAccessed: false,
    cloudflareContacted: false,
    productionMutated: false,
    consumed: true
  });

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

  assert.deepEqual(contract.ciPortabilityRepair, {
    owner: "Prometheus Infrastructure",
    classification: "SOURCE_MAP_ROOT_RELATIVE_RESOLUTION_REPAIR",
    predecessorCommit: "8d312bf747a289c675eb37adf582b43c860c635e",
    predecessorCommitsPreserved: true,
    rootCause:
      "RELATIVE_SOURCE_MAP_ENTRIES_WERE_RESOLVED_FROM_PROCESS_CWD_INSTEAD_OF_VALIDATED_SOURCE_ROOT",
    macPathCoincidenceMaskedFailure: true,
    githubRefShapeCausedFailure: false,
    fixedFailureClassification: "OWNER_VERIFIER_ROLLBACK_SOURCE_MAP_OUTSIDE_BOUNDARY",
    automaticRetryAllowed: false,
    safeCiRunConsumed: true
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
    "deploymentPerformed",
    "protectedEnvironmentAccessed",
    "secretAccessed",
    "cloudflareContacted",
    "productionDataMutated",
    "crmRequestSubmitted",
    "notificationSent",
    "privateWorkerModified"
  ]) assert.equal(contract.boundaries[field], false, `${field} boundary widened`);
  assert.equal(contract.boundaries.safeNonDeploymentWorkflowDispatched, true);
  assert.equal(contract.boundaries.deploymentWorkflowDispatched, false);
  assert.equal(contract.boundaries.historicalRepairRangePushed, true);
  assert.equal(contract.boundaries.currentRepairPushPerformed, false);
  assert.equal(contract.boundaries.collection, "OFF");
  assert.equal(contract.boundaries.activeCohortCount, 0);
  assert.equal(contract.boundaries.recommendationInfluence, "OFF");

  verifyPublicRepositoryIntegrity(root);
  return Object.freeze({
    status: "ROUTE_IQ_PUBLIC_REPOSITORY_INTEGRITY_REPAIR_VERIFIED",
    rollbackArtifactSha256: rollback.artifactSha256
  });
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    process.stdout.write(`${verifyRouteIqPublicRepositoryIntegrityRepair().status}\n`);
  } catch (error) {
    process.stdout.write(`${classifyInfrastructureOwnerVerifierFailure(error)}\n`);
    process.exitCode = 1;
  }
}
