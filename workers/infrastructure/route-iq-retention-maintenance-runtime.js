import {
  routeIqFieldSessionStoreBinding
} from "../../data/route-iq-field-sessions-v1/route-iq-field-session-archive.mjs";
import {
  routeIqRetentionDeletionRuntimeVersion,
  routeIqRetentionMaintenanceCapabilityVersion
} from "../../data/route-iq-field-sessions-v1/route-iq-retention-deletion-runtime.mjs";

export const routeIqRetentionMaintenanceRuntimeContractVersion =
  "route-iq-retention-maintenance-runtime-contract-v1";
export const routeIqRetentionMaintenanceStoreBinding =
  "DATA_ROUTE_IQ_RETENTION_MAINTENANCE_STORE";

export class RouteIqRetentionMaintenanceInfrastructureError extends Error {
  constructor(message, {
    code = "route_iq_retention_maintenance_infrastructure_invalid",
    status = 500,
    details = {}
  } = {}) {
    super(message);
    this.name = "RouteIqRetentionMaintenanceInfrastructureError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new RouteIqRetentionMaintenanceInfrastructureError(message, { code, details });
}

export function validateRouteIqRetentionMaintenanceBindings(env = {}) {
  const ordinaryBinding = env?.[routeIqFieldSessionStoreBinding];
  const maintenanceBinding = env?.[routeIqRetentionMaintenanceStoreBinding];
  const ordinaryMissingMethods = ["get", "put", "list"]
    .filter(method => typeof ordinaryBinding?.[method] !== "function");
  const maintenanceMissingMethods = ["get", "put", "list", "delete"]
    .filter(method => typeof maintenanceBinding?.[method] !== "function");
  const isolated = Boolean(ordinaryBinding && maintenanceBinding && ordinaryBinding !== maintenanceBinding);
  return Object.freeze({
    ok: ordinaryMissingMethods.length === 0
      && maintenanceMissingMethods.length === 0
      && isolated,
    contractVersion: routeIqRetentionMaintenanceRuntimeContractVersion,
    deletionRuntimeVersion: routeIqRetentionDeletionRuntimeVersion,
    ordinaryBindingName: routeIqFieldSessionStoreBinding,
    maintenanceBindingName: routeIqRetentionMaintenanceStoreBinding,
    ordinaryMissingMethods: Object.freeze(ordinaryMissingMethods),
    maintenanceMissingMethods: Object.freeze(maintenanceMissingMethods),
    isolated,
    schedulerConfigured: false,
    routeConfigured: false,
    productionDeploymentAuthorized: false
  });
}

export function createRouteIqRetentionMaintenanceStore(env = {}) {
  const validation = validateRouteIqRetentionMaintenanceBindings(env);
  if (!validation.ok) {
    fail(
      validation.isolated
        ? "route_iq_retention_maintenance_binding_invalid"
        : "route_iq_retention_maintenance_binding_not_isolated",
      "A separate delete-capable retention-maintenance binding is required.",
      {
        ordinaryMissingMethodCount: validation.ordinaryMissingMethods.length,
        maintenanceMissingMethodCount: validation.maintenanceMissingMethods.length,
        isolated: validation.isolated
      }
    );
  }
  const binding = env[routeIqRetentionMaintenanceStoreBinding];
  return Object.freeze({
    bindingName: routeIqRetentionMaintenanceStoreBinding,
    retentionMaintenanceCapability: routeIqRetentionMaintenanceCapabilityVersion,
    deletionRuntimeVersion: routeIqRetentionDeletionRuntimeVersion,
    get(key) {
      return binding.get(key);
    },
    put(key, value, options) {
      return binding.put(key, value, options);
    },
    list(options) {
      return binding.list(options);
    },
    delete(key) {
      return binding.delete(key);
    }
  });
}
