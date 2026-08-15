import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash, generateKeyPairSync } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { SignJWT, createLocalJWKSet, exportJWK } from "jose";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";

import {
  adaptRouteIqGymRequestForCrm,
  routeIqGymRequestCrmScope,
  routeIqGymRequestVersion
} from "../crm/route-iq-gym-intake.mjs";
import { routeIqRequestFounderAuthorization } from "../crm/route-iq-request-crm.mjs";
import { runRouteIqCommercialCapacityHarness } from "../workers/infrastructure/route-iq-commercial-capacity-harness.mjs";
import { RouteIqRequestCrmCoordinator } from "../workers/infrastructure/route-iq-request-crm-durable-object.js";
import { handlePrometheusIqWorkerRequest } from "../workers/prometheus-iq-worker.js";
import {
  ROUTE_IQ_REQUEST_CRM_BINDING,
  ROUTE_IQ_REQUEST_CRM_ENV,
  ROUTE_IQ_REQUEST_CRM_EXPORT_PATH,
  ROUTE_IQ_REQUEST_CRM_FOUNDER_AUTH_FAILURES,
  ROUTE_IQ_REQUEST_CRM_FOUNDER_PATH,
  ROUTE_IQ_REQUEST_CRM_MONITORING_PATH,
  ROUTE_IQ_REQUEST_CRM_PATH,
  createRouteIqRequestCrmDurableStore,
  handleRouteIqRequestCrmRuntimeRequest,
  normalizePublicRouteIqRequest
} from "../workers/infrastructure/route-iq-request-crm-runtime.js";

const now = new Date("2026-07-18T17:00:00.000Z");
const gymNow = new Date("2026-08-14T18:31:00.000Z");

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

function injectedRuntimeStore({ failNotificationResultOnce = false } = {}) {
  const items = new Map();
  let shouldFailNotificationResult = failNotificationResultOnce;
  return {
    items,
    async get(key) {
      return items.get(key) ?? null;
    },
    async putIfAbsent(key, value) {
      if (shouldFailNotificationResult && key.includes("/notifications/")) {
        shouldFailNotificationResult = false;
        throw new Error("synthetic notification result persistence interruption");
      }
      if (items.has(key)) return false;
      items.set(key, String(value));
      return true;
    },
    async put(key, value) {
      items.set(key, String(value));
    },
    async list({ prefix }) {
      return {
        keys: [...items.keys()].filter(key => key.startsWith(prefix)).sort().map(name => ({ name }))
      };
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

function publicGymPayload(overrides = {}) {
  return {
    version: routeIqGymRequestVersion,
    formId: "route_iq_gym_request",
    fullName: "Jordan Rivera",
    gymName: "Iron Harbor Training",
    cityState: "Houston, TX",
    outsideRepCount: 4,
    workEmail: "jordan@ironharbor.example",
    cell: "+1 713 555 0148",
    consent: true,
    submittedAt: "2026-08-14T18:30:00.000Z",
    acquisitionSource: "route_iq_website",
    attribution: {
      utm_source: "reddit",
      utm_medium: "paid_social",
      utm_campaign: "gym_first_launch"
    },
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

async function founderJwtHarness() {
  const primary = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const secondary = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const primaryJwk = await exportJWK(primary.publicKey);
  const secondaryJwk = await exportJWK(secondary.publicKey);
  Object.assign(primaryJwk, { alg: "RS256", use: "sig", kid: "route-iq-founder-primary" });
  Object.assign(secondaryJwk, { alg: "RS256", use: "sig", kid: "route-iq-founder-secondary" });
  const issuer = "https://prometheus-test.cloudflareaccess.com";
  const audience = "route-iq-request-founder-test-audience";
  const subject = "immutable-access-subject-cruz-test";
  const epoch = Math.floor(now.getTime() / 1000);
  const env = {
    [ROUTE_IQ_REQUEST_CRM_ENV.accessTeamDomain]: issuer,
    [ROUTE_IQ_REQUEST_CRM_ENV.accessAudience]: audience,
    [ROUTE_IQ_REQUEST_CRM_ENV.founderSubjectSha256]: createHash("sha256").update(subject).digest("hex")
  };
  const primaryResolver = createLocalJWKSet({ keys: [primaryJwk] });
  const issue = async ({
    privateKey = primary.privateKey,
    kid = primaryJwk.kid,
    tokenIssuer = issuer,
    tokenAudience = audience,
    tokenSubject = subject,
    issuedAt = epoch - 10,
    notBefore = epoch - 10,
    expiration = epoch + 300,
    omit = []
  } = {}) => {
    let builder = new SignJWT({}).setProtectedHeader({ alg: "RS256", kid });
    if (!omit.includes("iss")) builder = builder.setIssuer(tokenIssuer);
    if (!omit.includes("aud")) builder = builder.setAudience(tokenAudience);
    if (!omit.includes("sub")) builder = builder.setSubject(tokenSubject);
    if (!omit.includes("iat")) builder = builder.setIssuedAt(issuedAt);
    if (!omit.includes("nbf")) builder = builder.setNotBefore(notBefore);
    if (!omit.includes("exp")) builder = builder.setExpirationTime(expiration);
    return builder.sign(privateKey);
  };
  const request = token => new Request(`https://prometheusrouteiq.com${ROUTE_IQ_REQUEST_CRM_FOUNDER_PATH}`, {
    headers: { "Cf-Access-Jwt-Assertion": token }
  });
  const readStore = {
    async get() { return null; },
    async list() { return { keys: [] }; },
    async put() {},
    async putIfAbsent() { return false; }
  };
  const verify = (token, { keyResolver = primaryResolver, environment = env } = {}) => (
    handleRouteIqRequestCrmRuntimeRequest(request(token), environment, {
      store: readStore,
      authTestHooks: { enabled: true, keyResolver, currentDate: now },
      now
    })
  );
  return {
    audience,
    env,
    epoch,
    issue,
    issuer,
    primaryJwk,
    primaryResolver,
    secondary,
    secondaryJwk,
    subject,
    verify
  };
}

function bundlePublicWorkerForJwksFixture() {
  const root = resolve(import.meta.dirname, "..");
  const outputDirectory = mkdtempSync(join(tmpdir(), "route-iq-founder-jwks-bundle-"));
  const wrangler = resolve(root, "node_modules/wrangler/bin/wrangler.js");
  const result = spawnSync(process.execPath, [
    wrangler,
    "deploy",
    "--dry-run",
    "--strict",
    "--keep-vars",
    "--config",
    "wrangler.prometheusrouteiq-website.jsonc",
    "--outdir",
    outputDirectory
  ], {
    cwd: root,
    encoding: "utf8",
    env: {
      CI: "1",
      HOME: process.env.HOME,
      NO_COLOR: "1",
      NO_UPDATE_NOTIFIER: "1",
      PATH: process.env.PATH,
      WRANGLER_SEND_METRICS: "false"
    },
    maxBuffer: 2 * 1024 * 1024,
    timeout: 120_000
  });
  if (result.status !== 0) {
    rmSync(outputDirectory, { recursive: true, force: true });
    assert.fail("The local public Worker bundle did not complete.");
  }
  const path = join(outputDirectory, "prometheusrouteiq-website-entry.js");
  const script = readFileSync(path, "utf8").replace(/\n\/\/# sourceMappingURL=.*\n?$/u, "\n");
  return {
    outputDirectory,
    script,
    dispose() {
      rmSync(outputDirectory, { recursive: true, force: true });
    }
  };
}

async function dispatchBundledFounderJwt({ fixture, script, token, outboundService }) {
  const root = resolve(import.meta.dirname, "..");
  const miniflare = new Miniflare(convertV4MiniflareOptions({
    modules: true,
    modulesRoot: root,
    script,
    scriptPath: join(root, "route-iq-founder-jwks-bundled-fixture.mjs"),
    compatibilityDate: "2026-07-01",
    compatibilityFlags: ["nodejs_compat"],
    bindings: fixture.env,
    durableObjects: {
      [ROUTE_IQ_REQUEST_CRM_BINDING]: {
        className: "RouteIqRequestCrmCoordinator",
        useSQLite: true
      }
    },
    outboundService
  }));
  try {
    const response = await miniflare.dispatchFetch(
      `https://prometheusrouteiq.com${ROUTE_IQ_REQUEST_CRM_FOUNDER_PATH}`,
      { headers: { "Cf-Access-Jwt-Assertion": token } }
    );
    return { status: response.status, body: await response.json() };
  } finally {
    await miniflare.dispose();
  }
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

test("gym public intake uses the CRM adapter unchanged, persists once, and limits notification fields", async () => {
  const payload = publicGymPayload();
  const expected = adaptRouteIqGymRequestForCrm(payload, routeIqGymRequestCrmScope, { now: gymNow });
  const normalized = await normalizePublicRouteIqRequest(payload, { now: gymNow });
  assert.deepEqual(normalized, expected);
  assert.equal(normalized.workspaceId, "prometheus_route_iq");
  assert.equal(normalized.operatingProfileId, "route_iq_commercial");

  await assert.rejects(
    () => normalizePublicRouteIqRequest(payload, { now: "2026-08-16T18:31:00.000Z" }),
    error => error.code === "route_iq_request_gym_submission_time_invalid"
  );

  const store = injectedRuntimeStore();
  const sent = [];
  const accepted = await handleRouteIqRequestCrmRuntimeRequest(postRequest(payload), {
    FOUNDER_EMAIL: {
      async send(message) {
        assert.equal([...store.items.keys()].some(key => key.includes("/requests/")), true);
        sent.push(message);
      }
    }
  }, { store, now: gymNow });
  const receipt = await accepted.json();
  assert.equal(accepted.status, 201);
  assert.equal(receipt.contractVersion, routeIqGymRequestVersion);
  assert.equal(receipt.timestamp, payload.submittedAt);
  assert.match(receipt.receiptId, /^riq_receipt_[a-f0-9]{24}$/u);
  assert.equal(JSON.stringify(receipt).includes(payload.gymName), false);

  const recordEntry = [...store.items.entries()].find(([key]) => key.includes("/requests/"));
  const record = JSON.parse(recordEntry[1]);
  assert.equal(record.requestContractVersion, routeIqGymRequestVersion);
  assert.equal(record.request.gymName, payload.gymName);
  assert.equal(record.request.outsideRepCount, payload.outsideRepCount);
  assert.equal(Object.hasOwn(record.request, "numberOfLocations"), false);
  assert.equal(Object.hasOwn(record.request, "estimatedUsers"), false);

  assert.equal(sent.length, 1);
  const notification = JSON.stringify(sent[0]);
  assert.match(notification, new RegExp(receipt.receiptId, "u"));
  assert.match(notification, new RegExp(payload.submittedAt.replaceAll(".", "\\."), "u"));
  assert.match(notification, /route-iq-gym-request\.v1/u);
  for (const forbidden of [
    payload.fullName,
    payload.gymName,
    payload.cityState,
    payload.workEmail,
    payload.cell,
    "undefined"
  ]) {
    assert.equal(notification.includes(forbidden), false);
  }
});

test("known sent notification state is terminal and duplicate intake never sends again", async () => {
  const store = injectedRuntimeStore();
  let sends = 0;
  const env = {
    FOUNDER_EMAIL: {
      async send() {
        assert.equal([...store.items.keys()].filter(key => key.includes("/requests/")).length, 1);
        sends += 1;
      }
    }
  };
  const first = await handleRouteIqRequestCrmRuntimeRequest(postRequest(), env, { store, now });
  const firstBody = await first.json();
  assert.equal(first.status, 201);
  assert.equal(firstBody.duplicate, false);
  assert.equal("notificationStatus" in firstBody, false);

  const duplicate = await handleRouteIqRequestCrmRuntimeRequest(postRequest(), env, { store, now });
  const duplicateBody = await duplicate.json();
  assert.equal(duplicate.status, 200);
  assert.equal(duplicateBody.duplicate, true);
  assert.equal(duplicateBody.receiptId, firstBody.receiptId);
  assert.equal(sends, 1);

  const monitoring = await handleRouteIqRequestCrmRuntimeRequest(
    new Request(`https://prometheusrouteiq.com${ROUTE_IQ_REQUEST_CRM_MONITORING_PATH}/${firstBody.receiptId}`),
    env,
    { store, authTestHooks: { enabled: true, principal: exactFounderPrincipal() }, now }
  );
  assert.equal(monitoring.status, 200);
  assert.deepEqual(await monitoring.json(), {
    ok: true,
    version: "route-iq-request-crm-v1",
    receiptId: firstBody.receiptId,
    recordCount: 1,
    recordStatus: "accepted",
    notificationCount: 1,
    notificationStatus: "sent",
    notificationFailureCode: null,
    duplicateSafe: true
  });
});

test("ambiguous notification delivery records a terminal result without a second send", async () => {
  const store = injectedRuntimeStore();
  let sends = 0;
  const env = {
    FOUNDER_EMAIL: {
      async send() {
        sends += 1;
        throw new Error("synthetic ambiguous provider result");
      }
    }
  };
  const first = await handleRouteIqRequestCrmRuntimeRequest(postRequest(), env, { store, now });
  assert.equal(first.status, 201);
  const firstBody = await first.json();
  assert.equal("notificationStatus" in firstBody, false);

  const duplicate = await handleRouteIqRequestCrmRuntimeRequest(postRequest(), env, { store, now });
  assert.equal(duplicate.status, 200);
  assert.equal(sends, 1);

  const monitoring = await handleRouteIqRequestCrmRuntimeRequest(
    new Request(`https://prometheusrouteiq.com${ROUTE_IQ_REQUEST_CRM_MONITORING_PATH}/${firstBody.receiptId}`),
    env,
    { store, authTestHooks: { enabled: true, principal: exactFounderPrincipal() }, now }
  );
  const body = await monitoring.json();
  assert.equal(body.notificationStatus, "delivery_ambiguous");
  assert.equal(body.notificationFailureCode, "founder_notification_delivery_ambiguous");
});

test("duplicate intake repairs an interrupted notification-result write without sending twice", async () => {
  const store = injectedRuntimeStore({ failNotificationResultOnce: true });
  let sends = 0;
  const env = {
    FOUNDER_EMAIL: {
      async send() {
        sends += 1;
      }
    }
  };
  const captured = [];
  const original = console.error;
  console.error = message => captured.push(message);
  let first;
  try {
    first = await handleRouteIqRequestCrmRuntimeRequest(postRequest(), env, {
      store,
      now,
      testHooks: { enabled: true, attemptId: "route_iq_attempt_notification_interruption" }
    });
  } finally {
    console.error = original;
  }
  assert.equal(first.status, 500);
  assert.equal(sends, 1);
  assert.equal([...store.items.keys()].filter(key => key.includes("/requests/")).length, 1);
  assert.equal([...store.items.keys()].filter(key => key.includes("/notifications/")).length, 0);
  assert.equal(captured.join("\n").includes("synthetic notification result persistence interruption"), false);

  const recovered = await handleRouteIqRequestCrmRuntimeRequest(postRequest(), env, { store, now });
  const recoveredBody = await recovered.json();
  assert.equal(recovered.status, 200);
  assert.equal(recoveredBody.duplicate, true);
  assert.equal(sends, 1);
  assert.equal([...store.items.keys()].filter(key => key.includes("/requests/")).length, 1);
  assert.equal([...store.items.keys()].filter(key => key.includes("/notifications/")).length, 1);

  const monitoring = await handleRouteIqRequestCrmRuntimeRequest(
    new Request(`https://prometheusrouteiq.com${ROUTE_IQ_REQUEST_CRM_MONITORING_PATH}/${recoveredBody.receiptId}`),
    env,
    { store, authTestHooks: { enabled: true, principal: exactFounderPrincipal() }, now }
  );
  assert.equal((await monitoring.json()).notificationStatus, "delivery_ambiguous");
});

test("Founder monitoring is aggregate-only, receipt-scoped, authorized, and PII-free", async () => {
  const store = injectedRuntimeStore();
  const env = { FOUNDER_EMAIL: { async send() {} } };
  const accepted = await handleRouteIqRequestCrmRuntimeRequest(postRequest(), env, { store, now });
  const receipt = await accepted.json();
  const authorized = { store, authTestHooks: { enabled: true, principal: exactFounderPrincipal() }, now };

  const aggregate = await handleRouteIqRequestCrmRuntimeRequest(
    new Request(`https://prometheusrouteiq.com${ROUTE_IQ_REQUEST_CRM_MONITORING_PATH}`),
    env,
    authorized
  );
  assert.equal(aggregate.status, 200);
  const aggregateBody = await aggregate.json();
  assert.equal(aggregateBody.recordCount, 1);
  assert.equal(aggregateBody.notificationCount, 1);
  assert.equal(aggregateBody.notificationStatusCounts.sent, 1);

  const receiptLookup = await handleRouteIqRequestCrmRuntimeRequest(
    new Request(`https://prometheusrouteiq.com${ROUTE_IQ_REQUEST_CRM_MONITORING_PATH}/${receipt.receiptId}`),
    env,
    authorized
  );
  const serialized = JSON.stringify({ aggregate: aggregateBody, receipt: await receiptLookup.json() });
  for (const prohibited of ["Jordan", "jordan@example.com", "+1 713", "Houston Field Services", "Greater Houston"]) {
    assert.equal(serialized.includes(prohibited), false);
  }
  const notificationState = JSON.stringify([...store.items.entries()].filter(([key]) => (
    key.includes("/notification-attempts/") || key.includes("/notifications/")
  )));
  for (const prohibited of ["Jordan", "jordan@example.com", "+1 713", "Houston Field Services", "Greater Houston"]) {
    assert.equal(notificationState.includes(prohibited), false);
  }

  const denied = await handleRouteIqRequestCrmRuntimeRequest(
    new Request(`https://prometheusrouteiq.com${ROUTE_IQ_REQUEST_CRM_MONITORING_PATH}`),
    env,
    { store, authTestHooks: { enabled: true, principal: exactFounderPrincipal({ authenticated: false }) }, now }
  );
  assert.equal(denied.status, 403);
  assert.equal(JSON.stringify(await denied.json()).includes("Jordan"), false);

  const malformed = await handleRouteIqRequestCrmRuntimeRequest(
    new Request(`https://prometheusrouteiq.com${ROUTE_IQ_REQUEST_CRM_MONITORING_PATH}/riq_receipt_invalid`),
    env,
    authorized
  );
  assert.equal(malformed.status, 422);
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

test("identical retries and canonical duplicate content return one receipt", async () => {
  const fixture = durableNamespace();
  const env = { [ROUTE_IQ_REQUEST_CRM_BINDING]: fixture.namespace };
  const first = await handleRouteIqRequestCrmRuntimeRequest(postRequest(), env, { now });
  const firstReceipt = await first.json();
  const retry = await handleRouteIqRequestCrmRuntimeRequest(postRequest(), env, { now });
  const retryReceipt = await retry.json();
  assert.equal(retry.status, 200);
  assert.equal(retryReceipt.duplicate, true);
  assert.equal(retryReceipt.receiptId, firstReceipt.receiptId);

  const laterDuplicate = await handleRouteIqRequestCrmRuntimeRequest(
    postRequest(publicPayload({ submittedAt: "2026-07-18T16:59:30.000Z" })),
    env,
    { now }
  );
  const laterReceipt = await laterDuplicate.json();
  assert.equal(laterDuplicate.status, 200);
  assert.equal(laterReceipt.duplicate, true);
  assert.equal(laterReceipt.receiptId, firstReceipt.receiptId);

  const store = createRouteIqRequestCrmDurableStore(env);
  const list = await store.list({ prefix: "crm-route-iq-requests-v1/workspaces/prometheus_route_iq/requests/" });
  assert.equal(list.keys.length, 1);
});

test("equal-timestamp different-content concurrency uses independent canonical request identities", async () => {
  const fixture = durableNamespace();
  const env = { [ROUTE_IQ_REQUEST_CRM_BINDING]: fixture.namespace };
  const payloads = [
    publicPayload(),
    publicPayload({
      businessName: "Houston Territory Operations",
      businessEmail: "operations@example.com",
      primaryProblem: "Coordinate a different field team without colliding with another request submitted at the same instant."
    })
  ];
  const results = await Promise.all(Array.from({ length: 20 }, (_, index) => (
    handleRouteIqRequestCrmRuntimeRequest(postRequest(payloads[index % payloads.length]), env, { now })
  )));
  const bodies = await Promise.all(results.map(result => result.json()));
  assert.equal(results.filter(result => result.status === 201).length, 2);
  assert.equal(results.filter(result => result.status === 200).length, 18);
  assert.equal(results.filter(result => result.status === 409).length, 0);
  assert.equal(new Set(bodies.map(body => body.receiptId)).size, 2);

  const normalized = await Promise.all(payloads.map(payload => normalizePublicRouteIqRequest(payload, { now })));
  assert.notEqual(normalized[0].idempotencyKey, normalized[1].idempotencyKey);
  assert.match(normalized[0].idempotencyKey, /^route_iq_request_[a-f0-9]{64}$/u);
  const stored = JSON.stringify([...fixture.storage.records.values()]);
  for (const request of normalized) assert.equal(stored.includes(request.idempotencyKey), false);

  const store = createRouteIqRequestCrmDurableStore(env);
  const list = await store.list({ prefix: "crm-route-iq-requests-v1/workspaces/prometheus_route_iq/requests/" });
  assert.equal(list.keys.length, 2);
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

test("Founder JWT accepts only the exact issuer, audience, RS256 signature, and immutable subject", async () => {
  const fixture = await founderJwtHarness();
  const token = await fixture.issue();
  const authorized = await fixture.verify(token);
  assert.equal(authorized.status, 200);

  const withinClockTolerance = await fixture.issue({ notBefore: fixture.epoch + 4 });
  assert.equal((await fixture.verify(withinClockTolerance)).status, 200);

  const unmappedEnvironment = {
    ...fixture.env,
    [ROUTE_IQ_REQUEST_CRM_ENV.founderSubjectSha256]: createHash("sha256")
      .update("unmapped-founder-subject")
      .digest("hex")
  };
  const unmapped = await fixture.verify(token, { environment: unmappedEnvironment });
  assert.equal(unmapped.status, 403);
  assert.equal((await unmapped.json()).code, "route_iq_request_founder_principal_unmapped");
});

test("Founder JWT reports fixed issuer, audience, signing-key, signature, and time classifications", async () => {
  const fixture = await founderJwtHarness();
  const cases = [
    {
      code: ROUTE_IQ_REQUEST_CRM_FOUNDER_AUTH_FAILURES.issuerMismatch,
      status: 403,
      token: await fixture.issue({ tokenIssuer: "https://different-team.cloudflareaccess.com" })
    },
    {
      code: ROUTE_IQ_REQUEST_CRM_FOUNDER_AUTH_FAILURES.audienceMismatch,
      status: 403,
      token: await fixture.issue({ tokenAudience: "different-route-iq-audience" })
    },
    {
      code: ROUTE_IQ_REQUEST_CRM_FOUNDER_AUTH_FAILURES.signingKeyUnknown,
      status: 403,
      token: await fixture.issue({ privateKey: fixture.secondary.privateKey, kid: fixture.secondaryJwk.kid })
    },
    {
      code: ROUTE_IQ_REQUEST_CRM_FOUNDER_AUTH_FAILURES.signatureInvalid,
      status: 403,
      token: await fixture.issue({ privateKey: fixture.secondary.privateKey, kid: fixture.primaryJwk.kid })
    },
    {
      code: ROUTE_IQ_REQUEST_CRM_FOUNDER_AUTH_FAILURES.tokenExpired,
      status: 403,
      token: await fixture.issue({ expiration: fixture.epoch - 6 })
    },
    {
      code: ROUTE_IQ_REQUEST_CRM_FOUNDER_AUTH_FAILURES.tokenPremature,
      status: 403,
      token: await fixture.issue({ notBefore: fixture.epoch + 6 })
    }
  ];
  for (const testCase of cases) {
    const result = await fixture.verify(testCase.token);
    assert.equal(result.status, testCase.status);
    assert.equal((await result.json()).code, testCase.code);
  }
});

test("Founder JWT fails closed for missing claims, malformed tokens, disallowed algorithms, and JWKS failure", async () => {
  const fixture = await founderJwtHarness();
  const validToken = await fixture.issue();
  const invalidConfiguration = await fixture.verify(validToken, {
    environment: {
      ...fixture.env,
      [ROUTE_IQ_REQUEST_CRM_ENV.accessTeamDomain]: "https://not-an-access-team.example"
    }
  });
  assert.equal(invalidConfiguration.status, 503);
  assert.equal((await invalidConfiguration.json()).code, "route_iq_request_founder_auth_config_invalid");

  const missingClaim = await fixture.verify(await fixture.issue({ omit: ["sub"] }));
  assert.equal(missingClaim.status, 403);
  assert.equal((await missingClaim.json()).code, ROUTE_IQ_REQUEST_CRM_FOUNDER_AUTH_FAILURES.claimMissing);

  const malformed = await fixture.verify("not-a-jwt");
  assert.equal(malformed.status, 403);
  assert.equal((await malformed.json()).code, ROUTE_IQ_REQUEST_CRM_FOUNDER_AUTH_FAILURES.tokenMalformed);

  const hmacToken = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256", kid: "disallowed-synthetic-key" })
    .setIssuer(fixture.issuer)
    .setAudience(fixture.audience)
    .setSubject(fixture.subject)
    .setIssuedAt(fixture.epoch - 10)
    .setNotBefore(fixture.epoch - 10)
    .setExpirationTime(fixture.epoch + 300)
    .sign(new TextEncoder().encode("synthetic-test-only-hmac-key-material"));
  const algorithm = await fixture.verify(hmacToken);
  assert.equal(algorithm.status, 403);
  assert.equal((await algorithm.json()).code, ROUTE_IQ_REQUEST_CRM_FOUNDER_AUTH_FAILURES.algorithmInvalid);

  const unavailable = await fixture.verify(validToken, {
    keyResolver: async () => { throw new TypeError("sensitive resolver detail"); }
  });
  assert.equal(unavailable.status, 503);
  assert.equal((await unavailable.json()).code, ROUTE_IQ_REQUEST_CRM_FOUNDER_AUTH_FAILURES.jwksUnavailable);

  const timeout = await fixture.verify(validToken, {
    keyResolver: async () => {
      throw Object.assign(new Error("sensitive timeout detail"), { code: "ERR_JWKS_TIMEOUT" });
    }
  });
  assert.equal(timeout.status, 503);
  assert.equal((await timeout.json()).code, ROUTE_IQ_REQUEST_CRM_FOUNDER_AUTH_FAILURES.jwksTimeout);
});

test("bundled public Worker fetches and selects remote JWKS without external network", { timeout: 120_000 }, async () => {
  const fixture = await founderJwtHarness();
  const bundle = bundlePublicWorkerForJwksFixture();
  const bundleEpoch = Math.floor(Date.now() / 1000);
  const bundleTimes = {
    issuedAt: bundleEpoch - 10,
    notBefore: bundleEpoch - 10,
    expiration: bundleEpoch + 300
  };
  const jwksResponse = request => {
    assert.equal(request.method, "GET");
    assert.equal(new URL(request.url).origin, fixture.issuer);
    assert.equal(new URL(request.url).pathname, "/cdn-cgi/access/certs");
    return Response.json({ keys: [fixture.primaryJwk] });
  };
  try {
    const validCalls = [];
    const valid = await dispatchBundledFounderJwt({
      fixture,
      script: bundle.script,
      token: await fixture.issue(bundleTimes),
      outboundService: request => {
        validCalls.push("JWKS_GET");
        return jwksResponse(request);
      }
    });
    assert.equal(valid.status, 200);
    assert.equal(valid.body.recordCount, 0);
    assert.deepEqual(validCalls, ["JWKS_GET"]);

    const unknown = await dispatchBundledFounderJwt({
      fixture,
      script: bundle.script,
      token: await fixture.issue({
        ...bundleTimes,
        privateKey: fixture.secondary.privateKey,
        kid: fixture.secondaryJwk.kid
      }),
      outboundService: jwksResponse
    });
    assert.equal(unknown.status, 403);
    assert.equal(unknown.body.code, ROUTE_IQ_REQUEST_CRM_FOUNDER_AUTH_FAILURES.signingKeyUnknown);

    const network = await dispatchBundledFounderJwt({
      fixture,
      script: bundle.script,
      token: await fixture.issue(bundleTimes),
      outboundService: async () => { throw new TypeError("synthetic network failure"); }
    });
    assert.equal(network.status, 503);
    assert.equal(network.body.code, ROUTE_IQ_REQUEST_CRM_FOUNDER_AUTH_FAILURES.jwksUnavailable);

    const timeout = await dispatchBundledFounderJwt({
      fixture,
      script: bundle.script,
      token: await fixture.issue(bundleTimes),
      outboundService: request => new Promise((_resolvePromise, rejectPromise) => {
        request.signal.addEventListener("abort", () => rejectPromise(request.signal.reason), { once: true });
      })
    });
    assert.equal(timeout.status, 503);
    assert.equal(timeout.body.code, ROUTE_IQ_REQUEST_CRM_FOUNDER_AUTH_FAILURES.jwksTimeout);
  } finally {
    bundle.dispose();
  }
});

test("Founder JWT diagnostics disclose no token, claim, key, resolver, or configuration values", async () => {
  const fixture = await founderJwtHarness();
  const token = await fixture.issue({ tokenAudience: "nonmatching-sensitive-audience-fixture" });
  const output = [];
  const originals = { error: console.error, log: console.log, warn: console.warn };
  console.error = value => output.push(String(value));
  console.log = value => output.push(String(value));
  console.warn = value => output.push(String(value));
  let body;
  try {
    const result = await fixture.verify(token);
    body = JSON.stringify(await result.json());
  } finally {
    Object.assign(console, originals);
  }
  const observable = `${output.join("\n")}\n${body}`;
  for (const sensitive of [
    token,
    fixture.issuer,
    fixture.audience,
    fixture.subject,
    fixture.primaryJwk.kid,
    "nonmatching-sensitive-audience-fixture",
    "sensitive resolver detail"
  ]) {
    assert.equal(observable.includes(sensitive), false);
  }
  assert.equal(output.length, 0);
  assert.match(body, /route_iq_request_founder_auth_audience_mismatch/u);
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
  const retiredWorkspaceId = "synthetic_retired_business";
  assert.equal(normalized.workspaceId, "prometheus_route_iq");
  assert.equal(normalized.operatingProfileId, "route_iq_commercial");
  assert.equal(normalized.businessType, "Commercial field services");
  assert.equal(normalized.acquisitionSource, "route_iq_website");
  assert.equal(JSON.stringify(normalized).includes("fitness_connection"), false);
  assert.equal(JSON.stringify(normalized).includes(retiredWorkspaceId), false);
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
  const publicEntry = readFileSync(resolve(root, "workers/infrastructure/prometheusrouteiq-website-entry.mjs"), "utf8");
  const publicConfig = readFileSync(resolve(root, "wrangler.prometheusrouteiq-website.jsonc"), "utf8");
  const privateConfig = readFileSync(resolve(root, "wrangler.jsonc"), "utf8");
  const contract = JSON.parse(readFileSync(resolve(root, "workers/infrastructure/route-iq-request-crm-runtime-v1.json"), "utf8"));
  const integration = readFileSync(resolve(root, "integrations/shared-workspace-lead-intake-contract.js"), "utf8");
  assert.match(worker, /isRouteIqRequestCrmPath/u);
  assert.doesNotMatch(worker, /handlePartnerIntakeRequest/u);
  assert.match(publicEntry, /prometheus-iq-worker\.js/u);
  assert.match(publicEntry, /RouteIqRequestCrmCoordinator/u);
  assert.match(publicConfig, /"name"\s*:\s*"prometheusrouteiq-website"/u);
  assert.match(publicConfig, /prometheusrouteiq-website-entry\.mjs/u);
  assert.match(publicConfig, /ROUTE_IQ_REQUEST_CRM_COORDINATOR/u);
  assert.match(publicConfig, /route-iq-request-crm-sqlite-v1/u);
  assert.doesNotMatch(privateConfig, /ROUTE_IQ_REQUEST_CRM_COORDINATOR|route-iq-request-crm-sqlite-v1/u);
  assert.equal(contract.storage.deploymentTarget, "prometheusrouteiq-website Worker only");
  assert.equal(contract.storage.privateWorkerBinding, false);
  assert.deepEqual(contract.publicIntake.publicVersions, [
    "route-iq-public-request.v1",
    "route-iq-gym-request.v1"
  ]);
  assert.equal(contract.publicIntake.versionDiscriminator, "payload.version");
  assert.equal(contract.publicIntake.gymAdapter.export, "adaptRouteIqGymRequestForCrm");
  assert.equal(contract.publicIntake.gymAdapter.persistAdapterOutputUnchanged, true);
  assert.deepEqual(contract.notification.gymRequestFields, [
    "receiptId",
    "submittedAt",
    "requestContractVersion"
  ]);
  assert.equal(contract.publicIntake.legacyFitnessRoutingActive, false);
  assert.equal(contract.publicIntake.legacySmoothieRoutingActive, false);
  assert.equal(contract.storage.kvCasClaimed, false);
  assert.equal(contract.storage.productionProvisioned, false);
  assert.equal(contract.boundaries.prospectiveRuntimeFilesChanged, false);
  assert.match(integration, /activeRouteIqRequestRuntime/u);
  assert.match(integration, /legacyWorkspaceIntakeRuntime/u);
  assert.match(integration, /productionRouteSelectedByWorker: false/u);
});
