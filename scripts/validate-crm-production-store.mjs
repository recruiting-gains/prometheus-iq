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

const configs = [
  readJsonc("wrangler.jsonc"),
  readJsonc("wrangler.prometheusrouteiq-website.jsonc")
];
for (const config of configs) {
  const crmBinding = config.kv_namespaces.find(binding => binding.binding === crmWorkspaceLeadStoreBinding);
  const infrastructureBinding = config.kv_namespaces.find(binding => binding.binding === "SHARED_LEAD_INTAKE_STORE");
  assert.ok(crmBinding, `${config.name} must declare ${crmWorkspaceLeadStoreBinding}.`);
  assert.equal(crmBinding.id, crmWorkspaceLeadStoreNamespaceId, `${config.name} CRM KV namespace mismatch.`);
  assert.notEqual(crmBinding.id, infrastructureBinding?.id, `${config.name} must isolate CRM storage from Infrastructure storage.`);
  assert.equal(config.main, "workers/prometheus-iq-worker.js", `${config.name} must use the composed production Worker.`);
}

assert.equal(crmWorkspaceLeadStoreTechnology, "cloudflare_workers_kv");
assert.equal(SHARED_WORKSPACE_LEAD_INTAKE_CONTRACT.crmHandoffPacket.contract, "shared_workspace_crm_lead_intake_packet.v1");
assert.equal(SHARED_WORKSPACE_LEAD_INTAKE_CONTRACT.crmHandoffPacket.ownerSubsystem, "Prometheus CRM");
assert.equal(SHARED_WORKSPACE_LEAD_INTAKE_CONTRACT.crmHandoffPacket.mutationPerformedByInfrastructure, false);
assert.equal(supportedWorkspaceLeadIntakeWorkspaces.fitness_connection.runtimePersistenceAllowed, true);
assert.equal(supportedWorkspaceLeadIntakeWorkspaces.smoothie_depot.runtimePersistenceAllowed, false);

const smoothiePlanning = JSON.parse(read("crm/workspaces/smoothie-depot/candidate-pipeline-contracts.json"));
assert.equal(smoothiePlanning.runtimeImplementationApproved, false);
assert.equal(smoothiePlanning.workspaceIsolation.runtimeCandidateRecordsAllowed, false);

const worker = read("workers/prometheus-iq-worker.js");
const intakePipeline = read("workers/infrastructure/shared-lead-intake-pipeline.js");
assert.ok(worker.includes("persistWorkspaceLeadIntakeWithProductionStore"), "Production Worker must compose the CRM persistence consumer.");
assert.ok(worker.includes('"X-Prometheus-CRM-Persistence"'), "Production Worker must expose safe CRM persistence status metadata.");
assert.ok(intakePipeline.includes("record: result.record"), "Infrastructure handler must pass the prepared record only to the Worker composition boundary.");

const bindingStatus = validateCloudflareKvCrmWorkspaceLeadStoreBinding({
  [crmWorkspaceLeadStoreBinding]: {
    async get() { return null; },
    async put() {}
  }
});
assert.equal(bindingStatus.ok, true);
assert.equal(bindingStatus.bindingName, crmWorkspaceLeadStoreBinding);

console.log("CRM production store validation passed: Cloudflare KV adapter, isolated bindings, handoff compatibility, Worker composition, and runtime governance are valid.");
