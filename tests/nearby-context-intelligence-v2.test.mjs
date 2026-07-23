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
import {
  buildRouteBusinessHoursIndex,
  routeBusinessHoursEligibilityVersion
} from "../intelligence/route-business-hours-eligibility.mjs";
import { verifyNearbyContextIntelligenceV2 } from "../scripts/verify-nearby-context-intelligence-v2.mjs";

const businessHours = JSON.parse(readFileSync(new URL("../data/qualified-prospects/google-qualified-businesses-v2/business-hours-v1/business-hours.json", import.meta.url), "utf8"));
const hoursIndex = buildRouteBusinessHoursIndex(businessHours);
const config = loadNearbyContextConfig();
const contract = loadNearbyContextContract();
const evaluationTime = businessHours.statusEvaluatedAt;
const syntheticRecords = Array.from({ length: 10 }, (_, index) => ({
  googlePlaceId: `synthetic-nearby-place-${index + 1}`,
  businessName: `Synthetic Nearby Business ${index + 1}`,
  address: `${100 + index} Validation Way, Houston, TX 77001`,
  category: "Professional Services",
  latitude: 29.6 + (index * 0.0001),
  longitude: -95.25,
  fixtureStatus: "OPEN_VERIFIED"
}));
const openRecords = syntheticRecords;
const unknownRecord = { ...syntheticRecords[8], googlePlaceId: "synthetic-nearby-unknown", fixtureStatus: "HOURS_UNKNOWN" };
const closedRecord = { ...syntheticRecords[9], googlePlaceId: "synthetic-nearby-closed", fixtureStatus: "CLOSED_VERIFIED" };

function eligibilityFixture(record, status = record.fixtureStatus || "OPEN_VERIFIED") {
  const immediateRecommendationEligible = status === "OPEN_VERIFIED";
  const coverageEligible = ["OPEN_VERIFIED", "CLOSED_VERIFIED", "HOURS_UNKNOWN", "HOURS_STALE", "SPECIAL_HOURS_UNVERIFIED"].includes(status);
  const reasonCode = status === "OPEN_VERIFIED"
    ? "VERIFIED_CURRENT_WINDOW_OPEN"
    : status === "CLOSED_VERIFIED"
      ? "VERIFIED_CURRENT_WINDOW_CLOSED"
      : status === "HOURS_STALE"
        ? "HOURS_SOURCE_STALE"
        : "HOURS_SOURCE_MISSING";
  const reason = immediateRecommendationEligible
    ? "Offline validation fixture is inside its verified current access window."
    : "Offline validation fixture is not eligible for an immediate stop.";
  const provenance = {
    sourceSystem: "OFFLINE_VALIDATION_FIXTURE",
    sourceMethod: "deterministic_nearby_test",
    sourcePlaceId: record.googlePlaceId,
    retrievedAt: evaluationTime,
    normalizedAt: evaluationTime,
    fieldEvidenceIds: []
  };
  return {
    version: routeBusinessHoursEligibilityVersion,
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    googlePlaceId: record.googlePlaceId,
    permanentOperationalStatus: "OPERATIONAL",
    status,
    eligible: immediateRecommendationEligible,
    coverageEligible,
    immediateRecommendationEligible,
    coverageOnly: coverageEligible && !immediateRecommendationEligible,
    selectionTier: immediateRecommendationEligible ? 0 : 99,
    internalMarker: immediateRecommendationEligible ? null : "HOURS_NOT_VERIFIED",
    hoursConfidence: ["OPEN_VERIFIED", "CLOSED_VERIFIED"].includes(status) ? "HIGH" : "NONE",
    hoursFreshness: status === "HOURS_STALE" ? "STALE" : status === "HOURS_UNKNOWN" ? "MISSING" : "FRESH",
    sourceState: status === "HOURS_STALE" ? "STALE" : status === "HOURS_UNKNOWN" ? "MISSING" : "VERIFIED",
    reasonCode,
    reason,
    evaluatedAt: evaluationTime,
    businessLocalDate: evaluationTime.slice(0, 10),
    businessLocalTime: "12:00",
    businessTimezone: "America/Chicago",
    sourceRetrievedAt: evaluationTime,
    hoursVerifiedAt: evaluationTime,
    expiresAt: new Date(new Date(evaluationTime).getTime() + 3_600_000).toISOString(),
    effectiveInterval: immediateRecommendationEligible ? {
      opensAt: evaluationTime,
      closesAt: new Date(new Date(evaluationTime).getTime() + 3_600_000).toISOString()
    } : null,
    nextClosingAt: immediateRecommendationEligible
      ? new Date(new Date(evaluationTime).getTime() + 3_600_000).toISOString()
      : null,
    nextOpeningAt: null,
    sourceStatus: status,
    sourceStatusEvaluatedAt: evaluationTime,
    provenance,
    failClosed: !immediateRecommendationEligible && !coverageEligible,
    scoringChanged: false,
    explanation: {
      recommendationScore: "UNCHANGED",
      businessHoursEligibility: status,
      hoursConfidence: ["OPEN_VERIFIED", "CLOSED_VERIFIED"].includes(status) ? "HIGH" : "NONE",
      hoursFreshness: status === "HOURS_STALE" ? "STALE" : status === "HOURS_UNKNOWN" ? "MISSING" : "FRESH",
      reasonCode,
      reason,
      provenance
    },
    displayLabel: status === "OPEN_VERIFIED"
      ? "Open now"
      : status === "CLOSED_VERIFIED"
        ? "Closed"
        : "Hours unavailable · not route eligible",
    visitDuration: {
      label: "Estimated visit: 5–9 min",
      minimumMinutes: 5,
      maximumMinutes: 9,
      semanticType: "VISIT_DURATION"
    }
  };
}

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
    eligibilitySnapshot: eligibilityFixture(record),
    ...overrides
  };
}

function project(candidates) {
  return candidates.map((item, sourceOrder) => ({
    ...item,
    sourceOrder,
    nearbyRouteEligible: item.routeEligible === true
      && item.eligibilitySnapshot?.immediateRecommendationEligible === true
  }));
}

function plan(primary, candidates, options = {}) {
  return buildNearbyContextAdvisory({
    workspaceId: options.workspaceId || "fitness_connection",
    operatingProfileId: options.operatingProfileId || "fitness",
    representativeId: options.representativeId || "cruz",
    primary,
    candidates: project(candidates),
    completedIdentityKeys: options.completedIdentityKeys || [],
    generatedAt: evaluationTime,
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
    workspaceId: "unauthorized_workspace_fixture",
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

test("governance stage ordering selects only immediate-eligible Active and Full Pool candidates", () => {
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
    "full_pool_verified_open_fallback"
  ]);
  assert.equal(result.coverage.fullPoolFallbackUsed, true);
  assert.equal(result.coverage.exclusionReasonDistribution.canonical_hours_ineligible, 1);
  assert.equal(result.nearbyOpportunities.entries.some(entry => entry.eligibilitySnapshot.coverageOnly), false);
});

test("current canonical stale or unavailable evidence remains nonselectable", () => {
  const record = businessHours.records.find(item => item.currentOpenClosedEligibilityStatus === "HOURS_STALE")
    || businessHours.records.find(item => item.currentOpenClosedEligibilityStatus === "HOURS_UNKNOWN");
  assert.ok(record);
  const projection = applyCanonicalBusinessHoursEligibilityToNearbyCandidates({
    candidates: [{
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
      businessStatus: "OPERATIONAL"
    }],
    hoursIndex,
    evaluatedAt: evaluationTime,
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness"
  });

  assert.equal(projection.eligibleCandidates.length, 0);
  assert.equal(projection.evaluatedCandidates[0].nearbyRouteEligible, false);
  assert.equal(projection.evaluatedCandidates[0].eligibilitySnapshot.immediateRecommendationEligible, false);
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
    workspaceId: "unauthorized_workspace_fixture",
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
  const result = verifyNearbyContextIntelligenceV2({ checkProtectedBaselines: false });
  assert.equal(result.status, "passed");
  assert.equal(result.contexts.length, 2);
  assert.equal(result.contexts.every(context => context.status === "coverage_gap"), true);
  assert.equal(result.capabilityProbe.opportunityCount, 0);
  assert.deepEqual(result.capabilityProbe.relationshipDistribution, {});
  assert.equal(result.safety.canonicalBusinessHoursEligibilityPreserved, true);
  assert.equal(result.safety.closedVerifiedExcluded, true);
  assert.equal(result.safety.quarantineExcluded, true);
  assert.equal(result.identityIntegration.duplicateAliasesRemovedBeforeInference, true);
  assert.equal(result.identityIntegration.shoppingCenterInferenceRejectedDuplicateInflation, true);
  assert.equal(result.identityIntegration.multiTenantDistinctnessPreserved, true);
  assert.equal(result.safety.recommendationScoresChanged, false);
  assert.equal(result.failures.length, 0);
});
