import { runOfflineEvidenceHarness } from "../intelligence/field-learning-offline-evidence-harness.mjs";

const report = runOfflineEvidenceHarness();

const summary = {
  status: report.status,
  harnessVersion: report.harnessVersion,
  fixtureVersion: report.fixtureVersion,
  contractVersion: report.contractVersion,
  fixtureCount: report.summary.fixtureCount,
  evidenceCount: report.summary.evidenceCount,
  signalCount: report.summary.signalCount,
  confidenceSnapshots: report.summary.confidenceSnapshots,
  explanations: report.summary.explanations,
  humanOverrideScenarios: report.summary.humanOverrideScenarios,
  blockedOverrideScenarios: report.summary.blockedOverrideScenarios,
  productionSafety: report.productionSafety,
  failureReasons: report.failureReasons
};

console.log(JSON.stringify(summary, null, 2));

if (report.status !== "passed") {
  process.exitCode = 1;
}
