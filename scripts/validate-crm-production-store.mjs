import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  crmWorkspaceLeadStoreBinding,
  crmWorkspaceLeadStoreNamespaceId,
  crmWorkspaceLeadStoreTechnology,
  validateCloudflareKvCrmWorkspaceLeadStoreBinding
} from "../crm/cloudflare-kv-workspace-lead-store.mjs";
import {
  supportedWorkspaceLeadIntakeWorkspaces
} from "../crm/workspace-lead-persistence.mjs";
import {
  crmPublicWorkerEntrypoint,
  validateCrmProductionWorkerEntrypoints
} from "../crm/production-worker-entrypoint-contract.mjs";
import {
  SHARED_WORKSPACE_LEAD_INTAKE_CONTRACT
} from "../integrations/shared-workspace-lead-intake-contract.js";

const root = resolve(import.meta.dirname, "..");

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function stripJsonComments(source) {
  let output = "";
  let inString = false;
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (inString) {
      output += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      output += char;
      continue;
    }
    if (char === "/" && next === "/") {
      while (index < source.length && source[index] !== "\n") index += 1;
      output += "\n";
      continue;
    }
    if (char === "/" && next === "*") {
      index += 2;
      while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) index += 1;
      index += 1;
      continue;
    }
    output += char;
  }
  return output;
}

function readJsonc(path) {
  return JSON.parse(stripJsonComments(read(path)));
}

const privateWorkerConfig = readJsonc("wrangler.jsonc");
const websiteWorkerConfig = readJsonc("wrangler.prometheusrouteiq-website.jsonc");
const configs = [privateWorkerConfig, websiteWorkerConfig];
for (const config of configs) {
  const crmBinding = config.kv_namespaces.find(binding => binding.binding === crmWorkspaceLeadStoreBinding);
  const infrastructureBinding = config.kv_namespaces.find(binding => binding.binding === "SHARED_LEAD_INTAKE_STORE");
  assert.ok(crmBinding, `${config.name} must declare ${crmWorkspaceLeadStoreBinding}.`);
  assert.equal(crmBinding.id, crmWorkspaceLeadStoreNamespaceId, `${config.name} CRM KV namespace mismatch.`);
  assert.notEqual(crmBinding.id, infrastructureBinding?.id, `${config.name} must isolate CRM storage from Infrastructure storage.`);
}

validateCrmProductionWorkerEntrypoints({
  privateWorkerMain: privateWorkerConfig.main,
  publicWorkerMain: websiteWorkerConfig.main,
  publicWorkerAdapterSource: read(crmPublicWorkerEntrypoint)
});

assert.equal(crmWorkspaceLeadStoreTechnology, "cloudflare_workers_kv");
assert.equal(SHARED_WORKSPACE_LEAD_INTAKE_CONTRACT.crmHandoffPacket.contract, "shared_workspace_crm_lead_intake_packet.v1");
assert.equal(SHARED_WORKSPACE_LEAD_INTAKE_CONTRACT.crmHandoffPacket.ownerSubsystem, "Prometheus CRM");
assert.equal(SHARED_WORKSPACE_LEAD_INTAKE_CONTRACT.crmHandoffPacket.mutationPerformedByInfrastructure, false);
assert.equal(
  supportedWorkspaceLeadIntakeWorkspaces.fitness_connection.researchClassification,
  "FOUNDER_FIELD_RESEARCH"
);
assert.equal(supportedWorkspaceLeadIntakeWorkspaces.fitness_connection.runtimePersistenceAllowed, false);
assert.deepEqual(Object.keys(supportedWorkspaceLeadIntakeWorkspaces), ["fitness_connection"]);
assert.equal(Object.hasOwn(supportedWorkspaceLeadIntakeWorkspaces, "retired_customer_workspace"), false);

const worker = read("workers/prometheus-iq-worker.js");
const intakePipeline = read("workers/infrastructure/shared-lead-intake-pipeline.js");
const routeIqRequestContract = JSON.parse(read("crm/route-iq-request-crm-contract-v1.json"));
const routeIqRuntimeContract = JSON.parse(read("workers/infrastructure/route-iq-request-crm-runtime-v1.json"));
const routeIqCoordinatorBinding = websiteWorkerConfig.durable_objects?.bindings?.find(
  binding => binding.name === routeIqRuntimeContract.storage.binding
);
const routeIqCoordinatorMigration = websiteWorkerConfig.migrations?.find(
  migration => migration.tag === routeIqRuntimeContract.storage.migrationTag
);

assert.equal(routeIqRequestContract.owner, "Prometheus CRM");
assert.equal(routeIqRequestContract.workspace.workspaceId, routeIqRuntimeContract.publicIntake.workspaceId);
assert.equal(routeIqRequestContract.workspace.operatingProfileId, routeIqRuntimeContract.publicIntake.operatingProfileId);
assert.equal(routeIqRuntimeContract.publicIntake.path, "/api/partner-intake");
assert.equal(routeIqRuntimeContract.publicIntake.legacyFitnessRoutingActive, false);
assert.equal(
  Object.entries(routeIqRuntimeContract.publicIntake)
    .filter(([key]) => key.startsWith("legacy") && key.endsWith("RoutingActive"))
    .every(([, value]) => value === false),
  true
);
assert.equal(routeIqRuntimeContract.boundaries.prospectiveCollection, "OFF");
assert.equal(routeIqRuntimeContract.boundaries.activeCohorts, 0);
assert.equal(routeIqRuntimeContract.boundaries.recommendationInfluence, "OFF");
assert.ok(worker.includes("handleRouteIqRequestCrmRuntimeRequest"), "Production Worker must compose the Route IQ CRM runtime consumer.");
assert.ok(worker.includes("isRouteIqRequestCrmPath"), "Production Worker must route only the governed Route IQ CRM paths.");
assert.ok(worker.includes("RouteIqRequestCrmCoordinator"), "Production Worker must export the Route IQ CRM coordinator.");
assert.equal(routeIqCoordinatorBinding?.class_name, routeIqRuntimeContract.storage.className, "Website Worker CRM coordinator binding mismatch.");
assert.equal(
  routeIqCoordinatorMigration?.new_sqlite_classes?.includes(routeIqRuntimeContract.storage.className),
  true,
  "Website Worker must declare the Route IQ CRM SQLite migration."
);
assert.equal(
  privateWorkerConfig.durable_objects?.bindings?.some(binding => binding.name === routeIqRuntimeContract.storage.binding),
  false,
  "Private Worker must not receive the public Website CRM coordinator binding."
);
assert.ok(intakePipeline.includes("record: result.record"), "Legacy Infrastructure handoff must preserve the prepared-record boundary.");

const bindingStatus = validateCloudflareKvCrmWorkspaceLeadStoreBinding({
  [crmWorkspaceLeadStoreBinding]: {
    async get() { return null; },
    async put() {}
  }
});
assert.equal(bindingStatus.ok, true);
assert.equal(bindingStatus.bindingName, crmWorkspaceLeadStoreBinding);

console.log("CRM production store validation passed: legacy KV isolation, governed Worker entrypoints, and the active Route IQ SQLite Durable Object composition are valid.");
