#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const swiftSource = resolve(
  root,
  "scripts/helpers/cloudflare-unattended-keychain-acl-v2-native-fixture.swift"
);
const account = "SYNTHETIC_NONPRODUCTION_ITEM";
const syntheticValue = "synthetic-nonproduction-value";
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
  const binary = join(temporaryDirectory, "acl-inspector");
  let created = false;
  try {
    const preflight = run("/usr/bin/security", [
      "find-generic-password", "-s", service, "-a", account
    ]);
    assert.equal(preflight.status, 44);
    wipe(preflight);

    const compile = run("/usr/bin/swiftc", [swiftSource, "-o", binary]);
    assert.equal(compile.status, 0);
    wipe(compile);

    const create = run("/usr/bin/security", [
      "add-generic-password",
      "-s", service,
      "-a", account,
      "-w", syntheticValue,
      "-T", "/usr/bin/security"
    ]);
    assert.equal(create.status, 0);
    created = true;
    wipe(create);

    const inspect = run(binary, [attemptId]);
    assert.equal(inspect.status, 0);
    assert.equal(inspect.stdout.length, 0);
    assert.equal(inspect.stderr.length, 0);
    wipe(inspect);

    const retrieve = run("/usr/bin/security", [
      "find-generic-password",
      "-s", service,
      "-a", account,
      "-w"
    ]);
    assert.equal(retrieve.status, 0);
    assert.equal(retrieve.stdout.toString("utf8").trimEnd(), syntheticValue);
    assert.equal(retrieve.stderr.length, 0);
    wipe(retrieve);
    return Object.freeze({ status: "PASS" });
  } finally {
    if (created) {
      const remove = run("/usr/bin/security", [
        "delete-generic-password", "-s", service, "-a", account
      ]);
      const removed = remove.status === 0;
      wipe(remove);
      if (!removed) {
        rmSync(temporaryDirectory, { force: true, recursive: true });
        throw new Error("synthetic_keychain_fixture_cleanup_failed");
      }
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
