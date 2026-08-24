import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
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
import {
  CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_INFRASTRUCTURE_PREDECESSOR_PATHS,
  CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_OVERWATCH_RELEASE_WIRING_PATHS
} from "./verify-cloudflare-founder-attended-get-only-recovery.mjs";

const root = resolve(import.meta.dirname, "..");
const baselineCommit = "d32ffd8f6ea255fa029976b1bf0006663d567153";
const metadataPath = "workers/infrastructure/cloudflare-founder-attended-response-contract-repair-v1.json";
const documentationPath = "docs/cloudflare-founder-attended-response-contract-repair-v1.md";
const testPath = "tests/cloudflare-founder-attended-response-contract-repair.test.mjs";
const ownerVerifierOwnershipTestPath =
  "tests/cloudflare-founder-attended-owner-verifier-ownership.test.mjs";

export const CLOUDFLARE_FOUNDER_ATTENDED_KEYCHAIN_FIXTURE_OWNER_SUCCESSOR = Object.freeze({
  commit: "12c8bc3cfaf16dc23e8eb7a26d14ed22bf70630e",
  tree: "5084667426465a7df46cbbf2dc35c0f043c1436e",
  parent: "94e7bc78a30dd3d0f8b272e351d2f820541c4f90",
  authorName: "Prometheus Infrastructure",
  authorEmail: "infrastructure@prometheus.local",
  committerName: "Prometheus Infrastructure",
  committerEmail: "infrastructure@prometheus.local",
  subject: "Align attended Keychain compatibility fixtures",
  authoredAt: "2026-07-15T14:15:08-05:00",
  committedAt: "2026-07-15T14:15:08-05:00",
  transitions: Object.freeze([
    Object.freeze({
      status: "M",
      path: "tests/cloudflare-founder-attended-service-token.test.mjs",
      beforeSha256: "05ab27c49a5d629bfb556944081893b23fd3c4c3a247565a8ed02c6440fb496b",
      afterSha256: "473a26d8554360837338c41e5fe14960cef985bff33361e63a2f13f144c30cd9"
    }),
    Object.freeze({
      status: "M",
      path: "tests/cloudflare-unattended-keychain-interoperability.test.mjs",
      beforeSha256: "79daa55d323eb0c970ae6da02d7f902981c609a6a6f8117ec18e09baab8d2bac",
      afterSha256: "492217e6f2a6b14ec0588e2e08cf4f1e0f2d4a1eb2757c995fc256fee25b9f8a"
    })
  ])
});
export const CLOUDFLARE_FOUNDER_ATTENDED_KEYCHAIN_CI_PORTABILITY_SUCCESSOR = Object.freeze({
  commit: "af2d85d80a1abf332e202a1d24ca0c290d9d6a6b",
  tree: "955431d084ed6e529490e71e6432c8007217db36",
  parent: "bb0fe15841027a63ccbebfeeac21e5ead4d5e76c",
  authorName: "Prometheus Infrastructure",
  authorEmail: "infrastructure@prometheus.local",
  committerName: "Prometheus Infrastructure",
  committerEmail: "infrastructure@prometheus.local",
  subject: "Make Keychain owner verifier portable in CI",
  authoredAt: "2026-07-20T11:10:39-05:00",
  committedAt: "2026-07-20T11:10:39-05:00",
  transitions: Object.freeze([
    Object.freeze({
      status: "M",
      path: "scripts/verify-cloudflare-unattended-keychain-interoperability.mjs",
      beforeSha256: "98d40d6fd46bf079d8ac8bfccd6458e7a94cbea69125fe941c219eb3b88ed5ef",
      afterSha256: "df78ec38424ac7938acfce625445ecb5dc047d3743a7776832a768049a4c36f3"
    }),
    Object.freeze({
      status: "M",
      path: "tests/cloudflare-unattended-keychain-interoperability.test.mjs",
      beforeSha256: "492217e6f2a6b14ec0588e2e08cf4f1e0f2d4a1eb2757c995fc256fee25b9f8a",
      afterSha256: "3a6a7fea191da9a66b107722aa33cffebaec6bee16dc115a26aec528750ad976"
    })
  ])
});

export const CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_INFRASTRUCTURE_PREDECESSOR_PATHS =
  Object.freeze([
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
    "tests/cloudflare-founder-attended-get-only-recovery.test.mjs",
    "tests/cloudflare-founder-attended-service-token.test.mjs",
    "workers/infrastructure/cloudflare-founder-attended-get-only-recovery-v1.json",
    "workers/infrastructure/cloudflare-founder-attended-service-token-v1.json"
  ]);
export const CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_OVERWATCH_RELEASE_WIRING_PATHS =
  CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_OVERWATCH_RELEASE_WIRING_PATHS;

const sourcePaths = Object.freeze([
  documentationPath,
  "scripts/lib/cloudflare-founder-attended-response-contract-artifacts.mjs",
  "scripts/lib/cloudflare-founder-attended-response-contract-constants.mjs",
  "scripts/lib/cloudflare-founder-attended-response-contract-production.mjs",
  "scripts/lib/cloudflare-founder-attended-response-contract-workflow.mjs",
  "scripts/run-cloudflare-founder-attended-response-contract-diagnostic.mjs",
  "scripts/run-cloudflare-founder-attended-response-contract-prepare.mjs",
  "scripts/run-cloudflare-founder-attended-response-contract-provision.mjs",
  "scripts/verify-cloudflare-founder-attended-get-only-recovery.mjs",
  "scripts/verify-cloudflare-founder-attended-response-contract-repair.mjs",
  ownerVerifierOwnershipTestPath,
  testPath,
  metadataPath
]);

const read = path => readFileSync(resolve(root, path), "utf8");
const readJson = path => JSON.parse(read(path));

const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");

function gitBytes(repositoryRoot, args) {
  return execFileSync("/usr/bin/git", args, {
    cwd: resolve(repositoryRoot),
    encoding: null,
    maxBuffer: 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function gitText(repositoryRoot, args) {
  return gitBytes(repositoryRoot, args).toString("utf8").trimEnd();
}

function verifyAuthenticatedKeychainFixtureOwnerSuccessor({
  repositoryRoot,
  expectedBaselineCommit,
  expectedOwnerSuccessor,
  expectedPaths,
  requireCurrent
}) {
  for (const value of [
    expectedBaselineCommit,
    expectedOwnerSuccessor.commit,
    expectedOwnerSuccessor.tree,
    expectedOwnerSuccessor.parent
  ]) {
    assert.match(value, /^[0-9a-f]{40}$/u);
  }
  assert.deepEqual(
    expectedOwnerSuccessor.transitions.map(transition => transition.path),
    expectedPaths
  );
  for (const transition of expectedOwnerSuccessor.transitions) {
    assert.equal(transition.status, "M");
    assert.match(transition.beforeSha256, /^[0-9a-f]{64}$/u);
    assert.match(transition.afterSha256, /^[0-9a-f]{64}$/u);
  }

  execFileSync(
    "/usr/bin/git",
    ["merge-base", "--is-ancestor", expectedBaselineCommit, expectedOwnerSuccessor.commit],
    { cwd: resolve(repositoryRoot), stdio: "ignore" }
  );
  execFileSync(
    "/usr/bin/git",
    ["merge-base", "--is-ancestor", expectedOwnerSuccessor.commit, "HEAD"],
    { cwd: resolve(repositoryRoot), stdio: "ignore" }
  );

  const metadata = gitText(repositoryRoot, [
    "show",
    "-s",
    "--format=%H%x00%T%x00%P%x00%an%x00%ae%x00%cn%x00%ce%x00%s%x00%aI%x00%cI",
    expectedOwnerSuccessor.commit
  ]).split("\0");
  assert.deepEqual(metadata, [
    expectedOwnerSuccessor.commit,
    expectedOwnerSuccessor.tree,
    expectedOwnerSuccessor.parent,
    expectedOwnerSuccessor.authorName,
    expectedOwnerSuccessor.authorEmail,
    expectedOwnerSuccessor.committerName,
    expectedOwnerSuccessor.committerEmail,
    expectedOwnerSuccessor.subject,
    expectedOwnerSuccessor.authoredAt,
    expectedOwnerSuccessor.committedAt
  ]);

  const changedPaths = gitText(repositoryRoot, [
    "diff-tree",
    "--no-commit-id",
    "--name-status",
    "--no-renames",
    "-r",
    expectedOwnerSuccessor.commit
  ]).split("\n");
  assert.deepEqual(
    changedPaths,
    expectedOwnerSuccessor.transitions.map(
      transition => `${transition.status}\t${transition.path}`
    )
  );

  for (const transition of expectedOwnerSuccessor.transitions) {
    assert.equal(
      sha256(gitBytes(repositoryRoot, [
        "show",
        `${expectedOwnerSuccessor.parent}:${transition.path}`
      ])),
      transition.beforeSha256
    );
    assert.equal(
      sha256(gitBytes(repositoryRoot, [
        "show",
        `${expectedOwnerSuccessor.commit}:${transition.path}`
      ])),
      transition.afterSha256
    );
    if (requireCurrent) {
      assert.equal(
        sha256(readFileSync(resolve(repositoryRoot, transition.path))),
        transition.afterSha256
      );
    }
  }
}

export function verifyCloudflareFounderAttendedResponseContractPredecessorImmutabilityTestOnly({
  repositoryRoot = root,
  expectedBaselineCommit = baselineCommit,
  expectedOwnerSuccessor = CLOUDFLARE_FOUNDER_ATTENDED_KEYCHAIN_FIXTURE_OWNER_SUCCESSOR,
  expectedCurrentSuccessor = CLOUDFLARE_FOUNDER_ATTENDED_KEYCHAIN_CI_PORTABILITY_SUCCESSOR
} = {}) {
  assert.match(expectedBaselineCommit, /^[0-9a-f]{40}$/u);
  verifyAuthenticatedKeychainFixtureOwnerSuccessor({
    repositoryRoot,
    expectedBaselineCommit,
    expectedOwnerSuccessor,
    expectedPaths: [
      "tests/cloudflare-founder-attended-service-token.test.mjs",
      "tests/cloudflare-unattended-keychain-interoperability.test.mjs"
    ],
    requireCurrent: false
  });
  if (expectedCurrentSuccessor) {
    execFileSync(
      "/usr/bin/git",
      ["merge-base", "--is-ancestor", expectedOwnerSuccessor.commit, expectedCurrentSuccessor.commit],
      { cwd: resolve(repositoryRoot), stdio: "ignore" }
    );
    verifyAuthenticatedKeychainFixtureOwnerSuccessor({
      repositoryRoot,
      expectedBaselineCommit,
      expectedOwnerSuccessor: expectedCurrentSuccessor,
      expectedPaths: [
        "scripts/verify-cloudflare-unattended-keychain-interoperability.mjs",
        "tests/cloudflare-unattended-keychain-interoperability.test.mjs"
      ],
      requireCurrent: true
    });
  }
  assert.deepEqual(
    CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_OVERWATCH_RELEASE_WIRING_PATHS,
    ["package.json"]
  );
  assert.equal(
    CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_INFRASTRUCTURE_PREDECESSOR_PATHS.includes(
      "package.json"
    ),
    false
  );
  for (const path of CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_INFRASTRUCTURE_PREDECESSOR_PATHS) {
    assert.equal(
      CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_INFRASTRUCTURE_PREDECESSOR_PATHS.includes(path),
      true
    );
  }
  const authenticatedPaths = new Set(
    [expectedOwnerSuccessor, expectedCurrentSuccessor]
      .filter(Boolean)
      .flatMap(successor => successor.transitions.map(transition => transition.path))
  );
  const strictlyImmutablePaths =
    CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_INFRASTRUCTURE_PREDECESSOR_PATHS.filter(
      path => !authenticatedPaths.has(path)
    );
  assert.deepEqual(
    CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_INFRASTRUCTURE_PREDECESSOR_PATHS.filter(
      path => authenticatedPaths.has(path)
    ),
    ["tests/cloudflare-founder-attended-service-token.test.mjs"]
  );
  execFileSync("/usr/bin/git", [
    "diff",
    "--quiet",
    expectedBaselineCommit,
    "--",
    ...strictlyImmutablePaths
  ], {
    cwd: resolve(repositoryRoot),
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
  const ownerVerifier = read("scripts/verify-cloudflare-founder-attended-get-only-recovery.mjs");
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
  assert.match(workflow, /reserveFounderAttendedResponseContractAttempt/u);
  assert.match(workflow, /CLIENT_ID_PATTERN\.test/u);
  assert.match(workflow, /CLIENT_SECRET_PATTERN\.test/u);
  assert.match(workflow, /await exactNameState/u);
  assert.match(workflow, /phaseWriter\(consumed\.attemptRoot,\s*consumed\.control/u);
  assert.match(workflow, /outcome:\s*"LOCAL_ARTIFACT_COLLISION"/u);
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
  assert.match(artifacts, /attempts:\s*join\(base,\s*"attempts"\)/u);
  assert.match(artifacts, /attempt-lineage\.json/u);
  assert.match(artifacts, /authorizedCommit/u);
  assert.match(artifacts, /authorizedTree/u);
  assert.match(artifacts, /diagnostic-receipt\.json/u);
  assert.match(artifacts, /diagnostic-consumption\.json/u);
  assert.match(artifacts, /successor-control\.json/u);
  assert.match(artifacts, /successor-control-consumption\.json/u);
  assert.match(artifacts, /phase-evidence/u);
  assert.match(artifacts, /LOCAL_ARTIFACT_COLLISION/u);
  assert.match(artifacts, /readFounderAttendedResponseContractAttemptStateTestOnly/u);

  assert.match(production, /createControllingTtyConfirmation\(\)/u);
  assert.match(production, /console\.log\(result\.outcome\)/u);
  assert.match(production, /console\.error\("MANUAL_REVIEW"\)/u);
  assert.doesNotMatch(production, /console\.(?:log|error)\([^\n]*(?:error|credential|clientId|clientSecret)/u);
  assert.doesNotMatch(entrypoints, /keychain|transport|requestImpl|process\.env/u);

  assert.deepEqual(
    CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_OVERWATCH_RELEASE_WIRING_PATHS,
    ["package.json"]
  );
  assert.deepEqual(
    CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_OVERWATCH_RELEASE_WIRING_PATHS,
    ["package.json"]
  );
  assert.equal(
    CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_INFRASTRUCTURE_PREDECESSOR_PATHS.includes(
      "package.json"
    ),
    false
  );
  assert.equal(
    CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_INFRASTRUCTURE_PREDECESSOR_PATHS.includes("package.json"),
    false
  );
  for (const path of [
    "scripts/lib/cloudflare-founder-attended-service-token.mjs",
    "scripts/lib/cloudflare-founder-attended-control.mjs",
    "scripts/helpers/cloudflare-founder-attended-keychain.swift"
  ]) {
    assert.equal(
      CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_INFRASTRUCTURE_PREDECESSOR_PATHS.includes(path),
      true
    );
  }
  assert.match(ownerVerifier, /OVERWATCH_RELEASE_WIRING_PATHS/u);
  assert.match(ownerVerifier, /INFRASTRUCTURE_PREDECESSOR_PATHS/u);
  assert.match(ownerVerifier, /verifyCloudflareFounderAttendedRecoveryPredecessorImmutabilityTestOnly/u);

  const tests = read(testPath);
  assert.doesNotMatch(tests, /ResponseContract(?:Diagnostic|Preparation|Provisioning)Cli/u);
  assert.doesNotMatch(tests, /node:https|httpsRequest/u);
  assert.match(tests, /repeated fresh diagnostics create isolated attempts/u);
  assert.match(tests, /simultaneous fresh absence attempts fail safely without mixing/u);
  assert.match(tests, /failed network, malformed, and authorization diagnostics create isolated abandoned attempts/u);
  assert.match(tests, /future-dated lineage or diagnostic cannot prepare/u);
  assert.match(tests, /commit and tree lineage tampering fail closed/u);
  assert.match(tests, /LOCAL_ARTIFACT_COLLISION/u);
  assert.match(tests, /legacy flat-root evidence remains untouched/u);
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

  verifyCloudflareFounderAttendedResponseContractPredecessorImmutabilityTestOnly();
  verifySourceBoundary();
  verifySecretSafety();
  return Object.freeze({
    status: "passed",
    batchId: CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_BATCH_ID,
    focusedTests: 17,
    ownerVerifierOwnershipTests: 6,
    packageReleaseWiringOwner: "Prometheus Overwatch",
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
