import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  GYM_PREVIEW_GOVERNANCE_PATH,
  GYM_PREVIEW_ENVIRONMENT_SUCCESSOR_PATH,
  GYM_PREVIEW_ROUTE_QUALITY_SUCCESSOR_PATH,
  validateGymPreviewEnvironmentSuccessor,
  validateGymPreviewGovernance,
  validateGymPreviewRouteQualitySuccessor,
  verifyOverwatchGymFirstDualTrackPublicWebsitePreview
} from "../scripts/verify-overwatch-route-iq-gym-first-dual-track-public-website-preview-v1.mjs";

const governance = () => JSON.parse(readFileSync(GYM_PREVIEW_GOVERNANCE_PATH, "utf8"));
const environmentSuccessor = () => JSON.parse(
  readFileSync(GYM_PREVIEW_ENVIRONMENT_SUCCESSOR_PATH, "utf8")
);
const routeQualitySuccessor = () => JSON.parse(
  readFileSync(GYM_PREVIEW_ROUTE_QUALITY_SUCCESSOR_PATH, "utf8")
);

test("Overwatch verifies the exact gym-first dual-track source and isolated preview boundary", () => {
  assert.deepEqual(
    verifyOverwatchGymFirstDualTrackPublicWebsitePreview({ requireClean: false }),
    {
      status: "PASS",
      batchId: "BATCH-20260814-002",
      ownerCommitCount: 10,
      previewAssetSha256: "4a148051d9deb34f9334c31b216120ce6665d1da30865e33725fcd7de6f7cf3b",
      deploymentAssetSha256: "6a6dde7efd17144b91f5f294cd25c7cfaaf2ff1347e637d6e692f5ed66cdab3b",
      rollbackBundleSha256: "548a0a3f5d53b240b708e283ed18f2865a0c2dd2fdb041d5ccd405ce2e5bc4e0",
      emailDisposition: "PROTECTED_CRM_NOTIFICATION_ONLY",
      truthState: "INSUFFICIENT_EVIDENCE",
      runtimeFileCount: 34,
      productionDeploymentAuthorized: false
    }
  );
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
