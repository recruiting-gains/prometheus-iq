import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  chmodSync,
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
  CLOUDFLARE_FOUNDER_ATTENDED_MANUAL_REVIEW_ERROR,
  CLOUDFLARE_FOUNDER_ATTENDED_SERVICE_TOKEN_DURATION,
  CLOUDFLARE_FOUNDER_ATTENDED_SERVICE_TOKEN_NAME,
  CLOUDFLARE_FOUNDER_ATTENDED_TEMPORARY_TOKEN_MAX_TTL_HOURS,
  CLOUDFLARE_FOUNDER_ATTENDED_TEMPORARY_TOKEN_PERMISSION,
  cleanupFounderAttendedTemporaryToken,
  inspectFounderAttendedPresence,
  provisionFounderAttendedServiceToken,
  validateGovernedCloudflareAccountId
} from "../scripts/lib/cloudflare-founder-attended-service-token.mjs";
import { createControllingTtyConfirmation } from "../scripts/lib/cloudflare-founder-attended-tty.mjs";
import { parseStrictJson } from "../scripts/lib/strict-json.mjs";
import {
  CLOUDFLARE_UNATTENDED_LAUNCH_PROFILES,
  runCloudflareUnattendedLauncher
} from "../scripts/lib/cloudflare-unattended-launcher.mjs";
import {
  CLOUDFLARE_FOUNDER_ATTENDED_COMMANDS,
  runFounderAttendedServiceTokenCli
} from "../scripts/run-cloudflare-founder-attended-service-token.mjs";

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

function createMockKeychain({
  accountId = fixtureAccountId,
  apiToken = fixtureApiToken,
  smokeClientId,
  smokeClientSecret,
  missing = [],
  addHook,
  deleteHook
} = {}) {
  const values = new Map();
  if (!missing.includes("governedAccountId")) values.set("governedAccountId", Buffer.from(accountId));
  if (!missing.includes("temporaryApiToken")) values.set("temporaryApiToken", Buffer.from(apiToken));
  if (smokeClientId !== undefined) values.set("smokeClientId", Buffer.from(smokeClientId));
  if (smokeClientSecret !== undefined) values.set("smokeClientSecret", Buffer.from(smokeClientSecret));
  const calls = { presence: [], reads: [], adds: [], deletes: [] };
  return {
    values,
    calls,
    hasItem(key) {
      calls.presence.push(key);
      return values.has(key);
    },
    readItem(key) {
      calls.reads.push(key);
      if (!values.has(key)) throw new Error("synthetic-read-failure");
      return Buffer.from(values.get(key));
    },
    addItem(key, value) {
      calls.adds.push(key);
      if (addHook) addHook({ key, value, values });
      else values.set(key, Buffer.from(value));
    },
    deleteItem(key) {
      calls.deletes.push(key);
      if (deleteHook) deleteHook({ key, values });
      else values.delete(key);
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
      now,
      repositoryIdentity,
      accountIdSha256: fixtureAccountDigest,
      randomBytesImpl: () => Buffer.alloc(32, options.nonceByte ?? 7)
    });
  }
  const keychain = options.keychain ?? createMockKeychain(options.keychainOptions);
  const transport = options.transport ?? createMockTransport(options.transportOptions);
  return {
    directory,
    controlPath,
    receiptDirectory: `${controlPath}.consumed`,
    keychain,
    transport,
    cleanup() {
      rmSync(directory, { recursive: true, force: true });
    },
    provision(overrides = {}) {
      return provisionFounderAttendedServiceToken({
        root,
        controlPath,
        now,
        confirmation: overrides.confirmation ?? confirmation(),
        keychain,
        transport,
        repositoryIdentity,
        accountIdSha256Allowlist: [fixtureAccountDigest],
        randomBytesImpl: () => Buffer.alloc(32, options.nonceByte ?? 7),
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
  keychain.addItem("smokeClientSecret", fixtureClientSecret);
  assert.throws(
    () => keychain.readItem("unattendedDeploymentApiToken"),
    /founder_attended_keychain_read_denied/u
  );

  const writeCall = calls.find(call => call.args[1] === "add");
  const readCall = calls.find(call => call.args[1] === "read");
  assert.equal(writeCall.input.toString("utf8"), fixtureClientSecret);
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
  assert.doesNotMatch(source, /print\(|NSLog|ProcessInfo\.processInfo\.environment/u);
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

test("existing or partial smoke credentials fail before reads, control, or network", async t => {
  for (const existing of [
    { smokeClientId: fixtureClientId },
    { smokeClientSecret: fixtureClientSecret },
    { smokeClientId: fixtureClientId, smokeClientSecret: fixtureClientSecret }
  ]) {
    await t.test(Object.keys(existing).join("+"), async () => {
      const harness = createHarness({ keychainOptions: existing });
      try {
        await assert.rejects(harness.provision(), /existing_smoke_credential_present/u);
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
    ["second-write-ambiguous", ({ key, value, values }) => {
      values.set(key, Buffer.from(value));
      if (key === "smokeClientSecret") throw new Error(`ambiguous ${value}`);
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
    addHook({ key, value, values }) {
      values.set(key, Buffer.from(value));
      if (key === "smokeClientSecret") throw new Error("synthetic-write-failure");
    },
    deleteHook({ key, values }) {
      if (key === "smokeClientId") throw new Error("synthetic-delete-failure");
      values.delete(key);
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
  const result = inspectFounderAttendedPresence({ keychain });
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
  const result = cleanupFounderAttendedTemporaryToken({ confirmation: attended, keychain });
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
    () => cleanupFounderAttendedTemporaryToken({ confirmation: confirmation(), keychain }),
    error => error.message === "temporary_api_token_cleanup_failed"
      && !error.message.includes(fixtureApiToken)
  );
  assert.deepEqual(keychain.calls.deletes, ["temporaryApiToken"]);
  assert.equal(keychain.values.has("governedAccountId"), true);
  assert.equal(keychain.values.has("smokeClientId"), true);
  assert.equal(keychain.values.has("smokeClientSecret"), true);
});

test("real confirmation adapter rejects non-TTY invocation before reading input", () => {
  const adapter = createControllingTtyConfirmation({
    input: { isTTY: false, fd: 0 },
    output: { isTTY: false, fd: 1 }
  });
  assert.throws(
    () => adapter.confirm(
      "provision-attended",
      CLOUDFLARE_FOUNDER_ATTENDED_CONFIRMATIONS["provision-attended"]
    ),
    /controlling_tty_required/u
  );
});

test("denied or missing attendance prevents control creation and all network activity", async t => {
  for (const [label, attended] of [
    ["denied", confirmation(false)],
    ["missing", null]
  ]) {
    await t.test(label, async () => {
      const harness = createHarness();
      try {
        await assert.rejects(
          harness.provision({ confirmation: attended }),
          /founder_(?:confirmation_denied|attendance_required)/u
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

test("CLI exposes only presence, provision-attended, and cleanup-temp", async () => {
  assert.deepEqual(CLOUDFLARE_FOUNDER_ATTENDED_COMMANDS, [
    "presence",
    "provision-attended",
    "cleanup-temp"
  ]);
  const calls = [];
  const outputs = [];
  const attended = confirmation();
  const operations = {
    inspectPresence() {
      calls.push("presence");
      return [{ name: "synthetic/name", present: true }];
    },
    async provision(options) {
      calls.push("provision-attended");
      assert.equal(options.confirmation, attended);
      return { status: "provisioned" };
    },
    cleanup(options) {
      calls.push("cleanup-temp");
      assert.equal(options.confirmation, attended);
      return { status: "removed", nextRequiredAction: "Revoke now." };
    }
  };
  await runFounderAttendedServiceTokenCli({
    argv: ["presence"],
    confirmation: attended,
    operations,
    writeOutput: value => outputs.push(value)
  });
  await runFounderAttendedServiceTokenCli({
    argv: ["provision-attended"],
    confirmation: attended,
    operations,
    writeOutput: value => outputs.push(value)
  });
  await runFounderAttendedServiceTokenCli({
    argv: ["cleanup-temp"],
    confirmation: attended,
    operations,
    writeOutput: value => outputs.push(value)
  });
  assert.deepEqual(calls, ["presence", "provision-attended", "cleanup-temp"]);
  for (const forbidden of ["authorize", "provision", "cleanup", "presence extra"]) {
    await assert.rejects(
      runFounderAttendedServiceTokenCli({ argv: forbidden.split(" "), operations }),
      /founder_attended_command_invalid/u
    );
  }
  assert.equal(outputs.some(value => String(value).includes(fixtureApiToken)), false);
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
