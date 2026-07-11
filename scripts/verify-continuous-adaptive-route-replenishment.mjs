import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  continuousAdaptiveRouteReplenishmentVersion,
  defaultRouteQueueTarget,
  defaultRouteReplenishmentThreshold,
  maintainRouteQueue,
  routeQueueIdentity
} from "../intelligence/continuous-adaptive-route-replenishment.mjs";

const root = resolve(import.meta.dirname, "..");
const read = path => readFileSync(resolve(root, path), "utf8");
const contract = JSON.parse(read("intelligence/contracts/continuous-adaptive-route-replenishment-contracts.json"));
const source = read("index.html");
const deploy = read("deploy/cloudflare-pages/index.html");
const moduleSource = read("intelligence/continuous-adaptive-route-replenishment.mjs");
const deployModuleSource = read("deploy/cloudflare-pages/intelligence/continuous-adaptive-route-replenishment.mjs");

assert.equal(contract.version, "continuous-adaptive-route-replenishment-contracts-v1");
assert.equal(contract.workspacePolicy.authorizedWorkspaceId, "fitness_connection");
assert.equal(contract.workspacePolicy.unknownWorkspaceBehavior, "fail_closed");
assert.equal(contract.workspacePolicy.crossWorkspaceLearning, false);
assert.equal(contract.workspacePolicy.smoothieDepotRouteInfluence, false);
assert.equal(contract.queuePolicy.targetSize, defaultRouteQueueTarget);
assert.equal(contract.queuePolicy.replenishmentThreshold, defaultRouteReplenishmentThreshold);
assert.equal(contract.queuePolicy.outcomeTriggersImmediateMaintenance, true);
assert.equal(contract.queuePolicy.concurrency, "single_flight");
assert.equal(contract.candidatePolicy.primaryPool, "active");
assert.equal(contract.candidatePolicy.fallbackPool, "full");
assert.equal(contract.candidatePolicy.liveGoogleCalls, false);
assert.equal(continuousAdaptiveRouteReplenishmentVersion, "continuous-adaptive-route-replenishment-v1");
assert.equal(source, deploy, "Dashboard source and deployment mirror differ.");
assert.equal(moduleSource, deployModuleSource, "Route replenishment source and deployment module differ.");
assert.match(source, /persistCompletedVisitAndRefreshRoute/);
assert.match(source, /Route updated using your latest result\./);
assert.match(source, /No eligible locations remain in this route pool\./);
assert.match(source, /runtimeDatasetQuarantinePath/);
assert.match(source, /createSingleFlightReplenisher/);
assert.doesNotMatch(source, /maps\.googleapis\.com\/maps\/api\/place/i);

const candidates = Array.from({ length: 18 }, (_, index) => ({
  id: `candidate-${index}`,
  googlePlaceId: `place-${index}`,
  name: `Candidate ${index}`,
  address: `${index + 1} Test Street`,
  score: 100 - index
}));
const initial = maintainRouteQueue({
  workspaceId: "fitness_connection",
  representativeId: "verification-rep",
  routeDate: "2026-07-11",
  primaryCandidates: candidates,
  force: true,
  isEligible: () => true,
  scoreCandidate: candidate => candidate.score
});
assert.equal(initial.queue.entries.length, 15);
const completedIdentity = routeQueueIdentity(candidates[0]);
const replenished = maintainRouteQueue({
  queue: initial.queue,
  workspaceId: "fitness_connection",
  representativeId: "verification-rep",
  routeDate: "2026-07-11",
  primaryCandidates: candidates,
  completedIdentityKeys: [completedIdentity],
  force: true,
  trigger: "visit-outcome",
  isEligible: () => true,
  scoreCandidate: candidate => candidate.score
});
assert.equal(replenished.queue.entries.length, 15);
assert.equal(replenished.queue.entries.some(entry => entry.identityKey === completedIdentity), false);
assert.equal(replenished.appended.length, 1);

console.log("Continuous Adaptive Route Replenishment v1 verification passed.");
