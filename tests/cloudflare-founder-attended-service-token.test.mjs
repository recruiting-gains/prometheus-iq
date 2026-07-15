import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  constants,
  existsSync,
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
  ATTENDED_KEYCHAIN_ITEMS,
  CLOUDFLARE_SECRET_KEYCHAIN_ITEM_REGISTRY,
  KEYCHAIN_ITEMS,
  LOCAL_SECRET_ARTIFACT_CANDIDATES,
  scanTextForCloudflareSecrets
} from "../scripts/check-cloudflare-unattended-secret-presence.mjs";
import {
  CLOUDFLARE_FOUNDER_ATTENDED_CONTROL_MAX_LIFETIME_MS,
  CLOUDFLARE_FOUNDER_ATTENDED_CONTROL_SCHEMA,
  consumeFounderAttendedControl,
  createFounderAttendedControl,
  defaultFounderAttendedControl,
  inspectFounderAttendedControl,
  validateFounderAttendedControl
} from "../scripts/lib/cloudflare-founder-attended-control.mjs";
import {
  CLOUDFLARE_FOUNDER_ATTENDED_KEYCHAIN_HELPER,
  CLOUDFLARE_FOUNDER_ATTENDED_KEYCHAIN_ITEMS,
  createFounderAttendedMacOsKeychain,
  formatFounderAttendedKeychainPresence,
  founderAttendedKeychainPresence
} from "../scripts/lib/cloudflare-founder-attended-keychain.mjs";
import {
  CLOUDFLARE_FOUNDER_ATTENDED_ACCOUNT_ID_SHA256,
  CLOUDFLARE_FOUNDER_ATTENDED_ACCOUNT_ID_SHA256_ALLOWLIST,
  CLOUDFLARE_FOUNDER_ATTENDED_API_ORIGIN,
  CLOUDFLARE_FOUNDER_ATTENDED_API_PATH_TEMPLATE,
  CLOUDFLARE_FOUNDER_ATTENDED_COMPENSATED_ERROR,
  CLOUDFLARE_FOUNDER_ATTENDED_CONFIRMATIONS,
  CLOUDFLARE_FOUNDER_ATTENDED_CREATE_BODY,
  CLOUDFLARE_FOUNDER_ATTENDED_DIRECTIVE,
  CLOUDFLARE_FOUNDER_ATTENDED_LIVE_STATE_ERROR,
  CLOUDFLARE_FOUNDER_ATTENDED_MANUAL_REVIEW_ERROR,
  CLOUDFLARE_FOUNDER_ATTENDED_SERVICE_TOKEN_DURATION,
  CLOUDFLARE_FOUNDER_ATTENDED_SERVICE_TOKEN_NAME,
  CLOUDFLARE_FOUNDER_ATTENDED_TEMPORARY_TOKEN_MAX_TTL_HOURS,
  CLOUDFLARE_FOUNDER_ATTENDED_TEMPORARY_TOKEN_PERMISSION,
  cleanupFounderAttendedTemporaryTokenTestOnly,
  inspectFounderAttendedPresenceTestOnly,
  provisionFounderAttendedServiceTokenTestOnly,
  validateGovernedCloudflareAccountId
} from "../scripts/lib/cloudflare-founder-attended-service-token.mjs";
import {
  CLOUDFLARE_FOUNDER_ATTENDED_COMMANDS,
  cleanupFounderAttendedTemporaryToken,
  inspectFounderAttendedPresence,
  provisionFounderAttendedServiceToken,
  runFounderAttendedServiceTokenProductionCli
} from "../scripts/lib/cloudflare-founder-attended-service-token-production.mjs";
import {
  createControllingTtyConfirmation,
  createControllingTtyConfirmationTestOnly
} from "../scripts/lib/cloudflare-founder-attended-tty.mjs";
import { parseStrictJson } from "../scripts/lib/strict-json.mjs";
import {
  CLOUDFLARE_UNATTENDED_LAUNCH_PROFILES,
  createMacOsKeychainAdapter,
  runCloudflareUnattendedLauncher
} from "../scripts/lib/cloudflare-unattended-launcher.mjs";

const root = resolve(import.meta.dirname, "..");
const now = new Date("2026-07-14T20:00:00.000Z");
const repositoryIdentity = Object.freeze({
  commit: "a".repeat(40),
  tree: "b".repeat(40),
  clean: true
});
const fixtureAccountId = "fedcba9876543210fedcba9876543210";
const fixtureAccountDigest = createHash("sha256").update(fixtureAccountId).digest("hex");
const fixtureApiToken = "synthetic-temporary-api-token-value-0001";
const fixtureClientId = `${"c".repeat(32)}.access`;
const fixtureClientSecret = "synthetic-client-secret-value-0001";
const fixtureTokenId = "synthetic-service-token-id-0001";
const createdAt = "2026-07-14T20:00:01.000Z";
const expiresAt = new Date(Date.parse(createdAt) + 720 * 60 * 60 * 1000).toISOString();

function confirmation(allowed = true) {
  const calls = [];
  return {
    calls,
    confirm(action, phrase) {
      calls.push({ action, phrase });
      return allowed;
    }
  };
}

function ttyStat(characterDevice, rdev) {
  return {
    rdev,
    isCharacterDevice() {
      return characterDevice;
    }
  };
}

function createMockControllingTty({
  inputIsTTY = true,
  outputIsTTY = true,
  inputCharacterDevice = true,
  outputCharacterDevice = true,
  ttyCharacterDevice = true,
  inputRdev = 101,
  outputRdev = inputRdev,
  ttyRdev = 202,
  response = "",
  openError = null
} = {}) {
  const inputFd = 10;
  const outputFd = 11;
  const ttyFd = 12;
  const responseBytes = Buffer.from(response, "utf8");
  let responseOffset = 0;
  const calls = {
    opens: [],
    stats: [],
    writes: [],
    reads: [],
    closes: []
  };
  const operations = {
    openSync(path, flags) {
      calls.opens.push({ path, flags });
      if (openError) throw openError;
      return ttyFd;
    },
    fstatSync(fd) {
      calls.stats.push(fd);
      if (fd === inputFd) return ttyStat(inputCharacterDevice, inputRdev);
      if (fd === outputFd) return ttyStat(outputCharacterDevice, outputRdev);
      if (fd === ttyFd) return ttyStat(ttyCharacterDevice, ttyRdev);
      throw new Error("synthetic_unknown_tty_fd");
    },
    writeSync(fd, buffer, offset, length) {
      calls.writes.push({
        fd,
        value: Buffer.from(buffer.subarray(offset, offset + length)).toString("utf8")
      });
      return length;
    },
    readSync(fd, buffer, offset) {
      calls.reads.push(fd);
      if (responseOffset >= responseBytes.length) return 0;
      buffer[offset] = responseBytes[responseOffset];
      responseOffset += 1;
      return 1;
    },
    closeSync(fd) {
      calls.closes.push(fd);
    }
  };
  return {
    confirmation: createControllingTtyConfirmationTestOnly({
      input: { isTTY: inputIsTTY, fd: inputFd },
      output: { isTTY: outputIsTTY, fd: outputFd },
      ttyPath: "/dev/tty",
      operations
    }),
    calls,
    fds: { inputFd, outputFd, ttyFd }
  };
}

function assertNoKeychainActivity(keychain) {
  assert.deepEqual(keychain.calls, {
    presence: [],
    reads: [],
    adds: [],
    deletes: [],
    ownershipTags: []
  });
}

function runBoundedPtyIntegration(executable, args) {
  const timeoutMs = 8_000;
  const maximumOutputBytes = 1024 * 1024;
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(executable, args, {
      cwd: root,
      detached: true,
      env: {
        HOME: tmpdir(),
        LANG: "C",
        LC_ALL: "C",
        PATH: "/usr/bin:/bin",
        TERM: "xterm-256color",
        TMPDIR: tmpdir()
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
    const stdoutChunks = [];
    const stderrChunks = [];
    let outputBytes = 0;
    let forcedReason = null;
    let settled = false;

    const capturedStdout = () => Buffer.concat(stdoutChunks).toString("utf8");
    const terminate = reason => {
      if (forcedReason !== null) return;
      forcedReason = reason;
      const pidMatch = capturedStdout().match(/PROMETHEUS_EXPECT_CHILD_PID=(\d+)/u);
      if (pidMatch) {
        try {
          process.kill(Number(pidMatch[1]), "SIGKILL");
        } catch {
          // The PTY child may already have exited and been reaped by Expect.
        }
      }
      if (Number.isInteger(child.pid)) {
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch {
          try {
            child.kill("SIGKILL");
          } catch {
            // The detached Expect process may already have exited.
          }
        }
      }
    };
    const capture = destination => chunk => {
      if (forcedReason !== null) return;
      const remaining = maximumOutputBytes - outputBytes;
      if (chunk.length > remaining) {
        if (remaining > 0) destination.push(Buffer.from(chunk.subarray(0, remaining)));
        outputBytes += chunk.length;
        terminate("output_limit");
        return;
      }
      outputBytes += chunk.length;
      destination.push(Buffer.from(chunk));
    };
    child.stdout.on("data", capture(stdoutChunks));
    child.stderr.on("data", capture(stderrChunks));

    const timer = setTimeout(() => terminate("timeout"), timeoutMs);
    child.once("error", error => {
      clearTimeout(timer);
      terminate("spawn_error");
      if (settled) return;
      settled = true;
      rejectRun(error);
    });
    child.once("close", (status, signal) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      resolveRun({
        command: [executable, ...args],
        outputLimitExceeded: forcedReason === "output_limit",
        signal,
        status,
        stderr: Buffer.concat(stderrChunks).toString("utf8"),
        stdout: capturedStdout(),
        timedOut: forcedReason === "timeout"
      });
    });
  });
}

function createMockKeychain({
  accountId = fixtureAccountId,
  apiToken = fixtureApiToken,
  smokeClientId,
  smokeClientSecret,
  missing = [],
  addHook,
  deleteHook,
  readHook
} = {}) {
  const values = new Map();
  const owners = new Map();
  if (!missing.includes("governedAccountId")) values.set("governedAccountId", Buffer.from(accountId));
  if (!missing.includes("temporaryApiToken")) values.set("temporaryApiToken", Buffer.from(apiToken));
  if (smokeClientId !== undefined) {
    values.set("smokeClientId", Buffer.from(smokeClientId));
    owners.set("smokeClientId", "preexisting");
  }
  if (smokeClientSecret !== undefined) {
    values.set("smokeClientSecret", Buffer.from(smokeClientSecret));
    owners.set("smokeClientSecret", "preexisting");
  }
  const calls = { presence: [], reads: [], adds: [], deletes: [], ownershipTags: [] };
  return {
    values,
    owners,
    calls,
    hasItem(key) {
      calls.presence.push(key);
      return values.has(key);
    },
    readItem(key) {
      calls.reads.push(key);
      if (readHook) readHook({ key, values, owners });
      if (!values.has(key)) throw new Error("synthetic-read-failure");
      return Buffer.from(values.get(key));
    },
    addItem(key, value, ownershipTag) {
      calls.adds.push(key);
      calls.ownershipTags.push(ownershipTag);
      if (addHook) addHook({ key, value, values, owners, ownershipTag });
      if (!values.has(key)) values.set(key, Buffer.from(value));
      if (!owners.has(key)) owners.set(key, ownershipTag);
      return { created: true };
    },
    deleteItem(key) {
      calls.deletes.push(key);
      if (deleteHook) deleteHook({ key, values, owners, owned: false });
      else {
        values.delete(key);
        owners.delete(key);
      }
    },
    deleteOwnedItem(key, ownershipTag) {
      calls.deletes.push(key);
      if (deleteHook) deleteHook({ key, values, owners, owned: true, ownershipTag });
      if (owners.get(key) === ownershipTag) {
        values.delete(key);
        owners.delete(key);
        return { deleted: true };
      }
      return { deleted: false };
    }
  };
}

function listResponse(entries = []) {
  return {
    status: 200,
    body: JSON.stringify({
      success: true,
      errors: [],
      messages: [],
      result: entries,
      result_info: {
        page: 1,
        per_page: 20,
        count: entries.length,
        total_count: entries.length,
        total_pages: 1
      }
    })
  };
}

function createResponse(overrides = {}, envelopeOverrides = {}) {
  return {
    status: 200,
    body: JSON.stringify({
      success: true,
      errors: [],
      messages: [],
      result: {
        id: fixtureTokenId,
        name: CLOUDFLARE_FOUNDER_ATTENDED_SERVICE_TOKEN_NAME,
        duration: CLOUDFLARE_FOUNDER_ATTENDED_SERVICE_TOKEN_DURATION,
        client_id: fixtureClientId,
        client_secret: fixtureClientSecret,
        created_at: createdAt,
        expires_at: expiresAt,
        ...overrides
      },
      ...envelopeOverrides
    })
  };
}

function deleteResponse(tokenId = fixtureTokenId) {
  return {
    status: 200,
    body: JSON.stringify({
      success: true,
      errors: [],
      messages: [],
      result: { id: tokenId }
    })
  };
}

function createMockTransport({
  get = listResponse(),
  post = createResponse(),
  delete: deleteResult = deleteResponse(),
  onRequest
} = {}) {
  const requests = [];
  const responses = { GET: get, POST: post, DELETE: deleteResult };
  return {
    requests,
    async request(specification) {
      requests.push(specification);
      if (onRequest) onRequest(specification, requests.length);
      const response = responses[specification.method];
      if (response instanceof Error) throw response;
      if (typeof response === "function") return response(specification);
      return response;
    }
  };
}

function createHarness(options = {}) {
  const directory = mkdtempSync(join(tmpdir(), "prometheus-founder-attended-"));
  const controlPath = join(directory, "control.json");
  if (options.precreateControl) {
    createFounderAttendedControl({
      controlPath,
      now: options.controlIssuedAt ?? now,
      repositoryIdentity: options.controlRepositoryIdentity ?? repositoryIdentity,
      accountIdSha256: fixtureAccountDigest,
      randomBytesImpl: () => Buffer.alloc(32, options.nonceByte ?? 7)
    });
  }
  const keychain = options.keychain ?? createMockKeychain(options.keychainOptions);
  const transport = options.transport ?? createMockTransport(options.transportOptions);
  const clock = options.clock ?? (() => new Date(now));
  const repositoryReader = options.repositoryReader ?? (() => repositoryIdentity);
  return {
    directory,
    controlPath,
    receiptDirectory: `${controlPath}.consumed`,
    keychain,
    transport,
    clock,
    repositoryReader,
    cleanup() {
      rmSync(directory, { recursive: true, force: true });
    },
    provision(overrides = {}) {
      return provisionFounderAttendedServiceTokenTestOnly({
        controlPath,
        confirmation: overrides.confirmation ?? confirmation(),
        keychain,
        transport,
        clock,
        repositoryReader,
        accountIdSha256Allowlist: [fixtureAccountDigest],
        randomBytesImpl: () => Buffer.alloc(32, options.nonceByte ?? 7),
        expectedUid: process.getuid(),
        ...overrides
      });
    }
  };
}

function methodCount(transport, method) {
  return transport.requests.filter(request => request.method === method).length;
}

test("fixed constants match the exact directive, account, endpoint, name, and duration", () => {
  assert.equal(
    CLOUDFLARE_FOUNDER_ATTENDED_DIRECTIVE,
    "Cloudflare Founder-Attended 30-Day Access Service Token Provisioning v1"
  );
  assert.equal(CLOUDFLARE_FOUNDER_ATTENDED_API_ORIGIN, "https://api.cloudflare.com");
  assert.equal(
    CLOUDFLARE_FOUNDER_ATTENDED_API_PATH_TEMPLATE,
    "/client/v4/accounts/{account_id}/access/service_tokens"
  );
  assert.equal(
    CLOUDFLARE_FOUNDER_ATTENDED_SERVICE_TOKEN_NAME,
    "Prometheus Overwatch Read-Only Smoke Verification"
  );
  assert.equal(CLOUDFLARE_FOUNDER_ATTENDED_SERVICE_TOKEN_DURATION, "720h");
  assert.deepEqual(CLOUDFLARE_FOUNDER_ATTENDED_CREATE_BODY, {
    name: CLOUDFLARE_FOUNDER_ATTENDED_SERVICE_TOKEN_NAME,
    duration: "720h"
  });
  assert.equal(CLOUDFLARE_FOUNDER_ATTENDED_TEMPORARY_TOKEN_PERMISSION, "Access: Service Tokens Write");
  assert.equal(CLOUDFLARE_FOUNDER_ATTENDED_TEMPORARY_TOKEN_MAX_TTL_HOURS, 720);
  assert.equal(
    CLOUDFLARE_FOUNDER_ATTENDED_ACCOUNT_ID_SHA256,
    "2abc795ed0df284a522381c09dca33fc567105c74074140fd920c0dd45dcd536"
  );
  assert.deepEqual(CLOUDFLARE_FOUNDER_ATTENDED_ACCOUNT_ID_SHA256_ALLOWLIST, [
    CLOUDFLARE_FOUNDER_ATTENDED_ACCOUNT_ID_SHA256
  ]);
});

test("strict JSON rejects duplicate keys, trailing content, and excessive nesting", () => {
  assert.equal(parseStrictJson('{"ok":true}').ok, true);
  assert.throws(() => parseStrictJson('{"result":1,"result":2}'), /strict_json_invalid/u);
  assert.throws(() => parseStrictJson('{"ok":true} trailing'), /strict_json_invalid/u);
  assert.throws(() => parseStrictJson(`${"[".repeat(40)}0${"]".repeat(40)}`), /strict_json_invalid/u);
});

test("Security.framework adapter sends writes only over stdin and excludes unattended API token access", () => {
  const calls = [];
  const ownershipTag = `prometheus-founder-attended-v1:${"1".repeat(64)}`;
  const deploymentTokenEnvironmentName = ["CLOUDFLARE", "API", "TOKEN"].join("_");
  const spawnSyncImpl = (executable, args, options) => {
    calls.push({ executable, args, input: options.input && Buffer.from(options.input), env: options.env });
    if (args[1] === "presence") return { status: 2, stdout: Buffer.alloc(0) };
    if (args[1] === "read") return { status: 0, stdout: Buffer.from(fixtureApiToken) };
    return { status: 0, stdout: Buffer.alloc(0) };
  };
  const keychain = createFounderAttendedMacOsKeychain({
    spawnSyncImpl,
    environment: {
      HOME: "/synthetic/home",
      TMPDIR: "/synthetic/tmp",
      [deploymentTokenEnvironmentName]: "must-not-inherit"
    }
  });

  assert.equal(keychain.hasItem("temporaryApiToken"), false);
  const read = keychain.readItem("temporaryApiToken");
  assert.equal(read.toString("utf8"), fixtureApiToken);
  read.fill(0);
  keychain.addItem("smokeClientSecret", fixtureClientSecret, ownershipTag);
  assert.throws(
    () => keychain.readItem("unattendedDeploymentApiToken"),
    /founder_attended_keychain_read_denied/u
  );

  const writeCall = calls.find(call => call.args[1] === "add");
  const readCall = calls.find(call => call.args[1] === "read");
  assert.equal(
    writeCall.input.toString("utf8"),
    `${ownershipTag}\n${fixtureClientSecret}`
  );
  assert.equal(
    readCall.args.includes("com.prometheus.cloudflare.attended.service-token-provisioning"),
    true
  );
  assert.equal(readCall.args.includes("CLOUDFLARE_ACCESS_SERVICE_TOKENS_WRITE_API_TOKEN"), true);
  for (const call of calls) {
    const processMetadata = JSON.stringify({ args: call.args, env: call.env });
    for (const secret of [fixtureApiToken, fixtureClientId, fixtureClientSecret]) {
      assert.equal(processMetadata.includes(secret), false);
    }
  }
  assert.equal(Object.hasOwn(writeCall.env, deploymentTokenEnvironmentName), false);
  assert.equal(calls.some(call => call.args.includes(deploymentTokenEnvironmentName)), false);
  assert.equal(calls.every(call => call.executable === "/usr/bin/swift"), true);
  assert.equal(
    writeCall.args.includes("com.prometheus.cloudflare.attended.service-token-provisioning"),
    false
  );
  assert.equal(writeCall.args.includes("com.prometheus.cloudflare.unattended.smoke"), true);
});

test("native helper uses Security.framework and anonymous stdin for writes", () => {
  const source = readFileSync(CLOUDFLARE_FOUNDER_ATTENDED_KEYCHAIN_HELPER, "utf8");
  assert.match(source, /import Security/u);
  assert.match(source, /FileHandle\.standardInput\.readDataToEndOfFile\(\)/u);
  assert.match(source, /SecItemAdd/u);
  assert.match(source, /SecItemCopyMatching/u);
  assert.match(source, /SecItemDelete/u);
  assert.match(source, /kSecAttrComment/u);
  assert.doesNotMatch(source, /kSecAttrAccessible|kSecUseDataProtectionKeychain/u);
  assert.doesNotMatch(source, /print\(|NSLog|ProcessInfo\.processInfo\.environment/u);
});

test("native helper rejects every operation and item outside its fixed matrix before SecItem", () => {
  const source = readFileSync(CLOUDFLARE_FOUNDER_ATTENDED_KEYCHAIN_HELPER, "utf8");
  const matrix = Object.fromEntries([...source.matchAll(
    /"(presence|read|add|delete)": \[([^\]]*)\]/gu
  )].map(([, operation, items]) => [
    operation,
    items.split(",").map(item => item.trim()).filter(Boolean)
  ]));
  assert.deepEqual(matrix, {
    presence: ["temporaryApiToken", "governedAccountId", "smokeClientId", "smokeClientSecret"],
    read: ["temporaryApiToken", "governedAccountId"],
    add: ["smokeClientId", "smokeClientSecret"],
    delete: ["temporaryApiToken", "smokeClientId", "smokeClientSecret"]
  });
  for (const [operation, item] of [
    ["read", "smokeClientId"],
    ["read", "smokeClientSecret"],
    ["add", "temporaryApiToken"],
    ["add", "governedAccountId"],
    ["delete", "governedAccountId"]
  ]) {
    assert.equal(matrix[operation].includes(item), false);
  }
  const matrixGuard = source.indexOf("guard let allowedItems = allowedItemsByOperation[operation]");
  const firstSecurityCall = Math.min(
    source.indexOf("SecItemCopyMatching("),
    source.indexOf("SecItemAdd("),
    source.indexOf("SecItemDelete(")
  );
  assert.ok(matrixGuard > 0);
  assert.ok(firstSecurityCall > matrixGuard);
  assert.match(source, /allowedItems\.contains\(requestedItem\)[\s\S]*?exit\(64\)/u);
});

test("control is OFF by default and exact enabled controls are owner-only and at most 30 minutes", () => {
  const directory = mkdtempSync(join(tmpdir(), "prometheus-founder-control-"));
  const controlPath = join(directory, "control.json");
  try {
    const defaultControl = defaultFounderAttendedControl();
    assert.equal(defaultControl.enabled, false);
    assert.equal(defaultControl.directive, CLOUDFLARE_FOUNDER_ATTENDED_DIRECTIVE);
    assert.equal(defaultControl.accountIdSha256, CLOUDFLARE_FOUNDER_ATTENDED_ACCOUNT_ID_SHA256);
    assert.equal(defaultControl.serviceTokenName, CLOUDFLARE_FOUNDER_ATTENDED_SERVICE_TOKEN_NAME);
    assert.equal(defaultControl.duration, "720h");
    assert.equal(inspectFounderAttendedControl({
      controlPath,
      now,
      expectedCommit: repositoryIdentity.commit,
      expectedTree: repositoryIdentity.tree,
      expectedAccountIdSha256: fixtureAccountDigest
    }).valid, false);

    const created = createFounderAttendedControl({
      controlPath,
      now,
      repositoryIdentity,
      accountIdSha256: fixtureAccountDigest,
      randomBytesImpl: () => Buffer.alloc(32, 1)
    });
    assert.equal(created.status, "control_created");
    assert.equal((lstatSync(directory).mode & 0o777), 0o700);
    assert.equal((lstatSync(controlPath).mode & 0o777), 0o600);
    const inspected = inspectFounderAttendedControl({
      controlPath,
      now,
      expectedCommit: repositoryIdentity.commit,
      expectedTree: repositoryIdentity.tree,
      expectedAccountIdSha256: fixtureAccountDigest
    });
    assert.equal(inspected.valid, true);
    assert.equal(inspected.control.schemaVersion, CLOUDFLARE_FOUNDER_ATTENDED_CONTROL_SCHEMA);
    assert.equal(
      Date.parse(inspected.control.expiresAt) - Date.parse(inspected.control.issuedAt),
      CLOUDFLARE_FOUNDER_ATTENDED_CONTROL_MAX_LIFETIME_MS
    );
    assert.equal(CLOUDFLARE_FOUNDER_ATTENDED_CONTROL_MAX_LIFETIME_MS, 30 * 60 * 1000);
    assert.throws(() => createFounderAttendedControl({
      controlPath,
      now,
      repositoryIdentity,
      accountIdSha256: fixtureAccountDigest
    }), /founder_attended_control_exists/u);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("control validation rejects OFF, stale, broad, wrong-account, and tampered controls", () => {
  const base = {
    schemaVersion: CLOUDFLARE_FOUNDER_ATTENDED_CONTROL_SCHEMA,
    enabled: true,
    directive: CLOUDFLARE_FOUNDER_ATTENDED_DIRECTIVE,
    accountIdSha256: fixtureAccountDigest,
    serviceTokenName: CLOUDFLARE_FOUNDER_ATTENDED_SERVICE_TOKEN_NAME,
    duration: "720h",
    authorizedCommit: repositoryIdentity.commit,
    authorizedTree: repositoryIdentity.tree,
    issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
    oneShotAuthorizationNonce: Buffer.alloc(32, 2).toString("base64url")
  };
  const context = {
    now,
    expectedCommit: repositoryIdentity.commit,
    expectedTree: repositoryIdentity.tree,
    expectedAccountIdSha256: fixtureAccountDigest
  };
  assert.equal(validateFounderAttendedControl(base, context).valid, true);
  for (const mutation of [
    { enabled: false },
    { directive: "different" },
    { duration: "8760h" },
    { accountIdSha256: "d".repeat(64) },
    { authorizedTree: "e".repeat(40) },
    { expiresAt: new Date(now.getTime() - 1).toISOString() },
    { expiresAt: new Date(now.getTime() + 30 * 60 * 1000 + 1).toISOString() }
  ]) {
    assert.equal(validateFounderAttendedControl({ ...base, ...mutation }, context).valid, false);
  }
  assert.equal(validateFounderAttendedControl({ ...base, endpoint: "https://example.invalid" }, context).valid, false);
});

test("a prompt delayed beyond 30 minutes burns the issued authorization before network", async () => {
  let liveNow = new Date(now);
  const attended = {
    confirm(action, phrase) {
      assert.equal(action, "provision-attended");
      assert.equal(phrase, CLOUDFLARE_FOUNDER_ATTENDED_CONFIRMATIONS["provision-attended"]);
      liveNow = new Date(now.getTime() + CLOUDFLARE_FOUNDER_ATTENDED_CONTROL_MAX_LIFETIME_MS + 1);
      return true;
    }
  };
  const harness = createHarness({
    precreateControl: true,
    clock: () => new Date(liveNow)
  });
  try {
    await assert.rejects(harness.provision({ confirmation: attended }), /founder_attended_control_denied/u);
    assert.equal(readdirSync(harness.receiptDirectory).length, 1);
    assert.equal(methodCount(harness.transport, "GET"), 0);
    assert.equal(methodCount(harness.transport, "POST"), 0);
    assert.equal(methodCount(harness.transport, "DELETE"), 0);
  } finally {
    harness.cleanup();
  }
});

test("repository changes during confirmation or Keychain reads burn authorization before network", async t => {
  for (const phase of ["confirmation", "keychain-read"]) {
    await t.test(phase, async () => {
      let liveIdentity = repositoryIdentity;
      const changedIdentity = Object.freeze({
        ...repositoryIdentity,
        tree: "c".repeat(40)
      });
      const keychain = createMockKeychain({
        readHook() {
          if (phase === "keychain-read") liveIdentity = changedIdentity;
        }
      });
      const attended = {
        confirm() {
          if (phase === "confirmation") liveIdentity = changedIdentity;
          return true;
        }
      };
      const harness = createHarness({
        precreateControl: true,
        keychain,
        repositoryReader: () => liveIdentity
      });
      try {
        await assert.rejects(harness.provision({ confirmation: attended }), /founder_attended_control_denied/u);
        assert.equal(readdirSync(harness.receiptDirectory).length, 1);
        assert.equal(harness.transport.requests.length, 0);
      } finally {
        harness.cleanup();
      }
    });
  }
});

test("repository changes between GET and POST burn the path before the network write", async t => {
  for (const [label, changedIdentity] of [
    ["tree", Object.freeze({ ...repositoryIdentity, tree: "c".repeat(40) })],
    ["dirty", Object.freeze({ ...repositoryIdentity, clean: false })]
  ]) {
    await t.test(label, async () => {
      let liveIdentity = repositoryIdentity;
      const harness = createHarness({
        repositoryReader: () => liveIdentity,
        transportOptions: {
          onRequest(specification) {
            if (specification.method === "GET") liveIdentity = changedIdentity;
          }
        }
      });
      try {
        await assert.rejects(
          harness.provision(),
          error => error.message === CLOUDFLARE_FOUNDER_ATTENDED_LIVE_STATE_ERROR
        );
        assert.equal(methodCount(harness.transport, "GET"), 1);
        assert.equal(methodCount(harness.transport, "POST"), 0);
        assert.equal(methodCount(harness.transport, "DELETE"), 0);
        assert.equal(readdirSync(harness.receiptDirectory).length, 1);
      } finally {
        harness.cleanup();
      }
    });
  }
});

test("backwards, invalid, or expired live clocks stop all subsequent network writes", async t => {
  for (const [label, samples, expectedGets] of [
    ["backwards-before-get", [now, new Date(now.getTime() - 1)], 0],
    ["invalid-before-get", [now, new Date(Number.NaN)], 0],
    [
      "expired-before-post",
      [
        now,
        now,
        new Date(now.getTime() + CLOUDFLARE_FOUNDER_ATTENDED_CONTROL_MAX_LIFETIME_MS + 1)
      ],
      1
    ]
  ]) {
    await t.test(label, async () => {
      let sample = 0;
      const harness = createHarness({
        clock: () => new Date(samples[Math.min(sample++, samples.length - 1)])
      });
      try {
        await assert.rejects(
          harness.provision(),
          error => error.message === CLOUDFLARE_FOUNDER_ATTENDED_LIVE_STATE_ERROR
        );
        assert.equal(methodCount(harness.transport, "GET"), expectedGets);
        assert.equal(methodCount(harness.transport, "POST"), 0);
        assert.equal(methodCount(harness.transport, "DELETE"), 0);
        assert.equal(readdirSync(harness.receiptDirectory).length, 1);
      } finally {
        harness.cleanup();
      }
    });
  }
});

test("successful provisioning consumes control before exact GET, posts once, and stores the exact pair", async () => {
  const harness = createHarness({
    transportOptions: {
      onRequest(_specification, callNumber) {
        assert.equal(existsSync(harness.receiptDirectory), true);
        assert.equal(readdirSync(harness.receiptDirectory).length, 1);
        assert.ok(callNumber <= 2);
      }
    }
  });
  try {
    const attended = confirmation();
    const result = await harness.provision({ confirmation: attended });
    assert.equal(result.status, "provisioned");
    assert.equal(result.remoteCreateAttempts, 1);
    assert.equal(result.controlConsumed, true);
    assert.equal(result.manualReviewRequired, false);
    assert.deepEqual(attended.calls, [{
      action: "provision-attended",
      phrase: CLOUDFLARE_FOUNDER_ATTENDED_CONFIRMATIONS["provision-attended"]
    }]);
    assert.equal(harness.transport.requests.length, 2);
    const [list, create] = harness.transport.requests;
    const endpoint = `${CLOUDFLARE_FOUNDER_ATTENDED_API_ORIGIN}${
      CLOUDFLARE_FOUNDER_ATTENDED_API_PATH_TEMPLATE.replace("{account_id}", fixtureAccountId)
    }`;
    assert.equal(list.method, "GET");
    assert.equal(list.url.href, endpoint);
    assert.equal(list.url.search, "");
    assert.equal(list.body, null);
    assert.equal(create.method, "POST");
    assert.equal(create.url.href, endpoint);
    assert.equal(create.body, JSON.stringify({
      name: CLOUDFLARE_FOUNDER_ATTENDED_SERVICE_TOKEN_NAME,
      duration: "720h"
    }));
    assert.equal(create.headers.Authorization, `Bearer ${fixtureApiToken}`);
    assert.deepEqual(harness.keychain.calls.reads, ["governedAccountId", "temporaryApiToken"]);
    assert.deepEqual(harness.keychain.calls.adds, ["smokeClientId", "smokeClientSecret"]);
    assert.equal(harness.keychain.values.get("smokeClientId").toString(), fixtureClientId);
    assert.equal(harness.keychain.values.get("smokeClientSecret").toString(), fixtureClientSecret);
    const output = JSON.stringify(result);
    for (const value of [fixtureAccountId, fixtureApiToken, fixtureClientId, fixtureClientSecret, fixtureTokenId]) {
      assert.equal(output.includes(value), false);
    }
  } finally {
    harness.cleanup();
  }
});

test("governed account is hash-checked before endpoint construction, token read, control, or network", async () => {
  const harness = createHarness();
  try {
    await assert.rejects(
      harness.provision({ accountIdSha256Allowlist: ["f".repeat(64)] }),
      error => error.message === "governed_account_mismatch"
    );
    assert.deepEqual(harness.keychain.calls.reads, ["governedAccountId"]);
    assert.equal(harness.transport.requests.length, 0);
    assert.equal(existsSync(harness.controlPath), false);
    assert.equal(existsSync(harness.receiptDirectory), false);
  } finally {
    harness.cleanup();
  }
});

test("account validator accepts exactly one SHA-256 identity and rejects malformed allowlists", () => {
  assert.equal(validateGovernedCloudflareAccountId(fixtureAccountId, [fixtureAccountDigest]), fixtureAccountDigest);
  assert.throws(() => validateGovernedCloudflareAccountId(fixtureAccountId, []), /governed_account_mismatch/u);
  assert.throws(
    () => validateGovernedCloudflareAccountId(fixtureAccountId, [fixtureAccountDigest, fixtureAccountDigest]),
    /governed_account_mismatch/u
  );
  assert.throws(() => validateGovernedCloudflareAccountId("wrong", [fixtureAccountDigest]), /governed_account_mismatch/u);
});

test("existing or process-death partial smoke credentials require review before reads, control, or network", async t => {
  for (const existing of [
    { smokeClientId: fixtureClientId },
    { smokeClientSecret: fixtureClientSecret },
    { smokeClientId: fixtureClientId, smokeClientSecret: fixtureClientSecret }
  ]) {
    await t.test(Object.keys(existing).join("+"), async () => {
      const harness = createHarness({ keychainOptions: existing });
      try {
        await assert.rejects(
          harness.provision(),
          error => error.message === CLOUDFLARE_FOUNDER_ATTENDED_MANUAL_REVIEW_ERROR
        );
        assert.deepEqual(harness.keychain.calls.reads, []);
        assert.equal(harness.transport.requests.length, 0);
        assert.equal(existsSync(harness.controlPath), false);
      } finally {
        harness.cleanup();
      }
    });
  }
});

test("missing governed inputs fail before control consumption or network", async t => {
  for (const [label, options] of [
    ["account", { missing: ["governedAccountId"] }],
    ["temporary-token", { missing: ["temporaryApiToken"] }]
  ]) {
    await t.test(label, async () => {
      const harness = createHarness({ keychain: createMockKeychain(options) });
      try {
        await assert.rejects(harness.provision(), /required_keychain_item_absent/u);
        assert.equal(harness.transport.requests.length, 0);
        assert.equal(existsSync(harness.controlPath), false);
      } finally {
        harness.cleanup();
      }
    });
  }
});

test("fixed-name remote duplicate burns control and prevents POST", async () => {
  const harness = createHarness({
    transportOptions: {
      get: listResponse([{ id: "synthetic-existing-id", name: CLOUDFLARE_FOUNDER_ATTENDED_SERVICE_TOKEN_NAME }])
    }
  });
  try {
    await assert.rejects(harness.provision(), /remote_duplicate_present/u);
    assert.equal(methodCount(harness.transport, "GET"), 1);
    assert.equal(methodCount(harness.transport, "POST"), 0);
    assert.equal(readdirSync(harness.receiptDirectory).length, 1);
  } finally {
    harness.cleanup();
  }
});

test("preflight redirects, network failures, malformed data, and incomplete pagination never POST", async t => {
  const cases = [
    ["missing-response", null],
    ["redirect", { status: 302, body: "" }],
    ["network", new Error(`transport ${fixtureApiToken}`)],
    ["malformed", { status: 200, body: "{" }],
    ["duplicate-key", { status: 200, body: '{"success":true,"success":true}' }],
    ["pagination", {
      status: 200,
      body: JSON.stringify({
        success: true,
        errors: [],
        messages: [],
        result: [],
        result_info: { page: 1, per_page: 20, count: 0, total_count: 21, total_pages: 2 }
      })
    }]
  ];
  for (const [label, get] of cases) {
    await t.test(label, async () => {
      const harness = createHarness({ transportOptions: { get } });
      try {
        await assert.rejects(
          harness.provision(),
          error => error.message === "remote_duplicate_preflight_failed"
            && !error.message.includes(fixtureApiToken)
        );
        assert.equal(methodCount(harness.transport, "POST"), 0);
        assert.equal(methodCount(harness.transport, "DELETE"), 0);
      } finally {
        harness.cleanup();
      }
    });
  }
});

test("ambiguous POST failures and redirects require manual review after exactly one POST", async t => {
  for (const [label, post] of [
    ["missing-response", null],
    ["network", new Error(`ambiguous ${fixtureClientSecret}`)],
    ["redirect", { status: 307, body: "" }],
    ["server", { status: 500, body: JSON.stringify({ error: fixtureClientSecret }) }]
  ]) {
    await t.test(label, async () => {
      const harness = createHarness({ transportOptions: { post } });
      try {
        await assert.rejects(
          harness.provision(),
          error => error.message === CLOUDFLARE_FOUNDER_ATTENDED_MANUAL_REVIEW_ERROR
            && !error.message.includes(fixtureClientSecret)
        );
        assert.equal(methodCount(harness.transport, "POST"), 1);
        assert.equal(methodCount(harness.transport, "DELETE"), 0);
        assert.deepEqual(harness.keychain.calls.adds, []);
      } finally {
        harness.cleanup();
      }
    });
  }
});

test("tampered responses with an exact name and validated ID receive one compensating DELETE", async t => {
  const cases = [
    ["duration", createResponse({ duration: "8760h" })],
    ["expiry", createResponse({ expires_at: new Date(Date.parse(expiresAt) + 1).toISOString() })],
    ["client-id", createResponse({ client_id: "invalid" })],
    ["secret", createResponse({ client_secret: "invalid" })],
    ["status", { ...createResponse(), status: 500 }]
  ];
  for (const [label, post] of cases) {
    await t.test(label, async () => {
      const harness = createHarness({ transportOptions: { post } });
      try {
        await assert.rejects(
          harness.provision(),
          error => error.message === CLOUDFLARE_FOUNDER_ATTENDED_COMPENSATED_ERROR
        );
        assert.equal(methodCount(harness.transport, "POST"), 1);
        assert.equal(methodCount(harness.transport, "DELETE"), 1);
        const deletion = harness.transport.requests.find(request => request.method === "DELETE");
        assert.equal(
          deletion.url.href,
          `${CLOUDFLARE_FOUNDER_ATTENDED_API_ORIGIN}/client/v4/accounts/${fixtureAccountId}/access/service_tokens/${fixtureTokenId}`
        );
        assert.equal(deletion.body, null);
        assert.deepEqual(harness.keychain.calls.adds, []);
      } finally {
        harness.cleanup();
      }
    });
  }
});

test("wrong-name, invalid-ID, malformed, and duplicate-key responses are not unsafe DELETE targets", async t => {
  const cases = [
    ["name", createResponse({ name: "Different token" })],
    ["id", createResponse({ id: "invalid" })],
    ["malformed", { status: 200, body: "not-json" }],
    ["duplicate-key", {
      status: 200,
      body: `{"success":true,"errors":[],"messages":[],"result":{},"result":${JSON.stringify({ id: fixtureTokenId })}}`
    }]
  ];
  for (const [label, post] of cases) {
    await t.test(label, async () => {
      const harness = createHarness({ transportOptions: { post } });
      try {
        await assert.rejects(
          harness.provision(),
          error => error.message === CLOUDFLARE_FOUNDER_ATTENDED_MANUAL_REVIEW_ERROR
        );
        assert.equal(methodCount(harness.transport, "POST"), 1);
        assert.equal(methodCount(harness.transport, "DELETE"), 0);
      } finally {
        harness.cleanup();
      }
    });
  }
});

test("compensation redirect, network, malformed, and wrong-ID failures require manual review", async t => {
  for (const [label, deleteResult] of [
    ["redirect", { status: 302, body: "" }],
    ["network", new Error("synthetic-delete-network-failure")],
    ["malformed", { status: 200, body: "{" }],
    ["wrong-id", deleteResponse("different-service-token-id")]
  ]) {
    await t.test(label, async () => {
      const harness = createHarness({
        transportOptions: {
          post: createResponse({ duration: "invalid" }),
          delete: deleteResult
        }
      });
      try {
        await assert.rejects(
          harness.provision(),
          error => error.message === CLOUDFLARE_FOUNDER_ATTENDED_MANUAL_REVIEW_ERROR
        );
        assert.equal(methodCount(harness.transport, "POST"), 1);
        assert.equal(methodCount(harness.transport, "DELETE"), 1);
      } finally {
        harness.cleanup();
      }
    });
  }
});

test("partial pair writes roll back both local items and compensate the validated remote token", async t => {
  for (const [label, addHook] of [
    ["second-write-fails", ({ key, value, values }) => {
      if (key === "smokeClientSecret") throw new Error(`write ${value}`);
      values.set(key, Buffer.from(value));
    }],
    ["second-write-ambiguous", ({ key, value, values, owners, ownershipTag }) => {
      values.set(key, Buffer.from(value));
      if (key === "smokeClientSecret") {
        owners.set(key, ownershipTag);
        throw new Error(`ambiguous ${value}`);
      }
    }]
  ]) {
    await t.test(label, async () => {
      const keychain = createMockKeychain({ addHook });
      const harness = createHarness({ keychain });
      try {
        await assert.rejects(
          harness.provision(),
          error => error.message === CLOUDFLARE_FOUNDER_ATTENDED_COMPENSATED_ERROR
            && !error.message.includes(fixtureClientSecret)
        );
        assert.equal(keychain.values.has("smokeClientId"), false);
        assert.equal(keychain.values.has("smokeClientSecret"), false);
        assert.ok(keychain.calls.deletes.includes("smokeClientId"));
        assert.equal(methodCount(harness.transport, "DELETE"), 1);
      } finally {
        harness.cleanup();
      }
    });
  }
});

test("local rollback failure remains manual review even when remote compensation succeeds", async () => {
  const keychain = createMockKeychain({
    addHook({ key, value, values, owners, ownershipTag }) {
      values.set(key, Buffer.from(value));
      if (key === "smokeClientSecret") {
        owners.set(key, ownershipTag);
        throw new Error("synthetic-write-failure");
      }
    },
    deleteHook({ key, values, owners }) {
      if (key === "smokeClientId") throw new Error("synthetic-delete-failure");
      values.delete(key);
      owners.delete(key);
    }
  });
  const harness = createHarness({ keychain });
  try {
    await assert.rejects(
      harness.provision(),
      error => error.message === CLOUDFLARE_FOUNDER_ATTENDED_MANUAL_REVIEW_ERROR
    );
    assert.equal(keychain.values.has("smokeClientId"), true);
    assert.equal(methodCount(harness.transport, "DELETE"), 1);
  } finally {
    harness.cleanup();
  }
});

test("rollback never deletes a pre-existing or replacement destination item", async () => {
  const replacement = "synthetic-pre-existing-replacement";
  const keychain = createMockKeychain({
    addHook({ key, values, owners }) {
      if (key !== "smokeClientSecret") return;
      values.set(key, Buffer.from(replacement));
      owners.set(key, "preexisting");
      throw new Error("synthetic-concurrent-destination-write");
    }
  });
  const harness = createHarness({ keychain });
  try {
    await assert.rejects(
      harness.provision(),
      error => error.message === CLOUDFLARE_FOUNDER_ATTENDED_MANUAL_REVIEW_ERROR
    );
    assert.equal(keychain.values.has("smokeClientId"), false);
    assert.equal(keychain.values.get("smokeClientSecret").toString("utf8"), replacement);
    assert.equal(keychain.owners.get("smokeClientSecret"), "preexisting");
    assert.deepEqual(keychain.calls.deletes, ["smokeClientSecret", "smokeClientId"]);
    assert.equal(methodCount(harness.transport, "DELETE"), 1);
  } finally {
    harness.cleanup();
  }
});

test("remote compensation failure after clean local rollback requires manual review", async () => {
  const keychain = createMockKeychain({
    addHook({ key, value, values }) {
      if (key === "smokeClientSecret") throw new Error(`write ${value}`);
      values.set(key, Buffer.from(value));
    }
  });
  const harness = createHarness({
    keychain,
    transportOptions: { delete: new Error("synthetic-delete-failure") }
  });
  try {
    await assert.rejects(
      harness.provision(),
      error => error.message === CLOUDFLARE_FOUNDER_ATTENDED_MANUAL_REVIEW_ERROR
    );
    assert.equal(keychain.values.has("smokeClientId"), false);
    assert.equal(keychain.values.has("smokeClientSecret"), false);
    assert.equal(methodCount(harness.transport, "DELETE"), 1);
  } finally {
    harness.cleanup();
  }
});

test("consumed control cannot replay even if smoke items are externally removed", async () => {
  const harness = createHarness();
  try {
    await harness.provision();
    harness.keychain.values.delete("smokeClientId");
    harness.keychain.values.delete("smokeClientSecret");
    await assert.rejects(harness.provision(), /founder_attended_control_denied/u);
    assert.equal(methodCount(harness.transport, "POST"), 1);
    assert.equal(readdirSync(harness.receiptDirectory).length, 1);
  } finally {
    harness.cleanup();
  }
});

test("concurrent provision attempts atomically admit only one network path", async () => {
  const harness = createHarness();
  try {
    const results = await Promise.allSettled([harness.provision(), harness.provision()]);
    assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
    const rejected = results.find(result => result.status === "rejected");
    assert.equal(rejected.reason.message, "founder_attended_control_denied");
    assert.equal(methodCount(harness.transport, "GET"), 1);
    assert.equal(methodCount(harness.transport, "POST"), 1);
    assert.equal(methodCount(harness.transport, "DELETE"), 0);
    assert.equal(readdirSync(harness.receiptDirectory).length, 1);
  } finally {
    harness.cleanup();
  }
});

test("control consumption is exclusive, persistent, and owner-only", () => {
  const harness = createHarness({ precreateControl: true });
  try {
    const options = {
      controlPath: harness.controlPath,
      now,
      expectedCommit: repositoryIdentity.commit,
      expectedTree: repositoryIdentity.tree,
      expectedAccountIdSha256: fixtureAccountDigest
    };
    assert.equal(consumeFounderAttendedControl(options).consumed, true);
    assert.equal((lstatSync(harness.receiptDirectory).mode & 0o777), 0o700);
    const receiptPath = join(harness.receiptDirectory, readdirSync(harness.receiptDirectory)[0]);
    assert.equal((lstatSync(receiptPath).mode & 0o777), 0o600);
    assert.throws(() => consumeFounderAttendedControl(options), /founder_attended_control_denied/u);
  } finally {
    harness.cleanup();
  }
});

test("control permission, duplicate-key, and symlink tampering fail closed", () => {
  const harness = createHarness({ precreateControl: true });
  const context = {
    controlPath: harness.controlPath,
    now,
    expectedCommit: repositoryIdentity.commit,
    expectedTree: repositoryIdentity.tree,
    expectedAccountIdSha256: fixtureAccountDigest
  };
  try {
    chmodSync(harness.controlPath, 0o644);
    assert.equal(inspectFounderAttendedControl(context).valid, false);
    chmodSync(harness.controlPath, 0o600);
    const raw = readFileSync(harness.controlPath, "utf8");
    writeFileSync(harness.controlPath, `${raw.trim().slice(0, -1)},"enabled":true}`, { mode: 0o600 });
    assert.equal(inspectFounderAttendedControl(context).valid, false);
    rmSync(harness.controlPath);
    const target = join(harness.directory, "target.json");
    writeFileSync(target, raw, { mode: 0o600 });
    symlinkSync(target, harness.controlPath);
    assert.equal(inspectFounderAttendedControl(context).valid, false);
  } finally {
    harness.cleanup();
  }
});

test("presence is name-only and never reads values", () => {
  const keychain = createMockKeychain();
  const result = inspectFounderAttendedPresenceTestOnly({ keychain });
  const report = formatFounderAttendedKeychainPresence(result);
  assert.deepEqual(keychain.calls.reads, []);
  assert.equal(result.length, 4);
  assert.match(report, /com\.prometheus\.cloudflare\.attended\.service-token-provisioning\/CLOUDFLARE_ACCESS_SERVICE_TOKENS_WRITE_API_TOKEN: PRESENT/u);
  for (const value of [fixtureAccountId, fixtureApiToken, fixtureClientId, fixtureClientSecret]) {
    assert.equal(report.includes(value), false);
  }
  assert.deepEqual(
    founderAttendedKeychainPresence(keychain).map(entry => Object.keys(entry)),
    Array(4).fill(["name", "present"])
  );
});

test("cleanup-temp removes only the separate temporary item and requires Founder revocation", () => {
  const keychain = createMockKeychain({
    smokeClientId: fixtureClientId,
    smokeClientSecret: fixtureClientSecret
  });
  const attended = confirmation();
  const result = cleanupFounderAttendedTemporaryTokenTestOnly({ confirmation: attended, keychain });
  assert.deepEqual(attended.calls, [{
    action: "cleanup-temp",
    phrase: CLOUDFLARE_FOUNDER_ATTENDED_CONFIRMATIONS["cleanup-temp"]
  }]);
  assert.deepEqual(keychain.calls.deletes, ["temporaryApiToken"]);
  assert.equal(keychain.values.has("governedAccountId"), true);
  assert.equal(keychain.values.has("smokeClientId"), true);
  assert.equal(keychain.values.has("smokeClientSecret"), true);
  assert.match(result.nextRequiredAction, /revoke the temporary Cloudflare API token/u);
  assert.equal(JSON.stringify(result).includes(fixtureApiToken), false);
});

test("cleanup failures never delete account or smoke items", () => {
  const keychain = createMockKeychain({
    smokeClientId: fixtureClientId,
    smokeClientSecret: fixtureClientSecret,
    deleteHook() {
      throw new Error(`delete ${fixtureApiToken}`);
    }
  });
  assert.throws(
    () => cleanupFounderAttendedTemporaryTokenTestOnly({ confirmation: confirmation(), keychain }),
    error => error.message === "temporary_api_token_cleanup_failed"
      && !error.message.includes(fixtureApiToken)
  );
  assert.deepEqual(keychain.calls.deletes, ["temporaryApiToken"]);
  assert.equal(keychain.values.has("governedAccountId"), true);
  assert.equal(keychain.values.has("smokeClientId"), true);
  assert.equal(keychain.values.has("smokeClientSecret"), true);
});

test("TTY confirmation accepts macOS /dev/tty alias identity only after concrete stream identity", () => {
  const action = "provision-attended";
  const expectedPhrase = CLOUDFLARE_FOUNDER_ATTENDED_CONFIRMATIONS[action];
  const mocked = createMockControllingTty({
    inputRdev: 301,
    outputRdev: 301,
    ttyRdev: 999,
    response: `${expectedPhrase}\r\n`
  });

  assert.equal(createControllingTtyConfirmation.length, 0);
  assert.equal(mocked.confirmation.confirm(action, expectedPhrase), true);
  assert.deepEqual(mocked.calls.stats, [
    mocked.fds.inputFd,
    mocked.fds.outputFd,
    mocked.fds.ttyFd
  ]);
  assert.equal(mocked.calls.opens.length, 1);
  assert.equal(mocked.calls.opens[0].path, "/dev/tty");
  assert.equal(
    mocked.calls.opens[0].flags & constants.O_RDWR,
    constants.O_RDWR
  );
  if (constants.O_NOFOLLOW) {
    assert.equal(
      mocked.calls.opens[0].flags & constants.O_NOFOLLOW,
      constants.O_NOFOLLOW
    );
  }
  if (constants.O_NOCTTY) {
    assert.equal(
      mocked.calls.opens[0].flags & constants.O_NOCTTY,
      constants.O_NOCTTY
    );
  }
  assert.deepEqual(mocked.calls.writes, [{
    fd: mocked.fds.ttyFd,
    value: [
      `Founder-attended action: ${action}`,
      "Type this exact confirmation phrase:",
      expectedPhrase,
      "> "
    ].join("\n")
  }]);
  assert.ok(mocked.calls.reads.length > 0);
  assert.equal(mocked.calls.reads.every(fd => fd === mocked.fds.ttyFd), true);
  assert.deepEqual(mocked.calls.closes, [mocked.fds.ttyFd]);
});

test("TTY confirmation preserves exact matching and the 192-byte input ceiling", () => {
  const action = "provision-attended";
  const expectedPhrase = CLOUDFLARE_FOUNDER_ATTENDED_CONFIRMATIONS[action];
  const wrong = createMockControllingTty({ response: `${expectedPhrase} \n` });
  assert.equal(wrong.confirmation.confirm(action, expectedPhrase), false);

  const maximumPhrase = "X".repeat(192);
  const maximum = createMockControllingTty({ response: `${maximumPhrase}\n` });
  assert.equal(maximum.confirmation.confirm(action, maximumPhrase), true);

  const oversized = createMockControllingTty({ response: `${"X".repeat(193)}\n` });
  assert.equal(oversized.confirmation.confirm(action, expectedPhrase), false);
  assert.equal(oversized.calls.reads.length, 193);

  const oversizedExpected = createMockControllingTty({ response: `${"X".repeat(193)}\n` });
  assert.throws(
    () => oversizedExpected.confirmation.confirm(action, "X".repeat(193)),
    /controlling_tty_required/u
  );
  assert.deepEqual(oversizedExpected.calls.stats, []);
  assert.deepEqual(oversizedExpected.calls.opens, []);
});

test("every TTY rejection stops all Keychain, control, network, and live external activity", async t => {
  const scenarios = [
    {
      label: "stdin is not a TTY",
      make: () => createMockControllingTty({ inputIsTTY: false }),
      error: /founder_attendance_required/u
    },
    {
      label: "stdout is redirected",
      make: () => createMockControllingTty({ outputIsTTY: false }),
      error: /founder_attendance_required/u
    },
    {
      label: "stdin and stdout identify different concrete terminals",
      make: () => createMockControllingTty({ inputRdev: 301, outputRdev: 302 }),
      error: /founder_attendance_required/u
    },
    {
      label: "stdin descriptor is not a character device",
      make: () => createMockControllingTty({ inputCharacterDevice: false }),
      error: /founder_attendance_required/u
    },
    {
      label: "stdout descriptor is not a character device",
      make: () => createMockControllingTty({ outputCharacterDevice: false }),
      error: /founder_attendance_required/u
    },
    {
      label: "/dev/tty open fails",
      make: () => createMockControllingTty({
        openError: new Error("synthetic_tty_open_failure")
      }),
      error: /founder_attendance_required/u
    },
    {
      label: "/dev/tty is not a character device",
      make: () => createMockControllingTty({ ttyCharacterDevice: false }),
      error: /founder_attendance_required/u
    },
    {
      label: "confirmation phrase is wrong",
      make: () => createMockControllingTty({ response: "WRONG SYNTHETIC PHRASE\n" }),
      error: /founder_confirmation_denied/u
    },
    {
      label: "confirmation phrase is oversized",
      make: () => createMockControllingTty({ response: `${"X".repeat(193)}\n` }),
      error: /founder_confirmation_denied/u
    }
  ];

  for (const scenario of scenarios) {
    await t.test(scenario.label, async () => {
      const activity = { clock: 0, repository: 0, random: 0 };
      const harness = createHarness({
        clock() {
          activity.clock += 1;
          return new Date(now);
        },
        repositoryReader() {
          activity.repository += 1;
          return repositoryIdentity;
        }
      });
      try {
        await assert.rejects(
          harness.provision({
            confirmation: scenario.make().confirmation,
            randomBytesImpl() {
              activity.random += 1;
              return Buffer.alloc(32, 7);
            }
          }),
          scenario.error
        );
        assertNoKeychainActivity(harness.keychain);
        assert.equal(existsSync(harness.controlPath), false);
        assert.equal(existsSync(harness.receiptDirectory), false);
        assert.equal(harness.transport.requests.length, 0);
        assert.deepEqual(activity, { clock: 0, repository: 0, random: 0 });

        const cleanupKeychain = createMockKeychain();
        assert.throws(
          () => cleanupFounderAttendedTemporaryTokenTestOnly({
            confirmation: scenario.make().confirmation,
            keychain: cleanupKeychain
          }),
          scenario.error
        );
        assertNoKeychainActivity(cleanupKeychain);
      } finally {
        harness.cleanup();
      }
    });
  }
});

test("real macOS PTY accepts /dev/tty alias rdev variance without Keychain or Cloudflare", {
  skip: process.platform !== "darwin" || !existsSync("/usr/bin/expect")
}, async () => {
  const childPath = join(
    root,
    "tests/fixtures/cloudflare-founder-attended-tty-macos-pty-child.mjs"
  );
  const expectPath = join(
    root,
    "tests/fixtures/cloudflare-founder-attended-tty-macos-pty.expect"
  );
  const result = await runBoundedPtyIntegration(
    "/usr/bin/expect",
    [expectPath, process.execPath, childPath]
  );
  const diagnostic = JSON.stringify({
    command: result.command,
    outputLimitExceeded: result.outputLimitExceeded,
    signal: result.signal,
    status: result.status,
    stderr: result.stderr,
    stdout: result.stdout,
    timedOut: result.timedOut
  });
  assert.equal(result.timedOut, false, diagnostic);
  assert.equal(result.outputLimitExceeded, false, diagnostic);
  assert.equal(result.signal, null, diagnostic);
  assert.equal(result.status, 0, diagnostic);
  const match = result.stdout.match(/PROMETHEUS_MACOS_TTY_RESULT=(\{[^\r\n]+\})/u);
  assert.ok(match, diagnostic);
  assert.deepEqual(JSON.parse(match[1]), {
    stdinIsTTY: true,
    stdoutIsTTY: true,
    stdinCharacterDevice: true,
    stdoutCharacterDevice: true,
    controllingTtyCharacterDevice: true,
    streamRdevsEqual: true,
    controllingTtyAliasRdevDiffers: true,
    confirmed: true
  });
});

test("denied or missing attendance prevents control creation and all network activity", async t => {
  for (const [label, attended, expectedError] of [
    ["denied", confirmation(false), /founder_confirmation_denied/u],
    ["missing", null, /founder_attended_test_composition_invalid/u]
  ]) {
    await t.test(label, async () => {
      const harness = createHarness();
      try {
        await assert.rejects(
          harness.provision({ confirmation: attended }),
          expectedError
        );
        assert.equal(existsSync(harness.controlPath), false);
        assert.equal(harness.transport.requests.length, 0);
        assert.deepEqual(harness.keychain.calls.reads, []);
      } finally {
        harness.cleanup();
      }
    });
  }
});

test("production CLI exposes only three fixed modes and has no injectable adapter surface", async () => {
  assert.deepEqual(CLOUDFLARE_FOUNDER_ATTENDED_COMMANDS, [
    "presence",
    "provision-attended",
    "cleanup-temp"
  ]);
  assert.equal(provisionFounderAttendedServiceToken.length, 0);
  assert.equal(inspectFounderAttendedPresence.length, 0);
  assert.equal(cleanupFounderAttendedTemporaryToken.length, 0);
  assert.equal(runFounderAttendedServiceTokenProductionCli.length, 0);

  const cliSource = readFileSync(
    join(root, "scripts/run-cloudflare-founder-attended-service-token.mjs"),
    "utf8"
  );
  const productionSource = readFileSync(
    join(root, "scripts/lib/cloudflare-founder-attended-service-token-production.mjs"),
    "utf8"
  );
  const importStatements = cliSource.match(/^import[\s\S]*?;$/gmu) || [];
  assert.equal(importStatements.length, 1);
  assert.match(importStatements[0], /cloudflare-founder-attended-service-token-production\.mjs/u);
  assert.doesNotMatch(cliSource, /confirmation|transport|keychain|operations|writeOutput|requestImpl/u);
  assert.match(
    productionSource,
    /export async function provisionFounderAttendedServiceToken\(\)/u
  );
  assert.match(productionSource, /export function inspectFounderAttendedPresence\(\)/u);
  assert.match(productionSource, /export function cleanupFounderAttendedTemporaryToken\(\)/u);
  assert.match(productionSource, /export async function runFounderAttendedServiceTokenProductionCli\(\)/u);
  await assert.rejects(
    provisionFounderAttendedServiceTokenTestOnly({}),
    /founder_attended_test_composition_invalid/u
  );
});

test("unattended launcher has no provisioning profile or temporary-token access", () => {
  assert.deepEqual(CLOUDFLARE_UNATTENDED_LAUNCH_PROFILES, [
    "presence",
    "smoke-dry-run",
    "smoke-read-only",
    "deployment-release"
  ]);
  assert.throws(
    () => runCloudflareUnattendedLauncher({ profile: "founder-attended-service-token", root }),
    /launcher_profile_invalid/u
  );
  assert.equal(
    Object.values(CLOUDFLARE_FOUNDER_ATTENDED_KEYCHAIN_ITEMS)
      .some(item => item.account === "CLOUDFLARE_API_TOKEN"),
    false
  );
});

test("created smoke generic-password schema matches the audited security reader without secret metadata", () => {
  const smokeItems = KEYCHAIN_ITEMS.filter(item => [
    "CLOUDFLARE_ACCESS_CLIENT_ID",
    "CLOUDFLARE_ACCESS_CLIENT_SECRET"
  ].includes(item.account));
  assert.deepEqual(smokeItems, [
    CLOUDFLARE_FOUNDER_ATTENDED_KEYCHAIN_ITEMS.smokeClientId,
    CLOUDFLARE_FOUNDER_ATTENDED_KEYCHAIN_ITEMS.smokeClientSecret
  ]);

  const syntheticValues = new Map([
    ["CLOUDFLARE_ACCESS_CLIENT_ID", fixtureClientId],
    ["CLOUDFLARE_ACCESS_CLIENT_SECRET", fixtureClientSecret]
  ]);
  const calls = [];
  const adapter = createMacOsKeychainAdapter({
    spawnSyncImpl(executable, args, options) {
      calls.push({ executable, args: [...args], options: { ...options } });
      return {
        status: 0,
        stdout: `${syntheticValues.get(args.at(-1))}\n`
      };
    }
  });
  assert.equal(adapter.readItem(smokeItems[0]), fixtureClientId);
  assert.equal(adapter.readItem(smokeItems[1]), fixtureClientSecret);
  for (const [index, call] of calls.entries()) {
    const item = smokeItems[index];
    assert.equal(call.executable, "/usr/bin/security");
    assert.deepEqual(call.args, [
      "find-generic-password",
      "-w",
      "-s",
      item.service,
      "-a",
      item.account
    ]);
    assert.deepEqual(call.options.stdio, ["ignore", "pipe", "ignore"]);
    assert.equal(call.options.env, undefined);
    assert.equal(call.options.input, undefined);
    const metadata = JSON.stringify({ args: call.args, options: call.options });
    assert.equal(metadata.includes(syntheticValues.get(item.account)), false);
  }

  const helper = readFileSync(CLOUDFLARE_FOUNDER_ATTENDED_KEYCHAIN_HELPER, "utf8");
  assert.match(helper, /kSecClassGenericPassword/u);
  assert.match(helper, /kSecAttrService: requestedItem\.service/u);
  assert.match(helper, /kSecAttrAccount: requestedItem\.account/u);
  assert.match(helper, /attributes\[kSecValueData\] = input\.secret/u);
  assert.doesNotMatch(helper, /kSecUseDataProtectionKeychain|kSecAttrAccessible/u);
  assert.doesNotMatch(helper, /SecAccessCreate|SecTrustedApplication|kSecAttrAccess\b/u);
});

test("scanner registries cover the temporary item and likely local artifacts", () => {
  assert.deepEqual(ATTENDED_KEYCHAIN_ITEMS, [{
    service: "com.prometheus.cloudflare.attended.service-token-provisioning",
    account: "CLOUDFLARE_ACCESS_SERVICE_TOKENS_WRITE_API_TOKEN"
  }]);
  assert.equal(CLOUDFLARE_SECRET_KEYCHAIN_ITEM_REGISTRY.includes(ATTENDED_KEYCHAIN_ITEMS[0]), true);
  for (const artifact of [
    "cloudflare-founder-attended-service-token-control-v1.json",
    "cloudflare-attended-service-token-provisioning-token.txt",
    "cloudflare-service-token-response.json"
  ]) {
    assert.equal(LOCAL_SECRET_ARTIFACT_CANDIDATES.includes(artifact), true);
  }
  assert.equal(
    scanTextForCloudflareSecrets(
      `CLOUDFLARE_ACCESS_SERVICE_TOKENS_WRITE_API_TOKEN=${fixtureApiToken}`,
      "synthetic.txt"
    ).length,
    1
  );
});

test("generic failures and control artifacts leak no account or credential values", async () => {
  const responseBody = JSON.stringify({
    error: fixtureClientSecret,
    headers: { Authorization: `Bearer ${fixtureApiToken}` }
  });
  const harness = createHarness({
    transportOptions: { post: { status: 200, body: responseBody } }
  });
  try {
    await assert.rejects(harness.provision(), error => {
      const rendered = String(error?.message);
      assert.equal(rendered, CLOUDFLARE_FOUNDER_ATTENDED_MANUAL_REVIEW_ERROR);
      for (const forbidden of [
        fixtureAccountId,
        fixtureAccountDigest,
        fixtureApiToken,
        fixtureClientId,
        fixtureClientSecret,
        fixtureTokenId,
        responseBody,
        "Authorization",
        "prefix",
        "length"
      ]) {
        assert.equal(rendered.includes(forbidden), false);
      }
      return true;
    });
    const artifactText = [
      readFileSync(harness.controlPath, "utf8"),
      ...readdirSync(harness.receiptDirectory)
        .map(name => readFileSync(join(harness.receiptDirectory, name), "utf8"))
    ].join("\n");
    for (const secret of [fixtureAccountId, fixtureApiToken, fixtureClientId, fixtureClientSecret]) {
      assert.equal(artifactText.includes(secret), false);
    }
  } finally {
    harness.cleanup();
  }
});
