import assert from "node:assert/strict";
import fs from "node:fs";

import { verifyCrossSubsystemArtifactContracts } from "./verify-cross-subsystem-artifact-contracts.mjs";

const governancePath = "overwatch/governance/route-iq-cross-industry-dashboard-regression-v1.json";
const requiredRuntimeAssets = Object.freeze([
  "workspaceConfiguration",
  "businessManifestRegistry",
  "businessRoster",
  "businessHours"
]);
const read = path => fs.readFileSync(path, "utf8");
const readJson = path => JSON.parse(read(path));

function assertSourceBoundary(source, required, prohibited, label) {
  for (const marker of required) assert.ok(source.includes(marker), `${label} is missing ${marker}.`);
  for (const marker of prohibited) assert.equal(source.includes(marker), false, `${label} contains prohibited ${marker}.`);
}

export function verifyOverwatchRouteIqCrossIndustryDashboardRegression() {
  const governance = readJson(governancePath);
  const contracts = verifyCrossSubsystemArtifactContracts();
  assert.equal(contracts.ok, true, contracts.failures.join("\n"));
  assert.equal(governance.ownerSubsystem, "Prometheus Overwatch");
  assert.deepEqual(governance.runtimeAssetKeys, requiredRuntimeAssets);
  assert.equal(governance.availabilityBoundary.freshnessCeilingHours, 24);
  assert.equal(governance.availabilityBoundary.providerFailureMayPromoteStaleData, false);
  assert.equal(governance.availabilityBoundary.operatingHoursAndVisitDurationSeparate, true);
  assert.equal(governance.releaseBlockingGate.productionDemoFallbackAllowed, false);
  assert.equal(governance.releaseBlockingGate.crossWorkspaceOrCompanyDataAllowed, false);
  assert.equal(governance.productionBoundaries.deploymentAuthorized, false);
  assert.equal(governance.productionBoundaries.schedulerActivationAuthorized, false);
  assert.equal(governance.productionBoundaries.collection, "OFF");
  assert.equal(governance.productionBoundaries.activeCohorts, 0);
  assert.equal(governance.productionBoundaries.recommendationInfluence, "OFF");
  assert.equal(governance.productionBoundaries.anthonyMappingStatus, "UNMAPPED");

  const dashboard = read("dashboard/route-iq-dashboard-platform.mjs");
  assertSourceBoundary(dashboard, [
    "route-iq-configurable-dashboard-v2",
    "route-iq-dashboard-storage-v2",
    "prometheus-v50-route-iq-configurable-dashboard",
    "Hours outdated · verification required",
    "Hours unavailable · not route eligible",
    "Estimated visit:"
  ], [
    "embeddedBusinessCatalogAllowed: true",
    "crossWorkspaceFallback: true"
  ], "Dashboard platform");

  const serviceWorker = read("sw.js");
  assertSourceBoundary(serviceWorker, [
    "prometheus-v50-route-iq-configurable-dashboard",
    "isGovernedNetworkOnlyPath"
  ], [
    "demo-dashboard"
  ], "Service worker");

  const eligibility = readJson("intelligence/contracts/route-business-hours-eligibility-contracts.json");
  assert.equal(eligibility.eligibilityPolicy.maximumFreshnessHours, 24);
  assert.equal(eligibility.queuePolicy.uncertainCoverageSelectableAsCurrentStop, false);
  assert.equal(eligibility.presentationContract.visitDurationSeparate, true);
  assert.equal(eligibility.safety.liveProviderCalls, false);

  const dataManifest = readJson("data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/runtime-pool-manifest.json");
  assert.deepEqual(dataManifest.counts, {
    active: 0,
    reserve: 0,
    quarantine: 398
  });
  assert.equal(dataManifest.demoFallbackAllowed, false);
  assert.equal(dataManifest.crossWorkspaceFallbackAllowed, false);

  return Object.freeze({
    status: "PASS",
    batchId: governance.batchId,
    workspaces: contracts.workspaces,
    configurationSha256: contracts.configurationSha256,
    manifestRegistrySha256: contracts.manifestRegistrySha256,
    businessHoursSha256: contracts.businessHoursSha256,
    dataState: contracts.dataState,
    productionIdentitySource: governance.knownProductionIdentity.source,
    publicWorkerVersion: governance.knownProductionIdentity.publicWorkerVersion,
    privateWorkerVersion: governance.knownProductionIdentity.privateWorkerVersion,
    collection: "OFF",
    activeCohorts: 0,
    recommendationInfluence: "OFF",
    deploymentPerformed: false
  });
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  console.log(JSON.stringify(verifyOverwatchRouteIqCrossIndustryDashboardRegression(), null, 2));
}
