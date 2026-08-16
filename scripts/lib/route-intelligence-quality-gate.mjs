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
  routeBusinessHoursEligibilityVersion
} from "../../intelligence/route-business-hours-eligibility.mjs";
import {
  createGovernedRouteRuntimeScopeFromConfiguration
} from "../../intelligence/route-iq-governed-runtime-scope.mjs";
import { genericNamePattern, numberedAddress, safeMapsPattern } from "../segment-google-runtime-pools.mjs";

export const gateVersion = "route-intelligence-golden-route-quality-gate-v2";
export const requiredBusinessHoursRuntimeVersion = "route-iq-business-hours-eligibility-v2";
export const requiredBusinessHoursContractVersion = "route-iq-business-hours-eligibility-contracts-v2";

const legacyBusinessHoursRuntimeVersion = "route-iq-closed-now-eligibility-v1";
const legacyBusinessHoursContractVersion = "route-iq-closed-now-eligibility-contracts-v1";

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
  canonicalArtifactRegistry: "overwatch/artifact-contracts/canonical-artifact-registry.json",
  workspaceConfigurationRegistry: "administration/workspace-configurations/route-iq-cross-industry-workspaces-v2.json",
  workspaceBusinessManifestRegistry: "data/route-iq-commercial-readiness-v1/route-iq-workspace-business-artifact-manifest-registry-v1.json"
};

const expectedRuntimeFileCount = 35;
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

function validateGeneratedRoutes(routes, activeIds, quarantineIds, options = {}) {
  const failures = [];
  const profileReports = {};
  const safeEmpty = options.allowSafeEmpty === true
    && Object.values(routes).every(route => route.length === 0);

  for (const [profileId, route] of Object.entries(routes)) {
    const duplicateIds = route.map(item => item.googlePlaceId).filter((id, index, all) => all.indexOf(id) !== index);
    if (!safeEmpty && route.length < 6) failures.push(`${profileId}: route_has_fewer_than_6_recommendations`);
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
    if (!safeEmpty && metrics.distinctCategories < 4) failures.push(`${profileId}: route_category_coverage_below_4`);
    if (!safeEmpty && metrics.averageQualityScore < 75) failures.push(`${profileId}: average_quality_score_below_75`);

    profileReports[profileId] = {
      metrics,
      route,
      validationFailures
    };
  }

  return { failures, profileReports, safeEmpty };
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
    coverageEligible: decision?.coverageEligible === true,
    immediateRecommendationEligible: decision?.immediateRecommendationEligible === true,
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
  artifactRegistry,
  workspaceConfigurationRegistry,
  workspaceBusinessManifestRegistry,
  evaluatedAt = new Date()
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
    defaultPaths.businessHoursArtifact,
    defaultPaths.workspaceBusinessManifestRegistry
  ];
  const allowedReadPaths = Object.values(fitnessIntelligenceContract.canonicalPaths || {});
  const intelligenceSubsystem = "Prometheus Intelligence Engine";
  const dataContractReadAllowed = dataRegistration?.readAllowed?.includes(intelligenceSubsystem) === true;
  const dataContractWriteAllowed = dataRegistration?.writeAllowed?.includes(intelligenceSubsystem) === true;
  const canonicalIdentifier = consumerContract.version;
  const workspaceId = "fitness_connection";
  const operatingProfileId = "fitness";
  const workspaceConfiguration = workspaceConfigurationRegistry?.workspaces?.find(
    workspace => workspace.workspaceId === workspaceId
  );
  const configuredOpportunitySource = workspaceConfiguration?.opportunitySources?.find(
    source => source.workspaceId === workspaceId && source.profileId === operatingProfileId
  );
  const workspaceManifest = workspaceBusinessManifestRegistry?.manifests?.find(
    manifest => manifest.workspaceId === workspaceId && manifest.operatingProfileId === operatingProfileId
  );
  const activeTerritoryId = workspaceConfiguration?.territories?.find(territory => territory.active)?.territoryId || null;

  check(Boolean(consumerRegistration), "business_hours_consumer_not_registered");
  check(routeBusinessHoursEligibilityVersion === requiredBusinessHoursRuntimeVersion, "business_hours_runtime_version_not_v2");
  check(canonicalIdentifier === requiredBusinessHoursContractVersion, "business_hours_consumer_contract_version_not_v2");
  check(consumerContract.runtimeVersion === requiredBusinessHoursRuntimeVersion, "business_hours_consumer_runtime_pin_mismatch");
  check(consumerContract.compatibility?.exactVersionRequired === true, "business_hours_exact_version_not_required");
  check(consumerContract.compatibility?.legacyRuntimeVersionAccepted === false, "business_hours_legacy_runtime_accepted");
  check(consumerContract.compatibility?.legacyContractVersionAccepted === false, "business_hours_legacy_contract_accepted");
  check(consumerContract.compatibility?.supersedesRuntimeVersion === legacyBusinessHoursRuntimeVersion, "business_hours_legacy_runtime_not_superseded");
  check(consumerContract.compatibility?.supersedesContractVersion === legacyBusinessHoursContractVersion, "business_hours_legacy_contract_not_superseded");
  check(consumerRegistration?.path === defaultPaths.businessHoursIntelligenceContract, "business_hours_consumer_canonical_path_mismatch");
  check(dataRegistration?.path === defaultPaths.businessHoursDataContract, "business_hours_data_contract_canonical_path_mismatch");
  check(dataContract.authorizationMetadata?.authorizedConsumerContractId === canonicalIdentifier, "business_hours_data_authorization_identifier_mismatch");
  check(dataContract.authorizationMetadata?.authorizedConsumerContractPath === defaultPaths.businessHoursIntelligenceContract, "business_hours_data_authorization_path_mismatch");
  check(dataContractReadAllowed, "business_hours_consumer_data_contract_unlinked");
  check(!dataContractWriteAllowed, "business_hours_access_not_read_only");
  check(dataContract.canonicalArtifacts?.businessHoursArtifact === defaultPaths.businessHoursArtifact, "business_hours_dataset_path_mismatch");
  check(consumerContract.dataContract?.manifestRegistry === defaultPaths.workspaceBusinessManifestRegistry, "business_hours_manifest_registry_path_mismatch");
  check(consumerContract.dataContract?.manifestVersion === workspaceBusinessManifestRegistry?.schemaVersion, "business_hours_manifest_version_mismatch");
  check(consumerContract.configurationContract?.administrationSchemaVersion === workspaceConfigurationRegistry?.schemaVersion, "business_hours_administration_schema_mismatch");
  check(workspaceConfiguration?.operatingProfile?.profileId === operatingProfileId, "business_hours_administration_profile_mismatch");
  check(configuredOpportunitySource?.manifestRegistryPath === defaultPaths.workspaceBusinessManifestRegistry, "business_hours_administration_manifest_registry_mismatch");
  check(configuredOpportunitySource?.manifestId === workspaceManifest?.manifestId, "business_hours_administration_manifest_id_mismatch");
  check(configuredOpportunitySource?.artifactPath === workspaceManifest?.artifactPath, "business_hours_administration_artifact_path_mismatch");
  check(configuredOpportunitySource?.classification === workspaceManifest?.classification, "business_hours_administration_classification_mismatch");
  check(configuredOpportunitySource?.manifestApprovalState === workspaceManifest?.approvalState, "business_hours_administration_approval_state_mismatch");
  check(workspaceManifest?.manifestVersion === consumerContract.dataContract?.manifestVersion, "business_hours_manifest_contract_version_mismatch");
  check(activePool.workspaceId === workspaceManifest?.workspaceId, "business_hours_active_pool_workspace_mismatch");
  check(activePool.operatingProfileId === workspaceManifest?.operatingProfileId, "business_hours_active_pool_profile_mismatch");
  check(activePool.artifactManifestId === workspaceManifest?.manifestId, "business_hours_active_pool_manifest_id_mismatch");
  check(activePool.artifactManifestVersion === workspaceManifest?.manifestVersion, "business_hours_active_pool_manifest_version_mismatch");
  check(activePool.sourceArtifactSha256 === workspaceManifest?.artifactSha256, "business_hours_active_pool_artifact_hash_mismatch");
  check(activePool.dataClassification === workspaceManifest?.classification, "business_hours_active_pool_classification_mismatch");
  check(activePool.approvalState === workspaceManifest?.approvalState, "business_hours_active_pool_approval_state_mismatch");
  check(dataContract.intelligenceHandoffPolicy?.intelligenceMayMutateDataArtifact === false, "business_hours_data_mutation_authorized");
  check(fitnessIntelligenceContract.safety?.productionScoringMutationAuthorized === false, "fitness_intelligence_data_mutation_authorized");
  check(fitnessIntelligenceContract.workspaceId === "fitness_connection", "fitness_intelligence_workspace_mismatch");
  check(fitnessIntelligenceContract.operatingProfileId === "fitness", "fitness_intelligence_operating_profile_mismatch");
  check(fitnessIntelligenceContract.canonicalPaths?.businessHoursContract === defaultPaths.businessHoursIntelligenceContract, "fitness_intelligence_consumer_contract_path_mismatch");
  check(fitnessIntelligenceContract.canonicalPaths?.businessHours === defaultPaths.businessHoursArtifact, "fitness_intelligence_business_hours_path_mismatch");
  check(fitnessIntelligenceContract.canonicalPaths?.manifestRegistry === defaultPaths.workspaceBusinessManifestRegistry, "fitness_intelligence_manifest_registry_path_mismatch");
  check(fitnessIntelligenceContract.admissionRules?.contractVersion === canonicalIdentifier, "fitness_intelligence_contract_version_mismatch");
  check(fitnessIntelligenceContract.admissionRules?.runtimeVersion === requiredBusinessHoursRuntimeVersion, "fitness_intelligence_runtime_version_mismatch");
  check(fitnessIntelligenceContract.admissionRules?.callerScopeClaimsAccepted === false, "fitness_intelligence_caller_scope_claims_allowed");
  check(fitnessIntelligenceContract.admissionRules?.approvedManifestRosterRequired === true, "fitness_intelligence_approved_manifest_not_required");
  const crossWorkspaceAllowFlags = Object.entries(fitnessIntelligenceContract.isolationRules || {})
    .filter(([key, value]) => key.endsWith("Allowed") && typeof value === "boolean")
    .map(([, value]) => value);
  check(crossWorkspaceAllowFlags.length > 0 && crossWorkspaceAllowFlags.every(value => value === false), "cross_workspace_business_hours_access_allowed");
  check(dataContract.authorizationMetadata?.failClosedBehavior?.unknownWorkspaceFailsClosed === true, "unknown_business_hours_workspace_not_fail_closed");
  check(dataContract.authorizationMetadata?.failClosedBehavior?.unknownConsumerFailsClosed === true, "unknown_business_hours_consumer_not_fail_closed");
  check(fitnessIntelligenceContract.isolationRules?.missingArtifactFailsClosed === true, "fitness_intelligence_missing_artifact_not_fail_closed");
  for (const path of requiredReadPaths) check(allowedReadPaths.includes(path), `fitness_intelligence_read_path_missing:${path}`);

  let governedRuntimeScope = null;
  try {
    governedRuntimeScope = createGovernedRouteRuntimeScopeFromConfiguration({
      workspaceRegistry: workspaceConfigurationRegistry,
      manifestRegistry: workspaceBusinessManifestRegistry,
      workspaceId,
      operatingProfileId,
      sourceArtifactSha256: workspaceManifest?.artifactSha256,
      businessHoursArtifact,
      allowFounderResearch: true
    });
  } catch {
    check(false, "business_hours_governed_runtime_scope_invalid");
  }
  const hoursIndex = buildRouteBusinessHoursIndex(
    businessHoursArtifact,
    governedRuntimeScope ? { governedRuntimeScope, workspaceId, operatingProfileId } : {}
  );
  const evaluationInstant = evaluatedAt instanceof Date ? evaluatedAt : new Date(evaluatedAt);
  check(!Number.isNaN(evaluationInstant.getTime()), "business_hours_authoritative_time_invalid");
  const evaluationIso = evaluationInstant.toISOString();
  const routeDate = evaluationIso.slice(0, 10);
  const decisionForRecord = (record, candidate = null) => evaluateRouteBusinessHoursEligibility({
    record,
    candidate,
    evaluatedAt: evaluationIso,
    policy: hoursIndex.freshnessPolicy,
    workspaceId,
    operatingProfileId,
    territoryId: candidate?.territoryId || activeTerritoryId,
    governedRuntimeScope
  });
  const allDecisions = businessHoursArtifact.records.map(record => decisionForRecord(record));
  const sourceStatusCounts = allDecisions.reduce((counts, decision) => {
    counts[decision.status] = (counts[decision.status] || 0) + 1;
    return counts;
  }, {});
  const christianRecord = hoursIndex.recordsByPlaceId.get(christianBrothersPlaceId);
  const christianDecision = decisionForRecord(christianRecord);

  check(businessHoursArtifact.recordCount === 398 && businessHoursArtifact.records.length === 398, "business_hours_record_count_not_398");
  check(Number(businessHoursArtifact.freshnessPolicy?.freshnessThresholdHours) <= 24, "business_hours_freshness_exceeds_24_hours");
  check(businessHoursArtifact.statusEvaluatedAt !== undefined, "business_hours_source_evaluation_missing");
  check(christianRecord?.permanentOperationalStatus === "OPERATIONAL", "christian_brothers_permanent_status_regressed");

  const candidateFromPoolRecord = (record, index, sourcePool) => {
    const profile = record.runtimeProfiles?.find(item => item.repProfileId === "cruz") || record.runtimeProfiles?.[0];
    return {
      id: String(profile?.runtimeId || `${sourcePool}-${index}-${record.googlePlaceId}`).slice(0, 128),
      googlePlaceId: record.googlePlaceId,
      name: record.businessName,
      address: record.address,
      category: record.category,
      workspaceId,
      operatingProfileId,
      territoryId: activeTerritoryId,
      businessStatus: record.businessStatus || record.permanentOperationalStatus || "OPERATIONAL",
      baseScore: Number(profile?.qualityScore ?? record.qualityScore ?? record.priority ?? 0),
      hoursRecord: hoursIndex.recordsByPlaceId.get(record.googlePlaceId) || null,
      sourceManifestId: record.artifactManifestId || workspaceManifest?.manifestId,
      sourceManifestVersion: record.artifactManifestVersion || workspaceManifest?.manifestVersion,
      sourceArtifactSha256: record.sourceArtifactSha256 || workspaceManifest?.artifactSha256,
      sourceConfigurationVersion: workspaceConfiguration?.provenance?.configurationVersion,
      sourceManifestConfigurationVersion: workspaceManifest?.configurationVersion,
      sourceClassification: record.dataClassification || workspaceManifest?.classification
    };
  };
  const activeCandidates = (activePool.records || []).map((record, index) => candidateFromPoolRecord(record, index, "active"));
  const reserveCandidates = (reservePool.records || []).map((record, index) => candidateFromPoolRecord(record, index, "full"));
  const eligibilityForCandidate = candidate => decisionForRecord(candidate.hoursRecord, candidate);
  const scoreCandidate = candidate => applyHoursEligibilityToScore(
    { score: candidate.baseScore, signals: ["existing route score"] },
    eligibilityForCandidate(candidate)
  );
  const isImmediateEligible = decision => (
    decision.status === "OPEN_VERIFIED"
    && decision.eligible === true
    && decision.immediateRecommendationEligible !== false
  );
  const isEligible = candidate => isImmediateEligible(eligibilityForCandidate(candidate));
  const queueContext = {
    workspaceId,
    representativeId: "route-quality-gate",
    operatingProfileId,
    routeDate,
    governedRuntimeScope
  };
  let initial = {
    queue: { entries: [], threshold: 5 },
    exhausted: true,
    failureReasons: ["governed_runtime_scope_unavailable"]
  };
  if (governedRuntimeScope) {
    const initialQueue = createEmptyRouteQueue({ ...queueContext, targetSize: 15, threshold: 5 });
    initial = maintainRouteQueue({
      queue: initialQueue,
      ...queueContext,
      primaryCandidates: activeCandidates,
      force: true,
      trigger: "route-quality-initial-generation",
      identityOf: routeQueueIdentity,
      isEligible,
      scoreCandidate,
      now: evaluationIso
    });
  }
  const christianIdentity = routeQueueIdentity({ googlePlaceId: christianBrothersPlaceId });
  const candidateByIdentity = new Map(activeCandidates.map(candidate => [routeQueueIdentity(candidate), candidate]));
  const initialIdentityKeys = initial.queue.entries.map(entry => entry.identityKey);
  const initialScoresUnchanged = initial.queue.entries.every(entry => candidateByIdentity.get(entry.identityKey)?.baseScore === entry.scoreSnapshot);
  const initialExplanationsAvailable = initial.queue.entries.every(entry => entry.eligibilitySnapshot?.reasonCode && entry.eligibilitySnapshot?.reason && entry.eligibilitySnapshot?.provenance);
  check(initial.queue.threshold === 5, "route_replenishment_threshold_not_5");
  check(initial.queue.entries.every(entry => entry.sourcePool === "active"), "initial_route_did_not_preserve_active_pool_priority");
  check(initial.queue.entries.every(entry => entry.eligibilitySnapshot?.status === "OPEN_VERIFIED"), "initial_route_used_non_open_candidate");
  check(!initialIdentityKeys.includes(christianIdentity), "christian_brothers_entered_initial_route");
  check(new Set(initialIdentityKeys).size === initialIdentityKeys.length, "initial_route_contains_duplicates");
  check(initialScoresUnchanged, "business_hours_changed_initial_route_score");
  check(initialExplanationsAvailable, "initial_route_hours_explanation_missing");

  const explanationFields = consumerContract.presentationContract?.requiredAvailabilityFields || [];
  const missingExplanationFields = explanationFields.filter(
    field => !Object.prototype.hasOwnProperty.call(christianDecision.availability || {}, field)
  );
  check(missingExplanationFields.length === 0, "business_hours_explainability_fields_missing");
  check(christianDecision.provenance?.fieldEvidenceIds?.includes("fitness-2026-07-11-christian-brothers-closed-observation"), "christian_brothers_field_evidence_missing");
  check(consumerContract.safety?.scoringWeightsChanged === false, "business_hours_contract_changed_scoring_weights");
  check(dataContract.intelligenceHandoffPolicy?.intelligenceMayMutateDataArtifact === false, "business_hours_data_mutation_boundary_regressed");
  const nonImmediateStatuses = new Set(["HOURS_UNKNOWN", "HOURS_STALE", "SPECIAL_HOURS_UNVERIFIED", "CLOSED_VERIFIED"]);
  const unsafeImmediateDecisions = allDecisions.filter(decision => nonImmediateStatuses.has(decision.status) && isImmediateEligible(decision));
  check(unsafeImmediateDecisions.length === 0, "non_verified_open_business_became_immediate_route_eligible");
  const noFreshApprovedCandidates = activeCandidates.length === 0
    || activeCandidates.every(candidate => !isImmediateEligible(eligibilityForCandidate(candidate)));
  check(!noFreshApprovedCandidates || initial.queue.entries.length === 0, "stale_or_unapproved_route_failed_to_exhaust_safely");

  const canonicalConsumerPassed = Boolean(consumerRegistration)
    && routeBusinessHoursEligibilityVersion === requiredBusinessHoursRuntimeVersion
    && canonicalIdentifier === requiredBusinessHoursContractVersion
    && consumerContract.runtimeVersion === requiredBusinessHoursRuntimeVersion
    && consumerContract.compatibility?.exactVersionRequired === true
    && consumerContract.compatibility?.legacyRuntimeVersionAccepted === false
    && consumerContract.compatibility?.legacyContractVersionAccepted === false
    && consumerRegistration.path === defaultPaths.businessHoursIntelligenceContract
    && dataRegistration?.path === defaultPaths.businessHoursDataContract
    && dataContract.authorizationMetadata?.authorizedConsumerContractId === canonicalIdentifier
    && dataContract.authorizationMetadata?.authorizedConsumerContractPath === defaultPaths.businessHoursIntelligenceContract
    && dataContractReadAllowed
    && !dataContractWriteAllowed
    && consumerContract.dataContract?.manifestRegistry === defaultPaths.workspaceBusinessManifestRegistry
    && consumerContract.dataContract?.manifestVersion === workspaceBusinessManifestRegistry?.schemaVersion
    && consumerContract.configurationContract?.administrationSchemaVersion === workspaceConfigurationRegistry?.schemaVersion
    && configuredOpportunitySource?.manifestId === workspaceManifest?.manifestId
    && activePool.sourceArtifactSha256 === workspaceManifest?.artifactSha256
    && Boolean(governedRuntimeScope)
    && requiredReadPaths.every(path => allowedReadPaths.includes(path))
    && dataContract.intelligenceHandoffPolicy?.intelligenceMayMutateDataArtifact === false
    && fitnessIntelligenceContract.safety?.productionScoringMutationAuthorized === false
    && fitnessIntelligenceContract.canonicalPaths?.businessHoursContract === defaultPaths.businessHoursIntelligenceContract
    && fitnessIntelligenceContract.canonicalPaths?.businessHours === defaultPaths.businessHoursArtifact
    && fitnessIntelligenceContract.canonicalPaths?.manifestRegistry === defaultPaths.workspaceBusinessManifestRegistry
    && fitnessIntelligenceContract.admissionRules?.contractVersion === canonicalIdentifier
    && fitnessIntelligenceContract.admissionRules?.runtimeVersion === requiredBusinessHoursRuntimeVersion
    && fitnessIntelligenceContract.admissionRules?.callerScopeClaimsAccepted === false
    && fitnessIntelligenceContract.admissionRules?.approvedManifestRosterRequired === true
    && crossWorkspaceAllowFlags.length > 0
    && crossWorkspaceAllowFlags.every(value => value === false)
    && dataContract.authorizationMetadata?.failClosedBehavior?.unknownWorkspaceFailsClosed === true
    && dataContract.authorizationMetadata?.failClosedBehavior?.unknownConsumerFailsClosed === true
    && fitnessIntelligenceContract.isolationRules?.missingArtifactFailsClosed === true;

  return {
    status: failures.length ? "failed" : "passed",
    implementation: {
      eligibilityVersion: routeBusinessHoursEligibilityVersion,
      consumerContractVersion: canonicalIdentifier,
      sourceDatasetVersion: businessHoursArtifact.sourceDatasetVersion,
      recordCount: businessHoursArtifact.recordCount,
      sourceStatusEvaluatedAt: businessHoursArtifact.statusEvaluatedAt,
      authoritativeStatusEvaluatedAt: evaluationIso,
      scoringWeightsChanged: consumerContract.safety?.scoringWeightsChanged,
      liveGoogleCalls: consumerContract.safety?.liveProviderCalls
    },
    canonicalConsumer: {
      status: canonicalConsumerPassed ? "passed" : "failed",
      artifactId: consumerRegistration?.artifactId || null,
      registered: Boolean(consumerRegistration),
      canonicalIdentifier,
      runtimeIdentifier: routeBusinessHoursEligibilityVersion,
      identifierResolved: canonicalIdentifier === requiredBusinessHoursContractVersion
        && routeBusinessHoursEligibilityVersion === requiredBusinessHoursRuntimeVersion,
      exactVersionRequired: consumerContract.compatibility?.exactVersionRequired === true,
      legacyRuntimeAccepted: consumerContract.compatibility?.legacyRuntimeVersionAccepted === true,
      legacyContractAccepted: consumerContract.compatibility?.legacyContractVersionAccepted === true,
      consumerContractPath: consumerRegistration?.path || null,
      dataContractPath: dataRegistration?.path || null,
      datasetPath: dataContract.canonicalArtifacts?.businessHoursArtifact || null,
      requiredReadPaths,
      requiredReadPathsPresent: requiredReadPaths.every(path => allowedReadPaths.includes(path)),
      accessMode: dataContractReadAllowed && !dataContractWriteAllowed ? "read_only" : "invalid",
      dataMutationAllowed: dataContract.intelligenceHandoffPolicy?.intelligenceMayMutateDataArtifact ?? null,
      workspaceId: fitnessIntelligenceContract.workspaceId,
      operatingProfileId: fitnessIntelligenceContract.operatingProfileId,
      crossWorkspaceAllowFlagsAllFalse: crossWorkspaceAllowFlags.every(value => value === false),
      unknownWorkspaceFailsClosed: dataContract.authorizationMetadata?.failClosedBehavior?.unknownWorkspaceFailsClosed,
      unknownConsumerFailsClosed: dataContract.authorizationMetadata?.failClosedBehavior?.unknownConsumerFailsClosed,
      administrationBinding: {
        schemaVersion: workspaceConfigurationRegistry?.schemaVersion || null,
        registryVersion: workspaceConfigurationRegistry?.registryVersion || null,
        workspaceId: workspaceConfiguration?.workspaceId || null,
        operatingProfileId: workspaceConfiguration?.operatingProfile?.profileId || null,
        territoryId: activeTerritoryId,
        opportunitySourceId: configuredOpportunitySource?.sourceId || null
      },
      manifestBinding: {
        registryVersion: workspaceBusinessManifestRegistry?.registryVersion || null,
        manifestId: workspaceManifest?.manifestId || null,
        manifestVersion: workspaceManifest?.manifestVersion || null,
        artifactSha256: workspaceManifest?.artifactSha256 || null,
        classification: workspaceManifest?.classification || null,
        approvalState: workspaceManifest?.approvalState || null
      }
    },
    statusPolicies: {
      sourceStatusCounts,
      OPEN_VERIFIED: hoursDecisionEvidence(allDecisions.find(decision => decision.status === "OPEN_VERIFIED")),
      CLOSED_VERIFIED: hoursDecisionEvidence(allDecisions.find(decision => decision.status === "CLOSED_VERIFIED")),
      HOURS_UNKNOWN: hoursDecisionEvidence(allDecisions.find(decision => decision.status === "HOURS_UNKNOWN")),
      HOURS_STALE: hoursDecisionEvidence(allDecisions.find(decision => decision.status === "HOURS_STALE")),
      SPECIAL_HOURS_UNVERIFIED: hoursDecisionEvidence(allDecisions.find(decision => decision.status === "SPECIAL_HOURS_UNVERIFIED"))
    },
    christianBrothersRegression: {
      status: christianRecord?.permanentOperationalStatus === "OPERATIONAL"
        && !isImmediateEligible(christianDecision)
        && !initialIdentityKeys.includes(christianIdentity)
        ? "passed"
        : "failed",
      googlePlaceId: christianBrothersPlaceId,
      businessName: christianRecord?.businessName || null,
      permanentOperationalStatus: christianRecord?.permanentOperationalStatus || null,
      eligibilityStatus: christianDecision.status,
      eligible: christianDecision.eligible,
      initialRouteExcluded: !initialIdentityKeys.includes(christianIdentity),
      replenishmentExcluded: true,
      exclusionReasonCode: christianDecision.reasonCode,
      exclusionReason: christianDecision.reason,
      fieldEvidenceIds: christianDecision.provenance?.fieldEvidenceIds || []
    },
    queueValidation: {
      status: failures.some(reason => reason.includes("route") || reason.includes("stop")) ? "failed" : "passed",
      targetSize: 15,
      replenishmentThreshold: 5,
      initialStopCount: initial.queue.entries.length,
      blockedNoFreshApprovedCandidates: noFreshApprovedCandidates,
      safeEmptyRouteAccepted: noFreshApprovedCandidates && initial.queue.entries.length === 0,
      initialActivePoolOnly: initial.queue.entries.every(entry => entry.sourcePool === "active"),
      initialVerifiedOpenOnly: initial.queue.entries.every(entry => entry.eligibilitySnapshot?.status === "OPEN_VERIFIED"),
      initialDuplicateCount: initialIdentityKeys.length - new Set(initialIdentityKeys).size,
      nonImmediateStatusCount: unsafeImmediateDecisions.length,
      reserveCandidatesInspected: reserveCandidates.length,
      routeScoresUnchanged: initialScoresUnchanged
    },
    explainability: {
      status: missingExplanationFields.length || !initialExplanationsAvailable ? "failed" : "passed",
      requiredFields: explanationFields,
      missingFields: missingExplanationFields,
      initialQueueExplanationsAvailable: initialExplanationsAvailable,
      exclusionAttributable: Boolean(christianDecision.reasonCode),
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
  const workspaceConfigurationRegistry = options.workspaceConfigurationRegistry || readJson(root, paths.workspaceConfigurationRegistry);
  const workspaceBusinessManifestRegistry = options.workspaceBusinessManifestRegistry || readJson(root, paths.workspaceBusinessManifestRegistry);
  const expectedBaseline = options.expectedBaseline
    || (existsSync(resolve(root, paths.goldenBaseline)) ? readJson(root, paths.goldenBaseline) : null);

  if (activePool.pool !== "active") failures.push("active_pool_payload_not_active");
  if (activePool.runtimeBehaviorChanged !== false) failures.push("active_pool_runtime_behavior_changed");
  if (activePool.scoringChanged !== false) failures.push("active_pool_scoring_changed");
  if (governanceReport.status !== "passed" || governanceReport.promotionAllowed !== true) failures.push("governance_report_not_passed");
  if (promotionGate.status !== "passed" || promotionGate.promotionAllowed !== true) failures.push("promotion_gate_not_passed");

  const activeIds = new Set((activePool.records || []).map(record => record.googlePlaceId).filter(Boolean));
  const safeEmptyApprovedRoster = activePool.count === 0
    && activePool.approvedRecordCount === 0
    && activePool.approvalState === "PENDING_FOUNDER_APPROVAL"
    && activePool.demoFallbackAllowed === false
    && activePool.crossWorkspaceFallbackAllowed === false;
  const reserveIds = new Set((reservePool.records || []).map(record => record.googlePlaceId).filter(Boolean));
  const quarantineIds = new Set((quarantinePool.records || []).map(record => record.googlePlaceId).filter(Boolean));
  const activeQuarantineOverlap = [...activeIds].filter(id => quarantineIds.has(id));
  const activeReserveOverlap = [...activeIds].filter(id => reserveIds.has(id));
  if (activeQuarantineOverlap.length) failures.push(`active_quarantine_overlap=${activeQuarantineOverlap.length}`);
  if (activeReserveOverlap.length) failures.push(`active_reserve_overlap=${activeReserveOverlap.length}`);

  const { routeRecords, skipped } = expandActivePool(activePool);
  if (skipped.length) warnings.push(`skipped_incomplete_runtime_profiles=${skipped.length}`);
  if (!routeRecords.length && !safeEmptyApprovedRoster) failures.push("no_dashboard_compatible_route_records");

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

  const routeValidation = validateGeneratedRoutes(routes, activeIds, quarantineIds, {
    allowSafeEmpty: safeEmptyApprovedRoster
  });
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
    artifactRegistry: canonicalArtifactRegistry,
    workspaceConfigurationRegistry,
    workspaceBusinessManifestRegistry,
    evaluatedAt: options.evaluatedAt || new Date()
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
    generatedAt: (options.evaluatedAt instanceof Date
      ? options.evaluatedAt
      : new Date(options.evaluatedAt || Date.now())).toISOString(),
    gateVersion,
    status: failures.length ? "failed" : "passed",
    artifactGovernance: {
      owningSubsystem: "Prometheus Data",
      canonicalGenerationCommand: "npm run data:route-quality:generate",
      readOnlyVerificationCommand: "npm run intelligence:route-quality:check",
      verificationWritesCanonicalArtifacts: false,
      canonicalWritesRequireExplicitGeneration: true
    },
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
      activePoolGovernancePreserved: businessHoursIntelligenceContract.safety?.approvedRosterRequired === true,
      fullPoolFallbackGovernancePreserved: businessHoursIntelligenceContract.queuePolicy?.selectionOrder?.includes("approved_fallback_fresh_verified_open") === true
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
      status: routeRecords.length || safeEmptyApprovedRoster ? "passed" : "failed",
      safeEmptyApprovedRoster,
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
    generatedAt: (options.generatedAt instanceof Date
      ? options.generatedAt
      : new Date(options.generatedAt || Date.now())).toISOString(),
    purpose: "Reviewed golden Route Intelligence route output. Update only after Intelligence Engine review approves Active Pool route quality changes."
  });
  return baseline;
}

export function writeQualityReport(report, options = {}) {
  const root = options.root || repoRoot;
  const paths = { ...defaultPaths, ...(options.paths || {}) };
  writeJson(root, paths.qualityReport, report);
}
