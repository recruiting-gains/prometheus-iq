#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { verifyPublicForwardRollbackArtifact } from "./lib/route-iq-public-forward-rollback.mjs";
import { verifyOverwatchRevised3dReleaseReadinessSuccessor } from "./verify-overwatch-route-iq-revised-3d-release-readiness-successor.mjs";
import { verifyRouteIqPublicDeploymentAssets } from "./verify-route-iq-public-deployment-assets.mjs";
import { verifyRouteIqPublicRepositoryIntegrityRepair } from "./verify-route-iq-public-repository-integrity-repair.mjs";

export const PUBLIC_INTEGRITY_READINESS_PATH =
  "overwatch/governance/route-iq-public-deployment-integrity-repair-readiness-v1.json";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const HISTORICAL_SUCCESSOR_PATH =
  "overwatch/governance/route-iq-revised-3d-release-readiness-successor-v1.json";
const INFRASTRUCTURE_CONTRACT_PATH =
  "workers/infrastructure/route-iq-public-repository-integrity-repair-v1.json";
const ROLLBACK_CONTRACT_PATH = "workers/infrastructure/route-iq-public-forward-rollback-v1.json";
const HISTORICAL_SUCCESSOR_SHA256 = "aea011a5633a3d666f7bc402d6d7cfa38884833c1ce4ca3d6a6cdc84c4d27f75";
const INFRASTRUCTURE_CONTRACT_SHA256 = "7622f01b313302c866e7c52a919aaa5993bb4662346edb3c5367db8a618cebf7";
const ROLLBACK_CONTRACT_SHA256 = "150d24acaeee5f1f6589bb92582fc701e7480cca22d5bd136ce0f27af4fc220b";
const DEPLOYMENT_ASSETS_SHA256 = "5fd9e497e7fe814aab6194b4302528c6cff0e243e76a3dd843738f1882cd8c15";
const ROLLBACK_BUNDLE_SHA256 = "3c1991905657516653ee74ef0ac59f711b21f95df06bf490be5f370479ba7ff7";
const HISTORICAL_SUCCESSOR_COMMIT = "d5174c50ee7b02f930b5fa1f50723ce9db3e447d";
const HISTORICAL_SUCCESSOR_TREE = "f86156dc10fb90cedc00274d3654e89edfff562a";
const INFRASTRUCTURE_COMMITS = Object.freeze([
  Object.freeze({
    commit: "a2bcfedcd996e4d6d22adc26d20bd77a39e763e7",
    tree: "8b5202428cfdb6a3586bdc90f39cce4d3ea02e97",
    parent: HISTORICAL_SUCCESSOR_COMMIT,
    subject: "infrastructure: repair public repository integrity diagnostics",
    files: Object.freeze([
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
      INFRASTRUCTURE_CONTRACT_PATH
    ])
  }),
  Object.freeze({
    commit: "a2779239fc8f2d79d4b8781966d32cc23d4acbbd",
    tree: "025d3d01cae56753f9d0c5e63af5ea369a52b4ff",
    parent: "a2bcfedcd996e4d6d22adc26d20bd77a39e763e7",
    subject: "infrastructure: pin safe integrity diagnostic runtime",
    files: Object.freeze([
      ".github/workflows/verify-prometheus-public-repository-integrity.yml",
      "docs/route-iq-public-repository-integrity-repair-v1.md",
      "scripts/verify-route-iq-public-repository-integrity-repair.mjs",
      "tests/public-repository-integrity-repair.test.mjs",
      INFRASTRUCTURE_CONTRACT_PATH
    ])
  }),
  Object.freeze({
    commit: "a23ac70a74f753486cc6ceda8eddeedfa187f5c5",
    tree: "b2b1d3058cc2002bf2f1432b8d6cd05c6a84d7a1",
    parent: "96af76e8094beafc2de455ebb5d80755c0160a2e",
    subject: "infrastructure: constrain repository integrity owner boundary",
    files: Object.freeze([
      "docs/route-iq-public-repository-integrity-repair-v1.md",
      "scripts/verify-route-iq-public-repository-integrity-repair.mjs",
      "tests/public-repository-integrity-repair.test.mjs",
      INFRASTRUCTURE_CONTRACT_PATH
    ])
  }),
  Object.freeze({
    commit: "1363548cb72285cdd759b1dbed73fa6a8a3d1c2a",
    tree: "5cef523d23b28088bcf7b05561a4bac3784e364b",
    parent: "8d312bf747a289c675eb37adf582b43c860c635e",
    subject: "infrastructure: repair public integrity verifier portability",
    files: Object.freeze([
      "docs/route-iq-public-repository-integrity-repair-v1.md",
      "scripts/lib/route-iq-public-forward-rollback.mjs",
      "scripts/verify-route-iq-public-repository-integrity-repair.mjs",
      "tests/public-repository-integrity-repair.test.mjs",
      INFRASTRUCTURE_CONTRACT_PATH
    ])
  }),
  Object.freeze({
    commit: "a377c39f2e4c8f7f68a8f5908f133f9c24c7ac54",
    tree: "73337f6bfb2e29e62df0a98a10e928df578e14fa",
    parent: "bb1509d42cd03c19b9db0f9011579b6a041ffd9c",
    subject: "infrastructure: admit Dashboard verification successor",
    files: Object.freeze([
      "docs/route-iq-public-repository-integrity-repair-v1.md",
      "scripts/verify-route-iq-public-repository-integrity-repair.mjs",
      "tests/public-repository-integrity-repair.test.mjs",
      INFRASTRUCTURE_CONTRACT_PATH
    ])
  }),
  Object.freeze({
    commit: "c05c92930f33ca2f50362c1ad3c35efc95a645f0",
    tree: "1e75df8788becfd8b1bfd3fa1d1505a7492e2b01",
    parent: "37f3c963174b6a26cf9685fe0919ccc3bbfd65c2",
    subject: "infrastructure: accept strict public intake Allow set",
    files: Object.freeze([
      "scripts/run-cloudflare-public-worker-smoke.mjs",
      "scripts/verify-github-actions-public-worker-deployment.mjs",
      "tests/github-actions-public-worker-deployment.test.mjs"
    ])
  }),
  Object.freeze({
    commit: "6476c381c8e9512eaea4a90e0f6019138cfe1766",
    tree: "16918f0b77ae5ac7d1697b8f324d77e90b0ae50f",
    parent: "c05c92930f33ca2f50362c1ad3c35efc95a645f0",
    subject: "infrastructure: validate intake Allow by probe method",
    files: Object.freeze([
      "scripts/run-cloudflare-public-worker-smoke.mjs",
      "scripts/verify-github-actions-public-worker-deployment.mjs",
      "tests/github-actions-public-worker-deployment.test.mjs"
    ])
  }),
  Object.freeze({
    commit: "c0c35e83901aad5b8f4108a2a6b09b6210cb5243",
    tree: "10ed7ef01d3118c5cd13ad57a767d234c7d0f365",
    parent: "6476c381c8e9512eaea4a90e0f6019138cfe1766",
    subject: "infrastructure: admit public intake smoke successors",
    files: Object.freeze([
      "docs/route-iq-public-repository-integrity-repair-v1.md",
      "scripts/verify-route-iq-public-repository-integrity-repair.mjs",
      "tests/public-repository-integrity-repair.test.mjs",
      INFRASTRUCTURE_CONTRACT_PATH
    ])
  }),
  Object.freeze({
    commit: "2595702c5c30ec269aee2694a81ea223fb2903e6",
    tree: "926a4421088fab0071eaba943bae544be2877178",
    parent: "1e4e9be843fe418ae8920ccb109b4259fda5455c",
    subject: "infrastructure: generate public assets before verification",
    files: Object.freeze([
      ".github/workflows/deploy-prometheus-public-worker.yml",
      "docs/github-actions-founder-triggered-public-worker-deployment-v1.md",
      "docs/route-iq-public-repository-integrity-repair-v1.md",
      "scripts/lib/github-actions-public-worker-deployment.mjs",
      "scripts/verify-github-actions-public-worker-deployment.mjs",
      "scripts/verify-route-iq-public-repository-integrity-repair.mjs",
      "tests/github-actions-public-worker-deployment.test.mjs",
      "tests/public-repository-integrity-repair.test.mjs",
      "workers/infrastructure/github-actions-founder-triggered-public-worker-deployment-v1.json",
      INFRASTRUCTURE_CONTRACT_PATH
    ])
  })
]);
const FIRST_OVERWATCH_SUCCESSOR = Object.freeze({
  commit: "96af76e8094beafc2de455ebb5d80755c0160a2e",
  tree: "464118922a37710452ec85009df24007e9a4ffdf",
  parent: "a2779239fc8f2d79d4b8781966d32cc23d4acbbd",
  subject: "overwatch: record public integrity repair readiness"
});
const FIRST_OVERWATCH_SUCCESSOR_PATHS = Object.freeze([
  PUBLIC_INTEGRITY_READINESS_PATH,
  "scripts/verify-overwatch-route-iq-3d-visual-continuity.mjs",
  "scripts/verify-overwatch-route-iq-public-crm-founder-access-deployment-readiness.mjs",
  "scripts/verify-overwatch-route-iq-public-deployment-integrity-repair-readiness.mjs",
  "scripts/verify-overwatch-route-iq-revised-3d-release-readiness-successor.mjs",
  "tests/overwatch-route-iq-3d-visual-continuity.test.mjs",
  "tests/overwatch-route-iq-public-crm-founder-access-deployment-readiness.test.mjs"
]);
const SECOND_OVERWATCH_SUCCESSOR = Object.freeze({
  commit: "8d312bf747a289c675eb37adf582b43c860c635e",
  tree: "36f163193fdb91cf241ddb0ff03bce200c7506c6",
  parent: "a23ac70a74f753486cc6ceda8eddeedfa187f5c5",
  subject: "overwatch: close public integrity repair provenance"
});
const SECOND_OVERWATCH_SUCCESSOR_PATHS = Object.freeze([
  PUBLIC_INTEGRITY_READINESS_PATH,
  "scripts/verify-overwatch-route-iq-public-deployment-integrity-repair-readiness.mjs",
  "tests/overwatch-route-iq-public-crm-founder-access-deployment-readiness.test.mjs"
]);
const THIRD_OVERWATCH_SUCCESSOR = Object.freeze({
  commit: "03ed86e25bda0a67e55757969966f4bc61c4b63e",
  tree: "f4447bf0a001aa2659c90b36838897b0780c9aec",
  parent: "1363548cb72285cdd759b1dbed73fa6a8a3d1c2a",
  subject: "overwatch: record public integrity portability successor"
});
const FOURTH_OVERWATCH_SUCCESSOR = Object.freeze({
  commit: "37f3c963174b6a26cf9685fe0919ccc3bbfd65c2",
  tree: "aa63fad16a927354f66378e47c96ea88611894a4",
  parent: "a377c39f2e4c8f7f68a8f5908f133f9c24c7ac54",
  subject: "overwatch: close public integrity verification provenance"
});
const FIFTH_OVERWATCH_SUCCESSOR = Object.freeze({
  commit: "027366403b8f0ad40b4c51ca8679703ecf2341c3",
  tree: "d37446a031638cd145c9bf87943fa9b3660c7d0c",
  parent: "c0c35e83901aad5b8f4108a2a6b09b6210cb5243",
  subject: "overwatch: record public predeployment smoke repair"
});
const SIXTH_OVERWATCH_SUCCESSOR = Object.freeze({
  commit: "1e4e9be843fe418ae8920ccb109b4259fda5455c",
  tree: "e0d86821386d2f3d348eb88ae25f85f367878280",
  parent: FIFTH_OVERWATCH_SUCCESSOR.commit,
  subject: "overwatch: repair public predeployment test pin"
});
const DASHBOARD_VERIFICATION_SUCCESSOR = Object.freeze({
  commit: "bb1509d42cd03c19b9db0f9011579b6a041ffd9c",
  tree: "2bd8186faafd7c922c17da9401c6dddbc64163bb",
  parent: THIRD_OVERWATCH_SUCCESSOR.commit,
  subject: "dashboard: stabilize Eventbrite expansion verification",
  files: Object.freeze([
    "scripts/verify-dashboard-runtime-workflows.mjs",
    "tests/dashboard-route-iq-product-focus.test.mjs"
  ])
});
const FINAL_OVERWATCH_SUCCESSOR_PATHS = Object.freeze([
  PUBLIC_INTEGRITY_READINESS_PATH,
  "scripts/verify-overwatch-route-iq-public-deployment-integrity-repair-readiness.mjs",
  "tests/overwatch-route-iq-public-crm-founder-access-deployment-readiness.test.mjs"
]);
const HISTORICAL_CLASSIFICATION = Object.freeze([
  "DEPLOYMENT_ATTEMPT_CONSUMED",
  "HISTORICAL_READINESS_EVIDENCE",
  "NOT_REUSABLE_FOR_DEPLOYMENT",
  "SUPERSEDED_BY_INTEGRITY_REPAIR"
]);

const read = (root, path) => readFileSync(resolve(root, path));
const readJson = (root, path) => JSON.parse(read(root, path).toString("utf8"));
const sha256 = value => createHash("sha256").update(value).digest("hex");
const sorted = values => [...values].sort((left, right) => left.localeCompare(right));

function git(root, ...args) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_TERMINAL_PROMPT: "0"
    },
    maxBuffer: 8 * 1024 * 1024,
    timeout: 30_000
  }).trim();
}

function commitRecord(root, commit) {
  const [author, committer, subject] = git(root, "show", "-s", "--format=%ae%n%ce%n%s", commit).split("\n");
  const files = git(root, "diff-tree", "--no-commit-id", "--name-only", "-r", commit)
    .split("\n")
    .filter(Boolean);
  return { author, committer, subject, files };
}

export function validatePublicIntegrityReadiness(governance) {
  assert.equal(governance?.governanceId, "route-iq-public-deployment-integrity-repair-readiness-v1");
  assert.equal(governance?.version, "1.4.0");
  assert.equal(governance?.batchId, "BATCH-20260719-008");
  assert.equal(governance?.ownerSubsystem, "Prometheus Overwatch");
  assert.equal(governance?.status, "CANDIDATE_READY_FOR_SAFE_NON_DEPLOYMENT_CI");

  const historical = governance?.historicalReadiness;
  assert.equal(historical?.path, HISTORICAL_SUCCESSOR_PATH);
  assert.equal(historical?.sha256, HISTORICAL_SUCCESSOR_SHA256);
  assert.equal(historical?.commit, HISTORICAL_SUCCESSOR_COMMIT);
  assert.equal(historical?.tree, HISTORICAL_SUCCESSOR_TREE);
  assert.deepEqual(sorted(historical?.classification || []), HISTORICAL_CLASSIFICATION);
  assert.equal(historical?.founderVisualAcceptancePreserved, true);
  assert.equal(historical?.rewritten, false);

  assert.equal(governance?.failedRun?.runId, 29714512987);
  assert.equal(governance?.failedRun?.verificationJobId, 88264893824);
  assert.equal(governance?.failedRun?.deploymentJobId, 88264927103);
  assert.equal(governance?.failedRun?.reportedClassification, "REPOSITORY_INTEGRITY_FAILED");
  assert.equal(governance?.failedRun?.actualFailureStage, "ROLLBACK_ARTIFACT_VERIFICATION_BEFORE_GIT_FSCK");
  assert.equal(governance?.failedRun?.suppressedDiagnostic, "ROLLBACK_HASH_MISMATCH");
  assert.equal(governance?.failedRun?.previouslySuppressedGitFsckDiagnostic, "NONE_FSCK_NOT_REACHED");
  assert.equal(governance?.failedRun?.gitFsckExecuted, false);
  assert.equal(governance?.failedRun?.deploymentJobSkipped, true);
  assert.equal(governance?.failedRun?.protectedEnvironmentAccessed, false);
  assert.equal(governance?.failedRun?.cloudflareContacted, false);
  assert.equal(governance?.failedRun?.artifactsProduced, 0);

  assert.equal(governance?.rootCause?.classification, "CHECKOUT_DEPENDENT_ROLLBACK_IDENTITY_AND_WRAPPER_MISCLASSIFICATION");
  assert.equal(governance?.rootCause?.generatedBundleEmbeddedCheckoutDependentPaths, true);
  assert.equal(governance?.rootCause?.rollbackFailureMisclassifiedAsRepositoryIntegrity, true);
  for (const field of [
    "reachableRepositoryCorruptionReproduced",
    "invalidFetchedRefReproduced",
    "shallowOrPartialCheckoutReproduced",
    "speculationUsed"
  ]) assert.equal(governance?.rootCause?.[field], false);

  assert.deepEqual(governance?.dashboardVerificationRepair, {
    classification: "TEST_ONLY_WALL_CLOCK_DEPENDENCY_REMOVED",
    commit: DASHBOARD_VERIFICATION_SUCCESSOR.commit,
    tree: DASHBOARD_VERIFICATION_SUCCESSOR.tree,
    parent: DASHBOARD_VERIFICATION_SUCCESSOR.parent,
    subject: DASHBOARD_VERIFICATION_SUCCESSOR.subject,
    owner: "Prometheus Dashboard",
    files: [...DASHBOARD_VERIFICATION_SUCCESSOR.files],
    browserWorkflowChecksPassed: 184,
    focusedTestsPassed: 8,
    productRuntimeModified: false,
    generatedDeploymentAssetsModified: false,
    generallyAuthorizesDashboardSuccessors: false
  });

  assert.deepEqual(governance?.infrastructureOwnerRepairs, INFRASTRUCTURE_COMMITS.map(record => ({
    commit: record.commit,
    tree: record.tree,
    parent: record.parent,
    subject: record.subject,
    owner: "Prometheus Infrastructure",
    files: [...record.files]
  })));
  assert.equal(governance?.infrastructureEvidence?.contractPath, INFRASTRUCTURE_CONTRACT_PATH);
  assert.equal(governance?.infrastructureEvidence?.contractSha256, INFRASTRUCTURE_CONTRACT_SHA256);
  assert.deepEqual(governance?.infrastructureEvidence?.strictGitArguments, [
    "fsck", "--full", "--strict", "--no-dangling", "--no-progress"
  ]);
  assert.equal(governance?.infrastructureEvidence?.boundedDiagnosticBytes, 131072);
  for (const field of [
    "fullHistoryRequired",
    "shallowPartialAndPromisorRejected",
    "missingCorruptMalformedAndInvalidRefFailuresRemainFatal",
    "repositoryIntegrityRunsBeforeRollbackAndCredentials",
    "pinnedNodeRunsBeforeRepositoryScripts",
    "sourceMapSourcesResolvedAgainstValidatedRoot",
    "sourceMapRealpathContainmentRequired"
  ]) assert.equal(governance?.infrastructureEvidence?.[field], true);
  assert.equal(governance?.infrastructureEvidence?.genericOwnerVerifierFailureAllowed, false);
  assert.equal(governance?.infrastructureEvidence?.ownerVerifierAllowsOnlyGovernedSuccessorSequence, true);
  assert.equal(governance?.infrastructureEvidence?.ownerVerifierPinsDashboardVerificationSuccessor, true);
  assert.equal(governance?.infrastructureEvidence?.ownerVerifierPinsInfrastructureAdmissionSuccessor, true);
  assert.equal(governance?.infrastructureEvidence?.ownerVerifierPinsPublicIntakeSmokeSuccessors, true);
  assert.equal(governance?.infrastructureEvidence?.ownerVerifierPinsPublicIntakeSmokeProvenanceAdmission, true);
  assert.equal(governance?.infrastructureEvidence?.ownerVerifierPinsCleanRunnerAssetGenerationSuccessor, true);
  assert.equal(governance?.infrastructureEvidence?.ownerVerifierGenerallyAllowsDashboardSuccessors, false);
  assert.equal(governance?.infrastructureEvidence?.ownerVerifierRejectsMixedOwnershipAndMerges, true);

  assert.equal(governance?.releaseIdentities?.deploymentAssetsSha256, DEPLOYMENT_ASSETS_SHA256);
  assert.equal(governance?.releaseIdentities?.rollbackContractPath, ROLLBACK_CONTRACT_PATH);
  assert.equal(governance?.releaseIdentities?.rollbackContractSha256, ROLLBACK_CONTRACT_SHA256);
  assert.equal(governance?.releaseIdentities?.deterministicForwardRollbackBundleSha256, ROLLBACK_BUNDLE_SHA256);
  assert.equal(governance?.releaseIdentities?.websiteAndCrmImplementationChanged, false);
  assert.equal(governance?.releaseIdentities?.generatedDeploymentAssetsChanged, false);
  assert.equal(governance?.releaseIdentities?.newFounderVisualAcceptanceRequired, false);

  assert.deepEqual(governance?.predeploymentSmokeRepair, {
    batchId: "BATCH-20260720-001",
    directive: "Route IQ Combined Final Preflight + Public Deployment v1",
    classification: "READ_ONLY_SMOKE_VERIFIER_CONTRACT_REPAIR",
    authorizedCandidate: {
      commit: FOURTH_OVERWATCH_SUCCESSOR.commit,
      tree: FOURTH_OVERWATCH_SUCCESSOR.tree,
      deploymentAssetsSha256: DEPLOYMENT_ASSETS_SHA256,
      rollbackContractSha256: ROLLBACK_CONTRACT_SHA256,
      deterministicRollbackBundleSha256: ROLLBACK_BUNDLE_SHA256,
      infrastructureContractSha256: "4eb1333e4013519fb62b2c1efb5fea6bad2399f2ddfdaa52ecec922d8f5fede6"
    },
    rootCause: "METHOD_AWARE_VALID_ALLOW_SETS_WERE_REJECTED_BY_A_LITERAL_SINGLE_VALUE_CHECK",
    liveObservation: {
      target: "prometheusrouteiq-website",
      path: "/api/partner-intake",
      requests: [
        { method: "GET", status: 405, allow: ["POST", "OPTIONS"] },
        { method: "HEAD", status: 405, allow: ["GET", "POST"] }
      ],
      methodsRestrictedTo: ["GET", "HEAD"],
      responseBodiesRetained: false,
      writeAttempted: false,
      productionMutation: false
    },
    ownerCommits: INFRASTRUCTURE_COMMITS.slice(5, 8).map(record => ({
      commit: record.commit,
      tree: record.tree,
      parent: record.parent,
      subject: record.subject,
      owner: "Prometheus Infrastructure",
      files: [...record.files]
    })),
    verification: {
      strictMethodAwareAllowSet: true,
      unknownMethodsRejected: true,
      lowercaseMethodsRejected: true,
      duplicateMethodsRejected: true,
      missingPostRejected: true,
      extraMethodsRejected: true,
      liveGetHeadSmokePassed: true
    },
    scope: {
      websiteImplementationChanged: false,
      crmImplementationChanged: false,
      generatedDeploymentAssetsChanged: false,
      rollbackContractChanged: false,
      deterministicRollbackBundleChanged: false,
      publicWorkerChanged: false,
      privateWorkerChanged: false
    },
    authorizationBoundary: {
      originalExactAuthorizationReusable: false,
      authorizationTransfersToSuccessorHead: false,
      workflowDispatched: false,
      deploymentPerformed: false,
      freshExactFounderAuthorizationRequired: true
    },
    overwatchVerificationRepair: {
      classification: "TEST_ONLY_STALE_LAST_INFRASTRUCTURE_INDEX",
      predecessorCommit: FIFTH_OVERWATCH_SUCCESSOR.commit,
      predecessorTree: FIFTH_OVERWATCH_SUCCESSOR.tree,
      predecessorParent: FIFTH_OVERWATCH_SUCCESSOR.parent,
      predecessorSubject: FIFTH_OVERWATCH_SUCCESSOR.subject,
      failedAssertionExpectedCommit: INFRASTRUCTURE_COMMITS[4].commit,
      failedAssertionActualCommit: INFRASTRUCTURE_COMMITS[7].commit,
      dashboardAdmissionStillPinned: true,
      smokeAdmissionNowPinned: true,
      productRuntimeModified: false,
      generatedDeploymentAssetsModified: false,
      productionModified: false
    }
  });

  assert.deepEqual(governance?.predeploymentClosure, {
    batchId: "BATCH-20260720-003",
    directive: "Autonomous Predeployment Closure",
    failedDeploymentRun: {
      runId: 29723618108,
      verificationJobId: 88291684567,
      failureClassification: "DIST_PUBLIC_READ_BEFORE_DETERMINISTIC_BUILD_ON_CLEAN_RUNNER",
      deploymentJobSkipped: true,
      protectedEnvironmentAccessed: false,
      cloudflareContacted: false,
      productionMutation: false
    },
    rejectedLocalCommit: {
      commit: "c7f8f80f0c64444efc1354f050dc304a9fd25ae1",
      tree: INFRASTRUCTURE_COMMITS[8].tree,
      author: "Prometheus Overwatch <overwatch@prometheus.local>",
      committer: "Prometheus Overwatch <overwatch@prometheus.local>",
      classification: "REJECTED_MIXED_OWNERSHIP_LOCAL_ONLY",
      archivalRef: "refs/archive-local/BATCH-20260720-003/rejected-overwatch-identity",
      pushAllowed: false,
      mergeAllowed: false,
      deploymentAllowed: false
    },
    ownerRepair: {
      commit: INFRASTRUCTURE_COMMITS[8].commit,
      tree: INFRASTRUCTURE_COMMITS[8].tree,
      parent: INFRASTRUCTURE_COMMITS[8].parent,
      owner: "Prometheus Infrastructure",
      authorEmail: "infrastructure@prometheus.local",
      committerEmail: "infrastructure@prometheus.local",
      subject: INFRASTRUCTURE_COMMITS[8].subject,
      binaryDiffEquivalentToRejectedCommit: true,
      websiteImplementationChanged: false,
      crmImplementationChanged: false,
      deploymentAssetsChanged: false,
      rollbackArtifactChanged: false,
      productionChanged: false
    },
    safeCiNextRunRequired: true,
    freshExactFounderDeploymentAuthorizationRequired: true
  });

  assert.deepEqual(governance?.productionIdentities, {
    publicWorker: {
      name: "prometheusrouteiq-website",
      version: "a0296f92-4427-4cea-a3e2-9a5e05a4596c",
      trafficPercent: 100
    },
    privateWorker: {
      name: "prometheus-iq",
      version: "b8cba784-dfd3-4f8e-8356-816cccf6aecc",
      trafficPercent: 100
    },
    changedByBatch: false
  });
  assert.equal(governance?.safeNonDeploymentCi?.workflow, ".github/workflows/verify-prometheus-public-repository-integrity.yml");
  assert.equal(governance?.safeNonDeploymentCi?.trigger, "workflow_dispatch");
  assert.equal(governance?.safeNonDeploymentCi?.dispatchAuthorizedAfterVerifiedFastForwardPush, true);
  assert.equal(governance?.safeNonDeploymentCi?.resultRecordedExternally, true);
  assert.equal(governance?.safeNonDeploymentCi?.mustPassBeforeFreshDeploymentReview, true);
  for (const field of [
    "protectedEnvironmentUsed",
    "secretsAllowed",
    "cloudflareAccessAllowed",
    "deploymentCapability",
    "crmWriteCapability"
  ]) assert.equal(governance?.safeNonDeploymentCi?.[field], false);
  assert.equal(governance?.safeNonDeploymentCi?.nextRunRequired, true);
  assert.deepEqual(governance?.safeNonDeploymentCi?.latestRun, {
    runId: 29717192952,
    jobId: 88272671229,
    head: "8d312bf747a289c675eb37adf582b43c860c635e",
    tree: "36f163193fdb91cf241ddb0ff03bce200c7506c6",
    repositoryIntegrity: "PASS",
    ownerVerifier: "FAIL",
    classification: "OWNER_VERIFIER_ROLLBACK_SOURCE_MAP_OUTSIDE_BOUNDARY",
    exactCause: "RELATIVE_SOURCE_MAP_ENTRIES_RESOLVED_FROM_PROCESS_CWD_INSTEAD_OF_VALIDATED_SOURCE_ROOT",
    rejectedSourceCount: 53,
    consumed: true,
    deploymentCapability: false,
    protectedEnvironmentUsed: false,
    secretsAccessed: false,
    cloudflareContacted: false,
    productionMutation: false
  });

  assert.equal(governance?.safetyState?.prospectiveCollection, "OFF");
  assert.equal(governance?.safetyState?.activeCohorts, 0);
  assert.equal(governance?.safetyState?.recommendationInfluence, "OFF");
  for (const field of [
    "anthonyMapped",
    "deploymentPerformed",
    "productionDataChanged",
    "crmRequestSubmitted",
    "notificationSent"
  ]) assert.equal(governance?.safetyState?.[field], false);

  assert.equal(governance?.releaseBoundary?.deploymentAuthorized, false);
  assert.equal(governance?.releaseBoundary?.deploymentWorkflowDispatchAuthorized, false);
  assert.equal(governance?.releaseBoundary?.failedDeploymentAuthorizationReusable, false);
  assert.equal(governance?.releaseBoundary?.safeIntegrityWorkflowDispatchAuthorized, true);
  assert.equal(governance?.releaseBoundary?.cloudflareMutationAuthorized, false);
  assert.equal(governance?.releaseBoundary?.secretAccessAuthorized, false);
  assert.equal(governance?.releaseBoundary?.normalFastForwardPushAllowedAfterExactHeadPass, true);
  assert.equal(governance?.releaseBoundary?.archivalRefsPushAllowed, false);
  assert.equal(governance?.releaseBoundary?.freshFounderDeploymentReviewRequired, true);
  assert.equal(governance?.releaseBoundary?.combinedDeploymentAuthorizationReusable, false);
  assert.equal(governance?.releaseBoundary?.freshExactCandidateAuthorizationRequired, true);
  return governance;
}

function verifyOwnership(root, requireCommittedOverwatch) {
  assert.equal(git(root, "rev-parse", `${HISTORICAL_SUCCESSOR_COMMIT}^{tree}`), HISTORICAL_SUCCESSOR_TREE);
  assert.equal(git(root, "rev-list", "--min-parents=2", `${HISTORICAL_SUCCESSOR_COMMIT}..HEAD`), "");
  const commits = git(root, "rev-list", "--reverse", `${HISTORICAL_SUCCESSOR_COMMIT}..HEAD`)
    .split("\n")
    .filter(Boolean);
  const expectedCount = requireCommittedOverwatch ? 17 : 16;
  assert.equal(commits.length, expectedCount);
  assert.deepEqual(commits.slice(0, 16), [
    INFRASTRUCTURE_COMMITS[0].commit,
    INFRASTRUCTURE_COMMITS[1].commit,
    FIRST_OVERWATCH_SUCCESSOR.commit,
    INFRASTRUCTURE_COMMITS[2].commit,
    SECOND_OVERWATCH_SUCCESSOR.commit,
    INFRASTRUCTURE_COMMITS[3].commit,
    THIRD_OVERWATCH_SUCCESSOR.commit,
    DASHBOARD_VERIFICATION_SUCCESSOR.commit,
    INFRASTRUCTURE_COMMITS[4].commit,
    FOURTH_OVERWATCH_SUCCESSOR.commit,
    INFRASTRUCTURE_COMMITS[5].commit,
    INFRASTRUCTURE_COMMITS[6].commit,
    INFRASTRUCTURE_COMMITS[7].commit,
    FIFTH_OVERWATCH_SUCCESSOR.commit,
    SIXTH_OVERWATCH_SUCCESSOR.commit,
    INFRASTRUCTURE_COMMITS[8].commit
  ]);

  for (const expected of INFRASTRUCTURE_COMMITS) {
    assert.equal(git(root, "rev-parse", `${expected.commit}^{tree}`), expected.tree);
    const record = commitRecord(root, expected.commit);
    assert.equal(record.author, "infrastructure@prometheus.local");
    assert.equal(record.committer, "infrastructure@prometheus.local");
    assert.equal(record.subject, expected.subject);
    assert.deepEqual(record.files, [...expected.files]);
    assert.equal(git(root, "rev-parse", `${expected.commit}^`), expected.parent);
  }

  assert.equal(git(root, "rev-parse", `${FIRST_OVERWATCH_SUCCESSOR.commit}^{tree}`), FIRST_OVERWATCH_SUCCESSOR.tree);
  assert.equal(git(root, "rev-parse", `${FIRST_OVERWATCH_SUCCESSOR.commit}^`), FIRST_OVERWATCH_SUCCESSOR.parent);
  const firstOverwatch = commitRecord(root, FIRST_OVERWATCH_SUCCESSOR.commit);
  assert.equal(firstOverwatch.author, "overwatch@prometheus.local");
  assert.equal(firstOverwatch.committer, "overwatch@prometheus.local");
  assert.equal(firstOverwatch.subject, FIRST_OVERWATCH_SUCCESSOR.subject);
  assert.deepEqual(sorted(firstOverwatch.files), sorted(FIRST_OVERWATCH_SUCCESSOR_PATHS));

  assert.equal(git(root, "rev-parse", `${SECOND_OVERWATCH_SUCCESSOR.commit}^{tree}`), SECOND_OVERWATCH_SUCCESSOR.tree);
  assert.equal(git(root, "rev-parse", `${SECOND_OVERWATCH_SUCCESSOR.commit}^`), SECOND_OVERWATCH_SUCCESSOR.parent);
  const secondOverwatch = commitRecord(root, SECOND_OVERWATCH_SUCCESSOR.commit);
  assert.equal(secondOverwatch.author, "overwatch@prometheus.local");
  assert.equal(secondOverwatch.committer, "overwatch@prometheus.local");
  assert.equal(secondOverwatch.subject, SECOND_OVERWATCH_SUCCESSOR.subject);
  assert.deepEqual(sorted(secondOverwatch.files), sorted(SECOND_OVERWATCH_SUCCESSOR_PATHS));

  assert.equal(git(root, "rev-parse", `${THIRD_OVERWATCH_SUCCESSOR.commit}^{tree}`), THIRD_OVERWATCH_SUCCESSOR.tree);
  assert.equal(git(root, "rev-parse", `${THIRD_OVERWATCH_SUCCESSOR.commit}^`), THIRD_OVERWATCH_SUCCESSOR.parent);
  const thirdOverwatch = commitRecord(root, THIRD_OVERWATCH_SUCCESSOR.commit);
  assert.equal(thirdOverwatch.author, "overwatch@prometheus.local");
  assert.equal(thirdOverwatch.committer, "overwatch@prometheus.local");
  assert.equal(thirdOverwatch.subject, THIRD_OVERWATCH_SUCCESSOR.subject);
  assert.deepEqual(sorted(thirdOverwatch.files), sorted(FINAL_OVERWATCH_SUCCESSOR_PATHS));

  assert.equal(
    git(root, "rev-parse", `${DASHBOARD_VERIFICATION_SUCCESSOR.commit}^{tree}`),
    DASHBOARD_VERIFICATION_SUCCESSOR.tree
  );
  assert.equal(
    git(root, "rev-parse", `${DASHBOARD_VERIFICATION_SUCCESSOR.commit}^`),
    DASHBOARD_VERIFICATION_SUCCESSOR.parent
  );
  const dashboard = commitRecord(root, DASHBOARD_VERIFICATION_SUCCESSOR.commit);
  assert.equal(dashboard.author, "dashboard@prometheus.local");
  assert.equal(dashboard.committer, "dashboard@prometheus.local");
  assert.equal(dashboard.subject, DASHBOARD_VERIFICATION_SUCCESSOR.subject);
  assert.deepEqual(sorted(dashboard.files), sorted(DASHBOARD_VERIFICATION_SUCCESSOR.files));

  assert.equal(git(root, "rev-parse", `${FOURTH_OVERWATCH_SUCCESSOR.commit}^{tree}`), FOURTH_OVERWATCH_SUCCESSOR.tree);
  assert.equal(git(root, "rev-parse", `${FOURTH_OVERWATCH_SUCCESSOR.commit}^`), FOURTH_OVERWATCH_SUCCESSOR.parent);
  const fourthOverwatch = commitRecord(root, FOURTH_OVERWATCH_SUCCESSOR.commit);
  assert.equal(fourthOverwatch.author, "overwatch@prometheus.local");
  assert.equal(fourthOverwatch.committer, "overwatch@prometheus.local");
  assert.equal(fourthOverwatch.subject, FOURTH_OVERWATCH_SUCCESSOR.subject);
  assert.deepEqual(sorted(fourthOverwatch.files), sorted(FINAL_OVERWATCH_SUCCESSOR_PATHS));

  assert.equal(git(root, "rev-parse", `${FIFTH_OVERWATCH_SUCCESSOR.commit}^{tree}`), FIFTH_OVERWATCH_SUCCESSOR.tree);
  assert.equal(git(root, "rev-parse", `${FIFTH_OVERWATCH_SUCCESSOR.commit}^`), FIFTH_OVERWATCH_SUCCESSOR.parent);
  const fifthOverwatch = commitRecord(root, FIFTH_OVERWATCH_SUCCESSOR.commit);
  assert.equal(fifthOverwatch.author, "overwatch@prometheus.local");
  assert.equal(fifthOverwatch.committer, "overwatch@prometheus.local");
  assert.equal(fifthOverwatch.subject, FIFTH_OVERWATCH_SUCCESSOR.subject);
  assert.deepEqual(sorted(fifthOverwatch.files), sorted(FINAL_OVERWATCH_SUCCESSOR_PATHS));

  assert.equal(git(root, "rev-parse", `${SIXTH_OVERWATCH_SUCCESSOR.commit}^{tree}`), SIXTH_OVERWATCH_SUCCESSOR.tree);
  assert.equal(git(root, "rev-parse", `${SIXTH_OVERWATCH_SUCCESSOR.commit}^`), SIXTH_OVERWATCH_SUCCESSOR.parent);
  const sixthOverwatch = commitRecord(root, SIXTH_OVERWATCH_SUCCESSOR.commit);
  assert.equal(sixthOverwatch.author, "overwatch@prometheus.local");
  assert.equal(sixthOverwatch.committer, "overwatch@prometheus.local");
  assert.equal(sixthOverwatch.subject, SIXTH_OVERWATCH_SUCCESSOR.subject);
  assert.deepEqual(sorted(sixthOverwatch.files), sorted(FINAL_OVERWATCH_SUCCESSOR_PATHS));

  if (requireCommittedOverwatch) {
    const record = commitRecord(root, commits[16]);
    assert.equal(record.author, "overwatch@prometheus.local");
    assert.equal(record.committer, "overwatch@prometheus.local");
    assert.equal(record.subject, "overwatch: close public clean-runner provenance");
    assert.deepEqual(sorted(record.files), sorted(FINAL_OVERWATCH_SUCCESSOR_PATHS));
    assert.equal(git(root, "rev-parse", `${commits[16]}^`), INFRASTRUCTURE_COMMITS[8].commit);
  }
  return commits;
}

function verifyConsumerResolution(root) {
  for (const path of [
    "scripts/verify-overwatch-route-iq-3d-visual-continuity.mjs",
    "scripts/verify-overwatch-route-iq-public-crm-founder-access-deployment-readiness.mjs"
  ]) {
    assert.match(
      read(root, path).toString("utf8"),
      /verifyOverwatchPublicDeploymentIntegrityRepairReadiness/u,
      `Current readiness consumer does not resolve the integrity successor: ${path}`
    );
  }
}

export function verifyOverwatchPublicDeploymentIntegrityRepairReadiness({
  root = ROOT,
  build = false,
  requireClean = true,
  requireCommittedOverwatch = true
} = {}) {
  const governance = validatePublicIntegrityReadiness(readJson(root, PUBLIC_INTEGRITY_READINESS_PATH));
  assert.equal(sha256(read(root, HISTORICAL_SUCCESSOR_PATH)), HISTORICAL_SUCCESSOR_SHA256);
  assert.equal(sha256(read(root, INFRASTRUCTURE_CONTRACT_PATH)), INFRASTRUCTURE_CONTRACT_SHA256);
  assert.equal(sha256(read(root, ROLLBACK_CONTRACT_PATH)), ROLLBACK_CONTRACT_SHA256);

  const historical = verifyOverwatchRevised3dReleaseReadinessSuccessor({
    root,
    build: false,
    requireClean: false,
    requireFounderAcceptance: true,
    requireCommittedSuccessor: true
  });
  assert.equal(historical.historicalSuccessorCommit, HISTORICAL_SUCCESSOR_COMMIT);
  assert.equal(historical.historicalSuccessorTree, HISTORICAL_SUCCESSOR_TREE);
  assert.equal(historical.founderVisualAcceptance, "ACCEPTED");

  const ownerRepair = verifyRouteIqPublicRepositoryIntegrityRepair();
  assert.equal(ownerRepair.rollbackArtifactSha256, ROLLBACK_BUNDLE_SHA256);
  const deployment = verifyRouteIqPublicDeploymentAssets({ build });
  assert.equal(deployment.deploymentAssetsSha256, DEPLOYMENT_ASSETS_SHA256);
  const rollback = verifyPublicForwardRollbackArtifact(root);
  assert.equal(rollback.artifactSha256, ROLLBACK_BUNDLE_SHA256);
  assert.equal(rollback.candidateDeploymentAssetsSha256, DEPLOYMENT_ASSETS_SHA256);

  const commits = verifyOwnership(root, requireCommittedOverwatch);
  verifyConsumerResolution(root);
  if (requireClean) assert.equal(git(root, "status", "--porcelain"), "", "Working tree is not clean.");
  return Object.freeze({
    status: governance.status,
    batchId: governance.batchId,
    head: git(root, "rev-parse", "HEAD"),
    tree: git(root, "rev-parse", "HEAD^{tree}"),
    commits,
    deploymentAssetsSha256: DEPLOYMENT_ASSETS_SHA256,
    rollbackContractSha256: ROLLBACK_CONTRACT_SHA256,
    rollbackBundleSha256: ROLLBACK_BUNDLE_SHA256,
    founderVisualAcceptance: historical.founderVisualAcceptance,
    predeploymentBatchId: governance.predeploymentSmokeRepair.batchId,
    authorizedCandidateCommit: governance.predeploymentSmokeRepair.authorizedCandidate.commit,
    authorizedCandidateTree: governance.predeploymentSmokeRepair.authorizedCandidate.tree,
    freshExactFounderAuthorizationRequired: true,
    safeCiPending: true,
    deploymentAuthorized: false
  });
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const result = verifyOverwatchPublicDeploymentIntegrityRepairReadiness();
  process.stdout.write(`${result.status} ${result.rollbackBundleSha256}\n`);
}
