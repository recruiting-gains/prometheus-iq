export const ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_SCHEMA_VERSION =
  "route-iq-paid-customer-onboarding-v1";
export const ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_CONTRACT_VERSION = "1.0.0";
export const ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_AUTHORITY = "prometheus_administration";

export const ROUTE_IQ_PAID_CUSTOMER_LIFECYCLE_STATES = Object.freeze([
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

const LIFECYCLE_TRANSITIONS = Object.freeze({
  DRAFT: new Set(["VALIDATION_FAILED", "VALIDATED"]),
  VALIDATION_FAILED: new Set(["DRAFT"]),
  VALIDATED: new Set(["PREVIEW_READY", "DRAFT"]),
  PREVIEW_READY: new Set(["AWAITING_APPROVAL", "DRAFT"]),
  AWAITING_APPROVAL: new Set(["PROVISIONING", "DRAFT"]),
  PROVISIONING: new Set(["PROVISIONING_FAILED", "READY_FOR_ACTIVATION"]),
  PROVISIONING_FAILED: new Set(["PROVISIONING"]),
  READY_FOR_ACTIVATION: new Set(["ACTIVE", "SUSPENDED"]),
  ACTIVE: new Set(["SUSPENDED", "OFFBOARDED"]),
  SUSPENDED: new Set(["ACTIVE", "OFFBOARDED"]),
  OFFBOARDED: new Set()
});

// Activation decisions must be issued by a separately configured server authority.
// This contract intentionally exposes no issuer while that authority is unavailable.
const TRUSTED_ACTIVATION_DECISIONS = new WeakSet();
const CONSUMED_ACTIVATION_DECISIONS = new WeakSet();

const STRICT_ID = /^[a-z][a-z0-9_]{2,127}$/u;
const SEMVER = /^[1-9][0-9]*\.[0-9]+\.[0-9]+$/u;
const US_ZIP = /^[0-9]{5}$/u;
const STATE_CODE = /^[A-Z]{2}$/u;
const TIME = /^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/u;
const ISO_INSTANT =
  /^[0-9]{4}-[0-9]{2}-[0-9]{2}T(?:[01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](?:\.[0-9]{3})?Z$/u;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/u;
const UNSAFE_LABEL = /[<>{}`\\]|(?:\$\{)|(?:\{\{)|(?:javascript\s*:)|(?:data\s*:\s*text\/html)|(?:\b(?:select|insert|update|delete|drop|union)\b.{0,80}\b(?:from|into|table|values)\b)/iu;

const REQUIRED_TERM_IDS = Object.freeze([
  "business",
  "manager",
  "representative",
  "visit",
  "outcome",
  "follow_up"
]);

const TOP_LEVEL_KEYS = Object.freeze([
  "schemaVersion",
  "contractVersion",
  "configurationId",
  "configurationRevision",
  "company",
  "operatingProfile",
  "targeting",
  "territory",
  "access",
  "sales",
  "terminology",
  "verification",
  "dashboard",
  "crm",
  "supportContacts",
  "governance",
  "safety",
  "lifecycle",
  "provenance"
]);

export class RouteIqPaidCustomerOnboardingError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "RouteIqPaidCustomerOnboardingError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new RouteIqPaidCustomerOnboardingError(code, message, details);
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

function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map(key => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function deterministicFingerprint(value) {
  const input = canonicalize(value);
  let high = 0x811c9dc5;
  let low = 0x9e3779b9;
  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index);
    high = Math.imul(high ^ code, 0x01000193) >>> 0;
    low = Math.imul(low ^ (code + index), 0x85ebca6b) >>> 0;
  }
  return `${high.toString(16).padStart(8, "0")}${low.toString(16).padStart(8, "0")}`;
}

function assertObject(value, scope) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("route_iq_paid_customer_structure_invalid", `${scope} must be an object.`);
  }
}

function assertExactKeys(value, keys, scope) {
  assertObject(value, scope);
  const expected = new Set(keys);
  const actual = Reflect.ownKeys(value);
  const unknown = actual.filter(key => typeof key !== "string" || !expected.has(key));
  const missing = keys.filter(key => !Object.hasOwn(value, key));
  if (unknown.length || missing.length) {
    fail("route_iq_paid_customer_fields_invalid", `${scope} has invalid fields.`, {
      scope,
      unknownFieldCount: unknown.length,
      missingFieldCount: missing.length
    });
  }
}

function assertArray(value, scope, { min = 0, max = Number.POSITIVE_INFINITY } = {}) {
  if (!Array.isArray(value) || value.length < min || value.length > max) {
    fail("route_iq_paid_customer_array_invalid", `${scope} has an invalid array size.`);
  }
}

function assertBoolean(value, scope) {
  if (typeof value !== "boolean") {
    fail("route_iq_paid_customer_boolean_invalid", `${scope} must be boolean.`);
  }
}

function assertInteger(value, scope, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (!Number.isInteger(value) || value < min || value > max) {
    fail("route_iq_paid_customer_integer_invalid", `${scope} must be an integer in range.`);
  }
}

function assertFiniteNumber(value, scope, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (!Number.isFinite(value) || value < min || value > max) {
    fail("route_iq_paid_customer_number_invalid", `${scope} must be a finite number in range.`);
  }
}

function assertId(value, scope) {
  if (typeof value !== "string" || !STRICT_ID.test(value)) {
    fail("route_iq_paid_customer_identifier_invalid", `${scope} must be a strict opaque identifier.`);
  }
}

function assertVersion(value, scope) {
  if (typeof value !== "string" || !SEMVER.test(value)) {
    fail("route_iq_paid_customer_version_invalid", `${scope} must be a semantic version.`);
  }
}

function assertSafeLabel(value, scope, maxLength = 160) {
  if (
    typeof value !== "string"
    || value !== value.trim()
    || !value
    || value.length > maxLength
    || CONTROL_CHARACTERS.test(value)
    || UNSAFE_LABEL.test(value)
  ) {
    fail("route_iq_paid_customer_label_unsafe", `${scope} has an invalid or unsafe label.`);
  }
}

function assertOptionalSafeLabel(value, scope, maxLength = 320) {
  if (value !== null) assertSafeLabel(value, scope, maxLength);
}

function assertInstant(value, scope) {
  if (typeof value !== "string" || !ISO_INSTANT.test(value) || Number.isNaN(Date.parse(value))) {
    fail("route_iq_paid_customer_timestamp_invalid", `${scope} must be a canonical UTC timestamp.`);
  }
}

function assertTimezone(value, scope) {
  if (typeof value !== "string" || !value || value.length > 80) {
    fail("route_iq_paid_customer_timezone_invalid", `${scope} must be an IANA timezone.`);
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date(0));
  } catch {
    fail("route_iq_paid_customer_timezone_invalid", `${scope} must be an IANA timezone.`);
  }
}

function assertUnique(values, scope) {
  if (new Set(values).size !== values.length) {
    fail("route_iq_paid_customer_duplicate_identity", `${scope} contains duplicate values.`);
  }
}

function assertIdArray(values, scope, { min = 0 } = {}) {
  assertArray(values, scope, { min });
  values.forEach((value, index) => assertId(value, `${scope}[${index}]`));
  assertUnique(values, scope);
}

function assertEnum(value, allowed, scope, code = "route_iq_paid_customer_value_invalid") {
  if (!allowed.includes(value)) fail(code, `${scope} is not supported.`);
}

function validateCompany(company) {
  assertExactKeys(company, [
    "companyId",
    "workspaceId",
    "identityImmutable",
    "legalName",
    "displayName"
  ], "configuration.company");
  assertId(company.companyId, "configuration.company.companyId");
  assertId(company.workspaceId, "configuration.company.workspaceId");
  if (company.companyId === company.workspaceId) {
    fail(
      "route_iq_paid_customer_identity_collision",
      "Company and workspace identities must be independently immutable."
    );
  }
  if (company.identityImmutable !== true) {
    fail(
      "route_iq_paid_customer_identity_mutable",
      "Company and workspace identities must be immutable."
    );
  }
  assertSafeLabel(company.legalName, "configuration.company.legalName", 200);
  assertSafeLabel(company.displayName, "configuration.company.displayName", 120);
}

function validateOperatingProfile(profile) {
  assertExactKeys(profile, [
    "industryTemplateId",
    "industryTemplateVersion",
    "operatingModelId",
    "productsAndServices",
    "targetCustomerProfile"
  ], "configuration.operatingProfile");
  assertId(profile.industryTemplateId, "configuration.operatingProfile.industryTemplateId");
  assertVersion(
    profile.industryTemplateVersion,
    "configuration.operatingProfile.industryTemplateVersion"
  );
  assertId(profile.operatingModelId, "configuration.operatingProfile.operatingModelId");
  assertArray(profile.productsAndServices, "configuration.operatingProfile.productsAndServices", {
    min: 1,
    max: 100
  });
  const offeringIds = profile.productsAndServices.map((offering, index) => {
    const scope = `configuration.operatingProfile.productsAndServices[${index}]`;
    assertExactKeys(offering, ["offeringId", "displayLabel", "kind"], scope);
    assertId(offering.offeringId, `${scope}.offeringId`);
    assertSafeLabel(offering.displayLabel, `${scope}.displayLabel`);
    assertEnum(offering.kind, ["PRODUCT", "SERVICE", "SUBSCRIPTION", "PROGRAM"], `${scope}.kind`);
    return offering.offeringId;
  });
  assertUnique(offeringIds, "configuration.operatingProfile.productsAndServices.offeringId");
  assertExactKeys(
    profile.targetCustomerProfile,
    ["profileId", "displayLabel", "description"],
    "configuration.operatingProfile.targetCustomerProfile"
  );
  assertId(
    profile.targetCustomerProfile.profileId,
    "configuration.operatingProfile.targetCustomerProfile.profileId"
  );
  assertSafeLabel(
    profile.targetCustomerProfile.displayLabel,
    "configuration.operatingProfile.targetCustomerProfile.displayLabel"
  );
  assertSafeLabel(
    profile.targetCustomerProfile.description,
    "configuration.operatingProfile.targetCustomerProfile.description",
    500
  );
}

function validateTargeting(targeting) {
  assertExactKeys(targeting, [
    "includedCategoryIds",
    "excludedCategoryIds",
    "excludedBusinessIds",
    "targetingDefaultsAllowed",
    "missingRulesBehavior",
    "conflictBehavior"
  ], "configuration.targeting");
  assertIdArray(targeting.includedCategoryIds, "configuration.targeting.includedCategoryIds", {
    min: 1
  });
  assertIdArray(targeting.excludedCategoryIds, "configuration.targeting.excludedCategoryIds");
  assertIdArray(targeting.excludedBusinessIds, "configuration.targeting.excludedBusinessIds");
  if (targeting.targetingDefaultsAllowed !== false) {
    fail(
      "route_iq_paid_customer_targeting_default_forbidden",
      "Targeting rules must never be silently defaulted."
    );
  }
  if (targeting.missingRulesBehavior !== "FAIL_CLOSED_CONFIGURATION_REQUIRED"
    || targeting.conflictBehavior !== "FAIL_CLOSED_CONFLICT_REQUIRES_RESOLUTION") {
    fail(
      "route_iq_paid_customer_targeting_fail_closed_required",
      "Targeting must fail closed when rules are missing or conflicting."
    );
  }
  const excluded = new Set(targeting.excludedCategoryIds);
  const overlap = targeting.includedCategoryIds.filter(categoryId => excluded.has(categoryId));
  if (overlap.length) {
    fail(
      "route_iq_paid_customer_targeting_contradictory",
      "A business category cannot be both included and excluded.",
      { conflictCount: overlap.length }
    );
  }
}

function validateTerritory(territory) {
  assertExactKeys(territory, [
    "territoryId",
    "displayLabel",
    "timeZone",
    "authorizedCities",
    "authorizedZipCodes",
    "travelLimit"
  ], "configuration.territory");
  assertId(territory.territoryId, "configuration.territory.territoryId");
  assertSafeLabel(territory.displayLabel, "configuration.territory.displayLabel");
  assertTimezone(territory.timeZone, "configuration.territory.timeZone");
  assertArray(territory.authorizedCities, "configuration.territory.authorizedCities", {
    min: 1,
    max: 500
  });
  const cityIds = territory.authorizedCities.map((city, index) => {
    const scope = `configuration.territory.authorizedCities[${index}]`;
    assertExactKeys(city, ["cityId", "name", "stateCode"], scope);
    assertId(city.cityId, `${scope}.cityId`);
    assertSafeLabel(city.name, `${scope}.name`, 120);
    if (typeof city.stateCode !== "string" || !STATE_CODE.test(city.stateCode)) {
      fail("route_iq_paid_customer_state_invalid", `${scope}.stateCode is invalid.`);
    }
    return city.cityId;
  });
  assertUnique(cityIds, "configuration.territory.authorizedCities.cityId");
  assertArray(territory.authorizedZipCodes, "configuration.territory.authorizedZipCodes", {
    min: 1,
    max: 2000
  });
  territory.authorizedZipCodes.forEach((postalCode, index) => {
    if (typeof postalCode !== "string" || !US_ZIP.test(postalCode)) {
      fail(
        "route_iq_paid_customer_zip_invalid",
        `configuration.territory.authorizedZipCodes[${index}] is invalid.`
      );
    }
  });
  assertUnique(territory.authorizedZipCodes, "configuration.territory.authorizedZipCodes");
  assertExactKeys(territory.travelLimit, ["mode", "value", "unit"], "configuration.territory.travelLimit");
  assertEnum(
    territory.travelLimit.mode,
    ["DISTANCE", "TRAVEL_TIME"],
    "configuration.territory.travelLimit.mode"
  );
  assertFiniteNumber(territory.travelLimit.value, "configuration.territory.travelLimit.value", {
    min: 1,
    max: territory.travelLimit.mode === "DISTANCE" ? 500 : 720
  });
  const expectedUnit = territory.travelLimit.mode === "DISTANCE" ? "MILES" : "MINUTES";
  if (territory.travelLimit.unit !== expectedUnit) {
    fail(
      "route_iq_paid_customer_travel_limit_contradictory",
      "Travel-limit mode and unit do not agree."
    );
  }
}

function validateWeeklySchedule(weeklySchedule, scope) {
  assertArray(weeklySchedule, scope, { min: 1, max: 7 });
  const days = weeklySchedule.map((day, dayIndex) => {
    const dayScope = `${scope}[${dayIndex}]`;
    assertExactKeys(day, ["day", "windows"], dayScope);
    assertEnum(
      day.day,
      ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"],
      `${dayScope}.day`
    );
    assertArray(day.windows, `${dayScope}.windows`, { min: 1, max: 8 });
    let previousEnd = null;
    day.windows.forEach((window, windowIndex) => {
      const windowScope = `${dayScope}.windows[${windowIndex}]`;
      assertExactKeys(window, ["start", "end"], windowScope);
      if (!TIME.test(window.start) || !TIME.test(window.end) || window.start >= window.end) {
        fail("route_iq_paid_customer_schedule_invalid", `${windowScope} is invalid.`);
      }
      if (previousEnd !== null && window.start < previousEnd) {
        fail("route_iq_paid_customer_schedule_overlap", `${dayScope} contains overlapping windows.`);
      }
      previousEnd = window.end;
    });
    return day.day;
  });
  assertUnique(days, `${scope}.day`);
}

function validateAccess(access) {
  assertExactKeys(access, [
    "roles",
    "representativeSchedules",
    "unknownRoleBehavior",
    "crossWorkspaceAccessAllowed"
  ], "configuration.access");
  assertArray(access.roles, "configuration.access.roles", { min: 1, max: 50 });
  const roleIds = access.roles.map((role, index) => {
    const scope = `configuration.access.roles[${index}]`;
    assertExactKeys(role, ["roleId", "displayLabel", "permissions"], scope);
    assertId(role.roleId, `${scope}.roleId`);
    assertSafeLabel(role.displayLabel, `${scope}.displayLabel`);
    assertIdArray(role.permissions, `${scope}.permissions`, { min: 1 });
    return role.roleId;
  });
  assertUnique(roleIds, "configuration.access.roles.roleId");
  if (access.unknownRoleBehavior !== "DENY" || access.crossWorkspaceAccessAllowed !== false) {
    fail(
      "route_iq_paid_customer_access_fail_closed_required",
      "Unknown roles and cross-workspace access must be denied."
    );
  }
  assertArray(access.representativeSchedules, "configuration.access.representativeSchedules", {
    min: 1,
    max: 50
  });
  const scheduleIds = access.representativeSchedules.map((schedule, index) => {
    const scope = `configuration.access.representativeSchedules[${index}]`;
    assertExactKeys(
      schedule,
      ["scheduleId", "roleIds", "timeZone", "weeklySchedule", "operatingConstraints"],
      scope
    );
    assertId(schedule.scheduleId, `${scope}.scheduleId`);
    assertIdArray(schedule.roleIds, `${scope}.roleIds`, { min: 1 });
    for (const roleId of schedule.roleIds) {
      if (!roleIds.includes(roleId)) {
        fail("route_iq_paid_customer_role_reference_invalid", `${scope} references an unknown role.`);
      }
    }
    assertTimezone(schedule.timeZone, `${scope}.timeZone`);
    validateWeeklySchedule(schedule.weeklySchedule, `${scope}.weeklySchedule`);
    assertArray(schedule.operatingConstraints, `${scope}.operatingConstraints`, { max: 30 });
    schedule.operatingConstraints.forEach((constraint, constraintIndex) => {
      assertSafeLabel(constraint, `${scope}.operatingConstraints[${constraintIndex}]`, 240);
    });
    return schedule.scheduleId;
  });
  assertUnique(scheduleIds, "configuration.access.representativeSchedules.scheduleId");
}

function validateTerminology(terminology) {
  assertExactKeys(terminology, [
    "templateId",
    "templateVersion",
    "terms",
    "metrics",
    "fallbackPolicy",
    "historyPolicy"
  ], "configuration.terminology");
  assertId(terminology.templateId, "configuration.terminology.templateId");
  assertVersion(terminology.templateVersion, "configuration.terminology.templateVersion");
  if (
    terminology.fallbackPolicy !== "CONTROLLED_INTERNAL_FALLBACKS_ONLY"
    || terminology.historyPolicy !== "IMMUTABLE_METRIC_ID_AND_SEMANTIC_VERSION"
  ) {
    fail(
      "route_iq_paid_customer_terminology_governance_invalid",
      "Terminology fallback and metric history policies are not governed."
    );
  }
  assertArray(terminology.terms, "configuration.terminology.terms", { min: 6, max: 100 });
  const termIds = terminology.terms.map((term, index) => {
    const scope = `configuration.terminology.terms[${index}]`;
    assertExactKeys(
      term,
      ["termId", "singular", "plural", "fallbackSingular", "fallbackPlural"],
      scope
    );
    assertId(term.termId, `${scope}.termId`);
    assertSafeLabel(term.singular, `${scope}.singular`, 80);
    assertSafeLabel(term.plural, `${scope}.plural`, 80);
    assertSafeLabel(term.fallbackSingular, `${scope}.fallbackSingular`, 80);
    assertSafeLabel(term.fallbackPlural, `${scope}.fallbackPlural`, 80);
    if (term.singular === term.plural) {
      fail(
        "route_iq_paid_customer_terminology_number_invalid",
        `${scope} must define distinct singular and plural labels.`
      );
    }
    return term.termId;
  });
  assertUnique(termIds, "configuration.terminology.terms.termId");
  for (const requiredTermId of REQUIRED_TERM_IDS) {
    if (!termIds.includes(requiredTermId)) {
      fail(
        "route_iq_paid_customer_terminology_required_missing",
        `Required term ${requiredTermId} is missing.`
      );
    }
  }

  assertArray(terminology.metrics, "configuration.terminology.metrics", { min: 1, max: 100 });
  const metricIds = terminology.metrics.map((metric, index) => {
    const scope = `configuration.terminology.metrics[${index}]`;
    assertExactKeys(
      metric,
      [
        "metricId",
        "semanticVersion",
        "displayTermId",
        "aggregation",
        "description",
        "historyIdentity"
      ],
      scope
    );
    assertId(metric.metricId, `${scope}.metricId`);
    assertVersion(metric.semanticVersion, `${scope}.semanticVersion`);
    assertId(metric.displayTermId, `${scope}.displayTermId`);
    if (!termIds.includes(metric.displayTermId)) {
      fail(
        "route_iq_paid_customer_metric_term_unknown",
        `${scope} references an unknown display term.`
      );
    }
    assertEnum(
      metric.aggregation,
      ["COUNT", "RATE", "SUM", "AVERAGE", "DURATION"],
      `${scope}.aggregation`
    );
    assertSafeLabel(metric.description, `${scope}.description`, 320);
    if (metric.historyIdentity !== `${metric.metricId}@${metric.semanticVersion}`) {
      fail(
        "route_iq_paid_customer_metric_history_identity_invalid",
        `${scope} does not preserve immutable reporting semantics.`
      );
    }
    return metric.metricId;
  });
  assertUnique(metricIds, "configuration.terminology.metrics.metricId");
  return { termIds, metricIds };
}

function validateSales(sales, terminologyContext) {
  assertExactKeys(sales, [
    "goals",
    "outcomes",
    "conversionEvents",
    "processStages",
    "followUpStages"
  ], "configuration.sales");

  assertArray(sales.conversionEvents, "configuration.sales.conversionEvents", { min: 1, max: 100 });
  const conversionEventIds = sales.conversionEvents.map((event, index) => {
    const scope = `configuration.sales.conversionEvents[${index}]`;
    assertExactKeys(event, ["conversionEventId", "metricId", "displayLabel"], scope);
    assertId(event.conversionEventId, `${scope}.conversionEventId`);
    assertId(event.metricId, `${scope}.metricId`);
    if (!terminologyContext.metricIds.includes(event.metricId)) {
      fail("route_iq_paid_customer_metric_reference_invalid", `${scope} references an unknown metric.`);
    }
    assertSafeLabel(event.displayLabel, `${scope}.displayLabel`);
    return event.conversionEventId;
  });
  assertUnique(conversionEventIds, "configuration.sales.conversionEvents.conversionEventId");

  assertArray(sales.goals, "configuration.sales.goals", { min: 1, max: 100 });
  const goalIds = sales.goals.map((goal, index) => {
    const scope = `configuration.sales.goals[${index}]`;
    assertExactKeys(goal, ["goalId", "metricId", "target", "period"], scope);
    assertId(goal.goalId, `${scope}.goalId`);
    assertId(goal.metricId, `${scope}.metricId`);
    if (!terminologyContext.metricIds.includes(goal.metricId)) {
      fail("route_iq_paid_customer_metric_reference_invalid", `${scope} references an unknown metric.`);
    }
    assertFiniteNumber(goal.target, `${scope}.target`, { min: 0, max: 1_000_000_000 });
    assertEnum(goal.period, ["DAY", "WEEK", "MONTH", "QUARTER"], `${scope}.period`);
    return goal.goalId;
  });
  assertUnique(goalIds, "configuration.sales.goals.goalId");

  assertArray(sales.outcomes, "configuration.sales.outcomes", { min: 1, max: 100 });
  const outcomeIds = sales.outcomes.map((outcome, index) => {
    const scope = `configuration.sales.outcomes[${index}]`;
    assertExactKeys(
      outcome,
      ["outcomeId", "displayLabel", "classification", "conversionEventId"],
      scope
    );
    assertId(outcome.outcomeId, `${scope}.outcomeId`);
    assertSafeLabel(outcome.displayLabel, `${scope}.displayLabel`);
    assertEnum(
      outcome.classification,
      ["OBSERVATION", "PROGRESS", "SUCCESS", "EXCLUSION", "FOLLOW_UP"],
      `${scope}.classification`
    );
    if (outcome.conversionEventId !== null) {
      assertId(outcome.conversionEventId, `${scope}.conversionEventId`);
      if (!conversionEventIds.includes(outcome.conversionEventId)) {
        fail(
          "route_iq_paid_customer_conversion_reference_invalid",
          `${scope} references an unknown conversion event.`
        );
      }
    }
    return outcome.outcomeId;
  });
  assertUnique(outcomeIds, "configuration.sales.outcomes.outcomeId");

  const validateStages = (stages, scope) => {
    assertArray(stages, scope, { min: 1, max: 50 });
    const stageIds = stages.map((stage, index) => {
      const stageScope = `${scope}[${index}]`;
      assertExactKeys(stage, ["stageId", "displayLabel", "sequence", "terminal"], stageScope);
      assertId(stage.stageId, `${stageScope}.stageId`);
      assertSafeLabel(stage.displayLabel, `${stageScope}.displayLabel`);
      assertInteger(stage.sequence, `${stageScope}.sequence`, { min: 1, max: 1000 });
      assertBoolean(stage.terminal, `${stageScope}.terminal`);
      return stage.stageId;
    });
    assertUnique(stageIds, `${scope}.stageId`);
    const sequences = stages.map(stage => stage.sequence);
    assertUnique(sequences, `${scope}.sequence`);
    return stageIds;
  };

  const processStageIds = validateStages(sales.processStages, "configuration.sales.processStages");
  const followUpStageIds = validateStages(
    sales.followUpStages,
    "configuration.sales.followUpStages"
  );
  return { outcomeIds, processStageIds, followUpStageIds };
}

function validateVerification(verification) {
  assertExactKeys(verification, [
    "verifiedIdentityRequired",
    "physicalAddressRequired",
    "authorizedTerritoryRequired",
    "businessCategoryRequired",
    "currentOperatingStatusRequired",
    "operatingHoursRequired",
    "verificationSourceRequired",
    "verificationTimestampRequired",
    "duplicateResolutionRequired",
    "targetProfileMatchRequired",
    "recommendationReasonRequired",
    "evidenceQualityRequired",
    "freshnessCeilingHours",
    "missingEvidenceBehavior",
    "staleEvidenceBehavior",
    "conflictingEvidenceBehavior",
    "providerFailureBehavior",
    "closedBusinessBehavior",
    "outsideTerritoryBehavior",
    "excludedBusinessBehavior",
    "duplicateBusinessBehavior"
  ], "configuration.verification");
  for (const field of [
    "verifiedIdentityRequired",
    "physicalAddressRequired",
    "authorizedTerritoryRequired",
    "businessCategoryRequired",
    "currentOperatingStatusRequired",
    "operatingHoursRequired",
    "verificationSourceRequired",
    "verificationTimestampRequired",
    "duplicateResolutionRequired",
    "targetProfileMatchRequired",
    "recommendationReasonRequired",
    "evidenceQualityRequired"
  ]) {
    if (verification[field] !== true) {
      fail(
        "route_iq_paid_customer_verification_requirement_missing",
        `configuration.verification.${field} must remain required.`
      );
    }
  }
  assertInteger(
    verification.freshnessCeilingHours,
    "configuration.verification.freshnessCeilingHours",
    { min: 1, max: 24 }
  );
  const expected = {
    missingEvidenceBehavior: "INELIGIBLE",
    staleEvidenceBehavior: "INELIGIBLE",
    conflictingEvidenceBehavior: "INELIGIBLE",
    providerFailureBehavior: "INELIGIBLE_PRESERVE_PRIOR_EVIDENCE",
    closedBusinessBehavior: "INELIGIBLE",
    outsideTerritoryBehavior: "INELIGIBLE",
    excludedBusinessBehavior: "INELIGIBLE",
    duplicateBusinessBehavior: "INELIGIBLE_UNTIL_RESOLVED"
  };
  for (const [field, value] of Object.entries(expected)) {
    if (verification[field] !== value) {
      fail(
        "route_iq_paid_customer_verification_fail_closed_required",
        `configuration.verification.${field} must fail closed.`
      );
    }
  }
}

function validateDashboard(dashboard, terminologyContext) {
  assertExactKeys(dashboard, [
    "dashboardProfileId",
    "metricIds",
    "cardFieldIds",
    "capabilityIds",
    "missingConfigurationState",
    "unsupportedFieldBehavior"
  ], "configuration.dashboard");
  assertId(dashboard.dashboardProfileId, "configuration.dashboard.dashboardProfileId");
  assertIdArray(dashboard.metricIds, "configuration.dashboard.metricIds", { min: 1 });
  for (const metricId of dashboard.metricIds) {
    if (!terminologyContext.metricIds.includes(metricId)) {
      fail(
        "route_iq_paid_customer_dashboard_metric_unknown",
        "Dashboard references an unknown metric."
      );
    }
  }
  assertIdArray(dashboard.cardFieldIds, "configuration.dashboard.cardFieldIds", { min: 1 });
  assertIdArray(dashboard.capabilityIds, "configuration.dashboard.capabilityIds", { min: 1 });
  if (
    dashboard.missingConfigurationState !== "NO_PAID_CUSTOMER_CONFIGURATION_SELECTED"
    || dashboard.unsupportedFieldBehavior !== "HIDE"
  ) {
    fail(
      "route_iq_paid_customer_dashboard_fail_closed_required",
      "Dashboard must fail closed when customer configuration is missing or unsupported."
    );
  }
}

function validateCrm(crm, salesContext) {
  assertExactKeys(crm, [
    "workflowId",
    "processStageIds",
    "followUpStageIds",
    "outcomeMappings",
    "productionMutationAuthorized",
    "crossWorkspaceRecordsAllowed"
  ], "configuration.crm");
  assertId(crm.workflowId, "configuration.crm.workflowId");
  assertIdArray(crm.processStageIds, "configuration.crm.processStageIds", { min: 1 });
  assertIdArray(crm.followUpStageIds, "configuration.crm.followUpStageIds", { min: 1 });
  for (const stageId of crm.processStageIds) {
    if (!salesContext.processStageIds.includes(stageId)) {
      fail("route_iq_paid_customer_crm_stage_unknown", "CRM process stage is not configured.");
    }
  }
  for (const stageId of crm.followUpStageIds) {
    if (!salesContext.followUpStageIds.includes(stageId)) {
      fail("route_iq_paid_customer_crm_stage_unknown", "CRM follow-up stage is not configured.");
    }
  }
  assertArray(crm.outcomeMappings, "configuration.crm.outcomeMappings", {
    min: 1,
    max: 100
  });
  const mappedOutcomes = crm.outcomeMappings.map((mapping, index) => {
    const scope = `configuration.crm.outcomeMappings[${index}]`;
    assertExactKeys(mapping, ["outcomeId", "processStageId", "followUpStageId"], scope);
    assertId(mapping.outcomeId, `${scope}.outcomeId`);
    if (!salesContext.outcomeIds.includes(mapping.outcomeId)) {
      fail("route_iq_paid_customer_crm_outcome_unknown", `${scope} references an unknown outcome.`);
    }
    assertId(mapping.processStageId, `${scope}.processStageId`);
    if (!salesContext.processStageIds.includes(mapping.processStageId)) {
      fail("route_iq_paid_customer_crm_stage_unknown", `${scope} references an unknown process stage.`);
    }
    if (mapping.followUpStageId !== null) {
      assertId(mapping.followUpStageId, `${scope}.followUpStageId`);
      if (!salesContext.followUpStageIds.includes(mapping.followUpStageId)) {
        fail("route_iq_paid_customer_crm_stage_unknown", `${scope} references an unknown follow-up stage.`);
      }
    }
    return mapping.outcomeId;
  });
  assertUnique(mappedOutcomes, "configuration.crm.outcomeMappings.outcomeId");
  if (crm.productionMutationAuthorized !== false || crm.crossWorkspaceRecordsAllowed !== false) {
    fail(
      "route_iq_paid_customer_crm_activation_forbidden",
      "Onboarding configuration cannot authorize CRM production mutation or cross-workspace records."
    );
  }
}

function validateSupportContacts(contacts) {
  assertArray(contacts, "configuration.supportContacts", { min: 1, max: 20 });
  const contactIds = contacts.map((contact, index) => {
    const scope = `configuration.supportContacts[${index}]`;
    assertExactKeys(contact, [
      "contactId",
      "contactType",
      "displayLabel",
      "contactReference",
      "active"
    ], scope);
    assertId(contact.contactId, `${scope}.contactId`);
    assertEnum(
      contact.contactType,
      ["OPERATIONAL", "SECURITY", "TECHNICAL", "BILLING"],
      `${scope}.contactType`
    );
    assertSafeLabel(contact.displayLabel, `${scope}.displayLabel`);
    assertId(contact.contactReference, `${scope}.contactReference`);
    assertBoolean(contact.active, `${scope}.active`);
    return contact.contactId;
  });
  assertUnique(contactIds, "configuration.supportContacts.contactId");
  if (!contacts.some(contact => contact.contactType === "OPERATIONAL" && contact.active)) {
    fail(
      "route_iq_paid_customer_operational_contact_missing",
      "An active operational support contact is required."
    );
  }
}

function validateGovernance(governance) {
  assertExactKeys(governance, [
    "retentionMonths",
    "customerMayShortenRetention",
    "customerMayExpandRetention",
    "legalHoldSupported",
    "dispositionMode",
    "auditMode"
  ], "configuration.governance");
  assertInteger(governance.retentionMonths, "configuration.governance.retentionMonths", {
    min: 1,
    max: 18
  });
  if (
    governance.customerMayShortenRetention !== true
    || governance.customerMayExpandRetention !== false
    || governance.legalHoldSupported !== true
    || governance.dispositionMode !== "APPEND_ONLY_AUDITABLE"
    || governance.auditMode !== "COMPANY_WORKSPACE_SCOPED"
  ) {
    fail(
      "route_iq_paid_customer_governance_invalid",
      "Retention, legal-hold, disposition, and audit boundaries are invalid."
    );
  }
}

function validateSafety(safety, lifecycle) {
  assertExactKeys(safety, [
    "customerActivation",
    "activationAuthorizationRef",
    "collection",
    "activeCohorts",
    "recommendationInfluence",
    "providerRefresh",
    "scheduler"
  ], "configuration.safety");
  assertEnum(safety.customerActivation, ["OFF", "ON"], "configuration.safety.customerActivation");
  assertOptionalSafeLabel(
    safety.activationAuthorizationRef,
    "configuration.safety.activationAuthorizationRef",
    240
  );
  if (
    safety.collection !== "OFF"
    || safety.activeCohorts !== 0
    || safety.recommendationInfluence !== "OFF"
    || safety.providerRefresh !== "OFF"
    || safety.scheduler !== "OFF"
  ) {
    fail(
      "route_iq_paid_customer_safety_boundary_invalid",
      "Onboarding configuration cannot activate collection, cohorts, influence, providers, or scheduling."
    );
  }
  if (safety.customerActivation === "OFF" && safety.activationAuthorizationRef !== null) {
    fail(
      "route_iq_paid_customer_activation_authorization_invalid",
      "Inactive customer configuration cannot carry an activation authorization."
    );
  }
  if (
    lifecycle.state === "ACTIVE"
    && (safety.customerActivation !== "ON" || !safety.activationAuthorizationRef)
  ) {
    fail(
      "route_iq_paid_customer_activation_unauthorized",
      "Active lifecycle requires a separate activation authorization."
    );
  }
  if (lifecycle.state !== "ACTIVE" && safety.customerActivation !== "OFF") {
    fail(
      "route_iq_paid_customer_activation_state_mismatch",
      "Customer activation may only be ON in the ACTIVE lifecycle state."
    );
  }
}

function validateLifecycle(lifecycle) {
  assertExactKeys(lifecycle, [
    "state",
    "revision",
    "lastTransitionAt",
    "approvalReference",
    "failure"
  ], "configuration.lifecycle");
  assertEnum(
    lifecycle.state,
    ROUTE_IQ_PAID_CUSTOMER_LIFECYCLE_STATES,
    "configuration.lifecycle.state",
    "route_iq_paid_customer_lifecycle_state_invalid"
  );
  assertInteger(lifecycle.revision, "configuration.lifecycle.revision", { min: 1 });
  assertInstant(lifecycle.lastTransitionAt, "configuration.lifecycle.lastTransitionAt");
  assertOptionalSafeLabel(
    lifecycle.approvalReference,
    "configuration.lifecycle.approvalReference",
    240
  );
  if (lifecycle.failure !== null) {
    assertExactKeys(
      lifecycle.failure,
      ["code", "recoveryAction"],
      "configuration.lifecycle.failure"
    );
    assertId(lifecycle.failure.code, "configuration.lifecycle.failure.code");
    assertSafeLabel(
      lifecycle.failure.recoveryAction,
      "configuration.lifecycle.failure.recoveryAction",
      320
    );
  }
  if (["AWAITING_APPROVAL", "PROVISIONING", "READY_FOR_ACTIVATION", "ACTIVE", "SUSPENDED", "OFFBOARDED"]
    .includes(lifecycle.state) && !lifecycle.approvalReference) {
    fail(
      "route_iq_paid_customer_approval_reference_missing",
      "Approved and post-approval lifecycle states require an approval reference."
    );
  }
  if (["VALIDATION_FAILED", "PROVISIONING_FAILED"].includes(lifecycle.state)) {
    if (!lifecycle.failure) {
      fail(
        "route_iq_paid_customer_failure_record_missing",
        "Failure lifecycle states require a safe recovery record."
      );
    }
  } else if (lifecycle.failure !== null) {
    fail(
      "route_iq_paid_customer_failure_record_unexpected",
      "Non-failure lifecycle states cannot retain an active failure record."
    );
  }
}

function validateProvenance(provenance, configuration) {
  assertExactKeys(provenance, [
    "authority",
    "sourceSystem",
    "sourceReferences",
    "createdAt",
    "createdByReference",
    "configurationIdentity"
  ], "configuration.provenance");
  if (provenance.authority !== ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_AUTHORITY) {
    fail("route_iq_paid_customer_provenance_invalid", "Configuration authority is invalid.");
  }
  assertId(provenance.sourceSystem, "configuration.provenance.sourceSystem");
  assertArray(provenance.sourceReferences, "configuration.provenance.sourceReferences", {
    min: 1,
    max: 100
  });
  provenance.sourceReferences.forEach((reference, index) => {
    assertSafeLabel(reference, `configuration.provenance.sourceReferences[${index}]`, 320);
  });
  assertUnique(provenance.sourceReferences, "configuration.provenance.sourceReferences");
  assertInstant(provenance.createdAt, "configuration.provenance.createdAt");
  assertId(provenance.createdByReference, "configuration.provenance.createdByReference");
  const expectedIdentity =
    `${configuration.configurationId}@${configuration.configurationRevision}`;
  if (provenance.configurationIdentity !== expectedIdentity) {
    fail(
      "route_iq_paid_customer_provenance_identity_mismatch",
      "Provenance does not match the immutable configuration identity."
    );
  }
}

export function validateRouteIqPaidCustomerOnboardingConfiguration(configuration) {
  assertExactKeys(configuration, TOP_LEVEL_KEYS, "configuration");
  if (configuration.schemaVersion !== ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_SCHEMA_VERSION) {
    fail("route_iq_paid_customer_schema_version_unsupported", "Schema version is unsupported.");
  }
  if (configuration.contractVersion !== ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_CONTRACT_VERSION) {
    fail("route_iq_paid_customer_contract_version_unsupported", "Contract version is unsupported.");
  }
  assertId(configuration.configurationId, "configuration.configurationId");
  assertInteger(configuration.configurationRevision, "configuration.configurationRevision", {
    min: 1
  });
  validateCompany(configuration.company);
  validateOperatingProfile(configuration.operatingProfile);
  validateTargeting(configuration.targeting);
  validateTerritory(configuration.territory);
  validateAccess(configuration.access);
  const terminologyContext = validateTerminology(configuration.terminology);
  const salesContext = validateSales(configuration.sales, terminologyContext);
  validateVerification(configuration.verification);
  validateDashboard(configuration.dashboard, terminologyContext);
  validateCrm(configuration.crm, salesContext);
  validateSupportContacts(configuration.supportContacts);
  validateGovernance(configuration.governance);
  validateLifecycle(configuration.lifecycle);
  validateSafety(configuration.safety, configuration.lifecycle);
  validateProvenance(configuration.provenance, configuration);
  return deepFreeze(clone(configuration));
}

function transitionFailure(nextState, options) {
  if (!["VALIDATION_FAILED", "PROVISIONING_FAILED"].includes(nextState)) return null;
  if (!options.failure) {
    fail(
      "route_iq_paid_customer_failure_record_missing",
      "Failure transitions require a safe recovery record."
    );
  }
  assertExactKeys(options.failure, ["code", "recoveryAction"], "transition.failure");
  assertId(options.failure.code, "transition.failure.code");
  assertSafeLabel(options.failure.recoveryAction, "transition.failure.recoveryAction", 320);
  return clone(options.failure);
}

function requireTrustedActivationDecision(decision, configuration, transitionedAt) {
  if (
    decision === null
    || typeof decision !== "object"
    || !TRUSTED_ACTIVATION_DECISIONS.has(decision)
  ) {
    fail(
      "route_iq_paid_customer_activation_decision_untrusted",
      "Activation requires a trusted server-issued decision."
    );
  }
  if (CONSUMED_ACTIVATION_DECISIONS.has(decision)) {
    fail(
      "route_iq_paid_customer_activation_decision_replayed",
      "Activation decisions are single-use."
    );
  }
  assertExactKeys(decision, [
    "decisionId",
    "companyId",
    "workspaceId",
    "configurationIdentity",
    "authorizationReference",
    "issuedAt",
    "expiresAt"
  ], "activationDecision");
  assertId(decision.decisionId, "activationDecision.decisionId");
  assertId(decision.companyId, "activationDecision.companyId");
  assertId(decision.workspaceId, "activationDecision.workspaceId");
  assertSafeLabel(
    decision.configurationIdentity,
    "activationDecision.configurationIdentity",
    200
  );
  assertSafeLabel(
    decision.authorizationReference,
    "activationDecision.authorizationReference",
    240
  );
  assertInstant(decision.issuedAt, "activationDecision.issuedAt");
  assertInstant(decision.expiresAt, "activationDecision.expiresAt");
  const transitionTime = Date.parse(transitionedAt);
  if (
    decision.companyId !== configuration.company.companyId
    || decision.workspaceId !== configuration.company.workspaceId
    || decision.configurationIdentity !== configuration.provenance.configurationIdentity
  ) {
    fail(
      "route_iq_paid_customer_activation_decision_scope_mismatch",
      "Activation decision scope does not match the configuration."
    );
  }
  if (
    Date.parse(decision.issuedAt) > transitionTime
    || Date.parse(decision.expiresAt) <= transitionTime
  ) {
    fail(
      "route_iq_paid_customer_activation_decision_time_invalid",
      "Activation decision is premature or expired."
    );
  }
  CONSUMED_ACTIVATION_DECISIONS.add(decision);
  return decision.authorizationReference;
}

export function transitionRouteIqPaidCustomerOnboarding(
  configuration,
  nextState,
  options = {}
) {
  const current = validateRouteIqPaidCustomerOnboardingConfiguration(configuration);
  assertEnum(
    nextState,
    ROUTE_IQ_PAID_CUSTOMER_LIFECYCLE_STATES,
    "nextState",
    "route_iq_paid_customer_lifecycle_state_invalid"
  );
  if (!LIFECYCLE_TRANSITIONS[current.lifecycle.state].has(nextState)) {
    fail(
      "route_iq_paid_customer_lifecycle_transition_invalid",
      `Transition ${current.lifecycle.state} -> ${nextState} is not permitted.`
    );
  }
  assertInstant(options.transitionedAt, "transition.transitionedAt");
  if (Date.parse(options.transitionedAt) <= Date.parse(current.lifecycle.lastTransitionAt)) {
    fail(
      "route_iq_paid_customer_lifecycle_transition_time_invalid",
      "Lifecycle transitions must occur strictly after the current transition."
    );
  }
  const transitioned = clone(current);
  transitioned.lifecycle = {
    state: nextState,
    revision: current.lifecycle.revision + 1,
    lastTransitionAt: options.transitionedAt,
    approvalReference:
      options.approvalReference === undefined
        ? current.lifecycle.approvalReference
        : options.approvalReference,
    failure: transitionFailure(nextState, options)
  };
  if (nextState === "DRAFT") {
    transitioned.lifecycle.approvalReference = null;
  }
  if (nextState === "AWAITING_APPROVAL" && !transitioned.lifecycle.approvalReference) {
    fail(
      "route_iq_paid_customer_approval_reference_missing",
      "Awaiting approval requires an explicit approval reference."
    );
  }
  if (nextState === "ACTIVE") {
    const activationAuthorizationRef = requireTrustedActivationDecision(
      options.activationDecision,
      current,
      options.transitionedAt
    );
    transitioned.safety.customerActivation = "ON";
    transitioned.safety.activationAuthorizationRef = activationAuthorizationRef;
  } else {
    transitioned.safety.customerActivation = "OFF";
    transitioned.safety.activationAuthorizationRef = null;
  }
  return validateRouteIqPaidCustomerOnboardingConfiguration(transitioned);
}

export function createRouteIqPaidCustomerConfigurationPreview(configuration) {
  const validated = validateRouteIqPaidCustomerOnboardingConfiguration(configuration);
  if (!["VALIDATED", "PREVIEW_READY", "AWAITING_APPROVAL"].includes(validated.lifecycle.state)) {
    fail(
      "route_iq_paid_customer_preview_state_invalid",
      "Preview requires a validated, preview-ready, or awaiting-approval configuration."
    );
  }
  return deepFreeze({
    previewVersion: "route-iq-paid-customer-preview-v1",
    configurationIdentity:
      `${validated.configurationId}@${validated.configurationRevision}`,
    companyId: validated.company.companyId,
    workspaceId: validated.company.workspaceId,
    companyName: validated.company.displayName,
    representativeTerm: validated.terminology.terms.find(term => term.termId === "representative"),
    managerTerm: validated.terminology.terms.find(term => term.termId === "manager"),
    metricLabels: validated.dashboard.metricIds.map(metricId => {
      const metric = validated.terminology.metrics.find(candidate => candidate.metricId === metricId);
      const term = validated.terminology.terms.find(
        candidate => candidate.termId === metric.displayTermId
      );
      return {
        metricId: metric.metricId,
        semanticVersion: metric.semanticVersion,
        singular: term.singular,
        plural: term.plural
      };
    }),
    goals: clone(validated.sales.goals),
    outcomes: clone(validated.sales.outcomes),
    processStages: clone(validated.sales.processStages),
    followUpStages: clone(validated.sales.followUpStages),
    territory: {
      territoryId: validated.territory.territoryId,
      cities: validated.territory.authorizedCities.map(city => ({
        cityId: city.cityId,
        name: city.name,
        stateCode: city.stateCode
      })),
      zipCodes: [...validated.territory.authorizedZipCodes],
      travelLimit: clone(validated.territory.travelLimit)
    },
    targeting: {
      includedCategoryIds: [...validated.targeting.includedCategoryIds],
      excludedCategoryIds: [...validated.targeting.excludedCategoryIds],
      excludedBusinessIds: [...validated.targeting.excludedBusinessIds]
    },
    verification: {
      freshnessCeilingHours: validated.verification.freshnessCeilingHours,
      missingEvidenceBehavior: validated.verification.missingEvidenceBehavior,
      staleEvidenceBehavior: validated.verification.staleEvidenceBehavior,
      providerFailureBehavior: validated.verification.providerFailureBehavior
    },
    activationPerformed: false,
    productionMutationCount: 0,
    customerActivation: "OFF",
    collection: "OFF",
    activeCohorts: 0,
    recommendationInfluence: "OFF",
    providerRefresh: "OFF",
    scheduler: "OFF"
  });
}

export function createRouteIqPaidCustomerProvisioningPlan(configuration) {
  const validated = validateRouteIqPaidCustomerOnboardingConfiguration(configuration);
  if (validated.lifecycle.state !== "PROVISIONING") {
    fail(
      "route_iq_paid_customer_provisioning_state_invalid",
      "Provisioning requires the PROVISIONING lifecycle state."
    );
  }
  const configurationIdentity =
    `${validated.configurationId}@${validated.configurationRevision}`;
  const fingerprintSource = clone(validated);
  fingerprintSource.lifecycle.lastTransitionAt = "TIMESTAMP_REDACTED_FOR_IDEMPOTENCY";
  const configurationFingerprint = deterministicFingerprint(fingerprintSource);
  const resourceKeys = [
    `company:${validated.company.companyId}`,
    `workspace:${validated.company.workspaceId}`,
    `territory:${validated.company.workspaceId}:${validated.territory.territoryId}`,
    ...validated.access.roles.map(
      role => `role:${validated.company.workspaceId}:${role.roleId}`
    ),
    ...validated.terminology.metrics.map(
      metric =>
        `metric:${validated.company.workspaceId}:${metric.metricId}@${metric.semanticVersion}`
    ),
    ...validated.sales.processStages.map(
      stage => `crm_process_stage:${validated.company.workspaceId}:${stage.stageId}`
    ),
    ...validated.sales.followUpStages.map(
      stage => `crm_follow_up_stage:${validated.company.workspaceId}:${stage.stageId}`
    )
  ];
  assertUnique(resourceKeys, "provisioningPlan.resourceKeys");
  return deepFreeze({
    planVersion: "route-iq-paid-customer-provisioning-plan-v1",
    idempotencyKey:
      `paid_customer_provisioning:${configurationIdentity}:${configurationFingerprint}`,
    configurationIdentity,
    configurationFingerprint,
    companyId: validated.company.companyId,
    workspaceId: validated.company.workspaceId,
    activationRequested: false,
    productionMutationAuthorized: false,
    resourceKeys,
    auditEvent: {
      eventType: "PAID_CUSTOMER_PROVISIONING_PLANNED",
      companyId: validated.company.companyId,
      workspaceId: validated.company.workspaceId,
      configurationIdentity
    }
  });
}

export function applyRouteIqPaidCustomerProvisioningPlan(plan, registry = undefined) {
  assertExactKeys(plan, [
    "planVersion",
    "idempotencyKey",
    "configurationIdentity",
    "configurationFingerprint",
    "companyId",
    "workspaceId",
    "activationRequested",
    "productionMutationAuthorized",
    "resourceKeys",
    "auditEvent"
  ], "provisioningPlan");
  if (
    plan.planVersion !== "route-iq-paid-customer-provisioning-plan-v1"
    || plan.activationRequested !== false
    || plan.productionMutationAuthorized !== false
  ) {
    fail(
      "route_iq_paid_customer_provisioning_plan_invalid",
      "Provisioning plan exceeds the non-activation boundary."
    );
  }
  assertSafeLabel(plan.idempotencyKey, "provisioningPlan.idempotencyKey", 320);
  assertSafeLabel(plan.configurationIdentity, "provisioningPlan.configurationIdentity", 200);
  if (
    typeof plan.configurationFingerprint !== "string"
    || !/^[a-f0-9]{16}$/u.test(plan.configurationFingerprint)
  ) {
    fail(
      "route_iq_paid_customer_provisioning_plan_invalid",
      "Provisioning fingerprint is invalid."
    );
  }
  assertId(plan.companyId, "provisioningPlan.companyId");
  assertId(plan.workspaceId, "provisioningPlan.workspaceId");
  assertArray(plan.resourceKeys, "provisioningPlan.resourceKeys", { min: 3, max: 500 });
  plan.resourceKeys.forEach((resourceKey, index) =>
    assertSafeLabel(resourceKey, `provisioningPlan.resourceKeys[${index}]`, 320)
  );
  assertUnique(plan.resourceKeys, "provisioningPlan.resourceKeys");
  assertExactKeys(
    plan.auditEvent,
    ["eventType", "companyId", "workspaceId", "configurationIdentity"],
    "provisioningPlan.auditEvent"
  );
  if (
    plan.auditEvent.eventType !== "PAID_CUSTOMER_PROVISIONING_PLANNED"
    || plan.auditEvent.companyId !== plan.companyId
    || plan.auditEvent.workspaceId !== plan.workspaceId
    || plan.auditEvent.configurationIdentity !== plan.configurationIdentity
  ) {
    fail(
      "route_iq_paid_customer_provisioning_audit_invalid",
      "Provisioning audit ownership does not match the plan."
    );
  }

  const current = registry === undefined
    ? {
        registryVersion: "route-iq-paid-customer-provisioning-registry-v1",
        receipts: {},
        resources: {},
        auditEvents: []
      }
    : clone(registry);
  assertExactKeys(
    current,
    ["registryVersion", "receipts", "resources", "auditEvents"],
    "provisioningRegistry"
  );
  if (current.registryVersion !== "route-iq-paid-customer-provisioning-registry-v1") {
    fail(
      "route_iq_paid_customer_provisioning_registry_invalid",
      "Provisioning registry version is unsupported."
    );
  }
  assertObject(current.receipts, "provisioningRegistry.receipts");
  assertObject(current.resources, "provisioningRegistry.resources");
  assertArray(current.auditEvents, "provisioningRegistry.auditEvents");

  const existingReceipt = current.receipts[plan.idempotencyKey];
  if (existingReceipt !== undefined) {
    if (
      existingReceipt.configurationFingerprint !== plan.configurationFingerprint
      || existingReceipt.companyId !== plan.companyId
      || existingReceipt.workspaceId !== plan.workspaceId
    ) {
      fail(
        "route_iq_paid_customer_provisioning_retry_conflict",
        "Existing provisioning receipt conflicts with this retry."
      );
    }
    return deepFreeze(current);
  }

  for (const resourceKey of plan.resourceKeys) {
    const existing = current.resources[resourceKey];
    if (
      existing
      && (
        existing.companyId !== plan.companyId
        || existing.workspaceId !== plan.workspaceId
        || existing.configurationIdentity !== plan.configurationIdentity
      )
    ) {
      fail(
        "route_iq_paid_customer_provisioning_resource_conflict",
        "Provisioning resource is already owned by another configuration."
      );
    }
  }
  for (const resourceKey of plan.resourceKeys) {
    current.resources[resourceKey] = {
      companyId: plan.companyId,
      workspaceId: plan.workspaceId,
      configurationIdentity: plan.configurationIdentity
    };
  }
  current.receipts[plan.idempotencyKey] = {
    companyId: plan.companyId,
    workspaceId: plan.workspaceId,
    configurationIdentity: plan.configurationIdentity,
    configurationFingerprint: plan.configurationFingerprint,
    resourceCount: plan.resourceKeys.length,
    activationPerformed: false
  };
  current.auditEvents.push({
    sequence: current.auditEvents.length + 1,
    eventType: "PAID_CUSTOMER_PROVISIONING_APPLIED",
    companyId: plan.companyId,
    workspaceId: plan.workspaceId,
    configurationIdentity: plan.configurationIdentity,
    idempotencyKey: plan.idempotencyKey
  });
  return deepFreeze(current);
}

export function suspendRouteIqPaidCustomerConfiguration(
  configuration,
  { transitionedAt, reasonCode }
) {
  assertId(reasonCode, "suspension.reasonCode");
  const suspended = transitionRouteIqPaidCustomerOnboarding(configuration, "SUSPENDED", {
    transitionedAt
  });
  return deepFreeze({
    configuration: suspended,
    auditEvent: {
      eventType: "PAID_CUSTOMER_SUSPENDED",
      companyId: suspended.company.companyId,
      workspaceId: suspended.company.workspaceId,
      configurationIdentity:
        `${suspended.configurationId}@${suspended.configurationRevision}`,
      reasonCode,
      accessBehavior: "DENY_OPERATIONAL_ACCESS",
      dataBehavior: "PRESERVE_APPEND_ONLY"
    }
  });
}

export function offboardRouteIqPaidCustomerConfiguration(
  configuration,
  { transitionedAt, reasonCode }
) {
  assertId(reasonCode, "offboarding.reasonCode");
  const current = validateRouteIqPaidCustomerOnboardingConfiguration(configuration);
  if (!["ACTIVE", "SUSPENDED"].includes(current.lifecycle.state)) {
    fail(
      "route_iq_paid_customer_offboarding_state_invalid",
      "Only active or suspended configurations may be offboarded."
    );
  }
  const offboarded = transitionRouteIqPaidCustomerOnboarding(current, "OFFBOARDED", {
    transitionedAt
  });
  return deepFreeze({
    configuration: offboarded,
    auditEvent: {
      eventType: "PAID_CUSTOMER_OFFBOARDED",
      companyId: offboarded.company.companyId,
      workspaceId: offboarded.company.workspaceId,
      configurationIdentity:
        `${offboarded.configurationId}@${offboarded.configurationRevision}`,
      reasonCode,
      accessBehavior: "DENY_ALL_CUSTOMER_ACCESS",
      evidenceBehavior: "PRESERVE_UNDER_RETENTION_AND_LEGAL_HOLD",
      dispositionBehavior: "SEPARATE_APPEND_ONLY_DATA_ACTION_REQUIRED"
    }
  });
}
