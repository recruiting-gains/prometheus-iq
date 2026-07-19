import assert from "node:assert/strict";
import test from "node:test";

import { verifyOverwatchRouteIqYcInvestorWebsiteFocus } from "../scripts/verify-overwatch-route-iq-yc-investor-website-focus.mjs";

test("Overwatch verifies Route IQ investor focus, buyer conversion, ownership, and safety boundaries", () => {
  const result = verifyOverwatchRouteIqYcInvestorWebsiteFocus({
    requireClean: false,
    requireOverwatchCommit: false
  });
  assert.equal(result.status, "PASS");
  assert.equal(result.batchId, "BATCH-20260719-002");
  assert.equal(result.acceptanceGates, 15);
  assert.equal(result.ownerCommits.length, 7);
  assert.equal(result.scorecardCategories, 11);
  assert.equal(result.investorObjections, 10);
  assert.equal(result.unresolvedDisclosures, 2);
  assert.ok(result.performance.criticalBytes <= 540000);
  assert.equal(result.recommendationInfluence, "OFF");
  assert.equal(result.prospectiveCollection, "OFF");
  assert.equal(result.activeCohorts, 0);
  assert.equal(result.deploymentPerformed, false);
});
