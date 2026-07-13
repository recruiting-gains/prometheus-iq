import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  buildCommittedArchiveRecord,
  buildFounderReadinessReport,
  buildShadowLedger,
  loadShadowDecisionConfig,
  loadShadowDecisionContract,
  readinessStates,
  renderFounderReadinessMarkdown,
  shadowDecisionReadinessVersion,
} from "../intelligence/shadow-decision-readiness.mjs";

const root = resolve(import.meta.dirname, "..");
const base =
  "data/route-iq-field-sessions-v1/workspaces/fitness_connection/sessions/route-iq-field-session-fitness-connection-fitness-cruz-2026-07-11";
const paths = {
  raw: `${base}/raw/prometheus-iq-cruz-daily-report-2026-07-11.json`,
  normalized: `${base}/normalized/field-session.json`,
  calculated: `${base}/normalized/calculated-metrics.json`,
  stressTestEvidence: `${base}/evidence/stress-test-observations.json`,
  historyUpdates: `${base}/normalized/history-updates.json`,
};
const serialize = (value) => `${JSON.stringify(value, null, 2)}\n`;
export const requiredProtectedBehaviorBaselineKeys = Object.freeze([
  "activePool",
  "businessHours",
  "dashboardDeployMirror",
  "dashboardSource",
  "discovery",
  "nearby",
  "routeGeneration",
  "routeQualityGate",
  "routeScoring",
  "runtimePools",
  "worker",
]);

export function validateShadowDecisionContractCoherence(contract, config) {
  assert.equal(contract.batchId, config.batchId);
  assert.deepEqual(contract.scope, config.scope);
  assert.equal(
    contract.version,
    "route-iq-shadow-decision-readiness-contract-v1",
  );
  assert.equal(
    config.configVersion,
    "route-iq-shadow-decision-readiness-config-v1",
  );
  assert.equal(
    shadowDecisionReadinessVersion,
    "route-iq-shadow-decision-readiness-v1",
  );
  assert.equal(
    contract.sourceProjectionVersion,
    "route-iq-chronological-evidence-projection-v1",
  );
  assert.deepEqual(contract.states, [...readinessStates]);
  assert.deepEqual(contract.directiveGates, [
    "zero_influence",
    "temporal_integrity",
    "deterministic_replay",
    "completeness",
    "outcome_integrity",
    "evaluation_validity",
    "statistical_sufficiency",
    "segment_safety",
    "calibration_stability",
    "isolation_compatibility",
  ]);
  assert.equal(contract.statisticalDesign.requiredSample, 97);
  assert.equal(
    contract.statisticalDesign.derivedPerBinSupport,
    Math.ceil(97 / config.calibrationBinCount),
  );
  assert.equal(
    contract.validationFixturePolicy.classification,
    "VALIDATION_ONLY_NON_PRODUCTION_NEVER_CANONICAL",
  );
  const fixture = JSON.parse(
    readFileSync(resolve(root, contract.artifacts.fixture), "utf8"),
  );
  assert.equal(
    fixture.fixtureClassification,
    contract.validationFixturePolicy.classification,
  );
  assert.equal(fixture.canonicalGenerationAllowed, false);
  assert.equal(contract.isolation.recommendationInfluence, "OFF");
  assert.equal(config.recommendationInfluence, "OFF");
  assert.equal(config.minimumActualActionLinkRate, 1);
  assert.equal(config.minimumAnyOutcomeLinkRate, 1);
  assert.equal(config.minimumScoreableSelectedCandidateOutcomeRate, 1);
  assert.equal(
    contract.coverageGates.minimumActualActionLinkRate,
    config.minimumActualActionLinkRate,
  );
  assert.equal(
    contract.coverageGates.minimumAnyOutcomeLinkRate,
    config.minimumAnyOutcomeLinkRate,
  );
  assert.equal(
    contract.coverageGates.minimumScoreableSelectedCandidateOutcomeRate,
    config.minimumScoreableSelectedCandidateOutcomeRate,
  );
  assert.equal(
    contract.coverageGates.unresolvedCoverageReasonBlocksEligibility,
    true,
  );
  assert.equal(
    contract.statisticalDesign.calibrationBins,
    config.calibrationBinCount,
  );
  assert.deepEqual(contract.statisticalDesign.derivedWindowSupport, [49, 48]);
  assert.equal(
    contract.statisticalDesign.derivedMaterialSegmentSupport,
    Math.ceil(97 * config.materialSegmentFraction),
  );
  assert.deepEqual([...contract.requiredProtectedBehaviorBaselineKeys].sort(), [
    ...requiredProtectedBehaviorBaselineKeys,
  ]);
  assert.deepEqual(
    Object.keys(contract.protectedBehaviorBaselines || {}).sort(),
    [...requiredProtectedBehaviorBaselineKeys],
  );
  assert.equal(
    contract.protectedBehaviorBaselines.routeScoring.path,
    "scripts/build-route-intelligence-quality-engine.mjs",
  );
  for (const path of Object.values(contract.artifacts))
    assert.equal(
      existsSync(resolve(root, path)),
      true,
      `Declared artifact path missing: ${path}`,
    );
  return true;
}

export function verifyShadowDecisionReadiness({
  write = false,
  contract = loadShadowDecisionContract(),
  config = loadShadowDecisionConfig(),
} = {}) {
  validateShadowDecisionContractCoherence(contract, config);
  assert.deepEqual(
    Object.keys(contract.protectedBehaviorBaselines || {}).sort(),
    [...requiredProtectedBehaviorBaselineKeys],
  );
  for (const [name, baseline] of Object.entries(
    contract.protectedBehaviorBaselines,
  )) {
    const actual = createHash("sha256")
      .update(readFileSync(resolve(root, baseline.path)))
      .digest("hex");
    assert.equal(
      actual,
      baseline.sha256,
      `Protected zero-influence baseline changed: ${name}`,
    );
  }
  const archiveRecord = buildCommittedArchiveRecord(paths);
  const ledger = buildShadowLedger({ archiveRecord, contract });
  const report = buildFounderReadinessReport(ledger);
  const markdown = renderFounderReadinessMarkdown(report);
  assert.equal(ledger.records.length, 0);
  assert.equal(ledger.exclusions.length, 4);
  assert.equal(report.state, "INSUFFICIENT_EVIDENCE");
  assert.equal(report.recommendationInfluence, "OFF");
  assert.equal(report.metrics.calibrationBrierScore, null);
  assert.equal(report.metrics.actualActionLinkRate, null);
  assert.equal(report.metrics.anyOutcomeLinkRate, null);
  assert.equal(report.metrics.scoreableSelectedCandidateOutcomeRate, null);
  assert.equal(report.shadowLedgerSha256, ledger.shadowLedgerSha256);
  assert.equal(report.outcomeChainSha256, ledger.outcomeChainSha256);
  assert.equal(report.evaluatedLedgerSha256, ledger.evaluationLedgerSha256);
  for (const [kind, content] of [
    ["ledger", serialize(ledger)],
    ["report", serialize(report)],
    ["humanReport", markdown],
  ]) {
    const path = resolve(root, contract.artifacts[kind]);
    if (write) {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, content);
    } else
      assert.equal(
        readFileSync(path, "utf8"),
        content,
        `${kind} artifact is stale`,
      );
  }
  return {
    status: "passed",
    batchId: contract.batchId,
    readinessState: report.state,
    opportunities: 4,
    shadows: 0,
    exclusions: 4,
    recommendationInfluence: "OFF",
  };
}

if (process.argv[1] === new URL(import.meta.url).pathname)
  console.log(
    JSON.stringify(
      verifyShadowDecisionReadiness({
        write: process.argv.includes("--write"),
      }),
      null,
      2,
    ),
  );
