import fs from "node:fs";
import { createHash } from "node:crypto";

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
const rankedProspects = readJson("research/workspaces/smoothie-depot/ranked-business-prospects-2026-07-03.json");
const dueDiligenceFramework = readJson("research/workspaces/smoothie-depot/executive-due-diligence-framework-v4.json");
const dossierRegister = readJson("research/workspaces/smoothie-depot/dossiers/dossier-register.json");
const nutritionDepotDossier = readJson("research/workspaces/smoothie-depot/dossiers/nutrition-depot-executive-due-diligence-dossier-v1.json");
const nutritionDepotDossierMarkdown = read("research/workspaces/smoothie-depot/dossiers/nutrition-depot-executive-due-diligence-dossier-v1.md").trimEnd();
const commandCenterSource = read("smoothie-depot-dashboard/command-center.js");
const commandCenterDeploy = read("deploy/cloudflare-pages/smoothie-depot-dashboard/command-center.js");
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
assert(source.includes("frame-ancestors 'none'"), "Dashboard CSP must prevent framing.");
assert(source.includes("script-src 'self'"), "Dashboard command center must allow only self-hosted scripts.");
assert(source.includes("/smoothie-depot-dashboard/command-center.js"), "Dashboard must load the self-hosted command center script.");
assert(!commandCenterSource.includes("fetch("), "Command center must not fetch data.");
assert(!commandCenterSource.includes("localStorage"), "Command center must not persist local storage.");
assert(!commandCenterSource.includes("sessionStorage"), "Command center must not persist session storage.");

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

assert(rankedProspects.workspaceId === "smoothie_depot", "Research prospects must be Smoothie Depot scoped.");
assert(rankedProspects.operatingProfileId === "franchise_development", "Research prospects must use Franchise Development.");
assert(rankedProspects.productionRuntimeChange === false, "Research prospects must not activate production runtime.");
assert(rankedProspects.workspaceIsolation.smoothieDepotWorkspaceOnly === true, "Research prospects must be Smoothie Depot only.");
assert(rankedProspects.workspaceIsolation.fitnessConnectionDataUsed === false, "Research prospects must not use Fitness Connection data.");
assert(rankedProspects.workspaceIsolation.routeIntelligenceUsed === false, "Research prospects must not use route systems.");
assert(rankedProspects.workspaceIsolation.activePoolUsed === false, "Research prospects must not use Active Pool.");
assert(dueDiligenceFramework.workspaceId === "smoothie_depot", "Due diligence framework must be Smoothie Depot scoped.");
assert(dueDiligenceFramework.productionRuntimeChange === false, "Due diligence framework must not activate runtime.");
assert(dueDiligenceFramework.workspaceIsolation.dashboardModified === false, "Research framework remains read-only; Dashboard is only consuming it.");
assert(dossierRegister.workspaceId === "smoothie_depot", "Dossier register must be Smoothie Depot scoped.");
assert(dossierRegister.productionRuntimeChange === false, "Dossier register must not activate runtime.");
assert(dossierRegister.canonicalDossiers.some(dossier => dossier.dashboardCanonicalSource === true && dossier.business === "Nutrition Depot Houston and Greater Houston"), "Dossier register must expose Nutrition Depot as Dashboard canonical source.");
assert(nutritionDepotDossier.workspaceId === "smoothie_depot", "Nutrition Depot dossier must be Smoothie Depot scoped.");
assert(nutritionDepotDossier.artifactStatus === "completed_canonical_research_dossier", "Nutrition Depot dossier must be completed.");
assert(nutritionDepotDossier.workspaceIsolation.fitnessConnectionDataUsed === false, "Nutrition Depot dossier must not use Fitness Connection data.");
assert(nutritionDepotDossier.workspaceIsolation.routeIntelligenceUsed === false, "Nutrition Depot dossier must not use Route Intelligence.");
assert(nutritionDepotDossier.workspaceIsolation.activePoolUsed === false, "Nutrition Depot dossier must not use Active Pool.");
assert(nutritionDepotDossier.dataPolicy.publicBusinessInformationOnly === true, "Nutrition Depot dossier must use public business information only.");
assert(nutritionDepotDossier.dataPolicy.privateFinancialsCollected === false, "Nutrition Depot dossier must not collect private financials.");

for (const business of rankedProspects.topCallTargets.slice(0, 3)) {
  assert(source.includes(business), `Mission queue missing Research top call target: ${business}`);
}

for (const requiredMissionText of [
  "Today's Mission",
  "Mission Queue",
  "Top 3 Highest Priority Businesses",
  "Founder Intelligence Command Center",
  "Nutrition Depot Executive Due Diligence Dossier v1",
  "Complete canonical Research artifact",
  "Complete Structured Research Artifact JSON",
  "Business Name",
  "Category",
  "Outreach Priority",
  "Executive Dossier Status",
  "Confidence",
  "Unknown Count",
  "Last Updated",
  "Recommended Opening Angle",
  "Estimated Call Time",
  "Research Complete %",
  "Ready",
  "Calling",
  "Discovery",
  "Qualified",
  "JR Handoff",
  "Follow-up",
  "Closed",
  "Promoted when current closes"
]) {
  assert(source.includes(requiredMissionText), `Dashboard mission queue missing required text: ${requiredMissionText}`);
}

for (const requiredCommandCenterText of [
  "Search dossier",
  "Bookmark",
  "Highlight evidence",
  "Call notes",
  "Discovery notes",
  "JR notes",
  "Follow-up notes",
  "Mission",
  "Call Date",
  "Research Confidence",
  "Outstanding Unknowns",
  "Current Stage",
  "Next Required Action"
]) {
  assert(source.includes(requiredCommandCenterText), `Command center missing required interaction or mission text: ${requiredCommandCenterText}`);
}

for (const requiredDossierSection of nutritionDepotDossier.requiredDossierSections) {
  assert(source.includes(requiredDossierSection), `Dashboard command center missing Research-required dossier section: ${requiredDossierSection}`);
}

for (const requiredNavigationItem of [
  "Executive Summary",
  "Business Identity",
  "Business Snapshot",
  "Ownership",
  "Company History",
  "Business Timeline",
  "Digital Presence",
  "Website Analysis",
  "Brand Analysis",
  "SEO",
  "Google Business Profile",
  "Review Intelligence",
  "Review Theme Analysis",
  "Operational Maturity",
  "Growth Signals",
  "Expansion Signals",
  "Business Network",
  "Market Intelligence",
  "Competitive Landscape",
  "Commercial Ecosystem",
  "Community Presence",
  "Hiring Signals",
  "Strategic Fit",
  "Franchise Compatibility",
  "Conversation Intelligence",
  "Discovery Questions",
  "Verification Checklist",
  "Risk Register",
  "Unknown Register",
  "Alternative Hypotheses",
  "Contradiction Analysis",
  "Scenario Planning",
  "Evidence Matrix",
  "Source Reliability Matrix",
  "Confidence Matrix",
  "Decision Journal",
  "Opportunity Ranking",
  "JR Executive Brief",
  "Executive Call Card",
  "Mission Status",
  "Founder Notes"
]) {
  assert(source.includes(`>${requiredNavigationItem}<`) || source.includes(`${requiredNavigationItem}</a>`), `Command center navigation missing: ${requiredNavigationItem}`);
}

for (const requiredMarkdownFragment of [
  "# Nutrition Depot Executive Due Diligence Dossier v1",
  "## 28. Evidence Matrix",
  "| Claim | Evidence label | Source | Confidence | Contradiction or limitation |",
  "## 29. Source Reliability Matrix",
  "## Workspace Isolation Verification",
  "- Fitness Connection data used: no.",
  "- Route Intelligence used: no.",
  "- Active Pool used: no."
]) {
  assert(source.includes(htmlEscape(requiredMarkdownFragment)), `Dashboard must render complete canonical markdown fragment: ${requiredMarkdownFragment}`);
}

const markdownHash = createHash("sha256").update(nutritionDepotDossierMarkdown).digest("hex");
assert(source.includes(markdownHash), "Dashboard must expose the canonical Research artifact hash.");
assert(source.includes(htmlEscape('"artifactStatus": "completed_canonical_research_dossier"')), "Dashboard must render structured Research JSON artifact.");
assert(source.includes(htmlEscape('"sourceReliabilityMatrix"')), "Dashboard must render structured source reliability matrix.");

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

console.log("Smoothie Depot Founder Dashboard verified: workspace-scoped Research-output surface, mission queue, required franchise development sections, no production data access, and Fitness Connection isolation preserved.");
