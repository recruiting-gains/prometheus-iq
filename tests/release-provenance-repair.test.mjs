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
    productionConsumerIntroduced: false,
    currentIntelligenceOwnerSuccessor: "21471fb1c5f32c18e4356434af71e0d63925d969",
    protectedBaselineSuccessor: "536d166e4a39a9caf4071e96f92a1598c00e7119",
    routeQualitySuccessor: "73b477a0fdec725beb7fe6de795ec35fd457ef32",
    commercialRouteQualitySuccessor: "ecc9cbcc0222c627aeef952d2a651f4ba90cc42a",
    currentDashboardSourceCommit: "99457bcda1abed536cc06585492d29f5ac500f05",
    currentDashboardValidationCommit: "f612e394b3af75e63cc07232d64bbd3dd1adb817",
    currentAugust1IntelligenceSuccessorCommit:
      "3587c3d70526b95ae9083520ed42025c5522f764",
    currentPaidCustomerIntelligenceSuccessorCommit:
      "bf5c665035923f5f56fd923d0cb3df8610c2c33a",
    currentPrivateSmokeTimeoutIntelligenceSuccessorCommit:
      "039116040678a3cbae8016a34f17e30e674715f6"
  });
});
