import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  routeIqIntelligencePaidCustomerRevenueReadinessContract,
  verifyPaidCustomerRevenueEventSeries,
  verifyPaidCustomerRevenueIntelligenceIsolation
} from "../intelligence/provenance/route-iq-paid-customer-revenue-readiness-v1.mjs";

const version = "route_iq_intelligence_paid_customer_revenue_readiness_v1";
const expectedSurfaces = [
  "recommendations",
  "activePool",
  "reservePool",
  "quarantinePool",
  "cohorts",
  "collection",
  "providerRefresh",
  "scheduling",
  "activeCustomerRouting"
];

function event(overrides = {}) {
  return {
    schemaVersion: version,
    fictional: true,
    companyId: "company_orion_revenue_rehearsal",
    workspaceId: "workspace_orion_revenue_rehearsal",
    domain: "payment",
    state: "SIMULATED_PAYMENT_SUCCEEDED",
    eventId: "event_orion_revenue_001",
    sequence: 1,
    simulated: true,
    activationAuthorized: false,
    ...overrides
  };
}

function assertIsolated(result) {
  assert.equal(result.recommendationInfluence, "OFF");
  assert.equal(result.customerActivationAuthorized, false);
  assert.equal(result.representativeRoutingEligible, false);
  assert.equal(result.intelligenceMutationCount, 0);
  assert.deepEqual(Object.keys(result.mutations), expectedSurfaces);
  assert.deepEqual(Object.values(result.mutations), Array(expectedSurfaces.length).fill(0));
}

test("the exact provenance contract fixes every commercial domain outside Intelligence", () => {
  const documented = JSON.parse(readFileSync(
    new URL(
      "../intelligence/provenance/route-iq-paid-customer-revenue-readiness-v1.json",
      import.meta.url
    ),
    "utf8"
  ));

  assert.equal(documented.version, version);
  assert.equal(documented.owner, "Prometheus Intelligence Engine");
  assert.equal(documented.mode, "VERIFICATION_ONLY");
  assert.deepEqual(
    documented.commercialDomains,
    routeIqIntelligencePaidCustomerRevenueReadinessContract.commercialDomains
  );
  assert.deepEqual(Object.keys(documented.protectedSurfaces), expectedSurfaces);
  assert.deepEqual(
    Object.values(documented.protectedSurfaces),
    Array(expectedSurfaces.length).fill("ZERO_MUTATIONS")
  );
  assert.equal(documented.invariants.recommendationInfluence, "OFF");
  assert.equal(documented.invariants.forgedActivationCanAuthorizeIntelligence, false);
});

test("successful and failed simulated payments produce zero Intelligence mutations", () => {
  for (const state of ["SIMULATED_PAYMENT_SUCCEEDED", "SIMULATED_PAYMENT_FAILED"]) {
    const result = verifyPaidCustomerRevenueIntelligenceIsolation(event({ state }));
    assert.equal(result.status, "COMMERCIAL_EVENT_ISOLATED");
    assertIsolated(result);
  }
});

test("validated onboarding cannot activate routing or recommendation influence", () => {
  const result = verifyPaidCustomerRevenueIntelligenceIsolation(event({
    domain: "onboarding",
    state: "VALIDATED"
  }));
  assert.equal(result.reasonCode, "COMMERCIAL_STATE_HAS_ZERO_INTELLIGENCE_INFLUENCE");
  assertIsolated(result);
});

test("proposal, agreement, order-form, commercial, billing, and cancellation states stay isolated", () => {
  const cases = [
    ["proposal", "PROPOSED"],
    ["agreement", "AGREEMENT_DRAFTED"],
    ["orderForm", "ORDER_FORM_DRAFTED"],
    ["commercial", "DRAFT"],
    ["billing", "VALIDATION_FAILED"],
    ["cancellation", "CANCELLED"]
  ];

  for (const [domain, state] of cases) {
    assertIsolated(verifyPaidCustomerRevenueIntelligenceIsolation(event({ domain, state })));
  }
});

test("replayed and out-of-order billing events cannot influence Intelligence", () => {
  const original = event({ domain: "billing", state: "BILLING_EVENT_REPLAYED" });
  const result = verifyPaidCustomerRevenueEventSeries([
    original,
    { ...original },
    { ...original, eventId: "event_orion_revenue_002", sequence: 0 }
  ]);

  assert.equal(result.status, "EVENT_SERIES_ISOLATED");
  assert.equal(result.recommendationInfluence, "OFF");
  assert.equal(result.intelligenceMutationCount, 0);
  assert.equal(result.events[1].status, "REPLAYED_EVENT_ISOLATED");
  assert.equal(result.events[2].status, "REPLAYED_EVENT_ISOLATED");
  result.events.forEach(assertIsolated);
});

test("forged activation state and flag fail closed with zero mutations", () => {
  for (const forged of [
    event({ domain: "commercial", state: "ACTIVE" }),
    event({ activationAuthorized: true })
  ]) {
    const result = verifyPaidCustomerRevenueIntelligenceIsolation(forged);
    assert.equal(result.status, "FORGED_ACTIVATION_REJECTED");
    assert.equal(result.reasonCode, "COMMERCIAL_STATE_CANNOT_AUTHORIZE_ACTIVATION");
    assertIsolated(result);
  }
});

test("live, malformed, unknown, and extra-field provenance is rejected", () => {
  const cases = [
    [event({ fictional: false }), "LIVE_REVENUE_PROVENANCE_REJECTED"],
    [event({ simulated: false }), "LIVE_REVENUE_PROVENANCE_REJECTED"],
    [event({ domain: "routing" }), "REVENUE_DOMAIN_REJECTED"],
    [event({ state: "PAID_AND_ACTIVE" }), "REVENUE_STATE_REJECTED"],
    [event({ sequence: -1 }), "REVENUE_SEQUENCE_REJECTED"],
    [{ ...event(), secret: "forbidden" }, "REVENUE_PROVENANCE_INVALID"]
  ];

  for (const [provenance, code] of cases) {
    assert.throws(
      () => verifyPaidCustomerRevenueIntelligenceIsolation(provenance),
      error => error.code === code
    );
  }
});
