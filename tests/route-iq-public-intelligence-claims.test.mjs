import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";

const rootUrl = new URL("../", import.meta.url);
const policyPath = "intelligence/contracts/route-iq-public-intelligence-claims-v1.json";
const readJson = path => JSON.parse(readFileSync(new URL(path, rootUrl), "utf8"));
const sha256 = path => createHash("sha256").update(readFileSync(new URL(path, rootUrl))).digest("hex");
const policy = readJson(policyPath);

test("public Intelligence claim policy is owned, bounded, and non-activating", () => {
  assert.equal(policy.contractVersion, "route-iq-public-intelligence-claims-v1");
  assert.equal(policy.batchId, "BATCH-20260719-002");
  assert.equal(policy.ownerSubsystem, "Prometheus Intelligence Engine");
  assert.equal(policy.status, "active_public_claim_governance");
  assert.equal(policy.currentGovernedState.prospectiveCollection, "OFF");
  assert.equal(policy.currentGovernedState.activeCohorts, 0);
  assert.equal(policy.currentGovernedState.recommendationInfluence, "OFF");
  assert.equal(policy.safety.websiteFilesChangedByIntelligence, false);
  assert.equal(policy.safety.productionDeploymentAuthorized, false);
  assert.equal(policy.safety.recommendationActivationAuthorized, false);
});

test("every public claim source is byte-pinned canonical Intelligence evidence", () => {
  assert.equal(policy.canonicalEvidence.length, 8);
  for (const source of policy.canonicalEvidence) {
    assert.match(source.sha256, /^[a-f0-9]{64}$/);
    assert.equal(sha256(source.path), source.sha256, source.path);
    assert.ok(source.supports.length > 0, source.path);
  }
});

test("Discovery, Nearby Context, and off-route learning remain non-influential", () => {
  const discovery = readJson("intelligence/contracts/discovery-mode-intelligence-v2-contracts.json");
  assert.equal(discovery.status, "advisory_only");
  assert.equal(discovery.outputContract.runtimeConsumptionAuthorized, false);
  assert.equal(discovery.activationSafety.recommendationInfluenceActive, false);
  assert.equal(discovery.activationSafety.productionQueueConsumerActive, false);
  assert.equal(discovery.activationSafety.routeScoringWeightsChanged, false);

  const nearby = readJson("intelligence/contracts/nearby-context-intelligence-v2-contracts.json");
  assert.equal(nearby.status, "advisory_only");
  assert.equal(nearby.outputContract.runtimeConsumptionAuthorized, false);
  assert.equal(nearby.activationSafety.dashboardConsumerActive, false);
  assert.equal(nearby.activationSafety.recommendationReplacementActive, false);
  assert.equal(nearby.activationSafety.routeScoringWeightsChanged, false);

  const offRoute = readJson("intelligence/contracts/off-route-learning-intelligence-contracts.json");
  assert.equal(offRoute.status, "active_read_only_observation");
  assert.equal(offRoute.readOnlySafety.modifyRouteRuntime, false);
  assert.equal(offRoute.readOnlySafety.modifyRecommendationScoring, false);
  assert.equal(offRoute.readOnlySafety.modifyRouteGeneration, false);
  assert.equal(offRoute.readOnlySafety.activateRecommendationInfluence, false);
});

test("daily intelligence remains Founder-only, read-only, and insufficient", () => {
  const contract = readJson("intelligence/contracts/route-iq-commercial-readiness-intelligence-v1.json");
  const snapshot = readJson("intelligence/artifacts/route-iq-commercial-readiness-v1/fitness_connection/founder-daily-intelligence-snapshot-v1.json");
  assert.equal(contract.status, "active_read_only_founder_snapshot");
  assert.equal(contract.learningBoundary.predictionClaimsAllowed, false);
  assert.equal(contract.learningBoundary.causalClaimsAllowed, false);
  assert.equal(contract.learningBoundary.recommendationInfluence, "OFF");
  assert.equal(contract.learningBoundary.representativeOutputAllowed, false);
  assert.equal(snapshot.audience, "founder_only");
  assert.equal(snapshot.confidence.state, "INSUFFICIENT_EVIDENCE");
  assert.equal(snapshot.confidence.insufficiencyIsRecommendation, false);
  assert.equal(snapshot.confidence.predictionClaimed, false);
  assert.equal(snapshot.confidence.causalClaimed, false);
  assert.equal(snapshot.safety.representativeReadable, false);
  assert.equal(snapshot.safety.recommendationInfluence, "OFF");
});

test("shadow probabilities cannot be marketed as readiness or superiority", () => {
  const contract = readJson("intelligence/contracts/shadow-decision-readiness-contracts.json");
  const report = readJson("intelligence/artifacts/shadow-decision-readiness-v1/fitness_connection/cruz/founder-readiness-report-v1.json");
  assert.equal(contract.prospectiveRuntimeAdapter.currentState.readiness, "INSUFFICIENT_EVIDENCE");
  assert.equal(contract.prospectiveRuntimeAdapter.currentState.canonicalProductionProspectiveRecords, 0);
  assert.equal(contract.prospectiveRuntimeAdapter.currentState.collectionActivation, "OFF");
  assert.equal(contract.prospectiveRuntimeAdapter.currentState.recommendationInfluence, "OFF");
  assert.equal(contract.prospectiveRetentionAdmission.activeCohorts, 0);
  assert.equal(contract.prospectiveRetentionAdmission.canonicalProductionEvaluations, 0);
  assert.equal(contract.prospectiveRuntimeAdapter.representativeBoundary.probabilityExposed, false);
  assert.equal(contract.prospectiveRuntimeAdapter.representativeBoundary.readinessExposed, false);
  assert.equal(report.state, "INSUFFICIENT_EVIDENCE");
  assert.equal(report.metrics.scoreableSelectedCandidateOutcomeCount, 0);
  assert.equal(report.metrics.performanceAgainstObservationalBaseline, null);
  assert.equal(report.eligibilityDoesNotAuthorizeActivation, true);
  assert.equal(report.recommendationInfluence, "OFF");
});

test("learning is active only as governed read-only observation", () => {
  const learning = readJson("intelligence/contracts/read-only-field-session-learning-contracts.json");
  assert.equal(learning.status, "active_read_only");
  assert.equal(learning.productionSafety.readOnlyArchivedSessionLearningActive, true);
  assert.equal(learning.productionSafety.productionRecommendationInfluenceActive, false);
  assert.equal(learning.productionSafety.historicalReplayActive, false);
  assert.equal(learning.productionSafety.archiveMutationAllowed, false);
  assert.equal(learning.workspaceIsolation.crossWorkspaceAggregationAllowed, false);
});

test("approved semantics require human control and prohibit inflated Intelligence claims", () => {
  assert.match(policy.approvedPublicSemantics.probability, /not as guaranteed outcomes/);
  assert.match(policy.approvedPublicSemantics.decisionReady, /does not mean ELIGIBLE_FOR_FOUNDER_REVIEW/);
  assert.match(policy.approvedPublicSemantics.humanControl, /person remains responsible/);
  for (const required of [
    "human_decision_remains_controlling",
    "observational_evidence_does_not_establish_causal_uplift",
    "recommendation_superiority_is_not_proven",
    "recommendation_influence_is_off"
  ]) assert.ok(policy.requiredPublicQualifications.includes(required));
  for (const prohibited of [
    "ai_magic_or_unbounded_ai_operating_system",
    "autonomous_business_decisions",
    "automatic_route_improvement_from_current_learning",
    "causal_uplift",
    "proven_recommendation_superiority",
    "recommendation_readiness",
    "representative_facing_shadow_rankings_probabilities_or_confidence"
  ]) assert.ok(policy.prohibitedPublicClaims.includes(prohibited));
});

test("Founder and representative boundaries remain explicit", () => {
  assert.equal(policy.audienceBoundary.publicWebsiteMayExposeCanonicalFounderArtifacts, false);
  assert.equal(policy.audienceBoundary.publicWebsiteMayExposeShadowOutputs, false);
  assert.equal(policy.audienceBoundary.representativeMayReadFounderSnapshot, false);
  assert.equal(policy.audienceBoundary.representativeMayReadShadowReadiness, false);
  assert.equal(policy.audienceBoundary.representativeMayReceiveShadowRecommendation, false);
  assert.equal(policy.audienceBoundary.founderAccessRequiresServerVerifiedIdentityMapping, true);
  assert.equal(policy.audienceBoundary.displayNameAuthorizationAllowed, false);
  assert.equal(policy.audienceBoundary.cruzMappingStatus, "SECURELY_MAPPED");
  assert.equal(policy.audienceBoundary.anthonyMappingStatus, "PENDING_NOT_AUTHORIZED");
});
