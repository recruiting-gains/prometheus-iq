import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";

import {
  listTrackedFiles,
  scanTrackedRepository,
  verifyLocalSecretArtifacts
} from "./check-cloudflare-unattended-secret-presence.mjs";
const root = resolve(import.meta.dirname, "..");
const governancePath =
  "overwatch/governance/cloudflare-unattended-keychain-interoperability-v1.json";
const governanceDocumentationPath =
  "overwatch/governance/cloudflare-unattended-keychain-interoperability-v1.md";
const reportPath =
  "overwatch/reports/BATCH-20260715-008-cloudflare-unattended-keychain-interoperability.json";
const registryPath = "overwatch/artifact-contracts/canonical-artifact-registry.json";
const ownerCommit = "8fa8d6943431c68b9f5a556499243e9838378440";
const ownerParent = "845973727b3e5fe3923c45b6b90c41134355c60f";
const ownerTree = "e1cc6516c568d28e0d7f3078f41590ba8f6a994d";
const ownerRepairCommit = "12c8bc3cfaf16dc23e8eb7a26d14ed22bf70630e";
const ownerRepairParent = "94e7bc78a30dd3d0f8b272e351d2f820541c4f90";
const ownerRepairTree = "5084667426465a7df46cbbf2dc35c0f043c1436e";
const ownerVerifierRepairCommit = "26396e471a9271f957a27b8764c396fd3c5b120a";
const ownerVerifierRepairParent = "3b349e3d0501cb7fe0ba559824897aa3f440c5b3";
const ownerVerifierRepairTree = "03a1df0b8ccb9fe92e6673cb9e951044273ed32b";
const ownerCiPortabilityCommit = "af2d85d80a1abf332e202a1d24ca0c290d9d6a6b";
const ownerCiPortabilityParent = "bb0fe15841027a63ccbebfeeac21e5ead4d5e76c";
const ownerCiPortabilityTree = "955431d084ed6e529490e71e6432c8007217db36";

const ownerHashes = Object.freeze({
  "docs/cloudflare-unattended-keychain-interoperability-v1.md":
    "209f5367e69140229030f2343f828e0d2aeace34ae8f9f2f7b812fb92771ccac",
  "scripts/helpers/cloudflare-unattended-keychain-acl.swift":
    "1ae1013a1ebe18216e0216add7b7e2fc1bdef9f001bdb25d0859b0aaeaa76c09",
  "scripts/lib/cloudflare-unattended-keychain-interoperability.mjs":
    "b669953475f180043aa0831a35c755b7ca42e1a1545cf4d5de3693e3a43180be",
  "scripts/lib/cloudflare-unattended-keychain.mjs":
    "4b59a1d43ea82fe888b7830286da954adb3e50e6f995f79e2f24a9401f42a475",
  "scripts/lib/cloudflare-unattended-launcher.mjs":
    "82f1afb5e29310f73a411458c24942bdeb9c21ef0017e8a8f764d6c714a44fa4",
  "scripts/run-cloudflare-unattended-keychain-interoperability.mjs":
    "724be8c71e1cb1b737e78fa5cffa77e3ccdc04e785631d378aeec585b617be3c",
  "scripts/verify-cloudflare-unattended-keychain-interoperability.mjs":
    "98d40d6fd46bf079d8ac8bfccd6458e7a94cbea69125fe941c219eb3b88ed5ef",
  "tests/cloudflare-unattended-keychain-interoperability.test.mjs":
    "79daa55d323eb0c970ae6da02d7f902981c609a6a6f8117ec18e09baab8d2bac",
  "workers/infrastructure/cloudflare-unattended-keychain-interoperability-v1.json":
    "b7919a79a375dd9c0d6eda0406d0f9be6ba08f72c87ea2ea881face2438260f8"
});

const protectedOverwatchVerifierSuccessors = Object.freeze([
  {
    path: "scripts/verify-overwatch-cloudflare-unattended-access.mjs",
    previousSha256: "44e32c3751b4ac58241061e505ba5d05a451d85b73280b06cb1473c900a94dd1",
    successorSha256: "6365219622cd6aebb4db6bfee5d8c76a5250fef7b3f735a5f1974bd0d94d635b",
    owner: "Prometheus Overwatch"
  },
  {
    path: "scripts/verify-overwatch-cloudflare-founder-attended-service-token.mjs",
    previousSha256: "b472dbea6fa01736f6740e41a86b935ac3221c5ba6d35b8bbb3d350a28085ebb",
    successorSha256: "2790795f724fe7d5c251cac45605e922372c4cec2f6b924e9dd11d218ad189f0",
    owner: "Prometheus Overwatch"
  },
  {
    path: "scripts/verify-overwatch-cloudflare-founder-attended-tty-compatibility.mjs",
    previousSha256: "78066379c15af37fda8599623a229ae64e8ff1596fcc34325456275931f01e89",
    successorSha256: "e7b0c8f9072ed353ffbc912ddc6476c4db33e6d18b097e257627e1b3d030083c",
    owner: "Prometheus Overwatch"
  },
  {
    path: "scripts/verify-overwatch-cloudflare-founder-attended-get-only-recovery.mjs",
    previousSha256: "d2fdb09fda0864ae6c9215f14e7f6889645875dfdb1e4c303ac8b5bb8c4f67b8",
    successorSha256: "886a51d70c9ac5df6b30741a740f7f23b0f7a51220a52e596d93802d04f8aa1e",
    owner: "Prometheus Overwatch"
  },
  {
    path: "scripts/verify-overwatch-cloudflare-founder-attended-response-contract-repair.mjs",
    previousSha256: "54319ae218ab745aeb0e300429b7227593445a3c4b4549e20b4735e9b2dd426a",
    successorSha256: "5b7593db044d5386d77975b81efe5691e514182fd147e5173abc49d7b8371aad",
    owner: "Prometheus Overwatch"
  },
  {
    path: "scripts/verify-overwatch-cloudflare-founder-attended-create-receipt-v2.mjs",
    previousSha256: "1bc79b392ca6d3620b6d5792a48afd1c63ee1babb1aa0091366907365b53e306",
    successorSha256: "707644d0e0f89a02df6fa74ec3c1ad40f27272828b0dd9961c3d934ad5554518",
    owner: "Prometheus Overwatch"
  },
  {
    path: "scripts/verify-overwatch-cloudflare-founder-attended-fresh-attempt-evidence-rotation.mjs",
    previousSha256: "9b5117143e5800cc49838b6ef377d85de183cfbae08d433b30edfc0bb353dee9",
    successorSha256: "4f91b626802f9f7d60e5f6f5c546c6291938db9ab9910b9804c770dd96abf35e",
    owner: "Prometheus Overwatch"
  }
]);

const ownerImplementationSuccessors = Object.freeze([
  {
    path: "tests/cloudflare-founder-attended-service-token.test.mjs",
    previousSha256: "05ab27c49a5d629bfb556944081893b23fd3c4c3a247565a8ed02c6440fb496b",
    successorSha256: "473a26d8554360837338c41e5fe14960cef985bff33361e63a2f13f144c30cd9",
    ownerCommit: ownerRepairCommit,
    owner: "Prometheus Infrastructure"
  },
  {
    path: "tests/cloudflare-unattended-keychain-interoperability.test.mjs",
    previousSha256: "79daa55d323eb0c970ae6da02d7f902981c609a6a6f8117ec18e09baab8d2bac",
    successorSha256: "492217e6f2a6b14ec0588e2e08cf4f1e0f2d4a1eb2757c995fc256fee25b9f8a",
    ownerCommit: ownerRepairCommit,
    owner: "Prometheus Infrastructure"
  }
]);

const ownerVerifierSuccessors = Object.freeze([
  {
    path: "scripts/verify-cloudflare-founder-attended-create-receipt-v2.mjs",
    previousSha256: "54a6d28ce672594f369bb623c699831804a116c034f7bff566b78860897b01e0",
    successorSha256: "ff6ca4ede5366ab0dbd86299cb758728130b17f90b475b14eccdabb6137096cd",
    ownerCommit: ownerVerifierRepairCommit,
    owner: "Prometheus Infrastructure"
  },
  {
    path: "scripts/verify-cloudflare-founder-attended-response-contract-repair.mjs",
    previousSha256: "8ce6e7c096a867ff168c5a99f38d8d885c011adbb1b42accf2669b14c8e2252d",
    successorSha256: "f52922d6094b321f905ee41c17f1feff73a804cb7496fceb0c684d24b03f1ffe",
    ownerCommit: ownerVerifierRepairCommit,
    owner: "Prometheus Infrastructure"
  },
  {
    path: "tests/cloudflare-founder-attended-owner-verifier-ownership.test.mjs",
    previousSha256: "1ee230b0cddd87005504d9ce1d548240d7b81b5b1a642dfb93da398d7e84832f",
    successorSha256: "ddf8468f54382ef2fdff0d80ceb07ba814a4d17624d8e8f113a7e7dd5c980f85",
    ownerCommit: ownerVerifierRepairCommit,
    owner: "Prometheus Infrastructure"
  }
]);

const ownerCiPortabilitySuccessors = Object.freeze([
  {
    path: "scripts/verify-cloudflare-unattended-keychain-interoperability.mjs",
    previousSha256: "98d40d6fd46bf079d8ac8bfccd6458e7a94cbea69125fe941c219eb3b88ed5ef",
    successorSha256: "df78ec38424ac7938acfce625445ecb5dc047d3743a7776832a768049a4c36f3",
    ownerCommit: ownerCiPortabilityCommit,
    owner: "Prometheus Infrastructure"
  },
  {
    path: "tests/cloudflare-unattended-keychain-interoperability.test.mjs",
    previousSha256: "492217e6f2a6b14ec0588e2e08cf4f1e0f2d4a1eb2757c995fc256fee25b9f8a",
    successorSha256: "3a6a7fea191da9a66b107722aa33cffebaec6bee16dc115a26aec528750ad976",
    ownerCommit: ownerCiPortabilityCommit,
    owner: "Prometheus Infrastructure"
  }
]);

const githubDeploymentOwnerPaths = new Set([
  ".github/workflows/deploy-prometheus-private-worker.yml",
  "docs/github-actions-founder-triggered-private-worker-deployment-v1.md",
  "scripts/lib/github-actions-private-worker-deployment.mjs",
  "scripts/run-github-actions-private-worker-deployment.mjs",
  "scripts/verify-github-actions-private-worker-deployment.mjs",
  "tests/github-actions-private-worker-deployment.test.mjs",
  "workers/infrastructure/github-actions-founder-triggered-private-worker-deployment-v1.json"
]);
const githubDeploymentUniqueOverwatchPaths = new Set([
  "overwatch/governance/github-actions-founder-triggered-private-worker-deployment-v1.json",
  "overwatch/governance/github-actions-founder-triggered-private-worker-deployment-v1.md",
  "overwatch/reports/BATCH-20260715-010-github-actions-founder-triggered-private-worker-deployment.json",
  "overwatch/reports/BATCH-20260715-011-github-private-repository-founder-deployment-authorization.json",
  "scripts/verify-overwatch-github-actions-private-worker-deployment.mjs",
  "tests/overwatch-github-actions-private-worker-deployment.test.mjs"
]);

const expectedOverwatchPaths = Object.freeze([
  "overwatch/artifact-contracts/canonical-artifact-registry.json",
  governanceDocumentationPath,
  governancePath,
  reportPath,
  "package.json",
  "scripts/verify-overwatch-cloudflare-founder-attended-create-receipt-v2.mjs",
  "scripts/verify-overwatch-cloudflare-founder-attended-fresh-attempt-evidence-rotation.mjs",
  "scripts/verify-overwatch-cloudflare-founder-attended-get-only-recovery.mjs",
  "scripts/verify-overwatch-cloudflare-founder-attended-response-contract-repair.mjs",
  "scripts/verify-overwatch-cloudflare-founder-attended-service-token.mjs",
  "scripts/verify-overwatch-cloudflare-founder-attended-tty-compatibility.mjs",
  "scripts/verify-overwatch-cloudflare-unattended-access.mjs",
  "scripts/verify-overwatch-cloudflare-unattended-keychain-interoperability.mjs",
  "tests/cross-subsystem-artifact-contracts.test.mjs",
  "tests/overwatch-cloudflare-unattended-keychain-interoperability.test.mjs"
]);

const infrastructureIdentity =
  "Prometheus Infrastructure <infrastructure@prometheus.local>";
const overwatchIdentity = "Prometheus Overwatch <overwatch@prometheus.local>";
const infrastructureOwnedPaths = new Set([
  ...Object.keys(ownerHashes),
  ...ownerImplementationSuccessors.map(item => item.path),
  ...ownerVerifierSuccessors.map(item => item.path),
  ...ownerCiPortabilitySuccessors.map(item => item.path),
  ...githubDeploymentOwnerPaths
]);
const overwatchOwnedPaths = new Set([
  ...expectedOverwatchPaths,
  ...githubDeploymentUniqueOverwatchPaths
]);

function protectedPathOwner(path) {
  if (infrastructureOwnedPaths.has(path)) return infrastructureIdentity;
  if (overwatchOwnedPaths.has(path)) return overwatchIdentity;
  if (/^overwatch\/(?:governance|reports)\/.*cloudflare-unattended-keychain/u.test(path)
    || /^scripts\/verify-overwatch-cloudflare-unattended-keychain/u.test(path)
    || /^tests\/overwatch-cloudflare-unattended-keychain/u.test(path)) {
    return overwatchIdentity;
  }
  if (/^(?:docs|scripts|tests|workers\/infrastructure)\/.*cloudflare-unattended-keychain/u
    .test(path)) {
    return infrastructureIdentity;
  }
  return null;
}

export function evaluateCloudflareUnattendedKeychainSuccessorOwnership(commits) {
  const failures = [];
  for (const commit of commits) {
    const protectedOwners = new Set(
      commit.paths.map(protectedPathOwner).filter(Boolean)
    );
    if (protectedOwners.size === 0) continue;
    if (protectedOwners.size !== 1) {
      failures.push(`Cross-owner protected successor detected: ${commit.commit}`);
      continue;
    }
    const expectedIdentity = [...protectedOwners][0];
    if (commit.author !== expectedIdentity || commit.committer !== expectedIdentity) {
      failures.push(`Protected successor ownership drifted: ${commit.commit}`);
    }
  }
  return Object.freeze({
    ok: failures.length === 0,
    failures: Object.freeze(failures)
  });
}

const read = path => readFileSync(resolve(root, path), "utf8");
const readJson = path => JSON.parse(read(path));
const sha256 = value => createHash("sha256").update(value).digest("hex");
const equal = (left, right) => isDeepStrictEqual(left, right);
const git = args => execFileSync("/usr/bin/git", args, {
  cwd: root,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "ignore"]
}).trim();

export function evaluateCloudflareUnattendedKeychainInteroperabilityGovernance({
  governance,
  report
}) {
  const failures = [];
  const require = (condition, message) => {
    if (!condition) failures.push(message);
  };

  require(governance.governanceId ===
    "cloudflare-unattended-keychain-interoperability-governance-v1",
  "Governance ID drifted.");
  require(governance.batchId === "BATCH-20260715-008", "Batch ID drifted.");
  require(governance.owningSubsystem === "Prometheus Overwatch",
    "Governance owner drifted.");
  require(governance.dispatchAudit.implementationOwner === "Prometheus Infrastructure",
    "Implementation owner drifted.");
  require(governance.dispatchAudit.verificationOwner === "Prometheus Overwatch",
    "Verification owner drifted.");
  require(governance.dispatchAudit.implementationCommit.commit === ownerCommit,
    "Owner commit drifted.");
  require(governance.dispatchAudit.implementationCommit.parent === ownerParent,
    "Owner parent drifted.");
  require(governance.dispatchAudit.implementationCommit.tree === ownerTree,
    "Owner tree drifted.");
  require(equal(governance.dispatchAudit.ownerRepairCommit, {
    commit: ownerRepairCommit,
    parent: ownerRepairParent,
    tree: ownerRepairTree,
    subject: "Align attended Keychain compatibility fixtures"
  }), "Owner repair commit drifted.");
  require(equal(governance.dispatchAudit.ownerVerifierRepairCommit, {
    commit: ownerVerifierRepairCommit,
    parent: ownerVerifierRepairParent,
    tree: ownerVerifierRepairTree,
    subject: "Authenticate Keychain fixture successor"
  }), "Owner verifier repair commit drifted.");
  require(equal(governance.dispatchAudit.ownerCiPortabilityCommit, {
    commit: ownerCiPortabilityCommit,
    parent: ownerCiPortabilityParent,
    tree: ownerCiPortabilityTree,
    subject: "Make Keychain owner verifier portable in CI"
  }), "Owner CI portability commit drifted.");
  require(governance.dispatchAudit.implementationOwnershipRespected === true,
    "Implementation ownership is not affirmed.");
  require(governance.dispatchAudit.overwatchModifiedInfrastructureImplementation === false,
    "Overwatch claims an Infrastructure implementation edit.");
  require(equal(governance.ownerEvidence, Object.entries(ownerHashes).map(
    ([path, sha256AtOwnerCommit]) => ({ path, sha256AtOwnerCommit })
  )), "Owner evidence map drifted.");
  require(equal(governance.protectedPredecessorSuccessors, [
    {
      predecessorGovernanceId: "cloudflare-unattended-deployment-access-governance-v1",
      path: "scripts/lib/cloudflare-unattended-launcher.mjs",
      historicalSha256: "dd54e8e84502812a489916cc8c03e6482c279f0ebccea126eabe3826707b4ace",
      successorSha256: "82f1afb5e29310f73a411458c24942bdeb9c21ef0017e8a8f764d6c714a44fa4",
      successorCommit: ownerCommit,
      successorOwner: "Prometheus Infrastructure",
      reason: "The owner repair moved Keychain retrieval into the shared bounded classifier module without broadening launcher profiles or release authority."
    },
    {
      predecessorGovernanceId: "cloudflare-unattended-deployment-access-governance-v1",
      path: "package.json",
      historicalSha256: "a150ca1b1121c779415365551efdbff970e458915ba6491716ccbfdd0a111d0d",
      successorSha256: "20ef38b1eb8a04119362e72338329ddfa0c3d2b2272a4b9526a65d8a5c01061d",
      successorCommit: "5fc6920cee1c2b5b0183f4eebc07fbe344368e2f",
      successorOwner: "Prometheus Overwatch",
      reason: "Overwatch added only the new owner and independent verification commands to the existing release matrix."
    }
  ]), "Protected predecessor successor mapping drifted.");
  require(equal(governance.protectedReleaseWiringTransitions, [
    {
      path: "package.json",
      previousSha256: "58c83891f30ca274d295eaf70f98424624c98667b638a1b3954c437248c705aa",
      successorSha256: "20ef38b1eb8a04119362e72338329ddfa0c3d2b2272a4b9526a65d8a5c01061d",
      owner: "Prometheus Overwatch",
      reason: "Register Infrastructure-owner and independent Overwatch Keychain interoperability gates in the complete repository suite."
    }
  ]), "Protected package release-wiring transition drifted.");
  require(equal(governance.protectedOverwatchVerifierSuccessors,
    protectedOverwatchVerifierSuccessors),
  "Protected Overwatch verifier successor mapping drifted.");
  require(equal(governance.ownerImplementationSuccessors,
    ownerImplementationSuccessors),
  "Owner implementation successor mapping drifted.");
  require(equal(governance.ownerVerifierSuccessors, ownerVerifierSuccessors),
    "Owner verifier successor mapping drifted.");
  require(equal(governance.ownerCiPortabilitySuccessors,
    ownerCiPortabilitySuccessors),
  "Owner CI portability successor mapping drifted.");

  const classification = governance.independentRetrievalClassification;
  require(classification.executionIdentity === "MATCHED",
    "Execution identity is not matched.");
  require(classification.keychainState === "UNLOCKED", "Keychain is not unlocked.");
  require(classification.result === "FAIL", "Classification result drifted.");
  require(equal(classification.items, [
    { alias: "DEPLOYMENT_API_TOKEN", presence: "PRESENT", retrieval: "NOT_RETRIEVABLE", reason: "INTERACTION_REQUIRED" },
    { alias: "CLOUDFLARE_ACCOUNT_ID", presence: "PRESENT", retrieval: "NOT_RETRIEVABLE", reason: "INTERACTION_REQUIRED" },
    { alias: "SMOKE_CLIENT_ID", presence: "PRESENT", retrieval: "NOT_RETRIEVABLE", reason: "INTERACTION_REQUIRED" },
    { alias: "SMOKE_CLIENT_SECRET", presence: "PRESENT", retrieval: "NOT_RETRIEVABLE", reason: "INTERACTION_REQUIRED" }
  ]), "Safe four-item classification drifted.");
  require(classification.valuesDisplayedLoggedHashedReportedOrPersisted === false,
    "Classification permits credential exposure.");
  require(classification.cloudflareNetworkPathPresent === false,
    "Classification has a Cloudflare network path.");

  const containment = governance.staleProcessContainment;
  require(containment.priorBlockedDeploymentQueryParentTerminated === true,
    "Prior blocked parent was not contained.");
  require(containment.orphanedKeychainReaderTerminated === true,
    "Orphaned Keychain reader was not contained.");
  require(containment.allPriorReadersAbsentBeforeClassification === true,
    "Classification may overlap a stale reader.");
  require(containment.priorCallPathReachedCloudflare === false,
    "Governance claims the prior path reached Cloudflare.");

  const boundary = governance.classificationBoundary;
  require(boundary.fixedExecutable === "/usr/bin/security",
    "Keychain executable drifted.");
  require(boundary.fixedItemCount === 4, "Keychain item count drifted.");
  require(boundary.callerSuppliedItemAllowed === false,
    "Caller-supplied Keychain items are allowed.");
  require(boundary.callerSuppliedExecutableAllowed === false,
    "Caller-supplied executables are allowed.");
  require(boundary.maximumCapturedBytes === 65536,
    "Captured credential buffer bound drifted.");
  require(boundary.retrievalTimeoutMilliseconds === 5000,
    "Retrieval timeout drifted.");
  require(boundary.capturedBuffersZeroed === true && boundary.safeOutputStatesOnly === true,
    "Secret-safe output boundary drifted.");

  const remediation = governance.remediationBoundary;
  require(remediation.founderAttendedNativeControllingTtyRequired === true,
    "Founder attendance is not required.");
  require(remediation.freshClassificationMaximumMinutes === 30,
    "Classification lifetime drifted.");
  require(equal(remediation.remediableReasons,
    ["ACL_ACCESS_DENIED", "INTERACTION_REQUIRED"]),
  "Remediable reason set drifted.");
  require(remediation.wholeKeychainAclChangeAllowed === false,
    "Whole-Keychain ACL changes are allowed.");
  require(remediation.credentialValueOrIdentityChangeAllowed === false,
    "Credential value or identity changes are allowed.");
  require(remediation.trustedExecutable === "/usr/bin/security"
    && remediation.perItemDecryptAclOnly === true,
  "Item-level ACL scope drifted.");
  require(remediation.postRemediationFourItemRetrievalPassRequired === true,
    "Post-remediation retrieval verification is not required.");
  require(remediation.partialFailureRollsBackNewTrust === true,
    "Partial remediation rollback is not required.");
  require(remediation.explicitRollbackRemovesOnlyTrustAddedByThisRepair === true,
    "Rollback scope drifted.");

  require(governance.controlBoundary.unattendedDeploymentControl === "OFF"
    && governance.controlBoundary.controlFilePresent === false
    && governance.controlBoundary.consumedNonceCount === 0,
  "Unattended control is not OFF and unconsumed.");
  for (const [field, expected] of Object.entries({
    cloudflareRequestPerformed: false,
    deploymentPerformed: false,
    accessPolicyMutated: false,
    credentialValueModified: false,
    keychainAclModified: false,
    productionDataMutated: false,
    prospectiveCollection: "OFF",
    activeCohorts: 0,
    recommendationInfluence: "OFF"
  })) {
    require(governance.executionBoundary[field] === expected,
      `Execution boundary drifted: ${field}.`);
  }
  require(governance.releaseBoundary.deploymentAuthorized === false,
    "Deployment became authorized.");
  require(governance.releaseBoundary.attendedAclRemediationExecutedByThisBatch === false,
    "Governance claims attended remediation was executed.");
  require(governance.releaseBoundary.unattendedDeploymentReadyBeforeAttendedRemediation === false,
    "Unattended deployment is prematurely ready.");

  require(report.batchId === "BATCH-20260715-008", "Report batch drifted.");
  require(report.owners.implementation === "Prometheus Infrastructure"
    && report.owners.verification === "Prometheus Overwatch",
  "Report ownership drifted.");
  require(report.owners.implementationCommit === ownerCommit
    && report.owners.implementationRepairCommit === ownerRepairCommit
    && report.owners.implementationVerifierRepairCommit === ownerVerifierRepairCommit
    && report.owners.implementationCiPortabilityCommit === ownerCiPortabilityCommit,
  "Report owner commit chain drifted.");
  require(report.owners.ownershipRespected === true
    && report.owners.overwatchModifiedInfrastructureImplementation === false,
  "Report ownership boundary drifted.");
  require(report.safeClassification.result === "FAIL_REMEDIATION_REQUIRED",
    "Report classification drifted.");
  require(report.boundaries.cloudflareRequestPerformed === false
    && report.boundaries.keychainAclModified === false
    && report.boundaries.deploymentPerformed === false,
  "Report claims an unauthorized external action.");

  return Object.freeze({ ok: failures.length === 0, failures: Object.freeze(failures) });
}

function verifyOwnerCommit(governance) {
  const fields = git([
    "show", "-s", "--format=%H%n%P%n%T%n%an <%ae>%n%cn <%ce>%n%s", ownerCommit
  ]).split("\n");
  if (!equal(fields, [
    ownerCommit,
    ownerParent,
    ownerTree,
    "Prometheus Infrastructure <infrastructure@prometheus.local>",
    "Prometheus Infrastructure <infrastructure@prometheus.local>",
    "Repair unattended Keychain retrieval interoperability"
  ])) throw new Error("Infrastructure commit metadata drifted.");

  const paths = git(["diff-tree", "--no-commit-id", "--name-only", "-r", ownerCommit])
    .split("\n").filter(Boolean);
  if (!equal(paths, Object.keys(ownerHashes))) {
    throw new Error("Infrastructure owner file set drifted.");
  }
  if (paths.some(path => path === "package.json" || path.startsWith("overwatch/"))) {
    throw new Error("Infrastructure crossed the Overwatch ownership boundary.");
  }
  execFileSync("/usr/bin/git", ["merge-base", "--is-ancestor", ownerCommit, "HEAD"], {
    cwd: root,
    stdio: "ignore"
  });

  const evidence = new Map(governance.ownerEvidence.map(item => [item.path, item]));
  const successors = new Map(
    governance.ownerImplementationSuccessors.map(item => [item.path, item])
  );
  const ciPortabilitySuccessors = new Map(
    governance.ownerCiPortabilitySuccessors.map(item => [item.path, item])
  );
  for (const [path, expectedHash] of Object.entries(ownerHashes)) {
    const ownerBytes = execFileSync("/usr/bin/git", ["show", `${ownerCommit}:${path}`], {
      cwd: root,
      encoding: null,
      stdio: ["ignore", "pipe", "ignore"]
    });
    const currentHash = sha256(readFileSync(resolve(root, path)));
    const successor = successors.get(path);
    const ciPortabilitySuccessor = ciPortabilitySuccessors.get(path);
    const acceptedPredecessorHash = successor?.successorSha256 ?? expectedHash;
    const currentAccepted = currentHash === expectedHash
      || (successor?.previousSha256 === expectedHash
        && successor?.successorSha256 === currentHash
        && successor?.ownerCommit === ownerRepairCommit
        && successor?.owner === "Prometheus Infrastructure")
      || (ciPortabilitySuccessor?.previousSha256 === acceptedPredecessorHash
        && ciPortabilitySuccessor?.successorSha256 === currentHash
        && ciPortabilitySuccessor?.ownerCommit === ownerCiPortabilityCommit
        && ciPortabilitySuccessor?.owner === "Prometheus Infrastructure");
    if (sha256(ownerBytes) !== expectedHash
      || !currentAccepted
      || evidence.get(path)?.sha256AtOwnerCommit !== expectedHash) {
      throw new Error(`Infrastructure owner evidence drifted: ${path}`);
    }
  }

  const repairFields = git([
    "show", "-s", "--format=%H%n%P%n%T%n%an <%ae>%n%cn <%ce>%n%s",
    ownerRepairCommit
  ]).split("\n");
  if (!equal(repairFields, [
    ownerRepairCommit,
    ownerRepairParent,
    ownerRepairTree,
    "Prometheus Infrastructure <infrastructure@prometheus.local>",
    "Prometheus Infrastructure <infrastructure@prometheus.local>",
    "Align attended Keychain compatibility fixtures"
  ])) throw new Error("Infrastructure owner repair metadata drifted.");
  const repairPaths = git([
    "diff-tree", "--no-commit-id", "--name-only", "-r", ownerRepairCommit
  ]).split("\n").filter(Boolean);
  if (!equal(repairPaths, ownerImplementationSuccessors.map(item => item.path))) {
    throw new Error("Infrastructure owner repair file set drifted.");
  }
  if (repairPaths.some(path => path === "package.json" || path.startsWith("overwatch/"))) {
    throw new Error("Infrastructure owner repair crossed the Overwatch boundary.");
  }
  execFileSync("/usr/bin/git", [
    "merge-base", "--is-ancestor", ownerRepairCommit, "HEAD"
  ], { cwd: root, stdio: "ignore" });
  for (const successor of ownerImplementationSuccessors) {
    const previous = execFileSync(
      "/usr/bin/git", ["show", `${ownerRepairParent}:${successor.path}`], {
        cwd: root,
        encoding: null,
        stdio: ["ignore", "pipe", "ignore"]
      }
    );
    const repaired = execFileSync(
      "/usr/bin/git", ["show", `${ownerRepairCommit}:${successor.path}`], {
        cwd: root,
        encoding: null,
        stdio: ["ignore", "pipe", "ignore"]
      }
    );
    const currentHash = sha256(readFileSync(resolve(root, successor.path)));
    const ciPortabilitySuccessor = ciPortabilitySuccessors.get(successor.path);
    const currentAccepted = currentHash === successor.successorSha256
      || (ciPortabilitySuccessor?.previousSha256 === successor.successorSha256
        && ciPortabilitySuccessor?.successorSha256 === currentHash
        && ciPortabilitySuccessor?.ownerCommit === ownerCiPortabilityCommit
        && ciPortabilitySuccessor?.owner === "Prometheus Infrastructure");
    if (sha256(previous) !== successor.previousSha256
      || sha256(repaired) !== successor.successorSha256
      || !currentAccepted) {
      throw new Error(`Infrastructure owner repair evidence drifted: ${successor.path}`);
    }
  }

  const verifierRepairFields = git([
    "show", "-s", "--format=%H%n%P%n%T%n%an <%ae>%n%cn <%ce>%n%s",
    ownerVerifierRepairCommit
  ]).split("\n");
  if (!equal(verifierRepairFields, [
    ownerVerifierRepairCommit,
    ownerVerifierRepairParent,
    ownerVerifierRepairTree,
    "Prometheus Infrastructure <infrastructure@prometheus.local>",
    "Prometheus Infrastructure <infrastructure@prometheus.local>",
    "Authenticate Keychain fixture successor"
  ])) throw new Error("Infrastructure owner verifier repair metadata drifted.");
  const verifierRepairPaths = git([
    "diff-tree", "--no-commit-id", "--name-only", "-r", ownerVerifierRepairCommit
  ]).split("\n").filter(Boolean);
  if (!equal(verifierRepairPaths, ownerVerifierSuccessors.map(item => item.path))) {
    throw new Error("Infrastructure owner verifier repair file set drifted.");
  }
  if (verifierRepairPaths.some(path => path === "package.json"
    || path.startsWith("overwatch/")
    || path.startsWith("scripts/verify-overwatch-"))) {
    throw new Error("Infrastructure owner verifier repair crossed the Overwatch boundary.");
  }
  execFileSync("/usr/bin/git", [
    "merge-base", "--is-ancestor", ownerVerifierRepairCommit, "HEAD"
  ], { cwd: root, stdio: "ignore" });
  for (const successor of ownerVerifierSuccessors) {
    const previous = execFileSync(
      "/usr/bin/git", ["show", `${ownerVerifierRepairParent}:${successor.path}`], {
        cwd: root,
        encoding: null,
        stdio: ["ignore", "pipe", "ignore"]
      }
    );
    const repaired = execFileSync(
      "/usr/bin/git", ["show", `${ownerVerifierRepairCommit}:${successor.path}`], {
        cwd: root,
        encoding: null,
        stdio: ["ignore", "pipe", "ignore"]
      }
    );
    if (sha256(previous) !== successor.previousSha256
      || sha256(repaired) !== successor.successorSha256
      || sha256(readFileSync(resolve(root, successor.path))) !== successor.successorSha256) {
      throw new Error(`Infrastructure owner verifier repair drifted: ${successor.path}`);
    }
  }

  const ciPortabilityFields = git([
    "show", "-s", "--format=%H%n%P%n%T%n%an <%ae>%n%cn <%ce>%n%s",
    ownerCiPortabilityCommit
  ]).split("\n");
  if (!equal(ciPortabilityFields, [
    ownerCiPortabilityCommit,
    ownerCiPortabilityParent,
    ownerCiPortabilityTree,
    "Prometheus Infrastructure <infrastructure@prometheus.local>",
    "Prometheus Infrastructure <infrastructure@prometheus.local>",
    "Make Keychain owner verifier portable in CI"
  ])) throw new Error("Infrastructure owner CI portability metadata drifted.");
  const ciPortabilityPaths = git([
    "diff-tree", "--no-commit-id", "--name-only", "-r", ownerCiPortabilityCommit
  ]).split("\n").filter(Boolean);
  if (!equal(ciPortabilityPaths,
    ownerCiPortabilitySuccessors.map(item => item.path))) {
    throw new Error("Infrastructure owner CI portability file set drifted.");
  }
  execFileSync("/usr/bin/git", [
    "merge-base", "--is-ancestor", ownerCiPortabilityCommit, "HEAD"
  ], { cwd: root, stdio: "ignore" });
  for (const successor of ownerCiPortabilitySuccessors) {
    const previous = execFileSync(
      "/usr/bin/git", ["show", `${ownerCiPortabilityParent}:${successor.path}`], {
        cwd: root,
        encoding: null,
        stdio: ["ignore", "pipe", "ignore"]
      }
    );
    const repaired = execFileSync(
      "/usr/bin/git", ["show", `${ownerCiPortabilityCommit}:${successor.path}`], {
        cwd: root,
        encoding: null,
        stdio: ["ignore", "pipe", "ignore"]
      }
    );
    if (sha256(previous) !== successor.previousSha256
      || sha256(repaired) !== successor.successorSha256
      || sha256(readFileSync(resolve(root, successor.path))) !== successor.successorSha256) {
      throw new Error(`Infrastructure owner CI portability evidence drifted: ${successor.path}`);
    }
  }
}

function statusPaths() {
  return execFileSync("/usr/bin/git", [
    "status", "--porcelain=v1", "--untracked-files=all"
  ], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"]
  }).trimEnd()
    .split("\n").filter(Boolean).map(line => line.slice(3));
}

function verifyOverwatchOwnership() {
  const head = git(["rev-parse", "HEAD"]);
  if (head === ownerCommit) {
    const paths = statusPaths();
    if (!equal([...paths].sort(), [...expectedOverwatchPaths].sort())) {
      throw new Error("Uncommitted Overwatch release-wiring set drifted.");
    }
    return;
  }

  const commits = git(["rev-list", "--reverse", `${ownerCommit}..HEAD`])
    .split("\n").filter(Boolean);
  if (commits.length === 0) throw new Error("Overwatch governance commit is missing.");
  const successorOwnership = evaluateCloudflareUnattendedKeychainSuccessorOwnership(
    commits.map(commit => {
      const [author, committer] = git([
        "show", "-s", "--format=%an <%ae>%n%cn <%ce>", commit
      ]).split("\n");
      return {
        commit,
        author,
        committer,
        paths: git(["diff-tree", "--no-commit-id", "--name-only", "-r", commit])
          .split("\n").filter(Boolean)
      };
    })
  );
  if (!successorOwnership.ok) {
    throw new Error(successorOwnership.failures.join("\n"));
  }
  const paths = git(["diff", "--name-only", ownerCommit, "HEAD"])
    .split("\n").filter(Boolean);
  const ownerRepairPaths = new Set(ownerImplementationSuccessors.map(item => item.path));
  const ownerVerifierRepairPaths = new Set(ownerVerifierSuccessors.map(item => item.path));
  const overwatchPaths = paths.filter(path => (
    expectedOverwatchPaths.includes(path)
      && !ownerRepairPaths.has(path)
      && !ownerVerifierRepairPaths.has(path)
      && !githubDeploymentOwnerPaths.has(path)
      && !githubDeploymentUniqueOverwatchPaths.has(path)
  ));
  if (!equal([...overwatchPaths].sort(), [...expectedOverwatchPaths].sort())) {
    throw new Error("Overwatch governance file set drifted.");
  }
  if (overwatchPaths.some(path => Object.hasOwn(ownerHashes, path)
    || path.startsWith("workers/infrastructure/")
    || path.startsWith("scripts/lib/cloudflare-unattended-keychain")
    || path.startsWith("scripts/helpers/"))) {
    throw new Error("Overwatch modified Infrastructure implementation.");
  }
}

function verifyRegistry() {
  const registry = readJson(registryPath);
  const artifact = registry.governanceArtifacts.find(item => item.artifactId ===
    "cloudflare-unattended-keychain-interoperability-governance-v1");
  if (!artifact
    || artifact.ownerSubsystem !== "Prometheus Overwatch"
    || artifact.path !== governancePath
    || artifact.documentationPath !== governanceDocumentationPath
    || artifact.productionConsumer !== false
    || artifact.failClosedIfMissing !== true) {
    throw new Error("Canonical Keychain interoperability governance registration drifted.");
  }
}

function verifyOwnerVerifier() {
  const output = execFileSync(process.execPath, [
    "scripts/verify-cloudflare-unattended-keychain-interoperability.mjs"
  ], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"]
  });
  const result = JSON.parse(output);
  if (result.result !== "passed"
    || result.implementationOwner !== "Prometheus Infrastructure"
    || result.fixedItemCount !== 4
    || result.cloudflareContacted !== false
    || result.keychainValuesRead !== false
    || result.deploymentPerformed !== false
    || result.productionMutated !== false
    || !["passed", "not_applicable"].includes(result.swiftTypecheck)
    || (process.platform === "darwin" && result.swiftTypecheck !== "passed")
    || (process.platform !== "darwin" && result.swiftTypecheck !== "not_applicable")) {
    throw new Error("Infrastructure owner verifier failed.");
  }
  return result;
}

export function verifyOverwatchCloudflareUnattendedKeychainInteroperability() {
  const governance = readJson(governancePath);
  const report = readJson(reportPath);
  const evaluation = evaluateCloudflareUnattendedKeychainInteroperabilityGovernance({
    governance,
    report
  });
  if (!evaluation.ok) throw new Error(evaluation.failures.join("\n"));

  verifyOwnerCommit(governance);
  verifyOverwatchOwnership();
  verifyRegistry();
  verifyOwnerVerifier();
  const scanPaths = [...new Set([
    ...listTrackedFiles(root),
    ...expectedOverwatchPaths
  ])];
  if (scanTrackedRepository({
    root,
    trackedFiles: scanPaths,
    readFile: path => readFileSync(resolve(root, path))
  }).length !== 0) {
    throw new Error("Tracked secret scan failed.");
  }
  const localArtifacts = verifyLocalSecretArtifacts({ root });
  if (localArtifacts.length !== 0) {
    throw new Error("Local secret artifact boundary failed.");
  }

  return Object.freeze({
    status: "passed",
    batchId: "BATCH-20260715-008",
    implementationOwner: "Prometheus Infrastructure",
    verificationOwner: "Prometheus Overwatch",
    implementationCommit: ownerCommit,
    implementationRepairCommit: ownerRepairCommit,
    implementationVerifierRepairCommit: ownerVerifierRepairCommit,
    implementationCiPortabilityCommit: ownerCiPortabilityCommit,
    focusedOwnerTests: 17,
    realClassification: "FOUR_PRESENT_NOT_RETRIEVABLE_INTERACTION_REQUIRED",
    unattendedControl: "OFF_UNCONSUMED",
    cloudflareRequestPerformed: false,
    keychainAclModified: false,
    deploymentPerformed: false,
    recommendationInfluence: "OFF"
  });
}

if (process.argv[1] === import.meta.filename) {
  console.log(JSON.stringify(
    verifyOverwatchCloudflareUnattendedKeychainInteroperability(),
    null,
    2
  ));
}
