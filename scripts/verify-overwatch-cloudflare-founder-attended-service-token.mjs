import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";

import {
  scanTrackedRepository,
  verifyLocalSecretArtifacts
} from "./check-cloudflare-unattended-secret-presence.mjs";
import {
  verifyCloudflareFounderAttendedServiceTokenArchitecture
} from "./verify-cloudflare-founder-attended-service-token.mjs";
import {
  hasGovernedPublicDeploymentWorkflowV2PackageSuccessor
} from "./verify-overwatch-public-deployment-workflow-v2.mjs";

const root = resolve(import.meta.dirname, "..");
const contractPath = "workers/infrastructure/cloudflare-founder-attended-service-token-v1.json";
const governancePath = "overwatch/governance/cloudflare-founder-attended-service-token-provisioning-v1.json";
const governanceDocumentationPath = "overwatch/governance/cloudflare-founder-attended-service-token-provisioning-v1.md";
const reportPath = "overwatch/reports/BATCH-20260714-007-cloudflare-founder-attended-service-token-provisioning.json";
const ttyCompatibilityGovernancePath = "overwatch/governance/cloudflare-founder-attended-real-macos-tty-compatibility-repair-v1.json";
const responseContractGovernancePath = "overwatch/governance/cloudflare-founder-attended-service-token-response-contract-repair-v1.json";
const createReceiptV2GovernancePath = "overwatch/governance/cloudflare-founder-attended-live-create-receipt-safe-provisioning-repair-v2.json";
const keychainInteroperabilityGovernancePath =
  "overwatch/governance/cloudflare-unattended-keychain-interoperability-v1.json";
const githubDeploymentGovernancePath =
  "overwatch/governance/github-actions-founder-triggered-private-worker-deployment-v1.json";
const routeIq3dGovernancePath =
  "overwatch/governance/route-iq-3d-visual-continuity-v1.json";
const publicDeploymentWorkflowV2GovernancePath =
  "overwatch/governance/public-deployment-workflow-v2.json";
const controlledRehearsalReadinessSuccessorsPath =
  "overwatch/governance/route-iq-august-1-readiness-successors-v1.json";
const registryPath = "overwatch/artifact-contracts/canonical-artifact-registry.json";
const ownerCommit = "a0a1eb8e434015ea7a0f403e4be0a8979724d9a8";
const ownerParent = "09418ac6eb4a67b7cc302ba7a30705e9c1012fd5";
const ownerTree = "04823fa4e3cdf5688045c321bead3d94d813b7c7";
const repairCommit = "214521d99d08a0a117d81e59b9ef38105edac147";
const repairParent = "e7b1171acf067ca0245f3d88558de3d857fb531d";
const repairTree = "e2914c171797d698a78373247ec505d611e30653";
const packageReleaseWiringCommit = "610383c4e845789859946122283e8014dae35600";
const packageReleaseWiringParent = "b8346e9931231d055a20f2cadd6a9c6edea36ce4";
const packageReleaseWiringTree = "99deba22646feb47301410ee492d4af9396fbbc7";
const packageReleaseWiringPaths = Object.freeze([
  "overwatch/governance/route-iq-august-1-launch-closeout-v1.json",
  "overwatch/governance/route-iq-august-1-readiness-matrix-v1.json",
  "package.json",
  "scripts/verify-overwatch-route-iq-august-1-launch-readiness.mjs",
  "tests/overwatch-route-iq-august-1-launch-readiness.test.mjs"
]);

const read = path => readFileSync(resolve(root, path), "utf8");
const readJson = path => JSON.parse(read(path));
const sha256 = value => createHash("sha256").update(value).digest("hex");
const equalJson = (left, right) => isDeepStrictEqual(left, right);
const git = args => execFileSync("/usr/bin/git", args, {
  cwd: root,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "ignore"]
}).trim();

const expectedCommands = Object.freeze([
  "presence",
  "provision-attended",
  "cleanup-temp"
]);

export function hasControlledRehearsalPackageWiringSuccessor({
  governance,
  predecessorSha256,
  successorSha256
}) {
  const matches = governance?.overwatchCurrentEvidence?.filter(item => (
    item.path === "package.json"
    && item.previousSha256 === predecessorSha256
    && item.successorSha256 === successorSha256
  )) ?? [];
  return governance?.governanceId ===
      "route-iq-august-1-readiness-successors-v1"
    && governance?.ownerSubsystem === "Prometheus Overwatch"
    && governance?.historicalCloseoutEvidenceRewritten === false
    && matches.length === 1;
}
const expectedEvidencePaths = Object.freeze([
  ".gitignore",
  "docs/cloudflare-founder-attended-service-token-provisioning-v1.md",
  "package.json",
  "scripts/check-cloudflare-unattended-secret-presence.mjs",
  "scripts/helpers/cloudflare-founder-attended-keychain.swift",
  "scripts/lib/cloudflare-founder-attended-constants.mjs",
  "scripts/lib/cloudflare-founder-attended-control.mjs",
  "scripts/lib/cloudflare-founder-attended-keychain.mjs",
  "scripts/lib/cloudflare-founder-attended-service-token.mjs",
  "scripts/lib/cloudflare-founder-attended-tty.mjs",
  "scripts/lib/strict-json.mjs",
  "scripts/run-cloudflare-founder-attended-service-token.mjs",
  "scripts/security-check.mjs",
  "scripts/verify-cloudflare-founder-attended-service-token.mjs",
  "tests/cloudflare-founder-attended-service-token.test.mjs",
  "workers/infrastructure/cloudflare-founder-attended-service-token-v1.json"
]);
const expectedRepairPaths = Object.freeze([
  "docs/cloudflare-founder-attended-service-token-provisioning-v1.md",
  "scripts/helpers/cloudflare-founder-attended-keychain.swift",
  "scripts/lib/cloudflare-founder-attended-control.mjs",
  "scripts/lib/cloudflare-founder-attended-keychain.mjs",
  "scripts/lib/cloudflare-founder-attended-service-token-production.mjs",
  "scripts/lib/cloudflare-founder-attended-service-token.mjs",
  "scripts/run-cloudflare-founder-attended-service-token.mjs",
  "scripts/verify-cloudflare-founder-attended-service-token.mjs",
  "tests/cloudflare-founder-attended-service-token.test.mjs",
  "workers/infrastructure/cloudflare-founder-attended-service-token-v1.json"
]);
const expectedRepairHashes = Object.freeze({
  "docs/cloudflare-founder-attended-service-token-provisioning-v1.md": "c93efffb121ad67579627489a8551d35177d0521a5f90fdb90b806e221a32ad6",
  "scripts/helpers/cloudflare-founder-attended-keychain.swift": "9be9244eab759c9b8ef5dde604675c003fb3068beddf7a719be36cc65bb8a909",
  "scripts/lib/cloudflare-founder-attended-control.mjs": "06011b1cf40751b8ab3cb89f6935f6723fd5c0689eb9c5b0f7ad6bc80e4fec9f",
  "scripts/lib/cloudflare-founder-attended-keychain.mjs": "d336908f2dc4fb226e761cfa634c1877cdbf5a6f140726e77e1ebc17216c3cab",
  "scripts/lib/cloudflare-founder-attended-service-token-production.mjs": "ca5ddc600774ead824ff6b18a48be07436915684dd4810fe570f18e93ab8ed6d",
  "scripts/lib/cloudflare-founder-attended-service-token.mjs": "8272fde338c1143d08c8d8f3616d5ef5df01dff1e94fd7c74a4769b2827d61f4",
  "scripts/run-cloudflare-founder-attended-service-token.mjs": "1ea0cc60831c79194254682935b07c92970cac7b5fdfced522af9257ab0b6f75",
  "scripts/verify-cloudflare-founder-attended-service-token.mjs": "6c0ed66b5c57dc126e0ae86e0fb8da69891d95173787edb34aed3bda4e7230f2",
  "tests/cloudflare-founder-attended-service-token.test.mjs": "5fb7dd0bc5f710c5e94c6b3c31c85c9711d79d7ed8fd3a8236b15e3d98c81dc6",
  "workers/infrastructure/cloudflare-founder-attended-service-token-v1.json": "03a1d81f7c6ac8d7a8f2bc30f2e86edb73f28fa004ba8f79c97efbfcac19f57b"
});

export function evaluateFounderAttendedProvisioningGovernance({
  contract,
  governance,
  report
}) {
  const failures = [];
  const require = (condition, message) => {
    if (!condition) failures.push(message);
  };

  require(contract.contractVersion === "cloudflare-founder-attended-service-token-v1", "Infrastructure contract version drifted.");
  require(contract.batchId === "BATCH-20260714-007", "Infrastructure batch ID drifted.");
  require(contract.owner === "Prometheus Infrastructure", "Infrastructure owner drifted.");
  require(contract.status === "IMPLEMENTED_SOURCE_NOT_EXECUTED", "Infrastructure source status drifted.");
  for (const field of [
    "cloudflareAccessPerformed",
    "keychainValuesAccessed",
    "credentialCreated",
    "productionMutationPerformed",
    "deploymentPerformed"
  ]) {
    require(contract[field] === false, `${field} must remain false.`);
  }

  require(contract.target.apiOrigin === "https://api.cloudflare.com", "Cloudflare API origin drifted.");
  require(contract.target.collectionPathTemplate === "/client/v4/accounts/{account_id}/access/service_tokens", "Cloudflare endpoint drifted.");
  require(contract.target.accountIdSha256 === "2abc795ed0df284a522381c09dca33fc567105c74074140fd920c0dd45dcd536", "Governed account digest drifted.");
  require(contract.target.otherAccountsAllowed === false, "Other Cloudflare accounts must remain denied.");
  require(contract.serviceToken.name === "Prometheus Overwatch Read-Only Smoke Verification", "Service-token name drifted.");
  require(contract.serviceToken.duration === "720h", "Service-token duration drifted.");
  require(equalJson(contract.serviceToken.requestBody, {
    name: "Prometheus Overwatch Read-Only Smoke Verification",
    duration: "720h"
  }), "Service-token request body drifted.");
  require(contract.serviceToken.createCountMaximum === 1, "More than one create attempt is allowed.");
  require(contract.serviceToken.automaticRetryAllowed === false, "Automatic create retry must remain denied.");
  require(contract.serviceToken.redirectFollowAllowed === false, "Redirect following must remain denied.");
  require(contract.temporaryApiCredential.permission === "Access: Service Tokens Write", "Temporary token permission drifted.");
  require(contract.temporaryApiCredential.resourceScope === "exact_prometheus_account_only", "Temporary token account scope drifted.");
  require(contract.temporaryApiCredential.maximumTtlHours === 720, "Temporary token TTL boundary drifted.");
  require(contract.temporaryApiCredential.existingUnattendedDeploymentTokenReadable === false, "Existing unattended token became readable.");
  require(contract.temporaryApiCredential.existingUnattendedDeploymentTokenModified === false, "Existing unattended token became mutable.");
  require(contract.destinationKeychain.service === "com.prometheus.cloudflare.unattended.smoke", "Destination Keychain service drifted.");
  require(equalJson(contract.destinationKeychain.accounts, [
    "CLOUDFLARE_ACCESS_CLIENT_ID",
    "CLOUDFLARE_ACCESS_CLIENT_SECRET"
  ]), "Destination Keychain accounts drifted.");
  require(contract.destinationKeychain.secretValuesInArguments === false, "Secret values may enter argv.");
  require(contract.destinationKeychain.secretValuesInEnvironment === false, "Secret values may enter environment variables.");
  require(contract.destinationKeychain.rollbackDeletesOnlyInvocationOwnedItems === true, "Keychain rollback ownership boundary drifted.");
  require(contract.destinationKeychain.preexistingOrReplacementItemDeletionAllowed === false, "Keychain rollback may delete a foreign item.");
  require(contract.destinationKeychain.processDeathAfterPartialWrite === "PRESENCE_BLOCKS_RETRY_AND_REQUIRES_FOUNDER_REVIEW", "Process-death recovery boundary drifted.");
  require(contract.destinationKeychain.presenceVerification === "name_and_PRESENT_or_ABSENT_only", "Presence verification is not name-only.");
  require(contract.destinationKeychain.unattendedReaderInteroperability.genericPasswordServiceAndAccountCompatibleInSource === true, "Audited reader source compatibility drifted.");
  require(contract.destinationKeychain.unattendedReaderInteroperability.realKeychainRuntimeVerified === false, "Contract overclaims real Keychain verification.");
  require(contract.destinationKeychain.unattendedReaderInteroperability.mandatoryFounderAttendedIntegrationCheckBeforeReadiness === true, "Founder-attended interoperability check is no longer mandatory.");
  require(contract.attendedControl.defaultState === "OFF", "Attended control must default OFF.");
  require(contract.attendedControl.controllingTtyRequiredForRealProvisioning === true, "Real provisioning must require a controlling TTY.");
  require(contract.attendedControl.maximumLifetimeMinutes === 30, "Attended authorization window drifted.");
  require(contract.attendedControl.cleanRepositoryRequired === true, "Clean repository is no longer required.");
  require(contract.attendedControl.exactCommitAndTreeRequired === true, "Exact commit/tree binding is no longer required.");
  require(contract.attendedControl.clockAndRepositoryReadersAreLiveFunctions === true, "Live authorization readers drifted.");
  require(contract.attendedControl.firstLiveSampleAfterConfirmationAndKeychainReads === true, "Live state may be captured before blocking attendance or Keychain operations.");
  require(contract.attendedControl.freshValidationImmediatelyBeforeGet === true, "GET live-state revalidation drifted.");
  require(contract.attendedControl.freshValidationImmediatelyBeforePost === true, "POST live-state revalidation drifted.");
  require(contract.attendedControl.staleStructurallyValidAuthorizationConsumed === true, "Stale authorization may remain reusable.");
  require(contract.attendedControl.nonceConsumedBeforeFirstNetworkCall === true, "Nonce is not consumed before network.");
  require(contract.attendedControl.replayAllowed === false, "Control replay became allowed.");
  require(equalJson(contract.cli.fixedCommands, expectedCommands), "CLI command set drifted.");
  require(contract.cli.unattendedLauncherProfileAvailable === false, "Attended provisioning entered the unattended launcher.");
  require(contract.cli.productionEntrypointImportsOnlyProductionWrapper === true, "Production entrypoint composition drifted.");
  require(contract.cli.productionAdapterInjectionAllowed === false, "Production adapter injection became possible.");
  require(contract.cli.testCoreRequiresEveryAdapterExplicitly === true, "Test core no longer requires complete adapter injection.");
  require(contract.testBoundary.realNetworkAllowed === false, "Tests allow real network access.");
  require(contract.testBoundary.realKeychainAllowed === false, "Tests allow real Keychain access.");
  require(contract.runtimeBoundaries.cloudflareAccessPolicyMutationAllowed === false, "Access policy mutation became allowed.");
  require(contract.runtimeBoundaries.workerDeploymentAllowed === false, "Worker deployment became allowed.");
  require(contract.runtimeBoundaries.productionDataMutationAllowed === false, "Production mutation became allowed.");
  require(contract.runtimeBoundaries.collectionActivation === "OFF", "Collection must remain OFF.");
  require(contract.runtimeBoundaries.cohortActivation === "OFF", "Cohort activation must remain OFF.");
  require(contract.runtimeBoundaries.recommendationInfluence === "OFF", "Recommendation influence must remain OFF.");

  require(governance.governanceId === "cloudflare-founder-attended-service-token-provisioning-governance-v1", "Overwatch governance ID drifted.");
  require(governance.version === "1.0.0" && governance.batchId === "BATCH-20260714-007", "Overwatch governance version or batch drifted.");
  require(governance.status === "OWNER_REPAIR_VERIFIED_NOT_EXECUTED", "Overwatch repair status drifted.");
  require(governance.owningSubsystem === "Prometheus Overwatch", "Governance must remain Overwatch-owned.");
  require(governance.dispatchAudit.implementationOwner === "Prometheus Infrastructure", "Implementation owner drifted.");
  require(governance.dispatchAudit.verificationOwner === "Prometheus Overwatch", "Verification owner drifted.");
  require(governance.dispatchAudit.implementationOwnershipRespected === true, "Implementation ownership is not affirmed.");
  require(governance.dispatchAudit.overwatchModifiedSubsystemImplementation === false, "Overwatch modified Infrastructure implementation.");
  require(governance.dispatchAudit.implementationCommit.commit === ownerCommit, "Infrastructure owner commit drifted.");
  require(governance.dispatchAudit.implementationCommit.parent === ownerParent, "Infrastructure owner parent drifted.");
  require(governance.dispatchAudit.implementationCommit.tree === ownerTree, "Infrastructure owner tree drifted.");
  require(governance.dispatchAudit.implementationCommit.author === "Prometheus Infrastructure <infrastructure@prometheus.local>", "Infrastructure commit author drifted.");
  require(governance.dispatchAudit.implementationCommit.committer === "Prometheus Infrastructure <infrastructure@prometheus.local>", "Infrastructure commit committer drifted.");
  require(governance.dispatchAudit.repairCommit.commit === repairCommit, "Infrastructure repair commit drifted.");
  require(governance.dispatchAudit.repairCommit.parent === repairParent, "Infrastructure repair parent drifted.");
  require(governance.dispatchAudit.repairCommit.tree === repairTree, "Infrastructure repair tree drifted.");
  require(governance.dispatchAudit.repairCommit.author === "Prometheus Infrastructure <infrastructure@prometheus.local>", "Infrastructure repair author drifted.");
  require(governance.dispatchAudit.repairCommit.committer === "Prometheus Infrastructure <infrastructure@prometheus.local>", "Infrastructure repair committer drifted.");
  require(equalJson(governance.infrastructureEvidence.map(item => item.path), expectedEvidencePaths), "Infrastructure evidence file set drifted.");
  require(equalJson(governance.infrastructureRepairEvidence.map(item => item.path), expectedRepairPaths), "Infrastructure repair evidence file set drifted.");
  require(governance.infrastructureRepairEvidence.every(item =>
    expectedRepairHashes[item.path] === item.sha256AtRepairCommit
  ), "Infrastructure repair evidence hash mapping drifted.");
  require(equalJson(governance.protectedPredecessorSuccessors, [
    {
      predecessorGovernanceId: "cloudflare-unattended-deployment-access-governance-v1",
      path: "scripts/check-cloudflare-unattended-secret-presence.mjs",
      historicalSha256: "1898366a964844c89b3fdd365de1544dafe7b3fb3812630d1d3d1c39daada94b",
      successorSha256: "bb0e167d62ec9179d3dc713fbce771caf0210bac06750b7b3052d8e0151366a5",
      reason: "Infrastructure extended the existing tracked-secret registry and local-artifact denylist for the separate Founder-attended credential."
    },
    {
      predecessorGovernanceId: "cloudflare-unattended-deployment-access-governance-v1",
      path: "package.json",
      historicalSha256: "a150ca1b1121c779415365551efdbff970e458915ba6491716ccbfdd0a111d0d",
      successorSha256: "50070d78fa9446c10c8309466ec5f51678d1646bdec2f2799284b87f0d1073b0",
      reason: "Infrastructure and Overwatch added attended-only owner and release verification wiring without changing unattended runtime behavior."
    }
  ]), "Protected predecessor successor mapping drifted.");
  require(governance.fixedProvisioningBoundary.duration === "720h", "Governed duration drifted.");
  require(governance.fixedProvisioningBoundary.requestBodyUserControlled === false, "Request body became user-controlled.");
  require(governance.fixedProvisioningBoundary.endpointUserControlled === false, "Endpoint became user-controlled.");
  require(governance.fixedProvisioningBoundary.createAttemptsMaximum === 1, "Governance allows multiple creates.");
  require(governance.credentialBoundary.existingUnattendedDeploymentTokenReadOrModified === false, "Governance permits existing unattended token access.");
  require(governance.credentialBoundary.secretValuesInGitEnvironmentArgumentsOutputLogsReportsScreenshotsBrowserOrFiles === false, "Governance permits secret disclosure.");
  require(governance.credentialBoundary.verificationReadsValues === false, "Verification may read credential values.");
  require(governance.credentialBoundary.toolClaimsProviderSideScopeIntrospection === false, "Tool overclaims provider-side token introspection.");
  require(governance.credentialBoundary.nativeHelperFixedOperationItemMatrix === true, "Native helper allowlist governance drifted.");
  require(governance.credentialBoundary.realKeychainInteroperabilityExecuted === false, "Governance overclaims real Keychain interoperability.");
  require(governance.credentialBoundary.realKeychainInteroperabilityRequiredBeforeUnattendedReadiness === true, "Real Keychain readiness check is no longer required.");
  require(governance.attendanceAndReplayBoundary.controllingTtyRequired === true, "Governance no longer requires Founder attendance.");
  require(governance.attendanceAndReplayBoundary.duplicateExecutionAllowed === false, "Governance permits duplicate execution.");
  require(governance.attendanceAndReplayBoundary.unattendedLauncherIntegrationAllowed === false, "Governance permits unattended provisioning.");
  require(governance.attendanceAndReplayBoundary.liveClockAndRepositoryRevalidatedBeforeGet === true, "Governance lost GET live-state validation.");
  require(governance.attendanceAndReplayBoundary.liveClockAndRepositoryRevalidatedBeforePost === true, "Governance lost POST live-state validation.");
  require(governance.attendanceAndReplayBoundary.staleOrInvalidStateBurnsOneShotAuthorization === true, "Governance permits stale authorization reuse.");
  require(governance.attendanceAndReplayBoundary.productionAdaptersInjectable === false, "Governance permits production adapter injection.");
  require(governance.failureBoundary.ambiguousCreateRetries === 0, "Governance permits ambiguous create retries.");
  require(governance.failureBoundary.partialKeychainPairRollbackRequired === true, "Pair rollback is no longer required.");
  require(governance.failureBoundary.rollbackRestrictedToInvocationOwnershipTag === true, "Rollback may cross invocation ownership.");
  require(governance.failureBoundary.processDeathPartialPairRequiresManualReview === true, "Process-death partial pair may be silently recovered.");
  for (const [field, expected] of Object.entries({
    cloudflareAccessPerformed: false,
    realKeychainValuesAccessed: false,
    temporaryTokenCreated: false,
    serviceTokenCreated: false,
    accessPolicyChanged: false,
    deploymentPerformed: false,
    productionMutationPerformed: false,
    prospectiveCollection: "OFF",
    cohortActivation: "OFF",
    recommendationInfluence: "OFF"
  })) {
    require(governance.executionBoundary[field] === expected, `Governance execution boundary ${field} drifted.`);
  }
  require(governance.releaseBoundary.deploymentAuthorized === false, "Governance claims deployment authorization.");
  require(governance.releaseBoundary.productionExecutionAuthorized === false, "Governance claims production execution authorization.");
  require(governance.releaseBoundary.unattendedDeploymentReady === false, "Governance claims unattended readiness.");

  require(report.batchId === "BATCH-20260714-007", "Batch report ID drifted.");
  require(report.owners.implementation === "Prometheus Infrastructure", "Batch report implementation owner drifted.");
  require(report.owners.verification === "Prometheus Overwatch", "Batch report verification owner drifted.");
  require(report.owners.implementationCommit === ownerCommit, "Batch report owner commit drifted.");
  require(report.owners.repairCommit === repairCommit, "Batch report repair commit drifted.");
  require(report.owners.ownershipRespected === true, "Batch report does not affirm ownership.");
  require(report.owners.overwatchModifiedInfrastructureImplementation === false, "Batch report claims Overwatch implementation edits.");
  require(report.verificationAtOwnerHandoff.initialInfrastructureFocusedTests === "65/65_PASS", "Initial owner test evidence drifted.");
  require(report.verificationAtOwnerHandoff.infrastructureFocusedTests === "79/79_PASS", "Repair test evidence drifted.");
  require(report.verificationAtOwnerHandoff.realCloudflareUsed === false, "Batch report claims real Cloudflare use.");
  require(report.verificationAtOwnerHandoff.realKeychainValuesUsed === false, "Batch report claims real Keychain use.");
  require(report.boundaries.credentialCreated === false, "Batch report claims credential creation.");
  require(report.boundaries.accessPolicyChanged === false, "Batch report claims Access policy mutation.");
  require(report.boundaries.deploymentPerformed === false, "Batch report claims deployment.");
  require(report.boundaries.productionMutationPerformed === false, "Batch report claims production mutation.");
  require(report.boundaries.prospectiveCollection === "OFF", "Batch report claims collection activation.");
  require(report.boundaries.cohortActivation === "OFF", "Batch report claims cohort activation.");
  require(report.boundaries.recommendationInfluence === "OFF", "Batch report claims recommendation influence.");
  require(report.release.deploymentStatus === "NOT_AUTHORIZED", "Batch report deployment boundary drifted.");
  require(report.release.unattendedDeploymentStillBlocked === true, "Batch report claims unattended deployment readiness.");

  return Object.freeze({
    ok: failures.length === 0,
    failures: Object.freeze(failures)
  });
}

function verifyOwnerCommits(governance) {
  const ttyCompatibilityGovernance = readJson(ttyCompatibilityGovernancePath);
  const keychainInteroperabilityGovernance = readJson(
    keychainInteroperabilityGovernancePath
  );
  const keychainOwnerSuccessors = new Map(
    keychainInteroperabilityGovernance.ownerImplementationSuccessors
      .map(item => [item.path, item])
  );
  const ttySuccessors = new Map(
    ttyCompatibilityGovernance.infrastructureOwnerEvidence.map(item => [
      item.path,
      item.sha256AtOwnerCommit
    ])
  );
  const commitFields = git(["show", "-s", "--format=%H%n%P%n%T%n%an <%ae>%n%cn <%ce>%n%s", ownerCommit]).split("\n");
  if (!equalJson(commitFields, [
    ownerCommit,
    ownerParent,
    ownerTree,
    "Prometheus Infrastructure <infrastructure@prometheus.local>",
    "Prometheus Infrastructure <infrastructure@prometheus.local>",
    "feat(infrastructure): add attended service token provisioning"
  ])) {
    throw new Error("Infrastructure owner commit metadata does not match the governance record.");
  }
  execFileSync("/usr/bin/git", ["merge-base", "--is-ancestor", ownerCommit, "HEAD"], {
    cwd: root,
    stdio: "ignore"
  });
  const changedPaths = git(["diff-tree", "--no-commit-id", "--name-only", "-r", ownerCommit]).split("\n");
  if (!equalJson(changedPaths, expectedEvidencePaths)) {
    throw new Error("Infrastructure owner commit changed an unexpected file set.");
  }
  const forbidden = changedPaths.filter(path => path.startsWith("overwatch/")
    || path === "wrangler.jsonc"
    || path === "wrangler.prometheusrouteiq-website.jsonc"
    || path === "workers/prometheus-iq-worker.js"
    || path === "index.html");
  if (forbidden.length) throw new Error("Infrastructure owner commit crossed an ownership or production boundary.");

  for (const evidence of governance.infrastructureEvidence) {
    const ownerContent = execFileSync("/usr/bin/git", ["show", `${ownerCommit}:${evidence.path}`], {
      cwd: root,
      encoding: null,
      stdio: ["ignore", "pipe", "ignore"]
    });
    if (sha256(ownerContent) !== evidence.sha256AtOwnerCommit) {
      throw new Error(`Infrastructure owner evidence hash drifted: ${evidence.path}`);
    }
  }

  const repairFields = git(["show", "-s", "--format=%H%n%P%n%T%n%an <%ae>%n%cn <%ce>%n%s", repairCommit]).split("\n");
  if (!equalJson(repairFields, [
    repairCommit,
    repairParent,
    repairTree,
    "Prometheus Infrastructure <infrastructure@prometheus.local>",
    "Prometheus Infrastructure <infrastructure@prometheus.local>",
    "Harden founder-attended token provisioning"
  ])) {
    throw new Error("Infrastructure repair commit metadata does not match the governance record.");
  }
  execFileSync("/usr/bin/git", ["merge-base", "--is-ancestor", repairCommit, "HEAD"], {
    cwd: root,
    stdio: "ignore"
  });
  const repairPaths = git(["diff-tree", "--no-commit-id", "--name-only", "-r", repairCommit]).split("\n");
  if (!equalJson(repairPaths, expectedRepairPaths)) {
    throw new Error("Infrastructure repair commit changed an unexpected file set.");
  }
  if (repairPaths.some(path => path.startsWith("overwatch/")
    || path === "package.json"
    || path === "wrangler.jsonc"
    || path === "wrangler.prometheusrouteiq-website.jsonc"
    || path === "workers/prometheus-iq-worker.js"
    || path === "index.html")) {
    throw new Error("Infrastructure repair crossed an ownership or production boundary.");
  }

  const repairedByPath = new Map();
  for (const evidence of governance.infrastructureRepairEvidence) {
    const repairContent = execFileSync("/usr/bin/git", ["show", `${repairCommit}:${evidence.path}`], {
      cwd: root,
      encoding: null,
      stdio: ["ignore", "pipe", "ignore"]
    });
    if (sha256(repairContent) !== evidence.sha256AtRepairCommit) {
      throw new Error(`Infrastructure repair evidence hash drifted: ${evidence.path}`);
    }
    repairedByPath.set(evidence.path, evidence.sha256AtRepairCommit);
  }

  for (const evidence of governance.infrastructureEvidence) {
    if (evidence.sharedReleaseWiring) continue;
    const expected = ttySuccessors.get(evidence.path)
      || repairedByPath.get(evidence.path)
      || evidence.sha256AtOwnerCommit;
    const current = sha256(readFileSync(resolve(root, evidence.path)));
    const successor = keychainOwnerSuccessors.get(evidence.path);
    const accepted = current === expected
      || (successor?.previousSha256 === expected
        && successor?.successorSha256 === current
        && successor?.owner === "Prometheus Infrastructure");
    if (!accepted) {
      throw new Error(`Infrastructure implementation changed after the owner repair: ${evidence.path}`);
    }
  }
  for (const evidence of governance.infrastructureRepairEvidence) {
    const expected = ttySuccessors.get(evidence.path) || evidence.sha256AtRepairCommit;
    const current = sha256(readFileSync(resolve(root, evidence.path)));
    const successor = keychainOwnerSuccessors.get(evidence.path);
    const accepted = current === expected
      || (successor?.previousSha256 === expected
        && successor?.successorSha256 === current
        && successor?.owner === "Prometheus Infrastructure");
    if (!accepted) {
      throw new Error(`Infrastructure repair changed after owner handoff: ${evidence.path}`);
    }
  }
}

function verifyPackageReleaseWiring() {
  const currentPackage = readJson("package.json");
  const responseContractGovernance = readJson(responseContractGovernancePath);
  const responseContractTransition = responseContractGovernance.protectedReleaseWiringTransitions?.find(
    item => item.path === "package.json"
  );
  const createReceiptV2Governance = readJson(createReceiptV2GovernancePath);
  const packageTransition = createReceiptV2Governance.protectedReleaseWiringTransitions?.find(
    item => item.path === "package.json"
  );
  const keychainInteroperabilityGovernance = readJson(keychainInteroperabilityGovernancePath);
  const keychainTransition =
    keychainInteroperabilityGovernance.protectedReleaseWiringTransitions?.find(
      item => item.path === "package.json"
    );
  const githubDeploymentGovernance = readJson(githubDeploymentGovernancePath);
  const githubDeploymentTransition =
    githubDeploymentGovernance.protectedReleaseWiringTransitions?.find(
      item => item.path === "package.json"
    );
  const routeIq3dGovernance = readJson(routeIq3dGovernancePath);
  const routeIq3dTransition =
    routeIq3dGovernance.protectedReleaseWiringTransitions?.find(
      item => item.path === "package.json"
    );
  const publicDeploymentWorkflowV2Governance = readJson(publicDeploymentWorkflowV2GovernancePath);
  const workflowV2Transition =
    publicDeploymentWorkflowV2Governance.protectedPredecessorSuccessors?.find(item => (
      item.predecessorGovernanceId === "route-iq-3d-visual-continuity-v1"
      && item.path === "package.json"
    ));
  const controlledRehearsalReadinessSuccessors =
    readJson(controlledRehearsalReadinessSuccessorsPath);
  const controlledRehearsalPackageTransition =
    controlledRehearsalReadinessSuccessors.overwatchCurrentEvidence?.find(
      item => item.path === "package.json"
    );
  const packageOwnerFields = git([
    "show",
    "-s",
    "--format=%H%n%P%n%T%n%an <%ae>%n%cn <%ce>%n%s",
    packageReleaseWiringCommit
  ]).split("\n");
  const packageOwnerPaths = git([
    "diff-tree",
    "--no-commit-id",
    "--name-only",
    "-r",
    packageReleaseWiringCommit
  ]).split("\n").filter(Boolean).sort();
  if (responseContractTransition?.successorSha256 !== packageTransition?.previousSha256
    || packageTransition?.successorSha256 !== keychainTransition?.previousSha256
    || keychainTransition?.successorSha256 !== githubDeploymentTransition?.previousSha256
    || githubDeploymentTransition?.successorSha256 !== routeIq3dTransition?.previousSha256
    || routeIq3dTransition?.successorSha256 !== workflowV2Transition?.historicalSha256
    || !hasGovernedPublicDeploymentWorkflowV2PackageSuccessor({
      governance: publicDeploymentWorkflowV2Governance,
      predecessorGovernanceId: "route-iq-3d-visual-continuity-v1",
      historicalSha256: routeIq3dTransition?.successorSha256,
      successorSha256: controlledRehearsalPackageTransition?.previousSha256
    })
    || !hasControlledRehearsalPackageWiringSuccessor({
      governance: controlledRehearsalReadinessSuccessors,
      predecessorSha256: controlledRehearsalPackageTransition?.previousSha256,
      successorSha256: sha256(read("package.json"))
    })
    || packageTransition?.owner !== "Prometheus Overwatch"
    || keychainTransition?.owner !== "Prometheus Overwatch"
    || githubDeploymentTransition?.owner !== "Prometheus Overwatch"
    || routeIq3dTransition?.owner !== "Prometheus Overwatch"
    || workflowV2Transition?.owner !== "Prometheus Overwatch"
    || workflowV2Transition?.ownerCommit !== packageReleaseWiringCommit
    || !equalJson(packageOwnerFields, [
      packageReleaseWiringCommit,
      packageReleaseWiringParent,
      packageReleaseWiringTree,
      "Prometheus Overwatch <overwatch@prometheus.local>",
      "Prometheus Overwatch <overwatch@prometheus.local>",
      "Govern August 1 Route IQ launch readiness"
    ])
    || !equalJson(packageOwnerPaths, [...packageReleaseWiringPaths].sort())) {
    throw new Error("Current package release-wiring successor hash drifted.");
  }
  if (!currentPackage.scripts["test:overwatch"].includes("tests/overwatch-cloudflare-founder-attended-service-token.test.mjs")
    || !currentPackage.scripts["test:overwatch"].includes("tests/overwatch-cloudflare-founder-attended-tty-compatibility.test.mjs")
    || !currentPackage.scripts["test:overwatch"].includes("tests/overwatch-cloudflare-founder-attended-get-only-recovery.test.mjs")
    || !currentPackage.scripts["test:overwatch"].includes("tests/overwatch-cloudflare-founder-attended-response-contract-repair.test.mjs")
    || !currentPackage.scripts["test:overwatch"].includes("tests/overwatch-cloudflare-founder-attended-create-receipt-v2.test.mjs")
    || !currentPackage.scripts["test:overwatch"].includes("tests/overwatch-cloudflare-unattended-keychain-interoperability.test.mjs")
    || !currentPackage.scripts.test.includes("overwatch:cloudflare-founder-attended:check")
    || !currentPackage.scripts.test.includes("overwatch:cloudflare-founder-attended-tty:check")
    || !currentPackage.scripts.test.includes("overwatch:cloudflare-founder-attended-recovery:check")
    || !currentPackage.scripts.test.includes("overwatch:cloudflare-founder-attended-response-contract:check")
    || !currentPackage.scripts.test.includes("overwatch:cloudflare-founder-attended-create-receipt-v2:check")
    || !currentPackage.scripts.test.includes("overwatch:cloudflare-unattended-keychain-interoperability:check")
    || !currentPackage.scripts.test.includes("infrastructure:cloudflare-founder-attended:check")
    || !currentPackage.scripts.test.includes("infrastructure:cloudflare-founder-attended-response-contract:check")
    || !currentPackage.scripts.test.includes("infrastructure:cloudflare-founder-attended-create-receipt-v2:check")
    || !currentPackage.scripts.test.includes("infrastructure:cloudflare-unattended-keychain-interoperability:check")) {
    throw new Error("Founder-attended verification is missing from the repository release suite.");
  }
}

function verifyCanonicalRegistration() {
  const registry = readJson(registryPath);
  const matches = registry.governanceArtifacts.filter(item =>
    item.artifactId === "cloudflare-founder-attended-service-token-provisioning-governance-v1"
  );
  if (matches.length !== 1 || !equalJson(matches[0], {
    artifactId: "cloudflare-founder-attended-service-token-provisioning-governance-v1",
    artifactType: "overwatch_infrastructure_attended_credential_provisioning_governance",
    ownerSubsystem: "Prometheus Overwatch",
    path: governancePath,
    documentationPath: governanceDocumentationPath,
    schema: "CloudflareFounderAttendedServiceTokenProvisioningGovernanceV1",
    writeAllowed: ["Prometheus Overwatch"],
    readAllowed: ["Prometheus Infrastructure", "Prometheus Overwatch"],
    productionConsumer: false,
    failClosedIfMissing: true
  })) {
    throw new Error("Canonical Founder-attended governance registration drifted.");
  }
}

function verifyNoRealExecutionInTests() {
  const tests = read("tests/cloudflare-founder-attended-service-token.test.mjs");
  for (const forbidden of [
    "fetch(",
    "httpsRequest(",
    "execFileSync(",
    "spawnSync(\"/usr/bin/swift\"",
    "createFounderAttendedCloudflareTransport()",
    "createFounderAttendedMacOsKeychain()"
  ]) {
    if (tests.includes(forbidden)) throw new Error(`Infrastructure tests contain a real-execution primitive: ${forbidden}`);
  }
  const launcher = read("scripts/lib/cloudflare-unattended-launcher.mjs");
  if (launcher.includes("founder-attended")
    || launcher.includes("CLOUDFLARE_ACCESS_SERVICE_TOKENS_WRITE_API_TOKEN")) {
    throw new Error("Attended provisioning leaked into the unattended launcher.");
  }
}

export function verifyOverwatchFounderAttendedProvisioning() {
  const contract = readJson(contractPath);
  const governance = readJson(governancePath);
  const report = readJson(reportPath);
  const result = evaluateFounderAttendedProvisioningGovernance({ contract, governance, report });
  if (!result.ok) throw new Error(result.failures.join("\n"));

  verifyCloudflareFounderAttendedServiceTokenArchitecture();
  verifyOwnerCommits(governance);
  verifyPackageReleaseWiring();
  verifyCanonicalRegistration();
  verifyNoRealExecutionInTests();
  const secretFindings = scanTrackedRepository({ root });
  if (secretFindings.length) throw new Error("Tracked Cloudflare secret findings detected.");
  const localFailures = verifyLocalSecretArtifacts({ root });
  if (localFailures.length) throw new Error("Local Cloudflare secret artifact protection failed.");

  return Object.freeze({
    status: "passed",
    batchId: "BATCH-20260714-007",
    implementationOwner: "Prometheus Infrastructure",
    verificationOwner: "Prometheus Overwatch",
    implementationCommit: ownerCommit,
    repairCommit,
    packageReleaseWiringCommit,
    fixedDuration: "720h",
    fixedCreateAttemptsMaximum: 1,
    focusedOwnerTests: 79,
    trackedSecretFindings: 0,
    cloudflareAccessPerformed: false,
    realKeychainValuesAccessed: false,
    realKeychainInteroperabilityVerified: false,
    credentialCreated: false,
    deploymentPerformed: false,
    productionMutationPerformed: false,
    prospectiveCollection: "OFF",
    cohortActivation: "OFF",
    recommendationInfluence: "OFF"
  });
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  console.log(JSON.stringify(verifyOverwatchFounderAttendedProvisioning(), null, 2));
}
