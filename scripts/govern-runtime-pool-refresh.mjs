import fs from "node:fs";
import path from "node:path";
import {
  gateFailures,
  numberedAddress,
  readJson,
  safeMapsPattern,
  writeJson
} from "./segment-google-runtime-pools.mjs";

const DEFAULT_SEGMENTATION_DIR = "data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1";
const REQUIRED_RECORD_FIELDS = [
  "googlePlaceId",
  "businessName",
  "address",
  "category",
  "estimatedDistanceMiles",
  "sourceType",
  "googleMapsUrl",
  "latitude",
  "longitude",
  "accessType",
  "askFor",
  "qualityStatus",
  "businessStatus",
  "qualityClass",
  "qualityScore",
  "priority",
  "runtimeProfiles",
  "poolAssignmentReasons",
  "originalProspectId",
  "originalRecord",
  "source"
];
const REQUIRED_RUNTIME_PROFILE_FIELDS = [
  "runtimeId",
  "repProfileId",
  "seedRouteOrder",
  "qualityClass",
  "qualityScore",
  "priority"
];
const REQUIRED_POOL_MANIFEST_FIELDS = [
  "generatedAt",
  "sourceDatasetVersion",
  "segmentationVersion",
  "sourceFiles",
  "runtimeBehaviorChanged",
  "scoringChanged",
  "pool",
  "criteria",
  "count",
  "records"
];
const REQUIRED_ROOT_MANIFEST_FIELDS = [
  "generatedAt",
  "sourceDatasetVersion",
  "segmentationVersion",
  "sourceFiles",
  "runtimeBehaviorChanged",
  "scoringChanged",
  "counts",
  "audit",
  "verification",
  "files"
];
const POOLS = ["active", "reserve", "quarantine"];

function readArg(name, fallback = "") {
  const match = process.argv.slice(2).find(arg => arg.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function fileMap(segmentationDir) {
  return {
    active: path.join(segmentationDir, "active-pool.json"),
    reserve: path.join(segmentationDir, "reserve-pool.json"),
    quarantine: path.join(segmentationDir, "quarantine-pool.json"),
    manifest: path.join(segmentationDir, "runtime-pool-manifest.json"),
    baseline: path.join(segmentationDir, "governance-baseline.json"),
    reportJson: path.join(segmentationDir, "governance-report.json"),
    reportMd: path.join(segmentationDir, "governance-report.md"),
    promotion: path.join(segmentationDir, "promotion-gate.json")
  };
}

function shortRecord(record) {
  return {
    googlePlaceId: record.googlePlaceId,
    businessName: record.businessName,
    address: record.address,
    category: record.category,
    qualityClass: record.qualityClass,
    qualityScore: record.qualityScore,
    priority: record.priority,
    source: record.source
  };
}

function addFailure(failures, check, message, records = [], severity = "error") {
  failures.push({
    check,
    severity,
    message,
    affectedCount: records.length,
    affectedRecords: records.slice(0, 50).map(shortRecord)
  });
}

function missingFields(object, fields) {
  return fields.filter(field => object?.[field] === undefined || object?.[field] === null || object?.[field] === "");
}

function invalidCoordinate(latitude, longitude) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  return !Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180;
}

function duplicateRecords(records) {
  const seen = new Map();
  const duplicates = [];
  for (const record of records) {
    const key = record.googlePlaceId || `${record.businessName}|${record.address}`;
    if (seen.has(key)) duplicates.push(record);
    else seen.set(key, record);
  }
  return duplicates;
}

function intersectionRecords(left, right) {
  const rightIds = new Set(right.map(record => record.googlePlaceId));
  return left.filter(record => rightIds.has(record.googlePlaceId));
}

function countBy(records, field) {
  return records.reduce((acc, record) => {
    const key = record[field] || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function reasonCounts(records) {
  return records.reduce((acc, record) => {
    for (const reason of record.poolAssignmentReasons || []) {
      acc[reason] = (acc[reason] || 0) + 1;
    }
    return acc;
  }, {});
}

function loadPools(files) {
  return {
    active: readJson(files.active),
    reserve: readJson(files.reserve),
    quarantine: readJson(files.quarantine),
    manifest: readJson(files.manifest)
  };
}

function snapshotFromPools(pools) {
  const entries = {};
  for (const pool of POOLS) {
    for (const record of pools[pool].records || []) {
      entries[record.googlePlaceId] = {
        pool,
        businessName: record.businessName,
        address: record.address,
        category: record.category,
        qualityClass: record.qualityClass,
        qualityScore: Number(record.qualityScore),
        priority: Number(record.priority)
      };
    }
  }
  return {
    generatedAt: new Date().toISOString(),
    sourceDatasetVersion: pools.manifest.sourceDatasetVersion,
    segmentationVersion: pools.manifest.segmentationVersion,
    counts: pools.manifest.counts,
    entries
  };
}

function compareToBaseline(current, baseline) {
  const currentIds = new Set(Object.keys(current.entries));
  const baselineIds = new Set(Object.keys(baseline.entries || {}));
  const added = [...currentIds]
    .filter(id => !baselineIds.has(id))
    .map(id => ({ googlePlaceId: id, ...current.entries[id] }));
  const removed = [...baselineIds]
    .filter(id => !currentIds.has(id))
    .map(id => ({ googlePlaceId: id, ...baseline.entries[id] }));
  const moved = [...currentIds]
    .filter(id => baselineIds.has(id) && current.entries[id].pool !== baseline.entries[id].pool)
    .map(id => ({ googlePlaceId: id, before: baseline.entries[id], after: current.entries[id] }));
  const scoringChanged = [...currentIds]
    .filter(id => {
      if (!baselineIds.has(id)) return false;
      const before = baseline.entries[id];
      const after = current.entries[id];
      return before.qualityClass !== after.qualityClass ||
        Number(before.qualityScore) !== Number(after.qualityScore) ||
        Number(before.priority) !== Number(after.priority);
    })
    .map(id => ({ googlePlaceId: id, before: baseline.entries[id], after: current.entries[id] }));

  return { added, removed, moved, scoringChanged };
}

function validatePoolManifests(pools, failures) {
  for (const pool of POOLS) {
    const manifest = pools[pool];
    const missing = missingFields(manifest, REQUIRED_POOL_MANIFEST_FIELDS);
    if (missing.length) addFailure(failures, `${pool}_pool_contract`, `${pool} pool manifest is missing required fields: ${missing.join(", ")}`);
    if (manifest.pool !== pool) addFailure(failures, `${pool}_pool_name`, `${pool} pool manifest declares pool=${manifest.pool}`);
    if (!Array.isArray(manifest.records)) addFailure(failures, `${pool}_records_array`, `${pool} pool records is not an array`);
    if (manifest.count !== (manifest.records || []).length) addFailure(failures, `${pool}_count`, `${pool} pool count does not match records length`);
    if (manifest.runtimeBehaviorChanged !== false || manifest.scoringChanged !== false) {
      addFailure(failures, `${pool}_stable_flags`, `${pool} pool runtime/scoring stable flags are not false`);
    }
  }

  const missingRoot = missingFields(pools.manifest, REQUIRED_ROOT_MANIFEST_FIELDS);
  if (missingRoot.length) addFailure(failures, "root_manifest_contract", `Root manifest is missing required fields: ${missingRoot.join(", ")}`);
  if (pools.manifest.runtimeBehaviorChanged !== false || pools.manifest.scoringChanged !== false) {
    addFailure(failures, "root_stable_flags", "Root manifest runtime/scoring stable flags are not false");
  }
  const verification = pools.manifest.verification || {};
  for (const flag of ["runtimeBehaviorChanged", "scoringChanged", "existingRuntimePoolsModified"]) {
    if (verification[flag] !== false) addFailure(failures, "manifest_verification_flags", `Root verification flag ${flag} is not false`);
  }
}

function validateRecords(pools, failures) {
  const allRecords = [];
  for (const pool of POOLS) {
    for (const record of pools[pool].records || []) allRecords.push({ ...record, pool });
  }

  const activeRecords = pools.active.records || [];
  const reserveRecords = pools.reserve.records || [];
  const quarantineRecords = pools.quarantine.records || [];
  const activeReserveOverlap = intersectionRecords(activeRecords, reserveRecords);
  const activeQuarantineOverlap = intersectionRecords(activeRecords, quarantineRecords);
  const reserveQuarantineOverlap = intersectionRecords(reserveRecords, quarantineRecords);

  for (const pool of POOLS) {
    const records = pools[pool].records || [];
    const duplicates = duplicateRecords(records);
    if (duplicates.length) addFailure(failures, `${pool}_duplicate_place_ids`, `${pool} pool contains duplicate Google Place IDs`, duplicates);
  }
  if (activeReserveOverlap.length) addFailure(failures, "active_reserve_overlap", "Records appear in both active and reserve pools", activeReserveOverlap);
  if (activeQuarantineOverlap.length) addFailure(failures, "active_quarantine_overlap", "Records appear in both active and quarantine pools", activeQuarantineOverlap);
  if (reserveQuarantineOverlap.length) addFailure(failures, "reserve_quarantine_overlap", "Records appear in both reserve and quarantine pools", reserveQuarantineOverlap);

  for (const pool of POOLS) {
    const records = pools[pool].records || [];
    const missingRequired = records.filter(record => missingFields(record, REQUIRED_RECORD_FIELDS).length);
    if (missingRequired.length) addFailure(failures, `${pool}_required_fields`, `${pool} records are missing required runtime fields`, missingRequired);

    const malformedAddress = records.filter(record => !numberedAddress(record.address));
    if (pool !== "quarantine" && malformedAddress.length) addFailure(failures, `${pool}_address`, `${pool} records have missing or malformed numbered addresses`, malformedAddress);

    const invalidCoordinates = records.filter(record => invalidCoordinate(record.latitude, record.longitude));
    if (pool !== "quarantine" && invalidCoordinates.length) addFailure(failures, `${pool}_coordinates`, `${pool} records have invalid coordinates`, invalidCoordinates);

    const invalidMaps = records.filter(record => !record.googleMapsUrl || !safeMapsPattern.test(String(record.googleMapsUrl)));
    if (pool !== "quarantine" && invalidMaps.length) addFailure(failures, `${pool}_maps_link`, `${pool} records have invalid or missing Google Maps links`, invalidMaps);

    const missingRuntimeProfileFields = records.filter(record => {
      if (!Array.isArray(record.runtimeProfiles)) return true;
      return record.runtimeProfiles.some(profile => missingFields(profile, REQUIRED_RUNTIME_PROFILE_FIELDS).length);
    });
    if (pool !== "quarantine" && missingRuntimeProfileFields.length) {
      addFailure(failures, `${pool}_runtime_profile_contract`, `${pool} records have malformed runtime profile metadata`, missingRuntimeProfileFields);
    }
  }

  const invalidActive = activeRecords.filter(record => {
    const originalFailures = gateFailures(record.originalRecord || {});
    return originalFailures.length ||
      !["Excellent", "Good"].includes(record.qualityClass) ||
      record.qualityStatus !== "verified" ||
      record.accessType === "Do not recommend";
  });
  if (invalidActive.length) addFailure(failures, "active_integrity", "Active pool contains invalid or non-active-quality records", invalidActive);

  const invalidReserve = reserveRecords.filter(record => {
    const originalFailures = gateFailures(record.originalRecord || {});
    return originalFailures.length ||
      !["Average", "Poor"].includes(record.qualityClass) ||
      record.qualityStatus !== "verified" ||
      record.accessType === "Do not recommend";
  });
  if (invalidReserve.length) addFailure(failures, "reserve_integrity", "Reserve pool contains invalid or non-reserve-quality records", invalidReserve);

  const quarantineWithoutReason = quarantineRecords.filter(record => !Array.isArray(record.poolAssignmentReasons) || !record.poolAssignmentReasons.length);
  if (quarantineWithoutReason.length) addFailure(failures, "quarantine_reasons", "Quarantine records are missing quarantine reasons", quarantineWithoutReason);

  return allRecords;
}

function validateManifestStats(pools, failures) {
  const counts = {
    active: (pools.active.records || []).length,
    reserve: (pools.reserve.records || []).length,
    quarantine: (pools.quarantine.records || []).length
  };
  for (const pool of POOLS) {
    if (pools.manifest.counts?.[pool] !== counts[pool]) {
      addFailure(failures, "manifest_counts", `Root manifest ${pool} count does not match ${pool} records length`);
    }
  }
  const allRecords = POOLS.flatMap(pool => pools[pool].records || []);
  const expectedAudited = Number(pools.manifest.audit?.productionRecordsAudited || 0) +
    Number(pools.manifest.audit?.rejectedRecordsAudited || 0) +
    Number(pools.manifest.audit?.closedRecordsAudited || 0);
  if (expectedAudited && expectedAudited !== allRecords.length) {
    addFailure(failures, "assignment_completeness", `Pool record count ${allRecords.length} does not match audited source count ${expectedAudited}`);
  }
}

function buildStats(pools) {
  const stats = {};
  for (const pool of POOLS) {
    const records = pools[pool].records || [];
    stats[pool] = {
      count: records.length,
      categories: countBy(records, "category"),
      qualityClasses: countBy(records, "qualityClass"),
      assignmentReasons: reasonCounts(records)
    };
  }
  return stats;
}

function buildMarkdownReport(report) {
  const failures = report.failures.length
    ? report.failures.map(failure => `- [${failure.severity}] ${failure.check}: ${failure.message} (${failure.affectedCount})`).join("\n")
    : "- None";
  return `# Runtime Pool Refresh Governance v1

Generated: ${report.generatedAt}
Status: ${report.status}
Promotion allowed: ${report.promotionAllowed}

## Counts

- Active: ${report.stats.active.count}
- Reserve: ${report.stats.reserve.count}
- Quarantine: ${report.stats.quarantine.count}

## Change Summary

- Added since baseline: ${report.changeSummary.added.length}
- Removed since baseline: ${report.changeSummary.removed.length}
- Moved pools since baseline: ${report.changeSummary.moved.length}
- Scoring changes since baseline: ${report.changeSummary.scoringChanged.length}
- Baseline available: ${report.baseline.available}
- Baseline updated: ${report.baseline.updated}

## Failures

${failures}

## Promotion Gate

${report.promotionAllowed ? "PASS: dataset may be promoted for Dashboard consumption through the existing exported interface." : "FAIL: dataset must not be promoted for Dashboard consumption."}`;
}

export function runGovernance(options = {}) {
  const segmentationDir = options.segmentationDir || DEFAULT_SEGMENTATION_DIR;
  const files = fileMap(segmentationDir);
  const baselinePath = options.baselinePath || files.baseline;
  const reportJsonPath = options.reportJsonPath || files.reportJson;
  const reportMdPath = options.reportMdPath || files.reportMd;
  const promotionPath = options.promotionPath || files.promotion;
  const updateBaseline = Boolean(options.updateBaseline);
  const allowMembershipChanges = Boolean(options.allowMembershipChanges);
  const allowScoringChanges = Boolean(options.allowScoringChanges);
  const writeReports = options.writeReports !== false;

  const pools = loadPools(files);
  const failures = [];
  validatePoolManifests(pools, failures);
  validateRecords(pools, failures);
  validateManifestStats(pools, failures);

  const currentSnapshot = snapshotFromPools(pools);
  const baselineAvailable = fs.existsSync(baselinePath);
  const baseline = baselineAvailable ? readJson(baselinePath) : null;
  const changeSummary = baseline
    ? compareToBaseline(currentSnapshot, baseline)
    : { added: [], removed: [], moved: [], scoringChanged: [] };

  if (!baselineAvailable && !updateBaseline) {
    addFailure(failures, "baseline_missing", `Governance baseline is missing at ${baselinePath}`);
  }
  if (!allowMembershipChanges && (changeSummary.added.length || changeSummary.removed.length || changeSummary.moved.length)) {
    addFailure(failures, "unexpected_pool_membership_changes", "Pool membership changed relative to governance baseline", [
      ...changeSummary.added.map(change => ({ ...change, businessName: change.businessName || "added record" })),
      ...changeSummary.removed.map(change => ({ ...change, businessName: change.businessName || "removed record" })),
      ...changeSummary.moved.map(change => ({
        googlePlaceId: change.googlePlaceId,
        businessName: change.after.businessName,
        address: change.after.address,
        category: change.after.category,
        qualityClass: change.after.qualityClass,
        qualityScore: change.after.qualityScore,
        priority: change.after.priority
      }))
    ]);
  }
  if (!allowScoringChanges && changeSummary.scoringChanged.length) {
    addFailure(failures, "unexpected_scoring_changes", "Runtime quality class, quality score, or priority changed relative to governance baseline", changeSummary.scoringChanged.map(change => ({
      googlePlaceId: change.googlePlaceId,
      businessName: change.after.businessName,
      address: change.after.address,
      category: change.after.category,
      qualityClass: change.after.qualityClass,
      qualityScore: change.after.qualityScore,
      priority: change.after.priority
    })));
  }

  const report = {
    generatedAt: new Date().toISOString(),
    status: failures.length ? "failed" : "passed",
    promotionAllowed: failures.length === 0,
    segmentationDir,
    baseline: {
      path: baselinePath,
      available: baselineAvailable,
      updated: false
    },
    stats: buildStats(pools),
    changeSummary,
    failures
  };

  if (updateBaseline && report.promotionAllowed) {
    writeJson(baselinePath, currentSnapshot);
    report.baseline.updated = true;
  }

  if (writeReports) {
    writeJson(reportJsonPath, report);
    fs.writeFileSync(reportMdPath, buildMarkdownReport(report) + "\n");
    writeJson(promotionPath, {
      generatedAt: report.generatedAt,
      status: report.status,
      promotionAllowed: report.promotionAllowed,
      report: reportJsonPath,
      activePool: files.active,
      reservePool: files.reserve,
      quarantinePool: files.quarantine
    });
  }

  return report;
}

function main() {
  const segmentationDir = readArg("--segmentation-dir", DEFAULT_SEGMENTATION_DIR);
  const report = runGovernance({
    segmentationDir,
    baselinePath: readArg("--baseline", ""),
    updateBaseline: hasFlag("--update-baseline"),
    allowMembershipChanges: hasFlag("--allow-membership-changes"),
    allowScoringChanges: hasFlag("--allow-scoring-changes")
  });
  console.log(JSON.stringify({
    status: report.status,
    promotionAllowed: report.promotionAllowed,
    active: report.stats.active.count,
    reserve: report.stats.reserve.count,
    quarantine: report.stats.quarantine.count,
    failureCount: report.failures.length,
    baselineUpdated: report.baseline.updated
  }, null, 2));
  if (!report.promotionAllowed) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
