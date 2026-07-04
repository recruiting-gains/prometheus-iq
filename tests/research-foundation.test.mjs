import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readJson = path => JSON.parse(readFileSync(path, "utf8"));
const readText = path => readFileSync(path, "utf8");

test("Research foundation preserves production subsystem boundaries", () => {
  const taxonomy = readJson("research/taxonomy/research-taxonomy.json");
  const architecture = readText("research/architecture.md");
  const policy = readText("research/source-policy.md");

  for (const subsystem of taxonomy.prohibitedTargetsForDirectModification) {
    assert.match(architecture, new RegExp(subsystem));
    assert.match(policy, new RegExp(subsystem));
  }

  assert.match(architecture, /No live integrations\./);
  assert.match(architecture, /No automated web scraping\./);
  assert.match(policy, /unsupported scraped sources/i);
});

test("Founder Intelligence Brief contract covers required categories", () => {
  const schema = readJson("research/schemas/founder-intelligence-brief.schema.json");
  const template = readText("research/templates/founder-intelligence-brief.md");

  const expectedCategories = [
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

  assert.deepEqual(schema.properties.categoryCoverage.required, expectedCategories);

  for (const category of expectedCategories) {
    assert.match(template, new RegExp(`${category}:`));
  }
});

test("Research taxonomy keeps Prometheus horizontal across outside-sales industries", () => {
  const taxonomy = readJson("research/taxonomy/research-taxonomy.json");

  for (const industry of [
    "Healthcare field sales",
    "Medical device sales",
    "Solar",
    "Roofing",
    "Pest control",
    "Security",
    "Telecom",
    "Commercial services",
    "Industrial sales",
    "Logistics"
  ]) {
    assert.ok(taxonomy.industryLenses.includes(industry), `Missing industry lens: ${industry}`);
  }
});

test("Founder Strategic Intelligence Briefing System defines every recurring brief", () => {
  const catalog = readJson("research/registers/briefing-catalog.json");
  const schema = readJson("research/schemas/strategic-intelligence-brief.schema.json");
  const system = readText("research/briefing-system.md");

  const expectedBriefings = [
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

  assert.deepEqual(catalog.briefings.map(briefing => briefing.id), expectedBriefings);
  assert.deepEqual(schema.properties.briefingType.enum, expectedBriefings);

  for (const briefing of catalog.briefings) {
    assert.match(system, new RegExp(briefing.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.equal(briefing.unsupportedScrapingAllowed, false);
    assert.equal(briefing.productionIntegrationAllowed, false);
  }
});

test("Strategic briefings enforce required executive sections and future handoff boundaries", () => {
  const catalog = readJson("research/registers/briefing-catalog.json");
  const schema = readJson("research/schemas/strategic-intelligence-brief.schema.json");
  const template = readText("research/templates/strategic-intelligence-brief.md");
  const handoffs = readText("research/future-briefing-handoffs.md");

  const requiredSections = [
    "summary",
    "whyItMatters",
    "impactOnPrometheus",
    "opportunities",
    "risks",
    "recommendedFounderActions",
    "sourceReferences"
  ];

  assert.deepEqual(catalog.requiredSections, requiredSections);

  for (const briefing of catalog.briefings) {
    assert.deepEqual(briefing.requiredSections, requiredSections);
  }

  for (const section of requiredSections.filter(section => section !== "sourceReferences")) {
    assert.ok(schema.properties.sections.required.includes(section), `Missing schema section: ${section}`);
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
    assert.match(template, new RegExp(heading));
  }

  for (const target of ["Companion", "Intelligence Engine", "Website", "Sales"]) {
    assert.ok(catalog.futureHandoffTargets.includes(target));
    assert.ok(schema.properties.futureHandoffCandidates.required.includes(target));
    assert.match(handoffs, new RegExp(`${target} Handoff`));
  }
});

test("Market Intelligence Engine defines expansion scoring without production runtime activation", () => {
  const model = readJson("research/registers/market-intelligence-model.json");
  const schema = readJson("research/schemas/market-intelligence-recommendation.schema.json");
  const engine = readText("research/market-intelligence-engine.md");
  const customerGraphContracts = readJson("intelligence/contracts/customer-intelligence-graph-contracts.json");

  const expectedCapabilities = [
    "market_opportunity_scoring",
    "industry_attractiveness_analysis",
    "outside_sales_market_ranking",
    "competitor_movement_tracking",
    "ai_trend_tracking",
    "partnership_opportunities",
    "geographic_expansion_opportunities",
    "enterprise_target_identification"
  ];

  assert.deepEqual(model.capabilities, expectedCapabilities);
  assert.equal(model.runtimeActive, false);
  assert.equal(model.productionSystemsModified, false);
  assert.equal(model.unsupportedScrapingAllowed, false);
  assert.equal(customerGraphContracts.status, "architecture_only");
  assert.equal(customerGraphContracts.researchRuntimeChanged, false);
  assert.match(engine, /Which outside-sales market should Prometheus pursue next/);
  assert.match(engine, /Customer Intelligence Graph/);

  for (const field of model.requiredFounderReadyOutput) {
    assert.ok(schema.required.includes(field), `Market recommendation schema missing ${field}`);
  }
});

test("Market Intelligence scoring model is weighted and protects blocked subsystems", () => {
  const model = readJson("research/registers/market-intelligence-model.json");
  const template = readText("research/templates/market-expansion-recommendation.md");

  const weightTotal = model.scoringDimensions.reduce((sum, dimension) => sum + dimension.weight, 0);
  assert.equal(weightTotal, 100);

  for (const dimension of model.scoringDimensions) {
    assert.equal(typeof dimension.id, "string");
    assert.equal(typeof dimension.question, "string");
    assert.ok(dimension.weight > 0);
  }

  for (const subsystem of ["Companion", "Dashboard", "CRM", "Mobile", "Intelligence runtime"]) {
    assert.ok(model.protectedSubsystems.includes(subsystem), `Missing protected subsystem ${subsystem}`);
  }

  for (const heading of [
    "Market Score",
    "Why It Matters",
    "Impact On Prometheus",
    "Recommended Founder Actions",
    "Source References",
    "Boundary Confirmation"
  ]) {
    assert.match(template, new RegExp(heading));
  }
});

test("Market Expansion Recommendation evaluates required industries and ranks top opportunities", () => {
  const scoring = readJson("research/reports/market-expansion-scoring-v1.json");
  const report = readText("research/reports/market-expansion-recommendation-v1.md");

  for (const industry of [
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
  ]) {
    assert.ok(scoring.industriesEvaluated.some(evaluation => evaluation.industry === industry), `Missing ${industry}`);
    assert.match(report, new RegExp(industry.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.deepEqual(scoring.top10ExpansionOpportunities, [
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
  ]);
  assert.equal(scoring.industriesEvaluated[0].industry, "Roofing");
  assert.equal(scoring.industriesEvaluated[0].opportunityScore, 86);
  assert.match(report, /Why #1 Outranks #2/);
  assert.match(report, /Why #2 Outranks #3/);
});

test("Market Expansion Recommendation remains research-only with source references", () => {
  const scoring = readJson("research/reports/market-expansion-scoring-v1.json");
  const report = readText("research/reports/market-expansion-recommendation-v1.md");

  assert.equal(scoring.boundaryConfirmation.companionModified, false);
  assert.equal(scoring.boundaryConfirmation.dashboardModified, false);
  assert.equal(scoring.boundaryConfirmation.crmModified, false);
  assert.equal(scoring.boundaryConfirmation.mobileModified, false);
  assert.equal(scoring.boundaryConfirmation.websiteModified, false);
  assert.equal(scoring.boundaryConfirmation.intelligenceRuntimeModified, false);
  assert.equal(scoring.boundaryConfirmation.productionDeploymentRequired, false);
  assert.ok(scoring.sourceReferences.length >= 12);
  assert.match(report, /Source References/);
  assert.match(report, /No Companion files modified/);
});

test("Smoothie Depot prospect discovery creates a workspace-isolated daily call list", () => {
  const prospects = readJson("research/workspaces/smoothie-depot/ranked-business-prospects-2026-07-03.json");
  const workflow = readText("research/workspaces/smoothie-depot/business-prospect-discovery-workflow-v1.md");
  const report = readText("research/workspaces/smoothie-depot/ranked-business-prospects-2026-07-03.md");

  assert.equal(prospects.workspaceId, "smoothie_depot");
  assert.equal(prospects.operatingProfileId, "franchise_development");
  assert.equal(prospects.intelligenceDomain, "business_acquisition_intelligence");
  assert.equal(prospects.productionRuntimeChange, false);
  assert.equal(prospects.dataPolicy.publicBusinessInformationOnly, true);
  assert.equal(prospects.dataPolicy.restrictedPlatformScrapingUsed, false);
  assert.equal(prospects.workspaceIsolation.fitnessConnectionDataUsed, false);
  assert.equal(prospects.workspaceIsolation.routeIntelligenceUsed, false);
  assert.equal(prospects.workspaceIsolation.activePoolUsed, false);
  assert.equal(prospects.workspaceIsolation.crmModified, false);
  assert.equal(prospects.workspaceIsolation.dashboardModified, false);
  assert.equal(prospects.workspaceIsolation.intelligenceRuntimeModified, false);

  assert.match(workflow, /Who should I call today\?/);
  assert.match(workflow, /Allowed Public Sources/);
  assert.match(workflow, /Do not scrape unsupported or restricted sources/);
  assert.match(workflow, /Fitness Connection data used: no\./);
  assert.match(workflow, /Route Intelligence used: no\./);
  assert.match(workflow, /Active Pool used: no\./);
  assert.match(report, /Founder Answer/);
  assert.match(report, /Workspace Isolation Verification/);

  assert.ok(prospects.prospects.length >= 10);
  assert.deepEqual(prospects.topCallTargets, [
    "Nutrition Depot Houston and Greater Houston",
    "Cranky Carrot Juice Co.",
    "LEEMOO Health Bar",
    "Tight Squeeze Juice Bar",
    "HS Green"
  ]);

  for (const business of [
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
  ]) {
    assert.ok(prospects.prospects.some(prospect => prospect.business === business), `Missing ${business}`);
    assert.match(report, new RegExp(business.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  for (const prospect of prospects.prospects) {
    assert.ok(prospect.opportunityScore >= 0 && prospect.opportunityScore <= 100);
    assert.ok(prospect.publicContactMethods.length > 0);
    assert.ok(prospect.expansionIndicators.length > 0);
    assert.ok(prospect.reasonGoodFranchiseProspect);
    assert.ok(prospect.suggestedFirstOutreachAngle);
    assert.ok(prospect.evidenceSources.length > 0);
  }
});

test("Smoothie Depot executive due diligence standard enforces challenge loops and decision quality", () => {
  const framework = readJson("research/workspaces/smoothie-depot/executive-due-diligence-framework-v4.json");
  const prospects = readJson("research/workspaces/smoothie-depot/ranked-business-prospects-2026-07-03.json");
  const standard = readText("research/workspaces/smoothie-depot/executive-due-diligence-intelligence-standard-v4.md");
  const report = readText("research/workspaces/smoothie-depot/ranked-business-prospects-2026-07-03.md");

  assert.equal(framework.workspaceId, "smoothie_depot");
  assert.equal(framework.operatingProfileId, "franchise_development");
  assert.equal(framework.productionRuntimeChange, false);
  assert.equal(framework.dataPolicy.publicBusinessInformationOnly, true);
  assert.equal(framework.dataPolicy.psychologicalProfilingAllowed, false);
  assert.equal(framework.dataPolicy.restrictedPlatformScrapingUsed, false);
  assert.equal(framework.workspaceIsolation.fitnessConnectionDataUsed, false);
  assert.equal(framework.workspaceIsolation.routeIntelligenceUsed, false);
  assert.equal(framework.workspaceIsolation.activePoolUsed, false);

  const evidenceLabels = [
    "observed",
    "inferred_from_multiple_evidence_sources",
    "self_reported",
    "owner_provided",
    "unknown"
  ];

  assert.deepEqual(framework.evidenceModel.labels, evidenceLabels);
  assert.deepEqual(prospects.executiveDueDiligence.evidenceClassification, evidenceLabels);
  assert.equal(prospects.executiveDueDiligence.oneCallRecommendation.business, "Nutrition Depot Houston and Greater Houston");
  assert.equal(prospects.executiveDueDiligence.oneCallRecommendation.comparedAgainstEveryKnownProspect, true);

  for (const prospect of prospects.prospects) {
    const confidence = prospects.executiveDueDiligence.decisionConfidence.find(
      entry => entry.business === prospect.business
    );
    assert.ok(confidence, `Missing confidence model for ${prospect.business}`);
    for (const field of framework.confidenceModel.requiredFieldsPerRecommendation) {
      assert.ok(confidence[field], `${prospect.business} missing ${field}`);
    }
  }

  for (const observation of prospects.executiveDueDiligence.majorObservationAnalysis) {
    for (const field of framework.secondOrderAnalysisFields) {
      assert.ok(observation[field], `Missing second-order field ${field}`);
    }
    for (const field of framework.thirdOrderAnalysisFields) {
      assert.ok(observation.thirdOrderEffect[field], `Missing third-order field ${field}`);
    }
  }

  assert.ok(prospects.executiveDueDiligence.alternativeHypotheses.length >= 3);
  assert.ok(prospects.executiveDueDiligence.redTeamReview.weakestEvidence.length > 0);
  assert.equal(
    prospects.executiveDueDiligence.unknownValueRanking[0].unknown,
    "Decision-maker openness to second-concept or franchise expansion"
  );
  assert.ok(prospects.executiveDueDiligence.decisionTree.length >= 5);
  assert.ok(prospects.executiveDueDiligence.decisionJournalTemplate.includes("actualOutcome"));
  assert.equal(prospects.executiveDueDiligence.qualityControl.contradictionsIdentified, true);
  assert.equal(prospects.executiveDueDiligence.qualityControl.unknownsPrioritized, true);

  for (const section of [
    "Executive Challenge Questions",
    "Second-Order Analysis Standard",
    "Third-Order Analysis Standard",
    "Opportunity Cost Standard",
    "Alternative Hypothesis Standard",
    "Red Team Review Standard",
    "Unknown Value Analysis Standard",
    "Decision Journal Framework",
    "Quality Control Gate"
  ]) {
    assert.match(standard, new RegExp(section));
  }

  for (const section of [
    "Opportunity Cost Analysis",
    "Major Observation Analysis",
    "Alternative Hypotheses",
    "Red Team Review",
    "Unknown Value Analysis",
    "Decision Confidence Matrix",
    "Decision Tree",
    "JR Executive Brief",
    "Post-Meeting Learning Journal",
    "Intelligence Quality Control"
  ]) {
    assert.match(report, new RegExp(section));
  }
});
