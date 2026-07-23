import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import { SignJWT, createLocalJWKSet, exportJWK } from "jose";

import {
  createCommercialIsolationFixtureRegistry,
  validateCommercialWorkspaceRegistry
} from "../data/route-iq-commercial-readiness-v1/route-iq-commercial-workspace-registry.mjs";
import {
  routeIqAugust1LaunchEnvelopeVersion
} from "../data/route-iq-commercial-readiness-v1/route-iq-august-1-launch-envelope.mjs";
import { routeIqFieldSessionStoreBinding } from "../data/route-iq-field-sessions-v1/route-iq-field-session-archive.mjs";
import {
  ROUTE_IQ_CUSTOMER_PWA_ENV,
  ROUTE_IQ_CUSTOMER_PWA_ERROR_RESPONSE_KEYS,
  ROUTE_IQ_CUSTOMER_PWA_FAILURES,
  ROUTE_IQ_CUSTOMER_PWA_PATH,
  ROUTE_IQ_CUSTOMER_PWA_SESSION_CAPABILITY_KEYS,
  ROUTE_IQ_CUSTOMER_PWA_SESSION_KEYS,
  ROUTE_IQ_CUSTOMER_PWA_SESSION_MARKER,
  ROUTE_IQ_CUSTOMER_PWA_SESSION_PATH,
  ROUTE_IQ_CUSTOMER_PWA_SESSION_RESPONSE_KEYS,
  ROUTE_IQ_CUSTOMER_PWA_SESSION_RUNTIME_ASSET_KEYS,
  ROUTE_IQ_CUSTOMER_PWA_SESSION_SAFETY_KEYS,
  ROUTE_IQ_CUSTOMER_PWA_SESSION_TEMPLATE_ID,
  createRouteIqCustomerPwaSession,
  handleRouteIqCustomerPwaRequest,
  injectRouteIqCustomerPwaSession,
  serializeRouteIqCustomerPwaSession
} from "../workers/infrastructure/route-iq-august-1-customer-pwa-runtime.js";
import {
  ROUTE_IQ_FIELD_SESSION_HANDOFF_PATH,
  handlePrometheusIqWorkerRequest
} from "../workers/prometheus-iq-worker.js";

const now = new Date("2026-08-01T14:00:00.000Z");
const nowSeconds = Math.floor(now.getTime() / 1000);
const issuer = "https://prometheus-customer-test.cloudflareaccess.com";
const audience = "route-iq-customer-pwa-test-audience";
const runtimeAssets = Object.freeze({
  fullPool: "/data/qualified-prospects/google-qualified-businesses-v2/runtime-pools.json",
  activePool: "/data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/active-pool.json",
  quarantinePool: "/data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/quarantine-pool.json",
  businessHours: "/data/qualified-prospects/google-qualified-businesses-v2/business-hours-v1/business-hours.json"
});
const dashboardSource = readFileSync(new URL("../index.html", import.meta.url), "utf8");

const primaryKeys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const alternateKeys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const primaryJwk = await exportJWK(primaryKeys.publicKey);
primaryJwk.alg = "RS256";
primaryJwk.use = "sig";
primaryJwk.kid = "route-iq-customer-pwa-primary-test-key";
const primaryKeyResolver = createLocalJWKSet({ keys: [primaryJwk] });

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function exactKeys(value, expected) {
  assert.deepEqual(Object.keys(value).sort(), [...expected].sort());
}

function fixtureSubject(workspaceNumber, userNumber) {
  return `commercial-isolation:${workspaceNumber}:${userNumber}`;
}

function activeCustomerRegistry({ workspaceCount = 2, usersPerWorkspace = 20 } = {}) {
  const registry = clone(createCommercialIsolationFixtureRegistry({ workspaceCount, usersPerWorkspace }));
  registry.workspaces.forEach(workspace => {
    workspace.workspaceState = "active_customer";
    workspace.normalOperationVisible = true;
    workspace.productionActivationAuthorized = true;
    workspace.business.relationshipClassification = "CUSTOMER_PRODUCTION";
    workspace.evidenceGovernance.classification = "CUSTOMER_GOVERNED_EVIDENCE";
    workspace.roles = [
      { roleId: "customer_owner", operationalAccess: true, founderIntelligenceAccess: false, workspaceAdministration: true },
      { roleId: "customer_manager", operationalAccess: true, founderIntelligenceAccess: false, workspaceAdministration: false },
      { roleId: "customer_representative", operationalAccess: true, founderIntelligenceAccess: false, workspaceAdministration: false }
    ];
    workspace.users.forEach((user, index) => {
      user.roleId = index === 0
        ? "customer_owner"
        : index === 1
          ? "customer_manager"
          : "customer_representative";
      user.founderIntelligenceEligibility = false;
    });
  });
  return validateCommercialWorkspaceRegistry(registry, { requireCanonicalProof: false });
}

function activeEnvelope(registry) {
  return {
    version: routeIqAugust1LaunchEnvelopeVersion,
    state: "ACTIVE",
    classification: "PRODUCTION_ACTIVATION",
    issuedAt: "2026-08-01T13:55:00.000Z",
    expiresAt: "2026-08-08T13:55:00.000Z",
    limits: { maximumCompanies: 2, maximumNamedUsers: 40 },
    safety: {
      prelaunchHumanAcceptanceTester: "cruz",
      externalHumanTesting: false,
      anthonyMapped: false,
      prospectiveCollection: "OFF",
      activeCohorts: 0,
      recommendationInfluence: "OFF"
    },
    workspaceAdmissions: registry.workspaces.map(workspace => ({
      workspaceId: workspace.workspaceId,
      operatingProfileId: workspace.operatingProfileId,
      authorizedUserIds: workspace.users.map(user => user.userId),
      runtimeAssets
    }))
  };
}

const canonicalRegistry = activeCustomerRegistry();
const canonicalEnvelope = activeEnvelope(canonicalRegistry);

function testHooks(overrides = {}) {
  return {
    enabled: true,
    currentDate: now,
    keyResolver: primaryKeyResolver,
    envelope: canonicalEnvelope,
    registry: canonicalRegistry,
    ...overrides
  };
}

function indexAsset({
  html = `<!doctype html><html><head><title>Route IQ</title></head><body><template id="${ROUTE_IQ_CUSTOMER_PWA_SESSION_TEMPLATE_ID}">${ROUTE_IQ_CUSTOMER_PWA_SESSION_MARKER}</template></body></html>`
} = {}) {
  const requests = [];
  return {
    requests,
    async fetch(request) {
      requests.push({
        pathname: new URL(request.url).pathname,
        method: request.method,
        headers: Object.fromEntries(request.headers)
      });
      return new Response(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Length": String(new TextEncoder().encode(html).byteLength)
        }
      });
    }
  };
}

function enabledEnv(overrides = {}) {
  return {
    [ROUTE_IQ_CUSTOMER_PWA_ENV.enabled]: "ON",
    [ROUTE_IQ_CUSTOMER_PWA_ENV.workerName]: "prometheus-iq",
    [ROUTE_IQ_CUSTOMER_PWA_ENV.accessTeamDomain]: issuer,
    [ROUTE_IQ_CUSTOMER_PWA_ENV.accessAudience]: audience,
    ASSETS: indexAsset(),
    ...overrides
  };
}

async function accessToken({
  subject = fixtureSubject(1, 1),
  tokenIssuer = issuer,
  tokenAudience = audience,
  issuedAt = nowSeconds - 10,
  expiresAt = nowSeconds + 300,
  notBefore,
  includeSubject = true,
  includeIssuer = true,
  includeAudience = true,
  includeIssuedAt = true,
  includeExpiration = true,
  privateKey = primaryKeys.privateKey,
  keyId = primaryJwk.kid,
  algorithm = "RS256",
  claims = {}
} = {}) {
  let builder = new SignJWT(claims).setProtectedHeader({ alg: algorithm, kid: keyId });
  if (includeIssuer) builder = builder.setIssuer(tokenIssuer);
  if (includeAudience) builder = builder.setAudience(tokenAudience);
  if (includeSubject) builder = builder.setSubject(subject);
  if (includeIssuedAt) builder = builder.setIssuedAt(issuedAt);
  if (includeExpiration) builder = builder.setExpirationTime(expiresAt);
  if (notBefore !== undefined) builder = builder.setNotBefore(notBefore);
  return builder.sign(privateKey);
}

function customerRequest(path, accessAssertion, { method = "GET", headers = {}, body } = {}) {
  return new Request(`https://prometheus-iq.example${path}`, {
    method,
    headers: {
      ...(accessAssertion ? { "Cf-Access-Jwt-Assertion": accessAssertion } : {}),
      ...headers
    },
    body
  });
}

function recordingFieldStore() {
  const data = new Map();
  const writes = [];
  return {
    writes,
    async get(key) {
      return data.get(key) ?? null;
    },
    async put(key, value) {
      writes.push({ key, value });
      data.set(key, String(value));
    },
    async list({ prefix = "" } = {}) {
      return {
        keys: [...data.keys()].filter(key => key.startsWith(prefix)).map(name => ({ name })),
        list_complete: true
      };
    }
  };
}

async function quietWorkerRequest(request, env, hooks) {
  const originalError = console.error;
  console.error = () => {};
  try {
    return await handlePrometheusIqWorkerRequest(request, env, { waitUntil() {} }, hooks);
  } finally {
    console.error = originalError;
  }
}

test("Infrastructure contract exports the exact synchronous session marker and response keys", () => {
  const contract = JSON.parse(readFileSync(new URL(
    "../workers/infrastructure/route-iq-august-1-customer-pwa-runtime-v1.json",
    import.meta.url
  ), "utf8"));
  assert.equal(contract.ownerSubsystem, "Prometheus Infrastructure");
  assert.equal(contract.state, "INERT_DEFAULT_OFF");
  assert.equal(contract.sessionContract.marker, ROUTE_IQ_CUSTOMER_PWA_SESSION_MARKER);
  assert.equal(contract.sessionContract.templateId, ROUTE_IQ_CUSTOMER_PWA_SESSION_TEMPLATE_ID);
  assert.equal(contract.sessionContract.htmlElement, "template#routeIqCustomerPwaSession");
  assert.equal(contract.sessionContract.injectionMode, "REPLACE_EXACT_MARKER_TEXT_INSIDE_EXISTING_TEMPLATE");
  assert.equal(contract.sessionContract.additionalElementCreated, false);
  assert.deepEqual(contract.sessionContract.responseKeys, ROUTE_IQ_CUSTOMER_PWA_SESSION_RESPONSE_KEYS);
  assert.deepEqual(contract.sessionContract.sessionKeys, ROUTE_IQ_CUSTOMER_PWA_SESSION_KEYS);
  assert.deepEqual(contract.sessionContract.capabilityKeys, ROUTE_IQ_CUSTOMER_PWA_SESSION_CAPABILITY_KEYS);
  assert.deepEqual(contract.sessionContract.runtimeAssetKeys, ROUTE_IQ_CUSTOMER_PWA_SESSION_RUNTIME_ASSET_KEYS);
  assert.deepEqual(contract.sessionContract.safetyKeys, ROUTE_IQ_CUSTOMER_PWA_SESSION_SAFETY_KEYS);
  assert.deepEqual(contract.sessionContract.errorResponseKeys, ROUTE_IQ_CUSTOMER_PWA_ERROR_RESPONSE_KEYS);
});

test("runtime switch and checked-in Data envelope are independently default OFF", async () => {
  const token = await accessToken();
  const asset = indexAsset();
  for (const env of [
    { ASSETS: asset },
    enabledEnv({ [ROUTE_IQ_CUSTOMER_PWA_ENV.enabled]: "OFF", ASSETS: asset })
  ]) {
    const response = await handleRouteIqCustomerPwaRequest(
      customerRequest(ROUTE_IQ_CUSTOMER_PWA_SESSION_PATH, token),
      env,
      { testHooks: testHooks() }
    );
    assert.equal(response.status, 404);
    assert.equal((await response.json()).code, ROUTE_IQ_CUSTOMER_PWA_FAILURES.inactive);
  }
  const checkedInOff = await handleRouteIqCustomerPwaRequest(
    customerRequest(ROUTE_IQ_CUSTOMER_PWA_SESSION_PATH, null),
    enabledEnv({ ASSETS: asset })
  );
  assert.equal(checkedInOff.status, 404);
  assert.equal((await checkedInOff.json()).code, ROUTE_IQ_CUSTOMER_PWA_FAILURES.inactive);
  const malformed = await handleRouteIqCustomerPwaRequest(
    customerRequest(ROUTE_IQ_CUSTOMER_PWA_SESSION_PATH, token),
    enabledEnv({ [ROUTE_IQ_CUSTOMER_PWA_ENV.enabled]: "TRUE", ASSETS: asset }),
    { testHooks: testHooks() }
  );
  assert.equal(malformed.status, 503);
  assert.equal((await malformed.json()).code, ROUTE_IQ_CUSTOMER_PWA_FAILURES.configurationInvalid);
  assert.equal(asset.requests.length, 0);
});

test("valid exact Access principal receives only the bounded 2-company 40-user session", async () => {
  const token = await accessToken();
  const response = await handleRouteIqCustomerPwaRequest(
    customerRequest(ROUTE_IQ_CUSTOMER_PWA_SESSION_PATH, token),
    enabledEnv(),
    { testHooks: testHooks() }
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  const body = await response.json();
  exactKeys(body, ROUTE_IQ_CUSTOMER_PWA_SESSION_RESPONSE_KEYS);
  exactKeys(body.session, ROUTE_IQ_CUSTOMER_PWA_SESSION_KEYS);
  exactKeys(body.session.capabilities, ROUTE_IQ_CUSTOMER_PWA_SESSION_CAPABILITY_KEYS);
  exactKeys(body.session.runtimeAssets, ROUTE_IQ_CUSTOMER_PWA_SESSION_RUNTIME_ASSET_KEYS);
  exactKeys(body.session.safety, ROUTE_IQ_CUSTOMER_PWA_SESSION_SAFETY_KEYS);
  assert.equal(body.session.authorizationState, "server_verified");
  assert.equal(body.session.workspaceId, canonicalRegistry.workspaces[0].workspaceId);
  assert.equal(body.session.operatingProfileId, canonicalRegistry.workspaces[0].operatingProfileId);
  assert.equal(body.session.userId, canonicalRegistry.workspaces[0].users[0].userId);
  assert.equal(body.session.representativeId, canonicalRegistry.workspaces[0].users[0].representativeId);
  assert.equal(body.session.displayName, canonicalRegistry.workspaces[0].users[0].displayName);
  assert.equal(body.session.roleId, "customer_owner");
  assert.equal(body.session.expiresAt, new Date((nowSeconds + 300) * 1000).toISOString());
  assert.equal(body.session.capabilities.founderIntelligence, false);
  assert.equal(body.session.capabilities.founderCrm, false);
  assert.deepEqual(body.session.safety, {
    prospectiveCollection: "OFF",
    activeCohorts: 0,
    recommendationInfluence: "OFF"
  });
  const serialized = JSON.stringify(body);
  assert.equal(serialized.includes(fixtureSubject(1, 1)), false);
  assert.equal(serialized.includes(canonicalRegistry.workspaces[0].users[0].authenticatedPrincipalId), false);
  assert.equal(serialized.includes(token), false);
  assert.equal(Object.hasOwn(body.session, "capacity"), false);
  assert.equal(Object.hasOwn(body.session, "companyId"), false);

  const overCapacityRegistry = activeCustomerRegistry({ workspaceCount: 2, usersPerWorkspace: 21 });
  const overCapacity = await handleRouteIqCustomerPwaRequest(
    customerRequest(ROUTE_IQ_CUSTOMER_PWA_SESSION_PATH, token),
    enabledEnv(),
    { testHooks: testHooks({
      registry: overCapacityRegistry,
      envelope: activeEnvelope(overCapacityRegistry)
    }) }
  );
  assert.equal(overCapacity.status, 503);
  assert.equal((await overCapacity.json()).code, ROUTE_IQ_CUSTOMER_PWA_FAILURES.launchInvalid);

  const longerAccess = await handleRouteIqCustomerPwaRequest(
    customerRequest(ROUTE_IQ_CUSTOMER_PWA_SESSION_PATH, await accessToken({
      expiresAt: Math.floor(Date.parse(canonicalEnvelope.expiresAt) / 1000) + 3600
    })),
    enabledEnv(),
    { testHooks: testHooks() }
  );
  assert.equal(longerAccess.status, 200);
  assert.equal((await longerAccess.json()).session.expiresAt, canonicalEnvelope.expiresAt);

  const head = await handleRouteIqCustomerPwaRequest(
    customerRequest(ROUTE_IQ_CUSTOMER_PWA_SESSION_PATH, token, { method: "HEAD" }),
    enabledEnv(),
    { testHooks: testHooks() }
  );
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");

  const unknown = await handleRouteIqCustomerPwaRequest(
    customerRequest(ROUTE_IQ_CUSTOMER_PWA_SESSION_PATH, await accessToken({ subject: "unknown-customer-principal" })),
    enabledEnv(),
    { testHooks: testHooks() }
  );
  assert.equal(unknown.status, 403);
  assert.equal((await unknown.json()).code, ROUTE_IQ_CUSTOMER_PWA_FAILURES.principalUnmapped);

  const writeMethod = await handleRouteIqCustomerPwaRequest(
    customerRequest(ROUTE_IQ_CUSTOMER_PWA_SESSION_PATH, token, { method: "POST", body: "{}" }),
    enabledEnv(),
    { testHooks: testHooks() }
  );
  assert.equal(writeMethod.status, 405);
  assert.equal((await writeMethod.json()).code, ROUTE_IQ_CUSTOMER_PWA_FAILURES.methodNotAllowed);
});

test("issuer, audience, algorithm, signing key, signature, time, and required claims fail closed", async t => {
  const cases = [
    ["issuer", await accessToken({ tokenIssuer: "https://other-team.cloudflareaccess.com" }), ROUTE_IQ_CUSTOMER_PWA_FAILURES.issuerMismatch],
    ["audience", await accessToken({ tokenAudience: [audience, "unauthorized-audience"] }), ROUTE_IQ_CUSTOMER_PWA_FAILURES.audienceMismatch],
    ["unknown key", await accessToken({ privateKey: alternateKeys.privateKey, keyId: "unknown-customer-key" }), ROUTE_IQ_CUSTOMER_PWA_FAILURES.signingKeyUnknown],
    ["invalid signature", await accessToken({ privateKey: alternateKeys.privateKey }), ROUTE_IQ_CUSTOMER_PWA_FAILURES.signatureInvalid],
    ["expired", await accessToken({ expiresAt: nowSeconds - 1 }), ROUTE_IQ_CUSTOMER_PWA_FAILURES.tokenExpired],
    ["premature nbf", await accessToken({ notBefore: nowSeconds + 60 }), ROUTE_IQ_CUSTOMER_PWA_FAILURES.tokenPremature],
    ["premature iat", await accessToken({ issuedAt: nowSeconds + 60 }), ROUTE_IQ_CUSTOMER_PWA_FAILURES.tokenPremature],
    ["missing subject", await accessToken({ includeSubject: false }), ROUTE_IQ_CUSTOMER_PWA_FAILURES.claimMissing],
    ["missing issued-at", await accessToken({ includeIssuedAt: false }), ROUTE_IQ_CUSTOMER_PWA_FAILURES.claimMissing],
    ["missing expiration", await accessToken({ includeExpiration: false }), ROUTE_IQ_CUSTOMER_PWA_FAILURES.claimMissing],
    ["non-RS256", await accessToken({
      algorithm: "HS256",
      privateKey: new TextEncoder().encode("bounded-customer-pwa-test-secret-material"),
      keyId: "symmetric-test-key"
    }), ROUTE_IQ_CUSTOMER_PWA_FAILURES.algorithmInvalid]
  ];
  for (const [name, token, code] of cases) {
    await t.test(name, async () => {
      const response = await handleRouteIqCustomerPwaRequest(
        customerRequest(ROUTE_IQ_CUSTOMER_PWA_SESSION_PATH, token),
        enabledEnv(),
        { testHooks: testHooks() }
      );
      assert.equal(response.status, 403, name);
      const body = await response.json();
      exactKeys(body, ROUTE_IQ_CUSTOMER_PWA_ERROR_RESPONSE_KEYS);
      assert.equal(body.code, code, name);
      assert.equal(body.message, "Route IQ customer access is unavailable.", name);
      assert.equal(JSON.stringify(body).includes("other-team"), false, name);
      assert.equal(JSON.stringify(body).includes("unauthorized-audience"), false, name);
    });
  }
});

test("app replaces the existing template marker with escaped JSON without forwarding identity material", async () => {
  const token = await accessToken();
  const asset = indexAsset({ html: dashboardSource });
  const response = await handleRouteIqCustomerPwaRequest(
    customerRequest(ROUTE_IQ_CUSTOMER_PWA_PATH, token, {
      headers: { Cookie: ["CF", "_Authorization", "=test-fixture-only"].join("") }
    }),
    enabledEnv({ ASSETS: asset }),
    { testHooks: testHooks() }
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  const html = await response.text();
  assert.equal(html.includes(ROUTE_IQ_CUSTOMER_PWA_SESSION_MARKER), false);
  assert.match(html, new RegExp(`<template id="${ROUTE_IQ_CUSTOMER_PWA_SESSION_TEMPLATE_ID}">\\{`, "u"));
  assert.equal(html.includes("<script type=\"application/json\""), false);
  assert.equal(html.includes(token), false);
  assert.equal(html.includes(fixtureSubject(1, 1)), false);
  assert.equal(html.includes("CF_Authorization"), false);
  const injectedTemplateText = html.match(
    new RegExp(`<template id="${ROUTE_IQ_CUSTOMER_PWA_SESSION_TEMPLATE_ID}">([^<]+)</template>`, "u")
  )?.[1];
  assert.equal(typeof injectedTemplateText, "string");
  exactKeys(JSON.parse(injectedTemplateText), ROUTE_IQ_CUSTOMER_PWA_SESSION_KEYS);
  assert.deepEqual(asset.requests, [{
    pathname: "/index.html",
    method: "GET",
    headers: { accept: "text/html" }
  }]);

  const authorized = await handleRouteIqCustomerPwaRequest(
    customerRequest(ROUTE_IQ_CUSTOMER_PWA_SESSION_PATH, token),
    enabledEnv(),
    { testHooks: testHooks() }
  );
  const session = clone((await authorized.json()).session);
  session.workspaceLabel = "</script><script>alert(1)</script>&>\u2028\u2029";
  const serialized = serializeRouteIqCustomerPwaSession(session);
  assert.equal(serialized.includes("</script>"), false);
  assert.equal(serialized.includes("<"), false);
  assert.equal(serialized.includes(">"), false);
  assert.equal(serialized.includes("&"), false);
  assert.equal(serialized.includes("\u2028"), false);
  assert.equal(serialized.includes("\u2029"), false);
  assert.match(serialized, /\\u003c\/script\\u003e/u);
  assert.match(serialized, /\\u0026/u);
  assert.match(serialized, /\\u2028/u);
  assert.match(serialized, /\\u2029/u);
  const template = `<template id="${ROUTE_IQ_CUSTOMER_PWA_SESSION_TEMPLATE_ID}">${ROUTE_IQ_CUSTOMER_PWA_SESSION_MARKER}</template>`;
  const injected = injectRouteIqCustomerPwaSession(`<html><head></head><body>${template}</body></html>`, session);
  assert.equal(injected.includes(`id="${ROUTE_IQ_CUSTOMER_PWA_SESSION_TEMPLATE_ID}"`), true);
  assert.equal(injected.includes(ROUTE_IQ_CUSTOMER_PWA_SESSION_MARKER), false);
  assert.equal(injected.includes("<script"), false);
  assert.throws(
    () => injectRouteIqCustomerPwaSession(injected, session),
    error => error.code === ROUTE_IQ_CUSTOMER_PWA_FAILURES.assetUnavailable
  );

  const trailingAsset = indexAsset();
  for (const method of ["GET", "HEAD"]) {
    const trailing = await handleRouteIqCustomerPwaRequest(
      customerRequest(`${ROUTE_IQ_CUSTOMER_PWA_PATH}/?view=queue&mode=field`, token, { method }),
      enabledEnv({ ASSETS: trailingAsset }),
      { testHooks: testHooks() }
    );
    assert.equal(trailing.status, 307, method);
    assert.equal(
      trailing.headers.get("Location"),
      "https://prometheus-iq.example/app?view=queue&mode=field",
      method
    );
    assert.equal(trailing.headers.get("Cache-Control"), "private, no-store", method);
    assert.equal(await trailing.text(), "", method);
  }
  assert.equal(trailingAsset.requests.length, 0);

  const unauthenticatedTrailing = await handleRouteIqCustomerPwaRequest(
    customerRequest(`${ROUTE_IQ_CUSTOMER_PWA_PATH}/`, null),
    enabledEnv({ ASSETS: trailingAsset }),
    { testHooks: testHooks() }
  );
  assert.equal(unauthenticatedTrailing.status, 403);
  assert.equal((await unauthenticatedTrailing.json()).code, ROUTE_IQ_CUSTOMER_PWA_FAILURES.authenticationRequired);

  const nestedPath = await handleRouteIqCustomerPwaRequest(
    customerRequest(`${ROUTE_IQ_CUSTOMER_PWA_PATH}/untrusted`, token),
    enabledEnv({ ASSETS: asset }),
    { testHooks: testHooks() }
  );
  assert.equal(nestedPath.status, 404);
  assert.equal((await nestedPath.json()).code, ROUTE_IQ_CUSTOMER_PWA_FAILURES.routeNotFound);
  assert.equal(asset.requests.length, 1);
});

test("role and workspace contract mismatches cannot produce a customer session", async () => {
  const token = await accessToken();
  const roleRegistry = clone(canonicalRegistry);
  roleRegistry.workspaces[0].roles.find(role => role.roleId === "customer_owner").founderIntelligenceAccess = true;
  const roleResponse = await handleRouteIqCustomerPwaRequest(
    customerRequest(ROUTE_IQ_CUSTOMER_PWA_SESSION_PATH, token),
    enabledEnv(),
    { testHooks: testHooks({ registry: roleRegistry }) }
  );
  assert.equal(roleResponse.status, 403);
  assert.equal((await roleResponse.json()).code, ROUTE_IQ_CUSTOMER_PWA_FAILURES.roleUnauthorized);

  const profileMismatch = clone(canonicalEnvelope);
  profileMismatch.workspaceAdmissions[0].operatingProfileId = "wrong_profile";
  const profileResponse = await handleRouteIqCustomerPwaRequest(
    customerRequest(ROUTE_IQ_CUSTOMER_PWA_SESSION_PATH, token),
    enabledEnv(),
    { testHooks: testHooks({ envelope: profileMismatch }) }
  );
  assert.equal(profileResponse.status, 503);
  assert.equal((await profileResponse.json()).code, ROUTE_IQ_CUSTOMER_PWA_FAILURES.launchInvalid);
});

test("customer launch mode binds field-session writes to the verified workspace and representative", async () => {
  const token = await accessToken({ subject: fixtureSubject(1, 3) });
  const principalWorkspace = canonicalRegistry.workspaces[0];
  const principalUser = principalWorkspace.users[2];

  for (const [name, body, expectedCode] of [
    ["cross workspace", {
      workspaceId: canonicalRegistry.workspaces[1].workspaceId,
      operatingProfileId: canonicalRegistry.workspaces[1].operatingProfileId,
      rawReportText: JSON.stringify({ rep: { id: principalUser.representativeId } })
    }, ROUTE_IQ_CUSTOMER_PWA_FAILURES.scopeMismatch],
    ["cross representative", {
      workspaceId: principalWorkspace.workspaceId,
      operatingProfileId: principalWorkspace.operatingProfileId,
      rawReportText: JSON.stringify({ rep: { id: principalWorkspace.users[3].representativeId } })
    }, ROUTE_IQ_CUSTOMER_PWA_FAILURES.crossUserWriteDenied]
  ]) {
    const store = recordingFieldStore();
    const response = await quietWorkerRequest(
      customerRequest(ROUTE_IQ_FIELD_SESSION_HANDOFF_PATH, token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completionAction: "end_route", ...body })
      }),
      enabledEnv({ [routeIqFieldSessionStoreBinding]: store }),
      { customerPwaTestHooks: testHooks() }
    );
    assert.equal(response.status, 403, name);
    assert.equal((await response.json()).code, expectedCode, name);
    assert.equal(store.writes.length, 0, name);
  }
});

test("launch OFF preserves Founder-research field-session behavior while ON requires Access first", async () => {
  const store = recordingFieldStore();
  const request = customerRequest(ROUTE_IQ_FIELD_SESSION_HANDOFF_PATH, null, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({})
  });
  const offResponse = await quietWorkerRequest(request.clone(), {
    [routeIqFieldSessionStoreBinding]: store,
    ASSETS: indexAsset()
  });
  assert.equal(offResponse.status, 400);
  assert.equal((await offResponse.json()).code, "field_session_completion_action_invalid");

  const onResponse = await quietWorkerRequest(request.clone(), enabledEnv({
    [routeIqFieldSessionStoreBinding]: store
  }), { customerPwaTestHooks: testHooks() });
  assert.equal(onResponse.status, 403);
  assert.equal((await onResponse.json()).code, ROUTE_IQ_CUSTOMER_PWA_FAILURES.authenticationRequired);
  assert.equal(store.writes.length, 0);
});

test("test-only clock and key injection cannot be enabled incompletely", async () => {
  const token = await accessToken();
  for (const incomplete of [
    { enabled: true, currentDate: now },
    { enabled: true, keyResolver: primaryKeyResolver }
  ]) {
    const response = await handleRouteIqCustomerPwaRequest(
      customerRequest(ROUTE_IQ_CUSTOMER_PWA_SESSION_PATH, token),
      enabledEnv(),
      { testHooks: incomplete }
    );
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, ROUTE_IQ_CUSTOMER_PWA_FAILURES.configurationInvalid);
  }
});
