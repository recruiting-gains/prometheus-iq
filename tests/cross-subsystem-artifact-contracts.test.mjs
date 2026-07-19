import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import test from "node:test";

import {
  validateFitnessBusinessHoursConsumerLinkage,
  validateFitnessFieldSessionLearningLinkage,
  validateFitnessShadowDecisionReadinessLinkage,
  verifyCrossSubsystemArtifactContracts
} from "../scripts/verify-cross-subsystem-artifact-contracts.mjs";

test("Cross-subsystem artifact contracts verify canonical paths and consumers", () => {
  const result = verifyCrossSubsystemArtifactContracts();

  assert.equal(result.ok, true, result.failures.join("\n"));
  assert.equal(result.registry.contractId, "prometheus-cross-subsystem-artifact-contract-v1");
  assert.equal(result.registry.owningSubsystem, "Prometheus Overwatch");
  assert.deepEqual(result.registry.governanceArtifacts, [
    {
      artifactId: "verified-engineering-batch-automatic-commit-push-governance-v1",
      artifactType: "overwatch_engineering_release_governance",
      ownerSubsystem: "Prometheus Overwatch",
      path: "overwatch/governance/verified-engineering-batch-auto-push-v1.json",
      documentationPath: "overwatch/governance/verified-engineering-batch-auto-push-v1.md",
      schema: "VerifiedEngineeringBatchAutomaticCommitPushGovernanceV1",
      writeAllowed: ["Prometheus Overwatch"],
      readAllowed: ["Prometheus Overwatch"],
      productionConsumer: false,
      failClosedIfMissing: true
    },
    {
      artifactId: "cloudflare-unattended-deployment-access-governance-v1",
      artifactType: "overwatch_infrastructure_access_release_governance",
      ownerSubsystem: "Prometheus Overwatch",
      path: "overwatch/governance/cloudflare-unattended-deployment-access-v1.json",
      documentationPath: "overwatch/governance/cloudflare-unattended-deployment-access-v1.md",
      schema: "CloudflareUnattendedDeploymentAccessGovernanceV1",
      writeAllowed: ["Prometheus Overwatch"],
      readAllowed: ["Prometheus Overwatch"],
      productionConsumer: false,
      failClosedIfMissing: true
    },
    {
      artifactId: "cloudflare-founder-attended-service-token-provisioning-governance-v1",
      artifactType: "overwatch_infrastructure_attended_credential_provisioning_governance",
      ownerSubsystem: "Prometheus Overwatch",
      path: "overwatch/governance/cloudflare-founder-attended-service-token-provisioning-v1.json",
      documentationPath: "overwatch/governance/cloudflare-founder-attended-service-token-provisioning-v1.md",
      schema: "CloudflareFounderAttendedServiceTokenProvisioningGovernanceV1",
      writeAllowed: ["Prometheus Overwatch"],
      readAllowed: ["Prometheus Infrastructure", "Prometheus Overwatch"],
      productionConsumer: false,
      failClosedIfMissing: true
    },
    {
      artifactId: "cloudflare-founder-attended-real-macos-tty-compatibility-repair-governance-v1",
      artifactType: "overwatch_infrastructure_attended_tty_compatibility_governance",
      ownerSubsystem: "Prometheus Overwatch",
      path: "overwatch/governance/cloudflare-founder-attended-real-macos-tty-compatibility-repair-v1.json",
      documentationPath: "overwatch/governance/cloudflare-founder-attended-real-macos-tty-compatibility-repair-v1.md",
      schema: "CloudflareFounderAttendedRealMacOsTtyCompatibilityRepairGovernanceV1",
      writeAllowed: ["Prometheus Overwatch"],
      readAllowed: ["Prometheus Infrastructure", "Prometheus Overwatch"],
      productionConsumer: false,
      failClosedIfMissing: true
    },
    {
      artifactId: "cloudflare-founder-attended-get-only-recovery-governance-v1",
      artifactType: "overwatch_infrastructure_attended_get_only_recovery_governance",
      ownerSubsystem: "Prometheus Overwatch",
      path: "overwatch/governance/cloudflare-founder-attended-get-only-recovery-v1.json",
      documentationPath: "overwatch/governance/cloudflare-founder-attended-get-only-recovery-v1.md",
      schema: "CloudflareFounderAttendedGetOnlyRecoveryGovernanceV1",
      writeAllowed: ["Prometheus Overwatch"],
      readAllowed: ["Prometheus Infrastructure", "Prometheus Overwatch"],
      productionConsumer: false,
      failClosedIfMissing: true
    },
    {
      artifactId: "cloudflare-founder-attended-service-token-response-contract-repair-governance-v1",
      artifactType: "overwatch_infrastructure_attended_response_contract_repair_governance",
      ownerSubsystem: "Prometheus Overwatch",
      path: "overwatch/governance/cloudflare-founder-attended-service-token-response-contract-repair-v1.json",
      documentationPath: "overwatch/governance/cloudflare-founder-attended-service-token-response-contract-repair-v1.md",
      schema: "CloudflareFounderAttendedServiceTokenResponseContractRepairGovernanceV1",
      writeAllowed: ["Prometheus Overwatch"],
      readAllowed: ["Prometheus Infrastructure", "Prometheus Overwatch"],
      productionConsumer: false,
      failClosedIfMissing: true
    },
    {
      artifactId: "cloudflare-founder-attended-live-create-receipt-safe-provisioning-repair-governance-v2",
      artifactType: "overwatch_infrastructure_attended_create_receipt_safe_provisioning_governance",
      ownerSubsystem: "Prometheus Overwatch",
      path: "overwatch/governance/cloudflare-founder-attended-live-create-receipt-safe-provisioning-repair-v2.json",
      documentationPath: "overwatch/governance/cloudflare-founder-attended-live-create-receipt-safe-provisioning-repair-v2.md",
      schema: "CloudflareFounderAttendedLiveCreateReceiptSafeProvisioningRepairGovernanceV2",
      writeAllowed: ["Prometheus Overwatch"],
      readAllowed: ["Prometheus Infrastructure", "Prometheus Overwatch"],
      productionConsumer: false,
      failClosedIfMissing: true
    },
    {
      artifactId: "cloudflare-founder-attended-successful-response-reconciliation-governance-v1",
      artifactType: "overwatch_infrastructure_attended_successful_response_reconciliation_governance",
      ownerSubsystem: "Prometheus Overwatch",
      path: "overwatch/governance/cloudflare-founder-attended-successful-response-reconciliation-v1.json",
      documentationPath: "overwatch/governance/cloudflare-founder-attended-successful-response-reconciliation-v1.md",
      schema: "CloudflareFounderAttendedSuccessfulResponseReconciliationGovernanceV1",
      writeAllowed: ["Prometheus Overwatch"],
      readAllowed: ["Prometheus Infrastructure", "Prometheus Overwatch"],
      productionConsumer: false,
      failClosedIfMissing: true
    },
    {
      artifactId: "cloudflare-founder-attended-fresh-attempt-evidence-rotation-governance-v1",
      artifactType: "overwatch_infrastructure_attended_attempt_evidence_rotation_governance",
      ownerSubsystem: "Prometheus Overwatch",
      path: "overwatch/governance/cloudflare-founder-attended-fresh-attempt-evidence-rotation-v1.json",
      documentationPath:
        "overwatch/governance/cloudflare-founder-attended-fresh-attempt-evidence-rotation-v1.md",
      schema: "CloudflareFounderAttendedFreshAttemptEvidenceRotationGovernanceV1",
      writeAllowed: ["Prometheus Overwatch"],
      readAllowed: ["Prometheus Infrastructure", "Prometheus Overwatch"],
      productionConsumer: false,
      failClosedIfMissing: true
    },
    {
      artifactId: "cloudflare-unattended-keychain-interoperability-governance-v1",
      artifactType: "overwatch_infrastructure_keychain_interoperability_governance",
      ownerSubsystem: "Prometheus Overwatch",
      path: "overwatch/governance/cloudflare-unattended-keychain-interoperability-v1.json",
      documentationPath:
        "overwatch/governance/cloudflare-unattended-keychain-interoperability-v1.md",
      schema: "CloudflareUnattendedKeychainInteroperabilityGovernanceV1",
      writeAllowed: ["Prometheus Overwatch"],
      readAllowed: ["Prometheus Infrastructure", "Prometheus Overwatch"],
      productionConsumer: false,
      failClosedIfMissing: true
    },
    {
      artifactId: "github-actions-founder-triggered-private-worker-deployment-governance-v1",
      artifactType: "overwatch_infrastructure_private_worker_deployment_release_governance",
      ownerSubsystem: "Prometheus Overwatch",
      path:
        "overwatch/governance/github-actions-founder-triggered-private-worker-deployment-v1.json",
      documentationPath:
        "overwatch/governance/github-actions-founder-triggered-private-worker-deployment-v1.md",
      schema: "GithubActionsFounderTriggeredPrivateWorkerDeploymentGovernanceV1",
      writeAllowed: ["Prometheus Overwatch"],
      readAllowed: ["Prometheus Infrastructure", "Prometheus Overwatch"],
      productionConsumer: false,
      failClosedIfMissing: true
    },
    {
      artifactId: "route-iq-commercial-readiness-governance-v1",
      artifactType: "overwatch_route_iq_commercial_release_governance",
      ownerSubsystem: "Prometheus Overwatch",
      path: "overwatch/governance/route-iq-commercial-readiness-v1.json",
      documentationPath: "overwatch/governance/route-iq-commercial-readiness-v1.md",
      schema: "RouteIqCommercialReadinessGovernanceV1",
      writeAllowed: ["Prometheus Overwatch"],
      readAllowed: [
        "Prometheus Route IQ",
        "Prometheus Dashboard",
        "Prometheus Data",
        "Prometheus Intelligence Engine",
        "Prometheus CRM",
        "Prometheus Infrastructure",
        "Prometheus Website",
        "Prometheus Overwatch"
      ],
      productionConsumer: false,
      failClosedIfMissing: true
    }
  ]);
});

test("Cross-subsystem artifact registry records current incomplete links and fixture policy", () => {
  const result = verifyCrossSubsystemArtifactContracts();
  const smoothieDepot = result.registry.workspaces.find(workspace => workspace.workspaceId === "smoothie_depot");

  assert.ok(smoothieDepot, "Smoothie Depot workspace must be registered.");
  assert.deepEqual(smoothieDepot.auditFindings.brokenLinksIdentified, []);
  assert.ok(
    smoothieDepot.auditFindings.incompleteLinksIdentified.some(item => item.includes("Cranky Carrot")),
    "Audit must preserve the missing canonical dossier finding for Cranky Carrot / LEEMOO."
  );
  assert.ok(
    smoothieDepot.auditFindings.fixtureDataLocationsIdentified.every(finding => finding.productionConsumerAllowed === false),
    "Fixture/demo locations must remain non-production only."
  );
});

test("Subsystem and workspace compliance audit gates future feature work", () => {
  const result = verifyCrossSubsystemArtifactContracts();
  const audit = result.complianceAudit;

  assert.equal(audit.auditId, "prometheus-subsystem-workspace-contract-compliance-audit-v1");
  assert.equal(audit.featureWorkGate.enabled, true);

  const subsystemNames = new Set(audit.subsystems.map(item => item.subsystem));
  for (const subsystem of [
    "Prometheus Administration",
    "Prometheus Companion",
    "Prometheus CRM",
    "Prometheus Dashboard",
    "Prometheus Data",
    "Prometheus Infrastructure",
    "Prometheus Integrations",
    "Prometheus Intelligence Engine",
    "Prometheus Mobile",
    "Prometheus Overwatch",
    "Prometheus Research",
    "Prometheus Sales",
    "Prometheus Social Media",
    "Prometheus Website"
  ]) {
    assert.ok(subsystemNames.has(subsystem), `Missing subsystem audit entry: ${subsystem}`);
  }

  const workspaces = Object.fromEntries(audit.workspaces.map(workspace => [workspace.workspaceId, workspace]));
  assert.equal(workspaces.smoothie_depot.registeredInContractLayer, true);
  assert.equal(workspaces.smoothie_depot.status, "registered_historical_inactive");
  assert.equal(workspaces.smoothie_depot.bypassIdentified, false);
  assert.equal(workspaces.smoothie_depot.historicalArtifactsPreserved, true);
  assert.equal(workspaces.smoothie_depot.normalOperationVisible, false);
  assert.equal(workspaces.fitness_connection.registeredInContractLayer, true);
  assert.equal(workspaces.fitness_connection.status, "registered_founder_research_contract_compliant");
  assert.equal(workspaces.fitness_connection.bypassIdentified, false);
  assert.equal(workspaces.fitness_connection.futureFeatureWorkRequiresContract, true);
  assert.equal(workspaces.summit_roofing_synthetic.status, "allowed_synthetic_configuration_only");
  assert.equal(workspaces.summit_roofing_synthetic.productionActivationAuthorized, false);
  assert.equal(workspaces.customer_fixture_prometheus.status, "allowed_test_fixture_only");

  const infrastructure = audit.subsystems.find(record => record.subsystem === "Prometheus Infrastructure");
  assert.equal(infrastructure.status, "compliant_for_route_iq_request_runtime");
  assert.equal(infrastructure.bypassIdentified, false);
  assert.ok(
    infrastructure.evidence.some(item => item.includes("route-iq-request-crm-runtime.js")),
    "Infrastructure audit must record the Route IQ request CRM runtime."
  );

  const data = audit.subsystems.find(record => record.subsystem === "Prometheus Data");
  assert.equal(data.status, "compliant_for_runtime_artifact_contracts");
  assert.equal(data.bypassIdentified, false);
  assert.ok(
    data.evidence.some(item => item.includes("overwatch/artifact-contracts/data/fitness-connection-runtime-artifact-contract-v1.json")),
    "Data audit must record the Fitness runtime artifact contract."
  );

  for (const record of [...audit.subsystems, ...audit.workspaces]) {
    const requiresRemediation = record.bypassIdentified === true || /partial|bypass/.test(record.status);
    if (!requiresRemediation) continue;

    assert.ok(record.owner, `${record.subsystem || record.workspaceId} must have owner.`);
    assert.ok(record.scheduledRemediation, `${record.subsystem || record.workspaceId} must schedule remediation.`);
    assert.equal(record.remediationRequiredBeforeFutureFeatureWork, true);
  }

  const socialMedia = audit.subsystems.find(record => record.subsystem === "Prometheus Social Media");
  assert.equal(socialMedia.status, "compliant_for_social_media_artifact_contracts");
  assert.equal(socialMedia.bypassIdentified, false);
  assert.ok(
    socialMedia.evidence.some(item => item.includes("overwatch/artifact-contracts/social-media/smoothie-depot-social-media-artifact-contract-v1.json")),
    "Social Media audit must record the Smoothie Depot Social Media artifact contract."
  );
  assert.ok(
    socialMedia.evidence.some(item => item.includes("overwatch/artifact-contracts/social-media/fitness-connection-social-media-artifact-contract-v1.json")),
    "Social Media audit must record the Fitness Connection Social Media artifact contract."
  );

  const companion = audit.subsystems.find(record => record.subsystem === "Prometheus Companion");
  assert.equal(companion.status, "quarantined_dormant_maintenance_only");
  assert.equal(companion.founderReactivationRequired, true);
  assert.equal(companion.bypassIdentified, false);

  const administration = audit.subsystems.find(record => record.subsystem === "Prometheus Administration");
  assert.equal(administration.status, "compliant_for_operating_artifact_contracts");
  assert.equal(administration.bypassIdentified, false);
  assert.ok(
    administration.evidence.some(item => item.includes("overwatch/artifact-contracts/administration/administration-operating-artifact-contract-v1.json")),
    "Administration audit must record the operating artifact contract."
  );

  assert.equal(audit.globalRemediationOrder[0].owner, "Prometheus Sales");
  assert.match(audit.globalRemediationOrder[0].task, /Sales consumer contract/);
});

test("Fitness Connection workspace is registered with role and isolation contracts", () => {
  const result = verifyCrossSubsystemArtifactContracts();
  const fitnessConnection = result.registry.workspaces.find(workspace => workspace.workspaceId === "fitness_connection");

  assert.ok(fitnessConnection, "Fitness Connection workspace must be registered.");
  assert.equal(fitnessConnection.operatingProfileId, "fitness");
  assert.deepEqual(fitnessConnection.protectedWorkspaceIds, ["smoothie_depot"]);
  assert.equal(fitnessConnection.workspaceIsolationRules.smoothieDepotCandidateDataUsed, false);
  assert.equal(fitnessConnection.workspaceIsolationRules.missingArtifactFailsClosed, true);

  const artifactIds = new Set(fitnessConnection.canonicalArtifacts.map(artifact => artifact.artifactId));
  for (const artifactId of [
    "fitness_connection_workspace_identity_contract",
    "fitness_connection_dashboard_consumer_contract",
    "fitness_connection_route_intelligence_data_contract",
    "fitness_connection_data_runtime_artifact_contract",
    "fitness_connection_business_hours_data_contract",
    "fitness_connection_route_business_hours_intelligence_consumer_contract",
    "fitness_connection_read_only_field_session_learning_consumer_contract",
    "fitness_connection_read_only_field_session_learning_policy",
    "fitness_connection_read_only_field_session_learning_snapshot",
    "fitness_connection_shadow_decision_readiness_contract",
    "fitness_connection_release_provenance_repair_mapping",
    "fitness_connection_crm_consumer_contract",
    "fitness_connection_intelligence_consumer_contract",
    "fitness_connection_dashboard_source",
    "fitness_connection_dashboard_deploy_asset",
    "fitness_connection_shared_lead_intake_contract",
    "fitness_connection_social_media_artifact_contract"
  ]) {
    assert.ok(artifactIds.has(artifactId), `Missing Fitness canonical artifact: ${artifactId}`);
  }

  assert.equal(fitnessConnection.consumerContracts.dashboard.mustPreserveFounderRepBoundary, true);
  assert.equal(fitnessConnection.consumerContracts.dashboard.mustPreserveAnthonyRepOnlyAccess, true);
  assert.equal(fitnessConnection.consumerContracts.crm.mustPreserveFitnessOperatingProfile, true);
  assert.equal(fitnessConnection.consumerContracts.intelligence.mustNotInfluenceSmoothieDepot, true);
  assert.equal(fitnessConnection.consumerContracts.mobile.mayConsumeOnlyRoleWorkspaceScopedLeadArtifacts, true);
  assert.equal(fitnessConnection.consumerContracts.mobile.mustNotUseSmoothieDepotData, true);
});

test("Data runtime artifact contract registers canonical paths and consumer boundaries", () => {
  const result = verifyCrossSubsystemArtifactContracts();
  const fitnessConnection = result.registry.workspaces.find(workspace => workspace.workspaceId === "fitness_connection");
  const dataArtifact = fitnessConnection.canonicalArtifacts.find(artifact => artifact.artifactId === "fitness_connection_data_runtime_artifact_contract");

  assert.equal(dataArtifact.ownerSubsystem, "Prometheus Data");
  assert.equal(dataArtifact.path, "overwatch/artifact-contracts/data/fitness-connection-runtime-artifact-contract-v1.json");
  assert.ok(dataArtifact.readAllowed.includes("Prometheus Dashboard"));
  assert.ok(dataArtifact.readAllowed.includes("Prometheus CRM"));
  assert.ok(dataArtifact.readAllowed.includes("Prometheus Intelligence Engine"));
  assert.ok(dataArtifact.readAllowed.includes("Prometheus Mobile"));

  const contract = JSON.parse(fs.readFileSync(dataArtifact.path, "utf8"));

  assert.equal(contract.expectedRuntimeMetrics.activePoolRecords, 297);
  assert.equal(contract.expectedRuntimeMetrics.reservePoolRecords, 44);
  assert.equal(contract.expectedRuntimeMetrics.quarantinePoolRecords, 109);
  assert.equal(contract.expectedRuntimeMetrics.expandedDashboardRouteRecords, 594);
  assert.equal(contract.canonicalRuntimeArtifacts.activePool, "data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/active-pool.json");
  assert.equal(contract.canonicalRuntimeArtifacts.runtimePools, "data/qualified-prospects/google-qualified-businesses-v2/runtime-pools.json");
  assert.equal(contract.canonicalRouteQualityArtifacts.routeQualityReport, "data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/route-intelligence-golden-route-quality-report.json");
  assert.equal(contract.canonicalGovernanceOverrideArtifacts.runtimeGovernanceOverrides, "data/qualified-prospects/google-qualified-businesses-v2/runtime-governance-overrides.json");
  assert.equal(contract.canonicalBusinessHoursArtifacts.businessHoursDataContract, "overwatch/artifact-contracts/data/fitness-connection-business-hours-data-contract-v1.json");
  assert.equal(contract.canonicalBusinessHoursArtifacts.businessHoursArtifact, "data/qualified-prospects/google-qualified-businesses-v2/business-hours-v1/business-hours.json");
  assert.equal(contract.expectedBusinessHoursMetrics.recordCount, 398);
  assert.equal(contract.expectedBusinessHoursMetrics.routeEligibilityActivated, true);
  assert.equal(contract.consumerRules.dashboard.mayReadOnlyApprovedDataArtifacts, true);
  assert.equal(contract.consumerRules.crm.mayConsumeAssignedLeadArtifactsOnlyThroughContract, true);
  assert.equal(contract.consumerRules.intelligence.mayInterpretOnlyThroughApprovedReadPaths, true);
  assert.equal(contract.consumerRules.mobile.mayConsumeOnlyRoleWorkspaceScopedLeadArtifacts, true);
  assert.equal(contract.workspaceIsolationRules.smoothieDepotMayConsumeFitnessActivePoolData, false);
  assert.equal(contract.workspaceIsolationRules.fitnessConnectionMayConsumeSmoothieDepotFranchiseCandidateData, false);
  assert.equal(contract.workspaceIsolationRules.fixtureDataAllowedInProduction, false);
});

test("Data business-hours contract authorizes only the verified Fitness Intelligence consumer", () => {
  const result = verifyCrossSubsystemArtifactContracts();
  const fitnessConnection = result.registry.workspaces.find(workspace => workspace.workspaceId === "fitness_connection");
  const artifactRegistration = fitnessConnection.canonicalArtifacts.find(artifact => artifact.artifactId === "fitness_connection_business_hours_data_contract");
  const contract = JSON.parse(fs.readFileSync(artifactRegistration.path, "utf8"));
  const hours = JSON.parse(fs.readFileSync(contract.canonicalArtifacts.businessHoursArtifact, "utf8"));
  const hoursSource = fs.readFileSync(contract.canonicalArtifacts.businessHoursArtifact, "utf8");
  const consumer = JSON.parse(fs.readFileSync(contract.authorizationMetadata.authorizedConsumerContractPath, "utf8"));
  const datasetSha256 = createHash("sha256").update(hoursSource).digest("hex");

  assert.equal(artifactRegistration.ownerSubsystem, "Prometheus Data");
  assert.equal(artifactRegistration.productionConsumer, true);
  assert.equal(artifactRegistration.requiresIndependentOverwatchVerification, true);
  assert.equal(artifactRegistration.authorizedConsumerSubsystem, "Prometheus Intelligence Engine");
  assert.equal(artifactRegistration.authorizedConsumerContractId, "route-iq-closed-now-eligibility-contracts-v1");
  assert.equal(contract.status, "active_authorized");
  assert.equal(contract.inventionGovernance.classification, "operational_improvement");
  assert.equal(contract.inventionGovernance.patentabilityClaimMade, false);
  assert.equal(contract.authorizationMetadata.authorizationStatus, "AUTHORIZED_ACTIVE");
  assert.equal(contract.authorizationMetadata.routeEligibilityActivationStatus, "ACTIVE");
  assert.equal(contract.authorizationMetadata.authorizedWorkspaceId, "fitness_connection");
  assert.equal(contract.authorizationMetadata.authorizedOperatingProfileId, "fitness");
  assert.equal(contract.authorizationMetadata.authorizedConsumerSubsystem, "Prometheus Intelligence Engine");
  assert.equal(contract.authorizationMetadata.authorizedConsumerContractId, "route-iq-closed-now-eligibility-contracts-v1");
  assert.equal(contract.authorizationMetadata.activationCommitReference, "be7a04c8df84a68d20868ce53183965495a4fc7d");
  assert.equal(contract.authorizationMetadata.authorizedDatasetSha256, datasetSha256);
  assert.deepEqual(contract.authorizationMetadata.authorizedConsumptionScopes, [
    "initial_route_generation",
    "continuous_adaptive_replenishment",
    "recommendation_explainability"
  ]);
  assert.equal(contract.authorizationMetadata.failClosedBehavior.unknownConsumerFailsClosed, true);
  assert.equal(contract.authorizationMetadata.failClosedBehavior.unknownWorkspaceFailsClosed, true);
  assert.equal(contract.authorizationMetadata.failClosedBehavior.crossWorkspaceUseFailsClosed, true);
  assert.equal(contract.authorizationMetadata.failClosedBehavior.consumerContractMismatchFailsClosed, true);
  assert.equal(contract.enrichmentPolicy.liveGoogleCallsAllowedInRepresentativeRuntime, false);
  assert.equal(contract.persistenceAndFailurePolicy.unknownWorkspaceFailsClosed, true);
  assert.equal(contract.intelligenceHandoffPolicy.intelligenceConsumptionAuthorized, true);
  assert.equal(contract.intelligenceHandoffPolicy.routeEligibilityActivated, true);
  assert.equal(contract.intelligenceHandoffPolicy.initialRouteGenerationConsumptionAuthorized, true);
  assert.equal(contract.intelligenceHandoffPolicy.continuousAdaptiveReplenishmentConsumptionAuthorized, true);
  assert.equal(contract.intelligenceHandoffPolicy.explainabilityConsumptionAuthorized, true);
  assert.equal(contract.intelligenceHandoffPolicy.intelligenceOwnsFinalEligibilityAndRanking, true);
  assert.equal(contract.intelligenceHandoffPolicy.dataOwnsGovernedHoursStatus, true);
  assert.equal(contract.intelligenceHandoffPolicy.intelligenceMayMutateDataArtifact, false);
  assert.equal(consumer.version, contract.authorizationMetadata.authorizedConsumerContractId);
  assert.equal(consumer.workspaceId, "fitness_connection");
  assert.equal(consumer.operatingProfileId, "fitness");
  assert.equal(consumer.dataContract.dataOwnsStatusAndProvenance, true);
  assert.equal(consumer.dataContract.intelligenceOwnsEligibility, true);
  assert.equal(consumer.dataContract.sourceRecordsModified, false);
  assert.equal(consumer.safety.liveGoogleCalls, false);
  assert.equal(consumer.safety.scoringWeightsChanged, false);
  assert.equal(consumer.safety.workspaceIsolation, "fail_closed");
  assert.equal(hours.recordCount, 398);
  assert.equal(hours.routeEligibilityActivated, false);
  assert.equal(hours.runtimeBehaviorChanged, false);
  assert.equal(hours.scoringChanged, false);
});

test("Fitness business-hours canonical linkage fails closed for every unauthorized edge", () => {
  const result = verifyCrossSubsystemArtifactContracts();
  const workspace = result.registry.workspaces.find(candidate => candidate.workspaceId === "fitness_connection");
  const registrations = Object.fromEntries(workspace.canonicalArtifacts.map(artifact => [artifact.artifactId, artifact]));
  const intelligenceContract = JSON.parse(fs.readFileSync(registrations.fitness_connection_intelligence_consumer_contract.path, "utf8"));
  const dataContract = JSON.parse(fs.readFileSync(registrations.fitness_connection_business_hours_data_contract.path, "utf8"));
  const consumerContract = JSON.parse(fs.readFileSync(registrations.fitness_connection_route_business_hours_intelligence_consumer_contract.path, "utf8"));
  const clone = value => JSON.parse(JSON.stringify(value));
  const fixture = () => ({
    workspace: clone(workspace),
    intelligenceContract: clone(intelligenceContract),
    dataContract: clone(dataContract),
    consumerContract: clone(consumerContract),
    dataContractRegistration: clone(registrations.fitness_connection_business_hours_data_contract),
    consumerRegistration: clone(registrations.fitness_connection_route_business_hours_intelligence_consumer_contract)
  });

  assert.deepEqual(validateFitnessBusinessHoursConsumerLinkage(fixture()), []);

  const cases = [
    {
      label: "unregistered consumer",
      mutate: input => { input.consumerRegistration = null; },
      expected: /must be registered canonically/
    },
    {
      label: "unresolved canonical identifier",
      mutate: input => { input.consumerRegistration.canonicalIdentifier = "unknown-consumer"; },
      expected: /canonical identifier mismatch/
    },
    {
      label: "missing required read path",
      mutate: input => {
        input.workspace.consumerContracts.intelligence.allowedReadPaths = input.workspace.consumerContracts.intelligence.allowedReadPaths
          .filter(path => !path.endsWith("business-hours.json"));
      },
      expected: /read path missing/
    },
    {
      label: "declared path mismatch",
      mutate: input => { input.consumerRegistration.path = "intelligence/contracts/non-canonical-hours-contract.json"; },
      expected: /canonical path mismatch/
    },
    {
      label: "unlinked Data contract",
      mutate: input => { input.consumerContract.dataContract.contractId = "unlinked-data-contract"; },
      expected: /not linked/
    },
    {
      label: "unauthorized workspace",
      mutate: input => { input.consumerContract.workspaceId = "smoothie_depot"; },
      expected: /workspace is unauthorized/
    },
    {
      label: "unauthorized consumer",
      mutate: input => { input.consumerRegistration.readAllowed.push("Prometheus Dashboard"); },
      expected: /unknown consumer/
    },
    {
      label: "Intelligence Data mutation",
      mutate: input => { input.intelligenceContract.businessHoursAccessRules.dataMutationAllowed = true; },
      expected: /must not mutate/
    }
  ];

  for (const scenario of cases) {
    const input = fixture();
    scenario.mutate(input);
    const failures = validateFitnessBusinessHoursConsumerLinkage(input);
    assert.ok(failures.some(failure => scenario.expected.test(failure)), `${scenario.label}: ${failures.join(" | ")}`);
  }
});

test("Fitness read-only field-session learning linkage enforces independent authorization and immutable Data access", () => {
  const result = verifyCrossSubsystemArtifactContracts();
  const workspace = result.registry.workspaces.find(candidate => candidate.workspaceId === "fitness_connection");
  const registrations = Object.fromEntries(workspace.canonicalArtifacts.map(artifact => [artifact.artifactId, artifact]));
  const intelligenceContract = JSON.parse(fs.readFileSync(registrations.fitness_connection_intelligence_consumer_contract.path, "utf8"));
  const dataContract = JSON.parse(fs.readFileSync(registrations.fitness_connection_data_runtime_artifact_contract.path, "utf8"));
  const consumerContract = JSON.parse(fs.readFileSync(registrations.fitness_connection_read_only_field_session_learning_consumer_contract.path, "utf8"));
  const policy = JSON.parse(fs.readFileSync(registrations.fitness_connection_read_only_field_session_learning_policy.path, "utf8"));
  const snapshot = JSON.parse(fs.readFileSync(registrations.fitness_connection_read_only_field_session_learning_snapshot.path, "utf8"));
  const clone = value => JSON.parse(JSON.stringify(value));
  const fixture = () => ({
    workspace: clone(workspace),
    intelligenceContract: clone(intelligenceContract),
    dataContract: clone(dataContract),
    consumerContract: clone(consumerContract),
    policy: clone(policy),
    snapshot: clone(snapshot),
    consumerRegistration: clone(registrations.fitness_connection_read_only_field_session_learning_consumer_contract),
    policyRegistration: clone(registrations.fitness_connection_read_only_field_session_learning_policy),
    snapshotRegistration: clone(registrations.fitness_connection_read_only_field_session_learning_snapshot)
  });

  assert.deepEqual(validateFitnessFieldSessionLearningLinkage(fixture()), []);

  const cases = [
    {
      label: "unregistered consumer",
      mutate: input => { input.consumerRegistration = null; },
      expected: /must be registered canonically/
    },
    {
      label: "unresolved identifier",
      mutate: input => { input.consumerRegistration.canonicalIdentifier = "unknown-field-session-consumer"; },
      expected: /consumer identifier mismatch/
    },
    {
      label: "missing approved read path",
      mutate: input => {
        input.workspace.consumerContracts.intelligence.allowedReadPaths = input.workspace.consumerContracts.intelligence.allowedReadPaths
          .filter(path => !path.endsWith("normalized/history-updates.json"));
      },
      expected: /read path missing/
    },
    {
      label: "raw archive access",
      mutate: input => {
        input.workspace.consumerContracts.intelligence.allowedReadPaths.push(input.consumerContract.prohibitedSourceArtifacts.rawFieldSession);
      },
      expected: /must not receive raw field-session read access/
    },
    {
      label: "archive mutation",
      mutate: input => { input.intelligenceContract.fieldSessionLearningAccessRules.archiveMutationAllowed = true; },
      expected: /must remain false: archiveMutationAllowed/
    },
    {
      label: "historical replay",
      mutate: input => { input.intelligenceContract.fieldSessionLearningAccessRules.historicalReplayAllowed = true; },
      expected: /must remain false: historicalReplayAllowed/
    },
    {
      label: "protected workspace",
      mutate: input => { input.consumerContract.workspaceId = "smoothie_depot"; },
      expected: /workspace is unauthorized/
    },
    {
      label: "recommendation influence",
      mutate: input => { input.snapshot.recommendationSafety.recommendationBehaviorChanged = true; },
      expected: /must not change recommendation behavior/
    },
    {
      label: "administrative exclusion bypass",
      mutate: input => { input.consumerContract.administrativeDispositionAdmission.disposedSessionAdmissionAllowed = true; },
      expected: /must exclude administratively disposed sessions/
    },
    {
      label: "blanket zero-visit exclusion",
      mutate: input => { input.consumerContract.administrativeDispositionAdmission.automaticZeroVisitExclusionAllowed = true; },
      expected: /must not blanket-exclude zero-visit sessions/
    }
  ];

  for (const scenario of cases) {
    const input = fixture();
    scenario.mutate(input);
    const failures = validateFitnessFieldSessionLearningLinkage(input);
    assert.ok(failures.some(failure => scenario.expected.test(failure)), `${scenario.label}: ${failures.join(" | ")}`);
  }
});

test("Fitness shadow decision readiness remains Founder-only, complete, and zero-influence", () => {
  const result = verifyCrossSubsystemArtifactContracts();
  const workspace = result.registry.workspaces.find(candidate => candidate.workspaceId === "fitness_connection");
  const registrations = Object.fromEntries(workspace.canonicalArtifacts.map(artifact => [artifact.artifactId, artifact]));
  const intelligenceContract = JSON.parse(fs.readFileSync(registrations.fitness_connection_intelligence_consumer_contract.path, "utf8"));
  const dataContract = JSON.parse(fs.readFileSync(registrations.fitness_connection_data_runtime_artifact_contract.path, "utf8"));
  const readinessContract = JSON.parse(fs.readFileSync(registrations.fitness_connection_shadow_decision_readiness_contract.path, "utf8"));
  const config = JSON.parse(fs.readFileSync(readinessContract.artifacts.config, "utf8"));
  const ledger = JSON.parse(fs.readFileSync(readinessContract.artifacts.ledger, "utf8"));
  const report = JSON.parse(fs.readFileSync(readinessContract.artifacts.report, "utf8"));
  const clone = value => JSON.parse(JSON.stringify(value));
  const fixture = () => ({
    workspace: clone(workspace),
    intelligenceContract: clone(intelligenceContract),
    dataContract: clone(dataContract),
    readinessContract: clone(readinessContract),
    config: clone(config),
    ledger: clone(ledger),
    report: clone(report),
    registration: clone(registrations.fitness_connection_shadow_decision_readiness_contract)
  });

  assert.deepEqual(validateFitnessShadowDecisionReadinessLinkage(fixture()), []);

  const cases = [
    {
      label: "representative-facing consumer",
      mutate: input => { input.registration.readAllowed.push("Prometheus Dashboard"); },
      expected: /representative-facing or unknown consumer/
    },
    {
      label: "recommendation influence",
      mutate: input => { input.intelligenceContract.shadowDecisionReadinessAccessRules.recommendationInfluence = "ON"; },
      expected: /influence must remain OFF/
    },
    {
      label: "operational workflow path",
      mutate: input => { input.intelligenceContract.shadowDecisionReadinessAccessRules.operationalWorkflowConsumptionAllowed = true; },
      expected: /must remain false: operationalWorkflowConsumptionAllowed/
    },
    {
      label: "missing protected baseline",
      mutate: input => { delete input.readinessContract.protectedBehaviorBaselines.worker; },
      expected: /missing or undeclared keys/
    },
    {
      label: "incomplete opportunity disposition",
      mutate: input => { input.ledger.exclusions.pop(); },
      expected: /exactly one shadow or exclusion/
    },
    {
      label: "fixture promoted to canonical artifact",
      mutate: input => {
        input.workspace.canonicalArtifacts.push({
          artifactId: "invalid_shadow_fixture",
          path: input.readinessContract.validationFixturePolicy.path
        });
      },
      expected: /must never be a canonical artifact/
    },
    {
      label: "Founder eligibility activates recommendations",
      mutate: input => { input.report.eligibilityDoesNotAuthorizeActivation = false; },
      expected: /must not authorize activation/
    },
    {
      label: "disposed session admitted to readiness",
      mutate: input => { input.readinessContract.administrativeDispositionAdmission.disposedSessionReadinessAdmissionAllowed = true; },
      expected: /must remain false: disposedSessionReadinessAdmissionAllowed/
    }
  ];

  for (const scenario of cases) {
    const input = fixture();
    scenario.mutate(input);
    const failures = validateFitnessShadowDecisionReadinessLinkage(input);
    assert.ok(failures.some(failure => scenario.expected.test(failure)), `${scenario.label}: ${failures.join(" | ")}`);
  }
});

test("Social Media artifact contracts register analytics, attribution, and consumer boundaries", () => {
  const result = verifyCrossSubsystemArtifactContracts();

  for (const [workspaceId, expectedPath] of [
    ["smoothie_depot", "overwatch/artifact-contracts/social-media/smoothie-depot-social-media-artifact-contract-v1.json"],
    ["fitness_connection", "overwatch/artifact-contracts/social-media/fitness-connection-social-media-artifact-contract-v1.json"]
  ]) {
    const workspace = result.registry.workspaces.find(candidate => candidate.workspaceId === workspaceId);
    const artifact = workspace.canonicalArtifacts.find(candidate => candidate.artifactId === `${workspaceId}_social_media_artifact_contract`);
    const contract = JSON.parse(fs.readFileSync(expectedPath, "utf8"));

    assert.equal(artifact.ownerSubsystem, "Prometheus Social Media");
    assert.equal(artifact.path, expectedPath);
    assert.equal(artifact.schema, "SocialMediaAnalyticsAttributionArtifactContractV1");
    assert.ok(artifact.readAllowed.includes("Prometheus Website"));
    assert.ok(artifact.readAllowed.includes("Prometheus CRM"));
    assert.ok(artifact.readAllowed.includes("Prometheus Dashboard"));
    assert.ok(artifact.readAllowed.includes("Prometheus Research"));

    assert.equal(contract.canonicalRouteArtifacts.socialAccountSnapshot.path, "/api/social/instagram/snapshot");
    assert.equal(contract.canonicalRouteArtifacts.instagramReport.path, "/api/social/instagram/report");
    assert.equal(contract.canonicalSocialMediaPaths.instagramReportingView, "social-media/reporting/founder-instagram-analytics-reporting-view.js");
    assert.equal(contract.canonicalCampaignArtifactPaths.founderMarketingOperatingSystem, "social-media/founder-marketing-operating-system/founder-marketing-operating-system.v1.json");
    assert.equal(contract.canonicalContentCalendarArtifactPaths.contentCalendar, "social-media/founder-marketing-operating-system/content-calendar.md");
    assert.equal(contract.canonicalWebsiteAttributionPaths.websiteReferralUtmContract, "deploy/prometheusrouteiq-website/website-attribution.js");
    assert.equal(contract.canonicalCrmAttributionHandoffPaths.crmFoundation, "crm/crm-foundation.mjs");

    assert.equal(contract.consumerRules.website.mayConsumeAttributionMetadataOnlyThroughContract, true);
    assert.equal(contract.consumerRules.crm.mayConsumeLeadSourceAttributionOnlyThroughContract, true);
    assert.equal(contract.consumerRules.dashboard.mayDisplayAnalyticsOnlyFromCanonicalReports, true);
    assert.equal(contract.consumerRules.research.mayCiteCanonicalReportsOnly, true);
    assert.equal(contract.consumerRules.overwatch.mustVerifyWorkspaceIsolation, true);

    assert.equal(contract.workspaceIsolationRules.crossWorkspaceAttributionAllowed, false);
    assert.equal(contract.workspaceIsolationRules.missingArtifactFailsClosed, true);
    assert.equal(contract.productionRules.noFakeSocialMetricsInProduction, true);
    assert.equal(contract.productionRules.sampleAnalyticsFixtureProductionConsumer, false);
    assert.equal(contract.productionRules.unsupportedScrapingAllowed, false);
    assert.equal(contract.productionRules.tokensMayBeReturnedToConsumers, false);
    assert.ok(contract.leadSourceProvenanceMetadata.requiredFields.includes("workspace_id"));
    assert.ok(contract.leadSourceProvenanceMetadata.requiredFields.includes("source_report_version"));
  }
});

test("Administration operating artifact contract registers manuals, feedback, and consumer boundaries", () => {
  const result = verifyCrossSubsystemArtifactContracts();
  const smoothieDepot = result.registry.workspaces.find(workspace => workspace.workspaceId === "smoothie_depot");
  const artifact = smoothieDepot.canonicalArtifacts.find(candidate => (
    candidate.artifactId === "smoothie_depot_administration_operating_artifact_contract"
  ));
  const contract = JSON.parse(fs.readFileSync("overwatch/artifact-contracts/administration/administration-operating-artifact-contract-v1.json", "utf8"));

  assert.equal(artifact.ownerSubsystem, "Prometheus Administration");
  assert.equal(artifact.schema, "AdministrationOperatingArtifactContractV1");
  assert.equal(artifact.path, "overwatch/artifact-contracts/administration/administration-operating-artifact-contract-v1.json");
  assert.ok(artifact.readAllowed.includes("Prometheus Dashboard"));
  assert.ok(artifact.readAllowed.includes("Prometheus CRM"));
  assert.ok(artifact.readAllowed.includes("Prometheus Intelligence Engine"));

  assert.equal(contract.artifactContracts.founderOperatingManuals.canonicalPaths.smoothieDepotFounderOperatingManual, "administration/workspaces/smoothie-depot/founder-operating-manual-v1.md");
  assert.equal(contract.artifactContracts.dailyChecklists.canonicalPaths.smoothieDepotDailyOperatingChecklists, "administration/workspaces/smoothie-depot/daily-operating-checklists-v1.md");
  assert.equal(contract.artifactContracts.releaseSignOffRegisters.canonicalPaths.releaseHistory, "administration/registers/release-history.json");
  assert.equal(contract.artifactContracts.fieldFeedbackArtifacts.canonicalPaths.stabilizationIssues, "administration/registers/stabilization-issues.json");
  assert.equal(contract.artifactContracts.postCallAarDecisionJournalHandoffs.missingWorkspaceInstanceBehavior, "fail_closed");

  assert.equal(contract.consumerRules.dashboard.mayDisplayOperatingManualsReadOnly, true);
  assert.equal(contract.consumerRules.dashboard.mayWriteAdministrationArtifacts, false);
  assert.equal(contract.consumerRules.crm.mayConsumeFieldFeedbackOnlyThroughContract, true);
  assert.equal(contract.consumerRules.crm.mayConsumeOperatingManualsDirectly, false);
  assert.equal(contract.consumerRules.intelligence.mayConsumeDecisionJournalAarOnlyThroughContract, true);
  assert.equal(contract.consumerRules.intelligence.mustRejectCrossWorkspaceDecisionJournal, true);
  assert.equal(contract.workspaceIsolationRules.noWorkspaceMayConsumeAnotherWorkspaceOperatingRecords, true);
  assert.equal(contract.workspaceIsolationRules.fixtureDataAllowedInProduction, false);
  assert.equal(contract.productionRules.fixtureDemoOperationsDataProhibitedInProduction, true);
});
