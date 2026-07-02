import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { runOfflineEvidenceHarness } from "../intelligence/field-learning-offline-evidence-harness.mjs";
import {
  buildConsumerExplanationContract,
  buildRecommendationExplanationV1,
  loadRecommendationExplainabilityContracts,
  validateConsumerExplanationContract,
  validateRecommendationExplanation
} from "../intelligence/recommendation-explainability-engine.mjs";

const root = resolve(import.meta.dirname, "..");

function explanationInputForScenario(scenario) {
  return {
    recommendationRef: scenario.explanation.recommendationRef,
    recommendation: {
      name: scenario.evidence.businessRef.name
    },
    evidence: scenario.evidence,
    signals: scenario.signals,
    confidence: scenario.confidenceAfter,
    location: {
      territoryQuality: true,
      coverageGap: scenario.scenarioId !== "duplicate-location",
      evidenceRefs: [scenario.evidence.evidenceId]
    },
    business: {
      categoryStrength: !["bad-lead", "closed-business", "wrong-business"].includes(scenario.scenarioId),
      opportunityLevel: scenario.scenarioId === "high-value-opportunity" ? "high" : "standard",
      evidenceRefs: [scenario.evidence.evidenceId]
    },
    history: {
      previousVisits: 0,
      evidenceRefs: [scenario.evidence.evidenceId]
    },
    route: {
      routeOptimized: true,
      travelEfficient: true,
      nearbyOpportunities: ["successful-sale", "high-value-opportunity", "follow-up-required"].includes(scenario.scenarioId),
      clusterQuality: !["bad-lead", "closed-business"].includes(scenario.scenarioId),
      evidenceRefs: [scenario.evidence.evidenceId]
    }
  };
}

test("recommendation explainability verifier passes", () => {
  const result = spawnSync("node", ["scripts/verify-recommendation-explainability-engine.mjs"], {
    cwd: root,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.status, "passed");
  assert.equal(summary.productionSafety.productionRecommendationChanged, false);
  assert.equal(summary.productionSafety.formulasExposed, false);
});

test("explanations answer why, confidence, evidence, change, and next action", () => {
  const contract = loadRecommendationExplainabilityContracts();
  const offlineReport = runOfflineEvidenceHarness();

  for (const scenario of offlineReport.scenarioResults) {
    const explanation = buildRecommendationExplanationV1(explanationInputForScenario(scenario), { contract });
    assert.deepEqual(validateRecommendationExplanation(explanation, contract), []);
    assert.ok(explanation.answers.why.length > 0, `${scenario.scenarioId} missing why`);
    assert.ok(explanation.answers.howConfident.includes("%"), `${scenario.scenarioId} missing confidence percent`);
    assert.ok(explanation.answers.whatEvidenceSupportsIt.length > 0, `${scenario.scenarioId} missing evidence`);
    assert.ok(explanation.answers.whatChanged.length > 0, `${scenario.scenarioId} missing what changed`);
    assert.ok(explanation.answers.whatShouldIDoNext.length > 0, `${scenario.scenarioId} missing next action`);
  }
});

test("explanations include all required intelligence factor groups", () => {
  const contract = loadRecommendationExplainabilityContracts();
  const scenario = runOfflineEvidenceHarness().scenarioResults.find(result => result.scenarioId === "high-value-opportunity");
  const explanation = buildRecommendationExplanationV1(explanationInputForScenario(scenario), { contract });
  const groups = explanation.factorGroups.map(group => group.group);

  for (const group of [
    "location_intelligence",
    "business_intelligence",
    "historical_intelligence",
    "route_intelligence",
    "learning_intelligence"
  ]) {
    assert.ok(groups.includes(group), `Missing factor group ${group}`);
  }
});

test("explanations use natural language without exposing formulas or proprietary weights", () => {
  const contract = loadRecommendationExplainabilityContracts();
  const scenario = runOfflineEvidenceHarness().scenarioResults.find(result => result.scenarioId === "successful-sale");
  const explanation = buildRecommendationExplanationV1(explanationInputForScenario(scenario), { contract });
  const publicText = [
    explanation.headline,
    explanation.summary,
    ...Object.values(explanation.answers),
    ...explanation.factorGroups.flatMap(group => group.factors.map(factor => factor.reason))
  ].join("\n");

  assert.match(explanation.summary, /Key reasons:/);
  assert.doesNotMatch(publicText, /\bformula\b|\bcoefficient\b|\bmultiplier\b|proprietary weight|internal scoring/i);
  assert.equal(explanation.safety.formulasExposed, false);
  assert.equal(explanation.safety.proprietaryWeightsExposed, false);
  assert.equal(explanation.safety.scoringChanged, false);
});

test("consumer contracts are generated for Mobile, Dashboard, and Companion", () => {
  const contract = loadRecommendationExplainabilityContracts();
  const scenario = runOfflineEvidenceHarness().scenarioResults.find(result => result.scenarioId === "follow-up-required");
  const explanation = buildRecommendationExplanationV1(explanationInputForScenario(scenario), { contract });

  for (const consumer of ["Mobile", "Dashboard", "Companion"]) {
    const payload = buildConsumerExplanationContract(explanation, consumer);
    assert.deepEqual(validateConsumerExplanationContract(payload, consumer, contract), []);
    assert.equal(payload.consumer, consumer);
    assert.equal(payload.contractVersion, contract.version);
  }
});

test("human override explanations require review and preserve human control", () => {
  const contract = loadRecommendationExplainabilityContracts();
  const scenario = runOfflineEvidenceHarness().scenarioResults.find(result => result.scenarioId === "duplicate-location");
  const explanation = buildRecommendationExplanationV1(explanationInputForScenario(scenario), { contract });
  const companion = buildConsumerExplanationContract(explanation, "Companion");

  assert.equal(explanation.reviewState, "human_review_required");
  assert.match(explanation.answers.whatShouldIDoNext, /Review the evidence/);
  assert.match(companion.founderReviewNotes, /Founder review is required/);
  assert.equal(explanation.safety.productionRecommendationChanged, false);
});
