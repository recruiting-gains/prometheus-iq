import assert from "node:assert/strict";
import test from "node:test";

import {
  verifyOverwatchRouteIqCrossIndustryDashboardRegression
} from "../scripts/verify-overwatch-route-iq-cross-industry-dashboard-regression.mjs";

test("Overwatch blocks the retired identity, unsafe availability, and cross-industry regressions", () => {
  const result = verifyOverwatchRouteIqCrossIndustryDashboardRegression();
  assert.equal(result.status, "PASS");
  assert.deepEqual(result.workspaces, [
    "fitness_connection",
    "northstar_outside_sales_synthetic"
  ]);
  assert.deepEqual(result.dataState, {
    active: 0,
    reserve: 0,
    quarantine: 398
  });
  assert.equal(result.collection, "OFF");
  assert.equal(result.activeCohorts, 0);
  assert.equal(result.recommendationInfluence, "OFF");
  assert.equal(result.deploymentPerformed, false);
});
