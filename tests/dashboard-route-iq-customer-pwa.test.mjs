import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const dashboard = readFileSync(resolve(root, "index.html"), "utf8");
const manifest = JSON.parse(readFileSync(resolve(root, "manifest.webmanifest"), "utf8"));
const serviceWorker = readFileSync(resolve(root, "sw.js"), "utf8");
const runtimeWorkflowHarness = readFileSync(resolve(root, "scripts/verify-dashboard-runtime-workflows.mjs"), "utf8");
const dashboardPlatform = readFileSync(resolve(root, "dashboard/route-iq-dashboard-platform.mjs"), "utf8");

test("the customer PWA is one generic Route IQ app with a server-verified entry path", () => {
  assert.equal(manifest.name, "Route IQ");
  assert.equal(manifest.short_name, "Route IQ");
  assert.equal(manifest.start_url, "/app");
  assert.doesNotMatch(manifest.start_url, /(?:role|rep|profile|workspace|company)=/u);
  assert.match(dashboard, /<template id="routeIqCustomerPwaSession">__ROUTE_IQ_CUSTOMER_PWA_SESSION__<\/template>/u);
  assert.match(dashboard, /location\.pathname === "\/app" \|\| location\.pathname === "\/app\/"/u);
  assert.match(dashboard, /value\.authorizationState !== "server_verified"/u);
  assert.match(dashboard, /route_iq_customer_pwa_session_invalid/u);
});

test("customer identity and local state are server-scoped and cannot be selected by URL or prior browser state", () => {
  assert.match(dashboard, /routeIqCustomerPwaSession\?\.representativeId\s*\|\|\s*\(isLocalPreview \? safeParam/u);
  assert.match(dashboard, /routeIqCustomerPwaSession\s*\?\s*routeIqCustomerSessionRole\s*:\s*isLocalPreview\s*\?\s*safeParam/u);
  assert.match(dashboard, /prometheus-v2:\$\{customerStorageScope\}/u);
  assert.match(dashboard, /prometheus-route-iq-finalized-sessions-v1:\$\{customerStorageScope\}/u);
  assert.match(dashboard, /if \(!routeIqCustomerPwaSession\) localStorage\.setItem\(sessionRoleStoreKey/u);
  assert.match(dashboard, /Object\.keys\(repProfiles\)\.forEach/u);
  assert.match(dashboard, /profileId !== authorizedRepresentativeId/u);
  assert.doesNotMatch(dashboard, /requestedRuntimePool|selectedRuntimePool|appUrlParams\.get\("runtimePool"\)/u);
  assert.match(dashboard, /\["businessManifestRegistry", "businessRoster", "businessHours"\]\.some/u);
  assert.match(dashboard, /founderDebugEnabled = !routeIqCustomerPwaSession && appUrlParams\.get\("debug"\) === "1"/u);
  assert.doesNotMatch(dashboard, /role:\s*"Beta tester"|Anthony Beta Territory|mi beta radius/u);
});

test("customer territory presentation is applied only after authenticated configuration loads", () => {
  const territoryProfiles = dashboard.match(/const territoryProfiles = routeIqCustomerPwaSession \? \{[\s\S]*?\n    \} : \{/u)?.[0] || "";
  assert.doesNotMatch(territoryProfiles, /activeWorkspaceConfiguration/u);
  assert.match(dashboard, /const activeTerritory = activeWorkspaceConfiguration\.territories\.find/u);
  assert.match(dashboard, /activeDashboardPlatform\.territoryIds\.includes\(territory\.territoryId\)/u);
  assert.match(dashboard, /activeTerritoryProfile\.label = activeTerritory\.displayName/u);
});

test("customer sessions cannot expose Founder intelligence, Founder CRM, collection, cohorts, or recommendations", () => {
  assert.match(dashboard, /!\/\^\[a-z\]\[a-z0-9_\]\{2,127\}\$\/u\.test\(value\.roleId \|\| ""\)/u);
  assert.match(dashboard, /Object\.keys\(value\.capabilities\)\.sort\(\)/u);
  assert.match(dashboard, /value\.capabilities\.founderIntelligence !== false/u);
  assert.match(dashboard, /value\.capabilities\.founderCrm !== false/u);
  assert.match(dashboard, /value\.safety\?\.prospectiveCollection !== "OFF"/u);
  assert.match(dashboard, /value\.safety\?\.activeCohorts !== 0/u);
  assert.match(dashboard, /value\.safety\?\.recommendationInfluence !== "OFF"/u);
  assert.match(dashboard, /if \(sessionRole !== "founder"\)/u);
});

test("a missing customer operating profile blocks startup without falling back to Fitness", () => {
  assert.match(dashboard, /operatingProfileSource = "configuration-unavailable"/u);
  assert.match(dashboard, /runtimeDatasetSource = \{\s*label: "governed-runtime-unavailable",\s*status: "configuration-required"/u);
  assert.match(dashboard, /disableRouteIqProspectiveAdmission\("workspace_configuration_unavailable"\);[\s\S]*?renderRouteIqCustomerPwaSessionBlocked\("configuration_unavailable"\);[\s\S]*?return false;/u);
  assert.match(dashboard, /const operatingProfileLoaded = await loadOperatingProfileDefinitions\(\);[\s\S]*?if \(!operatingProfileLoaded\) \{[\s\S]*?startupCompleted = false;[\s\S]*?return;[\s\S]*?\}[\s\S]*?await loadRuntimeProductionDataset\(\);[\s\S]*?await loadRouteReplenishmentEngine\(\);/u);
  assert.match(dashboard, /customerStartup\.operationalWorkflowStarted = true;[\s\S]*?await loadRouteReplenishmentEngine\(\);[\s\S]*?initializeRouteIqProspectiveClient\(\);/u);
  assert.doesNotMatch(dashboard, /embeddedOperatingProfile|embeddedBusinessCatalog/u);
});

test("Dashboard capabilities and action labels use the configured role intersection", () => {
  assert.match(dashboardPlatform, /validateRouteIqWorkspaceConfigurationRegistry\(registry\)/u);
  assert.match(dashboardPlatform, /users\[0\]\.roleId !== session\.roleId/u);
  assert.match(dashboardPlatform, /roles\[0\]\.capabilities\.filter\(capability =>[\s\S]*dashboardCapabilities\.has\(capability\)/u);
  assert.match(dashboard, /dashboardCapabilityEnabled\(activeDashboardPlatform, capabilityId\)/u);
  assert.match(dashboard, /dashboardActionLabel\(activeDashboardPlatform, actionId, fallback\)/u);
});

test("navigation and session expiry fail closed without caching an authenticated app document", () => {
  assert.match(dashboard, /routeIqCustomerPwaSessionExpiresAtMs/u);
  assert.match(dashboard, /renderRouteIqCustomerPwaSessionBlocked\("expired"\)/u);
  assert.match(dashboard, /window\.addEventListener\("focus", enforceRouteIqCustomerPwaSessionExpiry\)/u);
  assert.match(dashboard, /window\.addEventListener\("pageshow", enforceRouteIqCustomerPwaSessionExpiry\)/u);
  assert.match(dashboard, /document\.visibilityState === "visible"/u);
  assert.match(serviceWorker, /event\.request\.mode === "navigate"/u);
  assert.match(serviceWorker, /fetch\(event\.request, \{ cache: "no-store" \}\)/u);
  assert.match(serviceWorker, /Reconnect and sign in again/u);
  assert.doesNotMatch(serviceWorker, /caches\.match\(event\.request\).*navigate/su);
  const dashboardCache = dashboard.match(/const serviceWorkerCacheVersion = "([^"]+)"/u)?.[1];
  const workerCache = serviceWorker.match(/const CACHE_NAME = "([^"]+)"/u)?.[1];
  assert.equal(dashboardCache, workerCache);
});

test("quick Add Place enforces workspace duplicate and capacity checks", () => {
  assert.match(dashboard, /state\.places\.length >= MAX_PLACES/u);
  assert.match(dashboard, /queueCandidateWorkspace\(place\) === workspaceId/u);
  assert.match(dashboard, /normalizeKey\(place\.name\) === normalizeKey\(name\)/u);
  assert.match(dashboard, /workspaceId,\s*\n\s*operatingProfileId:[\s\S]*candidateAdmission: "VERIFICATION_REQUIRED"/u);
});

test("the browser harness uses governed Northstar Intelligence provenance without Fitness asset substitution", () => {
  assert.match(runtimeWorkflowHarness, /workspaceId: "northstar_outside_sales_synthetic"/u);
  assert.match(runtimeWorkflowHarness, /operatingProfileId: "general_outside_sales"/u);
  assert.match(runtimeWorkflowHarness, /administration\/workspace-configurations\/route-iq-cross-industry-workspaces-v2\.json/u);
  assert.match(runtimeWorkflowHarness, /route-iq-workspace-business-artifact-manifest-registry-v1\.json/u);
  assert.match(runtimeWorkflowHarness, /data\/__harness__\/northstar\/approved-roster\.json/u);
  assert.match(runtimeWorkflowHarness, /data\/__harness__\/northstar\/business-hours\.json/u);
  assert.match(runtimeWorkflowHarness, /intelligence\/route-iq-governed-runtime-scope\.mjs/u);
  assert.match(runtimeWorkflowHarness, /mismatchedProvenanceRejected/u);
  assert.doesNotMatch(runtimeWorkflowHarness, /customerPwaActivePoolPath|customerPwaFullPoolPath/u);
});

test("the browser harness treats Founder cross-profile previews as governed fail-closed cases", () => {
  assert.match(runtimeWorkflowHarness, /runGovernedProfileMismatchScenario/u);
  assert.match(runtimeWorkflowHarness, /governed runtime scope|operating profile/iu);
  assert.match(runtimeWorkflowHarness, /initial\.debug\.startupCompleted === false/u);
  assert.match(runtimeWorkflowHarness, /initial\.debug\.rendererReceived === false/u);
  assert.match(runtimeWorkflowHarness, /boundary\.authorizedOperatingProfileId === "fitness"/u);
  assert.doesNotMatch(runtimeWorkflowHarness, /for \(const expected of \[\s*\{ profileId: "general_outside_sales"/u);
});

test("Dashboard source requires the governed v2 hours and manifest-admission contracts", () => {
  assert.match(dashboard, /route-iq-business-hours-eligibility-v2/u);
  assert.match(dashboard, /createGovernedRouteRuntimeScopeFromConfiguration/u);
  assert.match(dashboard, /governedRuntimeScope: routeGovernedRuntimeScope/u);
  assert.match(dashboardPlatform, /sourceManifestConfigurationVersion/u);
  assert.match(dashboardPlatform, /sourceArtifactSha256/u);
  assert.match(serviceWorker, /\/intelligence\//u);
  assert.doesNotMatch(serviceWorker, /cache\.put|runtime JSON|stale-while-revalidate/iu);
});

test("the browser harness proves a missing customer profile stops before operational startup", () => {
  assert.match(runtimeWorkflowHarness, /operatingProfileId: "northstar_missing_profile"/u);
  assert.match(runtimeWorkflowHarness, /Customer PWA missing operating-profile fail-closed/u);
  assert.match(runtimeWorkflowHarness, /sessionState === "configuration_unavailable"/u);
  assert.match(runtimeWorkflowHarness, /prospectiveBootstrapRequests\.length === 0/u);
  assert.match(runtimeWorkflowHarness, /prospectiveListenerAttached === false/u);
  assert.match(runtimeWorkflowHarness, /operationalWorkflowStarted === false/u);
  assert.match(runtimeWorkflowHarness, /intelligence\/continuous-adaptive-route-replenishment\.mjs/u);
  assert.match(runtimeWorkflowHarness, /businessRoster/u);
  assert.match(runtimeWorkflowHarness, /!customerPwaMissingProfileServer\.requests\.some/u);
});
