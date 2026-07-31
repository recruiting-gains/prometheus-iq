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
    assert.equal(
      sha256(protectedTransition.path),
      protectedTransition.currentSha256,
      `Current controlled-rehearsal protected source changed: ${protectedTransition.path}`
    );
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
  return Object.freeze({ successor, transitionByPath });
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
    if (rehearsalTransition) {
      assert.equal(
        rehearsalTransition.previousSha256,
        successor.currentSha256,
        `Broken controlled-rehearsal transition chain: ${successor.path}`
      );
    }
    const currentSuccessor = rehearsalTransition
      ? {
          ...successor,
          currentSha256: rehearsalTransition.currentSha256,
          transitions: [...successor.transitions, rehearsalTransition]
        }
      : successor;
    assert.equal(sha256(successor.path), currentSuccessor.currentSha256,
      `Current ZIP/Founder protected source changed: ${successor.path}`);
    transitionByPath.set(successor.path, currentSuccessor);
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
    assert.equal(sha256(artifact.path), artifact.sha256,
      `Intelligence runtime changed during ZIP/Founder adoption: ${artifact.path}`);
  }
  execFileSync("/usr/bin/git", [
    "diff", "--quiet",
    `${adoption.intelligenceRuntimeIntegrity.comparisonBase}..HEAD`,
    "--",
    ...runtimePaths
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
