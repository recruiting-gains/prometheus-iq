import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const readJson = path => JSON.parse(readFileSync(path, "utf8"));
const readText = path => readFileSync(path, "utf8");

const taxonomy = readJson("research/taxonomy/research-taxonomy.json");
const sourceRegister = readJson("research/registers/source-register.json");
const backlog = readJson("research/registers/intelligence-backlog.json");
const briefingCatalog = readJson("research/registers/briefing-catalog.json");
const marketIntelligenceModel = readJson("research/registers/market-intelligence-model.json");
const executiveIntelligenceStandard = readJson("research/registers/executive-intelligence-package-standard.json");
const gaiaEvidenceEngine = readJson("research/registers/gaia-evidence-engine.json");
const executiveBenchmarkStudy = readJson("research/reports/executive-intelligence-benchmark-study-v1.json");
const smoothieDepotPackageRegister = readJson("research/workspaces/smoothie-depot/executive-intelligence-packages/package-register.json");
const smoothieDepotExecutivePackageV3 = readJson("research/workspaces/smoothie-depot/executive-intelligence-packages/smoothie-depot-executive-intelligence-package-v3.json");
const smoothieDepotExecutivePackageV3Evidence = readJson("research/workspaces/smoothie-depot/executive-intelligence-packages/smoothie-depot-executive-intelligence-package-v3-evidence.json");
const nutritionDepotExecutivePackage = readJson("research/workspaces/smoothie-depot/executive-intelligence-packages/nutrition-depot-executive-intelligence-package-v2.json");
const nutritionDepotExecutivePackageV1 = readJson("research/workspaces/smoothie-depot/executive-intelligence-packages/nutrition-depot-executive-intelligence-package-v1.json");
const crankyCarrotExecutivePackage = readJson("research/workspaces/smoothie-depot/executive-intelligence-packages/cranky-carrot-executive-intelligence-package-v1.json");
const marketExpansionScoring = readJson("research/reports/market-expansion-scoring-v1.json");
const smoothieDepotExecutiveFramework = readJson("research/workspaces/smoothie-depot/executive-due-diligence-framework-v4.json");
const smoothieDepotDossierRegister = readJson("research/workspaces/smoothie-depot/dossiers/dossier-register.json");
const nutritionDepotDossier = readJson("research/workspaces/smoothie-depot/dossiers/nutrition-depot-executive-due-diligence-dossier-v1.json");
const smoothieDepotProspects = readJson("research/workspaces/smoothie-depot/ranked-business-prospects-2026-07-03.json");
const schema = readJson("research/schemas/founder-intelligence-brief.schema.json");
const strategicBriefSchema = readJson("research/schemas/strategic-intelligence-brief.schema.json");
const marketRecommendationSchema = readJson("research/schemas/market-intelligence-recommendation.schema.json");
const executiveIntelligenceSchema = readJson("research/schemas/executive-intelligence-package.schema.json");
const gaiaEvidenceItemSchema = readJson("research/schemas/gaia-evidence-item.schema.json");
const architecture = readText("research/architecture.md");
const sourcePolicy = readText("research/source-policy.md");
const researchReadme = readText("research/README.md");
const template = readText("research/templates/founder-intelligence-brief.md");
const strategicBriefTemplate = readText("research/templates/strategic-intelligence-brief.md");
const marketRecommendationTemplate = readText("research/templates/market-expansion-recommendation.md");
const executiveIntelligenceTemplate = readText("research/templates/executive-intelligence-package.md");
const gaiaResearchOrchestrator = readText("research/gaia-research-orchestrator.md");
const executiveIntelligencePlatform = readText("research/executive-intelligence-platform.md");
const executiveBenchmarkReport = readText("research/reports/executive-intelligence-benchmark-study-v1.md");
const smoothieDepotExecutivePackageV3Report = readText("research/workspaces/smoothie-depot/executive-intelligence-packages/smoothie-depot-executive-intelligence-package-v3.md");
const nutritionDepotExecutivePackageReport = readText("research/workspaces/smoothie-depot/executive-intelligence-packages/nutrition-depot-executive-intelligence-package-v2.md");
const nutritionDepotExecutivePackageReportV1 = readText("research/workspaces/smoothie-depot/executive-intelligence-packages/nutrition-depot-executive-intelligence-package-v1.md");
const crankyCarrotExecutivePackageReport = readText("research/workspaces/smoothie-depot/executive-intelligence-packages/cranky-carrot-executive-intelligence-package-v1.md");
const marketExpansionReport = readText("research/reports/market-expansion-recommendation-v1.md");
const smoothieDepotWorkflow = readText("research/workspaces/smoothie-depot/business-prospect-discovery-workflow-v1.md");
const smoothieDepotExecutiveStandard = readText("research/workspaces/smoothie-depot/executive-due-diligence-intelligence-standard-v4.md");
const nutritionDepotDossierReport = readText("research/workspaces/smoothie-depot/dossiers/nutrition-depot-executive-due-diligence-dossier-v1.md");
const smoothieDepotReport = readText("research/workspaces/smoothie-depot/ranked-business-prospects-2026-07-03.md");
const briefingSystem = readText("research/briefing-system.md");
const marketIntelligenceEngine = readText("research/market-intelligence-engine.md");
const briefingHandoffs = readText("research/future-briefing-handoffs.md");
const researchFoundation = readText("RESEARCH_FOUNDATION.md");
const customerGraphContracts = readJson("intelligence/contracts/customer-intelligence-graph-contracts.json");

const requiredCategories = [
  "AI",
  "Competition",
  "Funding",
  "Sales",
  "Industries",
  "Technology",
  "Customer Pain Points",
  "Enterprise",
  "Regulations",
  "Opportunities",
  "Risks"
];

const requiredResponsibilities = [
  "AI industry developments",
  "Startup funding activity",
  "Competitor intelligence",
  "Outside sales best practices",
  "Route optimization research",
  "Customer acquisition trends",
  "Sales psychology",
  "Enterprise software trends",
  "Healthcare field sales",
  "Medical device sales",
  "Solar",
  "Roofing",
  "Pest control",
  "Security",
  "Telecom",
  "Commercial services",
  "Industrial sales",
  "Logistics",
  "Emerging technologies",
  "Patent activity",
  "Government and regulatory changes affecting field sales",
  "Market opportunities",
  "Founder education",
  "Venture capital trends"
];

const futureHandoffTargets = [
  "Companion",
  "Founder Dashboard",
  "Website",
  "Social Media",
  "Intelligence Engine"
];

const strategicBriefingTypes = [
  "daily-founder-brief",
  "weekly-ai-brief",
  "weekly-competitor-brief",
  "weekly-startup-funding-brief",
  "weekly-outside-sales-brief",
  "weekly-industry-brief",
  "weekly-healthcare-brief",
  "weekly-enterprise-technology-brief",
  "weekly-customer-pain-point-brief",
  "monthly-strategic-review"
];

const strategicBriefingNames = [
  "Daily Founder Brief",
  "Weekly AI Brief",
  "Weekly Competitor Brief",
  "Weekly Startup Funding Brief",
  "Weekly Outside Sales Brief",
  "Weekly Industry Brief",
  "Weekly Healthcare Brief",
  "Weekly Enterprise Technology Brief",
  "Weekly Customer Pain Point Brief",
  "Monthly Strategic Review"
];

const strategicRequiredSections = [
  "summary",
  "whyItMatters",
  "impactOnPrometheus",
  "opportunities",
  "risks",
  "recommendedFounderActions",
  "sourceReferences"
];

const strategicFutureHandoffs = [
  "Companion",
  "Intelligence Engine",
  "Website",
  "Sales"
];

const marketCapabilities = [
  "market_opportunity_scoring",
  "industry_attractiveness_analysis",
  "outside_sales_market_ranking",
  "competitor_movement_tracking",
  "ai_trend_tracking",
  "partnership_opportunities",
  "geographic_expansion_opportunities",
  "enterprise_target_identification"
];

const marketCapabilityLabels = [
  "Market opportunity scoring",
  "Industry attractiveness analysis",
  "Outside-sales market ranking",
  "Competitor movement tracking",
  "AI trend tracking",
  "Partnership opportunities",
  "Geographic expansion opportunities",
  "Enterprise target identification"
];

const marketRequiredFounderOutput = [
  "summary",
  "marketScore",
  "whyItMatters",
  "impactOnPrometheus",
  "opportunities",
  "risks",
  "recommendedFounderActions",
  "sourceReferences",
  "confidenceAndLimitations",
  "futureHandoffCandidates"
];

const protectedMarketSubsystems = [
  "Companion",
  "Dashboard",
  "CRM",
  "Mobile",
  "Intelligence runtime"
];

const executiveIntelligenceEvidenceLabels = [
  "Observed",
  "Corroborated",
  "Owner-provided",
  "Unknown",
  "Inference"
];

const executiveIntelligenceConclusionFields = [
  "evidenceBasis",
  "sourceReliability",
  "confidenceLevel",
  "verificationNeeded",
  "businessDecisionImpact"
];

const executiveIntelligenceLayerNames = [
  "Executive Summary",
  "Business Identity",
  "Ownership Leadership Public Operators Corporate Structure Timeline",
  "Business Evolution Expansion Growth Brand Development Historical Milestones",
  "Operational Intelligence",
  "Commercial Ecosystem Intelligence",
  "Competitive Intelligence",
  "Community Intelligence",
  "Digital Intelligence",
  "Reputation Intelligence",
  "Strategic Intelligence",
  "Executive Decision Support"
];

const protectedExecutiveIntelligenceSubsystems = [
  "Dashboard",
  "CRM",
  "Website",
  "Infrastructure",
  "Companion",
  "Mobile",
  "Fitness Connection",
  "Route Intelligence",
  "Active Pool",
  "Intelligence runtime"
];

const executiveBenchmarkOrganizations = [
  "McKinsey & Company",
  "Bain & Company",
  "Boston Consulting Group",
  "Deloitte Strategy",
  "Corporate Development teams",
  "Private Equity Due Diligence teams",
  "Investment Banking M&A advisory teams",
  "Strategic Consulting firms"
];

const executiveBenchmarkMethodologies = [
  "structured_problem_solving",
  "m_and_a_blueprint",
  "strategy_under_uncertainty",
  "integrated_due_diligence",
  "investment_thesis_testing",
  "strategic_due_diligence",
  "due_diligence_governance",
  "corporate_development_strategy",
  "standardized_due_diligence_questionnaires",
  "fairness_opinion_governance",
  "answer_first_executive_communication"
];

const executiveBenchmarkPrometheusMethodology = [
  "decision_framing",
  "decision_thesis",
  "issue_tree",
  "evidence_map",
  "value_and_risk_driver_map",
  "alternatives_and_opportunity_cost",
  "scenario_and_decision_tree",
  "unknown_value_ranking",
  "red_team_review",
  "executive_brief_and_appendices"
];

const marketExpansionRequiredIndustries = [
  "Fitness",
  "Roofing",
  "Security",
  "Medical",
  "Insurance",
  "Solar",
  "Home Services",
  "Pest Control",
  "HVAC",
  "Commercial Services",
  "Telecommunications",
  "Merchant Services",
  "B2B Field Sales"
];

const smoothieDepotRequiredProspects = [
  "Nutrition Depot Houston and Greater Houston",
  "Cranky Carrot Juice Co.",
  "LEEMOO Health Bar",
  "Tight Squeeze Juice Bar",
  "HS Green",
  "Acai Brasil USA",
  "Leaf & Grain",
  "Local Foods Group",
  "Dish Society",
  "Pure Green West University"
];

const smoothieDepotEvidenceLabels = [
  "observed",
  "inferred_from_multiple_evidence_sources",
  "self_reported",
  "owner_provided",
  "unknown"
];

const smoothieDepotRequiredDossierSections = [
  "Executive Summary",
  "Business Identity",
  "Company History Timeline",
  "Public Ownership / Operator Footprint",
  "Business Evolution",
  "Digital Presence Audit",
  "Reputation Intelligence",
  "Review Theme Intelligence",
  "Customer Experience Intelligence",
  "Market Position",
  "Competitive Landscape",
  "Geographic Opportunity",
  "Growth Signals",
  "Expansion Signals",
  "Operational Maturity",
  "Brand Strength",
  "Community Presence",
  "Business Network",
  "Franchise Compatibility",
  "Smoothie Depot Strategic Fit",
  "Conversation Preparation",
  "JR Executive Brief",
  "Risk Register",
  "Unknowns Register",
  "Verification Checklist",
  "Opportunity Ranking",
  "Confidence Model",
  "Evidence Matrix",
  "Source Reliability Matrix",
  "Recommended Next Actions"
];

for (const category of requiredCategories) {
  assert.ok(taxonomy.primaryCategories.includes(category), `Missing taxonomy category: ${category}`);
  assert.ok(template.includes(`${category}:`), `Missing template category section: ${category}`);
  assert.ok(
    schema.properties.categoryCoverage.required.includes(category),
    `Missing schema category coverage requirement: ${category}`
  );
}

for (const responsibility of requiredResponsibilities) {
  assert.ok(
    taxonomy.responsibilityAreas.includes(responsibility),
    `Missing research responsibility: ${responsibility}`
  );
  assert.ok(architecture.includes(responsibility), `Architecture does not mention responsibility: ${responsibility}`);
}

for (const target of futureHandoffTargets) {
  assert.ok(taxonomy.futureHandoffTargets.includes(target), `Missing future handoff target: ${target}`);
  assert.ok(architecture.includes(target), `Architecture does not describe handoff target: ${target}`);
}

for (const prohibitedTarget of taxonomy.prohibitedTargetsForDirectModification) {
  assert.ok(
    sourcePolicy.includes(prohibitedTarget),
    `Source policy does not preserve production boundary for ${prohibitedTarget}`
  );
}

assert.ok(architecture.includes("No live integrations."), "Architecture must explicitly exclude live integrations.");
assert.ok(architecture.includes("No automated web scraping."), "Architecture must explicitly exclude scraping.");
assert.equal(gaiaEvidenceEngine.standardId, "gaia_research_orchestrator_foundation_v1", "Gaia standard id drifted.");
assert.equal(gaiaEvidenceEngine.status, "active_research_architecture", "Gaia Evidence Engine must be active Research architecture.");
assert.equal(gaiaEvidenceEngine.productionRuntimeChange, false, "Gaia Evidence Engine must not activate runtime changes.");
assert.equal(gaiaEvidenceEngine.providerAgnostic, true, "Gaia must stay provider-agnostic.");
assert.equal(gaiaEvidenceEngine.externalProvidersNeverRecommend, true, "External providers must not produce executive recommendations.");
assert.equal(gaiaEvidenceEngine.gaiaProducesExecutiveRecommendations, true, "Gaia must own Executive Intelligence recommendations.");
assert.equal(gaiaEvidenceEngine.boundaryConfirmation.researchArchitectureOnly, true, "Gaia task must remain architecture only.");
assert.equal(
  gaiaEvidenceEngine.boundaryConfirmation.executiveIntelligencePackagesGenerated,
  false,
  "Gaia foundation must not generate Executive Intelligence Packages."
);

const gaiaProviderIds = gaiaEvidenceEngine.providers.map(provider => provider.id);
for (const providerId of [
  "apollo",
  "marketing_research_gpt",
  "consensus",
  "scispace",
  "askyourpdf",
  "public_web_research",
  "crm",
  "future_approved_evidence_provider"
]) {
  assert.ok(gaiaProviderIds.includes(providerId), `Gaia provider list missing ${providerId}.`);
}

for (const provider of gaiaEvidenceEngine.providers) {
  assert.equal(provider.role, "evidence_provider", `Gaia provider ${provider.id} must be evidence-only.`);
  assert.equal(provider.replaceable, true, `Gaia provider ${provider.id} must be replaceable.`);
  assert.equal(provider.executiveRecommendationsAllowed, false, `Gaia provider ${provider.id} must not recommend.`);
}

for (const responsibility of [
  "collect_evidence",
  "normalize_evidence",
  "remove_duplicate_findings",
  "resolve_conflicting_evidence",
  "track_evidence_provenance",
  "assign_confidence",
  "identify_unknowns",
  "score_evidence_quality",
  "forward_validated_evidence_into_executive_intelligence"
]) {
  assert.ok(gaiaEvidenceEngine.gaiaResponsibilities.includes(responsibility), `Gaia missing responsibility ${responsibility}.`);
}

const gaiaEvidenceQualityWeight = gaiaEvidenceEngine.evidenceQualityScoring.dimensions.reduce(
  (sum, dimension) => sum + dimension.weight,
  0
);
assert.equal(gaiaEvidenceQualityWeight, 100, "Gaia evidence quality scoring must total 100.");

for (const field of gaiaEvidenceEngine.requiredEvidenceItemFields) {
  assert.ok(gaiaEvidenceItemSchema.required.includes(field), `Gaia evidence item schema missing required field ${field}.`);
}

for (const boundary of [
  "routeIqModified",
  "athenaModified",
  "dashboardModified",
  "infrastructureModified",
  "websiteModified",
  "crmModified",
  "intelligenceRuntimeModified",
  "productionDataModified"
]) {
  assert.equal(gaiaEvidenceEngine.boundaryConfirmation[boundary], false, `Gaia boundary must keep ${boundary} false.`);
}

for (const requiredText of [
  "Gaia does not replace external GPTs",
  "Gaia orchestrates them",
  "External GPTs never produce executive recommendations",
  "Every evidence source is replaceable",
  "Collect evidence",
  "Normalize evidence",
  "Remove duplicate findings",
  "Resolve conflicting evidence",
  "Track evidence provenance",
  "Assign confidence",
  "Identify unknowns",
  "Score evidence quality",
  "Forward validated evidence into Executive Intelligence"
]) {
  assert.ok(gaiaResearchOrchestrator.includes(requiredText), `Gaia orchestrator missing ${requiredText}.`);
  assert.ok(architecture.includes(requiredText), `Research architecture missing Gaia text ${requiredText}.`);
}

assert.ok(sourcePolicy.includes("Verified fact"), "Source policy must define verified fact labeling.");
assert.ok(sourcePolicy.includes("Hypothesis"), "Source policy must define hypothesis labeling.");
assert.ok(template.includes("Evidence Ledger"), "Brief template must include an evidence ledger.");
assert.ok(template.includes("Boundary Confirmation"), "Brief template must include boundary confirmation.");
assert.ok(researchFoundation.includes("research/briefing-system.md"), "Root research foundation must point to the briefing system.");
assert.ok(briefingSystem.includes("No automated scraping."), "Briefing system must explicitly exclude automated scraping.");
assert.ok(briefingSystem.includes("No production integrations."), "Briefing system must explicitly exclude production integrations.");
assert.ok(briefingSystem.includes("Adaptive Outside Sales Intelligence Engine"), "Briefing system must align with Adaptive Intelligence.");
assert.ok(briefingHandoffs.includes("This document prepares future handoffs. It does not authorize implementation."), "Briefing handoffs must be future-only.");
assert.ok(researchFoundation.includes("research/market-intelligence-engine.md"), "Root research foundation must point to Market Intelligence Engine.");
assert.ok(marketIntelligenceEngine.includes("Customer Intelligence Graph"), "Market Intelligence must reference Customer Intelligence Graph boundaries.");
assert.ok(marketIntelligenceEngine.includes("Which outside-sales market should Prometheus pursue next"), "Market Intelligence must define the expansion question.");
assert.equal(marketIntelligenceModel.runtimeActive, false, "Market Intelligence must not activate runtime behavior.");
assert.equal(marketIntelligenceModel.productionSystemsModified, false, "Market Intelligence must not modify production systems.");
assert.equal(marketIntelligenceModel.unsupportedScrapingAllowed, false, "Market Intelligence must prohibit unsupported scraping.");
assert.equal(customerGraphContracts.status, "architecture_only", "Customer Intelligence Graph must remain architecture-only.");
assert.equal(customerGraphContracts.researchRuntimeChanged, false, "Customer Intelligence Graph must not activate Research runtime.");

assert.equal(executiveIntelligenceStandard.standardId, "executive_intelligence_platform_v1", "Executive Intelligence standard id drifted.");
assert.equal(executiveIntelligenceStandard.artifactType, "executive_intelligence_package", "Executive Intelligence artifact type drifted.");
assert.equal(executiveIntelligenceStandard.status, "active_research_standard", "Executive Intelligence standard must be active.");
assert.equal(executiveIntelligenceStandard.productionRuntimeChange, false, "Executive Intelligence must not activate production runtime.");
assert.equal(
  executiveIntelligenceStandard.minimumQuestion,
  "What would a Fortune 100 Corporate Development team want to know before making an important strategic decision involving this business?",
  "Executive Intelligence minimum question drifted."
);
assert.deepEqual(
  executiveIntelligenceStandard.evidenceLabels,
  executiveIntelligenceEvidenceLabels,
  "Executive Intelligence evidence labels drifted."
);
assert.deepEqual(
  executiveIntelligenceStandard.requiredConclusionFields,
  executiveIntelligenceConclusionFields,
  "Executive Intelligence conclusion fields drifted."
);
assert.deepEqual(
  executiveIntelligenceStandard.intelligenceLayers.map(layer => layer.name),
  executiveIntelligenceLayerNames,
  "Executive Intelligence layer names drifted."
);
assert.equal(executiveIntelligenceStandard.intelligenceLayers.length, 12, "Executive Intelligence must define 12 layers.");
assert.equal(executiveIntelligenceStandard.researchRole.researchPreparesExecutives, true, "Research must prepare executives.");
assert.equal(executiveIntelligenceStandard.researchRole.dashboardDisplays, true, "Dashboard role must remain display-only.");
assert.equal(executiveIntelligenceStandard.researchRole.crmTracks, true, "CRM role must remain tracking-oriented.");
assert.equal(executiveIntelligenceStandard.researchRole.intelligenceInterprets, true, "Intelligence role must remain interpretation-oriented.");
assert.equal(executiveIntelligenceStandard.researchRole.overwatchGoverns, true, "Overwatch role must remain governance-oriented.");
assert.equal(executiveIntelligenceStandard.audiencePerspective.defaultPerspective, "receiving_executive", "Executive Intelligence packages must default to the receiving executive perspective.");
assert.equal(
  executiveIntelligenceStandard.audiencePerspective.prometheusDecisionMakerExceptionRequiresWorkspaceDefinition,
  true,
  "Prometheus decision-maker/operator exception must require explicit workspace definition."
);
assert.equal(executiveIntelligenceStandard.audiencePerspective.packageExecutesEngagement, false, "Executive Intelligence packages must not execute the engagement.");
assert.equal(
  executiveIntelligenceStandard.legacyDossierTransition.newDossiersAllowedAsPrimaryOutput,
  false,
  "Executive Intelligence must block new dossiers as primary output."
);
assert.equal(
  executiveIntelligenceStandard.legacyDossierTransition.existingDossiersRemainHistoricalArtifacts,
  true,
  "Existing dossiers must remain historical Research artifacts."
);
assert.equal(
  executiveIntelligenceStandard.legacyDossierTransition.dashboardMigrationRequiresFutureHandoff,
  true,
  "Dashboard migration must require future handoff."
);

assert.equal(executiveIntelligenceSchema.properties.platformStandard.const, "executive_intelligence_platform_v1", "Executive package schema standard const drifted.");
assert.equal(executiveIntelligenceSchema.properties.productionRuntimeChange.const, false, "Executive package schema must block runtime activation.");
assert.ok(executiveIntelligenceSchema.required.includes("audiencePerspective"), "Executive package schema must require audience perspective.");
assert.equal(
  executiveIntelligenceSchema.properties.audiencePerspective.properties.defaultPerspective.const,
  "receiving_executive",
  "Executive package schema must enforce receiving executive perspective."
);
assert.equal(
  executiveIntelligenceSchema.properties.audiencePerspective.properties.prometheusDecisionMakerException.const,
  false,
  "Executive package schema must block Prometheus decision-maker exception unless a future workspace-specific schema allows it."
);
assert.equal(
  executiveIntelligenceSchema.properties.audiencePerspective.properties.packageExecutesEngagement.const,
  false,
  "Executive package schema must prevent package execution ownership."
);
assert.deepEqual(
  executiveIntelligenceSchema.properties.evidenceLabels.items.enum,
  executiveIntelligenceEvidenceLabels,
  "Executive package schema evidence labels drifted."
);
assert.deepEqual(
  executiveIntelligenceSchema.properties.conclusionRequirements.items.enum,
  executiveIntelligenceConclusionFields,
  "Executive package schema conclusion requirements drifted."
);
assert.equal(executiveIntelligenceSchema.properties.layers.minItems, 12, "Executive package schema must require 12 layers.");
assert.equal(executiveIntelligenceSchema.properties.layers.maxItems, 12, "Executive package schema must cap packages at 12 canonical layers.");

for (const [index, layerName] of executiveIntelligenceLayerNames.entries()) {
  assert.equal(executiveIntelligenceStandard.intelligenceLayers[index].layer, index + 1, `Executive Intelligence layer ${index + 1} index drifted.`);
  assert.ok(executiveIntelligenceStandard.intelligenceLayers[index].requiredElements.length > 0, `Executive Intelligence layer ${index + 1} missing required elements.`);
  assert.ok(
    executiveIntelligencePlatform.includes(`${index + 1}.`) && executiveIntelligencePlatform.includes(layerName.split(" ")[0]),
    `Executive Intelligence platform doc missing layer ${index + 1}.`
  );
}

for (const heading of [
  "## Layer 1: Executive Summary",
  "## Layer 2: Business Identity",
  "## Layer 3: Ownership, Leadership, Public Operators, Corporate Structure, Timeline",
  "## Layer 4: Business Evolution, Expansion, Growth, Brand Development, Historical Milestones",
  "## Layer 5: Operational Intelligence",
  "## Layer 6: Commercial Ecosystem Intelligence",
  "## Layer 7: Competitive Intelligence",
  "## Layer 8: Community Intelligence",
  "## Layer 9: Digital Intelligence",
  "## Layer 10: Reputation Intelligence",
  "## Layer 11: Strategic Intelligence",
  "## Layer 12: Executive Decision Support"
]) {
  assert.ok(executiveIntelligenceTemplate.includes(heading), `Executive Intelligence template missing heading: ${heading}`);
}

for (const label of executiveIntelligenceEvidenceLabels) {
  assert.ok(executiveIntelligencePlatform.includes(label), `Executive Intelligence platform missing evidence label: ${label}`);
  assert.ok(executiveIntelligenceTemplate.includes(label), `Executive Intelligence template missing evidence label: ${label}`);
  assert.ok(sourcePolicy.includes(label), `Source policy missing Executive Intelligence label: ${label}`);
}

for (const apolloText of [
  "Apollo is permitted as a Research enrichment source",
  "Apollo is not a source of truth",
  "Apollo-derived findings must be labeled as enrichment signals",
  "Apollo = lead/contact/company enrichment source",
  "Research = verification, scoring, qualification probability, and Executive Intelligence Package creation",
  "Future franchise target lists must document whether Apollo was used"
]) {
  assert.ok(sourcePolicy.includes(apolloText), `Source policy missing Apollo standard text: ${apolloText}`);
  assert.ok(executiveIntelligencePlatform.includes(apolloText), `Executive Intelligence platform missing Apollo standard text: ${apolloText}`);
}

assert.equal(executiveIntelligenceStandard.enrichmentSourcePolicy.apolloPermitted, true, "Executive Intelligence standard must permit Apollo enrichment.");
assert.equal(
  executiveIntelligenceStandard.enrichmentSourcePolicy.apolloIsSourceOfTruth,
  false,
  "Executive Intelligence standard must not treat Apollo as source of truth."
);
assert.equal(
  executiveIntelligenceStandard.enrichmentSourcePolicy.requiresLawfulPublicSourceCorroboration,
  true,
  "Executive Intelligence standard must require corroboration for Apollo enrichment."
);
assert.ok(
  executiveIntelligenceSchema.properties.enrichmentSources.properties.apollo,
  "Executive Intelligence schema must support Apollo enrichment disclosure."
);

for (const phrase of [
  "Research produces Executive Intelligence Packages",
  "Fortune 100 Corporate Development",
  "Research prepares executives",
  "Every Executive Intelligence Package must be written from the perspective of the executive receiving the package",
  "Dashboard displays",
  "CRM tracks",
  "Intelligence interprets",
  "Overwatch governs",
  "Existing Executive Due Diligence Dossiers remain historical Research artifacts"
]) {
  assert.ok(executiveIntelligencePlatform.includes(phrase), `Executive Intelligence platform missing phrase: ${phrase}`);
  assert.ok(architecture.includes(phrase), `Research architecture missing Executive Intelligence phrase: ${phrase}`);
}

for (const requiredPath of [
  "research/gaia-research-orchestrator.md",
  "research/registers/gaia-evidence-engine.json",
  "research/schemas/gaia-evidence-item.schema.json",
  "research/executive-intelligence-platform.md",
  "research/registers/executive-intelligence-package-standard.json",
  "research/schemas/executive-intelligence-package.schema.json",
  "research/templates/executive-intelligence-package.md"
]) {
  assert.ok(researchFoundation.includes(requiredPath), `Root research foundation missing ${requiredPath}.`);
  assert.ok(researchReadme.includes(requiredPath.replace("research/", "")) || researchReadme.includes(requiredPath), `Research README missing ${requiredPath}.`);
  assert.ok(architecture.includes(requiredPath), `Research architecture missing ${requiredPath}.`);
}

for (const subsystem of protectedExecutiveIntelligenceSubsystems) {
  assert.ok(executiveIntelligenceStandard.protectedSubsystems.includes(subsystem), `Executive Intelligence standard missing protected subsystem: ${subsystem}`);
  assert.ok(executiveIntelligencePlatform.includes(subsystem), `Executive Intelligence platform missing protected subsystem: ${subsystem}`);
}

for (const [behavior, allowed] of Object.entries(executiveIntelligenceStandard.prohibitedBehavior)) {
  assert.equal(allowed, false, `Executive Intelligence prohibited behavior must be false: ${behavior}`);
}

assert.equal(executiveBenchmarkStudy.reportId, "executive_intelligence_benchmark_study_v1", "Executive benchmark report id drifted.");
assert.equal(executiveBenchmarkStudy.status, "founder_ready_research_artifact", "Executive benchmark must be founder-ready.");
assert.equal(executiveBenchmarkStudy.productionRuntimeChange, false, "Executive benchmark must not activate production runtime.");
assert.equal(
  executiveBenchmarkStudy.missionQuestion,
  "What makes executives trust recommendations?",
  "Executive benchmark mission question drifted."
);
assert.deepEqual(
  executiveBenchmarkStudy.organizationsAnalyzed,
  executiveBenchmarkOrganizations,
  "Executive benchmark organizations drifted."
);
assert.deepEqual(
  executiveBenchmarkStudy.methodologiesCompared,
  executiveBenchmarkMethodologies,
  "Executive benchmark methodologies drifted."
);
assert.deepEqual(
  executiveBenchmarkStudy.prometheusMethodology,
  executiveBenchmarkPrometheusMethodology,
  "Prometheus benchmark methodology drifted."
);
assert.equal(
  executiveBenchmarkStudy.sourceReferences.length >= 20,
  true,
  "Executive benchmark must preserve at least 20 source references."
);
assert.equal(
  executiveBenchmarkStudy.recommendedPackageStructure.length >= 20,
  true,
  "Executive benchmark must recommend a detailed package structure."
);

for (const organization of executiveBenchmarkOrganizations) {
  assert.ok(executiveBenchmarkReport.includes(organization), `Executive benchmark report missing organization: ${organization}`);
}

for (const methodology of executiveBenchmarkPrometheusMethodology) {
  const label = methodology.replaceAll("_", " ");
  assert.ok(
    executiveBenchmarkReport.toLowerCase().includes(label),
    `Executive benchmark report missing Prometheus methodology: ${label}`
  );
}

for (const section of [
  "Executive Summary",
  "Methodology Comparison",
  "Decision Framework Comparison",
  "Evidence Framework Comparison",
  "Risk Communication Comparison",
  "Executive Presentation Comparison",
  "Research Standards Comparison",
  "Private Equity vs Consulting Comparison",
  "Corporate Development Comparison",
  "Recommended Prometheus Executive Intelligence Methodology",
  "Recommended Executive Intelligence Package Structure",
  "Recommended Future Improvements",
  "Source References"
]) {
  assert.ok(executiveBenchmarkReport.includes(section), `Executive benchmark report missing section: ${section}`);
}

for (const phrase of [
  "This is not a copy exercise",
  "What makes executives trust recommendations",
  "Proprietary formats copied: no",
  "Copyrighted documents reproduced: no",
  "Dashboard modified: no",
  "CRM modified: no",
  "Intelligence runtime modified: no"
]) {
  assert.ok(executiveBenchmarkReport.includes(phrase), `Executive benchmark report missing phrase: ${phrase}`);
}

for (const [field, expected] of Object.entries({
  researchArtifactOnly: true,
  publicSourcesOnly: true,
  proprietaryFormatsCopied: false,
  copyrightedDocumentsReproduced: false,
  dashboardModified: false,
  crmModified: false,
  websiteModified: false,
  infrastructureModified: false,
  companionModified: false,
  mobileModified: false,
  intelligenceRuntimeModified: false,
  productionDataModified: false
})) {
  assert.equal(
    executiveBenchmarkStudy.boundaryConfirmation[field],
    expected,
    `Executive benchmark boundary confirmation drifted: ${field}`
  );
}

for (const requiredPath of [
  "research/reports/executive-intelligence-benchmark-study-v1.md",
  "research/reports/executive-intelligence-benchmark-study-v1.json"
]) {
  assert.ok(researchFoundation.includes(requiredPath), `Root research foundation missing ${requiredPath}.`);
  assert.ok(researchReadme.includes(requiredPath), `Research README missing ${requiredPath}.`);
  assert.ok(architecture.includes(requiredPath), `Research architecture missing ${requiredPath}.`);
}

assert.equal(smoothieDepotPackageRegister.workspaceId, "smoothie_depot", "Executive package register must stay in Smoothie Depot workspace.");
assert.equal(
  smoothieDepotPackageRegister.platformStandard,
  "executive_intelligence_platform_v1",
  "Executive package register must use the active platform standard."
);
assert.equal(smoothieDepotPackageRegister.productionRuntimeChange, false, "Executive package register must not activate runtime changes.");
assert.equal(smoothieDepotPackageRegister.boundaryConfirmation.standardModified, false, "Executive packages must not modify the standard.");
assert.equal(smoothieDepotPackageRegister.boundaryConfirmation.dashboardModified, false, "Executive packages must not modify Dashboard.");
assert.equal(smoothieDepotPackageRegister.boundaryConfirmation.crmModified, false, "Executive packages must not modify CRM.");
assert.equal(smoothieDepotPackageRegister.boundaryConfirmation.intelligenceRuntimeModified, false, "Executive packages must not modify Intelligence runtime.");
const activeProspectExecutivePackages = smoothieDepotPackageRegister.packages.filter(
  entry => entry.canonicalForResearch && entry.canonicalScope === "prospect_due_diligence"
);
const activeBrandStrategyPackages = smoothieDepotPackageRegister.packages.filter(
  entry => entry.canonicalForResearch && entry.canonicalScope === "brand_strategy_and_expansion_readiness"
);
const historicalNutritionDepotPackageRegisterEntry = smoothieDepotPackageRegister.packages.find(
  entry => entry.packageId === "smoothie_depot_eip_001_nutrition_depot"
);
const rebuiltNutritionDepotPackageRegisterEntry = smoothieDepotPackageRegister.packages.find(
  entry => entry.packageId === "smoothie_depot_eip_001_nutrition_depot_v2"
);
const smoothieDepotV3PackageRegisterEntry = smoothieDepotPackageRegister.packages.find(
  entry => entry.packageId === "smoothie_depot_eip_003_smoothie_depot_v3"
);
assert.deepEqual(
  activeProspectExecutivePackages.map(entry => entry.business),
  [
    "Nutrition Depot Houston and Greater Houston",
    "Cranky Carrot Juice Co."
  ],
  "Active canonical prospect Executive Intelligence Packages must match the current prospect leaders."
);
assert.deepEqual(
  activeProspectExecutivePackages.map(entry => entry.rank),
  [1, 2],
  "Active canonical prospect Executive Intelligence Packages must preserve rank order."
);
assert.deepEqual(
  activeBrandStrategyPackages.map(entry => entry.business),
  ["Smoothie Depot"],
  "Smoothie Depot v3 must be the sole canonical brand-strategy package."
);
assert.ok(smoothieDepotV3PackageRegisterEntry, "Smoothie Depot v3 register entry is required.");
assert.equal(smoothieDepotV3PackageRegisterEntry.canonicalForResearch, true, "Smoothie Depot v3 must be canonical for Research.");
assert.equal(
  smoothieDepotV3PackageRegisterEntry.canonicalScope,
  "brand_strategy_and_expansion_readiness",
  "Smoothie Depot v3 must stay in the brand-strategy scope."
);
assert.equal(smoothieDepotV3PackageRegisterEntry.priorPackageRevision, false, "Smoothie Depot v3 must be a new package, not a prior-package revision.");
assert.ok(rebuiltNutritionDepotPackageRegisterEntry, "Nutrition Depot v2 register entry is required.");
assert.equal(rebuiltNutritionDepotPackageRegisterEntry.canonicalForResearch, true, "Nutrition Depot v2 must be canonical for Research.");
assert.equal(rebuiltNutritionDepotPackageRegisterEntry.supersedesPackageId, "smoothie_depot_eip_001_nutrition_depot", "Nutrition Depot v2 must supersede v1.");
assert.ok(historicalNutritionDepotPackageRegisterEntry, "Nutrition Depot v1 historical register entry is required.");
assert.equal(historicalNutritionDepotPackageRegisterEntry.artifactStatus, "superseded_historical_research_package", "Nutrition Depot v1 must be preserved as historical.");
assert.equal(historicalNutritionDepotPackageRegisterEntry.canonicalForResearch, false, "Nutrition Depot v1 must not remain canonical after v2 rebuild.");
assert.equal(nutritionDepotExecutivePackageV1.packageId, "smoothie_depot_eip_001_nutrition_depot", "Nutrition Depot v1 artifact must remain available.");
assert.ok(nutritionDepotExecutivePackageReportV1.includes("Executive Intelligence Package"), "Nutrition Depot v1 historical markdown must remain available.");
assert.equal(nutritionDepotExecutivePackage.packageId, "smoothie_depot_eip_001_nutrition_depot_v2", "Nutrition Depot active package must be v2.");
assert.equal(nutritionDepotExecutivePackage.supersedesPackageId, "smoothie_depot_eip_001_nutrition_depot", "Nutrition Depot v2 must point to v1.");
assert.equal(nutritionDepotExecutivePackage.v1PreservedAsHistorical, true, "Nutrition Depot v2 must record v1 historical preservation.");
assert.ok(nutritionDepotExecutivePackage.ownershipFinding.finding.includes("Ivan Valdes"), "Nutrition Depot v2 must include Ivan Valdes ownership/control finding.");
assert.ok(nutritionDepotExecutivePackage.ivanValdesFinding.finding.includes("operator"), "Nutrition Depot v2 must include Ivan Valdes operator finding.");
assert.ok(nutritionDepotExecutivePackage.confirmedLocations.length >= 4, "Nutrition Depot v2 must include confirmed location intelligence.");
assert.ok(nutritionDepotExecutivePackage.websiteEcommerceIntelligence.findings.length >= 4, "Nutrition Depot v2 must include ecommerce intelligence.");
assert.ok(nutritionDepotExecutivePackage.reputationAnalysis.signals.length >= 5, "Nutrition Depot v2 must include reputation analysis.");
assert.ok(nutritionDepotExecutivePackage.socialPresenceAnalysis.signals.length >= 5, "Nutrition Depot v2 must include social presence analysis.");
assert.ok(nutritionDepotExecutivePackage.namedCompetitors.length >= 10, "Nutrition Depot v2 must include named competitors.");
assert.ok(nutritionDepotExecutivePackage.sourceReferences.length >= 20, "Nutrition Depot v2 must include deep source references.");
for (const v2RequiredText of [
  "Executive Intelligence Package v2",
  "Ivan Valdes",
  "Ownership / Control Finding",
  "Location Intelligence",
  "Website / Ecommerce Intelligence",
  "Public Reputation Signals",
  "Named Local and Channel Competitors",
  "Key Corrections From v1"
]) {
  assert.ok(nutritionDepotExecutivePackageReport.includes(v2RequiredText), `Nutrition Depot v2 report missing ${v2RequiredText}.`);
}

assert.equal(smoothieDepotExecutivePackageV3.packageId, "smoothie_depot_eip_003_smoothie_depot_v3", "Smoothie Depot v3 package id drifted.");
assert.equal(smoothieDepotExecutivePackageV3.packageVersion, "v3", "Smoothie Depot package must remain v3.");
assert.equal(smoothieDepotExecutivePackageV3.workspaceId, "smoothie_depot", "Smoothie Depot v3 must stay workspace-scoped.");
assert.equal(smoothieDepotExecutivePackageV3.business, "Smoothie Depot", "Smoothie Depot v3 business drifted.");
assert.equal(smoothieDepotExecutivePackageV3.canonicalForResearch, true, "Smoothie Depot v3 must remain canonical for Research.");
assert.equal(
  smoothieDepotExecutivePackageV3.canonicalScope,
  "brand_strategy_and_expansion_readiness",
  "Smoothie Depot v3 canonical scope drifted."
);
assert.equal(smoothieDepotExecutivePackageV3.priorPackageRevision, false, "Smoothie Depot v3 must not become a revision of a prior package.");
assert.equal(smoothieDepotExecutivePackageV3.standardModified, false, "Smoothie Depot v3 must not modify the package standard.");
assert.equal(smoothieDepotExecutivePackageV3.productionRuntimeChange, false, "Smoothie Depot v3 must not activate production runtime changes.");
assert.equal(smoothieDepotExecutivePackageV3.platformStandard, "executive_intelligence_platform_v1", "Smoothie Depot v3 platform standard drifted.");
assert.equal(smoothieDepotExecutivePackageV3.evidenceEngineStandard, "gaia_research_orchestrator_foundation_v1", "Smoothie Depot v3 Evidence Engine standard drifted.");
assert.deepEqual(smoothieDepotExecutivePackageV3.evidenceLabels, executiveIntelligenceEvidenceLabels, "Smoothie Depot v3 evidence labels drifted.");
assert.deepEqual(
  smoothieDepotExecutivePackageV3.conclusionRequirements,
  executiveIntelligenceConclusionFields,
  "Smoothie Depot v3 conclusion requirements drifted."
);
assert.deepEqual(
  smoothieDepotExecutivePackageV3.layers.map(layer => layer.name),
  executiveIntelligenceLayerNames,
  "Smoothie Depot v3 layer names drifted."
);
assert.equal(smoothieDepotExecutivePackageV3.layers.length, 12, "Smoothie Depot v3 must contain exactly 12 standard layers.");
assert.equal(smoothieDepotExecutivePackageV3.audiencePerspective.defaultPerspective, "receiving_executive", "Smoothie Depot v3 must use receiving-executive perspective.");
assert.equal(smoothieDepotExecutivePackageV3.audiencePerspective.prometheusDecisionMakerException, false, "Smoothie Depot v3 must not make Prometheus the decision-maker.");
assert.equal(smoothieDepotExecutivePackageV3.audiencePerspective.packageExecutesEngagement, false, "Smoothie Depot v3 must not execute the engagement.");
assert.equal(smoothieDepotExecutivePackageV3.enrichmentSources.apollo.apolloUsed, true, "Smoothie Depot v3 must document the Apollo query attempt.");
assert.equal(smoothieDepotExecutivePackageV3.enrichmentSources.apollo.apolloDerivedFieldsCaptured.length, 0, "Unavailable Apollo must not create derived evidence.");
assert.equal(smoothieDepotExecutivePackageV3.enrichmentSources.apollo.apolloIsSourceOfTruth, false, "Apollo must not become a source of truth.");
assert.equal(
  smoothieDepotExecutivePackageV3.enrichmentSources.apollo.requiresLawfulPublicSourceCorroboration,
  true,
  "Apollo must require lawful public-source corroboration."
);
assert.equal(
  smoothieDepotExecutivePackageV3.providerAvailability.find(provider => provider.provider === "Apollo")?.status,
  "attempted_unavailable",
  "Smoothie Depot v3 must preserve Apollo availability."
);
for (const providerName of ["Marketing Research GPT", "Consensus", "SciSpace", "AskYourPDF"]) {
  assert.equal(
    smoothieDepotExecutivePackageV3.providerAvailability.find(provider => provider.provider === providerName)?.status,
    "unavailable_in_active_environment",
    `${providerName} availability must be documented without fabricated use.`
  );
}
assert.ok(smoothieDepotExecutivePackageV3.majorConclusions.length >= 7, "Smoothie Depot v3 needs the complete major-conclusion set.");
for (const conclusion of smoothieDepotExecutivePackageV3.majorConclusions) {
  assert.ok(executiveIntelligenceEvidenceLabels.includes(conclusion.label), `Invalid Smoothie Depot v3 conclusion label: ${conclusion.label}`);
  assert.ok(!conclusion.label.includes("/"), `Smoothie Depot v3 conclusion must use exactly one label: ${conclusion.label}`);
  for (const field of executiveIntelligenceConclusionFields) {
    assert.ok(conclusion[field], `Smoothie Depot v3 conclusion missing ${field}: ${conclusion.conclusion}`);
  }
}
assert.ok(smoothieDepotExecutivePackageV3.sourceCatalog.length >= 30, "Smoothie Depot v3 must include a deep attributable source catalog.");
assert.ok(smoothieDepotExecutivePackageV3.sourceReferences.length >= 30, "Smoothie Depot v3 must include deep source references.");
assert.ok(smoothieDepotExecutivePackageV3.footprintLocations.length >= 9, "Smoothie Depot v3 must reconcile the public physical and mobile footprint.");
assert.ok(smoothieDepotExecutivePackageV3.competitiveLandscape.namedDirectCompetitors.length >= 7, "Smoothie Depot v3 must include named competitors.");
assert.ok(smoothieDepotExecutivePackageV3.riskRegister.length >= 6, "Smoothie Depot v3 must include a ranked risk register.");
assert.ok(smoothieDepotExecutivePackageV3.unknownValueRanking.length >= 10, "Smoothie Depot v3 must rank critical unknowns by decision value.");
assert.ok(smoothieDepotExecutivePackageV3.decisionTree.length >= 10, "Smoothie Depot v3 must include branching decision paths.");
assert.ok(smoothieDepotExecutivePackageV3.probabilityModel.estimates.length >= 4, "Smoothie Depot v3 must include bounded strategic probabilities.");
for (const estimate of smoothieDepotExecutivePackageV3.probabilityModel.estimates) {
  assert.ok(estimate.midpoint >= 0 && estimate.midpoint <= 100, `Invalid probability midpoint: ${estimate.outcome}`);
  assert.ok(estimate.drivers.length > 0, `Probability estimate missing drivers: ${estimate.outcome}`);
  assert.ok(estimate.falsifiers.length > 0, `Probability estimate missing falsifiers: ${estimate.outcome}`);
}
assert.ok(smoothieDepotExecutivePackageV3.qualityGate.length >= 10, "Smoothie Depot v3 must record the executive quality gate.");
for (const field of executiveIntelligenceSchema.required) {
  assert.notEqual(smoothieDepotExecutivePackageV3[field], undefined, `Smoothie Depot v3 missing schema-required field ${field}.`);
}
for (const [field, expected] of Object.entries({
  lawfulInformationOnly: true,
  psychologicalProfilingUsed: false,
  privateInformationUsed: false,
  restrictedPlatformScrapingUsed: false,
  hiddenRecordsUsed: false,
  surveillanceUsed: false,
  productionSystemsModified: false,
  dashboardModified: false,
  crmModified: false,
  websiteModified: false,
  infrastructureModified: false,
  companionModified: false,
  mobileModified: false,
  intelligenceRuntimeModified: false,
  fitnessConnectionDataUsed: false,
  routeIntelligenceUsed: false,
  activePoolUsed: false
})) {
  assert.equal(smoothieDepotExecutivePackageV3.boundaryConfirmation[field], expected, `Smoothie Depot v3 boundary drifted: ${field}`);
}

assert.equal(
  smoothieDepotExecutivePackageV3Evidence.ledgerId,
  "smoothie_depot_eip_003_smoothie_depot_v3_evidence",
  "Smoothie Depot v3 evidence ledger id drifted."
);
assert.equal(smoothieDepotExecutivePackageV3Evidence.packageId, smoothieDepotExecutivePackageV3.packageId, "Evidence ledger must point to Smoothie Depot v3.");
assert.equal(smoothieDepotExecutivePackageV3Evidence.workspaceId, "smoothie_depot", "Evidence ledger must stay workspace-scoped.");
assert.equal(smoothieDepotExecutivePackageV3Evidence.evidenceStandard, "gaia_research_orchestrator_foundation_v1", "Evidence ledger standard drifted.");
assert.ok(smoothieDepotExecutivePackageV3Evidence.evidenceItems.length >= 25, "Smoothie Depot v3 evidence ledger is too shallow.");
assert.ok(smoothieDepotExecutivePackageV3Evidence.conflictGroups.length >= 4, "Smoothie Depot v3 must preserve material evidence conflicts.");
assert.ok(smoothieDepotExecutivePackageV3Evidence.deduplication.duplicateGroups.length >= 4, "Smoothie Depot v3 must record deduplication groups.");
const smoothieDepotV3EvidenceIds = new Set();
const smoothieDepotV3SourceIds = new Set(smoothieDepotExecutivePackageV3.sourceCatalog.map(source => source.id));
for (const evidenceItem of smoothieDepotExecutivePackageV3Evidence.evidenceItems) {
  for (const field of gaiaEvidenceItemSchema.required) {
    assert.notEqual(evidenceItem[field], undefined, `Smoothie Depot v3 evidence ${evidenceItem.evidenceId} missing ${field}.`);
  }
  assert.ok(!smoothieDepotV3EvidenceIds.has(evidenceItem.evidenceId), `Duplicate Smoothie Depot v3 evidence id: ${evidenceItem.evidenceId}`);
  smoothieDepotV3EvidenceIds.add(evidenceItem.evidenceId);
  assert.ok(gaiaEvidenceEngine.confidenceLevels.includes(evidenceItem.confidence), `Invalid evidence confidence: ${evidenceItem.evidenceId}`);
  assert.ok(evidenceItem.evidenceQualityScore >= 0 && evidenceItem.evidenceQualityScore <= 100, `Invalid evidence quality score: ${evidenceItem.evidenceId}`);
  for (const sourceId of evidenceItem.sourceReferences) {
    assert.ok(smoothieDepotV3SourceIds.has(sourceId), `Evidence ${evidenceItem.evidenceId} references unknown source ${sourceId}.`);
  }
}
assert.equal(
  smoothieDepotExecutivePackageV3Evidence.evidenceItems.filter(item => item.allowedForExecutiveIntelligence).length,
  27,
  "Smoothie Depot v3 validated evidence count drifted."
);
const smoothieDepotV3ApolloEvidence = smoothieDepotExecutivePackageV3Evidence.evidenceItems.find(item => item.provider === "Apollo");
assert.ok(smoothieDepotV3ApolloEvidence, "Smoothie Depot v3 must include the Apollo provider-attempt record.");
assert.equal(smoothieDepotV3ApolloEvidence.normalizationStatus, "rejected", "Unavailable Apollo record must be rejected.");
assert.equal(smoothieDepotV3ApolloEvidence.allowedForExecutiveIntelligence, false, "Unavailable Apollo record must not enter Executive Intelligence.");
assert.equal(smoothieDepotExecutivePackageV3Evidence.handoffSummary.externalProviderRecommendationsAccepted, 0, "External providers must not supply recommendations.");
assert.equal(smoothieDepotExecutivePackageV3Evidence.handoffSummary.apolloDerivedFindingsAccepted, 0, "Apollo must not silently enter the package.");

for (const requiredText of [
  "Smoothie Depot Executive Intelligence Package v3",
  "Decision Architecture",
  "Executive Decision Page",
  "Decision thesis",
  "Opportunity Cost",
  "Provider Disclosure",
  "Probability model",
  "Unknown Value Analysis",
  "Decision Tree",
  "Red-Team Review",
  "Post-Meeting Learning Plan",
  "Intelligence Quality Control",
  "Standard modified | no",
  "Audience perspective | Receiving Smoothie Depot executive",
  "Prometheus decision-maker/operator exception | none"
]) {
  assert.ok(smoothieDepotExecutivePackageV3Report.includes(requiredText), `Smoothie Depot v3 report missing ${requiredText}.`);
}
for (const [index] of executiveIntelligenceLayerNames.entries()) {
  assert.ok(smoothieDepotExecutivePackageV3Report.includes(`## Layer ${index + 1}:`), `Smoothie Depot v3 report missing layer ${index + 1}.`);
}
for (const prohibitedPhrase of [
  "Cruz should",
  "Should Cruz",
  "Founder Mission Queue",
  "Call first",
  "call first",
  "first-call",
  "call priority",
  "Record after call",
  "Action:"
]) {
  assert.ok(!smoothieDepotExecutivePackageV3Report.includes(prohibitedPhrase), `Smoothie Depot v3 contains execution-assuming phrase: ${prohibitedPhrase}`);
}

const executivePackages = [
  {
    packageJson: nutritionDepotExecutivePackage,
    packageReport: nutritionDepotExecutivePackageReport,
    expectedBusiness: "Nutrition Depot Houston and Greater Houston",
    expectedRank: 1,
    requiredSource: "https://nutritiondepot.us/"
  },
  {
    packageJson: crankyCarrotExecutivePackage,
    packageReport: crankyCarrotExecutivePackageReport,
    expectedBusiness: "Cranky Carrot Juice Co.",
    expectedRank: 2,
    requiredSource: "https://www.crankycarrotjuice.co/"
  }
];

for (const packageArtifact of executivePackages) {
  assert.equal(packageArtifact.packageJson.workspaceId, "smoothie_depot", `${packageArtifact.expectedBusiness} package must stay workspace-scoped.`);
  assert.equal(
    packageArtifact.packageJson.platformStandard,
    "executive_intelligence_platform_v1",
    `${packageArtifact.expectedBusiness} package must use Executive Intelligence Platform v1.`
  );
  assert.equal(packageArtifact.packageJson.productionRuntimeChange, false, `${packageArtifact.expectedBusiness} package must not activate runtime changes.`);
  assert.equal(packageArtifact.packageJson.standardModified, false, `${packageArtifact.expectedBusiness} package must not modify the standard.`);
  assert.equal(packageArtifact.packageJson.business, packageArtifact.expectedBusiness, `${packageArtifact.expectedBusiness} package business drifted.`);
  assert.equal(packageArtifact.packageJson.founderMissionQueueRank, packageArtifact.expectedRank, `${packageArtifact.expectedBusiness} package rank drifted.`);
  assert.deepEqual(
    packageArtifact.packageJson.evidenceLabels,
    executiveIntelligenceEvidenceLabels,
    `${packageArtifact.expectedBusiness} evidence labels drifted.`
  );
  assert.deepEqual(
    packageArtifact.packageJson.conclusionRequirements,
    executiveIntelligenceConclusionFields,
    `${packageArtifact.expectedBusiness} conclusion requirements drifted.`
  );
  assert.deepEqual(
    packageArtifact.packageJson.layers.map(layer => layer.name),
    executiveIntelligenceLayerNames,
    `${packageArtifact.expectedBusiness} layer names drifted.`
  );
  assert.equal(packageArtifact.packageJson.layers.length, 12, `${packageArtifact.expectedBusiness} package must include 12 layers.`);
  assert.ok(packageArtifact.packageJson.majorConclusions.length >= 2, `${packageArtifact.expectedBusiness} package needs major conclusions.`);
  assert.equal(packageArtifact.packageJson.audiencePerspective.defaultPerspective, "receiving_executive", `${packageArtifact.expectedBusiness} package must use receiving executive perspective.`);
  assert.equal(packageArtifact.packageJson.audiencePerspective.prometheusDecisionMakerException, false, `${packageArtifact.expectedBusiness} package must not assume Prometheus decision-maker/operator role.`);
  assert.equal(packageArtifact.packageJson.audiencePerspective.packageExecutesEngagement, false, `${packageArtifact.expectedBusiness} package must not execute the engagement.`);
  assert.ok(packageArtifact.packageJson.unknownValueRanking.length >= 5, `${packageArtifact.expectedBusiness} package needs unknown value ranking.`);
  assert.ok(packageArtifact.packageJson.decisionTree.length >= 4, `${packageArtifact.expectedBusiness} package needs decision tree.`);
  assert.ok(packageArtifact.packageJson.sourceReferences.includes(packageArtifact.requiredSource), `${packageArtifact.expectedBusiness} package missing primary source.`);
  assert.equal(packageArtifact.packageJson.boundaryConfirmation.lawfulInformationOnly, true, `${packageArtifact.expectedBusiness} package must use lawful information only.`);
  assert.equal(packageArtifact.packageJson.boundaryConfirmation.psychologicalProfilingUsed, false, `${packageArtifact.expectedBusiness} package must prohibit profiling.`);
  assert.equal(packageArtifact.packageJson.boundaryConfirmation.privateInformationUsed, false, `${packageArtifact.expectedBusiness} package must prohibit private information.`);
  assert.equal(packageArtifact.packageJson.boundaryConfirmation.restrictedPlatformScrapingUsed, false, `${packageArtifact.expectedBusiness} package must prohibit restricted scraping.`);
  assert.equal(packageArtifact.packageJson.boundaryConfirmation.productionSystemsModified, false, `${packageArtifact.expectedBusiness} package must not modify production systems.`);
  assert.ok(packageArtifact.packageReport.includes("Standard modified: no"), `${packageArtifact.expectedBusiness} report must state standard was not modified.`);
  assert.ok(packageArtifact.packageReport.includes("Audience perspective: Receiving Smoothie Depot executive"), `${packageArtifact.expectedBusiness} report must state receiving executive audience perspective.`);
  assert.ok(packageArtifact.packageReport.includes("Prometheus decision-maker/operator exception: none"), `${packageArtifact.expectedBusiness} report must state no Prometheus decision-maker/operator exception.`);
  assert.ok(packageArtifact.packageReport.includes("Executive Decision Page"), `${packageArtifact.expectedBusiness} report missing executive decision page.`);
  assert.ok(packageArtifact.packageReport.includes("Decision thesis"), `${packageArtifact.expectedBusiness} report missing decision thesis.`);
  assert.ok(packageArtifact.packageReport.includes("Opportunity Cost"), `${packageArtifact.expectedBusiness} report missing opportunity cost.`);
  assert.ok(packageArtifact.packageReport.includes("Red-Team Review"), `${packageArtifact.expectedBusiness} report missing red-team review.`);
  assert.ok(packageArtifact.packageReport.includes("Decision Tree"), `${packageArtifact.expectedBusiness} report missing decision tree.`);
  assert.ok(packageArtifact.packageReport.includes("Post-Meeting Learning Plan"), `${packageArtifact.expectedBusiness} report missing post-meeting learning plan.`);
  for (const [index, layerName] of executiveIntelligenceLayerNames.entries()) {
    assert.ok(
      packageArtifact.packageReport.includes(`## Layer ${index + 1}:`) && packageArtifact.packageReport.includes(layerName.split(" ")[0]),
      `${packageArtifact.expectedBusiness} report missing layer ${index + 1}.`
    );
  }
  for (const prohibitedPhrase of [
    "Cruz should",
    "Should Cruz",
    "Founder Mission Queue",
    "Call first",
    "call first",
    "first-call",
    "call priority",
    "Record after call",
    "Action:"
  ]) {
    assert.ok(!packageArtifact.packageReport.includes(prohibitedPhrase), `${packageArtifact.expectedBusiness} report contains execution-assuming phrase: ${prohibitedPhrase}`);
  }
}

for (const requiredPath of [
  "research/workspaces/smoothie-depot/executive-intelligence-packages/package-register.json",
  "research/workspaces/smoothie-depot/executive-intelligence-packages/smoothie-depot-executive-intelligence-package-v3.md",
  "research/workspaces/smoothie-depot/executive-intelligence-packages/smoothie-depot-executive-intelligence-package-v3.json",
  "research/workspaces/smoothie-depot/executive-intelligence-packages/smoothie-depot-executive-intelligence-package-v3-evidence.json",
  "research/workspaces/smoothie-depot/executive-intelligence-packages/nutrition-depot-executive-intelligence-package-v2.md",
  "research/workspaces/smoothie-depot/executive-intelligence-packages/nutrition-depot-executive-intelligence-package-v2.json",
  "research/workspaces/smoothie-depot/executive-intelligence-packages/nutrition-depot-executive-intelligence-package-v1.md",
  "research/workspaces/smoothie-depot/executive-intelligence-packages/nutrition-depot-executive-intelligence-package-v1.json",
  "research/workspaces/smoothie-depot/executive-intelligence-packages/cranky-carrot-executive-intelligence-package-v1.md",
  "research/workspaces/smoothie-depot/executive-intelligence-packages/cranky-carrot-executive-intelligence-package-v1.json"
]) {
  assert.ok(researchFoundation.includes(requiredPath), `Root research foundation missing ${requiredPath}.`);
  assert.ok(researchReadme.includes(requiredPath.replace("research/", "")) || researchReadme.includes(requiredPath), `Research README missing ${requiredPath}.`);
  assert.ok(architecture.includes(requiredPath), `Research architecture missing ${requiredPath}.`);
}

for (const name of strategicBriefingNames) {
  assert.ok(briefingSystem.includes(name), `Briefing system missing product name: ${name}`);
}

assert.deepEqual(
  strategicBriefSchema.properties.briefingType.enum,
  strategicBriefingTypes,
  "Strategic brief schema must enumerate every recurring briefing type."
);

assert.deepEqual(
  briefingCatalog.briefings.map(briefing => briefing.id),
  strategicBriefingTypes,
  "Briefing catalog must define every recurring briefing type in canonical order."
);

for (const section of strategicRequiredSections) {
  assert.ok(briefingCatalog.requiredSections.includes(section), `Briefing catalog missing section: ${section}`);
  assert.ok(
    section === "sourceReferences" || strategicBriefSchema.properties.sections.required.includes(section),
    `Strategic brief schema missing required section: ${section}`
  );
}

for (const handoff of strategicFutureHandoffs) {
  assert.ok(briefingCatalog.futureHandoffTargets.includes(handoff), `Briefing catalog missing handoff target: ${handoff}`);
  assert.ok(briefingHandoffs.includes(`${handoff} Handoff`), `Briefing handoffs missing target: ${handoff}`);
  assert.ok(
    strategicBriefSchema.properties.futureHandoffCandidates.required.includes(handoff),
    `Strategic brief schema missing handoff candidate: ${handoff}`
  );
}

for (const briefing of briefingCatalog.briefings) {
  assert.ok(["daily", "weekly", "monthly"].includes(briefing.cadence), `Invalid briefing cadence: ${briefing.id}`);
  assert.deepEqual(briefing.requiredSections, strategicRequiredSections, `Briefing sections drifted: ${briefing.id}`);
  assert.equal(briefing.unsupportedScrapingAllowed, false, `Unsupported scraping must be false: ${briefing.id}`);
  assert.equal(briefing.productionIntegrationAllowed, false, `Production integration must be false: ${briefing.id}`);
  assert.ok(Array.isArray(briefing.primaryCategories), `Briefing needs categories: ${briefing.id}`);
  assert.ok(Array.isArray(briefing.industryLenses), `Briefing needs industry lenses: ${briefing.id}`);
  assert.ok(Array.isArray(briefing.sourceTypes), `Briefing needs source types: ${briefing.id}`);
}

for (const heading of [
  "Summary",
  "Why It Matters",
  "Impact On Prometheus",
  "Opportunities",
  "Risks",
  "Recommended Founder Actions",
  "Source References"
]) {
  assert.ok(strategicBriefTemplate.includes(heading), `Strategic brief template missing heading: ${heading}`);
}

assert.deepEqual(marketIntelligenceModel.capabilities, marketCapabilities, "Market Intelligence capabilities must match the requested capability set.");
for (const label of marketCapabilityLabels) {
  assert.ok(marketIntelligenceEngine.includes(label), `Market Intelligence doc missing capability: ${label}`);
}

const marketWeightTotal = marketIntelligenceModel.scoringDimensions.reduce((sum, dimension) => sum + dimension.weight, 0);
assert.equal(marketWeightTotal, 100, "Market Intelligence scoring dimensions must total 100 weight points.");

for (const dimension of marketIntelligenceModel.scoringDimensions) {
  assert.ok(dimension.id, "Market Intelligence scoring dimension missing id.");
  assert.ok(dimension.name, `Market Intelligence scoring dimension ${dimension.id} missing name.`);
  assert.ok(dimension.question, `Market Intelligence scoring dimension ${dimension.id} missing question.`);
  assert.ok(dimension.weight > 0, `Market Intelligence scoring dimension ${dimension.id} must have positive weight.`);
}

assert.deepEqual(
  marketIntelligenceModel.requiredFounderReadyOutput,
  marketRequiredFounderOutput,
  "Market Intelligence founder-ready output contract drifted."
);

for (const output of marketRequiredFounderOutput) {
  assert.ok(
    marketRecommendationSchema.required.includes(output),
    `Market recommendation schema missing required founder output: ${output}`
  );
}

for (const subsystem of protectedMarketSubsystems) {
  assert.ok(marketIntelligenceModel.protectedSubsystems.includes(subsystem), `Market model missing protected subsystem: ${subsystem}`);
  assert.ok(marketIntelligenceEngine.includes(subsystem), `Market Intelligence doc missing protected subsystem: ${subsystem}`);
}

for (const heading of [
  "Summary",
  "Market Score",
  "Why It Matters",
  "Impact On Prometheus",
  "Opportunities",
  "Risks",
  "Recommended Founder Actions",
  "Source References",
  "Confidence And Limitations",
  "Future Handoff Candidates"
]) {
  assert.ok(marketRecommendationTemplate.includes(heading), `Market recommendation template missing heading: ${heading}`);
}

assert.equal(
  marketExpansionScoring.status,
  "founder_ready_research_artifact",
  "Market expansion scoring artifact must be founder-ready research."
);
assert.equal(
  marketExpansionScoring.recommendation,
  "Prometheus should expand first into Roofing after the Fitness validation environment.",
  "Market expansion recommendation must preserve the first expansion recommendation."
);
assert.equal(
  marketExpansionScoring.industriesEvaluated.length >= marketExpansionRequiredIndustries.length,
  true,
  "Market expansion scoring must evaluate every required industry."
);

for (const industry of marketExpansionRequiredIndustries) {
  assert.ok(
    marketExpansionScoring.industriesEvaluated.some(evaluation => evaluation.industry === industry),
    `Market expansion scoring missing industry: ${industry}`
  );
  assert.ok(marketExpansionReport.includes(`###`) && marketExpansionReport.includes(industry), `Market expansion report missing industry: ${industry}`);
}

assert.deepEqual(
  marketExpansionScoring.top10ExpansionOpportunities,
  [
    "Roofing",
    "Solar",
    "HVAC",
    "Pest Control",
    "Home Services",
    "Security",
    "Medical",
    "Insurance",
    "Commercial Services",
    "Telecommunications"
  ],
  "Market expansion top 10 ranking drifted."
);
assert.ok(marketExpansionReport.includes("Why #1 Outranks #2"), "Market expansion report must explain why #1 outranks #2.");
assert.ok(marketExpansionReport.includes("Why #2 Outranks #3"), "Market expansion report must explain why #2 outranks #3.");
assert.ok(marketExpansionReport.includes("Immediate Targets"), "Market expansion report must identify immediate targets.");
assert.ok(marketExpansionReport.includes("Future Targets"), "Market expansion report must identify future targets.");
assert.ok(marketExpansionReport.includes("Long-Term Expansion"), "Market expansion report must identify long-term expansion.");
assert.equal(marketExpansionScoring.boundaryConfirmation.companionModified, false, "Market report must not modify Companion.");
assert.equal(marketExpansionScoring.boundaryConfirmation.dashboardModified, false, "Market report must not modify Dashboard.");
assert.equal(marketExpansionScoring.boundaryConfirmation.crmModified, false, "Market report must not modify CRM.");
assert.equal(marketExpansionScoring.boundaryConfirmation.mobileModified, false, "Market report must not modify Mobile.");
assert.equal(marketExpansionScoring.boundaryConfirmation.websiteModified, false, "Market report must not modify Website.");
assert.equal(marketExpansionScoring.boundaryConfirmation.intelligenceRuntimeModified, false, "Market report must not modify Intelligence runtime.");
assert.equal(marketExpansionScoring.sourceReferences.length >= 12, true, "Market expansion report must preserve source references.");

assert.equal(smoothieDepotProspects.workspaceId, "smoothie_depot", "Smoothie Depot prospects must stay in the Smoothie Depot workspace.");
assert.equal(
  smoothieDepotProspects.operatingProfileId,
  "franchise_development",
  "Smoothie Depot prospects must use the Franchise Development operating profile."
);
assert.equal(
  smoothieDepotProspects.intelligenceDomain,
  "business_acquisition_intelligence",
  "Smoothie Depot prospects must use Business Acquisition Intelligence."
);
assert.equal(smoothieDepotProspects.productionRuntimeChange, false, "Smoothie Depot prospects must not activate runtime changes.");
assert.equal(
  smoothieDepotProspects.dataPolicy.publicBusinessInformationOnly,
  true,
  "Smoothie Depot prospects must use public business information only."
);
assert.equal(
  smoothieDepotProspects.dataPolicy.restrictedPlatformScrapingUsed,
  false,
  "Smoothie Depot prospects must not use restricted-platform scraping."
);
assert.equal(
  smoothieDepotProspects.dataPolicy.unsupportedScrapingAllowed,
  false,
  "Smoothie Depot prospects must prohibit unsupported scraping."
);
assert.equal(
  smoothieDepotProspects.dataPolicy.privateFinancialsCollected,
  false,
  "Smoothie Depot prospects must not collect private financials."
);
assert.equal(smoothieDepotProspects.dataPolicy.creditReportsCollected, false, "Smoothie Depot prospects must not collect credit reports.");
assert.equal(smoothieDepotProspects.dataPolicy.bankInformationCollected, false, "Smoothie Depot prospects must not collect bank information.");
assert.equal(smoothieDepotProspects.dataPolicy.taxRecordsCollected, false, "Smoothie Depot prospects must not collect tax records.");
assert.equal(smoothieDepotProspects.dataPolicy.apolloEnrichment.apolloUsed, false, "Historical Smoothie Depot prospects must disclose Apollo was not used.");
assert.ok(
  smoothieDepotProspects.dataPolicy.apolloEnrichment.reasonNotUsed,
  "Smoothie Depot prospects must explain why Apollo was not used."
);
assert.equal(
  smoothieDepotProspects.dataPolicy.apolloEnrichment.futureTargetListsMustDocumentApolloUse,
  true,
  "Future franchise target lists must document Apollo usage."
);
assert.equal(
  smoothieDepotProspects.dataPolicy.apolloEnrichment.apolloIsSourceOfTruth,
  false,
  "Apollo must not be treated as source of truth."
);
assert.equal(
  smoothieDepotProspects.dataPolicy.apolloEnrichment.requiresLawfulPublicSourceCorroboration,
  true,
  "Apollo enrichment must require lawful public-source corroboration."
);
assert.equal(smoothieDepotProspects.workspaceIsolation.smoothieDepotWorkspaceOnly, true, "Smoothie Depot prospects must be workspace scoped.");
assert.equal(smoothieDepotProspects.workspaceIsolation.fitnessConnectionDataUsed, false, "Smoothie Depot prospects must not use Fitness Connection data.");
assert.equal(smoothieDepotProspects.workspaceIsolation.routeIntelligenceUsed, false, "Smoothie Depot prospects must not use Route Intelligence.");
assert.equal(smoothieDepotProspects.workspaceIsolation.activePoolUsed, false, "Smoothie Depot prospects must not use Active Pool.");
assert.equal(smoothieDepotProspects.workspaceIsolation.crossWorkspaceContamination, false, "Smoothie Depot prospects must avoid cross-workspace contamination.");

for (const subsystem of [
  "crmModified",
  "dashboardModified",
  "websiteModified",
  "infrastructureModified",
  "companionModified",
  "mobileModified",
  "intelligenceRuntimeModified"
]) {
  assert.equal(smoothieDepotProspects.workspaceIsolation[subsystem], false, `Smoothie Depot prospects must not modify ${subsystem}.`);
}

const smoothieDepotWeightTotal = smoothieDepotProspects.scoringModel.dimensions.reduce(
  (sum, dimension) => sum + dimension.weight,
  0
);
assert.equal(smoothieDepotWeightTotal, 100, "Smoothie Depot prospect scoring dimensions must total 100 points.");
assert.equal(smoothieDepotProspects.prospects.length >= 10, true, "Smoothie Depot prospect list must include at least 10 prospects.");
assert.deepEqual(
  smoothieDepotProspects.topCallTargets,
  [
    "Nutrition Depot Houston and Greater Houston",
    "Cranky Carrot Juice Co.",
    "LEEMOO Health Bar",
    "Tight Squeeze Juice Bar",
    "HS Green"
  ],
  "Smoothie Depot top call targets drifted."
);

for (const business of smoothieDepotRequiredProspects) {
  assert.ok(
    smoothieDepotProspects.prospects.some(prospect => prospect.business === business),
    `Smoothie Depot prospect list missing ${business}.`
  );
  assert.ok(smoothieDepotReport.includes(business), `Smoothie Depot report missing ${business}.`);
}

for (const prospect of smoothieDepotProspects.prospects) {
  assert.ok(Number.isInteger(prospect.rank), `Smoothie Depot prospect ${prospect.business} missing rank.`);
  assert.ok(prospect.business, "Smoothie Depot prospect missing business name.");
  assert.ok(prospect.category, `Smoothie Depot prospect ${prospect.business} missing category.`);
  assert.ok(prospect.location, `Smoothie Depot prospect ${prospect.business} missing location.`);
  assert.ok(prospect.publicReviewThemes.length > 0, `Smoothie Depot prospect ${prospect.business} needs public review themes.`);
  assert.ok(prospect.expansionIndicators.length > 0, `Smoothie Depot prospect ${prospect.business} needs expansion indicators.`);
  assert.ok(prospect.reasonGoodFranchiseProspect, `Smoothie Depot prospect ${prospect.business} missing franchise-fit reason.`);
  assert.ok(prospect.suggestedFirstOutreachAngle, `Smoothie Depot prospect ${prospect.business} missing outreach angle.`);
  assert.ok(prospect.confidenceLevel, `Smoothie Depot prospect ${prospect.business} missing confidence level.`);
  assert.ok(prospect.evidenceSources.length > 0, `Smoothie Depot prospect ${prospect.business} missing evidence sources.`);
}

for (const requiredText of [
  "Who should I call today?",
  "Allowed Public Sources",
  "Apollo Enrichment Standard",
  "Apollo is enrichment only",
  "Apollo = lead/contact/company enrichment source",
  "Future target lists must document Apollo use or explain why Apollo was not used",
  "Data Capture Contract",
  "Workspace Isolation Verification",
  "Fitness Connection data used: no.",
  "Route Intelligence used: no.",
  "Active Pool used: no.",
  "CRM modified: no.",
  "Dashboard modified: no."
]) {
  assert.ok(smoothieDepotWorkflow.includes(requiredText), `Smoothie Depot workflow missing ${requiredText}`);
}

for (const requiredText of [
  "Founder Answer",
  "Apollo enrichment status",
  "Apollo used: no.",
  "Future target lists must document Apollo use or explain why Apollo was not used.",
  "Research Notes",
  "Verified facts",
  "Hypotheses",
  "Source References",
  "Workspace Isolation Verification",
  "Restricted-platform scraping used: no."
]) {
  assert.ok(smoothieDepotReport.includes(requiredText), `Smoothie Depot report missing ${requiredText}`);
}

assert.equal(
  smoothieDepotExecutiveFramework.workspaceId,
  "smoothie_depot",
  "Smoothie Depot executive due diligence framework must stay workspace-scoped."
);
assert.equal(
  smoothieDepotExecutiveFramework.operatingProfileId,
  "franchise_development",
  "Smoothie Depot executive due diligence framework must use Franchise Development."
);
assert.equal(
  smoothieDepotExecutiveFramework.productionRuntimeChange,
  false,
  "Smoothie Depot executive due diligence framework must not activate runtime changes."
);
assert.deepEqual(
  smoothieDepotExecutiveFramework.evidenceModel.labels,
  smoothieDepotEvidenceLabels,
  "Executive due diligence evidence labels drifted."
);
assert.deepEqual(
  smoothieDepotProspects.executiveDueDiligence.evidenceClassification,
  smoothieDepotEvidenceLabels,
  "Smoothie Depot prospect evidence classification drifted."
);
assert.equal(
  smoothieDepotExecutiveFramework.dataPolicy.publicBusinessInformationOnly,
  true,
  "Executive due diligence framework must use public business information only."
);
assert.equal(
  smoothieDepotExecutiveFramework.dataPolicy.psychologicalProfilingAllowed,
  false,
  "Executive due diligence framework must prohibit psychological profiling."
);
assert.equal(
  smoothieDepotExecutiveFramework.dataPolicy.restrictedPlatformScrapingUsed,
  false,
  "Executive due diligence framework must not use restricted-platform scraping."
);
assert.equal(
  smoothieDepotExecutiveFramework.workspaceIsolation.fitnessConnectionDataUsed,
  false,
  "Executive due diligence framework must not use Fitness Connection data."
);
assert.equal(
  smoothieDepotExecutiveFramework.workspaceIsolation.routeIntelligenceUsed,
  false,
  "Executive due diligence framework must not use Route Intelligence."
);
assert.equal(
  smoothieDepotExecutiveFramework.workspaceIsolation.activePoolUsed,
  false,
  "Executive due diligence framework must not use Active Pool."
);

for (const field of [
  "evidenceQuality",
  "sourceReliability",
  "confidence",
  "businessImpact",
  "verificationPriority"
]) {
  assert.ok(
    smoothieDepotExecutiveFramework.confidenceModel.requiredFieldsPerRecommendation.includes(field),
    `Executive confidence model missing ${field}.`
  );
}

for (const prospect of smoothieDepotProspects.prospects) {
  const confidence = smoothieDepotProspects.executiveDueDiligence.decisionConfidence.find(
    entry => entry.business === prospect.business
  );
  assert.ok(confidence, `Executive decision confidence missing for ${prospect.business}.`);
  for (const field of smoothieDepotExecutiveFramework.confidenceModel.requiredFieldsPerRecommendation) {
    assert.ok(confidence[field], `Executive decision confidence for ${prospect.business} missing ${field}.`);
  }
}

for (const observation of smoothieDepotProspects.executiveDueDiligence.majorObservationAnalysis) {
  for (const field of smoothieDepotExecutiveFramework.secondOrderAnalysisFields) {
    assert.ok(observation[field], `Major observation missing second-order field ${field}.`);
  }
  for (const field of smoothieDepotExecutiveFramework.thirdOrderAnalysisFields) {
    assert.ok(observation.thirdOrderEffect[field], `Major observation missing third-order field ${field}.`);
  }
}

assert.equal(
  smoothieDepotProspects.executiveDueDiligence.oneCallRecommendation.business,
  "Nutrition Depot Houston and Greater Houston",
  "Executive one-call recommendation must preserve Nutrition Depot."
);
assert.equal(
  smoothieDepotProspects.executiveDueDiligence.oneCallRecommendation.comparedAgainstEveryKnownProspect,
  true,
  "Executive one-call recommendation must compare against every known prospect."
);
assert.equal(
  smoothieDepotProspects.executiveDueDiligence.alternativeHypotheses.length >= 3,
  true,
  "Executive due diligence must include alternative hypotheses."
);
assert.equal(
  smoothieDepotProspects.executiveDueDiligence.redTeamReview.weakestEvidence.length > 0,
  true,
  "Executive due diligence must include red-team weakest evidence."
);
assert.equal(
  smoothieDepotProspects.executiveDueDiligence.unknownValueRanking[0].unknown,
  "Decision-maker openness to second-concept or franchise expansion",
  "Highest-value unknown must target decision-maker expansion openness."
);
assert.equal(
  smoothieDepotProspects.executiveDueDiligence.decisionTree.length >= 5,
  true,
  "Executive due diligence must include a scenario decision tree."
);
assert.equal(
  smoothieDepotProspects.executiveDueDiligence.decisionJournalTemplate.includes("predictedOutcome"),
  true,
  "Executive due diligence must include post-meeting decision journal fields."
);
assert.equal(
  smoothieDepotProspects.executiveDueDiligence.qualityControl.contradictionsIdentified,
  true,
  "Executive due diligence must identify contradictions."
);
assert.equal(
  smoothieDepotProspects.executiveDueDiligence.qualityControl.unknownsPrioritized,
  true,
  "Executive due diligence must prioritize unknowns."
);

const nutritionDepotProspect = smoothieDepotProspects.prospects.find(
  prospect => prospect.business === "Nutrition Depot Houston and Greater Houston"
);
assert.ok(nutritionDepotProspect, "Nutrition Depot prospect must remain present.");
assert.equal(
  nutritionDepotProspect.canonicalDossier,
  "research/workspaces/smoothie-depot/dossiers/nutrition-depot-executive-due-diligence-dossier-v1.md",
  "Nutrition Depot prospect must point to the canonical Research dossier."
);
assert.equal(smoothieDepotDossierRegister.workspaceId, "smoothie_depot", "Dossier register must stay in Smoothie Depot workspace.");
assert.equal(smoothieDepotDossierRegister.productionRuntimeChange, false, "Dossier register must not activate runtime changes.");
assert.equal(
  smoothieDepotDossierRegister.canonicalDossiers[0].business,
  "Nutrition Depot Houston and Greater Houston",
  "First canonical dossier must be Nutrition Depot."
);
assert.equal(
  smoothieDepotDossierRegister.canonicalDossiers[0].status,
  "completed_canonical_research_dossier",
  "Nutrition Depot dossier must be completed."
);
assert.equal(
  smoothieDepotDossierRegister.canonicalDossiers[0].dashboardCanonicalSource,
  true,
  "Dossier register must mark the Nutrition Depot artifact as Dashboard-consumable source."
);
assert.equal(nutritionDepotDossier.workspaceId, "smoothie_depot", "Nutrition Depot dossier must stay in Smoothie Depot workspace.");
assert.equal(
  nutritionDepotDossier.businessSelected,
  "Nutrition Depot Houston and Greater Houston",
  "Nutrition Depot dossier must select the highest-ranked prospect."
);
assert.equal(nutritionDepotDossier.founderMissionQueueRank, 1, "Nutrition Depot dossier must be rank 1.");
assert.equal(
  nutritionDepotDossier.artifactStatus,
  "completed_canonical_research_dossier",
  "Nutrition Depot dossier must be completed canonical Research artifact."
);
assert.equal(
  nutritionDepotDossier.remediationStatus,
  "supersedes_prior_thin_dossier_in_place",
  "Nutrition Depot dossier must explicitly supersede the prior thin dossier."
);
assert.equal(nutritionDepotDossier.productionRuntimeChange, false, "Nutrition Depot dossier must not activate runtime changes.");
assert.equal(nutritionDepotDossier.dataPolicy.publicBusinessInformationOnly, true, "Nutrition Depot dossier must use public business info only.");
assert.equal(nutritionDepotDossier.dataPolicy.privateFinancialsCollected, false, "Nutrition Depot dossier must not collect private financials.");
assert.equal(nutritionDepotDossier.dataPolicy.creditReportsCollected, false, "Nutrition Depot dossier must not collect credit reports.");
assert.equal(nutritionDepotDossier.dataPolicy.bankInformationCollected, false, "Nutrition Depot dossier must not collect bank information.");
assert.equal(nutritionDepotDossier.dataPolicy.taxRecordsCollected, false, "Nutrition Depot dossier must not collect tax records.");
assert.equal(nutritionDepotDossier.dataPolicy.psychologicalProfileCreated, false, "Nutrition Depot dossier must not create a psychological profile.");
assert.equal(nutritionDepotDossier.dataPolicy.restrictedPlatformScrapingUsed, false, "Nutrition Depot dossier must not use restricted-platform scraping.");
assert.equal(nutritionDepotDossier.workspaceIsolation.fitnessConnectionDataUsed, false, "Nutrition Depot dossier must not use Fitness Connection data.");
assert.equal(nutritionDepotDossier.workspaceIsolation.routeIntelligenceUsed, false, "Nutrition Depot dossier must not use Route Intelligence.");
assert.equal(nutritionDepotDossier.workspaceIsolation.activePoolUsed, false, "Nutrition Depot dossier must not use Active Pool.");

assert.deepEqual(
  nutritionDepotDossier.requiredDossierSections,
  smoothieDepotRequiredDossierSections,
  "Nutrition Depot dossier must include every v4 required dossier section."
);
assert.equal(
  nutritionDepotDossier.sectionDecisionQualityLedger.status,
  "complete",
  "Nutrition Depot dossier must include a complete section decision-quality ledger."
);
assert.equal(
  nutritionDepotDossier.sectionDecisionQualityLedger.sectionsCovered,
  30,
  "Nutrition Depot decision-quality ledger must cover all 30 sections."
);
for (const field of [
  "conclusionLabel",
  "majorConclusion",
  "evidenceBasis",
  "sourceReliability",
  "confidenceLevel",
  "verificationNeeded"
]) {
  assert.ok(
    nutritionDepotDossier.sectionDecisionQualityLedger.requiredFieldsPerSection.includes(field),
    `Nutrition Depot decision-quality ledger missing required field ${field}.`
  );
}
for (const [index, section] of smoothieDepotRequiredDossierSections.entries()) {
  assert.ok(
    nutritionDepotDossierReport.includes(`## ${index + 1}. ${section}`),
    `Nutrition Depot dossier report missing section ${index + 1}. ${section}.`
  );
  assert.ok(
    nutritionDepotDossierReport.includes(`### Section ${index + 1} Decision Quality: ${section}`),
    `Nutrition Depot dossier report missing decision-quality ledger for section ${index + 1}. ${section}.`
  );
}
for (const requiredText of [
  "Remediation status: Supersedes the prior thin canonical dossier in place.",
  "Evidence label rule:",
  "Complete 30-Section Decision Quality Ledger",
  "Second-Order Analysis",
  "Third-Order Analysis",
  "Opportunity Cost Analysis",
  "Alternative Hypotheses",
  "Red Team Review",
  "Unknown Value Analysis",
  "Business History Reconstruction",
  "Review Intelligence Analysis",
  "Digital Maturity Analysis",
  "Market Intelligence",
  "Business Decision Support",
  "Uncertainty Analysis",
  "Comparative Analysis",
  "Scenario Analysis",
  "Decision Journal Seed",
  "Quality Control / Red-Team Review",
  "Scenario Decision Tree",
  "Post-Meeting Learning Journal",
  "Intelligence Quality Control",
  "Workspace Isolation Verification"
]) {
  assert.ok(nutritionDepotDossierReport.includes(requiredText), `Nutrition Depot dossier missing ${requiredText}.`);
}
for (const moduleComplete of [
  "businessHistoryReconstruction",
  "reviewIntelligenceAnalysis",
  "digitalMaturityAnalysis",
  "marketIntelligence",
  "businessDecisionSupport",
  "uncertaintyAnalysis",
  "comparativeAnalysis",
  "scenarioAnalysis",
  "decisionJournalSeed",
  "qualityControlRedTeamReview"
]) {
  assert.equal(
    nutritionDepotDossier.requiredAnalyticalModules[moduleComplete],
    true,
    `Nutrition Depot dossier missing analytical module ${moduleComplete}.`
  );
}
assert.equal(nutritionDepotDossier.qualityControlCompleted, true, "Nutrition Depot dossier must complete quality control.");
assert.equal(
  nutritionDepotDossier.remainingUnknowns.includes("Second-concept or franchise expansion openness"),
  true,
  "Nutrition Depot dossier must preserve franchise openness as a remaining unknown."
);
assert.equal(
  nutritionDepotDossier.sourceReliabilityMatrix.length >= 5,
  true,
  "Nutrition Depot dossier must include a source reliability matrix."
);

for (const requiredText of [
  "Evidence Classification",
  "Required Dossier Sections",
  "Executive Challenge Questions",
  "Second-Order Analysis Standard",
  "Third-Order Analysis Standard",
  "Opportunity Cost Standard",
  "Alternative Hypothesis Standard",
  "Red Team Review Standard",
  "Unknown Value Analysis Standard",
  "Decision Confidence Model",
  "Scenario Decision Tree",
  "Decision Journal Framework",
  "Quality Control Gate",
  "Workspace Isolation Verification"
]) {
  assert.ok(smoothieDepotExecutiveStandard.includes(requiredText), `Executive due diligence standard missing ${requiredText}.`);
}

for (const requiredText of [
  "Executive Due Diligence Layer",
  "Opportunity Cost Analysis",
  "Major Observation Analysis",
  "Alternative Hypotheses",
  "Red Team Review",
  "Unknown Value Analysis",
  "Decision Confidence Matrix",
  "Decision Tree",
  "Conversation Preparation",
  "JR Executive Brief",
  "Post-Meeting Learning Journal",
  "Intelligence Quality Control"
]) {
  assert.ok(smoothieDepotReport.includes(requiredText), `Smoothie Depot executive report missing ${requiredText}.`);
}

assert.equal(sourceRegister.sources.length >= 6, true, "Source register needs internal and external seed sources.");
const apolloSource = sourceRegister.sources.find(source => source.id === "apollo-enrichment");
assert.ok(apolloSource, "Source register must include Apollo enrichment.");
assert.equal(apolloSource.trustTier, "Tier 3", "Apollo enrichment must remain a directional Tier 3 source.");
assert.equal(apolloSource.enrichmentOnly, true, "Apollo must be registered as enrichment only.");
assert.equal(apolloSource.requiresCorroboration, true, "Apollo must require corroboration.");
assert.equal(apolloSource.permittedForFranchiseTargetLists, true, "Apollo must be permitted for franchise target lists.");
assert.ok(apolloSource.limitations.includes("not a source of truth"), "Apollo limitations must state source-of-truth boundary.");
for (const source of sourceRegister.sources) {
  assert.ok(source.id, "Source is missing id.");
  assert.ok(source.title, `Source ${source.id} is missing title.`);
  assert.ok(source.publisher, `Source ${source.id} is missing publisher.`);
  assert.ok(source.sourceRef, `Source ${source.id} is missing sourceRef.`);
  assert.ok(["Tier 1", "Tier 2", "Tier 3"].includes(source.trustTier), `Invalid source tier: ${source.id}`);
  assert.ok(Array.isArray(source.categories), `Source ${source.id} categories must be an array.`);
  assert.ok(source.limitations, `Source ${source.id} must describe limitations.`);
}

assert.equal(backlog.items.length >= 5, true, "Research backlog should seed recurring research loops.");
for (const item of backlog.items) {
  assert.ok(requiredCategories.includes(item.category), `Backlog item has invalid category: ${item.id}`);
  assert.ok(Array.isArray(item.industryLens), `Backlog item ${item.id} needs industry lenses.`);
  assert.ok(item.question, `Backlog item ${item.id} needs a research question.`);
  assert.ok(item.recommendedCadence, `Backlog item ${item.id} needs a cadence.`);
}

console.log("Research foundation validation passed.");
