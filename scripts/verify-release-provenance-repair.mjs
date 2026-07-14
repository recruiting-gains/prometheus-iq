import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";

const batchId = "BATCH-20260713-002";
const legacyCommit = "049cf583b04900b2cbf38bbffc5f6293252365d0";
const intelligenceRepairCommit = "1bb7d09dff254503d56027a87efe0d526228f35a";
const dashboardRepairCommit = "a665b1b26db02716240b622d0b4d451d019c2896";
const dashboardProspectiveCommit = "6c7671cb3f9387fdac29961432412dfe70088b2e";
const dashboardCollectionOffCommit = "555dc6e87b1d2f884f1e18b3a06e1c62dfbd73dd";
const protectedBaselineSuccessorCommit = "536d166e4a39a9caf4071e96f92a1598c00e7119";
const routeQualitySuccessorCommit = "73b477a0fdec725beb7fe6de795ec35fd457ef32";
const routeQualityDataCommit = "26b07905926662e3323e557d77c608db0cbc23ed";
const currentIntelligenceSuccessorCommits = [
  "cd0a504328b0870aa695731230e6c43dd4698e3c",
  "ed46fb0964187a207468cd89fbdc1fbbb8426748",
  "e0f14743867bf765f05225e0321f2596741b8c70",
  "21471fb1c5f32c18e4356434af71e0d63925d969"
];
const historicalCanonicalCommit = "ed46fb0964187a207468cd89fbdc1fbbb8426748";
const currentIntelligenceOwnerSuccessorCommit = "21471fb1c5f32c18e4356434af71e0d63925d969";
const mappingPath = "overwatch/artifact-contracts/provenance/route-iq-release-provenance-repair-v1.json";
const registryPath = "overwatch/artifact-contracts/canonical-artifact-registry.json";
const dashboardContractPath = "overwatch/artifact-contracts/workspaces/fitness-connection/dashboard-consumer-contract-v1.json";
const intelligenceEvidencePath = "intelligence/provenance/legacy-provenance-gap-049cf583-v1.json";
const protectedBaselineSuccessorPath =
  "intelligence/provenance/protected-baseline-synchronization-batch-20260714-002-v1.json";
const routeQualitySuccessorPath =
  "intelligence/provenance/protected-baseline-synchronization-batch-20260714-002-route-quality-successor-v1.json";
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

const expectedProtectedBaselineSuccessorPaths = [
  "intelligence/contracts/discovery-mode-intelligence-v2-contracts.json",
  "intelligence/contracts/nearby-context-intelligence-v2-contracts.json",
  "intelligence/contracts/off-route-learning-intelligence-contracts.json",
  "intelligence/contracts/read-only-field-session-learning-contracts.json",
  "intelligence/contracts/shadow-decision-readiness-contracts.json",
  protectedBaselineSuccessorPath,
  "scripts/validate-intelligence-architecture.mjs",
  "tests/intelligence-architecture.test.mjs"
].sort();

const expectedRouteQualityDataPaths = [
  "data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/route-intelligence-golden-route-quality-report.json",
  "scripts/lib/route-intelligence-quality-gate.mjs",
  "tests/route-intelligence-quality-gate.test.mjs"
].sort();

const expectedRouteQualitySuccessorPaths = [
  "intelligence/contracts/shadow-decision-readiness-contracts.json",
  routeQualitySuccessorPath,
  "scripts/validate-intelligence-architecture.mjs",
  "scripts/verify-shadow-decision-readiness.mjs",
  "tests/intelligence-architecture.test.mjs",
  "tests/shadow-decision-readiness.test.mjs"
].sort();

const expectedCurrentIntelligenceSuccessorPaths = new Map([
  [
    currentIntelligenceSuccessorCommits[0],
    [
      "intelligence/config/shadow-decision-readiness-v1.json",
      "intelligence/contracts/discovery-mode-intelligence-v2-contracts.json",
      "intelligence/contracts/nearby-context-intelligence-v2-contracts.json",
      "intelligence/contracts/off-route-learning-intelligence-contracts.json",
      "intelligence/contracts/read-only-field-session-learning-contracts.json",
      "intelligence/contracts/shadow-decision-readiness-contracts.json",
      "intelligence/provenance/legacy-provenance-gap-049cf583-v1.json",
      "intelligence/shadow-decision-readiness.md",
      "scripts/verify-shadow-decision-readiness.mjs",
      "tests/shadow-decision-readiness.test.mjs"
    ].sort()
  ],
  [
    currentIntelligenceSuccessorCommits[1],
    [
      "intelligence/contracts/shadow-decision-readiness-contracts.json",
      "intelligence/provenance/legacy-provenance-gap-049cf583-v1.json",
      "scripts/verify-shadow-decision-readiness.mjs",
      "tests/shadow-decision-readiness.test.mjs"
    ].sort()
  ],
  [
    currentIntelligenceSuccessorCommits[2],
    [
      "intelligence/contracts/off-route-learning-intelligence-contracts.json",
      "intelligence/contracts/read-only-field-session-learning-contracts.json",
      "intelligence/contracts/shadow-decision-readiness-contracts.json",
      "intelligence/off-route-learning-intelligence.mjs",
      "intelligence/read-only-field-session-learning.mjs",
      "scripts/verify-shadow-decision-readiness.mjs",
      "tests/off-route-learning-intelligence.test.mjs",
      "tests/read-only-field-session-learning.test.mjs",
      "tests/shadow-decision-readiness.test.mjs"
    ].sort()
  ],
  [
    currentIntelligenceSuccessorCommits[3],
    [
      "intelligence/README.md",
      "intelligence/provenance/legacy-provenance-gap-049cf583-v1.json",
      "intelligence/provenance/reconstruct-legacy-protected-contracts-v1.mjs",
      "intelligence/provenance/specifications/administrative-disposition-admission-v1.json",
      "tests/intelligence-architecture.test.mjs"
    ].sort()
  ]
]);

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
  return execFileSync("git", args, { maxBuffer: 16 * 1024 * 1024 });
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
  const protectedBaselineSuccessor = readJson(protectedBaselineSuccessorPath);
  const routeQualitySuccessor = readJson(routeQualitySuccessorPath);
  const batchOneReport = readJson(batchOneReportPath);
  const dashboardEvidence = read(dashboardEvidencePath).toString("utf8");

  assert.equal(mapping.contractId, "route-iq-release-provenance-repair-v1");
  assert.equal(mapping.version, "1.2.0");
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
  assert.equal(gap.historicalCanonicalCommit, historicalCanonicalCommit);
  assert.deepEqual(gap.currentIntelligenceSuccessorCommits, currentIntelligenceSuccessorCommits);
  assert.deepEqual(changedPaths(legacyCommit), expectedLegacyPaths);
  assert.deepEqual(changedPaths(intelligenceRepairCommit), expectedIntelligenceRepairPaths);
  assert.equal(git("merge-base", "--is-ancestor", legacyCommit, intelligenceRepairCommit), "");
  for (const commit of currentIntelligenceSuccessorCommits) {
    assert.deepEqual(changedPaths(commit), expectedCurrentIntelligenceSuccessorPaths.get(commit));
    assert.equal(git("merge-base", "--is-ancestor", intelligenceRepairCommit, commit), "");
  }
  assert.deepEqual(changedPaths(protectedBaselineSuccessorCommit), expectedProtectedBaselineSuccessorPaths);
  assert.equal(git("merge-base", "--is-ancestor", currentIntelligenceOwnerSuccessorCommit, protectedBaselineSuccessorCommit), "");
  assert.deepEqual(changedPaths(routeQualityDataCommit), expectedRouteQualityDataPaths);
  assert.deepEqual(changedPaths(routeQualitySuccessorCommit), expectedRouteQualitySuccessorPaths);
  assert.equal(git("merge-base", "--is-ancestor", protectedBaselineSuccessorCommit, routeQualityDataCommit), "");
  assert.equal(git("merge-base", "--is-ancestor", routeQualityDataCommit, routeQualitySuccessorCommit), "");

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
    const historicalCanonicalBytes = gitBytes("show", `${historicalCanonicalCommit}:${record.path}`);
    const historicalCanonicalJson = JSON.parse(historicalCanonicalBytes);
    assert.equal(sha256(legacyBytes), record.legacyRawSha256, `${record.path} legacy hash drifted.`);
    assert.equal(sha256(historicalCanonicalBytes), record.canonicalAfterRepairRawSha256, `${record.path} historical repair hash drifted.`);
    assert.equal(ownerEvidence.legacyCommitRawSha256, record.legacyRawSha256);
    assert.equal(semanticSha256(historicalCanonicalJson), record.canonicalAfterRepairSemanticSha256);
    const ownerSuccessorBytes = gitBytes("show", `${currentIntelligenceOwnerSuccessorCommit}:${record.path}`);
    const ownerSuccessorJson = JSON.parse(ownerSuccessorBytes);
    assert.equal(sha256(ownerSuccessorBytes), record.currentCanonicalRawSha256);
    assert.equal(semanticSha256(ownerSuccessorJson), record.currentCanonicalSemanticSha256);
    assert.equal(ownerEvidence.reconstructedRawSha256, record.currentCanonicalRawSha256);
    assert.equal(ownerEvidence.canonicalAfterRepairRawSha256, record.currentCanonicalRawSha256);
    assert.equal(ownerEvidence.reconstructedSemanticSha256, record.currentCanonicalSemanticSha256);
    assert.equal(ownerEvidence.canonicalAfterRepairSemanticSha256, ownerEvidence.reconstructedSemanticSha256);
    assert.equal(ownerEvidence.byteIdenticalAfterRepair, true);
    assert.equal(ownerEvidence.semanticIdenticalAfterRepair, true);
  }

  const shadowEvidence = intelligenceEvidence.additionalProtectedConsumerScan.find(
    record => record.path === "intelligence/contracts/shadow-decision-readiness-contracts.json"
  );
  assert.ok(shadowEvidence, "Shadow-readiness protected consumer must be independently reconstructed.");
  const historicalShadowBytes = gitBytes("show", `${historicalCanonicalCommit}:${shadowEvidence.path}`);
  assert.equal(sha256(historicalShadowBytes), shadowEvidence.reconstructionBaseRawSha256);
  const ownerSuccessorShadowBytes = gitBytes("show", `${currentIntelligenceOwnerSuccessorCommit}:${shadowEvidence.path}`);
  assert.equal(sha256(ownerSuccessorShadowBytes), shadowEvidence.reconstructedRawSha256);
  assert.equal(semanticSha256(JSON.parse(ownerSuccessorShadowBytes)), shadowEvidence.reconstructedSemanticSha256);
  assert.equal(shadowEvidence.byteIdenticalAfterRepair, true);
  assert.equal(shadowEvidence.semanticIdenticalAfterRepair, true);

  const dashboardAlignment = dashboardContract.repViewContract.placesAccess.alignmentEvidence;
  assert.equal(gap.overwatchOwnedFile.path, dashboardContractPath);
  assert.equal(gap.overwatchOwnedFile.canonicalOwner, "Prometheus Overwatch");
  assert.equal(gap.overwatchOwnedFile.dashboardOwnerRevalidationCommit, dashboardProspectiveCommit);
  assert.equal(gap.overwatchOwnedFile.prospectiveShadowSeamCommit, dashboardProspectiveCommit);
  assert.equal(dashboardAlignment.dashboardCommit, dashboardCollectionOffCommit);
  assert.equal(dashboardAlignment.dashboardOwnerRevalidationCommit, dashboardProspectiveCommit);
  assert.equal(dashboardAlignment.prospectiveShadowSeamCommit, dashboardProspectiveCommit);
  assert.equal(dashboardAlignment.prospectiveCollectionOffSuppressionCommit, dashboardCollectionOffCommit);
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
  assert.equal(mapping.ownerRepairChain.dashboardCommit, dashboardRepairCommit);
  assert.equal(mapping.ownerRepairChain.currentDashboardSuccessorCommit, dashboardProspectiveCommit);
  assert.deepEqual(mapping.ownerRepairChain.currentIntelligenceSuccessorCommits, currentIntelligenceSuccessorCommits);

  const currentIntelligenceSuccessor = mapping.currentIntelligenceOwnerSuccessor;
  assert.equal(currentIntelligenceSuccessor.batchId, "BATCH-20260714-001");
  assert.equal(currentIntelligenceSuccessor.commit, currentIntelligenceOwnerSuccessorCommit);
  assert.equal(currentIntelligenceSuccessor.tree, git("rev-parse", `${currentIntelligenceOwnerSuccessorCommit}^{tree}`));
  assert.equal(currentIntelligenceSuccessor.canonicalOwner, "Prometheus Intelligence Engine");
  assert.equal(currentIntelligenceSuccessor.predecessorCommit, "e0f14743867bf765f05225e0321f2596741b8c70");
  assert.equal(currentIntelligenceSuccessor.legacyProvenanceArtifactsModified, true);
  assert.equal(currentIntelligenceSuccessor.legacyProvenanceGapPreserved, true);
  assert.equal(
    currentIntelligenceSuccessor.semanticSpecificationPath,
    "intelligence/provenance/specifications/administrative-disposition-admission-v1.json",
  );
  assert.equal(
    sha256(read(currentIntelligenceSuccessor.semanticSpecificationPath)),
    currentIntelligenceSuccessor.semanticSpecificationSha256,
  );
  assert.equal(currentIntelligenceSuccessor.targetHashesStoredInSemanticSpecification, false);
  assert.equal(currentIntelligenceSuccessor.recommendationInfluence, "OFF");
  for (const consumer of currentIntelligenceSuccessor.protectedConsumers) {
    assert.equal(
      sha256(gitBytes("show", `${currentIntelligenceOwnerSuccessorCommit}:${consumer.path}`)),
      consumer.sha256,
      `${consumer.path} historical owner-successor hash drifted.`
    );
  }

  assert.equal(protectedBaselineSuccessor.version, "route-iq-intelligence-protected-baseline-synchronization-v1");
  assert.equal(protectedBaselineSuccessor.batchId, "BATCH-20260714-002");
  assert.equal(protectedBaselineSuccessor.status, "OWNER_VALIDATED_SUCCESSOR");
  assert.equal(protectedBaselineSuccessor.ownerSubsystem, "Prometheus Intelligence Engine");
  assert.equal(protectedBaselineSuccessor.historicalCheckpoint.path, intelligenceEvidencePath);
  assert.equal(protectedBaselineSuccessor.historicalCheckpoint.sha256, sha256(read(intelligenceEvidencePath)));
  assert.equal(protectedBaselineSuccessor.historicalCheckpoint.remainsHistorical, true);
  assert.equal(protectedBaselineSuccessor.historicalCheckpoint.rewritten, false);
  assert.deepEqual(
    protectedBaselineSuccessor.integratedOwnerCommits.map(record => record.commit),
    ["0027244ba069b741f283ab6871cf882d46f2c935", dashboardCollectionOffCommit]
  );

  for (const transition of protectedBaselineSuccessor.protectedSourceTransitions) {
    assert.equal(
      sha256(gitBytes("show", `${protectedBaselineSuccessorCommit}^:${transition.path}`)),
      transition.currentSha256,
      `${transition.path} was not frozen before the Intelligence successor commit.`
    );
  }

  const synchronizedConsumerPaths = protectedBaselineSuccessor.synchronizedConsumers.map(record => record.path).sort();
  assert.deepEqual(synchronizedConsumerPaths, [
    ...intelligenceContractPaths,
    "intelligence/contracts/shadow-decision-readiness-contracts.json"
  ].sort());
  for (const consumer of protectedBaselineSuccessor.synchronizedConsumers) {
    assert.equal(
      sha256(gitBytes("show", `${protectedBaselineSuccessorCommit}^:${consumer.path}`)),
      consumer.previousSha256,
      `${consumer.path} previous protected baseline drifted.`
    );
    assert.equal(
      sha256(gitBytes("show", `${protectedBaselineSuccessorCommit}:${consumer.path}`)),
      consumer.currentSha256,
      `${consumer.path} first owner successor commit drifted.`
    );
  }
  assert.equal(protectedBaselineSuccessor.advisoryArtifacts.regenerationRequired, false);
  for (const [field, expected] of Object.entries({
    collectionDefaultState: "OFF",
    recommendationInfluence: "OFF",
    representativeShadowOutputExposed: false,
    routeOrderingChanged: false,
    candidateVisibilityChanged: false,
    routeScoringChanged: false,
    notificationBehaviorChanged: false,
    automaticActionIntroduced: false,
    validCollectionOnFixturePreservesPreActionNextStopSeal: true,
    candidateCompletenessServerOwned: true,
    identityAndTimestampsServerOwned: true,
    exactlyOnceIdempotentAppendOnlyEvidencePreserved: true,
    zeroLiveGooglePreserved: true
  })) {
    assert.equal(protectedBaselineSuccessor.boundaryValidation[field], expected, `${field} successor boundary drifted.`);
  }

  assert.equal(routeQualitySuccessor.version, "route-iq-intelligence-route-quality-protected-baseline-successor-v1");
  assert.equal(routeQualitySuccessor.batchId, "BATCH-20260714-002");
  assert.equal(routeQualitySuccessor.status, "OWNER_VALIDATED_SUCCESSOR");
  assert.equal(routeQualitySuccessor.ownerSubsystem, "Prometheus Intelligence Engine");
  assert.equal(routeQualitySuccessor.predecessor.path, protectedBaselineSuccessorPath);
  assert.equal(routeQualitySuccessor.predecessor.commit, protectedBaselineSuccessorCommit);
  assert.equal(
    routeQualitySuccessor.predecessor.sha256,
    sha256(gitBytes("show", `${protectedBaselineSuccessorCommit}:${protectedBaselineSuccessorPath}`))
  );
  assert.equal(routeQualitySuccessor.predecessor.remainsHistorical, true);
  assert.equal(routeQualitySuccessor.predecessor.rewritten, false);

  const dataTransition = routeQualitySuccessor.dataOwnerTransition;
  assert.equal(dataTransition.commit, routeQualityDataCommit);
  assert.equal(dataTransition.tree, git("rev-parse", `${routeQualityDataCommit}^{tree}`));
  assert.equal(dataTransition.ownerSubsystem, "Prometheus Data");
  assert.deepEqual(dataTransition.dashboardFetchEvidence, {
    previousSourceFetches: 8,
    previousDeployFetches: 8,
    currentSourceFetches: 9,
    currentDeployFetches: 9
  });
  for (const transition of [dataTransition.routeQualityGate, dataTransition.canonicalRouteQualityReport]) {
    assert.equal(
      sha256(gitBytes("show", `${routeQualityDataCommit}^:${transition.path}`)),
      transition.previousSha256,
      `${transition.path} previous Data hash drifted.`
    );
    assert.equal(
      sha256(gitBytes("show", `${routeQualityDataCommit}:${transition.path}`)),
      transition.currentSha256,
      `${transition.path} Data owner commit hash drifted.`
    );
    assert.equal(sha256(read(transition.path)), transition.currentSha256, `${transition.path} canonical Data hash drifted.`);
  }

  const affectedReferences = routeQualitySuccessor.protectedReferenceAudit.affectedIntelligenceReferences;
  assert.equal(affectedReferences.length, 1);
  const routeQualityReference = affectedReferences[0];
  assert.equal(routeQualityReference.consumerPath, "intelligence/contracts/shadow-decision-readiness-contracts.json");
  assert.equal(routeQualityReference.protectedSourcePath, dataTransition.routeQualityGate.path);
  assert.equal(
    sha256(gitBytes("show", `${routeQualitySuccessorCommit}^:${routeQualityReference.consumerPath}`)),
    routeQualityReference.previousConsumerSha256
  );
  assert.equal(
    sha256(gitBytes("show", `${routeQualitySuccessorCommit}:${routeQualityReference.consumerPath}`)),
    routeQualityReference.currentConsumerSha256
  );
  assert.equal(routeQualityReference.previousProtectedSha256, dataTransition.routeQualityGate.previousSha256);
  assert.equal(routeQualityReference.currentProtectedSha256, dataTransition.routeQualityGate.currentSha256);
  assert.equal(routeQualitySuccessor.protectedReferenceAudit.canonicalReportPinnedByIntelligence, false);
  assert.deepEqual(routeQualitySuccessor.protectedReferenceAudit.canonicalReportReferenceMatches, []);
  assert.equal(routeQualitySuccessor.protectedReferenceAudit.allAffectedReferencesAccountedFor, true);
  assert.equal(routeQualitySuccessor.advisoryArtifacts.regenerationRequired, false);
  for (const [field, expected] of Object.entries({
    collectionDefaultState: "OFF",
    recommendationInfluence: "OFF",
    readinessState: "INSUFFICIENT_EVIDENCE",
    representativeShadowOutputExposed: false,
    routeOrderingChanged: false,
    candidateVisibilityChanged: false,
    routeScoringChanged: false,
    routeGenerationChanged: false,
    dashboardBehaviorChanged: false,
    dataBehaviorChangedByIntelligence: false,
    infrastructureBehaviorChangedByIntelligence: false,
    zeroLiveGooglePreserved: true
  })) {
    assert.equal(routeQualitySuccessor.boundaryValidation[field], expected, `${field} route-quality successor boundary drifted.`);
  }

  const dataValidation = mapping.dataOwnerValidation;
  assert.equal(dataValidation.contractMismatchClosed, true);
  assert.equal(
    sha256(gitBytes("show", `${dataValidation.currentOwnerSuccessorCommit}:${dataValidation.dataArchiveRuntimePath}`)),
    dataValidation.dataArchiveRuntimeSha256
  );
  assert.equal(
    sha256(gitBytes("show", `${dataValidation.currentOwnerSuccessorCommit}:${dataValidation.dataRuntimeContractPath}`)),
    dataValidation.dataRuntimeContractSha256
  );
  assert.equal(sha256(read(dataValidation.historicalRawArchivePath)), dataValidation.historicalRawArchiveSha256);
  assert.equal(sha256(read(dataValidation.historicalNormalizedArchivePath)), dataValidation.historicalNormalizedArchiveSha256);
  assert.equal(dataValidation.knownAndContemporaneousUnknownClassification, "action_time_observation");
  assert.equal(dataValidation.legacyFallbackClassification, "late_report_finalization_unknown");
  assert.equal(dataValidation.lateFallbackMaySatisfyOriginalShadowOpportunity, false);
  assert.equal(dataValidation.historicalArchiveRewritten, false);
  assert.equal(dataValidation.retryAndReplayRemainIdempotent, true);
  assert.equal(dataValidation.workspaceIsolationPreserved, true);
  assert.equal(dataValidation.currentOwnerSuccessorCommit, "f50d10f14f993b4e6ff42887e76c10721852cc43");

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
    productionConsumerIntroduced: false,
    currentIntelligenceOwnerSuccessor: currentIntelligenceOwnerSuccessorCommit,
    protectedBaselineSuccessor: protectedBaselineSuccessorCommit,
    routeQualitySuccessor: routeQualitySuccessorCommit
  };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  console.log(JSON.stringify(verifyReleaseProvenanceRepair(), null, 2));
}
