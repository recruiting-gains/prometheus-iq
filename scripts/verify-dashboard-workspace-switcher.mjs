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
assert(sourceIndex.includes('id="workspaceSwitch"'), "Founder workspace switcher must be present.");
assert(sourceIndex.includes('class="workspace-switch admin-only"'), "Workspace switcher must be Founder/Admin-only.");
assert(sourceIndex.includes('data-workspace-select="fitness_connection"'), "Workspace switcher must include Fitness Connection.");
assert(sourceIndex.includes('data-workspace-select="smoothie_depot"'), "Workspace switcher must include Smoothie Depot.");
assert(sourceIndex.includes('route: "/smoothie-depot-dashboard/"'), "Smoothie Depot selection must route to the isolated Smoothie Depot dashboard.");
assert(sourceIndex.includes('workspaceStoreKey = "prometheus-founder-workspace"'), "Workspace selection must use the Dashboard workspace store key.");
assert(sourceIndex.includes('defaultWorkspaceId = "fitness_connection"'), "Workspace selection must default safely to Fitness Connection.");
assert(sourceIndex.includes("function canUseFounderWorkspaceSwitcher()"), "Workspace switcher must use explicit Founder switcher guard.");
assert(sourceIndex.includes("function setWorkspaceSelection(workspaceId)"), "Workspace switcher must use controlled workspace selection.");

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

console.log("Founder workspace switcher verified: Fitness defaults safely, Smoothie Depot routes through isolated dashboard, and deploy assets remain in sync.");
