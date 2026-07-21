export const crmComposedWorkerEntrypoint = "workers/prometheus-iq-worker.js";
export const crmPublicWorkerEntrypoint = "workers/infrastructure/prometheusrouteiq-website-entry.mjs";

const crmPublicAdapterPattern = /^\s*import\s+worker\s*,\s*\{\s*RouteIqRequestCrmCoordinator\s*\}\s*from\s*["']\.\.\/prometheus-iq-worker\.js["']\s*;\s*export\s*\{\s*RouteIqRequestCrmCoordinator\s*\}\s*;\s*export\s+default\s+worker\s*;\s*$/u;

export class CrmProductionWorkerEntrypointError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "CrmProductionWorkerEntrypointError";
    this.code = code;
  }
}

function requireExact(value, expected, code, message) {
  if (value !== expected) {
    throw new CrmProductionWorkerEntrypointError(code, message);
  }
}

export function validateCrmProductionWorkerEntrypoints({
  privateWorkerMain,
  publicWorkerMain,
  publicWorkerAdapterSource
}) {
  requireExact(
    privateWorkerMain,
    crmComposedWorkerEntrypoint,
    "crm_private_worker_entrypoint_mismatch",
    "Private Worker must use the composed production Worker."
  );
  requireExact(
    publicWorkerMain,
    crmPublicWorkerEntrypoint,
    "crm_public_worker_entrypoint_mismatch",
    "Public Worker must use the governed narrow Infrastructure adapter."
  );
  if (typeof publicWorkerAdapterSource !== "string" || !crmPublicAdapterPattern.test(publicWorkerAdapterSource)) {
    throw new CrmProductionWorkerEntrypointError(
      "crm_public_worker_adapter_contract_mismatch",
      "Public Worker adapter must expose only the composed handler and Route IQ CRM coordinator."
    );
  }

  return Object.freeze({
    privateWorkerMain,
    publicWorkerMain,
    composedWorkerImportedByPublicAdapter: true,
    routeIqRequestCrmCoordinatorExported: true,
    additionalPublicAdapterExportsAllowed: false
  });
}
