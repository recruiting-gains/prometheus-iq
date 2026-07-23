import assert from "node:assert/strict";
import test from "node:test";

import {
  RouteIqWorkspaceConfigurationError,
  authorizeConfiguredUser,
  loadRouteIqWorkspaceConfigurationRegistry,
  resolveAdmittedWorkspaceConfiguration,
  validateRouteIqWorkspaceConfigurationRegistry
} from "../administration/contracts/route-iq-workspace-configuration-v2.mjs";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function expectCode(expectedCode, action) {
  assert.throws(action, error => {
    assert.ok(error instanceof RouteIqWorkspaceConfigurationError);
    assert.equal(error.code, expectedCode);
    return true;
  });
}

const canonical = loadRouteIqWorkspaceConfigurationRegistry();

test("canonical v2 registry validates two isolated configurable industries", () => {
  assert.equal(canonical.schemaVersion, "route-iq-workspace-configuration-v2");
  assert.equal(canonical.workspaces.length, 2);
  assert.deepEqual(
    canonical.workspaces.map(workspace => workspace.operatingProfile.profileId).sort(),
    ["fitness", "general_outside_sales"]
  );
  assert.equal(canonical.safety.collection, "OFF");
  assert.equal(canonical.safety.activeCohorts, 0);
  assert.equal(canonical.safety.recommendationInfluence, "OFF");
  assert.equal(canonical.founderBoundary.attendanceMode, "CRUZ_ONLY_ATTENDED");
  assert.equal(canonical.founderBoundary.anthonyMappingStatus, "UNMAPPED");
  assert.equal(canonical.founderBoundary.externalTesterAccessAuthorized, false);
  assert.ok(Object.isFrozen(canonical));
});

test("configuration-only profiles use the same generic field vocabulary", () => {
  const fitness = canonical.workspaces.find(workspace => workspace.operatingProfile.profileId === "fitness");
  const outsideSales = canonical.workspaces.find(
    workspace => workspace.operatingProfile.profileId === "general_outside_sales"
  );
  const fitnessFields = new Set(fitness.dashboard.cardFields.map(field => field.fieldId));
  const outsideSalesFields = new Set(outsideSales.dashboard.cardFields.map(field => field.fieldId));

  for (const field of [
    "business_name",
    "operating_hours",
    "availability_status",
    "estimated_visit_duration"
  ]) {
    assert.equal(fitnessFields.has(field), true);
    assert.equal(outsideSalesFields.has(field), true);
  }
  assert.equal(fitnessFields.has("unit_potential"), true);
  assert.equal(fitnessFields.has("decision_maker_role"), false);
  assert.equal(outsideSalesFields.has("unit_potential"), false);
  assert.equal(outsideSalesFields.has("decision_maker_role"), true);
});

test("unknown workspace fails closed", () => {
  expectCode("route_iq_admin_configuration_workspace_unknown", () =>
    resolveAdmittedWorkspaceConfiguration("unknown_workspace", {
      registry: canonical,
      allowFounderResearch: true
    })
  );
});

test("Founder research and synthetic workspaces are not production admitted", () => {
  expectCode("route_iq_admin_configuration_workspace_not_production_admitted", () =>
    resolveAdmittedWorkspaceConfiguration("fitness_connection_founder_research", {
      registry: canonical
    })
  );
  expectCode("route_iq_admin_configuration_workspace_synthetic", () =>
    resolveAdmittedWorkspaceConfiguration("northstar_field_supply_synthetic", {
      registry: canonical
    })
  );
});

test("unknown configuration fields fail closed", () => {
  const fixture = clone(canonical);
  fixture.workspaces[0].unexpectedCustomerField = true;
  expectCode("route_iq_admin_configuration_fields_invalid", () =>
    validateRouteIqWorkspaceConfigurationRegistry(fixture)
  );
});

test("pending or mismatched admission cannot activate a workspace", () => {
  const fixture = clone(canonical);
  fixture.workspaces[0].lifecycle = "active_customer";
  expectCode("route_iq_admin_configuration_admission_mismatch", () =>
    validateRouteIqWorkspaceConfigurationRegistry(fixture)
  );
});

test("cross-company role substitution fails closed", () => {
  const fixture = clone(canonical);
  fixture.workspaces[0].users[0].roleId = fixture.workspaces[1].roles[0].roleId;
  expectCode("route_iq_admin_configuration_cross_company_role", () =>
    validateRouteIqWorkspaceConfigurationRegistry(fixture)
  );
});

test("mismatched source operating profile fails closed", () => {
  const fixture = clone(canonical);
  fixture.workspaces[0].opportunitySources[0].profileId = "general_outside_sales";
  expectCode("route_iq_admin_configuration_profile_mismatch", () =>
    validateRouteIqWorkspaceConfigurationRegistry(fixture)
  );
});

test("unsupported reusable card field fails closed", () => {
  const fixture = clone(canonical);
  fixture.workspaces[1].dashboard.cardFields.push({
    fieldId: "customer_specific_magic_score",
    label: "Customer-specific magic score",
    required: false
  });
  expectCode("route_iq_admin_configuration_card_field_unsupported", () =>
    validateRouteIqWorkspaceConfigurationRegistry(fixture)
  );
});

test("duplicate user and representative identities fail closed across companies", () => {
  const duplicateUser = clone(canonical);
  duplicateUser.workspaces[1].users[0].userId = duplicateUser.workspaces[0].users[0].userId;
  expectCode("route_iq_admin_configuration_duplicate_identity", () =>
    validateRouteIqWorkspaceConfigurationRegistry(duplicateUser)
  );

  const duplicateRepresentative = clone(canonical);
  duplicateRepresentative.workspaces[1].users[0].representativeId =
    duplicateRepresentative.workspaces[0].users[0].representativeId;
  expectCode("route_iq_admin_configuration_duplicate_identity", () =>
    validateRouteIqWorkspaceConfigurationRegistry(duplicateRepresentative)
  );

  const duplicateRole = clone(canonical);
  duplicateRole.workspaces[1].roles.push(clone(duplicateRole.workspaces[1].roles[0]));
  expectCode("route_iq_admin_configuration_duplicate_identity", () =>
    validateRouteIqWorkspaceConfigurationRegistry(duplicateRole)
  );
});

test("cross-workspace territory references fail closed", () => {
  const fixture = clone(canonical);
  fixture.workspaces[1].users[0].territoryIds = [
    fixture.workspaces[0].territories[0].territoryId
  ];
  expectCode("route_iq_admin_configuration_territory_mismatch", () =>
    validateRouteIqWorkspaceConfigurationRegistry(fixture)
  );
});

test("demo and fallback opportunity paths are prohibited", () => {
  const demoFixture = clone(canonical);
  demoFixture.workspaces[1].opportunitySources[0].artifactPath = "data/demo/businesses.json";
  expectCode("route_iq_admin_configuration_demo_fallback_forbidden", () =>
    validateRouteIqWorkspaceConfigurationRegistry(demoFixture)
  );

  const fallbackFixture = clone(canonical);
  fallbackFixture.workspaces[1].opportunitySources[0].adapterId = "fallback";
  expectCode("route_iq_admin_configuration_demo_fallback_forbidden", () =>
    validateRouteIqWorkspaceConfigurationRegistry(fallbackFixture)
  );
});

test("availability freshness cannot exceed 24 hours", () => {
  const fixture = clone(canonical);
  fixture.workspaces[0].availabilityPolicy.freshnessCeilingHours = 25;
  expectCode("route_iq_admin_configuration_availability_invalid", () =>
    validateRouteIqWorkspaceConfigurationRegistry(fixture)
  );
});

test("more than two companies or forty named users is rejected", () => {
  const companyFixture = clone(canonical);
  companyFixture.workspaces.push(clone(companyFixture.workspaces[1]));
  expectCode("route_iq_admin_configuration_array_invalid", () =>
    validateRouteIqWorkspaceConfigurationRegistry(companyFixture)
  );

  const userFixture = clone(canonical);
  const template = userFixture.workspaces[1].users[0];
  userFixture.workspaces[1].users = Array.from({ length: 40 }, (_, index) => ({
    ...template,
    userId: `northstar_synthetic_user_${String(index + 1).padStart(2, "0")}`,
    representativeId: `northstar_synthetic_rep_${String(index + 1).padStart(2, "0")}`
  }));
  expectCode("route_iq_admin_configuration_user_limit_exceeded", () =>
    validateRouteIqWorkspaceConfigurationRegistry(userFixture)
  );
});

test("user authorization is bound to workspace, profile, role, and territory", () => {
  const authorized = authorizeConfiguredUser({
    workspaceId: "fitness_connection_founder_research",
    operatingProfileId: "fitness",
    userId: "user_cruz_founder",
    roleId: "fitness_founder_research_operator",
    territoryId: "houston_founder_research_territory"
  }, { registry: canonical });
  assert.equal(authorized.authorized, true);
  assert.equal(authorized.recommendationInfluence, "OFF");

  expectCode("route_iq_admin_configuration_profile_mismatch", () =>
    authorizeConfiguredUser({
      workspaceId: "fitness_connection_founder_research",
      operatingProfileId: "general_outside_sales",
      userId: "user_cruz_founder",
      roleId: "fitness_founder_research_operator",
      territoryId: "houston_founder_research_territory"
    }, { registry: canonical })
  );
  expectCode("route_iq_admin_configuration_cross_company_role", () =>
    authorizeConfiguredUser({
      workspaceId: "fitness_connection_founder_research",
      operatingProfileId: "fitness",
      userId: "user_cruz_founder",
      roleId: "northstar_synthetic_representative",
      territoryId: "houston_founder_research_territory"
    }, { registry: canonical })
  );
  expectCode("route_iq_admin_configuration_territory_mismatch", () =>
    authorizeConfiguredUser({
      workspaceId: "fitness_connection_founder_research",
      operatingProfileId: "fitness",
      userId: "user_cruz_founder",
      roleId: "fitness_founder_research_operator",
      territoryId: "northstar_central_synthetic"
    }, { registry: canonical })
  );
});

test("Anthony remains unmapped and absent from admitted v2 users", () => {
  const users = canonical.workspaces.flatMap(workspace => workspace.users);
  assert.equal(canonical.founderBoundary.anthonyMappingStatus, "UNMAPPED");
  assert.equal(users.some(user => user.displayName.toLowerCase() === "anthony"), false);
  assert.equal(users.filter(user => user.identityClass === "FOUNDER_ATTENDED").length, 1);
});
