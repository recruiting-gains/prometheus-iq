import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = path => readFileSync(resolve(root, path), "utf8");
const readJson = path => JSON.parse(read(path));

const failures = [];
const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

const architecture = read("crm/enterprise-lifecycle-architecture.md");
const model = readJson("crm/enterprise-lifecycle-model.json");

const requiredEntities = [
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
];

const requiredProtectedSubsystems = [
  "Dashboard",
  "Companion",
  "Infrastructure",
  "Data",
  "Intelligence Engine"
];

const requiredScaleTargets = [
  "1 company",
  "10 companies",
  "100 companies",
  "enterprise deployments"
];

const entityIds = new Set(model.entities?.map(entity => entity.id));
for (const entity of requiredEntities) {
  assert(entityIds.has(entity), `CRM enterprise model is missing entity: ${entity}`);
}

for (const subsystem of requiredProtectedSubsystems) {
  assert(model.protectedSubsystems?.includes(subsystem), `CRM model must protect subsystem boundary: ${subsystem}`);
  assert(architecture.includes(subsystem), `CRM architecture must mention protected subsystem boundary: ${subsystem}`);
}

for (const target of requiredScaleTargets) {
  assert(model.scaleTargets?.includes(target), `CRM model missing scale target: ${target}`);
  assert(architecture.includes(target), `CRM architecture missing scale target: ${target}`);
}

assert(model.implementationType === "architecture", "CRM v2 must remain architecture-only.");
assert(model.productionBetaSystemsModified === false, "CRM v2 must not modify production beta systems.");
assert(model.externalCommunicationProvidersConnected === false, "CRM v2 must not connect external communication providers.");
assert(model.sourceFallbacks?.["PRODUCT_VISION.md"] === "PRODUCT_VISION.md", "CRM v2 must record PRODUCT_VISION canonical source.");
assert(model.sourceFallbacks?.["SALES_FOUNDATION.md"] === "sales/", "CRM v2 must record SALES_FOUNDATION fallback.");

const totalHealthWeight = (model.healthScoring?.dimensions || []).reduce((sum, dimension) => sum + Number(dimension.weight || 0), 0);
assert(totalHealthWeight === 100, `CRM health score weights must equal 100, found ${totalHealthWeight}.`);
assert(model.healthScoring?.bands?.includes("healthy"), "CRM health scoring must include healthy band.");
assert(model.healthScoring?.bands?.includes("watch"), "CRM health scoring must include watch band.");
assert(model.healthScoring?.bands?.includes("at_risk"), "CRM health scoring must include at_risk band.");

const requiredWorkflows = ["beta_to_pilot", "pilot_to_customer", "customer_onboarding", "customer_success_review", "expansion", "renewal"];
const workflowIds = new Set(model.workflows?.map(workflow => workflow.id));
for (const workflow of requiredWorkflows) {
  assert(workflowIds.has(workflow), `CRM model missing workflow: ${workflow}`);
}

const requiredReports = [
  "active_beta_companies",
  "active_pilot_companies",
  "enterprise_opportunities_by_stage",
  "accounts_by_health_band",
  "upcoming_renewals",
  "expansion_opportunities",
  "adoption_by_company_region_district_location"
];
for (const report of requiredReports) {
  assert(model.reports?.includes(report), `CRM model missing report: ${report}`);
}

for (const entity of model.entities || []) {
  assert(Array.isArray(entity.requiredFields) && entity.requiredFields.length >= 4, `CRM entity ${entity.id} needs requiredFields.`);
  assert(entity.purpose && entity.purpose.length >= 40, `CRM entity ${entity.id} needs a concrete purpose.`);
}

if (failures.length) {
  console.error("CRM enterprise foundation validation failed:");
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log("CRM enterprise foundation validation passed: lifecycle entities, protected boundaries, scale targets, health scoring, workflows, and reports.");
}
