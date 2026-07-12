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

test("field learning loop foundation covers completed visit evidence and learning contracts", () => {
  const foundation = read("intelligence/adaptive-field-learning-loop-foundation.md");
  const contracts = readJson("intelligence/contracts/field-learning-loop-contracts.json");

  const expectedEvidenceFields = [
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

  for (const field of expectedEvidenceFields) {
    assert.ok(contracts.evidenceFields.includes(field), `Missing evidence field ${field}`);
  }

  for (const heading of ["Field Evidence Capture", "Learning Signal Normalization", "Confidence Framework", "Explainability Framework", "Human Override"]) {
    assert.ok(foundation.includes(heading), `Missing foundation heading ${heading}`);
  }
});

test("field learning loop remains production-safe and reviewable", () => {
  const contracts = readJson("intelligence/contracts/field-learning-loop-contracts.json");

  assert.equal(contracts.status, "architecture_only");
  assert.equal(contracts.productionBehaviorChanged, false);
  assert.equal(contracts.scoringChanged, false);
  assert.equal(contracts.dashboardRuntimeChanged, false);
  assert.equal(contracts.activePoolChanged, false);
  assert.equal(contracts.dataGovernanceChanged, false);
  assert.equal(contracts.infrastructureChanged, false);
  assert.equal(contracts.anthonyBetaChanged, false);
  assert.equal(contracts.productionLearningActive, false);
  assert.ok(contracts.requiredActivationGates.includes("human_review_state"));
  assert.ok(contracts.prohibitions.includes("no_production_learning_activation"));
});

test("field learning loop prepares required subsystem contracts without consumption", () => {
  const handoffs = read("intelligence/field-learning-loop-handoffs.md");
  const contracts = readJson("intelligence/contracts/field-learning-loop-contracts.json");
  const expected = ["Dashboard", "CRM", "Research", "Companion", "Sales"];

  for (const subsystem of expected) {
    assert.ok(handoffs.includes(`${subsystem} Handoff`), `Missing ${subsystem} handoff`);
    assert.ok(contracts.futureSubsystemContracts.includes(subsystem), `Missing ${subsystem} contract`);
  }

  assert.ok(handoffs.includes("It does not authorize production integration."));
});

test("read-only archived-session learning is independently authorized without recommendation activation", () => {
  const contract = readJson("intelligence/contracts/read-only-field-session-learning-contracts.json");
  const policy = readJson("intelligence/config/read-only-field-session-learning-policy-v1.json");
  const snapshot = readJson("intelligence/artifacts/read-only-field-session-learning/fitness_connection/cruz/learning-snapshot-v1.json");

  assert.equal(contract.status, "active_read_only");
  assert.equal(contract.independentAuthorization.status, "AUTHORIZED_ACTIVE");
  assert.equal(contract.independentAuthorization.accessMode, "read_only");
  assert.equal(contract.allowedOperations.modifyData, false);
  assert.equal(contract.allowedOperations.replaySessions, false);
  assert.equal(contract.productionSafety.productionRecommendationInfluenceActive, false);
  assert.equal(contract.productionSafety.routeScoringWeightsChanged, false);
  assert.equal(policy.recommendationInfluence.singleSessionInfluenceAllowed, false);
  assert.equal(policy.recommendationInfluence.activationStatus, "disabled_pending_future_handoff");
  assert.equal(snapshot.sourceEvidence.verifiedSessionCount, 1);
  assert.equal(snapshot.recommendationSafety.recommendationEligibleConclusionCount, 0);
  assert.equal(snapshot.archiveSafety.archiveMutationPerformed, false);
  assert.equal(snapshot.archiveSafety.historicalReplayPerformed, false);
});
