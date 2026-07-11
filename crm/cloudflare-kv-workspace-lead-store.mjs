export const crmWorkspaceLeadStoreBinding = "CRM_WORKSPACE_LEAD_STORE";
export const crmWorkspaceLeadStoreNamespaceId = "f20a0a4f66fb4b53ab26644e2d3bd0dd";
export const crmWorkspaceLeadStoreTechnology = "cloudflare_workers_kv";

export class CrmWorkspaceLeadStoreBindingError extends Error {
  constructor(bindingName, missingMethods = []) {
    super(`CRM production durable store binding ${bindingName} is missing or invalid.`);
    this.name = "CrmWorkspaceLeadStoreBindingError";
    this.code = "crm_workspace_lead_store_binding_missing";
    this.status = 503;
    this.bindingName = bindingName;
    this.missingMethods = [...missingMethods];
  }
}

export function validateCloudflareKvCrmWorkspaceLeadStoreBinding(env = {}, options = {}) {
  const bindingName = options.bindingName || crmWorkspaceLeadStoreBinding;
  const binding = env?.[bindingName];
  const missingMethods = ["get", "put"].filter(method => typeof binding?.[method] !== "function");
  return {
    ok: missingMethods.length === 0,
    bindingName,
    storageTechnology: crmWorkspaceLeadStoreTechnology,
    missingMethods
  };
}

export function createCloudflareKvCrmWorkspaceLeadStore(env = {}, options = {}) {
  const validation = validateCloudflareKvCrmWorkspaceLeadStoreBinding(env, options);
  if (!validation.ok) {
    throw new CrmWorkspaceLeadStoreBindingError(validation.bindingName, validation.missingMethods);
  }

  const binding = env[validation.bindingName];
  return Object.freeze({
    bindingName: validation.bindingName,
    storageTechnology: validation.storageTechnology,
    async get(key) {
      return binding.get(key);
    },
    async put(key, value, putOptions) {
      await binding.put(key, value, putOptions);
    }
  });
}
