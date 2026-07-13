import assert from "node:assert/strict";
import test from "node:test";

import { verifyReleaseProvenanceRepair } from "../scripts/verify-release-provenance-repair.mjs";

test("Overwatch verifies Route IQ release provenance repair", () => {
  assert.deepEqual(verifyReleaseProvenanceRepair(), {
    status: "PASS",
    batchId: "BATCH-20260713-002",
    legacyCommit: "049cf583b04900b2cbf38bbffc5f6293252365d0",
    intelligenceContractsReconstructed: 4,
    protectedConsumersVerified: 5,
    dashboardBehaviorApproval: "FOUNDER_BEHAVIOR_APPROVAL_REQUIRED",
    recommendationInfluence: "OFF",
    productionConsumerIntroduced: false
  });
});
