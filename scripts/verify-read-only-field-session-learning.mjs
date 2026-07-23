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
const crossIndustryAdoptionPath =
  "intelligence/provenance/protected-baseline-synchronization-cross-industry-dashboard-retention-successor-v1.json";
const crossIndustryAdoptionCommit = "5215ad7f261590f5901dc84a3b8e59d9bde6ce8b";
const crossIndustryAdoptionTree = "0812759b11d783b845cdaf9db3ce0a7c166452c0";
const crossIndustryAdoptionParent = "49ca63efb2d2a57e7b40ae17f504b27b399ec4c5";
const crossIndustryAdoptionSha256 =
  "4d57223d3c00c6d56b3fa0b076ce04ae06b68fd3ca014da76d1a955e7f0bee60";
const crossIndustryAdoptionCorrectionCommit =
  "894ea7843e084369acf7bf6158a3ea5088deb431";
const crossIndustryAdoptionCorrectionTree =
  "9770f7e2293ecb0f30e6cf0324cfd40da40f1897";
const crossIndustryAdoptionCorrectionParent =
  "036bc342a7f2ea0dfaec9bd482175fb1e88e59c7";
const crossIndustryAdoptionCorrectionSha256 =
  "a89539353c221b061cd39d97130764de3bbd2add03432a4c284017f483504b06";
const crossIndustryAdoptionPaths = Object.freeze([
  "intelligence/contracts/discovery-mode-intelligence-v2-contracts.json",
  "intelligence/contracts/nearby-context-intelligence-v2-contracts.json",
  "intelligence/contracts/off-route-learning-intelligence-contracts.json",
  "intelligence/contracts/read-only-field-session-learning-contracts.json",
  "intelligence/contracts/route-iq-public-intelligence-claims-v1.json",
  "intelligence/contracts/shadow-decision-readiness-contracts.json",
  crossIndustryAdoptionPath,
  "intelligence/read-only-field-session-learning.md",
  "tests/intelligence-architecture.test.mjs"
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
  currentSha256, enforceCurrent = true }) {
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
    if (enforceCurrent) {
      assert.equal(sha256(path), currentSha256,
        `Protected source changed after its owner successor: ${path}`);
    }
  }
}

export function verifyAugust1ProtectedBehaviorBaselines(contract) {
  const successor = readJson(currentBaselineSuccessorPath);
  const adoption = readJson(crossIndustryAdoptionPath);
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
    paths: successor.sourceTransitions.dashboard.paths,
    enforceCurrent: false
  });
  verifySourceTransition({
    commit: successor.sourceTransitions.intelligenceRuntime.commit,
    tree: successor.sourceTransitions.intelligenceRuntime.tree,
    subject: successor.sourceTransitions.intelligenceRuntime.subject,
    ownerSubsystem: successor.sourceTransitions.intelligenceRuntime.ownerSubsystem,
    paths: [successor.sourceTransitions.intelligenceRuntime.routeGeneration.path],
    previousSha256: successor.sourceTransitions.intelligenceRuntime.routeGeneration.previousSha256,
    currentSha256: successor.sourceTransitions.intelligenceRuntime.routeGeneration.currentSha256,
    enforceCurrent: false
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
      successor.sourceTransitions.intelligenceRuntime.businessHoursEligibility.currentSha256,
    enforceCurrent: false
  });

  const adoptionFields = git([
    "show", "-s", "--format=%H%n%T%n%P%n%an <%ae>%n%cn <%ce>%n%s",
    crossIndustryAdoptionCommit
  ]).trim().split("\n");
  const adoptionPaths = git([
    "diff-tree", "--no-commit-id", "--name-only", "-r", crossIndustryAdoptionCommit
  ]).trim().split("\n").filter(Boolean).sort();
  assert.deepEqual(adoptionFields, [
    crossIndustryAdoptionCommit,
    crossIndustryAdoptionTree,
    crossIndustryAdoptionParent,
    "Prometheus Intelligence Engine <intelligence@prometheus.local>",
    "Prometheus Intelligence Engine <intelligence@prometheus.local>",
    "intelligence: adopt cross-industry governed empty state"
  ], "Cross-industry Intelligence adoption commit changed.");
  assert.deepEqual(adoptionPaths, [...crossIndustryAdoptionPaths].sort(),
    "Cross-industry Intelligence adoption file set changed.");
  assert.equal(
    hashBytes(git(["show", `${crossIndustryAdoptionCommit}:${crossIndustryAdoptionPath}`], null)),
    crossIndustryAdoptionSha256,
    "Cross-industry Intelligence adoption record changed at its owner commit."
  );
  const correctionFields = git([
    "show", "-s", "--format=%H%n%T%n%P%n%an <%ae>%n%cn <%ce>%n%s",
    crossIndustryAdoptionCorrectionCommit
  ]).trim().split("\n");
  const correctionPaths = git([
    "diff-tree", "--no-commit-id", "--name-only", "-r",
    crossIndustryAdoptionCorrectionCommit
  ]).trim().split("\n").filter(Boolean).sort();
  assert.deepEqual(correctionFields, [
    crossIndustryAdoptionCorrectionCommit,
    crossIndustryAdoptionCorrectionTree,
    crossIndustryAdoptionCorrectionParent,
    "Prometheus Intelligence Engine <intelligence@prometheus.local>",
    "Prometheus Intelligence Engine <intelligence@prometheus.local>",
    "intelligence: remove retired identity from successor record"
  ], "Cross-industry Intelligence adoption correction changed.");
  assert.deepEqual(correctionPaths, [crossIndustryAdoptionPath],
    "Cross-industry Intelligence adoption correction file set changed.");
  assert.equal(
    hashBytes(git([
      "show",
      `${crossIndustryAdoptionCorrectionCommit}^:${crossIndustryAdoptionPath}`
    ], null)),
    crossIndustryAdoptionSha256,
    "Cross-industry Intelligence adoption correction predecessor changed."
  );
  assert.equal(
    hashBytes(git([
      "show",
      `${crossIndustryAdoptionCorrectionCommit}:${crossIndustryAdoptionPath}`
    ], null)),
    crossIndustryAdoptionCorrectionSha256,
    "Cross-industry Intelligence adoption correction output changed."
  );
  assert.equal(
    sha256(crossIndustryAdoptionPath),
    crossIndustryAdoptionCorrectionSha256,
    "Cross-industry Intelligence adoption record changed after its correction."
  );
  assert.equal(adoption.status, "OWNER_REVIEWED_AND_SYNCHRONIZED_PENDING_OVERWATCH");
  assert.equal(adoption.ownerSubsystem, "Prometheus Intelligence Engine");
  for (const checkpoint of adoption.historicalCheckpoints) {
    assert.equal(sha256(checkpoint.path), checkpoint.sha256,
      `Historical Intelligence checkpoint changed: ${checkpoint.path}`);
    assert.equal(checkpoint.remainsHistorical, true);
    assert.equal(checkpoint.rewritten, false);
  }
  assert.equal(adoption.governedEmptyState.activeBusinessCount, 0);
  assert.equal(adoption.governedEmptyState.retiredOrDemoSupplyRestored, false);
  assert.equal(adoption.governedEmptyState.inventedBusinessAllowed, false);
  assert.equal(adoption.boundaries.prospectiveCollection, "OFF");
  assert.equal(adoption.boundaries.activeCohorts, 0);
  assert.equal(adoption.boundaries.recommendationInfluence, "OFF");
  assert.equal(adoption.boundaries.deploymentPerformed, false);
  assert.equal(adoption.boundaries.productionMutationPerformed, false);

  const adoptionTransitions = [
    adoption.dataOwnerTransition.archiveRuntime,
    ...adoption.dataOwnerTransition.availabilityArtifacts,
    ...adoption.upstreamOwnerTransitions,
    ...adoption.intelligenceOwnerRuntimeTransition.artifacts,
    ...adoption.intelligenceConsumerTransitions
  ];
  const transitionByPath = new Map(adoptionTransitions.map(transition => [
    transition.path,
    transition
  ]));
  for (const transition of adoptionTransitions) {
    assert.equal(sha256(transition.path), transition.currentSha256,
      `Cross-industry protected source changed: ${transition.path}`);
  }
  const governedTransitionNames = new Set([
    "dashboardSourceSha256",
    "dashboardSource",
    "dashboardDeployMirrorSha256",
    "dashboardDeployMirror",
    "adaptiveRouteEngineSha256",
    "routeGeneration",
    "businessHoursEligibilitySha256"
  ]);
  let successorCount = 0;
  for (const [name, expectedHash] of Object.entries(contract.protectedBehaviorBaselines)) {
    const path = contract.protectedBehaviorBaselinePaths[name];
    const currentHash = sha256(path);
    const transition = transitionByPath.get(path);
    assert.equal(expectedHash, transition?.currentSha256 || currentHash,
      `Protected behavior predecessor changed: ${name}`);
    assert.equal(currentHash, expectedHash,
      `Protected behavior successor changed: ${name}`);
    if (transition && governedTransitionNames.has(name)) successorCount += 1;
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
