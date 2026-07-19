import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const defaultRepoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

export const routeIqCommercialProductPaths = Object.freeze({
  contract: "docs/route-iq-commercial-product-contract-v1.json",
  workspaceRegistry: "data/route-iq-commercial-readiness-v1/route-iq-commercial-workspace-registry-v1.json",
  evidencePreservation: "data/route-iq-commercial-readiness-v1/fitness-connection-evidence-preservation-v1.json",
  intelligenceContract: "intelligence/contracts/route-iq-commercial-readiness-intelligence-v1.json",
  crmContract: "crm/route-iq-request-crm-contract-v1.json"
});

export const routeIqCommercialRuntimePaths = Object.freeze({
  dashboardSource: "index.html",
  dashboardDeploySource: "deploy/cloudflare-pages/index.html",
  dashboardVerifier: "scripts/verify-dashboard-runtime-workflows.mjs",
  dashboardTest: "tests/dashboard-route-iq-product-focus.test.mjs",
  intelligenceModule: "intelligence/route-iq-daily-intelligence-snapshot.mjs",
  intelligenceArtifact: "intelligence/artifacts/route-iq-commercial-readiness-v1/fitness_connection/founder-daily-intelligence-snapshot-v1.json",
  infrastructureWorker: "workers/prometheus-iq-worker.js",
  capacityHarness: "workers/infrastructure/route-iq-commercial-capacity-harness.mjs",
  capacityRuntimeContract: "workers/infrastructure/route-iq-request-crm-runtime-v1.json",
  rollbackGovernance: "overwatch/governance/verified-engineering-batch-auto-push-v1.json",
  rollbackProcedure: "docs/route-iq-forward-compatible-rollback-v1.md",
  rollbackCandidate: "workers/infrastructure/route-iq-forward-rollback-candidate-v1.json"
});

const founderDailySnapshotEndpoint = "/api/dashboard/route-iq/intelligence/daily-snapshot";

export class RouteIqCommercialProductContractError extends Error {
  constructor(code, detail) {
    super(`${code}: ${detail}`);
    this.name = "RouteIqCommercialProductContractError";
    this.code = code;
  }
}

function fail(code, detail) {
  throw new RouteIqCommercialProductContractError(code, detail);
}

function readJson(repoRoot, path) {
  try {
    return JSON.parse(readFileSync(resolve(repoRoot, path), "utf8"));
  } catch (error) {
    fail("route_iq_product_owner_artifact_missing_or_invalid", `${path}: ${error.code ?? error.message}`);
  }
}

function readText(repoRoot, path) {
  try {
    return readFileSync(resolve(repoRoot, path), "utf8");
  } catch (error) {
    fail("route_iq_product_required_surface_missing", `${path}: ${error.code ?? error.message}`);
  }
}

function requireValue(condition, code, detail) {
  if (!condition) fail(code, detail);
}

function requireExact(actual, expected, code, detail) {
  requireValue(actual === expected, code, `${detail}; expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
}

function requireStringArray(value, code, detail) {
  requireValue(Array.isArray(value) && value.length > 0, code, detail);
  requireValue(value.every(item => typeof item === "string" && item.length > 0), code, `${detail}; all entries must be nonempty strings`);
}

function requireIncludes(value, required, code, detail) {
  requireStringArray(value, code, detail);
  for (const item of required) {
    requireValue(value.includes(item), code, `${detail}; missing ${item}`);
  }
}

function workspaceById(registry, workspaceId) {
  const workspace = registry.workspaces?.find(item => item.workspaceId === workspaceId);
  requireValue(workspace, "route_iq_product_workspace_boundary_missing", workspaceId);
  return workspace;
}

export function loadRouteIqCommercialProductArtifacts({ repoRoot = defaultRepoRoot } = {}) {
  return Object.fromEntries(
    Object.entries(routeIqCommercialProductPaths).map(([key, path]) => [key, readJson(repoRoot, path)])
  );
}

export function validateRouteIqCommercialProductContract(artifacts) {
  requireValue(artifacts && typeof artifacts === "object", "route_iq_product_artifacts_required", "artifact set is required");
  const { contract, workspaceRegistry, evidencePreservation, intelligenceContract, crmContract } = artifacts;
  for (const [name, value] of Object.entries({ contract, workspaceRegistry, evidencePreservation, intelligenceContract, crmContract })) {
    requireValue(value && typeof value === "object" && !Array.isArray(value), "route_iq_product_owner_artifact_invalid", name);
  }

  requireExact(contract.contractVersion, "route-iq-commercial-product-contract-v1", "route_iq_product_contract_version_invalid", "contract version");
  requireExact(contract.batchId, "BATCH-20260718-002", "route_iq_product_batch_invalid", "batch ID");
  requireExact(contract.ownerSubsystem, "Prometheus Route IQ", "route_iq_product_owner_invalid", "product contract owner");
  requireExact(contract.productPortfolio?.soleActiveProduct, "route_iq", "route_iq_product_focus_invalid", "sole active product");
  const productStates = new Map(contract.productPortfolio?.products?.map(product => [product.productId, product.state]));
  requireExact(productStates.get("route_iq"), "active", "route_iq_product_focus_invalid", "Route IQ state");
  requireExact(productStates.get("gaia"), "paused", "route_iq_product_focus_invalid", "Gaia state");
  requireExact(productStates.get("athena"), "architecture_only", "route_iq_product_focus_invalid", "Athena state");
  requireValue(
    Array.isArray(contract.productPortfolio?.activeOperationalNavigation)
      && contract.productPortfolio.activeOperationalNavigation.length === 1
      && contract.productPortfolio.activeOperationalNavigation[0] === "route_iq",
    "route_iq_product_navigation_boundary_invalid",
    "Route IQ must be the only active operational navigation product"
  );

  requireExact(contract.commercialArchitecture?.architectureMode, "configuration_driven_shared_route_iq_runtime", "route_iq_product_architecture_invalid", "commercial architecture mode");
  for (const [field, expected] of Object.entries({
    customerSpecificCodeForkAllowed: false,
    separateApplicationPerBusinessAllowed: false,
    workspaceIsolationRequired: true,
    operatingProfileIsolationRequired: true,
    representativeIsolationRequired: true,
    locationAndTerritoryIsolationRequired: true
  })) {
    requireExact(contract.commercialArchitecture?.[field], expected, "route_iq_product_architecture_invalid", field);
  }
  requireIncludes(contract.commercialArchitecture?.configuration?.requiredDimensions, [
    "business_name_and_branding",
    "business_type",
    "locations_and_territories",
    "user_and_representative_roster",
    "roles_and_access",
    "business_goals",
    "visit_and_outcome_terminology",
    "success_measurements",
    "data_retention",
    "intelligence_eligibility"
  ], "route_iq_product_configuration_incomplete", "commercial configuration dimensions");
  requireExact(contract.commercialArchitecture?.syntheticNonFitnessProof?.workspaceId, "summit_roofing_synthetic", "route_iq_product_synthetic_proof_invalid", "synthetic workspace");
  requireExact(contract.commercialArchitecture?.syntheticNonFitnessProof?.codeForkRequired, false, "route_iq_product_synthetic_proof_invalid", "synthetic code-fork boundary");

  const lifecycle = contract.crossSubsystemLifecycle;
  requireValue(Array.isArray(lifecycle) && lifecycle.length === 7, "route_iq_product_lifecycle_incomplete", "seven integration stages are required");
  requireValue(lifecycle.every((stage, index) => stage.order === index + 1), "route_iq_product_lifecycle_order_invalid", "lifecycle order must be contiguous");
  const requiredStages = [
    ["workspace_configuration", "Prometheus Data"],
    ["operational_dashboard", "Prometheus Dashboard"],
    ["append_only_evidence", "Prometheus Data"],
    ["read_only_intelligence", "Prometheus Intelligence Engine"],
    ["governed_codex_delivery", "Prometheus Data"],
    ["public_route_iq_request", "Prometheus Website"],
    ["durable_request_crm", "Prometheus CRM"]
  ];
  for (const [index, [stageName, owner]] of requiredStages.entries()) {
    requireExact(lifecycle[index].stage, stageName, "route_iq_product_lifecycle_stage_invalid", `stage ${index + 1}`);
    requireExact(lifecycle[index].ownerSubsystem, owner, "route_iq_product_lifecycle_owner_invalid", stageName);
    requireStringArray(lifecycle[index].ownerSurfaces, "route_iq_product_lifecycle_surface_missing", stageName);
  }

  const dailySnapshotLifecycle = contract.founderDailySnapshotLifecycle;
  requireExact(
    dailySnapshotLifecycle?.integrationStatus,
    "pending_owner_integration_until_required_surfaces_verify",
    "route_iq_product_daily_snapshot_lifecycle_invalid",
    "daily snapshot integration status"
  );
  requireExact(dailySnapshotLifecycle?.finalVerificationRequiresIntegratedLifecycle, true, "route_iq_product_daily_snapshot_lifecycle_invalid", "daily snapshot final integration gate");
  requireExact(dailySnapshotLifecycle?.finalVerificationFailsWhenRequiredSurfaceIsMissing, true, "route_iq_product_daily_snapshot_lifecycle_invalid", "daily snapshot missing-surface gate");
  requireExact(dailySnapshotLifecycle?.endpoint, founderDailySnapshotEndpoint, "route_iq_product_daily_snapshot_lifecycle_invalid", "daily snapshot endpoint");
  requireExact(dailySnapshotLifecycle?.method, "GET", "route_iq_product_daily_snapshot_lifecycle_invalid", "daily snapshot method");
  requireExact(dailySnapshotLifecycle?.browserPersistenceAllowed, false, "route_iq_product_daily_snapshot_lifecycle_invalid", "daily snapshot browser persistence");
  requireExact(dailySnapshotLifecycle?.representativeAccessAllowed, false, "route_iq_product_daily_snapshot_lifecycle_invalid", "daily snapshot representative access");
  requireExact(dailySnapshotLifecycle?.recommendationInfluence, "OFF", "route_iq_product_daily_snapshot_lifecycle_invalid", "daily snapshot recommendation influence");
  const expectedSnapshotStages = [
    ["deterministic_snapshot_generation", "Prometheus Intelligence Engine"],
    ["canonical_snapshot_artifact", "Prometheus Intelligence Engine"],
    ["server_authenticated_read_only_endpoint", "Prometheus Infrastructure"],
    ["founder_dashboard_read_only_consumer", "Prometheus Dashboard"]
  ];
  requireValue(Array.isArray(dailySnapshotLifecycle?.stages) && dailySnapshotLifecycle.stages.length === expectedSnapshotStages.length, "route_iq_product_daily_snapshot_lifecycle_invalid", "four daily snapshot lifecycle stages are required");
  for (const [index, [stageName, owner]] of expectedSnapshotStages.entries()) {
    const stage = dailySnapshotLifecycle.stages[index];
    requireExact(stage?.order, index + 1, "route_iq_product_daily_snapshot_lifecycle_invalid", `daily snapshot stage ${index + 1} order`);
    requireExact(stage?.stage, stageName, "route_iq_product_daily_snapshot_lifecycle_invalid", `daily snapshot stage ${index + 1}`);
    requireExact(stage?.ownerSubsystem, owner, "route_iq_product_daily_snapshot_lifecycle_invalid", `${stageName} owner`);
    requireStringArray(stage?.surfaces, "route_iq_product_daily_snapshot_lifecycle_invalid", `${stageName} surfaces`);
  }

  requireIncludes(contract.prohibitedCapabilities, [
    "CUSTOMER_SPECIFIC_CODE_FORK",
    "FITNESS_CONNECTION_CUSTOMER_PARTNER_SPONSOR_PILOT_OR_ENDORSEMENT_CLAIM",
    "CROSS_WORKSPACE_ACCESS",
    "FOUNDER_INTELLIGENCE_DISPLAY_NAME_AUTHORIZATION",
    "REPRESENTATIVE_FOUNDER_INTELLIGENCE_ACCESS",
    "RECOMMENDATION_INFLUENCE",
    "PROSPECTIVE_COLLECTION_ACTIVATION",
    "RAW_UNCONTROLLED_CODEX_UPLOAD",
    "HISTORICAL_EVIDENCE_REWRITE",
    "SMOOTHIE_DEPOT_ACTIVE_OPERATION",
    "GAIA_OPERATIONAL_ACTIVATION",
    "ATHENA_OPERATIONAL_ACTIVATION"
  ], "route_iq_product_prohibition_missing", "product prohibitions");
  requireExact(contract.safetyState?.recommendationInfluence, "OFF", "route_iq_product_influence_boundary_invalid", "recommendation influence");
  requireExact(contract.safetyState?.prospectiveCollection, "OFF", "route_iq_product_collection_boundary_invalid", "prospective collection");
  requireExact(contract.safetyState?.activeProspectiveCohorts, 0, "route_iq_product_collection_boundary_invalid", "active prospective cohorts");
  requireExact(contract.safetyState?.representativeFacingShadowOutput, false, "route_iq_product_shadow_boundary_invalid", "representative shadow output");
  requireExact(contract.accessControl?.canonicalIdentitySourceOwner, "Prometheus Data", "route_iq_product_identity_authority_invalid", "canonical identity owner");
  requireExact(contract.accessControl?.canonicalIdentitySourcePath, routeIqCommercialProductPaths.workspaceRegistry, "route_iq_product_identity_authority_invalid", "canonical identity source");
  requireExact(contract.accessControl?.crossConsumerPrincipalEqualityRequired, true, "route_iq_product_identity_authority_invalid", "cross-consumer principal equality");

  const gates = contract.acceptanceGates;
  requireValue(Array.isArray(gates) && gates.length === 15, "route_iq_product_acceptance_mapping_incomplete", "exactly 15 gates are required");
  requireValue(new Set(gates.map(gate => gate.gate)).size === 15, "route_iq_product_acceptance_mapping_duplicate", "gate numbers must be unique");
  for (let gateNumber = 1; gateNumber <= 15; gateNumber += 1) {
    const gate = gates.find(item => item.gate === gateNumber);
    requireValue(gate, "route_iq_product_acceptance_gate_missing", `gate ${gateNumber}`);
    requireStringArray(gate.ownerSubsystems, "route_iq_product_acceptance_owner_missing", `gate ${gateNumber}`);
    requireStringArray(gate.evidenceSurfaces, "route_iq_product_acceptance_surface_missing", `gate ${gateNumber}`);
    requireValue(typeof gate.requirement === "string" && gate.requirement.length > 0, "route_iq_product_acceptance_requirement_missing", `gate ${gateNumber}`);
  }

  requireExact(contract.rollout?.deploymentAuthorizedByBatch, false, "route_iq_product_deployment_boundary_invalid", "batch deployment authorization");
  requireExact(contract.rollout?.founderDeploymentAuthorizationRequired, true, "route_iq_product_deployment_boundary_invalid", "Founder deployment gate");
  requireValue(!Object.hasOwn(contract.rollout ?? {}, "eventualDeploymentTarget"), "route_iq_product_deployment_boundary_invalid", "obsolete single-target deployment assertion is prohibited");
  requireValue(!Object.hasOwn(contract.rollout ?? {}, "publicWorkerExcluded"), "route_iq_product_deployment_boundary_invalid", "obsolete public-Worker exclusion assertion is prohibited");
  requireValue(Array.isArray(contract.rollout?.deploymentScopes) && contract.rollout.deploymentScopes.length === 2, "route_iq_product_deployment_boundary_invalid", "two separately gated deployment scopes are required");
  const deploymentScopes = new Map(contract.rollout.deploymentScopes.map(scope => [scope.scopeId, scope]));
  const privateScope = deploymentScopes.get("private_dashboard_runtime");
  const publicScope = deploymentScopes.get("public_website_crm_runtime");
  requireExact(privateScope?.targetWorker, "prometheus-iq", "route_iq_product_deployment_boundary_invalid", "private Dashboard target");
  requireExact(privateScope?.configurationPath, "wrangler.jsonc", "route_iq_product_deployment_boundary_invalid", "private Dashboard configuration");
  requireExact(publicScope?.targetWorker, "prometheusrouteiq-website", "route_iq_product_deployment_boundary_invalid", "public Website/CRM target");
  requireExact(publicScope?.configurationPath, "wrangler.prometheusrouteiq-website.jsonc", "route_iq_product_deployment_boundary_invalid", "public Website/CRM configuration");
  for (const scope of [privateScope, publicScope]) {
    requireExact(scope?.founderDeploymentAuthorizationRequired, true, "route_iq_product_deployment_boundary_invalid", `${scope?.scopeId ?? "unknown scope"} Founder gate`);
    requireExact(scope?.deploymentAuthorizedNow, false, "route_iq_product_deployment_boundary_invalid", `${scope?.scopeId ?? "unknown scope"} deployment authorization`);
    requireStringArray(scope?.ownerSubsystems, "route_iq_product_deployment_boundary_invalid", `${scope?.scopeId ?? "unknown scope"} owners`);
    requireStringArray(scope?.includes, "route_iq_product_deployment_boundary_invalid", `${scope?.scopeId ?? "unknown scope"} included runtime`);
    requireStringArray(scope?.excludes, "route_iq_product_deployment_boundary_invalid", `${scope?.scopeId ?? "unknown scope"} exclusions`);
  }
  requireExact(contract.rollout?.rollback?.mode, "new_forward_revert_commits_then_separately_founder_authorized_forward_deployment_per_scope", "route_iq_product_rollback_boundary_invalid", "rollback mode");
  requireExact(contract.rollout?.rollback?.sourceProcedure, "create_new_git_revert_commits_in_reverse_dependency_order_and_repeat_exact_tree_verification", "route_iq_product_rollback_boundary_invalid", "source rollback procedure");
  requireExact(contract.rollout?.rollback?.statefulRuntimeProcedure, "preserve_applied_migrations_namespaces_bindings_class_exports_and_existing_state_then_forward_deploy_an_inert_compatible_candidate", "route_iq_product_rollback_boundary_invalid", "stateful rollback procedure");
  requireIncludes(contract.rollout?.rollback?.evidenceSurfaces, [
    routeIqCommercialRuntimePaths.rollbackGovernance,
    routeIqCommercialRuntimePaths.rollbackProcedure,
    routeIqCommercialRuntimePaths.rollbackCandidate,
    routeIqCommercialRuntimePaths.capacityRuntimeContract
  ], "route_iq_product_rollback_boundary_invalid", "rollback evidence surfaces");
  requireExact(contract.rollout?.rollback?.historyRewriteAllowed, false, "route_iq_product_rollback_boundary_invalid", "history rewrite");
  requireExact(contract.rollout?.rollback?.archiveRewriteAllowed, false, "route_iq_product_rollback_boundary_invalid", "archive rewrite");
  requireExact(contract.rollout?.rollback?.preserveExistingEvidence, true, "route_iq_product_rollback_boundary_invalid", "evidence preservation");

  requireExact(workspaceRegistry.schemaVersion, "route-iq-commercial-workspace-v1", "route_iq_product_data_contract_invalid", "workspace schema version");
  requireExact(workspaceRegistry.product, "route_iq", "route_iq_product_data_contract_invalid", "registry product");
  requireExact(workspaceRegistry.activeProduct, true, "route_iq_product_data_contract_invalid", "registry active product");
  requireExact(workspaceRegistry.recommendationInfluence, "OFF", "route_iq_product_data_contract_invalid", "registry recommendation influence");
  requireExact(workspaceRegistry.prospectiveCollection, "OFF", "route_iq_product_data_contract_invalid", "registry prospective collection");

  const fitness = workspaceById(workspaceRegistry, "fitness_connection");
  requireExact(fitness.workspaceState, "active_founder_research", "route_iq_product_fitness_boundary_invalid", "Fitness Connection workspace state");
  requireExact(fitness.business?.relationshipClassification, "FOUNDER_FIELD_RESEARCH", "route_iq_product_fitness_boundary_invalid", "Fitness Connection classification");
  requireExact(fitness.business?.publicRelationshipClaimsAllowed, false, "route_iq_product_fitness_boundary_invalid", "Fitness Connection public claims");
  requireExact(fitness.evidenceGovernance?.historicalEvidenceImmutable, true, "route_iq_product_fitness_boundary_invalid", "Fitness Connection evidence immutability");
  requireExact(fitness.evidenceGovernance?.crossWorkspaceEvidenceAllowed, false, "route_iq_product_fitness_boundary_invalid", "Fitness Connection cross-workspace evidence");
  const cruz = fitness.users?.find(user => user.representativeId === "cruz");
  const anthony = fitness.users?.find(user => user.representativeId === "anthony");
  requireValue(cruz?.identityMappingStatus === "exact_authenticated_identity_mapped" && /^riq_principal_[a-f0-9]{64}$/.test(cruz.authenticatedPrincipalId), "route_iq_product_founder_identity_invalid", "Cruz exact mapping");
  requireExact(contract.accessControl?.founderIntelligence?.cruzCanonicalPrincipalId, cruz.authenticatedPrincipalId, "route_iq_product_identity_authority_invalid", "product canonical Cruz principal");
  requireValue(anthony?.identityMappingStatus === "pending_exact_authenticated_identity" && anthony.authenticatedPrincipalId === null, "route_iq_product_founder_identity_invalid", "Anthony must fail closed until mapped");

  const smoothie = workspaceById(workspaceRegistry, "smoothie_depot");
  requireExact(smoothie.workspaceState, "inactive_historical", "route_iq_product_historical_workspace_invalid", "Smoothie Depot state");
  requireExact(smoothie.normalOperationVisible, false, "route_iq_product_historical_workspace_invalid", "Smoothie Depot normal operation visibility");
  requireExact(smoothie.intelligenceEligibility?.governedEvidenceLearningEligible, false, "route_iq_product_historical_workspace_invalid", "Smoothie Depot learning eligibility");
  requireExact(smoothie.codexEvidence?.bundleAuthorized, false, "route_iq_product_historical_workspace_invalid", "Smoothie Depot Codex eligibility");

  const synthetic = workspaceById(workspaceRegistry, "summit_roofing_synthetic");
  requireExact(synthetic.workspaceState, "synthetic_validation_only", "route_iq_product_synthetic_proof_invalid", "synthetic state");
  requireExact(synthetic.business?.businessType, "roofing_outside_sales", "route_iq_product_synthetic_proof_invalid", "synthetic business type");
  requireExact(synthetic.operatingProfileId, "roofing", "route_iq_product_synthetic_proof_invalid", "synthetic operating profile");
  requireExact(synthetic.productionActivationAuthorized, false, "route_iq_product_synthetic_proof_invalid", "synthetic production activation");
  for (const requiredField of ["business", "locations", "territories", "roles", "users", "goals", "terminology", "successMeasurements", "retention", "intelligenceEligibility"]) {
    requireValue(synthetic[requiredField] !== undefined, "route_iq_product_synthetic_configuration_incomplete", requiredField);
  }

  requireExact(evidencePreservation.classification, "FOUNDER_FIELD_RESEARCH", "route_iq_product_preservation_invalid", "preservation classification");
  requireValue(Array.isArray(evidencePreservation.files) && evidencePreservation.files.length === 9, "route_iq_product_preservation_invalid", "nine Founder evidence files are required");
  for (const [relationship, expected] of Object.entries({ customer: false, partner: false, sponsor: false, committedPilot: false, publicEndorsementClaimAllowed: false })) {
    requireExact(evidencePreservation.relationshipRepresentation?.[relationship], expected, "route_iq_product_relationship_claim_invalid", relationship);
  }
  requireExact(evidencePreservation.invariants?.sourceFilesMayBeRewritten, false, "route_iq_product_preservation_invalid", "source rewrite");
  requireExact(evidencePreservation.invariants?.crossWorkspaceUseAllowed, false, "route_iq_product_preservation_invalid", "cross-workspace evidence use");

  requireExact(intelligenceContract.status, "active_read_only_founder_snapshot", "route_iq_product_intelligence_contract_invalid", "Intelligence status");
  requireExact(intelligenceContract.founderAccess?.displayNameAuthorizationAllowed, false, "route_iq_product_intelligence_contract_invalid", "display-name authorization");
  requireExact(intelligenceContract.founderAccess?.representativeAccessAllowed, false, "route_iq_product_intelligence_contract_invalid", "representative Founder intelligence access");
  requireExact(intelligenceContract.founderAccess?.authorizedMappings?.[0]?.immutablePrincipalId, cruz.authenticatedPrincipalId, "route_iq_product_cross_consumer_principal_drift", "Intelligence Cruz principal must equal canonical Data principal");
  requireExact(intelligenceContract.learningBoundary?.recommendationInfluence, "OFF", "route_iq_product_intelligence_contract_invalid", "Intelligence recommendation influence");
  requireExact(intelligenceContract.learningBoundary?.representativeOutputAllowed, false, "route_iq_product_intelligence_contract_invalid", "representative Intelligence output");
  requireExact(intelligenceContract.safety?.crossWorkspaceAggregationAllowed, false, "route_iq_product_intelligence_contract_invalid", "cross-workspace Intelligence");
  requireExact(intelligenceContract.safety?.productionActivationAuthorized, false, "route_iq_product_intelligence_contract_invalid", "Intelligence production activation");

  requireExact(crmContract.owner, "Prometheus CRM", "route_iq_product_crm_contract_invalid", "CRM owner");
  requireExact(crmContract.extends, "existing_workspace_lead_persistence_runtime", "route_iq_product_crm_contract_invalid", "CRM extension boundary");
  requireExact(crmContract.minimalPii?.unknownFieldsRejected, true, "route_iq_product_crm_contract_invalid", "CRM unknown-field boundary");
  requireExact(crmContract.minimalPii?.secretsAccepted, false, "route_iq_product_crm_contract_invalid", "CRM secret boundary");
  requireExact(crmContract.durability?.requiresAtomicPutIfAbsent, true, "route_iq_product_crm_contract_invalid", "CRM atomic durability");
  requireExact(crmContract.authorization?.displayNameAuthorizationProhibited, true, "route_iq_product_crm_contract_invalid", "CRM display-name authorization");
  requireExact(crmContract.authorization?.representativeAuthorization, false, "route_iq_product_crm_contract_invalid", "CRM representative authorization");
  requireExact(crmContract.authorization?.authorizedImmutablePrincipal, cruz.authenticatedPrincipalId, "route_iq_product_cross_consumer_principal_drift", "CRM Cruz principal must equal canonical Data principal");
  requireExact(crmContract.productionMutationPerformed, false, "route_iq_product_crm_contract_invalid", "CRM production mutation");

  return Object.freeze({
    status: "contract_validated",
    batchId: contract.batchId,
    soleActiveProduct: contract.productPortfolio.soleActiveProduct,
    validatedCommittedOwnerArtifacts: Object.freeze(["Prometheus Data", "Prometheus Intelligence Engine", "Prometheus CRM"]),
    contractualRuntimeOwnersPendingIntegratedVerification: Object.freeze(["Prometheus Intelligence Engine", "Prometheus Infrastructure", "Prometheus Dashboard"]),
    lifecycleStageCount: lifecycle.length,
    founderDailySnapshotLifecycleStageCount: dailySnapshotLifecycle.stages.length,
    acceptanceGateCount: gates.length,
    deploymentScopes: Object.freeze(contract.rollout.deploymentScopes.map(scope => Object.freeze({
      scopeId: scope.scopeId,
      targetWorker: scope.targetWorker,
      deploymentAuthorizedNow: scope.deploymentAuthorizedNow
    }))),
    recommendationInfluence: contract.safetyState.recommendationInfluence,
    prospectiveCollection: contract.safetyState.prospectiveCollection,
    productionMutationPerformed: false,
    deploymentPerformed: false
  });
}

export function verifyRouteIqCommercialProductRuntimeSurfaces({ repoRoot = defaultRepoRoot } = {}) {
  const contract = readJson(repoRoot, routeIqCommercialProductPaths.contract);
  const intelligenceContract = readJson(repoRoot, routeIqCommercialProductPaths.intelligenceContract);
  const requiredPaths = new Set([
    ...contract.founderDailySnapshotLifecycle.stages.flatMap(stage => stage.surfaces),
    ...contract.acceptanceGates.flatMap(gate => gate.evidenceSurfaces),
    ...contract.rollout.rollback.evidenceSurfaces,
    ...contract.rollout.deploymentScopes.map(scope => scope.configurationPath)
  ]);
  const missingPaths = [...requiredPaths].filter(path => !existsSync(resolve(repoRoot, path)));
  requireValue(
    missingPaths.length === 0,
    "route_iq_product_required_surface_missing",
    `final integrated tree is missing: ${missingPaths.join(", ")}`
  );

  requireExact(
    intelligenceContract.canonicalFounderSnapshot?.stableArtifactPath,
    routeIqCommercialRuntimePaths.intelligenceArtifact,
    "route_iq_product_daily_snapshot_artifact_invalid",
    "Intelligence stable artifact path"
  );
  const artifact = readJson(repoRoot, routeIqCommercialRuntimePaths.intelligenceArtifact);
  requireExact(artifact.schemaVersion, "route-iq-daily-intelligence-snapshot-v1", "route_iq_product_daily_snapshot_artifact_invalid", "snapshot schema");
  requireExact(artifact.ownerSubsystem, "Prometheus Intelligence Engine", "route_iq_product_daily_snapshot_artifact_invalid", "snapshot owner");
  requireExact(artifact.audience, "founder_only", "route_iq_product_daily_snapshot_artifact_invalid", "snapshot audience");
  requireExact(artifact.workspaceId, "fitness_connection", "route_iq_product_daily_snapshot_artifact_invalid", "snapshot workspace");
  requireExact(artifact.operatingProfileId, "fitness", "route_iq_product_daily_snapshot_artifact_invalid", "snapshot operating profile");
  requireExact(artifact.evidenceClassification, "FOUNDER_FIELD_RESEARCH", "route_iq_product_daily_snapshot_artifact_invalid", "snapshot evidence classification");
  requireExact(artifact.safety?.readOnly, true, "route_iq_product_daily_snapshot_artifact_invalid", "snapshot read-only boundary");
  requireExact(artifact.safety?.founderOnly, true, "route_iq_product_daily_snapshot_artifact_invalid", "snapshot Founder boundary");
  requireExact(artifact.safety?.representativeReadable, false, "route_iq_product_daily_snapshot_artifact_invalid", "snapshot representative boundary");
  requireExact(artifact.safety?.recommendationInfluence, "OFF", "route_iq_product_daily_snapshot_artifact_invalid", "snapshot recommendation boundary");

  for (const path of [routeIqCommercialRuntimePaths.dashboardSource, routeIqCommercialRuntimePaths.dashboardDeploySource]) {
    const source = readText(repoRoot, path);
    requireValue(source.includes(founderDailySnapshotEndpoint), "route_iq_product_daily_snapshot_dashboard_surface_invalid", `${path} must consume the governed endpoint`);
    requireValue(!source.includes("localStorage.setItem(founderDailyIntelligence"), "route_iq_product_daily_snapshot_dashboard_surface_invalid", `${path} must not persist Founder Intelligence`);
  }
  const workerSource = readText(repoRoot, routeIqCommercialRuntimePaths.infrastructureWorker);
  requireValue(workerSource.includes(founderDailySnapshotEndpoint), "route_iq_product_daily_snapshot_endpoint_missing", "Infrastructure must implement the Founder-only snapshot endpoint");

  return Object.freeze({
    status: "integrated",
    endpoint: founderDailySnapshotEndpoint,
    method: "GET",
    requiredSurfaceCount: requiredPaths.size,
    validatedOwners: Object.freeze(["Prometheus Intelligence Engine", "Prometheus Infrastructure", "Prometheus Dashboard"]),
    recommendationInfluence: "OFF"
  });
}

export function verifyRouteIqCommercialProductContract(options = {}) {
  const contractResult = validateRouteIqCommercialProductContract(
    options.artifacts ?? loadRouteIqCommercialProductArtifacts(options)
  );
  if (options.allowPendingOwnerIntegration === true) {
    try {
      const runtimeResult = verifyRouteIqCommercialProductRuntimeSurfaces(options);
      return Object.freeze({ ...contractResult, status: "passed", contractualRuntimeOwnersPendingIntegratedVerification: Object.freeze([]), founderDailySnapshotLifecycle: runtimeResult });
    } catch (error) {
      if (!(error instanceof RouteIqCommercialProductContractError)) throw error;
      return Object.freeze({
        ...contractResult,
        status: "pending_owner_integration",
        founderDailySnapshotLifecycle: Object.freeze({ status: "pending_owner_integration", blockingCode: error.code })
      });
    }
  }
  const runtimeResult = verifyRouteIqCommercialProductRuntimeSurfaces(options);
  return Object.freeze({
    ...contractResult,
    status: "passed",
    contractualRuntimeOwnersPendingIntegratedVerification: Object.freeze([]),
    founderDailySnapshotLifecycle: runtimeResult
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(`${JSON.stringify(verifyRouteIqCommercialProductContract(), null, 2)}\n`);
}
