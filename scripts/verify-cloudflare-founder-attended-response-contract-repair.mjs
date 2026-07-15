import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { scanTextForCloudflareSecrets } from "./check-cloudflare-unattended-secret-presence.mjs";
import {
  CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_BATCH_ID,
  CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_CONFIRMATIONS,
  CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_FINAL_OUTCOMES,
  CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_PHASES
} from "./lib/cloudflare-founder-attended-response-contract-constants.mjs";

const root = resolve(import.meta.dirname, "..");
const baselineCommit = "d32ffd8f6ea255fa029976b1bf0006663d567153";
const metadataPath = "workers/infrastructure/cloudflare-founder-attended-response-contract-repair-v1.json";
const documentationPath = "docs/cloudflare-founder-attended-response-contract-repair-v1.md";
const testPath = "tests/cloudflare-founder-attended-response-contract-repair.test.mjs";

const predecessorPaths = Object.freeze([
  "package.json",
  "docs/cloudflare-founder-attended-service-token-provisioning-v1.md",
  "docs/cloudflare-founder-attended-get-only-recovery-v1.md",
  "scripts/helpers/cloudflare-founder-attended-keychain.swift",
  "scripts/lib/cloudflare-founder-attended-constants.mjs",
  "scripts/lib/cloudflare-founder-attended-control.mjs",
  "scripts/lib/cloudflare-founder-attended-keychain.mjs",
  "scripts/lib/cloudflare-founder-attended-service-token-production.mjs",
  "scripts/lib/cloudflare-founder-attended-service-token.mjs",
  "scripts/lib/cloudflare-founder-attended-tty.mjs",
  "scripts/lib/cloudflare-founder-attended-get-only-diagnostic-command.mjs",
  "scripts/lib/cloudflare-founder-attended-get-only-diagnostic-production.mjs",
  "scripts/lib/cloudflare-founder-attended-get-only-diagnostic.mjs",
  "scripts/lib/cloudflare-founder-attended-get-only-recovery-constants.mjs",
  "scripts/lib/cloudflare-founder-attended-recovery-control-command.mjs",
  "scripts/lib/cloudflare-founder-attended-recovery-control-production.mjs",
  "scripts/lib/cloudflare-founder-attended-recovery-control.mjs",
  "scripts/lib/cloudflare-founder-attended-recovery-provisioning-production.mjs",
  "scripts/lib/cloudflare-founder-attended-recovery-provisioning.mjs",
  "scripts/run-cloudflare-founder-attended-get-only-diagnostic.mjs",
  "scripts/run-cloudflare-founder-attended-prepare-recovery.mjs",
  "scripts/run-cloudflare-founder-attended-service-token.mjs",
  "scripts/run-cloudflare-founder-attended-successor-recovery.mjs",
  "scripts/verify-cloudflare-founder-attended-get-only-recovery.mjs",
  "scripts/verify-cloudflare-founder-attended-service-token.mjs",
  "tests/cloudflare-founder-attended-get-only-recovery.test.mjs",
  "tests/cloudflare-founder-attended-service-token.test.mjs",
  "workers/infrastructure/cloudflare-founder-attended-get-only-recovery-v1.json",
  "workers/infrastructure/cloudflare-founder-attended-service-token-v1.json"
]);

const sourcePaths = Object.freeze([
  documentationPath,
  "scripts/lib/cloudflare-founder-attended-response-contract-artifacts.mjs",
  "scripts/lib/cloudflare-founder-attended-response-contract-constants.mjs",
  "scripts/lib/cloudflare-founder-attended-response-contract-production.mjs",
  "scripts/lib/cloudflare-founder-attended-response-contract-workflow.mjs",
  "scripts/run-cloudflare-founder-attended-response-contract-diagnostic.mjs",
  "scripts/run-cloudflare-founder-attended-response-contract-prepare.mjs",
  "scripts/run-cloudflare-founder-attended-response-contract-provision.mjs",
  "scripts/verify-cloudflare-founder-attended-response-contract-repair.mjs",
  testPath,
  metadataPath
]);

const read = path => readFileSync(resolve(root, path), "utf8");
const readJson = path => JSON.parse(read(path));

function verifyPredecessorImmutability() {
  execFileSync("/usr/bin/git", ["diff", "--quiet", baselineCommit, "--", ...predecessorPaths], {
    cwd: root,
    stdio: "ignore"
  });
}

function verifySourceBoundary() {
  for (const path of sourcePaths) {
    assert.equal(path.startsWith("overwatch/"), false);
    assert.ok(read(path).length > 0, path);
  }
  const workflow = read("scripts/lib/cloudflare-founder-attended-response-contract-workflow.mjs");
  const artifacts = read("scripts/lib/cloudflare-founder-attended-response-contract-artifacts.mjs");
  const production = read("scripts/lib/cloudflare-founder-attended-response-contract-production.mjs");
  const entrypoints = [
    "scripts/run-cloudflare-founder-attended-response-contract-diagnostic.mjs",
    "scripts/run-cloudflare-founder-attended-response-contract-prepare.mjs",
    "scripts/run-cloudflare-founder-attended-response-contract-provision.mjs"
  ].map(read).join("\n");

  assert.equal((workflow.match(/method:\s*"POST"/gu) || []).length, 1);
  assert.equal((workflow.match(/method:\s*"DELETE"/gu) || []).length, 1);
  assert.doesNotMatch(workflow, /setTimeout|maxRetries|retryAfter|automaticRetry/iu);
  assert.match(workflow, /response\.status !== 200/u);
  assert.match(workflow, /"expires_at"/u);
  assert.match(workflow, /documentedTimestampsValid\(result\)/u);
  assert.match(workflow, /CLIENT_ID_PATTERN\.test/u);
  assert.match(workflow, /CLIENT_SECRET_PATTERN\.test/u);
  assert.match(workflow, /await exactNameState/u);
  assert.match(workflow, /phase\("DELETE_CONFIRMED"\)/u);
  assert.match(workflow, /phase\("DELETE_NOT_CONFIRMED"\)/u);
  assert.doesNotMatch(workflow, /deleteItem\("temporaryApiToken"\)/u);
  assert.doesNotMatch(workflow, /console\.(?:log|error)/u);
  assert.doesNotMatch(workflow, /clientSecret[^\n]*(?:length|byteLength|createHash)/u);
  assert.doesNotMatch(workflow, /clientId[^\n]*(?:length|byteLength|createHash)/u);

  assert.match(artifacts, /cloudflare-founder-attended-response-contract-repair-v1/u);
  assert.doesNotMatch(artifacts, /cloudflare-founder-attended-get-only-recovery-v1/u);
  assert.doesNotMatch(artifacts, /cloudflare-founder-attended-service-token-v1/u);
  assert.doesNotMatch(artifacts, /unlinkSync|rmSync|renameSync|truncateSync/u);
  assert.match(artifacts, /O_EXCL/u);
  assert.match(artifacts, /fsyncSync/u);
  assert.match(artifacts, /writeExclusive\([^\n]*`\$\{phase\}\\n`/u);

  assert.match(production, /createControllingTtyConfirmation\(\)/u);
  assert.match(production, /console\.log\(result\.outcome\)/u);
  assert.match(production, /console\.error\("MANUAL_REVIEW"\)/u);
  assert.doesNotMatch(production, /console\.(?:log|error)\([^\n]*(?:error|credential|clientId|clientSecret)/u);
  assert.doesNotMatch(entrypoints, /keychain|transport|requestImpl|process\.env/u);

  const tests = read(testPath);
  assert.doesNotMatch(tests, /ResponseContract(?:Diagnostic|Preparation|Provisioning)Cli/u);
  assert.doesNotMatch(tests, /node:https|httpsRequest/u);
}

function verifySecretSafety() {
  assert.deepEqual(sourcePaths.flatMap(path => scanTextForCloudflareSecrets(read(path), path)), []);
}

export function verifyCloudflareFounderAttendedResponseContractRepair() {
  const metadata = readJson(metadataPath);
  assert.equal(metadata.contractVersion, "cloudflare-founder-attended-response-contract-repair-v1");
  assert.equal(metadata.batchId, CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_BATCH_ID);
  assert.equal(metadata.owner, "Prometheus Infrastructure");
  assert.equal(metadata.status, "IMPLEMENTED_SOURCE_NOT_EXECUTED");
  assert.equal(metadata.baseline.commit, baselineCommit);
  assert.equal(metadata.baseline.predecessorControlsOrReceiptsAccessed, false);
  assert.equal(metadata.baseline.realKeychainValuesRead, false);
  assert.equal(metadata.baseline.cloudflareApiContacted, false);
  assert.equal(metadata.baseline.credentialActionPerformed, false);
  assert.equal(metadata.baseline.temporaryApiTokenPreserved, true);
  assert.equal(metadata.officialContracts.create.httpStatus, 200);
  assert.equal(metadata.officialContracts.create.expiresAtRequired, false);
  assert.equal(metadata.officialContracts.create.optionalEnvelopeFieldsAccepted, true);
  assert.equal(metadata.officialContracts.create.exactDurationRequired, "720h");
  assert.equal(metadata.officialContracts.delete.documentedResultObjectAccepted, true);
  assert.equal(metadata.officialContracts.delete.followUpExactNameGetRequired, true);
  assert.equal(metadata.officialContracts.delete.responseAloneConfirmsCleanup, false);
  assert.equal(metadata.officialContracts.list.resultOptional, true);
  assert.equal(metadata.officialContracts.list.resultInfoOptional, true);
  assert.equal(metadata.freshSuccessor.predecessorPathReused, false);
  assert.equal(metadata.freshSuccessor.predecessorReceiptReused, false);
  assert.equal(metadata.freshSuccessor.freshAttendedGetRequired, true);
  assert.equal(metadata.freshSuccessor.separateFounderControlAuthorizationRequired, true);
  assert.equal(metadata.freshSuccessor.realControlCreatedByThisBatch, false);
  assert.equal(metadata.freshSuccessor.replayAllowed, false);
  assert.equal(metadata.futureLifecycle.createAttemptsMaximum, 1);
  assert.equal(metadata.futureLifecycle.createRetryAllowed, false);
  assert.equal(metadata.futureLifecycle.uncertainControlRetryAllowed, false);
  assert.equal(metadata.futureLifecycle.deleteRequiresFollowUpGet, true);
  assert.deepEqual(metadata.phaseEvidence.phases, CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_PHASES);
  assert.deepEqual(metadata.outputBoundary.finalOutcomes, CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_FINAL_OUTCOMES);
  assert.equal(Object.keys(CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_CONFIRMATIONS).length, 3);
  assert.equal(metadata.testBoundary.mockNetworkOnly, true);
  assert.equal(metadata.testBoundary.mockKeychainOnly, true);
  assert.equal(metadata.runtimeBoundaries.pushAuthorized, false);
  assert.equal(metadata.runtimeBoundaries.deploymentAllowed, false);

  verifyPredecessorImmutability();
  verifySourceBoundary();
  verifySecretSafety();
  return Object.freeze({
    status: "passed",
    batchId: CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_BATCH_ID,
    focusedTests: 17,
    predecessorControlsOrReceiptsAccessed: false,
    cloudflareApiContacted: false,
    realKeychainValuesRead: false,
    realSuccessorControlCreated: false,
    credentialActionPerformed: false,
    productionMutationPerformed: false,
    deploymentPerformed: false,
    pushed: false
  });
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    console.log(JSON.stringify(verifyCloudflareFounderAttendedResponseContractRepair(), null, 2));
  } catch {
    console.error("Cloudflare Founder-attended response-contract Infrastructure check failed.");
    process.exitCode = 1;
  }
}
