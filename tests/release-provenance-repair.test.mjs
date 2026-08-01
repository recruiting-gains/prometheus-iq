import assert from "node:assert/strict";
import test from "node:test";

import {
  currentFullSystemHarmonyIntelligenceSuccessor,
  currentFullSystemHarmonyShadowReadinessSuccessor,
  currentProtectedDriftFixtureIntelligenceSuccessor,
  currentRevenueReadinessIntelligenceSuccessor,
  validateFullSystemHarmonyIntelligenceSuccessor,
  validateFullSystemHarmonyShadowReadinessSuccessor,
  validateProtectedDriftFixtureIntelligenceSuccessor,
  validateRevenueReadinessIntelligenceSuccessor,
  verifyReleaseProvenanceRepair
} from "../scripts/verify-release-provenance-repair.mjs";

const clone = value => structuredClone(value);

test("release provenance rejects revenue-readiness successor substitution", () => {
  assert.equal(validateRevenueReadinessIntelligenceSuccessor(
    currentRevenueReadinessIntelligenceSuccessor
  ).commit, "c025fd95a8f5141dc4c32af3ca83292711fb1df7");
  for (const mutate of [
    value => { value.commit = "0".repeat(40); },
    value => { value.parent = "0".repeat(40); },
    value => { value.tree = "0".repeat(40); },
    value => { value.identity = "Prometheus Overwatch <overwatch@prometheus.local>"; },
    value => { value.subject = "intelligence: substituted provenance"; },
    value => { value.evidence[0].path = "package.json"; },
    value => { value.evidence[1].sha256 = "0".repeat(64); },
    value => { value.evidence.pop(); }
  ]) {
    const candidate = clone(currentRevenueReadinessIntelligenceSuccessor);
    mutate(candidate);
    assert.throws(() => validateRevenueReadinessIntelligenceSuccessor(candidate));
  }
});

test("release provenance composes only exact current Intelligence successors", () => {
  for (const [record, validate] of [
    [currentFullSystemHarmonyIntelligenceSuccessor,
      validateFullSystemHarmonyIntelligenceSuccessor],
    [currentFullSystemHarmonyShadowReadinessSuccessor,
      validateFullSystemHarmonyShadowReadinessSuccessor],
    [currentProtectedDriftFixtureIntelligenceSuccessor,
      validateProtectedDriftFixtureIntelligenceSuccessor]
  ]) {
    assert.equal(validate().commit, record.commit);
    for (const mutate of [
      value => { value.commit = "0".repeat(40); },
      value => { value.parent = "0".repeat(40); },
      value => { value.tree = "0".repeat(40); },
      value => { value.identity = "Prometheus Overwatch <overwatch@prometheus.local>"; },
      value => { value.subject = "intelligence: substitute successor"; },
      value => { value.evidence[0].path = "package.json"; },
      value => { value.evidence[0].sha256 = "0".repeat(64); },
      value => { value.evidence.pop(); }
    ]) {
      const candidate = clone(record);
      mutate(candidate);
      assert.throws(() => validate(candidate));
    }
  }
});

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
      "039116040678a3cbae8016a34f17e30e674715f6",
    currentControlledRehearsalIntelligenceSuccessorCommit:
      "41679ab6742dc9fd8639bbc7cfe6a1dc2328d540",
    currentRevenueReadinessIntelligenceSuccessorCommit:
      "c025fd95a8f5141dc4c32af3ca83292711fb1df7",
    currentFullSystemHarmonyIntelligenceSuccessorCommit:
      "2f8992476ca37276b0ee388fe2e33a2158f9d906",
    currentFullSystemHarmonyShadowReadinessSuccessorCommit:
      "029ef1254aa41b6ba129424e9b3deaf3afe6a2f8",
    currentProtectedDriftFixtureIntelligenceSuccessorCommit:
      "ff63d927c121a0030a0cbb1f041a626ffe7968bc"
  });
});
