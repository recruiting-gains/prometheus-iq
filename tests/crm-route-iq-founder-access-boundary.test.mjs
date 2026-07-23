import test from "node:test";
import assert from "node:assert/strict";
import { createHash, generateKeyPairSync } from "node:crypto";

import { SignJWT, createLocalJWKSet, exportJWK } from "jose";

import {
  routeIqRequestCrmAccessConfigurationNames,
  routeIqRequestCrmHttpBoundary
} from "../crm/route-iq-request-crm.mjs";
import {
  ROUTE_IQ_REQUEST_CRM_ENV,
  handleRouteIqRequestCrmRuntimeRequest
} from "../workers/infrastructure/route-iq-request-crm-runtime.js";

const now = new Date("2026-07-19T16:00:00.000Z");

function memoryStore() {
  const records = new Map();
  return {
    async get(key) {
      return records.get(key) ?? null;
    },
    async putIfAbsent(key, value) {
      if (records.has(key)) return false;
      records.set(key, String(value));
      return true;
    },
    async put(key, value) {
      records.set(key, String(value));
    },
    async list({ prefix }) {
      return { keys: [...records.keys()].filter(key => key.startsWith(prefix)).sort().map(name => ({ name })) };
    }
  };
}

function publicRequest() {
  return new Request("https://prometheusrouteiq.com/api/partner-intake", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      version: "route-iq-public-request.v1",
      formId: "route_iq_request",
      businessName: "Synthetic Field Services",
      contactName: "Jordan Rivera",
      businessEmail: "jordan@example.com",
      phone: "",
      industry: "Field services",
      locationCount: 2,
      estimatedUserCount: 12,
      territory: "Synthetic test territory",
      primaryProblem: "Coordinate governed field work without crossing customer boundaries.",
      desiredTimeline: "Within 90 days",
      consent: true,
      submittedAt: now.toISOString(),
      acquisitionSource: "direct",
      websiteUrl: ""
    })
  });
}

async function accessFixture() {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = await exportJWK(publicKey);
  Object.assign(jwk, { alg: "RS256", use: "sig", kid: "crm-founder-access-boundary-test" });
  const issuer = "https://prometheus-test.cloudflareaccess.com";
  const audience = "route-iq-founder-crm-test";
  const subject = "immutable-cloudflare-access-subject-cruz-test";
  const env = {
    [ROUTE_IQ_REQUEST_CRM_ENV.accessTeamDomain]: issuer,
    [ROUTE_IQ_REQUEST_CRM_ENV.accessAudience]: audience,
    [ROUTE_IQ_REQUEST_CRM_ENV.founderSubjectSha256]: createHash("sha256").update(subject).digest("hex")
  };
  const sign = claims => new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: jwk.kid })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject(claims.subject)
    .setIssuedAt(Math.floor(now.getTime() / 1000) - 10)
    .setExpirationTime(Math.floor(now.getTime() / 1000) + 300)
    .sign(privateKey);
  return {
    env,
    subject,
    sign,
    authTestHooks: {
      enabled: true,
      keyResolver: createLocalJWKSet({ keys: [jwk] }),
      currentDate: now
    }
  };
}

test("public Route IQ request POST remains public and independent of Founder Access configuration", async () => {
  const result = await handleRouteIqRequestCrmRuntimeRequest(publicRequest(), {}, { store: memoryStore(), now });
  assert.equal(result.status, 201);
  assert.equal((await result.json()).ok, true);
  assert.equal(routeIqRequestCrmHttpBoundary.publicIntake.cloudflareAccessRequired, false);
});

test("the Founder CRM data and monitoring routes are GET-only", async () => {
  const paths = [
    "/api/partner-intake/founder/requests",
    "/api/partner-intake/founder/requests/riq_receipt_000000000000000000000000",
    "/api/partner-intake/founder/monitoring",
    "/api/partner-intake/founder/monitoring/riq_receipt_000000000000000000000000",
    "/api/partner-intake/founder/export"
  ];
  for (const path of paths) {
    for (const method of ["POST", "PUT", "PATCH", "DELETE", "HEAD"]) {
      const result = await handleRouteIqRequestCrmRuntimeRequest(
        new Request(`https://prometheusrouteiq.com${path}`, { method }),
        {}
      );
      assert.equal(result.status, 405, `${method} ${path} must fail closed`);
      assert.equal(result.headers.get("Allow"), "GET");
    }
  }
  assert.deepEqual(routeIqRequestCrmHttpBoundary.founderAccess.methods, ["GET"]);
});

test("Founder GET requires a verified immutable Access sub digest", async () => {
  const fixture = await accessFixture();
  const token = await fixture.sign({ subject: fixture.subject });
  for (const path of [
    "/api/partner-intake/founder/requests",
    "/api/partner-intake/founder/monitoring"
  ]) {
    const authorized = await handleRouteIqRequestCrmRuntimeRequest(
      new Request(`https://prometheusrouteiq.com${path}`, {
        headers: { "Cf-Access-Jwt-Assertion": token }
      }),
      fixture.env,
      { store: memoryStore(), authTestHooks: fixture.authTestHooks, now }
    );
    assert.equal(authorized.status, 200);
  }

  const forged = await fixture.sign({
    subject: "different-cloudflare-access-subject",
    name: "Cruz Garza",
    email: "founder@example.com",
    accessPolicy: "Everyone",
    bypass: true
  });
  const denied = await handleRouteIqRequestCrmRuntimeRequest(
    new Request("https://prometheusrouteiq.com/api/partner-intake/founder/monitoring", {
      headers: { "Cf-Access-Jwt-Assertion": forged }
    }),
    fixture.env,
    { store: memoryStore(), authTestHooks: fixture.authTestHooks, now }
  );
  assert.equal(denied.status, 403);
  assert.equal((await denied.json()).code, "route_iq_request_founder_principal_unmapped");
});

test("display-name, Everyone, and Bypass headers cannot replace the Access assertion", async () => {
  const fixture = await accessFixture();
  const denied = await handleRouteIqRequestCrmRuntimeRequest(
    new Request("https://prometheusrouteiq.com/api/partner-intake/founder/export", {
      headers: {
        "Cf-Access-Authenticated-User-Email": "founder@example.com",
        "X-Founder-Display-Name": "Cruz Garza",
        "X-Access-Policy": "Everyone",
        "X-Access-Bypass": "true"
      }
    }),
    fixture.env,
    { store: memoryStore(), authTestHooks: fixture.authTestHooks, now }
  );
  assert.equal(denied.status, 403);
  assert.equal((await denied.json()).code, "route_iq_request_founder_auth_required");
  assert.deepEqual(
    [...Object.values(ROUTE_IQ_REQUEST_CRM_ENV)].sort(),
    [...routeIqRequestCrmAccessConfigurationNames].sort()
  );
});
