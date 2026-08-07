import assert from "node:assert/strict";
import test from "node:test";
import {
  RouteIqPublicPositioningContractError,
  loadRouteIqPublicPositioningArtifacts,
  validateRouteIqPublicPositioningClaims,
  verifyRouteIqPublicPositioningClaims
} from "../scripts/verify-route-iq-public-positioning-claims.mjs";

const clone = value => JSON.parse(JSON.stringify(value));

test("Route IQ public positioning contract verifies the sole-product story", () => {
  const result = verifyRouteIqPublicPositioningClaims();
  assert.deepEqual(result, {
    status: "passed",
    batchId: "BATCH-20260719-002",
    ownerSubsystem: "Prometheus Route IQ",
    company: "Prometheus.IQ",
    soleActiveProduct: "Prometheus Route IQ",
    primaryBuyer: "field_operations_leader",
    primaryUser: "field_representative",
    primaryPublicAction: "REQUEST_ROUTE_IQ",
    supportableClaimCount: 8,
    forbiddenClaimCount: 12,
    limitationCount: 8,
    objectionCount: 10,
    unresolvedDisclosedCount: 2,
    recommendationInfluence: "OFF",
    prospectiveCollection: "OFF",
    activeProspectiveCohorts: 0,
    recommendationReadiness: "INSUFFICIENT_EVIDENCE",
    productionBehaviorChanged: false,
    deploymentPerformed: false
  });
});

test("one buyer, one user, and one primary public action are mandatory", () => {
  for (const mutate of [
    artifacts => { artifacts.contract.fiveSecondPositioning.primaryBuyer.count = 2; },
    artifacts => { artifacts.contract.fiveSecondPositioning.primaryUser.role = "generic_business_user"; },
    artifacts => { artifacts.contract.fiveSecondPositioning.primaryPublicAction = "BOOK_A_DEMO"; }
  ]) {
    const artifacts = clone(loadRouteIqPublicPositioningArtifacts());
    mutate(artifacts);
    assert.throws(
      () => validateRouteIqPublicPositioningClaims(artifacts),
      error => error instanceof RouteIqPublicPositioningContractError
    );
  }
});

test("the evidence to probability to human-decision order fails closed on drift", () => {
  const artifacts = clone(loadRouteIqPublicPositioningArtifacts());
  [artifacts.contract.decisionSupportLifecycle.stages[2], artifacts.contract.decisionSupportLifecycle.stages[3]] = [
    artifacts.contract.decisionSupportLifecycle.stages[3],
    artifacts.contract.decisionSupportLifecycle.stages[2]
  ];
  assert.throws(
    () => validateRouteIqPublicPositioningClaims(artifacts),
    error => error.code === "route_iq_positioning_lifecycle_invalid"
  );
});

test("route planner, CRM, maps, and generic AI distinctions cannot become replacement claims", () => {
  const artifacts = clone(loadRouteIqPublicPositioningArtifacts());
  artifacts.contract.differentiation.find(record => record.category === "crm").replacementClaimAllowed = true;
  assert.throws(
    () => validateRouteIqPublicPositioningClaims(artifacts),
    error => error.code === "route_iq_positioning_differentiation_invalid"
  );
});

test("unsupported public claims are rejected even when placed in the allowlist", () => {
  const artifacts = clone(loadRouteIqPublicPositioningArtifacts());
  artifacts.contract.supportableClaims[0].publicText = "Route IQ guarantees proven recommendation superiority.";
  assert.throws(
    () => validateRouteIqPublicPositioningClaims(artifacts),
    error => error.code === "route_iq_positioning_unsupported_public_claim"
  );
});

test("Fitness Connection cannot be represented as a commercial relationship", () => {
  for (const field of ["customerClaimAllowed", "pilotClaimAllowed", "partnerClaimAllowed", "sponsorClaimAllowed", "endorsementClaimAllowed", "logoOrTestimonialUseAllowed"]) {
    const artifacts = clone(loadRouteIqPublicPositioningArtifacts());
    artifacts.contract.fitnessConnectionBoundary[field] = true;
    assert.throws(
      () => validateRouteIqPublicPositioningClaims(artifacts),
      error => error.code === "route_iq_positioning_fitness_boundary_invalid"
    );
  }
});

test("performance, causal, recommendation, scale, and activation prohibitions are complete", () => {
  for (const forbiddenClaimId of [
    "proven_performance_improvement",
    "causal_uplift",
    "recommendation_superiority_or_readiness",
    "unlimited_scale",
    "active_collection_cohort_or_influence"
  ]) {
    const artifacts = clone(loadRouteIqPublicPositioningArtifacts());
    artifacts.contract.forbiddenClaims = artifacts.contract.forbiddenClaims.filter(claim => claim.claimId !== forbiddenClaimId);
    assert.throws(
      () => validateRouteIqPublicPositioningClaims(artifacts),
      error => error.code === "route_iq_positioning_forbidden_claims_invalid"
    );
  }
});

test("recommendation, collection, cohort, readiness, and shadow boundaries remain fail closed", () => {
  for (const mutate of [
    contract => { contract.safetyState.recommendationInfluence = "ON"; },
    contract => { contract.safetyState.prospectiveCollection = "ON"; },
    contract => { contract.safetyState.activeProspectiveCohorts = 1; },
    contract => { contract.safetyState.recommendationReadiness = "ELIGIBLE_FOR_FOUNDER_REVIEW"; },
    contract => { contract.safetyState.representativeFacingShadowOutput = true; },
    contract => { contract.safetyState.automatedOperationalAction = true; }
  ]) {
    const artifacts = clone(loadRouteIqPublicPositioningArtifacts());
    mutate(artifacts.contract);
    assert.throws(
      () => validateRouteIqPublicPositioningClaims(artifacts),
      error => error.code === "route_iq_positioning_safety_invalid"
    );
  }
});

test("ten ranked investor objections must include plainly disclosed unresolved weaknesses", () => {
  const missing = clone(loadRouteIqPublicPositioningArtifacts());
  missing.contract.investorObjectionResolution.pop();
  assert.throws(
    () => validateRouteIqPublicPositioningClaims(missing),
    error => error.code === "route_iq_positioning_objections_invalid"
  );

  const hidden = clone(loadRouteIqPublicPositioningArtifacts());
  hidden.contract.investorObjectionResolution.forEach(objection => {
    if (objection.resolutionStatus === "unresolved_disclosed") objection.resolutionStatus = "resolved_by_positioning";
  });
  assert.throws(
    () => validateRouteIqPublicPositioningClaims(hidden),
    error => error.code === "route_iq_positioning_objections_invalid"
  );
});

test("Route IQ owner scope excludes Website, CRM, Infrastructure, Data, Intelligence, and Overwatch implementation", () => {
  const { contract } = loadRouteIqPublicPositioningArtifacts();
  assert.deepEqual(contract.ownerBoundary.ownerFiles, [
    "docs/route-iq-public-positioning-claims-contract-v1.json",
    "scripts/verify-route-iq-public-positioning-claims.mjs",
    "tests/route-iq-public-positioning-claims.test.mjs"
  ]);
  for (const field of ["websiteImplementationIncluded", "crmImplementationIncluded", "infrastructureImplementationIncluded", "dataImplementationIncluded", "intelligenceImplementationIncluded", "overwatchGovernanceIncluded"]) {
    assert.equal(contract.ownerBoundary[field], false);
  }
});
