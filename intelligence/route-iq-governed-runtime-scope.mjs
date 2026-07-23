export const routeIqGovernedRuntimeScopeVersion = "route-iq-governed-runtime-scope-v1";

export const routeIqGovernedRuntimeAuthorizations = Object.freeze({
  businessHoursEligibility: "business_hours_eligibility",
  continuousRouteReplenishment: "continuous_adaptive_route_replenishment"
});

const authorizedScopes = new WeakSet();
const authorizedScopesByWorkspace = new Map();
const opaqueIdentifierPattern = /^[a-z0-9](?:[a-z0-9_-]{0,78}[a-z0-9])?$/;

function cleanIdentifier(value, label) {
  const normalized = String(value ?? "").trim();
  if (!opaqueIdentifierPattern.test(normalized)) {
    throw new Error(`Governed Route IQ ${label} is missing or invalid.`);
  }
  return normalized;
}

function exactAuthorizations(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map(value => String(value ?? "").trim()).filter(Boolean))].sort();
}

function assertArtifactProvenance(artifact) {
  const declaration = artifact?.routeIqRuntimeScope;
  if (!declaration || typeof declaration !== "object" || Array.isArray(declaration)) {
    throw new Error("Governed Route IQ runtime-scope provenance is missing.");
  }
  if (declaration.version !== routeIqGovernedRuntimeScopeVersion) {
    throw new Error("Governed Route IQ runtime-scope version is invalid.");
  }
  if (declaration.assetType !== "business_hours") {
    throw new Error("Governed Route IQ runtime asset type is invalid.");
  }
  if (declaration.authority !== "server_governed_runtime_asset") {
    throw new Error("Governed Route IQ runtime authority is invalid.");
  }
  if (declaration.workspaceBound !== true || declaration.operatingProfileBound !== true) {
    throw new Error("Governed Route IQ runtime scope is not fully provenance-bound.");
  }
  const workspaceId = cleanIdentifier(declaration.workspaceId, "workspace identity");
  const operatingProfileId = cleanIdentifier(declaration.operatingProfileId, "operating-profile identity");
  if (artifact.workspaceId !== workspaceId || artifact.operatingProfileId !== operatingProfileId) {
    throw new Error("Governed Route IQ runtime asset scope does not match its provenance declaration.");
  }
  const authorizations = exactAuthorizations(declaration.authorizations);
  const required = Object.values(routeIqGovernedRuntimeAuthorizations).sort();
  if (authorizations.length !== required.length || authorizations.some((value, index) => value !== required[index])) {
    throw new Error("Governed Route IQ runtime authorizations are incomplete or invalid.");
  }
  for (const record of Array.isArray(artifact.records) ? artifact.records : []) {
    if (record?.workspaceId !== workspaceId || record?.operatingProfileId !== operatingProfileId) {
      throw new Error("Governed Route IQ runtime asset contains a cross-scope record.");
    }
  }
  return { workspaceId, operatingProfileId, authorizations };
}

export function createGovernedRouteRuntimeScopeFromBusinessHoursArtifact(artifact) {
  const provenance = assertArtifactProvenance(artifact);
  const scope = Object.freeze({
    version: routeIqGovernedRuntimeScopeVersion,
    workspaceId: provenance.workspaceId,
    operatingProfileId: provenance.operatingProfileId,
    assetType: "business_hours",
    artifactVersion: String(artifact.artifactVersion ?? ""),
    sourceDatasetVersion: String(artifact.sourceDatasetVersion ?? ""),
    authorizations: Object.freeze([...provenance.authorizations])
  });
  authorizedScopes.add(scope);
  if (!authorizedScopesByWorkspace.has(scope.workspaceId)) {
    authorizedScopesByWorkspace.set(scope.workspaceId, new Map());
  }
  authorizedScopesByWorkspace.get(scope.workspaceId).set(scope.operatingProfileId, scope);
  return scope;
}

export function resolveGovernedRouteRuntimeScope(workspaceId, operatingProfileId = "") {
  const expectedWorkspaceId = cleanIdentifier(workspaceId, "workspace identity");
  const profiles = authorizedScopesByWorkspace.get(expectedWorkspaceId);
  if (!profiles) return null;
  if (operatingProfileId) {
    const expectedOperatingProfileId = cleanIdentifier(operatingProfileId, "operating-profile identity");
    return profiles.get(expectedOperatingProfileId) || null;
  }
  return profiles.size === 1 ? profiles.values().next().value : null;
}

export function assertGovernedRouteRuntimeScope({
  workspaceId,
  operatingProfileId,
  governedRuntimeScope,
  requiredAuthorization
} = {}) {
  const expectedWorkspaceId = cleanIdentifier(workspaceId, "workspace identity");
  const resolvedScope = governedRuntimeScope || resolveGovernedRouteRuntimeScope(expectedWorkspaceId, operatingProfileId);
  if (!resolvedScope || !authorizedScopes.has(resolvedScope)) {
    throw new Error("Route replenishment is not authorized: governed runtime scope is missing or unauthenticated.");
  }
  const expectedOperatingProfileId = cleanIdentifier(
    operatingProfileId || resolvedScope.operatingProfileId,
    "operating-profile identity"
  );
  if (
    resolvedScope.workspaceId !== expectedWorkspaceId
    || resolvedScope.operatingProfileId !== expectedOperatingProfileId
  ) {
    throw new Error("Route IQ governed runtime scope does not match the accepted workspace and operating profile.");
  }
  if (!resolvedScope.authorizations.includes(requiredAuthorization)) {
    throw new Error("Route IQ governed runtime scope does not authorize this Intelligence operation.");
  }
  return resolvedScope;
}
