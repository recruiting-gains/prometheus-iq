import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { verifyCrossSubsystemArtifactContracts } from "./verify-cross-subsystem-artifact-contracts.mjs";

const governancePath = "overwatch/governance/route-iq-retention-expiry-deletion-runtime-v1.json";
const reportPath = "overwatch/reports/BATCH-20260809-001-route-iq-retention-expiry-deletion-runtime.json";
const registryPath = "overwatch/artifact-contracts/canonical-artifact-registry.json";
const startCommit = "0ae9b3752476bc782b067a2a47fd388e4c3791ef";
const startTree = "3b6778b25c731e75c489b738dc00256868522d22";

const ownerCommits = Object.freeze({
  "8845846632801ccf29e52a36139a43c1063fcc2e": Object.freeze({
    name: "Prometheus Data",
    email: "data@prometheus.local",
    files: Object.freeze([
      "data/route-iq-field-sessions-v1/README.md",
      "data/route-iq-field-sessions-v1/route-iq-field-session-archive.mjs",
      "data/route-iq-field-sessions-v1/route-iq-prospective-retention-policy.mjs",
      "data/route-iq-field-sessions-v1/route-iq-retention-deletion-event-v1.schema.json",
      "data/route-iq-field-sessions-v1/route-iq-retention-deletion-plan-v1.schema.json",
      "data/route-iq-field-sessions-v1/route-iq-retention-deletion-runtime.mjs",
      "data/route-iq-field-sessions-v1/route-iq-retention-governance.mjs",
      "data/route-iq-field-sessions-v1/route-iq-retention-operation-receipt-v1.schema.json",
      "tests/route-iq-prospective-retention-policy.test.mjs",
      "tests/route-iq-retention-deletion-runtime.test.mjs",
      "tests/route-iq-retention-test-support.mjs"
    ])
  }),
  "28c8a51b4aafef777e407c324ea15c57f4f12454": Object.freeze({
    name: "Prometheus Data",
    email: "data@prometheus.local",
    files: Object.freeze([
      "data/route-iq-field-sessions-v1/route-iq-prospective-shadow-retention-policy-v1.json",
      "data/route-iq-field-sessions-v1/route-iq-retention-governance.mjs",
      "tests/route-iq-prospective-retention-policy.test.mjs",
      "tests/route-iq-retention-deletion-runtime.test.mjs"
    ])
  }),
  "f5a473a4fbab7d0f876be36c65b603d9b13bcc0a": Object.freeze({
    name: "Prometheus Intelligence Engine",
    email: "intelligence@prometheus.local",
    files: Object.freeze([
      "intelligence/route-iq-prospective-retention-admission.mjs",
      "tests/route-iq-prospective-retention-intelligence.test.mjs"
    ])
  }),
  "17bef15930ded364a55aadd47d0f96722cc8e9c6": Object.freeze({
    name: "Prometheus Intelligence Engine",
    email: "intelligence@prometheus.local",
    files: Object.freeze([
      "intelligence/contracts/off-route-learning-intelligence-contracts.json",
      "intelligence/contracts/read-only-field-session-learning-contracts.json",
      "intelligence/contracts/shadow-decision-readiness-contracts.json",
      "intelligence/provenance/specifications/prospective-retention-admission-v1.json",
      "scripts/validate-intelligence-architecture.mjs",
      "scripts/verify-route-iq-prospective-retention-intelligence.mjs"
    ])
  }),
  "7280f2b505e244f187755990d55bcfa701d1ef46": Object.freeze({
    name: "Prometheus Infrastructure",
    email: "infrastructure@prometheus.local",
    files: Object.freeze([
      "tests/route-iq-retention-maintenance-infrastructure.test.mjs",
      "workers/infrastructure/route-iq-retention-maintenance-runtime-v1.json",
      "workers/infrastructure/route-iq-retention-maintenance-runtime.js"
    ])
  }),
  "82b2edd12f15978d97f0950657c5c123a01a54a7": Object.freeze({
    name: "Prometheus Data",
    email: "data@prometheus.local",
    files: Object.freeze([
      "overwatch/artifact-contracts/data/fitness-connection-runtime-artifact-contract-v1.json",
      "tests/route-iq-prospective-retention-policy.test.mjs"
    ])
  }),
  "70c57f3d94eabfc019cbb5dae1cbd276e6e92be0": Object.freeze({
    name: "Prometheus Infrastructure",
    email: "infrastructure@prometheus.local",
    files: Object.freeze(["scripts/verify-route-iq-prospective-shadow-infrastructure.mjs"])
  }),
  "a8fedf7c0b88f0611b4f721b08641e55413c591a": Object.freeze({
    name: "Prometheus Data",
    email: "data@prometheus.local",
    files: Object.freeze([
      "data/route-iq-field-sessions-v1/route-iq-retention-deletion-plan-v1.schema.json",
      "data/route-iq-field-sessions-v1/route-iq-retention-deletion-runtime.mjs",
      "tests/route-iq-retention-deletion-runtime.test.mjs"
    ])
  }),
  "8156bc78dca7cc15006207f09c53a89828e67750": Object.freeze({
    name: "Prometheus Infrastructure",
    email: "infrastructure@prometheus.local",
    files: Object.freeze([
      "tests/route-iq-retention-maintenance-infrastructure.test.mjs",
      "workers/infrastructure/route-iq-retention-maintenance-forward-revert-v1.json"
    ])
  }),
  "b359d8e701e13d2f9911dcd0cb917eecce8aa7ac": Object.freeze({
    name: "Prometheus Intelligence Engine",
    email: "intelligence@prometheus.local",
    files: Object.freeze([
      "intelligence/provenance/protected-baseline-synchronization-retention-deletion-runtime-v1.json",
      "intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs",
      "tests/route-iq-intelligence-controlled-rehearsal-smoke-contract-successor.test.mjs"
    ])
  }),
  "99f591162093ccb1f4ad5ac2eac59fc76bec4bc0": Object.freeze({
    name: "Prometheus Intelligence Engine",
    email: "intelligence@prometheus.local",
    files: Object.freeze([
      "intelligence/provenance/protected-baseline-synchronization-retention-deletion-runtime-v1.json",
      "intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs",
      "tests/intelligence-architecture.test.mjs",
      "tests/route-iq-intelligence-controlled-rehearsal-smoke-contract-successor.test.mjs"
    ])
  }),
  "a445bf4bdb068eb597b11e60ff10cdd2d1f4e023": Object.freeze({
    name: "Prometheus Infrastructure",
    email: "infrastructure@prometheus.local",
    files: Object.freeze([
      "scripts/verify-production-release.mjs",
      "tests/production-release-current-dashboard-contract.test.mjs"
    ])
  }),
  "61e0c186af29e076797f817d0c834ec42531dbbe": Object.freeze({
    name: "Prometheus Infrastructure",
    email: "infrastructure@prometheus.local",
    files: Object.freeze([
      "scripts/lib/github-actions-private-worker-workflow-v2.mjs",
      "tests/github-actions-private-worker-workflow-v2.test.mjs",
      "workers/infrastructure/github-actions-private-worker-deployment-v2.json"
    ])
  }),
  "1f347ba74bfa2eab0415b3778dcbfdc0f80dd9ee": Object.freeze({
    name: "Prometheus Infrastructure",
    email: "infrastructure@prometheus.local",
    files: Object.freeze([
      "scripts/lib/github-actions-private-worker-workflow-v2.mjs",
      "tests/github-actions-private-worker-workflow-v2.test.mjs",
      "workers/infrastructure/github-actions-private-worker-deployment-v2.json"
    ])
  }),
  "e0a5fb7a9089cae62081295875793f9c635c498c": Object.freeze({
    name: "Prometheus Data",
    email: "data@prometheus.local",
    files: Object.freeze([
      "data/route-iq-field-sessions-v1/route-iq-prospective-shadow-coordinator.mjs"
    ])
  }),
  "d2ed353722b8c99f786306d7bbb37f21349ec3a5": Object.freeze({
    name: "Prometheus Intelligence Engine",
    email: "intelligence@prometheus.local",
    files: Object.freeze([
      "intelligence/read-only-field-session-learning.mjs",
      "scripts/verify-shadow-decision-readiness.mjs",
      "tests/read-only-field-session-learning.test.mjs",
      "tests/shadow-decision-readiness.test.mjs"
    ])
  }),
  "f37a1e16a73d89c57fb988c53c472a570fdbc15f": Object.freeze({
    name: "Prometheus Intelligence Engine",
    email: "intelligence@prometheus.local",
    files: Object.freeze(["scripts/verify-shadow-decision-readiness.mjs"])
  }),
  "605c52e3076504159ac22c84b36b3d441cc30b66": Object.freeze({
    name: "Prometheus Intelligence Engine",
    email: "intelligence@prometheus.local",
    files: Object.freeze([
      "intelligence/provenance/protected-baseline-synchronization-retention-deletion-consumer-admission-v1.json",
      "intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs"
    ])
  }),
  "61418a67b6df3e482b52a1fa6f7fc6757147dda0": Object.freeze({
    name: "Prometheus Intelligence Engine",
    email: "intelligence@prometheus.local",
    files: Object.freeze(["tests/read-only-field-session-learning.test.mjs"])
  }),
  "39cb2b9c9dea7766b420ce8d1ad959c4b35a2d4b": Object.freeze({
    name: "Prometheus Intelligence Engine",
    email: "intelligence@prometheus.local",
    files: Object.freeze([
      "intelligence/provenance/protected-baseline-synchronization-retention-deletion-consumer-admission-v1.json",
      "intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs"
    ])
  })
});

const read = path => readFileSync(path);
const readJson = path => JSON.parse(read(path));
const sha256 = value => createHash("sha256").update(value).digest("hex");
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();

export function isExactMainCheckout({ branch, head, originMain, environment = {} }) {
  if (head !== originMain) return false;
  if (branch === "main") return true;
  return branch === ""
    && environment.GITHUB_ACTIONS === "true"
    && environment.GITHUB_REF === "refs/heads/main"
    && environment.GITHUB_REF_NAME === "main"
    && environment.GITHUB_REF_TYPE === "branch"
    && environment.GITHUB_SHA === head;
}

function changedPaths(commit) {
  const value = git("diff-tree", "--no-commit-id", "--name-only", "-r", commit);
  return value ? value.split("\n").sort() : [];
}

function verifyOwnerChain(governance) {
  const governed = new Set(Object.values(governance.ownership.commits).flat());
  assert.deepEqual(governed, new Set(Object.keys(ownerCommits)));
  for (const [commit, expected] of Object.entries(ownerCommits)) {
    assert.equal(git("cat-file", "-t", commit), "commit");
    execFileSync("git", ["merge-base", "--is-ancestor", commit, "HEAD"]);
    assert.equal(git("show", "-s", "--format=%an", commit), expected.name);
    assert.equal(git("show", "-s", "--format=%ae", commit), expected.email);
    assert.equal(git("show", "-s", "--format=%cn", commit), expected.name);
    assert.equal(git("show", "-s", "--format=%ce", commit), expected.email);
    assert.deepEqual(changedPaths(commit), [...expected.files].sort());
  }
}

function verifyPinnedFiles(governance) {
  const pins = [
    ...Object.values(governance.dataRuntime).filter(value => value?.path),
    { path: governance.intelligenceBoundary.path, sha256: governance.intelligenceBoundary.sha256 },
    governance.intelligenceBoundary.specification,
    ...governance.intelligenceBoundary.consumerContracts,
    governance.intelligenceBoundary.consumerAdmissionProvenance,
    ...governance.intelligenceBoundary.consumerRuntimeFiles,
    { path: governance.infrastructureBoundary.runtimePath, sha256: governance.infrastructureBoundary.runtimeSha256 },
    { path: governance.infrastructureBoundary.contractPath, sha256: governance.infrastructureBoundary.contractSha256 },
    ...governance.infrastructureBoundary.privateWorkflowQualification.files,
    governance.qualificationRepair.productionReleaseVerifier,
    governance.qualificationRepair.regressionTest,
    governance.qualificationRepair.liveCanonicalIdentity.protectedSuccessor,
    governance.qualificationRepair.liveCanonicalIdentity.verifier,
    governance.qualificationRepair.liveCanonicalIdentity.intelligenceRegressionTest,
    governance.qualificationRepair.liveCanonicalIdentity.architectureRegressionTest,
    governance.qualificationRepair.liveCanonicalIdentity.controlledRehearsalVerifier,
    governance.qualificationRepair.liveCanonicalIdentity.overwatchRegressionTest,
    governance.qualificationRepair.hostedCheckoutBranch.regressionTest,
    governance.qualificationRepair.founderAttendedPackageWiring.canonicalLedger,
    governance.qualificationRepair.founderAttendedPackageWiring.verifier,
    governance.qualificationRepair.founderAttendedPackageWiring.regressionTest,
    governance.qualificationRepair.founderAttendedPackageWiring.ttyRegressionTest,
    ...governance.qualificationRepair.finalPayloadSuccessorComposition.files,
    ...governance.qualificationRepair.historicalRetentionCoordinatorComposition.files,
    governance.forwardRevert
  ];
  for (const pin of pins) assert.equal(sha256(read(pin.path)), pin.sha256, `${pin.path} hash drifted.`);
}

export function verifyOverwatchRouteIqRetentionDeletionRuntime() {
  const governance = readJson(governancePath);
  const report = readJson(reportPath);
  const registry = readJson(registryPath);
  const policy = readJson(governance.dataRuntime.policy.path);
  const artifactContract = readJson(governance.dataRuntime.artifactContract.path);
  const maintenance = readJson(governance.infrastructureBoundary.contractPath);
  const forwardRevert = readJson(governance.forwardRevert.path);
  const head = git("rev-parse", "HEAD");
  const originMain = git("rev-parse", "refs/remotes/origin/main");

  assert.equal(git("rev-parse", `${startCommit}^{tree}`), startTree);
  assert.equal(isExactMainCheckout({
    branch: git("branch", "--show-current"),
    head,
    originMain,
    environment: process.env
  }), true);
  assert.equal(governance.batchId, "BATCH-20260809-001");
  assert.equal(governance.status, "SOURCE_COMPLETE_DORMANT_DEPLOYMENT_HELD");
  assert.equal(governance.owningSubsystem, "Prometheus Overwatch");
  assert.equal(governance.ownership.implementationOriginatedFromSubsystemOwners, true);
  assert.equal(governance.ownership.overwatchModifiedSubsystemImplementation, false);
  verifyOwnerChain(governance);
  verifyPinnedFiles(governance);

  assert.equal(sha256(read(governance.predecessorGovernance.path)), governance.predecessorGovernance.sha256);
  assert.equal(
    sha256(read(governance.predecessorGovernance.historicalBatchRecordPath)),
    governance.predecessorGovernance.historicalBatchRecordSha256
  );
  assert.equal(governance.predecessorGovernance.rewritten, false);

  assert.equal(policy.expiryAndDeletion.physicalDeletionImplementationStatus, "source_complete_dormant_not_deployed");
  assert.equal(policy.expiryAndDeletion.physicalDeletionEvaluatorCanPerformMutation, true);
  assert.equal(policy.expiryAndDeletion.physicalDeletionActivated, false);
  assert.equal(policy.activationBoundary.collectionDefault, "off");
  const retention = artifactContract.prospectiveShadowEvidenceLifecycleContract.retentionAndCollection;
  assert.equal(retention.physicalDeletionImplementationAvailable, true);
  assert.equal(retention.physicalDeletionDeployed, false);
  assert.equal(retention.physicalDeletionActivated, false);
  assert.equal(retention.activationEligibleUnderRetentionPolicy, false);

  assert.equal(maintenance.status, "source_complete_dormant_not_deployed");
  assert.equal(maintenance.ordinaryArchiveBinding.deleteCapabilityAllowed, false);
  assert.equal(maintenance.ordinaryArchiveBinding.ingestionRequiresMaintenanceBinding, false);
  assert.equal(maintenance.maintenanceBinding.mustBeSeparateFromOrdinaryArchiveBinding, true);
  assert.equal(maintenance.activation.workerRouteConfigured, false);
  assert.equal(maintenance.activation.schedulerConfigured, false);
  assert.equal(maintenance.activation.productionBindingConfigured, false);
  assert.equal(maintenance.activation.productionDeploymentAuthorized, false);
  assert.equal(maintenance.activation.productionDeletionAuthorized, false);
  assert.equal(governance.qualificationRepair.runtimeBehaviorChanged, false);
  assert.equal(governance.qualificationRepair.legacyRuntimePoolSelectionAccepted, false);
  assert.equal(governance.qualificationRepair.sessionBoundBusinessHoursRequired, true);
  assert.equal(governance.qualificationRepair.localProductionReleaseVerification, "PASS");
  assert.equal(governance.qualificationRepair.liveCanonicalIdentity.historicalBaselineObjectsRemainExact, true);
  assert.equal(governance.qualificationRepair.liveCanonicalIdentity.newGovernedReportsClassifiedAsHistoricalRewrites, false);
  assert.equal(governance.qualificationRepair.hostedCheckoutBranch.failedRun, 31337142274);
  assert.equal(governance.qualificationRepair.hostedCheckoutBranch.detachedHeadAcceptedOnlyForExactGithubMain, true);
  assert.equal(governance.qualificationRepair.hostedCheckoutBranch.originMainMustEqualHead, true);
  assert.equal(governance.qualificationRepair.founderAttendedPackageWiring.failedRun, 31337349444);
  assert.equal(governance.qualificationRepair.founderAttendedPackageWiring.runtimeBehaviorChanged, false);
  assert.equal(governance.qualificationRepair.founderAttendedPackageWiring.credentialBehaviorChanged, false);
  assert.equal(governance.qualificationRepair.founderAttendedPackageWiring.orderedPackageChainRequired, true);
  assert.equal(governance.qualificationRepair.privateWorkflowPayload.failedRun, 31337831024);
  assert.equal(governance.qualificationRepair.privateWorkflowPayload.runtimeBehaviorChanged, false);
  assert.equal(governance.qualificationRepair.privateWorkflowPayload.deploymentPerformed, false);
  assert.equal(governance.qualificationRepair.finalPayloadSuccessorComposition.failedRun,
    31340617780);
  assert.equal(governance.qualificationRepair.finalPayloadSuccessorComposition.runtimeBehaviorChanged,
    false);
  assert.equal(governance.qualificationRepair.finalPayloadSuccessorComposition
    .productionMutationPerformed, false);
  assert.equal(governance.qualificationRepair.finalPayloadSuccessorComposition
    .historicalSuccessorsPreserved, true);
  assert.equal(governance.qualificationRepair.finalPayloadSuccessorComposition
    .terminalInfrastructureOwnerCommit, "1f347ba74bfa2eab0415b3778dcbfdc0f80dd9ee");
  assert.equal(governance.qualificationRepair.finalPayloadSuccessorComposition
    .terminalIntelligenceOwnerCommit, "39cb2b9c9dea7766b420ce8d1ad959c4b35a2d4b");
  assert.equal(governance.qualificationRepair.finalPayloadSuccessorComposition
    .orderedOwnerChainRequired, true);
  assert.equal(governance.qualificationRepair.historicalRetentionCoordinatorComposition.failedRun,
    31341204771);
  assert.equal(governance.qualificationRepair.historicalRetentionCoordinatorComposition
    .runtimeBehaviorChanged, false);
  assert.equal(governance.qualificationRepair.historicalRetentionCoordinatorComposition
    .productionMutationPerformed, false);
  assert.equal(governance.qualificationRepair.historicalRetentionCoordinatorComposition
    .historicalCoordinatorSha256,
    "30727656084c774d48a2d80b79f7dcad66a864fd6bd5c489905d9247fd953e85");
  assert.equal(governance.qualificationRepair.historicalRetentionCoordinatorComposition
    .currentCoordinatorSha256,
    "586d19dbf65c4c740ecea6a7e0b4e1d01d733471a2604f8a92b946af092ee282");
  assert.equal(
    governance.infrastructureBoundary.privateWorkflowQualification.forwardPayloadSha256,
    "aaa8b360d5851bec21637d4c639a485555c367d1d5c9defb1b12163160c035c7"
  );
  assert.equal(
    governance.infrastructureBoundary.privateWorkflowQualification.deployParitySha256,
    "a9c8837fb8978ee43f372f229f7b08286d8ebd2efce93e76971e8a39f47730f9"
  );
  assert.equal(
    governance.infrastructureBoundary.privateWorkflowQualification.rollbackBundleSha256,
    "ab76b6c7ffa0d3899e008c3f92fc41e61139f9a23d40c31d22609d80df919028"
  );

  const runtimeSource = read(governance.dataRuntime.deletionRuntime.path).toString("utf8");
  const infrastructureSource = read(governance.infrastructureBoundary.runtimePath).toString("utf8");
  assert.doesNotMatch(runtimeSource, /scheduled\s*\(|alarm\s*\(|queue\s*\(|\/api\//);
  assert.doesNotMatch(infrastructureSource, /scheduled\s*\(|alarm\s*\(|queue\s*\(|\/api\//);

  const changed = git("diff", "--name-only", `${startCommit}..HEAD`).split("\n").filter(Boolean);
  for (const forbidden of ["wrangler", ".github/workflows/", "deploy/", "website/", "crm/", "dashboard/"]) {
    assert.equal(changed.some(path => path.includes(forbidden)), false, `Protected runtime path changed: ${forbidden}`);
  }
  assert.equal(
    git("rev-parse", `${startCommit}:data/route-iq-field-sessions-v1/workspaces/fitness_connection/sessions`),
    governance.historicalEvidence.sessionSubtreeGitObjectBefore
  );
  assert.equal(
    git("rev-parse", "HEAD:data/route-iq-field-sessions-v1/workspaces/fitness_connection/sessions"),
    governance.historicalEvidence.sessionSubtreeGitObjectAfter
  );
  assert.equal(
    git("rev-parse", "HEAD:data/route-iq-field-sessions-v1/source-evidence"),
    governance.historicalEvidence.sourceEvidenceSubtreeGitObjectAfter
  );
  assert.equal(governance.historicalEvidence.rewritten, false);

  assert.equal(forwardRevert.forwardOnly, true);
  assert.equal(forwardRevert.historyRewriteAllowed, false);
  assert.equal(forwardRevert.deploymentPerformed, false);
  assert.equal(forwardRevert.productionStorageMutationPerformed, false);
  assert.equal(governance.protectedState.collection, "OFF");
  assert.equal(governance.protectedState.activeCohorts, 0);
  assert.equal(governance.protectedState.recommendationInfluence, "OFF");
  assert.equal(governance.protectedState.canonicalProspectiveRecords, 0);
  assert.equal(governance.protectedState.canonicalEvaluations, 0);
  assert.equal(governance.protectedState.productionDeployment, "UNCHANGED");
  assert.equal(governance.protectedState.productionStorageAccessPerformed, false);
  assert.equal(governance.protectedState.productionDeletionPerformed, false);
  assert.equal(governance.activationDecision.prospectiveCollectionMayActivate, false);

  const fitness = registry.workspaces.find(workspace => workspace.workspaceId === "fitness_connection");
  const registered = new Map(fitness.canonicalArtifacts.map(artifact => [artifact.artifactId, artifact]));
  for (const [artifactId, path] of [
    ["fitness_connection_route_iq_retention_deletion_runtime_governance", governancePath],
    ["fitness_connection_route_iq_retention_deletion_runtime_batch_record", reportPath]
  ]) {
    const artifact = registered.get(artifactId);
    assert.ok(artifact);
    assert.equal(artifact.path, path);
    assert.equal(artifact.ownerSubsystem, "Prometheus Overwatch");
    assert.equal(artifact.productionConsumer, false);
    assert.equal(artifact.failClosedIfMissing, true);
  }
  const contracts = verifyCrossSubsystemArtifactContracts();
  assert.equal(contracts.ok, true, contracts.failures.join("\n"));

  assert.equal(report.verdict, governance.status);
  assert.equal(report.fixtureExecution.dryRunMutationCount, 0);
  assert.equal(report.fixtureExecution.exactBoundaryExpiredFixture, "COMPLETELY_DELETED");
  assert.equal(report.fixtureExecution.partialFailureState, "BLOCKED_RESUMABLE");
  assert.equal(report.fixtureExecution.identicalRetry, "IDEMPOTENT");
  assert.equal(report.qualification.focusedPreflight.productionReleaseCurrentDashboardRegressionTests, "3/3 PASS");
  assert.equal(report.qualification.focusedPreflight.localProductionReleaseVerification, "PASS");
  assert.equal(report.qualification.focusedPreflight.liveCanonicalIdentityRegressionTests, "18/18 PASS");
  assert.equal(report.qualification.focusedPreflight.intelligenceArchitectureRegressionTests, "15/15 PASS");
  assert.equal(report.qualification.focusedPreflight.controlledRehearsalRegressionTests, "13/13 PASS");
  assert.equal(report.qualification.focusedPreflight.hostedCheckoutBranchRegressionTests, "4/4 PASS");
  assert.equal(report.qualification.focusedPreflight.founderAttendedPackageWiringRegressionTests,
    "20/20 PASS");
  assert.equal(report.qualification.initialHostedQualificationRun, 31336094147);
  assert.equal(report.qualification.initialHostedQualificationResult, "FAILED_CLOSED_STALE_SUCCESSOR_CHAIN");
  assert.equal(report.qualification.secondHostedQualificationRun, 31336503689);
  assert.equal(report.qualification.secondHostedQualificationResult,
    "FAILED_CLOSED_LIVE_IDENTITY_SUCCESSOR_AND_HISTORICAL_SCOPE");
  assert.equal(report.qualification.thirdHostedQualificationRun, 31337142274);
  assert.equal(report.qualification.thirdHostedQualificationResult, "FAILED_CLOSED_DETACHED_EXACT_MAIN_CHECKOUT");
  assert.equal(report.qualification.fourthHostedQualificationRun, 31337349444);
  assert.equal(report.qualification.fourthHostedQualificationResult,
    "FAILED_CLOSED_STALE_FOUNDER_ATTENDED_PACKAGE_SUCCESSOR");
  assert.equal(report.qualification.fifthHostedQualificationRun, 31337831024);
  assert.equal(report.qualification.fifthHostedQualificationResult,
    "FAILED_CLOSED_PRIVATE_WORKFLOW_PACKAGE_TEST_PATH");
  assert.equal(report.qualification.sixthHostedQualificationRun, 31340617780);
  assert.equal(report.qualification.sixthHostedQualificationResult,
    "FAILED_CLOSED_FINAL_RETENTION_SUCCESSORS_UNCOMPOSED");
  assert.equal(report.qualification.seventhHostedQualificationRun, 31341204771);
  assert.equal(report.qualification.seventhHostedQualificationResult,
    "FAILED_CLOSED_HISTORICAL_RETENTION_COORDINATOR_SUCCESSOR_UNCOMPOSED");
  assert.equal(report.qualification.focusedSuccessorVerification.dataCoordinatorTests, "121/121 PASS");
  assert.equal(report.qualification.focusedSuccessorVerification.intelligenceConsumerTests, "86/86 PASS");
  assert.equal(report.qualification.focusedSuccessorVerification.privateWorkflowV2Tests, "33/33 PASS");
  assert.equal(report.qualification.focusedSuccessorVerification.privateWorkflowGovernanceTests,
    "20/20 PASS");
  assert.equal(report.qualification.focusedSuccessorVerification
    .controlledRehearsalGovernanceTests, "14/14 PASS");
  assert.equal(report.qualification.exactFinalCommitHostedQualification,
    "EXACT_COMMIT_BOUND_WORKFLOW_REQUIRED_AND_FAIL_CLOSED");
  assert.equal(report.releaseBoundary.deploymentAuthorized, false);
  assert.equal(report.releaseBoundary.productionDeletionAuthorized, false);
  assert.equal(report.releaseBoundary.collectionActivationAuthorized, false);

  return Object.freeze({
    status: "PASS",
    batchId: governance.batchId,
    ownerCommitCount: Object.keys(ownerCommits).length,
    sourceRuntime: "COMPLETE_DORMANT",
    physicalDeletionActivated: false,
    productionStorageAccessed: false,
    productionDeletionPerformed: false,
    collection: "OFF",
    activeCohorts: 0,
    recommendationInfluence: "OFF",
    historicalEvidence: "UNCHANGED",
    forwardRevert: "VERIFIED_NOT_EXECUTED"
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  console.log(JSON.stringify(verifyOverwatchRouteIqRetentionDeletionRuntime(), null, 2));
}
