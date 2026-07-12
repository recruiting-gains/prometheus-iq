import assert from "node:assert/strict";
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

function read(path) {
  return readFileSync(resolve(root, path));
}

function readJson(path) {
  return JSON.parse(read(path).toString("utf8"));
}

function sha256(path) {
  return createHash("sha256").update(read(path)).digest("hex");
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
  for (const [name, expectedHash] of Object.entries(contract.protectedBehaviorBaselines)) {
    assert.equal(sha256(contract.protectedBehaviorBaselinePaths[name]), expectedHash, `Protected behavior baseline changed: ${name}`);
  }

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
    sourceHashes: afterHashes
  };
}

const invokedPath = process.argv[1] ? new URL(`file://${process.argv[1]}`).pathname : "";
if (invokedPath === new URL(import.meta.url).pathname) {
  const result = verifyReadOnlyFieldSessionLearning({ writeSnapshot });
  console.log(JSON.stringify(result, null, 2));
}
