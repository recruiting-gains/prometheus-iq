import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  authorizeRouteIqFounderIntelligencePrincipal,
  buildRouteIqDailyIntelligenceSnapshot,
  computeRouteIqGovernedEvidenceHash,
  loadRouteIqCommercialReadinessIntelligenceContract,
  validateRouteIqCommercialReadinessIntelligenceContract,
  validateRouteIqDailyIntelligenceSnapshot
} from "../intelligence/route-iq-daily-intelligence-snapshot.mjs";

const fixtureUrl = new URL("../intelligence/fixtures/route-iq-commercial-readiness-daily-snapshot-v1.json", import.meta.url);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function loadRouteIqCommercialReadinessIntelligenceFixture() {
  return JSON.parse(readFileSync(fixtureUrl, "utf8"));
}

export function buildFixtureDailySnapshot(overrides = {}) {
  const fixture = overrides.fixture || loadRouteIqCommercialReadinessIntelligenceFixture();
  const contract = overrides.contract || loadRouteIqCommercialReadinessIntelligenceContract();
  const records = overrides.records || fixture.records;
  const businessContext = overrides.businessContext || fixture.businessContext;
  const learningAssessment = clone(overrides.learningAssessment || fixture.learningAssessment);
  learningAssessment.sourceEvidenceSha256 = computeRouteIqGovernedEvidenceHash(records, businessContext, contract);
  return buildRouteIqDailyIntelligenceSnapshot({
    principal: overrides.principal || fixture.principal,
    businessContext,
    records,
    learningAssessment,
    previousSnapshot: overrides.previousSnapshot || null,
    contract
  });
}

export function verifyRouteIqCommercialReadinessIntelligence() {
  const contract = loadRouteIqCommercialReadinessIntelligenceContract();
  const fixture = loadRouteIqCommercialReadinessIntelligenceFixture();
  assert.deepEqual(validateRouteIqCommercialReadinessIntelligenceContract(contract), []);
  assert.equal(fixture.canonical, false);
  assert.equal(fixture.productionConsumptionAllowed, false);
  assert.equal(authorizeRouteIqFounderIntelligencePrincipal(fixture.principal, contract).authorized, true);

  const snapshot = buildFixtureDailySnapshot({contract, fixture});
  const reordered = buildFixtureDailySnapshot({contract, fixture, records: [...fixture.records].reverse()});
  assert.deepEqual(reordered, snapshot, "Evidence input order changed the canonical snapshot.");
  assert.deepEqual(validateRouteIqDailyIntelligenceSnapshot(snapshot, contract), []);
  assert.equal(snapshot.evidenceCollected.totalRecords, 4);
  assert.deepEqual(snapshot.evidenceCollected.byRecordKind, {field_session: 1, learning_observation: 1, visit: 2});
  assert.equal(snapshot.evidenceFreshness.snapshotDate, "2026-07-17");
  assert.equal(snapshot.dataQuality.status, "REVIEW_REQUIRED");
  assert.equal(snapshot.visitAndOutcomeTrends.totals.visits, 2);
  assert.equal(snapshot.visitAndOutcomeTrends.totals.outcomes, 1);
  assert.equal(snapshot.visitAndOutcomeTrends.outcomeLinkRatePercent, 50);
  assert.equal(snapshot.learningCoverage.representativesObserved, 2);
  assert.equal(snapshot.learningCoverage.locationsObserved, 2);
  assert.equal(snapshot.confidence.state, "INSUFFICIENT_EVIDENCE");
  assert.equal(snapshot.confidence.insufficiencyIsRecommendation, false);
  assert.equal(snapshot.safety.recommendationInfluence, "OFF");
  assert.equal(snapshot.safety.routeOrderingChanged, false);
  assert.equal(snapshot.safety.routeScoringWeightsChanged, false);

  const unchanged = buildFixtureDailySnapshot({contract, fixture, previousSnapshot: snapshot});
  assert.deepEqual(unchanged, snapshot, "Unchanged governed evidence did not return the prior snapshot byte-equivalent object.");

  assert.throws(() => authorizeRouteIqFounderIntelligencePrincipal({
    displayName: "Cruz Garza",
    authenticated: true,
    role: "founder"
  }, contract), /identity_context_source_invalid/);
  assert.throws(() => authorizeRouteIqFounderIntelligencePrincipal({
    ...fixture.principal,
    mappingId: "route-iq-founder-access-anthony-v1",
    immutablePrincipalId: "route-iq-principal-founder-anthony-v1"
  }, contract), /founder_principal_not_authorized/);
  assert.throws(() => buildFixtureDailySnapshot({
    contract,
    fixture,
    principal: {...fixture.principal, role: "representative"}
  }), /founder_role_required/);

  return {
    status: "passed",
    batchId: contract.batchId,
    version: snapshot.schemaVersion,
    workspaceId: snapshot.workspaceId,
    operatingProfileId: snapshot.operatingProfileId,
    evidenceRecords: snapshot.evidenceCollected.totalRecords,
    snapshotDate: snapshot.evidenceFreshness.snapshotDate,
    learningState: snapshot.confidence.state,
    authorizedFounderMappings: contract.founderAccess.authorizedMappings.length,
    anthonyAccess: "pending_secure_mapping",
    recommendationInfluence: snapshot.safety.recommendationInfluence,
    routeOrderingChanged: snapshot.safety.routeOrderingChanged,
    routeScoringWeightsChanged: snapshot.safety.routeScoringWeightsChanged,
    discoveryMode: "advisory_only",
    nearbyContext: "advisory_only",
    offRouteLearning: "active_read_only_observation",
    governedInputSha256: snapshot.governedInputSha256,
    snapshotSha256: snapshot.snapshotSha256
  };
}

const invokedPath = process.argv[1] ? new URL(`file://${process.argv[1]}`).pathname : "";
if (invokedPath === new URL(import.meta.url).pathname) {
  console.log(JSON.stringify(verifyRouteIqCommercialReadinessIntelligence(), null, 2));
}
