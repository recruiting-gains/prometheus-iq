import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { verifyCrossSubsystemArtifactContracts } from "./verify-cross-subsystem-artifact-contracts.mjs";
import {
  verifyOverwatchGithubActionsNode24PinSuccessor
} from "./verify-overwatch-github-actions-node24-pin-successor.mjs";
import {
  verifyOverwatchRouteIqGovernedLearningAdvisoryBridge
} from "./verify-overwatch-route-iq-governed-multi-session-learning-dashboard-advisory-bridge-v1.mjs";

const governancePath = "overwatch/governance/route-iq-retention-expiry-deletion-runtime-v1.json";
const reportPath = "overwatch/reports/BATCH-20260809-001-route-iq-retention-expiry-deletion-runtime.json";
const registryPath = "overwatch/artifact-contracts/canonical-artifact-registry.json";
const gymPreviewGovernancePath =
  "overwatch/governance/route-iq-gym-first-dual-track-public-website-preview-v1.json";
const dashboardVisualGovernancePath =
  "overwatch/governance/route-iq-public-navigation-dashboard-visual-successor-v1.json";
const representativeIntelligenceGovernancePath =
  "overwatch/governance/route-iq-representative-intelligence-public-experience-successor-v1.json";
const claimSafePublicGovernancePath =
  "overwatch/governance/route-iq-claim-safe-public-deployment-successor-v1.json";
const startCommit = "0ae9b3752476bc782b067a2a47fd388e4c3791ef";
const startTree = "3b6778b25c731e75c489b738dc00256868522d22";
const acceptedCommit = "78ec6ceecf7c0420b6da7d9f3e7bbbd62b48ae2e";
const acceptedTree = "387760d6e7182e83ec06364abd4fc74bd5a94c07";
const privateSessionRepairBranch = "codex/private-session-v2-compatibility-repair";
const privateSessionRepairBase = "c7119fcee140ab8a130cdb888439277fdcbeb6b0";
const privateSessionRepairPreservedDiffSha256 =
  "7bb1d11d90ff4c6916ecc6bfec5f4078aac18ee54c6b5b62248e6c9068f28740";
const privateSessionRepairPreservedPaths = Object.freeze([
  "data/route-iq-commercial-readiness-v1/route-iq-august-1-launch-envelope.mjs",
  "overwatch/governance/route-iq-governed-multi-session-learning-dashboard-advisory-bridge-v1.json",
  "scripts/verify-dashboard-runtime-workflows.mjs",
  "tests/dashboard-route-iq-customer-pwa.test.mjs",
  "tests/route-iq-august-1-customer-pwa-infrastructure.test.mjs",
  "tests/route-iq-august-1-launch-envelope.test.mjs",
  "tests/route-iq-multi-company-runtime-infrastructure.test.mjs",
  "workers/infrastructure/route-iq-august-1-customer-pwa-runtime-v1.json",
  "workers/infrastructure/route-iq-august-1-customer-pwa-runtime.js"
].sort());
const privateSessionRepairPaths = Object.freeze([
  ...privateSessionRepairPreservedPaths,
  "overwatch/governance/route-iq-august-1-readiness-successors-v1.json",
  "scripts/verify-overwatch-route-iq-august-1-launch-readiness.mjs",
  "scripts/verify-overwatch-route-iq-cloudflare-toolchain-requalification.mjs",
  "scripts/verify-overwatch-route-iq-governed-multi-session-learning-dashboard-advisory-bridge-v1.mjs",
  "scripts/verify-overwatch-route-iq-retention-deletion-runtime.mjs",
  "tests/overwatch-route-iq-august-1-launch-readiness.test.mjs",
  "tests/overwatch-route-iq-retention-deletion-runtime.test.mjs"
].sort());

const ownerCommits = Object.freeze({
  "8845846632801ccf29e52a36139a43c1063fcc2e": Object.freeze({
    name: "Prometheus Data",
    email: "data@prometheus.local",
    files: Object.freeze([
      "data/route-iq-field-sessions-v1/README.md",
      "data/route-iq-field-sessions-v1/route-iq-field-session-archive.mjs",
      "data/route-iq-field-sessions-v1/route-iq-prospective-retention-policy.mjs",
      "data/route-iq-field-sessions-v1/route-iq-retention-deletion-event-v1.schema.json",
      "data/route-iq-field-sessions-v1/route-iq-retention-deletion-plan-v1.schema.json",
      "data/route-iq-field-sessions-v1/route-iq-retention-deletion-runtime.mjs",
      "data/route-iq-field-sessions-v1/route-iq-retention-governance.mjs",
      "data/route-iq-field-sessions-v1/route-iq-retention-operation-receipt-v1.schema.json",
      "tests/route-iq-prospective-retention-policy.test.mjs",
      "tests/route-iq-retention-deletion-runtime.test.mjs",
      "tests/route-iq-retention-test-support.mjs"
    ])
  }),
  "28c8a51b4aafef777e407c324ea15c57f4f12454": Object.freeze({
    name: "Prometheus Data",
    email: "data@prometheus.local",
    files: Object.freeze([
      "data/route-iq-field-sessions-v1/route-iq-prospective-shadow-retention-policy-v1.json",
      "data/route-iq-field-sessions-v1/route-iq-retention-governance.mjs",
      "tests/route-iq-prospective-retention-policy.test.mjs",
      "tests/route-iq-retention-deletion-runtime.test.mjs"
    ])
  }),
  "052a547ed092c1dd0f606bd72dca93a5f17b7291": Object.freeze({
    name: "Prometheus Data",
    email: "data@prometheus.local",
    files: Object.freeze([
      "tests/route-iq-prospective-shadow-evidence.test.mjs"
    ])
  }),
  "f5a473a4fbab7d0f876be36c65b603d9b13bcc0a": Object.freeze({
    name: "Prometheus Intelligence Engine",
    email: "intelligence@prometheus.local",
    files: Object.freeze([
      "intelligence/route-iq-prospective-retention-admission.mjs",
      "tests/route-iq-prospective-retention-intelligence.test.mjs"
    ])
  }),
  "17bef15930ded364a55aadd47d0f96722cc8e9c6": Object.freeze({
    name: "Prometheus Intelligence Engine",
    email: "intelligence@prometheus.local",
    files: Object.freeze([
      "intelligence/contracts/off-route-learning-intelligence-contracts.json",
      "intelligence/contracts/read-only-field-session-learning-contracts.json",
      "intelligence/contracts/shadow-decision-readiness-contracts.json",
      "intelligence/provenance/specifications/prospective-retention-admission-v1.json",
      "scripts/validate-intelligence-architecture.mjs",
      "scripts/verify-route-iq-prospective-retention-intelligence.mjs"
    ])
  }),
  "7280f2b505e244f187755990d55bcfa701d1ef46": Object.freeze({
    name: "Prometheus Infrastructure",
    email: "infrastructure@prometheus.local",
    files: Object.freeze([
      "tests/route-iq-retention-maintenance-infrastructure.test.mjs",
      "workers/infrastructure/route-iq-retention-maintenance-runtime-v1.json",
      "workers/infrastructure/route-iq-retention-maintenance-runtime.js"
    ])
  }),
  "82b2edd12f15978d97f0950657c5c123a01a54a7": Object.freeze({
    name: "Prometheus Data",
    email: "data@prometheus.local",
    files: Object.freeze([
      "overwatch/artifact-contracts/data/fitness-connection-runtime-artifact-contract-v1.json",
      "tests/route-iq-prospective-retention-policy.test.mjs"
    ])
  }),
  "70c57f3d94eabfc019cbb5dae1cbd276e6e92be0": Object.freeze({
    name: "Prometheus Infrastructure",
    email: "infrastructure@prometheus.local",
    files: Object.freeze(["scripts/verify-route-iq-prospective-shadow-infrastructure.mjs"])
  }),
  "a8fedf7c0b88f0611b4f721b08641e55413c591a": Object.freeze({
    name: "Prometheus Data",
    email: "data@prometheus.local",
    files: Object.freeze([
      "data/route-iq-field-sessions-v1/route-iq-retention-deletion-plan-v1.schema.json",
      "data/route-iq-field-sessions-v1/route-iq-retention-deletion-runtime.mjs",
      "tests/route-iq-retention-deletion-runtime.test.mjs"
    ])
  }),
  "8156bc78dca7cc15006207f09c53a89828e67750": Object.freeze({
    name: "Prometheus Infrastructure",
    email: "infrastructure@prometheus.local",
    files: Object.freeze([
      "tests/route-iq-retention-maintenance-infrastructure.test.mjs",
      "workers/infrastructure/route-iq-retention-maintenance-forward-revert-v1.json"
    ])
  }),
  "b359d8e701e13d2f9911dcd0cb917eecce8aa7ac": Object.freeze({
    name: "Prometheus Intelligence Engine",
    email: "intelligence@prometheus.local",
    files: Object.freeze([
      "intelligence/provenance/protected-baseline-synchronization-retention-deletion-runtime-v1.json",
      "intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs",
      "tests/route-iq-intelligence-controlled-rehearsal-smoke-contract-successor.test.mjs"
    ])
  }),
  "99f591162093ccb1f4ad5ac2eac59fc76bec4bc0": Object.freeze({
    name: "Prometheus Intelligence Engine",
    email: "intelligence@prometheus.local",
    files: Object.freeze([
      "intelligence/provenance/protected-baseline-synchronization-retention-deletion-runtime-v1.json",
      "intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs",
      "tests/intelligence-architecture.test.mjs",
      "tests/route-iq-intelligence-controlled-rehearsal-smoke-contract-successor.test.mjs"
    ])
  }),
  "a445bf4bdb068eb597b11e60ff10cdd2d1f4e023": Object.freeze({
    name: "Prometheus Infrastructure",
    email: "infrastructure@prometheus.local",
    files: Object.freeze([
      "scripts/verify-production-release.mjs",
      "tests/production-release-current-dashboard-contract.test.mjs"
    ])
  }),
  "61e0c186af29e076797f817d0c834ec42531dbbe": Object.freeze({
    name: "Prometheus Infrastructure",
    email: "infrastructure@prometheus.local",
    files: Object.freeze([
      "scripts/lib/github-actions-private-worker-workflow-v2.mjs",
      "tests/github-actions-private-worker-workflow-v2.test.mjs",
      "workers/infrastructure/github-actions-private-worker-deployment-v2.json"
    ])
  }),
  "1f347ba74bfa2eab0415b3778dcbfdc0f80dd9ee": Object.freeze({
    name: "Prometheus Infrastructure",
    email: "infrastructure@prometheus.local",
    files: Object.freeze([
      "scripts/lib/github-actions-private-worker-workflow-v2.mjs",
      "tests/github-actions-private-worker-workflow-v2.test.mjs",
      "workers/infrastructure/github-actions-private-worker-deployment-v2.json"
    ])
  }),
  "e0a5fb7a9089cae62081295875793f9c635c498c": Object.freeze({
    name: "Prometheus Data",
    email: "data@prometheus.local",
    files: Object.freeze([
      "data/route-iq-field-sessions-v1/route-iq-prospective-shadow-coordinator.mjs"
    ])
  }),
  "d2ed353722b8c99f786306d7bbb37f21349ec3a5": Object.freeze({
    name: "Prometheus Intelligence Engine",
    email: "intelligence@prometheus.local",
    files: Object.freeze([
      "intelligence/read-only-field-session-learning.mjs",
      "scripts/verify-shadow-decision-readiness.mjs",
      "tests/read-only-field-session-learning.test.mjs",
      "tests/shadow-decision-readiness.test.mjs"
    ])
  }),
  "f37a1e16a73d89c57fb988c53c472a570fdbc15f": Object.freeze({
    name: "Prometheus Intelligence Engine",
    email: "intelligence@prometheus.local",
    files: Object.freeze(["scripts/verify-shadow-decision-readiness.mjs"])
  }),
  "605c52e3076504159ac22c84b36b3d441cc30b66": Object.freeze({
    name: "Prometheus Intelligence Engine",
    email: "intelligence@prometheus.local",
    files: Object.freeze([
      "intelligence/provenance/protected-baseline-synchronization-retention-deletion-consumer-admission-v1.json",
      "intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs"
    ])
  }),
  "61418a67b6df3e482b52a1fa6f7fc6757147dda0": Object.freeze({
    name: "Prometheus Intelligence Engine",
    email: "intelligence@prometheus.local",
    files: Object.freeze(["tests/read-only-field-session-learning.test.mjs"])
  }),
  "39cb2b9c9dea7766b420ce8d1ad959c4b35a2d4b": Object.freeze({
    name: "Prometheus Intelligence Engine",
    email: "intelligence@prometheus.local",
    files: Object.freeze([
      "intelligence/provenance/protected-baseline-synchronization-retention-deletion-consumer-admission-v1.json",
      "intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs"
    ])
  }),
  "1dcccdafaaff1183e5f7de15624ede547ac11c94": Object.freeze({
    name: "Prometheus Intelligence Engine",
    email: "intelligence@prometheus.local",
    files: Object.freeze([
      "scripts/verify-off-route-learning-intelligence.mjs",
      "tests/off-route-learning-intelligence.test.mjs"
    ])
  })
});

const read = path => readFileSync(path);
const readJson = path => JSON.parse(read(path));
const sha256 = value => createHash("sha256").update(value).digest("hex");
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const readAtCommit = (commit, path) => execFileSync("git", ["show", `${commit}:${path}`]);
const readJsonAtCommit = (commit, path) => JSON.parse(readAtCommit(commit, path));

export function isExactMainCheckout({ branch, head, originMain, environment = {} }) {
  if (head !== originMain) return false;
  if (branch === "main") return true;
  return branch === ""
    && environment.GITHUB_ACTIONS === "true"
    && environment.GITHUB_REF === "refs/heads/main"
    && environment.GITHUB_REF_NAME === "main"
    && environment.GITHUB_REF_TYPE === "branch"
    && environment.GITHUB_SHA === head;
}

export function isExactPrivateSessionRepairCheckout({
  branch,
  head,
  originMain,
  environment = {},
  mergeBase,
  mergeCommits = "",
  statusLines = [],
  changedPaths = [],
  preservedDiffSha256
}) {
  const localBranch = environment.GITHUB_ACTIONS !== "true"
    && branch === privateSessionRepairBranch;
  const hostedBranch = environment.GITHUB_ACTIONS === "true"
    && environment.GITHUB_REPOSITORY === "PrometheusRouteIQ/prometheus-iq"
    && environment.GITHUB_SHA === head
    && [environment.GITHUB_HEAD_REF, environment.GITHUB_REF_NAME].includes(
      privateSessionRepairBranch
    );
  const sortedChangedPaths = [...changedPaths].sort();
  return (localBranch || hostedBranch)
    && originMain === privateSessionRepairBase
    && mergeBase === originMain
    && mergeCommits === ""
    && !statusLines.some(line => line.startsWith("?? "))
    && sortedChangedPaths.length === privateSessionRepairPaths.length
    && sortedChangedPaths.every((path, index) => path === privateSessionRepairPaths[index])
    && preservedDiffSha256 === privateSessionRepairPreservedDiffSha256;
}

function privateSessionRepairCheckoutEvidence({ branch, head, originMain, environment }) {
  const status = git("status", "--porcelain=v1", "--untracked-files=all");
  const changed = git("diff", "--name-only", originMain, "--");
  const preservedDiff = execFileSync("git", [
    "diff", "--binary", originMain, "--", ...privateSessionRepairPreservedPaths
  ]);
  return {
    branch,
    head,
    originMain,
    environment,
    mergeBase: git("merge-base", head, originMain),
    mergeCommits: git("rev-list", "--merges", `${originMain}..${head}`),
    statusLines: status ? status.split("\n") : [],
    changedPaths: changed ? changed.split("\n") : [],
    preservedDiffSha256: sha256(preservedDiff)
  };
}

export function isProtectedRuntimePath(path) {
  const segments = path.split("/");
  const basename = segments.at(-1) || "";
  if (/^wrangler(?:\.[^/]+)*\.(?:jsonc|toml)$/u.test(basename)) {
    return true;
  }
  if (path === ".github/workflows" || path.startsWith(".github/workflows/")) {
    return true;
  }
  return segments.some(segment => ["deploy", "website", "crm", "dashboard"].includes(segment));
}

const governedLearningProtectedRuntimePaths = Object.freeze([
  "dashboard/route-iq-dashboard-platform.mjs",
  "deploy/cloudflare-pages/_headers",
  "deploy/cloudflare-pages/dashboard/route-iq-dashboard-platform.mjs",
  "deploy/cloudflare-pages/index.html"
]);

export function verifyRetentionProtectedRuntimeSuccessors({
  protectedRuntimeChanges,
  node24WorkflowPaths,
  governedLearning,
  gymPreviewGovernance,
  gymPreviewProtectedRuntimeChanges,
  dashboardVisualGovernance,
  dashboardVisualProtectedRuntimeChanges,
  representativeIntelligenceGovernance,
  representativeSuccessorProtectedRuntimeChanges,
  preRepresentativeProtectedRuntimeChanges,
  claimSafePublicGovernance,
  claimSafeSuccessorProtectedRuntimeChanges,
  claimSafeFinalProtectedRuntimeChanges
}) {
  assert.equal(governedLearning?.status, "PASS");
  assert.equal(governedLearning?.batchId, "BATCH-20260812-001");
  assert.equal(Number.isInteger(governedLearning?.ownerCommitCount), true);
  assert.equal(governedLearning.ownerCommitCount >= 15, true);
  assert.equal(governedLearning?.historicalEvidence, "UNCHANGED");
  assert.equal(governedLearning?.deploymentPerformed, false);
  assert.equal(governedLearning?.collection, "OFF");
  assert.equal(governedLearning?.activeCohorts, 0);
  assert.equal(governedLearning?.recommendationInfluence, "OFF");
  assert.equal(governedLearning?.founderOnly, true);
  assert.equal(governedLearning?.publicWorkerExposure, false);
  assert.equal(governedLearning?.semanticIntegrityBatchId, "BATCH-20260813-001");
  assert.equal(governedLearning?.truthState, "INSUFFICIENT_EVIDENCE");
  assert.equal(governedLearning?.successfulRelationships, 3);
  assert.equal(governedLearning?.followUpRelationships, 0);
  assert.equal(governedLearning?.reviewRequiredOutcomes, 1);
  const gymPreviewSuccessor =
    gymPreviewGovernance?.retentionProtectedRuntimeSuccessor;
  assert.equal(gymPreviewGovernance?.batchId, "BATCH-20260814-002");
  assert.equal(gymPreviewGovernance?.ownerSubsystem, "Prometheus Overwatch");
  assert.equal(gymPreviewSuccessor?.classification,
    "GYM_PREVIEW_RETENTION_PROTECTED_RUNTIME_SUCCESSOR");
  assert.equal(gymPreviewSuccessor?.baselineCommit,
    gymPreviewGovernance?.startingRepository?.commit);
  assert.deepEqual(gymPreviewSuccessor?.ownerCommits, [
    "530808f3a730f76be8fc78e6bfa2f8b753741182",
    "e38bfef992d491eb9d52a1b63518cace6e9a41c5",
    "c42576db4330e2ba42373df247e6a6c65172ff55",
    "15f1d58d4d0fcf689d2ead9591a6f3c4a6598bac",
    "919092f0700ac43fb507dc32111ad2e9d1e9d2e0"
  ]);
  assert.equal(gymPreviewSuccessor?.retentionRuntimeChanged, false);
  assert.equal(gymPreviewSuccessor?.retentionStorageChanged, false);
  assert.equal(gymPreviewSuccessor?.schedulerAdded, false);
  assert.equal(gymPreviewSuccessor?.productionDeploymentAuthorized, false);
  assert.deepEqual([...gymPreviewProtectedRuntimeChanges].sort(),
    [...gymPreviewSuccessor.paths].sort());
  assert.ok(gymPreviewSuccessor.paths.every(isProtectedRuntimePath));
  assert.equal(dashboardVisualGovernance?.version,
    "route-iq-overwatch-public-navigation-dashboard-visual-successor-v1");
  assert.equal(dashboardVisualGovernance?.batchId, "BATCH-20260815-001");
  assert.equal(dashboardVisualGovernance?.ownerSubsystem, "Prometheus Overwatch");
  assert.equal(dashboardVisualGovernance?.status,
    "INDEPENDENTLY_VERIFIED_SOURCE_SUCCESSOR");
  const visualInfrastructure = dashboardVisualGovernance.implementationCommits.find(entry =>
    entry.commit === "84088bb82cd60b36a721222c6e6632e5be7046d2");
  assert.equal(visualInfrastructure?.identity,
    "Prometheus Infrastructure <infrastructure@prometheus.local>");
  const assetTransitions = [
    [
      "deploy/prometheusrouteiq-website/assets/IntelligenceScene-B1-h6ijC.js",
      "deploy/prometheusrouteiq-website/assets/IntelligenceScene-DUONdOlD.js"
    ],
    [
      "deploy/prometheusrouteiq-website/assets/landing-BeMJF6LH.js",
      "deploy/prometheusrouteiq-website/assets/landing-BOzyl4oV.js"
    ]
  ];
  for (const [previousPath, currentPath] of assetTransitions) {
    assert.ok(visualInfrastructure.changedFiles.includes(previousPath));
    assert.ok(visualInfrastructure.changedFiles.includes(currentPath));
  }
  const addedMirrors = [
    "deploy/cloudflare-pages/index.html",
    "deploy/cloudflare-pages/manifest-founder.webmanifest",
    "deploy/cloudflare-pages/manifest.webmanifest"
  ];
  assert.ok(addedMirrors.every(path => visualInfrastructure.changedFiles.includes(path)));
  const replaced = new Set(assetTransitions.map(([path]) => path));
  const currentGymPreviewPaths = [
    ...gymPreviewSuccessor.paths.filter(path => !replaced.has(path)),
    ...assetTransitions.map(([, path]) => path),
    ...addedMirrors
  ];
  assert.deepEqual([...dashboardVisualProtectedRuntimeChanges].sort(),
    [...new Set(currentGymPreviewPaths)].sort());
  assert.equal(dashboardVisualGovernance.releaseBoundary.productionDeploymentAuthorized, false);
  assert.equal(dashboardVisualGovernance.releaseBoundary.productionStorageAccessAllowed, false);
  assert.equal(dashboardVisualGovernance.protectedState.productionDeployments, 0);
  assert.equal(dashboardVisualGovernance.protectedState.productionDataMutations, 0);
  assert.equal(representativeIntelligenceGovernance?.version,
    "route-iq-representative-intelligence-public-experience-successor-v1");
  assert.equal(representativeIntelligenceGovernance?.batchId, "BATCH-20260815-002");
  assert.equal(representativeIntelligenceGovernance?.ownerSubsystem, "Prometheus Overwatch");
  assert.equal(representativeIntelligenceGovernance?.status,
    "INDEPENDENTLY_VERIFIED_SOURCE_SUCCESSOR");
  assert.deepEqual(
    representativeIntelligenceGovernance.implementationCommits.map(entry => entry.commit),
    [
      "07377e7a115cb86e3671787ac89350c78cede46a",
      "fa3a416891e3f964e2085dc44bcd779a4a48de15",
      "64ae9602af90c12022b936a6c70e7297d01dd19d",
      "e1248a556f5683763e8aeda15903e16fb9aa33e3"
    ]
  );
  for (const entry of representativeIntelligenceGovernance.implementationCommits) {
    assert.deepEqual(changedPaths(entry.commit), [...entry.changedFiles].sort());
  }
  const representativeInfrastructure =
    representativeIntelligenceGovernance.implementationCommits.at(-1);
  assert.equal(representativeInfrastructure.identity,
    "Prometheus Infrastructure <infrastructure@prometheus.local>");
  assert.deepEqual(
    [...representativeSuccessorProtectedRuntimeChanges].sort(),
    representativeInfrastructure.changedFiles.filter(isProtectedRuntimePath).sort()
  );
  assert.equal(representativeIntelligenceGovernance.releaseIdentities.deploymentAssetSha256,
    "6c8361e0402a05a26002ad27f6b8af78cfc3fbacca46a1618871d8a8d814d4ec");
  assert.equal(representativeIntelligenceGovernance.releaseIdentities.rollbackContractSha256,
    "78f930c02ac61079015704e62e92c7a4d8399d7c5e7a22d68a59ecd70e691446");
  assert.equal(representativeIntelligenceGovernance.releaseIdentities.rollbackBundleSha256,
    "700300dc04d9c5a217910baa275d0379c23f0569f945e9152a40d595b6fda368");
  assert.equal(
    representativeIntelligenceGovernance.representativeLearningBoundary
      .productionRecommendationInfluence,
    false
  );
  assert.equal(representativeIntelligenceGovernance.releaseBoundary.productionDeploymentAuthorized,
    false);
  assert.equal(representativeIntelligenceGovernance.protectedState.collection, "OFF");
  assert.equal(representativeIntelligenceGovernance.protectedState.activeCohorts, 0);
  assert.equal(representativeIntelligenceGovernance.protectedState.recommendationInfluence, "OFF");
  assert.equal(claimSafePublicGovernance?.version,
    "route-iq-claim-safe-public-deployment-successor-v1");
  assert.equal(claimSafePublicGovernance?.batchId, "BATCH-20260819-001");
  assert.equal(claimSafePublicGovernance?.ownerSubsystem, "Prometheus Overwatch");
  assert.equal(claimSafePublicGovernance?.status,
    "INDEPENDENTLY_VERIFIED_RELEASE_SUCCESSOR");
  assert.equal(
    claimSafePublicGovernance.predecessors[0].path,
    representativeIntelligenceGovernancePath
  );
  assert.equal(
    claimSafePublicGovernance.predecessors[0].sha256,
    sha256(read(representativeIntelligenceGovernancePath))
  );
  assert.deepEqual(
    claimSafePublicGovernance.implementationCommits.map(entry => entry.commit),
    [
      "1fbfc42eadc1bad486f92bcf0b8bd93a7d0236fd",
      "6c4f452723c831b1a2e3e1574eeff713fcde6682"
    ]
  );
  for (const entry of claimSafePublicGovernance.implementationCommits) {
    assert.deepEqual(changedPaths(entry.commit), [...entry.changedFiles].sort());
  }
  const claimSafeInfrastructure = claimSafePublicGovernance.implementationCommits.at(-1);
  assert.equal(claimSafeInfrastructure.identity,
    "Prometheus Infrastructure <infrastructure@prometheus.local>");
  assert.deepEqual(
    [...claimSafeSuccessorProtectedRuntimeChanges].sort(),
    claimSafeInfrastructure.changedFiles.filter(isProtectedRuntimePath).sort()
  );
  assert.equal(claimSafePublicGovernance.releaseIdentities.deploymentAssetSha256,
    "94def2bbd52b6ffa85a40dbc4c51166fcdffdcc364ffdc99a678ddd91d2ed779");
  assert.equal(claimSafePublicGovernance.releaseIdentities.rollbackContractSha256,
    "0bb6b68da599d1d89a3e95f688ea9106ed9e5031454c1e6f706d0afabdefcb28");
  assert.equal(claimSafePublicGovernance.releaseIdentities.rollbackBundleSha256,
    "a2cb4150124ff7569aa09cd50d60a12160ba52f2ef97b29967d92f494cb17f71");
  assert.equal(claimSafePublicGovernance.releaseBoundary.productionDeploymentAuthorized, true);
  assert.equal(claimSafePublicGovernance.releaseBoundary.publicWorkerOnly, true);
  assert.equal(claimSafePublicGovernance.releaseBoundary.privateWorkerMutationAllowed, false);
  assert.equal(claimSafePublicGovernance.protectedState.collection, "OFF");
  assert.equal(claimSafePublicGovernance.protectedState.activeCohorts, 0);
  assert.equal(claimSafePublicGovernance.protectedState.recommendationInfluence, "OFF");
  assert.deepEqual(
    [...protectedRuntimeChanges].sort(),
    [...claimSafeFinalProtectedRuntimeChanges].sort(),
    `Protected runtime paths changed after the claim-safe public successor: ${protectedRuntimeChanges.join(", ")}`
  );
  assert.deepEqual(
    [...preRepresentativeProtectedRuntimeChanges].sort(),
    [...new Set([
      ...node24WorkflowPaths,
      ...governedLearningProtectedRuntimePaths,
      ...currentGymPreviewPaths
    ])].sort(),
    `Historical protected runtime paths changed outside governed successors: ${preRepresentativeProtectedRuntimeChanges.join(", ")}`
  );
  return true;
}

function changedPaths(commit) {
  const value = git("diff-tree", "--no-commit-id", "--name-only", "-r", commit);
  return value ? value.split("\n").sort() : [];
}

function verifyOwnerChain(governance) {
  const governed = new Set(Object.values(governance.ownership.commits).flat());
  assert.deepEqual(governed, new Set(Object.keys(ownerCommits)));
  for (const [commit, expected] of Object.entries(ownerCommits)) {
    assert.equal(git("cat-file", "-t", commit), "commit");
    execFileSync("git", ["merge-base", "--is-ancestor", commit, "HEAD"]);
    assert.equal(git("show", "-s", "--format=%an", commit), expected.name);
    assert.equal(git("show", "-s", "--format=%ae", commit), expected.email);
    assert.equal(git("show", "-s", "--format=%cn", commit), expected.name);
    assert.equal(git("show", "-s", "--format=%ce", commit), expected.email);
    assert.deepEqual(changedPaths(commit), [...expected.files].sort());
  }
}

function verifyAcceptedPinnedFiles(governance) {
  const pins = [
    ...Object.values(governance.dataRuntime).filter(value => value?.path),
    { path: governance.intelligenceBoundary.path, sha256: governance.intelligenceBoundary.sha256 },
    governance.intelligenceBoundary.specification,
    ...governance.intelligenceBoundary.consumerContracts,
    governance.intelligenceBoundary.consumerAdmissionProvenance,
    ...governance.intelligenceBoundary.consumerRuntimeFiles,
    { path: governance.infrastructureBoundary.runtimePath, sha256: governance.infrastructureBoundary.runtimeSha256 },
    { path: governance.infrastructureBoundary.contractPath, sha256: governance.infrastructureBoundary.contractSha256 },
    ...governance.infrastructureBoundary.privateWorkflowQualification.files,
    governance.qualificationRepair.productionReleaseVerifier,
    governance.qualificationRepair.regressionTest,
    governance.qualificationRepair.liveCanonicalIdentity.protectedSuccessor,
    governance.qualificationRepair.liveCanonicalIdentity.verifier,
    governance.qualificationRepair.liveCanonicalIdentity.intelligenceRegressionTest,
    governance.qualificationRepair.liveCanonicalIdentity.architectureRegressionTest,
    governance.qualificationRepair.liveCanonicalIdentity.controlledRehearsalVerifier,
    governance.qualificationRepair.liveCanonicalIdentity.overwatchRegressionTest,
    governance.qualificationRepair.hostedCheckoutBranch.regressionTest,
    governance.qualificationRepair.founderAttendedPackageWiring.canonicalLedger,
    governance.qualificationRepair.founderAttendedPackageWiring.verifier,
    governance.qualificationRepair.founderAttendedPackageWiring.regressionTest,
    governance.qualificationRepair.founderAttendedPackageWiring.ttyRegressionTest,
    ...governance.qualificationRepair.finalPayloadSuccessorComposition.files,
    ...governance.qualificationRepair.historicalRetentionCoordinatorComposition.files,
    ...governance.qualificationRepair.offRouteRetentionContractComposition.files,
    ...governance.qualificationRepair.controlledRehearsalOffRouteComposition.files,
    ...governance.qualificationRepair.prospectiveShadowDormantStatusComposition.files,
    ...governance.qualificationRepair.releaseProvenanceRetentionComposition.files,
    governance.forwardRevert
  ];
  for (const pin of pins) {
    assert.equal(
      sha256(readAtCommit(acceptedCommit, pin.path)),
      pin.sha256,
      `${pin.path} drifted from the accepted Batch 001 snapshot.`
    );
  }
}

export function verifyOverwatchRouteIqRetentionDeletionRuntime() {
  const governance = readJson(governancePath);
  const report = readJson(reportPath);
  const registry = readJson(registryPath);
  const policy = readJsonAtCommit(acceptedCommit, governance.dataRuntime.policy.path);
  const artifactContract = readJsonAtCommit(
    acceptedCommit,
    governance.dataRuntime.artifactContract.path
  );
  const maintenance = readJsonAtCommit(acceptedCommit, governance.infrastructureBoundary.contractPath);
  const forwardRevert = readJsonAtCommit(acceptedCommit, governance.forwardRevert.path);
  const node24Infrastructure = readJson(
    "workers/infrastructure/github-actions-official-node24-pin-successor-v1.json"
  );
  const head = git("rev-parse", "HEAD");
  const originMain = git("rev-parse", "refs/remotes/origin/main");
  const branch = git("branch", "--show-current");

  assert.equal(git("rev-parse", `${startCommit}^{tree}`), startTree);
  const exactMainCheckout = isExactMainCheckout({
    branch,
    head,
    originMain,
    environment: process.env
  });
  const exactPrivateSessionRepairCheckout = isExactPrivateSessionRepairCheckout(
    privateSessionRepairCheckoutEvidence({
      branch,
      head,
      originMain,
      environment: process.env
    })
  );
  assert.equal(
    exactMainCheckout || exactPrivateSessionRepairCheckout,
    true,
    "Repository is neither synchronized main nor the exact authorized private-session repair."
  );
  assert.equal(governance.batchId, "BATCH-20260809-001");
  assert.equal(governance.status, "SOURCE_COMPLETE_DORMANT_DEPLOYMENT_HELD");
  assert.equal(governance.owningSubsystem, "Prometheus Overwatch");
  assert.equal(governance.ownership.implementationOriginatedFromSubsystemOwners, true);
  assert.equal(governance.ownership.overwatchModifiedSubsystemImplementation, false);
  verifyOwnerChain(governance);
  assert.equal(git("rev-parse", `${acceptedCommit}^{tree}`), acceptedTree);
  verifyAcceptedPinnedFiles(governance);

  assert.equal(sha256(read(governance.predecessorGovernance.path)), governance.predecessorGovernance.sha256);
  assert.equal(
    sha256(read(governance.predecessorGovernance.historicalBatchRecordPath)),
    governance.predecessorGovernance.historicalBatchRecordSha256
  );
  assert.equal(governance.predecessorGovernance.rewritten, false);

  assert.equal(policy.expiryAndDeletion.physicalDeletionImplementationStatus, "source_complete_dormant_not_deployed");
  assert.equal(policy.expiryAndDeletion.physicalDeletionEvaluatorCanPerformMutation, true);
  assert.equal(policy.expiryAndDeletion.physicalDeletionActivated, false);
  assert.equal(policy.activationBoundary.collectionDefault, "off");
  const retention = artifactContract.prospectiveShadowEvidenceLifecycleContract.retentionAndCollection;
  assert.equal(retention.physicalDeletionImplementationAvailable, true);
  assert.equal(retention.physicalDeletionDeployed, false);
  assert.equal(retention.physicalDeletionActivated, false);
  assert.equal(retention.activationEligibleUnderRetentionPolicy, false);

  assert.equal(maintenance.status, "source_complete_dormant_not_deployed");
  assert.equal(maintenance.ordinaryArchiveBinding.deleteCapabilityAllowed, false);
  assert.equal(maintenance.ordinaryArchiveBinding.ingestionRequiresMaintenanceBinding, false);
  assert.equal(maintenance.maintenanceBinding.mustBeSeparateFromOrdinaryArchiveBinding, true);
  assert.equal(maintenance.activation.workerRouteConfigured, false);
  assert.equal(maintenance.activation.schedulerConfigured, false);
  assert.equal(maintenance.activation.productionBindingConfigured, false);
  assert.equal(maintenance.activation.productionDeploymentAuthorized, false);
  assert.equal(maintenance.activation.productionDeletionAuthorized, false);
  assert.equal(governance.qualificationRepair.runtimeBehaviorChanged, false);
  assert.equal(governance.qualificationRepair.legacyRuntimePoolSelectionAccepted, false);
  assert.equal(governance.qualificationRepair.sessionBoundBusinessHoursRequired, true);
  assert.equal(governance.qualificationRepair.localProductionReleaseVerification, "PASS");
  assert.equal(governance.qualificationRepair.liveCanonicalIdentity.historicalBaselineObjectsRemainExact, true);
  assert.equal(governance.qualificationRepair.liveCanonicalIdentity.newGovernedReportsClassifiedAsHistoricalRewrites, false);
  assert.equal(governance.qualificationRepair.hostedCheckoutBranch.failedRun, 31337142274);
  assert.equal(governance.qualificationRepair.hostedCheckoutBranch.detachedHeadAcceptedOnlyForExactGithubMain, true);
  assert.equal(governance.qualificationRepair.hostedCheckoutBranch.originMainMustEqualHead, true);
  assert.equal(governance.qualificationRepair.founderAttendedPackageWiring.failedRun, 31337349444);
  assert.equal(governance.qualificationRepair.founderAttendedPackageWiring.runtimeBehaviorChanged, false);
  assert.equal(governance.qualificationRepair.founderAttendedPackageWiring.credentialBehaviorChanged, false);
  assert.equal(governance.qualificationRepair.founderAttendedPackageWiring.orderedPackageChainRequired, true);
  assert.equal(governance.qualificationRepair.privateWorkflowPayload.failedRun, 31337831024);
  assert.equal(governance.qualificationRepair.privateWorkflowPayload.runtimeBehaviorChanged, false);
  assert.equal(governance.qualificationRepair.privateWorkflowPayload.deploymentPerformed, false);
  assert.equal(governance.qualificationRepair.finalPayloadSuccessorComposition.failedRun,
    31340617780);
  assert.equal(governance.qualificationRepair.finalPayloadSuccessorComposition.runtimeBehaviorChanged,
    false);
  assert.equal(governance.qualificationRepair.finalPayloadSuccessorComposition
    .productionMutationPerformed, false);
  assert.equal(governance.qualificationRepair.finalPayloadSuccessorComposition
    .historicalSuccessorsPreserved, true);
  assert.equal(governance.qualificationRepair.finalPayloadSuccessorComposition
    .terminalInfrastructureOwnerCommit, "1f347ba74bfa2eab0415b3778dcbfdc0f80dd9ee");
  assert.equal(governance.qualificationRepair.finalPayloadSuccessorComposition
    .terminalIntelligenceOwnerCommit, "39cb2b9c9dea7766b420ce8d1ad959c4b35a2d4b");
  assert.equal(governance.qualificationRepair.finalPayloadSuccessorComposition
    .orderedOwnerChainRequired, true);
  assert.equal(governance.qualificationRepair.historicalRetentionCoordinatorComposition.failedRun,
    31341204771);
  assert.equal(governance.qualificationRepair.historicalRetentionCoordinatorComposition
    .runtimeBehaviorChanged, false);
  assert.equal(governance.qualificationRepair.historicalRetentionCoordinatorComposition
    .productionMutationPerformed, false);
  assert.equal(governance.qualificationRepair.historicalRetentionCoordinatorComposition
    .historicalCoordinatorSha256,
    "30727656084c774d48a2d80b79f7dcad66a864fd6bd5c489905d9247fd953e85");
  assert.equal(governance.qualificationRepair.historicalRetentionCoordinatorComposition
    .currentCoordinatorSha256,
    "586d19dbf65c4c740ecea6a7e0b4e1d01d733471a2604f8a92b946af092ee282");
  assert.equal(governance.qualificationRepair.offRouteRetentionContractComposition.failedRun,
    31341364276);
  assert.equal(governance.qualificationRepair.offRouteRetentionContractComposition
    .ownerRepairCommit, "1dcccdafaaff1183e5f7de15624ede547ac11c94");
  assert.equal(governance.qualificationRepair.offRouteRetentionContractComposition
    .runtimeBehaviorChanged, false);
  assert.equal(governance.qualificationRepair.offRouteRetentionContractComposition
    .productionMutationPerformed, false);
  assert.equal(governance.qualificationRepair.offRouteRetentionContractComposition
    .historicalContractSha256,
    "7d69761a0fb4049c282077cc20c3d55dcbaa4c281a848996c4738f62bd515201");
  assert.equal(governance.qualificationRepair.offRouteRetentionContractComposition
    .currentContractSha256,
    "9605d400315a478c27c0f779bebf2b96cdd0d3674d2969ec786ec302fea9b69a");
  assert.deepEqual(governance.qualificationRepair.offRouteRetentionContractComposition
    .protectedStateRequired, {
      prospectiveCollection: "OFF",
      activeCohorts: 0,
      recommendationInfluence: "OFF"
    });
  assert.equal(governance.qualificationRepair.controlledRehearsalOffRouteComposition
    .failedRun, 31341877824);
  assert.equal(governance.qualificationRepair.controlledRehearsalOffRouteComposition
    .ownerSubsystem, "Prometheus Overwatch");
  assert.equal(governance.qualificationRepair.controlledRehearsalOffRouteComposition
    .runtimeBehaviorChanged, false);
  assert.equal(governance.qualificationRepair.controlledRehearsalOffRouteComposition
    .productionMutationPerformed, false);
  assert.equal(governance.qualificationRepair.controlledRehearsalOffRouteComposition
    .exactOwnerChainRequired, true);
  assert.equal(governance.qualificationRepair.prospectiveShadowDormantStatusComposition
    .failedRun, 31342100553);
  assert.equal(governance.qualificationRepair.prospectiveShadowDormantStatusComposition
    .ownerRepairCommit, "052a547ed092c1dd0f606bd72dca93a5f17b7291");
  assert.equal(governance.qualificationRepair.prospectiveShadowDormantStatusComposition
    .runtimeBehaviorChanged, false);
  assert.equal(governance.qualificationRepair.prospectiveShadowDormantStatusComposition
    .productionMutationPerformed, false);
  assert.equal(governance.qualificationRepair.prospectiveShadowDormantStatusComposition
    .currentStatus,
    "founder_authorized_18_month_maximum_source_deletion_runtime_dormant");
  assert.equal(governance.qualificationRepair.releaseProvenanceRetentionComposition
    .failedRun, 31342472100);
  assert.equal(governance.qualificationRepair.releaseProvenanceRetentionComposition
    .ownerSubsystem, "Prometheus Overwatch");
  assert.equal(governance.qualificationRepair.releaseProvenanceRetentionComposition
    .ownerRepairCommit, "687d842e3bf925d00244b666f091e277d3dc710a");
  assert.equal(governance.qualificationRepair.releaseProvenanceRetentionComposition
    .runtimeBehaviorChanged, false);
  assert.equal(governance.qualificationRepair.releaseProvenanceRetentionComposition
    .productionMutationPerformed, false);
  assert.equal(governance.qualificationRepair.releaseProvenanceRetentionComposition
    .protectedIntelligencePathsComposed, 13);
  assert.equal(governance.qualificationRepair.releaseProvenanceRetentionComposition
    .protectedIntelligenceTransitionsComposed, 19);
  assert.equal(
    governance.infrastructureBoundary.privateWorkflowQualification.forwardPayloadSha256,
    "aaa8b360d5851bec21637d4c639a485555c367d1d5c9defb1b12163160c035c7"
  );
  assert.equal(
    governance.infrastructureBoundary.privateWorkflowQualification.deployParitySha256,
    "a9c8837fb8978ee43f372f229f7b08286d8ebd2efce93e76971e8a39f47730f9"
  );
  assert.equal(
    governance.infrastructureBoundary.privateWorkflowQualification.rollbackBundleSha256,
    "ab76b6c7ffa0d3899e008c3f92fc41e61139f9a23d40c31d22609d80df919028"
  );

  const runtimeSource = readAtCommit(
    acceptedCommit,
    governance.dataRuntime.deletionRuntime.path
  ).toString("utf8");
  const infrastructureSource = readAtCommit(
    acceptedCommit,
    governance.infrastructureBoundary.runtimePath
  ).toString("utf8");
  assert.doesNotMatch(runtimeSource, /scheduled\s*\(|alarm\s*\(|queue\s*\(|\/api\//);
  assert.doesNotMatch(infrastructureSource, /scheduled\s*\(|alarm\s*\(|queue\s*\(|\/api\//);

  const changed = git("diff", "--name-only", `${startCommit}..HEAD`).split("\n").filter(Boolean);
  const protectedRuntimeChanges = changed.filter(isProtectedRuntimePath);
  const gymPreviewGovernance = readJson(gymPreviewGovernancePath);
  const gymPreviewProtectedRuntimeChanges = git(
    "diff",
    "--name-only",
    gymPreviewGovernance.startingRepository.commit,
    gymPreviewGovernance.retentionProtectedRuntimeSuccessor.ownerCommits.at(-1)
  ).split("\n").filter(Boolean).filter(isProtectedRuntimePath);
  const dashboardVisualGovernance = readJson(dashboardVisualGovernancePath);
  const representativeIntelligenceGovernance = readJson(
    representativeIntelligenceGovernancePath
  );
  assert.equal(
    sha256(read(representativeIntelligenceGovernancePath)),
    "28096aa9d9faaac1ba43fe54c685dd0f07242e3fd74b75263eb3cf293bf3274d"
  );
  const representativeImplementationCommits =
    representativeIntelligenceGovernance.implementationCommits;
  const representativeBaselineCommit = representativeImplementationCommits[0].parent;
  const representativeInfrastructureCommit = representativeImplementationCommits.at(-1).commit;
  const dashboardVisualProtectedRuntimeChanges = git(
    "diff",
    "--name-only",
    `${gymPreviewGovernance.startingRepository.commit}..${representativeBaselineCommit}`
  ).split("\n").filter(Boolean).filter(isProtectedRuntimePath);
  const representativeSuccessorProtectedRuntimeChanges = git(
    "diff",
    "--no-renames",
    "--name-only",
    `${representativeBaselineCommit}..${representativeInfrastructureCommit}`
  ).split("\n").filter(Boolean).filter(isProtectedRuntimePath);
  const preRepresentativeProtectedRuntimeChanges = git(
    "diff",
    "--name-only",
    `${startCommit}..${representativeBaselineCommit}`
  ).split("\n").filter(Boolean).filter(isProtectedRuntimePath);
  const claimSafePublicGovernance = readJson(claimSafePublicGovernancePath);
  const claimSafeImplementationCommits = claimSafePublicGovernance.implementationCommits;
  const claimSafeBaselineCommit = claimSafeImplementationCommits[0].parent;
  const claimSafeInfrastructureCommit = claimSafeImplementationCommits.at(-1).commit;
  const claimSafeSuccessorProtectedRuntimeChanges = git(
    "diff",
    "--no-renames",
    "--name-only",
    `${claimSafeBaselineCommit}..${claimSafeInfrastructureCommit}`
  ).split("\n").filter(Boolean).filter(isProtectedRuntimePath);
  const claimSafeFinalProtectedRuntimeChanges = git(
    "diff",
    "--name-only",
    `${startCommit}..${claimSafeInfrastructureCommit}`
  ).split("\n").filter(Boolean).filter(isProtectedRuntimePath);
  const node24Verification = verifyOverwatchGithubActionsNode24PinSuccessor();
  assert.equal(node24Verification.status, "OFFICIAL_NODE24_ACTION_PIN_OVERWATCH_VERIFIED");
  assert.equal(verifyRetentionProtectedRuntimeSuccessors({
    protectedRuntimeChanges,
    node24WorkflowPaths: node24Infrastructure.workflows.map(item => item.path),
    governedLearning: verifyOverwatchRouteIqGovernedLearningAdvisoryBridge(),
    gymPreviewGovernance,
    gymPreviewProtectedRuntimeChanges,
    dashboardVisualGovernance,
    dashboardVisualProtectedRuntimeChanges,
    representativeIntelligenceGovernance,
    representativeSuccessorProtectedRuntimeChanges,
    preRepresentativeProtectedRuntimeChanges,
    claimSafePublicGovernance,
    claimSafeSuccessorProtectedRuntimeChanges,
    claimSafeFinalProtectedRuntimeChanges
  }), true);
  assert.equal(
    git("rev-parse", `${startCommit}:data/route-iq-field-sessions-v1/workspaces/fitness_connection/sessions`),
    governance.historicalEvidence.sessionSubtreeGitObjectBefore
  );
  assert.equal(
    git("rev-parse", "HEAD:data/route-iq-field-sessions-v1/workspaces/fitness_connection/sessions"),
    governance.historicalEvidence.sessionSubtreeGitObjectAfter
  );
  assert.equal(
    git("rev-parse", "HEAD:data/route-iq-field-sessions-v1/source-evidence"),
    governance.historicalEvidence.sourceEvidenceSubtreeGitObjectAfter
  );
  assert.equal(governance.historicalEvidence.rewritten, false);

  assert.equal(forwardRevert.forwardOnly, true);
  assert.equal(forwardRevert.historyRewriteAllowed, false);
  assert.equal(forwardRevert.deploymentPerformed, false);
  assert.equal(forwardRevert.productionStorageMutationPerformed, false);
  assert.equal(governance.protectedState.collection, "OFF");
  assert.equal(governance.protectedState.activeCohorts, 0);
  assert.equal(governance.protectedState.recommendationInfluence, "OFF");
  assert.equal(governance.protectedState.canonicalProspectiveRecords, 0);
  assert.equal(governance.protectedState.canonicalEvaluations, 0);
  assert.equal(governance.protectedState.productionDeployment, "UNCHANGED");
  assert.equal(governance.protectedState.productionStorageAccessPerformed, false);
  assert.equal(governance.protectedState.productionDeletionPerformed, false);
  assert.equal(governance.activationDecision.prospectiveCollectionMayActivate, false);

  const fitness = registry.workspaces.find(workspace => workspace.workspaceId === "fitness_connection");
  const registered = new Map(fitness.canonicalArtifacts.map(artifact => [artifact.artifactId, artifact]));
  for (const [artifactId, path] of [
    ["fitness_connection_route_iq_retention_deletion_runtime_governance", governancePath],
    ["fitness_connection_route_iq_retention_deletion_runtime_batch_record", reportPath]
  ]) {
    const artifact = registered.get(artifactId);
    assert.ok(artifact);
    assert.equal(artifact.path, path);
    assert.equal(artifact.ownerSubsystem, "Prometheus Overwatch");
    assert.equal(artifact.productionConsumer, false);
    assert.equal(artifact.failClosedIfMissing, true);
  }
  const contracts = verifyCrossSubsystemArtifactContracts();
  assert.equal(contracts.ok, true, contracts.failures.join("\n"));

  assert.equal(report.verdict, governance.status);
  assert.equal(report.fixtureExecution.dryRunMutationCount, 0);
  assert.equal(report.fixtureExecution.exactBoundaryExpiredFixture, "COMPLETELY_DELETED");
  assert.equal(report.fixtureExecution.partialFailureState, "BLOCKED_RESUMABLE");
  assert.equal(report.fixtureExecution.identicalRetry, "IDEMPOTENT");
  assert.equal(report.qualification.focusedPreflight.productionReleaseCurrentDashboardRegressionTests, "3/3 PASS");
  assert.equal(report.qualification.focusedPreflight.localProductionReleaseVerification, "PASS");
  assert.equal(report.qualification.focusedPreflight.liveCanonicalIdentityRegressionTests, "18/18 PASS");
  assert.equal(report.qualification.focusedPreflight.intelligenceArchitectureRegressionTests, "15/15 PASS");
  assert.equal(report.qualification.focusedPreflight.controlledRehearsalRegressionTests, "13/13 PASS");
  assert.equal(report.qualification.focusedPreflight.hostedCheckoutBranchRegressionTests, "4/4 PASS");
  assert.equal(report.qualification.focusedPreflight.founderAttendedPackageWiringRegressionTests,
    "20/20 PASS");
  assert.equal(report.qualification.initialHostedQualificationRun, 31336094147);
  assert.equal(report.qualification.initialHostedQualificationResult, "FAILED_CLOSED_STALE_SUCCESSOR_CHAIN");
  assert.equal(report.qualification.secondHostedQualificationRun, 31336503689);
  assert.equal(report.qualification.secondHostedQualificationResult,
    "FAILED_CLOSED_LIVE_IDENTITY_SUCCESSOR_AND_HISTORICAL_SCOPE");
  assert.equal(report.qualification.thirdHostedQualificationRun, 31337142274);
  assert.equal(report.qualification.thirdHostedQualificationResult, "FAILED_CLOSED_DETACHED_EXACT_MAIN_CHECKOUT");
  assert.equal(report.qualification.fourthHostedQualificationRun, 31337349444);
  assert.equal(report.qualification.fourthHostedQualificationResult,
    "FAILED_CLOSED_STALE_FOUNDER_ATTENDED_PACKAGE_SUCCESSOR");
  assert.equal(report.qualification.fifthHostedQualificationRun, 31337831024);
  assert.equal(report.qualification.fifthHostedQualificationResult,
    "FAILED_CLOSED_PRIVATE_WORKFLOW_PACKAGE_TEST_PATH");
  assert.equal(report.qualification.sixthHostedQualificationRun, 31340617780);
  assert.equal(report.qualification.sixthHostedQualificationResult,
    "FAILED_CLOSED_FINAL_RETENTION_SUCCESSORS_UNCOMPOSED");
  assert.equal(report.qualification.seventhHostedQualificationRun, 31341204771);
  assert.equal(report.qualification.seventhHostedQualificationResult,
    "FAILED_CLOSED_HISTORICAL_RETENTION_COORDINATOR_SUCCESSOR_UNCOMPOSED");
  assert.equal(report.qualification.eighthHostedQualificationRun, 31341364276);
  assert.equal(report.qualification.eighthHostedQualificationResult,
    "FAILED_CLOSED_OFF_ROUTE_RETENTION_CONTRACT_SUCCESSOR_UNCOMPOSED");
  assert.equal(report.qualification.ninthHostedQualificationRun, 31341877824);
  assert.equal(report.qualification.ninthHostedQualificationResult,
    "FAILED_CLOSED_CONTROLLED_REHEARSAL_OFF_ROUTE_SUCCESSOR_UNCOMPOSED");
  assert.equal(report.qualification.tenthHostedQualificationRun, 31342100553);
  assert.equal(report.qualification.tenthHostedQualificationResult,
    "FAILED_CLOSED_PROSPECTIVE_SHADOW_DORMANT_STATUS_UNCOMPOSED");
  assert.equal(report.qualification.eleventhHostedQualificationRun, 31342472100);
  assert.equal(report.qualification.eleventhHostedQualificationResult,
    "FAILED_CLOSED_LEGACY_RELEASE_PROVENANCE_RETENTION_SUCCESSORS_UNCOMPOSED");
  assert.equal(report.qualification.releaseProvenanceRetentionCompositionTests,
    "21/21 PASS");
  assert.equal(report.qualification.focusedSuccessorVerification.dataCoordinatorTests, "121/121 PASS");
  assert.equal(report.qualification.focusedSuccessorVerification.intelligenceConsumerTests, "86/86 PASS");
  assert.equal(report.qualification.focusedSuccessorVerification.privateWorkflowV2Tests, "33/33 PASS");
  assert.equal(report.qualification.focusedSuccessorVerification.privateWorkflowGovernanceTests,
    "20/20 PASS");
  assert.equal(report.qualification.focusedSuccessorVerification
    .controlledRehearsalGovernanceTests, "14/14 PASS");
  assert.equal(report.qualification.focusedSuccessorVerification.offRouteLearningTests,
    "17/17 PASS");
  assert.equal(report.qualification.focusedSuccessorVerification
    .prospectiveRetentionCombinedTests, "56/56 PASS");
  assert.equal(report.qualification.exactFinalCommitHostedQualification,
    "EXACT_COMMIT_BOUND_WORKFLOW_REQUIRED_AND_FAIL_CLOSED");
  assert.equal(report.releaseBoundary.deploymentAuthorized, false);
  assert.equal(report.releaseBoundary.productionDeletionAuthorized, false);
  assert.equal(report.releaseBoundary.collectionActivationAuthorized, false);

  return Object.freeze({
    status: "PASS",
    batchId: governance.batchId,
    ownerCommitCount: Object.keys(ownerCommits).length,
    sourceRuntime: "COMPLETE_DORMANT",
    physicalDeletionActivated: false,
    productionStorageAccessed: false,
    productionDeletionPerformed: false,
    collection: "OFF",
    activeCohorts: 0,
    recommendationInfluence: "OFF",
    node24ActionPinStatus: node24Verification.status,
    historicalEvidence: "UNCHANGED",
    forwardRevert: "VERIFIED_NOT_EXECUTED"
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  console.log(JSON.stringify(verifyOverwatchRouteIqRetentionDeletionRuntime(), null, 2));
}
