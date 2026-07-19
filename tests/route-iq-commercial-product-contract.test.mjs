import assert from "node:assert/strict";
import test from "node:test";
import {
  RouteIqCommercialProductContractError,
  loadRouteIqCommercialProductArtifacts,
  validateRouteIqCommercialProductContract,
  verifyRouteIqCommercialProductContract
} from "../scripts/verify-route-iq-commercial-product-contract.mjs";

const clone = value => JSON.parse(JSON.stringify(value));

test("Route IQ commercial product contract verifies committed owner boundaries", () => {
  const result = verifyRouteIqCommercialProductContract();
  assert.deepEqual(result, {
    status: "passed",
    batchId: "BATCH-20260718-002",
    soleActiveProduct: "route_iq",
    validatedCommittedOwnerArtifacts: ["Prometheus Data", "Prometheus Intelligence Engine", "Prometheus CRM"],
    contractualRuntimeOwnersPendingIntegratedVerification: ["Prometheus Dashboard", "Prometheus Website", "Prometheus Infrastructure"],
    lifecycleStageCount: 7,
    acceptanceGateCount: 15,
    recommendationInfluence: "OFF",
    prospectiveCollection: "OFF",
    productionMutationPerformed: false,
    deploymentPerformed: false
  });
});

test("Route IQ is the sole active product and every directive gate has an owner surface", () => {
  const { contract } = loadRouteIqCommercialProductArtifacts();
  assert.equal(contract.productPortfolio.soleActiveProduct, "route_iq");
  assert.deepEqual(contract.productPortfolio.products, [
    { productId: "route_iq", state: "active" },
    { productId: "gaia", state: "paused" },
    { productId: "athena", state: "architecture_only" }
  ]);
  assert.deepEqual(contract.acceptanceGates.map(gate => gate.gate), Array.from({ length: 15 }, (_, index) => index + 1));
  assert.ok(contract.acceptanceGates.every(gate => gate.ownerSubsystems.length > 0 && gate.evidenceSurfaces.length > 0));
});

test("Data is the canonical identity source for every Founder consumer", () => {
  const artifacts = loadRouteIqCommercialProductArtifacts();
  const fitness = artifacts.workspaceRegistry.workspaces.find(workspace => workspace.workspaceId === "fitness_connection");
  const canonicalPrincipal = fitness.users.find(user => user.representativeId === "cruz").authenticatedPrincipalId;
  assert.equal(artifacts.contract.accessControl.canonicalIdentitySourceOwner, "Prometheus Data");
  assert.equal(artifacts.contract.accessControl.founderIntelligence.cruzCanonicalPrincipalId, canonicalPrincipal);
  assert.equal(artifacts.intelligenceContract.founderAccess.authorizedMappings[0].immutablePrincipalId, canonicalPrincipal);
  assert.equal(artifacts.crmContract.authorization.authorizedImmutablePrincipal, canonicalPrincipal);
});

test("cross-consumer principal drift fails closed", () => {
  const artifacts = clone(loadRouteIqCommercialProductArtifacts());
  artifacts.intelligenceContract.founderAccess.authorizedMappings[0].immutablePrincipalId = "route-iq-principal-founder-cruz-v1";
  assert.throws(
    () => validateRouteIqCommercialProductContract(artifacts),
    error => error instanceof RouteIqCommercialProductContractError
      && error.code === "route_iq_product_cross_consumer_principal_drift"
  );

  const crmDrift = clone(loadRouteIqCommercialProductArtifacts());
  crmDrift.crmContract.authorization.authorizedImmutablePrincipal = "prn:prometheus:founder:cruz:v1";
  assert.throws(
    () => validateRouteIqCommercialProductContract(crmDrift),
    error => error.code === "route_iq_product_cross_consumer_principal_drift"
  );
});

test("customer-specific forks and relationship claims cannot be removed from prohibitions", () => {
  const artifacts = clone(loadRouteIqCommercialProductArtifacts());
  artifacts.contract.prohibitedCapabilities = artifacts.contract.prohibitedCapabilities.filter(
    capability => capability !== "CUSTOMER_SPECIFIC_CODE_FORK"
  );
  assert.throws(
    () => validateRouteIqCommercialProductContract(artifacts),
    error => error.code === "route_iq_product_prohibition_missing"
  );

  const claim = clone(loadRouteIqCommercialProductArtifacts());
  claim.evidencePreservation.relationshipRepresentation.customer = true;
  assert.throws(
    () => validateRouteIqCommercialProductContract(claim),
    error => error.code === "route_iq_product_relationship_claim_invalid"
  );
});

test("Smoothie Depot cannot return to normal operation through product configuration", () => {
  const artifacts = clone(loadRouteIqCommercialProductArtifacts());
  const smoothie = artifacts.workspaceRegistry.workspaces.find(workspace => workspace.workspaceId === "smoothie_depot");
  smoothie.normalOperationVisible = true;
  assert.throws(
    () => validateRouteIqCommercialProductContract(artifacts),
    error => error.code === "route_iq_product_historical_workspace_invalid"
  );
});

test("recommendation, prospective collection, and shadow output boundaries fail closed", () => {
  for (const mutate of [
    contract => { contract.safetyState.recommendationInfluence = "ON"; },
    contract => { contract.safetyState.prospectiveCollection = "ON"; },
    contract => { contract.safetyState.activeProspectiveCohorts = 1; },
    contract => { contract.safetyState.representativeFacingShadowOutput = true; }
  ]) {
    const artifacts = clone(loadRouteIqCommercialProductArtifacts());
    mutate(artifacts.contract);
    assert.throws(() => validateRouteIqCommercialProductContract(artifacts));
  }
});

test("missing committed owner artifacts fail closed", () => {
  assert.throws(
    () => loadRouteIqCommercialProductArtifacts({ repoRoot: "/route-iq-owner-artifacts-do-not-exist" }),
    error => error instanceof RouteIqCommercialProductContractError
      && error.code === "route_iq_product_owner_artifact_missing_or_invalid"
  );
});

test("rollout remains Founder-gated, private-Worker-only, and forward-revertable", () => {
  const { contract } = loadRouteIqCommercialProductArtifacts();
  assert.equal(contract.rollout.eventualDeploymentTarget, "private_prometheus_iq_worker_only");
  assert.equal(contract.rollout.publicWorkerExcluded, true);
  assert.equal(contract.rollout.founderDeploymentAuthorizationRequired, true);
  assert.equal(contract.rollout.rollback.historyRewriteAllowed, false);
  assert.equal(contract.rollout.rollback.archiveRewriteAllowed, false);
  assert.equal(contract.rollout.rollback.preserveExistingEvidence, true);
  assert.equal(contract.safetyState.deploymentAuthorizedByBatch, false);
});
