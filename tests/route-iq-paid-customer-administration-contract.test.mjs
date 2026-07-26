import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_AUTHORITY,
  ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_CONTRACT_VERSION,
  ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_SCHEMA_VERSION,
  RouteIqPaidCustomerOnboardingError,
  createRouteIqPaidCustomerConfigurationPreview,
  validateRouteIqPaidCustomerOnboardingConfiguration
} from "../administration/contracts/route-iq-paid-customer-onboarding-v1.mjs";

const fixtureDocument = JSON.parse(
  readFileSync(
    "administration/workspace-configurations/route-iq-paid-customer-synthetic-fixtures-v1.json",
    "utf8"
  )
);
const schema = JSON.parse(
  readFileSync(
    "administration/contracts/route-iq-paid-customer-onboarding-v1.schema.json",
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

const [securityConfiguration, distributionConfiguration] =
  fixtureDocument.configurations.map(validateRouteIqPaidCustomerOnboardingConfiguration);

test("paid-customer schema declares the complete explicit onboarding surface", () => {
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(
    schema.properties.schemaVersion.const,
    ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_SCHEMA_VERSION
  );
  assert.equal(
    schema.properties.contractVersion.const,
    ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_CONTRACT_VERSION
  );
  assert.deepEqual(
    new Set(schema.required),
    new Set([
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
    ])
  );
  assert.equal(schema.additionalProperties, false);
});

test("two unrelated synthetic companies validate without a customer-specific fork", () => {
  assert.equal(fixtureDocument.productionUseAuthorized, false);
  assert.equal(securityConfiguration.operatingProfile.industryTemplateId, "security_services");
  assert.equal(
    distributionConfiguration.operatingProfile.industryTemplateId,
    "commercial_distribution"
  );
  assert.notEqual(
    securityConfiguration.company.companyId,
    distributionConfiguration.company.companyId
  );
  assert.notEqual(
    securityConfiguration.company.workspaceId,
    distributionConfiguration.company.workspaceId
  );
  assert.equal(securityConfiguration.provenance.authority, ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_AUTHORITY);
  assert.equal(
    distributionConfiguration.provenance.authority,
    ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_AUTHORITY
  );
  assert.ok(Object.isFrozen(securityConfiguration));
  assert.ok(Object.isFrozen(securityConfiguration.company));
});

test("synthetic fixtures contain no real-customer or named-user assumptions", () => {
  const source = readFileSync(
    "administration/workspace-configurations/route-iq-paid-customer-synthetic-fixtures-v1.json",
    "utf8"
  );
  assert.doesNotMatch(source, /Fitness Connection|Anthony|Cruz Garza/iu);
  assert.doesNotMatch(source, /"productionUseAuthorized"\s*:\s*true/iu);
});

test("unsupported schema and contract versions fail closed", () => {
  const invalidSchema = clone(securityConfiguration);
  invalidSchema.schemaVersion = "route-iq-paid-customer-onboarding-v2";
  expectCode("route_iq_paid_customer_schema_version_unsupported", () =>
    validateRouteIqPaidCustomerOnboardingConfiguration(invalidSchema)
  );

  const invalidContract = clone(securityConfiguration);
  invalidContract.contractVersion = "2.0.0";
  expectCode("route_iq_paid_customer_contract_version_unsupported", () =>
    validateRouteIqPaidCustomerOnboardingConfiguration(invalidContract)
  );
});

test("missing and unknown fields fail closed instead of receiving defaults", () => {
  const missing = clone(securityConfiguration);
  delete missing.targeting.includedCategoryIds;
  expectCode("route_iq_paid_customer_fields_invalid", () =>
    validateRouteIqPaidCustomerOnboardingConfiguration(missing)
  );

  const unknown = clone(securityConfiguration);
  unknown.targeting.inferredIndustryDefaults = true;
  expectCode("route_iq_paid_customer_fields_invalid", () =>
    validateRouteIqPaidCustomerOnboardingConfiguration(unknown)
  );
});

test("targeting defaults, missing-rule fallback, and contradictory categories are rejected", () => {
  const defaulted = clone(securityConfiguration);
  defaulted.targeting.targetingDefaultsAllowed = true;
  expectCode("route_iq_paid_customer_targeting_default_forbidden", () =>
    validateRouteIqPaidCustomerOnboardingConfiguration(defaulted)
  );

  const fallback = clone(securityConfiguration);
  fallback.targeting.missingRulesBehavior = "USE_INDUSTRY_DEFAULT";
  expectCode("route_iq_paid_customer_targeting_fail_closed_required", () =>
    validateRouteIqPaidCustomerOnboardingConfiguration(fallback)
  );

  const contradictory = clone(securityConfiguration);
  contradictory.targeting.excludedCategoryIds.push(
    contradictory.targeting.includedCategoryIds[0]
  );
  expectCode("route_iq_paid_customer_targeting_contradictory", () =>
    validateRouteIqPaidCustomerOnboardingConfiguration(contradictory)
  );
});

test("company and workspace identities must be distinct and immutable", () => {
  const collision = clone(securityConfiguration);
  collision.company.workspaceId = collision.company.companyId;
  expectCode("route_iq_paid_customer_identity_collision", () =>
    validateRouteIqPaidCustomerOnboardingConfiguration(collision)
  );

  const mutable = clone(securityConfiguration);
  mutable.company.identityImmutable = false;
  expectCode("route_iq_paid_customer_identity_mutable", () =>
    validateRouteIqPaidCustomerOnboardingConfiguration(mutable)
  );
});

test("territory ZIP, travel limit, and schedule contradictions fail closed", () => {
  const invalidZip = clone(securityConfiguration);
  invalidZip.territory.authorizedZipCodes[0] = "7500";
  expectCode("route_iq_paid_customer_zip_invalid", () =>
    validateRouteIqPaidCustomerOnboardingConfiguration(invalidZip)
  );

  const mismatchedTravelUnit = clone(securityConfiguration);
  mismatchedTravelUnit.territory.travelLimit.unit = "MILES";
  expectCode("route_iq_paid_customer_travel_limit_contradictory", () =>
    validateRouteIqPaidCustomerOnboardingConfiguration(mismatchedTravelUnit)
  );

  const overlappingSchedule = clone(securityConfiguration);
  overlappingSchedule.access.representativeSchedules[0].weeklySchedule[0].windows.push({
    start: "16:00",
    end: "18:00"
  });
  expectCode("route_iq_paid_customer_schedule_overlap", () =>
    validateRouteIqPaidCustomerOnboardingConfiguration(overlappingSchedule)
  );
});

test("unknown roles and cross-workspace access cannot be enabled", () => {
  const crossWorkspace = clone(securityConfiguration);
  crossWorkspace.access.crossWorkspaceAccessAllowed = true;
  expectCode("route_iq_paid_customer_access_fail_closed_required", () =>
    validateRouteIqPaidCustomerOnboardingConfiguration(crossWorkspace)
  );

  const unknownRole = clone(securityConfiguration);
  unknownRole.access.representativeSchedules[0].roleIds = ["foreign_company_role"];
  expectCode("route_iq_paid_customer_role_reference_invalid", () =>
    validateRouteIqPaidCustomerOnboardingConfiguration(unknownRole)
  );
});

test("terminology rejects markup, script, template, and query-shaped payloads", () => {
  for (const hostileLabel of [
    "<script>alert(1)</script>",
    "javascript:alert(1)",
    "${process.env.SECRET}",
    "{{constructor.constructor}}",
    "DROP TABLE customer_records"
  ]) {
    const hostile = clone(securityConfiguration);
    hostile.terminology.terms[0].singular = hostileLabel;
    expectCode("route_iq_paid_customer_label_unsafe", () =>
      validateRouteIqPaidCustomerOnboardingConfiguration(hostile)
    );
  }
});

test("singular, plural, required fallback terms, and metric history are governed", () => {
  const duplicateNumber = clone(securityConfiguration);
  duplicateNumber.terminology.terms[0].plural =
    duplicateNumber.terminology.terms[0].singular;
  expectCode("route_iq_paid_customer_terminology_number_invalid", () =>
    validateRouteIqPaidCustomerOnboardingConfiguration(duplicateNumber)
  );

  const missingRequired = clone(securityConfiguration);
  missingRequired.terminology.terms.find(term => term.termId === "manager").termId =
    "account";
  expectCode("route_iq_paid_customer_terminology_required_missing", () =>
    validateRouteIqPaidCustomerOnboardingConfiguration(missingRequired)
  );

  const changedHistory = clone(securityConfiguration);
  changedHistory.terminology.metrics[0].historyIdentity = "different_semantics@1.0.0";
  expectCode("route_iq_paid_customer_metric_history_identity_invalid", () =>
    validateRouteIqPaidCustomerOnboardingConfiguration(changedHistory)
  );
});

test("display-label revision preserves stable metric reporting identity", () => {
  const relabeled = clone(distributionConfiguration);
  relabeled.configurationRevision = 2;
  relabeled.terminology.terms.find(term => term.termId === "outcome").singular =
    "confirmed order";
  relabeled.terminology.terms.find(term => term.termId === "outcome").plural =
    "confirmed orders";
  relabeled.provenance.configurationIdentity =
    `${relabeled.configurationId}@${relabeled.configurationRevision}`;

  const validated = validateRouteIqPaidCustomerOnboardingConfiguration(relabeled);
  assert.equal(validated.terminology.metrics[1].metricId, "purchase_orders_received");
  assert.equal(validated.terminology.metrics[1].semanticVersion, "1.0.0");
  assert.equal(
    validated.terminology.metrics[1].historyIdentity,
    "purchase_orders_received@1.0.0"
  );
});

test("sales, Dashboard, and CRM references cannot cross configuration boundaries", () => {
  const foreignMetric = clone(securityConfiguration);
  foreignMetric.sales.goals[0].metricId = "purchase_orders_received";
  expectCode("route_iq_paid_customer_metric_reference_invalid", () =>
    validateRouteIqPaidCustomerOnboardingConfiguration(foreignMetric)
  );

  const foreignDashboardMetric = clone(securityConfiguration);
  foreignDashboardMetric.dashboard.metricIds[0] = "purchase_orders_received";
  expectCode("route_iq_paid_customer_dashboard_metric_unknown", () =>
    validateRouteIqPaidCustomerOnboardingConfiguration(foreignDashboardMetric)
  );

  const foreignCrmStage = clone(securityConfiguration);
  foreignCrmStage.crm.processStageIds[0] = "buyer_identified";
  expectCode("route_iq_paid_customer_crm_stage_unknown", () =>
    validateRouteIqPaidCustomerOnboardingConfiguration(foreignCrmStage)
  );
});

test("verification freshness and every evidence failure mode remain fail closed", () => {
  const staleCeiling = clone(securityConfiguration);
  staleCeiling.verification.freshnessCeilingHours = 25;
  expectCode("route_iq_paid_customer_integer_invalid", () =>
    validateRouteIqPaidCustomerOnboardingConfiguration(staleCeiling)
  );

  for (const [field, invalidValue] of [
    ["missingEvidenceBehavior", "ELIGIBLE_WITH_WARNING"],
    ["staleEvidenceBehavior", "ELIGIBLE_WITH_WARNING"],
    ["conflictingEvidenceBehavior", "PREFER_NEWEST"],
    ["providerFailureBehavior", "ASSUME_OPEN"],
    ["closedBusinessBehavior", "ELIGIBLE"],
    ["duplicateBusinessBehavior", "PREFER_FIRST"]
  ]) {
    const unsafe = clone(securityConfiguration);
    unsafe.verification[field] = invalidValue;
    expectCode("route_iq_paid_customer_verification_fail_closed_required", () =>
      validateRouteIqPaidCustomerOnboardingConfiguration(unsafe)
    );
  }
});

test("onboarding cannot authorize CRM mutation or operational safety switches", () => {
  const crmWrite = clone(securityConfiguration);
  crmWrite.crm.productionMutationAuthorized = true;
  expectCode("route_iq_paid_customer_crm_activation_forbidden", () =>
    validateRouteIqPaidCustomerOnboardingConfiguration(crmWrite)
  );

  for (const [field, value] of [
    ["collection", "ON"],
    ["activeCohorts", 1],
    ["recommendationInfluence", "ON"],
    ["providerRefresh", "ON"],
    ["scheduler", "ON"]
  ]) {
    const unsafe = clone(securityConfiguration);
    unsafe.safety[field] = value;
    expectCode("route_iq_paid_customer_safety_boundary_invalid", () =>
      validateRouteIqPaidCustomerOnboardingConfiguration(unsafe)
    );
  }
});

test("configuration preview is deterministic, scoped, and performs no activation", () => {
  const first = createRouteIqPaidCustomerConfigurationPreview(securityConfiguration);
  const second = createRouteIqPaidCustomerConfigurationPreview(clone(securityConfiguration));

  assert.deepEqual(first, second);
  assert.equal(first.companyId, securityConfiguration.company.companyId);
  assert.equal(first.workspaceId, securityConfiguration.company.workspaceId);
  assert.deepEqual(first.territory.zipCodes, ["75001", "75002", "75006"]);
  assert.equal(first.activationPerformed, false);
  assert.equal(first.productionMutationCount, 0);
  assert.equal(first.customerActivation, "OFF");
  assert.equal(first.collection, "OFF");
  assert.equal(first.activeCohorts, 0);
  assert.equal(first.recommendationInfluence, "OFF");
  assert.equal(first.providerRefresh, "OFF");
  assert.equal(first.scheduler, "OFF");
  assert.ok(Object.isFrozen(first));
});

test("draft and failed configurations cannot be previewed", () => {
  const draft = clone(securityConfiguration);
  draft.lifecycle = {
    state: "DRAFT",
    revision: 1,
    lastTransitionAt: "2026-07-26T11:00:00.000Z",
    approvalReference: null,
    failure: null
  };
  expectCode("route_iq_paid_customer_preview_state_invalid", () =>
    createRouteIqPaidCustomerConfigurationPreview(draft)
  );
});
