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
  CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_FINAL_OUTCOMES,
  CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_NEXT_SAFE_COMMAND,
  CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_REASON_CODES
} from "./lib/cloudflare-founder-attended-create-receipt-v2-constants.mjs";
import {
  verifyCloudflareFounderAttendedCreateReceiptV2
} from "./verify-cloudflare-founder-attended-create-receipt-v2.mjs";

const root = resolve(import.meta.dirname, "..");
const governancePath =
  "overwatch/governance/cloudflare-founder-attended-live-create-receipt-safe-provisioning-repair-v2.json";
const governanceDocumentationPath =
  "overwatch/governance/cloudflare-founder-attended-live-create-receipt-safe-provisioning-repair-v2.md";
const reportPath =
  "overwatch/reports/BATCH-20260715-004-cloudflare-live-create-receipt-safe-provisioning-repair-v2.json";
const contractPath = "workers/infrastructure/cloudflare-founder-attended-create-receipt-v2.json";
const registryPath = "overwatch/artifact-contracts/canonical-artifact-registry.json";
const ownerCommit = "358f817f7fc81bd82560840e5fd54668a7f58abe";
const ownerParent = "f630c2af6e5e4722105d2b1e3ee959fb28f5da66";
const ownerTree = "887e54f6ff62dfd55730f81bf9348ee1ecd619bb";
const overwatchGovernanceCommit = "2bedfdc61b10e682d65a3308aad62640bc79f4ce";

const expectedOwnerHashes = Object.freeze({
  "docs/cloudflare-founder-attended-create-receipt-v2.md":
    "9bee82cf1f4859d5b058d35245242971dd2e2073b5026db7bd8361e0b113e800",
  "scripts/lib/cloudflare-founder-attended-create-receipt-v2-artifacts.mjs":
    "4dfb5b35aa94dbb7a660e72881c06939bb01d0ce71843779bc5d9b8c29845ccb",
  "scripts/lib/cloudflare-founder-attended-create-receipt-v2-constants.mjs":
    "2191c885aeffbb619143b54ce5fb10c1ec4ea24ef472ab1c2e93f48d2f9f96cb",
  "scripts/lib/cloudflare-founder-attended-create-receipt-v2-production.mjs":
    "1dceeaee0afba1f5cb4d72cc085f4a1df2eab5d40148d6c4e5969c7256494825",
  "scripts/lib/cloudflare-founder-attended-create-receipt-v2-workflow.mjs":
    "ef7bf7917c9590b8b0b12a06af6b3901c17098d60f2ece5e7023691b772e9dde",
  "scripts/run-cloudflare-founder-attended-create-receipt-v2-get-only.mjs":
    "7b74ed168f4c4d30b901ed4ddbd052679d5098970529bce6b3071c0762c8790f",
  "scripts/run-cloudflare-founder-attended-create-receipt-v2-prepare.mjs":
    "2c55428bf1b4e2fdc69fb831e00d465b30f6df4d4a1e4fead131896f63c8325f",
  "scripts/run-cloudflare-founder-attended-create-receipt-v2-provision.mjs":
    "7dd6d8db8a0f1bf83158a4d4178823b7267765805ea48b29b85705a0e7d5686e",
  "scripts/verify-cloudflare-founder-attended-create-receipt-v2.mjs":
    "1f95ded85a5f5adc054d6bfd0d87f8260e1d7f7c0df4f6f80e59eb675ad740f5",
  "tests/cloudflare-founder-attended-create-receipt-v2.test.mjs":
    "cbf0bc909e6b56157fdfa99a16fd6bb86e520ee1d683727f33d617d15d0c3244",
  "workers/infrastructure/cloudflare-founder-attended-create-receipt-v2.json":
    "917d0c43cbdd763645a31237d738c627190b3d18174b343ca472a9f0074fe298"
});

const expectedOverwatchPaths = Object.freeze([
  "overwatch/artifact-contracts/canonical-artifact-registry.json",
  governanceDocumentationPath,
  governancePath,
  reportPath,
  "package.json",
  "scripts/verify-overwatch-cloudflare-founder-attended-create-receipt-v2.mjs",
  "scripts/verify-overwatch-cloudflare-founder-attended-get-only-recovery.mjs",
  "scripts/verify-overwatch-cloudflare-founder-attended-response-contract-repair.mjs",
  "scripts/verify-overwatch-cloudflare-founder-attended-service-token.mjs",
  "scripts/verify-overwatch-cloudflare-founder-attended-tty-compatibility.mjs",
  "scripts/verify-overwatch-cloudflare-unattended-access.mjs",
  "tests/overwatch-cloudflare-founder-attended-create-receipt-v2.test.mjs"
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

export function evaluateFounderAttendedCreateReceiptV2Governance({ governance, report }) {
  const failures = [];
  const require = (condition, message) => {
    if (!condition) failures.push(message);
  };

  require(governance.governanceId ===
    "cloudflare-founder-attended-live-create-receipt-safe-provisioning-repair-governance-v2",
  "Governance ID drifted.");
  require(governance.batchId === "BATCH-20260715-004", "Batch ID drifted.");
  require(governance.owningSubsystem === "Prometheus Overwatch", "Governance owner drifted.");
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
    "Ownership is not affirmed.");
  require(governance.dispatchAudit.overwatchModifiedSubsystemImplementation === false,
    "Overwatch claims an implementation edit.");
  require(equal(governance.ownerEvidence, Object.entries(expectedOwnerHashes).map(
    ([path, sha256AtOwnerCommit]) => ({ path, sha256AtOwnerCommit })
  )), "Owner evidence map drifted.");

  require(governance.rootCauseClassification.historicalRejectedDimensionRecoverable === false,
    "Governance invents a historical response dimension.");
  require(governance.rootCauseClassification.historicalResponseRetained === false,
    "Governance claims the historical response was retained.");
  require(governance.rootCauseClassification.futureFailuresClassifiedByFixedNonsecretReason === true,
    "Fixed future classification is not required.");
  require(governance.officialResponseContracts.create.httpStatus === 200,
    "Create HTTP contract drifted.");
  require(governance.officialResponseContracts.create.nameEchoOptionalInProviderSchema === true,
    "Optional name echo drifted.");
  require(governance.officialResponseContracts.create.durationEchoOptionalInProviderSchema === true,
    "Optional duration echo drifted.");
  require(governance.officialResponseContracts.create.exactRequestDuration === "720h",
    "Duration drifted.");
  require(governance.officialResponseContracts.list.maximumPages === 100,
    "List page ceiling drifted.");
  require(governance.officialResponseContracts.delete.followUpExactNameAbsenceRequired === true,
    "Delete follow-up proof drifted.");
  require(governance.officialResponseContracts.delete.responseAloneConfirmsCleanup === false,
    "Delete response became sufficient cleanup proof.");

  const boundary = governance.createReceiptBoundary;
  require(boundary.freshAttendedGetRequired === true, "Fresh GET is not required.");
  require(boundary.freshOneShotControlRequired === true, "Fresh control is not required.");
  require(boundary.predecessorControlOrReceiptReuseAllowed === false,
    "Predecessor evidence reuse is allowed.");
  require(boundary.createAttemptsMaximum === 1, "Multiple POSTs are allowed.");
  require(boundary.automaticRetryAllowed === false, "Automatic retry is allowed.");
  require(boundary.returnedIdAloneAuthorizesDelete === false,
    "A returned ID alone can authorize deletion.");
  require(boundary.uniquePostCreateProofRequired === true, "Unique proof is not required.");
  require(boundary.wrongNameOrDurationDeleteAttempts === 0,
    "Wrong-name or wrong-duration deletion is allowed.");
  require(boundary.ambiguousMalformedMismatchedOrDuplicateProofDeleteAttempts === 0,
    "Ambiguous proof can delete.");
  require(boundary.compensationRequiresSeparateNativeTtyConfirmation === true,
    "Separate compensation attendance is not required.");
  require(boundary.compensationDeleteAttemptsMaximum === 1,
    "Compensation permits multiple DELETEs.");
  require(boundary.temporaryProvisioningApiTokenPreserved === true,
    "Temporary provisioning token is not preserved.");

  require(governance.credentialBoundary.keychainPairAllOrRollback === true,
    "Keychain pair is not atomic-or-rollback.");
  require(governance.credentialBoundary.valuesPrintedLoggedHashedMeasuredOrPersisted === false,
    "Credential metadata exposure is allowed.");
  require(equal(governance.reasonEvidence.allowedReasonCodes,
    CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_REASON_CODES),
  "Reason-code vocabulary drifted.");
  require(equal(governance.reasonEvidence.finalCliOutcomes,
    CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_FINAL_OUTCOMES),
  "Final outcome vocabulary drifted.");

  for (const [field, expected] of Object.entries({
    cloudflareApiContacted: false,
    realKeychainValuesRead: false,
    credentialCreatedDeletedStoredOrChanged: false,
    realControlReceiptOrReasonEvidenceCreated: false,
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
  require(governance.releaseBoundary.deploymentAuthorized === false,
    "Governance authorizes deployment.");
  require(governance.releaseBoundary.liveGetAuthorizedByThisBatch === false,
    "Governance authorizes a live GET.");
  require(governance.releaseBoundary.controlPreparationAuthorized === false,
    "Governance authorizes control preparation.");
  require(governance.releaseBoundary.provisioningAuthorized === false,
    "Governance authorizes provisioning.");
  require(governance.releaseBoundary.nextSafeCommandMustBeGetOnly === true,
    "Next safe command is not constrained to GET-only.");

  require(report.batchId === "BATCH-20260715-004", "Report batch ID drifted.");
  require(report.owners.implementation === "Prometheus Infrastructure",
    "Report implementation owner drifted.");
  require(report.owners.verification === "Prometheus Overwatch",
    "Report verification owner drifted.");
  require(report.owners.implementationCommit === ownerCommit,
    "Report owner commit drifted.");
  require(report.owners.ownershipRespected === true, "Report does not affirm ownership.");
  require(report.completedWork.returnedIdAloneCannotAuthorizeDelete === true,
    "Report weakens delete identity.");
  require(report.completedWork.onePostMaximumNoRetry === true,
    "Report weakens one-POST behavior.");
  require(report.completedWork.nextActionGetOnly === true,
    "Report next action is not GET-only.");
  require(report.boundaries.cloudflareApiContacted === false,
    "Report claims Cloudflare contact.");
  require(report.boundaries.realKeychainValuesRead === false,
    "Report claims real Keychain access.");
  require(report.boundaries.deploymentPerformed === false,
    "Report claims deployment.");
  require(report.boundaries.recommendationInfluence === "OFF",
    "Report claims recommendation influence.");

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
    "Classify attended Cloudflare create receipts"
  ])) throw new Error("Infrastructure commit metadata drifted.");
  execFileSync("/usr/bin/git", ["merge-base", "--is-ancestor", ownerCommit, "HEAD"], {
    cwd: root,
    stdio: "ignore"
  });
  const paths = git(["diff-tree", "--no-commit-id", "--name-only", "-r", ownerCommit])
    .split("\n").filter(Boolean);
  if (!equal(paths, Object.keys(expectedOwnerHashes))) {
    throw new Error("Infrastructure commit file set drifted.");
  }
  if (paths.some(path => path === "package.json" || path.startsWith("overwatch/"))) {
    throw new Error("Infrastructure crossed the Overwatch ownership boundary.");
  }
  const evidence = new Map(governance.ownerEvidence.map(item => [item.path, item]));
  for (const [path, expectedHash] of Object.entries(expectedOwnerHashes)) {
    const ownerBytes = execFileSync("/usr/bin/git", ["show", `${ownerCommit}:${path}`], {
      cwd: root,
      encoding: null,
      stdio: ["ignore", "pipe", "ignore"]
    });
    if (sha256(ownerBytes) !== expectedHash
      || evidence.get(path)?.sha256AtOwnerCommit !== expectedHash
      || sha256(readFileSync(resolve(root, path))) !== expectedHash) {
      throw new Error(`Infrastructure owner evidence drifted: ${path}`);
    }
  }
}

function verifyOverwatchOwnership() {
  const head = git(["rev-parse", "HEAD"]);
  if (head === ownerCommit) return;
  const fields = git([
    "show", "-s", "--format=%P%n%an <%ae>%n%cn <%ce>%n%s", overwatchGovernanceCommit
  ]).split("\n");
  if (!equal(fields, [
    ownerCommit,
    "Prometheus Overwatch <overwatch@prometheus.local>",
    "Prometheus Overwatch <overwatch@prometheus.local>",
    "Govern attended Cloudflare create receipt repair"
  ])) throw new Error("Overwatch commit metadata drifted.");
  const paths = git([
    "diff-tree", "--no-commit-id", "--name-only", "-r", overwatchGovernanceCommit
  ])
    .split("\n").filter(Boolean);
  if (!equal([...paths].sort(), [...expectedOverwatchPaths].sort())) {
    throw new Error("Overwatch file set drifted.");
  }
  if (paths.some(path => path.startsWith("workers/infrastructure/")
    || path.startsWith("scripts/lib/cloudflare-founder-attended-create-receipt-v2")
    || path.startsWith("scripts/run-cloudflare-founder-attended-create-receipt-v2"))) {
    throw new Error("Overwatch modified Infrastructure implementation.");
  }
  execFileSync("/usr/bin/git", [
    "merge-base", "--is-ancestor", overwatchGovernanceCommit, "HEAD"
  ], { cwd: root, stdio: "ignore" });
  if (head === overwatchGovernanceCommit) return;
  const repairFields = git([
    "show", "-s", "--format=%P%n%an <%ae>%n%cn <%ce>%n%s", "HEAD"
  ]).split("\n");
  if (!equal(repairFields, [
    overwatchGovernanceCommit,
    "Prometheus Overwatch <overwatch@prometheus.local>",
    "Prometheus Overwatch <overwatch@prometheus.local>",
    "Repair attended create receipt release verification"
  ])) throw new Error("Overwatch verification repair metadata drifted.");
  const repairPaths = git(["diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD"])
    .split("\n").filter(Boolean);
  if (!equal(repairPaths, [
    "scripts/verify-overwatch-cloudflare-founder-attended-create-receipt-v2.mjs"
  ])) throw new Error("Overwatch verification repair file set drifted.");
}

function verifyImplementationBoundary() {
  const contract = readJson(contractPath);
  const workflow = read("scripts/lib/cloudflare-founder-attended-create-receipt-v2-workflow.mjs");
  const production = read("scripts/lib/cloudflare-founder-attended-create-receipt-v2-production.mjs");
  const getOnly = read("scripts/run-cloudflare-founder-attended-create-receipt-v2-get-only.mjs");
  if (contract.contractVersion !== "cloudflare-founder-attended-create-receipt-v2"
    || contract.status !== "IMPLEMENTED_SOURCE_NOT_EXECUTED"
    || contract.officialContracts.create.httpStatus !== 200
    || contract.postCreateProof.returnedIdAloneAuthorizesDelete !== false
    || contract.futureLifecycle.createAttemptsMaximum !== 1
    || contract.futureLifecycle.compensationAuthorizationSeparate !== true
    || contract.baseline.cloudflareApiContacted !== false
    || contract.baseline.realKeychainValuesRead !== false) {
    throw new Error("Infrastructure v2 contract drifted.");
  }
  if ((workflow.match(/method:\s*"POST"/gu) || []).length !== 1
    || (workflow.match(/method:\s*"DELETE"/gu) || []).length !== 1
    || !/totalEntries === 1 && expectedMatches === 1/u.test(workflow)
    || !/"compensate-v2-created-resource"/u.test(workflow)
    || /setTimeout|maxRetries|retryAfter|automaticRetry/iu.test(workflow)
    || /console\.(?:log|error)/u.test(workflow)) {
    throw new Error("Infrastructure v2 workflow boundary drifted.");
  }
  if (!/provisionFounderAttendedCreateReceiptV2TestOnly/u.test(production)
    || /provisionFounderAttendedResponseContractSuccessorTestOnly/u.test(production)
    || !/attempts\.posts !== 1/u.test(production)
    || !/attempts\.deletes !== 1/u.test(production)
    || /setTimeout|maxRetries|retryAfter|automaticRetry/iu.test(production)) {
    throw new Error("Infrastructure v2 production adapter drifted.");
  }
  if (/method:\s*"(?:POST|PUT|PATCH|DELETE)"/u.test(getOnly)
    || /provisionFounderAttended/u.test(getOnly)
    || !/console\.log\(result\.outcome\)/u.test(getOnly)) {
    throw new Error("Next action is not structurally GET-only.");
  }
  const owner = verifyCloudflareFounderAttendedCreateReceiptV2();
  if (owner.status !== "passed") throw new Error("Infrastructure owner verifier failed.");
}

function verifyPredecessorTransitions(governance) {
  const packageTransition = governance.protectedReleaseWiringTransitions[0];
  const basePackage = execFileSync("/usr/bin/git", ["show", `${ownerParent}:package.json`], {
    cwd: root,
    encoding: null,
    stdio: ["ignore", "pipe", "ignore"]
  });
  if (packageTransition.previousSha256 !== sha256(basePackage)
    || packageTransition.successorSha256 !== sha256(read("package.json"))
    || packageTransition.owner !== "Prometheus Overwatch") {
    throw new Error("Package release-wiring transition drifted.");
  }
  for (const item of governance.overwatchVerificationSuccessors) {
    const previous = execFileSync("/usr/bin/git", ["show", `${ownerParent}:${item.path}`], {
      cwd: root,
      encoding: null,
      stdio: ["ignore", "pipe", "ignore"]
    });
    if (item.previousSha256 !== sha256(previous)
      || item.successorSha256 !== sha256(readFileSync(resolve(root, item.path)))
      || item.owner !== "Prometheus Overwatch") {
      throw new Error(`Overwatch verification successor drifted: ${item.path}`);
    }
  }
}

function verifyCanonicalRegistration() {
  const registry = readJson(registryPath);
  const matches = registry.governanceArtifacts.filter(item => item.artifactId ===
    "cloudflare-founder-attended-live-create-receipt-safe-provisioning-repair-governance-v2");
  const expected = {
    artifactId: "cloudflare-founder-attended-live-create-receipt-safe-provisioning-repair-governance-v2",
    artifactType: "overwatch_infrastructure_attended_create_receipt_safe_provisioning_governance",
    ownerSubsystem: "Prometheus Overwatch",
    path: governancePath,
    documentationPath: governanceDocumentationPath,
    schema: "CloudflareFounderAttendedLiveCreateReceiptSafeProvisioningRepairGovernanceV2",
    writeAllowed: ["Prometheus Overwatch"],
    readAllowed: ["Prometheus Infrastructure", "Prometheus Overwatch"],
    productionConsumer: false,
    failClosedIfMissing: true
  };
  if (matches.length !== 1 || !equal(matches[0], expected)) {
    throw new Error("Canonical v2 governance registration drifted.");
  }
}

function verifyReleaseWiring(governance) {
  const packageJson = readJson("package.json");
  const expectedOverwatch =
    "node scripts/verify-overwatch-cloudflare-founder-attended-create-receipt-v2.mjs && node --test tests/overwatch-cloudflare-founder-attended-create-receipt-v2.test.mjs";
  const expectedOwner =
    "node scripts/verify-cloudflare-founder-attended-create-receipt-v2.mjs && node --test tests/cloudflare-founder-attended-create-receipt-v2.test.mjs";
  if (packageJson.scripts["overwatch:cloudflare-founder-attended-create-receipt-v2:check"] !==
      expectedOverwatch
    || packageJson.scripts["infrastructure:cloudflare-founder-attended-create-receipt-v2:check"] !==
      expectedOwner
    || !packageJson.scripts["test:overwatch"].includes(
      "tests/overwatch-cloudflare-founder-attended-create-receipt-v2.test.mjs")
    || !packageJson.scripts.test.includes(
      "overwatch:cloudflare-founder-attended-create-receipt-v2:check")
    || !packageJson.scripts.test.includes(
      "infrastructure:cloudflare-founder-attended-create-receipt-v2:check")) {
    throw new Error("v2 release wiring drifted.");
  }
  const releaseCommands = `${expectedOverwatch} ${expectedOwner}`;
  if (/wrangler|curl|https:\/\/|run-cloudflare-founder-attended-create-receipt-v2/u
    .test(releaseCommands)) {
    throw new Error("v2 release gate contains a live action.");
  }
  if (governance.releaseBoundary.nextSafeCommandMustBeGetOnly !== true
    || CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_NEXT_SAFE_COMMAND !==
      "node scripts/run-cloudflare-founder-attended-create-receipt-v2-get-only.mjs") {
    throw new Error("Next safe command governance drifted.");
  }
}

function verifyNoAutomaticDeployment() {
  const workflowPaths = git(["ls-files", ".github/workflows"])
    .split("\n").filter(Boolean);
  for (const path of workflowPaths) {
    const source = read(path);
    if (/wrangler\s+(?:deploy|versions\s+upload|versions\s+deploy)|cloudflare.*deploy/iu
      .test(source)) {
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

export function verifyOverwatchFounderAttendedCreateReceiptV2() {
  const governance = readJson(governancePath);
  const report = readJson(reportPath);
  const evaluated = evaluateFounderAttendedCreateReceiptV2Governance({ governance, report });
  if (!evaluated.ok) throw new Error(evaluated.failures.join("\n"));
  verifyOwnerCommit(governance);
  verifyOverwatchOwnership();
  verifyImplementationBoundary();
  verifyPredecessorTransitions(governance);
  verifyCanonicalRegistration();
  verifyReleaseWiring(governance);
  verifyNoAutomaticDeployment();
  verifySecretSafety();
  return Object.freeze({
    status: "passed",
    batchId: "BATCH-20260715-004",
    implementationOwner: "Prometheus Infrastructure",
    verificationOwner: "Prometheus Overwatch",
    implementationCommit: ownerCommit,
    focusedOwnerTests: 29,
    cloudflareApiContacted: false,
    realKeychainValuesRead: false,
    credentialActionPerformed: false,
    deploymentPerformed: false,
    productionMutationPerformed: false,
    prospectiveCollection: "OFF",
    cohortActivation: "OFF",
    recommendationInfluence: "OFF",
    nextSafeCommand: CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_NEXT_SAFE_COMMAND
  });
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  try {
    console.log(JSON.stringify(verifyOverwatchFounderAttendedCreateReceiptV2(), null, 2));
  } catch {
    console.error("Overwatch Cloudflare Founder-attended create-receipt v2 check failed.");
    process.exitCode = 1;
  }
}
