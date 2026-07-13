import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";

const batchId = "BATCH-20260713-002";
const legacyCommit = "049cf583b04900b2cbf38bbffc5f6293252365d0";
const intelligenceRepairCommit = "1bb7d09dff254503d56027a87efe0d526228f35a";
const dashboardRepairCommit = "a665b1b26db02716240b622d0b4d451d019c2896";
const mappingPath = "overwatch/artifact-contracts/provenance/route-iq-release-provenance-repair-v1.json";
const registryPath = "overwatch/artifact-contracts/canonical-artifact-registry.json";
const dashboardContractPath = "overwatch/artifact-contracts/workspaces/fitness-connection/dashboard-consumer-contract-v1.json";
const intelligenceEvidencePath = "intelligence/provenance/legacy-provenance-gap-049cf583-v1.json";
const batchOneReportPath = "overwatch/reports/BATCH-20260713-001-route-iq-shadow-decision-readiness.json";
const dashboardEvidencePath = "dashboard/decision-context-producer-validation-v1.md";
const expectedPreBatchCommits = [
  "2774d91456e4b1734eb1caa13deaa84de2248f8f",
  "fc8f9c6a8acf04a80e4d5f93485225dfefea9407",
  "232e192a9fa5a14641d411896d43a0495a46ae01",
  "13c0bbfb72b72e1b492369fdfe896fffbddefaa6",
  legacyCommit
];

const intelligenceContractPaths = [
  "intelligence/contracts/read-only-field-session-learning-contracts.json",
  "intelligence/contracts/off-route-learning-intelligence-contracts.json",
  "intelligence/contracts/discovery-mode-intelligence-v2-contracts.json",
  "intelligence/contracts/nearby-context-intelligence-v2-contracts.json"
];

const expectedLegacyPaths = [
  ...intelligenceContractPaths,
  dashboardContractPath
].sort();

const expectedIntelligenceRepairPaths = [
  "intelligence/README.md",
  "intelligence/contracts/discovery-mode-intelligence-v2-contracts.json",
  "intelligence/contracts/nearby-context-intelligence-v2-contracts.json",
  "intelligence/contracts/off-route-learning-intelligence-contracts.json",
  "intelligence/contracts/read-only-field-session-learning-contracts.json",
  "intelligence/contracts/shadow-decision-readiness-contracts.json",
  "intelligence/provenance/legacy-provenance-gap-049cf583-v1.json",
  "intelligence/provenance/reconstruct-legacy-protected-contracts-v1.mjs",
  "scripts/validate-intelligence-architecture.mjs",
  "tests/intelligence-architecture.test.mjs"
].sort();

const read = path => fs.readFileSync(path);
const readJson = path => JSON.parse(read(path));
const sha256 = value => createHash("sha256").update(value).digest("hex");

function sortJson(value) {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, sortJson(value[key])]));
  }
  return value;
}

const semanticSha256 = value => sha256(JSON.stringify(sortJson(value)));

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function gitBytes(...args) {
  return execFileSync("git", args);
}

function changedPaths(commit) {
  const output = git("diff-tree", "--no-commit-id", "--name-only", "-r", commit);
  return output ? output.split("\n").sort() : [];
}

export function verifyReleaseProvenanceRepair() {
  const mapping = readJson(mappingPath);
  const registry = readJson(registryPath);
  const dashboardContract = readJson(dashboardContractPath);
  const intelligenceEvidence = readJson(intelligenceEvidencePath);
  const batchOneReport = readJson(batchOneReportPath);
  const dashboardEvidence = read(dashboardEvidencePath).toString("utf8");

  assert.equal(mapping.contractId, "route-iq-release-provenance-repair-v1");
  assert.equal(mapping.batchId, batchId);
  assert.equal(mapping.status, "active_governance_only");
  assert.equal(mapping.owningSubsystem, "Prometheus Overwatch");
  assert.equal(mapping.workspaceId, "fitness_connection");
  assert.equal(mapping.operatingProfileId, "fitness");

  const gap = mapping.legacyProvenanceGap;
  assert.equal(gap.commit, legacyCommit);
  assert.equal(gap.classification, "LEGACY_PROVENANCE_GAP");
  assert.equal(gap.historyPreserved, true);
  assert.equal(gap.retroactiveOwnershipClaimed, false);
  assert.equal(gap.mixedOwnershipDisclosed, true);
  assert.equal(gap.intelligenceOwnerRepairCommit, intelligenceRepairCommit);
  assert.deepEqual(changedPaths(legacyCommit), expectedLegacyPaths);
  assert.deepEqual(changedPaths(intelligenceRepairCommit), expectedIntelligenceRepairPaths);
  assert.equal(git("merge-base", "--is-ancestor", legacyCommit, intelligenceRepairCommit), "");

  assert.equal(intelligenceEvidence.status, "LEGACY_PROVENANCE_GAP");
  assert.equal(intelligenceEvidence.legacyCommit, legacyCommit);
  assert.match(intelligenceEvidence.ownershipStatement, /does not claim retroactive Intelligence ownership/);
  assert.deepEqual(
    intelligenceEvidence.contracts.map(contract => contract.path).sort(),
    intelligenceContractPaths.slice().sort()
  );

  for (const record of gap.intelligenceOwnedFiles) {
    assert.ok(intelligenceContractPaths.includes(record.path), `Unexpected Intelligence path: ${record.path}`);
    const ownerEvidence = intelligenceEvidence.contracts.find(contract => contract.path === record.path);
    assert.ok(ownerEvidence, `Missing owner evidence for ${record.path}`);

    const legacyBytes = gitBytes("show", `${legacyCommit}:${record.path}`);
    const currentBytes = read(record.path);
    const currentJson = JSON.parse(currentBytes);
    assert.equal(sha256(legacyBytes), record.legacyRawSha256, `${record.path} legacy hash drifted.`);
    assert.equal(sha256(currentBytes), record.canonicalAfterRepairRawSha256, `${record.path} current hash drifted.`);
    assert.equal(ownerEvidence.legacyCommitRawSha256, record.legacyRawSha256);
    assert.equal(ownerEvidence.reconstructedRawSha256, record.canonicalAfterRepairRawSha256);
    assert.equal(ownerEvidence.canonicalAfterRepairRawSha256, record.canonicalAfterRepairRawSha256);
    assert.equal(semanticSha256(currentJson), ownerEvidence.reconstructedSemanticSha256);
    assert.equal(ownerEvidence.canonicalAfterRepairSemanticSha256, ownerEvidence.reconstructedSemanticSha256);
    assert.equal(ownerEvidence.byteIdenticalAfterRepair, true);
    assert.equal(ownerEvidence.semanticIdenticalAfterRepair, true);
  }

  const shadowEvidence = intelligenceEvidence.additionalProtectedConsumerScan.find(
    record => record.path === "intelligence/contracts/shadow-decision-readiness-contracts.json"
  );
  assert.ok(shadowEvidence, "Shadow-readiness protected consumer must be independently reconstructed.");
  assert.equal(sha256(read(shadowEvidence.path)), shadowEvidence.reconstructedRawSha256);
  assert.equal(semanticSha256(readJson(shadowEvidence.path)), shadowEvidence.reconstructedSemanticSha256);
  assert.equal(shadowEvidence.byteIdenticalAfterRepair, true);
  assert.equal(shadowEvidence.semanticIdenticalAfterRepair, true);

  const dashboardAlignment = dashboardContract.repViewContract.placesAccess.alignmentEvidence;
  assert.equal(gap.overwatchOwnedFile.path, dashboardContractPath);
  assert.equal(gap.overwatchOwnedFile.canonicalOwner, "Prometheus Overwatch");
  assert.equal(gap.overwatchOwnedFile.dashboardOwnerRevalidationCommit, dashboardRepairCommit);
  assert.equal(dashboardAlignment.dashboardCommit, dashboardRepairCommit);
  assert.equal(dashboardAlignment.dashboardOwnerRevalidationCommit, dashboardRepairCommit);
  assert.equal(dashboardAlignment.decisionContextFeatureOriginCommit, "2774d91456e4b1734eb1caa13deaa84de2248f8f");
  assert.equal(sha256(read("index.html")), dashboardAlignment.dashboardSourceSha256);
  assert.equal(sha256(read("deploy/cloudflare-pages/index.html")), dashboardAlignment.dashboardSourceSha256);
  assert.match(dashboardEvidence, /Status: FOUNDER_BEHAVIOR_APPROVAL_REQUIRED/);
  assert.match(dashboardEvidence, /post-action evidence/);
  assert.match(dashboardEvidence, /does not provide the full candidate context/);
  assert.match(dashboardEvidence, /adds no name, email, phone, manager, GPS, note/);
  assert.match(dashboardEvidence, /No shadow state or Founder readiness result is rendered to representatives/);

  const fitnessWorkspace = registry.workspaces.find(workspace => workspace.workspaceId === "fitness_connection");
  const registration = fitnessWorkspace?.canonicalArtifacts.find(
    artifact => artifact.artifactId === "fitness_connection_release_provenance_repair_mapping"
  );
  assert.ok(registration, "Release provenance mapping must be registered.");
  assert.equal(registration.path, mappingPath);
  assert.equal(registration.ownerSubsystem, "Prometheus Overwatch");
  assert.deepEqual(registration.writeAllowed, ["Prometheus Overwatch"]);
  assert.deepEqual(registration.readAllowed, ["Prometheus Overwatch"]);
  assert.equal(registration.productionConsumer, false);

  const correction = batchOneReport.releaseScopeCorrection;
  assert.equal(correction.ownerRepairTree, "c2fdbe479b92c436b076e954dfa48c0065a673ff");
  assert.equal(correction.batchFinalHead, "18ed83effdca1219729e4e71f452eeea8c3b273b");
  assert.equal(correction.batchFinalTree, "87cb850a77333dbd0e368e2bba4aad5ac3c4a56f");
  assert.equal(correction.ownerRepairTreeEqualsBatchFinalTree, false);
  assert.equal(correction.exactFinalHeadVerificationEstablishedByBatch1, false);
  assert.equal(correction.priorPushRecommendationSuperseded, true);

  assert.equal(mapping.methodology.requiredEvaluationOutcomes, "97 eligible, linked, scoreable evaluation outcomes after exclusions");
  assert.equal(mapping.methodology.requiredSampleAloneCanReachFounderReview, false);
  assert.equal(mapping.methodology.calibrationBins, 5);
  assert.equal(mapping.methodology.minimumSupportedObservationsAcrossFivePopulatedBins, 100);
  assert.equal(mapping.methodology.sparseOrEmptyBinsMayBypassEvidenceCoverage, false);
  assert.equal(mapping.methodology.chronologicalTrainingEvaluationSeparationRequired, true);
  assert.equal(mapping.methodology.calibrationStabilitySegmentSafetyAndBaselineRequired, true);
  assert.equal(mapping.methodology.causalUpliftOrRecommendationSuperiorityClaimAllowed, false);

  assert.deepEqual(mapping.preBatchOwnerValidation.map(record => record.commit), expectedPreBatchCommits);
  assert.equal(mapping.preBatchOwnerValidation[0].owner, "Prometheus Dashboard");
  assert.equal(mapping.preBatchOwnerValidation[0].status, "OWNER_REVALIDATED_FOUNDER_BEHAVIOR_APPROVAL_REQUIRED");
  for (const record of mapping.preBatchOwnerValidation.slice(1, 4)) {
    assert.equal(record.owner, "Prometheus Data");
    assert.equal(record.status, "OWNER_REVALIDATED_CONTRACT_MISMATCH_CLOSED");
  }
  assert.equal(mapping.preBatchOwnerValidation[4].owner, "MIXED_LEGACY_PROVENANCE_GAP");
  assert.equal(mapping.preBatchOwnerValidation[4].status, "LEGACY_GAP_DISCLOSED_AND_OWNER_RECONSTRUCTED");

  const dataValidation = mapping.dataOwnerValidation;
  assert.equal(dataValidation.contractMismatchClosed, true);
  assert.equal(sha256(read(dataValidation.dataArchiveRuntimePath)), dataValidation.dataArchiveRuntimeSha256);
  assert.equal(sha256(read(dataValidation.dataRuntimeContractPath)), dataValidation.dataRuntimeContractSha256);
  assert.equal(sha256(read(dataValidation.historicalRawArchivePath)), dataValidation.historicalRawArchiveSha256);
  assert.equal(sha256(read(dataValidation.historicalNormalizedArchivePath)), dataValidation.historicalNormalizedArchiveSha256);
  assert.equal(dataValidation.knownAndContemporaneousUnknownClassification, "action_time_observation");
  assert.equal(dataValidation.legacyFallbackClassification, "late_report_finalization_unknown");
  assert.equal(dataValidation.lateFallbackMaySatisfyOriginalShadowOpportunity, false);
  assert.equal(dataValidation.historicalArchiveRewritten, false);
  assert.equal(dataValidation.retryAndReplayRemainIdempotent, true);
  assert.equal(dataValidation.workspaceIsolationPreserved, true);

  const dashboardValidation = mapping.dashboardOwnerValidation;
  assert.equal(dashboardValidation.evidencePath, dashboardEvidencePath);
  assert.equal(dashboardValidation.representativeBehaviorApproval, "FOUNDER_BEHAVIOR_APPROVAL_REQUIRED");
  assert.equal(dashboardValidation.decisionSourceOptional, true);
  assert.equal(dashboardValidation.captureTiming, "visit_submission_post_action");
  assert.equal(dashboardValidation.preActionFrozenCandidateContextProduced, false);
  assert.equal(dashboardValidation.fullShadowCandidateContextPreserved, false);
  assert.equal(dashboardValidation.personallyIdentifiableInformationCollectionExpanded, false);
  assert.equal(dashboardValidation.shadowOutputsVisibleToRepresentatives, false);
  assert.equal(dashboardValidation.recommendationInfluence, "OFF");

  for (const flag of [
    "newSubsystemIntroduced",
    "parallelProductionEventArchitectureIntroduced",
    "newModelOrVendorDependencyIntroduced",
    "personallyIdentifiableInformationCollectionExpanded",
    "shadowOutputRepresentativeVisibility",
    "routeOrderingInfluenceIntroduced",
    "notificationInfluenceIntroduced",
    "automaticActionInfluenceIntroduced",
    "productionConsumerIntroduced",
    "prospectiveShadowEvidenceCollectionStarted",
    "historicalArchiveRewritten"
  ]) {
    assert.equal(mapping.architectureConfirmation[flag], false, `${flag} must remain false.`);
  }
  assert.equal(mapping.architectureConfirmation.recommendationInfluence, "OFF");
  assert.equal(mapping.releaseBoundary.pushPerformed, false);
  assert.equal(mapping.releaseBoundary.deploymentPerformed, false);
  assert.equal(mapping.releaseBoundary.founderBehaviorApprovalRequired, true);

  return {
    status: "PASS",
    batchId,
    legacyCommit,
    intelligenceContractsReconstructed: intelligenceContractPaths.length,
    protectedConsumersVerified: intelligenceContractPaths.length + 1,
    dashboardBehaviorApproval: "FOUNDER_BEHAVIOR_APPROVAL_REQUIRED",
    recommendationInfluence: "OFF",
    productionConsumerIntroduced: false
  };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  console.log(JSON.stringify(verifyReleaseProvenanceRepair(), null, 2));
}
