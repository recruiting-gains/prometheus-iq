import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  ROUTE_IQ_PAID_CUSTOMER_LIFECYCLE_STATES,
  RouteIqPaidCustomerOnboardingError,
  applyRouteIqPaidCustomerProvisioningPlan,
  createRouteIqPaidCustomerProvisioningPlan,
  offboardRouteIqPaidCustomerConfiguration,
  suspendRouteIqPaidCustomerConfiguration,
  transitionRouteIqPaidCustomerOnboarding,
  validateRouteIqPaidCustomerOnboardingConfiguration
} from "../administration/contracts/route-iq-paid-customer-onboarding-v1.mjs";

const fixtureDocument = JSON.parse(
  readFileSync(
    "administration/workspace-configurations/route-iq-paid-customer-synthetic-fixtures-v1.json",
    "utf8"
  )
);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function expectCode(expectedCode, action) {
  assert.throws(action, error => {
    assert.ok(error instanceof RouteIqPaidCustomerOnboardingError);
    assert.equal(error.code, expectedCode);
    return true;
  });
}

function asDraft(configuration) {
  const draft = clone(configuration);
  draft.lifecycle = {
    state: "DRAFT",
    revision: 1,
    lastTransitionAt: "2026-07-26T10:00:00.000Z",
    approvalReference: null,
    failure: null
  };
  return validateRouteIqPaidCustomerOnboardingConfiguration(draft);
}

function asProvisioning(configuration) {
  let current = validateRouteIqPaidCustomerOnboardingConfiguration(configuration);
  current = transitionRouteIqPaidCustomerOnboarding(current, "PREVIEW_READY", {
    transitionedAt: "2026-07-26T13:00:00.000Z"
  });
  current = transitionRouteIqPaidCustomerOnboarding(current, "AWAITING_APPROVAL", {
    transitionedAt: "2026-07-26T14:00:00.000Z",
    approvalReference: "synthetic_configuration_approval"
  });
  return transitionRouteIqPaidCustomerOnboarding(current, "PROVISIONING", {
    transitionedAt: "2026-07-26T15:00:00.000Z"
  });
}

const [securityConfiguration, distributionConfiguration] = fixtureDocument.configurations;

test("lifecycle exposes every governed paid-customer state", () => {
  assert.deepEqual(ROUTE_IQ_PAID_CUSTOMER_LIFECYCLE_STATES, [
    "DRAFT",
    "VALIDATION_FAILED",
    "VALIDATED",
    "PREVIEW_READY",
    "AWAITING_APPROVAL",
    "PROVISIONING",
    "PROVISIONING_FAILED",
    "READY_FOR_ACTIVATION",
    "ACTIVE",
    "SUSPENDED",
    "OFFBOARDED"
  ]);
});

test("happy-path transitions are explicit and preserve approval provenance", () => {
  const draft = asDraft(securityConfiguration);
  const validated = transitionRouteIqPaidCustomerOnboarding(draft, "VALIDATED", {
    transitionedAt: "2026-07-26T11:00:00.000Z"
  });
  const preview = transitionRouteIqPaidCustomerOnboarding(validated, "PREVIEW_READY", {
    transitionedAt: "2026-07-26T12:00:00.000Z"
  });
  const awaiting = transitionRouteIqPaidCustomerOnboarding(preview, "AWAITING_APPROVAL", {
    transitionedAt: "2026-07-26T13:00:00.000Z",
    approvalReference: "synthetic_configuration_approval"
  });
  const provisioning = transitionRouteIqPaidCustomerOnboarding(awaiting, "PROVISIONING", {
    transitionedAt: "2026-07-26T14:00:00.000Z"
  });
  const ready = transitionRouteIqPaidCustomerOnboarding(
    provisioning,
    "READY_FOR_ACTIVATION",
    {
      transitionedAt: "2026-07-26T15:00:00.000Z"
    }
  );

  assert.equal(ready.lifecycle.state, "READY_FOR_ACTIVATION");
  assert.equal(ready.lifecycle.revision, 6);
  assert.equal(ready.lifecycle.approvalReference, "synthetic_configuration_approval");
  assert.equal(ready.safety.customerActivation, "OFF");
  assert.equal(ready.safety.collection, "OFF");
  assert.equal(ready.safety.recommendationInfluence, "OFF");
});

test("validation failure records bounded recovery and can resume from draft", () => {
  const failed = transitionRouteIqPaidCustomerOnboarding(
    asDraft(securityConfiguration),
    "VALIDATION_FAILED",
    {
      transitionedAt: "2026-07-26T11:00:00.000Z",
      failure: {
        code: "territory_rules_conflict",
        recoveryAction: "Resolve the explicit territory rule conflict and submit a new revision."
      }
    }
  );
  assert.equal(failed.lifecycle.failure.code, "territory_rules_conflict");

  const recovered = transitionRouteIqPaidCustomerOnboarding(failed, "DRAFT", {
    transitionedAt: "2026-07-26T12:00:00.000Z"
  });
  assert.equal(recovered.lifecycle.state, "DRAFT");
  assert.equal(recovered.lifecycle.failure, null);
  assert.equal(recovered.lifecycle.approvalReference, null);
});

test("provisioning failure can retry without skipping recovery state", () => {
  const provisioning = asProvisioning(securityConfiguration);
  const failed = transitionRouteIqPaidCustomerOnboarding(
    provisioning,
    "PROVISIONING_FAILED",
    {
      transitionedAt: "2026-07-26T16:00:00.000Z",
      failure: {
        code: "workspace_resource_conflict",
        recoveryAction: "Reconcile the immutable workspace owner before retrying provisioning."
      }
    }
  );
  const retried = transitionRouteIqPaidCustomerOnboarding(failed, "PROVISIONING", {
    transitionedAt: "2026-07-26T17:00:00.000Z"
  });
  assert.equal(retried.lifecycle.state, "PROVISIONING");
  assert.equal(retried.lifecycle.failure, null);
  assert.equal(retried.lifecycle.approvalReference, "synthetic_configuration_approval");
});

test("illegal lifecycle shortcuts and missing approvals fail closed", () => {
  expectCode("route_iq_paid_customer_lifecycle_transition_invalid", () =>
    transitionRouteIqPaidCustomerOnboarding(
      asDraft(securityConfiguration),
      "PROVISIONING",
      { transitionedAt: "2026-07-26T11:00:00.000Z" }
    )
  );

  const preview = transitionRouteIqPaidCustomerOnboarding(
    validateRouteIqPaidCustomerOnboardingConfiguration(securityConfiguration),
    "PREVIEW_READY",
    { transitionedAt: "2026-07-26T13:00:00.000Z" }
  );
  expectCode("route_iq_paid_customer_approval_reference_missing", () =>
    transitionRouteIqPaidCustomerOnboarding(preview, "AWAITING_APPROVAL", {
      transitionedAt: "2026-07-26T14:00:00.000Z"
    })
  );
});

test("provisioning plan is deterministic and explicitly non-activating", () => {
  const provisioning = asProvisioning(securityConfiguration);
  const first = createRouteIqPaidCustomerProvisioningPlan(provisioning);
  const second = createRouteIqPaidCustomerProvisioningPlan(clone(provisioning));

  assert.deepEqual(first, second);
  assert.match(first.idempotencyKey, /^paid_customer_provisioning:/u);
  assert.equal(first.companyId, provisioning.company.companyId);
  assert.equal(first.workspaceId, provisioning.company.workspaceId);
  assert.equal(first.activationRequested, false);
  assert.equal(first.productionMutationAuthorized, false);
  assert.ok(first.resourceKeys.some(key => key.startsWith("metric:")));
  assert.ok(first.resourceKeys.some(key => key.startsWith("crm_process_stage:")));
  assert.equal(new Set(first.resourceKeys).size, first.resourceKeys.length);
});

test("provisioning retry is idempotent with zero duplicate resources or audit events", () => {
  const plan = createRouteIqPaidCustomerProvisioningPlan(
    asProvisioning(securityConfiguration)
  );
  const first = applyRouteIqPaidCustomerProvisioningPlan(plan);
  const second = applyRouteIqPaidCustomerProvisioningPlan(plan, first);

  assert.deepEqual(second, first);
  assert.equal(Object.keys(first.receipts).length, 1);
  assert.equal(Object.keys(first.resources).length, plan.resourceKeys.length);
  assert.equal(first.auditEvents.length, 1);
  assert.equal(first.auditEvents[0].companyId, plan.companyId);
  assert.equal(first.auditEvents[0].workspaceId, plan.workspaceId);
  assert.equal(
    first.receipts[plan.idempotencyKey].activationPerformed,
    false
  );
});

test("two unrelated companies provision into isolated resource namespaces", () => {
  const securityPlan = createRouteIqPaidCustomerProvisioningPlan(
    asProvisioning(securityConfiguration)
  );
  const distributionPlan = createRouteIqPaidCustomerProvisioningPlan(
    asProvisioning(distributionConfiguration)
  );
  const first = applyRouteIqPaidCustomerProvisioningPlan(securityPlan);
  const both = applyRouteIqPaidCustomerProvisioningPlan(distributionPlan, first);

  assert.equal(Object.keys(both.receipts).length, 2);
  assert.equal(both.auditEvents.length, 2);
  assert.deepEqual(
    new Set(both.auditEvents.map(event => event.companyId)),
    new Set([securityPlan.companyId, distributionPlan.companyId])
  );
  for (const [resourceKey, owner] of Object.entries(both.resources)) {
    if (resourceKey.includes(securityPlan.workspaceId)) {
      assert.equal(owner.companyId, securityPlan.companyId);
      assert.equal(owner.workspaceId, securityPlan.workspaceId);
    }
    if (resourceKey.includes(distributionPlan.workspaceId)) {
      assert.equal(owner.companyId, distributionPlan.companyId);
      assert.equal(owner.workspaceId, distributionPlan.workspaceId);
    }
  }
});

test("conflicting receipt or resource ownership fails closed", () => {
  const plan = createRouteIqPaidCustomerProvisioningPlan(
    asProvisioning(securityConfiguration)
  );
  const receiptConflict = applyRouteIqPaidCustomerProvisioningPlan(plan);
  const mutableReceiptConflict = clone(receiptConflict);
  mutableReceiptConflict.receipts[plan.idempotencyKey].companyId =
    "company_conflicting_owner";
  expectCode("route_iq_paid_customer_provisioning_retry_conflict", () =>
    applyRouteIqPaidCustomerProvisioningPlan(plan, mutableReceiptConflict)
  );

  const resourceConflict = {
    registryVersion: "route-iq-paid-customer-provisioning-registry-v1",
    receipts: {},
    resources: {
      [plan.resourceKeys[0]]: {
        companyId: "company_conflicting_owner",
        workspaceId: "workspace_conflicting_owner",
        configurationIdentity: "config_conflicting_owner@1"
      }
    },
    auditEvents: []
  };
  expectCode("route_iq_paid_customer_provisioning_resource_conflict", () =>
    applyRouteIqPaidCustomerProvisioningPlan(plan, resourceConflict)
  );
});

function forgedActivationDecision(configuration, overrides = {}) {
  return {
    decisionId: "activation_decision_forged",
    companyId: configuration.company.companyId,
    workspaceId: configuration.company.workspaceId,
    configurationIdentity: configuration.provenance.configurationIdentity,
    authorizationReference: "synthetic_activation_authorization",
    issuedAt: "2026-07-26T16:30:00.000Z",
    expiresAt: "2026-07-26T17:30:00.000Z",
    ...overrides
  };
}

test("activation remains unreachable without a configured trusted server authority", () => {
  const ready = transitionRouteIqPaidCustomerOnboarding(
    asProvisioning(securityConfiguration),
    "READY_FOR_ACTIVATION",
    { transitionedAt: "2026-07-26T16:00:00.000Z" }
  );
  expectCode("route_iq_paid_customer_activation_decision_untrusted", () =>
    transitionRouteIqPaidCustomerOnboarding(ready, "ACTIVE", {
      transitionedAt: "2026-07-26T17:00:00.000Z"
    })
  );
  for (const options of [
    { activationAuthorizationRef: "synthetic_activation_authorization" },
    { activationDecision: forgedActivationDecision(ready) },
    { activationDecision: forgedActivationDecision(ready, { companyId: "company_wrong_scope" }) },
    { activationDecision: forgedActivationDecision(ready, { expiresAt: "2026-07-26T17:00:00.000Z" }) },
    { activationDecision: forgedActivationDecision(ready, { issuedAt: "2026-07-26T17:01:00.000Z" }) }
  ]) {
    expectCode("route_iq_paid_customer_activation_decision_untrusted", () =>
      transitionRouteIqPaidCustomerOnboarding(ready, "ACTIVE", {
        transitionedAt: "2026-07-26T17:00:00.000Z",
        ...options
      })
    );
  }
  const replayedForgery = forgedActivationDecision(ready);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    expectCode("route_iq_paid_customer_activation_decision_untrusted", () =>
      transitionRouteIqPaidCustomerOnboarding(ready, "ACTIVE", {
        transitionedAt: "2026-07-26T17:00:00.000Z",
        activationDecision: replayedForgery
      })
    );
  }
  assert.equal(ready.lifecycle.state, "READY_FOR_ACTIVATION");
  assert.equal(ready.safety.customerActivation, "OFF");
  assert.equal(ready.safety.activationAuthorizationRef, null);
});

test("validation, commercial labels, and billing-shaped input never imply activation", () => {
  const ready = transitionRouteIqPaidCustomerOnboarding(
    asProvisioning(securityConfiguration),
    "READY_FOR_ACTIVATION",
    { transitionedAt: "2026-07-26T16:00:00.000Z" }
  );
  for (const activationDecision of [
    { validationState: "VALIDATED" },
    { commercialState: "APPROVED" },
    { billingState: "PAID" }
  ]) {
    expectCode("route_iq_paid_customer_activation_decision_untrusted", () =>
      transitionRouteIqPaidCustomerOnboarding(ready, "ACTIVE", {
        transitionedAt: "2026-07-26T17:00:00.000Z",
        activationDecision
      })
    );
  }
});

test("lifecycle transition timestamps are strictly monotonic", () => {
  const draft = asDraft(securityConfiguration);
  for (const transitionedAt of [
    "2026-07-26T10:00:00.000Z",
    "2026-07-26T09:59:59.999Z"
  ]) {
    expectCode("route_iq_paid_customer_lifecycle_transition_time_invalid", () =>
      transitionRouteIqPaidCustomerOnboarding(draft, "VALIDATED", { transitionedAt })
    );
  }
  assert.equal(draft.lifecycle.state, "DRAFT");
  assert.equal(draft.lifecycle.revision, 1);
});

test("suspension denies operations while preserving append-only evidence", () => {
  const ready = transitionRouteIqPaidCustomerOnboarding(
    asProvisioning(distributionConfiguration),
    "READY_FOR_ACTIVATION",
    { transitionedAt: "2026-07-26T16:00:00.000Z" }
  );
  const suspended = suspendRouteIqPaidCustomerConfiguration(ready, {
    transitionedAt: "2026-07-26T17:00:00.000Z",
    reasonCode: "operations_pause"
  });

  assert.equal(suspended.configuration.lifecycle.state, "SUSPENDED");
  assert.equal(suspended.configuration.safety.customerActivation, "OFF");
  assert.equal(suspended.auditEvent.accessBehavior, "DENY_OPERATIONAL_ACCESS");
  assert.equal(suspended.auditEvent.dataBehavior, "PRESERVE_APPEND_ONLY");
  assert.equal(suspended.auditEvent.companyId, ready.company.companyId);
  assert.equal(suspended.auditEvent.workspaceId, ready.company.workspaceId);
});

test("offboarding is terminal and requires separate append-only disposition", () => {
  const ready = transitionRouteIqPaidCustomerOnboarding(
    asProvisioning(distributionConfiguration),
    "READY_FOR_ACTIVATION",
    { transitionedAt: "2026-07-26T16:00:00.000Z" }
  );
  const suspended = suspendRouteIqPaidCustomerConfiguration(ready, {
    transitionedAt: "2026-07-26T17:00:00.000Z",
    reasonCode: "operations_pause"
  });
  const offboarded = offboardRouteIqPaidCustomerConfiguration(
    suspended.configuration,
    {
      transitionedAt: "2026-07-26T18:00:00.000Z",
      reasonCode: "synthetic_contract_closed"
    }
  );

  assert.equal(offboarded.configuration.lifecycle.state, "OFFBOARDED");
  assert.equal(offboarded.configuration.safety.customerActivation, "OFF");
  assert.equal(offboarded.auditEvent.accessBehavior, "DENY_ALL_CUSTOMER_ACCESS");
  assert.equal(
    offboarded.auditEvent.evidenceBehavior,
    "PRESERVE_UNDER_RETENTION_AND_LEGAL_HOLD"
  );
  assert.equal(
    offboarded.auditEvent.dispositionBehavior,
    "SEPARATE_APPEND_ONLY_DATA_ACTION_REQUIRED"
  );
  expectCode("route_iq_paid_customer_lifecycle_transition_invalid", () =>
    transitionRouteIqPaidCustomerOnboarding(
      offboarded.configuration,
      "ACTIVE",
      {
        transitionedAt: "2026-07-26T19:00:00.000Z",
        activationDecision: forgedActivationDecision(offboarded.configuration)
      }
    )
  );
});
