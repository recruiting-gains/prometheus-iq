import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  isExactMainCheckout,
  isProtectedRuntimePath,
  verifyRetentionProtectedRuntimeSuccessors,
  verifyOverwatchRouteIqRetentionDeletionRuntime
} from "../scripts/verify-overwatch-route-iq-retention-deletion-runtime.mjs";

const governedLearningVerification = Object.freeze({
  status: "PASS",
  batchId: "BATCH-20260812-001",
  ownerCommitCount: 15,
  historicalEvidence: "UNCHANGED",
  deploymentPerformed: false,
  collection: "OFF",
  activeCohorts: 0,
  recommendationInfluence: "OFF",
  founderOnly: true,
  publicWorkerExposure: false,
  semanticIntegrityBatchId: "BATCH-20260813-001",
  truthState: "INSUFFICIENT_EVIDENCE",
  successfulRelationships: 3,
  followUpRelationships: 0,
  reviewRequiredOutcomes: 1
});

const governance = () => JSON.parse(readFileSync(
  "overwatch/governance/route-iq-retention-expiry-deletion-runtime-v1.json",
  "utf8"
));

const gymPreviewGovernance = () => JSON.parse(readFileSync(
  "overwatch/governance/route-iq-gym-first-dual-track-public-website-preview-v1.json",
  "utf8"
));

const dashboardVisualGovernance = () => JSON.parse(readFileSync(
  "overwatch/governance/route-iq-public-navigation-dashboard-visual-successor-v1.json",
  "utf8"
));

const representativeIntelligenceGovernance = () => JSON.parse(readFileSync(
  "overwatch/governance/route-iq-representative-intelligence-public-experience-successor-v1.json",
  "utf8"
));

const claimSafePublicGovernance = () => JSON.parse(readFileSync(
  "overwatch/governance/route-iq-claim-safe-public-deployment-successor-v1.json",
  "utf8"
));

test("Overwatch verifies the exact owner chain and dormant deletion release boundary", () => {
  assert.deepEqual(verifyOverwatchRouteIqRetentionDeletionRuntime(), {
    status: "PASS",
    batchId: "BATCH-20260809-001",
    ownerCommitCount: 22,
    sourceRuntime: "COMPLETE_DORMANT",
    physicalDeletionActivated: false,
    productionStorageAccessed: false,
    productionDeletionPerformed: false,
    collection: "OFF",
    activeCohorts: 0,
    recommendationInfluence: "OFF",
    node24ActionPinStatus: "OFFICIAL_NODE24_ACTION_PIN_OVERWATCH_VERIFIED",
    historicalEvidence: "UNCHANGED",
    forwardRevert: "VERIFIED_NOT_EXECUTED"
  });
});

test("governance keeps production activation and deletion behind separate Founder boundaries", () => {
  const record = governance();
  assert.equal(record.status, "SOURCE_COMPLETE_DORMANT_DEPLOYMENT_HELD");
  assert.equal(record.infrastructureBoundary.productionBindingConfigured, false);
  assert.equal(record.infrastructureBoundary.deploymentAuthorized, false);
  assert.equal(record.protectedState.productionStorageAccessPerformed, false);
  assert.equal(record.protectedState.productionDeletionPerformed, false);
  assert.equal(record.activationDecision.prospectiveCollectionMayActivate, false);
  assert.equal(record.remainingBlockers.includes("separate_founder_deployment_authorization_required"), true);
  assert.equal(record.remainingBlockers.includes("separate_exact_production_deletion_authorization_required"), true);
});

test("governance pins every post-hosted owner successor without changing runtime activation", () => {
  const record = governance();
  assert.equal(record.ownership.commits["Prometheus Data"].length, 6);
  assert.equal(record.ownership.commits["Prometheus Intelligence Engine"].length, 10);
  assert.equal(record.ownership.commits["Prometheus Infrastructure"].length, 6);
  assert.equal(
    record.dataRuntime.coordinatorRuntime.sha256,
    "586d19dbf65c4c740ecea6a7e0b4e1d01d733471a2604f8a92b946af092ee282"
  );
  assert.equal(
    record.intelligenceBoundary.consumerAdmissionProvenance.sha256,
    "aa1b5e78df0bb0b84acdb22bcadda38c7891a908d58ae2dd42cb8238499ed93d"
  );
  assert.equal(
    record.infrastructureBoundary.privateWorkflowQualification.ownerCommit,
    "1f347ba74bfa2eab0415b3778dcbfdc0f80dd9ee"
  );
  assert.equal(record.qualificationRepair.privateWorkflowPayload.runtimeBehaviorChanged, false);
  assert.equal(record.qualificationRepair.privateWorkflowPayload.deploymentPerformed, false);
  assert.equal(record.qualificationRepair.finalPayloadSuccessorComposition.failedRun, 31340617780);
  assert.equal(record.qualificationRepair.finalPayloadSuccessorComposition
    .historicalSuccessorsPreserved, true);
  assert.equal(record.qualificationRepair.finalPayloadSuccessorComposition
    .orderedOwnerChainRequired, true);
  assert.equal(record.qualificationRepair.finalPayloadSuccessorComposition
    .productionMutationPerformed, false);
  assert.equal(record.qualificationRepair.historicalRetentionCoordinatorComposition.failedRun,
    31341204771);
  assert.equal(record.qualificationRepair.historicalRetentionCoordinatorComposition
    .runtimeBehaviorChanged, false);
  assert.equal(record.qualificationRepair.historicalRetentionCoordinatorComposition
    .productionMutationPerformed, false);
  assert.equal(record.qualificationRepair.offRouteRetentionContractComposition.failedRun,
    31341364276);
  assert.equal(record.qualificationRepair.offRouteRetentionContractComposition
    .ownerRepairCommit, "1dcccdafaaff1183e5f7de15624ede547ac11c94");
  assert.equal(record.qualificationRepair.offRouteRetentionContractComposition
    .runtimeBehaviorChanged, false);
  assert.equal(record.qualificationRepair.offRouteRetentionContractComposition
    .productionMutationPerformed, false);
  assert.equal(record.qualificationRepair.controlledRehearsalOffRouteComposition.failedRun,
    31341877824);
  assert.equal(record.qualificationRepair.controlledRehearsalOffRouteComposition
    .ownerSubsystem, "Prometheus Overwatch");
  assert.equal(record.qualificationRepair.controlledRehearsalOffRouteComposition
    .runtimeBehaviorChanged, false);
  assert.equal(record.qualificationRepair.controlledRehearsalOffRouteComposition
    .productionMutationPerformed, false);
  assert.equal(record.qualificationRepair.prospectiveShadowDormantStatusComposition.failedRun,
    31342100553);
  assert.equal(record.qualificationRepair.prospectiveShadowDormantStatusComposition
    .ownerRepairCommit, "052a547ed092c1dd0f606bd72dca93a5f17b7291");
  assert.equal(record.qualificationRepair.prospectiveShadowDormantStatusComposition
    .runtimeBehaviorChanged, false);
  assert.equal(record.qualificationRepair.prospectiveShadowDormantStatusComposition
    .productionMutationPerformed, false);
  assert.equal(record.qualificationRepair.releaseProvenanceRetentionComposition.failedRun,
    31342472100);
  assert.equal(record.qualificationRepair.releaseProvenanceRetentionComposition
    .ownerRepairCommit, "687d842e3bf925d00244b666f091e277d3dc710a");
  assert.equal(record.qualificationRepair.releaseProvenanceRetentionComposition
    .runtimeBehaviorChanged, false);
  assert.equal(record.qualificationRepair.releaseProvenanceRetentionComposition
    .protectedIntelligencePathsComposed, 13);
  assert.equal(record.qualificationRepair.releaseProvenanceRetentionComposition
    .protectedIntelligenceTransitionsComposed, 19);
});

test("the governed deletion graph is manifest-derived and fail closed", () => {
  const graph = governance().canonicalDeletionGraph;
  assert.equal(graph.authority, "field_session_commit_manifest_plus_stored_relationships");
  assert.equal(graph.prefixScanIsDeletionAuthority, false);
  assert.equal(graph.prefixScanUsedOnlyForUnknownArtifactDetection, true);
  assert.equal(graph.unknownOrphanedCrossScopeCorruptOrUnmanifestedFailsClosed, true);
  assert.equal(graph.coordinatorRepositorySetHashBound, true);
  assert.equal(graph.fieldSessionArtifacts.includes("every_commit_named_session_history_entry"), true);
  assert.equal(graph.coordinatorTables.includes("field_session_evaluation_contexts"), true);
  assert.equal(graph.coordinatorTables.includes("opportunities"), true);
});

test("hosted detached checkout is accepted only for the exact synchronized main identity", () => {
  const head = "a".repeat(40);
  const hostedMain = {
    GITHUB_ACTIONS: "true",
    GITHUB_REF: "refs/heads/main",
    GITHUB_REF_NAME: "main",
    GITHUB_REF_TYPE: "branch",
    GITHUB_SHA: head
  };
  assert.equal(isExactMainCheckout({ branch: "main", head, originMain: head }), true);
  assert.equal(isExactMainCheckout({
    branch: "",
    head,
    originMain: head,
    environment: hostedMain
  }), true);
  for (const [field, value] of [
    ["GITHUB_ACTIONS", "false"],
    ["GITHUB_REF", "refs/heads/release"],
    ["GITHUB_REF_NAME", "release"],
    ["GITHUB_REF_TYPE", "tag"],
    ["GITHUB_SHA", "b".repeat(40)]
  ]) {
    assert.equal(isExactMainCheckout({
      branch: "",
      head,
      originMain: head,
      environment: { ...hostedMain, [field]: value }
    }), false, `${field} drift must fail closed.`);
  }
  assert.equal(isExactMainCheckout({
    branch: "",
    head,
    originMain: "b".repeat(40),
    environment: hostedMain
  }), false);
  assert.equal(isExactMainCheckout({ branch: "release", head, originMain: head }), false);
});

test("protected runtime matching rejects deployable paths without rejecting governance names", () => {
  for (const path of [
    "wrangler.jsonc",
    "wrangler.prometheusrouteiq-website.jsonc",
    "workers/private/wrangler.production.toml",
    ".github/workflows/deploy.yml",
    "deploy/private-worker.mjs",
    "website/src/index.ts",
    "crm/runtime.ts",
    "dashboard/app.tsx"
  ]) {
    assert.equal(isProtectedRuntimePath(path), true, `${path} must remain protected.`);
  }
  for (const path of [
    "overwatch/governance/route-iq-wrangler-miniflare-major-transition-requalification-v1.json",
    "overwatch/reports/BATCH-20260810-001-route-iq-wrangler-miniflare-major-transition-requalification.json",
    "tests/route-iq-request-crm-infrastructure.test.mjs",
    "tests/dashboard-runtime-contract.test.mjs"
  ]) {
    assert.equal(isProtectedRuntimePath(path), false, `${path} is evidence, not runtime configuration.`);
  }
});

test("retention composes only the exact governed protected-runtime successors", () => {
  const node24WorkflowPaths = [".github/workflows/security-gates.yml"];
  const governedLearningPaths = [
    "dashboard/route-iq-dashboard-platform.mjs",
    "deploy/cloudflare-pages/_headers",
    "deploy/cloudflare-pages/dashboard/route-iq-dashboard-platform.mjs",
    "deploy/cloudflare-pages/index.html"
  ];
  const gymPreviewRecord = gymPreviewGovernance();
  const gymPreviewPaths = gymPreviewRecord.retentionProtectedRuntimeSuccessor.paths;
  const dashboardVisualRecord = dashboardVisualGovernance();
  const replacedGymPreviewPaths = new Set([
    "deploy/prometheusrouteiq-website/assets/IntelligenceScene-B1-h6ijC.js",
    "deploy/prometheusrouteiq-website/assets/landing-BeMJF6LH.js"
  ]);
  const dashboardVisualPaths = [
    ...gymPreviewPaths.filter(path => !replacedGymPreviewPaths.has(path)),
    "deploy/prometheusrouteiq-website/assets/IntelligenceScene-DUONdOlD.js",
    "deploy/prometheusrouteiq-website/assets/landing-BOzyl4oV.js",
    "deploy/cloudflare-pages/index.html",
    "deploy/cloudflare-pages/manifest-founder.webmanifest",
    "deploy/cloudflare-pages/manifest.webmanifest"
  ];
  const representativeIntelligenceRecord = representativeIntelligenceGovernance();
  const representativeSuccessorPaths = representativeIntelligenceRecord
    .implementationCommits.at(-1).changedFiles.filter(isProtectedRuntimePath);
  const preRepresentativePaths = [...new Set([
    ...node24WorkflowPaths,
    ...governedLearningPaths,
    ...dashboardVisualPaths
  ])];
  const representativeFinalPaths = [...new Set([
    ...preRepresentativePaths,
    ...representativeSuccessorPaths
  ])];
  const claimSafePublicRecord = claimSafePublicGovernance();
  const claimSafeSuccessorPaths = claimSafePublicRecord
    .implementationCommits.at(-1).changedFiles.filter(isProtectedRuntimePath);
  const claimSafeFinalPaths = [...new Set([
    ...representativeFinalPaths,
    ...claimSafeSuccessorPaths
  ])];
  const input = {
    protectedRuntimeChanges: [...claimSafeFinalPaths],
    node24WorkflowPaths,
    governedLearning: governedLearningVerification,
    gymPreviewGovernance: gymPreviewRecord,
    gymPreviewProtectedRuntimeChanges: gymPreviewPaths,
    dashboardVisualGovernance: dashboardVisualRecord,
    dashboardVisualProtectedRuntimeChanges: dashboardVisualPaths,
    representativeIntelligenceGovernance: representativeIntelligenceRecord,
    representativeSuccessorProtectedRuntimeChanges: representativeSuccessorPaths,
    preRepresentativeProtectedRuntimeChanges: preRepresentativePaths,
    claimSafePublicGovernance: claimSafePublicRecord,
    claimSafeSuccessorProtectedRuntimeChanges: claimSafeSuccessorPaths,
    claimSafeFinalProtectedRuntimeChanges: claimSafeFinalPaths
  };
  assert.equal(verifyRetentionProtectedRuntimeSuccessors(input), true);
  for (const mutate of [
    value => { value.protectedRuntimeChanges.push("deploy/cloudflare-pages/extra.js"); },
    value => { value.protectedRuntimeChanges.pop(); },
    value => { value.governedLearning.status = "FAIL"; },
    value => { value.governedLearning.deploymentPerformed = true; },
    value => { value.governedLearning.collection = "ON"; },
    value => { value.governedLearning.publicWorkerExposure = true; },
    value => { value.governedLearning.ownerCommitCount = 14; },
    value => { value.governedLearning.semanticIntegrityBatchId = "BATCH-STALE"; },
    value => { value.governedLearning.truthState = "SUFFICIENT_EVIDENCE"; },
    value => { value.governedLearning.successfulRelationships = 4; },
    value => { value.governedLearning.reviewRequiredOutcomes = 0; },
    value => { value.gymPreviewGovernance.batchId = "BATCH-STALE"; },
    value => { value.gymPreviewGovernance.ownerSubsystem = "Prometheus Infrastructure"; },
    value => {
      value.gymPreviewGovernance.retentionProtectedRuntimeSuccessor.classification = "STALE";
    },
    value => {
      value.gymPreviewGovernance.retentionProtectedRuntimeSuccessor.ownerCommits.pop();
    },
    value => {
      value.gymPreviewGovernance.retentionProtectedRuntimeSuccessor.retentionRuntimeChanged = true;
    },
    value => {
      value.gymPreviewGovernance.retentionProtectedRuntimeSuccessor.productionDeploymentAuthorized = true;
    },
    value => { value.gymPreviewProtectedRuntimeChanges.pop(); },
    value => { value.dashboardVisualGovernance.batchId = "BATCH-STALE"; },
    value => {
      value.dashboardVisualGovernance.ownerSubsystem = "Prometheus Infrastructure";
    },
    value => {
      value.dashboardVisualGovernance.releaseBoundary.productionDeploymentAuthorized = true;
    },
    value => { value.dashboardVisualGovernance.protectedState.productionDeployments = 1; },
    value => { value.dashboardVisualProtectedRuntimeChanges.pop(); },
    value => { value.representativeIntelligenceGovernance.batchId = "BATCH-STALE"; },
    value => {
      value.representativeIntelligenceGovernance.implementationCommits.at(-1).changedFiles.pop();
    },
    value => {
      value.representativeIntelligenceGovernance.releaseBoundary.productionDeploymentAuthorized = true;
    },
    value => {
      value.representativeIntelligenceGovernance.representativeLearningBoundary
        .productionRecommendationInfluence = true;
    },
    value => { value.representativeSuccessorProtectedRuntimeChanges.pop(); },
    value => { value.preRepresentativeProtectedRuntimeChanges.pop(); },
    value => { value.claimSafePublicGovernance.batchId = "BATCH-STALE"; },
    value => {
      value.claimSafePublicGovernance.releaseBoundary.productionDeploymentAuthorized = false;
    },
    value => { value.claimSafeSuccessorProtectedRuntimeChanges.pop(); },
    value => { value.claimSafeFinalProtectedRuntimeChanges.pop(); }
  ]) {
    const candidate = structuredClone(input);
    mutate(candidate);
    assert.throws(() => verifyRetentionProtectedRuntimeSuccessors(candidate));
  }
});
