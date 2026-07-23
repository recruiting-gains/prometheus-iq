import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";

import {
  authorizeConfiguredUserFromRegistry,
  validateRouteIqWorkspaceConfigurationRegistry
} from "../administration/contracts/route-iq-workspace-configuration-v2-validation.mjs";
import {
  validateWorkspaceBusinessArtifactManifestRegistry
} from "../data/route-iq-commercial-readiness-v1/route-iq-workspace-business-artifact-manifest.mjs";

const paths = Object.freeze({
  registry: "overwatch/artifact-contracts/canonical-artifact-registry.json",
  complianceAudit: "overwatch/artifact-contracts/subsystem-workspace-compliance-audit-v1.json",
  configuration: "administration/workspace-configurations/route-iq-cross-industry-workspaces-v2.json",
  manifestRegistry: "data/route-iq-commercial-readiness-v1/route-iq-workspace-business-artifact-manifest-registry-v1.json",
  approvedRoster: "data/qualified-prospects/google-qualified-businesses-v2/google-qualified-businesses-v2.json",
  businessHours: "data/qualified-prospects/google-qualified-businesses-v2/business-hours-v1/business-hours.json",
  activePool: "data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/active-pool.json",
  reservePool: "data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/reserve-pool.json",
  quarantinePool: "data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/quarantine-pool.json",
  poolManifest: "data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/runtime-pool-manifest.json",
  dashboard: "index.html",
  dashboardModule: "dashboard/route-iq-dashboard-platform.mjs",
  serviceWorker: "sw.js",
  deployDashboard: "deploy/cloudflare-pages/index.html",
  deployDashboardModule: "deploy/cloudflare-pages/dashboard/route-iq-dashboard-platform.mjs",
  deployServiceWorker: "deploy/cloudflare-pages/sw.js",
  eligibilityContract: "intelligence/contracts/route-business-hours-eligibility-contracts.json",
  eligibilityRuntime: "intelligence/route-business-hours-eligibility.mjs",
  routeRuntime: "intelligence/continuous-adaptive-route-replenishment.mjs",
  dashboardContract: "overwatch/artifact-contracts/workspaces/fitness-connection/dashboard-consumer-contract-v1.json",
  dataContract: "overwatch/artifact-contracts/workspaces/fitness-connection/route-intelligence-data-contract-v1.json",
  intelligenceContract: "overwatch/artifact-contracts/workspaces/fitness-connection/intelligence-consumer-contract-v1.json"
});

const expectedWorkspaces = Object.freeze([
  Object.freeze({
    workspaceId: "fitness_connection",
    companyId: "fitness_connection_research",
    profileId: "fitness",
    lifecycle: "founder_research"
  }),
  Object.freeze({
    workspaceId: "northstar_outside_sales_synthetic",
    companyId: "northstar_field_supply_company_synthetic",
    profileId: "general_outside_sales",
    lifecycle: "synthetic_validation_only"
  })
]);
const allowedDenyEvidencePath = "tests/cross-subsystem-artifact-contracts.test.mjs";
const deniedDisplayName = Buffer.from("U21vb3RoaWUgRGVwb3Q=", "base64").toString("utf8");
const deniedVariants = Object.freeze([
  deniedDisplayName.toLowerCase(),
  deniedDisplayName.toLowerCase().replaceAll(" ", "-"),
  deniedDisplayName.toLowerCase().replaceAll(" ", "_"),
  deniedDisplayName.toLowerCase().replaceAll(" ", "")
]);

const read = path => fs.readFileSync(path, "utf8");
const readJson = path => JSON.parse(read(path));
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");

function assert(condition, message, failures) {
  if (!condition) failures.push(message);
}

function occurrences(source, value) {
  let count = 0;
  let offset = 0;
  while ((offset = source.indexOf(value, offset)) !== -1) {
    count += 1;
    offset += value.length;
  }
  return count;
}

function currentRepositoryFiles() {
  return execFileSync("/usr/bin/git", [
    "ls-files",
    "--cached",
    "--others",
    "--exclude-standard"
  ], { encoding: "utf8" }).split("\n").filter(Boolean).sort();
}

function validateArtifactRegistry(registry, failures) {
  assert(registry.contractId === "prometheus-cross-subsystem-artifact-contract-v1", "Canonical registry ID drifted.", failures);
  assert(registry.version === "2.0.0", "Canonical registry must use the cross-industry v2 contract.", failures);
  assert(registry.owningSubsystem === "Prometheus Overwatch", "Canonical registry owner drifted.", failures);
  assert(registry.globalRules?.noProductionFixtureOrDemoData === true, "Production fixture/demo prohibition is missing.", failures);
  assert(registry.globalRules?.approvedTenantCompanyBusinessSourceRequired === true, "Approved tenant/company source rule is missing.", failures);
  assert(registry.globalRules?.businessHoursMaximumAgeHours === 24, "Business-hours freshness ceiling must be 24 hours.", failures);
  assert(registry.globalRules?.staleOrUnavailableHoursImmediateRecommendationAllowed === false, "Uncertain hours must not be immediately eligible.", failures);
  assert(registry.globalRules?.operatingHoursAndVisitDurationMustRemainDistinct === true, "Hours and visit duration separation is missing.", failures);
  assert(registry.globalRules?.collection === "OFF", "Collection must remain OFF.", failures);
  assert(registry.globalRules?.activeCohorts === 0, "Active cohorts must remain zero.", failures);
  assert(registry.globalRules?.recommendationInfluence === "OFF", "Recommendation influence must remain OFF.", failures);
  const governanceIds = new Set();
  for (const artifact of registry.governanceArtifacts || []) {
    assert(!governanceIds.has(artifact.artifactId), `Duplicate governance artifact ID: ${artifact.artifactId}`, failures);
    governanceIds.add(artifact.artifactId);
    assert(artifact.ownerSubsystem === "Prometheus Overwatch", `${artifact.artifactId} governance owner drifted.`, failures);
    assert(artifact.writeAllowed?.length === 1 && artifact.writeAllowed[0] === "Prometheus Overwatch", `${artifact.artifactId} governance write boundary drifted.`, failures);
    assert(artifact.productionConsumer === false, `${artifact.artifactId} cannot be a production consumer.`, failures);
    assert(artifact.failClosedIfMissing === true, `${artifact.artifactId} must fail closed if missing.`, failures);
    assert(fs.existsSync(artifact.path), `${artifact.artifactId} governance path is missing.`, failures);
    if (artifact.documentationPath) {
      assert(fs.existsSync(artifact.documentationPath), `${artifact.artifactId} governance documentation is missing.`, failures);
    }
  }
  assert(governanceIds.has("route-iq-cross-industry-dashboard-regression-governance-v1"), "Cross-industry release governance is unregistered.", failures);

  const workspaceIds = registry.workspaces?.map(workspace => workspace.workspaceId) || [];
  assert(JSON.stringify(workspaceIds) === JSON.stringify(expectedWorkspaces.map(workspace => workspace.workspaceId)), "Canonical registry must contain exactly the Founder-research and synthetic outside-sales workspaces.", failures);

  const artifactIds = new Set();
  for (const workspace of registry.workspaces || []) {
    const expected = expectedWorkspaces.find(candidate => candidate.workspaceId === workspace.workspaceId);
    assert(Boolean(expected), `Unexpected workspace registered: ${workspace.workspaceId}`, failures);
    assert(workspace.companyId === expected?.companyId, `${workspace.workspaceId} company binding drifted.`, failures);
    assert(workspace.operatingProfileId === expected?.profileId, `${workspace.workspaceId} profile binding drifted.`, failures);
    assert(workspace.lifecycleState === expected?.lifecycle, `${workspace.workspaceId} lifecycle drifted.`, failures);
    assert(workspace.productionActivationAuthorized === false, `${workspace.workspaceId} must not be production activated by this registry.`, failures);
    assert(workspace.workspaceIsolationRules?.crossWorkspaceDataAllowed === false, `${workspace.workspaceId} cross-workspace isolation is missing.`, failures);
    assert(workspace.workspaceIsolationRules?.crossCompanyDataAllowed === false, `${workspace.workspaceId} cross-company isolation is missing.`, failures);
    assert(workspace.workspaceIsolationRules?.crossProfileDataAllowed === false, `${workspace.workspaceId} cross-profile isolation is missing.`, failures);
    for (const artifact of workspace.canonicalArtifacts || []) {
      assert(!artifactIds.has(artifact.artifactId), `Duplicate artifact ID: ${artifact.artifactId}`, failures);
      artifactIds.add(artifact.artifactId);
      assert(artifact.ownerSubsystem && artifact.writeAllowed?.includes(artifact.ownerSubsystem), `${artifact.artifactId} owner lacks write authority.`, failures);
      assert(artifact.failClosedIfMissing === true, `${artifact.artifactId} must fail closed if missing.`, failures);
      assert(fs.existsSync(artifact.path), `${artifact.artifactId} canonical path is missing: ${artifact.path}`, failures);
      if (workspace.lifecycleState === "synthetic_validation_only") {
        assert(artifact.productionConsumer === false, `${artifact.artifactId} cannot be a production consumer.`, failures);
      }
    }
  }

  for (const artifactId of [
    "fitness_connection_route_business_hours_intelligence_consumer_contract",
    "fitness_connection_route_iq_prospective_retention_policy",
    "fitness_connection_route_iq_collection_activation_governance",
    "fitness_connection_route_iq_collection_activation_batch_record",
    "fitness_connection_release_provenance_repair_mapping",
    "route_iq_cross_industry_administration_configuration",
    "route_iq_workspace_business_manifest_registry"
  ]) {
    assert(artifactIds.has(artifactId), `Required canonical artifact is unregistered: ${artifactId}`, failures);
  }
}

function validateConfigurationAndManifests(configuration, manifestRegistry, failures) {
  try {
    validateRouteIqWorkspaceConfigurationRegistry(configuration);
  } catch (error) {
    failures.push(`Administration configuration rejected: ${error.code || error.message}`);
    return;
  }
  try {
    validateWorkspaceBusinessArtifactManifestRegistry(manifestRegistry, { repoRoot: process.cwd() });
  } catch (error) {
    failures.push(`Data manifest registry rejected: ${error.code || error.message}`);
    return;
  }

  for (const expected of expectedWorkspaces) {
    const workspace = configuration.workspaces.find(candidate => candidate.workspaceId === expected.workspaceId);
    const manifest = manifestRegistry.manifests.find(candidate => candidate.workspaceId === expected.workspaceId);
    assert(workspace?.companyId === expected.companyId, `${expected.workspaceId} configuration company mismatch.`, failures);
    assert(workspace?.operatingProfile.profileId === expected.profileId, `${expected.workspaceId} configuration profile mismatch.`, failures);
    assert(manifest?.operatingProfileId === expected.profileId, `${expected.workspaceId} manifest profile mismatch.`, failures);
    assert(manifest?.demoFallbackAllowed === false, `${expected.workspaceId} demo fallback must be disabled.`, failures);
    assert(manifest?.crossWorkspaceFallbackAllowed === false, `${expected.workspaceId} cross-workspace fallback must be disabled.`, failures);
    assert(manifest?.artifactSha256 === sha256(fs.readFileSync(manifest.artifactPath)), `${expected.workspaceId} approved-roster hash drifted.`, failures);
    assert(workspace?.opportunitySources.length === 1, `${expected.workspaceId} must have exactly one approved source binding.`, failures);
    assert(workspace?.opportunitySources[0].artifactPath === manifest?.artifactPath, `${expected.workspaceId} source path does not match its manifest.`, failures);
    assert(workspace?.opportunitySources[0].manifestId === manifest?.manifestId, `${expected.workspaceId} source manifest ID drifted.`, failures);
  }

  const fitness = configuration.workspaces.find(workspace => workspace.workspaceId === "fitness_connection");
  const founder = fitness?.users.find(user => user.userId === "user_cruz_founder");
  const role = fitness?.roles.find(candidate => candidate.roleId === founder?.roleId);
  assert(founder?.identityClass === "FOUNDER_ATTENDED", "Founder identity boundary drifted.", failures);
  assert(configuration.founderBoundary?.anthonyMappingStatus === "UNMAPPED", "Anthony must remain unmapped.", failures);
  assert(role?.capabilities.includes("view_founder_read_only_intelligence"), "Founder role lost read-only intelligence access.", failures);
  try {
    const authorized = authorizeConfiguredUserFromRegistry({
      workspaceId: fitness.workspaceId,
      operatingProfileId: fitness.operatingProfile.profileId,
      userId: founder.userId,
      roleId: founder.roleId,
      territoryId: founder.territoryIds[0]
    }, configuration);
    assert(authorized.authorized === true, "Configured Founder user was not authorized.", failures);
    assert(authorized.roleId === role.roleId, "Authorized role projection drifted.", failures);
  } catch (error) {
    failures.push(`Configured-user authorization rejected: ${error.code || error.message}`);
  }
}

function validateDataAndEligibility(configuration, failures) {
  const hours = readJson(paths.businessHours);
  const active = readJson(paths.activePool);
  const reserve = readJson(paths.reservePool);
  const quarantine = readJson(paths.quarantinePool);
  const poolManifest = readJson(paths.poolManifest);
  const eligibility = readJson(paths.eligibilityContract);
  const fitness = configuration.workspaces.find(workspace => workspace.workspaceId === "fitness_connection");

  assert(hours.workspaceId === fitness.workspaceId && hours.operatingProfileId === fitness.operatingProfile.profileId, "Business-hours artifact scope drifted.", failures);
  assert(hours.recordCount === 398 && hours.records?.length === 398, "Business-hours record count drifted.", failures);
  assert(hours.freshnessPolicy?.freshnessThresholdHours === 24, "Business-hours artifact freshness ceiling must be 24 hours.", failures);
  assert(hours.routeEligibilityActivated === false, "Business-hours artifact must not activate routing.", failures);
  const availabilityCounts = hours.records.reduce((counts, record) => {
    counts[record.currentOpenClosedEligibilityStatus] = (counts[record.currentOpenClosedEligibilityStatus] || 0) + 1;
    return counts;
  }, {});
  assert(availabilityCounts.HOURS_STALE === 353, "Expected 353 stale hours records.", failures);
  assert(availabilityCounts.HOURS_UNKNOWN === 45, "Expected 45 unavailable hours records.", failures);
  assert(hours.records.every(record => record.activePoolMember === false), "Stale/unavailable hours leaked into the active pool.", failures);
  assert(active.count === 0 && active.records?.length === 0, "Active pool must fail closed at zero.", failures);
  assert(reserve.count === 0 && reserve.records?.length === 0, "Reserve pool must fail closed at zero.", failures);
  assert(quarantine.count === 398 && quarantine.records?.length === 398, "Every unverified record must remain quarantined.", failures);
  assert(poolManifest.counts?.active === 0 && poolManifest.counts?.reserve === 0 && poolManifest.counts?.quarantine === 398, "Runtime-pool manifest counts drifted.", failures);
  assert(eligibility.version === "route-iq-business-hours-eligibility-contracts-v2", "Business-hours contract must use v2.", failures);
  for (const state of ["CLOSED_VERIFIED", "HOURS_STALE", "HOURS_UNKNOWN", "SPECIAL_HOURS_UNVERIFIED", "PROVIDER_FAILURE", "INVALID"]) {
    assert(eligibility.eligibilityPolicy?.[state]?.immediateRecommendationEligible === false, `${state} became immediately route eligible.`, failures);
  }
  assert(eligibility.presentationContract?.visitDurationSeparate === true, "Intelligence contract conflates visit duration and operating hours.", failures);
  assert(eligibility.safety?.liveProviderCalls === false, "Live provider calls were activated.", failures);
}

function validateConsumerContracts(failures) {
  const dashboard = readJson(paths.dashboardContract);
  const data = readJson(paths.dataContract);
  const intelligence = readJson(paths.intelligenceContract);
  assert(dashboard.runtimeAssetKeys?.join(",") === "workspaceConfiguration,businessManifestRegistry,businessRoster,businessHours", "Dashboard runtime asset contract drifted.", failures);
  assert(dashboard.admissionRules?.unknownConfigurationFieldsRejected === true, "Dashboard must reject unknown configuration fields.", failures);
  assert(dashboard.roleBoundary?.configuredRoleCapabilityRequired === true, "Dashboard role capability enforcement is missing.", failures);
  assert(dashboard.presentationRules?.operatingHoursAndVisitDurationSeparate === true, "Dashboard hours/duration separation is missing.", failures);
  assert(data.currentFailClosedState?.activePoolCount === 0 && data.currentFailClosedState?.reservePoolCount === 0 && data.currentFailClosedState?.quarantinePoolCount === 398, "Data fail-closed pool state drifted.", failures);
  assert(data.freshnessRules?.maximumAgeHours === 24, "Data freshness ceiling drifted.", failures);
  assert(intelligence.admissionRules?.legacyVersionAccepted === false, "Intelligence accepts a superseded eligibility contract.", failures);
  assert(intelligence.eligibilityRules?.staleMissingInvalidOrProviderFailureImmediateEligible === false, "Intelligence admits uncertain hours.", failures);
  assert(intelligence.safety?.recommendationInfluence === "OFF", "Intelligence recommendation influence changed.", failures);
}

function validateSourceDeployParity(failures) {
  for (const [source, deploy] of [
    [paths.dashboard, paths.deployDashboard],
    [paths.dashboardModule, paths.deployDashboardModule],
    [paths.serviceWorker, paths.deployServiceWorker]
  ]) {
    assert(fs.existsSync(deploy), `Deploy mirror is missing: ${deploy}`, failures);
    if (fs.existsSync(deploy)) {
      assert(Buffer.compare(fs.readFileSync(source), fs.readFileSync(deploy)) === 0, `Source/deploy parity drifted: ${source}`, failures);
    }
  }
}

function validateRepositoryDenyBoundary(failures) {
  const files = currentRepositoryFiles();
  let exactDisplayOccurrences = 0;
  for (const path of files) {
    const lowerPath = path.toLowerCase();
    for (const variant of deniedVariants.slice(1)) {
      if (lowerPath.includes(variant) && path !== allowedDenyEvidencePath) {
        failures.push(`Retired customer path remains: ${path}`);
      }
    }
    if (!fs.existsSync(path) || fs.statSync(path).isDirectory()) continue;
    let source;
    try {
      source = read(path);
    } catch {
      continue;
    }
    const lower = source.toLowerCase();
    exactDisplayOccurrences += occurrences(lower, deniedVariants[0]);
    if (path !== allowedDenyEvidencePath) {
      for (const variant of deniedVariants) {
        if (lower.includes(variant)) {
          failures.push(`Retired customer identity remains outside the negative gate: ${path}`);
          break;
        }
      }
    }
  }
  assert(exactDisplayOccurrences === 1, "Exactly one nondeployable negative-test display-name reference is required.", failures);
}

export function verifyCrossSubsystemArtifactContracts() {
  const failures = [];
  const registry = readJson(paths.registry);
  const complianceAudit = readJson(paths.complianceAudit);
  const configuration = readJson(paths.configuration);
  const manifestRegistry = readJson(paths.manifestRegistry);

  validateArtifactRegistry(registry, failures);
  validateConfigurationAndManifests(configuration, manifestRegistry, failures);
  validateDataAndEligibility(configuration, failures);
  validateConsumerContracts(failures);
  validateSourceDeployParity(failures);
  validateRepositoryDenyBoundary(failures);

  assert(complianceAudit.status === "active_cross_industry_contract_compliant", "Compliance audit is not current.", failures);
  assert(complianceAudit.featureWorkGate?.enabled === true, "Feature-work compliance gate is disabled.", failures);
  assert(complianceAudit.summary?.criticalRemediationOwners?.length === 0, "Compliance audit has unresolved critical owners.", failures);

  return Object.freeze({
    ok: failures.length === 0,
    failures: Object.freeze(failures),
    registry,
    complianceAudit,
    configurationSha256: sha256(read(paths.configuration)),
    manifestRegistrySha256: sha256(read(paths.manifestRegistry)),
    businessHoursSha256: sha256(read(paths.businessHours)),
    workspaces: Object.freeze(expectedWorkspaces.map(workspace => workspace.workspaceId)),
    dataState: Object.freeze({ active: 0, reserve: 0, quarantine: 398 }),
    collection: "OFF",
    activeCohorts: 0,
    recommendationInfluence: "OFF"
  });
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const result = verifyCrossSubsystemArtifactContracts();
  if (!result.ok) {
    console.error(result.failures.join("\n"));
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify({
      status: "PASS",
      workspaces: result.workspaces,
      configurationSha256: result.configurationSha256,
      manifestRegistrySha256: result.manifestRegistrySha256,
      businessHoursSha256: result.businessHoursSha256,
      dataState: result.dataState,
      collection: result.collection,
      activeCohorts: result.activeCohorts,
      recommendationInfluence: result.recommendationInfluence
    }, null, 2));
  }
}
