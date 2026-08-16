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
export const GYM_PREVIEW_ENVIRONMENT_SUCCESSOR_PATH =
  "overwatch/governance/route-iq-gym-preview-deployment-environment-successor-v1.json";
export const GYM_PREVIEW_ENVIRONMENT_REPORT_PATH =
  "overwatch/reports/BATCH-20260814-002-gym-preview-environment-successor.json";
export const GYM_PREVIEW_ROUTE_QUALITY_SUCCESSOR_PATH =
  "overwatch/governance/route-iq-gym-preview-route-quality-runtime-surface-successor-v1.json";
export const GYM_PREVIEW_VISUAL_SUCCESSOR_PATH =
  "overwatch/governance/route-iq-representative-intelligence-public-experience-successor-v1.json";

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

function verifyImplementationCommit(record) {
  assert.deepEqual(
    git("show", "-s", "--format=%H%n%P%n%T%n%an <%ae>%n%cn <%ce>%n%s", record.commit)
      .split("\n"),
    [
      record.commit,
      record.parent,
      record.tree,
      record.identity,
      record.identity,
      record.subject
    ]
  );
  assert.deepEqual(
    git("diff-tree", "--no-commit-id", "--name-only", "-r", record.commit)
      .split("\n").filter(Boolean).sort(),
    [...record.changedFiles].sort()
  );
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

export function validateGymPreviewEnvironmentSuccessor(successor) {
  assert.equal(successor.version,
    "route-iq-gym-preview-deployment-environment-successor-v1");
  assert.equal(successor.batchId, "BATCH-20260814-002");
  assert.equal(successor.status,
    "INDEPENDENTLY_VERIFIED_NONPRODUCTION_ENVIRONMENT_SUCCESSOR");
  assert.equal(successor.ownerSubsystem, "Prometheus Overwatch");
  assert.equal(successor.predecessor.path, GYM_PREVIEW_GOVERNANCE_PATH);
  assert.equal(successor.predecessor.remainsHistorical, true);
  assert.equal(successor.predecessor.rewritten, false);
  assert.equal(successor.failedHostedAttempt.runId, 31885802657);
  assert.equal(successor.failedHostedAttempt.qualificationJob, "PASS");
  assert.equal(successor.failedHostedAttempt.deploymentJob,
    "FAILED_BEFORE_WORKER_CREATION");
  assert.equal(successor.failedHostedAttempt.productionMutation, false);
  assert.equal(successor.failedHostedAttempt.previewWorkerCreated, false);
  assert.equal(successor.implementation.ownerSubsystem, "Prometheus Infrastructure");
  assert.equal(successor.githubEnvironment.name, "prometheus-public-worker-preview");
  assert.deepEqual(successor.githubEnvironment.requiredSecretNames,
    ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"]);
  assert.equal(successor.githubEnvironment.mainOnly, true);
  assert.equal(successor.githubEnvironment.productionEnvironmentChanged, false);
  assert.equal(successor.githubEnvironment.secretValuesInSourceOrLogs, false);
  assert.deepEqual(successor.previewBoundary.bindings, ["ASSETS"]);
  for (const key of [
    "routes", "customDomains", "kvNamespaces", "durableObjects", "crmBindings",
    "emailBindings", "workerSecrets"
  ]) assert.deepEqual(successor.previewBoundary[key], []);
  assert.equal(successor.previewBoundary.persistenceAllowed, false);
  assert.equal(successor.previewBoundary.emailAllowed, false);
  assert.equal(successor.previewBoundary.productionDeploymentAllowed, false);
  assert.equal(successor.protectedState.collection, "OFF");
  assert.equal(successor.protectedState.activeCohorts, 0);
  assert.equal(successor.protectedState.recommendationInfluence, "OFF");
  assert.equal(successor.protectedState.productionDeployments, 0);
  assert.equal(successor.protectedState.productionDataMutations, 0);
  return successor;
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

export function validateGymPreviewVisualSuccessor(successor) {
  assert.equal(successor.version,
    "route-iq-representative-intelligence-public-experience-successor-v1");
  assert.equal(successor.batchId, "BATCH-20260815-002");
  assert.equal(successor.status, "INDEPENDENTLY_VERIFIED_SOURCE_SUCCESSOR");
  assert.equal(successor.ownerSubsystem, "Prometheus Overwatch");
  assert.equal(successor.implementationCommits.length, 4);
  assert.deepEqual(successor.navigationContract.publicRoutes,
    ["/", "/investors", "/thank-you"]);
  assert.equal(successor.navigationContract.legalRoutesRemainPublic, true);
  assert.equal(successor.navigationContract.sectionAnchorsRemainPublic, true);
  assert.equal(successor.navigationContract.browserHistorySupported, true);
  assert.equal(successor.navigationContract.dashboardFallbackProhibited, true);
  assert.deepEqual(successor.dashboardVisualContract, {
    command: "#000000",
    commandSecondary: "#1a1a1a",
    accent: "#ff6a00",
    themeColor: "#000000",
    operationalStatusColorsPreserved: true,
    dashboardBehaviorChanged: false,
    retiredGreenLogoAbsent: true
  });
  assert.deepEqual(successor.representativeLearningBoundary.questionIds, [
    "languages", "conversationStyle", "fieldEnvironment", "energyWindow",
    "interests", "conversationPace"
  ]);
  assert.equal(successor.representativeLearningBoundary.storage, "memory_only");
  assert.equal(successor.representativeLearningBoundary.publicCrmTransmission, false);
  assert.equal(successor.representativeLearningBoundary.productionRecommendationInfluence, false);
  assert.equal(successor.representativeLearningBoundary.declaredPreferencesAreHypotheses, true);
  assert.equal(successor.releaseBoundary.productionDeploymentAuthorized, false);
  assert.equal(successor.releaseBoundary.productionStorageAccessAllowed, false);
  assert.equal(successor.releaseBoundary.publicPreviewOnly, true);
  assert.equal(successor.protectedState.collection, "OFF");
  assert.equal(successor.protectedState.activeCohorts, 0);
  assert.equal(successor.protectedState.recommendationInfluence, "OFF");
  assert.equal(successor.protectedState.productionDeployments, 0);
  assert.equal(successor.protectedState.productionDataMutations, 0);
  return successor;
}

function verifyWebsite(governance) {
  const landing = text("landing.html");
  const source = text("src/main.jsx");
  const representativeStyle = text("src/route-iq-representative-style-preview.js");
  const scene = text("src/IntelligenceScene.jsx");
  assert.match(landing, /Prometheus Route IQ for Gyms \| Representative Intelligence/u);
  for (const phrase of [
    "Route IQ learns the representative, not just the road.",
    "Request a Route IQ dashboard built around your field operation.",
    "The Bigger Vision: A Representative Intelligence Layer For All Outside Sales",
    "Built for private onboarding, executive review, and field operating discipline.",
    "Request Investor Deck",
    "Got it. Your Route IQ request is stored.",
    "these answers stay in this browser tab. They are not stored, sent with your request, or passed into production recommendations.",
    "Gym sales is our first focused market."
  ]) assert.ok(source.includes(phrase), `Website phrase missing: ${phrase}`);
  for (const phrase of [
    "Which languages can you confidently use in a sales conversation?",
    "Where do you naturally build the strongest rapport?",
    "Which field environment brings out your best work?",
    "When do you usually feel most effective in the field?",
    "What do you genuinely enjoy outside work?",
    "Only authorized field evidence can confirm, challenge, or strengthen it"
  ]) assert.ok(representativeStyle.includes(phrase), `Representative profile invariant missing: ${phrase}`);
  assert.doesNotMatch(source.slice(
    source.indexOf("function RepresentativeStylePreview()"),
    source.indexOf("function GymRequestForm()")
  ), /fetch\(|localStorage|sessionStorage|indexedDB|document\.cookie/iu);
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

function verifyBoundaries(governance, environmentSuccessor, visualSuccessor) {
  const preview = json(visualSuccessor.currentContracts.preview.path);
  const security = json(governance.contracts.security.path);
  const claims = json(governance.contracts.claims.path);
  const gym = json(governance.contracts.gymIntake.path);
  const workflow = text(visualSuccessor.currentContracts.workflow.path);
  for (const key of ["gymIntake", "security", "claims"]) {
    const contract = governance.contracts[key];
    assert.equal(sha256(read(contract.path)), contract.sha256, `${contract.path} drifted`);
  }
  for (const contract of Object.values(visualSuccessor.currentContracts)) {
    assert.equal(sha256(read(contract.path)), contract.sha256, `${contract.path} drifted`);
  }
  assert.deepEqual(preview.previewWorker.allowedBindings, ["ASSETS"]);
  assert.equal(preview.workflow.protectedEnvironment, "prometheus-public-worker-preview");
  assert.equal(preview.boundaries.productionDeploymentAllowed, false);
  assert.equal(preview.boundaries.crmBindingAllowed, false);
  assert.equal(preview.boundaries.emailBindingsAllowed, false);
  assert.equal(security.protectedState, "PROTECTED_CRM_NOTIFICATION_ONLY");
  assert.equal(claims.advertisingClaim.productionUseAllowed, false);
  assert.equal(gym.notification.contactPiiAllowed, false);
  assert.match(workflow, /^name: Preview Prometheus Route IQ Gym First$/mu);
  assert.match(workflow, /workflow_dispatch:/u);
  assert.match(workflow, /name: prometheus-public-worker-preview/u);
  assert.doesNotMatch(workflow, /name: prometheus-public-worker-production/u);
  assert.match(workflow, /--name prometheusrouteiq-website-gym-preview/u);
  assert.doesNotMatch(workflow, /wrangler\.prometheusrouteiq-website\.jsonc/u);
}

export function verifyOverwatchGymFirstDualTrackPublicWebsitePreview({
  requireClean = true
} = {}) {
  const governance = validateGymPreviewGovernance(json(GYM_PREVIEW_GOVERNANCE_PATH));
  const environmentSuccessor = validateGymPreviewEnvironmentSuccessor(
    json(GYM_PREVIEW_ENVIRONMENT_SUCCESSOR_PATH)
  );
  const routeQualitySuccessor = validateGymPreviewRouteQualitySuccessor(
    json(GYM_PREVIEW_ROUTE_QUALITY_SUCCESSOR_PATH)
  );
  const visualSuccessor = validateGymPreviewVisualSuccessor(
    json(GYM_PREVIEW_VISUAL_SUCCESSOR_PATH)
  );
  const report = json(GYM_PREVIEW_REPORT_PATH);
  const environmentReport = json(GYM_PREVIEW_ENVIRONMENT_REPORT_PATH);
  assert.equal(git("rev-parse", `${governance.startingRepository.commit}^{tree}`),
    governance.startingRepository.tree);
  for (const record of governance.ownerCommits) verifyCommit(record);
  verifyImplementationCommit(environmentSuccessor.implementation);
  assert.equal(sha256(read(environmentSuccessor.predecessor.path)),
    environmentSuccessor.predecessor.sha256);
  assert.equal(sha256(read(environmentSuccessor.verificationReport.path)),
    environmentSuccessor.verificationReport.sha256);
  assert.equal(environmentReport.status,
    "PREVIEW_ENVIRONMENT_SUCCESSOR_SOURCE_VERIFIED");
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
  for (const predecessor of visualSuccessor.predecessors) {
    assert.equal(sha256(read(predecessor.path)), predecessor.sha256);
    assert.equal(predecessor.remainsHistorical, true);
    assert.equal(predecessor.rewritten, false);
  }
  for (const record of visualSuccessor.implementationCommits) verifyImplementationCommit(record);
  assert.equal(
    sha256(read(visualSuccessor.intelligenceProvenance.path)),
    visualSuccessor.intelligenceProvenance.sha256
  );
  for (const key of ["gymIntake", "security", "claims"]) {
    const contract = governance.contracts[key];
    assert.equal(sha256(read(contract.path)), contract.sha256, `${contract.path} drifted`);
  }
  verifyWebsite(governance);
  verifyBoundaries(governance, environmentSuccessor, visualSuccessor);
  const previewAssets = hashPrometheusRouteIqGymPreviewAssets();
  assert.equal(previewAssets.sha256, visualSuccessor.releaseIdentities.previewAssetSha256);
  assert.equal(previewAssets.fileCount, visualSuccessor.releaseIdentities.previewFileCount);
  assert.equal(previewAssets.totalBytes, visualSuccessor.releaseIdentities.previewTotalBytes);
  const deployment = verifyRouteIqPublicDeploymentAssets({ build: false });
  assert.equal(deployment.candidateWebsiteCommit, visualSuccessor.releaseIdentities.websiteCommit);
  assert.equal(deployment.candidateWebsiteTree, visualSuccessor.releaseIdentities.websiteTree);
  assert.equal(deployment.deploymentAssetsSha256,
    visualSuccessor.releaseIdentities.deploymentAssetSha256);
  assert.equal(deployment.initialCriticalBytes,
    visualSuccessor.releaseIdentities.initialCriticalBytes);
  assert.equal(deployment.sizes.lazy3d, visualSuccessor.releaseIdentities.lazy3dBytes);
  const rollback = verifyPublicForwardRollbackArtifact(root);
  assert.equal(rollback.artifactSha256, visualSuccessor.releaseIdentities.rollbackBundleSha256);
  assert.equal(sha256(read("workers/infrastructure/route-iq-public-forward-rollback-v1.json")),
    visualSuccessor.releaseIdentities.rollbackContractSha256);
  const protectedChanges = git("diff", "--name-only",
    `${governance.startingRepository.commit}..HEAD`, "--",
    "dashboard", "data", "intelligence", "index.html", "workers/prometheus-iq-worker.js")
    .split("\n").filter(Boolean);
  assert.deepEqual(protectedChanges, [
    "index.html",
    "intelligence/provenance/protected-baseline-synchronization-dashboard-public-visual-identity-v1.json",
    "intelligence/provenance/protected-baseline-synchronization-dashboard-public-visual-protected-consumers-v1.json",
    "intelligence/provenance/protected-baseline-synchronization-dashboard-public-visual-verifier-composition-v1.json",
    "intelligence/provenance/protected-baseline-synchronization-gym-preview-route-quality-runtime-surface-v1.json",
    "intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs",
    "intelligence/provenance/verify-paid-customer-revenue-readiness-protected-consumers-v1.mjs"
  ]);
  assert.equal(report.verdict, "SOURCE_COMPLETE_ISOLATED_PREVIEW_QUALIFICATION_PENDING");
  if (requireClean) assert.equal(git("status", "--porcelain"), "");
  return Object.freeze({
    status: "PASS",
    batchId: visualSuccessor.batchId,
    ownerCommitCount: visualSuccessor.implementationCommits.length,
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
