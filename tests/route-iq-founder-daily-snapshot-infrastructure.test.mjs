import test from "node:test";
import assert from "node:assert/strict";
import { createHash, generateKeyPairSync } from "node:crypto";

import { SignJWT, createLocalJWKSet, exportJWK } from "jose";

import canonicalSnapshot from "../intelligence/artifacts/route-iq-commercial-readiness-v1/fitness_connection/founder-daily-intelligence-snapshot-v1.json" with { type: "json" };
import intelligenceContract from "../intelligence/contracts/route-iq-commercial-readiness-intelligence-v1.json" with { type: "json" };
import workspaceRegistry from "../data/route-iq-commercial-readiness-v1/route-iq-commercial-workspace-registry-v1.json" with { type: "json" };
import {
  ROUTE_IQ_FOUNDER_DAILY_SNAPSHOT_ENV,
  ROUTE_IQ_FOUNDER_DAILY_SNAPSHOT_CONTRACT_VERSION,
  ROUTE_IQ_FOUNDER_DAILY_SNAPSHOT_PATH,
  ROUTE_IQ_FOUNDER_DAILY_SNAPSHOT_PRINCIPAL_ID,
  handlePrometheusIqWorkerRequest,
  handleRouteIqFounderDailySnapshot,
  validateRouteIqFounderDailySnapshot
} from "../workers/prometheus-iq-worker.js";

const now = new Date("2026-07-18T20:00:00.000Z");
const issuer = "https://prometheus-test.cloudflareaccess.com";
const audience = "route-iq-founder-snapshot-test-audience";
const founderSubject = "immutable-cloudflare-access-subject-cruz";
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const publicJwk = await exportJWK(publicKey);
publicJwk.alg = "RS256";
publicJwk.use = "sig";
publicJwk.kid = "route-iq-founder-snapshot-test-key";
const keyResolver = createLocalJWKSet({ keys: [publicJwk] });

function subjectSha256(subject) {
  return createHash("sha256").update(subject).digest("hex");
}

function enabledEnv(overrides = {}) {
  return {
    [ROUTE_IQ_FOUNDER_DAILY_SNAPSHOT_ENV.enabled]: "ON",
    [ROUTE_IQ_FOUNDER_DAILY_SNAPSHOT_ENV.workerName]: "prometheus-iq",
    [ROUTE_IQ_FOUNDER_DAILY_SNAPSHOT_ENV.accessAudience]: audience,
    [ROUTE_IQ_FOUNDER_DAILY_SNAPSHOT_ENV.accessTeamDomain]: issuer,
    [ROUTE_IQ_FOUNDER_DAILY_SNAPSHOT_ENV.founderSubjectSha256]: subjectSha256(founderSubject),
    ...overrides
  };
}

async function token(subject = founderSubject, claims = {}) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: publicJwk.kid })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject(subject)
    .setIssuedAt(Math.floor(now.getTime() / 1000) - 10)
    .setExpirationTime(Math.floor(now.getTime() / 1000) + 300)
    .sign(privateKey);
}

function request(accessToken, { method = "GET", headers = {} } = {}) {
  return new Request(`https://prometheus-iq.example${ROUTE_IQ_FOUNDER_DAILY_SNAPSHOT_PATH}`, {
    method,
    headers: {
      ...(accessToken ? { "Cf-Access-Jwt-Assertion": accessToken } : {}),
      ...headers
    }
  });
}

function testHooks(overrides = {}) {
  return {
    enabled: true,
    currentDate: now,
    keyResolver,
    ...overrides
  };
}

test("canonical Founder snapshot principal is exactly the Data-owned Cruz mapping", () => {
  const fitness = workspaceRegistry.workspaces.find(workspace => workspace.workspaceId === "fitness_connection");
  const cruz = fitness.users.find(user => user.representativeId === "cruz");
  const anthony = fitness.users.find(user => user.representativeId === "anthony");
  assert.equal(cruz.authenticatedPrincipalId, ROUTE_IQ_FOUNDER_DAILY_SNAPSHOT_PRINCIPAL_ID);
  assert.equal(cruz.identityMappingStatus, "exact_authenticated_identity_mapped");
  assert.equal(cruz.founderIntelligenceEligibility, true);
  assert.equal(anthony.authenticatedPrincipalId, null);
  assert.equal(anthony.identityMappingStatus, "pending_exact_authenticated_identity");
  assert.equal(anthony.founderIntelligenceEligibility, true);
  assert.deepEqual(intelligenceContract.founderAccess.authorizedMappings.map(mapping => mapping.immutablePrincipalId), [
    ROUTE_IQ_FOUNDER_DAILY_SNAPSHOT_PRINCIPAL_ID
  ]);
  assert.equal(intelligenceContract.founderAccess.pendingMappings.find(mapping => mapping.person === "anthony").accessAllowed, false);
});

test("authenticated exact Founder GET returns only the validated canonical snapshot with no-store", async () => {
  const accessToken = await token();
  const response = await handlePrometheusIqWorkerRequest(
    request(accessToken),
    enabledEnv(),
    { waitUntil() {} },
    { dailySnapshotTestHooks: testHooks() }
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(response.headers.get("X-Aegis-Route-Policy"), "public_api");
  const body = await response.json();
  assert.deepEqual(body, {
    ok: true,
    authorized: true,
    contractVersion: ROUTE_IQ_FOUNDER_DAILY_SNAPSHOT_CONTRACT_VERSION,
    principal: {
      identityContextSource: "server_verified_identity_mapping",
      authenticationAuthority: "cloudflare_access",
      authenticated: true,
      callerSupplied: false,
      role: "founder",
      mappingId: "route-iq-founder-access-cruz-v1",
      immutablePrincipalId: ROUTE_IQ_FOUNDER_DAILY_SNAPSHOT_PRINCIPAL_ID,
      mappingStatus: "securely_mapped"
    },
    snapshot: canonicalSnapshot
  });
  assert.equal(/shadow|ranked.?candidate|probabilit/iu.test(JSON.stringify(body)), false);
});

test("display names, broad roles, representatives, and pending Anthony cannot authorize", async () => {
  for (const role of ["admin", "manager", "representative", "rep"]) {
    const accessToken = await token(`unmapped-${role}`, { name: "Cruz Garza", role });
    const response = await handleRouteIqFounderDailySnapshot(
      request(accessToken, { headers: { "X-User-Role": role, "X-Display-Name": "Cruz Garza" } }),
      enabledEnv(),
      { testHooks: testHooks() }
    );
    assert.equal(response.status, 403);
    assert.equal((await response.json()).code, "route_iq_founder_snapshot_principal_unmapped");
  }
  const anthonyToken = await token("pending-anthony-subject", { name: "Anthony", role: "founder_observer" });
  const anthony = await handleRouteIqFounderDailySnapshot(request(anthonyToken), enabledEnv(), {
    testHooks: testHooks()
  });
  assert.equal(anthony.status, 403);
});

test("public and missing configuration fail closed before snapshot disclosure", async () => {
  const accessToken = await token();
  for (const env of [
    {},
    enabledEnv({ [ROUTE_IQ_FOUNDER_DAILY_SNAPSHOT_ENV.enabled]: "OFF" }),
    enabledEnv({ [ROUTE_IQ_FOUNDER_DAILY_SNAPSHOT_ENV.workerName]: "prometheusrouteiq-website" })
  ]) {
    const response = await handleRouteIqFounderDailySnapshot(request(accessToken), env, { testHooks: testHooks() });
    assert.equal(response.status, 404);
    assert.equal((await response.json()).code, "route_iq_founder_snapshot_not_configured");
  }
  const malformed = enabledEnv({ [ROUTE_IQ_FOUNDER_DAILY_SNAPSHOT_ENV.accessAudience]: "" });
  const response = await handleRouteIqFounderDailySnapshot(request(accessToken), malformed, { testHooks: testHooks() });
  assert.equal(response.status, 503);
});

test("missing assertion and non-GET methods fail closed", async () => {
  const missing = await handleRouteIqFounderDailySnapshot(request(null), enabledEnv(), { testHooks: testHooks() });
  assert.equal(missing.status, 403);
  const accessToken = await token();
  for (const method of ["HEAD", "POST", "PUT", "PATCH", "DELETE"]) {
    const response = await handleRouteIqFounderDailySnapshot(request(accessToken, { method }), enabledEnv(), {
      testHooks: testHooks()
    });
    assert.equal(response.status, 405);
    assert.equal(response.headers.get("Allow"), "GET");
  }
});

test("tampered, influence-enabled, or shadow-bearing artifacts fail closed", async () => {
  const accessToken = await token();
  const fixtures = [
    { ...structuredClone(canonicalSnapshot), snapshotSha256: "0".repeat(64) },
    { ...structuredClone(canonicalSnapshot), businessConfigurationSha256: "A".repeat(64) },
    (() => {
      const value = structuredClone(canonicalSnapshot);
      value.safety.recommendationInfluence = "ON";
      return value;
    })(),
    { ...structuredClone(canonicalSnapshot), shadowDecision: { rankedCandidateIds: ["candidate_1"] } }
  ];
  for (const snapshot of fixtures) {
    const response = await handleRouteIqFounderDailySnapshot(request(accessToken), enabledEnv(), {
      testHooks: testHooks({ snapshot })
    });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { ok: false, code: "route_iq_founder_snapshot_artifact_invalid" });
  }
});

test("canonical artifact passes the independent Worker validator", async () => {
  assert.deepEqual(await validateRouteIqFounderDailySnapshot(canonicalSnapshot), canonicalSnapshot);
});
