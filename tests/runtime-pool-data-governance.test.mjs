import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  gateFailures,
  runtimeMap,
  segmentRecord,
  toSegmentRecord
} from "../scripts/segment-google-runtime-pools.mjs";

const root = resolve(import.meta.dirname, "..");
const readJson = relativePath => JSON.parse(readFileSync(resolve(root, relativePath), "utf8"));

const sourceRecord = {
  prospect_id: "fixture-prospect",
  google_place_id: "fixture-place-id",
  business_name: "Fixture Office Supply",
  full_address: "100 Validation Way, Houston, TX 77001, USA",
  category: "Office",
  estimated_distance_miles: 1.2,
  source_type: "Google Places API",
  google_maps_url: "https://maps.google.com/maps/place/?q=place_id:fixture-place-id",
  latitude: 29.7,
  longitude: -95.3,
  access_type: "Walk-in ready",
  ask_for: "manager",
  quality_status: "verified",
  business_status: "OPERATIONAL",
  shared_approval: "approved"
};

const runtimeProfile = {
  id: "cruz-fixture-place",
  repProfileId: "cruz",
  seedRouteOrder: 4,
  name: "Fixture Office Supply",
  address: sourceRecord.full_address,
  category: "Office",
  distance: "1.2 mi",
  window: "Midday",
  priority: 88,
  sourceType: "Google Places API",
  qualityClass: "Excellent",
  qualityScore: 88,
  qualityReason: "Deterministic fixture quality explanation.",
  confidence: "High",
  accessType: "Walk-in ready",
  askFor: "manager",
  expectedVisitDuration: "5-9",
  expectedConversationOpportunity: "A manager conversation can be verified in the field.",
  expectedRoi: "Field-validation candidate.",
  decisionMakerAvailability: "Unknown until field verification.",
  permission: "Unknown",
  truthBasis: "Synthetic test data only.",
  notes: "Synthetic runtime projection fixture.",
  googlePlaceId: sourceRecord.google_place_id,
  googleMapsUrl: sourceRecord.google_maps_url,
  latitude: sourceRecord.latitude,
  longitude: sourceRecord.longitude
};

const provenance = {
  workspaceId: "fixture_workspace",
  operatingProfileId: "general_outside_sales",
  configurationVersion: "fixture-config-v1",
  manifestId: "fixture_approved_business_roster",
  manifestVersion: "route-iq-workspace-business-artifact-manifest-v1",
  artifactSha256: "a".repeat(64),
  classification: "SYNTHETIC_NONCANONICAL",
  approvalState: "APPROVED_SYNTHETIC_VALIDATION"
};

test("approved projection preserves every Dashboard-consumed runtime field and provenance", () => {
  const byPlaceId = runtimeMap({ cruz: [runtimeProfile], anthony: [] });
  const segment = segmentRecord(sourceRecord, byPlaceId, new Set(), {
    approvedRecordIds: new Set([sourceRecord.google_place_id])
  });
  assert.equal(segment.pool, "active");

  const projected = toSegmentRecord(sourceRecord, segment, "production_candidates", provenance);
  assert.equal(projected.workspaceId, provenance.workspaceId);
  assert.equal(projected.operatingProfileId, provenance.operatingProfileId);
  assert.equal(projected.artifactManifestId, provenance.manifestId);
  assert.equal(projected.sourceArtifactSha256, provenance.artifactSha256);
  assert.equal(projected.approvalState, provenance.approvalState);
  assert.deepEqual(projected.runtimeProfiles[0], {
    runtimeId: runtimeProfile.id,
    ...runtimeProfile,
    priority: 88,
    qualityScore: 88,
    latitude: sourceRecord.latitude,
    longitude: sourceRecord.longitude
  });
});

test("missing approval deterministically quarantines an otherwise valid record", () => {
  const failures = gateFailures({
    ...sourceRecord,
    shared_approval: "pending"
  }, {
    approvedRecordIds: new Set()
  });
  assert.deepEqual(failures, ["founder_approval_pending"]);
});

test("checked-in runtime pools contain only the canonical source and pending roster", () => {
  const source = readJson(
    "data/qualified-prospects/google-qualified-businesses-v2/google-qualified-businesses-v2.json"
  ).production_candidates;
  const active = readJson(
    "data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/active-pool.json"
  );
  const reserve = readJson(
    "data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/reserve-pool.json"
  );
  const quarantine = readJson(
    "data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/quarantine-pool.json"
  );
  const manifest = readJson(
    "data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/runtime-pool-manifest.json"
  );
  const sourceIds = new Set(source.map(record => record.google_place_id));
  const quarantineIds = new Set(quarantine.records.map(record => record.googlePlaceId));

  assert.equal(active.count, 0);
  assert.equal(reserve.count, 0);
  assert.equal(quarantine.count, 398);
  assert.equal(manifest.audit.noncanonicalRejectedSourcesExcluded, true);
  assert.equal(manifest.approvalState, "PENDING_FOUNDER_APPROVAL");
  assert.equal(manifest.approvedRecordCount, 0);
  assert.equal(manifest.demoFallbackAllowed, false);
  assert.equal(manifest.crossWorkspaceFallbackAllowed, false);
  assert.deepEqual(quarantineIds, sourceIds);
  assert.equal(quarantine.records.every(record => record.source === "production_candidates"), true);
  assert.equal(quarantine.records.every(record => record.poolAssignmentReasons.includes("founder_approval_pending")), true);
});
