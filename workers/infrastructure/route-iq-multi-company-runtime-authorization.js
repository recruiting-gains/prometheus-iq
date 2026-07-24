export const ROUTE_IQ_REQUESTED_WORKSPACE_PARAMETER = "workspaceId";
export const ROUTE_IQ_ZIP_COVERAGE_VERSION = "route-iq-runtime-zip-coverage-v1";
export const ROUTE_IQ_ZIP_COVERAGE_LIMITS = Object.freeze({
  territoriesPerWorkspace: 64,
  zipCodesPerTerritory: 512
});
export const ROUTE_IQ_MULTI_COMPANY_FAILURES = Object.freeze({
  selectionInvalid: "route_iq_runtime_workspace_selection_invalid",
  projectionInvalid: "route_iq_runtime_zip_projection_invalid",
  zipUnauthorized: "route_iq_runtime_zip_unauthorized"
});

const STRICT_ID = /^[a-z][a-z0-9_]{2,127}$/u;
const CONFIGURATION_VERSION = /^v[0-9]+\.[0-9]+\.[0-9]+$/u;
const US_ZIP_CODE = /^[0-9]{5}$/u;

export class RouteIqMultiCompanyRuntimeAuthorizationError extends Error {
  constructor(code) {
    super("Route IQ runtime authorization is unavailable.");
    this.name = "RouteIqMultiCompanyRuntimeAuthorizationError";
    this.code = code;
  }
}

function fail(code) {
  throw new RouteIqMultiCompanyRuntimeAuthorizationError(code);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function strictId(value) {
  return typeof value === "string" && STRICT_ID.test(value);
}

function unique(values) {
  return new Set(values).size === values.length;
}

export function requestedRouteIqWorkspaceId(request) {
  let url;
  try {
    url = new URL(request?.url);
  } catch {
    fail(ROUTE_IQ_MULTI_COMPANY_FAILURES.selectionInvalid);
  }
  const values = url.searchParams.getAll(ROUTE_IQ_REQUESTED_WORKSPACE_PARAMETER);
  if (values.length === 0) return undefined;
  if (values.length !== 1 || !strictId(values[0])) {
    fail(ROUTE_IQ_MULTI_COMPANY_FAILURES.selectionInvalid);
  }
  return values[0];
}

export function projectRouteIqWorkspaceZipCoverage({ principal, workspaceRegistry }) {
  if (!principal?.authorized
    || !strictId(principal.workspaceId)
    || !strictId(principal.operatingProfileId)
    || !strictId(principal.userId)
    || !strictId(principal.representativeId)
    || !strictId(principal.roleId)
    || workspaceRegistry?.schemaVersion !== "route-iq-workspace-configuration-v2"
    || workspaceRegistry?.authority !== "prometheus_administration"
    || workspaceRegistry?.safety?.collection !== "OFF"
    || workspaceRegistry?.safety?.activeCohorts !== 0
    || workspaceRegistry?.safety?.recommendationInfluence !== "OFF"
    || !Array.isArray(workspaceRegistry?.workspaces)) {
    fail(ROUTE_IQ_MULTI_COMPANY_FAILURES.projectionInvalid);
  }

  const workspaces = workspaceRegistry.workspaces.filter(
    workspace => workspace?.workspaceId === principal.workspaceId
  );
  if (workspaces.length !== 1) fail(ROUTE_IQ_MULTI_COMPANY_FAILURES.projectionInvalid);
  const workspace = workspaces[0];
  if (workspace.operatingProfile?.profileId !== principal.operatingProfileId
    || workspace.provenance?.owner !== "prometheus_administration"
    || !CONFIGURATION_VERSION.test(workspace.provenance?.configurationVersion || "")
    || !Array.isArray(workspace.territories)
    || workspace.territories.length < 1
    || workspace.territories.length > ROUTE_IQ_ZIP_COVERAGE_LIMITS.territoriesPerWorkspace) {
    fail(ROUTE_IQ_MULTI_COMPANY_FAILURES.projectionInvalid);
  }

  const users = (workspace.users || []).filter(user => (
    user?.userId === principal.userId
    && user?.representativeId === principal.representativeId
    && user?.roleId === principal.roleId
    && user?.active === true
  ));
  if (users.length !== 1
    || !Array.isArray(users[0].territoryIds)
    || users[0].territoryIds.length < 1
    || !unique(users[0].territoryIds)) {
    fail(ROUTE_IQ_MULTI_COMPANY_FAILURES.projectionInvalid);
  }

  if (principal.territoryIds !== undefined
    && (!Array.isArray(principal.territoryIds)
      || !unique(principal.territoryIds)
      || principal.territoryIds.length !== users[0].territoryIds.length
      || [...principal.territoryIds].sort().some((territoryId, index) => (
        territoryId !== [...users[0].territoryIds].sort()[index]
      )))) {
    fail(ROUTE_IQ_MULTI_COMPANY_FAILURES.projectionInvalid);
  }

  const assignedTerritories = new Set(users[0].territoryIds);
  const seenTerritoryIds = new Set();
  const seenZipCodes = new Set();
  const territories = [];
  for (const territory of workspace.territories) {
    if (!strictId(territory?.territoryId)
      || seenTerritoryIds.has(territory.territoryId)
      || territory.active !== true
      || !Array.isArray(territory.zipCodes)
      || territory.zipCodes.length < 1
      || territory.zipCodes.length > ROUTE_IQ_ZIP_COVERAGE_LIMITS.zipCodesPerTerritory
      || !unique(territory.zipCodes)
      || territory.zipCodes.some(zipCode => !US_ZIP_CODE.test(zipCode))) {
      fail(ROUTE_IQ_MULTI_COMPANY_FAILURES.projectionInvalid);
    }
    seenTerritoryIds.add(territory.territoryId);
    for (const zipCode of territory.zipCodes) {
      if (seenZipCodes.has(zipCode)) fail(ROUTE_IQ_MULTI_COMPANY_FAILURES.projectionInvalid);
      seenZipCodes.add(zipCode);
    }
    if (assignedTerritories.has(territory.territoryId)) {
      territories.push({
        territoryId: territory.territoryId,
        zipCodes: [...territory.zipCodes].sort()
      });
    }
  }
  if (territories.length !== assignedTerritories.size
    || territories.some(territory => !assignedTerritories.has(territory.territoryId))) {
    fail(ROUTE_IQ_MULTI_COMPANY_FAILURES.projectionInvalid);
  }

  territories.sort((left, right) => left.territoryId.localeCompare(right.territoryId));
  const territoryIds = territories.map(territory => territory.territoryId);
  const zipCodes = territories.flatMap(territory => territory.zipCodes).sort();
  return deepFreeze({
    contractVersion: ROUTE_IQ_ZIP_COVERAGE_VERSION,
    authority: "prometheus_administration_projected_by_infrastructure",
    configurationVersion: workspace.provenance.configurationVersion,
    workspaceId: principal.workspaceId,
    operatingProfileId: principal.operatingProfileId,
    userId: principal.userId,
    representativeId: principal.representativeId,
    territoryIds,
    zipCodes,
    territories
  });
}

export function assertRouteIqRuntimeZipAuthorization(projection, input) {
  if (!projection
    || projection.contractVersion !== ROUTE_IQ_ZIP_COVERAGE_VERSION
    || !input
    || Object.keys(input).sort().join(",") !== "territoryId,workspaceId,zipCode"
    || input.workspaceId !== projection.workspaceId
    || !strictId(input.territoryId)
    || !US_ZIP_CODE.test(input.zipCode || "")) {
    fail(ROUTE_IQ_MULTI_COMPANY_FAILURES.zipUnauthorized);
  }
  const territory = projection.territories.find(
    candidate => candidate.territoryId === input.territoryId
  );
  if (!territory || !territory.zipCodes.includes(input.zipCode)) {
    fail(ROUTE_IQ_MULTI_COMPANY_FAILURES.zipUnauthorized);
  }
  return true;
}
