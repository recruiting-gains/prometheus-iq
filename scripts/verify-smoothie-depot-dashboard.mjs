import fs from "node:fs";
import { createHash } from "node:crypto";

const read = path => fs.readFileSync(path, "utf8");
const readJson = path => JSON.parse(read(path));
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const sourcePath = "smoothie-depot-dashboard/index.html";
const deployPath = "deploy/cloudflare-pages/smoothie-depot-dashboard/index.html";
const packageMarkdownPath = "research/workspaces/smoothie-depot/executive-intelligence-packages/nutrition-depot-executive-intelligence-package-v1.md";
const packageJsonPath = "research/workspaces/smoothie-depot/executive-intelligence-packages/nutrition-depot-executive-intelligence-package-v1.json";
const packageRegisterPath = "research/workspaces/smoothie-depot/executive-intelligence-packages/package-register.json";

const source = read(sourcePath);
const deploy = read(deployPath);
const deployHeaders = read("deploy/cloudflare-pages/_headers");
const commandCenterSource = read("smoothie-depot-dashboard/command-center.js");
const commandCenterDeploy = read("deploy/cloudflare-pages/smoothie-depot-dashboard/command-center.js");
const intelligencePlan = readJson("intelligence/workspaces/smoothie-depot/workspace-intelligence-plan.json");
const crmPlan = readJson("crm/workspaces/smoothie-depot/candidate-pipeline-contracts.json");
const packageRegister = readJson(packageRegisterPath);
const nutritionDepotPackage = readJson(packageJsonPath);
const nutritionDepotPackageMarkdown = read(packageMarkdownPath).trimEnd();

const htmlEscape = value => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

assert(source === deploy, "Smoothie Depot dashboard source and deploy asset must stay in sync.");
assert(commandCenterSource === commandCenterDeploy, "Smoothie Depot command center script source and deploy asset must stay in sync.");
assert(source.includes('data-workspace-id="smoothie_depot"'), "Dashboard must be scoped to smoothie_depot.");
assert(source.includes('data-operating-profile-id="franchise_development"'), "Dashboard must use Franchise Development profile.");
assert(source.includes('data-dashboard-owner="cruz"'), "Dashboard must identify Cruz as owner.");
assert(source.includes('data-jr-access="false"'), "Dashboard must mark JR access false.");
assert(source.includes('data-data-mode="workspace-research-output"'), "Dashboard must mark workspace Research output data mode.");
assert(source.includes("noindex,nofollow,noarchive"), "Dashboard must be noindex.");
assert(!/<meta[^>]+Content-Security-Policy[^>]+frame-ancestors/i.test(source), "Dashboard meta CSP must not include unsupported frame-ancestors.");
assert(deployHeaders.includes("frame-ancestors 'none'"), "Dashboard HTTP CSP must prevent framing.");
assert(source.includes("script-src 'self'"), "Dashboard command center must allow only self-hosted scripts.");
assert(source.includes("/smoothie-depot-dashboard/command-center.js"), "Dashboard must load the self-hosted command center script.");
assert(source.includes("grid-template-columns: minmax(520px, 1fr) minmax(280px, 360px);"), "Dashboard hero must preserve a non-collapsing desktop title column.");
assert(source.includes("overflow-wrap: normal;\n      word-break: normal;\n      hyphens: none;"), "Dashboard H1 must not use single-letter emergency wrapping on desktop.");
assert(!commandCenterSource.includes("fetch("), "Command center must not fetch data.");
assert(!commandCenterSource.includes("localStorage"), "Command center must not persist local storage.");
assert(!commandCenterSource.includes("sessionStorage"), "Command center must not persist session storage.");

assert(intelligencePlan.workspaceId === "smoothie_depot", "Source intelligence plan must be Smoothie Depot scoped.");
assert(intelligencePlan.operatingProfileId === "franchise_development", "Source intelligence plan must use Franchise Development.");
assert(intelligencePlan.workspaceIsolation.fitnessConnectionIsolationConfirmed === true, "Source intelligence plan must confirm Fitness Connection isolation.");
assert(intelligencePlan.workspaceIsolation.routeIntelligenceInfluence === false, "Source intelligence plan must not influence route systems.");
assert(intelligencePlan.workspaceIsolation.fitnessConnectionRouteInfluence === false, "Source intelligence plan must not influence protected workspace routes.");
for (const [flag, value] of Object.entries(intelligencePlan.runtimeActivation)) {
  assert(value === false, `Source intelligence runtime flag ${flag} must remain false.`);
}

assert(crmPlan.workspaceId === "smoothie_depot", "CRM plan must be Smoothie Depot scoped.");
assert(crmPlan.operatingProfileId === "franchise_development", "CRM plan must use Franchise Development.");
assert(crmPlan.runtimeImplementationApproved === false, "CRM runtime implementation must remain unapproved.");
assert(crmPlan.runtimeRecordsCreated === false, "CRM runtime records must remain uncreated.");
assert(crmPlan.workspaceIsolation.doNotTouchFitnessConnection === true, "CRM plan must prohibit touching Fitness Connection.");
assert(crmPlan.workspaceIsolation.doNotMixWithFitnessConnection === true, "CRM plan must prohibit cross-workspace mixing.");
assert(crmPlan.workspaceIsolation.fitnessConnectionSeparationConfirmed === true, "CRM plan must confirm Fitness Connection separation.");

assert(packageRegister.workspaceId === "smoothie_depot", "Executive package register must be Smoothie Depot scoped.");
assert(packageRegister.operatingProfileId === "franchise_development", "Executive package register must use Franchise Development.");
assert(packageRegister.productionRuntimeChange === false, "Executive package register must not activate production runtime.");
assert(packageRegister.boundaryConfirmation.researchOnly === true, "Executive package register must remain Research-owned.");
assert(packageRegister.boundaryConfirmation.dashboardModified === false, "Executive package register must not be Dashboard-modified.");

const registeredNutritionDepot = packageRegister.packages.find(pkg => pkg.packageId === nutritionDepotPackage.packageId);
assert(Boolean(registeredNutritionDepot), "Executive package register must include Nutrition Depot.");
assert(registeredNutritionDepot.markdownPath === packageMarkdownPath, "Nutrition Depot package register markdown path must match canonical package.");
assert(registeredNutritionDepot.jsonPath === packageJsonPath, "Nutrition Depot package register JSON path must match canonical package.");
assert(registeredNutritionDepot.artifactStatus === "completed_research_executive_intelligence_package", "Nutrition Depot package must be completed.");
assert(registeredNutritionDepot.canonicalForResearch === true, "Nutrition Depot package must remain canonical for Research.");

assert(nutritionDepotPackage.workspaceId === "smoothie_depot", "Nutrition Depot package must be Smoothie Depot scoped.");
assert(nutritionDepotPackage.operatingProfileId === "franchise_development", "Nutrition Depot package must use Franchise Development.");
assert(nutritionDepotPackage.packageStatus === "completed_research_executive_intelligence_package", "Nutrition Depot package must be completed.");
assert(nutritionDepotPackage.productionRuntimeChange === false, "Nutrition Depot package must not activate production runtime.");
assert(nutritionDepotPackage.standardModified === false, "Nutrition Depot package must not modify the Research standard.");
assert(nutritionDepotPackage.boundaryConfirmation.productionSystemsModified === false, "Nutrition Depot package must not modify production systems.");
assert(nutritionDepotPackage.boundaryConfirmation.privateInformationUsed === false, "Nutrition Depot package must not use private information.");

assert(source.includes(nutritionDepotPackage.business), "Review mode must show the Nutrition Depot package business.");
assert(source.includes(packageMarkdownPath), "Dashboard must point to the canonical Executive Intelligence Package Markdown path.");
assert(source.includes("Founder Executive Intelligence Review Mode"), "Dashboard must render Founder Executive Intelligence Review Mode.");
assert(source.includes("Nutrition Depot Executive Intelligence Package v1"), "Dashboard must render the package title.");
assert(source.includes("Table of Contents"), "Dashboard must render a package table of contents.");
assert(source.includes("Search package"), "Dashboard must provide package search.");
assert(source.includes("Previous:"), "Dashboard must render previous section navigation.");
assert(source.includes("Next:"), "Dashboard must render next section navigation.");
assert(source.includes("Export PDF"), "Dashboard must provide PDF export.");
assert(source.includes('data-export-status aria-live="polite"'), "Dashboard must provide visible export status feedback.");
assert(source.includes("Local Founder Notes"), "Dashboard must provide local notes only.");
assert(source.includes("Evidence questions"), "Dashboard local notes must support evidence questions.");
assert(source.includes("No CRM persistence, Dashboard persistence, Research mutation, or external submission is performed."), "Dashboard notes must stay local only.");
assert(source.includes("Evidence sections remain Research-owned and cannot be edited from Dashboard."), "Dashboard must mark evidence as read-only.");
assert(commandCenterSource.includes("preparePrintPackage"), "Command center must prepare the full package before print export.");
assert(commandCenterSource.includes("window.print()"), "Command center must trigger browser print for PDF export.");
assert(commandCenterSource.includes("Print dialog requested. Choose Save as PDF"), "Command center must give visible print/PDF feedback.");

for (const requiredMissionText of [
  "Executive Intelligence Operations Center",
  "Business Currently Under Research",
  "Evidence Completion",
  "Research Completion",
  "Executive Intelligence Package",
  "Founder Review",
  "Founder Approved",
  "Executive Delivery",
  "Outcome Pending",
  "Learning Pending",
  "Open Executive Intelligence Package",
  "Founder Approves",
  "Founder Rejects",
  "Additional Research Required",
  "Founder Sign-off Before Export",
  "Export Professional Executive Package",
  "No completed Research-owned Executive Intelligence Package is registered"
]) {
  assert(source.includes(requiredMissionText), `Dashboard review mode missing required text: ${requiredMissionText}`);
}

for (const heading of nutritionDepotPackageMarkdown.match(/^## .+$/gm) || []) {
  assert(source.includes(htmlEscape(heading)), `Dashboard must render package heading exactly: ${heading}`);
}

for (const requiredMarkdownFragment of [
  "# Nutrition Depot Executive Intelligence Package v1",
  "Package owner: Prometheus Research",
  "Package status: Completed Research Executive Intelligence Package",
  "## Executive Decision Page",
  "## Layer 1: Executive Summary",
  "## Layer 12: Executive Decision Support",
  "## Opportunity Cost",
  "## Red-Team Review",
  "## Decision Tree",
  "## Quality Gate",
  "## Source References"
]) {
  assert(source.includes(htmlEscape(requiredMarkdownFragment)), `Dashboard must render canonical package Markdown fragment: ${requiredMarkdownFragment}`);
}

const markdownHash = createHash("sha256").update(nutritionDepotPackageMarkdown).digest("hex");
assert(source.includes(markdownHash), "Dashboard must expose the canonical Executive Intelligence Package hash.");
assert(source.includes(htmlEscape('"packageStatus": "completed_research_executive_intelligence_package"')), "Dashboard must render structured package JSON artifact.");
assert(source.includes(htmlEscape('"qualityGate"')), "Dashboard must render structured quality gate data.");
assert(source.includes(htmlEscape('"sourceReferences"')), "Dashboard must render structured source references.");

for (const removedFixtureText of [
  "Founder Operations Zero State",
  "Outreach Sent",
  "Discovery Calls Scheduled",
  "Qualified Candidates",
  "JR Handoffs",
  "Closed Franchise Sales",
  "Commission Forecast",
  "Total Businesses Identified",
  "Owners Researched",
  "Contacts Found",
  "Candidate Pipeline",
  "Candidate Detail",
  "JR Queue",
  "Commission Dashboard",
  "Activity Feed",
  "Founder Controls",
  "Bayou Nutrition Group",
  "Cypress Wellness Holdings",
  "Pearland Hospitality Partners",
  "example.com",
  "Fixture outcome",
  "$186k",
  "$42k protected"
]) {
  assert(!source.includes(removedFixtureText), `Dashboard must not render fixture/demo or CRM pipeline data: ${removedFixtureText}`);
}

for (const removedControl of [
  'id="statusCalling"',
  'id="statusDiscovery"',
  'id="statusQualified"',
  'id="statusJr"',
  'id="statusClosed"',
  'for="statusCalling"',
  'for="statusDiscovery"',
  'for="statusQualified"',
  'for="statusJr"',
  'for="statusClosed"'
]) {
  assert(!source.includes(removedControl), `Dashboard must not render legacy Founder Mission control: ${removedControl}`);
}

for (const forbidden of [
  "fitness_connection",
  "Units",
  "Memberships",
  "Territories",
  "runtime-pools",
  "active-pool",
  "qualified-prospects",
  "fetch(",
  "XMLHttpRequest",
  "localStorage",
  "sessionStorage",
  "GOOGLE_MAPS",
  "GOOGLE_PLACES",
  "places.googleapis.com",
  "maps.googleapis.com"
]) {
  assert(!source.includes(forbidden), `Smoothie Depot dashboard must not show or access forbidden term: ${forbidden}`);
}

console.log("Smoothie Depot Executive Intelligence Review Mode verified: canonical package rendered read-only, desktop reader controls present, local notes only, no CRM mutation, and workspace isolation preserved.");
