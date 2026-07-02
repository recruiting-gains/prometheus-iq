import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import {
  loadFieldVisitFixtures,
  runOfflineEvidenceHarness
} from "../intelligence/field-learning-offline-evidence-harness.mjs";

const root = resolve(import.meta.dirname, "..");

test("offline field learning harness CLI passes", () => {
  const result = spawnSync("node", ["scripts/verify-field-learning-offline-evidence-harness.mjs"], {
    cwd: root,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.status, "passed");
  assert.equal(summary.productionSafety.productionLearningActive, false);
});

test("simulated field visit fixtures cover required Anthony beta evidence cases", () => {
  const fixtures = loadFieldVisitFixtures();
  const scenarioIds = fixtures.scenarios.map(scenario => scenario.scenarioId);

  for (const expected of [
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
  ]) {
    assert.ok(scenarioIds.includes(expected), `Missing fixture ${expected}`);
  }
});

test("every simulated visit becomes normalized evidence and learning signals", () => {
  const report = runOfflineEvidenceHarness();

  assert.equal(report.status, "passed");
  assert.equal(report.summary.fixtureCount, 11);
  assert.equal(report.summary.evidenceCount, report.summary.fixtureCount);
  for (const result of report.scenarioResults) {
    assert.equal(result.evidence.contractVersion, report.contractVersion);
    assert.equal(result.evidence.productionLearningActive, false);
    assert.equal(result.admissionDecision.allowedForOfflineLearning, true);
    assert.ok(result.signals.length > 0, `${result.scenarioId} must produce signals`);
    assert.ok(result.signals.every(signal => signal.allowedInfluence === "offline_validation_only" || signal.allowedInfluence === "blocked_by_human_override"));
  }
});

test("confidence before and after snapshots are generated without production influence", () => {
  const report = runOfflineEvidenceHarness();

  for (const result of report.scenarioResults) {
    assert.equal(result.confidenceBefore.stage, "before");
    assert.equal(result.confidenceAfter.stage, "after");
    assert.equal(result.confidenceBefore.allowedInfluence, "none");
    assert.ok(["offline_validation_only", "review_only"].includes(result.confidenceAfter.allowedInfluence));
    assert.equal(result.confidenceAfter.productionLearningActive, false);
    assert.ok(typeof result.confidenceAfter.evidenceCount === "number");
  }

  const sale = report.scenarioResults.find(result => result.scenarioId === "successful-sale");
  assert.ok(sale.confidenceAfter.confidenceScore > sale.confidenceBefore.confidenceScore);

  const badLead = report.scenarioResults.find(result => result.scenarioId === "bad-lead");
  assert.equal(badLead.confidenceAfter.confidenceBand, "blocked");
});

test("explanations answer why, evidence, confidence, and what changed", () => {
  const report = runOfflineEvidenceHarness();

  for (const result of report.scenarioResults) {
    assert.ok(result.explanation.why.length > 0, `${result.scenarioId} missing why`);
    assert.ok(result.explanation.whatEvidence.length > 0, `${result.scenarioId} missing evidence`);
    assert.ok(result.explanation.howConfident.before, `${result.scenarioId} missing confidence before`);
    assert.ok(result.explanation.howConfident.after, `${result.scenarioId} missing confidence after`);
    assert.ok(result.explanation.whatChanged.length > 0, `${result.scenarioId} missing what changed`);
  }
});

test("human override blocks learning influence without blocking review visibility", () => {
  const report = runOfflineEvidenceHarness();
  const duplicate = report.scenarioResults.find(result => result.scenarioId === "duplicate-location");

  assert.ok(duplicate.humanOverride);
  assert.equal(duplicate.humanOverride.overrideType, "mark_duplicate_business");
  assert.equal(duplicate.admissionDecision.reviewRequired, true);
  assert.equal(duplicate.confidenceAfter.allowedInfluence, "review_only");
  assert.equal(duplicate.confidenceAfter.reviewState, "human_review_required");
  assert.ok(duplicate.signals.every(signal => signal.allowedInfluence === "blocked_by_human_override"));
});

test("offline harness preserves no-production-change safety flags", () => {
  const report = runOfflineEvidenceHarness();

  assert.deepEqual(report.productionSafety, {
    productionLearningActive: false,
    productionRecommendationChanges: false,
    dashboardRuntimeChanges: false,
    activePoolChanges: false,
    routeScoringChanges: false,
    crmMutations: false
  });
});
