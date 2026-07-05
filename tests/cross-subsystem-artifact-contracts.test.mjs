import assert from "node:assert/strict";
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

  for (const record of [...audit.subsystems, ...audit.workspaces]) {
    const requiresRemediation = record.bypassIdentified === true || /partial|bypass/.test(record.status);
    if (!requiresRemediation) continue;

    assert.ok(record.owner, `${record.subsystem || record.workspaceId} must have owner.`);
    assert.ok(record.scheduledRemediation, `${record.subsystem || record.workspaceId} must schedule remediation.`);
    assert.equal(record.remediationRequiredBeforeFutureFeatureWork, true);
  }

  assert.equal(audit.globalRemediationOrder[0].owner, "Prometheus Infrastructure");
  assert.match(audit.globalRemediationOrder[0].task, /shared workspace lead-intake/);
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
    "fitness_connection_crm_consumer_contract",
    "fitness_connection_intelligence_consumer_contract",
    "fitness_connection_dashboard_source",
    "fitness_connection_dashboard_deploy_asset"
  ]) {
    assert.ok(artifactIds.has(artifactId), `Missing Fitness canonical artifact: ${artifactId}`);
  }

  assert.equal(fitnessConnection.consumerContracts.dashboard.mustPreserveFounderRepBoundary, true);
  assert.equal(fitnessConnection.consumerContracts.dashboard.mustPreserveAnthonyRepOnlyAccess, true);
  assert.equal(fitnessConnection.consumerContracts.crm.mustPreserveFitnessOperatingProfile, true);
  assert.equal(fitnessConnection.consumerContracts.intelligence.mustNotInfluenceSmoothieDepot, true);
});
