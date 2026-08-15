import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  RouteIqGymRequestContractError,
  adaptRouteIqGymRequestForCrm,
  normalizeRouteIqGymRequestCrmInput,
  routeIqGymRequestAcquisitionSource,
  routeIqGymRequestAttributionFields,
  routeIqGymRequestCrmScope,
  routeIqGymRequestFormId,
  routeIqGymRequestInfrastructureAdapterContract,
  routeIqGymRequestVersion
} from "../crm/route-iq-gym-intake.mjs";
import {
  RouteIqRequestCrmError,
  claimRouteIqRequestNotificationDelivery,
  exportRouteIqRequests,
  listRouteIqRequests,
  persistRouteIqRequest,
  publicRouteIqRequestReceipt,
  retrieveRouteIqRequest,
  routeIqRequestCrmContract,
  routeIqRequestFailureMetadata,
  routeIqRequestFounderAuthorization
} from "../crm/route-iq-request-crm.mjs";

function memoryDurableStore() {
  const items = new Map();
  const writes = [];
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

function publicGymPayload(overrides = {}) {
  return {
    version: routeIqGymRequestVersion,
    formId: routeIqGymRequestFormId,
    fullName: "Jordan Rivera",
    gymName: "Iron Harbor Training",
    cityState: "Houston, TX",
    outsideRepCount: 4,
    workEmail: "jordan@ironharbor.example",
    cell: "+1 713 555 0148",
    consent: true,
    submittedAt: "2026-08-14T18:30:00.000Z",
    acquisitionSource: routeIqGymRequestAcquisitionSource,
    attribution: {
      utm_source: "reddit",
      utm_medium: "paid_social",
      utm_campaign: "gym_first_launch",
      utm_term: "warehouse_gym",
      utm_content: "intelligence_ad"
    },
    websiteUrl: "",
    ...overrides
  };
}

function adapt(payload = publicGymPayload(), scope = routeIqGymRequestCrmScope) {
  return adaptRouteIqGymRequestForCrm(payload, scope, { now: "2026-08-14T18:31:00.000Z" });
}

function generalInput(overrides = {}) {
  return {
    workspaceId: "prometheus_route_iq",
    operatingProfileId: "route_iq_commercial",
    idempotencyKey: "route_iq_request_00000001",
    businessName: "Houston Field Services",
    contactName: "Morgan Ellis",
    businessEmail: "morgan@example.com",
    phone: "+1 713 555 0100",
    businessType: "Commercial field services",
    numberOfLocations: 4,
    estimatedUsers: 28,
    territory: "Greater Houston",
    primaryProblem: "Coordinate field visits and understand which outcomes change by territory.",
    desiredTimeline: "within_90_days",
    consent: true,
    acquisitionSource: "route_iq_website",
    ...overrides
  };
}

function founderScope() {
  return {
    principal: {
      authenticated: true,
      identityProvider: routeIqRequestFounderAuthorization.identityProvider,
      immutablePrincipalId: routeIqRequestFounderAuthorization.immutablePrincipalId,
      workspaceId: routeIqRequestFounderAuthorization.workspaceId,
      identityImmutable: true
    },
    workspaceId: "prometheus_route_iq",
    operatingProfileId: "route_iq_commercial"
  };
}

test("gym intake contract and Infrastructure adapter are exact, versioned, and deterministic", () => {
  const contract = JSON.parse(readFileSync(resolve(import.meta.dirname, "../crm/route-iq-gym-request-contract-v1.json"), "utf8"));
  const first = adapt();
  const second = adapt();

  assert.equal(contract.version, routeIqGymRequestVersion);
  assert.equal(contract.owner, "Prometheus CRM");
  assert.equal(contract.coexistsWith, routeIqRequestCrmContract);
  assert.equal(contract.publicPayload.additionalProperties, false);
  assert.deepEqual(contract.publicPayload.attribution.allowedFields, routeIqGymRequestAttributionFields);
  assert.equal(contract.infrastructureAdapter.module, "crm/route-iq-gym-intake.mjs");
  assert.equal(contract.infrastructureAdapter.export, routeIqGymRequestInfrastructureAdapterContract.exportName);
  assert.equal(contract.infrastructureAdapter.signature, routeIqGymRequestInfrastructureAdapterContract.signature);
  assert.deepEqual(contract.notification.emailFields, routeIqGymRequestInfrastructureAdapterContract.notificationEmailFields);

  assert.deepEqual(first, second);
  assert.match(first.idempotencyKey, /^route_iq_gym_request_[a-f0-9]{64}$/u);
  assert.equal(first.contractVersion, routeIqGymRequestVersion);
  assert.equal(first.workspaceId, routeIqGymRequestCrmScope.workspaceId);
  assert.equal(first.operatingProfileId, routeIqGymRequestCrmScope.operatingProfileId);
  assert.equal(first.formId, routeIqGymRequestFormId);
  assert.equal(first.workEmail, "jordan@ironharbor.example");
  assert.deepEqual(first.attribution, publicGymPayload().attribution);
  assert.equal(Object.hasOwn(first, "websiteUrl"), false);
  assert.equal(Object.hasOwn(first, "businessName"), false);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.attribution), true);
});

test("gym attribution retains only populated allowlisted UTM values", () => {
  const normalized = adapt(publicGymPayload({
    attribution: {
      utm_source: "  reddit  ",
      utm_medium: "",
      utm_campaign: "gym launch"
    }
  }));

  assert.deepEqual(normalized.attribution, {
    utm_source: "reddit",
    utm_campaign: "gym launch"
  });
});

test("gym public and internal validation fail closed on scope, shape, hostile content, and unsafe attribution", () => {
  const failures = [
    () => adapt({ ...publicGymPayload(), extra: "unsupported" }),
    () => adapt((({ fullName: _removed, ...rest }) => rest)(publicGymPayload())),
    () => adapt(publicGymPayload({ version: "route-iq-gym-request.v2" })),
    () => adapt(publicGymPayload({ formId: "route_iq_request" })),
    () => adapt(publicGymPayload({ acquisitionSource: "reddit" })),
    () => adapt(publicGymPayload({ outsideRepCount: 0 })),
    () => adapt(publicGymPayload({ outsideRepCount: 11 })),
    () => adapt(publicGymPayload({ outsideRepCount: "4" })),
    () => adapt(publicGymPayload({ consent: false })),
    () => adapt(publicGymPayload({ websiteUrl: "https://spam.example" })),
    () => adapt(publicGymPayload({ workEmail: "not-an-email" })),
    () => adapt(publicGymPayload({ cell: "call me" })),
    () => adapt(publicGymPayload({ gymName: "<script>alert(1)</script>" })),
    () => adapt(publicGymPayload({ gymName: "=HYPERLINK(unsafe)" })),
    () => adapt(publicGymPayload({ cityState: "Houston, TX; DROP TABLE requests" })),
    () => adapt(publicGymPayload({ fullName: "${process.env.SECRET}" })),
    () => adapt(publicGymPayload({ submittedAt: "2026-08-12T18:30:00.000Z" })),
    () => adapt(publicGymPayload({ submittedAt: "2026-08-14T19:30:00.000Z" })),
    () => adapt(publicGymPayload({ attribution: { click_id: "unapproved" } })),
    () => adapt(publicGymPayload({ attribution: { utm_campaign: "x".repeat(121) } })),
    () => adapt(publicGymPayload({ attribution: { utm_content: "api_key=do-not-retain" } })),
    () => adapt(publicGymPayload({ attribution: { utm_content: `sk_live_${"1".repeat(16)}` } })),
    () => adapt(publicGymPayload({ attribution: { utm_content: `AKIA${"1".repeat(16)}` } })),
    () => adapt(publicGymPayload(), { workspaceId: "other", operatingProfileId: "route_iq_commercial" }),
    () => adapt(publicGymPayload(), { workspaceId: "prometheus_route_iq", operatingProfileId: "other" }),
    () => normalizeRouteIqGymRequestCrmInput({ ...adapt(), callerSelectedTenant: "other" })
  ];
  for (const invoke of failures) {
    assert.throws(invoke, error => error instanceof RouteIqGymRequestContractError && error.code.startsWith("route_iq_request_"));
  }
});

test("gym requests receive one durable deterministic receipt and reject changed idempotency reuse", async () => {
  const store = memoryDurableStore();
  const input = adapt();
  const first = await persistRouteIqRequest(store, input, { now: "2026-08-14T18:31:02.000Z" });
  const retry = await persistRouteIqRequest(store, input, { now: "2026-08-14T18:40:00.000Z" });

  assert.equal(first.duplicate, false);
  assert.equal(first.receiptId, "riq_receipt_e15c759099c79991c0c09e51");
  assert.equal(input.idempotencyKey, "route_iq_gym_request_e15c759099c79991c0c09e51977230dad814df0479dafe3a4083ca1c0d4dda8f");
  assert.equal(retry.duplicate, true);
  assert.equal(retry.status, "already_accepted");
  assert.equal(retry.receiptId, first.receiptId);
  assert.equal(retry.record.request.submittedAt, "2026-08-14T18:30:00.000Z");
  assert.equal(retry.record.monitoring.acceptedAt, "2026-08-14T18:31:02.000Z");
  assert.equal(first.record.requestContractVersion, routeIqGymRequestVersion);
  assert.equal(first.record.request.gymName, "Iron Harbor Training");
  assert.equal(first.record.request.outsideRepCount, 4);
  assert.equal(first.record.request.consent.acceptedAt, first.record.request.submittedAt);
  assert.equal(first.record.integrity.idempotencyKeyStored, false);
  assert.equal(JSON.stringify(first.record).includes(input.idempotencyKey), false);
  assert.equal(Object.hasOwn(first.record.request, "numberOfLocations"), false);
  assert.equal(Object.hasOwn(first.record.request, "estimatedUsers"), false);
  assert.equal(Object.hasOwn(first.record.request, "primaryProblem"), false);

  await assert.rejects(
    () => persistRouteIqRequest(store, { ...input, gymName: "Changed Gym" }),
    error => error instanceof RouteIqRequestCrmError && error.code === "idempotency_conflict" && error.status === 409
  );

  const duplicateIdentity = await persistRouteIqRequest(store, {
    ...input,
    idempotencyKey: `route_iq_gym_request_${"f".repeat(64)}`
  });
  assert.equal(duplicateIdentity.duplicate, true);
  assert.equal(duplicateIdentity.receiptId, first.receiptId);

  const receipt = publicRouteIqRequestReceipt(first);
  assert.equal(receipt.contractVersion, routeIqGymRequestVersion);
  assert.equal(receipt.receiptId, first.receiptId);
});

test("Founder list, retrieval, and export distinguish gym and general request contracts", async () => {
  const store = memoryDurableStore();
  const general = await persistRouteIqRequest(store, generalInput(), { now: "2026-08-14T18:29:00.000Z" });
  const gym = await persistRouteIqRequest(store, adapt(), { now: "2026-08-14T18:31:02.000Z" });
  const scope = founderScope();
  const records = await listRouteIqRequests(store, scope);

  assert.equal(records.length, 2);
  assert.equal(records[0].requestContractVersion, undefined);
  assert.equal(records[0].contract, routeIqRequestCrmContract);
  assert.equal(records[1].requestContractVersion, routeIqGymRequestVersion);
  assert.deepEqual(await retrieveRouteIqRequest(store, { ...scope, receiptId: general.receiptId }), general.record);
  assert.deepEqual(await retrieveRouteIqRequest(store, { ...scope, receiptId: gym.receiptId }), gym.record);

  const json = JSON.parse(await exportRouteIqRequests(store, {
    ...scope,
    format: "json",
    generatedAt: "2026-08-14T18:45:00.000Z"
  }));
  assert.deepEqual(Object.keys(json), ["version", "workspaceId", "generatedAt", "recordCount", "records"]);
  assert.equal(json.records[0].request.businessName, "Houston Field Services");
  assert.equal(json.records[1].request.gymName, "Iron Harbor Training");

  const csv = await exportRouteIqRequests(store, {
    ...scope,
    format: "csv",
    generatedAt: "2026-08-14T18:45:00.000Z"
  });
  assert.match(csv, /^"receiptId","submittedAt","businessName"/u);
  assert.match(csv, /"contractVersion","formId","fullName","gymName"/u);
  assert.match(csv, /"utm_source","utm_medium","utm_campaign","utm_term","utm_content"/u);
  assert.match(csv, /"route_iq_request_crm\.v1"/u);
  assert.match(csv, /"route-iq-gym-request\.v1","route_iq_gym_request","Jordan Rivera","Iron Harbor Training"/u);
  assert.match(csv, /"reddit","paid_social","gym_first_launch","warehouse_gym","intelligence_ad"/u);
});

test("the baseline general request retains its exact historical receipt identity", async () => {
  const store = memoryDurableStore();
  const accepted = await persistRouteIqRequest(store, generalInput({
    contactName: "Jordan Rivera",
    businessEmail: "jordan@example.com",
    primaryProblem: "Coordinate field visits and understand which outcomes are changing by territory."
  }), { now: "2026-07-18T15:00:00.000Z" });

  assert.equal(accepted.receiptId, "riq_receipt_defa68d385ef61c70365e26e");
  assert.equal(accepted.record.requestContractVersion, undefined);
  assert.equal(accepted.record.contract, routeIqRequestCrmContract);
  assert.deepEqual(publicRouteIqRequestReceipt(accepted), {
    ok: true,
    version: "route-iq-request-crm-v1",
    receiptId: accepted.receiptId,
    status: "accepted",
    duplicate: false,
    submittedAt: "2026-07-18T15:00:00.000Z"
  });
});

test("Founder reads reject records from a different operating profile", async () => {
  const store = memoryDurableStore();
  const accepted = await persistRouteIqRequest(store, adapt(), { now: "2026-08-14T18:31:02.000Z" });
  const recordEntry = [...store.items.entries()].find(([key]) => key.includes("/requests/"));
  const crossed = JSON.parse(recordEntry[1].value);
  crossed.workspace.operatingProfileId = "other_profile";
  store.items.set(recordEntry[0], { ...recordEntry[1], value: JSON.stringify(crossed) });

  await assert.rejects(
    () => retrieveRouteIqRequest(store, { ...founderScope(), receiptId: accepted.receiptId }),
    error => error.code === "crm_store_record_invalid" && error.status === 500
  );
  await assert.rejects(
    () => listRouteIqRequests(store, founderScope()),
    error => error.code === "crm_store_record_invalid" && error.status === 500
  );
});

test("gym notification ordering remains post-persistence and notification records contain no contact PII", async () => {
  const store = memoryDurableStore();
  const accepted = await persistRouteIqRequest(store, adapt(), { now: "2026-08-14T18:31:02.000Z" });
  const writesBeforeClaim = store.writes.length;
  const claim = await claimRouteIqRequestNotificationDelivery(store, accepted.receiptId, {
    now: "2026-08-14T18:31:03.000Z"
  });

  assert.equal(claim.state, "claimed");
  assert.ok(store.writes.slice(0, writesBeforeClaim).some(write => write.key.includes("/idempotency/")));
  assert.ok(store.writes.slice(0, writesBeforeClaim).some(write => write.key.includes("/requests/")));
  assert.equal(store.writes[writesBeforeClaim].key.includes("/notification-attempts/"), true);
  const notificationWrite = store.writes[writesBeforeClaim].value;
  assert.equal(notificationWrite.includes("Jordan Rivera"), false);
  assert.equal(notificationWrite.includes("jordan@ironharbor.example"), false);
  assert.equal(notificationWrite.includes("+1 713 555 0148"), false);
});

test("gym validation failure metadata is fixed, scoped, and contains no submitted values", () => {
  let error;
  try {
    adapt(publicGymPayload({ attribution: { utm_source: "Bearer highly-sensitive-token" } }));
  } catch (caught) {
    error = caught;
  }
  const metadata = routeIqRequestFailureMetadata(error, {
    attemptId: "route_iq_attempt_gym_0001",
    now: "2026-08-14T18:31:00.000Z"
  });
  const serialized = JSON.stringify(metadata);
  assert.equal(metadata.failureCode, "route_iq_request_gym_attribution_secret_rejected");
  assert.equal(metadata.containsRequestPii, false);
  assert.equal(serialized.includes("highly-sensitive-token"), false);
  assert.equal(serialized.includes("Jordan"), false);
});
