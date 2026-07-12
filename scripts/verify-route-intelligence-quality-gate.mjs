import {
  runRouteIntelligenceQualityGate,
  updateGoldenBaseline,
  writeQualityReport
} from "./lib/route-intelligence-quality-gate.mjs";

const updateBaseline = process.argv.includes("--update-baseline");
const writeReport = process.argv.includes("--write-report");
const skipZeroGoogle = process.argv.includes("--skip-zero-google");
const showHelp = process.argv.includes("--help");
const expectedLocalCommitArgument = process.argv.find(argument => argument.startsWith("--expected-local-commits="));
const expectedLocalCommitCount = expectedLocalCommitArgument
  ? Number(expectedLocalCommitArgument.split("=")[1])
  : undefined;

if (expectedLocalCommitArgument && (!Number.isInteger(expectedLocalCommitCount) || expectedLocalCommitCount < 0)) {
  throw new Error("--expected-local-commits must be a non-negative integer.");
}

if (showHelp) {
  console.log(`Usage: node scripts/verify-route-intelligence-quality-gate.mjs [options]

Options:
  --write-report                  Explicitly generate the canonical Data-owned quality report.
  --update-baseline               Explicitly update the reviewed golden route-order baseline.
  --skip-zero-google              Skip runtime-surface and zero-live-Google evidence.
  --expected-local-commits=<n>    Require exactly n commits ahead of origin/main.
  --help                          Show this help.

Without a write option, verification is read-only and does not modify canonical artifacts.`);
  process.exit(0);
}

if (updateBaseline) {
  updateGoldenBaseline();
}

const result = runRouteIntelligenceQualityGate({
  runZeroGoogleCheck: !skipZeroGoogle,
  expectedLocalCommitCount
});

if (writeReport && result.passed) {
  writeQualityReport(result.report);
}

if (!result.passed) {
  console.error("Route Intelligence Golden Route Quality Gate failed:");
  for (const reason of result.report.failureReasons) {
    console.error(`- ${reason}`);
  }
  if (writeReport) console.error("Canonical quality report was not written because validation failed.");
  console.error(`Evaluated quality gate: ${result.report.gateVersion}`);
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({
    status: "passed",
    mode: writeReport ? "canonical_report_generation" : "read_only_verification",
    canonicalReportWritten: writeReport,
    gateVersion: result.report.gateVersion,
    activePoolRecords: result.report.dataset.activePoolRecords,
    expandedDashboardRouteRecords: result.report.dataset.expandedDashboardRouteRecords,
    routeStability: result.report.routeStability.status,
    candidateValidation: result.report.candidateValidation.status,
    orderingConsistency: result.report.orderingConsistency.status,
    businessHoursEligibility: result.report.businessHoursEligibility.status,
    christianBrothersRegression: result.report.businessHoursEligibility.christianBrothersRegression.status,
    initialRouteStops: result.report.businessHoursEligibility.queueValidation.initialStopCount,
    replenishedRouteStops: result.report.businessHoursEligibility.queueValidation.replenishedStopCount,
    zeroLiveGoogle: result.report.zeroLiveGoogle.status,
    checkedRuntimeFiles: result.report.runtimeSurface.checkedRuntimeFiles,
    dashboardFetches: result.report.runtimeSurface.dashboardFetches,
    localCommitsAhead: result.report.repositoryState.ahead,
    dashboardCompatibility: result.report.dashboardCompatibility.status
  }, null, 2));
}
