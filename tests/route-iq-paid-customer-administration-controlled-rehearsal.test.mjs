import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_CLASSIFICATION,
  ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_EVIDENCE_VERSION,
  ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_VERSION,
  RouteIqControlledPaidCustomerRehearsalError,
  controlledPaidCustomerRehearsalDefinition,
  createControlledPaidCustomerRehearsalDraft,
  validateControlledPaidCustomerRehearsalDefinition,
  validateControlledPaidCustomerRehearsalDraft
} from "../administration/contracts/route-iq-controlled-paid-customer-onboarding-rehearsal-v1.mjs";
import {
  transitionRouteIqPaidCustomerOnboarding
} from "../administration/contracts/route-iq-paid-customer-onboarding-v1.mjs";
import {
  createPaidCustomerIntelligenceScope,
  evaluatePaidCustomerRecommendationAdmission,
  paidCustomerIntelligenceOperations
} from "../intelligence/route-iq-paid-customer-intelligence.mjs";

const definition = JSON.parse(readFileSync(new URL(
  "../administration/workspace-configurations/"
    + "route-iq-controlled-paid-customer-onboarding-rehearsal-v1.json",
  import.meta.url
), "utf8"));
const genericFixtures = JSON.parse(readFileSync(new URL(
  "../administration/workspace-configurations/"
    + "route-iq-paid-customer-synthetic-fixtures-v1.json",
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

function validatedConfiguration() {
  return transitionRouteIqPaidCustomerOnboarding(
    createControlledPaidCustomerRehearsalDraft().onboardingConfiguration,
    "VALIDATED",
    { transitionedAt: "2026-07-30T15:03:00.000Z" }
  );
}

test("canonical rehearsal is versioned fictional and authorized only for ephemeral memory", () => {
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
  assert.equal(genericFixtures.productionUseAuthorized, false);
  assert.deepEqual(validated.productionMemoryAuthorization, {
    authorizationId: "controlled_orion_rehearsal_memory_authorization_v1",
    authority: "prometheus_administration",
    executionMode: "AUTHENTICATED_EPHEMERAL_IN_MEMORY_ONLY",
    canonicalDefinitionRequired: true,
    controlledProductionMemoryUseAuthorized: true,
    genericFixtureProductionUseAuthorized: false,
    durableProductionUseAuthorized: false,
    productionCustomerUseAuthorized: false,
    sourceReferences: [
      "route_iq_controlled_paid_customer_onboarding_rehearsal_v1",
      "config_aster_security_services_v1_template_only"
    ]
  });
  assert.equal(validated.productionExecution.inMemoryOnly, true);
  for (const [key, value] of Object.entries(validated.productionExecution)) {
    if (!["authenticatedReadOnlyInvocationRequired", "inMemoryOnly"].includes(key)) {
      assert.equal(value, false);
    }
  }
});

test("Draft materializes one exact reusable configuration and immutable scope", () => {
  const draft = validateControlledPaidCustomerRehearsalDraft(
    createControlledPaidCustomerRehearsalDraft()
  );
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
  assert.equal(
    draft.onboardingConfiguration.dashboard.dashboardProfileId,
    definition.configurationIdentity.dashboardProfileId
  );
  assert.equal(
    draft.onboardingConfiguration.crm.workflowId,
    definition.configurationIdentity.crmWorkflowId
  );
  assert.deepEqual(
    draft.onboardingConfiguration.provenance.sourceReferences,
    [
      definition.rehearsalId,
      definition.productionMemoryAuthorization.authorizationId
    ]
  );
  assert.equal(Object.isFrozen(draft), true);
});

test("manager and representatives bind to the exact selected-template roles", () => {
  const draft = createControlledPaidCustomerRehearsalDraft();
  const manager = draft.principals.find(
    principal => principal.principalKind === "OWNER_MANAGER"
  );
  const representatives = draft.principals.filter(
    principal => principal.principalKind === "REPRESENTATIVE"
  );
  assert.equal(manager.roleId, definition.roleBindings.ownerManagerRoleId);
  assert.equal(representatives.length, 2);
  assert.ok(representatives.every(
    principal => principal.roleId === definition.roleBindings.representativeRoleId
  ));

  const swapped = clone(definition);
  swapped.principals[0].roleId = definition.roleBindings.representativeRoleId;
  swapped.principals[1].roleId = definition.roleBindings.ownerManagerRoleId;
  expectFailure(
    "route_iq_controlled_rehearsal_principal_role_invalid",
    () => validateControlledPaidCustomerRehearsalDefinition(swapped)
  );
});

test("only the exact canonical source definition can materialize", () => {
  const alternateName = clone(definition);
  alternateName.configurationIdentity.displayName = "Alternate Synthetic Company";
  expectFailure(
    "route_iq_controlled_rehearsal_definition_not_canonical",
    () => createControlledPaidCustomerRehearsalDraft(alternateName)
  );

  const alternateDefinitions = [
    value => { value.configurationIdentity.companyId = "company_alternate_rehearsal"; },
    value => { value.locations[0].displayName = "Alternate Synthetic Location"; },
    value => { value.locations[0].address.line1 = "999 Alternate Avenue"; }
  ];
  for (const mutate of alternateDefinitions) {
    const alternate = clone(definition);
    mutate(alternate);
    assert.throws(
      () => createControlledPaidCustomerRehearsalDraft(alternate),
      error => error instanceof RouteIqControlledPaidCustomerRehearsalError
    );
  }
});

test("Draft rejects every key nested onboarding-contract substitution", () => {
  const substitutions = [
    {
      name: "configuration identity",
      mutate(configuration) {
        configuration.configurationId = "config_substituted_rehearsal_v1";
        configuration.provenance.configurationIdentity =
          "config_substituted_rehearsal_v1@1";
      }
    },
    {
      name: "industry",
      mutate(configuration) {
        configuration.operatingProfile.industryTemplateId =
          "substituted_security_industry";
      }
    },
    {
      name: "dashboard",
      mutate(configuration) {
        configuration.dashboard.dashboardProfileId =
          "substituted_rehearsal_dashboard";
      }
    },
    {
      name: "CRM",
      mutate(configuration) {
        configuration.crm.workflowId = "substituted_rehearsal_crm";
      }
    },
    {
      name: "roles",
      mutate(configuration) {
        configuration.access.roles[0].displayLabel = "Substituted advisor";
      }
    },
    {
      name: "schedule",
      mutate(configuration) {
        configuration.access.representativeSchedules[0]
          .weeklySchedule[0].windows[0].start = "09:00";
      }
    },
    {
      name: "terminology",
      mutate(configuration) {
        configuration.terminology.terms[0].singular = "site";
      }
    },
    {
      name: "provenance",
      mutate(configuration) {
        configuration.provenance.sourceSystem =
          "substituted_controlled_rehearsal_source";
      }
    },
    {
      name: "lifecycle",
      mutate(configuration) {
        configuration.lifecycle.lastTransitionAt = "2026-07-30T15:01:00.000Z";
      }
    },
    {
      name: "scope",
      mutate(configuration) {
        configuration.company.displayName = "Substituted Synthetic Scope";
      }
    }
  ];

  for (const substitution of substitutions) {
    const draft = clone(createControlledPaidCustomerRehearsalDraft());
    substitution.mutate(draft.onboardingConfiguration);
    expectFailure(
      "route_iq_controlled_rehearsal_draft_not_canonical",
      () => validateControlledPaidCustomerRehearsalDraft(draft),
      substitution.name
    );
  }
});

test("Draft rejects noncanonical rehearsal payload fields and permits no successful override", () => {
  const substitutions = [
    value => { value.rehearsalId = "alternate_controlled_rehearsal"; },
    value => { value.locations[0].displayName = "Alternate Synthetic Location"; },
    value => { value.principals[0].displayName = "Alternate Synthetic Manager"; },
    value => { value.billing.unitAmountCents += 1; },
    value => { value.expected.finalStoreRecordCount = 1; },
    value => {
      value.productionMemoryAuthorization.authorizationId =
        "alternate_memory_authorization";
    }
  ];
  for (const mutate of substitutions) {
    const draft = clone(createControlledPaidCustomerRehearsalDraft());
    mutate(draft);
    assert.throws(
      () => validateControlledPaidCustomerRehearsalDraft(draft),
      error => error instanceof RouteIqControlledPaidCustomerRehearsalError
    );
  }
});

test("controlled location-scope failure remains precise and never validates", () => {
  const draft = clone(createControlledPaidCustomerRehearsalDraft());
  draft.locations[0].territoryId = "outside_controlled_rehearsal_territory";
  expectFailure(
    "route_iq_controlled_rehearsal_location_scope_invalid",
    () => validateControlledPaidCustomerRehearsalDraft(draft)
  );
  assert.equal(
    controlledPaidCustomerRehearsalDefinition.locations[0].territoryId,
    definition.configurationIdentity.territoryId
  );
});

test("operating evidence is complete and evaluation is inside a maximum 24-hour interval", () => {
  const draft = createControlledPaidCustomerRehearsalDraft();
  for (const location of draft.locations) {
    const evidence = location.businessEvidence;
    assert.equal(
      evidence.schemaVersion,
      ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_EVIDENCE_VERSION
    );
    assert.equal(evidence.scope.immutable, true);
    assert.equal(evidence.identity.verified, true);
    assert.equal(evidence.address.physicalAddressVerified, true);
    assert.equal(evidence.operatingStatus, "OPEN");
    assert.ok(evidence.availability.weeklySchedule.length > 0);
    assert.equal(evidence.provider.state, "VERIFIED");
    assert.equal(evidence.duplicateResolution.state, "UNIQUE");
    assert.equal(evidence.conflictResolution.state, "NONE");
    assert.equal(evidence.verification.freshnessState, "FRESH");
    assert.equal(evidence.targetProfile.matches, true);
    assert.equal(evidence.evidenceQuality.state, "VERIFIED");
    const verifiedAt = Date.parse(evidence.verification.verifiedAt);
    const evaluatedAt = Date.parse(evidence.verification.evaluatedAt);
    const expiresAt = Date.parse(evidence.verification.expiresAt);
    assert.ok(verifiedAt <= evaluatedAt);
    assert.ok(evaluatedAt < expiresAt);
    assert.ok(expiresAt - verifiedAt <= 24 * 60 * 60 * 1000);
  }
});

test("expired or out-of-interval evaluation evidence fails closed", () => {
  const cases = [
    value => {
      value.locations[0].businessEvidence.verification.evaluatedAt =
        "2026-07-31T14:00:00.000Z";
    },
    value => {
      value.locations[0].businessEvidence.verification.evaluatedAt =
        "2026-07-30T13:59:59.000Z";
    },
    value => {
      value.locations[0].businessEvidence.verification.expiresAt =
        "2026-07-31T15:00:00.000Z";
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

test("missing or conflicting operating evidence fails closed", () => {
  const cases = [
    value => {
      delete value.locations[0].businessEvidence.provider.source;
    },
    value => {
      value.locations[0].businessEvidence.conflictResolution.state = "CONFLICT";
    },
    value => {
      value.locations[0].businessEvidence.duplicateResolution.state = "UNRESOLVED";
    },
    value => {
      value.locations[0].businessEvidence.availability.weeklySchedule = [];
    },
    value => {
      value.locations[0].businessEvidence.targetProfile.matches = false;
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

test("canonical business evidence is directly compatible with Intelligence admission", () => {
  const draft = createControlledPaidCustomerRehearsalDraft();
  const configuration = validatedConfiguration();
  const representative = draft.principals.find(
    principal => principal.principalKind === "REPRESENTATIVE"
  );
  const scope = createPaidCustomerIntelligenceScope({
    onboardingConfiguration: configuration,
    principal: {
      authority: "server_authenticated_principal",
      authenticated: true,
      companyId: configuration.company.companyId,
      workspaceId: configuration.company.workspaceId,
      roleId: representative.roleId
    },
    operation: paidCustomerIntelligenceOperations.recommendationAdmission
  });
  const decisions = draft.locations.map(location =>
    evaluatePaidCustomerRecommendationAdmission({
      paidCustomerScope: scope,
      businessEvidence: location.businessEvidence,
      evaluatedAt: draft.expected.evaluatedAt
    })
  );
  assert.deepEqual(
    decisions.map(decision => ({
      status: decision.status,
      reasonCode: decision.reasonCode,
      routeEligible: decision.representativeRoutingEligible,
      recommendationInfluence: decision.recommendationInfluence
    })),
    [
      {
        status: "ADMISSION_ELIGIBLE",
        reasonCode: "ALL_GOVERNED_GATES_PASSED",
        routeEligible: false,
        recommendationInfluence: "OFF"
      },
      {
        status: "ADMISSION_REJECTED",
        reasonCode: "BUSINESS_NOT_OPEN_NOW",
        routeEligible: false,
        recommendationInfluence: "OFF"
      }
    ]
  );
});

test("activation persistence invitation provider and billing boundaries cannot open", () => {
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

test("generic or durable production-use authorization cannot be broadened", () => {
  const cases = [
    value => {
      value.productionMemoryAuthorization.genericFixtureProductionUseAuthorized = true;
    },
    value => {
      value.productionMemoryAuthorization.durableProductionUseAuthorized = true;
    },
    value => {
      value.productionMemoryAuthorization.productionCustomerUseAuthorized = true;
    },
    value => {
      value.productionMemoryAuthorization.canonicalDefinitionRequired = false;
    }
  ];
  for (const mutate of cases) {
    const invalid = clone(definition);
    mutate(invalid);
    expectFailure(
      "route_iq_controlled_rehearsal_memory_authorization_invalid",
      () => validateControlledPaidCustomerRehearsalDefinition(invalid)
    );
  }
});
