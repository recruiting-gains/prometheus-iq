import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const commercialCenterArtifactVersion = "commercial-center-intelligence-v1";
export const commercialCenterContractVersion = "commercial-center-intelligence-data-contract-v1";

const moduleDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(moduleDir, "..");
const authorizedWorkspaceId = "fitness_connection";
const authorizedOperatingProfileId = "fitness";
const nearbyDiagnosticMaximumFeet = 1800;

export const commercialCenterPaths = Object.freeze({
  productionDataset: "data/qualified-prospects/google-qualified-businesses-v2/google-qualified-businesses-v2.json",
  activePool: "data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/active-pool.json",
  reservePool: "data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/reserve-pool.json",
  quarantinePool: "data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/quarantine-pool.json",
  businessHours: "data/qualified-prospects/google-qualified-businesses-v2/business-hours-v1/business-hours.json",
  stressTestEvidence: "data/route-iq-field-sessions-v1/source-evidence/july-11-2026-founder-stress-test-findings.json",
  commercialCenterEvidence: "data/qualified-prospects/google-qualified-businesses-v2/commercial-center-intelligence-v1/source-evidence/founder-july-11-commercial-center-observations.json",
  dataContract: "overwatch/artifact-contracts/data/fitness-connection-commercial-center-data-contract-v1.json",
  commercialCenters: "data/qualified-prospects/google-qualified-businesses-v2/commercial-center-intelligence-v1/commercial-centers.json",
  walkabilityGroups: "data/qualified-prospects/google-qualified-businesses-v2/commercial-center-intelligence-v1/walkability-groups.json",
  shoppingCenters: "data/qualified-prospects/google-qualified-businesses-v2/commercial-center-intelligence-v1/shopping-centers.json",
  relationships: "data/qualified-prospects/google-qualified-businesses-v2/commercial-center-intelligence-v1/relationships.json"
});

const contextIds = Object.freeze({
  texans: "commercial-center-context-fitness-texans-blackhawk-2026-07-11",
  christian: "commercial-center-context-fitness-christian-brothers-2026-07-11",
  texansWalkability: "walkability-group-fitness-texans-blackhawk-2026-07-11",
  christianWalkability: "walkability-group-fitness-christian-brothers-2026-07-11",
  texansAdjacent: "adjacent-storefront-group-fitness-texans-blackhawk-2026-07-11"
});

function readJson(root, path) {
  return JSON.parse(readFileSync(resolve(root, path), "utf8"));
}

function sha256File(root, path) {
  return createHash("sha256").update(readFileSync(resolve(root, path))).digest("hex");
}

function round(value, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function distanceMeters(left, right) {
  const earthRadiusMeters = 6371000;
  const radians = Math.PI / 180;
  const latitudeDelta = (right.latitude - left.latitude) * radians;
  const longitudeDelta = (right.longitude - left.longitude) * radians;
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(left.latitude * radians) * Math.cos(right.latitude * radians)
      * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusMeters * 2 * Math.asin(Math.sqrt(value));
}

function assertScope(workspaceId, operatingProfileId) {
  if (workspaceId !== authorizedWorkspaceId) {
    throw new Error(`Commercial-center workspace is not authorized: ${workspaceId || "unknown"}`);
  }
  if (operatingProfileId !== authorizedOperatingProfileId) {
    throw new Error(`Commercial-center operating profile mismatch: ${operatingProfileId || "unknown"}`);
  }
}

function uniqueBusinessByName(records, businessName) {
  const matches = records.filter(record => record.business_name === businessName);
  if (matches.length !== 1) {
    throw new Error(`Expected one governed identity for ${businessName}; found ${matches.length}.`);
  }
  return matches[0];
}

function uniqueEvidenceByAnchor(observations, businessName) {
  const matches = observations.filter(observation => observation.anchorBusinessName === businessName);
  if (matches.length !== 1) {
    throw new Error(`Expected one commercial-center evidence record for ${businessName}; found ${matches.length}.`);
  }
  return matches[0];
}

function buildPoolIndex(productionIds, pools) {
  const index = new Map();
  for (const [poolName, records] of Object.entries(pools)) {
    for (const record of records) {
      if (!productionIds.has(record.googlePlaceId)) continue;
      if (index.has(record.googlePlaceId)) {
        throw new Error(`Qualified business appears in multiple pools: ${record.googlePlaceId}`);
      }
      index.set(record.googlePlaceId, poolName);
    }
  }
  for (const googlePlaceId of productionIds) {
    if (!index.has(googlePlaceId)) throw new Error(`Qualified business has no governed pool: ${googlePlaceId}`);
  }
  return index;
}

function loadInputs(root) {
  const productionDataset = readJson(root, commercialCenterPaths.productionDataset);
  const activePool = readJson(root, commercialCenterPaths.activePool);
  const reservePool = readJson(root, commercialCenterPaths.reservePool);
  const quarantinePool = readJson(root, commercialCenterPaths.quarantinePool);
  const businessHours = readJson(root, commercialCenterPaths.businessHours);
  const stressTestEvidence = readJson(root, commercialCenterPaths.stressTestEvidence);
  const commercialCenterEvidence = readJson(root, commercialCenterPaths.commercialCenterEvidence);
  const dataContract = readJson(root, commercialCenterPaths.dataContract);
  const productionRecords = productionDataset.production_candidates || [];
  const productionIds = new Set(productionRecords.map(record => record.google_place_id));
  const poolIndex = buildPoolIndex(productionIds, {
    active: activePool.records || [],
    reserve: reservePool.records || [],
    quarantine: quarantinePool.records || []
  });
  const businessHoursIds = new Set((businessHours.records || []).map(record => record.googlePlaceId));
  const hashes = Object.fromEntries([
    "productionDataset",
    "activePool",
    "reservePool",
    "quarantinePool",
    "businessHours",
    "stressTestEvidence",
    "commercialCenterEvidence",
    "dataContract"
  ].map(key => [key, {
    path: commercialCenterPaths[key],
    sha256: sha256File(root, commercialCenterPaths[key])
  }]));
  return {
    productionDataset,
    productionRecords,
    poolIndex,
    businessHoursIds,
    stressTestEvidence,
    commercialCenterEvidence,
    dataContract,
    hashes
  };
}

function baseArtifact(artifactType, generatedAt, inputs) {
  return {
    artifactVersion: commercialCenterArtifactVersion,
    artifactType,
    generatedAt,
    status: "governed_partial_coverage",
    owningSubsystem: "Prometheus Data",
    workspaceId: authorizedWorkspaceId,
    operatingProfileId: authorizedOperatingProfileId,
    sourceDatasetVersion: inputs.productionDataset.dataset_version,
    dataContractId: inputs.dataContract.contractId,
    sourceArtifacts: inputs.hashes,
    runtimeActivation: {
      dashboardConsumptionAuthorized: false,
      intelligenceConsumptionAuthorized: false,
      nearbyContextConsumptionAuthorized: false,
      routeScoringChanged: false,
      runtimePoolChanged: false,
      liveGoogleCallsAdded: false
    }
  };
}

function identityProvenance(record) {
  return {
    provenanceId: "qualified_business_dataset",
    sourceRecordId: record.prospect_id,
    evidenceType: "GOVERNED_BUSINESS_IDENTITY",
    sourceArtifactKey: "productionDataset"
  };
}

function fieldProvenance(evidenceId, linkedObservationId) {
  return {
    provenanceId: evidenceId,
    linkedObservationId,
    evidenceType: "FOUNDER_FIELD_OBSERVATION",
    sourceArtifactKey: "commercialCenterEvidence"
  };
}

function stressProvenance(observationId) {
  return {
    provenanceId: observationId,
    evidenceType: "CANONICAL_STRESS_TEST_OBSERVATION",
    sourceArtifactKey: "stressTestEvidence"
  };
}

function coordinateProvenance(left, right) {
  return {
    provenanceId: `coordinate-distance:${left.google_place_id}:${right.google_place_id}`,
    evidenceType: "CALCULATED_STRAIGHT_LINE_DISTANCE",
    sourceArtifactKey: "productionDataset",
    calculation: "haversine_wgs84"
  };
}

function membershipForBusiness(record, resolved) {
  if (record.google_place_id === resolved.texans.google_place_id || record.google_place_id === resolved.blackhawk.google_place_id) {
    return {
      commercialCenterId: contextIds.texans,
      shoppingCenterId: null,
      shoppingCenterName: null,
      commercialParcelId: null,
      sharedParkingGroupId: null,
      walkabilityGroupId: contextIds.texansWalkability,
      adjacentStorefrontGroupId: contextIds.texansAdjacent,
      buildingClusterId: null,
      confidence: {
        level: "MODERATE",
        numericScore: null,
        basis: ["founder_observed_adjacent_walk_in_context", "unique_governed_identity_match"]
      },
      evidence: [
        fieldProvenance("commercial-center-evidence-texans-blackhawk-2026-07-11", "fitness-2026-07-11-texans-nearby-context-false-negative"),
        stressProvenance("fitness-2026-07-11-texans-nearby-context-false-negative")
      ]
    };
  }
  if (record.google_place_id === resolved.christian.google_place_id) {
    return {
      commercialCenterId: contextIds.christian,
      shoppingCenterId: null,
      shoppingCenterName: null,
      commercialParcelId: null,
      sharedParkingGroupId: null,
      walkabilityGroupId: contextIds.christianWalkability,
      adjacentStorefrontGroupId: null,
      buildingClusterId: null,
      confidence: {
        level: "LOW",
        numericScore: null,
        basis: ["founder_observed_walkable_businesses", "nearby_business_identities_unavailable"]
      },
      evidence: [
        fieldProvenance("commercial-center-evidence-christian-brothers-2026-07-11", "fitness-2026-07-11-christian-brothers-nearby-context-false-negative"),
        stressProvenance("fitness-2026-07-11-christian-brothers-nearby-context-false-negative")
      ]
    };
  }
  return {
    commercialCenterId: null,
    shoppingCenterId: null,
    shoppingCenterName: null,
    commercialParcelId: null,
    sharedParkingGroupId: null,
    walkabilityGroupId: null,
    adjacentStorefrontGroupId: null,
    buildingClusterId: null,
    confidence: {
      level: "UNKNOWN",
      numericScore: null,
      basis: ["no_governed_commercial_relationship_evidence"]
    },
    evidence: []
  };
}

function buildBusinessCoverage(inputs, resolved) {
  return inputs.productionRecords.map(record => {
    const membership = membershipForBusiness(record, resolved);
    const sourcePool = inputs.poolIndex.get(record.google_place_id);
    return {
      workspaceId: authorizedWorkspaceId,
      operatingProfileId: authorizedOperatingProfileId,
      googlePlaceId: record.google_place_id,
      businessName: record.business_name,
      address: record.full_address,
      category: record.category,
      latitude: record.latitude,
      longitude: record.longitude,
      sourcePool,
      poolProductionSafe: sourcePool === "active" || sourcePool === "reserve",
      businessHoursReference: inputs.businessHoursIds.has(record.google_place_id)
        ? { artifact: commercialCenterPaths.businessHours, googlePlaceId: record.google_place_id }
        : null,
      commercialCenterId: membership.commercialCenterId,
      shoppingCenterId: membership.shoppingCenterId,
      shoppingCenterName: membership.shoppingCenterName,
      commercialParcelId: membership.commercialParcelId,
      sharedParkingGroupId: membership.sharedParkingGroupId,
      walkabilityGroupId: membership.walkabilityGroupId,
      adjacentStorefrontGroupId: membership.adjacentStorefrontGroupId,
      buildingClusterId: membership.buildingClusterId,
      tenantRelationshipIds: [],
      entranceProximityMeters: null,
      internalWalkingDistanceEstimateMeters: null,
      confidence: membership.confidence,
      provenance: [identityProvenance(record), ...membership.evidence],
      lastVerifiedAt: null,
      relatedVisitTimestamp: membership.evidence.length
        ? record.google_place_id === resolved.christian.google_place_id
          ? "2026-07-11T19:31:21.937Z"
          : "2026-07-11T19:15:59.328Z"
        : null,
      relatedVisitTimestampIsVerificationTimestamp: false
    };
  });
}

function buildCommercialCenters(generatedAt, inputs, resolved, evidence, businessCoverage) {
  const base = baseArtifact("commercial_center_dataset", generatedAt, inputs);
  return {
    ...base,
    recordCount: businessCoverage.length,
    commercialContextCount: 2,
    officialCommercialCenterCount: 0,
    businessRecords: businessCoverage,
    commercialContexts: [
      {
        commercialCenterId: contextIds.texans,
        contextStatus: "PARTIAL_FIELD_EVIDENCE_BOUNDARY_UNRESOLVED",
        officialCommercialCenterName: null,
        officialCommercialCenterIdentifier: null,
        shoppingCenterId: null,
        shoppingCenterName: null,
        commercialParcelId: null,
        sharedParkingGroupId: null,
        buildingClusterId: null,
        verifiedAnchorPlaceIds: [resolved.texans.google_place_id],
        corroboratedNearbyPlaceIds: [resolved.blackhawk.google_place_id],
        unresolvedNearbyBusinesses: [{ businessName: "Elite Dry Cleaners", googlePlaceId: null }],
        minimumObservedNearbyBusinessCount: evidence.texans.minimumObservedNearbyBusinessCount,
        observedAttributes: {
          multipleStorefronts: true,
          adjacentStorefronts: true,
          walkableBusinesses: true,
          sharedParkingAtThisSpecificContext: null,
          shoppingCenterAtThisSpecificContext: null
        },
        confidence: "MODERATE",
        provenance: [
          fieldProvenance("commercial-center-evidence-texans-blackhawk-2026-07-11", "fitness-2026-07-11-texans-nearby-context-false-negative"),
          stressProvenance("fitness-2026-07-11-texans-nearby-context-false-negative")
        ],
        lastVerifiedAt: null
      },
      {
        commercialCenterId: contextIds.christian,
        contextStatus: "PARTIAL_FIELD_EVIDENCE_IDENTITIES_UNAVAILABLE",
        officialCommercialCenterName: null,
        officialCommercialCenterIdentifier: null,
        shoppingCenterId: null,
        shoppingCenterName: null,
        commercialParcelId: null,
        sharedParkingGroupId: null,
        buildingClusterId: null,
        verifiedAnchorPlaceIds: [resolved.christian.google_place_id],
        corroboratedNearbyPlaceIds: [],
        unresolvedNearbyBusinesses: [],
        minimumObservedNearbyBusinessCount: evidence.christian.minimumObservedNearbyBusinessCount,
        observedAttributes: {
          multipleStorefronts: null,
          adjacentStorefronts: null,
          walkableBusinesses: true,
          sharedParkingAtThisSpecificContext: null,
          shoppingCenterAtThisSpecificContext: null
        },
        confidence: "LOW",
        provenance: [
          fieldProvenance("commercial-center-evidence-christian-brothers-2026-07-11", "fitness-2026-07-11-christian-brothers-nearby-context-false-negative"),
          stressProvenance("fitness-2026-07-11-christian-brothers-nearby-context-false-negative")
        ],
        lastVerifiedAt: null
      }
    ],
    globalFieldEvidence: {
      multipleStorefrontsObservedAtOneOrMoreStressSites: true,
      sharedParkingObservedAtOneOrMoreStressSites: true,
      shoppingCenterContextObservedAtOneOrMoreStressSites: true,
      walkableBusinessesObservedAtOneOrMoreStressSites: true,
      siteSpecificParkingAttributionAvailable: false,
      siteSpecificShoppingCenterAttributionAvailable: false
    },
    nullPolicy: inputs.dataContract.nullAndEvidencePolicy
  };
}

function buildWalkabilityGroups(generatedAt, inputs, resolved, evidence, texansDistance) {
  return {
    ...baseArtifact("walkability_dataset", generatedAt, inputs),
    groupCount: 2,
    groups: [
      {
        walkabilityGroupId: contextIds.texansWalkability,
        groupStatus: "PARTIAL_FOUNDER_OBSERVATION_WITH_IDENTITY_CORROBORATION",
        anchorGooglePlaceId: resolved.texans.google_place_id,
        resolvedMembers: [
          {
            googlePlaceId: resolved.texans.google_place_id,
            businessName: resolved.texans.business_name,
            sourcePool: inputs.poolIndex.get(resolved.texans.google_place_id),
            membershipRole: "ANCHOR"
          },
          {
            googlePlaceId: resolved.blackhawk.google_place_id,
            businessName: resolved.blackhawk.business_name,
            sourcePool: inputs.poolIndex.get(resolved.blackhawk.google_place_id),
            membershipRole: "CORROBORATED_NAMED_NEARBY_BUSINESS"
          }
        ],
        unresolvedMembers: [{ businessName: "Elite Dry Cleaners", googlePlaceId: null }],
        minimumObservedNearbyBusinessCount: evidence.texans.minimumObservedNearbyBusinessCount,
        straightLineDistanceMetersForResolvedPair: texansDistance.meters,
        straightLineDistanceFeetForResolvedPair: texansDistance.feet,
        internalWalkingDistanceEstimateMeters: null,
        measuredWalkingRouteAvailable: false,
        confidence: "MODERATE",
        provenance: [
          fieldProvenance("commercial-center-evidence-texans-blackhawk-2026-07-11", "fitness-2026-07-11-texans-nearby-context-false-negative"),
          coordinateProvenance(resolved.texans, resolved.blackhawk)
        ],
        lastVerifiedAt: null
      },
      {
        walkabilityGroupId: contextIds.christianWalkability,
        groupStatus: "FOUNDER_OBSERVED_IDENTITIES_UNAVAILABLE",
        anchorGooglePlaceId: resolved.christian.google_place_id,
        resolvedMembers: [
          {
            googlePlaceId: resolved.christian.google_place_id,
            businessName: resolved.christian.business_name,
            sourcePool: inputs.poolIndex.get(resolved.christian.google_place_id),
            membershipRole: "ANCHOR"
          }
        ],
        unresolvedMembers: [],
        minimumObservedNearbyBusinessCount: evidence.christian.minimumObservedNearbyBusinessCount,
        straightLineDistanceMetersForResolvedPair: null,
        straightLineDistanceFeetForResolvedPair: null,
        internalWalkingDistanceEstimateMeters: null,
        measuredWalkingRouteAvailable: false,
        confidence: "LOW",
        provenance: [
          fieldProvenance("commercial-center-evidence-christian-brothers-2026-07-11", "fitness-2026-07-11-christian-brothers-nearby-context-false-negative")
        ],
        lastVerifiedAt: null
      }
    ]
  };
}

function buildShoppingCenters(generatedAt, inputs, resolved) {
  return {
    ...baseArtifact("shopping_center_dataset", generatedAt, inputs),
    verifiedShoppingCenterCount: 0,
    records: [],
    unresolvedContextCount: 2,
    unresolvedContexts: [
      {
        commercialCenterId: contextIds.texans,
        anchorGooglePlaceId: resolved.texans.google_place_id,
        shoppingCenterId: null,
        shoppingCenterName: null,
        officialNameVerificationStatus: "UNKNOWN",
        parcelIdentity: null,
        sharedParkingGroupId: null,
        reason: "Founder observed commercial context, but official center identity and site-specific parking attribution were not archived."
      },
      {
        commercialCenterId: contextIds.christian,
        anchorGooglePlaceId: resolved.christian.google_place_id,
        shoppingCenterId: null,
        shoppingCenterName: null,
        officialNameVerificationStatus: "UNKNOWN",
        parcelIdentity: null,
        sharedParkingGroupId: null,
        reason: "Founder observed nearby walkable businesses, but their identities and official center identity were not archived."
      }
    ],
    globalFieldEvidence: {
      shoppingCenterContextObservedAtOneOrMoreStressSites: true,
      sharedParkingObservedAtOneOrMoreStressSites: true,
      siteSpecificAttributionAvailable: false
    }
  };
}

function relationshipRecord({
  relationshipId,
  tier,
  relationshipType,
  left,
  right,
  leftPool,
  rightPool,
  verificationStatus,
  confidence,
  distance,
  fieldObservationCorroborated,
  provenance,
  generatedAt
}) {
  return {
    relationshipId,
    workspaceId: authorizedWorkspaceId,
    operatingProfileId: authorizedOperatingProfileId,
    tier,
    relationshipType,
    directionality: "UNDIRECTED",
    leftBusiness: {
      googlePlaceId: left.google_place_id,
      businessName: left.business_name,
      sourcePool: leftPool
    },
    rightBusiness: {
      googlePlaceId: right.google_place_id,
      businessName: right.business_name,
      sourcePool: rightPool
    },
    verificationStatus,
    confidence,
    straightLineDistanceMeters: distance.meters,
    straightLineDistanceFeet: distance.feet,
    internalWalkingDistanceEstimateMeters: null,
    sameBuildingVerified: null,
    sameShoppingCenterVerified: null,
    sameParcelVerified: null,
    sharedParkingVerified: null,
    fieldObservationCorroborated,
    relationshipMayOverridePoolGovernance: false,
    runtimeConsumptionAuthorized: false,
    provenance,
    calculatedAt: generatedAt,
    lastVerifiedAt: null
  };
}

function buildRelationships(generatedAt, inputs, resolved, evidence, texansDistance, christianNearbyDistance) {
  const records = [
    relationshipRecord({
      relationshipId: "relationship-tier4-texans-blackhawk-dental-2026-07-11",
      tier: 4,
      relationshipType: "WALKABLE_NEARBY",
      left: resolved.texans,
      right: resolved.blackhawk,
      leftPool: inputs.poolIndex.get(resolved.texans.google_place_id),
      rightPool: inputs.poolIndex.get(resolved.blackhawk.google_place_id),
      verificationStatus: "FOUNDER_OBSERVED_NAME_MATCH_CORROBORATED",
      confidence: "MODERATE",
      distance: texansDistance,
      fieldObservationCorroborated: true,
      provenance: [
        fieldProvenance("commercial-center-evidence-texans-blackhawk-2026-07-11", "fitness-2026-07-11-texans-nearby-context-false-negative"),
        coordinateProvenance(resolved.texans, resolved.blackhawk)
      ],
      generatedAt
    }),
    relationshipRecord({
      relationshipId: "relationship-tier5-christian-brothers-first-texas-dental-v1",
      tier: 5,
      relationshipType: "NEARBY_BUSINESS",
      left: resolved.christian,
      right: resolved.firstTexas,
      leftPool: inputs.poolIndex.get(resolved.christian.google_place_id),
      rightPool: inputs.poolIndex.get(resolved.firstTexas.google_place_id),
      verificationStatus: "CALCULATED_COORDINATE_PROXIMITY_ONLY",
      confidence: "LOW",
      distance: christianNearbyDistance,
      fieldObservationCorroborated: false,
      provenance: [coordinateProvenance(resolved.christian, resolved.firstTexas)],
      generatedAt
    })
  ];
  const tierCounts = Object.fromEntries([1, 2, 3, 4, 5].map(tier => [String(tier), records.filter(record => record.tier === tier).length]));
  return {
    ...baseArtifact("commercial_relationship_dataset", generatedAt, inputs),
    relationshipCount: records.length,
    relationshipTiers: inputs.dataContract.relationshipTiers,
    calculationPolicy: {
      scope: "founder_stress_context_diagnostics_only",
      nearbyCoordinateMaximumFeet: nearbyDiagnosticMaximumFeet,
      straightLineMethod: "haversine_wgs84",
      straightLineDistanceMayVerifyWalkingDistance: false,
      straightLineDistanceMayVerifyCenterParcelOrParking: false
    },
    tierCounts,
    records,
    unresolvedEvidence: [
      {
        anchorGooglePlaceId: resolved.texans.google_place_id,
        unresolvedBusinessName: "Elite Dry Cleaners",
        unresolvedGooglePlaceId: null,
        reason: "No unique governed business identity exists in the qualified candidate dataset."
      },
      {
        anchorGooglePlaceId: resolved.christian.google_place_id,
        unresolvedBusinessName: null,
        unresolvedGooglePlaceId: null,
        minimumUnresolvedBusinessCount: evidence.christian.minimumObservedNearbyBusinessCount,
        reason: `${evidence.christian.finding} Their identities were not archived.`
      }
    ]
  };
}

export function validateCommercialCenterArtifacts(artifacts, inputs) {
  const failures = [];
  const check = (condition, reason) => { if (!condition) failures.push(reason); };
  const expected = inputs.dataContract.expectedMetrics;
  const businessRecords = artifacts.commercialCenters.businessRecords || [];
  const productionById = new Map(inputs.productionRecords.map(record => [record.google_place_id, record]));
  const businessIds = businessRecords.map(record => record.googlePlaceId);
  const relationships = artifacts.relationships.records || [];
  const commercialContextIds = new Set((artifacts.commercialCenters.commercialContexts || []).map(context => context.commercialCenterId));
  const walkabilityGroupIds = new Set((artifacts.walkabilityGroups.groups || []).map(group => group.walkabilityGroupId));
  const christianEvidence = uniqueEvidenceByAnchor(inputs.commercialCenterEvidence.observations || [], "Christian Brothers Automotive Pearland");
  const christianMinimum = christianEvidence.minimumObservedNearbyBusinessCount;

  for (const artifact of Object.values(artifacts)) {
    check(artifact.artifactVersion === commercialCenterArtifactVersion, `${artifact.artifactType}:artifact_version_mismatch`);
    check(artifact.workspaceId === authorizedWorkspaceId, `${artifact.artifactType}:workspace_mismatch`);
    check(artifact.operatingProfileId === authorizedOperatingProfileId, `${artifact.artifactType}:operating_profile_mismatch`);
    check(artifact.runtimeActivation?.dashboardConsumptionAuthorized === false, `${artifact.artifactType}:dashboard_activation_detected`);
    check(artifact.runtimeActivation?.intelligenceConsumptionAuthorized === false, `${artifact.artifactType}:intelligence_activation_detected`);
    check(artifact.runtimeActivation?.nearbyContextConsumptionAuthorized === false, `${artifact.artifactType}:nearby_context_activation_detected`);
    check(artifact.runtimeActivation?.routeScoringChanged === false, `${artifact.artifactType}:route_scoring_change_detected`);
    check(artifact.runtimeActivation?.liveGoogleCallsAdded === false, `${artifact.artifactType}:live_google_call_detected`);
  }

  check(businessRecords.length === expected.qualifiedBusinessCoverage, "qualified_business_coverage_mismatch");
  check(new Set(businessIds).size === businessIds.length, "duplicate_business_coverage_identity");
  check(businessIds.every(id => productionById.has(id)), "unknown_business_identity_in_coverage");
  check([...productionById.keys()].every(id => businessIds.includes(id)), "qualified_business_missing_from_coverage");
  check(businessRecords.every(record => record.businessName === productionById.get(record.googlePlaceId)?.business_name), "business_name_mutation_detected");
  check(businessRecords.every(record => record.address === productionById.get(record.googlePlaceId)?.full_address), "business_address_mutation_detected");
  check(businessRecords.every(record => ["active", "reserve", "quarantine"].includes(record.sourcePool)), "invalid_source_pool");
  check(businessRecords.every(record => record.lastVerifiedAt === null), "unavailable_verification_timestamp_inferred");
  check(businessRecords.every(record => inputs.dataContract.requiredBusinessFields.every(field => Object.hasOwn(record, field))), "required_business_field_missing");
  check(businessRecords.every(record => record.commercialCenterId === null || commercialContextIds.has(record.commercialCenterId)), "unknown_commercial_context_reference");
  check(businessRecords.every(record => record.walkabilityGroupId === null || walkabilityGroupIds.has(record.walkabilityGroupId)), "unknown_walkability_group_reference");
  check(businessRecords.every(record => record.shoppingCenterId === null && record.shoppingCenterName === null), "unverified_shopping_center_identity_inferred");
  check(businessRecords.every(record => record.commercialParcelId === null), "unverified_parcel_identity_inferred");
  check(businessRecords.every(record => record.sharedParkingGroupId === null), "unverified_parking_membership_inferred");
  check(businessRecords.every(record => record.buildingClusterId === null), "unverified_building_cluster_inferred");
  check(businessRecords.every(record => record.entranceProximityMeters === null), "entrance_proximity_fabricated");
  check(businessRecords.every(record => record.internalWalkingDistanceEstimateMeters === null), "walking_distance_fabricated");
  check(businessRecords.every(record => Array.isArray(record.tenantRelationshipIds) && record.tenantRelationshipIds.length === 0), "tenant_relationship_fabricated");
  check(artifacts.commercialCenters.commercialContextCount === expected.commercialContextCount, "commercial_context_count_mismatch");
  check(artifacts.walkabilityGroups.groupCount === expected.walkabilityGroupCount, "walkability_group_count_mismatch");
  check(artifacts.shoppingCenters.verifiedShoppingCenterCount === expected.verifiedShoppingCenterCount, "verified_shopping_center_count_mismatch");
  check(artifacts.shoppingCenters.unresolvedContextCount === expected.unresolvedShoppingCenterContextCount, "unresolved_shopping_center_context_count_mismatch");
  check(artifacts.shoppingCenters.records.length === 0, "unverified_shopping_center_created");
  check(relationships.length === expected.relationshipCount, "relationship_count_mismatch");
  check(new Set(relationships.map(record => record.relationshipId)).size === relationships.length, "duplicate_relationship_id");
  check(relationships.every(record => productionById.has(record.leftBusiness.googlePlaceId) && productionById.has(record.rightBusiness.googlePlaceId)), "relationship_contains_unknown_business");
  check(relationships.every(record => record.leftBusiness.googlePlaceId !== record.rightBusiness.googlePlaceId), "self_relationship_detected");
  check(relationships.every(record => record.internalWalkingDistanceEstimateMeters === null), "relationship_walking_distance_fabricated");
  check(relationships.every(record => record.relationshipMayOverridePoolGovernance === false), "relationship_overrides_pool_governance");
  check(relationships.every(record => record.runtimeConsumptionAuthorized === false), "relationship_runtime_activation_detected");
  for (const tier of [1, 2, 3, 4, 5]) {
    check(Number(artifacts.relationships.tierCounts[String(tier)]) === expected[`tier${tier}Count`], `tier_${tier}_count_mismatch`);
  }
  check(relationships.filter(record => record.tier <= 3).length === 0, "tier_1_through_3_relationship_fabricated");
  const tier4 = relationships.find(record => record.tier === 4);
  check(tier4?.fieldObservationCorroborated === true, "tier_4_missing_field_observation");
  check(tier4?.rightBusiness.sourcePool === "quarantine", "blackhawk_quarantine_status_not_preserved");
  const tier5 = relationships.find(record => record.tier === 5);
  check(tier5?.verificationStatus === "CALCULATED_COORDINATE_PROXIMITY_ONLY", "tier_5_verification_disclosure_missing");
  check((tier5?.straightLineDistanceFeet ?? Infinity) <= nearbyDiagnosticMaximumFeet, "tier_5_outside_nearby_diagnostic_bound");
  check(artifacts.relationships.unresolvedEvidence.some(item => item.unresolvedBusinessName === "Elite Dry Cleaners" && item.unresolvedGooglePlaceId === null), "elite_dry_cleaners_unknown_identity_not_preserved");
  check(christianEvidence.finding === "More than five walkable businesses.", "christian_brothers_qualitative_evidence_regressed");
  check(christianEvidence.quantityExpression === "MORE_THAN_FIVE", "christian_brothers_quantity_expression_regressed");
  check(Number.isInteger(christianMinimum) && christianMinimum >= 6, "christian_brothers_minimum_not_greater_than_five");
  check(artifacts.commercialCenters.commercialContexts.some(context => context.commercialCenterId === contextIds.christian
    && context.minimumObservedNearbyBusinessCount === christianMinimum), "christian_brothers_commercial_context_count_not_preserved");
  check(artifacts.walkabilityGroups.groups.some(group => group.walkabilityGroupId === contextIds.christianWalkability
    && group.minimumObservedNearbyBusinessCount === christianMinimum), "christian_brothers_walkability_count_not_preserved");
  check(artifacts.relationships.unresolvedEvidence.some(item => item.minimumUnresolvedBusinessCount === christianMinimum), "christian_brothers_unresolved_count_not_preserved");
  check(businessRecords.every(record => record.workspaceId === authorizedWorkspaceId), "cross_workspace_business_record");
  check(businessRecords.every(record => record.businessHoursReference !== null), "business_hours_reference_missing");

  return {
    status: failures.length ? "failed" : "passed",
    failures,
    metrics: {
      qualifiedBusinessCoverage: businessRecords.length,
      commercialContextCount: artifacts.commercialCenters.commercialContextCount,
      walkabilityGroupCount: artifacts.walkabilityGroups.groupCount,
      verifiedShoppingCenterCount: artifacts.shoppingCenters.verifiedShoppingCenterCount,
      unresolvedShoppingCenterContextCount: artifacts.shoppingCenters.unresolvedContextCount,
      relationshipCount: relationships.length,
      tierCounts: artifacts.relationships.tierCounts
    }
  };
}

export function buildCommercialCenterArtifacts(options = {}) {
  const root = options.root || repoRoot;
  const workspaceId = Object.hasOwn(options, "workspaceId") ? options.workspaceId : authorizedWorkspaceId;
  const operatingProfileId = Object.hasOwn(options, "operatingProfileId") ? options.operatingProfileId : authorizedOperatingProfileId;
  const generatedAt = options.generatedAt || new Date().toISOString();
  assertScope(workspaceId, operatingProfileId);
  const inputs = loadInputs(root);
  if (inputs.dataContract.contractVersion !== commercialCenterContractVersion) {
    throw new Error(`Commercial-center contract mismatch: ${inputs.dataContract.contractVersion || "missing"}`);
  }
  if (inputs.dataContract.workspaceId !== authorizedWorkspaceId || inputs.dataContract.operatingProfileId !== authorizedOperatingProfileId) {
    throw new Error("Commercial-center Data contract scope mismatch.");
  }
  if (inputs.commercialCenterEvidence.workspaceId !== authorizedWorkspaceId
    || inputs.commercialCenterEvidence.operatingProfileId !== authorizedOperatingProfileId
    || inputs.stressTestEvidence.workspaceId !== authorizedWorkspaceId
    || inputs.stressTestEvidence.operatingProfileId !== authorizedOperatingProfileId) {
    throw new Error("Commercial-center source evidence scope mismatch.");
  }
  if (inputs.dataContract.consumerAuthorization.dashboardReadAuthorized !== false
    || inputs.dataContract.consumerAuthorization.intelligenceReadAuthorized !== false
    || inputs.dataContract.consumerAuthorization.nearbyContextRuntimeConsumptionAuthorized !== false) {
    throw new Error("Commercial-center runtime consumption is not authorized.");
  }
  if (inputs.productionRecords.length !== inputs.dataContract.expectedMetrics.qualifiedBusinessCoverage) {
    throw new Error(`Qualified business count mismatch: ${inputs.productionRecords.length}`);
  }
  if (new Set(inputs.productionRecords.map(record => record.google_place_id)).size !== inputs.productionRecords.length) {
    throw new Error("Qualified business identities are not unique.");
  }
  if (inputs.businessHoursIds.size !== inputs.productionRecords.length) {
    throw new Error(`Business-hours identity coverage mismatch: ${inputs.businessHoursIds.size}`);
  }

  const resolved = {
    texans: uniqueBusinessByName(inputs.productionRecords, "Texans Auto Repair - Blackhawk"),
    christian: uniqueBusinessByName(inputs.productionRecords, "Christian Brothers Automotive Pearland"),
    blackhawk: uniqueBusinessByName(inputs.productionRecords, "Blackhawk Dental"),
    firstTexas: uniqueBusinessByName(inputs.productionRecords, "First Texas Dental")
  };
  const evidence = {
    texans: uniqueEvidenceByAnchor(inputs.commercialCenterEvidence.observations || [], "Texans Auto Repair - Blackhawk"),
    christian: uniqueEvidenceByAnchor(inputs.commercialCenterEvidence.observations || [], "Christian Brothers Automotive Pearland")
  };
  const texansMeters = distanceMeters(resolved.texans, resolved.blackhawk);
  const christianNearbyMeters = distanceMeters(resolved.christian, resolved.firstTexas);
  const texansDistance = { meters: round(texansMeters), feet: round(texansMeters * 3.28084) };
  const christianNearbyDistance = { meters: round(christianNearbyMeters), feet: round(christianNearbyMeters * 3.28084) };
  if (christianNearbyDistance.feet > nearbyDiagnosticMaximumFeet) {
    throw new Error("First Texas Dental is outside the governed Tier 5 stress-context diagnostic bound.");
  }

  const businessCoverage = buildBusinessCoverage(inputs, resolved);
  const artifacts = {
    commercialCenters: buildCommercialCenters(generatedAt, inputs, resolved, evidence, businessCoverage),
    walkabilityGroups: buildWalkabilityGroups(generatedAt, inputs, resolved, evidence, texansDistance),
    shoppingCenters: buildShoppingCenters(generatedAt, inputs, resolved),
    relationships: buildRelationships(generatedAt, inputs, resolved, evidence, texansDistance, christianNearbyDistance)
  };
  const validation = validateCommercialCenterArtifacts(artifacts, inputs);
  if (validation.status !== "passed") {
    throw new Error(`Commercial-center artifact validation failed: ${validation.failures.join(", ")}`);
  }
  return { artifacts, validation, resolved, inputs };
}

function writeJsonAtomic(root, path, value) {
  const outputPath = resolve(root, path);
  mkdirSync(dirname(outputPath), { recursive: true });
  const temporaryPath = `${outputPath}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(temporaryPath, outputPath);
}

export function writeCommercialCenterArtifacts(result, options = {}) {
  const root = options.root || repoRoot;
  writeJsonAtomic(root, commercialCenterPaths.commercialCenters, result.artifacts.commercialCenters);
  writeJsonAtomic(root, commercialCenterPaths.walkabilityGroups, result.artifacts.walkabilityGroups);
  writeJsonAtomic(root, commercialCenterPaths.shoppingCenters, result.artifacts.shoppingCenters);
  writeJsonAtomic(root, commercialCenterPaths.relationships, result.artifacts.relationships);
}

export function checkCanonicalCommercialCenterArtifacts(options = {}) {
  const root = options.root || repoRoot;
  for (const key of ["commercialCenters", "walkabilityGroups", "shoppingCenters", "relationships"]) {
    if (!existsSync(resolve(root, commercialCenterPaths[key]))) {
      throw new Error(`Canonical commercial-center artifact is missing: ${commercialCenterPaths[key]}`);
    }
  }
  const canonical = {
    commercialCenters: readJson(root, commercialCenterPaths.commercialCenters),
    walkabilityGroups: readJson(root, commercialCenterPaths.walkabilityGroups),
    shoppingCenters: readJson(root, commercialCenterPaths.shoppingCenters),
    relationships: readJson(root, commercialCenterPaths.relationships)
  };
  const generatedAt = canonical.commercialCenters.generatedAt;
  const current = buildCommercialCenterArtifacts({ root, generatedAt });
  for (const key of Object.keys(canonical)) {
    if (JSON.stringify(canonical[key]) !== JSON.stringify(current.artifacts[key])) {
      throw new Error(`Canonical commercial-center artifact is stale: ${commercialCenterPaths[key]}`);
    }
  }
  return current;
}

function publicReport(result, mode) {
  return {
    status: result.validation.status,
    mode,
    artifactVersion: commercialCenterArtifactVersion,
    workspaceId: authorizedWorkspaceId,
    qualifiedBusinessCoverage: result.validation.metrics.qualifiedBusinessCoverage,
    commercialContextCount: result.validation.metrics.commercialContextCount,
    walkabilityGroupCount: result.validation.metrics.walkabilityGroupCount,
    verifiedShoppingCenterCount: result.validation.metrics.verifiedShoppingCenterCount,
    unresolvedShoppingCenterContextCount: result.validation.metrics.unresolvedShoppingCenterContextCount,
    relationshipCount: result.validation.metrics.relationshipCount,
    tierCounts: result.validation.metrics.tierCounts,
    nearbyContextRuntimeConsumptionAuthorized: false,
    dashboardConsumptionAuthorized: false,
    routeScoringChanged: false,
    liveGoogleCallsAdded: false
  };
}

function main() {
  const write = process.argv.includes("--write");
  const help = process.argv.includes("--help");
  if (help) {
    console.log(`Usage: node scripts/build-commercial-center-intelligence.mjs [--write]

Without --write, validates canonical artifacts read-only.
With --write, generates the four canonical Data-owned datasets after all governance checks pass.`);
    return;
  }
  const result = write ? buildCommercialCenterArtifacts() : checkCanonicalCommercialCenterArtifacts();
  if (write) writeCommercialCenterArtifacts(result);
  console.log(JSON.stringify(publicReport(result, write ? "canonical_generation" : "read_only_verification"), null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
