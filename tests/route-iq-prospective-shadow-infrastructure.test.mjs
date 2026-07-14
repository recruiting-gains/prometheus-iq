import test from "node:test";
import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, randomBytes, randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { Miniflare } from "miniflare";
import { SignJWT, createLocalJWKSet, exportJWK } from "jose";

import worker, {
  ROUTE_IQ_FIELD_SESSION_HANDOFF_PATH,
  ROUTE_IQ_PROSPECTIVE_SHADOW_PATH,
  RouteIqProspectiveShadowCoordinator,
  handleRouteIqFieldSessionHandoff
} from "../workers/prometheus-iq-worker.js";
import {
  consumeRouteIqEndOfDayHandoff,
  deriveRouteIqCandidateIdFromGooglePlaceId,
  projectCommittedRouteIqFieldSessionOutcomes,
  readRouteIqFieldSessionArchive,
  routeIqEndOfDayHandoffContractId,
  routeIqFieldSessionStoreBinding
} from "../data/route-iq-field-sessions-v1/route-iq-field-session-archive.mjs";
import {
  routeIqProspectiveCohortConfigVersion,
  routeIqProspectivePrincipalMapVersion
} from "../workers/infrastructure/route-iq-prospective-shadow-access.js";
import {
  createRouteIqProspectiveAuthorityEnvelope,
  createRouteIqProspectiveAuthorityVerifier
} from "../workers/infrastructure/route-iq-prospective-shadow-authority.js";
import {
  ROUTE_IQ_PROSPECTIVE_ACTION_ACKNOWLEDGMENT,
  ROUTE_IQ_PROSPECTIVE_ALLOCATOR_ACKNOWLEDGMENT,
  ROUTE_IQ_PROSPECTIVE_GOVERNED_NOOP_ACKNOWLEDGMENT,
  ROUTE_IQ_PROSPECTIVE_HANDOFF_CONTRACT,
  ROUTE_IQ_PROSPECTIVE_SHADOW_BINDING,
  ROUTE_IQ_PROSPECTIVE_SHADOW_CLASS,
  ROUTE_IQ_PROSPECTIVE_SHADOW_ENV,
  sha256Hex
} from "../workers/infrastructure/route-iq-prospective-shadow-contract.js";
import {
  closeRouteIqProspectiveSessionFromHandoff,
  handleRouteIqProspectiveShadowRequest
} from "../workers/infrastructure/route-iq-prospective-shadow-runtime.js";
import {
  linkRouteIqProspectiveServerAction,
  orchestrateRouteIqProspectiveNextStop
} from "../workers/infrastructure/route-iq-prospective-shadow-orchestration.js";

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

function territoryContext(representativeId = "cruz") {
  return {
    status: "known",
    territoryId: `riq_territory_${digest(`territory:${representativeId}`)}`,
    sourceRecordSha256: digest(`territory-source:${representativeId}`),
    sourceContractVersion: "route-iq-trusted-territory-context-v1",
    availableAt: "2026-07-12T18:00:00.000Z"
  };
}

async function principalMap(subject, representativeId = "cruz") {
  return JSON.stringify({
    version: routeIqProspectivePrincipalMapVersion,
    principals: [{
      accessSubjectSha256: await sha256Hex(subject),
      ...scope(representativeId),
      registryVersion: "noncanonical-test-registry-v1",
      territoryContext: territoryContext(representativeId)
    }]
  });
}

async function accessFixture({
  mappedRepresentativeId = "cruz",
  cohortRepresentativeId = "cruz",
  expired = false,
  tokenAudience = accessAudience,
  closeImplementation = null,
  reconciliationImplementation = null,
  allocationAuthoritativeRecordTime = testNow.toISOString(),
  lifecycleDates = null
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
  const commands = [];
  const opportunityId = `riq_opportunity_${digest("private-opportunity")}`;
  const canonicalContext = {
    territoryId: territoryContext(mappedRepresentativeId).territoryId,
    canonicalSessionRecordSha256: digest("private-session-record"),
    sessionEventSequence: 0,
    opportunityEventSequence: 0,
    triggerRecordSha256: digest("private-trigger-record"),
    canonicalEventBoundarySha256: digest("private-trigger-boundary")
  };
  let runtimeState = "TRIGGERED";
  const runtimeContext = () => {
    const body = {
      runtimeContextContractVersion: "route-iq-prospective-runtime-context-v1",
      authority: "sqlite_durable_object_coordinator",
      coordinatorId: `riq_coordinator_${digest("private-coordinator")}`,
      scope: scope(mappedRepresentativeId),
      opportunityId,
      opportunityType: "next_stop",
      state: runtimeState,
      canonicalContext,
      completedCandidateIds: [],
      territorySource: territoryContext(mappedRepresentativeId),
      candidateCompletenessStatus: runtimeState === "TRIGGERED"
        ? "pending_authenticated_intelligence_manifest"
        : "authenticated_intelligence_manifest_present",
      recommendationInfluence: "off",
      collectionDefault: "off"
    };
    return { ...body, runtimeContextReceiptSha256: digest(JSON.stringify(body)) };
  };
  const env = {
    ...authorityEnv(),
    [ROUTE_IQ_PROSPECTIVE_SHADOW_ENV.collection]: "ON",
    [ROUTE_IQ_PROSPECTIVE_SHADOW_ENV.cohortConfig]: cohortConfig(cohortRepresentativeId),
    [ROUTE_IQ_PROSPECTIVE_SHADOW_ENV.accessTeamDomain]: testIssuer,
    [ROUTE_IQ_PROSPECTIVE_SHADOW_ENV.accessAudience]: accessAudience,
    [ROUTE_IQ_PROSPECTIVE_SHADOW_ENV.principalMap]: await principalMap(subject, mappedRepresentativeId),
    ASSETS: fieldSessionAssets(),
    [ROUTE_IQ_PROSPECTIVE_SHADOW_BINDING]: {
      getByName(name) {
        calls.push("do_lookup");
        names.push(name);
        return {
          async allocateNextStopOpportunity(command) {
            calls.push("allocator_rpc");
            commands.push(command);
            assert.equal(command.event.eventKind, "next_stop_requested");
            return {
              status: "recorded",
              sessionId: `riq_session_${digest("private-session")}`,
              opportunityId,
              operationKind: "server_allocate_next_stop",
              authoritativeRecordTime: allocationAuthoritativeRecordTime,
              candidateCompletenessStatus: "pending_authenticated_intelligence_manifest",
              canonicalContext
            };
          },
          async readCanonicalRuntimeContext(command) {
            calls.push("runtime_context_rpc");
            commands.push(command);
            return runtimeContext();
          },
          async recordRuntimeStageExclusion(command) {
            calls.push("runtime_exclusion_rpc");
            commands.push(command);
            runtimeState = "EXCLUDED";
            return { status: "excluded", state: "EXCLUDED" };
          },
          async applyTrustedCandidateManifest(command) {
            calls.push("candidate_manifest_rpc");
            commands.push(command);
            const claims = command.input.producerEnvelope.claims;
            runtimeState = "SNAPSHOT_PENDING_SEAL";
            return {
              coordinatorContractVersion: "route-iq-prospective-coordinator-contract-v1",
              operationKind: "candidate_manifest",
              state: runtimeState,
              opportunityId,
              artifactId: `riq_snapshot_${digest("private-snapshot")}`,
              recordSha256: digest("private-snapshot-record"),
              authoritativeRecordTime: command.input.authorityEnvelope.claims.authoritativeRecordTime,
              candidateManifestSha256: claims.candidateManifestSha256,
              completeManifestSha256: claims.completeManifestSha256,
              recommendationInfluence: "off",
              collectionDefault: "off"
            };
          },
          async applyTrustedSnapshotSeal(command) {
            calls.push("snapshot_seal_rpc");
            commands.push(command);
            runtimeState = "SNAPSHOT_SEALED";
            return {
              coordinatorContractVersion: "route-iq-prospective-coordinator-contract-v1",
              operationKind: "snapshot_seal",
              state: runtimeState,
              opportunityId,
              artifactId: `riq_snapshot_seal_${digest("private-snapshot-seal")}`,
              recordSha256: digest("private-snapshot-seal-record"),
              authoritativeRecordTime: command.input.authorityEnvelope.claims.authoritativeRecordTime,
              keyedSealVerified: true,
              recommendationInfluence: "off",
              collectionDefault: "off"
            };
          },
          async applyTrustedShadowDecisionSeal(command) {
            calls.push("shadow_decision_seal_rpc");
            commands.push(command);
            runtimeState = "SHADOW_DECISION_SEALED";
            return {
              coordinatorContractVersion: "route-iq-prospective-coordinator-contract-v1",
              operationKind: "shadow_decision_seal",
              state: runtimeState,
              opportunityId,
              artifactId: `riq_seal_${digest("private-shadow-seal")}`,
              recordSha256: digest("private-shadow-seal-record"),
              authoritativeRecordTime: command.input.authorityEnvelope.claims.authoritativeRecordTime,
              recommendationInfluence: "off",
              collectionDefault: "off"
            };
          },
          async linkServerDerivedNextStopAction(command) {
            calls.push("server_action_rpc");
            commands.push(command);
            runtimeState = "ACTION_LINKED";
            return { status: "recorded", state: runtimeState };
          },
          async reconcileCommittedFieldSessionOutcomes(command) {
            calls.push("field_session_reconciliation_rpc");
            commands.push(command);
            if (reconciliationImplementation) return reconciliationImplementation(command);
            return { status: "reconciled", linked: [], exclusions: [] };
          },
          async noteGovernedRepresentativeSignal(command) {
            calls.push("governed_noop_rpc");
            commands.push(command);
            assert.match(command.event.eventKind, /^representative_(action|outcome)_observed$/u);
            return { status: "governed_noop" };
          },
          async closeCanonicalSession(command) {
            calls.push("close_rpc");
            commands.push(command);
            assert.equal(command.authorityEnvelope.claims.purpose, "close_session");
            if (closeImplementation) return closeImplementation(command);
            return {
              status: "closed",
              sessionId: `riq_session_${digest("private-session")}`,
              requestSha256: digest("private-close-receipt")
            };
          }
        };
      }
    }
  };
  const noncanonicalTestHooks = {
    enabled: true,
    currentDate: testNow,
    lifecycleNow() {
      calls.push("lifecycle_server_clock");
      if (!lifecycleDates?.length) return new Date(testNow);
      const index = Math.min(
        calls.filter(call => call === "lifecycle_server_clock").length - 1,
        lifecycleDates.length - 1
      );
      return new Date(lifecycleDates[index]);
    },
    async keyResolver(...args) {
      calls.push("access_signature");
      return keyResolver(...args);
    }
  };
  return { env, token, names, calls, commands, noncanonicalTestHooks };
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

function lifecycleRecordTimes(commands) {
  const runtimeContext = commands.find(command =>
    command.input?.authorityEnvelope?.claims?.purpose === "runtime_context_read");
  const manifest = commands.find(command =>
    command.input?.authorityEnvelope?.claims?.purpose === "candidate_manifest");
  const snapshot = commands.find(command =>
    command.input?.authorityEnvelope?.claims?.purpose === "snapshot_seal_record");
  const shadow = commands.find(command =>
    command.input?.authorityEnvelope?.claims?.purpose === "shadow_decision_seal_record");
  assert.ok(runtimeContext && manifest && snapshot && shadow, "complete lifecycle commands must exist");
  return [
    runtimeContext.input.authorityEnvelope.claims.authoritativeRecordTime,
    manifest.input.producerEnvelope.claims.candidates[0].eligibility.evaluatedAt,
    manifest.input.producerEnvelope.claims.evidenceCutoff,
    manifest.input.authorityEnvelope.claims.authoritativeRecordTime,
    snapshot.input.authorityEnvelope.claims.authoritativeRecordTime,
    shadow.input.authorityEnvelope.claims.authoritativeRecordTime
  ];
}

function canonicalHandoff(representativeId = "cruz") {
  return {
    handoffContractId: ROUTE_IQ_PROSPECTIVE_HANDOFF_CONTRACT,
    sessionId: `route-iq-field-session-fitness-connection-fitness-${representativeId}-2026-07-11`,
    rawSha256: digest(`canonical-handoff-${representativeId}`),
    normalizedRecord: {
      handoffContractId: ROUTE_IQ_PROSPECTIVE_HANDOFF_CONTRACT,
      workspaceId: "fitness_connection",
      operatingProfileId: "fitness",
      verifiedFields: { representative: { id: representativeId } }
    }
  };
}

const canonicalFieldSessionReport = (() => {
  const source = JSON.parse(readFileSync(join(
    root,
    "data/route-iq-field-sessions-v1/workspaces/fitness_connection/sessions",
    "route-iq-field-session-fitness-connection-fitness-cruz-2026-07-11/raw",
    "prometheus-iq-cruz-daily-report-2026-07-11.json"
  ), "utf8"));
  source.visits = source.visits.map(visit => ({
    ...visit,
    visitDecisionSource: {
      sourceId: "unknown",
      reason: null,
      evidence: [],
      confidence: 0,
      capturedAt: source.generatedAt
    },
    recommendationDecisionContext: {
      recommendationAvailable: null,
      recommendationId: null,
      decision: null
    }
  }));
  return JSON.stringify(source, null, 2);
})();

function fieldSessionStore() {
  const data = new Map();
  return {
    data,
    async get(key) {
      return data.get(key) ?? null;
    },
    async put(key, value) {
      data.set(key, String(value));
    },
    async list({ prefix = "" } = {}) {
      return {
        keys: [...data.keys()].filter(key => key.startsWith(prefix)).sort().map(name => ({ name })),
        list_complete: true,
        cacheStatus: null
      };
    }
  };
}

function fieldSessionAssets() {
  return {
    async fetch(request) {
      const pathname = new URL(request.url).pathname.replace(/^\/+/, "");
      try {
        return new Response(readFileSync(join(root, "deploy/cloudflare-pages", pathname)), { status: 200 });
      } catch {
        return new Response("Not found", { status: 404 });
      }
    }
  };
}

function fieldSessionRequest(token, completionAction = "end_route") {
  return new Request(`https://private.invalid${ROUTE_IQ_FIELD_SESSION_HANDOFF_PATH}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "Cf-Access-Jwt-Assertion": token
    },
    body: JSON.stringify({
      completionAction,
      workspaceId: "fitness_connection",
      operatingProfileId: "fitness",
      finalExportConfirmed: true,
      sourceFinalizedAt: "2026-07-12T00:26:00.000Z",
      rawReportText: canonicalFieldSessionReport
    })
  });
}

function executionContextFixture() {
  const promises = [];
  return {
    promises,
    waitUntil(promise) {
      promises.push(Promise.resolve(promise));
    }
  };
}

function assertCanonicalFieldSessionAcknowledgment(response, body, expectedStatus) {
  assert.equal(response.status, expectedStatus);
  assert.equal(body.ok, true);
  assert.equal(body.acknowledged, true);
  assert.equal(body.acknowledgment.contractId, routeIqEndOfDayHandoffContractId);
  assert.equal(body.acknowledgment.status, expectedStatus === 200 ? "already_archived" : "archived");
  const serialized = JSON.stringify(body);
  for (const prohibited of [
    "prospective",
    "shadow",
    "candidate",
    "opportunity",
    "readiness",
    "recommendationInfluence"
  ]) {
    assert.equal(serialized.includes(prohibited), false, prohibited);
  }
}

async function submitFieldSession(fixture, store, executionContext, completionAction = "end_route") {
  const env = {
    ...fixture.env,
    [routeIqFieldSessionStoreBinding]: store,
    ASSETS: fieldSessionAssets()
  };
  const response = await handleRouteIqFieldSessionHandoff(
    fieldSessionRequest(fixture.token, completionAction),
    env,
    {
      executionContext,
      prospectiveTestHooks: fixture.noncanonicalTestHooks
    }
  );
  return { response, body: await response.json(), env };
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
  assert.ok(rpcNames.includes("allocateNextStopOpportunity"));
  assert.ok(rpcNames.includes("noteGovernedRepresentativeSignal"));
  assert.ok(rpcNames.includes("closeCanonicalSession"));
  for (const method of [
    "readCanonicalRuntimeContext",
    "recordRuntimeStageExclusion",
    "linkServerDerivedNextStopAction",
    "reconcileCommittedFieldSessionOutcomes",
    "admitIntelligenceScoreableOutcome",
    "admitIntelligenceEvaluation"
  ]) {
    assert.ok(rpcNames.includes(method), method);
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

test("valid Access precedes scope-only allocation and returns only opaque acknowledgments", async () => {
  const fixture = await accessFixture();
  const allocationContext = executionContextFixture();
  const first = await handleRouteIqProspectiveShadowRequest(
    eventRequest({ eventKind: "next_stop_requested", informationalSequence: 9 }, fixture.token),
    fixture.env,
    {
      executionContext: allocationContext,
      noncanonicalTestHooks: fixture.noncanonicalTestHooks
    }
  );
  const firstBody = await first.json();
  assert.equal(first.status, 202);
  assert.deepEqual(firstBody, ROUTE_IQ_PROSPECTIVE_ALLOCATOR_ACKNOWLEDGMENT);
  assert.ok(fixture.calls.indexOf("access_signature") < fixture.calls.indexOf("do_lookup"));
  assert.equal(fixture.calls.includes("allocator_rpc"), true);
  assert.equal(allocationContext.promises.length, 1);
  assert.deepEqual(await allocationContext.promises[0], { status: "shadow_decision_sealed" });
  for (const call of ["runtime_context_rpc", "candidate_manifest_rpc", "snapshot_seal_rpc", "shadow_decision_seal_rpc"]) {
    assert.equal(fixture.calls.includes(call), true, call);
  }
  assert.equal(fixture.calls.filter(call => call === "lifecycle_server_clock").length, 6);

  const actionContext = executionContextFixture();
  const second = await handleRouteIqProspectiveShadowRequest(
    eventRequest({
      eventKind: "representative_action_observed",
      informationalObservedAt: "2026-07-13T19:59:59.000Z"
    }, fixture.token),
    fixture.env,
    {
      executionContext: actionContext,
      noncanonicalTestHooks: fixture.noncanonicalTestHooks
    }
  );
  assert.equal(second.status, 202);
  assert.deepEqual(await second.json(), ROUTE_IQ_PROSPECTIVE_ACTION_ACKNOWLEDGMENT);
  assert.equal(actionContext.promises.length, 1);
  assert.equal((await actionContext.promises[0]).state, "ACTION_LINKED");
  assert.equal(fixture.calls.includes("server_action_rpc"), true);
  const third = await handleRouteIqProspectiveShadowRequest(
    eventRequest({ eventKind: "representative_outcome_observed" }, fixture.token),
    fixture.env,
    { noncanonicalTestHooks: fixture.noncanonicalTestHooks }
  );
  assert.equal(third.status, 202);
  assert.deepEqual(await third.json(), ROUTE_IQ_PROSPECTIVE_GOVERNED_NOOP_ACKNOWLEDGMENT);
  assert.equal(fixture.names.length, 3);
  assert.equal(fixture.names[0], fixture.names[1]);
  assert.equal(fixture.names[1], fixture.names[2]);

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

test("production lifecycle samples server Date at every stage and ignores stale allocation and client time", async () => {
  const fixture = await accessFixture();
  const stub = fixture.env[ROUTE_IQ_PROSPECTIVE_SHADOW_BINDING].getByName("production-clock-regression");
  const scopeEnvelope = await createRouteIqProspectiveAuthorityEnvelope({
    purpose: "coordinator_scope",
    ...scope(),
    registryVersion: "noncanonical-test-registry-v1",
    issuedAt: new Date(Date.now() - 120_000).toISOString(),
    territoryContext: territoryContext()
  }, fixture.env);
  const allocationReceipt = await stub.allocateNextStopOpportunity({
    scopeEnvelope,
    event: {
      eventKind: "next_stop_requested",
      informationalObservedAt: "2099-01-01T00:00:00.000Z"
    }
  });
  allocationReceipt.authoritativeRecordTime = new Date(Date.now() - 60_000).toISOString();
  fixture.commands.length = 0;
  const before = Date.now();
  const result = await orchestrateRouteIqProspectiveNextStop({
    stub,
    scopeEnvelope,
    scope: scope(),
    allocationReceipt,
    assetOrigin: "https://private.invalid/",
    env: fixture.env
  });
  const after = Date.now();
  assert.deepEqual(result, { status: "shadow_decision_sealed" });
  const times = lifecycleRecordTimes(fixture.commands);
  assert.equal(times.length, 6);
  assert.equal(times.every((value, index) => index === 0 || Date.parse(value) > Date.parse(times[index - 1])), true);
  assert.equal(Date.parse(times[0]) >= before, true);
  assert.equal(Date.parse(times.at(-1)) <= after + times.length, true);
  assert.equal(times.includes(allocationReceipt.authoritativeRecordTime), false);
  assert.equal(times.includes("2099-01-01T00:00:00.000Z"), false);
});

test("explicit noncanonical lifecycle clock is sampled per stage and future allocation fails before lifecycle RPC", async () => {
  const sampledDates = [
    "2026-07-13T20:00:10.000Z",
    "2026-07-13T20:00:10.000Z",
    "2026-07-13T20:00:10.000Z",
    "2026-07-13T20:00:11.000Z",
    "2026-07-13T20:00:11.000Z",
    "2026-07-13T20:00:12.000Z"
  ];
  const fixture = await accessFixture({
    allocationAuthoritativeRecordTime: "2026-07-13T19:00:00.000Z",
    lifecycleDates: sampledDates
  });
  const context = executionContextFixture();
  const response = await handleRouteIqProspectiveShadowRequest(
    eventRequest({
      eventKind: "next_stop_requested",
      informationalObservedAt: "2099-01-01T00:00:00.000Z"
    }, fixture.token),
    fixture.env,
    { executionContext: context, noncanonicalTestHooks: fixture.noncanonicalTestHooks }
  );
  assert.equal(response.status, 202);
  assert.deepEqual(await context.promises[0], { status: "shadow_decision_sealed" });
  assert.deepEqual(lifecycleRecordTimes(fixture.commands), [
    "2026-07-13T20:00:10.000Z",
    "2026-07-13T20:00:10.001Z",
    "2026-07-13T20:00:10.002Z",
    "2026-07-13T20:00:11.000Z",
    "2026-07-13T20:00:11.001Z",
    "2026-07-13T20:00:12.000Z"
  ]);
  assert.equal(fixture.calls.filter(call => call === "lifecycle_server_clock").length, 6);

  const futureFixture = await accessFixture({
    allocationAuthoritativeRecordTime: "2026-07-13T20:01:00.000Z",
    lifecycleDates: ["2026-07-13T20:00:00.000Z"]
  });
  const futureContext = executionContextFixture();
  const futureResponse = await handleRouteIqProspectiveShadowRequest(
    eventRequest({ eventKind: "next_stop_requested" }, futureFixture.token),
    futureFixture.env,
    { executionContext: futureContext, noncanonicalTestHooks: futureFixture.noncanonicalTestHooks }
  );
  assert.equal(futureResponse.status, 202);
  assert.deepEqual(await futureContext.promises[0], { status: "failure_isolated" });
  assert.equal(futureFixture.calls.includes("runtime_context_rpc"), false);
  assert.equal(futureFixture.calls.includes("candidate_manifest_rpc"), false);
  assert.equal(futureFixture.calls.includes("snapshot_seal_rpc"), false);
  assert.equal(futureFixture.calls.includes("shadow_decision_seal_rpc"), false);
});

test("canonical handoff closure is Access-mapped, digest-bound, and disabled without a DO call", async () => {
  const fixture = await accessFixture();
  const handoff = canonicalHandoff();
  const closed = await closeRouteIqProspectiveSessionFromHandoff(
    eventRequest({ eventKind: "next_stop_requested" }, fixture.token),
    fixture.env,
    {
      completionAction: "end_route",
      handoffResult: handoff,
      noncanonicalTestHooks: fixture.noncanonicalTestHooks
    }
  );
  assert.equal(closed.status, "closed");
  assert.ok(fixture.calls.indexOf("access_signature") < fixture.calls.indexOf("do_lookup"));
  assert.equal(fixture.calls.includes("close_rpc"), true);
  assert.deepEqual(fixture.commands.at(-1).authorityEnvelope.claims, {
    purpose: "close_session",
    ...scope(),
    closeReason: "end_route",
    handoffContractVersion: ROUTE_IQ_PROSPECTIVE_HANDOFF_CONTRACT,
    endOfDayHandoffSha256: handoff.rawSha256,
    authoritativeRecordTime: testNow.toISOString()
  });

  const mismatched = await accessFixture();
  await assert.rejects(
    closeRouteIqProspectiveSessionFromHandoff(
      eventRequest({ eventKind: "next_stop_requested" }, mismatched.token),
      mismatched.env,
      {
        completionAction: "end_day",
        handoffResult: canonicalHandoff("anthony"),
        noncanonicalTestHooks: mismatched.noncanonicalTestHooks
      }
    ),
    error => error.code === "route_iq_prospective_handoff_scope_mismatch"
  );
  assert.equal(mismatched.calls.includes("do_lookup"), false);

  const disabled = await closeRouteIqProspectiveSessionFromHandoff(
    eventRequest({ eventKind: "next_stop_requested" }),
    {
      get [ROUTE_IQ_PROSPECTIVE_SHADOW_BINDING]() {
        throw new Error("disabled closure reached DO");
      }
    },
    { completionAction: "end_route", handoffResult: handoff }
  );
  assert.deepEqual(disabled, { status: "disabled" });
});

test("field-session success acknowledgment is unchanged while prospective close runs in waitUntil", async () => {
  const fixture = await accessFixture();
  const store = fieldSessionStore();
  const firstContext = executionContextFixture();
  const first = await submitFieldSession(fixture, store, firstContext);
  assertCanonicalFieldSessionAcknowledgment(first.response, first.body, 201);
  assert.equal(firstContext.promises.length, 1);
  await firstContext.promises[0];
  assert.equal(fixture.calls.includes("close_rpc"), true);

  const retryContext = executionContextFixture();
  const retry = await submitFieldSession(fixture, store, retryContext);
  assertCanonicalFieldSessionAcknowledgment(retry.response, retry.body, 200);
  assert.equal(retryContext.promises.length, 1);
  await retryContext.promises[0];
});

test("field-session acknowledgment isolates prospective timeout, rejection, missing binding, and missing key", async t => {
  await t.test("reconciliation rejection", async () => {
    const fixture = await accessFixture({
      reconciliationImplementation() {
        throw Object.assign(new Error("Noncanonical reconciliation rejection."), {
          code: "route_iq_prospective_reconciliation_rejected",
          status: 503
        });
      }
    });
    const context = executionContextFixture();
    const submission = await submitFieldSession(fixture, fieldSessionStore(), context);
    assertCanonicalFieldSessionAcknowledgment(submission.response, submission.body, 201);
    assert.equal((await context.promises[0]).status, "closed");
    assert.equal(fixture.calls.includes("field_session_reconciliation_rpc"), true);
    assert.equal(fixture.calls.includes("close_rpc"), true);
  });

  await t.test("timeout", async () => {
    let rejectClose;
    let markStarted;
    const started = new Promise(resolve => {
      markStarted = resolve;
    });
    const fixture = await accessFixture({
      closeImplementation() {
        markStarted();
        return new Promise((_, reject) => {
          rejectClose = reject;
        });
      }
    });
    const context = executionContextFixture();
    const submission = await submitFieldSession(fixture, fieldSessionStore(), context);
    assertCanonicalFieldSessionAcknowledgment(submission.response, submission.body, 201);
    assert.equal(context.promises.length, 1);
    await started;
    const timeout = Object.assign(new Error("Noncanonical close timeout."), {
      code: "route_iq_prospective_close_timeout",
      status: 504
    });
    rejectClose(timeout);
    assert.deepEqual(await context.promises[0], { status: "failure_isolated" });
  });

  await t.test("rejection", async () => {
    const fixture = await accessFixture({
      closeImplementation() {
        throw Object.assign(new Error("Noncanonical close rejection."), {
          code: "route_iq_prospective_close_rejected",
          status: 503
        });
      }
    });
    const context = executionContextFixture();
    const submission = await submitFieldSession(fixture, fieldSessionStore(), context);
    assertCanonicalFieldSessionAcknowledgment(submission.response, submission.body, 201);
    assert.deepEqual(await context.promises[0], { status: "failure_isolated" });
  });

  await t.test("missing binding", async () => {
    const fixture = await accessFixture();
    delete fixture.env[ROUTE_IQ_PROSPECTIVE_SHADOW_BINDING];
    const context = executionContextFixture();
    const submission = await submitFieldSession(fixture, fieldSessionStore(), context);
    assertCanonicalFieldSessionAcknowledgment(submission.response, submission.body, 201);
    assert.deepEqual(await context.promises[0], { status: "failure_isolated" });
  });

  await t.test("missing key", async () => {
    const fixture = await accessFixture();
    delete fixture.env[ROUTE_IQ_PROSPECTIVE_SHADOW_ENV.authorityKey];
    const context = executionContextFixture();
    const submission = await submitFieldSession(fixture, fieldSessionStore(), context);
    assertCanonicalFieldSessionAcknowledgment(submission.response, submission.body, 201);
    assert.deepEqual(await context.promises[0], { status: "failure_isolated" });
    assert.equal(fixture.calls.includes("do_lookup"), false);
  });
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

  for (const mutation of ["missing", "invalid"]) {
    const territoryFixture = await accessFixture();
    const config = JSON.parse(territoryFixture.env[ROUTE_IQ_PROSPECTIVE_SHADOW_ENV.principalMap]);
    if (mutation === "missing") delete config.principals[0].territoryContext;
    else config.principals[0].territoryContext.availableAt = "not-a-time";
    territoryFixture.env[ROUTE_IQ_PROSPECTIVE_SHADOW_ENV.principalMap] = JSON.stringify(config);
    const response = await handleRouteIqProspectiveShadowRequest(
      eventRequest({ eventKind: "next_stop_requested" }, territoryFixture.token),
      territoryFixture.env,
      { noncanonicalTestHooks: territoryFixture.noncanonicalTestHooks }
    );
    assert.equal(response.status, mutation === "missing" ? 400 : 403, mutation);
    assert.equal(territoryFixture.calls.includes("do_lookup"), false, mutation);
  }

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
  "allocateNextStopOpportunity",
  "noteGovernedRepresentativeSignal",
  "closeCanonicalSession",
  "readCanonicalRuntimeContext",
  "recordRuntimeStageExclusion",
  "linkServerDerivedNextStopAction",
  "reconcileCommittedFieldSessionOutcomes",
  "admitIntelligenceScoreableOutcome",
  "admitIntelligenceEvaluation",
  "applyTrustedTrigger",
  "applyTrustedCandidateManifest",
  "applyTrustedSnapshotSeal",
  "applyTrustedShadowDecisionSeal",
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
    issuedAt: testNow.toISOString(),
    territoryContext: territoryContext(representativeId)
  }, env);
}

function miniflareStub(miniflare, instanceName) {
  return new Proxy({}, {
    get(_target, method) {
      return async command => {
        const response = await doRpc(miniflare, instanceName, String(method), command);
        if (response.status === 200 && response.body.ok) return response.body.result;
        throw Object.assign(new Error(response.body.message || "Noncanonical Miniflare RPC failed."), {
          code: response.body.code || "route_iq_prospective_miniflare_rpc_failed",
          status: response.body.status || 500
        });
      };
    }
  });
}

async function miniflareRuntimeContext(miniflare, instanceName, env, scopeEnvelope, at) {
  const authorityEnvelope = await createRouteIqProspectiveAuthorityEnvelope({
    purpose: "runtime_context_read",
    ...scope(),
    authoritativeRecordTime: at
  }, env);
  const response = await doRpc(miniflare, instanceName, "readCanonicalRuntimeContext", {
    scopeEnvelope,
    input: { authorityEnvelope }
  });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  return response.body.result;
}

test("real Miniflare seals the complete Intelligence lifecycle, links action, and persists restart state", async () => {
  const persistencePath = mkdtempSync(join(tmpdir(), "prometheus-route-iq-lifecycle-do-"));
  const authority = authorityEnv();
  const runtimeEnv = { ...authority, ASSETS: fieldSessionAssets() };
  const instanceName = `noncanonical-lifecycle-${randomUUID()}`;
  const scopeEnvelope = await scopeEnvelopeFor(authority);
  const allocationCommand = {
    scopeEnvelope,
    event: {
      eventKind: "next_stop_requested",
      informationalSequence: 1,
      informationalObservedAt: testNow.toISOString()
    }
  };
  let miniflare = createMiniflare(authority, persistencePath);
  try {
    const [left, right] = await Promise.all([
      doRpc(miniflare, instanceName, "allocateNextStopOpportunity", allocationCommand),
      doRpc(miniflare, instanceName, "allocateNextStopOpportunity", {
        ...allocationCommand,
        event: { eventKind: "next_stop_requested", informationalSequence: 999 }
      })
    ]);
    assert.equal(left.status, 200, JSON.stringify(left.body));
    assert.deepEqual(right.body.result, left.body.result);
    const stub = miniflareStub(miniflare, instanceName);
    const sealed = await orchestrateRouteIqProspectiveNextStop({
      stub,
      scopeEnvelope,
      scope: scope(),
      allocationReceipt: left.body.result,
      assetOrigin: "https://private.invalid/",
      env: runtimeEnv,
      noncanonicalTestHooks: {
        enabled: true,
        currentDate: new Date(left.body.result.authoritativeRecordTime)
      }
    });
    assert.deepEqual(sealed, { status: "shadow_decision_sealed" });
    const action = await linkRouteIqProspectiveServerAction({
      stub,
      scopeEnvelope,
      scope: scope(),
      eventKind: "representative_action_observed",
      authoritativeRecordTime: new Date(testNow.getTime() + 100).toISOString(),
      env: runtimeEnv
    });
    assert.equal(action.state, "ACTION_LINKED");
    assert.equal(action.browserCandidateIdentityAccepted, false);
    assert.match(action.selectedCandidateId, /^riq_candidate_[a-f0-9]{64}$/u);
  } finally {
    await miniflare.dispose();
  }

  miniflare = createMiniflare(authority, persistencePath);
  try {
    const context = await miniflareRuntimeContext(
      miniflare,
      instanceName,
      authority,
      scopeEnvelope,
      new Date(testNow.getTime() + 200).toISOString()
    );
    assert.equal(context.state, "ACTION_LINKED");
    assert.equal(context.completedCandidateIds.length, 1);
  } finally {
    await miniflare.dispose();
    rmSync(persistencePath, { recursive: true, force: true });
  }
});

test("real Miniflare records governed exclusions for action before seal and source failure", async t => {
  await t.test("action before seal", async () => {
    const persistencePath = mkdtempSync(join(tmpdir(), "prometheus-route-iq-premature-action-do-"));
    const authority = authorityEnv();
    const instanceName = `noncanonical-premature-action-${randomUUID()}`;
    const scopeEnvelope = await scopeEnvelopeFor(authority);
    const miniflare = createMiniflare(authority, persistencePath);
    try {
      const allocation = await doRpc(miniflare, instanceName, "allocateNextStopOpportunity", {
        scopeEnvelope,
        event: { eventKind: "next_stop_requested", informationalSequence: 1 }
      });
      assert.equal(allocation.status, 200, JSON.stringify(allocation.body));
      const result = await linkRouteIqProspectiveServerAction({
        stub: miniflareStub(miniflare, instanceName),
        scopeEnvelope,
        scope: scope(),
        eventKind: "representative_action_observed",
        authoritativeRecordTime: new Date(testNow.getTime() + 10).toISOString(),
        env: authority
      });
      assert.equal(result.status, "excluded");
      assert.deepEqual(result.reasonCodes, ["shadow_not_sealed_before_action"]);
    } finally {
      await miniflare.dispose();
      rmSync(persistencePath, { recursive: true, force: true });
    }
  });

  await t.test("source artifact failure", async () => {
    const persistencePath = mkdtempSync(join(tmpdir(), "prometheus-route-iq-source-failure-do-"));
    const authority = authorityEnv();
    const instanceName = `noncanonical-source-failure-${randomUUID()}`;
    const scopeEnvelope = await scopeEnvelopeFor(authority);
    const miniflare = createMiniflare(authority, persistencePath);
    try {
      const allocation = await doRpc(miniflare, instanceName, "allocateNextStopOpportunity", {
        scopeEnvelope,
        event: { eventKind: "next_stop_requested", informationalSequence: 1 }
      });
      await assert.rejects(() => orchestrateRouteIqProspectiveNextStop({
        stub: miniflareStub(miniflare, instanceName),
        scopeEnvelope,
        scope: scope(),
        allocationReceipt: allocation.body.result,
        assetOrigin: "https://private.invalid/",
        env: {
          ...authority,
          ASSETS: { async fetch() { return new Response("missing", { status: 404 }); } }
        },
        noncanonicalTestHooks: {
          enabled: true,
          currentDate: new Date(allocation.body.result.authoritativeRecordTime)
        }
      }), error => error.code === "route_iq_prospective_source_artifact_unavailable");
      const context = await miniflareRuntimeContext(
        miniflare,
        instanceName,
        authority,
        scopeEnvelope,
        new Date(testNow.getTime() + 20).toISOString()
      );
      assert.equal(context.state, "EXCLUDED");
    } finally {
      await miniflare.dispose();
      rmSync(persistencePath, { recursive: true, force: true });
    }
  });
});

test("real Miniflare reconciles an exact committed PII-free field-session projection", async () => {
  const persistencePath = mkdtempSync(join(tmpdir(), "prometheus-route-iq-reconciliation-do-"));
  const authority = authorityEnv();
  const runtimeEnv = { ...authority, ASSETS: fieldSessionAssets() };
  const instanceName = `noncanonical-reconciliation-${randomUUID()}`;
  const scopeEnvelope = await scopeEnvelopeFor(authority);
  const miniflare = createMiniflare(authority, persistencePath);
  try {
    const allocation = await doRpc(miniflare, instanceName, "allocateNextStopOpportunity", {
      scopeEnvelope,
      event: { eventKind: "next_stop_requested", informationalSequence: 1 }
    });
    const stub = miniflareStub(miniflare, instanceName);
    await orchestrateRouteIqProspectiveNextStop({
      stub,
      scopeEnvelope,
      scope: scope(),
      allocationReceipt: allocation.body.result,
      assetOrigin: "https://private.invalid/",
      env: runtimeEnv,
      noncanonicalTestHooks: {
        enabled: true,
        currentDate: new Date(allocation.body.result.authoritativeRecordTime)
      }
    });
    const action = await linkRouteIqProspectiveServerAction({
      stub,
      scopeEnvelope,
      scope: scope(),
      eventKind: "representative_action_observed",
      authoritativeRecordTime: new Date(testNow.getTime() + 100).toISOString(),
      env: runtimeEnv
    });
    const runtimePools = JSON.parse(readFileSync(join(
      root,
      "deploy/cloudflare-pages/data/qualified-prospects/google-qualified-businesses-v2/runtime-pools.json"
    ), "utf8"));
    const selected = runtimePools.cruz.find(record =>
      deriveRouteIqCandidateIdFromGooglePlaceId(record.googlePlaceId) === action.selectedCandidateId);
    assert.ok(selected, "rank-one action must resolve to the governed runtime pool");
    const visitAt = new Date(testNow.getTime() + 60_000).toISOString();
    const generatedAt = new Date(testNow.getTime() + 120_000).toISOString();
    const finalizedAt = new Date(testNow.getTime() + 180_000).toISOString();
    const rawReportText = JSON.stringify({
      app: "Prometheus IQ",
      reportType: "beta-daily-rep-report",
      generatedAt,
      date: "2026-07-13",
      rep: { id: "cruz", name: "Cruz" },
      totals: { visits: 1, conversations: 1, leads: 0, units: 0, laterUnits: 0 },
      visits: [{
        placeName: selected.name,
        placeId: selected.id,
        timestamp: visitAt,
        date: "2026-07-13",
        timeWindow: "Evening",
        outcome: "Conversation",
        conversations: 1,
        leads: 0,
        units: 0,
        laterUnits: 0,
        notes: "",
        gpsAttached: false,
        visitDecisionSource: {
          sourceId: "unknown",
          reason: null,
          evidence: [],
          confidence: 0,
          capturedAt: generatedAt
        },
        recommendationDecisionContext: {
          recommendationAvailable: null,
          recommendationId: null,
          decision: null
        }
      }]
    });
    const store = fieldSessionStore();
    const activePool = JSON.parse(readFileSync(join(
      root,
      "deploy/cloudflare-pages/data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/active-pool.json"
    ), "utf8"));
    const businessHours = JSON.parse(readFileSync(join(
      root,
      "deploy/cloudflare-pages/data/qualified-prospects/google-qualified-businesses-v2/business-hours-v1/business-hours.json"
    ), "utf8"));
    const handoff = await consumeRouteIqEndOfDayHandoff({
      handoffContractId: routeIqEndOfDayHandoffContractId,
      producerSubsystem: "Prometheus Dashboard",
      completionAction: "end_route",
      workspaceId: "fitness_connection",
      operatingProfileId: "fitness",
      finalExportConfirmed: true,
      sourceFinalizedAt: finalizedAt,
      rawReportText
    }, {
      env: { [routeIqFieldSessionStoreBinding]: store },
      runtimePools,
      activePool,
      businessHours,
      ingestedAt: finalizedAt
    });
    const archived = await readRouteIqFieldSessionArchive({
      workspaceId: "fitness_connection",
      operatingProfileId: "fitness",
      sessionId: handoff.sessionId
    }, { env: { [routeIqFieldSessionStoreBinding]: store } });
    const projection = projectCommittedRouteIqFieldSessionOutcomes({
      ...scope(),
      archiveRecord: archived.record
    });
    assert.equal(JSON.stringify(projection).includes(selected.name), false);
    const closeAuthorityEnvelope = await createRouteIqProspectiveAuthorityEnvelope({
      purpose: "close_session",
      ...scope(),
      closeReason: "end_route",
      handoffContractVersion: ROUTE_IQ_PROSPECTIVE_HANDOFF_CONTRACT,
      endOfDayHandoffSha256: handoff.rawSha256,
      authoritativeRecordTime: new Date(testNow.getTime() + 210_000).toISOString()
    }, authority);
    const closed = await doRpc(miniflare, instanceName, "closeCanonicalSession", {
      scopeEnvelope,
      authorityEnvelope: closeAuthorityEnvelope
    });
    assert.equal(closed.status, 200, JSON.stringify(closed.body));
    const authorityEnvelope = await createRouteIqProspectiveAuthorityEnvelope({
      purpose: "field_session_reconciliation",
      ...scope(),
      authoritativeRecordTime: new Date(testNow.getTime() + 240_000).toISOString(),
      projectionSha256: projection.projectionSha256,
      sourceArchiveRawSha256: projection.sourceArchive.rawSha256,
      sourceArchiveSessionSha256: projection.sourceArchive.sourceArchiveSessionSha256
    }, authority);
    const reconciled = await doRpc(miniflare, instanceName, "reconcileCommittedFieldSessionOutcomes", {
      scopeEnvelope,
      input: { authorityEnvelope, projection }
    });
    assert.equal(reconciled.status, 200, JSON.stringify(reconciled.body));
    assert.equal(reconciled.body.result.linked.length, 1);
    assert.deepEqual(reconciled.body.result.exclusions, []);
    assert.equal(reconciled.body.result.outcomeValuesInferredByData, false);
  } finally {
    await miniflare.dispose();
    rmSync(persistencePath, { recursive: true, force: true });
  }
});

test("real Miniflare SQLite allocator converges, closes, isolates scope, and survives restart", async () => {
  const persistencePath = mkdtempSync(join(tmpdir(), "prometheus-route-iq-do-"));
  const env = authorityEnv();
  const instanceName = `noncanonical-scope-${randomUUID()}`;
  const originalScopeEnvelope = await scopeEnvelopeFor(env);
  const originalCommand = {
    scopeEnvelope: originalScopeEnvelope,
    event: {
      eventKind: "next_stop_requested",
      informationalSequence: 1,
      informationalObservedAt: "2026-07-13T20:00:00.000Z"
    }
  };
  let miniflare = createMiniflare(env, persistencePath);
  let originalReceipt;
  let reopenedReceipt;
  try {
    const [left, right] = await Promise.all([
      doRpc(miniflare, instanceName, "allocateNextStopOpportunity", originalCommand),
      doRpc(miniflare, instanceName, "allocateNextStopOpportunity", {
        scopeEnvelope: originalScopeEnvelope,
        event: {
          eventKind: "next_stop_requested",
          informationalSequence: 999,
          informationalObservedAt: "2026-07-13T20:02:00.000Z"
        }
      })
    ]);
    assert.equal(left.status, 200, JSON.stringify(left.body));
    assert.equal(right.status, 200, JSON.stringify(right.body));
    assert.deepEqual(left.body.result, right.body.result);
    assert.equal(left.body.result.serverDerivedCanonicalIdentity, true);
    assert.match(left.body.result.sessionId, /^riq_session_[a-f0-9]{64}$/u);
    assert.match(left.body.result.opportunityId, /^riq_opportunity_[a-f0-9]{64}$/u);
    originalReceipt = left.body.result;

    const governedNoop = await doRpc(miniflare, instanceName, "noteGovernedRepresentativeSignal", {
      scopeEnvelope: originalScopeEnvelope,
      event: { eventKind: "representative_action_observed", informationalSequence: 2 }
    });
    assert.equal(governedNoop.status, 200);
    assert.deepEqual(governedNoop.body.result, { status: "governed_noop" });

    const afterNoop = await doRpc(miniflare, instanceName, "allocateNextStopOpportunity", originalCommand);
    assert.deepEqual(afterNoop.body.result, originalReceipt);

    const crossScope = await doRpc(miniflare, instanceName, "allocateNextStopOpportunity", {
      scopeEnvelope: await scopeEnvelopeFor(env, "anthony"),
      event: { eventKind: "next_stop_requested", informationalSequence: 1 }
    });
    assert.equal(crossScope.status, 599);
    assert.match(crossScope.body.message, /scope does not own|scope/u);

    const genericRpc = await doRpc(miniflare, instanceName, "execute", { sql: "SELECT 1" });
    assert.equal(genericRpc.status, 400);

    const closeClaims = {
      purpose: "close_session",
      ...scope(),
      closeReason: "end_route",
      handoffContractVersion: ROUTE_IQ_PROSPECTIVE_HANDOFF_CONTRACT,
      endOfDayHandoffSha256: digest("miniflare-canonical-handoff"),
      authoritativeRecordTime: "2026-07-13T20:03:00.000Z"
    };
    const closed = await doRpc(miniflare, instanceName, "closeCanonicalSession", {
      scopeEnvelope: originalScopeEnvelope,
      authorityEnvelope: await createRouteIqProspectiveAuthorityEnvelope(closeClaims, env)
    });
    const closeRetry = await doRpc(miniflare, instanceName, "closeCanonicalSession", {
      scopeEnvelope: originalScopeEnvelope,
      authorityEnvelope: await createRouteIqProspectiveAuthorityEnvelope({
        ...closeClaims,
        authoritativeRecordTime: "2026-07-13T20:04:00.000Z"
      }, env)
    });
    assert.equal(closed.status, 200);
    assert.deepEqual(closeRetry.body.result, closed.body.result);
    assert.equal(closed.body.result.status, "closed");

    const reopened = await doRpc(miniflare, instanceName, "allocateNextStopOpportunity", {
      scopeEnvelope: originalScopeEnvelope,
      event: { eventKind: "next_stop_requested", informationalSequence: 3 }
    });
    assert.equal(reopened.status, 200);
    assert.notEqual(reopened.body.result.sessionId, originalReceipt.sessionId);
    assert.notEqual(reopened.body.result.opportunityId, originalReceipt.opportunityId);
    reopenedReceipt = reopened.body.result;
  } finally {
    await miniflare.dispose();
  }

  miniflare = createMiniflare(env, persistencePath);
  try {
    const afterRestart = await doRpc(miniflare, instanceName, "allocateNextStopOpportunity", {
      scopeEnvelope: originalScopeEnvelope,
      event: {
        eventKind: "next_stop_requested",
        informationalSequence: 500,
        informationalObservedAt: "2026-07-13T20:10:00.000Z"
      }
    });
    assert.equal(afterRestart.status, 200);
    assert.deepEqual(afterRestart.body.result, reopenedReceipt);
  } finally {
    await miniflare.dispose();
    rmSync(persistencePath, { recursive: true, force: true });
  }
});
