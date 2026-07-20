import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  GOVERNANCE_PATH,
  validatePublicCrmReadinessGovernance,
  verifyOverwatchPublicCrmFounderAccessDeploymentReadiness
} from "../scripts/verify-overwatch-route-iq-public-crm-founder-access-deployment-readiness.mjs";
import {
  REVISED_3D_READINESS_SUCCESSOR_PATH,
  validateRevised3dReadinessSuccessor,
  verifyOverwatchRevised3dReleaseReadinessSuccessor
} from "../scripts/verify-overwatch-route-iq-revised-3d-release-readiness-successor.mjs";
import {
  PUBLIC_INTEGRITY_READINESS_PATH,
  validatePublicIntegrityReadiness,
  verifyOverwatchPublicDeploymentIntegrityRepairReadiness
} from "../scripts/verify-overwatch-route-iq-public-deployment-integrity-repair-readiness.mjs";

function governance() {
  return JSON.parse(readFileSync(GOVERNANCE_PATH, "utf8"));
}

function successorGovernance() {
  return JSON.parse(readFileSync(REVISED_3D_READINESS_SUCCESSOR_PATH, "utf8"));
}

function integrityReadinessGovernance() {
  return JSON.parse(readFileSync(PUBLIC_INTEGRITY_READINESS_PATH, "utf8"));
}

test("Overwatch independently verifies owner provenance and the public CRM release boundary", () => {
  const result = verifyOverwatchPublicCrmFounderAccessDeploymentReadiness();
  assert.equal(result.ok, true);
  assert.equal(result.batchId, "BATCH-20260719-005");
  assert.deepEqual(result.infrastructureCommits, [
    "2be88021bfc9107c200a2fef5fd065da875e52c6",
    "d9c1b3322c5ad2fb12f3ae5dbfc7f42e807d61a8",
    "1791728ad6a6777e828220dac6a7e93b207f95bc",
    "1490d4722867a5e203eb159ffbaf01c9645fb127"
  ]);
  assert.deepEqual(result.excludedCommits, [
    "0aac4732670bde05596c1c8cde60c533172663f7",
    "5a3339f465cbcd81b1c7eeca5c9d384afbcf4d1c"
  ]);
  assert.equal(result.status, "CANDIDATE_READY_FOR_SAFE_NON_DEPLOYMENT_CI");
  assert.equal(result.authoritativeSuccessorBatchId, "BATCH-20260719-008");
  assert.equal(result.historicalClassification, "HISTORICAL_RECONSTRUCTION_EVIDENCE_SUPERSEDED_NON_DEPLOYABLE");
  assert.equal(result.rollbackArtifactSha256, "3c1991905657516653ee74ef0ac59f711b21f95df06bf490be5f370479ba7ff7");
  assert.equal(result.historicalRollbackArtifactSha256, "4636e18bd3d99a803803a7ab78dcd2dbf634de8d9e34386c5c43f4df6fcb1ad1");
});

test("historical revised 3D successor remains pinned to the consumed deployment attempt", () => {
  const result = verifyOverwatchRevised3dReleaseReadinessSuccessor();
  assert.equal(result.batchId, "BATCH-20260719-007");
  assert.equal(result.protectedImplementationCommit, "cbe50718e45faf1be264de59ae1c1990f5c8d7da");
  assert.equal(result.protectedImplementationTree, "43f5989cad0db36701c8e092bcaa7038d7aa44ad");
  assert.equal(result.deploymentAssetsSha256, "5fd9e497e7fe814aab6194b4302528c6cff0e243e76a3dd843738f1882cd8c15");
  assert.equal(result.rollbackContractSha256, "150d24acaeee5f1f6589bb92582fc701e7480cca22d5bd136ce0f27af4fc220b");
  assert.equal(result.rollbackBundleSha256, "381b471ed3fa0a1fdab0b612600be2f2b6e77b45d3b9c02418a056e0eb500b5a");
  assert.equal(result.historicalSuccessorCommit, "d5174c50ee7b02f930b5fa1f50723ce9db3e447d");
  assert.equal(result.historicalSuccessorTree, "f86156dc10fb90cedc00274d3654e89edfff562a");
  assert.equal(result.founderVisualAcceptance, "ACCEPTED");
  assert.equal(result.deploymentAuthorized, false);
});

test("integrity repair successor pins the current rollback identity and safe-CI boundary", () => {
  const result = verifyOverwatchPublicDeploymentIntegrityRepairReadiness();
  assert.equal(result.batchId, "BATCH-20260719-008");
  assert.equal(result.status, "CANDIDATE_READY_FOR_SAFE_NON_DEPLOYMENT_CI");
  assert.equal(result.commits.length, 15);
  assert.deepEqual(result.commits.slice(0, 14), [
    "a2bcfedcd996e4d6d22adc26d20bd77a39e763e7",
    "a2779239fc8f2d79d4b8781966d32cc23d4acbbd",
    "96af76e8094beafc2de455ebb5d80755c0160a2e",
    "a23ac70a74f753486cc6ceda8eddeedfa187f5c5",
    "8d312bf747a289c675eb37adf582b43c860c635e",
    "1363548cb72285cdd759b1dbed73fa6a8a3d1c2a",
    "03ed86e25bda0a67e55757969966f4bc61c4b63e",
    "bb1509d42cd03c19b9db0f9011579b6a041ffd9c",
    "a377c39f2e4c8f7f68a8f5908f133f9c24c7ac54",
    "37f3c963174b6a26cf9685fe0919ccc3bbfd65c2",
    "c05c92930f33ca2f50362c1ad3c35efc95a645f0",
    "6476c381c8e9512eaea4a90e0f6019138cfe1766",
    "c0c35e83901aad5b8f4108a2a6b09b6210cb5243",
    "027366403b8f0ad40b4c51ca8679703ecf2341c3"
  ]);
  assert.equal(result.deploymentAssetsSha256, "5fd9e497e7fe814aab6194b4302528c6cff0e243e76a3dd843738f1882cd8c15");
  assert.equal(result.rollbackContractSha256, "150d24acaeee5f1f6589bb92582fc701e7480cca22d5bd136ce0f27af4fc220b");
  assert.equal(result.rollbackBundleSha256, "3c1991905657516653ee74ef0ac59f711b21f95df06bf490be5f370479ba7ff7");
  assert.equal(result.founderVisualAcceptance, "ACCEPTED");
  assert.equal(result.predeploymentBatchId, "BATCH-20260720-001");
  assert.equal(result.authorizedCandidateCommit, "37f3c963174b6a26cf9685fe0919ccc3bbfd65c2");
  assert.equal(result.authorizedCandidateTree, "aa63fad16a927354f66378e47c96ea88611894a4");
  assert.equal(result.freshExactFounderAuthorizationRequired, true);
  assert.equal(result.safeCiPending, true);
  assert.equal(result.deploymentAuthorized, false);
});

test("Dashboard rollover repair and Infrastructure admission remain exact and test-only", () => {
  const value = integrityReadinessGovernance();
  assert.deepEqual(value.dashboardVerificationRepair.files, [
    "scripts/verify-dashboard-runtime-workflows.mjs",
    "tests/dashboard-route-iq-product-focus.test.mjs"
  ]);
  assert.equal(value.dashboardVerificationRepair.commit, "bb1509d42cd03c19b9db0f9011579b6a041ffd9c");
  assert.equal(value.dashboardVerificationRepair.browserWorkflowChecksPassed, 184);
  assert.equal(value.dashboardVerificationRepair.focusedTestsPassed, 8);
  assert.equal(value.dashboardVerificationRepair.productRuntimeModified, false);
  assert.equal(value.dashboardVerificationRepair.generatedDeploymentAssetsModified, false);
  assert.equal(value.dashboardVerificationRepair.generallyAuthorizesDashboardSuccessors, false);
  assert.equal(
    value.infrastructureOwnerRepairs[4].commit,
    "a377c39f2e4c8f7f68a8f5908f133f9c24c7ac54"
  );
  assert.equal(
    value.infrastructureOwnerRepairs.at(-1).commit,
    "c0c35e83901aad5b8f4108a2a6b09b6210cb5243"
  );
  assert.equal(
    value.infrastructureEvidence.contractSha256,
    "701c96666a2783df872028262c314c3b83f378f7d32df2942a6d15a80631bbb6"
  );
  assert.deepEqual(
    value.predeploymentSmokeRepair.ownerCommits.map(record => record.commit),
    [
      "c05c92930f33ca2f50362c1ad3c35efc95a645f0",
      "6476c381c8e9512eaea4a90e0f6019138cfe1766",
      "c0c35e83901aad5b8f4108a2a6b09b6210cb5243"
    ]
  );
  assert.equal(value.predeploymentSmokeRepair.scope.websiteImplementationChanged, false);
  assert.equal(value.predeploymentSmokeRepair.scope.crmImplementationChanged, false);
  assert.equal(value.predeploymentSmokeRepair.scope.generatedDeploymentAssetsChanged, false);
  assert.equal(value.predeploymentSmokeRepair.authorizationBoundary.originalExactAuthorizationReusable, false);
  assert.equal(value.predeploymentSmokeRepair.authorizationBoundary.freshExactFounderAuthorizationRequired, true);

  const broadened = integrityReadinessGovernance();
  broadened.dashboardVerificationRepair.generallyAuthorizesDashboardSuccessors = true;
  assert.throws(() => validatePublicIntegrityReadiness(broadened));
});

test("failed safe CI is immutable, non-deploying evidence and requires a fresh run", () => {
  const value = integrityReadinessGovernance();
  assert.equal(value.safeNonDeploymentCi.latestRun.runId, 29717192952);
  assert.equal(value.safeNonDeploymentCi.latestRun.repositoryIntegrity, "PASS");
  assert.equal(value.safeNonDeploymentCi.latestRun.ownerVerifier, "FAIL");
  assert.equal(value.safeNonDeploymentCi.latestRun.consumed, true);
  assert.equal(value.safeNonDeploymentCi.nextRunRequired, true);

  value.safeNonDeploymentCi.latestRun.deploymentCapability = true;
  assert.throws(() => validatePublicIntegrityReadiness(value));
});

test("integrity repair readiness cannot authorize deployment or reuse the consumed attempt", () => {
  const deployment = integrityReadinessGovernance();
  deployment.releaseBoundary.deploymentAuthorized = true;
  assert.throws(() => validatePublicIntegrityReadiness(deployment));

  const reused = integrityReadinessGovernance();
  reused.releaseBoundary.failedDeploymentAuthorizationReusable = true;
  assert.throws(() => validatePublicIntegrityReadiness(reused));

  const transferred = integrityReadinessGovernance();
  transferred.predeploymentSmokeRepair.authorizationBoundary.authorizationTransfersToSuccessorHead = true;
  assert.throws(() => validatePublicIntegrityReadiness(transferred));

  const rollback = integrityReadinessGovernance();
  rollback.releaseIdentities.deterministicForwardRollbackBundleSha256 = "0".repeat(64);
  assert.throws(() => validatePublicIntegrityReadiness(rollback));
});

test("historical readiness evidence cannot become executable deployment authority", () => {
  const executableHistorical = successorGovernance();
  executableHistorical.historicalReadinessRecord.executableDeploymentAuthority = true;
  assert.throws(
    () => validateRevised3dReadinessSuccessor(executableHistorical),
    /Expected values to be strictly equal/u
  );

  const currentHistoricalHash = successorGovernance();
  currentHistoricalHash.historicalReadinessRecord.historicalRollbackIdentityIsCurrent = true;
  assert.throws(
    () => validateRevised3dReadinessSuccessor(currentHistoricalHash),
    /Expected values to be strictly equal/u
  );

  const missingClassification = successorGovernance();
  missingClassification.historicalReadinessRecord.classification.pop();
  assert.throws(
    () => validateRevised3dReadinessSuccessor(missingClassification),
    /Expected values to be strictly deep-equal/u
  );
});

test("release reconstruction fails closed on ownership, archive, or implementation-loss drift", () => {
  const mixedOwnership = governance();
  mixedOwnership.recovery.mixedOwnershipPresent = true;
  assert.throws(() => validatePublicCrmReadinessGovernance(mixedOwnership), /release reconstruction integrity/u);

  const implementationLoss = governance();
  implementationLoss.recovery.noIntendedImplementationLost = false;
  assert.throws(() => validatePublicCrmReadinessGovernance(implementationLoss), /release reconstruction integrity/u);

  const pushableArchive = governance();
  pushableArchive.recovery.archivalEvidence.pushAllowed = true;
  assert.throws(() => validatePublicCrmReadinessGovernance(pushableArchive), /archive isolation drifted/u);

  const alteredHash = governance();
  alteredHash.recovery.infrastructureRepairComparison.files["scripts/lib/route-iq-public-forward-rollback.mjs"] = "0".repeat(64);
  assert.throws(() => validatePublicCrmReadinessGovernance(alteredHash), /reconstructed file evidence drifted/u);
});

test("Everyone, Bypass, and display-name Founder authorization fail closed", () => {
  for (const field of ["everyoneAllowed", "bypassAllowed", "displayNameAllowed"]) {
    const value = governance();
    value.cloudflareAccess.policy[field] = true;
    assert.throws(() => validatePublicCrmReadinessGovernance(value), /broad Founder authorization/u);
  }
});

test("public website and request intake cannot be pulled behind Founder Access", () => {
  for (const field of ["publicWebsiteRemainsPublic", "publicRequestSubmissionRemainsPublic"]) {
    const value = governance();
    value.cloudflareAccess[field] = false;
    assert.throws(() => validatePublicCrmReadinessGovernance(value), /HTTP boundary drifted/u);
  }
});

test("deployment and smoke controls reject private targeting, concurrency, and write methods", () => {
  const privateTarget = governance();
  privateTarget.deploymentControl.privateWorkerDeploymentAllowed = true;
  assert.throws(() => validatePublicCrmReadinessGovernance(privateTarget), /private Worker deployment/u);

  const concurrent = governance();
  concurrent.deploymentControl.simultaneousDeploymentsAllowed = true;
  assert.throws(() => validatePublicCrmReadinessGovernance(concurrent), /deployment attempt guard/u);

  const writeSmoke = governance();
  writeSmoke.deploymentControl.smokeMethods.push("POST");
  assert.throws(() => validatePublicCrmReadinessGovernance(writeSmoke), /smoke contract permits writes/u);
});
