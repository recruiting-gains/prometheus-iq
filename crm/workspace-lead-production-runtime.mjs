import {
  createCloudflareKvCrmWorkspaceLeadStore,
  crmWorkspaceLeadStoreBinding,
  crmWorkspaceLeadStoreTechnology
} from "./cloudflare-kv-workspace-lead-store.mjs";
import {
  createFitnessConnectionRuntimeLeadConsumption,
  persistWorkspaceLeadIntakeHandoffCore,
  readPersistedWorkspaceLeadBySubmission,
  validateWorkspaceLeadIntakeHandoff
} from "./workspace-lead-persistence.mjs";

export const crmWorkspaceLeadProductionRuntimeVersion = "crm-workspace-lead-production-runtime-v1";

function iso(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid CRM production runtime date: ${value}`);
  return date.toISOString();
}

function runtimeState(now) {
  return {
    clock: now,
    workspaceLeadPersistenceRecords: []
  };
}

export async function persistWorkspaceLeadIntakeWithProductionStore(input = {}, options = {}) {
  const handoff = validateWorkspaceLeadIntakeHandoff(input);
  if (!handoff.runtimePersistenceAllowed) {
    return {
      ok: true,
      persisted: false,
      duplicate: false,
      status: "governance_blocked",
      code: "crm_workspace_runtime_governance_blocked",
      runtimeVersion: crmWorkspaceLeadProductionRuntimeVersion,
      workspaceId: handoff.workspaceId,
      submissionId: handoff.submissionId,
      reason: "Current CRM governance does not authorize runtime candidate persistence for this workspace."
    };
  }

  const now = iso(options.now || new Date());
  const store = options.store || createCloudflareKvCrmWorkspaceLeadStore(options.env, options);
  const result = await persistWorkspaceLeadIntakeHandoffCore(runtimeState(now), input, {
    store,
    persistedAt: now,
    consumedAt: now,
    consumeWorkspaceLeadIntake: (_state, _input, coreOptions, normalized) => {
      return createFitnessConnectionRuntimeLeadConsumption(normalized, coreOptions);
    }
  });

  return {
    ...result,
    persisted: true,
    status: result.duplicate ? "already_persisted" : "persisted",
    runtimeVersion: crmWorkspaceLeadProductionRuntimeVersion,
    bindingName: store.bindingName,
    storageTechnology: store.storageTechnology
  };
}

export async function readWorkspaceLeadIntakeFromProductionStore(input = {}, options = {}) {
  const store = createCloudflareKvCrmWorkspaceLeadStore(options.env, options);
  const record = await readPersistedWorkspaceLeadBySubmission(store, input);
  return {
    ok: true,
    found: Boolean(record),
    runtimeVersion: crmWorkspaceLeadProductionRuntimeVersion,
    bindingName: store.bindingName,
    storageTechnology: store.storageTechnology,
    record
  };
}

export function productionCrmWorkspaceLeadBindingStatus(env = {}) {
  const binding = env?.[crmWorkspaceLeadStoreBinding];
  return {
    bindingName: crmWorkspaceLeadStoreBinding,
    storageTechnology: crmWorkspaceLeadStoreTechnology,
    readable: typeof binding?.get === "function",
    writable: typeof binding?.put === "function",
    atomicPutIfAbsent: false
  };
}
