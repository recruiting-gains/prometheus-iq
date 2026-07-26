import { createHash } from "node:crypto";

export const routeIqVerifiedBusinessEvidenceVersion =
  "route-iq-verified-business-evidence-v1";
export const routeIqVerifiedBusinessNormalizedVersion =
  "route-iq-verified-business-normalized-v1";
export const routeIqVerifiedBusinessEligibilityPolicyVersion =
  "route-iq-verified-business-eligibility-policy-v1";
export const routeIqVerifiedBusinessStorageVersion =
  "route-iq-verified-business-storage-record-v1";
export const routeIqVerifiedBusinessAuditVersion =
  "route-iq-verified-business-audit-record-v1";

export const routeIqVerifiedBusinessIneligibilityReasons = Object.freeze([
  "IDENTITY_UNVERIFIED",
  "ADDRESS_UNVERIFIED",
  "EVIDENCE_CONFLICTING",
  "TERRITORY_UNAUTHORIZED",
  "POSTAL_CODE_UNAUTHORIZED",
  "CATEGORY_UNVERIFIED",
  "CATEGORY_NOT_INCLUDED",
  "CUSTOMER_EXCLUDED_CATEGORY",
  "CUSTOMER_EXCLUDED_BUSINESS",
  "OPERATING_STATUS_UNVERIFIED",
  "BUSINESS_CLOSED",
  "HOURS_MISSING",
  "HOURS_STALE",
  "HOURS_CLOSED",
  "HOURS_CONFLICTING",
  "PROVIDER_FAILED",
  "SOURCE_UNVERIFIED",
  "DUPLICATE_UNRESOLVED",
  "NONCANONICAL_DUPLICATE",
  "TARGET_PROFILE_MISMATCH",
  "TARGET_PROFILE_UNVERIFIED",
  "RECOMMENDATION_REASON_MISSING",
  "EVIDENCE_QUALITY_INSUFFICIENT"
]);

const ID_PATTERN = /^[a-z][a-z0-9_]{2,127}$/u;
const EVIDENCE_ID_PATTERN = /^riq_business_evidence_[a-f0-9]{24}$/u;
const EVENT_ID_PATTERN = /^riq_business_audit_[a-f0-9]{24}$/u;
const POLICY_VERSION_PATTERN = /^v[1-9][0-9]{0,8}$/u;
const POSTAL_CODE_PATTERN = /^[A-Z0-9][A-Z0-9 -]{1,11}$/u;
const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/u;
const REASON_CODE_PATTERN = /^[a-z][a-z0-9_]{2,127}$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const FORBIDDEN_TEXT_PATTERN = /[\u0000-\u001f\u007f<>]/u;
const HOUR_MS = 60 * 60 * 1000;

const VERIFICATION_STATES = new Set([
  "VERIFIED",
  "MISSING",
  "CONFLICTING",
  "INVALID"
]);
const OPERATING_STATES = new Set(["OPEN", "CLOSED", "UNKNOWN", "CONFLICTING"]);
const HOURS_STATES = new Set([
  "OPEN_VERIFIED",
  "CLOSED_VERIFIED",
  "STALE",
  "MISSING",
  "CONFLICTING",
  "PROVIDER_FAILED"
]);
const SOURCE_TYPES = new Set([
  "GOVERNED_PROVIDER",
  "CUSTOMER_AUTHORIZED_SOURCE",
  "FIELD_VERIFICATION",
  "SYNTHETIC_FIXTURE"
]);
const PROVIDER_STATES = new Set(["SUCCEEDED", "FAILED", "NOT_APPLICABLE"]);
const DUPLICATE_STATES = new Set([
  "UNIQUE",
  "DUPLICATE_RESOLVED",
  "DUPLICATE_UNRESOLVED",
  "CONFLICTING"
]);
const TARGET_STATES = new Set(["MATCH", "NO_MATCH", "UNVERIFIED", "CONFLICTING"]);
const EVIDENCE_QUALITIES = Object.freeze(["NONE", "LOW", "MEDIUM", "HIGH"]);
const EVIDENCE_QUALITY_RANK = new Map(
  EVIDENCE_QUALITIES.map((quality, index) => [quality, index])
);
const AUDIT_EVENT_TYPES = new Set([
  "EVIDENCE_NORMALIZED",
  "EVIDENCE_STORED",
  "EVIDENCE_REJECTED",
  "EVIDENCE_REEVALUATED"
]);
const AUDIT_OUTCOMES = new Set(["ACCEPTED", "INELIGIBLE", "REJECTED"]);
const AUDIT_ACTOR_TYPES = new Set([
  "PROMETHEUS_DATA",
  "GOVERNED_PROVIDER",
  "AUTHORIZED_OPERATOR"
]);

export class RouteIqPaidCustomerDataError extends Error {
  constructor(message, code = "route_iq_paid_customer_data_invalid", details = {}) {
    super(message);
    this.name = "RouteIqPaidCustomerDataError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new RouteIqPaidCustomerDataError(message, code, details);
}

function clone(value) {
  return structuredClone(value);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map(key => [key, canonicalize(value[key])])
  );
}

export function stableRouteIqVerifiedBusinessJson(value) {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
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
      missingFieldCount: missing.length,
      unknownFieldCount: unknown.length
    });
  }
}

function assertId(value, scope) {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) {
    fail("route_iq_paid_customer_identifier_invalid", `${scope} is invalid.`);
  }
}

function assertTimestamp(value, scope, { nullable = false } = {}) {
  if (nullable && value === null) return null;
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    fail("route_iq_paid_customer_timestamp_invalid", `${scope} must be an ISO timestamp.`);
  }
  return Date.parse(value);
}

function assertSafeText(value, scope, { nullable = false, maxLength = 240 } = {}) {
  if (nullable && value === null) return;
  if (typeof value !== "string"
    || !value.trim()
    || value.length > maxLength
    || FORBIDDEN_TEXT_PATTERN.test(value)) {
    fail("route_iq_paid_customer_text_invalid", `${scope} contains unsafe text.`);
  }
}

function assertBoolean(value, scope) {
  if (typeof value !== "boolean") {
    fail("route_iq_paid_customer_boolean_invalid", `${scope} must be boolean.`);
  }
}

function assertReasonCode(value, scope, { nullable = false } = {}) {
  if (nullable && value === null) return;
  if (typeof value !== "string" || !REASON_CODE_PATTERN.test(value)) {
    fail("route_iq_paid_customer_reason_invalid", `${scope} is invalid.`);
  }
}

function normalizePostalCode(value, scope) {
  if (typeof value !== "string") {
    fail("route_iq_paid_customer_postal_code_invalid", `${scope} is invalid.`);
  }
  const normalized = value.trim().replace(/\s+/gu, " ").toUpperCase();
  if (!POSTAL_CODE_PATTERN.test(normalized)) {
    fail("route_iq_paid_customer_postal_code_invalid", `${scope} is invalid.`);
  }
  return normalized;
}

function uniqueSortedIds(values, scope) {
  if (!Array.isArray(values)) {
    fail("route_iq_paid_customer_list_invalid", `${scope} must be an array.`);
  }
  const normalized = values.map((value, index) => {
    assertId(value, `${scope}[${index}]`);
    return value;
  });
  if (new Set(normalized).size !== normalized.length) {
    fail("route_iq_paid_customer_duplicate_identifier", `${scope} contains duplicates.`);
  }
  return normalized.toSorted();
}

function validateScope(scope, label = "scope") {
  assertExactKeys(scope, ["companyId", "workspaceId"], label);
  assertId(scope.companyId, `${label}.companyId`);
  assertId(scope.workspaceId, `${label}.workspaceId`);
  return {
    companyId: scope.companyId,
    workspaceId: scope.workspaceId
  };
}

function assertSameScope(left, right, code = "route_iq_paid_customer_scope_unauthorized") {
  if (left.companyId !== right.companyId || left.workspaceId !== right.workspaceId) {
    fail(code, "The requested company/workspace scope is unauthorized.");
  }
}

export function validateRouteIqVerifiedBusinessEligibilityPolicy(policy) {
  assertExactKeys(policy, [
    "schemaVersion",
    "policyId",
    "policyVersion",
    "companyId",
    "workspaceId",
    "authorizedTerritories",
    "includedCategoryIds",
    "excludedCategoryIds",
    "excludedBusinessIds",
    "maximumFreshnessHours",
    "minimumEvidenceQuality"
  ], "eligibilityPolicy");
  if (policy.schemaVersion !== routeIqVerifiedBusinessEligibilityPolicyVersion) {
    fail("route_iq_paid_customer_policy_version_unsupported", "Eligibility policy version is unsupported.");
  }
  assertId(policy.policyId, "eligibilityPolicy.policyId");
  if (typeof policy.policyVersion !== "string"
    || !POLICY_VERSION_PATTERN.test(policy.policyVersion)) {
    fail("route_iq_paid_customer_policy_version_invalid", "Eligibility policy version is invalid.");
  }
  assertId(policy.companyId, "eligibilityPolicy.companyId");
  assertId(policy.workspaceId, "eligibilityPolicy.workspaceId");
  if (!Array.isArray(policy.authorizedTerritories) || policy.authorizedTerritories.length === 0) {
    fail("route_iq_paid_customer_territory_policy_invalid", "At least one territory is required.");
  }
  const territoryIds = new Set();
  const authorizedTerritories = policy.authorizedTerritories.map((territory, index) => {
    const scope = `eligibilityPolicy.authorizedTerritories[${index}]`;
    assertExactKeys(territory, ["territoryId", "postalCodes"], scope);
    assertId(territory.territoryId, `${scope}.territoryId`);
    if (territoryIds.has(territory.territoryId)) {
      fail("route_iq_paid_customer_territory_policy_invalid", "Territory identities must be unique.");
    }
    territoryIds.add(territory.territoryId);
    if (!Array.isArray(territory.postalCodes) || territory.postalCodes.length === 0) {
      fail("route_iq_paid_customer_territory_policy_invalid", `${scope} requires postal codes.`);
    }
    const postalCodes = territory.postalCodes.map((postalCode, postalIndex) =>
      normalizePostalCode(postalCode, `${scope}.postalCodes[${postalIndex}]`)
    );
    if (new Set(postalCodes).size !== postalCodes.length) {
      fail("route_iq_paid_customer_territory_policy_invalid", `${scope} has duplicate postal codes.`);
    }
    return {
      territoryId: territory.territoryId,
      postalCodes: postalCodes.toSorted()
    };
  }).toSorted((left, right) => left.territoryId.localeCompare(right.territoryId));
  const includedCategoryIds = uniqueSortedIds(
    policy.includedCategoryIds,
    "eligibilityPolicy.includedCategoryIds"
  );
  if (includedCategoryIds.length === 0) {
    fail("route_iq_paid_customer_category_policy_invalid", "At least one included category is required.");
  }
  const excludedCategoryIds = uniqueSortedIds(
    policy.excludedCategoryIds,
    "eligibilityPolicy.excludedCategoryIds"
  );
  const excludedBusinessIds = uniqueSortedIds(
    policy.excludedBusinessIds,
    "eligibilityPolicy.excludedBusinessIds"
  );
  if (includedCategoryIds.some(categoryId => excludedCategoryIds.includes(categoryId))) {
    fail("route_iq_paid_customer_category_policy_conflict", "Included and excluded categories overlap.");
  }
  if (!Number.isInteger(policy.maximumFreshnessHours)
    || policy.maximumFreshnessHours < 1
    || policy.maximumFreshnessHours > 24) {
    fail(
      "route_iq_paid_customer_freshness_policy_invalid",
      "Freshness must be an explicit integer from one through twenty-four hours."
    );
  }
  if (!["LOW", "MEDIUM", "HIGH"].includes(policy.minimumEvidenceQuality)) {
    fail("route_iq_paid_customer_evidence_quality_policy_invalid", "Minimum evidence quality is invalid.");
  }
  return deepFreeze({
    schemaVersion: routeIqVerifiedBusinessEligibilityPolicyVersion,
    policyId: policy.policyId,
    policyVersion: policy.policyVersion,
    companyId: policy.companyId,
    workspaceId: policy.workspaceId,
    authorizedTerritories,
    includedCategoryIds,
    excludedCategoryIds,
    excludedBusinessIds,
    maximumFreshnessHours: policy.maximumFreshnessHours,
    minimumEvidenceQuality: policy.minimumEvidenceQuality
  });
}

function validateEvidenceIdentity(identity) {
  assertExactKeys(
    identity,
    ["legalName", "sourceIdentityId", "verificationState"],
    "evidence.identity"
  );
  assertSafeText(identity.legalName, "evidence.identity.legalName", {
    nullable: true,
    maxLength: 180
  });
  assertSafeText(identity.sourceIdentityId, "evidence.identity.sourceIdentityId", {
    nullable: true,
    maxLength: 180
  });
  if (!VERIFICATION_STATES.has(identity.verificationState)) {
    fail("route_iq_paid_customer_identity_state_invalid", "Identity verification state is invalid.");
  }
  if (identity.verificationState === "VERIFIED"
    && (identity.legalName === null || identity.sourceIdentityId === null)) {
    fail("route_iq_paid_customer_identity_invalid", "Verified identity evidence is incomplete.");
  }
}

function validateEvidenceAddress(address) {
  assertExactKeys(address, [
    "line1",
    "line2",
    "locality",
    "region",
    "postalCode",
    "countryCode",
    "latitude",
    "longitude",
    "verificationState"
  ], "evidence.address");
  for (const [key, maxLength] of [
    ["line1", 180],
    ["locality", 100],
    ["region", 100]
  ]) {
    assertSafeText(address[key], `evidence.address.${key}`, {
      nullable: true,
      maxLength
    });
  }
  assertSafeText(address.line2, "evidence.address.line2", {
    nullable: true,
    maxLength: 180
  });
  if (address.postalCode !== null) {
    normalizePostalCode(address.postalCode, "evidence.address.postalCode");
  }
  if (address.countryCode !== null
    && (typeof address.countryCode !== "string"
      || !COUNTRY_CODE_PATTERN.test(address.countryCode))) {
    fail("route_iq_paid_customer_country_code_invalid", "Address country code is invalid.");
  }
  if (address.latitude !== null
    && (!Number.isFinite(address.latitude)
      || address.latitude < -90
      || address.latitude > 90)) {
    fail("route_iq_paid_customer_coordinate_invalid", "Address latitude is invalid.");
  }
  if (address.longitude !== null
    && (!Number.isFinite(address.longitude)
      || address.longitude < -180
      || address.longitude > 180)) {
    fail("route_iq_paid_customer_coordinate_invalid", "Address longitude is invalid.");
  }
  if (!VERIFICATION_STATES.has(address.verificationState)) {
    fail("route_iq_paid_customer_address_state_invalid", "Address verification state is invalid.");
  }
  if (address.verificationState === "VERIFIED"
    && [
      address.line1,
      address.locality,
      address.region,
      address.postalCode,
      address.countryCode
    ].some(value => value === null)) {
    fail("route_iq_paid_customer_address_invalid", "Verified address evidence is incomplete.");
  }
}

function validateEvidenceTerritory(territory) {
  assertExactKeys(territory, ["territoryId", "postalCode"], "evidence.territory");
  assertId(territory.territoryId, "evidence.territory.territoryId");
  normalizePostalCode(territory.postalCode, "evidence.territory.postalCode");
}

function validateEvidenceCategory(category) {
  assertExactKeys(category, ["categoryId", "verificationState"], "evidence.category");
  assertId(category.categoryId, "evidence.category.categoryId");
  if (!VERIFICATION_STATES.has(category.verificationState)) {
    fail("route_iq_paid_customer_category_state_invalid", "Category verification state is invalid.");
  }
}

function validateOperatingStatus(operatingStatus) {
  assertExactKeys(operatingStatus, ["state", "verifiedAt"], "evidence.operatingStatus");
  if (!OPERATING_STATES.has(operatingStatus.state)) {
    fail("route_iq_paid_customer_operating_state_invalid", "Operating state is invalid.");
  }
  assertTimestamp(operatingStatus.verifiedAt, "evidence.operatingStatus.verifiedAt", {
    nullable: true
  });
  if (["OPEN", "CLOSED"].includes(operatingStatus.state)
    && operatingStatus.verifiedAt === null) {
    fail("route_iq_paid_customer_operating_status_invalid", "Verified operating status needs a timestamp.");
  }
}

function validateHours(hours) {
  assertExactKeys(hours, [
    "state",
    "timeZone",
    "weeklyScheduleVersion",
    "verifiedAt",
    "expiresAt",
    "providerFailure"
  ], "evidence.hours");
  if (!HOURS_STATES.has(hours.state)) {
    fail("route_iq_paid_customer_hours_state_invalid", "Hours state is invalid.");
  }
  assertSafeText(hours.timeZone, "evidence.hours.timeZone", {
    nullable: true,
    maxLength: 80
  });
  assertSafeText(hours.weeklyScheduleVersion, "evidence.hours.weeklyScheduleVersion", {
    nullable: true,
    maxLength: 120
  });
  assertTimestamp(hours.verifiedAt, "evidence.hours.verifiedAt", { nullable: true });
  assertTimestamp(hours.expiresAt, "evidence.hours.expiresAt", { nullable: true });
  assertBoolean(hours.providerFailure, "evidence.hours.providerFailure");
  if (["OPEN_VERIFIED", "CLOSED_VERIFIED"].includes(hours.state)
    && [
      hours.timeZone,
      hours.weeklyScheduleVersion,
      hours.verifiedAt,
      hours.expiresAt
    ].some(value => value === null)) {
    fail("route_iq_paid_customer_hours_invalid", "Verified hours evidence is incomplete.");
  }
  if (hours.state === "PROVIDER_FAILED" && hours.providerFailure !== true) {
    fail("route_iq_paid_customer_hours_invalid", "Provider-failed hours must record provider failure.");
  }
}

function validateVerificationSource(source) {
  assertExactKeys(source, [
    "sourceId",
    "sourceType",
    "verificationState",
    "retrievedAt",
    "providerStatus",
    "provenanceVersion"
  ], "evidence.verificationSource");
  assertSafeText(source.sourceId, "evidence.verificationSource.sourceId", {
    maxLength: 180
  });
  if (!SOURCE_TYPES.has(source.sourceType)) {
    fail("route_iq_paid_customer_source_type_invalid", "Verification source type is invalid.");
  }
  if (!VERIFICATION_STATES.has(source.verificationState)) {
    fail("route_iq_paid_customer_source_state_invalid", "Verification source state is invalid.");
  }
  assertTimestamp(source.retrievedAt, "evidence.verificationSource.retrievedAt");
  if (!PROVIDER_STATES.has(source.providerStatus)) {
    fail("route_iq_paid_customer_provider_state_invalid", "Provider status is invalid.");
  }
  assertSafeText(source.provenanceVersion, "evidence.verificationSource.provenanceVersion", {
    maxLength: 120
  });
}

function validateDuplicateResolution(duplicateResolution) {
  assertExactKeys(
    duplicateResolution,
    ["state", "canonicalBusinessId", "relatedBusinessIds"],
    "evidence.duplicateResolution"
  );
  if (!DUPLICATE_STATES.has(duplicateResolution.state)) {
    fail("route_iq_paid_customer_duplicate_state_invalid", "Duplicate state is invalid.");
  }
  if (duplicateResolution.canonicalBusinessId !== null) {
    assertId(
      duplicateResolution.canonicalBusinessId,
      "evidence.duplicateResolution.canonicalBusinessId"
    );
  }
  uniqueSortedIds(
    duplicateResolution.relatedBusinessIds,
    "evidence.duplicateResolution.relatedBusinessIds"
  );
  if (duplicateResolution.state === "UNIQUE"
    && (duplicateResolution.canonicalBusinessId !== null
      || duplicateResolution.relatedBusinessIds.length !== 0)) {
    fail("route_iq_paid_customer_duplicate_resolution_invalid", "Unique evidence cannot name duplicates.");
  }
  if (duplicateResolution.state === "DUPLICATE_RESOLVED"
    && duplicateResolution.canonicalBusinessId === null) {
    fail(
      "route_iq_paid_customer_duplicate_resolution_invalid",
      "Resolved duplicates require a canonical business."
    );
  }
}

function validateTargetProfile(targetProfile) {
  assertExactKeys(targetProfile, ["state", "reasonCode"], "evidence.targetProfile");
  if (!TARGET_STATES.has(targetProfile.state)) {
    fail("route_iq_paid_customer_target_state_invalid", "Target-profile state is invalid.");
  }
  assertReasonCode(targetProfile.reasonCode, "evidence.targetProfile.reasonCode", {
    nullable: true
  });
  if (["MATCH", "NO_MATCH"].includes(targetProfile.state)
    && targetProfile.reasonCode === null) {
    fail("route_iq_paid_customer_target_invalid", "Verified target state needs a reason.");
  }
}

function validateRecommendationEvidence(recommendationEvidence) {
  assertExactKeys(
    recommendationEvidence,
    ["reasonCode", "evidenceQuality"],
    "evidence.recommendationEvidence"
  );
  assertReasonCode(
    recommendationEvidence.reasonCode,
    "evidence.recommendationEvidence.reasonCode",
    { nullable: true }
  );
  if (!EVIDENCE_QUALITY_RANK.has(recommendationEvidence.evidenceQuality)) {
    fail("route_iq_paid_customer_evidence_quality_invalid", "Evidence quality is invalid.");
  }
}

export function validateRouteIqVerifiedBusinessEvidence(evidence) {
  assertExactKeys(evidence, [
    "schemaVersion",
    "evidenceId",
    "companyId",
    "workspaceId",
    "businessId",
    "observedAt",
    "identity",
    "address",
    "territory",
    "category",
    "operatingStatus",
    "hours",
    "verificationSource",
    "duplicateResolution",
    "targetProfile",
    "recommendationEvidence"
  ], "evidence");
  if (evidence.schemaVersion !== routeIqVerifiedBusinessEvidenceVersion) {
    fail("route_iq_paid_customer_evidence_version_unsupported", "Evidence version is unsupported.");
  }
  if (typeof evidence.evidenceId !== "string"
    || !EVIDENCE_ID_PATTERN.test(evidence.evidenceId)) {
    fail("route_iq_paid_customer_evidence_id_invalid", "Evidence ID is invalid.");
  }
  assertId(evidence.companyId, "evidence.companyId");
  assertId(evidence.workspaceId, "evidence.workspaceId");
  assertId(evidence.businessId, "evidence.businessId");
  assertTimestamp(evidence.observedAt, "evidence.observedAt");
  validateEvidenceIdentity(evidence.identity);
  validateEvidenceAddress(evidence.address);
  validateEvidenceTerritory(evidence.territory);
  validateEvidenceCategory(evidence.category);
  validateOperatingStatus(evidence.operatingStatus);
  validateHours(evidence.hours);
  validateVerificationSource(evidence.verificationSource);
  validateDuplicateResolution(evidence.duplicateResolution);
  validateTargetProfile(evidence.targetProfile);
  validateRecommendationEvidence(evidence.recommendationEvidence);
  return deepFreeze(clone(evidence));
}

function addVerificationReasons(evidence, reasons) {
  if (evidence.identity.verificationState !== "VERIFIED") {
    reasons.add(
      evidence.identity.verificationState === "CONFLICTING"
        ? "EVIDENCE_CONFLICTING"
        : "IDENTITY_UNVERIFIED"
    );
  }
  if (evidence.address.verificationState !== "VERIFIED") {
    reasons.add(
      evidence.address.verificationState === "CONFLICTING"
        ? "EVIDENCE_CONFLICTING"
        : "ADDRESS_UNVERIFIED"
    );
  }
  if (evidence.category.verificationState !== "VERIFIED") {
    reasons.add(
      evidence.category.verificationState === "CONFLICTING"
        ? "EVIDENCE_CONFLICTING"
        : "CATEGORY_UNVERIFIED"
    );
  }
  if (evidence.verificationSource.verificationState !== "VERIFIED") {
    reasons.add(
      evidence.verificationSource.verificationState === "CONFLICTING"
        ? "EVIDENCE_CONFLICTING"
        : "SOURCE_UNVERIFIED"
    );
  }
  if (evidence.verificationSource.providerStatus === "FAILED") {
    reasons.add("PROVIDER_FAILED");
  }
}

function addPolicyReasons(evidence, policy, reasons) {
  const territory = policy.authorizedTerritories.find(
    candidate => candidate.territoryId === evidence.territory.territoryId
  );
  if (!territory) {
    reasons.add("TERRITORY_UNAUTHORIZED");
  } else if (!territory.postalCodes.includes(
    normalizePostalCode(evidence.territory.postalCode, "evidence.territory.postalCode")
  )) {
    reasons.add("POSTAL_CODE_UNAUTHORIZED");
  }
  if (evidence.address.postalCode !== null
    && normalizePostalCode(evidence.address.postalCode, "evidence.address.postalCode")
      !== normalizePostalCode(evidence.territory.postalCode, "evidence.territory.postalCode")) {
    reasons.add("EVIDENCE_CONFLICTING");
  }
  if (!policy.includedCategoryIds.includes(evidence.category.categoryId)) {
    reasons.add("CATEGORY_NOT_INCLUDED");
  }
  if (policy.excludedCategoryIds.includes(evidence.category.categoryId)) {
    reasons.add("CUSTOMER_EXCLUDED_CATEGORY");
  }
  if (policy.excludedBusinessIds.includes(evidence.businessId)) {
    reasons.add("CUSTOMER_EXCLUDED_BUSINESS");
  }
}

function addOperatingAndHoursReasons(evidence, policy, evaluatedAtMs, reasons) {
  if (evidence.operatingStatus.state === "CLOSED") {
    reasons.add("BUSINESS_CLOSED");
  } else if (evidence.operatingStatus.state === "CONFLICTING") {
    reasons.add("EVIDENCE_CONFLICTING");
  } else if (evidence.operatingStatus.state !== "OPEN") {
    reasons.add("OPERATING_STATUS_UNVERIFIED");
  }

  const hours = evidence.hours;
  if (hours.providerFailure || hours.state === "PROVIDER_FAILED") {
    reasons.add("PROVIDER_FAILED");
  }
  if (hours.state === "MISSING") reasons.add("HOURS_MISSING");
  if (hours.state === "STALE") reasons.add("HOURS_STALE");
  if (hours.state === "CLOSED_VERIFIED") reasons.add("HOURS_CLOSED");
  if (hours.state === "CONFLICTING") reasons.add("HOURS_CONFLICTING");
  if (hours.state === "OPEN_VERIFIED") {
    const verifiedAtMs = assertTimestamp(hours.verifiedAt, "evidence.hours.verifiedAt");
    const expiresAtMs = assertTimestamp(hours.expiresAt, "evidence.hours.expiresAt");
    if (verifiedAtMs > evaluatedAtMs
      || expiresAtMs <= verifiedAtMs
      || expiresAtMs - verifiedAtMs > policy.maximumFreshnessHours * HOUR_MS
      || evaluatedAtMs >= expiresAtMs
      || evaluatedAtMs - verifiedAtMs > policy.maximumFreshnessHours * HOUR_MS) {
      reasons.add("HOURS_STALE");
    }
  }
}

function addDuplicateAndTargetReasons(evidence, policy, reasons) {
  const duplicate = evidence.duplicateResolution;
  if (["DUPLICATE_UNRESOLVED", "CONFLICTING"].includes(duplicate.state)) {
    reasons.add(
      duplicate.state === "CONFLICTING"
        ? "EVIDENCE_CONFLICTING"
        : "DUPLICATE_UNRESOLVED"
    );
  }
  if (duplicate.state === "DUPLICATE_RESOLVED"
    && duplicate.canonicalBusinessId !== evidence.businessId) {
    reasons.add("NONCANONICAL_DUPLICATE");
  }
  if (evidence.targetProfile.state === "NO_MATCH") {
    reasons.add("TARGET_PROFILE_MISMATCH");
  } else if (evidence.targetProfile.state === "CONFLICTING") {
    reasons.add("EVIDENCE_CONFLICTING");
  } else if (evidence.targetProfile.state !== "MATCH") {
    reasons.add("TARGET_PROFILE_UNVERIFIED");
  }
  if (evidence.recommendationEvidence.reasonCode === null) {
    reasons.add("RECOMMENDATION_REASON_MISSING");
  }
  if (EVIDENCE_QUALITY_RANK.get(evidence.recommendationEvidence.evidenceQuality)
    < EVIDENCE_QUALITY_RANK.get(policy.minimumEvidenceQuality)) {
    reasons.add("EVIDENCE_QUALITY_INSUFFICIENT");
  }
}

export function normalizeRouteIqVerifiedBusinessEvidence(evidence, {
  policy,
  authorizedScope,
  evaluatedAt
}) {
  const validatedEvidence = validateRouteIqVerifiedBusinessEvidence(evidence);
  const validatedPolicy = validateRouteIqVerifiedBusinessEligibilityPolicy(policy);
  const validatedScope = validateScope(authorizedScope, "authorizedScope");
  const evaluatedAtMs = assertTimestamp(evaluatedAt, "evaluatedAt");
  assertSameScope(validatedEvidence, validatedScope);
  assertSameScope(validatedPolicy, validatedScope);

  const reasons = new Set();
  addVerificationReasons(validatedEvidence, reasons);
  addPolicyReasons(validatedEvidence, validatedPolicy, reasons);
  addOperatingAndHoursReasons(validatedEvidence, validatedPolicy, evaluatedAtMs, reasons);
  addDuplicateAndTargetReasons(validatedEvidence, validatedPolicy, reasons);
  if (Date.parse(validatedEvidence.observedAt) > evaluatedAtMs
    || Date.parse(validatedEvidence.verificationSource.retrievedAt) > evaluatedAtMs
    || (validatedEvidence.operatingStatus.verifiedAt !== null
      && Date.parse(validatedEvidence.operatingStatus.verifiedAt) > evaluatedAtMs)) {
    reasons.add("EVIDENCE_CONFLICTING");
  }

  const reasonCodes = routeIqVerifiedBusinessIneligibilityReasons.filter(reason =>
    reasons.has(reason)
  );
  const routeEligible = reasonCodes.length === 0;
  const policySnapshot = {
    schemaVersion: validatedPolicy.schemaVersion,
    policyId: validatedPolicy.policyId,
    policyVersion: validatedPolicy.policyVersion,
    companyId: validatedPolicy.companyId,
    workspaceId: validatedPolicy.workspaceId,
    authorizedTerritories: validatedPolicy.authorizedTerritories,
    includedCategoryIds: validatedPolicy.includedCategoryIds,
    excludedCategoryIds: validatedPolicy.excludedCategoryIds,
    excludedBusinessIds: validatedPolicy.excludedBusinessIds,
    maximumFreshnessHours: validatedPolicy.maximumFreshnessHours,
    minimumEvidenceQuality: validatedPolicy.minimumEvidenceQuality
  };
  const normalizedCore = {
    schemaVersion: routeIqVerifiedBusinessNormalizedVersion,
    sourceSchemaVersion: validatedEvidence.schemaVersion,
    evidenceId: validatedEvidence.evidenceId,
    companyId: validatedEvidence.companyId,
    workspaceId: validatedEvidence.workspaceId,
    businessId: validatedEvidence.businessId,
    observedAt: validatedEvidence.observedAt,
    evaluatedAt,
    identity: validatedEvidence.identity,
    address: {
      ...validatedEvidence.address,
      postalCode: validatedEvidence.address.postalCode === null
        ? null
        : normalizePostalCode(
          validatedEvidence.address.postalCode,
          "evidence.address.postalCode"
        )
    },
    territory: {
      ...validatedEvidence.territory,
      postalCode: normalizePostalCode(
        validatedEvidence.territory.postalCode,
        "evidence.territory.postalCode"
      )
    },
    category: validatedEvidence.category,
    operatingStatus: validatedEvidence.operatingStatus,
    hours: validatedEvidence.hours,
    verificationSource: validatedEvidence.verificationSource,
    duplicateResolution: {
      ...validatedEvidence.duplicateResolution,
      relatedBusinessIds: validatedEvidence.duplicateResolution.relatedBusinessIds.toSorted()
    },
    targetProfile: validatedEvidence.targetProfile,
    recommendationEvidence: validatedEvidence.recommendationEvidence,
    customerRules: policySnapshot,
    admission: {
      state: routeEligible ? "ELIGIBLE" : "INELIGIBLE",
      routeEligible,
      reasonCodes
    }
  };
  return deepFreeze({
    ...normalizedCore,
    evidenceFingerprintSha256: sha256(stableRouteIqVerifiedBusinessJson(normalizedCore))
  });
}

function validateNormalizedEvidence(normalized) {
  assertObject(normalized, "normalizedEvidence");
  if (normalized.schemaVersion !== routeIqVerifiedBusinessNormalizedVersion
    || !EVIDENCE_ID_PATTERN.test(normalized.evidenceId || "")
    || !SHA256_PATTERN.test(normalized.evidenceFingerprintSha256 || "")) {
    fail("route_iq_paid_customer_normalized_evidence_invalid", "Normalized evidence is invalid.");
  }
  assertId(normalized.companyId, "normalizedEvidence.companyId");
  assertId(normalized.workspaceId, "normalizedEvidence.workspaceId");
  assertId(normalized.businessId, "normalizedEvidence.businessId");
  assertObject(normalized.admission, "normalizedEvidence.admission");
  assertBoolean(normalized.admission.routeEligible, "normalizedEvidence.admission.routeEligible");
  if (!Array.isArray(normalized.admission.reasonCodes)
    || normalized.admission.reasonCodes.some(reason =>
      !routeIqVerifiedBusinessIneligibilityReasons.includes(reason)
    )
    || (normalized.admission.routeEligible && normalized.admission.reasonCodes.length !== 0)
    || (!normalized.admission.routeEligible && normalized.admission.reasonCodes.length === 0)) {
    fail("route_iq_paid_customer_admission_invalid", "Normalized admission is inconsistent.");
  }
}

export function buildRouteIqVerifiedBusinessStorageRecord(normalizedEvidence, {
  storedAt,
  idempotencyKey
}) {
  validateNormalizedEvidence(normalizedEvidence);
  assertTimestamp(storedAt, "storedAt");
  assertId(idempotencyKey, "idempotencyKey");
  const normalizedClone = clone(normalizedEvidence);
  const payloadSha256 = sha256(stableRouteIqVerifiedBusinessJson(normalizedClone));
  return deepFreeze({
    schemaVersion: routeIqVerifiedBusinessStorageVersion,
    companyId: normalizedClone.companyId,
    workspaceId: normalizedClone.workspaceId,
    businessId: normalizedClone.businessId,
    evidenceId: normalizedClone.evidenceId,
    storageKey: verifiedBusinessStorageKey(normalizedClone),
    storedAt,
    idempotencyKey,
    payloadSha256,
    routeEligible: normalizedClone.admission.routeEligible,
    reasonCodes: [...normalizedClone.admission.reasonCodes],
    normalizedEvidence: normalizedClone
  });
}

export function buildRouteIqVerifiedBusinessAuditRecord({
  eventId,
  companyId,
  workspaceId,
  businessId,
  evidenceId,
  eventType,
  occurredAt,
  actorType,
  outcome,
  reasonCodes,
  payloadSha256
}) {
  if (typeof eventId !== "string" || !EVENT_ID_PATTERN.test(eventId)) {
    fail("route_iq_paid_customer_audit_event_id_invalid", "Audit event ID is invalid.");
  }
  for (const [value, scope] of [
    [companyId, "audit.companyId"],
    [workspaceId, "audit.workspaceId"],
    [businessId, "audit.businessId"]
  ]) {
    assertId(value, scope);
  }
  if (typeof evidenceId !== "string" || !EVIDENCE_ID_PATTERN.test(evidenceId)) {
    fail("route_iq_paid_customer_evidence_id_invalid", "Audit evidence ID is invalid.");
  }
  if (!AUDIT_EVENT_TYPES.has(eventType)
    || !AUDIT_ACTOR_TYPES.has(actorType)
    || !AUDIT_OUTCOMES.has(outcome)) {
    fail("route_iq_paid_customer_audit_classification_invalid", "Audit classification is invalid.");
  }
  assertTimestamp(occurredAt, "audit.occurredAt");
  if (!Array.isArray(reasonCodes)
    || reasonCodes.some(reason => !routeIqVerifiedBusinessIneligibilityReasons.includes(reason))) {
    fail("route_iq_paid_customer_audit_reasons_invalid", "Audit reason codes are invalid.");
  }
  if (typeof payloadSha256 !== "string" || !SHA256_PATTERN.test(payloadSha256)) {
    fail("route_iq_paid_customer_audit_hash_invalid", "Audit payload hash is invalid.");
  }
  return deepFreeze({
    schemaVersion: routeIqVerifiedBusinessAuditVersion,
    eventId,
    companyId,
    workspaceId,
    businessId,
    evidenceId,
    eventType,
    occurredAt,
    actorType,
    outcome,
    reasonCodes: [...reasonCodes],
    payloadSha256,
    auditKey: verifiedBusinessAuditKey({ companyId, workspaceId, eventId })
  });
}

function verifiedBusinessStorageKey({
  companyId,
  workspaceId,
  businessId,
  evidenceId
}) {
  return [
    "route-iq",
    "paid-customer",
    "v1",
    "companies",
    companyId,
    "workspaces",
    workspaceId,
    "businesses",
    businessId,
    "evidence",
    evidenceId
  ].join("/");
}

function verifiedBusinessAuditKey({ companyId, workspaceId, eventId }) {
  return [
    "route-iq",
    "paid-customer",
    "v1",
    "companies",
    companyId,
    "workspaces",
    workspaceId,
    "audit",
    eventId
  ].join("/");
}

function validateStorageRecord(record) {
  assertExactKeys(record, [
    "schemaVersion",
    "companyId",
    "workspaceId",
    "businessId",
    "evidenceId",
    "storageKey",
    "storedAt",
    "idempotencyKey",
    "payloadSha256",
    "routeEligible",
    "reasonCodes",
    "normalizedEvidence"
  ], "storageRecord");
  if (record.schemaVersion !== routeIqVerifiedBusinessStorageVersion
    || !SHA256_PATTERN.test(record.payloadSha256 || "")) {
    fail("route_iq_paid_customer_storage_record_invalid", "Storage record is invalid.");
  }
  assertId(record.companyId, "storageRecord.companyId");
  assertId(record.workspaceId, "storageRecord.workspaceId");
  assertId(record.businessId, "storageRecord.businessId");
  if (!EVIDENCE_ID_PATTERN.test(record.evidenceId || "")) {
    fail("route_iq_paid_customer_evidence_id_invalid", "Storage evidence ID is invalid.");
  }
  assertTimestamp(record.storedAt, "storageRecord.storedAt");
  assertId(record.idempotencyKey, "storageRecord.idempotencyKey");
  assertBoolean(record.routeEligible, "storageRecord.routeEligible");
  if (!Array.isArray(record.reasonCodes)
    || new Set(record.reasonCodes).size !== record.reasonCodes.length
    || record.reasonCodes.some(reason =>
      !routeIqVerifiedBusinessIneligibilityReasons.includes(reason)
    )) {
    fail("route_iq_paid_customer_storage_record_invalid", "Storage reasons are invalid.");
  }
  validateNormalizedEvidence(record.normalizedEvidence);
  assertSameScope(record, record.normalizedEvidence, "route_iq_paid_customer_storage_scope_invalid");
  if (record.businessId !== record.normalizedEvidence.businessId
    || record.evidenceId !== record.normalizedEvidence.evidenceId
    || record.storageKey !== verifiedBusinessStorageKey(record)
    || record.routeEligible !== record.normalizedEvidence.admission.routeEligible
    || stableRouteIqVerifiedBusinessJson(record.reasonCodes)
      !== stableRouteIqVerifiedBusinessJson(record.normalizedEvidence.admission.reasonCodes)
    || record.payloadSha256
      !== sha256(stableRouteIqVerifiedBusinessJson(record.normalizedEvidence))) {
    fail("route_iq_paid_customer_storage_record_invalid", "Storage record integrity failed.");
  }
}

function validateAuditRecord(record) {
  assertExactKeys(record, [
    "schemaVersion",
    "eventId",
    "companyId",
    "workspaceId",
    "businessId",
    "evidenceId",
    "eventType",
    "occurredAt",
    "actorType",
    "outcome",
    "reasonCodes",
    "payloadSha256",
    "auditKey"
  ], "auditRecord");
  if (record.schemaVersion !== routeIqVerifiedBusinessAuditVersion
    || !EVENT_ID_PATTERN.test(record.eventId || "")
    || !SHA256_PATTERN.test(record.payloadSha256 || "")) {
    fail("route_iq_paid_customer_audit_record_invalid", "Audit record is invalid.");
  }
  assertId(record.companyId, "auditRecord.companyId");
  assertId(record.workspaceId, "auditRecord.workspaceId");
  assertId(record.businessId, "auditRecord.businessId");
  if (!EVIDENCE_ID_PATTERN.test(record.evidenceId || "")) {
    fail("route_iq_paid_customer_evidence_id_invalid", "Audit evidence ID is invalid.");
  }
  assertTimestamp(record.occurredAt, "auditRecord.occurredAt");
  if (!AUDIT_EVENT_TYPES.has(record.eventType)
    || !AUDIT_ACTOR_TYPES.has(record.actorType)
    || !AUDIT_OUTCOMES.has(record.outcome)
    || !Array.isArray(record.reasonCodes)
    || new Set(record.reasonCodes).size !== record.reasonCodes.length
    || record.reasonCodes.some(reason =>
      !routeIqVerifiedBusinessIneligibilityReasons.includes(reason)
    )
    || record.auditKey !== verifiedBusinessAuditKey(record)) {
    fail("route_iq_paid_customer_audit_record_invalid", "Audit record integrity failed.");
  }
}

export function createRouteIqVerifiedBusinessEvidenceStore() {
  const records = new Map();
  const auditRecords = new Map();

  function authorize(scope, authorization) {
    const requested = validateScope(scope, "requestedScope");
    const authorized = validateScope(authorization, "authorization");
    assertSameScope(requested, authorized);
    return requested;
  }

  function write({ authorization, storageRecord, auditRecord }) {
    validateStorageRecord(storageRecord);
    validateAuditRecord(auditRecord);
    const scope = authorize({
      companyId: storageRecord.companyId,
      workspaceId: storageRecord.workspaceId
    }, authorization);
    assertSameScope(auditRecord, scope, "route_iq_paid_customer_audit_scope_invalid");
    if (auditRecord.businessId !== storageRecord.businessId
      || auditRecord.evidenceId !== storageRecord.evidenceId
      || auditRecord.payloadSha256 !== storageRecord.payloadSha256
      || auditRecord.outcome !== (storageRecord.routeEligible ? "ACCEPTED" : "INELIGIBLE")
      || stableRouteIqVerifiedBusinessJson(auditRecord.reasonCodes)
        !== stableRouteIqVerifiedBusinessJson(storageRecord.reasonCodes)) {
      fail("route_iq_paid_customer_audit_binding_invalid", "Audit record is not bound to storage.");
    }
    const existing = records.get(storageRecord.storageKey);
    if (existing) {
      if (existing.idempotencyKey === storageRecord.idempotencyKey
        && existing.payloadSha256 === storageRecord.payloadSha256) {
        return deepFreeze({
          status: "ALREADY_ACCEPTED",
          companyId: scope.companyId,
          workspaceId: scope.workspaceId,
          businessId: storageRecord.businessId,
          evidenceId: storageRecord.evidenceId
        });
      }
      fail(
        "route_iq_paid_customer_storage_conflict",
        "A different payload or idempotency key already occupies this scoped record."
      );
    }
    if (auditRecords.has(auditRecord.auditKey)) {
      fail("route_iq_paid_customer_audit_conflict", "Audit records are append-only.");
    }
    records.set(storageRecord.storageKey, clone(storageRecord));
    auditRecords.set(auditRecord.auditKey, clone(auditRecord));
    return deepFreeze({
      status: "ACCEPTED",
      companyId: scope.companyId,
      workspaceId: scope.workspaceId,
      businessId: storageRecord.businessId,
      evidenceId: storageRecord.evidenceId
    });
  }

  function listWorkspaceRecords({ scope, authorization, routeEligibleOnly = false }) {
    const authorizedScope = authorize(scope, authorization);
    const values = [...records.values()].filter(record =>
      record.companyId === authorizedScope.companyId
      && record.workspaceId === authorizedScope.workspaceId
      && (!routeEligibleOnly || record.routeEligible)
    );
    return deepFreeze(values.map(clone));
  }

  function readBusinessRecord({ scope, authorization, businessId, evidenceId }) {
    const authorizedScope = authorize(scope, authorization);
    assertId(businessId, "businessId");
    if (typeof evidenceId !== "string" || !EVIDENCE_ID_PATTERN.test(evidenceId)) {
      fail("route_iq_paid_customer_evidence_id_invalid", "Evidence ID is invalid.");
    }
    const storageKey = verifiedBusinessStorageKey({
      companyId: authorizedScope.companyId,
      workspaceId: authorizedScope.workspaceId,
      businessId,
      evidenceId
    });
    const record = records.get(storageKey);
    return record ? deepFreeze(clone(record)) : null;
  }

  function listWorkspaceAudit({ scope, authorization }) {
    const authorizedScope = authorize(scope, authorization);
    return deepFreeze(
      [...auditRecords.values()]
        .filter(record =>
          record.companyId === authorizedScope.companyId
          && record.workspaceId === authorizedScope.workspaceId
        )
        .map(clone)
    );
  }

  return deepFreeze({
    write,
    listWorkspaceRecords,
    readBusinessRecord,
    listWorkspaceAudit
  });
}
