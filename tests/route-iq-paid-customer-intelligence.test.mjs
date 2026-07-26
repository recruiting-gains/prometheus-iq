import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_AUTHORITY,
  ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_CONTRACT_VERSION,
  validateRouteIqPaidCustomerOnboardingConfiguration
} from "../administration/contracts/route-iq-paid-customer-onboarding-v1.mjs";
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
  routeIqPaidCustomerOnboardingContractVersion,
  routeIqPaidCustomerOnboardingVersion,
  routeIqVerifiedBusinessEvidenceVersion,
  validatePaidCustomerIntelligenceOnboarding
} from "../intelligence/route-iq-paid-customer-intelligence.mjs";

const evaluatedAt = "2026-07-26T15:00:00.000Z";
const fixtureDocument = JSON.parse(readFileSync(
  new URL(
    "../administration/workspace-configurations/route-iq-paid-customer-synthetic-fixtures-v1.json",
    import.meta.url
  ),
  "utf8"
));
const [securityConfiguration, distributionConfiguration] =
  fixtureDocument.configurations.map(validateRouteIqPaidCustomerOnboardingConfiguration);

function clone(value) {
  return structuredClone(value);
}

function configuredRoleId(configuration, permission) {
  return configuration.access.roles.find(role => role.permissions.includes(permission))?.roleId;
}

function syntheticPrincipal(configuration, permission) {
  return {
    authority: "server_authenticated_principal",
    authenticated: true,
    companyId: configuration.company.companyId,
    workspaceId: configuration.company.workspaceId,
    roleId: configuredRoleId(configuration, permission)
  };
}

function recommendationScope(configuration = securityConfiguration, permission = "view_assigned_territory") {
  return createPaidCustomerIntelligenceScope({
    onboardingConfiguration: configuration,
    principal: syntheticPrincipal(configuration, permission),
    operation: paidCustomerIntelligenceOperations.recommendationAdmission
  });
}

function previewScope(configuration = securityConfiguration) {
  return createPaidCustomerIntelligenceScope({
    onboardingConfiguration: configuration,
    principal: syntheticPrincipal(configuration, "view_company_dashboard"),
    operation: paidCustomerIntelligenceOperations.configurationPreview
  });
}

function syntheticEvidence(configuration = securityConfiguration) {
  const city = configuration.territory.authorizedCities[0];
  return {
    schemaVersion: routeIqVerifiedBusinessEvidenceVersion,
    configurationVersion: configuration.provenance.configurationIdentity,
    companyId: configuration.company.companyId,
    workspaceId: configuration.company.workspaceId,
    scope: {
      companyId: configuration.company.companyId,
      workspaceId: configuration.company.workspaceId,
      immutable: true
    },
    businessId: "synthetic_business_verified_one",
    territoryId: configuration.territory.territoryId,
    categoryId: configuration.targeting.includedCategoryIds[0],
    identity: {
      verified: true,
      verificationSource: "synthetic_registry"
    },
    address: {
      physicalAddressVerified: true,
      city: city.name,
      zipCode: configuration.territory.authorizedZipCodes[0]
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
    recommendationReason: "Matches the governed synthetic target profile"
  };
}

function decisionFor(mutator = value => value, configuration = securityConfiguration) {
  const evidence = mutator(syntheticEvidence(configuration));
  return evaluatePaidCustomerRecommendationAdmission({
    paidCustomerScope: recommendationScope(configuration),
    businessEvidence: evidence,
    evaluatedAt
  });
}

test("Intelligence contract consumes the final Administration configuration surface", () => {
  const contract = JSON.parse(readFileSync(
    new URL("../intelligence/contracts/route-iq-paid-customer-intelligence-v1.json", import.meta.url),
    "utf8"
  ));
  assert.equal(contract.owner, "Prometheus Intelligence Engine");
  assert.equal(contract.consumes.onboarding, routeIqPaidCustomerOnboardingVersion);
  assert.equal(
    contract.consumes.onboardingContractVersion,
    ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_CONTRACT_VERSION
  );
  assert.equal(contract.consumes.onboardingAuthority, ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_AUTHORITY);
  assert.equal(contract.consumes.companyIdentity, "company.companyId");
  assert.equal(contract.consumes.workspaceIdentity, "company.workspaceId");
  assert.equal(contract.consumes.metricDefinitions, "terminology.metrics");
  assert.equal(contract.authorization.customerRoleNamesHardCoded, false);
  assert.deepEqual(contract.safety, paidCustomerIntelligenceSafety);
  assert.equal(contract.scope.crossCompanyEnumerationAllowed, false);
  assert.equal(contract.metricModel.customerSpecificCodeBranchesAllowed, false);
});

test("two unrelated Administration fixtures validate through one Intelligence implementation", () => {
  assert.equal(fixtureDocument.productionUseAuthorized, false);
  assert.deepEqual(validatePaidCustomerIntelligenceOnboarding(securityConfiguration), []);
  assert.deepEqual(validatePaidCustomerIntelligenceOnboarding(distributionConfiguration), []);
  assert.notEqual(
    securityConfiguration.operatingProfile.industryTemplateId,
    distributionConfiguration.operatingProfile.industryTemplateId
  );
  assert.notEqual(
    securityConfiguration.company.companyId,
    distributionConfiguration.company.companyId
  );
  assert.equal(recommendationScope(securityConfiguration).recommendationInfluence, "OFF");
  assert.equal(recommendationScope(distributionConfiguration).recommendationInfluence, "OFF");
});

test("the provisional scope, workspace, territories, freshness, and top-level metrics shape is rejected", () => {
  const provisional = {
    schemaVersion: routeIqPaidCustomerOnboardingVersion,
    authority: ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_AUTHORITY,
    configurationVersion: "configuration_v1",
    scope: {
      companyId: "synthetic_company",
      workspaceId: "synthetic_workspace",
      immutable: true
    },
    company: { companyId: "synthetic_company" },
    workspace: {
      companyId: "synthetic_company",
      workspaceId: "synthetic_workspace"
    },
    territories: [],
    freshnessPolicy: { maximumAgeHours: 24 },
    metrics: []
  };
  assert.notDeepEqual(validatePaidCustomerIntelligenceOnboarding(provisional), []);
  assert.throws(() => createPaidCustomerIntelligenceScope({
    onboardingConfiguration: provisional,
    principal: {
      authority: "server_authenticated_principal",
      authenticated: true,
      companyId: "synthetic_company",
      workspaceId: "synthetic_workspace",
      roleId: "synthetic_role"
    },
    operation: paidCustomerIntelligenceOperations.recommendationAdmission
  }), /configuration is invalid/);
});

test("valid governed evidence passes admission without affecting representative routing", () => {
  for (const configuration of [securityConfiguration, distributionConfiguration]) {
    const decision = decisionFor(value => value, configuration);
    assert.equal(decision.version, routeIqPaidCustomerIntelligenceVersion);
    assert.equal(decision.status, "ADMISSION_ELIGIBLE");
    assert.equal(decision.reasonCode, "ALL_GOVERNED_GATES_PASSED");
    assert.equal(decision.configurationVersion, configuration.provenance.configurationIdentity);
    assert.equal(decision.recommendationAdmissionEligible, true);
    assert.equal(decision.representativeRoutingEligible, false);
    assert.equal(decision.recommendationInfluence, "OFF");
    assert.equal(decision.routeOrderingChanged, false);
    assert.equal(decision.routeScoringWeightsChanged, false);
    assert.equal(decision.validationOnly, true);
  }
});

test("cross-company and cross-workspace requests collapse to one non-enumerating denial", () => {
  const scope = recommendationScope();
  const crossCompany = syntheticEvidence();
  crossCompany.companyId = distributionConfiguration.company.companyId;
  crossCompany.scope.companyId = distributionConfiguration.company.companyId;
  const crossWorkspace = syntheticEvidence();
  crossWorkspace.workspaceId = distributionConfiguration.company.workspaceId;
  crossWorkspace.scope.workspaceId = distributionConfiguration.company.workspaceId;
  const decisions = [crossCompany, crossWorkspace, null].map(businessEvidence =>
    evaluatePaidCustomerRecommendationAdmission({
      paidCustomerScope: scope,
      businessEvidence,
      evaluatedAt
    })
  );
  assert.deepEqual(decisions[0], decisions[1]);
  assert.deepEqual(decisions[1], decisions[2]);
  assert.equal(decisions[0].reasonCode, "SCOPE_DENIED");
  assert.equal(decisions[0].candidateDisclosed, false);
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
});

test("forged Intelligence scopes cannot bypass server-minted company and workspace authority", () => {
  const forgedScope = {
    version: routeIqPaidCustomerIntelligenceVersion,
    companyId: securityConfiguration.company.companyId,
    workspaceId: securityConfiguration.company.workspaceId,
    configurationVersion: securityConfiguration.provenance.configurationIdentity,
    roleId: configuredRoleId(securityConfiguration, "view_assigned_territory"),
    operation: paidCustomerIntelligenceOperations.recommendationAdmission,
    recommendationInfluence: "OFF",
    customerActivation: "OFF"
  };
  const decision = evaluatePaidCustomerRecommendationAdmission({
    paidCustomerScope: forgedScope,
    businessEvidence: syntheticEvidence(),
    evaluatedAt
  });
  assert.equal(decision.reasonCode, "SCOPE_DENIED");
  assert.equal(decision.candidateDisclosed, false);
  assert.throws(() => createPaidCustomerMetricLabelSnapshot({
    paidCustomerScope: forgedScope,
    effectiveAt: evaluatedAt
  }), /scope is denied/);
});

test("configured opaque roles authorize operations by governed permission only", () => {
  assert.doesNotThrow(() => recommendationScope(securityConfiguration, "view_assigned_territory"));
  assert.doesNotThrow(() => recommendationScope(securityConfiguration, "view_company_dashboard"));
  assert.doesNotThrow(() => previewScope(securityConfiguration));

  const fieldPrincipal = syntheticPrincipal(securityConfiguration, "view_assigned_territory");
  assert.throws(() => createPaidCustomerIntelligenceScope({
    onboardingConfiguration: securityConfiguration,
    principal: fieldPrincipal,
    operation: paidCustomerIntelligenceOperations.configurationPreview
  }), /scope is denied/);

  const unknownRole = {
    ...fieldPrincipal,
    roleId: "synthetic_unknown_role"
  };
  assert.throws(() => createPaidCustomerIntelligenceScope({
    onboardingConfiguration: securityConfiguration,
    principal: unknownRole,
    operation: paidCustomerIntelligenceOperations.recommendationAdmission
  }), /scope is denied/);

  const crossCompany = {
    ...fieldPrincipal,
    companyId: distributionConfiguration.company.companyId
  };
  assert.throws(() => createPaidCustomerIntelligenceScope({
    onboardingConfiguration: securityConfiguration,
    principal: crossCompany,
    operation: paidCustomerIntelligenceOperations.recommendationAdmission
  }), /scope is denied/);
});

test("inactive lifecycle and dark safety boundaries fail closed", () => {
  const mutations = [
    value => { value.lifecycle.state = "DRAFT"; },
    value => { value.lifecycle.state = "PROVISIONING"; value.lifecycle.approvalReference = "synthetic_approval"; },
    value => { value.safety.collection = "ON"; },
    value => { value.safety.activeCohorts = 1; },
    value => { value.safety.recommendationInfluence = "ON"; },
    value => { value.safety.providerRefresh = "ON"; },
    value => { value.safety.scheduler = "ON"; },
    value => { value.verification.freshnessCeilingHours = 25; },
    value => {
      value.targeting.excludedCategoryIds.push(value.targeting.includedCategoryIds[0]);
    }
  ];
  for (const mutate of mutations) {
    const configuration = clone(securityConfiguration);
    mutate(configuration);
    assert.notDeepEqual(validatePaidCustomerIntelligenceOnboarding(configuration), []);
    assert.throws(() => recommendationScope(configuration), /configuration is invalid/);
  }
});

test("immutable Administration configuration identity binds scopes and evidence", () => {
  const configuration = clone(securityConfiguration);
  configuration.provenance.configurationIdentity = "config_wrong@1";
  assert.notDeepEqual(validatePaidCustomerIntelligenceOnboarding(configuration), []);

  const decision = decisionFor(value => {
    value.configurationVersion = "config_aster_security_services_v1@0";
    return value;
  });
  assert.equal(decision.reasonCode, "EVIDENCE_SCOPE_INVALID");
  assert.equal(decision.recommendationAdmissionEligible, false);
});

test("territory, category, exclusion, identity, and operating gates fail closed", () => {
  const excludedConfiguration = clone(securityConfiguration);
  excludedConfiguration.targeting.excludedBusinessIds.push("synthetic_business_verified_one");
  validateRouteIqPaidCustomerOnboardingConfiguration(excludedConfiguration);
  const excludedDecision = decisionFor(value => value, excludedConfiguration);
  assert.equal(excludedDecision.reasonCode, "BUSINESS_EXCLUDED");

  const cases = [
    ["TERRITORY_NOT_AUTHORIZED", value => { value.territoryId = "synthetic_other_territory"; }],
    ["TERRITORY_NOT_AUTHORIZED", value => { value.address.zipCode = "99999"; }],
    ["TERRITORY_NOT_AUTHORIZED", value => { value.address.city = "Other City"; }],
    ["TERRITORY_NOT_AUTHORIZED", value => { value.address.physicalAddressVerified = false; }],
    ["CATEGORY_EXCLUDED", value => {
      value.categoryId = securityConfiguration.targeting.excludedCategoryIds[0];
    }],
    ["CATEGORY_NOT_INCLUDED", value => { value.categoryId = "synthetic_unapproved_category"; }],
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

test("missing, stale, provider-failed, duplicated, and conflicting evidence never passes", () => {
  const cases = [
    ["EVIDENCE_VERSION_INVALID", value => { value.schemaVersion = "unknown"; }],
    ["PROVIDER_NOT_VERIFIED", value => { value.provider.state = "FAILED"; }],
    ["DUPLICATE_UNRESOLVED", value => { value.duplicateResolution.state = "DUPLICATE"; }],
    ["EVIDENCE_CONFLICT", value => { value.conflictResolution.state = "CONFLICTING"; }],
    ["EVIDENCE_STALE_OR_INVALID", value => { value.verification.freshnessState = "STALE"; }],
    ["EVIDENCE_STALE_OR_INVALID", value => {
      value.verification.verifiedAt = "2026-07-24T14:00:00.000Z";
    }],
    ["EVIDENCE_STALE_OR_INVALID", value => {
      value.verification.expiresAt = "2026-07-26T14:59:59.000Z";
    }],
    ["PROVIDER_FAILURE_CURRENT", value => {
      value.provider.lastFailedAt = "2026-07-26T14:30:00.000Z";
    }],
    ["TARGET_PROFILE_MISMATCH", value => { value.targetProfile.matches = false; }],
    ["EVIDENCE_QUALITY_INSUFFICIENT", value => { value.evidenceQuality.confidence = "LOW"; }],
    ["EVIDENCE_QUALITY_INSUFFICIENT", value => {
      value.recommendationReason = "<script>unsafe</script>";
    }]
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

test("Administration terminology produces stable metric IDs and governed display labels", () => {
  for (const configuration of [securityConfiguration, distributionConfiguration]) {
    const catalog = normalizePaidCustomerMetricCatalog(
      configuration.terminology.metrics,
      configuration.terminology.terms
    );
    assert.deepEqual(
      catalog.map(metric => metric.metricId),
      [...configuration.terminology.metrics]
        .map(metric => metric.metricId)
        .sort((left, right) => left.localeCompare(right))
    );
    for (const metric of catalog) {
      assert.equal(metric.historyIdentity, `${metric.metricId}@${metric.semanticVersion}`);
      assert.ok(metric.labels.singular);
      assert.ok(metric.labels.plural);
    }
  }
});

test("historical metric snapshots preserve labels across later configuration revisions", () => {
  const originalSnapshot = createPaidCustomerMetricLabelSnapshot({
    paidCustomerScope: previewScope(securityConfiguration),
    effectiveAt: "2026-07-26T12:00:00.000Z"
  });
  const originalMetric = securityConfiguration.terminology.metrics[0];
  const originalLabel = resolvePaidCustomerMetricLabel({
    metricId: originalMetric.metricId,
    count: 2,
    labelSnapshot: originalSnapshot
  });

  const changed = clone(securityConfiguration);
  changed.configurationRevision = 2;
  changed.provenance.configurationIdentity = `${changed.configurationId}@2`;
  const visitTerm = changed.terminology.terms.find(term => term.termId === "visit");
  visitTerm.singular = "site visit";
  visitTerm.plural = "site visits";
  const changedConfiguration = validateRouteIqPaidCustomerOnboardingConfiguration(changed);
  const changedSnapshot = createPaidCustomerMetricLabelSnapshot({
    paidCustomerScope: previewScope(changedConfiguration),
    effectiveAt: "2026-07-27T12:00:00.000Z"
  });
  const changedLabel = resolvePaidCustomerMetricLabel({
    metricId: originalMetric.metricId,
    count: 2,
    labelSnapshot: changedSnapshot
  });

  assert.equal(originalSnapshot.schemaVersion, routeIqMetricLabelSnapshotVersion);
  assert.equal(originalSnapshot.configurationVersion, "config_aster_security_services_v1@1");
  assert.equal(changedSnapshot.configurationVersion, "config_aster_security_services_v1@2");
  assert.equal(originalLabel.label, "assessments");
  assert.equal(changedLabel.label, "site visits");
  assert.equal(originalLabel.labelSource, "HISTORICAL_SNAPSHOT");
  assert.equal(
    originalSnapshot.definitions[0].historyIdentity,
    `${originalSnapshot.definitions[0].metricId}@${originalSnapshot.definitions[0].semanticVersion}`
  );
  assert.equal(Object.isFrozen(originalSnapshot), true);
  assert.equal(Object.isFrozen(originalSnapshot.definitions[0].labels), true);
});

test("hostile terminology and arbitrary fallback kinds are rejected", () => {
  const hostile = clone(securityConfiguration);
  hostile.terminology.terms.find(term => term.termId === "visit").singular =
    "<script>alert(1)</script>";
  assert.notDeepEqual(validatePaidCustomerIntelligenceOnboarding(hostile), []);

  assert.throws(() => normalizePaidCustomerMetricCatalog([
    {
      metricId: "synthetic_metric",
      fallbackKind: "outcome",
      labels: {
        singular: "${process.env.SECRET}",
        plural: "Synthetic metrics"
      }
    }
  ]), /unsafe/);
  assert.throws(() => resolvePaidCustomerMetricLabel({
    metricId: "synthetic_unknown_metric",
    count: 1,
    fallbackKind: "customer_supplied_fallback"
  }), /unsupported/);
});

test("six reusable templates remain customer-neutral and use stable generic metric IDs", () => {
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
});

test("unknown metrics use only controlled internal fallback labels", () => {
  assert.deepEqual(resolvePaidCustomerMetricLabel({
    metricId: "synthetic_unknown_metric",
    count: 1,
    fallbackKind: "outcome"
  }), {
    metricId: "synthetic_unknown_metric",
    label: "Outcome",
    labelSource: "CONTROLLED_GENERIC_FALLBACK"
  });
  assert.equal(resolvePaidCustomerMetricLabel({
    metricId: "synthetic_unknown_metric",
    count: 2,
    fallbackKind: "visit"
  }).label, "Visits");
});

test("synthetic cross-contract fixtures contain no real-customer or named-user assumptions", () => {
  const fixtureSource = readFileSync(
    new URL(
      "../administration/workspace-configurations/route-iq-paid-customer-synthetic-fixtures-v1.json",
      import.meta.url
    ),
    "utf8"
  );
  assert.doesNotMatch(fixtureSource, /Fitness Connection|Anthony|Cruz Garza/iu);
  assert.equal(routeIqPaidCustomerOnboardingContractVersion, "1.0.0");
});
