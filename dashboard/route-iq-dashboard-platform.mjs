import {
  validateRouteIqWorkspaceConfigurationRegistry
} from "../administration/contracts/route-iq-workspace-configuration-v2-validation.mjs";

export const routeIqDashboardPlatformVersion = "route-iq-configurable-dashboard-v2";
export const routeIqDashboardStorageVersion = "route-iq-dashboard-storage-v2";
export const routeIqDashboardCacheName = "prometheus-v50-route-iq-configurable-dashboard";
export const routeIqFounderWorkspaceAccessContractVersion = "route-iq-founder-workspace-access-v1";
export const routeIqFounderWorkspaceSwitchContractVersion = "route-iq-founder-workspace-switch-receipt-v1";
export const routeIqFounderWorkspaceAccessPath = "/api/dashboard/route-iq/founder/workspaces";
export const routeIqFounderWorkspaceSwitchPath = "/api/dashboard/route-iq/founder/workspace-session";

export const routeIqDashboardRuntimeAssetKeys = Object.freeze([
  "workspaceConfiguration",
  "businessManifestRegistry",
  "businessRoster",
  "businessHours"
]);

const strictId = /^[a-z][a-z0-9_]{2,127}$/u;
const sha256Pattern = /^[a-f0-9]{64}$/u;
const usZipCodePattern = /^[0-9]{5}$/u;
const zipCoverageVersionPattern = /^territory-zip-coverage-v1\.[0-9]+\.[0-9]+$/u;
const zipCoverageRegistryVersionPattern = /^route-iq-cross-industry-workspaces-v2\.(\d+)\.(\d+)$/u;
const supportedCardFields = new Set([
  "business_name",
  "business_type",
  "operating_hours",
  "availability_status",
  "next_opening",
  "distance",
  "estimated_visit_duration",
  "visit_count",
  "last_outcome",
  "unit_potential",
  "decision_maker_role",
  "opportunity_stage"
]);
const productionClassifications = new Set([
  "FOUNDER_FIELD_RESEARCH",
  "CUSTOMER_GOVERNED_DATA"
]);
const sessionCapabilityKeys = Object.freeze([
  "operateOwnRoute",
  "readWorkspaceOperations",
  "administerWorkspaceRoster",
  "founderIntelligence",
  "founderCrm"
]);
const unavailableStatuses = new Set([
  "HOURS_UNKNOWN",
  "HOURS_STALE",
  "SPECIAL_HOURS_UNVERIFIED",
  "PROVIDER_FAILURE",
  "HOURS_INVALID"
]);
const loadedFounderWorkspaceAccesses = new WeakSet();

export class RouteIqDashboardPlatformError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "RouteIqDashboardPlatformError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new RouteIqDashboardPlatformError(code, message);
}

function cleanText(value, maximum = 500) {
  return String(value ?? "").replace(/[\u0000-\u001F\u007F]/gu, "").trim().slice(0, maximum);
}

function exactKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function validTimestamp(value) {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function registrySupportsZipCoverage(registryVersion) {
  const match = zipCoverageRegistryVersionPattern.exec(registryVersion || "");
  return Boolean(match) && Number(match[1]) >= 2;
}

function localAssetPath(value) {
  if (typeof value !== "string"
    || value.length < 2
    || value.length > 320
    || !value.startsWith("/")
    || value.includes("\\")
    || value.includes("..")
    || value.includes("?")
    || value.includes("#")
    || /[\u0000-\u001F\u007F\s]/u.test(value)) {
    return null;
  }
  let parsed;
  try {
    parsed = new URL(value, "https://route-iq.invalid");
  } catch {
    return null;
  }
  if (parsed.origin !== "https://route-iq.invalid" || parsed.pathname !== value) return null;
  return parsed.pathname;
}

function relativeArtifactPath(value) {
  const path = localAssetPath(value);
  return path ? path.slice(1) : null;
}

function assertSession(session) {
  if (!session
    || session.authorizationState !== "server_verified"
    || !strictId.test(session.workspaceId || "")
    || !strictId.test(session.operatingProfileId || "")
    || !strictId.test(session.userId || "")
    || !strictId.test(session.representativeId || "")
    || !strictId.test(session.roleId || "")
    || !exactKeys(session.capabilities, sessionCapabilityKeys)
    || Object.values(session.capabilities).some(value => typeof value !== "boolean")
    || session.capabilities.founderIntelligence !== false
    || session.capabilities.founderCrm !== false
    || session.safety?.prospectiveCollection !== "OFF"
    || session.safety?.activeCohorts !== 0
    || session.safety?.recommendationInfluence !== "OFF") {
    fail("route_iq_dashboard_session_invalid", "The authenticated Dashboard session is invalid.");
  }
  if (!exactKeys(session.runtimeAssets, routeIqDashboardRuntimeAssetKeys)) {
    fail("route_iq_dashboard_runtime_assets_invalid", "The Dashboard runtime asset binding is invalid.");
  }
  for (const [key, value] of Object.entries(session.runtimeAssets)) {
    const path = localAssetPath(value);
    if (!path
      || (key === "workspaceConfiguration" && !path.startsWith("/administration/"))
      || (key !== "workspaceConfiguration" && !path.startsWith("/data/"))) {
      fail("route_iq_dashboard_runtime_asset_path_invalid", "A Dashboard runtime asset is outside its governed source.");
    }
  }
}

function assertDashboardConfiguration(workspace) {
  const dashboard = workspace?.dashboard;
  if (!dashboard
    || !dashboard.terminology
    || !Array.isArray(dashboard.cardFields)
    || !Array.isArray(dashboard.filters)
    || !Array.isArray(dashboard.sorts)
    || !Array.isArray(dashboard.actions)
    || !Array.isArray(dashboard.outcomes)
    || !Array.isArray(dashboard.kpis)
    || !Array.isArray(dashboard.capabilities)) {
    fail("route_iq_dashboard_configuration_invalid", "The workspace Dashboard configuration is incomplete.");
  }
  const fieldIds = dashboard.cardFields.map(field => field?.fieldId);
  if (fieldIds.some(fieldId => !supportedCardFields.has(fieldId))
    || new Set(fieldIds).size !== fieldIds.length
    || !fieldIds.includes("business_name")
    || !fieldIds.includes("operating_hours")
    || !fieldIds.includes("estimated_visit_duration")) {
    fail("route_iq_dashboard_card_configuration_invalid", "The workspace card configuration is invalid.");
  }
}

export function validateDashboardWorkspaceRegistry(registry, session, { allowSynthetic = false } = {}) {
  assertSession(session);
  let validatedRegistry;
  try {
    validatedRegistry = validateRouteIqWorkspaceConfigurationRegistry(registry);
  } catch {
    fail("route_iq_dashboard_workspace_registry_invalid", "The workspace configuration registry is invalid.");
  }
  const matches = validatedRegistry.workspaces.filter(workspace => workspace.workspaceId === session.workspaceId);
  if (matches.length !== 1) {
    fail("route_iq_dashboard_workspace_unknown", "The authenticated workspace has no unique Dashboard configuration.");
  }
  const workspace = matches[0];
  if (workspace.operatingProfile?.profileId !== session.operatingProfileId
    || workspace.fallbackPolicy?.mode !== "FAIL_CLOSED"
    || workspace.fallbackPolicy?.demoCatalogAllowed !== false
    || workspace.fallbackPolicy?.embeddedBusinessCatalogAllowed !== false
    || workspace.fallbackPolicy?.crossWorkspaceFallbackAllowed !== false
    || workspace.fallbackPolicy?.missingSourceState !== "CONFIGURATION_REQUIRED_EMPTY"
    || Number(workspace.availabilityPolicy?.freshnessCeilingHours) > 24
    || workspace.availabilityPolicy?.immediateRecommendationRule !== "FRESH_VERIFIED_OPEN_OR_ACCESS_WINDOW_ONLY"
    || workspace.availabilityPolicy?.uncertainRule !== "NON_RECOMMENDED_VERIFICATION_REQUIRED") {
    fail("route_iq_dashboard_workspace_boundary_invalid", "The workspace configuration does not preserve fail-closed routing.");
  }
  const syntheticValidation = allowSynthetic
    && workspace.lifecycle === "synthetic_validation_only";
  const users = (workspace.users || []).filter(user => user?.userId === session.userId
    && user?.representativeId === session.representativeId
    && (user?.active === true
      || (syntheticValidation
        && user?.identityClass === "SYNTHETIC_NONCANONICAL"
        && user?.principalMappingStatus === "SYNTHETIC_ONLY")));
  if (users.length !== 1) {
    fail("route_iq_dashboard_representative_scope_invalid", "The authenticated representative is not uniquely authorized.");
  }
  if (users[0].roleId !== session.roleId) {
    fail("route_iq_dashboard_role_scope_invalid", "The authenticated role does not match the configured user.");
  }
  const roles = (workspace.roles || []).filter(role => role?.roleId === session.roleId);
  if (roles.length !== 1) {
    fail("route_iq_dashboard_role_scope_invalid", "The authenticated role is not uniquely authorized.");
  }
  const territories = new Set(users[0].territoryIds || []);
  if (!territories.size
    || [...territories].some(territoryId => !(workspace.territories || []).some(territory => territory?.territoryId === territoryId && territory?.active === true))) {
    fail("route_iq_dashboard_territory_scope_invalid", "The representative territory binding is invalid.");
  }
  assertDashboardConfiguration(workspace);
  const dashboardCapabilities = new Set(workspace.dashboard.capabilities);
  const effectiveCapabilities = roles[0].capabilities.filter(capability =>
    dashboardCapabilities.has(capability)
  );
  const territoryZipCoverage = registrySupportsZipCoverage(validatedRegistry.registryVersion)
    ? projectDashboardTerritoryZipCoverage(workspace, users[0])
    : null;
  return Object.freeze({
    registryVersion: validatedRegistry.registryVersion,
    workspace,
    user: users[0],
    role: roles[0],
    effectiveCapabilities: Object.freeze(effectiveCapabilities),
    territoryIds: Object.freeze([...territories]),
    territoryZipCoverage
  });
}

export function projectDashboardTerritoryZipCoverage(workspace, user) {
  if (!strictId.test(workspace?.workspaceId || "")
    || !strictId.test(workspace?.companyId || "")
    || !Array.isArray(workspace?.territories)
    || !Array.isArray(user?.territoryIds)
    || !user.territoryIds.length) {
    fail("route_iq_dashboard_zip_coverage_invalid", "The governed territory ZIP coverage is invalid.");
  }
  const assignedTerritories = new Set(user.territoryIds);
  const workspaceZipAssignments = new Map();
  const projected = [];
  for (const territory of workspace.territories) {
    const coverage = territory?.zipCoverage;
    if (!strictId.test(territory?.territoryId || "")
      || !coverage
      || !zipCoverageVersionPattern.test(coverage.coverageVersion || "")
      || coverage.workspaceId !== workspace.workspaceId
      || coverage.companyId !== workspace.companyId
      || coverage.territoryId !== territory.territoryId
      || !Array.isArray(coverage.postalCodes)
      || !coverage.postalCodes.length
      || coverage.postalCodes.some(zipCode => typeof zipCode !== "string" || !usZipCodePattern.test(zipCode))
      || new Set(coverage.postalCodes).size !== coverage.postalCodes.length) {
      fail("route_iq_dashboard_zip_coverage_invalid", "The governed territory ZIP coverage is invalid.");
    }
    for (const zipCode of coverage.postalCodes) {
      if (workspaceZipAssignments.has(zipCode)) {
        fail("route_iq_dashboard_zip_assignment_conflict", "A ZIP code is assigned to more than one territory.");
      }
      workspaceZipAssignments.set(zipCode, territory.territoryId);
    }
    if (!assignedTerritories.has(territory.territoryId)) continue;
    if (territory.active !== true) {
      fail("route_iq_dashboard_zip_coverage_territory_inactive", "The representative ZIP scope includes an inactive territory.");
    }
    projected.push(Object.freeze({
      workspaceId: workspace.workspaceId,
      companyId: workspace.companyId,
      territoryId: territory.territoryId,
      displayName: cleanText(territory.displayName, 160),
      timezone: cleanText(territory.timezone, 80),
      coverageVersion: coverage.coverageVersion,
      zipCodes: Object.freeze([...coverage.postalCodes])
    }));
  }
  if (projected.length !== assignedTerritories.size) {
    fail("route_iq_dashboard_zip_coverage_scope_mismatch", "The representative ZIP scope is incomplete.");
  }
  return Object.freeze({
    workspaceId: workspace.workspaceId,
    companyId: workspace.companyId,
    configurationVersion: cleanText(workspace.provenance?.configurationVersion, 120),
    territories: Object.freeze(projected),
    zipCodes: Object.freeze(projected.flatMap(territory => territory.zipCodes))
  });
}

export function validateDashboardBusinessManifestRegistry(registry, session) {
  assertSession(session);
  if (!registry
    || registry.schemaVersion !== "route-iq-workspace-business-artifact-manifest-v1"
    || registry.registryVersion !== "route-iq-workspace-business-artifact-manifest-registry-v1"
    || registry.fallbackPolicy !== "FAIL_CLOSED_NO_DEMO_OR_CROSS_WORKSPACE_FALLBACK"
    || !validTimestamp(registry.generatedAt)
    || !Array.isArray(registry.manifests)) {
    fail("route_iq_dashboard_business_manifest_registry_invalid", "The business manifest registry is invalid.");
  }
  const matches = registry.manifests.filter(manifest => manifest?.workspaceId === session.workspaceId);
  if (matches.length !== 1) {
    fail("route_iq_dashboard_business_manifest_unknown", "The authenticated workspace has no unique business manifest.");
  }
  const manifest = matches[0];
  if (manifest.manifestVersion !== "route-iq-workspace-business-artifact-manifest-v1"
    || manifest.operatingProfileId !== session.operatingProfileId
    || !sha256Pattern.test(manifest.artifactSha256 || "")
    || !strictId.test(manifest.manifestId || "")
    || relativeArtifactPath(session.runtimeAssets.businessRoster) !== manifest.artifactPath
    || manifest.demoFallbackAllowed !== false
    || manifest.crossWorkspaceFallbackAllowed !== false
    || typeof manifest.productionUseAuthorized !== "boolean"
    || !Number.isInteger(manifest.recordCount)
    || !Number.isInteger(manifest.approvedRecordCount)
    || !Array.isArray(manifest.approvedRecordIds)
    || manifest.approvedRecordCount !== manifest.approvedRecordIds.length
    || new Set(manifest.approvedRecordIds).size !== manifest.approvedRecordIds.length
    || Number(manifest.freshness?.maximumAgeHours) > 24
    || !validTimestamp(manifest.freshness?.evaluatedAt)
    || !validTimestamp(manifest.freshness?.expiresAt)
    || cleanText(manifest.sourceProvenance?.producer, 120) !== "Prometheus Data"
    || !cleanText(manifest.sourceProvenance?.producerVersion, 120)
    || !cleanText(manifest.sourceProvenance?.sourceSystem, 160)
    || !validTimestamp(manifest.sourceProvenance?.sourceRetrievedAt)) {
    fail("route_iq_dashboard_business_manifest_invalid", "The workspace business manifest is invalid.");
  }
  return manifest;
}

function bytesToHex(bytes) {
  return [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(bytes, subtle = globalThis.crypto?.subtle) {
  if (!subtle || typeof subtle.digest !== "function") {
    fail("route_iq_dashboard_hash_runtime_unavailable", "The Dashboard integrity runtime is unavailable.");
  }
  const source = bytes instanceof ArrayBuffer
    ? bytes
    : ArrayBuffer.isView(bytes)
      ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
      : new TextEncoder().encode(String(bytes ?? "")).buffer;
  return bytesToHex(await subtle.digest("SHA-256", source));
}

async function governedJson(fetchFn, path) {
  const response = await fetchFn(path, {
    method: "GET",
    mode: "same-origin",
    credentials: "same-origin",
    cache: "no-store",
    redirect: "error",
    headers: { Accept: "application/json" }
  });
  if (!response?.ok
    || response.redirected === true
    || !String(response.headers?.get?.("content-type") || "application/json").toLowerCase().includes("application/json")) {
    fail("route_iq_dashboard_runtime_asset_unavailable", "A governed Dashboard runtime asset is unavailable.");
  }
  const bytes = await response.arrayBuffer();
  let value;
  try {
    value = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    fail("route_iq_dashboard_runtime_asset_malformed", "A governed Dashboard runtime asset is malformed.");
  }
  return { bytes, value };
}

function recordsForManifest(payload, manifest) {
  const records = manifest.recordIdentityField === "google_place_id"
    ? payload?.production_candidates
    : payload?.records;
  if (!Array.isArray(records) || records.length !== manifest.recordCount) {
    fail("route_iq_dashboard_business_roster_count_invalid", "The business roster does not match its manifest.");
  }
  return records;
}

function normalizedRosterPlace(record, manifest, workspace, user) {
  const recordId = cleanText(record?.[manifest.recordIdentityField], 180);
  const googlePlaceId = cleanText(record?.google_place_id || record?.googlePlaceId, 180);
  const name = cleanText(record?.business_name || record?.businessName, 160);
  const address = cleanText(record?.full_address || record?.address, 300);
  const category = cleanText(record?.category, 80) || "Other";
  const territoryId = cleanText(record?.territoryId, 127) || user.territoryIds[0];
  const postalCode = cleanText(record?.postal_code || record?.postalCode, 10);
  if (!recordId || !name || !address) {
    fail("route_iq_dashboard_business_roster_record_invalid", "An approved business record is incomplete.");
  }
  if (!user.territoryIds.includes(territoryId)
    || !(workspace.territories || []).some(territory => territory?.territoryId === territoryId && territory?.active === true)) {
    fail("route_iq_dashboard_business_roster_territory_invalid", "An approved business record is outside the representative territory.");
  }
  if ((workspace.territories || []).some(territory => Object.hasOwn(territory || {}, "zipCoverage"))) {
    const zipCoverage = projectDashboardTerritoryZipCoverage(workspace, user);
    const assignedTerritory = zipCoverage.territories.find(territory => territory.territoryId === territoryId);
    if (!usZipCodePattern.test(postalCode)) {
      fail("route_iq_dashboard_business_roster_zip_invalid", "An approved business record has no governed five-digit ZIP code.");
    }
    if (!assignedTerritory?.zipCodes.includes(postalCode)) {
      fail("route_iq_dashboard_business_roster_zip_unauthorized", "An approved business record is outside the representative ZIP scope.");
    }
  }
  return Object.freeze({
    id: `governed-${recordId}`,
    recordId,
    manifestRecordId: recordId,
    name,
    address,
    postalCode,
    category,
    distance: Number.isFinite(Number(record?.estimated_distance_miles))
      ? `${Number(record.estimated_distance_miles).toFixed(1)} mi`
      : "",
    latitude: Number.isFinite(Number(record?.latitude)) ? Number(record.latitude) : null,
    longitude: Number.isFinite(Number(record?.longitude)) ? Number(record.longitude) : null,
    googlePlaceId,
    googleMapsUrl: cleanText(record?.google_maps_url || record?.googleMapsUrl, 500),
    accessType: cleanText(record?.access_type || record?.accessType, 80),
    askFor: cleanText(record?.ask_for || record?.decisionMakerRole, 80),
    expectedVisitDuration: cleanText(record?.expected_visit_duration || record?.expectedVisitDuration, 40),
    opportunityStage: cleanText(record?.opportunity_stage || record?.opportunityStage, 80),
    sourceType: "Governed approved roster",
    workspaceId: workspace.workspaceId,
    operatingProfileId: workspace.operatingProfile.profileId,
    territoryId,
    repProfileId: user.representativeId,
    manifestId: manifest.manifestId,
    manifestVersion: manifest.manifestVersion,
    manifestSha256: manifest.artifactSha256,
    sourceManifestId: manifest.manifestId,
    sourceManifestVersion: manifest.manifestVersion,
    sourceArtifactSha256: manifest.artifactSha256,
    sourceConfigurationVersion: cleanText(workspace.provenance?.configurationVersion, 120),
    sourceManifestConfigurationVersion: cleanText(manifest.configurationVersion, 120),
    sourceClassification: manifest.classification,
    candidateAdmission: "GOVERNED_APPROVED",
    canRevisit: true,
    createdAt: Date.parse(manifest.freshness.evaluatedAt)
  });
}

export function projectApprovedRoster(payload, manifest, workspace, user, { allowSynthetic = false } = {}) {
  const records = recordsForManifest(payload, manifest);
  const recordIds = records.map(record => cleanText(record?.[manifest.recordIdentityField], 180));
  if (recordIds.some(recordId => !recordId) || new Set(recordIds).size !== recordIds.length) {
    fail("route_iq_dashboard_business_roster_identity_invalid", "The business roster has missing or duplicate identities.");
  }
  if (manifest.classification === "SYNTHETIC_NONCANONICAL" && !allowSynthetic) {
    return Object.freeze({ status: "SYNTHETIC_BLOCKED", places: Object.freeze([]) });
  }
  if (!productionClassifications.has(manifest.classification)
    && !(allowSynthetic && manifest.classification === "SYNTHETIC_NONCANONICAL")) {
    fail("route_iq_dashboard_business_roster_classification_invalid", "The business roster classification is not authorized.");
  }
  const approved = new Set(manifest.approvedRecordIds);
  const places = records
    .filter(record => approved.has(cleanText(record?.[manifest.recordIdentityField], 180)))
    .map(record => normalizedRosterPlace(record, manifest, workspace, user));
  if (places.length !== manifest.approvedRecordCount) {
    fail("route_iq_dashboard_business_roster_approval_invalid", "The approved business identities do not match the roster.");
  }
  return Object.freeze({
    status: places.length ? "READY" : "APPROVAL_REQUIRED",
    places: Object.freeze(places)
  });
}

export async function loadGovernedDashboardPlatform({
  session,
  fetchFn = globalThis.fetch,
  now = new Date(),
  allowSynthetic = false,
  subtle = globalThis.crypto?.subtle
} = {}) {
  assertSession(session);
  if (typeof fetchFn !== "function") {
    fail("route_iq_dashboard_fetch_unavailable", "The governed Dashboard runtime cannot load.");
  }
  const [configurationResult, manifestResult] = await Promise.all([
    governedJson(fetchFn, session.runtimeAssets.workspaceConfiguration),
    governedJson(fetchFn, session.runtimeAssets.businessManifestRegistry)
  ]);
  const configuration = validateDashboardWorkspaceRegistry(
    configurationResult.value,
    session,
    { allowSynthetic }
  );
  const manifest = validateDashboardBusinessManifestRegistry(manifestResult.value, session);
  const source = configuration.workspace.opportunitySources?.filter(item => item?.workspaceId === session.workspaceId
    && item?.profileId === session.operatingProfileId);
  if (!Array.isArray(source)
    || source.length !== 1
    || source[0].manifestRegistryPath !== relativeArtifactPath(session.runtimeAssets.businessManifestRegistry)
    || source[0].manifestId !== manifest.manifestId
    || source[0].artifactPath !== manifest.artifactPath
    || source[0].artifactPath !== relativeArtifactPath(session.runtimeAssets.businessRoster)
    || source[0].classification !== manifest.classification
    || source[0].manifestApprovalState !== manifest.approvalState
    || source[0].productionUseAuthorized !== manifest.productionUseAuthorized) {
    fail("route_iq_dashboard_business_source_binding_invalid", "The workspace business source and manifest do not match.");
  }
  const rosterResult = await governedJson(fetchFn, session.runtimeAssets.businessRoster);
  const digest = await sha256Hex(rosterResult.bytes, subtle);
  if (digest !== manifest.artifactSha256) {
    fail("route_iq_dashboard_business_roster_hash_mismatch", "The business roster failed integrity verification.");
  }
  const instant = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(instant.getTime())) {
    fail("route_iq_dashboard_authoritative_time_invalid", "The Dashboard evaluation time is invalid.");
  }
  const projection = Date.parse(manifest.freshness.expiresAt) < instant.getTime()
    && manifest.freshness.state !== "SYNTHETIC"
    ? Object.freeze({ status: "SOURCE_STALE", places: Object.freeze([]) })
    : projectApprovedRoster(
        rosterResult.value,
        manifest,
        configuration.workspace,
        configuration.user,
        { allowSynthetic }
      );
  return Object.freeze({
    platformVersion: routeIqDashboardPlatformVersion,
    configurationVersion: configuration.registryVersion,
    workspaceRegistry: configurationResult.value,
    manifestRegistry: manifestResult.value,
    sourceArtifactSha256: digest,
    workspace: configuration.workspace,
    user: configuration.user,
    role: configuration.role,
    effectiveCapabilities: configuration.effectiveCapabilities,
    territoryIds: configuration.territoryIds,
    territoryZipCoverage: configuration.territoryZipCoverage,
    manifest,
    status: projection.status,
    places: projection.places
  });
}

function founderWorkspaceSwitchEligible(session) {
  assertSession(session);
  return session.capabilities.readWorkspaceOperations === true
    && session.capabilities.administerWorkspaceRoster === true;
}

export function validateFounderWorkspaceAccessEnvelope(envelope, session) {
  if (!founderWorkspaceSwitchEligible(session)) {
    fail("route_iq_dashboard_founder_workspace_access_forbidden", "Workspace switching is unavailable.");
  }
  if (!exactKeys(envelope, [
    "contractVersion",
    "authorizationState",
    "principalAuthorization",
    "currentWorkspaceId",
    "currentOperatingProfileId",
    "authorizedWorkspaceSummaries"
  ])
    || envelope.contractVersion !== routeIqFounderWorkspaceAccessContractVersion
    || envelope.authorizationState !== "server_verified"
    || envelope.principalAuthorization !== "IMMUTABLE_FOUNDER_PRINCIPAL_VERIFIED"
    || envelope.currentWorkspaceId !== session.workspaceId
    || envelope.currentOperatingProfileId !== session.operatingProfileId
    || !Array.isArray(envelope.authorizedWorkspaceSummaries)
    || envelope.authorizedWorkspaceSummaries.length < 1
    || envelope.authorizedWorkspaceSummaries.length > 2) {
    fail("route_iq_dashboard_founder_workspace_access_invalid", "The Founder workspace access response is invalid.");
  }
  const summaries = envelope.authorizedWorkspaceSummaries.map(summary => {
    if (!exactKeys(summary, ["workspaceId", "workspaceLabel", "operatingProfileId"])
      || !strictId.test(summary.workspaceId || "")
      || !strictId.test(summary.operatingProfileId || "")
      || !cleanText(summary.workspaceLabel, 160)) {
      fail("route_iq_dashboard_founder_workspace_summary_invalid", "A Founder workspace summary is invalid.");
    }
    return Object.freeze({
      workspaceId: summary.workspaceId,
      workspaceLabel: cleanText(summary.workspaceLabel, 160),
      operatingProfileId: summary.operatingProfileId
    });
  });
  if (new Set(summaries.map(summary => summary.workspaceId)).size !== summaries.length
    || summaries.filter(summary => summary.workspaceId === session.workspaceId
      && summary.operatingProfileId === session.operatingProfileId).length !== 1) {
    fail("route_iq_dashboard_founder_workspace_summary_scope_invalid", "The Founder workspace summaries do not match the current session.");
  }
  return Object.freeze({
    contractVersion: envelope.contractVersion,
    currentWorkspaceId: session.workspaceId,
    currentOperatingProfileId: session.operatingProfileId,
    authorizedWorkspaceSummaries: Object.freeze(summaries)
  });
}

export async function loadFounderWorkspaceAccess({
  session,
  fetchFn = globalThis.fetch
} = {}) {
  if (!founderWorkspaceSwitchEligible(session)) {
    return Object.freeze({
      status: "SINGLE_WORKSPACE",
      currentWorkspaceId: session.workspaceId,
      authorizedWorkspaceSummaries: Object.freeze([])
    });
  }
  if (typeof fetchFn !== "function") {
    fail("route_iq_dashboard_founder_workspace_fetch_unavailable", "Founder workspace access is unavailable.");
  }
  const result = await governedJson(fetchFn, routeIqFounderWorkspaceAccessPath);
  const access = validateFounderWorkspaceAccessEnvelope(result.value, session);
  const loaded = Object.freeze({ status: "READY", ...access });
  loadedFounderWorkspaceAccesses.add(loaded);
  return loaded;
}

export async function requestFounderWorkspaceSwitch({
  session,
  access,
  requestedWorkspaceId,
  fetchFn = globalThis.fetch
} = {}) {
  if (!access || !loadedFounderWorkspaceAccesses.has(access)) {
    fail("route_iq_dashboard_founder_workspace_access_untrusted", "Workspace switching requires a fresh authenticated server response.");
  }
  const validatedAccess = validateFounderWorkspaceAccessEnvelope({
    contractVersion: access?.contractVersion,
    authorizationState: "server_verified",
    principalAuthorization: "IMMUTABLE_FOUNDER_PRINCIPAL_VERIFIED",
    currentWorkspaceId: access?.currentWorkspaceId,
    currentOperatingProfileId: access?.currentOperatingProfileId,
    authorizedWorkspaceSummaries: access?.authorizedWorkspaceSummaries
  }, session);
  if (!strictId.test(requestedWorkspaceId || "")
    || requestedWorkspaceId === session.workspaceId
    || !validatedAccess.authorizedWorkspaceSummaries.some(summary => summary.workspaceId === requestedWorkspaceId)) {
    fail("route_iq_dashboard_founder_workspace_switch_unauthorized", "The requested workspace is not server authorized.");
  }
  if (typeof fetchFn !== "function") {
    fail("route_iq_dashboard_founder_workspace_fetch_unavailable", "Founder workspace switching is unavailable.");
  }
  const response = await fetchFn(routeIqFounderWorkspaceSwitchPath, {
    method: "POST",
    mode: "same-origin",
    credentials: "same-origin",
    cache: "no-store",
    redirect: "error",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ requestedWorkspaceId })
  });
  if (!response?.ok
    || response.redirected === true
    || !String(response.headers?.get?.("content-type") || "").toLowerCase().includes("application/json")) {
    fail("route_iq_dashboard_founder_workspace_switch_failed", "The server did not establish the requested workspace session.");
  }
  let receipt;
  try {
    receipt = await response.json();
  } catch {
    fail("route_iq_dashboard_founder_workspace_switch_failed", "The server did not establish the requested workspace session.");
  }
  if (!exactKeys(receipt, [
    "contractVersion",
    "authorizationState",
    "requestedWorkspaceId",
    "sessionState",
    "reloadPath"
  ])
    || receipt.contractVersion !== routeIqFounderWorkspaceSwitchContractVersion
    || receipt.authorizationState !== "server_verified"
    || receipt.requestedWorkspaceId !== requestedWorkspaceId
    || receipt.sessionState !== "FRESH_SINGLE_WORKSPACE_SESSION_BOUND"
    || receipt.reloadPath !== "/app") {
    fail("route_iq_dashboard_founder_workspace_switch_receipt_invalid", "The server workspace switch receipt is invalid.");
  }
  return Object.freeze({
    requestedWorkspaceId,
    reloadPath: receipt.reloadPath,
    reloadRequired: true
  });
}

function displayEventTime(event) {
  return cleanText(event?.displayTime, 40);
}

function displayOpeningDay(event) {
  if (!event?.localDate || !validTimestamp(`${event.localDate}T12:00:00.000Z`)) return "";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: "UTC"
  }).format(new Date(`${event.localDate}T12:00:00.000Z`));
}

export function formatAvailabilityLabel(decision) {
  const status = cleanText(decision?.status, 80);
  const supplied = cleanText(decision?.displayLabel || decision?.displayStatus || decision?.currentAvailabilityDisplay, 160);
  if (status === "HOURS_STALE") return "Hours outdated · verification required";
  if (unavailableStatuses.has(status)) return "Hours unavailable · not route eligible";
  if (status === "OPEN_VERIFIED" && decision?.effectiveInterval?.source === "VERIFIED_APPOINTMENT_WINDOW") {
    return "Appointment window verified";
  }
  if (status === "OPEN_VERIFIED" && decision?.effectiveInterval?.twentyFourHours === true) {
    return "Open 24 hours";
  }
  const closing = displayEventTime(decision?.nextClosing || decision?.effectiveInterval?.end);
  if (status === "OPEN_VERIFIED" && closing) return `Open now · closes ${closing}`;
  const opening = decision?.nextOpening;
  const openingDay = displayOpeningDay(opening);
  const openingTime = displayEventTime(opening);
  if (status === "CLOSED_VERIFIED" && openingDay && openingTime) {
    return `Closed · opens ${openingDay} at ${openingTime}`;
  }
  if (status === "CLOSED_VERIFIED") return "Closed";
  return supplied || "Hours unavailable · not route eligible";
}

export function formatEstimatedVisitDuration(value) {
  const text = cleanText(value, 40)
    .replace(/\s*(?:minutes?|mins?)\s*/giu, "")
    .replace(/\s*-\s*/gu, "–");
  return text ? `Estimated visit: ${text} min` : "Estimated visit: verification required";
}

export function isImmediateRouteEligible(decision) {
  const freshness = decision?.hoursFreshness || decision?.freshnessState;
  return decision?.status === "OPEN_VERIFIED"
    && freshness === "FRESH"
    && decision?.immediateRecommendationEligible === true
    && decision?.failClosed !== true;
}

export function revalidateImmediateRouteQueue(queue, places, decisionForPlace) {
  const source = Array.isArray(places) ? places : [];
  const byId = new Map(source.map(place => [place.id, place]));
  const byIdentity = new Map(source.map(place => [place.manifestRecordId || place.googlePlaceId, place]));
  const removed = [];
  const entries = (Array.isArray(queue?.entries) ? queue.entries : []).filter(entry => {
    const place = byId.get(entry?.placeId) || byIdentity.get(entry?.manifestRecordId || entry?.googlePlaceId);
    const decision = place ? decisionForPlace(place) : null;
    const eligible = Boolean(place) && isImmediateRouteEligible(decision);
    if (!eligible) removed.push(entry);
    return eligible;
  });
  return {
    queue: { ...(queue || {}), entries },
    removed
  };
}

export function configuredCardFieldSet(workspace) {
  return new Set((workspace?.dashboard?.cardFields || []).map(field => field.fieldId));
}

export function dashboardCapabilityEnabled(platform, capabilityId) {
  return Array.isArray(platform?.effectiveCapabilities)
    && platform.effectiveCapabilities.includes(capabilityId);
}

export function dashboardActionLabel(platform, actionId, fallback = "") {
  if (!dashboardCapabilityEnabled(platform, actionId)) return "";
  const action = (platform?.workspace?.dashboard?.actions || []).find(item => item?.actionId === actionId);
  return cleanText(action?.label, 80) || cleanText(fallback, 80);
}

export function projectConfiguredBusinessCard(place, workspace, decision, stats = {}) {
  const fields = configuredCardFieldSet(workspace);
  const card = {
    business_name: place.name,
    business_type: place.category,
    operating_hours: formatAvailabilityLabel(decision),
    availability_status: cleanText(decision?.status, 80) || "HOURS_UNKNOWN",
    next_opening: decision?.nextOpening || null,
    distance: place.distance || "",
    estimated_visit_duration: formatEstimatedVisitDuration(place.expectedVisitDuration),
    visit_count: Number(stats.visits || 0),
    last_outcome: cleanText(stats.lastOutcome, 120),
    unit_potential: stats.unitPotential ?? null,
    decision_maker_role: cleanText(place.askFor, 80),
    opportunity_stage: cleanText(place.opportunityStage, 80)
  };
  return Object.freeze(Object.fromEntries(Object.entries(card).filter(([fieldId]) => fields.has(fieldId))));
}

function placeAdmissionIdentity(place) {
  return cleanText(place?.manifestRecordId || place?.googlePlaceId, 180);
}

function auditReferences(state) {
  const references = new Set();
  const collect = values => (Array.isArray(values) ? values : []).forEach(value => {
    const placeId = cleanText(value?.placeId, 128);
    if (placeId) references.add(placeId);
  });
  collect(state?.visits);
  collect(state?.visitCorrections);
  collect(state?.routeHistory);
  Object.values(state?.repProfiles || {}).forEach(profile => {
    collect(profile?.visits);
    collect(profile?.visitCorrections);
    collect(profile?.routeHistory);
  });
  return references;
}

export function migrateDashboardState(state, {
  session,
  manifest,
  storageVersion = routeIqDashboardStorageVersion
} = {}) {
  assertSession(session);
  const source = state && typeof state === "object" ? structuredClone(state) : {};
  const approved = new Set(manifest?.approvedRecordIds || []);
  const references = auditReferences(source);
  const historicalAuditPlaces = Array.isArray(source.historicalAuditPlaces)
    ? source.historicalAuditPlaces
    : [];
  const places = [];
  let removedCandidates = 0;
  for (const place of Array.isArray(source.places) ? source.places : []) {
    const sameScope = place?.workspaceId === session.workspaceId
      && (!place.operatingProfileId || place.operatingProfileId === session.operatingProfileId);
    const sameRepresentative = !place?.repProfileId || place.repProfileId === session.representativeId;
    const identity = placeAdmissionIdentity(place);
    const governed = sameScope
      && sameRepresentative
      && place?.candidateAdmission === "GOVERNED_APPROVED"
      && approved.has(identity)
      && place?.manifestId === manifest?.manifestId
      && place?.manifestVersion === manifest?.manifestVersion
      && place?.manifestSha256 === manifest?.artifactSha256;
    const manual = sameScope
      && sameRepresentative
      && place?.sourceType === "Dashboard Manual Entry";
    if (governed) {
      places.push(place);
      continue;
    }
    if (manual) {
      places.push({
        ...place,
        operatingProfileId: session.operatingProfileId,
        candidateAdmission: "VERIFICATION_REQUIRED",
        canRevisit: false
      });
      continue;
    }
    removedCandidates += 1;
    if (references.has(place?.id)) {
      historicalAuditPlaces.push({
        ...place,
        candidateAdmission: "HISTORICAL_AUDIT_ONLY",
        canRevisit: false
      });
    }
  }
  const repProfiles = {};
  const profile = source.repProfiles?.[session.representativeId];
  if (profile) {
    const activeRouteQueue = profile.activeRouteQueue
      ? {
          ...profile.activeRouteQueue,
          entries: (profile.activeRouteQueue.entries || []).filter(entry => {
            const identity = cleanText(entry?.manifestRecordId || entry?.googlePlaceId, 180);
            return approved.has(identity);
          })
        }
      : null;
    repProfiles[session.representativeId] = { ...profile, activeRouteQueue };
  }
  return {
    state: {
      ...source,
      storageVersion,
      workspaceId: session.workspaceId,
      operatingProfileId: session.operatingProfileId,
      places,
      repProfiles,
      activeRepId: session.representativeId,
      historicalAuditPlaces
    },
    removedCandidates
  };
}

export function legacyDashboardStorageKeys(storage, retainedKeys = []) {
  const retained = new Set(retainedKeys);
  const removable = [];
  for (let index = 0; index < Number(storage?.length || 0); index += 1) {
    const key = storage.key(index);
    if (!key || retained.has(key)) continue;
    if (/^(?:field-production-tracker|prometheus-v1(?::|$)|prometheus-active-rep(?::|$)|prometheus-launch-context(?::|$)|prometheus-route-queue(?::|$)|prometheus-runtime-catalog(?::|$))/u.test(key)) {
      removable.push(key);
    }
  }
  return removable;
}

export function governedRuntimeNetworkOnlyPath(pathname) {
  return pathname === "/app"
    || pathname === "/app/"
    || pathname.startsWith("/api/dashboard/")
    || pathname.startsWith("/administration/workspace-configurations/")
    || pathname.startsWith("/data/route-iq-commercial-readiness-v1/")
    || pathname.includes("/business-hours")
    || pathname.includes("/runtime-pool");
}
