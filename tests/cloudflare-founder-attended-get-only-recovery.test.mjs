import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  diagnoseFounderAttendedServiceTokenGetOnlyTestOnly
} from "../scripts/lib/cloudflare-founder-attended-get-only-diagnostic-command.mjs";
import {
  createFounderAttendedGetOnlyCloudflareTransport
} from "../scripts/lib/cloudflare-founder-attended-get-only-diagnostic.mjs";
import {
  CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_CLASSIFICATIONS,
  CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_CONFIRMATIONS,
  CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_CONTROL_MAX_LIFETIME_MS,
  CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_SERVICE_TOKEN_DURATION,
  CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_SERVICE_TOKEN_NAME
} from "../scripts/lib/cloudflare-founder-attended-get-only-recovery-constants.mjs";
import {
  prepareFounderAttendedRecoveryControlTestOnly
} from "../scripts/lib/cloudflare-founder-attended-recovery-control-command.mjs";
import {
  CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_COMPENSATED,
  CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_MANUAL_REVIEW,
  provisionFounderAttendedSuccessorRecoveryTestOnly
} from "../scripts/lib/cloudflare-founder-attended-recovery-provisioning.mjs";

const now = new Date("2026-07-15T18:00:00.000Z");
const repositoryIdentity = Object.freeze({
  commit: "a".repeat(40),
  tree: "b".repeat(40),
  clean: true
});
const fixtureAccountId = "fedcba9876543210fedcba9876543210";
const fixtureAccountDigest = createHash("sha256").update(fixtureAccountId).digest("hex");
const fixtureApiToken = "synthetic-temporary-api-token-value-2002";
const fixtureClientId = `${"c".repeat(32)}.access`;
const fixtureClientSecret = "synthetic-client-secret-value-2002";
const fixtureTokenId = "synthetic-service-token-id-2002";
const createdAt = "2026-07-15T18:00:01.000Z";
const expiresAt = new Date(
  Date.parse(createdAt) + 720 * 60 * 60 * 1000
).toISOString();

function createSandbox(t) {
  const directory = mkdtempSync(join(tmpdir(), "prometheus-get-only-recovery-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return Object.freeze({
    directory,
    artifactRoot: join(directory, "successor")
  });
}

function confirmation(allowed = true, events = []) {
  const calls = [];
  return {
    calls,
    confirm(action, phrase) {
      events.push(`confirm:${action}`);
      calls.push({ action, phrase });
      return allowed;
    }
  };
}

function createMockKeychain({ events = [], missing = [], addFailure = null } = {}) {
  const values = new Map();
  const owners = new Map();
  if (!missing.includes("governedAccountId")) {
    values.set("governedAccountId", Buffer.from(fixtureAccountId));
  }
  if (!missing.includes("temporaryApiToken")) {
    values.set("temporaryApiToken", Buffer.from(fixtureApiToken));
  }
  const calls = { presence: [], reads: [], adds: [], deletes: [] };
  return {
    values,
    calls,
    hasItem(key) {
      events.push(`presence:${key}`);
      calls.presence.push(key);
      return values.has(key);
    },
    readItem(key) {
      events.push(`read:${key}`);
      calls.reads.push(key);
      if (!values.has(key)) throw new Error("synthetic_read_failure");
      return Buffer.from(values.get(key));
    },
    addItem(key, value, ownershipTag) {
      events.push(`add:${key}`);
      calls.adds.push(key);
      if (addFailure === key) throw new Error("synthetic_add_failure");
      values.set(key, Buffer.from(value));
      owners.set(key, ownershipTag);
      return Object.freeze({ created: true });
    },
    deleteOwnedItem(key, ownershipTag) {
      events.push(`delete-owned:${key}`);
      calls.deletes.push(key);
      if (owners.get(key) !== ownershipTag) return Object.freeze({ deleted: false });
      owners.delete(key);
      values.delete(key);
      return Object.freeze({ deleted: true });
    }
  };
}

function envelope(overrides = {}) {
  return {
    status: 200,
    body: JSON.stringify({
      success: true,
      errors: [],
      messages: [],
      ...overrides
    })
  };
}

function creationResponse(overrides = {}) {
  return envelope({
    result: {
      id: fixtureTokenId,
      name: CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_SERVICE_TOKEN_NAME,
      duration: CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_SERVICE_TOKEN_DURATION,
      client_id: fixtureClientId,
      client_secret: fixtureClientSecret,
      created_at: createdAt,
      expires_at: expiresAt,
      ...overrides
    }
  });
}

function createMockTransport({ getPages = [envelope()], post = creationResponse(), del } = {}) {
  const requests = [];
  let getIndex = 0;
  return {
    requests,
    async request(specification) {
      requests.push(specification);
      let response;
      if (specification.method === "GET") {
        response = getPages[Math.min(getIndex, getPages.length - 1)];
        getIndex += 1;
      } else if (specification.method === "POST") {
        response = post;
      } else if (specification.method === "DELETE") {
        response = del ?? envelope({ result: { id: fixtureTokenId } });
      } else {
        throw new Error("synthetic_method_denied");
      }
      if (response instanceof Error) throw response;
      if (typeof response === "function") return response(specification, requests.length);
      return response;
    }
  };
}

function diagnosticOptions({
  artifactRoot,
  keychain = createMockKeychain(),
  transport = createMockTransport(),
  attended = confirmation(),
  clock = () => new Date(now),
  repositoryReader = () => repositoryIdentity,
  nonceByte = 1,
  randomBytesImpl = () => Buffer.alloc(32, nonceByte)
}) {
  return {
    confirmation: attended,
    keychain,
    transport,
    clock,
    repositoryReader,
    accountIdSha256Allowlist: [fixtureAccountDigest],
    artifactRoot,
    randomBytesImpl,
    expectedUid: process.getuid()
  };
}

function preparationOptions({
  artifactRoot,
  keychain = createMockKeychain(),
  attended = confirmation(),
  clock = () => new Date(now),
  repositoryReader = () => repositoryIdentity,
  nonceByte = 2
}) {
  return {
    confirmation: attended,
    keychain,
    clock,
    repositoryReader,
    accountIdSha256Allowlist: [fixtureAccountDigest],
    artifactRoot,
    randomBytesImpl: () => Buffer.alloc(32, nonceByte),
    expectedUid: process.getuid()
  };
}

async function prepareRecoveryFixture(t, options = {}) {
  const sandbox = createSandbox(t);
  const keychain = options.keychain ?? createMockKeychain();
  await diagnoseFounderAttendedServiceTokenGetOnlyTestOnly(diagnosticOptions({
    artifactRoot: sandbox.artifactRoot,
    keychain,
    transport: options.diagnosticTransport ?? createMockTransport(),
    nonceByte: options.diagnosticNonceByte ?? 1
  }));
  prepareFounderAttendedRecoveryControlTestOnly(preparationOptions({
    artifactRoot: sandbox.artifactRoot,
    keychain,
    nonceByte: options.recoveryNonceByte ?? 2
  }));
  return Object.freeze({ ...sandbox, keychain });
}

function recoveryOptions({
  artifactRoot,
  keychain,
  transport,
  attended = confirmation(),
  clock = () => new Date(now),
  repositoryReader = () => repositoryIdentity
}) {
  return {
    confirmation: attended,
    keychain,
    transport,
    clock,
    repositoryReader,
    accountIdSha256Allowlist: [fixtureAccountDigest],
    artifactRoot,
    expectedUid: process.getuid()
  };
}

test("recovery classifications and attended phrases are exact and closed", () => {
  assert.deepEqual(CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_CLASSIFICATIONS, [
    "LIVE_STATE_FAILED",
    "NETWORK_FAILED",
    "AUTHORIZATION_DENIED",
    "VALID_EMPTY_RESULT",
    "DUPLICATE_FOUND",
    "RESPONSE_CONTRACT_MISMATCH",
    "SAFE_TO_PREPARE_RECOVERY"
  ]);
  assert.deepEqual(Object.keys(CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_CONFIRMATIONS), [
    "diagnose-get-only",
    "prepare-recovery",
    "recover-attended"
  ]);
  for (const phrase of Object.values(CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_CONFIRMATIONS)) {
    assert.ok(Buffer.byteLength(phrase, "utf8") <= 192);
  }
});

test("dedicated diagnostic transport rejects every non-GET method before its adapter", () => {
  let adapterCalls = 0;
  const transport = createFounderAttendedGetOnlyCloudflareTransport({
    requestImpl() {
      adapterCalls += 1;
      throw new Error("must_not_run");
    }
  });
  for (const method of ["POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]) {
    assert.throws(
      () => transport.request({ method, url: new URL("https://api.cloudflare.com"), headers: {}, body: null }),
      error => error.message === "LIVE_STATE_FAILED"
    );
  }
  assert.equal(adapterCalls, 0);
});

test("diagnostic rejects before Keychain, network, clock, randomness, or artifact writes", async t => {
  const sandbox = createSandbox(t);
  const events = [];
  const keychain = createMockKeychain({ events });
  const transport = createMockTransport();
  let clockCalls = 0;
  let randomCalls = 0;
  await assert.rejects(
    diagnoseFounderAttendedServiceTokenGetOnlyTestOnly(diagnosticOptions({
      artifactRoot: sandbox.artifactRoot,
      keychain,
      transport,
      attended: confirmation(false, events),
      clock() {
        clockCalls += 1;
        return new Date(now);
      },
      nonceByte: 1,
      repositoryReader: () => repositoryIdentity,
      randomBytesImpl: () => {
        randomCalls += 1;
        return Buffer.alloc(32, 1);
      }
    })),
    error => error.message === "LIVE_STATE_FAILED"
  );
  assert.deepEqual(events, ["confirm:diagnose-get-only"]);
  assert.equal(clockCalls, 0);
  assert.equal(randomCalls, 0);
  assert.equal(transport.requests.length, 0);
  assert.equal(existsSync(sandbox.artifactRoot), false);
});

test("omitted optional result and result_info are a valid empty safe diagnostic", async t => {
  const sandbox = createSandbox(t);
  const attended = confirmation();
  const transport = createMockTransport({ getPages: [envelope()] });
  const result = await diagnoseFounderAttendedServiceTokenGetOnlyTestOnly(diagnosticOptions({
    artifactRoot: sandbox.artifactRoot,
    transport,
    attended
  }));
  assert.deepEqual(result.classifications, ["VALID_EMPTY_RESULT", "SAFE_TO_PREPARE_RECOVERY"]);
  assert.equal(result.validEmptyResult, true);
  assert.deepEqual(attended.calls, [{
    action: "diagnose-get-only",
    phrase: CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_CONFIRMATIONS["diagnose-get-only"]
  }]);
  assert.equal(transport.requests.length, 1);
  const [request] = transport.requests;
  assert.equal(request.method, "GET");
  assert.equal(request.body, null);
  assert.equal(request.url.searchParams.get("name"), CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_SERVICE_TOKEN_NAME);
  assert.equal(request.url.searchParams.get("page"), "1");
  assert.equal(request.url.searchParams.get("per_page"), "20");
  assert.deepEqual([...request.url.searchParams.keys()], ["name", "page", "per_page"]);

  const diagnosticDirectory = join(sandbox.artifactRoot, "diagnostics");
  const files = readdirSync(diagnosticDirectory);
  assert.equal(files.length, 1);
  assert.equal(lstatSync(diagnosticDirectory).mode & 0o777, 0o700);
  assert.equal(lstatSync(join(diagnosticDirectory, files[0])).mode & 0o777, 0o600);
});

test("partial optional result_info and unfiltered inventory totals are accepted", async t => {
  for (const [index, resultInfo] of [
    { page: 1 },
    { count: 0, total_count: 0, total_pages: 0 },
    { page: 1, per_page: 20, count: 0 },
    { page: 1, per_page: 20, count: 0, total_count: 2001 }
  ].entries()) {
    const sandbox = createSandbox(t);
    const result = await diagnoseFounderAttendedServiceTokenGetOnlyTestOnly(diagnosticOptions({
      artifactRoot: sandbox.artifactRoot,
      transport: createMockTransport({
        getPages: [envelope({ result: [], result_info: resultInfo })]
      }),
      nonceByte: index + 1
    }));
    assert.deepEqual(result.classifications, ["VALID_EMPTY_RESULT", "SAFE_TO_PREPARE_RECOVERY"]);
  }
});

test("safe pagination follows multiple pages without weakening exact-name matching", async t => {
  const sandbox = createSandbox(t);
  const firstPage = Array.from({ length: 20 }, (_, index) => ({ name: `unrelated-${index}` }));
  const transport = createMockTransport({
    getPages: [
      envelope({
        result: firstPage,
        result_info: { page: 1, per_page: 20, count: 20, total_count: 21 }
      }),
      envelope({
        result: [{ name: "unrelated-final" }],
        result_info: {
          page: 2,
          per_page: 20,
          count: 1,
          total_count: 21,
          total_pages: 2
        }
      })
    ]
  });
  const result = await diagnoseFounderAttendedServiceTokenGetOnlyTestOnly(diagnosticOptions({
    artifactRoot: sandbox.artifactRoot,
    transport
  }));
  assert.deepEqual(result.classifications, ["SAFE_TO_PREPARE_RECOVERY"]);
  assert.deepEqual(transport.requests.map(request => request.url.searchParams.get("page")), ["1", "2"]);
  assert.ok(transport.requests.every(request => request.method === "GET"));
});

test("a full page without metadata proof fails closed instead of speculating", async t => {
  const sandbox = createSandbox(t);
  const transport = createMockTransport({
    getPages: [envelope({
      result: Array.from({ length: 20 }, (_, index) => ({ name: `unrelated-${index}` }))
    })]
  });
  await assert.rejects(
    diagnoseFounderAttendedServiceTokenGetOnlyTestOnly(diagnosticOptions({
      artifactRoot: sandbox.artifactRoot,
      transport
    })),
    error => error.message === "RESPONSE_CONTRACT_MISMATCH"
  );
  assert.equal(transport.requests.length, 1);
  assert.equal(existsSync(join(sandbox.artifactRoot, "diagnostics")), false);
});

test("malformed envelopes and pagination contradictions fail closed without evidence", async t => {
  const cases = [
    { status: 200, body: "{" },
    envelope({ result: null }),
    envelope({ result: [], result_info: "invalid" }),
    envelope({ result: [{}] }),
    envelope({ result: [{ name: "unrelated" }], result_info: { total_pages: 0 } }),
    envelope({ result: [], result_info: { count: 1 } }),
    envelope({ result: [{ name: "unrelated" }], result_info: { total_count: 0 } }),
    envelope({ result: [], result_info: { per_page: 19 } }),
    envelope({ result: [{ name: "unrelated" }], result_info: { total_pages: 2 } }),
    envelope({ result: [], result_info: { total_pages: 101 } }),
    { status: 302, body: JSON.stringify({ success: true, errors: [], messages: [] }) },
    { status: 200, body: "{\"success\":true,\"success\":true,\"errors\":[],\"messages\":[]}" }
  ];
  for (const [index, response] of cases.entries()) {
    const sandbox = createSandbox(t);
    await assert.rejects(
      diagnoseFounderAttendedServiceTokenGetOnlyTestOnly(diagnosticOptions({
        artifactRoot: sandbox.artifactRoot,
        transport: createMockTransport({ getPages: [response] }),
        nonceByte: index + 1
      })),
      error => error.message === "RESPONSE_CONTRACT_MISMATCH"
    );
    assert.equal(existsSync(join(sandbox.artifactRoot, "diagnostics")), false);
  }

  const changingTotalsSandbox = createSandbox(t);
  const fullPage = Array.from({ length: 20 }, (_, index) => ({ name: `unrelated-${index}` }));
  await assert.rejects(
    diagnoseFounderAttendedServiceTokenGetOnlyTestOnly(diagnosticOptions({
      artifactRoot: changingTotalsSandbox.artifactRoot,
      transport: createMockTransport({
        getPages: [
          envelope({ result: fullPage, result_info: { total_count: 21 } }),
          envelope({
            result: [{ name: "unrelated-final" }],
            result_info: { page: 2, count: 1, total_count: 22 }
          })
        ]
      })
    })),
    error => error.message === "RESPONSE_CONTRACT_MISMATCH"
  );
  assert.equal(existsSync(join(changingTotalsSandbox.artifactRoot, "diagnostics")), false);
});

test("authorization denial and network failure have distinct fixed classifications", async t => {
  for (const status of [401, 403]) {
    const sandbox = createSandbox(t);
    await assert.rejects(
      diagnoseFounderAttendedServiceTokenGetOnlyTestOnly(diagnosticOptions({
        artifactRoot: sandbox.artifactRoot,
        transport: createMockTransport({
          getPages: [{ status, body: JSON.stringify({ sensitive: fixtureApiToken }) }]
        })
      })),
      error => error.message === "AUTHORIZATION_DENIED"
    );
  }
  const sandbox = createSandbox(t);
  await assert.rejects(
    diagnoseFounderAttendedServiceTokenGetOnlyTestOnly(diagnosticOptions({
      artifactRoot: sandbox.artifactRoot,
      transport: createMockTransport({ getPages: [new Error(fixtureApiToken)] })
    })),
    error => error.message === "NETWORK_FAILED"
  );
});

test("an exact-name duplicate on any page fails closed and never writes recovery evidence", async t => {
  const sandbox = createSandbox(t);
  const firstPage = Array.from({ length: 20 }, (_, index) => ({ name: `unrelated-${index}` }));
  const transport = createMockTransport({
    getPages: [
      envelope({ result: firstPage, result_info: { total_pages: 2 } }),
      envelope({ result: [{ name: CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_SERVICE_TOKEN_NAME }] })
    ]
  });
  await assert.rejects(
    diagnoseFounderAttendedServiceTokenGetOnlyTestOnly(diagnosticOptions({
      artifactRoot: sandbox.artifactRoot,
      transport
    })),
    error => error.message === "DUPLICATE_FOUND"
  );
  assert.equal(transport.requests.length, 2);
  assert.equal(existsSync(join(sandbox.artifactRoot, "diagnostics")), false);
});

test("classification output never contains credentials, account data, headers, hashes, or response fields", async t => {
  const sandbox = createSandbox(t);
  let captured;
  try {
    await diagnoseFounderAttendedServiceTokenGetOnlyTestOnly(diagnosticOptions({
      artifactRoot: sandbox.artifactRoot,
      transport: createMockTransport({
        getPages: [{
          status: 200,
          body: JSON.stringify({
            success: true,
            errors: [],
            messages: [],
            result: "malformed",
            credential: fixtureClientSecret
          })
        }]
      })
    }));
  } catch (error) {
    captured = error.message;
  }
  assert.equal(captured, "RESPONSE_CONTRACT_MISMATCH");
  for (const forbidden of [
    fixtureAccountId,
    fixtureAccountDigest,
    fixtureApiToken,
    fixtureClientId,
    fixtureClientSecret,
    fixtureTokenId,
    "Authorization",
    "Bearer",
    "client_secret"
  ]) {
    assert.equal(captured.includes(forbidden), false);
  }
});

test("recovery preparation requires successful evidence and confirmation before local activity", async t => {
  const sandbox = createSandbox(t);
  const events = [];
  const keychain = createMockKeychain({ events });
  assert.throws(
    () => prepareFounderAttendedRecoveryControlTestOnly(preparationOptions({
      artifactRoot: sandbox.artifactRoot,
      keychain,
      attended: confirmation(false, events)
    })),
    error => error.message === "LIVE_STATE_FAILED"
  );
  assert.deepEqual(events, ["confirm:prepare-recovery"]);
  assert.equal(existsSync(sandbox.artifactRoot), false);

  const second = createSandbox(t);
  assert.throws(
    () => prepareFounderAttendedRecoveryControlTestOnly(preparationOptions({
      artifactRoot: second.artifactRoot
    })),
    error => error.message === "LIVE_STATE_FAILED"
  );
  assert.equal(existsSync(join(second.artifactRoot, "recovery-control.json")), false);
});

test("one diagnostic prepares one fresh bounded successor without changing predecessor fixtures", async t => {
  const sandbox = createSandbox(t);
  const predecessorDirectory = join(sandbox.directory, "predecessor");
  const predecessorControl = join(predecessorDirectory, "control.json");
  const predecessorReceipt = join(predecessorDirectory, "consumed-receipt.json");
  mkdirSync(predecessorDirectory, { mode: 0o700 });
  writeFileSync(predecessorControl, "immutable predecessor control\n", { mode: 0o600, flag: "wx" });
  writeFileSync(predecessorReceipt, "immutable predecessor receipt\n", { mode: 0o600, flag: "wx" });
  const predecessorControlBefore = readFileSync(predecessorControl);
  const predecessorReceiptBefore = readFileSync(predecessorReceipt);

  const keychain = createMockKeychain();
  await diagnoseFounderAttendedServiceTokenGetOnlyTestOnly(diagnosticOptions({
    artifactRoot: sandbox.artifactRoot,
    keychain,
    nonceByte: 3
  }));
  const diagnosticName = readdirSync(join(sandbox.artifactRoot, "diagnostics"))[0];
  const diagnostic = JSON.parse(readFileSync(
    join(sandbox.artifactRoot, "diagnostics", diagnosticName),
    "utf8"
  ));
  const attended = confirmation();
  const result = prepareFounderAttendedRecoveryControlTestOnly(preparationOptions({
    artifactRoot: sandbox.artifactRoot,
    keychain,
    attended,
    nonceByte: 4
  }));
  assert.deepEqual(result, { classification: "SAFE_TO_PREPARE_RECOVERY" });
  assert.deepEqual(attended.calls, [{
    action: "prepare-recovery",
    phrase: CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_CONFIRMATIONS["prepare-recovery"]
  }]);

  const controlPath = join(sandbox.artifactRoot, "recovery-control.json");
  const controlBeforeReplay = readFileSync(controlPath);
  const control = JSON.parse(controlBeforeReplay.toString("utf8"));
  assert.notEqual(control.oneShotAuthorizationNonce, diagnostic.diagnosticNonce);
  assert.equal(control.authorizedCommit, repositoryIdentity.commit);
  assert.equal(control.authorizedTree, repositoryIdentity.tree);
  assert.equal(control.accountIdSha256, fixtureAccountDigest);
  assert.ok(Date.parse(control.expiresAt) - Date.parse(control.issuedAt)
    <= CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_CONTROL_MAX_LIFETIME_MS);
  assert.equal(lstatSync(controlPath).mode & 0o777, 0o600);
  assert.equal(readdirSync(join(sandbox.artifactRoot, "diagnostic-consumptions")).length, 1);

  assert.throws(
    () => prepareFounderAttendedRecoveryControlTestOnly(preparationOptions({
      artifactRoot: sandbox.artifactRoot,
      keychain,
      nonceByte: 5
    })),
    error => error.message === "LIVE_STATE_FAILED"
  );
  assert.deepEqual(readFileSync(controlPath), controlBeforeReplay);
  assert.deepEqual(readFileSync(predecessorControl), predecessorControlBefore);
  assert.deepEqual(readFileSync(predecessorReceipt), predecessorReceiptBefore);
});

test("later recovery confirmation precedes Keychain, control consumption, and network", async t => {
  const fixture = await prepareRecoveryFixture(t);
  const events = [];
  const keychain = createMockKeychain({ events });
  const transport = createMockTransport();
  await assert.rejects(
    provisionFounderAttendedSuccessorRecoveryTestOnly(recoveryOptions({
      artifactRoot: fixture.artifactRoot,
      keychain,
      transport,
      attended: confirmation(false, events)
    })),
    error => error.message === "LIVE_STATE_FAILED"
  );
  assert.deepEqual(events, ["confirm:recover-attended"]);
  assert.equal(transport.requests.length, 0);
  assert.equal(existsSync(join(fixture.artifactRoot, "recovery-control-consumptions")), false);
});

test("later recovery rejects a successor whose diagnostic lineage was changed", async t => {
  const fixture = await prepareRecoveryFixture(t);
  const controlPath = join(fixture.artifactRoot, "recovery-control.json");
  const control = JSON.parse(readFileSync(controlPath, "utf8"));
  control.diagnosticNonceSha256 = "f".repeat(64);
  writeFileSync(controlPath, `${JSON.stringify(control, null, 2)}\n`, "utf8");

  const transport = createMockTransport();
  await assert.rejects(
    provisionFounderAttendedSuccessorRecoveryTestOnly(recoveryOptions({
      artifactRoot: fixture.artifactRoot,
      keychain: fixture.keychain,
      transport
    })),
    error => error.message === "LIVE_STATE_FAILED"
  );
  assert.equal(transport.requests.length, 0);
  assert.equal(existsSync(join(fixture.artifactRoot, "recovery-control-consumptions")), false);
});

test("later recovery uses paginated GET preflight then exactly one create attempt", async t => {
  const fixture = await prepareRecoveryFixture(t);
  const transport = createMockTransport({ getPages: [envelope()] });
  const attended = confirmation();
  const result = await provisionFounderAttendedSuccessorRecoveryTestOnly(recoveryOptions({
    artifactRoot: fixture.artifactRoot,
    keychain: fixture.keychain,
    transport,
    attended
  }));
  assert.equal(result.recoveryOutcome, "SUCCESS");
  assert.equal(result.remoteCreateAttempts, 1);
  assert.equal(result.temporaryTokenPreserved, true);
  assert.deepEqual(transport.requests.map(request => request.method), ["GET", "POST"]);
  assert.equal(transport.requests.filter(request => request.method === "POST").length, 1);
  assert.equal(fixture.keychain.values.has("temporaryApiToken"), true);
  assert.equal(fixture.keychain.values.has("smokeClientId"), true);
  assert.equal(fixture.keychain.values.has("smokeClientSecret"), true);
  assert.equal(fixture.keychain.calls.deletes.includes("temporaryApiToken"), false);
  assert.deepEqual(attended.calls, [{
    action: "recover-attended",
    phrase: CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_CONFIRMATIONS["recover-attended"]
  }]);
});

test("an ambiguous later create is never retried and the consumed control cannot replay", async t => {
  const fixture = await prepareRecoveryFixture(t);
  const transport = createMockTransport({ post: new Error(fixtureApiToken) });
  let firstError;
  try {
    await provisionFounderAttendedSuccessorRecoveryTestOnly(recoveryOptions({
      artifactRoot: fixture.artifactRoot,
      keychain: fixture.keychain,
      transport
    }));
  } catch (error) {
    firstError = error;
  }
  assert.equal(firstError.message, "NETWORK_FAILED");
  assert.equal(firstError.recoveryOutcome, CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_MANUAL_REVIEW);
  assert.deepEqual(transport.requests.map(request => request.method), ["GET", "POST"]);

  await assert.rejects(
    provisionFounderAttendedSuccessorRecoveryTestOnly(recoveryOptions({
      artifactRoot: fixture.artifactRoot,
      keychain: fixture.keychain,
      transport
    })),
    error => error.message === "LIVE_STATE_FAILED"
  );
  assert.equal(transport.requests.filter(request => request.method === "POST").length, 1);
  assert.equal(fixture.keychain.values.has("temporaryApiToken"), true);
});

test("duplicate recovery preflight performs no create attempt", async t => {
  const fixture = await prepareRecoveryFixture(t);
  const transport = createMockTransport({
    getPages: [envelope({
      result: [{ name: CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_SERVICE_TOKEN_NAME }]
    })]
  });
  await assert.rejects(
    provisionFounderAttendedSuccessorRecoveryTestOnly(recoveryOptions({
      artifactRoot: fixture.artifactRoot,
      keychain: fixture.keychain,
      transport
    })),
    error => error.message === "DUPLICATE_FOUND"
  );
  assert.deepEqual(transport.requests.map(request => request.method), ["GET"]);
});

test("invalid creation with a safe identifier compensates once without a second create", async t => {
  const fixture = await prepareRecoveryFixture(t);
  const transport = createMockTransport({
    post: creationResponse({ duration: "1h" })
  });
  let captured;
  try {
    await provisionFounderAttendedSuccessorRecoveryTestOnly(recoveryOptions({
      artifactRoot: fixture.artifactRoot,
      keychain: fixture.keychain,
      transport
    }));
  } catch (error) {
    captured = error;
  }
  assert.equal(captured.message, "RESPONSE_CONTRACT_MISMATCH");
  assert.equal(captured.recoveryOutcome, CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_COMPENSATED);
  assert.deepEqual(transport.requests.map(request => request.method), ["GET", "POST", "DELETE"]);
  assert.equal(transport.requests.filter(request => request.method === "POST").length, 1);
  assert.equal(fixture.keychain.values.has("temporaryApiToken"), true);
});
