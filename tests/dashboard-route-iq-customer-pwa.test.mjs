import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const dashboard = readFileSync(resolve(root, "index.html"), "utf8");
const manifest = JSON.parse(readFileSync(resolve(root, "manifest.webmanifest"), "utf8"));
const serviceWorker = readFileSync(resolve(root, "sw.js"), "utf8");
const runtimeWorkflowHarness = readFileSync(resolve(root, "scripts/verify-dashboard-runtime-workflows.mjs"), "utf8");
const generatedIntelligenceRoot = resolve(root, "deploy/cloudflare-pages/intelligence");

function generatedModules(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return generatedModules(path);
    return entry.isFile() && entry.name.endsWith(".mjs") ? [path] : [];
  });
}

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
  assert.match(dashboard, /routeIqCustomerPwaSession\?\.representativeId\s*\|\|\s*safeParam/u);
  assert.match(dashboard, /routeIqCustomerPwaSession\s*\?\s*routeIqCustomerSessionRole\s*:\s*safeParam/u);
  assert.match(dashboard, /prometheus-v1:\$\{customerStorageScope\}/u);
  assert.match(dashboard, /prometheus-route-iq-finalized-sessions-v1:\$\{customerStorageScope\}/u);
  assert.match(dashboard, /if \(!routeIqCustomerPwaSession\) localStorage\.setItem\(sessionRoleStoreKey/u);
  assert.match(dashboard, /Object\.keys\(repProfiles\)\.forEach/u);
  assert.match(dashboard, /profileId !== authorizedRepresentativeId/u);
  assert.match(dashboard, /requestedRuntimePool = appUrlParams\.get\("runtimePool"\) === "full"/u);
  assert.match(dashboard, /selectedRuntimePool = routeIqCustomerPwaSession \? "active" : requestedRuntimePool/u);
  assert.match(dashboard, /founderDebugEnabled = !routeIqCustomerPwaSession && appUrlParams\.get\("debug"\) === "1"/u);
  assert.doesNotMatch(dashboard, /role:\s*"Beta tester"|Anthony Beta Territory|mi beta radius/u);
});

test("customer sessions cannot expose Founder intelligence, Founder CRM, collection, cohorts, or recommendations", () => {
  assert.match(dashboard, /value\.capabilities\.founderIntelligence !== false/u);
  assert.match(dashboard, /value\.capabilities\.founderCrm !== false/u);
  assert.match(dashboard, /value\.safety\?\.prospectiveCollection !== "OFF"/u);
  assert.match(dashboard, /value\.safety\?\.activeCohorts !== 0/u);
  assert.match(dashboard, /value\.safety\?\.recommendationInfluence !== "OFF"/u);
  assert.match(dashboard, /if \(sessionRole !== "founder"\)/u);
});

test("a missing customer operating profile blocks startup without falling back to Fitness", () => {
  assert.match(dashboard, /routeIqCustomerPwaSession && !selectedOperatingProfile/u);
  assert.match(dashboard, /operatingProfileSource = "customer-configuration-unavailable"/u);
  assert.match(dashboard, /renderRouteIqCustomerPwaSessionBlocked\("configuration_unavailable"\)/u);
  assert.match(dashboard, /const operatingProfileLoaded = await loadOperatingProfileDefinitions\(\);[\s\S]*?if \(routeIqCustomerPwaSession && !operatingProfileLoaded\) \{[\s\S]*?return;[\s\S]*?\}[\s\S]*?await loadRouteReplenishmentEngine\(\);/u);
  assert.match(dashboard, /customerStartup\.operationalWorkflowStarted = true;[\s\S]*?await loadRouteReplenishmentEngine\(\);[\s\S]*?initializeRouteIqProspectiveClient\(\);/u);
  assert.match(dashboard, /if \(routeIqCustomerPwaSession\) \{[\s\S]*?return false;[\s\S]*?activeOperatingProfile = embeddedOperatingProfile;/u);
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
  assert.match(dashboard, /workspaceId,\s*\n\s*notes:/u);
});

test("the browser harness uses governed Northstar Intelligence provenance without Fitness asset substitution", () => {
  assert.match(runtimeWorkflowHarness, /operatingProfileId: "northstar_service_calls"/u);
  assert.match(runtimeWorkflowHarness, /intelligence\/fixtures\/route-iq-governed-customer-business-hours-v1\.json/u);
  assert.match(runtimeWorkflowHarness, /data\/__harness__\/northstar\/business-hours\.json/u);
  assert.match(runtimeWorkflowHarness, /intelligence\/route-iq-governed-runtime-scope\.mjs/u);
  assert.match(runtimeWorkflowHarness, /mismatchedProvenanceRejected/u);
  assert.match(runtimeWorkflowHarness, /!customerPwaRequestedPaths\.has\(activePoolPath\)/u);
  assert.match(runtimeWorkflowHarness, /!customerPwaRequestedPaths\.has\(fullPoolPath\)/u);
  assert.doesNotMatch(runtimeWorkflowHarness, /customerPwaSessionFixture[\s\S]{0,1800}business-hours-v1\/business-hours\.json/u);
});

test("generated Dashboard Intelligence modules retain source parity and resolvable imports", () => {
  const governedScopeSource = readFileSync(resolve(root, "intelligence/route-iq-governed-runtime-scope.mjs"));
  const governedScopeDeploy = readFileSync(resolve(generatedIntelligenceRoot, "route-iq-governed-runtime-scope.mjs"));
  assert.deepEqual(governedScopeDeploy, governedScopeSource);

  const staticRelativeImport = /\bimport\s+(?:[\s\S]*?\s+from\s+)?["'](\.{1,2}\/[^"']+)["'];/gu;
  for (const modulePath of generatedModules(generatedIntelligenceRoot)) {
    const moduleSource = readFileSync(modulePath, "utf8");
    for (const match of moduleSource.matchAll(staticRelativeImport)) {
      assert.equal(
        existsSync(resolve(dirname(modulePath), match[1])),
        true,
        `${modulePath} imports missing generated dependency ${match[1]}`
      );
    }
  }
});

test("the browser harness proves a missing customer profile stops before operational startup", () => {
  assert.match(runtimeWorkflowHarness, /operatingProfileId: "northstar_missing_profile"/u);
  assert.match(runtimeWorkflowHarness, /Customer PWA missing operating-profile fail-closed/u);
  assert.match(runtimeWorkflowHarness, /sessionState === "configuration_unavailable"/u);
  assert.match(runtimeWorkflowHarness, /prospectiveBootstrapRequests\.length === 0/u);
  assert.match(runtimeWorkflowHarness, /prospectiveListenerAttached === false/u);
  assert.match(runtimeWorkflowHarness, /operationalWorkflowStarted === false/u);
  assert.match(runtimeWorkflowHarness, /intelligence\/continuous-adaptive-route-replenishment\.mjs/u);
  assert.match(runtimeWorkflowHarness, /customerPwaActivePoolPath/u);
  assert.match(runtimeWorkflowHarness, /!customerPwaMissingProfileServer\.requests\.some\(request => missingProfileForbiddenRequests\.has\(request\.path\)\)/u);
});
