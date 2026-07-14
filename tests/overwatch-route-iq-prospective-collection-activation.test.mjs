import assert from "node:assert/strict";
import test from "node:test";

import { verifyOverwatchRouteIqProspectiveCollectionActivation } from "../scripts/verify-overwatch-route-iq-prospective-collection-activation.mjs";

test("Overwatch verifies prospective collection activation readiness without production access", () => {
  assert.deepEqual(verifyOverwatchRouteIqProspectiveCollectionActivation(), {
    status: "PASS",
    batchId: "BATCH-20260714-003",
    ownerCommits: 8,
    retentionPolicy: "FAIL_CLOSED_PENDING_EXPLICIT_BOUNDARY",
    activationReadiness: "HOLD_NOT_ACTIVATION_READY",
    activeCohorts: 0,
    dispositionConsumers: 7,
    dispositionExcludedDomains: 12,
    productionAccessUsed: false,
    deploymentAuthorized: false,
    collection: "OFF",
    recommendationInfluence: "OFF"
  });
});
