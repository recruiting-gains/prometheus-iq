import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runGovernance } from "./govern-runtime-pool-refresh.mjs";
import { readJson, writeJson } from "./segment-google-runtime-pools.mjs";

const SOURCE_DIR = "data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1";

function tempSegmentationDir() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "prometheus-runtime-governance-"));
  const destination = path.join(root, "runtime-pool-segmentation-v1");
  fs.cpSync(SOURCE_DIR, destination, { recursive: true });
  return destination;
}

function readPool(dir, pool) {
  return readJson(path.join(dir, `${pool}-pool.json`));
}

function writePool(dir, pool, payload) {
  writeJson(path.join(dir, `${pool}-pool.json`), payload);
}

function withFixture(testFn) {
  const dir = tempSegmentationDir();
  const baseline = path.join(dir, "governance-baseline.json");
  const initial = runGovernance({ segmentationDir: dir, baselinePath: baseline, updateBaseline: true });
  assert.equal(initial.status, "passed");
  assert.equal(initial.baseline.updated, true);
  testFn(dir, baseline);
}

function assertFailsWith(dir, baseline, expectedCheck) {
  const report = runGovernance({ segmentationDir: dir, baselinePath: baseline });
  assert.equal(report.status, "failed");
  assert.equal(report.promotionAllowed, false);
  assert(report.failures.some(failure => failure.check === expectedCheck), `Expected ${expectedCheck}, got ${report.failures.map(f => f.check).join(", ")}`);
}

withFixture((dir, baseline) => {
  const report = runGovernance({ segmentationDir: dir, baselinePath: baseline });
  assert.equal(report.status, "passed");
  assert.equal(report.promotionAllowed, true);
  assert.equal(report.stats.active.count, 297);
  assert.equal(report.stats.reserve.count, 44);
  assert.equal(report.stats.quarantine.count, 109);
  const quarantine = readPool(dir, "quarantine");
  assert.equal(quarantine.records.filter(record => record.address === "10820 Hughes Rd, Houston, TX 77089, USA").length, 3);
  const active = readPool(dir, "active");
  assert.equal(active.records.filter(record => record.address === "10820 Hughes Rd, Houston, TX 77089, USA").length, 0);
});

withFixture((dir, baseline) => {
  const active = readPool(dir, "active");
  active.records[1].googlePlaceId = active.records[0].googlePlaceId;
  writePool(dir, "active", active);
  assertFailsWith(dir, baseline, "active_duplicate_place_ids");
});

withFixture((dir, baseline) => {
  const active = readPool(dir, "active");
  active.records[0].address = "Houston, TX";
  active.records[0].originalRecord.full_address = "Houston, TX";
  writePool(dir, "active", active);
  assertFailsWith(dir, baseline, "active_address");
});

withFixture((dir, baseline) => {
  const active = readPool(dir, "active");
  const quarantine = readPool(dir, "quarantine");
  const residentialRecord = quarantine.records.find(record => record.address === "10820 Hughes Rd, Houston, TX 77089, USA");
  assert(residentialRecord, "Expected residential-house barber override record in quarantine.");
  active.records.unshift({
    ...residentialRecord,
    qualityClass: "Excellent",
    qualityScore: 93.7,
    priority: 94,
    poolAssignmentReasons: ["highest_quality_verified_runtime_candidate"]
  });
  active.count = active.records.length;
  writePool(dir, "active", active);
  assertFailsWith(dir, baseline, "active_integrity");
});

withFixture((dir, baseline) => {
  const active = readPool(dir, "active");
  active.records[0].latitude = 999;
  writePool(dir, "active", active);
  assertFailsWith(dir, baseline, "active_coordinates");
});

withFixture((dir, baseline) => {
  const active = readPool(dir, "active");
  active.records[0].googleMapsUrl = "https://example.com/not-google-maps";
  active.records[0].originalRecord.google_maps_url = "https://example.com/not-google-maps";
  writePool(dir, "active", active);
  assertFailsWith(dir, baseline, "active_maps_link");
});

withFixture((dir, baseline) => {
  const reserve = readPool(dir, "reserve");
  delete reserve.records[0].askFor;
  writePool(dir, "reserve", reserve);
  assertFailsWith(dir, baseline, "reserve_required_fields");
});

withFixture((dir, baseline) => {
  const active = readPool(dir, "active");
  active.records[0].qualityScore = Number(active.records[0].qualityScore) + 1;
  writePool(dir, "active", active);
  assertFailsWith(dir, baseline, "unexpected_scoring_changes");
});

withFixture((dir, baseline) => {
  const active = readPool(dir, "active");
  const reserve = readPool(dir, "reserve");
  const moved = active.records.shift();
  active.count = active.records.length;
  reserve.records.push({ ...moved, poolAssignmentReasons: ["production_safe_but_not_active_quality_band"] });
  reserve.count = reserve.records.length;
  writePool(dir, "active", active);
  writePool(dir, "reserve", reserve);
  assertFailsWith(dir, baseline, "unexpected_pool_membership_changes");
});

console.log("Runtime pool governance tests passed.");
