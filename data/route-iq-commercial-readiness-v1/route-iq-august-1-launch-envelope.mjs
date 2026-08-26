export const routeIqAugust1LaunchEnvelopeVersion = "route-iq-august-1-launch-envelope-v1";
export const routeIqAugust1LaunchMaximumCompanies = 2;
export const routeIqAugust1LaunchMaximumNamedUsers = 40;
export const routeIqAugust1LaunchRoles = Object.freeze([
  "customer_owner",
  "customer_manager",
  "customer_representative"
]);
export const routeIqAugust1FounderAccessContractVersion = "route-iq-founder-multi-company-access-v1";
export const routeIqAugust1FounderAccessRole = "founder_multi_company_read_only";
export const routeIqAugust1FounderAccessMode = "EXPLICIT_WORKSPACE_SELECTION_ONLY";
export const routeIqAugust1PrincipalRoleByRoleId = Object.freeze({
  [routeIqAugust1FounderAccessRole]: "founder",
  customer_owner: "customer_owner",
  customer_manager: "manager",
  customer_representative: "representative"
});

const ID_PATTERN = /^[a-z][a-z0-9_]{2,127}$/u;
const PRINCIPAL_PATTERN = /^riq_principal_[a-f0-9]{64}$/u;
const ASSET_PATH_PATTERN = /^\/data\/[a-z0-9][a-z0-9_./-]{1,238}\.json$/u;
const ROLE_SET = new Set(routeIqAugust1LaunchRoles);

export class RouteIqAugust1LaunchEnvelopeError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "RouteIqAugust1LaunchEnvelopeError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new RouteIqAugust1LaunchEnvelopeError(code, message);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function freeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(freeze);
  return value;
}

function exactKeys(value, keys, path) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("route_iq_launch_structure_invalid", `${path} must be an object.`);
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    fail("route_iq_launch_fields_invalid", `${path} has invalid fields.`);
  }
}

function id(value, path) {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) {
    fail("route_iq_launch_identifier_invalid", `${path} must be an opaque identifier.`);
  }
  return value;
}

function canonicalTime(value, path) {
  if (typeof value !== "string") fail("route_iq_launch_window_invalid", `${path} is invalid.`);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    fail("route_iq_launch_window_invalid", `${path} is invalid.`);
  }
  return parsed;
}

function validateRuntimeAssets(value, path) {
  exactKeys(value, ["fullPool", "activePool", "quarantinePool", "businessHours"], path);
  const normalized = {};
  for (const [key, assetPath] of Object.entries(value)) {
    if (typeof assetPath !== "string"
      || !ASSET_PATH_PATTERN.test(assetPath)
      || assetPath.includes("..")
      || assetPath.includes("//")) {
      fail("route_iq_launch_asset_path_invalid", `${path}.${key} is invalid.`);
    }
    normalized[key] = assetPath;
  }
  return normalized;
}

function validateHeader(envelope) {
  const fields = [
    "version",
    "state",
    "classification",
    "issuedAt",
    "expiresAt",
    "limits",
    "safety",
    "workspaceAdmissions"
  ];
  if (Object.hasOwn(envelope || {}, "founderAccess")) fields.push("founderAccess");
  exactKeys(envelope, fields, "launchEnvelope");
  if (envelope.version !== routeIqAugust1LaunchEnvelopeVersion
    || !["OFF", "ACTIVE"].includes(envelope.state)
    || envelope.classification !== "PRODUCTION_ACTIVATION") {
    fail("route_iq_launch_header_invalid", "Launch envelope header is invalid.");
  }
  exactKeys(envelope.limits, ["maximumCompanies", "maximumNamedUsers"], "launchEnvelope.limits");
  if (envelope.limits.maximumCompanies !== routeIqAugust1LaunchMaximumCompanies
    || envelope.limits.maximumNamedUsers !== routeIqAugust1LaunchMaximumNamedUsers) {
    fail("route_iq_launch_limits_invalid", "Launch limits are invalid.");
  }
  exactKeys(envelope.safety, [
    "prelaunchHumanAcceptanceTester",
    "externalHumanTesting",
    "anthonyMapped",
    "prospectiveCollection",
    "activeCohorts",
    "recommendationInfluence"
  ], "launchEnvelope.safety");
  if (envelope.safety.prelaunchHumanAcceptanceTester !== "cruz"
    || envelope.safety.externalHumanTesting !== false
    || envelope.safety.anthonyMapped !== false
    || envelope.safety.prospectiveCollection !== "OFF"
    || envelope.safety.activeCohorts !== 0
    || envelope.safety.recommendationInfluence !== "OFF") {
    fail("route_iq_launch_safety_invalid", "Launch safety boundaries are invalid.");
  }
  if (!Array.isArray(envelope.workspaceAdmissions)) {
    fail("route_iq_launch_admissions_invalid", "Workspace admissions must be an array.");
  }
}

function workspaceById(registry, workspaceId) {
  if (!registry || !Array.isArray(registry.workspaces)) {
    fail("route_iq_launch_registry_invalid", "Commercial workspace registry is unavailable.");
  }
  return registry.workspaces.find(workspace => workspace.workspaceId === workspaceId);
}

function governedFounderUser(registry, authenticatedPrincipalId) {
  const matches = registry.workspaces.flatMap(workspace => (workspace.users || [])
    .filter(user => user.authenticatedPrincipalId === authenticatedPrincipalId)
    .map(user => ({ user, workspace })));
  if (matches.length !== 1) {
    fail("route_iq_launch_founder_identity_invalid", "The Founder principal must have one exact governed identity anchor.");
  }
  const { user, workspace } = matches[0];
  if (user.active !== true
    || user.identityMappingStatus !== "exact_authenticated_identity_mapped"
    || user.founderIntelligenceEligibility !== true
    || user.representativeId !== "cruz"
    || !ID_PATTERN.test(user.userId || "")
    || !ID_PATTERN.test(workspace.workspaceId || "")) {
    fail("route_iq_launch_founder_identity_invalid", "The Founder principal identity anchor is not authorized.");
  }
  return { user, workspace };
}

function principalRoleFor(roleId) {
  const principalRole = routeIqAugust1PrincipalRoleByRoleId[roleId];
  if (!principalRole) {
    fail("route_iq_launch_role_unauthorized", "The mapped role has no authorized customer-PWA semantics.");
  }
  return principalRole;
}

function validateFounderAccess(value, registry, admissions, admittedPrincipalIds) {
  exactKeys(value, [
    "contractVersion",
    "identityAuthority",
    "roleId",
    "accessMode",
    "authenticatedPrincipalId",
    "authorizedWorkspaceIds"
  ], "launchEnvelope.founderAccess");
  if (value.contractVersion !== routeIqAugust1FounderAccessContractVersion
    || value.identityAuthority !== "commercial_workspace_registry_exact_principal"
    || value.roleId !== routeIqAugust1FounderAccessRole
    || value.accessMode !== routeIqAugust1FounderAccessMode
    || !PRINCIPAL_PATTERN.test(value.authenticatedPrincipalId || "")
    || !Array.isArray(value.authorizedWorkspaceIds)
    || value.authorizedWorkspaceIds.length < 1
    || value.authorizedWorkspaceIds.length > routeIqAugust1LaunchMaximumCompanies) {
    fail("route_iq_launch_founder_access_invalid", "The Founder access contract is invalid.");
  }
  if (admittedPrincipalIds.has(value.authenticatedPrincipalId)) {
    fail("route_iq_launch_founder_principal_conflated", "The Founder principal cannot be admitted as a customer user.");
  }
  governedFounderUser(registry, value.authenticatedPrincipalId);
  const admittedWorkspaceIds = new Set(admissions.map(admission => admission.workspaceId));
  const authorizedWorkspaceIds = value.authorizedWorkspaceIds.map((workspaceIdValue, index) => {
    const workspaceId = id(
      workspaceIdValue,
      `launchEnvelope.founderAccess.authorizedWorkspaceIds[${index}]`
    );
    if (!admittedWorkspaceIds.has(workspaceId)) {
      fail("route_iq_launch_founder_workspace_not_admitted", "Founder access cannot exceed admitted workspaces.");
    }
    return workspaceId;
  });
  if (new Set(authorizedWorkspaceIds).size !== authorizedWorkspaceIds.length) {
    fail("route_iq_launch_founder_workspace_duplicate", "A Founder workspace was allowlisted more than once.");
  }
  return {
    ...clone(value),
    authorizedWorkspaceIds
  };
}

export function validateRouteIqAugust1LaunchEnvelope(envelope, registry, { now = new Date() } = {}) {
  validateHeader(envelope);
  if (envelope.state === "OFF") {
    if (envelope.issuedAt !== null
      || envelope.expiresAt !== null
      || envelope.workspaceAdmissions.length !== 0
      || Object.hasOwn(envelope, "founderAccess")) {
      fail("route_iq_launch_off_state_invalid", "The OFF launch envelope cannot admit workspaces or carry an activation window.");
    }
    return freeze(clone(envelope));
  }

  if (envelope.workspaceAdmissions.length < 1
    || envelope.workspaceAdmissions.length > routeIqAugust1LaunchMaximumCompanies) {
    fail("route_iq_launch_company_limit_exceeded", "The bounded launch company limit is invalid.");
  }
  const issuedAtMs = canonicalTime(envelope.issuedAt, "launchEnvelope.issuedAt");
  const expiresAtMs = canonicalTime(envelope.expiresAt, "launchEnvelope.expiresAt");
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  if (!Number.isFinite(nowMs)
    || issuedAtMs > nowMs + 60_000
    || expiresAtMs <= nowMs
    || expiresAtMs <= issuedAtMs
    || expiresAtMs - issuedAtMs > 31 * 24 * 60 * 60 * 1000) {
    fail("route_iq_launch_window_invalid", "The bounded launch window is invalid or stale.");
  }

  const workspaceIds = new Set();
  const principalIds = new Set();
  let namedUsers = 0;
  const admissions = envelope.workspaceAdmissions.map((admission, index) => {
    const path = `launchEnvelope.workspaceAdmissions[${index}]`;
    exactKeys(admission, [
      "workspaceId",
      "operatingProfileId",
      "authorizedUserIds",
      "runtimeAssets"
    ], path);
    const workspaceId = id(admission.workspaceId, `${path}.workspaceId`);
    const operatingProfileId = id(admission.operatingProfileId, `${path}.operatingProfileId`);
    if (workspaceIds.has(workspaceId)) fail("route_iq_launch_workspace_duplicate", "A workspace was admitted more than once.");
    workspaceIds.add(workspaceId);
    const workspace = workspaceById(registry, workspaceId);
    if (!workspace
      || workspace.workspaceState !== "active_customer"
      || workspace.normalOperationVisible !== true
      || workspace.productionActivationAuthorized !== true
      || workspace.operatingProfileId !== operatingProfileId
      || workspace.business?.relationshipClassification !== "CUSTOMER_PRODUCTION"
      || workspace.evidenceGovernance?.classification !== "CUSTOMER_GOVERNED_EVIDENCE") {
      fail("route_iq_launch_workspace_not_authorized", "A workspace is not authorized for bounded customer production.");
    }
    if (!Array.isArray(admission.authorizedUserIds) || admission.authorizedUserIds.length < 1) {
      fail("route_iq_launch_user_admission_invalid", "An admitted workspace requires named users.");
    }
    const workspaceUserIds = new Set();
    const authorizedUserIds = admission.authorizedUserIds.map((userIdValue, userIndex) => {
      const userId = id(userIdValue, `${path}.authorizedUserIds[${userIndex}]`);
      if (workspaceUserIds.has(userId)) {
        fail("route_iq_launch_user_duplicate", "A named user was admitted more than once.");
      }
      workspaceUserIds.add(userId);
      const user = workspace.users?.find(candidate => candidate.userId === userId);
      if (!user
        || user.active !== true
        || user.identityMappingStatus !== "exact_authenticated_identity_mapped"
        || !PRINCIPAL_PATTERN.test(user.authenticatedPrincipalId || "")
        || !ROLE_SET.has(user.roleId)
        || user.founderIntelligenceEligibility !== false
        || user.representativeId === "anthony") {
        fail("route_iq_launch_user_not_authorized", "A named user is not authorized for bounded customer production.");
      }
      if (principalIds.has(user.authenticatedPrincipalId)) {
        fail("route_iq_launch_principal_duplicate", "An authenticated principal crosses launch scope.");
      }
      principalIds.add(user.authenticatedPrincipalId);
      namedUsers += 1;
      return userId;
    });
    return {
      workspaceId,
      operatingProfileId,
      authorizedUserIds,
      runtimeAssets: validateRuntimeAssets(admission.runtimeAssets, `${path}.runtimeAssets`)
    };
  });
  if (namedUsers > routeIqAugust1LaunchMaximumNamedUsers) {
    fail("route_iq_launch_user_limit_exceeded", "The bounded launch named-user limit was exceeded.");
  }
  const founderAccess = Object.hasOwn(envelope, "founderAccess")
    ? validateFounderAccess(envelope.founderAccess, registry, admissions, principalIds)
    : null;
  if (founderAccess) namedUsers += 1;
  if (namedUsers > routeIqAugust1LaunchMaximumNamedUsers) {
    fail("route_iq_launch_user_limit_exceeded", "The bounded launch named-user limit was exceeded.");
  }
  return freeze({
    ...clone(envelope),
    workspaceAdmissions: admissions,
    ...(founderAccess ? { founderAccess } : {}),
    verifiedCapacity: {
      companies: admissions.length,
      namedUsers
    }
  });
}

export function authorizeRouteIqAugust1LaunchPrincipal({
  envelope,
  registry,
  authenticatedPrincipalId,
  requestedWorkspaceId,
  now
}) {
  if (!PRINCIPAL_PATTERN.test(authenticatedPrincipalId || "")) {
    fail("route_iq_launch_authentication_required", "An exact authenticated principal is required.");
  }
  const launch = validateRouteIqAugust1LaunchEnvelope(envelope, registry, { now });
  if (launch.state !== "ACTIVE") fail("route_iq_launch_inactive", "Bounded customer production is inactive.");
  if (launch.founderAccess?.authenticatedPrincipalId === authenticatedPrincipalId) {
    if (requestedWorkspaceId === undefined) {
      fail("route_iq_launch_workspace_selection_required", "Founder access requires an explicit workspace selection.");
    }
    const selectedWorkspaceId = id(requestedWorkspaceId, "requestedWorkspaceId");
    if (!launch.founderAccess.authorizedWorkspaceIds.includes(selectedWorkspaceId)) {
      fail("route_iq_launch_workspace_selection_unauthorized", "The selected workspace is outside Founder access.");
    }
    const admission = launch.workspaceAdmissions.find(
      candidate => candidate.workspaceId === selectedWorkspaceId
    );
    if (!admission) {
      fail("route_iq_launch_workspace_selection_unauthorized", "The selected workspace is not admitted.");
    }
    const workspace = workspaceById(registry, selectedWorkspaceId);
    const founder = governedFounderUser(registry, authenticatedPrincipalId).user;
    return freeze({
      authorized: true,
      accessMode: "founder_explicit_workspace_read_only",
      companyId: workspace.workspaceId,
      workspaceId: workspace.workspaceId,
      workspaceLabel: workspace.business.brand.displayName,
      operatingProfileId: workspace.operatingProfileId,
      userId: founder.userId,
      representativeId: founder.representativeId,
      displayName: founder.displayName,
      roleId: routeIqAugust1FounderAccessRole,
      principalRole: principalRoleFor(routeIqAugust1FounderAccessRole),
      capabilities: {
        operateOwnRoute: false,
        readWorkspaceOperations: true,
        administerWorkspaceRoster: false,
        founderIntelligence: true,
        founderCrm: false
      },
      runtimeAssets: admission.runtimeAssets,
      expiresAt: launch.expiresAt,
      safety: {
        prospectiveCollection: "OFF",
        activeCohorts: 0,
        recommendationInfluence: "OFF"
      }
    });
  }
  for (const admission of launch.workspaceAdmissions) {
    if (requestedWorkspaceId !== undefined && admission.workspaceId !== requestedWorkspaceId) continue;
    const workspace = workspaceById(registry, admission.workspaceId);
    const user = workspace.users.find(candidate => admission.authorizedUserIds.includes(candidate.userId)
      && candidate.authenticatedPrincipalId === authenticatedPrincipalId);
    if (!user) continue;
    const role = workspace.roles.find(candidate => candidate.roleId === user.roleId);
    if (!role?.operationalAccess || role.founderIntelligenceAccess) {
      fail("route_iq_launch_role_unauthorized", "The mapped role is not authorized for customer operations.");
    }
    return freeze({
      authorized: true,
      accessMode: "customer_workspace_operational",
      companyId: workspace.workspaceId,
      workspaceId: workspace.workspaceId,
      workspaceLabel: workspace.business.brand.displayName,
      operatingProfileId: workspace.operatingProfileId,
      userId: user.userId,
      representativeId: user.representativeId,
      displayName: user.displayName,
      roleId: user.roleId,
      principalRole: principalRoleFor(user.roleId),
      capabilities: {
        operateOwnRoute: true,
        readWorkspaceOperations: ["customer_owner", "customer_manager"].includes(user.roleId),
        administerWorkspaceRoster: user.roleId === "customer_owner",
        founderIntelligence: false,
        founderCrm: false
      },
      runtimeAssets: admission.runtimeAssets,
      expiresAt: launch.expiresAt,
      safety: {
        prospectiveCollection: "OFF",
        activeCohorts: 0,
        recommendationInfluence: "OFF"
      }
    });
  }
  if (requestedWorkspaceId !== undefined) {
    fail("route_iq_launch_workspace_selection_unauthorized", "The selected workspace is outside the principal's authorization.");
  }
  fail("route_iq_launch_principal_unmapped", "The authenticated principal is not admitted to the bounded launch.");
}

export function assertRouteIqAugust1LaunchResourceAccess(principal, resource) {
  exactKeys(resource, ["workspaceId", "representativeId", "operation"], "resource");
  if (!principal?.authorized || resource.workspaceId !== principal.workspaceId) {
    fail("route_iq_launch_cross_workspace_denied", "The resource crosses the authorized workspace.");
  }
  if (principal.accessMode === "founder_explicit_workspace_read_only"
    && resource.operation !== "read_route") {
    fail("route_iq_launch_founder_write_denied", "Founder multi-company access is read-only.");
  }
  if (resource.operation === "write_route" && resource.representativeId !== principal.representativeId) {
    fail("route_iq_launch_cross_user_write_denied", "A user cannot write another representative's route.");
  }
  if (resource.operation === "read_route"
    && resource.representativeId !== principal.representativeId
    && principal.capabilities.readWorkspaceOperations !== true) {
    fail("route_iq_launch_cross_user_read_denied", "A user cannot read another representative's route.");
  }
  if (!["read_route", "write_route"].includes(resource.operation)) {
    fail("route_iq_launch_operation_invalid", "The resource operation is invalid.");
  }
  return true;
}
