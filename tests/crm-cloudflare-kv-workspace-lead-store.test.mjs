import test from "node:test";
import assert from "node:assert/strict";
import {
  CrmWorkspaceLeadStoreBindingError,
  createCloudflareKvCrmWorkspaceLeadStore,
  crmWorkspaceLeadStoreBinding,
  crmWorkspaceLeadStoreTechnology,
  validateCloudflareKvCrmWorkspaceLeadStoreBinding
} from "../crm/cloudflare-kv-workspace-lead-store.mjs";
import {
  persistWorkspaceLeadIntakeWithProductionStore,
  readWorkspaceLeadIntakeFromProductionStore
} from "../crm/workspace-lead-production-runtime.mjs";
import {
  crmWorkspaceLeadPersistencePrefix
} from "../crm/workspace-lead-persistence.mjs";
import {
  createCrmState,
  persistWorkspaceLeadIntakeHandoff
} from "../crm/crm-foundation.mjs";
import {
  createSharedLeadIntakeSubmission
} from "../workers/infrastructure/shared-lead-intake-pipeline.js";
import worker from "../workers/prometheus-iq-worker.js";

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
    companyName: workspaceId === "smoothie_depot" ? "Governed Smoothie Candidate" : "Durable Fitness Lead",
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

async function intakeRecord(workspaceId = "fitness_connection", suffix = "default") {
  const result = await createSharedLeadIntakeSubmission({
    input: leadInput(workspaceId),
    request: new Request("https://prometheusrouteiq.com/api/partner-intake", {
      method: "POST",
      headers: { "content-type": "application/json" }
    }),
    env: { SHARED_LEAD_INTAKE_STORE: kvBinding() },
    now: new Date("2026-07-10T12:01:00.000Z"),
    idFactory: () => `sub_crm_production_${suffix}`
  });
  assert.equal(result.ok, true);
  return result.record;
}

test("production CRM adapter writes durably and a separate runtime operation reads the lead back", async () => {
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

  const written = await persistWorkspaceLeadIntakeWithProductionStore(record, {
    env,
    now: "2026-07-10T12:02:00.000Z"
  });
  assert.equal(written.ok, true);
  assert.equal(written.persisted, true);
  assert.equal(written.duplicate, false);
  assert.equal(written.storageTechnology, crmWorkspaceLeadStoreTechnology);
  assert.equal(binding.data.size, 3);

  const existingInterfaceResult = await persistWorkspaceLeadIntakeHandoff(
    createCrmState({ now: "2026-07-10T12:02:00.000Z" }),
    record,
    {
      store: kvBinding(),
      persistedAt: "2026-07-10T12:02:00.000Z"
    }
  );
  assert.deepEqual(written.record, existingInterfaceResult.record);

  const firstAdapter = createCloudflareKvCrmWorkspaceLeadStore(env);
  const separateAdapter = createCloudflareKvCrmWorkspaceLeadStore(env);
  assert.notEqual(separateAdapter, firstAdapter);
  const readBack = await readWorkspaceLeadIntakeFromProductionStore({
    workspaceId: "fitness_connection",
    submissionId: record.submissionId
  }, { env });

  assert.equal(readBack.ok, true);
  assert.equal(readBack.found, true);
  assert.deepEqual(readBack.record, written.record);
  assert.equal(readBack.record.metadata.handoffContract, "shared_workspace_crm_lead_intake_packet.v1");
  assert.equal(readBack.record.storage.keys.record, `${crmWorkspaceLeadPersistencePrefix}/workspaces/fitness_connection/submissions/${record.submissionId}/lead.json`);

  await assert.rejects(() => readWorkspaceLeadIntakeFromProductionStore({
    workspaceId: "smoothie_depot",
    submissionId: record.submissionId
  }, { env }), /cross-workspace contamination/);
});

test("production CRM adapter treats a duplicate submission as the same durable record", async () => {
  const binding = kvBinding();
  const env = { [crmWorkspaceLeadStoreBinding]: binding };
  const record = await intakeRecord("fitness_connection", "duplicate");

  const first = await persistWorkspaceLeadIntakeWithProductionStore(record, {
    env,
    now: "2026-07-10T12:03:00.000Z"
  });
  const writeCount = binding.writes.length;
  const second = await persistWorkspaceLeadIntakeWithProductionStore(record, {
    env,
    now: "2026-07-10T12:04:00.000Z"
  });

  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);
  assert.equal(second.status, "already_persisted");
  assert.equal(second.record.recordId, first.record.recordId);
  assert.equal(binding.writes.length, writeCount);
  assert.equal(binding.data.size, 3);
});

test("production CRM adapter rejects cross-workspace contamination without writes", async () => {
  const binding = kvBinding();
  const record = await intakeRecord("fitness_connection", "contaminated");
  record.crmHandoff.packet.lead.workspaceId = "smoothie_depot";

  await assert.rejects(() => persistWorkspaceLeadIntakeWithProductionStore(record, {
    env: { [crmWorkspaceLeadStoreBinding]: binding }
  }), /cross-workspace contamination/);
  assert.equal(binding.data.size, 0);
});

test("production CRM adapter fails closed when its KV binding is missing", async () => {
  const record = await intakeRecord("fitness_connection", "missing_binding");

  await assert.rejects(() => persistWorkspaceLeadIntakeWithProductionStore(record, { env: {} }), error => {
    assert.equal(error instanceof CrmWorkspaceLeadStoreBindingError, true);
    assert.equal(error.code, "crm_workspace_lead_store_binding_missing");
    assert.equal(error.status, 503);
    assert.deepEqual(error.missingMethods, ["get", "put"]);
    return true;
  });
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

test("production CRM adapter keeps Smoothie Depot runtime candidate persistence governance-blocked", async () => {
  const binding = kvBinding();
  const record = await intakeRecord("smoothie_depot", "smoothie_governance");
  const result = await persistWorkspaceLeadIntakeWithProductionStore(record, {
    env: { [crmWorkspaceLeadStoreBinding]: binding }
  });

  assert.equal(result.ok, true);
  assert.equal(result.persisted, false);
  assert.equal(result.status, "governance_blocked");
  assert.equal(result.code, "crm_workspace_runtime_governance_blocked");
  assert.equal(binding.data.size, 0);
});

test("production Worker binds Fitness Connection intake to CRM KV and reports missing binding failures", async () => {
  const sharedStore = kvBinding();
  const crmStore = kvBinding();
  const request = (workspaceId = "fitness_connection") => new Request("https://prometheusrouteiq.com/api/partner-intake", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json"
    },
    body: JSON.stringify(leadInput(workspaceId))
  });

  const persistedResponse = await worker.fetch(request(), {
    SHARED_LEAD_INTAKE_STORE: sharedStore,
    CRM_WORKSPACE_LEAD_STORE: crmStore
  });
  assert.equal(persistedResponse.status, 201);
  assert.equal(persistedResponse.headers.get("X-Prometheus-CRM-Persistence"), "persisted");
  assert.equal(crmStore.data.size, 3);

  const smoothieCrmStore = kvBinding();
  const smoothieResponse = await worker.fetch(request("smoothie_depot"), {
    SHARED_LEAD_INTAKE_STORE: kvBinding(),
    CRM_WORKSPACE_LEAD_STORE: smoothieCrmStore
  });
  assert.equal(smoothieResponse.status, 201);
  assert.equal(smoothieResponse.headers.get("X-Prometheus-CRM-Persistence"), "governance_blocked");
  assert.equal(smoothieCrmStore.data.size, 0);

  const originalConsoleError = console.error;
  console.error = () => {};
  let missingBindingResponse;
  try {
    missingBindingResponse = await worker.fetch(request(), {
      SHARED_LEAD_INTAKE_STORE: kvBinding()
    });
  } finally {
    console.error = originalConsoleError;
  }
  const missingBindingBody = await missingBindingResponse.json();
  assert.equal(missingBindingResponse.status, 503);
  assert.equal(missingBindingResponse.headers.get("X-Prometheus-CRM-Persistence"), "failed");
  assert.equal(missingBindingBody.code, "crm_workspace_lead_store_binding_missing");
  assert.equal(missingBindingBody.infrastructurePersisted, true);
});
