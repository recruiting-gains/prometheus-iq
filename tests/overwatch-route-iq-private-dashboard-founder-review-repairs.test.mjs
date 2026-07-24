import assert from "node:assert/strict";
import test from "node:test";

import {
  verifyOverwatchRouteIqPrivateDashboardFounderReviewRepairs
} from "../scripts/verify-overwatch-route-iq-private-dashboard-founder-review-repairs.mjs";

test("Overwatch accepts one ZIP-governed multi-company candidate and one complete synthetic rehearsal", () => {
  const result = verifyOverwatchRouteIqPrivateDashboardFounderReviewRepairs();
  assert.equal(result.status, "PASS");
  assert.equal(result.founderWorkspaceCount, 2);
  assert.equal(result.rehearsalWorkspaceId, "summit_outside_sales_rehearsal_synthetic");
  assert.equal(result.automatedConfigurationSeconds, 600);
  assert.equal(result.seventyTwoHourStandardProven, false);
  assert.deepEqual(result.dataCounts, {
    active: 0,
    reserve: 0,
    quarantine: 398
  });
  assert.equal(result.collection, "OFF");
  assert.equal(result.activeCohorts, 0);
  assert.equal(result.recommendationInfluence, "OFF");
  assert.equal(result.deploymentPerformed, false);
});
