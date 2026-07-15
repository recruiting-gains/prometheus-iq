import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { scanTextForCloudflareSecrets } from "./check-cloudflare-unattended-secret-presence.mjs";

const root = resolve(import.meta.dirname, "..");
const baselineCommit = "4fbd3030c980a7e17230654dfe2ece0766793436";
const baselineTree = "bd8f1fde909d305f45f8b6f22f98a086fc678771";
const documentationPath = "docs/cloudflare-founder-attended-fresh-attempt-evidence-rotation-v1.md";
const metadataPath =
  "workers/infrastructure/cloudflare-founder-attended-fresh-attempt-evidence-rotation-v1.json";
const sourcePaths = Object.freeze([
  documentationPath,
  "scripts/lib/cloudflare-founder-attended-response-contract-artifacts.mjs",
  "scripts/lib/cloudflare-founder-attended-response-contract-production.mjs",
  "scripts/lib/cloudflare-founder-attended-response-contract-workflow.mjs",
  "scripts/lib/cloudflare-founder-attended-create-receipt-v2-artifacts.mjs",
  "scripts/lib/cloudflare-founder-attended-create-receipt-v2-workflow.mjs",
  "scripts/run-cloudflare-founder-attended-create-receipt-v2-get-only.mjs",
  "scripts/verify-cloudflare-founder-attended-response-contract-repair.mjs",
  "scripts/verify-cloudflare-founder-attended-create-receipt-v2.mjs",
  "scripts/verify-cloudflare-founder-attended-fresh-attempt-evidence-rotation.mjs",
  "tests/cloudflare-founder-attended-owner-verifier-ownership.test.mjs",
  "tests/cloudflare-founder-attended-response-contract-repair.test.mjs",
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

function verifyAttemptNamespaceDesign() {
  const responseArtifacts = read("scripts/lib/cloudflare-founder-attended-response-contract-artifacts.mjs");
  const responseWorkflow = read("scripts/lib/cloudflare-founder-attended-response-contract-workflow.mjs");
  const createArtifacts = read("scripts/lib/cloudflare-founder-attended-create-receipt-v2-artifacts.mjs");
  const createWorkflow = read("scripts/lib/cloudflare-founder-attended-create-receipt-v2-workflow.mjs");
  const getOnly = read("scripts/run-cloudflare-founder-attended-create-receipt-v2-get-only.mjs");
  const responseTests = read("tests/cloudflare-founder-attended-response-contract-repair.test.mjs");
  const createTests = read("tests/cloudflare-founder-attended-create-receipt-v2.test.mjs");

  assert.match(responseArtifacts, /attempts:\s*join\(base,\s*"attempts"\)/u);
  assert.match(responseArtifacts, /attempt-lineage\.json/u);
  assert.match(responseArtifacts, /diagnostic-receipt\.json/u);
  assert.match(responseArtifacts, /diagnostic-consumption\.json/u);
  assert.match(responseArtifacts, /successor-control\.json/u);
  assert.match(responseArtifacts, /successor-control-consumption\.json/u);
  assert.match(responseArtifacts, /phase-evidence/u);
  assert.match(responseArtifacts, /createExclusiveDirectory\(paths\.attemptRoot/u);
  assert.match(responseArtifacts, /readFounderAttendedResponseContractAttemptStateTestOnly/u);
  assert.match(responseArtifacts, /LOCAL_ARTIFACT_COLLISION/u);
  assert.doesNotMatch(responseArtifacts, /unlinkSync|rmSync|renameSync|truncateSync/u);

  assert.match(responseWorkflow, /createFounderAttendedResponseContractAbsenceEvidence\(\{/u);
  assert.match(responseWorkflow, /outcome,\n/u);
  assert.match(responseWorkflow, /outcome:\s*"LOCAL_ARTIFACT_COLLISION"/u);
  assert.match(responseWorkflow, /phaseWriter\(consumed\.attemptRoot,\s*consumed\.control/u);

  assert.match(createArtifacts, /create-receipt-classifications/u);
  assert.match(createArtifacts, /attempt-lineage\.json/u);
  assert.match(createArtifacts, /basename\(attemptRoot\) !== attemptId/u);
  assert.match(createArtifacts, /attemptId/u);
  assert.doesNotMatch(createArtifacts, /unlinkSync|rmSync|renameSync|truncateSync/u);

  assert.match(createWorkflow, /phaseWriter\(consumed\.attemptRoot,\s*consumed\.control/u);
  assert.match(createWorkflow, /reasonWriter\(consumed\.attemptRoot,\s*consumed\.attemptId/u);

  assert.match(getOnly, /LOCAL_ARTIFACT_COLLISION/u);
  assert.match(getOnly, /console\.log\(result\.outcome\)/u);

  for (const snippet of [
    "repeated fresh diagnostics create isolated attempts",
    "simultaneous fresh absence attempts fail safely without mixing",
    "attempt-id collision returns a fixed local artifact collision outcome",
    "legacy flat-root evidence remains untouched",
    "cross-attempt substitution"
  ]) {
    assert.match(responseTests, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  }
  assert.match(createTests, /fixture\.attemptRoot/u);
  assert.match(createTests, /fixture\.attemptId/u);
}

function verifyDocumentationAndMetadata() {
  const documentation = read(documentationPath);
  const metadata = readJson(metadataPath);

  assert.match(documentation, /immutable per-attempt namespaces/u);
  assert.match(documentation, /attempts\/<attemptId>/u);
  assert.match(documentation, /LOCAL_ARTIFACT_COLLISION/u);
  assert.match(documentation, /node scripts\/run-cloudflare-founder-attended-create-receipt-v2-get-only\.mjs/u);
  assert.doesNotMatch(documentation, /node scripts\/run-cloudflare-founder-attended-create-receipt-v2-provision\.mjs/u);

  assert.equal(metadata.contractVersion, "cloudflare-founder-attended-fresh-attempt-evidence-rotation-v1");
  assert.equal(metadata.batchId, "BATCH-20260715-006");
  assert.equal(metadata.owner, "Prometheus Infrastructure");
  assert.equal(metadata.status, "IMPLEMENTED_SOURCE_NOT_EXECUTED");
  assert.deepEqual(metadata.baseline, {
    commit: baselineCommit,
    tree: baselineTree,
    branch: "main",
    cleanAtStart: true,
    cloudflareApiContacted: false,
    realKeychainValuesRead: false,
    credentialActionPerformed: false,
    productionMutationPerformed: false,
    deploymentPerformed: false,
    pushPerformed: false,
    temporaryApiTokenPreserved: true
  });
  assert.equal(metadata.failurePreservation.getOnlyReturnedManualReview, true);
  assert.equal(metadata.failurePreservation.exactNameAbsentConfirmed, true);
  assert.equal(metadata.failurePreservation.createDeleteOrDeployPossible, false);
  assert.equal(metadata.namespaceRotation.opaqueAttemptIdRuntimeGenerated, true);
  assert.equal(metadata.namespaceRotation.callerChosenAttemptIdAllowed, false);
  assert.equal(metadata.namespaceRotation.exclusiveAttemptDirectoryCreate, true);
  assert.equal(metadata.namespaceRotation.priorArtifactsReusedOrOverwritten, false);
  assert.equal(metadata.namespaceRotation.localArtifactCollisionReasonCode, "LOCAL_ARTIFACT_COLLISION");
  assert.equal(metadata.lineageBinding.crossAttemptSubstitutionFailsClosed, true);
  assert.equal(metadata.lineageBinding.sameAttemptRequiredForDiagnosticControlAndPhases, true);
  assert.equal(metadata.futureCommand.nextSafeGetOnly,
    "node scripts/run-cloudflare-founder-attended-create-receipt-v2-get-only.mjs");
  assert.equal(metadata.runtimeBoundaries.realExecutionAuthorized, false);
}

function verifySecretSafety() {
  assert.deepEqual(sourcePaths.flatMap(path => scanTextForCloudflareSecrets(read(path), path)), []);
}

export function verifyCloudflareFounderAttendedFreshAttemptEvidenceRotation() {
  verifyBaseline();
  verifySourceOwnership();
  verifyAttemptNamespaceDesign();
  verifyDocumentationAndMetadata();
  verifySecretSafety();
  return Object.freeze({
    status: "passed",
    batchId: "BATCH-20260715-006",
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
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (executedDirectly) {
  try {
    console.log(JSON.stringify(verifyCloudflareFounderAttendedFreshAttemptEvidenceRotation(), null, 2));
  } catch (error) {
    console.error("Cloudflare Founder-attended fresh-attempt rotation Infrastructure check failed.");
    process.exitCode = 1;
  }
}
