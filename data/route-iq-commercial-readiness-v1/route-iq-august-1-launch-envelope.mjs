export const routeIqAugust1LaunchEnvelopeVersion = "route-iq-august-1-launch-envelope-v1";
export const routeIqAugust1LaunchMaximumCompanies = 2;
export const routeIqAugust1LaunchMaximumNamedUsers = 40;
export const routeIqAugust1LaunchRoles = Object.freeze([
  "customer_owner",
  "customer_manager",
  "customer_representative"
]);

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
  exactKeys(envelope, [
    "version",
    "state",
    "classification",
    "issuedAt",
    "expiresAt",
    "limits",
    "safety",
    "workspaceAdmissions"
  ], "launchEnvelope");
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

export function validateRouteIqAugust1LaunchEnvelope(envelope, registry, { now = new Date() } = {}) {
  validateHeader(envelope);
  if (envelope.state === "OFF") {
    if (envelope.issuedAt !== null || envelope.expiresAt !== null || envelope.workspaceAdmissions.length !== 0) {
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
  return freeze({
    ...clone(envelope),
    workspaceAdmissions: admissions,
    verifiedCapacity: {
      companies: admissions.length,
      namedUsers
    }
  });
}

export function authorizeRouteIqAugust1LaunchPrincipal({ envelope, registry, authenticatedPrincipalId, now }) {
  if (!PRINCIPAL_PATTERN.test(authenticatedPrincipalId || "")) {
    fail("route_iq_launch_authentication_required", "An exact authenticated principal is required.");
  }
  const launch = validateRouteIqAugust1LaunchEnvelope(envelope, registry, { now });
  if (launch.state !== "ACTIVE") fail("route_iq_launch_inactive", "Bounded customer production is inactive.");
  for (const admission of launch.workspaceAdmissions) {
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
      companyId: workspace.workspaceId,
      workspaceId: workspace.workspaceId,
      workspaceLabel: workspace.business.brand.displayName,
      operatingProfileId: workspace.operatingProfileId,
      userId: user.userId,
      representativeId: user.representativeId,
      displayName: user.displayName,
      roleId: user.roleId,
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
  fail("route_iq_launch_principal_unmapped", "The authenticated principal is not admitted to the bounded launch.");
}

export function assertRouteIqAugust1LaunchResourceAccess(principal, resource) {
  exactKeys(resource, ["workspaceId", "representativeId", "operation"], "resource");
  if (!principal?.authorized || resource.workspaceId !== principal.workspaceId) {
    fail("route_iq_launch_cross_workspace_denied", "The resource crosses the authorized workspace.");
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
