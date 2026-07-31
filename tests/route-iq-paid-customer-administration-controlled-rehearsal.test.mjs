import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_CLASSIFICATION,
  ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_VERSION,
  RouteIqControlledPaidCustomerRehearsalError,
  controlledPaidCustomerRehearsalDefinition,
  createControlledPaidCustomerRehearsalDraft,
  validateControlledPaidCustomerRehearsalDefinition,
  validateControlledPaidCustomerRehearsalDraft
} from "../administration/contracts/route-iq-controlled-paid-customer-onboarding-rehearsal-v1.mjs";

const definition = JSON.parse(readFileSync(new URL(
  "../administration/workspace-configurations/"
    + "route-iq-controlled-paid-customer-onboarding-rehearsal-v1.json",
  import.meta.url
), "utf8"));

function clone(value) {
  return structuredClone(value);
}

function expectFailure(code, action) {
  assert.throws(action, error => {
    assert.ok(error instanceof RouteIqControlledPaidCustomerRehearsalError);
    assert.equal(error.code, code);
    return true;
  });
}

test("fictional rehearsal definition is strict, versioned, and non-persisting", () => {
  const validated = validateControlledPaidCustomerRehearsalDefinition(definition);
  assert.equal(
    validated.schemaVersion,
    ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_VERSION
  );
  assert.equal(
    validated.classification,
    ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_CLASSIFICATION
  );
  assert.deepEqual(validated, controlledPaidCustomerRehearsalDefinition);
  assert.equal(validated.productionExecution.inMemoryOnly, true);
  for (const [key, value] of Object.entries(validated.productionExecution)) {
    if (!["authenticatedReadOnlyInvocationRequired", "inMemoryOnly"].includes(key)) {
      assert.equal(value, false);
    }
  }
});

test("Draft materializes through the reusable security-services configuration", () => {
  const draft = createControlledPaidCustomerRehearsalDraft();
  assert.equal(draft.lifecycleState, "DRAFT");
  assert.equal(draft.onboardingConfiguration.lifecycle.state, "DRAFT");
  assert.equal(
    draft.onboardingConfiguration.company.companyId,
    definition.configurationIdentity.companyId
  );
  assert.equal(
    draft.onboardingConfiguration.company.workspaceId,
    definition.configurationIdentity.workspaceId
  );
  assert.equal(
    draft.onboardingConfiguration.operatingProfile.industryTemplateId,
    "security_services"
  );
  assert.equal(draft.locations.length, 2);
  assert.equal(
    draft.principals.filter(item => item.principalKind === "OWNER_MANAGER").length,
    1
  );
  assert.equal(
    draft.principals.filter(item => item.principalKind === "REPRESENTATIVE").length,
    2
  );
  assert.equal(Object.isFrozen(draft), true);
});

test("multiple locations remain bound to the fictional company territory", () => {
  const draft = validateControlledPaidCustomerRehearsalDraft(
    createControlledPaidCustomerRehearsalDraft()
  );
  for (const location of draft.locations) {
    assert.equal(
      location.territoryId,
      draft.onboardingConfiguration.territory.territoryId
    );
    assert.ok(
      draft.onboardingConfiguration.territory.authorizedZipCodes.includes(
        location.address.zipCode
      )
    );
    assert.ok(
      draft.onboardingConfiguration.targeting.includedCategoryIds.includes(
        location.categoryId
      )
    );
  }
});

test("simulated billing remains blocked with no live Stripe identity", () => {
  const billing = createControlledPaidCustomerRehearsalDraft().billing;
  assert.equal(billing.mode, "SIMULATED_ONLY");
  assert.equal(billing.stripeMode, "DISABLED");
  assert.equal(billing.billingActivationState, "BLOCKED");
  assert.equal(billing.stripeCustomerId, null);
  assert.equal(billing.subscriptionId, null);
  assert.equal(billing.paymentMethodId, null);
  assert.equal(billing.legalEntityConfirmed, false);
  assert.equal(billing.einConfirmed, false);
  assert.equal(billing.bankAccountConfirmed, false);
});

test("missing location scope fails closed without changing the canonical definition", () => {
  const draft = clone(createControlledPaidCustomerRehearsalDraft());
  draft.locations[1].territoryId = "other_synthetic_territory";
  expectFailure(
    "route_iq_controlled_rehearsal_location_scope_invalid",
    () => validateControlledPaidCustomerRehearsalDraft(draft)
  );
  assert.equal(
    controlledPaidCustomerRehearsalDefinition.locations[1].territoryId,
    definition.configurationIdentity.territoryId
  );
});

test("missing manager or representative fails closed", () => {
  for (const principalKind of ["OWNER_MANAGER", "REPRESENTATIVE"]) {
    const invalid = clone(definition);
    invalid.principals = invalid.principals.filter(
      item => item.principalKind !== principalKind
    );
    expectFailure(
      "route_iq_controlled_rehearsal_principals_invalid",
      () => validateControlledPaidCustomerRehearsalDefinition(invalid)
    );
  }
});

test("activation, persistence, invitation, provider, and billing toggles cannot open", () => {
  for (const key of [
    "persistenceAllowed",
    "productionCustomerMutationAllowed",
    "crmMutationAllowed",
    "invitationAllowed",
    "providerCallAllowed",
    "schedulerAllowed",
    "recommendationInfluenceAllowed",
    "liveBillingAllowed"
  ]) {
    const invalid = clone(definition);
    invalid.productionExecution[key] = true;
    expectFailure(
      "route_iq_controlled_rehearsal_execution_invalid",
      () => validateControlledPaidCustomerRehearsalDefinition(invalid)
    );
  }
});

test("stale, missing, or contradictory operating-hour evidence fails closed", () => {
  const cases = [
    value => { value.locations[0].operatingHours.state = "UNKNOWN"; },
    value => { value.locations[0].operatingHours.expiresAt = null; },
    value => {
      value.locations[0].operatingHours.expiresAt =
        "2026-08-01T15:00:00.000Z";
    }
  ];
  for (const mutate of cases) {
    const invalid = clone(definition);
    mutate(invalid);
    expectFailure(
      "route_iq_controlled_rehearsal_hours_invalid",
      () => validateControlledPaidCustomerRehearsalDefinition(invalid)
    );
  }
});

test("real-customer, Anthony, and existing CRM receipt context is rejected", () => {
  for (const forbidden of [
    "Fitness Connection",
    "Anthony",
    "riq_receipt_e74e57903a211291a9f1f37a"
  ]) {
    const invalid = clone(definition);
    invalid.configurationIdentity.displayName = forbidden;
    expectFailure(
      "route_iq_controlled_rehearsal_identity_invalid",
      () => validateControlledPaidCustomerRehearsalDefinition(invalid)
    );
  }
});
