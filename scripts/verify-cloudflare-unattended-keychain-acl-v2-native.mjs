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
  try {
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
    assert.equal(compileHelper.status, 0);
    wipe(compileHelper);

    const compileFixture = run("/usr/bin/swiftc", [swiftSource, "-o", fixtureBinary]);
    assert.equal(compileFixture.status, 0);
    wipe(compileFixture);

    const e2e = run(fixtureBinary, [helperBinary, attemptId, keychainPath]);
    if (Object.hasOwn(fixtureFailures, e2e.status)) {
      throw new Error(`native_fixture_${fixtureFailures[e2e.status]}`);
    }
    assert.equal(e2e.status, 0);
    assert.equal(e2e.stdout.length, 0);
    assert.equal(e2e.stderr.length, 0);
    wipe(e2e);
    return Object.freeze({ status: "PASS" });
  } finally {
    const absent = !existsSync(keychainPath);
    rmSync(temporaryDirectory, { force: true, recursive: true });
    if (!absent) throw new Error("synthetic_keychain_fixture_remained");
  }
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  const result = verifyNativeKeychainAclV2();
  process.stdout.write(`${result.status}\n`);
}
