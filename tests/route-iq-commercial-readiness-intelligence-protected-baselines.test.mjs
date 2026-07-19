import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url));
const json = path => JSON.parse(read(path).toString("utf8"));
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");

const provenancePath = "intelligence/provenance/protected-baseline-synchronization-batch-20260718-002-commercial-readiness-v1.json";
const provenance = json(provenancePath);
const contracts = {
  readOnly: json("intelligence/contracts/read-only-field-session-learning-contracts.json"),
  discovery: json("intelligence/contracts/discovery-mode-intelligence-v2-contracts.json"),
  nearby: json("intelligence/contracts/nearby-context-intelligence-v2-contracts.json"),
  offRoute: json("intelligence/contracts/off-route-learning-intelligence-contracts.json"),
  shadow: json("intelligence/contracts/shadow-decision-readiness-contracts.json")
};

test("commercial-readiness protected baselines match the reviewed Dashboard and Worker owners", () => {
  const dashboardSha256 = sha256(read("index.html"));
  const deploySha256 = sha256(read("deploy/cloudflare-pages/index.html"));
  const workerSha256 = sha256(read("workers/prometheus-iq-worker.js"));
  assert.equal(dashboardSha256, provenance.sourceTransitions.dashboard.currentSha256);
  assert.equal(deploySha256, dashboardSha256);
  assert.equal(workerSha256, provenance.sourceTransitions.worker.currentSha256);

  assert.equal(contracts.readOnly.protectedBehaviorBaselines.dashboardSourceSha256, dashboardSha256);
  assert.equal(contracts.readOnly.protectedBehaviorBaselines.dashboardDeployMirrorSha256, deploySha256);
  assert.equal(contracts.discovery.protectedBehaviorBaselines.dashboard.sha256, dashboardSha256);
  assert.equal(contracts.nearby.protectedBehaviorBaselines.dashboard.sha256, dashboardSha256);
  assert.equal(contracts.offRoute.protectedBehaviorBaselines.dashboardSource.sha256, dashboardSha256);
  assert.equal(contracts.offRoute.protectedBehaviorBaselines.dashboardDeployMirror.sha256, deploySha256);
  assert.equal(contracts.shadow.protectedBehaviorBaselines.dashboardSource.sha256, dashboardSha256);
  assert.equal(contracts.shadow.protectedBehaviorBaselines.dashboardDeployMirror.sha256, deploySha256);
  assert.equal(contracts.shadow.protectedBehaviorBaselines.worker.sha256, workerSha256);
});

test("every Intelligence consumer points to the same owner-reviewed successor", () => {
  assert.equal(contracts.readOnly.protectedBehaviorBaselineSuccessor, provenancePath);
  assert.equal(contracts.discovery.protectedBehaviorBaselineSuccessor, provenancePath);
  assert.equal(contracts.nearby.protectedBehaviorBaselineSuccessor, provenancePath);
  assert.equal(contracts.offRoute.protectedBehaviorBaselineSuccessor, provenancePath);
  assert.equal(contracts.shadow.artifacts.commercialReadinessBaselineSuccessor, provenancePath);
  assert.equal(contracts.shadow.protectedBehaviorBaselines.worker.provenanceSuccessor, provenancePath);
  assert.equal(contracts.shadow.protectedBehaviorBaselines.worker.predecessor.sha256, provenance.sourceTransitions.worker.predecessorSha256);
  assert.equal(contracts.shadow.protectedBehaviorBaselines.worker.predecessor.remainsHistorical, true);
  assert.equal(contracts.shadow.protectedBehaviorBaselines.worker.predecessor.rewritten, false);
});

test("baseline successor preserves all non-influence and release boundaries", () => {
  assert.equal(provenance.ownerSubsystem, "Prometheus Intelligence Engine");
  assert.equal(provenance.status, "OWNER_REVIEWED_AND_SYNCHRONIZED");
  assert.equal(provenance.independentReview.dashboardConsumerReadOnlyGet, true);
  assert.equal(provenance.independentReview.dashboardConsumerWritesBrowserStorage, false);
  assert.equal(provenance.independentReview.dashboardConsumerExposesShadowOutput, false);
  assert.equal(provenance.independentReview.workerEndpointConfiguredByDefault, false);
  assert.equal(provenance.independentReview.workerEndpointMethod, "GET");
  assert.equal(provenance.independentReview.workerEndpointRejectsRecommendationInfluence, true);
  assert.equal(provenance.independentReview.routeGenerationSourceChanged, false);
  assert.equal(provenance.independentReview.routeScoringSourceChanged, false);
  assert.equal(provenance.boundaries.collection, "OFF");
  assert.equal(provenance.boundaries.activeCohorts, 0);
  assert.equal(provenance.boundaries.recommendationInfluence, "OFF");
  assert.equal(provenance.boundaries.deploymentPerformed, false);
  assert.equal(provenance.boundaries.productionMutationPerformed, false);
});
