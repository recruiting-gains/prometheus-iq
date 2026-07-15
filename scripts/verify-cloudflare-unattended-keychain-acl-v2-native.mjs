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
const fixtureFailures = Object.freeze({
  81: "SET_ACCESS_INVALID_ITEM_REFERENCE",
  82: "SET_ACCESS_AUTH_FAILED",
  83: "SET_ACCESS_INTERACTION_REQUIRED",
  84: "SET_ACCESS_KEYCHAIN_UNAVAILABLE",
  85: "SET_ACCESS_UNSUPPORTED_OR_INVALID_PARAMETERS",
  78: "INITIAL_READ_UNEXPECTEDLY_RETRIEVABLE",
  79: "INITIAL_READ_LAUNCH_FAILED",
  80: "INITIAL_READ_UNCLASSIFIED_FAILURE",
  90: "KEYCHAIN_DELETE_FAILED",
  91: "KEYCHAIN_PATH_REMAINS_AFTER_BOUNDED_WAIT",
  89: "SET_ACCESS_UNCLASSIFIED_FAILURE"
});

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

function captureUserKeychainSelection() {
  const searchList = run("/usr/bin/security", ["list-keychains"]);
  const defaultKeychain = run("/usr/bin/security", ["default-keychain"]);
  const snapshot = {
    searchList: Buffer.from(searchList.stdout || []),
    defaultKeychain: Buffer.from(defaultKeychain.stdout || [])
  };
  const valid = searchList.status === 0 && defaultKeychain.status === 0;
  wipe(searchList);
  wipe(defaultKeychain);
  if (!valid) {
    snapshot.searchList.fill(0);
    snapshot.defaultKeychain.fill(0);
    throw new Error("native_fixture_user_keychain_selection_snapshot_failed");
  }
  return snapshot;
}

function sameUserKeychainSelection(before, after) {
  return before.searchList.equals(after.searchList)
    && before.defaultKeychain.equals(after.defaultKeychain);
}

function wipeUserKeychainSelection(snapshot) {
  snapshot.searchList.fill(0);
  snapshot.defaultKeychain.fill(0);
}

export function verifyNativeKeychainAclV2({ uuid = randomUUID } = {}) {
  if (process.platform !== "darwin") {
    return Object.freeze({ status: "SKIPPED_NON_MACOS" });
  }
  const attemptId = uuid();
  assert.match(
    attemptId,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u
  );
  const service = `com.prometheus.synthetic.keychain-acl-v2.${attemptId}`;
  const temporaryDirectory = mkdtempSync(join(tmpdir(), "prometheus-keychain-acl-v2-native-"));
  const helperBinary = join(temporaryDirectory, "acl-v2-native-e2e-helper");
  const fixtureBinary = join(temporaryDirectory, "acl-v2-native-e2e-fixture");
  const helperTestSource = join(temporaryDirectory, "main.swift");
  const keychainPath = join(temporaryDirectory, "fixture.keychain-db");
  const keychainPaths = [keychainPath, `${keychainPath}-db`];
  let beforeSelection;
  let primaryError;
  try {
    beforeSelection = captureUserKeychainSelection();
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

    const e2e = run(fixtureBinary, [helperBinary, attemptId, keychainPath]);
    let e2eError;
    if (e2e.error?.code === "ETIMEDOUT") {
      e2eError = new Error("native_fixture_timeout");
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

  let afterSelection;
  let cleanupError;
  try {
    afterSelection = captureUserKeychainSelection();
    if (!sameUserKeychainSelection(beforeSelection, afterSelection)) {
      cleanupError = new Error("native_fixture_user_keychain_selection_changed");
    }
  } catch (error) {
    cleanupError = error;
  } finally {
    if (beforeSelection) wipeUserKeychainSelection(beforeSelection);
    if (afterSelection) wipeUserKeychainSelection(afterSelection);
  }

  const remainingPaths = keychainPaths.filter(existsSync);
  if (remainingPaths.length > 0 && !cleanupError) {
    cleanupError = new Error("native_fixture_keychain_path_remains_post_process");
  }
  if (remainingPaths.length > 0) {
    rmSync(temporaryDirectory, { force: true, recursive: true });
  } else {
    rmSync(temporaryDirectory, { force: true, recursive: true });
  }
  if (primaryError) throw primaryError;
  if (cleanupError) throw cleanupError;
  return Object.freeze({ status: "PASS" });
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  const result = verifyNativeKeychainAclV2();
  process.stdout.write(`${result.status}\n`);
}
