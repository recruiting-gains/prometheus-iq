import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import {
  CLOUDFLARE_UNATTENDED_KEYCHAIN_ITEMS,
  classifyCloudflareUnattendedKeychain,
  createMacOsKeychainAdapter,
  formatCloudflareUnattendedKeychainClassification
} from "../scripts/lib/cloudflare-unattended-keychain.mjs";
import {
  CLOUDFLARE_UNATTENDED_KEYCHAIN_REMEDIATION_PHRASE,
  createCloudflareUnattendedAclAdapter,
  recordCloudflareUnattendedKeychainClassification,
  remediateCloudflareUnattendedKeychain,
  rollbackCloudflareUnattendedKeychainRemediation
} from "../scripts/lib/cloudflare-unattended-keychain-interoperability.mjs";

const HEAD = "a".repeat(40);
const TREE = "b".repeat(40);
const FIRST_UUID = "11111111-1111-4111-8111-111111111111";
const SECOND_UUID = "22222222-2222-4222-8222-222222222222";
const SECRET_FIXTURE = "synthetic-sensitive-value-that-must-not-escape";

function gitExec(_executable, args) {
  if (args[0] === "rev-parse" && args[1] === "HEAD") return `${HEAD}\n`;
  if (args[0] === "rev-parse" && args[1] === "HEAD^{tree}") return `${TREE}\n`;
  if (args[0] === "status") return "";
  throw new Error(`unexpected_git_call:${args.join(" ")}`);
}

function tempArtifactRoot(t) {
  const parent = mkdtempSync(join(tmpdir(), "prometheus-keychain-interop-"));
  t.after(() => rmSync(parent, { force: true, recursive: true }));
  return join(parent, "artifacts");
}

function processResult(status, stdout = Buffer.alloc(0), options = {}) {
  return {
    error: options.error,
    status,
    stdout,
    stderr: Buffer.isBuffer(options.stderr)
      ? options.stderr
      : Buffer.from(options.stderr || "", "utf8")
  };
}

function retrievalClassification({
  reason = "INTERACTION_REQUIRED",
  status = "FAIL"
} = {}) {
  const retrievable = status === "PASS";
  return Object.freeze({
    executionIdentity: "MATCHED",
    keychainLockState: "UNLOCKED",
    items: Object.freeze(CLOUDFLARE_UNATTENDED_KEYCHAIN_ITEMS.map(item => Object.freeze({
      alias: item.alias,
      presence: "PRESENT",
      retrieval: retrievable ? "RETRIEVABLE" : "NOT_RETRIEVABLE",
      reason: retrievable ? "NONE" : reason
    }))),
    status
  });
}

function confirmation(accepted = true, events = []) {
  return Object.freeze({
    confirm(action, phrase) {
      events.push(`confirm:${action}`);
      assert.equal(phrase, CLOUDFLARE_UNATTENDED_KEYCHAIN_REMEDIATION_PHRASE);
      return accepted;
    }
  });
}

function aclHarness({ failGrantAt = null } = {}) {
  const events = [];
  const trusted = new Set();
  let grantCount = 0;
  return {
    events,
    trusted,
    adapter: Object.freeze({
      inspect(alias) {
        events.push(`inspect:${alias}`);
        return trusted.has(alias) ? "TRUSTED" : "NOT_TRUSTED";
      },
      grant(alias) {
        grantCount += 1;
        events.push(`grant:${alias}`);
        if (grantCount === failGrantAt) throw new Error("injected_grant_failure");
        trusted.add(alias);
        return "ADDED";
      },
      revoke(alias) {
        events.push(`revoke:${alias}`);
        if (!trusted.delete(alias)) throw new Error("injected_revoke_failure");
        return "REMOVED";
      }
    })
  };
}

function classificationDirectory(artifactRoot, id = FIRST_UUID) {
  return join(artifactRoot, "classifications", id);
}

test("launcher and classifier share the exact fixed four-item registry and security executable", () => {
  assert.deepEqual(
    CLOUDFLARE_UNATTENDED_KEYCHAIN_ITEMS.map(item => item.alias),
    ["DEPLOYMENT_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID", "SMOKE_CLIENT_ID", "SMOKE_CLIENT_SECRET"]
  );
  const launcher = readFileSync(
    resolve("scripts/lib/cloudflare-unattended-launcher.mjs"),
    "utf8"
  );
  assert.match(launcher, /from "\.\/cloudflare-unattended-keychain\.mjs"/u);
  assert.doesNotMatch(launcher, /find-generic-password/u);
});

test("successful probes discard bounded value and diagnostic buffers", () => {
  const buffers = [];
  const spawnSyncImpl = (_executable, args) => {
    if (args[0] === "find-generic-password" && args.includes("-w")) {
      const stdout = Buffer.from(SECRET_FIXTURE, "utf8");
      const stderr = Buffer.from("discarded diagnostic", "utf8");
      buffers.push(stdout, stderr);
      return processResult(0, stdout, { stderr });
    }
    return processResult(0);
  };
  const classification = classifyCloudflareUnattendedKeychain({
    executionIdentity: "MATCHED",
    keychainLockState: "UNLOCKED",
    spawnSyncImpl
  });
  assert.equal(classification.status, "PASS");
  assert.ok(buffers.every(buffer => buffer.every(byte => byte === 0)));
  assert.doesNotMatch(formatCloudflareUnattendedKeychainClassification(classification), /sensitive|diagnostic/u);
});

test("fixed classifier distinguishes every governed failure class", () => {
  const scenarios = [
    {
      expected: "ITEM_ABSENT",
      spawn: () => processResult(44)
    },
    {
      expected: "INCORRECT_ACCOUNT_IDENTITY",
      spawn: (_executable, args) => processResult(
        args[0] === "find-generic-password" && args.includes("-s") && !args.includes("-a") ? 0 : 44
      )
    },
    {
      expected: "INCORRECT_SERVICE_IDENTITY",
      spawn: (_executable, args) => processResult(
        args[0] === "find-generic-password" && args.includes("-a") && !args.includes("-s") ? 0 : 44
      )
    },
    {
      expected: "ACL_ACCESS_DENIED",
      spawn: (_executable, args) => processResult(args.includes("-w") ? 51 : 0)
    },
    {
      expected: "INTERACTION_REQUIRED",
      spawn: (_executable, args) => processResult(args.includes("-w") ? 36 : 0)
    }
  ];
  for (const scenario of scenarios) {
    const classification = classifyCloudflareUnattendedKeychain({
      executionIdentity: "MATCHED",
      keychainLockState: "UNLOCKED",
      spawnSyncImpl: scenario.spawn
    });
    assert.equal(classification.status, "FAIL");
    assert.ok(classification.items.every(item => item.reason === scenario.expected));
  }

  const locked = classifyCloudflareUnattendedKeychain({
    executionIdentity: "MATCHED",
    keychainLockState: "LOCKED",
    spawnSyncImpl: () => processResult(44)
  });
  assert.ok(locked.items.every(item => item.reason === "KEYCHAIN_LOCKED"));

  let executionCalls = 0;
  const mismatch = classifyCloudflareUnattendedKeychain({
    executionIdentity: "MISMATCH",
    keychainLockState: "UNLOCKED",
    spawnSyncImpl: () => {
      executionCalls += 1;
      return processResult(0);
    }
  });
  assert.equal(executionCalls, 0);
  assert.ok(mismatch.items.every(item => item.reason === "EXECUTION_IDENTITY_MISMATCH"));
});

test("timeout is interaction-required and transport ambiguity remains unknown", () => {
  const timeout = classifyCloudflareUnattendedKeychain({
    executionIdentity: "MATCHED",
    keychainLockState: "UNLOCKED",
    spawnSyncImpl: (_executable, args) => args.includes("-w")
      ? processResult(null, Buffer.alloc(0), { error: { code: "ETIMEDOUT" } })
      : processResult(0)
  });
  assert.ok(timeout.items.every(item => item.reason === "INTERACTION_REQUIRED"));

  const unknown = classifyCloudflareUnattendedKeychain({
    executionIdentity: "MATCHED",
    keychainLockState: "UNLOCKED",
    spawnSyncImpl: (_executable, args) => processResult(args.includes("-w") ? 7 : 0)
  });
  assert.ok(unknown.items.every(item => item.reason === "UNKNOWN_FAILURE"));
});

test("launcher adapter accepts only exact item objects and wipes command buffers", () => {
  const buffers = [];
  const adapter = createMacOsKeychainAdapter({
    spawnSyncImpl: (_executable, args) => {
      const stdout = args.includes("-w")
        ? Buffer.from(`${SECRET_FIXTURE}\n`, "utf8")
        : Buffer.alloc(0);
      const stderr = Buffer.from("discard", "utf8");
      buffers.push(stdout, stderr);
      return processResult(0, stdout, { stderr });
    },
    environment: { HOME: "/synthetic" }
  });
  assert.equal(adapter.hasItem(CLOUDFLARE_UNATTENDED_KEYCHAIN_ITEMS[0]), true);
  assert.equal(adapter.readItem(CLOUDFLARE_UNATTENDED_KEYCHAIN_ITEMS[0]), SECRET_FIXTURE);
  assert.ok(buffers.every(buffer => buffer.every(byte => byte === 0)));
});

test("classification evidence is immutable, owner-only, bounded, and secret-free", t => {
  const artifactRoot = tempArtifactRoot(t);
  const result = recordCloudflareUnattendedKeychainClassification({
    artifactRoot,
    classify: () => retrievalClassification(),
    execFile: gitExec,
    now: new Date("2026-07-15T12:00:00.000Z"),
    uuid: () => FIRST_UUID
  });
  assert.equal(result.status, "FAIL");
  const directory = classificationDirectory(artifactRoot);
  const evidencePath = join(directory, "classification.json");
  assert.equal((lstatMode(evidencePath)), 0o600);
  assert.equal((lstatMode(directory)), 0o700);
  assert.doesNotMatch(readFileSync(evidencePath, "utf8"), new RegExp(SECRET_FIXTURE, "u"));
});

test("fresh remediable evidence adds exact ACL trust and verifies all four retrievals", t => {
  const artifactRoot = tempArtifactRoot(t);
  const now = new Date("2026-07-15T12:00:00.000Z");
  recordCloudflareUnattendedKeychainClassification({
    artifactRoot,
    classify: () => retrievalClassification(),
    execFile: gitExec,
    now,
    uuid: () => FIRST_UUID
  });
  const acl = aclHarness();
  const result = remediateCloudflareUnattendedKeychain({
    artifactRoot,
    acl: acl.adapter,
    classify: () => retrievalClassification({ status: "PASS" }),
    confirmation: confirmation(),
    execFile: gitExec,
    now: new Date(now.getTime() + 1_000),
    uuid: () => SECOND_UUID
  });
  assert.deepEqual(result, { status: "PASS", rollbackComplete: true });
  assert.equal(acl.trusted.size, 4);
  assert.equal(readFileSync(join(classificationDirectory(artifactRoot), "consumed.json"), "utf8").includes(FIRST_UUID), true);
});

test("partial remediation rolls back every newly added trust entry", t => {
  const artifactRoot = tempArtifactRoot(t);
  const now = new Date("2026-07-15T12:00:00.000Z");
  recordCloudflareUnattendedKeychainClassification({
    artifactRoot,
    classify: () => retrievalClassification(),
    execFile: gitExec,
    now,
    uuid: () => FIRST_UUID
  });
  const acl = aclHarness({ failGrantAt: 2 });
  const result = remediateCloudflareUnattendedKeychain({
    artifactRoot,
    acl: acl.adapter,
    classify: () => retrievalClassification(),
    confirmation: confirmation(),
    execFile: gitExec,
    now: new Date(now.getTime() + 1_000),
    uuid: () => SECOND_UUID
  });
  assert.deepEqual(result, { status: "FAIL", rollbackComplete: true });
  assert.equal(acl.trusted.size, 0);
  assert.ok(acl.events.some(event => event.startsWith("revoke:")));
});

test("wrong confirmation rejects before evidence, Keychain, or ACL activity", t => {
  const artifactRoot = tempArtifactRoot(t);
  const events = [];
  assert.throws(
    () => remediateCloudflareUnattendedKeychain({
      artifactRoot,
      acl: {
        inspect() { events.push("inspect"); },
        grant() { events.push("grant"); },
        revoke() { events.push("revoke"); }
      },
      confirmation: confirmation(false, events),
      execFile: () => {
        events.push("git");
        return "";
      }
    }),
    /founder_confirmation_rejected/u
  );
  assert.deepEqual(events, ["confirm:repair-unattended-keychain-access"]);
});

test("expired, locked, absent, unknown, and execution-mismatched evidence cannot remediate", t => {
  const cases = [
    { reason: "KEYCHAIN_LOCKED", lock: "LOCKED", presence: "UNKNOWN", execution: "MATCHED" },
    { reason: "ITEM_ABSENT", lock: "UNLOCKED", presence: "ABSENT", execution: "MATCHED" },
    { reason: "UNKNOWN_FAILURE", lock: "UNLOCKED", presence: "PRESENT", execution: "MATCHED" },
    { reason: "EXECUTION_IDENTITY_MISMATCH", lock: "UNLOCKED", presence: "UNKNOWN", execution: "MISMATCH" }
  ];
  for (const [index, fixture] of cases.entries()) {
    const artifactRoot = join(tempArtifactRoot(t), String(index));
    const classification = retrievalClassification({ reason: fixture.reason });
    const adjusted = {
      ...classification,
      executionIdentity: fixture.execution,
      keychainLockState: fixture.lock,
      items: classification.items.map(item => ({
        ...item,
        presence: fixture.presence
      }))
    };
    recordCloudflareUnattendedKeychainClassification({
      artifactRoot,
      classify: () => adjusted,
      execFile: gitExec,
      now: new Date("2026-07-15T12:00:00.000Z"),
      uuid: () => FIRST_UUID
    });
    assert.throws(() => remediateCloudflareUnattendedKeychain({
      artifactRoot,
      confirmation: confirmation(),
      execFile: gitExec,
      now: new Date("2026-07-15T12:01:00.000Z"),
      acl: aclHarness().adapter
    }));
  }
});

test("expired and duplicate fresh attempts fail closed without ACL activity", t => {
  const artifactRoot = tempArtifactRoot(t);
  const base = new Date("2026-07-15T12:00:00.000Z");
  recordCloudflareUnattendedKeychainClassification({
    artifactRoot,
    classify: () => retrievalClassification(),
    execFile: gitExec,
    now: base,
    uuid: () => FIRST_UUID
  });
  const acl = aclHarness();
  assert.throws(() => remediateCloudflareUnattendedKeychain({
    artifactRoot,
    acl: acl.adapter,
    confirmation: confirmation(),
    execFile: gitExec,
    now: new Date(base.getTime() + 31 * 60 * 1_000)
  }));
  assert.equal(acl.events.length, 0);

  const secondRoot = tempArtifactRoot(t);
  recordCloudflareUnattendedKeychainClassification({
    artifactRoot: secondRoot,
    classify: () => retrievalClassification(),
    execFile: gitExec,
    now: base,
    uuid: () => FIRST_UUID
  });
  recordCloudflareUnattendedKeychainClassification({
    artifactRoot: secondRoot,
    classify: () => retrievalClassification(),
    execFile: gitExec,
    now: new Date(base.getTime() + 1_000),
    uuid: () => SECOND_UUID
  });
  assert.throws(() => remediateCloudflareUnattendedKeychain({
    artifactRoot: secondRoot,
    acl: acl.adapter,
    confirmation: confirmation(),
    execFile: gitExec,
    now: new Date(base.getTime() + 2_000)
  }), /classification_evidence_not_unique/u);
});

test("tampering, permission drift, and symlink substitution fail closed", t => {
  const base = new Date("2026-07-15T12:00:00.000Z");
  const artifactRoot = tempArtifactRoot(t);
  recordCloudflareUnattendedKeychainClassification({
    artifactRoot,
    classify: () => retrievalClassification(),
    execFile: gitExec,
    now: base,
    uuid: () => FIRST_UUID
  });
  chmodSync(join(classificationDirectory(artifactRoot), "classification.json"), 0o644);
  assert.throws(() => remediateCloudflareUnattendedKeychain({
    artifactRoot,
    confirmation: confirmation(),
    execFile: gitExec,
    now: new Date(base.getTime() + 1_000),
    acl: aclHarness().adapter
  }), /classification_evidence_not_unique/u);

  const parent = mkdtempSync(join(tmpdir(), "prometheus-keychain-symlink-"));
  t.after(() => rmSync(parent, { force: true, recursive: true }));
  const target = join(parent, "target");
  mkdirSync(target, { mode: 0o700 });
  const linked = join(parent, "linked");
  symlinkSync(target, linked);
  assert.throws(() => recordCloudflareUnattendedKeychainClassification({
    artifactRoot: linked,
    classify: () => retrievalClassification(),
    execFile: gitExec,
    now: base,
    uuid: () => FIRST_UUID
  }), /interoperability_directory_invalid/u);
});

test("successful remediation has one exact rollback and replay is denied", t => {
  const artifactRoot = tempArtifactRoot(t);
  const now = new Date("2026-07-15T12:00:00.000Z");
  recordCloudflareUnattendedKeychainClassification({
    artifactRoot,
    classify: () => retrievalClassification(),
    execFile: gitExec,
    now,
    uuid: () => FIRST_UUID
  });
  const acl = aclHarness();
  remediateCloudflareUnattendedKeychain({
    artifactRoot,
    acl: acl.adapter,
    classify: () => retrievalClassification({ status: "PASS" }),
    confirmation: confirmation(),
    execFile: gitExec,
    now: new Date(now.getTime() + 1_000),
    uuid: () => SECOND_UUID
  });
  const rollbackConfirmation = {
    confirm() { return true; }
  };
  assert.deepEqual(rollbackCloudflareUnattendedKeychainRemediation({
    artifactRoot,
    acl: acl.adapter,
    confirmation: rollbackConfirmation,
    execFile: gitExec,
    now: new Date(now.getTime() + 2_000)
  }), { status: "PASS" });
  assert.equal(acl.trusted.size, 0);
  assert.throws(() => rollbackCloudflareUnattendedKeychainRemediation({
    artifactRoot,
    acl: acl.adapter,
    confirmation: rollbackConfirmation,
    execFile: gitExec,
    now: new Date(now.getTime() + 3_000)
  }), /rollback_evidence_not_unique/u);
});

test("ACL adapter has fixed operations, helper path, aliases, and no output channel", () => {
  const calls = [];
  const adapter = createCloudflareUnattendedAclAdapter({
    spawnSyncImpl(executable, args, options) {
      calls.push({ executable, args, options });
      const operation = args[1];
      return { status: operation === "inspect" ? 10 : operation === "grant" ? 10 : 11 };
    },
    environment: { HOME: "/synthetic", TMPDIR: "/synthetic/tmp" }
  });
  assert.equal(adapter.inspect("DEPLOYMENT_API_TOKEN"), "NOT_TRUSTED");
  assert.equal(adapter.grant("DEPLOYMENT_API_TOKEN"), "ADDED");
  assert.equal(adapter.revoke("DEPLOYMENT_API_TOKEN"), "REMOVED");
  assert.ok(calls.every(call => call.executable === "/usr/bin/swift"));
  assert.ok(calls.every(call => call.options.stdio === "ignore"));
  assert.throws(() => adapter.inspect("ARBITRARY_ITEM"), /acl_operation_denied/u);
});

test("Swift helper typechecks without touching Keychain values", { skip: process.platform !== "darwin" }, () => {
  const result = spawnSync(
    "/usr/bin/swiftc",
    ["-typecheck", "scripts/helpers/cloudflare-unattended-keychain-acl.swift"],
    { cwd: resolve("."), stdio: ["ignore", "ignore", "ignore"] }
  );
  assert.equal(result.status, 0);
});

function lstatMode(path) {
  return statSync(path).mode & 0o777;
}
