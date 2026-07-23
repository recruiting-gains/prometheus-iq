import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  authorizeConfiguredUserFromRegistry,
  validateRouteIqWorkspaceConfigurationRegistry
} from "../administration/contracts/route-iq-workspace-configuration-v2-validation.mjs";
import {
  validateWorkspaceBusinessArtifactManifestRegistry
} from "../data/route-iq-commercial-readiness-v1/route-iq-workspace-business-artifact-manifest.mjs";
import {
  formatAvailabilityLabel,
  formatEstimatedVisitDuration,
  validateDashboardWorkspaceRegistry
} from "../dashboard/route-iq-dashboard-platform.mjs";
import { verifyCrossSubsystemArtifactContracts } from "../scripts/verify-cross-subsystem-artifact-contracts.mjs";

const readJson = path => JSON.parse(fs.readFileSync(path, "utf8"));
const clone = value => structuredClone(value);

test("canonical cross-subsystem registry verifies current cross-industry boundaries", () => {
  const result = verifyCrossSubsystemArtifactContracts();
  assert.equal(result.ok, true, result.failures.join("\n"));
  assert.deepEqual(result.workspaces, [
    "fitness_connection",
    "northstar_outside_sales_synthetic"
  ]);
  assert.deepEqual(result.dataState, { active: 0, reserve: 0, quarantine: 398 });
  assert.equal(result.collection, "OFF");
  assert.equal(result.activeCohorts, 0);
  assert.equal(result.recommendationInfluence, "OFF");
});

test("Fitness Founder research and synthetic outside sales share one strict configuration schema", () => {
  const registry = readJson("administration/workspace-configurations/route-iq-cross-industry-workspaces-v2.json");
  assert.doesNotThrow(() => validateRouteIqWorkspaceConfigurationRegistry(registry));
  assert.deepEqual(registry.workspaces.map(workspace => workspace.operatingProfile.profileId), [
    "fitness",
    "general_outside_sales"
  ]);
  assert.equal(registry.workspaces[0].company.relationshipClassification, "FOUNDER_FIELD_RESEARCH");
  assert.equal(registry.workspaces[1].company.relationshipClassification, "SYNTHETIC_VALIDATION_FIXTURE");
  assert.equal(registry.workspaces[1].admission.productionAuthorized, false);
  assert.equal(registry.safety.collection, "OFF");
  assert.equal(registry.safety.activeCohorts, 0);
  assert.equal(registry.safety.recommendationInfluence, "OFF");
});

test("unknown configuration fields fail closed before Dashboard admission", () => {
  const registry = readJson("administration/workspace-configurations/route-iq-cross-industry-workspaces-v2.json");
  const tampered = clone(registry);
  tampered.workspaces[0].customerSpecificFallback = true;
  assert.throws(
    () => validateRouteIqWorkspaceConfigurationRegistry(tampered),
    error => error.code === "route_iq_admin_configuration_fields_invalid"
  );
});

test("role, company, profile, and territory substitutions fail closed", () => {
  const registry = readJson("administration/workspace-configurations/route-iq-cross-industry-workspaces-v2.json");
  const workspace = registry.workspaces[0];
  const user = workspace.users[0];
  const canonical = {
    workspaceId: workspace.workspaceId,
    operatingProfileId: workspace.operatingProfile.profileId,
    userId: user.userId,
    roleId: user.roleId,
    territoryId: user.territoryIds[0]
  };
  assert.equal(authorizeConfiguredUserFromRegistry(canonical, registry).authorized, true);
  for (const mutation of [
    input => { input.workspaceId = registry.workspaces[1].workspaceId; },
    input => { input.operatingProfileId = registry.workspaces[1].operatingProfile.profileId; },
    input => { input.roleId = registry.workspaces[1].roles[0].roleId; },
    input => { input.territoryId = registry.workspaces[1].territories[0].territoryId; }
  ]) {
    const input = clone(canonical);
    mutation(input);
    assert.throws(() => authorizeConfiguredUserFromRegistry(input, registry));
  }
});

test("manifest admission is exact, hash-bound, and fallback-free", () => {
  const manifestRegistry = readJson("data/route-iq-commercial-readiness-v1/route-iq-workspace-business-artifact-manifest-registry-v1.json");
  assert.doesNotThrow(() => validateWorkspaceBusinessArtifactManifestRegistry(manifestRegistry));
  assert.equal(manifestRegistry.fallbackPolicy, "FAIL_CLOSED_NO_DEMO_OR_CROSS_WORKSPACE_FALLBACK");
  assert.equal(manifestRegistry.manifests[0].approvedRecordCount, 0);
  assert.equal(manifestRegistry.manifests[0].approvalState, "PENDING_FOUNDER_APPROVAL");
  assert.equal(manifestRegistry.manifests[1].classification, "SYNTHETIC_NONCANONICAL");
  assert.equal(manifestRegistry.manifests[1].productionUseAuthorized, false);
});

test("cross-workspace manifest substitution is rejected", () => {
  const manifestRegistry = readJson("data/route-iq-commercial-readiness-v1/route-iq-workspace-business-artifact-manifest-registry-v1.json");
  const tampered = clone(manifestRegistry);
  tampered.manifests[0].artifactPath = tampered.manifests[1].artifactPath;
  tampered.manifests[0].artifactSha256 = tampered.manifests[1].artifactSha256;
  assert.throws(() => validateWorkspaceBusinessArtifactManifestRegistry(tampered));
});

test("hours and visit duration remain semantically distinct", () => {
  assert.equal(formatAvailabilityLabel({
    status: "OPEN_VERIFIED",
    nextClosing: {
      displayTime: "7:00 PM"
    }
  }), "Open now · closes 7:00 PM");
  assert.equal(formatAvailabilityLabel({
    status: "HOURS_STALE"
  }), "Hours outdated · verification required");
  assert.equal(formatAvailabilityLabel({
    status: "HOURS_UNKNOWN"
  }), "Hours unavailable · not route eligible");
  assert.equal(formatEstimatedVisitDuration("5-9"), "Estimated visit: 5–9 min");
  assert.notEqual(
    formatEstimatedVisitDuration("5-9"),
    formatAvailabilityLabel({ status: "HOURS_UNKNOWN" })
  );
});

test("Dashboard validation does not relabel one workspace as another", () => {
  const registry = readJson("administration/workspace-configurations/route-iq-cross-industry-workspaces-v2.json");
  const workspace = registry.workspaces[0];
  const user = workspace.users[0];
  const session = {
    contractVersion: "route-iq-customer-pwa-session-v2",
    authorizationState: "server_verified",
    workspaceId: workspace.workspaceId,
    operatingProfileId: workspace.operatingProfile.profileId,
    userId: user.userId,
    representativeId: user.representativeId,
    roleId: user.roleId,
    territoryId: user.territoryIds[0],
    capabilities: {
      operateOwnRoute: true,
      readWorkspaceOperations: false,
      administerWorkspaceRoster: false,
      founderIntelligence: false,
      founderCrm: false
    },
    runtimeAssets: {
      workspaceConfiguration: "/administration/workspace-configurations/route-iq-cross-industry-workspaces-v2.json",
      businessManifestRegistry: "/data/route-iq-commercial-readiness-v1/route-iq-workspace-business-artifact-manifest-registry-v1.json",
      businessRoster: "/data/route-iq-commercial-readiness-v1/founder-research/fitness-connection-approved-roster.json",
      businessHours: "/data/route-iq-business-hours-v2.json"
    },
    expiresAt: "2026-07-24T12:00:00.000Z",
    safety: {
      prospectiveCollection: "OFF",
      activeCohorts: 0,
      recommendationInfluence: "OFF"
    }
  };
  assert.doesNotThrow(() => validateDashboardWorkspaceRegistry(registry, session));
  const substituted = clone(session);
  substituted.workspaceId = registry.workspaces[1].workspaceId;
  assert.throws(() => validateDashboardWorkspaceRegistry(registry, substituted));
});

test("one nondeployable negative rule prevents Smoothie Depot from returning", () => {
  const result = verifyCrossSubsystemArtifactContracts();
  assert.equal(result.ok, true, result.failures.join("\n"));
});
