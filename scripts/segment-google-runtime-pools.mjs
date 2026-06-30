import fs from "node:fs";
import path from "node:path";

const SOURCE_DIR = "data/qualified-prospects/google-qualified-businesses-v2";
const SEGMENTATION_VERSION = "runtime-pool-segmentation-v1";
const OUTPUT_DIR = path.join(SOURCE_DIR, SEGMENTATION_VERSION);

const sourceFiles = {
  production: path.join(SOURCE_DIR, "google-qualified-businesses-v2.json"),
  rejected: path.join(SOURCE_DIR, "rejected-records.json"),
  runtime: path.join(SOURCE_DIR, "runtime-pools.json")
};

const outputFiles = {
  active: path.join(OUTPUT_DIR, "active-pool.json"),
  reserve: path.join(OUTPUT_DIR, "reserve-pool.json"),
  quarantine: path.join(OUTPUT_DIR, "quarantine-pool.json"),
  manifest: path.join(OUTPUT_DIR, "runtime-pool-manifest.json"),
  report: path.join(OUTPUT_DIR, "segmentation-report.md")
};

export const genericNamePattern = /\b(mall|plaza|town center|shopping center|airport|campus|park\s*&\s*ride|park and ride|government|city hall|courthouse|police station|fire station|placeholder|corridor|sweep|area|district)\b/i;
export const safeMapsPattern = /^https:\/\/((www\.)?google\.[^/]+\/maps\/|maps\.google\.[^/]+\/|maps\.app\.goo\.gl\/)/i;
const activeQualityClasses = new Set(["Excellent", "Good"]);
const reserveQualityClasses = new Set(["Average", "Poor"]);

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n");
}

export function normalize(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function numberedAddress(address) {
  return /(?:^|,\s*)\d+[a-z]?\s+[a-z0-9]/i.test(String(address || ""));
}

export function runtimeMap(runtime) {
  const byPlaceId = new Map();
  for (const profileId of ["cruz", "anthony"]) {
    for (const place of runtime[profileId] || []) {
      if (!place.googlePlaceId) continue;
      const entry = byPlaceId.get(place.googlePlaceId) || {
        profiles: [],
        qualityClass: place.qualityClass,
        qualityScore: Number(place.qualityScore || 0),
        priority: Number(place.priority || 0)
      };
      entry.profiles.push({
        runtimeId: place.id,
        repProfileId: place.repProfileId,
        seedRouteOrder: place.seedRouteOrder,
        qualityClass: place.qualityClass,
        qualityScore: Number(place.qualityScore || 0),
        priority: Number(place.priority || 0)
      });
      if (Number(place.qualityScore || 0) > entry.qualityScore) {
        entry.qualityClass = place.qualityClass;
        entry.qualityScore = Number(place.qualityScore || 0);
        entry.priority = Number(place.priority || 0);
      }
      byPlaceId.set(place.googlePlaceId, entry);
    }
  }
  return byPlaceId;
}

export function gateFailures(record) {
  const failures = [];
  if (!record.google_place_id) failures.push("missing_place_id");
  if (!record.business_name || /^\d+[a-z]?\s+/i.test(record.business_name)) failures.push("invalid_business_name");
  if (!numberedAddress(record.full_address)) failures.push("missing_numbered_address");
  if (!safeMapsPattern.test(String(record.google_maps_url || ""))) failures.push("invalid_directions");
  if (record.source_type !== "Google Places API") failures.push("not_google_places_source");
  if (record.quality_status !== "verified") failures.push("not_verified");
  if (record.access_type === "Do not recommend") failures.push("do_not_recommend");
  if (record.is_generic_place === "yes" || genericNamePattern.test(`${record.business_name} ${record.full_address}`)) failures.push("generic_business");
  if (record.business_status === "CLOSED_PERMANENTLY") failures.push("closed_business");
  return failures;
}

export function runtimeMetadataFor(record, runtimeByPlaceId) {
  const runtime = runtimeByPlaceId.get(record.google_place_id);
  return {
    runtimeProfiles: runtime?.profiles || [],
    qualityClass: runtime?.qualityClass || "Unscored",
    qualityScore: runtime?.qualityScore || 0,
    priority: runtime?.priority || 0
  };
}

export function segmentRecord(record, runtimeByPlaceId, duplicatePlaceIds) {
  const runtime = runtimeMetadataFor(record, runtimeByPlaceId);
  const failures = gateFailures(record);
  if (duplicatePlaceIds.has(record.google_place_id)) failures.push("duplicate_place_id");
  if (runtime.qualityClass === "Never Visit") failures.push("runtime_quality_never_visit");
  if (failures.length) {
    return { pool: "quarantine", reasons: failures, runtime };
  }
  if (activeQualityClasses.has(runtime.qualityClass)) {
    return { pool: "active", reasons: ["highest_quality_verified_runtime_candidate"], runtime };
  }
  if (reserveQualityClasses.has(runtime.qualityClass)) {
    return { pool: "reserve", reasons: ["production_safe_but_not_active_quality_band"], runtime };
  }
  return { pool: "quarantine", reasons: ["missing_runtime_quality_class"], runtime };
}

export function toSegmentRecord(record, segment, source) {
  return {
    googlePlaceId: record.google_place_id,
    businessName: record.business_name,
    address: record.full_address,
    category: record.category,
    estimatedDistanceMiles: Number(record.estimated_distance_miles),
    sourceType: record.source_type,
    googleMapsUrl: record.google_maps_url,
    latitude: Number(record.latitude),
    longitude: Number(record.longitude),
    accessType: record.access_type,
    askFor: record.ask_for,
    qualityStatus: record.quality_status,
    businessStatus: record.business_status || "OPERATIONAL",
    qualityClass: segment.runtime.qualityClass,
    qualityScore: segment.runtime.qualityScore,
    priority: segment.runtime.priority,
    runtimeProfiles: segment.runtime.runtimeProfiles,
    poolAssignmentReasons: segment.reasons,
    originalProspectId: record.prospect_id,
    originalRecord: record,
    source
  };
}

export function countReasons(records) {
  return records.reduce((acc, record) => {
    for (const reason of record.poolAssignmentReasons || []) {
      acc[reason] = (acc[reason] || 0) + 1;
    }
    return acc;
  }, {});
}

export function assertUnique(records, label) {
  const seen = new Set();
  const duplicates = [];
  for (const record of records) {
    const key = record.googlePlaceId || normalize(`${record.businessName} ${record.address}`);
    if (seen.has(key)) duplicates.push(key);
    seen.add(key);
  }
  if (duplicates.length) {
    throw new Error(`${label} contains duplicate IDs: ${duplicates.slice(0, 5).join(", ")}`);
  }
}

function buildReport(manifest) {
  return `# Runtime Pool Segmentation v1

Generated: ${manifest.generatedAt}
Source dataset: ${manifest.sourceDatasetVersion}
Segmentation version: ${manifest.segmentationVersion}

## Counts

- Active: ${manifest.counts.active}
- Reserve: ${manifest.counts.reserve}
- Quarantine: ${manifest.counts.quarantine}
- Audited production records: ${manifest.audit.productionRecordsAudited}
- Audited rejected records: ${manifest.audit.rejectedRecordsAudited}

## Rules

- Active: verified production-safe runtime businesses with existing quality class Excellent or Good.
- Reserve: verified production-safe runtime businesses with existing quality class Average or Poor.
- Quarantine: failed gates, duplicate Place IDs, generic businesses, missing numbered addresses, invalid directions, closed businesses, corrupt/unverified records, or existing runtime quality class Never Visit.

## Verification

- Active duplicate Place IDs: ${manifest.verification.activeDuplicatePlaceIds}
- Reserve duplicate Place IDs: ${manifest.verification.reserveDuplicatePlaceIds}
- Active invalid records: ${manifest.verification.activeInvalidRecords}
- Active/reserve overlap: ${manifest.verification.activeReserveOverlap}
- Runtime behavior changed: ${manifest.verification.runtimeBehaviorChanged}
- Scoring changed: ${manifest.verification.scoringChanged}

## Files

- ${outputFiles.active}
- ${outputFiles.reserve}
- ${outputFiles.quarantine}
- ${outputFiles.manifest}`;
}

export function main() {
  const productionPayload = readJson(sourceFiles.production);
  const rejectedPayload = readJson(sourceFiles.rejected);
  const runtimePayload = readJson(sourceFiles.runtime);
  const production = productionPayload.production_candidates || [];
  const rejected = rejectedPayload.rejected || [];
  const closed = rejectedPayload.closed_removed || [];
  const runtimeByPlaceId = runtimeMap(runtimePayload);

  const placeIdCounts = production.reduce((acc, record) => {
    const key = record.google_place_id || normalize(`${record.business_name} ${record.full_address}`);
    acc.set(key, (acc.get(key) || 0) + 1);
    return acc;
  }, new Map());
  const duplicatePlaceIds = new Set([...placeIdCounts].filter(([, count]) => count > 1).map(([placeId]) => placeId));

  const active = [];
  const reserve = [];
  const quarantine = [];

  for (const record of production) {
    const segment = segmentRecord(record, runtimeByPlaceId, duplicatePlaceIds);
    const outputRecord = toSegmentRecord(record, segment, "production_candidates");
    if (segment.pool === "active") active.push(outputRecord);
    else if (segment.pool === "reserve") reserve.push(outputRecord);
    else quarantine.push(outputRecord);
  }

  for (const record of rejected) {
    quarantine.push(toSegmentRecord(record, {
      runtime: runtimeMetadataFor(record, runtimeByPlaceId),
      reasons: record.rejection_reasons?.length ? record.rejection_reasons : gateFailures(record)
    }, "rejected_records"));
  }

  for (const record of closed) {
    quarantine.push(toSegmentRecord(record, {
      runtime: runtimeMetadataFor(record, runtimeByPlaceId),
      reasons: ["closed_business"]
    }, "closed_removed"));
  }

  assertUnique(active, "Active pool");
  assertUnique(reserve, "Reserve pool");
  assertUnique(quarantine, "Quarantine pool");

  const activeIds = new Set(active.map(record => record.googlePlaceId));
  const reserveIds = new Set(reserve.map(record => record.googlePlaceId));
  const activeReserveOverlap = [...activeIds].filter(id => reserveIds.has(id)).length;
  const activeInvalidRecords = active.filter(record => gateFailures(record.originalRecord).length).length;

  const generatedAt = new Date().toISOString();
  const shared = {
    generatedAt,
    sourceDatasetVersion: productionPayload.dataset_version || "google-qualified-businesses-v2",
    segmentationVersion: SEGMENTATION_VERSION,
    sourceFiles,
    runtimeBehaviorChanged: false,
    scoringChanged: false
  };

  const activeManifest = {
    ...shared,
    pool: "active",
    criteria: "Production-safe Google Places records with existing runtime quality class Excellent or Good.",
    count: active.length,
    records: active
  };
  const reserveManifest = {
    ...shared,
    pool: "reserve",
    criteria: "Production-safe Google Places records with existing runtime quality class Average or Poor.",
    count: reserve.length,
    records: reserve
  };
  const quarantineManifest = {
    ...shared,
    pool: "quarantine",
    criteria: "Records that fail quality gates, are duplicate IDs, are closed, are generic/corrupt/unverified, or have existing runtime quality class Never Visit.",
    count: quarantine.length,
    reasonCounts: countReasons(quarantine),
    records: quarantine
  };

  const manifest = {
    ...shared,
    counts: {
      active: active.length,
      reserve: reserve.length,
      quarantine: quarantine.length
    },
    audit: {
      productionRecordsAudited: production.length,
      rejectedRecordsAudited: rejected.length,
      closedRecordsAudited: closed.length,
      runtimeProfileRecordsRead: (runtimePayload.cruz || []).length + (runtimePayload.anthony || []).length,
      runtimeUniquePlaceIds: runtimeByPlaceId.size,
      duplicateProductionPlaceIds: duplicatePlaceIds.size,
      quarantineReasonCounts: countReasons(quarantine)
    },
    verification: {
      activeDuplicatePlaceIds: 0,
      reserveDuplicatePlaceIds: 0,
      quarantineDuplicatePlaceIds: 0,
      activeInvalidRecords,
      activeReserveOverlap,
      runtimeBehaviorChanged: false,
      scoringChanged: false,
      existingRuntimePoolsModified: false
    },
    files: outputFiles
  };

  if (activeInvalidRecords || activeReserveOverlap) {
    throw new Error(`Segmentation verification failed: activeInvalidRecords=${activeInvalidRecords}, activeReserveOverlap=${activeReserveOverlap}`);
  }

  writeJson(outputFiles.active, activeManifest);
  writeJson(outputFiles.reserve, reserveManifest);
  writeJson(outputFiles.quarantine, quarantineManifest);
  writeJson(outputFiles.manifest, manifest);
  fs.writeFileSync(outputFiles.report, buildReport(manifest) + "\n");

  console.log(JSON.stringify({
    status: "complete",
    segmentationVersion: SEGMENTATION_VERSION,
    active: active.length,
    reserve: reserve.length,
    quarantine: quarantine.length,
    activeInvalidRecords,
    activeReserveOverlap,
    outputDir: OUTPUT_DIR
  }, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
