import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = path => readFileSync(resolve(root, path), "utf8");
const readJson = path => JSON.parse(read(path));

const failures = [];
const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

const requiredFiles = [
  "intelligence/README.md",
  "intelligence/adaptive-outside-sales-intelligence-engine.md",
  "intelligence/adaptive-field-learning-loop-foundation.md",
  "intelligence/field-learning-offline-evidence-harness.mjs",
  "intelligence/recommendation-explainability-engine.mjs",
  "intelligence/operating-profile-engine.mjs",
  "intelligence/field-evidence-activation-foundation.md",
  "intelligence/subsystem-contracts.md",
  "intelligence/future-subsystem-handoffs.md",
  "intelligence/field-learning-loop-handoffs.md",
  "intelligence/fixtures/field-visit-evidence-fixtures.json",
  "intelligence/contracts/adaptive-intelligence-contracts.json",
  "intelligence/contracts/field-learning-loop-contracts.json",
  "intelligence/contracts/recommendation-explainability-contracts.json",
  "intelligence/contracts/operating-profile-contracts.json",
  "intelligence/profiles/operating-profiles.json",
  "scripts/verify-field-learning-offline-evidence-harness.mjs",
  "scripts/verify-recommendation-explainability-engine.mjs",
  "COMPANY_IDENTITY.md",
  "PRODUCT_VISION.md",
  "RESEARCH_FOUNDATION.md",
  "research/README.md",
  "sales/README.md",
  "crm/README.md",
  "docs/route-intelligence-v2-architecture.md",
  "docs/continuous-learning-framework.md",
  "scripts/verify-route-intelligence-quality-gate.mjs",
  "scripts/govern-runtime-pool-refresh.mjs"
];

for (const file of requiredFiles) {
  try {
    read(file);
  } catch (error) {
    assert(false, `Missing required intelligence architecture source: ${file}`);
  }
}

const architecture = read("intelligence/adaptive-outside-sales-intelligence-engine.md");
const fieldLearning = read("intelligence/adaptive-field-learning-loop-foundation.md");
const offlineHarness = read("intelligence/field-learning-offline-evidence-harness.mjs");
const explainabilityEngine = read("intelligence/recommendation-explainability-engine.mjs");
const operatingProfileEngine = read("intelligence/operating-profile-engine.mjs");
const fieldEvidenceActivation = read("intelligence/field-evidence-activation-foundation.md");
const contractsDoc = read("intelligence/subsystem-contracts.md");
const handoffs = read("intelligence/future-subsystem-handoffs.md");
const fieldHandoffs = read("intelligence/field-learning-loop-handoffs.md");
const readme = read("intelligence/README.md");
const systemMap = read("PROMETHEUS_SYSTEM_MAP.md");
const contracts = readJson("intelligence/contracts/adaptive-intelligence-contracts.json");
const fieldContracts = readJson("intelligence/contracts/field-learning-loop-contracts.json");
const explainabilityContracts = readJson("intelligence/contracts/recommendation-explainability-contracts.json");
const operatingProfileContracts = readJson("intelligence/contracts/operating-profile-contracts.json");
const operatingProfiles = readJson("intelligence/profiles/operating-profiles.json");
const fieldFixtures = readJson("intelligence/fixtures/field-visit-evidence-fixtures.json");

const requiredArchitectureSections = [
  "Visit Outcome Learning",
  "Confidence Engine",
  "Recommendation Explanation Engine",
  "Industry Intelligence",
  "Territory Intelligence",
  "Rep Intelligence",
  "Organization Intelligence",
  "Continuous Learning Pipeline",
  "Opportunity Ranking",
  "Pattern Detection",
  "Recommendation Confidence",
  "Explainable AI",
  "Human Override",
  "Knowledge Graph",
  "Learning Contracts",
  "Determinism Requirements",
  "Explainability Requirements",
  "Enterprise Safety Requirements"
];

for (const section of requiredArchitectureSections) {
  assert(architecture.includes(section), `Architecture missing section or capability: ${section}`);
}

const requiredContracts = [
  "EvidenceEvent",
  "LearningSignal",
  "ConfidenceAssessment",
  "RecommendationExplanation",
  "PatternFinding",
  "HumanOverride",
  "KnowledgeGraphFact",
  "OpportunityRankingResult"
];

for (const contractName of requiredContracts) {
  assert(contractsDoc.includes(contractName), `Contracts doc missing ${contractName}`);
  assert(Boolean(contracts.contracts?.[contractName]), `Contract registry missing ${contractName}`);
  assert(Array.isArray(contracts.contracts?.[contractName]?.requiredFields), `Contract ${contractName} must declare requiredFields`);
}

const requiredFieldLearningSections = [
  "Field Evidence Capture",
  "Evidence Admission",
  "Learning Signal Normalization",
  "Confidence Framework",
  "Explainability Framework",
  "Human Override",
  "Dashboard",
  "CRM",
  "Research",
  "Companion",
  "Sales",
  "Activation Gate"
];

for (const section of requiredFieldLearningSections) {
  assert(fieldLearning.includes(section), `Field Learning Loop foundation missing section: ${section}`);
}

const requiredOfflineHarnessScenarios = [
  "successful-sale",
  "no-decision-maker",
  "closed-business",
  "duplicate-location",
  "wrong-business",
  "gatekeeper",
  "follow-up-required",
  "competitor-present",
  "customer-objection",
  "bad-lead",
  "high-value-opportunity"
];

for (const scenarioId of requiredOfflineHarnessScenarios) {
  assert(fieldFixtures.scenarios?.some(scenario => scenario.scenarioId === scenarioId), `Field visit fixtures missing scenario ${scenarioId}`);
}

const requiredOfflineHarnessExports = [
  "runOfflineEvidenceHarness",
  "normalizeFixtureToEvidence",
  "admitFieldEvidence",
  "normalizeLearningSignals",
  "buildConfidenceSnapshot",
  "buildRecommendationExplanation"
];
for (const exportName of requiredOfflineHarnessExports) {
  assert(offlineHarness.includes(`export function ${exportName}`), `Offline evidence harness missing export ${exportName}`);
}

const requiredExplainabilityExports = [
  "buildRecommendationExplanationV1",
  "buildConsumerExplanationContract",
  "validateRecommendationExplanation",
  "validateConsumerExplanationContract"
];
for (const exportName of requiredExplainabilityExports) {
  assert(explainabilityEngine.includes(`export function ${exportName}`), `Recommendation Explainability Engine missing export ${exportName}`);
}

const requiredOperatingProfileExports = [
  "loadOperatingProfileContracts",
  "loadOperatingProfiles",
  "getOperatingProfile",
  "listOperatingProfiles",
  "normalizeIndustryOutcome",
  "buildNormalizedOutcomeModel",
  "buildProfileConsumerContract",
  "validateOperatingProfile",
  "validateOperatingProfileRegistry"
];
for (const exportName of requiredOperatingProfileExports) {
  assert(operatingProfileEngine.includes(`export function ${exportName}`), `Operating Profile Engine missing export ${exportName}`);
}

const requiredOperatingProfiles = [
  "general_outside_sales",
  "fitness",
  "roofing",
  "security",
  "medical",
  "insurance",
  "solar",
  "home_services"
];
for (const profileId of requiredOperatingProfiles) {
  assert(operatingProfiles.profiles?.some(profile => profile.profileId === profileId), `Operating Profiles registry missing ${profileId}`);
  assert(operatingProfileContracts.requiredProfiles.includes(profileId), `Operating Profile contracts missing required profile ${profileId}`);
}

const requiredNormalizedOutcomes = [
  "visited",
  "decision_maker_reached",
  "conversation",
  "sale",
  "lead",
  "inspection",
  "estimate",
  "referral",
  "contract",
  "appointment",
  "no_decision_maker",
  "closed_business",
  "duplicate",
  "wrong_business",
  "competitor",
  "follow_up"
];
for (const outcome of requiredNormalizedOutcomes) {
  assert(operatingProfiles.normalizedOutcomeVocabulary.includes(outcome), `Operating Profiles registry missing normalized outcome ${outcome}`);
}

assert(JSON.stringify(operatingProfiles.normalizedOutcomeModel.sequence) === JSON.stringify(["Visit", "Outcome", "Evidence", "Learning Signal", "Confidence", "Recommendation"]), "Operating Profiles registry must preserve the normalized outcome sequence.");

const requiredOperatingProfileConsumerContracts = [
  "DashboardOperatingProfileContract",
  "CRMOperatingProfileContract",
  "CompanionOperatingProfileContract",
  "MobileOperatingProfileContract",
  "WebsiteOperatingProfileContract",
  "ResearchOperatingProfileContract",
  "SalesOperatingProfileContract",
  "SocialMediaOperatingProfileContract"
];
for (const contractName of requiredOperatingProfileConsumerContracts) {
  assert(contractsDoc.includes(contractName), `Contracts doc missing ${contractName}`);
  assert(Boolean(operatingProfileContracts.contracts?.[contractName]), `Operating Profile contract registry missing ${contractName}`);
}

const requiredExplainabilityFactorGroups = [
  "location_intelligence",
  "business_intelligence",
  "historical_intelligence",
  "route_intelligence",
  "learning_intelligence"
];
for (const group of requiredExplainabilityFactorGroups) {
  assert(explainabilityContracts.factorGroups.includes(group), `Recommendation Explainability contracts missing factor group ${group}`);
}

const requiredExplainabilityQuestions = [
  "why",
  "how_confident",
  "what_evidence_supports_it",
  "what_changed",
  "what_should_i_do_next"
];
for (const question of requiredExplainabilityQuestions) {
  assert(explainabilityContracts.requiredQuestions.includes(question), `Recommendation Explainability contracts missing question ${question}`);
}

const requiredExplainabilityConsumerContracts = [
  "MobileRecommendationExplanation",
  "DashboardRecommendationExplanation",
  "CompanionRecommendationExplanation"
];
for (const contractName of requiredExplainabilityConsumerContracts) {
  assert(contractsDoc.includes(contractName), `Contracts doc missing ${contractName}`);
  assert(Boolean(explainabilityContracts.consumerContracts?.[contractName]), `Recommendation Explainability registry missing ${contractName}`);
}

const requiredEvidenceFields = [
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

for (const field of requiredEvidenceFields) {
  assert(fieldContracts.evidenceFields.includes(field), `Field Learning Loop registry missing evidence field ${field}`);
}

const requiredFieldContracts = [
  "FieldEvidenceEvent",
  "FieldEvidenceAdmissionDecision",
  "FieldLearningSignal",
  "FieldConfidenceSnapshot",
  "FieldRecommendationExplanation",
  "FieldHumanOverride"
];

for (const contractName of requiredFieldContracts) {
  assert(contractsDoc.includes(contractName), `Contracts doc missing ${contractName}`);
  assert(Boolean(fieldContracts.contracts?.[contractName]), `Field Learning Loop registry missing ${contractName}`);
  assert(Array.isArray(fieldContracts.contracts?.[contractName]?.requiredFields), `Field contract ${contractName} must declare requiredFields`);
}

const requiredFieldConfidenceFields = [
  "confidenceBand",
  "confidenceScore",
  "evidenceCount",
  "lastValidationAt",
  "learningTrend"
];
for (const field of requiredFieldConfidenceFields) {
  assert(fieldContracts.confidenceFields.includes(field), `Field Learning Loop registry missing confidence field ${field}`);
}

const requiredExplanationQuestions = [
  "why",
  "what_evidence",
  "how_confident",
  "what_changed",
  "what_was_learned",
  "next_rep_behavior"
];
for (const question of requiredExplanationQuestions) {
  assert(fieldContracts.explanationQuestions.includes(question), `Field Learning Loop registry missing explanation question ${question}`);
}

const requiredHandoffs = ["Dashboard", "CRM", "Research", "Companion", "Data", "Sales"];
for (const subsystem of requiredHandoffs) {
  assert(handoffs.includes(`${subsystem} Handoff`), `Future handoff missing ${subsystem}`);
  assert(contracts.futureSubsystemHandoffs.includes(subsystem), `Contract registry missing ${subsystem} handoff`);
}

const requiredFieldHandoffs = ["Dashboard", "CRM", "Research", "Companion", "Sales"];
for (const subsystem of requiredFieldHandoffs) {
  assert(fieldHandoffs.includes(`${subsystem} Handoff`), `Field Learning Loop handoff missing ${subsystem}`);
  assert(fieldContracts.futureSubsystemContracts.includes(subsystem), `Field Learning Loop registry missing ${subsystem} contract`);
}

const requiredProhibitions = [
  "no_production_scoring_changes",
  "no_dashboard_runtime_changes",
  "no_active_pool_modifications",
  "no_data_governance_changes",
  "no_anthony_beta_changes",
  "no_crm_modifications"
];
for (const prohibition of requiredProhibitions) {
  assert(contracts.prohibitions.includes(prohibition), `Contract registry missing prohibition ${prohibition}`);
}

assert(contracts.status === "architecture_only", "Contract registry must remain architecture_only.");
assert(contracts.productionBehaviorChanged === false, "Architecture must not declare production behavior changes.");
assert(contracts.scoringChanged === false, "Architecture must not declare scoring changes.");
assert(contracts.dashboardRuntimeChanged === false, "Architecture must not declare Dashboard runtime changes.");
assert(contracts.activePoolChanged === false, "Architecture must not declare Active Pool changes.");
assert(contracts.dataGovernanceChanged === false, "Architecture must not declare Data governance changes.");
assert(contracts.capabilityDomains.length >= 15, "Contract registry must cover all 15 requested capability domains.");
assert(fieldContracts.status === "architecture_only", "Field Learning Loop registry must remain architecture_only.");
assert(fieldContracts.productionBehaviorChanged === false, "Field Learning Loop must not declare production behavior changes.");
assert(fieldContracts.scoringChanged === false, "Field Learning Loop must not declare scoring changes.");
assert(fieldContracts.dashboardRuntimeChanged === false, "Field Learning Loop must not declare Dashboard runtime changes.");
assert(fieldContracts.activePoolChanged === false, "Field Learning Loop must not declare Active Pool changes.");
assert(fieldContracts.dataGovernanceChanged === false, "Field Learning Loop must not declare Data governance changes.");
assert(fieldContracts.infrastructureChanged === false, "Field Learning Loop must not declare Infrastructure changes.");
assert(fieldContracts.anthonyBetaChanged === false, "Field Learning Loop must not declare Anthony beta changes.");
assert(fieldContracts.productionLearningActive === false, "Field Learning Loop must not activate production learning.");
assert(fieldContracts.prohibitions.includes("no_production_learning_activation"), "Field Learning Loop registry must prohibit production learning activation.");
assert(fieldContracts.requiredActivationGates.includes("human_review_state"), "Field Learning Loop registry must require human review state.");
assert(fieldFixtures.status === "offline_validation_only", "Field visit fixtures must remain offline_validation_only.");
assert(fieldFixtures.productionLearningActive === false, "Field visit fixtures must not activate production learning.");
assert(explainabilityContracts.status === "explanation_layer_only", "Recommendation Explainability registry must remain explanation_layer_only.");
assert(explainabilityContracts.productionRecommendationChanged === false, "Recommendation Explainability must not declare production recommendation changes.");
assert(explainabilityContracts.scoringChanged === false, "Recommendation Explainability must not declare scoring changes.");
assert(explainabilityContracts.dashboardRuntimeChanged === false, "Recommendation Explainability must not declare Dashboard runtime changes.");
assert(explainabilityContracts.proprietaryWeightsExposed === false, "Recommendation Explainability must not expose proprietary weights.");
assert(explainabilityContracts.formulasExposed === false, "Recommendation Explainability must not expose formulas.");
assert(explainabilityContracts.prohibitions.includes("no_formula_disclosure"), "Recommendation Explainability must prohibit formula disclosure.");
assert(explainabilityContracts.prohibitions.includes("no_weight_disclosure"), "Recommendation Explainability must prohibit weight disclosure.");
assert(operatingProfileContracts.status === "architecture_only", "Operating Profile contracts must remain architecture_only.");
assert(operatingProfiles.status === "architecture_only", "Operating Profile registry must remain architecture_only.");
assert(operatingProfiles.productionLearningActive === false, "Operating Profile registry must not activate production learning.");
assert(operatingProfiles.productionRecommendationChanged === false, "Operating Profile registry must not change production recommendations.");
assert(operatingProfiles.dashboardRuntimeChanged === false, "Operating Profile registry must not change Dashboard runtime.");
assert(operatingProfiles.mobileBetaChanged === false, "Operating Profile registry must not change Mobile beta behavior.");
assert(operatingProfiles.scoringChanged === false, "Operating Profile registry must not change scoring.");
assert(operatingProfiles.activePoolChanged === false, "Operating Profile registry must not change Active Pool.");
assert(operatingProfiles.crmRuntimeChanged === false, "Operating Profile registry must not change CRM runtime.");
assert(operatingProfiles.websiteChanged === false, "Operating Profile registry must not change Website.");
assert(operatingProfiles.companionRuntimeChanged === false, "Operating Profile registry must not change Companion runtime.");
assert(operatingProfiles.infrastructureChanged === false, "Operating Profile registry must not change Infrastructure.");
assert(operatingProfileContracts.prohibitions.includes("no_live_recommendation_scoring_changes"), "Operating Profile contracts must prohibit live recommendation scoring changes.");
assert(fieldEvidenceActivation.includes("Visit -> Outcome -> Evidence -> Learning Signal -> Confidence -> Recommendation"), "Field Evidence Activation foundation must document the normalized outcome model.");
assert(fieldEvidenceActivation.includes("Dashboard") && fieldEvidenceActivation.includes("CRM") && fieldEvidenceActivation.includes("Companion") && fieldEvidenceActivation.includes("Mobile") && fieldEvidenceActivation.includes("Website") && fieldEvidenceActivation.includes("Research") && fieldEvidenceActivation.includes("Sales") && fieldEvidenceActivation.includes("Social Media"), "Field Evidence Activation foundation must include profile consumer contracts.");
assert(readme.includes("Duplicate Prevention"), "Intelligence README must include duplicate-prevention guidance.");
assert(systemMap.includes("Adaptive Outside Sales Intelligence Engine"), "System map must reference the Adaptive Outside Sales Intelligence Engine foundation.");
assert(systemMap.includes("Do not create a second learning engine"), "System map must preserve Intelligence duplicate-prevention language.");
assert(systemMap.includes("Field Learning Loop rule"), "System map must include Field Learning Loop duplicate-prevention guidance.");
assert(systemMap.includes("Offline learning validation rule"), "System map must include offline learning duplicate-prevention guidance.");
assert(systemMap.includes("Recommendation explainability rule"), "System map must include recommendation explainability duplicate-prevention guidance.");
assert(systemMap.includes("Operating Profile rule"), "System map must include Operating Profile duplicate-prevention guidance.");

if (failures.length) {
  console.error("Prometheus Intelligence architecture validation failed:");
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log("Prometheus Intelligence architecture validated: adaptive outside-sales contracts, handoffs, duplicate prevention, and no-production-change flags.");
}
