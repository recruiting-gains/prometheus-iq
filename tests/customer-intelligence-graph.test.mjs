import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
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
import { normalizeIndustryOutcome } from "../intelligence/operating-profile-engine.mjs";

const root = resolve(import.meta.dirname, "..");

test("customer intelligence graph verifier passes", () => {
  const result = spawnSync("node", ["scripts/verify-customer-intelligence-graph.mjs"], {
    cwd: root,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.status, "passed");
  assert.equal(summary.nodeTypes.length, 11);
  assert.equal(summary.relationshipTypes.length, 9);
  assert.equal(summary.sampleSnapshot.readOnly, true);
  assert.equal(summary.sampleSnapshot.queryable, true);
  assert.equal(summary.sampleQuery.readOnly, true);
  assert.equal(summary.productionSafety.productionScoringChanged, false);
  assert.equal(summary.productionSafety.automaticLearningActive, false);
});

test("graph contracts include required nodes, relationships, objectives, and consumers", () => {
  const contracts = loadCustomerIntelligenceGraphContracts();
  assert.deepEqual(validateCustomerGraphContracts(contracts), []);

  for (const nodeType of ["Business", "Visit", "Lead", "Outcome", "Opportunity", "Rep", "Manager", "Territory", "Operating Profile", "Customer", "Learning Signal"]) {
    assert.ok(contracts.nodeTypes.includes(nodeType), `Missing node type ${nodeType}`);
  }
  for (const relationshipType of ["Visited", "Recommended", "Converted", "Follow-up", "Nearby", "Similar", "Repeated", "Successful", "Inactive"]) {
    assert.ok(contracts.relationshipTypes.includes(relationshipType), `Missing relationship type ${relationshipType}`);
  }
  for (const objective of ["opportunity_relationships", "territory_relationships", "customer_relationships", "rep_performance_trends", "cross_industry_learning", "confidence_propagation"]) {
    assert.ok(contracts.graphObjectives.includes(objective), `Missing graph objective ${objective}`);
  }
});

test("graph snapshot connects operating profile evidence without changing recommendations", () => {
  const normalizedOutcome = normalizeIndustryOutcome({
    profileId: "roofing",
    rawOutcome: "inspection",
    visit: {
      businessRef: { source: "test", id: "business-1" },
      repRef: { source: "test", id: "rep-1" },
      occurredAt: "2026-07-02T12:00:00.000Z"
    }
  });
  const customerId = "customer_test_roofing";
  const business = buildCustomerGraphNode({ customerId, nodeType: "Business", sourceRefs: [normalizedOutcome.evidence.businessRef], learnedAt: normalizedOutcome.evidence.visitOccurredAt });
  const visit = buildCustomerGraphNode({ customerId, nodeType: "Visit", sourceRefs: [{ source: "field_evidence", id: normalizedOutcome.evidence.evidenceId }], learnedAt: normalizedOutcome.evidence.visitOccurredAt });
  const outcome = buildCustomerGraphNode({ customerId, nodeType: "Outcome", sourceRefs: [{ source: "operating_profile", id: normalizedOutcome.normalizedOutcomeId }], learnedAt: normalizedOutcome.evidence.visitOccurredAt });
  const opportunity = buildCustomerGraphNode({ customerId, nodeType: "Opportunity", sourceRefs: [{ source: "field_evidence", id: normalizedOutcome.evidence.evidenceId }], learnedAt: normalizedOutcome.evidence.visitOccurredAt });
  const manager = buildCustomerGraphNode({ customerId, nodeType: "Manager", sourceRefs: [{ source: "fixture", id: "manager-1" }], learnedAt: normalizedOutcome.evidence.visitOccurredAt });
  const signal = buildCustomerGraphNode({ customerId, nodeType: "Learning Signal", sourceRefs: [{ source: "field_learning", id: normalizedOutcome.learningSignalSeed.signalId }], learnedAt: normalizedOutcome.evidence.visitOccurredAt });
  const visited = buildCustomerGraphRelationship({
    customerId,
    relationshipType: "Visited",
    fromNodeId: visit.nodeId,
    toNodeId: business.nodeId,
    sourceEvidenceIds: [normalizedOutcome.evidence.evidenceId],
    learnedAt: normalizedOutcome.evidence.visitOccurredAt
  });
  const successful = buildCustomerGraphRelationship({
    customerId,
    relationshipType: "Successful",
    fromNodeId: outcome.nodeId,
    toNodeId: signal.nodeId,
    sourceEvidenceIds: [normalizedOutcome.evidence.evidenceId],
    learnedAt: normalizedOutcome.evidence.visitOccurredAt
  });
  const converted = buildCustomerGraphRelationship({
    customerId,
    relationshipType: "Converted",
    fromNodeId: opportunity.nodeId,
    toNodeId: outcome.nodeId,
    sourceEvidenceIds: [normalizedOutcome.evidence.evidenceId],
    learnedAt: normalizedOutcome.evidence.visitOccurredAt
  });
  const snapshot = buildCustomerGraphSnapshot({
    customerId,
    operatingProfileId: "roofing",
    nodes: [business, visit, outcome, opportunity, manager, signal],
    relationships: [visited, successful, converted],
    generatedAt: "2026-07-02T12:05:00.000Z"
  });

  assert.deepEqual(validateCustomerGraphSnapshot(snapshot), []);
  assert.equal(snapshot.readOnly, true);
  assert.equal(snapshot.snapshotVersion, "customer-graph-snapshot-v1");
  assert.equal(snapshot.content.businesses.length, 1);
  assert.equal(snapshot.content.opportunities.length, 1);
  assert.equal(snapshot.content.managerActivity.length, 1);
  assert.equal(snapshot.content.evidenceHistory.includes(normalizedOutcome.evidence.evidenceId), true);
  assert.equal(snapshot.provenance.learnedAtRange.earliest, normalizedOutcome.evidence.visitOccurredAt);
  assert.ok(snapshot.explainability.whatEvidence.includes("evidence item"));
  assert.equal(snapshot.safety.productionScoringChanged, false);
  assert.equal(snapshot.safety.productionRecommendationsChanged, false);
  assert.equal(snapshot.safety.automaticLearningActive, false);
  assert.equal(snapshot.safety.activePoolChanged, false);
  assert.equal(snapshot.relationships.every(relationship => relationship.confidenceSeed.propagationActive === false), true);
});

test("read-only query contracts return scoped snapshot data without runtime activation", () => {
  const customerId = "customer_query_test";
  const business = buildCustomerGraphNode({ customerId, nodeType: "Business", sourceRefs: [{ source: "test", id: "business-1" }] });
  const territory = buildCustomerGraphNode({ customerId, nodeType: "Territory", sourceRefs: [{ source: "test", id: "territory-1" }] });
  const nearby = buildCustomerGraphRelationship({
    customerId,
    relationshipType: "Nearby",
    fromNodeId: business.nodeId,
    toNodeId: territory.nodeId,
    sourceEvidenceIds: ["evidence_nearby_1"]
  });
  const snapshot = buildCustomerGraphSnapshot({
    customerId,
    operatingProfileId: "general_outside_sales",
    nodes: [business, territory],
    relationships: [nearby]
  });
  const queryContract = buildCustomerGraphQueryContract(customerId, "Dashboard", {
    queryType: "by_node_type",
    filters: { nodeType: "Business" },
    maxResults: 10
  });
  const result = queryCustomerGraphSnapshot(snapshot, queryContract);

  assert.deepEqual(validateCustomerGraphQueryContract(queryContract), []);
  assert.equal(result.failureReasons.length, 0);
  assert.equal(result.readOnly, true);
  assert.equal(result.nodes.length, 1);
  assert.equal(result.nodes[0].nodeType, "Business");
  assert.equal(result.safety.productionScoringChanged, false);
  assert.equal(result.safety.productionRecommendationsChanged, false);
});

test("customer isolation rejects cross-customer graph bleed", () => {
  const customerA = "customer_a";
  const customerB = "customer_b";
  const business = buildCustomerGraphNode({ customerId: customerA, nodeType: "Business" });
  const visit = buildCustomerGraphNode({ customerId: customerB, nodeType: "Visit" });
  const relationship = buildCustomerGraphRelationship({
    customerId: customerA,
    relationshipType: "Visited",
    fromNodeId: visit.nodeId,
    toNodeId: business.nodeId
  });
  const snapshot = buildCustomerGraphSnapshot({
    customerId: customerA,
    operatingProfileId: "general_outside_sales",
    nodes: [business, visit],
    relationships: [relationship]
  });

  assert.match(validateCustomerGraphSnapshot(snapshot).join("\n"), /different customer/);
});

test("future consumer contracts do not activate implementation", () => {
  for (const consumer of ["Dashboard", "CRM", "Mobile", "Website", "Companion", "Research", "Sales"]) {
    const contract = buildCustomerGraphConsumerContract("customer_contract_test", consumer);
    assert.equal(contract.status, "architecture_only");
    assert.notEqual(contract.runtimeConsumptionAuthorized, true);
    assert.notEqual(contract.runtimeMutationAuthorized, true);
    assert.notEqual(contract.mobileRuntimeChanged, true);
    assert.notEqual(contract.websiteRuntimeChanged, true);
    assert.notEqual(contract.companionRuntimeChanged, true);

    const queryContract = buildCustomerGraphQueryContract("customer_contract_test", consumer);
    assert.deepEqual(validateCustomerGraphQueryContract(queryContract), []);
    assert.equal(queryContract.readOnly, true);
  }
});
