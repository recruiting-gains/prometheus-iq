import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  RouteIqRevenueReadinessError,
  createPaidCustomerRevenueReadinessViewModel,
  paidCustomerRevenueReadinessState,
  renderPaidCustomerRevenueReadiness,
  routeIqPaidCustomerRevenueReadinessVersion
} from "../dashboard/route-iq-paid-customer-revenue-readiness.mjs";

const NOW = new Date("2026-07-31T18:00:00.000Z");
const digest = character => character.repeat(64);

function founderSession(overrides = {}) {
  return {
    authenticationAuthority: "cloudflare_access",
    authorizationState: "server_verified",
    callerSupplied: false,
    expiresAt: "2026-07-31T19:00:00.000Z",
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
    },
    ...overrides
  };
}

function readiness(overrides = {}) {
  return {
    contractVersion: routeIqPaidCustomerRevenueReadinessVersion,
    companyDisplayName: "Orion Facility Safety Rehearsal",
    generatedAt: "2026-07-31T17:55:00.000Z",
    commercialState: "ONBOARDING_VALIDATED",
    onboardingState: "VALIDATED",
    billing: { mode: "TEST", state: "TEST_VERIFIED" },
    activation: { state: "BLOCKED" },
    nextAction: "Record the Founder legal-formation decision.",
    responsibleActor: "FOUNDER",
    counts: { users: 3, managers: 1, representatives: 2, locations: 2 },
    agreement: { state: "DRAFT", version: "agreement-v1.0" },
    orderForm: { state: "DRAFT", version: "order-form-v1.0" },
    pricing: { state: "PENDING", version: "pricing-v1.0" },
    payment: { state: "TEST_ONLY" },
    cancellation: { state: "NOT_REQUESTED" },
    support: { state: "DRAFT" },
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
    auditHistory: [
      {
        at: "2026-07-31T17:00:00.000Z",
        actorRole: "PROMETHEUS_AI_OVERWATCH",
        fromState: "DRAFT_CUSTOMER_CREATED",
        toState: "ONBOARDING_IN_PROGRESS",
        summary: "Draft prerequisites entered governed validation.",
        evidenceDigest: digest("a")
      },
      {
        at: "2026-07-31T17:30:00.000Z",
        actorRole: "PROMETHEUS_AI_OVERWATCH",
        fromState: "ONBOARDING_IN_PROGRESS",
        toState: "ONBOARDING_VALIDATED",
        summary: "Configuration validation completed without activation.",
        evidenceDigest: digest("b")
      }
    ],
    ...overrides
  };
}

function expectCode(fn, code) {
  assert.throws(fn, error => error instanceof RouteIqRevenueReadinessError && error.code === code);
}

test("Founder view model explains commercial readiness without exposing identifiers", () => {
  const view = createPaidCustomerRevenueReadinessViewModel(readiness(), {
    session: founderSession(),
    now: NOW
  });

  assert.equal(view.access, "FOUNDER_ONLY");
  assert.equal(view.authority, "SERVER_VERIFIED_READ_ONLY");
  assert.equal(view.advisoryOnly, true);
  assert.equal(view.mutationEffects, "NONE");
  assert.deepEqual(view.summary, {
    commercialState: "Onboarding validated",
    onboardingState: "Validated",
    billing: "Test Mode · Test verified",
    activationState: "Blocked"
  });
  assert.deepEqual(view.counts, { users: 3, managers: 1, representatives: 2, locations: 2 });
  assert.equal(view.requiredNextStep.action, "Record the Founder legal-formation decision.");
  assert.equal(view.requiredNextStep.responsibleActor, "Founder");
  assert.equal(view.commercialTerms.agreement.version, "agreement-v1.0");
  assert.equal(view.operations.payment, "Test only");
  assert.equal(view.auditHistory[0].transition, "ONBOARDING_IN_PROGRESS → ONBOARDING_VALIDATED");
  assert.equal(Object.isFrozen(view), true);
  assert.equal(Object.isFrozen(view.auditHistory), true);
  assert.equal(JSON.stringify(view).includes(digest("a")), false);
  assert.equal(JSON.stringify(view).includes("workspace_"), false);
  assert.equal(JSON.stringify(view).includes("principal_"), false);
});

test("rendering contract is semantic, responsive, action-free, and explicit about Test Mode", () => {
  const html = renderPaidCustomerRevenueReadiness(
    createPaidCustomerRevenueReadinessViewModel(readiness(), {
      session: founderSession(),
      now: NOW
    })
  );

  assert.match(html, /aria-labelledby="routeIqRevenueReadinessTitle"/u);
  assert.match(html, /Founder only · Read-only advisory/u);
  assert.match(html, /Test Mode · Test verified/u);
  assert.match(html, /Required next action/u);
  assert.match(html, /Commercial terms/u);
  assert.match(html, /Audit history/u);
  assert.match(html, /grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)/u);
  assert.match(html, /@media \(max-width:767px\).*grid-template-columns:1fr/u);
  assert.match(html, /overflow-wrap:anywhere/u);
  assert.doesNotMatch(html, /<(?:button|form|input|select|textarea|a)\b/iu);
  assert.doesNotMatch(html, /\bonclick=|\baction=|method=["'](?:post|put|patch|delete)/iu);
  assert.doesNotMatch(html, /Live Mode/u);
});

test("Live Mode approval state is visibly distinct but cannot imply enabled billing", () => {
  const liveApproval = createPaidCustomerRevenueReadinessViewModel(
    readiness({
      billing: { mode: "LIVE", state: "LIVE_APPROVAL_PENDING" },
      commercialState: "BILLING_APPROVAL_PENDING"
    }),
    { session: founderSession(), now: NOW }
  );
  const html = renderPaidCustomerRevenueReadiness(liveApproval);

  assert.equal(liveApproval.summary.billing, "Live Mode · Live approval pending");
  assert.match(html, /Live Mode · Live approval pending/u);
  assert.match(html, /Blocked/u);
  assert.doesNotMatch(html, /Live enabled/u);
});

test("desktop and exact 390x844 mobile semantics preserve one reading order", () => {
  const view = createPaidCustomerRevenueReadinessViewModel(readiness(), {
    session: founderSession(),
    now: NOW
  });

  assert.equal(view.layout.desktop.columns, 2);
  assert.equal(view.layout.mobile.viewport, "390x844");
  assert.equal(view.layout.mobile.columns, 1);
  assert.equal(view.layout.mobile.minimumInlineSize, 0);
  assert.equal(view.layout.mobile.overflowWrap, "anywhere");
  assert.deepEqual(view.layout.mobile.readingOrder, view.layout.desktop.readingOrder);
});

test("loading, empty, and error states fail safely with no dead retry action", () => {
  for (const kind of ["LOADING", "EMPTY", "ERROR"]) {
    const state = paidCustomerRevenueReadinessState(kind);
    assert.equal(state.access, "FOUNDER_ONLY");
    assert.equal(state.mutationEffects, "NONE");
    assert.equal(state.retryAllowed, false);
    assert.equal(Object.isFrozen(state), true);
  }
  expectCode(
    () => paidCustomerRevenueReadinessState("SUCCESS"),
    "route_iq_revenue_readiness_view_state_invalid"
  );
});

test("representative, manager, caller-supplied, expired, and unsafe sessions are denied", () => {
  const rejected = [
    founderSession({ role: "REPRESENTATIVE" }),
    founderSession({ role: "MANAGER" }),
    founderSession({ callerSupplied: true }),
    founderSession({ expiresAt: "2026-07-31T17:00:00.000Z" }),
    founderSession({ safety: { ...founderSession().safety, billingActivation: "ON" } })
  ];
  for (const session of rejected) {
    expectCode(
      () => createPaidCustomerRevenueReadinessViewModel(readiness(), { session, now: NOW }),
      "route_iq_revenue_readiness_founder_session_invalid"
    );
  }
});

test("enabled live billing, active customers, missing blockers, and incomplete contracts fail closed", () => {
  for (const snapshot of [
    readiness({ billing: { mode: "LIVE", state: "LIVE_ENABLED" } }),
    readiness({ activation: { state: "ACTIVE" } }),
    readiness({ commercialState: "ACTIVE" }),
    readiness({ blockers: [] })
  ]) {
    assert.throws(() =>
      createPaidCustomerRevenueReadinessViewModel(snapshot, {
        session: founderSession(),
        now: NOW
      })
    );
  }
  const incomplete = readiness();
  delete incomplete.support;
  expectCode(
    () => createPaidCustomerRevenueReadinessViewModel(incomplete, {
      session: founderSession(),
      now: NOW
    }),
    "route_iq_revenue_readiness_snapshot_invalid"
  );
});

test("hostile labels, unordered audit evidence, and duplicate blockers are rejected", () => {
  expectCode(
    () => createPaidCustomerRevenueReadinessViewModel(
      readiness({ companyDisplayName: "<script>alert(1)</script>" }),
      { session: founderSession(), now: NOW }
    ),
    "route_iq_revenue_readiness_text_invalid"
  );
  const unordered = readiness();
  unordered.auditHistory.reverse();
  expectCode(
    () => createPaidCustomerRevenueReadinessViewModel(unordered, {
      session: founderSession(),
      now: NOW
    }),
    "route_iq_revenue_readiness_audit_invalid"
  );
  const duplicate = readiness();
  duplicate.blockers.push({ ...duplicate.blockers[0] });
  expectCode(
    () => createPaidCustomerRevenueReadinessViewModel(duplicate, {
      session: founderSession(),
      now: NOW
    }),
    "route_iq_revenue_readiness_blockers_duplicate"
  );
});

test("module has no browser storage, network, secret, or mutation path", () => {
  const source = readFileSync(
    new URL("../dashboard/route-iq-paid-customer-revenue-readiness.mjs", import.meta.url),
    "utf8"
  );
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|document\.cookie|caches\./u);
  assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource/u);
  assert.doesNotMatch(source, /Bearer|client[_-]?secret|api[_-]?token|password/iu);
  assert.doesNotMatch(source, /method:\s*["'](?:POST|PUT|PATCH|DELETE)["']/u);
  assert.doesNotMatch(
    source,
    /\b(?:activateCustomer|createInvitation|enableProvider|enableRecommendations|writeBillingState)\s*\(/u
  );
});
