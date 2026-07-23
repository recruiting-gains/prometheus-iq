import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

import {
  ROUTE_IQ_FITNESS_WORKSPACE_ID,
  ROUTE_IQ_SYNTHETIC_OUTSIDE_SALES_WORKSPACE_ID,
  loadRouteIqWorkspaceConfigurationRegistry
} from "../administration/contracts/route-iq-workspace-configuration-v2.mjs";

const repoRoot = resolve(import.meta.dirname, "..");
const administrationRoot = resolve(repoRoot, "administration");
const schemaPath = resolve(
  administrationRoot,
  "contracts/route-iq-workspace-configuration-v2.schema.json"
);
const retiredWorkspaceArtifactRoot = resolve(administrationRoot, "workspaces");
const dataManifestRegistryPath =
  "data/route-iq-commercial-readiness-v1/route-iq-workspace-business-artifact-manifest-registry-v1.json";
const forbiddenWorkspaceAliases = [
  ["fitness_connection", "founder", "research"].join("_"),
  ["northstar", "field", "supply", "synthetic"].join("_")
];

function listFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return listFiles(path);
    return statSync(path).isFile() ? [path] : [];
  });
}

const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
const registry = loadRouteIqWorkspaceConfigurationRegistry();
const dataManifestRegistry = JSON.parse(
  readFileSync(resolve(repoRoot, dataManifestRegistryPath), "utf8")
);

assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
assert.equal(schema.additionalProperties, false);
assert.equal(schema.properties.workspaces.maxItems, 2);
assert.equal(schema.$defs.workspace.additionalProperties, false);
assert.equal(schema.$defs.dashboard.additionalProperties, false);
assert.equal(schema.$defs.availabilityPolicy.properties.freshnessCeilingHours.maximum, 24);
assert.equal(schema.$defs.workspace.properties.fallbackPolicy.properties.demoCatalogAllowed.const, false);
assert.equal(schema.$defs.workspace.properties.fallbackPolicy.properties.embeddedBusinessCatalogAllowed.const, false);
assert.equal(schema.$defs.workspace.properties.fallbackPolicy.properties.crossWorkspaceFallbackAllowed.const, false);

assert.equal(registry.workspaces.length, 2);
assert.deepEqual(
  registry.workspaces.map(workspace => workspace.workspaceId).sort(),
  [ROUTE_IQ_FITNESS_WORKSPACE_ID, ROUTE_IQ_SYNTHETIC_OUTSIDE_SALES_WORKSPACE_ID].sort()
);
assert.equal(registry.founderBoundary.attendanceMode, "CRUZ_ONLY_ATTENDED");
assert.equal(registry.founderBoundary.anthonyMappingStatus, "UNMAPPED");
assert.equal(registry.safety.collection, "OFF");
assert.equal(registry.safety.activeCohorts, 0);
assert.equal(registry.safety.recommendationInfluence, "OFF");
assert.deepEqual(
  existsSync(retiredWorkspaceArtifactRoot)
    ? readdirSync(retiredWorkspaceArtifactRoot)
    : [],
  [],
  "Retired customer-specific workspace artifacts must not remain active in Administration."
);

const administrationFiles = listFiles(administrationRoot);
const assignedFiles = [
  ...administrationFiles,
  resolve(repoRoot, "scripts/route-iq-cross-industry-administration-verify.mjs"),
  resolve(repoRoot, "tests/route-iq-cross-industry-administration.test.mjs")
];
const workspaceAliasLeaks = assignedFiles.filter(path => {
  const content = readFileSync(path, "utf8");
  return forbiddenWorkspaceAliases.some(alias => content.includes(alias));
});
assert.deepEqual(workspaceAliasLeaks, [], "Invented workspace aliases must not remain in assigned files.");

const fitness = registry.workspaces.find(workspace => workspace.operatingProfile.profileId === "fitness");
const general = registry.workspaces.find(
  workspace => workspace.operatingProfile.profileId === "general_outside_sales"
);
assert.ok(fitness);
assert.ok(general);
assert.equal(fitness.company.relationshipClassification, "FOUNDER_FIELD_RESEARCH");
assert.equal(fitness.company.publicRelationshipClaimsAllowed, false);
assert.equal(fitness.admission.productionAuthorized, false);
assert.equal(general.lifecycle, "synthetic_validation_only");
assert.equal(general.admission.productionAuthorized, false);
assert.equal(general.opportunitySources.every(source => source.productionUseAuthorized === false), true);
assert.equal(
  registry.workspaces.every(workspace =>
    workspace.fallbackPolicy.mode === "FAIL_CLOSED"
      && workspace.fallbackPolicy.demoCatalogAllowed === false
      && workspace.fallbackPolicy.embeddedBusinessCatalogAllowed === false
      && workspace.fallbackPolicy.crossWorkspaceFallbackAllowed === false
  ),
  true
);
assert.equal(
  registry.workspaces.every(workspace => workspace.availabilityPolicy.freshnessCeilingHours <= 24),
  true
);

const dataManifestsById = new Map(
  dataManifestRegistry.manifests.map(manifest => [manifest.manifestId, manifest])
);
for (const workspace of registry.workspaces) {
  const territoryIds = new Set(workspace.territories.map(territory => territory.territoryId));
  for (const source of workspace.opportunitySources) {
    assert.equal(source.manifestRegistryPath, dataManifestRegistryPath);
    const manifest = dataManifestsById.get(source.manifestId);
    assert.ok(manifest, `Missing Data manifest ${source.manifestId}.`);
    assert.equal(source.workspaceId, workspace.workspaceId);
    assert.equal(manifest.workspaceId, workspace.workspaceId);
    assert.equal(source.profileId, workspace.operatingProfile.profileId);
    assert.equal(manifest.operatingProfileId, workspace.operatingProfile.profileId);
    assert.equal(source.artifactPath, manifest.artifactPath);
    assert.equal(source.classification, manifest.classification);
    assert.equal(source.manifestApprovalState, manifest.approvalState);
    assert.equal(source.productionUseAuthorized, manifest.productionUseAuthorized);

    const artifactBytes = readFileSync(resolve(repoRoot, manifest.artifactPath));
    assert.equal(createHash("sha256").update(artifactBytes).digest("hex"), manifest.artifactSha256);
    const artifact = JSON.parse(artifactBytes.toString("utf8"));
    const artifactVersion = artifact.schemaVersion || artifact.dataset_version;
    assert.equal(source.artifactSchemaVersion, artifactVersion);
    if (Object.hasOwn(artifact, "workspaceId")) {
      assert.equal(artifact.workspaceId, workspace.workspaceId);
    }
    if (Object.hasOwn(artifact, "operatingProfileId")) {
      assert.equal(artifact.operatingProfileId, workspace.operatingProfile.profileId);
    }
    for (const record of artifact.records || []) {
      if (record.territoryId) {
        assert.equal(
          territoryIds.has(record.territoryId),
          true,
          `${source.manifestId} contains a territory not admitted by Administration.`
        );
      }
    }
  }
}

const fitnessManifest = dataManifestsById.get("fitness_connection_approved_business_roster");
assert.equal(fitnessManifest.approvedRecordCount, 0);
assert.equal(fitnessManifest.approvalState, "PENDING_FOUNDER_APPROVAL");
const syntheticManifest = dataManifestsById.get(
  "northstar_outside_sales_synthetic_approved_business_roster"
);
assert.equal(syntheticManifest.approvedRecordCount, 3);
assert.equal(syntheticManifest.approvalState, "APPROVED_SYNTHETIC_VALIDATION");

const pilotCompanies = JSON.parse(
  readFileSync(resolve(administrationRoot, "registers/pilot-companies.json"), "utf8")
);
const fitnessRecord = pilotCompanies.companies.find(
  company => company.companyId === "company-fitness-connection-almeda-001"
);
assert.equal(fitnessRecord.status, "founder_research_only");
assert.equal(fitnessRecord.pilotType, "not_a_customer_pilot");

const betaTesters = JSON.parse(
  readFileSync(resolve(administrationRoot, "registers/beta-testers.json"), "utf8")
);
const anthony = betaTesters.testers.find(tester => tester.testerId === "tester-anthony-001");
assert.equal(anthony.status, "paused_unmapped");
assert.equal(anthony.permissions.authenticatedPrincipalMapped, false);
assert.equal(anthony.permissions.runtimeAccessAuthorized, false);

process.stdout.write(
  `Route IQ cross-industry Administration verification passed (${administrationFiles.length} Administration files, 2 isolated configurations).\n`
);
