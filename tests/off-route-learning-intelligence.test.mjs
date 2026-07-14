import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  buildCanonicalOffRouteLearningSnapshot,
  buildOffRouteLearningSnapshot,
  loadOffRouteLearningContract,
  loadOffRouteLearningPolicy,
  loadOffRouteLearningValidationFixture,
  normalizeVisitDecisionEvidence,
  projectCanonicalArchivedVisitEvidence,
  validateOffRouteLearningContract,
  validateOffRouteLearningPolicy,
  validateOffRouteLearningSnapshot
} from "../intelligence/off-route-learning-intelligence.mjs";
import {
  loadCanonicalArchivedFieldSessionPackages,
  loadReadOnlyFieldSessionLearningContract
} from "../intelligence/read-only-field-session-learning.mjs";
import { verifyOffRouteLearningIntelligence } from "../scripts/verify-off-route-learning-intelligence.mjs";

const root = new URL("../", import.meta.url);
const clone = value => JSON.parse(JSON.stringify(value));
const read = path => readFileSync(new URL(path, root));
const readJson = path => JSON.parse(read(path).toString("utf8"));
const sha256 = path => createHash("sha256").update(read(path)).digest("hex");

function fixtures() {
  const contract = loadOffRouteLearningContract();
  return {
    contract,
    policy: loadOffRouteLearningPolicy(),
    validationFixture: loadOffRouteLearningValidationFixture(contract)
  };
}

function buildValidation(records, overrides = {}) {
  const { contract, policy, validationFixture } = fixtures();
  return buildOffRouteLearningSnapshot({
    records: records || validationFixture.records,
    contract,
    policy,
    workspaceId: validationFixture.workspaceId,
    operatingProfileId: validationFixture.operatingProfileId,
    generatedAt: "2026-07-12T16:00:00.000Z",
    sourceMode: "validation_fixture",
    ...overrides
  });
}

test("off-route learning verifier passes against canonical read-only evidence", () => {
  const result = verifyOffRouteLearningIntelligence();

  assert.equal(result.status, "passed");
  assert.equal(result.verifiedVisitsConsumed, 4);
  assert.equal(result.knownSourceVisits, 0);
  assert.equal(result.unknownSourceVisits, 4);
  assert.equal(result.recommendationDecisionVisits, 0);
  assert.equal(result.recommendationAcceptanceRate, null);
  assert.equal(result.recommendationOverrideRate, null);
  assert.equal(result.recommendationInfluenceActive, false);
  assert.equal(result.recommendationScoringChanged, false);
  assert.equal(result.routeGenerationChanged, false);
  assert.equal(result.dataMutation, false);
});

test("source taxonomy covers every governed visit decision source", () => {
  const { contract, policy } = fixtures();
  const expected = [
    "route_iq_recommendation",
    "nearby_context",
    "representative_saved_place",
    "representative_discovery",
    "representative_follow_up",
    "manual_selection",
    "existing_relationship",
    "unknown"
  ];

  assert.deepEqual(policy.sourceTaxonomy.map(source => source.sourceId), expected);
  assert.deepEqual(contract.decisionSourceContract.requiredSourceIds, expected);
  assert.deepEqual(validateOffRouteLearningPolicy(policy), []);
  assert.deepEqual(validateOffRouteLearningContract(contract), []);
});

test("validation evidence tracks recommendation, nearby, discovery, saved, follow-up, manual, relationship, and unknown sources", () => {
  const snapshot = buildValidation();
  const tracked = new Set(snapshot.sourceTracking.map(record => record.decisionSource.sourceId));

  assert.deepEqual([...tracked].sort(), [
    "existing_relationship",
    "manual_selection",
    "nearby_context",
    "representative_discovery",
    "representative_follow_up",
    "representative_saved_place",
    "route_iq_recommendation",
    "unknown"
  ]);
  assert.equal(snapshot.sourceEvidence.knownSourceVisits, 7);
  assert.equal(snapshot.sourceEvidence.unknownSourceVisits, 1);
});

test("recommendation acceptance and override rates use only explicit decision context", () => {
  const snapshot = buildValidation();

  assert.deepEqual(snapshot.recommendationAcceptanceRate, {
    metricId: "recommendation_acceptance_rate",
    label: "Recommendation Acceptance Rate",
    valuePercent: 20,
    numerator: 1,
    denominator: 5,
    minimumEvidence: 5,
    status: "sufficient_evidence",
    limitingFactors: []
  });
  assert.equal(snapshot.recommendationOverrideRate.valuePercent, 80);
  assert.equal(snapshot.recommendationOverrideRate.numerator, 4);
  assert.equal(snapshot.recommendationOverrideRate.denominator, 5);
});

test("override and discovery success rates use governed structured outcome signals", () => {
  const snapshot = buildValidation();

  assert.equal(snapshot.overrideSuccessRate.valuePercent, 50);
  assert.equal(snapshot.overrideSuccessRate.numerator, 2);
  assert.equal(snapshot.overrideSuccessRate.denominator, 4);
  assert.equal(snapshot.discoverySuccessRate.valuePercent, 100);
  assert.equal(snapshot.discoverySuccessRate.status, "observed_insufficient_evidence");
});

test("Saved Place and follow-up sources remain distinct representative cohorts", () => {
  const snapshot = buildValidation();
  const saved = snapshot.sourceCohorts.find(cohort => cohort.sourceId === "representative_saved_place");
  const followUp = snapshot.sourceCohorts.find(cohort => cohort.sourceId === "representative_follow_up");

  assert.equal(saved.visits, 1);
  assert.equal(saved.successes, 1);
  assert.equal(saved.recommendationOverrides, 1);
  assert.equal(followUp.visits, 1);
  assert.equal(followUp.successes, 1);
  assert.equal(followUp.recommendationOverrides, 0);
});

test("off-route visits do not become overrides without explicit recommendation context", () => {
  const snapshot = buildValidation();
  for (const sourceId of ["representative_follow_up", "existing_relationship"]) {
    const record = snapshot.sourceTracking.find(item => item.decisionSource.sourceId === sourceId);
    assert.equal(record.isOffRoute, true);
    assert.equal(record.isRecommendationOverride, null);
    assert.equal(record.recommendationDecision.status, "no_recommendation_available");
  }
});

test("every verified override preserves required explainability and scope", () => {
  const { contract } = fixtures();
  const snapshot = buildValidation();

  assert.equal(snapshot.overrideObservations.length, 4);
  for (const override of snapshot.overrideObservations) {
    for (const field of contract.overrideExplainabilityRequiredFields) {
      assert.ok(Object.prototype.hasOwnProperty.call(override, field), `${override.overrideId}:${field}`);
    }
    assert.ok(override.reason);
    assert.ok(override.evidence.length > 0);
    assert.equal(override.representative, "cruz");
    assert.equal(override.workspace, "fitness_connection");
    assert.equal(override.recommendationInfluenceEligible, false);
  }
});

test("representative judgment comparison remains unavailable until both cohorts meet thresholds", () => {
  const snapshot = buildValidation();
  const confidence = snapshot.representativeJudgmentConfidence;

  assert.equal(confidence.representativeJudgmentOutcomes, 5);
  assert.equal(confidence.representativeJudgmentSuccessRatePercent, 80);
  assert.equal(confidence.routeRecommendationOutcomes, 1);
  assert.equal(confidence.comparison.status, "insufficient_evidence");
  assert.equal(confidence.comparison.representativeJudgmentOutperformsRouteIq, null);
  assert.equal(confidence.recommendationInfluenceEligible, false);
});

test("representative judgment comparison resolves only after both governed cohorts mature", () => {
  const { validationFixture } = fixtures();
  const routeTemplate = validationFixture.records.find(record => record.visitDecisionSource?.sourceId === "route_iq_recommendation");
  const judgmentTemplate = validationFixture.records.find(record => record.visitDecisionSource?.sourceId === "representative_saved_place");
  const records = [];
  for (let index = 0; index < 5; index += 1) {
    const route = clone(routeTemplate);
    route.visitId = `mature-route-${index}`;
    route.businessId = `mature-route-business-${index}`;
    route.visitOccurredAt = `2026-07-12T14:${String(index).padStart(2, "0")}:00.000Z`;
    route.visitDecisionSource.capturedAt = route.visitOccurredAt;
    route.visitDecisionSource.evidence[0].sourceRecordId = `mature-route-recommendation-${index}`;
    route.recommendationDecisionContext.recommendationId = `mature-route-recommendation-${index}`;
    route.outcome = {label: "No contact", conversations: 0, leads: 0, units: 0, laterUnits: 0, appointments: 0, sales: 0, contracts: 0, referrals: 0};
    records.push(route);

    const judgment = clone(judgmentTemplate);
    judgment.visitId = `mature-judgment-${index}`;
    judgment.businessId = `mature-judgment-business-${index}`;
    judgment.visitOccurredAt = `2026-07-12T15:${String(index).padStart(2, "0")}:00.000Z`;
    judgment.visitDecisionSource.capturedAt = judgment.visitOccurredAt;
    judgment.visitDecisionSource.evidence[0].sourceRecordId = `mature-judgment-source-${index}`;
    judgment.recommendationDecisionContext.recommendationId = `mature-bypassed-recommendation-${index}`;
    records.push(judgment);
  }

  const confidence = buildValidation(records).representativeJudgmentConfidence;
  assert.equal(confidence.comparison.status, "sufficient_evidence");
  assert.equal(confidence.representativeJudgmentSuccessRatePercent, 100);
  assert.equal(confidence.routeRecommendationSuccessRatePercent, 0);
  assert.equal(confidence.comparison.successRateDifferencePercentagePoints, 100);
  assert.equal(confidence.comparison.representativeJudgmentOutperformsRouteIq, true);
  assert.equal(confidence.recommendationInfluenceEligible, false);
});

test("canonical history stays Unknown instead of inferring acceptance from unavailable recommendation evidence", () => {
  const upstreamContract = loadReadOnlyFieldSessionLearningContract();
  const packages = loadCanonicalArchivedFieldSessionPackages(upstreamContract);
  const projected = projectCanonicalArchivedVisitEvidence(packages);
  const snapshot = buildCanonicalOffRouteLearningSnapshot({archivePackages: packages});

  assert.equal(projected.every(record => record.visitDecisionSource === null), true);
  assert.equal(projected.every(record => record.recommendationDecisionContext === null), true);
  assert.equal(snapshot.sourceTracking.every(record => record.decisionSource.reasonCode === "decision_source_not_recorded"), true);
  assert.equal(snapshot.sourceTracking.every(record => record.isRecommendationAcceptance === null), true);
  assert.equal(snapshot.sourceTracking.every(record => record.isRecommendationOverride === null), true);
});

test("administrative dispositions are inherited as a fail-closed upstream admission boundary", () => {
  const { contract } = fixtures();
  const upstreamContract = loadReadOnlyFieldSessionLearningContract();
  const packages = loadCanonicalArchivedFieldSessionPackages(upstreamContract);
  packages[0].administrativeDisposition = {
    schemaVersion: "route-iq-field-session-administrative-disposition-v1",
    state: "EXCLUDED_FROM_ANALYTICS",
    reason: "AUTOMATION_SMOKE_TEST_ACCIDENTAL_FINALIZATION"
  };
  packages[0].consumptionEligibility = {
    eligible: false,
    state: "EXCLUDED_FROM_ANALYTICS"
  };

  assert.equal(contract.administrativeDispositionAdmission.disposedSessionObservationAllowed, false);
  assert.equal(contract.administrativeDispositionAdmission.decisionSourceProjectionAllowed, false);
  assert.equal(contract.administrativeDispositionAdmission.representativeJudgmentProjectionAllowed, false);
  assert.equal(contract.administrativeDispositionAdmission.territoryOrCustomerMetricProjectionAllowed, false);
  assert.equal(contract.administrativeDispositionAdmission.recommendationInputProjectionAllowed, false);
  assert.equal(contract.administrativeDispositionAdmission.automaticZeroVisitExclusionAllowed, false);
  assert.equal(contract.administrativeDispositionAdmission.exactExcludedSessionId, "route-iq-field-session-fitness-connection-fitness-cruz-2026-07-14");
  assert.equal(contract.administrativeDispositionAdmission.exactExcludedRawSha256, "ceb72963ab4e98d6039c1a4a1a409d281bf9e41e6001bd78cca4c04364815765");
  assert.deepEqual(contract.administrativeDispositionAdmission.auditProjectionAllowedFields, ["sourceRawSha256", "dispositionRecordSha256"]);
  assert.equal(contract.administrativeDispositionAdmission.auditProjectionRawPayloadAllowed, false);
  assert.equal(contract.prospectiveRetentionAdmission.inheritedFromUpstreamReadOnlyLearning, true);
  assert.equal(contract.prospectiveRetentionAdmission.dataExactKeySuccessorCommit, "c73118ddb262d3010bbc94a900f8506fb2f56192");
  for (const field of ["prospectiveEvidenceObservationAllowed", "expiredOrUnknownEvidenceObservationAllowed", "disposedSessionObservationAllowed", "derivedProjectionMayOutliveSource", "recommendationInputProjectionAllowed", "automaticZeroVisitExclusionAllowed", "productionActivationEligible"]) {
    assert.equal(contract.prospectiveRetentionAdmission[field], false, field);
  }
  assert.throws(
    () => buildCanonicalOffRouteLearningSnapshot({ archivePackages: packages }),
    /administratively_disposed_session_excluded|administratively_ineligible_session_excluded/
  );
});

test("missing, incomplete, and unsupported source evidence fail safely to Unknown", () => {
  const { policy, validationFixture } = fixtures();
  const incomplete = clone(validationFixture.records[0]);
  incomplete.visitDecisionSource.reason = "";
  const unsupported = clone(validationFixture.records[0]);
  unsupported.visitId = "unsupported-source";
  unsupported.visitDecisionSource.sourceId = "personal_hunch";

  const first = normalizeVisitDecisionEvidence(incomplete, {policy});
  const second = normalizeVisitDecisionEvidence(unsupported, {policy});
  assert.equal(first.decisionSource.sourceId, "unknown");
  assert.equal(first.decisionSource.reasonCode, "decision_source_evidence_incomplete");
  assert.equal(first.isRecommendationAcceptance, null);
  assert.equal(second.decisionSource.sourceId, "unknown");
  assert.equal(second.decisionSource.reasonCode, "decision_source_unsupported");
  assert.equal(second.isRecommendationOverride, null);
});

test("workspace isolation and representative scope fail closed", () => {
  const { validationFixture } = fixtures();
  const crossWorkspace = clone(validationFixture.records);
  crossWorkspace[0].workspaceId = "smoothie_depot";
  assert.throws(() => buildValidation(crossWorkspace), /Unknown or cross-workspace off-route evidence/);

  const mixedRepresentatives = clone(validationFixture.records);
  mixedRepresentatives[0].representativeId = "anthony";
  assert.throws(() => buildValidation(mixedRepresentatives), /representative-scoped/);
  assert.throws(() => buildValidation(undefined, {workspaceId: "unknown_workspace"}), /Unknown off-route learning scope/);
});

test("projection is deterministic, deeply frozen, read-only, and matches the canonical artifact", () => {
  const upstreamContract = loadReadOnlyFieldSessionLearningContract();
  const paths = upstreamContract.canonicalSourceArtifacts;
  const before = Object.fromEntries(Object.entries(paths).map(([name, path]) => [name, read(path).toString("utf8")]));
  const first = buildCanonicalOffRouteLearningSnapshot();
  const second = buildCanonicalOffRouteLearningSnapshot();
  const after = Object.fromEntries(Object.entries(paths).map(([name, path]) => [name, read(path).toString("utf8")]));
  const canonical = readJson("intelligence/artifacts/off-route-learning-intelligence-v1/fitness_connection/cruz/off-route-learning-snapshot-v1.json");

  assert.deepEqual(second, first);
  assert.deepEqual(canonical, first);
  assert.deepEqual(validateOffRouteLearningSnapshot(first), []);
  assert.deepEqual(after, before);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.sourceTracking), true);
  assert.equal(Object.isFrozen(first.sourceTracking[0].explainability), true);
  assert.throws(() => { first.status = "mutated"; }, TypeError);
});

test("protected Dashboard, Data, route scoring, and route generation baselines remain unchanged", () => {
  const { contract } = fixtures();
  for (const [name, baseline] of Object.entries(contract.protectedBehaviorBaselines)) {
    assert.equal(sha256(baseline.path), baseline.sha256, name);
  }
  assert.equal(contract.readOnlySafety.modifyData, false);
  assert.equal(contract.readOnlySafety.modifyDashboard, false);
  assert.equal(contract.readOnlySafety.modifyRecommendationScoring, false);
  assert.equal(contract.readOnlySafety.modifyRouteGeneration, false);
  assert.equal(contract.readOnlySafety.activateRecommendationInfluence, false);
});
