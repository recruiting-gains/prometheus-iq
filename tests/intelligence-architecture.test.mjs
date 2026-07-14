import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  batchId as provenanceBatchId,
  legacyProvenanceGapCommit,
  provenanceStatus
} from "../intelligence/provenance/reconstruct-legacy-protected-contracts-v1.mjs";

const root = resolve(import.meta.dirname, "..");
const read = path => readFileSync(resolve(root, path), "utf8");
const readJson = path => JSON.parse(read(path));
const sha256 = path => createHash("sha256").update(readFileSync(resolve(root, path))).digest("hex");
const sha256Bytes = bytes => createHash("sha256").update(bytes).digest("hex");
const stable = value => {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map(key => `${JSON.stringify(key)}:${stable(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
};
const semanticSha256Bytes = bytes => createHash("sha256")
  .update(stable(JSON.parse(bytes.toString("utf8"))))
  .digest("hex");
const git = args => {
  const result = spawnSync("git", args, {cwd: root, encoding: "utf8"});
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  return result.stdout.trim();
};
const gitBytes = args => {
  const result = spawnSync("git", args, {cwd: root});
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  return result.stdout;
};

test("intelligence architecture validation gate passes", () => {
  const result = spawnSync("node", ["scripts/validate-intelligence-architecture.mjs"], {
    cwd: root,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test("adaptive intelligence contract registry is architecture-only", () => {
  const contracts = readJson("intelligence/contracts/adaptive-intelligence-contracts.json");

  assert.equal(contracts.status, "architecture_only");
  assert.equal(contracts.productionBehaviorChanged, false);
  assert.equal(contracts.scoringChanged, false);
  assert.equal(contracts.dashboardRuntimeChanged, false);
  assert.equal(contracts.activePoolChanged, false);
  assert.equal(contracts.dataGovernanceChanged, false);
});

test("adaptive intelligence architecture covers required outside-sales learning domains", () => {
  const contracts = readJson("intelligence/contracts/adaptive-intelligence-contracts.json");
  const requiredDomains = [
    "visit_outcome_learning",
    "confidence_engine",
    "recommendation_explanation_engine",
    "industry_intelligence",
    "territory_intelligence",
    "rep_intelligence",
    "organization_intelligence",
    "continuous_learning_pipeline",
    "opportunity_ranking",
    "pattern_detection",
    "recommendation_confidence",
    "explainable_ai",
    "human_override",
    "knowledge_graph",
    "learning_contracts"
  ];

  for (const domain of requiredDomains) {
    assert.ok(contracts.capabilityDomains.includes(domain), `Missing domain ${domain}`);
  }
});

test("future subsystem handoffs are prepared without production integration", () => {
  const handoffs = read("intelligence/future-subsystem-handoffs.md");
  const expected = ["Dashboard Handoff", "CRM Handoff", "Research Handoff", "Companion Handoff", "Data Handoff", "Sales Handoff"];

  for (const heading of expected) {
    assert.ok(handoffs.includes(heading), `Missing ${heading}`);
  }
  assert.ok(handoffs.includes("This document prepares future handoffs. It does not authorize implementation."));
});

test("field learning loop foundation covers completed visit evidence and learning contracts", () => {
  const foundation = read("intelligence/adaptive-field-learning-loop-foundation.md");
  const contracts = readJson("intelligence/contracts/field-learning-loop-contracts.json");

  const expectedEvidenceFields = [
    "business_visited",
    "date_time",
    "gps_confirmation",
    "decision_maker_reached",
    "conversation_occurred",
    "sale_made",
    "no_decision_maker",
    "closed_business",
    "wrong_business",
    "duplicate",
    "no_parking",
    "gatekeeper",
    "follow_up_needed",
    "competitor_present",
    "customer_objections",
    "notes",
    "photos_future"
  ];

  for (const field of expectedEvidenceFields) {
    assert.ok(contracts.evidenceFields.includes(field), `Missing evidence field ${field}`);
  }

  for (const heading of ["Field Evidence Capture", "Learning Signal Normalization", "Confidence Framework", "Explainability Framework", "Human Override"]) {
    assert.ok(foundation.includes(heading), `Missing foundation heading ${heading}`);
  }
});

test("field learning loop remains production-safe and reviewable", () => {
  const contracts = readJson("intelligence/contracts/field-learning-loop-contracts.json");

  assert.equal(contracts.status, "architecture_only");
  assert.equal(contracts.productionBehaviorChanged, false);
  assert.equal(contracts.scoringChanged, false);
  assert.equal(contracts.dashboardRuntimeChanged, false);
  assert.equal(contracts.activePoolChanged, false);
  assert.equal(contracts.dataGovernanceChanged, false);
  assert.equal(contracts.infrastructureChanged, false);
  assert.equal(contracts.anthonyBetaChanged, false);
  assert.equal(contracts.productionLearningActive, false);
  assert.ok(contracts.requiredActivationGates.includes("human_review_state"));
  assert.ok(contracts.prohibitions.includes("no_production_learning_activation"));
});

test("field learning loop prepares required subsystem contracts without consumption", () => {
  const handoffs = read("intelligence/field-learning-loop-handoffs.md");
  const contracts = readJson("intelligence/contracts/field-learning-loop-contracts.json");
  const expected = ["Dashboard", "CRM", "Research", "Companion", "Sales"];

  for (const subsystem of expected) {
    assert.ok(handoffs.includes(`${subsystem} Handoff`), `Missing ${subsystem} handoff`);
    assert.ok(contracts.futureSubsystemContracts.includes(subsystem), `Missing ${subsystem} contract`);
  }

  assert.ok(handoffs.includes("It does not authorize production integration."));
});

test("read-only archived-session learning is independently authorized without recommendation activation", () => {
  const contract = readJson("intelligence/contracts/read-only-field-session-learning-contracts.json");
  const policy = readJson("intelligence/config/read-only-field-session-learning-policy-v1.json");
  const snapshot = readJson("intelligence/artifacts/read-only-field-session-learning/fitness_connection/cruz/learning-snapshot-v1.json");

  assert.equal(contract.status, "active_read_only");
  assert.equal(contract.independentAuthorization.status, "AUTHORIZED_ACTIVE");
  assert.equal(contract.independentAuthorization.accessMode, "read_only");
  assert.equal(contract.allowedOperations.modifyData, false);
  assert.equal(contract.allowedOperations.replaySessions, false);
  assert.equal(contract.productionSafety.productionRecommendationInfluenceActive, false);
  assert.equal(contract.productionSafety.routeScoringWeightsChanged, false);
  assert.equal(policy.recommendationInfluence.singleSessionInfluenceAllowed, false);
  assert.equal(policy.recommendationInfluence.activationStatus, "disabled_pending_future_handoff");
  assert.equal(snapshot.sourceEvidence.verifiedSessionCount, 1);
  assert.equal(snapshot.recommendationSafety.recommendationEligibleConclusionCount, 0);
  assert.equal(snapshot.archiveSafety.archiveMutationPerformed, false);
  assert.equal(snapshot.archiveSafety.historicalReplayPerformed, false);
});

test("off-route learning is source-aware, unknown-safe, and observation-only", () => {
  const contract = readJson("intelligence/contracts/off-route-learning-intelligence-contracts.json");
  const policy = readJson("intelligence/config/off-route-learning-intelligence-v1.json");
  const snapshot = readJson("intelligence/artifacts/off-route-learning-intelligence-v1/fitness_connection/cruz/off-route-learning-snapshot-v1.json");

  assert.equal(contract.status, "active_read_only_observation");
  assert.equal(contract.upstreamReadOnlyLearning.canonicalArchiveReaderReused, true);
  assert.equal(contract.decisionSourceContract.unknownFallbackRequired, true);
  assert.equal(contract.decisionSourceContract.notesMaySupplySource, false);
  assert.equal(contract.recommendationDecisionContract.overrideRequiresExplicitDecisionContext, true);
  assert.equal(contract.recommendationDecisionContract.offRouteAutomaticallyMeansOverride, false);
  assert.equal(contract.validationFixturePolicy.productionConsumptionAllowed, false);
  assert.equal(contract.readOnlySafety.modifyData, false);
  assert.equal(contract.readOnlySafety.modifyDashboard, false);
  assert.equal(contract.readOnlySafety.modifyRecommendationScoring, false);
  assert.equal(contract.readOnlySafety.activateRecommendationInfluence, false);
  assert.equal(policy.sourceTaxonomy.length, 8);
  assert.equal(policy.recommendationInfluence.activationStatus, "disabled_observation_only");
  assert.equal(snapshot.sourceEvidence.totalVisits, 4);
  assert.equal(snapshot.sourceEvidence.knownSourceVisits, 0);
  assert.equal(snapshot.sourceEvidence.unknownSourceVisits, 4);
  assert.equal(snapshot.recommendationAcceptanceRate.valuePercent, null);
  assert.equal(snapshot.recommendationOverrideRate.valuePercent, null);
  assert.equal(snapshot.learningConfidence.recommendationInfluenceEligible, false);
  assert.equal(snapshot.safety.recommendationScoringChanged, false);
  assert.equal(snapshot.safety.recommendationBehaviorChanged, false);
});

test("Discovery Mode v2 is a governed advisory composer without production influence", () => {
  const contract = readJson("intelligence/contracts/discovery-mode-intelligence-v2-contracts.json");
  const config = readJson("intelligence/config/discovery-mode-intelligence-v2.json");
  const plan = readJson("intelligence/artifacts/discovery-mode-intelligence-v2/fitness_connection/cruz/discovery-queue-plan-v2.json");

  assert.equal(contract.status, "advisory_only");
  assert.equal(contract.outputContract.runtimeConsumptionAuthorized, false);
  assert.equal(contract.outputContract.recommendationMutationAuthorized, false);
  assert.equal(contract.compositionContract.fixedRotationAllowed, false);
  assert.equal(contract.eligibilityContract.canonicalImplementation, "intelligence/route-business-hours-eligibility.mjs");
  assert.equal(contract.eligibilityContract.balancingOccursAfterEligibility, true);
  assert.equal(contract.eligibilityContract.closedVerifiedEligible, false);
  assert.equal(config.queueComposition.fixedCategoryRotation, false);
  assert.equal(config.queueComposition.preserveExistingScores, true);
  assert.equal(config.candidatePolicy.requiresCanonicalBusinessHoursEligibility, true);
  assert.equal(config.evidencePolicy.singleSessionCategoryPreferenceAllowed, false);
  assert.equal(config.activationSafety.recommendationInfluenceActive, false);
  assert.equal(config.activationSafety.routeScoringWeightsChanged, false);
  assert.equal(plan.queuePlan.plannedSize, 15);
  assert.ok(plan.queuePlan.compositionMetrics.distinctCategoryCount >= 4);
  assert.ok(plan.queuePlan.compositionMetrics.maximumCategoryShare <= 0.27);
  assert.equal(plan.queuePlan.compositionMetrics.duplicateCount, 0);
  assert.equal(plan.queuePlan.eligibilityMetrics.selectedClosedVerifiedCount, 0);
  assert.equal(plan.queuePlan.eligibilityMetrics.scoringChanged, false);
  assert.equal(plan.validation.canonicalBusinessHoursEligibilityPreserved, true);
  assert.equal(plan.validation.productionQueueConsumerActive, false);
});

test("Nearby Context v2 is relationship-aware, governed, and consumer-safe", () => {
  const contract = readJson("intelligence/contracts/nearby-context-intelligence-v2-contracts.json");
  const config = readJson("intelligence/config/nearby-context-intelligence-v2.json");
  const audit = readJson("intelligence/artifacts/nearby-context-intelligence-v2/fitness_connection/cruz/nearby-context-audit-v2.json");

  assert.equal(contract.status, "advisory_only");
  assert.equal(contract.outputContract.runtimeConsumptionAuthorized, false);
  assert.equal(contract.outputContract.recommendationMutationAuthorized, false);
  assert.equal(contract.eligibilityContract.canonicalImplementation, "intelligence/route-business-hours-eligibility.mjs");
  assert.equal(contract.eligibilityContract.relationshipClassificationOccursAfterEligibility, true);
  assert.equal(contract.eligibilityContract.closedVerifiedEligible, false);
  assert.equal(contract.identityContract.canonicalFunction, "routeQueueIdentity");
  assert.equal(contract.identityContract.googlePlaceIdPriority, true);
  assert.equal(contract.identityContract.duplicateRemovalBeforeRelationshipInference, true);
  assert.equal(contract.identityContract.duplicateAliasesContributeToInference, false);
  assert.equal(contract.identityContract.multiTenantDistinction, "distinct_google_place_ids_remain_distinct");
  assert.deepEqual(contract.relationshipContract.priorityOrder, [
    "same_building",
    "same_shopping_center",
    "same_commercial_parcel",
    "walkable",
    "nearby"
  ]);
  assert.equal(contract.selectionContract.quarantineSelectable, false);
  assert.equal(contract.selectionContract.completedBusinessesSelectable, false);
  assert.equal(contract.selectionContract.recommendationScoresUsedForOrdering, false);
  assert.equal(config.identityPolicy.deduplicationPhase, "before_relationship_classification");
  assert.equal(config.identityPolicy.shoppingCenterInferenceInput, "unique_canonical_businesses_only");
  assert.equal(config.identityPolicy.duplicateAliasContributionAllowed, false);
  assert.equal(config.fieldEvidenceBasis.learningInput, false);
  assert.equal(config.activationSafety.dashboardConsumerActive, false);
  assert.equal(config.activationSafety.routeScoringWeightsChanged, false);
  assert.equal(audit.stressContexts.length, 2);
  assert.equal(audit.stressContexts.every(context => context.plan.status === "coverage_gap"), true);
  assert.equal(audit.stressContexts.every(context => context.plan.nearbyOpportunities.emptyState.recommendationInvented === false), true);
  assert.equal(audit.governedCapabilityProbe.nearbyOpportunities.count, 6);
  assert.equal(audit.governedCapabilityProbe.nearbyOpportunities.entries.every(entry => entry.eligibilitySnapshot.status === "OPEN_VERIFIED"), true);
  assert.equal(audit.governedCapabilityProbe.nearbyOpportunities.entries.every(entry => entry.recommendationScoreChanged === false), true);
  assert.equal(audit.identityIntegrationRegression.aliasProbe.preRelationshipDuplicateCount, 1);
  assert.equal(audit.identityIntegrationRegression.aliasProbe.relationshipInferenceInputCount, 1);
  assert.equal(audit.identityIntegrationRegression.aliasProbe.shoppingCenterInferenceSatisfied, false);
  assert.equal(audit.identityIntegrationRegression.multiTenantProbe.resultCount, 2);
});

test("legacy mixed-ownership Intelligence contracts have independently derived owner evidence", () => {
  const evidencePath = "intelligence/provenance/legacy-provenance-gap-049cf583-v1.json";
  const evidence = readJson(evidencePath);
  const administrativeDispositionSpecificationPath =
    "intelligence/provenance/specifications/administrative-disposition-admission-v1.json";
  const administrativeDispositionSpecification = readJson(
    administrativeDispositionSpecificationPath,
  );
  const expectedPaths = [
    "intelligence/contracts/discovery-mode-intelligence-v2-contracts.json",
    "intelligence/contracts/nearby-context-intelligence-v2-contracts.json",
    "intelligence/contracts/off-route-learning-intelligence-contracts.json",
    "intelligence/contracts/read-only-field-session-learning-contracts.json"
  ].sort();

  assert.equal(evidence.batchId, provenanceBatchId);
  assert.equal(evidence.status, provenanceStatus);
  assert.equal(evidence.legacyCommit, legacyProvenanceGapCommit);
  assert.match(evidence.ownershipStatement, /does not claim retroactive Intelligence ownership/);
  assert.equal(
    evidence.semanticRevisionSpecification.path,
    administrativeDispositionSpecificationPath,
  );
  assert.equal(
    evidence.semanticRevisionSpecification.sha256,
    sha256(administrativeDispositionSpecificationPath),
  );
  assert.equal(
    evidence.semanticRevisionSpecification.version,
    administrativeDispositionSpecification.version,
  );
  assert.equal(evidence.semanticRevisionSpecification.targetHashesStored, false);
  assert.equal(
    JSON.stringify(administrativeDispositionSpecification).includes(
      sha256("intelligence/contracts/read-only-field-session-learning-contracts.json"),
    ),
    false,
  );
  assert.deepEqual(evidence.contracts.map(contract => contract.path).sort(), expectedPaths);
  assert.deepEqual(evidence.protectedConsumerInventory, [
    ...expectedPaths,
    "intelligence/contracts/shadow-decision-readiness-contracts.json",
  ].sort());
  const evidenceCommit = git(["log", "-1", "--format=%H", "--", evidencePath]);

  for (const recorded of evidence.contracts) {
    const legacyBytes = gitBytes(["show", `${legacyProvenanceGapCommit}:${recorded.path}`]);
    const historicalBytes = gitBytes(["show", `${evidenceCommit}:${recorded.path}`]);
    assert.equal(sha256Bytes(legacyBytes), recorded.legacyCommitRawSha256, recorded.path);
    assert.equal(
      sha256Bytes(historicalBytes),
      recorded.canonicalAfterRepairRawSha256,
      recorded.path,
    );
    assert.equal(
      semanticSha256Bytes(historicalBytes),
      recorded.canonicalAfterRepairSemanticSha256,
      recorded.path,
    );
    assert.equal(recorded.canonicalAfterRepairRawSha256, recorded.reconstructedRawSha256, recorded.path);
    assert.equal(recorded.canonicalAfterRepairSemanticSha256, recorded.reconstructedSemanticSha256, recorded.path);
    assert.equal(recorded.byteIdenticalAfterRepair, true, recorded.path);
    assert.equal(recorded.semanticIdenticalAfterRepair, true, recorded.path);
    assert.equal(recorded.byteIdenticalBeforeRepair, false, recorded.path);
    assert.equal(recorded.semanticIdenticalBeforeRepair, false, recorded.path);
    assert.notEqual(recorded.canonicalBeforeRepairRawSha256, recorded.canonicalAfterRepairRawSha256, recorded.path);
    assert.ok(recorded.reconstructionSources.length >= 6, recorded.path);
    for (const source of recorded.reconstructionSources) {
      assert.equal(
        sha256Bytes(gitBytes(["show", `${evidenceCommit}:${source.path}`])),
        source.sha256,
        source.path,
      );
    }
    if (
      recorded.id === "read_only_field_session_learning" ||
      recorded.id === "off_route_learning"
    ) {
      assert.equal(
        recorded.semanticRevision.specificationPath,
        administrativeDispositionSpecificationPath,
      );
      assert.equal(recorded.semanticRevision.targetHashesStoredInSpecification, false);
      assert.equal(
        recorded.semanticRevision.specificationSha256,
        sha256(administrativeDispositionSpecificationPath),
      );
    }
  }

  if (evidenceCommit) {
    assert.match(evidenceCommit, /^[a-f0-9]{40}$/);
    assert.equal(git(["rev-parse", `${evidenceCommit}^`]), evidence.integratedBase);
    assert.equal(git(["merge-base", "--is-ancestor", legacyProvenanceGapCommit, evidenceCommit]), "");
  } else {
    assert.equal(git(["rev-parse", "HEAD"]), evidence.integratedBase);
  }
});

test("every Intelligence protected consumer is synchronized and remains zero influence", () => {
  const evidence = readJson("intelligence/provenance/legacy-provenance-gap-049cf583-v1.json");
  const successor = readJson(
    "intelligence/provenance/protected-baseline-synchronization-batch-20260714-002-v1.json",
  );
  const expectedPaths = [
    "intelligence/contracts/discovery-mode-intelligence-v2-contracts.json",
    "intelligence/contracts/nearby-context-intelligence-v2-contracts.json",
    "intelligence/contracts/off-route-learning-intelligence-contracts.json",
    "intelligence/contracts/read-only-field-session-learning-contracts.json",
    "intelligence/contracts/shadow-decision-readiness-contracts.json",
  ].sort();

  assert.equal(successor.batchId, "BATCH-20260714-002");
  assert.equal(successor.status, "OWNER_VALIDATED_SUCCESSOR");
  assert.equal(successor.ownerSubsystem, "Prometheus Intelligence Engine");
  assert.equal(successor.historicalCheckpoint.remainsHistorical, true);
  assert.equal(successor.historicalCheckpoint.rewritten, false);
  assert.equal(
    sha256(successor.historicalCheckpoint.path),
    successor.historicalCheckpoint.sha256,
  );
  assert.deepEqual(successor.synchronizedConsumers.map(consumer => consumer.path).sort(), expectedPaths);
  for (const consumer of successor.synchronizedConsumers) {
    assert.equal(sha256(consumer.path), consumer.currentSha256, consumer.path);
    assert.notEqual(consumer.previousSha256, consumer.currentSha256, consumer.path);
  }
  for (const source of successor.protectedSourceTransitions) {
    assert.equal(sha256(source.path), source.currentSha256, source.path);
    assert.notEqual(source.previousSha256, source.currentSha256, source.path);
  }
  const historicalEvidenceCommit = git([
    "log",
    "-1",
    "--format=%H",
    "--",
    successor.historicalCheckpoint.path,
  ]);
  for (const consumer of [
    ...evidence.contracts,
    ...evidence.additionalProtectedConsumerScan,
  ]) {
    assert.equal(
      sha256Bytes(gitBytes(["show", `${historicalEvidenceCommit}:${consumer.path}`])),
      consumer.canonicalAfterRepairRawSha256,
      consumer.path,
    );
  }
  assert.equal(successor.advisoryArtifacts.regenerationRequired, false);
  assert.equal(successor.boundaryValidation.collectionDefaultState, "OFF");
  assert.equal(successor.boundaryValidation.recommendationInfluence, "OFF");
  assert.equal(successor.boundaryValidation.representativeShadowOutputExposed, false);
  assert.equal(successor.boundaryValidation.routeOrderingChanged, false);
  assert.equal(successor.boundaryValidation.candidateVisibilityChanged, false);
  assert.equal(successor.boundaryValidation.routeScoringChanged, false);
  assert.equal(successor.boundaryValidation.notificationBehaviorChanged, false);
  assert.equal(successor.boundaryValidation.automaticActionIntroduced, false);
  assert.equal(successor.boundaryValidation.validCollectionOnFixturePreservesPreActionNextStopSeal, true);
  assert.equal(successor.boundaryValidation.candidateCompletenessServerOwned, true);
  assert.equal(successor.boundaryValidation.identityAndTimestampsServerOwned, true);
  assert.equal(successor.boundaryValidation.exactlyOnceIdempotentAppendOnlyEvidencePreserved, true);
  assert.equal(successor.boundaryValidation.zeroLiveGooglePreserved, true);
  assert.equal(evidence.methodologyConstraints.requiredEvaluationOutcomes, "97 eligible, linked, scoreable evaluation outcomes after exclusions");
  assert.equal(evidence.methodologyConstraints.requiredSampleAloneCanReachFounderReview, false);
  assert.equal(evidence.methodologyConstraints.minimumSupportedObservationsAcrossFivePopulatedBins, 100);
  assert.equal(evidence.methodologyConstraints.sparseOrEmptyBinsMayBypassCoverage, false);
  assert.equal(evidence.methodologyConstraints.causalUpliftOrRecommendationSuperiorityClaimAllowed, false);
  assert.equal(evidence.safety.recommendationInfluence, "OFF");
  assert.equal(evidence.safety.routeScoringChanged, false);
  assert.equal(evidence.safety.routeGenerationChanged, false);
  assert.equal(evidence.safety.representativeExposureChanged, false);
  assert.equal(evidence.safety.prospectiveShadowCollectionStarted, false);
  assert.equal(evidence.safety.productionConsumerIntroduced, false);
});

test("administrative disposition semantics are owner-derived and zero influence", () => {
  const specification = readJson(
    "intelligence/provenance/specifications/administrative-disposition-admission-v1.json",
  );
  const readOnly = readJson(
    "intelligence/contracts/read-only-field-session-learning-contracts.json",
  );
  const offRoute = readJson(
    "intelligence/contracts/off-route-learning-intelligence-contracts.json",
  );
  const shadowReadiness = readJson(
    "intelligence/contracts/shadow-decision-readiness-contracts.json",
  );

  assert.deepEqual(
    readOnly.administrativeDispositionAdmission.requiredExcludedDomains,
    specification.requiredExcludedDomains,
  );
  assert.equal(
    readOnly.allowedOperations.consumeAdministrativelyExcludedSessions,
    false,
  );
  assert.equal(
    offRoute.administrativeDispositionAdmission.inheritedFromUpstreamReadOnlyLearning,
    true,
  );
  assert.equal(
    offRoute.readOnlySafety.consumeAdministrativelyExcludedSessions,
    false,
  );
  assert.deepEqual(
    shadowReadiness.administrativeDispositionAdmission.requiredExcludedDomains,
    specification.requiredExcludedDomains,
  );
  assert.equal(
    shadowReadiness.administrativeDispositionAdmission
      .disposedSessionRecommendationInputAllowed,
    false,
  );
  assert.equal(
    shadowReadiness.prospectiveRuntimeAdapter.currentState
      .recommendationInfluence,
    "OFF",
  );
  assert.equal(shadowReadiness.isolation.recommendationInfluence, "OFF");
});
