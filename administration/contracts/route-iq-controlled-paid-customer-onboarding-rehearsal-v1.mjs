import paidCustomerTemplates from "../workspace-configurations/route-iq-paid-customer-synthetic-fixtures-v1.json" with { type: "json" };
import rehearsalDefinitionSource from "../workspace-configurations/route-iq-controlled-paid-customer-onboarding-rehearsal-v1.json" with { type: "json" };

import {
  validateRouteIqPaidCustomerOnboardingConfiguration
} from "./route-iq-paid-customer-onboarding-v1.mjs";

export const ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_VERSION =
  "route-iq-controlled-paid-customer-onboarding-rehearsal-v1";
export const ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_CLASSIFICATION =
  "SYNTHETIC_EPHEMERAL_PRODUCTION_REHEARSAL";
export const ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_EVIDENCE_VERSION =
  "route-iq-verified-business-evidence-v1";

const STRICT_ID = /^[a-z][a-z0-9_]{2,127}$/u;
const ZIP_CODE = /^\d{5}$/u;
const ISO_INSTANT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u;
const SAFE_TEXT = /^[\p{L}\p{N}][\p{L}\p{N} .,&()/+\-]*$/u;
const CLOCK_TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/u;
const DAYS = new Set([
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY"
]);
const MAX_FRESHNESS_MS = 24 * 60 * 60 * 1000;

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

function structurallyEqual(left, right) {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== "object" || typeof right !== "object") {
    return false;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left)
      && Array.isArray(right)
      && left.length === right.length
      && left.every((item, index) => structurallyEqual(item, right[index]));
  }
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key, index) =>
      key === rightKeys[index] && structurallyEqual(left[key], right[key]));
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
    || !SAFE_TEXT.test(value)) {
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

function canonicalTemplate(definition) {
  const template = paidCustomerTemplates.configurations.find(
    item => item.configurationId === definition.templateConfigurationId
  );
  if (!template) fail("route_iq_controlled_rehearsal_template_invalid");
  return template;
}

function validateProductionMemoryAuthorization(value) {
  exactKeys(value, [
    "authorizationId",
    "authority",
    "canonicalDefinitionRequired",
    "controlledProductionMemoryUseAuthorized",
    "durableProductionUseAuthorized",
    "executionMode",
    "genericFixtureProductionUseAuthorized",
    "productionCustomerUseAuthorized",
    "sourceReferences"
  ], "route_iq_controlled_rehearsal_memory_authorization_invalid");
  strictId(
    value.authorizationId,
    "route_iq_controlled_rehearsal_memory_authorization_invalid"
  );
  unique(
    value.sourceReferences.map(reference => ({ reference })),
    "reference",
    "route_iq_controlled_rehearsal_memory_authorization_invalid"
  );
  if (paidCustomerTemplates.productionUseAuthorized !== false
    || value.authority !== "prometheus_administration"
    || value.executionMode !== "AUTHENTICATED_EPHEMERAL_IN_MEMORY_ONLY"
    || value.canonicalDefinitionRequired !== true
    || value.controlledProductionMemoryUseAuthorized !== true
    || value.genericFixtureProductionUseAuthorized !== false
    || value.durableProductionUseAuthorized !== false
    || value.productionCustomerUseAuthorized !== false
    || !value.sourceReferences.includes(
      "route_iq_controlled_paid_customer_onboarding_rehearsal_v1"
    )
    || !value.sourceReferences.includes(
      "config_aster_security_services_v1_template_only"
    )) {
    fail("route_iq_controlled_rehearsal_memory_authorization_invalid");
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
  if (value.configurationRevision !== 1 || value.companyId === value.workspaceId) {
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

function validateRoleBindings(value, template) {
  exactKeys(value, [
    "ownerManagerRoleId",
    "representativeRoleId"
  ], "route_iq_controlled_rehearsal_role_bindings_invalid");
  const rolesById = new Map(template.access.roles.map(role => [role.roleId, role]));
  const manager = rolesById.get(value.ownerManagerRoleId);
  const representative = rolesById.get(value.representativeRoleId);
  if (!manager
    || !representative
    || manager.roleId === representative.roleId
    || !manager.permissions.includes("view_company_dashboard")
    || !representative.permissions.includes("view_assigned_territory")) {
    fail("route_iq_controlled_rehearsal_role_bindings_invalid");
  }
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

function validateWeeklySchedule(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 7) {
    fail("route_iq_controlled_rehearsal_hours_invalid");
  }
  const days = new Set();
  for (const day of value) {
    exactKeys(day, ["day", "windows"], "route_iq_controlled_rehearsal_hours_invalid");
    if (!DAYS.has(day.day) || days.has(day.day)
      || !Array.isArray(day.windows) || day.windows.length < 1) {
      fail("route_iq_controlled_rehearsal_hours_invalid");
    }
    days.add(day.day);
    for (const window of day.windows) {
      exactKeys(
        window,
        ["end", "start"],
        "route_iq_controlled_rehearsal_hours_invalid"
      );
      if (!CLOCK_TIME.test(window.start)
        || !CLOCK_TIME.test(window.end)
        || window.start >= window.end) {
        fail("route_iq_controlled_rehearsal_hours_invalid");
      }
    }
  }
}

function validateBusinessEvidence(evidence, location, definition) {
  const code = "route_iq_controlled_rehearsal_hours_invalid";
  const identity = definition.configurationIdentity;
  exactKeys(evidence, [
    "address",
    "availability",
    "businessId",
    "categoryId",
    "companyId",
    "configurationVersion",
    "conflictResolution",
    "duplicateResolution",
    "evidenceQuality",
    "identity",
    "operatingStatus",
    "provenance",
    "provider",
    "recommendationReason",
    "schemaVersion",
    "scope",
    "targetProfile",
    "territoryId",
    "verification",
    "workspaceId"
  ], code);
  const configurationVersion =
    `${identity.configurationId}@${identity.configurationRevision}`;
  if (evidence.schemaVersion
      !== ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_EVIDENCE_VERSION
    || evidence.configurationVersion !== configurationVersion
    || evidence.companyId !== identity.companyId
    || evidence.workspaceId !== identity.workspaceId
    || evidence.businessId !== location.businessId
    || evidence.territoryId !== location.territoryId
    || evidence.categoryId !== location.categoryId
    || evidence.operatingStatus !== "OPEN") {
    fail(code);
  }
  exactKeys(evidence.scope, [
    "companyId",
    "immutable",
    "workspaceId"
  ], code);
  if (evidence.scope.companyId !== identity.companyId
    || evidence.scope.workspaceId !== identity.workspaceId
    || evidence.scope.immutable !== true) {
    fail(code);
  }
  exactKeys(evidence.identity, [
    "verificationSource",
    "verified"
  ], code);
  if (evidence.identity.verified !== true
    || evidence.identity.verificationSource
      !== "synthetic_controlled_rehearsal_administration") {
    fail(code);
  }
  exactKeys(evidence.address, [
    "city",
    "physicalAddressVerified",
    "zipCode"
  ], code);
  if (evidence.address.physicalAddressVerified !== true
    || evidence.address.city !== location.address.city
    || evidence.address.zipCode !== location.address.zipCode) {
    fail(code);
  }
  exactKeys(evidence.availability, [
    "accessWindow",
    "state",
    "timeZone",
    "weeklySchedule",
    "weeklyScheduleVersion"
  ], code);
  if (!["ACCESS_WINDOW_VERIFIED", "CLOSED_VERIFIED"].includes(
    evidence.availability.state
  )) {
    fail(code);
  }
  safeText(evidence.availability.timeZone, code);
  strictId(evidence.availability.weeklyScheduleVersion, code);
  validateWeeklySchedule(evidence.availability.weeklySchedule);
  exactKeys(evidence.availability.accessWindow, [
    "endAt",
    "startAt",
    "state"
  ], code);
  const accessStart = instant(evidence.availability.accessWindow.startAt, code);
  const accessEnd = instant(evidence.availability.accessWindow.endAt, code);
  if (accessEnd <= accessStart) fail(code);

  exactKeys(evidence.provider, [
    "lastFailedAt",
    "source",
    "state"
  ], code);
  if (evidence.provider.state !== "VERIFIED"
    || evidence.provider.source !== "synthetic_controlled_rehearsal_administration"
    || evidence.provider.lastFailedAt !== null) {
    fail(code);
  }
  exactKeys(evidence.provenance, [
    "authority",
    "sourceReferences",
    "sourceSystem"
  ], code);
  if (evidence.provenance.authority !== "prometheus_administration"
    || evidence.provenance.sourceSystem !== "controlled_rehearsal_fixture"
    || !Array.isArray(evidence.provenance.sourceReferences)
    || evidence.provenance.sourceReferences.length !== 2
    || !evidence.provenance.sourceReferences.includes(definition.rehearsalId)
    || !evidence.provenance.sourceReferences.includes(location.locationId)) {
    fail(code);
  }
  exactKeys(evidence.duplicateResolution, ["state"], code);
  exactKeys(evidence.conflictResolution, ["state"], code);
  exactKeys(evidence.targetProfile, ["matches"], code);
  exactKeys(evidence.evidenceQuality, ["confidence", "state"], code);
  if (evidence.duplicateResolution.state !== "UNIQUE"
    || evidence.conflictResolution.state !== "NONE"
    || evidence.targetProfile.matches !== true
    || evidence.evidenceQuality.state !== "VERIFIED"
    || !["HIGH", "MEDIUM"].includes(evidence.evidenceQuality.confidence)) {
    fail(code);
  }
  safeText(evidence.recommendationReason, code);
  exactKeys(evidence.verification, [
    "evaluatedAt",
    "expiresAt",
    "freshnessState",
    "verifiedAt"
  ], code);
  const verifiedAt = instant(evidence.verification.verifiedAt, code);
  const evaluatedAt = instant(evidence.verification.evaluatedAt, code);
  const expiresAt = instant(evidence.verification.expiresAt, code);
  if (evidence.verification.freshnessState !== "FRESH"
    || evidence.verification.evaluatedAt !== definition.expected.evaluatedAt
    || verifiedAt > evaluatedAt
    || evaluatedAt >= expiresAt
    || expiresAt - verifiedAt > MAX_FRESHNESS_MS) {
    fail(code);
  }
  const accessState = evidence.availability.accessWindow.state;
  const insideAccessWindow = accessStart <= evaluatedAt && evaluatedAt < accessEnd;
  if ((evidence.availability.state === "ACCESS_WINDOW_VERIFIED"
      && (accessState !== "VERIFIED_OPEN" || !insideAccessWindow))
    || (evidence.availability.state === "CLOSED_VERIFIED"
      && (accessState !== "VERIFIED_CLOSED" || insideAccessWindow))) {
    fail(code);
  }
}

function validateLocations(locations, definition) {
  unique(locations, "locationId", "route_iq_controlled_rehearsal_locations_invalid");
  unique(locations, "businessId", "route_iq_controlled_rehearsal_locations_invalid");
  if (locations.length !== 2) {
    fail("route_iq_controlled_rehearsal_locations_invalid");
  }
  const configurationIdentity = definition.configurationIdentity;
  for (const location of locations) {
    exactKeys(location, [
      "address",
      "businessEvidence",
      "businessId",
      "categoryId",
      "displayName",
      "locationId",
      "territoryId"
    ], "route_iq_controlled_rehearsal_locations_invalid");
    strictId(location.locationId, "route_iq_controlled_rehearsal_locations_invalid");
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
    validateBusinessEvidence(location.businessEvidence, location, definition);
  }
}

function validatePrincipals(principals, template, roleBindings) {
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
    if (principal.principalKind === "OWNER_MANAGER"
      && principal.roleId === roleBindings.ownerManagerRoleId) {
      managerCount += 1;
    } else if (principal.principalKind === "REPRESENTATIVE"
      && principal.roleId === roleBindings.representativeRoleId) {
      representativeCount += 1;
    } else {
      fail("route_iq_controlled_rehearsal_principal_role_invalid");
    }
  }
  if (managerCount !== 1 || representativeCount !== 2) {
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
    || value.locationCount !== 2
    || value.representativeCount !== 2
    || value.managerCount !== 1
    || value.openLocationCount !== 1
    || value.closedLocationCount !== 1
    || value.finalStoreRecordCount !== 0) {
    fail("route_iq_controlled_rehearsal_expectation_invalid");
  }
}

const canonicalRehearsalDefinition = deepFreeze(clone(rehearsalDefinitionSource));

export function validateControlledPaidCustomerRehearsalDefinition(value) {
  exactKeys(value, [
    "billing",
    "classification",
    "configurationIdentity",
    "expected",
    "locations",
    "principals",
    "productionExecution",
    "productionMemoryAuthorization",
    "rehearsalId",
    "roleBindings",
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
  const template = canonicalTemplate(value);
  validateProductionMemoryAuthorization(value.productionMemoryAuthorization);
  validateProductionExecution(value.productionExecution);
  validateIdentity(value.configurationIdentity);
  validateRoleBindings(value.roleBindings, template);
  validateSupportContacts(value.supportContacts);
  validateLocations(value.locations, value);
  validatePrincipals(value.principals, template, value.roleBindings);
  validateBilling(value.billing);
  validateExpected(value.expected);
  const openLocationCount = value.locations.filter(location =>
    location.businessEvidence.availability.state === "ACCESS_WINDOW_VERIFIED"
  ).length;
  const closedLocationCount = value.locations.filter(location =>
    location.businessEvidence.availability.state === "CLOSED_VERIFIED"
  ).length;
  if (value.expected.locationCount !== value.locations.length
    || value.expected.managerCount
      !== value.principals.filter(item => item.principalKind === "OWNER_MANAGER").length
    || value.expected.representativeCount
      !== value.principals.filter(item => item.principalKind === "REPRESENTATIVE").length
    || value.expected.openLocationCount !== openLocationCount
    || value.expected.closedLocationCount !== closedLocationCount) {
    fail("route_iq_controlled_rehearsal_expectation_invalid");
  }
  if (!structurallyEqual(value, canonicalRehearsalDefinition)) {
    fail("route_iq_controlled_rehearsal_definition_not_canonical");
  }
  return deepFreeze(clone(value));
}

function materializeOnboardingConfiguration(definition) {
  if (!structurallyEqual(definition, canonicalRehearsalDefinition)) {
    fail("route_iq_controlled_rehearsal_definition_not_canonical");
  }
  const template = canonicalTemplate(definition);
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
    sourceReferences: [
      definition.rehearsalId,
      definition.productionMemoryAuthorization.authorizationId
    ],
    createdAt: identity.createdAt,
    createdByReference: identity.createdByReference,
    configurationIdentity:
      `${identity.configurationId}@${identity.configurationRevision}`
  };
  return validateRouteIqPaidCustomerOnboardingConfiguration(configuration);
}

function materializeCanonicalDraft() {
  const definition = validateControlledPaidCustomerRehearsalDefinition(
    canonicalRehearsalDefinition
  );
  return {
    schemaVersion: ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_VERSION,
    rehearsalId: definition.rehearsalId,
    classification: definition.classification,
    lifecycleState: "DRAFT",
    onboardingConfiguration: materializeOnboardingConfiguration(definition),
    locations: clone(definition.locations),
    principals: clone(definition.principals),
    billing: clone(definition.billing),
    productionExecution: clone(definition.productionExecution),
    productionMemoryAuthorization:
      clone(definition.productionMemoryAuthorization),
    expected: clone(definition.expected)
  };
}

export function createControlledPaidCustomerRehearsalDraft(
  sourceDefinition = canonicalRehearsalDefinition
) {
  const definition = validateControlledPaidCustomerRehearsalDefinition(
    sourceDefinition
  );
  if (!structurallyEqual(definition, canonicalRehearsalDefinition)) {
    fail("route_iq_controlled_rehearsal_definition_not_canonical");
  }
  return deepFreeze(materializeCanonicalDraft());
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
    "productionMemoryAuthorization",
    "rehearsalId",
    "schemaVersion"
  ], "route_iq_controlled_rehearsal_draft_invalid");
  if (value.schemaVersion !== ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_VERSION
    || value.classification
      !== ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_CLASSIFICATION
    || value.lifecycleState !== "DRAFT") {
    fail("route_iq_controlled_rehearsal_draft_invalid");
  }

  validateProductionMemoryAuthorization(value.productionMemoryAuthorization);
  validateProductionExecution(value.productionExecution);
  validateLocations(value.locations, canonicalRehearsalDefinition);
  validatePrincipals(
    value.principals,
    canonicalTemplate(canonicalRehearsalDefinition),
    canonicalRehearsalDefinition.roleBindings
  );
  validateBilling(value.billing);
  validateExpected(value.expected);
  const configuration = validateRouteIqPaidCustomerOnboardingConfiguration(
    value.onboardingConfiguration
  );
  const canonicalDraft = materializeCanonicalDraft();
  if (!structurallyEqual(configuration, canonicalDraft.onboardingConfiguration)
    || !structurallyEqual(value, canonicalDraft)) {
    fail("route_iq_controlled_rehearsal_draft_not_canonical");
  }
  return deepFreeze(clone(canonicalDraft));
}

export const controlledPaidCustomerRehearsalDefinition =
  validateControlledPaidCustomerRehearsalDefinition(
    canonicalRehearsalDefinition
  );
