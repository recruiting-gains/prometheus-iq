import {
  runRouteIntelligenceQualityGate,
  updateGoldenBaseline,
  writeQualityReport
} from "./lib/route-intelligence-quality-gate.mjs";

const updateBaseline = process.argv.includes("--update-baseline");
const skipZeroGoogle = process.argv.includes("--skip-zero-google");
const expectedLocalCommitArgument = process.argv.find(argument => argument.startsWith("--expected-local-commits="));
const expectedLocalCommitCount = expectedLocalCommitArgument
  ? Number(expectedLocalCommitArgument.split("=")[1])
  : undefined;

if (expectedLocalCommitArgument && (!Number.isInteger(expectedLocalCommitCount) || expectedLocalCommitCount < 0)) {
  throw new Error("--expected-local-commits must be a non-negative integer.");
}

if (updateBaseline) {
  updateGoldenBaseline();
}

const result = runRouteIntelligenceQualityGate({
  runZeroGoogleCheck: !skipZeroGoogle,
  expectedLocalCommitCount
});

writeQualityReport(result.report);

if (!result.passed) {
  console.error("Route Intelligence Golden Route Quality Gate failed:");
  for (const reason of result.report.failureReasons) {
    console.error(`- ${reason}`);
  }
  console.error(`Quality report: ${result.report.gateVersion}`);
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({
    status: "passed",
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
