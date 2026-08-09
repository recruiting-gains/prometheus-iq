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
import {
  verifyControlledOnboardingRehearsalSmokeContractSuccessor,
  verifyCrossIndustryZipFounderAccessAdoption,
} from "../intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs";

const root = resolve(import.meta.dirname, "..");
const crossIndustryShadowReadinessCoherenceSuccessorPath =
  "intelligence/provenance/protected-baseline-synchronization-cross-industry-shadow-readiness-coherence-v1.json";
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
    "fd14a3b13ac00b645857396f3d26fa069762b715",
  );
  assert.equal(
    workerBaseline.sourceOwnerSubsystem,
    "Prometheus Infrastructure",
  );
  assert.deepEqual(workerBaseline.predecessor, {
    sha256: "b260dcea7204c6de0c0e403a5a67bdac5f95dd46acfc62150ce852666a780870",
    sourceCommit: "e41e025173d9843de51c6c8e789570e27345a13b",
    remainsHistorical: true,
    rewritten: false,
  });
  assert.equal(
    workerBaseline.provenanceSuccessor,
    contract.artifacts.august1LaunchBaselineSuccessor,
  );
  const dashboardSourceBaseline =
    contract.protectedBehaviorBaselines.dashboardSource;
  const dashboardDeployBaseline =
    contract.protectedBehaviorBaselines.dashboardDeployMirror;
  for (const dashboardBaseline of [
    dashboardSourceBaseline,
    dashboardDeployBaseline,
  ]) {
    assert.equal(
      dashboardBaseline.sourceCommit,
      "99457bcda1abed536cc06585492d29f5ac500f05",
    );
    assert.equal(
      dashboardBaseline.sourceOwnerSubsystem,
      "Prometheus Dashboard",
    );
    assert.equal(
      dashboardBaseline.provenanceSuccessor,
      contract.artifacts.august1LaunchBaselineSuccessor,
    );
    assert.deepEqual(dashboardBaseline.predecessor, {
      sha256: "385e35bc547cb74d6ce29290bfdb317345969e316ad6650946f083796332c177",
      sourceCommit: "82d1e6f23ca3a75c0073c051531477913258a98f",
      remainsHistorical: true,
      rewritten: false,
    });
  }
  const routeGenerationBaseline =
    contract.protectedBehaviorBaselines.routeGeneration;
  const businessHoursEligibilityBaseline =
    contract.protectedBehaviorBaselines.businessHoursEligibility;
  for (const intelligenceBaseline of [
    routeGenerationBaseline,
    businessHoursEligibilityBaseline,
  ]) {
    assert.equal(
      intelligenceBaseline.sourceCommit,
      "54804800533e705efe7add510e5e4bb72a3ba7dc",
    );
    assert.equal(
      intelligenceBaseline.sourceOwnerSubsystem,
      "Prometheus Intelligence Engine",
    );
    assert.equal(
      intelligenceBaseline.provenanceSuccessor,
      contract.artifacts.august1LaunchBaselineSuccessor,
    );
    assert.equal(intelligenceBaseline.predecessor.remainsHistorical, true);
    assert.equal(intelligenceBaseline.predecessor.rewritten, false);
  }
  assert.deepEqual(routeGenerationBaseline.predecessor, {
    sha256: "c136cd445a78f8d043fdc0d83b841094aa27370c48aae226c0aab2c496b6fb19",
    sourceCommit: "be7a04c8df84a68d20868ce53183965495a4fc7d",
    remainsHistorical: true,
    rewritten: false,
  });
  assert.deepEqual(businessHoursEligibilityBaseline.predecessor, {
    sha256: "1c884b6c5c2668e6a034311d605fdc626d80c6d517290ef994d772e03cfb9a4a",
    sourceCommit: "be7a04c8df84a68d20868ce53183965495a4fc7d",
    remainsHistorical: true,
    rewritten: false,
  });

  const runtimeGuardSuccessor = JSON.parse(
    readFileSync(
      resolve(root, contract.artifacts.unattendedRuntimeGuardBaselineSuccessor),
      "utf8",
    ),
  );
  assert.equal(
    runtimeGuardSuccessor.version,
    "route-iq-intelligence-unattended-runtime-guard-protected-baseline-successor-v3",
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
  assert.deepEqual(runtimeGuardSuccessor.predecessorCheckpoint, {
    path:
      "intelligence/provenance/protected-baseline-synchronization-batch-20260714-006-unattended-runtime-guard-v1.json",
    commit: "0bda1d1fff7e8bee09c72e0248970b52dd013382",
    tree: "53925227263d7fa3ebd8182550f6094c3fa84a90",
    sha256: "411fee907170b091f017e0360cb89850a8db9268c41daf450fe5136a7ecaf465",
    version:
      "route-iq-intelligence-unattended-runtime-guard-protected-baseline-successor-v2",
    remainsHistorical: true,
    rewritten: false,
  });
  assert.equal(
    runtimeGuardSuccessor.historicalProtectedSource.sha256,
    "723ce018f4a4e1f0f731da02c0852e75c9c2ef0808b124055db2ad1b96124c59",
  );
  assert.equal(
    runtimeGuardSuccessor.historicalProtectedSource.sourceCommit,
    "2280c6dae9d07bcfd744e99e9d28126188653eb2",
  );
  assert.equal(runtimeGuardSuccessor.historicalProtectedSource.remainsHistorical, true);
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
    workerBaseline.predecessor.sourceCommit,
  );
  assert.equal(
    runtimeGuardSuccessor.infrastructureOwnerTransition.supplyChainHardeningCommit,
    "3c8ca61910358c13cc0c05e1fbda5d3052b31a9b",
  );
  assert.equal(
    runtimeGuardSuccessor.infrastructureOwnerTransition.worker.currentSha256,
    workerBaseline.predecessor.sha256,
  );
  assert.equal(
    runtimeGuardSuccessor.infrastructureOwnerTransition.worker.previousSha256,
    runtimeGuardSuccessor.historicalProtectedSource.sha256,
  );
  assert.equal(
    runtimeGuardSuccessor.infrastructureOwnerTransition.worker
      .changedBySupplyChainHardeningCommit,
    false,
  );
  const smokeGuard =
    runtimeGuardSuccessor.infrastructureOwnerTransition.servicePrincipalGuard;
  assert.equal(sha256File(smokeGuard.guardPath), smokeGuard.guardSha256);
  const rehearsalSmokeContract =
    verifyControlledOnboardingRehearsalSmokeContractSuccessor()
      .transitionByPath.get(smokeGuard.contractPath);
  assert.equal(
    rehearsalSmokeContract.previousSha256,
    smokeGuard.contractSha256,
  );
  assert.equal(
    sha256File(smokeGuard.contractPath),
    rehearsalSmokeContract.currentSha256,
  );
  assert.equal(smokeGuard.ordinaryAuthenticatedHumanRoutingChanged, false);
  const smokeTimeoutSuccessor =
    runtimeGuardSuccessor.infrastructureSmokeTimeoutSuccessor;
  assert.equal(smokeTimeoutSuccessor.ownerSubsystem, "Prometheus Infrastructure");
  assert.equal(
    smokeTimeoutSuccessor.commit,
    "a7822e6535892ee4b51c483089f9f045c3185724",
  );
  assert.equal(
    smokeTimeoutSuccessor.tree,
    "f224d29e523d8abd171e17d4f8b846d5ca273ac1",
  );
  assert.equal(
    smokeTimeoutSuccessor.failedDeploymentRun,
    "30519465645",
  );
  assert.equal(
    smokeTimeoutSuccessor.failureClassification,
    "SMOKE_FAILURE|DIMENSION=NETWORK_FAILED|PROBE=BUSINESS_HOURS_GET",
  );
  assert.equal(smokeTimeoutSuccessor.forwardRollbackVerified, true);
  assert.equal(smokeTimeoutSuccessor.guard.path, smokeGuard.guardPath);
  assert.equal(smokeTimeoutSuccessor.guard.sha256, smokeGuard.guardSha256);
  assert.equal(smokeTimeoutSuccessor.contract.path, smokeGuard.contractPath);
  assert.equal(smokeTimeoutSuccessor.contract.sha256, smokeGuard.contractSha256);
  assert.deepEqual(smokeTimeoutSuccessor.timeoutContract, {
    serverJwksTimeoutMilliseconds: 5000,
    responseSafetyMarginMilliseconds: 3000,
    clientRequestTimeoutMilliseconds: 8000,
    fullPlanDeadlineMilliseconds: 135000,
  });
  assert.equal(smokeTimeoutSuccessor.intelligenceBehaviorChanged, false);
  assert.equal(
    runtimeGuardSuccessor.intelligenceOwnerSynchronization.contract.path,
    contract.artifacts.contract,
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

  const commercialReadinessSuccessor = JSON.parse(
    readFileSync(
      resolve(root, contract.artifacts.commercialReadinessBaselineSuccessor),
      "utf8",
    ),
  );
  assert.equal(commercialReadinessSuccessor.batchId, "BATCH-20260718-002");
  assert.equal(
    commercialReadinessSuccessor.ownerSubsystem,
    "Prometheus Intelligence Engine",
  );
  assert.equal(
    commercialReadinessSuccessor.sourceTransitions.worker.founderSnapshotEndpointCommit,
    "11ac0668b87ed347c22bf963938b8d650370cfdb",
  );
  assert.equal(
    commercialReadinessSuccessor.sourceTransitions.worker.predecessorSha256,
    workerBaseline.predecessor.sha256,
  );
  assert.equal(
    commercialReadinessSuccessor.sourceTransitions.worker.currentSha256,
    "4950424f65b20e68d332b89bd660983107cec1dd81d55ae2d8c4e77cab0ce68a",
  );
  assert.equal(
    dashboardSourceBaseline.predecessor.sha256,
    commercialReadinessSuccessor.sourceTransitions.dashboard.currentSha256,
  );
  assert.equal(
    dashboardDeployBaseline.predecessor.sha256,
    commercialReadinessSuccessor.sourceTransitions.dashboard.currentSha256,
  );
  assert.equal(
    commercialReadinessSuccessor.independentReview.workerEndpointMethod,
    "GET",
  );
  assert.equal(
    commercialReadinessSuccessor.independentReview.workerEndpointConfiguredByDefault,
    false,
  );
  assert.equal(
    commercialReadinessSuccessor.boundaries.recommendationInfluence,
    "OFF",
  );
  assert.equal(commercialReadinessSuccessor.boundaries.deploymentPerformed, false);

  const august1LaunchSuccessor = JSON.parse(
    readFileSync(
      resolve(root, contract.artifacts.august1LaunchBaselineSuccessor),
      "utf8",
    ),
  );
  assert.equal(
    august1LaunchSuccessor.version,
    "route-iq-intelligence-august-1-protected-baseline-successor-v1",
  );
  assert.equal(
    august1LaunchSuccessor.directive,
    "Prometheus August 1 Autonomous Launch-Closeout Directive",
  );
  assert.equal(
    august1LaunchSuccessor.status,
    "OWNER_REVIEWED_AND_SYNCHRONIZED",
  );
  assert.equal(
    august1LaunchSuccessor.ownerSubsystem,
    "Prometheus Intelligence Engine",
  );
  assert.equal(
    august1LaunchSuccessor.predecessor.path,
    contract.artifacts.commercialReadinessBaselineSuccessor,
  );
  assert.equal(
    sha256File(august1LaunchSuccessor.predecessor.path),
    august1LaunchSuccessor.predecessor.sha256,
  );
  assert.equal(august1LaunchSuccessor.predecessor.remainsHistorical, true);
  assert.equal(august1LaunchSuccessor.predecessor.rewritten, false);

  const dashboardCoherenceSuccessor = JSON.parse(
    readFileSync(
      resolve(root, crossIndustryShadowReadinessCoherenceSuccessorPath),
      "utf8",
    ),
  );
  const zipFounderAdoption = verifyCrossIndustryZipFounderAccessAdoption();
  const retentionDeletionSuccessor =
    zipFounderAdoption.rehearsalSuccessor
      .retentionDeletionRuntimeProtectedSuccessor;
  assert.equal(
    dashboardCoherenceSuccessor.version,
    "route-iq-intelligence-cross-industry-shadow-readiness-coherence-v1",
  );
  assert.equal(
    dashboardCoherenceSuccessor.status,
    "OWNER_REVIEWED_COHERENCE_SUCCESSOR_PENDING_OVERWATCH",
  );
  assert.equal(
    dashboardCoherenceSuccessor.ownerSubsystem,
    "Prometheus Intelligence Engine",
  );
  assert.equal(
    sha256File(dashboardCoherenceSuccessor.predecessor.path),
    dashboardCoherenceSuccessor.predecessor.sha256,
  );
  assert.equal(dashboardCoherenceSuccessor.predecessor.remainsHistorical, true);
  assert.equal(dashboardCoherenceSuccessor.predecessor.rewritten, false);
  const currentProtectedTransitionGroups = [
    dashboardCoherenceSuccessor.dashboardTransitions,
    dashboardCoherenceSuccessor.infrastructureTransitions,
    dashboardCoherenceSuccessor.dataTransitions,
    dashboardCoherenceSuccessor.intelligenceRuntimeTransitions,
  ];
  for (const group of currentProtectedTransitionGroups) {
    assert.ok(Array.isArray(group));
    assert.ok(group.length > 0);
  }
  const currentProtectedTransitionEntries =
    currentProtectedTransitionGroups.flat();
  const currentProtectedTransitions = Object.fromEntries(
    currentProtectedTransitionEntries.map((transition) => [
      transition.path,
      transition,
    ]),
  );
  assert.equal(
    Object.keys(currentProtectedTransitions).length,
    currentProtectedTransitionEntries.length,
  );
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(currentProtectedTransitions)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([path, transition]) => [
          path,
          {
            ownerSubsystem: transition.ownerSubsystem,
            commit: transition.commit,
          },
        ]),
    ),
    {
      "data/qualified-prospects/google-qualified-businesses-v2/business-hours-v1/business-hours.json":
        {
          ownerSubsystem: "Prometheus Data",
          commit: "c9b8ac823fac489e017c9ddd0c116d60985542e8",
        },
      "data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/active-pool.json":
        {
          ownerSubsystem: "Prometheus Data",
          commit: "c9b8ac823fac489e017c9ddd0c116d60985542e8",
        },
      "data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/quarantine-pool.json":
        {
          ownerSubsystem: "Prometheus Data",
          commit: "c9b8ac823fac489e017c9ddd0c116d60985542e8",
        },
      "deploy/cloudflare-pages/index.html": {
        ownerSubsystem: "Prometheus Infrastructure",
        commit: "1ab2f617d77fa590ed39b7f5e7cb5ebb425f86a7",
      },
      "index.html": {
        ownerSubsystem: "Prometheus Dashboard",
        commit: "1893bcbcb13ca7caffbb86331e6c5f68072ae76e",
      },
      "intelligence/continuous-adaptive-route-replenishment.mjs": {
        ownerSubsystem: "Prometheus Intelligence Engine",
        commit: "cc0e9ebd8cac784ad4cffa2897c3a537a7dff835",
      },
      "intelligence/discovery-mode-intelligence-v2.mjs": {
        ownerSubsystem: "Prometheus Intelligence Engine",
        commit: "73fb53a8382c0520542c13be2d742f62d6d4c34a",
      },
      "intelligence/nearby-context-intelligence-v2.mjs": {
        ownerSubsystem: "Prometheus Intelligence Engine",
        commit: "73fb53a8382c0520542c13be2d742f62d6d4c34a",
      },
      "intelligence/route-business-hours-eligibility.mjs": {
        ownerSubsystem: "Prometheus Intelligence Engine",
        commit: "cc0e9ebd8cac784ad4cffa2897c3a537a7dff835",
      },
      "overwatch/artifact-contracts/data/fitness-connection-runtime-artifact-contract-v1.json":
        {
          ownerSubsystem: "Prometheus Data",
          commit: "920909eeed01c6d77b2090865199e6cf29618742",
        },
      "scripts/lib/route-intelligence-quality-gate.mjs": {
        ownerSubsystem: "Prometheus Intelligence Engine",
        commit: "0e00fff6231045eb11a4508a87ae95e7b9fd6f6c",
      },
      "workers/prometheus-iq-worker.js": {
        ownerSubsystem: "Prometheus Infrastructure",
        commit: "c1d029def71efab6c555ffa851fda6be7c3fc3cc",
      },
    },
  );

  const dashboardTransition = august1LaunchSuccessor.sourceTransitions.dashboard;
  assert.equal(dashboardTransition.ownerSubsystem, "Prometheus Dashboard");
  assert.equal(dashboardTransition.commit, dashboardSourceBaseline.sourceCommit);
  assert.equal(
    dashboardTransition.previousSha256,
    dashboardSourceBaseline.predecessor.sha256,
  );
  assert.equal(
    dashboardTransition.currentSha256,
    dashboardSourceBaseline.sha256,
  );
  const currentDashboardTransitions = Object.fromEntries(
    dashboardCoherenceSuccessor.dashboardTransitions.map((transition) => [
      transition.path,
      transition,
    ]),
  );
  for (const dashboardBaseline of [
    dashboardSourceBaseline,
    dashboardDeployBaseline,
  ]) {
    const currentTransition = currentDashboardTransitions[dashboardBaseline.path];
    const latestTransition =
      zipFounderAdoption.transitionByPath.get(dashboardBaseline.path);
    assert.ok(currentTransition);
    assert.ok(latestTransition);
    assert.equal(currentTransition.previousSha256, dashboardBaseline.sha256);
    assert.equal(
      latestTransition.previousSha256,
      currentTransition.currentSha256,
    );
    assert.equal(
      latestTransition.currentSha256,
      sha256File(dashboardBaseline.path),
    );
  }
  assert.equal(
    currentDashboardTransitions[dashboardSourceBaseline.path].ownerSubsystem,
    "Prometheus Dashboard",
  );
  assert.equal(
    currentDashboardTransitions[dashboardSourceBaseline.path].commit,
    "1893bcbcb13ca7caffbb86331e6c5f68072ae76e",
  );
  assert.equal(
    currentDashboardTransitions[dashboardDeployBaseline.path].ownerSubsystem,
    "Prometheus Infrastructure",
  );
  assert.equal(
    currentDashboardTransitions[dashboardDeployBaseline.path].commit,
    "1ab2f617d77fa590ed39b7f5e7cb5ebb425f86a7",
  );
  assert.equal(
    zipFounderAdoption.transitionByPath.get(dashboardSourceBaseline.path)
      .currentSha256,
    zipFounderAdoption.transitionByPath.get(dashboardDeployBaseline.path)
      .currentSha256,
  );
  assert.deepEqual(dashboardCoherenceSuccessor.coherenceRule, {
    historicalContractBaselineRewritten: false,
    historicalContractBaselineMustMatchTransitionPredecessor: true,
    currentFilesystemMustMatchTransitionSuccessor: true,
    sourceDeployParityRequired: true,
    crossIndustryRuntimeSuccessorRequired: true,
    allCurrentProtectedSuccessorsRequired: true,
    shadowRuntimeBehaviorChanged: false,
  });

  const intelligenceTransition =
    august1LaunchSuccessor.sourceTransitions.intelligenceRuntime;
  assert.equal(
    intelligenceTransition.ownerSubsystem,
    "Prometheus Intelligence Engine",
  );
  assert.equal(intelligenceTransition.commit, routeGenerationBaseline.sourceCommit);
  assert.deepEqual(intelligenceTransition.routeGeneration, {
    path: routeGenerationBaseline.path,
    previousSha256: routeGenerationBaseline.predecessor.sha256,
    currentSha256: routeGenerationBaseline.sha256,
  });
  assert.deepEqual(intelligenceTransition.businessHoursEligibility, {
    path: businessHoursEligibilityBaseline.path,
    previousSha256: businessHoursEligibilityBaseline.predecessor.sha256,
    currentSha256: businessHoursEligibilityBaseline.sha256,
  });
  const currentIntelligenceTransitions = Object.fromEntries(
    dashboardCoherenceSuccessor.intelligenceRuntimeTransitions.map(
      (transition) => [transition.path, transition],
    ),
  );
  for (const intelligenceBaseline of [
    routeGenerationBaseline,
    businessHoursEligibilityBaseline,
  ]) {
    const currentTransition =
      currentIntelligenceTransitions[intelligenceBaseline.path];
    const latestTransition =
      zipFounderAdoption.transitionByPath.get(intelligenceBaseline.path);
    assert.ok(currentTransition);
    assert.equal(
      currentTransition.ownerSubsystem,
      "Prometheus Intelligence Engine",
    );
    assert.equal(
      currentTransition.commit,
      "cc0e9ebd8cac784ad4cffa2897c3a537a7dff835",
    );
    assert.equal(currentTransition.previousSha256, intelligenceBaseline.sha256);
    if (latestTransition) {
      assert.equal(
        latestTransition.previousSha256,
        currentTransition.currentSha256,
      );
      assert.equal(
        latestTransition.currentSha256,
        sha256File(intelligenceBaseline.path),
      );
    } else {
      assert.equal(
        currentTransition.currentSha256,
        sha256File(intelligenceBaseline.path),
      );
    }
  }

  const workerTransition = august1LaunchSuccessor.sourceTransitions.worker;
  assert.equal(workerTransition.ownerSubsystem, "Prometheus Infrastructure");
  assert.equal(workerTransition.commit, workerBaseline.sourceCommit);
  assert.equal(
    workerTransition.previousSha256,
    commercialReadinessSuccessor.sourceTransitions.worker.currentSha256,
  );
  assert.equal(workerTransition.currentSha256, workerBaseline.sha256);
  const crossIndustryWorkerTransition =
    currentProtectedTransitions[workerBaseline.path];
  const currentWorkerTransition =
    zipFounderAdoption.transitionByPath.get(workerBaseline.path);
  assert.ok(crossIndustryWorkerTransition);
  assert.ok(currentWorkerTransition);
  assert.equal(
    crossIndustryWorkerTransition.ownerSubsystem,
    "Prometheus Infrastructure",
  );
  assert.equal(
    crossIndustryWorkerTransition.commit,
    "c1d029def71efab6c555ffa851fda6be7c3fc3cc",
  );
  assert.equal(
    crossIndustryWorkerTransition.previousSha256,
    workerBaseline.sha256,
  );
  assert.equal(
    currentWorkerTransition.previousSha256,
    crossIndustryWorkerTransition.currentSha256,
  );
  assert.equal(
    currentWorkerTransition.currentSha256,
    sha256File(workerBaseline.path),
  );
  assert.deepEqual(
    workerTransition.historicalPredecessor,
    workerBaseline.predecessor,
  );

  const referenceAudit = august1LaunchSuccessor.protectedReferenceAudit;
  assert.equal(referenceAudit.consumerPath, contract.artifacts.contract);
  assert.equal(
    referenceAudit.currentConsumerSha256,
    dashboardCoherenceSuccessor.protectedConsumer.historicalAugustSha256,
  );
  assert.equal(
    dashboardCoherenceSuccessor.protectedConsumer.path,
    contract.artifacts.contract,
  );
  const retentionDeletionContractTransitions =
    retentionDeletionSuccessor.successorTransitionsByPath.get(
      contract.artifacts.contract,
    );
  assert.equal(retentionDeletionContractTransitions.length, 1);
  const retentionDeletionContractTransition =
    retentionDeletionContractTransitions[0];
  assert.equal(
    dashboardCoherenceSuccessor.protectedConsumer.currentSha256,
    retentionDeletionContractTransition.previousSha256,
  );
  assert.equal(
    retentionDeletionContractTransition.currentSha256,
    sha256File(dashboardCoherenceSuccessor.protectedConsumer.path),
  );
  assert.equal(
    dashboardCoherenceSuccessor.protectedConsumer.modifiedByThisSuccessor,
    false,
  );
  assert.equal(referenceAudit.affectedBaselines.length, 5);
  assert.equal(
    referenceAudit.allAffectedIntelligenceReferencesAccountedFor,
    true,
  );
  assert.deepEqual(august1LaunchSuccessor.boundaries, {
    readinessState: "INSUFFICIENT_EVIDENCE",
    prospectiveCollection: "OFF",
    activeCohorts: 0,
    recommendationInfluence: "OFF",
    representativeShadowOutputExposed: false,
    routeOrderingChangedBySynchronization: false,
    routeScoringChangedBySynchronization: false,
    deploymentPerformed: false,
    productionAccessPerformed: false,
    productionMutationPerformed: false,
  });
  assert.deepEqual(dashboardCoherenceSuccessor.boundaries, {
    readinessState: "INSUFFICIENT_EVIDENCE",
    prospectiveCollection: "OFF",
    activeCohorts: 0,
    recommendationInfluence: "OFF",
    representativeShadowOutputExposed: false,
    routeOrderingChanged: false,
    routeScoringChanged: false,
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
    contract.prospectiveRetentionAdmission.sourceDeletionSuccessorBatchId,
    "BATCH-20260809-001",
  );
  assert.equal(
    contract.prospectiveRetentionAdmission.dataDeletionRuntimeFinalCommit,
    "a8fedf7c0b88f0611b4f721b08641e55413c591a",
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
    "deletionStartedOrCompletedAdmissionAllowed",
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
  const expectedRetentionSourceCommits = {
    retentionPolicy: "28c8a51b4aafef777e407c324ea15c57f4f12454",
    retentionEvaluator: "8845846632801ccf29e52a36139a43c1063fcc2e",
  };
  for (const [sourceName, source] of Object.entries(
    contract.prospectiveRetentionAdmission.protectedDataSources,
  )) {
    const actual = createHash("sha256")
      .update(readFileSync(resolve(root, source.path)))
      .digest("hex");
    assert.equal(actual, source.sha256);
    assert.equal(source.sourceCommit, expectedRetentionSourceCommits[sourceName]);
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
        "30184d6d3ce3bd8dacf1e78c025c0fb594cfcb436c11939ee987a94c90828acb",
      sourceCommit: "85850c74564798889ba50cb15c7a7b0406a521fd",
      sourceOwnerSubsystem: "Prometheus Data",
      provenanceSuccessor:
        "intelligence/provenance/protected-baseline-synchronization-batch-20260719-006-data-route-quality-successor-v1.json",
      predecessor: {
        sha256:
          "5c61a563db6906d0446df4d14bcbc565e1b0183f6ae9dcd14b2c60f263bae179",
        sourceCommit: "330752fb53c9466f6bc0339d771b2f2facbc2351",
        remainsHistorical: true,
        rewritten: false,
      },
      provenance:
        "Hash computed from the Data-owned restored 3D Website runtime-surface successor after canonical 32-file and ten-fetch evidence synchronization; Intelligence verifies but never rewrites the quality gate or historical baseline.",
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
  const dataRuntimeSuccessor = verifyCrossIndustryZipFounderAccessAdoption()
    .transitionByPath.get(dataRuntime.path);
  assert.ok(dataRuntimeSuccessor);
  assert.equal(dataRuntimeSuccessor.previousSha256, dataRuntime.sha256);
  const actualDataRuntimeSha256 = createHash("sha256")
    .update(readFileSync(resolve(root, dataRuntime.path)))
    .digest("hex");
  assert.equal(
    actualDataRuntimeSha256,
    dataRuntimeSuccessor.currentSha256,
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
  const crossIndustryCoherenceSuccessor = JSON.parse(
    readFileSync(
      resolve(root, crossIndustryShadowReadinessCoherenceSuccessorPath),
      "utf8",
    ),
  );
  const currentProtectedSuccessors = Object.fromEntries(
    [
      ...crossIndustryCoherenceSuccessor.dashboardTransitions,
      ...crossIndustryCoherenceSuccessor.infrastructureTransitions,
      ...crossIndustryCoherenceSuccessor.dataTransitions,
      ...crossIndustryCoherenceSuccessor.intelligenceRuntimeTransitions,
    ].map((transition) => [transition.path, transition]),
  );
  const zipFounderAdoption = verifyCrossIndustryZipFounderAccessAdoption();
  for (const [name, baseline] of Object.entries(
    contract.protectedBehaviorBaselines,
  )) {
    const actual = createHash("sha256")
      .update(readFileSync(resolve(root, baseline.path)))
      .digest("hex");
    const transition = currentProtectedSuccessors[baseline.path];
    const latestTransition =
      zipFounderAdoption.transitionByPath.get(baseline.path);
    if (transition) {
      assert.equal(
        transition.previousSha256,
        baseline.sha256,
        `Protected zero-influence predecessor changed: ${name}`,
      );
      if (latestTransition) {
        assert.equal(
          latestTransition.previousSha256,
          transition.currentSha256,
          `Protected ZIP/Founder predecessor changed: ${name}`,
        );
      }
      assert.equal(
        actual,
        latestTransition?.currentSha256 || transition.currentSha256,
        `Protected zero-influence successor changed: ${name}`,
      );
    } else if (latestTransition) {
      assert.equal(
        latestTransition.previousSha256,
        baseline.sha256,
        `Protected direct successor predecessor changed: ${name}`,
      );
      assert.equal(
        actual,
        latestTransition.currentSha256,
        `Protected direct successor changed: ${name}`,
      );
    } else {
      assert.equal(
        actual,
        baseline.sha256,
        `Protected zero-influence baseline changed: ${name}`,
      );
    }
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
