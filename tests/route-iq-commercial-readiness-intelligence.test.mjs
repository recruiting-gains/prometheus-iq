import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  authorizeRouteIqFounderIntelligencePrincipal,
  buildCanonicalFitnessConnectionDailyIntelligenceSnapshot,
  buildRouteIqDailyIntelligenceSnapshot,
  computeRouteIqGovernedEvidenceHash,
  loadRouteIqCommercialReadinessIntelligenceContract,
  projectCanonicalFitnessConnectionDailyIntelligenceInput,
  routeIqCanonicalFounderDailySnapshotPath,
  validateRouteIqCommercialReadinessIntelligenceContract,
  validateRouteIqDailyIntelligenceSnapshot
} from "../intelligence/route-iq-daily-intelligence-snapshot.mjs";
import {
  buildFixtureDailySnapshot,
  loadRouteIqCommercialReadinessIntelligenceFixture,
  verifyRouteIqCommercialReadinessIntelligence
} from "../scripts/verify-route-iq-commercial-readiness-intelligence.mjs";

const clone = value => JSON.parse(JSON.stringify(value));
const canonicalArtifactUrl = new URL(`../${routeIqCanonicalFounderDailySnapshotPath}`, import.meta.url);

function assessmentFor(records, context, contract, overrides = {}) {
  const fixture = loadRouteIqCommercialReadinessIntelligenceFixture();
  return {
    ...clone(fixture.learningAssessment),
    ...overrides,
    sourceEvidenceSha256: computeRouteIqGovernedEvidenceHash(records, context, contract)
  };
}

test("commercial-readiness Intelligence verifier passes", () => {
  const result = verifyRouteIqCommercialReadinessIntelligence();
  assert.equal(result.status, "passed");
  assert.equal(result.batchId, "BATCH-20260718-002");
  assert.equal(result.learningState, "INSUFFICIENT_EVIDENCE");
  assert.equal(result.recommendationInfluence, "OFF");
  assert.equal(result.routeOrderingChanged, false);
  assert.equal(result.routeScoringWeightsChanged, false);
  assert.equal(result.canonicalFounderSnapshotDate, "2026-07-11");
  assert.equal(result.canonicalFounderSnapshotEvidenceRecords, 5);
  assert.match(result.canonicalFounderSnapshotSha256, /^[a-f0-9]{64}$/);
  assert.match(result.canonicalFounderArtifactFileSha256, /^[a-f0-9]{64}$/);
});

test("contract keeps Discovery, Nearby Context, and off-route learning non-influential", () => {
  const contract = loadRouteIqCommercialReadinessIntelligenceContract();
  assert.deepEqual(validateRouteIqCommercialReadinessIntelligenceContract(contract), []);
  assert.deepEqual(contract.advisoryDependencies.map(item => [item.feature, item.requiredStatus]), [
    ["Discovery Mode", "advisory_only"],
    ["Nearby Context", "advisory_only"],
    ["Off-route learning", "active_read_only_observation"]
  ]);
  assert.equal(contract.learningBoundary.recommendationInfluence, "OFF");
  assert.equal(contract.safety.routeOrderingChanged, false);
  assert.equal(contract.safety.routeScoringWeightsChanged, false);
  assert.equal(contract.founderAccess.canonicalIdentitySourceOwner, "Prometheus Data");
  assert.equal(contract.founderAccess.canonicalIdentitySourcePath, "data/route-iq-commercial-readiness-v1/route-iq-commercial-workspace-registry-v1.json");
  assert.equal(contract.founderAccess.canonicalIdentityRegistryVersion, "route-iq-commercial-workspace-registry-v1");
  assert.equal(contract.founderAccess.crossConsumerPrincipalEqualityRequired, true);
});

test("snapshot is deterministic across record ordering and has no wall-clock field", () => {
  const fixture = loadRouteIqCommercialReadinessIntelligenceFixture();
  const first = buildFixtureDailySnapshot({fixture});
  const second = buildFixtureDailySnapshot({fixture, records: [fixture.records[2], fixture.records[0], fixture.records[3], fixture.records[1]]});
  assert.deepEqual(second, first);
  assert.equal(first.generatedAt, undefined);
  assert.equal(first.evidenceFreshness.wallClockAgeCalculated, false);
  assert.equal(first.generatedFromEvidenceAt, "2026-07-17T19:00:00.000Z");
  assert.deepEqual(validateRouteIqDailyIntelligenceSnapshot(first), []);
});

test("unchanged governed evidence returns the exact prior snapshot content", () => {
  const fixture = loadRouteIqCommercialReadinessIntelligenceFixture();
  const initial = buildFixtureDailySnapshot({fixture});
  const repeat = buildFixtureDailySnapshot({fixture, records: [...fixture.records].reverse(), previousSnapshot: initial});
  assert.deepEqual(repeat, initial);
  assert.equal(repeat.snapshotSha256, initial.snapshotSha256);
  assert.equal(repeat.snapshotId, initial.snapshotId);
});

test("governed evidence changes produce deterministic deltas", () => {
  const fixture = loadRouteIqCommercialReadinessIntelligenceFixture();
  const contract = loadRouteIqCommercialReadinessIntelligenceContract();
  const previousRecords = fixture.records.slice(0, 2);
  const previous = buildRouteIqDailyIntelligenceSnapshot({
    principal: fixture.principal,
    businessContext: fixture.businessContext,
    records: previousRecords,
    learningAssessment: assessmentFor(previousRecords, fixture.businessContext, contract),
    contract
  });
  const current = buildFixtureDailySnapshot({fixture, previousSnapshot: previous});
  assert.equal(current.changesSincePrevious.governedEvidenceChanged, true);
  assert.equal(current.changesSincePrevious.evidenceRecordDelta, 2);
  assert.equal(current.changesSincePrevious.visitDelta, 1);
  assert.equal(current.changesSincePrevious.outcomeDelta, 0);
  assert.notEqual(current.snapshotSha256, previous.snapshotSha256);
});

test("daily projection reports evidence, freshness, quality, trends, coverage, and insufficiency", () => {
  const snapshot = buildFixtureDailySnapshot();
  assert.equal(snapshot.evidenceCollected.totalRecords, 4);
  assert.equal(snapshot.evidenceFreshness.status, "UNKNOWN_PRESENT");
  assert.equal(snapshot.dataQuality.status, "REVIEW_REQUIRED");
  assert.deepEqual(snapshot.visitAndOutcomeTrends.daily.map(day => day.date), ["2026-07-16", "2026-07-17"]);
  assert.equal(snapshot.visitAndOutcomeTrends.totals.visits, 2);
  assert.equal(snapshot.visitAndOutcomeTrends.totals.outcomes, 1);
  assert.equal(snapshot.learningCoverage.representativesObserved, 2);
  assert.equal(snapshot.learningCoverage.territoriesObserved, 1);
  assert.equal(snapshot.confidence.state, "INSUFFICIENT_EVIDENCE");
  assert.equal(snapshot.confidence.insufficiencyIsRecommendation, false);
});

test("Cruz requires the exact secure immutable mapping", () => {
  const fixture = loadRouteIqCommercialReadinessIntelligenceFixture();
  const contract = loadRouteIqCommercialReadinessIntelligenceContract();
  const authorized = authorizeRouteIqFounderIntelligencePrincipal(fixture.principal, contract);
  assert.equal(authorized.mappingId, "route-iq-founder-access-cruz-v1");
  assert.equal(authorized.immutablePrincipalId, "riq_principal_7250bf2f7db15371eea3173c4f25953cffd6adf5b29f093ce8f9f0977a70e3c4");

  for (const mutation of [
    {mappingId: "route-iq-founder-access-cruz-v2"},
    {immutablePrincipalId: "route-iq-principal-founder-other-v1"},
    {authenticationAuthority: "display_name"},
    {callerSupplied: true},
    {authenticated: false}
  ]) {
    assert.throws(() => authorizeRouteIqFounderIntelligencePrincipal({...fixture.principal, ...mutation}, contract));
  }
});

test("display names, representatives, and Anthony remain unauthorized", () => {
  const fixture = loadRouteIqCommercialReadinessIntelligenceFixture();
  const contract = loadRouteIqCommercialReadinessIntelligenceContract();
  assert.throws(() => authorizeRouteIqFounderIntelligencePrincipal({displayName: "Cruz Garza", role: "founder"}, contract));
  assert.throws(() => authorizeRouteIqFounderIntelligencePrincipal({...fixture.principal, role: "representative"}, contract));
  assert.throws(() => authorizeRouteIqFounderIntelligencePrincipal({
    ...fixture.principal,
    displayName: "Anthony",
    mappingId: "route-iq-founder-access-anthony-v1",
    immutablePrincipalId: "route-iq-principal-founder-anthony-v1"
  }, contract));
  assert.equal(contract.founderAccess.pendingMappings[0].status, "pending_secure_authenticated_identity_mapping");
  assert.equal(contract.founderAccess.pendingMappings[0].accessAllowed, false);
});

test("workspace and operating-profile mismatches fail closed", () => {
  const fixture = loadRouteIqCommercialReadinessIntelligenceFixture();
  const record = clone(fixture.records[0]);
  record.workspaceId = "another_workspace";
  assert.throws(() => buildFixtureDailySnapshot({fixture, records: [record]}), /evidence_scope_mismatch/);

  const profileRecord = clone(fixture.records[0]);
  profileRecord.operatingProfileId = "another_profile";
  assert.throws(() => buildFixtureDailySnapshot({fixture, records: [profileRecord]}), /evidence_scope_mismatch/);
});

test("Fitness Connection requires the Founder research classification", () => {
  const fixture = loadRouteIqCommercialReadinessIntelligenceFixture();
  const contract = loadRouteIqCommercialReadinessIntelligenceContract();
  const businessContext = {
    ...fixture.businessContext,
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    evidenceClassification: "CUSTOMER_AUTHORIZED_OPERATIONAL"
  };
  const records = fixture.records.map(record => ({...record, workspaceId: "fitness_connection", operatingProfileId: "fitness"}));
  assert.throws(() => computeRouteIqGovernedEvidenceHash(records, businessContext, contract), /fitness_connection_research_classification_required/);

  businessContext.evidenceClassification = "FOUNDER_FIELD_RESEARCH";
  assert.match(computeRouteIqGovernedEvidenceHash(records, businessContext, contract), /^[a-f0-9]{64}$/);
});

test("raw notes, contact details, names, addresses, coordinates, and secrets fail closed", () => {
  const fixture = loadRouteIqCommercialReadinessIntelligenceFixture();
  for (const forbidden of [
    {notes: "private note"},
    {email: "person@example.invalid"},
    {businessName: "Example"},
    {address: "100 Example Street"},
    {latitude: 29.7},
    {secret: "never"}
  ]) {
    assert.throws(() => buildFixtureDailySnapshot({fixture, records: [{...fixture.records[0], ...forbidden}]}), /unauthorized_field_present/);
  }
});

test("excluded, duplicate, unauthorized, and tampered evidence fails closed", () => {
  const fixture = loadRouteIqCommercialReadinessIntelligenceFixture();
  assert.throws(() => buildFixtureDailySnapshot({
    fixture,
    records: [{...fixture.records[0], excludedFromAnalytics: true}]
  }), /excluded_evidence_admission_denied/);
  assert.throws(() => buildFixtureDailySnapshot({
    fixture,
    records: [{...fixture.records[0], authorized: false}]
  }), /unauthorized_evidence_record/);
  assert.throws(() => buildFixtureDailySnapshot({
    fixture,
    records: [fixture.records[0], clone(fixture.records[0])]
  }), /duplicate_evidence_identity/);
  assert.throws(() => buildFixtureDailySnapshot({
    fixture,
    records: [{...fixture.records[0], sourceRecordSha256: "tampered"}]
  }), /invalid_source_record_hash/);
});

test("learning assessment is evidence-bound and cannot activate influence", () => {
  const fixture = loadRouteIqCommercialReadinessIntelligenceFixture();
  const contract = loadRouteIqCommercialReadinessIntelligenceContract();
  assert.throws(() => buildRouteIqDailyIntelligenceSnapshot({
    principal: fixture.principal,
    businessContext: fixture.businessContext,
    records: fixture.records,
    learningAssessment: {...fixture.learningAssessment, sourceEvidenceSha256: "0".repeat(64)},
    contract
  }), /learning_assessment_evidence_hash_mismatch/);
  assert.throws(() => buildFixtureDailySnapshot({
    fixture,
    learningAssessment: {...fixture.learningAssessment, recommendationInfluence: "ON"}
  }), /recommendation_influence_must_remain_off/);
  assert.throws(() => buildFixtureDailySnapshot({
    fixture,
    learningAssessment: {...fixture.learningAssessment, predictionClaimed: true}
  }), /learning_assessment_boundary_invalid/);
});

test("snapshot is deeply immutable and representative output remains prohibited", () => {
  const snapshot = buildFixtureDailySnapshot();
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot.visitAndOutcomeTrends.daily), true);
  assert.equal(snapshot.safety.representativeReadable, false);
  assert.equal(snapshot.safety.sourceEvidenceMutationAllowed, false);
  assert.equal(snapshot.safety.discoveryModeInfluenceChanged, false);
  assert.equal(snapshot.safety.nearbyContextInfluenceChanged, false);
  assert.equal(snapshot.safety.offRouteLearningInfluenceChanged, false);
});

test("canonical July 11 Founder snapshot matches its stable checked-in artifact", () => {
  const artifact = JSON.parse(readFileSync(canonicalArtifactUrl, "utf8"));
  const regenerated = buildCanonicalFitnessConnectionDailyIntelligenceSnapshot({previousSnapshot: artifact});
  assert.deepEqual(regenerated, artifact);
  assert.deepEqual(validateRouteIqDailyIntelligenceSnapshot(artifact), []);
  assert.equal(artifact.workspaceId, "fitness_connection");
  assert.equal(artifact.operatingProfileId, "fitness");
  assert.equal(artifact.evidenceClassification, "FOUNDER_FIELD_RESEARCH");
  assert.equal(artifact.evidenceFreshness.snapshotDate, "2026-07-11");
  assert.equal(artifact.evidenceCollected.totalRecords, 5);
  assert.equal(artifact.visitAndOutcomeTrends.totals.visits, 4);
  assert.equal(artifact.visitAndOutcomeTrends.totals.outcomes, 4);
  assert.equal(artifact.visitAndOutcomeTrends.totals.conversations, 4);
  assert.equal(artifact.visitAndOutcomeTrends.totals.leads, 3);
  assert.equal(artifact.visitAndOutcomeTrends.totals.memberships, null);
  assert.equal(artifact.visitAndOutcomeTrends.totals.appointments, null);
  assert.equal(artifact.visitAndOutcomeTrends.totals.followUps, null);
  assert.deepEqual(artifact.dataQuality.unavailableMetrics, ["appointments", "followUps", "memberships"]);
  assert.equal(artifact.confidence.state, "INSUFFICIENT_EVIDENCE");
  assert.equal(artifact.safety.recommendationInfluence, "OFF");
  assert.equal(artifact.safety.representativeReadable, false);
});

test("canonical Founder artifact excludes source names, addresses, notes, contact, GPS, and secrets", () => {
  const artifactText = readFileSync(canonicalArtifactUrl, "utf8");
  for (const prohibited of [
    "Cruz",
    "cruz",
    "Galachy Tire Shop",
    "Exxon mechanic shop",
    "Texans Auto Repair",
    "Christian Brothers Automotive",
    "8774 Almeda",
    "14300 Gulf",
    "10326 Blackhawk",
    "9245 S Sam Houston",
    "Comeback today",
    "Business was closed",
    "gpsAttached",
    "googlePlaceId",
    "sourceReport"
  ]) assert.equal(artifactText.includes(prohibited), false, prohibited);
});

test("canonical projection uses Data pseudonym and changes only with governed input", () => {
  const inputs = projectCanonicalFitnessConnectionDailyIntelligenceInput();
  assert.equal(inputs.businessContext.evidenceClassification, "FOUNDER_FIELD_RESEARCH");
  assert.equal(inputs.businessContext.sourceOwner, "Prometheus Data");
  assert.equal(inputs.records.every(record => record.representativeId === "riq_rep_840494a83be97a7bad3c115a"), true);
  const baseline = buildRouteIqDailyIntelligenceSnapshot(inputs);
  const repeat = buildRouteIqDailyIntelligenceSnapshot({...inputs, previousSnapshot: baseline});
  assert.deepEqual(repeat, baseline);

  const changedRecords = clone(inputs.records);
  const visit = changedRecords.find(record => record.recordKind === "visit");
  visit.metrics.leads += 1;
  visit.sourceRecordSha256 = "f".repeat(64);
  const changedAssessment = clone(inputs.learningAssessment);
  changedAssessment.sourceEvidenceSha256 = computeRouteIqGovernedEvidenceHash(changedRecords, inputs.businessContext);
  const changed = buildRouteIqDailyIntelligenceSnapshot({
    ...inputs,
    records: changedRecords,
    learningAssessment: changedAssessment,
    previousSnapshot: baseline
  });
  assert.notEqual(changed.governedEvidenceSha256, baseline.governedEvidenceSha256);
  assert.notEqual(changed.snapshotSha256, baseline.snapshotSha256);
  assert.equal(changed.changesSincePrevious.governedEvidenceChanged, true);
});
