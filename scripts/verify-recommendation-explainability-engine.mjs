import { runOfflineEvidenceHarness } from "../intelligence/field-learning-offline-evidence-harness.mjs";
import {
  buildConsumerExplanationContract,
  buildRecommendationExplanationV1,
  loadRecommendationExplainabilityContracts,
  recommendationExplainabilityVersion,
  validateConsumerExplanationContract,
  validateRecommendationExplanation
} from "../intelligence/recommendation-explainability-engine.mjs";

const contract = loadRecommendationExplainabilityContracts();
const offlineReport = runOfflineEvidenceHarness();
const failureReasons = [];
const explanations = [];

for (const scenario of offlineReport.scenarioResults) {
  const input = {
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
  const explanation = buildRecommendationExplanationV1(input, { contract });
  failureReasons.push(...validateRecommendationExplanation(explanation, contract).map(reason => `${scenario.scenarioId}: ${reason}`));

  for (const consumer of ["Mobile", "Dashboard", "Companion"]) {
    const payload = buildConsumerExplanationContract(explanation, consumer);
    failureReasons.push(...validateConsumerExplanationContract(payload, consumer, contract).map(reason => `${scenario.scenarioId}: ${reason}`));
  }

  explanations.push(explanation);
}

const summary = {
  status: failureReasons.length ? "failed" : "passed",
  engineVersion: recommendationExplainabilityVersion,
  contractVersion: contract.version,
  explanationCount: explanations.length,
  factorGroups: contract.factorGroups,
  consumerContracts: Object.keys(contract.consumerContracts),
  productionSafety: {
    productionRecommendationChanged: false,
    scoringChanged: false,
    dashboardRuntimeChanged: false,
    activePoolChanged: false,
    formulasExposed: false,
    proprietaryWeightsExposed: false
  },
  failureReasons
};

console.log(JSON.stringify(summary, null, 2));

if (summary.status !== "passed") {
  process.exitCode = 1;
}
