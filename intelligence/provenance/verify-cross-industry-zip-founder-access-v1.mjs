import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");

export const crossIndustryZipFounderAccessProvenancePath =
  "intelligence/provenance/protected-baseline-synchronization-cross-industry-zip-founder-access-v1.json";

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

export function verifyCrossIndustryZipFounderAccessAdoption() {
  const adoption = JSON.parse(read(crossIndustryZipFounderAccessProvenancePath));
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
    assert.equal(sha256(successor.path), successor.currentSha256,
      `Current ZIP/Founder protected source changed: ${successor.path}`);
    transitionByPath.set(successor.path, successor);
  }

  assert.equal(
    transitionByPath.get("index.html")?.currentSha256,
    transitionByPath.get("deploy/cloudflare-pages/index.html")?.currentSha256,
    "Dashboard source and deploy mirror diverged."
  );
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
