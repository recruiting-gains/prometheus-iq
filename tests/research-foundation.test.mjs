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
