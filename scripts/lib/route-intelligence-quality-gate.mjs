import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { genericNamePattern, numberedAddress, safeMapsPattern } from "../segment-google-runtime-pools.mjs";

export const gateVersion = "route-intelligence-golden-route-quality-gate-v1";

const moduleDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(moduleDir, "../..");

export const defaultPaths = {
  activePool: "data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/active-pool.json",
  reservePool: "data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/reserve-pool.json",
  quarantinePool: "data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/quarantine-pool.json",
  governanceReport: "data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/governance-report.json",
  promotionGate: "data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/promotion-gate.json",
  goldenBaseline: "data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/route-intelligence-golden-route-baseline.json",
  qualityReport: "data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/route-intelligence-golden-route-quality-report.json"
};

const dashboardCategories = new Set([
  "Apartment", "Auto", "Tire", "Oil Change", "Car Wash", "Warehouse", "Restaurant", "Retail", "Small Retail",
  "Office", "School", "Barber", "Salon", "Clinic", "Medical Office", "Dental Office", "College", "Community",
  "Transit", "Employer", "Business", "Business Services", "Hotel", "Event", "Other"
]);

const visitWindows = new Set(["Morning", "Midday", "Evening", "Anytime", "Afternoon"]);
const activeQualityClasses = new Set(["Excellent", "Good"]);

const routeProfiles = {
  cruz: {
    label: "Founder Discovery",
    maxRadiusMiles: 15,
    preferredCategories: ["Auto", "Car Wash", "Restaurant", "Business", "Retail", "Other"],
    secondaryCategories: ["Barber", "Salon", "Small Retail"]
  },
  anthony: {
    label: "Anthony First Route",
    maxRadiusMiles: 25,
    preferredCategories: ["Barber", "Salon", "Restaurant", "Retail", "Small Retail"],
    secondaryCategories: ["Car Wash", "Auto", "Business", "Other"]
  }
};

function readJson(root, relativePath) {
  return JSON.parse(readFileSync(resolve(root, relativePath), "utf8"));
}

function writeJson(root, relativePath, payload) {
  writeFileSync(resolve(root, relativePath), JSON.stringify(payload, null, 2) + "\n");
}

function stableHash(value) {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

function categoryForDashboard(category) {
  if (dashboardCategories.has(category)) return category;
  if (category === "Other Storefront") return "Other";
  return "Other";
}

function distanceLabel(value) {
  const distance = Number(value);
  return Number.isFinite(distance) ? `${distance.toFixed(1)} mi` : "";
}

function distanceMiles(place) {
  const value = Number(place.estimatedDistanceMiles ?? String(place.distance || "").match(/\d+(?:\.\d+)?/)?.[0]);
  return Number.isFinite(value) ? value : Infinity;
}

function routeIdentity(place) {
  return place?.googlePlaceId || `${place?.name || ""}|${place?.address || ""}`;
}

function qualityExplanation(record, profile, profileConfig) {
  const distance = distanceLabel(record.estimatedDistanceMiles) || "unknown distance";
  return [
    `${record.businessName} is an Active Pool ${record.category} candidate for ${profileConfig.label}.`,
    `It is ${distance} from base, has ${record.accessType || "unknown"} access, and asks for ${record.askFor || "manager"}.`,
    `Runtime quality is ${profile.qualityClass || record.qualityClass} with score ${Number(profile.qualityScore ?? record.qualityScore ?? 0).toFixed(1)}.`
  ].join(" ");
}

export function expandActivePool(activePool) {
  const routeRecords = [];
  const skipped = [];
  for (const record of activePool.records || []) {
    const profiles = Array.isArray(record.runtimeProfiles) ? record.runtimeProfiles : [];
    if (!profiles.length) {
      skipped.push({ googlePlaceId: record.googlePlaceId || "", reason: "missing_runtime_profiles" });
      continue;
    }
    for (const profile of profiles) {
      if (!profile?.runtimeId || !profile?.repProfileId) {
        skipped.push({ googlePlaceId: record.googlePlaceId || "", reason: "incomplete_runtime_profile" });
        continue;
      }
      const profileConfig = routeProfiles[profile.repProfileId] || routeProfiles.cruz;
      routeRecords.push({
        id: String(profile.runtimeId),
        repProfileId: String(profile.repProfileId),
        seedRouteOrder: Number(profile.seedRouteOrder || 9999),
        name: String(record.businessName || ""),
        category: categoryForDashboard(record.category),
        sourceCategory: String(record.category || ""),
        window: visitWindows.has(record.window) ? record.window : "Midday",
        distance: distanceLabel(record.estimatedDistanceMiles),
        estimatedDistanceMiles: Number(record.estimatedDistanceMiles),
        priority: Number(profile.priority ?? record.priority ?? 0),
        address: String(record.address || ""),
        latitude: Number(record.latitude),
        longitude: Number(record.longitude),
        permission: record.permission || "Unknown",
        accessType: String(record.accessType || ""),
        askFor: String(record.askFor || ""),
        googlePlaceId: String(record.googlePlaceId || ""),
        googleMapsUrl: String(record.googleMapsUrl || ""),
        sourceType: String(record.sourceType || ""),
        qualityClass: String(profile.qualityClass || record.qualityClass || ""),
        qualityScore: Number(profile.qualityScore ?? record.qualityScore ?? 0),
        qualityReason: qualityExplanation(record, profile, profileConfig),
        truthBasis: "Verified by Active Pool governance. Route quality remains an Intelligence Engine inference until field validation.",
        poolAssignmentReasons: record.poolAssignmentReasons || [],
        activePoolRecord: record
      });
    }
  }
  return { routeRecords, skipped };
}

function laneRank(place, profileId) {
  const profile = routeProfiles[profileId] || routeProfiles.cruz;
  if (profile.preferredCategories.includes(place.category) || profile.preferredCategories.includes(place.sourceCategory)) return 0;
  if (profile.secondaryCategories.includes(place.category) || profile.secondaryCategories.includes(place.sourceCategory)) return 1;
  return 2;
}

function routeComparator(profileId) {
  return (left, right) => {
    const laneDelta = laneRank(left, profileId) - laneRank(right, profileId);
    if (laneDelta) return laneDelta;
    const ringDelta = Math.ceil(distanceMiles(left) / 5) - Math.ceil(distanceMiles(right) / 5);
    if (ringDelta) return ringDelta;
    const qualityDelta = Number(right.qualityScore || 0) - Number(left.qualityScore || 0);
    if (qualityDelta) return qualityDelta;
    const priorityDelta = Number(right.priority || 0) - Number(left.priority || 0);
    if (priorityDelta) return priorityDelta;
    const orderDelta = Number(left.seedRouteOrder || 9999) - Number(right.seedRouteOrder || 9999);
    if (orderDelta) return orderDelta;
    return left.id.localeCompare(right.id);
  };
}

export function generateGoldenRoute(routeRecords, profileId, options = {}) {
  const limit = options.limit || 6;
  const profile = routeProfiles[profileId] || routeProfiles.cruz;
  const candidates = routeRecords
    .filter(place => place.repProfileId === profileId)
    .filter(place => activeQualityClasses.has(place.qualityClass))
    .filter(place => place.sourceType === "Google Places API")
    .filter(place => place.accessType === "Walk-in ready")
    .filter(place => distanceMiles(place) <= profile.maxRadiusMiles)
    .sort(routeComparator(profileId));

  const selected = [];
  const categoryCounts = new Map();
  const seen = new Set();

  for (const place of candidates) {
    if (selected.length >= limit) break;
    const identity = routeIdentity(place);
    if (!identity || seen.has(identity)) continue;
    const categoryCount = categoryCounts.get(place.category) || 0;
    if (categoryCount >= 1 && selected.length < Math.max(4, limit - 1)) continue;
    selected.push(place);
    seen.add(identity);
    categoryCounts.set(place.category, categoryCount + 1);
  }

  for (const place of candidates) {
    if (selected.length >= limit) break;
    const identity = routeIdentity(place);
    if (!identity || seen.has(identity)) continue;
    selected.push(place);
    seen.add(identity);
  }

  return selected.map((place, index) => ({
    rank: index + 1,
    id: place.id,
    googlePlaceId: place.googlePlaceId,
    name: place.name,
    category: place.category,
    sourceCategory: place.sourceCategory,
    distance: place.distance,
    priority: place.priority,
    qualityClass: place.qualityClass,
    qualityScore: place.qualityScore,
    address: place.address,
    latitude: place.latitude,
    longitude: place.longitude,
    googleMapsUrl: place.googleMapsUrl,
    sourceType: place.sourceType,
    accessType: place.accessType,
    askFor: place.askFor,
    reason: place.qualityReason,
    truthBasis: place.truthBasis,
    dashboardFields: {
      id: place.id,
      repProfileId: place.repProfileId,
      name: place.name,
      category: place.category,
      window: place.window,
      distance: place.distance,
      priority: place.priority,
      address: place.address,
      latitude: place.latitude,
      longitude: place.longitude,
      permission: place.permission,
      accessType: place.accessType,
      askFor: place.askFor,
      googlePlaceId: place.googlePlaceId,
      googleMapsUrl: place.googleMapsUrl,
      sourceType: place.sourceType,
      qualityClass: place.qualityClass,
      qualityScore: place.qualityScore,
      qualityReason: place.qualityReason,
      truthBasis: place.truthBasis,
      seedRouteOrder: place.seedRouteOrder
    }
  }));
}

function validateRouteRecord(place, activeIds, quarantineIds) {
  const failures = [];
  if (!activeIds.has(place.googlePlaceId)) failures.push("not_in_active_pool");
  if (quarantineIds.has(place.googlePlaceId)) failures.push("quarantined_candidate_recommended");
  if (!place.id || !place.googlePlaceId || !place.name || !place.address) failures.push("missing_dashboard_identity_fields");
  if (!numberedAddress(place.address)) failures.push("missing_numbered_address");
  if (!safeMapsPattern.test(place.googleMapsUrl)) failures.push("invalid_google_maps_url");
  if (genericNamePattern.test(`${place.name} ${place.address}`)) failures.push("generic_or_restricted_name");
  if (!activeQualityClasses.has(place.qualityClass)) failures.push("non_active_quality_class");
  if (place.sourceType !== "Google Places API") failures.push("not_google_places_source");
  if (!Number.isFinite(place.latitude) || !Number.isFinite(place.longitude)) failures.push("invalid_coordinates");
  if (!place.reason || place.reason.length < 40) failures.push("missing_founder_explanation");
  return failures;
}

function routeMetrics(route) {
  const categories = route.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {});
  return {
    count: route.length,
    distinctCategories: Object.keys(categories).length,
    categories,
    maxDistanceMiles: Math.max(...route.map(item => Number(String(item.distance).match(/\d+(?:\.\d+)?/)?.[0] || 0))),
    averageQualityScore: Number((route.reduce((sum, item) => sum + Number(item.qualityScore || 0), 0) / Math.max(1, route.length)).toFixed(1)),
    fingerprint: stableHash(route.map(item => item.id))
  };
}

function validateGeneratedRoutes(routes, activeIds, quarantineIds) {
  const failures = [];
  const profileReports = {};

  for (const [profileId, route] of Object.entries(routes)) {
    const duplicateIds = route.map(item => item.googlePlaceId).filter((id, index, all) => all.indexOf(id) !== index);
    if (route.length < 6) failures.push(`${profileId}: route_has_fewer_than_6_recommendations`);
    if (duplicateIds.length) failures.push(`${profileId}: duplicate_route_businesses=${duplicateIds.join(",")}`);

    const validationFailures = [];
    for (const item of route) {
      const itemFailures = validateRouteRecord(item, activeIds, quarantineIds);
      if (itemFailures.length) {
        validationFailures.push({ rank: item.rank, id: item.id, googlePlaceId: item.googlePlaceId, failures: itemFailures });
      }
    }
    if (validationFailures.length) failures.push(`${profileId}: invalid_route_candidates=${validationFailures.length}`);

    const metrics = routeMetrics(route);
    if (metrics.distinctCategories < 4) failures.push(`${profileId}: route_category_coverage_below_4`);
    if (metrics.averageQualityScore < 75) failures.push(`${profileId}: average_quality_score_below_75`);

    profileReports[profileId] = {
      metrics,
      route,
      validationFailures
    };
  }

  return { failures, profileReports };
}

function compareBaseline(currentBaseline, expectedBaseline) {
  if (!expectedBaseline) {
    return {
      status: "missing",
      failures: ["missing_golden_route_baseline"],
      details: {}
    };
  }
  const failures = [];
  const details = {};
  for (const profileId of Object.keys(routeProfiles)) {
    const current = currentBaseline.routes[profileId];
    const expected = expectedBaseline.routes?.[profileId];
    if (!expected) {
      failures.push(`${profileId}: missing_profile_baseline`);
      continue;
    }
    const currentIds = current.route.map(item => item.googlePlaceId);
    const expectedIds = expected.route.map(item => item.googlePlaceId);
    const same = stableHash(currentIds) === stableHash(expectedIds);
    details[profileId] = {
      expectedFingerprint: expected.metrics.fingerprint,
      actualFingerprint: current.metrics.fingerprint,
      expectedPlaceIds: expectedIds,
      actualPlaceIds: currentIds,
      stable: same
    };
    if (!same) failures.push(`${profileId}: golden_route_order_or_membership_changed`);
  }
  return {
    status: failures.length ? "failed" : "passed",
    failures,
    details
  };
}

function runZeroGoogleCheck(root) {
  const result = spawnSync("npm", ["run", "verify:zero-google-api", "--silent"], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" }
  });
  return {
    status: result.status === 0 ? "passed" : "failed",
    exitCode: result.status,
    stdout: String(result.stdout || "").trim(),
    stderr: String(result.stderr || "").trim()
  };
}

export function buildCurrentGoldenBaseline(inputs) {
  const { routeRecords } = expandActivePool(inputs.activePool);
  const routes = {};
  for (const profileId of Object.keys(routeProfiles)) {
    const route = generateGoldenRoute(routeRecords, profileId);
    routes[profileId] = {
      metrics: routeMetrics(route),
      route
    };
  }
  return {
    gateVersion,
    sourceDatasetVersion: inputs.activePool.sourceDatasetVersion,
    segmentationVersion: inputs.activePool.segmentationVersion,
    activePoolCount: inputs.activePool.count,
    routes
  };
}

export function runRouteIntelligenceQualityGate(options = {}) {
  const root = options.root || repoRoot;
  const paths = { ...defaultPaths, ...(options.paths || {}) };
  const failures = [];
  const warnings = [];

  const activePool = options.activePool || readJson(root, paths.activePool);
  const reservePool = options.reservePool || readJson(root, paths.reservePool);
  const quarantinePool = options.quarantinePool || readJson(root, paths.quarantinePool);
  const governanceReport = options.governanceReport || readJson(root, paths.governanceReport);
  const promotionGate = options.promotionGate || readJson(root, paths.promotionGate);
  const expectedBaseline = options.expectedBaseline
    || (existsSync(resolve(root, paths.goldenBaseline)) ? readJson(root, paths.goldenBaseline) : null);

  if (activePool.pool !== "active") failures.push("active_pool_payload_not_active");
  if (activePool.runtimeBehaviorChanged !== false) failures.push("active_pool_runtime_behavior_changed");
  if (activePool.scoringChanged !== false) failures.push("active_pool_scoring_changed");
  if (governanceReport.status !== "passed" || governanceReport.promotionAllowed !== true) failures.push("governance_report_not_passed");
  if (promotionGate.status !== "passed" || promotionGate.promotionAllowed !== true) failures.push("promotion_gate_not_passed");

  const activeIds = new Set((activePool.records || []).map(record => record.googlePlaceId).filter(Boolean));
  const reserveIds = new Set((reservePool.records || []).map(record => record.googlePlaceId).filter(Boolean));
  const quarantineIds = new Set((quarantinePool.records || []).map(record => record.googlePlaceId).filter(Boolean));
  const activeQuarantineOverlap = [...activeIds].filter(id => quarantineIds.has(id));
  const activeReserveOverlap = [...activeIds].filter(id => reserveIds.has(id));
  if (activeQuarantineOverlap.length) failures.push(`active_quarantine_overlap=${activeQuarantineOverlap.length}`);
  if (activeReserveOverlap.length) failures.push(`active_reserve_overlap=${activeReserveOverlap.length}`);

  const { routeRecords, skipped } = expandActivePool(activePool);
  if (skipped.length) warnings.push(`skipped_incomplete_runtime_profiles=${skipped.length}`);
  if (!routeRecords.length) failures.push("no_dashboard_compatible_route_records");

  const routes = {};
  const stabilityRuns = [];
  for (let index = 0; index < 3; index += 1) {
    const run = {};
    for (const profileId of Object.keys(routeProfiles)) {
      run[profileId] = generateGoldenRoute(routeRecords, profileId);
    }
    stabilityRuns.push(run);
  }

  for (const profileId of Object.keys(routeProfiles)) {
    routes[profileId] = stabilityRuns[0][profileId];
    const firstHash = stableHash(stabilityRuns[0][profileId].map(item => item.id));
    const unstable = stabilityRuns.some(run => stableHash(run[profileId].map(item => item.id)) !== firstHash);
    if (unstable) failures.push(`${profileId}: unstable_across_identical_inputs`);
  }

  const routeValidation = validateGeneratedRoutes(routes, activeIds, quarantineIds);
  failures.push(...routeValidation.failures);

  const currentBaseline = buildCurrentGoldenBaseline({ activePool });
  const baselineComparison = compareBaseline(currentBaseline, expectedBaseline);
  failures.push(...baselineComparison.failures);

  const zeroLiveGoogle = options.runZeroGoogleCheck === false
    ? { status: "skipped", reason: "disabled_by_caller" }
    : runZeroGoogleCheck(root);
  if (zeroLiveGoogle.status === "failed") failures.push("zero_live_google_check_failed");

  const dashboardCompatibilityFailures = routeRecords.filter(record => {
    return !record.id || !record.repProfileId || !record.name || !record.address || !record.googlePlaceId
      || !record.googleMapsUrl || !record.sourceType || !record.qualityClass || !record.qualityReason;
  });
  if (dashboardCompatibilityFailures.length) failures.push(`dashboard_compatibility_failures=${dashboardCompatibilityFailures.length}`);

  const report = {
    generatedAt: new Date().toISOString(),
    gateVersion,
    status: failures.length ? "failed" : "passed",
    dataset: {
      sourceDatasetVersion: activePool.sourceDatasetVersion,
      segmentationVersion: activePool.segmentationVersion,
      activePoolRecords: activePool.count,
      expandedDashboardRouteRecords: routeRecords.length,
      reserveRecords: reservePool.count,
      quarantineRecords: quarantinePool.count
    },
    routeStability: {
      status: failures.some(failure => failure.includes("unstable_across_identical_inputs")) ? "failed" : "passed",
      runs: stabilityRuns.length
    },
    candidateValidation: {
      status: routeValidation.failures.length || activeQuarantineOverlap.length || activeReserveOverlap.length ? "failed" : "passed",
      activeCandidates: activeIds.size,
      activeReserveOverlap: activeReserveOverlap.length,
      activeQuarantineOverlap: activeQuarantineOverlap.length
    },
    orderingConsistency: baselineComparison,
    coverageMetrics: routeValidation.profileReports,
    governanceReuse: {
      governanceStatus: governanceReport.status,
      promotionGateStatus: promotionGate.status,
      runtimeBehaviorChanged: activePool.runtimeBehaviorChanged,
      scoringChanged: activePool.scoringChanged
    },
    zeroLiveGoogle,
    dashboardCompatibility: {
      status: dashboardCompatibilityFailures.length ? "failed" : "passed",
      checkedRecords: routeRecords.length,
      failures: dashboardCompatibilityFailures.slice(0, 10).map(record => record.id)
    },
    incompleteDataHandling: {
      status: routeRecords.length ? "passed" : "failed",
      skippedRuntimeProfiles: skipped.length,
      skipped: skipped.slice(0, 20)
    },
    warnings,
    failureReasons: failures
  };

  return {
    passed: failures.length === 0,
    report,
    currentBaseline
  };
}

export function updateGoldenBaseline(options = {}) {
  const root = options.root || repoRoot;
  const paths = { ...defaultPaths, ...(options.paths || {}) };
  const activePool = options.activePool || readJson(root, paths.activePool);
  const baseline = buildCurrentGoldenBaseline({ activePool });
  writeJson(root, paths.goldenBaseline, {
    ...baseline,
    generatedAt: new Date().toISOString(),
    purpose: "Reviewed golden Route Intelligence route output. Update only after Intelligence Engine review approves Active Pool route quality changes."
  });
  return baseline;
}

export function writeQualityReport(report, options = {}) {
  const root = options.root || repoRoot;
  const paths = { ...defaultPaths, ...(options.paths || {}) };
  writeJson(root, paths.qualityReport, report);
}
