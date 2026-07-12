import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  assertDiscoveryModeScope,
  buildDiscoveryModeAdvisoryPlan,
  loadDiscoveryModeConfig,
  loadDiscoveryModeContract,
  loadDiscoveryModeLearningPolicy,
  loadDiscoveryModeLearningSnapshot,
  normalizeDiscoveryCategory,
  validateDiscoveryModeAdvisoryPlan,
  validateDiscoveryModeConfig,
  validateDiscoveryModeContract
} from "../intelligence/discovery-mode-intelligence-v2.mjs";
import {
  buildCanonicalDiscoveryModePlan,
  verifyDiscoveryModeIntelligenceV2
} from "../scripts/verify-discovery-mode-intelligence-v2.mjs";

const root = new URL("../", import.meta.url);
const clone = value => JSON.parse(JSON.stringify(value));
const read = path => readFileSync(new URL(path, root));
const readJson = path => JSON.parse(read(path).toString("utf8"));
const sha256 = path => createHash("sha256").update(read(path)).digest("hex");

function fixtureCandidate(index, sourceCategory, overrides = {}) {
  return {
    id: `discovery-${index}`,
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    representativeId: "cruz",
    sourcePool: "active",
    routeEligible: true,
    name: `Discovery Candidate ${index}`,
    address: `${1000 + index} Test Street, Houston, TX 77001`,
    googlePlaceId: `place-${index}`,
    sourceCategory,
    category: sourceCategory,
    qualityClass: "Excellent",
    qualityScore: 95 - (index % 10),
    seedRouteOrder: index,
    window: index % 2 ? "Morning" : "Midday",
    qualityReason: "Existing governed route quality evidence.",
    ...overrides
  };
}

function diverseCandidates(perCategory = 5) {
  const categories = ["Auto", "Car Wash", "Restaurant", "Small Retail", "Barber", "Salon"];
  return categories.flatMap((category, categoryIndex) => Array.from({ length: perCategory }, (_, index) => (
    fixtureCandidate(categoryIndex * 100 + index, category)
  )));
}

function build(candidates = diverseCandidates(), overrides = {}) {
  return buildDiscoveryModeAdvisoryPlan({
    candidates,
    config: loadDiscoveryModeConfig(),
    contract: loadDiscoveryModeContract(),
    learningPolicy: loadDiscoveryModeLearningPolicy(),
    learningSnapshot: loadDiscoveryModeLearningSnapshot(),
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    representativeId: "cruz",
    generatedAt: "2026-07-12T00:36:02.000Z",
    ...overrides
  });
}

test("Discovery Mode Intelligence v2 verifier passes on current governed artifacts", () => {
  const result = verifyDiscoveryModeIntelligenceV2();

  assert.equal(result.status, "passed");
  assert.equal(result.categoryBalancing.plannedSize, 15);
  assert.equal(result.categoryBalancing.distinctCategoryCount, 4);
  assert.equal(result.categoryBalancing.maximumCategoryCount, 4);
  assert.equal(result.categoryBalancing.maximumCategoryShare, 0.2667);
  assert.ok(result.categoryBalancing.automotiveCount <= 4);
  assert.deepEqual(result.categoryBalancing.relaxations, []);
  assert.equal(result.safety.recommendationInfluenceActive, false);
  assert.equal(result.safety.routeScoringWeightsChanged, false);
});

test("governed configuration prohibits a fixed rotation and unsafe relaxations", () => {
  const config = loadDiscoveryModeConfig();

  assert.deepEqual(validateDiscoveryModeConfig(config), []);
  assert.equal(config.queueComposition.fixedCategoryRotation, false);
  assert.equal(Object.prototype.hasOwnProperty.call(config.queueComposition, "rotationOrder"), false);
  assert.equal(config.queueComposition.targetSize, 15);
  assert.equal(config.queueComposition.targetDistinctCategories, 6);
  assert.equal(config.queueComposition.minimumDistinctCategories, 4);
  assert.equal(config.queueComposition.categoryConcentration.maximumShare, 0.27);
  assert.equal(config.queueComposition.categoryConcentration.maximumCount, 4);
  assert.equal(config.queueComposition.relaxationPolicy.allowQualityFloorRelaxation, false);
  assert.equal(config.queueComposition.relaxationPolicy.allowWorkspaceRelaxation, false);
  assert.equal(config.queueComposition.relaxationPolicy.allowDuplicateRelaxation, false);
});

test("category taxonomy covers requested industries through configuration", () => {
  const config = loadDiscoveryModeConfig();
  const expected = {
    Auto: "automotive",
    "Car Wash": "automotive",
    Restaurant: "restaurants",
    Retail: "retail",
    "Medical Office": "medical",
    "Dental Office": "dental",
    Gym: "fitness",
    Salon: "salons",
    Barber: "salons",
    Insurance: "insurance",
    Bank: "financial",
    Roofing: "home_services",
    Logistics: "logistics",
    "Professional Services": "professional_services"
  };

  for (const [sourceCategory, categoryId] of Object.entries(expected)) {
    assert.equal(normalizeDiscoveryCategory(sourceCategory, config)?.categoryId, categoryId, sourceCategory);
  }
  assert.equal(normalizeDiscoveryCategory("Unsupported Mystery Category", config), null);
});

test("canonical advisory plan is deterministic and matches its checked-in artifact", () => {
  const first = buildCanonicalDiscoveryModePlan();
  const second = buildCanonicalDiscoveryModePlan();
  const canonical = readJson("intelligence/artifacts/discovery-mode-intelligence-v2/fitness_connection/cruz/discovery-queue-plan-v2.json");

  assert.deepEqual(second, first);
  assert.deepEqual(canonical, first);
  assert.deepEqual(validateDiscoveryModeAdvisoryPlan(first), []);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.queuePlan.entries), true);
});

test("adaptive composition reaches 15 with every available broad industry and no dominance", () => {
  const plan = build();
  const metrics = plan.queuePlan.compositionMetrics;

  assert.equal(plan.queuePlan.plannedSize, 15);
  assert.equal(metrics.distinctCategoryCount, 4);
  assert.ok(metrics.maximumCategoryCount <= 4);
  assert.ok(metrics.maximumCategoryShare <= 0.27);
  assert.equal(metrics.minimumDistinctCategoriesSatisfied, true);
  assert.equal(metrics.targetDistinctCategoriesSatisfied, false);
  assert.equal(metrics.strictConcentrationSatisfied, true);
  assert.equal(plan.queuePlan.relaxations.length, 0);
  assert.equal(new Set(plan.queuePlan.entries.map(entry => entry.identityKey)).size, 15);
});

test("existing recommendation quality is preserved as an immutable input", () => {
  const candidates = diverseCandidates();
  const qualityById = new Map(candidates.map(candidate => [candidate.id, candidate.qualityScore]));
  const plan = build(candidates);

  for (const entry of plan.queuePlan.entries) {
    assert.equal(entry.qualityScoreSnapshot, qualityById.get(entry.candidateId));
    assert.equal(entry.existingScoreChanged, false);
    assert.equal(entry.sourcePool, "active");
  }
  assert.equal(plan.queuePlan.qualityMetrics.existingScoresChanged, false);
  assert.equal(plan.queuePlan.qualityMetrics.qualityFloorRelaxed, false);
  assert.equal(plan.validation.routeScoringWeightsChanged, false);
});

test("July 11 evidence is emerging for Automotive and unobserved elsewhere", () => {
  const plan = buildCanonicalDiscoveryModePlan();
  const evidence = new Map(plan.evidenceThresholds.categoryEvidence.map(item => [item.categoryId, item]));

  assert.equal(evidence.get("automotive").maturity, "emerging");
  assert.equal(evidence.get("automotive").metrics.verifiedSessions, 1);
  assert.equal(evidence.get("automotive").metrics.visits, 4);
  assert.equal(evidence.get("automotive").metrics.conversations, 4);
  assert.equal(evidence.get("automotive").metrics.leads, 3);
  assert.equal(evidence.get("automotive").metrics.memberships, null);
  assert.equal(evidence.get("automotive").confidence.thresholdQualified, false);
  assert.equal(evidence.get("restaurants").maturity, "unobserved");
  assert.equal(evidence.get("retail").metrics.visits, 0);
  assert.equal(plan.fieldEvidenceBasis.learningInput, false);
});

test("evidence thresholds are inherited from governed learning policy", () => {
  const policy = loadDiscoveryModeLearningPolicy();
  const plan = build();

  assert.equal(plan.evidenceThresholds.sourcePolicy, policy.policyVersion);
  assert.deepEqual(plan.evidenceThresholds.thresholds, policy.evidenceThresholds.category);
  assert.equal(plan.evidenceThresholds.singleSessionCategoryPreferenceAllowed, false);
  assert.equal(plan.evidenceThresholds.territoryStatus, "unavailable_no_verified_identity");
});

test("every planned stop answers the five explainability questions", () => {
  const config = loadDiscoveryModeConfig();
  const plan = build();

  for (const entry of plan.queuePlan.entries) {
    for (const field of config.explainability.requiredQuestions) {
      assert.ok(entry.explanation[field], `${entry.candidateId}:${field}`);
    }
    assert.equal(entry.explanation.internalFormulaExposed, false);
    assert.equal(entry.explanation.proprietaryWeightsExposed, false);
  }
  assert.equal(plan.explainabilityModel.internalFormulaExposureAllowed, false);
  assert.equal(plan.explainabilityModel.proprietaryWeightExposureAllowed, false);
});

test("duplicates, ineligible candidates, weak quality, and unknown categories are excluded", () => {
  const candidates = diverseCandidates();
  candidates.push(fixtureCandidate(9001, "Auto", { googlePlaceId: candidates[0].googlePlaceId, qualityScore: 70 }));
  candidates.push(fixtureCandidate(9002, "Restaurant", { routeEligible: false }));
  candidates.push(fixtureCandidate(9003, "Salon", { sourcePool: "full" }));
  candidates.push(fixtureCandidate(9004, "Mystery Category"));
  const plan = build(candidates);

  assert.equal(plan.queuePlan.compositionMetrics.duplicateCount, 0);
  assert.equal(plan.queuePlan.entries.some(entry => entry.candidateId === "discovery-9002"), false);
  assert.equal(plan.queuePlan.entries.some(entry => entry.candidateId === "discovery-9003"), false);
  assert.equal(plan.queuePlan.entries.some(entry => entry.candidateId === "discovery-9004"), false);
  assert.ok(plan.queuePlan.candidateValidation.rejectedCount >= 4);
});

test("sparse supply relaxes only configured composition guards and stops short", () => {
  const candidates = Array.from({ length: 20 }, (_, index) => fixtureCandidate(index, "Auto"));
  const plan = build(candidates);

  assert.equal(plan.status, "depleted_advisory_plan");
  assert.equal(plan.queuePlan.plannedSize, 6);
  assert.ok(plan.queuePlan.relaxations.some(item => item.code === "maximum_consecutive_relaxed"));
  assert.ok(plan.queuePlan.relaxations.some(item => item.code === "category_concentration_relaxed"));
  assert.ok(plan.queuePlan.failureReasons.includes("queue_target_not_met_within_governed_constraints"));
  assert.equal(plan.queuePlan.qualityMetrics.qualityFloorRelaxed, false);
  assert.equal(plan.queuePlan.compositionMetrics.duplicateCount, 0);
});

test("territory-specific configuration applies only to an explicit verified identity", () => {
  const config = loadDiscoveryModeConfig();
  config.queueComposition.territoryOverrides.ring_1 = {
    targetSize: 8,
    targetDistinctCategories: 4,
    minimumDistinctCategories: 4,
    categoryConcentration: {
      maximumShare: 0.25,
      maximumCount: 2,
      maximumConsecutive: 1,
      enforcement: "when_qualified_alternatives_exist"
    }
  };
  const plan = build(diverseCandidates(), {
    config,
    territoryId: "ring_1",
    territoryCategoryEvidence: {
      ring_1: {
        automotive: { visits: 4 },
        restaurants: { visits: 0 }
      }
    }
  });

  assert.equal(plan.categoryBalancingStrategy.territoryOverrideApplied, true);
  assert.equal(plan.categoryBalancingStrategy.territoryOverrideId, "ring_1");
  assert.equal(plan.queuePlan.targetSize, 8);
  assert.equal(plan.queuePlan.plannedSize, 8);
  assert.equal(plan.evidenceThresholds.territoryStatus, "verified_identity_supplied");
  assert.equal(plan.validation.territoryInferencePerformed, false);
});

test("unknown workspace, wrong profile, and unauthorized representative fail closed", () => {
  const contract = loadDiscoveryModeContract();

  assert.throws(() => assertDiscoveryModeScope({ workspaceId: "smoothie_depot", operatingProfileId: "fitness", representativeId: "cruz", contract }), /not authorized/);
  assert.throws(() => build(undefined, { operatingProfileId: "franchise_development" }), /operating profile mismatch/);
  assert.throws(() => build(undefined, { representativeId: "unknown_rep" }), /representative is not authorized/);
});

test("contract remains advisory and creates no parallel production queue", () => {
  const contract = loadDiscoveryModeContract();
  const dashboard = read("index.html").toString("utf8");
  const continuousQueue = read("intelligence/continuous-adaptive-route-replenishment.mjs").toString("utf8");

  assert.deepEqual(validateDiscoveryModeContract(contract), []);
  assert.equal(contract.outputContract.runtimeConsumptionAuthorized, false);
  assert.equal(contract.outputContract.recommendationMutationAuthorized, false);
  assert.equal(contract.activationSafety.recommendationInfluenceActive, false);
  assert.equal(contract.activationSafety.productionQueueConsumerActive, false);
  assert.equal(dashboard.includes("discovery-mode-intelligence-v2"), false);
  assert.equal(continuousQueue.includes("discovery-mode-intelligence-v2"), false);
});

test("Dashboard, Route scoring, queue, Data, and learning baselines remain byte-identical", () => {
  const contract = loadDiscoveryModeContract();

  for (const [name, baseline] of Object.entries(contract.protectedBehaviorBaselines)) {
    assert.equal(sha256(baseline.path), baseline.sha256, name);
  }
});

test("all protected subsystem behavior flags remain false", () => {
  const plan = build();

  for (const field of [
    "recommendationInfluenceActive",
    "productionQueueConsumerActive",
    "routeScoringWeightsChanged",
    "dashboardRuntimeChanged",
    "dataChanged",
    "crmChanged",
    "companionChanged",
    "websiteChanged"
  ]) {
    assert.equal(plan.validation[field], false, field);
  }
  assert.equal(plan.learningImpact.productionLearningActivated, false);
});
