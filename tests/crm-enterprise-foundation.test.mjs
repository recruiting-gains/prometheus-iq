import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = path => readFileSync(resolve(root, path), "utf8");
const model = JSON.parse(read("crm/enterprise-lifecycle-model.json"));

test("CRM enterprise foundation is architecture-only and protects production subsystem boundaries", () => {
  assert.equal(model.implementationType, "architecture");
  assert.equal(model.productionBetaSystemsModified, false);
  assert.equal(model.externalCommunicationProvidersConnected, false);
  assert.deepEqual(model.protectedSubsystems, [
    "Dashboard",
    "Companion",
    "Infrastructure",
    "Data",
    "Intelligence Engine"
  ]);
});

test("CRM enterprise foundation covers requested lifecycle entities", () => {
  const entityIds = new Set(model.entities.map(entity => entity.id));
  for (const entity of [
    "company_account",
    "contact",
    "decision_maker",
    "pilot_company",
    "enterprise_opportunity",
    "beta_company",
    "customer_onboarding",
    "customer_success_record",
    "expansion_opportunity",
    "renewal_lifecycle",
    "executive_relationship",
    "customer_health_score",
    "account_timeline_event",
    "meeting_history",
    "product_adoption_snapshot",
    "success_milestone",
    "organization_location",
    "organization_hierarchy_node"
  ]) {
    assert.equal(entityIds.has(entity), true, `missing ${entity}`);
  }
});

test("CRM enterprise foundation supports one-company through enterprise scale", () => {
  assert.deepEqual(model.scaleTargets, [
    "1 company",
    "10 companies",
    "100 companies",
    "enterprise deployments"
  ]);
  assert.ok(model.hierarchyLevels.includes("company"));
  assert.ok(model.hierarchyLevels.includes("region"));
  assert.ok(model.hierarchyLevels.includes("district"));
  assert.ok(model.hierarchyLevels.includes("location"));
});

test("CRM health scoring is transparent and totals 100 weight points", () => {
  const total = model.healthScoring.dimensions.reduce((sum, dimension) => sum + dimension.weight, 0);
  assert.equal(total, 100);
  assert.deepEqual(model.healthScoring.bands, ["healthy", "watch", "at_risk"]);
  assert.deepEqual(model.healthScoring.dimensions.map(dimension => dimension.id), [
    "adoption",
    "field_activity",
    "outcome_proof",
    "executive_alignment",
    "renewal_risk",
    "support_load",
    "data_completeness"
  ]);
});

test("CRM enterprise workflows cover beta, pilot, customer success, expansion, and renewal", () => {
  const workflowIds = new Set(model.workflows.map(workflow => workflow.id));
  for (const workflow of [
    "beta_to_pilot",
    "pilot_to_customer",
    "customer_onboarding",
    "customer_success_review",
    "expansion",
    "renewal"
  ]) {
    assert.equal(workflowIds.has(workflow), true, `missing workflow ${workflow}`);
  }
});

test("CRM enterprise reports cover pipeline, health, renewal, expansion, and adoption views", () => {
  for (const report of [
    "active_beta_companies",
    "active_pilot_companies",
    "enterprise_opportunities_by_stage",
    "accounts_by_health_band",
    "upcoming_renewals",
    "expansion_opportunities",
    "adoption_by_company_region_district_location"
  ]) {
    assert.equal(model.reports.includes(report), true, `missing report ${report}`);
  }
});
