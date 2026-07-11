import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  createEmptyRouteQueue,
  maintainRouteQueue,
  routeQueueIdentity
} from "../../intelligence/continuous-adaptive-route-replenishment.mjs";
import {
  applyHoursEligibilityToScore,
  buildRouteBusinessHoursIndex,
  evaluateRouteBusinessHoursEligibility,
  hoursNotVerifiedMarker,
  routeBusinessHoursEligibilityVersion
} from "../../intelligence/route-business-hours-eligibility.mjs";
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
  qualityReport: "data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/route-intelligence-golden-route-quality-report.json",
  businessHoursArtifact: "data/qualified-prospects/google-qualified-businesses-v2/business-hours-v1/business-hours.json",
  businessHoursDataContract: "overwatch/artifact-contracts/data/fitness-connection-business-hours-data-contract-v1.json",
  businessHoursIntelligenceContract: "intelligence/contracts/route-business-hours-eligibility-contracts.json",
  fitnessIntelligenceConsumerContract: "overwatch/artifact-contracts/workspaces/fitness-connection/intelligence-consumer-contract-v1.json",
  canonicalArtifactRegistry: "overwatch/artifact-contracts/canonical-artifact-registry.json"
};

const expectedRuntimeFileCount = 32;
const expectedDashboardFetchCount = 6;
const christianBrothersPlaceId = "ChIJiduac7LCQIYR-sGBtIAjKR0";

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
  const stdout = String(result.stdout || "").trim();
  let evidence = null;
  try {
    evidence = stdout ? JSON.parse(stdout) : null;
  } catch {
    evidence = null;
  }
  return {
    status: result.status === 0 ? "passed" : "failed",
    exitCode: result.status,
    stdout,
    stderr: String(result.stderr || "").trim(),
    evidence
  };
}

function runtimeSurfaceEvidence(zeroLiveGoogle) {
  if (zeroLiveGoogle.status === "skipped") {
    return {
      status: "skipped",
      reason: zeroLiveGoogle.reason,
      expectedRuntimeFiles: expectedRuntimeFileCount,
      expectedDashboardFetches: expectedDashboardFetchCount
    };
  }
  const evidence = zeroLiveGoogle.evidence || {};
  const primitives = evidence.generic_network_primitives || [];
  const fetchCount = path => primitives.find(item => item.file === path && item.pattern === "Client fetch")?.count ?? null;
  const sourceDashboardFetches = fetchCount("index.html");
  const deployDashboardFetches = fetchCount("deploy/cloudflare-pages/index.html");
  const passed = evidence.checked_files === expectedRuntimeFileCount
    && sourceDashboardFetches === expectedDashboardFetchCount
    && deployDashboardFetches === expectedDashboardFetchCount;
  return {
    status: passed ? "passed" : "failed",
    checkedRuntimeFiles: evidence.checked_files ?? null,
    expectedRuntimeFiles: expectedRuntimeFileCount,
    dashboardFetches: sourceDashboardFetches,
    deployDashboardFetches,
    expectedDashboardFetches: expectedDashboardFetchCount,
    sourceDeployFetchParity: sourceDashboardFetches === deployDashboardFetches,
    liveGoogleApiCalls: evidence.live_google_api_calls ?? null
  };
}

function gitCommand(root, args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  return {
    ok: result.status === 0,
    value: String(result.stdout || "").trim(),
    error: String(result.stderr || "").trim()
  };
}

function repositoryEvidence(root, expectedLocalCommitCount) {
  const divergence = gitCommand(root, ["rev-list", "--left-right", "--count", "origin/main...HEAD"]);
  const branch = gitCommand(root, ["branch", "--show-current"]);
  const baseCommit = gitCommand(root, ["rev-parse", "origin/main"]);
  const subjects = gitCommand(root, ["log", "--reverse", "--format=%s", "origin/main..HEAD"]);
  if (!divergence.ok || !branch.ok || !baseCommit.ok || !subjects.ok) {
    return {
      status: expectedLocalCommitCount === undefined ? "unavailable" : "failed",
      baseRef: "origin/main",
      expectedLocalCommitCount: expectedLocalCommitCount ?? null,
      error: [divergence.error, branch.error, baseCommit.error, subjects.error].filter(Boolean).join(" | ")
    };
  }
  const [behind, ahead] = divergence.value.split(/\s+/).map(Number);
  const localCommitSubjects = subjects.value ? subjects.value.split("\n") : [];
  const matchesExpected = expectedLocalCommitCount === undefined || ahead === expectedLocalCommitCount;
  return {
    status: expectedLocalCommitCount === undefined ? "observed" : matchesExpected ? "passed" : "failed",
    branch: branch.value,
    baseRef: "origin/main",
    baseCommit: baseCommit.value,
    ahead,
    behind,
    expectedLocalCommitCount: expectedLocalCommitCount ?? null,
    localCommitSubjects
  };
}

function hoursDecisionEvidence(decision) {
  return {
    status: decision?.status || null,
    eligible: decision?.eligible === true,
    coverageOnly: decision?.coverageOnly === true,
    selectionTier: decision?.selectionTier ?? null,
    internalMarker: decision?.internalMarker ?? null,
    reasonCode: decision?.reasonCode || null,
    reason: decision?.reason || null,
    displayLabel: decision?.displayLabel || null
  };
}

export function buildBusinessHoursQualityEvidence({
  activePool,
  reservePool,
  businessHoursArtifact,
  dataContract,
  consumerContract,
  fitnessIntelligenceContract,
  artifactRegistry
}) {
  const failures = [];
  const check = (condition, reason) => {
    if (!condition) failures.push(reason);
  };
  const fitnessWorkspace = artifactRegistry.workspaces?.find(workspace => workspace.workspaceId === "fitness_connection");
  const registrations = Object.fromEntries((fitnessWorkspace?.canonicalArtifacts || []).map(artifact => [artifact.artifactId, artifact]));
  const consumerRegistration = registrations.fitness_connection_route_business_hours_intelligence_consumer_contract;
  const dataRegistration = registrations.fitness_connection_business_hours_data_contract;
  const requiredReadPaths = [
    defaultPaths.businessHoursIntelligenceContract,
    defaultPaths.businessHoursDataContract,
    defaultPaths.businessHoursArtifact
  ];
  const allowedReadPaths = fitnessWorkspace?.consumerContracts?.intelligence?.allowedReadPaths || [];
  const canonicalIdentifier = consumerContract.version;

  check(Boolean(consumerRegistration), "business_hours_consumer_not_registered");
  check(canonicalIdentifier === "route-iq-closed-now-eligibility-contracts-v1", "business_hours_consumer_identifier_not_canonical");
  check(consumerRegistration?.path === defaultPaths.businessHoursIntelligenceContract, "business_hours_consumer_canonical_path_mismatch");
  check(consumerRegistration?.canonicalIdentifier === canonicalIdentifier, "business_hours_consumer_identifier_unresolved");
  check(consumerRegistration?.linkedDataContractId === dataContract.contractId, "business_hours_consumer_data_contract_unlinked");
  check(dataRegistration?.path === defaultPaths.businessHoursDataContract, "business_hours_data_contract_canonical_path_mismatch");
  check(dataContract.authorizationMetadata?.authorizedConsumerContractId === canonicalIdentifier, "business_hours_data_authorization_identifier_mismatch");
  check(dataContract.authorizationMetadata?.authorizedConsumerContractPath === defaultPaths.businessHoursIntelligenceContract, "business_hours_data_authorization_path_mismatch");
  check(consumerContract.dataContract?.contractId === dataContract.contractId, "business_hours_contract_link_mismatch");
  check(consumerContract.dataContract?.artifact === defaultPaths.businessHoursArtifact, "business_hours_dataset_path_mismatch");
  check(fitnessIntelligenceContract.businessHoursAccessRules?.accessMode === "read_only", "business_hours_access_not_read_only");
  check(fitnessIntelligenceContract.businessHoursAccessRules?.dataMutationAllowed === false, "business_hours_data_mutation_authorized");
  check(fitnessIntelligenceContract.interpretationRules?.canMutateData === false, "fitness_intelligence_data_mutation_authorized");
  check(fitnessIntelligenceContract.workspaceId === "fitness_connection", "fitness_intelligence_workspace_mismatch");
  check(fitnessIntelligenceContract.operatingProfileId === "fitness", "fitness_intelligence_operating_profile_mismatch");
  check(fitnessIntelligenceContract.workspaceIsolationRules?.smoothieDepotCandidateDataAllowed === false, "smoothie_depot_business_hours_access_allowed");
  check(fitnessIntelligenceContract.businessHoursAccessRules?.unknownWorkspaceFailsClosed === true, "unknown_business_hours_workspace_not_fail_closed");
  check(fitnessIntelligenceContract.businessHoursAccessRules?.unknownConsumerFailsClosed === true, "unknown_business_hours_consumer_not_fail_closed");
  for (const path of requiredReadPaths) check(allowedReadPaths.includes(path), `fitness_intelligence_read_path_missing:${path}`);

  const hoursIndex = buildRouteBusinessHoursIndex(businessHoursArtifact);
  const evaluatedAt = businessHoursArtifact.statusEvaluatedAt;
  const routeDate = String(evaluatedAt).slice(0, 10);
  const decisionForRecord = (record, candidate = null) => evaluateRouteBusinessHoursEligibility({
    record,
    candidate,
    evaluatedAt,
    policy: hoursIndex.freshnessPolicy
  });
  const sourceStatusCounts = businessHoursArtifact.records.reduce((counts, record) => {
    counts[record.currentOpenClosedEligibilityStatus] = (counts[record.currentOpenClosedEligibilityStatus] || 0) + 1;
    return counts;
  }, {});
  const activeOpenRecord = businessHoursArtifact.records.find(record => record.activePoolMember && decisionForRecord(record).status === "OPEN_VERIFIED");
  const activeUnknownRecord = businessHoursArtifact.records.find(record => record.activePoolMember && decisionForRecord(record).status === "HOURS_UNKNOWN");
  const christianRecord = hoursIndex.recordsByPlaceId.get(christianBrothersPlaceId);
  const christianDecision = decisionForRecord(christianRecord);
  const staleDecision = decisionForRecord({ ...activeOpenRecord, hoursVerifiedAt: "2026-06-01T00:00:00.000Z" });
  const specialDecision = decisionForRecord({
    ...activeOpenRecord,
    specialOrHolidayHours: [{
      date: routeDate,
      verificationStatus: "UNVERIFIED",
      periods: null,
      source: "GOOGLE_PLACES_CURRENT_OPENING_HOURS"
    }]
  });
  const openDecision = decisionForRecord(activeOpenRecord);
  const unknownDecision = decisionForRecord(activeUnknownRecord);

  check(businessHoursArtifact.recordCount === 398 && businessHoursArtifact.records.length === 398, "business_hours_record_count_not_398");
  check(openDecision.status === "OPEN_VERIFIED" && openDecision.eligible && openDecision.selectionTier === 0, "open_verified_policy_regressed");
  check(christianRecord?.permanentOperationalStatus === "OPERATIONAL", "christian_brothers_permanent_status_regressed");
  check(christianDecision.status === "CLOSED_VERIFIED" && !christianDecision.eligible, "closed_verified_policy_regressed");
  for (const [status, decision] of [["HOURS_UNKNOWN", unknownDecision], ["HOURS_STALE", staleDecision], ["SPECIAL_HOURS_UNVERIFIED", specialDecision]]) {
    check(
      decision.status === status && decision.eligible && decision.coverageOnly && decision.selectionTier === 1 && decision.internalMarker === hoursNotVerifiedMarker,
      `${status.toLowerCase()}_policy_regressed`
    );
  }

  const candidateFromPoolRecord = (record, index, sourcePool) => {
    const profile = record.runtimeProfiles?.find(item => item.repProfileId === "cruz") || record.runtimeProfiles?.[0];
    return {
      id: String(profile?.runtimeId || `${sourcePool}-${index}-${record.googlePlaceId}`).slice(0, 128),
      googlePlaceId: record.googlePlaceId,
      name: record.businessName,
      address: record.address,
      category: record.category,
      workspaceId: "fitness_connection",
      operatingProfileId: "fitness",
      businessStatus: record.businessStatus || record.permanentOperationalStatus || "OPERATIONAL",
      baseScore: Number(profile?.qualityScore ?? record.qualityScore ?? record.priority ?? 0),
      hoursRecord: hoursIndex.recordsByPlaceId.get(record.googlePlaceId) || null
    };
  };
  const activeCandidates = (activePool.records || []).map((record, index) => candidateFromPoolRecord(record, index, "active"));
  const reserveCandidates = (reservePool.records || []).map((record, index) => candidateFromPoolRecord(record, index, "full"));
  const eligibilityForCandidate = candidate => decisionForRecord(candidate.hoursRecord, candidate);
  const scoreCandidate = candidate => applyHoursEligibilityToScore(
    { score: candidate.baseScore, signals: ["existing route score"] },
    eligibilityForCandidate(candidate)
  );
  const isEligible = candidate => eligibilityForCandidate(candidate).eligible;
  const queueContext = {
    workspaceId: "fitness_connection",
    representativeId: "route-quality-gate",
    operatingProfileId: "fitness",
    routeDate
  };
  const initialQueue = createEmptyRouteQueue({ ...queueContext, targetSize: 15, threshold: 5 });
  const initial = maintainRouteQueue({
    queue: initialQueue,
    ...queueContext,
    primaryCandidates: activeCandidates,
    force: true,
    trigger: "route-quality-initial-generation",
    identityOf: routeQueueIdentity,
    isEligible,
    scoreCandidate,
    now: evaluatedAt
  });
  const christianIdentity = routeQueueIdentity({ googlePlaceId: christianBrothersPlaceId });
  const candidateByIdentity = new Map(activeCandidates.map(candidate => [routeQueueIdentity(candidate), candidate]));
  const initialIdentityKeys = initial.queue.entries.map(entry => entry.identityKey);
  const initialScoresUnchanged = initial.queue.entries.every(entry => candidateByIdentity.get(entry.identityKey)?.baseScore === entry.scoreSnapshot);
  const initialExplanationsAvailable = initial.queue.entries.every(entry => entry.eligibilitySnapshot?.reasonCode && entry.eligibilitySnapshot?.reason && entry.eligibilitySnapshot?.provenance);

  check(initial.queue.entries.length === 15, "initial_route_did_not_reach_15_stops");
  check(initial.queue.threshold === 5, "route_replenishment_threshold_not_5");
  check(initial.queue.entries.every(entry => entry.sourcePool === "active"), "initial_route_did_not_preserve_active_pool_priority");
  check(initial.queue.entries.every(entry => entry.eligibilitySnapshot?.status === "OPEN_VERIFIED"), "initial_route_used_non_open_candidate_with_open_coverage_available");
  check(!initialIdentityKeys.includes(christianIdentity), "christian_brothers_entered_initial_route");
  check(new Set(initialIdentityKeys).size === initialIdentityKeys.length, "initial_route_contains_duplicates");
  check(initialScoresUnchanged, "business_hours_changed_initial_route_score");
  check(initialExplanationsAvailable, "initial_route_hours_explanation_missing");

  const completedIdentityKeys = initial.queue.entries.slice(0, 11).map(entry => entry.identityKey);
  const replenished = maintainRouteQueue({
    queue: initial.queue,
    ...queueContext,
    primaryCandidates: activeCandidates,
    completedIdentityKeys,
    force: false,
    trigger: "route-quality-low-water-replenishment",
    identityOf: routeQueueIdentity,
    isEligible,
    scoreCandidate,
    now: evaluatedAt
  });
  const replenishedIdentityKeys = replenished.queue.entries.map(entry => entry.identityKey);
  const replenishedScoresUnchanged = replenished.queue.entries.every(
    entry => candidateByIdentity.get(entry.identityKey)?.baseScore === entry.scoreSnapshot
      && entry.eligibilitySnapshot?.scoringChanged === false
  );
  check(replenished.belowThreshold && replenished.triggered, "adaptive_replenishment_did_not_trigger_below_5");
  check(replenished.queue.entries.length === 15, "adaptive_replenishment_did_not_return_to_15");
  check(completedIdentityKeys.every(identity => !replenishedIdentityKeys.includes(identity)), "completed_stop_reentered_replenished_route");
  check(!replenishedIdentityKeys.includes(christianIdentity), "christian_brothers_entered_replenished_route");
  check(new Set(replenishedIdentityKeys).size === replenishedIdentityKeys.length, "replenished_route_contains_duplicates");
  check(replenishedScoresUnchanged, "business_hours_changed_replenishment_score");

  const fallbackActiveOpen = activeCandidates.find(candidate => eligibilityForCandidate(candidate).status === "OPEN_VERIFIED");
  const fallbackActiveUnknown = activeCandidates.find(candidate => eligibilityForCandidate(candidate).status === "HOURS_UNKNOWN");
  const fallbackFullOpen = reserveCandidates.find(candidate => eligibilityForCandidate(candidate).status === "OPEN_VERIFIED");
  const fallback = fallbackActiveOpen && fallbackActiveUnknown && fallbackFullOpen
    ? maintainRouteQueue({
      queue: createEmptyRouteQueue({ ...queueContext, targetSize: 3, threshold: 1 }),
      ...queueContext,
      primaryCandidates: [fallbackActiveUnknown, fallbackActiveOpen],
      fallbackCandidates: [fallbackFullOpen],
      force: true,
      trigger: "route-quality-full-pool-fallback",
      identityOf: routeQueueIdentity,
      isEligible,
      scoreCandidate,
      now: evaluatedAt
    })
    : null;
  const fallbackSourceOrder = fallback?.queue.entries.map(entry => entry.sourcePool) || [];
  const fallbackStatusOrder = fallback?.queue.entries.map(entry => entry.eligibilitySnapshot?.status) || [];
  check(fallback?.usedFallback === true, "full_pool_fallback_not_exercised");
  check(JSON.stringify(fallbackSourceOrder) === JSON.stringify(["active", "full", "active"]), "active_and_full_pool_fallback_order_regressed");
  check(JSON.stringify(fallbackStatusOrder) === JSON.stringify(["OPEN_VERIFIED", "OPEN_VERIFIED", "HOURS_UNKNOWN"]), "verified_open_fallback_preference_regressed");

  const explanationFields = consumerContract.explainability?.requiredFields || [];
  const missingExplanationFields = explanationFields.filter(field => !Object.prototype.hasOwnProperty.call(christianDecision, field));
  check(missingExplanationFields.length === 0, "business_hours_explainability_fields_missing");
  check(christianDecision.reasonCode === "VERIFIED_CURRENT_WINDOW_CLOSED", "christian_brothers_exclusion_reason_not_attributable");
  check(christianDecision.provenance?.fieldEvidenceIds?.includes("fitness-2026-07-11-christian-brothers-closed-observation"), "christian_brothers_field_evidence_missing");
  check(consumerContract.safety?.scoringWeightsChanged === false, "business_hours_contract_changed_scoring_weights");
  check(dataContract.intelligenceHandoffPolicy?.intelligenceMayMutateDataArtifact === false, "business_hours_data_mutation_boundary_regressed");

  const canonicalConsumerPassed = Boolean(consumerRegistration)
    && canonicalIdentifier === "route-iq-closed-now-eligibility-contracts-v1"
    && consumerRegistration.path === defaultPaths.businessHoursIntelligenceContract
    && consumerRegistration.canonicalIdentifier === canonicalIdentifier
    && consumerRegistration.linkedDataContractId === dataContract.contractId
    && dataRegistration?.path === defaultPaths.businessHoursDataContract
    && requiredReadPaths.every(path => allowedReadPaths.includes(path))
    && fitnessIntelligenceContract.businessHoursAccessRules?.accessMode === "read_only"
    && fitnessIntelligenceContract.businessHoursAccessRules?.dataMutationAllowed === false
    && fitnessIntelligenceContract.workspaceIsolationRules?.smoothieDepotCandidateDataAllowed === false
    && fitnessIntelligenceContract.businessHoursAccessRules?.unknownWorkspaceFailsClosed === true
    && fitnessIntelligenceContract.businessHoursAccessRules?.unknownConsumerFailsClosed === true;

  return {
    status: failures.length ? "failed" : "passed",
    implementation: {
      eligibilityVersion: routeBusinessHoursEligibilityVersion,
      consumerContractVersion: canonicalIdentifier,
      sourceDatasetVersion: businessHoursArtifact.sourceDatasetVersion,
      recordCount: businessHoursArtifact.recordCount,
      statusEvaluatedAt: evaluatedAt,
      scoringWeightsChanged: consumerContract.safety?.scoringWeightsChanged,
      liveGoogleCalls: consumerContract.safety?.liveGoogleCalls
    },
    canonicalConsumer: {
      status: canonicalConsumerPassed ? "passed" : "failed",
      artifactId: consumerRegistration?.artifactId || null,
      registered: Boolean(consumerRegistration),
      canonicalIdentifier,
      identifierResolved: consumerRegistration?.canonicalIdentifier === canonicalIdentifier,
      consumerContractPath: consumerRegistration?.path || null,
      dataContractPath: dataRegistration?.path || null,
      datasetPath: dataContract.canonicalArtifacts?.businessHoursArtifact || null,
      requiredReadPaths,
      requiredReadPathsPresent: requiredReadPaths.every(path => allowedReadPaths.includes(path)),
      accessMode: fitnessIntelligenceContract.businessHoursAccessRules?.accessMode || null,
      dataMutationAllowed: fitnessIntelligenceContract.businessHoursAccessRules?.dataMutationAllowed ?? null,
      workspaceId: fitnessIntelligenceContract.workspaceId,
      operatingProfileId: fitnessIntelligenceContract.operatingProfileId,
      smoothieDepotAccessAllowed: fitnessIntelligenceContract.workspaceIsolationRules?.smoothieDepotCandidateDataAllowed,
      unknownWorkspaceFailsClosed: fitnessIntelligenceContract.businessHoursAccessRules?.unknownWorkspaceFailsClosed,
      unknownConsumerFailsClosed: fitnessIntelligenceContract.businessHoursAccessRules?.unknownConsumerFailsClosed
    },
    statusPolicies: {
      sourceStatusCounts,
      OPEN_VERIFIED: hoursDecisionEvidence(openDecision),
      CLOSED_VERIFIED: hoursDecisionEvidence(christianDecision),
      HOURS_UNKNOWN: hoursDecisionEvidence(unknownDecision),
      HOURS_STALE: hoursDecisionEvidence(staleDecision),
      SPECIAL_HOURS_UNVERIFIED: hoursDecisionEvidence(specialDecision)
    },
    christianBrothersRegression: {
      status: christianRecord?.permanentOperationalStatus === "OPERATIONAL"
        && christianDecision.status === "CLOSED_VERIFIED"
        && !initialIdentityKeys.includes(christianIdentity)
        && !replenishedIdentityKeys.includes(christianIdentity)
        ? "passed"
        : "failed",
      googlePlaceId: christianBrothersPlaceId,
      businessName: christianRecord?.businessName || null,
      permanentOperationalStatus: christianRecord?.permanentOperationalStatus || null,
      eligibilityStatus: christianDecision.status,
      eligible: christianDecision.eligible,
      initialRouteExcluded: !initialIdentityKeys.includes(christianIdentity),
      replenishmentExcluded: !replenishedIdentityKeys.includes(christianIdentity),
      exclusionReasonCode: christianDecision.reasonCode,
      exclusionReason: christianDecision.reason,
      fieldEvidenceIds: christianDecision.provenance?.fieldEvidenceIds || []
    },
    queueValidation: {
      status: failures.some(reason => reason.includes("route") || reason.includes("replenishment") || reason.includes("fallback") || reason.includes("stop")) ? "failed" : "passed",
      targetSize: 15,
      replenishmentThreshold: 5,
      initialStopCount: initial.queue.entries.length,
      initialActivePoolOnly: initial.queue.entries.every(entry => entry.sourcePool === "active"),
      initialVerifiedOpenOnly: initial.queue.entries.every(entry => entry.eligibilitySnapshot?.status === "OPEN_VERIFIED"),
      initialDuplicateCount: initialIdentityKeys.length - new Set(initialIdentityKeys).size,
      completedStopsSimulated: completedIdentityKeys.length,
      replenishmentTriggeredBelowThreshold: replenished.belowThreshold && replenished.triggered,
      replenishedStopCount: replenished.queue.entries.length,
      replenishmentAppended: replenished.appended.length,
      completedStopExclusionPreserved: completedIdentityKeys.every(identity => !replenishedIdentityKeys.includes(identity)),
      replenishedDuplicateCount: replenishedIdentityKeys.length - new Set(replenishedIdentityKeys).size,
      fullPoolFallbackExercised: fallback?.usedFallback === true,
      fullPoolFallbackSourceOrder: fallbackSourceOrder,
      fullPoolFallbackStatusOrder: fallbackStatusOrder,
      routeScoresUnchanged: initialScoresUnchanged && replenishedScoresUnchanged
    },
    explainability: {
      status: missingExplanationFields.length || !initialExplanationsAvailable ? "failed" : "passed",
      requiredFields: explanationFields,
      missingFields: missingExplanationFields,
      initialQueueExplanationsAvailable: initialExplanationsAvailable,
      closedExclusionAttributable: christianDecision.reasonCode === "VERIFIED_CURRENT_WINDOW_CLOSED",
      provenanceAvailable: Boolean(christianDecision.provenance?.sourcePlaceId)
    },
    failureReasons: failures
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
  const businessHoursArtifact = options.businessHoursArtifact || readJson(root, paths.businessHoursArtifact);
  const businessHoursDataContract = options.businessHoursDataContract || readJson(root, paths.businessHoursDataContract);
  const businessHoursIntelligenceContract = options.businessHoursIntelligenceContract || readJson(root, paths.businessHoursIntelligenceContract);
  const fitnessIntelligenceConsumerContract = options.fitnessIntelligenceConsumerContract || readJson(root, paths.fitnessIntelligenceConsumerContract);
  const canonicalArtifactRegistry = options.canonicalArtifactRegistry || readJson(root, paths.canonicalArtifactRegistry);
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

  const businessHoursEligibility = buildBusinessHoursQualityEvidence({
    activePool,
    reservePool,
    businessHoursArtifact,
    dataContract: businessHoursDataContract,
    consumerContract: businessHoursIntelligenceContract,
    fitnessIntelligenceContract: fitnessIntelligenceConsumerContract,
    artifactRegistry: canonicalArtifactRegistry
  });
  failures.push(...businessHoursEligibility.failureReasons.map(reason => `business_hours:${reason}`));

  const zeroLiveGoogle = options.runZeroGoogleCheck === false
    ? { status: "skipped", reason: "disabled_by_caller" }
    : runZeroGoogleCheck(root);
  if (zeroLiveGoogle.status === "failed") failures.push("zero_live_google_check_failed");
  const runtimeSurface = runtimeSurfaceEvidence(zeroLiveGoogle);
  if (runtimeSurface.status === "failed") failures.push("runtime_surface_evidence_mismatch");

  const repositoryState = repositoryEvidence(root, options.expectedLocalCommitCount);
  if (repositoryState.status === "failed") failures.push("local_commit_chain_mismatch");

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
      scoringChanged: activePool.scoringChanged,
      activePoolGovernancePreserved: businessHoursIntelligenceContract.safety?.activePoolGovernancePreserved === true,
      fullPoolFallbackGovernancePreserved: businessHoursIntelligenceContract.safety?.fullPoolFallbackGovernancePreserved === true
    },
    businessHoursEligibility,
    zeroLiveGoogle,
    runtimeSurface,
    repositoryState,
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
