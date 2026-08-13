import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  buildRouteIqEligibleSessionManifest
} from "../data/route-iq-field-sessions-v1/route-iq-eligible-session-manifest.mjs";
import {
  buildRouteIqGovernedMultiSessionLearning,
  canonicalRouteIqGovernedLearningJson,
  createRouteIqGovernedLearningUnavailableAdvisory
} from "../intelligence/route-iq-governed-multi-session-learning.mjs";
import {
  verifyCanonicalRouteIqGovernedLearningArtifact
} from "../intelligence/provenance/verify-route-iq-governed-multi-session-learning-v1.mjs";
import {
  buildReadOnlyFieldSessionLearningSnapshot,
  loadReadOnlyFieldSessionLearningContract,
  loadReadOnlyFieldSessionLearningPolicy
} from "../intelligence/read-only-field-session-learning.mjs";
import {
  createSyntheticGovernedLearningFixture,
  loadFitnessGovernedLearningFixture
} from "./helpers/route-iq-governed-learning-fixtures.mjs";

const root = resolve(import.meta.dirname, "..");
const protectedRouteFiles = [
  "intelligence/continuous-adaptive-route-replenishment.mjs",
  "intelligence/route-business-hours-eligibility.mjs"
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function hashes(paths = protectedRouteFiles) {
  return paths.map(path => createHash("sha256")
    .update(readFileSync(resolve(root, path)))
    .digest("hex"));
}

function build(fixture) {
  const eligibleSessionManifest = buildRouteIqEligibleSessionManifest(fixture);
  return buildRouteIqGovernedMultiSessionLearning({
    eligibleSessionManifest,
    archivePackages: fixture.archivePackages,
    workspaceRegistry: fixture.workspaceRegistry
  });
}

test("Intelligence projects the Founder research session deterministically without influencing routes", () => {
  const fixture = loadFitnessGovernedLearningFixture();
  const before = hashes();
  const first = build(fixture);
  const second = build(clone(fixture));

  assert.equal(
    canonicalRouteIqGovernedLearningJson(first),
    canonicalRouteIqGovernedLearningJson(second)
  );
  assert.equal(first.workspaceId, "fitness_connection");
  assert.equal(first.customerId, "fitness_connection_research");
  assert.notEqual(first.customerId, first.workspaceId);
  assert.equal(first.evidenceClassification, "FOUNDER_FIELD_RESEARCH");
  assert.equal(first.dashboardAdvisory.evidenceMaturity.sessionsAdmitted, 1);
  assert.equal(first.dashboardAdvisory.evidenceMaturity.visitsAdmitted, 4);
  assert.equal(first.dashboardAdvisory.evidenceMaturity.truthState, "Insufficient Evidence");
  assert.equal(first.dashboardAdvisory.confidence.propagation, "OFF");
  assert.equal(first.dashboardAdvisory.safety.recommendationInfluence, "OFF");
  assert.equal(first.safety.routeOrderingChanged, false);
  assert.equal(first.safety.routeScoringChanged, false);
  assert.equal(first.safety.businessHoursEligibilityChanged, false);
  assert.deepEqual(hashes(), before);
});

test("Intelligence accumulates synthetic non-Fitness sessions chronologically through the Operating Profile", () => {
  const fixture = createSyntheticGovernedLearningFixture();
  fixture.archivePackages.reverse();
  fixture.retentionDecisions.reverse();
  const result = build(fixture);

  assert.equal(result.workspaceId, "northstar_outside_sales_synthetic");
  assert.equal(result.customerId, "northstar_field_supply_company_synthetic");
  assert.equal(result.operatingProfileId, "general_outside_sales");
  assert.deepEqual(
    result.eligibleSessionManifest.entries.map(entry => entry.fieldSessionDate),
    ["2026-08-01", "2026-08-02"]
  );
  assert.equal(result.readOnlyLearningSnapshot.sourceEvidence.syntheticEvidenceConsumed, true);
  assert.equal(result.readOnlyLearningSnapshot.status, "synthetic_validation_observation_only");
  assert.equal(result.normalizedOutcomes.length, 2);
  assert.ok(result.normalizedOutcomes.every(outcome => (
    outcome.profileId === "general_outside_sales"
  )));
  assert.ok(result.normalizedOutcomes.some(outcome => (
    outcome.mappingSource === "operating_profile"
  )));
  assert.ok(result.normalizedOutcomes.some(outcome => (
    outcome.mappingSource === "unclassified_review_required"
      && outcome.normalizedOutcome === null
      && outcome.evidence.reviewState === "human_review_required"
      && outcome.semanticDisposition.learningEligible === false
  )));
  assert.equal(result.dashboardAdvisory.evidenceMaturity.sessionsAdmitted, 2);
  assert.equal(result.dashboardAdvisory.evidenceMaturity.visitsAdmitted, 2);
  assert.equal(
    result.readOnlyLearningSnapshot.sourceEvidence.semanticLearningEligibleVisitCount,
    1
  );
  assert.equal(
    result.readOnlyLearningSnapshot.sourceEvidence.semanticReviewRequiredVisitCount,
    1
  );
  assert.equal(
    result.readOnlyLearningSnapshot.representativeIntelligence[0].leadQuality.leads,
    0
  );
  assert.equal(
    result.dashboardAdvisory.evidenceMaturity.successfulRelationshipCount,
    0
  );
});

test("Fitness No contact is quarantined while admitted Membership is Successful", () => {
  const result = build(loadFitnessGovernedLearningFixture());
  const noContact = result.normalizedOutcomes.find(outcome => outcome.rawOutcome === "No contact");
  const membership = result.normalizedOutcomes.find(outcome => outcome.rawOutcome === "Membership");
  const outcomeNodes = new Map(result.customerGraphSnapshot.nodes
    .filter(node => node.nodeType === "Outcome")
    .map(node => [node.nodeId, node]));
  const outcomeRelationships = result.customerGraphSnapshot.relationships.filter(relationship => (
    outcomeNodes.has(relationship.toNodeId)
  ));
  const noContactRelationship = outcomeRelationships.find(relationship => (
    outcomeNodes.get(relationship.toNodeId).attributes.visitId === noContact.visitId
  ));
  const membershipRelationship = outcomeRelationships.find(relationship => (
    outcomeNodes.get(relationship.toNodeId).attributes.visitId === membership.visitId
  ));

  assert.equal(noContact.normalizedOutcome, null);
  assert.equal(noContact.mappingSource, "unclassified_review_required");
  assert.equal(noContact.semanticDisposition.disposition, "unclassified_review_required");
  assert.equal(noContact.semanticDisposition.learningEligible, false);
  assert.equal(noContactRelationship.relationshipType, "Visited");
  assert.equal(noContactRelationship.reviewState, "human_review_required");
  assert.equal(noContactRelationship.semanticDisposition.successEligible, false);

  assert.equal(membership.normalizedOutcome, "sale");
  assert.equal(membership.semanticDisposition.disposition, "positive_success");
  assert.equal(membership.evidence.reviewState, "admitted_non_review_required");
  assert.equal(membershipRelationship.relationshipType, "Successful");
  assert.equal(membershipRelationship.semanticDisposition.successEligible, true);
  assert.equal(
    membershipRelationship.semanticDisposition.authority.source,
    "active_operating_profile.successEvents"
  );
  assert.equal(membershipRelationship.admittedEvidence.admitted, true);

  assert.equal(result.readOnlyLearningSnapshot.sourceEvidence.outcomeSemanticAdmissionCount, 4);
  assert.equal(result.readOnlyLearningSnapshot.sourceEvidence.semanticLearningEligibleVisitCount, 3);
  assert.equal(result.readOnlyLearningSnapshot.sourceEvidence.semanticReviewRequiredVisitCount, 1);
  assert.equal(
    result.readOnlyLearningSnapshot.representativeIntelligence[0]
      .conversationOutcomes.outcomes["No contact"],
    undefined
  );
  assert.equal(
    result.dashboardAdvisory.categoryTimeWindowPatterns[0].outcomes["No contact"],
    undefined
  );
  assert.equal(result.dashboardAdvisory.evidenceMaturity.truthState, "Insufficient Evidence");
  assert.equal(result.dashboardAdvisory.evidenceMaturity.reviewRequiredOutcomeCount, 1);
  assert.equal(result.dashboardAdvisory.evidenceMaturity.successfulRelationshipCount, 3);
  const noContactAdvisory = result.dashboardAdvisory.outcomeObservations.find(
    observation => observation.rawOutcome === "No contact"
  );
  assert.equal(noContactAdvisory.truthState, "Review Required");
  assert.equal(noContactAdvisory.normalizedOutcome, null);
  assert.equal(noContactAdvisory.semanticDisposition.successEligible, false);
  const noContactAdvisoryRelationship = result.dashboardAdvisory
    .businessVisitOutcomeRelationships.find(relationship => (
      relationship.relationshipId === noContactRelationship.relationshipId
    ));
  assert.equal(noContactAdvisoryRelationship.truthState, "Review Required");
  assert.equal(noContactAdvisoryRelationship.relationshipType, "Visited");
});

test("Successful and Follow-up graph relationships require admitted evidence and exact semantic authority", () => {
  const fixture = createSyntheticGovernedLearningFixture(1);
  const visit = fixture.archivePackages[0].verifiedFieldSession.verifiedFields.completedVisits[0];
  visit.sourceReport.outcome = "follow_up";
  fixture.archivePackages[0].historyUpdates.customerOutcomeHistory[0].loggedOutcome = "follow_up";
  const result = build(fixture);
  const semanticRelationships = result.customerGraphSnapshot.relationships.filter(relationship => (
    relationship.semanticDisposition
  ));
  const followUp = semanticRelationships.find(relationship => (
    relationship.relationshipType === "Follow-up"
  ));

  assert.ok(followUp);
  assert.equal(followUp.reviewState, "admitted_non_review_required");
  assert.equal(followUp.admittedEvidence.admitted, true);
  assert.equal(followUp.semanticDisposition.followUpEligible, true);
  assert.equal(
    followUp.semanticDisposition.authority.source,
    "operating_profile_outcome_semantic_disposition.canonicalFollowUpOutcome"
  );
  for (const relationship of semanticRelationships.filter(item => (
    ["Successful", "Follow-up"].includes(item.relationshipType)
  ))) {
    assert.equal(relationship.admittedEvidence.admitted, true);
    assert.notEqual(relationship.reviewState, "human_review_required");
    assert.ok(relationship.sourceEvidenceIds.length > 0);
    assert.ok(relationship.semanticDisposition.mappingRule.authority);
  }
});

test("the representative-learning semantic admission guard rejects missing, replayed, and cross-record evidence", () => {
  const fixture = loadFitnessGovernedLearningFixture();
  const governed = build(fixture);
  const admissions = governed.normalizedOutcomes.map(outcome => ({
    semanticContractVersion: outcome.semanticDisposition.contractVersion,
    sessionId: outcome.sessionId,
    visitId: outcome.visitId,
    sourceRecordSha256: outcome.evidence.admission.sourceRecordSha256,
    admitted: outcome.evidence.admission.admitted,
    reviewRequired: outcome.semanticDisposition.reviewRequired,
    learningEligible: outcome.semanticDisposition.learningEligible,
    disposition: outcome.semanticDisposition.disposition,
    normalizedOutcome: outcome.normalizedOutcome
  }));
  const buildLearning = outcomeSemanticAdmissions => buildReadOnlyFieldSessionLearningSnapshot({
    archivePackages: fixture.archivePackages,
    outcomeSemanticAdmissions
  });

  assert.throws(
    () => buildLearning(admissions.slice(1)),
    error => error?.code === "field_session_learning_semantic_admission_incomplete"
  );
  assert.throws(
    () => buildLearning([...admissions, clone(admissions[0])]),
    error => error?.code === "field_session_learning_semantic_admission_invalid"
  );
  const crossRecord = clone(admissions);
  crossRecord[0].sourceRecordSha256 = "f".repeat(64);
  assert.throws(
    () => buildLearning(crossRecord),
    error => error?.code === "field_session_learning_semantic_admission_invalid"
  );
});

test("Intelligence builds a customer-scoped graph and keeps workspace identity distinct", () => {
  const result = build(createSyntheticGovernedLearningFixture());
  const graph = result.customerGraphSnapshot;

  assert.equal(graph.customerId, result.customerId);
  assert.ok(graph.nodes.length > 0);
  assert.ok(graph.relationships.length > 0);
  assert.ok(graph.nodes.every(node => node.customerId === result.customerId));
  assert.ok(graph.relationships.every(relationship => (
    relationship.customerId === result.customerId
      && relationship.confidenceSeed.propagationActive === false
      && relationship.confidenceSeed.propagationEligible === false
  )));
  assert.equal(graph.safety.customerIsolationRequired, true);
  assert.equal(graph.safety.confidencePropagationActive, false);
  assert.equal(result.dashboardConsumerContract.customerId, result.customerId);
  assert.equal(result.dashboardQueryContract.customerId, result.customerId);
});

test("Intelligence fails closed on Administration customer mapping drift and archive scope drift", () => {
  const mappingDrift = createSyntheticGovernedLearningFixture();
  const manifest = buildRouteIqEligibleSessionManifest(mappingDrift);
  const registry = clone(mappingDrift.workspaceRegistry);
  registry.workspaces.find(workspace => (
    workspace.workspaceId === mappingDrift.workspaceId
  )).companyId = "different_synthetic_company";
  assert.throws(() => buildRouteIqGovernedMultiSessionLearning({
    eligibleSessionManifest: manifest,
    archivePackages: mappingDrift.archivePackages,
    workspaceRegistry: registry
  }), error => error?.code === "route_iq_learning_customer_mapping_rejected");

  const archiveDrift = createSyntheticGovernedLearningFixture();
  const archiveManifest = buildRouteIqEligibleSessionManifest(archiveDrift);
  archiveDrift.archivePackages[0].verifiedFieldSession.workspaceId = "fitness_connection";
  assert.throws(() => buildRouteIqGovernedMultiSessionLearning({
    eligibleSessionManifest: archiveManifest,
    archivePackages: archiveDrift.archivePackages,
    workspaceRegistry: archiveDrift.workspaceRegistry
  }), /failed closed/u);

  const unauthorizedScope = createSyntheticGovernedLearningFixture();
  const contract = clone(loadReadOnlyFieldSessionLearningContract());
  const policy = clone(loadReadOnlyFieldSessionLearningPolicy());
  contract.workspaceId = unauthorizedScope.workspaceId;
  contract.operatingProfileId = unauthorizedScope.operatingProfileId;
  contract.workspaceIsolation.requiredWorkspaceId = unauthorizedScope.workspaceId;
  contract.workspaceIsolation.requiredOperatingProfileId = unauthorizedScope.operatingProfileId;
  policy.workspaceId = unauthorizedScope.workspaceId;
  policy.operatingProfileId = unauthorizedScope.operatingProfileId;
  policy.admission.authorizedSessionIds = unauthorizedScope.archivePackages.map(
    item => item.manifest.sessionId
  );
  policy.admission.requiredSourceFinality.push("governed_final");
  assert.throws(() => buildReadOnlyFieldSessionLearningSnapshot({
    archivePackages: unauthorizedScope.archivePackages,
    contract,
    policy,
    workspaceId: unauthorizedScope.workspaceId,
    operatingProfileId: unauthorizedScope.operatingProfileId,
    sourceMode: "validation_fixture",
    evidenceClassification: unauthorizedScope.evidenceClassification
  }), error => error?.code === "field_session_learning_scope_authorization_rejected");
});

test("Intelligence bridge output excludes raw notes, contacts, precise locations, secrets, and stress evidence", () => {
  const serialized = JSON.stringify(build(loadFitnessGovernedLearningFixture()));
  for (const forbidden of [
    '"notes":',
    '"gpsAttached":',
    '"address":',
    '"contacts":',
    '"phone":',
    '"email":',
    '"latitude":',
    '"longitude":',
    '"stressTestObservations":',
    '"stressTestEvidence":',
    '"secret":'
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
  assert.equal(serialized.includes("candidateSelection"), false);
  assert.equal(serialized.includes("recommendationScore"), false);
  assert.equal(serialized.includes("probabilityRank"), false);
});

test("Intelligence labels weak, conflicting, unavailable, and browser-local evidence explicitly", () => {
  const result = build(loadFitnessGovernedLearningFixture());
  const advisory = result.dashboardAdvisory;

  assert.deepEqual(advisory.truthVocabulary, [
    "Verified",
    "Observed",
    "Review Required",
    "Insufficient Evidence",
    "Unknown"
  ]);
  assert.ok(Array.isArray(advisory.weakPatterns));
  assert.ok(Array.isArray(advisory.conflictingPatterns));
  assert.ok(Array.isArray(advisory.stalePatterns));
  assert.ok(Array.isArray(advisory.unavailableEvidence));
  assert.ok(Array.isArray(advisory.unknownEvidence));
  assert.equal(
    advisory.browserLocalEstimateBoundary.governedConfidenceBlendedWithBrowserEstimate,
    false
  );
  assert.equal(advisory.browserLocalEstimateBoundary.browserEstimateConfidence, null);
  assert.equal(advisory.safety.shadowDecisionReadinessExposed, false);
});

test("Unavailable evidence produces an honest advisory with no inferred confidence", () => {
  const advisory = createRouteIqGovernedLearningUnavailableAdvisory();
  assert.equal(advisory.status, "UNAVAILABLE");
  assert.equal(advisory.truthState, "Unknown");
  assert.equal(advisory.confidence.score, null);
  assert.equal(advisory.confidence.propagation, "OFF");
  assert.equal(advisory.safety.recommendationInfluence, "OFF");
});

test("The canonical governed-learning artifact matches deterministic source projection", () => {
  const result = verifyCanonicalRouteIqGovernedLearningArtifact();
  assert.equal(result.status, "PASS");
  assert.equal(result.sessions, 1);
  assert.equal(result.visits, 4);
  assert.equal(result.recommendationInfluence, "OFF");
  assert.equal(result.productionRuntimeActivated, false);
});
