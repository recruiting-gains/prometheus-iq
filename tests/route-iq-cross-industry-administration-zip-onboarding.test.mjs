import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  ROUTE_IQ_FITNESS_WORKSPACE_ID,
  ROUTE_IQ_SYNTHETIC_OUTSIDE_SALES_WORKSPACE_ID,
  ROUTE_IQ_TERRITORY_ZIP_COVERAGE_VERSION,
  RouteIqWorkspaceConfigurationError,
  authorizeConfiguredUserForZipCoverage,
  authorizeFounderWorkspaceAccess,
  loadRouteIqWorkspaceConfigurationRegistry,
  resolveTerritoryZipCoverage,
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
const rehearsal = JSON.parse(readFileSync(
  "administration/workspace-configurations/route-iq-72-hour-onboarding-rehearsal-v1.json",
  "utf8"
));

test("canonical territories expose versioned, owner-bound US ZIP coverage", () => {
  for (const workspace of canonical.workspaces) {
    for (const territory of workspace.territories) {
      assert.equal(territory.zipCoverage.coverageVersion, ROUTE_IQ_TERRITORY_ZIP_COVERAGE_VERSION);
      assert.equal(territory.zipCoverage.workspaceId, workspace.workspaceId);
      assert.equal(territory.zipCoverage.companyId, workspace.companyId);
      assert.equal(territory.zipCoverage.territoryId, territory.territoryId);
      assert.ok(territory.zipCoverage.postalCodes.length >= 1);
      territory.zipCoverage.postalCodes.forEach(postalCode =>
        assert.match(postalCode, /^[0-9]{5}$/u)
      );
    }
  }
});

test("ZIP coverage rejects missing, malformed, duplicate, and cross-owner configuration", () => {
  const missing = clone(canonical);
  delete missing.workspaces[0].territories[0].zipCoverage;
  expectCode("route_iq_admin_configuration_fields_invalid", () =>
    validateRouteIqWorkspaceConfigurationRegistry(missing)
  );

  for (const postalCode of ["7700", "770001", "77A01", " 77001", "77001-1234"]) {
    const malformed = clone(canonical);
    malformed.workspaces[0].territories[0].zipCoverage.postalCodes = [postalCode];
    expectCode("route_iq_admin_configuration_zip_invalid", () =>
      validateRouteIqWorkspaceConfigurationRegistry(malformed)
    );
  }

  const duplicate = clone(canonical);
  duplicate.workspaces[0].territories[0].zipCoverage.postalCodes = ["77001", "77001"];
  expectCode("route_iq_admin_configuration_duplicate_identity", () =>
    validateRouteIqWorkspaceConfigurationRegistry(duplicate)
  );

  for (const ownershipField of ["workspaceId", "companyId", "territoryId"]) {
    const crossOwner = clone(canonical);
    crossOwner.workspaces[0].territories[0].zipCoverage[ownershipField] =
      crossOwner.workspaces[1].territories[0].zipCoverage[ownershipField];
    expectCode("route_iq_admin_configuration_zip_coverage_ownership_mismatch", () =>
      validateRouteIqWorkspaceConfigurationRegistry(crossOwner)
    );
  }
});

test("ZIP coverage can be added, removed, and reassigned through configuration only", () => {
  const fixture = clone(canonical);
  const workspace = fixture.workspaces[0];
  const primary = workspace.territories[0];

  primary.zipCoverage.postalCodes.push("77005");
  assert.doesNotThrow(() => validateRouteIqWorkspaceConfigurationRegistry(fixture));

  primary.zipCoverage.postalCodes = primary.zipCoverage.postalCodes.filter(
    postalCode => postalCode !== "77002"
  );
  assert.doesNotThrow(() => validateRouteIqWorkspaceConfigurationRegistry(fixture));

  primary.zipCoverage.postalCodes = primary.zipCoverage.postalCodes.filter(
    postalCode => postalCode !== "77005"
  );
  const reassignedTerritoryId = "houston_reassigned_research_territory";
  workspace.territories.push({
    territoryId: reassignedTerritoryId,
    displayName: "Houston Reassigned Research Territory",
    timezone: "America/Chicago",
    active: true,
    zipCoverage: {
      coverageVersion: ROUTE_IQ_TERRITORY_ZIP_COVERAGE_VERSION,
      workspaceId: workspace.workspaceId,
      companyId: workspace.companyId,
      territoryId: reassignedTerritoryId,
      postalCodes: ["77005"]
    }
  });
  workspace.locations[0].territoryIds.push(reassignedTerritoryId);
  workspace.users[0].territoryIds.push(reassignedTerritoryId);
  assert.doesNotThrow(() => validateRouteIqWorkspaceConfigurationRegistry(fixture));

  primary.zipCoverage.postalCodes = [];
  expectCode("route_iq_admin_configuration_array_invalid", () =>
    validateRouteIqWorkspaceConfigurationRegistry(fixture)
  );
});

test("duplicate ZIP assignment across territories in one workspace fails closed", () => {
  const fixture = clone(canonical);
  const workspace = fixture.workspaces[0];
  workspace.territories.push({
    territoryId: "houston_duplicate_zip_territory",
    displayName: "Houston Duplicate ZIP Territory",
    timezone: "America/Chicago",
    active: true,
    zipCoverage: {
      coverageVersion: ROUTE_IQ_TERRITORY_ZIP_COVERAGE_VERSION,
      workspaceId: workspace.workspaceId,
      companyId: workspace.companyId,
      territoryId: "houston_duplicate_zip_territory",
      postalCodes: ["77001"]
    }
  });
  expectCode("route_iq_admin_configuration_zip_coverage_duplicate", () =>
    validateRouteIqWorkspaceConfigurationRegistry(fixture)
  );
});

test("ZIP resolution and user authorization are workspace, company, role, and territory bound", () => {
  const input = {
    workspaceId: ROUTE_IQ_FITNESS_WORKSPACE_ID,
    companyId: "fitness_connection_research",
    territoryId: "houston_founder_research_territory",
    postalCode: "77001"
  };
  assert.equal(resolveTerritoryZipCoverage(input, { registry: canonical }).authorized, true);

  const authorized = authorizeConfiguredUserForZipCoverage({
    ...input,
    operatingProfileId: "fitness",
    userId: "user_cruz_founder",
    roleId: "fitness_founder_research_operator"
  }, { registry: canonical });
  assert.equal(authorized.authorized, true);
  assert.equal(authorized.recommendationInfluence, "OFF");

  expectCode("route_iq_admin_configuration_company_mismatch", () =>
    resolveTerritoryZipCoverage({
      ...input,
      companyId: "northstar_field_supply_company_synthetic"
    }, { registry: canonical })
  );
  expectCode("route_iq_admin_configuration_zip_coverage_unauthorized", () =>
    resolveTerritoryZipCoverage({
      ...input,
      postalCode: "77003"
    }, { registry: canonical })
  );
  expectCode("route_iq_admin_configuration_user_unauthorized", () =>
    authorizeConfiguredUserForZipCoverage({
      ...input,
      operatingProfileId: "fitness",
      userId: "northstar_synthetic_user_01",
      roleId: "northstar_synthetic_representative"
    }, { registry: canonical })
  );
});

test("Founder access is represented once by an exact mapped multi-workspace boundary", () => {
  assert.equal(canonical.founderBoundary.founderPrincipalMappingStatus, "EXACT_PRINCIPAL_MAPPED");
  assert.deepEqual(canonical.founderBoundary.authorizedWorkspaceIds, [
    ROUTE_IQ_FITNESS_WORKSPACE_ID,
    ROUTE_IQ_SYNTHETIC_OUTSIDE_SALES_WORKSPACE_ID
  ]);
  for (const workspaceId of canonical.founderBoundary.authorizedWorkspaceIds) {
    const authorization = authorizeFounderWorkspaceAccess({
      founderUserId: "user_cruz_founder",
      workspaceId
    }, { registry: canonical });
    assert.equal(authorization.authorized, true);
    assert.equal(authorization.workspaceId, workspaceId);
  }
  const ordinaryUsers = canonical.workspaces.flatMap(workspace => workspace.users);
  assert.equal(
    ordinaryUsers.filter(user => user.userId === "user_cruz_founder").length,
    1
  );
  assert.equal(canonical.founderBoundary.anthonyMappingStatus, "UNMAPPED");
});

test("Founder workspace lists reject duplicates, unknown workspaces, and ineligible companies", () => {
  const duplicate = clone(canonical);
  duplicate.founderBoundary.authorizedWorkspaceIds = [
    ROUTE_IQ_FITNESS_WORKSPACE_ID,
    ROUTE_IQ_FITNESS_WORKSPACE_ID
  ];
  expectCode("route_iq_admin_configuration_duplicate_identity", () =>
    validateRouteIqWorkspaceConfigurationRegistry(duplicate)
  );

  const unknown = clone(canonical);
  unknown.founderBoundary.authorizedWorkspaceIds[1] = "unknown_synthetic_workspace";
  expectCode("route_iq_admin_configuration_founder_workspace_unknown", () =>
    validateRouteIqWorkspaceConfigurationRegistry(unknown)
  );

  const ineligible = clone(canonical);
  ineligible.workspaces[1].lifecycle = "active_customer";
  ineligible.workspaces[1].admission = {
    status: "CUSTOMER_APPROVED",
    productionAuthorized: true,
    customerAuthorizationRef: "synthetic-test-only"
  };
  ineligible.workspaces[1].company.relationshipClassification = "CUSTOMER";
  ineligible.workspaces[1].company.publicRelationshipClaimsAllowed = true;
  ineligible.workspaces[1].users = [];
  ineligible.workspaces[1].opportunitySources[0].productionUseAuthorized = true;
  expectCode("route_iq_admin_configuration_founder_workspace_ineligible", () =>
    validateRouteIqWorkspaceConfigurationRegistry(ineligible)
  );
});

test("72-hour rehearsal configures a new synthetic company within the two-company cap", () => {
  assert.equal(rehearsal.classification, "SYNTHETIC_NONPRODUCTION_REHEARSAL");
  assert.equal(rehearsal.productionAuthorized, false);
  assert.equal(rehearsal.maximumElapsedHours, 72);
  assert.equal(
    rehearsal.canonicalReplacementWorkspaceId,
    ROUTE_IQ_SYNTHETIC_OUTSIDE_SALES_WORKSPACE_ID
  );

  const fixture = clone(canonical);
  fixture.registryVersion = "route-iq-cross-industry-workspaces-v2.2.1";
  fixture.provenance.configurationVersion = "v2.2.1";
  fixture.workspaces[1] = rehearsal.workspaceConfiguration;
  fixture.founderBoundary.authorizedWorkspaceIds = [
    ROUTE_IQ_FITNESS_WORKSPACE_ID,
    rehearsal.workspaceConfiguration.workspaceId
  ];
  const validated = validateRouteIqWorkspaceConfigurationRegistry(fixture);
  assert.equal(validated.workspaces.length, 2);
  assert.equal(validated.workspaces[1].admission.productionAuthorized, false);
  assert.equal(validated.workspaces[1].users.some(user => user.identityClass === "FOUNDER_ATTENDED"), false);
  assert.equal(
    authorizeFounderWorkspaceAccess({
      founderUserId: "user_cruz_founder",
      workspaceId: rehearsal.workspaceConfiguration.workspaceId
    }, { registry: validated }).authorized,
    true
  );
  assert.equal(
    authorizeConfiguredUserForZipCoverage({
      workspaceId: rehearsal.workspaceConfiguration.workspaceId,
      companyId: rehearsal.workspaceConfiguration.companyId,
      operatingProfileId: "general_outside_sales",
      userId: "summit_rehearsal_rep_01",
      roleId: "summit_rehearsal_representative",
      territoryId: "summit_dallas_rehearsal_territory",
      postalCode: "75201"
    }, { registry: validated }).authorized,
    true
  );
});

test("72-hour rehearsal contains the complete Administration onboarding decision set", () => {
  const { workspaceConfiguration: workspace, rehearsalPlan: plan } = rehearsal;
  assert.equal(workspace.dashboard.terminology.opportunity, "service account");
  assert.equal(workspace.roles.length, 2);
  assert.equal(workspace.users.length, 2);
  assert.equal(plan.founderAccess.duplicateFounderUserRecordAllowed, false);
  assert.equal(plan.representativeAccess.workspaceLocalUsersRequired, true);
  assert.equal(plan.territoryCoverage.addRemoveReassignSupported, true);
  assert.equal(plan.hoursPolicy.freshnessCeilingHours, 24);
  assert.equal(plan.hoursPolicy.staleOrMissingRouteEligible, false);
  assert.equal(plan.retention.maximumCalendarMonths, 18);
  assert.equal(plan.training.completionEvidenceRequired, true);
  assert.equal(plan.support.owner, "prometheus_administration");
  assert.equal(plan.incident.rollbackEscalationRequired, true);
  assert.deepEqual(plan.phases.map(phase => phase.elapsedHours), [24, 48, 72]);
  assert.ok(workspace.dashboard.cardFields.length >= 4);
  assert.ok(workspace.dashboard.actions.length >= 1);
  assert.ok(workspace.dashboard.outcomes.length >= 1);
  assert.ok(workspace.dashboard.kpis.length >= 1);
});
