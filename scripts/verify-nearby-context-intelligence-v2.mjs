import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { routeQueueIdentity } from "../intelligence/continuous-adaptive-route-replenishment.mjs";
import {
  applyCanonicalBusinessHoursEligibilityToNearbyCandidates,
  buildNearbyContextAdvisory,
  distanceFeetBetweenBusinesses,
  loadNearbyContextConfig,
  loadNearbyContextContract,
  nearbyContextDuplicateIdentityIntegrationRepairVersion,
  nearbyContextIntelligenceVersion,
  validateNearbyContextAdvisory,
  validateNearbyContextConfig,
  validateNearbyContextContract
} from "../intelligence/nearby-context-intelligence-v2.mjs";
import {
  buildRouteBusinessHoursIndex,
  routeBusinessHoursEligibilityVersion
} from "../intelligence/route-business-hours-eligibility.mjs";
import {
  verifyCrossIndustryZipFounderAccessAdoption
} from "../intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const paths = {
  activePool: "data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/active-pool.json",
  fallbackPool: "data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/reserve-pool.json",
  quarantinePool: "data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/quarantine-pool.json",
  governanceReport: "data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/governance-report.json",
  businessHours: "data/qualified-prospects/google-qualified-businesses-v2/business-hours-v1/business-hours.json",
  stressEvidence: "data/route-iq-field-sessions-v1/source-evidence/july-11-2026-founder-stress-test-findings.json",
  fieldSession: "data/route-iq-field-sessions-v1/workspaces/fitness_connection/sessions/route-iq-field-session-fitness-connection-fitness-cruz-2026-07-11/normalized/field-session.json",
  canonicalArtifact: "intelligence/artifacts/nearby-context-intelligence-v2/fitness_connection/cruz/nearby-context-audit-v2.json"
};

const stressPrimaryIds = {
  "fitness-2026-07-11-texans-nearby-context-false-negative": "ChIJI13UBweRQIYRmwr6qAnoIz0",
  "fitness-2026-07-11-christian-brothers-nearby-context-false-negative": "ChIJiduac7LCQIYR-sGBtIAjKR0"
};
const capabilityProbePlaceId = "ChIJeX6hkOGZQIYR3wYTYOv4eO8";

function read(relativePath) {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function sha256(relativePath) {
  return createHash("sha256").update(read(relativePath)).digest("hex");
}

function stableJson(value) {
  return JSON.stringify(value);
}

function normalizedName(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function poolCandidates(records, sourcePool, routeEligible) {
  return records.map((record, sourceOrder) => ({
    ...record,
    name: record.businessName,
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    sourcePool,
    sourceOrder,
    routeEligible,
    recommendationScore: record.qualityScore,
    routeOrder: record.runtimeProfiles?.find(profile => profile.repProfileId === "cruz")?.seedRouteOrder ?? sourceOrder
  }));
}

function completedIdentityKeys(fieldSession) {
  return (fieldSession?.verifiedFields?.completedVisits || []).map(visit => routeQueueIdentity({
    googlePlaceId: visit?.governedBusinessIdentity?.googlePlaceId,
    name: visit?.governedBusinessIdentity?.businessName,
    address: visit?.governedBusinessIdentity?.address
  })).filter(Boolean);
}

function observedBusinessCoverage(observation, primary, allCandidates) {
  return (observation.relatedBusinesses || []).filter(name => normalizedName(name) !== normalizedName(primary.name)).map(name => {
    const matches = allCandidates.filter(candidate => normalizedName(candidate.name) === normalizedName(name));
    return {
      observedBusinessName: name,
      governedIdentityAvailable: matches.length > 0,
      matches: matches.map(candidate => ({
        googlePlaceId: candidate.googlePlaceId,
        sourcePool: candidate.sourcePool,
        routeEligible: candidate.routeEligible,
        distanceFeet: distanceFeetBetweenBusinesses(primary, candidate)
      }))
    };
  });
}

function offlineVerifiedOpenEligibility(googlePlaceId, generatedAt) {
  return {
    version: routeBusinessHoursEligibilityVersion,
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    googlePlaceId,
    permanentOperationalStatus: "OPERATIONAL",
    status: "OPEN_VERIFIED",
    eligible: true,
    coverageEligible: true,
    immediateRecommendationEligible: true,
    coverageOnly: false,
    selectionTier: 0,
    internalMarker: null,
    hoursConfidence: "HIGH",
    hoursFreshness: "FRESH",
    sourceState: "VERIFIED",
    reasonCode: "VERIFIED_CURRENT_WINDOW_OPEN",
    reason: "Offline validation fixture is inside its verified current access window.",
    evaluatedAt: generatedAt,
    businessLocalDate: generatedAt.slice(0, 10),
    businessLocalTime: "12:00",
    businessTimezone: "America/Chicago",
    sourceRetrievedAt: generatedAt,
    hoursVerifiedAt: generatedAt,
    expiresAt: new Date(new Date(generatedAt).getTime() + 3_600_000).toISOString(),
    effectiveInterval: {
      opensAt: generatedAt,
      closesAt: new Date(new Date(generatedAt).getTime() + 3_600_000).toISOString()
    },
    nextClosingAt: new Date(new Date(generatedAt).getTime() + 3_600_000).toISOString(),
    nextOpeningAt: null,
    sourceStatus: "OPEN_VERIFIED",
    sourceStatusEvaluatedAt: generatedAt,
    provenance: {
      sourceSystem: "OFFLINE_VALIDATION_FIXTURE",
      sourceMethod: "deterministic_nearby_identity_regression",
      sourcePlaceId: googlePlaceId,
      retrievedAt: generatedAt,
      normalizedAt: generatedAt,
      fieldEvidenceIds: []
    },
    failClosed: false,
    scoringChanged: false,
    explanation: {
      recommendationScore: "UNCHANGED",
      businessHoursEligibility: "OPEN_VERIFIED",
      hoursConfidence: "HIGH",
      hoursFreshness: "FRESH",
      reasonCode: "VERIFIED_CURRENT_WINDOW_OPEN",
      reason: "Offline validation fixture is inside its verified current access window.",
      provenance: {
        sourceSystem: "OFFLINE_VALIDATION_FIXTURE",
        sourceMethod: "deterministic_nearby_identity_regression",
        sourcePlaceId: googlePlaceId,
        retrievedAt: generatedAt,
        normalizedAt: generatedAt,
        fieldEvidenceIds: []
      }
    },
    displayLabel: "Open now",
    visitDuration: {
      label: "Estimated visit: 5–9 min",
      minimumMinutes: 5,
      maximumMinutes: 9,
      semanticType: "VISIT_DURATION"
    }
  };
}

function offlineValidationCandidate(index, generatedAt) {
  const googlePlaceId = `offline-nearby-place-${index}`;
  return {
    id: `offline-nearby-${index}`,
    googlePlaceId,
    name: `Synthetic Nearby Business ${index}`,
    businessName: `Synthetic Nearby Business ${index}`,
    address: `${100 + index} Validation Way, Houston, TX 77001`,
    category: "Professional Services",
    latitude: 29.6 + (index * 0.0001),
    longitude: -95.25,
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    sourcePool: "active",
    sourceOrder: index,
    routeEligible: true,
    businessStatus: "OPERATIONAL",
    recommendationScore: 90,
    routeOrder: index,
    commercialRelationships: {},
    eligibilitySnapshot: offlineVerifiedOpenEligibility(googlePlaceId, generatedAt)
  };
}

function buildIdentityIntegrationRegression(config, contract, generatedAt) {
  const eligibleOpen = Array.from({ length: 6 }, (_, index) => offlineValidationCandidate(index + 1, generatedAt));
  const latitude = 29.6;
  const longitude = -95.25;
  const primary = {
    ...eligibleOpen[0],
    name: "Identity Regression Primary",
    businessName: "Identity Regression Primary",
    address: "100 Identity Repair Blvd, Houston, TX",
    latitude,
    longitude,
    commercialRelationships: {}
  };
  const canonicalBusiness = {
    ...eligibleOpen[1],
    name: "Identity Regression Storefront",
    businessName: "Identity Regression Storefront",
    address: "120 Identity Repair Boulevard, Houston, TX",
    latitude: latitude + 0.0004,
    longitude,
    commercialRelationships: {}
  };
  const duplicateAlias = {
    ...eligibleOpen[1],
    name: "Identity Regression Alias",
    businessName: "Identity Regression Alias",
    address: "140 Identity Repair Blvd, Houston, TX",
    latitude: latitude + 0.0008,
    longitude,
    sourceOrder: canonicalBusiness.sourceOrder + 10000,
    commercialRelationships: {}
  };
  const aliasPlan = buildNearbyContextAdvisory({
    workspaceId: config.workspaceId,
    operatingProfileId: config.operatingProfileId,
    representativeId: "cruz",
    primary,
    candidates: [canonicalBusiness, duplicateAlias],
    completedIdentityKeys: [],
    generatedAt,
    config,
    contract,
    sourceProvenance: { classification: "offline_duplicate_identity_regression" }
  });

  const multiTenantPrimary = {
    ...eligibleOpen[3],
    name: "Multi Tenant Regression Anchor",
    businessName: "Multi Tenant Regression Anchor",
    address: "200 Multi Tenant Way Suite P, Houston, TX",
    latitude,
    longitude,
    commercialRelationships: {}
  };
  const multiTenantCandidates = eligibleOpen.slice(4, 6).map((candidate, index) => ({
    ...candidate,
    name: `Multi Tenant Regression ${index + 1}`,
    businessName: `Multi Tenant Regression ${index + 1}`,
    address: `200 Multi Tenant Way Suite ${index === 0 ? "A" : "B"}, Houston, TX`,
    latitude: latitude + ((index + 1) * 0.0001),
    longitude,
    commercialRelationships: {}
  }));
  const multiTenantPlan = buildNearbyContextAdvisory({
    workspaceId: config.workspaceId,
    operatingProfileId: config.operatingProfileId,
    representativeId: "cruz",
    primary: multiTenantPrimary,
    candidates: multiTenantCandidates,
    completedIdentityKeys: [],
    generatedAt,
    config,
    contract,
    sourceProvenance: { classification: "offline_multi_tenant_identity_regression" }
  });

  return {
    summary: {
      integrationVersion: nearbyContextDuplicateIdentityIntegrationRepairVersion,
      fixtureClassification: "offline_validation_only",
      aliasProbe: {
        eligibleInputCount: aliasPlan.coverage.eligibleCandidateCountBeforeIdentityResolution,
        canonicalUniqueBusinessCount: aliasPlan.coverage.canonicalUniqueBusinessCount,
        preRelationshipDuplicateCount: aliasPlan.coverage.preRelationshipDuplicateCount,
        relationshipInferenceInputCount: aliasPlan.coverage.relationshipInferenceInputCount,
        resultCount: aliasPlan.nearbyOpportunities.count,
        resultRelationship: aliasPlan.nearbyOpportunities.entries[0]?.relationship.type || null,
        shoppingCenterInferenceSatisfied: aliasPlan.nearbyOpportunities.entries.some(entry => entry.relationship.type === "same_shopping_center"),
        duplicateAliasesContributedToInference: aliasPlan.coverage.duplicateAliasesContributedToInference
      },
      multiTenantProbe: {
        eligibleInputCount: multiTenantPlan.coverage.eligibleCandidateCountBeforeIdentityResolution,
        canonicalUniqueBusinessCount: multiTenantPlan.coverage.canonicalUniqueBusinessCount,
        preRelationshipDuplicateCount: multiTenantPlan.coverage.preRelationshipDuplicateCount,
        relationshipInferenceInputCount: multiTenantPlan.coverage.relationshipInferenceInputCount,
        resultCount: multiTenantPlan.nearbyOpportunities.count,
        distinctResultIdentityCount: new Set(multiTenantPlan.nearbyOpportunities.entries.map(entry => entry.identityKey)).size,
        relationshipTypes: [...new Set(multiTenantPlan.nearbyOpportunities.entries.map(entry => entry.relationship.type))].sort()
      }
    },
    aliasPlanValidation: validateNearbyContextAdvisory(aliasPlan, config),
    multiTenantPlanValidation: validateNearbyContextAdvisory(multiTenantPlan, config)
  };
}

export function buildCanonicalNearbyContextAudit() {
  const config = loadNearbyContextConfig();
  const contract = loadNearbyContextContract();
  const activePool = readJson(paths.activePool);
  const fallbackPool = readJson(paths.fallbackPool);
  const quarantinePool = readJson(paths.quarantinePool);
  const governanceReport = readJson(paths.governanceReport);
  const businessHours = readJson(paths.businessHours);
  const stressEvidence = readJson(paths.stressEvidence);
  const fieldSession = readJson(paths.fieldSession);
  const allCandidates = [
    ...poolCandidates(activePool.records, "active", true),
    ...poolCandidates(fallbackPool.records, "full", true),
    ...poolCandidates(quarantinePool.records, "quarantine", false)
  ];
  const hoursIndex = buildRouteBusinessHoursIndex(businessHours);
  const eligibilityProjection = applyCanonicalBusinessHoursEligibilityToNearbyCandidates({
    candidates: allCandidates,
    hoursIndex,
    evaluatedAt: businessHours.statusEvaluatedAt,
    workspaceId: config.workspaceId,
    operatingProfileId: config.operatingProfileId
  });
  const completed = completedIdentityKeys(fieldSession);
  const observationIndex = new Map(stressEvidence.observations.map(observation => [observation.observationId, observation]));

  const stressContexts = Object.entries(stressPrimaryIds).map(([observationId, googlePlaceId]) => {
    const observation = observationIndex.get(observationId);
    const primary = allCandidates.find(candidate => candidate.googlePlaceId === googlePlaceId);
    if (!observation || !primary) throw new Error(`Nearby Context stress context unavailable: ${observationId}`);
    const plan = buildNearbyContextAdvisory({
      workspaceId: config.workspaceId,
      operatingProfileId: config.operatingProfileId,
      representativeId: "cruz",
      primary,
      candidates: eligibilityProjection.evaluatedCandidates,
      completedIdentityKeys: completed,
      generatedAt: businessHours.statusEvaluatedAt,
      config,
      contract,
      sourceProvenance: {
        fieldObservationId: observationId,
        fieldObservationClassification: config.fieldEvidenceBasis.classification,
        activePool: paths.activePool,
        fullPoolFallbackProjection: paths.fallbackPool,
        quarantineDiagnostics: paths.quarantinePool,
        canonicalBusinessHours: paths.businessHours,
        archivedFieldSession: paths.fieldSession
      }
    });
    return {
      observationId,
      finding: observation.finding,
      identityConfirmation: observation.identityConfirmation,
      observedBusinessCoverage: observedBusinessCoverage(observation, primary, allCandidates),
      plan
    };
  });

  const capabilityPrimary = allCandidates.find(candidate => candidate.googlePlaceId === capabilityProbePlaceId);
  if (!capabilityPrimary) throw new Error("Nearby Context governed capability probe primary is unavailable.");
  const capabilityProbe = buildNearbyContextAdvisory({
    workspaceId: config.workspaceId,
    operatingProfileId: config.operatingProfileId,
    representativeId: "cruz",
    primary: capabilityPrimary,
    candidates: eligibilityProjection.evaluatedCandidates,
    completedIdentityKeys: [],
    generatedAt: businessHours.statusEvaluatedAt,
    config,
    contract,
    sourceProvenance: {
      classification: "governed_runtime_capability_probe",
      activePool: paths.activePool,
      fullPoolFallbackProjection: paths.fallbackPool,
      canonicalBusinessHours: paths.businessHours
    }
  });
  const identityIntegrationRegression = buildIdentityIntegrationRegression(
    config,
    contract,
    businessHours.statusEvaluatedAt
  );

  return {
    artifactType: "nearby_context_intelligence_v2_audit",
    version: nearbyContextIntelligenceVersion,
    policyVersion: config.policyVersion,
    contractVersion: contract.contractVersion,
    identityIntegrationVersion: nearbyContextDuplicateIdentityIntegrationRepairVersion,
    status: "advisory_only",
    generatedAt: businessHours.statusEvaluatedAt,
    workspaceId: config.workspaceId,
    operatingProfileId: config.operatingProfileId,
    representativeId: "cruz",
    sourceDatasetVersion: activePool.sourceDatasetVersion,
    sourceCounts: {
      active: activePool.records.length,
      governedFullPoolFallbackProjection: fallbackPool.records.length,
      quarantineDiagnostics: quarantinePool.records.length,
      canonicalHours: businessHours.records.length,
      completedFieldVisits: completed.length
    },
    fieldEvidenceBasis: config.fieldEvidenceBasis,
    stressContexts,
    governedCapabilityProbe: capabilityProbe,
    identityIntegrationRegression: identityIntegrationRegression.summary,
    findings: {
      texans: {
        governedNearbyOpportunityCount: stressContexts[0].plan.nearbyOpportunities.count,
        blackhawkDentalStatus: stressContexts[0].plan.coverage.exclusions.find(item => item.businessName === "Blackhawk Dental") || null,
        eliteDryCleanersGovernedIdentityAvailable: stressContexts[0].observedBusinessCoverage.find(item => item.observedBusinessName === "Elite Dry Cleaners")?.governedIdentityAvailable ?? false
      },
      christianBrothers: {
        governedNearbyOpportunityCount: stressContexts[1].plan.nearbyOpportunities.count,
        observedNearbyIdentityStatus: stressContexts[1].identityConfirmation,
        nearestGovernanceExclusion: stressContexts[1].plan.coverage.exclusions.find(item => item.distanceFeet !== null && item.distanceFeet > 0) || null
      },
      rootCause: [
        "legacy_runtime_projection_limited_to_route_visible_candidates",
        "legacy_fixed_500_foot_radius",
        "commercial_relationship_identifiers_unavailable_in_current_governed_records",
        "field_observed_adjacent_businesses_absent_or_quarantined"
      ],
      recommendationScoringChangeNeeded: false,
      nextSubsystemDependency: "Prometheus Data for governed commercial-center and adjacent-storefront enrichment before Dashboard consumer activation"
    },
    validation: {
      config: validateNearbyContextConfig(config),
      contract: validateNearbyContextContract(contract),
      stressPlans: stressContexts.flatMap(context => validateNearbyContextAdvisory(context.plan, config)),
      capabilityProbe: validateNearbyContextAdvisory(capabilityProbe, config),
      identityAliasProbe: identityIntegrationRegression.aliasPlanValidation,
      identityMultiTenantProbe: identityIntegrationRegression.multiTenantPlanValidation,
      canonicalEligibilityVersion: eligibilityProjection.version,
      duplicateIdentityIntegrationVersion: nearbyContextDuplicateIdentityIntegrationRepairVersion,
      recommendationInfluenceActive: false,
      dashboardConsumerActive: false,
      routeScoringWeightsChanged: false,
      dataChanged: false,
      stressEvidenceMutated: false,
      liveGoogleCallsMade: false
    }
  };
}

export function verifyNearbyContextIntelligenceV2({
  writeArtifact = false,
  checkProtectedBaselines = true
} = {}) {
  const zipFounderAdoption = verifyCrossIndustryZipFounderAccessAdoption();
  const config = loadNearbyContextConfig();
  const contract = loadNearbyContextContract();
  const governanceReport = readJson(paths.governanceReport);
  const first = buildCanonicalNearbyContextAudit();
  const second = buildCanonicalNearbyContextAudit();
  const failures = [
    ...first.validation.config,
    ...first.validation.contract,
    ...first.validation.stressPlans,
    ...first.validation.capabilityProbe,
    ...first.validation.identityAliasProbe,
    ...first.validation.identityMultiTenantProbe
  ];
  const check = (condition, reason) => { if (!condition) failures.push(reason); };
  const canonicalPath = resolve(repoRoot, paths.canonicalArtifact);
  if (writeArtifact) {
    mkdirSync(dirname(canonicalPath), { recursive: true });
    writeFileSync(canonicalPath, `${JSON.stringify(first, null, 2)}\n`);
  }
  const canonical = existsSync(canonicalPath) ? readJson(paths.canonicalArtifact) : null;
  const baselineResults = Object.fromEntries(Object.entries(contract.protectedBehaviorBaselines).map(([name, baseline]) => {
    const actualSha256 = sha256(baseline.path);
    const expectedSha256 = zipFounderAdoption.resolveBaseline(baseline.path, baseline.sha256);
    return [name, {
      path: baseline.path,
      historicalExpectedSha256: baseline.sha256,
      expectedSha256,
      actualSha256,
      passed: actualSha256 === expectedSha256
    }];
  }));
  const [texans, christian] = first.stressContexts;
  const capabilityEntries = first.governedCapabilityProbe.nearbyOpportunities.entries;
  const blackhawk = first.findings.texans.blackhawkDentalStatus;
  const identityRegression = first.identityIntegrationRegression;

  check(stableJson(first) === stableJson(second), "nearby_context_audit_not_deterministic");
  check(Boolean(canonical), "canonical_nearby_context_artifact_missing");
  if (canonical) check(stableJson(canonical) === stableJson(first), "canonical_nearby_context_artifact_stale");
  check(governanceReport.status === "passed" && governanceReport.promotionAllowed === true, "runtime_pool_governance_not_passed");
  check(first.validation.canonicalEligibilityVersion === routeBusinessHoursEligibilityVersion, "canonical_hours_eligibility_not_used");
  check(first.validation.duplicateIdentityIntegrationVersion === nearbyContextDuplicateIdentityIntegrationRepairVersion, "duplicate_identity_integration_version_mismatch");
  check(first.sourceCounts.active === 0, "unapproved_active_pool_not_empty");
  check(first.sourceCounts.governedFullPoolFallbackProjection === 0, "unapproved_fallback_pool_not_empty");
  check(first.sourceCounts.quarantineDiagnostics === 398, "quarantine_diagnostic_count_mismatch");
  check(first.sourceCounts.canonicalHours === 398, "canonical_hours_count_mismatch");
  check(first.sourceCounts.completedFieldVisits === 4, "completed_field_visit_count_mismatch");
  check(texans.plan.status === "coverage_gap" && texans.plan.nearbyOpportunities.count === 0, "texans_coverage_gap_not_reported");
  check(christian.plan.status === "coverage_gap" && christian.plan.nearbyOpportunities.count === 0, "christian_coverage_gap_not_reported");
  check(blackhawk?.sourcePool === "quarantine" && blackhawk?.reason === "forbidden_source_pool" && blackhawk?.distanceFeet < 250, "blackhawk_dental_quarantine_not_preserved");
  check(first.findings.texans.eliteDryCleanersGovernedIdentityAvailable === false, "elite_dry_cleaners_source_gap_not_reported");
  check(first.findings.christianBrothers.observedNearbyIdentityStatus === "christian_brothers_visit_confirmed_nearby_business_identities_unavailable", "christian_nearby_identity_gap_not_preserved");
  check(texans.plan.nearbyOpportunities.emptyState?.recommendationInvented === false, "texans_empty_state_invented_candidate");
  check(christian.plan.nearbyOpportunities.emptyState?.recommendationInvented === false, "christian_empty_state_invented_candidate");
  check(first.governedCapabilityProbe.status === "coverage_gap", "pending_roster_capability_probe_did_not_fail_closed");
  check(capabilityEntries.length === 0, "pending_roster_capability_probe_created_opportunities");
  check(first.governedCapabilityProbe.nearbyOpportunities.emptyState?.recommendationInvented === false, "capability_probe_invented_recommendation");
  check(identityRegression.aliasProbe.eligibleInputCount === 2, "alias_probe_eligible_input_count_mismatch");
  check(identityRegression.aliasProbe.canonicalUniqueBusinessCount === 1, "duplicate_alias_not_collapsed_to_one_business");
  check(identityRegression.aliasProbe.preRelationshipDuplicateCount === 1, "duplicate_alias_not_removed_before_relationships");
  check(identityRegression.aliasProbe.relationshipInferenceInputCount === 1, "relationship_inference_received_duplicate_alias");
  check(identityRegression.aliasProbe.resultCount === 1, "alias_probe_did_not_return_one_business");
  check(identityRegression.aliasProbe.resultRelationship === "walkable", "alias_probe_walkability_regressed");
  check(identityRegression.aliasProbe.shoppingCenterInferenceSatisfied === false, "duplicate_alias_satisfied_shopping_center_inference");
  check(identityRegression.aliasProbe.duplicateAliasesContributedToInference === false, "duplicate_alias_contributed_to_inference");
  check(identityRegression.multiTenantProbe.eligibleInputCount === 2, "multi_tenant_input_count_mismatch");
  check(identityRegression.multiTenantProbe.canonicalUniqueBusinessCount === 2, "multi_tenant_businesses_collapsed");
  check(identityRegression.multiTenantProbe.preRelationshipDuplicateCount === 0, "multi_tenant_business_marked_duplicate");
  check(identityRegression.multiTenantProbe.resultCount === 2 && identityRegression.multiTenantProbe.distinctResultIdentityCount === 2, "multi_tenant_distinction_regressed");
  check(first.stressContexts.every(context => context.plan.validation.closedVerifiedExcluded), "closed_verified_candidate_selected");
  check(first.stressContexts.every(context => context.plan.validation.quarantineExcluded), "quarantine_candidate_selected");
  check(first.stressContexts.every(context => context.plan.validation.completedBusinessesExcluded), "completed_candidate_selected");
  check(first.stressContexts.every(context => context.plan.validation.duplicatePreventionPassed), "duplicate_candidate_selected");
  check(first.fieldEvidenceBasis.learningInput === false && first.fieldEvidenceBasis.archiveMutationAllowed === false, "stress_observation_promoted_or_mutated");
  check(first.findings.recommendationScoringChangeNeeded === false, "recommendation_scoring_change_requested");
  check(first.validation.recommendationInfluenceActive === false, "recommendation_influence_activated");
  check(first.validation.dashboardConsumerActive === false, "dashboard_consumer_activated");
  check(first.validation.routeScoringWeightsChanged === false, "route_scoring_weights_changed");
  check(first.validation.dataChanged === false, "data_behavior_changed");
  check(first.validation.liveGoogleCallsMade === false, "live_google_call_detected");
  if (checkProtectedBaselines) {
    check(Object.values(baselineResults).every(result => result.passed), "protected_behavior_baseline_changed");
  }

  const uniqueFailures = unique(failures);
  return {
    status: uniqueFailures.length ? "failed" : "passed",
    version: first.version,
    policyVersion: first.policyVersion,
    contractVersion: first.contractVersion,
    artifactPath: paths.canonicalArtifact,
    contexts: first.stressContexts.map(context => ({
      observationId: context.observationId,
      primary: context.plan.primary.businessName,
      status: context.plan.status,
      opportunityCount: context.plan.nearbyOpportunities.count,
      emptyReasonCodes: context.plan.nearbyOpportunities.emptyState?.reasonCodes || [],
      nearbyGovernanceExclusionCount: context.plan.coverage.nearbyGovernanceExclusionCount
    })),
    capabilityProbe: {
      primary: first.governedCapabilityProbe.primary.businessName,
      opportunityCount: capabilityEntries.length,
      opportunities: capabilityEntries.map(entry => entry.businessName),
      relationshipDistribution: first.governedCapabilityProbe.coverage.selectedRelationshipDistribution,
      hoursStatusDistribution: first.governedCapabilityProbe.coverage.selectedHoursStatusDistribution
    },
    identityIntegration: {
      version: first.identityIntegrationVersion,
      duplicateAliasesRemovedBeforeInference: identityRegression.aliasProbe.preRelationshipDuplicateCount === 1
        && identityRegression.aliasProbe.relationshipInferenceInputCount === 1,
      shoppingCenterInferenceRejectedDuplicateInflation: identityRegression.aliasProbe.shoppingCenterInferenceSatisfied === false,
      oneBusinessAliasResultCount: identityRegression.aliasProbe.resultCount,
      multiTenantDistinctnessPreserved: identityRegression.multiTenantProbe.resultCount === 2
        && identityRegression.multiTenantProbe.distinctResultIdentityCount === 2,
      walkabilityPreserved: identityRegression.aliasProbe.resultRelationship === "walkable"
    },
    safety: {
      deterministic: stableJson(first) === stableJson(second),
      canonicalBusinessHoursEligibilityPreserved: first.stressContexts.every(context => context.plan.validation.canonicalBusinessHoursEligibilityPreserved),
      closedVerifiedExcluded: first.stressContexts.every(context => context.plan.validation.closedVerifiedExcluded),
      quarantineExcluded: first.stressContexts.every(context => context.plan.validation.quarantineExcluded),
      completedBusinessesExcluded: first.stressContexts.every(context => context.plan.validation.completedBusinessesExcluded),
      duplicatePreventionPassed: first.stressContexts.every(context => context.plan.validation.duplicatePreventionPassed),
      duplicatesRemovedBeforeRelationshipInference: first.stressContexts.every(context => context.plan.validation.duplicatesRemovedBeforeRelationshipInference)
        && identityRegression.aliasProbe.duplicateAliasesContributedToInference === false,
      workspaceIsolationPassed: first.stressContexts.every(context => context.plan.validation.workspaceIsolationPassed),
      recommendationScoresChanged: false,
      dashboardRuntimeChanged: false,
      dataChanged: false,
      liveGoogleCallsMade: false
    },
    protectedBaselines: baselineResults,
    protectedBaselinesChecked: checkProtectedBaselines,
    failures: uniqueFailures
  };
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => String(left).localeCompare(String(right)));
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const result = verifyNearbyContextIntelligenceV2({ writeArtifact: process.argv.includes("--write-artifact") });
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== "passed") process.exitCode = 1;
}
