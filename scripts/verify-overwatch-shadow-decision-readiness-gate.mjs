import assert from "node:assert/strict";
import fs from "node:fs";

import { verifyCrossSubsystemArtifactContracts } from "./verify-cross-subsystem-artifact-contracts.mjs";
import { verifyShadowDecisionReadiness } from "./verify-shadow-decision-readiness.mjs";

const batchId = "BATCH-20260713-001";
const contractPath = "intelligence/contracts/shadow-decision-readiness-contracts.json";
const ledgerPath = "intelligence/artifacts/shadow-decision-readiness-v1/fitness_connection/cruz/shadow-ledger-v1.json";
const reportPath = "intelligence/artifacts/shadow-decision-readiness-v1/fitness_connection/cruz/founder-readiness-report-v1.json";

const readJson = path => JSON.parse(fs.readFileSync(path, "utf8"));

export function verifyOverwatchShadowDecisionReadinessGate() {
  const contracts = verifyCrossSubsystemArtifactContracts();
  assert.equal(contracts.ok, true, contracts.failures.join("\n"));

  const subsystemResult = verifyShadowDecisionReadiness({ write: false });
  const contract = readJson(contractPath);
  const ledger = readJson(ledgerPath);
  const report = readJson(reportPath);
  const expectedGateStates = {
    zero_influence: "PASS",
    temporal_integrity: "PASS",
    deterministic_replay: "PASS",
    completeness: "PASS",
    outcome_integrity: "PASS",
    evaluation_validity: "NOT_MET",
    statistical_sufficiency: "NOT_MET",
    segment_safety: "NOT_MET",
    calibration_stability: "NOT_MET",
    isolation_compatibility: "PASS"
  };
  const expectedReasons = [
    "no_eligible_shadow_decisions_with_historically_frozen_prospective_context",
    "evaluation_sample_below_required_97",
    "baseline_training_sample_below_required_97",
    "actual_action_link_coverage_incomplete",
    "outcome_link_coverage_incomplete",
    "selected_candidate_outcome_coverage_incomplete",
    "chronologically_prior_observational_baseline_unavailable",
    "consecutive_calibration_stability_windows_not_passing",
    "segment_safety_not_demonstrated",
    "observational_baseline_performance_not_met"
  ];

  assert.equal(contract.batchId, batchId);
  assert.equal(subsystemResult.batchId, batchId);
  assert.equal(report.batchId, batchId);
  assert.equal(report.state, "INSUFFICIENT_EVIDENCE");
  assert.deepEqual(report.gates, expectedGateStates);
  assert.deepEqual(report.reasonCodes, expectedReasons);
  assert.equal(report.recommendationInfluence, "OFF");
  assert.equal(report.eligibilityDoesNotAuthorizeActivation, true);
  assert.equal(ledger.recommendationInfluence, "OFF");
  assert.equal(ledger.records.length, 0);
  assert.equal(ledger.exclusions.length, 4);
  assert.equal(ledger.opportunityManifest.length, 4);
  assert.equal(report.sampleLimitations.canonicalVisits, 4);
  assert.equal(report.sampleLimitations.eligibleShadowDecisions, 0);
  assert.equal(report.observationalBaseline.requiredSupport, 97);
  assert.equal(report.observationalBaseline.actualSupport, 0);
  assert.equal(report.metrics.actualActionLinkRate, null);
  assert.equal(report.metrics.anyOutcomeLinkRate, null);
  assert.equal(report.metrics.scoreableSelectedCandidateOutcomeRate, null);
  assert.equal(report.metrics.calibrationBrierScore, null);
  assert.equal(report.metrics.calibrationEce, null);
  assert.equal(report.metrics.calibrationSupport, "NOT_MET");
  assert.deepEqual(Object.keys(report.segments).sort(), [
    "customerContext",
    "decisionType",
    "representativeId",
    "territoryId",
    "timeWindow"
  ]);
  assert.equal(report.shadowLedgerSha256, ledger.shadowLedgerSha256);
  assert.equal(report.outcomeChainSha256, ledger.outcomeChainSha256);
  assert.equal(report.evaluatedLedgerSha256, ledger.evaluationLedgerSha256);
  assert.equal(contract.isolation.founderOnly, true);
  assert.equal(contract.isolation.readOnly, true);
  assert.equal(contract.isolation.importPathIntoRouteIqOperations, false);
  assert.equal(contract.isolation.writePathIntoRouteIqOperations, false);
  assert.equal(contract.isolation.controlPathIntoRouteIqOperations, false);
  assert.equal(contract.validationFixturePolicy.canonicalReadinessContributionAllowed, false);

  return {
    status: "PASS",
    batchId,
    currentReadinessState: report.state,
    opportunities: ledger.opportunityManifest.length,
    shadows: ledger.records.length,
    exclusions: ledger.exclusions.length,
    requiredSample: report.observationalBaseline.requiredSupport,
    recommendationInfluence: "OFF",
    contractArtifacts: contracts.registry.workspaces
      .find(workspace => workspace.workspaceId === "fitness_connection")
      .canonicalArtifacts.length
  };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  console.log(JSON.stringify(verifyOverwatchShadowDecisionReadinessGate(), null, 2));
}
