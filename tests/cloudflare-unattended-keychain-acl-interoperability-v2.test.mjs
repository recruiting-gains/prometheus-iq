import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import {
  CLOUDFLARE_UNATTENDED_KEYCHAIN_ITEMS
} from "../scripts/lib/cloudflare-unattended-keychain.mjs";
import {
  CLOUDFLARE_UNATTENDED_KEYCHAIN_ACL_V2_ARTIFACT_ROOT,
  CLOUDFLARE_UNATTENDED_KEYCHAIN_ACL_V2_FAILURES,
  CLOUDFLARE_UNATTENDED_KEYCHAIN_ACL_V2_REMEDIATION_PHRASE,
  CLOUDFLARE_UNATTENDED_KEYCHAIN_ACL_V2_VERSION,
  createCloudflareUnattendedAclV2Adapter,
  recordCloudflareUnattendedKeychainAclV2Classification,
  remediateCloudflareUnattendedKeychainAclV2,
  rollbackCloudflareUnattendedKeychainAclV2
} from "../scripts/lib/cloudflare-unattended-keychain-acl-interoperability-v2.mjs";
import {
  verifyNativeKeychainAclV2,
  verifyNativeKeychainAclV2AuthorizationMatrix,
  verifyNativeKeychainAclV2AuthorizationMatrixReverse,
  verifyNativeKeychainAclV2Matrix,
  verifyNativeKeychainAclV2MatrixReverse
} from "../scripts/verify-cloudflare-unattended-keychain-acl-v2-native.mjs";

const HEAD = "a".repeat(40);
const TREE = "b".repeat(40);
const FIRST_UUID = "11111111-1111-4111-8111-111111111111";
const SECOND_UUID = "22222222-2222-4222-8222-222222222222";
const THIRD_UUID = "33333333-3333-4333-8333-333333333333";
const SECRET_FIXTURE = "synthetic-secret-that-must-never-appear";
const ALIASES = CLOUDFLARE_UNATTENDED_KEYCHAIN_ITEMS.map(item => item.alias);

function gitExec(_executable, args) {
  if (args[0] === "rev-parse" && args[1] === "HEAD") return `${HEAD}\n`;
  if (args[0] === "rev-parse" && args[1] === "HEAD^{tree}") return `${TREE}\n`;
  if (args[0] === "status") return "";
  throw new Error(`unexpected_git_call:${args.join(" ")}`);
}

function tempArtifactRoot(t) {
  const parent = mkdtempSync(join(tmpdir(), "prometheus-keychain-acl-v2-"));
  t.after(() => rmSync(parent, { force: true, recursive: true }));
  return join(parent, "artifacts");
}

function classification({ status = "FAIL", reason = "INTERACTION_REQUIRED" } = {}) {
  const passed = status === "PASS";
  return Object.freeze({
    executionIdentity: "MATCHED",
    keychainLockState: "UNLOCKED",
    items: Object.freeze(ALIASES.map(alias => Object.freeze({
      alias,
      presence: "PRESENT",
      retrieval: passed ? "RETRIEVABLE" : "NOT_RETRIEVABLE",
      reason: passed ? "NONE" : reason
    }))),
    status
  });
}

function confirmation(accepted = true, events = []) {
  return Object.freeze({
    confirm(action, phrase) {
      events.push(`confirm:${action}`);
      assert.equal(phrase, CLOUDFLARE_UNATTENDED_KEYCHAIN_ACL_V2_REMEDIATION_PHRASE);
      return accepted;
    }
  });
}

function processResult(status, options = {}) {
  return {
    status,
    error: options.error,
    stdout: Buffer.alloc(0),
    stderr: Buffer.alloc(0)
  };
}

function componentState(retrievalAcl = "MISSING", appleToolPartition = "MISSING") {
  return { retrievalAcl, appleToolPartition };
}

function aclHarness({
  initial,
  failGrantAt = null,
  failRevokeAt = null,
  malformedGrantAt = null,
  postGrantStateAt = null
} = {}) {
  const states = new Map(ALIASES.map(alias => [
    alias,
    { ...(initial?.[alias] || componentState()) }
  ]));
  const events = [];
  let grantCount = 0;
  let revokeCount = 0;
  return {
    events,
    states,
    adapter: Object.freeze({
      inspect(alias) {
        events.push(`inspect:${alias}`);
        return Object.freeze({ ...states.get(alias) });
      },
      grant(alias) {
        grantCount += 1;
        events.push(`grant:${alias}`);
        if (grantCount === failGrantAt) throw new Error("acl_v2_change_failed");
        if (grantCount === malformedGrantAt) {
          return Object.freeze({ retrievalAclAdded: true, appleToolPartitionAdded: false });
        }
        const current = states.get(alias);
        const change = {
          retrievalAclAdded: current.retrievalAcl === "MISSING",
          appleToolPartitionAdded: current.appleToolPartition === "MISSING"
        };
        current.retrievalAcl = "PRESENT";
        current.appleToolPartition = "PRESENT";
        if (grantCount === postGrantStateAt) current.appleToolPartition = "MISSING";
        return Object.freeze(change);
      },
      revoke(alias, change) {
        revokeCount += 1;
        events.push(`revoke:${alias}:${change.retrievalAclAdded}:${change.appleToolPartitionAdded}`);
        if (revokeCount === failRevokeAt) throw new Error("acl_v2_change_failed");
        const current = states.get(alias);
        if (change.retrievalAclAdded) current.retrievalAcl = "MISSING";
        if (change.appleToolPartitionAdded) current.appleToolPartition = "MISSING";
        return "REMOVED";
      }
    })
  };
}

function recordFailure(artifactRoot, options = {}) {
  return recordCloudflareUnattendedKeychainAclV2Classification({
    artifactRoot,
    classify: () => classification(options),
    execFile: gitExec,
    now: new Date("2026-07-15T12:00:00.000Z"),
    uuid: () => FIRST_UUID
  });
}

function remediationOptions(artifactRoot, acl, overrides = {}) {
  return {
    artifactRoot,
    acl,
    classify: () => classification({ status: "PASS" }),
    confirmation: confirmation(),
    execFile: gitExec,
    now: new Date("2026-07-15T12:00:01.000Z"),
    uuid: () => SECOND_UUID,
    ...overrides
  };
}

function attemptDirectory(root, kind, id) {
  return join(root, kind, id);
}

function phaseText(root, id = SECOND_UUID) {
  const directory = attemptDirectory(root, "remediations", id);
  return readdirSync(directory)
    .filter(name => name.endsWith(".phase"))
    .sort()
    .map(name => readFileSync(join(directory, name), "utf8"))
    .join("");
}

test("v2 uses a new evidence namespace and preserves the fixed four-item boundary", () => {
  assert.equal(
    CLOUDFLARE_UNATTENDED_KEYCHAIN_ACL_V2_VERSION,
    "cloudflare-unattended-keychain-acl-interoperability-v2"
  );
  assert.match(CLOUDFLARE_UNATTENDED_KEYCHAIN_ACL_V2_ARTIFACT_ROOT, /interoperability-v2$/u);
  assert.doesNotMatch(CLOUDFLARE_UNATTENDED_KEYCHAIN_ACL_V2_ARTIFACT_ROOT, /interoperability-v1$/u);
  assert.deepEqual(ALIASES, [
    "DEPLOYMENT_API_TOKEN",
    "CLOUDFLARE_ACCOUNT_ID",
    "SMOKE_CLIENT_ID",
    "SMOKE_CLIENT_SECRET"
  ]);
  assert.deepEqual(CLOUDFLARE_UNATTENDED_KEYCHAIN_ACL_V2_FAILURES, [
    "NONE",
    "AUTHORIZATION_SET_INVALID",
    "ACL_HELPER_TIMEOUT",
    "ACL_CHANGE_FAILED",
    "ACL_STATE_MISMATCH",
    "PARTIAL_GRANT",
    "POST_GRANT_INTERACTION_REQUIRED",
    "POST_GRANT_RETRIEVAL_FAILED",
    "ROLLBACK_FAILED"
  ]);
});

test("adapter maps the two independent authorization components without output", () => {
  const statuses = [12, 32, 0, 42];
  const calls = [];
  const adapter = createCloudflareUnattendedAclV2Adapter({
    spawnSyncImpl(executable, args, options) {
      calls.push({ executable, args, options });
      return processResult(statuses.shift());
    },
    environment: { HOME: "/synthetic", TMPDIR: "/synthetic/tmp" }
  });
  assert.deepEqual(adapter.inspect(ALIASES[0]), componentState());
  const change = adapter.grant(ALIASES[0]);
  assert.deepEqual(change, { retrievalAclAdded: true, appleToolPartitionAdded: true });
  assert.deepEqual(adapter.inspect(ALIASES[0]), componentState("PRESENT", "PRESENT"));
  assert.equal(adapter.revoke(ALIASES[0], change), "REMOVED");
  assert.ok(calls.every(call => call.executable === "/usr/bin/swift"));
  assert.ok(calls.every(call => call.options.stdio === "ignore"));
  assert.equal(calls[3].args.at(-1), "both");
});

test("adapter rejects arbitrary items, malformed statuses, and helper timeouts", () => {
  const denied = createCloudflareUnattendedAclV2Adapter({ spawnSyncImpl: () => processResult(0) });
  assert.throws(() => denied.inspect("ARBITRARY"), /acl_v2_operation_denied/u);

  const malformed = createCloudflareUnattendedAclV2Adapter({
    spawnSyncImpl: () => processResult(99)
  });
  assert.throws(() => malformed.inspect(ALIASES[0]), /acl_v2_authorization_set_invalid/u);

  const timedOut = createCloudflareUnattendedAclV2Adapter({
    spawnSyncImpl: () => processResult(null, { error: { code: "ETIMEDOUT" } })
  });
  assert.throws(() => timedOut.inspect(ALIASES[0]), /acl_v2_helper_timeout/u);

  const unprovenRestore = createCloudflareUnattendedAclV2Adapter({
    spawnSyncImpl: () => processResult(24)
  });
  assert.throws(() => unprovenRestore.grant(ALIASES[0]), /acl_v2_rollback_failed/u);
});

test("classification evidence is exclusive, owner-only, bounded, and secret-free", t => {
  const artifactRoot = tempArtifactRoot(t);
  recordFailure(artifactRoot);
  const directory = attemptDirectory(artifactRoot, "classifications", FIRST_UUID);
  const evidence = join(directory, "classification.json");
  assert.equal(lstatSync(artifactRoot).mode & 0o777, 0o700);
  assert.equal(lstatSync(directory).mode & 0o777, 0o700);
  assert.equal(lstatSync(evidence).mode & 0o777, 0o600);
  assert.doesNotMatch(readFileSync(evidence, "utf8"), new RegExp(SECRET_FIXTURE, "u"));
  assert.throws(() => recordFailure(artifactRoot), /EEXIST/u);
});

test("both missing gates are added and all four reads must pass", t => {
  const artifactRoot = tempArtifactRoot(t);
  recordFailure(artifactRoot);
  const acl = aclHarness();
  const result = remediateCloudflareUnattendedKeychainAclV2(
    remediationOptions(artifactRoot, acl.adapter)
  );
  assert.deepEqual(result, { status: "PASS", rollbackComplete: true, reason: "NONE" });
  assert.ok([...acl.states.values()].every(state => (
    state.retrievalAcl === "PRESENT" && state.appleToolPartition === "PRESENT"
  )));
  const phases = phaseText(artifactRoot);
  assert.match(phases, /DEPLOYMENT_API_TOKEN_RETRIEVAL_ACL_ADDED/u);
  assert.match(phases, /DEPLOYMENT_API_TOKEN_APPLE_TOOL_PARTITION_ADDED/u);
  assert.match(phases, /RETRIEVAL_VERIFIED/u);
});

test("pre-existing retrieval trust adds only partition authorization", t => {
  const artifactRoot = tempArtifactRoot(t);
  recordFailure(artifactRoot);
  const initial = Object.fromEntries(ALIASES.map(alias => [
    alias,
    componentState("PRESENT", "MISSING")
  ]));
  const acl = aclHarness({ initial });
  const result = remediateCloudflareUnattendedKeychainAclV2(
    remediationOptions(artifactRoot, acl.adapter)
  );
  assert.equal(result.status, "PASS");
  const summary = JSON.parse(readFileSync(
    join(attemptDirectory(artifactRoot, "remediations", SECOND_UUID), "summary.json"),
    "utf8"
  ));
  assert.ok(summary.changes.every(change => (
    change.retrievalAclAdded === false && change.appleToolPartitionAdded === true
  )));
});

test("pre-existing partition authorization adds only minimal retrieval ACL", t => {
  const artifactRoot = tempArtifactRoot(t);
  recordFailure(artifactRoot);
  const initial = Object.fromEntries(ALIASES.map(alias => [
    alias,
    componentState("MISSING", "PRESENT")
  ]));
  const acl = aclHarness({ initial });
  const result = remediateCloudflareUnattendedKeychainAclV2(
    remediationOptions(artifactRoot, acl.adapter)
  );
  assert.equal(result.status, "PASS");
  const summary = JSON.parse(readFileSync(
    join(attemptDirectory(artifactRoot, "remediations", SECOND_UUID), "summary.json"),
    "utf8"
  ));
  assert.ok(summary.changes.every(change => (
    change.retrievalAclAdded === true && change.appleToolPartitionAdded === false
  )));
});

test("authorization-state mismatch fails closed before adding authorization", t => {
  const artifactRoot = tempArtifactRoot(t);
  recordFailure(artifactRoot);
  const initial = Object.fromEntries(ALIASES.map(alias => [
    alias,
    componentState("PRESENT", "PRESENT")
  ]));
  const acl = aclHarness({ initial });
  const result = remediateCloudflareUnattendedKeychainAclV2(
    remediationOptions(artifactRoot, acl.adapter)
  );
  assert.deepEqual(result, {
    status: "FAIL",
    rollbackComplete: true,
    reason: "ACL_STATE_MISMATCH"
  });
  assert.equal(acl.events.some(event => event.startsWith("grant:")), false);
});

for (const boundary of [1, 2, 3, 4]) {
  test(`partial grant at item ${boundary} rolls back every earlier change in reverse`, t => {
    const artifactRoot = tempArtifactRoot(t);
    recordFailure(artifactRoot);
    const acl = aclHarness({ failGrantAt: boundary });
    const result = remediateCloudflareUnattendedKeychainAclV2(
      remediationOptions(artifactRoot, acl.adapter)
    );
    assert.equal(result.status, "FAIL");
    assert.equal(result.rollbackComplete, true);
    assert.ok([...acl.states.values()].every(state => (
      state.retrievalAcl === "MISSING" && state.appleToolPartition === "MISSING"
    )));
    const revoked = acl.events.filter(event => event.startsWith("revoke:"));
    assert.deepEqual(
      revoked.map(event => event.split(":")[1]),
      ALIASES.slice(0, boundary - 1).reverse()
    );
  });
}

test("malformed partial grant result is rejected and prior changes rollback", t => {
  const artifactRoot = tempArtifactRoot(t);
  recordFailure(artifactRoot);
  const acl = aclHarness({ malformedGrantAt: 2 });
  const result = remediateCloudflareUnattendedKeychainAclV2(
    remediationOptions(artifactRoot, acl.adapter)
  );
  assert.equal(result.status, "FAIL");
  assert.equal(result.reason, "PARTIAL_GRANT");
  assert.equal(result.rollbackComplete, true);
});

test("post-grant component loss fails closed and rolls back", t => {
  const artifactRoot = tempArtifactRoot(t);
  recordFailure(artifactRoot);
  const acl = aclHarness({ postGrantStateAt: 2 });
  const result = remediateCloudflareUnattendedKeychainAclV2(
    remediationOptions(artifactRoot, acl.adapter)
  );
  assert.equal(result.status, "FAIL");
  assert.equal(result.reason, "PARTIAL_GRANT");
  assert.equal(result.rollbackComplete, true);
});

test("post-grant interaction-required classification rolls back all changes", t => {
  const artifactRoot = tempArtifactRoot(t);
  recordFailure(artifactRoot);
  const acl = aclHarness();
  const result = remediateCloudflareUnattendedKeychainAclV2(remediationOptions(
    artifactRoot,
    acl.adapter,
    { classify: () => classification() }
  ));
  assert.deepEqual(result, {
    status: "FAIL",
    rollbackComplete: true,
    reason: "POST_GRANT_INTERACTION_REQUIRED"
  });
  assert.ok([...acl.states.values()].every(state => (
    state.retrievalAcl === "MISSING" && state.appleToolPartition === "MISSING"
  )));
});

test("rollback failure is explicit and never reported as complete", t => {
  const artifactRoot = tempArtifactRoot(t);
  recordFailure(artifactRoot);
  const acl = aclHarness({ failRevokeAt: 1 });
  const result = remediateCloudflareUnattendedKeychainAclV2(remediationOptions(
    artifactRoot,
    acl.adapter,
    { classify: () => classification() }
  ));
  assert.deepEqual(result, {
    status: "FAIL",
    rollbackComplete: false,
    reason: "ROLLBACK_FAILED"
  });
  assert.match(phaseText(artifactRoot), /ROLLBACK_FAILED|REMEDIATION_FAIL/u);
});

test("an unproven current-item restore is never reported as rollback complete", t => {
  const artifactRoot = tempArtifactRoot(t);
  recordFailure(artifactRoot);
  const acl = Object.freeze({
    inspect: () => componentState(),
    grant: () => { throw new Error("acl_v2_rollback_failed"); },
    revoke: () => { throw new Error("unexpected_revoke"); }
  });
  assert.deepEqual(remediateCloudflareUnattendedKeychainAclV2(
    remediationOptions(artifactRoot, acl)
  ), {
    status: "FAIL",
    rollbackComplete: false,
    reason: "ROLLBACK_FAILED"
  });
});

for (const rollbackBoundary of [1, 2, 3, 4]) {
  test(`rollback failure at reverse boundary ${rollbackBoundary} remains explicit`, t => {
    const artifactRoot = tempArtifactRoot(t);
    recordFailure(artifactRoot);
    const acl = aclHarness({ failRevokeAt: rollbackBoundary });
    const result = remediateCloudflareUnattendedKeychainAclV2(remediationOptions(
      artifactRoot,
      acl.adapter,
      { classify: () => classification() }
    ));
    assert.equal(result.status, "FAIL");
    assert.equal(result.reason, "ROLLBACK_FAILED");
    assert.equal(result.rollbackComplete, false);
    assert.equal(acl.events.filter(event => event.startsWith("revoke:")).length, 4);
  });
}

test("expired and abandoned evidence cannot be replayed", t => {
  const artifactRoot = tempArtifactRoot(t);
  recordFailure(artifactRoot);
  const acl = aclHarness();
  assert.throws(() => remediateCloudflareUnattendedKeychainAclV2(
    remediationOptions(artifactRoot, acl.adapter, {
      now: new Date("2026-07-15T12:31:00.000Z")
    })
  ), /acl_v2_classification_not_unique/u);
  assert.equal(acl.events.length, 0);
});

test("simultaneous eligible classifications fail closed without choosing one", t => {
  const artifactRoot = tempArtifactRoot(t);
  recordFailure(artifactRoot);
  recordCloudflareUnattendedKeychainAclV2Classification({
    artifactRoot,
    classify: () => classification(),
    execFile: gitExec,
    now: new Date("2026-07-15T12:00:00.000Z"),
    uuid: () => THIRD_UUID
  });
  const acl = aclHarness();
  assert.throws(() => remediateCloudflareUnattendedKeychainAclV2(
    remediationOptions(artifactRoot, acl.adapter)
  ), /acl_v2_classification_not_unique/u);
  assert.equal(acl.events.length, 0);
});

test("cross-attempt classification substitution is ineligible", t => {
  const artifactRoot = tempArtifactRoot(t);
  recordFailure(artifactRoot);
  const path = join(
    attemptDirectory(artifactRoot, "classifications", FIRST_UUID),
    "classification.json"
  );
  const evidence = JSON.parse(readFileSync(path, "utf8"));
  evidence.attemptId = THIRD_UUID;
  writeFileSync(path, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  const acl = aclHarness();
  assert.throws(() => remediateCloudflareUnattendedKeychainAclV2(
    remediationOptions(artifactRoot, acl.adapter)
  ), /acl_v2_classification_not_unique/u);
  assert.equal(acl.events.length, 0);
});

test("tampering, wrong permissions, and symlinks make evidence ineligible", t => {
  for (const [index, tamper] of [
    path => writeFileSync(path, "{}\n", "utf8"),
    path => chmodSync(path, 0o644),
    path => {
      rmSync(path);
      symlinkSync("missing.json", path);
    }
  ].entries()) {
    const artifactRoot = join(tempArtifactRoot(t), String(index));
    recordFailure(artifactRoot);
    tamper(join(attemptDirectory(artifactRoot, "classifications", FIRST_UUID), "classification.json"));
    const acl = aclHarness();
    assert.throws(() => remediateCloudflareUnattendedKeychainAclV2(
      remediationOptions(artifactRoot, acl.adapter)
    ), /acl_v2_classification_not_unique/u);
    assert.equal(acl.events.length, 0);
  }
});

test("wrong or redirected-style confirmation rejects before Git, evidence, or ACL access", () => {
  const events = [];
  assert.throws(() => remediateCloudflareUnattendedKeychainAclV2({
    confirmation: confirmation(false, events),
    execFile: () => {
      events.push("git");
      return "";
    },
    acl: {
      inspect() { events.push("inspect"); },
      grant() { events.push("grant"); },
      revoke() { events.push("revoke"); }
    }
  }), /founder_confirmation_rejected/u);
  assert.deepEqual(events, ["confirm:repair-unattended-keychain-acl-v2"]);
});

test("redirected CLI input fails before classification evidence or ACL access", t => {
  const home = mkdtempSync(join(tmpdir(), "prometheus-keychain-acl-v2-redirected-"));
  t.after(() => rmSync(home, { force: true, recursive: true }));
  const result = spawnSync(
    process.execPath,
    ["scripts/run-cloudflare-unattended-keychain-acl-interoperability-v2.mjs", "remediate"],
    {
      cwd: resolve("."),
      encoding: "utf8",
      env: { ...process.env, HOME: home },
      input: `${CLOUDFLARE_UNATTENDED_KEYCHAIN_ACL_V2_REMEDIATION_PHRASE}\n`
    }
  );
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "FAIL\n");
  assert.equal(result.stderr, "");
  assert.equal(readdirSync(home).length, 0);
});

test("successful remediation supports one evidence-bound reverse rollback", t => {
  const artifactRoot = tempArtifactRoot(t);
  recordFailure(artifactRoot);
  const acl = aclHarness();
  assert.equal(remediateCloudflareUnattendedKeychainAclV2(
    remediationOptions(artifactRoot, acl.adapter)
  ).status, "PASS");
  const rollbackEvents = [];
  const result = rollbackCloudflareUnattendedKeychainAclV2({
    artifactRoot,
    acl: acl.adapter,
    confirmation: Object.freeze({
      confirm(action) {
        rollbackEvents.push(action);
        return true;
      }
    }),
    execFile: gitExec,
    now: new Date("2026-07-15T12:02:00.000Z")
  });
  assert.deepEqual(result, { status: "PASS" });
  assert.deepEqual(rollbackEvents, ["rollback-unattended-keychain-acl-v2"]);
  assert.ok([...acl.states.values()].every(state => (
    state.retrievalAcl === "MISSING" && state.appleToolPartition === "MISSING"
  )));
  assert.throws(() => rollbackCloudflareUnattendedKeychainAclV2({
    artifactRoot,
    acl: acl.adapter,
    confirmation: { confirm: () => true },
    execFile: gitExec
  }), /acl_v2_rollback_not_unique/u);
});

test("helper source is strict, minimal, and never reads or changes values", () => {
  const source = readFileSync(
    resolve("scripts/helpers/cloudflare-unattended-keychain-acl-v2.swift"),
    "utf8"
  );
  assert.match(source, /trustedExecutable = "\/usr\/bin\/security"/u);
  assert.match(source, /requiredPartition = "apple-tool:"/u);
  assert.match(source, /kSecACLAuthorizationDecrypt/u);
  assert.match(source, /kSecACLAuthorizationPartitionID/u);
  assert.doesNotMatch(source, /kSecACLAuthorizationExportClear/u);
  assert.match(source, /rights == requiredRights/u);
  assert.match(source, /Set\(dictionary\.keys\) == Set\(\["Partitions"\]\)/u);
  assert.match(source, /rights == requiredRights/u);
  assert.match(source, /applications\.count == 1/u);
  assert.match(source, /restoreGrant/u);
  assert.match(source, /restoreRevocation/u);
  assert.match(source, /guard let applications = contents\.applications/u);
  assert.match(source, /trustedRetrievalACLs\.count <= 1/u);
  assert.match(source, /partitionACLs\.count == 1/u);
  assert.doesNotMatch(source, /SecItemAdd|SecItemDelete|SecItemUpdate|ModifyContent/u);
  assert.doesNotMatch(source, /print\(|FileHandle\.standardOutput/u);
});

test("Swift helper typechecks without Keychain access", { skip: process.platform !== "darwin" }, () => {
  const result = spawnSync(
    "/usr/bin/swiftc",
    ["-typecheck", "scripts/helpers/cloudflare-unattended-keychain-acl-v2.swift"],
    { cwd: resolve("."), stdio: ["ignore", "ignore", "ignore"] }
  );
  assert.equal(result.status, 0);
});

test("native macOS fixture proves apple-tool retrieval and removes its synthetic item", {
  skip: process.platform !== "darwin"
}, () => {
  assert.deepEqual(verifyNativeKeychainAclV2({
    uuid: () => "44444444-5555-4666-8777-888888888888"
  }), { status: "PASS" });
});

test("native fixture keeps the SecItemAdd result reference and reports only fixed setup states", () => {
  const fixture = readFileSync(
    resolve("scripts/helpers/cloudflare-unattended-keychain-acl-v2-native-fixture.swift"),
    "utf8"
  );
  const verifier = readFileSync(
    resolve("scripts/verify-cloudflare-unattended-keychain-acl-v2-native.mjs"),
    "utf8"
  );
  assert.match(fixture, /kSecReturnRef/u);
  assert.match(fixture, /SecKeychainCreate/u);
  assert.match(fixture, /SecKeychainDelete/u);
  assert.match(fixture, /kSecUseKeychain as String: keychain/u);
  assert.match(fixture, /keychainPathsDisappearWithinBound/u);
  assert.match(fixture, /POSITIVE_READ_STARTED/u);
  assert.match(fixture, /RESTORE_VALIDATED/u);
  assert.match(fixture, /MATRIX_APPLE_TOOL_ONLY/u);
  assert.match(fixture, /MATRIX_APPLE_ONLY/u);
  assert.match(fixture, /MATRIX_APPLE_TOOL_PLUS_APPLE/u);
  assert.match(fixture, /MATRIX_DECRYPT_ONLY/u);
  assert.match(fixture, /MATRIX_EXPORT_CLEAR_ONLY/u);
  assert.match(fixture, /MATRIX_DECRYPT_PLUS_EXPORT_CLEAR/u);
  assert.match(fixture, /kSecACLAuthorizationExportClear/u);
  assert.match(fixture, /syntheticOnlyExecutable = CommandLine\.arguments\.first/u);
  assert.match(fixture, /kSecAttrAccess as String: access/u);
  assert.match(fixture, /itemCreateFailureExitCode/u);
  assert.doesNotMatch(fixture, /SecKeychainSetUserInteractionAllowed/u);
  assert.match(fixture, /SecKeychainCopyDomainSearchList/u);
  assert.match(fixture, /SecKeychainCopyDomainDefault/u);
  assert.match(fixture, /SecKeychainGetPath/u);
  assert.match(fixture, /\[syntheticOnlyApplication, helperApplication\] as CFArray/u);
  assert.match(fixture, /kSecACLAuthorizationChangeACL/u);
  assert.match(fixture, /verifyInitialAdministrativeACL/u);
  assert.match(fixture, /waitForBoundedExit/u);
  assert.match(fixture, /findPersistedSyntheticItem/u);
  assert.doesNotMatch(fixture, /SecKeychainItemSetAccess/u);
  assert.doesNotMatch(fixture, /print\(|FileHandle\.standardOutput/u);
  assert.doesNotMatch(fixture, /\/usr\/bin\/true/u);
  assert.match(verifier, /ITEM_CREATE_INTERACTION_DISALLOWED/u);
  assert.match(verifier, /fixture\.keychain-db/u);
  assert.match(verifier, /if \(primaryError\) throw primaryError/u);
  assert.match(verifier, /native_fixture_timeout_after_\$\{timeoutPhase\(phasePath\)\}/u);
  assert.match(verifier, /USER_KEYCHAIN_SELECTION_CHANGED/u);
  assert.match(verifier, /HELPER_GRANT_FAILED_OR_TIMEOUT/u);
  assert.match(verifier, /SUSPICIOUS_COMBINATION_ONLY/u);
  assert.match(verifier, /SUSPICIOUS_APPLE_ONLY_PASS/u);
  assert.match(verifier, /process\.exitCode = 1/u);
  assert.equal(typeof verifyNativeKeychainAclV2Matrix, "function");
  assert.equal(typeof verifyNativeKeychainAclV2MatrixReverse, "function");
  assert.equal(typeof verifyNativeKeychainAclV2AuthorizationMatrix, "function");
  assert.equal(typeof verifyNativeKeychainAclV2AuthorizationMatrixReverse, "function");
  assert.doesNotMatch(verifier, /list-keychains|default-keychain/u);
});

test("all evidence remains fixed-vocabulary and secret-free", t => {
  const artifactRoot = tempArtifactRoot(t);
  recordFailure(artifactRoot);
  const acl = aclHarness();
  remediateCloudflareUnattendedKeychainAclV2(remediationOptions(
    artifactRoot,
    acl.adapter,
    { classify: () => classification() }
  ));
  const files = [];
  const visit = directory => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else files.push(path);
    }
  };
  visit(artifactRoot);
  for (const path of files) {
    assert.doesNotMatch(readFileSync(path, "utf8"), new RegExp(SECRET_FIXTURE, "u"));
  }
});
