import test from "node:test";
import assert from "node:assert/strict";
import {
  crmWorkspaceLeadStoreBinding,
  validateCloudflareKvCrmWorkspaceLeadStoreBinding
} from "../crm/cloudflare-kv-workspace-lead-store.mjs";
import {
  persistWorkspaceLeadIntakeWithProductionStore,
  productionCrmWorkspaceLeadBindingStatus
} from "../crm/workspace-lead-production-runtime.mjs";
import {
  CrmProductionWorkerEntrypointError,
  crmComposedWorkerEntrypoint,
  crmPublicWorkerEntrypoint,
  validateCrmProductionWorkerEntrypoints
} from "../crm/production-worker-entrypoint-contract.mjs";
import {
  createSharedLeadIntakeSubmission
} from "../workers/infrastructure/shared-lead-intake-pipeline.js";

const syntheticWorkspaceRegistry = {
  schemaVersion: "route-iq-shared-lead-workspace-registry-v2",
  sourceRegistryVersion: "synthetic-crm-production-adapter-tests-v1",
  workspaces: [{
    workspaceId: "fitness_connection",
    workspaceName: "Fitness Connection",
    operatingProfileId: "fitness",
    operatingProfileLabel: "Fitness",
    crmWorkspacePath: "crm://workspace/fitness_connection/leads",
    aliases: ["fitness_connection", "fitness connection"],
    active: true,
    intakeAuthorized: true
  }]
};

function kvBinding() {
  const data = new Map();
  const writes = [];
  return {
    data,
    writes,
    async get(key) {
      return data.get(key)?.value ?? null;
    },
    async put(key, value, options = {}) {
      data.set(key, { value: String(value), options });
      writes.push({ key, value: String(value), options });
    },
    readJson(key) {
      const item = data.get(key);
      return item ? JSON.parse(item.value) : null;
    }
  };
}

function leadInput(workspaceId = "fitness_connection") {
  return {
    workspaceId,
    formId: `${workspaceId}_partner_intake`,
    companyName: "Durable Fitness Lead",
    contactName: "Production Adapter Test",
    contactMethod: "adapter-test@example.com",
    primaryGoal: "Verify CRM durable persistence.",
    currentWorkflow: "Exercise the existing workspace handoff contract through the CRM production adapter.",
    openedAt: "2026-07-01T12:00:00.000Z",
    attribution: {
      provider: "website",
      campaignId: "crm-production-adapter-v1",
      leadSource: "partner_intake"
    }
  };
}

const validPublicWorkerAdapter = `
import worker, {
  RouteIqRequestCrmCoordinator
} from "../prometheus-iq-worker.js";

export { RouteIqRequestCrmCoordinator };
export default worker;
`;

async function intakeRecord(workspaceId = "fitness_connection", suffix = "default") {
  const result = await createSharedLeadIntakeSubmission({
    input: leadInput(workspaceId),
    request: new Request("https://prometheusrouteiq.com/api/partner-intake", {
      method: "POST",
      headers: { "content-type": "application/json" }
    }),
    env: {
      SHARED_LEAD_INTAKE_STORE: kvBinding(),
      ROUTE_IQ_SHARED_LEAD_WORKSPACE_REGISTRY: JSON.stringify(syntheticWorkspaceRegistry)
    },
    now: new Date("2026-07-10T12:01:00.000Z"),
    idFactory: () => `sub_crm_production_${suffix}`
  });
  assert.equal(result.ok, true);
  return result.record;
}

test("production Fitness Connection research handoff is governance blocked before KV access", async () => {
  const binding = kvBinding();
  const env = { [crmWorkspaceLeadStoreBinding]: binding };
  const record = await intakeRecord("fitness_connection", "readback");

  const bindingStatus = validateCloudflareKvCrmWorkspaceLeadStoreBinding(env);
  assert.deepEqual(bindingStatus, {
    ok: true,
    bindingName: "CRM_WORKSPACE_LEAD_STORE",
    storageTechnology: "cloudflare_workers_kv",
    missingMethods: []
  });
  assert.equal(productionCrmWorkspaceLeadBindingStatus(env).atomicPutIfAbsent, false);

  const written = await persistWorkspaceLeadIntakeWithProductionStore(record, {
    env,
    now: "2026-07-10T12:02:00.000Z"
  });
  assert.equal(written.ok, true);
  assert.equal(written.persisted, false);
  assert.equal(written.duplicate, false);
  assert.equal(written.status, "governance_blocked");
  assert.equal(written.code, "crm_workspace_runtime_governance_blocked");
  assert.equal(binding.data.size, 0);
  assert.equal(binding.writes.length, 0);
});

test("production Fitness Connection retries remain blocked with no lead consumption or writes", async () => {
  const binding = kvBinding();
  const env = { [crmWorkspaceLeadStoreBinding]: binding };
  const record = await intakeRecord("fitness_connection", "duplicate");

  const first = await persistWorkspaceLeadIntakeWithProductionStore(record, {
    env,
    now: "2026-07-10T12:03:00.000Z"
  });
  const second = await persistWorkspaceLeadIntakeWithProductionStore(record, {
    env,
    now: "2026-07-10T12:04:00.000Z"
  });

  assert.equal(first.status, "governance_blocked");
  assert.equal(second.status, "governance_blocked");
  assert.equal(binding.writes.length, 0);
  assert.equal(binding.data.size, 0);
});

test("production CRM adapter rejects cross-workspace contamination without writes", async () => {
  const binding = kvBinding();
  const record = await intakeRecord("fitness_connection", "contaminated");
  record.crmHandoff.packet.lead.workspaceId = "other_company_workspace";

  await assert.rejects(() => persistWorkspaceLeadIntakeWithProductionStore(record, {
    env: { [crmWorkspaceLeadStoreBinding]: binding }
  }), /cross-workspace contamination/);
  assert.equal(binding.data.size, 0);
});

test("production Fitness Connection governance denial does not require or inspect a KV binding", async () => {
  const record = await intakeRecord("fitness_connection", "missing_binding");
  const result = await persistWorkspaceLeadIntakeWithProductionStore(record, { env: {} });
  assert.equal(result.status, "governance_blocked");
  assert.equal(result.persisted, false);
});

test("production CRM adapter rejects an unknown workspace before durable writes", async () => {
  const binding = kvBinding();
  const record = await intakeRecord("fitness_connection", "unknown");
  record.workspace.workspaceId = "unknown_workspace";
  record.operatingProfile.id = "general_outside_sales";
  record.crmHandoff.workspaceId = "unknown_workspace";
  record.crmHandoff.packet.lead.workspaceId = "unknown_workspace";
  record.crmHandoff.packet.crmIntegration.workspaceId = "unknown_workspace";
  record.crmHandoff.packet.crmIntegration.operatingProfileId = "general_outside_sales";

  await assert.rejects(() => persistWorkspaceLeadIntakeWithProductionStore(record, {
    env: { [crmWorkspaceLeadStoreBinding]: binding }
  }), /Unknown CRM workspace intake workspace: unknown_workspace/);
  assert.equal(binding.data.size, 0);
});

test("production CRM adapter rejects an unregistered workspace before durable writes", async () => {
  const binding = kvBinding();
  const record = await intakeRecord("fitness_connection", "unregistered_governance");
  const unregisteredWorkspaceId = "unregistered_workspace";
  record.workspace.workspaceId = unregisteredWorkspaceId;
  record.workspace.workspaceName = "Unregistered Workspace";
  record.operatingProfile.id = "general_outside_sales";
  record.operatingProfile.label = "General Outside Sales";
  record.crmHandoff.workspaceId = unregisteredWorkspaceId;
  record.crmHandoff.crmWorkspacePath = `crm://workspace/${unregisteredWorkspaceId}/leads`;
  record.crmHandoff.packet.lead.workspaceId = unregisteredWorkspaceId;
  record.crmHandoff.packet.lead.workspaceName = "Unregistered Workspace";
  record.crmHandoff.packet.lead.operatingProfile.profileId = "general_outside_sales";
  record.crmHandoff.packet.lead.operatingProfile.crmProfileId = "general_outside_sales";
  record.crmHandoff.packet.crmIntegration.workspaceId = unregisteredWorkspaceId;
  record.crmHandoff.packet.crmIntegration.operatingProfileId = "general_outside_sales";

  await assert.rejects(() => persistWorkspaceLeadIntakeWithProductionStore(record, {
    env: { [crmWorkspaceLeadStoreBinding]: binding }
  }), /Unknown CRM workspace intake workspace: unregistered_workspace/);
  assert.equal(binding.data.size, 0);
});

test("CRM production entrypoint contract accepts the private composition and narrow public adapter", () => {
  assert.deepEqual(validateCrmProductionWorkerEntrypoints({
    privateWorkerMain: crmComposedWorkerEntrypoint,
    publicWorkerMain: crmPublicWorkerEntrypoint,
    publicWorkerAdapterSource: validPublicWorkerAdapter
  }), {
    privateWorkerMain: crmComposedWorkerEntrypoint,
    publicWorkerMain: crmPublicWorkerEntrypoint,
    composedWorkerImportedByPublicAdapter: true,
    routeIqRequestCrmCoordinatorExported: true,
    additionalPublicAdapterExportsAllowed: false
  });
});

test("CRM production entrypoint contract fails closed on path or adapter-surface drift", () => {
  const rejectedCases = [
    {
      overrides: { privateWorkerMain: "workers/infrastructure/prometheusrouteiq-website-entry.mjs" },
      code: "crm_private_worker_entrypoint_mismatch"
    },
    {
      overrides: { publicWorkerMain: "workers/prometheus-iq-worker.js" },
      code: "crm_public_worker_entrypoint_mismatch"
    },
    {
      overrides: { publicWorkerAdapterSource: validPublicWorkerAdapter.replace("../prometheus-iq-worker.js", "../other-worker.js") },
      code: "crm_public_worker_adapter_contract_mismatch"
    },
    {
      overrides: { publicWorkerAdapterSource: validPublicWorkerAdapter.replace("export default worker;", "export { CALLBACK_PATH };\nexport default worker;") },
      code: "crm_public_worker_adapter_contract_mismatch"
    },
    {
      overrides: { publicWorkerAdapterSource: validPublicWorkerAdapter.replace("export { RouteIqRequestCrmCoordinator };", "") },
      code: "crm_public_worker_adapter_contract_mismatch"
    }
  ];

  for (const { overrides, code } of rejectedCases) {
    assert.throws(() => validateCrmProductionWorkerEntrypoints({
      privateWorkerMain: crmComposedWorkerEntrypoint,
      publicWorkerMain: crmPublicWorkerEntrypoint,
      publicWorkerAdapterSource: validPublicWorkerAdapter,
      ...overrides
    }), error => error instanceof CrmProductionWorkerEntrypointError && error.code === code);
  }
});
