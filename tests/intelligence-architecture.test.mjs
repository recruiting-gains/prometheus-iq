import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = path => readFileSync(resolve(root, path), "utf8");
const readJson = path => JSON.parse(read(path));

test("intelligence architecture validation gate passes", () => {
  const result = spawnSync("node", ["scripts/validate-intelligence-architecture.mjs"], {
    cwd: root,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test("adaptive intelligence contract registry is architecture-only", () => {
  const contracts = readJson("intelligence/contracts/adaptive-intelligence-contracts.json");

  assert.equal(contracts.status, "architecture_only");
  assert.equal(contracts.productionBehaviorChanged, false);
  assert.equal(contracts.scoringChanged, false);
  assert.equal(contracts.dashboardRuntimeChanged, false);
  assert.equal(contracts.activePoolChanged, false);
  assert.equal(contracts.dataGovernanceChanged, false);
});

test("adaptive intelligence architecture covers required outside-sales learning domains", () => {
  const contracts = readJson("intelligence/contracts/adaptive-intelligence-contracts.json");
  const requiredDomains = [
    "visit_outcome_learning",
    "confidence_engine",
    "recommendation_explanation_engine",
    "industry_intelligence",
    "territory_intelligence",
    "rep_intelligence",
    "organization_intelligence",
    "continuous_learning_pipeline",
    "opportunity_ranking",
    "pattern_detection",
    "recommendation_confidence",
    "explainable_ai",
    "human_override",
    "knowledge_graph",
    "learning_contracts"
  ];

  for (const domain of requiredDomains) {
    assert.ok(contracts.capabilityDomains.includes(domain), `Missing domain ${domain}`);
  }
});

test("future subsystem handoffs are prepared without production integration", () => {
  const handoffs = read("intelligence/future-subsystem-handoffs.md");
  const expected = ["Dashboard Handoff", "CRM Handoff", "Research Handoff", "Companion Handoff", "Data Handoff", "Sales Handoff"];

  for (const heading of expected) {
    assert.ok(handoffs.includes(heading), `Missing ${heading}`);
  }
  assert.ok(handoffs.includes("This document prepares future handoffs. It does not authorize implementation."));
});

