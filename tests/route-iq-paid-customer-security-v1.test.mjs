import assert from "node:assert/strict";
import test from "node:test";

import {
  ROUTE_IQ_PAID_CUSTOMER_AUTHORITY,
  ROUTE_IQ_PAID_CUSTOMER_FAILURE_CLASSIFICATIONS,
  ROUTE_IQ_PAID_CUSTOMER_OPERATIONS,
  ROUTE_IQ_PAID_CUSTOMER_ROLES,
  ROUTE_IQ_PAID_CUSTOMER_SECURITY_VERSION,
  assertRouteIqPaidCustomerStorageScope,
  authorizeRouteIqPaidCustomerOperation,
  bindRouteIqPaidCustomerPrincipal,
  classifyRouteIqPaidCustomerSecurityFailure,
  createRouteIqPaidCustomerSecurityAuditEvent,
  isTrustedRouteIqPaidCustomerContext,
  isTrustedRouteIqPaidCustomerDecision,
  routeIqPaidCustomerSafeDenial,
  validateRouteIqPaidCustomerDisplayTerminology
} from "../security/route-iq-paid-customer-isolation-v1.mjs";

const NOW = new Date("2026-07-26T13:00:00.000Z");
const SECRET_CANARIES = [
  "synthetic-secret-canary",
  "synthetic@example.invalid",
  "synthetic-raw-subject",
  "synthetic-auth-header",
  "synthetic-cookie-value"
];

function clone(value) {
  return structuredClone(value);
}

function authority() {
  return {
    contractVersion: ROUTE_IQ_PAID_CUSTOMER_SECURITY_VERSION,
    authority: ROUTE_IQ_PAID_CUSTOMER_AUTHORITY,
    expectedIssuerBindingId: "synthetic_issuer_binding",
    expectedAudienceBindingId: "synthetic_audience_binding",
    bindings: [{
      active: true,
      bindingVersion: "v1.0.0",
      companyId: "synthetic_medical_company",
      workspaceId: "synthetic_medical_workspace",
      operatingProfileId: "medical_business_development",
      principalId: "synthetic_medical_representative",
      roleId: ROUTE_IQ_PAID_CUSTOMER_ROLES.representative
    }, {
      active: true,
      bindingVersion: "v1.1.0",
      companyId: "synthetic_medical_company",
      workspaceId: "synthetic_medical_workspace",
      operatingProfileId: "medical_business_development",
      principalId: "synthetic_medical_manager",
      roleId: ROUTE_IQ_PAID_CUSTOMER_ROLES.manager
    }, {
      active: true,
      bindingVersion: "v2.0.0",
      companyId: "synthetic_security_company",
      workspaceId: "synthetic_security_workspace",
      operatingProfileId: "security_services",
      principalId: "synthetic_security_administrator",
      roleId: ROUTE_IQ_PAID_CUSTOMER_ROLES.administrator
    }]
  };
}

function claims(principalId = "synthetic_medical_representative", overrides = {}) {
  return {
    authenticated: true,
    issuerBindingId: "synthetic_issuer_binding",
    audienceBindingId: "synthetic_audience_binding",
    principalId,
    issuedAt: "2026-07-26T12:00:00.000Z",
    expiresAt: "2026-07-26T14:00:00.000Z",
    ...overrides
  };
}

function scope(overrides = {}) {
  return {
    companyId: "synthetic_medical_company",
    workspaceId: "synthetic_medical_workspace",
    ...overrides
  };
}

function bindRepresentative(overrides = {}) {
  return bindRouteIqPaidCustomerPrincipal({
    authenticatedClaims: claims(),
    requestedScope: scope(),
    authority: authority(),
    now: NOW,
    ...overrides
  });
}

function captureFailure(callback) {
  try {
    callback();
  } catch (error) {
    return error;
  }
  assert.fail("Expected the security contract to fail closed.");
}

function serialized(value) {
  return JSON.stringify(value);
}

function assertNoCanaries(value) {
  const output = serialized(value);
  for (const canary of SECRET_CANARIES) {
    assert.equal(output.includes(canary), false);
  }
}

test("server authority binds one immutable company/workspace security context", () => {
  const context = bindRepresentative();
  assert.equal(isTrustedRouteIqPaidCustomerContext(context), true);
  assert.equal(Object.isFrozen(context), true);
  assert.deepEqual(context, {
    contractVersion: ROUTE_IQ_PAID_CUSTOMER_SECURITY_VERSION,
    authority: ROUTE_IQ_PAID_CUSTOMER_AUTHORITY,
    principalId: "synthetic_medical_representative",
    companyId: "synthetic_medical_company",
    workspaceId: "synthetic_medical_workspace",
    operatingProfileId: "medical_business_development",
    roleId: ROUTE_IQ_PAID_CUSTOMER_ROLES.representative,
    bindingVersion: "v1.0.0",
    sessionExpiresAt: "2026-07-26T14:00:00.000Z"
  });
  assert.equal("issuerBindingId" in context, false);
  assert.equal("audienceBindingId" in context, false);
  assert.throws(() => {
    context.workspaceId = "synthetic_security_workspace";
  }, TypeError);
});

test("issuer, audience, expiry, authentication, and unknown principals fail closed", () => {
  const variants = [
    claims("synthetic_medical_representative", {
      issuerBindingId: "synthetic_wrong_issuer"
    }),
    claims("synthetic_medical_representative", {
      audienceBindingId: "synthetic_wrong_audience"
    }),
    claims("synthetic_medical_representative", {
      expiresAt: "2026-07-26T13:00:00.000Z"
    }),
    claims("synthetic_medical_representative", {
      issuedAt: "2026-07-26T13:00:01.000Z"
    }),
    claims("synthetic_medical_representative", {
      authenticated: false
    }),
    claims("synthetic_unknown_principal")
  ];
  const denials = [];
  for (const authenticatedClaims of variants) {
    const error = captureFailure(() => bindRouteIqPaidCustomerPrincipal({
      authenticatedClaims,
      requestedScope: scope(),
      authority: authority(),
      now: NOW
    }));
    assert.equal(error.message, "Route IQ authorization is unavailable.");
    assert.equal(error.code, "route_iq_access_denied");
    denials.push(routeIqPaidCustomerSafeDenial(error));
  }
  assert.equal(new Set(denials.map(serialized)).size, 1);
});

test("duplicate authoritative bindings cannot create an ambiguous tenant context", () => {
  const duplicateAuthority = authority();
  duplicateAuthority.bindings.push(clone(duplicateAuthority.bindings[0]));
  const error = captureFailure(() => bindRouteIqPaidCustomerPrincipal({
    authenticatedClaims: claims(),
    requestedScope: scope(),
    authority: duplicateAuthority,
    now: NOW
  }));
  assert.equal(
    classifyRouteIqPaidCustomerSecurityFailure(error),
    ROUTE_IQ_PAID_CUSTOMER_FAILURE_CLASSIFICATIONS.bindingAmbiguous
  );
});

test("cross-company, cross-workspace, and nonexistent scopes are non-enumerating", () => {
  const context = bindRepresentative();
  const targets = [
    {
      companyId: "synthetic_security_company",
      workspaceId: "synthetic_security_workspace"
    },
    {
      companyId: "synthetic_medical_company",
      workspaceId: "synthetic_security_workspace"
    },
    {
      companyId: "synthetic_missing_company",
      workspaceId: "synthetic_missing_workspace"
    }
  ];
  const outwardDenials = [];
  for (const target of targets) {
    const error = captureFailure(() => authorizeRouteIqPaidCustomerOperation(context, {
      ...target,
      operation: ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.businessRead
    }));
    outwardDenials.push(routeIqPaidCustomerSafeDenial(error));
  }
  assert.equal(new Set(outwardDenials.map(serialized)).size, 1);
  assert.deepEqual(outwardDenials[0], {
    status: 404,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8"
    },
    body: {
      ok: false,
      code: "route_iq_resource_unavailable",
      message: "Route IQ resource is unavailable."
    }
  });
});

test("every read, modify, and recommendation operation is tenant bound", () => {
  const context = bindRepresentative();
  for (const operation of [
    ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.dashboardRead,
    ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.businessRead,
    ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.recommendationReceive
  ]) {
    const sameTenant = authorizeRouteIqPaidCustomerOperation(context, {
      companyId: context.companyId,
      workspaceId: context.workspaceId,
      operation
    });
    assert.equal(isTrustedRouteIqPaidCustomerDecision(sameTenant), true);
    assert.throws(
      () => authorizeRouteIqPaidCustomerOperation(context, {
        companyId: "synthetic_security_company",
        workspaceId: "synthetic_security_workspace",
        operation
      }),
      error => error.code === "route_iq_access_denied"
    );
  }
  assert.throws(
    () => authorizeRouteIqPaidCustomerOperation(context, {
      companyId: context.companyId,
      workspaceId: context.workspaceId,
      operation: ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.workspaceRecordsModify
    }),
    error => (
      classifyRouteIqPaidCustomerSecurityFailure(error)
      === ROUTE_IQ_PAID_CUSTOMER_FAILURE_CLASSIFICATIONS.roleDenied
    )
  );
});

test("representatives are restricted to their own record and outcome scope", () => {
  const context = bindRepresentative();
  for (const operation of [
    ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.ownRecordRead,
    ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.ownOutcomeWrite
  ]) {
    const decision = authorizeRouteIqPaidCustomerOperation(context, {
      companyId: context.companyId,
      workspaceId: context.workspaceId,
      operation,
      resourceOwnerPrincipalId: context.principalId
    });
    assert.deepEqual(decision.storageScope, {
      companyId: "synthetic_medical_company",
      workspaceId: "synthetic_medical_workspace",
      principalId: "synthetic_medical_representative"
    });
    assert.throws(
      () => authorizeRouteIqPaidCustomerOperation(context, {
        companyId: context.companyId,
        workspaceId: context.workspaceId,
        operation,
        resourceOwnerPrincipalId: "synthetic_medical_manager"
      }),
      error => error.code === "route_iq_access_denied"
    );
  }
});

test("manager and administrator grants remain explicit and least privileged", () => {
  const manager = bindRouteIqPaidCustomerPrincipal({
    authenticatedClaims: claims("synthetic_medical_manager"),
    requestedScope: scope(),
    authority: authority(),
    now: NOW
  });
  assert.equal(authorizeRouteIqPaidCustomerOperation(manager, {
    ...scope(),
    operation: ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.workspaceRecordsRead
  }).authorized, true);
  assert.throws(() => authorizeRouteIqPaidCustomerOperation(manager, {
    ...scope(),
    operation: ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.configurationPreview
  }));

  const administrator = bindRouteIqPaidCustomerPrincipal({
    authenticatedClaims: claims("synthetic_security_administrator"),
    requestedScope: {
      companyId: "synthetic_security_company",
      workspaceId: "synthetic_security_workspace"
    },
    authority: authority(),
    now: NOW
  });
  assert.equal(authorizeRouteIqPaidCustomerOperation(administrator, {
    companyId: administrator.companyId,
    workspaceId: administrator.workspaceId,
    operation: ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.configurationPreview
  }).authorized, true);
  assert.equal(authorizeRouteIqPaidCustomerOperation(administrator, {
    companyId: administrator.companyId,
    workspaceId: administrator.workspaceId,
    operation: ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.workspaceSuspend
  }).authorized, true);
  assert.throws(() => authorizeRouteIqPaidCustomerOperation(administrator, {
    companyId: administrator.companyId,
    workspaceId: administrator.workspaceId,
    operation: ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.recommendationReceive
  }));
});

test("unknown enumeration operations and forged contexts fail before lookup", () => {
  const forgedContext = {
    ...bindRepresentative(),
    companyId: "synthetic_security_company",
    workspaceId: "synthetic_security_workspace"
  };
  assert.equal(isTrustedRouteIqPaidCustomerContext(forgedContext), false);
  assert.throws(
    () => authorizeRouteIqPaidCustomerOperation(forgedContext, {
      companyId: forgedContext.companyId,
      workspaceId: forgedContext.workspaceId,
      operation: ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.businessRead
    }),
    error => (
      classifyRouteIqPaidCustomerSecurityFailure(error)
      === ROUTE_IQ_PAID_CUSTOMER_FAILURE_CLASSIFICATIONS.trustedContextRequired
    )
  );
  assert.throws(
    () => authorizeRouteIqPaidCustomerOperation(bindRepresentative(), {
      ...scope(),
      operation: "company_enumerate"
    }),
    error => error.code === "route_iq_access_denied"
  );
});

test("storage access requires the exact server-authorized tenant filters", () => {
  const context = bindRepresentative();
  const decision = authorizeRouteIqPaidCustomerOperation(context, {
    ...scope(),
    operation: ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.businessRead
  });
  assert.equal(assertRouteIqPaidCustomerStorageScope(decision, scope()), true);
  for (const queryScope of [
    { companyId: context.companyId },
    { workspaceId: context.workspaceId },
    {
      companyId: "synthetic_security_company",
      workspaceId: context.workspaceId
    },
    {
      companyId: context.companyId,
      workspaceId: "synthetic_security_workspace"
    },
    {
      companyId: context.companyId,
      workspaceId: context.workspaceId,
      principalId: context.principalId
    }
  ]) {
    assert.throws(
      () => assertRouteIqPaidCustomerStorageScope(decision, queryScope),
      error => error.code === "route_iq_access_denied"
    );
  }
  assert.throws(() => assertRouteIqPaidCustomerStorageScope({
    ...decision
  }, scope()));
});

test("hostile labels and template, markup, query, and directional input fail closed", () => {
  const hostileLabels = [
    "<script>alert(1)</script>",
    "${globalThis.process}",
    "{{constructor.constructor}}",
    "javascript:alert(1)",
    "data:text/html",
    "Referral\" OR \"1\"=\"1",
    "UNION SELECT secrets",
    "DROP TABLE outcomes",
    "Buyer\u202ecod.exe",
    "Outcome\nHeader",
    "  Leading space",
    "Double  space"
  ];
  for (const label of hostileLabels) {
    assert.throws(
      () => validateRouteIqPaidCustomerDisplayTerminology({
        configurationVersion: "v1.0.0",
        internalMetricId: "qualified_outcome",
        singularLabel: label,
        pluralLabel: "Qualified outcomes"
      }),
      error => (
        classifyRouteIqPaidCustomerSecurityFailure(error)
        === ROUTE_IQ_PAID_CUSTOMER_FAILURE_CLASSIFICATIONS.labelUnsafe
      )
    );
  }
});

test("safe terminology keeps stable IDs separate from immutable display labels", () => {
  const terminology = validateRouteIqPaidCustomerDisplayTerminology({
    configurationVersion: "v3.2.1",
    internalMetricId: "qualified_outcome",
    singularLabel: "Facility visit",
    pluralLabel: "Facility visits"
  });
  assert.deepEqual(terminology, {
    contractVersion: ROUTE_IQ_PAID_CUSTOMER_SECURITY_VERSION,
    configurationVersion: "v3.2.1",
    internalMetricId: "qualified_outcome",
    singularLabel: "Facility visit",
    pluralLabel: "Facility visits",
    renderingContract: "text_content_only"
  });
  assert.equal(Object.isFrozen(terminology), true);
});

test("safe audit records omit untrusted target scope, errors, credentials, and PII", () => {
  const context = bindRepresentative();
  const crossTenantError = captureFailure(() => authorizeRouteIqPaidCustomerOperation(context, {
    companyId: "synthetic_security_company",
    workspaceId: "synthetic_security_workspace",
    operation: ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.businessRead,
    secret: SECRET_CANARIES[0]
  }));
  crossTenantError.message = SECRET_CANARIES[1];
  crossTenantError.stack = SECRET_CANARIES[2];
  const event = createRouteIqPaidCustomerSecurityAuditEvent({
    eventId: "security_event_denied",
    occurredAt: "2026-07-26T13:01:00.000Z",
    outcome: "DENIED",
    operation: ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.businessRead,
    context,
    decision: undefined,
    error: crossTenantError
  });
  assert.equal(event.companyId, context.companyId);
  assert.equal(event.workspaceId, context.workspaceId);
  assert.equal(serialized(event).includes("synthetic_security_company"), false);
  assert.equal(serialized(event).includes("synthetic_security_workspace"), false);
  assert.equal("message" in event, false);
  assert.equal("stack" in event, false);
  assertNoCanaries(event);
});

test("allowed audit records accept only trusted decisions and fixed fields", () => {
  const context = bindRepresentative();
  const decision = authorizeRouteIqPaidCustomerOperation(context, {
    ...scope(),
    operation: ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.dashboardRead
  });
  const event = createRouteIqPaidCustomerSecurityAuditEvent({
    eventId: "security_event_allowed",
    occurredAt: "2026-07-26T13:02:00.000Z",
    outcome: "ALLOWED",
    operation: decision.operation,
    context,
    decision,
    error: undefined
  });
  assert.deepEqual(Object.keys(event).sort(), [
    "bindingVersion",
    "companyId",
    "contractVersion",
    "eventId",
    "eventType",
    "occurredAt",
    "operation",
    "outcome",
    "principalBinding",
    "principalId",
    "roleId",
    "workspaceId"
  ]);
  assert.equal(Object.isFrozen(event), true);
  assert.throws(() => createRouteIqPaidCustomerSecurityAuditEvent({
    eventId: "security_event_forged",
    occurredAt: "2026-07-26T13:03:00.000Z",
    outcome: "ALLOWED",
    operation: decision.operation,
    context,
    decision: { ...decision },
    error: undefined
  }));
});

test("claims reject extra credential and identity fields without disclosing values", () => {
  for (const [key, value] of [
    ["token", SECRET_CANARIES[0]],
    ["email", SECRET_CANARIES[1]],
    ["subject", SECRET_CANARIES[2]],
    ["authorization", SECRET_CANARIES[3]],
    ["cookie", SECRET_CANARIES[4]]
  ]) {
    const error = captureFailure(() => bindRouteIqPaidCustomerPrincipal({
      authenticatedClaims: {
        ...claims(),
        [key]: value
      },
      requestedScope: scope(),
      authority: authority(),
      now: NOW
    }));
    assertNoCanaries({
      message: error.message,
      code: error.code,
      classification: classifyRouteIqPaidCustomerSecurityFailure(error),
      response: routeIqPaidCustomerSafeDenial(error)
    });
  }
});

test("all externally safe denials are immutable and contain no claim dimensions", () => {
  const denial = routeIqPaidCustomerSafeDenial();
  assert.equal(Object.isFrozen(denial), true);
  assert.equal(Object.isFrozen(denial.headers), true);
  assert.equal(Object.isFrozen(denial.body), true);
  for (const forbidden of [
    "company",
    "workspace",
    "principal",
    "issuer",
    "audience",
    "role",
    "token",
    "secret",
    "email"
  ]) {
    assert.equal(serialized(denial).toLowerCase().includes(forbidden), false);
  }
});
