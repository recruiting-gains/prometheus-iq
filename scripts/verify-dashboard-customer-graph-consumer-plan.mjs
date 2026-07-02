import fs from "node:fs";

const read = path => fs.readFileSync(path, "utf8");
const readJson = path => JSON.parse(read(path));
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const intelligenceContracts = readJson("intelligence/contracts/customer-intelligence-graph-contracts.json");
const plan = readJson("dashboard/contracts/customer-intelligence-graph-consumer-plan.json");
const doc = read("docs/dashboard-customer-intelligence-graph-consumer-plan.md");

assert(plan.status === "planning_only", "Dashboard customer graph plan must remain planning_only.");
assert(plan.sourceIntelligenceContractVersion === intelligenceContracts.version, "Dashboard plan must reference the current Intelligence graph contract version.");
assert(plan.sourceConsumerContract === "DashboardCustomerGraphContract", "Dashboard plan must target the Intelligence-owned DashboardCustomerGraphContract.");
assert(Boolean(intelligenceContracts.contracts?.DashboardCustomerGraphContract), "Intelligence graph contracts must expose DashboardCustomerGraphContract.");
assert(intelligenceContracts.status === "architecture_only", "Customer Intelligence Graph source must remain architecture_only.");
assert(intelligenceContracts.consumerImplementationActive === false, "Customer Intelligence Graph consumers must remain inactive.");
assert(intelligenceContracts.dashboardRuntimeChanged === false, "Customer Intelligence Graph must not change Dashboard runtime.");
assert(plan.runtimeConsumptionAuthorized === false, "Dashboard plan must not authorize runtime graph consumption.");
assert(plan.dashboardRuntimeChanged === false, "Dashboard plan must not change Dashboard runtime.");
assert(plan.productionBehaviorChanged === false, "Dashboard plan must not change production behavior.");
assert(plan.productionScoringChanged === false, "Dashboard plan must not change production scoring.");
assert(plan.productionRecommendationsChanged === false, "Dashboard plan must not change production recommendations.");
assert(plan.activePoolChanged === false, "Dashboard plan must not change Active Pool.");
assert(plan.companionTouched === false, "Dashboard plan must not touch Companion.");

for (const nodeType of intelligenceContracts.nodeTypes) {
  assert(plan.allowedSourceNodeTypes.includes(nodeType), `Dashboard plan missing source node type ${nodeType}.`);
}

for (const relationshipType of intelligenceContracts.relationshipTypes) {
  assert(plan.allowedSourceRelationshipTypes.includes(relationshipType), `Dashboard plan missing source relationship type ${relationshipType}.`);
}

const requiredSurfaces = [
  "Founder Insights",
  "Owner Territory Intelligence",
  "Places",
  "Route Intelligence",
  "Rep Today",
  "Find/Search"
];

for (const surface of requiredSurfaces) {
  assert(plan.futureDashboardSurfaces.some(entry => entry.surface === surface), `Dashboard plan missing surface ${surface}.`);
  assert(doc.includes(surface), `Dashboard planning doc missing surface ${surface}.`);
}

const requiredViews = [
  "territory_relationships",
  "business_relationships",
  "visit_outcome_history",
  "rep_activity_patterns",
  "opportunity_clusters",
  "confidence_propagation"
];

for (const view of requiredViews) {
  assert(plan.futureViews.some(entry => entry.view === view), `Dashboard plan missing future view ${view}.`);
  assert(doc.includes(view) || doc.toLowerCase().includes(view.replaceAll("_", " ")), `Dashboard planning doc missing future view ${view}.`);
}

for (const entry of plan.futureDashboardSurfaces) {
  assert(entry.activationStatus === "future_only", `Dashboard surface ${entry.surface} must remain future_only.`);
}

for (const blocked of [
  "authorized_dashboard_runtime_consumption_contract",
  "customer_scoped_graph_snapshot_export",
  "reviewed_evidence_display_policy",
  "confidence_propagation_activation_policy"
]) {
  assert(plan.blockedUntil.includes(blocked), `Dashboard plan missing blocker ${blocked}.`);
}

for (const prohibited of [
  "no_consumer_implementation",
  "no_cross_customer_graph_bleed",
  "no_confidence_propagation_activation"
]) {
  assert(intelligenceContracts.prohibitions.includes(prohibited), `Intelligence graph contract missing prohibition ${prohibited}.`);
}

console.log("Dashboard Customer Intelligence Graph consumer plan verified: planning-only surfaces, future views, source contracts, and runtime non-activation gates are valid.");
