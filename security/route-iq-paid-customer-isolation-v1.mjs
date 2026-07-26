import {
  ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_AUTHORITY,
  validateRouteIqPaidCustomerOnboardingConfiguration
} from "../administration/contracts/route-iq-paid-customer-onboarding-v1.mjs";

const TRUSTED_CONTEXTS = new WeakSet();
const TRUSTED_DECISIONS = new WeakSet();
const TRUSTED_CONTEXT_GRANTS = new WeakMap();
const TRUSTED_PROJECTED_AUTHORITIES = new WeakSet();

const STRICT_ID = /^[a-z][a-z0-9_]{2,127}$/u;
const CONFIGURATION_VERSION = /^v[1-9][0-9]*\.[0-9]+\.[0-9]+$/u;
const CONFIGURATION_IDENTITY = /^[a-z][a-z0-9_]{2,127}@[1-9][0-9]*$/u;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u;
const SAFE_LABEL = /^[\p{L}\p{N}][\p{L}\p{N} .,&()/+\-]*$/u;
const UNSAFE_LABEL_SEQUENCE =
  /(?:<|>|[`"'\\{}[\]$=;]|javascript\s*:|data\s*:|union\s+select|drop\s+table|insert\s+into|delete\s+from|update\s+\S+\s+set|onerror|onload)/iu;
const CONTROL_OR_DIRECTIONAL =
  /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/u;

export const ROUTE_IQ_PAID_CUSTOMER_SECURITY_VERSION =
  "route-iq-paid-customer-security-v1";
export const ROUTE_IQ_PAID_CUSTOMER_AUTHORITY =
  "prometheus_security_server_authority";

export const ROUTE_IQ_PAID_CUSTOMER_ROLES = Object.freeze({
  representative: "paid_customer_representative",
  manager: "paid_customer_manager",
  administrator: "paid_customer_administrator"
});

export const ROUTE_IQ_PAID_CUSTOMER_OPERATIONS = Object.freeze({
  dashboardRead: "dashboard_read",
  businessRead: "business_read",
  recommendationReceive: "recommendation_receive",
  ownRecordRead: "own_record_read",
  ownOutcomeWrite: "own_outcome_write",
  workspaceRecordsRead: "workspace_records_read",
  workspaceRecordsModify: "workspace_records_modify",
  territoryAssignmentsManage: "territory_assignments_manage",
  configurationPreview: "configuration_preview",
  roleManage: "role_manage",
  workspaceSuspend: "workspace_suspend",
  workspaceOffboard: "workspace_offboard"
});

export const ROUTE_IQ_PAID_CUSTOMER_FAILURE_CLASSIFICATIONS = Object.freeze({
  requestMalformed: "REQUEST_MALFORMED",
  authenticationInvalid: "AUTHENTICATION_INVALID",
  bindingUnavailable: "BINDING_UNAVAILABLE",
  bindingAmbiguous: "BINDING_AMBIGUOUS",
  scopeDenied: "SCOPE_DENIED",
  roleDenied: "ROLE_DENIED",
  trustedContextRequired: "TRUSTED_CONTEXT_REQUIRED",
  trustedDecisionRequired: "TRUSTED_DECISION_REQUIRED",
  storageScopeDenied: "STORAGE_SCOPE_DENIED",
  roleProjectionDenied: "ROLE_PROJECTION_DENIED",
  labelUnsafe: "LABEL_UNSAFE",
  auditInvalid: "AUDIT_INVALID",
  securityFailure: "SECURITY_FAILURE"
});

const SAFE_DENIAL = Object.freeze({
  status: 404,
  headers: Object.freeze({
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8"
  }),
  body: Object.freeze({
    ok: false,
    code: "route_iq_resource_unavailable",
    message: "Route IQ resource is unavailable."
  })
});

const ROLE_GRANTS = Object.freeze({
  [ROUTE_IQ_PAID_CUSTOMER_ROLES.representative]: Object.freeze([
    ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.dashboardRead,
    ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.businessRead,
    ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.recommendationReceive,
    ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.ownRecordRead,
    ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.ownOutcomeWrite
  ]),
  [ROUTE_IQ_PAID_CUSTOMER_ROLES.manager]: Object.freeze([
    ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.dashboardRead,
    ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.businessRead,
    ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.recommendationReceive,
    ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.ownRecordRead,
    ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.ownOutcomeWrite,
    ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.workspaceRecordsRead,
    ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.workspaceRecordsModify
  ]),
  [ROUTE_IQ_PAID_CUSTOMER_ROLES.administrator]: Object.freeze([
    ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.dashboardRead,
    ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.businessRead,
    ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.workspaceRecordsRead,
    ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.workspaceRecordsModify,
    ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.configurationPreview,
    ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.roleManage,
    ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.workspaceSuspend,
    ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.workspaceOffboard
  ])
});

const SELF_SCOPED_OPERATIONS = new Set([
  ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.ownRecordRead,
  ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.ownOutcomeWrite
]);

const KNOWN_OPERATIONS = new Set(Object.values(ROUTE_IQ_PAID_CUSTOMER_OPERATIONS));
const ADMINISTRATION_PROJECTABLE_OPERATIONS = new Set([
  ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.dashboardRead,
  ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.businessRead,
  ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.ownRecordRead,
  ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.ownOutcomeWrite,
  ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.workspaceRecordsRead,
  ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.territoryAssignmentsManage
]);
const ADMINISTRATION_PROJECTABLE_LIFECYCLE_STATES = new Set([
  "VALIDATED",
  "PREVIEW_READY",
  "AWAITING_APPROVAL",
  "PROVISIONING",
  "PROVISIONING_FAILED",
  "READY_FOR_ACTIVATION"
]);
const KNOWN_FAILURE_CLASSIFICATIONS = new Set(
  Object.values(ROUTE_IQ_PAID_CUSTOMER_FAILURE_CLASSIFICATIONS)
);

export class RouteIqPaidCustomerSecurityError extends Error {
  constructor(classification) {
    super("Route IQ authorization is unavailable.");
    this.name = "RouteIqPaidCustomerSecurityError";
    this.code = "route_iq_access_denied";
    Object.defineProperty(this, "classification", {
      value: KNOWN_FAILURE_CLASSIFICATIONS.has(classification)
        ? classification
        : ROUTE_IQ_PAID_CUSTOMER_FAILURE_CLASSIFICATIONS.securityFailure,
      enumerable: false,
      writable: false,
      configurable: false
    });
  }
}

function fail(classification) {
  throw new RouteIqPaidCustomerSecurityError(classification);
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertExactKeys(value, requiredKeys, optionalKeys = [], classification) {
  if (!isPlainObject(value)) fail(classification);
  const keys = Object.keys(value).sort();
  const allowed = new Set([...requiredKeys, ...optionalKeys]);
  if (requiredKeys.some(key => !Object.hasOwn(value, key))
    || keys.some(key => !allowed.has(key))) {
    fail(classification);
  }
}

function validStrictId(value) {
  return typeof value === "string" && STRICT_ID.test(value);
}

function validConfigurationVersion(value) {
  return typeof value === "string" && CONFIGURATION_VERSION.test(value);
}

function parseInstant(value, classification) {
  if (typeof value !== "string" || !ISO_INSTANT.test(value)) fail(classification);
  const instant = Date.parse(value);
  if (!Number.isFinite(instant)) fail(classification);
  return instant;
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function validateBinding(binding, projectedRoleGrants = undefined) {
  assertExactKeys(binding, [
    "active",
    "bindingVersion",
    "companyId",
    "operatingProfileId",
    "principalId",
    "roleId",
    "workspaceId"
  ], [], ROUTE_IQ_PAID_CUSTOMER_FAILURE_CLASSIFICATIONS.bindingUnavailable);
  if (binding.active !== true
    || !validConfigurationVersion(binding.bindingVersion)
    || !validStrictId(binding.companyId)
    || !validStrictId(binding.workspaceId)
    || !validStrictId(binding.operatingProfileId)
    || !validStrictId(binding.principalId)
    || !(projectedRoleGrants
      ? projectedRoleGrants.has(binding.roleId)
      : Object.hasOwn(ROLE_GRANTS, binding.roleId))) {
    fail(ROUTE_IQ_PAID_CUSTOMER_FAILURE_CLASSIFICATIONS.bindingUnavailable);
  }
}

function validateProjectedRoleGrants(roleGrants) {
  if (!Array.isArray(roleGrants) || roleGrants.length < 1 || roleGrants.length > 50) {
    fail(ROUTE_IQ_PAID_CUSTOMER_FAILURE_CLASSIFICATIONS.bindingUnavailable);
  }
  const grantsByRole = new Map();
  for (const roleGrant of roleGrants) {
    assertExactKeys(roleGrant, [
      "operations",
      "roleId",
      "sourcePermissions"
    ], [], ROUTE_IQ_PAID_CUSTOMER_FAILURE_CLASSIFICATIONS.bindingUnavailable);
    if (!validStrictId(roleGrant.roleId)
      || Object.hasOwn(ROLE_GRANTS, roleGrant.roleId)
      || !Array.isArray(roleGrant.sourcePermissions)
      || roleGrant.sourcePermissions.length < 1
      || new Set(roleGrant.sourcePermissions).size !== roleGrant.sourcePermissions.length
      || roleGrant.sourcePermissions.some(permission => !validStrictId(permission))
      || !Array.isArray(roleGrant.operations)
      || roleGrant.operations.length < 1
      || new Set(roleGrant.operations).size !== roleGrant.operations.length
      || roleGrant.operations.some(
        operation => !ADMINISTRATION_PROJECTABLE_OPERATIONS.has(operation)
      )
      || grantsByRole.has(roleGrant.roleId)) {
      fail(ROUTE_IQ_PAID_CUSTOMER_FAILURE_CLASSIFICATIONS.roleProjectionDenied);
    }
    grantsByRole.set(roleGrant.roleId, roleGrant.operations);
  }
  return grantsByRole;
}

function validateAuthority(authority, allowUntrustedProjection = false) {
  const requiredKeys = [
    "authority",
    "bindings",
    "contractVersion",
    "expectedAudienceBindingId",
    "expectedIssuerBindingId"
  ];
  const projected = isPlainObject(authority)
    && Object.hasOwn(authority, "authoritySource");
  if (projected) {
    requiredKeys.push("authoritySource", "configurationIdentity", "roleGrants");
  }
  assertExactKeys(
    authority,
    requiredKeys,
    [],
    ROUTE_IQ_PAID_CUSTOMER_FAILURE_CLASSIFICATIONS.bindingUnavailable
  );
  if (authority.contractVersion !== ROUTE_IQ_PAID_CUSTOMER_SECURITY_VERSION
    || authority.authority !== ROUTE_IQ_PAID_CUSTOMER_AUTHORITY
    || !validStrictId(authority.expectedAudienceBindingId)
    || !validStrictId(authority.expectedIssuerBindingId)
    || !Array.isArray(authority.bindings)
    || authority.bindings.length < 1
    || authority.bindings.length > 10_000) {
    fail(ROUTE_IQ_PAID_CUSTOMER_FAILURE_CLASSIFICATIONS.bindingUnavailable);
  }

  let projectedRoleGrants;
  if (projected) {
    if (authority.authoritySource !== ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_AUTHORITY
      || typeof authority.configurationIdentity !== "string"
      || !CONFIGURATION_IDENTITY.test(authority.configurationIdentity)
      || (!allowUntrustedProjection && !TRUSTED_PROJECTED_AUTHORITIES.has(authority))) {
      fail(ROUTE_IQ_PAID_CUSTOMER_FAILURE_CLASSIFICATIONS.bindingUnavailable);
    }
    projectedRoleGrants = validateProjectedRoleGrants(authority.roleGrants);
  }

  const seen = new Set();
  for (const binding of authority.bindings) {
    validateBinding(binding, projectedRoleGrants);
    const identity = `${binding.principalId}\u0000${binding.companyId}\u0000${binding.workspaceId}`;
    if (seen.has(identity)) {
      fail(ROUTE_IQ_PAID_CUSTOMER_FAILURE_CLASSIFICATIONS.bindingAmbiguous);
    }
    seen.add(identity);
  }
  return projectedRoleGrants;
}

function projectAdministrationPermission(permission, dashboardCapabilities) {
  if (permission === "view_assigned_territory") {
    return [
      ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.dashboardRead,
      ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.businessRead,
      ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.ownRecordRead
    ];
  }
  if (permission === "view_company_dashboard") {
    return [
      ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.dashboardRead,
      ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.businessRead,
      ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.workspaceRecordsRead
    ];
  }
  if (permission === "manage_territory_assignments") {
    return [ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.territoryAssignmentsManage];
  }
  if (/^record_[a-z][a-z0-9_]*$/u.test(permission)
    && dashboardCapabilities.has(permission)) {
    return [ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.ownOutcomeWrite];
  }
  if (/^review_[a-z][a-z0-9_]*_outcomes$/u.test(permission)) {
    return [ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.workspaceRecordsRead];
  }
  fail(ROUTE_IQ_PAID_CUSTOMER_FAILURE_CLASSIFICATIONS.roleProjectionDenied);
}

function projectAdministrationRoleGrants(configuration) {
  const dashboardCapabilities = new Set(configuration.dashboard.capabilityIds);
  return configuration.access.roles
    .map(role => {
      if (Object.hasOwn(ROLE_GRANTS, role.roleId)) {
        fail(ROUTE_IQ_PAID_CUSTOMER_FAILURE_CLASSIFICATIONS.roleProjectionDenied);
      }
      const operations = new Set();
      for (const permission of role.permissions) {
        for (const operation of projectAdministrationPermission(
          permission,
          dashboardCapabilities
        )) {
          operations.add(operation);
        }
      }
      if (operations.size < 1) {
        fail(ROUTE_IQ_PAID_CUSTOMER_FAILURE_CLASSIFICATIONS.roleProjectionDenied);
      }
      return {
        roleId: role.roleId,
        sourcePermissions: [...role.permissions].sort(),
        operations: Object.values(ROUTE_IQ_PAID_CUSTOMER_OPERATIONS)
          .filter(operation => operations.has(operation))
      };
    })
    .sort((left, right) => left.roleId.localeCompare(right.roleId));
}

export function projectRouteIqPaidCustomerAdministrationAuthority(input) {
  assertExactKeys(input, [
    "configuration",
    "expectedAudienceBindingId",
    "expectedIssuerBindingId",
    "principalBindings"
  ], [], ROUTE_IQ_PAID_CUSTOMER_FAILURE_CLASSIFICATIONS.bindingUnavailable);
  const {
    configuration,
    expectedAudienceBindingId,
    expectedIssuerBindingId,
    principalBindings
  } = input;
  if (!validStrictId(expectedAudienceBindingId)
    || !validStrictId(expectedIssuerBindingId)
    || !Array.isArray(principalBindings)
    || principalBindings.length < 1
    || principalBindings.length > 10_000) {
    fail(ROUTE_IQ_PAID_CUSTOMER_FAILURE_CLASSIFICATIONS.bindingUnavailable);
  }

  let validated;
  try {
    validated = validateRouteIqPaidCustomerOnboardingConfiguration(configuration);
  } catch {
    fail(ROUTE_IQ_PAID_CUSTOMER_FAILURE_CLASSIFICATIONS.bindingUnavailable);
  }
  if (!ADMINISTRATION_PROJECTABLE_LIFECYCLE_STATES.has(validated.lifecycle.state)
    || validated.safety.customerActivation !== "OFF"
    || validated.safety.collection !== "OFF"
    || validated.safety.activeCohorts !== 0
    || validated.safety.recommendationInfluence !== "OFF"
    || validated.safety.providerRefresh !== "OFF"
    || validated.safety.scheduler !== "OFF") {
    fail(ROUTE_IQ_PAID_CUSTOMER_FAILURE_CLASSIFICATIONS.bindingUnavailable);
  }

  const roleGrants = projectAdministrationRoleGrants(validated);
  const configuredRoleIds = new Set(roleGrants.map(role => role.roleId));
  const seenPrincipals = new Set();
  const bindings = principalBindings.map(principalBinding => {
    assertExactKeys(
      principalBinding,
      ["principalId", "roleId"],
      [],
      ROUTE_IQ_PAID_CUSTOMER_FAILURE_CLASSIFICATIONS.bindingUnavailable
    );
    if (!validStrictId(principalBinding.principalId)
      || !validStrictId(principalBinding.roleId)
      || !configuredRoleIds.has(principalBinding.roleId)
      || seenPrincipals.has(principalBinding.principalId)) {
      fail(seenPrincipals.has(principalBinding.principalId)
        ? ROUTE_IQ_PAID_CUSTOMER_FAILURE_CLASSIFICATIONS.bindingAmbiguous
        : ROUTE_IQ_PAID_CUSTOMER_FAILURE_CLASSIFICATIONS.roleProjectionDenied);
    }
    seenPrincipals.add(principalBinding.principalId);
    return {
      active: true,
      bindingVersion: `v1.${validated.configurationRevision}.0`,
      companyId: validated.company.companyId,
      workspaceId: validated.company.workspaceId,
      operatingProfileId: validated.operatingProfile.industryTemplateId,
      principalId: principalBinding.principalId,
      roleId: principalBinding.roleId
    };
  }).sort((left, right) => left.principalId.localeCompare(right.principalId));

  const authority = deepFreeze({
    contractVersion: ROUTE_IQ_PAID_CUSTOMER_SECURITY_VERSION,
    authority: ROUTE_IQ_PAID_CUSTOMER_AUTHORITY,
    authoritySource: ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_AUTHORITY,
    configurationIdentity: validated.provenance.configurationIdentity,
    expectedIssuerBindingId,
    expectedAudienceBindingId,
    roleGrants,
    bindings
  });
  validateAuthority(authority, true);
  TRUSTED_PROJECTED_AUTHORITIES.add(authority);
  return authority;
}

export function classifyRouteIqPaidCustomerSecurityFailure(error) {
  if (error instanceof RouteIqPaidCustomerSecurityError
    && KNOWN_FAILURE_CLASSIFICATIONS.has(error.classification)) {
    return error.classification;
  }
  return ROUTE_IQ_PAID_CUSTOMER_FAILURE_CLASSIFICATIONS.securityFailure;
}

export function routeIqPaidCustomerSafeDenial() {
  return SAFE_DENIAL;
}

export function bindRouteIqPaidCustomerPrincipal({
  authenticatedClaims,
  requestedScope,
  authority,
  now
}) {
  assertExactKeys(authenticatedClaims, [
    "audienceBindingId",
    "authenticated",
    "expiresAt",
    "issuedAt",
    "issuerBindingId",
    "principalId"
  ], [], ROUTE_IQ_PAID_CUSTOMER_FAILURE_CLASSIFICATIONS.authenticationInvalid);
  assertExactKeys(requestedScope, [
    "companyId",
    "workspaceId"
  ], [], ROUTE_IQ_PAID_CUSTOMER_FAILURE_CLASSIFICATIONS.requestMalformed);
  const projectedRoleGrants = validateAuthority(authority);

  if (!(now instanceof Date) || !Number.isFinite(now.getTime())
    || authenticatedClaims.authenticated !== true
    || !validStrictId(authenticatedClaims.principalId)
    || !validStrictId(requestedScope.companyId)
    || !validStrictId(requestedScope.workspaceId)
    || authenticatedClaims.issuerBindingId !== authority.expectedIssuerBindingId
    || authenticatedClaims.audienceBindingId !== authority.expectedAudienceBindingId) {
    fail(ROUTE_IQ_PAID_CUSTOMER_FAILURE_CLASSIFICATIONS.authenticationInvalid);
  }

  const issuedAt = parseInstant(
    authenticatedClaims.issuedAt,
    ROUTE_IQ_PAID_CUSTOMER_FAILURE_CLASSIFICATIONS.authenticationInvalid
  );
  const expiresAt = parseInstant(
    authenticatedClaims.expiresAt,
    ROUTE_IQ_PAID_CUSTOMER_FAILURE_CLASSIFICATIONS.authenticationInvalid
  );
  if (issuedAt > now.getTime() || expiresAt <= now.getTime() || issuedAt >= expiresAt) {
    fail(ROUTE_IQ_PAID_CUSTOMER_FAILURE_CLASSIFICATIONS.authenticationInvalid);
  }

  const matches = authority.bindings.filter(binding => (
    binding.principalId === authenticatedClaims.principalId
    && binding.companyId === requestedScope.companyId
    && binding.workspaceId === requestedScope.workspaceId
  ));
  if (matches.length !== 1) {
    fail(matches.length > 1
      ? ROUTE_IQ_PAID_CUSTOMER_FAILURE_CLASSIFICATIONS.bindingAmbiguous
      : ROUTE_IQ_PAID_CUSTOMER_FAILURE_CLASSIFICATIONS.bindingUnavailable);
  }

  const binding = matches[0];
  const context = deepFreeze({
    contractVersion: ROUTE_IQ_PAID_CUSTOMER_SECURITY_VERSION,
    authority: ROUTE_IQ_PAID_CUSTOMER_AUTHORITY,
    principalId: binding.principalId,
    companyId: binding.companyId,
    workspaceId: binding.workspaceId,
    operatingProfileId: binding.operatingProfileId,
    roleId: binding.roleId,
    bindingVersion: binding.bindingVersion,
    sessionExpiresAt: authenticatedClaims.expiresAt
  });
  TRUSTED_CONTEXTS.add(context);
  TRUSTED_CONTEXT_GRANTS.set(
    context,
    projectedRoleGrants?.get(binding.roleId) || ROLE_GRANTS[binding.roleId]
  );
  return context;
}

export function authorizeRouteIqPaidCustomerOperation(context, request) {
  if (!TRUSTED_CONTEXTS.has(context)) {
    fail(ROUTE_IQ_PAID_CUSTOMER_FAILURE_CLASSIFICATIONS.trustedContextRequired);
  }
  assertExactKeys(request, [
    "companyId",
    "operation",
    "workspaceId"
  ], [
    "resourceOwnerPrincipalId"
  ], ROUTE_IQ_PAID_CUSTOMER_FAILURE_CLASSIFICATIONS.requestMalformed);
  if (!validStrictId(request.companyId)
    || !validStrictId(request.workspaceId)
    || !KNOWN_OPERATIONS.has(request.operation)) {
    fail(ROUTE_IQ_PAID_CUSTOMER_FAILURE_CLASSIFICATIONS.requestMalformed);
  }
  if (request.companyId !== context.companyId
    || request.workspaceId !== context.workspaceId) {
    fail(ROUTE_IQ_PAID_CUSTOMER_FAILURE_CLASSIFICATIONS.scopeDenied);
  }

  const grants = TRUSTED_CONTEXT_GRANTS.get(context);
  if (!grants?.includes(request.operation)) {
    fail(ROUTE_IQ_PAID_CUSTOMER_FAILURE_CLASSIFICATIONS.roleDenied);
  }

  const selfScoped = SELF_SCOPED_OPERATIONS.has(request.operation);
  if (selfScoped) {
    if (!validStrictId(request.resourceOwnerPrincipalId)
      || request.resourceOwnerPrincipalId !== context.principalId) {
      fail(ROUTE_IQ_PAID_CUSTOMER_FAILURE_CLASSIFICATIONS.scopeDenied);
    }
  } else if (Object.hasOwn(request, "resourceOwnerPrincipalId")) {
    fail(ROUTE_IQ_PAID_CUSTOMER_FAILURE_CLASSIFICATIONS.requestMalformed);
  }

  const storageScope = {
    companyId: context.companyId,
    workspaceId: context.workspaceId
  };
  if (selfScoped) storageScope.principalId = context.principalId;

  const decision = deepFreeze({
    contractVersion: ROUTE_IQ_PAID_CUSTOMER_SECURITY_VERSION,
    authorized: true,
    operation: request.operation,
    principalId: context.principalId,
    companyId: context.companyId,
    workspaceId: context.workspaceId,
    operatingProfileId: context.operatingProfileId,
    roleId: context.roleId,
    bindingVersion: context.bindingVersion,
    storageScope
  });
  TRUSTED_DECISIONS.add(decision);
  return decision;
}

export function assertRouteIqPaidCustomerStorageScope(decision, queryScope) {
  if (!TRUSTED_DECISIONS.has(decision)) {
    fail(ROUTE_IQ_PAID_CUSTOMER_FAILURE_CLASSIFICATIONS.trustedDecisionRequired);
  }
  const selfScoped = Object.hasOwn(decision.storageScope, "principalId");
  assertExactKeys(queryScope, [
    "companyId",
    "workspaceId",
    ...(selfScoped ? ["principalId"] : [])
  ], [], ROUTE_IQ_PAID_CUSTOMER_FAILURE_CLASSIFICATIONS.storageScopeDenied);
  if (queryScope.companyId !== decision.storageScope.companyId
    || queryScope.workspaceId !== decision.storageScope.workspaceId
    || (selfScoped && queryScope.principalId !== decision.storageScope.principalId)) {
    fail(ROUTE_IQ_PAID_CUSTOMER_FAILURE_CLASSIFICATIONS.storageScopeDenied);
  }
  return true;
}

export function validateRouteIqPaidCustomerDisplayTerminology(value) {
  assertExactKeys(value, [
    "configurationVersion",
    "internalMetricId",
    "pluralLabel",
    "singularLabel"
  ], [], ROUTE_IQ_PAID_CUSTOMER_FAILURE_CLASSIFICATIONS.labelUnsafe);
  if (!validConfigurationVersion(value.configurationVersion)
    || !validStrictId(value.internalMetricId)) {
    fail(ROUTE_IQ_PAID_CUSTOMER_FAILURE_CLASSIFICATIONS.labelUnsafe);
  }

  const labels = [value.singularLabel, value.pluralLabel];
  for (const label of labels) {
    if (typeof label !== "string"
      || label.length < 1
      || [...label].length > 80
      || label !== label.normalize("NFC")
      || label !== label.trim()
      || /\s{2,}/u.test(label)
      || CONTROL_OR_DIRECTIONAL.test(label)
      || UNSAFE_LABEL_SEQUENCE.test(label)
      || !SAFE_LABEL.test(label)) {
      fail(ROUTE_IQ_PAID_CUSTOMER_FAILURE_CLASSIFICATIONS.labelUnsafe);
    }
  }
  if (value.singularLabel === value.pluralLabel) {
    fail(ROUTE_IQ_PAID_CUSTOMER_FAILURE_CLASSIFICATIONS.labelUnsafe);
  }

  return deepFreeze({
    contractVersion: ROUTE_IQ_PAID_CUSTOMER_SECURITY_VERSION,
    configurationVersion: value.configurationVersion,
    internalMetricId: value.internalMetricId,
    singularLabel: value.singularLabel,
    pluralLabel: value.pluralLabel,
    renderingContract: "text_content_only"
  });
}

export function createRouteIqPaidCustomerSecurityAuditEvent({
  eventId,
  occurredAt,
  outcome,
  operation,
  context,
  decision,
  error
}) {
  if (!validStrictId(eventId)
    || typeof occurredAt !== "string"
    || !ISO_INSTANT.test(occurredAt)
    || !Number.isFinite(Date.parse(occurredAt))
    || !["ALLOWED", "DENIED"].includes(outcome)
    || !KNOWN_OPERATIONS.has(operation)) {
    fail(ROUTE_IQ_PAID_CUSTOMER_FAILURE_CLASSIFICATIONS.auditInvalid);
  }

  const trustedContext = TRUSTED_CONTEXTS.has(context) ? context : undefined;
  const trustedDecision = TRUSTED_DECISIONS.has(decision) ? decision : undefined;
  if (outcome === "ALLOWED"
    && (!trustedDecision || trustedDecision.operation !== operation)) {
    fail(ROUTE_IQ_PAID_CUSTOMER_FAILURE_CLASSIFICATIONS.auditInvalid);
  }
  if (outcome === "DENIED" && !(error instanceof Error)) {
    fail(ROUTE_IQ_PAID_CUSTOMER_FAILURE_CLASSIFICATIONS.auditInvalid);
  }

  const trustedScope = trustedDecision || trustedContext;
  const event = {
    contractVersion: ROUTE_IQ_PAID_CUSTOMER_SECURITY_VERSION,
    eventType: "route_iq_paid_customer_authorization",
    eventId,
    occurredAt,
    outcome,
    operation,
    principalBinding: trustedScope ? "BOUND" : "UNAVAILABLE"
  };
  if (trustedScope) {
    event.principalId = trustedScope.principalId;
    event.companyId = trustedScope.companyId;
    event.workspaceId = trustedScope.workspaceId;
    event.roleId = trustedScope.roleId;
    event.bindingVersion = trustedScope.bindingVersion;
  }
  if (outcome === "DENIED") {
    event.failureClassification = classifyRouteIqPaidCustomerSecurityFailure(error);
  }
  return deepFreeze(event);
}

export function isTrustedRouteIqPaidCustomerContext(value) {
  return TRUSTED_CONTEXTS.has(value);
}

export function isTrustedRouteIqPaidCustomerDecision(value) {
  return TRUSTED_DECISIONS.has(value);
}
