import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  RouteIqRequestCrmError,
  authorizeRouteIqRequestFounder,
  exportRouteIqRequests,
  listRouteIqRequests,
  normalizeRouteIqRequestInput,
  persistRouteIqRequest,
  publicRouteIqRequestReceipt,
  retrieveRouteIqRequest,
  routeIqRequestCrmStoragePrefix,
  routeIqRequestFailureMetadata,
  routeIqRequestFounderAuthorization
} from "../crm/route-iq-request-crm.mjs";

function memoryDurableStore({ failMonitoringOnce = false } = {}) {
  const items = new Map();
  const writes = [];
  let shouldFailMonitoring = failMonitoringOnce;
  return {
    items,
    writes,
    async get(key) {
      return items.get(key)?.value ?? null;
    },
    async putIfAbsent(key, value, options = {}) {
      if (items.has(key)) return false;
      items.set(key, { value: String(value), options });
      writes.push({ operation: "putIfAbsent", key, value: String(value), options });
      return true;
    },
    async put(key, value, options = {}) {
      if (shouldFailMonitoring && key.includes("/monitoring/")) {
        shouldFailMonitoring = false;
        throw new Error("simulated monitoring persistence interruption");
      }
      items.set(key, { value: String(value), options });
      writes.push({ operation: "put", key, value: String(value), options });
    },
    async list({ prefix }) {
      return {
        keys: [...items.keys()].filter(key => key.startsWith(prefix)).sort().map(name => ({ name }))
      };
    }
  };
}

function input(overrides = {}) {
  return {
    workspaceId: "prometheus_route_iq",
    operatingProfileId: "route_iq_commercial",
    idempotencyKey: "route_iq_request_00000001",
    businessName: "Houston Field Services",
    contactName: "Jordan Rivera",
    businessEmail: "jordan@example.com",
    phone: "+1 713 555 0100",
    businessType: "Commercial field services",
    numberOfLocations: 4,
    estimatedUsers: 28,
    territory: "Greater Houston",
    primaryProblem: "Coordinate field visits and understand which outcomes are changing by territory.",
    desiredTimeline: "within_90_days",
    consent: true,
    acquisitionSource: "route_iq_website",
    ...overrides
  };
}

function cruzPrincipal(overrides = {}) {
  return {
    authenticated: true,
    identityProvider: routeIqRequestFounderAuthorization.identityProvider,
    immutablePrincipalId: routeIqRequestFounderAuthorization.immutablePrincipalId,
    subject: routeIqRequestFounderAuthorization.subject,
    workspaceId: routeIqRequestFounderAuthorization.workspaceId,
    identityImmutable: true,
    ...overrides
  };
}

function founderScope(overrides = {}) {
  return {
    principal: cruzPrincipal(),
    workspaceId: "prometheus_route_iq",
    operatingProfileId: "route_iq_commercial",
    ...overrides
  };
}

test("Route IQ request validates, stores, acknowledges, retrieves, and exports end to end", async () => {
  const store = memoryDurableStore();
  const accepted = await persistRouteIqRequest(store, input(), { now: "2026-07-18T15:00:00.000Z" });
  const receipt = publicRouteIqRequestReceipt(accepted);

  assert.equal(accepted.ok, true);
  assert.equal(accepted.duplicate, false);
  assert.equal(accepted.status, "accepted");
  assert.match(receipt.receiptId, /^riq_receipt_[a-f0-9]{24}$/);
  assert.equal(receipt.submittedAt, "2026-07-18T15:00:00.000Z");
  assert.equal(accepted.record.request.consent.accepted, true);
  assert.equal(accepted.record.request.consent.acceptedAt, receipt.submittedAt);
  assert.equal(accepted.record.integrity.idempotencyKeyStored, false);
  assert.equal(JSON.stringify(accepted.record).includes(input().idempotencyKey), false);

  const retrieved = await retrieveRouteIqRequest(store, {
    ...founderScope(),
    receiptId: receipt.receiptId
  });
  assert.deepEqual(retrieved, accepted.record);

  const records = await listRouteIqRequests(store, founderScope());
  assert.equal(records.length, 1);
  assert.deepEqual(records[0], accepted.record);

  const json = JSON.parse(await exportRouteIqRequests(store, {
    ...founderScope(),
    format: "json",
    generatedAt: "2026-07-18T15:05:00.000Z"
  }));
  assert.equal(json.recordCount, 1);
  assert.equal(json.records[0].request.businessName, "Houston Field Services");

  const csv = await exportRouteIqRequests(store, {
    ...founderScope(),
    format: "csv",
    generatedAt: "2026-07-18T15:05:00.000Z"
  });
  assert.match(csv, /"receiptId","submittedAt","businessName"/);
  assert.match(csv, /"Houston Field Services"/);
  assert.match(csv, /"jordan@example.com"/);
});

test("identical retries are idempotent and changed reuse of an idempotency key fails closed", async () => {
  const store = memoryDurableStore();
  const first = await persistRouteIqRequest(store, input(), { now: "2026-07-18T15:00:00.000Z" });
  const writesAfterFirst = store.writes.length;
  const retry = await persistRouteIqRequest(store, input(), { now: "2026-07-18T15:10:00.000Z" });

  assert.equal(retry.duplicate, true);
  assert.equal(retry.status, "already_accepted");
  assert.equal(retry.receiptId, first.receiptId);
  assert.equal(retry.record.request.submittedAt, first.record.request.submittedAt);
  assert.equal(store.writes.length, writesAfterFirst + 1, "retry may refresh only noncanonical monitoring state");

  await assert.rejects(
    () => persistRouteIqRequest(store, input({ primaryProblem: "A changed request must not reuse the original idempotency identity." })),
    error => error instanceof RouteIqRequestCrmError && error.code === "idempotency_conflict" && error.status === 409
  );
});

test("exact duplicate content with a different idempotency key produces one logical record and receipt", async () => {
  const store = memoryDurableStore();
  const first = await persistRouteIqRequest(store, input(), { now: "2026-07-18T15:00:00.000Z" });
  const duplicate = await persistRouteIqRequest(store, input({ idempotencyKey: "route_iq_request_00000002" }), {
    now: "2026-07-18T15:01:00.000Z"
  });

  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.receiptId, first.receiptId);
  const recordKeys = [...store.items.keys()].filter(key => key.includes("/requests/"));
  assert.equal(recordKeys.length, 1);
});

test("concurrent exact duplicates create one canonical record with deterministic acknowledgements", async () => {
  const store = memoryDurableStore();
  const [first, second] = await Promise.all([
    persistRouteIqRequest(store, input({ idempotencyKey: "route_iq_request_concurrent_01" }), { now: "2026-07-18T15:00:00.000Z" }),
    persistRouteIqRequest(store, input({ idempotencyKey: "route_iq_request_concurrent_02" }), { now: "2026-07-18T15:00:00.000Z" })
  ]);

  assert.equal(first.receiptId, second.receiptId);
  assert.equal([first, second].filter(result => !result.duplicate).length, 1);
  assert.equal([...store.items.keys()].filter(key => key.includes("/requests/")).length, 1);
});

test("an interrupted noncanonical monitoring write repairs forward without a duplicate record", async () => {
  const store = memoryDurableStore({ failMonitoringOnce: true });
  await assert.rejects(
    () => persistRouteIqRequest(store, input(), { now: "2026-07-18T15:00:00.000Z" }),
    /simulated monitoring persistence interruption/
  );

  const recovered = await persistRouteIqRequest(store, input(), { now: "2026-07-18T15:01:00.000Z" });
  assert.equal(recovered.duplicate, true);
  assert.equal([...store.items.keys()].filter(key => key.includes("/requests/")).length, 1);
  assert.equal([...store.items.keys()].filter(key => key.includes("/monitoring/")).length, 1);
});

test("strict validation rejects unknown scope, fields, missing consent, and malformed contact data", () => {
  assert.throws(() => normalizeRouteIqRequestInput(input({ workspaceId: "fitness_connection" })), /not authorized/);
  assert.throws(() => normalizeRouteIqRequestInput({ ...input(), privateNotes: "not allowed" }), error => error.code === "unexpected_request_field");
  assert.throws(() => normalizeRouteIqRequestInput(input({ consent: false })), error => error.code === "consent_required");
  assert.throws(() => normalizeRouteIqRequestInput(input({ businessEmail: "invalid" })), error => error.code === "invalid_business_email");
  assert.throws(() => normalizeRouteIqRequestInput(input({ phone: "call me" })), error => error.code === "invalid_phone");
  assert.throws(() => normalizeRouteIqRequestInput(input({ estimatedUsers: 0 })), /positive integer/);
});

test("Founder retrieval requires Cruz's exact immutable authenticated principal", async () => {
  const store = memoryDurableStore();
  const accepted = await persistRouteIqRequest(store, input(), { now: "2026-07-18T15:00:00.000Z" });
  assert.equal(authorizeRouteIqRequestFounder(cruzPrincipal()), true);

  for (const principal of [
    { authenticated: true, displayName: "Cruz Garza", role: "founder" },
    cruzPrincipal({ immutablePrincipalId: "prn:prometheus:founder:anthony:pending" }),
    cruzPrincipal({ subject: "representative_anthony_v1" }),
    cruzPrincipal({ identityImmutable: false }),
    cruzPrincipal({ authenticated: false })
  ]) {
    await assert.rejects(
      () => retrieveRouteIqRequest(store, { ...founderScope({ principal }), receiptId: accepted.receiptId }),
      error => error.code === "founder_authorization_required" && error.status === 403
    );
  }
});

test("CSV export neutralizes spreadsheet formulas and safe failure metadata excludes request PII", async () => {
  const store = memoryDurableStore();
  await persistRouteIqRequest(store, input({
    businessName: "=HYPERLINK malicious formula",
    idempotencyKey: "route_iq_request_formula_001"
  }), { now: "2026-07-18T15:00:00.000Z" });

  const csv = await exportRouteIqRequests(store, { ...founderScope(), format: "csv" });
  assert.match(csv, /"'=HYPERLINK malicious formula"/);

  let validationError;
  try {
    normalizeRouteIqRequestInput(input({ businessEmail: "secret-person@example" }));
  } catch (error) {
    validationError = error;
  }
  const metadata = routeIqRequestFailureMetadata(validationError, {
    attemptId: "route_iq_attempt_000001",
    now: "2026-07-18T15:02:00.000Z"
  });
  const serialized = JSON.stringify(metadata);
  assert.equal(metadata.failureCode, "invalid_business_email");
  assert.equal(metadata.containsRequestPii, false);
  assert.equal(serialized.includes("secret-person"), false);
  assert.equal(serialized.includes("Jordan"), false);
});

test("machine-readable CRM contract pins fields, durable semantics, and authorization boundaries", () => {
  const contract = JSON.parse(readFileSync(resolve(import.meta.dirname, "../crm/route-iq-request-crm-contract-v1.json"), "utf8"));
  assert.equal(contract.owner, "Prometheus CRM");
  assert.equal(contract.extends, "existing_workspace_lead_persistence_runtime");
  assert.equal(contract.durability.requiresAtomicPutIfAbsent, true);
  assert.equal(contract.authorization.representativeAuthorization, false);
  assert.equal(contract.authorization.anthony, "pending_exact_authenticated_identity_mapping");
  assert.equal(contract.productionMutationPerformed, false);
  assert.deepEqual(contract.canonicalFields, [
    "businessName", "contactName", "businessEmail", "phone", "businessType", "numberOfLocations",
    "estimatedUsers", "territory", "primaryProblem", "desiredTimeline", "consent", "submittedAt",
    "acquisitionSource"
  ]);
});

test("store capability and list partition failures fail closed", async () => {
  await assert.rejects(
    () => persistRouteIqRequest({ get() {}, put() {} }, input()),
    error => error.code === "crm_store_capability_missing" && error.status === 503
  );

  const store = memoryDurableStore();
  await persistRouteIqRequest(store, input(), { now: "2026-07-18T15:00:00.000Z" });
  const originalList = store.list;
  store.list = async () => ({ keys: [{ name: `${routeIqRequestCrmStoragePrefix}/workspaces/other/requests/bad.json` }] });
  await assert.rejects(
    () => listRouteIqRequests(store, founderScope()),
    error => error.code === "crm_store_list_invalid"
  );
  store.list = originalList;
});
