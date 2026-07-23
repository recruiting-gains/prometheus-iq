import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

import {
  loadRouteIqWorkspaceConfigurationRegistry
} from "../administration/contracts/route-iq-workspace-configuration-v2.mjs";

const repoRoot = resolve(import.meta.dirname, "..");
const administrationRoot = resolve(repoRoot, "administration");
const schemaPath = resolve(
  administrationRoot,
  "contracts/route-iq-workspace-configuration-v2.schema.json"
);
const legacyWorkspacePath = resolve(administrationRoot, "workspaces", "smoothie-depot");
const forbiddenLiteral = /smoothie[\s_-]*depot|smoothiedepot/i;

function listFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return listFiles(path);
    return statSync(path).isFile() ? [path] : [];
  });
}

const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
const registry = loadRouteIqWorkspaceConfigurationRegistry();

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
assert.equal(registry.founderBoundary.attendanceMode, "CRUZ_ONLY_ATTENDED");
assert.equal(registry.founderBoundary.anthonyMappingStatus, "UNMAPPED");
assert.equal(registry.safety.collection, "OFF");
assert.equal(registry.safety.activeCohorts, 0);
assert.equal(registry.safety.recommendationInfluence, "OFF");
assert.equal(existsSync(legacyWorkspacePath), false);

const administrationFiles = listFiles(administrationRoot);
const literalLeaks = administrationFiles.filter(path =>
  forbiddenLiteral.test(path.replace(`${administrationRoot}/`, ""))
    || forbiddenLiteral.test(readFileSync(path, "utf8"))
);
assert.deepEqual(literalLeaks, [], "Administration must contain no current Smoothie Depot path or literal.");

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
assert.equal(general.opportunitySources.every(source => source.productionEligible === false), true);
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
