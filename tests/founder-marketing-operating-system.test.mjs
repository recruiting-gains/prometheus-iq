import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const read = path => readFileSync(new URL(path, root), "utf8");
const parseJson = path => JSON.parse(read(path));

const operatingSystemPath = "social-media/founder-marketing-operating-system/founder-marketing-operating-system.v1.json";
const docs = [
  "social-media/founder-marketing-operating-system/README.md",
  "social-media/founder-marketing-operating-system/content-calendar.md",
  "social-media/founder-marketing-operating-system/founder-content-workflow.md",
  "social-media/founder-marketing-operating-system/platform-strategy-and-cadence.md",
  "social-media/founder-marketing-operating-system/campaign-kpi-attribution-framework.md",
  "social-media/founder-marketing-operating-system/brand-and-growth-strategy.md",
  "social-media/founder-marketing-operating-system/templates/campaign-brief.template.md"
];

test("Founder Marketing Operating System has required platforms and manual-only publishing", () => {
  const system = parseJson(operatingSystemPath);
  const platformIds = Object.keys(system.platforms).sort();

  assert.equal(system.version, "founder-marketing-operating-system.v1");
  assert.deepEqual(platformIds, ["instagram", "linkedin", "tiktok", "x", "youtube"]);
  assert.equal(system.productionIntegrations, false);
  assert.equal(system.liveMetaApis, false);
  assert.equal(system.livePosting, false);

  for (const platform of Object.values(system.platforms)) {
    assert.equal(platform.publishing, "manual");
  }
});

test("Founder Marketing Operating System covers content, campaign, KPI, attribution, and growth systems", () => {
  const system = parseJson(operatingSystemPath);

  assert.ok(system.contentPillars.includes("Field Reality"));
  assert.ok(system.contentPillars.includes("Founder Build In Public"));
  assert.ok(system.campaignTypes.includes("Enterprise Trust"));
  assert.ok(system.kpis.awareness.includes("reach"));
  assert.ok(system.kpis.engagement.includes("comments"));
  assert.ok(system.kpis.intent.includes("website_visits"));
  assert.ok(system.attributionPlanning.website.includes("utm_campaign"));
  assert.ok(system.attributionPlanning.crm.includes("lead_source"));
});

test("Founder Marketing Operating System preserves subsystem boundaries", () => {
  const system = parseJson(operatingSystemPath);

  assert.ok(system.subsystemBoundaries.doesNotModify.includes("Anthony beta"));
  assert.ok(system.subsystemBoundaries.doesNotModify.includes("Website"));
  assert.ok(system.subsystemBoundaries.doesNotModify.includes("Dashboard"));
  assert.ok(system.subsystemBoundaries.doesNotModify.includes("CRM"));
  assert.ok(system.subsystemBoundaries.handoffOnly.includes("Website attribution"));
  assert.ok(system.subsystemBoundaries.handoffOnly.includes("CRM attribution"));
});

test("Founder Marketing documentation includes all required operating-system areas", () => {
  const combined = docs.map(read).join("\n");
  const requiredPhrases = [
    "Content Calendar",
    "Founder Content Workflow",
    "Weekly Cadence",
    "Instagram",
    "LinkedIn",
    "X",
    "YouTube",
    "TikTok",
    "Campaign",
    "KPI",
    "Brand Consistency",
    "Website Attribution",
    "CRM Attribution",
    "Founder Growth Strategy"
  ];

  for (const phrase of requiredPhrases) {
    assert.ok(combined.includes(phrase), `missing required phrase: ${phrase}`);
  }
});

test("Founder Marketing docs block live integrations and Anthony beta exposure", () => {
  const combined = docs.map(read).join("\n");
  const system = parseJson(operatingSystemPath);

  for (const guardrail of [
    "No production integrations",
    "No OAuth",
    "No live Meta APIs",
    "No live posting",
    "No Anthony beta exposure",
    "No Website changes",
    "No Dashboard changes",
    "No CRM changes"
  ]) {
    assert.ok(system.guardrails.includes(guardrail), `missing guardrail: ${guardrail}`);
  }

  assert.ok(combined.includes("Do not publish Anthony-specific beta details"));
  assert.ok(combined.includes("Manual publishing only"));
  assert.equal(/access_token|client_secret|password=/i.test(combined), false);
});
