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
  assert.equal(result.rollbackArtifactSha256, "b0eae685ddefb99680bd60f074b58ae7514c467f6ce95d069e35dc450db2d76a");
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
  assert.equal(result.commits.length, 63);
  assert.deepEqual(result.commits.slice(0, 26), [
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
    "027366403b8f0ad40b4c51ca8679703ecf2341c3",
    "1e4e9be843fe418ae8920ccb109b4259fda5455c",
    "2595702c5c30ec269aee2694a81ea223fb2903e6",
    "bb0fe15841027a63ccbebfeeac21e5ead4d5e76c",
    "af2d85d80a1abf332e202a1d24ca0c290d9d6a6b",
    "06a6464035d3b8d46f308c77955a80a62ddfa957",
    "89f6e5c0e40d759289793fb6a6f1767a6888d6c4",
    "f26d35aaf612f4b89194d75fa721ce5cd3068b85",
    "5f33e24e1e61f4866f49f96669c9c54e80cbb099",
    "a69dd6ac8785f0906d1ad91e9ca156f5250dc22e",
    "0165ffc56a18408be5c2e970223944fa1dd02593",
    "41d9f1fa9273482261500708d7299a1997f6ec69",
    "12d229fb18549e42dba90b075efe70753ee22f0e"
  ]);
  assert.deepEqual(result.commits.slice(26, 33), [
    "3a2bd37f779e070b868256178bc40dbede8605c8",
    "38339cdf24f2ccdf54f2eb204278eb80d9ad1972",
    "577b9217185be2324824c5c4eeeaf6cd89300477",
    "13d221509c95515bb9a3dcc44326bf3393fff89e",
    "5d5ffe858d7e132778c96746eabd4a99afe9d1f4",
    "7b8ff3fdf0c9a75a6dc68ec7c47a039ec974d0d2",
    "5c920ad7c56289791d12c756d4b9627bf18b4632"
  ]);
  assert.deepEqual(result.commits.slice(33, 41), [
    "e896cabe19fc696834659ed1cbe05f027c434553",
    "f09b8c1ee6e4c0be14c41f672601e2e5854014eb",
    "d8da4f23a9df80f91e8f95bf80b7075e8d2532dc",
    "9a2c27da613f1222039c5a8ae583ce9f70d98056",
    "ba4d25df97e12852982e1bbdc2b1e89ef5265da1",
    "1cbb6aa1cadde1b4896990b3bb50d857d994071c",
    "4f28734a34b7dac10275ed2f9fc64345f7f5c815",
    "162b09a715381e2894a9a1469b8f1fc2cc47e5e8"
  ]);
  assert.deepEqual(result.commits.slice(41, 47), [
    "c0842d5ec44f4797e395e5f9fcb2b2ad720cfe40",
    "f0593640bae9cb9517d954415ca4980226a51073",
    "94061fea1c238ca854bde9d17a860e1375af9c52",
    "ce5f66f777fcfd6f59fe2b33eebb05bc836742dc",
    "c375c02652823a5a5c19a0f166d420da15ca3330",
    "4970dfad5ae5598551d4f1cf20bbb7e18a9a084f"
  ]);
  assert.deepEqual(result.commits.slice(47, 50), [
    "8aac9d66fa5b5d6ff191354e68a364aa142ede95",
    "d1e1aab1163ff3206cbdcd366b65db6f9b186982",
    "e2a79a3b2808dd229b117275c2ea0791b55c67ea"
  ]);
  assert.equal(result.commits[50], "9ec13294dd894f9a8aa449cea39be7f8c5f5cc2b");
  assert.equal(result.commits[51], "329db670b928b6d955ad0d851d9f73584bffcbb1");
  assert.equal(result.commits[52], "1eb66ceb578e72d0ceff0e68d9c8b4037e299f85");
  assert.equal(result.commits[53], "d562f62acf749685e099d4d7f572a4e06d69bc7b");
  assert.equal(result.commits[54], "ab480ba101bc314946879af5cdb7997bd8085b4d");
  assert.equal(result.commits[55], "3cf1dc03e3b9dabd02e35c81888feb2e34e0cd0a");
  assert.equal(result.commits[56], "07bf2eddc9707cb410ff6670efe9465ca68cd6b4");
  assert.equal(result.commits[57], "30c04aca19423f448b35218491d69ecc458367c7");
  assert.equal(result.commits[58], "ee80a44b8a28847d4a4acfc3fae8574697661edc");
  assert.equal(result.commits[59], "3743db6f883f44b6d1d1dd69bc1a9c79f6d8b6de");
  assert.equal(result.commits[60], "c3da99ebc1744d0e540719a78531ec983b18ebdb");
  assert.equal(result.commits[61], "19d27686408db1eaf3f33a2ed15c36827441f3ec");
  assert.equal(result.commits[62], result.head);
  assert.equal(result.commits.at(-1), result.head);
  assert.equal(result.deploymentAssetsSha256, "5fd9e497e7fe814aab6194b4302528c6cff0e243e76a3dd843738f1882cd8c15");
  assert.equal(result.rollbackContractSha256, "a1baf16aeb970c5b9c434e333781e98c968692b80be07004295333c5741bf1e2");
  assert.equal(result.rollbackBundleSha256, "b0eae685ddefb99680bd60f074b58ae7514c467f6ce95d069e35dc450db2d76a");
  assert.equal(result.founderVisualAcceptance, "ACCEPTED");
  assert.equal(result.predeploymentBatchId, "BATCH-20260720-001");
  assert.equal(result.authorizedCandidateCommit, "37f3c963174b6a26cf9685fe0919ccc3bbfd65c2");
  assert.equal(result.authorizedCandidateTree, "aa63fad16a927354f66378e47c96ea88611894a4");
  assert.equal(result.freshExactFounderAuthorizationRequired, true);
  assert.equal(result.safeCiPending, true);
  assert.equal(result.deploymentAuthorized, false);
});

test("Dashboard rollover and clean-runner Infrastructure repairs remain exact and test-only", () => {
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
    value.infrastructureOwnerRepairs[9].commit,
    "13d221509c95515bb9a3dcc44326bf3393fff89e"
  );
  assert.equal(value.infrastructureOwnerRepairs.at(-4).commit, "d1e1aab1163ff3206cbdcd366b65db6f9b186982");
  assert.equal(value.infrastructureOwnerRepairs.at(-3).commit, "3cf1dc03e3b9dabd02e35c81888feb2e34e0cd0a");
  assert.equal(value.infrastructureOwnerRepairs.at(-2).commit, "30c04aca19423f448b35218491d69ecc458367c7");
  assert.equal(value.infrastructureOwnerRepairs.at(-1).commit, "3743db6f883f44b6d1d1dd69bc1a9c79f6d8b6de");
  assert.equal(
    value.infrastructureEvidence.contractSha256,
    "3a36629b5aed90238e8b8257dbb3ec9820d74f4f3c40fce94248e349afd22b4e"
  );
  assert.equal(
    value.infrastructureEvidence.previousContractSha256,
    "09ffc8c9d631b0002bc84ae372924f3e75a677e65b85806d50d0c48c21f56b27"
  );
  assert.equal(value.infrastructureEvidence.contractSuccessorCommit, "3743db6f883f44b6d1d1dd69bc1a9c79f6d8b6de");
  assert.equal(value.infrastructureEvidence.contractSuccessorOwner, "Prometheus Infrastructure");
  assert.equal(
    value.infrastructureEvidence.deploymentContractSha256,
    "66875cbc292f9d0fcf9f2fd0cd29625e4b2d8ecb5854b931da876cd3ca770912"
  );
  assert.equal(value.infrastructureEvidence.ownerVerifierPinsCleanRunnerAssetGenerationSuccessor, true);
  assert.equal(value.infrastructureEvidence.ownerVerifierPinsKeychainCiPortabilitySuccessors, true);
  assert.equal(value.infrastructureEvidence.ownerVerifierPinsDashboardRuntimeHarnessSuccessors, true);
  assert.equal(value.infrastructureEvidence.ownerVerifierPinsDashboardRuntimeHarnessAdoptionSuccessor, true);
  assert.equal(value.infrastructureEvidence.ownerVerifierPinsSafeNoSecretAssetOrderingRepairSuccessor, true);
  assert.equal(value.infrastructureEvidence.ownerVerifierPinsSafeNoSecretFullSuiteWorkflow, true);
  assert.equal(value.infrastructureEvidence.ownerVerifierPinsCloudflareDeploymentReadRepairSuccessors, true);
  assert.equal(value.infrastructureEvidence.ownerVerifierPinsCloudflareDeploymentReadProvenanceAdmission, true);
  assert.equal(value.infrastructureEvidence.ownerVerifierPinsWranglerFailureDiagnosticSuccessor, true);
  assert.equal(value.infrastructureEvidence.ownerVerifierPinsWranglerFailureProvenanceAdmission, true);
  assert.equal(value.infrastructureEvidence.ownerVerifierPinsPublicWorkerStartupRepairSuccessors, true);
  assert.equal(value.infrastructureEvidence.ownerVerifierPinsPublicWorkerStartupProvenanceAdmission, true);
  assert.equal(value.infrastructureEvidence.ownerVerifierPinsPublicConfigConsumerRepairSuccessor, true);
  assert.equal(value.infrastructureEvidence.ownerVerifierPinsPublicConfigConsumerProvenanceAdmission, true);
  assert.equal(value.infrastructureEvidence.ownerVerifierPinsPublicDeploymentWorkflowV2Successors, true);
  assert.equal(value.keychainCiPortabilityClosure.failedDeploymentRun.runId, 29758138044);
  assert.equal(value.keychainCiPortabilityClosure.failedDeploymentRun.deploymentJobSkipped, true);
  assert.equal(value.keychainCiPortabilityClosure.successors.length, 4);
  assert.equal(
    value.keychainCiPortabilityClosure.successors.at(-1).commit,
    "f26d35aaf612f4b89194d75fa721ce5cd3068b85"
  );
  assert.equal(value.keychainCiPortabilityClosure.websiteImplementationChanged, false);
  assert.equal(value.keychainCiPortabilityClosure.deploymentAssetsChanged, false);
  assert.equal(value.historicalKeychainFixtureClosure.successors.length, 4);
  assert.equal(value.historicalKeychainFixtureClosure.ownerVerifierOwnershipTests, 6);
  assert.equal(value.historicalKeychainFixtureClosure.historicalFixtureCommitPreserved, true);
  assert.equal(value.historicalKeychainFixtureClosure.websiteImplementationChanged, false);
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
  assert.equal(value.dashboardRuntimeHarnessClosure.batchId, "BATCH-20260720-005");
  assert.equal(value.dashboardRuntimeHarnessClosure.failedDeploymentRun.runId, 29764135072);
  assert.deepEqual(
    value.dashboardRuntimeHarnessClosure.dashboardOwnerCommits.map(record => record.commit),
    [
      "38339cdf24f2ccdf54f2eb204278eb80d9ad1972",
      "577b9217185be2324824c5c4eeeaf6cd89300477"
    ]
  );
  assert.equal(
    value.dashboardRuntimeHarnessClosure.infrastructureAdoption.commit,
    "13d221509c95515bb9a3dcc44326bf3393fff89e"
  );
  assert.equal(value.dashboardRuntimeHarnessClosure.verification.focusedTestsPassed, 18);
  assert.equal(value.dashboardRuntimeHarnessClosure.verification.browserWorkflowChecksPassed, 185);
  assert.equal(value.dashboardRuntimeHarnessClosure.verification.performanceThresholdWeakened, false);
  assert.equal(value.dashboardRuntimeHarnessClosure.scope.websiteImplementationChanged, false);
  assert.equal(value.dashboardRuntimeHarnessClosure.scope.crmImplementationChanged, false);
  assert.equal(value.dashboardRuntimeHarnessClosure.scope.deploymentAssetsChanged, false);

  const broadened = integrityReadinessGovernance();
  broadened.dashboardVerificationRepair.generallyAuthorizesDashboardSuccessors = true;
  assert.throws(() => validatePublicIntegrityReadiness(broadened));
});

test("clean-runner closure preserves failed-run evidence and rejects the mixed-owner local commit", () => {
  const value = integrityReadinessGovernance();
  assert.equal(value.predeploymentClosure.batchId, "BATCH-20260720-003");
  assert.equal(value.predeploymentClosure.failedDeploymentRun.runId, 29723618108);
  assert.equal(value.predeploymentClosure.failedDeploymentRun.verificationJobId, 88291684567);
  assert.equal(value.predeploymentClosure.failedDeploymentRun.deploymentJobSkipped, true);
  assert.equal(value.predeploymentClosure.failedDeploymentRun.cloudflareContacted, false);
  assert.equal(value.predeploymentClosure.failedDeploymentRun.productionMutation, false);
  assert.equal(
    value.predeploymentClosure.rejectedLocalCommit.commit,
    "c7f8f80f0c64444efc1354f050dc304a9fd25ae1"
  );
  assert.equal(value.predeploymentClosure.rejectedLocalCommit.pushAllowed, false);
  assert.equal(value.predeploymentClosure.rejectedLocalCommit.mergeAllowed, false);
  assert.equal(value.predeploymentClosure.rejectedLocalCommit.deploymentAllowed, false);
  assert.equal(
    value.predeploymentClosure.ownerRepair.commit,
    "2595702c5c30ec269aee2694a81ea223fb2903e6"
  );
  assert.equal(value.predeploymentClosure.ownerRepair.owner, "Prometheus Infrastructure");
  assert.equal(value.predeploymentClosure.ownerRepair.binaryDiffEquivalentToRejectedCommit, true);
  assert.equal(value.predeploymentClosure.ownerRepair.websiteImplementationChanged, false);
  assert.equal(value.predeploymentClosure.ownerRepair.crmImplementationChanged, false);
  assert.equal(value.predeploymentClosure.ownerRepair.deploymentAssetsChanged, false);
  assert.equal(value.predeploymentClosure.ownerRepair.rollbackArtifactChanged, false);
  assert.equal(value.predeploymentClosure.ownerRepair.productionChanged, false);
  assert.equal(value.predeploymentClosure.freshExactFounderDeploymentAuthorizationRequired, true);

  const pushable = integrityReadinessGovernance();
  pushable.predeploymentClosure.rejectedLocalCommit.pushAllowed = true;
  assert.throws(() => validatePublicIntegrityReadiness(pushable));
});

test("failed safe CI is immutable, non-deploying evidence and requires a fresh run", () => {
  const value = integrityReadinessGovernance();
  assert.equal(value.safeNonDeploymentCi.latestRun.runId, 29776569151);
  assert.equal(value.safeNonDeploymentCi.latestRun.repositoryIntegrity, "PASS");
  assert.equal(value.safeNonDeploymentCi.latestRun.dependencyInstall, "PASS");
  assert.equal(value.safeNonDeploymentCi.latestRun.fullRepositorySuite, "FAIL");
  assert.equal(value.safeNonDeploymentCi.latestRun.ownerVerifier, "NOT_REACHED");
  assert.equal(value.safeNonDeploymentCi.latestRun.consumed, true);
  assert.equal(value.safeNonDeploymentCi.fullRepositorySuiteRequired, true);
  assert.equal(value.safeNonDeploymentCi.dashboardRuntimeHarnessRequired, true);
  assert.equal(
    value.safeNonDeploymentCi.workflowSha256,
    "025bbc2fa4802a737d85d40d1ab3c38334c9458fa29b19a78f9b151da8bcb4b9"
  );
  assert.equal(value.safeNonDeploymentCi.nextRunRequired, true);

  value.safeNonDeploymentCi.latestRun.deploymentCapability = true;
  assert.throws(() => validatePublicIntegrityReadiness(value));
});

test("safe no-secret asset ordering closure pins the owner repair and preserves release scope", () => {
  const value = integrityReadinessGovernance();
  assert.equal(value.safeNoSecretAssetOrderingClosure.batchId, "BATCH-20260720-006");
  assert.equal(value.safeNoSecretAssetOrderingClosure.failedSafeRun.runId, 29776569151);
  assert.equal(
    value.safeNoSecretAssetOrderingClosure.infrastructureRepair.commit,
    "7b8ff3fdf0c9a75a6dc68ec7c47a039ec974d0d2"
  );
  assert.equal(
    value.safeNoSecretAssetOrderingClosure.infrastructureRepair.owner,
    "Prometheus Infrastructure"
  );
  assert.equal(
    value.safeNoSecretAssetOrderingClosure.verification.deterministicBuildBeforeNpmTest,
    true
  );
  assert.equal(value.safeNoSecretAssetOrderingClosure.verification.topLevelBuildSteps, 1);
  assert.equal(value.safeNoSecretAssetOrderingClosure.verification.blanketRetryAdded, false);
  assert.equal(value.safeNoSecretAssetOrderingClosure.scope.websiteImplementationChanged, false);
  assert.equal(value.safeNoSecretAssetOrderingClosure.scope.crmImplementationChanged, false);

  const weakened = integrityReadinessGovernance();
  weakened.safeNoSecretAssetOrderingClosure.verification.failureHidden = true;
  assert.throws(() => validatePublicIntegrityReadiness(weakened));
});

test("Cloudflare deployment-read closure is classified, bounded, and preserves production", () => {
  const value = integrityReadinessGovernance();
  const closure = value.cloudflareDeploymentReadClosure;
  assert.equal(closure.batchId, "BATCH-20260720-007");
  assert.equal(closure.failedDeploymentRun.runId, 29780926642);
  assert.equal(closure.failedDeploymentRun.preDeploymentSmokePassed, true);
  assert.equal(closure.failedDeploymentRun.dryRunReached, false);
  assert.equal(closure.failedDeploymentRun.uploadReached, false);
  assert.equal(closure.failedDeploymentRun.publicVersionCreated, false);
  assert.equal(closure.failedDeploymentRun.rollbackRequired, false);
  assert.equal(closure.infrastructureOwnerCommits.length, 3);
  assert.equal(closure.verification.productionRequestTimeoutMs, 30000);
  assert.equal(closure.verification.testRequestTimeoutMaximumMs, 1000);
  assert.equal(closure.verification.maximumSerializedStateReads, 12);
  assert.equal(closure.verification.automaticRetries, 0);
  assert.equal(closure.verification.deploymentAttempts, 1);
  assert.equal(closure.verification.secretOutputAllowed, false);
  assert.equal(closure.scope.websiteImplementationChanged, false);
  assert.equal(closure.scope.crmImplementationChanged, false);
  assert.equal(closure.scope.deploymentAssetsChanged, false);

  const retried = integrityReadinessGovernance();
  retried.cloudflareDeploymentReadClosure.verification.automaticRetries = 1;
  assert.throws(() => validatePublicIntegrityReadiness(retried));

  const hidden = integrityReadinessGovernance();
  hidden.cloudflareDeploymentReadClosure.verification.unclassifiedBodyReadFailureAllowed = true;
  assert.throws(() => validatePublicIntegrityReadiness(hidden));
});

test("Wrangler deployment failure closure preserves the consumed attempt and adds safe diagnostics", () => {
  const value = integrityReadinessGovernance();
  const closure = value.wranglerDeploymentFailureClosure;
  assert.equal(closure.batchId, "BATCH-20260720-008");
  assert.equal(closure.consumedDeploymentRun.authorizationBatchId, "BATCH-20260720-007");
  assert.equal(closure.consumedDeploymentRun.runId, 29786701514);
  assert.equal(closure.consumedDeploymentRun.verificationPassed, true);
  assert.equal(closure.consumedDeploymentRun.dryRunPassed, true);
  assert.equal(closure.consumedDeploymentRun.deployChildExitedNonzero, true);
  assert.equal(closure.consumedDeploymentRun.matchingSuccessfulCloudflareMutationAuditEntries, 0);
  assert.equal(closure.consumedDeploymentRun.publicVersionUnchanged, true);
  assert.equal(closure.consumedDeploymentRun.privateVersionUnchanged, true);
  assert.equal(closure.consumedDeploymentRun.authorizationReusable, false);
  assert.equal(closure.evidenceReconciliation.currentRunFailureDimension, "UNCLASSIFIABLE_FROM_PRE_REPAIR_WRAPPER");
  assert.equal(closure.evidenceReconciliation.priorAssetAuditBatchId, "BATCH-20260720-006");
  assert.equal(closure.evidenceReconciliation.priorAssetAuditAttributedToCurrentRun, false);
  assert.equal(closure.infrastructureRepair.commit, "ba4d25df97e12852982e1bbdc2b1e89ef5265da1");
  assert.equal(closure.infrastructureProvenanceAdmission.commit, "1cbb6aa1cadde1b4896990b3bb50d857d994071c");
  assert.equal(closure.infrastructureProvenanceAdmission.exactSuccessorOnly, true);
  assert.equal(closure.infrastructureProvenanceAdmission.genericInfrastructureSuccessorsAllowed, false);
  assert.equal(closure.verification.wrapperRetries, 0);
  assert.equal(closure.verification.rawChildOutputAllowed, false);
  assert.equal(closure.verification.outputStringMaterializationAllowed, false);
  assert.equal(closure.verification.capturedOutputZeroized, true);
  assert.equal(closure.verification.secretDisclosureAllowed, false);
  assert.equal(closure.scope.websiteImplementationChanged, false);
  assert.equal(closure.scope.crmImplementationChanged, false);
  assert.equal(closure.scope.deploymentAssetsChanged, false);
  assert.equal(closure.releaseBoundary.deploymentPerformed, false);
  assert.equal(closure.releaseBoundary.freshExactFounderAuthorizationRequired, true);

  const retried = integrityReadinessGovernance();
  retried.wranglerDeploymentFailureClosure.verification.wrapperRetries = 1;
  assert.throws(() => validatePublicIntegrityReadiness(retried));

  const reassigned = integrityReadinessGovernance();
  reassigned.wranglerDeploymentFailureClosure.evidenceReconciliation.retroactiveReasonAssignmentAllowed = true;
  assert.throws(() => validatePublicIntegrityReadiness(reassigned));
});

test("public Worker startup closure pins the consumed attempt and exact owner repair chain", () => {
  const value = integrityReadinessGovernance();
  const closure = value.publicWorkerStartupFailureClosure;
  assert.equal(closure.batchId, "BATCH-20260720-009");
  assert.equal(closure.consumedDeploymentRun.authorizationBatchId, "BATCH-20260720-008");
  assert.equal(closure.consumedDeploymentRun.runId, 29795006056);
  assert.equal(closure.consumedDeploymentRun.verificationPassed, true);
  assert.equal(closure.consumedDeploymentRun.wranglerDeployAttempted, true);
  assert.equal(closure.consumedDeploymentRun.publicVersionCreated, false);
  assert.equal(closure.consumedDeploymentRun.publicCrmNamespaceCreated, false);
  assert.equal(closure.consumedDeploymentRun.productionMutation, false);
  assert.equal(closure.consumedDeploymentRun.authorizationReusable, false);
  assert.equal(closure.correctedClassification.actual, "WORKER_RUNTIME_STARTUP_REJECTED");
  assert.deepEqual(closure.correctedClassification.rootCauseSequence, [
    "WORKER_RUNTIME_FILESYSTEM_IMPORT_AT_MODULE_STARTUP",
    "INVALID_PUBLIC_EXPORT_SURFACE"
  ]);
  assert.deepEqual(closure.ownerRepairs.map(record => record.commit), [
    "f0593640bae9cb9517d954415ca4980226a51073",
    "94061fea1c238ca854bde9d17a860e1375af9c52",
    "ce5f66f777fcfd6f59fe2b33eebb05bc836742dc",
    "c375c02652823a5a5c19a0f166d420da15ca3330"
  ]);
  assert.deepEqual(closure.verification.publicEntryExports, ["default", "RouteIqRequestCrmCoordinator"]);
  assert.equal(closure.verification.workerdPreflightBeforeCloudflare, true);
  assert.equal(closure.verification.automaticRetries, 0);
  assert.equal(closure.verification.focusedDeploymentTestsPassed, 25);
  assert.equal(closure.verification.focusedIntelligenceTestsPassed, 5);
  assert.equal(closure.verification.repositoryIntegrityOwnerTestsPassed, 30);
  assert.equal(closure.contracts.deploymentAssetsSha256, "5fd9e497e7fe814aab6194b4302528c6cff0e243e76a3dd843738f1882cd8c15");
  assert.equal(closure.contracts.deterministicRollbackBundleSha256, "b0eae685ddefb99680bd60f074b58ae7514c467f6ce95d069e35dc450db2d76a");
  assert.equal(closure.scope.websiteImplementationChanged, false);
  assert.equal(closure.scope.crmImplementationChanged, false);
  assert.equal(closure.scope.publicWorkerRuntimeChanged, true);
  assert.equal(closure.scope.publicWorkerProductionChanged, false);
  assert.equal(closure.releaseBoundary.deploymentPerformed, false);
  assert.equal(closure.releaseBoundary.freshExactFounderAuthorizationRequired, true);

  const retried = integrityReadinessGovernance();
  retried.publicWorkerStartupFailureClosure.verification.automaticRetries = 1;
  assert.throws(() => validatePublicIntegrityReadiness(retried));

  const widened = integrityReadinessGovernance();
  widened.publicWorkerStartupFailureClosure.ownerRepairs[0].files.push("intelligence/unauthorized.mjs");
  assert.throws(() => validatePublicIntegrityReadiness(widened));
});

test("public config consumer closure preserves every edge and deployment boundary", () => {
  const value = integrityReadinessGovernance();
  const closure = value.publicConfigConsumerRepairClosure;
  assert.equal(closure.batchId, "BATCH-20260720-010");
  assert.equal(closure.triggeringVerification.head, "4970dfad5ae5598551d4f1cf20bbb7e18a9a084f");
  assert.equal(closure.triggeringVerification.classification, "STALE_PUBLIC_CONFIG_CONSUMER_PIN");
  assert.equal(closure.triggeringVerification.failureHidden, false);
  assert.deepEqual(closure.ownerRepairs.map(record => record.commit), [
    "8aac9d66fa5b5d6ff191354e68a364aa142ede95",
    "d1e1aab1163ff3206cbdcd366b65db6f9b186982"
  ]);
  assert.equal(closure.verification.onlyAdmittedSemanticChange, "main");
  assert.equal(closure.verification.workersDevOff, true);
  assert.equal(closure.verification.previewUrlsOff, true);
  assert.equal(closure.verification.apexAndWwwPreserved, true);
  assert.equal(closure.verification.accessAndWafBoundariesPreserved, true);
  assert.equal(closure.verification.crmClassBindingAndMigrationPreserved, true);
  assert.equal(closure.verification.publicPrivateIsolationPreserved, true);
  assert.equal(closure.verification.focusedEdgeTestsPassed, 7);
  assert.equal(closure.verification.repositoryIntegrityOwnerTestsPassed, 31);
  assert.equal(closure.verification.cloudflareContacted, false);
  assert.equal(closure.verification.deploymentPerformed, false);
  assert.equal(closure.overwatchConsumerAdmission.classification, "EXACT_INTELLIGENCE_STARTUP_PATH_ADMISSION");
  assert.equal(closure.overwatchConsumerAdmission.ownerRepairCommit, "f0593640bae9cb9517d954415ca4980226a51073");
  assert.equal(closure.overwatchConsumerAdmission.allowedPath, "intelligence/route-iq-prospective-retention-admission.mjs");
  assert.equal(closure.overwatchConsumerAdmission.otherIntelligencePathsAllowed, false);
  assert.equal(closure.overwatchTestAlignment.classification, "CURRENT_ROLLBACK_BUNDLE_EXPECTATION_ALIGNMENT");
  assert.equal(closure.overwatchTestAlignment.historicalRollbackEvidencePreserved, true);
  assert.equal(closure.overwatchTestAlignment.currentDeterministicRollbackBundleSha256, "b0eae685ddefb99680bd60f074b58ae7514c467f6ce95d069e35dc450db2d76a");
  assert.equal(closure.overwatchTestAlignment.testWeakened, false);
  assert.equal(closure.retentionConsumerAdmission.classification, "EXACT_INTELLIGENCE_RETENTION_RUNTIME_SUCCESSOR");
  assert.equal(closure.retentionConsumerAdmission.ownerRepairCommit, "f0593640bae9cb9517d954415ca4980226a51073");
  assert.equal(closure.retentionConsumerAdmission.retentionDecisionChanged, false);
  assert.equal(closure.retentionConsumerAdmission.policyHashChanged, false);
  assert.equal(closure.retentionConsumerAdmission.otherIntelligenceSuccessorsAllowed, false);
  assert.equal(
    closure.pausedUnattendedAccessAlignment.classification,
    "EXACT_INFRASTRUCTURE_PUBLIC_ADAPTER_SUCCESSOR_COUNT_ALIGNMENT"
  );
  assert.equal(
    closure.pausedUnattendedAccessAlignment.ownerRepairCommit,
    "94061fea1c238ca854bde9d17a860e1375af9c52"
  );
  assert.equal(closure.pausedUnattendedAccessAlignment.previousSubsystemSuccessorCount, 11);
  assert.equal(closure.pausedUnattendedAccessAlignment.currentSubsystemSuccessorCount, 12);
  assert.equal(closure.pausedUnattendedAccessAlignment.unattendedAccessResumed, false);
  assert.equal(closure.pausedUnattendedAccessAlignment.credentialOrRuntimeBehaviorChanged, false);
  assert.equal(closure.pausedUnattendedAccessAlignment.testWeakened, false);
  assert.equal(closure.contracts.edgeBoundarySha256, "8308c4a69d52667d192e943d9ef45d9875ca3bcb835561f3765ec7b56253e53d");
  assert.equal(closure.contracts.repositoryIntegritySha256, "3a36629b5aed90238e8b8257dbb3ec9820d74f4f3c40fce94248e349afd22b4e");
  assert.equal(closure.contracts.previousRepositoryIntegritySha256, "09ffc8c9d631b0002bc84ae372924f3e75a677e65b85806d50d0c48c21f56b27");
  assert.equal(closure.scope.websiteImplementationChanged, false);
  assert.equal(closure.scope.crmImplementationChanged, false);
  assert.equal(closure.scope.publicWorkerProductionChanged, false);
  assert.equal(closure.releaseBoundary.deploymentPerformed, false);
  assert.equal(closure.releaseBoundary.freshExactFounderAuthorizationRequired, true);

  const enabled = integrityReadinessGovernance();
  enabled.publicConfigConsumerRepairClosure.verification.workersDevOff = false;
  assert.throws(() => validatePublicIntegrityReadiness(enabled));

  const widened = integrityReadinessGovernance();
  widened.publicConfigConsumerRepairClosure.verification.onlyAdmittedSemanticChange = "all";
  assert.throws(() => validatePublicIntegrityReadiness(widened));

  const broadenedIntelligence = integrityReadinessGovernance();
  broadenedIntelligence.publicConfigConsumerRepairClosure.overwatchConsumerAdmission.otherIntelligencePathsAllowed = true;
  assert.throws(() => validatePublicIntegrityReadiness(broadenedIntelligence));

  const weakenedTest = integrityReadinessGovernance();
  weakenedTest.publicConfigConsumerRepairClosure.overwatchTestAlignment.testWeakened = true;
  assert.throws(() => validatePublicIntegrityReadiness(weakenedTest));

  const changedRetention = integrityReadinessGovernance();
  changedRetention.publicConfigConsumerRepairClosure.retentionConsumerAdmission.retentionDecisionChanged = true;
  assert.throws(() => validatePublicIntegrityReadiness(changedRetention));

  const resumedUnattended = integrityReadinessGovernance();
  resumedUnattended.publicConfigConsumerRepairClosure.pausedUnattendedAccessAlignment.unattendedAccessResumed = true;
  assert.throws(() => validatePublicIntegrityReadiness(resumedUnattended));
});

test("CRM public adapter repair is exact, owner-authored, and behavior-preserving", () => {
  const closure = integrityReadinessGovernance().crmPublicAdapterRepairClosure;
  assert.equal(closure.classification, "EXACT_CRM_ADAPTER_REPAIR_AND_INFRASTRUCTURE_PROVENANCE_ADMISSION");
  assert.equal(closure.crmOwnerRepair.commit, "ab480ba101bc314946879af5cdb7997bd8085b4d");
  assert.equal(closure.crmOwnerRepair.owner, "Prometheus CRM");
  assert.equal(closure.crmOwnerRepair.crmBehaviorChanged, false);
  assert.equal(closure.crmOwnerRepair.crmSchemaChanged, false);
  assert.equal(closure.infrastructureProvenanceAdmission.commit, "3cf1dc03e3b9dabd02e35c81888feb2e34e0cd0a");
  assert.equal(closure.infrastructureProvenanceAdmission.crmCommitSubstitutionAllowed, false);
  assert.equal(closure.infrastructureProvenanceAdmission.mixedOwnershipAllowed, false);
  assert.equal(closure.deploymentAssetsChanged, false);
  assert.equal(closure.rollbackArtifactsChanged, false);
  assert.equal(closure.productionChanged, false);

  const substituted = integrityReadinessGovernance();
  substituted.crmPublicAdapterRepairClosure.crmOwnerRepair.commit = "0".repeat(40);
  assert.throws(() => validatePublicIntegrityReadiness(substituted));
});

test("Dashboard harness closure cannot weaken performance or gain deployment capability", () => {
  const weakened = integrityReadinessGovernance();
  weakened.dashboardRuntimeHarnessClosure.verification.performanceThresholdWeakened = true;
  assert.throws(() => validatePublicIntegrityReadiness(weakened));

  const deploying = integrityReadinessGovernance();
  deploying.dashboardRuntimeHarnessClosure.verification.safeWorkflowCanDeploy = true;
  assert.throws(() => validatePublicIntegrityReadiness(deploying));

  const staleWorkflow = integrityReadinessGovernance();
  staleWorkflow.safeNonDeploymentCi.workflowSha256 = "0".repeat(64);
  assert.throws(() => validatePublicIntegrityReadiness(staleWorkflow));
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
