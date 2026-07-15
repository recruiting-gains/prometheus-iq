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

const expectedOverwatchPaths = Object.freeze([
  "overwatch/artifact-contracts/canonical-artifact-registry.json",
  governanceDocumentationPath,
  governancePath,
  reportPath,
  "package.json",
  "scripts/verify-overwatch-cloudflare-unattended-keychain-interoperability.mjs",
  "tests/cross-subsystem-artifact-contracts.test.mjs",
  "tests/overwatch-cloudflare-unattended-keychain-interoperability.test.mjs"
]);

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
  require(governance.dispatchAudit.implementationOwnershipRespected === true,
    "Implementation ownership is not affirmed.");
  require(governance.dispatchAudit.overwatchModifiedInfrastructureImplementation === false,
    "Overwatch claims an Infrastructure implementation edit.");
  require(equal(governance.ownerEvidence, Object.entries(ownerHashes).map(
    ([path, sha256AtOwnerCommit]) => ({ path, sha256AtOwnerCommit })
  )), "Owner evidence map drifted.");

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
  for (const [path, expectedHash] of Object.entries(ownerHashes)) {
    const ownerBytes = execFileSync("/usr/bin/git", ["show", `${ownerCommit}:${path}`], {
      cwd: root,
      encoding: null,
      stdio: ["ignore", "pipe", "ignore"]
    });
    if (sha256(ownerBytes) !== expectedHash
      || sha256(readFileSync(resolve(root, path))) !== expectedHash
      || evidence.get(path)?.sha256AtOwnerCommit !== expectedHash) {
      throw new Error(`Infrastructure owner evidence drifted: ${path}`);
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
  for (const commit of commits) {
    const metadata = git(["show", "-s", "--format=%an <%ae>%n%cn <%ce>", commit])
      .split("\n");
    if (!equal(metadata, [
      "Prometheus Overwatch <overwatch@prometheus.local>",
      "Prometheus Overwatch <overwatch@prometheus.local>"
    ])) throw new Error(`Non-Overwatch successor commit detected: ${commit}`);
  }
  const paths = git(["diff", "--name-only", ownerCommit, "HEAD"])
    .split("\n").filter(Boolean);
  if (!equal([...paths].sort(), [...expectedOverwatchPaths].sort())) {
    throw new Error("Overwatch governance file set drifted.");
  }
  if (paths.some(path => Object.hasOwn(ownerHashes, path)
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
    || result.productionMutated !== false) {
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
    focusedOwnerTests: 15,
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
