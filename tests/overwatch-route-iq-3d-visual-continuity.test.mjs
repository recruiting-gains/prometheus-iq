import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  ROUTE_IQ_3D_GOVERNANCE_PATH,
  validateRouteIq3dVisualContinuityGovernance,
  verifyOverwatchRouteIq3dVisualContinuity
} from "../scripts/verify-overwatch-route-iq-3d-visual-continuity.mjs";

const governance = () => JSON.parse(readFileSync(ROUTE_IQ_3D_GOVERNANCE_PATH, "utf8"));

test("Overwatch verifies the owned 3D successor, generated assets, CRM boundary, and rollback", () => {
  const result = verifyOverwatchRouteIq3dVisualContinuity({ build: false, requireClean: false });
  assert.equal(result.status, "ROUTE_IQ_3D_VISUAL_CONTINUITY_VERIFIED");
  assert.equal(result.batchId, "BATCH-20260719-006");
  assert.equal(result.ownerCommits.length, 7);
  assert.equal(result.deploymentAssetsSha256, "5fd9e497e7fe814aab6194b4302528c6cff0e243e76a3dd843738f1882cd8c15");
  assert.equal(result.rollbackArtifactSha256, "381b471ed3fa0a1fdab0b612600be2f2b6e77b45d3b9c02418a056e0eb500b5a");
  assert.equal(result.initialCriticalBytes, 456547);
  assert.equal(result.lazy3dBytes, 892213);
  assert.equal(result.recommendationInfluence, "OFF");
  assert.equal(result.prospectiveCollection, "OFF");
  assert.equal(result.activeCohorts, 0);
  assert.equal(result.deploymentPerformed, false);
});

test("the superseded static candidate can never be marked deployable", () => {
  const value = governance();
  value.supersession.supersededCandidate.deploymentAllowed = true;
  assert.throws(() => validateRouteIq3dVisualContinuityGovernance(value));
});

test("fallback replacement, recommendation influence, and deployment authorization fail closed", () => {
  const fallback = governance();
  fallback.visualRuntime.fallbackImageMayReplaceSupported3d = true;
  assert.throws(() => validateRouteIq3dVisualContinuityGovernance(fallback));

  const influence = governance();
  influence.safetyState.recommendationInfluence = "ON";
  assert.throws(() => validateRouteIq3dVisualContinuityGovernance(influence));

  const deployment = governance();
  deployment.releaseBoundary.deploymentAuthorized = true;
  assert.throws(() => validateRouteIq3dVisualContinuityGovernance(deployment));
});

test("deployment and rollback identities cannot drift independently", () => {
  for (const mutate of [
    value => { value.generatedAssets.deploymentAssetsSha256 = "0".repeat(64); },
    value => { value.rollback.contractSha256 = "0".repeat(64); },
    value => { value.rollback.artifactSha256 = "0".repeat(64); }
  ]) {
    const value = governance();
    mutate(value);
    assert.throws(() => validateRouteIq3dVisualContinuityGovernance(value));
  }
});
