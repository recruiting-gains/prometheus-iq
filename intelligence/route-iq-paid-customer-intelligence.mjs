import {
  ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_AUTHORITY,
  ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_CONTRACT_VERSION,
  ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_SCHEMA_VERSION,
  validateRouteIqPaidCustomerOnboardingConfiguration
} from "../administration/contracts/route-iq-paid-customer-onboarding-v1.mjs";

export const routeIqPaidCustomerIntelligenceVersion = "route-iq-paid-customer-intelligence-v1";
export const routeIqPaidCustomerOnboardingVersion =
  ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_SCHEMA_VERSION;
export const routeIqPaidCustomerOnboardingContractVersion =
  ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_CONTRACT_VERSION;
export const routeIqVerifiedBusinessEvidenceVersion = "route-iq-verified-business-evidence-v1";
export const routeIqMetricLabelSnapshotVersion = "route-iq-metric-label-snapshot-v1";

export const paidCustomerIntelligenceSafety = Object.freeze({
  collection: "OFF",
  activeCohorts: 0,
  recommendationInfluence: "OFF",
  customerActivation: "OFF",
  routeOrderingChanged: false,
  routeScoringWeightsChanged: false
});

export const paidCustomerIntelligenceOperations = Object.freeze({
  recommendationAdmission: "RECOMMENDATION_ADMISSION",
  configurationPreview: "CONFIGURATION_PREVIEW"
});

const identifierPattern = /^[a-z][a-z0-9_]{2,127}$/;
const semanticVersionPattern = /^[1-9][0-9]*\.[0-9]+\.[0-9]+$/;
const zipCodePattern = /^\d{5}$/;
const dangerousLabelPattern = /[<>{}`$\\]|(?:javascript|data|vbscript)\s*:/iu;
const controlCharacterPattern = /[\u0000-\u001F\u007F]/gu;
const activePreviewStates = new Set([
  "VALIDATED",
  "PREVIEW_READY",
  "AWAITING_APPROVAL",
  "READY_FOR_ACTIVATION"
]);
const authorizedPermissionsByOperation = Object.freeze({
  [paidCustomerIntelligenceOperations.recommendationAdmission]: Object.freeze([
    "view_assigned_territory",
    "view_company_dashboard"
  ]),
  [paidCustomerIntelligenceOperations.configurationPreview]: Object.freeze([
    "view_company_dashboard"
  ])
});
const controlledFallbackLabels = Object.freeze({
  activity: Object.freeze({ singular: "Activity", plural: "Activities" }),
  business: Object.freeze({ singular: "Business", plural: "Businesses" }),
  conversion: Object.freeze({ singular: "Conversion", plural: "Conversions" }),
  follow_up: Object.freeze({ singular: "Follow-up", plural: "Follow-ups" }),
  goal: Object.freeze({ singular: "Goal", plural: "Goals" }),
  manager: Object.freeze({ singular: "Manager", plural: "Managers" }),
  outcome: Object.freeze({ singular: "Outcome", plural: "Outcomes" }),
  representative: Object.freeze({ singular: "Representative", plural: "Representatives" }),
  visit: Object.freeze({ singular: "Visit", plural: "Visits" })
});
const authorizedScopes = new WeakSet();
const scopeMetadata = new WeakMap();

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function cleanIdentifier(value, label, pattern = identifierPattern) {
  const normalized = String(value ?? "").trim();
  if (!pattern.test(normalized)) {
    throw new Error(`Paid-customer Intelligence ${label} is missing or invalid.`);
  }
  return normalized;
}

function cleanTimestamp(value, label) {
  const normalized = String(value ?? "").trim();
  const parsed = new Date(normalized);
  if (!normalized || Number.isNaN(parsed.getTime()) || parsed.toISOString() !== normalized) {
    throw new Error(`Paid-customer Intelligence ${label} is missing or invalid.`);
  }
  return normalized;
}

function uniqueIdentifiers(values, label, pattern = identifierPattern) {
  if (!Array.isArray(values)) {
    throw new Error(`Paid-customer Intelligence ${label} must be an array.`);
  }
  const normalized = values.map(value => cleanIdentifier(value, label, pattern));
  if (new Set(normalized).size !== normalized.length) {
    throw new Error(`Paid-customer Intelligence ${label} contains duplicates.`);
  }
  return normalized;
}

function safeDisplayLabel(value, label) {
  const original = String(value ?? "");
  const normalized = original.replace(controlCharacterPattern, "").replace(/\s+/gu, " ").trim();
  if (!normalized
    || normalized.length > 80
    || normalized !== original.trim().replace(/\s+/gu, " ")
    || dangerousLabelPattern.test(normalized)) {
    throw new Error(`Paid-customer Intelligence ${label} is unsafe.`);
  }
  return normalized;
}

function normalizeMetricDefinition(definition, termsById = null) {
  if (!isRecord(definition)) {
    throw new Error("Paid-customer Intelligence metric definition is invalid.");
  }
  const metricId = cleanIdentifier(definition.metricId, "metric identifier");
  if (termsById) {
    const semanticVersion = String(definition.semanticVersion ?? "").trim();
    const displayTermId = cleanIdentifier(definition.displayTermId, "metric display term");
    const term = termsById.get(displayTermId);
    if (!semanticVersionPattern.test(semanticVersion)
      || definition.historyIdentity !== `${metricId}@${semanticVersion}`
      || !term) {
      throw new Error("Paid-customer Intelligence metric history contract is invalid.");
    }
    const fallbackKind = Object.hasOwn(controlledFallbackLabels, displayTermId)
      ? displayTermId
      : "outcome";
    return {
      metricId,
      semanticVersion,
      historyIdentity: definition.historyIdentity,
      displayTermId,
      fallbackKind,
      singular: safeDisplayLabel(term.singular, "metric singular label"),
      plural: safeDisplayLabel(term.plural, "metric plural label")
    };
  }

  const fallbackKind = cleanIdentifier(definition.fallbackKind, "metric fallback kind");
  if (!Object.hasOwn(controlledFallbackLabels, fallbackKind)) {
    throw new Error("Paid-customer Intelligence metric fallback kind is unsupported.");
  }
  return {
    metricId,
    semanticVersion: null,
    historyIdentity: null,
    displayTermId: null,
    fallbackKind,
    singular: safeDisplayLabel(definition.labels?.singular, "metric singular label"),
    plural: safeDisplayLabel(definition.labels?.plural, "metric plural label")
  };
}

export function normalizePaidCustomerMetricCatalog(definitions, terms = null) {
  if (!Array.isArray(definitions) || definitions.length === 0) {
    throw new Error("Paid-customer Intelligence metric catalog is missing.");
  }
  let termsById = null;
  if (terms !== null) {
    if (!Array.isArray(terms) || terms.length === 0) {
      throw new Error("Paid-customer Intelligence terminology catalog is missing.");
    }
    termsById = new Map();
    for (const term of terms) {
      const termId = cleanIdentifier(term?.termId, "terminology identifier");
      if (termsById.has(termId)) {
        throw new Error("Paid-customer Intelligence terminology identifiers must be unique.");
      }
      termsById.set(termId, term);
    }
  }
  const normalized = definitions.map(definition =>
    normalizeMetricDefinition(definition, termsById)
  ).sort((left, right) =>
    left.metricId.localeCompare(right.metricId)
  );
  if (new Set(normalized.map(item => item.metricId)).size !== normalized.length) {
    throw new Error("Paid-customer Intelligence metric identifiers must be unique.");
  }
  return deepFreeze(normalized.map(item => ({
    metricId: item.metricId,
    semanticVersion: item.semanticVersion,
    historyIdentity: item.historyIdentity,
    displayTermId: item.displayTermId,
    fallbackKind: item.fallbackKind,
    labels: {
      singular: item.singular,
      plural: item.plural
    }
  })));
}

function validateSafetyBoundary(configuration, errors) {
  const safety = configuration?.safety;
  const expectedConfigurationSafety = {
    customerActivation: "OFF",
    activationAuthorizationRef: null,
    collection: "OFF",
    activeCohorts: 0,
    recommendationInfluence: "OFF",
    providerRefresh: "OFF",
    scheduler: "OFF"
  };
  for (const [key, expected] of Object.entries(expectedConfigurationSafety)) {
    if (safety?.[key] !== expected) errors.push(`safety.${key}`);
  }
}

function validateTerritory(configuration, errors) {
  const territory = configuration?.territory;
  if (!isRecord(territory)) {
    errors.push("territory");
    return;
  }
  try {
    cleanIdentifier(territory.territoryId, "territory identifier");
    if (!Array.isArray(territory.authorizedZipCodes)
      || territory.authorizedZipCodes.length === 0
      || territory.authorizedZipCodes.some(zip => !zipCodePattern.test(String(zip)))) {
      errors.push("territory.authorizedZipCodes");
    }
  } catch {
    errors.push("territory.territoryId");
  }
}

function validateTargeting(configuration, errors) {
  try {
    const included = uniqueIdentifiers(
      configuration?.targeting?.includedCategoryIds,
      "included category"
    );
    const excluded = uniqueIdentifiers(
      configuration?.targeting?.excludedCategoryIds,
      "excluded category"
    );
    uniqueIdentifiers(configuration?.targeting?.excludedBusinessIds, "excluded business");
    if (configuration?.targeting?.targetingDefaultsAllowed !== false
      || configuration?.targeting?.missingRulesBehavior !== "FAIL_CLOSED_CONFIGURATION_REQUIRED"
      || configuration?.targeting?.conflictBehavior !==
        "FAIL_CLOSED_CONFLICT_REQUIRES_RESOLUTION"
      || included.length === 0
      || included.some(value => excluded.includes(value))) {
      errors.push("targeting.categories");
    }
  } catch {
    errors.push("targeting");
  }
}

export function validatePaidCustomerIntelligenceOnboarding(configuration) {
  const errors = [];
  if (!isRecord(configuration)) return ["configuration"];
  try {
    validateRouteIqPaidCustomerOnboardingConfiguration(configuration);
  } catch (error) {
    return [`administration.${String(error?.code || "configuration_invalid")}`];
  }

  if (configuration.schemaVersion !== routeIqPaidCustomerOnboardingVersion) {
    errors.push("schemaVersion");
  }
  if (configuration.contractVersion !== routeIqPaidCustomerOnboardingContractVersion) {
    errors.push("contractVersion");
  }
  if (configuration.provenance?.authority !== ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_AUTHORITY) {
    errors.push("authority");
  }
  try {
    cleanIdentifier(configuration.company?.companyId, "company identity");
    cleanIdentifier(configuration.company?.workspaceId, "workspace identity");
    if (configuration.company?.identityImmutable !== true
      || configuration.company.companyId === configuration.company.workspaceId
      || configuration.provenance?.configurationIdentity !==
        `${configuration.configurationId}@${configuration.configurationRevision}`) {
      errors.push("identity");
    }
  } catch {
    errors.push("identity");
  }
  if (!activePreviewStates.has(configuration.lifecycle?.state)) {
    errors.push("lifecycle");
  }
  validateSafetyBoundary(configuration, errors);
  validateTerritory(configuration, errors);
  validateTargeting(configuration, errors);
  if (!Number.isInteger(configuration?.verification?.freshnessCeilingHours)
    || configuration.verification.freshnessCeilingHours < 1
    || configuration.verification.freshnessCeilingHours > 24
    || configuration.verification.providerFailureBehavior !==
      "INELIGIBLE_PRESERVE_PRIOR_EVIDENCE") {
    errors.push("verification");
  }
  try {
    normalizePaidCustomerMetricCatalog(
      configuration.terminology?.metrics,
      configuration.terminology?.terms
    );
  } catch {
    errors.push("terminology.metrics");
  }
  return [...new Set(errors)].sort();
}

function genericScopeDenied() {
  return deepFreeze({
    version: routeIqPaidCustomerIntelligenceVersion,
    status: "ADMISSION_DENIED",
    reasonCode: "SCOPE_DENIED",
    recommendationAdmissionEligible: false,
    representativeRoutingEligible: false,
    recommendationInfluence: "OFF",
    routeOrderingChanged: false,
    routeScoringWeightsChanged: false,
    validationOnly: true,
    candidateDisclosed: false
  });
}

export function createPaidCustomerIntelligenceScope({
  onboardingConfiguration,
  principal,
  operation
} = {}) {
  if (validatePaidCustomerIntelligenceOnboarding(onboardingConfiguration).length > 0) {
    throw new Error("Paid-customer Intelligence configuration is invalid.");
  }
  const configuration =
    validateRouteIqPaidCustomerOnboardingConfiguration(onboardingConfiguration);
  const companyId = configuration.company.companyId;
  const workspaceId = configuration.company.workspaceId;
  const normalizedOperation = String(operation ?? "").trim();
  const roleId = String(principal?.roleId ?? "").trim();
  const configuredRole = configuration.access.roles.find(role => role.roleId === roleId);
  const authorizedPermissions = authorizedPermissionsByOperation[normalizedOperation];
  if (principal?.authority !== "server_authenticated_principal"
    || principal?.authenticated !== true
    || principal?.companyId !== companyId
    || principal?.workspaceId !== workspaceId
    || !configuredRole
    || !authorizedPermissions
    || !configuredRole.permissions.some(permission =>
      authorizedPermissions.includes(permission))) {
    throw new Error("Paid-customer Intelligence scope is denied.");
  }

  const metricCatalog = normalizePaidCustomerMetricCatalog(
    configuration.terminology.metrics,
    configuration.terminology.terms
  );
  const scope = deepFreeze({
    version: routeIqPaidCustomerIntelligenceVersion,
    companyId,
    workspaceId,
    configurationVersion: configuration.provenance.configurationIdentity,
    roleId,
    operation: normalizedOperation,
    recommendationInfluence: "OFF",
    customerActivation: "OFF"
  });
  const territoryMetadata = new Map([[
    configuration.territory.territoryId,
    {
      zipCodes: new Set(configuration.territory.authorizedZipCodes.map(String)),
      cities: new Set(configuration.territory.authorizedCities.map(city =>
        city.name.trim().toLowerCase()))
    }
  ]]);
  authorizedScopes.add(scope);
  scopeMetadata.set(scope, {
    territoryMetadata,
    includedCategoryIds: new Set(configuration.targeting.includedCategoryIds),
    excludedCategoryIds: new Set(configuration.targeting.excludedCategoryIds),
    excludedBusinessIds: new Set(configuration.targeting.excludedBusinessIds),
    maximumAgeHours: configuration.verification.freshnessCeilingHours,
    metricCatalog
  });
  return scope;
}

function rejectedDecision(scope, reasonCode, evaluatedAt) {
  return deepFreeze({
    version: routeIqPaidCustomerIntelligenceVersion,
    status: "ADMISSION_REJECTED",
    reasonCode,
    companyId: scope.companyId,
    workspaceId: scope.workspaceId,
    configurationVersion: scope.configurationVersion,
    recommendationAdmissionEligible: false,
    representativeRoutingEligible: false,
    recommendationInfluence: "OFF",
    routeOrderingChanged: false,
    routeScoringWeightsChanged: false,
    validationOnly: true,
    candidateDisclosed: true,
    evaluatedAt
  });
}

function evidenceInstant(value) {
  const instant = new Date(String(value ?? ""));
  return Number.isNaN(instant.getTime()) ? null : instant;
}

function safeReason(value) {
  try {
    return safeDisplayLabel(value, "recommendation reason");
  } catch {
    return "";
  }
}

export function evaluatePaidCustomerRecommendationAdmission({
  paidCustomerScope,
  businessEvidence,
  evaluatedAt
} = {}) {
  if (!paidCustomerScope
    || !authorizedScopes.has(paidCustomerScope)
    || paidCustomerScope.operation !== paidCustomerIntelligenceOperations.recommendationAdmission) {
    return genericScopeDenied();
  }
  const scope = paidCustomerScope;
  if (!isRecord(businessEvidence)
    || businessEvidence.companyId !== scope.companyId
    || businessEvidence.workspaceId !== scope.workspaceId) {
    return genericScopeDenied();
  }

  const evaluatedInstant = evidenceInstant(evaluatedAt);
  const evaluatedTimestamp = evaluatedInstant?.toISOString();
  if (!evaluatedInstant || evaluatedTimestamp !== String(evaluatedAt)) {
    return rejectedDecision(scope, "EVALUATION_TIME_INVALID", null);
  }
  const metadata = scopeMetadata.get(scope);
  if (businessEvidence.schemaVersion !== routeIqVerifiedBusinessEvidenceVersion) {
    return rejectedDecision(scope, "EVIDENCE_VERSION_INVALID", evaluatedTimestamp);
  }
  if (businessEvidence.configurationVersion !== scope.configurationVersion
    || businessEvidence.scope?.companyId !== scope.companyId
    || businessEvidence.scope?.workspaceId !== scope.workspaceId
    || businessEvidence.scope?.immutable !== true) {
    return rejectedDecision(scope, "EVIDENCE_SCOPE_INVALID", evaluatedTimestamp);
  }

  let businessId;
  let territoryId;
  let categoryId;
  try {
    businessId = cleanIdentifier(businessEvidence.businessId, "business identity");
    territoryId = cleanIdentifier(businessEvidence.territoryId, "territory identity");
    categoryId = cleanIdentifier(businessEvidence.categoryId, "business category");
  } catch {
    return rejectedDecision(scope, "EVIDENCE_IDENTITY_INVALID", evaluatedTimestamp);
  }

  if (metadata.excludedBusinessIds.has(businessId)) {
    return rejectedDecision(scope, "BUSINESS_EXCLUDED", evaluatedTimestamp);
  }
  const territory = metadata.territoryMetadata.get(territoryId);
  const address = businessEvidence.address;
  if (!territory
    || !isRecord(address)
    || !address.physicalAddressVerified
    || !territory.zipCodes.has(String(address.zipCode ?? ""))
    || (territory.cities.size > 0 && !territory.cities.has(String(address.city ?? "").trim().toLowerCase()))) {
    return rejectedDecision(scope, "TERRITORY_NOT_AUTHORIZED", evaluatedTimestamp);
  }
  if (metadata.excludedCategoryIds.has(categoryId)) {
    return rejectedDecision(scope, "CATEGORY_EXCLUDED", evaluatedTimestamp);
  }
  if (!metadata.includedCategoryIds.has(categoryId)) {
    return rejectedDecision(scope, "CATEGORY_NOT_INCLUDED", evaluatedTimestamp);
  }
  if (businessEvidence.identity?.verified !== true
    || !String(businessEvidence.identity?.verificationSource ?? "").trim()) {
    return rejectedDecision(scope, "IDENTITY_NOT_VERIFIED", evaluatedTimestamp);
  }
  if (businessEvidence.operatingStatus !== "OPEN") {
    return rejectedDecision(scope, "BUSINESS_NOT_OPERATING", evaluatedTimestamp);
  }
  if (!["OPEN_VERIFIED", "ACCESS_WINDOW_VERIFIED"].includes(businessEvidence.availability?.state)) {
    return rejectedDecision(scope, "BUSINESS_NOT_OPEN_NOW", evaluatedTimestamp);
  }
  if (businessEvidence.provider?.state !== "VERIFIED"
    || !String(businessEvidence.provider?.source ?? "").trim()) {
    return rejectedDecision(scope, "PROVIDER_NOT_VERIFIED", evaluatedTimestamp);
  }
  if (businessEvidence.duplicateResolution?.state !== "UNIQUE") {
    return rejectedDecision(scope, "DUPLICATE_UNRESOLVED", evaluatedTimestamp);
  }
  if (businessEvidence.conflictResolution?.state !== "NONE") {
    return rejectedDecision(scope, "EVIDENCE_CONFLICT", evaluatedTimestamp);
  }

  const verifiedAt = evidenceInstant(businessEvidence.verification?.verifiedAt);
  const expiresAt = evidenceInstant(businessEvidence.verification?.expiresAt);
  const ageHours = verifiedAt
    ? (evaluatedInstant.getTime() - verifiedAt.getTime()) / 3_600_000
    : Number.POSITIVE_INFINITY;
  if (businessEvidence.verification?.freshnessState !== "FRESH"
    || !verifiedAt
    || !expiresAt
    || ageHours < 0
    || ageHours > metadata.maximumAgeHours
    || expiresAt.getTime() <= evaluatedInstant.getTime()) {
    return rejectedDecision(scope, "EVIDENCE_STALE_OR_INVALID", evaluatedTimestamp);
  }
  const providerFailedAt = evidenceInstant(businessEvidence.provider?.lastFailedAt);
  if (providerFailedAt && providerFailedAt.getTime() >= verifiedAt.getTime()) {
    return rejectedDecision(scope, "PROVIDER_FAILURE_CURRENT", evaluatedTimestamp);
  }
  if (businessEvidence.targetProfile?.matches !== true) {
    return rejectedDecision(scope, "TARGET_PROFILE_MISMATCH", evaluatedTimestamp);
  }
  if (!["HIGH", "MEDIUM"].includes(businessEvidence.evidenceQuality?.confidence)
    || businessEvidence.evidenceQuality?.state !== "VERIFIED"
    || !safeReason(businessEvidence.recommendationReason)) {
    return rejectedDecision(scope, "EVIDENCE_QUALITY_INSUFFICIENT", evaluatedTimestamp);
  }

  return deepFreeze({
    version: routeIqPaidCustomerIntelligenceVersion,
    status: "ADMISSION_ELIGIBLE",
    reasonCode: "ALL_GOVERNED_GATES_PASSED",
    companyId: scope.companyId,
    workspaceId: scope.workspaceId,
    configurationVersion: scope.configurationVersion,
    businessId,
    territoryId,
    categoryId,
    recommendationAdmissionEligible: true,
    representativeRoutingEligible: false,
    recommendationInfluence: "OFF",
    routeOrderingChanged: false,
    routeScoringWeightsChanged: false,
    validationOnly: true,
    candidateDisclosed: true,
    evaluatedAt: evaluatedTimestamp
  });
}

export function createPaidCustomerMetricLabelSnapshot({
  paidCustomerScope,
  effectiveAt
} = {}) {
  if (!paidCustomerScope
    || !authorizedScopes.has(paidCustomerScope)
    || paidCustomerScope.operation !== paidCustomerIntelligenceOperations.configurationPreview) {
    throw new Error("Paid-customer Intelligence metric snapshot scope is denied.");
  }
  const timestamp = cleanTimestamp(effectiveAt, "metric snapshot time");
  const definitions = scopeMetadata.get(paidCustomerScope).metricCatalog.map(definition => ({
    metricId: definition.metricId,
    semanticVersion: definition.semanticVersion,
    historyIdentity: definition.historyIdentity,
    displayTermId: definition.displayTermId,
    fallbackKind: definition.fallbackKind,
    labels: {
      singular: definition.labels.singular,
      plural: definition.labels.plural
    }
  }));
  return deepFreeze({
    schemaVersion: routeIqMetricLabelSnapshotVersion,
    companyId: paidCustomerScope.companyId,
    workspaceId: paidCustomerScope.workspaceId,
    configurationVersion: paidCustomerScope.configurationVersion,
    effectiveAt: timestamp,
    definitions
  });
}

export function resolvePaidCustomerMetricLabel({
  metricId,
  count,
  labelSnapshot,
  fallbackKind = "outcome"
} = {}) {
  const normalizedMetricId = cleanIdentifier(metricId, "metric identifier");
  const numericCount = Number(count);
  if (!Number.isFinite(numericCount)) {
    throw new Error("Paid-customer Intelligence metric count is invalid.");
  }
  const definition = labelSnapshot?.schemaVersion === routeIqMetricLabelSnapshotVersion
    ? labelSnapshot.definitions?.find(item => item?.metricId === normalizedMetricId)
    : null;
  if (definition) {
    return deepFreeze({
      metricId: normalizedMetricId,
      label: numericCount === 1 ? definition.labels.singular : definition.labels.plural,
      labelSource: "HISTORICAL_SNAPSHOT"
    });
  }
  const normalizedFallbackKind = cleanIdentifier(fallbackKind, "metric fallback kind");
  const fallback = controlledFallbackLabels[normalizedFallbackKind];
  if (!fallback) {
    throw new Error("Paid-customer Intelligence metric fallback kind is unsupported.");
  }
  return deepFreeze({
    metricId: normalizedMetricId,
    label: numericCount === 1 ? fallback.singular : fallback.plural,
    labelSource: "CONTROLLED_GENERIC_FALLBACK"
  });
}

const commonMetricIds = Object.freeze({
  activity: "metric_primary_activity",
  conversion: "metric_conversion_event",
  outcome: "metric_primary_outcome"
});

function industryTemplate(templateId, labels) {
  return {
    templateId,
    schemaVersion: "route-iq-paid-customer-industry-template-v1",
    metrics: [
      {
        metricId: commonMetricIds.activity,
        fallbackKind: "activity",
        labels: labels.activity
      },
      {
        metricId: commonMetricIds.conversion,
        fallbackKind: "conversion",
        labels: labels.conversion
      },
      {
        metricId: commonMetricIds.outcome,
        fallbackKind: "outcome",
        labels: labels.outcome
      }
    ]
  };
}

export const routeIqPaidCustomerIndustryTemplates = deepFreeze([
  industryTemplate("gym_sales", {
    activity: { singular: "Tour", plural: "Tours" },
    outcome: { singular: "Enrollment", plural: "Enrollments" },
    conversion: { singular: "Membership", plural: "Memberships" }
  }),
  industryTemplate("medical_business_development", {
    activity: { singular: "Facility Visit", plural: "Facility Visits" },
    outcome: { singular: "Referral", plural: "Referrals" },
    conversion: { singular: "Partnership", plural: "Partnerships" }
  }),
  industryTemplate("security_services", {
    activity: { singular: "Assessment", plural: "Assessments" },
    outcome: { singular: "Proposal", plural: "Proposals" },
    conversion: { singular: "Contract", plural: "Contracts" }
  }),
  industryTemplate("franchise_development", {
    activity: { singular: "Discovery Call", plural: "Discovery Calls" },
    outcome: { singular: "Application", plural: "Applications" },
    conversion: { singular: "Candidate", plural: "Candidates" }
  }),
  industryTemplate("merchant_payroll_services", {
    activity: { singular: "Appointment", plural: "Appointments" },
    outcome: { singular: "Application", plural: "Applications" },
    conversion: { singular: "Account", plural: "Accounts" }
  }),
  industryTemplate("commercial_distribution", {
    activity: { singular: "Sample", plural: "Samples" },
    outcome: { singular: "Purchase Order", plural: "Purchase Orders" },
    conversion: { singular: "Buyer", plural: "Buyers" }
  })
]);
