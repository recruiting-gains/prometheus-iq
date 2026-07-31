import assert from "node:assert/strict";
import { createHash, generateKeyPairSync } from "node:crypto";
import test from "node:test";
import { SignJWT, createLocalJWKSet, exportJWK } from "jose";

import {
  ROUTE_IQ_PAID_CUSTOMER_REVENUE_READINESS_PATH,
  executePaidCustomerRevenueReadinessRehearsal,
  handlePaidCustomerRevenueReadinessRequest,
  isPaidCustomerRevenueReadinessPath
} from "../workers/infrastructure/route-iq-paid-customer-revenue-readiness-runtime.js";
import {
  ROUTE_IQ_FOUNDER_DAILY_SNAPSHOT_ENV,
  handlePrometheusIqWorkerRequest
} from "../workers/prometheus-iq-worker.js";

const NOW = new Date("2026-07-31T18:00:00.000Z");
const issuer = "https://revenue-readiness-test.cloudflareaccess.com";
const audience = "revenue-readiness-test-audience";
const subject = "fictional-founder-access-subject";
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const publicJwk = await exportJWK(publicKey);
publicJwk.alg = "RS256";
publicJwk.use = "sig";
publicJwk.kid = "revenue-readiness-test-key";
const keyResolver = createLocalJWKSet({ keys: [publicJwk] });
const founder = Object.freeze({
  authenticated: true,
  callerSupplied: false,
  role: "founder",
  immutablePrincipalId: "riq_principal_fictional_founder"
});

function request(path = ROUTE_IQ_PAID_CUSTOMER_REVENUE_READINESS_PATH, init = {}) {
  return new Request(`https://private.example.test${path}`, {
    method: "GET",
    ...init
  });
}

async function accessToken(tokenSubject = subject) {
  return new SignJWT({})
    .setProtectedHeader({ alg: "RS256", kid: publicJwk.kid })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject(tokenSubject)
    .setIssuedAt(Math.floor(NOW.getTime() / 1000) - 10)
    .setExpirationTime(Math.floor(NOW.getTime() / 1000) + 300)
    .sign(privateKey);
}

function founderEnvironment() {
  return {
    [ROUTE_IQ_FOUNDER_DAILY_SNAPSHOT_ENV.enabled]: "ON",
    [ROUTE_IQ_FOUNDER_DAILY_SNAPSHOT_ENV.workerName]: "prometheus-iq",
    [ROUTE_IQ_FOUNDER_DAILY_SNAPSHOT_ENV.accessAudience]: audience,
    [ROUTE_IQ_FOUNDER_DAILY_SNAPSHOT_ENV.accessTeamDomain]: issuer,
    [ROUTE_IQ_FOUNDER_DAILY_SNAPSHOT_ENV.founderSubjectSha256]:
      createHash("sha256").update(subject).digest("hex")
  };
}

test("fictional revenue journey exercises success, failure, replay, and cleanup", async () => {
  const result = await executePaidCustomerRevenueReadinessRehearsal({ now: NOW });
  assert.deepEqual(
    result.scenarioClassifications.map(item => item.scenario),
    ["success", "failure", "replay"]
  );
  assert.equal(result.scenarioClassifications[2].replay, "duplicate_ignored");
  assert.equal(result.snapshot.companyDisplayName, "Orion Facility Safety Rehearsal");
  assert.equal(result.snapshot.onboardingState, "VALIDATED");
  assert.deepEqual(result.snapshot.counts, {
    users: 3,
    managers: 1,
    representatives: 2,
    locations: 2
  });
  assert.deepEqual(result.cleanup, {
    isolatedMemoryCleared: true,
    productionWrites: 0,
    crmWrites: 0,
    receiptWrites: 0,
    providerCalls: 0,
    invitationWrites: 0,
    liveBillingCalls: 0
  });
});

test("exact Founder-only GET returns the Dashboard session and snapshot contract", async () => {
  const response = await handlePaidCustomerRevenueReadinessRequest(
    request(),
    founder,
    { now: NOW }
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  const body = await response.json();
  assert.deepEqual(Object.keys(body).sort(), ["session", "snapshot"]);
  assert.equal(body.session.role, "FOUNDER");
  assert.equal(body.session.callerSupplied, false);
  assert.equal(body.session.safety.billingActivation, "OFF");
  assert.equal(body.snapshot.billing.mode, "TEST");
  assert.equal(body.snapshot.billing.state, "TEST_VERIFIED");
  assert.equal(body.snapshot.activation.state, "BLOCKED");
  assert.equal(JSON.stringify(body).includes("billing_orion"), false);
  assert.equal(JSON.stringify(body).includes("principal_"), false);
});

test("anonymous, representative, caller-supplied, and malformed requests fail closed", async () => {
  const cases = [
    [request(), null],
    [request(), { ...founder, role: "representative" }],
    [request(), { ...founder, callerSupplied: true }],
    [request(`${ROUTE_IQ_PAID_CUSTOMER_REVENUE_READINESS_PATH}?tenant=other`), founder],
    [request(ROUTE_IQ_PAID_CUSTOMER_REVENUE_READINESS_PATH, { method: "POST" }), founder],
    [request("/api/dashboard/route-iq/internal/paid-customer-revenue-readiness/other"), founder]
  ];
  for (const [candidate, principal] of cases) {
    const response = await handlePaidCustomerRevenueReadinessRequest(
      candidate,
      principal,
      { now: NOW }
    );
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), {
      ok: false,
      code: "route_iq_resource_unavailable"
    });
  }
});

test("route matching is exact and non-enumerating", () => {
  assert.equal(isPaidCustomerRevenueReadinessPath(
    ROUTE_IQ_PAID_CUSTOMER_REVENUE_READINESS_PATH
  ), true);
  assert.equal(isPaidCustomerRevenueReadinessPath(
    `${ROUTE_IQ_PAID_CUSTOMER_REVENUE_READINESS_PATH}/`
  ), false);
  assert.equal(isPaidCustomerRevenueReadinessPath(
    `${ROUTE_IQ_PAID_CUSTOMER_REVENUE_READINESS_PATH}-other`
  ), false);
});

test("private Worker accepts only the exact mapped Founder JWT", async () => {
  const invoke = async tokenSubject => handlePrometheusIqWorkerRequest(
    request(ROUTE_IQ_PAID_CUSTOMER_REVENUE_READINESS_PATH, {
      headers: {
        "Cf-Access-Jwt-Assertion": await accessToken(tokenSubject)
      }
    }),
    founderEnvironment(),
    { waitUntil() {} },
    {
      paidCustomerRevenueReadinessTestHooks: {
        now: NOW,
        founderAuthentication: {
          enabled: true,
          currentDate: NOW,
          keyResolver
        }
      }
    }
  );
  const accepted = await invoke(subject);
  assert.equal(accepted.status, 200);
  assert.deepEqual(Object.keys(await accepted.json()).sort(), ["session", "snapshot"]);
  const denied = await invoke("fictional-unmapped-subject");
  assert.equal(denied.status, 404);
  assert.deepEqual(await denied.json(), {
    ok: false,
    code: "route_iq_resource_unavailable"
  });
});

test("runtime source has no Stripe, storage, invitation, or mutation transport", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(new URL(
      "../workers/infrastructure/route-iq-paid-customer-revenue-readiness-runtime.js",
      import.meta.url
    ), "utf8");
  assert.doesNotMatch(source, /fetch\s*\(|WebSocket|localStorage|sessionStorage|indexedDB/u);
  assert.doesNotMatch(source, /STRIPE_(?:SECRET|API)|Authorization\s*:/u);
  assert.doesNotMatch(source, /method:\s*["'](?:POST|PUT|PATCH|DELETE)["']/u);
  assert.match(source, /finally\s*\{\s*scenarios\.length = 0;/u);
});

test("private generated Dashboard assets exactly match the owner source", async () => {
  const { readFileSync } = await import("node:fs");
  assert.deepEqual(
    readFileSync(new URL(
      "../deploy/cloudflare-pages/dashboard/route-iq-paid-customer-revenue-readiness.mjs",
      import.meta.url
    )),
    readFileSync(new URL(
      "../dashboard/route-iq-paid-customer-revenue-readiness.mjs",
      import.meta.url
    ))
  );
  assert.deepEqual(
    readFileSync(new URL("../deploy/cloudflare-pages/index.html", import.meta.url)),
    readFileSync(new URL("../index.html", import.meta.url))
  );
});
