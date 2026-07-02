import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const customerIntelligenceGraphVersion = "customer-intelligence-graph-v1";

const repoRoot = resolve(import.meta.dirname, "..");
const contractPath = "intelligence/contracts/customer-intelligence-graph-contracts.json";

function readJson(path) {
  return JSON.parse(readFileSync(resolve(repoRoot, path), "utf8"));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function stableId(prefix, value) {
  const digest = createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex").slice(0, 16);
  return `${prefix}_${digest}`;
}

function normalizeLabel(value) {
  return String(value || "").trim().toLowerCase().replace(/[_\s]+/g, " ");
}

function findCanonical(value, allowed) {
  const normalized = normalizeLabel(value);
  return allowed.find(item => normalizeLabel(item) === normalized) || "";
}

function safetyFlags() {
  return {
    consumerImplementationActive: false,
    productionScoringChanged: false,
    productionRecommendationsChanged: false,
    dashboardRuntimeChanged: false,
    mobileRuntimeChanged: false,
    companionRuntimeChanged: false,
    crmRuntimeChanged: false,
    confidencePropagationActive: false
  };
}

export function loadCustomerIntelligenceGraphContracts() {
  return readJson(contractPath);
}

export function normalizeCustomerGraphNodeType(nodeType, contracts = loadCustomerIntelligenceGraphContracts()) {
  const canonical = findCanonical(nodeType, contracts.nodeTypes);
  if (!canonical) throw new Error(`Unsupported Customer Intelligence Graph node type: ${nodeType}`);
  return canonical;
}

export function normalizeCustomerGraphRelationshipType(relationshipType, contracts = loadCustomerIntelligenceGraphContracts()) {
  const canonical = findCanonical(relationshipType, contracts.relationshipTypes);
  if (!canonical) throw new Error(`Unsupported Customer Intelligence Graph relationship type: ${relationshipType}`);
  return canonical;
}

export function buildCustomerGraphNode(input, options = {}) {
  const contracts = options.contracts || loadCustomerIntelligenceGraphContracts();
  const nodeType = normalizeCustomerGraphNodeType(input.nodeType, contracts);
  const customerId = input.customerId || options.customerId;
  if (!customerId) throw new Error("CustomerGraphNode requires customerId");
  const sourceRefs = input.sourceRefs || [];
  const validFrom = input.validFrom || input.observedAt || new Date(0).toISOString();

  return {
    nodeId: input.nodeId || stableId("cig_node", { customerId, nodeType, sourceRefs, attributes: input.attributes || {} }),
    contractVersion: contracts.version,
    nodeType,
    customerId,
    sourceRefs,
    attributes: clone(input.attributes || {}),
    reviewState: input.reviewState || "architecture_only_reviewable",
    sensitivity: input.sensitivity || "customer_private",
    validFrom,
    validUntil: input.validUntil || null,
    safety: safetyFlags()
  };
}

export function buildCustomerGraphRelationship(input, options = {}) {
  const contracts = options.contracts || loadCustomerIntelligenceGraphContracts();
  const relationshipType = normalizeCustomerGraphRelationshipType(input.relationshipType, contracts);
  const customerId = input.customerId || options.customerId;
  if (!customerId) throw new Error("CustomerGraphRelationship requires customerId");
  if (!input.fromNodeId || !input.toNodeId) throw new Error("CustomerGraphRelationship requires fromNodeId and toNodeId");
  const validFrom = input.validFrom || input.observedAt || new Date(0).toISOString();

  return {
    relationshipId: input.relationshipId || stableId("cig_rel", {
      customerId,
      relationshipType,
      fromNodeId: input.fromNodeId,
      toNodeId: input.toNodeId,
      sourceEvidenceIds: input.sourceEvidenceIds || []
    }),
    contractVersion: contracts.version,
    relationshipType,
    fromNodeId: input.fromNodeId,
    toNodeId: input.toNodeId,
    customerId,
    sourceEvidenceIds: [...(input.sourceEvidenceIds || [])],
    confidenceSeed: {
      propagationEligible: false,
      propagationActive: false,
      evidenceCount: Number(input.evidenceCount || (input.sourceEvidenceIds || []).length),
      reason: "architecture_only_no_confidence_propagation"
    },
    reviewState: input.reviewState || "architecture_only_reviewable",
    validFrom,
    validUntil: input.validUntil || null,
    safety: safetyFlags()
  };
}

export function buildCustomerGraphSnapshot(input, options = {}) {
  const contracts = options.contracts || loadCustomerIntelligenceGraphContracts();
  const customerId = input.customerId || options.customerId;
  if (!customerId) throw new Error("CustomerGraphSnapshot requires customerId");
  const nodes = (input.nodes || []).map(node => node.nodeId ? node : buildCustomerGraphNode({ ...node, customerId }, { contracts }));
  const relationships = (input.relationships || []).map(relationship => relationship.relationshipId
    ? relationship
    : buildCustomerGraphRelationship({ ...relationship, customerId }, { contracts }));

  return {
    graphId: input.graphId || stableId("cig_graph", { customerId, operatingProfileId: input.operatingProfileId || "", nodeIds: nodes.map(node => node.nodeId) }),
    contractVersion: contracts.version,
    customerId,
    operatingProfileId: input.operatingProfileId || "unassigned",
    nodes,
    relationships,
    objectives: clone(contracts.graphObjectives),
    safety: safetyFlags()
  };
}

export function validateCustomerGraphContracts(contracts = loadCustomerIntelligenceGraphContracts()) {
  const failures = [];
  for (const field of [
    "consumerImplementationActive",
    "productionScoringChanged",
    "productionRecommendationsChanged",
    "dashboardRuntimeChanged",
    "mobileRuntimeChanged",
    "companionRuntimeChanged",
    "crmRuntimeChanged",
    "researchRuntimeChanged",
    "salesRuntimeChanged",
    "infrastructureChanged"
  ]) {
    if (contracts[field] !== false) failures.push(`Customer Intelligence Graph contract must keep ${field}=false`);
  }
  for (const nodeType of ["Business", "Visit", "Lead", "Outcome", "Rep", "Territory", "Operating Profile", "Customer", "Learning Signal"]) {
    if (!contracts.nodeTypes.includes(nodeType)) failures.push(`Missing graph node type ${nodeType}`);
  }
  for (const relationshipType of ["Visited", "Recommended", "Converted", "Follow-up", "Nearby", "Similar", "Repeated", "Successful", "Inactive"]) {
    if (!contracts.relationshipTypes.includes(relationshipType)) failures.push(`Missing graph relationship type ${relationshipType}`);
  }
  for (const consumer of ["Dashboard", "CRM", "Mobile", "Companion", "Research", "Sales"]) {
    if (!contracts.futureConsumerContracts.includes(`${consumer}CustomerGraphContract`)) {
      failures.push(`Missing future consumer contract for ${consumer}`);
    }
  }
  return failures;
}

export function validateCustomerGraphSnapshot(snapshot, contracts = loadCustomerIntelligenceGraphContracts()) {
  const failures = [];
  const nodesById = new Map((snapshot.nodes || []).map(node => [node.nodeId, node]));
  if (snapshot.contractVersion !== contracts.version) failures.push("Customer graph snapshot contract version mismatch");
  if (!snapshot.customerId) failures.push("Customer graph snapshot missing customerId");
  for (const node of snapshot.nodes || []) {
    if (node.customerId !== snapshot.customerId) failures.push(`Node ${node.nodeId} belongs to a different customer`);
    if (!contracts.nodeTypes.includes(node.nodeType)) failures.push(`Node ${node.nodeId} uses unsupported type ${node.nodeType}`);
    if (node.safety?.productionScoringChanged !== false) failures.push(`Node ${node.nodeId} does not preserve production scoring safety`);
  }
  for (const relationship of snapshot.relationships || []) {
    if (relationship.customerId !== snapshot.customerId) failures.push(`Relationship ${relationship.relationshipId} belongs to a different customer`);
    if (!contracts.relationshipTypes.includes(relationship.relationshipType)) failures.push(`Relationship ${relationship.relationshipId} uses unsupported type ${relationship.relationshipType}`);
    if (!nodesById.has(relationship.fromNodeId)) failures.push(`Relationship ${relationship.relationshipId} missing fromNode ${relationship.fromNodeId}`);
    if (!nodesById.has(relationship.toNodeId)) failures.push(`Relationship ${relationship.relationshipId} missing toNode ${relationship.toNodeId}`);
    if (relationship.confidenceSeed?.propagationActive !== false) failures.push(`Relationship ${relationship.relationshipId} activates confidence propagation`);
  }
  if (snapshot.safety?.productionRecommendationsChanged !== false) failures.push("Customer graph snapshot changes production recommendations");
  return failures;
}

export function buildCustomerGraphConsumerContract(customerId, consumer, options = {}) {
  const contracts = options.contracts || loadCustomerIntelligenceGraphContracts();
  const base = {
    contractVersion: contracts.version,
    consumer,
    customerId,
    allowedNodeTypes: clone(contracts.nodeTypes),
    allowedRelationshipTypes: clone(contracts.relationshipTypes),
    status: "architecture_only"
  };

  if (consumer === "Dashboard") return { ...base, runtimeConsumptionAuthorized: false };
  if (consumer === "CRM") return { ...base, runtimeMutationAuthorized: false };
  if (consumer === "Mobile") return { ...base, mobileRuntimeChanged: false };
  if (consumer === "Companion") return { ...base, companionRuntimeChanged: false };
  if (consumer === "Research") return { ...base, runtimeConsumptionAuthorized: false };
  if (consumer === "Sales") return { ...base, runtimeConsumptionAuthorized: false };
  throw new Error(`Unsupported Customer Intelligence Graph consumer: ${consumer}`);
}
