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
