import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFileSync(resolve(root, path));
const json = path => JSON.parse(read(path).toString("utf8"));
const readAt = (commit, path) => execFileSync(
  "git",
  ["show", `${commit}:${path}`],
  { cwd: root, maxBuffer: 8 * 1024 * 1024 }
);
const jsonAt = (commit, path) => JSON.parse(readAt(commit, path).toString("utf8"));
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");

const provenancePath = "intelligence/provenance/protected-baseline-synchronization-batch-20260718-002-commercial-readiness-v1.json";
const intelligenceOwnerCommit = "185767ca4c72736343f29f691fd5138c5e0662b7";
const provenance = jsonAt(intelligenceOwnerCommit, provenancePath);
const contracts = {
  readOnly: jsonAt(intelligenceOwnerCommit,
    "intelligence/contracts/read-only-field-session-learning-contracts.json"),
  discovery: jsonAt(intelligenceOwnerCommit,
    "intelligence/contracts/discovery-mode-intelligence-v2-contracts.json"),
  nearby: jsonAt(intelligenceOwnerCommit,
    "intelligence/contracts/nearby-context-intelligence-v2-contracts.json"),
  offRoute: jsonAt(intelligenceOwnerCommit,
    "intelligence/contracts/off-route-learning-intelligence-contracts.json"),
  shadow: jsonAt(intelligenceOwnerCommit,
    "intelligence/contracts/shadow-decision-readiness-contracts.json")
};
const currentContracts = {
  readOnly: json("intelligence/contracts/read-only-field-session-learning-contracts.json"),
  discovery: json("intelligence/contracts/discovery-mode-intelligence-v2-contracts.json"),
  nearby: json("intelligence/contracts/nearby-context-intelligence-v2-contracts.json"),
  offRoute: json("intelligence/contracts/off-route-learning-intelligence-contracts.json"),
  shadow: json("intelligence/contracts/shadow-decision-readiness-contracts.json")
};

test("commercial-readiness protected baselines match the reviewed Dashboard and Worker owners", () => {
  const dashboardCommit = provenance.sourceTransitions.dashboard.contractAlignmentCommit;
  const workerCommit = provenance.sourceTransitions.worker.founderSnapshotEndpointCommit;
  const dashboardSha256 = sha256(readAt(dashboardCommit, "index.html"));
  const deploySha256 = sha256(readAt(dashboardCommit, "deploy/cloudflare-pages/index.html"));
  const workerSha256 = sha256(readAt(workerCommit, "workers/prometheus-iq-worker.js"));
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

  assert.equal(currentContracts.readOnly.protectedBehaviorBaselineSuccessor, provenancePath);
  assert.equal(currentContracts.discovery.protectedBehaviorBaselineSuccessor, provenancePath);
  assert.equal(currentContracts.nearby.protectedBehaviorBaselineSuccessor, provenancePath);
  assert.equal(currentContracts.offRoute.protectedBehaviorBaselineSuccessor, provenancePath);
  assert.equal(currentContracts.shadow.artifacts.commercialReadinessBaselineSuccessor,
    provenancePath);
  const august1 =
    "intelligence/provenance/protected-baseline-synchronization-route-iq-august-1-launch-closeout-v1.json";
  assert.equal(currentContracts.shadow.protectedBehaviorBaselines.dashboardSource.provenanceSuccessor,
    august1);
  assert.equal(currentContracts.shadow.protectedBehaviorBaselines.worker.provenanceSuccessor,
    august1);
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
  assert.equal(sha256(read("index.html")), sha256(read("deploy/cloudflare-pages/index.html")));
  assert.equal(currentContracts.shadow.implementationDispatch.recommendationInfluence, "OFF");
});
