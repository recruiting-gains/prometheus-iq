import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = path => readFileSync(resolve(root, path), "utf8");
const readJson = path => JSON.parse(read(path));
const failures = [];
const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

const sourceActivePath = "data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/active-pool.json";
const deployActivePath = "deploy/cloudflare-pages/data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/active-pool.json";
const sourceFullPath = "data/qualified-prospects/google-qualified-businesses-v2/runtime-pools.json";
const deployFullPath = "deploy/cloudflare-pages/data/qualified-prospects/google-qualified-businesses-v2/runtime-pools.json";
const activeRuntimePath = "./data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/active-pool.json";
const fullRuntimePath = "./data/qualified-prospects/google-qualified-businesses-v2/runtime-pools.json";

const index = read("index.html");
const deployIndex = read("deploy/cloudflare-pages/index.html");
const headers = read("_headers");
const deployHeaders = read("deploy/cloudflare-pages/_headers");
const sourceActive = readJson(sourceActivePath);
const deployActive = readJson(deployActivePath);
const sourceFull = readJson(sourceFullPath);
const deployFull = readJson(deployFullPath);

assert(index === deployIndex, "Dashboard source and deploy index must stay in sync.");
assert(index.includes(`const runtimeDatasetActivePath = "${activeRuntimePath}"`), "Dashboard must declare the Active pool runtime path.");
assert(index.includes(`const runtimeDatasetFullPath = "${fullRuntimePath}"`), "Dashboard must retain the full runtime dataset fallback path.");
assert(index.includes('const requestedRuntimePool = appUrlParams.get("runtimePool") === "full" ? "full" : "active";'), "Dashboard must default runtimePool to Active and allow internal full fallback selection.");
assert(/return \[\s*\{\s*pool: "active", path: runtimeDatasetActivePath\s*\},\s*\{\s*pool: "full", path: runtimeDatasetFullPath\s*\}/s.test(index), "Dashboard must try Active before full runtime fallback.");
assert(index.includes("function normalizeSegmentedRuntimeDataset(payload)"), "Dashboard must include a segmented pool adapter.");
assert(index.includes("payload.runtimeBehaviorChanged !== false || payload.scoringChanged !== false"), "Dashboard must guard Data behavior/scoring contract flags.");

const script = index.match(/<script>([\s\S]*?)<\/script>/)?.[1] || "";
const hash = `sha256-${createHash("sha256").update(script, "utf8").digest("base64")}`;
assert(headers.includes(`'${hash}'`), "Root headers must contain the current Dashboard CSP hash.");
assert(deployHeaders.includes(`'${hash}'`), "Deploy headers must contain the current Dashboard CSP hash.");

assert(read(sourceActivePath) === read(deployActivePath), "Deploy Active pool must match the Data-exported Active pool exactly.");
assert(read(sourceFullPath) === read(deployFullPath), "Deploy full runtime pool must match the Data-exported runtime pool exactly.");

assert(sourceActive.sourceDatasetVersion === "google-qualified-businesses-v2", "Active pool must identify the expected source dataset version.");
assert(sourceActive.segmentationVersion === "runtime-pool-segmentation-v1", "Active pool must identify the expected segmentation version.");
assert(sourceActive.pool === "active", "Active pool export must identify pool=active.");
assert(sourceActive.runtimeBehaviorChanged === false, "Active pool must not declare runtime behavior changes.");
assert(sourceActive.scoringChanged === false, "Active pool must not declare scoring changes.");
assert(sourceActive.count === 300, "Active pool must contain 300 active business records.");
assert(Array.isArray(sourceActive.records) && sourceActive.records.length === sourceActive.count, "Active pool count must match records length.");

const activeRouteRecords = [];
const activePlaceIds = new Set();
for (const record of sourceActive.records || []) {
  assert(record.googlePlaceId && !activePlaceIds.has(record.googlePlaceId), `Active pool duplicate Google Place ID: ${record.googlePlaceId || "missing"}`);
  activePlaceIds.add(record.googlePlaceId);
  assert(Array.isArray(record.runtimeProfiles) && record.runtimeProfiles.length > 0, `Active record has no runtimeProfiles: ${record.googlePlaceId || record.businessName || "unknown"}`);
  for (const profile of record.runtimeProfiles || []) {
    activeRouteRecords.push({
      id: profile.runtimeId,
      repProfileId: profile.repProfileId,
      googlePlaceId: record.googlePlaceId,
      name: record.businessName,
      address: record.address,
      googleMapsUrl: record.googleMapsUrl
    });
  }
}
const activeRuntimeIds = new Set(activeRouteRecords.map(record => record.id));
assert(activeRouteRecords.length === 600, "Active pool must expand into 600 Dashboard route records.");
assert(activeRuntimeIds.size === activeRouteRecords.length, "Expanded Active route records must have unique runtime IDs.");
assert(activeRouteRecords.every(record => record.id && ["cruz", "anthony"].includes(record.repProfileId) && record.googlePlaceId && record.name && record.address && /^https:\/\/maps\.google\.com\//.test(record.googleMapsUrl)), "Expanded Active route records must contain required Dashboard runtime fields.");

const fullRecords = [...(sourceFull.cruz || []), ...(sourceFull.anthony || [])];
assert(sourceFull.dataset_version === "google-qualified-businesses-v2", "Full runtime dataset version must remain google-qualified-businesses-v2.");
assert(fullRecords.length === 795, "Full runtime dataset fallback must remain 795 route records.");
assert((sourceFull.cruz || []).length === 397, "Full runtime dataset fallback must retain 397 Cruz records.");
assert((sourceFull.anthony || []).length === 398, "Full runtime dataset fallback must retain 398 Anthony records.");

if (failures.length) {
  console.error("Dashboard runtime pool consumption verification failed:");
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log("Dashboard runtime pool consumption verified: Active default, full fallback, deploy assets, CSP, and v1 regression contracts.");
}
