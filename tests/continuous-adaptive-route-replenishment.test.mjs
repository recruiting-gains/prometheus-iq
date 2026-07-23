import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildAdaptiveIntelligenceSnapshot,
  createEmptyRouteQueue,
  createSingleFlightReplenisher,
  defaultRouteQueueTarget,
  defaultRouteReplenishmentThreshold,
  maintainRouteQueue,
  normalizeRouteQueue,
  routeQueueIdentity,
  scoreAdaptiveCandidate,
  serializeRouteQueue
} from "../intelligence/continuous-adaptive-route-replenishment.mjs";
import {
  createGovernedRouteRuntimeScopeFromConfiguration
} from "../intelligence/route-iq-governed-runtime-scope.mjs";

const workspaceId = "fitness_connection";
const operatingProfileId = "fitness";
const representativeId = "anthony";
const evaluationTime = "2026-07-11T12:00:00.000Z";
const sourceArtifactSha256 = "b".repeat(64);
const workspaceRegistry = JSON.parse(readFileSync(
  new URL("../administration/workspace-configurations/route-iq-cross-industry-workspaces-v2.json", import.meta.url),
  "utf8"
));
const governedRegistry = structuredClone(workspaceRegistry);
const governedWorkspace = governedRegistry.workspaces.find(item => item.workspaceId === workspaceId);
governedWorkspace.opportunitySources[0].manifestApprovalState = "APPROVED";
const approvedIds = Array.from({ length: 80 }, (_, index) => `place-${index}`);
const manifest = {
  manifestId: governedWorkspace.opportunitySources[0].manifestId,
  manifestVersion: "route-iq-workspace-business-artifact-manifest-v1",
  workspaceId,
  operatingProfileId,
  configurationVersion: "route-iq-commercial-workspace-registry-v1",
  artifactType: "approved_business_opportunity_roster",
  artifactPath: governedWorkspace.opportunitySources[0].artifactPath,
  artifactSha256: sourceArtifactSha256,
  recordIdentityField: "google_place_id",
  recordCount: approvedIds.length,
  approvedRecordCount: approvedIds.length,
  approvedRecordIds: approvedIds,
  approvalState: "APPROVED",
  classification: "FOUNDER_FIELD_RESEARCH",
  sourceProvenance: {
    producer: "Prometheus Data",
    producerVersion: "queue-test-v1",
    sourceSystem: "deterministic_fixture",
    sourceRetrievedAt: evaluationTime
  },
  freshness: {
    maximumAgeHours: 24,
    evaluatedAt: evaluationTime,
    expiresAt: "2026-07-12T12:00:00.000Z",
    state: "FRESH"
  },
  productionUseAuthorized: false,
  demoFallbackAllowed: false,
  crossWorkspaceFallbackAllowed: false
};
const businessHoursArtifact = {
  schemaVersion: "prometheus-data-business-hours-v1",
  artifactVersion: "queue-test-hours-v1",
  sourceDatasetVersion: "queue-test-v1",
  workspaceId,
  operatingProfileId,
  recordCount: approvedIds.length,
  freshnessPolicy: { freshnessThresholdHours: 24 },
  records: approvedIds.map(googlePlaceId => ({
    workspaceId,
    operatingProfileId,
    googlePlaceId,
    hoursConfidence: "HIGH"
  }))
};
const governedRuntimeScope = createGovernedRouteRuntimeScopeFromConfiguration({
  workspaceRegistry: governedRegistry,
  manifestRegistry: {
    schemaVersion: "route-iq-workspace-business-artifact-manifest-v1",
    registryVersion: "route-iq-workspace-business-artifact-manifest-registry-v1",
    generatedAt: evaluationTime,
    fallbackPolicy: "FAIL_CLOSED_NO_DEMO_OR_CROSS_WORKSPACE_FALLBACK",
    manifests: [manifest]
  },
  workspaceId,
  operatingProfileId,
  sourceArtifactSha256,
  businessHoursArtifact,
  allowFounderResearch: true
});

function candidate(index, overrides = {}) {
  return {
    id: `active-${index}`,
    googlePlaceId: `place-${index}`,
    name: `Business ${index}`,
    address: `${100 + index} Test Street, Houston, TX`,
    category: index % 2 ? "Auto" : "Salon",
    window: "Midday",
    score: 100 - index,
    eligible: true,
    workspaceId,
    operatingProfileId,
    territoryId: governedWorkspace.territories[0].territoryId,
    sourceManifestId: manifest.manifestId,
    sourceManifestVersion: manifest.manifestVersion,
    sourceArtifactSha256,
    sourceConfigurationVersion: governedWorkspace.provenance.configurationVersion,
    sourceManifestConfigurationVersion: manifest.configurationVersion,
    sourceClassification: manifest.classification,
    ...overrides
  };
}

function scoreWithEligibility(place, _sourcePool, now = evaluationTime) {
  const immediate = place.eligible === true;
  return {
    score: place.score,
    signals: ["test evidence"],
    selectionTier: immediate ? 0 : 99,
    eligibility: {
      version: "route-iq-business-hours-eligibility-v2",
      workspaceId,
      operatingProfileId,
      googlePlaceId: place.googlePlaceId,
      status: immediate ? "OPEN_VERIFIED" : "HOURS_STALE",
      eligible: immediate,
      coverageEligible: true,
      immediateRecommendationEligible: immediate,
      coverageOnly: !immediate,
      selectionTier: immediate ? 0 : 99,
      hoursConfidence: immediate ? "HIGH" : "LOW",
      hoursFreshness: immediate ? "FRESH" : "STALE",
      sourceState: immediate ? "VERIFIED" : "STALE",
      reasonCode: immediate ? "OPEN_INSIDE_VERIFIED_PERIOD" : "BUSINESS_HOURS_STALE",
      reason: immediate ? "Fresh verified hours are open." : "Hours are stale.",
      evaluatedAt: new Date(now).toISOString(),
      scoringChanged: false
    }
  };
}

function maintain(queue, options = {}) {
  return maintainRouteQueue({
    queue,
    workspaceId,
    operatingProfileId,
    representativeId,
    routeDate: "2026-07-11",
    primaryCandidates: options.primaryCandidates || [],
    fallbackCandidates: options.fallbackCandidates || [],
    completedIdentityKeys: options.completedIdentityKeys || [],
    force: options.force === true,
    trigger: options.trigger || "test",
    isEligible: place => place.eligible === true,
    scoreCandidate: scoreWithEligibility,
    now: evaluationTime,
    governedRuntimeScope
  });
}

test("initial generation fills a deterministic 15-stop Active Pool queue", () => {
  const primaryCandidates = Array.from({ length: 20 }, (_, index) => candidate(index));
  const result = maintain(null, { primaryCandidates, force: true, trigger: "startup" });
  assert.equal(result.queue.entries.length, defaultRouteQueueTarget);
  assert.equal(result.queue.threshold, defaultRouteReplenishmentThreshold);
  assert.equal(result.queue.state, "active");
  assert.equal(result.usedFallback, false);
  assert.deepEqual(result.queue.entries.map(entry => entry.placeId), primaryCandidates.slice(0, 15).map(place => place.id));
  assert.equal(new Set(result.queue.entries.map(entry => entry.identityKey)).size, 15);
});

test("completed stop is removed, remaining order is preserved, and one replacement appends", () => {
  const primaryCandidates = Array.from({ length: 18 }, (_, index) => candidate(index));
  const initial = maintain(null, { primaryCandidates, force: true }).queue;
  const completedIdentity = initial.entries[0].identityKey;
  const remainingOrder = initial.entries.slice(1).map(entry => entry.identityKey);
  const result = maintain(initial, {
    primaryCandidates,
    completedIdentityKeys: [completedIdentity],
    force: true,
    trigger: "visit-outcome"
  });
  assert.equal(result.queue.entries.length, 15);
  assert.equal(result.removed.length, 1);
  assert.equal(result.appended.length, 1);
  assert.deepEqual(result.queue.entries.slice(0, 14).map(entry => entry.identityKey), remainingOrder);
  assert.equal(result.queue.entries.some(entry => entry.identityKey === completedIdentity), false);
  assert.equal(result.queue.entries.at(-1).identityKey, routeQueueIdentity(primaryCandidates[15]));
});

test("low-water recovery starts below five but does not mutate a healthy queue without a trigger", () => {
  const primaryCandidates = Array.from({ length: 20 }, (_, index) => candidate(index));
  const initial = maintain(null, { primaryCandidates, force: true }).queue;
  const healthy = maintain(initial, { primaryCandidates, force: false });
  assert.equal(healthy.triggered, false);
  assert.equal(healthy.appended.length, 0);

  const lowQueue = { ...initial, entries: initial.entries.slice(0, 4) };
  const recovered = maintain(lowQueue, { primaryCandidates, force: false, trigger: "threshold" });
  assert.equal(recovered.belowThreshold, true);
  assert.equal(recovered.triggered, true);
  assert.equal(recovered.queue.entries.length, 15);
});

test("latest outcome changes adaptive candidate scoring", () => {
  const places = [candidate(1, { category: "Auto" }), candidate(2, { category: "Salon" })];
  const before = buildAdaptiveIntelligenceSnapshot({ workspaceId, operatingProfileId, governedRuntimeScope, representativeId, visits: [], places });
  const after = buildAdaptiveIntelligenceSnapshot({
    workspaceId,
    operatingProfileId,
    governedRuntimeScope,
    representativeId,
    places,
    visits: [{
      id: "visit-sale",
      workspaceId,
      placeId: places[0].id,
      window: "Midday",
      conversations: 1,
      leads: 1,
      units: 1,
      laterUnits: 0,
      notes: "Closed after handling a price objection",
      createdAt: "2026-07-11T11:00:00.000Z"
    }],
    territoryResolver: () => "Ring 1"
  });
  const beforeScore = scoreAdaptiveCandidate({ candidate: places[0], baseScore: 80, intelligence: before, currentTimeWindow: "Midday", territoryLabel: "Ring 1", governedRuntimeScope });
  const afterScore = scoreAdaptiveCandidate({ candidate: places[0], baseScore: 80, intelligence: after, currentTimeWindow: "Midday", territoryLabel: "Ring 1", governedRuntimeScope });
  assert.ok(afterScore.score > beforeScore.score);
  assert.ok(afterScore.signals.includes("latest category evidence"));
  assert.ok(afterScore.signals.includes("territory evidence"));
  assert.ok(after.signals === undefined);
  assert.equal(after.outcomeSignals[0].closingObserved, true);
  assert.equal(after.outcomeSignals[0].objectionObserved, true);
});

test("duplicates, completed locations, and invalid candidates are excluded", () => {
  const duplicateA = candidate(1, { id: "duplicate-a", score: 90 });
  const duplicateB = candidate(2, { id: "duplicate-b", googlePlaceId: duplicateA.googlePlaceId, score: 99 });
  const completed = candidate(3, { score: 98 });
  const invalid = candidate(4, { score: 97, eligible: false });
  const result = maintain(null, {
    primaryCandidates: [duplicateA, duplicateB, completed, invalid],
    completedIdentityKeys: [routeQueueIdentity(completed)],
    force: true
  });
  assert.equal(result.queue.entries.length, 1);
  assert.equal(result.queue.entries[0].identityKey, routeQueueIdentity(duplicateA));
  assert.equal(result.queue.entries.some(entry => entry.identityKey === routeQueueIdentity(completed)), false);
});

test("Active Pool is consumed before governed Full Pool fallback", () => {
  const primaryCandidates = [candidate(1), candidate(2)];
  const fallbackCandidates = [candidate(3, { id: "full-3" }), candidate(4, { id: "full-4" })];
  const queue = createEmptyRouteQueue({ workspaceId, operatingProfileId, representativeId, routeDate: "2026-07-11", targetSize: 4, threshold: 2, governedRuntimeScope });
  const result = maintainRouteQueue({
    queue,
    workspaceId,
    operatingProfileId,
    representativeId,
    routeDate: "2026-07-11",
    primaryCandidates,
    fallbackCandidates,
    force: true,
    isEligible: place => place.eligible,
    scoreCandidate: scoreWithEligibility,
    now: evaluationTime,
    governedRuntimeScope
  });
  assert.deepEqual(result.queue.entries.map(entry => entry.sourcePool), ["active", "active", "full", "full"]);
  assert.equal(result.usedFallback, true);
});

test("empty eligible pool returns an explicit exhausted state", () => {
  const result = maintain(null, {
    primaryCandidates: [candidate(1, { eligible: false })],
    fallbackCandidates: [candidate(2, { eligible: false })],
    force: true
  });
  assert.equal(result.exhausted, true);
  assert.equal(result.queue.state, "exhausted");
  assert.equal(result.queue.entries.length, 0);
});

test("unknown workspaces fail closed without creating a route queue", () => {
  assert.throws(() => createEmptyRouteQueue({ workspaceId: "unauthorized_workspace_fixture", representativeId }), /not authorized/);
  assert.throws(() => buildAdaptiveIntelligenceSnapshot({ workspaceId: "unknown", representativeId }), /not authorized/);
});

test("single-flight guard coalesces simultaneous replenishment operations", async () => {
  let executions = 0;
  let release;
  const blocked = new Promise(resolve => { release = resolve; });
  const coordinator = createSingleFlightReplenisher(async value => {
    executions += 1;
    await blocked;
    return value;
  });
  const first = coordinator.run("first");
  const second = coordinator.run("second");
  assert.equal(first, second);
  assert.deepEqual(coordinator.status(), { inFlight: true, started: 1, coalesced: 1 });
  release();
  assert.equal(await first, "first");
  assert.equal(executions, 1);
  assert.equal(coordinator.status().inFlight, false);
});

test("serialized queue survives a separate runtime operation", () => {
  const primaryCandidates = Array.from({ length: 18 }, (_, index) => candidate(index));
  const initial = maintain(null, { primaryCandidates, force: true }).queue;
  const persisted = JSON.parse(JSON.stringify(serializeRouteQueue(initial)));
  const restored = normalizeRouteQueue(persisted, {
    workspaceId,
    operatingProfileId,
    representativeId,
    routeDate: "2026-07-11",
    governedRuntimeScope
  });
  const nextOperation = maintain(restored, { primaryCandidates, force: false });
  assert.deepEqual(nextOperation.queue.entries, initial.entries);
  assert.equal(nextOperation.triggered, false);
});
