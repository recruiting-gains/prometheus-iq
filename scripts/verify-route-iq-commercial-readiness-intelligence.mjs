import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import {
  authorizeRouteIqFounderIntelligencePrincipal,
  buildCanonicalFitnessConnectionDailyIntelligenceSnapshot,
  buildRouteIqDailyIntelligenceSnapshot,
  computeRouteIqGovernedEvidenceHash,
  loadRouteIqCommercialReadinessIntelligenceContract,
  routeIqCanonicalFounderDailySnapshotPath,
  validateRouteIqCommercialReadinessIntelligenceContract,
  validateRouteIqDailyIntelligenceSnapshot
} from "../intelligence/route-iq-daily-intelligence-snapshot.mjs";

const fixtureUrl = new URL("../intelligence/fixtures/route-iq-commercial-readiness-daily-snapshot-v1.json", import.meta.url);
const canonicalArtifactUrl = new URL(`../${routeIqCanonicalFounderDailySnapshotPath}`, import.meta.url);
const writeCanonicalFromCli = process.argv.includes("--write-canonical");

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

function sha256Bytes(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function verifyRouteIqCommercialReadinessIntelligence(options = {}) {
  const contract = loadRouteIqCommercialReadinessIntelligenceContract();
  const fixture = loadRouteIqCommercialReadinessIntelligenceFixture();
  assert.deepEqual(validateRouteIqCommercialReadinessIntelligenceContract(contract), []);
  assert.equal(fixture.canonical, false);
  assert.equal(fixture.productionConsumptionAllowed, false);
  assert.equal(authorizeRouteIqFounderIntelligencePrincipal(fixture.principal, contract).authorized, true);
  assert.equal(contract.founderAccess.canonicalIdentitySourceOwner, "Prometheus Data");
  assert.equal(contract.founderAccess.canonicalIdentitySourcePath, "data/route-iq-commercial-readiness-v1/route-iq-commercial-workspace-registry-v1.json");
  assert.equal(contract.founderAccess.canonicalIdentityRegistryVersion, "route-iq-commercial-workspace-registry-v1");
  assert.equal(contract.founderAccess.authorizedMappings[0].immutablePrincipalId, "riq_principal_7250bf2f7db15371eea3173c4f25953cffd6adf5b29f093ce8f9f0977a70e3c4");

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

  const existingCanonical = existsSync(canonicalArtifactUrl)
    ? JSON.parse(readFileSync(canonicalArtifactUrl, "utf8"))
    : null;
  const explicitWrite = options.writeCanonical === true || writeCanonicalFromCli;
  const canonicalSnapshot = buildCanonicalFitnessConnectionDailyIntelligenceSnapshot({
    contract,
    previousSnapshot: explicitWrite ? null : existingCanonical
  });
  assert.deepEqual(validateRouteIqDailyIntelligenceSnapshot(canonicalSnapshot, contract), []);
  assert.equal(canonicalSnapshot.workspaceId, "fitness_connection");
  assert.equal(canonicalSnapshot.operatingProfileId, "fitness");
  assert.equal(canonicalSnapshot.evidenceClassification, "FOUNDER_FIELD_RESEARCH");
  assert.equal(canonicalSnapshot.evidenceFreshness.snapshotDate, "2026-07-11");
  assert.equal(canonicalSnapshot.evidenceCollected.totalRecords, 5);
  assert.deepEqual(canonicalSnapshot.evidenceCollected.byRecordKind, {field_session: 1, visit: 4});
  assert.equal(canonicalSnapshot.visitAndOutcomeTrends.totals.visits, 4);
  assert.equal(canonicalSnapshot.visitAndOutcomeTrends.totals.outcomes, 4);
  assert.equal(canonicalSnapshot.visitAndOutcomeTrends.totals.conversations, 4);
  assert.equal(canonicalSnapshot.visitAndOutcomeTrends.totals.leads, 3);
  assert.equal(canonicalSnapshot.confidence.state, "INSUFFICIENT_EVIDENCE");
  assert.equal(canonicalSnapshot.safety.recommendationInfluence, "OFF");
  assert.equal(canonicalSnapshot.safety.representativeReadable, false);
  assert.equal(canonicalSnapshot.evidenceCollected.sourceRecordHashes.includes("a62ec0643d61c8280e0e23dcd8616894a30a421dc9150281fb7cad334f5c0e6a"), true);

  if (explicitWrite) {
    mkdirSync(new URL("./", canonicalArtifactUrl), {recursive: true});
    writeFileSync(canonicalArtifactUrl, `${JSON.stringify(canonicalSnapshot, null, 2)}\n`, {flag: "w"});
  } else {
    assert.ok(existingCanonical, "Canonical Founder daily Intelligence snapshot is missing.");
    assert.deepEqual(existingCanonical, canonicalSnapshot, "Canonical Founder daily Intelligence snapshot is stale.");
  }
  const artifactBytes = readFileSync(canonicalArtifactUrl);

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
    canonicalIdentitySourceOwner: contract.founderAccess.canonicalIdentitySourceOwner,
    canonicalIdentityRegistryVersion: contract.founderAccess.canonicalIdentityRegistryVersion,
    cruzCanonicalPrincipalId: contract.founderAccess.authorizedMappings[0].immutablePrincipalId,
    anthonyAccess: "pending_secure_mapping",
    recommendationInfluence: snapshot.safety.recommendationInfluence,
    routeOrderingChanged: snapshot.safety.routeOrderingChanged,
    routeScoringWeightsChanged: snapshot.safety.routeScoringWeightsChanged,
    discoveryMode: "advisory_only",
    nearbyContext: "advisory_only",
    offRouteLearning: "active_read_only_observation",
    canonicalFounderSnapshotPath: routeIqCanonicalFounderDailySnapshotPath,
    canonicalFounderSnapshotDate: canonicalSnapshot.evidenceFreshness.snapshotDate,
    canonicalFounderSnapshotEvidenceRecords: canonicalSnapshot.evidenceCollected.totalRecords,
    canonicalFounderSnapshotSha256: canonicalSnapshot.snapshotSha256,
    canonicalFounderArtifactFileSha256: sha256Bytes(artifactBytes),
    canonicalSourceRawSha256: "a62ec0643d61c8280e0e23dcd8616894a30a421dc9150281fb7cad334f5c0e6a",
    governedInputSha256: snapshot.governedInputSha256,
    snapshotSha256: snapshot.snapshotSha256
  };
}

const invokedPath = process.argv[1] ? new URL(`file://${process.argv[1]}`).pathname : "";
if (invokedPath === new URL(import.meta.url).pathname) {
  console.log(JSON.stringify(verifyRouteIqCommercialReadinessIntelligence({writeCanonical: writeCanonicalFromCli}), null, 2));
}
