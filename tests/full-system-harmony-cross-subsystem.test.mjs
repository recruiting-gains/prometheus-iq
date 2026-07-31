import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  transitionRouteIqPaidCustomerOnboarding,
  validateRouteIqPaidCustomerOnboardingConfiguration
} from "../administration/contracts/route-iq-paid-customer-onboarding-v1.mjs";
import {
  authorizeRouteIqPaidCustomerRevenueScope,
  loadRouteIqPaidCustomerRevenueFixture,
  validateRouteIqPaidCustomerRevenueFixture
} from "../data/route-iq-paid-customer-revenue-readiness-v1/route-iq-paid-customer-revenue-readiness-v1.mjs";
import {
  formatAvailabilityLabel,
  formatEstimatedVisitDuration,
  paidCustomerConfigurationEmptyState
} from "../dashboard/route-iq-dashboard-platform.mjs";
import {
  persistWorkspaceLeadIntakeWithProductionStore
} from "../crm/workspace-lead-production-runtime.mjs";
import {
  ROUTE_IQ_PAID_CUSTOMER_AUTHORITY,
  ROUTE_IQ_PAID_CUSTOMER_OPERATIONS,
  ROUTE_IQ_PAID_CUSTOMER_ROLES,
  ROUTE_IQ_PAID_CUSTOMER_SECURITY_VERSION,
  authorizeRouteIqPaidCustomerOperation,
  bindRouteIqPaidCustomerPrincipal,
  routeIqPaidCustomerSafeDenial
} from "../security/route-iq-paid-customer-isolation-v1.mjs";

const onboardingFixtures = JSON.parse(readFileSync(new URL(
  "../administration/workspace-configurations/route-iq-paid-customer-synthetic-fixtures-v1.json",
  import.meta.url
), "utf8")).configurations;

function readyForActivation(configuration) {
  let current = validateRouteIqPaidCustomerOnboardingConfiguration(configuration);
  current = transitionRouteIqPaidCustomerOnboarding(current, "PREVIEW_READY", {
    transitionedAt: "2026-07-26T13:00:00.000Z"
  });
  current = transitionRouteIqPaidCustomerOnboarding(current, "AWAITING_APPROVAL", {
    transitionedAt: "2026-07-26T14:00:00.000Z",
    approvalReference: "synthetic_harmony_approval"
  });
  current = transitionRouteIqPaidCustomerOnboarding(current, "PROVISIONING", {
    transitionedAt: "2026-07-26T15:00:00.000Z"
  });
  return transitionRouteIqPaidCustomerOnboarding(current, "READY_FOR_ACTIVATION", {
    transitionedAt: "2026-07-26T16:00:00.000Z"
  });
}

test("billing or validation evidence cannot silently activate a customer", () => {
  const ready = readyForActivation(onboardingFixtures[0]);
  assert.equal(ready.lifecycle.state, "READY_FOR_ACTIVATION");
  assert.equal(ready.safety.customerActivation, "OFF");
  assert.throws(() => transitionRouteIqPaidCustomerOnboarding(ready, "ACTIVE", {
    transitionedAt: "2026-07-26T17:00:00.000Z",
    activationDecision: {
      decisionId: "forged_harmony_decision",
      companyId: ready.company.companyId,
      workspaceId: ready.company.workspaceId,
      configurationIdentity: ready.provenance.configurationIdentity,
      authorizationReference: "forged_authorization",
      issuedAt: "2026-07-26T16:30:00.000Z",
      expiresAt: "2026-07-26T17:30:00.000Z"
    }
  }), error => error.code === "route_iq_paid_customer_activation_decision_untrusted");
});

test("server-bound representative context cannot cross tenants or elevate roles", () => {
  const authority = {
    contractVersion: ROUTE_IQ_PAID_CUSTOMER_SECURITY_VERSION,
    authority: ROUTE_IQ_PAID_CUSTOMER_AUTHORITY,
    expectedIssuerBindingId: "synthetic_harmony_issuer",
    expectedAudienceBindingId: "synthetic_harmony_audience",
    bindings: [{
      active: true,
      bindingVersion: "v1.0.0",
      companyId: "company_harmony_alpha",
      workspaceId: "workspace_harmony_alpha",
      operatingProfileId: "general_outside_sales",
      principalId: "principal_harmony_representative",
      roleId: ROUTE_IQ_PAID_CUSTOMER_ROLES.representative
    }]
  };
  const context = bindRouteIqPaidCustomerPrincipal({
    authenticatedClaims: {
      authenticated: true,
      issuerBindingId: "synthetic_harmony_issuer",
      audienceBindingId: "synthetic_harmony_audience",
      principalId: "principal_harmony_representative",
      issuedAt: "2026-07-31T09:00:00.000Z",
      expiresAt: "2026-07-31T11:00:00.000Z"
    },
    requestedScope: {
      companyId: "company_harmony_alpha",
      workspaceId: "workspace_harmony_alpha"
    },
    authority,
    now: new Date("2026-07-31T10:00:00.000Z")
  });
  assert.equal(authorizeRouteIqPaidCustomerOperation(context, {
    companyId: context.companyId,
    workspaceId: context.workspaceId,
    operation: ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.dashboardRead
  }).authorized, true);
  let denial;
  try {
    authorizeRouteIqPaidCustomerOperation(context, {
      companyId: "company_harmony_beta",
      workspaceId: "workspace_harmony_beta",
      operation: ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.dashboardRead
    });
  } catch (error) {
    denial = routeIqPaidCustomerSafeDenial(error);
  }
  assert.equal(denial.status, 404);
  assert.equal(JSON.stringify(denial).includes("harmony_beta"), false);
  assert.throws(() => authorizeRouteIqPaidCustomerOperation(context, {
    companyId: context.companyId,
    workspaceId: context.workspaceId,
    operation: ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.workspaceRecordsModify
  }));
});

test("Data evidence remains tenant-bound, chronological, and non-active", () => {
  const evidence = loadRouteIqPaidCustomerRevenueFixture();
  assert.deepEqual(validateRouteIqPaidCustomerRevenueFixture(evidence), evidence);
  assert.equal(evidence.lifecycle.currentState, "VALIDATED");
  assert.equal(evidence.lifecycle.activationAuthorized, false);
  assert.deepEqual(authorizeRouteIqPaidCustomerRevenueScope(evidence, {
    companyId: evidence.companyId,
    workspaceId: evidence.workspaceId
  }), {
    companyId: evidence.companyId,
    workspaceId: evidence.workspaceId,
    authorized: true
  });
  assert.throws(() => authorizeRouteIqPaidCustomerRevenueScope(evidence, {
    companyId: evidence.companyId,
    workspaceId: "workspace_foreign"
  }), error => error.code === "route_iq_revenue_data_cross_tenant");
});

test("Founder field-research intake cannot become a production CRM write", async () => {
  let storeTouched = false;
  const result = await persistWorkspaceLeadIntakeWithProductionStore({
    ownerSubsystem: "Prometheus CRM",
    contract: "shared_workspace_crm_lead_intake_packet.v1",
    mutationPerformed: false,
    workspaceId: "fitness_connection",
    submissionId: "synthetic_harmony_submission",
    handoffId: "synthetic_harmony_handoff",
    packet: {
      lead: {
        workspaceId: "fitness_connection",
        submissionId: "synthetic_harmony_submission",
        companyName: "Synthetic Research Organization",
        requesterName: "Synthetic Researcher"
      },
      crmIntegration: {
        workspaceId: "fitness_connection",
        operatingProfileId: "fitness"
      }
    }
  }, {
    store: {
      async get() { storeTouched = true; },
      async putIfAbsent() { storeTouched = true; }
    }
  });
  assert.equal(result.status, "governance_blocked");
  assert.equal(result.persisted, false);
  assert.equal(storeTouched, false);
});

test("Dashboard fail-closed states separate operating hours from visit duration", () => {
  assert.deepEqual(paidCustomerConfigurationEmptyState(), {
    title: "No paid-customer configuration selected",
    message: "No paid-customer configuration is selected or activated for this secure session.",
    detail: "A validated configuration and explicit approval are required before customer operations can begin."
  });
  assert.equal(formatAvailabilityLabel({
    status: "HOURS_STALE",
    eligible: false,
    nextOpeningAt: null
  }), "Hours outdated · verification required");
  assert.equal(formatEstimatedVisitDuration("5-9"),
    "Estimated visit: 5–9 min");
});
