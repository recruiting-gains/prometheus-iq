import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const routeIq72HourOnboardingRehearsalVersion =
  "route-iq-72-hour-onboarding-rehearsal-v1";
export const routeIq72HourOnboardingRehearsalId =
  "route_iq_72_hour_onboarding_rehearsal_summit_v1";
export const routeIq72HourOnboardingRehearsalClassification =
  "SYNTHETIC_NONCANONICAL_REHEARSAL_ONLY";
export const routeIq72HourOnboardingRehearsalFallbackPolicy =
  "FAIL_CLOSED_REHEARSAL_ONLY_NO_CANONICAL_ADMISSION";
export const routeIq72HourOnboardingAdministrationConfigurationPath =
  "administration/workspace-configurations/route-iq-72-hour-onboarding-rehearsal-v1.json";

const moduleDir = dirname(fileURLToPath(import.meta.url));
const defaultRepoRoot = resolve(moduleDir, "../..");
const defaultRegistryPath = resolve(
  moduleDir,
  "route-iq-72-hour-onboarding-rehearsal-manifest-registry-v1.json"
);
const REHEARSAL_PATH_PREFIX = "data/route-iq-72-hour-onboarding-rehearsal-v1/";
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const ID_PATTERN = /^[a-z][a-z0-9_]{2,127}$/u;
const POSTAL_CODE_PATTERN = /^[0-9]{5}$/u;

export class RouteIq72HourOnboardingRehearsalError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "RouteIq72HourOnboardingRehearsalError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new RouteIq72HourOnboardingRehearsalError(code, message);
}

function clone(value) {
  return structuredClone(value);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function exactKeys(value, keys, path) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("route_iq_rehearsal_shape_invalid", `${path} must be an object.`);
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length
    || actual.some((key, index) => key !== expected[index])) {
    fail("route_iq_rehearsal_shape_invalid", `${path} has invalid fields.`);
  }
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value).sort().map(key => [key, canonicalize(value[key])])
  );
}

export function stableRouteIq72HourOnboardingJson(value) {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

function validTimestamp(value) {
  return typeof value === "string"
    && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString() === value;
}

function readJsonArtifact(repoRoot, path, expectedSha256, scope) {
  if (typeof path !== "string"
    || !path.startsWith(REHEARSAL_PATH_PREFIX)
    || path.includes("..")
    || !SHA256_PATTERN.test(expectedSha256 || "")) {
    fail("route_iq_rehearsal_artifact_path_invalid", `${scope} is outside the rehearsal namespace.`);
  }
  const bytes = readFileSync(resolve(repoRoot, path));
  if (sha256(bytes) !== expectedSha256) {
    fail("route_iq_rehearsal_artifact_hash_mismatch", `${scope} failed immutable hash verification.`);
  }
  return { bytes, payload: JSON.parse(bytes.toString("utf8")) };
}

function validateProvenance(value, path) {
  exactKeys(value, [
    "producer",
    "producerVersion",
    "sourceSystem",
    "sourceRetrievedAt"
  ], path);
  if (value.producer !== "Prometheus Data"
    || value.producerVersion !== routeIq72HourOnboardingRehearsalVersion
    || value.sourceSystem !== "administration_bound_deterministic_rehearsal_fixture"
    || !validTimestamp(value.sourceRetrievedAt)) {
    fail("route_iq_rehearsal_provenance_invalid", `${path} is not deterministic Data evidence.`);
  }
}

function validateAdministrationAuthority(repoRoot, authority, manifest) {
  exactKeys(authority, [
    "ownerSubsystem",
    "configurationPath",
    "configurationSha256",
    "fixtureVersion"
  ], "administrationAuthority");
  if (authority.ownerSubsystem !== "Prometheus Administration"
    || authority.configurationPath !== routeIq72HourOnboardingAdministrationConfigurationPath
    || !SHA256_PATTERN.test(authority.configurationSha256 || "")
    || authority.fixtureVersion !== "route-iq-72-hour-onboarding-rehearsal-v1.0.0") {
    fail("route_iq_rehearsal_administration_authority_invalid", "The Administration authority pin is invalid.");
  }
  const bytes = readFileSync(resolve(repoRoot, authority.configurationPath));
  if (sha256(bytes) !== authority.configurationSha256) {
    fail("route_iq_rehearsal_administration_authority_drift", "The Administration rehearsal configuration changed.");
  }
  const fixture = JSON.parse(bytes.toString("utf8"));
  const configuration = fixture.workspaceConfiguration;
  const opportunitySource = configuration?.opportunitySources?.find(
    source => source.manifestId === manifest.manifestId
  );
  const activeTerritories = configuration?.territories?.filter(territory => territory.active);
  const expectedTerritoryAssignments = activeTerritories?.map(territory => ({
    territoryId: territory.territoryId,
    postalCodes: territory.zipCoverage?.postalCodes
  }));
  if (fixture.fixtureVersion !== authority.fixtureVersion
    || fixture.classification !== "SYNTHETIC_NONPRODUCTION_REHEARSAL"
    || fixture.productionAuthorized !== false
    || configuration?.workspaceId !== manifest.workspaceId
    || configuration?.companyId !== manifest.companyId
    || configuration?.operatingProfile?.profileId !== manifest.operatingProfileId
    || opportunitySource?.workspaceId !== manifest.workspaceId
    || opportunitySource?.profileId !== manifest.operatingProfileId
    || opportunitySource?.productionUseAuthorized !== false
    || manifest.configurationVersion !== fixture.fixtureVersion
    || stableRouteIq72HourOnboardingJson(expectedTerritoryAssignments)
      !== stableRouteIq72HourOnboardingJson(manifest.territoryAssignments)) {
    fail("route_iq_rehearsal_administration_scope_mismatch", "Data rehearsal scope differs from Administration.");
  }
  return {
    allowedLocationIds: new Set(
      configuration.locations.filter(location => location.active).map(location => location.locationId)
    ),
    territoryTimezones: new Map(
      activeTerritories.map(territory => [territory.territoryId, territory.timezone])
    )
  };
}

function validateRoster(roster, manifest, administrationScope) {
  exactKeys(roster, [
    "schemaVersion",
    "artifactVersion",
    "ownerSubsystem",
    "rehearsalId",
    "workspaceId",
    "companyId",
    "operatingProfileId",
    "classification",
    "approvalState",
    "productionUseAuthorized",
    "canonicalManifestAdmissionAllowed",
    "generatedAt",
    "sourceProvenance",
    "recordCount",
    "records"
  ], "roster");
  if (roster.schemaVersion !== "route-iq-72-hour-onboarding-rehearsal-roster-v1"
    || roster.artifactVersion !== "summit-service-supply-rehearsal-roster-v1"
    || roster.ownerSubsystem !== "Prometheus Data"
    || roster.rehearsalId !== manifest.rehearsalId
    || roster.workspaceId !== manifest.workspaceId
    || roster.companyId !== manifest.companyId
    || roster.operatingProfileId !== manifest.operatingProfileId
    || roster.classification !== routeIq72HourOnboardingRehearsalClassification
    || roster.approvalState !== "APPROVED_SYNTHETIC_REHEARSAL_ONLY"
    || roster.productionUseAuthorized !== false
    || roster.canonicalManifestAdmissionAllowed !== false
    || !validTimestamp(roster.generatedAt)
    || !Array.isArray(roster.records)
    || roster.recordCount !== roster.records.length
    || roster.recordCount !== manifest.recordCount) {
    fail("route_iq_rehearsal_roster_invalid", "The rehearsal roster contract is invalid.");
  }
  validateProvenance(roster.sourceProvenance, "roster.sourceProvenance");
  const recordIds = new Set();
  for (const [index, record] of roster.records.entries()) {
    exactKeys(record, [
      "recordId",
      "businessName",
      "address",
      "postalCode",
      "territoryId",
      "locationId",
      "businessTimezone",
      "category",
      "approvalState",
      "hoursRecordId"
    ], `roster.records[${index}]`);
    if (!ID_PATTERN.test(record.recordId || "")
      || !ID_PATTERN.test(record.territoryId || "")
      || !ID_PATTERN.test(record.locationId || "")
      || !POSTAL_CODE_PATTERN.test(record.postalCode || "")
      || !record.businessName.includes("Synthetic")
      || record.approvalState !== "APPROVED_SYNTHETIC_REHEARSAL_ONLY"
      || record.hoursRecordId !== record.recordId
      || !administrationScope.allowedLocationIds.has(record.locationId)
      || administrationScope.territoryTimezones.get(record.territoryId)
        !== record.businessTimezone
      || recordIds.has(record.recordId)) {
      fail("route_iq_rehearsal_roster_record_invalid", "A rehearsal roster record is invalid.");
    }
    recordIds.add(record.recordId);
  }
  if (manifest.approvedRecordCount !== recordIds.size
    || manifest.approvedRecordIds.some(recordId => !recordIds.has(recordId))) {
    fail("route_iq_rehearsal_roster_approval_invalid", "The rehearsal approval set does not match its roster.");
  }
  return recordIds;
}

function validateHours(hours, manifest, roster) {
  exactKeys(hours, [
    "schemaVersion",
    "artifactVersion",
    "ownerSubsystem",
    "projectionVersion",
    "rehearsalId",
    "workspaceId",
    "companyId",
    "operatingProfileId",
    "classification",
    "productionUseAuthorized",
    "canonicalManifestAdmissionAllowed",
    "statusEvaluatedAt",
    "providerMode",
    "freshnessPolicy",
    "sourceProvenance",
    "recordCount",
    "records"
  ], "businessHours");
  if (hours.schemaVersion !== "route-iq-72-hour-onboarding-rehearsal-hours-v1"
    || hours.artifactVersion !== "summit-service-supply-rehearsal-hours-v1"
    || hours.ownerSubsystem !== "Prometheus Data"
    || hours.projectionVersion !== "route-iq-business-availability-v2"
    || hours.rehearsalId !== manifest.rehearsalId
    || hours.workspaceId !== manifest.workspaceId
    || hours.companyId !== manifest.companyId
    || hours.operatingProfileId !== manifest.operatingProfileId
    || hours.classification !== routeIq72HourOnboardingRehearsalClassification
    || hours.productionUseAuthorized !== false
    || hours.canonicalManifestAdmissionAllowed !== false
    || hours.providerMode !== "NO_EXTERNAL_PROVIDER_REHEARSAL"
    || !validTimestamp(hours.statusEvaluatedAt)
    || !Array.isArray(hours.records)
    || hours.recordCount !== hours.records.length
    || hours.recordCount !== manifest.recordCount) {
    fail("route_iq_rehearsal_hours_invalid", "The rehearsal business-hours contract is invalid.");
  }
  exactKeys(hours.freshnessPolicy, [
    "maximumAgeHours",
    "freshStatus",
    "staleStatus",
    "missingStatus",
    "invalidStatus",
    "providerFailureStatus",
    "unverifiedStatusesRouteEligible"
  ], "businessHours.freshnessPolicy");
  if (hours.freshnessPolicy.maximumAgeHours !== 24
    || hours.freshnessPolicy.freshStatus !== "FRESH"
    || hours.freshnessPolicy.staleStatus !== "HOURS_STALE"
    || hours.freshnessPolicy.missingStatus !== "HOURS_UNKNOWN"
    || hours.freshnessPolicy.invalidStatus !== "HOURS_INVALID"
    || hours.freshnessPolicy.providerFailureStatus !== "PROVIDER_FAILURE"
    || hours.freshnessPolicy.unverifiedStatusesRouteEligible !== false) {
    fail("route_iq_rehearsal_freshness_policy_invalid", "The rehearsal freshness policy is invalid.");
  }
  validateProvenance(hours.sourceProvenance, "businessHours.sourceProvenance");
  const rosterById = new Map(roster.records.map(record => [record.recordId, record]));
  const hoursRecordIds = new Set();
  for (const [index, record] of hours.records.entries()) {
    exactKeys(record, [
      "recordId",
      "territoryId",
      "postalCode",
      "businessTimezone",
      "weeklySchedule",
      "verifiedAt",
      "expiresAt",
      "freshnessState",
      "availabilityStatus",
      "nextOpeningAt",
      "nextClosingAt",
      "providerFailure",
      "rehearsalImmediateRouteEligible"
    ], `businessHours.records[${index}]`);
    const rosterRecord = rosterById.get(record.recordId);
    if (!rosterRecord
      || hoursRecordIds.has(record.recordId)
      || record.territoryId !== rosterRecord.territoryId
      || record.postalCode !== rosterRecord.postalCode
      || record.businessTimezone !== rosterRecord.businessTimezone) {
      fail("route_iq_rehearsal_hours_scope_invalid", "Business hours cross a roster scope.");
    }
    hoursRecordIds.add(record.recordId);
    const verifiedAtMs = record.verifiedAt === null ? null : Date.parse(record.verifiedAt);
    const expiresAtMs = record.expiresAt === null ? null : Date.parse(record.expiresAt);
    if ((record.verifiedAt !== null && !validTimestamp(record.verifiedAt))
      || (record.expiresAt !== null && !validTimestamp(record.expiresAt))
      || (verifiedAtMs !== null
        && (expiresAtMs === null
          || expiresAtMs <= verifiedAtMs
          || expiresAtMs - verifiedAtMs > 24 * 60 * 60 * 1000))) {
      fail("route_iq_rehearsal_hours_freshness_invalid", "Business hours exceed the governed freshness ceiling.");
    }
    const eligible = record.rehearsalImmediateRouteEligible === true;
    if (eligible && (record.freshnessState !== "FRESH"
      || record.availabilityStatus !== "OPEN_VERIFIED"
      || record.providerFailure !== false)) {
      fail("route_iq_rehearsal_hours_fail_closed_invalid", "Unverified hours became rehearsal route eligible.");
    }
    if (record.freshnessState !== "FRESH" && eligible
      || record.providerFailure === true && eligible
      || record.availabilityStatus !== "OPEN_VERIFIED" && eligible) {
      fail("route_iq_rehearsal_hours_fail_closed_invalid", "Business-hours admission did not fail closed.");
    }
  }
  if (hoursRecordIds.size !== rosterById.size) {
    fail("route_iq_rehearsal_hours_count_invalid", "Business hours do not cover the exact rehearsal roster.");
  }
}

function validateTerritories(manifest, roster) {
  if (!Array.isArray(manifest.territoryAssignments)
    || manifest.territoryAssignments.length < 1) {
    fail("route_iq_rehearsal_territory_invalid", "Rehearsal territory assignments are unavailable.");
  }
  const territoryPostalCodes = new Map();
  for (const [index, assignment] of manifest.territoryAssignments.entries()) {
    exactKeys(assignment, ["territoryId", "postalCodes"], `territoryAssignments[${index}]`);
    if (!ID_PATTERN.test(assignment.territoryId || "")
      || !Array.isArray(assignment.postalCodes)
      || assignment.postalCodes.length < 1
      || assignment.postalCodes.some(postalCode => !POSTAL_CODE_PATTERN.test(postalCode))
      || new Set(assignment.postalCodes).size !== assignment.postalCodes.length
      || territoryPostalCodes.has(assignment.territoryId)) {
      fail("route_iq_rehearsal_territory_invalid", "A rehearsal territory assignment is invalid.");
    }
    territoryPostalCodes.set(assignment.territoryId, new Set(assignment.postalCodes));
  }
  if (roster.records.some(record => !territoryPostalCodes.get(record.territoryId)?.has(record.postalCode))) {
    fail("route_iq_rehearsal_territory_scope_invalid", "A roster record is outside its territory ZIP assignment.");
  }
}

function verifyCanonicalProductionBaseline(repoRoot, baseline, rehearsalWorkspaceId) {
  exactKeys(baseline, [
    "manifestRegistryPath",
    "manifestRegistrySha256",
    "runtimePoolManifestPath",
    "runtimePoolManifestSha256",
    "activePoolPath",
    "activePoolSha256",
    "reservePoolPath",
    "reservePoolSha256",
    "quarantinePoolPath",
    "quarantinePoolSha256",
    "counts"
  ], "canonicalProductionBaseline");
  exactKeys(baseline.counts, ["active", "reserve", "quarantine"], "canonicalProductionBaseline.counts");
  if (baseline.counts.active !== 0
    || baseline.counts.reserve !== 0
    || baseline.counts.quarantine !== 398) {
    fail("route_iq_rehearsal_production_counts_invalid", "The canonical production count boundary changed.");
  }
  const paths = [
    ["manifestRegistryPath", "manifestRegistrySha256"],
    ["runtimePoolManifestPath", "runtimePoolManifestSha256"],
    ["activePoolPath", "activePoolSha256"],
    ["reservePoolPath", "reservePoolSha256"],
    ["quarantinePoolPath", "quarantinePoolSha256"]
  ];
  const payloads = {};
  for (const [pathKey, hashKey] of paths) {
    const path = baseline[pathKey];
    if (typeof path !== "string"
      || path.startsWith(REHEARSAL_PATH_PREFIX)
      || path.includes("..")
      || !SHA256_PATTERN.test(baseline[hashKey] || "")) {
      fail("route_iq_rehearsal_production_baseline_invalid", "A canonical baseline reference is invalid.");
    }
    const bytes = readFileSync(resolve(repoRoot, path));
    if (sha256(bytes) !== baseline[hashKey]) {
      fail("route_iq_rehearsal_production_baseline_drift", "A canonical production Data artifact changed.");
    }
    payloads[pathKey] = JSON.parse(bytes.toString("utf8"));
  }
  const poolManifest = payloads.runtimePoolManifestPath;
  if (poolManifest.counts?.active !== 0
    || poolManifest.counts?.reserve !== 0
    || poolManifest.counts?.quarantine !== 398
    || payloads.activePoolPath.count !== 0
    || payloads.reservePoolPath.count !== 0
    || payloads.quarantinePoolPath.count !== 398) {
    fail("route_iq_rehearsal_production_counts_invalid", "Canonical production pools are not exactly 0/0/398.");
  }
  const canonicalRegistry = payloads.manifestRegistryPath;
  if (canonicalRegistry.manifests?.some(manifest => manifest.workspaceId === rehearsalWorkspaceId)
    || JSON.stringify(canonicalRegistry).includes(REHEARSAL_PATH_PREFIX)) {
    fail("route_iq_rehearsal_canonical_admission_detected", "Rehearsal evidence entered the canonical manifest registry.");
  }
}

export function validateRouteIq72HourOnboardingRehearsal(
  registry,
  { repoRoot = defaultRepoRoot } = {}
) {
  exactKeys(registry, [
    "schemaVersion",
    "registryVersion",
    "ownerSubsystem",
    "rehearsalId",
    "generatedAt",
    "classification",
    "canonicalProductionAdmissionAllowed",
    "fallbackPolicy",
    "administrationAuthority",
    "canonicalProductionBaseline",
    "retryPolicy",
    "manifests"
  ], "registry");
  if (registry.schemaVersion !== "route-iq-72-hour-onboarding-rehearsal-manifest-registry-v1"
    || registry.registryVersion !== "route-iq-72-hour-onboarding-rehearsal-manifest-registry-v1"
    || registry.ownerSubsystem !== "Prometheus Data"
    || registry.rehearsalId !== routeIq72HourOnboardingRehearsalId
    || registry.classification !== routeIq72HourOnboardingRehearsalClassification
    || registry.canonicalProductionAdmissionAllowed !== false
    || registry.fallbackPolicy !== routeIq72HourOnboardingRehearsalFallbackPolicy
    || !validTimestamp(registry.generatedAt)
    || !Array.isArray(registry.manifests)
    || registry.manifests.length !== 1) {
    fail("route_iq_rehearsal_registry_invalid", "The rehearsal registry is invalid.");
  }
  exactKeys(registry.retryPolicy, [
    "mode",
    "idempotencyKey",
    "externalSideEffectsAllowed"
  ], "registry.retryPolicy");
  if (registry.retryPolicy.mode !== "DETERMINISTIC_IDEMPOTENT_NO_WRITE"
    || !ID_PATTERN.test(registry.retryPolicy.idempotencyKey || "")
    || registry.retryPolicy.externalSideEffectsAllowed !== false) {
    fail("route_iq_rehearsal_retry_policy_invalid", "The rehearsal retry policy is invalid.");
  }
  const manifest = registry.manifests[0];
  exactKeys(manifest, [
    "ownerSubsystem",
    "manifestId",
    "manifestVersion",
    "workspaceId",
    "companyId",
    "operatingProfileId",
    "configurationVersion",
    "classification",
    "approvalState",
    "productionUseAuthorized",
    "canonicalManifestAdmissionAllowed",
    "runtimeAssetGenerationAuthorized",
    "rosterPath",
    "rosterSha256",
    "businessHoursPath",
    "businessHoursSha256",
    "recordIdentityField",
    "recordCount",
    "approvedRecordCount",
    "approvedRecordIds",
    "territoryAssignments",
    "hoursPolicy",
    "sourceProvenance"
  ], "registry.manifests[0]");
  if (manifest.ownerSubsystem !== "Prometheus Data"
    || manifest.manifestId !== "summit_rehearsal_synthetic_approved_business_roster"
    || manifest.manifestVersion !== "route-iq-72-hour-onboarding-rehearsal-manifest-v1"
    || !ID_PATTERN.test(manifest.workspaceId || "")
    || !ID_PATTERN.test(manifest.companyId || "")
    || manifest.operatingProfileId !== "general_outside_sales"
    || manifest.configurationVersion !== registry.administrationAuthority.fixtureVersion
    || manifest.classification !== routeIq72HourOnboardingRehearsalClassification
    || manifest.approvalState !== "APPROVED_SYNTHETIC_REHEARSAL_ONLY"
    || manifest.productionUseAuthorized !== false
    || manifest.canonicalManifestAdmissionAllowed !== false
    || manifest.runtimeAssetGenerationAuthorized !== true
    || manifest.recordIdentityField !== "recordId"
    || manifest.recordCount !== 4
    || manifest.approvedRecordCount !== 4
    || !Array.isArray(manifest.approvedRecordIds)
    || new Set(manifest.approvedRecordIds).size !== 4) {
    fail("route_iq_rehearsal_manifest_invalid", "The rehearsal manifest is invalid.");
  }
  exactKeys(manifest.hoursPolicy, [
    "maximumAgeHours",
    "freshOpenMayBeRehearsalEligible",
    "closedRouteEligible",
    "staleRouteEligible",
    "missingRouteEligible",
    "invalidRouteEligible",
    "providerFailureRouteEligible"
  ], "registry.manifests[0].hoursPolicy");
  if (manifest.hoursPolicy.maximumAgeHours !== 24
    || manifest.hoursPolicy.freshOpenMayBeRehearsalEligible !== true
    || manifest.hoursPolicy.closedRouteEligible !== false
    || manifest.hoursPolicy.staleRouteEligible !== false
    || manifest.hoursPolicy.missingRouteEligible !== false
    || manifest.hoursPolicy.invalidRouteEligible !== false
    || manifest.hoursPolicy.providerFailureRouteEligible !== false) {
    fail("route_iq_rehearsal_hours_policy_invalid", "The rehearsal manifest hours policy is invalid.");
  }
  validateProvenance(manifest.sourceProvenance, "registry.manifests[0].sourceProvenance");
  const administrationScope = validateAdministrationAuthority(
    repoRoot,
    registry.administrationAuthority,
    manifest
  );
  const rosterArtifact = readJsonArtifact(
    repoRoot,
    manifest.rosterPath,
    manifest.rosterSha256,
    "registry.manifests[0].rosterPath"
  );
  const hoursArtifact = readJsonArtifact(
    repoRoot,
    manifest.businessHoursPath,
    manifest.businessHoursSha256,
    "registry.manifests[0].businessHoursPath"
  );
  validateRoster(rosterArtifact.payload, {
    ...manifest,
    rehearsalId: registry.rehearsalId
  }, administrationScope);
  validateTerritories(manifest, rosterArtifact.payload);
  validateHours(hoursArtifact.payload, {
    ...manifest,
    rehearsalId: registry.rehearsalId
  }, rosterArtifact.payload);
  verifyCanonicalProductionBaseline(
    repoRoot,
    registry.canonicalProductionBaseline,
    manifest.workspaceId
  );
  return {
    registry: clone(registry),
    manifest: clone(manifest),
    roster: clone(rosterArtifact.payload),
    businessHours: clone(hoursArtifact.payload)
  };
}

export function loadRouteIq72HourOnboardingRehearsal({
  repoRoot = defaultRepoRoot,
  path = defaultRegistryPath
} = {}) {
  const registry = JSON.parse(readFileSync(path, "utf8"));
  return validateRouteIq72HourOnboardingRehearsal(registry, { repoRoot });
}

export function buildRouteIq72HourOnboardingRehearsalRuntimeAssets({
  repoRoot = defaultRepoRoot,
  registry,
  idempotencyKey
} = {}) {
  const validated = registry
    ? validateRouteIq72HourOnboardingRehearsal(registry, { repoRoot })
    : loadRouteIq72HourOnboardingRehearsal({ repoRoot });
  const expectedIdempotencyKey = validated.registry.retryPolicy.idempotencyKey;
  if (idempotencyKey !== undefined && idempotencyKey !== expectedIdempotencyKey) {
    fail("route_iq_rehearsal_idempotency_key_invalid", "The rehearsal retry key does not match.");
  }
  const runtime = {
    schemaVersion: "route-iq-72-hour-onboarding-rehearsal-runtime-assets-v1",
    rehearsalId: validated.registry.rehearsalId,
    classification: routeIq72HourOnboardingRehearsalClassification,
    productionUseAuthorized: false,
    canonicalManifestAdmissionAllowed: false,
    generatedAt: validated.registry.generatedAt,
    idempotencyKey: expectedIdempotencyKey,
    workspaceId: validated.manifest.workspaceId,
    companyId: validated.manifest.companyId,
    operatingProfileId: validated.manifest.operatingProfileId,
    assets: {
      businessManifestRegistry: validated.registry,
      businessRoster: validated.roster,
      businessHours: validated.businessHours
    }
  };
  return {
    ...runtime,
    integrity: {
      manifestRegistrySha256: sha256(stableRouteIq72HourOnboardingJson(validated.registry)),
      rosterSha256: validated.manifest.rosterSha256,
      businessHoursSha256: validated.manifest.businessHoursSha256,
      runtimeBundleSha256: sha256(stableRouteIq72HourOnboardingJson(runtime))
    }
  };
}
