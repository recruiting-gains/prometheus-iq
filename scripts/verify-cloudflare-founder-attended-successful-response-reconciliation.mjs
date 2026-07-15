import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { scanTextForCloudflareSecrets } from "./check-cloudflare-unattended-secret-presence.mjs";

const root = resolve(import.meta.dirname, "..");
const baselineCommit = "327baa7085a5013f765c4a46eda07af5ad5470bb";
const baselineTree = "361e4d88b7a9f4afb1d30b95831416dfe1836342";
const documentationPath =
  "docs/cloudflare-founder-attended-successful-response-reconciliation-v1.md";
const metadataPath =
  "workers/infrastructure/cloudflare-founder-attended-successful-response-reconciliation-v1.json";
const sourcePaths = Object.freeze([
  documentationPath,
  "scripts/lib/cloudflare-founder-attended-create-receipt-v2-constants.mjs",
  "scripts/lib/cloudflare-founder-attended-create-receipt-v2-workflow.mjs",
  "scripts/verify-cloudflare-founder-attended-create-receipt-v2.mjs",
  "scripts/verify-cloudflare-founder-attended-successful-response-reconciliation.mjs",
  "tests/cloudflare-founder-attended-create-receipt-v2.test.mjs",
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

function verifySourceOwnership() {
  for (const path of sourcePaths) {
    assert.equal(path.startsWith("overwatch/"), false);
    assert.equal(path === "package.json", false);
    assert.ok(read(path).length > 0, path);
  }
}

function verifyWorkflowRepair() {
  const constants = read("scripts/lib/cloudflare-founder-attended-create-receipt-v2-constants.mjs");
  const workflow = read("scripts/lib/cloudflare-founder-attended-create-receipt-v2-workflow.mjs");
  const tests = read("tests/cloudflare-founder-attended-create-receipt-v2.test.mjs");

  for (const reasonCode of [
    "CREATE_HTTP_STATUS_DOCUMENTED_200",
    "CREATE_HTTP_STATUS_ALTERNATE_2XX",
    "CREATE_HTTP_STATUS_NON_2XX"
  ]) {
    assert.match(constants, new RegExp(reasonCode, "u"));
  }
  assert.match(workflow, /function classifyCreateHttpStatus/u);
  assert.match(workflow, /status === 200/u);
  assert.match(workflow, /status >= 200 && status < 300/u);
  assert.match(workflow, /reason\(evaluation\.httpStatusReasonCode\)/u);
  assert.match(workflow, /if \(!status\.successCompatible\)/u);
  assert.match(workflow, /if \(!evaluation\.accepted\) reason\(evaluation\.reasonCode\)/u);
  assert.match(workflow, /if \(!proof\.proven\)/u);
  assert.match(workflow, /storePair/u);
  assert.match(workflow, /compensateCreatedResource/u);
  assert.doesNotMatch(workflow, /setTimeout|maxRetries|retryAfter|automaticRetry/iu);
  assert.doesNotMatch(workflow, /console\.(?:log|error)/u);

  assert.match(tests, /httpStatusClass: "DOCUMENTED_200"/u);
  assert.match(tests, /httpStatusClass: "ALTERNATE_2XX"/u);
  assert.match(tests, /"NON_2XX"/u);
  assert.match(tests, /alternate 2xx responses can succeed only after exact-name proof/u);
  assert.match(tests, /alternate 2xx missing credentials still fail closed/u);
}

function verifyDocumentationAndMetadata() {
  const documentation = read(documentationPath);
  const metadata = readJson(metadataPath);

  assert.match(documentation, /bounded HTTP `2xx` response is eligible/u);
  assert.match(documentation, /status alone/u);
  assert.match(documentation, /next laptop action remains the Founder-attended GET-only/u);
  assert.match(
    documentation,
    /node scripts\/run-cloudflare-founder-attended-create-receipt-v2-get-only\.mjs/u
  );

  assert.equal(metadata.contractVersion,
    "cloudflare-founder-attended-successful-response-reconciliation-v1");
  assert.equal(metadata.batchId, "BATCH-20260715-005");
  assert.equal(metadata.baseline.commit, baselineCommit);
  assert.equal(metadata.baseline.tree, baselineTree);
  assert.equal(metadata.statusReconciliation.statusAloneCanReachSuccess, false);
  assert.equal(metadata.statusReconciliation.non2xxCanReachSuccess, false);
  assert.equal(metadata.statusReconciliation.transportUncertaintyCanReachSuccess, false);
  assert.equal(metadata.runtimeBoundaries.realExecutionAuthorized, false);
}

function verifySecretSafety() {
  assert.deepEqual(sourcePaths.flatMap(path => scanTextForCloudflareSecrets(read(path), path)), []);
}

export function verifyCloudflareFounderAttendedSuccessfulResponseReconciliation() {
  verifyBaseline();
  verifySourceOwnership();
  verifyWorkflowRepair();
  verifyDocumentationAndMetadata();
  verifySecretSafety();
  return Object.freeze({
    status: "passed",
    batchId: "BATCH-20260715-005",
    changedInfrastructurePaths: sourcePaths.length,
    cloudflareApiContacted: false,
    realKeychainValuesRead: false,
    credentialActionPerformed: false,
    deploymentPerformed: false,
    productionMutationPerformed: false,
    pushed: false
  });
}

const executedDirectly = process.argv[1]
  && resolve(process.argv[1]) === resolve(import.meta.filename);

if (executedDirectly) {
  try {
    verifyCloudflareFounderAttendedSuccessfulResponseReconciliation();
    console.log("cloudflare-founder-attended-successful-response-reconciliation: ok");
  } catch (error) {
    console.error("cloudflare-founder-attended-successful-response-reconciliation: failed");
    throw error;
  }
}
