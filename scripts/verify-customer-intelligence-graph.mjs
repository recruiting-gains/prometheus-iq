import {
  buildCustomerGraphConsumerContract,
  buildCustomerGraphNode,
  buildCustomerGraphRelationship,
  buildCustomerGraphSnapshot,
  loadCustomerIntelligenceGraphContracts,
  validateCustomerGraphContracts,
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

const consumers = ["Dashboard", "CRM", "Mobile", "Companion", "Research", "Sales"];
const consumerContracts = consumers.map(consumer => buildCustomerGraphConsumerContract(customerId, consumer, { contracts }));
for (const contract of consumerContracts) {
  if (contract.status !== "architecture_only") failures.push(`${contract.consumer} contract is not architecture_only`);
  if (contract.runtimeConsumptionAuthorized === true) failures.push(`${contract.consumer} contract authorizes runtime consumption`);
  if (contract.runtimeMutationAuthorized === true) failures.push(`${contract.consumer} contract authorizes runtime mutation`);
  if (contract.mobileRuntimeChanged === true) failures.push(`${contract.consumer} contract changes Mobile runtime`);
  if (contract.companionRuntimeChanged === true) failures.push(`${contract.consumer} contract changes Companion runtime`);
}

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
    productionRecommendationsChanged: snapshot.safety.productionRecommendationsChanged,
    confidencePropagationActive: snapshot.safety.confidencePropagationActive
  },
  productionSafety: {
    consumerImplementationActive: contracts.consumerImplementationActive,
    productionScoringChanged: contracts.productionScoringChanged,
    productionRecommendationsChanged: contracts.productionRecommendationsChanged,
    dashboardRuntimeChanged: contracts.dashboardRuntimeChanged,
    mobileRuntimeChanged: contracts.mobileRuntimeChanged,
    companionRuntimeChanged: contracts.companionRuntimeChanged,
    crmRuntimeChanged: contracts.crmRuntimeChanged,
    infrastructureChanged: contracts.infrastructureChanged
  },
  failureReasons: failures
};

console.log(JSON.stringify(summary, null, 2));
if (failures.length) process.exitCode = 1;
