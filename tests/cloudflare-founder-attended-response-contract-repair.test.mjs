import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  linkSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  statSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  readFounderAttendedResponseContractAttemptStateTestOnly,
  readFounderAttendedResponseContractPhasesTestOnly
} from "../scripts/lib/cloudflare-founder-attended-response-contract-artifacts.mjs";
import {
  CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_CONFIRMATIONS,
  CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_FINAL_OUTCOMES,
  CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_PHASES,
  CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_SERVICE_TOKEN_DURATION,
  CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_SERVICE_TOKEN_NAME
} from "../scripts/lib/cloudflare-founder-attended-response-contract-constants.mjs";
import {
  diagnoseFounderAttendedResponseContractAbsenceTestOnly,
  evaluateFounderAttendedCreateResponseTestOnly,
  evaluateFounderAttendedDeleteResponseTestOnly,
  prepareFounderAttendedResponseContractControlTestOnly,
  provisionFounderAttendedResponseContractSuccessorTestOnly
} from "../scripts/lib/cloudflare-founder-attended-response-contract-workflow.mjs";

const now = new Date("2026-07-15T21:00:00.000Z");
const repositoryIdentity = Object.freeze({
  commit: "a".repeat(40),
  tree: "b".repeat(40),
  clean: true
});
const fixtureAccountId = "fedcba9876543210fedcba9876543210";
const fixtureAccountDigest = createHash("sha256").update(fixtureAccountId).digest("hex");
const fixtureApiToken = "synthetic-temporary-api-token-value-3003";
const fixtureClientId = `${"c".repeat(32)}.access`;
const documentedClientId = `${"d".repeat(32)}.access.example.com`;
const fixtureClientSecret = "synthetic-client-secret-value-3003";
const fixtureTokenId = "f174e90a-fafe-4643-bbbc-4a0ed4fc8415";

function sandbox(t) {
  const root = mkdtempSync(join(tmpdir(), "prometheus-response-contract-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return Object.freeze({ root, artifactRoot: join(root, "batch-003") });
}

function confirmation(allowed = true, events = []) {
  return Object.freeze({
    confirm(action, phrase) {
      events.push(`confirm:${action}`);
      assert.equal(phrase, CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_CONFIRMATIONS[action]);
      return allowed;
    }
  });
}

function keychain({ events = [], addFailure = null } = {}) {
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
      if (owners.get(key) !== owner) return Object.freeze({ deleted: false });
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

function emptyList() {
  return envelope([]);
}

function exactNameList() {
  return envelope([{ name: CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_SERVICE_TOKEN_NAME }]);
}

function createResponse(overrides = {}, envelopeOverrides = {}) {
  return Object.freeze({
    status: 200,
    body: JSON.stringify({
      success: true,
      result: {
        id: fixtureTokenId,
        name: CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_SERVICE_TOKEN_NAME,
        duration: CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_SERVICE_TOKEN_DURATION,
        client_id: fixtureClientId,
        client_secret: fixtureClientSecret,
        created_at: "2026-07-15T21:00:01.12345Z",
        updated_at: "2026-07-15T21:00:01.12345Z",
        ...overrides
      },
      ...envelopeOverrides
    })
  });
}

function deleteResponse(overrides = {}) {
  return Object.freeze({
    status: 200,
    body: JSON.stringify({
      success: true,
      errors: [],
      messages: [],
      result: {
        id: fixtureTokenId,
        client_id: documentedClientId,
        created_at: "2026-07-15T21:00:01.12345Z",
        duration: CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_SERVICE_TOKEN_DURATION,
        expires_at: "2026-08-14T21:00:01.12345Z",
        last_seen_at: "2026-07-15T21:05:01.12345Z",
        name: CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_SERVICE_TOKEN_NAME,
        updated_at: "2026-07-15T21:00:01.12345Z",
        ...overrides
      }
    })
  });
}

function transport({ gets = [emptyList()], post = createResponse(), del = deleteResponse() } = {}) {
  const requests = [];
  let getIndex = 0;
  return {
    requests,
    async request(specification) {
      requests.push(specification);
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

function common({ artifactRoot, attended = confirmation(), store = keychain(), clock = () => new Date(now) }) {
  return {
    confirmation: attended,
    keychain: store,
    clock,
    repositoryReader: () => repositoryIdentity,
    accountIdSha256Allowlist: [fixtureAccountDigest],
    artifactRoot,
    expectedUid: process.getuid()
  };
}

async function prepareFixture(t, options = {}) {
  const box = sandbox(t);
  const store = options.store ?? keychain();
  const diagnostic = await diagnoseFounderAttendedResponseContractAbsenceTestOnly({
    ...common({ artifactRoot: box.artifactRoot, store }),
    transport: options.diagnosticTransport ?? transport(),
    randomBytesImpl: () => Buffer.alloc(32, 3)
  });
  const prepared = prepareFounderAttendedResponseContractControlTestOnly({
    ...common({ artifactRoot: box.artifactRoot, store }),
    randomBytesImpl: () => Buffer.alloc(32, 4)
  });
  const control = JSON.parse(readFileSync(join(prepared.attemptRoot, "successor-control.json"), "utf8"));
  return Object.freeze({
    ...box,
    store,
    control,
    attemptId: prepared.attemptId,
    attemptRoot: prepared.attemptRoot,
    diagnosticOutcome: diagnostic.outcome
  });
}

function phases(fixture) {
  return readFounderAttendedResponseContractPhasesTestOnly({
    artifactRoot: fixture.attemptRoot,
    control: fixture.control,
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
  const output = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) output.push(...allFiles(path));
    else output.push(path);
  }
  return output;
}

test("phase vocabulary and final outcomes are exact and closed", () => {
  assert.deepEqual(CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_PHASES, [
    "GET_COMPLETED", "EXACT_NAME_ABSENT", "EXACT_NAME_PRESENT", "POST_ATTEMPTED",
    "CREATE_RESPONSE_VALID", "CREATE_RESPONSE_INVALID", "KEYCHAIN_STORED",
    "KEYCHAIN_NOT_STORED", "DELETE_ATTEMPTED", "DELETE_CONFIRMED",
    "DELETE_NOT_CONFIRMED", "SUCCESS", "COMPENSATED", "MANUAL_REVIEW"
  ]);
  assert.deepEqual(CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_FINAL_OUTCOMES, [
    "SUCCESS", "COMPENSATED", "MANUAL_REVIEW"
  ]);
});

test("create accepts official 200 shape without expires_at and optional envelope arrays", () => {
  const evaluation = evaluateFounderAttendedCreateResponseTestOnly(createResponse({
    client_id: documentedClientId
  }));
  assert.equal(evaluation.valid, true);
  evaluation.credentials.clientId.fill(0);
  evaluation.credentials.clientSecret.fill(0);
});

test("create accepts documented timestamps and rejects malformed timestamp values", () => {
  const accepted = evaluateFounderAttendedCreateResponseTestOnly(createResponse({
    expires_at: "2026-08-14T21:00:01.12345Z",
    last_seen_at: "2026-07-15T21:05:01.12345Z",
    previous_client_secret_expires_at: "2026-07-16T21:00:01.12345Z"
  }));
  assert.equal(accepted.valid, true);
  accepted.credentials.clientId.fill(0);
  accepted.credentials.clientSecret.fill(0);
  assert.equal(evaluateFounderAttendedCreateResponseTestOnly(
    createResponse({ updated_at: "not-a-timestamp" })
  ).valid, false);
});

test("create rejects missing credentials, wrong exact name, and wrong duration", () => {
  assert.equal(evaluateFounderAttendedCreateResponseTestOnly(
    createResponse({ client_id: undefined })
  ).valid, false);
  assert.equal(evaluateFounderAttendedCreateResponseTestOnly(
    createResponse({ client_secret: undefined })
  ).valid, false);
  assert.equal(evaluateFounderAttendedCreateResponseTestOnly(
    createResponse({ name: "Wrong token" })
  ).valid, false);
  assert.equal(evaluateFounderAttendedCreateResponseTestOnly(
    createResponse({ duration: "8760h" })
  ).valid, false);
});

test("create rejects ambiguous HTTP and envelope responses", () => {
  assert.equal(evaluateFounderAttendedCreateResponseTestOnly({ status: 202, body: "{}" }).valid, false);
  assert.equal(evaluateFounderAttendedCreateResponseTestOnly({
    status: 200,
    body: JSON.stringify({ success: false, result: {} })
  }).valid, false);
  assert.equal(evaluateFounderAttendedCreateResponseTestOnly({ status: 200, body: "{" }).valid, false);
});

test("delete accepts official result object and rejects ambiguous or contradictory responses", () => {
  assert.equal(evaluateFounderAttendedDeleteResponseTestOnly(deleteResponse(), fixtureTokenId), true);
  assert.equal(evaluateFounderAttendedDeleteResponseTestOnly(
    deleteResponse({ id: "different-service-token-id-3003" }),
    fixtureTokenId
  ), false);
  assert.equal(evaluateFounderAttendedDeleteResponseTestOnly({ status: 204, body: "" }, fixtureTokenId), false);
  assert.equal(evaluateFounderAttendedDeleteResponseTestOnly(envelope(null), fixtureTokenId), false);
});

test("diagnostic confirmation occurs before Keychain, network, randomness, or artifact access", async t => {
  const box = sandbox(t);
  const events = [];
  const store = keychain({ events });
  const remote = transport();
  await assert.rejects(diagnoseFounderAttendedResponseContractAbsenceTestOnly({
    ...common({ artifactRoot: box.artifactRoot, store, attended: confirmation(false, events) }),
    transport: remote,
    randomBytesImpl: () => {
      events.push("random");
      return Buffer.alloc(32, 3);
    }
  }));
  assert.deepEqual(events, ["confirm:diagnose-fresh-absence"]);
  assert.equal(remote.requests.length, 0);
  assert.equal(statSync(box.root).isDirectory(), true);
  assert.equal(readdirSync(box.root).length, 0);
});

test("fresh control requires a new absent-name GET and separate Founder authorization", async t => {
  const box = sandbox(t);
  const store = keychain();
  assert.throws(() => prepareFounderAttendedResponseContractControlTestOnly({
    ...common({ artifactRoot: box.artifactRoot, store }),
    randomBytesImpl: () => Buffer.alloc(32, 4)
  }));
  const predecessorSentinel = join(box.root, "consumed-predecessor-control");
  writeFileSync(predecessorSentinel, "consumed-and-immutable\n", { mode: 0o600 });
  await diagnoseFounderAttendedResponseContractAbsenceTestOnly({
    ...common({ artifactRoot: box.artifactRoot, store }),
    transport: transport(),
    randomBytesImpl: () => Buffer.alloc(32, 3)
  });
  assert.throws(() => prepareFounderAttendedResponseContractControlTestOnly({
    ...common({ artifactRoot: box.artifactRoot, store, attended: confirmation(false) }),
    randomBytesImpl: () => Buffer.alloc(32, 4)
  }));
  const prepared = prepareFounderAttendedResponseContractControlTestOnly({
    ...common({ artifactRoot: box.artifactRoot, store }),
    randomBytesImpl: () => Buffer.alloc(32, 4)
  });
  assert.equal(prepared.prepared, true);
  assert.equal(readFileSync(predecessorSentinel, "utf8"), "consumed-and-immutable\n");
});

test("exact-name presence prevents fresh diagnostic evidence", async t => {
  const box = sandbox(t);
  const result = await diagnoseFounderAttendedResponseContractAbsenceTestOnly({
    ...common({ artifactRoot: box.artifactRoot, store: keychain() }),
    transport: transport({ gets: [exactNameList()] }),
    randomBytesImpl: () => Buffer.alloc(32, 3)
  });
  assert.equal(result.outcome, "EXACT_NAME_PRESENT");
  assert.deepEqual(attemptStates(box.artifactRoot).map(state => state.outcome), [
    "EXACT_NAME_PRESENT"
  ]);
});

test("fresh diagnostic accepts omitted optional list fields and safe proven pagination", async t => {
  const omitted = sandbox(t);
  const omittedResult = await diagnoseFounderAttendedResponseContractAbsenceTestOnly({
    ...common({ artifactRoot: omitted.artifactRoot, store: keychain() }),
    transport: transport({
      gets: [{ status: 200, body: JSON.stringify({ success: true, errors: [], messages: [] }) }]
    }),
    randomBytesImpl: () => Buffer.alloc(32, 3)
  });
  assert.equal(omittedResult.outcome, "EXACT_NAME_ABSENT");
  assert.equal(attemptStates(omitted.artifactRoot).length, 1);

  const paginated = sandbox(t);
  const firstPage = Array.from({ length: 20 }, (_, index) => ({ name: `nonmatch-${index}` }));
  const remote = transport({
    gets: [
      envelope(firstPage, {
        result_info: { count: 20, page: 1, per_page: 20, total_pages: 2 }
      }),
      envelope([{ name: "nonmatch-final" }], {
        result_info: { count: 1, page: 2, per_page: 20, total_pages: 2 }
      })
    ]
  });
  const paginatedResult = await diagnoseFounderAttendedResponseContractAbsenceTestOnly({
    ...common({ artifactRoot: paginated.artifactRoot, store: keychain() }),
    transport: remote,
    randomBytesImpl: () => Buffer.alloc(32, 3)
  });
  assert.equal(paginatedResult.outcome, "EXACT_NAME_ABSENT");
  assert.deepEqual(remote.requests.map(request => request.method), ["GET", "GET"]);
  assert.equal(attemptStates(paginated.artifactRoot).length, 1);
});

test("fresh diagnostic fails closed on authorization denial and network failure", async t => {
  for (const [name, response] of [
    ["authorization", { status: 403, body: JSON.stringify({ success: false }) }],
    ["network", new Error("synthetic_network_failure")]
  ]) {
    const box = sandbox(t);
    await assert.rejects(diagnoseFounderAttendedResponseContractAbsenceTestOnly({
      ...common({ artifactRoot: box.artifactRoot, store: keychain() }),
      transport: transport({ gets: [response] }),
      randomBytesImpl: () => Buffer.alloc(32, 3)
    }), name);
    assert.equal(existsSync(box.artifactRoot), false);
  }
});

test("repeated fresh diagnostics create isolated attempts and prepare the latest eligible absence", async t => {
  const box = sandbox(t);
  const store = keychain();
  await diagnoseFounderAttendedResponseContractAbsenceTestOnly({
    ...common({
      artifactRoot: box.artifactRoot,
      store,
      clock: () => new Date("2026-07-15T21:00:00.000Z")
    }),
    transport: transport(),
    randomBytesImpl: () => Buffer.alloc(32, 6)
  });
  await diagnoseFounderAttendedResponseContractAbsenceTestOnly({
    ...common({
      artifactRoot: box.artifactRoot,
      store,
      clock: () => new Date("2026-07-15T21:05:00.000Z")
    }),
    transport: transport(),
    randomBytesImpl: () => Buffer.alloc(32, 7)
  });
  const states = attemptStates(box.artifactRoot);
  assert.equal(states.length, 2);
  assert.notEqual(states[0].attemptId, states[1].attemptId);
  const prepared = prepareFounderAttendedResponseContractControlTestOnly({
    ...common({
      artifactRoot: box.artifactRoot,
      store,
      clock: () => new Date("2026-07-15T21:06:00.000Z")
    }),
    randomBytesImpl: () => Buffer.alloc(32, 8)
  });
  assert.equal(prepared.prepared, true);
  assert.equal(prepared.attemptId, states[1].attemptId);
});

test("expired, consumed, and present attempts are ignored when selecting a fresh successor", async t => {
  const box = sandbox(t);
  const store = keychain();
  await diagnoseFounderAttendedResponseContractAbsenceTestOnly({
    ...common({
      artifactRoot: box.artifactRoot,
      store,
      clock: () => new Date("2026-07-15T20:00:00.000Z")
    }),
    transport: transport(),
    randomBytesImpl: () => Buffer.alloc(32, 9)
  });
  await diagnoseFounderAttendedResponseContractAbsenceTestOnly({
    ...common({
      artifactRoot: box.artifactRoot,
      store,
      clock: () => new Date("2026-07-15T20:10:00.000Z")
    }),
    transport: transport({ gets: [exactNameList()] }),
    randomBytesImpl: () => Buffer.alloc(32, 10)
  });
  await diagnoseFounderAttendedResponseContractAbsenceTestOnly({
    ...common({
      artifactRoot: box.artifactRoot,
      store,
      clock: () => new Date("2026-07-15T21:00:00.000Z")
    }),
    transport: transport(),
    randomBytesImpl: () => Buffer.alloc(32, 11)
  });
  const prepared = prepareFounderAttendedResponseContractControlTestOnly({
    ...common({
      artifactRoot: box.artifactRoot,
      store,
      clock: () => new Date("2026-07-15T21:01:00.000Z")
    }),
    randomBytesImpl: () => Buffer.alloc(32, 12)
  });
  const states = attemptStates(box.artifactRoot);
  assert.equal(prepared.attemptId, states.at(-1).attemptId);
});

test("simultaneous fresh absence attempts fail safely without mixing", async t => {
  const box = sandbox(t);
  const store = keychain();
  const at = () => new Date("2026-07-15T21:00:00.000Z");
  await diagnoseFounderAttendedResponseContractAbsenceTestOnly({
    ...common({ artifactRoot: box.artifactRoot, store, clock: at }),
    transport: transport(),
    randomBytesImpl: () => Buffer.alloc(32, 13)
  });
  await diagnoseFounderAttendedResponseContractAbsenceTestOnly({
    ...common({ artifactRoot: box.artifactRoot, store, clock: at }),
    transport: transport(),
    randomBytesImpl: () => Buffer.alloc(32, 14)
  });
  assert.throws(() => prepareFounderAttendedResponseContractControlTestOnly({
    ...common({
      artifactRoot: box.artifactRoot,
      store,
      clock: () => new Date("2026-07-15T21:01:00.000Z")
    }),
    randomBytesImpl: () => Buffer.alloc(32, 15)
  }));
});

test("attempt-id collision returns a fixed local artifact collision outcome", async t => {
  const box = sandbox(t);
  mkdirSync(join(box.artifactRoot, "attempts"), { recursive: true, mode: 0o700 });
  mkdirSync(join(box.artifactRoot, "attempts", Buffer.alloc(32, 16).toString("base64url")), {
    mode: 0o700
  });
  const result = await diagnoseFounderAttendedResponseContractAbsenceTestOnly({
    ...common({ artifactRoot: box.artifactRoot, store: keychain() }),
    transport: transport(),
    randomBytesImpl: () => Buffer.alloc(32, 16)
  });
  assert.equal(result.outcome, "LOCAL_ARTIFACT_COLLISION");
});

test("legacy flat-root evidence remains untouched when fresh attempts rotate namespaces", async t => {
  const box = sandbox(t);
  mkdirSync(join(box.artifactRoot, "diagnostics"), { recursive: true, mode: 0o700 });
  const legacy = join(box.artifactRoot, "diagnostics", "legacy.json");
  writeFileSync(legacy, "{\"legacy\":true}\n", { mode: 0o600 });
  await diagnoseFounderAttendedResponseContractAbsenceTestOnly({
    ...common({ artifactRoot: box.artifactRoot, store: keychain() }),
    transport: transport(),
    randomBytesImpl: () => Buffer.alloc(32, 17)
  });
  assert.equal(readFileSync(legacy, "utf8"), "{\"legacy\":true}\n");
  assert.equal(attemptStates(box.artifactRoot).length, 1);
});

test("tampering, symlinks, hardlinks, and permission drift fail closed", async t => {
  await t.test("cross-attempt substitution", async t2 => {
    const box = sandbox(t2);
    const store = keychain();
    const first = await prepareFixture(t2, { store });
    await diagnoseFounderAttendedResponseContractAbsenceTestOnly({
      ...common({
        artifactRoot: box.artifactRoot,
        store,
        clock: () => new Date("2026-07-15T21:05:00.000Z")
      }),
      transport: transport(),
      randomBytesImpl: () => Buffer.alloc(32, 18)
    });
    const second = attemptStates(box.artifactRoot).find(state => state.attemptId !== first.attemptId);
    writeFileSync(
      join(second.attemptRoot, "successor-control.json"),
      readFileSync(join(first.attemptRoot, "successor-control.json")),
      { mode: 0o600 }
    );
    await assert.rejects(provisionFounderAttendedResponseContractSuccessorTestOnly({
      ...common({ artifactRoot: box.artifactRoot, store }),
      transport: transport()
    }));
  });

  await t.test("symlinked attempt entry", async t2 => {
    const box = sandbox(t2);
    await diagnoseFounderAttendedResponseContractAbsenceTestOnly({
      ...common({ artifactRoot: box.artifactRoot, store: keychain() }),
      transport: transport(),
      randomBytesImpl: () => Buffer.alloc(32, 19)
    });
    const states = attemptStates(box.artifactRoot);
    symlinkSync(states[0].attemptRoot, join(box.artifactRoot, "attempts", "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"));
    assert.throws(() => attemptStates(box.artifactRoot));
  });

  await t.test("hardlinked diagnostic receipt", async t2 => {
    const box = sandbox(t2);
    await diagnoseFounderAttendedResponseContractAbsenceTestOnly({
      ...common({ artifactRoot: box.artifactRoot, store: keychain() }),
      transport: transport(),
      randomBytesImpl: () => Buffer.alloc(32, 20)
    });
    const [state] = attemptStates(box.artifactRoot);
    linkSync(
      join(state.attemptRoot, "diagnostic-receipt.json"),
      join(state.attemptRoot, "diagnostic-receipt-copy.json")
    );
    assert.throws(() => attemptStates(box.artifactRoot));
  });

  await t.test("permission drift", async t2 => {
    const box = sandbox(t2);
    await diagnoseFounderAttendedResponseContractAbsenceTestOnly({
      ...common({ artifactRoot: box.artifactRoot, store: keychain() }),
      transport: transport(),
      randomBytesImpl: () => Buffer.alloc(32, 21)
    });
    const [state] = attemptStates(box.artifactRoot);
    chmodSync(join(state.attemptRoot, "diagnostic-receipt.json"), 0o644);
    assert.throws(() => attemptStates(box.artifactRoot));
  });
});

test("successful future provisioning stores only after valid response and records fixed phases", async t => {
  const fixture = await prepareFixture(t);
  const remote = transport();
  const result = await provisionFounderAttendedResponseContractSuccessorTestOnly({
    ...common({ artifactRoot: fixture.artifactRoot, store: fixture.store }),
    transport: remote
  });
  assert.deepEqual(result, { outcome: "SUCCESS", remoteCreateAttempts: 1 });
  assert.equal(remote.requests.filter(request => request.method === "POST").length, 1);
  assert.equal(remote.requests.filter(request => request.method === "DELETE").length, 0);
  assert.deepEqual(phases(fixture), [
    "GET_COMPLETED", "EXACT_NAME_ABSENT", "POST_ATTEMPTED", "CREATE_RESPONSE_VALID",
    "KEYCHAIN_STORED", "SUCCESS"
  ]);
  const artifactText = allFiles(fixture.attemptRoot)
    .map(path => readFileSync(path, "utf8"))
    .join("\n");
  assert.doesNotMatch(artifactText, new RegExp(fixtureClientSecret, "u"));
  assert.doesNotMatch(artifactText, new RegExp(fixtureClientId.replace(".", "\\."), "u"));
});

test("invalid create with safe exact-name id compensates only after delete and absence GET", async t => {
  const fixture = await prepareFixture(t);
  const remote = transport({
    gets: [emptyList(), emptyList()],
    post: createResponse({ client_secret: undefined }),
    del: deleteResponse()
  });
  const result = await provisionFounderAttendedResponseContractSuccessorTestOnly({
    ...common({ artifactRoot: fixture.artifactRoot, store: fixture.store }),
    transport: remote
  });
  assert.deepEqual(result, { outcome: "COMPENSATED", remoteCreateAttempts: 1 });
  assert.deepEqual(remote.requests.map(request => request.method), ["GET", "POST", "DELETE", "GET"]);
  assert.deepEqual(phases(fixture), [
    "GET_COMPLETED", "EXACT_NAME_ABSENT", "POST_ATTEMPTED", "CREATE_RESPONSE_INVALID",
    "KEYCHAIN_NOT_STORED", "DELETE_ATTEMPTED", "GET_COMPLETED", "EXACT_NAME_ABSENT",
    "DELETE_CONFIRMED", "COMPENSATED"
  ]);
});

test("valid delete response without absent-name proof is not cleanup confirmation", async t => {
  const fixture = await prepareFixture(t);
  const remote = transport({
    gets: [emptyList(), exactNameList()],
    post: createResponse({ client_secret: undefined }),
    del: deleteResponse()
  });
  const result = await provisionFounderAttendedResponseContractSuccessorTestOnly({
    ...common({ artifactRoot: fixture.artifactRoot, store: fixture.store }),
    transport: remote
  });
  assert.equal(result.outcome, "MANUAL_REVIEW");
  assert.deepEqual(phases(fixture).slice(-4), [
    "GET_COMPLETED", "EXACT_NAME_PRESENT", "DELETE_NOT_CONFIRMED", "MANUAL_REVIEW"
  ]);
  assert.equal(phases(fixture).includes("DELETE_CONFIRMED"), false);
});

test("ambiguous POST is attempted once and consumed control cannot retry", async t => {
  const fixture = await prepareFixture(t);
  const remote = transport({ post: new Error("synthetic_connection_reset") });
  const first = await provisionFounderAttendedResponseContractSuccessorTestOnly({
    ...common({ artifactRoot: fixture.artifactRoot, store: fixture.store }),
    transport: remote
  });
  assert.equal(first.outcome, "MANUAL_REVIEW");
  assert.equal(remote.requests.filter(request => request.method === "POST").length, 1);
  await assert.rejects(provisionFounderAttendedResponseContractSuccessorTestOnly({
    ...common({ artifactRoot: fixture.artifactRoot, store: fixture.store }),
    transport: remote
  }));
  assert.equal(remote.requests.filter(request => request.method === "POST").length, 1);
  assert.deepEqual(phases(fixture).slice(-3), [
    "CREATE_RESPONSE_INVALID", "KEYCHAIN_NOT_STORED", "MANUAL_REVIEW"
  ]);
});

test("duplicate preflight consumes the control but performs zero POST attempts", async t => {
  const fixture = await prepareFixture(t);
  const remote = transport({ gets: [exactNameList()] });
  const result = await provisionFounderAttendedResponseContractSuccessorTestOnly({
    ...common({ artifactRoot: fixture.artifactRoot, store: fixture.store }),
    transport: remote
  });
  assert.deepEqual(result, { outcome: "MANUAL_REVIEW", remoteCreateAttempts: 0 });
  assert.deepEqual(remote.requests.map(request => request.method), ["GET"]);
  assert.deepEqual(phases(fixture), ["GET_COMPLETED", "EXACT_NAME_PRESENT", "MANUAL_REVIEW"]);
});

test("Keychain failure records no stored state and uses bounded compensation", async t => {
  const store = keychain({ addFailure: "smokeClientSecret" });
  const fixture = await prepareFixture(t, { store });
  const remote = transport({ gets: [emptyList(), emptyList()] });
  const result = await provisionFounderAttendedResponseContractSuccessorTestOnly({
    ...common({ artifactRoot: fixture.artifactRoot, store }),
    transport: remote
  });
  assert.equal(result.outcome, "COMPENSATED");
  assert.equal(store.values.has("smokeClientId"), false);
  assert.equal(store.values.has("smokeClientSecret"), false);
  assert.equal(remote.requests.filter(request => request.method === "POST").length, 1);
  assert.equal(remote.requests.filter(request => request.method === "DELETE").length, 1);
  assert.equal(store.values.has("temporaryApiToken"), true);
});
