import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";

import {
  listTrackedFiles,
  scanTrackedRepository
} from "./check-cloudflare-unattended-secret-presence.mjs";
import {
  verifyCloudflareFounderAttendedGetOnlyRecovery
} from "./verify-cloudflare-founder-attended-get-only-recovery.mjs";
import {
  verifyCloudflareFounderAttendedResponseContractRepair
} from "./verify-cloudflare-founder-attended-response-contract-repair.mjs";
import {
  verifyOverwatchFounderAttendedFreshAttemptEvidenceRotation
} from "./verify-overwatch-cloudflare-founder-attended-fresh-attempt-evidence-rotation.mjs";

const root = resolve(import.meta.dirname, "..");
const governancePath =
  "overwatch/governance/cloudflare-founder-attended-service-token-response-contract-repair-v1.json";
const governanceDocumentationPath =
  "overwatch/governance/cloudflare-founder-attended-service-token-response-contract-repair-v1.md";
const reportPath =
  "overwatch/reports/BATCH-20260715-003-cloudflare-founder-attended-service-token-response-contract-repair.json";
const contractPath =
  "workers/infrastructure/cloudflare-founder-attended-response-contract-repair-v1.json";
const registryPath = "overwatch/artifact-contracts/canonical-artifact-registry.json";
const createReceiptV2GovernancePath =
  "overwatch/governance/cloudflare-founder-attended-live-create-receipt-safe-provisioning-repair-v2.json";
const primaryCommit = "04a38d6424099824fa3760314c7b660ce30b6930";
const primaryParent = "d32ffd8f6ea255fa029976b1bf0006663d567153";
const primaryTree = "9eccf0475775253653e6e5633824d0562e8ee047";
const successorCommit = "e7730315fdc8e14528b1476102984697151b4303";
const successorTree = "9bfd2f5c614ece752df57ff25bb6580f4ecee1d6";
const rotationOwnerSuccessorPaths = new Set([
  "scripts/lib/cloudflare-founder-attended-response-contract-artifacts.mjs",
  "scripts/lib/cloudflare-founder-attended-response-contract-production.mjs",
  "scripts/lib/cloudflare-founder-attended-response-contract-workflow.mjs",
  "scripts/verify-cloudflare-founder-attended-response-contract-repair.mjs",
  "tests/cloudflare-founder-attended-owner-verifier-ownership.test.mjs",
  "tests/cloudflare-founder-attended-response-contract-repair.test.mjs"
]);

const expectedPrimaryHashes = Object.freeze({
  "docs/cloudflare-founder-attended-response-contract-repair-v1.md":
    "d82064674fde05ac09b98a3c1b5b4dc6dfa7b456dfe0dc86ec1dcc919048e0b0",
  "scripts/lib/cloudflare-founder-attended-response-contract-artifacts.mjs":
    "5fa96c24ff5d858fd706a1458eaefcc9e1eee0a8443fc3aae377dff0d5348614",
  "scripts/lib/cloudflare-founder-attended-response-contract-constants.mjs":
    "016f896f1eff05733b3de998def42d288ecd949332c29be880b84c027b65beda",
  "scripts/lib/cloudflare-founder-attended-response-contract-production.mjs":
    "7a73de6d07e00aa5af5182a8bacd6bc0ef26c857e21696be3c432341cb5801c9",
  "scripts/lib/cloudflare-founder-attended-response-contract-workflow.mjs":
    "94b4037535e450d14ae3ff444ee56781b542298f067492fd9033d1f0c0a67ec5",
  "scripts/run-cloudflare-founder-attended-response-contract-diagnostic.mjs":
    "1fe7f607c31e743980dd46ac222a8c41deea966c645a2573e4aa2b78a632a40b",
  "scripts/run-cloudflare-founder-attended-response-contract-prepare.mjs":
    "fddedd4421c5b8360c708b6870c800365fe83a09b654be5aea7aaef54a307280",
  "scripts/run-cloudflare-founder-attended-response-contract-provision.mjs":
    "51ba1863efc0db549b57ea49df67e389f55a441eecb51337c05b68f69c94e3ad",
  "scripts/verify-cloudflare-founder-attended-response-contract-repair.mjs":
    "7ea559ae1b749cb6937e9803bfb596ed0d669e41868e7837e6299ea02d04853b",
  "tests/cloudflare-founder-attended-response-contract-repair.test.mjs":
    "cb998b7b266a4bcc6e1eb6f7db4aeb807801d5c687dc9fa995714a1ca1dcd1b9",
  "workers/infrastructure/cloudflare-founder-attended-response-contract-repair-v1.json":
    "75f7265f0bec212b171d949ecd1e5a645d32befcd9d4c8e6a54a3d9321ef1d4a"
});
const expectedSuccessorHashes = Object.freeze({
  "scripts/verify-cloudflare-founder-attended-get-only-recovery.mjs":
    "fc6b4f42ba1ff7274fa65bd94f3c3cbb19267d69f51af70d1055f05244bccfa9",
  "scripts/verify-cloudflare-founder-attended-response-contract-repair.mjs":
    "6eb9cc989ebfac541014e3cb2debe633f3b7704c2fb64c6e19ac5ade3ec29408",
  "tests/cloudflare-founder-attended-owner-verifier-ownership.test.mjs":
    "d1955f233a213f57e39bf2a191043a72a37d705854dd9a427d514806e5a1fa4c"
});
const phases = Object.freeze([
  "GET_COMPLETED",
  "EXACT_NAME_ABSENT",
  "EXACT_NAME_PRESENT",
  "POST_ATTEMPTED",
  "CREATE_RESPONSE_VALID",
  "CREATE_RESPONSE_INVALID",
  "KEYCHAIN_STORED",
  "KEYCHAIN_NOT_STORED",
  "DELETE_ATTEMPTED",
  "DELETE_CONFIRMED",
  "DELETE_NOT_CONFIRMED",
  "SUCCESS",
  "COMPENSATED",
  "MANUAL_REVIEW"
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

export function evaluateFounderAttendedResponseContractGovernance({ governance, report }) {
  const failures = [];
  const require = (condition, message) => {
    if (!condition) failures.push(message);
  };
  require(governance.governanceId ===
    "cloudflare-founder-attended-service-token-response-contract-repair-governance-v1",
  "Governance ID drifted.");
  require(governance.version === "1.0.0", "Governance version drifted.");
  require(governance.batchId === "BATCH-20260715-003", "Batch ID drifted.");
  require(governance.status === "OWNER_IMPLEMENTATION_VERIFIED_REAL_EXECUTION_NOT_AUTHORIZED",
    "Governance status drifted.");
  require(governance.owningSubsystem === "Prometheus Overwatch", "Governance owner drifted.");
  require(governance.dispatchAudit?.implementationOwner === "Prometheus Infrastructure",
    "Implementation owner drifted.");
  require(governance.dispatchAudit?.verificationOwner === "Prometheus Overwatch",
    "Verification owner drifted.");
  require(governance.dispatchAudit?.implementationOwnershipRespected === true,
    "Implementation ownership is not affirmed.");
  require(governance.dispatchAudit?.overwatchModifiedSubsystemImplementation === false,
    "Overwatch crossed the implementation boundary.");
  require(equal(governance.dispatchAudit?.implementationCommits?.map(item => item.commit), [
    primaryCommit,
    successorCommit
  ]), "Owner commit order drifted.");
  require(equal(governance.primaryOwnerEvidence?.map(item => item.path),
    Object.keys(expectedPrimaryHashes)), "Primary owner evidence paths drifted.");
  require(governance.primaryOwnerEvidence?.every(item =>
    expectedPrimaryHashes[item.path] === item.sha256AtOwnerCommit),
  "Primary owner hashes drifted.");
  require(equal(governance.ownerSuccessorEvidence?.map(item => item.path),
    Object.keys(expectedSuccessorHashes)), "Owner successor evidence paths drifted.");
  require(governance.ownerSuccessorEvidence?.every(item =>
    expectedSuccessorHashes[item.path] === item.sha256AtSuccessorCommit),
  "Owner successor hashes drifted.");

  const create = governance.officialResponseContracts?.create || {};
  require(create.httpStatus === 200, "Create status drifted.");
  require(create.expiresAtRequired === false, "Create improperly requires expires_at.");
  require(create.documentedTimestampsAccepted === true, "Create timestamps drifted.");
  require(create.optionalEnvelopeFieldsAccepted === true, "Create optional fields drifted.");
  require(create.exactNameRequired ===
    "Prometheus Overwatch Read-Only Smoke Verification", "Create name drifted.");
  require(create.exactDurationRequired === "720h", "Create duration drifted.");
  require(create.validClientIdRequired === true && create.validClientSecretRequired === true,
    "Create credential completeness weakened.");
  const deletion = governance.officialResponseContracts?.delete || {};
  require(deletion.httpStatus === 200 && deletion.documentedResultObjectAccepted === true,
    "Delete response contract drifted.");
  require(deletion.followUpExactNameGetRequired === true
    && deletion.responseAloneConfirmsCleanup === false, "Delete cleanup proof weakened.");
  const list = governance.officialResponseContracts?.list || {};
  require(list.resultOptional === true && list.resultInfoOptional === true
    && list.paginationMembersOptional === true, "List optional fields drifted.");
  require(list.maximumPages === 100 && list.exactNameDuplicateFailsClosed === true,
    "List bounds weakened.");

  const oneShot = governance.oneShotBoundary || {};
  for (const field of [
    "predecessorControlReuseAllowed",
    "predecessorReceiptReuseAllowed",
    "realSuccessorControlCreated",
    "automaticRetryAllowed",
    "retryAfterUncertaintyAllowed"
  ]) require(oneShot[field] === false, `One-shot boundary ${field} widened.`);
  require(oneShot.freshAttendedExactNameGetRequired === true
    && oneShot.separateFounderControlAuthorizationRequired === true,
  "Fresh successor authorization weakened.");
  require(oneShot.createAttemptsMaximum === 1 && oneShot.deleteAttemptsMaximum === 1,
    "Attempt ceiling widened.");
  require(oneShot.deleteRequiresFollowUpGet === true
    && oneShot.temporaryProvisioningTokenPreserved === true,
  "Cleanup or token preservation weakened.");

  require(equal(governance.phaseEvidence?.allowedPhases, phases), "Phase vocabulary drifted.");
  require(equal(governance.phaseEvidence?.finalCliOutcomes,
    ["SUCCESS", "COMPENSATED", "MANUAL_REVIEW"]), "CLI outcomes drifted.");
  require(governance.phaseEvidence?.secretOrIdentifierEvidenceAllowed === false,
    "Secret evidence output was enabled.");

  const execution = governance.executionBoundary || {};
  for (const field of [
    "cloudflareApiContacted",
    "realKeychainValuesRead",
    "credentialCreatedDeletedOrChanged",
    "realSuccessorControlCreated",
    "temporaryProvisioningTokenChanged",
    "deploymentPerformed",
    "productionMutationPerformed"
  ]) require(execution[field] === false, `Execution boundary ${field} drifted.`);
  require(execution.prospectiveCollection === "OFF"
    && execution.cohortActivation === "OFF"
    && execution.recommendationInfluence === "OFF", "Product safety boundary drifted.");
  require(governance.releaseBoundary?.deploymentAuthorized === false
    && governance.releaseBoundary?.successorControlCreationAuthorized === false
    && governance.releaseBoundary?.provisioningAuthorized === false,
  "Release authorization widened.");

  require(report.batchId === "BATCH-20260715-003", "Report batch drifted.");
  require(report.owners?.implementation === "Prometheus Infrastructure"
    && report.owners?.verification === "Prometheus Overwatch"
    && report.owners?.ownershipRespected === true
    && report.owners?.overwatchModifiedInfrastructureImplementation === false,
  "Report ownership audit failed.");
  require(report.boundaries?.cloudflareApiContacted === false
    && report.boundaries?.realKeychainValuesRead === false
    && report.boundaries?.deploymentPerformed === false,
  "Report external-action boundary drifted.");
  return Object.freeze({ ok: failures.length === 0, failures: Object.freeze(failures) });
}

function verifyCommit(commit, expected) {
  const metadata = git(["show", "-s", "--format=%H%n%P%n%T%n%an <%ae>%n%cn <%ce>%n%s", commit])
    .split("\n");
  if (!equal(metadata, expected.metadata)) throw new Error(`${commit} metadata drifted.`);
  const paths = git(["diff-tree", "--no-commit-id", "--name-only", "-r", commit]).split("\n");
  if (!equal(paths, Object.keys(expected.hashes))) throw new Error(`${commit} file set drifted.`);
  if (paths.some(path => path.startsWith("overwatch/") || path === "package.json")) {
    throw new Error(`${commit} crossed the Overwatch ownership boundary.`);
  }
  for (const [path, hash] of Object.entries(expected.hashes)) {
    const bytes = execFileSync("/usr/bin/git", ["show", `${commit}:${path}`], {
      cwd: root,
      encoding: null,
      stdio: ["ignore", "pipe", "ignore"]
    });
    if (sha256(bytes) !== hash) throw new Error(`${commit} owner hash drifted: ${path}`);
  }
}

function verifyOwnerEvidence(governance, rotation) {
  verifyCommit(primaryCommit, {
    metadata: [
      primaryCommit,
      primaryParent,
      primaryTree,
      "Prometheus Infrastructure <infrastructure@prometheus.local>",
      "Prometheus Infrastructure <infrastructure@prometheus.local>",
      "Repair attended Cloudflare response contracts"
    ],
    hashes: expectedPrimaryHashes
  });
  verifyCommit(successorCommit, {
    metadata: [
      successorCommit,
      primaryCommit,
      successorTree,
      "Prometheus Infrastructure <infrastructure@prometheus.local>",
      "Prometheus Infrastructure <infrastructure@prometheus.local>",
      "Delegate attended verifier release wiring ownership"
    ],
    hashes: expectedSuccessorHashes
  });
  execFileSync("/usr/bin/git", ["merge-base", "--is-ancestor", successorCommit, "HEAD"], {
    cwd: root,
    stdio: "ignore"
  });
  const successorByPath = new Map(
    governance.protectedPredecessorSuccessors.map(item => [item.path, item])
  );
  const rotationVerified = rotation.status === "passed"
    && rotation.batchId === "BATCH-20260715-006"
    && rotation.implementationCommits.at(-1) ===
      "e10719d6d2ff312f2a5473c1fe000810e915509b";
  for (const [path, historicalHash] of Object.entries(expectedPrimaryHashes)) {
    const current = sha256(readFileSync(resolve(root, path)));
    const transition = successorByPath.get(path);
    if (current !== historicalHash
      && !(transition?.historicalSha256 === historicalHash
        && transition?.successorSha256 === current
        && transition?.owner === "Prometheus Infrastructure"
        && transition?.ownerCommit === successorCommit)
      && !(rotationVerified && rotationOwnerSuccessorPaths.has(path))) {
      throw new Error(`Primary owner evidence drifted: ${path}`);
    }
  }
  for (const [path, expectedHash] of Object.entries(expectedSuccessorHashes)) {
    if (sha256(readFileSync(resolve(root, path))) !== expectedHash
      && !(rotationVerified && rotationOwnerSuccessorPaths.has(path))) {
      throw new Error(`Owner successor evidence drifted: ${path}`);
    }
  }
}

function verifyImplementationBoundary() {
  const contract = readJson(contractPath);
  const workflow = read("scripts/lib/cloudflare-founder-attended-response-contract-workflow.mjs");
  const production = read("scripts/lib/cloudflare-founder-attended-response-contract-production.mjs");
  const artifacts = read("scripts/lib/cloudflare-founder-attended-response-contract-artifacts.mjs");
  if (contract.contractVersion !== "cloudflare-founder-attended-response-contract-repair-v1"
    || contract.status !== "IMPLEMENTED_SOURCE_NOT_EXECUTED"
    || contract.officialContracts.create.httpStatus !== 200
    || contract.officialContracts.create.expiresAtRequired !== false
    || contract.officialContracts.create.exactDurationRequired !== "720h"
    || contract.officialContracts.delete.followUpExactNameGetRequired !== true
    || contract.officialContracts.delete.responseAloneConfirmsCleanup !== false) {
    throw new Error("Infrastructure response contract drifted.");
  }
  if ((workflow.match(/method:\s*"POST"/gu) || []).length !== 1
    || (workflow.match(/method:\s*"DELETE"/gu) || []).length !== 1
    || !/response\.status !== 200/u.test(workflow)
    || !/!Object\.hasOwn\(result, field\)/u.test(workflow)
    || !/CLIENT_ID_PATTERN\.test/u.test(workflow)
    || !/CLIENT_SECRET_PATTERN\.test/u.test(workflow)
    || !/phase\("DELETE_CONFIRMED"\)/u.test(workflow)
    || !/await exactNameState/u.test(workflow)
    || /setTimeout|maxRetries|retryAfter|automaticRetry/iu.test(workflow)) {
    throw new Error("Response-contract implementation boundary drifted.");
  }
  if (!/console\.log\(result\.outcome\)/u.test(production)
    || !/console\.error\("MANUAL_REVIEW"\)/u.test(production)
    || /console\.(?:log|error)\([^\n]*(?:credential|clientId|clientSecret|response)/u.test(production)
    || !/O_EXCL/u.test(artifacts)
    || !/fsyncSync/u.test(artifacts)
    || /unlinkSync|rmSync|renameSync|truncateSync/u.test(artifacts)) {
    throw new Error("Output or append-only evidence boundary drifted.");
  }
  const ownerRecovery = verifyCloudflareFounderAttendedGetOnlyRecovery();
  const ownerRepair = verifyCloudflareFounderAttendedResponseContractRepair();
  if (ownerRecovery.status !== "passed" || ownerRepair.status !== "passed") {
    throw new Error("Owner verifier did not pass.");
  }
}

function verifyOverwatchSuccessors(governance) {
  const createReceiptV2Governance = readJson(createReceiptV2GovernancePath);
  const transitions = new Map(
    createReceiptV2Governance.overwatchVerificationSuccessors.map(item => [item.path, item])
  );
  for (const item of governance.overwatchVerificationSuccessors) {
    const current = sha256(readFileSync(resolve(root, item.path)));
    const transition = transitions.get(item.path);
    if (!/^[0-9a-f]{64}$/u.test(item.previousSha256)
      || (current !== item.successorSha256
        && !(transition?.previousSha256 === item.successorSha256
          && transition?.successorSha256 === current
          && transition?.owner === "Prometheus Overwatch"))) {
      throw new Error(`Overwatch verifier successor drifted: ${item.path}`);
    }
  }
}

function verifyCanonicalRegistration() {
  const registry = readJson(registryPath);
  const matches = registry.governanceArtifacts.filter(item => item.artifactId ===
    "cloudflare-founder-attended-service-token-response-contract-repair-governance-v1");
  const expected = {
    artifactId: "cloudflare-founder-attended-service-token-response-contract-repair-governance-v1",
    artifactType: "overwatch_infrastructure_attended_response_contract_repair_governance",
    ownerSubsystem: "Prometheus Overwatch",
    path: governancePath,
    documentationPath: governanceDocumentationPath,
    schema: "CloudflareFounderAttendedServiceTokenResponseContractRepairGovernanceV1",
    writeAllowed: ["Prometheus Overwatch"],
    readAllowed: ["Prometheus Infrastructure", "Prometheus Overwatch"],
    productionConsumer: false,
    failClosedIfMissing: true
  };
  if (matches.length !== 1 || !equal(matches[0], expected)) {
    throw new Error("Canonical response-contract governance registration drifted.");
  }
}

function verifyReleaseWiring(governance) {
  const packageJson = readJson("package.json");
  const expectedOverwatch =
    "node scripts/verify-overwatch-cloudflare-founder-attended-response-contract-repair.mjs && node --test tests/overwatch-cloudflare-founder-attended-response-contract-repair.test.mjs";
  const expectedOwner =
    "node scripts/verify-cloudflare-founder-attended-response-contract-repair.mjs && node --test tests/cloudflare-founder-attended-response-contract-repair.test.mjs tests/cloudflare-founder-attended-owner-verifier-ownership.test.mjs";
  const transition = governance.protectedReleaseWiringTransitions[0];
  const createReceiptV2Governance = readJson(createReceiptV2GovernancePath);
  const currentTransition = createReceiptV2Governance.protectedReleaseWiringTransitions[0];
  if (packageJson.scripts["overwatch:cloudflare-founder-attended-response-contract:check"] !==
      expectedOverwatch
    || packageJson.scripts["infrastructure:cloudflare-founder-attended-response-contract:check"] !==
      expectedOwner
    || !packageJson.scripts["test:overwatch"].includes(
      "tests/overwatch-cloudflare-founder-attended-response-contract-repair.test.mjs")
    || !packageJson.scripts["test:overwatch"].includes(
      "tests/overwatch-cloudflare-founder-attended-create-receipt-v2.test.mjs")
    || !packageJson.scripts.test.includes(
      "overwatch:cloudflare-founder-attended-response-contract:check")
    || !packageJson.scripts.test.includes(
      "infrastructure:cloudflare-founder-attended-response-contract:check")
    || !packageJson.scripts.test.includes(
      "overwatch:cloudflare-founder-attended-create-receipt-v2:check")
    || !packageJson.scripts.test.includes(
      "infrastructure:cloudflare-founder-attended-create-receipt-v2:check")
    || transition.successorSha256 !== currentTransition.previousSha256
    || currentTransition.successorSha256 !== sha256(read("package.json"))
    || currentTransition.owner !== "Prometheus Overwatch") {
    throw new Error("Response-contract release wiring drifted.");
  }
  if (/wrangler|curl|https:\/\/|run-cloudflare-founder-attended-response-contract-(?:diagnostic|prepare|provision)/u
    .test(`${expectedOverwatch} ${expectedOwner}`)) {
    throw new Error("Response-contract release gate contains an external action.");
  }
}

export function verifyOverwatchFounderAttendedResponseContractRepair() {
  const governance = readJson(governancePath);
  const report = readJson(reportPath);
  const evaluated = evaluateFounderAttendedResponseContractGovernance({ governance, report });
  if (!evaluated.ok) throw new Error(evaluated.failures.join("\n"));
  const rotation = verifyOverwatchFounderAttendedFreshAttemptEvidenceRotation();
  verifyOwnerEvidence(governance, rotation);
  verifyImplementationBoundary();
  verifyOverwatchSuccessors(governance);
  verifyCanonicalRegistration();
  verifyReleaseWiring(governance);
  const repositoryFiles = git(["ls-files", "--cached", "--others", "--exclude-standard"])
    .split("\n").filter(Boolean);
  const trackedFiles = [...new Set([...listTrackedFiles(root), ...repositoryFiles])];
  if (scanTrackedRepository({ root, trackedFiles }).length !== 0) {
    throw new Error("Tracked secret findings detected.");
  }
  return Object.freeze({
    status: "passed",
    batchId: "BATCH-20260715-003",
    implementationOwner: "Prometheus Infrastructure",
    verificationOwner: "Prometheus Overwatch",
    implementationCommits: Object.freeze([primaryCommit, successorCommit]),
    responseContractTests: 17,
    ownerVerifierOwnershipTests: 5,
    cloudflareApiContacted: false,
    realKeychainValuesRead: false,
    realSuccessorControlCreated: false,
    temporaryProvisioningTokenChanged: false,
    deploymentPerformed: false,
    productionMutationPerformed: false,
    recommendationInfluence: "OFF"
  });
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  console.log(JSON.stringify(verifyOverwatchFounderAttendedResponseContractRepair(), null, 2));
}
