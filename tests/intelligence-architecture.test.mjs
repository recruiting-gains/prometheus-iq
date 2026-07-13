import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = path => readFileSync(resolve(root, path), "utf8");
const readJson = path => JSON.parse(read(path));

test("intelligence architecture validation gate passes", () => {
  const result = spawnSync("node", ["scripts/validate-intelligence-architecture.mjs"], {
    cwd: root,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test("adaptive intelligence contract registry is architecture-only", () => {
  const contracts = readJson("intelligence/contracts/adaptive-intelligence-contracts.json");

  assert.equal(contracts.status, "architecture_only");
  assert.equal(contracts.productionBehaviorChanged, false);
  assert.equal(contracts.scoringChanged, false);
  assert.equal(contracts.dashboardRuntimeChanged, false);
  assert.equal(contracts.activePoolChanged, false);
  assert.equal(contracts.dataGovernanceChanged, false);
});

test("adaptive intelligence architecture covers required outside-sales learning domains", () => {
  const contracts = readJson("intelligence/contracts/adaptive-intelligence-contracts.json");
  const requiredDomains = [
    "visit_outcome_learning",
    "confidence_engine",
    "recommendation_explanation_engine",
    "industry_intelligence",
    "territory_intelligence",
    "rep_intelligence",
    "organization_intelligence",
    "continuous_learning_pipeline",
    "opportunity_ranking",
    "pattern_detection",
    "recommendation_confidence",
    "explainable_ai",
    "human_override",
    "knowledge_graph",
    "learning_contracts"
  ];

  for (const domain of requiredDomains) {
    assert.ok(contracts.capabilityDomains.includes(domain), `Missing domain ${domain}`);
  }
});

test("future subsystem handoffs are prepared without production integration", () => {
  const handoffs = read("intelligence/future-subsystem-handoffs.md");
  const expected = ["Dashboard Handoff", "CRM Handoff", "Research Handoff", "Companion Handoff", "Data Handoff", "Sales Handoff"];

  for (const heading of expected) {
    assert.ok(handoffs.includes(heading), `Missing ${heading}`);
  }
  assert.ok(handoffs.includes("This document prepares future handoffs. It does not authorize implementation."));
});

test("field learning loop foundation covers completed visit evidence and learning contracts", () => {
  const foundation = read("intelligence/adaptive-field-learning-loop-foundation.md");
  const contracts = readJson("intelligence/contracts/field-learning-loop-contracts.json");

  const expectedEvidenceFields = [
    "business_visited",
    "date_time",
    "gps_confirmation",
    "decision_maker_reached",
    "conversation_occurred",
    "sale_made",
    "no_decision_maker",
    "closed_business",
    "wrong_business",
    "duplicate",
    "no_parking",
    "gatekeeper",
    "follow_up_needed",
    "competitor_present",
    "customer_objections",
    "notes",
    "photos_future"
  ];

  for (const field of expectedEvidenceFields) {
    assert.ok(contracts.evidenceFields.includes(field), `Missing evidence field ${field}`);
  }

  for (const heading of ["Field Evidence Capture", "Learning Signal Normalization", "Confidence Framework", "Explainability Framework", "Human Override"]) {
    assert.ok(foundation.includes(heading), `Missing foundation heading ${heading}`);
  }
});

test("field learning loop remains production-safe and reviewable", () => {
  const contracts = readJson("intelligence/contracts/field-learning-loop-contracts.json");

  assert.equal(contracts.status, "architecture_only");
  assert.equal(contracts.productionBehaviorChanged, false);
  assert.equal(contracts.scoringChanged, false);
  assert.equal(contracts.dashboardRuntimeChanged, false);
  assert.equal(contracts.activePoolChanged, false);
  assert.equal(contracts.dataGovernanceChanged, false);
  assert.equal(contracts.infrastructureChanged, false);
  assert.equal(contracts.anthonyBetaChanged, false);
  assert.equal(contracts.productionLearningActive, false);
  assert.ok(contracts.requiredActivationGates.includes("human_review_state"));
  assert.ok(contracts.prohibitions.includes("no_production_learning_activation"));
});

test("field learning loop prepares required subsystem contracts without consumption", () => {
  const handoffs = read("intelligence/field-learning-loop-handoffs.md");
  const contracts = readJson("intelligence/contracts/field-learning-loop-contracts.json");
  const expected = ["Dashboard", "CRM", "Research", "Companion", "Sales"];

  for (const subsystem of expected) {
    assert.ok(handoffs.includes(`${subsystem} Handoff`), `Missing ${subsystem} handoff`);
    assert.ok(contracts.futureSubsystemContracts.includes(subsystem), `Missing ${subsystem} contract`);
  }

  assert.ok(handoffs.includes("It does not authorize production integration."));
});

test("read-only archived-session learning is independently authorized without recommendation activation", () => {
  const contract = readJson("intelligence/contracts/read-only-field-session-learning-contracts.json");
  const policy = readJson("intelligence/config/read-only-field-session-learning-policy-v1.json");
  const snapshot = readJson("intelligence/artifacts/read-only-field-session-learning/fitness_connection/cruz/learning-snapshot-v1.json");

  assert.equal(contract.status, "active_read_only");
  assert.equal(contract.independentAuthorization.status, "AUTHORIZED_ACTIVE");
  assert.equal(contract.independentAuthorization.accessMode, "read_only");
  assert.equal(contract.allowedOperations.modifyData, false);
  assert.equal(contract.allowedOperations.replaySessions, false);
  assert.equal(contract.productionSafety.productionRecommendationInfluenceActive, false);
  assert.equal(contract.productionSafety.routeScoringWeightsChanged, false);
  assert.equal(policy.recommendationInfluence.singleSessionInfluenceAllowed, false);
  assert.equal(policy.recommendationInfluence.activationStatus, "disabled_pending_future_handoff");
  assert.equal(snapshot.sourceEvidence.verifiedSessionCount, 1);
  assert.equal(snapshot.recommendationSafety.recommendationEligibleConclusionCount, 0);
  assert.equal(snapshot.archiveSafety.archiveMutationPerformed, false);
  assert.equal(snapshot.archiveSafety.historicalReplayPerformed, false);
});

test("off-route learning is source-aware, unknown-safe, and observation-only", () => {
  const contract = readJson("intelligence/contracts/off-route-learning-intelligence-contracts.json");
  const policy = readJson("intelligence/config/off-route-learning-intelligence-v1.json");
  const snapshot = readJson("intelligence/artifacts/off-route-learning-intelligence-v1/fitness_connection/cruz/off-route-learning-snapshot-v1.json");

  assert.equal(contract.status, "active_read_only_observation");
  assert.equal(contract.upstreamReadOnlyLearning.canonicalArchiveReaderReused, true);
  assert.equal(contract.decisionSourceContract.unknownFallbackRequired, true);
  assert.equal(contract.decisionSourceContract.notesMaySupplySource, false);
  assert.equal(contract.recommendationDecisionContract.overrideRequiresExplicitDecisionContext, true);
  assert.equal(contract.recommendationDecisionContract.offRouteAutomaticallyMeansOverride, false);
  assert.equal(contract.validationFixturePolicy.productionConsumptionAllowed, false);
  assert.equal(contract.readOnlySafety.modifyData, false);
  assert.equal(contract.readOnlySafety.modifyDashboard, false);
  assert.equal(contract.readOnlySafety.modifyRecommendationScoring, false);
  assert.equal(contract.readOnlySafety.activateRecommendationInfluence, false);
  assert.equal(policy.sourceTaxonomy.length, 8);
  assert.equal(policy.recommendationInfluence.activationStatus, "disabled_observation_only");
  assert.equal(snapshot.sourceEvidence.totalVisits, 4);
  assert.equal(snapshot.sourceEvidence.knownSourceVisits, 0);
  assert.equal(snapshot.sourceEvidence.unknownSourceVisits, 4);
  assert.equal(snapshot.recommendationAcceptanceRate.valuePercent, null);
  assert.equal(snapshot.recommendationOverrideRate.valuePercent, null);
  assert.equal(snapshot.learningConfidence.recommendationInfluenceEligible, false);
  assert.equal(snapshot.safety.recommendationScoringChanged, false);
  assert.equal(snapshot.safety.recommendationBehaviorChanged, false);
});

test("Discovery Mode v2 is a governed advisory composer without production influence", () => {
  const contract = readJson("intelligence/contracts/discovery-mode-intelligence-v2-contracts.json");
  const config = readJson("intelligence/config/discovery-mode-intelligence-v2.json");
  const plan = readJson("intelligence/artifacts/discovery-mode-intelligence-v2/fitness_connection/cruz/discovery-queue-plan-v2.json");

  assert.equal(contract.status, "advisory_only");
  assert.equal(contract.outputContract.runtimeConsumptionAuthorized, false);
  assert.equal(contract.outputContract.recommendationMutationAuthorized, false);
  assert.equal(contract.compositionContract.fixedRotationAllowed, false);
  assert.equal(contract.eligibilityContract.canonicalImplementation, "intelligence/route-business-hours-eligibility.mjs");
  assert.equal(contract.eligibilityContract.balancingOccursAfterEligibility, true);
  assert.equal(contract.eligibilityContract.closedVerifiedEligible, false);
  assert.equal(config.queueComposition.fixedCategoryRotation, false);
  assert.equal(config.queueComposition.preserveExistingScores, true);
  assert.equal(config.candidatePolicy.requiresCanonicalBusinessHoursEligibility, true);
  assert.equal(config.evidencePolicy.singleSessionCategoryPreferenceAllowed, false);
  assert.equal(config.activationSafety.recommendationInfluenceActive, false);
  assert.equal(config.activationSafety.routeScoringWeightsChanged, false);
  assert.equal(plan.queuePlan.plannedSize, 15);
  assert.ok(plan.queuePlan.compositionMetrics.distinctCategoryCount >= 4);
  assert.ok(plan.queuePlan.compositionMetrics.maximumCategoryShare <= 0.27);
  assert.equal(plan.queuePlan.compositionMetrics.duplicateCount, 0);
  assert.equal(plan.queuePlan.eligibilityMetrics.selectedClosedVerifiedCount, 0);
  assert.equal(plan.queuePlan.eligibilityMetrics.scoringChanged, false);
  assert.equal(plan.validation.canonicalBusinessHoursEligibilityPreserved, true);
  assert.equal(plan.validation.productionQueueConsumerActive, false);
});

test("Nearby Context v2 is relationship-aware, governed, and consumer-safe", () => {
  const contract = readJson("intelligence/contracts/nearby-context-intelligence-v2-contracts.json");
  const config = readJson("intelligence/config/nearby-context-intelligence-v2.json");
  const audit = readJson("intelligence/artifacts/nearby-context-intelligence-v2/fitness_connection/cruz/nearby-context-audit-v2.json");

  assert.equal(contract.status, "advisory_only");
  assert.equal(contract.outputContract.runtimeConsumptionAuthorized, false);
  assert.equal(contract.outputContract.recommendationMutationAuthorized, false);
  assert.equal(contract.eligibilityContract.canonicalImplementation, "intelligence/route-business-hours-eligibility.mjs");
  assert.equal(contract.eligibilityContract.relationshipClassificationOccursAfterEligibility, true);
  assert.equal(contract.eligibilityContract.closedVerifiedEligible, false);
  assert.equal(contract.identityContract.canonicalFunction, "routeQueueIdentity");
  assert.equal(contract.identityContract.googlePlaceIdPriority, true);
  assert.equal(contract.identityContract.duplicateRemovalBeforeRelationshipInference, true);
  assert.equal(contract.identityContract.duplicateAliasesContributeToInference, false);
  assert.equal(contract.identityContract.multiTenantDistinction, "distinct_google_place_ids_remain_distinct");
  assert.deepEqual(contract.relationshipContract.priorityOrder, [
    "same_building",
    "same_shopping_center",
    "same_commercial_parcel",
    "walkable",
    "nearby"
  ]);
  assert.equal(contract.selectionContract.quarantineSelectable, false);
  assert.equal(contract.selectionContract.completedBusinessesSelectable, false);
  assert.equal(contract.selectionContract.recommendationScoresUsedForOrdering, false);
  assert.equal(config.identityPolicy.deduplicationPhase, "before_relationship_classification");
  assert.equal(config.identityPolicy.shoppingCenterInferenceInput, "unique_canonical_businesses_only");
  assert.equal(config.identityPolicy.duplicateAliasContributionAllowed, false);
  assert.equal(config.fieldEvidenceBasis.learningInput, false);
  assert.equal(config.activationSafety.dashboardConsumerActive, false);
  assert.equal(config.activationSafety.routeScoringWeightsChanged, false);
  assert.equal(audit.stressContexts.length, 2);
  assert.equal(audit.stressContexts.every(context => context.plan.status === "coverage_gap"), true);
  assert.equal(audit.stressContexts.every(context => context.plan.nearbyOpportunities.emptyState.recommendationInvented === false), true);
  assert.equal(audit.governedCapabilityProbe.nearbyOpportunities.count, 6);
  assert.equal(audit.governedCapabilityProbe.nearbyOpportunities.entries.every(entry => entry.eligibilitySnapshot.status === "OPEN_VERIFIED"), true);
  assert.equal(audit.governedCapabilityProbe.nearbyOpportunities.entries.every(entry => entry.recommendationScoreChanged === false), true);
  assert.equal(audit.identityIntegrationRegression.aliasProbe.preRelationshipDuplicateCount, 1);
  assert.equal(audit.identityIntegrationRegression.aliasProbe.relationshipInferenceInputCount, 1);
  assert.equal(audit.identityIntegrationRegression.aliasProbe.shoppingCenterInferenceSatisfied, false);
  assert.equal(audit.identityIntegrationRegression.multiTenantProbe.resultCount, 2);
});
