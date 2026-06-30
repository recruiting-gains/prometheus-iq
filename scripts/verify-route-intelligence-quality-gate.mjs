import {
  runRouteIntelligenceQualityGate,
  updateGoldenBaseline,
  writeQualityReport
} from "./lib/route-intelligence-quality-gate.mjs";

const updateBaseline = process.argv.includes("--update-baseline");
const skipZeroGoogle = process.argv.includes("--skip-zero-google");

if (updateBaseline) {
  updateGoldenBaseline();
}

const result = runRouteIntelligenceQualityGate({
  runZeroGoogleCheck: !skipZeroGoogle
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
    zeroLiveGoogle: result.report.zeroLiveGoogle.status,
    dashboardCompatibility: result.report.dashboardCompatibility.status
  }, null, 2));
}
