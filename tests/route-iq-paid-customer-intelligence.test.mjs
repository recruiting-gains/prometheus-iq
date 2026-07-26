import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createPaidCustomerIntelligenceScope,
  createPaidCustomerMetricLabelSnapshot,
  evaluatePaidCustomerRecommendationAdmission,
  normalizePaidCustomerMetricCatalog,
  paidCustomerIntelligenceOperations,
  paidCustomerIntelligenceSafety,
  resolvePaidCustomerMetricLabel,
  routeIqMetricLabelSnapshotVersion,
  routeIqPaidCustomerIndustryTemplates,
  routeIqPaidCustomerIntelligenceVersion,
  routeIqPaidCustomerOnboardingVersion,
  routeIqVerifiedBusinessEvidenceVersion,
  validatePaidCustomerIntelligenceOnboarding
} from "../intelligence/route-iq-paid-customer-intelligence.mjs";

const evaluatedAt = "2026-07-26T15:00:00.000Z";

function clone(value) {
  return structuredClone(value);
}

function syntheticConfiguration({
  companyId = "synthetic_security_company",
  workspaceId = "synthetic_security_workspace",
  roleMetrics = routeIqPaidCustomerIndustryTemplates.find(item => item.templateId === "security_services").metrics
} = {}) {
  return {
    schemaVersion: routeIqPaidCustomerOnboardingVersion,
    authority: "prometheus_administration",
    configurationVersion: "configuration_v1",
    scope: {
      companyId,
      workspaceId,
      immutable: true
    },
    company: { companyId },
    workspace: { workspaceId, companyId },
    lifecycle: {
      state: "PREVIEW_READY",
      customerActivated: false
    },
    safety: clone(paidCustomerIntelligenceSafety),
    territories: [
      {
        territoryId: "territory_north",
        authorized: true,
        cities: ["Northfield"],
        zipCodes: ["75001", "75002"]
      }
    ],
    targeting: {
      includedCategoryIds: ["category_commercial_property"],
      excludedCategoryIds: ["category_residential_only"],
      excludedBusinessIds: ["business_excluded"]
    },
    freshnessPolicy: {
      maximumAgeHours: 24,
      providerFailureFailsClosed: true
    },
    metrics: clone(roleMetrics)
  };
}

function syntheticPrincipal(configuration, role = "manager") {
  return {
    authority: "server_authenticated_principal",
    authenticated: true,
    companyId: configuration.scope.companyId,
    workspaceId: configuration.scope.workspaceId,
    role
  };
}

function recommendationScope(configuration = syntheticConfiguration(), role = "manager") {
  return createPaidCustomerIntelligenceScope({
    onboardingConfiguration: configuration,
    principal: syntheticPrincipal(configuration, role),
    operation: paidCustomerIntelligenceOperations.recommendationAdmission
  });
}

function previewScope(configuration = syntheticConfiguration(), role = "manager") {
  return createPaidCustomerIntelligenceScope({
    onboardingConfiguration: configuration,
    principal: syntheticPrincipal(configuration, role),
    operation: paidCustomerIntelligenceOperations.configurationPreview
  });
}

function syntheticEvidence(configuration = syntheticConfiguration()) {
  return {
    schemaVersion: routeIqVerifiedBusinessEvidenceVersion,
    configurationVersion: configuration.configurationVersion,
    companyId: configuration.scope.companyId,
    workspaceId: configuration.scope.workspaceId,
    scope: {
      companyId: configuration.scope.companyId,
      workspaceId: configuration.scope.workspaceId,
      immutable: true
    },
    businessId: "business_verified_one",
    territoryId: "territory_north",
    categoryId: "category_commercial_property",
    identity: {
      verified: true,
      verificationSource: "synthetic_registry"
    },
    address: {
      physicalAddressVerified: true,
      city: "Northfield",
      zipCode: "75001"
    },
    operatingStatus: "OPEN",
    availability: {
      state: "OPEN_VERIFIED"
    },
    provider: {
      state: "VERIFIED",
      source: "synthetic_provider",
      lastFailedAt: null
    },
    duplicateResolution: {
      state: "UNIQUE"
    },
    conflictResolution: {
      state: "NONE"
    },
    verification: {
      freshnessState: "FRESH",
      verifiedAt: "2026-07-26T14:00:00.000Z",
      expiresAt: "2026-07-27T14:00:00.000Z"
    },
    targetProfile: {
      matches: true
    },
    evidenceQuality: {
      state: "VERIFIED",
      confidence: "HIGH"
    },
    recommendationReason: "Matches the governed commercial property profile"
  };
}

function decisionFor(mutator = value => value, configuration = syntheticConfiguration()) {
  const evidence = mutator(syntheticEvidence(configuration));
  return evaluatePaidCustomerRecommendationAdmission({
    paidCustomerScope: recommendationScope(configuration),
    businessEvidence: evidence,
    evaluatedAt
  });
}

test("paid-customer Intelligence contract and implementation safety remain dark", () => {
  const contract = JSON.parse(readFileSync(
    new URL("../intelligence/contracts/route-iq-paid-customer-intelligence-v1.json", import.meta.url),
    "utf8"
  ));
  assert.equal(contract.owner, "Prometheus Intelligence Engine");
  assert.equal(contract.consumes.onboarding, routeIqPaidCustomerOnboardingVersion);
  assert.equal(contract.consumes.verifiedBusinessEvidence, routeIqVerifiedBusinessEvidenceVersion);
  assert.deepEqual(contract.safety, paidCustomerIntelligenceSafety);
  assert.equal(contract.scope.crossCompanyEnumerationAllowed, false);
  assert.equal(contract.metricModel.customerSpecificCodeBranchesAllowed, false);
});

test("valid governed evidence can pass admission without influencing representative routing", () => {
  const decision = decisionFor();
  assert.equal(decision.version, routeIqPaidCustomerIntelligenceVersion);
  assert.equal(decision.status, "ADMISSION_ELIGIBLE");
  assert.equal(decision.reasonCode, "ALL_GOVERNED_GATES_PASSED");
  assert.equal(decision.recommendationAdmissionEligible, true);
  assert.equal(decision.representativeRoutingEligible, false);
  assert.equal(decision.recommendationInfluence, "OFF");
  assert.equal(decision.routeOrderingChanged, false);
  assert.equal(decision.routeScoringWeightsChanged, false);
  assert.equal(decision.validationOnly, true);
});

test("cross-company and cross-workspace requests collapse to one non-enumerating denial", () => {
  const configuration = syntheticConfiguration();
  const scope = recommendationScope(configuration);
  const crossCompany = syntheticEvidence(configuration);
  crossCompany.companyId = "synthetic_other_company";
  crossCompany.scope.companyId = "synthetic_other_company";
  const crossWorkspace = syntheticEvidence(configuration);
  crossWorkspace.workspaceId = "synthetic_other_workspace";
  crossWorkspace.scope.workspaceId = "synthetic_other_workspace";
  const missing = null;
  const decisions = [crossCompany, crossWorkspace, missing].map(businessEvidence =>
    evaluatePaidCustomerRecommendationAdmission({
      paidCustomerScope: scope,
      businessEvidence,
      evaluatedAt
    })
  );
  assert.deepEqual(decisions[0], decisions[1]);
  assert.deepEqual(decisions[1], decisions[2]);
  assert.deepEqual(Object.keys(decisions[0]).sort(), [
    "candidateDisclosed",
    "reasonCode",
    "recommendationAdmissionEligible",
    "recommendationInfluence",
    "representativeRoutingEligible",
    "routeOrderingChanged",
    "routeScoringWeightsChanged",
    "status",
    "validationOnly",
    "version"
  ]);
  assert.equal(decisions[0].reasonCode, "SCOPE_DENIED");
  assert.equal(decisions[0].candidateDisclosed, false);
});

test("server scope creation rejects cross-company principals and forged scopes", () => {
  const configuration = syntheticConfiguration();
  const principal = syntheticPrincipal(configuration);
  principal.companyId = "synthetic_other_company";
  assert.throws(() => createPaidCustomerIntelligenceScope({
    onboardingConfiguration: configuration,
    principal,
    operation: paidCustomerIntelligenceOperations.recommendationAdmission
  }), /scope is denied/);

  const forged = evaluatePaidCustomerRecommendationAdmission({
    paidCustomerScope: {
      version: routeIqPaidCustomerIntelligenceVersion,
      companyId: configuration.scope.companyId,
      workspaceId: configuration.scope.workspaceId,
      operation: paidCustomerIntelligenceOperations.recommendationAdmission
    },
    businessEvidence: syntheticEvidence(configuration),
    evaluatedAt
  });
  assert.equal(forged.reasonCode, "SCOPE_DENIED");
});

test("roles permit only their fixed server-side Intelligence operations", () => {
  const configuration = syntheticConfiguration();
  assert.doesNotThrow(() => recommendationScope(configuration, "representative"));
  assert.throws(() => previewScope(configuration, "representative"), /scope is denied/);
  assert.doesNotThrow(() => previewScope(configuration, "auditor"));
  assert.throws(() => recommendationScope(configuration, "auditor"), /scope is denied/);
  assert.doesNotThrow(() => previewScope(configuration, "founder"));
  assert.doesNotThrow(() => recommendationScope(configuration, "manager"));
  assert.throws(() => recommendationScope(configuration, "unknown_role"), /scope is denied/);
});

test("onboarding scope, lifecycle, targeting, freshness, metrics, and dark safety fail closed", () => {
  const mutations = [
    value => { value.schemaVersion = "unknown"; },
    value => { value.scope.immutable = false; },
    value => { value.workspace.companyId = "synthetic_other_company"; },
    value => { value.lifecycle.state = "ACTIVE"; },
    value => { value.lifecycle.customerActivated = true; },
    value => { value.safety.recommendationInfluence = "ON"; },
    value => { value.safety.collection = "ON"; },
    value => { value.safety.activeCohorts = 1; },
    value => { value.territories[0].zipCodes = ["bad"]; },
    value => { value.targeting.excludedCategoryIds = ["category_commercial_property"]; },
    value => { value.freshnessPolicy.maximumAgeHours = 25; },
    value => { value.metrics = []; }
  ];
  for (const mutate of mutations) {
    const configuration = syntheticConfiguration();
    mutate(configuration);
    assert.notDeepEqual(validatePaidCustomerIntelligenceOnboarding(configuration), []);
    assert.throws(() => recommendationScope(configuration), /configuration is invalid/);
  }
});

test("all governed territory, category, exclusion, identity, and operating gates fail closed", () => {
  const cases = [
    ["BUSINESS_EXCLUDED", value => { value.businessId = "business_excluded"; }],
    ["TERRITORY_NOT_AUTHORIZED", value => { value.territoryId = "territory_south"; }],
    ["TERRITORY_NOT_AUTHORIZED", value => { value.address.zipCode = "99999"; }],
    ["TERRITORY_NOT_AUTHORIZED", value => { value.address.physicalAddressVerified = false; }],
    ["CATEGORY_EXCLUDED", value => { value.categoryId = "category_residential_only"; }],
    ["CATEGORY_NOT_INCLUDED", value => { value.categoryId = "category_unapproved"; }],
    ["IDENTITY_NOT_VERIFIED", value => { value.identity.verified = false; }],
    ["BUSINESS_NOT_OPERATING", value => { value.operatingStatus = "CLOSED"; }],
    ["BUSINESS_NOT_OPEN_NOW", value => { value.availability.state = "CLOSED_VERIFIED"; }]
  ];
  for (const [reasonCode, mutate] of cases) {
    const decision = decisionFor(value => {
      mutate(value);
      return value;
    });
    assert.equal(decision.reasonCode, reasonCode);
    assert.equal(decision.recommendationAdmissionEligible, false);
    assert.equal(decision.representativeRoutingEligible, false);
  }
});

test("missing, stale, invalid, provider-failed, duplicated, and conflicting evidence never passes", () => {
  const cases = [
    ["EVIDENCE_VERSION_INVALID", value => { value.schemaVersion = "unknown"; }],
    ["EVIDENCE_SCOPE_INVALID", value => { value.configurationVersion = "configuration_v0"; }],
    ["PROVIDER_NOT_VERIFIED", value => { value.provider.state = "FAILED"; }],
    ["DUPLICATE_UNRESOLVED", value => { value.duplicateResolution.state = "DUPLICATE"; }],
    ["EVIDENCE_CONFLICT", value => { value.conflictResolution.state = "CONFLICTING"; }],
    ["EVIDENCE_STALE_OR_INVALID", value => { value.verification.freshnessState = "STALE"; }],
    ["EVIDENCE_STALE_OR_INVALID", value => { value.verification.verifiedAt = "2026-07-24T14:00:00.000Z"; }],
    ["EVIDENCE_STALE_OR_INVALID", value => { value.verification.expiresAt = "2026-07-26T14:59:59.000Z"; }],
    ["PROVIDER_FAILURE_CURRENT", value => { value.provider.lastFailedAt = "2026-07-26T14:30:00.000Z"; }],
    ["TARGET_PROFILE_MISMATCH", value => { value.targetProfile.matches = false; }],
    ["EVIDENCE_QUALITY_INSUFFICIENT", value => { value.evidenceQuality.confidence = "LOW"; }],
    ["EVIDENCE_QUALITY_INSUFFICIENT", value => { value.recommendationReason = "<script>unsafe</script>"; }]
  ];
  for (const [reasonCode, mutate] of cases) {
    const decision = decisionFor(value => {
      mutate(value);
      return value;
    });
    assert.equal(decision.reasonCode, reasonCode);
    assert.equal(decision.recommendationAdmissionEligible, false);
    assert.equal(decision.recommendationInfluence, "OFF");
  }
});

test("six unrelated industry templates reuse the same stable metric identifiers", () => {
  assert.deepEqual(routeIqPaidCustomerIndustryTemplates.map(item => item.templateId), [
    "gym_sales",
    "medical_business_development",
    "security_services",
    "franchise_development",
    "merchant_payroll_services",
    "commercial_distribution"
  ]);
  const expectedMetricIds = [
    "metric_primary_activity",
    "metric_conversion_event",
    "metric_primary_outcome"
  ].sort();
  for (const template of routeIqPaidCustomerIndustryTemplates) {
    assert.deepEqual(
      normalizePaidCustomerMetricCatalog(template.metrics).map(item => item.metricId).sort(),
      expectedMetricIds
    );
  }
  assert.equal(new Set(
    routeIqPaidCustomerIndustryTemplates.map(item => JSON.stringify(item.metrics.map(metric => metric.metricId)))
  ).size, 1);
});

test("hostile metric labels and arbitrary fallbacks are rejected", () => {
  const hostileLabels = [
    "<script>alert(1)</script>",
    "${process.env.SECRET}",
    "{{constructor.constructor}}",
    "javascript:alert(1)",
    "Outcome\u0000Hidden"
  ];
  for (const label of hostileLabels) {
    const metrics = clone(routeIqPaidCustomerIndustryTemplates[0].metrics);
    metrics[0].labels.singular = label;
    assert.throws(() => normalizePaidCustomerMetricCatalog(metrics), /unsafe/);
  }
  assert.throws(() => resolvePaidCustomerMetricLabel({
    metricId: "metric_unknown",
    count: 1,
    fallbackKind: "customer_supplied_fallback"
  }), /unsupported/);
});

test("historical metric snapshots preserve labels across later configuration changes", () => {
  const original = syntheticConfiguration();
  const snapshot = createPaidCustomerMetricLabelSnapshot({
    paidCustomerScope: previewScope(original),
    effectiveAt: "2026-07-26T12:00:00.000Z"
  });
  assert.equal(snapshot.schemaVersion, routeIqMetricLabelSnapshotVersion);
  const originalLabel = resolvePaidCustomerMetricLabel({
    metricId: "metric_primary_outcome",
    count: 2,
    labelSnapshot: snapshot
  });

  const changed = syntheticConfiguration();
  const metric = changed.metrics.find(item => item.metricId === "metric_primary_outcome");
  metric.labels = { singular: "Qualified Outcome", plural: "Qualified Outcomes" };
  const laterSnapshot = createPaidCustomerMetricLabelSnapshot({
    paidCustomerScope: previewScope(changed),
    effectiveAt: "2026-07-27T12:00:00.000Z"
  });
  const laterLabel = resolvePaidCustomerMetricLabel({
    metricId: "metric_primary_outcome",
    count: 2,
    labelSnapshot: laterSnapshot
  });
  assert.equal(originalLabel.label, "Proposals");
  assert.equal(laterLabel.label, "Qualified Outcomes");
  assert.equal(originalLabel.labelSource, "HISTORICAL_SNAPSHOT");
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot.definitions[0].labels), true);
});

test("unknown metrics use only controlled generic fallback labels", () => {
  assert.deepEqual(resolvePaidCustomerMetricLabel({
    metricId: "metric_unknown",
    count: 1,
    fallbackKind: "outcome"
  }), {
    metricId: "metric_unknown",
    label: "Outcome",
    labelSource: "CONTROLLED_GENERIC_FALLBACK"
  });
  assert.equal(resolvePaidCustomerMetricLabel({
    metricId: "metric_unknown",
    count: 2,
    fallbackKind: "activity"
  }).label, "Activities");
});
