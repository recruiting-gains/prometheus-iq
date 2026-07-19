import { readFileSync } from "node:fs";
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

  requireExact(contract.rollout?.eventualDeploymentTarget, "private_prometheus_iq_worker_only", "route_iq_product_deployment_boundary_invalid", "deployment target");
  requireExact(contract.rollout?.publicWorkerExcluded, true, "route_iq_product_deployment_boundary_invalid", "public Worker exclusion");
  requireExact(contract.rollout?.founderDeploymentAuthorizationRequired, true, "route_iq_product_deployment_boundary_invalid", "Founder deployment gate");
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
    status: "passed",
    batchId: contract.batchId,
    soleActiveProduct: contract.productPortfolio.soleActiveProduct,
    validatedCommittedOwnerArtifacts: Object.freeze(["Prometheus Data", "Prometheus Intelligence Engine", "Prometheus CRM"]),
    contractualRuntimeOwnersPendingIntegratedVerification: Object.freeze(["Prometheus Dashboard", "Prometheus Website", "Prometheus Infrastructure"]),
    lifecycleStageCount: lifecycle.length,
    acceptanceGateCount: gates.length,
    recommendationInfluence: contract.safetyState.recommendationInfluence,
    prospectiveCollection: contract.safetyState.prospectiveCollection,
    productionMutationPerformed: false,
    deploymentPerformed: false
  });
}

export function verifyRouteIqCommercialProductContract(options = {}) {
  return validateRouteIqCommercialProductContract(
    options.artifacts ?? loadRouteIqCommercialProductArtifacts(options)
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(`${JSON.stringify(verifyRouteIqCommercialProductContract(), null, 2)}\n`);
}
