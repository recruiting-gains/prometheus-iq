import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = path => readFileSync(resolve(root, path), "utf8");
const failures = [];
const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

const index = read("index.html");
const serviceWorker = read("sw.js");
const dashboardPlatform = read("dashboard/route-iq-dashboard-platform.mjs");
const workspaceRegistry = JSON.parse(
  read("administration/workspace-configurations/route-iq-cross-industry-workspaces-v2.json")
);
const manifestRegistry = JSON.parse(
  read("data/route-iq-commercial-readiness-v1/route-iq-workspace-business-artifact-manifest-registry-v1.json")
);
const retiredBusinessName = ["Smoothie", "Depot"].join(" ");
const retiredBusinessId = ["smoothie", "depot"].join("_");
const retiredDashboardPath = ["smoothie", "depot", "dashboard"].join("-");

assert(
  !/runtimeDatasetActivePath|runtimeDatasetFullPath|requestedRuntimePool|selectedRuntimePool/u.test(index),
  "The Dashboard must not retain Active/full runtime-pool fallback selection."
);
assert(
  !/runtime-pools\.json|runtime-pool-segmentation-v1\/active-pool\.json/u.test(index),
  "The Dashboard must not load legacy runtime-pool catalogs."
);
assert(
  index.includes(
    'const dashboardPlatformModulePath = "./dashboard/route-iq-dashboard-platform.mjs?paid-customer-preview-v1";'
  ),
  "The Dashboard must load the generic configuration platform."
);
assert(
  index.includes('route-iq-business-hours-eligibility-v2'),
  "The Dashboard must require the exact v2 business-hours eligibility runtime."
);
assert(
  !index.includes('route-iq-business-hours-eligibility-v1'),
  "The Dashboard must reject the superseded v1 business-hours eligibility runtime."
);
assert(
  index.includes("createGovernedRouteRuntimeScopeFromConfiguration"),
  "The Dashboard must authenticate one Administration/Data runtime scope before Intelligence use."
);
assert(
  dashboardPlatform.includes('routeIqDashboardRuntimeAssetKeys = Object.freeze(['),
  "The generic platform must declare a closed runtime-asset contract."
);
for (const key of ["workspaceConfiguration", "businessManifestRegistry", "businessRoster", "businessHours"]) {
  assert(dashboardPlatform.includes(`"${key}"`), `The generic platform must require ${key}.`);
}
assert(
  dashboardPlatform.includes("route_iq_dashboard_business_roster_hash_mismatch"),
  "The approved roster must be hash-bound to its Data manifest."
);
assert(
  dashboardPlatform.includes("route_iq_dashboard_business_roster_approval_invalid"),
  "The Dashboard must enforce the approved roster before rendering."
);

const script = index.match(/<script>([\s\S]*?)<\/script>/u)?.[1] || "";
const hash = `sha256-${createHash("sha256").update(script, "utf8").digest("base64")}`;
assert(
  index.includes(`script-src 'self' '${hash}'`),
  "The in-document Dashboard CSP must pin the current inline runtime exactly."
);

assert(
  serviceWorker.includes('CACHE_NAME = "prometheus-v50-route-iq-configurable-dashboard"'),
  "The service worker must use the generic v50 cache namespace."
);
assert(
  serviceWorker.includes('if (event.request.method !== "GET" && event.request.method !== "HEAD") return;'),
  "The service worker must never intercept or replay application writes."
);
assert(
  serviceWorker.includes('fetch(event.request, { cache: "no-store" })'),
  "Governed runtime/configuration/hours requests must remain network-only."
);
assert(!/cache\.put|runtime-pools|active-pool/u.test(serviceWorker), "The service worker must not persist runtime business data.");

const workspaceIds = new Set(workspaceRegistry.workspaces.map(workspace => workspace.workspaceId));
for (const manifest of manifestRegistry.manifests) {
  assert(workspaceIds.has(manifest.workspaceId), `Manifest ${manifest.manifestId} must bind to a configured workspace.`);
  const workspace = workspaceRegistry.workspaces.find(item => item.workspaceId === manifest.workspaceId);
  const sources = workspace?.opportunitySources?.filter(source =>
    source.manifestId === manifest.manifestId
      && source.workspaceId === manifest.workspaceId
      && source.profileId === manifest.operatingProfileId
      && source.artifactPath === manifest.artifactPath
  );
  assert(sources?.length === 1, `Manifest ${manifest.manifestId} must have one authoritative configured source.`);
  assert(
    manifest.demoFallbackAllowed === false && manifest.crossWorkspaceFallbackAllowed === false,
    `Manifest ${manifest.manifestId} must reject demo and cross-workspace fallback.`
  );
}

for (const source of [index, serviceWorker, dashboardPlatform]) {
  assert(!source.includes(retiredBusinessName), "A retired business name entered deployable Dashboard source.");
  assert(!source.includes(retiredBusinessId), "A retired workspace identity entered deployable Dashboard source.");
  assert(!source.includes(retiredDashboardPath), "A retired dashboard path entered deployable Dashboard source.");
}

if (failures.length) {
  console.error("Dashboard governed runtime verification failed:");
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log("Dashboard governed runtime verified: one manifest-bound source, v2 hours, no runtime fallback, and network-only governed assets.");
}
