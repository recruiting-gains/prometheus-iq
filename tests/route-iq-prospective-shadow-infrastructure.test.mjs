import test from "node:test";
import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, randomBytes, randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { Miniflare } from "miniflare";
import { SignJWT, createLocalJWKSet, exportJWK } from "jose";

import worker, {
  ROUTE_IQ_PROSPECTIVE_SHADOW_PATH,
  RouteIqProspectiveShadowCoordinator
} from "../workers/prometheus-iq-worker.js";
import {
  routeIqProspectiveCohortConfigVersion,
  routeIqProspectivePrincipalMapVersion
} from "../workers/infrastructure/route-iq-prospective-shadow-access.js";
import {
  createRouteIqProspectiveAuthorityEnvelope,
  createRouteIqProspectiveAuthorityVerifier
} from "../workers/infrastructure/route-iq-prospective-shadow-authority.js";
import {
  ROUTE_IQ_PROSPECTIVE_DATA_ALLOCATOR_BLOCKER,
  ROUTE_IQ_PROSPECTIVE_SHADOW_BINDING,
  ROUTE_IQ_PROSPECTIVE_SHADOW_CLASS,
  ROUTE_IQ_PROSPECTIVE_SHADOW_ENV,
  sha256Hex
} from "../workers/infrastructure/route-iq-prospective-shadow-contract.js";
import {
  handleRouteIqProspectiveShadowRequest
} from "../workers/infrastructure/route-iq-prospective-shadow-runtime.js";

const root = resolve(import.meta.dirname, "..");
const testNow = new Date("2026-07-13T20:00:00.000Z");
const testIssuer = new URL(`https://${["noncanonical-test", "cloudflareaccess", "com"].join(".")}`).origin;
const accessKeys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const accessAudience = randomBytes(24).toString("hex");

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

function authorityEnv() {
  return {
    [ROUTE_IQ_PROSPECTIVE_SHADOW_ENV.authorityKey]: randomBytes(48).toString("base64url"),
    [ROUTE_IQ_PROSPECTIVE_SHADOW_ENV.authorityKeyVersion]: `noncanonical-test-${randomUUID()}`
  };
}

function scope(representativeId = "cruz") {
  return {
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    representativeId
  };
}

function cohortConfig(representativeId = "cruz") {
  return JSON.stringify({
    version: routeIqProspectiveCohortConfigVersion,
    scopes: [scope(representativeId)]
  });
}

async function principalMap(subject, representativeId = "cruz") {
  return JSON.stringify({
    version: routeIqProspectivePrincipalMapVersion,
    principals: [{
      accessSubjectSha256: await sha256Hex(subject),
      ...scope(representativeId),
      registryVersion: "noncanonical-test-registry-v1"
    }]
  });
}

async function accessFixture({
  mappedRepresentativeId = "cruz",
  cohortRepresentativeId = "cruz",
  expired = false,
  tokenAudience = accessAudience
} = {}) {
  const subject = randomUUID();
  const publicJwk = await exportJWK(accessKeys.publicKey);
  publicJwk.alg = "RS256";
  publicJwk.kid = randomUUID();
  const keyResolver = createLocalJWKSet({ keys: [publicJwk] });
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "RS256", kid: publicJwk.kid })
    .setIssuer(testIssuer)
    .setAudience(tokenAudience)
    .setSubject(subject)
    .setIssuedAt(Math.floor(testNow.getTime() / 1000) - 60)
    .setExpirationTime(Math.floor(testNow.getTime() / 1000) + (expired ? -1 : 3600))
    .sign(accessKeys.privateKey);
  const names = [];
  const calls = [];
  const env = {
    ...authorityEnv(),
    [ROUTE_IQ_PROSPECTIVE_SHADOW_ENV.collection]: "ON",
    [ROUTE_IQ_PROSPECTIVE_SHADOW_ENV.cohortConfig]: cohortConfig(cohortRepresentativeId),
    [ROUTE_IQ_PROSPECTIVE_SHADOW_ENV.accessTeamDomain]: testIssuer,
    [ROUTE_IQ_PROSPECTIVE_SHADOW_ENV.accessAudience]: accessAudience,
    [ROUTE_IQ_PROSPECTIVE_SHADOW_ENV.principalMap]: await principalMap(subject, mappedRepresentativeId),
    [ROUTE_IQ_PROSPECTIVE_SHADOW_BINDING]: {
      getByName(name) {
        calls.push("do_lookup");
        names.push(name);
        return {
          async noteBrowserSignalBlocked(command) {
            calls.push("do_rpc");
            assert.deepEqual(command.event.eventKind.length > 0, true);
            return { ...ROUTE_IQ_PROSPECTIVE_DATA_ALLOCATOR_BLOCKER };
          }
        };
      }
    }
  };
  const noncanonicalTestHooks = {
    enabled: true,
    currentDate: testNow,
    async keyResolver(...args) {
      calls.push("access_signature");
      return keyResolver(...args);
    }
  };
  return { env, token, names, calls, noncanonicalTestHooks };
}

function eventRequest(body, token = null, headers = {}) {
  return new Request(`https://private.invalid${ROUTE_IQ_PROSPECTIVE_SHADOW_PATH}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "Cf-Access-Jwt-Assertion": token } : {}),
      ...headers
    },
    body: JSON.stringify(body)
  });
}

test("private config owns one SQLite class migration and public config remains unbound", () => {
  const privateConfig = readFileSync(join(root, "wrangler.jsonc"), "utf8");
  const publicConfig = readFileSync(join(root, "wrangler.prometheusrouteiq-website.jsonc"), "utf8");
  assert.match(privateConfig, new RegExp(`"name": "${ROUTE_IQ_PROSPECTIVE_SHADOW_BINDING}"`));
  assert.match(privateConfig, new RegExp(`"class_name": "${ROUTE_IQ_PROSPECTIVE_SHADOW_CLASS}"`));
  assert.match(privateConfig, /"new_sqlite_classes"/u);
  assert.equal((privateConfig.match(/"new_sqlite_classes"/gu) || []).length, 1);
  assert.equal(publicConfig.includes(ROUTE_IQ_PROSPECTIVE_SHADOW_BINDING), false);
  assert.equal(publicConfig.includes(ROUTE_IQ_PROSPECTIVE_SHADOW_CLASS), false);
  assert.equal(typeof RouteIqProspectiveShadowCoordinator, "function");

  const rpcNames = Object.getOwnPropertyNames(RouteIqProspectiveShadowCoordinator.prototype);
  for (const prohibited of ["fetch", "execute", "executeSchema", "get", "put", "list", "sql"]) {
    assert.equal(rpcNames.includes(prohibited), false, `DO must not expose generic ${prohibited} RPC`);
  }
  assert.ok(rpcNames.includes("applyTrustedTrigger"));
  assert.ok(rpcNames.includes("readCommittedProjectionAsOf"));
});

test("OFF and invalid activation acknowledge without Access, Aegis, JWKS, DO, or storage", async () => {
  let storageCalls = 0;
  const inactiveEnv = {
    AEGIS_RATE_LIMITS: {
      async get() {
        storageCalls += 1;
        throw new Error("OFF path reached storage");
      },
      async put() {
        storageCalls += 1;
        throw new Error("OFF path reached storage");
      }
    },
    get [ROUTE_IQ_PROSPECTIVE_SHADOW_BINDING]() {
      throw new Error("OFF path reached the Durable Object binding");
    }
  };
  const response = await worker.fetch(eventRequest({ eventKind: "next_stop_requested" }), inactiveEnv);
  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), {
    ok: true,
    acknowledged: true,
    status: "disabled",
    collection: "OFF",
    recommendationInfluence: "OFF"
  });
  assert.equal(storageCalls, 0);

  const invalidActivation = await handleRouteIqProspectiveShadowRequest(
    eventRequest({ eventKind: "next_stop_requested" }),
    { [ROUTE_IQ_PROSPECTIVE_SHADOW_ENV.collection]: "on" }
  );
  assert.equal(invalidActivation.status, 202);

  const missingCohort = await handleRouteIqProspectiveShadowRequest(
    eventRequest({ eventKind: "next_stop_requested" }),
    { [ROUTE_IQ_PROSPECTIVE_SHADOW_ENV.collection]: "ON" }
  );
  assert.equal(missingCohort.status, 202);
});

test("valid Access precedes scope-only DO lookup and exposes only the Data-owner blocker", async () => {
  const fixture = await accessFixture();
  const first = await handleRouteIqProspectiveShadowRequest(
    eventRequest({ eventKind: "next_stop_requested", informationalSequence: 9 }, fixture.token),
    fixture.env,
    { noncanonicalTestHooks: fixture.noncanonicalTestHooks }
  );
  const firstBody = await first.json();
  assert.equal(first.status, 503);
  assert.deepEqual(firstBody, ROUTE_IQ_PROSPECTIVE_DATA_ALLOCATOR_BLOCKER);
  assert.ok(fixture.calls.indexOf("access_signature") < fixture.calls.indexOf("do_lookup"));

  const second = await handleRouteIqProspectiveShadowRequest(
    eventRequest({
      eventKind: "representative_action_observed",
      informationalObservedAt: "2026-07-13T19:59:59.000Z"
    }, fixture.token),
    fixture.env,
    { noncanonicalTestHooks: fixture.noncanonicalTestHooks }
  );
  assert.equal(second.status, 503);
  assert.equal(fixture.names.length, 2);
  assert.equal(fixture.names[0], fixture.names[1]);

  const representativeResponse = JSON.stringify(firstBody);
  for (const prohibited of [
    "coordinatorId",
    "sessionId",
    "opportunityId",
    "candidateId",
    "ranking",
    "probability",
    "confidence",
    "eligibility",
    "readiness",
    "engine"
  ]) {
    assert.equal(representativeResponse.includes(prohibited), false);
  }
});

test("invalid Access, unmapped scope, missing key, and caller routing all fail before DO lookup", async () => {
  const invalidTokenFixture = await accessFixture();
  const tokenParts = invalidTokenFixture.token.split(".");
  tokenParts[2] = `${tokenParts[2][0] === "a" ? "b" : "a"}${tokenParts[2].slice(1)}`;
  const invalidToken = tokenParts.join(".");
  const invalidAccess = await handleRouteIqProspectiveShadowRequest(
    eventRequest({ eventKind: "next_stop_requested" }, invalidToken),
    invalidTokenFixture.env,
    { noncanonicalTestHooks: invalidTokenFixture.noncanonicalTestHooks }
  );
  assert.equal(invalidAccess.status, 403);
  assert.equal(invalidTokenFixture.calls.includes("do_lookup"), false);

  const missingTokenFixture = await accessFixture();
  const missingToken = await handleRouteIqProspectiveShadowRequest(
    eventRequest({ eventKind: "next_stop_requested" }),
    missingTokenFixture.env,
    { noncanonicalTestHooks: missingTokenFixture.noncanonicalTestHooks }
  );
  assert.equal(missingToken.status, 403);
  assert.equal(missingTokenFixture.calls.includes("do_lookup"), false);

  const expiredFixture = await accessFixture({ expired: true });
  const expired = await handleRouteIqProspectiveShadowRequest(
    eventRequest({ eventKind: "next_stop_requested" }, expiredFixture.token),
    expiredFixture.env,
    { noncanonicalTestHooks: expiredFixture.noncanonicalTestHooks }
  );
  assert.equal(expired.status, 403);
  assert.equal(expiredFixture.calls.includes("do_lookup"), false);

  const wrongAudienceFixture = await accessFixture({ tokenAudience: randomBytes(24).toString("hex") });
  const wrongAudience = await handleRouteIqProspectiveShadowRequest(
    eventRequest({ eventKind: "next_stop_requested" }, wrongAudienceFixture.token),
    wrongAudienceFixture.env,
    { noncanonicalTestHooks: wrongAudienceFixture.noncanonicalTestHooks }
  );
  assert.equal(wrongAudience.status, 403);
  assert.equal(wrongAudienceFixture.calls.includes("do_lookup"), false);

  const missingConfigFixture = await accessFixture();
  delete missingConfigFixture.env[ROUTE_IQ_PROSPECTIVE_SHADOW_ENV.accessAudience];
  const missingConfig = await handleRouteIqProspectiveShadowRequest(
    eventRequest({ eventKind: "next_stop_requested" }, missingConfigFixture.token),
    missingConfigFixture.env,
    { noncanonicalTestHooks: missingConfigFixture.noncanonicalTestHooks }
  );
  assert.equal(missingConfig.status, 403);
  assert.equal(missingConfigFixture.calls.includes("do_lookup"), false);

  const missingMapFixture = await accessFixture();
  delete missingMapFixture.env[ROUTE_IQ_PROSPECTIVE_SHADOW_ENV.principalMap];
  const missingMap = await handleRouteIqProspectiveShadowRequest(
    eventRequest({ eventKind: "next_stop_requested" }, missingMapFixture.token),
    missingMapFixture.env,
    { noncanonicalTestHooks: missingMapFixture.noncanonicalTestHooks }
  );
  assert.equal(missingMap.status, 403);
  assert.equal(missingMapFixture.calls.includes("do_lookup"), false);

  const crossScopeFixture = await accessFixture({ cohortRepresentativeId: "anthony" });
  const crossScope = await handleRouteIqProspectiveShadowRequest(
    eventRequest({ eventKind: "next_stop_requested" }, crossScopeFixture.token),
    crossScopeFixture.env,
    { noncanonicalTestHooks: crossScopeFixture.noncanonicalTestHooks }
  );
  assert.equal(crossScope.status, 403);
  assert.equal(crossScopeFixture.calls.includes("do_lookup"), false);

  const missingKeyFixture = await accessFixture();
  delete missingKeyFixture.env[ROUTE_IQ_PROSPECTIVE_SHADOW_ENV.authorityKey];
  const missingKey = await handleRouteIqProspectiveShadowRequest(
    eventRequest({ eventKind: "next_stop_requested" }, missingKeyFixture.token),
    missingKeyFixture.env,
    { noncanonicalTestHooks: missingKeyFixture.noncanonicalTestHooks }
  );
  assert.equal(missingKey.status, 503);
  assert.equal(missingKeyFixture.calls.includes("do_lookup"), false);

  const callerRoutingFixture = await accessFixture();
  const callerRouting = await handleRouteIqProspectiveShadowRequest(
    eventRequest({
      eventKind: "next_stop_requested",
      workspaceId: "fitness_connection",
      sessionId: "caller-session",
      opportunityId: "caller-opportunity"
    }, callerRoutingFixture.token),
    callerRoutingFixture.env,
    { noncanonicalTestHooks: callerRoutingFixture.noncanonicalTestHooks }
  );
  const callerRoutingBody = await callerRouting.json();
  assert.equal(callerRouting.status, 400);
  assert.equal(callerRoutingBody.code, "route_iq_prospective_caller_authority_prohibited");
  assert.equal(callerRoutingFixture.calls.includes("do_lookup"), false);
});

test("browser body allowlist rejects authority, candidate, source, seal, and readiness fields", async () => {
  const fixture = await accessFixture();
  const prohibitedFields = [
    "workspaceId",
    "operatingProfileId",
    "representativeId",
    "sessionId",
    "opportunityId",
    "authoritativeTimestamp",
    "recordSha256",
    "eligibility",
    "provenance",
    "seal",
    "engineVersion",
    "readiness",
    "candidates",
    "sourceManifest"
  ];
  for (const field of prohibitedFields) {
    const response = await handleRouteIqProspectiveShadowRequest(
      eventRequest({ eventKind: "next_stop_requested", [field]: "caller-value" }, fixture.token),
      fixture.env,
      { noncanonicalTestHooks: fixture.noncanonicalTestHooks }
    );
    assert.equal(response.status, 400, field);
    assert.equal((await response.json()).code, "route_iq_prospective_caller_authority_prohibited", field);
  }
  assert.equal(fixture.calls.includes("do_lookup"), false);

  const oversized = await handleRouteIqProspectiveShadowRequest(
    eventRequest({ eventKind: "next_stop_requested" }, fixture.token, { "Content-Length": "2049" }),
    fixture.env,
    { noncanonicalTestHooks: fixture.noncanonicalTestHooks }
  );
  assert.equal(oversized.status, 413);
  assert.equal(fixture.calls.includes("do_lookup"), false);
});

test("HMAC authority envelopes require the protected key and reject tampering", async () => {
  const env = authorityEnv();
  const claims = {
    purpose: "coordinator_scope",
    ...scope(),
    registryVersion: "noncanonical-test-registry-v1",
    issuedAt: testNow.toISOString()
  };
  const envelope = await createRouteIqProspectiveAuthorityEnvelope(claims, env);
  const verified = await createRouteIqProspectiveAuthorityVerifier(env).verify(envelope, {
    purpose: "coordinator_scope"
  });
  assert.equal(verified.authenticated, true);
  assert.equal(verified.algorithm, "HMAC-SHA-256");
  assert.deepEqual(verified.claims, claims);

  const tampered = structuredClone(envelope);
  tampered.claims.representativeId = "anthony";
  await assert.rejects(
    createRouteIqProspectiveAuthorityVerifier(env).verify(tampered, { purpose: "coordinator_scope" }),
    error => error.code === "route_iq_prospective_authority_invalid"
  );
  await assert.rejects(
    createRouteIqProspectiveAuthorityEnvelope(claims, {}),
    error => error.code === "route_iq_prospective_authority_key_missing"
  );
});

const miniflareHarnessScript = `
export { RouteIqProspectiveShadowCoordinator } from "./workers/infrastructure/route-iq-prospective-shadow-durable-object.js";

const methods = new Set([
  "noteBrowserSignalBlocked",
  "applyTrustedTrigger",
  "applyTrustedCandidateManifest",
  "recoverNextProjection",
  "readCommittedProjectionAsOf"
]);

export default {
  async fetch(request, env) {
    const body = await request.json();
    if (!methods.has(body.method)) return Response.json({ ok: false, message: "test method blocked" }, { status: 400 });
    const stub = env.ROUTE_IQ_PROSPECTIVE_SHADOW_COORDINATOR.getByName(body.instanceName);
    try {
      return Response.json({ ok: true, result: await stub[body.method](body.command) });
    } catch (error) {
      return Response.json({
        ok: false,
        name: error.name,
        message: error.message,
        code: error.code || null,
        status: error.status || null
      }, { status: 599 });
    }
  }
};
`;

function createMiniflare(bindings, persistencePath) {
  return new Miniflare({
    modules: true,
    modulesRules: [{ type: "ESModule", include: ["**/*.js", "**/*.mjs"] }],
    modulesRoot: root,
    script: miniflareHarnessScript,
    scriptPath: join(root, "route-iq-prospective-shadow-noncanonical-test-harness.mjs"),
    compatibilityDate: "2026-07-13",
    compatibilityFlags: ["nodejs_compat"],
    durableObjects: {
      [ROUTE_IQ_PROSPECTIVE_SHADOW_BINDING]: {
        className: ROUTE_IQ_PROSPECTIVE_SHADOW_CLASS,
        useSQLite: true
      }
    },
    durableObjectsPersist: persistencePath,
    bindings
  });
}

async function doRpc(miniflare, instanceName, method, command) {
  const response = await miniflare.dispatchFetch("https://noncanonical.invalid/rpc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ instanceName, method, command })
  });
  return { status: response.status, body: await response.json() };
}

async function scopeEnvelopeFor(env, representativeId = "cruz") {
  return createRouteIqProspectiveAuthorityEnvelope({
    purpose: "coordinator_scope",
    ...scope(representativeId),
    registryVersion: "noncanonical-test-registry-v1",
    issuedAt: testNow.toISOString()
  }, env);
}

function triggerClaims(overrides = {}) {
  return {
    purpose: "trigger",
    ...scope(),
    territoryId: `riq_territory_${digest("noncanonical-territory")}`,
    canonicalSessionRecordSha256: digest("noncanonical-session"),
    sessionEventSequence: 4,
    opportunityEventSequence: 7,
    triggerRecordSha256: digest("noncanonical-trigger"),
    canonicalEventBoundarySha256: digest("noncanonical-boundary"),
    clientEventSequence: 11,
    clientContentSha256: digest("noncanonical-client-content"),
    authoritativeRecordTime: "2026-07-13T20:00:01.000Z",
    recordOrigin: "prospective",
    uncertainChronology: false,
    ...overrides
  };
}

test("real Miniflare SQLite DO converges concurrently, preserves conflict, scope, and restart state", async () => {
  const persistencePath = mkdtempSync(join(tmpdir(), "prometheus-route-iq-do-"));
  const env = authorityEnv();
  const instanceName = `noncanonical-scope-${randomUUID()}`;
  const originalScopeEnvelope = await scopeEnvelopeFor(env);
  const originalAuthorityEnvelope = await createRouteIqProspectiveAuthorityEnvelope(triggerClaims(), env);
  const originalCommand = {
    scopeEnvelope: originalScopeEnvelope,
    input: { authorityEnvelope: originalAuthorityEnvelope }
  };
  let miniflare = createMiniflare(env, persistencePath);
  let originalReceipt;
  try {
    const [left, right] = await Promise.all([
      doRpc(miniflare, instanceName, "applyTrustedTrigger", originalCommand),
      doRpc(miniflare, instanceName, "applyTrustedTrigger", originalCommand)
    ]);
    assert.equal(left.status, 200);
    assert.equal(right.status, 200);
    assert.deepEqual(left.body.result, right.body.result);
    assert.equal(left.body.result.status, "recorded");
    assert.equal(left.body.result.recoveryOutboxPersisted, true);
    originalReceipt = left.body.result;

    const competingClaims = triggerClaims({
      canonicalSessionRecordSha256: digest("changed-canonical-session"),
      clientContentSha256: digest("changed-client-content")
    });
    const competingCommand = {
      scopeEnvelope: originalScopeEnvelope,
      input: {
        authorityEnvelope: await createRouteIqProspectiveAuthorityEnvelope(competingClaims, env)
      }
    };
    const conflict = await doRpc(miniflare, instanceName, "applyTrustedTrigger", competingCommand);
    assert.equal(conflict.status, 599);
    assert.match(conflict.body.message, /durably preserved as a conflict/u);

    const crossScope = await doRpc(miniflare, instanceName, "noteBrowserSignalBlocked", {
      scopeEnvelope: await scopeEnvelopeFor(env, "anthony"),
      event: { eventKind: "next_stop_requested", informationalSequence: 1 }
    });
    assert.equal(crossScope.status, 599);
    assert.match(crossScope.body.message, /scope does not own|scope/u);

    const candidateBudgetClaims = {
      ...triggerClaims({ purpose: "candidate_manifest", authoritativeRecordTime: "2026-07-13T20:00:02.000Z" }),
      expectedCandidateCount: 65,
      expectedSourceCount: 1,
      expectedCompleteManifestSha256: digest("oversized-manifest")
    };
    const budgetBlocked = await doRpc(miniflare, instanceName, "applyTrustedCandidateManifest", {
      scopeEnvelope: originalScopeEnvelope,
      input: {
        authorityEnvelope: await createRouteIqProspectiveAuthorityEnvelope(candidateBudgetClaims, env),
        producerEnvelope: null
      }
    });
    assert.equal(budgetBlocked.status, 599);
    assert.match(budgetBlocked.body.message, /Candidate budget exceeded/u);
  } finally {
    await miniflare.dispose();
  }

  miniflare = createMiniflare(env, persistencePath);
  try {
    const afterRestart = await doRpc(miniflare, instanceName, "applyTrustedTrigger", originalCommand);
    assert.equal(afterRestart.status, 200);
    assert.deepEqual(afterRestart.body.result, originalReceipt);
  } finally {
    await miniflare.dispose();
    rmSync(persistencePath, { recursive: true, force: true });
  }
});
