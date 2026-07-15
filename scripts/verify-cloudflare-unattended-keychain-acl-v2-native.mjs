#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
  try {
    const preflight = run("/usr/bin/security", [
      "find-generic-password", "-s", service, "-a", account
    ]);
    assert.equal(preflight.status, 44);
    wipe(preflight);

    const helper = readFileSync(helperSource, "utf8");
    const testHelper = helper.replace(
      "let nativeE2EService: String\nlet nativeE2EAccount: String",
      [
        `let nativeE2EService = "${service}"`,
        `let nativeE2EAccount = "${account}"`
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

    const e2e = run(fixtureBinary, [helperBinary, attemptId]);
    assert.equal(e2e.status, 0);
    assert.equal(e2e.stdout.length, 0);
    assert.equal(e2e.stderr.length, 0);
    wipe(e2e);
    return Object.freeze({ status: "PASS" });
  } finally {
    const remove = run("/usr/bin/security", [
      "delete-generic-password", "-s", service, "-a", account
    ]);
    const removedOrAlreadyAbsent = [0, 44].includes(remove.status);
    wipe(remove);
    if (!removedOrAlreadyAbsent) {
      rmSync(temporaryDirectory, { force: true, recursive: true });
      throw new Error("synthetic_keychain_fixture_cleanup_failed");
    }
    const postflight = run("/usr/bin/security", [
      "find-generic-password", "-s", service, "-a", account
    ]);
    const absent = postflight.status === 44;
    wipe(postflight);
    rmSync(temporaryDirectory, { force: true, recursive: true });
    if (!absent) throw new Error("synthetic_keychain_fixture_remained");
  }
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  const result = verifyNativeKeychainAclV2();
  process.stdout.write(`${result.status}\n`);
}
