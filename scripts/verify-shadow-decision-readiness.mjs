import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  buildCommittedArchiveRecord,
  buildFounderReadinessReport,
  buildShadowLedger,
  loadShadowDecisionConfig,
  loadShadowDecisionContract,
  readinessStates,
  renderFounderReadinessMarkdown,
  shadowDecisionReadinessVersion,
} from "../intelligence/shadow-decision-readiness.mjs";
import {
  shadowDecisionProspectiveDispositionSchemaVersion,
  shadowDecisionProspectiveRuleVersion,
  shadowDecisionProspectiveRuntimeVersion,
} from "../intelligence/shadow-decision-readiness-runtime.mjs";
import {
  routeIqEvaluationContextSchemaVersion,
  routeIqEvaluationContractVersion,
  routeIqEvaluationRecordSchemaVersion,
  routeIqScoreableOutcomeDerivationContractVersion,
  routeIqScoreableOutcomeRecordSchemaVersion,
} from "../intelligence/route-iq-committed-outcome-evaluation.mjs";
import {
  computeRouteIqProspectiveRetentionPolicySha256,
  loadRouteIqProspectiveRetentionPolicy,
  routeIqProspectiveIntelligenceRetentionAdmissionVersion,
  validateRouteIqProspectiveRetentionPolicy,
} from "../intelligence/route-iq-prospective-retention-admission.mjs";

const root = resolve(import.meta.dirname, "..");
const base =
  "data/route-iq-field-sessions-v1/workspaces/fitness_connection/sessions/route-iq-field-session-fitness-connection-fitness-cruz-2026-07-11";
const paths = {
  raw: `${base}/raw/prometheus-iq-cruz-daily-report-2026-07-11.json`,
  normalized: `${base}/normalized/field-session.json`,
  calculated: `${base}/normalized/calculated-metrics.json`,
  stressTestEvidence: `${base}/evidence/stress-test-observations.json`,
  historyUpdates: `${base}/normalized/history-updates.json`,
};
const serialize = (value) => `${JSON.stringify(value, null, 2)}\n`;
const sha256File = (path) =>
  createHash("sha256").update(readFileSync(resolve(root, path))).digest("hex");
export const requiredProtectedBehaviorBaselineKeys = Object.freeze([
  "activePool",
  "businessHours",
  "businessHoursEligibility",
  "dashboardDeployMirror",
  "dashboardSource",
  "dataArchiveRuntime",
  "dataCoordinator",
  "dataRuntimeContract",
  "discovery",
  "infrastructureAuthority",
  "infrastructureDurableObject",
  "infrastructureRuntime",
  "nearby",
  "quarantinePool",
  "routeGeneration",
  "routeQualityGate",
  "routeScoring",
  "runtimePools",
  "worker",
]);

export function validateShadowDecisionContractCoherence(contract, config) {
  assert.equal(contract.batchId, config.batchId);
  assert.deepEqual(contract.scope, config.scope);
  assert.equal(
    contract.version,
    "route-iq-shadow-decision-readiness-contract-v1",
  );
  assert.equal(
    config.configVersion,
    "route-iq-shadow-decision-readiness-config-v1",
  );
  assert.equal(
    shadowDecisionReadinessVersion,
    "route-iq-shadow-decision-readiness-v1",
  );
  assert.deepEqual(
    Object.keys(contract.protectedBehaviorBaselines || {}).sort(),
    [...requiredProtectedBehaviorBaselineKeys],
  );
  assert.equal(
    contract.sourceProjectionVersion,
    "route-iq-chronological-evidence-projection-v1",
  );
  assert.equal(contract.implementationDispatch.batchId, "BATCH-20260713-004");
  assert.equal(
    contract.implementationDispatch.integratedDataCommit,
    "00a7e68251ac597f40e35bcfcff942d3e4648a65",
  );
  assert.equal(
    contract.implementationDispatch.dataCoordinatorCommit,
    "84319f9c70004edd50e1531e48ea1d0d7b501089",
  );
  assert.equal(
    contract.implementationDispatch.integratedDashboardCommit,
    "6c7671cb3f9387fdac29961432412dfe70088b2e",
  );
  assert.equal(
    contract.implementationDispatch.integratedInfrastructureCommit,
    "509a7bc0d3b4d2911d6b6b189985cccfa2536241",
  );
  assert.equal(
    contract.implementationDispatch.sourceIntegrationStatus,
    "SOURCE_INTEGRATED_DEPLOYABLE_PRODUCTION_CONSUMER_INACTIVE",
  );
  assert.equal(
    contract.prospectiveSourceApi,
    "RouteIqProspectiveCoordinator.acceptCandidateManifest_sealSnapshot_sealShadowDecision",
  );
  assert.equal(
    contract.prospectiveSourcePath,
    "data/route-iq-field-sessions-v1/route-iq-prospective-shadow-coordinator.mjs",
  );
  assert.equal(
    contract.protectedDataRuntimeBaseline.path,
    contract.prospectiveSourcePath,
  );
  assert.equal(
    contract.protectedDataRuntimeBaseline.sourceCommit,
    "c73118ddb262d3010bbc94a900f8506fb2f56192",
  );
  assert.equal(
    contract.protectedDataRuntimeBaseline.sourceOwnerSubsystem,
    "Prometheus Data",
  );
  assert.equal(
    contract.protectedDataRuntimeBaseline.synchronizedBySubsystem,
    "Prometheus Intelligence Engine",
  );
  assert.equal(
    contract.protectedDataRuntimeBaseline.synchronizedInBatch,
    "BATCH-20260714-004",
  );
  assert.deepEqual(contract.protectedDataRuntimeBaseline.predecessor, {
    sha256: "88c5fe5070781819144e93b4578a2f11be72a3f2087d2cf1fb473dc10fd58943",
    sourceCommit: contract.implementationDispatch.dataCoordinatorCommit,
    remainsHistorical: true,
    rewritten: false,
  });
  assert.equal(
    contract.protectedBehaviorBaselines.dataCoordinator.sha256,
    contract.protectedDataRuntimeBaseline.sha256,
  );
  assert.equal(
    contract.protectedBehaviorBaselines.dataCoordinator.sourceCommit,
    contract.protectedDataRuntimeBaseline.sourceCommit,
  );
  assert.equal(
    contract.protectedBehaviorBaselines.dataCoordinator.sourceOwnerSubsystem,
    "Prometheus Data",
  );
  const infrastructureRuntime =
    contract.protectedBehaviorBaselines.infrastructureRuntime;
  assert.equal(
    infrastructureRuntime.sourceCommit,
    "46658265248b03f7b52f9e1ec0b1ca61ca2b5920",
  );
  assert.equal(
    infrastructureRuntime.sourceOwnerSubsystem,
    "Prometheus Infrastructure",
  );
  assert.deepEqual(infrastructureRuntime.predecessor, {
    sha256: "ab45a00cb74115bb067ce00ab15890e9a959a9a3accb67917397f7f11236346d",
    sourceCommit: "2280c6dae9d07bcfd744e99e9d28126188653eb2",
    remainsHistorical: true,
    rewritten: false,
  });
  const workerBaseline = contract.protectedBehaviorBaselines.worker;
  assert.equal(
    workerBaseline.sourceCommit,
    "e41e025173d9843de51c6c8e789570e27345a13b",
  );
  assert.equal(
    workerBaseline.sourceOwnerSubsystem,
    "Prometheus Infrastructure",
  );
  assert.deepEqual(workerBaseline.predecessor, {
    sha256: "723ce018f4a4e1f0f731da02c0852e75c9c2ef0808b124055db2ad1b96124c59",
    sourceCommit: "2280c6dae9d07bcfd744e99e9d28126188653eb2",
    remainsHistorical: true,
    rewritten: false,
  });
  assert.equal(
    workerBaseline.provenanceSuccessor,
    contract.artifacts.unattendedRuntimeGuardBaselineSuccessor,
  );
  const runtimeGuardSuccessor = JSON.parse(
    readFileSync(
      resolve(root, contract.artifacts.unattendedRuntimeGuardBaselineSuccessor),
      "utf8",
    ),
  );
  assert.equal(runtimeGuardSuccessor.batchId, "BATCH-20260714-006");
  assert.equal(
    runtimeGuardSuccessor.status,
    "OWNER_VALIDATED_SUCCESSOR_PENDING_OVERWATCH",
  );
  assert.equal(
    runtimeGuardSuccessor.ownerSubsystem,
    "Prometheus Intelligence Engine",
  );
  assert.equal(
    runtimeGuardSuccessor.historicalProtectedSource.sha256,
    workerBaseline.predecessor.sha256,
  );
  assert.equal(
    runtimeGuardSuccessor.historicalProtectedSource.sourceCommit,
    workerBaseline.predecessor.sourceCommit,
  );
  assert.equal(
    runtimeGuardSuccessor.historicalProtectedSource.remainsHistorical,
    true,
  );
  assert.equal(runtimeGuardSuccessor.historicalProtectedSource.rewritten, false);
  assert.equal(
    sha256File(runtimeGuardSuccessor.historicalProtectedSource.recordedIn.path),
    runtimeGuardSuccessor.historicalProtectedSource.recordedIn.sha256,
  );
  assert.equal(
    runtimeGuardSuccessor.infrastructureOwnerTransition.ownerSubsystem,
    "Prometheus Infrastructure",
  );
  assert.equal(
    runtimeGuardSuccessor.infrastructureOwnerTransition.implementationCommit,
    workerBaseline.sourceCommit,
  );
  assert.equal(
    runtimeGuardSuccessor.infrastructureOwnerTransition
      .supplyChainHardeningCommit,
    "3c8ca61910358c13cc0c05e1fbda5d3052b31a9b",
  );
  assert.equal(
    runtimeGuardSuccessor.infrastructureOwnerTransition.worker.currentSha256,
    workerBaseline.sha256,
  );
  assert.equal(
    runtimeGuardSuccessor.infrastructureOwnerTransition.worker.previousSha256,
    workerBaseline.predecessor.sha256,
  );
  assert.equal(
    runtimeGuardSuccessor.infrastructureOwnerTransition.worker
      .changedBySupplyChainHardeningCommit,
    false,
  );
  for (const protectedSource of [
    runtimeGuardSuccessor.infrastructureOwnerTransition.worker,
    runtimeGuardSuccessor.infrastructureOwnerTransition.workerFirstRouting,
  ]) {
    assert.equal(sha256File(protectedSource.path), protectedSource.currentSha256);
  }
  const smokeGuard =
    runtimeGuardSuccessor.infrastructureOwnerTransition.servicePrincipalGuard;
  assert.equal(sha256File(smokeGuard.guardPath), smokeGuard.guardSha256);
  assert.equal(sha256File(smokeGuard.contractPath), smokeGuard.contractSha256);
  assert.equal(smokeGuard.ordinaryAuthenticatedHumanRoutingChanged, false);
  assert.equal(
    runtimeGuardSuccessor.intelligenceOwnerSynchronization.contract.path,
    contract.artifacts.contract,
  );
  assert.equal(
    sha256File(contract.artifacts.contract),
    runtimeGuardSuccessor.intelligenceOwnerSynchronization.contract.currentSha256,
  );
  assert.equal(
    runtimeGuardSuccessor.intelligenceOwnerSynchronization
      .allAffectedCurrentProtectedReferencesAccountedFor,
    true,
  );
  assert.equal(
    runtimeGuardSuccessor.intelligenceOwnerSynchronization
      .historicalCheckpointModified,
    false,
  );
  assert.equal(
    runtimeGuardSuccessor.intelligenceOwnerSynchronization
      .infrastructureImplementationModifiedByIntelligence,
    false,
  );
  assert.equal(runtimeGuardSuccessor.advisoryArtifacts.regenerationRequired, false);
  assert.deepEqual(runtimeGuardSuccessor.boundaryValidation, {
    readiness: "INSUFFICIENT_EVIDENCE",
    collection: "OFF",
    activeCohorts: 0,
    canonicalProductionProspectiveRecords: 0,
    canonicalProductionEvaluations: 0,
    recommendationInfluence: "OFF",
    representativeShadowOutputExposed: false,
    routeOrderingChanged: false,
    routeScoringChanged: false,
    intelligenceBehaviorChanged: false,
    deploymentPerformed: false,
    productionAccessPerformed: false,
    productionMutationPerformed: false,
  });
  assert.equal(
    contract.prospectiveRuntimeAdapter.runtimeVersion,
    shadowDecisionProspectiveRuntimeVersion,
  );
  assert.equal(
    contract.prospectiveRuntimeAdapter.dispositionSchemaVersion,
    shadowDecisionProspectiveDispositionSchemaVersion,
  );
  assert.equal(
    contract.prospectiveRuntimeAdapter.ruleVersion,
    shadowDecisionProspectiveRuleVersion,
  );
  assert.equal(
    config.prospectiveRuntime.runtimeVersion,
    shadowDecisionProspectiveRuntimeVersion,
  );
  assert.equal(
    config.prospectiveRuntime.dispositionSchemaVersion,
    shadowDecisionProspectiveDispositionSchemaVersion,
  );
  assert.equal(
    config.prospectiveRuntime.ruleVersion,
    shadowDecisionProspectiveRuleVersion,
  );
  assert.equal(
    contract.committedOutcomeEvaluation.derivationContractVersion,
    routeIqScoreableOutcomeDerivationContractVersion,
  );
  assert.equal(
    contract.committedOutcomeEvaluation.scoreableOutcomeRecordSchemaVersion,
    routeIqScoreableOutcomeRecordSchemaVersion,
  );
  assert.equal(
    contract.committedOutcomeEvaluation.evaluation.contextSchemaVersion,
    routeIqEvaluationContextSchemaVersion,
  );
  assert.equal(
    contract.committedOutcomeEvaluation.evaluation.contractVersion,
    routeIqEvaluationContractVersion,
  );
  assert.equal(
    contract.committedOutcomeEvaluation.evaluation.recordSchemaVersion,
    routeIqEvaluationRecordSchemaVersion,
  );
  assert.equal(
    contract.prospectiveRetentionAdmission.admissionVersion,
    routeIqProspectiveIntelligenceRetentionAdmissionVersion,
  );
  assert.equal(
    contract.prospectiveRetentionAdmission.dataFoundationCommit,
    "a5bd1d431e778cec045d1e8412efb396674ea321",
  );
  assert.equal(
    contract.prospectiveRetentionAdmission.dataExactKeySuccessorCommit,
    "c73118ddb262d3010bbc94a900f8506fb2f56192",
  );
  assert.equal(
    contract.prospectiveRetentionAdmission.dataCoordinatorAdmissionSuccessorCommit,
    "c73118ddb262d3010bbc94a900f8506fb2f56192",
  );
  assert.equal(
    contract.prospectiveRetentionAdmission.infrastructureRetentionFailClosedSuccessorCommit,
    "46658265248b03f7b52f9e1ec0b1ca61ca2b5920",
  );
  assert.equal(
    contract.prospectiveRetentionAdmission.evaluationAdmissionRequired,
    true,
  );
  assert.equal(
    contract.prospectiveRetentionAdmission.exactEnvelopeAndBoundaryAllowlistRequired,
    true,
  );
  assert.equal(
    contract.prospectiveRetentionAdmission.dataSemanticParityRequired,
    true,
  );
  for (const field of [
    "canonicalEvaluationRecordRetentionAdmissionRequired",
    "sourceArchiveRawSha256BindingRequired",
    "authoritativeAdmissionTimeExpiryRequired",
    "strictCoordinatorKeyAllowlistRequired",
    "evaluationConstructionRequiresRetentionResolution",
    "validNoncanonicalRetentionCompatibilityRequired",
    "sourceCoordinatorSessionBindingRequired",
    "sourceFieldSessionAndRawHashBindingRequired",
  ]) {
    assert.equal(contract.prospectiveRetentionAdmission[field], true, field);
  }
  for (const [field, expected] of Object.entries({
    dataAuthenticatedAndHashBoundRequired: true,
    authoritativeLegalHoldLedgerRequired: true,
    maximumCalendarMonths: 18,
    customerMayOnlyShorten: true,
    customerMayExpand: false,
    historicalSyntheticReplayAdmissionAllowed: false,
    indefiniteRawRetentionAllowed: false,
    indefiniteAggregateRequiresExactDataAttestation: true,
  })) assert.equal(contract.prospectiveRetentionAdmission[field], expected, field);
  for (const field of [
    "missingExpiredUnknownStaleMalformedOrUnauthorizedAdmissionAllowed",
    "noncanonicalOriginAdmissionAllowed",
    "unknownOrActiveLegalHoldAdmissionAllowed",
    "derivedProjectionMayOutliveSource",
    "administrativelyDisposedSessionAdmissionAllowed",
    "historicalArchiveRewriteAllowed",
    "productionAuthenticatedRetentionEnvelopeProducerAvailable",
    "missingAuthenticatedRetentionMayAdmitEvaluation",
    "browserMaySupplyRetentionAuthority",
    "noncanonicalRetentionTestHookAvailableInProduction",
    "representativeOutputAllowed",
    "recommendationInfluenceAllowed",
    "productionActivationEligible",
  ]) {
    assert.equal(contract.prospectiveRetentionAdmission[field], false);
  }
  assert.equal(contract.prospectiveRetentionAdmission.auditVisibility, "hash_only");
  assert.equal(contract.prospectiveRetentionAdmission.collectionActivation, "OFF");
  assert.equal(contract.prospectiveRetentionAdmission.activeCohorts, 0);
  assert.equal(
    contract.prospectiveRetentionAdmission.canonicalProductionProspectiveRecords,
    0,
  );
  assert.equal(
    contract.prospectiveRetentionAdmission.canonicalProductionEvaluations,
    0,
  );
  assert.equal(
    computeRouteIqProspectiveRetentionPolicySha256(),
    contract.prospectiveRetentionAdmission.protectedDataSources.retentionPolicy
      .sha256,
  );
  for (const source of Object.values(
    contract.prospectiveRetentionAdmission.protectedDataSources,
  )) {
    const actual = createHash("sha256")
      .update(readFileSync(resolve(root, source.path)))
      .digest("hex");
    assert.equal(actual, source.sha256);
    assert.equal(
      source.sourceCommit,
      contract.prospectiveRetentionAdmission.dataExactKeySuccessorCommit,
    );
    assert.equal(source.sourceOwnerSubsystem, "Prometheus Data");
  }
  assert.equal(
    validateRouteIqProspectiveRetentionPolicy(
      loadRouteIqProspectiveRetentionPolicy(),
    ),
    true,
  );
  assert.equal(
    contract.committedOutcomeEvaluation
      .scoreableOutcomeAdmissionRequiresEvaluationContextSha256,
    true,
  );
  assert.equal(
    contract.committedOutcomeEvaluation.evaluation
      .missingOutcomeEvaluationAllowed,
    false,
  );
  assert.equal(
    contract.committedOutcomeEvaluation.evaluation.observationalOnly,
    true,
  );
  assert.equal(
    contract.committedOutcomeEvaluation.evaluation.causalClaimAllowed,
    false,
  );
  assert.equal(
    contract.committedOutcomeEvaluation.evaluation.upliftClaimAllowed,
    false,
  );
  assert.equal(
    config.committedOutcomeRuntime.evaluationContextSchemaVersion,
    routeIqEvaluationContextSchemaVersion,
  );
  assert.equal(
    config.committedOutcomeRuntime.productionEvaluationActivation,
    false,
  );
  assert.equal(
    config.committedOutcomeRuntime.canonicalProductionEvaluations,
    0,
  );
  assert.equal(
    config.committedOutcomeRuntime.sourceIntegrationStatus,
    "SOURCE_INTEGRATED_DEPLOYABLE_PRODUCTION_CONSUMER_INACTIVE",
  );
  assert.equal(config.committedOutcomeRuntime.productionConsumerActive, false);
  assert.equal(
    contract.committedOutcomeEvaluation.evaluation.sourceIntegrationStatus,
    config.committedOutcomeRuntime.sourceIntegrationStatus,
  );
  assert.equal(
    contract.committedOutcomeEvaluation.evaluation.productionConsumerActive,
    false,
  );
  assert.equal(
    contract.prospectiveRuntimeAdapter.durability.sqliteOnly,
    true,
  );
  assert.equal(
    contract.prospectiveRuntimeAdapter.durability.processLocalStateIntroduced,
    false,
  );
  assert.equal(
    contract.prospectiveRuntimeAdapter.durability.newKvBindingIntroduced,
    false,
  );
  assert.equal(
    contract.prospectiveRuntimeAdapter.representativeBoundary.opaque,
    true,
  );
  for (const field of [
    "rankingExposed",
    "probabilityExposed",
    "confidenceExposed",
    "eligibilityExposed",
    "readinessExposed",
    "engineInternalsExposed",
    "recommendationExposed",
  ]) {
    assert.equal(
      contract.prospectiveRuntimeAdapter.representativeBoundary[field],
      false,
    );
  }
  assert.equal(
    contract.prospectiveRuntimeAdapter.readModel.founderOnly,
    true,
  );
  assert.equal(
    contract.prospectiveRuntimeAdapter.readModel.representativeReadable,
    false,
  );
  assert.equal(
    contract.prospectiveRuntimeAdapter.readModel.keyedFounderCapabilityRequired,
    true,
  );
  assert.equal(contract.prospectiveRuntimeAdapter.readModel.aggregateOnly, true);
  assert.equal(
    contract.prospectiveRuntimeAdapter.readModel.browserStorageAllowed,
    false,
  );
  assert.equal(
    contract.prospectiveRuntimeAdapter.currentState.readiness,
    "INSUFFICIENT_EVIDENCE",
  );
  assert.equal(
    contract.prospectiveRuntimeAdapter.currentState
      .canonicalProductionProspectiveRecords,
    0,
  );
  assert.equal(
    contract.prospectiveRuntimeAdapter.currentState.sourceIntegrationStatus,
    "SOURCE_INTEGRATED_DEPLOYABLE_PRODUCTION_CONSUMER_INACTIVE",
  );
  assert.equal(
    contract.prospectiveRuntimeAdapter.currentState.productionConsumerActive,
    false,
  );
  assert.equal(
    contract.prospectiveRuntimeAdapter.currentState.productionDeploymentActive,
    false,
  );
  assert.equal(
    contract.prospectiveRuntimeAdapter.currentState.collectionActivation,
    "OFF",
  );
  assert.equal(
    config.prospectiveRuntime.sourceIntegrationStatus,
    contract.prospectiveRuntimeAdapter.currentState.sourceIntegrationStatus,
  );
  assert.equal(config.prospectiveRuntime.productionConsumerActive, false);
  assert.equal(config.prospectiveRuntime.productionDeploymentActive, false);
  assert.equal(config.prospectiveRuntime.collectionActivation, "OFF");
  assert.equal(config.prospectiveRuntime.collectionActivationPathAvailable, true);
  assert.equal(config.prospectiveRuntime.recommendationActivationPathAvailable, false);
  assert.equal(config.prospectiveRuntime.activationPathAvailable, false);
  assert.equal(
    contract.prospectiveRuntimeAdapter.currentState.recommendationInfluence,
    "OFF",
  );
  assert.equal(config.prospectiveRuntime.candidateTargetSize, 15);
  assert.deepEqual(config.prospectiveRuntime.candidateSourcePools, [
    "active",
    "full",
  ]);
  assert.equal(
    config.prospectiveRuntime.coordinatorDurability,
    "sqlite_durable_object",
  );
  assert.deepEqual(contract.states, [...readinessStates]);
  assert.deepEqual(contract.directiveGates, [
    "zero_influence",
    "temporal_integrity",
    "deterministic_replay",
    "completeness",
    "outcome_integrity",
    "evaluation_validity",
    "statistical_sufficiency",
    "segment_safety",
    "calibration_stability",
    "isolation_compatibility",
  ]);
  assert.equal(contract.statisticalDesign.requiredSample, 97);
  assert.equal(
    contract.statisticalDesign.derivedPerBinSupport,
    Math.ceil(97 / config.calibrationBinCount),
  );
  assert.equal(
    contract.statisticalDesign.derivedPerBinSupport
      * contract.statisticalDesign.calibrationBins,
    100,
  );
  assert.equal(
    contract.validationFixturePolicy.classification,
    "VALIDATION_ONLY_NON_PRODUCTION_NEVER_CANONICAL",
  );
  const fixture = JSON.parse(
    readFileSync(resolve(root, contract.artifacts.fixture), "utf8"),
  );
  assert.equal(
    fixture.fixtureClassification,
    contract.validationFixturePolicy.classification,
  );
  assert.equal(fixture.canonicalGenerationAllowed, false);
  assert.equal(contract.isolation.recommendationInfluence, "OFF");
  assert.equal(config.recommendationInfluence, "OFF");
  assert.equal(config.minimumActualActionLinkRate, 1);
  assert.equal(config.minimumAnyOutcomeLinkRate, 1);
  assert.equal(config.minimumScoreableSelectedCandidateOutcomeRate, 1);
  assert.equal(
    contract.coverageGates.minimumActualActionLinkRate,
    config.minimumActualActionLinkRate,
  );
  assert.equal(
    contract.coverageGates.minimumAnyOutcomeLinkRate,
    config.minimumAnyOutcomeLinkRate,
  );
  assert.equal(
    contract.coverageGates.minimumScoreableSelectedCandidateOutcomeRate,
    config.minimumScoreableSelectedCandidateOutcomeRate,
  );
  assert.equal(
    contract.coverageGates.unresolvedCoverageReasonBlocksEligibility,
    true,
  );
  assert.equal(
    contract.administrativeDispositionAdmission
      .disposedSessionReadinessAdmissionAllowed,
    false,
  );
  assert.equal(
    contract.administrativeDispositionAdmission
      .disposedSessionEvaluationAdmissionAllowed,
    false,
  );
  assert.equal(
    contract.administrativeDispositionAdmission
      .disposedSessionCalibrationAdmissionAllowed,
    false,
  );
  assert.equal(
    contract.administrativeDispositionAdmission
      .disposedSessionBaselineAdmissionAllowed,
    false,
  );
  assert.equal(
    contract.administrativeDispositionAdmission
      .disposedSessionSegmentMetricAdmissionAllowed,
    false,
  );
  assert.equal(
    contract.administrativeDispositionAdmission
      .disposedSessionRecommendationInputAllowed,
    false,
  );
  assert.equal(
    contract.administrativeDispositionAdmission
      .automaticZeroVisitExclusionAllowed,
    false,
  );
  assert.equal(
    contract.administrativeDispositionAdmission
      .unrelatedUndisposedZeroVisitSessionEligible,
    true,
  );
  assert.equal(
    contract.administrativeDispositionAdmission.exactExcludedSessionId,
    "route-iq-field-session-fitness-connection-fitness-cruz-2026-07-14",
  );
  assert.equal(
    contract.administrativeDispositionAdmission.exactExcludedRawSha256,
    "ceb72963ab4e98d6039c1a4a1a409d281bf9e41e6001bd78cca4c04364815765",
  );
  assert.deepEqual(
    contract.administrativeDispositionAdmission.auditProjectionAllowedFields,
    ["sourceRawSha256", "dispositionRecordSha256"],
  );
  assert.equal(
    contract.administrativeDispositionAdmission
      .auditProjectionRawPayloadAllowed,
    false,
  );
  assert.equal(
    contract.statisticalDesign.calibrationBins,
    config.calibrationBinCount,
  );
  assert.deepEqual(contract.statisticalDesign.derivedWindowSupport, [49, 48]);
  assert.equal(
    contract.statisticalDesign.derivedMaterialSegmentSupport,
    Math.ceil(97 * config.materialSegmentFraction),
  );
  assert.deepEqual([...contract.requiredProtectedBehaviorBaselineKeys].sort(), [
    ...requiredProtectedBehaviorBaselineKeys,
  ]);
  assert.deepEqual(
    Object.keys(contract.protectedBehaviorBaselines || {}).sort(),
    [...requiredProtectedBehaviorBaselineKeys],
  );
  assert.equal(
    contract.protectedBehaviorBaselines.routeScoring.path,
    "scripts/build-route-intelligence-quality-engine.mjs",
  );
  assert.deepEqual(
    contract.protectedBehaviorBaselines.routeQualityGate,
    {
      path: "scripts/lib/route-intelligence-quality-gate.mjs",
      sha256:
        "e4ff3c3e3cf919c4d4986f873b79868f7e9f7537ad37854997b60695921dbc56",
      sourceCommit: "26b07905926662e3323e557d77c608db0cbc23ed",
      sourceOwnerSubsystem: "Prometheus Data",
      provenance:
        "Hash computed from the Data-owned route-quality gate after canonical nine-fetch baseline synchronization; Intelligence verifies but never rewrites the quality gate.",
    },
  );
  for (const path of Object.values(contract.artifacts))
    assert.equal(
      existsSync(resolve(root, path)),
      true,
      `Declared artifact path missing: ${path}`,
    );
  return true;
}

export function verifyShadowDecisionReadiness({
  write = false,
  contract = loadShadowDecisionContract(),
  config = loadShadowDecisionConfig(),
} = {}) {
  validateShadowDecisionContractCoherence(contract, config);
  const dataRuntime = contract.protectedDataRuntimeBaseline;
  const actualDataRuntimeSha256 = createHash("sha256")
    .update(readFileSync(resolve(root, dataRuntime.path)))
    .digest("hex");
  assert.equal(
    actualDataRuntimeSha256,
    dataRuntime.sha256,
    "Protected Data prospective runtime changed without Intelligence provenance synchronization",
  );
  const runtimeAdapterText = readFileSync(
    resolve(root, contract.artifacts.runtimeAdapter),
    "utf8",
  );
  assert.match(runtimeAdapterText, /computeRouteIqCandidateManifestDigests/);
  assert.match(runtimeAdapterText, /buildSnapshotSealCoordinatorClaims/);
  assert.match(runtimeAdapterText, /buildShadowDecisionSealCoordinatorClaims/);
  assert.match(runtimeAdapterText, /immutable_accepted_snapshot/);
  assert.doesNotMatch(
    runtimeAdapterText,
    /createCloudflareKvFieldSessionStore|runtimeAppendLocks|localStorage|sessionStorage|indexedDB/,
  );
  const infrastructureRuntimeText = readFileSync(
    resolve(
      root,
      contract.protectedBehaviorBaselines.infrastructureRuntime.path,
    ),
    "utf8",
  );
  assert.match(
    infrastructureRuntimeText,
    /resolveRouteIqEvaluationRetentionEnvelope/,
  );
  assert.match(
    infrastructureRuntimeText,
    /route_iq_prospective_retention_input_unavailable/,
  );
  assert.match(
    infrastructureRuntimeText,
    /noncanonicalTestHooks\?\.enabled !== true[\s\S]+readNoncanonicalDataRetentionAdmission[\s\S]+verifyRouteIqProspectiveDataRetentionAdmission/,
  );
  const retentionResolutionIndex = infrastructureRuntimeText.indexOf(
    "resolveRouteIqEvaluationRetentionEnvelope({",
  );
  const evaluationConstructionIndex = infrastructureRuntimeText.indexOf(
    "buildRouteIqEvaluationFromAdmittedOutcome({",
    retentionResolutionIndex,
  );
  assert.ok(retentionResolutionIndex >= 0);
  assert.ok(evaluationConstructionIndex > retentionResolutionIndex);
  assert.deepEqual(
    Object.keys(contract.protectedBehaviorBaselines || {}).sort(),
    [...requiredProtectedBehaviorBaselineKeys],
  );
  for (const [name, baseline] of Object.entries(
    contract.protectedBehaviorBaselines,
  )) {
    const actual = createHash("sha256")
      .update(readFileSync(resolve(root, baseline.path)))
      .digest("hex");
    assert.equal(
      actual,
      baseline.sha256,
      `Protected zero-influence baseline changed: ${name}`,
    );
  }
  const archiveRecord = buildCommittedArchiveRecord(paths);
  const ledger = buildShadowLedger({ archiveRecord, contract });
  const report = buildFounderReadinessReport(ledger);
  const markdown = renderFounderReadinessMarkdown(report);
  assert.equal(ledger.records.length, 0);
  assert.equal(ledger.exclusions.length, 4);
  assert.equal(report.state, "INSUFFICIENT_EVIDENCE");
  assert.equal(report.recommendationInfluence, "OFF");
  assert.equal(report.metrics.calibrationBrierScore, null);
  assert.equal(report.metrics.actualActionLinkRate, null);
  assert.equal(report.metrics.anyOutcomeLinkRate, null);
  assert.equal(report.metrics.scoreableSelectedCandidateOutcomeRate, null);
  assert.equal(report.shadowLedgerSha256, ledger.shadowLedgerSha256);
  assert.equal(report.outcomeChainSha256, ledger.outcomeChainSha256);
  assert.equal(report.evaluatedLedgerSha256, ledger.evaluationLedgerSha256);
  for (const [kind, content] of [
    ["ledger", serialize(ledger)],
    ["report", serialize(report)],
    ["humanReport", markdown],
  ]) {
    const path = resolve(root, contract.artifacts[kind]);
    if (write) {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, content);
    } else
      assert.equal(
        readFileSync(path, "utf8"),
        content,
        `${kind} artifact is stale`,
      );
  }
  return {
    status: "passed",
    batchId: contract.batchId,
    readinessState: report.state,
    opportunities: 4,
    shadows: 0,
    exclusions: 4,
    recommendationInfluence: "OFF",
  };
}

if (process.argv[1] === new URL(import.meta.url).pathname)
  console.log(
    JSON.stringify(
      verifyShadowDecisionReadiness({
        write: process.argv.includes("--write"),
      }),
      null,
      2,
    ),
  );
