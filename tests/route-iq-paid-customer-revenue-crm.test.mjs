import test from "node:test";
import assert from "node:assert/strict";
import {
  PaidCustomerRevenueError,
  beginSimulatedPayment,
  cancelPaidCustomerBilling,
  createPaidCustomerBillingRecord,
  createPaidCustomerRevenueStore,
  createSignedWebhookBoundary,
  paidCustomerRevenueEnvironment,
  processPaidCustomerBillingWebhook,
  readPaidCustomerBillingRecord,
  runFictionalPaidCustomerRevenueRehearsal,
  suspendPaidCustomerBilling,
  verifyPaidCustomerRevenueAudit
} from "../crm/paid-customer-revenue-readiness-v1.mjs";

const now = "2026-07-31T12:00:00.000Z";
const scopeA = {
  companyId: "company_fictional_alpha_rehearsal",
  workspaceId: "workspace_fictional_alpha_rehearsal",
  billingAccountId: "billing_fictional_alpha_rehearsal"
};
const scopeB = {
  companyId: "company_fictional_bravo_rehearsal",
  workspaceId: "workspace_fictional_bravo_rehearsal",
  billingAccountId: "billing_fictional_bravo_rehearsal"
};

function session(scope = scopeA, role = "revenue_owner", overrides = {}) {
  return {
    authenticated: true,
    principalId: "principal_fictional_revenue_owner",
    companyId: scope.companyId,
    workspaceId: scope.workspaceId,
    role,
    expiresAt: "2026-08-01T12:00:00.000Z",
    ...overrides
  };
}

function createRecord(store, scope = scopeA) {
  return createPaidCustomerBillingRecord(store, {
    ...scope,
    companyDisplayName: "Alpha Safety Fictional Rehearsal",
    planId: "plan_fictional_monthly",
    currency: "USD",
    unitAmountMinor: 25000
  }, { session: session(scope), now });
}

function event(scope = scopeA, overrides = {}) {
  return {
    eventId: "event_fictional_payment_001",
    eventType: "payment.simulated_succeeded",
    providerSequence: 1,
    occurredAt: "2026-07-31T12:02:00.000Z",
    ...scope,
    ...overrides
  };
}

function bytes(value) {
  return new TextEncoder().encode(JSON.stringify(value));
}

function boundary(valid = true) {
  return createSignedWebhookBoundary({
    verifySignature: async () => valid
  });
}

async function apply(store, payload, options = {}) {
  return processPaidCustomerBillingWebhook(
    store,
    {
      signature: options.signature || "fictional-valid-signature",
      payloadBytes: bytes(payload)
    },
    {
      boundary: options.boundary || boundary(),
      now: options.now || "2026-07-31T12:02:01.000Z"
    }
  );
}

function expectCode(code, operation) {
  assert.throws(operation, error => {
    assert.ok(error instanceof PaidCustomerRevenueError);
    assert.equal(error.code, code);
    return true;
  });
}

async function expectCodeAsync(code, operation) {
  await assert.rejects(operation, error => {
    assert.ok(error instanceof PaidCustomerRevenueError);
    assert.equal(error.code, code);
    return true;
  });
}

test("billing records are fictional, server-authoritative, scoped, and activation-blocked", () => {
  const store = createPaidCustomerRevenueStore();
  const record = createRecord(store);
  assert.equal(store.environment, paidCustomerRevenueEnvironment);
  assert.equal(record.billingState, "billing_incomplete");
  assert.equal(record.activationState, "activation_blocked");
  assert.equal(record.liveReady, false);
  assert.equal(record.liveActive, false);
  assert.equal(verifyPaidCustomerRevenueAudit(record), true);

  expectCode("unknown_field", () => createPaidCustomerBillingRecord(
    createPaidCustomerRevenueStore(),
    {
      ...scopeA,
      companyDisplayName: "Fictional Authority Attempt",
      planId: "plan_fictional_monthly",
      currency: "USD",
      unitAmountMinor: 1,
      billingState: "simulated_paid"
    },
    { session: session(), now }
  ));
  expectCode("fictional_identity_required", () => createPaidCustomerBillingRecord(
    createPaidCustomerRevenueStore(),
    {
      ...scopeA,
      companyDisplayName: "Real Company",
      planId: "plan_fictional_monthly",
      currency: "USD",
      unitAmountMinor: 1
    },
    { session: session(), now }
  ));
});

test("tenant, workspace, identifier, role, anonymous, and expired-session boundaries fail closed", () => {
  const store = createPaidCustomerRevenueStore();
  createRecord(store);
  expectCode("scope_forbidden", () => readPaidCustomerBillingRecord(
    store,
    scopeA,
    { session: session(scopeB), now }
  ));
  expectCode("billing_record_not_found", () => readPaidCustomerBillingRecord(
    store,
    { ...scopeA, billingAccountId: "billing_fictional_alpha_altered" },
    { session: session(), now }
  ));
  expectCode("role_forbidden", () => beginSimulatedPayment(
    store,
    scopeA,
    { session: session(scopeA, "auditor"), now }
  ));
  expectCode("authentication_required", () => readPaidCustomerBillingRecord(
    store,
    scopeA,
    { session: session(scopeA, "auditor", { authenticated: false }), now }
  ));
  expectCode("session_expired", () => readPaidCustomerBillingRecord(
    store,
    scopeA,
    {
      session: session(scopeA, "auditor", { expiresAt: "2026-07-31T11:59:59.000Z" }),
      now
    }
  ));
});

test("signed webhook boundary rejects invalid signatures and malformed payloads", async () => {
  const store = createPaidCustomerRevenueStore();
  createRecord(store);
  beginSimulatedPayment(store, scopeA, { session: session(), now });
  await expectCodeAsync("invalid_signature", () => apply(
    store,
    event(),
    { boundary: boundary(false) }
  ));
  await expectCodeAsync("invalid_webhook_payload", () => processPaidCustomerBillingWebhook(
    store,
    {
      signature: "fictional-valid-signature",
      payloadBytes: new TextEncoder().encode("{{")
    },
    { boundary: boundary(), now }
  ));
  const unchanged = readPaidCustomerBillingRecord(store, scopeA, {
    session: session(scopeA, "auditor"),
    now
  });
  assert.equal(unchanged.billingState, "payment_pending");
});

test("successful and failed simulated payments remain independent from activation", async () => {
  for (const [eventType, expectedState] of [
    ["payment.simulated_succeeded", "simulated_paid"],
    ["payment.simulated_failed", "payment_failed"]
  ]) {
    const store = createPaidCustomerRevenueStore();
    createRecord(store);
    beginSimulatedPayment(store, scopeA, { session: session(), now });
    const result = await apply(store, event(scopeA, { eventType }));
    assert.equal(result.classification, "applied");
    assert.equal(result.record.billingState, expectedState);
    assert.equal(result.record.activationState, "activation_blocked");
    assert.equal(result.record.liveReady, false);
    assert.equal(result.record.liveActive, false);
    assert.equal(verifyPaidCustomerRevenueAudit(result.record), true);
  }
});

test("duplicate, replay, altered event identifiers, and out-of-order events are deterministic", async () => {
  const store = createPaidCustomerRevenueStore();
  createRecord(store);
  beginSimulatedPayment(store, scopeA, { session: session(), now });
  const first = await apply(store, event());
  assert.equal(first.classification, "applied");
  const replay = await apply(store, event());
  assert.equal(replay.classification, "duplicate_ignored");
  await expectCodeAsync("event_identifier_conflict", () => apply(
    store,
    event(scopeA, { eventType: "payment.simulated_failed" })
  ));
  const stale = await apply(store, event(scopeA, {
    eventId: "event_fictional_stale_002",
    eventType: "subscription.simulated_canceled",
    providerSequence: 1
  }));
  assert.equal(stale.classification, "out_of_order_ignored");
  assert.equal(stale.record.billingState, "simulated_paid");
  assert.equal(verifyPaidCustomerRevenueAudit(stale.record), true);
});

test("webhook scope cannot be substituted across tenants", async () => {
  const store = createPaidCustomerRevenueStore();
  createRecord(store);
  createRecord(store, scopeB);
  beginSimulatedPayment(store, scopeA, { session: session(), now });
  await expectCodeAsync("billing_record_not_found", () => apply(
    store,
    event({ ...scopeA, workspaceId: scopeB.workspaceId })
  ));
  assert.equal(readPaidCustomerBillingRecord(store, scopeA, {
    session: session(scopeA, "auditor"),
    now
  }).billingState, "payment_pending");
  assert.equal(readPaidCustomerBillingRecord(store, scopeB, {
    session: session(scopeB, "auditor"),
    now
  }).billingState, "billing_incomplete");
});

test("suspension and cancellation preserve audit evidence and cannot activate a customer", async () => {
  const store = createPaidCustomerRevenueStore();
  createRecord(store);
  beginSimulatedPayment(store, scopeA, { session: session(), now });
  await apply(store, event());
  const suspended = suspendPaidCustomerBilling(store, scopeA, {
    session: session(),
    now: "2026-07-31T12:03:00.000Z",
    reasonCode: "risk_review"
  });
  assert.equal(suspended.billingState, "suspended");
  const canceled = cancelPaidCustomerBilling(store, scopeA, {
    session: session(),
    now: "2026-07-31T12:04:00.000Z",
    reasonCode: "rehearsal_cleanup"
  });
  assert.equal(canceled.billingState, "canceled");
  assert.equal(canceled.activationState, "activation_blocked");
  assert.equal(canceled.liveReady, false);
  assert.equal(canceled.liveActive, false);
  assert.equal(verifyPaidCustomerRevenueAudit(canceled), true);
  expectCode("billing_transition_forbidden", () => suspendPaidCustomerBilling(
    store,
    scopeA,
    { session: session(), now, reasonCode: "nonpayment" }
  ));

  const tampered = structuredClone(canceled);
  tampered.audit[1].outcome = "changed";
  assert.equal(verifyPaidCustomerRevenueAudit(tampered), false);
});

test("complete fictional rehearsal handles success, failure, and replay with cleanup", async () => {
  const success = await runFictionalPaidCustomerRevenueRehearsal({ scenario: "success" });
  const failure = await runFictionalPaidCustomerRevenueRehearsal({ scenario: "failure" });
  const replay = await runFictionalPaidCustomerRevenueRehearsal({ scenario: "replay" });

  assert.deepEqual(
    [success.billingState, failure.billingState, replay.billingState],
    ["simulated_paid", "payment_failed", "simulated_paid"]
  );
  assert.equal(replay.replay, "duplicate_ignored");
  for (const result of [success, failure, replay]) {
    assert.equal(result.activationState, "activation_blocked");
    assert.equal(result.liveReady, false);
    assert.equal(result.liveActive, false);
    assert.equal(result.auditValid, true);
    assert.equal(result.productionWrites, 0);
    assert.equal(result.stripeCalls, 0);
  }
});
