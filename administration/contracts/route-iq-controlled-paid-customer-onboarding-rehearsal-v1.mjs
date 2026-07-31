import paidCustomerTemplates from "../workspace-configurations/route-iq-paid-customer-synthetic-fixtures-v1.json" with { type: "json" };
import rehearsalDefinition from "../workspace-configurations/route-iq-controlled-paid-customer-onboarding-rehearsal-v1.json" with { type: "json" };

import {
  validateRouteIqPaidCustomerOnboardingConfiguration
} from "./route-iq-paid-customer-onboarding-v1.mjs";

export const ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_VERSION =
  "route-iq-controlled-paid-customer-onboarding-rehearsal-v1";
export const ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_CLASSIFICATION =
  "SYNTHETIC_EPHEMERAL_PRODUCTION_REHEARSAL";

const STRICT_ID = /^[a-z][a-z0-9_]{2,127}$/u;
const ZIP_CODE = /^\d{5}$/u;
const ISO_INSTANT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u;
const SAFE_TEXT = /^[\p{L}\p{N}][\p{L}\p{N} .,&()/+\-]*$/u;
const FORBIDDEN_REAL_CONTEXT =
  /Fitness Connection|Anthony|riq_receipt_|@(?:gmail|yahoo|outlook)\./iu;

export class RouteIqControlledPaidCustomerRehearsalError extends Error {
  constructor(code) {
    super("Route IQ controlled onboarding rehearsal is invalid.");
    this.name = "RouteIqControlledPaidCustomerRehearsalError";
    this.code = code;
  }
}

function fail(code) {
  throw new RouteIqControlledPaidCustomerRehearsalError(code);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function clone(value) {
  return structuredClone(value);
}

function exactKeys(value, expected, code) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).sort().join("\0") !== [...expected].sort().join("\0")) {
    fail(code);
  }
}

function strictId(value, code) {
  if (typeof value !== "string" || !STRICT_ID.test(value)) fail(code);
  return value;
}

function safeText(value, code, maximumLength = 120) {
  if (typeof value !== "string"
    || value.length < 1
    || value.length > maximumLength
    || value !== value.trim()
    || !SAFE_TEXT.test(value)
    || FORBIDDEN_REAL_CONTEXT.test(value)) {
    fail(code);
  }
  return value;
}

function instant(value, code) {
  if (typeof value !== "string"
    || !ISO_INSTANT.test(value)
    || !Number.isFinite(Date.parse(value))
    || new Date(value).toISOString() !== value) {
    fail(code);
  }
  return Date.parse(value);
}

function unique(values, key, code) {
  if (!Array.isArray(values) || values.length < 1) fail(code);
  const identities = values.map(value => value?.[key]);
  if (identities.some(value => !STRICT_ID.test(value || ""))
    || new Set(identities).size !== identities.length) {
    fail(code);
  }
}

function validateProductionExecution(value) {
  exactKeys(value, [
    "authenticatedReadOnlyInvocationRequired",
    "crmMutationAllowed",
    "inMemoryOnly",
    "invitationAllowed",
    "liveBillingAllowed",
    "persistenceAllowed",
    "productionCustomerMutationAllowed",
    "providerCallAllowed",
    "recommendationInfluenceAllowed",
    "schedulerAllowed"
  ], "route_iq_controlled_rehearsal_execution_invalid");
  if (value.authenticatedReadOnlyInvocationRequired !== true
    || value.inMemoryOnly !== true
    || Object.entries(value).some(([key, item]) => (
      !["authenticatedReadOnlyInvocationRequired", "inMemoryOnly"].includes(key)
      && item !== false
    ))) {
    fail("route_iq_controlled_rehearsal_execution_invalid");
  }
}

function validateIdentity(value) {
  exactKeys(value, [
    "companyId",
    "configurationId",
    "configurationRevision",
    "createdAt",
    "createdByReference",
    "crmWorkflowId",
    "dashboardProfileId",
    "displayName",
    "legalName",
    "representativeScheduleId",
    "territoryDisplayLabel",
    "territoryId",
    "workspaceId"
  ], "route_iq_controlled_rehearsal_identity_invalid");
  for (const key of [
    "companyId",
    "configurationId",
    "createdByReference",
    "crmWorkflowId",
    "dashboardProfileId",
    "representativeScheduleId",
    "territoryId",
    "workspaceId"
  ]) {
    strictId(value[key], "route_iq_controlled_rehearsal_identity_invalid");
  }
  if (value.configurationRevision !== 1
    || value.companyId === value.workspaceId) {
    fail("route_iq_controlled_rehearsal_identity_invalid");
  }
  safeText(value.legalName, "route_iq_controlled_rehearsal_identity_invalid");
  safeText(value.displayName, "route_iq_controlled_rehearsal_identity_invalid");
  safeText(
    value.territoryDisplayLabel,
    "route_iq_controlled_rehearsal_identity_invalid"
  );
  instant(value.createdAt, "route_iq_controlled_rehearsal_identity_invalid");
}

function validateSupportContacts(contacts) {
  unique(contacts, "contactId", "route_iq_controlled_rehearsal_contacts_invalid");
  for (const contact of contacts) {
    exactKeys(contact, [
      "active",
      "contactId",
      "contactReference",
      "contactType",
      "displayLabel"
    ], "route_iq_controlled_rehearsal_contacts_invalid");
    strictId(
      contact.contactReference,
      "route_iq_controlled_rehearsal_contacts_invalid"
    );
    if (!["OPERATIONAL", "SECURITY"].includes(contact.contactType)
      || contact.active !== true) {
      fail("route_iq_controlled_rehearsal_contacts_invalid");
    }
    safeText(
      contact.displayLabel,
      "route_iq_controlled_rehearsal_contacts_invalid"
    );
  }
}

function validateLocations(locations, definition) {
  unique(locations, "locationId", "route_iq_controlled_rehearsal_locations_invalid");
  unique(locations, "businessId", "route_iq_controlled_rehearsal_locations_invalid");
  if (locations.length < 2) {
    fail("route_iq_controlled_rehearsal_locations_invalid");
  }
  const configurationIdentity = definition.configurationIdentity;
  for (const location of locations) {
    exactKeys(location, [
      "address",
      "businessId",
      "categoryId",
      "displayName",
      "locationId",
      "operatingHours",
      "territoryId"
    ], "route_iq_controlled_rehearsal_locations_invalid");
    strictId(location.businessId, "route_iq_controlled_rehearsal_locations_invalid");
    strictId(location.categoryId, "route_iq_controlled_rehearsal_locations_invalid");
    safeText(location.displayName, "route_iq_controlled_rehearsal_locations_invalid");
    if (location.territoryId !== configurationIdentity.territoryId) {
      fail("route_iq_controlled_rehearsal_location_scope_invalid");
    }
    exactKeys(location.address, [
      "city",
      "line1",
      "stateCode",
      "zipCode"
    ], "route_iq_controlled_rehearsal_locations_invalid");
    safeText(location.address.line1, "route_iq_controlled_rehearsal_locations_invalid");
    safeText(location.address.city, "route_iq_controlled_rehearsal_locations_invalid");
    if (!/^[A-Z]{2}$/u.test(location.address.stateCode)
      || !ZIP_CODE.test(location.address.zipCode)) {
      fail("route_iq_controlled_rehearsal_locations_invalid");
    }
    exactKeys(location.operatingHours, [
      "expiresAt",
      "state",
      "timeZone",
      "verifiedAt",
      "weeklyScheduleVersion"
    ], "route_iq_controlled_rehearsal_hours_invalid");
    safeText(
      location.operatingHours.timeZone,
      "route_iq_controlled_rehearsal_hours_invalid"
    );
    strictId(
      location.operatingHours.weeklyScheduleVersion,
      "route_iq_controlled_rehearsal_hours_invalid"
    );
    if (!["OPEN_VERIFIED", "CLOSED_VERIFIED"].includes(
      location.operatingHours.state
    )) {
      fail("route_iq_controlled_rehearsal_hours_invalid");
    }
    const verifiedAt = instant(
      location.operatingHours.verifiedAt,
      "route_iq_controlled_rehearsal_hours_invalid"
    );
    const expiresAt = instant(
      location.operatingHours.expiresAt,
      "route_iq_controlled_rehearsal_hours_invalid"
    );
    if (expiresAt <= verifiedAt
      || expiresAt - verifiedAt > 24 * 60 * 60 * 1000) {
      fail("route_iq_controlled_rehearsal_hours_invalid");
    }
  }
}

function validatePrincipals(principals, template) {
  unique(principals, "principalId", "route_iq_controlled_rehearsal_principals_invalid");
  unique(principals, "profileId", "route_iq_controlled_rehearsal_principals_invalid");
  const configuredRoles = new Set(template.access.roles.map(role => role.roleId));
  let managerCount = 0;
  let representativeCount = 0;
  for (const principal of principals) {
    exactKeys(principal, [
      "activationState",
      "displayName",
      "invitationState",
      "principalId",
      "principalKind",
      "profileId",
      "roleId"
    ], "route_iq_controlled_rehearsal_principals_invalid");
    safeText(
      principal.displayName,
      "route_iq_controlled_rehearsal_principals_invalid"
    );
    strictId(principal.roleId, "route_iq_controlled_rehearsal_principals_invalid");
    if (!configuredRoles.has(principal.roleId)
      || principal.invitationState !== "NOT_SENT"
      || principal.activationState !== "INACTIVE") {
      fail("route_iq_controlled_rehearsal_principals_invalid");
    }
    if (principal.principalKind === "OWNER_MANAGER") managerCount += 1;
    else if (principal.principalKind === "REPRESENTATIVE") representativeCount += 1;
    else fail("route_iq_controlled_rehearsal_principals_invalid");
  }
  if (managerCount !== 1 || representativeCount < 2) {
    fail("route_iq_controlled_rehearsal_principals_invalid");
  }
}

function validateBilling(value) {
  exactKeys(value, [
    "bankAccountConfirmed",
    "billingActivationState",
    "currency",
    "einConfirmed",
    "legalEntityConfirmed",
    "mode",
    "paymentMethodId",
    "planId",
    "stripeCustomerId",
    "stripeMode",
    "subscriptionId",
    "unitAmountCents"
  ], "route_iq_controlled_rehearsal_billing_invalid");
  strictId(value.planId, "route_iq_controlled_rehearsal_billing_invalid");
  if (value.mode !== "SIMULATED_ONLY"
    || value.currency !== "USD"
    || !Number.isInteger(value.unitAmountCents)
    || value.unitAmountCents < 1
    || value.stripeMode !== "DISABLED"
    || value.stripeCustomerId !== null
    || value.subscriptionId !== null
    || value.paymentMethodId !== null
    || value.legalEntityConfirmed !== false
    || value.einConfirmed !== false
    || value.bankAccountConfirmed !== false
    || value.billingActivationState !== "BLOCKED") {
    fail("route_iq_controlled_rehearsal_billing_invalid");
  }
}

function validateExpected(value) {
  exactKeys(value, [
    "closedLocationCount",
    "evaluatedAt",
    "failedLifecycleState",
    "finalLifecycleState",
    "finalStoreRecordCount",
    "initialLifecycleState",
    "locationCount",
    "managerCount",
    "openLocationCount",
    "representativeCount"
  ], "route_iq_controlled_rehearsal_expectation_invalid");
  instant(value.evaluatedAt, "route_iq_controlled_rehearsal_expectation_invalid");
  if (value.initialLifecycleState !== "DRAFT"
    || value.failedLifecycleState !== "VALIDATION_FAILED"
    || value.finalLifecycleState !== "VALIDATED"
    || value.locationCount < 2
    || value.representativeCount < 2
    || value.managerCount !== 1
    || value.openLocationCount < 1
    || value.closedLocationCount < 1
    || value.finalStoreRecordCount !== 0) {
    fail("route_iq_controlled_rehearsal_expectation_invalid");
  }
}

export function validateControlledPaidCustomerRehearsalDefinition(value) {
  exactKeys(value, [
    "billing",
    "classification",
    "configurationIdentity",
    "expected",
    "locations",
    "principals",
    "productionExecution",
    "rehearsalId",
    "schemaVersion",
    "supportContacts",
    "templateConfigurationId"
  ], "route_iq_controlled_rehearsal_definition_invalid");
  if (value.schemaVersion !== ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_VERSION
    || value.classification
      !== ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_CLASSIFICATION) {
    fail("route_iq_controlled_rehearsal_definition_invalid");
  }
  strictId(value.rehearsalId, "route_iq_controlled_rehearsal_definition_invalid");
  strictId(
    value.templateConfigurationId,
    "route_iq_controlled_rehearsal_definition_invalid"
  );
  const template = paidCustomerTemplates.configurations.find(
    item => item.configurationId === value.templateConfigurationId
  );
  if (!template) fail("route_iq_controlled_rehearsal_template_invalid");
  validateProductionExecution(value.productionExecution);
  validateIdentity(value.configurationIdentity);
  validateSupportContacts(value.supportContacts);
  validateLocations(value.locations, value);
  validatePrincipals(value.principals, template);
  validateBilling(value.billing);
  validateExpected(value.expected);
  if (value.expected.locationCount !== value.locations.length
    || value.expected.managerCount
      !== value.principals.filter(item => item.principalKind === "OWNER_MANAGER").length
    || value.expected.representativeCount
      !== value.principals.filter(item => item.principalKind === "REPRESENTATIVE").length
    || value.expected.openLocationCount
      !== value.locations.filter(item => item.operatingHours.state === "OPEN_VERIFIED").length
    || value.expected.closedLocationCount
      !== value.locations.filter(item => item.operatingHours.state === "CLOSED_VERIFIED").length) {
    fail("route_iq_controlled_rehearsal_expectation_invalid");
  }
  return deepFreeze(clone(value));
}

function materializeOnboardingConfiguration(definition) {
  const template = paidCustomerTemplates.configurations.find(
    item => item.configurationId === definition.templateConfigurationId
  );
  const identity = definition.configurationIdentity;
  const configuration = clone(template);
  configuration.configurationId = identity.configurationId;
  configuration.configurationRevision = identity.configurationRevision;
  configuration.company = {
    companyId: identity.companyId,
    workspaceId: identity.workspaceId,
    identityImmutable: true,
    legalName: identity.legalName,
    displayName: identity.displayName
  };
  configuration.territory.territoryId = identity.territoryId;
  configuration.territory.displayLabel = identity.territoryDisplayLabel;
  configuration.access.representativeSchedules =
    configuration.access.representativeSchedules.map(schedule => ({
      ...schedule,
      scheduleId: identity.representativeScheduleId
    }));
  configuration.dashboard.dashboardProfileId = identity.dashboardProfileId;
  configuration.crm.workflowId = identity.crmWorkflowId;
  configuration.supportContacts = clone(definition.supportContacts);
  configuration.lifecycle = {
    state: "DRAFT",
    revision: 1,
    lastTransitionAt: identity.createdAt,
    approvalReference: null,
    failure: null
  };
  configuration.provenance = {
    authority: "prometheus_administration",
    sourceSystem: "synthetic_controlled_rehearsal_definition",
    sourceReferences: [definition.rehearsalId],
    createdAt: identity.createdAt,
    createdByReference: identity.createdByReference,
    configurationIdentity:
      `${identity.configurationId}@${identity.configurationRevision}`
  };
  return validateRouteIqPaidCustomerOnboardingConfiguration(configuration);
}

export function createControlledPaidCustomerRehearsalDraft(
  sourceDefinition = rehearsalDefinition
) {
  const definition = validateControlledPaidCustomerRehearsalDefinition(
    sourceDefinition
  );
  return deepFreeze({
    schemaVersion: ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_VERSION,
    rehearsalId: definition.rehearsalId,
    classification: definition.classification,
    lifecycleState: "DRAFT",
    onboardingConfiguration: materializeOnboardingConfiguration(definition),
    locations: clone(definition.locations),
    principals: clone(definition.principals),
    billing: clone(definition.billing),
    productionExecution: clone(definition.productionExecution),
    expected: clone(definition.expected)
  });
}

export function validateControlledPaidCustomerRehearsalDraft(value) {
  exactKeys(value, [
    "billing",
    "classification",
    "expected",
    "lifecycleState",
    "locations",
    "onboardingConfiguration",
    "principals",
    "productionExecution",
    "rehearsalId",
    "schemaVersion"
  ], "route_iq_controlled_rehearsal_draft_invalid");
  if (value.schemaVersion !== ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_VERSION
    || value.classification
      !== ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_CLASSIFICATION
    || value.lifecycleState !== "DRAFT") {
    fail("route_iq_controlled_rehearsal_draft_invalid");
  }
  const definition = validateControlledPaidCustomerRehearsalDefinition({
    ...rehearsalDefinition,
    rehearsalId: value.rehearsalId,
    classification: value.classification,
    locations: value.locations,
    principals: value.principals,
    billing: value.billing,
    productionExecution: value.productionExecution,
    expected: value.expected
  });
  const configuration = validateRouteIqPaidCustomerOnboardingConfiguration(
    value.onboardingConfiguration
  );
  if (configuration.lifecycle.state !== "DRAFT"
    || configuration.company.companyId
      !== definition.configurationIdentity.companyId
    || configuration.company.workspaceId
      !== definition.configurationIdentity.workspaceId
    || configuration.territory.territoryId
      !== definition.configurationIdentity.territoryId
    || value.locations.some(location =>
      !configuration.territory.authorizedZipCodes.includes(location.address.zipCode)
      || !configuration.targeting.includedCategoryIds.includes(location.categoryId))
    || JSON.stringify(value).includes("Fitness Connection")
    || JSON.stringify(value).includes("Anthony")
    || JSON.stringify(value).includes("riq_receipt_")) {
    fail("route_iq_controlled_rehearsal_scope_invalid");
  }
  return deepFreeze({
    ...clone(value),
    onboardingConfiguration: configuration
  });
}

export const controlledPaidCustomerRehearsalDefinition =
  validateControlledPaidCustomerRehearsalDefinition(rehearsalDefinition);
