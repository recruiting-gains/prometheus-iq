import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  authorizeConfiguredUserForZipCoverageFromRegistry,
  authorizeConfiguredUserFromRegistry,
  authorizeFounderWorkspaceAccessFromRegistry,
  resolveTerritoryZipCoverageFromRegistry,
  resolveAdmittedWorkspaceConfigurationFromRegistry,
  validateRouteIqWorkspaceConfigurationRegistry
} from "./route-iq-workspace-configuration-v2-validation.mjs";

export {
  ROUTE_IQ_FITNESS_WORKSPACE_ID,
  ROUTE_IQ_MAX_COMPANIES,
  ROUTE_IQ_MAX_NAMED_USERS,
  ROUTE_IQ_SYNTHETIC_OUTSIDE_SALES_WORKSPACE_ID,
  ROUTE_IQ_TERRITORY_ZIP_COVERAGE_VERSION,
  ROUTE_IQ_WORKSPACE_CONFIGURATION_AUTHORITY,
  ROUTE_IQ_WORKSPACE_CONFIGURATION_SCHEMA_VERSION,
  RouteIqWorkspaceConfigurationError,
  validateRouteIqWorkspaceConfigurationRegistry
} from "./route-iq-workspace-configuration-v2-validation.mjs";

const DEFAULT_REGISTRY_PATH = resolve(
  import.meta.dirname,
  "../workspace-configurations/route-iq-cross-industry-workspaces-v2.json"
);

export function loadRouteIqWorkspaceConfigurationRegistry(path = DEFAULT_REGISTRY_PATH) {
  return validateRouteIqWorkspaceConfigurationRegistry(JSON.parse(readFileSync(path, "utf8")));
}

export function resolveAdmittedWorkspaceConfiguration(workspaceId, options = {}) {
  return resolveAdmittedWorkspaceConfigurationFromRegistry(
    workspaceId,
    options.registry || loadRouteIqWorkspaceConfigurationRegistry(),
    options
  );
}

export function authorizeConfiguredUser(input, options = {}) {
  return authorizeConfiguredUserFromRegistry(
    input,
    options.registry || loadRouteIqWorkspaceConfigurationRegistry()
  );
}

export function resolveTerritoryZipCoverage(input, options = {}) {
  return resolveTerritoryZipCoverageFromRegistry(
    input,
    options.registry || loadRouteIqWorkspaceConfigurationRegistry()
  );
}

export function authorizeConfiguredUserForZipCoverage(input, options = {}) {
  return authorizeConfiguredUserForZipCoverageFromRegistry(
    input,
    options.registry || loadRouteIqWorkspaceConfigurationRegistry()
  );
}

export function authorizeFounderWorkspaceAccess(input, options = {}) {
  return authorizeFounderWorkspaceAccessFromRegistry(
    input,
    options.registry || loadRouteIqWorkspaceConfigurationRegistry()
  );
}
