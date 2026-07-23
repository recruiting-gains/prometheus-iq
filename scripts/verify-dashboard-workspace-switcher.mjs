import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = path => readFileSync(resolve(root, path), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const sourceIndex = read("index.html");
const dashboardPlatform = read("dashboard/route-iq-dashboard-platform.mjs");
const workspaceRegistry = JSON.parse(
  read("administration/workspace-configurations/route-iq-cross-industry-workspaces-v2.json")
);
const retiredBusinessName = ["Smoothie", "Depot"].join(" ");
const retiredBusinessId = ["smoothie", "depot"].join("_");
const retiredDashboardPath = ["smoothie", "depot", "dashboard"].join("-");

assert(
  sourceIndex.includes('data-workspace-id="route_iq_unconfigured"'),
  "The generic Dashboard must start unconfigured until a server-authenticated session supplies its workspace."
);
assert(
  sourceIndex.includes('const defaultWorkspaceId = routeIqCustomerPwaSession?.workspaceId || "route_iq_unconfigured";'),
  "The Dashboard workspace must come from the authenticated customer session."
);
assert(
  sourceIndex.includes('<template id="routeIqCustomerPwaSession">__ROUTE_IQ_CUSTOMER_PWA_SESSION__</template>'),
  "The generic PWA must retain its server-owned session injection boundary."
);
assert(!sourceIndex.includes('id="workspaceSwitch"'), "The generic PWA must not expose a browser workspace switcher.");
assert(!sourceIndex.includes("data-workspace-select"), "The generic PWA must not expose workspace-selection controls.");
assert(!sourceIndex.includes(retiredBusinessName), "The retired business must not appear in the active Dashboard.");
assert(!sourceIndex.includes(retiredBusinessId), "The retired workspace must not appear in the active Dashboard.");
assert(!sourceIndex.includes(retiredDashboardPath), "The retired customer dashboard must not be linked from Route IQ.");
assert(!/\bGaia\b/u.test(sourceIndex), "Route IQ must not expose Gaia in current product views.");
assert(!/\bAthena\b/u.test(sourceIndex), "Route IQ must not expose Athena in current product views.");
assert(sourceIndex.includes("<h1>Route IQ</h1>"), "Route IQ must remain the Dashboard product identity.");
assert(
  sourceIndex.includes("Workspace configuration and governed business data are required. No route recommendations are active."),
  "Missing configuration must render a clear fail-closed empty state."
);

assert(
  dashboardPlatform.includes('routeIqDashboardPlatformVersion = "route-iq-configurable-dashboard-v2"'),
  "The Dashboard must use the generic v2 platform contract."
);
assert(
  dashboardPlatform.includes('"workspaceConfiguration"')
    && dashboardPlatform.includes('"businessManifestRegistry"')
    && dashboardPlatform.includes('"businessRoster"')
    && dashboardPlatform.includes('"businessHours"'),
  "The generic platform must require all governed runtime bindings."
);
assert(
  dashboardPlatform.includes('missingSourceState !== "CONFIGURATION_REQUIRED_EMPTY"'),
  "The generic platform must reject unsafe missing-source fallback policy."
);

const activeWorkspaceIds = workspaceRegistry.workspaces.map(workspace => workspace.workspaceId).sort();
assert(
  JSON.stringify(activeWorkspaceIds) === JSON.stringify([
    "fitness_connection",
    "northstar_outside_sales_synthetic"
  ]),
  "The Administration v2 registry must expose only the governed Fitness research and synthetic outside-sales profiles."
);
for (const workspace of workspaceRegistry.workspaces) {
  assert(
    workspace.fallbackPolicy?.mode === "FAIL_CLOSED"
      && workspace.fallbackPolicy?.demoCatalogAllowed === false
      && workspace.fallbackPolicy?.embeddedBusinessCatalogAllowed === false
      && workspace.fallbackPolicy?.crossWorkspaceFallbackAllowed === false,
    `Workspace ${workspace.workspaceId} must reject demo, embedded, and cross-workspace fallback data.`
  );
}

assert(!existsSync(resolve(root, "demo-dashboard/index.html")), "The obsolete separate demo Dashboard must remain retired.");
assert(!existsSync(resolve(root, `${retiredDashboardPath}/index.html`)), "The obsolete customer-specific Dashboard must remain retired.");
assert(
  workspaceRegistry.safety?.collection === "OFF"
    && workspaceRegistry.safety?.activeCohorts === 0
    && workspaceRegistry.safety?.recommendationInfluence === "OFF",
  "Collection, cohorts, and recommendation influence must remain dark."
);

console.log("Generic Route IQ Dashboard verified: authenticated configuration only, no browser switching, no customer fork, and fail-closed source admission.");
