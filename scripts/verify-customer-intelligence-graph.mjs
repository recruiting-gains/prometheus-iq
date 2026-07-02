import {
  buildCustomerGraphConsumerContract,
  buildCustomerGraphNode,
  buildCustomerGraphQueryContract,
  buildCustomerGraphRelationship,
  buildCustomerGraphSnapshot,
  loadCustomerIntelligenceGraphContracts,
  queryCustomerGraphSnapshot,
  validateCustomerGraphContracts,
  validateCustomerGraphQueryContract,
  validateCustomerGraphSnapshot
} from "../intelligence/customer-intelligence-graph.mjs";

const contracts = loadCustomerIntelligenceGraphContracts();
const failures = validateCustomerGraphContracts(contracts);
const customerId = "customer_fixture_prometheus";
const validFrom = "2026-07-02T12:00:00.000Z";

const nodes = contracts.nodeTypes.map(nodeType => buildCustomerGraphNode({
  customerId,
  nodeType,
  sourceRefs: [{ source: "fixture", id: nodeType.toLowerCase().replace(/[^a-z0-9]+/g, "-") }],
  attributes: { label: `${nodeType} fixture` },
  validFrom
}));

const nodeByType = new Map(nodes.map(node => [node.nodeType, node]));
const relationshipPairs = {
  "Visited": ["Rep", "Business"],
  "Recommended": ["Operating Profile", "Business"],
  "Converted": ["Lead", "Outcome"],
  "Follow-up": ["Visit", "Lead"],
  "Nearby": ["Business", "Territory"],
  "Similar": ["Business", "Business"],
  "Repeated": ["Visit", "Business"],
  "Successful": ["Outcome", "Learning Signal"],
  "Inactive": ["Business", "Outcome"]
};

const relationships = Object.entries(relationshipPairs).map(([relationshipType, [fromType, toType]]) => buildCustomerGraphRelationship({
  customerId,
  relationshipType,
  fromNodeId: nodeByType.get(fromType).nodeId,
  toNodeId: nodeByType.get(toType).nodeId,
  sourceEvidenceIds: [`fixture_${relationshipType.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`],
  validFrom
}));

const snapshot = buildCustomerGraphSnapshot({
  customerId,
  operatingProfileId: "general_outside_sales",
  nodes,
  relationships
});
failures.push(...validateCustomerGraphSnapshot(snapshot, contracts));

const consumers = ["Dashboard", "CRM", "Mobile", "Website", "Companion", "Research", "Sales"];
const consumerContracts = consumers.map(consumer => buildCustomerGraphConsumerContract(customerId, consumer, { contracts }));
for (const contract of consumerContracts) {
  if (contract.status !== "architecture_only") failures.push(`${contract.consumer} contract is not architecture_only`);
  if (contract.runtimeConsumptionAuthorized === true) failures.push(`${contract.consumer} contract authorizes runtime consumption`);
  if (contract.runtimeMutationAuthorized === true) failures.push(`${contract.consumer} contract authorizes runtime mutation`);
  if (contract.mobileRuntimeChanged === true) failures.push(`${contract.consumer} contract changes Mobile runtime`);
  if (contract.websiteRuntimeChanged === true) failures.push(`${contract.consumer} contract changes Website runtime`);
  if (contract.companionRuntimeChanged === true) failures.push(`${contract.consumer} contract changes Companion runtime`);
}

const queryContracts = consumers.map(consumer => buildCustomerGraphQueryContract(customerId, consumer, {
  contracts,
  queryType: "by_node_type",
  filters: { nodeType: "Business" }
}));
for (const contract of queryContracts) {
  failures.push(...validateCustomerGraphQueryContract(contract, contracts));
}

const dashboardBusinessQuery = {
  ...queryContracts.find(contract => contract.consumer === "Dashboard"),
  queryType: "by_node_type",
  filters: { nodeType: "Business" }
};
const queryResult = queryCustomerGraphSnapshot(snapshot, dashboardBusinessQuery, { contracts });
if (queryResult.failureReasons.length) failures.push(...queryResult.failureReasons);
if (queryResult.readOnly !== true) failures.push("Customer graph query result must remain readOnly");
if (queryResult.safety.productionRecommendationsChanged !== false) failures.push("Customer graph query result changes recommendations");

const summary = {
  status: failures.length ? "failed" : "passed",
  graphVersion: contracts.version,
  nodeTypes: contracts.nodeTypes,
  relationshipTypes: contracts.relationshipTypes,
  graphObjectives: contracts.graphObjectives,
  futureConsumerContracts: contracts.futureConsumerContracts,
  sampleSnapshot: {
    customerId: snapshot.customerId,
    operatingProfileId: snapshot.operatingProfileId,
    nodeCount: snapshot.nodes.length,
    relationshipCount: snapshot.relationships.length,
    readOnly: snapshot.readOnly,
    queryable: snapshot.queryIndex.queryable,
    evidenceHistoryCount: snapshot.content.evidenceHistory.length,
    provenanceSources: snapshot.provenance.sourceRefs.length,
    productionRecommendationsChanged: snapshot.safety.productionRecommendationsChanged,
    confidencePropagationActive: snapshot.safety.confidencePropagationActive
  },
  sampleQuery: {
    consumer: dashboardBusinessQuery.consumer,
    queryType: dashboardBusinessQuery.queryType,
    resultNodes: queryResult.nodes.length,
    readOnly: queryResult.readOnly,
    productionRecommendationsChanged: queryResult.safety.productionRecommendationsChanged
  },
  productionSafety: {
    consumerImplementationActive: contracts.consumerImplementationActive,
    readOnly: contracts.readOnly,
    automaticLearningActive: contracts.automaticLearningActive,
    automaticScoringActive: contracts.automaticScoringActive,
    productionScoringChanged: contracts.productionScoringChanged,
    productionRecommendationsChanged: contracts.productionRecommendationsChanged,
    activePoolChanged: contracts.activePoolChanged,
    dashboardRuntimeChanged: contracts.dashboardRuntimeChanged,
    websiteRuntimeChanged: contracts.websiteRuntimeChanged,
    mobileRuntimeChanged: contracts.mobileRuntimeChanged,
    companionRuntimeChanged: contracts.companionRuntimeChanged,
    crmRuntimeChanged: contracts.crmRuntimeChanged,
    infrastructureChanged: contracts.infrastructureChanged
  },
  failureReasons: failures
};

console.log(JSON.stringify(summary, null, 2));
if (failures.length) process.exitCode = 1;
