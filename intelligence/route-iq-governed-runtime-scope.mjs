import {
  validateRouteIqWorkspaceConfigurationRegistry
} from "../administration/contracts/route-iq-workspace-configuration-v2.mjs";

export const routeIqGovernedRuntimeScopeVersion = "route-iq-governed-runtime-scope-v1";
export const routeIqGovernedBusinessAdmissionVersion = "route-iq-governed-business-admission-v2";

export const routeIqGovernedRuntimeAuthorizations = Object.freeze({
  businessHoursEligibility: "business_hours_eligibility",
  continuousRouteReplenishment: "continuous_adaptive_route_replenishment"
});

const authorizedScopes = new WeakSet();
const scopeMetadata = new WeakMap();
const authorizedScopesByWorkspace = new Map();
const opaqueIdentifierPattern = /^[a-z][a-z0-9_]{2,127}$/;
const sha256Pattern = /^[a-f0-9]{64}$/;

function cleanIdentifier(value, label) {
  const normalized = String(value ?? "").trim();
  if (!opaqueIdentifierPattern.test(normalized)) {
    throw new Error(`Governed Route IQ ${label} is missing or invalid.`);
  }
  return normalized;
}

function cleanSha256(value, label) {
  const normalized = String(value ?? "").trim();
  if (!sha256Pattern.test(normalized)) {
    throw new Error(`Governed Route IQ ${label} is missing or invalid.`);
  }
  return normalized;
}

function exactAuthorizations(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map(value => String(value ?? "").trim()).filter(Boolean))].sort();
}

function expectedAuthorizations() {
  return Object.values(routeIqGovernedRuntimeAuthorizations).sort();
}

function registerScope(scope, metadata) {
  authorizedScopes.add(scope);
  scopeMetadata.set(scope, metadata);
  if (!authorizedScopesByWorkspace.has(scope.workspaceId)) {
    authorizedScopesByWorkspace.set(scope.workspaceId, new Map());
  }
  authorizedScopesByWorkspace.get(scope.workspaceId).set(scope.operatingProfileId, scope);
  return scope;
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
  const required = expectedAuthorizations();
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

function expectedClassification(workspace) {
  if (workspace.lifecycle === "founder_research") return "FOUNDER_FIELD_RESEARCH";
  if (workspace.lifecycle === "synthetic_validation_only") return "SYNTHETIC_NONCANONICAL";
  if (workspace.lifecycle === "active_customer") return "CUSTOMER_GOVERNED_DATA";
  throw new Error("Governed Route IQ workspace lifecycle is not eligible for Intelligence admission.");
}

function assertDarkSafety(registry) {
  if (registry?.schemaVersion !== "route-iq-workspace-configuration-v2"
    || registry?.authority !== "prometheus_administration"
    || registry?.safety?.collection !== "OFF"
    || registry?.safety?.activeCohorts !== 0
    || registry?.safety?.recommendationInfluence !== "OFF") {
    throw new Error("Governed Route IQ Administration registry is invalid or its safety boundary is not dark.");
  }
}

function assertFallbackPolicy(workspace) {
  if (workspace?.fallbackPolicy?.mode !== "FAIL_CLOSED"
    || workspace.fallbackPolicy.demoCatalogAllowed !== false
    || workspace.fallbackPolicy.embeddedBusinessCatalogAllowed !== false
    || workspace.fallbackPolicy.crossWorkspaceFallbackAllowed !== false) {
    throw new Error("Governed Route IQ workspace permits an unauthorized business fallback.");
  }
}

function resolveManifest(manifestRegistry, workspaceId) {
  if (manifestRegistry?.schemaVersion !== "route-iq-workspace-business-artifact-manifest-v1"
    || manifestRegistry?.fallbackPolicy !== "FAIL_CLOSED_NO_DEMO_OR_CROSS_WORKSPACE_FALLBACK"
    || !Array.isArray(manifestRegistry.manifests)) {
    throw new Error("Governed Route IQ business-manifest registry is invalid.");
  }
  const matches = manifestRegistry.manifests.filter(item => item?.workspaceId === workspaceId);
  if (matches.length !== 1) {
    throw new Error("Governed Route IQ workspace must have exactly one canonical business manifest.");
  }
  return matches[0];
}

function assertWorkspaceActivation(workspace, options) {
  if (workspace.lifecycle === "founder_research" && options.allowFounderResearch !== true) {
    throw new Error("Governed Route IQ Founder-research workspace requires an explicit non-production admission.");
  }
  if (workspace.lifecycle === "synthetic_validation_only" && options.allowSynthetic !== true) {
    throw new Error("Governed Route IQ synthetic workspace is not available outside validation.");
  }
  if (workspace.lifecycle === "active_customer" && workspace.admission?.productionAuthorized !== true) {
    throw new Error("Governed Route IQ customer workspace is not production authorized.");
  }
}

function candidateIdentity(candidate, identityField) {
  if (identityField === "google_place_id") {
    return String(candidate?.googlePlaceId ?? candidate?.google_place_id ?? "").trim();
  }
  if (identityField === "recordId") {
    return String(candidate?.recordId ?? "").trim();
  }
  return "";
}

export function createGovernedRouteRuntimeScopeFromConfiguration({
  workspaceRegistry,
  manifestRegistry,
  workspaceId,
  operatingProfileId,
  sourceArtifactSha256,
  businessHoursArtifact,
  allowFounderResearch = false,
  allowSynthetic = false
} = {}) {
  const validatedWorkspaceRegistry = validateRouteIqWorkspaceConfigurationRegistry(workspaceRegistry);
  assertDarkSafety(validatedWorkspaceRegistry);
  const expectedWorkspaceId = cleanIdentifier(workspaceId, "workspace identity");
  const expectedProfileId = cleanIdentifier(operatingProfileId, "operating-profile identity");
  const workspace = validatedWorkspaceRegistry.workspaces?.find(item => item?.workspaceId === expectedWorkspaceId);
  if (!workspace) throw new Error("Governed Route IQ workspace configuration is unknown.");
  if (workspace.operatingProfile?.profileId !== expectedProfileId) {
    throw new Error("Governed Route IQ workspace and operating profile do not match.");
  }
  assertWorkspaceActivation(workspace, { allowFounderResearch, allowSynthetic });
  assertFallbackPolicy(workspace);

  const manifest = resolveManifest(manifestRegistry, expectedWorkspaceId);
  const manifestId = cleanIdentifier(manifest.manifestId, "manifest identity");
  const manifestSha256 = cleanSha256(manifest.artifactSha256, "manifest artifact hash");
  const administrationConfigurationVersion = String(workspace.provenance?.configurationVersion ?? "").trim();
  const manifestConfigurationVersion = String(manifest.configurationVersion ?? "").trim();
  if (!administrationConfigurationVersion || !manifestConfigurationVersion) {
    throw new Error("Governed Route IQ configuration version provenance is incomplete.");
  }
  const approvalStateValid = workspace.lifecycle === "founder_research"
    ? ["PENDING_FOUNDER_APPROVAL", "APPROVED"].includes(manifest.approvalState)
    : workspace.lifecycle === "synthetic_validation_only"
      ? manifest.approvalState === "APPROVED_SYNTHETIC_VALIDATION"
      : manifest.approvalState === "APPROVED";
  if (manifest.manifestVersion !== "route-iq-workspace-business-artifact-manifest-v1"
    || manifest.operatingProfileId !== expectedProfileId
    || manifest.classification !== expectedClassification(workspace)
    || !approvalStateValid
    || manifest.demoFallbackAllowed !== false
    || manifest.crossWorkspaceFallbackAllowed !== false) {
    throw new Error("Governed Route IQ business manifest does not match the Administration configuration.");
  }
  if (cleanSha256(sourceArtifactSha256, "source artifact hash") !== manifestSha256) {
    throw new Error("Governed Route IQ source artifact hash does not match the canonical manifest.");
  }

  const sources = (workspace.opportunitySources || []).filter(source =>
    source?.workspaceId === expectedWorkspaceId
      && source?.profileId === expectedProfileId
      && source?.manifestId === manifestId
      && source?.artifactPath === manifest.artifactPath
  );
  if (sources.length !== 1
    || sources[0].adapterId !== "workspace_business_manifest_adapter_v1"
    || sources[0].classification !== manifest.classification
    || sources[0].manifestApprovalState !== manifest.approvalState
    || sources[0].productionUseAuthorized !== manifest.productionUseAuthorized) {
    throw new Error("Governed Route IQ business manifest is not bound to the configured opportunity source.");
  }

  if (!Array.isArray(manifest.approvedRecordIds)
    || manifest.approvedRecordCount !== manifest.approvedRecordIds.length
    || new Set(manifest.approvedRecordIds).size !== manifest.approvedRecordIds.length) {
    throw new Error("Governed Route IQ manifest approved-roster identities are invalid.");
  }
  if (manifest.approvalState === "PENDING_FOUNDER_APPROVAL" && manifest.approvedRecordIds.length !== 0) {
    throw new Error("Governed Route IQ pending manifest cannot admit business identities.");
  }
  if (!["google_place_id", "recordId"].includes(manifest.recordIdentityField)) {
    throw new Error("Governed Route IQ manifest identity field is unsupported.");
  }

  if (!businessHoursArtifact
    || businessHoursArtifact.workspaceId !== expectedWorkspaceId
    || businessHoursArtifact.operatingProfileId !== expectedProfileId
    || !Array.isArray(businessHoursArtifact.records)
    || businessHoursArtifact.records.some(record =>
      record?.workspaceId !== expectedWorkspaceId
        || record?.operatingProfileId !== expectedProfileId
    )) {
    throw new Error("Governed Route IQ business-hours artifact does not match the configured scope.");
  }

  const authorizations = expectedAuthorizations();
  const territoryIds = new Set((workspace.territories || []).filter(item => item?.active).map(item => item.territoryId));
  const approvedRecordIds = new Set(manifest.approvedRecordIds.map(value => String(value)));
  const scope = Object.freeze({
    version: routeIqGovernedRuntimeScopeVersion,
    admissionVersion: routeIqGovernedBusinessAdmissionVersion,
    workspaceId: expectedWorkspaceId,
    operatingProfileId: expectedProfileId,
    configurationVersion: administrationConfigurationVersion,
    administrationConfigurationVersion,
    manifestConfigurationVersion,
    manifestId,
    manifestVersion: manifest.manifestVersion,
    manifestArtifactSha256: manifestSha256,
    classification: manifest.classification,
    approvalState: manifest.approvalState,
    identityField: manifest.recordIdentityField,
    assetType: "business_hours",
    artifactVersion: String(businessHoursArtifact.artifactVersion ?? ""),
    sourceDatasetVersion: String(businessHoursArtifact.sourceDatasetVersion ?? ""),
    recommendationInfluence: "OFF",
    collection: "OFF",
    activeCohorts: 0,
    authorizations: Object.freeze(authorizations)
  });
  return registerScope(scope, {
    manifestAdmission: true,
    approvedRecordIds,
    territoryIds,
    opportunitySourceId: sources[0].sourceId
  });
}

export function createGovernedRouteRuntimeScopeFromBusinessHoursArtifact(artifact) {
  const provenance = assertArtifactProvenance(artifact);
  const scope = Object.freeze({
    version: routeIqGovernedRuntimeScopeVersion,
    admissionVersion: null,
    workspaceId: provenance.workspaceId,
    operatingProfileId: provenance.operatingProfileId,
    assetType: "business_hours",
    artifactVersion: String(artifact.artifactVersion ?? ""),
    sourceDatasetVersion: String(artifact.sourceDatasetVersion ?? ""),
    recommendationInfluence: "OFF",
    collection: "OFF",
    activeCohorts: 0,
    authorizations: Object.freeze([...provenance.authorizations])
  });
  return registerScope(scope, {
    manifestAdmission: false,
    approvedRecordIds: new Set(),
    territoryIds: new Set()
  });
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
  requiredAuthorization,
  requireManifestAdmission = false
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
  if (resolvedScope.workspaceId !== expectedWorkspaceId
    || resolvedScope.operatingProfileId !== expectedOperatingProfileId) {
    throw new Error("Route IQ governed runtime scope does not match the accepted workspace and operating profile.");
  }
  if (!resolvedScope.authorizations.includes(requiredAuthorization)) {
    throw new Error("Route IQ governed runtime scope does not authorize this Intelligence operation.");
  }
  if (requireManifestAdmission && scopeMetadata.get(resolvedScope)?.manifestAdmission !== true) {
    throw new Error("Route IQ governed runtime scope is not bound to a canonical approved-business manifest.");
  }
  return resolvedScope;
}

export function assertGovernedCandidateAdmission({
  governedRuntimeScope,
  candidate,
  workspaceId,
  operatingProfileId,
  territoryId
} = {}) {
  const scope = assertGovernedRouteRuntimeScope({
    workspaceId,
    operatingProfileId,
    governedRuntimeScope,
    requiredAuthorization: routeIqGovernedRuntimeAuthorizations.businessHoursEligibility,
    requireManifestAdmission: true
  });
  const metadata = scopeMetadata.get(scope);
  const expectedTerritoryId = cleanIdentifier(territoryId ?? candidate?.territoryId, "territory identity");
  if (!metadata.territoryIds.has(expectedTerritoryId)) {
    throw new Error("Route IQ candidate territory is not authorized by the workspace configuration.");
  }
  if (candidate?.workspaceId !== scope.workspaceId
    || candidate?.operatingProfileId !== scope.operatingProfileId
    || candidate?.territoryId !== expectedTerritoryId
    || candidate?.sourceManifestId !== scope.manifestId
    || candidate?.sourceManifestVersion !== scope.manifestVersion
    || candidate?.sourceArtifactSha256 !== scope.manifestArtifactSha256
    || candidate?.sourceConfigurationVersion !== scope.administrationConfigurationVersion
    || candidate?.sourceManifestConfigurationVersion !== scope.manifestConfigurationVersion
    || candidate?.sourceClassification !== scope.classification) {
    throw new Error("Route IQ candidate provenance does not match the governed workspace and manifest.");
  }
  const identity = candidateIdentity(candidate, scope.identityField);
  if (!identity || !metadata.approvedRecordIds.has(identity)) {
    throw new Error("Route IQ candidate identity is not in the canonical approved-business roster.");
  }
  return Object.freeze({
    workspaceId: scope.workspaceId,
    operatingProfileId: scope.operatingProfileId,
    territoryId: expectedTerritoryId,
    candidateIdentity: identity,
    manifestId: scope.manifestId,
    manifestVersion: scope.manifestVersion,
    manifestArtifactSha256: scope.manifestArtifactSha256,
    configurationVersion: scope.administrationConfigurationVersion,
    administrationConfigurationVersion: scope.administrationConfigurationVersion,
    manifestConfigurationVersion: scope.manifestConfigurationVersion,
    classification: scope.classification,
    opportunitySourceId: metadata.opportunitySourceId
  });
}

export function governedApprovedBusinessIdentitySet(governedRuntimeScope) {
  if (!governedRuntimeScope || !authorizedScopes.has(governedRuntimeScope)) return new Set();
  return new Set(scopeMetadata.get(governedRuntimeScope)?.approvedRecordIds || []);
}
