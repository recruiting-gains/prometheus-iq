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
  const packageMarkdownPath = "research/workspaces/smoothie-depot/executive-intelligence-packages/nutrition-depot-executive-intelligence-package-v2.md";
  const packageJsonPath = "research/workspaces/smoothie-depot/executive-intelligence-packages/nutrition-depot-executive-intelligence-package-v2.json";
  const packageRegisterPath = "research/workspaces/smoothie-depot/executive-intelligence-packages/package-register.json";
  const packageMarkdown = read(packageMarkdownPath).trimEnd();
  const packageJson = readJson(packageJsonPath);
  const packageRegister = readJson(packageRegisterPath);
  const markdownHash = sha256(packageMarkdown);
  const structuredArtifact = JSON.stringify(packageJson, null, 2);

  assert(packageRegister.workspaceId === workspace.workspaceId, "Executive package register workspace mismatch.", failures);
  assert(packageRegister.operatingProfileId === workspace.operatingProfileId, "Executive package register operating profile mismatch.", failures);
  assert(packageRegister.boundaryConfirmation?.dashboardModified === false, "Executive package register must not be Dashboard-modified.", failures);
  const activeNutritionPackage = packageRegister.packages?.find(pkg => pkg.packageId === packageJson.packageId);
  assert(activeNutritionPackage?.artifactStatus === "completed_research_executive_intelligence_package", "Active Nutrition Depot package register entry must be completed.", failures);
  assert(activeNutritionPackage?.canonicalForResearch === true, "Active Nutrition Depot package must remain canonical for Research.", failures);
  assert(activeNutritionPackage?.supersedesPackageId === "smoothie_depot_eip_001_nutrition_depot", "Active Nutrition Depot package must supersede v1.", failures);
  assert(packageJson.packageStatus === "completed_research_executive_intelligence_package", "Executive package must be completed.", failures);
  assert(packageJson.packageId === "smoothie_depot_eip_001_nutrition_depot_v2", "Executive package must use active Nutrition Depot v2 package ID.", failures);
  assert(packageJson.supersedesPackageId === "smoothie_depot_eip_001_nutrition_depot", "Executive package must point to historical v1.", failures);
  assert(packageJson.v1PreservedAsHistorical === true, "Executive package must preserve v1 as historical.", failures);
  assert(packageJson.workspaceId === workspace.workspaceId, "Executive package workspace mismatch.", failures);
  assert(packageJson.operatingProfileId === workspace.operatingProfileId, "Executive package operating profile mismatch.", failures);
  assert(packageJson.boundaryConfirmation?.productionSystemsModified === false, "Executive package must not modify production systems.", failures);

  assert(source === deploy, "Dashboard source and deploy mirror must match.", failures);
  assert(source.includes('data-workspace-id="smoothie_depot"'), "Dashboard must declare smoothie_depot workspace.", failures);
  assert(source.includes('data-operating-profile-id="franchise_development"'), "Dashboard must declare franchise_development profile.", failures);
  assert(source.includes("Executive Intelligence Operations Center"), "Dashboard must render Executive Intelligence Operations Center.", failures);
  assert(source.includes("Open Executive Intelligence Package"), "Dashboard must expose Executive Intelligence Package action.", failures);
  assert(source.includes("Founder Executive Intelligence Review Mode"), "Dashboard must render Founder Executive Intelligence Review Mode.", failures);
  assert(source.includes("Founder Review"), "Dashboard must render Founder Review workflow.", failures);
  assert(source.includes("Founder Approves"), "Dashboard must render Founder approval decision.", failures);
  assert(source.includes("Founder Rejects"), "Dashboard must render Founder rejection decision.", failures);
  assert(source.includes("Additional Research Required"), "Dashboard must render additional Research request decision.", failures);
  assert(source.includes("Export Professional Executive Package"), "Dashboard must render professional package export workflow.", failures);
  assert(source.includes("Intelligence Library"), "Dashboard must render workspace-isolated Intelligence Library.", failures);
  assert(source.includes("Local Founder Notes"), "Dashboard must render local Founder notes.", failures);
  assert(source.includes("Table of Contents"), "Dashboard must render Executive package table of contents.", failures);
  assert(source.includes("Previous:"), "Dashboard must render previous section navigation.", failures);
  assert(source.includes("Next:"), "Dashboard must render next section navigation.", failures);
  assert(source.includes("No completed Research-owned Executive Intelligence Package is registered"), "Dashboard must fail closed for missing Executive Intelligence Packages.", failures);
  assert(source.includes(packageMarkdownPath), "Dashboard must point to canonical Executive Intelligence Package Markdown.", failures);
  assert(source.includes(markdownHash), "Dashboard must expose canonical Markdown artifact hash.", failures);
  assert(source.includes(htmlEscape("# Nutrition Depot Houston and Greater Houston")), "Dashboard must render active Executive package title.", failures);
  assert(source.includes(htmlEscape("## Executive Intelligence Package v2")), "Dashboard must render active Executive package version.", failures);
  assert(source.includes(htmlEscape("## Executive Decision Page")), "Dashboard must render Executive Decision Page.", failures);
  assert(source.includes(htmlEscape("## Layer 11: Strategic Intelligence")), "Dashboard must render full package sections.", failures);
  assert(source.includes(htmlEscape('"packageStatus": "completed_research_executive_intelligence_package"')), "Dashboard must render structured package JSON artifact.", failures);
  assert(source.includes(htmlEscape(structuredArtifact).slice(0, 120)), "Dashboard must render structured JSON content.", failures);
  assert(
    dashboardContract.allowedReadPaths.includes("administration/workspaces/smoothie-depot/founder-operating-manual-v1.md"),
    "Dashboard Administration manual read path must be registered.",
    failures
  );
  assert(dashboardContract.administrationOperatingManualsReadOnly === true, "Dashboard must consume Administration manuals read-only.", failures);
  assert(dashboardContract.mustNotWriteAdministrationArtifacts === true, "Dashboard must not write Administration artifacts.", failures);

  for (const requiredLifecycleText of [
    "Business Currently Under Research",
    "Research Completion",
    "Evidence Completion",
    "Verification Completion",
    "Founder Review Status",
    "Package Status",
    "Ready for Export",
    "Delivered",
    "Awaiting Outcome",
    "Learning Pending",
    "Current Mission",
    "Next Mission",
    "Research Queue",
    "Package Queue",
    "Awaiting Founder Review",
    "Outcome Pending",
    "Research Learning Required"
  ]) {
    assert(source.includes(requiredLifecycleText), `Dashboard lifecycle field missing: ${requiredLifecycleText}.`, failures);
  }

  for (const forbidden of [
    "Founder Operations Zero State",
    "Outreach Sent",
    "Discovery Calls Scheduled",
    "Qualified Candidates",
    "JR Handoffs",
    "Closed Franchise Sales",
    "Commission Forecast",
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
  const foundation = [
    read("crm/crm-foundation.mjs"),
    read("crm/workspace-lead-persistence.mjs")
  ].join("\n");
  const tests = read("tests/crm-foundation.test.mjs");
  const planning = readJson("crm/workspaces/smoothie-depot/candidate-pipeline-contracts.json");

  assert(foundation.includes(crmContract.requiredEntryPoint), "CRM handoff entry point missing.", failures);
  assert(
    crmContract.allowedReadPaths.includes("administration/registers/stabilization-issues.json"),
    "CRM Administration field-feedback read path must be registered.",
    failures
  );
  assert(crmContract.mayConsumeFieldFeedbackOnlyThroughAdministrationContract === true, "CRM must consume field feedback only through Administration contract.", failures);
  assert(crmContract.mayWriteAdministrationArtifacts === false, "CRM must not write Administration artifacts.", failures);
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
  assert(
    intelligenceContract.mayConsumeDecisionJournalAarOnlyThroughAdministrationContract === true,
    "Intelligence must consume Administration decision journals/AARs only through contract.",
    failures
  );
  assert(
    intelligenceContract.administrationDecisionJournalPathPattern === "administration/workspaces/{workspace-slug}/decision-journal/{yyyy-mm-dd}-{handoff-id}.json",
    "Intelligence Administration decision-journal path pattern mismatch.",
    failures
  );
  assert(intelligenceContract.mustNotWriteAdministrationArtifacts === true, "Intelligence must not write Administration artifacts.", failures);
}

function validateReferencedPaths(paths, label, failures) {
  for (const path of Object.values(paths || {})) {
    assert(exists(path), `${label} referenced path does not exist: ${path}`, failures);
  }
}

function flattenContractPathGroups(contract, groupNames) {
  return groupNames.flatMap(groupName => Object.values(contract[groupName] || {}));
}

function ensurePathRegistered(path, contract, groupNames, failures) {
  const registeredPaths = flattenContractPathGroups(contract, groupNames);
  assert(
    registeredPaths.includes(path),
    `Data runtime contract must register canonical path: ${path}`,
    failures
  );
}

function validateBusinessHoursDataContract(contract, runtimeContract, failures) {
  validateReferencedPaths(contract.canonicalArtifacts, "Business-hours Data contract", failures);

  const artifact = readJson(contract.canonicalArtifacts.businessHoursArtifact);
  const schema = readJson(contract.canonicalArtifacts.businessHoursSchema);
  const report = readJson(contract.canonicalArtifacts.refreshReport);
  const fieldEvidence = readJson(contract.canonicalArtifacts.founderFieldEvidence);
  const authorizedConsumerContract = readJson(contract.authorizationMetadata.authorizedConsumerContractPath);
  const sourceDataset = readJson(contract.sourceContract.sourceDataset);
  const expected = runtimeContract.expectedBusinessHoursMetrics;
  const statusCounts = artifact.records.reduce((counts, record) => {
    counts[record.currentOpenClosedEligibilityStatus] = (counts[record.currentOpenClosedEligibilityStatus] || 0) + 1;
    return counts;
  }, {});
  const artifactPlaceIds = artifact.records.map(record => record.googlePlaceId);
  const sourcePlaceIds = new Set((sourceDataset.production_candidates || []).map(record => record.google_place_id));

  assert(contract.owningSubsystem === "Prometheus Data", "Business-hours contract must be Data-owned.", failures);
  assert(contract.producerSubsystem === "Prometheus Data", "Business-hours producer must be Prometheus Data.", failures);
  assert(contract.intendedConsumerSubsystem === "Prometheus Intelligence Engine", "Business-hours intended consumer mismatch.", failures);
  assert(contract.status === "active_authorized", "Business-hours contract must be active and authorized.", failures);
  assert(contract.workspaceId === "fitness_connection", "Business-hours contract workspace mismatch.", failures);
  assert(contract.operatingProfileId === "fitness", "Business-hours contract operating profile mismatch.", failures);
  assert(contract.inventionGovernance.classification === "operational_improvement", "Business-hours invention-governance classification mismatch.", failures);
  assert(contract.inventionGovernance.patentabilityClaimMade === false, "Business-hours contract must not make a patentability claim.", failures);

  assert(contract.authorizationMetadata.authorizationStatus === "AUTHORIZED_ACTIVE", "Business-hours authorization status mismatch.", failures);
  assert(contract.authorizationMetadata.routeEligibilityActivationStatus === "ACTIVE", "Business-hours route eligibility activation status mismatch.", failures);
  assert(contract.authorizationMetadata.authorizedWorkspaceId === contract.workspaceId, "Business-hours authorized workspace mismatch.", failures);
  assert(contract.authorizationMetadata.authorizedOperatingProfileId === contract.operatingProfileId, "Business-hours authorized operating profile mismatch.", failures);
  assert(contract.authorizationMetadata.authorizedConsumerSubsystem === "Prometheus Intelligence Engine", "Business-hours authorized consumer subsystem mismatch.", failures);
  assert(contract.authorizationMetadata.authorizedConsumerContractId === "route-iq-closed-now-eligibility-contracts-v1", "Business-hours authorized consumer contract mismatch.", failures);
  assert(contract.authorizationMetadata.governingDataContractId === contract.contractId, "Business-hours governing Data contract mismatch.", failures);
  assert(contract.authorizationMetadata.governingBusinessHoursArtifactVersion === "business-hours-v1", "Business-hours governing artifact version mismatch.", failures);
  assert(contract.authorizationMetadata.governingSourceDatasetVersion === "google-qualified-businesses-v2", "Business-hours governing dataset version mismatch.", failures);
  assert(contract.authorizationMetadata.activationCommitReference === "be7a04c8df84a68d20868ce53183965495a4fc7d", "Business-hours activation commit mismatch.", failures);
  assert(sha256(read(contract.canonicalArtifacts.businessHoursArtifact)) === contract.authorizationMetadata.authorizedDatasetSha256, "Authorized business-hours dataset hash changed.", failures);
  assert(contract.authorizationMetadata.authorizedConsumptionScopes.includes("initial_route_generation"), "Initial route generation must be authorized.", failures);
  assert(contract.authorizationMetadata.authorizedConsumptionScopes.includes("continuous_adaptive_replenishment"), "Adaptive replenishment must be authorized.", failures);
  assert(contract.authorizationMetadata.authorizedConsumptionScopes.includes("recommendation_explainability"), "Business-hours explainability must be authorized.", failures);
  assert(contract.authorizationMetadata.failClosedBehavior.unknownConsumerFailsClosed === true, "Unknown business-hours consumers must fail closed.", failures);
  assert(contract.authorizationMetadata.failClosedBehavior.unknownWorkspaceFailsClosed === true, "Unknown business-hours workspaces must fail closed.", failures);
  assert(contract.authorizationMetadata.failClosedBehavior.crossWorkspaceUseFailsClosed === true, "Cross-workspace business-hours use must fail closed.", failures);
  assert(contract.authorizationMetadata.failClosedBehavior.consumerContractMismatchFailsClosed === true, "Mismatched business-hours consumer contracts must fail closed.", failures);
  assert(contract.authorizationMetadata.freshnessRequirements.freshnessThresholdHours === contract.freshnessPolicy.freshnessThresholdHours, "Authorized freshness threshold mismatch.", failures);
  assert(contract.authorizationMetadata.freshnessRequirements.staleOrUnknownMayBeRepresentedAsVerifiedOpen === false, "Stale or unknown hours must not become verified open.", failures);
  assert(contract.authorizationMetadata.explainabilityRequirements.silentRecommendationRemovalAllowed === false, "Authorized consumer must preserve explainability.", failures);
  assert(contract.authorizationMetadata.provenanceRequirements.sourcePlaceIdRequired === true, "Authorized consumer must preserve Place ID provenance.", failures);

  assert(authorizedConsumerContract.version === contract.authorizationMetadata.authorizedConsumerContractId, "Authorized Intelligence contract id mismatch.", failures);
  assert(authorizedConsumerContract.workspaceId === contract.workspaceId, "Authorized Intelligence contract workspace mismatch.", failures);
  assert(authorizedConsumerContract.operatingProfileId === contract.operatingProfileId, "Authorized Intelligence contract operating profile mismatch.", failures);
  assert(authorizedConsumerContract.dataContract.contractId === contract.contractId, "Authorized Intelligence contract must reference the governing Data contract.", failures);
  assert(authorizedConsumerContract.dataContract.dataOwnsStatusAndProvenance === true, "Data must retain status and provenance ownership.", failures);
  assert(authorizedConsumerContract.dataContract.intelligenceOwnsEligibility === true, "Intelligence must retain eligibility ownership.", failures);
  assert(authorizedConsumerContract.dataContract.sourceRecordsModified === false, "Authorized Intelligence consumer must not mutate Data records.", failures);
  assert(authorizedConsumerContract.safety.liveGoogleCalls === false, "Authorized Intelligence consumer must preserve zero live Google calls.", failures);
  assert(authorizedConsumerContract.safety.scoringWeightsChanged === false, "Authorized Intelligence consumer must preserve scoring weights.", failures);
  assert(authorizedConsumerContract.safety.workspaceIsolation === "fail_closed", "Authorized Intelligence consumer must fail closed on workspace isolation.", failures);

  assert(schema.$id === "prometheus-data-business-hours-v1", "Business-hours schema id mismatch.", failures);
  assert(artifact.schemaVersion === "prometheus-data-business-hours-v1", "Business-hours artifact schema version mismatch.", failures);
  assert(artifact.artifactVersion === expected.artifactVersion, "Business-hours artifact version mismatch.", failures);
  assert(artifact.workspaceId === contract.workspaceId, "Business-hours artifact workspace mismatch.", failures);
  assert(artifact.operatingProfileId === contract.operatingProfileId, "Business-hours artifact operating profile mismatch.", failures);
  assert(artifact.sourceDatasetVersion === contract.sourceContract.sourceDatasetVersion, "Business-hours source dataset version mismatch.", failures);
  assert(artifact.recordCount === expected.recordCount, "Business-hours record count mismatch.", failures);
  assert(artifact.records.length === expected.recordCount, "Business-hours records length mismatch.", failures);
  assert(artifact.records.filter(record => record.activePoolMember).length === expected.activePoolIdentityMatches, "Business-hours Active Pool identity count mismatch.", failures);
  assert(new Set(artifactPlaceIds).size === artifactPlaceIds.length, "Business-hours artifact contains duplicate Place IDs.", failures);
  assert(artifactPlaceIds.every(placeId => sourcePlaceIds.has(placeId)), "Business-hours artifact contains an unverified source Place ID.", failures);
  assert(artifact.records.every(record => record.workspaceId === "fitness_connection" && record.operatingProfileId === "fitness"), "Business-hours artifact contains cross-workspace records.", failures);
  assert(artifact.records.every(record => !JSON.stringify(record).includes("smoothie_depot")), "Business-hours records must not contain Smoothie Depot data.", failures);
  assert(artifact.records.every(record => contract.requiredRecordFields.every(field => Object.prototype.hasOwnProperty.call(record, field))), "Business-hours artifact is missing required governed record fields.", failures);
  assert(artifact.records.every(record => record.hoursProvenance?.sourcePlaceId === record.googlePlaceId), "Business-hours provenance Place ID mismatch.", failures);
  assert(artifact.records.every(record => record.regularWeeklyBusinessHours !== false && record.currentOpeningHoursWindow !== false && record.businessTimezone !== false), "Missing business-hours values must remain null, not false.", failures);
  assert(artifact.records.every(record => typeof record.currentOpenClosedEligibilityStatus === "string"), "Business-hours status must not use boolean false certainty.", failures);
  assert(artifact.routeEligibilityActivated === false, "Business-hours artifact must not activate route eligibility.", failures);
  assert(artifact.runtimeBehaviorChanged === false, "Business-hours artifact must not change runtime behavior.", failures);
  assert(artifact.scoringChanged === false, "Business-hours artifact must not change scoring.", failures);
  assert(artifact.freshnessPolicy.freshnessThresholdHours === contract.freshnessPolicy.freshnessThresholdHours, "Business-hours freshness threshold mismatch.", failures);
  assert(artifact.freshnessPolicy.providerRefreshIntervalHours === contract.freshnessPolicy.providerRefreshIntervalHours, "Business-hours provider refresh interval mismatch.", failures);
  assert(artifact.freshnessPolicy.statusEvaluationIntervalMinutes === contract.freshnessPolicy.statusEvaluationIntervalMinutes, "Business-hours status evaluation interval mismatch.", failures);

  assert(Object.values(statusCounts).reduce((sum, count) => sum + count, 0) === expected.statusCountTotal, "Business-hours status count total mismatch.", failures);
  assert(Object.keys(statusCounts).every(status => expected.allowedStatusValues.includes(status)), "Business-hours artifact contains an unsupported status.", failures);
  assert(Object.values(report.statusCounts).reduce((sum, count) => sum + count, 0) === expected.statusCountTotal, "Business-hours refresh report status count total mismatch.", failures);
  assert(Object.keys(report.statusCounts).every(status => expected.allowedStatusValues.includes(status)), "Business-hours refresh report contains an unsupported status.", failures);
  assert(report.status === "passed", "Business-hours refresh report must pass.", failures);
  assert(report.counts.refreshSucceeded === expected.refreshSucceeded, "Business-hours successful refresh count mismatch.", failures);
  assert(report.counts.refreshFailed === expected.refreshFailed, "Business-hours failed refresh count mismatch.", failures);
  assert(report.counts.regularHoursAvailable === expected.regularHoursAvailable, "Business-hours regular hours count mismatch.", failures);
  assert(report.counts.currentHoursAvailable === expected.currentHoursAvailable, "Business-hours current hours count mismatch.", failures);
  assert(report.validation.activePoolAdmissionChanged === false, "Business-hours refresh must not change Active Pool admission.", failures);
  assert(report.validation.quarantineRulesChanged === false, "Business-hours refresh must not change quarantine rules.", failures);
  assert(report.validation.routeScoringChanged === false, "Business-hours refresh must not change route scoring.", failures);
  assert(report.validation.liveGoogleRuntimeCallAdded === false, "Business-hours refresh must not add live Google runtime calls.", failures);

  const reported = artifact.records.find(record => record.googlePlaceId === contract.reportedBusinessVerification.googlePlaceId);
  assert(Boolean(reported), "Reported Christian Brothers Automotive record is missing from business-hours artifact.", failures);
  assert(reported?.businessName === contract.reportedBusinessVerification.businessName, "Reported business name mismatch.", failures);
  assert(reported?.address === contract.reportedBusinessVerification.address, "Reported business address mismatch.", failures);
  assert(reported?.permanentOperationalStatus === "OPERATIONAL", "Reported business must preserve OPERATIONAL permanent status.", failures);
  assert(reported?.currentOpenClosedEligibilityStatus === "CLOSED_VERIFIED", "Reported business must be CLOSED_VERIFIED at the governed snapshot.", failures);
  assert(reported?.businessTimezone === "America/Chicago", "Reported business timezone mismatch.", failures);
  assert(reported?.hoursProvenance?.fieldEvidenceIds?.includes(contract.reportedBusinessVerification.fieldEvidenceId), "Reported business field evidence provenance is missing.", failures);
  assert(fieldEvidence.evidence?.some(evidence => evidence.evidenceId === contract.reportedBusinessVerification.fieldEvidenceId), "Founder field evidence artifact is missing the reported observation.", failures);

  assert(contract.enrichmentPolicy.liveGoogleCallsAllowedInRepresentativeRuntime === false, "Business-hours contract must preserve zero live Google runtime calls.", failures);
  assert(contract.enrichmentPolicy.failedRefreshMayOverwriteLastVerifiedHours === false, "Failed hours refresh must preserve last verified hours.", failures);
  assert(contract.persistenceAndFailurePolicy.missingProviderBindingFailsClosedBeforeWrite === true, "Missing hours provider binding must fail closed.", failures);
  assert(contract.persistenceAndFailurePolicy.unknownWorkspaceFailsClosed === true, "Unknown business-hours workspaces must fail closed.", failures);
  assert(contract.workspaceIsolationRules.smoothieDepotMayConsumeFitnessHours === false, "Smoothie Depot must not consume Fitness business hours.", failures);
  assert(contract.workspaceIsolationRules.crossWorkspaceHoursJoinAllowed === false, "Cross-workspace business-hours joins must be prohibited.", failures);
  assert(contract.intelligenceHandoffPolicy.independentOverwatchVerificationRequired === true, "Business-hours handoff must require independent verification.", failures);
  assert(contract.intelligenceHandoffPolicy.authorizedConsumerContractId === contract.authorizationMetadata.authorizedConsumerContractId, "Business-hours handoff consumer id mismatch.", failures);
  assert(contract.intelligenceHandoffPolicy.intelligenceConsumptionAuthorized === true, "Business-hours Intelligence consumption must be authorized.", failures);
  assert(contract.intelligenceHandoffPolicy.routeEligibilityActivated === true, "Business-hours route eligibility must be active.", failures);
  assert(contract.intelligenceHandoffPolicy.initialRouteGenerationConsumptionAuthorized === true, "Initial route generation consumption must be authorized.", failures);
  assert(contract.intelligenceHandoffPolicy.continuousAdaptiveReplenishmentConsumptionAuthorized === true, "Adaptive replenishment consumption must be authorized.", failures);
  assert(contract.intelligenceHandoffPolicy.explainabilityConsumptionAuthorized === true, "Explainability consumption must be authorized.", failures);
  assert(contract.intelligenceHandoffPolicy.dataOwnsGovernedHoursStatus === true, "Data must own governed business-hours status.", failures);
  assert(contract.intelligenceHandoffPolicy.intelligenceOwnsFinalEligibilityAndRanking === true, "Intelligence must own final eligibility and ranking.", failures);
  assert(contract.intelligenceHandoffPolicy.intelligenceMayMutateDataArtifact === false, "Intelligence must not mutate the business-hours Data artifact.", failures);
  assert(contract.intelligenceHandoffPolicy.silentRecommendationRemovalAllowed === false, "Silent recommendation removal must remain prohibited.", failures);
  assert(runtimeContract.expectedBusinessHoursMetrics.routeEligibilityActivated === true, "Data runtime contract must activate authorized business-hours eligibility.", failures);
  assert(runtimeContract.consumerRules.intelligence.businessHoursConsumptionAuthorized === true, "Data runtime contract must authorize Intelligence hours consumption.", failures);
  assert(runtimeContract.consumerRules.intelligence.businessHoursAuthorizedConsumerContractId === contract.authorizationMetadata.authorizedConsumerContractId, "Data runtime contract authorized consumer mismatch.", failures);
  assert(runtimeContract.consumerRules.intelligence.businessHoursDataMutationAllowed === false, "Data runtime contract must prohibit Intelligence Data mutation.", failures);
}

function validateDataRuntimeArtifactContract(contract, routeDataContract, failures) {
  const pathGroups = [
    "canonicalRuntimeArtifacts",
    "canonicalRouteQualityArtifacts",
    "canonicalPoolSegmentationArtifacts",
    "canonicalGovernanceOverrideArtifacts",
    "canonicalAssignedLeadArtifacts",
    "canonicalRuntimeEligibilityArtifacts",
    "canonicalEvidenceAndProvenanceArtifacts",
    "canonicalBusinessHoursArtifacts",
    "deployMirrorArtifacts"
  ];

  validateReferencedPaths(
    Object.fromEntries(flattenContractPathGroups(contract, pathGroups).map(path => [path, path])),
    "Data runtime artifact contract",
    failures
  );

  for (const [key, path] of Object.entries(routeDataContract.canonicalDataPaths || {})) {
    if (key === "activePool") ensurePathRegistered(path, contract, pathGroups, failures);
    if (key === "runtimePools") ensurePathRegistered(path, contract, pathGroups, failures);
    if (key === "routeQualityReport") ensurePathRegistered(path, contract, pathGroups, failures);
    if (key === "runtimeGovernanceOverrides") ensurePathRegistered(path, contract, pathGroups, failures);
  }

  const activePool = readJson(contract.canonicalRuntimeArtifacts.activePool);
  const reservePool = readJson(contract.canonicalRuntimeArtifacts.reservePool);
  const quarantinePool = readJson(contract.canonicalRuntimeArtifacts.quarantinePool);
  const runtimePools = readJson(contract.canonicalRuntimeArtifacts.runtimePools);
  const routeQualityReport = readJson(contract.canonicalRouteQualityArtifacts.routeQualityReport);
  const manifest = readJson(contract.canonicalPoolSegmentationArtifacts.runtimePoolManifest);
  const governanceReport = readJson(contract.canonicalPoolSegmentationArtifacts.governanceReport);
  const promotionGate = readJson(contract.canonicalPoolSegmentationArtifacts.promotionGate);
  const overrides = readJson(contract.canonicalGovernanceOverrideArtifacts.runtimeGovernanceOverrides);
  const qualityReport = readJson(contract.canonicalRuntimeEligibilityArtifacts.qualityReport);
  const productionDataset = readJson(contract.canonicalEvidenceAndProvenanceArtifacts.productionDatasetJson);

  assert(contract.owningSubsystem === "Prometheus Data", "Data runtime artifact contract must be Data-owned.", failures);
  assert(contract.workspaceId === "fitness_connection", "Data runtime artifact contract workspace mismatch.", failures);
  assert(contract.operatingProfileId === "fitness", "Data runtime artifact contract operating profile mismatch.", failures);

  assert(activePool.pool === "active", "Data contract Active Pool path must point to the active pool.", failures);
  assert(activePool.count === contract.expectedRuntimeMetrics.activePoolRecords, "Data contract Active Pool count mismatch.", failures);
  assert(reservePool.pool === "reserve", "Data contract Reserve Pool path must point to reserve pool.", failures);
  assert(reservePool.count === contract.expectedRuntimeMetrics.reservePoolRecords, "Data contract Reserve Pool count mismatch.", failures);
  assert(quarantinePool.pool === "quarantine", "Data contract Quarantine Pool path must point to quarantine pool.", failures);
  assert(quarantinePool.count === contract.expectedRuntimeMetrics.quarantinePoolRecords, "Data contract Quarantine Pool count mismatch.", failures);

  assert(activePool.sourceDatasetVersion === contract.expectedRuntimeMetrics.requiredDatasetVersion, "Active Pool dataset version mismatch.", failures);
  assert(activePool.segmentationVersion === contract.expectedRuntimeMetrics.requiredSegmentationVersion, "Active Pool segmentation version mismatch.", failures);
  assert(runtimePools.dataset_version === contract.expectedRuntimeMetrics.requiredDatasetVersion, "Runtime pools dataset version mismatch.", failures);
  assert(manifest.counts?.active === contract.expectedRuntimeMetrics.activePoolRecords, "Segmentation manifest Active count mismatch.", failures);
  assert(manifest.counts?.reserve === contract.expectedRuntimeMetrics.reservePoolRecords, "Segmentation manifest Reserve count mismatch.", failures);
  assert(manifest.counts?.quarantine === contract.expectedRuntimeMetrics.quarantinePoolRecords, "Segmentation manifest Quarantine count mismatch.", failures);

  const activePlaceIds = activePool.records.map(record => record.googlePlaceId).filter(Boolean);
  assert(activePlaceIds.length === activePool.records.length, "Active Pool must have Google Place IDs for every record.", failures);
  assert(new Set(activePlaceIds).size === activePlaceIds.length, "Active Pool must not contain duplicate Google Place IDs.", failures);
  assert(
    activePool.records.every(record => /\d+/.test(record.address || "")),
    "Active Pool records must have numbered addresses.",
    failures
  );
  assert(
    activePool.records.every(record => String(record.googleMapsUrl || "").startsWith("https://maps.google.com/")),
    "Active Pool records must use safe Google Maps links.",
    failures
  );
  assert(
    activePool.records.every(record => record.poolAssignmentReasons?.includes("highest_quality_verified_runtime_candidate")),
    "Active Pool records must expose runtime eligibility reasons.",
    failures
  );
  assert(
    activePool.records.some(record => record.runtimeProfiles?.some(profile => profile.repProfileId === "anthony")),
    "Active Pool must preserve Anthony assigned runtime profiles.",
    failures
  );
  assert(Array.isArray(runtimePools.cruz) && runtimePools.cruz.length > 0, "Runtime pools must include founder runtime leads.", failures);
  assert(Array.isArray(runtimePools.anthony) && runtimePools.anthony.length > 0, "Runtime pools must include Anthony runtime leads.", failures);

  assert(routeQualityReport.status === "passed", "Route-quality artifact must be passed.", failures);
  assert(routeQualityReport.dataset?.activePoolRecords === contract.expectedRuntimeMetrics.activePoolRecords, "Route-quality Active count mismatch.", failures);
  assert(routeQualityReport.dataset?.expandedDashboardRouteRecords === contract.expectedRuntimeMetrics.expandedDashboardRouteRecords, "Route-quality expanded Dashboard count mismatch.", failures);
  assert(governanceReport.status === "passed", "Governance report must pass.", failures);
  assert(governanceReport.promotionAllowed === true, "Governance report must allow promotion.", failures);
  assert(promotionGate.status === "passed", "Promotion gate must pass.", failures);
  assert(promotionGate.promotionAllowed === true, "Promotion gate must allow promotion.", failures);

  const residentialOverride = overrides.residentialHouseAddressBlocks?.find(block => block.address === "10820 Hughes Rd, Houston, TX 77089, USA");
  assert(Boolean(residentialOverride), "Governance overrides must preserve the residential-house barber block.", failures);
  assert(residentialOverride?.governanceAction === "quarantine", "Residential-house override must quarantine affected records.", failures);
  assert(
    residentialOverride?.googlePlaceIds?.every(placeId => !activePlaceIds.includes(placeId)),
    "Residential-house override Place IDs must not be in Active Pool.",
    failures
  );

  assert(qualityReport.quality?.final_production_candidate_count === productionDataset.production_candidates?.length, "Quality report must match production dataset count.", failures);
  assert(productionDataset.dataset_version === contract.expectedRuntimeMetrics.requiredDatasetVersion, "Production dataset version mismatch.", failures);
  assert(activePool.runtimeBehaviorChanged === false, "Active Pool runtime behavior flag must remain stable.", failures);
  assert(activePool.scoringChanged === false, "Active Pool scoring flag must remain stable.", failures);
  assert(manifest.verification?.runtimeBehaviorChanged === false, "Segmentation manifest runtime behavior flag must remain stable.", failures);
  assert(manifest.verification?.scoringChanged === false, "Segmentation manifest scoring flag must remain stable.", failures);

  assert(contract.consumerRules.dashboard.mayReadOnlyApprovedDataArtifacts === true, "Dashboard must read only approved Data artifacts.", failures);
  assert(contract.consumerRules.dashboard.mayWriteDataArtifacts === false, "Dashboard must not write Data artifacts.", failures);
  assert(contract.consumerRules.crm.mayConsumeAssignedLeadArtifactsOnlyThroughContract === true, "CRM may consume assigned leads only through contract.", failures);
  assert(contract.consumerRules.crm.mayReadActivePoolDirectly === false, "CRM direct Active Pool read must remain blocked.", failures);
  assert(contract.consumerRules.intelligence.mayInterpretOnlyThroughApprovedReadPaths === true, "Intelligence must use approved Data read paths.", failures);
  assert(contract.consumerRules.intelligence.mayChangeScoring === false, "Intelligence must not change scoring through Data contract.", failures);
  assert(contract.consumerRules.mobile.mayConsumeOnlyRoleWorkspaceScopedLeadArtifacts === true, "Mobile must be role/workspace scoped.", failures);
  assert(contract.consumerRules.mobile.mayReadSmoothieDepotCandidateData === false, "Mobile must not read Smoothie Depot candidate data through Fitness contract.", failures);

  assert(contract.workspaceIsolationRules.smoothieDepotMayConsumeFitnessActivePoolData === false, "Smoothie Depot must not consume Fitness Active Pool data.", failures);
  assert(contract.workspaceIsolationRules.fitnessConnectionMayConsumeSmoothieDepotFranchiseCandidateData === false, "Fitness must not consume Smoothie Depot franchise candidate data.", failures);
  assert(contract.workspaceIsolationRules.fixtureDataAllowedInProduction === false, "Production fixture data must remain prohibited.", failures);
  assert(contract.workspaceIsolationRules.missingArtifactFailsClosed === true, "Missing Data artifacts must fail closed.", failures);
  validateBusinessHoursDataContract(readJson(contract.canonicalBusinessHoursArtifacts.businessHoursDataContract), contract, failures);
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

function validateSocialMediaArtifactContract(workspace, failures) {
  const artifactId = `${workspace.workspaceId}_social_media_artifact_contract`;
  const artifact = workspace.canonicalArtifacts.find(candidate => candidate.artifactId === artifactId);

  assert(Boolean(artifact), `${workspace.workspaceId} missing Social Media artifact contract.`, failures);
  assert(artifact?.ownerSubsystem === "Prometheus Social Media", `${artifactId} must be Social Media-owned.`, failures);
  assert(artifact?.schema === "SocialMediaAnalyticsAttributionArtifactContractV1", `${artifactId} schema mismatch.`, failures);
  assert(artifact?.readAllowed?.includes("Prometheus Website"), `${artifactId} must allow Website reads.`, failures);
  assert(artifact?.readAllowed?.includes("Prometheus CRM"), `${artifactId} must allow CRM reads.`, failures);
  assert(artifact?.readAllowed?.includes("Prometheus Dashboard"), `${artifactId} must allow Dashboard reads.`, failures);
  assert(artifact?.readAllowed?.includes("Prometheus Research"), `${artifactId} must allow Research reads.`, failures);
  assert(artifact?.failClosedIfMissing === true, `${artifactId} must fail closed if missing.`, failures);

  if (!artifact?.path || !exists(artifact.path)) return;

  const contract = readJson(artifact.path);
  const worker = read("workers/prometheus-iq-worker.js");
  const reportView = read(contract.canonicalSocialMediaPaths.instagramReportingView);
  const socialContract = read(contract.canonicalSocialMediaPaths.socialMediaContract);

  assert(contract.owningSubsystem === "Prometheus Social Media", `${artifactId} contract must be Social Media-owned.`, failures);
  assert(contract.workspaceId === workspace.workspaceId, `${artifactId} workspace mismatch.`, failures);
  assert(contract.operatingProfileId === workspace.operatingProfileId, `${artifactId} operating profile mismatch.`, failures);
  assert(contract.status === "active", `${artifactId} contract must be active.`, failures);

  validateReferencedPaths(contract.canonicalSocialMediaPaths, `${artifactId} Social Media paths`, failures);
  validateReferencedPaths(contract.canonicalCampaignArtifactPaths, `${artifactId} campaign paths`, failures);
  validateReferencedPaths(contract.canonicalContentCalendarArtifactPaths, `${artifactId} content calendar paths`, failures);
  validateReferencedPaths(contract.canonicalWebsiteAttributionPaths, `${artifactId} Website attribution paths`, failures);
  validateReferencedPaths(contract.canonicalCrmAttributionHandoffPaths, `${artifactId} CRM attribution handoff paths`, failures);

  assert(
    contract.canonicalRouteArtifacts.socialAccountSnapshot.path === "/api/social/instagram/snapshot",
    `${artifactId} must register the Instagram account snapshot route.`,
    failures
  );
  assert(
    contract.canonicalRouteArtifacts.instagramReport.path === "/api/social/instagram/report",
    `${artifactId} must register the Instagram report route.`,
    failures
  );
  assert(
    contract.canonicalRouteArtifacts.socialAccountSnapshot.failClosedIfMissing === true,
    `${artifactId} snapshot route must fail closed if missing.`,
    failures
  );
  assert(
    contract.canonicalRouteArtifacts.instagramReport.failClosedIfMissing === true,
    `${artifactId} report route must fail closed if missing.`,
    failures
  );
  assert(worker.includes('"/api/social/instagram/snapshot"'), `${artifactId} Worker must expose snapshot path constant.`, failures);
  assert(worker.includes('"/api/social/instagram/report"'), `${artifactId} Worker must expose report path constant.`, failures);
  assert(
    reportView.includes("founder-instagram-analytics-reporting-view.v1"),
    `${artifactId} report view must expose canonical report version.`,
    failures
  );
  assert(reportView.includes("Prometheus Social Media"), `${artifactId} report view must label Social Media source.`, failures);
  assert(reportView.includes("Prometheus Website"), `${artifactId} report view must label Website source.`, failures);
  assert(reportView.includes("Prometheus CRM"), `${artifactId} report view must label CRM source.`, failures);
  assert(socialContract.includes("SOCIAL_MEDIA_CONTRACT_VERSION"), `${artifactId} Social Media contract version missing.`, failures);

  for (const source of ["Prometheus Social Media", "Prometheus Website", "Prometheus CRM"]) {
    assert(
      contract.attributionFlow.requiredMetricSources.includes(source),
      `${artifactId} attribution flow missing metric source: ${source}.`,
      failures
    );
  }

  assert(contract.attributionFlow.missingArtifactsFailClosed === true, `${artifactId} attribution flow must fail closed.`, failures);
  assert(contract.leadSourceProvenanceMetadata.requiredFields.includes("workspace_id"), `${artifactId} lead provenance must require workspace_id.`, failures);
  assert(contract.leadSourceProvenanceMetadata.requiredFields.includes("source_report_version"), `${artifactId} lead provenance must require source_report_version.`, failures);
  assert(contract.leadSourceProvenanceMetadata.sourceSubsystemMustBe === "Prometheus Social Media", `${artifactId} lead provenance source mismatch.`, failures);
  assert(contract.leadSourceProvenanceMetadata.sensitiveFieldsProhibited.includes("token"), `${artifactId} must prohibit token provenance fields.`, failures);

  assert(contract.workspaceIsolationRules.requiredWorkspaceId === workspace.workspaceId, `${artifactId} isolation workspace mismatch.`, failures);
  assert(contract.workspaceIsolationRules.requiredOperatingProfileId === workspace.operatingProfileId, `${artifactId} isolation operating profile mismatch.`, failures);
  assert(contract.workspaceIsolationRules.crossWorkspaceAttributionAllowed === false, `${artifactId} must block cross-workspace attribution.`, failures);
  assert(contract.workspaceIsolationRules.globalCustomerStateAllowed === false, `${artifactId} must block global customer state.`, failures);
  assert(contract.workspaceIsolationRules.fixtureDataAllowedInProduction === false, `${artifactId} must block production fixture data.`, failures);
  assert(contract.workspaceIsolationRules.missingArtifactFailsClosed === true, `${artifactId} isolation must fail closed.`, failures);

  assert(contract.productionRules.noFakeSocialMetricsInProduction === true, `${artifactId} must block fake production social metrics.`, failures);
  assert(contract.productionRules.sampleAnalyticsFixtureProductionConsumer === false, `${artifactId} sample analytics fixture must not be production-consumable.`, failures);
  assert(contract.productionRules.providerMetricsMustComeFromSupportedApisOnly === true, `${artifactId} must require supported provider APIs.`, failures);
  assert(contract.productionRules.unsupportedScrapingAllowed === false, `${artifactId} must prohibit unsupported scraping.`, failures);
  assert(contract.productionRules.browserAutomationAllowed === false, `${artifactId} must prohibit browser automation.`, failures);
  assert(contract.productionRules.livePostingAllowed === false, `${artifactId} must prohibit live posting.`, failures);
  assert(contract.productionRules.tokensMayBeReturnedToConsumers === false, `${artifactId} must prohibit token returns.`, failures);

  assert(contract.consumerRules.website.mayConsumeAttributionMetadataOnlyThroughContract === true, `${artifactId} Website consumer rule missing.`, failures);
  assert(contract.consumerRules.website.mayReadRawProviderOutputs === false, `${artifactId} Website raw provider reads must be blocked.`, failures);
  assert(contract.consumerRules.website.allowedWritePaths.includes("deploy/prometheusrouteiq-website/website-attribution.js"), `${artifactId} Website attribution path not registered.`, failures);
  assert(contract.consumerRules.crm.mayConsumeLeadSourceAttributionOnlyThroughContract === true, `${artifactId} CRM consumer rule missing.`, failures);
  assert(contract.consumerRules.crm.mustRejectCrossWorkspaceAttribution === true, `${artifactId} CRM must reject cross-workspace attribution.`, failures);
  assert(contract.consumerRules.crm.allowedWritePaths.includes("crm/crm-foundation.mjs"), `${artifactId} CRM attribution handoff path not registered.`, failures);
  assert(contract.consumerRules.dashboard.mayDisplayAnalyticsOnlyFromCanonicalReports === true, `${artifactId} Dashboard must consume canonical reports only.`, failures);
  assert(contract.consumerRules.dashboard.allowedReadRoutes.includes("/api/social/instagram/report"), `${artifactId} Dashboard report route missing.`, failures);
  assert(contract.consumerRules.dashboard.mayInventMissingMetrics === false, `${artifactId} Dashboard must not invent metrics.`, failures);
  assert(contract.consumerRules.research.mayCiteCanonicalReportsOnly === true, `${artifactId} Research must cite canonical reports only.`, failures);
  assert(contract.consumerRules.research.mayRecalculateProductionSocialMetrics === false, `${artifactId} Research must not recalculate production social metrics.`, failures);
  assert(contract.consumerRules.overwatch.mustVerifyWorkspaceIsolation === true, `${artifactId} Overwatch workspace isolation rule missing.`, failures);
}

function validateAdministrationOperatingArtifactContract(workspace, failures) {
  const artifacts = Object.fromEntries(workspace.canonicalArtifacts.map(artifact => [artifact.artifactId, artifact]));
  const artifact = artifacts.smoothie_depot_administration_operating_artifact_contract;
  const contract = readJson(artifact.path);
  const requiredArtifactTypes = [
    "founder_operating_manual",
    "workspace_operating_manual",
    "daily_checklist",
    "release_signoff_register",
    "founder_readiness_review",
    "field_feedback_artifact",
    "founder_action_plan",
    "launch_operations_record",
    "go_no_go_readiness_artifact",
    "post_call_aar_decision_journal_handoff"
  ];
  const registeredTypes = Object.values(contract.artifactContracts || {}).map(record => record.artifactType);

  assert(artifact.ownerSubsystem === "Prometheus Administration", "Administration artifact contract must be Administration-owned.", failures);
  assert(artifact.schema === "AdministrationOperatingArtifactContractV1", "Administration artifact contract schema mismatch.", failures);
  assert(artifact.readAllowed.includes("Prometheus Dashboard"), "Administration contract must allow Dashboard read boundary.", failures);
  assert(artifact.readAllowed.includes("Prometheus CRM"), "Administration contract must allow CRM read boundary.", failures);
  assert(artifact.readAllowed.includes("Prometheus Intelligence Engine"), "Administration contract must allow Intelligence read boundary.", failures);
  assert(contract.status === "active", "Administration operating artifact contract must be active.", failures);
  assert(contract.owningSubsystem === "Prometheus Administration", "Administration operating artifact contract owner mismatch.", failures);
  assert(contract.workspaceId === workspace.workspaceId, "Administration operating artifact contract workspace mismatch.", failures);
  assert(contract.operatingProfileId === workspace.operatingProfileId, "Administration operating artifact contract operating profile mismatch.", failures);

  for (const artifactType of requiredArtifactTypes) {
    assert(registeredTypes.includes(artifactType), `Administration contract missing artifact type: ${artifactType}`, failures);
  }

  for (const [sectionName, section] of Object.entries(contract.artifactContracts || {})) {
    for (const artifactPath of Object.values(section.canonicalPaths || {})) {
      assert(exists(artifactPath), `Administration ${sectionName} referenced path does not exist: ${artifactPath}`, failures);
    }
    if (section.canonicalPaths) {
      assert(section.failClosedIfMissing === true, `Administration ${sectionName} must fail closed on missing canonical paths.`, failures);
    } else {
      assert(Boolean(section.canonicalPathPattern), `Administration ${sectionName} missing canonical path pattern.`, failures);
      assert(section.missingWorkspaceInstanceBehavior === "fail_closed", `Administration ${sectionName} must fail closed for missing workspace instances.`, failures);
      assert(section.fixtureDemoOperationsDataAllowedInProduction === false, `Administration ${sectionName} must block production fixture/demo operations data.`, failures);
    }
  }

  const smoothieRegistration = contract.workspaceRegistrations?.smoothie_depot;
  assert(smoothieRegistration?.status === "registered", "Smoothie Depot Administration artifacts must be registered.", failures);
  assert(
    smoothieRegistration?.registeredArtifacts?.includes("founder_operating_manual"),
    "Smoothie Depot founder operating manual must be registered.",
    failures
  );
  assert(
    smoothieRegistration?.registeredArtifacts?.includes("field_feedback_artifact"),
    "Smoothie Depot field-feedback artifacts must be registered.",
    failures
  );
  assert(
    smoothieRegistration?.futureArtifactContractsDefined?.includes("post_call_aar_decision_journal_handoff"),
    "Smoothie Depot AAR / decision-journal handoff contract must be defined.",
    failures
  );

  const fitnessRegistration = contract.workspaceRegistrations?.fitness_connection;
  assert(fitnessRegistration?.status === "registered_if_present", "Fitness Connection Administration registration must be conditional.", failures);
  assert(
    fitnessRegistration?.currentAdministrationArtifactsPresent === exists(fitnessRegistration.artifactDiscoveryPath),
    "Fitness Connection Administration artifact presence must match the workspace discovery path.",
    failures
  );
  assert(
    fitnessRegistration?.requiredBehaviorIfArtifactsAppear === "register_in_this_contract_before_cross_subsystem_consumption",
    "Fitness Connection Administration artifacts must require registration before consumption.",
    failures
  );

  assert(contract.consumerRules.dashboard.mayDisplayOperatingManualsReadOnly === true, "Dashboard must display Administration manuals read-only.", failures);
  assert(contract.consumerRules.dashboard.allowedReadPaths.includes("administration/workspaces/smoothie-depot/founder-operating-manual-v1.md"), "Dashboard manual read path missing from Administration contract.", failures);
  assert(contract.consumerRules.dashboard.mayWriteAdministrationArtifacts === false, "Dashboard must not write Administration artifacts.", failures);
  assert(contract.consumerRules.dashboard.mustFailClosedOnMissingArtifact === true, "Dashboard must fail closed on missing Administration artifacts.", failures);

  assert(contract.consumerRules.crm.mayConsumeFieldFeedbackOnlyThroughContract === true, "CRM field-feedback contract rule missing.", failures);
  assert(contract.consumerRules.crm.allowedReadPaths.includes("administration/registers/stabilization-issues.json"), "CRM field-feedback path missing from Administration contract.", failures);
  assert(contract.consumerRules.crm.mayConsumeOperatingManualsDirectly === false, "CRM must not consume operating manuals directly.", failures);
  assert(contract.consumerRules.crm.mustRejectCrossWorkspaceFeedback === true, "CRM must reject cross-workspace Administration feedback.", failures);

  assert(contract.consumerRules.intelligence.mayConsumeDecisionJournalAarOnlyThroughContract === true, "Intelligence AAR contract rule missing.", failures);
  assert(
    contract.consumerRules.intelligence.allowedPathPattern === "administration/workspaces/{workspace-slug}/decision-journal/{yyyy-mm-dd}-{handoff-id}.json",
    "Intelligence AAR path pattern missing from Administration contract.",
    failures
  );
  assert(contract.consumerRules.intelligence.mustRejectCrossWorkspaceDecisionJournal === true, "Intelligence must reject cross-workspace decision journals.", failures);
  assert(contract.consumerRules.overwatch.mustVerifyFixtureDemoOperationsDataProhibited === true, "Overwatch must verify fixture/demo operations prohibition.", failures);

  assert(contract.workspaceIsolationRules.noWorkspaceMayConsumeAnotherWorkspaceOperatingRecords === true, "Administration contract must prohibit cross-workspace operating records.", failures);
  assert(contract.workspaceIsolationRules.crossWorkspaceOperatingRecordAccessAllowed === false, "Administration contract must block cross-workspace operating record access.", failures);
  assert(contract.workspaceIsolationRules.fixtureDataAllowedInProduction === false, "Administration contract must block production fixture data.", failures);
  assert(contract.workspaceIsolationRules.missingArtifactFailsClosed === true, "Administration contract must fail closed on missing artifacts.", failures);
  assert(contract.productionRules.fixtureDemoOperationsDataProhibitedInProduction === true, "Administration production rules must prohibit fixture/demo operations data.", failures);
  assert(contract.productionRules.productRuntimeMutationAllowed === false, "Administration contract must not authorize product runtime mutation.", failures);
}

function validateFitnessConnectionWorkspaceContract(workspace, failures) {
  const artifacts = Object.fromEntries(workspace.canonicalArtifacts.map(artifact => [artifact.artifactId, artifact]));
  const identity = readJson(artifacts.fitness_connection_workspace_identity_contract.path);
  const dashboardContract = readJson(artifacts.fitness_connection_dashboard_consumer_contract.path);
  const routeDataContract = readJson(artifacts.fitness_connection_route_intelligence_data_contract.path);
  const dataRuntimeArtifactContract = readJson(artifacts.fitness_connection_data_runtime_artifact_contract.path);
  const crmContract = readJson(artifacts.fitness_connection_crm_consumer_contract.path);
  const intelligenceContract = readJson(artifacts.fitness_connection_intelligence_consumer_contract.path);
  const dashboardSource = read(artifacts.fitness_connection_dashboard_source.path);
  const dashboardDeploy = read(artifacts.fitness_connection_dashboard_deploy_asset.path);
  const activePool = readJson(routeDataContract.canonicalDataPaths.activePool);
  const runtimePools = readJson(routeDataContract.canonicalDataPaths.runtimePools);
  const routeQualityReport = readJson(routeDataContract.canonicalDataPaths.routeQualityReport);
  const crmFoundation = [
    read(crmContract.canonicalCrmPaths.crmFoundation),
    read("crm/workspace-lead-persistence.mjs")
  ].join("\n");
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
  validateReferencedPaths(routeDataContract.canonicalContractPaths, "Fitness route/data contract", failures);
  validateReferencedPaths(routeDataContract.canonicalAssignedLeadPaths, "Fitness route/data contract", failures);
  validateDataRuntimeArtifactContract(dataRuntimeArtifactContract, routeDataContract, failures);
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
  assert(workspace.consumerContracts.mobile.mayConsumeOnlyRoleWorkspaceScopedLeadArtifacts === true, "Fitness Mobile consumer contract must require role/workspace-scoped lead artifacts.", failures);
  assert(workspace.consumerContracts.mobile.mustNotUseSmoothieDepotData === true, "Fitness Mobile consumer contract must block Smoothie Depot data.", failures);
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
  const administrationAudit = auditedSubsystems.get("Prometheus Administration");
  const dataAudit = auditedSubsystems.get("Prometheus Data");
  const socialMediaAudit = auditedSubsystems.get("Prometheus Social Media");
  const companionAudit = auditedSubsystems.get("Prometheus Companion");
  assert(companionAudit?.status === "quarantined_dormant_maintenance_only", "Companion must remain marked quarantined/dormant while Founder quarantine is active.", failures);
  assert(companionAudit?.founderReactivationRequired === true, "Companion quarantine must require explicit Founder reactivation.", failures);
  assert(companionAudit?.bypassIdentified === false, "Companion quarantine must not appear as an active contract-layer bypass.", failures);
  assert(
    administrationAudit?.status === "compliant_for_operating_artifact_contracts",
    "Administration operating artifact contract bypass must be closed.",
    failures
  );
  assert(administrationAudit?.bypassIdentified === false, "Administration operating artifact contract must not remain bypass-identified.", failures);
  assert(
    administrationAudit?.evidence?.some(item => item.includes("overwatch/artifact-contracts/administration/administration-operating-artifact-contract-v1.json")),
    "Administration audit must reference the Administration operating artifact contract.",
    failures
  );
  assert(dataAudit?.status === "compliant_for_runtime_artifact_contracts", "Data runtime artifact contract bypass must be closed.", failures);
  assert(dataAudit?.bypassIdentified === false, "Data runtime artifact contract must not remain bypass-identified.", failures);
  assert(
    dataAudit?.evidence?.some(item => item.includes("overwatch/artifact-contracts/data/fitness-connection-runtime-artifact-contract-v1.json")),
    "Data audit must reference the Fitness runtime artifact contract.",
    failures
  );
  assert(infrastructureAudit?.bypassIdentified === false, "Infrastructure shared lead-intake contract bypass must be closed.", failures);
  assert(
    infrastructureAudit?.evidence?.some(item => item.includes("integrations/shared-workspace-lead-intake-contract.js")),
    "Infrastructure audit must reference the shared lead-intake contract.",
    failures
  );
  assert(
    socialMediaAudit?.status === "compliant_for_social_media_artifact_contracts",
    "Social Media artifact contract bypass must be closed.",
    failures
  );
  assert(socialMediaAudit?.bypassIdentified === false, "Social Media artifact contract must not remain bypass-identified.", failures);
  assert(
    socialMediaAudit?.evidence?.some(item => item.includes("overwatch/artifact-contracts/social-media/smoothie-depot-social-media-artifact-contract-v1.json")),
    "Social Media audit must reference the Smoothie Depot Social Media artifact contract.",
    failures
  );
  assert(
    socialMediaAudit?.evidence?.some(item => item.includes("overwatch/artifact-contracts/social-media/fitness-connection-social-media-artifact-contract-v1.json")),
    "Social Media audit must reference the Fitness Connection Social Media artifact contract.",
    failures
  );

  const firstRemediation = audit.globalRemediationOrder?.find(item => item.priority === 1);
  assert(firstRemediation?.owner === "Prometheus Sales", "Priority 1 remediation must move to Sales after Administration registration.", failures);
  assert(
    firstRemediation?.task?.includes("Sales consumer contract"),
    "Priority 1 remediation must register the Sales consumer contract after Administration registration.",
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
      validateSocialMediaArtifactContract(workspace, failures);
      validateAdministrationOperatingArtifactContract(workspace, failures);

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
      validateSocialMediaArtifactContract(workspace, failures);
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
