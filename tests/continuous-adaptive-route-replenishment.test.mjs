import assert from "node:assert/strict";
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

const workspaceId = "fitness_connection";
const representativeId = "anthony";

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
    ...overrides
  };
}

function maintain(queue, options = {}) {
  return maintainRouteQueue({
    queue,
    workspaceId,
    representativeId,
    routeDate: "2026-07-11",
    primaryCandidates: options.primaryCandidates || [],
    fallbackCandidates: options.fallbackCandidates || [],
    completedIdentityKeys: options.completedIdentityKeys || [],
    force: options.force === true,
    trigger: options.trigger || "test",
    isEligible: place => place.eligible === true,
    scoreCandidate: place => ({ score: place.score, signals: ["test evidence"] }),
    now: "2026-07-11T12:00:00.000Z"
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
  const before = buildAdaptiveIntelligenceSnapshot({ workspaceId, representativeId, visits: [], places });
  const after = buildAdaptiveIntelligenceSnapshot({
    workspaceId,
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
  const beforeScore = scoreAdaptiveCandidate({ candidate: places[0], baseScore: 80, intelligence: before, currentTimeWindow: "Midday", territoryLabel: "Ring 1" });
  const afterScore = scoreAdaptiveCandidate({ candidate: places[0], baseScore: 80, intelligence: after, currentTimeWindow: "Midday", territoryLabel: "Ring 1" });
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
  const queue = createEmptyRouteQueue({ workspaceId, representativeId, routeDate: "2026-07-11", targetSize: 4, threshold: 2 });
  const result = maintainRouteQueue({
    queue,
    workspaceId,
    representativeId,
    routeDate: "2026-07-11",
    primaryCandidates,
    fallbackCandidates,
    force: true,
    isEligible: place => place.eligible,
    scoreCandidate: place => place.score
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
  assert.throws(() => createEmptyRouteQueue({ workspaceId: "smoothie_depot", representativeId }), /not authorized/);
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
    representativeId,
    routeDate: "2026-07-11"
  });
  const nextOperation = maintain(restored, { primaryCandidates, force: false });
  assert.deepEqual(nextOperation.queue.entries, initial.entries);
  assert.equal(nextOperation.triggered, false);
});
