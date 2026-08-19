import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  ROUTE_IQ_3D_GOVERNANCE_PATH,
  validateLiveCanonicalIdentityPublicRelease,
  validateRouteIq3dVisualContinuityGovernance,
  verifyOverwatchRouteIq3dVisualContinuity
} from "../scripts/verify-overwatch-route-iq-3d-visual-continuity.mjs";

const governance = () => JSON.parse(readFileSync(ROUTE_IQ_3D_GOVERNANCE_PATH, "utf8"));

test("Overwatch verifies the owned 3D successor, generated assets, CRM boundary, and rollback", () => {
  const result = verifyOverwatchRouteIq3dVisualContinuity({ build: false, requireClean: false });
  assert.equal(result.status, "ROUTE_IQ_3D_VISUAL_CONTINUITY_VERIFIED");
  assert.equal(result.batchId, "BATCH-20260719-006");
  assert.equal(result.ownerCommits.length, 7);
  assert.equal(result.deploymentAssetsSha256, "94def2bbd52b6ffa85a40dbc4c51166fcdffdcc364ffdc99a678ddd91d2ed779");
  assert.equal(result.historicalDeploymentAssetsSha256, "5fd9e497e7fe814aab6194b4302528c6cff0e243e76a3dd843738f1882cd8c15");
  assert.equal(result.rollbackArtifactSha256, "a2cb4150124ff7569aa09cd50d60a12160ba52f2ef97b29967d92f494cb17f71");
  assert.equal(result.historicalRollbackArtifactSha256, "381b471ed3fa0a1fdab0b612600be2f2b6e77b45d3b9c02418a056e0eb500b5a");
  assert.equal(result.initialCriticalBytes, 612003);
  assert.equal(result.lazy3dBytes, 892213);
  assert.equal(result.recommendationInfluence, "OFF");
  assert.equal(result.prospectiveCollection, "OFF");
  assert.equal(result.activeCohorts, 0);
  assert.equal(result.deploymentPerformed, false);
});

test("historical 3D release evidence remains historical beside the current candidate", () => {
  const historical = governance();
  const historicalCurrent = JSON.parse(readFileSync(
    "overwatch/governance/public-deployment-workflow-v2.json",
    "utf8"
  )).routeIqWebsitePositioningSuccessor;
  const identity = JSON.parse(readFileSync(
    "overwatch/governance/live-canonical-identity-migration-v1.json",
    "utf8"
  ));
  const current = validateLiveCanonicalIdentityPublicRelease({
    governance: identity,
    historicalRelease: historicalCurrent
  });
  assert.equal(
    historical.generatedAssets.deploymentAssetsSha256,
    "5fd9e497e7fe814aab6194b4302528c6cff0e243e76a3dd843738f1882cd8c15"
  );
  assert.equal(
    current.currentReleaseIdentities.deploymentAssetSha256,
    "93526aca609a237fe26ba69f11d786549623b186fe7f106f3bf998e476dd22cf"
  );
  assert.equal(current.classification, "CONTROLLING_PUBLIC_IDENTITY_SUCCESSOR");
  assert.equal(current.historicalReleaseClassification, "CONTROLLING_PUBLIC_RELEASE_SUCCESSOR");
  assert.notEqual(
    historical.generatedAssets.deploymentAssetsSha256,
    current.currentReleaseIdentities.deploymentAssetSha256
  );
});

test("canonical identity release rejects workflow and rollback drift", () => {
  const historicalRelease = JSON.parse(readFileSync(
    "overwatch/governance/public-deployment-workflow-v2.json",
    "utf8"
  )).routeIqWebsitePositioningSuccessor;
  const identity = JSON.parse(readFileSync(
    "overwatch/governance/live-canonical-identity-migration-v1.json",
    "utf8"
  ));

  for (const mutate of [
    value => { value.releasePreparation.publicWorkflowsChanged = true; },
    value => { value.releasePreparation.publicRollback.contractSha256 = "0".repeat(64); },
    value => { value.releasePreparation.publicRollback.artifactSha256 = "0".repeat(64); }
  ]) {
    const value = structuredClone(identity);
    mutate(value);
    assert.throws(() => validateLiveCanonicalIdentityPublicRelease({
      governance: value,
      historicalRelease
    }));
  }
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

test("Overwatch records the package release-wiring successor without reopening unattended deployment", () => {
  const value = governance();
  assert.deepEqual(value.protectedPredecessorSuccessors, [
    {
      predecessorGovernanceId: "cloudflare-unattended-deployment-access-governance-v1",
      path: "package.json",
      historicalSha256: "a150ca1b1121c779415365551efdbff970e458915ba6491716ccbfdd0a111d0d",
      previousSuccessorSha256: "4495e53724179fc0520beae1dc4b865fda003e1f2ec7472bc9d5aa4f88b50a2e",
      successorSha256: "f34246136a294d5a7180d76a452ff8c9c69bb7d1d35419c1115426b8ea4e0247",
      owner: "Prometheus Overwatch",
      reason: "Register BATCH-20260719-006 verification and release-gate wiring while unattended deployment remains paused."
    }
  ]);
  assert.deepEqual(value.protectedReleaseWiringTransitions, [
    {
      path: "package.json",
      previousSha256: "4495e53724179fc0520beae1dc4b865fda003e1f2ec7472bc9d5aa4f88b50a2e",
      successorSha256: "f34246136a294d5a7180d76a452ff8c9c69bb7d1d35419c1115426b8ea4e0247",
      owner: "Prometheus Overwatch",
      reason: "Register BATCH-20260719-006 verification and release-gate wiring while unattended deployment remains paused."
    }
  ]);
  assert.equal(value.protectedOverwatchVerifierSuccessors.length, 6);
  assert.ok(value.protectedOverwatchVerifierSuccessors.every(successor => (
    successor.predecessorGovernanceId === "route-iq-commercial-readiness-governance-v1"
    && successor.owner === "Prometheus Overwatch"
    && /^[a-f0-9]{64}$/u.test(successor.historicalSha256)
    && /^[a-f0-9]{64}$/u.test(successor.successorSha256)
  )));
  assert.equal(value.releaseBoundary.deploymentAuthorized, false);
  assert.equal(value.releaseBoundary.workflowDispatchAuthorized, false);
});

test("an ungoverned historical verifier successor fails closed", () => {
  const value = governance();
  value.protectedOverwatchVerifierSuccessors[0].successorSha256 = "0".repeat(64);
  assert.throws(() => validateRouteIq3dVisualContinuityGovernance(value));
});

test("Data and Intelligence runtime-evidence successors require exact owner provenance", () => {
  const value = governance();
  assert.equal(value.dispatchAudit.runtimeEvidenceSuccessors.length, 3);
  value.dispatchAudit.runtimeEvidenceSuccessors[1].owner = "Prometheus Overwatch";
  assert.throws(() => validateRouteIq3dVisualContinuityGovernance(value));
});

test("historical investor-focus consumers resolve through exact Intelligence successors", () => {
  const value = governance();
  assert.equal(value.protectedInvestorFocusBaselineSuccessors.length, 3);
  value.protectedInvestorFocusBaselineSuccessors[0].successorSha256 = "0".repeat(64);
  assert.throws(() => validateRouteIq3dVisualContinuityGovernance(value));
});
