import fs from "node:fs";
import { createHash } from "node:crypto";
import {
  SHARED_WORKSPACE_LEAD_INTAKE_COMPONENTS,
  SHARED_WORKSPACE_LEAD_INTAKE_CONTRACT,
  getSharedLeadIntakeWorkspaceContract
} from "../integrations/shared-workspace-lead-intake-contract.js";

const registryPath = "overwatch/artifact-contracts/canonical-artifact-registry.json";
const complianceAuditPath = "overwatch/artifact-contracts/subsystem-workspace-compliance-audit-v1.json";

const read = path => fs.readFileSync(path, "utf8");
const readJson = path => JSON.parse(read(path));
const exists = path => fs.existsSync(path);
const sha256 = value => createHash("sha256").update(value).digest("hex");

const htmlEscape = value => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

const unique = values => [...new Set(values)];

function assert(condition, message, failures) {
  if (!condition) failures.push(message);
}

function validateJsonWorkspaceArtifact(artifact, workspace, failures) {
  const payload = readJson(artifact.path);
  const workspaceId = payload.workspaceId || payload.workspace_id;
  const operatingProfileId = payload.operatingProfileId || payload.operating_profile_id;

  assert(
    workspaceId === artifact.requiredWorkspaceId,
    `${artifact.artifactId} must use workspace ${artifact.requiredWorkspaceId}.`,
    failures
  );
  assert(
    operatingProfileId === artifact.requiredOperatingProfileId,
    `${artifact.artifactId} must use operating profile ${artifact.requiredOperatingProfileId}.`,
    failures
  );

  if (payload.workspaceIsolation) {
    const isolation = payload.workspaceIsolation;
    for (const [key, expected] of Object.entries(workspace.workspaceIsolationRules)) {
      if (key in isolation) {
        assert(
          isolation[key] === expected,
          `${artifact.artifactId} workspace isolation field ${key} must be ${expected}.`,
          failures
        );
      }
    }
  }

  return payload;
}

function validateRegistryShape(registry, failures) {
  assert(registry.contractId === "prometheus-cross-subsystem-artifact-contract-v1", "Registry contractId drifted.", failures);
  assert(registry.status === "active", "Registry must remain active.", failures);
  assert(registry.owningSubsystem === "Prometheus Overwatch", "Registry must be Overwatch-owned.", failures);

  for (const [rule, value] of Object.entries(registry.globalRules || {})) {
    assert(value === true, `Global artifact contract rule ${rule} must remain true.`, failures);
  }

  assert(Array.isArray(registry.workspaces) && registry.workspaces.length > 0, "Registry must define at least one workspace.", failures);
}

function validateCanonicalArtifacts(registry, failures) {
  for (const workspace of registry.workspaces) {
    assert(workspace.workspaceId, "Workspace missing workspaceId.", failures);
    assert(workspace.operatingProfileId, `Workspace ${workspace.workspaceId} missing operatingProfileId.`, failures);
    assert(Array.isArray(workspace.canonicalArtifacts), `Workspace ${workspace.workspaceId} missing canonicalArtifacts.`, failures);

    for (const artifact of workspace.canonicalArtifacts || []) {
      assert(artifact.artifactId, "Canonical artifact missing artifactId.", failures);
      assert(artifact.ownerSubsystem, `${artifact.artifactId} missing ownerSubsystem.`, failures);
      assert(artifact.path, `${artifact.artifactId} missing path.`, failures);
      assert(exists(artifact.path), `${artifact.artifactId} path does not exist: ${artifact.path}`, failures);
      assert(
        Array.isArray(artifact.writeAllowed) && artifact.writeAllowed.length === 1 && artifact.writeAllowed[0] === artifact.ownerSubsystem,
        `${artifact.artifactId} must allow writes only by owner subsystem.`,
        failures
      );
      assert(
        !artifact.readAllowed?.includes(artifact.ownerSubsystem) || artifact.writeAllowed.includes(artifact.ownerSubsystem),
        `${artifact.artifactId} owner read/write relationship is inconsistent.`,
        failures
      );
      assert(artifact.failClosedIfMissing === true, `${artifact.artifactId} must fail closed if missing.`, failures);

      if (artifact.path.endsWith(".json") && exists(artifact.path)) {
        validateJsonWorkspaceArtifact(artifact, workspace, failures);
      }
    }
  }
}

function validateSmoothieDepotDossierContract(workspace, failures) {
  const artifacts = Object.fromEntries(workspace.canonicalArtifacts.map(artifact => [artifact.artifactId, artifact]));
  const register = readJson(artifacts.smoothie_depot_dossier_register.path);
  const markdown = read(artifacts.nutrition_depot_executive_dossier_markdown.path).trimEnd();
  const structured = readJson(artifacts.nutrition_depot_executive_dossier_json.path);
  const rankedProspects = readJson(artifacts.smoothie_depot_ranked_business_prospects.path);

  const registeredNutritionDepot = register.canonicalDossiers?.find(dossier => (
    dossier.business === "Nutrition Depot Houston and Greater Houston"
  ));

  assert(Boolean(registeredNutritionDepot), "Dossier register must include Nutrition Depot.", failures);
  assert(
    registeredNutritionDepot?.markdownArtifact === artifacts.nutrition_depot_executive_dossier_markdown.path,
    "Dossier register markdown path must match canonical artifact registry.",
    failures
  );
  assert(
    registeredNutritionDepot?.structuredArtifact === artifacts.nutrition_depot_executive_dossier_json.path,
    "Dossier register JSON path must match canonical artifact registry.",
    failures
  );
  assert(
    registeredNutritionDepot?.status === "completed_canonical_research_dossier",
    "Nutrition Depot dossier must be registered as completed canonical Research dossier.",
    failures
  );
  assert(registeredNutritionDepot?.dashboardCanonicalSource === true, "Nutrition Depot dossier must be Dashboard-consumable.", failures);

  const rankedNutritionDepot = rankedProspects.prospects?.find(prospect => prospect.business === "Nutrition Depot Houston and Greater Houston");
  assert(Boolean(rankedNutritionDepot), "Ranked prospects must include Nutrition Depot.", failures);
  assert(
    rankedNutritionDepot?.canonicalDossier === artifacts.nutrition_depot_executive_dossier_markdown.path,
    "Ranked prospect must point to canonical Nutrition Depot dossier.",
    failures
  );

  assert(structured.artifactStatus === "completed_canonical_research_dossier", "Structured dossier must be completed canonical Research artifact.", failures);
  assert(structured.workspaceId === workspace.workspaceId, "Structured dossier workspace mismatch.", failures);
  assert(structured.operatingProfileId === workspace.operatingProfileId, "Structured dossier operating profile mismatch.", failures);
  assert(structured.requiredDossierSections?.length === 30, "Structured dossier must include 30 required sections.", failures);
  assert(
    structured.sectionDecisionQualityLedger?.sectionsCovered === 30,
    "Structured dossier must include a 30-section decision-quality ledger.",
    failures
  );
  assert(markdown.includes("Remediation status: Supersedes the prior thin canonical dossier in place."), "Markdown dossier must mark remediation status.", failures);

  return { register, markdown, structured };
}

function validateDashboardConsumer(workspace, dossierContext, failures) {
  const dashboardContract = workspace.consumerContracts.dashboard;
  const [sourcePath, deployPath] = dashboardContract.requiredSourcePaths;
  const source = read(sourcePath);
  const deploy = read(deployPath);
  const markdownHash = sha256(dossierContext.markdown);
  const structuredArtifact = JSON.stringify(dossierContext.structured, null, 2);

  assert(source === deploy, "Dashboard source and deploy mirror must match.", failures);
  assert(source.includes('data-workspace-id="smoothie_depot"'), "Dashboard must declare smoothie_depot workspace.", failures);
  assert(source.includes('data-operating-profile-id="franchise_development"'), "Dashboard must declare franchise_development profile.", failures);
  assert(source.includes("Founder Operations Zero State"), "Dashboard must render Founder Operations Zero State.", failures);
  assert(source.includes("Monday Mission Slot"), "Dashboard must render Monday mission slot.", failures);
  assert(source.includes("Wednesday Mission Slot"), "Dashboard must render Wednesday mission slot.", failures);
  assert(source.includes("Friday Mission Slot"), "Dashboard must render Friday mission slot.", failures);
  assert(source.includes("No completed Research-owned canonical dossier is registered for this slot."), "Dashboard must fail closed for missing dossiers.", failures);
  assert(source.includes(markdownHash), "Dashboard must expose canonical Markdown artifact hash.", failures);
  assert(source.includes(htmlEscape("# Nutrition Depot Executive Due Diligence Dossier v1")), "Dashboard must render canonical Markdown title.", failures);
  assert(source.includes(htmlEscape("## 29. Source Reliability Matrix")), "Dashboard must render full dossier sections.", failures);
  assert(source.includes(htmlEscape('"artifactStatus": "completed_canonical_research_dossier"')), "Dashboard must render structured JSON artifact.", failures);
  assert(source.includes(htmlEscape(structuredArtifact).slice(0, 120)), "Dashboard must render structured JSON content.", failures);

  for (const [label, value] of [
    ["Outreach Sent", "0"],
    ["Discovery Calls Scheduled", "0"],
    ["Qualified Candidates", "0"],
    ["JR Handoffs", "0"],
    ["Closed Franchise Sales", "0"],
    ["Commission Forecast", "$0"]
  ]) {
    const pattern = new RegExp(`<span>${label}</span>\\s*<strong>${value.replace("$", "\\$")}</strong>`);
    assert(pattern.test(source), `Dashboard zero-state metric missing or non-zero: ${label}.`, failures);
  }

  for (const forbidden of [
    "Candidate Pipeline",
    "Candidate Detail",
    "JR Queue",
    "Commission Dashboard",
    "Activity Feed",
    "Bayou Nutrition Group",
    "Cypress Wellness Holdings",
    "Pearland Hospitality Partners",
    "example.com",
    "Fixture outcome",
    "$186k",
    "$42k protected",
    "fitness_connection",
    "Units",
    "Memberships",
    "runtime-pools",
    "active-pool",
    "qualified-prospects",
    "fetch(",
    "localStorage",
    "sessionStorage"
  ]) {
    assert(!source.includes(forbidden), `Dashboard must not contain forbidden production/fixture term: ${forbidden}`, failures);
  }
}

function validateCrmConsumer(workspace, failures) {
  const crmContract = workspace.consumerContracts.crm;
  const foundation = read("crm/crm-foundation.mjs");
  const tests = read("tests/crm-foundation.test.mjs");
  const planning = readJson("crm/workspaces/smoothie-depot/candidate-pipeline-contracts.json");

  assert(foundation.includes(crmContract.requiredEntryPoint), "CRM handoff entry point missing.", failures);
  assert(foundation.includes("Unknown CRM workspace intake workspace"), "CRM must reject unknown workspace.", failures);
  assert(foundation.includes("cross-workspace contamination"), "CRM must reject cross-workspace contamination.", failures);
  assert(foundation.includes("smoothie_depot_candidate_handoff"), "CRM must support Smoothie Depot candidate handoff target.", failures);
  assert(tests.includes("unknown_workspace"), "CRM tests must cover unknown workspace rejection.", failures);
  assert(tests.includes("cross-workspace contamination"), "CRM tests must cover cross-workspace contamination rejection.", failures);
  assert(planning.runtimeImplementationApproved === false, "CRM runtime persistence must remain unauthorized.", failures);
  assert(planning.runtimeRecordsCreated === false, "CRM runtime records must remain uncreated.", failures);
  assert(planning.workspaceIsolation.doNotMixWithFitnessConnection === true, "CRM planning must block Fitness Connection mixing.", failures);
}

function validateIntelligenceConsumer(workspace, failures) {
  const intelligenceContract = workspace.consumerContracts.intelligence;
  const plan = readJson("intelligence/workspaces/smoothie-depot/workspace-intelligence-plan.json");
  const contracts = readJson("intelligence/contracts/business-acquisition-intelligence-contracts.json");

  assert(plan.workspaceId === workspace.workspaceId, "Intelligence workspace plan workspace mismatch.", failures);
  assert(plan.operatingProfileId === workspace.operatingProfileId, "Intelligence workspace plan operating profile mismatch.", failures);
  assert(plan.workspaceIsolation.fitnessConnectionIsolationConfirmed === true, "Intelligence plan must confirm Fitness isolation.", failures);
  assert(plan.workspaceIsolation.routeIntelligenceInfluence === false, "Intelligence plan must not influence route systems.", failures);
  assert(plan.workspaceIsolation.fitnessConnectionRouteInfluence === false, "Intelligence plan must not influence Fitness routes.", failures);

  for (const [flag, value] of Object.entries(plan.runtimeActivation || {})) {
    assert(value === false, `Intelligence runtime activation flag ${flag} must remain false.`, failures);
  }

  assert(contracts.fitnessConnectionIsolationConfirmed === true, "Business acquisition contracts must confirm Fitness isolation.", failures);
  assert(contracts.routeIntelligenceInfluence === false, "Business acquisition contracts must block Route Intelligence influence.", failures);
  assert(contracts.contracts?.WorkspaceIsolationGuardrails, "Business acquisition contracts must define WorkspaceIsolationGuardrails.", failures);
  assert(intelligenceContract.mustNotActivateProductionScoring === true, "Intelligence contract must block production scoring.", failures);
  assert(intelligenceContract.mustNotMutateResearchOrCrm === true, "Intelligence contract must block Research/CRM mutation.", failures);
}

function validateReferencedPaths(paths, label, failures) {
  for (const path of Object.values(paths || {})) {
    assert(exists(path), `${label} referenced path does not exist: ${path}`, failures);
  }
}

function validateSharedWorkspaceLeadIntakeContract(workspace, failures) {
  const artifactId = `${workspace.workspaceId}_shared_lead_intake_contract`;
  const artifact = workspace.canonicalArtifacts.find(candidate => candidate.artifactId === artifactId);
  const workspaceContract = getSharedLeadIntakeWorkspaceContract(workspace.workspaceId);

  assert(Boolean(artifact), `${workspace.workspaceId} missing shared lead intake contract artifact.`, failures);
  assert(artifact?.ownerSubsystem === "Prometheus Infrastructure", `${artifactId} must be Infrastructure-owned.`, failures);
  assert(artifact?.path === "integrations/shared-workspace-lead-intake-contract.js", `${artifactId} path mismatch.`, failures);
  assert(Boolean(workspaceContract), `${workspace.workspaceId} missing shared lead intake workspace contract.`, failures);
  assert(workspaceContract?.workspaceId === workspace.workspaceId, `${workspace.workspaceId} shared intake workspaceId mismatch.`, failures);
  assert(workspaceContract?.operatingProfileId === workspace.operatingProfileId, `${workspace.workspaceId} shared intake operating profile mismatch.`, failures);
  assert(
    workspaceContract?.protectedWorkspaceIds?.every(protectedWorkspaceId => workspace.protectedWorkspaceIds.includes(protectedWorkspaceId)),
    `${workspace.workspaceId} shared intake protected workspace mismatch.`,
    failures
  );

  for (const componentId of SHARED_WORKSPACE_LEAD_INTAKE_COMPONENTS) {
    assert(
      JSON.stringify(SHARED_WORKSPACE_LEAD_INTAKE_CONTRACT).includes(componentId),
      `Shared lead intake contract missing component: ${componentId}.`,
      failures
    );
  }

  assert(SHARED_WORKSPACE_LEAD_INTAKE_CONTRACT.endpoint.path === "/api/partner-intake", "Shared intake endpoint path drifted.", failures);
  assert(SHARED_WORKSPACE_LEAD_INTAKE_CONTRACT.workspaceRouter.unknownWorkspaceFailsClosed === true, "Unknown workspace must fail closed.", failures);
  assert(SHARED_WORKSPACE_LEAD_INTAKE_CONTRACT.workspaceRouter.missingWorkspaceRouteFailsClosed === true, "Missing workspace route must fail closed.", failures);
  assert(SHARED_WORKSPACE_LEAD_INTAKE_CONTRACT.workspaceRouter.noCrossWorkspaceRouting === true, "Shared intake must block cross-workspace routing.", failures);
  assert(SHARED_WORKSPACE_LEAD_INTAKE_CONTRACT.workspaceRouter.noProductionFixtureOrDemoIntakeData === true, "Shared intake must block production fixture/demo intake data.", failures);
  assert(SHARED_WORKSPACE_LEAD_INTAKE_CONTRACT.kvPersistence.binding === "SHARED_LEAD_INTAKE_STORE", "Shared intake KV binding mismatch.", failures);
  assert(SHARED_WORKSPACE_LEAD_INTAKE_CONTRACT.kvPersistence.failClosedIfBindingMissing === true, "Shared intake KV binding must fail closed if missing.", failures);
  assert(SHARED_WORKSPACE_LEAD_INTAKE_CONTRACT.crmHandoffPacket.contract === "shared_workspace_crm_lead_intake_packet.v1", "CRM handoff contract mismatch.", failures);
  assert(SHARED_WORKSPACE_LEAD_INTAKE_CONTRACT.crmHandoffPacket.ownerSubsystem === "Prometheus CRM", "CRM handoff packet must remain CRM-owned.", failures);
  assert(SHARED_WORKSPACE_LEAD_INTAKE_CONTRACT.crmHandoffPacket.mutationPerformedByInfrastructure === false, "Infrastructure must not mutate CRM records.", failures);
  assert(SHARED_WORKSPACE_LEAD_INTAKE_CONTRACT.founderNotificationEvent.binding === "FOUNDER_EMAIL", "Founder notification binding mismatch.", failures);
  assert(SHARED_WORKSPACE_LEAD_INTAKE_CONTRACT.founderNotificationEvent.registeredEvenIfDeliveryPending === true, "Founder notification contract must exist even when email delivery is pending.", failures);
  assert(SHARED_WORKSPACE_LEAD_INTAKE_CONTRACT.failureRetryEvent.failedUnknownWorkspaceMayNotPersist === true, "Unknown workspace failures must not persist.", failures);
  assert(SHARED_WORKSPACE_LEAD_INTAKE_CONTRACT.auditMetadata.requiredEvents.includes("workspace_routed"), "Shared intake audit metadata must include workspace routing.", failures);
  assert(SHARED_WORKSPACE_LEAD_INTAKE_CONTRACT.aegisProtection.routePolicy === "lead_intake", "Shared intake Aegis policy mismatch.", failures);
  assert(SHARED_WORKSPACE_LEAD_INTAKE_CONTRACT.failClosedBehavior.unknownWorkspaceStatus === 400, "Shared intake unknown workspace status must be 400.", failures);
  assert(SHARED_WORKSPACE_LEAD_INTAKE_CONTRACT.boundaries.crmConsumesHandoffPackets === true, "CRM must consume shared intake handoff packets.", failures);
  assert(SHARED_WORKSPACE_LEAD_INTAKE_CONTRACT.boundaries.dashboardReadsRawIntakeWithoutApproval === false, "Dashboard raw intake reads must remain blocked.", failures);
}

function validateFitnessConnectionWorkspaceContract(workspace, failures) {
  const artifacts = Object.fromEntries(workspace.canonicalArtifacts.map(artifact => [artifact.artifactId, artifact]));
  const identity = readJson(artifacts.fitness_connection_workspace_identity_contract.path);
  const dashboardContract = readJson(artifacts.fitness_connection_dashboard_consumer_contract.path);
  const routeDataContract = readJson(artifacts.fitness_connection_route_intelligence_data_contract.path);
  const crmContract = readJson(artifacts.fitness_connection_crm_consumer_contract.path);
  const intelligenceContract = readJson(artifacts.fitness_connection_intelligence_consumer_contract.path);
  const dashboardSource = read(artifacts.fitness_connection_dashboard_source.path);
  const dashboardDeploy = read(artifacts.fitness_connection_dashboard_deploy_asset.path);
  const activePool = readJson(routeDataContract.canonicalDataPaths.activePool);
  const runtimePools = readJson(routeDataContract.canonicalDataPaths.runtimePools);
  const routeQualityReport = readJson(routeDataContract.canonicalDataPaths.routeQualityReport);
  const crmFoundation = read(crmContract.canonicalCrmPaths.crmFoundation);
  const crmTests = read(crmContract.canonicalCrmPaths.crmFoundationTests);
  const operatingProfiles = readJson(intelligenceContract.canonicalIntelligencePaths.operatingProfileRegistry);

  assert(identity.workspaceId === workspace.workspaceId, "Fitness identity contract workspace mismatch.", failures);
  assert(identity.operatingProfileId === workspace.operatingProfileId, "Fitness identity contract operating profile mismatch.", failures);
  assert(identity.workspaceIsolationRules.smoothieDepotCandidateDataUsed === false, "Fitness identity must block Smoothie Depot candidate data.", failures);
  assert(identity.workspaceIsolationRules.missingArtifactFailsClosed === true, "Fitness identity must fail closed on missing artifacts.", failures);
  assert(identity.roleBoundary.founderRole.canSwitchWorkspaces === true, "Founder role must retain workspace switcher.", failures);
  assert(identity.roleBoundary.repRole.defaultRepId === "anthony", "Fitness rep default must remain Anthony.", failures);
  assert(identity.roleBoundary.repRole.canSwitchWorkspaces === false, "Rep role must not switch workspaces.", failures);
  assert(identity.roleBoundary.repRole.canViewOwnerTabs === false, "Rep role must not view owner tabs.", failures);
  assert(identity.futureFeatureWorkGate.enabled === true, "Fitness future feature work gate must remain enabled.", failures);

  assert(dashboardSource === dashboardDeploy, "Fitness Dashboard source and deploy mirror must match.", failures);
  for (const marker of dashboardContract.requiredDashboardMarkers) {
    assert(dashboardSource.includes(marker), `Fitness Dashboard missing required marker: ${marker}`, failures);
  }
  assert(dashboardSource.includes('body[data-session-role="rep"] .manager-only'), "Fitness Dashboard must hide manager controls from rep sessions.", failures);
  assert(dashboardSource.includes('body[data-session-role="rep"] .admin-only'), "Fitness Dashboard must hide admin controls from rep sessions.", failures);
  assert(dashboardSource.includes('if (appMode === "rep" && ["places", "stats", "find"].includes(name)) name = "today";'), "Fitness Dashboard must guard owner tabs from rep mode.", failures);
  assert(dashboardSource.includes('if (requestedRole === "rep" || sessionRole === "rep") appMode = "rep";'), "Fitness Dashboard must force rep mode for rep sessions.", failures);
  assert(dashboardContract.repViewContract.adminControlsAllowed === false, "Dashboard contract must block rep admin controls.", failures);
  assert(dashboardContract.productionRules.anthonyRepAccessMustNotEqualFounderAccess === true, "Dashboard contract must protect Anthony/Founder boundary.", failures);

  validateReferencedPaths(routeDataContract.canonicalDataPaths, "Fitness route/data contract", failures);
  assert(activePool.pool === "active", "Fitness Active Pool must remain active pool.", failures);
  assert(activePool.count === routeDataContract.assignedLeadRules.activePoolExpectedCount, "Fitness Active Pool count must match contract.", failures);
  assert(activePool.records?.some(record => record.runtimeProfiles?.some(profile => profile.repProfileId === "anthony")), "Fitness Active Pool must include Anthony-assigned runtime profiles.", failures);
  assert(runtimePools.datasetVersion === "google-qualified-businesses-v2" || runtimePools.sourceDatasetVersion === "google-qualified-businesses-v2" || runtimePools.dataset_version === "google-qualified-businesses-v2", "Fitness runtime pools must reference google-qualified-businesses-v2.", failures);
  assert(routeQualityReport.status === "passed", "Fitness route quality report must pass.", failures);
  assert(routeQualityReport.dataset?.activePoolRecords === routeDataContract.assignedLeadRules.activePoolExpectedCount, "Fitness route quality report Active Pool count must match contract.", failures);
  assert(routeQualityReport.dataset?.expandedDashboardRouteRecords === routeDataContract.assignedLeadRules.expandedDashboardRouteRecordsExpected, "Fitness expanded Dashboard route records must match contract.", failures);
  assert(routeDataContract.productionRules.smoothieDepotCandidateDataAllowed === false, "Fitness route/data contract must block Smoothie Depot candidate data.", failures);

  validateReferencedPaths(crmContract.canonicalCrmPaths, "Fitness CRM contract", failures);
  assert(crmFoundation.includes("fitness_connection: Object.freeze"), "CRM must register Fitness Connection workspace intake.", failures);
  assert(crmFoundation.includes('targetType: "fitness_connection_lead"'), "CRM must preserve Fitness Connection lead target type.", failures);
  assert(crmFoundation.includes("fitness_growth_lead_pipeline"), "CRM must preserve Fitness growth lead pipeline.", failures);
  assert(crmFoundation.includes("cross-workspace contamination"), "CRM must reject cross-workspace contamination.", failures);
  assert(crmTests.includes("Fitness Connection workspace intake creates CRM lead handoff"), "CRM tests must cover Fitness workspace intake.", failures);
  assert(crmContract.writeRules.dashboardWritesCrmRecords === false, "Dashboard must not write Fitness CRM records.", failures);
  assert(crmContract.writeRules.unknownWorkspaceFailsClosed === true, "CRM must fail closed for unknown workspace.", failures);

  validateReferencedPaths(intelligenceContract.canonicalIntelligencePaths, "Fitness Intelligence contract", failures);
  assert(operatingProfiles.profiles?.some(profile => profile.profileId === "fitness"), "Operating Profile registry must include Fitness.", failures);
  assert(intelligenceContract.interpretationRules.productionLearningActive === false, "Fitness Intelligence contract must keep production learning inactive.", failures);
  assert(intelligenceContract.interpretationRules.productionScoringChangeRequiresExplicitFutureHandoff === true, "Fitness scoring changes must require explicit future handoff.", failures);
  assert(intelligenceContract.workspaceIsolationRules.smoothieDepotCandidateDataAllowed === false, "Fitness Intelligence contract must block Smoothie Depot candidate data.", failures);
  assert(intelligenceContract.workspaceIsolationRules.fitnessFieldLearningInfluenceOnSmoothieDepotAllowed === false, "Fitness Intelligence must not influence Smoothie Depot.", failures);

  assert(workspace.consumerContracts.dashboard.mustPreserveFounderRepBoundary === true, "Fitness Dashboard consumer contract must preserve Founder/Rep boundary.", failures);
  assert(workspace.consumerContracts.crm.mustPreserveFitnessOperatingProfile === true, "Fitness CRM consumer contract must preserve Fitness profile.", failures);
  assert(workspace.consumerContracts.intelligence.mustNotInfluenceSmoothieDepot === true, "Fitness Intelligence consumer contract must not influence Smoothie Depot.", failures);
}

function validateFixturePolicy(registry, failures) {
  for (const workspace of registry.workspaces) {
    const fixtureFindings = workspace.auditFindings.fixtureDataLocationsIdentified || [];
    for (const finding of fixtureFindings) {
      assert(exists(finding.path), `Registered fixture/demo path missing: ${finding.path}`, failures);
      assert(finding.productionConsumerAllowed === false, `Fixture/demo path must not be production-consumable: ${finding.path}`, failures);
    }
  }
}

function validateSubsystemWorkspaceComplianceAudit(audit, failures) {
  assert(
    audit.auditId === "prometheus-subsystem-workspace-contract-compliance-audit-v1",
    "Subsystem/workspace compliance audit id drifted.",
    failures
  );
  assert(audit.status === "active", "Subsystem/workspace compliance audit must remain active.", failures);
  assert(audit.owningSubsystem === "Prometheus Overwatch", "Subsystem/workspace compliance audit must be Overwatch-owned.", failures);
  assert(
    audit.contractLayer === "prometheus-cross-subsystem-artifact-contract-v1",
    "Subsystem/workspace compliance audit must point to the active artifact contract layer.",
    failures
  );
  assert(audit.featureWorkGate?.enabled === true, "Subsystem/workspace feature work gate must remain enabled.", failures);

  const requiredSubsystems = [
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
  ];
  const auditedSubsystems = new Map((audit.subsystems || []).map(item => [item.subsystem, item]));
  for (const subsystem of requiredSubsystems) {
    assert(auditedSubsystems.has(subsystem), `Subsystem compliance audit missing ${subsystem}.`, failures);
  }
  assert(
    audit.summary?.subsystemsAudited === requiredSubsystems.length,
    "Subsystem compliance audit summary count must match required subsystem coverage.",
    failures
  );

  const requiredWorkspaces = ["smoothie_depot", "fitness_connection", "customer_fixture_prometheus"];
  const auditedWorkspaces = new Map((audit.workspaces || []).map(item => [item.workspaceId, item]));
  for (const workspaceId of requiredWorkspaces) {
    assert(auditedWorkspaces.has(workspaceId), `Workspace compliance audit missing ${workspaceId}.`, failures);
  }
  assert(
    audit.summary?.workspacesAudited === requiredWorkspaces.length,
    "Workspace compliance audit summary count must match required workspace coverage.",
    failures
  );

  const records = [...(audit.subsystems || []), ...(audit.workspaces || [])];
  for (const record of records) {
    const name = record.subsystem || record.workspaceId || "unknown record";
    const requiresRemediation = record.bypassIdentified === true || /partial|bypass/.test(record.status || "");
    if (requiresRemediation) {
      assert(Boolean(record.owner), `${name} bypass/partial record must assign an owner.`, failures);
      assert(
        record.remediationRequiredBeforeFutureFeatureWork === true,
        `${name} bypass/partial record must block future feature work until remediation.`,
        failures
      );
      assert(Boolean(record.scheduledRemediation), `${name} bypass/partial record must schedule remediation.`, failures);
    }
  }

  const smoothieDepot = auditedWorkspaces.get("smoothie_depot");
  const fitnessConnection = auditedWorkspaces.get("fitness_connection");
  const fixtureWorkspace = auditedWorkspaces.get("customer_fixture_prometheus");
  assert(smoothieDepot?.registeredInContractLayer === true, "Smoothie Depot must remain registered in the contract layer.", failures);
  assert(smoothieDepot?.bypassIdentified === true, "Smoothie Depot partial compliance must remain visible until all artifacts are registered.", failures);
  assert(fitnessConnection?.registeredInContractLayer === true, "Fitness Connection must be registered in the contract layer.", failures);
  assert(fitnessConnection?.bypassIdentified === false, "Fitness Connection bypass must be closed by canonical workspace contract.", failures);
  assert(
    fitnessConnection?.futureFeatureWorkRequiresContract === true,
    "Future Fitness Connection work must remain gated by the canonical workspace contract.",
    failures
  );
  assert(fixtureWorkspace?.status === "allowed_test_fixture_only", "Customer fixture workspace must remain test-only.", failures);
  assert(fixtureWorkspace?.bypassIdentified === false, "Customer fixture workspace must not be treated as production bypass.", failures);

  const infrastructureAudit = auditedSubsystems.get("Prometheus Infrastructure");
  assert(infrastructureAudit?.bypassIdentified === false, "Infrastructure shared lead-intake contract bypass must be closed.", failures);
  assert(
    infrastructureAudit?.evidence?.some(item => item.includes("integrations/shared-workspace-lead-intake-contract.js")),
    "Infrastructure audit must reference the shared lead-intake contract.",
    failures
  );

  const firstRemediation = audit.globalRemediationOrder?.find(item => item.priority === 1);
  assert(firstRemediation?.owner === "Prometheus Data", "Priority 1 remediation should move to Data after Infrastructure intake registration.", failures);
  assert(
    firstRemediation?.task?.includes("Active Pool"),
    "Priority 1 remediation must register Data runtime artifacts after Infrastructure intake registration.",
    failures
  );
}

export function verifyCrossSubsystemArtifactContracts() {
  const failures = [];
  const registry = readJson(registryPath);
  const complianceAudit = readJson(complianceAuditPath);

  validateRegistryShape(registry, failures);
  validateCanonicalArtifacts(registry, failures);
  validateFixturePolicy(registry, failures);
  validateSubsystemWorkspaceComplianceAudit(complianceAudit, failures);

  for (const workspace of registry.workspaces) {
    if (workspace.workspaceId === "smoothie_depot") {
      const dossierContext = validateSmoothieDepotDossierContract(workspace, failures);
      validateDashboardConsumer(workspace, dossierContext, failures);
      validateCrmConsumer(workspace, failures);
      validateIntelligenceConsumer(workspace, failures);
      validateSharedWorkspaceLeadIntakeContract(workspace, failures);

      assert(
        Array.isArray(workspace.auditFindings.brokenLinksIdentified) && workspace.auditFindings.brokenLinksIdentified.length === 0,
        "Current audit should not report broken canonical links for Nutrition Depot.",
        failures
      );
      assert(
        workspace.auditFindings.incompleteLinksIdentified.some(item => item.includes("Cranky Carrot")),
        "Audit must identify missing Cranky Carrot / LEEMOO canonical dossiers.",
        failures
      );
      assert(
        workspace.auditFindings.requiredRemediationOrder.length >= 5,
        "Audit must define remediation order.",
        failures
      );
    }
    if (workspace.workspaceId === "fitness_connection") {
      validateFitnessConnectionWorkspaceContract(workspace, failures);
      validateSharedWorkspaceLeadIntakeContract(workspace, failures);
    }
  }

  return {
    ok: failures.length === 0,
    failures,
    registry,
    complianceAudit
  };
}

const invokedPath = process.argv[1] ? new URL(`file://${process.argv[1]}`).pathname : "";
if (invokedPath === new URL(import.meta.url).pathname) {
  const result = verifyCrossSubsystemArtifactContracts();
  if (!result.ok) {
    console.error("Cross-subsystem artifact contract verification failed:");
    for (const failure of result.failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  const workspaceCount = result.registry.workspaces.length;
  const artifactCount = result.registry.workspaces.reduce((count, workspace) => count + workspace.canonicalArtifacts.length, 0);
  const auditedSubsystemCount = result.complianceAudit.subsystems.length;
  const auditedWorkspaceCount = result.complianceAudit.workspaces.length;
  console.log(`Cross-subsystem artifact contracts verified: ${workspaceCount} registered workspace(s), ${artifactCount} canonical artifact(s), ${auditedSubsystemCount} subsystem(s) audited, ${auditedWorkspaceCount} workspace(s) audited, workspace isolation preserved.`);
}
