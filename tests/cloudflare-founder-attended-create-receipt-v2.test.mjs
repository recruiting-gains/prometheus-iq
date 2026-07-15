import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import {
  readFounderAttendedCreateReceiptV2ReasonsTestOnly
} from "../scripts/lib/cloudflare-founder-attended-create-receipt-v2-artifacts.mjs";
import {
  CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_CONFIRMATIONS,
  CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_FINAL_OUTCOMES,
  CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_NEXT_SAFE_COMMAND,
  CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_REASON_CODES,
  CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_SERVICE_TOKEN_DURATION,
  CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_SERVICE_TOKEN_NAME
} from "../scripts/lib/cloudflare-founder-attended-create-receipt-v2-constants.mjs";
import {
  createFounderAttendedCreateReceiptV2ProductionTransport
} from "../scripts/lib/cloudflare-founder-attended-create-receipt-v2-production.mjs";
import {
  classifyFounderAttendedCreateReceiptV2ResponseTestOnly,
  provisionFounderAttendedCreateReceiptV2TestOnly
} from "../scripts/lib/cloudflare-founder-attended-create-receipt-v2-workflow.mjs";
import {
  readFounderAttendedResponseContractAttemptStateTestOnly,
  readFounderAttendedResponseContractPhasesTestOnly
} from "../scripts/lib/cloudflare-founder-attended-response-contract-artifacts.mjs";
import {
  diagnoseFounderAttendedResponseContractAbsenceTestOnly,
  prepareFounderAttendedResponseContractControlTestOnly
} from "../scripts/lib/cloudflare-founder-attended-response-contract-workflow.mjs";

const repositoryRoot = resolve(import.meta.dirname, "..");
const now = new Date("2026-07-15T23:00:00.000Z");
const repositoryIdentity = Object.freeze({
  commit: "a".repeat(40),
  tree: "b".repeat(40),
  clean: true
});
const fixtureAccountId = "fedcba9876543210fedcba9876543210";
const fixtureAccountDigest = createHash("sha256").update(fixtureAccountId).digest("hex");
const fixtureApiToken = "synthetic-temporary-api-token-value-4004";
const fixtureClientId = `${"c".repeat(32)}.access`;
const documentedClientId = `${"d".repeat(32)}.access.example.com`;
const fixtureClientSecret = "synthetic-client-secret-value-4004";
const fixtureTokenId = "f174e90a-fafe-4643-bbbc-4a0ed4fc8415";

function sandbox(t) {
  const root = mkdtempSync(join(tmpdir(), "prometheus-create-receipt-v2-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return Object.freeze({ root, artifactRoot: join(root, "create-receipt-v2") });
}

function confirmation({ compensation = true, allowed = true, events = [] } = {}) {
  return Object.freeze({
    confirm(action, phrase) {
      events.push(`confirm:${action}`);
      assert.equal(phrase, CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_CONFIRMATIONS[action]);
      return action === "compensate-v2-created-resource" ? compensation : allowed;
    }
  });
}

function keychain({ events = [], addFailure = null, rollbackFailure = false } = {}) {
  const values = new Map([
    ["governedAccountId", Buffer.from(fixtureAccountId)],
    ["temporaryApiToken", Buffer.from(fixtureApiToken)]
  ]);
  const owners = new Map();
  const calls = { reads: [], adds: [], deletes: [] };
  return {
    values,
    calls,
    hasItem(key) {
      events.push(`presence:${key}`);
      return values.has(key);
    },
    readItem(key) {
      events.push(`read:${key}`);
      calls.reads.push(key);
      if (!values.has(key)) throw new Error("fixture_missing");
      return Buffer.from(values.get(key));
    },
    addItem(key, value, owner) {
      events.push(`add:${key}`);
      calls.adds.push(key);
      if (addFailure === key) throw new Error("fixture_store_failure");
      values.set(key, Buffer.from(value));
      owners.set(key, owner);
      return Object.freeze({ created: true });
    },
    deleteOwnedItem(key, owner) {
      events.push(`delete:${key}`);
      calls.deletes.push(key);
      if (rollbackFailure || owners.get(key) !== owner) return Object.freeze({ deleted: false });
      values.delete(key);
      owners.delete(key);
      return Object.freeze({ deleted: true });
    }
  };
}

function envelope(result, extra = {}) {
  return Object.freeze({
    status: 200,
    body: JSON.stringify({ success: true, errors: [], messages: [], result, ...extra })
  });
}

function emptyList(extra = {}) {
  return envelope([], extra);
}

function exactList({
  id = fixtureTokenId,
  duration = CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_SERVICE_TOKEN_DURATION,
  duplicate = false,
  name = CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_SERVICE_TOKEN_NAME,
  extra = {}
} = {}) {
  const record = { id, name, duration };
  return envelope(duplicate ? [record, { ...record }] : [record], extra);
}

function createResponse({ omit = [], overrides = {}, envelopeOverrides = {}, status = 200 } = {}) {
  const result = {
    id: fixtureTokenId,
    name: CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_SERVICE_TOKEN_NAME,
    duration: CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_SERVICE_TOKEN_DURATION,
    client_id: documentedClientId,
    client_secret: fixtureClientSecret,
    created_at: "2026-07-15T23:00:01.12345Z",
    updated_at: "2026-07-15T23:00:01.12345Z",
    ...overrides
  };
  for (const key of omit) delete result[key];
  return Object.freeze({
    status,
    body: JSON.stringify({ success: true, result, ...envelopeOverrides })
  });
}

function deleteResponse(overrides = {}) {
  return Object.freeze({
    status: 200,
    body: JSON.stringify({
      success: true,
      result: {
        id: fixtureTokenId,
        name: CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_SERVICE_TOKEN_NAME,
        duration: CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_SERVICE_TOKEN_DURATION,
        ...overrides
      }
    })
  });
}

function transport({
  gets = [emptyList(), exactList(), emptyList()],
  post = createResponse(),
  del = deleteResponse(),
  events = []
} = {}) {
  const requests = [];
  let getIndex = 0;
  return {
    requests,
    async request(specification) {
      requests.push(specification);
      events.push(`request:${specification.method}`);
      let response;
      if (specification.method === "GET") {
        response = gets[Math.min(getIndex, gets.length - 1)];
        getIndex += 1;
      } else if (specification.method === "POST") response = post;
      else if (specification.method === "DELETE") response = del;
      else throw new Error("fixture_method_denied");
      if (response instanceof Error) throw response;
      return typeof response === "function" ? response(specification) : response;
    }
  };
}

function common({ artifactRoot, attended = confirmation(), store = keychain() }) {
  return {
    confirmation: attended,
    keychain: store,
    clock: () => new Date(now),
    repositoryReader: () => repositoryIdentity,
    accountIdSha256Allowlist: [fixtureAccountDigest],
    artifactRoot,
    expectedUid: process.getuid()
  };
}

async function prepareFixture(t, { store = keychain() } = {}) {
  const box = sandbox(t);
  await diagnoseFounderAttendedResponseContractAbsenceTestOnly({
    ...common({ artifactRoot: box.artifactRoot, store }),
    transport: transport({ gets: [emptyList()] }),
    randomBytesImpl: () => Buffer.alloc(32, 4)
  });
  const prepared = prepareFounderAttendedResponseContractControlTestOnly({
    ...common({ artifactRoot: box.artifactRoot, store }),
    randomBytesImpl: () => Buffer.alloc(32, 5)
  });
  const control = JSON.parse(
    readFileSync(join(prepared.attemptRoot, "successor-control.json"), "utf8")
  );
  return Object.freeze({
    ...box,
    control,
    store,
    attemptId: prepared.attemptId,
    attemptRoot: prepared.attemptRoot
  });
}

function phases(fixture) {
  return readFounderAttendedResponseContractPhasesTestOnly({
    artifactRoot: fixture.attemptRoot,
    control: fixture.control,
    expectedUid: process.getuid()
  });
}

function reasons(fixture) {
  return readFounderAttendedCreateReceiptV2ReasonsTestOnly({
    artifactRoot: fixture.attemptRoot,
    attemptId: fixture.attemptId,
    expectedUid: process.getuid()
  });
}

function attemptStates(artifactRoot) {
  return readFounderAttendedResponseContractAttemptStateTestOnly({
    artifactRoot,
    expectedUid: process.getuid()
  });
}

function allFiles(root) {
  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...allFiles(path));
    else files.push(path);
  }
  return files;
}

test("v2 reason and outcome vocabularies are closed", () => {
  assert.deepEqual(CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_FINAL_OUTCOMES, [
    "SUCCESS", "COMPENSATED", "MANUAL_REVIEW"
  ]);
  assert.equal(new Set(CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_REASON_CODES).size,
    CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_REASON_CODES.length);
  assert.ok(CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_REASON_CODES.includes(
    "CREATE_CLIENT_ID_REJECTED"
  ));
  assert.ok(CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_REASON_CODES.includes(
    "CREATE_CLIENT_SECRET_REJECTED"
  ));
});

test("create classifier accepts official optional echoes and exposes fixed metadata only", () => {
  const response = createResponse({
    omit: ["name", "duration"],
    overrides: {
      expires_at: "2026-08-14T23:00:01.12345Z",
      last_seen_at: "2026-07-15T23:05:01.12345Z",
      previous_client_secret_expires_at: "2026-07-16T23:00:01.12345Z"
    }
  });
  const result = classifyFounderAttendedCreateReceiptV2ResponseTestOnly(response);
  assert.deepEqual(result, {
    accepted: true,
    reasonCode: "CREATE_RESPONSE_ACCEPTED",
    httpStatusClass: "DOCUMENTED_200",
    compensationCandidate: true,
    exactNameProofRequired: true
  });
  assert.doesNotMatch(JSON.stringify(result), new RegExp(fixtureTokenId, "u"));
  assert.doesNotMatch(JSON.stringify(result), new RegExp(fixtureClientSecret, "u"));
  assert.doesNotMatch(JSON.stringify(result), new RegExp(documentedClientId.replaceAll(".", "\\."), "u"));
});

test("alternate bounded 2xx statuses are eligible only when the full success contract passes", () => {
  const response = createResponse({ status: 201, omit: ["name", "duration"] });
  const result = classifyFounderAttendedCreateReceiptV2ResponseTestOnly(response);
  assert.deepEqual(result, {
    accepted: true,
    reasonCode: "CREATE_RESPONSE_ACCEPTED",
    httpStatusClass: "ALTERNATE_2XX",
    compensationCandidate: true,
    exactNameProofRequired: true
  });
});

test("credential classifier distinguishes missing from malformed bounded values", () => {
  for (const [response, reasonCode] of [
    [createResponse({ omit: ["client_id"] }), "CREATE_CLIENT_ID_MISSING"],
    [createResponse({ overrides: { client_id: " " } }), "CREATE_CLIENT_ID_REJECTED"],
    [createResponse({ overrides: { client_id: `${"e".repeat(32)}.access.\u0000invalid` } }),
      "CREATE_CLIENT_ID_REJECTED"],
    [createResponse({ overrides: { client_id: `${"e".repeat(65)}.access` } }),
      "CREATE_CLIENT_ID_REJECTED"],
    [createResponse({ omit: ["client_secret"] }), "CREATE_CLIENT_SECRET_MISSING"],
    [createResponse({ overrides: { client_secret: "\t" } }), "CREATE_CLIENT_SECRET_REJECTED"],
    [createResponse({ overrides: { client_secret: `safe\u0000controlvalue` } }),
      "CREATE_CLIENT_SECRET_REJECTED"],
    [createResponse({ overrides: { client_secret: "s".repeat(4097) } }),
      "CREATE_CLIENT_SECRET_REJECTED"]
  ]) {
    const result = classifyFounderAttendedCreateReceiptV2ResponseTestOnly(response);
    assert.equal(result.accepted, false);
    assert.equal(result.reasonCode, reasonCode);
    assert.equal(result.httpStatusClass, "DOCUMENTED_200");
    assert.equal(result.compensationCandidate, true);
  }
  assert.equal(classifyFounderAttendedCreateReceiptV2ResponseTestOnly(
    createResponse({ overrides: { client_id: fixtureClientId } })
  ).accepted, true);
});

test("create classifier rejects contradictory and ambiguous response dimensions", () => {
  for (const [response, reasonCode, httpStatusClass, candidate] of [
    [{ status: 503, body: "{}" }, "CREATE_HTTP_STATUS_REJECTED", "NON_2XX", false],
    [{ status: 200, body: "{" }, "CREATE_BODY_REJECTED", "DOCUMENTED_200", false],
    [{ status: 204, body: "" }, "CREATE_BODY_REJECTED", "ALTERNATE_2XX", false],
    [{ status: 200, body: JSON.stringify({ success: false }) },
      "CREATE_ENVELOPE_REJECTED", "DOCUMENTED_200", false],
    [createResponse({ envelopeOverrides: { errors: [{ code: 1000 }] } }),
      "CREATE_ERRORS_REPORTED", "DOCUMENTED_200", false],
    [createResponse({ omit: ["id"] }), "CREATE_RESOURCE_ID_MISSING", "DOCUMENTED_200", false],
    [createResponse({ overrides: { id: "unsafe/id" } }), "CREATE_RESOURCE_ID_REJECTED", "DOCUMENTED_200", false],
    [createResponse({ overrides: { name: "Wrong token" } }), "CREATE_NAME_ECHO_MISMATCH", "DOCUMENTED_200", false],
    [createResponse({ overrides: { duration: "8760h" } }),
      "CREATE_DURATION_ECHO_MISMATCH", "DOCUMENTED_200", false],
    [createResponse({ overrides: { updated_at: "not-a-time" } }),
      "CREATE_TIMESTAMP_REJECTED", "DOCUMENTED_200", true]
  ]) {
    const result = classifyFounderAttendedCreateReceiptV2ResponseTestOnly(response);
    assert.equal(result.reasonCode, reasonCode);
    assert.equal(result.httpStatusClass, httpStatusClass);
    assert.equal(result.compensationCandidate, candidate);
  }
});

test("optional create echoes require bounded exact-name GET proof before storage", async t => {
  const events = [];
  const store = keychain({ events });
  const fixture = await prepareFixture(t, { store });
  events.length = 0;
  const remote = transport({
    post: createResponse({ omit: ["name", "duration"] }),
    events
  });
  const result = await provisionFounderAttendedCreateReceiptV2TestOnly({
    ...common({ artifactRoot: fixture.artifactRoot, store }),
    transport: remote
  });
  assert.deepEqual(result, {
    outcome: "SUCCESS",
    reasonCode: "CREATE_RESPONSE_ACCEPTED",
    remoteCreateAttempts: 1,
    remoteDeleteAttempts: 0
  });
  assert.deepEqual(remote.requests.map(request => request.method), ["GET", "POST", "GET"]);
  assert.ok(events.indexOf("request:GET") < events.indexOf("add:smokeClientId"));
  assert.deepEqual(reasons(fixture), [
    "CREATE_HTTP_STATUS_DOCUMENTED_200",
    "CREATE_RESPONSE_ACCEPTED"
  ]);
  assert.deepEqual(phases(fixture), [
    "GET_COMPLETED", "EXACT_NAME_ABSENT", "POST_ATTEMPTED", "GET_COMPLETED",
    "EXACT_NAME_PRESENT", "CREATE_RESPONSE_VALID", "KEYCHAIN_STORED", "SUCCESS"
  ]);
});

test("alternate 2xx responses can succeed only after exact-name proof and Keychain storage", async t => {
  const fixture = await prepareFixture(t);
  const remote = transport({
    post: createResponse({ status: 201, omit: ["name", "duration"] })
  });
  const result = await provisionFounderAttendedCreateReceiptV2TestOnly({
    ...common({ artifactRoot: fixture.artifactRoot, store: fixture.store }),
    transport: remote
  });
  assert.deepEqual(result, {
    outcome: "SUCCESS",
    reasonCode: "CREATE_RESPONSE_ACCEPTED",
    remoteCreateAttempts: 1,
    remoteDeleteAttempts: 0
  });
  assert.deepEqual(reasons(fixture), [
    "CREATE_HTTP_STATUS_ALTERNATE_2XX",
    "CREATE_RESPONSE_ACCEPTED"
  ]);
});

test("wrong-name or wrong-duration responses never receive proof or compensation", async t => {
  for (const [field, value, reasonCode] of [
    ["name", "Wrong token", "CREATE_NAME_ECHO_MISMATCH"],
    ["duration", "8760h", "CREATE_DURATION_ECHO_MISMATCH"]
  ]) {
    await t.test(field, async t2 => {
      const fixture = await prepareFixture(t2);
      const remote = transport({ post: createResponse({ overrides: { [field]: value } }) });
      const result = await provisionFounderAttendedCreateReceiptV2TestOnly({
        ...common({ artifactRoot: fixture.artifactRoot, store: fixture.store }),
        transport: remote
      });
      assert.equal(result.outcome, "MANUAL_REVIEW");
      assert.equal(result.reasonCode, reasonCode);
      assert.deepEqual(remote.requests.map(request => request.method), ["GET", "POST"]);
      assert.equal(result.remoteDeleteAttempts, 0);
      assert.deepEqual(reasons(fixture), [
        "CREATE_HTTP_STATUS_DOCUMENTED_200",
        reasonCode
      ]);
    });
  }
});

test("missing credential can compensate only after unique exact-name ID and duration proof", async t => {
  const events = [];
  const fixture = await prepareFixture(t);
  const remote = transport({
    post: createResponse({ omit: ["client_secret"] }),
    events
  });
  const result = await provisionFounderAttendedCreateReceiptV2TestOnly({
    ...common({
      artifactRoot: fixture.artifactRoot,
      store: fixture.store,
      attended: confirmation({ events })
    }),
    transport: remote
  });
  assert.equal(result.outcome, "COMPENSATED");
  assert.deepEqual(remote.requests.map(request => request.method), [
    "GET", "POST", "GET", "DELETE", "GET"
  ]);
  assert.ok(events.indexOf("request:GET", events.indexOf("request:POST") + 1)
    < events.indexOf("confirm:compensate-v2-created-resource"));
  assert.ok(events.indexOf("confirm:compensate-v2-created-resource")
    < events.indexOf("request:DELETE"));
  assert.deepEqual(reasons(fixture), [
    "CREATE_HTTP_STATUS_DOCUMENTED_200",
    "CREATE_CLIENT_SECRET_MISSING",
    "COMPENSATION_CONFIRMED"
  ]);
});

test("compensation denial occurs after proof and performs zero DELETE attempts", async t => {
  const events = [];
  const fixture = await prepareFixture(t);
  const remote = transport({
    post: createResponse({ overrides: { client_secret: " " } }),
    events
  });
  const result = await provisionFounderAttendedCreateReceiptV2TestOnly({
    ...common({
      artifactRoot: fixture.artifactRoot,
      store: fixture.store,
      attended: confirmation({ compensation: false, events })
    }),
    transport: remote
  });
  assert.equal(result.outcome, "MANUAL_REVIEW");
  assert.equal(result.remoteDeleteAttempts, 0);
  assert.deepEqual(remote.requests.map(request => request.method), ["GET", "POST", "GET"]);
  assert.deepEqual(reasons(fixture), [
    "CREATE_HTTP_STATUS_DOCUMENTED_200",
    "CREATE_CLIENT_SECRET_REJECTED",
    "COMPENSATION_AUTHORIZATION_DENIED"
  ]);
});

test("alternate 2xx missing credentials still fail closed unless proof and separate compensation succeed", async t => {
  const fixture = await prepareFixture(t);
  const remote = transport({
    post: createResponse({ status: 202, omit: ["client_secret"] })
  });
  const result = await provisionFounderAttendedCreateReceiptV2TestOnly({
    ...common({ artifactRoot: fixture.artifactRoot, store: fixture.store }),
    transport: remote
  });
  assert.equal(result.outcome, "COMPENSATED");
  assert.deepEqual(reasons(fixture), [
    "CREATE_HTTP_STATUS_ALTERNATE_2XX",
    "CREATE_CLIENT_SECRET_MISSING",
    "COMPENSATION_CONFIRMED"
  ]);
});

test("ambiguous, mismatched, or duplicate post-create proof performs zero DELETE attempts", async t => {
  for (const [name, proof] of [
    ["network", new Error("fixture_network")],
    ["wrong-id", exactList({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" })],
    ["wrong-duration", exactList({ duration: "8760h" })],
    ["duplicate", exactList({ duplicate: true })],
    ["malformed", { status: 200, body: "{" }]
  ]) {
    await t.test(name, async t2 => {
      const events = [];
      const fixture = await prepareFixture(t2);
      const remote = transport({
        gets: [emptyList(), proof],
        post: createResponse({ omit: ["client_secret"] }),
        events
      });
      const result = await provisionFounderAttendedCreateReceiptV2TestOnly({
        ...common({
          artifactRoot: fixture.artifactRoot,
          store: fixture.store,
          attended: confirmation({ events })
        }),
        transport: remote
      });
      assert.equal(result.outcome, "MANUAL_REVIEW");
      assert.equal(result.reasonCode, "CREATE_EXACT_NAME_PROOF_REJECTED");
      assert.equal(result.remoteDeleteAttempts, 0);
      assert.equal(remote.requests.filter(request => request.method === "DELETE").length, 0);
      assert.equal(events.includes("confirm:compensate-v2-created-resource"), false);
    });
  }
});

test("post-create proof paginates only when metadata proves another page", async t => {
  const fixture = await prepareFixture(t);
  const first = Array.from({ length: 20 }, (_, index) => ({
    id: `${String(index).padStart(16, "a")}`,
    name: CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_SERVICE_TOKEN_NAME,
    duration: CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_SERVICE_TOKEN_DURATION
  }));
  const remote = transport({
    gets: [
      emptyList(),
      envelope(first, { result_info: { count: 20, page: 1, per_page: 20, total_pages: 2 } }),
      exactList({ extra: { result_info: { count: 1, page: 2, per_page: 20, total_pages: 2 } } })
    ]
  });
  const result = await provisionFounderAttendedCreateReceiptV2TestOnly({
    ...common({ artifactRoot: fixture.artifactRoot, store: fixture.store }),
    transport: remote
  });
  assert.equal(result.outcome, "MANUAL_REVIEW");
  assert.equal(result.reasonCode, "CREATE_EXACT_NAME_PROOF_REJECTED");
  assert.deepEqual(remote.requests.map(request => request.method), ["GET", "POST", "GET", "GET"]);
  assert.equal(result.remoteDeleteAttempts, 0);
});

test("duplicate preflight consumes control with zero POST and cannot replay", async t => {
  const fixture = await prepareFixture(t);
  const remote = transport({ gets: [exactList()] });
  const first = await provisionFounderAttendedCreateReceiptV2TestOnly({
    ...common({ artifactRoot: fixture.artifactRoot, store: fixture.store }),
    transport: remote
  });
  assert.equal(first.reasonCode, "DUPLICATE_NAME_REJECTED");
  assert.equal(first.remoteCreateAttempts, 0);
  await assert.rejects(provisionFounderAttendedCreateReceiptV2TestOnly({
    ...common({ artifactRoot: fixture.artifactRoot, store: fixture.store }),
    transport: remote
  }));
  assert.equal(remote.requests.filter(request => request.method === "POST").length, 0);
});

test("ambiguous POST is attempted once and a consumed control never retries", async t => {
  const fixture = await prepareFixture(t);
  const remote = transport({ post: new Error("fixture_connection_reset") });
  const first = await provisionFounderAttendedCreateReceiptV2TestOnly({
    ...common({ artifactRoot: fixture.artifactRoot, store: fixture.store }),
    transport: remote
  });
  assert.equal(first.reasonCode, "CREATE_TRANSPORT_AMBIGUOUS");
  assert.equal(first.remoteCreateAttempts, 1);
  await assert.rejects(provisionFounderAttendedCreateReceiptV2TestOnly({
    ...common({ artifactRoot: fixture.artifactRoot, store: fixture.store }),
    transport: remote
  }));
  assert.equal(remote.requests.filter(request => request.method === "POST").length, 1);
});

test("Keychain failure rolls back locally before separately authorized compensation", async t => {
  const store = keychain({ addFailure: "smokeClientSecret" });
  const fixture = await prepareFixture(t, { store });
  const remote = transport();
  const result = await provisionFounderAttendedCreateReceiptV2TestOnly({
    ...common({ artifactRoot: fixture.artifactRoot, store }),
    transport: remote
  });
  assert.equal(result.outcome, "COMPENSATED");
  assert.equal(store.values.has("smokeClientId"), false);
  assert.equal(store.values.has("smokeClientSecret"), false);
  assert.equal(store.values.has("temporaryApiToken"), true);
  assert.deepEqual(remote.requests.map(request => request.method), [
    "GET", "POST", "GET", "DELETE", "GET"
  ]);
  assert.deepEqual(reasons(fixture), [
    "CREATE_HTTP_STATUS_DOCUMENTED_200",
    "CREATE_RESPONSE_ACCEPTED",
    "KEYCHAIN_STORAGE_REJECTED",
    "COMPENSATION_CONFIRMED"
  ]);
});

test("incomplete local rollback remains manual even after confirmed remote compensation", async t => {
  const store = keychain({ addFailure: "smokeClientSecret", rollbackFailure: true });
  const fixture = await prepareFixture(t, { store });
  const result = await provisionFounderAttendedCreateReceiptV2TestOnly({
    ...common({ artifactRoot: fixture.artifactRoot, store }),
    transport: transport()
  });
  assert.equal(result.outcome, "MANUAL_REVIEW");
  assert.ok(reasons(fixture).includes("KEYCHAIN_ROLLBACK_REJECTED"));
  assert.equal(store.values.has("temporaryApiToken"), true);
});

test("compensation ambiguity never exceeds one DELETE", async t => {
  for (const [name, del, cleanup] of [
    ["network", new Error("fixture_delete_network"), emptyList()],
    ["response", { status: 204, body: "" }, emptyList()],
    ["absence", deleteResponse(), exactList()]
  ]) {
    await t.test(name, async t2 => {
      const fixture = await prepareFixture(t2);
      const remote = transport({
        gets: [emptyList(), exactList(), cleanup],
        post: createResponse({ omit: ["client_secret"] }),
        del
      });
      const result = await provisionFounderAttendedCreateReceiptV2TestOnly({
        ...common({ artifactRoot: fixture.artifactRoot, store: fixture.store }),
        transport: remote
      });
      assert.equal(result.outcome, "MANUAL_REVIEW");
      assert.equal(remote.requests.filter(request => request.method === "DELETE").length, 1);
    });
  }
});

test("append-only reason evidence contains only fixed codes and no response material", async t => {
  const fixture = await prepareFixture(t);
  await provisionFounderAttendedCreateReceiptV2TestOnly({
    ...common({ artifactRoot: fixture.artifactRoot, store: fixture.store }),
    transport: transport()
  });
  const reasonText = allFiles(join(fixture.attemptRoot, "create-receipt-classifications"))
    .filter(path => path.endsWith(".reason"))
    .map(path => readFileSync(path, "utf8"))
    .join("");
  assert.equal(
    reasonText,
    "CREATE_HTTP_STATUS_DOCUMENTED_200\nCREATE_RESPONSE_ACCEPTED\n"
  );
  assert.doesNotMatch(reasonText, new RegExp(fixtureTokenId, "u"));
  assert.doesNotMatch(reasonText, new RegExp(fixtureClientSecret, "u"));
  assert.doesNotMatch(reasonText, new RegExp(fixtureAccountId, "u"));
});

test("production transport is method-isolated with one POST and one DELETE ceilings", async () => {
  const forwarded = [];
  const guarded = createFounderAttendedCreateReceiptV2ProductionTransport({
    transport: {
      async request(specification) {
        forwarded.push(specification);
        return emptyList();
      }
    }
  });
  const collection = new URL(
    `https://api.cloudflare.com/client/v4/accounts/${fixtureAccountId}/access/service_tokens`
  );
  const body = JSON.stringify({
    name: CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_SERVICE_TOKEN_NAME,
    duration: CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_SERVICE_TOKEN_DURATION
  });
  const post = Object.freeze({
    method: "POST",
    url: collection,
    headers: Object.freeze({
      Accept: "application/json",
      Authorization: `Bearer ${fixtureApiToken}`,
      "Content-Type": "application/json",
      "Content-Length": String(Buffer.byteLength(body, "utf8")),
      Connection: "close",
      "User-Agent": "prometheus-founder-attended-create-receipt-v2"
    }),
    body
  });
  await guarded.request(post);
  assert.throws(() => guarded.request(post));
  assert.throws(() => guarded.request({ ...post, method: "PUT" }));
  assert.equal(forwarded.length, 1);
});

test("future v2 CLIs are dormant, namespace-bound, and provision only through v2 logic", () => {
  const production = readFileSync(
    join(repositoryRoot, "scripts/lib/cloudflare-founder-attended-create-receipt-v2-production.mjs"),
    "utf8"
  );
  const provisionEntry = readFileSync(
    join(repositoryRoot, "scripts/run-cloudflare-founder-attended-create-receipt-v2-provision.mjs"),
    "utf8"
  );
  const getEntry = readFileSync(
    join(repositoryRoot, "scripts/run-cloudflare-founder-attended-create-receipt-v2-get-only.mjs"),
    "utf8"
  );
  assert.match(production, /provisionFounderAttendedCreateReceiptV2TestOnly/u);
  assert.doesNotMatch(production, /provisionFounderAttendedResponseContractSuccessorTestOnly/u);
  assert.match(production, /CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_DIRECTORY/u);
  assert.match(provisionEntry, /runFounderAttendedCreateReceiptV2ProvisioningCli/u);
  assert.doesNotMatch(provisionEntry, /response-contract-workflow/u);
  assert.doesNotMatch(getEntry, /method:\s*"(?:POST|DELETE|PUT|PATCH)"/u);
  assert.doesNotMatch(getEntry, /provisionFounderAttended/u);
  assert.equal(
    CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_NEXT_SAFE_COMMAND,
    "node scripts/run-cloudflare-founder-attended-create-receipt-v2-get-only.mjs"
  );
});

test("v1 sentinel content remains byte-identical while v2 artifacts are written separately", async t => {
  const box = sandbox(t);
  const predecessor = join(box.root, "consumed-v1-receipt");
  const bytes = Buffer.from("consumed-v1-artifact-immutable\n", "utf8");
  writeFileSync(predecessor, bytes, { mode: 0o600 });
  const fixture = await prepareFixture(t);
  await provisionFounderAttendedCreateReceiptV2TestOnly({
    ...common({ artifactRoot: fixture.artifactRoot, store: fixture.store }),
    transport: transport()
  });
  assert.deepEqual(readFileSync(predecessor), bytes);
});
