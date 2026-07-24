import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  formatAvailabilityLabel,
  formatEstimatedVisitDuration,
  projectApprovedRoster,
  projectDashboardTerritoryZipCoverage,
  routeIqDashboardRuntimeAssetKeys
} from "../dashboard/route-iq-dashboard-platform.mjs";

const readJson = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const administrationPath = "administration/workspace-configurations/route-iq-72-hour-onboarding-rehearsal-v1.json";
const manifestPath = "data/route-iq-72-hour-onboarding-rehearsal-v1/route-iq-72-hour-onboarding-rehearsal-manifest-registry-v1.json";
const rosterPath = "data/route-iq-72-hour-onboarding-rehearsal-v1/route-iq-72-hour-onboarding-rehearsal-approved-business-roster-v1.json";
const hoursPath = "data/route-iq-72-hour-onboarding-rehearsal-v1/route-iq-72-hour-onboarding-rehearsal-business-hours-v1.json";

const administration = readJson(administrationPath);
const dataRegistry = readJson(manifestPath);
const roster = readJson(rosterPath);
const hours = readJson(hoursPath);
const workspace = administration.workspaceConfiguration;
const representative = workspace.users.find(user => user.userId === "summit_rehearsal_rep_01");
const sourceManifest = dataRegistry.manifests[0];
const dashboardManifest = {
  ...sourceManifest,
  manifestVersion: "route-iq-workspace-business-artifact-manifest-v1",
  configurationVersion: workspace.provenance.configurationVersion,
  classification: "SYNTHETIC_NONCANONICAL",
  approvalState: "APPROVED_SYNTHETIC_VALIDATION",
  artifactPath: rosterPath,
  artifactSha256: sourceManifest.rosterSha256,
  demoFallbackAllowed: false,
  crossWorkspaceFallbackAllowed: false,
  freshness: {
    maximumAgeHours: 24,
    evaluatedAt: dataRegistry.generatedAt,
    expiresAt: "2026-07-24T12:00:00.000Z",
    state: "SYNTHETIC"
  }
};

test("Summit rehearsal binds the exact four generic Dashboard runtime assets", () => {
  const runtimeAssets = {
    workspaceConfiguration: `/${administrationPath}`,
    businessManifestRegistry: `/${manifestPath}`,
    businessRoster: `/${rosterPath}`,
    businessHours: `/${hoursPath}`
  };
  assert.deepEqual(routeIqDashboardRuntimeAssetKeys, [
    "workspaceConfiguration",
    "businessManifestRegistry",
    "businessRoster",
    "businessHours"
  ]);
  assert.deepEqual(Object.keys(runtimeAssets), routeIqDashboardRuntimeAssetKeys);
  assert.deepEqual(Object.values(runtimeAssets), [
    `/${administrationPath}`,
    `/${manifestPath}`,
    `/${rosterPath}`,
    `/${hoursPath}`
  ]);
  assert.equal(sourceManifest.workspaceId, workspace.workspaceId);
  assert.equal(sourceManifest.companyId, workspace.companyId);
  assert.equal(sourceManifest.operatingProfileId, workspace.operatingProfile.profileId);
});

test("Summit rehearsal roster remains inside the representative territory and ZIP scope", () => {
  const zipCoverage = projectDashboardTerritoryZipCoverage(workspace, representative);
  assert.deepEqual(zipCoverage.territories.map(territory => territory.territoryId), [
    "summit_dallas_rehearsal_territory"
  ]);
  assert.deepEqual(zipCoverage.zipCodes, ["75201", "75202"]);

  const projection = projectApprovedRoster(
    roster,
    dashboardManifest,
    workspace,
    representative,
    { allowSynthetic: true }
  );
  assert.equal(projection.status, "READY");
  assert.equal(projection.places.length, 4);
  assert.equal(projection.places.every(place =>
    place.territoryId === "summit_dallas_rehearsal_territory"
      && zipCoverage.zipCodes.includes(place.postalCode)
  ), true);

  const crossZip = structuredClone(roster);
  crossZip.records[0].postalCode = "79999";
  assert.throws(
    () => projectApprovedRoster(crossZip, dashboardManifest, workspace, representative, {
      allowSynthetic: true
    }),
    error => error.code === "route_iq_dashboard_business_roster_zip_unauthorized"
  );

  const crossTerritory = structuredClone(roster);
  crossTerritory.records[0].territoryId = "unassigned_rehearsal_territory";
  assert.throws(
    () => projectApprovedRoster(crossTerritory, dashboardManifest, workspace, representative, {
      allowSynthetic: true
    }),
    error => error.code === "route_iq_dashboard_business_roster_territory_invalid"
  );
});

test("operating-hours labels remain distinct from estimated visit duration", () => {
  const labels = hours.records.map(record => formatAvailabilityLabel({
    status: record.availabilityStatus,
    displayLabel: record.availabilityStatus,
    nextOpening: null,
    nextClosing: record.nextClosingAt
      ? { displayTime: "5:00 PM" }
      : null
  }));
  assert.equal(labels.some(label => label.startsWith("Open now · closes ")), true);
  assert.equal(labels.includes("Hours outdated · verification required"), true);
  assert.equal(labels.includes("Hours unavailable · not route eligible"), true);
  assert.equal(labels.every(label => !label.startsWith("Estimated visit:")), true);
  assert.equal(formatEstimatedVisitDuration("5-9"), "Estimated visit: 5–9 min");
});

test("browser rehearsal remains generic, mobile-bound, and nonproduction", () => {
  const harness = read("scripts/verify-dashboard-runtime-workflows.mjs");
  const reusableSource = `${read("index.html")}\n${read("dashboard/route-iq-dashboard-platform.mjs")}`;
  const fixtureLabels = [
    workspace.company.displayName,
    ...roster.records.map(record => record.businessName)
  ];
  assert.equal(fixtureLabels.every(label => !reusableSource.includes(label)), true);
  assert.match(harness, /Summit rehearsal exact 390x844 no-horizontal-scroll/u);
  assert.match(harness, /Summit rehearsal browser workflow reachability/u);
  assert.match(harness, /Summit rehearsal nonproduction fail-closed boundary/u);
  assert.equal(administration.productionAuthorized, false);
  assert.equal(workspace.admission.productionAuthorized, false);
  assert.equal(sourceManifest.productionUseAuthorized, false);
  assert.equal(sourceManifest.canonicalManifestAdmissionAllowed, false);
  assert.equal(roster.productionUseAuthorized, false);
  assert.equal(hours.productionUseAuthorized, false);
  assert.equal(hours.providerMode, "NO_EXTERNAL_PROVIDER_REHEARSAL");
});
