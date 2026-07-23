import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  continuousAdaptiveRouteReplenishmentVersion,
  defaultRouteQueueTarget,
  defaultRouteReplenishmentThreshold
} from "../intelligence/continuous-adaptive-route-replenishment.mjs";

const root = resolve(import.meta.dirname, "..");
const read = path => readFileSync(resolve(root, path), "utf8");
const contract = JSON.parse(read("intelligence/contracts/continuous-adaptive-route-replenishment-contracts.json"));
const moduleSource = read("intelligence/continuous-adaptive-route-replenishment.mjs");

assert.equal(contract.version, "continuous-adaptive-route-replenishment-contracts-v1");
assert.equal(contract.workspacePolicy.configurationDriven, true);
assert.deepEqual(contract.workspacePolicy.canonicalWorkspaceIds, [
  "fitness_connection",
  "northstar_outside_sales_synthetic"
]);
assert.equal(contract.workspacePolicy.canonicalManifestAdmissionRequired, true);
assert.equal(contract.workspacePolicy.unknownWorkspaceBehavior, "fail_closed");
assert.equal(contract.workspacePolicy.crossWorkspaceLearning, false);
assert.equal(contract.workspacePolicy.crossWorkspaceRouteInfluence, false);
assert.equal(contract.queuePolicy.targetSize, defaultRouteQueueTarget);
assert.equal(contract.queuePolicy.replenishmentThreshold, defaultRouteReplenishmentThreshold);
assert.equal(contract.queuePolicy.outcomeTriggersImmediateMaintenance, true);
assert.equal(contract.queuePolicy.concurrency, "single_flight");
assert.equal(contract.queuePolicy.persistedEntriesReevaluatedAtAuthoritativeTime, true);
assert.equal(contract.candidatePolicy.primaryPool, "approved_active");
assert.equal(contract.candidatePolicy.fallbackPool, "approved_full");
assert.equal(contract.candidatePolicy.liveProviderCalls, false);
assert.equal(contract.candidatePolicy.closedStaleMissingInvalidOrProviderFailureSelectable, false);
assert.equal(contract.safety.collection, "OFF");
assert.equal(contract.safety.activeCohorts, 0);
assert.equal(contract.safety.recommendationInfluence, "OFF");
assert.equal(continuousAdaptiveRouteReplenishmentVersion, "continuous-adaptive-route-replenishment-v1");
assert.match(moduleSource, /assertGovernedCandidateAdmission/);
assert.match(moduleSource, /requireManifestAdmission:\s*true/);
assert.match(moduleSource, /immediateRecommendationEligible/);
assert.match(moduleSource, /evaluatedAt/);

const focused = spawnSync(process.execPath, [
  "--test",
  "tests/continuous-adaptive-route-replenishment.test.mjs"
], {
  cwd: root,
  encoding: "utf8",
  env: { ...process.env, NODE_OPTIONS: "" }
});
assert.equal(
  focused.status,
  0,
  `Continuous route focused regression failed.\n${focused.stdout}\n${focused.stderr}`
);

console.log("Continuous Adaptive Route Replenishment v1 verification passed.");
