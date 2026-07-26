export const routeIqPaidCustomerIntelligenceVersion = "route-iq-paid-customer-intelligence-v1";
export const routeIqPaidCustomerOnboardingVersion = "route-iq-paid-customer-onboarding-v1";
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
const metricIdentifierPattern = /^metric_[a-z][a-z0-9_]{2,63}$/;
const categoryIdentifierPattern = /^category_[a-z][a-z0-9_]{2,63}$/;
const zipCodePattern = /^\d{5}$/;
const dangerousLabelPattern = /[<>{}`$\\]|(?:javascript|data|vbscript)\s*:/iu;
const controlCharacterPattern = /[\u0000-\u001F\u007F]/gu;
const activePreviewStates = new Set([
  "VALIDATED",
  "PREVIEW_READY",
  "AWAITING_APPROVAL",
  "READY_FOR_ACTIVATION"
]);
const authorizedOperationsByRole = Object.freeze({
  founder: Object.freeze([
    paidCustomerIntelligenceOperations.recommendationAdmission,
    paidCustomerIntelligenceOperations.configurationPreview
  ]),
  manager: Object.freeze([
    paidCustomerIntelligenceOperations.recommendationAdmission,
    paidCustomerIntelligenceOperations.configurationPreview
  ]),
  representative: Object.freeze([
    paidCustomerIntelligenceOperations.recommendationAdmission
  ]),
  auditor: Object.freeze([
    paidCustomerIntelligenceOperations.configurationPreview
  ])
});
const controlledFallbackLabels = Object.freeze({
  activity: Object.freeze({ singular: "Activity", plural: "Activities" }),
  conversion: Object.freeze({ singular: "Conversion", plural: "Conversions" }),
  follow_up: Object.freeze({ singular: "Follow-up", plural: "Follow-ups" }),
  goal: Object.freeze({ singular: "Goal", plural: "Goals" }),
  outcome: Object.freeze({ singular: "Outcome", plural: "Outcomes" })
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

function normalizeMetricDefinition(definition) {
  if (!isRecord(definition)) {
    throw new Error("Paid-customer Intelligence metric definition is invalid.");
  }
  const metricId = cleanIdentifier(definition.metricId, "metric identifier", metricIdentifierPattern);
  const fallbackKind = cleanIdentifier(definition.fallbackKind, "metric fallback kind");
  if (!Object.hasOwn(controlledFallbackLabels, fallbackKind)) {
    throw new Error("Paid-customer Intelligence metric fallback kind is unsupported.");
  }
  return {
    metricId,
    fallbackKind,
    singular: safeDisplayLabel(definition.labels?.singular, "metric singular label"),
    plural: safeDisplayLabel(definition.labels?.plural, "metric plural label")
  };
}

export function normalizePaidCustomerMetricCatalog(definitions) {
  if (!Array.isArray(definitions) || definitions.length === 0) {
    throw new Error("Paid-customer Intelligence metric catalog is missing.");
  }
  const normalized = definitions.map(normalizeMetricDefinition).sort((left, right) =>
    left.metricId.localeCompare(right.metricId)
  );
  if (new Set(normalized.map(item => item.metricId)).size !== normalized.length) {
    throw new Error("Paid-customer Intelligence metric identifiers must be unique.");
  }
  return deepFreeze(normalized.map(item => ({
    metricId: item.metricId,
    fallbackKind: item.fallbackKind,
    labels: {
      singular: item.singular,
      plural: item.plural
    }
  })));
}

function validateSafetyBoundary(configuration, errors) {
  const safety = configuration?.safety;
  for (const [key, expected] of Object.entries(paidCustomerIntelligenceSafety)) {
    if (safety?.[key] !== expected) errors.push(`safety.${key}`);
  }
}

function validateTerritories(configuration, errors) {
  if (!Array.isArray(configuration?.territories) || configuration.territories.length === 0) {
    errors.push("territories");
    return;
  }
  const territoryIds = new Set();
  for (const territory of configuration.territories) {
    try {
      const territoryId = cleanIdentifier(territory?.territoryId, "territory identifier");
      if (territoryIds.has(territoryId)) errors.push("territories.duplicateTerritoryId");
      territoryIds.add(territoryId);
      if (territory?.authorized !== true) errors.push("territories.authorized");
      if (!Array.isArray(territory?.zipCodes) || territory.zipCodes.length === 0
        || territory.zipCodes.some(zip => !zipCodePattern.test(String(zip)))) {
        errors.push("territories.zipCodes");
      }
    } catch {
      errors.push("territories.territoryId");
    }
  }
}

function validateTargeting(configuration, errors) {
  try {
    const included = uniqueIdentifiers(
      configuration?.targeting?.includedCategoryIds,
      "included category",
      categoryIdentifierPattern
    );
    const excluded = uniqueIdentifiers(
      configuration?.targeting?.excludedCategoryIds,
      "excluded category",
      categoryIdentifierPattern
    );
    uniqueIdentifiers(configuration?.targeting?.excludedBusinessIds, "excluded business");
    if (included.length === 0 || included.some(value => excluded.includes(value))) {
      errors.push("targeting.categories");
    }
  } catch {
    errors.push("targeting");
  }
}

export function validatePaidCustomerIntelligenceOnboarding(configuration) {
  const errors = [];
  if (!isRecord(configuration)) return ["configuration"];
  if (configuration.schemaVersion !== routeIqPaidCustomerOnboardingVersion) errors.push("schemaVersion");
  if (configuration.authority !== "prometheus_administration") errors.push("authority");
  try {
    const companyId = cleanIdentifier(configuration.scope?.companyId, "company identity");
    const workspaceId = cleanIdentifier(configuration.scope?.workspaceId, "workspace identity");
    if (configuration.scope?.immutable !== true
      || configuration.company?.companyId !== companyId
      || configuration.workspace?.workspaceId !== workspaceId
      || configuration.workspace?.companyId !== companyId) {
      errors.push("scope");
    }
    cleanIdentifier(configuration.configurationVersion, "configuration version");
  } catch {
    errors.push("identity");
  }
  if (!activePreviewStates.has(configuration.lifecycle?.state)
    || configuration.lifecycle?.customerActivated !== false) {
    errors.push("lifecycle");
  }
  validateSafetyBoundary(configuration, errors);
  validateTerritories(configuration, errors);
  validateTargeting(configuration, errors);
  if (!Number.isInteger(configuration?.freshnessPolicy?.maximumAgeHours)
    || configuration.freshnessPolicy.maximumAgeHours < 1
    || configuration.freshnessPolicy.maximumAgeHours > 24
    || configuration.freshnessPolicy.providerFailureFailsClosed !== true) {
    errors.push("freshnessPolicy");
  }
  try {
    normalizePaidCustomerMetricCatalog(configuration.metrics);
  } catch {
    errors.push("metrics");
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
  const companyId = onboardingConfiguration.scope.companyId;
  const workspaceId = onboardingConfiguration.scope.workspaceId;
  const normalizedOperation = String(operation ?? "").trim();
  const role = String(principal?.role ?? "").trim();
  if (principal?.authority !== "server_authenticated_principal"
    || principal?.authenticated !== true
    || principal?.companyId !== companyId
    || principal?.workspaceId !== workspaceId
    || !authorizedOperationsByRole[role]?.includes(normalizedOperation)) {
    throw new Error("Paid-customer Intelligence scope is denied.");
  }

  const metricCatalog = normalizePaidCustomerMetricCatalog(onboardingConfiguration.metrics);
  const scope = deepFreeze({
    version: routeIqPaidCustomerIntelligenceVersion,
    companyId,
    workspaceId,
    configurationVersion: onboardingConfiguration.configurationVersion,
    role,
    operation: normalizedOperation,
    recommendationInfluence: "OFF",
    customerActivation: "OFF"
  });
  const territoryMetadata = new Map(onboardingConfiguration.territories.map(territory => [
    territory.territoryId,
    {
      zipCodes: new Set(territory.zipCodes.map(String)),
      cities: new Set((territory.cities || []).map(value => String(value).trim().toLowerCase()))
    }
  ]));
  authorizedScopes.add(scope);
  scopeMetadata.set(scope, {
    territoryMetadata,
    includedCategoryIds: new Set(onboardingConfiguration.targeting.includedCategoryIds),
    excludedCategoryIds: new Set(onboardingConfiguration.targeting.excludedCategoryIds),
    excludedBusinessIds: new Set(onboardingConfiguration.targeting.excludedBusinessIds),
    maximumAgeHours: onboardingConfiguration.freshnessPolicy.maximumAgeHours,
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
    categoryId = cleanIdentifier(
      businessEvidence.categoryId,
      "business category",
      categoryIdentifierPattern
    );
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
  const normalizedMetricId = cleanIdentifier(metricId, "metric identifier", metricIdentifierPattern);
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
