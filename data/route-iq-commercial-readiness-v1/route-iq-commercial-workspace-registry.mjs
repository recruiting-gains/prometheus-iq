import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const routeIqCommercialWorkspaceSchemaVersion = "route-iq-commercial-workspace-v1";
export const routeIqCommercialWorkspaceRegistryVersion = "route-iq-commercial-workspace-registry-v1";
export const routeIqFounderResearchClassification = "FOUNDER_FIELD_RESEARCH";
export const routeIqCommercialRecommendationInfluence = "OFF";
export const routeIqCommercialProspectiveCollection = "OFF";

const repoRoot = resolve(import.meta.dirname, "../..");
const registryPath = resolve(import.meta.dirname, "route-iq-commercial-workspace-registry-v1.json");
const STRICT_ID = /^[a-z][a-z0-9_]{2,127}$/;
const PRINCIPAL_ID = /^riq_principal_[a-f0-9]{64}$/;
const ANALYSIS_PSEUDONYM = /^riq_rep_[a-f0-9]{24}$/;
const WORKSPACE_STATES = new Set([
  "active_founder_research",
  "active_customer",
  "inactive_historical",
  "synthetic_validation_only"
]);
const RELATIONSHIP_CLASSIFICATIONS = new Set([
  routeIqFounderResearchClassification,
  "CUSTOMER_PRODUCTION",
  "HISTORICAL_INACTIVE_WORKSPACE",
  "SYNTHETIC_VALIDATION_FIXTURE"
]);
const EVIDENCE_CLASSIFICATIONS = new Set([
  routeIqFounderResearchClassification,
  "CUSTOMER_GOVERNED_EVIDENCE",
  "HISTORICAL_INACTIVE_WORKSPACE",
  "SYNTHETIC_NONCANONICAL"
]);
const DEFAULT_OPERATING_PROFILES = new Set([
  "general_outside_sales",
  "fitness",
  "roofing",
  "security",
  "medical",
  "insurance",
  "solar",
  "home_services",
  "franchise_development"
]);

export class RouteIqCommercialWorkspaceError extends Error {
  constructor(message, code = "route_iq_commercial_workspace_invalid", details = {}) {
    super(message);
    this.name = "RouteIqCommercialWorkspaceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new RouteIqCommercialWorkspaceError(message, code, details);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function assertObject(value, scope) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("route_iq_commercial_workspace_structure_invalid", `${scope} must be an object.`);
  }
}

function assertExactKeys(value, keys, scope) {
  assertObject(value, scope);
  const expected = new Set(keys);
  const actual = Reflect.ownKeys(value);
  const unknown = actual.filter(key => typeof key !== "string" || !expected.has(key));
  const missing = keys.filter(key => !Object.hasOwn(value, key));
  if (unknown.length || missing.length) {
    fail("route_iq_commercial_workspace_fields_invalid", `${scope} has invalid fields.`, {
      scope,
      unknownFieldCount: unknown.length,
      missingFieldCount: missing.length
    });
  }
}

function assertId(value, scope) {
  if (typeof value !== "string" || !STRICT_ID.test(value)) {
    fail("route_iq_commercial_workspace_identifier_invalid", `${scope} must be a strict opaque identifier.`);
  }
}

function assertUnique(values, scope) {
  if (new Set(values).size !== values.length) {
    fail("route_iq_commercial_workspace_duplicate_identity", `${scope} contains duplicate identities.`);
  }
}

function validateRole(role, scope) {
  assertExactKeys(role, [
    "roleId",
    "operationalAccess",
    "founderIntelligenceAccess",
    "workspaceAdministration"
  ], scope);
  assertId(role.roleId, `${scope}.roleId`);
  for (const key of ["operationalAccess", "founderIntelligenceAccess", "workspaceAdministration"]) {
    if (typeof role[key] !== "boolean") fail("route_iq_commercial_workspace_role_invalid", `${scope}.${key} must be boolean.`);
  }
}

function validateUser(user, roles, principalIds, scope) {
  assertExactKeys(user, [
    "userId",
    "representativeId",
    "displayName",
    "roleId",
    "authenticatedPrincipalId",
    "identityMappingStatus",
    "analysisPseudonym",
    "active",
    "founderIntelligenceEligibility"
  ], scope);
  assertId(user.userId, `${scope}.userId`);
  assertId(user.representativeId, `${scope}.representativeId`);
  assertId(user.roleId, `${scope}.roleId`);
  if (!roles.has(user.roleId)) fail("route_iq_commercial_workspace_role_unknown", `${scope} references an unknown role.`);
  if (typeof user.displayName !== "string" || !user.displayName.trim() || user.displayName.length > 120) {
    fail("route_iq_commercial_workspace_display_name_invalid", `${scope}.displayName is invalid.`);
  }
  if (!ANALYSIS_PSEUDONYM.test(user.analysisPseudonym)) {
    fail("route_iq_commercial_workspace_pseudonym_invalid", `${scope}.analysisPseudonym is invalid.`);
  }
  if (user.identityMappingStatus === "exact_authenticated_identity_mapped") {
    if (!PRINCIPAL_ID.test(user.authenticatedPrincipalId || "")) {
      fail("route_iq_commercial_workspace_principal_invalid", `${scope} requires an exact authenticated principal.`);
    }
    if (principalIds.has(user.authenticatedPrincipalId)) {
      fail("route_iq_commercial_workspace_principal_duplicate", "Authenticated principals must be globally unique.");
    }
    principalIds.add(user.authenticatedPrincipalId);
  } else if (user.identityMappingStatus === "pending_exact_authenticated_identity") {
    if (user.authenticatedPrincipalId !== null) {
      fail("route_iq_commercial_workspace_pending_principal_invalid", `${scope} cannot carry a principal before mapping.`);
    }
  } else {
    fail("route_iq_commercial_workspace_principal_state_invalid", `${scope} has an invalid principal state.`);
  }
  if (typeof user.active !== "boolean" || typeof user.founderIntelligenceEligibility !== "boolean") {
    fail("route_iq_commercial_workspace_user_flags_invalid", `${scope} has invalid access flags.`);
  }
}

function validateRetention(retention, scope) {
  assertExactKeys(retention, [
    "maximumCalendarMonths",
    "customerMayShorten",
    "customerMayExpand",
    "legalHoldSupported",
    "deletionMode"
  ], scope);
  if (!Number.isInteger(retention.maximumCalendarMonths)
    || retention.maximumCalendarMonths < 1
    || retention.maximumCalendarMonths > 18
    || retention.customerMayShorten !== true
    || retention.customerMayExpand !== false
    || retention.legalHoldSupported !== true
    || retention.deletionMode !== "append_only_auditable_data_owned") {
    fail("route_iq_commercial_workspace_retention_invalid", `${scope} exceeds the governed retention boundary.`);
  }
}

function validateWorkspace(workspace, context, index) {
  const scope = `workspaces[${index}]`;
  assertExactKeys(workspace, [
    "workspaceId",
    "workspaceState",
    "normalOperationVisible",
    "productionActivationAuthorized",
    "business",
    "operatingProfileId",
    "locations",
    "territories",
    "roles",
    "users",
    "goals",
    "terminology",
    "successMeasurements",
    "retention",
    "intelligenceEligibility",
    "evidenceGovernance",
    "codexEvidence"
  ], scope);
  assertId(workspace.workspaceId, `${scope}.workspaceId`);
  assertId(workspace.operatingProfileId, `${scope}.operatingProfileId`);
  if (!context.operatingProfileIds.has(workspace.operatingProfileId)) {
    fail("route_iq_commercial_workspace_profile_unknown", `${scope} references an unknown operating profile.`);
  }
  if (!WORKSPACE_STATES.has(workspace.workspaceState)) {
    fail("route_iq_commercial_workspace_state_invalid", `${scope} has an invalid lifecycle state.`);
  }
  if (typeof workspace.normalOperationVisible !== "boolean"
    || typeof workspace.productionActivationAuthorized !== "boolean") {
    fail("route_iq_commercial_workspace_activation_invalid", `${scope} has an unauthorized production state.`);
  }

  assertExactKeys(workspace.business, [
    "name",
    "brand",
    "businessType",
    "relationshipClassification",
    "publicRelationshipClaimsAllowed"
  ], `${scope}.business`);
  assertId(workspace.business.businessType, `${scope}.business.businessType`);
  if (!RELATIONSHIP_CLASSIFICATIONS.has(workspace.business.relationshipClassification)
    || workspace.business.publicRelationshipClaimsAllowed !== false) {
    fail("route_iq_commercial_workspace_relationship_invalid", `${scope} has an invalid relationship classification.`);
  }
  assertExactKeys(workspace.business.brand, ["displayName", "primaryColor", "accentColor"], `${scope}.business.brand`);
  for (const color of [workspace.business.brand.primaryColor, workspace.business.brand.accentColor]) {
    if (!/^#[A-Fa-f0-9]{6}$/.test(color)) fail("route_iq_commercial_workspace_brand_invalid", `${scope} has an invalid brand color.`);
  }

  if (!Array.isArray(workspace.territories) || !Array.isArray(workspace.locations)) {
    fail("route_iq_commercial_workspace_location_invalid", `${scope} locations and territories must be arrays.`);
  }
  const territoryIds = workspace.territories.map((territory, territoryIndex) => {
    assertExactKeys(territory, ["territoryId", "label", "timezone", "active"], `${scope}.territories[${territoryIndex}]`);
    assertId(territory.territoryId, `${scope}.territories[${territoryIndex}].territoryId`);
    if (typeof territory.active !== "boolean" || typeof territory.timezone !== "string" || !territory.timezone) {
      fail("route_iq_commercial_workspace_territory_invalid", `${scope} has an invalid territory.`);
    }
    return territory.territoryId;
  });
  assertUnique(territoryIds, `${scope}.territories`);
  const territorySet = new Set(territoryIds);
  const locationIds = workspace.locations.map((location, locationIndex) => {
    assertExactKeys(location, ["locationId", "label", "territoryIds", "active"], `${scope}.locations[${locationIndex}]`);
    assertId(location.locationId, `${scope}.locations[${locationIndex}].locationId`);
    if (!Array.isArray(location.territoryIds) || !location.territoryIds.length
      || location.territoryIds.some(id => !territorySet.has(id))
      || typeof location.active !== "boolean") {
      fail("route_iq_commercial_workspace_location_invalid", `${scope} has an invalid location.`);
    }
    return location.locationId;
  });
  assertUnique(locationIds, `${scope}.locations`);

  if (!Array.isArray(workspace.roles) || !workspace.roles.length || !Array.isArray(workspace.users)) {
    fail("route_iq_commercial_workspace_access_model_invalid", `${scope} has an invalid access model.`);
  }
  workspace.roles.forEach((role, roleIndex) => validateRole(role, `${scope}.roles[${roleIndex}]`));
  const roleIds = workspace.roles.map(role => role.roleId);
  assertUnique(roleIds, `${scope}.roles`);
  const roleSet = new Set(roleIds);
  workspace.users.forEach((user, userIndex) => validateUser(
    user,
    roleSet,
    context.principalIds,
    `${scope}.users[${userIndex}]`
  ));
  assertUnique(workspace.users.map(user => user.userId), `${scope}.users.userId`);
  assertUnique(workspace.users.map(user => user.representativeId), `${scope}.users.representativeId`);
  assertUnique(workspace.users.map(user => user.analysisPseudonym), `${scope}.users.analysisPseudonym`);

  if (!Array.isArray(workspace.goals) || !workspace.goals.length
    || !Array.isArray(workspace.successMeasurements) || !workspace.successMeasurements.length) {
    fail("route_iq_commercial_workspace_measurement_invalid", `${scope} must define goals and measurements.`);
  }
  workspace.successMeasurements.forEach((measurement, measurementIndex) => assertId(
    measurement,
    `${scope}.successMeasurements[${measurementIndex}]`
  ));
  assertExactKeys(workspace.terminology, ["target", "visit", "outcome", "success", "followUp"], `${scope}.terminology`);
  if (Object.values(workspace.terminology).some(value => typeof value !== "string" || !value.trim())) {
    fail("route_iq_commercial_workspace_terminology_invalid", `${scope} terminology is incomplete.`);
  }
  validateRetention(workspace.retention, `${scope}.retention`);

  assertExactKeys(workspace.intelligenceEligibility, [
    "governedEvidenceLearningEligible",
    "founderReadOnlyIntelligenceEligible",
    "representativeIntelligenceAccessAllowed",
    "recommendationInfluence",
    "prospectiveCollection"
  ], `${scope}.intelligenceEligibility`);
  if (workspace.intelligenceEligibility.representativeIntelligenceAccessAllowed !== false
    || workspace.intelligenceEligibility.recommendationInfluence !== routeIqCommercialRecommendationInfluence
    || workspace.intelligenceEligibility.prospectiveCollection !== routeIqCommercialProspectiveCollection) {
    fail("route_iq_commercial_workspace_intelligence_boundary_invalid", `${scope} violates intelligence boundaries.`);
  }
  assertExactKeys(workspace.evidenceGovernance, [
    "historicalEvidenceImmutable",
    "crossWorkspaceEvidenceAllowed",
    "classification"
  ], `${scope}.evidenceGovernance`);
  if (workspace.evidenceGovernance.historicalEvidenceImmutable !== true
    || workspace.evidenceGovernance.crossWorkspaceEvidenceAllowed !== false
    || !EVIDENCE_CLASSIFICATIONS.has(workspace.evidenceGovernance.classification)) {
    fail("route_iq_commercial_workspace_evidence_boundary_invalid", `${scope} violates evidence boundaries.`);
  }
  assertExactKeys(workspace.codexEvidence, [
    "bundleAuthorized",
    "canonicalDatabase",
    "allowlistProjectionOnly",
    "sourceSessionIds"
  ], `${scope}.codexEvidence`);
  if (workspace.codexEvidence.canonicalDatabase !== false
    || workspace.codexEvidence.allowlistProjectionOnly !== true
    || !Array.isArray(workspace.codexEvidence.sourceSessionIds)) {
    fail("route_iq_commercial_workspace_codex_boundary_invalid", `${scope} has an invalid Codex evidence boundary.`);
  }

  if (workspace.workspaceState === "inactive_historical"
    && (workspace.normalOperationVisible
      || workspace.users.length
      || workspace.intelligenceEligibility.governedEvidenceLearningEligible
      || workspace.intelligenceEligibility.founderReadOnlyIntelligenceEligible
      || workspace.codexEvidence.bundleAuthorized)) {
    fail("route_iq_commercial_workspace_historical_visibility_invalid", `${scope} exposes an inactive workspace.`);
  }
  if (workspace.workspaceState === "synthetic_validation_only"
    && (workspace.normalOperationVisible || workspace.productionActivationAuthorized
      || workspace.evidenceGovernance.classification !== "SYNTHETIC_NONCANONICAL")) {
    fail("route_iq_commercial_workspace_synthetic_boundary_invalid", `${scope} exposes a synthetic workspace.`);
  }
  if (workspace.workspaceState === "active_customer") {
    const activeUsers = workspace.users.filter(user => user.active);
    const rolesById = new Map(workspace.roles.map(role => [role.roleId, role]));
    if (!workspace.normalOperationVisible
      || workspace.productionActivationAuthorized !== true
      || workspace.business.relationshipClassification !== "CUSTOMER_PRODUCTION"
      || workspace.evidenceGovernance.classification !== "CUSTOMER_GOVERNED_EVIDENCE"
      || activeUsers.length < 1
      || activeUsers.some(user => user.identityMappingStatus !== "exact_authenticated_identity_mapped")
      || activeUsers.some(user => user.founderIntelligenceEligibility)
      || activeUsers.some(user => rolesById.get(user.roleId)?.operationalAccess !== true)
      || activeUsers.some(user => rolesById.get(user.roleId)?.founderIntelligenceAccess !== false)
      || workspace.intelligenceEligibility.founderReadOnlyIntelligenceEligible) {
      fail("route_iq_commercial_workspace_customer_activation_invalid", `${scope} is not a governed customer workspace.`);
    }
  } else if (workspace.productionActivationAuthorized !== false) {
    fail("route_iq_commercial_workspace_activation_invalid", `${scope} has an unauthorized production state.`);
  }
}

export function validateCommercialWorkspaceRegistry(registry, options = {}) {
  assertExactKeys(registry, [
    "schemaVersion",
    "registryVersion",
    "product",
    "activeProduct",
    "recommendationInfluence",
    "prospectiveCollection",
    "workspaces"
  ], "registry");
  if (registry.schemaVersion !== routeIqCommercialWorkspaceSchemaVersion
    || registry.registryVersion !== routeIqCommercialWorkspaceRegistryVersion
    || registry.product !== "route_iq"
    || registry.activeProduct !== true
    || registry.recommendationInfluence !== routeIqCommercialRecommendationInfluence
    || registry.prospectiveCollection !== routeIqCommercialProspectiveCollection
    || !Array.isArray(registry.workspaces)
    || !registry.workspaces.length) {
    fail("route_iq_commercial_workspace_registry_invalid", "Commercial workspace registry header is invalid.");
  }
  const operatingProfileIds = new Set(options.operatingProfileIds || DEFAULT_OPERATING_PROFILES);
  const context = { operatingProfileIds, principalIds: new Set() };
  registry.workspaces.forEach((workspace, index) => validateWorkspace(workspace, context, index));
  assertUnique(registry.workspaces.map(workspace => workspace.workspaceId), "registry.workspaces");

  if (options.requireCanonicalProof !== false) {
    const fitness = registry.workspaces.find(workspace => workspace.workspaceId === "fitness_connection");
    const synthetic = registry.workspaces.find(workspace => workspace.workspaceId === "northstar_outside_sales_synthetic");
    if (!fitness
      || fitness.business.relationshipClassification !== routeIqFounderResearchClassification
      || fitness.evidenceGovernance.classification !== routeIqFounderResearchClassification
      || fitness.workspaceState !== "active_founder_research"
      || fitness.operatingProfileId !== "fitness") {
      fail("route_iq_commercial_workspace_fitness_boundary_invalid", "Fitness Connection must remain Founder research.");
    }
    if (!synthetic
      || synthetic.operatingProfileId !== "general_outside_sales"
      || synthetic.business.businessType !== "general_outside_sales"
      || synthetic.workspaceState !== "synthetic_validation_only") {
      fail("route_iq_commercial_workspace_configuration_proof_missing", "Synthetic non-fitness configuration proof is missing.");
    }
  }
  return deepFreeze(clone(registry));
}

export function loadCommercialWorkspaceRegistry(options = {}) {
  const registry = JSON.parse(readFileSync(options.path || registryPath, "utf8"));
  return validateCommercialWorkspaceRegistry(registry, options);
}

export function listNormalRouteIqWorkspaces(registry = loadCommercialWorkspaceRegistry()) {
  return registry.workspaces
    .filter(workspace => workspace.normalOperationVisible
      && ["active_founder_research", "active_customer"].includes(workspace.workspaceState))
    .map(workspace => ({
      workspaceId: workspace.workspaceId,
      operatingProfileId: workspace.operatingProfileId,
      displayName: workspace.business.brand.displayName,
      classification: workspace.evidenceGovernance.classification
    }));
}

export function getCommercialWorkspace(workspaceId, options = {}) {
  const registry = options.registry || loadCommercialWorkspaceRegistry();
  const workspace = registry.workspaces.find(item => item.workspaceId === workspaceId);
  if (!workspace) fail("route_iq_commercial_workspace_unknown", "Workspace is not registered.");
  if (workspace.workspaceState === "inactive_historical" && options.includeInactive !== true) {
    fail("route_iq_commercial_workspace_inactive", "Workspace is not available for normal Route IQ operation.");
  }
  if (workspace.workspaceState === "synthetic_validation_only" && options.includeSynthetic !== true) {
    fail("route_iq_commercial_workspace_synthetic_only", "Synthetic workspace is not available in production.");
  }
  return deepFreeze(clone(workspace));
}

function resolveAuthenticatedUser(input, requiredCapability, registry, options = {}) {
  assertExactKeys(input, ["workspaceId", "operatingProfileId", "authenticatedPrincipalId"], "authorizationInput");
  assertId(input.workspaceId, "authorizationInput.workspaceId");
  assertId(input.operatingProfileId, "authorizationInput.operatingProfileId");
  if (!PRINCIPAL_ID.test(input.authenticatedPrincipalId || "")) {
    fail("route_iq_commercial_workspace_authentication_required", "Exact authenticated principal identity is required.");
  }
  const workspace = getCommercialWorkspace(input.workspaceId, {
    registry,
    includeInactive: options.includeInactive === true,
    includeSynthetic: options.includeSynthetic === true
  });
  if (workspace.operatingProfileId !== input.operatingProfileId) {
    fail("route_iq_commercial_workspace_profile_mismatch", "Operating profile does not match the workspace.");
  }
  const user = workspace.users.find(candidate => candidate.authenticatedPrincipalId === input.authenticatedPrincipalId);
  if (!user || !user.active || user.identityMappingStatus !== "exact_authenticated_identity_mapped") {
    fail("route_iq_commercial_workspace_principal_unauthorized", "Authenticated principal is not authorized in this workspace.");
  }
  const role = workspace.roles.find(candidate => candidate.roleId === user.roleId);
  if (!role?.[requiredCapability]) {
    fail("route_iq_commercial_workspace_capability_unauthorized", "Authenticated principal lacks the required capability.");
  }
  return { workspace, user, role };
}

export function authorizeRouteIqOperationalAccess(input, options = {}) {
  const registry = options.registry || loadCommercialWorkspaceRegistry();
  const { workspace, user, role } = resolveAuthenticatedUser(input, "operationalAccess", registry, options);
  return deepFreeze({
    authorized: true,
    workspaceId: workspace.workspaceId,
    operatingProfileId: workspace.operatingProfileId,
    userId: user.userId,
    representativeId: user.representativeId,
    roleId: role.roleId,
    authenticationBasis: "exact_immutable_authenticated_principal_id"
  });
}

export function authorizeFounderIntelligenceAccess(input, options = {}) {
  const registry = options.registry || loadCommercialWorkspaceRegistry();
  const { workspace, user, role } = resolveAuthenticatedUser(input, "founderIntelligenceAccess", registry, options);
  if (workspace.intelligenceEligibility.founderReadOnlyIntelligenceEligible !== true
    || workspace.intelligenceEligibility.representativeIntelligenceAccessAllowed !== false
    || user.founderIntelligenceEligibility !== true) {
    fail("route_iq_commercial_workspace_founder_intelligence_unauthorized", "Founder intelligence access is not authorized.");
  }
  return deepFreeze({
    authorized: true,
    accessMode: "founder_read_only",
    workspaceId: workspace.workspaceId,
    operatingProfileId: workspace.operatingProfileId,
    userId: user.userId,
    representativeId: user.representativeId,
    roleId: role.roleId,
    authenticationBasis: "exact_immutable_authenticated_principal_id",
    recommendationInfluence: routeIqCommercialRecommendationInfluence
  });
}

function fixturePrincipal(workspaceIndex, userIndex) {
  return `riq_principal_${sha256(`commercial-isolation:${workspaceIndex}:${userIndex}`)}`;
}

function fixturePseudonym(workspaceIndex, userIndex) {
  return `riq_rep_${sha256(`commercial-analysis:${workspaceIndex}:${userIndex}`).slice(0, 24)}`;
}

export function createCommercialIsolationFixtureRegistry({ workspaceCount = 10, usersPerWorkspace = 10 } = {}) {
  if (!Number.isInteger(workspaceCount) || workspaceCount < 1 || workspaceCount > 100
    || !Number.isInteger(usersPerWorkspace) || usersPerWorkspace < 1 || usersPerWorkspace > 1000) {
    fail("route_iq_commercial_workspace_fixture_size_invalid", "Isolation fixture size is invalid.");
  }
  const workspaces = Array.from({ length: workspaceCount }, (_, workspaceOffset) => {
    const workspaceNumber = workspaceOffset + 1;
    const workspaceId = `synthetic_business_${String(workspaceNumber).padStart(2, "0")}`;
    const territoryId = `synthetic_territory_${String(workspaceNumber).padStart(2, "0")}`;
    return {
      workspaceId,
      workspaceState: "synthetic_validation_only",
      normalOperationVisible: false,
      productionActivationAuthorized: false,
      business: {
        name: `Synthetic Business ${String(workspaceNumber).padStart(2, "0")}`,
        brand: {
          displayName: `Synthetic Business ${String(workspaceNumber).padStart(2, "0")}`,
          primaryColor: "#1F2937",
          accentColor: "#0F766E"
        },
        businessType: "general_outside_sales",
        relationshipClassification: "SYNTHETIC_VALIDATION_FIXTURE",
        publicRelationshipClaimsAllowed: false
      },
      operatingProfileId: "general_outside_sales",
      locations: [{
        locationId: `synthetic_location_${String(workspaceNumber).padStart(2, "0")}`,
        label: `Synthetic Location ${String(workspaceNumber).padStart(2, "0")}`,
        territoryIds: [territoryId],
        active: true
      }],
      territories: [{
        territoryId,
        label: `Synthetic Territory ${String(workspaceNumber).padStart(2, "0")}`,
        timezone: "America/Chicago",
        active: true
      }],
      roles: [{
        roleId: "synthetic_representative",
        operationalAccess: true,
        founderIntelligenceAccess: false,
        workspaceAdministration: false
      }],
      users: Array.from({ length: usersPerWorkspace }, (_, userOffset) => {
        const userNumber = userOffset + 1;
        return {
          userId: `synthetic_user_${String(userNumber).padStart(3, "0")}`,
          representativeId: `synthetic_rep_${String(userNumber).padStart(3, "0")}`,
          displayName: `Synthetic User ${String(userNumber).padStart(3, "0")}`,
          roleId: "synthetic_representative",
          authenticatedPrincipalId: fixturePrincipal(workspaceNumber, userNumber),
          identityMappingStatus: "exact_authenticated_identity_mapped",
          analysisPseudonym: fixturePseudonym(workspaceNumber, userNumber),
          active: true,
          founderIntelligenceEligibility: false
        };
      }),
      goals: ["Validate configuration-driven workspace isolation"],
      terminology: {
        target: "prospect",
        visit: "field visit",
        outcome: "visit outcome",
        success: "qualified opportunity",
        followUp: "follow-up"
      },
      successMeasurements: ["visits_completed", "qualified_opportunities"],
      retention: {
        maximumCalendarMonths: 18,
        customerMayShorten: true,
        customerMayExpand: false,
        legalHoldSupported: true,
        deletionMode: "append_only_auditable_data_owned"
      },
      intelligenceEligibility: {
        governedEvidenceLearningEligible: false,
        founderReadOnlyIntelligenceEligible: false,
        representativeIntelligenceAccessAllowed: false,
        recommendationInfluence: "OFF",
        prospectiveCollection: "OFF"
      },
      evidenceGovernance: {
        historicalEvidenceImmutable: true,
        crossWorkspaceEvidenceAllowed: false,
        classification: "SYNTHETIC_NONCANONICAL"
      },
      codexEvidence: {
        bundleAuthorized: false,
        canonicalDatabase: false,
        allowlistProjectionOnly: true,
        sourceSessionIds: []
      }
    };
  });
  return validateCommercialWorkspaceRegistry({
    schemaVersion: routeIqCommercialWorkspaceSchemaVersion,
    registryVersion: routeIqCommercialWorkspaceRegistryVersion,
    product: "route_iq",
    activeProduct: true,
    recommendationInfluence: "OFF",
    prospectiveCollection: "OFF",
    workspaces
  }, { requireCanonicalProof: false });
}
