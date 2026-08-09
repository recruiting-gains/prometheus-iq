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
  fieldSessionReportTypeSuccessor
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
  assert.equal(successor.protectedSourceTransitions.length, 1);

  const transition = successor.protectedSourceTransitions[0];
  assert.equal(
    transition.path,
    "data/route-iq-field-sessions-v1/route-iq-field-session-archive.mjs"
  );
  assert.equal(
    transition.previousSha256,
    fieldSessionReportTypeSuccessor.transitionsByPath.get(transition.path).at(-1).currentSha256,
    `Broken retention-deletion transition chain: ${transition.path}`
  );
  verifyTransition(transition.path, transition);

  const successorTransitionsByPath = new Map([[transition.path, [transition]]]);
  const transitionsByPath = new Map();
  for (const [path, transitions] of fieldSessionReportTypeSuccessor.transitionsByPath) {
    transitionsByPath.set(path, [
      ...transitions,
      ...(successorTransitionsByPath.get(path) || [])
    ]);
  }
  for (const [path, transitions] of transitionsByPath) {
    assert.equal(
      sha256(path),
      transitions.at(-1).currentSha256,
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
  const retentionDeletionRuntimeProtectedSuccessor =
    verifyRetentionDeletionRuntimeProtectedSuccessorAgainst(
      fieldSessionReportTypeContractProtectedSuccessor
    );
  for (const protectedTransition of transitionByPath.values()) {
    const revenueTransitions =
      retentionDeletionRuntimeProtectedSuccessor.transitionsByPath
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
    retentionDeletionRuntimeProtectedSuccessor
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
      ...revenueReadinessTransitions
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
    const approvedTransitions =
      rehearsalSuccessor.fullSystemHarmonySuccessor.transitionsByPath.get(artifact.path);
    const expectedSha256 = approvedTransitions
      ? approvedTransitions.at(-1).currentSha256
      : artifact.sha256;
    assert.equal(sha256(artifact.path), expectedSha256,
      `Intelligence runtime changed during ZIP/Founder adoption: ${artifact.path}`);
  }
  const unchangedRuntimePaths = runtimePaths.filter(
    path => !rehearsalSuccessor.fullSystemHarmonySuccessor.transitionsByPath.has(path)
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
