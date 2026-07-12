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
  "intelligence/read-only-field-session-learning.mjs",
  "intelligence/read-only-field-session-learning.md",
  "intelligence/discovery-mode-intelligence-v2.mjs",
  "intelligence/discovery-mode-intelligence-v2.md",
  "intelligence/recommendation-explainability-engine.mjs",
  "intelligence/operating-profile-engine.mjs",
  "intelligence/field-evidence-activation-foundation.md",
  "intelligence/customer-intelligence-graph.mjs",
  "intelligence/customer-intelligence-graph.md",
  "intelligence/continuous-adaptive-route-replenishment.mjs",
  "intelligence/subsystem-contracts.md",
  "intelligence/future-subsystem-handoffs.md",
  "intelligence/field-learning-loop-handoffs.md",
  "intelligence/fixtures/field-visit-evidence-fixtures.json",
  "intelligence/contracts/adaptive-intelligence-contracts.json",
  "intelligence/contracts/field-learning-loop-contracts.json",
  "intelligence/contracts/read-only-field-session-learning-contracts.json",
  "intelligence/config/read-only-field-session-learning-policy-v1.json",
  "intelligence/artifacts/read-only-field-session-learning/fitness_connection/cruz/learning-snapshot-v1.json",
  "intelligence/contracts/discovery-mode-intelligence-v2-contracts.json",
  "intelligence/config/discovery-mode-intelligence-v2.json",
  "intelligence/artifacts/discovery-mode-intelligence-v2/fitness_connection/cruz/discovery-queue-plan-v2.json",
  "intelligence/contracts/recommendation-explainability-contracts.json",
  "intelligence/contracts/operating-profile-contracts.json",
  "intelligence/contracts/customer-intelligence-graph-contracts.json",
  "intelligence/contracts/business-acquisition-intelligence-contracts.json",
  "intelligence/contracts/continuous-adaptive-route-replenishment-contracts.json",
  "intelligence/profiles/operating-profiles.json",
  "intelligence/workspaces/smoothie-depot/workspace-intelligence-plan.md",
  "intelligence/workspaces/smoothie-depot/workspace-intelligence-plan.json",
  "scripts/verify-field-learning-offline-evidence-harness.mjs",
  "scripts/verify-read-only-field-session-learning.mjs",
  "scripts/verify-discovery-mode-intelligence-v2.mjs",
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
const readOnlyFieldSessionLearning = read("intelligence/read-only-field-session-learning.mjs");
const readOnlyFieldSessionLearningDoc = read("intelligence/read-only-field-session-learning.md");
const discoveryModeIntelligence = read("intelligence/discovery-mode-intelligence-v2.mjs");
const discoveryModeIntelligenceDoc = read("intelligence/discovery-mode-intelligence-v2.md");
const explainabilityEngine = read("intelligence/recommendation-explainability-engine.mjs");
const operatingProfileEngine = read("intelligence/operating-profile-engine.mjs");
const fieldEvidenceActivation = read("intelligence/field-evidence-activation-foundation.md");
const customerIntelligenceGraph = read("intelligence/customer-intelligence-graph.mjs");
const customerIntelligenceGraphDoc = read("intelligence/customer-intelligence-graph.md");
const contractsDoc = read("intelligence/subsystem-contracts.md");
const handoffs = read("intelligence/future-subsystem-handoffs.md");
const fieldHandoffs = read("intelligence/field-learning-loop-handoffs.md");
const readme = read("intelligence/README.md");
const systemMap = read("PROMETHEUS_SYSTEM_MAP.md");
const contracts = readJson("intelligence/contracts/adaptive-intelligence-contracts.json");
const fieldContracts = readJson("intelligence/contracts/field-learning-loop-contracts.json");
const readOnlyFieldSessionLearningContracts = readJson("intelligence/contracts/read-only-field-session-learning-contracts.json");
const readOnlyFieldSessionLearningPolicy = readJson("intelligence/config/read-only-field-session-learning-policy-v1.json");
const readOnlyFieldSessionLearningSnapshot = readJson("intelligence/artifacts/read-only-field-session-learning/fitness_connection/cruz/learning-snapshot-v1.json");
const discoveryModeContracts = readJson("intelligence/contracts/discovery-mode-intelligence-v2-contracts.json");
const discoveryModeConfig = readJson("intelligence/config/discovery-mode-intelligence-v2.json");
const discoveryModePlan = readJson("intelligence/artifacts/discovery-mode-intelligence-v2/fitness_connection/cruz/discovery-queue-plan-v2.json");
const explainabilityContracts = readJson("intelligence/contracts/recommendation-explainability-contracts.json");
const operatingProfileContracts = readJson("intelligence/contracts/operating-profile-contracts.json");
const customerGraphContracts = readJson("intelligence/contracts/customer-intelligence-graph-contracts.json");
const businessAcquisitionContracts = readJson("intelligence/contracts/business-acquisition-intelligence-contracts.json");
const adaptiveReplenishmentContracts = readJson("intelligence/contracts/continuous-adaptive-route-replenishment-contracts.json");
const operatingProfiles = readJson("intelligence/profiles/operating-profiles.json");
const smoothieDepotWorkspacePlan = readJson("intelligence/workspaces/smoothie-depot/workspace-intelligence-plan.json");
const smoothieDepotWorkspaceDoc = read("intelligence/workspaces/smoothie-depot/workspace-intelligence-plan.md");
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

const requiredReadOnlyFieldSessionLearningExports = [
  "loadReadOnlyFieldSessionLearningContract",
  "loadReadOnlyFieldSessionLearningPolicy",
  "loadReadOnlyFieldSessionDataContract",
  "loadCanonicalArchivedFieldSessionPackages",
  "validateReadOnlyFieldSessionLearningPolicy",
  "validateReadOnlyFieldSessionLearningContract",
  "validateArchivedFieldSessionPackage",
  "buildReadOnlyFieldSessionLearningSnapshot",
  "validateReadOnlyFieldSessionLearningSnapshot"
];
for (const exportName of requiredReadOnlyFieldSessionLearningExports) {
  assert(readOnlyFieldSessionLearning.includes(`export function ${exportName}`), `Read-only field-session learning engine missing export ${exportName}`);
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
  "home_services",
  "franchise_development"
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

const requiredCustomerGraphExports = [
  "loadCustomerIntelligenceGraphContracts",
  "normalizeCustomerGraphNodeType",
  "normalizeCustomerGraphRelationshipType",
  "buildCustomerGraphNode",
  "buildCustomerGraphRelationship",
  "buildCustomerGraphSnapshot",
  "buildCustomerGraphQueryContract",
  "queryCustomerGraphSnapshot",
  "validateCustomerGraphContracts",
  "validateCustomerGraphSnapshot",
  "buildCustomerGraphConsumerContract",
  "validateCustomerGraphQueryContract"
];
for (const exportName of requiredCustomerGraphExports) {
  assert(customerIntelligenceGraph.includes(`export function ${exportName}`), `Customer Intelligence Graph missing export ${exportName}`);
}

const requiredCustomerGraphNodeTypes = [
  "Business",
  "Visit",
  "Lead",
  "Outcome",
  "Opportunity",
  "Rep",
  "Manager",
  "Territory",
  "Operating Profile",
  "Customer",
  "Learning Signal"
];
for (const nodeType of requiredCustomerGraphNodeTypes) {
  assert(customerGraphContracts.nodeTypes.includes(nodeType), `Customer Intelligence Graph contracts missing node type ${nodeType}`);
  assert(customerIntelligenceGraphDoc.includes(nodeType), `Customer Intelligence Graph doc missing node type ${nodeType}`);
}

const requiredCustomerGraphRelationshipTypes = [
  "Visited",
  "Recommended",
  "Converted",
  "Follow-up",
  "Nearby",
  "Similar",
  "Repeated",
  "Successful",
  "Inactive"
];
for (const relationshipType of requiredCustomerGraphRelationshipTypes) {
  assert(customerGraphContracts.relationshipTypes.includes(relationshipType), `Customer Intelligence Graph contracts missing relationship type ${relationshipType}`);
  assert(customerIntelligenceGraphDoc.includes(relationshipType), `Customer Intelligence Graph doc missing relationship type ${relationshipType}`);
}

const requiredCustomerGraphObjectives = [
  "opportunity_relationships",
  "territory_relationships",
  "customer_relationships",
  "rep_performance_trends",
  "cross_industry_learning",
  "confidence_propagation"
];
for (const objective of requiredCustomerGraphObjectives) {
  assert(customerGraphContracts.graphObjectives.includes(objective), `Customer Intelligence Graph contracts missing objective ${objective}`);
}

const requiredCustomerGraphContracts = [
  "CustomerGraphNode",
  "CustomerGraphRelationship",
  "CustomerGraphSnapshot",
  "DashboardCustomerGraphContract",
  "CRMCustomerGraphContract",
  "MobileCustomerGraphContract",
  "WebsiteCustomerGraphContract",
  "CompanionCustomerGraphContract",
  "ResearchCustomerGraphContract",
  "SalesCustomerGraphContract",
  "CustomerGraphQueryRequest",
  "CustomerGraphQueryResult",
  "DashboardCustomerGraphQueryContract",
  "CRMCustomerGraphQueryContract",
  "MobileCustomerGraphQueryContract",
  "WebsiteCustomerGraphQueryContract",
  "CompanionCustomerGraphQueryContract",
  "ResearchCustomerGraphQueryContract",
  "SalesCustomerGraphQueryContract"
];
for (const contractName of requiredCustomerGraphContracts) {
  assert(contractsDoc.includes(contractName), `Contracts doc missing ${contractName}`);
  assert(Boolean(customerGraphContracts.contracts?.[contractName]), `Customer Intelligence Graph registry missing ${contractName}`);
}

const requiredBusinessAcquisitionContracts = [
  "FranchiseCandidateSourcing",
  "BusinessProspectResearch",
  "FranchiseReadinessAssessment",
  "CandidateIntelligenceProfile",
  "SmoothieDepotCrmPipelineStages",
  "SmoothieDepotDashboardDisplayNeeds",
  "JrHandoffPackage",
  "CommissionTracking",
  "CandidateProtectionPeriod",
  "WorkspaceIsolationGuardrails"
];
for (const contractName of requiredBusinessAcquisitionContracts) {
  assert(Boolean(smoothieDepotWorkspacePlan.contracts?.[contractName]), `Smoothie Depot workspace plan missing ${contractName}`);
  assert(Boolean(businessAcquisitionContracts.contracts?.[contractName]), `Business Acquisition Intelligence contracts missing ${contractName}`);
  assert(businessAcquisitionContracts.requiredContracts.includes(contractName), `Business Acquisition Intelligence registry must require ${contractName}`);
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
assert(readOnlyFieldSessionLearningContracts.status === "active_read_only", "Read-only field-session learning contract must be active read-only.");
assert(readOnlyFieldSessionLearningContracts.independentAuthorization.status === "AUTHORIZED_ACTIVE", "Read-only field-session learning independent authorization must be active.");
assert(readOnlyFieldSessionLearningContracts.independentAuthorization.accessMode === "read_only", "Read-only field-session learning authorization must remain read-only.");
assert(readOnlyFieldSessionLearningContracts.allowedOperations.modifyData === false, "Read-only field-session learning must not modify Data.");
assert(readOnlyFieldSessionLearningContracts.allowedOperations.deleteArchives === false, "Read-only field-session learning must not delete archives.");
assert(readOnlyFieldSessionLearningContracts.allowedOperations.rewriteSessions === false, "Read-only field-session learning must not rewrite sessions.");
assert(readOnlyFieldSessionLearningContracts.allowedOperations.replaySessions === false, "Read-only field-session learning must not replay sessions.");
assert(readOnlyFieldSessionLearningContracts.allowedOperations.createHistoricalEvidence === false, "Read-only field-session learning must not create historical evidence.");
assert(readOnlyFieldSessionLearningContracts.allowedOperations.consumeRawEvidence === false, "Read-only field-session learning must not consume raw evidence.");
assert(readOnlyFieldSessionLearningContracts.productionSafety.readOnlyArchivedSessionLearningActive === true, "Read-only archived-session learning must be active.");
assert(readOnlyFieldSessionLearningContracts.productionSafety.productionRecommendationInfluenceActive === false, "Read-only field-session learning must not influence production recommendations.");
assert(readOnlyFieldSessionLearningContracts.productionSafety.routeScoringWeightsChanged === false, "Read-only field-session learning must not change route scoring weights.");
assert(readOnlyFieldSessionLearningContracts.productionSafety.dashboardRuntimeChanged === false, "Read-only field-session learning must not change Dashboard runtime.");
assert(readOnlyFieldSessionLearningContracts.productionSafety.dataRuntimeChanged === false, "Read-only field-session learning must not change Data runtime.");
assert(readOnlyFieldSessionLearningContracts.productionSafety.crmRuntimeChanged === false, "Read-only field-session learning must not change CRM runtime.");
assert(readOnlyFieldSessionLearningContracts.productionSafety.companionRuntimeChanged === false, "Read-only field-session learning must not change Companion runtime.");
assert(readOnlyFieldSessionLearningPolicy.status === "active", "Read-only field-session learning policy must be active.");
for (const domain of ["representative", "territory", "category", "business"]) {
  assert(Boolean(readOnlyFieldSessionLearningPolicy.evidenceThresholds[domain]), `Read-only field-session learning policy missing ${domain} thresholds.`);
}
assert(readOnlyFieldSessionLearningPolicy.recommendationInfluence.singleSessionInfluenceAllowed === false, "Read-only field-session learning policy must block single-session influence.");
assert(readOnlyFieldSessionLearningPolicy.recommendationInfluence.activationStatus === "disabled_pending_future_handoff", "Read-only field-session learning recommendation influence must remain disabled.");
assert(readOnlyFieldSessionLearningSnapshot.ownerSubsystem === "Prometheus Intelligence Engine", "Read-only field-session learning snapshot must be Intelligence-owned.");
assert(readOnlyFieldSessionLearningSnapshot.sourceSubsystem === "Prometheus Data", "Read-only field-session learning snapshot must identify Data as source owner.");
assert(readOnlyFieldSessionLearningSnapshot.sourceAccessMode === "read_only", "Read-only field-session learning snapshot must preserve read-only source access.");
assert(readOnlyFieldSessionLearningSnapshot.sourceEvidence.verifiedSessionCount === 1, "Read-only field-session learning snapshot must consume the one authorized session.");
assert(readOnlyFieldSessionLearningSnapshot.recommendationSafety.recommendationEligibleConclusionCount === 0, "Read-only field-session learning snapshot must not contain recommendation-eligible conclusions.");
assert(readOnlyFieldSessionLearningSnapshot.archiveSafety.historicalReplayPerformed === false, "Read-only field-session learning snapshot must not replay history.");
assert(readOnlyFieldSessionLearningDoc.includes("deterministic read-only snapshot projection"), "Read-only field-session learning doc must describe snapshot projection.");
assert(readOnlyFieldSessionLearningDoc.includes("No normalization is performed"), "Read-only field-session learning doc must prohibit re-normalization.");
assert(readOnlyFieldSessionLearningDoc.includes("The first verified session remains observation-only"), "Read-only field-session learning doc must preserve the evidence threshold.");
assert(discoveryModeContracts.status === "advisory_only", "Discovery Mode v2 contracts must remain advisory only.");
assert(discoveryModeContracts.outputContract.runtimeConsumptionAuthorized === false, "Discovery Mode v2 must not authorize runtime consumption.");
assert(discoveryModeContracts.outputContract.recommendationMutationAuthorized === false, "Discovery Mode v2 must not authorize recommendation mutation.");
assert(discoveryModeContracts.compositionContract.fixedRotationAllowed === false, "Discovery Mode v2 must prohibit fixed category rotation.");
assert(discoveryModeContracts.compositionContract.qualityFloorAuthoritative === true, "Discovery Mode v2 must preserve the quality floor.");
assert(discoveryModeContracts.scopePolicy.unknownWorkspaceBehavior === "fail_closed", "Discovery Mode v2 must fail closed for unknown workspaces.");
assert(discoveryModeContracts.scopePolicy.smoothieDepotInfluence === false, "Discovery Mode v2 must prohibit Smoothie Depot influence.");
assert(discoveryModeContracts.designEvidence.stressTestObservationConsumedAsLearning === false, "Discovery Mode v2 must not promote stress observations into learned evidence.");
assert(discoveryModeConfig.queueComposition.fixedCategoryRotation === false, "Discovery Mode v2 configuration must not define a fixed rotation.");
assert(discoveryModeConfig.queueComposition.targetDistinctCategories >= 6, "Discovery Mode v2 must target broad category coverage.");
assert(discoveryModeConfig.queueComposition.minimumDistinctCategories >= 4, "Discovery Mode v2 minimum viable category coverage regressed.");
assert(discoveryModeConfig.queueComposition.categoryConcentration.maximumShare <= 0.27, "Discovery Mode v2 category concentration ceiling regressed.");
assert(discoveryModeConfig.queueComposition.preserveExistingScores === true, "Discovery Mode v2 must preserve existing scores.");
assert(discoveryModeConfig.evidencePolicy.thresholdSourcePolicyVersion === readOnlyFieldSessionLearningPolicy.policyVersion, "Discovery Mode v2 must inherit governed learning thresholds.");
assert(discoveryModeConfig.evidencePolicy.singleSessionCategoryPreferenceAllowed === false, "Discovery Mode v2 must block single-session category preference.");
assert(discoveryModeConfig.activationSafety.recommendationInfluenceActive === false, "Discovery Mode v2 recommendation influence must remain disabled.");
assert(discoveryModeConfig.activationSafety.routeScoringWeightsChanged === false, "Discovery Mode v2 must not change route scoring weights.");
assert(discoveryModeConfig.activationSafety.dashboardRuntimeChanged === false, "Discovery Mode v2 must not change Dashboard runtime.");
assert(discoveryModePlan.queuePlan.plannedSize === 15, "Discovery Mode v2 canonical advisory plan must contain 15 candidates.");
assert(discoveryModePlan.queuePlan.compositionMetrics.distinctCategoryCount >= discoveryModeConfig.queueComposition.minimumDistinctCategories, "Discovery Mode v2 canonical advisory plan must meet minimum viable category coverage.");
assert(discoveryModePlan.queuePlan.compositionMetrics.maximumCategoryShare <= discoveryModeConfig.queueComposition.categoryConcentration.maximumShare, "Discovery Mode v2 canonical category concentration regressed.");
assert(discoveryModePlan.queuePlan.compositionMetrics.duplicateCount === 0, "Discovery Mode v2 canonical advisory plan contains duplicates.");
assert(discoveryModePlan.queuePlan.qualityMetrics.existingScoresChanged === false, "Discovery Mode v2 canonical advisory plan changed candidate scores.");
assert(discoveryModePlan.validation.recommendationInfluenceActive === false, "Discovery Mode v2 canonical plan activated recommendation influence.");
assert(discoveryModePlan.validation.productionQueueConsumerActive === false, "Discovery Mode v2 canonical plan activated a production queue consumer.");
assert(discoveryModeIntelligence.includes("export function buildDiscoveryModeAdvisoryPlan"), "Discovery Mode v2 composer export is missing.");
for (const section of ["Discovery Queue Architecture", "Category Balancing Strategy", "Evidence Thresholds", "Learning Impact", "Explainability Model", "Configuration Model", "Activation Boundary"]) {
  assert(discoveryModeIntelligenceDoc.includes(section), `Discovery Mode v2 architecture missing ${section}.`);
}
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
assert(customerGraphContracts.status === "architecture_only", "Customer Intelligence Graph contracts must remain architecture_only.");
assert(customerGraphContracts.activationMode === "read_only_customer_scoped_snapshots", "Customer Intelligence Graph must declare read-only snapshot activation.");
assert(customerGraphContracts.readOnly === true, "Customer Intelligence Graph contracts must remain readOnly.");
assert(customerGraphContracts.queryable === true, "Customer Intelligence Graph contracts must remain queryable.");
assert(customerGraphContracts.automaticLearningActive === false, "Customer Intelligence Graph must not activate automatic learning.");
assert(customerGraphContracts.automaticScoringActive === false, "Customer Intelligence Graph must not activate automatic scoring.");
assert(customerGraphContracts.activePoolChanged === false, "Customer Intelligence Graph must not change Active Pool.");
assert(customerGraphContracts.humanOverridePreserved === true, "Customer Intelligence Graph must preserve human override.");
assert(customerGraphContracts.customerIsolationRequired === true, "Customer Intelligence Graph must require customer isolation.");
assert(customerGraphContracts.consumerImplementationActive === false, "Customer Intelligence Graph must not activate consumers.");
assert(customerGraphContracts.productionScoringChanged === false, "Customer Intelligence Graph must not change production scoring.");
assert(customerGraphContracts.productionRecommendationsChanged === false, "Customer Intelligence Graph must not change production recommendations.");
assert(customerGraphContracts.dashboardRuntimeChanged === false, "Customer Intelligence Graph must not change Dashboard runtime.");
assert(customerGraphContracts.mobileRuntimeChanged === false, "Customer Intelligence Graph must not change Mobile runtime.");
assert(customerGraphContracts.websiteRuntimeChanged === false, "Customer Intelligence Graph must not change Website runtime.");
assert(customerGraphContracts.companionRuntimeChanged === false, "Customer Intelligence Graph must not change Companion runtime.");
assert(customerGraphContracts.prohibitions.includes("no_cross_customer_graph_bleed"), "Customer Intelligence Graph must prohibit cross-customer graph bleed.");
assert(customerGraphContracts.prohibitions.includes("no_confidence_propagation_activation"), "Customer Intelligence Graph must prohibit confidence propagation activation.");
assert(customerGraphContracts.prohibitions.includes("no_production_scoring"), "Customer Intelligence Graph must prohibit production scoring.");
assert(customerIntelligenceGraphDoc.includes("CustomerGraphSnapshots"), "Customer Intelligence Graph doc must describe CustomerGraphSnapshots.");
assert(customerIntelligenceGraphDoc.includes("Where did this come from?"), "Customer Intelligence Graph doc must describe provenance questions.");
assert(customerIntelligenceGraphDoc.includes("WebsiteCustomerGraphQueryContract"), "Customer Intelligence Graph doc must include Website query contract.");
assert(customerIntelligenceGraphDoc.includes("no automatic learning"), "Customer Intelligence Graph doc must prohibit automatic learning.");
for (const contentKey of ["businesses", "visits", "outcomes", "leads", "opportunities", "rep_activity", "manager_activity", "territories", "opportunity_relationships", "evidence_history", "confidence", "operating_profile", "learning_provenance"]) {
  assert(customerGraphContracts.snapshotContent.includes(contentKey), `Customer Intelligence Graph contracts missing snapshot content ${contentKey}`);
}
for (const queryType of ["snapshot_summary", "by_node_type", "by_relationship_type", "by_business", "by_territory", "by_rep", "by_opportunity", "by_evidence", "by_confidence", "by_operating_profile"]) {
  assert(customerGraphContracts.queryTypes.includes(queryType), `Customer Intelligence Graph contracts missing query type ${queryType}`);
}
assert(businessAcquisitionContracts.status === "planning_contracts_only", "Business Acquisition Intelligence contracts must remain planning_contracts_only.");
assert(businessAcquisitionContracts.workspaceId === "smoothie_depot", "Business Acquisition Intelligence contracts must be scoped to Smoothie Depot.");
assert(businessAcquisitionContracts.operatingProfileId === "franchise_development", "Business Acquisition Intelligence must use Franchise Development Operating Profile.");
assert(businessAcquisitionContracts.domainId === "business_acquisition_intelligence", "Business Acquisition Intelligence domain must be confirmed.");
assert(businessAcquisitionContracts.newSubsystemCreated === false, "Business Acquisition Intelligence must not create a new subsystem.");
assert(businessAcquisitionContracts.fitnessConnectionIsolationConfirmed === true, "Business Acquisition Intelligence must confirm Fitness Connection isolation.");
assert(businessAcquisitionContracts.routeIntelligenceInfluence === false, "Business Acquisition Intelligence must not influence Route Intelligence.");
assert(businessAcquisitionContracts.fitnessConnectionRouteInfluence === false, "Business Acquisition Intelligence must not influence Fitness Connection routes.");
assert(businessAcquisitionContracts.dashboardRuntimeChanged === false, "Business Acquisition Intelligence must not change Dashboard runtime.");
assert(businessAcquisitionContracts.crmRuntimeChanged === false, "Business Acquisition Intelligence must not change CRM runtime.");
assert(businessAcquisitionContracts.websiteChanged === false, "Business Acquisition Intelligence must not change Website.");
assert(businessAcquisitionContracts.mobileChanged === false, "Business Acquisition Intelligence must not change Mobile.");
assert(businessAcquisitionContracts.companionChanged === false, "Business Acquisition Intelligence must not change Companion.");
assert(businessAcquisitionContracts.prohibitions.includes("no_fitness_connection_route_intelligence_influence"), "Business Acquisition Intelligence must prohibit Fitness Connection Route Intelligence influence.");
assert(smoothieDepotWorkspacePlan.workspaceName === "Smoothie Depot", "Smoothie Depot workspace plan must name Smoothie Depot.");
assert(smoothieDepotWorkspacePlan.decisionMaker === "JR", "Smoothie Depot workspace plan must identify JR.");
assert(smoothieDepotWorkspacePlan.workspaceIsolation.fitnessConnectionIsolationConfirmed === true, "Smoothie Depot workspace must confirm Fitness Connection isolation.");
assert(smoothieDepotWorkspacePlan.workspaceIsolation.routeIntelligenceInfluence === false, "Smoothie Depot workspace must not influence Route Intelligence.");
assert(smoothieDepotWorkspaceDoc.includes("Workspace Isolation Guardrails"), "Smoothie Depot workspace doc must include isolation guardrails.");
assert(adaptiveReplenishmentContracts.workspacePolicy.authorizedWorkspaceId === "fitness_connection", "Adaptive route replenishment must be scoped to Fitness Connection Route IQ.");
assert(adaptiveReplenishmentContracts.workspacePolicy.unknownWorkspaceBehavior === "fail_closed", "Adaptive route replenishment must fail closed for unknown workspaces.");
assert(adaptiveReplenishmentContracts.workspacePolicy.crossWorkspaceLearning === false, "Adaptive route replenishment must prohibit cross-workspace learning.");
assert(adaptiveReplenishmentContracts.queuePolicy.targetSize === 15, "Adaptive route replenishment must target 15 active stops.");
assert(adaptiveReplenishmentContracts.queuePolicy.replenishmentThreshold === 5, "Adaptive route replenishment threshold must be five stops.");
assert(adaptiveReplenishmentContracts.queuePolicy.concurrency === "single_flight", "Adaptive route replenishment must use single-flight concurrency.");
assert(adaptiveReplenishmentContracts.candidatePolicy.primaryPool === "active", "Adaptive route replenishment must prioritize Active Pool candidates.");
assert(adaptiveReplenishmentContracts.candidatePolicy.fallbackPool === "full", "Adaptive route replenishment must preserve Full Pool fallback.");
assert(adaptiveReplenishmentContracts.candidatePolicy.liveGoogleCalls === false, "Adaptive route replenishment must preserve zero live Google calls.");
assert(readme.includes("Duplicate Prevention"), "Intelligence README must include duplicate-prevention guidance.");
assert(readme.includes("Future canonical archived-session learning must extend"), "Intelligence README must preserve archived-session learning duplicate prevention.");
assert(systemMap.includes("Adaptive Outside Sales Intelligence Engine"), "System map must reference the Adaptive Outside Sales Intelligence Engine foundation.");
assert(systemMap.includes("Do not create a second learning engine"), "System map must preserve Intelligence duplicate-prevention language.");
assert(systemMap.includes("Field Learning Loop rule"), "System map must include Field Learning Loop duplicate-prevention guidance.");
assert(systemMap.includes("Offline learning validation rule"), "System map must include offline learning duplicate-prevention guidance.");
assert(systemMap.includes("Recommendation explainability rule"), "System map must include recommendation explainability duplicate-prevention guidance.");
assert(systemMap.includes("Operating Profile rule"), "System map must include Operating Profile duplicate-prevention guidance.");
assert(systemMap.includes("Customer Intelligence Graph rule"), "System map must include Customer Intelligence Graph duplicate-prevention guidance.");
assert(systemMap.includes("Continuous route replenishment rule"), "System map must include continuous route replenishment duplicate-prevention guidance.");

if (failures.length) {
  console.error("Prometheus Intelligence architecture validation failed:");
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log("Prometheus Intelligence architecture validated: adaptive outside-sales contracts, handoffs, duplicate prevention, and no-production-change flags.");
}
