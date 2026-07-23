import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createEmptyRouteQueue
} from "../intelligence/continuous-adaptive-route-replenishment.mjs";
import {
  buildRouteBusinessHoursIndex,
  evaluateRouteBusinessHoursEligibility
} from "../intelligence/route-business-hours-eligibility.mjs";

const fixture = JSON.parse(readFileSync(
  new URL("../intelligence/fixtures/route-iq-governed-customer-business-hours-v1.json", import.meta.url),
  "utf8"
));
const workspaceId = fixture.workspaceId;
const operatingProfileId = fixture.operatingProfileId;
const representativeId = "synthetic_rep_001";

function clone(value) {
  return structuredClone(value);
}

function buildIndex(artifact = fixture, options = {}) {
  return buildRouteBusinessHoursIndex(artifact, {
    workspaceId,
    operatingProfileId,
    ...options
  });
}

test("an asset-derived scope authenticates the hours artifact but cannot replace manifest admission", () => {
  const index = buildIndex();
  const record = index.recordsByPlaceId.get("synthetic-northstar-place-001");
  const decision = evaluateRouteBusinessHoursEligibility({
    record,
    candidate: {
      id: "synthetic_candidate_001",
      googlePlaceId: record.googlePlaceId,
      workspaceId,
      operatingProfileId,
      territoryId: "synthetic_territory"
    },
    evaluatedAt: fixture.statusEvaluatedAt,
    policy: index.freshnessPolicy,
    workspaceId,
    operatingProfileId,
    governedRuntimeScope: index.governedRuntimeScope
  });
  assert.equal(decision.status, "OPEN_VERIFIED");
  assert.equal(decision.eligible, false);
  assert.equal(decision.immediateRecommendationEligible, false);
  assert.equal(decision.reasonCode, "BUSINESS_MANIFEST_ADMISSION_REJECTED");
  assert.equal(index.approvedRecordCount, 0);
});

test("continuous route operations reject an asset-only, forged, serialized, or mismatched scope", () => {
  const index = buildIndex();
  const common = { workspaceId, operatingProfileId, representativeId };
  assert.throws(() => createEmptyRouteQueue(common), /manifest|scope is missing/i);
  assert.throws(() => createEmptyRouteQueue({
    ...common,
    governedRuntimeScope: index.governedRuntimeScope
  }), /canonical approved-business manifest/);
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
    operatingProfileId: "other_profile",
    governedRuntimeScope: index.governedRuntimeScope
  }), /does not match/);
});

test("business-hours evaluation rejects caller-created scope objects", () => {
  const record = fixture.records[0];
  const decision = evaluateRouteBusinessHoursEligibility({
    record,
    candidate: {
      googlePlaceId: record.googlePlaceId,
      workspaceId,
      operatingProfileId,
      territoryId: "synthetic_territory"
    },
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
  assert.equal(decision.reasonCode, "BUSINESS_MANIFEST_ADMISSION_REJECTED");
});

test("asset, requested context, freshness ceiling, and record provenance must match exactly", () => {
  assert.throws(() => buildIndex(fixture, { workspaceId: "other_workspace" }), /does not match|workspace mismatch|cross-scope/i);

  const declarationMismatch = clone(fixture);
  declarationMismatch.routeIqRuntimeScope.operatingProfileId = "other_profile";
  assert.throws(() => buildIndex(declarationMismatch), /does not match its provenance declaration/);

  const crossWorkspaceRecord = clone(fixture);
  crossWorkspaceRecord.records[0].workspaceId = "other_workspace";
  assert.throws(() => buildIndex(crossWorkspaceRecord), /cross-scope record/);

  const stalePolicy = clone(fixture);
  stalePolicy.freshnessPolicy.freshnessThresholdHours = 25;
  assert.throws(() => buildIndex(stalePolicy), /freshness ceiling exceeds 24 hours/);
});

test("historical Fitness indexing remains readable but cannot make an unmanifested immediate recommendation", () => {
  const fitnessArtifact = JSON.parse(readFileSync(
    new URL("../data/qualified-prospects/google-qualified-businesses-v2/business-hours-v1/business-hours.json", import.meta.url),
    "utf8"
  ));
  const index = buildRouteBusinessHoursIndex(fitnessArtifact);
  const record = fitnessArtifact.records[0];
  const decision = evaluateRouteBusinessHoursEligibility({
    record,
    candidate: {
      googlePlaceId: record.googlePlaceId,
      workspaceId: "fitness_connection",
      operatingProfileId: "fitness",
      territoryId: "historical_fixture"
    },
    evaluatedAt: fitnessArtifact.statusEvaluatedAt
  });
  assert.equal(index.workspaceId, "fitness_connection");
  assert.equal(index.operatingProfileId, "fitness");
  assert.equal(index.governedRuntimeScope, null);
  assert.equal(decision.immediateRecommendationEligible, false);
  assert.equal(decision.failClosed, true);
  assert.throws(() => createEmptyRouteQueue({
    workspaceId: "fitness_connection",
    operatingProfileId: "other_profile",
    representativeId: "founder"
  }), /governed runtime scope is missing or unauthenticated/);
});
