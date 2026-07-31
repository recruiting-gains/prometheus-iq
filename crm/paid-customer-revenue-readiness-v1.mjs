import { createHash, timingSafeEqual } from "node:crypto";

export const paidCustomerRevenueContractVersion = "route_iq_paid_customer_revenue_readiness.v1";
export const paidCustomerRevenueEnvironment = "fictional_test_disabled";

export const paidCustomerBillingStates = Object.freeze([
  "billing_incomplete",
  "payment_pending",
  "simulated_paid",
  "payment_failed",
  "suspended",
  "canceled"
]);

export const paidCustomerActivationStates = Object.freeze([
  "activation_blocked"
]);

const permittedRoles = new Set(["revenue_owner", "billing_manager", "auditor"]);
const mutationRoles = new Set(["revenue_owner", "billing_manager"]);
const webhookEventTypes = new Set([
  "payment.simulated_succeeded",
  "payment.simulated_failed",
  "subscription.simulated_canceled"
]);
const idPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;
const currencyPattern = /^[A-Z]{3}$/u;
const signaturePattern = /^[A-Za-z0-9._~-]{16,512}$/u;

export class PaidCustomerRevenueError extends Error {
  constructor(code) {
    super(`Paid-customer revenue operation rejected: ${code}.`);
    this.name = "PaidCustomerRevenueError";
    this.code = code;
  }
}

function fail(code) {
  throw new PaidCustomerRevenueError(code);
}

function plainObject(value) {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!plainObject(value)) return value;
  return Object.fromEntries(
    Object.keys(value).sort().map(key => [key, canonicalize(value[key])])
  );
}

function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function digest(value) {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

function exactKeys(value, required, optional = []) {
  if (!plainObject(value)) fail("invalid_object");
  for (const key of required) {
    if (!Object.hasOwn(value, key)) fail("missing_required_field");
  }
  const allowed = new Set([...required, ...optional]);
  if (Object.keys(value).some(key => !allowed.has(key))) fail("unknown_field");
}

function identifier(value, prefix) {
  if (
    typeof value !== "string"
    || value.length < 8
    || value.length > 96
    || !idPattern.test(value)
    || !value.startsWith(prefix)
  ) {
    fail("invalid_identifier");
  }
  return value;
}

function timestamp(value, now, { allowFuture = false } = {}) {
  if (typeof value !== "string") fail("invalid_timestamp");
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) fail("invalid_timestamp");
  if (!allowFuture && parsed > now.getTime() + 300_000) fail("future_timestamp");
  return new Date(parsed).toISOString();
}

function requireFictional(value) {
  if (
    typeof value !== "string"
    || value.length < 3
    || value.length > 96
    || !/(?:fictional|synthetic|rehearsal)/iu.test(value)
  ) {
    fail("fictional_identity_required");
  }
  return value.trim();
}

function scopedKey(companyId, workspaceId, billingAccountId) {
  return `${companyId}\u0000${workspaceId}\u0000${billingAccountId}`;
}

function auditReceipt(previousReceipt, entry) {
  return digest({
    contractVersion: paidCustomerRevenueContractVersion,
    previousReceipt,
    entry
  });
}

function appendAudit(record, entry) {
  const safeEntry = {
    sequence: record.audit.length + 1,
    action: entry.action,
    outcome: entry.outcome,
    occurredAt: entry.occurredAt,
    eventId: entry.eventId || null,
    reasonCode: entry.reasonCode || null
  };
  const previousReceipt = record.audit.at(-1)?.receipt || null;
  const receipt = auditReceipt(previousReceipt, safeEntry);
  record.audit.push({ ...safeEntry, receipt });
  record.updatedAt = safeEntry.occurredAt;
  return receipt;
}

function assertSession(session, scope, now, roles = permittedRoles) {
  exactKeys(session, [
    "authenticated",
    "principalId",
    "companyId",
    "workspaceId",
    "role",
    "expiresAt"
  ]);
  if (session.authenticated !== true) fail("authentication_required");
  identifier(session.principalId, "principal_");
  if (Date.parse(session.expiresAt) <= now.getTime()) fail("session_expired");
  if (!roles.has(session.role)) fail("role_forbidden");
  if (
    session.companyId !== scope.companyId
    || session.workspaceId !== scope.workspaceId
  ) {
    fail("scope_forbidden");
  }
}

function requireScope(scope) {
  if (!plainObject(scope)) fail("invalid_object");
  for (const key of ["companyId", "workspaceId", "billingAccountId"]) {
    if (!Object.hasOwn(scope, key)) fail("missing_required_field");
  }
  return {
    companyId: identifier(scope.companyId, "company_"),
    workspaceId: identifier(scope.workspaceId, "workspace_"),
    billingAccountId: identifier(scope.billingAccountId, "billing_")
  };
}

function readMutable(store, scope) {
  const record = store.records.get(scopedKey(
    scope.companyId,
    scope.workspaceId,
    scope.billingAccountId
  ));
  if (!record) fail("billing_record_not_found");
  if (
    record.companyId !== scope.companyId
    || record.workspaceId !== scope.workspaceId
    || record.billingAccountId !== scope.billingAccountId
  ) {
    fail("stored_scope_mismatch");
  }
  return record;
}

export function createPaidCustomerRevenueStore() {
  return {
    contractVersion: paidCustomerRevenueContractVersion,
    environment: paidCustomerRevenueEnvironment,
    records: new Map()
  };
}

export function createPaidCustomerBillingRecord(store, input, context) {
  if (store?.environment !== paidCustomerRevenueEnvironment) fail("environment_forbidden");
  exactKeys(input, [
    "companyId",
    "workspaceId",
    "billingAccountId",
    "companyDisplayName",
    "planId",
    "currency",
    "unitAmountMinor"
  ]);
  exactKeys(context, ["session", "now"]);
  const now = new Date(context.now);
  if (Number.isNaN(now.getTime())) fail("invalid_timestamp");
  const scope = requireScope(input);
  assertSession(context.session, scope, now, mutationRoles);
  requireFictional(input.companyDisplayName);
  identifier(input.planId, "plan_");
  if (typeof input.currency !== "string" || !currencyPattern.test(input.currency)) {
    fail("invalid_currency");
  }
  if (
    !Number.isSafeInteger(input.unitAmountMinor)
    || input.unitAmountMinor < 0
    || input.unitAmountMinor > 100_000_000
  ) {
    fail("invalid_unit_amount");
  }
  const key = scopedKey(scope.companyId, scope.workspaceId, scope.billingAccountId);
  if (store.records.has(key)) fail("billing_record_exists");

  const record = {
    contractVersion: paidCustomerRevenueContractVersion,
    environment: paidCustomerRevenueEnvironment,
    ...scope,
    companyDisplayName: input.companyDisplayName.trim(),
    planId: input.planId,
    currency: input.currency,
    unitAmountMinor: input.unitAmountMinor,
    billingState: "billing_incomplete",
    activationState: "activation_blocked",
    liveReady: false,
    liveActive: false,
    lastProviderSequence: 0,
    processedEvents: {},
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    audit: []
  };
  appendAudit(record, {
    action: "billing_record_created",
    outcome: "accepted",
    occurredAt: now.toISOString()
  });
  store.records.set(key, record);
  return clone(record);
}

export function readPaidCustomerBillingRecord(store, scopeInput, context) {
  exactKeys(context, ["session", "now"]);
  const scope = requireScope(scopeInput);
  const now = new Date(context.now);
  if (Number.isNaN(now.getTime())) fail("invalid_timestamp");
  assertSession(context.session, scope, now);
  return clone(readMutable(store, scope));
}

export function beginSimulatedPayment(store, scopeInput, context) {
  exactKeys(context, ["session", "now"]);
  const scope = requireScope(scopeInput);
  const now = new Date(context.now);
  if (Number.isNaN(now.getTime())) fail("invalid_timestamp");
  assertSession(context.session, scope, now, mutationRoles);
  const record = readMutable(store, scope);
  if (!["billing_incomplete", "payment_failed"].includes(record.billingState)) {
    fail("billing_transition_forbidden");
  }
  record.billingState = "payment_pending";
  appendAudit(record, {
    action: "simulated_payment_started",
    outcome: "accepted",
    occurredAt: now.toISOString()
  });
  return clone(record);
}

export function createSignedWebhookBoundary({ verifySignature }) {
  if (typeof verifySignature !== "function") fail("signature_verifier_required");
  return Object.freeze({
    async verify({ signature, payloadBytes }) {
      if (
        typeof signature !== "string"
        || !signaturePattern.test(signature)
        || !(payloadBytes instanceof Uint8Array)
        || payloadBytes.byteLength < 2
        || payloadBytes.byteLength > 65_536
      ) {
        return false;
      }
      const result = await verifySignature({ signature, payloadBytes });
      return result === true;
    }
  });
}

function normalizeWebhookEvent(payload, now) {
  exactKeys(payload, [
    "eventId",
    "eventType",
    "providerSequence",
    "occurredAt",
    "companyId",
    "workspaceId",
    "billingAccountId"
  ]);
  const scope = requireScope(payload);
  identifier(payload.eventId, "event_");
  if (!webhookEventTypes.has(payload.eventType)) fail("webhook_event_type_forbidden");
  if (
    !Number.isSafeInteger(payload.providerSequence)
    || payload.providerSequence < 1
    || payload.providerSequence > Number.MAX_SAFE_INTEGER
  ) {
    fail("invalid_provider_sequence");
  }
  return {
    eventId: payload.eventId,
    eventType: payload.eventType,
    providerSequence: payload.providerSequence,
    occurredAt: timestamp(payload.occurredAt, now),
    ...scope
  };
}

export async function processPaidCustomerBillingWebhook(
  store,
  { signature, payloadBytes },
  { boundary, now }
) {
  if (store?.environment !== paidCustomerRevenueEnvironment) fail("environment_forbidden");
  if (!boundary || typeof boundary.verify !== "function") fail("signature_verifier_required");
  const clock = new Date(now);
  if (Number.isNaN(clock.getTime())) fail("invalid_timestamp");
  if (!await boundary.verify({ signature, payloadBytes })) fail("invalid_signature");

  let payload;
  try {
    payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(payloadBytes));
  } catch {
    fail("invalid_webhook_payload");
  }
  const event = normalizeWebhookEvent(payload, clock);
  const record = readMutable(store, event);
  const eventDigest = digest(event);
  const prior = record.processedEvents[event.eventId];
  if (prior) {
    if (prior.eventDigest !== eventDigest) fail("event_identifier_conflict");
    appendAudit(record, {
      action: "billing_webhook_replayed",
      outcome: "ignored",
      occurredAt: clock.toISOString(),
      eventId: event.eventId,
      reasonCode: "duplicate_event"
    });
    return { classification: "duplicate_ignored", record: clone(record) };
  }
  if (event.providerSequence <= record.lastProviderSequence) {
    record.processedEvents[event.eventId] = {
      eventDigest,
      outcome: "out_of_order_ignored"
    };
    appendAudit(record, {
      action: "billing_webhook_out_of_order",
      outcome: "ignored",
      occurredAt: clock.toISOString(),
      eventId: event.eventId,
      reasonCode: "stale_provider_sequence"
    });
    return { classification: "out_of_order_ignored", record: clone(record) };
  }

  const nextState = {
    "payment.simulated_succeeded": "simulated_paid",
    "payment.simulated_failed": "payment_failed",
    "subscription.simulated_canceled": "canceled"
  }[event.eventType];
  if (
    event.eventType.startsWith("payment.")
    && record.billingState !== "payment_pending"
  ) {
    fail("payment_event_without_pending_payment");
  }
  if (
    event.eventType === "subscription.simulated_canceled"
    && record.billingState === "canceled"
  ) {
    fail("billing_transition_forbidden");
  }
  record.billingState = nextState;
  record.lastProviderSequence = event.providerSequence;
  record.processedEvents[event.eventId] = {
    eventDigest,
    outcome: "applied"
  };
  appendAudit(record, {
    action: event.eventType,
    outcome: "applied",
    occurredAt: clock.toISOString(),
    eventId: event.eventId
  });
  return { classification: "applied", record: clone(record) };
}

export function suspendPaidCustomerBilling(store, scopeInput, context) {
  exactKeys(context, ["session", "now", "reasonCode"]);
  const scope = requireScope(scopeInput);
  const now = new Date(context.now);
  if (Number.isNaN(now.getTime())) fail("invalid_timestamp");
  assertSession(context.session, scope, now, mutationRoles);
  if (!["nonpayment", "customer_request", "risk_review"].includes(context.reasonCode)) {
    fail("invalid_reason_code");
  }
  const record = readMutable(store, scope);
  if (record.billingState === "canceled") fail("billing_transition_forbidden");
  record.billingState = "suspended";
  appendAudit(record, {
    action: "billing_suspended",
    outcome: "applied",
    occurredAt: now.toISOString(),
    reasonCode: context.reasonCode
  });
  return clone(record);
}

export function cancelPaidCustomerBilling(store, scopeInput, context) {
  exactKeys(context, ["session", "now", "reasonCode"]);
  const scope = requireScope(scopeInput);
  const now = new Date(context.now);
  if (Number.isNaN(now.getTime())) fail("invalid_timestamp");
  assertSession(context.session, scope, now, mutationRoles);
  if (!["customer_request", "rehearsal_cleanup"].includes(context.reasonCode)) {
    fail("invalid_reason_code");
  }
  const record = readMutable(store, scope);
  if (record.billingState === "canceled") fail("billing_transition_forbidden");
  record.billingState = "canceled";
  appendAudit(record, {
    action: "billing_canceled",
    outcome: "applied",
    occurredAt: now.toISOString(),
    reasonCode: context.reasonCode
  });
  return clone(record);
}

export function verifyPaidCustomerRevenueAudit(record) {
  if (!plainObject(record) || !Array.isArray(record.audit) || record.audit.length < 1) {
    return false;
  }
  let previousReceipt = null;
  for (let index = 0; index < record.audit.length; index += 1) {
    const { receipt, ...entry } = record.audit[index];
    if (entry.sequence !== index + 1 || typeof receipt !== "string") return false;
    const expected = auditReceipt(previousReceipt, entry);
    const actualBytes = Buffer.from(receipt, "utf8");
    const expectedBytes = Buffer.from(expected, "utf8");
    if (
      actualBytes.length !== expectedBytes.length
      || !timingSafeEqual(actualBytes, expectedBytes)
    ) {
      return false;
    }
    previousReceipt = receipt;
  }
  return true;
}

export async function runFictionalPaidCustomerRevenueRehearsal({
  scenario,
  now = "2026-07-31T12:00:00.000Z"
}) {
  if (!["success", "failure", "replay"].includes(scenario)) fail("unknown_rehearsal_scenario");
  const store = createPaidCustomerRevenueStore();
  const scope = {
    companyId: "company_fictional_northstar_rehearsal",
    workspaceId: "workspace_fictional_northstar_rehearsal",
    billingAccountId: "billing_fictional_northstar_rehearsal"
  };
  const session = {
    authenticated: true,
    principalId: "principal_fictional_revenue_owner",
    companyId: scope.companyId,
    workspaceId: scope.workspaceId,
    role: "revenue_owner",
    expiresAt: "2026-08-01T12:00:00.000Z"
  };
  const boundary = createSignedWebhookBoundary({
    verifySignature: async ({ signature }) => signature === "fictional-valid-signature"
  });
  try {
    createPaidCustomerBillingRecord(store, {
      ...scope,
      companyDisplayName: "Northstar Safety Fictional Rehearsal",
      planId: "plan_fictional_rehearsal_monthly",
      currency: "USD",
      unitAmountMinor: 25000
    }, { session, now });
    beginSimulatedPayment(store, scope, { session, now: "2026-07-31T12:01:00.000Z" });
    const event = {
      ...scope,
      eventId: `event_fictional_${scenario}`,
      eventType: scenario === "failure"
        ? "payment.simulated_failed"
        : "payment.simulated_succeeded",
      providerSequence: 1,
      occurredAt: "2026-07-31T12:02:00.000Z"
    };
    const payloadBytes = new TextEncoder().encode(JSON.stringify(event));
    const result = await processPaidCustomerBillingWebhook(
      store,
      { signature: "fictional-valid-signature", payloadBytes },
      { boundary, now: "2026-07-31T12:02:01.000Z" }
    );
    const replay = scenario === "replay"
      ? await processPaidCustomerBillingWebhook(
        store,
        { signature: "fictional-valid-signature", payloadBytes },
        { boundary, now: "2026-07-31T12:02:02.000Z" }
      )
      : null;
    const record = readPaidCustomerBillingRecord(store, scope, {
      session,
      now: "2026-07-31T12:03:00.000Z"
    });
    return {
      scenario,
      result: result.classification,
      replay: replay?.classification || null,
      billingState: record.billingState,
      activationState: record.activationState,
      liveReady: record.liveReady,
      liveActive: record.liveActive,
      auditValid: verifyPaidCustomerRevenueAudit(record),
      auditCount: record.audit.length,
      productionWrites: 0,
      stripeCalls: 0
    };
  } finally {
    store.records.clear();
  }
}
