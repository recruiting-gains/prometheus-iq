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
    readOnly: true,
    consumerImplementationActive: false,
    automaticLearningActive: false,
    automaticScoringActive: false,
    productionScoringChanged: false,
    productionRecommendationsChanged: false,
    activePoolChanged: false,
    dashboardRuntimeChanged: false,
    websiteRuntimeChanged: false,
    mobileRuntimeChanged: false,
    companionRuntimeChanged: false,
    crmRuntimeChanged: false,
    confidencePropagationActive: false,
    humanOverridePreserved: true,
    customerIsolationRequired: true
  };
}

function provenance(input, generatedAt, fallbackSource = "prometheus_intelligence_engine") {
  const sourceRefs = clone(input.sourceRefs || []);
  const sourceEvidenceIds = clone(input.sourceEvidenceIds || []);
  const evidenceCount = Number(input.evidenceCount || sourceEvidenceIds.length || sourceRefs.length || 0);
  return {
    sourceRefs,
    sourceEvidenceIds,
    learnedAt: input.learnedAt || input.validFrom || input.observedAt || generatedAt,
    generatedBy: input.generatedBy || fallbackSource,
    confidence: {
      confidenceBand: input.confidence?.confidenceBand || input.confidenceBand || "unactivated",
      confidenceScore: input.confidence?.confidenceScore ?? input.confidenceScore ?? null,
      evidenceCount,
      allowedInfluence: "read_only"
    },
    humanOverrideState: input.humanOverrideState || "preserved"
  };
}

function countBy(values) {
  const counts = {};
  for (const value of values) counts[value] = (counts[value] || 0) + 1;
  return counts;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
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
    provenance: provenance({ ...input, sourceRefs }, validFrom),
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
    provenance: provenance(input, validFrom),
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
  const generatedAt = input.generatedAt || new Date(0).toISOString();
  const nodes = (input.nodes || []).map(node => node.nodeId ? node : buildCustomerGraphNode({ ...node, customerId }, { contracts }));
  const relationships = (input.relationships || []).map(relationship => relationship.relationshipId
    ? relationship
    : buildCustomerGraphRelationship({ ...relationship, customerId }, { contracts }));
  const operatingProfileId = input.operatingProfileId || "unassigned";
  const content = input.content || buildSnapshotContent({ customerId, operatingProfileId, nodes, relationships });
  const queryIndex = input.queryIndex || buildSnapshotQueryIndex({ nodes, relationships, contracts });
  const confidence = input.confidence || buildSnapshotConfidence(nodes, relationships);

  return {
    graphId: input.graphId || stableId("cig_graph", { customerId, operatingProfileId, nodeIds: nodes.map(node => node.nodeId) }),
    snapshotVersion: input.snapshotVersion || "customer-graph-snapshot-v1",
    contractVersion: contracts.version,
    customerId,
    operatingProfileId,
    readOnly: true,
    generatedAt,
    nodes,
    relationships,
    content,
    queryIndex,
    provenance: {
      generatedBy: input.generatedBy || "prometheus_intelligence_engine",
      generatedAt,
      sourceRefs: unique(nodes.flatMap(node => node.provenance?.sourceRefs || []).map(ref => `${ref.source || "source"}:${ref.id || ref.name || "unknown"}`)),
      sourceEvidenceIds: unique(relationships.flatMap(relationship => relationship.sourceEvidenceIds || [])),
      learnedAtRange: learnedAtRange(nodes, relationships)
    },
    explainability: input.explainability || {
      why: "This read-only CustomerGraphSnapshot exists to preserve customer-scoped field intelligence for future review.",
      whatEvidence: `${content.evidenceHistory.length} evidence item(s) and ${nodes.length} graph node(s) are attached to this snapshot.`,
      howConfident: `Confidence is ${confidence.confidenceBand}; confidence propagation is not active.`,
      whatChanged: "No production recommendation, scoring, Dashboard, Mobile, Website, CRM, Companion, Active Pool, or automatic learning behavior changed.",
      whatShouldHappenNext: "Use approved future subsystem handoffs before any consumer reads this snapshot in production."
    },
    confidence,
    objectives: clone(contracts.graphObjectives),
    safety: safetyFlags()
  };
}

function buildSnapshotContent({ operatingProfileId, nodes, relationships }) {
  const byType = type => nodes.filter(node => node.nodeType === type);
  return {
    businesses: byType("Business"),
    visits: byType("Visit"),
    outcomes: byType("Outcome"),
    leads: byType("Lead"),
    opportunities: byType("Opportunity"),
    repActivity: byType("Rep"),
    managerActivity: byType("Manager"),
    territories: byType("Territory"),
    opportunityRelationships: relationships.filter(relationship => ["Recommended", "Converted", "Follow-up", "Successful"].includes(relationship.relationshipType)),
    evidenceHistory: unique(relationships.flatMap(relationship => relationship.sourceEvidenceIds || [])),
    confidence: buildSnapshotConfidence(nodes, relationships),
    operatingProfile: {
      profileId: operatingProfileId,
      nodes: byType("Operating Profile")
    },
    learningProvenance: nodes.map(node => ({
      nodeId: node.nodeId,
      nodeType: node.nodeType,
      learnedAt: node.provenance?.learnedAt || node.validFrom,
      generatedBy: node.provenance?.generatedBy || "unknown",
      confidence: node.provenance?.confidence || null
    }))
  };
}

function buildSnapshotQueryIndex({ nodes, relationships, contracts }) {
  return {
    queryable: true,
    readOnly: true,
    availableQueryTypes: clone(contracts.queryTypes || []),
    nodeTypeCounts: countBy(nodes.map(node => node.nodeType)),
    relationshipTypeCounts: countBy(relationships.map(relationship => relationship.relationshipType)),
    sourceEvidenceIds: unique(relationships.flatMap(relationship => relationship.sourceEvidenceIds || [])),
    generatedIndexes: ["nodeTypeCounts", "relationshipTypeCounts", "sourceEvidenceIds"]
  };
}

function buildSnapshotConfidence(nodes, relationships) {
  const evidenceCount = unique(relationships.flatMap(relationship => relationship.sourceEvidenceIds || [])).length;
  const nodeEvidenceCount = nodes.reduce((sum, node) => sum + Number(node.provenance?.confidence?.evidenceCount || 0), 0);
  return {
    confidenceBand: evidenceCount || nodeEvidenceCount ? "read_only_evidence_present" : "read_only_unproven",
    confidenceScore: null,
    evidenceCount: evidenceCount || nodeEvidenceCount,
    allowedInfluence: "read_only",
    propagationActive: false,
    lastValidationAt: null
  };
}

function learnedAtRange(nodes, relationships) {
  const dates = [
    ...nodes.map(node => node.provenance?.learnedAt || node.validFrom),
    ...relationships.map(relationship => relationship.provenance?.learnedAt || relationship.validFrom)
  ].filter(Boolean).sort();
  return {
    earliest: dates[0] || null,
    latest: dates.at(-1) || null
  };
}

export function validateCustomerGraphContracts(contracts = loadCustomerIntelligenceGraphContracts()) {
  const failures = [];
  for (const field of [
    "consumerImplementationActive",
    "productionScoringChanged",
    "productionRecommendationsChanged",
    "dashboardRuntimeChanged",
    "websiteRuntimeChanged",
    "mobileRuntimeChanged",
    "companionRuntimeChanged",
    "crmRuntimeChanged",
    "researchRuntimeChanged",
    "salesRuntimeChanged",
    "infrastructureChanged"
  ]) {
    if (contracts[field] !== false) failures.push(`Customer Intelligence Graph contract must keep ${field}=false`);
  }
  for (const nodeType of ["Business", "Visit", "Lead", "Outcome", "Opportunity", "Rep", "Manager", "Territory", "Operating Profile", "Customer", "Learning Signal"]) {
    if (!contracts.nodeTypes.includes(nodeType)) failures.push(`Missing graph node type ${nodeType}`);
  }
  for (const relationshipType of ["Visited", "Recommended", "Converted", "Follow-up", "Nearby", "Similar", "Repeated", "Successful", "Inactive"]) {
    if (!contracts.relationshipTypes.includes(relationshipType)) failures.push(`Missing graph relationship type ${relationshipType}`);
  }
  for (const consumer of ["Dashboard", "CRM", "Mobile", "Website", "Companion", "Research", "Sales"]) {
    if (!contracts.futureConsumerContracts.includes(`${consumer}CustomerGraphContract`)) {
      failures.push(`Missing future consumer contract for ${consumer}`);
    }
  }
  for (const consumer of ["Dashboard", "CRM", "Mobile", "Website", "Companion", "Research", "Sales"]) {
    if (!contracts.futureQueryContracts.includes(`${consumer}CustomerGraphQueryContract`)) {
      failures.push(`Missing future query contract for ${consumer}`);
    }
  }
  for (const field of ["readOnly", "queryable", "humanOverridePreserved", "customerIsolationRequired"]) {
    if (contracts[field] !== true) failures.push(`Customer Intelligence Graph contract must keep ${field}=true`);
  }
  for (const field of ["automaticLearningActive", "automaticScoringActive", "activePoolChanged"]) {
    if (contracts[field] !== false) failures.push(`Customer Intelligence Graph contract must keep ${field}=false`);
  }
  return failures;
}

export function validateCustomerGraphSnapshot(snapshot, contracts = loadCustomerIntelligenceGraphContracts()) {
  const failures = [];
  const nodesById = new Map((snapshot.nodes || []).map(node => [node.nodeId, node]));
  if (snapshot.contractVersion !== contracts.version) failures.push("Customer graph snapshot contract version mismatch");
  if (!snapshot.customerId) failures.push("Customer graph snapshot missing customerId");
  if (snapshot.readOnly !== true) failures.push("Customer graph snapshot must remain readOnly");
  if (!snapshot.snapshotVersion) failures.push("Customer graph snapshot missing snapshotVersion");
  if (!snapshot.generatedAt) failures.push("Customer graph snapshot missing generatedAt");
  for (const contentKey of ["businesses", "visits", "outcomes", "leads", "opportunities", "repActivity", "managerActivity", "territories", "opportunityRelationships", "evidenceHistory", "confidence", "operatingProfile", "learningProvenance"]) {
    if (snapshot.content?.[contentKey] === undefined) failures.push(`Customer graph snapshot missing content.${contentKey}`);
  }
  if (snapshot.queryIndex?.queryable !== true || snapshot.queryIndex?.readOnly !== true) failures.push("Customer graph snapshot queryIndex must be read-only queryable");
  for (const node of snapshot.nodes || []) {
    if (node.customerId !== snapshot.customerId) failures.push(`Node ${node.nodeId} belongs to a different customer`);
    if (!contracts.nodeTypes.includes(node.nodeType)) failures.push(`Node ${node.nodeId} uses unsupported type ${node.nodeType}`);
    if (node.safety?.productionScoringChanged !== false) failures.push(`Node ${node.nodeId} does not preserve production scoring safety`);
    if (!node.provenance?.learnedAt || !node.provenance?.generatedBy) failures.push(`Node ${node.nodeId} missing provenance`);
  }
  for (const relationship of snapshot.relationships || []) {
    if (relationship.customerId !== snapshot.customerId) failures.push(`Relationship ${relationship.relationshipId} belongs to a different customer`);
    if (!contracts.relationshipTypes.includes(relationship.relationshipType)) failures.push(`Relationship ${relationship.relationshipId} uses unsupported type ${relationship.relationshipType}`);
    if (!nodesById.has(relationship.fromNodeId)) failures.push(`Relationship ${relationship.relationshipId} missing fromNode ${relationship.fromNodeId}`);
    if (!nodesById.has(relationship.toNodeId)) failures.push(`Relationship ${relationship.relationshipId} missing toNode ${relationship.toNodeId}`);
    if (relationship.confidenceSeed?.propagationActive !== false) failures.push(`Relationship ${relationship.relationshipId} activates confidence propagation`);
    if (!relationship.provenance?.learnedAt || !relationship.provenance?.generatedBy) failures.push(`Relationship ${relationship.relationshipId} missing provenance`);
  }
  if (snapshot.safety?.productionRecommendationsChanged !== false) failures.push("Customer graph snapshot changes production recommendations");
  if (snapshot.safety?.automaticLearningActive !== false) failures.push("Customer graph snapshot activates automatic learning");
  if (snapshot.safety?.activePoolChanged !== false) failures.push("Customer graph snapshot changes Active Pool");
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
  if (consumer === "Website") return { ...base, websiteRuntimeChanged: false };
  if (consumer === "Companion") return { ...base, companionRuntimeChanged: false };
  if (consumer === "Research") return { ...base, runtimeConsumptionAuthorized: false };
  if (consumer === "Sales") return { ...base, runtimeConsumptionAuthorized: false };
  throw new Error(`Unsupported Customer Intelligence Graph consumer: ${consumer}`);
}

export function buildCustomerGraphQueryContract(customerId, consumer, options = {}) {
  const contracts = options.contracts || loadCustomerIntelligenceGraphContracts();
  const base = {
    contractVersion: contracts.version,
    queryId: options.queryId || stableId("cig_query_contract", { customerId, consumer }),
    consumer,
    customerId,
    queryType: options.queryType || "snapshot_summary",
    queryTypes: clone(contracts.queryTypes || []),
    filters: clone(options.filters || {}),
    readOnly: true,
    allowedNodeTypes: clone(contracts.nodeTypes),
    allowedRelationshipTypes: clone(contracts.relationshipTypes),
    maxResults: Number(options.maxResults || 100),
    safety: safetyFlags(),
    status: "architecture_only"
  };

  if (consumer === "Dashboard") return { ...base, runtimeConsumptionAuthorized: false };
  if (consumer === "CRM") return { ...base, runtimeMutationAuthorized: false };
  if (consumer === "Mobile") return { ...base, mobileRuntimeChanged: false };
  if (consumer === "Website") return { ...base, websiteRuntimeChanged: false };
  if (consumer === "Companion") return { ...base, companionRuntimeChanged: false };
  if (consumer === "Research") return { ...base, runtimeConsumptionAuthorized: false };
  if (consumer === "Sales") return { ...base, runtimeConsumptionAuthorized: false };
  throw new Error(`Unsupported Customer Intelligence Graph query consumer: ${consumer}`);
}

export function validateCustomerGraphQueryContract(queryContract, contracts = loadCustomerIntelligenceGraphContracts()) {
  const failures = [];
  if (queryContract.contractVersion !== contracts.version) failures.push("Customer graph query contract version mismatch");
  if (!queryContract.customerId) failures.push("Customer graph query contract missing customerId");
  if (queryContract.readOnly !== true) failures.push("Customer graph query contract must remain readOnly");
  if (queryContract.runtimeConsumptionAuthorized === true) failures.push("Customer graph query contract authorizes runtime consumption");
  if (queryContract.runtimeMutationAuthorized === true) failures.push("Customer graph query contract authorizes runtime mutation");
  if (queryContract.mobileRuntimeChanged === true) failures.push("Customer graph query contract changes Mobile runtime");
  if (queryContract.websiteRuntimeChanged === true) failures.push("Customer graph query contract changes Website runtime");
  if (queryContract.companionRuntimeChanged === true) failures.push("Customer graph query contract changes Companion runtime");
  for (const queryType of queryContract.queryTypes || []) {
    if (!contracts.queryTypes.includes(queryType)) failures.push(`Unsupported graph query type ${queryType}`);
  }
  return failures;
}

export function queryCustomerGraphSnapshot(snapshot, queryContract, options = {}) {
  const contracts = options.contracts || loadCustomerIntelligenceGraphContracts();
  const failures = [
    ...validateCustomerGraphSnapshot(snapshot, contracts),
    ...validateCustomerGraphQueryContract(queryContract, contracts)
  ];
  if (queryContract.customerId !== snapshot.customerId) failures.push("Customer graph query attempted cross-customer access");
  if (failures.length) {
    return {
      contractVersion: contracts.version,
      queryId: queryContract.queryId,
      customerId: queryContract.customerId,
      queryType: queryContract.queryType || "snapshot_summary",
      nodes: [],
      relationships: [],
      provenance: { failureReasons: failures },
      explanation: "Query rejected because it violated Customer Intelligence Graph safety validation.",
      readOnly: true,
      safety: safetyFlags(),
      failureReasons: failures
    };
  }

  const queryType = queryContract.queryType || options.queryType || "snapshot_summary";
  const filters = queryContract.filters || {};
  const nodeLimit = Number(queryContract.maxResults || 100);
  const { nodes, relationships } = filterSnapshot(snapshot, queryType, filters, nodeLimit);
  return {
    contractVersion: contracts.version,
    queryId: queryContract.queryId,
    customerId: snapshot.customerId,
    queryType,
    nodes,
    relationships,
    provenance: {
      sourceGraphId: snapshot.graphId,
      generatedAt: snapshot.generatedAt,
      sourceEvidenceIds: unique(relationships.flatMap(relationship => relationship.sourceEvidenceIds || [])),
      learnedAtRange: learnedAtRange(nodes, relationships)
    },
    explanation: `Read-only ${queryType} query returned ${nodes.length} node(s) and ${relationships.length} relationship(s) without changing scoring or recommendations.`,
    readOnly: true,
    safety: safetyFlags(),
    failureReasons: []
  };
}

function filterSnapshot(snapshot, queryType, filters, limit) {
  let nodes = [...(snapshot.nodes || [])];
  let relationships = [...(snapshot.relationships || [])];
  if (queryType === "by_node_type" && filters.nodeType) {
    nodes = nodes.filter(node => normalizeLabel(node.nodeType) === normalizeLabel(filters.nodeType));
    const nodeIds = new Set(nodes.map(node => node.nodeId));
    relationships = relationships.filter(relationship => nodeIds.has(relationship.fromNodeId) || nodeIds.has(relationship.toNodeId));
  } else if (queryType === "by_relationship_type" && filters.relationshipType) {
    relationships = relationships.filter(relationship => normalizeLabel(relationship.relationshipType) === normalizeLabel(filters.relationshipType));
    const nodeIds = new Set(relationships.flatMap(relationship => [relationship.fromNodeId, relationship.toNodeId]));
    nodes = nodes.filter(node => nodeIds.has(node.nodeId));
  } else if (queryType === "by_evidence" && filters.evidenceId) {
    relationships = relationships.filter(relationship => (relationship.sourceEvidenceIds || []).includes(filters.evidenceId));
    const nodeIds = new Set(relationships.flatMap(relationship => [relationship.fromNodeId, relationship.toNodeId]));
    nodes = nodes.filter(node => nodeIds.has(node.nodeId) || (node.provenance?.sourceEvidenceIds || []).includes(filters.evidenceId));
  } else if (queryType === "by_operating_profile") {
    nodes = nodes.filter(node => node.nodeType === "Operating Profile" || node.attributes?.operatingProfileId === snapshot.operatingProfileId);
    const nodeIds = new Set(nodes.map(node => node.nodeId));
    relationships = relationships.filter(relationship => nodeIds.has(relationship.fromNodeId) || nodeIds.has(relationship.toNodeId));
  } else if (queryType === "by_business") {
    nodes = nodes.filter(node => node.nodeType === "Business");
  } else if (queryType === "by_territory") {
    nodes = nodes.filter(node => node.nodeType === "Territory");
  } else if (queryType === "by_rep") {
    nodes = nodes.filter(node => node.nodeType === "Rep");
  } else if (queryType === "by_opportunity") {
    nodes = nodes.filter(node => node.nodeType === "Opportunity" || node.nodeType === "Lead");
  } else if (queryType === "by_confidence") {
    nodes = nodes.filter(node => node.provenance?.confidence);
  }
  const limitedNodes = nodes.slice(0, limit);
  const limitedIds = new Set(limitedNodes.map(node => node.nodeId));
  return {
    nodes: limitedNodes,
    relationships: relationships.filter(relationship => limitedIds.has(relationship.fromNodeId) || limitedIds.has(relationship.toNodeId)).slice(0, limit)
  };
}
