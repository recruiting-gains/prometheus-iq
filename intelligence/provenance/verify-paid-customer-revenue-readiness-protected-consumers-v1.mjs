import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");

export const paidCustomerRevenueReadinessProtectedConsumersPath =
  "intelligence/provenance/protected-consumer-synchronization-paid-customer-revenue-readiness-v1.json";
const fullSystemHarmonyPath =
  "intelligence/provenance/protected-baseline-synchronization-full-system-harmony-v1.json";
const liveCanonicalIdentityPath =
  "intelligence/provenance/protected-baseline-synchronization-live-canonical-identity-v1.json";
const governedLearningAdvisoryPath =
  "intelligence/provenance/protected-baseline-synchronization-governed-multi-session-learning-advisory-v1.json";
const gymPreviewRuntimeSurfacePath =
  "intelligence/provenance/protected-baseline-synchronization-gym-preview-route-quality-runtime-surface-v1.json";
const dashboardPublicVisualIdentityPath =
  "intelligence/provenance/protected-baseline-synchronization-dashboard-public-visual-identity-v1.json";

function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function read(path) {
  return readFileSync(resolve(root, path));
}

function identity(ownerSubsystem) {
  if (ownerSubsystem === "Prometheus Dashboard") {
    return "Prometheus Dashboard <dashboard@prometheus.local>";
  }
  if (ownerSubsystem === "Prometheus Infrastructure") {
    return "Prometheus Infrastructure <infrastructure@prometheus.local>";
  }
  if (ownerSubsystem === "Prometheus Data") {
    return "Prometheus Data <data@prometheus.local>";
  }
  if (ownerSubsystem === "Prometheus Intelligence Engine") {
    return "Prometheus Intelligence Engine <intelligence@prometheus.local>";
  }
  throw new Error(`Unsupported protected-consumer owner: ${ownerSubsystem}`);
}

function git(args, encoding = null) {
  return execFileSync("/usr/bin/git", args, {
    cwd: root,
    encoding,
    maxBuffer: 20 * 1024 * 1024,
    stdio: ["ignore", "pipe", "ignore"]
  });
}

function verifyTransition(path, transition) {
  const expectedIdentity = identity(transition.ownerSubsystem);
  assert.deepEqual(
    git([
      "show", "-s", "--format=%H%n%T%n%an <%ae>%n%cn <%ce>%n%s", transition.commit
    ], "utf8").trim().split("\n"),
    [
      transition.commit,
      transition.tree,
      expectedIdentity,
      expectedIdentity,
      transition.subject
    ],
    `Protected successor identity changed: ${path}`
  );
  git(["merge-base", "--is-ancestor", transition.commit, "HEAD"]);
  assert.equal(
    sha256Bytes(git(["show", `${transition.commit}^:${path}`])),
    transition.previousSha256,
    `Protected successor predecessor changed: ${path}`
  );
  assert.equal(
    sha256Bytes(git(["show", `${transition.commit}:${path}`])),
    transition.currentSha256,
    `Protected successor content changed: ${path}`
  );
}

function verifyPredecessors(successor) {
  const predecessors = successor.predecessors
    || (successor.predecessor ? [successor.predecessor] : []);
  assert.ok(predecessors.length > 0, "Protected successor must name its predecessor.");
  for (const predecessor of predecessors) {
    const predecessorBytes = existsSync(resolve(root, predecessor.path))
      ? read(predecessor.path)
      : git(["show", `HEAD:${predecessor.path}`]);
    assert.equal(sha256Bytes(predecessorBytes), predecessor.sha256);
    assert.equal(predecessor.remainsHistorical, true);
    assert.equal(predecessor.rewritten, false);
  }
}

function verifyProtectedSuccessor({
  path,
  version,
  batchId,
  status = "OWNER_REVIEWED_PROTECTED_COHERENCE_SUCCESSOR",
  expectedPaths,
  predecessorTransitionsByPath = new Map(),
  composePredecessors = false,
  contractKey,
  contract,
  boundaries
}) {
  const successor = JSON.parse(read(path));
  assert.equal(successor.version, version);
  if (batchId) assert.equal(successor.batchId, batchId);
  assert.equal(successor.status, status);
  assert.equal(successor.ownerSubsystem, "Prometheus Intelligence Engine");
  verifyPredecessors(successor);

  const successorTransitionsByPath = new Map();
  for (const transition of successor.protectedSourceTransitions) {
    const localTransitions = successorTransitionsByPath.get(transition.path) || [];
    const prior = localTransitions.length > 0
      ? localTransitions
      : predecessorTransitionsByPath.get(transition.path) || [];
    if (prior.length > 0) {
      assert.equal(
        transition.previousSha256,
        prior.at(-1).currentSha256,
        `Broken protected successor chain: ${transition.path}`
      );
    }
    verifyTransition(transition.path, transition);
    successorTransitionsByPath.set(transition.path, [...localTransitions, transition]);
  }
  assert.deepEqual([...successorTransitionsByPath.keys()].sort(), [...expectedPaths].sort());
  assert.deepEqual(successor[contractKey], contract);
  assert.deepEqual(successor.boundaries || successor.protectedState, boundaries);

  const transitionsByPath = new Map();
  if (composePredecessors) {
    for (const [sourcePath, transitions] of predecessorTransitionsByPath) {
      transitionsByPath.set(sourcePath, [
        ...transitions,
        ...(successorTransitionsByPath.get(sourcePath) || [])
      ]);
    }
  }
  for (const [sourcePath, transitions] of successorTransitionsByPath) {
    if (!transitionsByPath.has(sourcePath)) transitionsByPath.set(sourcePath, transitions);
  }
  return Object.freeze({ successor, successorTransitionsByPath, transitionsByPath });
}

function readCurrentProtectedSuccessors(consumerByPath) {
  const consumerTransitionsByPath = new Map(
    [...consumerByPath].map(([path, consumer]) => [path, consumer.transitions])
  );
  const sharedBoundaries = {
    readinessState: "INSUFFICIENT_EVIDENCE",
    prospectiveCollection: "OFF",
    activeCohorts: 0,
    recommendationInfluence: "OFF",
    representativeShadowOutputExposed: false,
    deploymentPerformed: false,
    productionAccessPerformed: false,
    productionMutationPerformed: false
  };
  const fullSystemHarmonySuccessor = verifyProtectedSuccessor({
    path: fullSystemHarmonyPath,
    version: "route-iq-intelligence-full-system-harmony-protected-successor-v1",
    expectedPaths: [
      "deploy/cloudflare-pages/index.html",
      "index.html",
      "intelligence/continuous-adaptive-route-replenishment.mjs",
      "workers/prometheus-iq-worker.js"
    ],
    predecessorTransitionsByPath: consumerTransitionsByPath,
    composePredecessors: true,
    contractKey: "coherence",
    contract: {
      historicalRevenueReadinessEvidenceRewritten: false,
      successorCommitAndTreeVerified: true,
      successorOwnerIdentityVerified: true,
      sourceDeployParityRequired: true,
      intelligenceRuntimeChanged: true,
      recommendationInfluenceLockedOff: true,
      testOnlyInfluenceRequiresExactAuthorization: true,
      businessHoursEligibilityChanged: false
    },
    boundaries: sharedBoundaries
  });
  const liveCanonicalIdentityProtectedSuccessor = verifyProtectedSuccessor({
    path: liveCanonicalIdentityPath,
    version: "route-iq-intelligence-live-canonical-identity-protected-successor-v1",
    expectedPaths: [
      "data/route-iq-field-sessions-v1/route-iq-field-session-archive.mjs",
      "deploy/cloudflare-pages/index.html",
      "index.html"
    ],
    predecessorTransitionsByPath: fullSystemHarmonySuccessor.transitionsByPath,
    composePredecessors: true,
    contractKey: "coherence",
    contract: {
      historicalFullSystemHarmonyEvidenceRewritten: false,
      successorCommitAndTreeVerified: true,
      successorOwnerIdentityVerified: true,
      sourceDeployParityRequired: true,
      identityPresentationOnly: true,
      dataRecordCompatibilityOnly: true,
      intelligenceRuntimeChanged: false,
      routeOrderingChanged: false,
      routeScoringChanged: false,
      businessHoursEligibilityChanged: false
    },
    boundaries: sharedBoundaries
  });
  const governedLearningAdvisorySuccessor = verifyProtectedSuccessor({
    path: governedLearningAdvisoryPath,
    version: "route-iq-intelligence-governed-multi-session-learning-advisory-successor-v1",
    batchId: "BATCH-20260812-001",
    expectedPaths: [
      "dashboard/route-iq-dashboard-platform.mjs",
      "deploy/cloudflare-pages/index.html",
      "index.html",
      "intelligence/off-route-learning-intelligence.mjs",
      "intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs",
      "intelligence/read-only-field-session-learning.mjs",
      "workers/prometheus-iq-worker.js"
    ],
    predecessorTransitionsByPath: liveCanonicalIdentityProtectedSuccessor.transitionsByPath,
    contractKey: "behavior",
    contract: {
      accumulatedLearningAdded: true,
      existingLearningEnginesReused: true,
      customerGraphSnapshotReused: true,
      founderAdvisoryOnly: true,
      routeOrderingChanged: false,
      routeScoringChanged: false,
      activePoolSelectionChanged: false,
      adaptiveReplenishmentChanged: false,
      businessHoursEligibilityChanged: false,
      recommendationOutputChanged: false
    },
    boundaries: {
      prospectiveCollection: "OFF",
      activeCohorts: 0,
      recommendationInfluence: "OFF",
      confidencePropagation: "OFF",
      providers: "OFF",
      scheduler: "OFF",
      productionStorageAccess: 0,
      cloudflareContacts: 0,
      deployments: 0,
      representativeShadowOutputExposed: false,
      productionMutationPerformed: false
    }
  });
  const gymPreviewRuntimeSurfaceSuccessor = verifyProtectedSuccessor({
    path: gymPreviewRuntimeSurfacePath,
    version: "route-iq-intelligence-gym-preview-route-quality-runtime-surface-successor-v1",
    batchId: "BATCH-20260814-002",
    status: "OWNER_IMPLEMENTED_PROTECTED_SUCCESSOR",
    expectedPaths: [
      "intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs",
      "scripts/lib/route-intelligence-quality-gate.mjs",
      "tests/route-iq-intelligence-controlled-rehearsal-smoke-contract-successor.test.mjs"
    ],
    contractKey: "behavior",
    contract: {
      previousRuntimeFileCount: 33,
      currentRuntimeFileCount: 34,
      addedRuntimeFile: "src/route-iq-gym-request-form.js",
      liveGoogleApiCalls: 0,
      dashboardFetches: 6,
      routeOrderingChanged: false,
      routeScoringChanged: false,
      businessHoursEligibilityChanged: false
    },
    boundaries: {
      collection: "OFF",
      activeCohorts: 0,
      recommendationInfluence: "OFF",
      confidencePropagation: "OFF",
      providers: "OFF",
      scheduler: "OFF",
      shadowDecisionVisible: false,
      productionStorageAccess: 0,
      cloudflareContacts: 0,
      deployments: 0,
      productionMutationPerformed: false
    }
  });
  const visualPredecessorTransitionsByPath = new Map([
    ...governedLearningAdvisorySuccessor.transitionsByPath,
    ...gymPreviewRuntimeSurfaceSuccessor.transitionsByPath
  ]);
  const dashboardPublicVisualIdentitySuccessor = verifyProtectedSuccessor({
    path: dashboardPublicVisualIdentityPath,
    version: "route-iq-intelligence-dashboard-public-visual-identity-successor-v1",
    batchId: "BATCH-20260815-001",
    expectedPaths: [
      "deploy/cloudflare-pages/index.html",
      "index.html",
      "intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs"
    ],
    predecessorTransitionsByPath: visualPredecessorTransitionsByPath,
    contractKey: "behavior",
    contract: {
      publicNavigationRemainsInsidePublicRoutes: true,
      dashboardVisualIdentityAligned: true,
      dashboardWorkflowChanged: false,
      intelligenceRuntimeChanged: false,
      routeOrderingChanged: false,
      routeScoringChanged: false,
      businessHoursEligibilityChanged: false,
      recommendationBehaviorChanged: false
    },
    boundaries: {
      collection: "OFF",
      activeCohorts: 0,
      recommendationInfluence: "OFF",
      confidencePropagation: "OFF",
      providers: "OFF",
      scheduler: "OFF",
      productionStorageAccess: 0,
      deployments: 0,
      productionMutationPerformed: false
    }
  });
  return Object.freeze({
    fullSystemHarmonySuccessor,
    liveCanonicalIdentityProtectedSuccessor,
    governedLearningAdvisorySuccessor,
    dashboardPublicVisualIdentitySuccessor
  });
}

export function verifyPaidCustomerRevenueReadinessProtectedConsumers({
  evidence: suppliedEvidence,
  currentSha256ByPath = {}
} = {}) {
  const evidence = suppliedEvidence || JSON.parse(read(paidCustomerRevenueReadinessProtectedConsumersPath));
  const composeCurrentSuccessor =
    suppliedEvidence === undefined && Object.keys(currentSha256ByPath).length === 0;
  assert.equal(
    evidence.version,
    "route-iq-intelligence-paid-customer-revenue-readiness-protected-consumers-v1"
  );
  assert.equal(evidence.status, "OWNER_REVIEWED_PROTECTED_CONSUMER_SUCCESSOR");
  assert.equal(evidence.ownerSubsystem, "Prometheus Intelligence Engine");
  assert.equal(sha256Bytes(read(evidence.predecessor.path)), evidence.predecessor.sha256);
  assert.equal(evidence.predecessor.remainsHistorical, true);
  assert.equal(evidence.predecessor.rewritten, false);
  assert.equal(evidence.protectedConsumers.length, 2);

  const consumerByPath = new Map();
  for (const consumer of evidence.protectedConsumers) {
    assert.ok(!consumerByPath.has(consumer.path), `Duplicate protected consumer: ${consumer.path}`);
    assert.equal(consumer.transitions[0].previousSha256, consumer.previousSha256);
    assert.equal(consumer.transitions.at(-1).currentSha256, consumer.currentSha256);
    for (let index = 0; index < consumer.transitions.length; index += 1) {
      const transition = consumer.transitions[index];
      if (index > 0) {
        assert.equal(transition.previousSha256, consumer.transitions[index - 1].currentSha256);
      }
      const expectedIdentity = identity(transition.ownerSubsystem);
      assert.deepEqual(
        git([
          "show", "-s", "--format=%H%n%T%n%an <%ae>%n%cn <%ce>%n%s", transition.commit
        ], "utf8").trim().split("\n"),
        [
          transition.commit,
          transition.tree,
          expectedIdentity,
          expectedIdentity,
          transition.subject
        ]
      );
      assert.equal(
        sha256Bytes(git(["show", `${transition.commit}^:${consumer.path}`])),
        transition.previousSha256
      );
      assert.equal(
        sha256Bytes(git(["show", `${transition.commit}:${consumer.path}`])),
        transition.currentSha256
      );
    }
    consumerByPath.set(consumer.path, consumer);
  }
  assert.deepEqual(
    [...consumerByPath.keys()].sort(),
    ["deploy/cloudflare-pages/index.html", "index.html"]
  );
  assert.equal(
    consumerByPath.get("index.html").currentSha256,
    consumerByPath.get("deploy/cloudflare-pages/index.html").currentSha256
  );
  assert.deepEqual(evidence.invariants, {
    historicalBaselineRewritten: false,
    sourceDeployParityRequired: true,
    intelligenceRuntimeChanged: false,
    routeOrderingChanged: false,
    routeScoringChanged: false,
    prospectiveCollection: "OFF",
    activeCohorts: 0,
    recommendationInfluence: "OFF",
    representativeShadowOutputExposed: false
  });

  if (!composeCurrentSuccessor) {
    for (const consumer of consumerByPath.values()) {
      const currentSha256 = currentSha256ByPath[consumer.path] || sha256Bytes(read(consumer.path));
      assert.equal(currentSha256, consumer.currentSha256, `Protected consumer drifted: ${consumer.path}`);
    }
    return Object.freeze({ evidence, consumerByPath });
  }

  const {
    fullSystemHarmonySuccessor,
    liveCanonicalIdentityProtectedSuccessor,
    governedLearningAdvisorySuccessor,
    dashboardPublicVisualIdentitySuccessor
  } = readCurrentProtectedSuccessors(consumerByPath);
  const composedConsumerByPath = new Map();
  for (const consumer of consumerByPath.values()) {
    const liveTransitions =
      liveCanonicalIdentityProtectedSuccessor.transitionsByPath.get(consumer.path);
    assert.ok(liveTransitions,
      `Missing current protected-consumer successor: ${consumer.path}`);
    assert.deepEqual(
      liveTransitions.slice(0, consumer.transitions.length).map(({
        ownerSubsystem,
        commit,
        tree,
        subject,
        previousSha256,
        currentSha256
      }) => ({
        ownerSubsystem,
        commit,
        tree,
        subject,
        previousSha256,
        currentSha256
      })),
      consumer.transitions,
      `Historical protected-consumer transition changed: ${consumer.path}`
    );
    const transitions = [...liveTransitions];
    for (const [label, successorTransitions] of [
      ["governed-learning", governedLearningAdvisorySuccessor.transitionsByPath],
      ["dashboard-visual", dashboardPublicVisualIdentitySuccessor.transitionsByPath]
    ]) {
      const candidates = successorTransitions.get(consumer.path) || [];
      const currentSha256 = transitions.at(-1).currentSha256;
      const overlap = candidates.findIndex(
        transition => transition.currentSha256 === currentSha256
      );
      const remainingTransitions = overlap >= 0
        ? candidates.slice(overlap + 1)
        : candidates;
      if (remainingTransitions.length > 0) {
        assert.equal(
          remainingTransitions[0].previousSha256,
          currentSha256,
          `Broken ${label} protected-consumer chain: ${consumer.path}`
        );
        transitions.push(...remainingTransitions);
      }
    }
    const currentSha256 = transitions.at(-1).currentSha256;
    assert.equal(
      sha256Bytes(read(consumer.path)),
      currentSha256,
      `Protected consumer drifted: ${consumer.path}`
    );
    composedConsumerByPath.set(consumer.path, Object.freeze({
      ...consumer,
      currentSha256,
      transitions: Object.freeze([...transitions])
    }));
  }
  return Object.freeze({
    evidence,
    consumerByPath: composedConsumerByPath,
    fullSystemHarmonySuccessor,
    liveCanonicalIdentityProtectedSuccessor,
    governedLearningAdvisorySuccessor,
    dashboardPublicVisualIdentitySuccessor
  });
}
