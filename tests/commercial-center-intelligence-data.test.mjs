import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

import {
  buildCommercialCenterArtifacts,
  commercialCenterArtifactVersion,
  commercialCenterPaths
} from "../scripts/build-commercial-center-intelligence.mjs";

const root = resolve(import.meta.dirname, "..");
const read = path => readFileSync(resolve(root, path), "utf8");
const json = path => JSON.parse(read(path));
const sha256 = path => createHash("sha256").update(readFileSync(resolve(root, path))).digest("hex");

function generated() {
  return buildCommercialCenterArtifacts({ generatedAt: "2026-07-12T06:29:13Z" });
}

test("offline generation covers every uniquely governed qualified business", () => {
  const result = generated();
  const production = json(commercialCenterPaths.productionDataset).production_candidates;
  const records = result.artifacts.commercialCenters.businessRecords;

  assert.equal(result.validation.status, "passed");
  assert.equal(records.length, 398);
  assert.equal(records.length, production.length);
  assert.equal(new Set(records.map(record => record.googlePlaceId)).size, 398);
  assert.deepEqual(records.map(record => record.googlePlaceId), production.map(record => record.google_place_id));
  assert.ok(records.every(record => record.workspaceId === "fitness_connection"));
  assert.ok(records.every(record => record.operatingProfileId === "fitness"));
  assert.ok(records.every(record => record.businessHoursReference?.googlePlaceId === record.googlePlaceId));
});

test("business identity fields and existing runtime pool assignments remain unchanged", () => {
  const result = generated();
  const production = json(commercialCenterPaths.productionDataset).production_candidates;
  const productionById = new Map(production.map(record => [record.google_place_id, record]));
  const counts = { active: 0, reserve: 0, quarantine: 0 };

  for (const record of result.artifacts.commercialCenters.businessRecords) {
    const source = productionById.get(record.googlePlaceId);
    assert.equal(record.businessName, source.business_name);
    assert.equal(record.address, source.full_address);
    assert.equal(record.category, source.category);
    assert.equal(record.latitude, source.latitude);
    assert.equal(record.longitude, source.longitude);
    counts[record.sourcePool] += 1;
  }

  assert.deepEqual(counts, { active: 297, reserve: 44, quarantine: 57 });
});

test("unknown center, parcel, parking, building, entrance, tenant, and walking facts remain unknown", () => {
  const result = generated();
  const records = result.artifacts.commercialCenters.businessRecords;

  assert.ok(records.every(record => record.shoppingCenterId === null));
  assert.ok(records.every(record => record.shoppingCenterName === null));
  assert.ok(records.every(record => record.commercialParcelId === null));
  assert.ok(records.every(record => record.sharedParkingGroupId === null));
  assert.ok(records.every(record => record.buildingClusterId === null));
  assert.ok(records.every(record => record.entranceProximityMeters === null));
  assert.ok(records.every(record => record.internalWalkingDistanceEstimateMeters === null));
  assert.ok(records.every(record => record.lastVerifiedAt === null));
  assert.ok(records.every(record => Array.isArray(record.tenantRelationshipIds) && record.tenantRelationshipIds.length === 0));
  assert.equal(result.artifacts.shoppingCenters.verifiedShoppingCenterCount, 0);
  assert.deepEqual(result.artifacts.shoppingCenters.records, []);
});

test("Texans field evidence resolves only the uniquely governed Blackhawk identity", () => {
  const result = generated();
  const relationships = result.artifacts.relationships;
  const tier4 = relationships.records.find(record => record.tier === 4);
  const texansGroup = result.artifacts.walkabilityGroups.groups.find(group => group.anchorGooglePlaceId === tier4.leftBusiness.googlePlaceId);

  assert.equal(tier4.relationshipType, "WALKABLE_NEARBY");
  assert.equal(tier4.leftBusiness.businessName, "Texans Auto Repair - Blackhawk");
  assert.equal(tier4.leftBusiness.sourcePool, "active");
  assert.equal(tier4.rightBusiness.businessName, "Blackhawk Dental");
  assert.equal(tier4.rightBusiness.sourcePool, "quarantine");
  assert.equal(tier4.verificationStatus, "FOUNDER_OBSERVED_NAME_MATCH_CORROBORATED");
  assert.equal(tier4.confidence, "MODERATE");
  assert.equal(tier4.straightLineDistanceFeet, 112.3);
  assert.equal(tier4.internalWalkingDistanceEstimateMeters, null);
  assert.equal(tier4.relationshipMayOverridePoolGovernance, false);
  assert.equal(tier4.runtimeConsumptionAuthorized, false);
  assert.equal(texansGroup.resolvedMembers.length, 2);
  assert.deepEqual(texansGroup.unresolvedMembers, [{ businessName: "Elite Dry Cleaners", googlePlaceId: null }]);
  assert.ok(relationships.unresolvedEvidence.some(item => item.unresolvedBusinessName === "Elite Dry Cleaners" && item.unresolvedGooglePlaceId === null));
});

test("Christian Brothers preserves five unresolved walkable identities and a separate Tier 5 diagnostic", () => {
  const result = generated();
  const christian = result.artifacts.commercialCenters.businessRecords.find(record => record.businessName === "Christian Brothers Automotive Pearland");
  const group = result.artifacts.walkabilityGroups.groups.find(item => item.anchorGooglePlaceId === christian.googlePlaceId);
  const tier5 = result.artifacts.relationships.records.find(record => record.tier === 5);

  assert.equal(group.groupStatus, "FOUNDER_OBSERVED_IDENTITIES_UNAVAILABLE");
  assert.equal(group.minimumObservedNearbyBusinessCount, 5);
  assert.equal(group.resolvedMembers.length, 1);
  assert.equal(group.internalWalkingDistanceEstimateMeters, null);
  assert.equal(tier5.leftBusiness.businessName, "Christian Brothers Automotive Pearland");
  assert.equal(tier5.rightBusiness.businessName, "First Texas Dental");
  assert.equal(tier5.rightBusiness.sourcePool, "quarantine");
  assert.equal(tier5.verificationStatus, "CALCULATED_COORDINATE_PROXIMITY_ONLY");
  assert.equal(tier5.fieldObservationCorroborated, false);
  assert.equal(tier5.straightLineDistanceFeet, 1473.2);
  assert.equal(tier5.internalWalkingDistanceEstimateMeters, null);
  assert.ok(result.artifacts.relationships.unresolvedEvidence.some(item => item.minimumUnresolvedBusinessCount === 5));
});

test("relationship tiers never promote missing Tier 1 through Tier 3 evidence", () => {
  const result = generated();
  const relationships = result.artifacts.relationships;

  assert.deepEqual(relationships.tierCounts, { "1": 0, "2": 0, "3": 0, "4": 1, "5": 1 });
  assert.ok(relationships.records.every(record => record.tier >= 4));
  assert.ok(relationships.records.every(record => record.sameBuildingVerified === null));
  assert.ok(relationships.records.every(record => record.sameShoppingCenterVerified === null));
  assert.ok(relationships.records.every(record => record.sameParcelVerified === null));
  assert.ok(relationships.records.every(record => record.sharedParkingVerified === null));
});

test("required fields, provenance, source hashes, and non-activation metadata are complete", () => {
  const result = generated();
  const contract = json(commercialCenterPaths.dataContract);
  const first = result.artifacts.commercialCenters.businessRecords[0];

  for (const field of contract.requiredBusinessFields) assert.ok(Object.hasOwn(first, field), `missing ${field}`);
  for (const artifact of Object.values(result.artifacts)) {
    assert.equal(artifact.artifactVersion, commercialCenterArtifactVersion);
    assert.equal(artifact.runtimeActivation.dashboardConsumptionAuthorized, false);
    assert.equal(artifact.runtimeActivation.intelligenceConsumptionAuthorized, false);
    assert.equal(artifact.runtimeActivation.nearbyContextConsumptionAuthorized, false);
    assert.equal(artifact.runtimeActivation.routeScoringChanged, false);
    assert.equal(artifact.runtimeActivation.liveGoogleCallsAdded, false);
    for (const source of Object.values(artifact.sourceArtifacts)) {
      assert.equal(source.sha256, sha256(source.path));
    }
  }
});

test("unknown, protected, and wrong-profile workspace requests fail closed", () => {
  assert.throws(() => buildCommercialCenterArtifacts({ workspaceId: "unknown_workspace" }), /not authorized/);
  assert.throws(() => buildCommercialCenterArtifacts({ workspaceId: "smoothie_depot" }), /not authorized/);
  assert.throws(() => buildCommercialCenterArtifacts({ workspaceId: null }), /not authorized/);
  assert.throws(() => buildCommercialCenterArtifacts({ workspaceId: "" }), /not authorized/);
  assert.throws(() => buildCommercialCenterArtifacts({ operatingProfileId: "franchise_development" }), /profile mismatch/);
});

test("canonical Data contracts register artifacts without authorizing a consumer", () => {
  const contract = json(commercialCenterPaths.dataContract);
  const runtimeContract = json("overwatch/artifact-contracts/data/fitness-connection-runtime-artifact-contract-v1.json");
  const canonicalPaths = Object.values(contract.canonicalArtifacts);
  const intelligencePaths = runtimeContract.consumerRules.intelligence.allowedReadPaths;

  assert.equal(contract.status, "data_foundation_ready_runtime_consumption_not_authorized");
  assert.equal(contract.consumerAuthorization.dashboardReadAuthorized, false);
  assert.equal(contract.consumerAuthorization.intelligenceReadAuthorized, false);
  assert.equal(contract.consumerAuthorization.nearbyContextRuntimeConsumptionAuthorized, false);
  assert.equal(contract.commercialCenterIdentifierPolicy.commercialCenterIdMayBeTreatedAsOfficialShoppingCenterId, false);
  assert.equal(contract.commercialCenterIdentifierPolicy.commercialCenterIdMayBeTreatedAsParcelId, false);
  assert.equal(contract.commercialCenterIdentifierPolicy.commercialCenterIdMayBeTreatedAsBuildingId, false);
  assert.equal(contract.commercialCenterIdentifierPolicy.commercialCenterIdMayBeTreatedAsParkingAreaId, false);
  assert.equal(runtimeContract.consumerRules.intelligence.commercialCenterConsumptionAuthorized, false);
  assert.equal(runtimeContract.qualityGates.commercialCenterRuntimeConsumptionActivated, false);
  assert.equal(runtimeContract.qualityGates.nearbyContextDashboardConsumptionActivated, false);
  assert.equal(runtimeContract.workspaceIsolationRules.smoothieDepotMayConsumeFitnessCommercialCenterData, false);
  assert.ok(canonicalPaths.includes(runtimeContract.canonicalCommercialCenterArtifacts.commercialCenterDataset));
  for (const path of Object.values(runtimeContract.canonicalCommercialCenterArtifacts).filter(value => value.endsWith(".json"))) {
    assert.equal(intelligencePaths.includes(path), false, `Intelligence unexpectedly authorized for ${path}`);
  }
});

test("canonical verification is read-only and byte-stable", () => {
  const paths = [
    commercialCenterPaths.commercialCenters,
    commercialCenterPaths.walkabilityGroups,
    commercialCenterPaths.shoppingCenters,
    commercialCenterPaths.relationships
  ];
  const before = Object.fromEntries(paths.map(path => [path, read(path)]));
  const command = spawnSync(process.execPath, ["scripts/build-commercial-center-intelligence.mjs"], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" }
  });

  assert.equal(command.status, 0, command.stderr || command.stdout);
  const report = JSON.parse(command.stdout);
  assert.equal(report.mode, "read_only_verification");
  assert.equal(report.qualifiedBusinessCoverage, 398);
  assert.equal(report.nearbyContextRuntimeConsumptionAuthorized, false);
  for (const path of paths) assert.equal(read(path), before[path]);
});
