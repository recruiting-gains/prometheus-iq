import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildAdaptiveIntelligenceSnapshot,
  createEmptyRouteQueue,
  maintainRouteQueue,
  scoreAdaptiveCandidate
} from "../intelligence/continuous-adaptive-route-replenishment.mjs";
import {
  buildRouteBusinessHoursIndex,
  evaluateRouteBusinessHoursEligibility
} from "../intelligence/route-business-hours-eligibility.mjs";

const fixturePath = new URL("../intelligence/fixtures/route-iq-governed-customer-business-hours-v1.json", import.meta.url);
const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
const workspaceId = "northstar_field_services";
const operatingProfileId = "northstar_service_calls";
const representativeId = "northstar_rep_001";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildIndex(artifact = fixture, options = {}) {
  return buildRouteBusinessHoursIndex(artifact, {
    workspaceId,
    operatingProfileId,
    ...options
  });
}

test("a governed customer asset authorizes matching business-hours and route operations", () => {
  const index = buildIndex();
  const record = index.recordsByPlaceId.get("synthetic-northstar-place-001");
  const eligibility = evaluateRouteBusinessHoursEligibility({
    record,
    evaluatedAt: fixture.statusEvaluatedAt,
    policy: index.freshnessPolicy,
    workspaceId,
    operatingProfileId
  });
  assert.equal(eligibility.status, "OPEN_VERIFIED");
  assert.equal(eligibility.eligible, true);
  assert.equal(eligibility.workspaceId, workspaceId);
  assert.equal(eligibility.operatingProfileId, operatingProfileId);

  const candidate = {
    id: "northstar-route-001",
    googlePlaceId: record.googlePlaceId,
    name: record.businessName,
    address: record.address,
    workspaceId,
    operatingProfileId,
    category: "Field Service",
    score: 25,
    eligible: true
  };
  const queue = createEmptyRouteQueue({
    workspaceId,
    operatingProfileId,
    representativeId,
    targetSize: 1,
    threshold: 1
  });
  const maintained = maintainRouteQueue({
    queue,
    workspaceId,
    operatingProfileId,
    representativeId,
    primaryCandidates: [candidate],
    force: true,
    isEligible: () => eligibility.eligible,
    scoreCandidate: value => value.score,
    now: fixture.statusEvaluatedAt
  });
  assert.equal(maintained.queue.entries.length, 1);
  assert.equal(maintained.queue.workspaceId, workspaceId);
  assert.equal(maintained.queue.operatingProfileId, operatingProfileId);

  const intelligence = buildAdaptiveIntelligenceSnapshot({
    workspaceId,
    representativeId,
    places: [candidate],
    generatedAt: fixture.statusEvaluatedAt
  });
  const scored = scoreAdaptiveCandidate({
    candidate,
    baseScore: 25,
    intelligence
  });
  assert.equal(Number.isFinite(scored.score), true);
  assert.equal(intelligence.operatingProfileId, operatingProfileId);
});

test("customer scope fails closed when omitted, forged, serialized, or mismatched", () => {
  const index = buildIndex();
  const common = { workspaceId, operatingProfileId, representativeId };
  assert.doesNotThrow(() => createEmptyRouteQueue(common));
  assert.doesNotThrow(() => createEmptyRouteQueue({ workspaceId, representativeId }));
  assert.throws(() => createEmptyRouteQueue({
    workspaceId: "unregistered_workspace",
    operatingProfileId: "unregistered_profile",
    representativeId
  }), /scope is missing or unauthenticated/);
  assert.throws(() => createEmptyRouteQueue({
    ...common,
    governedRuntimeScope: { ...index.governedRuntimeScope }
  }), /scope is missing or unauthenticated/);
  assert.throws(() => createEmptyRouteQueue({
    ...common,
    governedRuntimeScope: clone(index.governedRuntimeScope)
  }), /scope is missing or unauthenticated/);
  assert.throws(() => createEmptyRouteQueue({
    ...common,
    operatingProfileId: "northstar_other_profile",
    governedRuntimeScope: index.governedRuntimeScope
  }), /does not match/);
});

test("business-hours evaluation rejects caller scope without the governed asset-derived object", () => {
  const record = fixture.records[0];
  const decision = evaluateRouteBusinessHoursEligibility({
    record,
    evaluatedAt: fixture.statusEvaluatedAt,
    workspaceId,
    operatingProfileId,
    governedRuntimeScope: {
      version: "route-iq-governed-runtime-scope-v1",
      workspaceId,
      operatingProfileId,
      authorizations: ["business_hours_eligibility", "continuous_adaptive_route_replenishment"]
    }
  });
  assert.equal(decision.eligible, false);
  assert.equal(decision.failClosed, true);
  assert.equal(decision.reasonCode, "HOURS_WORKSPACE_SCOPE_REJECTED");
});

test("asset, requested context, and record provenance must match exactly", () => {
  assert.throws(() => buildIndex(fixture, { workspaceId: "other_workspace" }), /does not match/);

  const declarationMismatch = clone(fixture);
  declarationMismatch.routeIqRuntimeScope.operatingProfileId = "other_profile";
  assert.throws(() => buildIndex(declarationMismatch), /does not match its provenance declaration/);

  const crossWorkspaceRecord = clone(fixture);
  crossWorkspaceRecord.records[0].workspaceId = "other_workspace";
  assert.throws(() => buildIndex(crossWorkspaceRecord), /cross-scope record/);
});

test("historical Fitness scope keeps its original compatibility and rejection boundary", () => {
  const fitnessArtifact = JSON.parse(readFileSync(
    new URL("../data/qualified-prospects/google-qualified-businesses-v2/business-hours-v1/business-hours.json", import.meta.url),
    "utf8"
  ));
  const index = buildRouteBusinessHoursIndex(fitnessArtifact);
  assert.equal(index.workspaceId, "fitness_connection");
  assert.equal(index.operatingProfileId, "fitness");
  assert.equal(index.governedRuntimeScope, null);
  assert.doesNotThrow(() => createEmptyRouteQueue({
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    representativeId: "cruz"
  }));
  assert.throws(() => createEmptyRouteQueue({
    workspaceId: "fitness_connection",
    operatingProfileId: "other_profile",
    representativeId: "cruz"
  }), /operating profile is not authorized/);
});
