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
import {
  verifyCloudflareFounderAttendedFreshAttemptEvidenceRotation
} from "./verify-cloudflare-founder-attended-fresh-attempt-evidence-rotation.mjs";

const root = resolve(import.meta.dirname, "..");
const governancePath =
  "overwatch/governance/cloudflare-founder-attended-fresh-attempt-evidence-rotation-v1.json";
const governanceDocumentationPath =
  "overwatch/governance/cloudflare-founder-attended-fresh-attempt-evidence-rotation-v1.md";
const keychainInteroperabilityGovernancePath =
  "overwatch/governance/cloudflare-unattended-keychain-interoperability-v1.json";
const reportPath =
  "overwatch/reports/BATCH-20260715-006-cloudflare-founder-attended-fresh-attempt-evidence-rotation.json";
const registryPath = "overwatch/artifact-contracts/canonical-artifact-registry.json";
const gymPreviewGovernancePath =
  "overwatch/governance/route-iq-gym-first-dual-track-public-website-preview-v1.json";
const gymPreviewConfigPath = "wrangler.prometheusrouteiq-website-gym-preview.jsonc";
const initialOwnerCommit = "20e367ccd815f059adcdfa241f34a66c0a28675b";
const initialOwnerParent = "4fbd3030c980a7e17230654dfe2ece0766793436";
const initialOwnerTree = "becaa26ef02f7973d2c43fd241a8902ce44e9f7f";
const repairOwnerCommit = "e10719d6d2ff312f2a5473c1fe000810e915509b";
const repairOwnerTree = "3695a70a5ae08540c35a63f324a36ff0f1f966de";
const overwatchGovernanceCommit = "7802e950e69596d046daf6c8eb3abf6eaf698dde";
const overwatchGovernanceTree = "309f523c4838c09d3f3518444a9d19c224bdcfc6";
const overwatchVerificationRepairCommit =
  "845973727b3e5fe3923c45b6b90c41134355c60f";

const ownerHashes = Object.freeze({
  "docs/cloudflare-founder-attended-fresh-attempt-evidence-rotation-v1.md":
    "d210b26a34cae0c977392bbb7093551bfdfed86d05d21f99fd0cd2b02e2d49ee",
  "scripts/lib/cloudflare-founder-attended-create-receipt-v2-artifacts.mjs":
    "02d1d188dfd6c3e87d79be560eb4b4fd8549f2811fa5444190a5dd38ed2780ea",
  "scripts/lib/cloudflare-founder-attended-create-receipt-v2-workflow.mjs":
    "d2ddeac94822213c87b66bd496e3d0820dfd19a8bd6f5a61bcb1c1d11c4698ad",
  "scripts/lib/cloudflare-founder-attended-response-contract-artifacts.mjs":
    "43f8a85c4d225759e5c2991cfc4255492b5b578cf2fc5b8904c62db55d9f121f",
  "scripts/lib/cloudflare-founder-attended-response-contract-production.mjs":
    "4abc45e585e67667cc771d22510b41127f701067dcf5c457211d64b93ec2b0af",
  "scripts/lib/cloudflare-founder-attended-response-contract-workflow.mjs":
    "82075c21604476f116d3b77a169e6ad88eb0a746924a40711a22c1565d7f6769",
  "scripts/run-cloudflare-founder-attended-create-receipt-v2-get-only.mjs":
    "96bd3faefb6227f25b419cd8e48b20263519e2eac5ed1d93c0c0ff446b4528c0",
  "scripts/verify-cloudflare-founder-attended-create-receipt-v2.mjs":
    "54a6d28ce672594f369bb623c699831804a116c034f7bff566b78860897b01e0",
  "scripts/verify-cloudflare-founder-attended-fresh-attempt-evidence-rotation.mjs":
    "939982593a8b5ef908af0c7cbc1cd0f2c5794f0b500f74f2b23a1880a4baaedc",
  "scripts/verify-cloudflare-founder-attended-response-contract-repair.mjs":
    "8ce6e7c096a867ff168c5a99f38d8d885c011adbb1b42accf2669b14c8e2252d",
  "tests/cloudflare-founder-attended-create-receipt-v2.test.mjs":
    "d0e25eaabd950d9a40fc214a896c788a0a2b40aa7db17a757da2577cf5314866",
  "tests/cloudflare-founder-attended-owner-verifier-ownership.test.mjs":
    "1ee230b0cddd87005504d9ce1d548240d7b81b5b1a642dfb93da398d7e84832f",
  "tests/cloudflare-founder-attended-response-contract-repair.test.mjs":
    "5fb0fa197f688f557f6ac4d113b9dce4e150aa0a043457585914adf9f2d6b1d5",
  "workers/infrastructure/cloudflare-founder-attended-fresh-attempt-evidence-rotation-v1.json":
    "84c158380b17e986b49a77edd68143e96ed2481a0b3527f43ccbca26e9a21388"
});

const repairOwnerPaths = Object.freeze([
  "docs/cloudflare-founder-attended-fresh-attempt-evidence-rotation-v1.md",
  "scripts/lib/cloudflare-founder-attended-response-contract-artifacts.mjs",
  "scripts/lib/cloudflare-founder-attended-response-contract-workflow.mjs",
  "scripts/verify-cloudflare-founder-attended-create-receipt-v2.mjs",
  "scripts/verify-cloudflare-founder-attended-fresh-attempt-evidence-rotation.mjs",
  "scripts/verify-cloudflare-founder-attended-response-contract-repair.mjs",
  "tests/cloudflare-founder-attended-create-receipt-v2.test.mjs",
  "tests/cloudflare-founder-attended-response-contract-repair.test.mjs",
  "workers/infrastructure/cloudflare-founder-attended-fresh-attempt-evidence-rotation-v1.json"
]);

const expectedOverwatchPaths = Object.freeze([
  "overwatch/artifact-contracts/canonical-artifact-registry.json",
  governanceDocumentationPath,
  governancePath,
  reportPath,
  "scripts/verify-overwatch-cloudflare-founder-attended-create-receipt-v2.mjs",
  "scripts/verify-overwatch-cloudflare-founder-attended-fresh-attempt-evidence-rotation.mjs",
  "tests/cross-subsystem-artifact-contracts.test.mjs",
  "tests/overwatch-cloudflare-founder-attended-create-receipt-v2.test.mjs"
]);

const expectedOverwatchRepairPaths = Object.freeze([
  "scripts/verify-overwatch-cloudflare-founder-attended-create-receipt-v2.mjs",
  "scripts/verify-overwatch-cloudflare-founder-attended-fresh-attempt-evidence-rotation.mjs",
  "scripts/verify-overwatch-cloudflare-founder-attended-response-contract-repair.mjs"
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

export function evaluateFounderAttendedFreshAttemptEvidenceRotationGovernance({
  governance,
  report
}) {
  const failures = [];
  const require = (condition, message) => {
    if (!condition) failures.push(message);
  };

  require(governance.governanceId ===
    "cloudflare-founder-attended-fresh-attempt-evidence-rotation-governance-v1",
  "Governance ID drifted.");
  require(governance.batchId === "BATCH-20260715-006", "Batch ID drifted.");
  require(governance.owningSubsystem === "Prometheus Overwatch", "Governance owner drifted.");
  require(governance.dispatchAudit.implementationOwner === "Prometheus Infrastructure",
    "Implementation owner drifted.");
  require(governance.dispatchAudit.verificationOwner === "Prometheus Overwatch",
    "Verification owner drifted.");
  require(governance.dispatchAudit.implementationOwnershipRespected === true,
    "Ownership is not affirmed.");
  require(governance.dispatchAudit.overwatchModifiedInfrastructureImplementation === false,
    "Overwatch claims an Infrastructure implementation edit.");
  require(equal(governance.dispatchAudit.implementationCommits.map(item => item.commit), [
    initialOwnerCommit,
    repairOwnerCommit
  ]), "Owner commit chain drifted.");
  require(equal(governance.ownerEvidence, Object.entries(ownerHashes).map(
    ([path, sha256AtFinalOwnerCommit]) => ({ path, sha256AtFinalOwnerCommit })
  )), "Owner evidence map drifted.");

  require(governance.attemptNamespace.root ===
    "$HOME/.prometheus/infrastructure/cloudflare-founder-attended-create-receipt-v2/attempts/<attemptId>",
  "Attempt root drifted.");
  require(governance.attemptNamespace.freshExclusiveDirectoryPerDiagnostic === true,
    "Fresh exclusive attempt is not required.");
  require(governance.attemptNamespace.attemptReservedBeforeNetwork === true,
    "Attempt reservation moved after network.");
  require(governance.attemptNamespace.callerChosenIdentifierAllowed === false,
    "Caller-chosen attempt identifiers are allowed.");
  require(governance.attemptNamespace.priorArtifactDeleteOverwriteRenameReuseOrMigrationAllowed ===
    false, "Prior evidence mutation is allowed.");
  require(governance.attemptNamespace.localArtifactCollisionReason ===
    "LOCAL_ARTIFACT_COLLISION", "Collision classification drifted.");

  const lineage = governance.lineageBoundary;
  require(lineage.attemptIdBindsDiagnosticControlConsumptionClassificationsAndPhases === true,
    "Attempt lineage is incomplete.");
  require(lineage.lineageBindsAuthorizedCommitAndTree === true,
    "Commit/tree lineage is not required.");
  require(lineage.abandonedAttemptCanBecomeEligible === false,
    "Abandoned attempts can become eligible.");
  require(lineage.crossAttemptSubstitutionAllowed === false,
    "Cross-attempt substitution is allowed.");
  require(lineage.futureDatedLineageOrDiagnosticAllowed === false,
    "Future-dated evidence is allowed.");
  require(lineage.exactNamePresentCanPrepare === false, "Present-name evidence can prepare.");
  require(lineage.expiredOrConsumedCanPrepare === false, "Expired or consumed evidence can prepare.");
  require(lineage.simultaneousTimestampTieFailsClosed === true,
    "Simultaneous tie no longer fails closed.");

  require(governance.filesystemBoundary.directoryMode === "0700", "Directory mode drifted.");
  require(governance.filesystemBoundary.fileMode === "0600", "File mode drifted.");
  require(governance.filesystemBoundary.symlinksTrusted === false, "Symlinks are trusted.");
  require(governance.filesystemBoundary.hardlinksTrusted === false, "Hardlinks are trusted.");
  require(governance.filesystemBoundary.ownerMismatchTrusted === false,
    "Owner mismatch is trusted.");
  require(governance.provisioningBoundary.createAttemptsMaximumPerFreshControl === 1,
    "More than one create attempt is allowed.");
  require(governance.provisioningBoundary.automaticRetryAllowed === false,
    "Automatic retry is allowed.");
  require(governance.provisioningBoundary.nextCommandGetOnly ===
    "node scripts/run-cloudflare-founder-attended-create-receipt-v2-get-only.mjs",
  "Next command is not the governed GET-only command.");

  for (const [field, expected] of Object.entries({
    cloudflareApiContacted: false,
    realKeychainValuesReadOrWritten: false,
    credentialCreatedDeletedStoredOrChanged: false,
    realArtifactCreatedDeletedOverwrittenRenamedOrReused: false,
    temporaryProvisioningApiTokenChanged: false,
    deploymentPerformed: false,
    productionMutationPerformed: false,
    prospectiveCollection: "OFF",
    cohortActivation: "OFF",
    recommendationInfluence: "OFF"
  })) {
    require(governance.executionBoundary[field] === expected,
      `Execution boundary drifted: ${field}.`);
  }
  for (const field of [
    "deploymentAuthorized",
    "liveGetAuthorizedByThisBatch",
    "controlPreparationAuthorized",
    "provisioningAuthorized",
    "tokenCreationOrDeletionAuthorized"
  ]) {
    require(governance.releaseBoundary[field] === false,
      `Release boundary drifted: ${field}.`);
  }

  require(report.batchId === "BATCH-20260715-006", "Report batch drifted.");
  require(report.owners.implementation === "Prometheus Infrastructure",
    "Report implementation owner drifted.");
  require(report.owners.verification === "Prometheus Overwatch",
    "Report verification owner drifted.");
  require(report.owners.ownershipRespected === true, "Report ownership is not affirmed.");
  require(report.owners.overwatchModifiedInfrastructureImplementation === false,
    "Report claims an Infrastructure edit by Overwatch.");
  require(report.completedWork.reservationBeforeNetwork === true,
    "Report weakens pre-network reservation.");
  require(report.completedWork.crossAttemptSubstitutionFailsClosed === true,
    "Report weakens cross-attempt isolation.");
  require(report.completedWork.onePostNoRetryUnchanged === true,
    "Report weakens one-POST/no-retry.");
  require(report.boundaries.cloudflareApiContacted === false,
    "Report claims Cloudflare contact.");
  require(report.boundaries.realKeychainValuesReadOrWritten === false,
    "Report claims real Keychain access.");
  require(report.boundaries.deploymentPerformed === false, "Report claims deployment.");

  return Object.freeze({ ok: failures.length === 0, failures: Object.freeze(failures) });
}

function verifyOwnerCommits(governance) {
  const keychainInteroperabilityGovernance = readJson(
    keychainInteroperabilityGovernancePath
  );
  const ownerVerifierSuccessors = new Map(
    keychainInteroperabilityGovernance.ownerVerifierSuccessors
      .map(item => [item.path, item])
  );
  const historicalFixtureSuccessors =
    keychainInteroperabilityGovernance.ownerHistoricalFixtureVerifierSuccessors;
  const initialFields = git([
    "show", "-s", "--format=%H%n%P%n%T%n%an <%ae>%n%cn <%ce>%n%s", initialOwnerCommit
  ]).split("\n");
  if (!equal(initialFields, [
    initialOwnerCommit,
    initialOwnerParent,
    initialOwnerTree,
    "Prometheus Infrastructure <infrastructure@prometheus.local>",
    "Prometheus Infrastructure <infrastructure@prometheus.local>",
    "Add founder-attended attempt evidence rotation"
  ])) throw new Error("Initial Infrastructure commit metadata drifted.");
  const initialPaths = git([
    "diff-tree", "--no-commit-id", "--name-only", "-r", initialOwnerCommit
  ]).split("\n").filter(Boolean);
  if (!equal(initialPaths, Object.keys(ownerHashes))) {
    throw new Error("Initial Infrastructure file set drifted.");
  }

  const repairFields = git([
    "show", "-s", "--format=%H%n%P%n%T%n%an <%ae>%n%cn <%ce>%n%s", repairOwnerCommit
  ]).split("\n");
  if (!equal(repairFields, [
    repairOwnerCommit,
    initialOwnerCommit,
    repairOwnerTree,
    "Prometheus Infrastructure <infrastructure@prometheus.local>",
    "Prometheus Infrastructure <infrastructure@prometheus.local>",
    "Repair founder-attended attempt lineage gating"
  ])) throw new Error("Repair Infrastructure commit metadata drifted.");
  const repairPaths = git([
    "diff-tree", "--no-commit-id", "--name-only", "-r", repairOwnerCommit
  ]).split("\n").filter(Boolean);
  if (!equal(repairPaths, repairOwnerPaths)) throw new Error("Repair file set drifted.");
  if ([...initialPaths, ...repairPaths].some(path =>
    path === "package.json" || path.startsWith("overwatch/"))) {
    throw new Error("Infrastructure crossed the Overwatch ownership boundary.");
  }
  execFileSync("/usr/bin/git", ["merge-base", "--is-ancestor", repairOwnerCommit, "HEAD"], {
    cwd: root,
    stdio: "ignore"
  });

  const evidence = new Map(governance.ownerEvidence.map(item => [item.path, item]));
  for (const [path, expectedHash] of Object.entries(ownerHashes)) {
    const ownerBytes = execFileSync("/usr/bin/git", ["show", `${repairOwnerCommit}:${path}`], {
      cwd: root,
      encoding: null,
      stdio: ["ignore", "pipe", "ignore"]
    });
    const current = sha256(readFileSync(resolve(root, path)));
    const successor = ownerVerifierSuccessors.get(path);
    let successorExpected = successor?.successorSha256 ?? expectedHash;
    for (const transition of historicalFixtureSuccessors.filter(
      item => item.path === path
    )) {
      if (transition.previousSha256 !== successorExpected
        || transition.owner !== "Prometheus Infrastructure") {
        throw new Error(`Infrastructure historical fixture chain drifted: ${path}`);
      }
      successorExpected = transition.successorSha256;
    }
    const currentAccepted = current === expectedHash
      || (successor?.previousSha256 === expectedHash
        && successorExpected === current
        && successor?.owner === "Prometheus Infrastructure");
    if (sha256(ownerBytes) !== expectedHash
      || !currentAccepted
      || evidence.get(path)?.sha256AtFinalOwnerCommit !== expectedHash) {
      throw new Error(`Infrastructure owner evidence drifted: ${path}`);
    }
  }

  for (const expected of
    keychainInteroperabilityGovernance.dispatchAudit.ownerHistoricalFixtureRepairCommits) {
    const fields = git([
      "show", "-s", "--format=%H%n%P%n%T%n%an <%ae>%n%cn <%ce>%n%s", expected.commit
    ]).split("\n");
    if (!equal(fields, [
      expected.commit,
      expected.parent,
      expected.tree,
      "Prometheus Infrastructure <infrastructure@prometheus.local>",
      "Prometheus Infrastructure <infrastructure@prometheus.local>",
      expected.subject
    ])) throw new Error("Infrastructure historical fixture repair metadata drifted.");
    const paths = git([
      "diff-tree", "--no-commit-id", "--name-only", "-r", expected.commit
    ]).split("\n").filter(Boolean);
    if (!equal(paths, expected.transitions.map(item => item.path))) {
      throw new Error("Infrastructure historical fixture repair file set drifted.");
    }
  }
}

function verifyOverwatchOwnership() {
  const head = git(["rev-parse", "HEAD"]);
  if (head === repairOwnerCommit) return;
  const governanceFields = git([
    "show", "-s", "--format=%H%n%P%n%T%n%an <%ae>%n%cn <%ce>%n%s",
    overwatchGovernanceCommit
  ]).split("\n");
  if (!equal(governanceFields, [
    overwatchGovernanceCommit,
    repairOwnerCommit,
    overwatchGovernanceTree,
    "Prometheus Overwatch <overwatch@prometheus.local>",
    "Prometheus Overwatch <overwatch@prometheus.local>",
    "Govern founder-attended attempt evidence rotation"
  ])) throw new Error("Overwatch rotation commit metadata drifted.");
  const governancePaths = git([
    "diff-tree", "--no-commit-id", "--name-only", "-r", overwatchGovernanceCommit
  ])
    .split("\n").filter(Boolean);
  if (!equal([...governancePaths].sort(), [...expectedOverwatchPaths].sort())) {
    throw new Error("Overwatch rotation file set drifted.");
  }
  if (governancePaths.some(path => Object.hasOwn(ownerHashes, path)
    || path.startsWith("workers/infrastructure/"))) {
    throw new Error("Overwatch modified Infrastructure implementation.");
  }
  execFileSync("/usr/bin/git", [
    "merge-base", "--is-ancestor", overwatchGovernanceCommit, "HEAD"
  ], { cwd: root, stdio: "ignore" });
  if (head === overwatchGovernanceCommit) return;

  const repairFields = git([
    "show", "-s", "--format=%P%n%an <%ae>%n%cn <%ce>%n%s",
    overwatchVerificationRepairCommit
  ]).split("\n");
  if (!equal(repairFields, [
    overwatchGovernanceCommit,
    "Prometheus Overwatch <overwatch@prometheus.local>",
    "Prometheus Overwatch <overwatch@prometheus.local>",
    "Repair attended response-contract successor verification"
  ])) throw new Error("Overwatch successor-verification repair metadata drifted.");
  const repairPaths = git([
    "diff-tree", "--no-commit-id", "--name-only", "-r",
    overwatchVerificationRepairCommit
  ])
    .split("\n").filter(Boolean);
  if (!equal([...repairPaths].sort(), [...expectedOverwatchRepairPaths].sort())) {
    throw new Error("Overwatch successor-verification repair file set drifted.");
  }
  if (repairPaths.some(path => Object.hasOwn(ownerHashes, path)
    || path.startsWith("workers/infrastructure/"))) {
    throw new Error("Overwatch repair modified Infrastructure implementation.");
  }
  execFileSync("/usr/bin/git", [
    "merge-base", "--is-ancestor", overwatchVerificationRepairCommit, "HEAD"
  ], { cwd: root, stdio: "ignore" });
}

function verifyImplementationBoundary() {
  const artifactSource = read(
    "scripts/lib/cloudflare-founder-attended-response-contract-artifacts.mjs"
  );
  const workflow = read("scripts/lib/cloudflare-founder-attended-response-contract-workflow.mjs");
  const getOnly = read("scripts/run-cloudflare-founder-attended-create-receipt-v2-get-only.mjs");
  const metadata = readJson(
    "workers/infrastructure/cloudflare-founder-attended-fresh-attempt-evidence-rotation-v1.json"
  );
  const testSource = read("tests/cloudflare-founder-attended-response-contract-repair.test.mjs");

  const diagnosticFunction = workflow.slice(workflow.indexOf(
    "export async function diagnoseFounderAttendedResponseContractAbsenceTestOnly"
  ));
  if (diagnosticFunction.indexOf("reserveFounderAttendedResponseContractAttempt({") < 0
    || diagnosticFunction.indexOf("const outcome = await exactNameState({") < 0
    || diagnosticFunction.indexOf("reserveFounderAttendedResponseContractAttempt({") >
      diagnosticFunction.indexOf("const outcome = await exactNameState({")) {
    throw new Error("Attempt is not reserved before network.");
  }
  for (const snippet of [
    "authorizedCommit", "authorizedTree", "createExclusiveDirectory(paths.attemptRoot",
    "LOCAL_ARTIFACT_COLLISION", "lineage.createdAt > nowTime",
    "record.diagnostic.observedAt > nowTime"
  ]) {
    if (!artifactSource.includes(snippet)) throw new Error(`Artifact boundary missing: ${snippet}`);
  }
  if (/unlinkSync|rmSync|renameSync|truncateSync/u.test(artifactSource)) {
    throw new Error("Attempt implementation contains destructive artifact handling.");
  }
  if (/method:\s*"(?:POST|PUT|PATCH|DELETE)"/u.test(getOnly)
    || /provisionFounderAttended/u.test(getOnly)) {
    throw new Error("Next command is not structurally GET-only.");
  }
  if (metadata.namespaceRotation.artifactNamespace !==
      "$HOME/.prometheus/infrastructure/cloudflare-founder-attended-create-receipt-v2/attempts/<attemptId>"
    || metadata.namespaceRotation.priorArtifactsReusedOrOverwritten !== false
    || metadata.lineageBinding.crossAttemptSubstitutionFailsClosed !== true
    || metadata.runtimeBoundaries.realExecutionAuthorized !== false) {
    throw new Error("Infrastructure rotation metadata drifted.");
  }
  for (const phrase of [
    "failed network, malformed, and authorization diagnostics create isolated abandoned attempts",
    "abandoned, expired, consumed, and exact-name-present attempts are independently ignored",
    "future-dated lineage or diagnostic cannot prepare",
    "commit and tree lineage tampering fail closed",
    "simultaneous fresh absence attempts fail safely without mixing"
  ]) {
    if (!testSource.includes(phrase)) throw new Error(`Adversarial coverage missing: ${phrase}`);
  }
  const owner = verifyCloudflareFounderAttendedFreshAttemptEvidenceRotation();
  if (owner.status !== "passed" || owner.batchId !== "BATCH-20260715-006") {
    throw new Error("Infrastructure rotation owner verifier failed.");
  }
}

function verifyCanonicalRegistration() {
  const registry = readJson(registryPath);
  const matches = registry.governanceArtifacts.filter(item => item.artifactId ===
    "cloudflare-founder-attended-fresh-attempt-evidence-rotation-governance-v1");
  const expected = {
    artifactId: "cloudflare-founder-attended-fresh-attempt-evidence-rotation-governance-v1",
    artifactType: "overwatch_infrastructure_attended_attempt_evidence_rotation_governance",
    ownerSubsystem: "Prometheus Overwatch",
    path: governancePath,
    documentationPath: governanceDocumentationPath,
    schema: "CloudflareFounderAttendedFreshAttemptEvidenceRotationGovernanceV1",
    writeAllowed: ["Prometheus Overwatch"],
    readAllowed: ["Prometheus Infrastructure", "Prometheus Overwatch"],
    productionConsumer: false,
    failClosedIfMissing: true
  };
  if (matches.length !== 1 || !equal(matches[0], expected)) {
    throw new Error("Canonical attempt-rotation registration drifted.");
  }
}

export function verifyManualIsolatedGymPreviewWorkflow({
  path,
  source,
  governance,
  config
}) {
  const successor = governance?.founderAttendedAutomaticDeploymentGuardSuccessor;
  if (governance?.batchId !== "BATCH-20260814-002"
    || governance?.ownerSubsystem !== "Prometheus Overwatch"
    || successor?.classification !== "MANUAL_ISOLATED_GYM_PREVIEW_WORKFLOW_SUCCESSOR"
    || successor?.historicalGuardPath !==
      "scripts/verify-overwatch-cloudflare-founder-attended-fresh-attempt-evidence-rotation.mjs"
    || successor?.workflowPath !== path
    || successor?.workflowSha256 !== sha256(source)
    || successor?.workflowOwnerCommit !== "919092f0700ac43fb507dc32111ad2e9d1e9d2e0"
    || successor?.onlyTrigger !== "workflow_dispatch"
    || successor?.exactWorkerName !== "prometheusrouteiq-website-gym-preview"
    || successor?.exactConfigPath !== gymPreviewConfigPath
    || successor?.previewOnly !== true
    || successor?.productionWorkerDeploymentAllowed !== false
    || successor?.privateWorkerDeploymentAllowed !== false
    || successor?.productionRoutesAllowed !== false
    || successor?.productionDataAccessAllowed !== false) {
    throw new Error("Isolated preview workflow governance drifted.");
  }

  const triggerEnd = source.indexOf("permissions:\n");
  const trigger = source.slice(source.indexOf("on:\n"), triggerEnd);
  const triggerNames = [...trigger.matchAll(/^  ([a-z_]+):$/gmu)].map(match => match[1]);
  if (!equal(triggerNames, ["workflow_dispatch"])) {
    throw new Error("Isolated preview workflow trigger drifted.");
  }
  for (const forbidden of [
    "push:", "pull_request:", "schedule:", "repository_dispatch:", "workflow_call:"
  ]) {
    if (trigger.includes(forbidden)) {
      throw new Error("Isolated preview workflow gained an automatic trigger.");
    }
  }
  for (const required of [
    "name: Preview Prometheus Route IQ Gym First",
    "name: Deploy the exact isolated gym preview once"
  ]) {
    if (!source.includes(required)) throw new Error(`Isolated preview workflow gate missing: ${required}`);
  }
  for (const gate of [
    "github.event_name == 'workflow_dispatch'",
    "github.actor == 'PrometheusRouteIQ'",
    "github.triggering_actor == 'PrometheusRouteIQ'",
    "github.ref == 'refs/heads/main'",
    "github.sha == inputs.candidate_commit",
    "inputs.batch_id == 'BATCH-20260814-002'",
    "github.run_attempt == 1"
  ]) {
    if (source.split(gate).length - 1 !== 2) {
      throw new Error(`Isolated preview workflow dual-job gate drifted: ${gate}`);
    }
  }
  const invocations = source.split(/\r?\n/u)
    .map(line => line.trim())
    .filter(line => line.startsWith("npx wrangler deploy "));
  if (invocations.length !== 2
    || invocations.filter(line => line.includes(" --dry-run ")).length !== 1
    || invocations.filter(line => !line.includes(" --dry-run ")).length !== 1) {
    throw new Error("Isolated preview workflow deployment count drifted.");
  }
  for (const invocation of invocations) {
    if (!invocation.includes(`--config ${successor.exactConfigPath}`)
      || !invocation.match(new RegExp(`--name ${successor.exactWorkerName}(?:\\s|$)`, "u"))
      || /--route(?:s)?(?:\s|=)|--env(?:\s|=)/u.test(invocation)
      || /--name prometheus-iq(?:\s|$)|--name prometheusrouteiq-website(?:\s|$)/u
        .test(invocation)) {
      throw new Error("Isolated preview workflow target drifted.");
    }
  }
  if (config?.name !== successor.exactWorkerName
    || config?.workers_dev !== true
    || config?.preview_urls !== false
    || config?.assets?.binding !== "ASSETS"
    || Object.keys(config).some(key => [
      "routes", "route", "durable_objects", "kv_namespaces", "d1_databases",
      "r2_buckets", "queues", "services", "vars"
    ].includes(key))) {
    throw new Error("Isolated preview Worker configuration drifted.");
  }
  return true;
}

function verifyNoAutomaticDeployment() {
  const workflowPaths = git(["ls-files", ".github/workflows"])
    .split("\n").filter(Boolean);
  const gymPreviewGovernance = readJson(gymPreviewGovernancePath);
  const gymPreviewConfig = readJson(gymPreviewConfigPath);
  for (const path of workflowPaths) {
    const source = read(path);
    if (!/wrangler\s+(?:deploy|versions\s+upload|versions\s+deploy)|cloudflare.*deploy/iu
      .test(source)) continue;
    if (path === gymPreviewGovernance.founderAttendedAutomaticDeploymentGuardSuccessor
      .workflowPath) {
      verifyManualIsolatedGymPreviewWorkflow({
        path,
        source,
        governance: gymPreviewGovernance,
        config: gymPreviewConfig
      });
    } else {
      throw new Error(`Push may trigger deployment: ${path}`);
    }
  }
}

function verifySecretSafety() {
  const repositoryFiles = git(["ls-files", "--cached", "--others", "--exclude-standard"])
    .split("\n").filter(Boolean);
  const trackedFiles = [...new Set([...listTrackedFiles(root), ...repositoryFiles])];
  if (scanTrackedRepository({ root, trackedFiles }).length !== 0) {
    throw new Error("Tracked or outgoing secret findings detected.");
  }
  if (verifyLocalSecretArtifacts({ root }).length !== 0) {
    throw new Error("Local secret artifact protection failed.");
  }
}

export function verifyOverwatchFounderAttendedFreshAttemptEvidenceRotation() {
  const governance = readJson(governancePath);
  const report = readJson(reportPath);
  const evaluated = evaluateFounderAttendedFreshAttemptEvidenceRotationGovernance({
    governance,
    report
  });
  if (!evaluated.ok) throw new Error(evaluated.failures.join("\n"));
  verifyOwnerCommits(governance);
  verifyOverwatchOwnership();
  verifyImplementationBoundary();
  verifyCanonicalRegistration();
  verifyNoAutomaticDeployment();
  verifySecretSafety();
  return Object.freeze({
    status: "passed",
    batchId: "BATCH-20260715-006",
    implementationOwner: "Prometheus Infrastructure",
    verificationOwner: "Prometheus Overwatch",
    implementationCommits: Object.freeze([initialOwnerCommit, repairOwnerCommit]),
    focusedOwnerTests: 68,
    cloudflareApiContacted: false,
    realKeychainValuesRead: false,
    credentialActionPerformed: false,
    deploymentPerformed: false,
    productionMutationPerformed: false,
    prospectiveCollection: "OFF",
    cohortActivation: "OFF",
    recommendationInfluence: "OFF",
    nextSafeCommand: "node scripts/run-cloudflare-founder-attended-create-receipt-v2-get-only.mjs"
  });
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  try {
    console.log(JSON.stringify(
      verifyOverwatchFounderAttendedFreshAttemptEvidenceRotation(), null, 2
    ));
  } catch {
    console.error("Overwatch Founder-attended attempt-evidence rotation check failed.");
    process.exitCode = 1;
  }
}
