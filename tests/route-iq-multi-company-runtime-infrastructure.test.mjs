import assert from "node:assert/strict";
import test from "node:test";

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
      operatingProfile: { profileId: "general_outside_sales" },
      provenance: {
        owner: "prometheus_administration",
        configurationVersion: "v2.2.0"
      },
      territories: [{
        territoryId: "central_territory",
        active: true,
        zipCodes: ["75001", "75002"]
      }, {
        territoryId: "north_territory",
        active: true,
        zipCodes: ["75003"]
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
    }]
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
  assert.deepEqual(projection.territoryIds, ["central_territory"]);
  assert.deepEqual(projection.zipCodes, ["75001", "75002"]);
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
    value => { delete value.workspaces[0].territories[0].zipCodes; },
    value => { value.workspaces[0].territories[0].zipCodes = ["7500"]; },
    value => { value.workspaces[0].territories[0].zipCodes = ["75001", "75001"]; },
    value => { value.workspaces[0].territories[1].zipCodes = ["75001"]; },
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
  assert.deepEqual(projection.zipCodes, ["75001", "75002", "75003"]);
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
