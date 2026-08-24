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
import {
  verifyPaidCustomerRevenueReadinessProtectedConsumers
} from "../intelligence/provenance/verify-paid-customer-revenue-readiness-protected-consumers-v1.mjs";

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
const transitionMap = transitions => {
  const byPath = new Map();
  for (const transition of transitions) {
    const existing = byPath.get(transition.path) || [];
    byPath.set(transition.path, [...existing, transition]);
  }
  return byPath;
};
const git = args => {
  const result = spawnSync("git", args, {cwd: root, encoding: "utf8"});
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  return result.stdout.trim();
};
const gitBytes = args => {
  const result = spawnSync("git", args, {
    cwd: root,
    maxBuffer: 20 * 1024 * 1024,
  });
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
  assert.equal(contract.prospectiveRetentionAdmission.dataExactKeySuccessorCommit, "c73118ddb262d3010bbc94a900f8506fb2f56192");
  assert.equal(contract.prospectiveRetentionAdmission.productionActivationEligible, false);
  assert.equal(contract.administrativeDispositionAdmission.auditProjectionRawPayloadAllowed, false);
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
  assert.equal(contract.prospectiveRetentionAdmission.inheritedFromUpstreamReadOnlyLearning, true);
  assert.equal(contract.prospectiveRetentionAdmission.productionActivationEligible, false);
  assert.equal(contract.administrativeDispositionAdmission.auditProjectionRawPayloadAllowed, false);
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
  assert.equal(plan.status, "exhausted_advisory_plan");
  assert.equal(plan.sourceProvenance.activePoolRecordCount, 0);
  assert.equal(plan.queuePlan.plannedSize, 0);
  assert.deepEqual(plan.queuePlan.entries, []);
  assert.equal(plan.queuePlan.compositionMetrics.distinctCategoryCount, 0);
  assert.equal(plan.queuePlan.compositionMetrics.maximumCategoryShare, 0);
  assert.ok(plan.queuePlan.failureReasons.includes("no_qualified_discovery_candidates"));
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
  assert.equal(audit.sourceCounts.active, 0);
  assert.equal(audit.governedCapabilityProbe.status, "coverage_gap");
  assert.equal(audit.governedCapabilityProbe.nearbyOpportunities.count, 0);
  assert.deepEqual(audit.governedCapabilityProbe.nearbyOpportunities.entries, []);
  assert.equal(
    audit.governedCapabilityProbe.nearbyOpportunities.emptyState.recommendationInvented,
    false,
  );
  assert.equal(audit.governedCapabilityProbe.coverage.governedDataInvented, false);
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
  const routeQualitySuccessor = readJson(
    "intelligence/provenance/protected-baseline-synchronization-batch-20260714-002-route-quality-successor-v1.json",
  );
  const retentionSuccessor = readJson(
    "intelligence/provenance/protected-baseline-synchronization-batch-20260714-003-retention-v1.json",
  );
  const currentRetentionAuthority = readJson(
    "intelligence/provenance/protected-baseline-synchronization-batch-20260714-004-retention-v1.json",
  );
  const retentionArchitectureSuccessor = readJson(
    "intelligence/provenance/protected-baseline-synchronization-batch-20260714-004-architecture-successor-v1.json",
  );
  const crossIndustryRetentionSuccessor = readJson(
    "intelligence/provenance/protected-baseline-synchronization-cross-industry-dashboard-retention-successor-v1.json",
  );
  const zipFounderAccessSuccessor = readJson(
    "intelligence/provenance/protected-baseline-synchronization-cross-industry-zip-founder-access-v1.json",
  );
  const fieldSessionReportTypeSuccessor = readJson(
    "intelligence/provenance/protected-baseline-synchronization-field-session-report-type-contract-v1.json",
  );
  const retentionDeletionSuccessor = readJson(
    "intelligence/provenance/protected-baseline-synchronization-retention-deletion-runtime-v1.json",
  );
  assert.equal(
    retentionDeletionSuccessor.version,
    "route-iq-intelligence-retention-deletion-runtime-successor-v1",
  );
  assert.equal(
    retentionDeletionSuccessor.status,
    "OWNER_REVIEWED_PROTECTED_COHERENCE_SUCCESSOR",
  );
  const retentionDeletionTransitions = transitionMap(
    retentionDeletionSuccessor.protectedSourceTransitions,
  );
  const retentionDeletionRuntimeSuccessor = {
    successor: retentionDeletionSuccessor,
    successorTransitionsByPath: retentionDeletionTransitions,
    transitionsByPath: retentionDeletionTransitions,
  };
  const prospectiveCalibration = readJson(
    "intelligence/provenance/protected-baseline-synchronization-prospective-calibration-production-admission-v1.json",
  );
  assert.equal(
    prospectiveCalibration.version,
    "route-iq-intelligence-prospective-calibration-production-admission-successor-v1",
  );
  assert.equal(
    prospectiveCalibration.truthState.governedLearning,
    "INSUFFICIENT_EVIDENCE",
  );
  const prospectiveCalibrationSuccessor = {
    successor: prospectiveCalibration,
    transitionsByPath: transitionMap(prospectiveCalibration.protectedSourceTransitions),
  };
  const leanPhase1ProtectedSuccessor = readJson(
    "overwatch/retirement/phase-1-intelligence-protected-successor.json",
  );
  assert.equal(
    leanPhase1ProtectedSuccessor.version,
    "prometheus-lean-phase-1-intelligence-protected-successor-v1",
  );
  assert.equal(
    leanPhase1ProtectedSuccessor.status,
    "INDEPENDENTLY_VERIFIED_SOURCE_ONLY_SUCCESSOR",
  );
  const leanPhase1Transitions = transitionMap(
    leanPhase1ProtectedSuccessor.protectedSourceTransitions,
  );
  const revenueReadinessConsumers =
    verifyPaidCustomerRevenueReadinessProtectedConsumers();
  assert.equal(
    revenueReadinessConsumers.evidence.protectedConsumers[0].currentSha256,
    "b627cc624e08eebb5ac280e8fe2e2e98a82d7f06005eee0a7eab13dcb4d357e2",
  );
  assert.equal(
    revenueReadinessConsumers.consumerByPath.get("index.html").transitions.length,
    7,
  );
  assert.equal(
    revenueReadinessConsumers.consumerByPath.get("index.html").currentSha256,
    "ad138fdbf0a2f06c6226bb1310e575d3db867b256a25db9a03da9d1a2d2380b8",
  );
  assert.equal(
    revenueReadinessConsumers.liveCanonicalIdentityProtectedSuccessor.successor.version,
    "route-iq-intelligence-live-canonical-identity-protected-successor-v1",
  );
  assert.equal(
    revenueReadinessConsumers.governedLearningAdvisorySuccessor.successor.version,
    "route-iq-intelligence-governed-multi-session-learning-advisory-successor-v1",
  );
  assert.equal(
    revenueReadinessConsumers.dashboardPublicVisualIdentitySuccessor.successor.version,
    "route-iq-intelligence-dashboard-public-visual-identity-successor-v1",
  );
  const coordinatorSuccessor = readJson(
    "intelligence/provenance/protected-baseline-synchronization-batch-20260714-003-data-coordinator-successor-v1.json",
  );
  const infrastructureSuccessor = readJson(
    "intelligence/provenance/protected-baseline-synchronization-batch-20260714-003-infrastructure-runtime-successor-v1.json",
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
    assert.equal(
      sha256Bytes(gitBytes(["show", `${routeQualitySuccessor.predecessor.commit}:${consumer.path}`])),
      consumer.currentSha256,
      consumer.path,
    );
    assert.notEqual(consumer.previousSha256, consumer.currentSha256, consumer.path);
  }
  for (const source of successor.protectedSourceTransitions) {
    assert.equal(
      sha256Bytes(gitBytes(["show", `${routeQualitySuccessor.predecessor.commit}:${source.path}`])),
      source.currentSha256,
      source.path,
    );
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
  assert.equal(routeQualitySuccessor.batchId, "BATCH-20260714-002");
  assert.equal(routeQualitySuccessor.status, "OWNER_VALIDATED_SUCCESSOR");
  assert.equal(routeQualitySuccessor.ownerSubsystem, "Prometheus Intelligence Engine");
  assert.equal(routeQualitySuccessor.predecessor.path, "intelligence/provenance/protected-baseline-synchronization-batch-20260714-002-v1.json");
  assert.equal(sha256(routeQualitySuccessor.predecessor.path), routeQualitySuccessor.predecessor.sha256);
  assert.equal(routeQualitySuccessor.predecessor.remainsHistorical, true);
  assert.equal(routeQualitySuccessor.predecessor.rewritten, false);
  assert.equal(routeQualitySuccessor.dataOwnerTransition.ownerSubsystem, "Prometheus Data");
  assert.equal(routeQualitySuccessor.dataOwnerTransition.dashboardFetchEvidence.previousSourceFetches, 8);
  assert.equal(routeQualitySuccessor.dataOwnerTransition.dashboardFetchEvidence.currentSourceFetches, 9);
  const routeQualityEvidenceCommit = git([
    "log",
    "-1",
    "--format=%H",
    "--",
    "intelligence/provenance/protected-baseline-synchronization-batch-20260714-002-route-quality-successor-v1.json",
  ]);
  assert.equal(
    sha256Bytes(gitBytes(["show", `${routeQualityEvidenceCommit}:${routeQualitySuccessor.dataOwnerTransition.routeQualityGate.path}`])),
    routeQualitySuccessor.dataOwnerTransition.routeQualityGate.currentSha256,
  );
  assert.equal(
    sha256Bytes(gitBytes(["show", `${routeQualityEvidenceCommit}:${routeQualitySuccessor.dataOwnerTransition.canonicalRouteQualityReport.path}`])),
    routeQualitySuccessor.dataOwnerTransition.canonicalRouteQualityReport.currentSha256,
  );
  assert.equal(routeQualitySuccessor.protectedReferenceAudit.affectedIntelligenceReferences.length, 1);
  const affectedReference = routeQualitySuccessor.protectedReferenceAudit.affectedIntelligenceReferences[0];
  assert.equal(affectedReference.consumerPath, "intelligence/contracts/shadow-decision-readiness-contracts.json");
  assert.equal(
    sha256Bytes(gitBytes(["show", `${routeQualityEvidenceCommit}:${affectedReference.consumerPath}`])),
    affectedReference.currentConsumerSha256,
  );
  assert.equal(affectedReference.currentProtectedSha256, routeQualitySuccessor.dataOwnerTransition.routeQualityGate.currentSha256);
  assert.equal(routeQualitySuccessor.protectedReferenceAudit.canonicalReportPinnedByIntelligence, false);
  assert.deepEqual(routeQualitySuccessor.protectedReferenceAudit.canonicalReportReferenceMatches, []);
  assert.equal(routeQualitySuccessor.protectedReferenceAudit.allAffectedReferencesAccountedFor, true);
  assert.equal(routeQualitySuccessor.advisoryArtifacts.regenerationRequired, false);
  assert.equal(routeQualitySuccessor.boundaryValidation.collectionDefaultState, "OFF");
  assert.equal(routeQualitySuccessor.boundaryValidation.recommendationInfluence, "OFF");
  assert.equal(routeQualitySuccessor.boundaryValidation.readinessState, "INSUFFICIENT_EVIDENCE");
  assert.equal(routeQualitySuccessor.boundaryValidation.representativeShadowOutputExposed, false);
  assert.equal(routeQualitySuccessor.boundaryValidation.routeOrderingChanged, false);
  assert.equal(routeQualitySuccessor.boundaryValidation.routeScoringChanged, false);
  assert.equal(routeQualitySuccessor.boundaryValidation.routeGenerationChanged, false);
  assert.equal(routeQualitySuccessor.boundaryValidation.zeroLiveGooglePreserved, true);
  assert.equal(retentionSuccessor.batchId, "BATCH-20260714-003");
  assert.equal(
    retentionSuccessor.status,
    "OWNER_VALIDATED_SUCCESSOR_PENDING_OVERWATCH",
  );
  assert.equal(
    retentionSuccessor.ownerSubsystem,
    "Prometheus Intelligence Engine",
  );
  assert.equal(
    retentionSuccessor.dataOwnerLineage.foundationCommit,
    "a5bd1d431e778cec045d1e8412efb396674ea321",
  );
  assert.equal(
    retentionSuccessor.dataOwnerLineage.exactKeySuccessorCommit,
    "4803d7aca5810abfc1cbca84eb2f461046a10da4",
  );
  const retentionEvidenceCommit = git([
    "log",
    "-1",
    "--format=%H",
    "--",
    "intelligence/provenance/protected-baseline-synchronization-batch-20260714-003-retention-v1.json",
  ]);
  for (const transition of retentionSuccessor.dataOwnerLineage.transitions) {
    assert.equal(
      sha256Bytes(gitBytes(["show", `${retentionEvidenceCommit}:${transition.path}`])),
      transition.currentSha256,
      transition.path,
    );
  }
  assert.equal(
    retentionSuccessor.infrastructureOwnerLineage.activationReadinessCommit,
    "2280c6dae9d07bcfd744e99e9d28126188653eb2",
  );
  for (const transition of retentionSuccessor.infrastructureOwnerLineage.transitions) {
    assert.equal(
      sha256Bytes(gitBytes(["show", `${retentionEvidenceCommit}:${transition.path}`])),
      transition.currentSha256,
      transition.path,
    );
  }
  for (const ownerChange of retentionSuccessor.intelligenceOwnerChanges) {
    assert.equal(
      sha256Bytes(gitBytes(["show", `${retentionEvidenceCommit}:${ownerChange.path}`])),
      ownerChange.currentSha256,
      ownerChange.path,
    );
  }
  assert.equal(retentionSuccessor.consumerExclusionMatrix.excludedDomainCount, 12);
  assert.equal(retentionSuccessor.consumerExclusionMatrix.auditVisibility, "hash_only");
  assert.equal(
    retentionSuccessor.consumerExclusionMatrix.automaticZeroVisitExclusionAllowed,
    false,
  );
  assert.equal(retentionSuccessor.consumerExclusionMatrix.allConsumersAccountedFor, true);
  assert.equal(currentRetentionAuthority.batchId, "BATCH-20260714-004");
  assert.equal(currentRetentionAuthority.ownerSubsystem, "Prometheus Intelligence Engine");
  assert.equal(
    currentRetentionAuthority.dataOwnerLineage.commit,
    "c73118ddb262d3010bbc94a900f8506fb2f56192",
  );
  const currentRetentionAuthorityEvidenceCommit = git([
    "log",
    "-1",
    "--format=%H",
    "--",
    "intelligence/provenance/protected-baseline-synchronization-batch-20260714-004-retention-v1.json",
  ]);
  for (const artifact of currentRetentionAuthority.dataOwnerLineage.artifacts) {
    assert.equal(
      sha256Bytes(
        gitBytes([
          "show",
          `${currentRetentionAuthorityEvidenceCommit}:${artifact.path}`,
        ]),
      ),
      artifact.sha256,
      artifact.path,
    );
  }
  assert.equal(retentionArchitectureSuccessor.batchId, "BATCH-20260714-004");
  assert.equal(retentionArchitectureSuccessor.status, "OWNER_VALIDATED_SUCCESSOR_PENDING_OVERWATCH");
  assert.equal(retentionArchitectureSuccessor.ownerSubsystem, "Prometheus Intelligence Engine");
  assert.equal(retentionArchitectureSuccessor.historicalCheckpoint.remainsHistorical, true);
  assert.equal(retentionArchitectureSuccessor.historicalCheckpoint.rewritten, false);
  assert.equal(
    sha256(retentionArchitectureSuccessor.historicalCheckpoint.path),
    retentionArchitectureSuccessor.historicalCheckpoint.sha256,
  );
  assert.equal(
    retentionArchitectureSuccessor.historicalCheckpoint.recordedAtCommit,
    retentionEvidenceCommit,
  );
  assert.equal(
    sha256(retentionArchitectureSuccessor.currentAuthority.path),
    retentionArchitectureSuccessor.currentAuthority.sha256,
  );
  assert.equal(
    retentionArchitectureSuccessor.currentAuthority.dataOwnerCommit,
    currentRetentionAuthority.dataOwnerLineage.commit,
  );
  const retentionArchitectureEvidenceCommit = git([
    "log",
    "-1",
    "--format=%H",
    "--",
    "intelligence/provenance/protected-baseline-synchronization-batch-20260714-004-architecture-successor-v1.json",
  ]);
  assert.equal(
    sha256Bytes(
      gitBytes([
        "show",
        `${retentionArchitectureEvidenceCommit}:${retentionArchitectureSuccessor.dataOwnerTransition.archiveRuntime.path}`,
      ]),
    ),
    retentionArchitectureSuccessor.dataOwnerTransition.archiveRuntime.currentSha256,
  );
  assert.equal(
    retentionArchitectureSuccessor.dataOwnerTransition.archiveRuntime.currentSha256,
    currentRetentionAuthority.dataOwnerLineage.artifacts.find(
      artifact => artifact.path === retentionArchitectureSuccessor.dataOwnerTransition.archiveRuntime.path,
    ).sha256,
  );
  assert.notEqual(
    retentionArchitectureSuccessor.dataOwnerTransition.archiveRuntime.historicalCheckpointSha256,
    retentionArchitectureSuccessor.dataOwnerTransition.archiveRuntime.currentSha256,
  );
  assert.equal(
    sha256Bytes(
      gitBytes([
        "show",
        `${retentionArchitectureEvidenceCommit}:${retentionArchitectureSuccessor.dataOwnerTransition.runtimeContract.path}`,
      ]),
    ),
    retentionArchitectureSuccessor.dataOwnerTransition.runtimeContract.currentSha256,
  );
  for (const consumer of retentionArchitectureSuccessor.protectedConsumers) {
    assert.equal(
      sha256Bytes(
        gitBytes([
          "show",
          `${retentionArchitectureEvidenceCommit}:${consumer.path}`,
        ]),
      ),
      consumer.sha256,
      consumer.path,
    );
  }
  assert.deepEqual(
    retentionArchitectureSuccessor.staleAssertionsClosed.map(assertion => assertion.currentValue),
    [
      "c73118ddb262d3010bbc94a900f8506fb2f56192",
      "68aa5ee9b216c4efe0fa3c8b3a01ce1c569e53ad15c2e6bfb7d5f8a80850e8b4",
    ],
  );
  assert.equal(retentionArchitectureSuccessor.boundaryValidation.readiness, "INSUFFICIENT_EVIDENCE");
  assert.equal(retentionArchitectureSuccessor.boundaryValidation.collection, "OFF");
  assert.equal(retentionArchitectureSuccessor.boundaryValidation.activeCohorts, 0);
  assert.equal(retentionArchitectureSuccessor.boundaryValidation.recommendationInfluence, "OFF");
  assert.equal(retentionArchitectureSuccessor.boundaryValidation.representativeShadowOutputExposed, false);
  assert.equal(retentionArchitectureSuccessor.boundaryValidation.routeScoringChanged, false);
  assert.equal(retentionArchitectureSuccessor.boundaryValidation.routeGenerationChanged, false);
  assert.equal(retentionArchitectureSuccessor.boundaryValidation.learningBehaviorChanged, false);
  assert.equal(retentionArchitectureSuccessor.boundaryValidation.deploymentPerformed, false);
  assert.equal(retentionArchitectureSuccessor.boundaryValidation.productionMutationPerformed, false);
  assert.equal(
    crossIndustryRetentionSuccessor.status,
    "OWNER_REVIEWED_AND_SYNCHRONIZED_PENDING_OVERWATCH",
  );
  assert.equal(
    crossIndustryRetentionSuccessor.ownerSubsystem,
    "Prometheus Intelligence Engine",
  );
  for (const checkpoint of crossIndustryRetentionSuccessor.historicalCheckpoints) {
    assert.equal(sha256(checkpoint.path), checkpoint.sha256, checkpoint.path);
    assert.equal(checkpoint.remainsHistorical, true);
    assert.equal(checkpoint.rewritten, false);
  }
  assert.equal(
    crossIndustryRetentionSuccessor.dataOwnerTransition.commit,
    "c9b8ac823fac489e017c9ddd0c116d60985542e8",
  );
  const liveCanonicalArchiveTransitions =
    revenueReadinessConsumers.liveCanonicalIdentityProtectedSuccessor
      .transitionsByPath.get(
        crossIndustryRetentionSuccessor.dataOwnerTransition.archiveRuntime.path,
      );
  const fieldSessionArchiveTransition = fieldSessionReportTypeSuccessor
    .protectedSourceTransitions.find(
      (transition) => transition.path ===
        crossIndustryRetentionSuccessor.dataOwnerTransition.archiveRuntime.path,
    );
  const retentionDeletionArchiveTransition = retentionDeletionRuntimeSuccessor
    .successorTransitionsByPath.get(
      crossIndustryRetentionSuccessor.dataOwnerTransition.archiveRuntime.path,
    )?.[0];
  assert.equal(
    fieldSessionArchiveTransition.previousSha256,
    liveCanonicalArchiveTransitions?.at(-1).currentSha256
      || crossIndustryRetentionSuccessor.dataOwnerTransition.archiveRuntime.currentSha256,
  );
  assert.equal(
    sha256(crossIndustryRetentionSuccessor.dataOwnerTransition.archiveRuntime.path),
    retentionDeletionArchiveTransition.currentSha256,
  );
  assert.equal(
    retentionDeletionArchiveTransition.previousSha256,
    fieldSessionArchiveTransition.currentSha256,
  );
  assert.notEqual(
    crossIndustryRetentionSuccessor.dataOwnerTransition.archiveRuntime.previousSha256,
    crossIndustryRetentionSuccessor.dataOwnerTransition.archiveRuntime.currentSha256,
  );
  assert.equal(
    crossIndustryRetentionSuccessor.dataOwnerTransition.archiveRuntime.retentionSemanticsChanged,
    false,
  );
  for (const artifact of crossIndustryRetentionSuccessor.dataOwnerTransition.availabilityArtifacts) {
    assert.equal(sha256(artifact.path), artifact.currentSha256, artifact.path);
    assert.notEqual(artifact.previousSha256, artifact.currentSha256, artifact.path);
  }
  for (const transition of crossIndustryRetentionSuccessor.upstreamOwnerTransitions) {
    const latestTransition = zipFounderAccessSuccessor.protectedBaselineSuccessors
      .find((candidate) => candidate.path === transition.path);
    if (latestTransition) {
      assert.equal(latestTransition.previousSha256, transition.currentSha256, transition.path);
      const revenueReadinessConsumer =
        revenueReadinessConsumers.consumerByPath.get(transition.path);
      const fieldSessionTransition = fieldSessionReportTypeSuccessor
        .protectedSourceTransitions.find((candidate) => candidate.path === transition.path);
      const retentionDeletionTransition = retentionDeletionRuntimeSuccessor
        .successorTransitionsByPath.get(transition.path)?.[0];
      if (revenueReadinessConsumer) {
        assert.equal(
          revenueReadinessConsumer.previousSha256,
          latestTransition.currentSha256,
          transition.path,
        );
        if (fieldSessionTransition) {
          assert.equal(
            fieldSessionTransition.previousSha256,
            revenueReadinessConsumer.currentSha256,
            transition.path,
          );
          if (retentionDeletionTransition) {
            assert.equal(
              retentionDeletionTransition.previousSha256,
              fieldSessionTransition.currentSha256,
              transition.path,
            );
          }
          assert.equal(
            sha256(transition.path),
            (retentionDeletionTransition || fieldSessionTransition).currentSha256,
            transition.path,
          );
        } else {
          assert.equal(
            sha256(transition.path),
            revenueReadinessConsumer.currentSha256,
            transition.path,
          );
        }
      } else {
        assert.equal(
          sha256(transition.path),
          fieldSessionTransition?.currentSha256 || latestTransition.currentSha256,
          transition.path,
        );
      }
    } else {
      assert.equal(sha256(transition.path), transition.currentSha256, transition.path);
    }
    assert.notEqual(transition.previousSha256, transition.currentSha256, transition.path);
  }
  for (const artifact of crossIndustryRetentionSuccessor.intelligenceOwnerRuntimeTransition.artifacts) {
    const fullSystemHarmonyTransitions =
      revenueReadinessConsumers.fullSystemHarmonySuccessor.transitionsByPath.get(artifact.path);
    const retentionDeletionTransitions =
      retentionDeletionRuntimeSuccessor.transitionsByPath.get(artifact.path);
    assert.equal(
      sha256(artifact.path),
      retentionDeletionTransitions?.at(-1).currentSha256
        || fullSystemHarmonyTransitions?.at(-1).currentSha256
        || artifact.currentSha256,
      artifact.path,
    );
    assert.notEqual(artifact.previousSha256, artifact.currentSha256, artifact.path);
  }
  for (const consumer of crossIndustryRetentionSuccessor.intelligenceConsumerTransitions) {
    const retentionDeletionTransitions =
      retentionDeletionRuntimeSuccessor.transitionsByPath.get(consumer.path);
    const prospectiveCalibrationTransitions =
      prospectiveCalibrationSuccessor.transitionsByPath.get(consumer.path);
    const leanTransitions = leanPhase1Transitions.get(consumer.path);
    const predecessor = prospectiveCalibrationTransitions?.at(-1)
      || retentionDeletionTransitions?.at(-1)
      || consumer;
    if (leanTransitions) {
      assert.equal(
        leanTransitions[0].previousSha256,
        predecessor.currentSha256,
        `Broken lean Phase 1 consumer chain: ${consumer.path}`,
      );
      for (let index = 1; index < leanTransitions.length; index += 1) {
        assert.equal(
          leanTransitions[index].previousSha256,
          leanTransitions[index - 1].currentSha256,
          `Broken lean Phase 1 consumer chain: ${consumer.path}`,
        );
      }
    }
    assert.equal(
      sha256(consumer.path),
      leanTransitions?.at(-1).currentSha256 || predecessor.currentSha256,
      consumer.path,
    );
    assert.notEqual(consumer.previousSha256, consumer.currentSha256, consumer.path);
  }
  assert.equal(crossIndustryRetentionSuccessor.governedEmptyState.activeBusinessCount, 0);
  assert.equal(crossIndustryRetentionSuccessor.governedEmptyState.discoveryPlannedSize, 0);
  assert.equal(crossIndustryRetentionSuccessor.governedEmptyState.nearbyOpportunityCount, 0);
  assert.equal(crossIndustryRetentionSuccessor.governedEmptyState.retiredOrDemoSupplyRestored, false);
  assert.equal(crossIndustryRetentionSuccessor.governedEmptyState.inventedBusinessAllowed, false);
  assert.equal(crossIndustryRetentionSuccessor.retentionInvariants.maximumCalendarMonths, 18);
  assert.equal(crossIndustryRetentionSuccessor.retentionInvariants.customerMayOnlyShorten, true);
  assert.equal(crossIndustryRetentionSuccessor.retentionInvariants.customerMayExpand, false);
  assert.equal(crossIndustryRetentionSuccessor.retentionInvariants.historicalArchiveRewritten, false);
  assert.equal(crossIndustryRetentionSuccessor.boundaries.readinessState, "INSUFFICIENT_EVIDENCE");
  assert.equal(crossIndustryRetentionSuccessor.boundaries.prospectiveCollection, "OFF");
  assert.equal(crossIndustryRetentionSuccessor.boundaries.activeCohorts, 0);
  assert.equal(crossIndustryRetentionSuccessor.boundaries.recommendationInfluence, "OFF");
  assert.equal(crossIndustryRetentionSuccessor.boundaries.deploymentPerformed, false);
  assert.equal(crossIndustryRetentionSuccessor.boundaries.productionAccessPerformed, false);
  assert.equal(crossIndustryRetentionSuccessor.boundaries.productionMutationPerformed, false);
  assert.equal(retentionSuccessor.boundaryValidation.readiness, "INSUFFICIENT_EVIDENCE");
  assert.equal(retentionSuccessor.boundaryValidation.collection, "OFF");
  assert.equal(retentionSuccessor.boundaryValidation.activeCohorts, 0);
  assert.equal(retentionSuccessor.boundaryValidation.productionProspectiveRecords, 0);
  assert.equal(retentionSuccessor.boundaryValidation.productionEvaluations, 0);
  assert.equal(retentionSuccessor.boundaryValidation.recommendationInfluence, "OFF");
  assert.equal(retentionSuccessor.boundaryValidation.representativeShadowOutputExposed, false);
  assert.equal(coordinatorSuccessor.batchId, "BATCH-20260714-003");
  assert.equal(coordinatorSuccessor.ownerSubsystem, "Prometheus Intelligence Engine");
  assert.equal(coordinatorSuccessor.predecessor.remainsHistorical, true);
  assert.equal(coordinatorSuccessor.predecessor.rewritten, false);
  assert.equal(
    sha256(coordinatorSuccessor.predecessor.path),
    coordinatorSuccessor.predecessor.sha256,
  );
  assert.equal(coordinatorSuccessor.dataOwnerTransition.ownerSubsystem, "Prometheus Data");
  const coordinatorEvidenceCommit = git([
    "log",
    "-1",
    "--format=%H",
    "--",
    "intelligence/provenance/protected-baseline-synchronization-batch-20260714-003-data-coordinator-successor-v1.json",
  ]);
  assert.equal(
    sha256Bytes(gitBytes(["show", `${coordinatorEvidenceCommit}:${coordinatorSuccessor.dataOwnerTransition.coordinator.path}`])),
    coordinatorSuccessor.dataOwnerTransition.coordinator.currentSha256,
  );
  assert.equal(
    coordinatorSuccessor.intelligenceOwnerSynchronization.contract.currentSha256,
    infrastructureSuccessor.intelligenceOwnerSynchronization.contract.previousSha256,
  );
  assert.equal(
    coordinatorSuccessor.intelligenceOwnerSynchronization.specification.currentSha256,
    infrastructureSuccessor.intelligenceOwnerSynchronization.specification.previousSha256,
  );
  const infrastructureEvidenceCommit = git([
    "log",
    "-1",
    "--format=%H",
    "--",
    "intelligence/provenance/protected-baseline-synchronization-batch-20260714-003-infrastructure-runtime-successor-v1.json",
  ]);
  assert.equal(
    sha256Bytes(gitBytes(["show", `${infrastructureEvidenceCommit}:${infrastructureSuccessor.intelligenceOwnerSynchronization.contract.path}`])),
    infrastructureSuccessor.intelligenceOwnerSynchronization.contract.currentSha256,
  );
  assert.equal(
    sha256Bytes(gitBytes(["show", `${infrastructureEvidenceCommit}:${infrastructureSuccessor.intelligenceOwnerSynchronization.specification.path}`])),
    infrastructureSuccessor.intelligenceOwnerSynchronization.specification.currentSha256,
  );
  assert.equal(
    infrastructureSuccessor.batchId,
    "BATCH-20260714-003",
  );
  assert.equal(
    infrastructureSuccessor.status,
    "OWNER_VALIDATED_SUCCESSOR_PENDING_OVERWATCH",
  );
  assert.equal(
    infrastructureSuccessor.ownerSubsystem,
    "Prometheus Intelligence Engine",
  );
  assert.equal(infrastructureSuccessor.predecessor.remainsHistorical, true);
  assert.equal(infrastructureSuccessor.predecessor.rewritten, false);
  assert.equal(
    sha256(infrastructureSuccessor.predecessor.path),
    infrastructureSuccessor.predecessor.sha256,
  );
  assert.equal(
    infrastructureSuccessor.infrastructureOwnerTransition.ownerSubsystem,
    "Prometheus Infrastructure",
  );
  assert.equal(
    infrastructureSuccessor.infrastructureOwnerTransition.commit,
    "46658265248b03f7b52f9e1ec0b1ca61ca2b5920",
  );
  assert.equal(
    sha256Bytes(gitBytes(["show", `${infrastructureEvidenceCommit}:${infrastructureSuccessor.infrastructureOwnerTransition.runtime.path}`])),
    infrastructureSuccessor.infrastructureOwnerTransition.runtime.currentSha256,
  );
  assert.equal(
    infrastructureSuccessor.infrastructureOwnerTransition.runtime.previousSha256,
    "ab45a00cb74115bb067ce00ab15890e9a959a9a3accb67917397f7f11236346d",
  );
  for (const field of [
    "missingRetentionFailsBeforeEvaluationConstruction",
    "missingRetentionSkipsEvaluationAdmissionRpc",
    "validRetentionCompatibilityNoncanonicalTestOnly",
    "browserRetentionAuthorityRejected",
    "canonicalFieldSessionAcknowledgmentPreserved",
    "realMiniflareCompatibilityVerified",
  ]) {
    assert.equal(
      infrastructureSuccessor.infrastructureOwnerTransition.semanticChanges[field],
      true,
      field,
    );
  }
  assert.equal(
    infrastructureSuccessor.infrastructureOwnerTransition.semanticChanges.productionAuthenticatedRetentionEnvelopeProducerAvailable,
    false,
  );
  assert.equal(
    infrastructureSuccessor.intelligenceOwnerSynchronization.infrastructureImplementationModifiedByIntelligence,
    false,
  );
  assert.equal(
    infrastructureSuccessor.intelligenceOwnerSynchronization.historicalCheckpointModified,
    false,
  );
  assert.equal(
    infrastructureSuccessor.intelligenceOwnerSynchronization.allAffectedProtectedReferencesAccountedFor,
    true,
  );
  assert.equal(infrastructureSuccessor.boundaryValidation.readiness, "INSUFFICIENT_EVIDENCE");
  assert.equal(infrastructureSuccessor.boundaryValidation.collection, "OFF");
  assert.equal(infrastructureSuccessor.boundaryValidation.activeCohorts, 0);
  assert.equal(infrastructureSuccessor.boundaryValidation.recommendationInfluence, "OFF");
  assert.equal(infrastructureSuccessor.boundaryValidation.representativeShadowOutputExposed, false);
  assert.equal(infrastructureSuccessor.boundaryValidation.archiveRewritePerformed, false);
  assert.equal(infrastructureSuccessor.boundaryValidation.productionConsumerActivated, false);
  assert.equal(infrastructureSuccessor.boundaryValidation.deploymentPerformed, false);
  assert.equal(infrastructureSuccessor.boundaryValidation.productionAccessPerformed, false);
  assert.equal(
    coordinatorSuccessor.intelligenceOwnerSynchronization.dataImplementationModifiedByIntelligence,
    false,
  );
  assert.equal(coordinatorSuccessor.boundaryValidation.readiness, "INSUFFICIENT_EVIDENCE");
  assert.equal(coordinatorSuccessor.boundaryValidation.collection, "OFF");
  assert.equal(coordinatorSuccessor.boundaryValidation.activeCohorts, 0);
  assert.equal(coordinatorSuccessor.boundaryValidation.recommendationInfluence, "OFF");
  assert.equal(coordinatorSuccessor.boundaryValidation.representativeShadowOutputExposed, false);
  assert.equal(coordinatorSuccessor.boundaryValidation.archiveRewritePerformed, false);
  assert.equal(retentionSuccessor.boundaryValidation.routeScoringChanged, false);
  assert.equal(retentionSuccessor.boundaryValidation.routeGenerationChanged, false);
  assert.equal(retentionSuccessor.boundaryValidation.newConsumerActivated, false);
  assert.equal(retentionSuccessor.boundaryValidation.deploymentPerformed, false);
  assert.equal(retentionSuccessor.boundaryValidation.productionAccessPerformed, false);
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

test("paid-customer revenue-readiness protected consumers reject substitution and drift", () => {
  const evidence = readJson(
    "intelligence/provenance/protected-consumer-synchronization-paid-customer-revenue-readiness-v1.json",
  );
  const substituted = structuredClone(evidence);
  substituted.protectedConsumers[0].currentSha256 = "0".repeat(64);
  assert.throws(
    () => verifyPaidCustomerRevenueReadinessProtectedConsumers({ evidence: substituted }),
    /Expected values to be strictly equal/u,
  );
  assert.throws(
    () => verifyPaidCustomerRevenueReadinessProtectedConsumers({
      currentSha256ByPath: { "index.html": "f".repeat(64) },
    }),
    /Protected consumer drifted: index\.html/u,
  );
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
