import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const readJson = path => JSON.parse(readFileSync(resolve(root, path), "utf8"));

test("Smoothie Depot CRM planning validator passes", () => {
  const result = spawnSync("node", ["scripts/validate-smoothie-depot-crm-planning.mjs"], {
    cwd: root,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.status, "passed");
  assert.equal(summary.workspaceId, "smoothie_depot");
  assert.equal(summary.operatingProfile, "franchise_development");
  assert.equal(summary.implementationType, "planning_contracts_only");
  assert.equal(summary.isolation.fitnessConnectionSeparationConfirmed, true);
  assert.equal(summary.isolation.runtimeCandidateRecordsAllowed, false);
});

test("Smoothie Depot CRM candidate pipeline uses the requested stage sequence", () => {
  const plan = readJson("crm/workspaces/smoothie-depot/candidate-pipeline-contracts.json");
  assert.deepEqual(plan.pipeline.stages, [
    "Business Identified",
    "Owner Research Needed",
    "Contact Found",
    "Outreach Sent",
    "Interested",
    "Discovery Scheduled",
    "Discovery Complete",
    "Qualified Candidate",
    "JR Handoff",
    "FDD / Review",
    "Closed Won",
    "Not Qualified",
    "No Response"
  ]);
  assert.equal(plan.pipeline.handoffStage, "JR Handoff");
  assert.equal(plan.pipeline.closedSaleStage, "Closed Won");
});

test("Smoothie Depot CRM candidate record contract includes all requested fields", () => {
  const plan = readJson("crm/workspaces/smoothie-depot/candidate-pipeline-contracts.json");
  const fields = new Set(plan.contracts.candidate_record_contract.requiredFields.map(field => field.label));

  for (const label of [
    "candidate name",
    "business name",
    "business category",
    "phone",
    "email",
    "website",
    "address",
    "source",
    "Google rating",
    "review count",
    "owner/contact status",
    "preferred territory",
    "liquid capital self-reported",
    "net worth self-reported",
    "credit range self-reported",
    "number of locations desired",
    "readiness assessment status",
    "JR handoff status",
    "protected candidate start date",
    "protected candidate expiration date",
    "commission forecast",
    "next follow-up date",
    "notes"
  ]) {
    assert.ok(fields.has(label), `Missing candidate field ${label}`);
  }
});

test("Smoothie Depot CRM planning remains workspace-isolated and runtime-free", () => {
  const plan = readJson("crm/workspaces/smoothie-depot/candidate-pipeline-contracts.json");

  assert.equal(plan.workspaceIsolation.allowedWorkspaceId, "smoothie_depot");
  assert.equal(plan.workspaceIsolation.doNotTouchFitnessConnection, true);
  assert.equal(plan.workspaceIsolation.doNotMixWithFitnessConnection, true);
  assert.equal(plan.workspaceIsolation.fitnessConnectionSeparationConfirmed, true);
  assert.equal(plan.workspaceIsolation.runtimeCandidateRecordsAllowed, false);
  assert.ok(plan.workspaceIsolation.protectedWorkspaceIds.includes("fitness_connection"));

  for (const value of Object.values(plan.protectedSubsystems)) {
    assert.equal(value, false);
  }
});
