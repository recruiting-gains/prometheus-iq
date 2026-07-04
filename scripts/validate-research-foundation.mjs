import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const readJson = path => JSON.parse(readFileSync(path, "utf8"));
const readText = path => readFileSync(path, "utf8");

const taxonomy = readJson("research/taxonomy/research-taxonomy.json");
const sourceRegister = readJson("research/registers/source-register.json");
const backlog = readJson("research/registers/intelligence-backlog.json");
const briefingCatalog = readJson("research/registers/briefing-catalog.json");
const marketIntelligenceModel = readJson("research/registers/market-intelligence-model.json");
const marketExpansionScoring = readJson("research/reports/market-expansion-scoring-v1.json");
const smoothieDepotExecutiveFramework = readJson("research/workspaces/smoothie-depot/executive-due-diligence-framework-v4.json");
const smoothieDepotDossierRegister = readJson("research/workspaces/smoothie-depot/dossiers/dossier-register.json");
const nutritionDepotDossier = readJson("research/workspaces/smoothie-depot/dossiers/nutrition-depot-executive-due-diligence-dossier-v1.json");
const smoothieDepotProspects = readJson("research/workspaces/smoothie-depot/ranked-business-prospects-2026-07-03.json");
const schema = readJson("research/schemas/founder-intelligence-brief.schema.json");
const strategicBriefSchema = readJson("research/schemas/strategic-intelligence-brief.schema.json");
const marketRecommendationSchema = readJson("research/schemas/market-intelligence-recommendation.schema.json");
const architecture = readText("research/architecture.md");
const sourcePolicy = readText("research/source-policy.md");
const template = readText("research/templates/founder-intelligence-brief.md");
const strategicBriefTemplate = readText("research/templates/strategic-intelligence-brief.md");
const marketRecommendationTemplate = readText("research/templates/market-expansion-recommendation.md");
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
for (const [index, section] of smoothieDepotRequiredDossierSections.entries()) {
  assert.ok(
    nutritionDepotDossierReport.includes(`## ${index + 1}. ${section}`),
    `Nutrition Depot dossier report missing section ${index + 1}. ${section}.`
  );
}
for (const requiredText of [
  "Second-Order Analysis",
  "Third-Order Analysis",
  "Opportunity Cost Analysis",
  "Alternative Hypotheses",
  "Red Team Review",
  "Unknown Value Analysis",
  "Scenario Decision Tree",
  "Post-Meeting Learning Journal",
  "Intelligence Quality Control",
  "Workspace Isolation Verification"
]) {
  assert.ok(nutritionDepotDossierReport.includes(requiredText), `Nutrition Depot dossier missing ${requiredText}.`);
}
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
