import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  applyCanonicalBusinessHoursEligibilityToNearbyCandidates,
  buildNearbyContextAdvisory,
  loadNearbyContextConfig,
  loadNearbyContextContract,
  nearbyContextDuplicateIdentityIntegrationRepairVersion,
  normalizeCommercialAddress,
  validateNearbyContextAdvisory,
  validateNearbyContextConfig,
  validateNearbyContextContract
} from "../intelligence/nearby-context-intelligence-v2.mjs";
import { routeQueueIdentity } from "../intelligence/continuous-adaptive-route-replenishment.mjs";
import { buildRouteBusinessHoursIndex } from "../intelligence/route-business-hours-eligibility.mjs";
import { verifyNearbyContextIntelligenceV2 } from "../scripts/verify-nearby-context-intelligence-v2.mjs";

const businessHours = JSON.parse(readFileSync(new URL("../data/qualified-prospects/google-qualified-businesses-v2/business-hours-v1/business-hours.json", import.meta.url), "utf8"));
const hoursIndex = buildRouteBusinessHoursIndex(businessHours);
const config = loadNearbyContextConfig();
const contract = loadNearbyContextContract();
const openRecords = businessHours.records.filter(record => record.currentOpenClosedEligibilityStatus === "OPEN_VERIFIED");
const unknownRecord = businessHours.records.find(record => record.currentOpenClosedEligibilityStatus === "HOURS_UNKNOWN");
const closedRecord = businessHours.records.find(record => record.currentOpenClosedEligibilityStatus === "CLOSED_VERIFIED");

function candidate(record, overrides = {}) {
  return {
    googlePlaceId: record.googlePlaceId,
    name: record.businessName,
    address: record.address,
    category: record.category,
    latitude: record.latitude,
    longitude: record.longitude,
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    sourcePool: "active",
    routeEligible: true,
    businessStatus: "OPERATIONAL",
    recommendationScore: 88,
    ...overrides
  };
}

function project(candidates) {
  return applyCanonicalBusinessHoursEligibilityToNearbyCandidates({
    candidates,
    hoursIndex,
    evaluatedAt: businessHours.statusEvaluatedAt,
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness"
  }).evaluatedCandidates;
}

function plan(primary, candidates, options = {}) {
  return buildNearbyContextAdvisory({
    workspaceId: options.workspaceId || "fitness_connection",
    operatingProfileId: options.operatingProfileId || "fitness",
    representativeId: options.representativeId || "cruz",
    primary,
    candidates: project(candidates),
    completedIdentityKeys: options.completedIdentityKeys || [],
    generatedAt: businessHours.statusEvaluatedAt,
    config,
    contract
  });
}

test("Nearby Context configuration and contracts preserve advisory-only boundaries", () => {
  assert.deepEqual(validateNearbyContextConfig(config), []);
  assert.deepEqual(validateNearbyContextContract(contract), []);
  assert.equal(config.activationSafety.dashboardConsumerActive, false);
  assert.equal(config.activationSafety.routeScoringWeightsChanged, false);
  assert.equal(config.candidatePolicy.recommendationScoreUsedForOrdering, false);
});

test("commercial address normalization removes unit labels without merging street numbers", () => {
  assert.deepEqual(normalizeCommercialAddress("100 Commerce Boulevard Suite 200, Houston, TX"), {
    baseAddress: "100 commerce blvd",
    streetNumber: 100,
    streetKey: "commerce blvd"
  });
  assert.notEqual(
    normalizeCommercialAddress("100 Commerce Blvd, Houston, TX").baseAddress,
    normalizeCommercialAddress("120 Commerce Blvd, Houston, TX").baseAddress
  );
});

test("relationship priority is same building, center, parcel, walkable, then nearby", () => {
  assert.ok(openRecords.length >= 6);
  const latitude = 29.6;
  const longitude = -95.25;
  const primary = candidate(openRecords[0], {
    name: "Primary Opportunity",
    address: "100 Primary Rd, Houston, TX",
    latitude,
    longitude,
    commercialRelationships: { buildingId: "building-a", shoppingCenterId: "center-a", commercialParcelId: "parcel-a" }
  });
  const candidates = [
    candidate(openRecords[1], {
      name: "Nearby Distance First",
      address: "900 Near Rd, Houston, TX",
      latitude: latitude + 0.004,
      longitude
    }),
    candidate(openRecords[2], {
      name: "Walkable Distance",
      address: "800 Walk Rd, Houston, TX",
      latitude: latitude + 0.0015,
      longitude
    }),
    candidate(openRecords[3], {
      name: "Parcel Match",
      address: "700 Parcel Rd, Houston, TX",
      latitude: latitude + 0.0002,
      longitude,
      commercialRelationships: { commercialParcelId: "parcel-a" }
    }),
    candidate(openRecords[4], {
      name: "Center Match",
      address: "600 Center Rd, Houston, TX",
      latitude: latitude + 0.0007,
      longitude,
      commercialRelationships: { shoppingCenterId: "center-a" }
    }),
    candidate(openRecords[5], {
      name: "Building Match",
      address: "500 Building Rd, Houston, TX",
      latitude: latitude + 0.0005,
      longitude,
      commercialRelationships: { buildingId: "building-a" }
    })
  ];
  const result = plan(primary, candidates);
  assert.deepEqual(result.nearbyOpportunities.entries.map(entry => entry.relationship.type), [
    "same_building",
    "same_shopping_center",
    "same_commercial_parcel",
    "walkable",
    "nearby"
  ]);
  assert.deepEqual(result.nearbyOpportunities.entries.map(entry => entry.businessName), [
    "Building Match",
    "Center Match",
    "Parcel Match",
    "Walkable Distance",
    "Nearby Distance First"
  ]);
  assert.equal(result.nearbyOpportunities.entries.every(entry => entry.recommendationScoreUsedForOrdering === false), true);
  assert.deepEqual(validateNearbyContextAdvisory(result, config), []);
});

test("bounded street clusters are disclosed as inferred shopping-center context", () => {
  const latitude = 29.6;
  const longitude = -95.25;
  const primary = candidate(openRecords[0], {
    address: "100 Commerce Blvd, Houston, TX",
    latitude,
    longitude
  });
  const result = plan(primary, [
    candidate(openRecords[1], {
      address: "120 Commerce Boulevard, Houston, TX",
      latitude: latitude + 0.0004,
      longitude
    }),
    candidate(openRecords[2], {
      address: "140 Commerce Blvd, Houston, TX",
      latitude: latitude + 0.0008,
      longitude
    })
  ]);
  assert.equal(result.nearbyOpportunities.count, 2);
  assert.equal(result.nearbyOpportunities.entries.every(entry => entry.relationship.type === "same_shopping_center"), true);
  assert.equal(result.nearbyOpportunities.entries.every(entry => entry.relationship.verification === "INFERRED"), true);
  assert.equal(result.nearbyOpportunities.entries.every(entry => entry.relationship.evidence.includes("minimum_governed_cluster_members_met")), true);
});

test("duplicate aliases are removed before shopping-center inference", () => {
  const latitude = 29.6;
  const longitude = -95.25;
  const primary = candidate(openRecords[0], {
    name: "Primary Business",
    address: "100 Identity Repair Blvd, Houston, TX",
    latitude,
    longitude
  });
  const canonicalBusiness = candidate(openRecords[1], {
    name: "Canonical Storefront",
    address: "120 Identity Repair Boulevard, Houston, TX",
    latitude: latitude + 0.0004,
    longitude
  });
  const duplicateAlias = candidate(openRecords[1], {
    name: "Storefront Alias",
    address: "140 Identity Repair Blvd, Houston, TX",
    latitude: latitude + 0.0008,
    longitude
  });
  const result = plan(primary, [canonicalBusiness, duplicateAlias]);

  assert.equal(result.identityIntegrationVersion, nearbyContextDuplicateIdentityIntegrationRepairVersion);
  assert.equal(result.coverage.eligibleCandidateCountBeforeIdentityResolution, 2);
  assert.equal(result.coverage.canonicalUniqueBusinessCount, 1);
  assert.equal(result.coverage.preRelationshipDuplicateCount, 1);
  assert.equal(result.coverage.relationshipInferenceInputCount, 1);
  assert.equal(result.coverage.relationshipInferenceUniqueIdentityCount, 1);
  assert.equal(result.coverage.duplicateAliasesContributedToInference, false);
  assert.equal(result.nearbyOpportunities.count, 1);
  assert.equal(result.nearbyOpportunities.entries[0].businessName, "Canonical Storefront");
  assert.equal(result.nearbyOpportunities.entries[0].relationship.type, "walkable");
  assert.notEqual(result.nearbyOpportunities.entries[0].relationship.type, "same_shopping_center");
  assert.equal(result.validation.duplicatesRemovedBeforeRelationshipInference, true);
  assert.equal(result.validation.relationshipInferenceUniqueBusinessesOnly, true);
  assert.equal(result.validation.duplicateAliasesContributedToInference, false);
  assert.deepEqual(validateNearbyContextAdvisory(result, config), []);
});

test("legitimate multi-tenant businesses remain distinct canonical identities", () => {
  const latitude = 29.6;
  const longitude = -95.25;
  const primary = candidate(openRecords[0], {
    name: "Building Anchor",
    address: "200 Multi Tenant Way Suite P, Houston, TX",
    latitude,
    longitude
  });
  const result = plan(primary, [
    candidate(openRecords[1], {
      name: "Tenant One",
      address: "200 Multi Tenant Way Suite A, Houston, TX",
      latitude: latitude + 0.0001,
      longitude
    }),
    candidate(openRecords[2], {
      name: "Tenant Two",
      address: "200 Multi Tenant Way Suite B, Houston, TX",
      latitude: latitude + 0.0002,
      longitude
    })
  ]);

  assert.equal(result.coverage.eligibleCandidateCountBeforeIdentityResolution, 2);
  assert.equal(result.coverage.canonicalUniqueBusinessCount, 2);
  assert.equal(result.coverage.preRelationshipDuplicateCount, 0);
  assert.equal(result.coverage.relationshipInferenceInputCount, 2);
  assert.equal(result.nearbyOpportunities.count, 2);
  assert.equal(new Set(result.nearbyOpportunities.entries.map(entry => entry.identityKey)).size, 2);
  assert.equal(result.nearbyOpportunities.entries.every(entry => entry.relationship.type === "same_building"), true);
});

test("canonical eligibility, quarantine, completion, identity, and workspace gates run before relationships", () => {
  assert.ok(closedRecord);
  const latitude = 29.6;
  const longitude = -95.25;
  const primary = candidate(openRecords[0], { latitude, longitude });
  const accepted = candidate(openRecords[1], {
    name: "Accepted",
    latitude: latitude + 0.0005,
    longitude
  });
  const duplicate = candidate(openRecords[1], {
    name: "Duplicate Alias",
    sourcePool: "full",
    latitude: latitude + 0.0003,
    longitude
  });
  const completed = candidate(openRecords[2], {
    name: "Completed",
    latitude: latitude + 0.0006,
    longitude
  });
  const closed = candidate(closedRecord, {
    name: "Closed Candidate",
    latitude: latitude + 0.0002,
    longitude,
    commercialRelationships: { buildingId: "primary-building" }
  });
  const quarantine = candidate(openRecords[3], {
    name: "Quarantined Candidate",
    sourcePool: "quarantine",
    latitude: latitude + 0.0001,
    longitude
  });
  const crossWorkspace = candidate(openRecords[4], {
    name: "Cross Workspace",
    workspaceId: "smoothie_depot",
    latitude: latitude + 0.0001,
    longitude
  });
  const missingOperationalStatus = candidate(openRecords[5], {
    name: "Missing Operational Status",
    businessStatus: "",
    latitude: latitude + 0.0001,
    longitude
  });
  const result = plan(primary, [accepted, duplicate, completed, closed, quarantine, crossWorkspace, missingOperationalStatus], {
    completedIdentityKeys: [routeQueueIdentity(completed)]
  });
  assert.deepEqual(result.nearbyOpportunities.entries.map(entry => entry.businessName), ["Accepted"]);
  assert.equal(result.coverage.exclusionReasonDistribution.duplicate_business_identity, 1);
  assert.equal(result.coverage.exclusionReasonDistribution.completed_business, 1);
  assert.equal(result.coverage.exclusionReasonDistribution.closed_verified, 1);
  assert.equal(result.coverage.exclusionReasonDistribution.forbidden_source_pool, 1);
  assert.equal(result.coverage.exclusionReasonDistribution.workspace_mismatch, 1);
  assert.equal(result.coverage.exclusionReasonDistribution.non_operational_business, 1);
  assert.equal(result.validation.closedVerifiedExcluded, true);
  assert.equal(result.validation.quarantineExcluded, true);
  assert.equal(result.validation.completedBusinessesExcluded, true);
  assert.equal(result.validation.duplicatePreventionPassed, true);
});

test("governance stage ordering preserves Active and Full Pool hours policy", () => {
  assert.ok(unknownRecord);
  const latitude = 29.6;
  const longitude = -95.25;
  const primary = candidate(openRecords[0], { latitude, longitude });
  const result = plan(primary, [
    candidate(unknownRecord, {
      name: "Active Hours Unknown",
      sourcePool: "active",
      latitude: latitude + 0.0001,
      longitude
    }),
    candidate(openRecords[1], {
      name: "Full Open",
      sourcePool: "full",
      latitude: latitude + 0.0002,
      longitude
    }),
    candidate(openRecords[2], {
      name: "Active Open",
      sourcePool: "active",
      latitude: latitude + 0.0003,
      longitude
    })
  ]);
  assert.deepEqual(result.nearbyOpportunities.entries.map(entry => entry.governanceStage), [
    "active_verified_open",
    "full_pool_verified_open_fallback",
    "active_hours_unverified_coverage"
  ]);
  assert.equal(result.coverage.fullPoolFallbackUsed, true);
  assert.equal(result.nearbyOpportunities.entries[2].eligibilitySnapshot.coverageOnly, true);
});

test("missing primary coordinates returns a controlled explainable state", () => {
  const primary = candidate(openRecords[0], { latitude: null, longitude: null });
  const result = plan(primary, [candidate(openRecords[1])]);
  assert.equal(result.status, "primary_context_unavailable");
  assert.equal(result.nearbyOpportunities.count, 0);
  assert.equal(result.nearbyOpportunities.emptyState.code, "PRIMARY_CONTEXT_UNAVAILABLE");
  assert.equal(result.nearbyOpportunities.emptyState.recommendationInvented, false);
  assert.deepEqual(validateNearbyContextAdvisory(result, config), []);
});

test("unknown workspaces and operating profiles fail closed", () => {
  const primary = candidate(openRecords[0]);
  assert.throws(() => buildNearbyContextAdvisory({
    workspaceId: "smoothie_depot",
    operatingProfileId: "fitness",
    representativeId: "cruz",
    primary,
    candidates: []
  }), /not authorized/);
  assert.throws(() => buildNearbyContextAdvisory({
    workspaceId: "fitness_connection",
    operatingProfileId: "franchise_development",
    representativeId: "cruz",
    primary,
    candidates: []
  }), /operating profile mismatch/);
});

test("canonical audit reproduces field coverage gaps and proves governed nearby output", () => {
  const result = verifyNearbyContextIntelligenceV2();
  assert.equal(result.status, "passed");
  assert.equal(result.contexts.length, 2);
  assert.equal(result.contexts.every(context => context.status === "coverage_gap"), true);
  assert.equal(result.capabilityProbe.opportunityCount, 6);
  assert.deepEqual(result.capabilityProbe.relationshipDistribution, { walkable: 6 });
  assert.equal(result.safety.canonicalBusinessHoursEligibilityPreserved, true);
  assert.equal(result.safety.closedVerifiedExcluded, true);
  assert.equal(result.safety.quarantineExcluded, true);
  assert.equal(result.identityIntegration.duplicateAliasesRemovedBeforeInference, true);
  assert.equal(result.identityIntegration.shoppingCenterInferenceRejectedDuplicateInflation, true);
  assert.equal(result.identityIntegration.multiTenantDistinctnessPreserved, true);
  assert.equal(result.safety.recommendationScoresChanged, false);
  assert.equal(result.failures.length, 0);
});
