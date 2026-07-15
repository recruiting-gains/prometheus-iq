import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { scanTextForCloudflareSecrets } from "./check-cloudflare-unattended-secret-presence.mjs";
import {
  CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_BATCH_ID,
  CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_CLASSIFICATIONS,
  CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_CONFIRMATIONS,
  CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_CONTROL_MAX_LIFETIME_MS,
  CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_LIST_MAX_PAGES,
  CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_LIST_PER_PAGE,
  CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_SERVICE_TOKEN_NAME
} from "./lib/cloudflare-founder-attended-get-only-recovery-constants.mjs";
import {
  CLOUDFLARE_FOUNDER_ATTENDED_DIAGNOSTIC_SCHEMA,
  CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_CONTROL_SCHEMA
} from "./lib/cloudflare-founder-attended-recovery-control.mjs";

const root = resolve(import.meta.dirname, "..");
const baselineCommit = "89267707a3a62b2e3d61897476e4dda7adf95987";
const contractPath = "workers/infrastructure/cloudflare-founder-attended-get-only-recovery-v1.json";
const documentationPath = "docs/cloudflare-founder-attended-get-only-recovery-v1.md";
const testPath = "tests/cloudflare-founder-attended-service-token.test.mjs";
const focusedTestPath = "tests/cloudflare-founder-attended-get-only-recovery.test.mjs";

export const CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_INFRASTRUCTURE_PREDECESSOR_PATHS = Object.freeze([
  "docs/cloudflare-founder-attended-service-token-provisioning-v1.md",
  "scripts/helpers/cloudflare-founder-attended-keychain.swift",
  "scripts/lib/cloudflare-founder-attended-constants.mjs",
  "scripts/lib/cloudflare-founder-attended-control.mjs",
  "scripts/lib/cloudflare-founder-attended-keychain.mjs",
  "scripts/lib/cloudflare-founder-attended-service-token-production.mjs",
  "scripts/lib/cloudflare-founder-attended-service-token.mjs",
  "scripts/lib/cloudflare-founder-attended-tty.mjs",
  "scripts/run-cloudflare-founder-attended-service-token.mjs",
  "scripts/verify-cloudflare-founder-attended-service-token.mjs",
  "workers/infrastructure/cloudflare-founder-attended-service-token-v1.json"
]);
export const CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_OVERWATCH_RELEASE_WIRING_PATHS =
  Object.freeze(["package.json"]);

const sourcePaths = Object.freeze([
  documentationPath,
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
  "scripts/run-cloudflare-founder-attended-successor-recovery.mjs",
  "scripts/verify-cloudflare-founder-attended-get-only-recovery.mjs",
  testPath,
  focusedTestPath,
  contractPath
]);

const read = path => readFileSync(resolve(root, path), "utf8");
const readJson = path => JSON.parse(read(path));

export function verifyCloudflareFounderAttendedRecoveryPredecessorImmutabilityTestOnly({
  repositoryRoot = root,
  expectedBaselineCommit = baselineCommit
} = {}) {
  assert.match(expectedBaselineCommit, /^[0-9a-f]{40}$/u);
  assert.deepEqual(
    CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_OVERWATCH_RELEASE_WIRING_PATHS,
    ["package.json"]
  );
  assert.equal(
    CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_INFRASTRUCTURE_PREDECESSOR_PATHS.includes("package.json"),
    false
  );
  execFileSync("/usr/bin/git", [
    "diff",
    "--quiet",
    expectedBaselineCommit,
    "--",
    ...CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_INFRASTRUCTURE_PREDECESSOR_PATHS
  ], {
    cwd: resolve(repositoryRoot),
    stdio: "ignore"
  });
}

function verifySourceBoundaries(contract) {
  assert.deepEqual(contract.sourceFiles, sourcePaths);
  assert.equal(sourcePaths.some(path => path.startsWith("overwatch/")), false);
  for (const path of sourcePaths) assert.ok(read(path).length > 0, path);

  const getOnlySource = [
    "scripts/lib/cloudflare-founder-attended-get-only-diagnostic-command.mjs",
    "scripts/lib/cloudflare-founder-attended-get-only-diagnostic-production.mjs",
    "scripts/lib/cloudflare-founder-attended-get-only-diagnostic.mjs",
    "scripts/run-cloudflare-founder-attended-get-only-diagnostic.mjs"
  ].map(read).join("\n");
  assert.doesNotMatch(getOnlySource, /method:\s*"(?:POST|PUT|PATCH|DELETE)"/u);
  assert.doesNotMatch(getOnlySource, /recovery-provisioning/u);
  assert.doesNotMatch(
    getOnlySource,
    /console\.(?:log|error)\([^\n]*(?:error\?\.(?:message|stack)|error\.(?:message|stack))/u
  );
  assert.match(getOnlySource, /specification\.method !== GET_ONLY_METHOD/u);
  assert.match(getOnlySource, /queryKeys\.join\("\\0"\) !== "name\\0page\\0per_page"/u);
  assert.match(getOnlySource, /createFounderAttendedReadOnlyKeychainFacade/u);
  assert.match(getOnlySource, /validateKnownPagination/u);
  assert.match(getOnlySource, /declaredTotalCount/u);
  assert.doesNotMatch(getOnlySource, /totalPagesForCount/u);
  assert.doesNotMatch(getOnlySource, /parsed\.count > 0 && parsed\.count ===/u);

  for (const productionWrapper of [
    "scripts/lib/cloudflare-founder-attended-get-only-diagnostic-production.mjs",
    "scripts/lib/cloudflare-founder-attended-recovery-control-production.mjs",
    "scripts/lib/cloudflare-founder-attended-recovery-provisioning-production.mjs"
  ]) {
    assert.match(read(productionWrapper), /createControllingTtyConfirmation\(\)/u);
  }

  const preparationSource = [
    "scripts/lib/cloudflare-founder-attended-recovery-control-command.mjs",
    "scripts/lib/cloudflare-founder-attended-recovery-control-production.mjs",
    "scripts/run-cloudflare-founder-attended-prepare-recovery.mjs"
  ].map(read).join("\n");
  assert.doesNotMatch(preparationSource, /createFounderAttendedCloudflareTransport|node:https/u);
  assert.doesNotMatch(preparationSource, /method:\s*"(?:POST|PUT|PATCH|DELETE)"/u);

  const artifactSource = read("scripts/lib/cloudflare-founder-attended-recovery-control.mjs");
  assert.doesNotMatch(artifactSource, /unlinkSync|rmSync|renameSync|truncateSync/u);
  assert.doesNotMatch(artifactSource, /cloudflare-founder-attended-service-token-v1\/control\.json/u);
  assert.match(artifactSource, /O_EXCL/u);
  assert.match(artifactSource, /fsyncSync/u);
  assert.match(artifactSource, /validateRecoveryControlLineage/u);

  const recoverySource = read("scripts/lib/cloudflare-founder-attended-recovery-provisioning.mjs");
  assert.equal((recoverySource.match(/method:\s*"POST"/gu) || []).length, 1);
  assert.equal((recoverySource.match(/method:\s*"DELETE"/gu) || []).length, 1);
  assert.doesNotMatch(recoverySource, /setTimeout|maxRetries|retryAfter/u);
  assert.match(recoverySource, /consumeFounderAttendedSuccessorRecoveryControl/u);
  assert.doesNotMatch(recoverySource, /\bconsumeFounderAttendedControl\b/u);
  assert.match(recoverySource, /temporaryTokenPreserved: true/u);
  assert.doesNotMatch(recoverySource, /deleteItem\("temporaryApiToken"\)/u);

  for (const entrypoint of [
    "scripts/run-cloudflare-founder-attended-get-only-diagnostic.mjs",
    "scripts/run-cloudflare-founder-attended-prepare-recovery.mjs",
    "scripts/run-cloudflare-founder-attended-successor-recovery.mjs"
  ]) {
    const source = read(entrypoint);
    assert.equal((source.match(/^import[\s\S]*?;$/gmu) || []).length, 1);
    assert.doesNotMatch(source, /keychain|transport|requestImpl|process\.env/u);
  }

  const tests = read(testPath);
  assert.doesNotMatch(
    tests,
    /runFounderAttendedGetOnlyDiagnosticProductionCli|runFounderAttendedRecoveryControlProductionCli|runFounderAttendedSuccessorRecoveryProductionCli/u
  );
  assert.doesNotMatch(tests, /httpsRequest\(/u);
}

function verifyNoNewSecretMaterial() {
  const findings = sourcePaths.flatMap(path => scanTextForCloudflareSecrets(read(path), path));
  assert.deepEqual(findings, []);
}

export function verifyCloudflareFounderAttendedGetOnlyRecovery() {
  const contract = readJson(contractPath);
  assert.equal(contract.contractVersion, "cloudflare-founder-attended-get-only-recovery-v1");
  assert.equal(contract.batchId, CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_BATCH_ID);
  assert.equal(contract.owner, "Prometheus Infrastructure");
  assert.equal(contract.status, "IMPLEMENTED_SOURCE_NOT_EXECUTED");
  assert.equal(contract.baseline.commit, baselineCommit);
  assert.equal(contract.baseline.predecessorSourceModified, false);
  assert.equal(contract.baseline.predecessorControlReadModifiedDeletedReplacedOrReused, false);
  assert.equal(contract.baseline.predecessorReceiptReadModifiedDeletedReplacedOrReused, false);
  assert.equal(contract.baseline.realKeychainValuesRead, false);
  assert.equal(contract.baseline.cloudflareApiContacted, false);
  assert.equal(contract.baseline.productionMutationPerformed, false);
  assert.equal(contract.baseline.temporaryTokenCleanupPerformed, false);
  assert.equal(contract.baseline.pushPerformed, false);

  assert.equal(contract.officialContractSource.resultOptional, true);
  assert.equal(contract.officialContractSource.resultInfoOptional, true);
  assert.equal(contract.officialContractSource.resultInfoMembersOptional, true);
  assert.equal(
    contract.officialContractSource.totalCountDescribesResultsWithoutSearchParameters,
    true
  );
  assert.equal(contract.officialContractSource.contractAsSpecifiedByBatchDate, "2026-07-15");
  assert.deepEqual(contract.diagnostic.methodAllowlist, ["GET"]);
  assert.equal(contract.diagnostic.fixedName, CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_SERVICE_TOKEN_NAME);
  assert.deepEqual(contract.diagnostic.fixedQueryKeys, ["name", "page", "per_page"]);
  assert.equal(contract.diagnostic.maximumPages, CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_LIST_MAX_PAGES);
  assert.equal(contract.diagnostic.perPage, CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_LIST_PER_PAGE);
  assert.equal(contract.diagnostic.totalCountUsedAsFilteredResultCount, false);
  assert.equal(
    contract.diagnostic.nonzeroTotalCountWithEmptyFilteredResultBehavior,
    "VALID_EMPTY_RESULT"
  );
  assert.equal(contract.diagnostic.nextPageRequiresConsistentTotalPagesOrTotalCountProof, true);
  assert.equal(contract.diagnostic.ambiguousFullPageBehavior, "RESPONSE_CONTRACT_MISMATCH");
  assert.deepEqual(contract.classifications, CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_CLASSIFICATIONS);
  assert.equal(contract.outputBoundary.classificationOnly, true);
  assert.equal(Object.values(contract.outputBoundary).every(value => value === true || value === false), true);
  assert.equal(contract.attendanceBoundary.nativeControllingTtyRequired, true);
  assert.equal(contract.attendanceBoundary.confirmationBeforeKeychain, true);
  assert.equal(contract.attendanceBoundary.confirmationBeforeNetwork, true);
  assert.equal(contract.attendanceBoundary.confirmationBeforeArtifactWrite, true);
  assert.equal(Object.keys(CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_CONFIRMATIONS).length, 3);

  assert.equal(contract.diagnosticEvidence.schemaVersion, CLOUDFLARE_FOUNDER_ATTENDED_DIAGNOSTIC_SCHEMA);
  assert.equal(contract.diagnosticEvidence.maximumLifetimeMinutes, 30);
  assert.equal(CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_CONTROL_MAX_LIFETIME_MS, 30 * 60 * 1000);
  assert.equal(contract.successorControl.schemaVersion, CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_CONTROL_SCHEMA);
  assert.equal(contract.successorControl.predecessorPathReused, false);
  assert.equal(contract.successorControl.predecessorReceiptReused, false);
  assert.equal(contract.successorControl.requiresUnconsumedSuccessfulDiagnostic, true);
  assert.equal(contract.successorControl.futureConsumptionRevalidatesDiagnosticLineage, true);
  assert.equal(contract.successorControl.diagnosticReplayAllowed, false);
  assert.equal(contract.successorControl.replayAllowed, false);
  assert.equal(contract.laterRecoveryProvisioning.executedByThisBatch, false);
  assert.equal(contract.laterRecoveryProvisioning.createAttemptsMaximum, 1);
  assert.equal(contract.laterRecoveryProvisioning.automaticRetryAllowed, false);
  assert.equal(contract.laterRecoveryProvisioning.temporaryTokenDeletionAllowed, false);
  assert.equal(contract.packageWiring.rootPackageModified, false);
  assert.equal(
    contract.packageWiring.diagnosticCommand,
    "node scripts/run-cloudflare-founder-attended-get-only-diagnostic.mjs"
  );
  assert.equal(
    contract.packageWiring.futureRecoveryCommand,
    "node scripts/run-cloudflare-founder-attended-successor-recovery.mjs"
  );
  assert.equal(contract.testBoundary.mockNetworkOnly, true);
  assert.equal(contract.testBoundary.mockKeychainOnly, true);
  assert.equal(contract.runtimeBoundaries.pushAuthorized, false);

  verifyCloudflareFounderAttendedRecoveryPredecessorImmutabilityTestOnly();
  verifySourceBoundaries(contract);
  verifyNoNewSecretMaterial();
  return Object.freeze({
    status: "passed",
    batchId: CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_BATCH_ID,
    focusedTests: 19,
    cloudflareApiContacted: false,
    realKeychainValuesRead: false,
    productionMutationPerformed: false,
    laterRecoveryExecuted: false,
    temporaryTokenCleanupPerformed: false,
    pushed: false
  });
}

const isMain = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    console.log(JSON.stringify(verifyCloudflareFounderAttendedGetOnlyRecovery(), null, 2));
  } catch {
    console.error("Cloudflare Founder-attended GET-only recovery Infrastructure check failed.");
    process.exitCode = 1;
  }
}
