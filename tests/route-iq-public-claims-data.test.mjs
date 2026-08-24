import assert from "node:assert/strict";
import test from "node:test";
import {
  getRouteIqPublicClaim,
  loadRouteIqPublicClaimsEvidenceMatrix,
  RouteIqPublicClaimsEvidenceError,
  validateRouteIqPublicClaimsEvidenceMatrix,
  verifyRouteIqPublicClaimsEvidence
} from "../data/route-iq-commercial-readiness-v1/route-iq-public-claims-evidence.mjs";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test("canonical public-claims evidence matrix verifies every governed Data source", () => {
  const result = verifyRouteIqPublicClaimsEvidence();
  assert.equal(result.status, "PASS");
  assert.equal(result.matrixVersion, "route-iq-public-claims-evidence-matrix-v1");
  assert.equal(result.verifiedSources.length, 7);
  assert.equal(result.verifiedCorroborationSources.length, 2);
  assert.equal(result.claimCount, 20);
  assert.equal(result.evidencePreservationAggregateSha256, "f7c328fc5da300e70355a6363049323ca6699eab2c54a12f0f1ed83ff07a02fd");
  assert.equal(result.collection, "OFF");
  assert.equal(result.activeCohorts, 0);
  assert.equal(result.recommendationInfluence, "OFF");
});

test("Intelligence corroboration pins the exact owner successor", () => {
  const matrix = loadRouteIqPublicClaimsEvidenceMatrix();
  const source = matrix.crossOwnerCorroborationSources.find(
    entry => entry.ownerSubsystem === "Prometheus Intelligence Engine"
  );
  assert.deepEqual(source, {
    ownerSubsystem: "Prometheus Intelligence Engine",
    ownerCommit: "e4823b1b6d700510564c67d44edff3b2fa0c5ed0",
    ownerTree: "abd8479e7fdf780709cfce85bad801b464da8679",
    path: "intelligence/contracts/route-iq-public-intelligence-claims-v1.json",
    sha256: "a7288081d6dbdccabbd6d8428f9d1e6e5dbfd410c65db568297fad173cf027ae",
    corroborationResult: "COMPATIBLE_ONLY_WITH_EXPLICIT_QUALIFICATIONS"
  });
});

test("Fitness Connection is Founder research and never customer evidence", () => {
  const matrix = loadRouteIqPublicClaimsEvidenceMatrix();
  assert.equal(matrix.governedState.relationshipClassification, "FOUNDER_FIELD_RESEARCH");
  assert.deepEqual(matrix.governedState.relationshipRepresentation, {
    customer: false,
    partner: false,
    sponsor: false,
    committedPilot: false,
    publicEndorsementClaimAllowed: false
  });
  assert.equal(
    getRouteIqPublicClaim("fitness_connection_customer_partner_pilot_sponsor_or_endorser", { matrix }).dataEvidenceDisposition,
    "PROHIBITED_RELATIONSHIP_CLAIM"
  );
  assert.equal(matrix.consumerRules.founderResearchMustNotBePresentedAsCustomerEvidence, true);
});

test("current evidence limits decision-ready semantics and blocks prediction and performance claims", () => {
  const matrix = loadRouteIqPublicClaimsEvidenceMatrix();
  assert.deepEqual(matrix.governedState.repositoryEvidence, {
    canonicalFieldSessions: 1,
    completedVisits: 4,
    observedRepresentatives: 1,
    territoryHistoryStatus: "unavailable",
    customerOutcomeHistoryEntries: 4,
    categoryOutcomeHistoryEntries: 1,
    evidenceWindow: {
      from: "2026-07-11T18:29:37.862Z",
      to: "2026-07-11T19:31:21.937Z"
    },
    wallClockFreshnessClaimAllowed: false,
    limitations: [
      "single founder-research session",
      "single observed representative",
      "single observed business category",
      "territory identity unavailable",
      "appointments unavailable",
      "follow-ups unavailable",
      "membership count unavailable"
    ]
  });
  assert.equal(
    getRouteIqPublicClaim("decision_ready_intelligence_current_state", { matrix }).dataEvidenceDisposition,
    "SUPPORTED_ONLY_AS_DEFINED_PRODUCT_SEMANTIC_REQUIRES_INTELLIGENCE_CORROBORATION"
  );
  assert.equal(getRouteIqPublicClaim("calibrated_probability_or_proven_prediction", { matrix }).dataEvidenceDisposition, "UNSUPPORTED_CURRENT_STATE");
  assert.equal(
    getRouteIqPublicClaim("recommendation_superiority_causal_uplift_or_performance_improvement", { matrix }).dataEvidenceDisposition,
    "PROHIBITED_UNSUPPORTED_CLAIM"
  );
  assert.equal(getRouteIqPublicClaim("evidence_to_read_only_intelligence", { matrix }).dataEvidenceDisposition, "REQUIRES_INTELLIGENCE_OWNER_CORROBORATION");
});

test("configuration and isolation claims remain bounded to verified architecture and synthetic proof", () => {
  const matrix = loadRouteIqPublicClaimsEvidenceMatrix();
  assert.equal(
    getRouteIqPublicClaim("workspace_profile_and_user_isolation", { matrix }).dataEvidenceDisposition,
    "SUPPORTED_AS_VERIFIED_ARCHITECTURE"
  );
  assert.equal(
    getRouteIqPublicClaim("configuration_driven_multi_business_product", { matrix }).dataEvidenceDisposition,
    "SUPPORTED_AS_SYNTHETIC_VALIDATION_ONLY"
  );
  assert.equal(
    getRouteIqPublicClaim("customer_traction_or_market_validation", { matrix }).dataEvidenceDisposition,
    "UNSUPPORTED_BY_GOVERNED_DATA"
  );
});

test("retention, privacy, transmission, and activation boundaries fail closed", () => {
  const matrix = loadRouteIqPublicClaimsEvidenceMatrix();
  assert.deepEqual(matrix.governedState.retention, {
    rawEvidenceMaximumCalendarMonths: 18,
    customerContractMayShorten: true,
    customerContractMayExpand: false,
    legalHoldSupported: true,
    physicalDeletionRuntimeActive: false,
    appendOnlyAuditRequired: true
  });
  assert.equal(matrix.governedState.privacyAndTransmission.newPiiCategoryIntroducedByThisMatrix, false);
  assert.equal(matrix.governedState.privacyAndTransmission.newExternalTransmissionIntroducedByThisMatrix, false);
  assert.equal(matrix.governedState.privacyAndTransmission.absoluteNoPiiProductClaimSupported, false);
  assert.equal(matrix.governedState.privacyAndTransmission.absoluteNoExternalTransmissionProductClaimSupported, false);
  assert.deepEqual(matrix.governedState.activation, {
    prospectiveCollection: "OFF",
    activeCohorts: 0,
    recommendationInfluence: "OFF",
    productionActivationAuthorized: false
  });
});

test("claim disposition tampering fails closed", () => {
  const matrix = clone(loadRouteIqPublicClaimsEvidenceMatrix());
  matrix.publicClaims.find(claim => claim.claimId === "decision_ready_intelligence_current_state").dataEvidenceDisposition = "SUPPORTED_CURRENT_STATE";
  assert.throws(
    () => validateRouteIqPublicClaimsEvidenceMatrix(matrix),
    error => error instanceof RouteIqPublicClaimsEvidenceError
      && error.code === "route_iq_public_claim_disposition_invalid"
  );
});

test("source hash tampering fails closed", () => {
  const matrix = clone(loadRouteIqPublicClaimsEvidenceMatrix());
  matrix.canonicalDataSources[0].sha256 = "0".repeat(64);
  assert.throws(
    () => validateRouteIqPublicClaimsEvidenceMatrix(matrix),
    error => error instanceof RouteIqPublicClaimsEvidenceError
      && error.code === "route_iq_public_claim_source_hash_mismatch"
  );
});

test("unknown claims cannot acquire an implicit evidence disposition", () => {
  assert.throws(
    () => getRouteIqPublicClaim("unsupported_marketing_claim"),
    error => error instanceof RouteIqPublicClaimsEvidenceError
      && error.code === "route_iq_public_claim_unknown"
  );
});
