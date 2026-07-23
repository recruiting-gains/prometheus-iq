import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  buildReadOnlyFieldSessionLearningSnapshot,
  loadCanonicalArchivedFieldSessionPackages,
  loadReadOnlyFieldSessionDataContract,
  loadReadOnlyFieldSessionLearningContract,
  loadReadOnlyFieldSessionLearningPolicy,
  readOnlyFieldSessionLearningVersion,
  validateReadOnlyFieldSessionLearningContract,
  validateReadOnlyFieldSessionLearningPolicy,
  validateReadOnlyFieldSessionLearningSnapshot
} from "../intelligence/read-only-field-session-learning.mjs";

const root = resolve(import.meta.dirname, "..");
const writeSnapshot = process.argv.includes("--write");
const currentBaselineSuccessorPath =
  "intelligence/provenance/protected-baseline-synchronization-route-iq-august-1-launch-closeout-v1.json";
const currentBaselineSuccessorCommit = "3587c3d70526b95ae9083520ed42025c5522f764";
const currentBaselineSuccessorTree = "5ac08aecd5c1f720c03194027aef3def4083a142";
const currentBaselineSuccessorParent = "0ac5b54351e12fec954e479c1c56506c58dea6c8";
const currentBaselineSuccessorPaths = Object.freeze([
  "intelligence/contracts/shadow-decision-readiness-contracts.json",
  currentBaselineSuccessorPath,
  "scripts/verify-shadow-decision-readiness.mjs"
]);

function read(path) {
  return readFileSync(resolve(root, path));
}

function readJson(path) {
  return JSON.parse(read(path).toString("utf8"));
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

function verifySourceTransition({ commit, tree, subject, ownerSubsystem, paths, previousSha256,
  currentSha256 }) {
  const identity = ownerSubsystem === "Prometheus Dashboard"
    ? "Prometheus Dashboard <dashboard@prometheus.local>"
    : "Prometheus Intelligence Engine <intelligence@prometheus.local>";
  const fields = git([
    "show", "-s", "--format=%H%n%T%n%an <%ae>%n%cn <%ce>%n%s", commit
  ]).trim().split("\n");
  assert.deepEqual(fields, [commit, tree, identity, identity, subject],
    `Protected source successor commit changed: ${commit}`);
  execFileSync("/usr/bin/git", ["merge-base", "--is-ancestor", commit, "HEAD"], {
    cwd: root,
    stdio: "ignore"
  });
  for (const path of paths) {
    const prior = git(["show", `${commit}^:${path}`], null);
    const accepted = git(["show", `${commit}:${path}`], null);
    assert.equal(hashBytes(prior), previousSha256,
      `Protected source predecessor changed: ${path}`);
    assert.equal(hashBytes(accepted), currentSha256,
      `Protected source successor changed: ${path}`);
    assert.equal(sha256(path), currentSha256,
      `Protected source changed after its owner successor: ${path}`);
  }
}

export function verifyAugust1ProtectedBehaviorBaselines(contract) {
  const successor = readJson(currentBaselineSuccessorPath);
  const fields = git([
    "show", "-s", "--format=%H%n%T%n%P%n%an <%ae>%n%cn <%ce>%n%s",
    currentBaselineSuccessorCommit
  ]).trim().split("\n");
  const paths = git([
    "diff-tree", "--no-commit-id", "--name-only", "-r", currentBaselineSuccessorCommit
  ]).trim().split("\n").filter(Boolean).sort();
  assert.deepEqual(fields, [
    currentBaselineSuccessorCommit,
    currentBaselineSuccessorTree,
    currentBaselineSuccessorParent,
    "Prometheus Intelligence Engine <intelligence@prometheus.local>",
    "Prometheus Intelligence Engine <intelligence@prometheus.local>",
    "Synchronize shadow-readiness runtime baselines"
  ], "Current Intelligence protected-baseline successor commit changed.");
  assert.deepEqual(paths, [...currentBaselineSuccessorPaths].sort(),
    "Current Intelligence protected-baseline successor file set changed.");
  assert.equal(
    hashBytes(git(["show", `${currentBaselineSuccessorCommit}:${currentBaselineSuccessorPath}`], null)),
    sha256(currentBaselineSuccessorPath),
    "Current Intelligence protected-baseline successor record changed."
  );
  assert.equal(successor.status, "OWNER_REVIEWED_AND_SYNCHRONIZED");
  assert.equal(successor.ownerSubsystem, "Prometheus Intelligence Engine");
  assert.equal(successor.predecessor.path, contract.protectedBehaviorBaselineSuccessor);
  assert.equal(successor.predecessor.remainsHistorical, true);
  assert.equal(successor.predecessor.rewritten, false);
  assert.equal(successor.protectedReferenceAudit.allAffectedIntelligenceReferencesAccountedFor, true);
  assert.equal(successor.reviewedInvariants.readinessMethodologyChanged, false);
  assert.equal(successor.reviewedInvariants.readinessStateChanged, false);
  assert.equal(successor.reviewedInvariants.representativeWorkflowChangedBySynchronization, false);
  assert.equal(successor.boundaries.prospectiveCollection, "OFF");
  assert.equal(successor.boundaries.activeCohorts, 0);
  assert.equal(successor.boundaries.recommendationInfluence, "OFF");

  verifySourceTransition({
    ...successor.sourceTransitions.dashboard,
    paths: successor.sourceTransitions.dashboard.paths
  });
  verifySourceTransition({
    commit: successor.sourceTransitions.intelligenceRuntime.commit,
    tree: successor.sourceTransitions.intelligenceRuntime.tree,
    subject: successor.sourceTransitions.intelligenceRuntime.subject,
    ownerSubsystem: successor.sourceTransitions.intelligenceRuntime.ownerSubsystem,
    paths: [successor.sourceTransitions.intelligenceRuntime.routeGeneration.path],
    previousSha256: successor.sourceTransitions.intelligenceRuntime.routeGeneration.previousSha256,
    currentSha256: successor.sourceTransitions.intelligenceRuntime.routeGeneration.currentSha256
  });
  verifySourceTransition({
    commit: successor.sourceTransitions.intelligenceRuntime.commit,
    tree: successor.sourceTransitions.intelligenceRuntime.tree,
    subject: successor.sourceTransitions.intelligenceRuntime.subject,
    ownerSubsystem: successor.sourceTransitions.intelligenceRuntime.ownerSubsystem,
    paths: [successor.sourceTransitions.intelligenceRuntime.businessHoursEligibility.path],
    previousSha256:
      successor.sourceTransitions.intelligenceRuntime.businessHoursEligibility.previousSha256,
    currentSha256:
      successor.sourceTransitions.intelligenceRuntime.businessHoursEligibility.currentSha256
  });

  const governedTransitions = new Map([
    ["dashboardSourceSha256", {
      path: successor.sourceTransitions.dashboard.paths[0],
      ...successor.sourceTransitions.dashboard
    }],
    ["dashboardSource", {
      path: successor.sourceTransitions.dashboard.paths[0],
      ...successor.sourceTransitions.dashboard
    }],
    ["dashboardDeployMirrorSha256", {
      path: successor.sourceTransitions.dashboard.paths[1],
      ...successor.sourceTransitions.dashboard
    }],
    ["dashboardDeployMirror", {
      path: successor.sourceTransitions.dashboard.paths[1],
      ...successor.sourceTransitions.dashboard
    }],
    ["adaptiveRouteEngineSha256", {
      ...successor.sourceTransitions.intelligenceRuntime.routeGeneration
    }],
    ["routeGeneration", {
      ...successor.sourceTransitions.intelligenceRuntime.routeGeneration
    }],
    ["businessHoursEligibilitySha256", {
      ...successor.sourceTransitions.intelligenceRuntime.businessHoursEligibility
    }]
  ]);
  let successorCount = 0;
  for (const [name, expectedHash] of Object.entries(contract.protectedBehaviorBaselines)) {
    const path = contract.protectedBehaviorBaselinePaths[name];
    const currentHash = sha256(path);
    if (currentHash === expectedHash) continue;
    const transition = governedTransitions.get(name);
    assert.equal(transition?.path, path, `Protected behavior path changed: ${name}`);
    assert.equal(transition?.previousSha256, expectedHash,
      `Protected behavior predecessor changed: ${name}`);
    assert.equal(transition?.currentSha256, currentHash,
      `Protected behavior successor changed: ${name}`);
    successorCount += 1;
  }
  return successorCount;
}

function sourceHashes(contract) {
  return Object.fromEntries(Object.entries(contract.canonicalSourceArtifacts).map(([name, path]) => [name, sha256(path)]));
}

export function verifyReadOnlyFieldSessionLearning(options = {}) {
  const contract = options.contract || loadReadOnlyFieldSessionLearningContract();
  const policy = options.policy || loadReadOnlyFieldSessionLearningPolicy();
  const dataContract = options.dataContract || loadReadOnlyFieldSessionDataContract(contract);
  const archivePackages = options.archivePackages || loadCanonicalArchivedFieldSessionPackages(contract);
  const beforeHashes = sourceHashes(contract);

  assert.deepEqual(validateReadOnlyFieldSessionLearningPolicy(policy), []);
  assert.deepEqual(validateReadOnlyFieldSessionLearningContract(contract, dataContract), []);
  assert.deepEqual(beforeHashes, contract.canonicalSourceSha256, "Canonical Data field-session source hashes changed.");
  const protectedBehaviorSuccessors = verifyAugust1ProtectedBehaviorBaselines(contract);

  assert.equal(dataContract.intelligenceFieldSessionLearningHandoff.status, "defined_not_authorized");
  assert.equal(dataContract.intelligenceFieldSessionLearningHandoff.independentAuthorizationRequiredBeforeConsumption, true);
  assert.equal(dataContract.consumerRules.intelligence.fieldSessionLearningConsumptionAuthorized, false);
  assert.equal(contract.independentAuthorization.sourceContractIndependentAuthorizationRequirementSatisfied, true);
  assert.equal(contract.independentAuthorization.status, "AUTHORIZED_ACTIVE");
  assert.equal(contract.allowedOperations.consumeRawEvidence, false);
  assert.equal(contract.allowedOperations.replaySessions, false);
  assert.equal(contract.allowedOperations.modifyData, false);

  const snapshot = buildReadOnlyFieldSessionLearningSnapshot({
    contract,
    policy,
    dataContract,
    archivePackages,
    workspaceId: contract.workspaceId,
    operatingProfileId: contract.operatingProfileId
  });
  assert.deepEqual(validateReadOnlyFieldSessionLearningSnapshot(snapshot, contract), []);
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(snapshot.sourceEvidence.verifiedSessionCount, 1);
  assert.equal(snapshot.representativeIntelligence.length, 1);
  assert.equal(snapshot.territoryIntelligence.length, 1);
  assert.equal(snapshot.categoryIntelligence.length, 1);
  assert.equal(snapshot.businessIntelligence.length, 4);
  assert.equal(snapshot.learningConfidence.every(item => item.recommendationInfluenceEligible === false), true);
  assert.equal(snapshot.recommendationSafety.recommendationBehaviorChanged, false);
  assert.equal(snapshot.recommendationSafety.routeScoringWeightsChanged, false);
  assert.equal(snapshot.recommendationSafety.recommendationEligibleConclusionCount, 0);
  assert.equal(snapshot.archiveSafety.historicalReplayPerformed, false);
  assert.equal(snapshot.archiveSafety.archiveMutationPerformed, false);

  const afterHashes = sourceHashes(contract);
  assert.deepEqual(afterHashes, beforeHashes, "Canonical Data field-session artifacts were mutated during learning.");

  const snapshotPath = resolve(root, contract.intelligenceOwnedArtifacts.learningSnapshot);
  if (options.writeSnapshot === true || writeSnapshot) {
    mkdirSync(dirname(snapshotPath), { recursive: true });
    writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    assert.equal(existsSync(snapshotPath), true, "Canonical Intelligence learning snapshot is missing.");
    assert.deepEqual(readJson(contract.intelligenceOwnedArtifacts.learningSnapshot), snapshot, "Canonical Intelligence learning snapshot is stale.");
  }

  return {
    status: "passed",
    learningVersion: readOnlyFieldSessionLearningVersion,
    contractVersion: contract.version,
    policyVersion: policy.policyVersion,
    workspaceId: snapshot.workspaceId,
    operatingProfileId: snapshot.operatingProfileId,
    verifiedSessionsConsumed: snapshot.sourceEvidence.verifiedSessionCount,
    representativeIntelligenceRecords: snapshot.representativeIntelligence.length,
    territoryIntelligenceRecords: snapshot.territoryIntelligence.length,
    categoryIntelligenceRecords: snapshot.categoryIntelligence.length,
    businessIntelligenceRecords: snapshot.businessIntelligence.length,
    thresholdQualifiedConclusions: snapshot.recommendationSafety.thresholdQualifiedConclusionCount,
    recommendationEligibleConclusions: snapshot.recommendationSafety.recommendationEligibleConclusionCount,
    independentAuthorization: contract.independentAuthorization.status,
    dataContractMutation: false,
    archiveMutation: false,
    historicalReplay: false,
    routeScoringWeightsChanged: false,
    recommendationBehaviorChanged: false,
    protectedBehaviorSuccessors,
    sourceHashes: afterHashes
  };
}

const invokedPath = process.argv[1] ? new URL(`file://${process.argv[1]}`).pathname : "";
if (invokedPath === new URL(import.meta.url).pathname) {
  const result = verifyReadOnlyFieldSessionLearning({ writeSnapshot });
  console.log(JSON.stringify(result, null, 2));
}
