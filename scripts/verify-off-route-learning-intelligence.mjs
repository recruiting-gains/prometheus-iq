import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  buildCanonicalOffRouteLearningSnapshot,
  loadOffRouteLearningContract,
  loadOffRouteLearningPolicy,
  offRouteLearningIntelligenceVersion,
  validateOffRouteLearningContract,
  validateOffRouteLearningPolicy,
  validateOffRouteLearningSnapshot
} from "../intelligence/off-route-learning-intelligence.mjs";
import {
  loadCanonicalArchivedFieldSessionPackages,
  loadReadOnlyFieldSessionDataContract,
  loadReadOnlyFieldSessionLearningContract,
  loadReadOnlyFieldSessionLearningPolicy,
  validateReadOnlyFieldSessionLearningContract,
  validateReadOnlyFieldSessionLearningPolicy
} from "../intelligence/read-only-field-session-learning.mjs";
import {
  verifyAugust1ProtectedBehaviorBaselines
} from "./verify-read-only-field-session-learning.mjs";

const root = resolve(import.meta.dirname, "..");
const writeSnapshot = process.argv.includes("--write");

function read(path) {
  return readFileSync(resolve(root, path));
}

function readJson(path) {
  return JSON.parse(read(path).toString("utf8"));
}

function sha256(path) {
  return createHash("sha256").update(read(path)).digest("hex");
}

function canonicalSourceHashes(upstreamContract) {
  return Object.fromEntries(Object.entries(upstreamContract.canonicalSourceArtifacts).map(([name, path]) => [name, sha256(path)]));
}

export function verifyOffRouteLearningIntelligence(options = {}) {
  const contract = options.contract || loadOffRouteLearningContract();
  const policy = options.policy || loadOffRouteLearningPolicy();
  const upstreamContract = options.upstreamContract || loadReadOnlyFieldSessionLearningContract();
  const upstreamPolicy = options.upstreamPolicy || loadReadOnlyFieldSessionLearningPolicy();
  const dataContract = options.dataContract || loadReadOnlyFieldSessionDataContract(upstreamContract);
  const archivePackages = options.archivePackages || loadCanonicalArchivedFieldSessionPackages(upstreamContract);

  assert.deepEqual(validateOffRouteLearningPolicy(policy), []);
  assert.deepEqual(validateOffRouteLearningContract(contract, upstreamContract), []);
  assert.deepEqual(validateReadOnlyFieldSessionLearningPolicy(upstreamPolicy), []);
  assert.deepEqual(validateReadOnlyFieldSessionLearningContract(upstreamContract, dataContract), []);
  assert.equal(sha256(contract.upstreamReadOnlyLearning.contractPath), contract.upstreamReadOnlyLearning.contractSha256, "Upstream read-only learning contract changed.");
  assert.equal(sha256(contract.upstreamReadOnlyLearning.policyPath), contract.upstreamReadOnlyLearning.policySha256, "Upstream read-only learning policy changed.");
  const protectedBehaviorSuccessors = verifyAugust1ProtectedBehaviorBaselines({
    protectedBehaviorBaselines: Object.fromEntries(
      Object.entries(contract.protectedBehaviorBaselines).map(([name, baseline]) => [
        name, baseline.sha256
      ])
    ),
    protectedBehaviorBaselinePaths: Object.fromEntries(
      Object.entries(contract.protectedBehaviorBaselines).map(([name, baseline]) => [
        name, baseline.path
      ])
    ),
    protectedBehaviorBaselineSuccessor: contract.protectedBehaviorBaselineSuccessor
  });

  const beforeSourceHashes = canonicalSourceHashes(upstreamContract);
  assert.deepEqual(beforeSourceHashes, upstreamContract.canonicalSourceSha256, "Canonical Data source hashes changed.");
  const snapshot = buildCanonicalOffRouteLearningSnapshot({
    contract,
    policy,
    upstreamContract,
    upstreamPolicy,
    dataContract,
    archivePackages
  });
  assert.deepEqual(validateOffRouteLearningSnapshot(snapshot, contract, policy), []);
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(snapshot.sourceEvidence.totalVisits, 4);
  assert.equal(snapshot.sourceEvidence.knownSourceVisits, 0);
  assert.equal(snapshot.sourceEvidence.unknownSourceVisits, 4);
  assert.equal(snapshot.sourceEvidence.recommendationDecisionVisits, 0);
  assert.equal(snapshot.sourceTracking.every(record => record.decisionSource.sourceId === "unknown"), true);
  assert.equal(snapshot.sourceTracking.every(record => record.isRecommendationOverride === null), true);
  assert.equal(snapshot.recommendationAcceptanceRate.valuePercent, null);
  assert.equal(snapshot.recommendationOverrideRate.valuePercent, null);
  assert.equal(snapshot.overrideSuccessRate.valuePercent, null);
  assert.equal(snapshot.discoverySuccessRate.valuePercent, null);
  assert.equal(snapshot.overrideObservations.length, 0);
  assert.equal(snapshot.representativeJudgmentConfidence.comparison.representativeJudgmentOutperformsRouteIq, null);
  assert.equal(snapshot.learningConfidence.recommendationInfluenceEligible, false);
  assert.equal(snapshot.safety.recommendationScoringChanged, false);
  assert.equal(snapshot.safety.recommendationBehaviorChanged, false);
  assert.equal(snapshot.safety.recommendationInfluenceActive, false);

  const afterSourceHashes = canonicalSourceHashes(upstreamContract);
  assert.deepEqual(afterSourceHashes, beforeSourceHashes, "Canonical Data sources were mutated during off-route learning.");
  const snapshotPath = resolve(root, contract.intelligenceOwnedArtifacts.snapshot);
  if (options.writeSnapshot === true || writeSnapshot) {
    mkdirSync(dirname(snapshotPath), { recursive: true });
    writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    assert.equal(existsSync(snapshotPath), true, "Canonical off-route learning artifact is missing.");
    assert.deepEqual(readJson(contract.intelligenceOwnedArtifacts.snapshot), snapshot, "Canonical off-route learning artifact is stale.");
  }

  return {
    status: "passed",
    version: offRouteLearningIntelligenceVersion,
    contractVersion: contract.version,
    policyVersion: policy.policyVersion,
    workspaceId: snapshot.workspaceId,
    representativeId: snapshot.representativeId,
    verifiedVisitsConsumed: snapshot.sourceEvidence.totalVisits,
    knownSourceVisits: snapshot.sourceEvidence.knownSourceVisits,
    unknownSourceVisits: snapshot.sourceEvidence.unknownSourceVisits,
    recommendationDecisionVisits: snapshot.sourceEvidence.recommendationDecisionVisits,
    recommendationAcceptanceRate: snapshot.recommendationAcceptanceRate.valuePercent,
    recommendationOverrideRate: snapshot.recommendationOverrideRate.valuePercent,
    overrideSuccessRate: snapshot.overrideSuccessRate.valuePercent,
    discoverySuccessRate: snapshot.discoverySuccessRate.valuePercent,
    recommendationInfluenceActive: snapshot.safety.recommendationInfluenceActive,
    recommendationScoringChanged: snapshot.safety.recommendationScoringChanged,
    routeGenerationChanged: snapshot.safety.routeGenerationChanged,
    protectedBehaviorSuccessors,
    dataMutation: snapshot.safety.dataChanged,
    sourceHashes: afterSourceHashes
  };
}

const invokedPath = process.argv[1] ? new URL(`file://${process.argv[1]}`).pathname : "";
if (invokedPath === new URL(import.meta.url).pathname) {
  console.log(JSON.stringify(verifyOffRouteLearningIntelligence({ writeSnapshot }), null, 2));
}
