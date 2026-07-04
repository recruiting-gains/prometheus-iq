import fs from "node:fs";

const read = path => fs.readFileSync(path, "utf8");
const readJson = path => JSON.parse(read(path));
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const sourcePath = "smoothie-depot-dashboard/index.html";
const deployPath = "deploy/cloudflare-pages/smoothie-depot-dashboard/index.html";
const source = read(sourcePath);
const deploy = read(deployPath);
const intelligencePlan = readJson("intelligence/workspaces/smoothie-depot/workspace-intelligence-plan.json");
const crmPlan = readJson("crm/workspaces/smoothie-depot/candidate-pipeline-contracts.json");

assert(source === deploy, "Smoothie Depot dashboard source and deploy asset must stay in sync.");
assert(source.includes('data-workspace-id="smoothie_depot"'), "Dashboard must be scoped to smoothie_depot.");
assert(source.includes('data-operating-profile-id="franchise_development"'), "Dashboard must use Franchise Development profile.");
assert(source.includes('data-dashboard-owner="cruz"'), "Dashboard must identify Cruz as owner.");
assert(source.includes('data-jr-access="false"'), "Dashboard must mark JR access false.");
assert(source.includes('data-data-mode="workspace-fixture"'), "Dashboard must mark workspace fixture data mode.");
assert(source.includes("noindex,nofollow,noarchive"), "Dashboard must be noindex.");
assert(source.includes("frame-ancestors 'none'"), "Dashboard CSP must prevent framing.");

assert(intelligencePlan.workspaceId === "smoothie_depot", "Source intelligence plan must be Smoothie Depot scoped.");
assert(intelligencePlan.operatingProfileId === "franchise_development", "Source intelligence plan must use Franchise Development.");
assert(intelligencePlan.workspaceIsolation.fitnessConnectionIsolationConfirmed === true, "Source intelligence plan must confirm Fitness Connection isolation.");
assert(intelligencePlan.workspaceIsolation.protectedWorkspaceIds.includes("fitness_connection"), "Source intelligence plan must protect Fitness Connection workspace.");
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

for (const [flag, value] of Object.entries(crmPlan.protectedSubsystems)) {
  assert(value === false, `CRM protected subsystem flag ${flag} must remain false.`);
}

for (const metric of [
  "Total Businesses Identified",
  "Owners Researched",
  "Contacts Found",
  "Outreach Sent",
  "Discovery Calls Scheduled",
  "Qualified Candidates",
  "JR Handoffs",
  "Closed Franchise Sales",
  "Commission Forecast"
]) {
  assert(source.includes(metric), `Dashboard missing executive summary metric: ${metric}`);
}

for (const stage of [
  "Business Identified",
  "Owner Research",
  "Contact Found",
  "Outreach",
  "Interested",
  "Discovery Scheduled",
  "Discovery Complete",
  "Qualified Candidate",
  "JR Handoff",
  "FDD / Review",
  "Closed"
]) {
  assert(source.includes(stage), `Dashboard missing candidate pipeline stage: ${stage}`);
}

for (const detail of [
  "Business",
  "Contact",
  "Phone",
  "Email",
  "Website",
  "Google Rating",
  "Review Summary",
  "Business Category",
  "Locations",
  "Franchise Readiness Assessment",
  "Risk Flags",
  "Notes",
  "Next Action"
]) {
  assert(source.includes(detail), `Dashboard missing candidate detail field: ${detail}`);
}

for (const jrQueue of [
  "Candidates ready for JR",
  "Pending FDD",
  "Waiting for decision",
  "Follow-up needed"
]) {
  assert(source.includes(jrQueue), `Dashboard missing JR Queue section: ${jrQueue}`);
}

for (const commission of [
  "Potential commissions",
  "Projected commissions",
  "Closed commissions",
  "Protected candidates",
  "Expiration dates"
]) {
  assert(source.includes(commission), `Dashboard missing commission section: ${commission}`);
}

for (const activity of [
  "Businesses found",
  "Research completed",
  "Candidate qualified",
  "JR handoff",
  "Follow-up due"
]) {
  assert(source.includes(activity), `Dashboard missing activity feed item: ${activity}`);
}

for (const forbidden of [
  "Fitness Connection",
  "fitness_connection",
  "Units",
  "Memberships",
  "Route Intelligence",
  "Active Pool",
  "Territory",
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

console.log("Smoothie Depot Founder Dashboard verified: workspace-scoped fixture surface, required franchise development sections, no production data access, and Fitness Connection isolation preserved.");
