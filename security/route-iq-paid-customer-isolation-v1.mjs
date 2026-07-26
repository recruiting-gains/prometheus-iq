const TRUSTED_CONTEXTS = new WeakSet();
const TRUSTED_DECISIONS = new WeakSet();

const STRICT_ID = /^[a-z][a-z0-9_]{2,127}$/u;
const CONFIGURATION_VERSION = /^v[1-9][0-9]*\.[0-9]+\.[0-9]+$/u;
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

function validateBinding(binding) {
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
    || !Object.hasOwn(ROLE_GRANTS, binding.roleId)) {
    fail(ROUTE_IQ_PAID_CUSTOMER_FAILURE_CLASSIFICATIONS.bindingUnavailable);
  }
}

function validateAuthority(authority) {
  assertExactKeys(authority, [
    "authority",
    "bindings",
    "contractVersion",
    "expectedAudienceBindingId",
    "expectedIssuerBindingId"
  ], [], ROUTE_IQ_PAID_CUSTOMER_FAILURE_CLASSIFICATIONS.bindingUnavailable);
  if (authority.contractVersion !== ROUTE_IQ_PAID_CUSTOMER_SECURITY_VERSION
    || authority.authority !== ROUTE_IQ_PAID_CUSTOMER_AUTHORITY
    || !validStrictId(authority.expectedAudienceBindingId)
    || !validStrictId(authority.expectedIssuerBindingId)
    || !Array.isArray(authority.bindings)
    || authority.bindings.length < 1
    || authority.bindings.length > 10_000) {
    fail(ROUTE_IQ_PAID_CUSTOMER_FAILURE_CLASSIFICATIONS.bindingUnavailable);
  }

  const seen = new Set();
  for (const binding of authority.bindings) {
    validateBinding(binding);
    const identity = `${binding.principalId}\u0000${binding.companyId}\u0000${binding.workspaceId}`;
    if (seen.has(identity)) {
      fail(ROUTE_IQ_PAID_CUSTOMER_FAILURE_CLASSIFICATIONS.bindingAmbiguous);
    }
    seen.add(identity);
  }
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
  validateAuthority(authority);

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

  const grants = ROLE_GRANTS[context.roleId];
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
