import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import {
  RouteIqCommercialProductContractError,
  loadRouteIqCommercialProductArtifacts,
  routeIqCommercialProductPaths,
  validateRouteIqCommercialProductContract,
  verifyRouteIqCommercialProductContract,
  verifyRouteIqCommercialProductRuntimeSurfaces
} from "../scripts/verify-route-iq-commercial-product-contract.mjs";

const clone = value => JSON.parse(JSON.stringify(value));

test("Route IQ commercial product contract verifies committed owner boundaries", () => {
  const result = verifyRouteIqCommercialProductContract({ allowPendingOwnerIntegration: true });
  assert.equal(result.batchId, "BATCH-20260718-002");
  assert.equal(result.soleActiveProduct, "route_iq");
  assert.deepEqual(result.validatedCommittedOwnerArtifacts, ["Prometheus Data", "Prometheus Intelligence Engine", "Prometheus CRM"]);
  assert.equal(result.lifecycleStageCount, 7);
  assert.equal(result.founderDailySnapshotLifecycleStageCount, 4);
  assert.equal(result.acceptanceGateCount, 15);
  assert.deepEqual(result.deploymentScopes, [
    { scopeId: "private_dashboard_runtime", targetWorker: "prometheus-iq", deploymentAuthorizedNow: false },
    { scopeId: "public_website_crm_runtime", targetWorker: "prometheusrouteiq-website", deploymentAuthorizedNow: false }
  ]);
  assert.equal(result.recommendationInfluence, "OFF");
  assert.equal(result.prospectiveCollection, "OFF");
  assert.equal(result.productionMutationPerformed, false);
  assert.equal(result.deploymentPerformed, false);
  assert.ok(["pending_owner_integration", "passed"].includes(result.status));
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

test("retired workspaces cannot enter the production registry or bypass activation rules", () => {
  const artifacts = clone(loadRouteIqCommercialProductArtifacts());
  const retired = clone(artifacts.workspaceRegistry.workspaces.find(
    workspace => workspace.workspaceState === "synthetic_validation_only"
  ));
  retired.workspaceId = "retired_customer_workspace";
  retired.workspaceState = "inactive_historical";
  retired.normalOperationVisible = false;
  retired.productionActivationAuthorized = false;
  artifacts.workspaceRegistry.workspaces.push(retired);
  assert.throws(
    () => validateRouteIqCommercialProductContract(artifacts),
    error => error.code === "route_iq_product_registry_workspace_state_invalid"
  );

  const syntheticActivation = clone(loadRouteIqCommercialProductArtifacts());
  const synthetic = syntheticActivation.workspaceRegistry.workspaces.find(
    workspace => workspace.workspaceState === "synthetic_validation_only"
  );
  synthetic.productionActivationAuthorized = true;
  assert.throws(
    () => validateRouteIqCommercialProductContract(syntheticActivation),
    error => error.code === "route_iq_product_registry_activation_invalid"
  );

  const researchActivation = clone(loadRouteIqCommercialProductArtifacts());
  const founderResearch = researchActivation.workspaceRegistry.workspaces.find(
    workspace => workspace.workspaceState === "active_founder_research"
  );
  founderResearch.productionActivationAuthorized = true;
  assert.throws(
    () => validateRouteIqCommercialProductContract(researchActivation),
    error => error.code === "route_iq_product_registry_activation_invalid"
  );
});

test("production registry contains only governed current and synthetic configurations", () => {
  const artifacts = loadRouteIqCommercialProductArtifacts();
  const admission = artifacts.contract.commercialArchitecture.configuration.productionRegistryAdmission;
  const allowed = new Set(admission.allowedWorkspaceStates);
  assert.deepEqual(admission.deniedWorkspaceStates, ["inactive_historical"]);
  assert.ok(artifacts.workspaceRegistry.workspaces.every(workspace => allowed.has(workspace.workspaceState)));
  assert.equal(
    artifacts.workspaceRegistry.workspaces.some(workspace => admission.deniedWorkspaceStates.includes(workspace.workspaceState)),
    false
  );
  assert.ok(artifacts.workspaceRegistry.workspaces.some(workspace => workspace.workspaceState === "active_founder_research"));
  assert.ok(artifacts.workspaceRegistry.workspaces.some(workspace => workspace.workspaceState === "synthetic_validation_only"));
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

test("daily snapshot lifecycle is complete by contract and final verification fails closed on missing surfaces", () => {
  const { contract } = loadRouteIqCommercialProductArtifacts();
  assert.equal(contract.founderDailySnapshotLifecycle.integrationStatus, "pending_owner_integration_until_required_surfaces_verify");
  assert.equal(contract.founderDailySnapshotLifecycle.endpoint, "/api/dashboard/route-iq/intelligence/daily-snapshot");
  assert.deepEqual(contract.founderDailySnapshotLifecycle.stages.map(stage => stage.ownerSubsystem), [
    "Prometheus Intelligence Engine",
    "Prometheus Intelligence Engine",
    "Prometheus Infrastructure",
    "Prometheus Dashboard"
  ]);

  const temporaryRepo = mkdtempSync(join(tmpdir(), "route-iq-product-surface-test-"));
  try {
    for (const path of [routeIqCommercialProductPaths.contract, routeIqCommercialProductPaths.intelligenceContract]) {
      const target = resolve(temporaryRepo, path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, JSON.stringify(path === routeIqCommercialProductPaths.contract ? contract : loadRouteIqCommercialProductArtifacts().intelligenceContract));
    }
    assert.throws(
      () => verifyRouteIqCommercialProductRuntimeSurfaces({ repoRoot: temporaryRepo }),
      error => error instanceof RouteIqCommercialProductContractError
        && error.code === "route_iq_product_required_surface_missing"
    );
  } finally {
    rmSync(temporaryRepo, { recursive: true, force: true });
  }
});

test("rollout keeps private Dashboard and public Website/CRM deployment scopes separately Founder-gated", () => {
  const { contract } = loadRouteIqCommercialProductArtifacts();
  assert.equal(Object.hasOwn(contract.rollout, "eventualDeploymentTarget"), false);
  assert.equal(Object.hasOwn(contract.rollout, "publicWorkerExcluded"), false);
  assert.equal(contract.rollout.founderDeploymentAuthorizationRequired, true);
  assert.equal(contract.rollout.deploymentAuthorizedByBatch, false);
  assert.deepEqual(contract.rollout.deploymentScopes.map(scope => [scope.scopeId, scope.targetWorker, scope.deploymentAuthorizedNow]), [
    ["private_dashboard_runtime", "prometheus-iq", false],
    ["public_website_crm_runtime", "prometheusrouteiq-website", false]
  ]);
  assert.equal(contract.rollout.rollback.historyRewriteAllowed, false);
  assert.equal(contract.rollout.rollback.archiveRewriteAllowed, false);
  assert.equal(contract.rollout.rollback.preserveExistingEvidence, true);
  assert.equal(contract.rollout.rollback.sourceProcedure, "create_new_git_revert_commits_in_reverse_dependency_order_and_repeat_exact_tree_verification");
  assert.ok(contract.rollout.rollback.evidenceSurfaces.includes("workers/infrastructure/route-iq-request-crm-runtime-v1.json"));
  assert.equal(contract.safetyState.deploymentAuthorizedByBatch, false);
});

test("capacity and rollback gates point only to committed evidence surfaces", () => {
  const { contract } = loadRouteIqCommercialProductArtifacts();
  const byGate = new Map(contract.acceptanceGates.map(gate => [gate.gate, gate]));
  assert.ok(byGate.get(7).evidenceSurfaces.includes("workers/infrastructure/route-iq-commercial-capacity-harness.mjs"));
  assert.ok(byGate.get(8).evidenceSurfaces.includes("workers/infrastructure/route-iq-request-crm-runtime-v1.json"));
  assert.ok(byGate.get(15).evidenceSurfaces.includes("docs/route-iq-forward-compatible-rollback-v1.md"));
  assert.equal(byGate.get(7).evidenceSurfaces.includes("tests/route-iq-commercial-readiness-capacity.test.mjs"), false);
  assert.equal(byGate.get(8).evidenceSurfaces.includes("workers/infrastructure/route-iq-commercial-readiness-capacity-v1.json"), false);
  assert.equal(byGate.get(15).evidenceSurfaces.includes("workers/infrastructure/route-iq-commercial-readiness-rollback-v1.json"), false);
});
