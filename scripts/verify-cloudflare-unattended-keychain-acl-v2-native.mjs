#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const swiftSource = resolve(
  root,
  "scripts/helpers/cloudflare-unattended-keychain-acl-v2-native-fixture.swift"
);
const helperSource = resolve(
  root,
  "scripts/helpers/cloudflare-unattended-keychain-acl-v2.swift"
);
const account = "SYNTHETIC_NONPRODUCTION_ITEM";
const maximumBuffer = 64 * 1024;
const matrixCases = Object.freeze([
  Object.freeze({ label: "APPLE_TOOL_ONLY", mode: "MATRIX_APPLE_TOOL_ONLY" }),
  Object.freeze({ label: "APPLE_ONLY", mode: "MATRIX_APPLE_ONLY" }),
  Object.freeze({ label: "APPLE_TOOL_PLUS_APPLE", mode: "MATRIX_APPLE_TOOL_PLUS_APPLE" })
]);
const reverseMatrixCases = Object.freeze([...matrixCases].reverse());
const authorizationMatrixCases = Object.freeze([
  Object.freeze({ label: "DECRYPT_ONLY", mode: "MATRIX_DECRYPT_ONLY" }),
  Object.freeze({ label: "EXPORT_CLEAR_ONLY", mode: "MATRIX_EXPORT_CLEAR_ONLY" }),
  Object.freeze({
    label: "DECRYPT_PLUS_EXPORT_CLEAR",
    mode: "MATRIX_DECRYPT_PLUS_EXPORT_CLEAR"
  })
]);
const reverseAuthorizationMatrixCases = Object.freeze([...authorizationMatrixCases].reverse());
const fixtureFailures = Object.freeze({
  65: "KEYCHAIN_CREATE_FAILED",
  66: "SYNTHETIC_ACCESS_OR_KEYCHAIN_UNLOCK_FAILED",
  68: "ITEM_REFERENCE_INVALID",
  69: "INITIAL_ACL_MISMATCH",
  70: "HELPER_INSPECT_FAILED_OR_TIMEOUT",
  71: "HELPER_GRANT_FAILED_OR_TIMEOUT",
  72: "GRANT_ACL_MISMATCH",
  73: "POSITIVE_READ_LAUNCH_FAILED",
  74: "HELPER_REVOKE_FAILED_OR_TIMEOUT",
  75: "POST_REVOKE_INSPECT_FAILED_OR_TIMEOUT",
  76: "ACL_SNAPSHOT_RESTORE_FAILED",
  77: "AUTHORIZATION_COMPONENT_RESTORE_FAILED",
  78: "POSITIVE_READ_TIMEOUT",
  79: "POSITIVE_READ_COMMAND_FAILED",
  80: "POSITIVE_READ_OUTPUT_MISMATCH",
  81: "ITEM_CREATE_INTERACTION_DISALLOWED",
  82: "ITEM_CREATE_AUTH_FAILED",
  83: "ITEM_CREATE_KEYCHAIN_UNAVAILABLE",
  84: "ITEM_CREATE_UNSUPPORTED_OR_INVALID_PARAMETERS",
  85: "ITEM_CREATE_UNCLASSIFIED_FAILURE",
  90: "KEYCHAIN_DELETE_FAILED",
  91: "KEYCHAIN_PATH_REMAINS_AFTER_BOUNDED_WAIT",
  93: "PHASE_MARKER_WRITE_FAILED",
  97: "USER_KEYCHAIN_SELECTION_BEFORE_SNAPSHOT_FAILED",
  98: "USER_KEYCHAIN_SELECTION_AFTER_SNAPSHOT_FAILED",
  99: "USER_KEYCHAIN_SELECTION_CHANGED"
});
const fixturePhases = new Set([
  "NONE",
  "USER_KEYCHAIN_SELECTION_BEFORE_CAPTURED",
  "KEYCHAIN_CREATE_STARTED",
  "KEYCHAIN_CREATED",
  "KEYCHAIN_UNLOCKED",
  "ITEM_CREATED_WITH_INITIAL_ACCESS",
  "INITIAL_ACL_VALIDATED",
  "MATRIX_ACCESS_VALIDATED",
  "MATRIX_READ_STARTED",
  "MATRIX_READ_PASSED",
  "HELPER_INSPECTED",
  "HELPER_GRANTED",
  "GRANT_VALIDATED",
  "POSITIVE_READ_STARTED",
  "POSITIVE_READ_PASSED",
  "HELPER_REVOKED",
  "RESTORE_VALIDATED",
  "KEYCHAIN_DELETE_DEFERRED",
  "KEYCHAIN_DELETE_REQUESTED",
  "KEYCHAIN_ABSENT",
  "USER_KEYCHAIN_SELECTION_RESTORED"
]);

function wipe(result) {
  if (Buffer.isBuffer(result?.stdout)) result.stdout.fill(0);
  if (Buffer.isBuffer(result?.stderr)) result.stderr.fill(0);
}

function run(executable, args, options = {}) {
  const result = spawnSync(executable, args, {
    cwd: root,
    encoding: null,
    env: {
      HOME: process.env.HOME,
      PATH: "/usr/bin:/bin:/usr/sbin:/sbin",
      TMPDIR: process.env.TMPDIR || "/tmp"
    },
    input: Buffer.alloc(0),
    maxBuffer: maximumBuffer,
    timeout: 30_000,
    ...options
  });
  return result;
}

function timeoutPhase(phasePath) {
  if (!existsSync(phasePath)) return "NONE";
  let phase = readFileSync(phasePath);
  try {
    if (phase.length > 64) return "MALFORMED";
    const value = phase.toString("ascii");
    return fixturePhases.has(value) ? value : "MALFORMED";
  } finally {
    phase.fill(0);
  }
}

function assertAttemptId(attemptId) {
  assert.match(
    attemptId,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u
  );
}

function compileNativeHarness({ temporaryDirectory, service, keychainPath }) {
  const helperBinary = join(temporaryDirectory, "acl-v2-native-e2e-helper");
  const fixtureBinary = join(temporaryDirectory, "acl-v2-native-e2e-fixture");
  const helperTestSource = join(temporaryDirectory, "main.swift");
  const helper = readFileSync(helperSource, "utf8");
  const testHelper = helper.replace(
    "let nativeE2EService: String\nlet nativeE2EAccount: String\nlet nativeE2EKeychainPath: String",
    [
      `let nativeE2EService = "${service}"`,
      `let nativeE2EAccount = "${account}"`,
      `let nativeE2EKeychainPath = "${keychainPath}"`
    ].join("\n")
  );
  assert.notEqual(testHelper, helper);
  writeFileSync(helperTestSource, testHelper, { encoding: "utf8", mode: 0o600 });

  const compileHelper = run("/usr/bin/swiftc", [
    "-D", "KEYCHAIN_ACL_V2_NATIVE_E2E",
    helperTestSource,
    "-o", helperBinary
  ]);
  const helperCompiled = compileHelper.status === 0;
  wipe(compileHelper);
  assert.equal(helperCompiled, true);

  const compileFixture = run("/usr/bin/swiftc", [swiftSource, "-o", fixtureBinary]);
  const fixtureCompiled = compileFixture.status === 0;
  wipe(compileFixture);
  assert.equal(fixtureCompiled, true);
  return Object.freeze({ helperBinary, fixtureBinary });
}

function fixedFixtureOutcome(result, phasePath) {
  let outcome = "PASS";
  if (result.error?.code === "ETIMEDOUT") {
    outcome = `FIXTURE_TIMEOUT_AFTER_${timeoutPhase(phasePath)}`;
  } else if (Object.hasOwn(fixtureFailures, result.status)) {
    outcome = fixtureFailures[result.status];
  } else if (result.status !== 0) {
    outcome = "UNCLASSIFIED_FAILURE";
  }
  const noOutput = result.stdout.length === 0 && result.stderr.length === 0;
  wipe(result);
  return noOutput ? outcome : "OUTPUT_DETECTED";
}

export function verifyNativeKeychainAclV2({ uuid = randomUUID } = {}) {
  if (process.platform !== "darwin") {
    return Object.freeze({ status: "SKIPPED_NON_MACOS" });
  }
  const attemptId = uuid();
  assertAttemptId(attemptId);
  const service = `com.prometheus.synthetic.keychain-acl-v2.${attemptId}`;
  const temporaryDirectory = mkdtempSync(join(tmpdir(), "prometheus-keychain-acl-v2-native-"));
  const keychainPath = join(temporaryDirectory, "fixture.keychain-db");
  const phasePath = join(temporaryDirectory, "fixture.phase");
  const keychainPaths = [keychainPath, `${keychainPath}-db`];
  let primaryError;
  try {
    const { helperBinary, fixtureBinary } = compileNativeHarness({
      temporaryDirectory,
      service,
      keychainPath
    });

    const e2e = run(fixtureBinary, [
      helperBinary,
      attemptId,
      keychainPath,
      phasePath,
      "LIFECYCLE"
    ]);
    let e2eError;
    if (e2e.error?.code === "ETIMEDOUT") {
      e2eError = new Error(`native_fixture_timeout_after_${timeoutPhase(phasePath)}`);
    } else if (Object.hasOwn(fixtureFailures, e2e.status)) {
      e2eError = new Error(`native_fixture_${fixtureFailures[e2e.status]}`);
    } else if (e2e.status !== 0) {
      e2eError = new Error("native_fixture_unclassified_failure");
    }
    const noOutput = e2e.stdout.length === 0 && e2e.stderr.length === 0;
    wipe(e2e);
    if (e2eError) throw e2eError;
    assert.equal(noOutput, true);
  } catch (error) {
    primaryError = error;
  }

  let cleanupError;
  try {
    const remainingPaths = keychainPaths.filter(existsSync);
    if (remainingPaths.length > 0) {
      cleanupError = new Error("native_fixture_keychain_path_remains_post_process");
    }
  } catch (error) {
    cleanupError = error;
  }
  rmSync(temporaryDirectory, { force: true, recursive: true });
  if (primaryError) throw primaryError;
  if (cleanupError) throw cleanupError;
  return Object.freeze({ status: "PASS" });
}

function verifyNativeKeychainAclV2MatrixOrder(matrixOrder, { uuid = randomUUID } = {}) {
  if (process.platform !== "darwin") {
    return Object.freeze({ status: "SKIPPED_NON_MACOS" });
  }
  const temporaryDirectory = mkdtempSync(join(tmpdir(), "prometheus-keychain-acl-v2-matrix-"));
  const seedId = uuid();
  assertAttemptId(seedId);
  const seedService = `com.prometheus.synthetic.keychain-acl-v2.${seedId}`;
  const seedKeychainPath = join(temporaryDirectory, "matrix-seed.keychain-db");
  const outcomes = {};
  try {
    const { helperBinary, fixtureBinary } = compileNativeHarness({
      temporaryDirectory,
      service: seedService,
      keychainPath: seedKeychainPath
    });
    for (const [index, matrixCase] of matrixOrder.entries()) {
      const attemptId = uuid();
      assertAttemptId(attemptId);
      const keychainPath = join(temporaryDirectory, `matrix-${index}.keychain-db`);
      const phasePath = join(temporaryDirectory, `matrix-${index}.phase`);
      const result = run(fixtureBinary, [
        helperBinary,
        attemptId,
        keychainPath,
        phasePath,
        matrixCase.mode
      ]);
      let outcome = fixedFixtureOutcome(result, phasePath);
      if (timeoutPhase(phasePath) !== "USER_KEYCHAIN_SELECTION_RESTORED") {
        outcome = "CLEANUP_UNPROVEN";
      }
      if ([keychainPath, `${keychainPath}-db`].some(existsSync)) {
        outcome = "CLEANUP_FAILED";
      }
      outcomes[matrixCase.label] = outcome;
    }
  } finally {
    rmSync(temporaryDirectory, { force: true, recursive: true });
  }

  let minimalSelectorSet = null;
  let status = "NO_SUPPORTED_SELECTOR";
  if (outcomes.APPLE_ONLY === "PASS") {
    status = "SUSPICIOUS_APPLE_ONLY_PASS";
  } else if (outcomes.APPLE_TOOL_ONLY === "PASS") {
    minimalSelectorSet = ["apple-tool:"];
    status = "PASS";
  } else if (outcomes.APPLE_TOOL_PLUS_APPLE === "PASS") {
    status = "SUSPICIOUS_COMBINATION_ONLY";
  }
  return Object.freeze({
    status,
    outcomes: Object.freeze(outcomes),
    minimalSelectorSet: minimalSelectorSet && Object.freeze(minimalSelectorSet)
  });
}

export function verifyNativeKeychainAclV2Matrix(options = {}) {
  return verifyNativeKeychainAclV2MatrixOrder(matrixCases, options);
}

export function verifyNativeKeychainAclV2MatrixReverse(options = {}) {
  return verifyNativeKeychainAclV2MatrixOrder(reverseMatrixCases, options);
}

function verifyNativeKeychainAclV2AuthorizationMatrixOrder(
  matrixOrder,
  { uuid = randomUUID } = {}
) {
  if (process.platform !== "darwin") {
    return Object.freeze({ status: "SKIPPED_NON_MACOS" });
  }
  const temporaryDirectory = mkdtempSync(
    join(tmpdir(), "prometheus-keychain-acl-v2-authorization-matrix-")
  );
  const seedId = uuid();
  assertAttemptId(seedId);
  const seedService = `com.prometheus.synthetic.keychain-acl-v2.${seedId}`;
  const seedKeychainPath = join(temporaryDirectory, "matrix-seed.keychain-db");
  const outcomes = {};
  try {
    const { helperBinary, fixtureBinary } = compileNativeHarness({
      temporaryDirectory,
      service: seedService,
      keychainPath: seedKeychainPath
    });
    for (const [index, matrixCase] of matrixOrder.entries()) {
      const attemptId = uuid();
      assertAttemptId(attemptId);
      const keychainPath = join(temporaryDirectory, `matrix-${index}.keychain-db`);
      const phasePath = join(temporaryDirectory, `matrix-${index}.phase`);
      const result = run(fixtureBinary, [
        helperBinary,
        attemptId,
        keychainPath,
        phasePath,
        matrixCase.mode
      ]);
      let outcome = fixedFixtureOutcome(result, phasePath);
      if (timeoutPhase(phasePath) !== "USER_KEYCHAIN_SELECTION_RESTORED") {
        outcome = "CLEANUP_UNPROVEN";
      }
      if ([keychainPath, `${keychainPath}-db`].some(existsSync)) {
        outcome = "CLEANUP_FAILED";
      }
      outcomes[matrixCase.label] = outcome;
    }
  } finally {
    rmSync(temporaryDirectory, { force: true, recursive: true });
  }

  let minimalAuthorizationSet = null;
  let status = "NO_SUPPORTED_AUTHORIZATION";
  if (outcomes.DECRYPT_ONLY === "PASS") {
    minimalAuthorizationSet = ["kSecACLAuthorizationDecrypt"];
    status = "PASS";
  } else if (outcomes.EXPORT_CLEAR_ONLY === "PASS") {
    minimalAuthorizationSet = ["kSecACLAuthorizationExportClear"];
    status = "PASS";
  } else if (outcomes.DECRYPT_PLUS_EXPORT_CLEAR === "PASS") {
    minimalAuthorizationSet = [
      "kSecACLAuthorizationDecrypt",
      "kSecACLAuthorizationExportClear"
    ];
    status = "PASS";
  }
  return Object.freeze({
    status,
    outcomes: Object.freeze(outcomes),
    minimalAuthorizationSet: minimalAuthorizationSet
      && Object.freeze(minimalAuthorizationSet)
  });
}

export function verifyNativeKeychainAclV2AuthorizationMatrix(options = {}) {
  return verifyNativeKeychainAclV2AuthorizationMatrixOrder(
    authorizationMatrixCases,
    options
  );
}

export function verifyNativeKeychainAclV2AuthorizationMatrixReverse(options = {}) {
  return verifyNativeKeychainAclV2AuthorizationMatrixOrder(
    reverseAuthorizationMatrixCases,
    options
  );
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  if (process.argv[2] === "--matrix" || process.argv[2] === "--matrix-reverse") {
    const result = process.argv[2] === "--matrix-reverse"
      ? verifyNativeKeychainAclV2MatrixReverse()
      : verifyNativeKeychainAclV2Matrix();
    for (const matrixCase of matrixCases) {
      process.stdout.write(`${matrixCase.label}=${result.outcomes[matrixCase.label]}\n`);
    }
    process.stdout.write(`MATRIX=${result.status}\n`);
    if (result.status !== "PASS" && result.status !== "SKIPPED_NON_MACOS") {
      process.exitCode = 1;
    }
  } else if (
    process.argv[2] === "--authorization-matrix"
    || process.argv[2] === "--authorization-matrix-reverse"
  ) {
    const result = process.argv[2] === "--authorization-matrix-reverse"
      ? verifyNativeKeychainAclV2AuthorizationMatrixReverse()
      : verifyNativeKeychainAclV2AuthorizationMatrix();
    for (const matrixCase of authorizationMatrixCases) {
      process.stdout.write(`${matrixCase.label}=${result.outcomes[matrixCase.label]}\n`);
    }
    process.stdout.write(`AUTHORIZATION_MATRIX=${result.status}\n`);
    if (result.status !== "PASS" && result.status !== "SKIPPED_NON_MACOS") {
      process.exitCode = 1;
    }
  } else {
    const result = verifyNativeKeychainAclV2();
    process.stdout.write(`${result.status}\n`);
  }
}
