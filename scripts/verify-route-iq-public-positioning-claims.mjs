import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const defaultRepoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

export const routeIqPublicPositioningPaths = Object.freeze({
  contract: "docs/route-iq-public-positioning-claims-contract-v1.json",
  commercialProductContract: "docs/route-iq-commercial-product-contract-v1.json"
});

const requiredClaimIds = Object.freeze([
  "prometheus_company_route_iq_product",
  "field_operations_buyer_and_user",
  "fragmented_field_evidence_problem",
  "governed_decision_support",
  "context_learning_scope",
  "probability_with_uncertainty",
  "configuration_driven_reuse",
  "human_control"
]);

const requiredForbiddenClaimIds = Object.freeze([
  "fitness_connection_relationship",
  "unverified_customer_or_traction",
  "proven_performance_improvement",
  "causal_uplift",
  "recommendation_superiority_or_readiness",
  "autonomous_decisions_or_actions",
  "representative_facing_shadow_intelligence",
  "generic_ai_superiority",
  "instant_configuration_only_onboarding",
  "unlimited_scale",
  "replacement_for_route_planner_crm_or_maps",
  "active_collection_cohort_or_influence"
]);

const requiredLimitationIds = Object.freeze([
  "insufficient_recommendation_evidence",
  "recommendation_influence_off",
  "prospective_collection_off",
  "no_causal_or_superiority_evidence",
  "founder_research_not_customer_validation",
  "industry_generalization_not_yet_proven",
  "measured_capacity_not_unlimited_scale",
  "evidence_quality_controls_output"
]);

const forbiddenPublicClaimPatterns = Object.freeze([
  /Fitness Connection/i,
  /guarantee(?:d|s)?\b/i,
  /proven (?:roi|uplift|improvement|superiority|recommendation)/i,
  /autonomous(?:ly)? (?:decides|decision|action)/i,
  /replace(?:s|d)? (?:your |the )?(?:crm|route planner|mapping)/i,
  /unlimited scale/i
]);

export class RouteIqPublicPositioningContractError extends Error {
  constructor(code, detail) {
    super(`${code}: ${detail}`);
    this.name = "RouteIqPublicPositioningContractError";
    this.code = code;
  }
}

function fail(code, detail) {
  throw new RouteIqPublicPositioningContractError(code, detail);
}

function requireValue(condition, code, detail) {
  if (!condition) fail(code, detail);
}

function requireExact(actual, expected, code, detail) {
  requireValue(actual === expected, code, `${detail}; expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
}

function requireNonemptyString(value, code, detail) {
  requireValue(typeof value === "string" && value.trim() === value && value.length > 0, code, detail);
}

function requireNonemptyStringArray(value, code, detail) {
  requireValue(Array.isArray(value) && value.length > 0, code, detail);
  value.forEach((entry, index) => requireNonemptyString(entry, code, `${detail}[${index}]`));
}

function requireExactIds(records, expectedIds, code, detail) {
  requireValue(Array.isArray(records), code, detail);
  const ids = records.map(record => record.claimId ?? record.limitationId);
  requireValue(ids.length === expectedIds.length, code, `${detail}; expected ${expectedIds.length} entries, received ${ids.length}`);
  requireValue(new Set(ids).size === ids.length, code, `${detail}; identifiers must be unique`);
  requireValue(expectedIds.every(id => ids.includes(id)), code, `${detail}; expected ${expectedIds.join(", ")}, received ${ids.join(", ")}`);
}

function readJson(repoRoot, path) {
  try {
    return JSON.parse(readFileSync(resolve(repoRoot, path), "utf8"));
  } catch (error) {
    fail("route_iq_positioning_artifact_missing_or_invalid", `${path}: ${error.code ?? error.message}`);
  }
}

export function loadRouteIqPublicPositioningArtifacts({ repoRoot = defaultRepoRoot } = {}) {
  return Object.freeze({
    contract: readJson(repoRoot, routeIqPublicPositioningPaths.contract),
    commercialProductContract: readJson(repoRoot, routeIqPublicPositioningPaths.commercialProductContract)
  });
}

export function validateRouteIqPublicPositioningClaims({ contract, commercialProductContract }) {
  requireValue(contract && typeof contract === "object" && !Array.isArray(contract), "route_iq_positioning_contract_required", "positioning contract");
  requireValue(commercialProductContract && typeof commercialProductContract === "object" && !Array.isArray(commercialProductContract), "route_iq_positioning_commercial_contract_required", "commercial product contract");

  requireExact(contract.contractVersion, "route-iq-public-positioning-claims-contract-v1", "route_iq_positioning_version_invalid", "contract version");
  requireExact(contract.batchId, "BATCH-20260719-002", "route_iq_positioning_batch_invalid", "batch ID");
  requireExact(contract.directive, "Route IQ YC-Style Investor Website Focus + Buyer Conversion Audit v1", "route_iq_positioning_directive_invalid", "directive");
  requireExact(contract.ownerSubsystem, "Prometheus Route IQ", "route_iq_positioning_owner_invalid", "owner subsystem");
  requireExact(contract.sourceBaseline?.commit, "cb413fdf3a9676c238c02532261ffcf3a24f2b21", "route_iq_positioning_baseline_invalid", "source commit");
  requireExact(contract.sourceBaseline?.tree, "ccd8356a5f820df14c574ff2be5196459422acbe", "route_iq_positioning_baseline_invalid", "source tree");
  requireExact(contract.sourceBaseline?.commercialProductContract, routeIqPublicPositioningPaths.commercialProductContract, "route_iq_positioning_baseline_invalid", "commercial contract path");
  requireExact(contract.sourceBaseline?.commercialProductContractVersion, commercialProductContract.contractVersion, "route_iq_positioning_baseline_invalid", "commercial contract version");

  requireExact(contract.portfolio?.company?.name, "Prometheus", "route_iq_positioning_portfolio_invalid", "company name");
  requireExact(contract.portfolio?.soleActiveProduct?.productId, "route_iq", "route_iq_positioning_portfolio_invalid", "sole active product ID");
  requireExact(contract.portfolio?.soleActiveProduct?.name, "Route IQ", "route_iq_positioning_portfolio_invalid", "sole active product name");
  requireExact(contract.portfolio?.soleActiveProduct?.state, "active", "route_iq_positioning_portfolio_invalid", "sole active product state");
  requireValue(Array.isArray(contract.portfolio?.inactiveProductsPromotedPublicly) && contract.portfolio.inactiveProductsPromotedPublicly.length === 0, "route_iq_positioning_portfolio_invalid", "inactive products cannot be publicly promoted");
  requireExact(contract.portfolio?.smoothieDepotPromotedPublicly, false, "route_iq_positioning_portfolio_invalid", "Smoothie Depot promotion");
  requireExact(contract.portfolio?.franchiseExpansionIsPrimaryMessage, false, "route_iq_positioning_portfolio_invalid", "franchise expansion message");
  requireExact(commercialProductContract.productPortfolio?.soleActiveProduct, "route_iq", "route_iq_positioning_commercial_contract_drift", "commercial sole active product");

  const positioning = contract.fiveSecondPositioning;
  requireNonemptyString(positioning?.statement, "route_iq_positioning_five_second_message_invalid", "five-second statement");
  requireExact(positioning?.whatItDoes, "turns_governed_field_evidence_into_decision_ready_intelligence", "route_iq_positioning_five_second_message_invalid", "what Route IQ does");
  requireExact(positioning?.primaryBuyer?.count, 1, "route_iq_positioning_buyer_invalid", "primary buyer count");
  requireExact(positioning?.primaryBuyer?.role, "field_operations_leader", "route_iq_positioning_buyer_invalid", "primary buyer");
  requireNonemptyString(positioning?.primaryBuyer?.accountability, "route_iq_positioning_buyer_invalid", "primary buyer accountability");
  requireExact(positioning?.primaryUser?.count, 1, "route_iq_positioning_user_invalid", "primary user count");
  requireExact(positioning?.primaryUser?.role, "field_representative", "route_iq_positioning_user_invalid", "primary user");
  requireNonemptyString(positioning?.primaryUser?.workflow, "route_iq_positioning_user_invalid", "primary user workflow");
  for (const field of ["problemSolved", "whyDifferent"]) {
    requireNonemptyString(positioning?.[field], "route_iq_positioning_five_second_message_invalid", field);
  }
  requireExact(positioning?.primaryPublicAction, "REQUEST_ROUTE_IQ", "route_iq_positioning_action_invalid", "primary public action");
  requireExact(positioning?.permittedSecondaryAction, "SEE_HOW_ROUTE_IQ_WORKS", "route_iq_positioning_action_invalid", "secondary public action");

  const lifecycle = contract.decisionSupportLifecycle;
  requireNonemptyString(lifecycle?.narrative, "route_iq_positioning_lifecycle_invalid", "decision support narrative");
  const requiredStages = [
    "governed_field_evidence",
    "governed_intelligence",
    "probability_with_confidence_and_limitations",
    "human_decision"
  ];
  requireValue(Array.isArray(lifecycle?.stages) && lifecycle.stages.length === requiredStages.length, "route_iq_positioning_lifecycle_invalid", "four decision-support stages are required");
  lifecycle.stages.forEach((stage, index) => {
    requireExact(stage.order, index + 1, "route_iq_positioning_lifecycle_invalid", `stage ${index + 1} order`);
    requireExact(stage.stage, requiredStages[index], "route_iq_positioning_lifecycle_invalid", `stage ${index + 1}`);
    requireNonemptyString(stage.meaning, "route_iq_positioning_lifecycle_invalid", `stage ${index + 1} meaning`);
  });
  requireExact(lifecycle.probabilityBoundary?.alwaysAvailableClaimAllowed, false, "route_iq_positioning_probability_boundary_invalid", "always-available probability claim");
  requireExact(lifecycle.probabilityBoundary?.currentRecommendationReadiness, "INSUFFICIENT_EVIDENCE", "route_iq_positioning_probability_boundary_invalid", "recommendation readiness");
  requireExact(lifecycle.probabilityBoundary?.representativeFacingProbabilityAllowed, false, "route_iq_positioning_probability_boundary_invalid", "representative-facing probability");
  requireExact(lifecycle.probabilityBoundary?.causalInterpretationAllowed, false, "route_iq_positioning_probability_boundary_invalid", "causal interpretation");
  requireExact(lifecycle.probabilityBoundary?.recommendationSuperiorityClaimAllowed, false, "route_iq_positioning_probability_boundary_invalid", "recommendation superiority");

  const requiredDifferentiators = ["route_planner", "crm", "mapping_application", "generic_ai_assistant"];
  requireValue(Array.isArray(contract.differentiation) && contract.differentiation.length === requiredDifferentiators.length, "route_iq_positioning_differentiation_invalid", "four comparison categories are required");
  contract.differentiation.forEach((record, index) => {
    requireExact(record.category, requiredDifferentiators[index], "route_iq_positioning_differentiation_invalid", `comparison ${index + 1}`);
    requireNonemptyString(record.categoryPurpose, "route_iq_positioning_differentiation_invalid", `${record.category} purpose`);
    requireNonemptyString(record.routeIqDifference, "route_iq_positioning_differentiation_invalid", `${record.category} Route IQ difference`);
    requireExact(record.replacementClaimAllowed, false, "route_iq_positioning_differentiation_invalid", `${record.category} replacement claim`);
  });

  requireExactIds(contract.supportableClaims, requiredClaimIds, "route_iq_positioning_supportable_claims_invalid", "supportable claims");
  for (const claim of contract.supportableClaims) {
    requireNonemptyString(claim.publicText, "route_iq_positioning_supportable_claims_invalid", `${claim.claimId} public text`);
    requireNonemptyStringArray(claim.evidenceBasis, "route_iq_positioning_supportable_claims_invalid", `${claim.claimId} evidence basis`);
    requireNonemptyString(claim.requiredQualifier, "route_iq_positioning_supportable_claims_invalid", `${claim.claimId} qualifier`);
    for (const pattern of forbiddenPublicClaimPatterns) {
      requireValue(!pattern.test(claim.publicText), "route_iq_positioning_unsupported_public_claim", `${claim.claimId} matches ${pattern}`);
    }
  }

  requireExactIds(contract.forbiddenClaims, requiredForbiddenClaimIds, "route_iq_positioning_forbidden_claims_invalid", "forbidden claims");
  contract.forbiddenClaims.forEach(claim => requireNonemptyString(claim.reason, "route_iq_positioning_forbidden_claims_invalid", `${claim.claimId} reason`));

  const fitness = contract.fitnessConnectionBoundary;
  requireExact(fitness?.classification, "FOUNDER_FIELD_RESEARCH", "route_iq_positioning_fitness_boundary_invalid", "Fitness Connection classification");
  requireExact(fitness?.publicMentionPolicy, "omit_by_default", "route_iq_positioning_fitness_boundary_invalid", "Fitness Connection public mention policy");
  for (const field of ["customerClaimAllowed", "pilotClaimAllowed", "partnerClaimAllowed", "sponsorClaimAllowed", "endorsementClaimAllowed", "logoOrTestimonialUseAllowed"]) {
    requireExact(fitness?.[field], false, "route_iq_positioning_fitness_boundary_invalid", field);
  }
  requireNonemptyString(fitness?.permittedDisclosureIfStrictlyNecessary, "route_iq_positioning_fitness_boundary_invalid", "strictly necessary disclosure");
  requireExact(commercialProductContract.fitnessConnectionEvidenceBoundary?.classification, fitness.classification, "route_iq_positioning_fitness_boundary_drift", "commercial Fitness Connection classification");
  requireExact(commercialProductContract.fitnessConnectionEvidenceBoundary?.publicPartnershipOrEndorsementClaimAllowed, false, "route_iq_positioning_fitness_boundary_drift", "commercial Fitness Connection relationship boundary");

  requireExactIds(contract.currentLimitations, requiredLimitationIds, "route_iq_positioning_limitations_invalid", "current limitations");
  contract.currentLimitations.forEach(limitation => requireNonemptyString(limitation.disclosure, "route_iq_positioning_limitations_invalid", `${limitation.limitationId} disclosure`));

  const objections = contract.investorObjectionResolution;
  requireValue(Array.isArray(objections) && objections.length === 10, "route_iq_positioning_objections_invalid", "exactly ten ranked objections are required");
  requireValue(new Set(objections.map(objection => objection.objectionId)).size === 10, "route_iq_positioning_objections_invalid", "objection identifiers must be unique");
  objections.forEach((objection, index) => {
    requireExact(objection.rank, index + 1, "route_iq_positioning_objections_invalid", `objection ${index + 1} rank`);
    requireNonemptyString(objection.objectionId, "route_iq_positioning_objections_invalid", `objection ${index + 1} ID`);
    requireNonemptyString(objection.objection, "route_iq_positioning_objections_invalid", `objection ${index + 1}`);
    requireValue(["resolved_by_positioning", "resolved_with_qualification", "resolved_by_governed_boundary", "unresolved_disclosed"].includes(objection.resolutionStatus), "route_iq_positioning_objections_invalid", `${objection.objectionId} resolution status`);
    requireNonemptyString(objection.resolution, "route_iq_positioning_objections_invalid", `${objection.objectionId} resolution`);
  });
  requireValue(objections.some(objection => objection.resolutionStatus === "unresolved_disclosed"), "route_iq_positioning_objections_invalid", "unresolved weaknesses must be disclosed");

  const safety = contract.safetyState;
  requireExact(safety?.recommendationInfluence, "OFF", "route_iq_positioning_safety_invalid", "recommendation influence");
  requireExact(safety?.prospectiveCollection, "OFF", "route_iq_positioning_safety_invalid", "prospective collection");
  requireExact(safety?.activeProspectiveCohorts, 0, "route_iq_positioning_safety_invalid", "active cohorts");
  requireExact(safety?.recommendationReadiness, "INSUFFICIENT_EVIDENCE", "route_iq_positioning_safety_invalid", "recommendation readiness");
  for (const field of ["representativeFacingShadowOutput", "automatedOperationalAction", "deploymentAuthorizedByBatch", "productionMutationAuthorizedByBatch"]) {
    requireExact(safety?.[field], false, "route_iq_positioning_safety_invalid", field);
  }
  requireExact(commercialProductContract.safetyState?.recommendationInfluence, safety.recommendationInfluence, "route_iq_positioning_safety_drift", "commercial recommendation influence");
  requireExact(commercialProductContract.safetyState?.prospectiveCollection, safety.prospectiveCollection, "route_iq_positioning_safety_drift", "commercial prospective collection");
  requireExact(commercialProductContract.safetyState?.activeProspectiveCohorts, safety.activeProspectiveCohorts, "route_iq_positioning_safety_drift", "commercial active cohorts");

  const owner = contract.ownerBoundary;
  requireExact(owner?.implementationOwner, "Prometheus Route IQ", "route_iq_positioning_owner_boundary_invalid", "implementation owner");
  requireValue(Array.isArray(owner?.ownerFiles) && owner.ownerFiles.length === 3, "route_iq_positioning_owner_boundary_invalid", "three Route IQ owner files are required");
  requireValue(owner.ownerFiles.every(path => path === routeIqPublicPositioningPaths.contract || path.startsWith("scripts/verify-route-iq-") || path.startsWith("tests/route-iq-")), "route_iq_positioning_owner_boundary_invalid", "owner files must remain on Route IQ surfaces");
  for (const field of ["websiteImplementationIncluded", "crmImplementationIncluded", "infrastructureImplementationIncluded", "dataImplementationIncluded", "intelligenceImplementationIncluded", "overwatchGovernanceIncluded", "productionBehaviorChanged", "deploymentPerformed"]) {
    requireExact(owner?.[field], false, "route_iq_positioning_owner_boundary_invalid", field);
  }

  return Object.freeze({
    status: "passed",
    batchId: contract.batchId,
    ownerSubsystem: contract.ownerSubsystem,
    company: contract.portfolio.company.name,
    soleActiveProduct: contract.portfolio.soleActiveProduct.name,
    primaryBuyer: positioning.primaryBuyer.role,
    primaryUser: positioning.primaryUser.role,
    primaryPublicAction: positioning.primaryPublicAction,
    supportableClaimCount: contract.supportableClaims.length,
    forbiddenClaimCount: contract.forbiddenClaims.length,
    limitationCount: contract.currentLimitations.length,
    objectionCount: objections.length,
    unresolvedDisclosedCount: objections.filter(objection => objection.resolutionStatus === "unresolved_disclosed").length,
    recommendationInfluence: safety.recommendationInfluence,
    prospectiveCollection: safety.prospectiveCollection,
    activeProspectiveCohorts: safety.activeProspectiveCohorts,
    recommendationReadiness: safety.recommendationReadiness,
    productionBehaviorChanged: false,
    deploymentPerformed: false
  });
}

export function verifyRouteIqPublicPositioningClaims(options = {}) {
  return validateRouteIqPublicPositioningClaims(options.artifacts ?? loadRouteIqPublicPositioningArtifacts(options));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(`${JSON.stringify(verifyRouteIqPublicPositioningClaims(), null, 2)}\n`);
}
