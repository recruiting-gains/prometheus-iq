import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");

export const crossIndustryZipFounderAccessProvenancePath =
  "intelligence/provenance/protected-baseline-synchronization-cross-industry-zip-founder-access-v1.json";
export const controlledOnboardingRehearsalSmokeContractProvenancePath =
  "intelligence/provenance/protected-baseline-synchronization-controlled-onboarding-rehearsal-smoke-contract-v1.json";
export const paidCustomerRevenueReadinessWorkerProvenancePath =
  "intelligence/provenance/protected-baseline-synchronization-paid-customer-revenue-readiness-worker-v1.json";
export const fullSystemHarmonyProtectedSuccessorProvenancePath =
  "intelligence/provenance/protected-baseline-synchronization-full-system-harmony-v1.json";
export const liveCanonicalIdentityProtectedSuccessorProvenancePath =
  "intelligence/provenance/protected-baseline-synchronization-live-canonical-identity-v1.json";
export const fieldSessionReportTypeContractProtectedSuccessorProvenancePath =
  "intelligence/provenance/protected-baseline-synchronization-field-session-report-type-contract-v1.json";
export const retentionDeletionRuntimeProtectedSuccessorProvenancePath =
  "intelligence/provenance/protected-baseline-synchronization-retention-deletion-runtime-v1.json";
export const retentionDeletionConsumerAdmissionSuccessorProvenancePath =
  "intelligence/provenance/protected-baseline-synchronization-retention-deletion-consumer-admission-v1.json";
export const retentionMaintenanceConsumerAdmissionSuccessorProvenancePath =
  "intelligence/provenance/protected-baseline-synchronization-retention-maintenance-consumer-admission-v1.json";
export const governedMultiSessionLearningAdvisorySuccessorProvenancePath =
  "intelligence/provenance/protected-baseline-synchronization-governed-multi-session-learning-advisory-v1.json";
const crossIndustryDashboardRetentionProvenancePath =
  "intelligence/provenance/protected-baseline-synchronization-cross-industry-dashboard-retention-successor-v1.json";

function read(path) {
  return readFileSync(resolve(root, path));
}

function sha256(path) {
  return createHash("sha256").update(read(path)).digest("hex");
}

function hashBytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function git(args, encoding = "utf8") {
  return execFileSync("/usr/bin/git", args, {
    cwd: root,
    encoding,
    maxBuffer: 8 * 1024 * 1024,
    stdio: ["ignore", "pipe", "ignore"]
  });
}

function expectedIdentity(ownerSubsystem) {
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
  throw new Error(`Unsupported protected source owner: ${ownerSubsystem}`);
}

function verifyTransition(path, transition) {
  const identity = expectedIdentity(transition.ownerSubsystem);
  const fields = git([
    "show", "-s", "--format=%H%n%T%n%an <%ae>%n%cn <%ce>%n%s", transition.commit
  ]).trim().split("\n");
  assert.deepEqual(fields, [
    transition.commit,
    transition.tree,
    identity,
    identity,
    transition.subject
  ], `Protected ZIP/Founder source identity changed: ${path}`);
  execFileSync("/usr/bin/git", ["merge-base", "--is-ancestor", transition.commit, "HEAD"], {
    cwd: root,
    stdio: "ignore"
  });
  assert.equal(
    hashBytes(git(["show", `${transition.commit}^:${path}`], null)),
    transition.previousSha256,
    `Protected ZIP/Founder predecessor changed: ${path}`
  );
  assert.equal(
    hashBytes(git(["show", `${transition.commit}:${path}`], null)),
    transition.currentSha256,
    `Protected ZIP/Founder successor changed: ${path}`
  );
}

function readRetentionMaintenanceTransitionsByPath() {
  const successor = JSON.parse(
    read(retentionMaintenanceConsumerAdmissionSuccessorProvenancePath)
  );
  const transitionsByPath = new Map();
  for (const transition of [
    ...successor.protectedSourceTransitions,
    ...(successor.coherenceSourceTransition
      ? [successor.coherenceSourceTransition]
      : [])
  ]) {
    const transitions = transitionsByPath.get(transition.path) || [];
    transitions.push(transition);
    transitionsByPath.set(transition.path, transitions);
  }
  return transitionsByPath;
}

function readGovernedMultiSessionLearningAdvisorySuccessor() {
  const successor = JSON.parse(
    read(governedMultiSessionLearningAdvisorySuccessorProvenancePath)
  );
  assert.equal(
    successor.version,
    "route-iq-intelligence-governed-multi-session-learning-advisory-successor-v1"
  );
  assert.equal(successor.batchId, "BATCH-20260812-001");
  assert.equal(successor.status, "OWNER_REVIEWED_PROTECTED_COHERENCE_SUCCESSOR");
  assert.equal(successor.ownerSubsystem, "Prometheus Intelligence Engine");
  assert.equal(
    successor.predecessor.path,
    retentionMaintenanceConsumerAdmissionSuccessorProvenancePath
  );
  assert.equal(sha256(successor.predecessor.path), successor.predecessor.sha256);
  assert.equal(successor.predecessor.remainsHistorical, true);
  assert.equal(successor.predecessor.rewritten, false);

  const transitionsByPath = new Map();
  for (const transition of successor.protectedSourceTransitions) {
    const transitions = transitionsByPath.get(transition.path) || [];
    if (transitions.length > 0) {
      assert.equal(
        transition.previousSha256,
        transitions.at(-1).currentSha256,
        `Broken governed-learning advisory transition chain: ${transition.path}`
      );
    }
    verifyTransition(transition.path, transition);
    transitions.push(transition);
    transitionsByPath.set(transition.path, transitions);
  }
  assert.deepEqual(
    [...transitionsByPath.keys()].sort(),
    [
      "dashboard/route-iq-dashboard-platform.mjs",
      "deploy/cloudflare-pages/index.html",
      "index.html",
      "intelligence/off-route-learning-intelligence.mjs",
      "intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs",
      "intelligence/read-only-field-session-learning.mjs",
      "workers/prometheus-iq-worker.js"
    ]
  );
  assert.deepEqual(successor.behavior, {
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
  });
  assert.deepEqual(successor.boundaries, {
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
  });
  return Object.freeze({ successor, transitionsByPath });
}

function mergeTransitionMaps(...maps) {
  const merged = new Map();
  for (const transitionsByPath of maps) {
    for (const [path, transitions] of transitionsByPath) {
      merged.set(path, [...(merged.get(path) || []), ...transitions]);
    }
  }
  return merged;
}

function verifyPaidCustomerRevenueReadinessWorkerSuccessorAgainst(
  rehearsalSuccessor,
  rehearsalTransitionByPath,
  historical
) {
  const successor = JSON.parse(read(paidCustomerRevenueReadinessWorkerProvenancePath));
  const rehearsalWorker = rehearsalTransitionByPath.get("workers/prometheus-iq-worker.js");
  assert.equal(
    successor.version,
    "route-iq-intelligence-paid-customer-revenue-readiness-worker-successor-v1"
  );
  assert.equal(successor.status, "OWNER_REVIEWED_PROTECTED_COHERENCE_SUCCESSOR");
  assert.equal(successor.ownerSubsystem, "Prometheus Intelligence Engine");
  assert.equal(
    successor.predecessor.path,
    controlledOnboardingRehearsalSmokeContractProvenancePath
  );
  assert.equal(
    sha256(successor.predecessor.path),
    successor.predecessor.sha256,
    "Historical controlled-rehearsal Intelligence provenance changed."
  );
  assert.equal(successor.predecessor.remainsHistorical, true);
  assert.equal(successor.predecessor.rewritten, false);
  assert.equal(successor.protectedSourceTransitions.length, 6);
  const transitionsByPath = new Map();
  for (const transition of successor.protectedSourceTransitions) {
    const transitions = transitionsByPath.get(transition.path) || [];
    if (transitions.length > 0) {
      assert.equal(
        transition.previousSha256,
        transitions.at(-1).currentSha256,
        `Broken paid-customer revenue-readiness transition chain: ${transition.path}`
      );
    }
    verifyTransition(transition.path, transition);
    transitions.push(transition);
    transitionsByPath.set(transition.path, transitions);
  }
  assert.deepEqual(
    [...transitionsByPath.keys()].sort(),
    [
      "deploy/cloudflare-pages/index.html",
      "index.html",
      "scripts/lib/route-intelligence-quality-gate.mjs",
      "workers/prometheus-iq-worker.js"
    ]
  );
  for (const path of ["index.html", "deploy/cloudflare-pages/index.html"]) {
    const historicalSource = historical.protectedBaselineSuccessors.find(
      entry => entry.path === path
    );
    assert.equal(
      transitionsByPath.get(path)[0].previousSha256,
      historicalSource.currentSha256
    );
  }
  assert.equal(
    transitionsByPath.get("workers/prometheus-iq-worker.js")[0].previousSha256,
    rehearsalWorker.currentSha256
  );
  const historicalRouteQuality = historical.intelligenceRuntimeIntegrity.artifacts.find(
    entry => entry.path === "scripts/lib/route-intelligence-quality-gate.mjs"
  );
  assert.equal(
    transitionsByPath.get("scripts/lib/route-intelligence-quality-gate.mjs")[0]
      .previousSha256,
    historicalRouteQuality.sha256
  );
  assert.deepEqual(successor.coherence, {
    historicalControlledRehearsalEvidenceRewritten: false,
    successorCommitAndTreeVerified: true,
    successorOwnerIdentityVerified: true,
    revenueReadinessSurfaceOnly: true,
    intelligenceRuntimeChanged: false,
    routeOrderingChanged: false,
    routeScoringChanged: false,
    businessHoursEligibilityChanged: false
  });
  assert.deepEqual(successor.boundaries, rehearsalSuccessor.boundaries);
  return Object.freeze({ successor, transitionsByPath });
}

function verifyFullSystemHarmonyProtectedSuccessorAgainst(
  revenueReadinessSuccessor,
  historical
) {
  const successor = JSON.parse(read(fullSystemHarmonyProtectedSuccessorProvenancePath));
  assert.equal(
    successor.version,
    "route-iq-intelligence-full-system-harmony-protected-successor-v1"
  );
  assert.equal(successor.status, "OWNER_REVIEWED_PROTECTED_COHERENCE_SUCCESSOR");
  assert.equal(successor.ownerSubsystem, "Prometheus Intelligence Engine");
  assert.equal(
    successor.predecessor.path,
    paidCustomerRevenueReadinessWorkerProvenancePath
  );
  assert.equal(
    sha256(successor.predecessor.path),
    successor.predecessor.sha256,
    "Historical paid-customer revenue-readiness Intelligence provenance changed."
  );
  assert.equal(successor.predecessor.remainsHistorical, true);
  assert.equal(successor.predecessor.rewritten, false);
  assert.equal(successor.protectedSourceTransitions.length, 4);

  const successorTransitionsByPath = new Map();
  for (const transition of successor.protectedSourceTransitions) {
    assert.ok(
      !successorTransitionsByPath.has(transition.path),
      `Duplicate Full-System Harmony protected path: ${transition.path}`
    );
    const predecessorTransitions = revenueReadinessSuccessor.transitionsByPath
      .get(transition.path);
    if (predecessorTransitions) {
      assert.equal(
        transition.previousSha256,
        predecessorTransitions.at(-1).currentSha256,
        `Broken Full-System Harmony transition chain: ${transition.path}`
      );
    } else {
      const historicalRuntime = historical.intelligenceRuntimeIntegrity.artifacts
        .find(entry => entry.path === transition.path);
      assert.equal(
        transition.previousSha256,
        historicalRuntime?.sha256,
        `Missing Full-System Harmony historical runtime predecessor: ${transition.path}`
      );
    }
    verifyTransition(transition.path, transition);
    successorTransitionsByPath.set(transition.path, [transition]);
  }
  assert.deepEqual(
    [...successorTransitionsByPath.keys()].sort(),
    [
      "deploy/cloudflare-pages/index.html",
      "index.html",
      "intelligence/continuous-adaptive-route-replenishment.mjs",
      "workers/prometheus-iq-worker.js"
    ]
  );

  const transitionsByPath = new Map();
  for (const [path, transitions] of revenueReadinessSuccessor.transitionsByPath) {
    transitionsByPath.set(path, [
      ...transitions,
      ...(successorTransitionsByPath.get(path) || [])
    ]);
  }
  for (const [path, transitions] of successorTransitionsByPath) {
    if (!transitionsByPath.has(path)) transitionsByPath.set(path, transitions);
  }
  assert.deepEqual(successor.coherence, {
    historicalRevenueReadinessEvidenceRewritten: false,
    successorCommitAndTreeVerified: true,
    successorOwnerIdentityVerified: true,
    sourceDeployParityRequired: true,
    intelligenceRuntimeChanged: true,
    recommendationInfluenceLockedOff: true,
    testOnlyInfluenceRequiresExactAuthorization: true,
    businessHoursEligibilityChanged: false
  });
  assert.deepEqual(
    successor.boundaries,
    revenueReadinessSuccessor.successor.boundaries
  );
  return Object.freeze({
    successor,
    successorTransitionsByPath,
    transitionsByPath
  });
}

function verifyLiveCanonicalIdentityProtectedSuccessorAgainst(
  fullSystemHarmonySuccessor
) {
  const successor = JSON.parse(
    read(liveCanonicalIdentityProtectedSuccessorProvenancePath)
  );
  assert.equal(
    successor.version,
    "route-iq-intelligence-live-canonical-identity-protected-successor-v1"
  );
  assert.equal(successor.status, "OWNER_REVIEWED_PROTECTED_COHERENCE_SUCCESSOR");
  assert.equal(successor.ownerSubsystem, "Prometheus Intelligence Engine");
  assert.equal(
    successor.predecessor.path,
    fullSystemHarmonyProtectedSuccessorProvenancePath
  );
  assert.equal(
    sha256(successor.predecessor.path),
    successor.predecessor.sha256,
    "Historical Full-System Harmony Intelligence provenance changed."
  );
  assert.equal(successor.predecessor.remainsHistorical, true);
  assert.equal(successor.predecessor.rewritten, false);
  assert.equal(successor.protectedSourceTransitions.length, 3);
  const crossIndustryDashboardRetention = JSON.parse(
    read(crossIndustryDashboardRetentionProvenancePath)
  );

  const successorTransitionsByPath = new Map();
  for (const transition of successor.protectedSourceTransitions) {
    assert.ok(
      !successorTransitionsByPath.has(transition.path),
      `Duplicate live canonical identity protected path: ${transition.path}`
    );
    const predecessorTransitions = fullSystemHarmonySuccessor.transitionsByPath
      .get(transition.path);
    if (predecessorTransitions) {
      assert.equal(
        transition.previousSha256,
        predecessorTransitions.at(-1).currentSha256,
        `Broken live canonical identity transition chain: ${transition.path}`
      );
    } else {
      assert.equal(
        transition.path,
        "data/route-iq-field-sessions-v1/route-iq-field-session-archive.mjs",
        `Missing live canonical identity predecessor: ${transition.path}`
      );
      assert.equal(
        transition.previousSha256,
        crossIndustryDashboardRetention.dataOwnerTransition.archiveRuntime.currentSha256,
        `Broken live canonical Data transition chain: ${transition.path}`
      );
    }
    verifyTransition(transition.path, transition);
    successorTransitionsByPath.set(transition.path, [transition]);
  }
  assert.deepEqual(
    [...successorTransitionsByPath.keys()].sort(),
    [
      "data/route-iq-field-sessions-v1/route-iq-field-session-archive.mjs",
      "deploy/cloudflare-pages/index.html",
      "index.html"
    ]
  );

  const transitionsByPath = new Map();
  for (const [path, transitions] of fullSystemHarmonySuccessor.transitionsByPath) {
    transitionsByPath.set(path, [
      ...transitions,
      ...(successorTransitionsByPath.get(path) || [])
    ]);
  }
  for (const [path, transitions] of successorTransitionsByPath) {
    if (!transitionsByPath.has(path)) transitionsByPath.set(path, transitions);
  }
  assert.deepEqual(successor.coherence, {
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
  });
  assert.deepEqual(
    successor.boundaries,
    fullSystemHarmonySuccessor.successor.boundaries
  );
  return Object.freeze({
    successor,
    successorTransitionsByPath,
    transitionsByPath
  });
}

function verifyFieldSessionReportTypeContractProtectedSuccessorAgainst(
  liveCanonicalIdentitySuccessor
) {
  const successor = JSON.parse(
    read(fieldSessionReportTypeContractProtectedSuccessorProvenancePath)
  );
  assert.equal(
    successor.version,
    "route-iq-intelligence-field-session-report-type-contract-successor-v1"
  );
  assert.equal(successor.status, "OWNER_REVIEWED_PROTECTED_COHERENCE_SUCCESSOR");
  assert.equal(successor.ownerSubsystem, "Prometheus Intelligence Engine");
  assert.equal(
    successor.predecessor.path,
    liveCanonicalIdentityProtectedSuccessorProvenancePath
  );
  assert.equal(
    sha256(successor.predecessor.path),
    successor.predecessor.sha256,
    "Historical live canonical identity Intelligence provenance changed."
  );
  assert.equal(successor.predecessor.remainsHistorical, true);
  assert.equal(successor.predecessor.rewritten, false);
  assert.equal(successor.protectedSourceTransitions.length, 3);

  const successorTransitionsByPath = new Map();
  for (const transition of successor.protectedSourceTransitions) {
    assert.ok(
      !successorTransitionsByPath.has(transition.path),
      `Duplicate field-session report-type protected path: ${transition.path}`
    );
    const predecessorTransitions = liveCanonicalIdentitySuccessor.transitionsByPath
      .get(transition.path);
    if (predecessorTransitions) {
      assert.equal(
        transition.previousSha256,
        predecessorTransitions.at(-1).currentSha256,
        `Broken field-session report-type transition chain: ${transition.path}`
      );
    }
    verifyTransition(transition.path, transition);
    successorTransitionsByPath.set(transition.path, [transition]);
  }
  assert.deepEqual(
    [...successorTransitionsByPath.keys()].sort(),
    [
      "data/route-iq-field-sessions-v1/route-iq-field-session-archive.mjs",
      "tests/dashboard-route-iq-field-session-producer.test.mjs",
      "tests/route-iq-field-session-archive.test.mjs"
    ]
  );

  const transitionsByPath = new Map();
  for (const [path, transitions] of liveCanonicalIdentitySuccessor.transitionsByPath) {
    transitionsByPath.set(path, [
      ...transitions,
      ...(successorTransitionsByPath.get(path) || [])
    ]);
  }
  for (const [path, transitions] of successorTransitionsByPath) {
    if (!transitionsByPath.has(path)) transitionsByPath.set(path, transitions);
  }
  assert.equal(
    sha256("index.html"),
    sha256("deploy/cloudflare-pages/index.html"),
    "Field-session repair changed Dashboard source/deploy parity."
  );
  assert.deepEqual(successor.reportTypeContract, {
    canonical: "route-iq-daily-representative-report-v1",
    legacy: "beta-daily-rep-report",
    exactAllowlist: [
      "route-iq-daily-representative-report-v1",
      "beta-daily-rep-report"
    ],
    preserveReceivedSourceReportType: true,
    normalizeLegacyIdentifier: false,
    unknownTypesFailClosed: true
  });
  assert.equal(successor.archiveEvidencePreservation.length, 6);
  for (const artifact of successor.archiveEvidencePreservation) {
    assert.equal(
      sha256(artifact.path),
      artifact.sha256,
      `Historical field-session evidence changed: ${artifact.path}`
    );
  }
  assert.deepEqual(successor.coherence, {
    historicalLiveCanonicalEvidenceRewritten: false,
    successorCommitAndTreeVerified: true,
    successorOwnerIdentityVerified: true,
    dashboardProducerContractDerived: true,
    rawEvidenceRewritten: false,
    deterministicSessionIdentityChanged: false,
    retentionSemanticsChanged: false,
    intelligenceRuntimeChanged: false,
    routeOrderingChanged: false,
    routeScoringChanged: false,
    businessHoursEligibilityChanged: false
  });
  assert.deepEqual(successor.boundaries, {
    prospectiveCollection: "OFF",
    activeCohorts: 0,
    recommendationInfluence: "OFF",
    canonicalProspectiveRecords: 0,
    canonicalProspectiveEvaluations: 0,
    providers: "OFF",
    scheduler: "OFF",
    companion: "DORMANT",
    anthonyMapped: false,
    stripeMode: "NON_LIVE",
    dashboardBehaviorChanged: false,
    deploymentPerformed: false,
    productionAccessPerformed: false,
    productionMutationPerformed: false
  });
  return Object.freeze({
    successor,
    successorTransitionsByPath,
    transitionsByPath
  });
}

function verifyRetentionDeletionRuntimeProtectedSuccessorAgainst(
  fieldSessionReportTypeSuccessor,
  laterTransitionsByPath = new Map()
) {
  const successor = JSON.parse(
    read(retentionDeletionRuntimeProtectedSuccessorProvenancePath)
  );
  assert.equal(
    successor.version,
    "route-iq-intelligence-retention-deletion-runtime-successor-v1"
  );
  assert.equal(successor.status, "OWNER_REVIEWED_PROTECTED_COHERENCE_SUCCESSOR");
  assert.equal(successor.ownerSubsystem, "Prometheus Intelligence Engine");
  assert.equal(
    successor.predecessor.path,
    fieldSessionReportTypeContractProtectedSuccessorProvenancePath
  );
  assert.equal(
    sha256(successor.predecessor.path),
    successor.predecessor.sha256,
    "Historical field-session report-type Intelligence provenance changed."
  );
  assert.equal(successor.predecessor.remainsHistorical, true);
  assert.equal(successor.predecessor.rewritten, false);
  assert.equal(successor.protectedSourceTransitions.length, 8);

  const successorTransitionsByPath = new Map();
  for (const transition of successor.protectedSourceTransitions) {
    assert.ok(
      !successorTransitionsByPath.has(transition.path),
      `Duplicate retention-deletion protected path: ${transition.path}`
    );
    const predecessorTransitions = fieldSessionReportTypeSuccessor.transitionsByPath
      .get(transition.path);
    if (predecessorTransitions) {
      assert.equal(
        transition.previousSha256,
        predecessorTransitions.at(-1).currentSha256,
        `Broken retention-deletion transition chain: ${transition.path}`
      );
    }
    verifyTransition(transition.path, transition);
    successorTransitionsByPath.set(transition.path, [transition]);
  }
  assert.deepEqual(
    [...successorTransitionsByPath.keys()].sort(),
    [
      "data/route-iq-field-sessions-v1/route-iq-field-session-archive.mjs",
      "intelligence/contracts/off-route-learning-intelligence-contracts.json",
      "intelligence/contracts/read-only-field-session-learning-contracts.json",
      "intelligence/contracts/shadow-decision-readiness-contracts.json",
      "intelligence/provenance/specifications/prospective-retention-admission-v1.json",
      "intelligence/route-iq-prospective-retention-admission.mjs",
      "scripts/validate-intelligence-architecture.mjs",
      "scripts/verify-route-iq-prospective-retention-intelligence.mjs"
    ]
  );
  const transitionsByPath = new Map();
  for (const [path, transitions] of fieldSessionReportTypeSuccessor.transitionsByPath) {
    transitionsByPath.set(path, [
      ...transitions,
      ...(successorTransitionsByPath.get(path) || [])
    ]);
  }
  for (const [path, transitions] of successorTransitionsByPath) {
    if (!transitionsByPath.has(path)) transitionsByPath.set(path, transitions);
  }
  for (const [path, transitions] of transitionsByPath) {
    const laterTransitions = laterTransitionsByPath.get(path) || [];
    assert.equal(
      sha256(path),
      laterTransitions.at(-1)?.currentSha256 || transitions.at(-1).currentSha256,
      `Current retention-deletion protected source changed: ${path}`
    );
  }
  assert.deepEqual(
    successor.reportTypeContract,
    fieldSessionReportTypeSuccessor.successor.reportTypeContract
  );
  assert.deepEqual(successor.coherence, {
    historicalFieldSessionReportTypeEvidenceRewritten: false,
    successorCommitAndTreeVerified: true,
    successorOwnerIdentityVerified: true,
    archiveReportTypeContractChanged: false,
    rawEvidenceRewritten: false,
    deletionTombstoneBehaviorAdded: true,
    retentionSemanticsImplemented: true,
    intelligenceRuntimeChanged: false,
    routeOrderingChanged: false,
    routeScoringChanged: false,
    businessHoursEligibilityChanged: false
  });
  assert.deepEqual(
    successor.boundaries,
    fieldSessionReportTypeSuccessor.successor.boundaries
  );
  return Object.freeze({
    successor,
    successorTransitionsByPath,
    transitionsByPath
  });
}

function verifyRetentionDeletionConsumerAdmissionSuccessorAgainst(
  retentionDeletionRuntimeSuccessor,
  laterTransitionsByPath = new Map()
) {
  const successor = JSON.parse(
    read(retentionDeletionConsumerAdmissionSuccessorProvenancePath)
  );
  assert.equal(
    successor.version,
    "route-iq-intelligence-retention-deletion-consumer-admission-successor-v1"
  );
  assert.equal(successor.status, "OWNER_REVIEWED_PROTECTED_COHERENCE_SUCCESSOR");
  assert.equal(successor.ownerSubsystem, "Prometheus Intelligence Engine");
  assert.equal(
    successor.predecessor.path,
    retentionDeletionRuntimeProtectedSuccessorProvenancePath
  );
  assert.equal(
    sha256(successor.predecessor.path),
    successor.predecessor.sha256,
    "Historical retention-deletion Intelligence provenance changed."
  );
  assert.equal(successor.predecessor.remainsHistorical, true);
  assert.equal(successor.predecessor.rewritten, false);
  assert.deepEqual(successor.implementation, {
    commit: "d2ed353722b8c99f786306d7bbb37f21349ec3a5",
    tree: "ad140ba5e4e7b1b1131d33afc9ba0618fa059d12",
    subject: "fix(intelligence): admit dormant retention deletion state",
    ownerSubsystem: "Prometheus Intelligence Engine"
  });
  assert.deepEqual(successor.coherenceImplementation, {
    commit: "f37a1e16a73d89c57fb988c53c472a570fdbc15f",
    tree: "d734e6e235174d870d3c82c5c78e1edcdc1cc74b",
    subject: "fix(intelligence): compose retention data successor",
    ownerSubsystem: "Prometheus Intelligence Engine"
  });
  assert.deepEqual(successor.negativeFixtureImplementation, {
    commit: "61418a67b6df3e482b52a1fa6f7fc6757147dda0",
    tree: "4ef07a81196fa1ff6aedcbd309cc34298610d575",
    subject: "test(intelligence): retain successor drift rejection",
    ownerSubsystem: "Prometheus Intelligence Engine"
  });

  const expectedPaths = [
    "intelligence/read-only-field-session-learning.mjs",
    "scripts/verify-shadow-decision-readiness.mjs",
    "tests/read-only-field-session-learning.test.mjs",
    "tests/shadow-decision-readiness.test.mjs"
  ];
  assert.deepEqual(
    git(["diff-tree", "--no-commit-id", "--name-only", "-r", successor.implementation.commit])
      .trim().split("\n").filter(Boolean).sort(),
    [...expectedPaths].sort(),
    "Retention-deletion Intelligence consumer commit scope changed."
  );
  assert.equal(successor.protectedSourceTransitions.length, expectedPaths.length);
  const successorTransitionsByPath = new Map();
  for (const transition of successor.protectedSourceTransitions) {
    assert.ok(!successorTransitionsByPath.has(transition.path),
      `Duplicate retention consumer protected path: ${transition.path}`);
    verifyTransition(transition.path, transition);
    successorTransitionsByPath.set(transition.path, [transition]);
  }
  assert.deepEqual(
    [...successorTransitionsByPath.keys()].sort(),
    [...expectedPaths].sort()
  );
  assert.deepEqual(
    git([
      "diff-tree", "--no-commit-id", "--name-only", "-r",
      successor.coherenceImplementation.commit
    ]).trim().split("\n").filter(Boolean),
    ["scripts/verify-shadow-decision-readiness.mjs"],
    "Retention-deletion Intelligence coherence commit scope changed."
  );
  const coherenceTransition = successor.coherenceSourceTransition;
  assert.equal(
    coherenceTransition.path,
    "scripts/verify-shadow-decision-readiness.mjs"
  );
  assert.deepEqual(
    {
      commit: coherenceTransition.commit,
      tree: coherenceTransition.tree,
      subject: coherenceTransition.subject,
      ownerSubsystem: coherenceTransition.ownerSubsystem
    },
    successor.coherenceImplementation
  );
  const shadowVerifierTransitions = successorTransitionsByPath.get(
    coherenceTransition.path
  );
  assert.equal(
    coherenceTransition.previousSha256,
    shadowVerifierTransitions.at(-1).currentSha256,
    "Broken retention consumer shadow-verifier coherence chain."
  );
  verifyTransition(coherenceTransition.path, coherenceTransition);
  successorTransitionsByPath.set(coherenceTransition.path, [
    ...shadowVerifierTransitions,
    coherenceTransition
  ]);
  assert.deepEqual(
    git([
      "diff-tree", "--no-commit-id", "--name-only", "-r",
      successor.negativeFixtureImplementation.commit
    ]).trim().split("\n").filter(Boolean),
    ["tests/read-only-field-session-learning.test.mjs"],
    "Retention-deletion Intelligence negative-fixture commit scope changed."
  );
  const negativeFixtureTransition = successor.negativeFixtureSourceTransition;
  assert.equal(
    negativeFixtureTransition.path,
    "tests/read-only-field-session-learning.test.mjs"
  );
  assert.deepEqual(
    {
      commit: negativeFixtureTransition.commit,
      tree: negativeFixtureTransition.tree,
      subject: negativeFixtureTransition.subject,
      ownerSubsystem: negativeFixtureTransition.ownerSubsystem
    },
    successor.negativeFixtureImplementation
  );
  const readOnlyTestTransitions = successorTransitionsByPath.get(
    negativeFixtureTransition.path
  );
  assert.equal(
    negativeFixtureTransition.previousSha256,
    readOnlyTestTransitions.at(-1).currentSha256,
    "Broken retention consumer negative-fixture transition chain."
  );
  verifyTransition(negativeFixtureTransition.path, negativeFixtureTransition);
  successorTransitionsByPath.set(negativeFixtureTransition.path, [
    ...readOnlyTestTransitions,
    negativeFixtureTransition
  ]);

  const transitionsByPath = new Map();
  for (const [path, transitions] of retentionDeletionRuntimeSuccessor.transitionsByPath) {
    transitionsByPath.set(path, [
      ...transitions,
      ...(successorTransitionsByPath.get(path) || [])
    ]);
  }
  for (const [path, transitions] of successorTransitionsByPath) {
    if (!transitionsByPath.has(path)) transitionsByPath.set(path, transitions);
  }
  const expectedUpstreamDataPaths = [
    "data/route-iq-field-sessions-v1/route-iq-prospective-shadow-coordinator.mjs",
    "overwatch/artifact-contracts/data/fitness-connection-runtime-artifact-contract-v1.json"
  ];
  assert.deepEqual(
    successor.upstreamDataTransitions.map(transition => transition.path).sort(),
    [...expectedUpstreamDataPaths].sort()
  );
  for (const transition of successor.upstreamDataTransitions) {
    const existing = transitionsByPath.get(transition.path) || [];
    if (existing.length > 0) {
      assert.equal(
        transition.previousSha256,
        existing.at(-1).currentSha256,
        `Broken retention consumer upstream chain: ${transition.path}`
      );
    }
    verifyTransition(transition.path, transition);
    transitionsByPath.set(transition.path, [...existing, transition]);
  }
  for (const [path, transitions] of transitionsByPath) {
    const laterTransitions = laterTransitionsByPath.get(path) || [];
    assert.equal(
      sha256(path),
      laterTransitions.at(-1)?.currentSha256 || transitions.at(-1).currentSha256,
      `Current retention consumer protected source changed: ${path}`
    );
  }
  assert.deepEqual(successor.contractComposition, {
    acceptedRetentionPolicyStatus:
      "founder_authorized_18_month_maximum_source_deletion_runtime_dormant",
    acceptedPhysicalDeletionImplementationStatus:
      "source_complete_dormant_not_deployed",
    unknownActiveOrUnsafeStatusAdmissionAllowed: false,
    deletionStartedOrCompletedEvidenceAdmissionAllowed: false,
    shadowHistoricalCheckpointSha256:
      "c814acf7d0d1c08dbc42c24ca1231135b7123397c0c5b2698d3898ca0b3e9ab6",
    shadowRetentionDeletionSuccessorSha256:
      "15995f73e9e8b1b28099f921d2a2f9ac6f3fc93390c17c960cd58e748c9c81d5",
    historicalPinsRewritten: false
  });
  assert.deepEqual(successor.boundaries, {
    prospectiveCollection: "OFF",
    activeCohorts: 0,
    recommendationInfluence: "OFF",
    physicalDeletionDeployed: false,
    physicalDeletionActivated: false,
    canonicalProspectiveRecords: 0,
    canonicalProspectiveEvaluations: 0,
    deploymentPerformed: false,
    productionAccessPerformed: false,
    productionMutationPerformed: false
  });
  return Object.freeze({
    successor,
    successorTransitionsByPath,
    transitionsByPath,
    retentionDeletionRuntimeSuccessor
  });
}

function verifyRetentionMaintenanceConsumerAdmissionSuccessorAgainst(
  retentionDeletionConsumerAdmissionSuccessor,
  laterTransitionsByPath = new Map()
) {
  const successor = JSON.parse(
    read(retentionMaintenanceConsumerAdmissionSuccessorProvenancePath)
  );
  assert.equal(
    successor.version,
    "route-iq-intelligence-retention-maintenance-consumer-admission-successor-v1"
  );
  assert.equal(successor.batchId, "BATCH-20260809-002");
  assert.equal(successor.status, "OWNER_REVIEWED_PROTECTED_COHERENCE_SUCCESSOR");
  assert.equal(successor.ownerSubsystem, "Prometheus Intelligence Engine");
  assert.equal(
    successor.predecessor.path,
    retentionDeletionConsumerAdmissionSuccessorProvenancePath
  );
  assert.equal(sha256(successor.predecessor.path), successor.predecessor.sha256);
  assert.equal(successor.predecessor.remainsHistorical, true);
  assert.equal(successor.predecessor.rewritten, false);

  const expectedPaths = [
    "intelligence/provenance/specifications/prospective-retention-admission-v1.json",
    "intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs",
    "scripts/validate-intelligence-architecture.mjs",
    "scripts/verify-route-iq-prospective-retention-intelligence.mjs",
    "tests/route-iq-prospective-retention-intelligence.test.mjs"
  ];
  assert.deepEqual(successor.implementation.changedPaths, expectedPaths);
  assert.deepEqual(
    git([
      "diff-tree", "--no-commit-id", "--name-only", "-r",
      successor.implementation.commit
    ]).trim().split("\n").filter(Boolean).sort(),
    expectedPaths
  );
  assert.deepEqual(
    git([
      "show", "-s", "--format=%H%n%P%n%T%n%an <%ae>%n%cn <%ce>%n%s",
      successor.implementation.commit
    ]).trim().split("\n"),
    [
      successor.implementation.commit,
      successor.implementation.parent,
      successor.implementation.tree,
      "Prometheus Intelligence Engine <intelligence@prometheus.local>",
      "Prometheus Intelligence Engine <intelligence@prometheus.local>",
      successor.implementation.subject
    ]
  );

  const successorTransitionsByPath = new Map();
  for (const transition of successor.protectedSourceTransitions) {
    assert.equal(successorTransitionsByPath.has(transition.path), false);
    const predecessorTransitions =
      retentionDeletionConsumerAdmissionSuccessor.transitionsByPath.get(
        transition.path
      );
    if (predecessorTransitions) {
      assert.equal(
        transition.previousSha256,
        predecessorTransitions.at(-1).currentSha256,
        `Broken retention-maintenance consumer chain: ${transition.path}`
      );
    }
    verifyTransition(transition.path, transition);
    successorTransitionsByPath.set(transition.path, [transition]);
  }
  assert.deepEqual(
    [...successorTransitionsByPath.keys()].sort(),
    expectedPaths
  );
  assert.deepEqual(successor.coherenceImplementation, {
    commit: successor.coherenceSourceTransition.commit,
    parent: successor.coherenceSourceTransition.parent,
    tree: successor.coherenceSourceTransition.tree,
    subject: successor.coherenceSourceTransition.subject,
    ownerSubsystem: successor.coherenceSourceTransition.ownerSubsystem,
    changedPaths: [
      "intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs"
    ]
  });
  assert.deepEqual(
    git([
      "diff-tree", "--no-commit-id", "--name-only", "-r",
      successor.coherenceImplementation.commit
    ]).trim().split("\n").filter(Boolean),
    successor.coherenceImplementation.changedPaths
  );
  const coherenceTransition = successor.coherenceSourceTransition;
  const coherencePredecessors = successorTransitionsByPath.get(
    coherenceTransition.path
  );
  assert.equal(
    coherenceTransition.previousSha256,
    coherencePredecessors.at(-1).currentSha256,
    "Broken retention-maintenance verifier coherence chain."
  );
  verifyTransition(coherenceTransition.path, coherenceTransition);
  successorTransitionsByPath.set(coherenceTransition.path, [
    ...coherencePredecessors,
    coherenceTransition
  ]);

  assert.equal(successor.upstreamDataAuthority.commit,
    "1513b1acec6b303823e26252c5bcf77efa05ad62");
  assert.equal(successor.upstreamDataAuthority.tree,
    "fb342e185d33f65522745782cad71c4ee437cea1");
  assert.equal(
    sha256(successor.upstreamDataAuthority.retentionGovernance.path),
    successor.upstreamDataAuthority.retentionGovernance.currentSha256
  );
  assert.equal(successor.upstreamDataAuthority.retentionGovernance.currentSha256,
    "9d57108065e14528bb0d11e5910cc0b6b313fd310d6e67b30a8d704b1f2c6f4d");
  assert.equal(successor.upstreamInfrastructureRelease.commit,
    "b71bd0a99ff8d992694df542ec969a071c7b353d");
  assert.equal(successor.upstreamInfrastructureRelease.tree,
    "8b12b3d09f38ff72e5e7c96f8d7732a5c6a41fc4");
  for (const artifact of successor.upstreamInfrastructureRelease.artifacts) {
    assert.equal(sha256(artifact.path), artifact.sha256,
      `Retention-maintenance Infrastructure source changed: ${artifact.path}`);
  }
  assert.deepEqual(successor.composition, {
    exactFinalCommitArtifactRequired: true,
    dataProductionLegalHoldAuthorityRequired: true,
    fixtureLegalHoldEvidenceAllowed: false,
    signedShortLivedAdmissionRequired: true,
    atomicReplayRejectionRequired: true,
    consumerExclusionSemanticsChanged: false,
    recommendationBehaviorChanged: false,
    deploymentAuthorityGranted: false,
    deletionAuthorityGranted: false,
    historicalPinsRewritten: false
  });
  assert.deepEqual(successor.boundaries, {
    collection: "OFF",
    activeCohorts: 0,
    recommendationInfluence: "OFF",
    canonicalProspectiveRecords: 0,
    canonicalProspectiveEvaluations: 0,
    maintenanceRelease: "SOURCE_COMPLETE_DORMANT_NOT_DEPLOYED",
    productionContactPerformed: false,
    productionMutationPerformed: false,
    deploymentPerformed: false
  });
  for (const [path, transitions] of successorTransitionsByPath) {
    assert.equal(
      sha256(path),
      laterTransitionsByPath.get(path)?.at(-1)?.currentSha256 ||
        transitions.at(-1).currentSha256,
      `Current retention-maintenance consumer source changed: ${path}`);
  }

  const transitionsByPath = new Map(
    retentionDeletionConsumerAdmissionSuccessor.transitionsByPath
  );
  for (const [path, transitions] of successorTransitionsByPath) {
    transitionsByPath.set(path, [
      ...(transitionsByPath.get(path) || []),
      ...transitions
    ]);
  }
  for (const [path, transitions] of laterTransitionsByPath) {
    const existing = transitionsByPath.get(path) || [];
    if (existing.length > 0) {
      assert.equal(
        transitions[0].previousSha256,
        existing.at(-1).currentSha256,
        `Broken governed-learning successor chain: ${path}`
      );
    }
    transitionsByPath.set(path, [...existing, ...transitions]);
  }
  return Object.freeze({
    successor,
    successorTransitionsByPath,
    transitionsByPath,
    retentionDeletionConsumerAdmissionSuccessor
  });
}

export function verifyControlledOnboardingRehearsalSmokeContractSuccessor() {
  const successor = JSON.parse(
    read(controlledOnboardingRehearsalSmokeContractProvenancePath)
  );
  const historical = JSON.parse(
    read(crossIndustryZipFounderAccessProvenancePath)
  );
  const historicalWorker = historical.protectedBaselineSuccessors.find(
    entry => entry.path === "workers/prometheus-iq-worker.js"
  );
  const historicalContract = historicalWorker?.guardSuccessor;
  assert.equal(
    successor.version,
    "route-iq-intelligence-controlled-onboarding-rehearsal-smoke-contract-successor-v1"
  );
  assert.equal(
    successor.status,
    "OWNER_REVIEWED_PROTECTED_COHERENCE_SUCCESSOR"
  );
  assert.equal(successor.ownerSubsystem, "Prometheus Intelligence Engine");
  assert.equal(
    successor.predecessor.path,
    crossIndustryZipFounderAccessProvenancePath
  );
  assert.equal(
    sha256(successor.predecessor.path),
    successor.predecessor.sha256,
    "Historical ZIP/Founder Intelligence provenance changed."
  );
  assert.equal(successor.predecessor.remainsHistorical, true);
  assert.equal(successor.predecessor.rewritten, false);

  assert.equal(successor.protectedSourceTransitions.length, 2);
  const transitionByPath = new Map(
    successor.protectedSourceTransitions.map(transition => [
      transition.path,
      transition
    ])
  );
  assert.equal(transitionByPath.size, 2);
  const transition = transitionByPath.get(
    "workers/infrastructure/cloudflare-unattended-smoke-contract.js"
  );
  assert.equal(
    transition.path,
    "workers/infrastructure/cloudflare-unattended-smoke-contract.js"
  );
  assert.equal(
    transition.previousSha256,
    historicalContract.contractSha256
  );
  assert.equal(
    transitionByPath.get("workers/prometheus-iq-worker.js").previousSha256,
    historicalWorker.currentSha256
  );
  for (const protectedTransition of transitionByPath.values()) {
    verifyTransition(protectedTransition.path, protectedTransition);
  }
  assert.deepEqual(successor.coherence, {
    historicalZipFounderEvidenceRewritten: false,
    historicalContractSha256Preserved: true,
    successorCommitAndTreeVerified: true,
    successorOwnerIdentityVerified: true,
    intelligenceRuntimeChanged: false,
    routeOrderingChanged: false,
    routeScoringChanged: false,
    businessHoursEligibilityChanged: false
  });
  assert.deepEqual(successor.boundaries, {
    readinessState: "INSUFFICIENT_EVIDENCE",
    prospectiveCollection: "OFF",
    activeCohorts: 0,
    recommendationInfluence: "OFF",
    representativeShadowOutputExposed: false,
    deploymentPerformed: false,
    productionAccessPerformed: false,
    productionMutationPerformed: false
  });
  const revenueReadinessSuccessor =
    verifyPaidCustomerRevenueReadinessWorkerSuccessorAgainst(
      successor,
      transitionByPath,
      historical
    );
  const fullSystemHarmonySuccessor =
    verifyFullSystemHarmonyProtectedSuccessorAgainst(
      revenueReadinessSuccessor,
      historical
    );
  const liveCanonicalIdentityProtectedSuccessor =
    verifyLiveCanonicalIdentityProtectedSuccessorAgainst(
      fullSystemHarmonySuccessor
    );
  const fieldSessionReportTypeContractProtectedSuccessor =
    verifyFieldSessionReportTypeContractProtectedSuccessorAgainst(
      liveCanonicalIdentityProtectedSuccessor
    );
  const retentionMaintenanceTransitionsByPath =
    readRetentionMaintenanceTransitionsByPath();
  const governedMultiSessionLearningAdvisorySuccessor =
    readGovernedMultiSessionLearningAdvisorySuccessor();
  const latestTransitionsByPath = mergeTransitionMaps(
    retentionMaintenanceTransitionsByPath,
    governedMultiSessionLearningAdvisorySuccessor.transitionsByPath
  );
  const retentionDeletionRuntimeProtectedSuccessor =
    verifyRetentionDeletionRuntimeProtectedSuccessorAgainst(
      fieldSessionReportTypeContractProtectedSuccessor,
      latestTransitionsByPath
    );
  const retentionDeletionConsumerAdmissionSuccessor =
    verifyRetentionDeletionConsumerAdmissionSuccessorAgainst(
      retentionDeletionRuntimeProtectedSuccessor,
      latestTransitionsByPath
    );
  const retentionMaintenanceConsumerAdmissionSuccessor =
    verifyRetentionMaintenanceConsumerAdmissionSuccessorAgainst(
      retentionDeletionConsumerAdmissionSuccessor,
      governedMultiSessionLearningAdvisorySuccessor.transitionsByPath
    );
  for (const protectedTransition of transitionByPath.values()) {
    const revenueTransitions =
      retentionMaintenanceConsumerAdmissionSuccessor.transitionsByPath
        .get(protectedTransition.path);
    const expectedSha256 = revenueTransitions
      ? revenueTransitions.at(-1).currentSha256
      : protectedTransition.currentSha256;
    assert.equal(
      sha256(protectedTransition.path),
      expectedSha256,
      `Current controlled-rehearsal protected source changed: ${protectedTransition.path}`
    );
  }
  return Object.freeze({
    successor,
    transitionByPath,
    revenueReadinessSuccessor,
    fullSystemHarmonySuccessor,
    liveCanonicalIdentityProtectedSuccessor,
    fieldSessionReportTypeContractProtectedSuccessor,
    retentionDeletionRuntimeProtectedSuccessor,
    retentionDeletionConsumerAdmissionSuccessor,
    retentionMaintenanceConsumerAdmissionSuccessor,
    governedMultiSessionLearningAdvisorySuccessor
  });
}

export function verifyPaidCustomerRevenueReadinessWorkerSuccessor() {
  return verifyControlledOnboardingRehearsalSmokeContractSuccessor()
    .revenueReadinessSuccessor;
}

export function verifyFullSystemHarmonyProtectedSuccessor() {
  return verifyControlledOnboardingRehearsalSmokeContractSuccessor()
    .fullSystemHarmonySuccessor;
}

export function verifyLiveCanonicalIdentityProtectedSuccessor() {
  return verifyControlledOnboardingRehearsalSmokeContractSuccessor()
    .liveCanonicalIdentityProtectedSuccessor;
}

export function verifyFieldSessionReportTypeContractProtectedSuccessor() {
  return verifyControlledOnboardingRehearsalSmokeContractSuccessor()
    .fieldSessionReportTypeContractProtectedSuccessor;
}

export function verifyRetentionDeletionRuntimeProtectedSuccessor() {
  return verifyControlledOnboardingRehearsalSmokeContractSuccessor()
    .retentionDeletionRuntimeProtectedSuccessor;
}

export function verifyRetentionDeletionConsumerAdmissionSuccessor() {
  return verifyControlledOnboardingRehearsalSmokeContractSuccessor()
    .retentionDeletionConsumerAdmissionSuccessor;
}

export function verifyRetentionMaintenanceConsumerAdmissionSuccessor() {
  return verifyControlledOnboardingRehearsalSmokeContractSuccessor()
    .retentionMaintenanceConsumerAdmissionSuccessor;
}

export function verifyGovernedMultiSessionLearningAdvisorySuccessor() {
  return verifyControlledOnboardingRehearsalSmokeContractSuccessor()
    .governedMultiSessionLearningAdvisorySuccessor;
}

export function verifyCrossIndustryZipFounderAccessAdoption() {
  const adoption = JSON.parse(read(crossIndustryZipFounderAccessProvenancePath));
  const rehearsalSuccessor =
    verifyControlledOnboardingRehearsalSmokeContractSuccessor();
  assert.equal(adoption.version, "route-iq-intelligence-cross-industry-zip-founder-access-v1");
  assert.equal(adoption.status, "OWNER_REVIEWED_PROTECTED_BASELINE_SUCCESSOR");
  assert.equal(adoption.ownerSubsystem, "Prometheus Intelligence Engine");

  for (const predecessor of adoption.predecessors) {
    assert.equal(sha256(predecessor.path), predecessor.sha256,
      `Historical Intelligence provenance changed: ${predecessor.path}`);
    assert.equal(predecessor.remainsHistorical, true);
    assert.equal(predecessor.rewritten, false);
  }

  const transitionByPath = new Map();
  for (const successor of adoption.protectedBaselineSuccessors) {
    assert.ok(!transitionByPath.has(successor.path),
      `Duplicate ZIP/Founder protected path: ${successor.path}`);
    assert.ok(successor.transitions.length > 0);
    assert.equal(successor.transitions[0].previousSha256, successor.previousSha256);
    assert.equal(
      successor.transitions.at(-1).currentSha256,
      successor.currentSha256
    );
    for (let index = 0; index < successor.transitions.length; index += 1) {
      const transition = successor.transitions[index];
      verifyTransition(successor.path, transition);
      if (index > 0) {
        assert.equal(
          transition.previousSha256,
          successor.transitions[index - 1].currentSha256,
          `Broken ZIP/Founder transition chain: ${successor.path}`
        );
      }
    }
    const rehearsalTransition =
      rehearsalSuccessor.transitionByPath.get(successor.path);
    const revenueReadinessTransitions =
      rehearsalSuccessor.fieldSessionReportTypeContractProtectedSuccessor
        .transitionsByPath
        .get(successor.path) || [];
    const retentionConsumerTransitions =
      rehearsalSuccessor.retentionDeletionConsumerAdmissionSuccessor
        .successorTransitionsByPath
        .get(successor.path) || [];
    const retentionMaintenanceTransitions =
      rehearsalSuccessor.retentionMaintenanceConsumerAdmissionSuccessor
        .successorTransitionsByPath
        .get(successor.path) || [];
    const governedLearningTransitions =
      rehearsalSuccessor.governedMultiSessionLearningAdvisorySuccessor
        .transitionsByPath
        .get(successor.path) || [];
    if (rehearsalTransition) {
      assert.equal(
        rehearsalTransition.previousSha256,
        successor.currentSha256,
        `Broken controlled-rehearsal transition chain: ${successor.path}`
      );
    }
    const successorTransitions = [
      ...successor.transitions,
      ...(rehearsalTransition ? [rehearsalTransition] : []),
      ...revenueReadinessTransitions,
      ...retentionConsumerTransitions,
      ...retentionMaintenanceTransitions,
      ...governedLearningTransitions
    ];
    const currentSuccessor = {
      ...successor,
      currentSha256: successorTransitions.at(-1).currentSha256,
      transitions: successorTransitions
    };
    assert.equal(sha256(successor.path), currentSuccessor.currentSha256,
      `Current ZIP/Founder protected source changed: ${successor.path}`);
    transitionByPath.set(successor.path, currentSuccessor);
  }
  for (const [path, transitions] of
    rehearsalSuccessor.fieldSessionReportTypeContractProtectedSuccessor
      .transitionsByPath) {
    if (transitionByPath.has(path)) continue;
    transitionByPath.set(path, {
      path,
      previousSha256: transitions[0].previousSha256,
      currentSha256: transitions.at(-1).currentSha256,
      transitions
    });
  }
  const retentionConsumerSuccessor =
    rehearsalSuccessor.retentionDeletionConsumerAdmissionSuccessor;
  for (const [path, transitions] of retentionConsumerSuccessor.transitionsByPath) {
    const existing = transitionByPath.get(path);
    if (!existing) {
      transitionByPath.set(path, {
        path,
        previousSha256: transitions[0].previousSha256,
        currentSha256: transitions.at(-1).currentSha256,
        transitions
      });
      continue;
    }
    const currentTransitionIndex = transitions.findIndex(
      transition => transition.currentSha256 === existing.currentSha256
    );
    const remainingTransitions = currentTransitionIndex >= 0
      ? transitions.slice(currentTransitionIndex + 1)
      : transitions;
    if (currentTransitionIndex < 0) {
      assert.equal(
        remainingTransitions[0].previousSha256,
        existing.currentSha256,
        `Broken retention adoption transition chain: ${path}`
      );
    }
    if (remainingTransitions.length === 0) continue;
    assert.equal(
      remainingTransitions[0].previousSha256,
      existing.currentSha256,
      `Broken retention adoption transition chain: ${path}`
    );
    transitionByPath.set(path, {
      ...existing,
      path,
      currentSha256: remainingTransitions.at(-1).currentSha256,
      transitions: [...existing.transitions, ...remainingTransitions]
    });
  }
  const retentionMaintenanceSuccessor =
    rehearsalSuccessor.retentionMaintenanceConsumerAdmissionSuccessor;
  for (const [path, transitions] of
    retentionMaintenanceSuccessor.successorTransitionsByPath) {
    const existing = transitionByPath.get(path);
    if (!existing) {
      transitionByPath.set(path, {
        path,
        previousSha256: transitions[0].previousSha256,
        currentSha256: transitions.at(-1).currentSha256,
        transitions
      });
      continue;
    }
    assert.equal(transitions[0].previousSha256, existing.currentSha256,
      `Broken retention-maintenance adoption chain: ${path}`);
    transitionByPath.set(path, {
      ...existing,
      currentSha256: transitions.at(-1).currentSha256,
      transitions: [...existing.transitions, ...transitions]
    });
  }
  const governedLearningSuccessor =
    rehearsalSuccessor.governedMultiSessionLearningAdvisorySuccessor;
  for (const [path, transitions] of governedLearningSuccessor.transitionsByPath) {
    const existing = transitionByPath.get(path);
    if (!existing) {
      transitionByPath.set(path, {
        path,
        previousSha256: transitions[0].previousSha256,
        currentSha256: transitions.at(-1).currentSha256,
        transitions
      });
      continue;
    }
    const currentTransitionIndex = transitions.findIndex(
      transition => transition.currentSha256 === existing.currentSha256
    );
    const remainingTransitions = currentTransitionIndex >= 0
      ? transitions.slice(currentTransitionIndex + 1)
      : transitions;
    if (remainingTransitions.length === 0) continue;
    assert.equal(
      remainingTransitions[0].previousSha256,
      existing.currentSha256,
      `Broken governed-learning adoption chain: ${path}`
    );
    transitionByPath.set(path, {
      ...existing,
      currentSha256: remainingTransitions.at(-1).currentSha256,
      transitions: [...existing.transitions, ...remainingTransitions]
    });
  }

  assert.equal(
    transitionByPath.get("index.html")?.currentSha256,
    transitionByPath.get("deploy/cloudflare-pages/index.html")?.currentSha256,
    "Dashboard source and deploy mirror diverged."
  );
  const workerGuard = transitionByPath.get("workers/prometheus-iq-worker.js")
    ?.guardSuccessor;
  assert.equal(
    sha256(workerGuard.path),
    workerGuard.sha256,
    "Current service-principal guard changed."
  );
  const smokeContractSuccessor =
    rehearsalSuccessor.transitionByPath.get(workerGuard.contractPath);
  assert.equal(
    smokeContractSuccessor.path,
    workerGuard.contractPath
  );
  assert.equal(
    sha256(workerGuard.contractPath),
    smokeContractSuccessor.currentSha256,
    "Current service-principal contract changed."
  );
  assert.equal(
    hashBytes(git(["show", `${workerGuard.sourceCommit}:${workerGuard.path}`], null)),
    workerGuard.sha256,
    "Service-principal guard owner commit changed."
  );
  assert.equal(
    hashBytes(git([
      "show",
      `${workerGuard.sourceCommit}:${workerGuard.contractPath}`
    ], null)),
    workerGuard.contractSha256,
    "Service-principal contract owner commit changed."
  );
  assert.equal(workerGuard.clientRequestTimeoutMilliseconds, 8000);
  assert.equal(workerGuard.serverJwksTimeoutMilliseconds, 5000);
  assert.equal(workerGuard.clientRequestTimeoutMilliseconds
    > workerGuard.serverJwksTimeoutMilliseconds, true);
  assert.equal(workerGuard.exactWorkerVersionIdentityRequired, true);
  assert.equal(workerGuard.intelligenceBehaviorChanged, false);
  assert.deepEqual(adoption.approvedDashboardOutput, {
    founderWorkspaceSwitching: "exact_mapped_founder_only",
    territoryZipCoverage: "canonical_configuration_only",
    sourceDeployParityRequired: true,
    reusableCrossIndustryDashboardPreserved: true,
    representativeWorkspaceEnumerationAllowed: false,
    recommendationBehaviorChanged: false
  });

  const runtimePaths = adoption.intelligenceRuntimeIntegrity.artifacts.map(({ path }) => path);
  for (const artifact of adoption.intelligenceRuntimeIntegrity.artifacts) {
    const currentRetentionTransitions =
      rehearsalSuccessor.retentionMaintenanceConsumerAdmissionSuccessor
        .transitionsByPath.get(artifact.path);
    const approvedTransitions = currentRetentionTransitions ||
      rehearsalSuccessor.fullSystemHarmonySuccessor.transitionsByPath.get(artifact.path);
    const expectedSha256 = approvedTransitions
      ? approvedTransitions.at(-1).currentSha256
      : artifact.sha256;
    assert.equal(sha256(artifact.path), expectedSha256,
      `Intelligence runtime changed during ZIP/Founder adoption: ${artifact.path}`);
  }
  const unchangedRuntimePaths = runtimePaths.filter(
    path => !rehearsalSuccessor.fullSystemHarmonySuccessor.transitionsByPath.has(path)
      && !rehearsalSuccessor.retentionDeletionConsumerAdmissionSuccessor
        .successorTransitionsByPath.has(path)
      && !rehearsalSuccessor.retentionMaintenanceConsumerAdmissionSuccessor
        .successorTransitionsByPath.has(path)
      && !rehearsalSuccessor.governedMultiSessionLearningAdvisorySuccessor
        .transitionsByPath.has(path)
  );
  execFileSync("/usr/bin/git", [
    "diff", "--quiet",
    `${adoption.intelligenceRuntimeIntegrity.comparisonBase}..HEAD`,
    "--",
    ...unchangedRuntimePaths
  ], {
    cwd: root,
    stdio: "ignore"
  });
  assert.equal(adoption.intelligenceRuntimeIntegrity.runtimeFilesChangedSinceComparisonBase, false);
  assert.equal(adoption.intelligenceRuntimeIntegrity.routeOrderingChanged, false);
  assert.equal(adoption.intelligenceRuntimeIntegrity.routeScoringChanged, false);
  assert.equal(adoption.intelligenceRuntimeIntegrity.businessHoursEligibilityChanged, false);
  assert.equal(adoption.intelligenceRuntimeIntegrity.readOnlyLearningChanged, false);
  assert.equal(adoption.intelligenceRuntimeIntegrity.discoveryOrNearbyRuntimeChanged, false);

  assert.deepEqual(adoption.boundaries, {
    readinessState: "INSUFFICIENT_EVIDENCE",
    prospectiveCollection: "OFF",
    activeCohorts: 0,
    recommendationInfluence: "OFF",
    representativeShadowOutputExposed: false,
    deploymentPerformed: false,
    productionAccessPerformed: false,
    productionMutationPerformed: false
  });

  return Object.freeze({
    adoption,
    rehearsalSuccessor,
    transitionByPath,
    resolveBaseline(path, historicalSha256) {
      const successor = transitionByPath.get(path);
      if (!successor) return historicalSha256;
      assert.equal(successor.previousSha256, historicalSha256,
        `ZIP/Founder protected predecessor mismatch: ${path}`);
      return successor.currentSha256;
    }
  });
}
