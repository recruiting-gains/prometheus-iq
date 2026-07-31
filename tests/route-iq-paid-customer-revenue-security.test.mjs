import assert from "node:assert/strict";
import test from "node:test";

import {
  createPaidCustomerRevenueStore
} from "../crm/paid-customer-revenue-readiness-v1.mjs";
import {
  ROUTE_IQ_REVENUE_MODE,
  ROUTE_IQ_REVENUE_OPERATIONS,
  ROUTE_IQ_REVENUE_ROLES,
  applyRouteIqRevenueWorkspaceState,
  assertRouteIqRevenueLifecycleBlocked,
  authorizeRouteIqRevenueOperation,
  bindRouteIqRevenuePrincipal,
  createRouteIqRevenueAuditEvent,
  createRouteIqRevenueAuthority,
  createRouteIqRevenueWebhookBoundary,
  routeIqRevenueSafeDenial,
  secureBeginFictionalPayment,
  secureCreateFictionalBillingRecord,
  secureProcessFictionalWebhook,
  secureReadRevenueRecord
} from "../security/route-iq-paid-customer-revenue-v1.mjs";

const NOW = "2026-07-31T12:00:00.000Z";
const LATER = "2026-07-31T12:01:00.000Z";
const scope = {
  companyId: "company_fictional_atlas",
  workspaceId: "workspace_fictional_atlas",
  billingAccountId: "billing_fictional_atlas",
  customerId: "customer_fictional_atlas",
  subscriptionId: "subscription_fictional_atlas",
  invoiceId: "invoice_fictional_atlas",
  locationId: "location_fictional_atlas_north"
};
const otherScope = {
  companyId: "company_fictional_beacon",
  workspaceId: "workspace_fictional_beacon",
  billingAccountId: "billing_fictional_beacon",
  customerId: "customer_fictional_beacon",
  subscriptionId: "subscription_fictional_beacon",
  invoiceId: "invoice_fictional_beacon",
  locationId: "location_fictional_beacon_west"
};

function makeAuthority() {
  return createRouteIqRevenueAuthority({
    mode: ROUTE_IQ_REVENUE_MODE,
    resources: [{
      ...scope,
      locationIds: [scope.locationId]
    }, {
      ...otherScope,
      locationIds: [otherScope.locationId]
    }].map(({ locationId, ...value }) => value),
    bindings: [
      ["principal_fictional_founder", ROUTE_IQ_REVENUE_ROLES.founder, scope],
      ["principal_fictional_owner", ROUTE_IQ_REVENUE_ROLES.customerOwner, scope],
      ["principal_fictional_manager", ROUTE_IQ_REVENUE_ROLES.manager, scope],
      ["principal_fictional_representative", ROUTE_IQ_REVENUE_ROLES.representative, scope],
      ["principal_fictional_other_owner", ROUTE_IQ_REVENUE_ROLES.customerOwner, otherScope]
    ].map(([principalId, role, value]) => ({
      active: true,
      principalId,
      role,
      companyId: value.companyId,
      workspaceId: value.workspaceId
    }))
  });
}

function bind(authority, principalId, requested = scope, overrides = {}) {
  return bindRouteIqRevenuePrincipal({
    authority,
    claims: {
      authenticated: true,
      principalId,
      issuedAt: "2026-07-31T11:00:00.000Z",
      expiresAt: "2026-07-31T13:00:00.000Z",
      ...overrides
    },
    requestedScope: {
      companyId: requested.companyId,
      workspaceId: requested.workspaceId
    },
    now: new Date(NOW)
  });
}

function decision(context, operation, resource = scope, overrides = {}) {
  return authorizeRouteIqRevenueOperation(context, {
    ...resource,
    operation,
    ...overrides
  }, new Date(NOW));
}

function createInput() {
  return {
    companyDisplayName: "Atlas Fictional Rehearsal",
    planId: "plan_fictional_monthly",
    currency: "USD",
    unitAmountMinor: 25000
  };
}

test("only a factory-issued authority and authenticated unexpired session bind", () => {
  const authority = makeAuthority();
  assert.equal(bind(authority, "principal_fictional_owner").role,
    ROUTE_IQ_REVENUE_ROLES.customerOwner);
  for (const claims of [
    { authenticated: false },
    { expiresAt: NOW },
    { issuedAt: "2026-07-31T12:00:01.000Z" }
  ]) {
    assert.throws(
      () => bind(authority, "principal_fictional_owner", scope, claims),
      /resource is unavailable/u
    );
  }
  assert.throws(() => bindRouteIqRevenuePrincipal({
    authority: structuredClone(authority),
    claims: {
      authenticated: true,
      principalId: "principal_fictional_owner",
      issuedAt: "2026-07-31T11:00:00.000Z",
      expiresAt: "2026-07-31T13:00:00.000Z"
    },
    requestedScope: scope,
    now: new Date(NOW)
  }), /resource is unavailable/u);
});

test("anonymous, representative, manager, owner, and Founder policy is fail closed", () => {
  const authority = makeAuthority();
  assert.throws(() => bind(authority, "principal_fictional_unknown"),
    /resource is unavailable/u);
  const representative = bind(authority, "principal_fictional_representative");
  const manager = bind(authority, "principal_fictional_manager");
  const owner = bind(authority, "principal_fictional_owner");
  const founder = bind(authority, "principal_fictional_founder");
  assert.throws(() => decision(representative, ROUTE_IQ_REVENUE_OPERATIONS.read),
    /resource is unavailable/u);
  assert.equal(decision(manager, ROUTE_IQ_REVENUE_OPERATIONS.read).authorized, true);
  assert.throws(
    () => decision(manager, ROUTE_IQ_REVENUE_OPERATIONS.createFictional),
    /resource is unavailable/u
  );
  assert.equal(
    decision(owner, ROUTE_IQ_REVENUE_OPERATIONS.createFictional).authorized,
    true
  );
  assert.equal(
    decision(founder, ROUTE_IQ_REVENUE_OPERATIONS.processFictionalWebhook, scope, {
      eventId: "event_fictional_one"
    }).authorized,
    true
  );
});

test("cross-tenant and nonexistent resources return one non-enumerating denial", () => {
  const authority = makeAuthority();
  const owner = bind(authority, "principal_fictional_owner");
  const outputs = [];
  for (const target of [
    otherScope,
    { ...scope, companyId: "company_fictional_missing" },
    { ...scope, workspaceId: "workspace_fictional_missing" }
  ]) {
    assert.throws(() => decision(owner, ROUTE_IQ_REVENUE_OPERATIONS.read, target));
    outputs.push(routeIqRevenueSafeDenial());
  }
  assert.equal(new Set(outputs.map(JSON.stringify)).size, 1);
  assert.equal(outputs[0].status, 404);
});

test("altered customer, subscription, invoice, event, and location identities reject", () => {
  const founder = bind(makeAuthority(), "principal_fictional_founder");
  for (const mutation of [
    { customerId: "customer_fictional_altered" },
    { subscriptionId: "subscription_fictional_altered" },
    { invoiceId: "invoice_fictional_altered" },
    { locationId: "location_fictional_altered" }
  ]) {
    assert.throws(() => decision(
      founder,
      ROUTE_IQ_REVENUE_OPERATIONS.read,
      { ...scope, ...mutation }
    ));
  }
  assert.throws(() => decision(
    founder,
    ROUTE_IQ_REVENUE_OPERATIONS.processFictionalWebhook,
    scope,
    { eventId: "altered_event" }
  ));
});

test("TEST and Live modes cannot be mixed or forged", () => {
  assert.throws(() => createRouteIqRevenueAuthority({
    mode: "LIVE",
    resources: [],
    bindings: []
  }), /resource is unavailable/u);
  const authority = makeAuthority();
  const founder = bind(authority, "principal_fictional_founder");
  const valid = decision(founder, ROUTE_IQ_REVENUE_OPERATIONS.read);
  const forged = { ...valid, mode: "LIVE" };
  assert.throws(() => secureReadRevenueRecord(
    createPaidCustomerRevenueStore(),
    forged,
    NOW
  ), /resource is unavailable/u);
});

test("plain client values cannot forge trusted billing decisions", () => {
  const store = createPaidCustomerRevenueStore();
  assert.throws(() => secureCreateFictionalBillingRecord(store, {
    authorized: true,
    mode: "TEST",
    operation: ROUTE_IQ_REVENUE_OPERATIONS.createFictional,
    role: ROUTE_IQ_REVENUE_ROLES.founder,
    scope
  }, createInput(), NOW), /resource is unavailable/u);
});

test("trusted owner can create and read only the fictional scoped record", () => {
  const authority = makeAuthority();
  const owner = bind(authority, "principal_fictional_owner");
  const store = createPaidCustomerRevenueStore();
  const createDecision = decision(
    owner,
    ROUTE_IQ_REVENUE_OPERATIONS.createFictional
  );
  const created = secureCreateFictionalBillingRecord(
    store,
    createDecision,
    createInput(),
    NOW
  );
  assert.equal(created.activationState, "activation_blocked");
  assert.equal(created.liveReady, false);
  assert.equal(created.liveActive, false);
  const readDecision = decision(owner, ROUTE_IQ_REVENUE_OPERATIONS.read);
  assert.equal(secureReadRevenueRecord(store, readDecision, LATER).billingAccountId,
    scope.billingAccountId);
});

test("raw-byte webhook verification is mandatory and receives the exact bytes", async () => {
  const authority = makeAuthority();
  const founder = bind(authority, "principal_fictional_founder");
  const store = createPaidCustomerRevenueStore();
  secureCreateFictionalBillingRecord(
    store,
    decision(founder, ROUTE_IQ_REVENUE_OPERATIONS.createFictional),
    createInput(),
    NOW
  );
  secureBeginFictionalPayment(
    store,
    decision(founder, ROUTE_IQ_REVENUE_OPERATIONS.beginFictionalPayment),
    LATER
  );
  const eventId = "event_fictional_paid";
  const webhookDecision = decision(
    founder,
    ROUTE_IQ_REVENUE_OPERATIONS.processFictionalWebhook,
    scope,
    { eventId }
  );
  const payloadBytes = new TextEncoder().encode(JSON.stringify({
    eventId,
    eventType: "payment.simulated_succeeded",
    providerSequence: 1,
    occurredAt: "2026-07-31T12:02:00.000Z",
    companyId: scope.companyId,
    workspaceId: scope.workspaceId,
    billingAccountId: scope.billingAccountId
  }));
  let observed;
  const boundary = createRouteIqRevenueWebhookBoundary(
    webhookDecision,
    ({ signature, payloadBytes: exactBytes }) => {
      observed = exactBytes;
      return signature === "fictional-valid-signature";
    },
    LATER
  );
  const result = await secureProcessFictionalWebhook(
    store,
    webhookDecision,
    { signature: "fictional-valid-signature", payloadBytes },
    { boundary, now: "2026-07-31T12:02:01.000Z" }
  );
  assert.strictEqual(observed, payloadBytes);
  assert.equal(result.classification, "applied");
  assert.equal(result.record.activationState, "activation_blocked");
  assert.equal(result.record.liveActive, false);
});

test("modified bytes, wrong signature, oversized payload, and altered webhook scope reject", async () => {
  const authority = makeAuthority();
  const founder = bind(authority, "principal_fictional_founder");
  const eventId = "event_fictional_scope";
  const webhookDecision = decision(
    founder,
    ROUTE_IQ_REVENUE_OPERATIONS.processFictionalWebhook,
    scope,
    { eventId }
  );
  const boundary = createRouteIqRevenueWebhookBoundary(
    webhookDecision,
    ({ signature }) => signature === "fictional-valid-signature",
    LATER
  );
  const altered = new TextEncoder().encode(JSON.stringify({
    eventId,
    eventType: "payment.simulated_succeeded",
    providerSequence: 1,
    occurredAt: NOW,
    companyId: otherScope.companyId,
    workspaceId: scope.workspaceId,
    billingAccountId: scope.billingAccountId
  }));
  await assert.rejects(() => secureProcessFictionalWebhook(
    createPaidCustomerRevenueStore(),
    webhookDecision,
    { signature: "fictional-valid-signature", payloadBytes: altered },
    { boundary, now: LATER }
  ), /resource is unavailable/u);
  const oversized = new Uint8Array(65_537);
  const rejected = await boundary.verify({
    signature: "fictional-valid-signature",
    payloadBytes: oversized
  });
  assert.equal(rejected, false);
  assert.equal(await boundary.verify({
    signature: "fictional-wrong-signature",
    payloadBytes: new Uint8Array([123, 125])
  }), false);
});

test("duplicate and out-of-order events remain idempotent and cannot regress state", async () => {
  const authority = makeAuthority();
  const founder = bind(authority, "principal_fictional_founder");
  const store = createPaidCustomerRevenueStore();
  secureCreateFictionalBillingRecord(
    store,
    decision(founder, ROUTE_IQ_REVENUE_OPERATIONS.createFictional),
    createInput(),
    NOW
  );
  secureBeginFictionalPayment(
    store,
    decision(founder, ROUTE_IQ_REVENUE_OPERATIONS.beginFictionalPayment),
    LATER
  );
  const run = async (eventId, providerSequence) => {
    const webhookDecision = decision(
      founder,
      ROUTE_IQ_REVENUE_OPERATIONS.processFictionalWebhook,
      scope,
      { eventId }
    );
    const payloadBytes = new TextEncoder().encode(JSON.stringify({
      eventId,
      eventType: "payment.simulated_succeeded",
      providerSequence,
      occurredAt: "2026-07-31T12:02:00.000Z",
      companyId: scope.companyId,
      workspaceId: scope.workspaceId,
      billingAccountId: scope.billingAccountId
    }));
    const boundary = createRouteIqRevenueWebhookBoundary(
      webhookDecision,
      () => true,
      LATER
    );
    return secureProcessFictionalWebhook(
      store,
      webhookDecision,
      { signature: "fictional-valid-signature", payloadBytes },
      { boundary, now: "2026-07-31T12:02:01.000Z" }
    );
  };
  assert.equal((await run("event_fictional_first", 2)).classification, "applied");
  assert.equal((await run("event_fictional_first", 2)).classification,
    "duplicate_ignored");
  assert.equal((await run("event_fictional_stale", 1)).classification,
    "out_of_order_ignored");
});

test("Draft and Validated lifecycle inputs can never reach Active", () => {
  assert.deepEqual(assertRouteIqRevenueLifecycleBlocked("DRAFT"), {
    state: "DRAFT",
    activationState: "activation_blocked",
    liveReady: false,
    liveActive: false
  });
  assert.equal(assertRouteIqRevenueLifecycleBlocked("VALIDATED").liveActive, false);
  for (const state of ["ACTIVE", "READY_FOR_ACTIVATION", "LIVE"]) {
    assert.throws(() => assertRouteIqRevenueLifecycleBlocked(state));
  }
});

test("suspension revokes existing sessions and rollback-shaped inputs cannot restore them", () => {
  const authority = makeAuthority();
  const founder = bind(authority, "principal_fictional_founder");
  const manager = bind(authority, "principal_fictional_manager");
  const suspension = decision(
    founder,
    ROUTE_IQ_REVENUE_OPERATIONS.workspaceSuspend
  );
  assert.equal(
    applyRouteIqRevenueWorkspaceState(suspension, "SUSPENDED", LATER).access,
    "DENIED"
  );
  assert.throws(() => decision(manager, ROUTE_IQ_REVENUE_OPERATIONS.read));
  assert.throws(() => bind(authority, "principal_fictional_manager"));
  assert.throws(() => applyRouteIqRevenueWorkspaceState({
    ...suspension,
    rollback: true
  }, "ACTIVE", LATER));
});

test("offboarding is terminal for old contexts and cached decisions", () => {
  const authority = makeAuthority();
  const founder = bind(authority, "principal_fictional_founder");
  const read = decision(founder, ROUTE_IQ_REVENUE_OPERATIONS.read);
  const offboard = decision(
    founder,
    ROUTE_IQ_REVENUE_OPERATIONS.workspaceOffboard
  );
  applyRouteIqRevenueWorkspaceState(offboard, "OFFBOARDED", LATER);
  assert.throws(() => secureReadRevenueRecord(
    createPaidCustomerRevenueStore(),
    read,
    LATER
  ));
  assert.throws(() => bind(authority, "principal_fictional_founder"));
});

test("audit and denial outputs contain only fixed safe classifications", () => {
  const authority = makeAuthority();
  const founder = bind(authority, "principal_fictional_founder");
  const allowed = createRouteIqRevenueAuditEvent({
    decision: decision(founder, ROUTE_IQ_REVENUE_OPERATIONS.read),
    outcome: "ALLOWED",
    action: "revenue_read"
  });
  const denied = createRouteIqRevenueAuditEvent({
    decision: {
      secret: "synthetic-secret-canary",
      customerId: scope.customerId
    },
    outcome: "DENIED",
    action: "revenue_read"
  });
  for (const output of [allowed, denied, routeIqRevenueSafeDenial()]) {
    const serialized = JSON.stringify(output);
    assert.equal(serialized.includes("synthetic-secret-canary"), false);
    assert.equal(serialized.includes(scope.customerId), false);
    assert.equal(serialized.includes(scope.companyId), false);
  }
});

test("cached contexts and decisions deny execution after session expiry", () => {
  const authority = makeAuthority();
  const owner = bind(authority, "principal_fictional_owner");
  const cached = decision(owner, ROUTE_IQ_REVENUE_OPERATIONS.read);
  assert.throws(() => authorizeRouteIqRevenueOperation(
    owner,
    { ...scope, operation: ROUTE_IQ_REVENUE_OPERATIONS.read },
    new Date("2026-07-31T13:00:00.000Z")
  ));
  assert.throws(() => secureReadRevenueRecord(
    createPaidCustomerRevenueStore(),
    cached,
    "2026-07-31T13:00:00.000Z"
  ));
});
