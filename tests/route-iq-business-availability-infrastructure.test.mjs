import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { Miniflare } from "miniflare";

import {
  ROUTE_IQ_BUSINESS_AVAILABILITY_BINDING,
  ROUTE_IQ_BUSINESS_AVAILABILITY_ENV,
  ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES,
  ROUTE_IQ_BUSINESS_AVAILABILITY_MIGRATION,
  ROUTE_IQ_BUSINESS_AVAILABILITY_PATH,
  ROUTE_IQ_BUSINESS_AVAILABILITY_PRODUCER_BINDING,
  ROUTE_IQ_BUSINESS_AVAILABILITY_SCHEDULE,
  ROUTE_IQ_BUSINESS_AVAILABILITY_VERSIONS,
  getRouteIqBusinessAvailabilityActivation,
  routeIqBusinessAvailabilityCanonicalJson,
  routeIqBusinessAvailabilitySha256,
  validateRouteIqBusinessAvailabilitySnapshot
} from "../workers/infrastructure/route-iq-business-availability-contract.js";
import {
  CRASH_AFTER_PROJECTION_COMMIT,
  CRASH_AFTER_CANONICAL,
  CRASH_BEFORE_CANONICAL,
  NONCANONICAL_TEST_MODE
} from "../workers/infrastructure/route-iq-business-availability-durable-object.js";
import {
  handleRouteIqBusinessAvailabilityRequest,
  runRouteIqBusinessAvailabilityScheduledRefresh
} from "../workers/infrastructure/route-iq-business-availability-runtime.js";

const root = resolve(import.meta.dirname, "..");
const providerContractVersion = "route-iq-business-hours-provider-response.v1";
const providerId = "governed_provider";

function fixtureSha(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function fixtureScope(index = 0) {
  const suffix = String(index).padStart(2, "0");
  return {
    workspaceId: `workspace_${suffix}`,
    operatingProfileId: `profile_${suffix}`,
    manifestId: `manifest_${suffix}`,
    manifestVersion: ROUTE_IQ_BUSINESS_AVAILABILITY_VERSIONS.manifest,
    manifestArtifactSha256: fixtureSha(`manifest:${suffix}`),
    configurationVersion: `configuration-v1.${suffix}`,
    approvalState: "APPROVED",
    classification: "FOUNDER_FIELD_RESEARCH",
    productionUseAuthorized: true,
    territoryIds: [`territory_${suffix}`],
    allowedProviderIds: [providerId],
    allowedProviderContractVersions: [providerContractVersion],
    dataProjectionVersion: ROUTE_IQ_BUSINESS_AVAILABILITY_VERSIONS.dataProjection
  };
}

function fixtureActivation(scopes = [fixtureScope()], now = new Date()) {
  return {
    schemaVersion: ROUTE_IQ_BUSINESS_AVAILABILITY_VERSIONS.activation,
    configurationVersion: "route-iq-business-availability-noncanonical-test.v1",
    state: "ON",
    workerName: "prometheus-iq",
    issuedAt: new Date(now.getTime() - 60_000).toISOString(),
    expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    scheduleCron: ROUTE_IQ_BUSINESS_AVAILABILITY_SCHEDULE,
    maximumFreshnessHours: 24,
    producerBinding: ROUTE_IQ_BUSINESS_AVAILABILITY_PRODUCER_BINDING,
    scopes
  };
}

function activeEnv(activation, extras = {}) {
  return {
    [ROUTE_IQ_BUSINESS_AVAILABILITY_ENV.mode]: "ON",
    [ROUTE_IQ_BUSINESS_AVAILABILITY_ENV.activation]: JSON.stringify(activation),
    ...extras
  };
}

function localEvent(scope, hour = "17:00") {
  return {
    localDate: "2026-07-23",
    localTime: hour,
    displayTime: "5:00 PM",
    timeZone: "America/Chicago",
    source: "weekly"
  };
}

async function fixtureRecord({
  scope,
  businessId,
  generatedAt,
  status = "OPEN_VERIFIED",
  freshnessState = "FRESH"
}) {
  const record = {
    schemaVersion: ROUTE_IQ_BUSINESS_AVAILABILITY_VERSIONS.record,
    businessId,
    territoryId: scope.territoryIds[0],
    timeZone: "America/Chicago",
    weeklyPeriods: [{
      openDay: 4,
      openTime: "09:00",
      closeDay: 4,
      closeTime: "17:00"
    }],
    specialPeriods: [],
    appointmentWindows: [],
    open24Hours: false,
    appointmentOnly: false,
    currentStatus: status,
    currentStatusEvaluatedAt: generatedAt,
    currentEffectiveInterval: status === "OPEN_VERIFIED" ? {
      source: "weekly",
      twentyFourHours: false,
      start: localEvent(scope, "09:00"),
      end: localEvent(scope, "17:00")
    } : null,
    nextOpening: status === "CLOSED_VERIFIED" ? localEvent(scope, "09:00") : null,
    nextClosing: status === "OPEN_VERIFIED" ? localEvent(scope, "17:00") : null,
    sourceRetrievedAt: generatedAt,
    verifiedAt: freshnessState === "MISSING" ? null : generatedAt,
    evidenceExpiresAt: freshnessState === "FRESH"
      ? new Date(Date.parse(generatedAt) + 12 * 60 * 60 * 1000).toISOString()
      : new Date(Date.parse(generatedAt) - 60 * 60 * 1000).toISOString(),
    freshnessState,
    provenance: {
      providerId,
      providerContractVersion,
      providerRecordId: `provider.${businessId}`,
      providerAdapterVersion: ROUTE_IQ_BUSINESS_AVAILABILITY_VERSIONS.providerAdapter,
      normalizationInputVersion: ROUTE_IQ_BUSINESS_AVAILABILITY_VERSIONS.normalizationInput,
      dataProjectionVersion: ROUTE_IQ_BUSINESS_AVAILABILITY_VERSIONS.dataProjection,
      normalizedAt: generatedAt
    },
    recordSha256: ""
  };
  const hashInput = structuredClone(record);
  delete hashInput.recordSha256;
  record.recordSha256 = await routeIqBusinessAvailabilitySha256(
    routeIqBusinessAvailabilityCanonicalJson(hashInput)
  );
  return record;
}

async function fixtureSnapshot({
  scope = fixtureScope(),
  refreshBatchId = `riq_refresh_${"1".repeat(32)}`,
  now = new Date(),
  status = "OPEN_VERIFIED",
  freshnessState = "FRESH",
  mutation
} = {}) {
  const generatedAt = new Date(now.getTime() - 1_000).toISOString();
  const businessIds = ["business_alpha", "business_beta"];
  const records = [];
  for (const businessId of businessIds) {
    records.push(await fixtureRecord({
      scope,
      businessId,
      generatedAt,
      status,
      freshnessState
    }));
  }
  const snapshot = {
    schemaVersion: ROUTE_IQ_BUSINESS_AVAILABILITY_VERSIONS.snapshot,
    producerSubsystem: "Prometheus Data",
    refreshBatchId,
    workspaceId: scope.workspaceId,
    operatingProfileId: scope.operatingProfileId,
    manifest: {
      manifestId: scope.manifestId,
      manifestVersion: scope.manifestVersion,
      artifactSha256: scope.manifestArtifactSha256,
      configurationVersion: scope.configurationVersion,
      approvalState: scope.approvalState,
      classification: scope.classification,
      productionUseAuthorized: true,
      approvedRecordCount: businessIds.length,
      approvedRecordIds: businessIds
    },
    source: {
      providerId,
      providerContractVersion,
      providerAdapterVersion: ROUTE_IQ_BUSINESS_AVAILABILITY_VERSIONS.providerAdapter,
      normalizationInputVersion: ROUTE_IQ_BUSINESS_AVAILABILITY_VERSIONS.normalizationInput,
      dataProjectionVersion: ROUTE_IQ_BUSINESS_AVAILABILITY_VERSIONS.dataProjection,
      retrievedAt: generatedAt
    },
    generatedAt,
    expiresAt: new Date(now.getTime() + 23 * 60 * 60 * 1000).toISOString(),
    recordCount: records.length,
    records,
    canonicalPayloadSha256: ""
  };
  mutation?.(snapshot);
  const hashInput = structuredClone(snapshot);
  delete hashInput.canonicalPayloadSha256;
  snapshot.canonicalPayloadSha256 = await routeIqBusinessAvailabilitySha256(
    routeIqBusinessAvailabilityCanonicalJson(hashInput)
  );
  return snapshot;
}

function fakeNamespace(stubFactory) {
  const calls = {
    idFromName: [],
    get: []
  };
  return {
    calls,
    idFromName(name) {
      calls.idFromName.push(name);
      return name;
    },
    get(id) {
      calls.get.push(id);
      return stubFactory(id);
    }
  };
}

function readAuthorization(scope, territoryIds = scope.territoryIds) {
  return {
    principal: {
      authorized: true,
      workspaceId: scope.workspaceId,
      operatingProfileId: scope.operatingProfileId,
      territoryIds
    }
  };
}

test("OFF and malformed startup paths perform zero provider, coordinator, timer, or authorization work", async () => {
  let touched = 0;
  const guardedEnv = new Proxy({
    [ROUTE_IQ_BUSINESS_AVAILABILITY_ENV.mode]: "OFF"
  }, {
    get(target, property) {
      if ([
        ROUTE_IQ_BUSINESS_AVAILABILITY_BINDING,
        ROUTE_IQ_BUSINESS_AVAILABILITY_PRODUCER_BINDING
      ].includes(property)) touched += 1;
      return target[property];
    }
  });
  const response = await handleRouteIqBusinessAvailabilityRequest(
    new Request(`https://private.invalid${ROUTE_IQ_BUSINESS_AVAILABILITY_PATH}`),
    guardedEnv,
    {
      testHooks: {
        enabled: true,
        authorizeRequest() {
          touched += 1;
        }
      }
    }
  );
  const scheduled = await runRouteIqBusinessAvailabilityScheduledRefresh({
    cron: ROUTE_IQ_BUSINESS_AVAILABILITY_SCHEDULE,
    scheduledTime: Date.now()
  }, guardedEnv);
  assert.equal(response.status, 404);
  assert.equal(scheduled.state, "OFF");
  assert.equal(touched, 0);

  for (const mode of ["UNKNOWN", "on", "TRUE"]) {
    const invalid = await handleRouteIqBusinessAvailabilityRequest(
      new Request(`https://private.invalid${ROUTE_IQ_BUSINESS_AVAILABILITY_PATH}`),
      { [ROUTE_IQ_BUSINESS_AVAILABILITY_ENV.mode]: mode },
      {
        testHooks: {
          enabled: true,
          authorizeRequest() {
            touched += 1;
          }
        }
      }
    );
    assert.equal(invalid.status, 503);
  }
  assert.equal(touched, 0);
});

test("missing, stale, malformed, and unauthorized activation fails before Durable Object lookup", async () => {
  const now = new Date();
  const scope = fixtureScope();
  const namespace = fakeNamespace(() => {
    throw new Error("coordinator must not be reached");
  });
  const cases = [
    activeEnv(fixtureActivation([scope], now), {
      [ROUTE_IQ_BUSINESS_AVAILABILITY_ENV.activation]: ""
    }),
    activeEnv({
      ...fixtureActivation([scope], now),
      expiresAt: new Date(now.getTime() - 1).toISOString()
    }),
    activeEnv({
      ...fixtureActivation([scope], now),
      maximumFreshnessHours: 168
    }),
    activeEnv(fixtureActivation([scope], now))
  ];
  for (const [index, env] of cases.entries()) {
    env[ROUTE_IQ_BUSINESS_AVAILABILITY_BINDING] = namespace;
    const response = await handleRouteIqBusinessAvailabilityRequest(
      new Request(`https://private.invalid${ROUTE_IQ_BUSINESS_AVAILABILITY_PATH}`),
      env,
      {
        testHooks: {
          enabled: true,
          currentDate: now,
          authorizeRequest: async () => index === cases.length - 1
            ? readAuthorization({ ...scope, workspaceId: "other_workspace" })
            : readAuthorization(scope)
        }
      }
    );
    assert.equal(response.status >= 400, true);
  }
  assert.equal(namespace.calls.idFromName.length, 0);
  assert.equal(namespace.calls.get.length, 0);
});

test("read path is GET and HEAD only and derives exact workspace, profile, and territory scope", async () => {
  const now = new Date();
  const scope = fixtureScope();
  const namespace = fakeNamespace(() => ({
    async readLatestSnapshot(command) {
      assert.deepEqual(command.scope, scope);
      assert.deepEqual(command.authorizedTerritoryIds, scope.territoryIds);
      return {
        contractVersion: ROUTE_IQ_BUSINESS_AVAILABILITY_VERSIONS.read,
        workspaceId: scope.workspaceId,
        operatingProfileId: scope.operatingProfileId,
        records: []
      };
    }
  }));
  const env = activeEnv(fixtureActivation([scope], now), {
    [ROUTE_IQ_BUSINESS_AVAILABILITY_BINDING]: namespace
  });
  const testHooks = {
    enabled: true,
    currentDate: now,
    authorizeRequest: async () => readAuthorization(scope)
  };
  const get = await handleRouteIqBusinessAvailabilityRequest(
    new Request(`https://private.invalid${ROUTE_IQ_BUSINESS_AVAILABILITY_PATH}`),
    env,
    { testHooks }
  );
  const head = await handleRouteIqBusinessAvailabilityRequest(
    new Request(`https://private.invalid${ROUTE_IQ_BUSINESS_AVAILABILITY_PATH}`, { method: "HEAD" }),
    env,
    { testHooks }
  );
  const post = await handleRouteIqBusinessAvailabilityRequest(
    new Request(`https://private.invalid${ROUTE_IQ_BUSINESS_AVAILABILITY_PATH}`, { method: "POST" }),
    env,
    { testHooks }
  );
  assert.equal(get.status, 200);
  assert.equal((await get.json()).availability.workspaceId, scope.workspaceId);
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
  assert.equal(post.status, 405);
  assert.equal(namespace.calls.get.length, 2);

  const wrongTerritory = await handleRouteIqBusinessAvailabilityRequest(
    new Request(`https://private.invalid${ROUTE_IQ_BUSINESS_AVAILABILITY_PATH}`),
    env,
    {
      testHooks: {
        ...testHooks,
        authorizeRequest: async () => readAuthorization(scope, ["territory_other"])
      }
    }
  );
  assert.equal(wrongTerritory.status, 403);
  assert.equal(namespace.calls.get.length, 2);
});

test("snapshot contract enforces manifest, source, completeness, and the 24-hour ceiling", async () => {
  const now = new Date();
  const scope = fixtureScope();
  const valid = await fixtureSnapshot({ scope, now });
  await assert.doesNotReject(validateRouteIqBusinessAvailabilitySnapshot(valid, scope, { now }));

  const mutations = [
    snapshot => {
      snapshot.manifest.artifactSha256 = fixtureSha("wrong");
    },
    snapshot => {
      snapshot.source.providerId = "unapproved_provider";
      snapshot.records.forEach(record => {
        record.provenance.providerId = "unapproved_provider";
      });
    },
    snapshot => {
      snapshot.manifest.approvedRecordIds = ["business_alpha"];
      snapshot.manifest.approvedRecordCount = 1;
    },
    snapshot => {
      snapshot.expiresAt = new Date(now.getTime() + 25 * 60 * 60 * 1000).toISOString();
    },
    snapshot => {
      snapshot.manifest.approvedRecordIds[0] = "123 Main Street";
      snapshot.records[0].businessId = "123 Main Street";
    }
  ];
  for (const mutation of mutations) {
    const invalid = await fixtureSnapshot({ scope, now, mutation });
    await assert.rejects(
      validateRouteIqBusinessAvailabilitySnapshot(invalid, scope, { now }),
      error => [
        ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.manifestMismatch,
        ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.sourceUnauthorized,
        ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.snapshotInvalid
      ].includes(error?.code)
    );
  }
});

test("scheduled refresh uses one GET-only Data producer boundary and deterministic batches", async () => {
  const now = new Date();
  const scope = fixtureScope();
  const accepted = [];
  const providerCalls = [];
  const namespace = fakeNamespace(() => ({
    async acceptNormalizedSnapshot(command) {
      accepted.push(command);
      return { status: "ACCEPTED" };
    },
    async recordRefreshFailure() {
      throw new Error("failure should not be recorded");
    }
  }));
  const producer = {
    async fetch(request) {
      providerCalls.push({
        method: request.method,
        hasBody: request.body !== null,
        redirect: request.redirect
      });
      throw new Error("test hook should supply the Data projection");
    }
  };
  const activation = fixtureActivation([scope], now);
  const env = activeEnv(activation, {
    [ROUTE_IQ_BUSINESS_AVAILABILITY_BINDING]: namespace,
    [ROUTE_IQ_BUSINESS_AVAILABILITY_PRODUCER_BINDING]: producer
  });
  const batches = [];
  const testHooks = {
    enabled: true,
    currentDate: now,
    scheduledTime: now.getTime(),
    async produceSnapshot({ refreshBatchId }) {
      batches.push(refreshBatchId);
      return {
        ok: true,
        snapshot: await fixtureSnapshot({ scope, refreshBatchId, now })
      };
    }
  };
  const first = await runRouteIqBusinessAvailabilityScheduledRefresh({
    cron: ROUTE_IQ_BUSINESS_AVAILABILITY_SCHEDULE,
    scheduledTime: now.getTime()
  }, env, { testHooks });
  const second = await runRouteIqBusinessAvailabilityScheduledRefresh({
    cron: ROUTE_IQ_BUSINESS_AVAILABILITY_SCHEDULE,
    scheduledTime: now.getTime()
  }, env, { testHooks });
  assert.equal(first.accepted, 1);
  assert.equal(second.accepted, 1);
  assert.equal(batches[0], batches[1]);
  assert.equal(accepted[0].snapshot.refreshBatchId, batches[0]);
  assert.equal(providerCalls.length, 0);
});

test("provider and Data failures are fixed-code audit events and never replace accepted evidence", async () => {
  const now = new Date();
  const scope = fixtureScope();
  const failures = [];
  const namespace = fakeNamespace(() => ({
    async acceptNormalizedSnapshot() {
      throw new Error("failed producer must not accept a snapshot");
    },
    async recordRefreshFailure(command) {
      failures.push(command);
      return { status: "FAILURE_RECORDED" };
    }
  }));
  const producer = {
    async fetch() {
      throw new Error("not used by injected failure");
    }
  };
  const env = activeEnv(fixtureActivation([scope], now), {
    [ROUTE_IQ_BUSINESS_AVAILABILITY_BINDING]: namespace,
    [ROUTE_IQ_BUSINESS_AVAILABILITY_PRODUCER_BINDING]: producer
  });
  const result = await runRouteIqBusinessAvailabilityScheduledRefresh({
    cron: ROUTE_IQ_BUSINESS_AVAILABILITY_SCHEDULE,
    scheduledTime: now.getTime()
  }, env, {
    testHooks: {
      enabled: true,
      currentDate: now,
      scheduledTime: now.getTime(),
      async produceSnapshot() {
        return { ok: false, failure: "producer_unavailable" };
      }
    }
  });
  assert.equal(result.accepted, 0);
  assert.equal(result.failed, 1);
  assert.equal(failures.length, 1);
  assert.equal(failures[0].reasonCode, "PROVIDER_UNAVAILABLE");
  assert.equal(Object.hasOwn(failures[0], "snapshot"), false);
});

test("ten workspaces, 100 principals, and 25 concurrent reads stay isolated", async () => {
  const now = new Date();
  const scopes = Array.from({ length: 10 }, (_, index) => fixtureScope(index));
  const activation = fixtureActivation(scopes, now);
  const namespace = fakeNamespace(instanceName => ({
    async readLatestSnapshot(command) {
      assert.equal(instanceName, `${command.scope.workspaceId}\u0000${command.scope.operatingProfileId}`);
      return {
        contractVersion: ROUTE_IQ_BUSINESS_AVAILABILITY_VERSIONS.read,
        workspaceId: command.scope.workspaceId,
        operatingProfileId: command.scope.operatingProfileId,
        authorizedTerritoryIds: command.authorizedTerritoryIds,
        records: []
      };
    }
  }));
  const env = activeEnv(activation, {
    [ROUTE_IQ_BUSINESS_AVAILABILITY_BINDING]: namespace
  });
  const users = Array.from({ length: 100 }, (_, index) => ({
    userId: `user_${String(index).padStart(3, "0")}`,
    scope: scopes[index % scopes.length]
  }));
  assert.equal(new Set(users.map(user => user.userId)).size, 100);
  const responses = await Promise.all(users.slice(0, 25).map(async user => {
    const response = await handleRouteIqBusinessAvailabilityRequest(
      new Request(`https://private.invalid${ROUTE_IQ_BUSINESS_AVAILABILITY_PATH}`),
      env,
      {
        testHooks: {
          enabled: true,
          currentDate: now,
          authorizeRequest: async () => readAuthorization(user.scope)
        }
      }
    );
    return {
      expected: user.scope.workspaceId,
      status: response.status,
      body: await response.json()
    };
  }));
  responses.forEach(result => {
    assert.equal(result.status, 200);
    assert.equal(result.body.availability.workspaceId, result.expected);
  });
  assert.equal(namespace.calls.idFromName.length, 25);
});

const miniflareHarness = `
export { RouteIqBusinessAvailabilityCoordinator } from "./workers/infrastructure/route-iq-business-availability-durable-object.js";

const methods = new Set([
  "acceptNormalizedSnapshot",
  "recordRefreshFailure",
  "readLatestSnapshot",
  "readMonitoringSummary"
]);

export default {
  async fetch(request, env) {
    const body = await request.json();
    if (!methods.has(body.method)) return Response.json({ ok: false }, { status: 400 });
    const stub = env.ROUTE_IQ_BUSINESS_AVAILABILITY_COORDINATOR.getByName(body.instanceName);
    try {
      return Response.json({ ok: true, result: await stub[body.method](body.command) });
    } catch (error) {
      return Response.json({
        ok: false,
        code: error.code || null,
        status: error.status || null,
        message: error.message
      }, { status: 599 });
    }
  }
};
`;

function createMiniflare(persistencePath) {
  return new Miniflare({
    modules: true,
    modulesRules: [{ type: "ESModule", include: ["**/*.js", "**/*.mjs"] }],
    modulesRoot: root,
    script: miniflareHarness,
    scriptPath: join(root, "route-iq-business-availability-noncanonical-test-harness.mjs"),
    compatibilityDate: "2026-07-15",
    compatibilityFlags: ["nodejs_compat"],
    durableObjects: {
      [ROUTE_IQ_BUSINESS_AVAILABILITY_BINDING]: {
        className: "RouteIqBusinessAvailabilityCoordinator",
        useSQLite: true
      }
    },
    durableObjectsPersist: persistencePath,
    bindings: {
      [NONCANONICAL_TEST_MODE]: "ON"
    }
  });
}

async function rpc(miniflare, instanceName, method, command) {
  const response = await miniflare.dispatchFetch("https://noncanonical.invalid/rpc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ instanceName, method, command })
  });
  return { status: response.status, body: await response.json() };
}

test("real SQLite coordinator is concurrent-idempotent and durably rejects changed retries", async () => {
  const persistencePath = mkdtempSync(join(tmpdir(), "route-iq-availability-do-"));
  const miniflare = createMiniflare(persistencePath);
  try {
    const scope = fixtureScope();
    const snapshot = await fixtureSnapshot({ scope });
    const instanceName = `availability-${randomUUID()}`;
    const command = {
      scope,
      snapshot,
      noncanonicalCrashBoundary: null
    };
    const results = await Promise.all(
      Array.from({ length: 25 }, () => rpc(
        miniflare,
        instanceName,
        "acceptNormalizedSnapshot",
        command
      ))
    );
    results.forEach(result => {
      assert.equal(result.body.ok, true, JSON.stringify(result.body));
      assert.deepEqual(result.body.result, results[0].body.result);
    });
    const monitoring = await rpc(miniflare, instanceName, "readMonitoringSummary", { scope });
    assert.equal(monitoring.body.result.acceptedSnapshots, 1);
    assert.equal(monitoring.body.result.conflicts, 0);
    for (const [changedScope, expectedCode] of [
      [{ ...scope, workspaceId: "workspace_other" }, ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.scopeUnauthorized],
      [{ ...scope, operatingProfileId: "profile_other" }, ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.scopeUnauthorized],
      [{ ...scope, manifestId: "manifest_other" }, ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.noSnapshot],
      [{
        ...scope,
        manifestArtifactSha256: fixtureSha("other-manifest")
      }, ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.noSnapshot]
    ]) {
      const isolatedRead = await rpc(miniflare, instanceName, "readLatestSnapshot", {
        scope: changedScope,
        authorizedTerritoryIds: changedScope.territoryIds
      });
      assert.equal(isolatedRead.body.ok, false);
      assert.equal(isolatedRead.body.code, expectedCode);
    }

    const changed = await fixtureSnapshot({
      scope,
      refreshBatchId: snapshot.refreshBatchId,
      mutation(value) {
        value.expiresAt = new Date(Date.parse(value.expiresAt) - 60_000).toISOString();
      }
    });
    const conflict = await rpc(miniflare, instanceName, "acceptNormalizedSnapshot", {
      scope,
      snapshot: changed,
      noncanonicalCrashBoundary: null
    });
    assert.equal(conflict.body.ok, false);
    assert.equal(conflict.body.code, ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.snapshotConflict);
    const afterConflict = await rpc(miniflare, instanceName, "readMonitoringSummary", { scope });
    assert.equal(afterConflict.body.result.acceptedSnapshots, 1);
    assert.equal(afterConflict.body.result.conflicts, 1);
  } finally {
    await miniflare.dispose();
    rmSync(persistencePath, { recursive: true, force: true });
  }
});

test("every persistence boundary survives interruption and restart without partial canonical state", async t => {
  for (const [boundary, expectedCode, acceptedAfterCrash] of [
    [CRASH_BEFORE_CANONICAL, "noncanonical_crash_before_canonical", 0],
    [CRASH_AFTER_CANONICAL, "noncanonical_crash_after_canonical", 1],
    [CRASH_AFTER_PROJECTION_COMMIT, "noncanonical_crash_after_projection_commit", 1]
  ]) {
    await t.test(boundary, async () => {
      const persistencePath = mkdtempSync(join(tmpdir(), "route-iq-availability-recovery-"));
      const scope = fixtureScope();
      const snapshot = await fixtureSnapshot({ scope });
      const instanceName = `availability-${randomUUID()}`;
      let miniflare = createMiniflare(persistencePath);
      try {
        const interrupted = await rpc(miniflare, instanceName, "acceptNormalizedSnapshot", {
          scope,
          snapshot,
          noncanonicalCrashBoundary: boundary
        });
        assert.equal(interrupted.body.ok, false);
        assert.equal(interrupted.body.code, expectedCode);
      } finally {
        await miniflare.dispose();
      }

      miniflare = createMiniflare(persistencePath);
      try {
        const beforeRetry = await rpc(miniflare, instanceName, "readMonitoringSummary", { scope });
        assert.equal(beforeRetry.body.result.acceptedSnapshots, acceptedAfterCrash);
        const recovered = await rpc(miniflare, instanceName, "acceptNormalizedSnapshot", {
          scope,
          snapshot,
          noncanonicalCrashBoundary: null
        });
        assert.equal(recovered.body.ok, true, JSON.stringify(recovered.body));
        const read = await rpc(miniflare, instanceName, "readLatestSnapshot", {
          scope,
          authorizedTerritoryIds: scope.territoryIds
        });
        assert.equal(read.body.ok, true, JSON.stringify(read.body));
        assert.equal(read.body.result.snapshot.canonicalPayloadSha256, snapshot.canonicalPayloadSha256);
        assert.equal(read.body.result.snapshot.canonicalRecordCount, 2);
        assert.equal(read.body.result.snapshot.returnedRecordCount, 2);
        const monitoring = await rpc(miniflare, instanceName, "readMonitoringSummary", { scope });
        assert.equal(monitoring.body.result.acceptedSnapshots, 1);
        assert.equal(monitoring.body.result.pendingOutbox, 0);
      } finally {
        await miniflare.dispose();
        rmSync(persistencePath, { recursive: true, force: true });
      }
    });
  }
});

test("refresh failure is append-only and does not replace the latest accepted snapshot", async () => {
  const persistencePath = mkdtempSync(join(tmpdir(), "route-iq-availability-failure-"));
  const miniflare = createMiniflare(persistencePath);
  try {
    const scope = fixtureScope();
    const snapshot = await fixtureSnapshot({ scope });
    const instanceName = `availability-${randomUUID()}`;
    const accepted = await rpc(miniflare, instanceName, "acceptNormalizedSnapshot", {
      scope,
      snapshot,
      noncanonicalCrashBoundary: null
    });
    assert.equal(accepted.body.ok, true, JSON.stringify(accepted.body));
    const failureId = `riq_refresh_${"2".repeat(32)}`;
    const firstFailure = await rpc(miniflare, instanceName, "recordRefreshFailure", {
      scope,
      refreshBatchId: failureId,
      reasonCode: "PROVIDER_UNAVAILABLE"
    });
    const retryFailure = await rpc(miniflare, instanceName, "recordRefreshFailure", {
      scope,
      refreshBatchId: failureId,
      reasonCode: "PROVIDER_UNAVAILABLE"
    });
    assert.equal(firstFailure.body.ok, true);
    assert.deepEqual(firstFailure.body.result, retryFailure.body.result);
    const read = await rpc(miniflare, instanceName, "readLatestSnapshot", {
      scope,
      authorizedTerritoryIds: scope.territoryIds
    });
    assert.equal(read.body.result.snapshot.canonicalPayloadSha256, snapshot.canonicalPayloadSha256);
    const monitoring = await rpc(miniflare, instanceName, "readMonitoringSummary", { scope });
    assert.equal(monitoring.body.result.acceptedSnapshots, 1);
    assert.equal(monitoring.body.result.failures, 1);
  } finally {
    await miniflare.dispose();
    rmSync(persistencePath, { recursive: true, force: true });
  }
});

test("configuration preserves existing private state and cannot affect the public Worker", () => {
  const privateConfig = readFileSync(join(root, "wrangler.jsonc"), "utf8");
  const publicConfig = readFileSync(join(root, "wrangler.prometheusrouteiq-website.jsonc"), "utf8");
  assert.match(privateConfig, new RegExp(ROUTE_IQ_BUSINESS_AVAILABILITY_BINDING));
  assert.match(privateConfig, new RegExp(ROUTE_IQ_BUSINESS_AVAILABILITY_MIGRATION));
  assert.match(privateConfig, /"ROUTE_IQ_BUSINESS_AVAILABILITY_MODE": "OFF"/u);
  assert.match(privateConfig, /ROUTE_IQ_PROSPECTIVE_SHADOW_COORDINATOR/u);
  assert.match(privateConfig, /route-iq-prospective-shadow-sqlite-v1/u);
  assert.equal(/"triggers"\s*:/u.test(privateConfig), false);
  assert.equal(publicConfig.includes(ROUTE_IQ_BUSINESS_AVAILABILITY_BINDING), false);
  assert.equal(publicConfig.includes("RouteIqBusinessAvailabilityCoordinator"), false);
});

test("fixed monitoring output cannot expose workspace, provider, business, or identity values", async () => {
  const now = new Date();
  const scope = fixtureScope();
  const messages = [];
  const originalInfo = console.info;
  console.info = value => messages.push(String(value));
  try {
    const result = await runRouteIqBusinessAvailabilityScheduledRefresh({
      cron: ROUTE_IQ_BUSINESS_AVAILABILITY_SCHEDULE,
      scheduledTime: now.getTime()
    }, {
      [ROUTE_IQ_BUSINESS_AVAILABILITY_ENV.mode]: "OFF"
    });
    assert.equal(result.state, "OFF");
  } finally {
    console.info = originalInfo;
  }
  const output = messages.join("\n");
  assert.equal(output.includes(scope.workspaceId), false);
  assert.equal(output.includes(scope.operatingProfileId), false);
  assert.equal(output.includes(providerId), false);
  assert.equal(output.includes("business_alpha"), false);
  assert.equal(output.includes("secret"), false);
});

test("Infrastructure runtime scope contains no retired-customer literal or deployable fallback catalog", () => {
  const files = [
    "workers/infrastructure/route-iq-business-availability-contract.js",
    "workers/infrastructure/route-iq-business-availability-durable-object.js",
    "workers/infrastructure/route-iq-business-availability-runtime.js",
    "workers/infrastructure/shared-lead-intake-pipeline.js",
    "workers/prometheus-iq-worker.js",
    "wrangler.jsonc"
  ];
  const retiredIdentifier = ["smooth", "ie", "_", "depot"].join("");
  const retiredDisplay = ["Smooth", "ie", " ", "Depot"].join("");
  for (const file of files) {
    const source = readFileSync(join(root, file), "utf8");
    assert.equal(source.toLowerCase().includes(retiredIdentifier), false, file);
    assert.equal(source.toLowerCase().includes(retiredDisplay.toLowerCase()), false, file);
    assert.equal(/demoFallbackAllowed\s*:\s*true/u.test(source), false, file);
  }
});

test("activation parser admits exact governed classifications without turning classification into identity", () => {
  const now = new Date();
  const scope = fixtureScope();
  const activation = getRouteIqBusinessAvailabilityActivation(
    activeEnv(fixtureActivation([scope], now)),
    { now }
  );
  assert.equal(activation.active, true);
  assert.equal(activation.scopes[0].workspaceId, scope.workspaceId);
  assert.equal(activation.scopes[0].classification, "FOUNDER_FIELD_RESEARCH");
  assert.notEqual(activation.scopes[0].workspaceId, activation.scopes[0].classification.toLowerCase());
});
