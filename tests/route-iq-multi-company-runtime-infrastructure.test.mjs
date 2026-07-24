import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  authorizeRouteIqAugust1LaunchPrincipal,
  routeIqAugust1FounderAccessContractVersion,
  routeIqAugust1FounderAccessMode,
  routeIqAugust1FounderAccessRole,
  routeIqAugust1LaunchEnvelopeVersion,
  validateRouteIqAugust1LaunchEnvelope
} from "../data/route-iq-commercial-readiness-v1/route-iq-august-1-launch-envelope.mjs";
import {
  ROUTE_IQ_MULTI_COMPANY_FAILURES,
  assertRouteIqRuntimeZipAuthorization,
  projectRouteIqWorkspaceZipCoverage,
  requestedRouteIqWorkspaceId
} from "../workers/infrastructure/route-iq-multi-company-runtime-authorization.js";
import {
  ROUTE_IQ_ONBOARDING_RUNTIME_ASSET_KEYS,
  buildRouteIq72HourOnboardingRuntimeEvidence
} from "../workers/infrastructure/route-iq-72-hour-onboarding-runtime.js";
import {
  ROUTE_IQ_CUSTOMER_PWA_SESSION_RUNTIME_ASSET_KEYS,
  createRouteIqCustomerPwaSession
} from "../workers/infrastructure/route-iq-august-1-customer-pwa-runtime.js";

const canonicalAdministrationRegistry = JSON.parse(readFileSync(new URL(
  "../administration/workspace-configurations/route-iq-cross-industry-workspaces-v2.json",
  import.meta.url
), "utf8"));
const canonicalCommercialRegistry = JSON.parse(readFileSync(new URL(
  "../data/route-iq-commercial-readiness-v1/route-iq-commercial-workspace-registry-v1.json",
  import.meta.url
), "utf8"));
const integratedNow = new Date("2026-08-01T14:00:00.000Z");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function dataFounderFixture() {
  const commercialRegistry = clone(canonicalCommercialRegistry);
  const founder = commercialRegistry.workspaces[0].users.find(
    user => user.representativeId === "cruz"
  );
  const admissions = commercialRegistry.workspaces.map((workspace, index) => {
    workspace.workspaceState = "active_customer";
    workspace.normalOperationVisible = true;
    workspace.productionActivationAuthorized = true;
    workspace.business.relationshipClassification = "CUSTOMER_PRODUCTION";
    workspace.evidenceGovernance.classification = "CUSTOMER_GOVERNED_EVIDENCE";
    workspace.roles.push({
      roleId: "customer_representative",
      operationalAccess: true,
      founderIntelligenceAccess: false,
      workspaceAdministration: false
    });
    const representative = {
      ...clone(workspace.users.find(user => user.authenticatedPrincipalId) || workspace.users[0]),
      userId: `integration_representative_${index + 1}`,
      representativeId: `integration_representative_${index + 1}`,
      displayName: `Integration representative ${index + 1}`,
      roleId: "customer_representative",
      authenticatedPrincipalId: `riq_principal_${String(index + 1).repeat(64)}`,
      identityMappingStatus: "exact_authenticated_identity_mapped",
      analysisPseudonym: `riq_rep_integration_${index + 1}`,
      active: true,
      founderIntelligenceEligibility: false
    };
    workspace.users.push(representative);
    return {
      workspaceId: workspace.workspaceId,
      operatingProfileId: workspace.operatingProfileId,
      authorizedUserIds: [representative.userId],
      runtimeAssets: {
        fullPool: "/data/integration/full-pool.json",
        activePool: "/data/integration/active-pool.json",
        quarantinePool: "/data/integration/quarantine-pool.json",
        businessHours: "/data/integration/business-hours.json"
      }
    };
  });
  const envelope = {
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
    workspaceAdmissions: admissions,
    founderAccess: {
      contractVersion: routeIqAugust1FounderAccessContractVersion,
      identityAuthority: "commercial_workspace_registry_exact_principal",
      roleId: routeIqAugust1FounderAccessRole,
      accessMode: routeIqAugust1FounderAccessMode,
      authenticatedPrincipalId: founder.authenticatedPrincipalId,
      authorizedWorkspaceIds: canonicalAdministrationRegistry.workspaces.map(
        workspace => workspace.workspaceId
      )
    }
  };
  return { commercialRegistry, envelope, founder };
}

function registry() {
  return {
    schemaVersion: "route-iq-workspace-configuration-v2",
    authority: "prometheus_administration",
    safety: {
      collection: "OFF",
      activeCohorts: 0,
      recommendationInfluence: "OFF"
    },
    workspaces: [{
      workspaceId: "synthetic_service_company",
      companyId: "synthetic_service_company_owner",
      operatingProfile: { profileId: "general_outside_sales" },
      provenance: {
        owner: "prometheus_administration",
        configurationVersion: "v2.2.0"
      },
      territories: [{
        territoryId: "central_territory",
        active: true,
        zipCoverage: {
          coverageVersion: "territory-zip-coverage-v1.0.0",
          workspaceId: "synthetic_service_company",
          companyId: "synthetic_service_company_owner",
          territoryId: "central_territory",
          postalCodes: ["75001", "75002"]
        }
      }, {
        territoryId: "north_territory",
        active: true,
        zipCoverage: {
          coverageVersion: "territory-zip-coverage-v1.0.0",
          workspaceId: "synthetic_service_company",
          companyId: "synthetic_service_company_owner",
          territoryId: "north_territory",
          postalCodes: ["75003"]
        }
      }],
      users: [{
        userId: "user_founder",
        representativeId: "representative_founder",
        roleId: "customer_owner",
        territoryIds: ["central_territory", "north_territory"],
        active: true
      }, {
        userId: "user_representative",
        representativeId: "representative_one",
        roleId: "customer_representative",
        territoryIds: ["central_territory"],
        active: true
      }]
    }],
    founderBoundary: {
      founderUserId: "user_founder",
      founderPrincipalMappingStatus: "EXACT_PRINCIPAL_MAPPED",
      authorizedWorkspaceIds: ["synthetic_service_company"]
    }
  };
}

function principal(overrides = {}) {
  return {
    authorized: true,
    workspaceId: "synthetic_service_company",
    operatingProfileId: "general_outside_sales",
    userId: "user_representative",
    representativeId: "representative_one",
    roleId: "customer_representative",
    ...overrides
  };
}

test("workspace signal is one strict opaque ID and never an enumerated set", () => {
  assert.equal(
    requestedRouteIqWorkspaceId(new Request("https://route-iq.test/app")),
    undefined
  );
  assert.equal(
    requestedRouteIqWorkspaceId(
      new Request("https://route-iq.test/app?workspaceId=synthetic_service_company")
    ),
    "synthetic_service_company"
  );
  for (const url of [
    "https://route-iq.test/app?workspaceId=Fitness%20Connection",
    "https://route-iq.test/app?workspaceId=synthetic_service_company&workspaceId=other_company",
    "https://route-iq.test/app?workspaceId=",
    "https://route-iq.test/app?workspaceId=UPPERCASE"
  ]) {
    assert.throws(
      () => requestedRouteIqWorkspaceId(new Request(url)),
      error => error.code === ROUTE_IQ_MULTI_COMPANY_FAILURES.selectionInvalid
    );
  }
});

test("ZIP coverage is projected from the exact authorized workspace user", () => {
  const projection = projectRouteIqWorkspaceZipCoverage({
    principal: principal(),
    workspaceRegistry: registry()
  });
  assert.equal(projection.workspaceId, "synthetic_service_company");
  assert.equal(projection.companyId, "synthetic_service_company_owner");
  assert.deepEqual(projection.territoryIds, ["central_territory"]);
  assert.deepEqual(projection.postalCodes, ["75001", "75002"]);
  assert.equal(
    assertRouteIqRuntimeZipAuthorization(projection, {
      workspaceId: "synthetic_service_company",
      territoryId: "central_territory",
      zipCode: "75002"
    }),
    true
  );
  for (const input of [
    { workspaceId: "other_company", territoryId: "central_territory", zipCode: "75002" },
    { workspaceId: "synthetic_service_company", territoryId: "north_territory", zipCode: "75003" },
    { workspaceId: "synthetic_service_company", territoryId: "central_territory", zipCode: "99999" }
  ]) {
    assert.throws(
      () => assertRouteIqRuntimeZipAuthorization(projection, input),
      error => error.code === ROUTE_IQ_MULTI_COMPANY_FAILURES.zipUnauthorized
    );
  }
});

test("missing, malformed, duplicate, cross-workspace, and mismatched ZIP scope fail closed", () => {
  const cases = [
    value => { delete value.workspaces[0].territories[0].zipCoverage; },
    value => { value.workspaces[0].territories[0].zipCoverage.postalCodes = ["7500"]; },
    value => { value.workspaces[0].territories[0].zipCoverage.postalCodes = ["75001", "75001"]; },
    value => { value.workspaces[0].territories[1].zipCoverage.postalCodes = ["75001"]; },
    value => { value.workspaces[0].territories[0].zipCoverage.companyId = "cross_owner"; },
    value => { value.workspaces[0].users[1].territoryIds = ["unknown_territory"]; }
  ];
  for (const mutate of cases) {
    const value = registry();
    mutate(value);
    assert.throws(
      () => projectRouteIqWorkspaceZipCoverage({
        principal: principal(),
        workspaceRegistry: value
      }),
      error => error.code === ROUTE_IQ_MULTI_COMPANY_FAILURES.projectionInvalid
    );
  }
  assert.throws(
    () => projectRouteIqWorkspaceZipCoverage({
      principal: principal({ territoryIds: ["north_territory"] }),
      workspaceRegistry: registry()
    }),
    error => error.code === ROUTE_IQ_MULTI_COMPANY_FAILURES.projectionInvalid
  );
});

test("Founder projection is broad only when the exact workspace user assignment is broad", () => {
  const projection = projectRouteIqWorkspaceZipCoverage({
    principal: principal({
      userId: "user_founder",
      representativeId: "representative_founder",
      roleId: "customer_owner"
    }),
    workspaceRegistry: registry()
  });
  assert.deepEqual(projection.territoryIds, ["central_territory", "north_territory"]);
  assert.deepEqual(projection.postalCodes, ["75001", "75002", "75003"]);
});

test("canonical Administration ZIP coverage integrates with Data-authorized Founder selection and exact four-asset sessions", () => {
  const { commercialRegistry, envelope, founder } = dataFounderFixture();
  const launch = validateRouteIqAugust1LaunchEnvelope(
    envelope,
    commercialRegistry,
    { now: integratedNow }
  );
  const runtimeAssets = {
    workspaceConfiguration: "/administration/workspace-configurations/route-iq-cross-industry-workspaces-v2.json",
    businessManifestRegistry: "/data/route-iq-commercial-readiness-v1/route-iq-workspace-business-artifact-manifest-registry-v1.json",
    businessRoster: "/data/integration/business-roster.json",
    businessHours: "/data/integration/business-hours.json"
  };

  for (const workspace of canonicalAdministrationRegistry.workspaces) {
    const principal = authorizeRouteIqAugust1LaunchPrincipal({
      envelope,
      registry: commercialRegistry,
      authenticatedPrincipalId: founder.authenticatedPrincipalId,
      requestedWorkspaceId: workspace.workspaceId,
      now: integratedNow
    });
    assert.equal(principal.accessMode, "founder_explicit_workspace_read_only");
    assert.equal(principal.workspaceId, workspace.workspaceId);
    const projection = projectRouteIqWorkspaceZipCoverage({
      principal,
      workspaceRegistry: canonicalAdministrationRegistry
    });
    assert.equal(projection.companyId, workspace.companyId);
    assert.deepEqual(
      projection.territoryIds,
      workspace.territories.filter(territory => territory.active).map(
        territory => territory.territoryId
      )
    );
    const session = createRouteIqCustomerPwaSession({
      accessExpiresAt: "2026-08-01T14:05:00.000Z",
      launch,
      principal,
      runtimeAssets
    });
    assert.equal(session.workspaceId, workspace.workspaceId);
    assert.deepEqual(
      Object.keys(session.runtimeAssets).sort(),
      [...ROUTE_IQ_CUSTOMER_PWA_SESSION_RUNTIME_ASSET_KEYS].sort()
    );
    assert.equal(Object.hasOwn(session, "authorizedWorkspaceIds"), false);
    assert.equal(Object.hasOwn(session, "zipCoverage"), false);
    assert.equal(session.capabilities.founderIntelligence, false);
  }
});

test("canonical representative ZIP scope is isolated and malformed or cross-owner coverage fails closed", () => {
  const fitnessWorkspace = canonicalAdministrationRegistry.workspaces.find(
    workspace => workspace.workspaceId === "fitness_connection"
  );
  const representative = fitnessWorkspace.users.find(user => user.active);
  const representativePrincipal = {
    authorized: true,
    workspaceId: fitnessWorkspace.workspaceId,
    operatingProfileId: fitnessWorkspace.operatingProfile.profileId,
    userId: representative.userId,
    representativeId: representative.representativeId,
    roleId: representative.roleId
  };
  const projection = projectRouteIqWorkspaceZipCoverage({
    principal: representativePrincipal,
    workspaceRegistry: canonicalAdministrationRegistry
  });
  assert.deepEqual(projection.postalCodes, ["77001", "77002"]);
  assert.throws(
    () => assertRouteIqRuntimeZipAuthorization(projection, {
      workspaceId: "fitness_connection",
      territoryId: fitnessWorkspace.territories[0].territoryId,
      zipCode: "77003"
    }),
    error => error.code === ROUTE_IQ_MULTI_COMPANY_FAILURES.zipUnauthorized
  );

  for (const mutate of [
    value => { delete value.workspaces[0].territories[0].zipCoverage; },
    value => { value.workspaces[0].territories[0].zipCoverage.postalCodes = ["7700A"]; },
    value => { value.workspaces[0].territories[0].zipCoverage.workspaceId = value.workspaces[1].workspaceId; },
    value => { value.workspaces[0].territories[0].zipCoverage.companyId = value.workspaces[1].companyId; },
    value => { value.workspaces[0].territories[0].zipCoverage.territoryId = value.workspaces[1].territories[0].territoryId; }
  ]) {
    const registryValue = clone(canonicalAdministrationRegistry);
    mutate(registryValue);
    assert.throws(
      () => projectRouteIqWorkspaceZipCoverage({
        principal: representativePrincipal,
        workspaceRegistry: registryValue
      }),
      error => error.code === ROUTE_IQ_MULTI_COMPANY_FAILURES.projectionInvalid
    );
  }
});

test("onboarding evidence records automated time and leaves attended/external work open", () => {
  const runtimeAssets = {
    workspaceConfiguration: "/administration/workspaces/synthetic-service-v1.json",
    businessManifestRegistry: "/data/manifests/synthetic-service-v1.json",
    businessRoster: "/data/rosters/synthetic-service-v1.json",
    businessHours: "/data/hours/synthetic-service-v1.json"
  };
  const evidence = buildRouteIq72HourOnboardingRuntimeEvidence({
    workspaceConfigurationRegistry: registry(),
    principal: principal(),
    runtimeAssets,
    rehearsalStartedAt: "2026-07-23T12:00:00.000Z",
    automatedConfigurationStartedAt: "2026-07-23T12:05:00.000Z",
    automatedConfigurationCompletedAt: "2026-07-23T12:15:00.000Z",
    evidenceGeneratedAt: "2026-07-23T12:20:00.000Z"
  });
  assert.deepEqual(Object.keys(evidence.runtimeAssets).sort(), [...ROUTE_IQ_ONBOARDING_RUNTIME_ASSET_KEYS].sort());
  assert.equal(evidence.elapsedEvidence.automatedConfigurationSeconds, 600);
  assert.equal(evidence.elapsedEvidence.elapsedSinceRehearsalStartSeconds, 1200);
  assert.equal(evidence.claimBoundary.seventyTwoHourStandardProven, false);
  assert.deepEqual(evidence.safety, {
    prospectiveCollection: "OFF",
    activeCohorts: 0,
    recommendationInfluence: "OFF",
    availabilityProviders: "OFF",
    dailyScheduler: "OFF",
    productionMutationPerformed: false
  });
});
