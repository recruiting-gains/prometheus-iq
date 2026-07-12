import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { routeQueueIdentity } from "./continuous-adaptive-route-replenishment.mjs";
import {
  evaluateRouteBusinessHoursEligibility,
  routeBusinessHoursEligibilityVersion,
  summarizeRouteBusinessHours
} from "./route-business-hours-eligibility.mjs";

export const nearbyContextIntelligenceVersion = "nearby-context-intelligence-v2";
export const nearbyContextPolicyVersion = "nearby-context-intelligence-v2-policy-v1";
export const nearbyContextContractVersion = "nearby-context-intelligence-v2-contracts-v1";
export const nearbyContextDuplicateIdentityIntegrationRepairVersion = "nearby-context-duplicate-identity-integration-repair-v1";

const moduleDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(moduleDir, "..");
const defaultPaths = {
  config: "intelligence/config/nearby-context-intelligence-v2.json",
  contract: "intelligence/contracts/nearby-context-intelligence-v2-contracts.json"
};

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function cleanText(value, maximum = 500) {
  return String(value ?? "").replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, maximum);
}

function normalizedText(value) {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function finiteNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => String(left).localeCompare(String(right)));
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(resolve(repoRoot, relativePath), "utf8"));
}

function countBy(values, keyOf) {
  const counts = new Map();
  for (const value of values) {
    const key = cleanText(keyOf(value), 160) || "unknown";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

function candidateName(candidate) {
  return cleanText(candidate?.name || candidate?.businessName, 200);
}

function candidateAddress(candidate) {
  return cleanText(candidate?.address || candidate?.fullAddress, 300);
}

function candidateCoordinates(candidate) {
  const latitude = finiteNumber(candidate?.latitude ?? candidate?.lat);
  const longitude = finiteNumber(candidate?.longitude ?? candidate?.lng ?? candidate?.lon);
  if (latitude === null || longitude === null || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

function commercialRelationships(candidate) {
  const source = candidate?.commercialRelationships || candidate?.relationships || {};
  return {
    buildingId: cleanText(source.buildingId || candidate?.buildingId, 160),
    shoppingCenterId: cleanText(source.shoppingCenterId || candidate?.shoppingCenterId, 160),
    commercialParcelId: cleanText(source.commercialParcelId || candidate?.commercialParcelId || candidate?.parcelId, 160),
    parkingAreaId: cleanText(source.parkingAreaId || candidate?.parkingAreaId, 160)
  };
}

function matchingRelationship(left, right, field) {
  const leftValue = normalizedText(commercialRelationships(left)[field]);
  const rightValue = normalizedText(commercialRelationships(right)[field]);
  return Boolean(leftValue && rightValue && leftValue === rightValue);
}

function normalizedStreetSuffix(value) {
  return value
    .replace(/\b(boulevard)\b/g, "blvd")
    .replace(/\b(street)\b/g, "st")
    .replace(/\b(road)\b/g, "rd")
    .replace(/\b(avenue)\b/g, "ave")
    .replace(/\b(highway)\b/g, "hwy")
    .replace(/\b(parkway)\b/g, "pkwy")
    .replace(/\b(drive)\b/g, "dr")
    .replace(/\b(lane)\b/g, "ln")
    .replace(/\b(court)\b/g, "ct")
    .replace(/\b(circle)\b/g, "cir");
}

export function normalizeCommercialAddress(address) {
  const firstLine = cleanText(address, 300).split(",")[0] || "";
  const withoutUnit = firstLine.replace(/\s+(?:suite|ste|unit|building|bldg|#)\s*[a-z0-9-]+.*$/i, "");
  const normalized = normalizedStreetSuffix(normalizedText(withoutUnit));
  const match = normalized.match(/^(\d+[a-z]?)\s+(.+)$/);
  return {
    baseAddress: normalized,
    streetNumber: match ? Number.parseInt(match[1], 10) : null,
    streetKey: match ? match[2] : ""
  };
}

export function distanceFeetBetweenBusinesses(left, right) {
  const a = candidateCoordinates(left);
  const b = candidateCoordinates(right);
  if (!a || !b) return null;
  const radians = Math.PI / 180;
  const earthRadiusMeters = 6371000;
  const latitudeA = a.latitude * radians;
  const latitudeB = b.latitude * radians;
  const latitudeDelta = (b.latitude - a.latitude) * radians;
  const longitudeDelta = (b.longitude - a.longitude) * radians;
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2;
  return Number((2 * earthRadiusMeters * Math.asin(Math.sqrt(haversine)) * 3.28084).toFixed(1));
}

export function loadNearbyContextConfig(path = defaultPaths.config) {
  return deepFreeze(readJson(path));
}

export function loadNearbyContextContract(path = defaultPaths.contract) {
  return deepFreeze(readJson(path));
}

export function applyCanonicalBusinessHoursEligibilityToNearbyCandidates({
  candidates = [],
  hoursIndex = null,
  evaluatedAt = new Date(),
  workspaceId = "fitness_connection",
  operatingProfileId = "fitness"
} = {}) {
  const instant = new Date(evaluatedAt);
  if (Number.isNaN(instant.getTime())) throw new Error(`Invalid Nearby Context evaluation time: ${evaluatedAt}`);
  const recordsByPlaceId = hoursIndex?.recordsByPlaceId instanceof Map ? hoursIndex.recordsByPlaceId : new Map();
  const artifactAvailable = Boolean(hoursIndex?.recordsByPlaceId instanceof Map);
  const evaluatedCandidates = (Array.isArray(candidates) ? candidates : []).map((candidate, sourceOrder) => {
    const googlePlaceId = cleanText(candidate?.googlePlaceId, 180);
    const eligibilitySnapshot = evaluateRouteBusinessHoursEligibility({
      record: recordsByPlaceId.get(googlePlaceId) || null,
      candidate,
      evaluatedAt: instant,
      artifactAvailable,
      workspaceId,
      operatingProfileId
    });
    return {
      ...clone(candidate),
      sourceOrder: Number.isInteger(candidate?.sourceOrder) ? candidate.sourceOrder : sourceOrder,
      eligibilitySnapshot,
      nearbyRouteEligible: candidate?.routeEligible === true && eligibilitySnapshot.eligible === true
    };
  });
  return deepFreeze({
    version: routeBusinessHoursEligibilityVersion,
    evaluatedAt: instant.toISOString(),
    evaluatedCandidates,
    eligibleCandidates: evaluatedCandidates.filter(candidate => candidate.nearbyRouteEligible),
    excludedCandidates: evaluatedCandidates.filter(candidate => !candidate.nearbyRouteEligible),
    summary: summarizeRouteBusinessHours(evaluatedCandidates.map(candidate => candidate.eligibilitySnapshot))
  });
}

export function validateNearbyContextConfig(config) {
  const failures = [];
  const fail = (condition, reason) => { if (!condition) failures.push(reason); };
  const relationship = config?.relationshipPolicy || {};
  const candidate = config?.candidatePolicy || {};
  const safety = config?.activationSafety || {};
  fail(config?.policyVersion === nearbyContextPolicyVersion, "policy_version_mismatch");
  fail(config?.status === "advisory_only", "policy_must_remain_advisory_only");
  fail(config?.workspaceId === "fitness_connection", "policy_workspace_mismatch");
  fail(config?.operatingProfileId === "fitness", "policy_operating_profile_mismatch");
  fail(JSON.stringify(candidate.allowedSourcePools) === JSON.stringify(["active", "full"]), "allowed_source_pools_mismatch");
  fail(candidate.forbiddenSourcePools?.includes("quarantine"), "quarantine_pool_must_be_forbidden");
  fail(candidate.requiresExistingRouteEligibility === true, "existing_route_eligibility_required");
  fail(candidate.requiresCanonicalBusinessHoursEligibility === true, "canonical_hours_required");
  fail(candidate.maximumCandidateScan > 0 && candidate.maximumCandidateScan <= 5000, "candidate_scan_must_be_bounded");
  fail(candidate.maximumResults > 0 && candidate.maximumResults <= 15, "nearby_result_limit_invalid");
  fail(candidate.recommendationScoreUsedForOrdering === false, "recommendation_score_ordering_prohibited");
  fail(config?.identityPolicy?.integrationVersion === nearbyContextDuplicateIdentityIntegrationRepairVersion, "identity_integration_version_mismatch");
  fail(config?.identityPolicy?.canonicalImplementation === "intelligence/continuous-adaptive-route-replenishment.mjs", "canonical_identity_implementation_mismatch");
  fail(config?.identityPolicy?.canonicalFunction === "routeQueueIdentity", "canonical_identity_function_mismatch");
  fail(config?.identityPolicy?.googlePlaceIdPriority === true, "google_place_identity_priority_required");
  fail(config?.identityPolicy?.deduplicationPhase === "before_relationship_classification", "identity_deduplication_phase_mismatch");
  fail(config?.identityPolicy?.shoppingCenterInferenceInput === "unique_canonical_businesses_only", "shopping_center_identity_input_mismatch");
  fail(config?.identityPolicy?.duplicateAliasContributionAllowed === false, "duplicate_alias_relationship_contribution_prohibited");
  fail(config?.identityPolicy?.multiTenantDistinction === "distinct_google_place_ids_remain_distinct", "multi_tenant_identity_policy_mismatch");
  fail(JSON.stringify(config?.identityPolicy?.executionOrder) === JSON.stringify([
    "eligible_candidates",
    "canonical_business_identity_resolution",
    "duplicate_removal",
    "relationship_classification",
    "shopping_center_inference",
    "walkability",
    "nearby_context_generation"
  ]), "identity_execution_order_mismatch");
  fail(config?.businessHoursPolicy?.canonicalVersion === routeBusinessHoursEligibilityVersion, "canonical_hours_version_mismatch");
  fail(config?.businessHoursPolicy?.closedVerifiedBehavior === "exclude_never_classify", "closed_verified_must_be_excluded_before_relationships");
  fail(JSON.stringify(relationship.priorityOrder) === JSON.stringify([
    "same_building",
    "same_shopping_center",
    "same_commercial_parcel",
    "walkable",
    "nearby"
  ]), "relationship_priority_mismatch");
  fail(relationship.sameBuildingInferenceMaximumFeet <= relationship.adjacentBuildingMaximumFeet, "same_building_radius_invalid");
  fail(relationship.adjacentBuildingMaximumFeet <= relationship.walkableMaximumFeet, "adjacent_radius_invalid");
  fail(relationship.inferredShoppingCenterMaximumFeet <= relationship.walkableMaximumFeet, "shopping_center_radius_invalid");
  fail(relationship.walkableMaximumFeet < relationship.nearbyMaximumFeet, "walkable_radius_must_be_below_nearby_radius");
  fail(relationship.nearbyMaximumFeet <= relationship.maximumSearchRadiusFeet, "nearby_radius_exceeds_search_radius");
  fail(config?.fieldEvidenceBasis?.learningInput === false, "stress_observation_learning_prohibited");
  fail(config?.fieldEvidenceBasis?.archiveMutationAllowed === false, "stress_archive_mutation_prohibited");
  fail(safety.advisoryConsumerActive === true, "advisory_projection_must_be_active");
  for (const field of [
    "dashboardConsumerActive",
    "recommendationReplacementActive",
    "productionQueueMutationActive",
    "routeScoringWeightsChanged",
    "dashboardRuntimeChanged",
    "dataChanged",
    "crmChanged",
    "companionChanged",
    "liveGoogleCallsAllowed"
  ]) fail(safety[field] === false, `protected_behavior_changed:${field}`);
  return unique(failures);
}

export function validateNearbyContextContract(contract) {
  const failures = [];
  const fail = (condition, reason) => { if (!condition) failures.push(reason); };
  fail(contract?.contractVersion === nearbyContextContractVersion, "contract_version_mismatch");
  fail(contract?.status === "advisory_only", "contract_must_remain_advisory_only");
  fail(contract?.scopePolicy?.authorizedWorkspaceId === "fitness_connection", "contract_workspace_mismatch");
  fail(contract?.scopePolicy?.unknownWorkspaceBehavior === "fail_closed", "unknown_workspace_must_fail_closed");
  fail(contract?.scopePolicy?.crossWorkspaceCandidatesAllowed === false, "cross_workspace_candidates_prohibited");
  fail(contract?.eligibilityContract?.canonicalImplementation === "intelligence/route-business-hours-eligibility.mjs", "canonical_hours_implementation_mismatch");
  fail(contract?.eligibilityContract?.canonicalVersion === routeBusinessHoursEligibilityVersion, "canonical_hours_contract_version_mismatch");
  fail(contract?.eligibilityContract?.relationshipClassificationOccursAfterEligibility === true, "eligibility_must_precede_relationships");
  fail(contract?.eligibilityContract?.closedCandidateResurrectionAllowed === false, "closed_candidate_resurrection_prohibited");
  fail(contract?.eligibilityContract?.eligibilityReimplementationAllowed === false, "second_hours_engine_prohibited");
  fail(contract?.identityContract?.integrationVersion === nearbyContextDuplicateIdentityIntegrationRepairVersion, "identity_contract_integration_version_mismatch");
  fail(contract?.identityContract?.canonicalImplementation === "intelligence/continuous-adaptive-route-replenishment.mjs", "canonical_identity_contract_implementation_mismatch");
  fail(contract?.identityContract?.canonicalFunction === "routeQueueIdentity", "canonical_identity_contract_function_mismatch");
  fail(contract?.identityContract?.googlePlaceIdPriority === true, "identity_contract_google_place_priority_required");
  fail(contract?.identityContract?.duplicateRemovalBeforeRelationshipInference === true, "identity_contract_deduplication_order_mismatch");
  fail(contract?.identityContract?.shoppingCenterInferenceInput === "unique_canonical_businesses_only", "identity_contract_shopping_center_input_mismatch");
  fail(contract?.identityContract?.duplicateAliasesContributeToInference === false, "identity_contract_alias_contribution_prohibited");
  fail(contract?.identityContract?.multiTenantDistinction === "distinct_google_place_ids_remain_distinct", "identity_contract_multi_tenant_rule_mismatch");
  fail(contract?.identityContract?.secondIdentityEngineAllowed === false, "second_identity_engine_prohibited");
  fail(JSON.stringify(contract?.relationshipContract?.priorityOrder) === JSON.stringify([
    "same_building",
    "same_shopping_center",
    "same_commercial_parcel",
    "walkable",
    "nearby"
  ]), "relationship_contract_priority_mismatch");
  fail(contract?.relationshipContract?.verifiedAndInferredRelationshipsDistinguished === true, "relationship_verification_required");
  fail(contract?.relationshipContract?.shoppingCenterInferenceUniqueBusinessesOnly === true, "shopping_center_unique_businesses_required");
  fail(contract?.selectionContract?.quarantineSelectable === false, "quarantine_selection_prohibited");
  fail(contract?.selectionContract?.completedBusinessesSelectable === false, "completed_selection_prohibited");
  fail(contract?.selectionContract?.duplicateBusinessesSelectable === false, "duplicate_selection_prohibited");
  fail(contract?.selectionContract?.duplicateRemovalPhase === "before_relationship_inference", "selection_duplicate_removal_phase_mismatch");
  fail(contract?.selectionContract?.recommendationScoresUsedForOrdering === false, "score_ordering_prohibited");
  fail(contract?.selectionContract?.inventedCandidatesAllowed === false, "invented_candidates_prohibited");
  fail(contract?.outputContract?.runtimeConsumptionAuthorized === false, "runtime_consumption_not_authorized");
  fail(contract?.activationSafety?.dashboardConsumerActive === false, "dashboard_consumer_not_authorized");
  fail(contract?.activationSafety?.routeScoringWeightsChanged === false, "route_scoring_change_prohibited");
  return unique(failures);
}

export function assertNearbyContextScope({ workspaceId, operatingProfileId, representativeId, contract = loadNearbyContextContract() } = {}) {
  const workspace = cleanText(workspaceId, 80);
  const profile = cleanText(operatingProfileId, 80);
  const representative = cleanText(representativeId, 80);
  if (workspace !== contract.scopePolicy.authorizedWorkspaceId) {
    throw new Error(`Nearby Context is not authorized for workspace: ${workspace || "unknown"}`);
  }
  if (profile !== contract.scopePolicy.authorizedOperatingProfileId) {
    throw new Error(`Nearby Context operating profile mismatch: ${profile || "unknown"}`);
  }
  if (!contract.scopePolicy.authorizedRepresentativeIds.includes(representative)) {
    throw new Error(`Nearby Context representative is not authorized: ${representative || "unknown"}`);
  }
  return { workspaceId: workspace, operatingProfileId: profile, representativeId: representative };
}

function relationshipResult(type, verification, confidence, evidence, config) {
  return {
    type,
    label: config.relationshipPolicy.labels[type],
    verification,
    confidence,
    evidence: unique(evidence)
  };
}

function inferredShoppingCenter(primary, candidate, eligibleCandidates, config) {
  const policy = config.relationshipPolicy;
  const primaryAddress = normalizeCommercialAddress(candidateAddress(primary));
  const candidateCommercialAddress = normalizeCommercialAddress(candidateAddress(candidate));
  if (!primaryAddress.streetKey || primaryAddress.streetKey !== candidateCommercialAddress.streetKey) return null;
  const members = [primary, ...eligibleCandidates].filter(item => {
    const parsed = normalizeCommercialAddress(candidateAddress(item));
    const feet = item === primary ? 0 : distanceFeetBetweenBusinesses(primary, item);
    return parsed.streetKey === primaryAddress.streetKey
      && parsed.streetNumber !== null
      && feet !== null
      && feet <= policy.inferredShoppingCenterMaximumFeet;
  });
  const memberNumbers = members.map(item => normalizeCommercialAddress(candidateAddress(item)).streetNumber).filter(Number.isFinite);
  if (members.length < policy.inferredShoppingCenterMinimumMembers || !memberNumbers.length) return null;
  const span = Math.max(...memberNumbers) - Math.min(...memberNumbers);
  if (span > policy.inferredShoppingCenterStreetNumberSpan) return null;
  return { memberCount: members.length, streetNumberSpan: span, streetKey: primaryAddress.streetKey };
}

function resolveRelationship(primary, candidate, eligibleCandidates, config) {
  const policy = config.relationshipPolicy;
  const distanceFeet = candidate.distanceFeet;
  const primaryAddress = normalizeCommercialAddress(candidateAddress(primary));
  const nearbyAddress = normalizeCommercialAddress(candidateAddress(candidate));
  if (matchingRelationship(primary, candidate, "buildingId")) {
    return relationshipResult("same_building", "VERIFIED", "HIGH", ["matching_building_identifier"], config);
  }
  if (primaryAddress.baseAddress && primaryAddress.baseAddress === nearbyAddress.baseAddress
    && distanceFeet <= policy.sameBuildingInferenceMaximumFeet) {
    return relationshipResult("same_building", "INFERRED", "MODERATE", ["matching_base_street_address", "distance_within_same_building_policy"], config);
  }
  if (matchingRelationship(primary, candidate, "shoppingCenterId")) {
    return relationshipResult("same_shopping_center", "VERIFIED", "HIGH", ["matching_shopping_center_identifier"], config);
  }
  const centerInference = distanceFeet <= policy.inferredShoppingCenterMaximumFeet
    ? inferredShoppingCenter(primary, candidate, eligibleCandidates, config)
    : null;
  if (centerInference) {
    return {
      ...relationshipResult("same_shopping_center", "INFERRED", "MODERATE", [
        "same_commercial_street",
        "bounded_street_number_cluster",
        "minimum_governed_cluster_members_met"
      ], config),
      inference: centerInference
    };
  }
  if (matchingRelationship(primary, candidate, "commercialParcelId")) {
    return relationshipResult("same_commercial_parcel", "VERIFIED", "HIGH", ["matching_commercial_parcel_identifier"], config);
  }
  if (matchingRelationship(primary, candidate, "parkingAreaId")) {
    return relationshipResult("same_commercial_parcel", "INFERRED", "MODERATE", ["matching_shared_parking_area_identifier"], config);
  }
  if (distanceFeet <= policy.walkableMaximumFeet) {
    const evidence = ["within_governed_walkable_distance"];
    if (distanceFeet <= policy.adjacentBuildingMaximumFeet) evidence.push("adjacent_building_distance");
    return relationshipResult("walkable", "INFERRED", distanceFeet <= policy.adjacentBuildingMaximumFeet ? "MODERATE" : "LOW", evidence, config);
  }
  if (distanceFeet <= policy.nearbyMaximumFeet) {
    return relationshipResult("nearby", "INFERRED", "LOW", ["within_governed_nearby_distance"], config);
  }
  return null;
}

function governanceStage(candidate) {
  const open = candidate.eligibilitySnapshot?.status === "OPEN_VERIFIED";
  if (open && candidate.sourcePool === "active") return { rank: 0, id: "active_verified_open" };
  if (open && candidate.sourcePool === "full") return { rank: 1, id: "full_pool_verified_open_fallback" };
  if (candidate.sourcePool === "active") return { rank: 2, id: "active_hours_unverified_coverage" };
  return { rank: 3, id: "full_pool_hours_unverified_coverage" };
}

function canonicalIdentityCandidateOrder(left, right) {
  const leftRouteOrder = Number.isFinite(left.routeOrderSnapshot) ? left.routeOrderSnapshot : Number.MAX_SAFE_INTEGER;
  const rightRouteOrder = Number.isFinite(right.routeOrderSnapshot) ? right.routeOrderSnapshot : Number.MAX_SAFE_INTEGER;
  return governanceStage(left).rank - governanceStage(right).rank
    || leftRouteOrder - rightRouteOrder
    || left.sourceOrder - right.sourceOrder
    || normalizedText(`${left.name} ${left.address}`).localeCompare(normalizedText(`${right.name} ${right.address}`));
}

function resolveUniqueCanonicalBusinesses(candidates) {
  const uniqueCandidates = [];
  const duplicateAliases = [];
  const seen = new Set();
  for (const candidate of [...candidates].sort(canonicalIdentityCandidateOrder)) {
    if (seen.has(candidate.identityKey)) {
      duplicateAliases.push(candidate);
      continue;
    }
    seen.add(candidate.identityKey);
    uniqueCandidates.push(candidate);
  }
  return { uniqueCandidates, duplicateAliases };
}

function relationshipRank(candidate, config) {
  return config.relationshipPolicy.priorityOrder.indexOf(candidate.relationship.type);
}

function confidenceRank(candidate, config) {
  return config.relationshipPolicy.confidenceOrder.indexOf(candidate.relationship.confidence);
}

function sortCandidates(left, right, config) {
  return left.governanceStage.rank - right.governanceStage.rank
    || relationshipRank(left, config) - relationshipRank(right, config)
    || confidenceRank(left, config) - confidenceRank(right, config)
    || left.distanceFeet - right.distanceFeet
    || left.sourceOrder - right.sourceOrder
    || left.identityKey.localeCompare(right.identityKey);
}

function outputOrderingPreserved(entries, config) {
  const stageOrder = config.businessHoursPolicy.selectionOrder;
  for (let index = 1; index < entries.length; index += 1) {
    const previous = entries[index - 1];
    const current = entries[index];
    const previousStage = stageOrder.indexOf(previous.governanceStage);
    const currentStage = stageOrder.indexOf(current.governanceStage);
    if (previousStage > currentStage) return false;
    if (previousStage === currentStage) {
      const previousRelationship = config.relationshipPolicy.priorityOrder.indexOf(previous.relationship.type);
      const currentRelationship = config.relationshipPolicy.priorityOrder.indexOf(current.relationship.type);
      if (previousRelationship > currentRelationship) return false;
    }
  }
  return true;
}

function candidateExplanation(candidate, primary, config) {
  const relationship = candidate.relationship;
  const distance = Math.round(candidate.distanceFeet);
  const relationshipPhrase = relationship.type === "same_building"
    ? "shares the same building as"
    : relationship.type === "same_shopping_center"
      ? "is in the same shopping center as"
      : relationship.type === "same_commercial_parcel"
        ? "shares the same commercial parcel or parking context with"
        : relationship.type === "walkable"
          ? "is within the governed walkable range of"
          : "is close enough to";
  const verification = relationship.verification === "VERIFIED" ? "verified" : "inferred";
  const fallback = candidate.sourcePool === "full" ? " It entered through the governed Full Pool fallback." : "";
  const uncertain = candidate.eligibilitySnapshot.coverageOnly
    ? " Its hours are not verified, so confirm availability before walking over."
    : "";
  return {
    why: `${candidate.name} ${relationshipPhrase} ${primary.name} and remains an eligible secondary opportunity.`,
    evidence: `${relationship.label}; ${verification} relationship evidence; approximately ${distance} feet straight line; ${candidate.eligibilitySnapshot.displayLabel.toLowerCase()}.${fallback}`,
    confidence: `${relationship.confidence[0]}${relationship.confidence.slice(1).toLowerCase()} relationship confidence with ${candidate.eligibilitySnapshot.hoursConfidence.toLowerCase()} business-hours confidence.`,
    whatChanged: "Nearby Context now evaluates governed commercial-location relationships before treating proximity as ordinary nearby distance.",
    nextAction: `After the primary visit, consider ${candidate.name} as a secondary stop.${uncertain}`
  };
}

function normalizeCandidate(candidate, sourceOrder) {
  const name = candidateName(candidate);
  const address = candidateAddress(candidate);
  const normalized = {
    ...clone(candidate),
    name,
    businessName: name,
    address,
    googlePlaceId: cleanText(candidate?.googlePlaceId, 180),
    workspaceId: cleanText(candidate?.workspaceId, 80),
    operatingProfileId: cleanText(candidate?.operatingProfileId, 80),
    sourcePool: cleanText(candidate?.sourcePool, 40).toLowerCase(),
    sourceOrder: Number.isInteger(candidate?.sourceOrder) ? candidate.sourceOrder : sourceOrder,
    routeEligible: candidate?.routeEligible === true,
    businessStatus: cleanText(candidate?.businessStatus || candidate?.permanentOperationalStatus, 60).toUpperCase(),
    recommendationScoreSnapshot: finiteNumber(candidate?.recommendationScore ?? candidate?.score ?? candidate?.qualityScore),
    routeOrderSnapshot: finiteNumber(candidate?.routeOrder ?? candidate?.seedRouteOrder),
    commercialRelationships: commercialRelationships(candidate)
  };
  normalized.identityKey = routeQueueIdentity(normalized);
  return normalized;
}

function exclusion(candidate, reason, distanceFeet = null) {
  return {
    identityKey: candidate?.identityKey || "",
    googlePlaceId: candidate?.googlePlaceId || null,
    businessName: candidate?.name || candidateName(candidate) || null,
    sourcePool: candidate?.sourcePool || null,
    distanceFeet,
    reason,
    hoursStatus: candidate?.eligibilitySnapshot?.status || null
  };
}

export function buildNearbyContextAdvisory({
  workspaceId,
  operatingProfileId,
  representativeId,
  primary,
  candidates = [],
  completedIdentityKeys = [],
  generatedAt = new Date().toISOString(),
  config = loadNearbyContextConfig(),
  contract = loadNearbyContextContract(),
  sourceProvenance = {}
} = {}) {
  const configFailures = validateNearbyContextConfig(config);
  const contractFailures = validateNearbyContextContract(contract);
  if (configFailures.length || contractFailures.length) {
    throw new Error(`Nearby Context governance is invalid: ${[...configFailures, ...contractFailures].join(" | ")}`);
  }
  const scope = assertNearbyContextScope({ workspaceId, operatingProfileId, representativeId, contract });
  const primaryCandidate = normalizeCandidate({
    ...clone(primary),
    workspaceId: primary?.workspaceId || scope.workspaceId,
    operatingProfileId: primary?.operatingProfileId || scope.operatingProfileId,
    sourcePool: primary?.sourcePool || "active",
    routeEligible: true
  }, -1);
  const primaryCoordinates = candidateCoordinates(primaryCandidate);
  const completed = new Set((Array.isArray(completedIdentityKeys) ? completedIdentityKeys : []).map(value => cleanText(value, 500)).filter(Boolean));
  const exclusions = [];
  const eligibleBase = [];
  const input = (Array.isArray(candidates) ? candidates : []).slice(0, config.candidatePolicy.maximumCandidateScan);
  const inputTruncated = (Array.isArray(candidates) ? candidates.length : 0) > input.length;

  if (primaryCandidate.workspaceId !== scope.workspaceId || primaryCandidate.operatingProfileId !== scope.operatingProfileId) {
    throw new Error("Nearby Context primary recommendation scope mismatch.");
  }

  for (let index = 0; index < input.length; index += 1) {
    const candidate = normalizeCandidate(input[index], index);
    const coordinates = candidateCoordinates(candidate);
    const distanceFeet = primaryCoordinates && coordinates ? distanceFeetBetweenBusinesses(primaryCandidate, candidate) : null;
    if (config.candidatePolicy.forbiddenSourcePools.includes(candidate.sourcePool)) {
      exclusions.push(exclusion(candidate, "forbidden_source_pool", distanceFeet));
      continue;
    }
    if (!config.candidatePolicy.allowedSourcePools.includes(candidate.sourcePool)) {
      exclusions.push(exclusion(candidate, "unknown_source_pool", distanceFeet));
      continue;
    }
    if (candidate.workspaceId !== scope.workspaceId) {
      exclusions.push(exclusion(candidate, "workspace_mismatch", distanceFeet));
      continue;
    }
    if (candidate.operatingProfileId !== scope.operatingProfileId) {
      exclusions.push(exclusion(candidate, "operating_profile_mismatch", distanceFeet));
      continue;
    }
    if (!candidate.identityKey || !candidate.googlePlaceId || !candidate.name || !candidate.address) {
      exclusions.push(exclusion(candidate, "invalid_business_identity", distanceFeet));
      continue;
    }
    if (config.candidatePolicy.requiresOperationalBusinessStatus && candidate.businessStatus !== "OPERATIONAL") {
      exclusions.push(exclusion(candidate, "non_operational_business", distanceFeet));
      continue;
    }
    if (!candidate.routeEligible) {
      exclusions.push(exclusion(candidate, "existing_route_ineligible", distanceFeet));
      continue;
    }
    if (candidate.identityKey === primaryCandidate.identityKey) {
      exclusions.push(exclusion(candidate, "primary_business", distanceFeet));
      continue;
    }
    if (completed.has(candidate.identityKey)) {
      exclusions.push(exclusion(candidate, "completed_business", distanceFeet));
      continue;
    }
    if (!candidate.eligibilitySnapshot || candidate.eligibilitySnapshot.version !== routeBusinessHoursEligibilityVersion) {
      exclusions.push(exclusion(candidate, "canonical_hours_eligibility_missing", distanceFeet));
      continue;
    }
    if (candidate.eligibilitySnapshot.status === "CLOSED_VERIFIED") {
      exclusions.push(exclusion(candidate, "closed_verified", distanceFeet));
      continue;
    }
    if (candidate.eligibilitySnapshot.eligible !== true || candidate.eligibilitySnapshot.failClosed === true) {
      exclusions.push(exclusion(candidate, "canonical_hours_ineligible", distanceFeet));
      continue;
    }
    if (!primaryCoordinates) {
      exclusions.push(exclusion(candidate, "primary_coordinates_unavailable", null));
      continue;
    }
    if (!coordinates || distanceFeet === null) {
      exclusions.push(exclusion(candidate, "candidate_coordinates_unavailable", null));
      continue;
    }
    if (distanceFeet > config.relationshipPolicy.maximumSearchRadiusFeet) {
      exclusions.push(exclusion(candidate, "outside_maximum_search_radius", distanceFeet));
      continue;
    }
    eligibleBase.push({ ...candidate, distanceFeet });
  }

  const identityResolution = resolveUniqueCanonicalBusinesses(eligibleBase);
  for (const duplicate of identityResolution.duplicateAliases) {
    exclusions.push(exclusion(duplicate, "duplicate_business_identity", duplicate.distanceFeet));
  }

  const related = [];
  for (const candidate of identityResolution.uniqueCandidates) {
    const relationship = resolveRelationship(primaryCandidate, candidate, identityResolution.uniqueCandidates, config);
    if (!relationship) {
      exclusions.push(exclusion(candidate, "outside_nearby_relationship_scope", candidate.distanceFeet));
      continue;
    }
    related.push({ ...candidate, relationship, governanceStage: governanceStage(candidate) });
  }
  related.sort((left, right) => sortCandidates(left, right, config));

  const selected = related.slice(0, config.candidatePolicy.maximumResults).map((candidate, index) => ({
    order: index + 1,
    identityKey: candidate.identityKey,
    googlePlaceId: candidate.googlePlaceId,
    businessName: candidate.name,
    address: candidate.address,
    category: cleanText(candidate.category, 100) || "Other",
    sourcePool: candidate.sourcePool,
    governanceStage: candidate.governanceStage.id,
    distanceFeet: candidate.distanceFeet,
    distanceMethod: config.relationshipPolicy.straightLineDistanceLabel,
    relationship: clone(candidate.relationship),
    eligibilitySnapshot: clone(candidate.eligibilitySnapshot),
    recommendationScoreSnapshot: candidate.recommendationScoreSnapshot,
    recommendationScoreUsedForOrdering: false,
    recommendationScoreChanged: false,
    explanation: candidateExplanation(candidate, primaryCandidate, config)
  }));

  const selectedIdentitySet = new Set(selected.map(candidate => candidate.identityKey));
  const hoursDecisions = input.map(candidate => candidate?.eligibilitySnapshot).filter(Boolean);
  const nearbyGovernanceExclusions = exclusions.filter(item => item.reason !== "primary_business"
    && item.distanceFeet !== null
    && item.distanceFeet <= config.relationshipPolicy.nearbyMaximumFeet);
  const emptyReasonCodes = unique([
    !primaryCoordinates ? "primary_coordinates_unavailable" : "",
    input.length === 0 ? "no_candidate_supply" : "",
    selected.length === 0 ? "no_governed_eligible_nearby_supply" : "",
    nearbyGovernanceExclusions.some(item => item.reason === "forbidden_source_pool") ? "nearby_candidates_quarantined" : "",
    nearbyGovernanceExclusions.some(item => item.reason === "closed_verified") ? "nearby_candidates_closed_verified" : "",
    nearbyGovernanceExclusions.some(item => item.reason === "completed_business") ? "nearby_candidates_already_completed" : ""
  ]);
  const status = selected.length ? "opportunities_available" : primaryCoordinates ? "coverage_gap" : "primary_context_unavailable";
  const outputEntries = selected.map(entry => deepFreeze(entry));
  const eligibleIdentityCount = new Set(eligibleBase.map(candidate => candidate.identityKey)).size;
  const relationshipInferenceIdentities = new Set(identityResolution.uniqueCandidates.map(candidate => candidate.identityKey));
  const identityResolutionComplete = identityResolution.uniqueCandidates.length === eligibleIdentityCount
    && identityResolution.uniqueCandidates.length + identityResolution.duplicateAliases.length === eligibleBase.length;
  const duplicateAliasesContributedToInference = identityResolution.duplicateAliases.some(candidate => identityResolution.uniqueCandidates.includes(candidate));
  const validation = {
    deterministicOrderingRequired: true,
    canonicalBusinessHoursEligibilityPreserved: outputEntries.every(entry => entry.eligibilitySnapshot?.version === routeBusinessHoursEligibilityVersion),
    closedVerifiedExcluded: outputEntries.every(entry => entry.eligibilitySnapshot?.status !== "CLOSED_VERIFIED"),
    quarantineExcluded: outputEntries.every(entry => !config.candidatePolicy.forbiddenSourcePools.includes(entry.sourcePool)),
    completedBusinessesExcluded: outputEntries.every(entry => !completed.has(entry.identityKey)),
    primaryBusinessExcluded: outputEntries.every(entry => entry.identityKey !== primaryCandidate.identityKey),
    duplicatePreventionPassed: outputEntries.length === selectedIdentitySet.size,
    canonicalIdentityResolutionPreserved: identityResolution.uniqueCandidates.every(candidate => candidate.identityKey === `google:${candidate.googlePlaceId}`),
    duplicatesRemovedBeforeRelationshipInference: identityResolutionComplete,
    relationshipInferenceUniqueBusinessesOnly: identityResolutionComplete
      && identityResolution.uniqueCandidates.length === relationshipInferenceIdentities.size,
    duplicateAliasesContributedToInference,
    workspaceIsolationPassed: true,
    operatingProfileIsolationPassed: true,
    relationshipPriorityPreserved: outputOrderingPreserved(outputEntries, config),
    explanationsComplete: outputEntries.every(entry => config.explainability.requiredQuestions.every(field => Boolean(entry.explanation?.[field]))),
    recommendationScoresUsedForOrdering: false,
    recommendationScoresChanged: false,
    liveGoogleCallsMade: false,
    recommendationReplacementActive: false,
    productionQueueMutationActive: false,
    dashboardConsumerActive: false,
    routeScoringWeightsChanged: false,
    dashboardRuntimeChanged: false,
    dataChanged: false,
    crmChanged: false,
    companionChanged: false
  };

  return deepFreeze({
    artifactType: "nearby_context_advisory_plan",
    version: nearbyContextIntelligenceVersion,
    policyVersion: config.policyVersion,
    contractVersion: contract.contractVersion,
    identityIntegrationVersion: nearbyContextDuplicateIdentityIntegrationRepairVersion,
    status,
    generatedAt: cleanText(generatedAt, 40),
    workspaceId: scope.workspaceId,
    operatingProfileId: scope.operatingProfileId,
    representativeId: scope.representativeId,
    primary: {
      identityKey: primaryCandidate.identityKey || null,
      googlePlaceId: primaryCandidate.googlePlaceId || null,
      businessName: primaryCandidate.name || null,
      address: primaryCandidate.address || null,
      coordinatesAvailable: Boolean(primaryCoordinates)
    },
    sourceProvenance: clone(sourceProvenance),
    fieldEvidenceBasis: clone(config.fieldEvidenceBasis),
    architecture: {
      purpose: "secondary_arrival_opportunities_not_recommendation_replacement",
      eligibilityBoundary: "before_relationship_classification",
      identityBoundary: "after_eligibility_before_relationship_classification",
      canonicalIdentityImplementation: config.identityPolicy.canonicalImplementation,
      canonicalIdentityFunction: config.identityPolicy.canonicalFunction,
      identityIntegrationVersion: nearbyContextDuplicateIdentityIntegrationRepairVersion,
      relationshipInferenceInput: "unique_canonical_businesses_only",
      executionOrder: clone(config.identityPolicy.executionOrder),
      canonicalHoursImplementation: config.businessHoursPolicy.canonicalImplementation,
      canonicalHoursVersion: routeBusinessHoursEligibilityVersion,
      activePoolPriority: true,
      governedFullPoolFallback: true,
      relationshipPriority: clone(config.relationshipPolicy.priorityOrder),
      relationshipEvidence: "verified_structured_identifiers_or_disclosed_conservative_inference",
      distanceMethod: config.relationshipPolicy.straightLineDistanceLabel,
      runtimeConsumerActive: false,
      recommendationScoreOrdering: false
    },
    nearbyOpportunities: {
      title: config.explainability.title,
      status,
      maximumResults: config.candidatePolicy.maximumResults,
      count: outputEntries.length,
      entries: outputEntries,
      emptyState: outputEntries.length ? null : {
        code: status === "primary_context_unavailable" ? "PRIMARY_CONTEXT_UNAVAILABLE" : "GOVERNED_NEARBY_SUPPLY_UNAVAILABLE",
        message: config.explainability.emptyStateMessage,
        detail: config.explainability.coverageGapMessage,
        reasonCodes: emptyReasonCodes,
        recommendationInvented: false,
        nextAction: "Continue with the primary visit. Nearby coverage can improve as verified storefront records become available."
      }
    },
    coverage: {
      suppliedCandidateCount: Array.isArray(candidates) ? candidates.length : 0,
      scannedCandidateCount: input.length,
      inputTruncated,
      eligibleCandidateCountBeforeIdentityResolution: eligibleBase.length,
      canonicalUniqueBusinessCount: identityResolution.uniqueCandidates.length,
      preRelationshipDuplicateCount: identityResolution.duplicateAliases.length,
      relationshipInferenceInputCount: identityResolution.uniqueCandidates.length,
      relationshipInferenceUniqueIdentityCount: relationshipInferenceIdentities.size,
      duplicateAliasesContributedToInference,
      eligibleRelationshipCandidateCount: related.length,
      selectedCandidateCount: outputEntries.length,
      sourcePoolDistribution: countBy(input, item => item?.sourcePool),
      selectedSourcePoolDistribution: countBy(outputEntries, item => item.sourcePool),
      selectedGovernanceStageDistribution: countBy(outputEntries, item => item.governanceStage),
      selectedRelationshipDistribution: countBy(outputEntries, item => item.relationship.type),
      selectedHoursStatusDistribution: countBy(outputEntries, item => item.eligibilitySnapshot.status),
      hoursEvaluation: summarizeRouteBusinessHours(hoursDecisions),
      exclusionCount: exclusions.length,
      exclusionReasonDistribution: countBy(exclusions, item => item.reason),
      nearbyGovernanceExclusionCount: nearbyGovernanceExclusions.length,
      exclusions: exclusions.sort((left, right) => (left.distanceFeet ?? Number.MAX_SAFE_INTEGER) - (right.distanceFeet ?? Number.MAX_SAFE_INTEGER)
        || String(left.businessName).localeCompare(String(right.businessName))).slice(0, 100),
      fullPoolFallbackUsed: outputEntries.some(entry => entry.sourcePool === "full"),
      coverageGapDetected: outputEntries.length === 0,
      governedDataInvented: false
    },
    explainabilityModel: {
      requiredQuestions: clone(config.explainability.requiredQuestions),
      relationshipVerificationVisible: true,
      hoursProvenancePreserved: true,
      sourcePoolVisible: true,
      distanceVisible: true,
      internalFormulaExposureAllowed: false,
      proprietaryWeightExposureAllowed: false
    },
    validation
  });
}

export function validateNearbyContextAdvisory(plan, config = loadNearbyContextConfig()) {
  const failures = [];
  const fail = (condition, reason) => { if (!condition) failures.push(reason); };
  const entries = plan?.nearbyOpportunities?.entries || [];
  const requiredSections = ["architecture", "nearbyOpportunities", "coverage", "explainabilityModel", "validation"];
  fail(plan?.artifactType === "nearby_context_advisory_plan", "artifact_type_mismatch");
  fail(plan?.version === nearbyContextIntelligenceVersion, "plan_version_mismatch");
  fail(plan?.policyVersion === nearbyContextPolicyVersion, "plan_policy_version_mismatch");
  fail(plan?.contractVersion === nearbyContextContractVersion, "plan_contract_version_mismatch");
  fail(plan?.identityIntegrationVersion === nearbyContextDuplicateIdentityIntegrationRepairVersion, "plan_identity_integration_version_mismatch");
  fail(plan?.workspaceId === config.workspaceId, "plan_workspace_mismatch");
  fail(plan?.operatingProfileId === config.operatingProfileId, "plan_operating_profile_mismatch");
  for (const section of requiredSections) fail(Boolean(plan?.[section]), `missing_section:${section}`);
  fail(entries.length <= config.candidatePolicy.maximumResults, "plan_exceeds_maximum_results");
  fail(entries.length === new Set(entries.map(entry => entry.identityKey)).size, "plan_contains_duplicate_businesses");
  fail(entries.every(entry => config.candidatePolicy.allowedSourcePools.includes(entry.sourcePool)), "plan_contains_forbidden_source_pool");
  fail(entries.every(entry => entry.eligibilitySnapshot?.version === routeBusinessHoursEligibilityVersion), "plan_contains_noncanonical_hours_eligibility");
  fail(entries.every(entry => entry.eligibilitySnapshot?.status !== "CLOSED_VERIFIED"), "plan_contains_closed_verified_business");
  fail(entries.every(entry => entry.eligibilitySnapshot?.eligible === true), "plan_contains_hours_ineligible_business");
  fail(entries.every(entry => config.relationshipPolicy.priorityOrder.includes(entry.relationship?.type)), "plan_contains_unknown_relationship");
  fail(outputOrderingPreserved(entries, config), "plan_relationship_or_governance_order_regressed");
  fail(entries.every(entry => config.explainability.requiredQuestions.every(field => Boolean(entry.explanation?.[field]))), "plan_explanation_incomplete");
  fail(entries.every(entry => entry.recommendationScoreUsedForOrdering === false && entry.recommendationScoreChanged === false), "plan_changed_recommendation_scoring");
  fail(plan?.nearbyOpportunities?.title === config.explainability.title, "consumer_title_mismatch");
  fail(plan?.coverage?.governedDataInvented === false, "governed_data_invention_detected");
  fail(plan?.architecture?.canonicalIdentityFunction === "routeQueueIdentity", "plan_canonical_identity_function_mismatch");
  fail(plan?.architecture?.relationshipInferenceInput === "unique_canonical_businesses_only", "plan_relationship_inference_input_mismatch");
  fail(JSON.stringify(plan?.architecture?.executionOrder) === JSON.stringify(config.identityPolicy.executionOrder), "plan_identity_execution_order_mismatch");
  fail(plan?.coverage?.eligibleCandidateCountBeforeIdentityResolution === plan?.coverage?.canonicalUniqueBusinessCount + plan?.coverage?.preRelationshipDuplicateCount, "identity_resolution_count_mismatch");
  fail(plan?.coverage?.canonicalUniqueBusinessCount === plan?.coverage?.relationshipInferenceInputCount, "relationship_inference_received_noncanonical_count");
  fail(plan?.coverage?.relationshipInferenceInputCount === plan?.coverage?.relationshipInferenceUniqueIdentityCount, "relationship_inference_received_duplicate_identity");
  fail(plan?.coverage?.duplicateAliasesContributedToInference === false, "duplicate_alias_contributed_to_relationship_inference");
  if (!entries.length) {
    fail(Boolean(plan?.nearbyOpportunities?.emptyState), "empty_state_missing");
    fail(plan?.nearbyOpportunities?.emptyState?.recommendationInvented === false, "empty_state_invented_recommendation");
  }
  for (const field of [
    "canonicalBusinessHoursEligibilityPreserved",
    "closedVerifiedExcluded",
    "quarantineExcluded",
    "completedBusinessesExcluded",
    "primaryBusinessExcluded",
    "duplicatePreventionPassed",
    "canonicalIdentityResolutionPreserved",
    "duplicatesRemovedBeforeRelationshipInference",
    "relationshipInferenceUniqueBusinessesOnly",
    "workspaceIsolationPassed",
    "operatingProfileIsolationPassed",
    "relationshipPriorityPreserved",
    "explanationsComplete"
  ]) fail(plan?.validation?.[field] === true, `validation_failed:${field}`);
  for (const field of [
    "recommendationScoresUsedForOrdering",
    "recommendationScoresChanged",
    "duplicateAliasesContributedToInference",
    "liveGoogleCallsMade",
    "recommendationReplacementActive",
    "productionQueueMutationActive",
    "dashboardConsumerActive",
    "routeScoringWeightsChanged",
    "dashboardRuntimeChanged",
    "dataChanged",
    "crmChanged",
    "companionChanged"
  ]) fail(plan?.validation?.[field] === false, `protected_behavior_changed:${field}`);
  return unique(failures);
}
