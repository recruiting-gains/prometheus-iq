import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { scanTextForCloudflareSecrets } from "./check-cloudflare-unattended-secret-presence.mjs";
import {
  CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_BATCH_ID,
  CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_CONFIRMATIONS,
  CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_FINAL_OUTCOMES,
  CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_NEXT_SAFE_COMMAND,
  CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_REASON_CODES
} from "./lib/cloudflare-founder-attended-create-receipt-v2-constants.mjs";
import {
  CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_INFRASTRUCTURE_PREDECESSOR_PATHS
} from "./verify-cloudflare-founder-attended-response-contract-repair.mjs";

const root = resolve(import.meta.dirname, "..");
const baselineCommit = "f630c2af6e5e4722105d2b1e3ee959fb28f5da66";
const baselineTree = "0a629551a428c360ab9e0d9a5af47d0fdf8d0d8e";
const documentationPath = "docs/cloudflare-founder-attended-create-receipt-v2.md";
const metadataPath = "workers/infrastructure/cloudflare-founder-attended-create-receipt-v2.json";
const testPath = "tests/cloudflare-founder-attended-create-receipt-v2.test.mjs";

const v1ResponseContractPaths = Object.freeze([
  "docs/cloudflare-founder-attended-response-contract-repair-v1.md",
  "scripts/lib/cloudflare-founder-attended-response-contract-artifacts.mjs",
  "scripts/lib/cloudflare-founder-attended-response-contract-constants.mjs",
  "scripts/lib/cloudflare-founder-attended-response-contract-production.mjs",
  "scripts/lib/cloudflare-founder-attended-response-contract-workflow.mjs",
  "scripts/run-cloudflare-founder-attended-response-contract-diagnostic.mjs",
  "scripts/run-cloudflare-founder-attended-response-contract-prepare.mjs",
  "scripts/run-cloudflare-founder-attended-response-contract-provision.mjs",
  "scripts/verify-cloudflare-founder-attended-response-contract-repair.mjs",
  "tests/cloudflare-founder-attended-owner-verifier-ownership.test.mjs",
  "tests/cloudflare-founder-attended-response-contract-repair.test.mjs",
  "workers/infrastructure/cloudflare-founder-attended-response-contract-repair-v1.json"
]);

const sourcePaths = Object.freeze([
  documentationPath,
  "scripts/lib/cloudflare-founder-attended-create-receipt-v2-artifacts.mjs",
  "scripts/lib/cloudflare-founder-attended-create-receipt-v2-constants.mjs",
  "scripts/lib/cloudflare-founder-attended-create-receipt-v2-production.mjs",
  "scripts/lib/cloudflare-founder-attended-create-receipt-v2-workflow.mjs",
  "scripts/run-cloudflare-founder-attended-create-receipt-v2-get-only.mjs",
  "scripts/run-cloudflare-founder-attended-create-receipt-v2-prepare.mjs",
  "scripts/run-cloudflare-founder-attended-create-receipt-v2-provision.mjs",
  "scripts/verify-cloudflare-founder-attended-create-receipt-v2.mjs",
  testPath,
  metadataPath
]);

const read = path => readFileSync(resolve(root, path), "utf8");
const readJson = path => JSON.parse(read(path));

function verifyBaseline() {
  assert.equal(
    execFileSync("/usr/bin/git", ["rev-parse", `${baselineCommit}^{tree}`], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim(),
    baselineTree
  );
}

function verifyV1Immutability() {
  const protectedPaths = [...new Set([
    ...CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_INFRASTRUCTURE_PREDECESSOR_PATHS,
    ...v1ResponseContractPaths
  ])];
  assert.equal(protectedPaths.includes("package.json"), false);
  execFileSync("/usr/bin/git", ["diff", "--quiet", baselineCommit, "--", ...protectedPaths], {
    cwd: root,
    stdio: "ignore"
  });
}

function verifySourceOwnership() {
  for (const path of sourcePaths) {
    assert.equal(path === "package.json", false);
    assert.equal(path.startsWith("overwatch/"), false);
    assert.ok(read(path).length > 0, path);
  }
}

function verifyWorkflowBoundary() {
  const workflow = read("scripts/lib/cloudflare-founder-attended-create-receipt-v2-workflow.mjs");
  const production = read("scripts/lib/cloudflare-founder-attended-create-receipt-v2-production.mjs");
  const artifacts = read("scripts/lib/cloudflare-founder-attended-create-receipt-v2-artifacts.mjs");
  const getOnly = read("scripts/run-cloudflare-founder-attended-create-receipt-v2-get-only.mjs");
  const prepare = read("scripts/run-cloudflare-founder-attended-create-receipt-v2-prepare.mjs");
  const provision = read("scripts/run-cloudflare-founder-attended-create-receipt-v2-provision.mjs");

  assert.equal((workflow.match(/method:\s*"POST"/gu) || []).length, 1);
  assert.equal((workflow.match(/method:\s*"DELETE"/gu) || []).length, 1);
  assert.doesNotMatch(workflow, /setTimeout|maxRetries|retryAfter|automaticRetry/iu);
  assert.match(workflow, /CLIENT_ID_PATTERN/u);
  assert.match(workflow, /CLIENT_SECRET_PATTERN/u);
  assert.match(workflow, /CREATE_CLIENT_ID_MISSING/u);
  assert.match(workflow, /CREATE_CLIENT_ID_REJECTED/u);
  assert.match(workflow, /CREATE_CLIENT_SECRET_MISSING/u);
  assert.match(workflow, /CREATE_CLIENT_SECRET_REJECTED/u);
  assert.match(workflow, /const proof = await proveExactCreatedResource/u);
  assert.match(workflow, /totalEntries === 1 && expectedMatches === 1/u);
  assert.match(workflow, /"compensate-v2-created-resource"/u);
  assert.match(workflow, /phase\("DELETE_ATTEMPTED"\)/u);
  assert.match(workflow, /phase\("DELETE_CONFIRMED"\)/u);
  assert.match(workflow, /phase\("DELETE_NOT_CONFIRMED"\)/u);
  assert.doesNotMatch(workflow, /deleteItem\("temporaryApiToken"\)/u);
  assert.doesNotMatch(workflow, /console\.(?:log|error)/u);
  assert.doesNotMatch(workflow, /(?:clientId|clientSecret)[^\n]*(?:createHash|digest\()/u);

  const proofFailureStart = workflow.indexOf("if (!proof.proven)");
  const invalidAfterProof = workflow.indexOf("if (!evaluation.accepted)", proofFailureStart);
  assert.ok(proofFailureStart > 0 && invalidAfterProof > proofFailureStart);
  assert.doesNotMatch(
    workflow.slice(proofFailureStart, invalidAfterProof),
    /compensateCreatedResource/u
  );
  const mismatchStart = workflow.indexOf("CREATE_NAME_ECHO_MISMATCH");
  const durationMismatch = workflow.indexOf("CREATE_DURATION_ECHO_MISMATCH", mismatchStart);
  assert.match(
    workflow.slice(mismatchStart, durationMismatch),
    /CREATE_NAME_ECHO_MISMATCH"\);/u
  );
  assert.doesNotMatch(workflow.slice(mismatchStart, durationMismatch), /proofCandidateTokenId/u);

  assert.match(production, /provisionFounderAttendedCreateReceiptV2TestOnly/u);
  assert.doesNotMatch(production, /provisionFounderAttendedResponseContractSuccessorTestOnly/u);
  assert.match(production, /attempts\.posts \+= 1/u);
  assert.match(production, /attempts\.deletes \+= 1/u);
  assert.match(production, /attempts\.posts !== 1/u);
  assert.match(production, /attempts\.deletes !== 1/u);
  assert.doesNotMatch(production, /setTimeout|maxRetries|retryAfter|automaticRetry/iu);
  assert.match(production, /createControllingTtyConfirmation\(\)/u);
  assert.match(production, /CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_DIRECTORY/u);

  assert.doesNotMatch(getOnly, /method:\s*"(?:POST|PUT|PATCH|DELETE)"/u);
  assert.doesNotMatch(getOnly, /provisionFounderAttended/u);
  assert.match(prepare, /runFounderAttendedCreateReceiptV2PreparationCli/u);
  assert.match(provision, /runFounderAttendedCreateReceiptV2ProvisioningCli/u);
  assert.doesNotMatch(provision, /response-contract-workflow/u);

  assert.match(artifacts, /cloudflare-founder-attended-create-receipt-v2/u);
  assert.doesNotMatch(artifacts, /unlinkSync|rmSync|renameSync|truncateSync/u);
  assert.match(artifacts, /O_EXCL/u);
  assert.match(artifacts, /fsyncSync/u);
}

function verifyOutputBoundary() {
  const workflow = read("scripts/lib/cloudflare-founder-attended-create-receipt-v2-workflow.mjs");
  const artifacts = read("scripts/lib/cloudflare-founder-attended-create-receipt-v2-artifacts.mjs");
  const production = read("scripts/lib/cloudflare-founder-attended-create-receipt-v2-production.mjs");
  const getOnly = read("scripts/run-cloudflare-founder-attended-create-receipt-v2-get-only.mjs");
  const testSource = read(testPath);

  assert.match(artifacts, /CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_REASON_CODES\.includes/u);
  assert.match(artifacts, /writeFileSync\(fd, `\$\{reasonCode\}\\n`/u);
  assert.doesNotMatch(artifacts, /response|clientId|clientSecret|accountId|Authorization/u);
  const publicClassifier = workflow.slice(
    workflow.indexOf("export function classifyFounderAttendedCreateReceiptV2ResponseTestOnly"),
    workflow.indexOf("function optionalInteger")
  );
  assert.doesNotMatch(publicClassifier, /proofCandidateTokenId\s*[,}]/u);
  assert.doesNotMatch(publicClassifier, /credentials\s*[,}]/u);
  assert.doesNotMatch(production, /console\.(?:log|error)\([^\n]*(?:reasonCode|error|response|credential)/u);
  assert.match(getOnly, /console\.log\(result\.outcome\)/u);
  assert.match(getOnly, /console\.error\("MANUAL_REVIEW"\)/u);
  assert.doesNotMatch(testSource, /node:https|httpsRequest|spawnSync\(|execFileSync\(/u);

  const documentation = read(documentationPath);
  const commandMatches = documentation.match(
    /node scripts\/run-cloudflare-founder-attended-create-receipt-v2-get-only\.mjs/gu
  ) || [];
  assert.equal(commandMatches.length, 1);
  assert.doesNotMatch(documentation, /node scripts\/run-cloudflare-founder-attended-create-receipt-v2-(?:prepare|provision)\.mjs/u);
}

function verifyMetadata() {
  const metadata = readJson(metadataPath);
  assert.equal(metadata.contractVersion, "cloudflare-founder-attended-create-receipt-v2");
  assert.equal(metadata.batchId, CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_BATCH_ID);
  assert.equal(metadata.owner, "Prometheus Infrastructure");
  assert.equal(metadata.status, "IMPLEMENTED_SOURCE_NOT_EXECUTED");
  assert.deepEqual(metadata.baseline, {
    commit: baselineCommit,
    tree: baselineTree,
    branch: "main",
    cleanAtStart: true,
    v1SourceModified: false,
    v1ControlsReceiptsOrEvidenceAccessed: false,
    realKeychainValuesRead: false,
    cloudflareApiContacted: false,
    credentialActionPerformed: false,
    productionMutationPerformed: false,
    deploymentPerformed: false,
    temporaryApiTokenPreserved: true,
    pushPerformed: false
  });
  assert.equal(metadata.officialContracts.create.httpStatus, 200);
  assert.equal(metadata.officialContracts.create.nameEchoOptionalInSchema, true);
  assert.equal(metadata.officialContracts.create.durationEchoOptionalInSchema, true);
  assert.equal(metadata.officialContracts.create.exactRequestDuration, "720h");
  assert.equal(metadata.credentialContract.missingAndMalformedReasonsDistinct, true);
  assert.equal(metadata.credentialContract.credentialValuesPersistedToEvidence, false);
  assert.equal(metadata.postCreateProof.returnedIdAloneAuthorizesDelete, false);
  assert.equal(metadata.postCreateProof.uniqueExactNameRequired, true);
  assert.equal(metadata.postCreateProof.returnedIdMatchRequired, true);
  assert.equal(metadata.postCreateProof.ambiguousOrDuplicateProofDeleteAttempts, 0);
  assert.equal(metadata.futureLifecycle.createAttemptsMaximum, 1);
  assert.equal(metadata.futureLifecycle.createRetryAllowed, false);
  assert.equal(metadata.futureLifecycle.compensationAuthorizationSeparate, true);
  assert.equal(metadata.futureLifecycle.compensationDeleteAttemptsMaximum, 1);
  assert.equal(metadata.futureLifecycle.realControlCreatedByThisBatch, false);
  assert.equal(metadata.futureLifecycle.provisioningExecutedByThisBatch, false);
  assert.equal(metadata.commands.nextSafeGetOnly,
    CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_NEXT_SAFE_COMMAND);
  assert.equal(metadata.ownership.packageReleaseWiringOwner, "Prometheus Overwatch");
  assert.equal(metadata.ownership.packageJsonModified, false);
  assert.equal(metadata.ownership.overwatchFilesModified, false);
  assert.equal(metadata.runtimeBoundaries.pushAuthorized, false);
  assert.deepEqual(CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_FINAL_OUTCOMES, [
    "SUCCESS", "COMPENSATED", "MANUAL_REVIEW"
  ]);
  assert.equal(Object.keys(CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_CONFIRMATIONS).length, 4);
  assert.equal(new Set(CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_REASON_CODES).size,
    CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_REASON_CODES.length);
}

function verifySecretSafety() {
  assert.deepEqual(sourcePaths.flatMap(path => scanTextForCloudflareSecrets(read(path), path)), []);
}

export function verifyCloudflareFounderAttendedCreateReceiptV2() {
  verifyBaseline();
  verifyV1Immutability();
  verifySourceOwnership();
  verifyWorkflowBoundary();
  verifyOutputBoundary();
  verifyMetadata();
  verifySecretSafety();
  return Object.freeze({
    status: "passed",
    batchId: CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_BATCH_ID,
    focusedTopLevelTests: 19,
    v1SourceModified: false,
    v1ControlsReceiptsOrEvidenceAccessed: false,
    cloudflareApiContacted: false,
    realKeychainValuesRead: false,
    realControlCreated: false,
    credentialActionPerformed: false,
    deploymentPerformed: false,
    productionMutationPerformed: false,
    pushed: false
  });
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    console.log(JSON.stringify(verifyCloudflareFounderAttendedCreateReceiptV2(), null, 2));
  } catch {
    console.error("Cloudflare Founder-attended create-receipt v2 Infrastructure check failed.");
    process.exitCode = 1;
  }
}
