import fs from "node:fs";

const read = path => fs.readFileSync(path, "utf8");
const readJson = path => JSON.parse(read(path));
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const contracts = readJson("intelligence/contracts/customer-intelligence-graph-contracts.json");
const plan = readJson("dashboard/contracts/customer-graph-snapshot-consumer-plan.json");
const doc = read("docs/dashboard-customer-graph-snapshot-consumer-plan.md");

assert(plan.status === "planning_only", "Dashboard CustomerGraphSnapshot plan must remain planning_only.");
assert(plan.sourceIntelligenceContractVersion === contracts.version, "Dashboard snapshot plan must reference the current Intelligence graph contract version.");
assert(plan.sourceSnapshotContract === "CustomerGraphSnapshot", "Dashboard snapshot plan must target CustomerGraphSnapshot.");
assert(plan.sourceQueryContract === "DashboardCustomerGraphQueryContract", "Dashboard snapshot plan must target DashboardCustomerGraphQueryContract.");
assert(Boolean(contracts.contracts?.CustomerGraphSnapshot), "Intelligence contracts must expose CustomerGraphSnapshot.");
assert(Boolean(contracts.contracts?.DashboardCustomerGraphQueryContract), "Intelligence contracts must expose DashboardCustomerGraphQueryContract.");
assert(contracts.activationMode === "read_only_customer_scoped_snapshots", "Intelligence graph contract must expose read-only customer-scoped snapshots.");
assert(contracts.readOnly === true, "CustomerGraphSnapshots must remain readOnly.");
assert(contracts.queryable === true, "CustomerGraphSnapshots must remain queryable.");
assert(contracts.customerIsolationRequired === true, "CustomerGraphSnapshots must require customer isolation.");
assert(contracts.humanOverridePreserved === true, "CustomerGraphSnapshots must preserve human override.");
assert(contracts.consumerImplementationActive === false, "CustomerGraphSnapshot consumers must remain inactive.");
assert(contracts.dashboardRuntimeChanged === false, "CustomerGraphSnapshot source must not change Dashboard runtime.");
assert(contracts.productionScoringChanged === false, "CustomerGraphSnapshot source must not change production scoring.");
assert(contracts.productionRecommendationsChanged === false, "CustomerGraphSnapshot source must not change production recommendations.");
assert(contracts.activePoolChanged === false, "CustomerGraphSnapshot source must not change Active Pool.");
assert(contracts.automaticLearningActive === false, "CustomerGraphSnapshot source must not activate automatic learning.");
assert(contracts.automaticScoringActive === false, "CustomerGraphSnapshot source must not activate automatic scoring.");

for (const field of [
  "readOnly",
  "queryable",
  "customerIsolationRequired"
]) {
  assert(plan[field] === true, `Dashboard snapshot plan must keep ${field}=true.`);
}

for (const field of [
  "runtimeConsumptionAuthorized",
  "dashboardRuntimeChanged",
  "productionBehaviorChanged",
  "productionScoringChanged",
  "productionRecommendationsChanged",
  "activePoolChanged",
  "crmChanged",
  "mobileChanged",
  "websiteChanged",
  "companionTouched",
  "intelligenceEngineChanged"
]) {
  assert(plan[field] === false, `Dashboard snapshot plan must keep ${field}=false.`);
}

for (const contentKey of contracts.snapshotContent || []) {
  assert(plan.allowedSnapshotContent.includes(contentKey), `Dashboard snapshot plan missing snapshot content ${contentKey}.`);
  assert(doc.includes(contentKey) || doc.toLowerCase().includes(contentKey.replaceAll("_", " ")), `Dashboard snapshot doc missing snapshot content ${contentKey}.`);
}

for (const queryType of contracts.queryTypes || []) {
  assert(plan.allowedQueryTypes.includes(queryType), `Dashboard snapshot plan missing query type ${queryType}.`);
}

const requiredSurfaces = [
  "Customer Intelligence Overview",
  "Territory History",
  "Visit Outcome Patterns",
  "Rep Activity Relationships",
  "Opportunity Clusters",
  "Confidence Provenance Summaries",
  "Operating Profile Insights"
];

for (const surface of requiredSurfaces) {
  assert(plan.futureDashboardSurfaces.some(entry => entry.surface === surface), `Dashboard snapshot plan missing surface ${surface}.`);
  assert(doc.includes(surface), `Dashboard snapshot doc missing surface ${surface}.`);
}

for (const entry of plan.futureDashboardSurfaces) {
  assert(entry.activationStatus === "future_only", `Dashboard snapshot surface ${entry.surface} must remain future_only.`);
  assert(Array.isArray(entry.queryTypes) && entry.queryTypes.length > 0, `Dashboard snapshot surface ${entry.surface} must define queryTypes.`);
  for (const queryType of entry.queryTypes) {
    assert(contracts.queryTypes.includes(queryType), `Dashboard snapshot surface ${entry.surface} uses unsupported query type ${queryType}.`);
  }
}

for (const policy of [
  "read-only intelligence",
  "Do not mutate",
  "confidence propagation remains inactive",
  "cross-customer snapshot data as unavailable",
  "human override state"
]) {
  assert(plan.readOnlyDisplayPolicies.some(item => item.includes(policy)) || doc.includes(policy), `Dashboard snapshot plan missing read-only policy: ${policy}.`);
}

for (const requirement of [
  "active customerId",
  "customerId differs",
  "partitioned by customerId",
  "No cross-customer",
  "tenant context is missing"
]) {
  assert(plan.customerTenantIsolationRequirements.some(item => item.includes(requirement)) || doc.includes(requirement), `Dashboard snapshot plan missing tenant isolation requirement: ${requirement}.`);
}

for (const requirement of [
  "why the insight is shown",
  "what evidence supports it",
  "how confident the system is",
  "what changed",
  "what should happen next",
  "generatedBy",
  "human override state"
]) {
  assert(plan.explainabilityRequirements.some(item => item.includes(requirement)) || doc.includes(requirement), `Dashboard snapshot plan missing explainability requirement: ${requirement}.`);
}

for (const blocker of [
  "authorized_dashboard_snapshot_query_contract",
  "customer_scoped_snapshot_delivery_path",
  "tenant_context_contract",
  "role_based_provenance_display_policy",
  "confidence_propagation_activation_policy",
  "dashboard_runtime_snapshot_tests"
]) {
  assert(plan.blockedUntil.includes(blocker), `Dashboard snapshot plan missing blocker ${blocker}.`);
}

for (const prohibited of [
  "no_production_scoring",
  "no_production_recommendation_changes",
  "no_dashboard_changes",
  "no_consumer_implementation",
  "no_cross_customer_graph_bleed",
  "no_confidence_propagation_activation"
]) {
  assert(contracts.prohibitions.includes(prohibited), `Intelligence graph contract missing prohibition ${prohibited}.`);
}

console.log("Dashboard CustomerGraphSnapshot consumer plan verified: read-only surfaces, tenant isolation, display policies, explainability, and runtime non-activation gates are valid.");
