import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { verifyCrossSubsystemArtifactContracts } from "../scripts/verify-cross-subsystem-artifact-contracts.mjs";

test("Cross-subsystem artifact contracts verify canonical paths and consumers", () => {
  const result = verifyCrossSubsystemArtifactContracts();

  assert.equal(result.ok, true, result.failures.join("\n"));
  assert.equal(result.registry.contractId, "prometheus-cross-subsystem-artifact-contract-v1");
  assert.equal(result.registry.owningSubsystem, "Prometheus Overwatch");
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
  assert.equal(workspaces.smoothie_depot.bypassIdentified, true);
  assert.equal(workspaces.fitness_connection.registeredInContractLayer, true);
  assert.equal(workspaces.fitness_connection.bypassIdentified, false);
  assert.equal(workspaces.fitness_connection.futureFeatureWorkRequiresContract, true);
  assert.equal(workspaces.customer_fixture_prometheus.status, "allowed_test_fixture_only");

  const infrastructure = audit.subsystems.find(record => record.subsystem === "Prometheus Infrastructure");
  assert.equal(infrastructure.status, "compliant_for_shared_lead_intake_contracts");
  assert.equal(infrastructure.bypassIdentified, false);
  assert.ok(
    infrastructure.evidence.some(item => item.includes("integrations/shared-workspace-lead-intake-contract.js")),
    "Infrastructure audit must record the shared lead-intake contract."
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

  assert.equal(audit.globalRemediationOrder[0].owner, "Prometheus Companion");
  assert.match(audit.globalRemediationOrder[0].task, /Companion/);
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
  assert.equal(contract.consumerRules.dashboard.mayReadOnlyApprovedDataArtifacts, true);
  assert.equal(contract.consumerRules.crm.mayConsumeAssignedLeadArtifactsOnlyThroughContract, true);
  assert.equal(contract.consumerRules.intelligence.mayInterpretOnlyThroughApprovedReadPaths, true);
  assert.equal(contract.consumerRules.mobile.mayConsumeOnlyRoleWorkspaceScopedLeadArtifacts, true);
  assert.equal(contract.workspaceIsolationRules.smoothieDepotMayConsumeFitnessActivePoolData, false);
  assert.equal(contract.workspaceIsolationRules.fitnessConnectionMayConsumeSmoothieDepotFranchiseCandidateData, false);
  assert.equal(contract.workspaceIsolationRules.fixtureDataAllowedInProduction, false);
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
