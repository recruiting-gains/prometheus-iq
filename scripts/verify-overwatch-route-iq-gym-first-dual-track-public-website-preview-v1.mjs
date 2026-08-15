#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { verifyRouteIqPublicDeploymentAssets } from "./verify-route-iq-public-deployment-assets.mjs";
import { verifyPublicForwardRollbackArtifact } from "./lib/route-iq-public-forward-rollback.mjs";
import { hashPrometheusRouteIqGymPreviewAssets } from "../workers/infrastructure/prometheusrouteiq-website-gym-preview-assets.mjs";
import { verifyGymPreviewRouteQualityRuntimeSurfaceSuccessor } from
  "../intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs";

const root = resolve(import.meta.dirname, "..");
export const GYM_PREVIEW_GOVERNANCE_PATH =
  "overwatch/governance/route-iq-gym-first-dual-track-public-website-preview-v1.json";
export const GYM_PREVIEW_REPORT_PATH =
  "overwatch/reports/BATCH-20260814-002-route-iq-gym-first-dual-track-public-website-preview.json";
export const GYM_PREVIEW_ROUTE_QUALITY_SUCCESSOR_PATH =
  "overwatch/governance/route-iq-gym-preview-route-quality-runtime-surface-successor-v1.json";

const read = path => readFileSync(resolve(root, path));
const text = path => read(path).toString("utf8");
const json = path => JSON.parse(text(path));
const sha256 = value => createHash("sha256").update(value).digest("hex");
const git = (...args) => execFileSync("/usr/bin/git", args, {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 16 * 1024 * 1024,
  stdio: ["ignore", "pipe", "ignore"]
}).trim();

function verifyCommit(record) {
  assert.deepEqual(
    git("show", "-s", "--format=%H%n%T%n%an <%ae>%n%cn <%ce>%n%s", record.commit)
      .split("\n"),
    [record.commit, record.tree, record.owner, record.owner, record.subject]
  );
  execFileSync("/usr/bin/git", ["merge-base", "--is-ancestor", record.commit, "HEAD"], {
    cwd: root,
    stdio: "ignore"
  });
}

export function validateGymPreviewGovernance(governance) {
  assert.equal(governance.governanceVersion,
    "route-iq-gym-first-dual-track-public-website-preview-v1");
  assert.equal(governance.batchId, "BATCH-20260814-002");
  assert.equal(governance.ownerSubsystem, "Prometheus Overwatch");
  assert.equal(governance.ownerCommits.length, 9);
  assert.equal(governance.contracts.gymIntake.version, "route-iq-gym-request.v1");
  assert.equal(governance.contracts.security.emailDisposition,
    "PROTECTED_CRM_NOTIFICATION_ONLY");
  assert.equal(governance.contracts.claims.truthState, "INSUFFICIENT_EVIDENCE");
  assert.equal(governance.contracts.claims.productionUseAllowed, false);
  assert.deepEqual(governance.previewBoundary.bindings, ["ASSETS"]);
  for (const key of [
    "productionRoutes", "customDomains", "durableObjects", "kvNamespaces",
    "emailBindings", "crmBindings", "workerSecrets"
  ]) assert.deepEqual(governance.previewBoundary[key], []);
  assert.equal(governance.previewBoundary.persistenceAllowed, false);
  assert.equal(governance.previewBoundary.emailAllowed, false);
  assert.equal(governance.releaseBoundary.productionDeploymentAuthorized, false);
  assert.equal(governance.protectedState.collection, "OFF");
  assert.equal(governance.protectedState.activeCohorts, 0);
  assert.equal(governance.protectedState.recommendationInfluence, "OFF");
  return governance;
}

export function validateGymPreviewRouteQualitySuccessor(governance) {
  assert.equal(governance.version,
    "route-iq-overwatch-gym-preview-route-quality-runtime-surface-successor-v1");
  assert.equal(governance.batchId, "BATCH-20260814-002");
  assert.equal(governance.status, "INDEPENDENTLY_VERIFIED_PROTECTED_SUCCESSOR");
  assert.equal(governance.ownerSubsystem, "Prometheus Overwatch");
  assert.equal(governance.implementationCommits.length, 13);
  assert.deepEqual(governance.runtimeSurface, {
    previousFileCount: 33,
    currentFileCount: 34,
    addedFile: "src/route-iq-gym-request-form.js",
    dashboardFetches: 6,
    liveGoogleApiCalls: 0
  });
  assert.equal(governance.releasePreservation.routeOrderingChanged, false);
  assert.equal(governance.releasePreservation.routeScoringChanged, false);
  assert.equal(governance.releasePreservation.businessHoursEligibilityChanged, false);
  assert.equal(governance.releasePreservation.websiteSourceChanged, false);
  assert.equal(governance.releasePreservation.previewWorkflowChanged, false);
  assert.equal(governance.protectedState.collection, "OFF");
  assert.equal(governance.protectedState.activeCohorts, 0);
  assert.equal(governance.protectedState.recommendationInfluence, "OFF");
  assert.equal(governance.protectedState.productionDeployments, 0);
  assert.equal(governance.protectedState.productionMutations, 0);
  return governance;
}

function verifyWebsite(governance) {
  const landing = text("landing.html");
  const source = text("src/main.jsx");
  const scene = text("src/IntelligenceScene.jsx");
  assert.match(landing, /Prometheus Route IQ for Gyms \| Field Sales Intelligence/u);
  for (const phrase of [
    "Get Your Gym's Route Dashboard Built In 2 Hours",
    "The Bigger Vision: The Intelligence Layer For All Outside Sales",
    "Built for private onboarding, executive review, and field operating discipline.",
    "Request Investor Deck",
    "Got it. Building your dashboard now.",
    "Gym sales is our first focused market."
  ]) assert.ok(source.includes(phrase), `Website phrase missing: ${phrase}`);
  for (const phrase of [
    "React.lazy(() => import(\"./IntelligenceScene.jsx\"))",
    "useScroll()",
    "useReducedMotion()",
    "data-visual-fallback=\"field-operations\""
  ]) assert.ok(source.includes(phrase), `Investor continuity missing: ${phrase}`);
  for (const phrase of ["FlameCore3D", "<Stars ", "<Line points={routeA}", "<torusGeometry"])
    assert.ok(scene.includes(phrase), `3D scene invariant missing: ${phrase}`);
  for (const pattern of [
    /\bGaia\b/u, /\bAthena\b/u, /Fitness Connection/iu,
    /franchise(?:e|ing)? expansion/iu, /recommendation superiority/iu
  ]) assert.doesNotMatch(`${landing}\n${source}`, pattern);
  for (const asset of governance.founderAssets) {
    assert.equal(sha256(read(asset.repositoryPath)), asset.sha256);
  }
  assert.equal((source.match(/<picture/gu) || []).length, 2);
}

function verifyBoundaries(governance) {
  const preview = json(governance.contracts.preview.path);
  const security = json(governance.contracts.security.path);
  const claims = json(governance.contracts.claims.path);
  const gym = json(governance.contracts.gymIntake.path);
  const workflow = text(governance.contracts.workflow.path);
  for (const contract of Object.values(governance.contracts)) {
    assert.equal(sha256(read(contract.path)), contract.sha256, `${contract.path} drifted`);
  }
  assert.deepEqual(preview.previewWorker.allowedBindings, ["ASSETS"]);
  assert.equal(preview.boundaries.productionDeploymentAllowed, false);
  assert.equal(preview.boundaries.crmBindingAllowed, false);
  assert.equal(preview.boundaries.emailBindingsAllowed, false);
  assert.equal(security.protectedState, "PROTECTED_CRM_NOTIFICATION_ONLY");
  assert.equal(claims.advertisingClaim.productionUseAllowed, false);
  assert.equal(gym.notification.contactPiiAllowed, false);
  assert.match(workflow, /^name: Preview Prometheus Route IQ Gym First$/mu);
  assert.match(workflow, /workflow_dispatch:/u);
  assert.match(workflow, /--name prometheusrouteiq-website-gym-preview/u);
  assert.doesNotMatch(workflow, /wrangler\.prometheusrouteiq-website\.jsonc/u);
}

export function verifyOverwatchGymFirstDualTrackPublicWebsitePreview({
  requireClean = true
} = {}) {
  const governance = validateGymPreviewGovernance(json(GYM_PREVIEW_GOVERNANCE_PATH));
  const routeQualitySuccessor = validateGymPreviewRouteQualitySuccessor(
    json(GYM_PREVIEW_ROUTE_QUALITY_SUCCESSOR_PATH)
  );
  const report = json(GYM_PREVIEW_REPORT_PATH);
  assert.equal(git("rev-parse", `${governance.startingRepository.commit}^{tree}`),
    governance.startingRepository.tree);
  for (const record of governance.ownerCommits) verifyCommit(record);
  for (const record of routeQualitySuccessor.implementationCommits) verifyCommit(record);
  assert.equal(
    sha256(read(routeQualitySuccessor.implementationProvenance.path)),
    routeQualitySuccessor.implementationProvenance.sha256
  );
  const intelligenceSuccessor = verifyGymPreviewRouteQualityRuntimeSurfaceSuccessor();
  assert.deepEqual(
    intelligenceSuccessor.successor.behavior,
    {
      previousRuntimeFileCount: 33,
      currentRuntimeFileCount: 34,
      addedRuntimeFile: "src/route-iq-gym-request-form.js",
      liveGoogleApiCalls: 0,
      dashboardFetches: 6,
      routeOrderingChanged: false,
      routeScoringChanged: false,
      businessHoursEligibilityChanged: false
    }
  );
  for (const contract of Object.values(governance.contracts)) {
    assert.equal(sha256(read(contract.path)), contract.sha256, `${contract.path} drifted`);
  }
  verifyWebsite(governance);
  verifyBoundaries(governance);
  const previewAssets = hashPrometheusRouteIqGymPreviewAssets();
  assert.equal(previewAssets.sha256, governance.releaseIdentities.previewAssetSha256);
  assert.equal(previewAssets.fileCount, governance.releaseIdentities.fileCount);
  const deployment = verifyRouteIqPublicDeploymentAssets({ build: false });
  assert.equal(deployment.candidateWebsiteCommit, governance.releaseIdentities.websiteCommit);
  assert.equal(deployment.candidateWebsiteTree, governance.releaseIdentities.websiteTree);
  assert.equal(deployment.deploymentAssetsSha256,
    governance.releaseIdentities.deploymentAssetSha256);
  const rollback = verifyPublicForwardRollbackArtifact(root);
  assert.equal(rollback.artifactSha256, governance.releaseIdentities.rollbackBundleSha256);
  assert.equal(sha256(read("workers/infrastructure/route-iq-public-forward-rollback-v1.json")),
    governance.releaseIdentities.rollbackContractSha256);
  const protectedChanges = git("diff", "--name-only",
    `${governance.startingRepository.commit}..HEAD`, "--",
    "dashboard", "data", "intelligence", "index.html", "workers/prometheus-iq-worker.js")
    .split("\n").filter(Boolean);
  assert.deepEqual(protectedChanges, [
    "intelligence/provenance/protected-baseline-synchronization-gym-preview-route-quality-runtime-surface-v1.json",
    "intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs"
  ]);
  assert.equal(report.verdict, "SOURCE_COMPLETE_ISOLATED_PREVIEW_QUALIFICATION_PENDING");
  if (requireClean) assert.equal(git("status", "--porcelain"), "");
  return Object.freeze({
    status: "PASS",
    batchId: governance.batchId,
    ownerCommitCount: governance.ownerCommits.length,
    previewAssetSha256: previewAssets.sha256,
    deploymentAssetSha256: deployment.deploymentAssetsSha256,
    rollbackBundleSha256: rollback.artifactSha256,
    emailDisposition: governance.contracts.security.emailDisposition,
    truthState: governance.protectedState.truthState,
    runtimeFileCount: routeQualitySuccessor.runtimeSurface.currentFileCount,
    productionDeploymentAuthorized: false
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  process.stdout.write(`${JSON.stringify(
    verifyOverwatchGymFirstDualTrackPublicWebsitePreview(), null, 2
  )}\n`);
}
