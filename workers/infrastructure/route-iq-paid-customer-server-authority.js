import {
  ROUTE_IQ_PAID_CUSTOMER_AUTHORITY,
  ROUTE_IQ_PAID_CUSTOMER_OPERATIONS,
  ROUTE_IQ_PAID_CUSTOMER_ROLES,
  ROUTE_IQ_PAID_CUSTOMER_SECURITY_VERSION,
  assertRouteIqPaidCustomerStorageScope,
  authorizeRouteIqPaidCustomerOperation,
  bindRouteIqPaidCustomerPrincipal,
  isTrustedRouteIqPaidCustomerDecision
} from "../../security/route-iq-paid-customer-isolation-v1.mjs";

export const ROUTE_IQ_PAID_CUSTOMER_INFRASTRUCTURE_AUTHORITY_VERSION =
  "route-iq-paid-customer-infrastructure-authority-v1";

const STRICT_ID = /^[a-z][a-z0-9_]{2,127}$/u;
const ISSUER_BINDING_ID = "route_iq_customer_pwa_server_issuer";
const AUDIENCE_BINDING_ID = "route_iq_customer_pwa_server_audience";

function fail() {
  throw new Error("route_iq_paid_customer_server_authority_denied");
}

function validInstant(value) {
  return typeof value === "string"
    && Number.isFinite(Date.parse(value))
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(value);
}

function authoritativeCompanyId(authorization) {
  return authorization?.runtimeAuthorization?.zipCoverage?.companyId;
}

function principalRole(principal) {
  const founder = principal?.accessMode === "founder_explicit_workspace_read_only"
    && principal.capabilities?.readWorkspaceOperations === true;
  const workspaceAdministrator = principal?.capabilities?.readWorkspaceOperations === true
    && principal.capabilities?.administerWorkspaceRoster === true;
  if (!founder && !workspaceAdministrator) fail();
  return founder ? "founder" : "workspace_admin";
}

export function authorizeRouteIqPaidCustomerInfrastructureOperation({
  authorization,
  operation,
  requestedScope,
  now = new Date()
}) {
  const principal = authorization?.principal;
  const companyId = authoritativeCompanyId(authorization);
  if (!(now instanceof Date)
    || !Number.isFinite(now.getTime())
    || !Object.values(ROUTE_IQ_PAID_CUSTOMER_OPERATIONS).includes(operation)
    || !principal?.authorized
    || !STRICT_ID.test(companyId || "")
    || !STRICT_ID.test(principal.workspaceId || "")
    || !STRICT_ID.test(principal.operatingProfileId || "")
    || !STRICT_ID.test(principal.userId || "")
    || authorization?.runtimeAuthorization?.zipCoverage?.workspaceId !== principal.workspaceId
    || !validInstant(authorization?.accessExpiresAt)
    || Date.parse(authorization.accessExpiresAt) <= now.getTime()
    || requestedScope?.companyId !== companyId
    || requestedScope?.workspaceId !== principal.workspaceId) {
    fail();
  }

  const role = principalRole(principal);
  const authority = Object.freeze({
    contractVersion: ROUTE_IQ_PAID_CUSTOMER_SECURITY_VERSION,
    authority: ROUTE_IQ_PAID_CUSTOMER_AUTHORITY,
    expectedAudienceBindingId: AUDIENCE_BINDING_ID,
    expectedIssuerBindingId: ISSUER_BINDING_ID,
    bindings: Object.freeze([
      Object.freeze({
        active: true,
        bindingVersion: "v1.0.0",
        companyId,
        workspaceId: principal.workspaceId,
        operatingProfileId: principal.operatingProfileId,
        principalId: principal.userId,
        roleId: ROUTE_IQ_PAID_CUSTOMER_ROLES.administrator
      })
    ])
  });
  const issuedAt = new Date(now.getTime() - 1_000).toISOString();
  const context = bindRouteIqPaidCustomerPrincipal({
    authenticatedClaims: {
      audienceBindingId: AUDIENCE_BINDING_ID,
      authenticated: true,
      expiresAt: authorization.accessExpiresAt,
      issuedAt,
      issuerBindingId: ISSUER_BINDING_ID,
      principalId: principal.userId
    },
    requestedScope: {
      companyId,
      workspaceId: principal.workspaceId
    },
    authority,
    now
  });
  const decision = authorizeRouteIqPaidCustomerOperation(context, {
    companyId,
    workspaceId: principal.workspaceId,
    operation
  });
  if (!isTrustedRouteIqPaidCustomerDecision(decision)
    || assertRouteIqPaidCustomerStorageScope(decision, {
      companyId,
      workspaceId: principal.workspaceId
    }) !== true) {
    fail();
  }

  return Object.freeze({
    contractVersion: ROUTE_IQ_PAID_CUSTOMER_INFRASTRUCTURE_AUTHORITY_VERSION,
    authorizationState: "server_verified",
    principal: Object.freeze({
      authority: "server_authenticated_principal",
      companyId,
      workspaceId: principal.workspaceId,
      operatingProfileId: principal.operatingProfileId,
      userId: principal.userId,
      role
    }),
    decision
  });
}
