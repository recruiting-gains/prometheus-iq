import test from "node:test";
import assert from "node:assert/strict";
import { createHash, generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { SignJWT, createLocalJWKSet, exportJWK } from "jose";

import { routeIqRequestFounderAuthorization } from "../crm/route-iq-request-crm.mjs";
import { runRouteIqCommercialCapacityHarness } from "../workers/infrastructure/route-iq-commercial-capacity-harness.mjs";
import { RouteIqRequestCrmCoordinator } from "../workers/infrastructure/route-iq-request-crm-durable-object.js";
import { handlePrometheusIqWorkerRequest } from "../workers/prometheus-iq-worker.js";
import {
  ROUTE_IQ_REQUEST_CRM_BINDING,
  ROUTE_IQ_REQUEST_CRM_ENV,
  ROUTE_IQ_REQUEST_CRM_EXPORT_PATH,
  ROUTE_IQ_REQUEST_CRM_FOUNDER_PATH,
  ROUTE_IQ_REQUEST_CRM_PATH,
  createRouteIqRequestCrmDurableStore,
  handleRouteIqRequestCrmRuntimeRequest,
  normalizePublicRouteIqRequest
} from "../workers/infrastructure/route-iq-request-crm-runtime.js";

const now = new Date("2026-07-18T17:00:00.000Z");

function memoryStorage() {
  const records = new Map();
  let transactionTail = Promise.resolve();
  const api = {
    records,
    async get(key) {
      return records.get(key);
    },
    async put(key, value) {
      records.set(key, value);
    },
    async list({ prefix, limit }) {
      return new Map([...records.entries()].filter(([key]) => key.startsWith(prefix)).slice(0, limit));
    },
    async transaction(callback) {
      const running = transactionTail.then(() => callback(api));
      transactionTail = running.catch(() => undefined);
      return running;
    }
  };
  return api;
}

function durableNamespace() {
  const storage = memoryStorage();
  const coordinator = new RouteIqRequestCrmCoordinator({ storage }, {});
  return {
    storage,
    namespace: {
      idFromName(name) {
        assert.equal(name, "prometheus_route_iq:route_iq_commercial");
        return "route-iq-request-crm-id";
      },
      get(id) {
        assert.equal(id, "route-iq-request-crm-id");
        return { fetch: (input, init) => coordinator.fetch(new Request(input, init)) };
      }
    }
  };
}

function publicPayload(overrides = {}) {
  return {
    version: "route-iq-public-request.v1",
    formId: "route_iq_request",
    businessName: "Houston Field Services",
    contactName: "Jordan Rivera",
    businessEmail: "jordan@example.com",
    phone: "+1 713 555 0100",
    industry: "Commercial field services",
    locationCount: 4,
    estimatedUserCount: 28,
    territory: "Greater Houston",
    primaryProblem: "Coordinate field visits and understand which outcomes change by territory.",
    desiredTimeline: "Within 90 days",
    consent: true,
    submittedAt: "2026-07-18T16:59:00.000Z",
    acquisitionSource: "direct",
    websiteUrl: "",
    ...overrides
  };
}

function postRequest(payload = publicPayload()) {
  return new Request(`https://prometheusrouteiq.com${ROUTE_IQ_REQUEST_CRM_PATH}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload)
  });
}

function exactFounderPrincipal(overrides = {}) {
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

test("SQLite-backed Durable Object adapter provides transactional putIfAbsent", async () => {
  const fixture = durableNamespace();
  const store = createRouteIqRequestCrmDurableStore({ [ROUTE_IQ_REQUEST_CRM_BINDING]: fixture.namespace });
  const attempts = await Promise.all(Array.from({ length: 25 }, () => (
    store.putIfAbsent("capacity/test/key.json", "canonical", { metadata: { recordType: "test" } })
  )));
  assert.equal(attempts.filter(Boolean).length, 1);
  assert.equal(await store.get("capacity/test/key.json"), "canonical");
  await store.put("capacity/test/second.json", "second");
  assert.deepEqual(await store.list({ prefix: "capacity/test/" }), {
    keys: [{ name: "capacity/test/key.json" }, { name: "capacity/test/second.json" }]
  });
});

test("public Route IQ request is normalized, durably accepted, minimally notified, retrieved, and exported", async () => {
  const fixture = durableNamespace();
  const sent = [];
  const env = {
    [ROUTE_IQ_REQUEST_CRM_BINDING]: fixture.namespace,
    FOUNDER_EMAIL: { async send(message) { sent.push(message); return { messageId: "safe" }; } }
  };
  const first = await handleRouteIqRequestCrmRuntimeRequest(postRequest(), env, { now });
  assert.equal(first.status, 201);
  const receipt = await first.json();
  assert.equal(receipt.ok, true);
  assert.match(receipt.receiptId, /^riq_receipt_[a-f0-9]{24}$/u);
  assert.equal(receipt.duplicate, false);
  assert.equal(receipt.timestamp, receipt.submittedAt);
  assert.equal(JSON.stringify(receipt).includes("jordan"), false);
  assert.equal(sent.length, 1);
  const notification = JSON.stringify(sent[0]);
  assert.equal(notification.includes("jordan@example.com"), false);
  assert.equal(notification.includes("Jordan Rivera"), false);
  assert.equal(notification.includes("+1 713"), false);

  const store = createRouteIqRequestCrmDurableStore(env);
  const authTestHooks = { enabled: true, principal: exactFounderPrincipal() };
  const found = await handleRouteIqRequestCrmRuntimeRequest(
    new Request(`https://prometheusrouteiq.com${ROUTE_IQ_REQUEST_CRM_FOUNDER_PATH}/${receipt.receiptId}`),
    env,
    { store, authTestHooks, now }
  );
  assert.equal(found.status, 200);
  assert.equal((await found.json()).record.request.businessEmail, "jordan@example.com");

  const listed = await handleRouteIqRequestCrmRuntimeRequest(
    new Request(`https://prometheusrouteiq.com${ROUTE_IQ_REQUEST_CRM_FOUNDER_PATH}`),
    env,
    { store, authTestHooks, now }
  );
  assert.equal((await listed.json()).recordCount, 1);

  for (const format of ["json", "csv"]) {
    const exported = await handleRouteIqRequestCrmRuntimeRequest(
      new Request(`https://prometheusrouteiq.com${ROUTE_IQ_REQUEST_CRM_EXPORT_PATH}?format=${format}`),
      env,
      { store, authTestHooks, now }
    );
    assert.equal(exported.status, 200);
    assert.match(await exported.text(), /Houston Field Services/u);
  }
});

test("composed Worker sends the active public intake through Aegis and the Route IQ CRM runtime", async () => {
  const fixture = durableNamespace();
  const result = await handlePrometheusIqWorkerRequest(postRequest(publicPayload({
    submittedAt: new Date().toISOString()
  })), {
    [ROUTE_IQ_REQUEST_CRM_BINDING]: fixture.namespace,
    ASSETS: { fetch: async () => new Response("asset") }
  }, { waitUntil() {} });
  assert.equal(result.status, 201);
  assert.equal(result.headers.get("X-Aegis-Route-Policy"), "lead_intake");
  const body = await result.json();
  assert.equal(body.ok, true);
  assert.match(body.receiptId, /^riq_receipt_[a-f0-9]{24}$/u);
  assert.equal(JSON.stringify(body).includes("Houston Field Services"), false);
});

test("identical retries return one receipt and changed reuse fails closed without another accepted record", async () => {
  const fixture = durableNamespace();
  const env = { [ROUTE_IQ_REQUEST_CRM_BINDING]: fixture.namespace };
  const first = await handleRouteIqRequestCrmRuntimeRequest(postRequest(), env, { now });
  const firstReceipt = await first.json();
  const retry = await handleRouteIqRequestCrmRuntimeRequest(postRequest(), env, { now });
  const retryReceipt = await retry.json();
  assert.equal(retry.status, 200);
  assert.equal(retryReceipt.duplicate, true);
  assert.equal(retryReceipt.receiptId, firstReceipt.receiptId);

  const conflict = await handleRouteIqRequestCrmRuntimeRequest(
    postRequest(publicPayload({ primaryProblem: "Changed content cannot reuse the same submission event identity." })),
    env,
    { now }
  );
  assert.equal(conflict.status, 409);
  assert.equal((await conflict.json()).code, "idempotency_conflict");

  const store = createRouteIqRequestCrmDurableStore(env);
  const list = await store.list({ prefix: "crm-route-iq-requests-v1/workspaces/prometheus_route_iq/requests/" });
  assert.equal(list.keys.length, 1);
});

test("strict public validation and spam protection fail closed with PII-free monitoring", async () => {
  const fixture = durableNamespace();
  const env = { [ROUTE_IQ_REQUEST_CRM_BINDING]: fixture.namespace };
  const captured = [];
  const original = console.error;
  console.error = message => captured.push(message);
  try {
    for (const payload of [
      publicPayload({ websiteUrl: "spam.example" }),
      publicPayload({ consent: false }),
      publicPayload({ submittedAt: "2025-01-01T00:00:00.000Z" }),
      { ...publicPayload(), workspaceId: "fitness_connection" }
    ]) {
      const result = await handleRouteIqRequestCrmRuntimeRequest(postRequest(payload), env, {
        now,
        testHooks: { enabled: true, attemptId: `route_iq_attempt_${String(captured.length + 1).padStart(6, "0")}` }
      });
      assert.ok(result.status >= 400);
    }
  } finally {
    console.error = original;
  }
  const log = captured.join("\n");
  assert.equal(log.includes("jordan@example.com"), false);
  assert.equal(log.includes("Jordan Rivera"), false);
  assert.match(log, /containsRequestPii.*false/u);
  const failureKeys = [...fixture.storage.records.keys()].filter(key => key.includes("/failures/"));
  assert.equal(failureKeys.length, 4);
  for (const key of failureKeys) {
    const stored = fixture.storage.records.get(key)?.value || "";
    assert.equal(stored.includes("jordan@example.com"), false);
    assert.equal(stored.includes("Jordan Rivera"), false);
  }
});

test("Founder retrieval requires a cryptographically verified exact immutable subject", async () => {
  const fixture = durableNamespace();
  const env = { [ROUTE_IQ_REQUEST_CRM_BINDING]: fixture.namespace };
  const accepted = await handleRouteIqRequestCrmRuntimeRequest(postRequest(), env, { now });
  assert.equal(accepted.status, 201);

  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = await exportJWK(publicKey);
  jwk.alg = "RS256";
  jwk.use = "sig";
  jwk.kid = "route-iq-request-test-key";
  const issuer = "https://prometheus-test.cloudflareaccess.com";
  const audience = "route-iq-request-founder-test-audience";
  const subject = "immutable-access-subject-cruz-test";
  const subjectHash = createHash("sha256").update(subject).digest("hex");
  Object.assign(env, {
    [ROUTE_IQ_REQUEST_CRM_ENV.accessTeamDomain]: issuer,
    [ROUTE_IQ_REQUEST_CRM_ENV.accessAudience]: audience,
    [ROUTE_IQ_REQUEST_CRM_ENV.founderSubjectSha256]: subjectHash
  });
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "RS256", kid: jwk.kid })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject(subject)
    .setIssuedAt(Math.floor(now.getTime() / 1000) - 10)
    .setExpirationTime(Math.floor(now.getTime() / 1000) + 300)
    .sign(privateKey);
  const authTestHooks = {
    enabled: true,
    keyResolver: createLocalJWKSet({ keys: [jwk] }),
    currentDate: now
  };
  const request = new Request(`https://prometheusrouteiq.com${ROUTE_IQ_REQUEST_CRM_FOUNDER_PATH}`, {
    headers: { "Cf-Access-Jwt-Assertion": token }
  });
  const authorized = await handleRouteIqRequestCrmRuntimeRequest(request, env, { authTestHooks, now });
  assert.equal(authorized.status, 200);

  env[ROUTE_IQ_REQUEST_CRM_ENV.founderSubjectSha256] = createHash("sha256").update("representative-subject").digest("hex");
  const denied = await handleRouteIqRequestCrmRuntimeRequest(request, env, { authTestHooks, now });
  assert.equal(denied.status, 403);
  assert.equal((await denied.json()).code, "route_iq_request_founder_principal_unmapped");
});

test("missing durable binding, unsupported methods, and malformed exports fail closed", async () => {
  const missing = await handleRouteIqRequestCrmRuntimeRequest(postRequest(), {}, { now });
  assert.equal(missing.status, 503);
  assert.equal((await missing.json()).code, "route_iq_request_crm_binding_missing");

  const method = await handleRouteIqRequestCrmRuntimeRequest(
    new Request(`https://prometheusrouteiq.com${ROUTE_IQ_REQUEST_CRM_PATH}`, { method: "GET" }),
    {}
  );
  assert.equal(method.status, 405);
  assert.equal(method.headers.get("Allow"), "POST");

  const missingFounderConfig = await handleRouteIqRequestCrmRuntimeRequest(
    new Request(`https://prometheusrouteiq.com${ROUTE_IQ_REQUEST_CRM_FOUNDER_PATH}`),
    {}
  );
  assert.equal(missingFounderConfig.status, 503);
  assert.equal((await missingFounderConfig.json()).code, "route_iq_request_founder_auth_config_invalid");

  const fixture = durableNamespace();
  const malformed = await handleRouteIqRequestCrmRuntimeRequest(
    new Request(`https://prometheusrouteiq.com${ROUTE_IQ_REQUEST_CRM_EXPORT_PATH}?format=xml`),
    { [ROUTE_IQ_REQUEST_CRM_BINDING]: fixture.namespace },
    { authTestHooks: { enabled: true, principal: exactFounderPrincipal() }, now }
  );
  assert.equal(malformed.status, 422);
});

test("normalization fixes the public request to Route IQ commercial scope", async () => {
  const normalized = await normalizePublicRouteIqRequest(publicPayload(), { now });
  assert.equal(normalized.workspaceId, "prometheus_route_iq");
  assert.equal(normalized.operatingProfileId, "route_iq_commercial");
  assert.equal(normalized.businessType, "Commercial field services");
  assert.equal(normalized.acquisitionSource, "route_iq_website");
  assert.equal(JSON.stringify(normalized).includes("fitness_connection"), false);
  assert.equal(JSON.stringify(normalized).includes("smoothie_depot"), false);
});

test("governed initial capacity target passes at 10 workspaces, 100 users, and 25 concurrent users", async () => {
  const result = await runRouteIqCommercialCapacityHarness();
  assert.deepEqual(result.verifiedSafeInitialCapacity, {
    workspaceCount: 10,
    totalUsers: 100,
    concurrentUsers: 25
  });
  assert.equal(result.recordIntegrity.uniqueAcceptedRecords, 100);
  assert.equal(result.recordIntegrity.lostAcceptedRecords, 0);
  assert.equal(result.recordIntegrity.duplicateAcceptedRecords, 0);
  assert.equal(result.isolation.crossWorkspaceExposure, 0);
  assert.equal(result.isolation.crossUserExposure, 0);
  assert.equal(result.isolation.crossWorkspaceAuthorizationFailures, 0);
  assert.equal(result.isolation.crossUserAuthorizationFailures, 0);
  assert.equal(result.isolation.blockedCrossWorkspaceAttempts, 100);
  assert.equal(result.isolation.blockedCrossUserAttempts, 100);
  assert.equal(result.boundaries.prospectiveCollection, "OFF");
  assert.equal(result.boundaries.activeCohorts, 0);
  assert.equal(result.boundaries.recommendationInfluence, "OFF");
  assert.ok(result.latencyMs.p95 >= 0);
  assert.ok(result.resources.heapDeltaBytes >= 0);
});

test("active Worker route and source configuration use only the Route IQ CRM runtime", () => {
  const root = resolve(import.meta.dirname, "..");
  const worker = readFileSync(resolve(root, "workers/prometheus-iq-worker.js"), "utf8");
  const contract = JSON.parse(readFileSync(resolve(root, "workers/infrastructure/route-iq-request-crm-runtime-v1.json"), "utf8"));
  const integration = readFileSync(resolve(root, "integrations/shared-workspace-lead-intake-contract.js"), "utf8");
  assert.match(worker, /isRouteIqRequestCrmPath/u);
  assert.doesNotMatch(worker, /handlePartnerIntakeRequest/u);
  assert.equal(contract.publicIntake.legacyFitnessRoutingActive, false);
  assert.equal(contract.publicIntake.legacySmoothieRoutingActive, false);
  assert.equal(contract.storage.kvCasClaimed, false);
  assert.equal(contract.storage.productionProvisioned, false);
  assert.equal(contract.boundaries.prospectiveRuntimeFilesChanged, false);
  assert.match(integration, /activeRouteIqRequestRuntime/u);
  assert.match(integration, /legacyWorkspaceIntakeRuntime/u);
  assert.match(integration, /productionRouteSelectedByWorker: false/u);
});
