import {
  beginSimulatedPayment,
  cancelPaidCustomerBilling,
  createPaidCustomerBillingRecord,
  createSignedWebhookBoundary,
  processPaidCustomerBillingWebhook,
  readPaidCustomerBillingRecord,
  suspendPaidCustomerBilling
} from "../crm/paid-customer-revenue-readiness-v1.mjs";

export const ROUTE_IQ_REVENUE_SECURITY_VERSION =
  "route_iq_paid_customer_revenue_security.v1";
export const ROUTE_IQ_REVENUE_MODE = "TEST";

export const ROUTE_IQ_REVENUE_ROLES = Object.freeze({
  founder: "founder_revenue_authority",
  customerOwner: "customer_revenue_owner",
  manager: "customer_manager",
  representative: "customer_representative"
});

export const ROUTE_IQ_REVENUE_OPERATIONS = Object.freeze({
  read: "revenue_read",
  createFictional: "fictional_billing_create",
  beginFictionalPayment: "fictional_payment_begin",
  processFictionalWebhook: "fictional_webhook_process",
  suspend: "revenue_suspend",
  cancel: "revenue_cancel",
  workspaceSuspend: "workspace_suspend",
  workspaceOffboard: "workspace_offboard"
});

const STRICT_ID = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u;
const TRUSTED_AUTHORITIES = new WeakSet();
const AUTHORITY_STATE = new WeakMap();
const TRUSTED_CONTEXTS = new WeakSet();
const CONTEXT_AUTHORITY = new WeakMap();
const TRUSTED_DECISIONS = new WeakSet();

const GRANTS = Object.freeze({
  [ROUTE_IQ_REVENUE_ROLES.founder]: new Set(Object.values(ROUTE_IQ_REVENUE_OPERATIONS)),
  [ROUTE_IQ_REVENUE_ROLES.customerOwner]: new Set([
    ROUTE_IQ_REVENUE_OPERATIONS.read,
    ROUTE_IQ_REVENUE_OPERATIONS.createFictional,
    ROUTE_IQ_REVENUE_OPERATIONS.beginFictionalPayment,
    ROUTE_IQ_REVENUE_OPERATIONS.suspend,
    ROUTE_IQ_REVENUE_OPERATIONS.cancel
  ]),
  [ROUTE_IQ_REVENUE_ROLES.manager]: new Set([
    ROUTE_IQ_REVENUE_OPERATIONS.read
  ]),
  [ROUTE_IQ_REVENUE_ROLES.representative]: new Set()
});

const SAFE_DENIAL = Object.freeze({
  status: 404,
  headers: Object.freeze({
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8"
  }),
  body: Object.freeze({
    ok: false,
    code: "route_iq_resource_unavailable"
  })
});

export class RouteIqRevenueSecurityError extends Error {
  constructor(classification = "SECURITY_DENIED") {
    super("Route IQ revenue resource is unavailable.");
    this.name = "RouteIqRevenueSecurityError";
    this.code = "route_iq_revenue_access_denied";
    Object.defineProperty(this, "classification", {
      value: classification,
      enumerable: false
    });
  }
}

function fail(classification) {
  throw new RouteIqRevenueSecurityError(classification);
}

function plain(value) {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function exact(value, required, optional = [], classification = "REQUEST_INVALID") {
  if (!plain(value)) fail(classification);
  const allowed = new Set([...required, ...optional]);
  if (required.some(key => !Object.hasOwn(value, key))
    || Object.keys(value).some(key => !allowed.has(key))) {
    fail(classification);
  }
}

function id(value, prefix, classification = "SCOPE_DENIED") {
  if (typeof value !== "string"
    || value.length < 8
    || value.length > 128
    || !STRICT_ID.test(value)
    || !value.startsWith(prefix)) {
    fail(classification);
  }
  return value;
}

function instant(value, classification = "AUTHENTICATION_INVALID") {
  if (typeof value !== "string" || !ISO_INSTANT.test(value)) fail(classification);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) fail(classification);
  return parsed;
}

function freeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(freeze);
  return value;
}

function resourceKey(resource) {
  return `${resource.companyId}\0${resource.workspaceId}\0${resource.billingAccountId}`;
}

function validateResource(resource) {
  exact(resource, [
    "billingAccountId",
    "companyId",
    "customerId",
    "invoiceId",
    "locationIds",
    "subscriptionId",
    "workspaceId"
  ]);
  const normalized = {
    companyId: id(resource.companyId, "company_"),
    workspaceId: id(resource.workspaceId, "workspace_"),
    billingAccountId: id(resource.billingAccountId, "billing_"),
    customerId: id(resource.customerId, "customer_"),
    subscriptionId: id(resource.subscriptionId, "subscription_"),
    invoiceId: id(resource.invoiceId, "invoice_"),
    locationIds: resource.locationIds
  };
  if (!Array.isArray(normalized.locationIds)
    || normalized.locationIds.length < 1
    || normalized.locationIds.length > 100
    || new Set(normalized.locationIds).size !== normalized.locationIds.length) {
    fail("SCOPE_DENIED");
  }
  normalized.locationIds.forEach(value => id(value, "location_"));
  return freeze({ ...normalized, locationIds: [...normalized.locationIds].sort() });
}

export function createRouteIqRevenueAuthority(input) {
  exact(input, ["bindings", "mode", "resources"]);
  if (input.mode !== ROUTE_IQ_REVENUE_MODE
    || !Array.isArray(input.bindings)
    || !Array.isArray(input.resources)
    || input.bindings.length < 1
    || input.resources.length < 1) {
    fail("AUTHORITY_INVALID");
  }
  const resources = input.resources.map(validateResource);
  const resourceKeys = new Set(resources.map(resourceKey));
  if (resourceKeys.size !== resources.length) fail("AUTHORITY_INVALID");
  const bindings = input.bindings.map(binding => {
    exact(binding, ["active", "companyId", "principalId", "role", "workspaceId"]);
    if (binding.active !== true || !Object.hasOwn(GRANTS, binding.role)) {
      fail("AUTHORITY_INVALID");
    }
    const normalized = {
      active: true,
      principalId: id(binding.principalId, "principal_", "AUTHORITY_INVALID"),
      companyId: id(binding.companyId, "company_", "AUTHORITY_INVALID"),
      workspaceId: id(binding.workspaceId, "workspace_", "AUTHORITY_INVALID"),
      role: binding.role
    };
    if (!resources.some(resource => resource.companyId === normalized.companyId
      && resource.workspaceId === normalized.workspaceId)) {
      fail("AUTHORITY_INVALID");
    }
    return freeze(normalized);
  });
  const bindingKeys = bindings.map(
    binding => `${binding.principalId}\0${binding.companyId}\0${binding.workspaceId}`
  );
  if (new Set(bindingKeys).size !== bindingKeys.length) fail("AUTHORITY_INVALID");

  const authority = freeze({
    contractVersion: ROUTE_IQ_REVENUE_SECURITY_VERSION,
    mode: ROUTE_IQ_REVENUE_MODE,
    bindings,
    resources
  });
  TRUSTED_AUTHORITIES.add(authority);
  AUTHORITY_STATE.set(authority, {
    workspaces: new Map(resources.map(resource => [
      `${resource.companyId}\0${resource.workspaceId}`,
      "ACTIVE"
    ]))
  });
  return authority;
}

export function bindRouteIqRevenuePrincipal({ authority, claims, requestedScope, now }) {
  if (!TRUSTED_AUTHORITIES.has(authority)) fail("AUTHORITY_INVALID");
  exact(claims, [
    "authenticated",
    "expiresAt",
    "issuedAt",
    "principalId"
  ]);
  exact(requestedScope, ["companyId", "workspaceId"]);
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())
    || claims.authenticated !== true) {
    fail("AUTHENTICATION_INVALID");
  }
  const issuedAt = instant(claims.issuedAt);
  const expiresAt = instant(claims.expiresAt);
  if (issuedAt > now.getTime() || expiresAt <= now.getTime() || issuedAt >= expiresAt) {
    fail("AUTHENTICATION_INVALID");
  }
  const principalId = id(claims.principalId, "principal_", "AUTHENTICATION_INVALID");
  const companyId = id(requestedScope.companyId, "company_");
  const workspaceId = id(requestedScope.workspaceId, "workspace_");
  const matches = authority.bindings.filter(binding =>
    binding.principalId === principalId
    && binding.companyId === companyId
    && binding.workspaceId === workspaceId
  );
  if (matches.length !== 1) fail("SCOPE_DENIED");
  const state = AUTHORITY_STATE.get(authority);
  if (state.workspaces.get(`${companyId}\0${workspaceId}`) !== "ACTIVE") {
    fail("WORKSPACE_INACTIVE");
  }
  const context = freeze({
    contractVersion: ROUTE_IQ_REVENUE_SECURITY_VERSION,
    mode: ROUTE_IQ_REVENUE_MODE,
    principalId,
    companyId,
    workspaceId,
    role: matches[0].role,
    sessionExpiresAt: claims.expiresAt
  });
  TRUSTED_CONTEXTS.add(context);
  CONTEXT_AUTHORITY.set(context, authority);
  return context;
}

function findResource(authority, request) {
  const resource = authority.resources.find(candidate =>
    candidate.companyId === request.companyId
    && candidate.workspaceId === request.workspaceId
    && candidate.billingAccountId === request.billingAccountId
  );
  if (!resource
    || resource.customerId !== request.customerId
    || resource.subscriptionId !== request.subscriptionId
    || resource.invoiceId !== request.invoiceId
    || !resource.locationIds.includes(request.locationId)) {
    fail("SCOPE_DENIED");
  }
  return resource;
}

export function authorizeRouteIqRevenueOperation(context, request, now) {
  if (!TRUSTED_CONTEXTS.has(context)) fail("TRUSTED_CONTEXT_REQUIRED");
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())
    || instant(context.sessionExpiresAt) <= now.getTime()) {
    fail("AUTHENTICATION_INVALID");
  }
  exact(request, [
    "billingAccountId",
    "companyId",
    "customerId",
    "invoiceId",
    "locationId",
    "operation",
    "subscriptionId",
    "workspaceId"
  ], ["eventId"]);
  if (!Object.values(ROUTE_IQ_REVENUE_OPERATIONS).includes(request.operation)) {
    fail("OPERATION_DENIED");
  }
  const authority = CONTEXT_AUTHORITY.get(context);
  const state = AUTHORITY_STATE.get(authority);
  if (state.workspaces.get(`${context.companyId}\0${context.workspaceId}`) !== "ACTIVE") {
    fail("WORKSPACE_INACTIVE");
  }
  if (request.companyId !== context.companyId
    || request.workspaceId !== context.workspaceId) {
    fail("SCOPE_DENIED");
  }
  const resource = findResource(authority, request);
  if (!GRANTS[context.role].has(request.operation)) fail("ROLE_DENIED");
  if (Object.hasOwn(request, "eventId")) id(request.eventId, "event_");
  const decision = freeze({
    authorized: true,
    contractVersion: ROUTE_IQ_REVENUE_SECURITY_VERSION,
    mode: ROUTE_IQ_REVENUE_MODE,
    operation: request.operation,
    principalId: context.principalId,
    role: context.role,
    sessionExpiresAt: context.sessionExpiresAt,
    scope: {
      companyId: resource.companyId,
      workspaceId: resource.workspaceId,
      billingAccountId: resource.billingAccountId,
      customerId: resource.customerId,
      subscriptionId: resource.subscriptionId,
      invoiceId: resource.invoiceId,
      locationId: request.locationId,
      ...(request.eventId ? { eventId: request.eventId } : {})
    }
  });
  TRUSTED_DECISIONS.add(decision);
  CONTEXT_AUTHORITY.set(decision, authority);
  return decision;
}

function requireDecision(decision, operation, now) {
  if (!TRUSTED_DECISIONS.has(decision) || decision.operation !== operation) {
    fail("TRUSTED_DECISION_REQUIRED");
  }
  const executionTime = new Date(now);
  if (decision.mode !== ROUTE_IQ_REVENUE_MODE
    || !Number.isFinite(executionTime.getTime())
    || instant(decision.sessionExpiresAt) <= executionTime.getTime()) {
    fail("AUTHENTICATION_INVALID");
  }
  const authority = CONTEXT_AUTHORITY.get(decision);
  const state = AUTHORITY_STATE.get(authority);
  if (state.workspaces.get(
    `${decision.scope.companyId}\0${decision.scope.workspaceId}`
  ) !== "ACTIVE") {
    fail("WORKSPACE_INACTIVE");
  }
  return decision.scope;
}

function crmSession(decision, now) {
  return {
    authenticated: true,
    principalId: decision.principalId,
    companyId: decision.scope.companyId,
    workspaceId: decision.scope.workspaceId,
    role: "revenue_owner",
    expiresAt: new Date(new Date(now).getTime() + 60_000).toISOString()
  };
}

function crmScope(scope) {
  return {
    companyId: scope.companyId,
    workspaceId: scope.workspaceId,
    billingAccountId: scope.billingAccountId
  };
}

export function secureCreateFictionalBillingRecord(store, decision, input, now) {
  const scope = requireDecision(
    decision,
    ROUTE_IQ_REVENUE_OPERATIONS.createFictional,
    now
  );
  exact(input, ["companyDisplayName", "currency", "planId", "unitAmountMinor"]);
  return createPaidCustomerBillingRecord(store, {
    ...crmScope(scope),
    ...input
  }, { session: crmSession(decision, now), now });
}

export function secureReadRevenueRecord(store, decision, now) {
  const scope = requireDecision(decision, ROUTE_IQ_REVENUE_OPERATIONS.read, now);
  return readPaidCustomerBillingRecord(store, crmScope(scope), {
    session: crmSession(decision, now),
    now
  });
}

export function secureBeginFictionalPayment(store, decision, now) {
  const scope = requireDecision(
    decision,
    ROUTE_IQ_REVENUE_OPERATIONS.beginFictionalPayment,
    now
  );
  return beginSimulatedPayment(store, crmScope(scope), {
    session: crmSession(decision, now),
    now
  });
}

export function createRouteIqRevenueWebhookBoundary(decision, verifyRawBytes, now) {
  requireDecision(
    decision,
    ROUTE_IQ_REVENUE_OPERATIONS.processFictionalWebhook,
    now
  );
  if (typeof verifyRawBytes !== "function") fail("SIGNATURE_VERIFIER_REQUIRED");
  return createSignedWebhookBoundary({
    verifySignature: async ({ signature, payloadBytes }) =>
      verifyRawBytes({ signature, payloadBytes }) === true
  });
}

export async function secureProcessFictionalWebhook(
  store,
  decision,
  request,
  { boundary, now }
) {
  const scope = requireDecision(
    decision,
    ROUTE_IQ_REVENUE_OPERATIONS.processFictionalWebhook,
    now
  );
  exact(request, ["payloadBytes", "signature"]);
  if (!(request.payloadBytes instanceof Uint8Array)) fail("WEBHOOK_INVALID");
  let payload;
  try {
    payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(
      request.payloadBytes
    ));
  } catch {
    fail("WEBHOOK_INVALID");
  }
  if (!plain(payload)
    || payload.companyId !== scope.companyId
    || payload.workspaceId !== scope.workspaceId
    || payload.billingAccountId !== scope.billingAccountId
    || payload.eventId !== scope.eventId) {
    fail("SCOPE_DENIED");
  }
  return processPaidCustomerBillingWebhook(store, request, { boundary, now });
}

export function secureSuspendRevenue(store, decision, reasonCode, now) {
  const scope = requireDecision(decision, ROUTE_IQ_REVENUE_OPERATIONS.suspend, now);
  return suspendPaidCustomerBilling(store, crmScope(scope), {
    session: crmSession(decision, now),
    now,
    reasonCode
  });
}

export function secureCancelRevenue(store, decision, reasonCode, now) {
  const scope = requireDecision(decision, ROUTE_IQ_REVENUE_OPERATIONS.cancel, now);
  return cancelPaidCustomerBilling(store, crmScope(scope), {
    session: crmSession(decision, now),
    now,
    reasonCode
  });
}

export function applyRouteIqRevenueWorkspaceState(decision, nextState, now) {
  if (!["SUSPENDED", "OFFBOARDED"].includes(nextState)) fail("STATE_DENIED");
  const expectedOperation = nextState === "SUSPENDED"
    ? ROUTE_IQ_REVENUE_OPERATIONS.workspaceSuspend
    : ROUTE_IQ_REVENUE_OPERATIONS.workspaceOffboard;
  const scope = requireDecision(decision, expectedOperation, now);
  const authority = CONTEXT_AUTHORITY.get(decision);
  AUTHORITY_STATE.get(authority).workspaces.set(
    `${scope.companyId}\0${scope.workspaceId}`,
    nextState
  );
  return freeze({
    classification: nextState,
    companyScope: "BOUND",
    workspaceScope: "BOUND",
    access: "DENIED"
  });
}

export function assertRouteIqRevenueLifecycleBlocked(state) {
  if (!["DRAFT", "VALIDATED"].includes(state)) fail("LIFECYCLE_INVALID");
  return freeze({
    state,
    activationState: "activation_blocked",
    liveReady: false,
    liveActive: false
  });
}

export function routeIqRevenueSafeDenial() {
  return SAFE_DENIAL;
}

export function createRouteIqRevenueAuditEvent({ decision, outcome, action }) {
  if (!["ALLOWED", "DENIED"].includes(outcome)
    || typeof action !== "string"
    || !/^[a-z][a-z0-9_]{2,63}$/u.test(action)) {
    fail("AUDIT_INVALID");
  }
  const trusted = TRUSTED_DECISIONS.has(decision);
  return freeze({
    contractVersion: ROUTE_IQ_REVENUE_SECURITY_VERSION,
    action,
    outcome,
    authority: trusted ? "SERVER_DECISION" : "UNAVAILABLE",
    companyScope: trusted ? "BOUND" : "UNAVAILABLE",
    workspaceScope: trusted ? "BOUND" : "UNAVAILABLE"
  });
}
