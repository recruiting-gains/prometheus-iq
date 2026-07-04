import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  getOperatingProfile,
  loadOperatingProfiles,
  normalizeIndustryOutcome
} from "../intelligence/operating-profile-engine.mjs";

const root = resolve(import.meta.dirname, "..");
const readJson = path => JSON.parse(readFileSync(resolve(root, path), "utf8"));
const readText = path => readFileSync(resolve(root, path), "utf8");

const plan = readJson("intelligence/workspaces/smoothie-depot/workspace-intelligence-plan.json");
const contracts = readJson("intelligence/contracts/business-acquisition-intelligence-contracts.json");
const profileRegistry = loadOperatingProfiles();
const profile = getOperatingProfile("franchise_development", profileRegistry);
const doc = readText("intelligence/workspaces/smoothie-depot/workspace-intelligence-plan.md");
const systemMap = readText("PROMETHEUS_SYSTEM_MAP.md");

const failures = [];
const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

const requiredContracts = [
  "FranchiseCandidateSourcing",
  "BusinessProspectResearch",
  "FranchiseReadinessAssessment",
  "CandidateIntelligenceProfile",
  "SmoothieDepotCrmPipelineStages",
  "SmoothieDepotDashboardDisplayNeeds",
  "JrHandoffPackage",
  "CommissionTracking",
  "CandidateProtectionPeriod",
  "WorkspaceIsolationGuardrails"
];

assert(plan.workspaceId === "smoothie_depot", "Plan must be scoped to Smoothie Depot workspace.");
assert(plan.workspaceName === "Smoothie Depot", "Plan must name Smoothie Depot.");
assert(plan.decisionMaker === "JR", "Plan must identify JR as decision maker.");
assert(plan.operatingProfileId === "franchise_development", "Plan must use Franchise Development Operating Profile.");
assert(profile.label === "Franchise Development", "Franchise Development Operating Profile must exist.");
assert(plan.intelligenceDomain === "business_acquisition_intelligence", "Plan must use Business Acquisition Intelligence domain.");
assert(contracts.domainId === "business_acquisition_intelligence", "Contracts must confirm Business Acquisition Intelligence domain.");
assert(plan.newSubsystemCreated === false && contracts.newSubsystemCreated === false, "Plan must not create a new subsystem.");
assert(plan.workspaceIsolation.fitnessConnectionIsolationConfirmed === true, "Fitness Connection isolation must be confirmed.");
assert(plan.workspaceIsolation.routeIntelligenceInfluence === false, "Smoothie Depot must not influence Route Intelligence.");
assert(plan.workspaceIsolation.fitnessConnectionRouteInfluence === false, "Smoothie Depot must not influence Fitness Connection routes.");
assert(plan.workspaceIsolation.protectedWorkspaceIds.includes("fitness_connection"), "Fitness Connection workspace must be protected.");
assert(systemMap.includes("Smoothie Depot Workspace uses the Franchise Development Operating Profile"), "System map must preserve Smoothie Depot workspace isolation governance.");
assert(systemMap.includes("Smoothie Depot candidate intelligence must never influence Fitness Connection route recommendations"), "System map must block Smoothie Depot to Fitness Connection influence.");

for (const [flag, value] of Object.entries(plan.runtimeActivation)) {
  assert(value === false, `Runtime activation flag ${flag} must remain false.`);
}

for (const contractName of requiredContracts) {
  assert(Boolean(plan.contracts?.[contractName]), `Plan missing contract ${contractName}.`);
  assert(Boolean(contracts.contracts?.[contractName]), `Contract registry missing ${contractName}.`);
  assert(contracts.requiredContracts.includes(contractName), `Contract registry does not require ${contractName}.`);
}

for (const prohibition of [
  "no_fitness_connection_data_touch",
  "no_fitness_connection_route_intelligence_influence",
  "no_smoothie_depot_to_fitness_connection_learning",
  "no_dashboard_runtime_changes",
  "no_crm_runtime_changes",
  "no_website_changes",
  "no_mobile_changes",
  "no_companion_changes",
  "no_new_subsystem"
]) {
  assert(contracts.prohibitions.includes(prohibition), `Missing prohibition ${prohibition}.`);
}

const franchiseOutcome = normalizeIndustryOutcome({
  profileId: "franchise_development",
  rawOutcome: "JR handoff",
  visit: {
    businessRef: { source: "workspace_plan", workspaceId: "smoothie_depot", name: "Candidate fixture" },
    repRef: { source: "workspace_plan", name: "Cruz" },
    occurredAt: "2026-07-03T12:00:00.000Z"
  }
});
assert(franchiseOutcome.normalizedOutcome === "appointment", "JR handoff must normalize as a reviewable appointment outcome.");
assert(franchiseOutcome.recommendationEligibility.canChangeRecommendation === false, "Franchise Development outcomes must not change recommendations.");

for (const phrase of [
  "Franchise Candidate Sourcing",
  "Business Prospect Research",
  "Franchise Readiness Assessment",
  "Candidate Intelligence Profile",
  "JR Handoff Package",
  "Commission Tracking",
  "Candidate Protection Period",
  "Workspace Isolation Guardrails"
]) {
  assert(doc.includes(phrase), `Workspace plan doc missing ${phrase}.`);
}

const summary = {
  status: failures.length ? "failed" : "passed",
  workspace: plan.workspaceName,
  workspaceId: plan.workspaceId,
  decisionMaker: plan.decisionMaker,
  operatingProfile: {
    profileId: profile.profileId,
    label: profile.label
  },
  intelligenceDomain: plan.intelligenceDomain,
  contractsCreated: requiredContracts,
  isolation: {
    fitnessConnectionIsolationConfirmed: plan.workspaceIsolation.fitnessConnectionIsolationConfirmed,
    routeIntelligenceInfluence: plan.workspaceIsolation.routeIntelligenceInfluence,
    fitnessConnectionRouteInfluence: plan.workspaceIsolation.fitnessConnectionRouteInfluence
  },
  runtimeActivation: plan.runtimeActivation,
  normalizedSample: {
    rawOutcome: "JR handoff",
    normalizedOutcome: franchiseOutcome.normalizedOutcome,
    canChangeRecommendation: franchiseOutcome.recommendationEligibility.canChangeRecommendation
  },
  failures
};

console.log(JSON.stringify(summary, null, 2));
if (failures.length) process.exitCode = 1;
