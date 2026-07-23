import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import {
  configuredCardFieldSet,
  dashboardActionLabel,
  dashboardCapabilityEnabled,
  formatAvailabilityLabel,
  formatEstimatedVisitDuration,
  governedRuntimeNetworkOnlyPath,
  legacyDashboardStorageKeys,
  loadGovernedDashboardPlatform,
  migrateDashboardState,
  projectConfiguredBusinessCard,
  revalidateImmediateRouteQueue,
  routeIqDashboardCacheName,
  routeIqDashboardPlatformVersion
} from "../dashboard/route-iq-dashboard-platform.mjs";
import {
  buildRouteBusinessHoursIndex,
  evaluateRouteBusinessHoursEligibility
} from "../intelligence/route-business-hours-eligibility.mjs";
import {
  buildAdaptiveIntelligenceSnapshot,
  createEmptyRouteQueue,
  maintainRouteQueue
} from "../intelligence/continuous-adaptive-route-replenishment.mjs";
import {
  createGovernedRouteRuntimeScopeFromConfiguration
} from "../intelligence/route-iq-governed-runtime-scope.mjs";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

function response(value) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: {
      "cache-control": "private, no-store",
      "content-type": "application/json"
    }
  });
}

function sha256(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function dashboardConfiguration(profileId) {
  return {
    terminology: {
      opportunity: profileId === "fitness" ? "fitness business" : "sales opportunity",
      visit: "field visit",
      outcome: "visit outcome",
      success: profileId === "fitness" ? "qualified conversation" : "qualified opportunity",
      followUp: "follow-up"
    },
    capabilities: [
      "view_route",
      "view_operating_hours",
      "open_directions",
      "record_visit",
      "correct_visit",
      "add_place",
      "save_place",
      "end_route",
      "end_day",
      "export_manual_report"
    ],
    cardFields: [
      { fieldId: "business_name", label: "Business", required: true },
      { fieldId: "business_type", label: "Business type", required: true },
      { fieldId: "operating_hours", label: "Operating hours", required: true },
      { fieldId: "availability_status", label: "Availability", required: true },
      { fieldId: "next_opening", label: "Next opening", required: false },
      { fieldId: "distance", label: "Distance", required: true },
      { fieldId: "estimated_visit_duration", label: "Estimated visit", required: true },
      profileId === "fitness"
        ? { fieldId: "unit_potential", label: "Unit potential", required: false }
        : { fieldId: "opportunity_stage", label: "Opportunity stage", required: false }
    ],
    filters: [{ filterId: "availability", label: "Availability", fieldId: "availability_status" }],
    sorts: [{ sortId: "distance", label: "Nearest", fieldId: "distance", direction: "asc" }],
    actions: [{ actionId: "open_directions", label: "Directions", allowedOutcomeIds: ["visited"] }],
    outcomes: [{ outcomeId: "visited", label: "Visited", classification: "OBSERVATION" }],
    kpis: [{ kpiId: "visits", label: "Visits", aggregation: "COUNT", sourceOutcomeIds: ["visited"] }]
  };
}

function harness({
  workspaceId = "fitness_connection",
  profileId = "fitness",
  classification = "FOUNDER_FIELD_RESEARCH",
  identityField = "recordId",
  recordId = "synthetic_business_001"
} = {}) {
  const territoryId = `${workspaceId}_territory`;
  const userId = `${workspaceId}_user`;
  const representativeId = `${workspaceId}_representative`;
  const rosterPath = `/data/fixtures/${workspaceId}-approved-roster.json`;
  const roster = {
    records: [{
      recordId,
      businessName: `${profileId} Synthetic Business`,
      address: "100 Validation Way, Example City, TX 77001",
      category: profileId === "fitness" ? "Fitness" : "Business Services",
      territoryId,
      expectedVisitDuration: "5-9",
      opportunityStage: "Qualified"
    }]
  };
  const rosterDigest = sha256(roster);
  const configuration = {
    schemaVersion: "route-iq-workspace-configuration-v2",
    registryVersion: "route-iq-cross-industry-workspaces-v2.1.0",
    product: "route_iq",
    authority: "prometheus_administration",
    limits: { maxCompanies: 2, maxNamedUsers: 40 },
    founderBoundary: {
      attendanceMode: "CRUZ_ONLY_ATTENDED",
      founderUserId: userId,
      anthonyMappingStatus: "UNMAPPED",
      externalTesterAccessAuthorized: false
    },
    safety: { collection: "OFF", activeCohorts: 0, recommendationInfluence: "OFF" },
    workspaces: [{
      workspaceId,
      companyId: workspaceId,
      lifecycle: classification === "SYNTHETIC_NONCANONICAL" ? "synthetic_validation_only" : "founder_research",
      admission: {
        status: classification === "SYNTHETIC_NONCANONICAL" ? "SYNTHETIC_VALIDATION_ONLY" : "FOUNDER_RESEARCH_ONLY",
        productionAuthorized: false,
        customerAuthorizationRef: null
      },
      company: {
        displayName: `${profileId} validation`,
        businessType: profileId,
        relationshipClassification: classification === "SYNTHETIC_NONCANONICAL" ? "SYNTHETIC_VALIDATION_FIXTURE" : "FOUNDER_FIELD_RESEARCH",
        publicRelationshipClaimsAllowed: false,
        brand: { productLabel: "Route IQ", primaryColor: "#102A43", accentColor: "#E11D48" }
      },
      operatingProfile: {
        profileId,
        profileVersion: "operating-profile-v2",
        industryId: profileId
      },
      locations: [{
        locationId: `${workspaceId}_location`,
        displayName: "Validation Location",
        territoryIds: [territoryId],
        active: true
      }],
      territories: [{
        territoryId,
        displayName: "Validation Territory",
        timezone: "America/Chicago",
        active: true
      }],
      roles: [{
        roleId: `${workspaceId}_role`,
        displayName: "Field Representative",
        capabilities: dashboardConfiguration(profileId).capabilities
      }],
      users: [{
        userId,
        representativeId,
        displayName: "Synthetic Representative",
        identityClass: classification === "SYNTHETIC_NONCANONICAL" ? "SYNTHETIC_NONCANONICAL" : "FOUNDER_ATTENDED",
        principalMappingStatus: classification === "SYNTHETIC_NONCANONICAL" ? "SYNTHETIC_ONLY" : "ATTENDED_REQUIRED",
        roleId: `${workspaceId}_role`,
        territoryIds: [territoryId],
        active: true
      }],
      dashboard: dashboardConfiguration(profileId),
      availabilityPolicy: {
        timezoneSource: "BUSINESS_LOCAL_IANA",
        freshnessCeilingHours: 24,
        immediateRecommendationRule: "FRESH_VERIFIED_OPEN_OR_ACCESS_WINDOW_ONLY",
        verifiedClosedRule: "INELIGIBLE_WITH_NEXT_OPENING",
        uncertainRule: "NON_RECOMMENDED_VERIFICATION_REQUIRED",
        appointmentOnlyRule: "VERIFIED_APPOINTMENT_OR_ACCESS_WINDOW_REQUIRED",
        providerFailureRule: "PRESERVE_PRIOR_EVIDENCE_AND_EXPIRE_NORMALLY",
        refreshMode: "GOVERNED_RUNTIME_ARTIFACT"
      },
      opportunitySources: [{
        sourceId: `${workspaceId}_approved_roster`,
        adapterId: "workspace_business_manifest_adapter_v1",
        manifestRegistryPath: "data/route-iq-commercial-readiness-v1/route-iq-workspace-business-artifact-manifest-registry-v1.json",
        manifestId: `${workspaceId}_approved_business_roster`,
        artifactPath: rosterPath.slice(1),
        artifactSchemaVersion: "route-iq-approved-opportunity-artifact-v1",
        workspaceId,
        profileId,
        providerId: "synthetic_owner_fixture_provider",
        classification,
        manifestApprovalState: classification === "SYNTHETIC_NONCANONICAL"
          ? "APPROVED_SYNTHETIC_VALIDATION"
          : "APPROVED",
        productionUseAuthorized: false
      }],
      fallbackPolicy: {
        mode: "FAIL_CLOSED",
        demoCatalogAllowed: false,
        embeddedBusinessCatalogAllowed: false,
        crossWorkspaceFallbackAllowed: false,
        missingSourceState: "CONFIGURATION_REQUIRED_EMPTY"
      },
      retention: {
        maximumCalendarMonths: 18,
        customerMayShorten: true,
        customerMayExpand: false,
        legalHoldSupported: true,
        dispositionMode: "APPEND_ONLY_AUDITABLE_DATA_OWNED"
      },
      provenance: {
        owner: "prometheus_administration",
        configurationVersion: "v2.1.0",
        sourceRefs: ["test-only"],
        approvalState: classification === "SYNTHETIC_NONCANONICAL" ? "SYNTHETIC_VALIDATION_ONLY" : "FOUNDER_RESEARCH_BOUNDARY_RECORDED"
      }
    }]
  };
  const manifest = {
    schemaVersion: "route-iq-workspace-business-artifact-manifest-v1",
    registryVersion: "route-iq-workspace-business-artifact-manifest-registry-v1",
    generatedAt: "2026-07-23T12:00:00.000Z",
    fallbackPolicy: "FAIL_CLOSED_NO_DEMO_OR_CROSS_WORKSPACE_FALLBACK",
    manifests: [{
      manifestId: `${workspaceId}_approved_business_roster`,
      manifestVersion: "route-iq-workspace-business-artifact-manifest-v1",
      workspaceId,
      operatingProfileId: profileId,
      configurationVersion: "route-iq-commercial-workspace-registry-v1",
      artifactType: "approved_business_opportunity_roster",
      artifactPath: rosterPath.slice(1),
      artifactSha256: rosterDigest,
      recordIdentityField: identityField,
      recordCount: 1,
      approvedRecordCount: 1,
      approvedRecordIds: [recordId],
      approvalState: classification === "SYNTHETIC_NONCANONICAL" ? "APPROVED_SYNTHETIC_VALIDATION" : "APPROVED",
      classification,
      sourceProvenance: {
        producer: "Prometheus Data",
        producerVersion: "test-only",
        sourceSystem: "deterministic_test_fixture",
        sourceRetrievedAt: "2026-07-23T12:00:00.000Z"
      },
      freshness: {
        maximumAgeHours: 24,
        evaluatedAt: "2026-07-23T12:00:00.000Z",
        expiresAt: "2026-07-24T12:00:00.000Z",
        state: classification === "SYNTHETIC_NONCANONICAL" ? "SYNTHETIC" : "FRESH"
      },
      productionUseAuthorized: false,
      demoFallbackAllowed: false,
      crossWorkspaceFallbackAllowed: false
    }]
  };
  const session = {
    contractVersion: "route-iq-customer-pwa-session-v2",
    authorizationState: "server_verified",
    workspaceId,
    workspaceLabel: `${profileId} validation`,
    operatingProfileId: profileId,
    userId,
    representativeId,
    displayName: "Synthetic Representative",
    roleId: "customer_representative",
    capabilities: {
      operateOwnRoute: true,
      readWorkspaceOperations: false,
      administerWorkspaceRoster: false,
      founderIntelligence: false,
      founderCrm: false
    },
    runtimeAssets: {
      workspaceConfiguration: "/administration/workspace-configurations/route-iq-cross-industry-workspaces-v2.json",
      businessManifestRegistry: "/data/route-iq-commercial-readiness-v1/route-iq-workspace-business-artifact-manifest-registry-v1.json",
      businessRoster: rosterPath,
      businessHours: `/data/fixtures/${workspaceId}-business-hours.json`
    },
    expiresAt: "2026-07-24T12:00:00.000Z",
    safety: { prospectiveCollection: "OFF", activeCohorts: 0, recommendationInfluence: "OFF" }
  };
  const values = new Map([
    [session.runtimeAssets.workspaceConfiguration, configuration],
    [session.runtimeAssets.businessManifestRegistry, manifest],
    [session.runtimeAssets.businessRoster, roster]
  ]);
  return {
    configuration,
    manifest,
    roster,
    session,
    fetchFn: async path => values.has(path) ? response(values.get(path)) : new Response(null, { status: 404 })
  };
}

function freshBusinessHoursArtifact(platform, evaluatedAt = "2026-07-23T15:00:00.000Z") {
  const candidate = platform.places[0];
  return {
    schemaVersion: "prometheus-data-business-hours-v1",
    artifactVersion: "business-hours-v1",
    generatedAt: "2026-07-23T14:55:00.000Z",
    statusEvaluatedAt: evaluatedAt,
    sourceRetrievedAt: "2026-07-23T14:55:00.000Z",
    workspaceId: candidate.workspaceId,
    operatingProfileId: candidate.operatingProfileId,
    sourceDatasetVersion: "dashboard-test-governed-runtime-v1",
    sourceArtifact: "tests/dashboard-cross-industry-platform.test.mjs",
    sourceCandidateCount: 1,
    recordCount: 1,
    refreshMode: "test-only",
    provider: "SYNTHETIC_NONCANONICAL",
    freshnessPolicy: {
      providerRefreshIntervalHours: 24,
      statusEvaluationIntervalMinutes: 15,
      freshnessThresholdHours: 24,
      fieldObservationFreshnessMinutes: 240,
      staleStatus: "HOURS_STALE",
      missingStatus: "HOURS_UNKNOWN",
      unverifiedSpecialHoursStatus: "SPECIAL_HOURS_UNVERIFIED"
    },
    routeEligibilityActivated: false,
    runtimeBehaviorChanged: false,
    scoringChanged: false,
    records: [{
      workspaceId: candidate.workspaceId,
      operatingProfileId: candidate.operatingProfileId,
      recordId: candidate.recordId,
      businessName: candidate.name,
      address: candidate.address,
      category: candidate.category,
      territoryId: candidate.territoryId,
      permanentOperationalStatus: "OPERATIONAL",
      regularWeeklyBusinessHours: {
        periods: [{
          open: { date: null, day: 4, hour: 8, minute: 0, truncated: null },
          close: { date: null, day: 4, hour: 18, minute: 0, truncated: null }
        }],
        sourceOpenNowAtRetrieval: true
      },
      specialOrHolidayHours: [],
      currentOpeningHoursWindow: {
        coverageStartDate: "2026-07-23",
        coverageEndDate: "2026-07-29",
        periods: [{
          open: { date: "2026-07-23", day: 4, hour: 8, minute: 0, truncated: null },
          close: { date: "2026-07-23", day: 4, hour: 18, minute: 0, truncated: null }
        }],
        specialDays: [],
        sourceOpenNowAtRetrieval: true,
        nextOpenTime: null,
        nextCloseTime: "2026-07-23T23:00:00.000Z"
      },
      businessTimezone: "America/Chicago",
      currentHoursSource: "SYNTHETIC_NONCANONICAL",
      sourceRetrievedAt: "2026-07-23T14:55:00.000Z",
      hoursVerifiedAt: "2026-07-23T14:55:00.000Z",
      hoursFreshnessStatus: "FRESH",
      hoursConfidence: "HIGH",
      hoursProvenance: {
        sourceSystem: "SYNTHETIC_NONCANONICAL",
        sourceMethod: "test_fixture",
        sourcePlaceId: candidate.recordId,
        retrievedAt: "2026-07-23T14:55:00.000Z",
        normalizedAt: "2026-07-23T14:55:00.000Z",
        fieldEvidenceIds: []
      }
    }]
  };
}

test("Fitness and general outside sales use the same configuration-driven Dashboard path", async () => {
  const fitness = harness();
  const outsideSales = harness({
    workspaceId: "northstar_outside_sales_synthetic",
    profileId: "general_outside_sales",
    classification: "SYNTHETIC_NONCANONICAL",
    recordId: "synthetic_sales_business_001"
  });
  const first = await loadGovernedDashboardPlatform({
    session: fitness.session,
    fetchFn: fitness.fetchFn,
    now: "2026-07-23T12:30:00.000Z"
  });
  const second = await loadGovernedDashboardPlatform({
    session: outsideSales.session,
    fetchFn: outsideSales.fetchFn,
    now: "2026-07-23T12:30:00.000Z",
    allowSynthetic: true
  });
  assert.equal(first.platformVersion, routeIqDashboardPlatformVersion);
  assert.equal(second.platformVersion, routeIqDashboardPlatformVersion);
  assert.equal(first.places.length, 1);
  assert.equal(second.places.length, 1);
  assert.equal(first.places[0].workspaceId, "fitness_connection");
  assert.equal(second.places[0].workspaceId, "northstar_outside_sales_synthetic");
  assert.notEqual(first.places[0].manifestRecordId, second.places[0].manifestRecordId);
  assert.equal(configuredCardFieldSet(first.workspace).has("opportunity_stage"), false);
  assert.equal(configuredCardFieldSet(second.workspace).has("opportunity_stage"), true);
});

test("Dashboard, hours, and route replenishment share one manifest-authenticated runtime scope", async () => {
  const fixture = {
    session: {
      contractVersion: "route-iq-customer-pwa-session-v2",
      authorizationState: "server_verified",
      workspaceId: "northstar_outside_sales_synthetic",
      workspaceLabel: "Northstar Outside Sales Synthetic",
      operatingProfileId: "general_outside_sales",
      userId: "northstar_synthetic_user_01",
      representativeId: "northstar_synthetic_rep_01",
      displayName: "Synthetic Representative",
      roleId: "outside_sales_representative",
      capabilities: {
        operateOwnRoute: true,
        readWorkspaceOperations: false,
        administerWorkspaceRoster: false,
        founderIntelligence: false,
        founderCrm: false
      },
      runtimeAssets: {
        workspaceConfiguration: "/administration/workspace-configurations/route-iq-cross-industry-workspaces-v2.json",
        businessManifestRegistry: "/data/route-iq-commercial-readiness-v1/route-iq-workspace-business-artifact-manifest-registry-v1.json",
        businessRoster: "/data/route-iq-commercial-readiness-v1/fixtures/general-outside-sales-synthetic-approved-businesses-v1.json",
        businessHours: "/data/route-iq-commercial-readiness-v1/fixtures/general-outside-sales-synthetic-business-hours-v1.json"
      },
      expiresAt: "2026-07-24T12:00:00.000Z",
      safety: { prospectiveCollection: "OFF", activeCohorts: 0, recommendationInfluence: "OFF" }
    }
  };
  const sourceByPath = new Map([
    [
      fixture.session.runtimeAssets.workspaceConfiguration,
      read("administration/workspace-configurations/route-iq-cross-industry-workspaces-v2.json")
    ],
    [
      fixture.session.runtimeAssets.businessManifestRegistry,
      read("data/route-iq-commercial-readiness-v1/route-iq-workspace-business-artifact-manifest-registry-v1.json")
    ],
    [
      fixture.session.runtimeAssets.businessRoster,
      read("data/route-iq-commercial-readiness-v1/fixtures/general-outside-sales-synthetic-approved-businesses-v1.json")
    ]
  ]);
  fixture.fetchFn = async path => sourceByPath.has(path)
    ? new Response(sourceByPath.get(path), {
        status: 200,
        headers: { "cache-control": "private, no-store", "content-type": "application/json" }
      })
    : new Response(null, { status: 404 });
  const platform = await loadGovernedDashboardPlatform({
    session: fixture.session,
    fetchFn: fixture.fetchFn,
    now: "2026-07-23T15:00:00.000Z",
    allowSynthetic: true
  });
  const businessHoursArtifact = freshBusinessHoursArtifact(platform);
  const governedRuntimeScope = createGovernedRouteRuntimeScopeFromConfiguration({
    workspaceRegistry: platform.workspaceRegistry,
    manifestRegistry: platform.manifestRegistry,
    workspaceId: fixture.session.workspaceId,
    operatingProfileId: fixture.session.operatingProfileId,
    sourceArtifactSha256: platform.sourceArtifactSha256,
    businessHoursArtifact,
    allowSynthetic: true
  });
  const index = buildRouteBusinessHoursIndex(businessHoursArtifact, {
    workspaceId: fixture.session.workspaceId,
    operatingProfileId: fixture.session.operatingProfileId,
    governedRuntimeScope
  });
  const candidate = platform.places[0];
  const eligibility = evaluateRouteBusinessHoursEligibility({
    record: index.recordsByIdentity.get(candidate.recordId),
    candidate,
    evaluatedAt: "2026-07-23T15:00:00.000Z",
    policy: index.freshnessPolicy,
    workspaceId: fixture.session.workspaceId,
    operatingProfileId: fixture.session.operatingProfileId,
    territoryId: candidate.territoryId,
    governedRuntimeScope
  });
  assert.equal(eligibility.immediateRecommendationEligible, true);
  const intelligence = buildAdaptiveIntelligenceSnapshot({
    workspaceId: fixture.session.workspaceId,
    operatingProfileId: fixture.session.operatingProfileId,
    governedRuntimeScope,
    representativeId: fixture.session.representativeId,
    places: platform.places,
    generatedAt: "2026-07-23T15:00:00.000Z"
  });
  const queue = createEmptyRouteQueue({
    workspaceId: fixture.session.workspaceId,
    operatingProfileId: fixture.session.operatingProfileId,
    governedRuntimeScope,
    representativeId: fixture.session.representativeId,
    routeDate: "2026-07-23"
  });
  const result = maintainRouteQueue({
    queue,
    workspaceId: fixture.session.workspaceId,
    operatingProfileId: fixture.session.operatingProfileId,
    governedRuntimeScope,
    representativeId: fixture.session.representativeId,
    routeDate: "2026-07-23",
    primaryCandidates: [candidate],
    force: true,
    now: "2026-07-23T15:00:00.000Z",
    scoreCandidate: () => ({ score: 1, selectionTier: 0, eligibility }),
    isEligible: () => true
  });
  assert.equal(intelligence.workspaceId, fixture.session.workspaceId);
  assert.equal(result.queue.entries.length, 1);
  assert.equal(result.queue.entries[0].placeId, candidate.id);
});

test("missing, malformed, mismatched, and stale runtime sources fail closed", async () => {
  const valid = harness();
  const missing = await loadGovernedDashboardPlatform({
    session: {
      ...valid.session,
      runtimeAssets: {
        ...valid.session.runtimeAssets,
        businessRoster: "/data/fixtures/missing-approved-roster.json"
      }
    },
    fetchFn: valid.fetchFn,
    now: "2026-07-23T12:30:00.000Z"
  }).then(() => null, error => error);
  assert.equal(missing.code, "route_iq_dashboard_business_manifest_invalid");

  const stale = structuredClone(valid.manifest);
  stale.manifests[0].freshness.expiresAt = "2026-07-23T12:01:00.000Z";
  const staleFetch = async path => path === valid.session.runtimeAssets.businessManifestRegistry
    ? response(stale)
    : valid.fetchFn(path);
  const result = await loadGovernedDashboardPlatform({
    session: valid.session,
    fetchFn: staleFetch,
    now: "2026-07-23T12:30:00.000Z"
  });
  assert.equal(result.status, "SOURCE_STALE");
  assert.deepEqual(result.places, []);

  const crossWorkspace = structuredClone(valid.configuration);
  crossWorkspace.workspaces[0].workspaceId = "another_workspace";
  const crossFetch = async path => path === valid.session.runtimeAssets.workspaceConfiguration
    ? response(crossWorkspace)
    : valid.fetchFn(path);
  await assert.rejects(
    loadGovernedDashboardPlatform({
      session: valid.session,
      fetchFn: crossFetch,
      now: "2026-07-23T12:30:00.000Z"
    }),
    error => error.code === "route_iq_dashboard_workspace_unknown"
  );
});

test("operating-time labels and estimated visit duration are distinct", () => {
  const close = {
    localDate: "2026-07-23",
    displayTime: "7:00 PM"
  };
  assert.equal(formatAvailabilityLabel({
    status: "OPEN_VERIFIED",
    effectiveInterval: { source: "REGULAR_WEEKLY_HOURS", twentyFourHours: false, end: close },
    nextClosing: close
  }), "Open now · closes 7:00 PM");
  assert.equal(formatAvailabilityLabel({
    status: "CLOSED_VERIFIED",
    nextOpening: { localDate: "2026-07-24", displayTime: "9:00 AM" }
  }), "Closed · opens Friday at 9:00 AM");
  assert.equal(formatAvailabilityLabel({
    status: "OPEN_VERIFIED",
    effectiveInterval: { twentyFourHours: true }
  }), "Open 24 hours");
  assert.equal(formatAvailabilityLabel({
    status: "OPEN_VERIFIED",
    effectiveInterval: { source: "VERIFIED_APPOINTMENT_WINDOW" }
  }), "Appointment window verified");
  assert.equal(formatAvailabilityLabel({ status: "HOURS_STALE" }), "Hours outdated · verification required");
  assert.equal(formatAvailabilityLabel({ status: "HOURS_UNKNOWN" }), "Hours unavailable · not route eligible");
  assert.equal(formatEstimatedVisitDuration("5-9 minutes"), "Estimated visit: 5–9 min");
});

test("persisted route entries are removed unless hours are freshly verified open", () => {
  const places = [
    { id: "stale", manifestRecordId: "stale_business" },
    { id: "open", manifestRecordId: "open_business" },
    { id: "closed", manifestRecordId: "closed_business" }
  ];
  const decisions = new Map([
    ["stale", { status: "HOURS_STALE", freshnessState: "STALE", immediateRecommendationEligible: false }],
    ["open", { status: "OPEN_VERIFIED", freshnessState: "FRESH", immediateRecommendationEligible: true }],
    ["closed", { status: "CLOSED_VERIFIED", freshnessState: "FRESH", immediateRecommendationEligible: false }]
  ]);
  const result = revalidateImmediateRouteQueue({
    entries: places.map(place => ({ placeId: place.id }))
  }, places, place => decisions.get(place.id));
  assert.deepEqual(result.queue.entries, [{ placeId: "open" }]);
  assert.deepEqual(result.removed.map(entry => entry.placeId), ["stale", "closed"]);
});

test("card projection hides unsupported profile fields and labels hours separately", () => {
  const fitness = harness();
  const workspace = fitness.configuration.workspaces[0];
  const place = {
    name: "Synthetic Wellness Center",
    category: "Fitness",
    distance: "1.2 mi",
    expectedVisitDuration: "5-9",
    opportunityStage: "Do not expose"
  };
  const card = projectConfiguredBusinessCard(place, workspace, {
    status: "HOURS_STALE"
  }, { visits: 2, unitPotential: 3 });
  assert.equal(card.operating_hours, "Hours outdated · verification required");
  assert.equal(card.estimated_visit_duration, "Estimated visit: 5–9 min");
  assert.equal(Object.hasOwn(card, "opportunity_stage"), false);
  assert.equal(card.unit_potential, 3);
  assert.equal(dashboardCapabilityEnabled(workspace, "open_directions"), true);
  assert.equal(dashboardCapabilityEnabled(workspace, "unsupported_capability"), false);
  assert.equal(dashboardActionLabel(workspace, "open_directions", "Open map"), "Directions");
});

test("cross-workspace and unauthorized-territory records are rejected before rendering", async () => {
  const valid = harness();
  valid.roster.records[0].territoryId = "another_workspace_territory";
  valid.manifest.manifests[0].artifactSha256 = sha256(valid.roster);
  valid.configuration.workspaces[0].opportunitySources[0].manifestApprovalState = valid.manifest.manifests[0].approvalState;
  await assert.rejects(
    loadGovernedDashboardPlatform({
      session: valid.session,
      fetchFn: valid.fetchFn,
      now: "2026-07-23T12:30:00.000Z"
    }),
    error => error.code === "route_iq_dashboard_business_roster_territory_invalid"
  );
});

test("storage migration removes old catalogs and cross-scope queues while retaining audit evidence", () => {
  const valid = harness();
  const manifest = valid.manifest.manifests[0];
  const state = {
    places: [
      {
        id: "approved",
        manifestRecordId: manifest.approvedRecordIds[0],
        manifestId: manifest.manifestId,
        manifestVersion: manifest.manifestVersion,
        manifestSha256: manifest.artifactSha256,
        candidateAdmission: "GOVERNED_APPROVED",
        workspaceId: valid.session.workspaceId,
        operatingProfileId: valid.session.operatingProfileId,
        repProfileId: valid.session.representativeId
      },
      {
        id: "legacy-seed",
        name: "Legacy Seed",
        workspaceId: valid.session.workspaceId,
        sourceType: "Embedded production seed"
      },
      {
        id: "manual",
        name: "Manual Discovery",
        workspaceId: valid.session.workspaceId,
        repProfileId: valid.session.representativeId,
        sourceType: "Dashboard Manual Entry",
        canRevisit: true
      },
      {
        id: "other-workspace",
        name: "Other Workspace",
        workspaceId: "another_workspace",
        sourceType: "Governed approved roster"
      }
    ],
    visits: [{ id: "visit-1", placeId: "legacy-seed", workspaceId: valid.session.workspaceId }],
    visitCorrections: [],
    routeHistory: [],
    repProfiles: {
      [valid.session.representativeId]: {
        activeRouteQueue: {
          entries: [
            { placeId: "approved", manifestRecordId: manifest.approvedRecordIds[0] },
            { placeId: "legacy-seed", manifestRecordId: "unapproved" }
          ]
        }
      },
      other_representative: { activeRouteQueue: { entries: [] } }
    }
  };
  const result = migrateDashboardState(state, {
    session: valid.session,
    manifest
  });
  assert.deepEqual(result.state.places.map(place => place.id), ["approved", "manual"]);
  assert.equal(result.state.places[1].candidateAdmission, "VERIFICATION_REQUIRED");
  assert.equal(result.state.places[1].canRevisit, false);
  assert.equal(result.state.historicalAuditPlaces.length, 1);
  assert.equal(result.state.historicalAuditPlaces[0].id, "legacy-seed");
  assert.deepEqual(Object.keys(result.state.repProfiles), [valid.session.representativeId]);
  assert.deepEqual(
    result.state.repProfiles[valid.session.representativeId].activeRouteQueue.entries,
    [{ placeId: "approved", manifestRecordId: manifest.approvedRecordIds[0] }]
  );
  assert.deepEqual(result.state.visits, state.visits);
});

test("legacy storage and governed network paths are deterministic", () => {
  const keys = [
    "field-production-tracker-v3",
    "prometheus-v1",
    "prometheus-v1:old:scope",
    "prometheus-runtime-catalog:old",
    "unrelated-setting"
  ];
  const storage = {
    length: keys.length,
    key: index => keys[index]
  };
  assert.deepEqual(legacyDashboardStorageKeys(storage, ["prometheus-v1"]), [
    "field-production-tracker-v3",
    "prometheus-v1:old:scope",
    "prometheus-runtime-catalog:old"
  ]);
  assert.equal(governedRuntimeNetworkOnlyPath("/app"), true);
  assert.equal(governedRuntimeNetworkOnlyPath("/api/dashboard/route-iq/customer/session"), true);
  assert.equal(governedRuntimeNetworkOnlyPath("/data/route-iq-commercial-readiness-v1/manifest.json"), true);
  assert.equal(governedRuntimeNetworkOnlyPath("/assets/icon.svg"), false);
});

test("Dashboard source contains no embedded business catalog or full-pool fallback", () => {
  const dashboard = read("index.html");
  const worker = read("sw.js");
  assert.doesNotMatch(dashboard, /const\s+(?:cruz|anthony)ApprovedRoutePlaces\s*=/u);
  assert.doesNotMatch(dashboard, /embeddedProductionPlaces|embedded-fallback|full runtime fallback/iu);
  assert.match(dashboard, /route-iq-dashboard-platform\.mjs/u);
  assert.match(worker, new RegExp(routeIqDashboardCacheName));
  assert.doesNotMatch(worker, /runtime-pools\\.json|active-pool\\.json|business-hours\\.json/u);
  assert.doesNotMatch(worker, /intelligence\/(?:continuous-adaptive-route-replenishment|route-business-hours-eligibility)/u);
  assert.match(worker, /event\.request\.method !== "GET" && event\.request\.method !== "HEAD"/u);
  assert.match(worker, /isGovernedNetworkOnlyPath\(requestUrl\.pathname\)/u);
  assert.equal(existsSync(new URL("../smoothie-depot-dashboard/index.html", import.meta.url)), false);
  assert.equal(existsSync(new URL("../demo-dashboard/index.html", import.meta.url)), false);
});
