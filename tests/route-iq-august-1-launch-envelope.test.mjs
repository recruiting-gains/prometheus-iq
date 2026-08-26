import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  createCommercialIsolationFixtureRegistry,
  validateCommercialWorkspaceRegistry
} from "../data/route-iq-commercial-readiness-v1/route-iq-commercial-workspace-registry.mjs";
import {
  assertRouteIqAugust1LaunchResourceAccess,
  authorizeRouteIqAugust1LaunchPrincipal,
  routeIqAugust1FounderAccessContractVersion,
  routeIqAugust1FounderAccessMode,
  routeIqAugust1FounderAccessRole,
  routeIqAugust1LaunchEnvelopeVersion,
  routeIqAugust1PrincipalRoleByRoleId,
  validateRouteIqAugust1LaunchEnvelope
} from "../data/route-iq-commercial-readiness-v1/route-iq-august-1-launch-envelope.mjs";

const now = new Date("2026-08-01T14:00:00.000Z");
const runtimeAssets = Object.freeze({
  fullPool: "/data/qualified-prospects/google-qualified-businesses-v2/runtime-pools.json",
  activePool: "/data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/active-pool.json",
  quarantinePool: "/data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/quarantine-pool.json",
  businessHours: "/data/qualified-prospects/google-qualified-businesses-v2/business-hours-v1/business-hours.json"
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function activeCustomerRegistry({ workspaceCount = 2, usersPerWorkspace = 20 } = {}) {
  const registry = clone(createCommercialIsolationFixtureRegistry({ workspaceCount, usersPerWorkspace }));
  registry.workspaces.forEach(workspace => {
    workspace.workspaceState = "active_customer";
    workspace.normalOperationVisible = true;
    workspace.productionActivationAuthorized = true;
    workspace.business.relationshipClassification = "CUSTOMER_PRODUCTION";
    workspace.evidenceGovernance.classification = "CUSTOMER_GOVERNED_EVIDENCE";
    workspace.roles = [
      { roleId: "customer_owner", operationalAccess: true, founderIntelligenceAccess: false, workspaceAdministration: true },
      { roleId: "customer_manager", operationalAccess: true, founderIntelligenceAccess: false, workspaceAdministration: false },
      { roleId: "customer_representative", operationalAccess: true, founderIntelligenceAccess: false, workspaceAdministration: false }
    ];
    workspace.users.forEach((user, index) => {
      user.roleId = index === 0 ? "customer_owner" : index === 1 ? "customer_manager" : "customer_representative";
      user.founderIntelligenceEligibility = false;
    });
  });
  return validateCommercialWorkspaceRegistry(registry, { requireCanonicalProof: false });
}

function envelope(registry) {
  return {
    version: routeIqAugust1LaunchEnvelopeVersion,
    state: "ACTIVE",
    classification: "PRODUCTION_ACTIVATION",
    issuedAt: "2026-08-01T13:55:00.000Z",
    expiresAt: "2026-08-08T13:55:00.000Z",
    limits: { maximumCompanies: 2, maximumNamedUsers: 40 },
    safety: {
      prelaunchHumanAcceptanceTester: "cruz",
      externalHumanTesting: false,
      anthonyMapped: false,
      prospectiveCollection: "OFF",
      activeCohorts: 0,
      recommendationInfluence: "OFF"
    },
    workspaceAdmissions: registry.workspaces.map(workspace => ({
      workspaceId: workspace.workspaceId,
      operatingProfileId: workspace.operatingProfileId,
      authorizedUserIds: workspace.users.map(user => user.userId),
      runtimeAssets
    }))
  };
}

function founderMultiCompanyFixture() {
  const customerRegistry = activeCustomerRegistry({ workspaceCount: 2, usersPerWorkspace: 2 });
  const registry = clone(customerRegistry);
  const founderPrincipal = `riq_principal_${"f".repeat(64)}`;
  registry.workspaces[0].users.push({
    userId: "founder_cruz_multi_company",
    representativeId: "cruz",
    displayName: "Founder fixture",
    roleId: "founder_identity_anchor",
    authenticatedPrincipalId: founderPrincipal,
    identityMappingStatus: "exact_authenticated_identity_mapped",
    analysisPseudonym: "riq_rep_founder_fixture",
    active: true,
    founderIntelligenceEligibility: true
  });
  const launchEnvelope = envelope(customerRegistry);
  launchEnvelope.founderAccess = {
    contractVersion: routeIqAugust1FounderAccessContractVersion,
    identityAuthority: "commercial_workspace_registry_exact_principal",
    roleId: routeIqAugust1FounderAccessRole,
    accessMode: routeIqAugust1FounderAccessMode,
    authenticatedPrincipalId: founderPrincipal,
    authorizedWorkspaceIds: registry.workspaces.map(workspace => workspace.workspaceId)
  };
  return { founderPrincipal, launchEnvelope, registry };
}

test("checked-in August 1 launch envelope is default OFF and admits nobody", () => {
  const registryPath = resolve(
    import.meta.dirname,
    "../data/route-iq-commercial-readiness-v1/route-iq-commercial-workspace-registry-v1.json"
  );
  const registryBefore = readFileSync(registryPath);
  const canonicalRegistry = JSON.parse(registryBefore.toString("utf8"));
  const fitnessBefore = JSON.stringify(canonicalRegistry.workspaces.find(
    workspace => workspace.workspaceId === "fitness_connection"
  ));
  const checkedIn = JSON.parse(readFileSync(resolve(
    import.meta.dirname,
    "../data/route-iq-commercial-readiness-v1/route-iq-august-1-launch-envelope-v1.json"
  ), "utf8"));
  const result = validateRouteIqAugust1LaunchEnvelope(checkedIn, { workspaces: [] }, { now });
  assert.equal(result.state, "OFF");
  assert.equal(result.workspaceAdmissions.length, 0);
  assert.equal(result.safety.prospectiveCollection, "OFF");
  assert.equal(result.safety.activeCohorts, 0);
  assert.equal(result.safety.recommendationInfluence, "OFF");
  assert.equal(result.safety.anthonyMapped, false);
  validateCommercialWorkspaceRegistry(canonicalRegistry);
  assert.deepEqual(readFileSync(registryPath), registryBefore);
  assert.equal(JSON.stringify(canonicalRegistry.workspaces.find(
    workspace => workspace.workspaceId === "fitness_connection"
  )), fitnessBefore);
});

test("two companies and forty named users are admitted exactly at the bounded ceiling", () => {
  const registry = activeCustomerRegistry({ workspaceCount: 2, usersPerWorkspace: 20 });
  const input = envelope(registry);
  const before = JSON.stringify(input);
  const first = validateRouteIqAugust1LaunchEnvelope(input, registry, { now });
  const second = validateRouteIqAugust1LaunchEnvelope(input, registry, { now });
  assert.deepEqual(first.verifiedCapacity, { companies: 2, namedUsers: 40 });
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(input), before);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.workspaceAdmissions[0].runtimeAssets), true);
});

test("three companies and forty-one named users fail closed", () => {
  const three = activeCustomerRegistry({ workspaceCount: 3, usersPerWorkspace: 1 });
  assert.throws(
    () => validateRouteIqAugust1LaunchEnvelope(envelope(three), three, { now }),
    error => error.code === "route_iq_launch_company_limit_exceeded"
  );

  const fortyOne = activeCustomerRegistry({ workspaceCount: 2, usersPerWorkspace: 21 });
  assert.throws(
    () => validateRouteIqAugust1LaunchEnvelope(envelope(fortyOne), fortyOne, { now }),
    error => error.code === "route_iq_launch_user_limit_exceeded"
  );
});

test("unmapped, duplicate, Anthony, stale, and noncustomer admissions fail closed", () => {
  const registry = activeCustomerRegistry();
  const base = envelope(registry);

  const unmappedRegistry = clone(registry);
  unmappedRegistry.workspaces[0].users[0].identityMappingStatus = "pending_exact_authenticated_identity";
  unmappedRegistry.workspaces[0].users[0].authenticatedPrincipalId = null;
  assert.throws(
    () => validateRouteIqAugust1LaunchEnvelope(base, unmappedRegistry, { now }),
    error => error.code === "route_iq_launch_user_not_authorized"
  );

  const duplicate = clone(base);
  duplicate.workspaceAdmissions[0].authorizedUserIds[1] = duplicate.workspaceAdmissions[0].authorizedUserIds[0];
  assert.throws(
    () => validateRouteIqAugust1LaunchEnvelope(duplicate, registry, { now }),
    error => error.code === "route_iq_launch_user_duplicate"
  );

  const anthonyRegistry = clone(registry);
  anthonyRegistry.workspaces[0].users[0].representativeId = "anthony";
  assert.throws(
    () => validateRouteIqAugust1LaunchEnvelope(base, anthonyRegistry, { now }),
    error => error.code === "route_iq_launch_user_not_authorized"
  );

  assert.throws(
    () => validateRouteIqAugust1LaunchEnvelope(base, registry, { now: new Date("2026-09-01T00:00:00.000Z") }),
    error => error.code === "route_iq_launch_window_invalid"
  );

  const noncustomer = clone(registry);
  noncustomer.workspaces[0].productionActivationAuthorized = false;
  assert.throws(
    () => validateRouteIqAugust1LaunchEnvelope(base, noncustomer, { now }),
    error => error.code === "route_iq_launch_workspace_not_authorized"
  );

  const crossProfile = clone(base);
  crossProfile.workspaceAdmissions[0].operatingProfileId = registry.workspaces[0].operatingProfileId === "fitness"
    ? "roofing"
    : "fitness";
  assert.throws(
    () => validateRouteIqAugust1LaunchEnvelope(crossProfile, registry, { now }),
    error => error.code === "route_iq_launch_workspace_not_authorized"
  );

  const unsafeRole = clone(registry);
  unsafeRole.workspaces[0].roles.find(role => role.roleId === "customer_representative").founderIntelligenceAccess = true;
  assert.throws(
    () => validateCommercialWorkspaceRegistry(unsafeRole, { requireCanonicalProof: false }),
    error => error.code === "route_iq_commercial_workspace_customer_activation_invalid"
  );

  const unsafeSafety = clone(base);
  unsafeSafety.safety.anthonyMapped = true;
  assert.throws(
    () => validateRouteIqAugust1LaunchEnvelope(unsafeSafety, registry, { now }),
    error => error.code === "route_iq_launch_safety_invalid"
  );

  const nonlocalAsset = clone(base);
  nonlocalAsset.workspaceAdmissions[0].runtimeAssets.fullPool = "https://example.com/runtime.json";
  assert.throws(
    () => validateRouteIqAugust1LaunchEnvelope(nonlocalAsset, registry, { now }),
    error => error.code === "route_iq_launch_asset_path_invalid"
  );
});

test("principal authorization and role boundaries isolate workspace and representative records", () => {
  const registry = activeCustomerRegistry();
  const active = envelope(registry);
  const representative = registry.workspaces[0].users[2];
  const principal = authorizeRouteIqAugust1LaunchPrincipal({
    envelope: active,
    registry,
    authenticatedPrincipalId: representative.authenticatedPrincipalId,
    now
  });
  assert.equal(principal.workspaceId, registry.workspaces[0].workspaceId);
  assert.equal(principal.representativeId, representative.representativeId);
  assert.equal(principal.principalRole, "representative");
  assert.equal(principal.capabilities.founderIntelligence, false);
  assert.equal(principal.capabilities.founderCrm, false);
  assert.equal(assertRouteIqAugust1LaunchResourceAccess(principal, {
    workspaceId: principal.workspaceId,
    representativeId: principal.representativeId,
    operation: "write_route"
  }), true);
  assert.throws(
    () => assertRouteIqAugust1LaunchResourceAccess(principal, {
      workspaceId: registry.workspaces[1].workspaceId,
      representativeId: principal.representativeId,
      operation: "read_route"
    }),
    error => error.code === "route_iq_launch_cross_workspace_denied"
  );
  assert.throws(
    () => assertRouteIqAugust1LaunchResourceAccess(principal, {
      workspaceId: principal.workspaceId,
      representativeId: registry.workspaces[0].users[3].representativeId,
      operation: "write_route"
    }),
    error => error.code === "route_iq_launch_cross_user_write_denied"
  );
});

test("launch roles map to one authoritative customer-PWA semantic role", () => {
  const registry = activeCustomerRegistry({ workspaceCount: 1, usersPerWorkspace: 3 });
  const active = envelope(registry);
  const expected = [
    ["customer_owner", "customer_owner"],
    ["customer_manager", "manager"],
    ["customer_representative", "representative"]
  ];
  for (const [roleId, principalRole] of expected) {
    const user = registry.workspaces[0].users.find(candidate => candidate.roleId === roleId);
    const principal = authorizeRouteIqAugust1LaunchPrincipal({
      envelope: active,
      registry,
      authenticatedPrincipalId: user.authenticatedPrincipalId,
      now
    });
    assert.equal(principal.roleId, roleId);
    assert.equal(principal.principalRole, principalRole);
  }
  assert.deepEqual(routeIqAugust1PrincipalRoleByRoleId, {
    founder_multi_company_read_only: "founder",
    customer_owner: "customer_owner",
    customer_manager: "manager",
    customer_representative: "representative"
  });
});

test("exact Founder principal selects one server-admitted workspace without merging company data", () => {
  const fixture = founderMultiCompanyFixture();
  const validated = validateRouteIqAugust1LaunchEnvelope(
    fixture.launchEnvelope,
    fixture.registry,
    { now }
  );
  assert.deepEqual(validated.verifiedCapacity, { companies: 2, namedUsers: 5 });
  assert.deepEqual(
    validated.founderAccess.authorizedWorkspaceIds,
    fixture.registry.workspaces.map(workspace => workspace.workspaceId)
  );

  assert.throws(
    () => authorizeRouteIqAugust1LaunchPrincipal({
      envelope: fixture.launchEnvelope,
      registry: fixture.registry,
      authenticatedPrincipalId: fixture.founderPrincipal,
      now
    }),
    error => error.code === "route_iq_launch_workspace_selection_required"
  );

  const firstWorkspaceId = fixture.registry.workspaces[0].workspaceId;
  const secondWorkspaceId = fixture.registry.workspaces[1].workspaceId;
  const first = authorizeRouteIqAugust1LaunchPrincipal({
    envelope: fixture.launchEnvelope,
    registry: fixture.registry,
    authenticatedPrincipalId: fixture.founderPrincipal,
    requestedWorkspaceId: firstWorkspaceId,
    now
  });
  const second = authorizeRouteIqAugust1LaunchPrincipal({
    envelope: fixture.launchEnvelope,
    registry: fixture.registry,
    authenticatedPrincipalId: fixture.founderPrincipal,
    requestedWorkspaceId: secondWorkspaceId,
    now
  });
  assert.equal(first.accessMode, "founder_explicit_workspace_read_only");
  assert.equal(first.roleId, routeIqAugust1FounderAccessRole);
  assert.equal(first.principalRole, "founder");
  assert.equal(first.workspaceId, firstWorkspaceId);
  assert.equal(second.workspaceId, secondWorkspaceId);
  assert.equal(Object.hasOwn(first, "authorizedWorkspaceIds"), false);
  assert.equal(Object.hasOwn(first, "workspaces"), false);
  assert.equal(first.capabilities.operateOwnRoute, false);
  assert.equal(first.capabilities.readWorkspaceOperations, true);
  assert.equal(first.capabilities.founderIntelligence, true);

  assert.equal(assertRouteIqAugust1LaunchResourceAccess(first, {
    workspaceId: firstWorkspaceId,
    representativeId: fixture.registry.workspaces[0].users[0].representativeId,
    operation: "read_route"
  }), true);
  assert.throws(
    () => assertRouteIqAugust1LaunchResourceAccess(first, {
      workspaceId: secondWorkspaceId,
      representativeId: fixture.registry.workspaces[1].users[0].representativeId,
      operation: "read_route"
    }),
    error => error.code === "route_iq_launch_cross_workspace_denied"
  );
  assert.throws(
    () => assertRouteIqAugust1LaunchResourceAccess(first, {
      workspaceId: firstWorkspaceId,
      representativeId: "cruz",
      operation: "write_route"
    }),
    error => error.code === "route_iq_launch_founder_write_denied"
  );
});

test("Founder allowlist rejects display-name auth, Anthony, conflation, drift, and caller workspace bypass", () => {
  const fixture = founderMultiCompanyFixture();
  assert.throws(
    () => authorizeRouteIqAugust1LaunchPrincipal({
      envelope: fixture.launchEnvelope,
      registry: fixture.registry,
      displayName: "Founder fixture",
      requestedWorkspaceId: fixture.registry.workspaces[0].workspaceId,
      now
    }),
    error => error.code === "route_iq_launch_authentication_required"
  );
  assert.throws(
    () => authorizeRouteIqAugust1LaunchPrincipal({
      envelope: fixture.launchEnvelope,
      registry: fixture.registry,
      authenticatedPrincipalId: fixture.founderPrincipal,
      requestedWorkspaceId: "caller_selected_workspace",
      now
    }),
    error => error.code === "route_iq_launch_workspace_selection_unauthorized"
  );

  const anthony = clone(fixture.registry);
  anthony.workspaces[0].users.at(-1).representativeId = "anthony";
  assert.throws(
    () => validateRouteIqAugust1LaunchEnvelope(fixture.launchEnvelope, anthony, { now }),
    error => error.code === "route_iq_launch_founder_identity_invalid"
  );

  const duplicateAnchor = clone(fixture.registry);
  duplicateAnchor.workspaces[1].users.push(clone(duplicateAnchor.workspaces[0].users.at(-1)));
  duplicateAnchor.workspaces[1].users.at(-1).userId = "duplicate_founder_anchor";
  assert.throws(
    () => validateRouteIqAugust1LaunchEnvelope(fixture.launchEnvelope, duplicateAnchor, { now }),
    error => error.code === "route_iq_launch_founder_identity_invalid"
  );

  const conflated = clone(fixture.registry);
  conflated.workspaces[1].users[0].authenticatedPrincipalId = fixture.founderPrincipal;
  assert.throws(
    () => validateRouteIqAugust1LaunchEnvelope(fixture.launchEnvelope, conflated, { now }),
    error => error.code === "route_iq_launch_founder_principal_conflated"
  );

  const duplicateCustomerPrincipal = clone(fixture.registry);
  duplicateCustomerPrincipal.workspaces[1].users[0].authenticatedPrincipalId =
    duplicateCustomerPrincipal.workspaces[0].users[0].authenticatedPrincipalId;
  assert.throws(
    () => validateRouteIqAugust1LaunchEnvelope(
      fixture.launchEnvelope,
      duplicateCustomerPrincipal,
      { now }
    ),
    error => error.code === "route_iq_launch_principal_duplicate"
  );

  const unadmitted = clone(fixture.launchEnvelope);
  unadmitted.founderAccess.authorizedWorkspaceIds.push("not_admitted_workspace");
  assert.throws(
    () => validateRouteIqAugust1LaunchEnvelope(unadmitted, fixture.registry, { now }),
    error => error.code === "route_iq_launch_founder_access_invalid"
  );

  const wrongRole = clone(fixture.launchEnvelope);
  wrongRole.founderAccess.roleId = "customer_owner";
  assert.throws(
    () => validateRouteIqAugust1LaunchEnvelope(wrongRole, fixture.registry, { now }),
    error => error.code === "route_iq_launch_founder_access_invalid"
  );
});
