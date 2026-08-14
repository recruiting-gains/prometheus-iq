import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  verifyOverwatchProspectiveCalibrationProductionAdmissionFutureWindowReadiness
} from "../scripts/verify-overwatch-route-iq-prospective-calibration-production-admission-future-window-readiness-v1.mjs";

const readJson = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));

test("Overwatch verifies the complete source-only calibration admission successor", async () => {
  assert.deepEqual(
    await verifyOverwatchProspectiveCalibrationProductionAdmissionFutureWindowReadiness(),
    {
      status: "PASS",
      batchId: "BATCH-20260814-001",
      ownerCommitCount: 17,
      criticalPinCount: 12,
      focusedTests: 171,
      readiness: "INSUFFICIENT_EVIDENCE",
      collection: "OFF",
      activeCohorts: 0,
      recommendationInfluence: "OFF",
      cloudflareContacts: 0,
      productionMutations: 0,
      deployments: 0,
      privateArtifact: "REQUIRES_SEPARATE_PRIVATE_V2_QUALIFICATION"
    }
  );
});

test("the future private lane rejects the predecessor artifact instead of fabricating identities", () => {
  const governance = readJson(
    "overwatch/governance/route-iq-prospective-calibration-production-admission-future-window-readiness-v1.json"
  );
  const handoff = governance.privateWorkflowV2Handoff;
  assert.equal(handoff.existingQualificationArtifactIncludesNewModules, false);
  assert.equal(handoff.existingQualificationArtifactStatus,
    "STALE_PREDECESSOR_NOT_DEPLOYABLE_FOR_THIS_SOURCE");
  assert.equal(handoff.finalManifestSha256,
    "REQUIRES_SEPARATE_PRIVATE_V2_QUALIFICATION");
  assert.equal(handoff.qualificationOrDeploymentDispatchedByThisBatch, false);
});

test("the forward revert is source-only, non-destructive, and separately qualified", () => {
  const revert = readJson(
    "workers/infrastructure/route-iq-prospective-calibration-production-admission-forward-revert-v1.json"
  );
  assert.equal(revert.status, "SOURCE_ONLY_NOT_EXECUTED");
  assert.equal(revert.normalForwardRevert.historyRewriteAllowed, false);
  assert.equal(revert.normalForwardRevert.forcePushAllowed, false);
  assert.equal(revert.normalForwardRevert.resetAllowed, false);
  assert.equal(revert.scope.productionRollbackRequired, false);
  assert.equal(revert.releaseBoundary.newQualificationRequiredAfterAnyForwardRevert, true);
});
