import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  GYM_PREVIEW_GOVERNANCE_PATH,
  GYM_PREVIEW_ENVIRONMENT_SUCCESSOR_PATH,
  GYM_PREVIEW_ROUTE_QUALITY_SUCCESSOR_PATH,
  GYM_PREVIEW_VISUAL_SUCCESSOR_PATH,
  validateGymPreviewEnvironmentSuccessor,
  validateGymPreviewGovernance,
  validateGymPreviewRouteQualitySuccessor,
  validateGymPreviewVisualSuccessor,
  verifyOverwatchGymFirstDualTrackPublicWebsitePreview
} from "../scripts/verify-overwatch-route-iq-gym-first-dual-track-public-website-preview-v1.mjs";

const governance = () => JSON.parse(readFileSync(GYM_PREVIEW_GOVERNANCE_PATH, "utf8"));
const environmentSuccessor = () => JSON.parse(
  readFileSync(GYM_PREVIEW_ENVIRONMENT_SUCCESSOR_PATH, "utf8")
);
const routeQualitySuccessor = () => JSON.parse(
  readFileSync(GYM_PREVIEW_ROUTE_QUALITY_SUCCESSOR_PATH, "utf8")
);
const visualSuccessor = () => JSON.parse(
  readFileSync(GYM_PREVIEW_VISUAL_SUCCESSOR_PATH, "utf8")
);

test("Overwatch verifies the exact gym-first dual-track source and isolated preview boundary", () => {
  assert.deepEqual(
    verifyOverwatchGymFirstDualTrackPublicWebsitePreview({ requireClean: false }),
    {
      status: "PASS",
      batchId: "BATCH-20260819-001",
      ownerCommitCount: 2,
      previewAssetSha256: "174501cfb59101bb85d401fdd091cd96f1b64caa30c5c8e347c1b47df5ad2384",
      deploymentAssetSha256: "94def2bbd52b6ffa85a40dbc4c51166fcdffdcc364ffdc99a678ddd91d2ed779",
      rollbackBundleSha256: "a2cb4150124ff7569aa09cd50d60a12160ba52f2ef97b29967d92f494cb17f71",
      emailDisposition: "PROTECTED_CRM_NOTIFICATION_ONLY",
      truthState: "INSUFFICIENT_EVIDENCE",
      runtimeFileCount: 34,
      productionDeploymentAuthorized: false
    }
  );
});

test("navigation and Dashboard visual changes remain an isolated source successor", () => {
  const value = visualSuccessor();
  assert.equal(validateGymPreviewVisualSuccessor(value), value);
  for (const mutate of [
    record => { record.navigationContract.dashboardFallbackProhibited = false; },
    record => { record.dashboardVisualContract.accent = "#5b5fc7"; },
    record => { record.dashboardVisualContract.dashboardBehaviorChanged = true; },
    record => { record.releaseBoundary.productionDeploymentAuthorized = false; },
    record => { record.protectedState.collection = "ON"; }
  ]) {
    const candidate = visualSuccessor();
    mutate(candidate);
    assert.throws(() => validateGymPreviewVisualSuccessor(candidate));
  }
});

test("Overwatch rejects a widened gym runtime-surface successor", () => {
  const successor = routeQualitySuccessor();
  assert.equal(successor.implementationCommits.at(-1).commit,
    "93e426735a2d9005cc6398b15eb64b14114c47ea");
  assert.ok(successor.changedFiles.includes(
    "tests/route-iq-intelligence-controlled-rehearsal-smoke-contract-successor.test.mjs"
  ));
  for (const mutate of [
    value => { value.runtimeSurface.currentFileCount = 33; },
    value => { value.runtimeSurface.liveGoogleApiCalls = 1; },
    value => { value.releasePreservation.routeScoringChanged = true; },
    value => { value.releasePreservation.websiteSourceChanged = true; },
    value => { value.protectedState.productionDeployments = 1; }
  ]) {
    const value = routeQualitySuccessor();
    mutate(value);
    assert.throws(() => validateGymPreviewRouteQualitySuccessor(value));
  }
});

test("preview production bindings, writes, email, and production promotion fail closed", () => {
  for (const mutate of [
    value => { value.previewBoundary.bindings.push("ROUTE_IQ_REQUEST_CRM_COORDINATOR"); },
    value => { value.previewBoundary.persistenceAllowed = true; },
    value => { value.previewBoundary.emailAllowed = true; },
    value => { value.releaseBoundary.productionDeploymentAuthorized = true; },
    value => { value.contracts.claims.productionUseAllowed = true; }
  ]) {
    const value = governance();
    mutate(value);
    assert.throws(() => validateGymPreviewGovernance(value));
  }
});

test("preview deployment credentials remain scoped to the nonproduction environment", () => {
  for (const mutate of [
    value => { value.githubEnvironment.name = "prometheus-public-worker-production"; },
    value => { value.githubEnvironment.requiredSecretNames.push("FOUNDER_EMAIL"); },
    value => { value.githubEnvironment.productionEnvironmentChanged = true; },
    value => { value.previewBoundary.crmBindings.push("ROUTE_IQ_REQUEST_CRM_COORDINATOR"); },
    value => { value.previewBoundary.productionDeploymentAllowed = true; },
    value => { value.failedHostedAttempt.productionMutation = true; }
  ]) {
    const value = environmentSuccessor();
    mutate(value);
    assert.throws(() => validateGymPreviewEnvironmentSuccessor(value));
  }
});

test("the five UTM fields are exact and visitor tracking stays nonpersistent", () => {
  const value = governance();
  assert.deepEqual(value.utmBoundary.allowed, [
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"
  ]);
  assert.equal(value.utmBoundary.otherParametersDiscarded, true);
  assert.equal(value.utmBoundary.persistentVisitorTracking, false);
});
