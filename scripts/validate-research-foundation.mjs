import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const readJson = path => JSON.parse(readFileSync(path, "utf8"));
const readText = path => readFileSync(path, "utf8");

const taxonomy = readJson("research/taxonomy/research-taxonomy.json");
const sourceRegister = readJson("research/registers/source-register.json");
const backlog = readJson("research/registers/intelligence-backlog.json");
const briefingCatalog = readJson("research/registers/briefing-catalog.json");
const schema = readJson("research/schemas/founder-intelligence-brief.schema.json");
const strategicBriefSchema = readJson("research/schemas/strategic-intelligence-brief.schema.json");
const architecture = readText("research/architecture.md");
const sourcePolicy = readText("research/source-policy.md");
const template = readText("research/templates/founder-intelligence-brief.md");
const strategicBriefTemplate = readText("research/templates/strategic-intelligence-brief.md");
const briefingSystem = readText("research/briefing-system.md");
const briefingHandoffs = readText("research/future-briefing-handoffs.md");
const researchFoundation = readText("RESEARCH_FOUNDATION.md");

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
