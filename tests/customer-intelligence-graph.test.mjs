import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import {
  buildCustomerGraphConsumerContract,
  buildCustomerGraphNode,
  buildCustomerGraphRelationship,
  buildCustomerGraphSnapshot,
  loadCustomerIntelligenceGraphContracts,
  validateCustomerGraphContracts,
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
  assert.equal(summary.nodeTypes.length, 9);
  assert.equal(summary.relationshipTypes.length, 9);
  assert.equal(summary.productionSafety.productionScoringChanged, false);
});

test("graph contracts include required nodes, relationships, objectives, and consumers", () => {
  const contracts = loadCustomerIntelligenceGraphContracts();
  assert.deepEqual(validateCustomerGraphContracts(contracts), []);

  for (const nodeType of ["Business", "Visit", "Lead", "Outcome", "Rep", "Territory", "Operating Profile", "Customer", "Learning Signal"]) {
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
  const business = buildCustomerGraphNode({ customerId, nodeType: "Business", sourceRefs: [normalizedOutcome.evidence.businessRef] });
  const visit = buildCustomerGraphNode({ customerId, nodeType: "Visit", sourceRefs: [{ source: "field_evidence", id: normalizedOutcome.evidence.evidenceId }] });
  const outcome = buildCustomerGraphNode({ customerId, nodeType: "Outcome", sourceRefs: [{ source: "operating_profile", id: normalizedOutcome.normalizedOutcomeId }] });
  const signal = buildCustomerGraphNode({ customerId, nodeType: "Learning Signal", sourceRefs: [{ source: "field_learning", id: normalizedOutcome.learningSignalSeed.signalId }] });
  const visited = buildCustomerGraphRelationship({
    customerId,
    relationshipType: "Visited",
    fromNodeId: visit.nodeId,
    toNodeId: business.nodeId,
    sourceEvidenceIds: [normalizedOutcome.evidence.evidenceId]
  });
  const successful = buildCustomerGraphRelationship({
    customerId,
    relationshipType: "Successful",
    fromNodeId: outcome.nodeId,
    toNodeId: signal.nodeId,
    sourceEvidenceIds: [normalizedOutcome.evidence.evidenceId]
  });
  const snapshot = buildCustomerGraphSnapshot({
    customerId,
    operatingProfileId: "roofing",
    nodes: [business, visit, outcome, signal],
    relationships: [visited, successful]
  });

  assert.deepEqual(validateCustomerGraphSnapshot(snapshot), []);
  assert.equal(snapshot.safety.productionScoringChanged, false);
  assert.equal(snapshot.safety.productionRecommendationsChanged, false);
  assert.equal(snapshot.relationships.every(relationship => relationship.confidenceSeed.propagationActive === false), true);
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
  for (const consumer of ["Dashboard", "CRM", "Mobile", "Companion", "Research", "Sales"]) {
    const contract = buildCustomerGraphConsumerContract("customer_contract_test", consumer);
    assert.equal(contract.status, "architecture_only");
    assert.notEqual(contract.runtimeConsumptionAuthorized, true);
    assert.notEqual(contract.runtimeMutationAuthorized, true);
    assert.notEqual(contract.mobileRuntimeChanged, true);
    assert.notEqual(contract.companionRuntimeChanged, true);
  }
});
