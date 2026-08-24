import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = path => readFileSync(resolve(root, path), "utf8");
const readJson = path => JSON.parse(read(path));
const sha256 = path => createHash("sha256").update(read(path)).digest("hex");

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
  "intelligence/off-route-learning-intelligence.mjs",
  "intelligence/off-route-learning-intelligence.md",
  "intelligence/route-iq-prospective-retention-admission.mjs",
  "intelligence/discovery-mode-intelligence-v2.mjs",
  "intelligence/discovery-mode-intelligence-v2.md",
  "intelligence/nearby-context-intelligence-v2.mjs",
  "intelligence/nearby-context-intelligence-v2.md",
  "intelligence/provenance/reconstruct-legacy-protected-contracts-v1.mjs",
  "intelligence/provenance/legacy-provenance-gap-049cf583-v1.json",
  "intelligence/provenance/protected-baseline-synchronization-batch-20260714-002-v1.json",
  "intelligence/provenance/protected-baseline-synchronization-batch-20260714-002-route-quality-successor-v1.json",
  "intelligence/provenance/protected-baseline-synchronization-batch-20260714-003-retention-v1.json",
  "intelligence/provenance/specifications/prospective-retention-admission-v1.json",
  "intelligence/provenance/protected-baseline-synchronization-retention-maintenance-consumer-admission-v1.json",
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
  "intelligence/contracts/off-route-learning-intelligence-contracts.json",
  "intelligence/config/off-route-learning-intelligence-v1.json",
  "intelligence/fixtures/off-route-learning-evidence-v1.json",
  "intelligence/artifacts/off-route-learning-intelligence-v1/fitness_connection/cruz/off-route-learning-snapshot-v1.json",
  "intelligence/contracts/discovery-mode-intelligence-v2-contracts.json",
  "intelligence/config/discovery-mode-intelligence-v2.json",
  "intelligence/artifacts/discovery-mode-intelligence-v2/fitness_connection/cruz/discovery-queue-plan-v2.json",
  "intelligence/contracts/nearby-context-intelligence-v2-contracts.json",
  "intelligence/config/nearby-context-intelligence-v2.json",
  "intelligence/artifacts/nearby-context-intelligence-v2/fitness_connection/cruz/nearby-context-audit-v2.json",
  "intelligence/contracts/recommendation-explainability-contracts.json",
  "intelligence/contracts/operating-profile-contracts.json",
  "intelligence/contracts/customer-intelligence-graph-contracts.json",
  "intelligence/contracts/continuous-adaptive-route-replenishment-contracts.json",
  "intelligence/contracts/route-business-hours-eligibility-contracts.json",
  "intelligence/route-business-hours-eligibility.mjs",
  "intelligence/route-iq-governed-runtime-scope.mjs",
  "intelligence/profiles/operating-profiles.json",
  "scripts/verify-field-learning-offline-evidence-harness.mjs",
  "scripts/verify-read-only-field-session-learning.mjs",
  "scripts/verify-off-route-learning-intelligence.mjs",
  "scripts/verify-route-iq-prospective-retention-intelligence.mjs",
  "scripts/verify-discovery-mode-intelligence-v2.mjs",
  "scripts/verify-nearby-context-intelligence-v2.mjs",
  "scripts/verify-recommendation-explainability-engine.mjs",
  "PRODUCT_VISION.md",
  "PRODUCT_VISION.md",
  "RESEARCH_FOUNDATION.md",
  "research/README.md",
  "sales/README.md",
  "crm/README.md",
  "docs/route-intelligence-v2-architecture.md",
  "docs/continuous-learning-framework.md",
  "scripts/verify-route-intelligence-quality-gate.mjs",
  "scripts/govern-runtime-pool-refresh.mjs",
  "patents/route-iq/OFF_ROUTE_LEARNING_INTELLIGENCE_V1.md"
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
const offRouteLearningIntelligence = read("intelligence/off-route-learning-intelligence.mjs");
const offRouteLearningIntelligenceDoc = read("intelligence/off-route-learning-intelligence.md");
const discoveryModeIntelligence = read("intelligence/discovery-mode-intelligence-v2.mjs");
const discoveryModeIntelligenceDoc = read("intelligence/discovery-mode-intelligence-v2.md");
const nearbyContextIntelligence = read("intelligence/nearby-context-intelligence-v2.mjs");
const nearbyContextIntelligenceDoc = read("intelligence/nearby-context-intelligence-v2.md");
const explainabilityEngine = read("intelligence/recommendation-explainability-engine.mjs");
const operatingProfileEngine = read("intelligence/operating-profile-engine.mjs");
const fieldEvidenceActivation = read("intelligence/field-evidence-activation-foundation.md");
const customerIntelligenceGraph = read("intelligence/customer-intelligence-graph.mjs");
const customerIntelligenceGraphDoc = read("intelligence/customer-intelligence-graph.md");
const contractsDoc = read("intelligence/subsystem-contracts.md");
const handoffs = read("intelligence/future-subsystem-handoffs.md");
const fieldHandoffs = read("intelligence/field-learning-loop-handoffs.md");
const readme = read("intelligence/README.md");
const systemMap = read("README.md");
const contracts = readJson("intelligence/contracts/adaptive-intelligence-contracts.json");
const fieldContracts = readJson("intelligence/contracts/field-learning-loop-contracts.json");
const readOnlyFieldSessionLearningContracts = readJson("intelligence/contracts/read-only-field-session-learning-contracts.json");
const readOnlyFieldSessionLearningPolicy = readJson("intelligence/config/read-only-field-session-learning-policy-v1.json");
const readOnlyFieldSessionLearningSnapshot = readJson("intelligence/artifacts/read-only-field-session-learning/fitness_connection/cruz/learning-snapshot-v1.json");
const offRouteLearningContracts = readJson("intelligence/contracts/off-route-learning-intelligence-contracts.json");
const offRouteLearningPolicy = readJson("intelligence/config/off-route-learning-intelligence-v1.json");
const offRouteLearningFixture = readJson("intelligence/fixtures/off-route-learning-evidence-v1.json");
const offRouteLearningSnapshot = readJson("intelligence/artifacts/off-route-learning-intelligence-v1/fitness_connection/cruz/off-route-learning-snapshot-v1.json");
const discoveryModeContracts = readJson("intelligence/contracts/discovery-mode-intelligence-v2-contracts.json");
const discoveryModeConfig = readJson("intelligence/config/discovery-mode-intelligence-v2.json");
const discoveryModePlan = readJson("intelligence/artifacts/discovery-mode-intelligence-v2/fitness_connection/cruz/discovery-queue-plan-v2.json");
const nearbyContextContracts = readJson("intelligence/contracts/nearby-context-intelligence-v2-contracts.json");
const nearbyContextConfig = readJson("intelligence/config/nearby-context-intelligence-v2.json");
const nearbyContextAudit = readJson("intelligence/artifacts/nearby-context-intelligence-v2/fitness_connection/cruz/nearby-context-audit-v2.json");
const legacyProvenanceEvidence = readJson("intelligence/provenance/legacy-provenance-gap-049cf583-v1.json");
const protectedBaselineSuccessor = readJson("intelligence/provenance/protected-baseline-synchronization-batch-20260714-002-v1.json");
const routeQualityBaselineSuccessor = readJson("intelligence/provenance/protected-baseline-synchronization-batch-20260714-002-route-quality-successor-v1.json");
const prospectiveRetentionAdmissionSpec = readJson("intelligence/provenance/specifications/prospective-retention-admission-v1.json");
const retentionMaintenanceConsumerAdmissionSuccessor = readJson("intelligence/provenance/protected-baseline-synchronization-retention-maintenance-consumer-admission-v1.json");
const prospectiveRetentionBaselineSuccessor = readJson("intelligence/provenance/protected-baseline-synchronization-batch-20260714-003-retention-v1.json");
const finalProspectiveRetentionBaseline = readJson("intelligence/provenance/protected-baseline-synchronization-batch-20260714-004-retention-v1.json");
const prospectiveRetentionCoordinatorSuccessor = readJson("intelligence/provenance/protected-baseline-synchronization-batch-20260714-003-data-coordinator-successor-v1.json");
const prospectiveRetentionInfrastructureSuccessor = readJson("intelligence/provenance/protected-baseline-synchronization-batch-20260714-003-infrastructure-runtime-successor-v1.json");
const explainabilityContracts = readJson("intelligence/contracts/recommendation-explainability-contracts.json");
const operatingProfileContracts = readJson("intelligence/contracts/operating-profile-contracts.json");
const customerGraphContracts = readJson("intelligence/contracts/customer-intelligence-graph-contracts.json");
const adaptiveReplenishmentContracts = readJson("intelligence/contracts/continuous-adaptive-route-replenishment-contracts.json");
const routeBusinessHoursContracts = readJson("intelligence/contracts/route-business-hours-eligibility-contracts.json");
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

const requiredOffRouteLearningExports = [
  "loadOffRouteLearningContract",
  "loadOffRouteLearningPolicy",
  "loadOffRouteLearningValidationFixture",
  "validateOffRouteLearningPolicy",
  "validateOffRouteLearningContract",
  "projectCanonicalArchivedVisitEvidence",
  "normalizeVisitDecisionEvidence",
  "buildOffRouteLearningSnapshot",
  "buildCanonicalOffRouteLearningSnapshot",
  "validateOffRouteLearningSnapshot"
];
for (const exportName of requiredOffRouteLearningExports) {
  assert(offRouteLearningIntelligence.includes(`export function ${exportName}`), `Off-route learning engine missing export ${exportName}`);
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
assert(readOnlyFieldSessionLearningContracts.prospectiveRetentionAdmission.dataExactKeySuccessorCommit === "c73118ddb262d3010bbc94a900f8506fb2f56192", "Read-only learning must pin the final Data retention successor.");
assert(readOnlyFieldSessionLearningContracts.prospectiveRetentionAdmission.productionActivationEligible === false, "Read-only learning must not activate prospective retention consumption.");
assert(readOnlyFieldSessionLearningContracts.administrativeDispositionAdmission.exactExcludedSessionId === "route-iq-field-session-fitness-connection-fitness-cruz-2026-07-14", "Read-only learning must retain the exact disposed-session boundary.");
assert(readOnlyFieldSessionLearningContracts.administrativeDispositionAdmission.auditProjectionRawPayloadAllowed === false, "Read-only learning audit visibility must remain hash-only.");
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
assert(offRouteLearningContracts.status === "active_read_only_observation", "Off-route learning contracts must remain active read-only observations.");
assert(offRouteLearningContracts.upstreamReadOnlyLearning.canonicalArchiveReaderReused === true, "Off-route learning must reuse the canonical archive reader.");
assert(offRouteLearningContracts.upstreamReadOnlyLearning.sourceAccessMode === "read_only", "Off-route learning source access must remain read-only.");
assert(offRouteLearningContracts.decisionSourceContract.unknownFallbackRequired === true, "Off-route learning must preserve Unknown fallback.");
assert(offRouteLearningContracts.decisionSourceContract.notesMaySupplySource === false, "Off-route learning must not infer source from notes.");
assert(offRouteLearningContracts.recommendationDecisionContract.overrideRequiresExplicitDecisionContext === true, "Off-route learning overrides must require explicit decision context.");
assert(offRouteLearningContracts.recommendationDecisionContract.offRouteAutomaticallyMeansOverride === false, "Off-route visits must not automatically become overrides.");
assert(offRouteLearningContracts.validationFixturePolicy.productionConsumptionAllowed === false, "Off-route learning fixture must not enter production consumption.");
assert(offRouteLearningContracts.validationFixturePolicy.canonicalArtifactGenerationAllowed === false, "Off-route learning fixture must not generate canonical artifacts.");
assert(offRouteLearningContracts.readOnlySafety.modifyData === false, "Off-route learning must not modify Data.");
assert(offRouteLearningContracts.readOnlySafety.modifyDashboard === false, "Off-route learning must not modify Dashboard.");
assert(offRouteLearningContracts.readOnlySafety.modifyRecommendationScoring === false, "Off-route learning must not modify scoring.");
assert(offRouteLearningContracts.readOnlySafety.modifyRouteGeneration === false, "Off-route learning must not modify route generation.");
assert(offRouteLearningContracts.readOnlySafety.activateRecommendationInfluence === false, "Off-route learning must not activate recommendation influence.");
assert(offRouteLearningContracts.prospectiveRetentionAdmission.inheritedFromUpstreamReadOnlyLearning === true, "Off-route learning must inherit the canonical retention boundary.");
assert(offRouteLearningContracts.prospectiveRetentionAdmission.productionActivationEligible === false, "Off-route learning must remain inactive for prospective retention consumption.");
assert(offRouteLearningContracts.administrativeDispositionAdmission.auditProjectionRawPayloadAllowed === false, "Off-route audit visibility must remain hash-only.");
const offRouteSourceIds = offRouteLearningPolicy.sourceTaxonomy.map(source => source.sourceId);
for (const sourceId of ["route_iq_recommendation", "nearby_context", "representative_saved_place", "representative_discovery", "representative_follow_up", "manual_selection", "existing_relationship", "unknown"]) {
  assert(offRouteSourceIds.includes(sourceId), `Off-route learning policy missing source ${sourceId}.`);
}
assert(offRouteLearningPolicy.sourceAdmission.explicitStructuredEvidenceRequired === true, "Off-route learning must require explicit source evidence.");
assert(offRouteLearningPolicy.sourceAdmission.notesInferenceAllowed === false, "Off-route learning policy must prohibit notes inference.");
assert(offRouteLearningPolicy.recommendationDecisionPolicy.offRouteVisitAutomaticallyCountsAsOverride === false, "Off-route learning policy must prohibit automatic override claims.");
assert(offRouteLearningPolicy.recommendationInfluence.activationStatus === "disabled_observation_only", "Off-route learning recommendation influence must remain disabled.");
assert(offRouteLearningFixture.status === "validation_only", "Off-route learning fixture must remain validation-only.");
assert(offRouteLearningFixture.productionConsumptionAllowed === false, "Off-route learning fixture production consumption must remain blocked.");
assert(offRouteLearningSnapshot.sourceEvidence.totalVisits === 4, "Off-route learning canonical snapshot must cover four verified visits.");
assert(offRouteLearningSnapshot.sourceEvidence.knownSourceVisits === 0, "Off-route learning canonical snapshot must not invent known source evidence.");
assert(offRouteLearningSnapshot.sourceEvidence.unknownSourceVisits === 4, "Off-route learning canonical snapshot must preserve four Unknown source visits.");
assert(offRouteLearningSnapshot.recommendationAcceptanceRate.valuePercent === null, "Off-route learning must not invent an acceptance rate.");
assert(offRouteLearningSnapshot.recommendationOverrideRate.valuePercent === null, "Off-route learning must not invent an override rate.");
assert(offRouteLearningSnapshot.learningConfidence.recommendationInfluenceEligible === false, "Off-route learning confidence must not influence recommendations.");
assert(offRouteLearningSnapshot.safety.recommendationScoringChanged === false, "Off-route learning canonical snapshot must preserve scoring.");
for (const section of ["Decision Source Model", "Override Boundary", "Outcome And Success Model", "Representative Judgment Comparison", "Explainability", "Canonical Artifact", "Safety", "Future Producer Handoff"]) {
  assert(offRouteLearningIntelligenceDoc.includes(section), `Off-route learning architecture missing ${section}.`);
}
assert(discoveryModeContracts.status === "advisory_only", "Discovery Mode v2 contracts must remain advisory only.");
assert(discoveryModeContracts.outputContract.runtimeConsumptionAuthorized === false, "Discovery Mode v2 must not authorize runtime consumption.");
assert(discoveryModeContracts.outputContract.recommendationMutationAuthorized === false, "Discovery Mode v2 must not authorize recommendation mutation.");
assert(discoveryModeContracts.compositionContract.fixedRotationAllowed === false, "Discovery Mode v2 must prohibit fixed category rotation.");
assert(discoveryModeContracts.compositionContract.qualityFloorAuthoritative === true, "Discovery Mode v2 must preserve the quality floor.");
assert(discoveryModeContracts.eligibilityContract.canonicalImplementation === "intelligence/route-business-hours-eligibility.mjs", "Discovery Mode v2 must reuse canonical business-hours eligibility.");
assert(discoveryModeContracts.eligibilityContract.canonicalVersion === "route-iq-business-hours-eligibility-v2", "Discovery Mode v2 canonical eligibility version regressed.");
assert(discoveryModeContracts.eligibilityContract.balancingOccursAfterEligibility === true, "Discovery Mode v2 must balance categories after eligibility.");
assert(discoveryModeContracts.eligibilityContract.closedVerifiedEligible === false, "Discovery Mode v2 must exclude CLOSED_VERIFIED candidates.");
assert(discoveryModeContracts.eligibilityContract.uncertainImmediateRecommendationEligible === false, "Discovery Mode v2 must exclude uncertain hours from immediate recommendations.");
assert(discoveryModeContracts.eligibilityContract.eligibilityReimplementationAllowed === false, "Discovery Mode v2 must prohibit a second eligibility engine.");
assert(discoveryModeContracts.scopePolicy.unknownWorkspaceBehavior === "fail_closed", "Discovery Mode v2 must fail closed for unknown workspaces.");
assert(discoveryModeContracts.scopePolicy.crossWorkspaceInfluence === false, "Discovery Mode v2 must prohibit cross-workspace influence.");
assert(discoveryModeContracts.designEvidence.stressTestObservationConsumedAsLearning === false, "Discovery Mode v2 must not promote stress observations into learned evidence.");
assert(discoveryModeConfig.queueComposition.fixedCategoryRotation === false, "Discovery Mode v2 configuration must not define a fixed rotation.");
assert(discoveryModeConfig.queueComposition.targetDistinctCategories >= 6, "Discovery Mode v2 must target broad category coverage.");
assert(discoveryModeConfig.queueComposition.minimumDistinctCategories >= 4, "Discovery Mode v2 minimum viable category coverage regressed.");
assert(discoveryModeConfig.queueComposition.categoryConcentration.maximumShare <= 0.27, "Discovery Mode v2 category concentration ceiling regressed.");
assert(discoveryModeConfig.queueComposition.preserveExistingScores === true, "Discovery Mode v2 must preserve existing scores.");
assert(discoveryModeConfig.candidatePolicy.requiresCanonicalBusinessHoursEligibility === true, "Discovery Mode v2 must require canonical business-hours decisions.");
assert(discoveryModeConfig.candidatePolicy.canonicalEligibilityVersion === discoveryModeContracts.eligibilityContract.canonicalVersion, "Discovery Mode v2 eligibility policy and contract versions must match.");
assert(discoveryModeConfig.candidatePolicy.closedVerifiedBehavior === "exclude_never_balance", "Discovery Mode v2 CLOSED_VERIFIED policy regressed.");
assert(discoveryModeConfig.candidatePolicy.uncertainHoursBehavior === "coverage_only_never_select", "Discovery Mode v2 uncertain-hours policy regressed.");
assert(discoveryModeConfig.evidencePolicy.thresholdSourcePolicyVersion === readOnlyFieldSessionLearningPolicy.policyVersion, "Discovery Mode v2 must inherit governed learning thresholds.");
assert(discoveryModeConfig.evidencePolicy.singleSessionCategoryPreferenceAllowed === false, "Discovery Mode v2 must block single-session category preference.");
assert(discoveryModeConfig.activationSafety.recommendationInfluenceActive === false, "Discovery Mode v2 recommendation influence must remain disabled.");
assert(discoveryModeConfig.activationSafety.routeScoringWeightsChanged === false, "Discovery Mode v2 must not change route scoring weights.");
assert(discoveryModeConfig.activationSafety.dashboardRuntimeChanged === false, "Discovery Mode v2 must not change Dashboard runtime.");
assert(discoveryModePlan.status === "exhausted_advisory_plan", "Discovery Mode v2 must fail closed while the approved Fitness roster is empty.");
assert(discoveryModePlan.queuePlan.plannedSize === 0, "Discovery Mode v2 must not create entries from an unapproved Fitness roster.");
assert(discoveryModePlan.queuePlan.compositionMetrics.distinctCategoryCount === 0, "Discovery Mode v2 must not invent category coverage from an unapproved roster.");
assert(discoveryModePlan.queuePlan.compositionMetrics.maximumCategoryShare <= discoveryModeConfig.queueComposition.categoryConcentration.maximumShare, "Discovery Mode v2 canonical category concentration regressed.");
assert(discoveryModePlan.queuePlan.compositionMetrics.duplicateCount === 0, "Discovery Mode v2 canonical advisory plan contains duplicates.");
assert(discoveryModePlan.queuePlan.qualityMetrics.existingScoresChanged === false, "Discovery Mode v2 canonical advisory plan changed candidate scores.");
assert(discoveryModePlan.discoveryQueueArchitecture.balancingOccursAfterEligibility === true, "Discovery Mode v2 artifact must balance after eligibility.");
assert(discoveryModePlan.queuePlan.eligibilityMetrics.canonicalVersion === discoveryModeContracts.eligibilityContract.canonicalVersion, "Discovery Mode v2 artifact eligibility version regressed.");
assert(discoveryModePlan.queuePlan.eligibilityMetrics.selectedClosedVerifiedCount === 0, "Discovery Mode v2 artifact selected CLOSED_VERIFIED candidates.");
assert(discoveryModePlan.queuePlan.eligibilityMetrics.scoringChanged === false, "Discovery Mode v2 hours eligibility changed scoring.");
assert(discoveryModePlan.queuePlan.entries.every(entry => entry.eligibilitySnapshot?.status !== "CLOSED_VERIFIED"), "Discovery Mode v2 canonical plan resurrected a closed candidate.");
assert(discoveryModePlan.queuePlan.entries.every(entry => entry.eligibilitySnapshot?.immediateRecommendationEligible === true), "Discovery Mode v2 canonical plan selected a non-immediate candidate.");
assert(discoveryModePlan.queuePlan.entries.every(entry => entry.eligibilitySnapshot?.reasonCode && entry.eligibilitySnapshot?.provenance), "Discovery Mode v2 canonical plan lost eligibility provenance.");
assert(discoveryModePlan.validation.recommendationInfluenceActive === false, "Discovery Mode v2 canonical plan activated recommendation influence.");
assert(discoveryModePlan.validation.productionQueueConsumerActive === false, "Discovery Mode v2 canonical plan activated a production queue consumer.");
assert(discoveryModeIntelligence.includes("export function buildDiscoveryModeAdvisoryPlan"), "Discovery Mode v2 composer export is missing.");
for (const section of ["Discovery Queue Architecture", "Canonical Eligibility Integration", "Category Balancing Strategy", "Evidence Thresholds", "Learning Impact", "Explainability Model", "Configuration Model", "Activation Boundary"]) {
  assert(discoveryModeIntelligenceDoc.includes(section), `Discovery Mode v2 architecture missing ${section}.`);
}
assert(nearbyContextContracts.status === "advisory_only", "Nearby Context v2 contracts must remain advisory only.");
assert(nearbyContextContracts.outputContract.runtimeConsumptionAuthorized === false, "Nearby Context v2 must not authorize Dashboard runtime consumption.");
assert(nearbyContextContracts.outputContract.recommendationMutationAuthorized === false, "Nearby Context v2 must not authorize recommendation mutation.");
assert(nearbyContextContracts.eligibilityContract.canonicalImplementation === "intelligence/route-business-hours-eligibility.mjs", "Nearby Context v2 must reuse canonical business-hours eligibility.");
assert(nearbyContextContracts.eligibilityContract.relationshipClassificationOccursAfterEligibility === true, "Nearby Context v2 must classify relationships after eligibility.");
assert(nearbyContextContracts.eligibilityContract.closedVerifiedEligible === false, "Nearby Context v2 must exclude CLOSED_VERIFIED candidates.");
assert(nearbyContextContracts.eligibilityContract.uncertainImmediateRecommendationEligible === false, "Nearby Context v2 must exclude uncertain hours from immediate opportunities.");
assert(nearbyContextContracts.eligibilityContract.eligibilityReimplementationAllowed === false, "Nearby Context v2 must prohibit a second eligibility engine.");
assert(nearbyContextContracts.identityContract.canonicalImplementation === "intelligence/continuous-adaptive-route-replenishment.mjs", "Nearby Context v2 must reuse canonical Route IQ identity.");
assert(nearbyContextContracts.identityContract.canonicalFunction === "routeQueueIdentity", "Nearby Context v2 canonical identity function regressed.");
assert(nearbyContextContracts.identityContract.googlePlaceIdPriority === true, "Nearby Context v2 must prioritize Google Place identity.");
assert(nearbyContextContracts.identityContract.duplicateRemovalBeforeRelationshipInference === true, "Nearby Context v2 must remove aliases before relationship inference.");
assert(nearbyContextContracts.identityContract.duplicateAliasesContributeToInference === false, "Nearby Context v2 must prohibit alias relationship contribution.");
assert(nearbyContextContracts.identityContract.multiTenantDistinction === "distinct_google_place_ids_remain_distinct", "Nearby Context v2 multi-tenant identity rule regressed.");
assert(JSON.stringify(nearbyContextContracts.relationshipContract.priorityOrder) === JSON.stringify(["same_building", "same_shopping_center", "same_commercial_parcel", "walkable", "nearby"]), "Nearby Context v2 relationship priority regressed.");
assert(nearbyContextContracts.relationshipContract.shoppingCenterInferenceUniqueBusinessesOnly === true, "Nearby Context v2 shopping-center inference must use unique businesses only.");
assert(nearbyContextContracts.selectionContract.quarantineSelectable === false, "Nearby Context v2 must prohibit quarantine selection.");
assert(nearbyContextContracts.selectionContract.completedBusinessesSelectable === false, "Nearby Context v2 must prohibit completed-business selection.");
assert(nearbyContextContracts.selectionContract.recommendationScoresUsedForOrdering === false, "Nearby Context v2 must not order by recommendation scores.");
assert(nearbyContextConfig.candidatePolicy.requiresCanonicalBusinessHoursEligibility === true, "Nearby Context v2 must require canonical hours decisions.");
assert(nearbyContextConfig.businessHoursPolicy.uncertainStatusBehavior === "coverage_only_never_select", "Nearby Context v2 uncertain-hours policy regressed.");
assert(nearbyContextConfig.candidatePolicy.recommendationScoreUsedForOrdering === false, "Nearby Context v2 configuration must preserve recommendation-score ordering boundaries.");
assert(nearbyContextConfig.identityPolicy.deduplicationPhase === "before_relationship_classification", "Nearby Context v2 identity phase regressed.");
assert(nearbyContextConfig.identityPolicy.shoppingCenterInferenceInput === "unique_canonical_businesses_only", "Nearby Context v2 shopping-center identity input regressed.");
assert(nearbyContextConfig.identityPolicy.duplicateAliasContributionAllowed === false, "Nearby Context v2 configuration must prohibit alias inference contribution.");
assert(nearbyContextConfig.activationSafety.dashboardConsumerActive === false, "Nearby Context v2 Dashboard consumer must remain inactive.");
assert(nearbyContextConfig.activationSafety.routeScoringWeightsChanged === false, "Nearby Context v2 must not change route scoring weights.");
assert(nearbyContextConfig.fieldEvidenceBasis.learningInput === false, "Nearby Context v2 must not promote stress observations into learning.");
assert(nearbyContextAudit.artifactType === "nearby_context_intelligence_v2_audit", "Nearby Context v2 canonical artifact type regressed.");
assert(nearbyContextAudit.stressContexts.length === 2, "Nearby Context v2 must preserve both Founder stress contexts.");
assert(nearbyContextAudit.stressContexts.every(context => context.plan.status === "coverage_gap"), "Nearby Context v2 must report governed stress-test coverage gaps honestly.");
assert(nearbyContextAudit.stressContexts.every(context => context.plan.nearbyOpportunities.emptyState?.recommendationInvented === false), "Nearby Context v2 must not invent an empty-state recommendation.");
assert(nearbyContextAudit.governedCapabilityProbe.status === "coverage_gap", "Nearby Context v2 capability probe must fail closed while the approved Fitness roster is empty.");
assert(nearbyContextAudit.governedCapabilityProbe.nearbyOpportunities.count === 0, "Nearby Context v2 must not invent capability-probe opportunities.");
assert(nearbyContextAudit.governedCapabilityProbe.nearbyOpportunities.entries.every(entry => entry.eligibilitySnapshot.status === "OPEN_VERIFIED"), "Nearby Context v2 capability probe must use verified-open candidates.");
assert(nearbyContextAudit.governedCapabilityProbe.nearbyOpportunities.entries.every(entry => entry.recommendationScoreChanged === false), "Nearby Context v2 capability probe changed recommendation scoring.");
assert(nearbyContextAudit.identityIntegrationRegression.aliasProbe.preRelationshipDuplicateCount === 1, "Nearby Context v2 canonical audit did not remove the alias before relationships.");
assert(nearbyContextAudit.identityIntegrationRegression.aliasProbe.relationshipInferenceInputCount === 1, "Nearby Context v2 canonical audit passed an alias into relationship inference.");
assert(nearbyContextAudit.identityIntegrationRegression.aliasProbe.shoppingCenterInferenceSatisfied === false, "Nearby Context v2 alias incorrectly satisfied shopping-center inference.");
assert(nearbyContextAudit.identityIntegrationRegression.multiTenantProbe.resultCount === 2, "Nearby Context v2 canonical audit collapsed legitimate multi-tenant businesses.");
assert(nearbyContextAudit.validation.dashboardConsumerActive === false, "Nearby Context v2 artifact activated a Dashboard consumer.");
assert(nearbyContextAudit.validation.routeScoringWeightsChanged === false, "Nearby Context v2 artifact changed route scoring.");
assert(nearbyContextIntelligence.includes("export function buildNearbyContextAdvisory"), "Nearby Context v2 advisory composer export is missing.");
assert(nearbyContextIntelligence.includes("evaluateRouteBusinessHoursEligibility"), "Nearby Context v2 canonical hours consumer is missing.");
for (const section of ["Nearby Opportunity Architecture", "Canonical Eligibility Boundary", "Relationship Model", "Selection Strategy", "Explainability Model", "Field Evidence Findings", "Configuration Model", "Activation Boundary"]) {
  assert(nearbyContextIntelligenceDoc.includes(section), `Nearby Context v2 architecture missing ${section}.`);
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
assert(adaptiveReplenishmentContracts.workspacePolicy.configurationDriven === true, "Adaptive route replenishment must be configuration driven.");
assert(adaptiveReplenishmentContracts.workspacePolicy.canonicalWorkspaceIds.includes("fitness_connection"), "Adaptive route replenishment must support the canonical Fitness workspace.");
assert(adaptiveReplenishmentContracts.workspacePolicy.canonicalWorkspaceIds.includes("northstar_outside_sales_synthetic"), "Adaptive route replenishment must support the canonical synthetic outside-sales workspace.");
assert(adaptiveReplenishmentContracts.workspacePolicy.canonicalManifestAdmissionRequired === true, "Adaptive route replenishment must require canonical manifest admission.");
assert(adaptiveReplenishmentContracts.workspacePolicy.unknownWorkspaceBehavior === "fail_closed", "Adaptive route replenishment must fail closed for unknown workspaces.");
assert(adaptiveReplenishmentContracts.workspacePolicy.crossWorkspaceLearning === false, "Adaptive route replenishment must prohibit cross-workspace learning.");
assert(adaptiveReplenishmentContracts.workspacePolicy.crossWorkspaceRouteInfluence === false, "Adaptive route replenishment must prohibit cross-workspace route influence.");
assert(adaptiveReplenishmentContracts.queuePolicy.targetSize === 15, "Adaptive route replenishment must target 15 active stops.");
assert(adaptiveReplenishmentContracts.queuePolicy.replenishmentThreshold === 5, "Adaptive route replenishment threshold must be five stops.");
assert(adaptiveReplenishmentContracts.queuePolicy.concurrency === "single_flight", "Adaptive route replenishment must use single-flight concurrency.");
assert(adaptiveReplenishmentContracts.candidatePolicy.primaryPool === "approved_active", "Adaptive route replenishment must prioritize approved Active Pool candidates.");
assert(adaptiveReplenishmentContracts.candidatePolicy.fallbackPool === "approved_full", "Adaptive route replenishment must preserve governed approved Full Pool fallback.");
assert(adaptiveReplenishmentContracts.candidatePolicy.liveProviderCalls === false, "Adaptive route replenishment must preserve zero live provider calls.");
assert(routeBusinessHoursContracts.recommendationInfluence === "OFF", "Business-hours eligibility must preserve recommendation influence OFF.");
assert(routeBusinessHoursContracts.collection === "OFF", "Business-hours eligibility must preserve collection OFF.");
assert(routeBusinessHoursContracts.activeCohorts === 0, "Business-hours eligibility must preserve zero active cohorts.");
assert(readme.includes("Duplicate Prevention"), "Intelligence README must include duplicate-prevention guidance.");
assert(legacyProvenanceEvidence.batchId === "BATCH-20260713-002", "Intelligence provenance evidence must identify the owner-repair batch.");
assert(legacyProvenanceEvidence.status === "LEGACY_PROVENANCE_GAP", "Legacy mixed ownership must remain explicitly disclosed.");
assert(legacyProvenanceEvidence.legacyCommit === "049cf583b04900b2cbf38bbffc5f6293252365d0", "Intelligence provenance evidence must identify the mixed-ownership commit.");
assert(legacyProvenanceEvidence.ownershipStatement.includes("does not claim retroactive Intelligence ownership"), "Intelligence provenance evidence must reject a retroactive ownership claim.");
assert(legacyProvenanceEvidence.contracts.length === 4, "Intelligence provenance evidence must reconstruct all four affected contracts.");
assert(legacyProvenanceEvidence.contracts.every(contract => contract.canonicalAfterRepairRawSha256 === contract.reconstructedRawSha256), "Every reconstructed Intelligence contract must prove its post-repair canonical raw hash.");
assert(legacyProvenanceEvidence.contracts.every(contract => contract.canonicalAfterRepairSemanticSha256 === contract.reconstructedSemanticSha256), "Every reconstructed Intelligence contract must prove its post-repair canonical semantic hash.");
assert(legacyProvenanceEvidence.contracts.every(contract => contract.byteIdenticalAfterRepair === true), "Every reconstructed Intelligence contract must be byte-identical after repair.");
assert(legacyProvenanceEvidence.contracts.every(contract => contract.semanticIdenticalAfterRepair === true), "Every reconstructed Intelligence contract must be semantically identical after repair.");
assert(legacyProvenanceEvidence.additionalProtectedConsumerScan.every(contract => contract.canonicalAfterRepairRawSha256 === contract.reconstructedRawSha256), "Every additional protected Intelligence consumer must prove its post-repair canonical raw hash.");
assert(legacyProvenanceEvidence.additionalProtectedConsumerScan.every(contract => contract.canonicalAfterRepairSemanticSha256 === contract.reconstructedSemanticSha256), "Every additional protected Intelligence consumer must prove its post-repair canonical semantic hash.");
assert(legacyProvenanceEvidence.additionalProtectedConsumerScan.every(contract => contract.byteIdenticalAfterRepair === true && contract.semanticIdenticalAfterRepair === true), "Every additional protected Intelligence consumer must be byte- and semantic-identical after repair.");
assert(legacyProvenanceEvidence.protectedConsumerInventory.includes("intelligence/contracts/shadow-decision-readiness-contracts.json"), "Protected-consumer inventory must include shadow readiness.");
assert(protectedBaselineSuccessor.batchId === "BATCH-20260714-002", "Protected-baseline successor must identify the collection-OFF repair batch.");
assert(protectedBaselineSuccessor.status === "OWNER_VALIDATED_SUCCESSOR", "Protected-baseline successor must remain owner validated.");
assert(protectedBaselineSuccessor.ownerSubsystem === "Prometheus Intelligence Engine", "Protected-baseline successor must remain Intelligence-owned.");
assert(protectedBaselineSuccessor.historicalCheckpoint.remainsHistorical === true && protectedBaselineSuccessor.historicalCheckpoint.rewritten === false, "Historical provenance must remain immutable.");
assert(protectedBaselineSuccessor.synchronizedConsumers.length === 5, "Protected-baseline successor must synchronize all five affected Intelligence consumers.");
assert(protectedBaselineSuccessor.boundaryValidation.collectionDefaultState === "OFF", "Prospective collection must remain default OFF.");
assert(protectedBaselineSuccessor.boundaryValidation.recommendationInfluence === "OFF", "Recommendation influence must remain OFF.");
assert(protectedBaselineSuccessor.boundaryValidation.representativeShadowOutputExposed === false, "Shadow output must remain hidden from representatives.");
assert(protectedBaselineSuccessor.boundaryValidation.routeOrderingChanged === false, "Protected synchronization must not change route ordering.");
assert(protectedBaselineSuccessor.boundaryValidation.candidateVisibilityChanged === false, "Protected synchronization must not change candidate visibility.");
assert(protectedBaselineSuccessor.boundaryValidation.routeScoringChanged === false, "Protected synchronization must not change route scoring.");
assert(protectedBaselineSuccessor.boundaryValidation.notificationBehaviorChanged === false, "Protected synchronization must not change notifications.");
assert(protectedBaselineSuccessor.boundaryValidation.automaticActionIntroduced === false, "Protected synchronization must not add automatic actions.");
assert(routeQualityBaselineSuccessor.batchId === "BATCH-20260714-002", "Route-quality successor must remain in the collection-OFF repair batch.");
assert(routeQualityBaselineSuccessor.status === "OWNER_VALIDATED_SUCCESSOR", "Route-quality successor must remain owner validated.");
assert(routeQualityBaselineSuccessor.ownerSubsystem === "Prometheus Intelligence Engine", "Route-quality successor must remain Intelligence-owned.");
assert(routeQualityBaselineSuccessor.predecessor.remainsHistorical === true && routeQualityBaselineSuccessor.predecessor.rewritten === false, "The first protected-baseline successor must remain historical.");
assert(routeQualityBaselineSuccessor.dataOwnerTransition.ownerSubsystem === "Prometheus Data", "Route-quality source transition must remain Data-owned.");
assert(routeQualityBaselineSuccessor.protectedReferenceAudit.affectedIntelligenceReferences.length === 1, "Exactly one Intelligence route-quality protection must be affected.");
assert(routeQualityBaselineSuccessor.protectedReferenceAudit.canonicalReportPinnedByIntelligence === false, "Intelligence must not invent a canonical report hash protection.");
assert(routeQualityBaselineSuccessor.protectedReferenceAudit.allAffectedReferencesAccountedFor === true, "Every affected Intelligence route-quality protection must be accounted for.");
assert(routeQualityBaselineSuccessor.boundaryValidation.collectionDefaultState === "OFF", "Route-quality synchronization must keep collection OFF.");
assert(routeQualityBaselineSuccessor.boundaryValidation.recommendationInfluence === "OFF", "Route-quality synchronization must keep recommendation influence OFF.");
assert(routeQualityBaselineSuccessor.boundaryValidation.routeScoringChanged === false, "Route-quality synchronization must not change scoring.");
assert(routeQualityBaselineSuccessor.boundaryValidation.routeGenerationChanged === false, "Route-quality synchronization must not change route generation.");
assert(prospectiveRetentionAdmissionSpec.batchId === "BATCH-20260714-004", "Prospective retention admission specification must identify the final Data retention batch.");
assert(prospectiveRetentionAdmissionSpec.sourceDeletionSuccessorBatchId === "BATCH-20260809-001", "Prospective retention admission specification must identify the dormant deletion successor.");
assert(prospectiveRetentionAdmissionSpec.deploymentReadinessSuccessorBatchId === "BATCH-20260809-002", "Prospective retention admission specification must identify the dormant maintenance readiness successor.");
assert(prospectiveRetentionAdmissionSpec.ownerSubsystem === "Prometheus Intelligence Engine", "Prospective retention admission specification must remain Intelligence-owned.");
assert(prospectiveRetentionAdmissionSpec.version === "route-iq-intelligence-prospective-retention-admission-spec-v3", "Prospective retention admission specification version drifted.");
assert(prospectiveRetentionAdmissionSpec.consumerAdmissionSuccessor.path === "intelligence/provenance/protected-baseline-synchronization-retention-maintenance-consumer-admission-v1.json", "Prospective retention admission successor path drifted.");
assert(prospectiveRetentionAdmissionSpec.consumerAdmissionSuccessor.version === retentionMaintenanceConsumerAdmissionSuccessor.version, "Prospective retention admission successor version drifted.");
assert(prospectiveRetentionAdmissionSpec.dataOwnerLineage.finalRetentionCommit === "c73118ddb262d3010bbc94a900f8506fb2f56192", "Prospective retention specification must pin final Data retention.");
assert(prospectiveRetentionAdmissionSpec.dataOwnerLineage.productionLegalHoldReadinessCommit === "1513b1acec6b303823e26252c5bcf77efa05ad62", "Prospective retention specification must pin Data production legal-hold readiness.");
assert(prospectiveRetentionAdmissionSpec.dataOwnerLineage.retentionPolicySha256 === "a0a60f3ffb693d9fadd2b1637d22fc6f6f035f8fa2533af96dc3a0c1644e1a9f", "Prospective retention specification must pin the current Data policy hash.");
assert(prospectiveRetentionAdmissionSpec.dataOwnerLineage.previousRetentionGovernanceSha256 === "0bd6519d40ea76f5ad771e19dd0ffe4fe840c7c3aeb0ad2ce1987e681985dabb", "Prospective retention specification must preserve the previous Data governance identity.");
assert(prospectiveRetentionAdmissionSpec.dataOwnerLineage.retentionGovernanceSha256 === "9d57108065e14528bb0d11e5910cc0b6b313fd310d6e67b30a8d704b1f2c6f4d", "Prospective retention specification must pin current Data legal-hold governance.");
assert(prospectiveRetentionAdmissionSpec.dataOwnerLineage.sourceDeletionSuccessorCommits.at(-1) === "a8fedf7c0b88f0611b4f721b08641e55413c591a", "Prospective retention specification must pin the final Data deletion successor.");
assert(prospectiveRetentionAdmissionSpec.dataAdmission.dataAuthenticatedAndHashBoundRequired === true, "Prospective retention admission must require Data authentication and hashes.");
assert(prospectiveRetentionAdmissionSpec.dataAdmission.authoritativeLegalHoldLedgerRequired === true, "Prospective retention admission must require an authoritative hold ledger.");
assert(prospectiveRetentionAdmissionSpec.dataAdmission.authoritativeProductionLegalHoldRequired === true && prospectiveRetentionAdmissionSpec.dataAdmission.fixtureLegalHoldEvidenceAllowed === false, "Prospective retention admission must require production legal-hold authority and reject fixtures.");
assert(prospectiveRetentionAdmissionSpec.dataAdmission.immediatePreMutationRevalidationRequired === true, "Prospective retention admission must require immediate legal-hold revalidation.");
assert(prospectiveRetentionAdmissionSpec.dataAdmission.maximumCalendarMonths === 18, "Prospective retention maximum must be 18 calendar months.");
assert(prospectiveRetentionAdmissionSpec.dataAdmission.customerMayOnlyShorten === true && prospectiveRetentionAdmissionSpec.dataAdmission.customerMayExpand === false, "Customers may only shorten retention.");
assert(prospectiveRetentionAdmissionSpec.dataAdmission.deletionStartedOrCompletedSubjectAdmissionAllowed === false, "Deletion-started and completed subjects must remain excluded.");
assert(prospectiveRetentionAdmissionSpec.dataAdmission.indefiniteAggregateRequiresExactDataAttestation === true, "Indefinite aggregate admission must be Data-attested.");
assert(prospectiveRetentionAdmissionSpec.administrativeDisposition.auditVisibility === "hash_only", "Disposed-session audit visibility must remain hash-only.");
assert(prospectiveRetentionAdmissionSpec.administrativeDisposition.admissionAllowed === false, "Disposed evidence must remain excluded.");
assert(prospectiveRetentionAdmissionSpec.currentState.readiness === "INSUFFICIENT_EVIDENCE", "Prospective retention readiness must remain insufficient evidence.");
assert(prospectiveRetentionAdmissionSpec.currentState.collection === "OFF" && prospectiveRetentionAdmissionSpec.currentState.activeCohorts === 0, "Prospective retention collection must remain OFF with zero cohorts.");
assert(prospectiveRetentionAdmissionSpec.currentState.recommendationInfluence === "OFF", "Prospective retention recommendation influence must remain OFF.");
assert(prospectiveRetentionAdmissionSpec.maintenanceReleaseReadiness.infrastructureCommit === "b71bd0a99ff8d992694df542ec969a071c7b353d", "Prospective retention specification must pin the Infrastructure maintenance package.");
assert(prospectiveRetentionAdmissionSpec.maintenanceReleaseReadiness.releasePackageContract.sha256 === sha256(prospectiveRetentionAdmissionSpec.maintenanceReleaseReadiness.releasePackageContract.path), "Maintenance release contract hash drifted.");
assert(prospectiveRetentionAdmissionSpec.maintenanceReleaseReadiness.releasePackageBuilder.sha256 === sha256(prospectiveRetentionAdmissionSpec.maintenanceReleaseReadiness.releasePackageBuilder.path), "Maintenance release builder hash drifted.");
assert(prospectiveRetentionAdmissionSpec.maintenanceReleaseReadiness.productionAdmission.sha256 === sha256(prospectiveRetentionAdmissionSpec.maintenanceReleaseReadiness.productionAdmission.path), "Maintenance production admission hash drifted.");
assert(prospectiveRetentionAdmissionSpec.maintenanceReleaseReadiness.deploymentAuthorityGranted === false && prospectiveRetentionAdmissionSpec.maintenanceReleaseReadiness.deletionAuthorityGranted === false, "Maintenance composition must grant no deployment or deletion authority.");
assert(retentionMaintenanceConsumerAdmissionSuccessor.predecessor.path === "intelligence/provenance/protected-baseline-synchronization-retention-deletion-consumer-admission-v1.json", "Maintenance consumer successor predecessor drifted.");
assert(retentionMaintenanceConsumerAdmissionSuccessor.boundaries.collection === "OFF" && retentionMaintenanceConsumerAdmissionSuccessor.boundaries.activeCohorts === 0 && retentionMaintenanceConsumerAdmissionSuccessor.boundaries.recommendationInfluence === "OFF", "Maintenance consumer successor changed protected Intelligence state.");
assert(finalProspectiveRetentionBaseline.batchId === "BATCH-20260714-004", "Final retention baseline must identify this batch.");
assert(finalProspectiveRetentionBaseline.dataOwnerLineage.commit === prospectiveRetentionAdmissionSpec.dataOwnerLineage.finalRetentionCommit, "Final retention baseline and specification must pin the same Data commit.");
assert(finalProspectiveRetentionBaseline.protectedBehavior.collection === "OFF" && finalProspectiveRetentionBaseline.protectedBehavior.activeCohorts === 0, "Final retention baseline must keep collection OFF.");
assert(finalProspectiveRetentionBaseline.protectedBehavior.readiness === "INSUFFICIENT_EVIDENCE" && finalProspectiveRetentionBaseline.protectedBehavior.recommendationInfluence === "OFF", "Final retention baseline must preserve no influence.");
assert(prospectiveRetentionBaselineSuccessor.batchId === "BATCH-20260714-003", "Prospective retention baseline successor must identify the activation-readiness batch.");
assert(prospectiveRetentionBaselineSuccessor.status === "OWNER_VALIDATED_SUCCESSOR_PENDING_OVERWATCH", "Prospective retention baseline successor must await Overwatch verification.");
assert(prospectiveRetentionBaselineSuccessor.ownerSubsystem === "Prometheus Intelligence Engine", "Prospective retention baseline successor must remain Intelligence-owned.");
assert(prospectiveRetentionBaselineSuccessor.dataOwnerLineage.exactKeySuccessorCommit === "4803d7aca5810abfc1cbca84eb2f461046a10da4", "Prospective retention successor must pin the final Data exact-key commit.");
assert(prospectiveRetentionBaselineSuccessor.infrastructureOwnerLineage.activationReadinessCommit === "2280c6dae9d07bcfd744e99e9d28126188653eb2", "Prospective retention successor must pin the Infrastructure owner commit.");
assert(prospectiveRetentionBaselineSuccessor.consumerExclusionMatrix.allConsumersAccountedFor === true, "Prospective retention successor must account for every Intelligence consumer.");
assert(prospectiveRetentionBaselineSuccessor.consumerExclusionMatrix.auditVisibility === "hash_only", "Prospective retention successor audit visibility must remain hash-only.");
assert(prospectiveRetentionBaselineSuccessor.boundaryValidation.collection === "OFF" && prospectiveRetentionBaselineSuccessor.boundaryValidation.activeCohorts === 0, "Prospective retention successor must keep collection OFF with zero cohorts.");
assert(prospectiveRetentionBaselineSuccessor.boundaryValidation.recommendationInfluence === "OFF", "Prospective retention successor must keep recommendation influence OFF.");
assert(prospectiveRetentionBaselineSuccessor.boundaryValidation.newConsumerActivated === false, "Prospective retention successor must not activate a new consumer.");
assert(prospectiveRetentionCoordinatorSuccessor.batchId === "BATCH-20260714-003", "Data coordinator successor must remain in the activation-readiness batch.");
assert(prospectiveRetentionCoordinatorSuccessor.status === "OWNER_VALIDATED_SUCCESSOR_PENDING_OVERWATCH", "Data coordinator successor must await independent Overwatch verification.");
assert(prospectiveRetentionCoordinatorSuccessor.ownerSubsystem === "Prometheus Intelligence Engine", "Data coordinator successor mapping must remain Intelligence-owned.");
assert(prospectiveRetentionCoordinatorSuccessor.predecessor.remainsHistorical === true && prospectiveRetentionCoordinatorSuccessor.predecessor.rewritten === false, "The prior retention checkpoint must remain historical and unmodified.");
assert(prospectiveRetentionCoordinatorSuccessor.dataOwnerTransition.ownerSubsystem === "Prometheus Data", "The coordinator implementation transition must remain Data-owned.");
assert(prospectiveRetentionCoordinatorSuccessor.dataOwnerTransition.commit === "fdacf00da221ae5cc473fb57173a7940483deeb7", "The coordinator successor must pin the Data owner repair commit.");
assert(typeof prospectiveRetentionCoordinatorSuccessor.dataOwnerTransition.coordinator.currentSha256 === "string", "Historical coordinator provenance must retain its hash.");
assert(prospectiveRetentionCoordinatorSuccessor.intelligenceOwnerSynchronization.dataImplementationModifiedByIntelligence === false, "Intelligence must not modify the Data coordinator.");
assert(prospectiveRetentionCoordinatorSuccessor.intelligenceOwnerSynchronization.historicalCheckpointModified === false, "Intelligence must preserve the historical checkpoint.");
assert(prospectiveRetentionCoordinatorSuccessor.intelligenceOwnerSynchronization.allAffectedProtectedReferencesAccountedFor === true, "Every affected Intelligence protection must be accounted for.");
assert(prospectiveRetentionCoordinatorSuccessor.boundaryValidation.readiness === "INSUFFICIENT_EVIDENCE", "Coordinator synchronization must preserve insufficient evidence.");
assert(prospectiveRetentionCoordinatorSuccessor.boundaryValidation.collection === "OFF" && prospectiveRetentionCoordinatorSuccessor.boundaryValidation.activeCohorts === 0, "Coordinator synchronization must keep collection OFF with zero cohorts.");
assert(prospectiveRetentionCoordinatorSuccessor.boundaryValidation.recommendationInfluence === "OFF", "Coordinator synchronization must keep recommendation influence OFF.");
assert(prospectiveRetentionCoordinatorSuccessor.boundaryValidation.representativeShadowOutputExposed === false, "Coordinator synchronization must expose no shadow output.");
assert(prospectiveRetentionCoordinatorSuccessor.boundaryValidation.archiveRewritePerformed === false, "Coordinator synchronization must not rewrite archives.");
assert(prospectiveRetentionInfrastructureSuccessor.batchId === "BATCH-20260714-003", "Infrastructure runtime successor must remain in the activation-readiness batch.");
assert(prospectiveRetentionInfrastructureSuccessor.status === "OWNER_VALIDATED_SUCCESSOR_PENDING_OVERWATCH", "Infrastructure runtime successor must await independent Overwatch verification.");
assert(prospectiveRetentionInfrastructureSuccessor.ownerSubsystem === "Prometheus Intelligence Engine", "Infrastructure runtime successor mapping must remain Intelligence-owned.");
assert(prospectiveRetentionInfrastructureSuccessor.predecessor.remainsHistorical === true && prospectiveRetentionInfrastructureSuccessor.predecessor.rewritten === false, "The Data-coordinator Intelligence checkpoint must remain historical and unmodified.");
assert(prospectiveRetentionInfrastructureSuccessor.infrastructureOwnerTransition.ownerSubsystem === "Prometheus Infrastructure", "The runtime implementation transition must remain Infrastructure-owned.");
assert(prospectiveRetentionInfrastructureSuccessor.infrastructureOwnerTransition.commit === "46658265248b03f7b52f9e1ec0b1ca61ca2b5920", "The Infrastructure successor must pin its owner repair commit.");
assert(typeof prospectiveRetentionInfrastructureSuccessor.infrastructureOwnerTransition.runtime.currentSha256 === "string", "Historical Infrastructure provenance must retain its hash.");
assert(prospectiveRetentionInfrastructureSuccessor.intelligenceOwnerSynchronization.infrastructureImplementationModifiedByIntelligence === false, "Intelligence must not modify the Infrastructure runtime.");
assert(prospectiveRetentionInfrastructureSuccessor.intelligenceOwnerSynchronization.historicalCheckpointModified === false, "Intelligence must preserve the earlier checkpoint.");
assert(prospectiveRetentionInfrastructureSuccessor.intelligenceOwnerSynchronization.allAffectedProtectedReferencesAccountedFor === true, "Every affected Infrastructure protection must be accounted for.");
assert(prospectiveRetentionInfrastructureSuccessor.boundaryValidation.readiness === "INSUFFICIENT_EVIDENCE", "Infrastructure synchronization must preserve insufficient evidence.");
assert(prospectiveRetentionInfrastructureSuccessor.boundaryValidation.collection === "OFF" && prospectiveRetentionInfrastructureSuccessor.boundaryValidation.activeCohorts === 0, "Infrastructure synchronization must keep collection OFF with zero cohorts.");
assert(prospectiveRetentionInfrastructureSuccessor.boundaryValidation.recommendationInfluence === "OFF", "Infrastructure synchronization must keep recommendation influence OFF.");
assert(prospectiveRetentionInfrastructureSuccessor.boundaryValidation.representativeShadowOutputExposed === false, "Infrastructure synchronization must expose no shadow output.");
assert(prospectiveRetentionInfrastructureSuccessor.boundaryValidation.productionAccessPerformed === false, "Infrastructure synchronization must not access production.");
assert(legacyProvenanceEvidence.methodologyConstraints.requiredEvaluationOutcomes === "97 eligible, linked, scoreable evaluation outcomes after exclusions", "Provenance evidence must preserve the exact 97-outcome methodology.");
assert(legacyProvenanceEvidence.methodologyConstraints.requiredSampleAloneCanReachFounderReview === false, "The 97-outcome minimum alone must not authorize Founder review eligibility.");
assert(legacyProvenanceEvidence.methodologyConstraints.minimumSupportedObservationsAcrossFivePopulatedBins === 100, "Five populated calibration bins must require at least 100 supported observations.");
assert(legacyProvenanceEvidence.methodologyConstraints.sparseOrEmptyBinsMayBypassCoverage === false, "Sparse or empty calibration bins must not bypass evidence gates.");
assert(legacyProvenanceEvidence.methodologyConstraints.causalUpliftOrRecommendationSuperiorityClaimAllowed === false, "Observational evidence must not claim causal uplift or recommendation superiority.");
assert(legacyProvenanceEvidence.safety.recommendationInfluence === "OFF", "Provenance repair must keep recommendation influence off.");
assert(legacyProvenanceEvidence.safety.routeScoringChanged === false, "Provenance repair must not change route scoring.");
assert(legacyProvenanceEvidence.safety.routeGenerationChanged === false, "Provenance repair must not change route generation.");
assert(legacyProvenanceEvidence.safety.representativeExposureChanged === false, "Provenance repair must not change representative exposure.");
assert(legacyProvenanceEvidence.safety.prospectiveShadowCollectionStarted === false, "Provenance repair must not begin prospective shadow collection.");
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
