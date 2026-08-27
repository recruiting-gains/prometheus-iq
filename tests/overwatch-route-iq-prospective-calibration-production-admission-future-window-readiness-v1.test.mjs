import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  isExactPrivateSessionRepairCheckout,
  isGovernedMainCheckout,
  verifyOverwatchProspectiveCalibrationProductionAdmissionFutureWindowReadiness
} from "../scripts/verify-overwatch-route-iq-prospective-calibration-production-admission-future-window-readiness-v1.mjs";

const readJson = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));

test("Overwatch verifies the complete source-only calibration admission successor", async () => {
  assert.deepEqual(
    await verifyOverwatchProspectiveCalibrationProductionAdmissionFutureWindowReadiness(),
    {
      status: "PASS",
      batchId: "BATCH-20260814-001",
      ownerCommitCount: 42,
      criticalPinCount: 13,
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

test("hosted qualification accepts only the exact detached synchronized main checkout", () => {
  const head = "a".repeat(40);
  const environment = {
    GITHUB_ACTIONS: "true",
    GITHUB_REPOSITORY: "PrometheusRouteIQ/prometheus-iq",
    GITHUB_REF: "refs/heads/main",
    GITHUB_REF_NAME: "main",
    GITHUB_REF_TYPE: "branch",
    GITHUB_EVENT_NAME: "workflow_dispatch",
    GITHUB_SHA: head
  };
  assert.equal(isGovernedMainCheckout({
    branch: "main",
    head,
    originMain: "b".repeat(40),
    environment: {}
  }), true);
  assert.equal(isGovernedMainCheckout({
    branch: "",
    head,
    originMain: head,
    environment
  }), true);
  for (const [key, value] of [
    ["GITHUB_REPOSITORY", "other/repository"],
    ["GITHUB_REF_NAME", "release"],
    ["GITHUB_EVENT_NAME", "push"],
    ["GITHUB_SHA", "b".repeat(40)]
  ]) {
    assert.equal(isGovernedMainCheckout({
      branch: "",
      head,
      originMain: head,
      environment: { ...environment, [key]: value }
    }), false);
  }
  assert.equal(isGovernedMainCheckout({
    branch: "",
    head,
    originMain: "b".repeat(40),
    environment
  }), false);
});

test("pre-merge calibration accepts only the exact private-session corrective checkout", () => {
  const branch = "codex/private-session-v2-compatibility-repair";
  const originMain = "c7119fcee140ab8a130cdb888439277fdcbeb6b0";
  const head = "b".repeat(40);
  const changedPaths = [
    "data/route-iq-commercial-readiness-v1/route-iq-august-1-launch-envelope.mjs",
    "overwatch/governance/route-iq-august-1-readiness-successors-v1.json",
    "overwatch/governance/route-iq-governed-multi-session-learning-dashboard-advisory-bridge-v1.json",
    "package.json",
    "scripts/verify-dashboard-runtime-workflows.mjs",
    "scripts/verify-overwatch-route-iq-august-1-launch-readiness.mjs",
    "scripts/verify-overwatch-route-iq-cloudflare-toolchain-requalification.mjs",
    "scripts/verify-overwatch-route-iq-governed-multi-session-learning-dashboard-advisory-bridge-v1.mjs",
    "scripts/verify-overwatch-route-iq-prospective-calibration-production-admission-future-window-readiness-v1.mjs",
    "scripts/verify-overwatch-route-iq-retention-deletion-runtime.mjs",
    "scripts/verify-overwatch-route-iq-retention-maintenance-deployment-readiness.mjs",
    "scripts/verify-route-iq-public-deployment-assets.mjs",
    "tests/dashboard-route-iq-customer-pwa.test.mjs",
    "tests/overwatch-route-iq-august-1-launch-readiness.test.mjs",
    "tests/overwatch-route-iq-3d-visual-continuity.test.mjs",
    "tests/overwatch-route-iq-cloudflare-toolchain-requalification.test.mjs",
    "tests/overwatch-route-iq-prospective-calibration-production-admission-future-window-readiness-v1.test.mjs",
    "tests/overwatch-route-iq-retention-deletion-runtime.test.mjs",
    "tests/overwatch-route-iq-retention-maintenance-deployment-readiness.test.mjs",
    "tests/route-iq-august-1-customer-pwa-infrastructure.test.mjs",
    "tests/route-iq-august-1-launch-envelope.test.mjs",
    "tests/route-iq-multi-company-runtime-infrastructure.test.mjs",
    "workers/infrastructure/route-iq-august-1-customer-pwa-runtime-v1.json",
    "workers/infrastructure/route-iq-august-1-customer-pwa-runtime.js"
  ];
  const exact = {
    branch,
    head,
    originMain,
    mergeBase: originMain,
    mergeCommits: "",
    statusLines: [],
    changedPaths,
    preservedDiffSha256:
      "7bb1d11d90ff4c6916ecc6bfec5f4078aac18ee54c6b5b62248e6c9068f28740"
  };
  assert.equal(isExactPrivateSessionRepairCheckout(exact), true);
  assert.equal(isExactPrivateSessionRepairCheckout({
    ...exact,
    branch: "",
    environment: {
      GITHUB_ACTIONS: "true",
      GITHUB_REPOSITORY: "PrometheusRouteIQ/prometheus-iq",
      GITHUB_SHA: head,
      GITHUB_HEAD_REF: branch
    }
  }), true);
  for (const override of [
    { originMain: "a".repeat(40) },
    { mergeBase: "a".repeat(40) },
    { mergeCommits: "c".repeat(40) },
    { statusLines: ["?? untracked.txt"] },
    { changedPaths: changedPaths.slice(1) },
    { changedPaths: [...changedPaths, "unrelated.txt"] },
    { preservedDiffSha256: "0".repeat(64) }
  ]) {
    assert.equal(isExactPrivateSessionRepairCheckout({ ...exact, ...override }), false);
  }
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
