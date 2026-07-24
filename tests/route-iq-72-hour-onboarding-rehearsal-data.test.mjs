import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";

import {
  buildRouteIq72HourOnboardingRehearsalRuntimeAssets,
  loadRouteIq72HourOnboardingRehearsal,
  routeIq72HourOnboardingAdministrationConfigurationPath,
  routeIq72HourOnboardingRehearsalClassification,
  stableRouteIq72HourOnboardingJson,
  validateRouteIq72HourOnboardingRehearsal
} from "../data/route-iq-72-hour-onboarding-rehearsal-v1/route-iq-72-hour-onboarding-rehearsal.mjs";

const repoRoot = resolve(import.meta.dirname, "..");
const rehearsalRegistryPath = "data/route-iq-72-hour-onboarding-rehearsal-v1/"
  + "route-iq-72-hour-onboarding-rehearsal-manifest-registry-v1.json";
const administrationFixture = readJson(
  routeIq72HourOnboardingAdministrationConfigurationPath
);
const canonicalPaths = Object.freeze([
  "data/route-iq-commercial-readiness-v1/"
    + "route-iq-workspace-business-artifact-manifest-registry-v1.json",
  "data/qualified-prospects/google-qualified-businesses-v2/"
    + "runtime-pool-segmentation-v1/runtime-pool-manifest.json",
  "data/qualified-prospects/google-qualified-businesses-v2/"
    + "runtime-pool-segmentation-v1/active-pool.json",
  "data/qualified-prospects/google-qualified-businesses-v2/"
    + "runtime-pool-segmentation-v1/reserve-pool.json",
  "data/qualified-prospects/google-qualified-businesses-v2/"
    + "runtime-pool-segmentation-v1/quarantine-pool.json"
]);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function readJson(path, root = repoRoot) {
  return JSON.parse(readFileSync(resolve(root, path), "utf8"));
}

function clone(value) {
  return structuredClone(value);
}

function copyToRoot(sourceRoot, targetRoot, path) {
  const target = resolve(targetRoot, path);
  mkdirSync(dirname(target), { recursive: true });
  cpSync(resolve(sourceRoot, path), target);
}

function isolatedFixture({ mutateRegistry, mutateRoster, mutateHours } = {}) {
  const root = mkdtempSync(join(tmpdir(), "route-iq-72-hour-onboarding-data-"));
  const registry = readJson(rehearsalRegistryPath);
  const manifest = registry.manifests[0];
  const roster = readJson(manifest.rosterPath);
  const hours = readJson(manifest.businessHoursPath);
  mutateRoster?.(roster);
  mutateHours?.(hours);
  const rosterBytes = Buffer.from(stableRouteIq72HourOnboardingJson(roster));
  const hoursBytes = Buffer.from(stableRouteIq72HourOnboardingJson(hours));
  manifest.rosterSha256 = sha256(rosterBytes);
  manifest.businessHoursSha256 = sha256(hoursBytes);
  mutateRegistry?.(registry);

  for (const path of canonicalPaths) copyToRoot(repoRoot, root, path);
  copyToRoot(repoRoot, root, routeIq72HourOnboardingAdministrationConfigurationPath);
  for (const [path, bytes] of [
    [manifest.rosterPath, rosterBytes],
    [manifest.businessHoursPath, hoursBytes]
  ]) {
    const target = resolve(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, bytes);
  }
  return { registry, root };
}

test("rehearsal roster is isolated and exactly bound to the Administration Summit configuration", () => {
  const rehearsal = loadRouteIq72HourOnboardingRehearsal({ repoRoot });
  const configuration = administrationFixture.workspaceConfiguration;
  const opportunitySource = configuration.opportunitySources[0];
  const territory = configuration.territories[0];
  assert.equal(rehearsal.registry.classification, routeIq72HourOnboardingRehearsalClassification);
  assert.equal(rehearsal.registry.ownerSubsystem, "Prometheus Data");
  assert.equal(rehearsal.registry.canonicalProductionAdmissionAllowed, false);
  assert.equal(rehearsal.manifest.productionUseAuthorized, false);
  assert.equal(rehearsal.manifest.canonicalManifestAdmissionAllowed, false);
  assert.equal(rehearsal.manifest.runtimeAssetGenerationAuthorized, true);
  assert.equal(rehearsal.manifest.workspaceId, configuration.workspaceId);
  assert.equal(rehearsal.manifest.companyId, configuration.companyId);
  assert.equal(rehearsal.manifest.operatingProfileId, configuration.operatingProfile.profileId);
  assert.equal(rehearsal.manifest.manifestId, opportunitySource.manifestId);
  assert.equal(rehearsal.manifest.configurationVersion, administrationFixture.fixtureVersion);
  assert.equal(rehearsal.roster.recordCount, 4);
  assert.deepEqual(
    new Set(rehearsal.roster.records.map(record => record.postalCode)),
    new Set(territory.zipCoverage.postalCodes)
  );
  assert.deepEqual(
    new Set(rehearsal.roster.records.map(record => record.territoryId)),
    new Set([territory.territoryId])
  );
  assert.deepEqual(
    new Set(rehearsal.roster.records.map(record => record.locationId)),
    new Set(configuration.locations.map(location => location.locationId))
  );
  assert.equal(
    rehearsal.roster.records.every(record => record.businessName.includes("Synthetic")),
    true
  );
  assert.equal(
    rehearsal.roster.sourceProvenance.sourceSystem,
    "administration_bound_deterministic_rehearsal_fixture"
  );
});

test("runtime asset generation and retries are deterministic and side-effect free", () => {
  const canonicalBefore = new Map(canonicalPaths.map(path => [
    path,
    readFileSync(resolve(repoRoot, path))
  ]));
  const first = buildRouteIq72HourOnboardingRehearsalRuntimeAssets({ repoRoot });
  const second = buildRouteIq72HourOnboardingRehearsalRuntimeAssets({
    repoRoot,
    idempotencyKey: first.idempotencyKey
  });
  assert.equal(stableRouteIq72HourOnboardingJson(first), stableRouteIq72HourOnboardingJson(second));
  assert.equal(first.integrity.runtimeBundleSha256, second.integrity.runtimeBundleSha256);
  assert.equal(first.productionUseAuthorized, false);
  assert.equal(first.canonicalManifestAdmissionAllowed, false);
  assert.equal(first.assets.businessRoster.recordCount, 4);
  assert.equal(first.assets.businessHours.recordCount, 4);
  assert.throws(
    () => buildRouteIq72HourOnboardingRehearsalRuntimeAssets({
      repoRoot,
      idempotencyKey: "route_iq_wrong_rehearsal_retry"
    }),
    error => error.code === "route_iq_rehearsal_idempotency_key_invalid"
  );
  for (const [path, bytes] of canonicalBefore) {
    assert.deepEqual(readFileSync(resolve(repoRoot, path)), bytes);
  }
});

test("canonical production Data remains exactly active 0, reserve 0, quarantine 398", () => {
  const rehearsal = loadRouteIq72HourOnboardingRehearsal({ repoRoot });
  const baseline = rehearsal.registry.canonicalProductionBaseline;
  assert.deepEqual(baseline.counts, { active: 0, reserve: 0, quarantine: 398 });
  const poolManifest = readJson(baseline.runtimePoolManifestPath);
  const active = readJson(baseline.activePoolPath);
  const reserve = readJson(baseline.reservePoolPath);
  const quarantine = readJson(baseline.quarantinePoolPath);
  assert.deepEqual(poolManifest.counts, { active: 0, reserve: 0, quarantine: 398 });
  assert.equal(active.count, 0);
  assert.equal(active.records.length, 0);
  assert.equal(reserve.count, 0);
  assert.equal(reserve.records.length, 0);
  assert.equal(quarantine.count, 398);
  assert.equal(quarantine.records.length, 398);

  const canonicalRegistry = readJson(baseline.manifestRegistryPath);
  assert.equal(canonicalRegistry.manifests.some(
    manifest => manifest.workspaceId === rehearsal.manifest.workspaceId
  ), false);
  assert.equal(JSON.stringify(canonicalRegistry).includes("route-iq-72-hour-onboarding"), false);
});

test("stale, missing, provider-failed, and closed rehearsal hours fail route admission", () => {
  const rehearsal = loadRouteIq72HourOnboardingRehearsal({ repoRoot });
  const records = rehearsal.businessHours.records;
  assert.equal(records.find(record => record.availabilityStatus === "OPEN_VERIFIED")
    .rehearsalImmediateRouteEligible, true);
  for (const status of ["CLOSED_VERIFIED", "HOURS_STALE", "HOURS_UNKNOWN"]) {
    assert.equal(records.find(record => record.availabilityStatus === status)
      .rehearsalImmediateRouteEligible, false);
  }
  assert.equal(records.find(record => record.providerFailure)
    .rehearsalImmediateRouteEligible, false);

  const staleEligible = isolatedFixture({
    mutateHours(hours) {
      hours.records.find(record => record.freshnessState === "HOURS_STALE")
        .rehearsalImmediateRouteEligible = true;
    }
  });
  assert.throws(
    () => validateRouteIq72HourOnboardingRehearsal(
      staleEligible.registry,
      { repoRoot: staleEligible.root }
    ),
    error => error.code === "route_iq_rehearsal_hours_fail_closed_invalid"
  );

  const providerFailureEligible = isolatedFixture({
    mutateHours(hours) {
      hours.records.find(record => record.providerFailure)
        .rehearsalImmediateRouteEligible = true;
    }
  });
  assert.throws(
    () => validateRouteIq72HourOnboardingRehearsal(
      providerFailureEligible.registry,
      { repoRoot: providerFailureEligible.root }
    ),
    error => error.code === "route_iq_rehearsal_hours_fail_closed_invalid"
  );
});

test("territory drift, production admission, and immutable artifact drift fail closed", () => {
  const territoryDrift = isolatedFixture({
    mutateRoster(roster) {
      roster.records[0].postalCode = "77003";
    }
  });
  assert.throws(
    () => validateRouteIq72HourOnboardingRehearsal(
      territoryDrift.registry,
      { repoRoot: territoryDrift.root }
    ),
    error => error.code === "route_iq_rehearsal_territory_scope_invalid"
  );

  const productionAdmission = readJson(rehearsalRegistryPath);
  productionAdmission.manifests[0].productionUseAuthorized = true;
  assert.throws(
    () => validateRouteIq72HourOnboardingRehearsal(productionAdmission, { repoRoot }),
    error => error.code === "route_iq_rehearsal_manifest_invalid"
  );

  const hashDrift = readJson(rehearsalRegistryPath);
  hashDrift.manifests[0].rosterSha256 = "0".repeat(64);
  assert.throws(
    () => validateRouteIq72HourOnboardingRehearsal(hashDrift, { repoRoot }),
    error => error.code === "route_iq_rehearsal_artifact_hash_mismatch"
  );

  const productionArtifactDrift = isolatedFixture();
  const activePoolPath = canonicalPaths.find(path => path.endsWith("/active-pool.json"));
  const activePool = readJson(activePoolPath, productionArtifactDrift.root);
  activePool.generatedAt = "2026-07-23T12:00:01.000Z";
  writeFileSync(
    resolve(productionArtifactDrift.root, activePoolPath),
    stableRouteIq72HourOnboardingJson(activePool)
  );
  assert.throws(
    () => validateRouteIq72HourOnboardingRehearsal(
      productionArtifactDrift.registry,
      { repoRoot: productionArtifactDrift.root }
    ),
    error => error.code === "route_iq_rehearsal_production_baseline_drift"
  );
});

test("Administration identity or ZIP drift fails closed without production admission", () => {
  const authorityDrift = isolatedFixture();
  const authorityPath = resolve(
    authorityDrift.root,
    routeIq72HourOnboardingAdministrationConfigurationPath
  );
  const fixture = JSON.parse(readFileSync(authorityPath, "utf8"));
  fixture.workspaceConfiguration.territories[0].zipCoverage.postalCodes.push("75203");
  writeFileSync(authorityPath, stableRouteIq72HourOnboardingJson(fixture));
  assert.throws(
    () => validateRouteIq72HourOnboardingRehearsal(
      authorityDrift.registry,
      { repoRoot: authorityDrift.root }
    ),
    error => error.code === "route_iq_rehearsal_administration_authority_drift"
  );

  const crossWorkspace = isolatedFixture({
    mutateRegistry(registry) {
      registry.manifests[0].workspaceId = "unapproved_rehearsal_workspace";
    }
  });
  assert.throws(
    () => validateRouteIq72HourOnboardingRehearsal(
      crossWorkspace.registry,
      { repoRoot: crossWorkspace.root }
    ),
    error => [
      "route_iq_rehearsal_administration_scope_mismatch",
      "route_iq_rehearsal_roster_invalid"
    ].includes(error.code)
  );

  const rehearsal = loadRouteIq72HourOnboardingRehearsal({ repoRoot });
  assert.deepEqual(
    rehearsal.registry.canonicalProductionBaseline.counts,
    { active: 0, reserve: 0, quarantine: 398 }
  );
  assert.equal(rehearsal.registry.canonicalProductionAdmissionAllowed, false);
});
