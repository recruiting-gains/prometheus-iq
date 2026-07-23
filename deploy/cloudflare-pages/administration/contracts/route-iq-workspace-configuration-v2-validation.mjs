export const ROUTE_IQ_WORKSPACE_CONFIGURATION_SCHEMA_VERSION = "route-iq-workspace-configuration-v2";
export const ROUTE_IQ_WORKSPACE_CONFIGURATION_AUTHORITY = "prometheus_administration";
export const ROUTE_IQ_MAX_COMPANIES = 2;
export const ROUTE_IQ_MAX_NAMED_USERS = 40;
export const ROUTE_IQ_FITNESS_WORKSPACE_ID = "fitness_connection";
export const ROUTE_IQ_SYNTHETIC_OUTSIDE_SALES_WORKSPACE_ID = "northstar_outside_sales_synthetic";

const STRICT_ID = /^[a-z][a-z0-9_]{2,127}$/;
const PROFILE_VERSION = /^operating-profile-v[0-9]+$/;
const REGISTRY_VERSION = /^route-iq-cross-industry-workspaces-v2\.[0-9]+\.[0-9]+$/;
const CONFIGURATION_VERSION = /^v2\.[0-9]+\.[0-9]+$/;
const COLOR = /^#[A-Fa-f0-9]{6}$/;
const DATA_MANIFEST_PATH = /^data\/[A-Za-z0-9._/-]+\.json$/;
const FORBIDDEN_SOURCE_TERM = /(?:^|[._/-])(demo|fallback)(?:$|[._/-])/i;

const SUPPORTED_CARD_FIELDS = new Set([
  "business_name",
  "business_type",
  "operating_hours",
  "availability_status",
  "next_opening",
  "distance",
  "estimated_visit_duration",
  "visit_count",
  "last_outcome",
  "unit_potential",
  "decision_maker_role",
  "opportunity_stage"
]);
const SUPPORTED_CAPABILITIES = new Set([
  "view_route",
  "view_operating_hours",
  "open_directions",
  "record_visit",
  "correct_visit",
  "add_place",
  "save_place",
  "end_route",
  "end_day",
  "export_manual_report",
  "manage_workspace_configuration",
  "view_founder_read_only_intelligence"
]);
const WORKSPACE_LIFECYCLES = new Set([
  "founder_research",
  "synthetic_validation_only",
  "pending_customer_approval",
  "active_customer"
]);
const ADMISSION_STATES = new Set([
  "FOUNDER_RESEARCH_ONLY",
  "SYNTHETIC_VALIDATION_ONLY",
  "PENDING_CUSTOMER_APPROVAL",
  "CUSTOMER_APPROVED"
]);
const RELATIONSHIP_CLASSIFICATIONS = new Set([
  "FOUNDER_FIELD_RESEARCH",
  "SYNTHETIC_VALIDATION_FIXTURE",
  "PENDING_CUSTOMER",
  "CUSTOMER"
]);
const IDENTITY_CLASSES = new Set([
  "FOUNDER_ATTENDED",
  "CUSTOMER_NAMED_USER",
  "SYNTHETIC_NONCANONICAL"
]);
const PRINCIPAL_MAPPING_STATES = new Set([
  "ATTENDED_REQUIRED",
  "EXACT_PRINCIPAL_MAPPED",
  "UNMAPPED",
  "SYNTHETIC_ONLY"
]);
const OUTCOME_CLASSIFICATIONS = new Set([
  "OBSERVATION",
  "PROGRESS",
  "SUCCESS",
  "EXCLUSION",
  "FOLLOW_UP"
]);
const KPI_AGGREGATIONS = new Set(["COUNT", "RATE", "SUM"]);
const SOURCE_CLASSIFICATIONS = new Set([
  "FOUNDER_FIELD_RESEARCH",
  "SYNTHETIC_NONCANONICAL",
  "CUSTOMER_GOVERNED_DATA"
]);
const SOURCE_APPROVAL_STATES = new Set([
  "APPROVED",
  "PENDING_FOUNDER_APPROVAL",
  "APPROVED_SYNTHETIC_VALIDATION"
]);
const PROVENANCE_APPROVAL_STATES = new Set([
  "FOUNDER_RESEARCH_BOUNDARY_RECORDED",
  "SYNTHETIC_VALIDATION_ONLY",
  "PENDING_FOUNDER_AND_CUSTOMER_APPROVAL",
  "CUSTOMER_APPROVED"
]);

export class RouteIqWorkspaceConfigurationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "RouteIqWorkspaceConfigurationError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new RouteIqWorkspaceConfigurationError(code, message, details);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function assertObject(value, scope) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("route_iq_admin_configuration_structure_invalid", `${scope} must be an object.`);
  }
}

function assertExactKeys(value, keys, scope) {
  assertObject(value, scope);
  const expected = new Set(keys);
  const actual = Reflect.ownKeys(value);
  const unknown = actual.filter(key => typeof key !== "string" || !expected.has(key));
  const missing = keys.filter(key => !Object.hasOwn(value, key));
  if (unknown.length || missing.length) {
    fail("route_iq_admin_configuration_fields_invalid", `${scope} has invalid fields.`, {
      scope,
      unknownFieldCount: unknown.length,
      missingFieldCount: missing.length
    });
  }
}

function assertArray(value, scope, { min = 0, max = Number.POSITIVE_INFINITY } = {}) {
  if (!Array.isArray(value) || value.length < min || value.length > max) {
    fail("route_iq_admin_configuration_array_invalid", `${scope} has an invalid array size.`);
  }
}

function assertId(value, scope) {
  if (typeof value !== "string" || !STRICT_ID.test(value)) {
    fail("route_iq_admin_configuration_identifier_invalid", `${scope} must be a strict opaque identifier.`);
  }
}

function assertLabel(value, scope) {
  if (typeof value !== "string" || !value.trim() || value.length > 160) {
    fail("route_iq_admin_configuration_label_invalid", `${scope} has an invalid label.`);
  }
}

function assertBoolean(value, scope) {
  if (typeof value !== "boolean") {
    fail("route_iq_admin_configuration_boolean_invalid", `${scope} must be boolean.`);
  }
}

function assertUnique(values, scope) {
  if (new Set(values).size !== values.length) {
    fail("route_iq_admin_configuration_duplicate_identity", `${scope} contains duplicate identities.`);
  }
}

function assertTimezone(value, scope) {
  if (typeof value !== "string" || !value || value.length > 80) {
    fail("route_iq_admin_configuration_timezone_invalid", `${scope} has an invalid timezone.`);
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date(0));
  } catch {
    fail("route_iq_admin_configuration_timezone_invalid", `${scope} must be a valid IANA timezone.`);
  }
}

function validateProvenance(provenance, scope) {
  assertExactKeys(provenance, [
    "owner",
    "configurationVersion",
    "sourceRefs",
    "approvalState"
  ], scope);
  if (provenance.owner !== ROUTE_IQ_WORKSPACE_CONFIGURATION_AUTHORITY
    || !CONFIGURATION_VERSION.test(provenance.configurationVersion)
    || !PROVENANCE_APPROVAL_STATES.has(provenance.approvalState)) {
    fail("route_iq_admin_configuration_provenance_invalid", `${scope} is invalid.`);
  }
  assertArray(provenance.sourceRefs, `${scope}.sourceRefs`, { min: 1 });
  provenance.sourceRefs.forEach((sourceRef, index) => {
    if (typeof sourceRef !== "string" || !sourceRef.trim() || sourceRef.length > 320) {
      fail("route_iq_admin_configuration_provenance_invalid", `${scope}.sourceRefs[${index}] is invalid.`);
    }
  });
  assertUnique(provenance.sourceRefs, `${scope}.sourceRefs`);
}

function validateAdmission(workspace, scope) {
  const { admission, lifecycle } = workspace;
  assertExactKeys(admission, [
    "status",
    "productionAuthorized",
    "customerAuthorizationRef"
  ], `${scope}.admission`);
  if (!ADMISSION_STATES.has(admission.status)) {
    fail("route_iq_admin_configuration_admission_invalid", `${scope} has an invalid admission state.`);
  }
  assertBoolean(admission.productionAuthorized, `${scope}.admission.productionAuthorized`);
  if (admission.customerAuthorizationRef !== null
    && (typeof admission.customerAuthorizationRef !== "string"
      || !admission.customerAuthorizationRef.trim()
      || admission.customerAuthorizationRef.length > 240)) {
    fail("route_iq_admin_configuration_admission_invalid", `${scope} has an invalid customer authorization reference.`);
  }

  const expected = {
    founder_research: ["FOUNDER_RESEARCH_ONLY", false, null],
    synthetic_validation_only: ["SYNTHETIC_VALIDATION_ONLY", false, null],
    pending_customer_approval: ["PENDING_CUSTOMER_APPROVAL", false, null],
    active_customer: ["CUSTOMER_APPROVED", true, "required"]
  }[lifecycle];
  if (!expected
    || admission.status !== expected[0]
    || admission.productionAuthorized !== expected[1]
    || (expected[2] === null && admission.customerAuthorizationRef !== null)
    || (expected[2] === "required" && !admission.customerAuthorizationRef)) {
    fail("route_iq_admin_configuration_admission_mismatch", `${scope} lifecycle and admission do not match.`);
  }
}

function validateCompany(company, lifecycle, scope) {
  assertExactKeys(company, [
    "displayName",
    "businessType",
    "relationshipClassification",
    "publicRelationshipClaimsAllowed",
    "brand"
  ], scope);
  assertLabel(company.displayName, `${scope}.displayName`);
  assertId(company.businessType, `${scope}.businessType`);
  if (!RELATIONSHIP_CLASSIFICATIONS.has(company.relationshipClassification)) {
    fail("route_iq_admin_configuration_relationship_invalid", `${scope} has an invalid relationship classification.`);
  }
  assertBoolean(company.publicRelationshipClaimsAllowed, `${scope}.publicRelationshipClaimsAllowed`);
  assertExactKeys(company.brand, [
    "productLabel",
    "primaryColor",
    "accentColor"
  ], `${scope}.brand`);
  assertLabel(company.brand.productLabel, `${scope}.brand.productLabel`);
  if (!COLOR.test(company.brand.primaryColor) || !COLOR.test(company.brand.accentColor)) {
    fail("route_iq_admin_configuration_brand_invalid", `${scope} has invalid brand colors.`);
  }
  const expectedRelationship = {
    founder_research: "FOUNDER_FIELD_RESEARCH",
    synthetic_validation_only: "SYNTHETIC_VALIDATION_FIXTURE",
    pending_customer_approval: "PENDING_CUSTOMER",
    active_customer: "CUSTOMER"
  }[lifecycle];
  if (company.relationshipClassification !== expectedRelationship
    || (lifecycle !== "active_customer" && company.publicRelationshipClaimsAllowed !== false)) {
    fail("route_iq_admin_configuration_relationship_invalid", `${scope} conflicts with workspace lifecycle.`);
  }
}

function validateTerritoriesAndLocations(workspace, scope) {
  assertArray(workspace.territories, `${scope}.territories`, { min: 1 });
  const territoryIds = workspace.territories.map((territory, index) => {
    const territoryScope = `${scope}.territories[${index}]`;
    assertExactKeys(territory, ["territoryId", "displayName", "timezone", "active"], territoryScope);
    assertId(territory.territoryId, `${territoryScope}.territoryId`);
    assertLabel(territory.displayName, `${territoryScope}.displayName`);
    assertTimezone(territory.timezone, `${territoryScope}.timezone`);
    assertBoolean(territory.active, `${territoryScope}.active`);
    return territory.territoryId;
  });
  assertUnique(territoryIds, `${scope}.territories`);
  const territorySet = new Set(territoryIds);

  assertArray(workspace.locations, `${scope}.locations`, { min: 1 });
  const locationIds = workspace.locations.map((location, index) => {
    const locationScope = `${scope}.locations[${index}]`;
    assertExactKeys(location, ["locationId", "displayName", "territoryIds", "active"], locationScope);
    assertId(location.locationId, `${locationScope}.locationId`);
    assertLabel(location.displayName, `${locationScope}.displayName`);
    assertBoolean(location.active, `${locationScope}.active`);
    assertArray(location.territoryIds, `${locationScope}.territoryIds`, { min: 1 });
    assertUnique(location.territoryIds, `${locationScope}.territoryIds`);
    if (location.territoryIds.some(territoryId => !territorySet.has(territoryId))) {
      fail("route_iq_admin_configuration_territory_mismatch", `${locationScope} references another or unknown territory.`);
    }
    return location.locationId;
  });
  assertUnique(locationIds, `${scope}.locations`);
  return territorySet;
}

function validateRolesAndUsers(workspace, territorySet, globalContext, scope) {
  assertArray(workspace.roles, `${scope}.roles`, { min: 1 });
  const roles = new Map();
  const roleIds = [];
  for (const [index, role] of workspace.roles.entries()) {
    const roleScope = `${scope}.roles[${index}]`;
    assertExactKeys(role, ["roleId", "displayName", "capabilities"], roleScope);
    assertId(role.roleId, `${roleScope}.roleId`);
    assertLabel(role.displayName, `${roleScope}.displayName`);
    assertArray(role.capabilities, `${roleScope}.capabilities`);
    assertUnique(role.capabilities, `${roleScope}.capabilities`);
    for (const capability of role.capabilities) {
      assertId(capability, `${roleScope}.capabilities`);
      if (!SUPPORTED_CAPABILITIES.has(capability)) {
        fail("route_iq_admin_configuration_capability_unsupported", `${roleScope} uses an unsupported capability.`);
      }
    }
    roleIds.push(role.roleId);
    roles.set(role.roleId, role);
  }
  assertUnique(roleIds, `${scope}.roles`);

  assertArray(workspace.users, `${scope}.users`, { max: ROUTE_IQ_MAX_NAMED_USERS });
  for (const [index, user] of workspace.users.entries()) {
    const userScope = `${scope}.users[${index}]`;
    assertExactKeys(user, [
      "userId",
      "representativeId",
      "displayName",
      "identityClass",
      "principalMappingStatus",
      "roleId",
      "territoryIds",
      "active"
    ], userScope);
    assertId(user.userId, `${userScope}.userId`);
    assertId(user.representativeId, `${userScope}.representativeId`);
    assertLabel(user.displayName, `${userScope}.displayName`);
    assertId(user.roleId, `${userScope}.roleId`);
    assertBoolean(user.active, `${userScope}.active`);
    if (!IDENTITY_CLASSES.has(user.identityClass)
      || !PRINCIPAL_MAPPING_STATES.has(user.principalMappingStatus)) {
      fail("route_iq_admin_configuration_identity_invalid", `${userScope} has invalid identity metadata.`);
    }
    if (!roles.has(user.roleId)) {
      fail("route_iq_admin_configuration_cross_company_role", `${userScope} references a role outside its workspace.`);
    }
    assertArray(user.territoryIds, `${userScope}.territoryIds`, { min: 1 });
    assertUnique(user.territoryIds, `${userScope}.territoryIds`);
    if (user.territoryIds.some(territoryId => !territorySet.has(territoryId))) {
      fail("route_iq_admin_configuration_territory_mismatch", `${userScope} references another or unknown territory.`);
    }
    if (user.identityClass === "FOUNDER_ATTENDED"
      && (user.userId !== "user_cruz_founder" || user.principalMappingStatus !== "ATTENDED_REQUIRED")) {
      fail("route_iq_admin_configuration_founder_boundary_invalid", `${userScope} violates the attended Founder boundary.`);
    }
    if (user.identityClass === "SYNTHETIC_NONCANONICAL"
      && user.principalMappingStatus !== "SYNTHETIC_ONLY") {
      fail("route_iq_admin_configuration_synthetic_identity_invalid", `${userScope} cannot map a real principal.`);
    }
    if (workspace.lifecycle === "active_customer"
      && (user.identityClass !== "CUSTOMER_NAMED_USER"
        || user.principalMappingStatus !== "EXACT_PRINCIPAL_MAPPED"
        || user.active !== true)) {
      fail("route_iq_admin_configuration_customer_user_invalid", `${userScope} is not an admitted customer user.`);
    }
    globalContext.userIds.push(user.userId);
    globalContext.representativeIds.push(user.representativeId);
    globalContext.namedUserCount += 1;
  }
}

function validateDashboard(dashboard, roles, scope) {
  assertExactKeys(dashboard, [
    "terminology",
    "capabilities",
    "cardFields",
    "filters",
    "sorts",
    "actions",
    "outcomes",
    "kpis"
  ], scope);
  assertExactKeys(dashboard.terminology, [
    "opportunity",
    "visit",
    "outcome",
    "success",
    "followUp"
  ], `${scope}.terminology`);
  for (const [key, value] of Object.entries(dashboard.terminology)) {
    assertLabel(value, `${scope}.terminology.${key}`);
  }

  assertArray(dashboard.capabilities, `${scope}.capabilities`, { min: 1 });
  assertUnique(dashboard.capabilities, `${scope}.capabilities`);
  for (const capability of dashboard.capabilities) {
    if (!SUPPORTED_CAPABILITIES.has(capability)) {
      fail("route_iq_admin_configuration_capability_unsupported", `${scope} uses an unsupported capability.`);
    }
  }
  const dashboardCapabilitySet = new Set(dashboard.capabilities);
  for (const role of roles) {
    if (role.capabilities.some(capability => !dashboardCapabilitySet.has(capability))) {
      fail("route_iq_admin_configuration_capability_mismatch", `${scope} omits a role capability.`);
    }
  }

  assertArray(dashboard.cardFields, `${scope}.cardFields`, { min: 1 });
  const cardFieldIds = dashboard.cardFields.map((field, index) => {
    const fieldScope = `${scope}.cardFields[${index}]`;
    assertExactKeys(field, ["fieldId", "label", "required"], fieldScope);
    assertId(field.fieldId, `${fieldScope}.fieldId`);
    assertLabel(field.label, `${fieldScope}.label`);
    assertBoolean(field.required, `${fieldScope}.required`);
    if (!SUPPORTED_CARD_FIELDS.has(field.fieldId)) {
      fail("route_iq_admin_configuration_card_field_unsupported", `${fieldScope} is unsupported.`);
    }
    return field.fieldId;
  });
  assertUnique(cardFieldIds, `${scope}.cardFields`);
  const cardFieldSet = new Set(cardFieldIds);
  for (const requiredField of [
    "business_name",
    "operating_hours",
    "availability_status",
    "estimated_visit_duration"
  ]) {
    if (!cardFieldSet.has(requiredField)) {
      fail("route_iq_admin_configuration_card_field_missing", `${scope} is missing ${requiredField}.`);
    }
  }

  assertArray(dashboard.filters, `${scope}.filters`);
  const filterIds = dashboard.filters.map((filter, index) => {
    const filterScope = `${scope}.filters[${index}]`;
    assertExactKeys(filter, ["filterId", "label", "fieldId"], filterScope);
    assertId(filter.filterId, `${filterScope}.filterId`);
    assertLabel(filter.label, `${filterScope}.label`);
    if (!cardFieldSet.has(filter.fieldId)) {
      fail("route_iq_admin_configuration_filter_field_invalid", `${filterScope} references an unavailable field.`);
    }
    return filter.filterId;
  });
  assertUnique(filterIds, `${scope}.filters`);

  assertArray(dashboard.sorts, `${scope}.sorts`);
  const sortIds = dashboard.sorts.map((sort, index) => {
    const sortScope = `${scope}.sorts[${index}]`;
    assertExactKeys(sort, ["sortId", "label", "fieldId", "direction"], sortScope);
    assertId(sort.sortId, `${sortScope}.sortId`);
    assertLabel(sort.label, `${sortScope}.label`);
    if (!cardFieldSet.has(sort.fieldId) || !["asc", "desc"].includes(sort.direction)) {
      fail("route_iq_admin_configuration_sort_invalid", `${sortScope} is invalid.`);
    }
    return sort.sortId;
  });
  assertUnique(sortIds, `${scope}.sorts`);

  assertArray(dashboard.outcomes, `${scope}.outcomes`, { min: 1 });
  const outcomeIds = dashboard.outcomes.map((outcome, index) => {
    const outcomeScope = `${scope}.outcomes[${index}]`;
    assertExactKeys(outcome, ["outcomeId", "label", "classification"], outcomeScope);
    assertId(outcome.outcomeId, `${outcomeScope}.outcomeId`);
    assertLabel(outcome.label, `${outcomeScope}.label`);
    if (!OUTCOME_CLASSIFICATIONS.has(outcome.classification)) {
      fail("route_iq_admin_configuration_outcome_invalid", `${outcomeScope} is invalid.`);
    }
    return outcome.outcomeId;
  });
  assertUnique(outcomeIds, `${scope}.outcomes`);
  const outcomeSet = new Set(outcomeIds);

  assertArray(dashboard.actions, `${scope}.actions`, { min: 1 });
  const actionIds = dashboard.actions.map((action, index) => {
    const actionScope = `${scope}.actions[${index}]`;
    assertExactKeys(action, ["actionId", "label", "allowedOutcomeIds"], actionScope);
    assertId(action.actionId, `${actionScope}.actionId`);
    assertLabel(action.label, `${actionScope}.label`);
    assertArray(action.allowedOutcomeIds, `${actionScope}.allowedOutcomeIds`, { min: 1 });
    assertUnique(action.allowedOutcomeIds, `${actionScope}.allowedOutcomeIds`);
    if (action.allowedOutcomeIds.some(outcomeId => !outcomeSet.has(outcomeId))) {
      fail("route_iq_admin_configuration_action_outcome_invalid", `${actionScope} references an unknown outcome.`);
    }
    return action.actionId;
  });
  assertUnique(actionIds, `${scope}.actions`);

  assertArray(dashboard.kpis, `${scope}.kpis`, { min: 1 });
  const kpiIds = dashboard.kpis.map((kpi, index) => {
    const kpiScope = `${scope}.kpis[${index}]`;
    assertExactKeys(kpi, ["kpiId", "label", "aggregation", "sourceOutcomeIds"], kpiScope);
    assertId(kpi.kpiId, `${kpiScope}.kpiId`);
    assertLabel(kpi.label, `${kpiScope}.label`);
    if (!KPI_AGGREGATIONS.has(kpi.aggregation)) {
      fail("route_iq_admin_configuration_kpi_invalid", `${kpiScope} has an invalid aggregation.`);
    }
    assertArray(kpi.sourceOutcomeIds, `${kpiScope}.sourceOutcomeIds`);
    assertUnique(kpi.sourceOutcomeIds, `${kpiScope}.sourceOutcomeIds`);
    if (kpi.sourceOutcomeIds.some(outcomeId => !outcomeSet.has(outcomeId))) {
      fail("route_iq_admin_configuration_kpi_outcome_invalid", `${kpiScope} references an unknown outcome.`);
    }
    return kpi.kpiId;
  });
  assertUnique(kpiIds, `${scope}.kpis`);
}

function validateAvailabilityPolicy(policy, scope) {
  assertExactKeys(policy, [
    "timezoneSource",
    "freshnessCeilingHours",
    "immediateRecommendationRule",
    "verifiedClosedRule",
    "uncertainRule",
    "appointmentOnlyRule",
    "providerFailureRule",
    "refreshMode"
  ], scope);
  if (policy.timezoneSource !== "BUSINESS_LOCAL_IANA"
    || !Number.isInteger(policy.freshnessCeilingHours)
    || policy.freshnessCeilingHours < 1
    || policy.freshnessCeilingHours > 24
    || policy.immediateRecommendationRule !== "FRESH_VERIFIED_OPEN_OR_ACCESS_WINDOW_ONLY"
    || policy.verifiedClosedRule !== "INELIGIBLE_WITH_NEXT_OPENING"
    || policy.uncertainRule !== "NON_RECOMMENDED_VERIFICATION_REQUIRED"
    || policy.appointmentOnlyRule !== "VERIFIED_APPOINTMENT_OR_ACCESS_WINDOW_REQUIRED"
    || policy.providerFailureRule !== "PRESERVE_PRIOR_EVIDENCE_AND_EXPIRE_NORMALLY"
    || policy.refreshMode !== "GOVERNED_RUNTIME_ARTIFACT") {
    fail("route_iq_admin_configuration_availability_invalid", `${scope} is not fail closed.`);
  }
}

function validateOpportunitySources(workspace, scope) {
  assertArray(workspace.opportunitySources, `${scope}.opportunitySources`, { min: 1 });
  const sourceIds = workspace.opportunitySources.map((source, index) => {
    const sourceScope = `${scope}.opportunitySources[${index}]`;
    assertExactKeys(source, [
      "sourceId",
      "adapterId",
      "manifestRegistryPath",
      "manifestId",
      "artifactPath",
      "artifactSchemaVersion",
      "workspaceId",
      "profileId",
      "providerId",
      "classification",
      "manifestApprovalState",
      "productionUseAuthorized"
    ], sourceScope);
    for (const key of [
      "sourceId",
      "adapterId",
      "manifestId",
      "workspaceId",
      "profileId",
      "providerId"
    ]) {
      assertId(source[key], `${sourceScope}.${key}`);
    }
    if (source.workspaceId !== workspace.workspaceId) {
      fail("route_iq_admin_configuration_source_workspace_mismatch", `${sourceScope} crosses workspace boundaries.`);
    }
    if (source.profileId !== workspace.operatingProfile.profileId) {
      fail("route_iq_admin_configuration_profile_mismatch", `${sourceScope} crosses operating-profile boundaries.`);
    }
    if (typeof source.artifactPath !== "string"
      || !DATA_MANIFEST_PATH.test(source.artifactPath)
      || source.artifactPath.length > 320
      || typeof source.manifestRegistryPath !== "string"
      || !DATA_MANIFEST_PATH.test(source.manifestRegistryPath)
      || source.manifestRegistryPath.length > 320
      || FORBIDDEN_SOURCE_TERM.test(source.artifactPath)
      || FORBIDDEN_SOURCE_TERM.test(source.manifestRegistryPath)
      || FORBIDDEN_SOURCE_TERM.test(source.sourceId)
      || FORBIDDEN_SOURCE_TERM.test(source.adapterId)) {
      fail("route_iq_admin_configuration_demo_fallback_forbidden", `${sourceScope} references demo or fallback data.`);
    }
    if (typeof source.artifactSchemaVersion !== "string"
      || !source.artifactSchemaVersion.trim()
      || source.artifactSchemaVersion.length > 120
      || !SOURCE_CLASSIFICATIONS.has(source.classification)
      || !SOURCE_APPROVAL_STATES.has(source.manifestApprovalState)) {
      fail("route_iq_admin_configuration_source_invalid", `${sourceScope} is invalid.`);
    }
    assertBoolean(source.productionUseAuthorized, `${sourceScope}.productionUseAuthorized`);
    if (workspace.lifecycle !== "active_customer" && source.productionUseAuthorized !== false) {
      fail("route_iq_admin_configuration_source_activation_invalid", `${sourceScope} is not production authorized.`);
    }
    if (workspace.lifecycle === "synthetic_validation_only"
      && (source.classification !== "SYNTHETIC_NONCANONICAL"
        || source.manifestApprovalState !== "APPROVED_SYNTHETIC_VALIDATION")) {
      fail("route_iq_admin_configuration_synthetic_source_invalid", `${sourceScope} is not safely synthetic.`);
    }
    if (workspace.lifecycle === "founder_research"
      && (source.classification !== "FOUNDER_FIELD_RESEARCH"
        || !["APPROVED", "PENDING_FOUNDER_APPROVAL"].includes(source.manifestApprovalState))) {
      fail("route_iq_admin_configuration_founder_source_invalid", `${sourceScope} is not governed Founder research.`);
    }
    return source.sourceId;
  });
  assertUnique(sourceIds, `${scope}.opportunitySources`);
}

function validateFallbackAndRetention(workspace, scope) {
  assertExactKeys(workspace.fallbackPolicy, [
    "mode",
    "demoCatalogAllowed",
    "embeddedBusinessCatalogAllowed",
    "crossWorkspaceFallbackAllowed",
    "missingSourceState"
  ], `${scope}.fallbackPolicy`);
  if (workspace.fallbackPolicy.mode !== "FAIL_CLOSED"
    || workspace.fallbackPolicy.demoCatalogAllowed !== false
    || workspace.fallbackPolicy.embeddedBusinessCatalogAllowed !== false
    || workspace.fallbackPolicy.crossWorkspaceFallbackAllowed !== false
    || workspace.fallbackPolicy.missingSourceState !== "CONFIGURATION_REQUIRED_EMPTY") {
    fail("route_iq_admin_configuration_fallback_invalid", `${scope} permits an unsafe fallback.`);
  }

  assertExactKeys(workspace.retention, [
    "maximumCalendarMonths",
    "customerMayShorten",
    "customerMayExpand",
    "legalHoldSupported",
    "dispositionMode"
  ], `${scope}.retention`);
  if (!Number.isInteger(workspace.retention.maximumCalendarMonths)
    || workspace.retention.maximumCalendarMonths < 1
    || workspace.retention.maximumCalendarMonths > 18
    || workspace.retention.customerMayShorten !== true
    || workspace.retention.customerMayExpand !== false
    || workspace.retention.legalHoldSupported !== true
    || workspace.retention.dispositionMode !== "APPEND_ONLY_AUDITABLE_DATA_OWNED") {
    fail("route_iq_admin_configuration_retention_invalid", `${scope} exceeds the retention boundary.`);
  }
}

function validateWorkspace(workspace, globalContext, index) {
  const scope = `workspaces[${index}]`;
  assertExactKeys(workspace, [
    "workspaceId",
    "companyId",
    "lifecycle",
    "admission",
    "company",
    "operatingProfile",
    "locations",
    "territories",
    "roles",
    "users",
    "dashboard",
    "availabilityPolicy",
    "opportunitySources",
    "fallbackPolicy",
    "retention",
    "provenance"
  ], scope);
  assertId(workspace.workspaceId, `${scope}.workspaceId`);
  assertId(workspace.companyId, `${scope}.companyId`);
  if (!WORKSPACE_LIFECYCLES.has(workspace.lifecycle)) {
    fail("route_iq_admin_configuration_lifecycle_invalid", `${scope} has an invalid lifecycle.`);
  }
  validateAdmission(workspace, scope);
  validateCompany(workspace.company, workspace.lifecycle, `${scope}.company`);
  assertExactKeys(workspace.operatingProfile, [
    "profileId",
    "profileVersion",
    "industryId"
  ], `${scope}.operatingProfile`);
  assertId(workspace.operatingProfile.profileId, `${scope}.operatingProfile.profileId`);
  assertId(workspace.operatingProfile.industryId, `${scope}.operatingProfile.industryId`);
  if (!PROFILE_VERSION.test(workspace.operatingProfile.profileVersion)) {
    fail("route_iq_admin_configuration_profile_version_invalid", `${scope} has an invalid profile version.`);
  }

  const territorySet = validateTerritoriesAndLocations(workspace, scope);
  validateRolesAndUsers(workspace, territorySet, globalContext, scope);
  validateDashboard(workspace.dashboard, workspace.roles, `${scope}.dashboard`);
  validateAvailabilityPolicy(workspace.availabilityPolicy, `${scope}.availabilityPolicy`);
  validateOpportunitySources(workspace, scope);
  validateFallbackAndRetention(workspace, scope);
  validateProvenance(workspace.provenance, `${scope}.provenance`);

  globalContext.workspaceIds.push(workspace.workspaceId);
  globalContext.companyIds.push(workspace.companyId);
}

export function validateRouteIqWorkspaceConfigurationRegistry(registry) {
  assertExactKeys(registry, [
    "schemaVersion",
    "registryVersion",
    "product",
    "authority",
    "limits",
    "founderBoundary",
    "safety",
    "workspaces",
    "provenance"
  ], "registry");
  if (registry.schemaVersion !== ROUTE_IQ_WORKSPACE_CONFIGURATION_SCHEMA_VERSION
    || !REGISTRY_VERSION.test(registry.registryVersion)
    || registry.product !== "route_iq"
    || registry.authority !== ROUTE_IQ_WORKSPACE_CONFIGURATION_AUTHORITY) {
    fail("route_iq_admin_configuration_header_invalid", "Registry header is invalid.");
  }
  assertExactKeys(registry.limits, ["maxCompanies", "maxNamedUsers"], "registry.limits");
  if (registry.limits.maxCompanies !== ROUTE_IQ_MAX_COMPANIES
    || registry.limits.maxNamedUsers !== ROUTE_IQ_MAX_NAMED_USERS) {
    fail("route_iq_admin_configuration_limits_invalid", "Registry limits exceed the Founder boundary.");
  }
  assertExactKeys(registry.founderBoundary, [
    "attendanceMode",
    "founderUserId",
    "anthonyMappingStatus",
    "externalTesterAccessAuthorized"
  ], "registry.founderBoundary");
  if (registry.founderBoundary.attendanceMode !== "CRUZ_ONLY_ATTENDED"
    || registry.founderBoundary.founderUserId !== "user_cruz_founder"
    || registry.founderBoundary.anthonyMappingStatus !== "UNMAPPED"
    || registry.founderBoundary.externalTesterAccessAuthorized !== false) {
    fail("route_iq_admin_configuration_founder_boundary_invalid", "Founder attendance boundary is invalid.");
  }
  assertExactKeys(registry.safety, [
    "collection",
    "activeCohorts",
    "recommendationInfluence"
  ], "registry.safety");
  if (registry.safety.collection !== "OFF"
    || registry.safety.activeCohorts !== 0
    || registry.safety.recommendationInfluence !== "OFF") {
    fail("route_iq_admin_configuration_safety_invalid", "Route IQ safety switches are not dark.");
  }
  assertArray(registry.workspaces, "registry.workspaces", {
    min: 2,
    max: ROUTE_IQ_MAX_COMPANIES
  });
  validateProvenance(registry.provenance, "registry.provenance");

  const globalContext = {
    workspaceIds: [],
    companyIds: [],
    userIds: [],
    representativeIds: [],
    namedUserCount: 0
  };
  registry.workspaces.forEach((workspace, index) => validateWorkspace(workspace, globalContext, index));
  assertUnique(globalContext.workspaceIds, "registry.workspaces.workspaceId");
  assertUnique(globalContext.companyIds, "registry.workspaces.companyId");
  assertUnique(globalContext.userIds, "registry.workspaces.users.userId");
  assertUnique(globalContext.representativeIds, "registry.workspaces.users.representativeId");
  if (globalContext.namedUserCount > ROUTE_IQ_MAX_NAMED_USERS) {
    fail("route_iq_admin_configuration_user_limit_exceeded", "Named-user limit exceeded.");
  }

  const founderResearch = registry.workspaces.find(workspace => workspace.lifecycle === "founder_research");
  const syntheticGeneral = registry.workspaces.find(workspace =>
    workspace.lifecycle === "synthetic_validation_only"
      && workspace.operatingProfile.profileId === "general_outside_sales"
  );
  const founderUsers = registry.workspaces
    .flatMap(workspace => workspace.users)
    .filter(user => user.identityClass === "FOUNDER_ATTENDED");
  if (!founderResearch
    || founderResearch.workspaceId !== ROUTE_IQ_FITNESS_WORKSPACE_ID
    || founderResearch.operatingProfile.profileId !== "fitness"
    || founderResearch.company.relationshipClassification !== "FOUNDER_FIELD_RESEARCH"
    || founderResearch.company.publicRelationshipClaimsAllowed !== false
    || founderUsers.length !== 1
    || founderUsers[0].userId !== "user_cruz_founder") {
    fail("route_iq_admin_configuration_founder_research_invalid", "Fitness Founder research boundary is missing.");
  }
  if (!syntheticGeneral
    || syntheticGeneral.workspaceId !== ROUTE_IQ_SYNTHETIC_OUTSIDE_SALES_WORKSPACE_ID
    || syntheticGeneral.company.relationshipClassification !== "SYNTHETIC_VALIDATION_FIXTURE"
    || syntheticGeneral.admission.productionAuthorized !== false) {
    fail("route_iq_admin_configuration_cross_industry_proof_missing", "Synthetic general outside-sales proof is missing.");
  }
  return deepFreeze(clone(registry));
}

export function resolveAdmittedWorkspaceConfigurationFromRegistry(
  workspaceId,
  registry,
  options = {}
) {
  assertId(workspaceId, "workspaceId");
  const workspace = registry.workspaces.find(candidate => candidate.workspaceId === workspaceId);
  if (!workspace) {
    fail("route_iq_admin_configuration_workspace_unknown", "Workspace configuration is not registered.");
  }
  if (workspace.lifecycle === "synthetic_validation_only" && options.allowSynthetic !== true) {
    fail("route_iq_admin_configuration_workspace_synthetic", "Synthetic configuration is not available in production.");
  }
  if (workspace.admission.productionAuthorized !== true && options.allowFounderResearch !== true) {
    fail("route_iq_admin_configuration_workspace_not_production_admitted", "Workspace is not admitted for production.");
  }
  return deepFreeze(clone(workspace));
}

export function authorizeConfiguredUserFromRegistry(input, registry) {
  assertExactKeys(input, [
    "workspaceId",
    "operatingProfileId",
    "userId",
    "roleId",
    "territoryId"
  ], "authorizationInput");
  const workspace = registry.workspaces.find(candidate => candidate.workspaceId === input.workspaceId);
  if (!workspace) {
    fail("route_iq_admin_configuration_workspace_unknown", "Workspace configuration is not registered.");
  }
  if (workspace.operatingProfile.profileId !== input.operatingProfileId) {
    fail("route_iq_admin_configuration_profile_mismatch", "Operating profile does not match the workspace.");
  }
  const user = workspace.users.find(candidate => candidate.userId === input.userId);
  if (!user || !user.active) {
    fail("route_iq_admin_configuration_user_unauthorized", "User is not active in this workspace.");
  }
  if (user.roleId !== input.roleId) {
    fail("route_iq_admin_configuration_cross_company_role", "Role does not match the admitted user.");
  }
  if (!user.territoryIds.includes(input.territoryId)) {
    fail("route_iq_admin_configuration_territory_mismatch", "Territory does not match the admitted user.");
  }
  return deepFreeze({
    authorized: true,
    workspaceId: workspace.workspaceId,
    companyId: workspace.companyId,
    operatingProfileId: workspace.operatingProfile.profileId,
    userId: user.userId,
    representativeId: user.representativeId,
    roleId: user.roleId,
    territoryId: input.territoryId,
    recommendationInfluence: "OFF"
  });
}
