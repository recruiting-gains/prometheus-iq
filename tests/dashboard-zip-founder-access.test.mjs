import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  loadFounderWorkspaceAccess,
  projectApprovedRoster,
  projectDashboardTerritoryZipCoverage,
  requestFounderWorkspaceSwitch,
  routeIqDashboardRuntimeAssetKeys,
  routeIqFounderWorkspaceAccessContractVersion,
  routeIqFounderWorkspaceAccessPath,
  routeIqFounderWorkspaceSwitchContractVersion,
  routeIqFounderWorkspaceSwitchPath,
  validateFounderWorkspaceAccessEnvelope
} from "../dashboard/route-iq-dashboard-platform.mjs";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

function session({
  workspaceId = "workspace_alpha",
  operatingProfileId = "profile_alpha",
  representative = false
} = {}) {
  return {
    contractVersion: "route-iq-customer-pwa-session-v2",
    authorizationState: "server_verified",
    workspaceId,
    workspaceLabel: "Display-only current workspace",
    operatingProfileId,
    userId: representative ? "user_representative" : "user_founder",
    representativeId: representative ? "representative_alpha" : "representative_founder",
    displayName: representative ? "Field user" : "Workspace owner",
    roleId: representative ? "representative_role" : "workspace_owner",
    capabilities: {
      operateOwnRoute: true,
      readWorkspaceOperations: !representative,
      administerWorkspaceRoster: !representative,
      founderIntelligence: false,
      founderCrm: false
    },
    runtimeAssets: {
      workspaceConfiguration: "/administration/workspace-configurations/route-iq-cross-industry-workspaces-v2.json",
      businessManifestRegistry: "/data/route-iq-commercial-readiness-v1/route-iq-workspace-business-artifact-manifest-registry-v1.json",
      businessRoster: "/data/route-iq-commercial-readiness-v1/workspace-alpha-roster.json",
      businessHours: "/data/route-iq-commercial-readiness-v1/workspace-alpha-hours.json"
    },
    expiresAt: "2026-07-24T12:00:00.000Z",
    safety: {
      prospectiveCollection: "OFF",
      activeCohorts: 0,
      recommendationInfluence: "OFF"
    }
  };
}

function workspace() {
  return {
    workspaceId: "workspace_alpha",
    companyId: "company_alpha",
    provenance: { configurationVersion: "v2.2.0" },
    operatingProfile: { profileId: "profile_alpha" },
    territories: [
      {
        territoryId: "territory_north",
        displayName: "North territory",
        timezone: "America/Chicago",
        active: true,
        zipCoverage: {
          coverageVersion: "territory-zip-coverage-v1.0.0",
          workspaceId: "workspace_alpha",
          companyId: "company_alpha",
          territoryId: "territory_north",
          postalCodes: ["77001", "77002"]
        }
      },
      {
        territoryId: "territory_south",
        displayName: "South territory",
        timezone: "America/Chicago",
        active: true,
        zipCoverage: {
          coverageVersion: "territory-zip-coverage-v1.0.0",
          workspaceId: "workspace_alpha",
          companyId: "company_alpha",
          territoryId: "territory_south",
          postalCodes: ["77003"]
        }
      }
    ]
  };
}

function user(territoryIds = ["territory_north"]) {
  return {
    representativeId: "representative_alpha",
    territoryIds
  };
}

function accessEnvelope(overrides = {}) {
  return {
    contractVersion: routeIqFounderWorkspaceAccessContractVersion,
    authorizationState: "server_verified",
    principalAuthorization: "IMMUTABLE_FOUNDER_PRINCIPAL_VERIFIED",
    currentWorkspaceId: "workspace_alpha",
    currentOperatingProfileId: "profile_alpha",
    authorizedWorkspaceSummaries: [
      {
        workspaceId: "workspace_alpha",
        workspaceLabel: "First authorized workspace",
        operatingProfileId: "profile_alpha"
      },
      {
        workspaceId: "workspace_beta",
        workspaceLabel: "Second authorized workspace",
        operatingProfileId: "profile_beta"
      }
    ],
    ...overrides
  };
}

const jsonResponse = value => new Response(JSON.stringify(value), {
  status: 200,
  headers: { "content-type": "application/json" }
});

test("territory ZIP coverage projects only the representative's governed scope", () => {
  const projection = projectDashboardTerritoryZipCoverage(workspace(), user());
  assert.equal(projection.workspaceId, "workspace_alpha");
  assert.equal(projection.companyId, "company_alpha");
  assert.equal(projection.configurationVersion, "v2.2.0");
  assert.deepEqual(projection.zipCodes, ["77001", "77002"]);
  assert.deepEqual(projection.territories.map(territory => territory.territoryId), ["territory_north"]);
  assert.equal(Object.isFrozen(projection), true);
  assert.equal(Object.isFrozen(projection.zipCodes), true);
});

test("multiple assigned territories are projected without changing reusable Dashboard code", () => {
  const projection = projectDashboardTerritoryZipCoverage(
    workspace(),
    user(["territory_north", "territory_south"])
  );
  assert.deepEqual(projection.zipCodes, ["77001", "77002", "77003"]);
  assert.equal(projection.territories.length, 2);
});

test("missing, malformed, duplicate, cross-territory, and inactive ZIP coverage fail closed", () => {
  const missing = workspace();
  delete missing.territories[0].zipCoverage;
  assert.throws(
    () => projectDashboardTerritoryZipCoverage(missing, user()),
    error => error.code === "route_iq_dashboard_zip_coverage_invalid"
  );

  const malformed = workspace();
  malformed.territories[0].zipCoverage.postalCodes = ["7700A"];
  assert.throws(
    () => projectDashboardTerritoryZipCoverage(malformed, user()),
    error => error.code === "route_iq_dashboard_zip_coverage_invalid"
  );

  const duplicate = workspace();
  duplicate.territories[0].zipCoverage.postalCodes = ["77001", "77001"];
  assert.throws(
    () => projectDashboardTerritoryZipCoverage(duplicate, user()),
    error => error.code === "route_iq_dashboard_zip_coverage_invalid"
  );

  const crossTerritory = workspace();
  crossTerritory.territories[1].zipCoverage.postalCodes = ["77001"];
  assert.throws(
    () => projectDashboardTerritoryZipCoverage(crossTerritory, user()),
    error => error.code === "route_iq_dashboard_zip_assignment_conflict"
  );

  const inactive = workspace();
  inactive.territories[0].active = false;
  assert.throws(
    () => projectDashboardTerritoryZipCoverage(inactive, user()),
    error => error.code === "route_iq_dashboard_zip_coverage_territory_inactive"
  );
});

test("approved roster projection enforces representative territory and ZIP together", () => {
  const governedWorkspace = workspace();
  const governedUser = user();
  const manifest = {
    recordIdentityField: "recordId",
    recordCount: 1,
    approvedRecordCount: 1,
    approvedRecordIds: ["business_001"],
    classification: "CUSTOMER_GOVERNED_DATA",
    manifestId: "workspace_alpha_manifest",
    manifestVersion: "route-iq-workspace-business-artifact-manifest-v1",
    artifactSha256: "a".repeat(64),
    configurationVersion: "workspace-alpha-v1",
    freshness: { evaluatedAt: "2026-07-23T12:00:00.000Z" }
  };
  const record = {
    recordId: "business_001",
    businessName: "Generic governed business",
    address: "100 Example Street",
    postalCode: "77001",
    category: "Business services",
    territoryId: "territory_north"
  };
  const projection = projectApprovedRoster({ records: [record] }, manifest, governedWorkspace, governedUser);
  assert.equal(projection.status, "READY");
  assert.equal(projection.places[0].postalCode, "77001");
  assert.equal(projection.places[0].territoryId, "territory_north");

  assert.throws(
    () => projectApprovedRoster({
      records: [{ ...record, postalCode: "77003" }]
    }, manifest, governedWorkspace, governedUser),
    error => error.code === "route_iq_dashboard_business_roster_zip_unauthorized"
  );
  assert.throws(
    () => projectApprovedRoster({
      records: [{ ...record, postalCode: "" }]
    }, manifest, governedWorkspace, governedUser),
    error => error.code === "route_iq_dashboard_business_roster_zip_invalid"
  );
});

test("representatives remain single-workspace and never request the Founder list", async () => {
  let calls = 0;
  const result = await loadFounderWorkspaceAccess({
    session: session({ representative: true }),
    fetchFn: async () => {
      calls += 1;
      return jsonResponse(accessEnvelope());
    }
  });
  assert.equal(calls, 0);
  assert.equal(result.status, "SINGLE_WORKSPACE");
  assert.deepEqual(result.authorizedWorkspaceSummaries, []);
});

test("the authenticated Founder list must match the current single-workspace session", async () => {
  const current = session();
  const requests = [];
  const access = await loadFounderWorkspaceAccess({
    session: current,
    fetchFn: async (path, options) => {
      requests.push({ path, options });
      return jsonResponse(accessEnvelope());
    }
  });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].path, routeIqFounderWorkspaceAccessPath);
  assert.equal(requests[0].options.method, "GET");
  assert.equal(access.status, "READY");
  assert.deepEqual(
    access.authorizedWorkspaceSummaries.map(summary => summary.workspaceId),
    ["workspace_alpha", "workspace_beta"]
  );
  assert.equal(current.workspaceId, "workspace_alpha");
  assert.equal(current.runtimeAssets.businessRoster.endsWith("workspace-alpha-roster.json"), true);
});

test("display names and caller-selected workspace IDs never grant switch authority", async () => {
  const current = session();
  const forgedByName = accessEnvelope({
    authorizedWorkspaceSummaries: [{
      workspaceId: "workspace_alpha",
      workspaceLabel: "workspace_beta",
      operatingProfileId: "profile_alpha"
    }]
  });
  const validated = validateFounderWorkspaceAccessEnvelope(forgedByName, current);
  assert.deepEqual(validated.authorizedWorkspaceSummaries.map(summary => summary.workspaceId), ["workspace_alpha"]);

  let postCalls = 0;
  const access = await loadFounderWorkspaceAccess({
    session: current,
    fetchFn: async () => jsonResponse(accessEnvelope())
  });
  await assert.rejects(
    requestFounderWorkspaceSwitch({
      session: current,
      access,
      requestedWorkspaceId: "workspace_unlisted",
      fetchFn: async () => {
        postCalls += 1;
        return jsonResponse({});
      }
    }),
    error => error.code === "route_iq_dashboard_founder_workspace_switch_unauthorized"
  );
  assert.equal(postCalls, 0);
});

test("a switch accepts only a fresh loaded list and one fixed server request", async () => {
  const current = session();
  const access = await loadFounderWorkspaceAccess({
    session: current,
    fetchFn: async () => jsonResponse(accessEnvelope())
  });
  const requests = [];
  const receipt = await requestFounderWorkspaceSwitch({
    session: current,
    access,
    requestedWorkspaceId: "workspace_beta",
    fetchFn: async (path, options) => {
      requests.push({ path, options });
      return jsonResponse({
        contractVersion: routeIqFounderWorkspaceSwitchContractVersion,
        authorizationState: "server_verified",
        requestedWorkspaceId: "workspace_beta",
        sessionState: "FRESH_SINGLE_WORKSPACE_SESSION_BOUND",
        reloadPath: "/app"
      });
    }
  });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].path, routeIqFounderWorkspaceSwitchPath);
  assert.equal(requests[0].options.method, "POST");
  assert.deepEqual(JSON.parse(requests[0].options.body), {
    requestedWorkspaceId: "workspace_beta"
  });
  assert.deepEqual(receipt, {
    requestedWorkspaceId: "workspace_beta",
    reloadPath: "/app",
    reloadRequired: true
  });
  assert.equal(current.workspaceId, "workspace_alpha");
});

test("forged local lists and malformed switch receipts fail closed", async () => {
  const current = session();
  await assert.rejects(
    requestFounderWorkspaceSwitch({
      session: current,
      access: {
        ...accessEnvelope(),
        status: "READY"
      },
      requestedWorkspaceId: "workspace_beta",
      fetchFn: async () => jsonResponse({})
    }),
    error => error.code === "route_iq_dashboard_founder_workspace_access_untrusted"
  );

  const access = await loadFounderWorkspaceAccess({
    session: current,
    fetchFn: async () => jsonResponse(accessEnvelope())
  });
  await assert.rejects(
    requestFounderWorkspaceSwitch({
      session: current,
      access,
      requestedWorkspaceId: "workspace_beta",
      fetchFn: async () => jsonResponse({
        contractVersion: routeIqFounderWorkspaceSwitchContractVersion,
        authorizationState: "server_verified",
        requestedWorkspaceId: "workspace_beta",
        sessionState: "MERGED_CLIENT_STATE",
        reloadPath: "/app"
      })
    }),
    error => error.code === "route_iq_dashboard_founder_workspace_switch_receipt_invalid"
  );
});

test("the generic PWA exposes assigned ZIPs and deliberate Founder switching without embedded companies", () => {
  const dashboard = read("index.html");
  const platform = read("dashboard/route-iq-dashboard-platform.mjs");
  assert.match(dashboard, /id="founderWorkspaceSwitch" hidden/u);
  assert.match(dashboard, /loadFounderWorkspaceAccess/u);
  assert.match(dashboard, /requestFounderWorkspaceSwitch/u);
  assert.match(dashboard, /ZIP coverage:/u);
  assert.match(dashboard, /location\.assign\(receipt\.reloadPath\)/u);
  assert.deepEqual(routeIqDashboardRuntimeAssetKeys, [
    "workspaceConfiguration",
    "businessManifestRegistry",
    "businessRoster",
    "businessHours"
  ]);
  assert.doesNotMatch(platform, /Fitness Connection|Northstar/u);
  assert.doesNotMatch(platform, /["'`]7[0-9]{4}["'`]/u);
});
