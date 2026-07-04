import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  getOperatingProfile,
  normalizeIndustryOutcome
} from "../intelligence/operating-profile-engine.mjs";

const root = resolve(import.meta.dirname, "..");
const readJson = path => JSON.parse(readFileSync(resolve(root, path), "utf8"));

test("Smoothie Depot workspace intelligence plan verifier passes", () => {
  const result = spawnSync("node", ["scripts/verify-smoothie-depot-workspace-intelligence-plan.mjs"], {
    cwd: root,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.status, "passed");
  assert.equal(summary.workspace, "Smoothie Depot");
  assert.equal(summary.decisionMaker, "JR");
  assert.equal(summary.operatingProfile.profileId, "franchise_development");
  assert.equal(summary.intelligenceDomain, "business_acquisition_intelligence");
  assert.equal(summary.isolation.fitnessConnectionIsolationConfirmed, true);
  assert.equal(summary.isolation.routeIntelligenceInfluence, false);
});

test("Franchise Development Operating Profile supports Smoothie Depot candidate outcomes", () => {
  const profile = getOperatingProfile("franchise_development");
  assert.equal(profile.label, "Franchise Development");
  assert.equal(profile.terminology.target, "franchise-owner candidate");
  assert.ok(profile.crmStages.includes("JR Handoff"));
  assert.ok(profile.kpis.includes("commissions_tracked"));

  const normalized = normalizeIndustryOutcome({
    profileId: "franchise_development",
    rawOutcome: "commission eligible",
    visit: {
      businessRef: { source: "test", workspaceId: "smoothie_depot" },
      repRef: { source: "test", name: "Cruz" },
      occurredAt: "2026-07-03T13:00:00.000Z"
    }
  });
  assert.equal(normalized.normalizedOutcome, "sale");
  assert.equal(normalized.recommendationEligibility.canChangeRecommendation, false);
});

test("Smoothie Depot plan includes all required planning contracts", () => {
  const plan = readJson("intelligence/workspaces/smoothie-depot/workspace-intelligence-plan.json");
  const required = [
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

  for (const contractName of required) {
    assert.ok(plan.contracts[contractName], `Missing ${contractName}`);
  }
  assert.equal(plan.contracts.SmoothieDepotCrmPipelineStages.runtimeMutationAuthorized, false);
  assert.equal(plan.contracts.SmoothieDepotDashboardDisplayNeeds.runtimeConsumptionAuthorized, false);
  assert.equal(plan.contracts.CandidateProtectionPeriod.legalDurationAssigned, false);
});

test("Workspace isolation blocks Fitness Connection and route intelligence influence", () => {
  const plan = readJson("intelligence/workspaces/smoothie-depot/workspace-intelligence-plan.json");
  const contracts = readJson("intelligence/contracts/business-acquisition-intelligence-contracts.json");

  assert.equal(plan.workspaceIsolation.fitnessConnectionIsolationConfirmed, true);
  assert.equal(plan.workspaceIsolation.smoothieDepotToFitnessConnectionInfluence, false);
  assert.equal(plan.workspaceIsolation.fitnessConnectionToSmoothieDepotInfluence, false);
  assert.equal(plan.runtimeActivation.routeIntelligenceChanged, false);
  assert.equal(plan.runtimeActivation.activePoolChanged, false);
  assert.equal(plan.runtimeActivation.productionRecommendationChanged, false);
  assert.ok(plan.workspaceIsolation.blockedInfluencePaths.includes("smoothie_depot_candidate_data_to_fitness_connection_route_intelligence"));
  assert.ok(contracts.prohibitions.includes("no_fitness_connection_route_intelligence_influence"));
});
