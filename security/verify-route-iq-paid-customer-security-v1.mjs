import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  ROUTE_IQ_PAID_CUSTOMER_AUTHORITY,
  ROUTE_IQ_PAID_CUSTOMER_OPERATIONS,
  ROUTE_IQ_PAID_CUSTOMER_ROLES,
  ROUTE_IQ_PAID_CUSTOMER_SECURITY_VERSION,
  assertRouteIqPaidCustomerStorageScope,
  authorizeRouteIqPaidCustomerOperation,
  bindRouteIqPaidCustomerPrincipal,
  isTrustedRouteIqPaidCustomerContext,
  isTrustedRouteIqPaidCustomerDecision,
  projectRouteIqPaidCustomerAdministrationAuthority,
  routeIqPaidCustomerSafeDenial
} from "./route-iq-paid-customer-isolation-v1.mjs";

const source = readFileSync(new URL(
  "./route-iq-paid-customer-isolation-v1.mjs",
  import.meta.url
), "utf8");

assert.doesNotMatch(source, /\bconsole\./u);
assert.doesNotMatch(source, /\beval\s*\(/u);
assert.doesNotMatch(source, /\bnew\s+Function\b/u);
assert.doesNotMatch(source, /error\.(?:message|stack)/u);
assert.doesNotMatch(source, /Authorization|Cookie|Set-Cookie/u);

const authority = {
  contractVersion: ROUTE_IQ_PAID_CUSTOMER_SECURITY_VERSION,
  authority: ROUTE_IQ_PAID_CUSTOMER_AUTHORITY,
  expectedIssuerBindingId: "synthetic_issuer_binding",
  expectedAudienceBindingId: "synthetic_audience_binding",
  bindings: [{
    active: true,
    bindingVersion: "v1.0.0",
    companyId: "synthetic_distribution_company",
    workspaceId: "synthetic_distribution_workspace",
    operatingProfileId: "commercial_distribution",
    principalId: "synthetic_principal_one",
    roleId: ROUTE_IQ_PAID_CUSTOMER_ROLES.representative
  }]
};

const context = bindRouteIqPaidCustomerPrincipal({
  authenticatedClaims: {
    authenticated: true,
    issuerBindingId: "synthetic_issuer_binding",
    audienceBindingId: "synthetic_audience_binding",
    principalId: "synthetic_principal_one",
    issuedAt: "2026-07-26T12:00:00.000Z",
    expiresAt: "2026-07-26T14:00:00.000Z"
  },
  requestedScope: {
    companyId: "synthetic_distribution_company",
    workspaceId: "synthetic_distribution_workspace"
  },
  authority,
  now: new Date("2026-07-26T13:00:00.000Z")
});
assert.equal(isTrustedRouteIqPaidCustomerContext(context), true);
assert.equal(Object.isFrozen(context), true);

const decision = authorizeRouteIqPaidCustomerOperation(context, {
  companyId: context.companyId,
  workspaceId: context.workspaceId,
  operation: ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.businessRead
});
assert.equal(isTrustedRouteIqPaidCustomerDecision(decision), true);
assert.equal(Object.isFrozen(decision), true);
assert.equal(assertRouteIqPaidCustomerStorageScope(decision, {
  companyId: context.companyId,
  workspaceId: context.workspaceId
}), true);

const denial = routeIqPaidCustomerSafeDenial();
assert.equal(denial.status, 404);
assert.deepEqual(Object.keys(denial.body).sort(), ["code", "message", "ok"]);
assert.equal(Object.isFrozen(denial), true);

const administrationFixtures = JSON.parse(readFileSync(new URL(
  "../administration/workspace-configurations/"
    + "route-iq-paid-customer-synthetic-fixtures-v1.json",
  import.meta.url
), "utf8")).configurations;
for (const configuration of administrationFixtures) {
  const role = configuration.access.roles[0];
  const principalId =
    `${configuration.operatingProfile.industryTemplateId}_verification_principal`;
  const projectedAuthority = projectRouteIqPaidCustomerAdministrationAuthority({
    configuration,
    expectedIssuerBindingId: "synthetic_issuer_binding",
    expectedAudienceBindingId: "synthetic_audience_binding",
    principalBindings: [{
      principalId,
      roleId: role.roleId
    }]
  });
  const projectedContext = bindRouteIqPaidCustomerPrincipal({
    authenticatedClaims: {
      authenticated: true,
      issuerBindingId: "synthetic_issuer_binding",
      audienceBindingId: "synthetic_audience_binding",
      principalId,
      issuedAt: "2026-07-26T12:00:00.000Z",
      expiresAt: "2026-07-26T14:00:00.000Z"
    },
    requestedScope: {
      companyId: configuration.company.companyId,
      workspaceId: configuration.company.workspaceId
    },
    authority: projectedAuthority,
    now: new Date("2026-07-26T13:00:00.000Z")
  });
  assert.equal(authorizeRouteIqPaidCustomerOperation(projectedContext, {
    companyId: configuration.company.companyId,
    workspaceId: configuration.company.workspaceId,
    operation: ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.dashboardRead
  }).authorized, true);
  assert.throws(() => authorizeRouteIqPaidCustomerOperation(projectedContext, {
    companyId: configuration.company.companyId,
    workspaceId: configuration.company.workspaceId,
    operation: ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.roleManage
  }));
}

process.stdout.write(
  "Route IQ paid-customer Security/Aegis contract verification passed.\n"
);
