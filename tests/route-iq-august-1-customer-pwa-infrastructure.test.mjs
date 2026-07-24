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
const legacyLaunchRuntimeAssets = Object.freeze({
  fullPool: "/data/qualified-prospects/google-qualified-businesses-v2/runtime-pools.json",
  activePool: "/data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/active-pool.json",
  quarantinePool: "/data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/quarantine-pool.json",
  businessHours: "/data/qualified-prospects/google-qualified-businesses-v2/business-hours-v1/business-hours.json"
});
const workspaceConfigurationPath = "/administration/workspace-configurations/route-iq-cross-industry-workspaces-v2.json";
const businessManifestRegistryPath = "/data/route-iq-commercial-readiness-v1/route-iq-workspace-business-artifact-manifest-registry-v1.json";
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
      runtimeAssets: legacyLaunchRuntimeAssets
    }))
  };
}

const canonicalRegistry = activeCustomerRegistry();
const canonicalEnvelope = activeEnvelope(canonicalRegistry);

function trustedRuntimeBindings(registry = canonicalRegistry) {
  const workspaces = registry.workspaces.map((workspace, workspaceIndex) => {
    const manifestId = `${workspace.workspaceId}_approved_business_roster`;
    const artifactPath = `data/route-iq-commercial-readiness-v1/fixtures/${workspace.workspaceId}-approved-businesses-v1.json`;
    return {
      workspaceId: workspace.workspaceId,
      companyId: `${workspace.workspaceId}_owner`,
      operatingProfile: { profileId: workspace.operatingProfileId },
      provenance: {
        owner: "prometheus_administration",
        configurationVersion: "v2.2.0"
      },
      territories: workspace.territories.map((territory, territoryIndex) => ({
        territoryId: territory.territoryId,
        active: territory.active,
        zipCoverage: {
          coverageVersion: "territory-zip-coverage-v1.0.0",
          workspaceId: workspace.workspaceId,
          companyId: `${workspace.workspaceId}_owner`,
          territoryId: territory.territoryId,
          postalCodes: [
            String(75000 + (workspaceIndex * 100) + territoryIndex).padStart(5, "0")
          ]
        }
      })),
      roles: workspace.roles.map(role => ({ roleId: role.roleId })),
      users: workspace.users.map(user => ({
        userId: user.userId,
        representativeId: user.representativeId,
        roleId: user.roleId,
        territoryIds: [...(user.territoryIds || [workspace.territories[0].territoryId])].sort(),
        active: user.active
      })),
      fallbackPolicy: {
        mode: "FAIL_CLOSED",
        demoCatalogAllowed: false,
        embeddedBusinessCatalogAllowed: false,
        crossWorkspaceFallbackAllowed: false
      },
      opportunitySources: [{
        workspaceId: workspace.workspaceId,
        profileId: workspace.operatingProfileId,
        manifestId,
        manifestRegistryPath: businessManifestRegistryPath.slice(1),
        artifactPath,
        classification: "CUSTOMER_GOVERNED_DATA",
        manifestApprovalState: "APPROVED",
        productionUseAuthorized: true
      }]
    };
  });
  const manifests = workspaces.map((workspace, index) => ({
    manifestId: workspace.opportunitySources[0].manifestId,
    manifestVersion: "route-iq-workspace-business-artifact-manifest-v1",
    workspaceId: workspace.workspaceId,
    operatingProfileId: workspace.operatingProfile.profileId,
    artifactPath: workspace.opportunitySources[0].artifactPath,
    artifactSha256: String(index + 1).repeat(64).slice(0, 64),
    classification: workspace.opportunitySources[0].classification,
    approvalState: "APPROVED",
    productionUseAuthorized: true,
    demoFallbackAllowed: false,
    crossWorkspaceFallbackAllowed: false
  }));
  return {
    workspaceConfiguration: {
      path: workspaceConfigurationPath,
      registry: {
        schemaVersion: "route-iq-workspace-configuration-v2",
        authority: "prometheus_administration",
        safety: {
          collection: "OFF",
        activeCohorts: 0,
        recommendationInfluence: "OFF"
      },
      founderBoundary: {
        founderUserId: "fixture_founder_user",
        founderPrincipalMappingStatus: "EXACT_PRINCIPAL_MAPPED",
        authorizedWorkspaceIds: workspaces.map(workspace => workspace.workspaceId)
      },
      workspaces
    }
    },
    businessManifestRegistry: {
      path: businessManifestRegistryPath,
      registry: {
        schemaVersion: "route-iq-workspace-business-artifact-manifest-v1",
        registryVersion: "route-iq-workspace-business-artifact-manifest-registry-v1",
        fallbackPolicy: "FAIL_CLOSED_NO_DEMO_OR_CROSS_WORKSPACE_FALLBACK",
        manifests
      }
    },
    businessHours: workspaces.map(workspace => ({
      workspaceId: workspace.workspaceId,
      operatingProfileId: workspace.operatingProfile.profileId,
      path: `/data/route-iq-commercial-readiness-v1/fixtures/${workspace.workspaceId}-business-hours-v1.json`,
      artifact: {
        schemaVersion: "prometheus-data-business-hours-v1",
        workspaceId: workspace.workspaceId,
        operatingProfileId: workspace.operatingProfile.profileId,
        freshnessPolicy: {
          providerRefreshIntervalHours: 24,
          freshnessThresholdHours: 24
        },
        records: []
      }
    }))
  };
}

function expectedRuntimeAssets(registry = canonicalRegistry, workspaceIndex = 0) {
  const bindings = trustedRuntimeBindings(registry);
  const workspace = bindings.workspaceConfiguration.registry.workspaces[workspaceIndex];
  const manifest = bindings.businessManifestRegistry.registry.manifests[workspaceIndex];
  const hours = bindings.businessHours[workspaceIndex];
  return {
    workspaceConfiguration: workspaceConfigurationPath,
    businessManifestRegistry: businessManifestRegistryPath,
    businessRoster: `/${manifest.artifactPath}`,
    businessHours: hours.path
  };
}

function dataAuthorizedPrincipalForWorkspace(registry, workspaceIndex) {
  const workspace = registry.workspaces[workspaceIndex];
  const user = workspace.users[0];
  return {
    authorized: true,
    companyId: workspace.workspaceId,
    workspaceId: workspace.workspaceId,
    workspaceLabel: workspace.business.brand.displayName,
    operatingProfileId: workspace.operatingProfileId,
    userId: user.userId,
    representativeId: user.representativeId,
    displayName: user.displayName,
    roleId: user.roleId,
    capabilities: {
      operateOwnRoute: true,
      readWorkspaceOperations: true,
      administerWorkspaceRoster: true,
      founderIntelligence: false,
      founderCrm: false
    },
    runtimeAssets: canonicalEnvelope.workspaceAdmissions[workspaceIndex].runtimeAssets,
    expiresAt: canonicalEnvelope.expiresAt,
    safety: {
      prospectiveCollection: "OFF",
      activeCohorts: 0,
      recommendationInfluence: "OFF"
    }
  };
}

function testHooks(overrides = {}) {
  return {
    enabled: true,
    currentDate: now,
    keyResolver: primaryKeyResolver,
    envelope: canonicalEnvelope,
    registry: canonicalRegistry,
    runtimeBindings: trustedRuntimeBindings(),
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
  assert.equal(contract.contractVersion, "route-iq-august-1-customer-pwa-runtime-v3");
  assert.equal(contract.workspaceSelection.authorizationOwner, "Prometheus Data");
  assert.equal(contract.workspaceSelection.infrastructureAllowlistAllowed, false);
  assert.equal(contract.workspaceSelection.clientSessionWorkspaceCount, 1);
  assert.equal(contract.zipCoverage.missingInvalidOrUnauthorized, "FAIL_CLOSED");
  assert.equal(contract.zipCoverage.projectionVisibility, "SERVER_INTERNAL");
  assert.equal(contract.zipCoverage.source, "workspace.territories[].zipCoverage");
  assert.equal(
    contract.zipCoverage.postalCodeSource,
    "workspace.territories[].zipCoverage.postalCodes"
  );
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
  assert.deepEqual(body.session.runtimeAssets, expectedRuntimeAssets());
  assert.equal(Object.hasOwn(body.session.runtimeAssets, "fullPool"), false);
  assert.equal(Object.hasOwn(body.session.runtimeAssets, "activePool"), false);
  assert.equal(Object.hasOwn(body.session.runtimeAssets, "quarantinePool"), false);
  assert.notDeepEqual(body.session.runtimeAssets, legacyLaunchRuntimeAssets);
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

test("Infrastructure delegates explicit Founder workspace selection to Data and emits one scoped session", async () => {
  const exactFounderPrincipal = canonicalRegistry.workspaces[0].users[0].authenticatedPrincipalId;
  const calls = [];
  const dataAuthorizePrincipal = input => {
    calls.push(input);
    assert.equal(input.authenticatedPrincipalId, exactFounderPrincipal);
    assert.equal(Object.hasOwn(input, "displayName"), false);
    assert.equal(Object.hasOwn(input, "callerId"), false);
    const workspaceIndex = canonicalRegistry.workspaces.findIndex(
      workspace => workspace.workspaceId === input.requestedWorkspaceId
    );
    if (workspaceIndex < 0) {
      const error = new Error("Workspace selection denied.");
      error.code = "route_iq_launch_requested_workspace_unauthorized";
      throw error;
    }
    return dataAuthorizedPrincipalForWorkspace(canonicalRegistry, workspaceIndex);
  };
  const token = await accessToken();
  for (const workspaceIndex of [0, 1]) {
    const workspaceId = canonicalRegistry.workspaces[workspaceIndex].workspaceId;
    const response = await handleRouteIqCustomerPwaRequest(
      customerRequest(
        `${ROUTE_IQ_CUSTOMER_PWA_SESSION_PATH}?workspaceId=${workspaceId}`,
        token
      ),
      enabledEnv(),
      { testHooks: testHooks({ dataAuthorizePrincipal }) }
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    exactKeys(body.session, ROUTE_IQ_CUSTOMER_PWA_SESSION_KEYS);
    exactKeys(body.session.runtimeAssets, ROUTE_IQ_CUSTOMER_PWA_SESSION_RUNTIME_ASSET_KEYS);
    assert.equal(body.session.workspaceId, workspaceId);
    assert.deepEqual(body.session.runtimeAssets, expectedRuntimeAssets(canonicalRegistry, workspaceIndex));
    assert.equal(Object.hasOwn(body.session, "authorizedWorkspaceIds"), false);
    assert.equal(Object.hasOwn(body.session, "zipCoverage"), false);
  }
  assert.deepEqual(
    calls.map(call => call.requestedWorkspaceId),
    canonicalRegistry.workspaces.map(workspace => workspace.workspaceId)
  );
});

test("unknown, malformed, representative, display-name, and Anthony workspace selection fail closed", async () => {
  const exactFounderPrincipal = canonicalRegistry.workspaces[0].users[0].authenticatedPrincipalId;
  const representativePrincipal = canonicalRegistry.workspaces[0].users[2].authenticatedPrincipalId;
  const denied = input => {
    if (input.authenticatedPrincipalId === exactFounderPrincipal
      && input.requestedWorkspaceId === canonicalRegistry.workspaces[0].workspaceId) {
      return dataAuthorizedPrincipalForWorkspace(canonicalRegistry, 0);
    }
    const error = new Error("Workspace selection denied.");
    error.code = "route_iq_launch_requested_workspace_unauthorized";
    throw error;
  };
  const cases = [
    {
      name: "unknown",
      subject: fixtureSubject(1, 1),
      query: "unknown_workspace"
    },
    {
      name: "representative cross-company",
      subject: fixtureSubject(1, 3),
      query: canonicalRegistry.workspaces[1].workspaceId,
      expectedPrincipal: representativePrincipal
    },
    {
      name: "display name",
      subject: canonicalRegistry.workspaces[0].users[0].displayName,
      query: canonicalRegistry.workspaces[0].workspaceId
    },
    {
      name: "Anthony",
      subject: "anthony",
      query: canonicalRegistry.workspaces[0].workspaceId
    }
  ];
  for (const item of cases) {
    const response = await handleRouteIqCustomerPwaRequest(
      customerRequest(
        `${ROUTE_IQ_CUSTOMER_PWA_SESSION_PATH}?workspaceId=${item.query}`,
        await accessToken({ subject: item.subject })
      ),
      enabledEnv(),
      { testHooks: testHooks({
        dataAuthorizePrincipal(input) {
          if (item.expectedPrincipal) {
            assert.equal(input.authenticatedPrincipalId, item.expectedPrincipal);
          }
          return denied(input);
        }
      }) }
    );
    assert.equal(response.status, 403, item.name);
    const body = await response.json();
    assert.equal(body.code, ROUTE_IQ_CUSTOMER_PWA_FAILURES.scopeMismatch, item.name);
    assert.equal(JSON.stringify(body).includes(item.query), false, item.name);
  }

  for (const query of [
    "workspaceId=Fitness%20Connection",
    "workspaceId=first_workspace&workspaceId=second_workspace"
  ]) {
    const response = await handleRouteIqCustomerPwaRequest(
      customerRequest(`${ROUTE_IQ_CUSTOMER_PWA_SESSION_PATH}?${query}`, await accessToken()),
      enabledEnv(),
      { testHooks: testHooks({ dataAuthorizePrincipal: denied }) }
    );
    assert.equal(response.status, 403);
    assert.equal((await response.json()).code, ROUTE_IQ_CUSTOMER_PWA_FAILURES.scopeMismatch);
  }
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

test("trusted Administration and Data bindings exclusively derive role and runtime assets", async t => {
  const token = await accessToken();

  await t.test("legacy launch asset paths cannot alter the emitted session", async () => {
    const envelope = clone(canonicalEnvelope);
    envelope.workspaceAdmissions[0].runtimeAssets = {
      fullPool: "/data/untrusted/legacy-full-pool.json",
      activePool: "/data/untrusted/legacy-active-pool.json",
      quarantinePool: "/data/untrusted/legacy-quarantine-pool.json",
      businessHours: "/data/untrusted/legacy-business-hours.json"
    };
    const response = await handleRouteIqCustomerPwaRequest(
      customerRequest(ROUTE_IQ_CUSTOMER_PWA_SESSION_PATH, token),
      enabledEnv(),
      { testHooks: testHooks({ envelope }) }
    );
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).session.runtimeAssets, expectedRuntimeAssets());
  });

  await t.test("Administration role mismatch fails closed", async () => {
    const bindings = clone(trustedRuntimeBindings());
    bindings.workspaceConfiguration.registry.workspaces[0].users[0].roleId = "customer_manager";
    const response = await handleRouteIqCustomerPwaRequest(
      customerRequest(ROUTE_IQ_CUSTOMER_PWA_SESSION_PATH, token),
      enabledEnv(),
      { testHooks: testHooks({ runtimeBindings: bindings }) }
    );
    assert.equal(response.status, 403);
    assert.equal((await response.json()).code, ROUTE_IQ_CUSTOMER_PWA_FAILURES.roleUnauthorized);
  });

  await t.test("manifest and approved-roster mismatch fails closed", async () => {
    const bindings = clone(trustedRuntimeBindings());
    bindings.businessManifestRegistry.registry.manifests[0].artifactPath =
      "data/route-iq-commercial-readiness-v1/fixtures/unbound-approved-businesses-v1.json";
    const response = await handleRouteIqCustomerPwaRequest(
      customerRequest(ROUTE_IQ_CUSTOMER_PWA_SESSION_PATH, token),
      enabledEnv(),
      { testHooks: testHooks({ runtimeBindings: bindings }) }
    );
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, ROUTE_IQ_CUSTOMER_PWA_FAILURES.runtimeBindingInvalid);
  });

  await t.test("cross-profile business-hours binding fails closed", async () => {
    const bindings = clone(trustedRuntimeBindings());
    bindings.businessHours[0].operatingProfileId = "wrong_profile";
    const response = await handleRouteIqCustomerPwaRequest(
      customerRequest(ROUTE_IQ_CUSTOMER_PWA_SESSION_PATH, token),
      enabledEnv(),
      { testHooks: testHooks({ runtimeBindings: bindings }) }
    );
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, ROUTE_IQ_CUSTOMER_PWA_FAILURES.runtimeBindingInvalid);
  });

  await t.test("hours beyond the 24-hour ceiling fail closed", async () => {
    const bindings = clone(trustedRuntimeBindings());
    bindings.businessHours[0].artifact.freshnessPolicy.freshnessThresholdHours = 25;
    const response = await handleRouteIqCustomerPwaRequest(
      customerRequest(ROUTE_IQ_CUSTOMER_PWA_SESSION_PATH, token),
      enabledEnv(),
      { testHooks: testHooks({ runtimeBindings: bindings }) }
    );
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, ROUTE_IQ_CUSTOMER_PWA_FAILURES.runtimeBindingInvalid);
  });
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
    { enabled: true, keyResolver: primaryKeyResolver },
    { enabled: true, currentDate: now, keyResolver: primaryKeyResolver }
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
