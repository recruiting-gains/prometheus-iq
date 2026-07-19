import fs from "node:fs";

const read = path => fs.readFileSync(path, "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const sourceIndex = read("index.html");
const deployIndex = read("deploy/cloudflare-pages/index.html");
const smoothieSource = read("smoothie-depot-dashboard/index.html");
const smoothieDeploy = read("deploy/cloudflare-pages/smoothie-depot-dashboard/index.html");

assert(sourceIndex === deployIndex, "Dashboard source index and deploy index must stay in sync.");
assert(smoothieSource === smoothieDeploy, "Smoothie Depot source and deploy assets must stay in sync.");

assert(sourceIndex.includes('data-workspace-id="fitness_connection"'), "Fitness dashboard must default to the Fitness Connection workspace.");
assert(sourceIndex.includes('data-workspace-name="Fitness Connection"'), "Fitness dashboard must identify the Fitness Connection workspace.");
assert(sourceIndex.includes('data-operating-profile-id="fitness"'), "Fitness dashboard must default to the Fitness operating profile.");
assert(sourceIndex.includes('defaultWorkspaceId = "fitness_connection"'), "Workspace selection must default safely to Fitness Connection.");
assert(sourceIndex.includes("function applyRouteIqWorkspace()"), "Route IQ must apply one controlled workspace scope.");
assert(!sourceIndex.includes('id="workspaceSwitch"'), "Route IQ must not expose an active workspace switcher.");
assert(!sourceIndex.includes("data-workspace-select"), "Route IQ must not expose active workspace-selection controls.");
assert(!sourceIndex.includes("smoothie_depot"), "Route IQ runtime must not register the inactive Smoothie Depot workspace.");
assert(!sourceIndex.includes("smoothie-depot-dashboard"), "Route IQ runtime must not link to the historical Smoothie Depot dashboard.");
assert(!sourceIndex.includes("Smoothie Depot"), "Route IQ current-product views must not name Smoothie Depot.");
assert(!/\bGaia\b/.test(sourceIndex), "Route IQ current-product views must not expose Gaia.");
assert(!/\bAthena\b/.test(sourceIndex), "Route IQ current-product views must not expose Athena.");
assert(sourceIndex.includes("<h1>Route IQ</h1>"), "Route IQ must be the Dashboard's active product identity.");

for (const forbidden of [
  "Candidate Pipeline",
  "JR Handoff",
  "Commission Dashboard",
  "Commission Forecast",
  "Franchise Readiness Assessment",
  "Protected candidates"
]) {
  assert(!sourceIndex.includes(forbidden), `Fitness Connection dashboard must not render Smoothie Depot workspace data term: ${forbidden}`);
}

assert(smoothieSource.includes('data-workspace-id="smoothie_depot"'), "Smoothie Depot dashboard must remain scoped to smoothie_depot.");
assert(smoothieSource.includes('data-operating-profile-id="franchise_development"'), "Smoothie Depot dashboard must remain Franchise Development scoped.");
assert(smoothieSource.includes('data-dashboard-owner="cruz"'), "Smoothie Depot dashboard must remain Cruz-owned.");
assert(smoothieSource.includes('data-jr-access="false"'), "Smoothie Depot dashboard must keep JR access false.");
assert(smoothieSource.includes("Executive Intelligence Operations Center"), "Smoothie Depot dashboard must render the Executive Intelligence Operations Center.");
assert(smoothieSource.includes("Open Executive Intelligence Package"), "Smoothie Depot dashboard must expose the Executive Intelligence Package primary action.");
assert(smoothieSource.includes("Founder Review"), "Smoothie Depot dashboard must render Founder review controls.");
assert(smoothieSource.includes("Export Professional Executive Package"), "Smoothie Depot dashboard must render export workflow.");
assert(smoothieSource.includes("Intelligence Library"), "Smoothie Depot dashboard must render the isolated Intelligence Library.");
assert(smoothieSource.includes("Local Founder Notes"), "Smoothie Depot dashboard must render local Founder notes.");
assert(smoothieSource.includes("Nutrition Depot Executive Intelligence Package v2"), "Smoothie Depot dashboard must render the active Executive Intelligence Package.");
assert(!smoothieSource.includes("Candidate Pipeline"), "Smoothie Depot dashboard must not render fixture candidate pipeline.");
assert(!smoothieSource.includes("Commission Forecast"), "Smoothie Depot dashboard must not render sales commission forecasting.");

for (const forbidden of [
  "Units",
  "Memberships",
  "Territories",
  "runtime-pools",
  "active-pool",
  "fetch(",
  "XMLHttpRequest",
  "localStorage",
  "sessionStorage"
]) {
  assert(!smoothieSource.includes(forbidden), `Smoothie Depot dashboard must not render or access Fitness runtime term: ${forbidden}`);
}

console.log("Route IQ-only Dashboard verified: inactive products have no active navigation, and historical Smoothie Depot assets remain preserved and isolated.");
