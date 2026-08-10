import assert from "node:assert/strict";
import test from "node:test";

import {
  verifyOverwatchRouteIqCloudflareToolchainRequalification
} from "../scripts/verify-overwatch-route-iq-cloudflare-toolchain-requalification.mjs";

test("Overwatch binds the exact zero-high toolchain owner chain and release continuity", () => {
  const result = verifyOverwatchRouteIqCloudflareToolchainRequalification();
  assert.equal(result.batchId, "BATCH-20260810-001");
  assert.equal(result.compatibility, "121/121 PASS");
  assert.equal(result.allDependencyHigh, 0);
  assert.equal(result.productionHigh, 0);
  assert.equal(result.releaseIdentitiesUnchanged, true);
  assert.equal(result.cloudflareContactCount, 0);
  assert.equal(result.deploymentCount, 0);
  assert.equal(result.productionMutationCount, 0);
});
