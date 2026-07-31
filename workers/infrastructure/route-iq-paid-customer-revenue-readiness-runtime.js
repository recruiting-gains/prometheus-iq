import revenueFixture from "../../data/route-iq-paid-customer-revenue-readiness-v1/fixtures/synthetic-orion-commercial-rehearsal-v1.json" with { type: "json" };
import {
  beginSimulatedPayment,
  cancelPaidCustomerBilling,
  createPaidCustomerBillingRecord,
  createPaidCustomerRevenueStore,
  createSignedWebhookBoundary,
  processPaidCustomerBillingWebhook,
  runFictionalPaidCustomerRevenueRehearsal
} from "../../crm/paid-customer-revenue-readiness-v1.mjs";
import {
  ROUTE_IQ_REVENUE_MODE,
  ROUTE_IQ_REVENUE_OPERATIONS,
  ROUTE_IQ_REVENUE_ROLES,
  assertRouteIqRevenueLifecycleBlocked,
  authorizeRouteIqRevenueOperation,
  bindRouteIqRevenuePrincipal,
  createRouteIqRevenueAuthority
} from "../../security/route-iq-paid-customer-revenue-v1.mjs";
import { AEGIS_API_HEADERS } from "./aegis-security-controls.js";

export const ROUTE_IQ_PAID_CUSTOMER_REVENUE_READINESS_PATH =
  "/api/dashboard/route-iq/internal/paid-customer-revenue-readiness";
export const ROUTE_IQ_PAID_CUSTOMER_REVENUE_READINESS_RUNTIME_VERSION =
  "route-iq-paid-customer-revenue-readiness-runtime-v1";

const COMPANY_ID = "company_orion_facility_safety_rehearsal";
const WORKSPACE_ID = "workspace_orion_facility_safety_rehearsal";
const FOUNDER_ID = "principal_route_iq_founder_revenue";
const BILLING_ACCOUNT_ID = "billing_orion_facility_safety_rehearsal";
const CUSTOMER_ID = "customer_orion_facility_safety_rehearsal";
const SUBSCRIPTION_ID = "subscription_orion_facility_safety_rehearsal";
const INVOICE_ID = "invoice_orion_facility_safety_rehearsal";
const SAFE_FAILURE = Object.freeze({
  ok: false,
  code: "route_iq_resource_unavailable"
});

function response(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...AEGIS_API_HEADERS,
      "Cache-Control": "private, no-store",
      "Content-Type": "application/json; charset=utf-8",
      "Cross-Origin-Resource-Policy": "same-origin",
      "X-Content-Type-Options": "nosniff",
      ...headers
    }
  });
}

function deny() {
  return response(SAFE_FAILURE, 404);
}

function validateRequest(request) {
  const url = new URL(request.url);
  return url.pathname === ROUTE_IQ_PAID_CUSTOMER_REVENUE_READINESS_PATH
    && url.search === ""
    && request.method === "GET"
    && request.body === null
    && !request.headers.has("transfer-encoding")
    && !request.headers.has("content-encoding")
    && ["0", null].includes(request.headers.get("content-length"));
}

function validateFixture() {
  if (revenueFixture.company?.companyId !== COMPANY_ID
    || revenueFixture.company?.workspaceId !== WORKSPACE_ID
    || revenueFixture.company?.fictional !== true
    || revenueFixture.lifecycle?.currentState !== "VALIDATED"
    || revenueFixture.lifecycle?.activationAuthorized !== false
    || revenueFixture.lifecycle?.productionAdmissionAuthorized !== false
    || revenueFixture.locations?.length !== 2
    || revenueFixture.principals?.filter(item => item.role === "OWNER_MANAGER").length !== 1
    || revenueFixture.principals?.filter(item => item.role === "REPRESENTATIVE").length !== 2
    || revenueFixture.commercial?.liveBillingAuthorized !== false
    || revenueFixture.commercial?.paymentProviderObjectId !== null
    || revenueFixture.cleanup?.productionMutationAuthorized !== false
    || revenueFixture.cleanup?.removalEvidence?.affectedProductionRecords !== 0) {
    throw new Error("REVENUE_FIXTURE_INVALID");
  }
}

function authority() {
  return createRouteIqRevenueAuthority({
    mode: ROUTE_IQ_REVENUE_MODE,
    bindings: [{
      active: true,
      principalId: FOUNDER_ID,
      companyId: COMPANY_ID,
      workspaceId: WORKSPACE_ID,
      role: ROUTE_IQ_REVENUE_ROLES.founder
    }],
    resources: [{
      companyId: COMPANY_ID,
      workspaceId: WORKSPACE_ID,
      billingAccountId: BILLING_ACCOUNT_ID,
      customerId: CUSTOMER_ID,
      subscriptionId: SUBSCRIPTION_ID,
      invoiceId: INVOICE_ID,
      locationIds: revenueFixture.locations.map(item => item.locationId)
    }]
  });
}

function readDecision(now) {
  const revenueAuthority = authority();
  const context = bindRouteIqRevenuePrincipal({
    authority: revenueAuthority,
    claims: {
      authenticated: true,
      principalId: FOUNDER_ID,
      issuedAt: new Date(now.getTime() - 60_000).toISOString(),
      expiresAt: new Date(now.getTime() + 300_000).toISOString()
    },
    requestedScope: { companyId: COMPANY_ID, workspaceId: WORKSPACE_ID },
    now
  });
  return authorizeRouteIqRevenueOperation(context, {
    operation: ROUTE_IQ_REVENUE_OPERATIONS.read,
    companyId: COMPANY_ID,
    workspaceId: WORKSPACE_ID,
    billingAccountId: BILLING_ACCOUNT_ID,
    customerId: CUSTOMER_ID,
    subscriptionId: SUBSCRIPTION_ID,
    invoiceId: INVOICE_ID,
    locationId: revenueFixture.locations[0].locationId
  }, now);
}

function auditHistory() {
  return [
    {
      at: "2026-07-30T18:00:00.000Z",
      actorRole: "PROMETHEUS_AI_OVERWATCH",
      fromState: "DRAFT_CUSTOMER_CREATED",
      toState: "ONBOARDING_IN_PROGRESS",
      summary: "Controlled validation failure preserved before recovery.",
      evidenceDigest: "1".repeat(64)
    },
    {
      at: "2026-07-30T18:05:00.000Z",
      actorRole: "PROMETHEUS_AI_OVERWATCH",
      fromState: "ONBOARDING_IN_PROGRESS",
      toState: "ONBOARDING_VALIDATED",
      summary: "Fictional configuration validated without activation.",
      evidenceDigest: "2".repeat(64)
    }
  ];
}

function snapshot(generatedAt) {
  return {
    contractVersion: "route-iq-paid-customer-revenue-readiness-v1",
    companyDisplayName: revenueFixture.company.displayName,
    generatedAt,
    commercialState: "ONBOARDING_VALIDATED",
    onboardingState: "VALIDATED",
    billing: { mode: "TEST", state: "TEST_VERIFIED" },
    activation: { state: "BLOCKED" },
    nextAction: "Complete the Founder legal and billing decisions.",
    responsibleActor: "FOUNDER",
    counts: { users: 3, managers: 1, representatives: 2, locations: 2 },
    agreement: { state: "DRAFT", version: "agreement-v1.0" },
    orderForm: { state: "DRAFT", version: "order-form-v1.0" },
    pricing: { state: "PENDING", version: "pricing-v1.0" },
    payment: { state: "TEST_ONLY" },
    cancellation: { state: "COMPLETE" },
    support: { state: "DRAFT" },
    operationalStatus: {
      selectedWorkspace: null,
      customerState: "NO_PAID_CUSTOMER_CONFIGURATION",
      routeReadiness: "UNKNOWN",
      deployment: {
        releaseCommit: null,
        workerVersion: null
      },
      protectedState: {
        activeCohorts: 0,
        collection: "OFF",
        providerRefresh: "OFF",
        recommendationInfluence: "OFF",
        scheduler: "OFF"
      },
      workflow: {
        crm: "UNKNOWN",
        followUp: "UNKNOWN"
      },
      auditHistoryAvailable: null
    },
    blockers: [
      {
        code: "LEGAL_FORMATION_REQUIRED",
        severity: "BLOCKING",
        message: "Legal formation remains unconfirmed.",
        owner: "FOUNDER"
      },
      {
        code: "LIVE_BILLING_DISABLED",
        severity: "REQUIRED",
        message: "Live billing remains disabled.",
        owner: "BILLING_OPERATIONS"
      }
    ],
    auditHistory: auditHistory()
  };
}

async function extendedBillingRehearsal() {
  const store = createPaidCustomerRevenueStore();
  const scope = {
    companyId: COMPANY_ID,
    workspaceId: WORKSPACE_ID,
    billingAccountId: BILLING_ACCOUNT_ID
  };
  const session = {
    authenticated: true,
    principalId: FOUNDER_ID,
    companyId: COMPANY_ID,
    workspaceId: WORKSPACE_ID,
    role: "revenue_owner",
    expiresAt: "2026-08-01T12:00:00.000Z"
  };
  const boundary = createSignedWebhookBoundary({
    verifySignature: async ({ signature }) => signature === "fictional-valid-signature"
  });
  const apply = payload => processPaidCustomerBillingWebhook(store, {
    signature: "fictional-valid-signature",
    payloadBytes: new TextEncoder().encode(JSON.stringify(payload))
  }, { boundary, now: "2026-07-31T12:02:01.000Z" });
  try {
    createPaidCustomerBillingRecord(store, {
      ...scope,
      companyDisplayName: "Orion Facility Safety Fictional Rehearsal",
      planId: "plan_orion_fictional_rehearsal",
      currency: "USD",
      unitAmountMinor: 0
    }, { session, now: "2026-07-31T12:00:00.000Z" });
    beginSimulatedPayment(store, scope, {
      session,
      now: "2026-07-31T12:01:00.000Z"
    });
    const applied = await apply({
      ...scope,
      eventId: "event_orion_fictional_success",
      eventType: "payment.simulated_succeeded",
      providerSequence: 2,
      occurredAt: "2026-07-31T12:02:00.000Z"
    });
    const outOfOrder = await apply({
      ...scope,
      eventId: "event_orion_fictional_stale",
      eventType: "subscription.simulated_canceled",
      providerSequence: 1,
      occurredAt: "2026-07-31T12:01:30.000Z"
    });
    const cancelled = cancelPaidCustomerBilling(store, scope, {
      session,
      now: "2026-07-31T12:03:00.000Z",
      reasonCode: "rehearsal_cleanup"
    });
    return Object.freeze({
      applied: applied.classification,
      outOfOrder: outOfOrder.classification,
      cancellationState: cancelled.billingState,
      activationState: cancelled.activationState,
      liveActive: cancelled.liveActive
    });
  } finally {
    store.records.clear();
  }
}

export async function executePaidCustomerRevenueReadinessRehearsal({
  now = new Date()
} = {}) {
  validateFixture();
  assertRouteIqRevenueLifecycleBlocked("DRAFT");
  assertRouteIqRevenueLifecycleBlocked("VALIDATED");
  const decision = readDecision(now);
  const scenarios = [];
  try {
    for (const scenario of ["success", "failure", "replay"]) {
      scenarios.push(await runFictionalPaidCustomerRevenueRehearsal({ scenario }));
    }
    const extended = await extendedBillingRehearsal();
    if (scenarios.some(result =>
      result.activationState !== "activation_blocked"
      || result.liveReady !== false
      || result.liveActive !== false
      || result.auditValid !== true
      || result.productionWrites !== 0
      || result.stripeCalls !== 0)) {
      throw new Error("REVENUE_REHEARSAL_INVALID");
    }
    if (extended.applied !== "applied"
      || extended.outOfOrder !== "out_of_order_ignored"
      || extended.cancellationState !== "canceled"
      || extended.activationState !== "activation_blocked"
      || extended.liveActive !== false) {
      throw new Error("REVENUE_REHEARSAL_INVALID");
    }
    return Object.freeze({
      decision,
      scenarioClassifications: Object.freeze(scenarios.map(item => Object.freeze({
        scenario: item.scenario,
        result: item.result,
        replay: item.replay
      }))),
      extendedClassifications: extended,
      snapshot: Object.freeze(snapshot(now.toISOString())),
      cleanup: Object.freeze({
        isolatedMemoryCleared: true,
        productionWrites: 0,
        crmWrites: 0,
        receiptWrites: 0,
        providerCalls: 0,
        invitationWrites: 0,
        liveBillingCalls: 0
      })
    });
  } finally {
    scenarios.length = 0;
  }
}

export async function handlePaidCustomerRevenueReadinessRequest(
  request,
  founderPrincipal,
  { now = new Date() } = {}
) {
  try {
    if (!validateRequest(request)
      || founderPrincipal?.authenticated !== true
      || founderPrincipal?.role !== "founder"
      || founderPrincipal?.callerSupplied !== false
      || founderPrincipal?.immutablePrincipalId === undefined) {
      return deny();
    }
    const rehearsal = await executePaidCustomerRevenueReadinessRehearsal({ now });
    return response({
      session: {
        authenticationAuthority: "cloudflare_access",
        authorizationState: "server_verified",
        callerSupplied: false,
        expiresAt: new Date(now.getTime() + 300_000).toISOString(),
        founderMappingState: "IMMUTABLE_FOUNDER_MAPPING_VERIFIED",
        role: "FOUNDER",
        safety: {
          activeCohorts: 0,
          billingActivation: "OFF",
          customerActivation: "OFF",
          prospectiveCollection: "OFF",
          providerRefresh: "OFF",
          recommendationInfluence: "OFF",
          scheduler: "OFF"
        }
      },
      snapshot: rehearsal.snapshot
    });
  } catch {
    return deny();
  }
}

export function isPaidCustomerRevenueReadinessPath(pathname) {
  return pathname === ROUTE_IQ_PAID_CUSTOMER_REVENUE_READINESS_PATH;
}
