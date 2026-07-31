import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer as createSecureServer } from "node:https";
import { accessSync, constants as fsConstants, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { delimiter, extname, join, normalize, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { createPaidCustomerRevenueReadinessViewModel } from "../dashboard/route-iq-paid-customer-revenue-readiness.mjs";

const root = resolve(import.meta.dirname, "..");
const dashboardRoot = resolve(root, "deploy/cloudflare-pages");
const activePoolPath = "data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/active-pool.json";
const fullPoolPath = "data/qualified-prospects/google-qualified-businesses-v2/runtime-pools.json";
const fieldSessionHandoffPath = "api/dashboard/route-iq/field-session";
const prospectiveEventPath = "api/dashboard/route-iq/prospective/event";
const founderDailyIntelligencePath = "api/dashboard/route-iq/intelligence/daily-snapshot";
const founderRevenueReadinessPath = "api/dashboard/route-iq/internal/paid-customer-revenue-readiness";
const founderDailyIntelligenceArtifactPath = resolve(root, "intelligence/artifacts/route-iq-commercial-readiness-v1/fitness_connection/founder-daily-intelligence-snapshot-v1.json");
const canonicalFounderDailyIntelligenceSnapshot = JSON.parse(readFileSync(founderDailyIntelligenceArtifactPath, "utf8"));
const prospectiveBootstrapContractVersion = "route-iq-prospective-browser-bootstrap-v1";
const prospectiveEventContractVersion = "route-iq-prospective-browser-event-v1";
const prospectiveRuntimeContextContractVersion = "route-iq-prospective-runtime-context-v1";
const prospectiveCoordinatorContractVersion = "route-iq-prospective-coordinator-contract-v1";
const routeUpdateCompletionPrefix = "Route updated using your latest result.";
const governedRouteHoursDetailPattern = /^(?:1 stop has|(?:[2-9]|[1-9]\d+) stops have) unverified hours\.$/;
const customerPwaWorkspaceConfigurationPath = "administration/workspace-configurations/route-iq-cross-industry-workspaces-v2.json";
const customerPwaManifestRegistryPath = "data/__harness__/northstar/manifest-registry.json";
const customerPwaBusinessRosterPath = "data/__harness__/northstar/approved-roster.json";
const customerPwaBusinessHoursPath = "data/__harness__/northstar/business-hours.json";
const summitRehearsalWorkspaceConfigurationPath = "administration/workspace-configurations/route-iq-72-hour-onboarding-rehearsal-v1.json";
const summitRehearsalManifestRegistryPath = "data/route-iq-72-hour-onboarding-rehearsal-v1/route-iq-72-hour-onboarding-rehearsal-manifest-registry-v1.json";
const summitRehearsalBusinessRosterPath = "data/route-iq-72-hour-onboarding-rehearsal-v1/route-iq-72-hour-onboarding-rehearsal-approved-business-roster-v1.json";
const summitRehearsalBusinessHoursPath = "data/route-iq-72-hour-onboarding-rehearsal-v1/route-iq-72-hour-onboarding-rehearsal-business-hours-v1.json";
const summitRehearsalRuntimeAssetPaths = Object.freeze({
  workspaceConfiguration: `/${summitRehearsalWorkspaceConfigurationPath}`,
  businessManifestRegistry: `/${summitRehearsalManifestRegistryPath}`,
  businessRoster: `/${summitRehearsalBusinessRosterPath}`,
  businessHours: `/${summitRehearsalBusinessHoursPath}`
});
export const dashboardRuntimeWorkflowTestClock = Object.freeze({
  now: "2026-07-23T16:00:00.000Z",
  timezoneId: "America/Chicago",
  businessHoursVerifiedAt: "2026-07-23T15:55:00.000Z",
  freshnessThresholdHours: 24
});
const cloneJson = value => JSON.parse(JSON.stringify(value));
const canonicalWorkspaceConfigurationRegistry = JSON.parse(readFileSync(
  resolve(root, customerPwaWorkspaceConfigurationPath),
  "utf8"
));
const canonicalBusinessManifestRegistry = JSON.parse(readFileSync(
  resolve(root, "data/route-iq-commercial-readiness-v1/route-iq-workspace-business-artifact-manifest-registry-v1.json"),
  "utf8"
));
const customerPwaRuntimeRecords = Object.freeze(Array.from({ length: 20 }, (_, offset) => {
  const sequence = offset + 1;
  return Object.freeze({
    recordId: `synthetic_outside_sales_opportunity_${String(sequence).padStart(3, "0")}`,
    businessName: `Synthetic Outside Sales Opportunity ${sequence}`,
    address: `${sequence}00 Validation Way, Example City, TX 77003`,
    postalCode: "77003",
    category: sequence % 2 ? "Business Services" : "Office",
    territoryId: "synthetic_north_territory",
    approvalState: "APPROVED_SYNTHETIC_VALIDATION",
    estimated_distance_miles: Number((sequence / 10).toFixed(1)),
    latitude: 29.62 + sequence / 10000,
    longitude: -95.22 - sequence / 10000,
    access_type: "Walk-in ready",
    ask_for: "Operations lead",
    expected_visit_duration: "5-9",
    opportunity_stage: sequence % 3 ? "Prospecting" : "Qualification"
  });
}));
const customerPwaBusinessRoster = Object.freeze({
  schemaVersion: "route-iq-synthetic-approved-businesses-v1",
  artifactVersion: "route-iq-dashboard-runtime-harness-approved-businesses-v2",
  workspaceId: "northstar_outside_sales_synthetic",
  operatingProfileId: "general_outside_sales",
  classification: "SYNTHETIC_NONCANONICAL",
  generatedAt: "2026-07-23T12:00:00.000Z",
  recordCount: customerPwaRuntimeRecords.length,
  records: customerPwaRuntimeRecords
});
const customerPwaBusinessRosterText = JSON.stringify(customerPwaBusinessRoster);
const customerPwaBusinessRosterSha256 = createHash("sha256")
  .update(customerPwaBusinessRosterText)
  .digest("hex");
const customerPwaWorkspaceConfigurationRegistry = cloneJson(canonicalWorkspaceConfigurationRegistry);
const customerPwaWorkspaceConfiguration = customerPwaWorkspaceConfigurationRegistry.workspaces.find(
  workspace => workspace.workspaceId === "northstar_outside_sales_synthetic"
);
const customerPwaManagerRole = Object.freeze({
  roleId: "northstar_synthetic_manager",
  displayName: "Field Operations Manager (Synthetic)",
  capabilities: Object.freeze([...customerPwaWorkspaceConfiguration.dashboard.capabilities])
});
const customerPwaManagerUser = Object.freeze({
  userId: "northstar_synthetic_manager_01",
  representativeId: "northstar_synthetic_manager_rep_01",
  displayName: "Synthetic Operations Manager 01",
  identityClass: "SYNTHETIC_NONCANONICAL",
  principalMappingStatus: "SYNTHETIC_ONLY",
  roleId: customerPwaManagerRole.roleId,
  territoryIds: Object.freeze(["synthetic_north_territory"]),
  active: false
});
customerPwaWorkspaceConfiguration.roles.push(customerPwaManagerRole);
customerPwaWorkspaceConfiguration.users.push(customerPwaManagerUser);
const customerPwaOwnerRole = Object.freeze({
  roleId: "northstar_synthetic_owner",
  displayName: "Customer Owner (Synthetic)",
  capabilities: Object.freeze([...customerPwaWorkspaceConfiguration.dashboard.capabilities])
});
const customerPwaOwnerUser = Object.freeze({
  userId: "northstar_synthetic_owner_01",
  representativeId: "northstar_synthetic_owner_rep_01",
  displayName: "Synthetic Customer Owner 01",
  identityClass: "SYNTHETIC_NONCANONICAL",
  principalMappingStatus: "SYNTHETIC_ONLY",
  roleId: customerPwaOwnerRole.roleId,
  territoryIds: Object.freeze(["synthetic_north_territory"]),
  active: false
});
const customerPwaFounderRole = Object.freeze({
  roleId: "northstar_synthetic_founder",
  displayName: "Founder Operator (Synthetic)",
  capabilities: Object.freeze([...customerPwaWorkspaceConfiguration.dashboard.capabilities])
});
const customerPwaFounderUser = Object.freeze({
  userId: "northstar_synthetic_founder_01",
  representativeId: "northstar_synthetic_founder_rep_01",
  displayName: "Synthetic Founder Operator 01",
  identityClass: "SYNTHETIC_NONCANONICAL",
  principalMappingStatus: "SYNTHETIC_ONLY",
  roleId: customerPwaFounderRole.roleId,
  territoryIds: Object.freeze(["synthetic_north_territory"]),
  active: false
});
customerPwaWorkspaceConfiguration.roles.push(customerPwaOwnerRole, customerPwaFounderRole);
customerPwaWorkspaceConfiguration.users.push(customerPwaOwnerUser, customerPwaFounderUser);
const customerPwaOpportunitySource = customerPwaWorkspaceConfiguration.opportunitySources.find(
  source => source.workspaceId === "northstar_outside_sales_synthetic"
);
Object.assign(customerPwaOpportunitySource, {
  manifestRegistryPath: customerPwaManifestRegistryPath,
  artifactPath: customerPwaBusinessRosterPath,
  artifactSchemaVersion: customerPwaBusinessRoster.schemaVersion
});
const customerPwaBusinessManifestRegistry = cloneJson(canonicalBusinessManifestRegistry);
const customerPwaBusinessManifest = customerPwaBusinessManifestRegistry.manifests.find(
  manifest => manifest.workspaceId === "northstar_outside_sales_synthetic"
);
Object.assign(customerPwaBusinessManifestRegistry, {
  generatedAt: "2026-07-23T12:00:00.000Z"
});
Object.assign(customerPwaBusinessManifest, {
  artifactPath: customerPwaBusinessRosterPath,
  artifactSha256: customerPwaBusinessRosterSha256,
  recordCount: customerPwaRuntimeRecords.length,
  approvedRecordCount: customerPwaRuntimeRecords.length,
  approvedRecordIds: customerPwaRuntimeRecords.map(record => record.recordId),
  freshness: {
    maximumAgeHours: 24,
    evaluatedAt: "2026-07-23T12:00:00.000Z",
    expiresAt: "2026-07-24T12:00:00.000Z",
    state: "SYNTHETIC"
  },
  sourceProvenance: {
    producer: "Prometheus Data",
    producerVersion: customerPwaBusinessRoster.artifactVersion,
    sourceSystem: "deterministic_synthetic_fixture",
    sourceRetrievedAt: "2026-07-23T12:00:00.000Z"
  }
});
const customerPwaBusinessHours = Object.freeze({
  schemaVersion: "prometheus-data-business-hours-v1",
  artifactVersion: "business-hours-v1",
  generatedAt: dashboardRuntimeWorkflowTestClock.businessHoursVerifiedAt,
  statusEvaluatedAt: dashboardRuntimeWorkflowTestClock.now,
  sourceRetrievedAt: dashboardRuntimeWorkflowTestClock.businessHoursVerifiedAt,
  workspaceId: "northstar_outside_sales_synthetic",
  operatingProfileId: "general_outside_sales",
  sourceDatasetVersion: "route-iq-dashboard-runtime-harness-hours-v2",
  sourceArtifact: customerPwaBusinessHoursPath,
  sourceCandidateCount: customerPwaRuntimeRecords.length,
  recordCount: customerPwaRuntimeRecords.length,
  refreshMode: "test-only-synthetic-governed-fixture",
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
  routeIqRuntimeScope: {
    version: "route-iq-governed-runtime-scope-v1",
    assetType: "business_hours",
    authority: "server_governed_runtime_asset",
    workspaceId: "northstar_outside_sales_synthetic",
    operatingProfileId: "general_outside_sales",
    workspaceBound: true,
    operatingProfileBound: true,
    authorizations: [
      "business_hours_eligibility",
      "continuous_adaptive_route_replenishment"
    ]
  },
  records: customerPwaRuntimeRecords.map(record => ({
    workspaceId: "northstar_outside_sales_synthetic",
    operatingProfileId: "general_outside_sales",
    recordId: record.recordId,
    businessName: record.businessName,
    address: record.address,
    category: record.category,
    latitude: record.latitude,
    longitude: record.longitude,
    activePoolMember: true,
    sourceDatasetVersion: "route-iq-dashboard-runtime-harness-hours-v2",
    permanentOperationalStatus: "OPERATIONAL",
    regularWeeklyBusinessHours: {
      periods: [{
        open: { date: null, day: 0, hour: 0, minute: 0, truncated: null },
        close: null
      }],
      sourceOpenNowAtRetrieval: true
    },
    specialOrHolidayHours: [],
    currentOpeningHoursWindow: null,
    businessTimezone: "America/Chicago",
    currentHoursSource: "SYNTHETIC_NONCANONICAL",
    sourceRetrievedAt: dashboardRuntimeWorkflowTestClock.businessHoursVerifiedAt,
    hoursVerifiedAt: dashboardRuntimeWorkflowTestClock.businessHoursVerifiedAt,
    hoursFreshnessStatus: "FRESH",
    hoursConfidence: "HIGH",
    hoursProvenance: {
      sourceSystem: "SYNTHETIC_NONCANONICAL",
      sourceMethod: "test_fixture",
      sourcePlaceId: record.recordId,
      retrievedAt: dashboardRuntimeWorkflowTestClock.businessHoursVerifiedAt,
      normalizedAt: dashboardRuntimeWorkflowTestClock.businessHoursVerifiedAt,
      fieldEvidenceIds: []
    },
    currentOpenClosedEligibilityStatus: "OPEN_VERIFIED",
    currentStatusReasonCode: "VERIFIED_24_HOUR_OPERATION",
    currentStatusReason: "Synthetic governed fixture verifies continuous operation.",
    currentStatusEvaluatedAt: dashboardRuntimeWorkflowTestClock.now,
    currentStatusBusinessLocalDate: "2026-07-23",
    currentStatusBusinessLocalTime: "11:00"
  }))
});
const customerPwaSessionFixture = Object.freeze({
  contractVersion: "route-iq-customer-pwa-session-v2",
  authorizationState: "server_verified",
  workspaceId: "northstar_outside_sales_synthetic",
  workspaceLabel: "Northstar Field Supply (Synthetic)",
  operatingProfileId: "general_outside_sales",
  principalRole: "representative",
  userId: "northstar_synthetic_user_01",
  representativeId: "northstar_synthetic_rep_01",
  displayName: "Synthetic Representative 01",
  roleId: "northstar_synthetic_representative",
  capabilities: Object.freeze({
    operateOwnRoute: true,
    readWorkspaceOperations: false,
    administerWorkspaceRoster: false,
    founderIntelligence: false,
    founderCrm: false
  }),
  runtimeAssets: Object.freeze({
    workspaceConfiguration: `/${customerPwaWorkspaceConfigurationPath}`,
    businessManifestRegistry: `/${customerPwaManifestRegistryPath}`,
    businessRoster: `/${customerPwaBusinessRosterPath}`,
    businessHours: `/${customerPwaBusinessHoursPath}`
  }),
  expiresAt: "2099-01-01T00:00:00.000Z",
  safety: Object.freeze({
    prospectiveCollection: "OFF",
    activeCohorts: 0,
    recommendationInfluence: "OFF"
  })
});
const customerPwaManagerSessionFixture = Object.freeze({
  ...customerPwaSessionFixture,
  userId: customerPwaManagerUser.userId,
  representativeId: customerPwaManagerUser.representativeId,
  displayName: customerPwaManagerUser.displayName,
  roleId: customerPwaManagerUser.roleId,
  principalRole: "manager",
  capabilities: Object.freeze({
    operateOwnRoute: false,
    readWorkspaceOperations: true,
    administerWorkspaceRoster: false,
    founderIntelligence: false,
    founderCrm: false
  })
});
const customerPwaOwnerSessionFixture = Object.freeze({
  ...customerPwaSessionFixture,
  userId: customerPwaOwnerUser.userId,
  representativeId: customerPwaOwnerUser.representativeId,
  displayName: customerPwaOwnerUser.displayName,
  roleId: customerPwaOwnerUser.roleId,
  principalRole: "customer_owner",
  capabilities: Object.freeze({
    operateOwnRoute: false,
    readWorkspaceOperations: true,
    administerWorkspaceRoster: true,
    founderIntelligence: false,
    founderCrm: false
  })
});
const customerPwaFounderSessionFixture = Object.freeze({
  ...customerPwaSessionFixture,
  userId: customerPwaFounderUser.userId,
  representativeId: customerPwaFounderUser.representativeId,
  displayName: customerPwaFounderUser.displayName,
  roleId: customerPwaFounderUser.roleId,
  principalRole: "founder",
  capabilities: Object.freeze({
    operateOwnRoute: false,
    readWorkspaceOperations: true,
    administerWorkspaceRoster: false,
    founderIntelligence: true,
    founderCrm: false
  })
});

function injectRouteIqCustomerPwaSession(dashboard, session) {
  const marker = "__ROUTE_IQ_CUSTOMER_PWA_SESSION__";
  if (dashboard.split(marker).length !== 2) {
    throw new Error("Customer PWA session marker is missing or duplicated.");
  }
  const payload = JSON.stringify(session).replace(/[<>&\u2028\u2029]/gu, character => {
    return `\\u${character.codePointAt(0).toString(16).padStart(4, "0")}`;
  });
  return dashboard.replace(marker, payload);
}

function summitRehearsalBrowserDocument() {
  const registryTemplate = JSON.stringify(canonicalWorkspaceConfigurationRegistry)
    .replace(/</gu, "\\u003c");
  const runtimeAssets = JSON.stringify(summitRehearsalRuntimeAssetPaths)
    .replace(/</gu, "\\u003c");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" href="data:,">
  <title>Route IQ synthetic onboarding rehearsal</title>
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; width: 100%; max-width: 100%; overflow-x: hidden; }
    body { background: #f4f7f8; color: #172126; font: 16px/1.45 system-ui, sans-serif; }
    main { width: min(100%, 760px); margin: 0 auto; padding: 16px; }
    header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    h1 { margin: 0; font-size: 1.25rem; }
    button { min-height: 44px; border: 1px solid #176b5b; background: #fff; color: #124c42; padding: 9px 12px; }
    #routePanel { display: grid; gap: 10px; margin-top: 14px; }
    .route-card { width: 100%; min-width: 0; border: 1px solid #cad6d3; background: #fff; padding: 12px; }
    .route-card h2 { margin: 0 0 6px; font-size: 1rem; overflow-wrap: anywhere; }
    .operating-hours, .visit-duration { margin: 4px 0; overflow-wrap: anywhere; }
    .operating-hours { font-weight: 700; color: #145c4f; }
    .visit-duration { color: #47565d; }
    #workflowStatus { min-height: 24px; margin-top: 12px; font-weight: 700; }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Route IQ onboarding rehearsal</h1>
      <button id="routeTab" type="button">Route</button>
    </header>
    <p id="scopeStatus" role="status">Loading governed rehearsal assets</p>
    <section id="routePanel" aria-label="Governed route"></section>
    <p id="workflowStatus" role="status"></p>
  </main>
  <script type="module">
    const runtimeAssets = Object.freeze(${runtimeAssets});
    const registryTemplate = ${registryTemplate};
    const state = {
      status: "LOADING",
      runtimeAssetKeys: [],
      requestedAssets: [],
      workspaceId: "",
      companyId: "",
      roleId: "",
      territoryIds: [],
      zipCodes: [],
      recordCount: 0,
      cardCount: 0,
      operatingLabels: [],
      visitDurationLabels: [],
      routeEligibleCount: 0,
      roleIsolationRejected: false,
      territoryIsolationRejected: false,
      zipIsolationRejected: false,
      productionAuthorized: null,
      canonicalAdmissionAllowed: null,
      externalProviderEnabled: null,
      safety: null,
      routeWorkflowReached: false,
      directionsWorkflowReached: false,
      errorCode: ""
    };
    window.__routeIqSummitRehearsal = state;

    const clone = value => JSON.parse(JSON.stringify(value));
    const json = async path => {
      state.requestedAssets.push(path);
      const response = await fetch(path, { method: "GET", cache: "no-store", credentials: "same-origin" });
      if (!response.ok || !String(response.headers.get("content-type") || "").includes("application/json")) {
        throw new Error("route_iq_dashboard_rehearsal_asset_unavailable");
      }
      return response.json();
    };
    const localEvent = (value, timeZone) => {
      if (!value) return null;
      const instant = new Date(value);
      if (Number.isNaN(instant.getTime())) return null;
      const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "numeric",
        minute: "2-digit",
        hour12: true
      }).formatToParts(instant).filter(part => part.type !== "literal").map(part => [part.type, part.value]));
      return {
        localDate: parts.year + "-" + parts.month + "-" + parts.day,
        displayTime: parts.hour + ":" + parts.minute + " " + parts.dayPeriod,
        timeZone
      };
    };

    try {
      const dashboard = await import("/dashboard/route-iq-dashboard-platform.mjs");
      const [administrationFixture, dataRegistry, roster, businessHours] = await Promise.all([
        json(runtimeAssets.workspaceConfiguration),
        json(runtimeAssets.businessManifestRegistry),
        json(runtimeAssets.businessRoster),
        json(runtimeAssets.businessHours)
      ]);
      state.runtimeAssetKeys = [...dashboard.routeIqDashboardRuntimeAssetKeys];
      const workspaceRegistry = clone(registryTemplate);
      workspaceRegistry.registryVersion = "route-iq-cross-industry-workspaces-v2.2.1";
      workspaceRegistry.provenance.configurationVersion = "v2.2.1";
      workspaceRegistry.workspaces[1] = clone(administrationFixture.workspaceConfiguration);
      workspaceRegistry.founderBoundary.authorizedWorkspaceIds = [
        workspaceRegistry.workspaces[0].workspaceId,
        administrationFixture.workspaceConfiguration.workspaceId
      ];
      const workspace = workspaceRegistry.workspaces[1];
      const sourceManifest = dataRegistry.manifests[0];
      const source = workspace.opportunitySources[0];
      Object.assign(source, {
        manifestRegistryPath: runtimeAssets.businessManifestRegistry.slice(1),
        artifactPath: runtimeAssets.businessRoster.slice(1),
        artifactSchemaVersion: roster.schemaVersion,
        classification: "SYNTHETIC_NONCANONICAL",
        manifestApprovalState: "APPROVED_SYNTHETIC_VALIDATION",
        productionUseAuthorized: false
      });
      const session = {
        contractVersion: "route-iq-customer-pwa-session-v2",
        authorizationState: "server_verified",
        workspaceId: workspace.workspaceId,
        workspaceLabel: workspace.company.displayName,
        operatingProfileId: workspace.operatingProfile.profileId,
        principalRole: "representative",
        userId: "summit_rehearsal_rep_01",
        representativeId: "summit_rehearsal_rep_identity_01",
        displayName: "Synthetic Representative 01",
        roleId: "summit_rehearsal_representative",
        capabilities: {
          operateOwnRoute: true,
          readWorkspaceOperations: false,
          administerWorkspaceRoster: false,
          founderIntelligence: false,
          founderCrm: false
        },
        runtimeAssets,
        expiresAt: "2099-01-01T00:00:00.000Z",
        safety: {
          prospectiveCollection: "OFF",
          activeCohorts: 0,
          recommendationInfluence: "OFF"
        }
      };
      const configuration = dashboard.validateDashboardWorkspaceRegistry(
        workspaceRegistry,
        session,
        { allowSynthetic: true }
      );
      const manifestRegistry = {
        schemaVersion: "route-iq-workspace-business-artifact-manifest-v1",
        registryVersion: "route-iq-workspace-business-artifact-manifest-registry-v1",
        ownerSubsystem: "Prometheus Data",
        generatedAt: dataRegistry.generatedAt,
        fallbackPolicy: "FAIL_CLOSED_NO_DEMO_OR_CROSS_WORKSPACE_FALLBACK",
        manifests: [{
          ownerSubsystem: "Prometheus Data",
          manifestId: sourceManifest.manifestId,
          manifestVersion: "route-iq-workspace-business-artifact-manifest-v1",
          workspaceId: sourceManifest.workspaceId,
          companyId: sourceManifest.companyId,
          operatingProfileId: sourceManifest.operatingProfileId,
          configurationVersion: workspace.provenance.configurationVersion,
          classification: "SYNTHETIC_NONCANONICAL",
          approvalState: "APPROVED_SYNTHETIC_VALIDATION",
          productionUseAuthorized: false,
          demoFallbackAllowed: false,
          crossWorkspaceFallbackAllowed: false,
          artifactPath: runtimeAssets.businessRoster.slice(1),
          artifactSha256: sourceManifest.rosterSha256,
          recordIdentityField: sourceManifest.recordIdentityField,
          recordCount: sourceManifest.recordCount,
          approvedRecordCount: sourceManifest.approvedRecordCount,
          approvedRecordIds: sourceManifest.approvedRecordIds,
          freshness: {
            maximumAgeHours: sourceManifest.hoursPolicy.maximumAgeHours,
            evaluatedAt: dataRegistry.generatedAt,
            expiresAt: "2026-07-24T12:00:00.000Z",
            state: "SYNTHETIC"
          },
          sourceProvenance: sourceManifest.sourceProvenance
        }]
      };
      const manifest = dashboard.validateDashboardBusinessManifestRegistry(manifestRegistry, session);
      const rosterBytes = await fetch(runtimeAssets.businessRoster, { cache: "no-store" }).then(response => response.arrayBuffer());
      const rosterSha256 = await dashboard.sha256Hex(rosterBytes);
      if (rosterSha256 !== sourceManifest.rosterSha256) {
        throw new Error("route_iq_dashboard_rehearsal_roster_hash_mismatch");
      }
      const projection = dashboard.projectApprovedRoster(
        roster,
        manifest,
        configuration.workspace,
        configuration.user,
        { allowSynthetic: true }
      );
      const hoursByRecord = new Map(businessHours.records.map(record => [record.recordId, record]));
      const decisions = new Map(businessHours.records.map(record => [record.recordId, {
        status: record.availabilityStatus,
        hoursFreshness: record.freshnessState === "FRESH"
          ? "FRESH"
          : record.freshnessState === "HOURS_STALE"
            ? "STALE"
            : "MISSING",
        immediateRecommendationEligible: record.rehearsalImmediateRouteEligible === true,
        failClosed: record.rehearsalImmediateRouteEligible !== true,
        nextOpening: localEvent(record.nextOpeningAt, record.businessTimezone),
        nextClosing: localEvent(record.nextClosingAt, record.businessTimezone)
      }]));
      const cards = projection.places.map(place => {
        const rehearsalPlace = { ...place, expectedVisitDuration: "5-9" };
        return {
          place: rehearsalPlace,
          decision: decisions.get(place.recordId),
          fields: dashboard.projectConfiguredBusinessCard(
            rehearsalPlace,
            configuration.workspace,
            decisions.get(place.recordId)
          )
        };
      });
      const routePanel = document.getElementById("routePanel");
      cards.forEach(({ place, decision, fields }, index) => {
        const card = document.createElement("article");
        card.className = "route-card";
        card.dataset.routeEligible = String(dashboard.isImmediateRouteEligible(decision));
        const heading = document.createElement("h2");
        heading.textContent = fields.business_name;
        const operating = document.createElement("p");
        operating.className = "operating-hours";
        operating.textContent = fields.operating_hours;
        const duration = document.createElement("p");
        duration.className = "visit-duration";
        duration.textContent = fields.estimated_visit_duration;
        const directions = document.createElement("button");
        directions.type = "button";
        directions.dataset.directions = place.recordId;
        directions.textContent = "Directions";
        directions.addEventListener("click", () => {
          state.directionsWorkflowReached = true;
          document.getElementById("workflowStatus").textContent = "Directions workflow reached";
        });
        card.append(heading, operating, duration, directions);
        routePanel.append(card);
      });
      const expectProjectionFailure = (mutate, expectedCode) => {
        const changed = clone(roster);
        mutate(changed.records[0]);
        try {
          dashboard.projectApprovedRoster(
            changed,
            manifest,
            configuration.workspace,
            configuration.user,
            { allowSynthetic: true }
          );
          return false;
        } catch (error) {
          return error.code === expectedCode;
        }
      };
      let roleIsolationRejected = false;
      try {
        dashboard.validateDashboardWorkspaceRegistry(
          workspaceRegistry,
          { ...session, roleId: "summit_rehearsal_founder_operator" },
          { allowSynthetic: true }
        );
      } catch (error) {
        roleIsolationRejected = error.code === "route_iq_dashboard_role_scope_invalid";
      }
      document.getElementById("routeTab").addEventListener("click", () => {
        state.routeWorkflowReached = true;
        document.getElementById("workflowStatus").textContent = "Route workflow reached";
      });
      Object.assign(state, {
        status: "READY",
        workspaceId: configuration.workspace.workspaceId,
        companyId: configuration.workspace.companyId,
        roleId: configuration.role.roleId,
        territoryIds: [...configuration.territoryIds],
        zipCodes: [...configuration.territoryZipCoverage.zipCodes],
        recordCount: projection.places.length,
        cardCount: cards.length,
        operatingLabels: cards.map(card => card.fields.operating_hours),
        visitDurationLabels: cards.map(card => card.fields.estimated_visit_duration),
        routeEligibleCount: cards.filter(card => dashboard.isImmediateRouteEligible(card.decision)).length,
        roleIsolationRejected,
        territoryIsolationRejected: expectProjectionFailure(
          record => { record.territoryId = "unassigned_rehearsal_territory"; },
          "route_iq_dashboard_business_roster_territory_invalid"
        ),
        zipIsolationRejected: expectProjectionFailure(
          record => { record.postalCode = "79999"; },
          "route_iq_dashboard_business_roster_zip_unauthorized"
        ),
        productionAuthorized: administrationFixture.productionAuthorized
          || workspace.admission.productionAuthorized
          || sourceManifest.productionUseAuthorized
          || roster.productionUseAuthorized
          || businessHours.productionUseAuthorized,
        canonicalAdmissionAllowed: sourceManifest.canonicalManifestAdmissionAllowed
          || roster.canonicalManifestAdmissionAllowed
          || businessHours.canonicalManifestAdmissionAllowed,
        externalProviderEnabled: businessHours.providerMode !== "NO_EXTERNAL_PROVIDER_REHEARSAL",
        safety: session.safety
      });
      document.getElementById("scopeStatus").textContent =
        configuration.territoryZipCoverage.zipCodes.length + " governed ZIPs · " + projection.places.length + " approved accounts";
    } catch (error) {
      state.status = "FAIL";
      state.errorCode = String(error?.code || error?.message || "route_iq_dashboard_rehearsal_failed");
      document.getElementById("scopeStatus").textContent = "Rehearsal unavailable";
    }
  </script>
</body>
</html>`;
}
const chromeStartupTimeoutMs = 30000;
const chromeControlTimeoutMs = 30000;
const chromeReadinessProbeTimeoutMs = 3000;
const chromeTargetCloseTimeoutMs = 10000;
export const eventbriteExpansionFixture = Object.freeze({
  now: "2026-07-19T17:00:00.000Z",
  timezoneId: "America/Chicago",
  localDate: "2026-07-19",
  expectedCardCount: 6
});

const results = [];
let localCertificate;

function disabledProspectiveBootstrap() {
  return {
    status: 202,
    body: {
      ok: true,
      acknowledged: true,
      status: "disabled",
      collection: "OFF",
      recommendationInfluence: "OFF"
    }
  };
}

function enabledProspectiveBootstrap(overrides = {}) {
  const now = Date.now();
  return {
    status: 200,
    body: {
      ok: true,
      acknowledged: true,
      status: "enabled",
      collection: "ON",
      recommendationInfluence: "OFF",
      bootstrapContractVersion: prospectiveBootstrapContractVersion,
      eventContractVersion: prospectiveEventContractVersion,
      issuedAt: new Date(now - 1000).toISOString(),
      expiresAt: new Date(now + 59 * 1000).toISOString(),
      workspaceId: customerPwaSessionFixture.workspaceId,
      operatingProfileId: customerPwaSessionFixture.operatingProfileId,
      representativeId: customerPwaSessionFixture.representativeId,
      activeCohort: true,
      supportedOpportunityTypes: ["next_stop"],
      runtimeContextContractVersion: prospectiveRuntimeContextContractVersion,
      coordinatorContractVersion: prospectiveCoordinatorContractVersion,
      ...overrides
    }
  };
}

function founderDailyIntelligenceResponse({ principal = {}, snapshot = {} } = {}) {
  return {
    status: 200,
    body: {
      ok: true,
      authorized: true,
      contractVersion: "route-iq-commercial-readiness-intelligence-v1",
      principal: {
        identityContextSource: "server_verified_identity_mapping",
        authenticationAuthority: "cloudflare_access",
        authenticated: true,
        callerSupplied: false,
        role: "founder",
        mappingId: "route-iq-founder-access-cruz-v1",
        immutablePrincipalId: "riq_principal_7250bf2f7db15371eea3173c4f25953cffd6adf5b29f093ce8f9f0977a70e3c4",
        mappingStatus: "securely_mapped",
        ...principal
      },
      snapshot: {
        ...canonicalFounderDailyIntelligenceSnapshot,
        ...snapshot
      }
    }
  };
}

function founderRevenueReadinessResponse(now = Date.parse(dashboardRuntimeWorkflowTestClock.now)) {
  return {
    status: 200,
    body: {
      session: {
        authenticationAuthority: "cloudflare_access",
        authorizationState: "server_verified",
        callerSupplied: false,
        expiresAt: new Date(now + 60 * 60_000).toISOString(),
        founderMappingState: "IMMUTABLE_FOUNDER_MAPPING_VERIFIED",
        role: "FOUNDER",
        safety: {
          activeCohorts: 0,
          billingActivation: "OFF",
          customerActivation: "OFF",
          prospectiveCollection: "OFF",
          providerRefresh: "OFF",
          recommendationInfluence: "OFF",
          scheduler: "OFF"
        }
      },
      snapshot: {
        contractVersion: "route-iq-paid-customer-revenue-readiness-v2",
        companyDisplayName: "Northstar Field Supply (Synthetic)",
        generatedAt: new Date(now - 5 * 60_000).toISOString(),
        commercialState: "ONBOARDING_VALIDATED",
        onboardingState: "VALIDATED",
        billing: { mode: "TEST", state: "TEST_VERIFIED" },
        activation: { state: "BLOCKED" },
        operationalStatus: {
          selectedWorkspace: "Northstar Outside Sales Workspace",
          customerState: "Validated, not activated",
          routeReadiness: "READY",
          workflow: { crm: "READY", followUp: "READY" },
          protectedState: {
            providerRefresh: "OFF",
            scheduler: "OFF",
            collection: "OFF",
            activeCohorts: 0,
            recommendationInfluence: "OFF"
          },
          deployment: {
            workerVersion: "local-dashboard-harness",
            releaseCommit: "local-dashboard-harness"
          },
          auditHistoryAvailable: true
        },
        nextAction: "Complete governed Founder review.",
        responsibleActor: "FOUNDER",
        counts: { users: 3, managers: 1, representatives: 2, locations: 2 },
        agreement: { state: "DRAFT", version: "agreement-v1.0" },
        orderForm: { state: "DRAFT", version: "order-form-v1.0" },
        pricing: { state: "PENDING", version: "pricing-v1.0" },
        payment: { state: "TEST_ONLY" },
        cancellation: { state: "NOT_REQUESTED" },
        support: { state: "DRAFT" },
        blockers: [{
          code: "CUSTOMER_ACTIVATION_OFF",
          severity: "BLOCKING",
          message: "Customer activation remains off.",
          owner: "FOUNDER"
        }],
        auditHistory: [{
          at: new Date(now - 10 * 60_000).toISOString(),
          actorRole: "PROMETHEUS_AI_OVERWATCH",
          fromState: "ONBOARDING_IN_PROGRESS",
          toState: "ONBOARDING_VALIDATED",
          summary: "Synthetic configuration passed governed validation.",
          evidenceDigest: "a".repeat(64)
        }]
      }
    }
  };
}

function pass(name, detail) {
  results.push({ status: "PASS", name, detail });
  console.log(`PASS ${name}: ${detail}`);
}

function fail(name, detail) {
  results.push({ status: "FAIL", name, detail });
  console.error(`FAIL ${name}: ${detail}`);
}

function assertWorkflow(name, condition, detail, failureDetail = detail) {
  if (condition) pass(name, detail);
  else fail(name, failureDetail);
}

function executableCandidates(command, pathValue) {
  if (!command) return [];
  if (command.includes("/") || command.includes("\\")) return [resolve(command)];
  return String(pathValue || "")
    .split(delimiter)
    .filter(Boolean)
    .map(directory => resolve(directory, command));
}

function canExecute(path) {
  try {
    accessSync(path, fsConstants.X_OK);
    return true;
  } catch (error) {
    return false;
  }
}

export function resolveChromeExecutable({
  environment = process.env,
  platform = process.platform,
  isExecutable = canExecute
} = {}) {
  const configuredPath = String(environment.CHROME_PATH || "").trim();
  if (configuredPath) {
    const configuredCandidates = executableCandidates(configuredPath, environment.PATH);
    const executable = configuredCandidates.find(isExecutable);
    if (executable) return executable;
    throw new Error(`Configured CHROME_PATH is not executable: ${configuredPath}`);
  }

  const platformPaths = platform === "darwin"
    ? [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"
      ]
    : platform === "linux"
    ? [
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable",
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser"
      ]
    : platform === "win32"
    ? [
        environment.PROGRAMFILES && join(environment.PROGRAMFILES, "Google/Chrome/Application/chrome.exe"),
        environment["PROGRAMFILES(X86)"] && join(environment["PROGRAMFILES(X86)"], "Google/Chrome/Application/chrome.exe"),
        environment.LOCALAPPDATA && join(environment.LOCALAPPDATA, "Google/Chrome/Application/chrome.exe")
      ].filter(Boolean)
    : [];
  const pathCommands = platform === "win32"
    ? ["chrome.exe"]
    : ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"];
  const candidates = [
    ...platformPaths,
    ...pathCommands.flatMap(command => executableCandidates(command, environment.PATH))
  ].filter((candidate, index, all) => all.indexOf(candidate) === index);
  const executable = candidates.find(isExecutable);
  if (executable) return executable;
  throw new Error(`No executable Chrome or Chromium found for ${platform}; set CHROME_PATH explicitly.`);
}

export function createNoncanonicalTestClockSource(now) {
  const targetEpochMs = Date.parse(now);
  if (!Number.isFinite(targetEpochMs)) throw new Error("Noncanonical test clock requires a valid timestamp.");
  return `(() => {
    const NativeDate = globalThis.Date;
    const installedAt = NativeDate.now();
    const targetEpochMs = ${targetEpochMs};
    class NoncanonicalTestDate extends NativeDate {
      constructor(...args) {
        if (args.length) super(...args);
        else super(targetEpochMs + (NativeDate.now() - installedAt));
      }
      static now() {
        return targetEpochMs + (NativeDate.now() - installedAt);
      }
    }
    Object.defineProperty(globalThis, "Date", {
      value: NoncanonicalTestDate,
      configurable: true,
      writable: true
    });
    Object.defineProperty(globalThis, "__prometheusNoncanonicalTestClock", {
      value: Object.freeze({ now: ${JSON.stringify(new Date(targetEpochMs).toISOString())}, mode: "advancing-offset" }),
      configurable: false,
      writable: false
    });
  })();`;
}

export function eventbriteExpansionContract(snapshot) {
  return snapshot.testClockNow === eventbriteExpansionFixture.now
    && snapshot.testClockMode === "advancing-offset"
    && snapshot.localDate === eventbriteExpansionFixture.localDate
    && snapshot.eventCards === eventbriteExpansionFixture.expectedCardCount
    && snapshot.accessCards === snapshot.eventCards
    && snapshot.mapLinks === snapshot.eventCards
    && snapshot.mapLinksValid
    && snapshot.eventbriteLinks === snapshot.eventCards
    && snapshot.eventbriteLinksValid
    && snapshot.addButtons === snapshot.eventCards
    && snapshot.addModalActive
    && snapshot.addModalTitle === "Add Place"
    && snapshot.addFormName !== ""
    && snapshot.addFormName === snapshot.firstCardName
    && snapshot.addFormCategory === "Event"
    && snapshot.addFormAddress !== ""
    && snapshot.placeCountUnchanged;
}

function inspectRouteUpdateStatus(value) {
  const status = String(value || "").trim();
  const hasStablePrefix = status.startsWith(routeUpdateCompletionPrefix);
  const detail = hasStablePrefix ? status.slice(routeUpdateCompletionPrefix.length).trim() : status;
  return {
    status,
    hasStablePrefix,
    detail,
    hasGovernedHoursDetail: detail === "" || governedRouteHoursDetailPattern.test(detail)
  };
}

function verifyRouteUpdateStatusContract() {
  const accepted = [
    routeUpdateCompletionPrefix,
    `${routeUpdateCompletionPrefix} 1 stop has unverified hours.`,
    `${routeUpdateCompletionPrefix} 15 stops have unverified hours.`
  ].map(inspectRouteUpdateStatus);
  const rejected = [
    `${routeUpdateCompletionPrefix} 0 stops have unverified hours.`,
    `${routeUpdateCompletionPrefix} 1 stops have unverified hours.`,
    `${routeUpdateCompletionPrefix} unrelated status text`,
    "Route update completed."
  ].map(inspectRouteUpdateStatus);
  assertWorkflow(
    "Route update status contract",
    accepted.every(result => result.hasStablePrefix && result.hasGovernedHoursDetail)
      && rejected.every(result => !result.hasStablePrefix || !result.hasGovernedHoursDetail),
    "stable completion prefix and governed optional hours detail reject unrelated text",
    JSON.stringify({ accepted, rejected })
  );
}

function contentType(pathname) {
  const ext = extname(pathname).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".js" || ext === ".mjs") return "text/javascript; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".png") return "image/png";
  if (ext === ".ico") return "image/x-icon";
  return "application/octet-stream";
}

function localHttpsCertificate() {
  if (localCertificate) return localCertificate;
  const certDir = mkdtempSync(join(tmpdir(), "prometheus-dashboard-cert-"));
  const keyPath = join(certDir, "key.pem");
  const certPath = join(certDir, "cert.pem");
  const result = spawnSync("openssl", [
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-sha256",
    "-days",
    "1",
    "-nodes",
    "-subj",
    "/CN=127.0.0.1",
    "-keyout",
    keyPath,
    "-out",
    certPath
  ], { stdio: "ignore" });
  if (result.status !== 0) {
    rmSync(certDir, { recursive: true, force: true });
    throw new Error(`Unable to create local HTTPS certificate with openssl${result.error ? `: ${result.error.message}` : "."}`);
  }
  try {
    localCertificate = {
      key: readFileSync(keyPath),
      cert: readFileSync(certPath),
      certDir
    };
  } catch (error) {
    rmSync(certDir, { recursive: true, force: true });
    throw error;
  }
  return localCertificate;
}

function startStaticServer({
  missingActive = false,
  customerPwaSession = null,
  summitRehearsal = false,
  fieldSessionResponses = [],
  prospectiveResponse = { status: 204 },
  prospectiveBootstrapResponse = disabledProspectiveBootstrap(),
  founderDailyIntelligenceResponse: configuredFounderDailyIntelligenceResponse = {
    status: 200,
    body: { ok: false, authorized: false, code: "founder_intelligence_not_authorized" }
  }
} = {}) {
  const requests = [];
  const fieldSessionRequests = [];
  const prospectiveRequests = [];
  const prospectiveBootstrapRequests = [];
  const prospectiveNetworkLedger = [];
  const founderDailyIntelligenceRequests = [];
  const founderRevenueReadinessRequests = [];
  let fieldSessionAttempt = 0;
  const certificate = localHttpsCertificate();
  const server = createSecureServer({ key: certificate.key, cert: certificate.cert }, (request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    const pathname = decodeURIComponent(
      url.pathname === "/"
        ? "/index.html"
        : url.pathname.endsWith("/")
        ? `${url.pathname}index.html`
        : url.pathname
    );
    const relativePath = pathname.replace(/^\/+/, "");
    requests.push({ path: relativePath, method: request.method });

    if (relativePath === founderDailyIntelligencePath) {
      founderDailyIntelligenceRequests.push({
        method: request.method,
        headers: request.headers,
        serverPrincipalRole: customerPwaSession?.principalRole || null,
        serverAuthorizationState: customerPwaSession?.authorizationState || null,
        founderIntelligence: customerPwaSession?.capabilities?.founderIntelligence === true,
        pageContext: String(request.headers.referer || "")
      });
      const configured = typeof configuredFounderDailyIntelligenceResponse === "function"
        ? configuredFounderDailyIntelligenceResponse({ request, url })
        : configuredFounderDailyIntelligenceResponse;
      const status = Number(configured?.status || 200);
      const body = configured?.body === undefined ? "" : JSON.stringify(configured.body);
      response.writeHead(status, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        ...(configured?.headers || {})
      });
      response.end(body);
      return;
    }

    if (relativePath === founderRevenueReadinessPath) {
      const admitted = customerPwaSession?.principalRole === "founder"
        && customerPwaSession?.authorizationState === "server_verified"
        && customerPwaSession?.capabilities?.readWorkspaceOperations === true
        && customerPwaSession?.capabilities?.founderIntelligence === true;
      founderRevenueReadinessRequests.push({
        method: request.method,
        serverPrincipalRole: customerPwaSession?.principalRole || null,
        serverAuthorizationState: customerPwaSession?.authorizationState || null,
        admitted,
        pageContext: String(request.headers.referer || "")
      });
      const configured = admitted
        ? founderRevenueReadinessResponse()
        : { status: 403, body: { ok: false, code: "founder_session_required" } };
      response.writeHead(configured.status, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "private, no-store"
      });
      response.end(JSON.stringify(configured.body));
      return;
    }

    if (relativePath === prospectiveEventPath) {
      prospectiveNetworkLedger.push({
        method: request.method,
        path: pathname,
        upgrade: String(request.headers.upgrade || "")
      });
      if (request.method === "GET") {
        prospectiveBootstrapRequests.push({ method: request.method, headers: request.headers });
        const configured = typeof prospectiveBootstrapResponse === "function"
          ? prospectiveBootstrapResponse({ request, url })
          : prospectiveBootstrapResponse;
        const status = Number(configured?.status || 202);
        const body = configured?.body === undefined ? "" : JSON.stringify(configured.body);
        const headers = {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
          ...(configured?.headers || {})
        };
        const send = () => {
          if (response.destroyed) return;
          response.writeHead(status, headers);
          response.end(body);
        };
        if (configured?.delayMs) setTimeout(send, configured.delayMs);
        else send();
        return;
      }
      const chunks = [];
      let size = 0;
      request.on("data", chunk => {
        size += chunk.length;
        if (size <= 4096) chunks.push(chunk);
      });
      request.on("end", () => {
        let payload = null;
        try {
          payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        } catch (error) {}
        prospectiveRequests.push({
          method: request.method,
          payload,
          bytes: size,
          headers: request.headers
        });
        const status = Number(prospectiveResponse.status || 204);
        const body = prospectiveResponse.body === undefined ? "" : JSON.stringify(prospectiveResponse.body);
        response.writeHead(status, {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store"
        });
        response.end(status === 204 ? "" : body);
      });
      return;
    }

    if (relativePath === fieldSessionHandoffPath) {
      const chunks = [];
      let size = 0;
      request.on("data", chunk => {
        size += chunk.length;
        if (size <= 1024 * 1024) chunks.push(chunk);
      });
      request.on("end", () => {
        if (request.method !== "POST") {
          response.writeHead(405, { "content-type": "application/json; charset=utf-8", allow: "POST" });
          response.end(JSON.stringify({ ok: false, acknowledged: false, message: "Method not allowed." }));
          return;
        }
        let payload;
        try {
          payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        } catch (error) {
          response.writeHead(400, { "content-type": "application/json; charset=utf-8" });
          response.end(JSON.stringify({ ok: false, acknowledged: false, retryable: false, code: "invalid_json" }));
          return;
        }
        const configured = fieldSessionResponses[fieldSessionAttempt] || { status: 201 };
        fieldSessionAttempt += 1;
        fieldSessionRequests.push({ payload, configured, attempt: fieldSessionAttempt });
        if (configured.status >= 400) {
          response.writeHead(configured.status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
          response.end(JSON.stringify({
            ok: false,
            acknowledged: false,
            code: configured.code || "field_session_store_unavailable",
            message: configured.message || "Field-session archive is temporarily unavailable.",
            retryable: configured.retryable !== false
          }));
          return;
        }
        const report = JSON.parse(payload.rawReportText);
        const sessionId = `route-iq-field-session-${payload.workspaceId}-${payload.operatingProfileId}-${report.rep.id}-${report.date}`;
        response.writeHead(configured.status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
        response.end(JSON.stringify({
          ok: true,
          acknowledged: true,
          acknowledgment: {
            contractId: "route-iq-end-of-day-data-handoff-v1",
            status: configured.archiveStatus || "archived",
            sessionId,
            workspaceId: payload.workspaceId,
            rawSha256: "runtime-harness-sha256",
            duplicate: configured.duplicate === true,
            persisted: true,
            sourceFinalizedAt: payload.sourceFinalizedAt
          }
        }));
      });
      return;
    }

    if (missingActive && relativePath === activePoolPath) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
      response.end("active pool intentionally unavailable for regression harness");
      return;
    }

    if (summitRehearsal && (relativePath === "summit-rehearsal" || relativePath === "summit-rehearsal/index.html")) {
      response.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff"
      });
      response.end(summitRehearsalBrowserDocument());
      return;
    }

    if (customerPwaSession && (relativePath === "app" || relativePath === "app/index.html")) {
      try {
        const dashboard = readFileSync(resolve(root, "index.html"), "utf8");
        const body = injectRouteIqCustomerPwaSession(dashboard, customerPwaSession);
        response.writeHead(200, {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "private, no-store",
          "x-content-type-options": "nosniff"
        });
        response.end(body);
      } catch (error) {
        response.writeHead(503, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
        response.end("Customer PWA fixture unavailable");
      }
      return;
    }

    const customerPwaJsonFixture = customerPwaSession && {
      [customerPwaWorkspaceConfigurationPath]: customerPwaWorkspaceConfigurationRegistry,
      [customerPwaManifestRegistryPath]: customerPwaBusinessManifestRegistry,
      [customerPwaBusinessHoursPath]: customerPwaBusinessHours
    }[relativePath];
    if (customerPwaJsonFixture) {
      response.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      response.end(JSON.stringify(customerPwaJsonFixture));
      return;
    }

    if (customerPwaSession && relativePath === customerPwaBusinessRosterPath) {
      response.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      response.end(customerPwaBusinessRosterText);
      return;
    }

    const staticRoot = customerPwaSession || summitRehearsal ? root : dashboardRoot;
    const resolvedPath = resolve(staticRoot, normalize(relativePath));
    if (!resolvedPath.startsWith(staticRoot)) {
      response.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
      response.end("Forbidden");
      return;
    }

    try {
      const body = readFileSync(resolvedPath);
      response.writeHead(200, { "content-type": contentType(resolvedPath), "cache-control": "no-store" });
      response.end(body);
    } catch (error) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
      response.end("Not found");
    }
  });

  return new Promise((resolveServer, rejectServer) => {
    server.once("error", rejectServer);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolveServer({
        origin: `https://127.0.0.1:${address.port}`,
        requests,
        fieldSessionRequests,
        prospectiveRequests,
        prospectiveBootstrapRequests,
        prospectiveNetworkLedger,
        founderDailyIntelligenceRequests,
        founderRevenueReadinessRequests,
        close: () => new Promise(resolveClose => server.close(resolveClose))
      });
    });
  });
}

function wait(ms) {
  return new Promise(resolveWait => setTimeout(resolveWait, ms));
}

export function parseDevToolsActivePort(value) {
  const [portLine, browserWebSocketPath] = String(value || "").trim().split(/\r?\n/u);
  const debugPort = Number(portLine);
  if (!Number.isInteger(debugPort) || debugPort < 1 || debugPort > 65535) {
    throw new Error("Chrome DevToolsActivePort did not contain a valid TCP port.");
  }
  if (!browserWebSocketPath?.startsWith("/devtools/browser/")) {
    throw new Error("Chrome DevToolsActivePort did not contain a browser websocket path.");
  }
  return { debugPort, browserWebSocketPath };
}

function chromeStderrSuffix(stderr) {
  const detail = String(stderr || "").trim();
  return detail ? `; stderr=${detail}` : "";
}

function errorCauseDiagnostic(error) {
  const details = [];
  const seen = new Set();
  let current = error;
  while (current && !seen.has(current)) {
    seen.add(current);
    const name = current.name || "Error";
    const code = current.code ? ` [${current.code}]` : "";
    const message = current.message || String(current);
    details.push(`${name}${code}: ${message}`);
    current = current.cause;
  }
  return details.join(" <- caused by ");
}

function isRetryableChromeReadinessTransportError(error, {
  allowFetchTypeError = false
} = {}) {
  const retryableNames = new Set(["AbortError", "TimeoutError"]);
  const retryableCodes = new Set([
    "ECONNREFUSED",
    "ECONNRESET",
    "ETIMEDOUT",
    "UND_ERR_CONNECT_TIMEOUT",
    "UND_ERR_SOCKET"
  ]);
  const seen = new Set();
  let current = error;
  while (current && !seen.has(current)) {
    seen.add(current);
    if (
      retryableNames.has(current.name)
      || retryableCodes.has(current.code)
      || (allowFetchTypeError && current.name === "TypeError")
    ) return true;
    current = current.cause;
  }
  return false;
}

async function waitForChromeReadiness({
  processHandle,
  userDataDir,
  getStderr,
  fetchImpl,
  timeoutMs,
  probeTimeoutMs
}) {
  const activePortPath = join(userDataDir, "DevToolsActivePort");
  const startedAt = Date.now();
  const deadline = Date.now() + timeoutMs;
  let lastError;
  let terminalError;
  let notifyTerminal;
  const terminal = new Promise(resolveTerminal => {
    notifyTerminal = resolveTerminal;
  });
  const setTerminalError = error => {
    if (terminalError) return;
    terminalError = error;
    notifyTerminal();
  };
  const onError = error => {
    setTerminalError(new Error(`Chrome failed to start: ${error.message}${chromeStderrSuffix(getStderr())}`));
  };
  const onExit = (code, signal) => {
    const status = signal ? `signal ${signal}` : `code ${code ?? "unknown"}`;
    setTerminalError(new Error(`Chrome exited before DevTools readiness (${status})${chromeStderrSuffix(getStderr())}`));
  };
  const raceTerminal = promise => Promise.race([
    promise,
    terminal.then(() => {
      throw terminalError;
    })
  ]);

  processHandle.once("error", onError);
  processHandle.once("exit", onExit);
  if (processHandle.exitCode !== null || processHandle.signalCode !== null) {
    onExit(processHandle.exitCode, processHandle.signalCode);
  }

  try {
    let activePort;
    while (!activePort && Date.now() < deadline) {
      if (terminalError) throw terminalError;
      try {
        activePort = parseDevToolsActivePort(readFileSync(activePortPath, "utf8"));
      } catch (error) {
        lastError = error;
      }
      if (!activePort) await raceTerminal(wait(50));
    }

    if (terminalError) throw terminalError;
    if (!activePort) {
      const lastDetail = lastError ? `; last port-file error=${errorCauseDiagnostic(lastError)}` : "";
      throw new Error(`Chrome did not publish DevToolsActivePort within ${timeoutMs}ms${lastDetail}${chromeStderrSuffix(getStderr())}`);
    }

    const endpoint = `http://127.0.0.1:${activePort.debugPort}/json/version`;
    let probeAttempts = 0;
    let lastProbeError;
    while (Date.now() < deadline) {
      const remainingMs = Math.max(1, deadline - Date.now());
      const boundedProbeTimeoutMs = Math.max(1, Math.min(probeTimeoutMs, remainingMs));
      probeAttempts += 1;
      let response;
      try {
        response = await raceTerminal(fetchImpl(endpoint, {
          signal: AbortSignal.timeout(boundedProbeTimeoutMs)
        }));
      } catch (error) {
        if (terminalError) throw terminalError;
        lastProbeError = error;
        if (!isRetryableChromeReadinessTransportError(error, { allowFetchTypeError: true })) break;
        if (Date.now() < deadline) await raceTerminal(wait(Math.min(50, Math.max(1, deadline - Date.now()))));
        continue;
      }
      if (!response.ok) {
        lastProbeError = new Error(`Chrome DevTools readiness returned HTTP ${response.status}.`);
        break;
      }
      try {
        const version = await raceTerminal(response.json());
        if (typeof version?.webSocketDebuggerUrl !== "string" || !version.webSocketDebuggerUrl) {
          lastProbeError = new Error("Chrome DevTools readiness response omitted webSocketDebuggerUrl.");
          break;
        }
        return { ...activePort, version };
      } catch (error) {
        if (terminalError) throw terminalError;
        lastProbeError = error;
        if (!isRetryableChromeReadinessTransportError(error)) break;
        if (Date.now() < deadline) await raceTerminal(wait(Math.min(50, Math.max(1, deadline - Date.now()))));
      }
    }

    if (lastProbeError) {
      throw new Error(
        `Chrome published DevToolsActivePort but its readiness transaction failed after ${Date.now() - startedAt}ms; endpoint=${endpoint}; attempts=${probeAttempts}; cause=${errorCauseDiagnostic(lastProbeError)}${chromeStderrSuffix(getStderr())}`,
        { cause: lastProbeError }
      );
    }
    throw new Error(
      `Chrome published DevToolsActivePort but its readiness transaction exhausted its deadline after ${Date.now() - startedAt}ms; endpoint=${endpoint}; attempts=${probeAttempts}${chromeStderrSuffix(getStderr())}`
    );
  } finally {
    processHandle.off("error", onError);
    processHandle.off("exit", onExit);
  }
}

async function createPage(debugPort, timeoutMs = chromeControlTimeoutMs) {
  const endpoint = `http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent("about:blank")}`;
  try {
    const response = await fetch(endpoint, {
      method: "PUT",
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    throw new Error(`Unable to create Chrome target; endpoint=${endpoint}; cause=${errorCauseDiagnostic(error)}`, { cause: error });
  }
}

async function listChromePageTargets(debugPort, timeoutMs = chromeControlTimeoutMs) {
  const endpoint = `http://127.0.0.1:${debugPort}/json/list`;
  try {
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const targets = await response.json();
    if (!Array.isArray(targets)) throw new Error("Chrome target list was not an array.");
    return targets.filter(target => target?.type === "page");
  } catch (error) {
    throw new Error(`Unable to inspect Chrome page targets; endpoint=${endpoint}; cause=${errorCauseDiagnostic(error)}`, { cause: error });
  }
}

class CdpSession {
  constructor(webSocketUrl) {
    this.webSocketUrl = webSocketUrl;
    this.socket = null;
    this.nextId = 1;
    this.pending = new Map();
    this.handlers = new Map();
    this.closePromise = null;
  }

  async connect() {
    this.socket = new WebSocket(this.webSocketUrl);
    await new Promise((resolveOpen, rejectOpen) => {
      const timer = setTimeout(() => rejectOpen(new Error(`Timed out connecting to Chrome CDP after ${chromeControlTimeoutMs}ms: ${this.webSocketUrl}`)), chromeControlTimeoutMs);
      this.socket.onopen = () => {
        clearTimeout(timer);
        resolveOpen();
      };
      this.socket.onerror = event => {
        clearTimeout(timer);
        rejectOpen(new Error(`Chrome CDP websocket error: ${event.message || "unknown"}`));
      };
    });
    this.socket.onmessage = event => this.handleMessage(event.data);
    this.socket.onclose = () => {
      for (const { reject } of this.pending.values()) reject(new Error("Chrome CDP websocket closed."));
      this.pending.clear();
    };
  }

  handleMessage(data) {
    const message = JSON.parse(typeof data === "string" ? data : data.toString());
    if (message.id && this.pending.has(message.id)) {
      const { resolve: resolvePending, reject } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message || JSON.stringify(message.error)));
      else resolvePending(message.result || {});
      return;
    }
    if (message.method && this.handlers.has(message.method)) {
      for (const handler of this.handlers.get(message.method)) handler(message.params || {});
    }
  }

  on(method, handler) {
    const existing = this.handlers.get(method) || [];
    existing.push(handler);
    this.handlers.set(method, existing);
  }

  waitFor(method, timeoutMs = 10000) {
    return new Promise((resolveEvent, rejectEvent) => {
      const timer = setTimeout(() => rejectEvent(new Error(`Timed out waiting for ${method}`)), timeoutMs);
      const handler = params => {
        clearTimeout(timer);
        resolveEvent(params);
      };
      this.on(method, handler);
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    const payload = JSON.stringify({ id, method, params });
    return new Promise((resolveSend, rejectSend) => {
      this.pending.set(id, { resolve: resolveSend, reject: rejectSend });
      this.socket.send(payload);
    });
  }

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text || "Runtime.evaluate failed.");
    }
    return result.result?.value;
  }

  close() {
    if (this.closePromise) return this.closePromise;
    this.closePromise = (async () => {
      if (!this.socket || this.socket.readyState === WebSocket.CLOSED) return;
      const socket = this.socket;
      if (socket.readyState === WebSocket.OPEN) {
        let closeTimer;
        try {
          await new Promise((resolveClose, rejectClose) => {
            closeTimer = setTimeout(
              () => rejectClose(new Error(`Timed out closing Chrome page target after ${chromeTargetCloseTimeoutMs}ms.`)),
              chromeTargetCloseTimeoutMs
            );
            this.send("Page.close").then(resolveClose, rejectClose);
          });
        } catch (error) {
          if (socket.readyState === WebSocket.OPEN) {
            throw new Error(`Unable to close Chrome page target: ${errorCauseDiagnostic(error)}`, { cause: error });
          }
        } finally {
          clearTimeout(closeTimer);
          socket.onmessage = null;
          if (socket.readyState !== WebSocket.CLOSED) {
            await new Promise(resolveClosed => {
              let settled = false;
              const finish = () => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                resolveClosed();
              };
              const timer = setTimeout(finish, chromeTargetCloseTimeoutMs);
              socket.onerror = finish;
              socket.onclose = finish;
              try {
                socket.close();
              } catch (error) {
                finish();
              }
            });
          }
          socket.onerror = null;
          socket.onclose = null;
        }
        return;
      }
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      try {
        socket.close();
      } catch (error) {}
    })();
    return this.closePromise;
  }
}

function processHasStopped(processHandle) {
  return !processHandle?.pid || processHandle.exitCode !== null || processHandle.signalCode !== null;
}

function waitForProcessExit(processHandle, timeoutMs) {
  if (processHasStopped(processHandle)) return Promise.resolve(true);
  return new Promise(resolveExit => {
    let settled = false;
    const finish = exited => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      processHandle.off("exit", onExit);
      resolveExit(exited || processHasStopped(processHandle));
    };
    const onExit = () => finish(true);
    const timer = setTimeout(() => finish(false), timeoutMs);
    processHandle.once("exit", onExit);
    if (processHasStopped(processHandle)) finish(true);
  });
}

export async function terminateChromeProcess(processHandle, {
  gracefulTimeoutMs = 1500,
  forceTimeoutMs = 1500
} = {}) {
  if (processHasStopped(processHandle)) return;
  if (!processHandle.kill("SIGTERM") && !processHasStopped(processHandle)) {
    throw new Error("Unable to send SIGTERM to Chrome.");
  }
  if (await waitForProcessExit(processHandle, gracefulTimeoutMs)) return;
  if (!processHandle.kill("SIGKILL") && !processHasStopped(processHandle)) {
    throw new Error("Unable to send SIGKILL to Chrome after its shutdown deadline.");
  }
  if (!await waitForProcessExit(processHandle, forceTimeoutMs)) {
    throw new Error("Chrome remained alive after SIGKILL.");
  }
}

async function closeChromeProcess(processHandle, userDataDir, shutdownOptions) {
  const failures = [];
  try {
    await terminateChromeProcess(processHandle, shutdownOptions);
  } catch (error) {
    failures.push(error);
  }
  try {
    rmSync(userDataDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  } catch (error) {
    failures.push(new Error(`Chrome profile cleanup failed: ${error.message}`));
  }
  if (failures.length) throw new AggregateError(failures, "Chrome teardown failed.");
}

export async function launchChrome({
  executablePath,
  tempRoot = tmpdir(),
  readinessTimeoutMs = chromeStartupTimeoutMs,
  readinessProbeTimeoutMs = chromeReadinessProbeTimeoutMs,
  gracefulShutdownTimeoutMs = 1500,
  forceShutdownTimeoutMs = 1500,
  spawnImpl = spawn,
  fetchImpl = fetch,
  registerCleanup
} = {}) {
  const chromeExecutable = executablePath
    ? resolveChromeExecutable({ environment: { ...process.env, CHROME_PATH: executablePath } })
    : resolveChromeExecutable();
  const userDataDir = mkdtempSync(join(tempRoot, "prometheus-dashboard-runtime-"));
  const args = [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--disable-background-networking",
    "--disable-component-update",
    "--disable-default-apps",
    "--disable-extensions",
    "--disable-sync",
    "--ignore-certificate-errors",
    "--no-first-run",
    "--no-default-browser-check",
    `--user-data-dir=${userDataDir}`,
    "--remote-debugging-address=127.0.0.1",
    "--remote-debugging-port=0",
    "about:blank"
  ];
  let processHandle;
  try {
    processHandle = spawnImpl(chromeExecutable, args, { stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) {
    rmSync(userDataDir, { recursive: true, force: true });
    throw new Error(`Chrome failed to start: ${error.message}`);
  }
  let stderr = "";
  processHandle.stderr?.on("data", chunk => {
    stderr = `${stderr}${chunk.toString()}`.slice(-16384);
  });
  const shutdownOptions = {
    gracefulTimeoutMs: gracefulShutdownTimeoutMs,
    forceTimeoutMs: forceShutdownTimeoutMs
  };
  let closePromise;
  const close = () => {
    closePromise ||= closeChromeProcess(processHandle, userDataDir, shutdownOptions);
    return closePromise;
  };
  try {
    registerCleanup?.(close);
  } catch (error) {
    await close();
    throw new Error(`Unable to register Chrome cleanup: ${errorCauseDiagnostic(error)}`, { cause: error });
  }
  let readiness;
  try {
    readiness = await waitForChromeReadiness({
      processHandle,
      userDataDir,
      getStderr: () => stderr,
      fetchImpl,
      timeoutMs: readinessTimeoutMs,
      probeTimeoutMs: readinessProbeTimeoutMs
    });
  } catch (startupError) {
    try {
      await close();
    } catch (teardownError) {
      throw new AggregateError(
        [startupError, teardownError],
        `Chrome startup and teardown failed: ${startupError.message}`,
        { cause: startupError }
      );
    }
    throw startupError;
  }
  return {
    debugPort: readiness.debugPort,
    close: async () => {
      await close();
      if (stderr && process.env.PROMETHEUS_DASHBOARD_HARNESS_DEBUG) console.error(stderr);
    }
  };
}

async function attachPage(chrome, eventLog) {
  const page = await createPage(chrome.debugPort);
  const cdp = new CdpSession(page.webSocketDebuggerUrl);
  await cdp.connect();
  cdp.on("Runtime.exceptionThrown", params => {
    eventLog.runtimeExceptions.push(params.exceptionDetails?.text || "Runtime exception");
  });
  cdp.on("Runtime.consoleAPICalled", params => {
    if (params.type === "error") {
      const text = (params.args || []).map(arg => arg.value || arg.description || "").join(" ").trim();
      eventLog.consoleErrors.push(text || "console.error");
    }
  });
  cdp.on("Log.entryAdded", params => {
    if (params.entry?.level === "error") {
      const source = params.entry.url ? ` (${params.entry.url})` : "";
      eventLog.logErrors.push(`${params.entry.text || "Chrome log error"}${source}`);
    }
  });
  cdp.on("Network.requestWillBeSent", params => {
    if (params.request?.url?.includes("runtime") || params.request?.url?.includes("active-pool")) {
      eventLog.network.push({ event: "request", url: params.request.url });
    }
  });
  cdp.on("Network.responseReceived", params => {
    if (params.response?.url?.includes("runtime") || params.response?.url?.includes("active-pool")) {
      eventLog.network.push({ event: "response", url: params.response.url, status: params.response.status });
    }
  });
  cdp.on("Network.loadingFailed", params => {
    eventLog.network.push({ event: "failed", errorText: params.errorText, blockedReason: params.blockedReason || "" });
  });
  await cdp.send("Runtime.enable");
  await cdp.send("Log.enable");
  await cdp.send("Page.enable");
  await cdp.send("Network.enable");
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `Object.defineProperty(navigator, "serviceWorker", { value: {
      register: () => Promise.reject(new Error("Service worker disabled by runtime workflow harness.")),
      addEventListener: () => {}
    }, configurable: true });`
  });
  return cdp;
}

async function navigateAndWait(cdp, url, timeoutMs = 10000) {
  await cdp.send("Page.navigate", { url });
  await wait(Math.min(250, timeoutMs));
}

async function setViewport(cdp, viewport) {
  if (!viewport) return;
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: viewport.deviceScaleFactor || 1,
    mobile: Boolean(viewport.mobile)
  });
  await cdp.send("Emulation.setTouchEmulationEnabled", {
    enabled: Boolean(viewport.mobile),
    maxTouchPoints: viewport.mobile ? 5 : 0
  });
}

async function setStandaloneMode(cdp, enabled) {
  if (!enabled) return;
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `(() => {
      Object.defineProperty(window.navigator, "standalone", { value: true, configurable: true });
      const nativeMatchMedia = window.matchMedia.bind(window);
      window.matchMedia = query => {
        if (String(query).includes("display-mode: standalone")) {
          return {
            matches: true,
            media: query,
            onchange: null,
            addListener: () => {},
            removeListener: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => false
          };
        }
        return nativeMatchMedia(query);
      };
    })();`
  });
}

async function setNoncanonicalTestClock(cdp, fixture) {
  if (!fixture) return;
  await cdp.send("Emulation.setTimezoneOverride", { timezoneId: fixture.timezoneId });
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
    source: createNoncanonicalTestClockSource(fixture.now)
  });
}

export function resolveRuntimeWorkflowScenarioClock(options = {}) {
  return Object.prototype.hasOwnProperty.call(options, "noncanonicalTestClock")
    ? options.noncanonicalTestClock
    : dashboardRuntimeWorkflowTestClock;
}

async function waitForDashboardReady(cdp, timeoutMs = 10000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const ready = await cdp.evaluate(`(() => {
      const debug = window.prometheusDebugState || {};
      return Boolean(
        debug.startupCompleted &&
        ["loaded", "READY"].includes(debug.runtimeDataStatus) &&
        debug.renderRouteIntelligenceReceivedRecommendation &&
        document.getElementById("bestNextMove") &&
        document.getElementById("bestNextMove").textContent.trim() !== "Loading route signal"
      );
    })()`);
    if (ready) return Date.now() - startedAt;
    await wait(100);
  }
  const diagnostic = await cdp.evaluate(`(() => ({
    href: location.href,
    title: document.title,
    bodyClass: document.body?.className || "",
    bodyText: (document.body?.innerText || "").slice(0, 500),
    debug: window.prometheusDebugState || null,
    loaderType: typeof loadRuntimeProductionDataset,
    fetchType: typeof fetch,
    bestNextMove: document.getElementById("bestNextMove")?.textContent || "",
    resources: performance.getEntriesByType("resource")
      .filter(entry => entry.name.includes("runtime") || entry.name.includes("active-pool"))
      .map(entry => ({ name: entry.name, duration: Math.round(entry.duration), transferSize: entry.transferSize }))
  }))()`).catch(error => ({ diagnosticError: error.message }));
  if (
    diagnostic?.debug?.startupCompleted &&
    diagnostic?.debug?.runtimeDataStatus === "loaded" &&
    diagnostic?.debug?.renderRouteIntelligenceReceivedRecommendation &&
    diagnostic?.bestNextMove &&
    diagnostic.bestNextMove !== "Loading route signal"
  ) {
    return Date.now() - startedAt;
  }
  throw new Error(`Dashboard did not finish runtime route rendering before timeout: ${JSON.stringify(diagnostic)}`);
}

async function snapshot(cdp) {
  return cdp.evaluate(`(() => {
    const text = element => element ? element.textContent.trim() : "";
    const visible = element => {
      if (!element) return false;
      const style = getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden" && element.offsetParent !== null;
    };
    const debug = window.prometheusDebugState || {};
    return {
      mode: document.body.dataset.mode,
      sessionRole: document.body.dataset.sessionRole,
      activeRepId: typeof activeRepId === "string" ? activeRepId : "",
      workspaceId: document.body.dataset.workspaceId || "",
      workspaceName: document.body.dataset.workspaceName || "",
      workspaceOperatingProfileId: document.body.dataset.operatingProfileId || "",
      appBuildVersion: typeof appBuildVersion === "string" ? appBuildVersion : "",
      serviceWorkerCacheVersion: typeof serviceWorkerCacheVersion === "string" ? serviceWorkerCacheVersion : "",
      storedAppBuildVersion: localStorage.getItem("prometheus-app-build-version") || "",
      anthonyProfileExists: Boolean(state?.repProfiles?.anthony),
      anthonyPoolCount: typeof anthonyApprovedRoutePool === "function" ? anthonyApprovedRoutePool(state?.places || []).length : 0,
      visibleOwnerControls: [...document.querySelectorAll(".owner-only, .manager-only, .admin-only")]
        .filter(visible)
        .map(element => ({
          tag: element.tagName.toLowerCase(),
          id: element.id || "",
          text: element.textContent.trim().replace(/\\s+/g, " ").slice(0, 80)
        })),
      modeButtonLabels: [...document.querySelectorAll("[data-mode-select]")].filter(visible).map(button => button.textContent.trim()),
      workspaceButtonLabels: [...document.querySelectorAll("[data-workspace-select]")].filter(visible).map(button => button.textContent.trim().replace(/\\s+/g, " ")),
      activeWorkspaceButtons: [...document.querySelectorAll("[data-workspace-select].active")].filter(visible).map(button => button.dataset.workspaceSelect),
      profileButtonLabels: [...document.querySelectorAll("[data-rep-select]")].filter(visible).map(button => button.textContent.trim()),
      activeView: document.querySelector(".view.active")?.id || "",
      visibleTabs: [...document.querySelectorAll(".tab[data-tab]")].filter(visible).map(tab => tab.dataset.tab),
      founderDailyIntelligenceVisible: visible(document.getElementById("founderDailyIntelligence")),
      founderDailyIntelligenceText: text(document.getElementById("founderDailyIntelligence")),
      bestNextMove: text(document.getElementById("bestNextMove")),
      bestMoveAddress: text(document.getElementById("bestMoveAddress")),
      bestMoveDirections: document.getElementById("bestMoveDirections")?.href || "",
      routeRisk: text(document.getElementById("routeRisk")),
      routeCountLabel: text(document.getElementById("routeCount")),
      dailyRouteCountLabel: text(document.getElementById("dailyRouteCount")),
      routeLoopStatus: text(document.getElementById("routeLoopStatusToday")),
      routeQueueIds: Array.isArray(state?.repProfiles?.[activeRepId]?.activeRouteQueue?.entries)
        ? state.repProfiles[activeRepId].activeRouteQueue.entries.map(entry => entry.identityKey)
        : [],
      routeQueueHours: Array.isArray(state?.repProfiles?.[activeRepId]?.activeRouteQueue?.entries)
        ? state.repProfiles[activeRepId].activeRouteQueue.entries.map(entry => ({
            identityKey: entry.identityKey,
            status: entry.eligibilitySnapshot?.status || "",
            marker: entry.eligibilitySnapshot?.internalMarker || "",
            reasonCode: entry.eligibilitySnapshot?.reasonCode || "",
            scoringChanged: entry.eligibilitySnapshot?.scoringChanged === true
          }))
        : [],
      routeQueueRevision: Number(state?.repProfiles?.[activeRepId]?.activeRouteQueue?.revision || 0),
      visitCount: Array.isArray(state?.repProfiles?.[activeRepId]?.visits) ? state.repProfiles[activeRepId].visits.length : 0,
      handoffStatus: text(document.getElementById("handoffStatus")),
      endRouteDisabled: document.getElementById("endRoute")?.disabled ?? null,
      endDayDisabled: document.getElementById("endDay")?.disabled ?? null,
      retryArchiveVisible: visible(document.getElementById("retryFieldSessionArchive")),
      manualExportVisible: visible(document.getElementById("exportTodayReport")),
      manualExportDisabled: document.getElementById("exportTodayReport")?.disabled ?? null,
      territoryText: text(document.getElementById("territoryOverview")),
      territoryVisible: visible(document.getElementById("territoryOverview")),
      territoryRingCount: document.querySelectorAll("#territoryRingList .territory-ring").length,
      territoryRingTexts: [...document.querySelectorAll("#territoryRingList .territory-ring")].map(ring => ring.textContent.trim().replace(/\\s+/g, " ")),
      territoryOwnerPolicyVisible: visible(document.getElementById("territoryPolicyForm")),
      territoryRepRadiusVisible: visible(document.getElementById("territoryRepRadiusForm")),
      territoryRepRadiusDisabled: document.getElementById("territoryRepRadiusInput")?.disabled ?? null,
      territoryPolicyStatus: text(document.getElementById("territoryPolicyStatus")),
      territoryRepRadiusStatus: text(document.getElementById("territoryRepRadiusStatus")),
      eventCards: document.querySelectorAll("#eventOpportunities .item").length,
      eventText: text(document.getElementById("eventOpportunities")),
      routeText: text(document.getElementById("view-route")),
      todayText: text(document.getElementById("view-today")),
      placesText: text(document.getElementById("view-places")),
      statsText: text(document.getElementById("view-stats")),
      findText: text(document.getElementById("view-find")),
      operatingProfileId: document.body.dataset.operatingProfile || "",
      routeCards: document.querySelectorAll("#routeList .route-card").length,
      routeCardHoursStatuses: [...document.querySelectorAll("#routeList .route-card")].map(card => card.dataset.hoursStatus || ""),
      routeCardHoursMarkers: [...document.querySelectorAll("#routeList .route-card")].map(card => card.dataset.hoursMarker || ""),
      dailyRouteCards: document.querySelectorAll("#dailyRoute .route-card").length,
      placesItems: document.querySelectorAll("#placesList .item").length,
      searchItems: document.querySelectorAll("#dailySearches .item").length,
      targetIdeas: document.querySelectorAll("#targetIdeas .item").length,
      debug: {
        startupCompleted: Boolean(debug.startupCompleted),
        runtimeDataStatus: debug.runtimeDataStatus || "",
        runtimeDataPool: debug.runtimeDataPool || "",
        runtimeDataSource: debug.runtimeDataSource || "",
        lastError: debug.lastError || "",
        lastUnhandledRejection: debug.lastUnhandledRejection || "",
        routeRecommendation: debug.routeRecommendation || null,
        rendererReceived: Boolean(debug.renderRouteIntelligenceReceivedRecommendation),
        renderTimings: debug.renderTimings || {},
        deferredOwnerViews: debug.deferredOwnerViews || {},
        placesRender: debug.placesRender || {},
        territoryCoverage: debug.territoryCoverage || {},
        routeWindowFallback: debug.routeWindowFallback || {},
        routeReplenishment: debug.routeReplenishment || {},
        businessHours: debug.businessHours || {},
        fieldSessionArchive: debug.fieldSessionArchive || {},
        runtimeFallback: debug.runtimeFallback || {},
        operatingProfile: debug.operatingProfile || {},
        workspace: debug.workspace || {},
        founderDailyIntelligence: debug.founderDailyIntelligence || {},
        paidCustomerRevenueReadiness: debug.paidCustomerRevenueReadiness || {}
      },
      performance: {
        navigationDuration: Math.round(performance.getEntriesByType("navigation")[0]?.duration || 0),
        activeResourceDuration: Math.round(performance.getEntriesByType("resource").find(entry => entry.name.includes("active-pool.json"))?.duration || 0),
        fullResourceDuration: Math.round(performance.getEntriesByType("resource").find(entry => entry.name.includes("runtime-pools.json"))?.duration || 0)
      }
    };
  })()`);
}

async function verifyRouteBusinessHoursRuntime(cdp) {
  return cdp.evaluate(`(() => {
    const christianPlaceId = "ChIJiduac7LCQIYR-sGBtIAjKR0";
    const record = routeBusinessHoursIndex?.recordsByPlaceId?.get(christianPlaceId) || null;
    const fieldDecision = record && routeBusinessHoursApi
      ? routeBusinessHoursApi.evaluateRouteBusinessHoursEligibility({
          record,
          evaluatedAt: "2026-07-11T21:21:59.331Z",
          policy: routeBusinessHoursIndex.freshnessPolicy,
          artifactAvailable: true,
          workspaceId: "fitness_connection",
          operatingProfileId: "fitness"
        })
      : null;
    const decisionAtFieldTime = place => {
      const hoursRecord = routeBusinessHoursIndex?.recordsByPlaceId?.get(place?.googlePlaceId) || null;
      return routeBusinessHoursApi.evaluateRouteBusinessHoursEligibility({
        record: hoursRecord,
        evaluatedAt: "2026-07-11T21:21:59.331Z",
        policy: routeBusinessHoursIndex.freshnessPolicy,
        artifactAvailable: true,
        workspaceId: "fitness_connection",
        operatingProfileId: "fitness"
      });
    };
    const christianPlace = state.places.find(place => place.googlePlaceId === christianPlaceId) || null;
    const openAlternative = state.places.find(place => place.googlePlaceId !== christianPlaceId && decisionAtFieldTime(place).status === "OPEN_VERIFIED") || null;
    const fieldQueue = christianPlace && openAlternative
      ? routeReplenishmentApi.maintainRouteQueue({
          queue: routeReplenishmentApi.createEmptyRouteQueue({
            workspaceId: "fitness_connection",
            representativeId: "field-regression",
            operatingProfileId: "fitness",
            routeDate: "2026-07-11",
            targetSize: 1,
            threshold: 1
          }),
          workspaceId: "fitness_connection",
          representativeId: "field-regression",
          operatingProfileId: "fitness",
          routeDate: "2026-07-11",
          primaryCandidates: [christianPlace, openAlternative],
          force: true,
          identityOf: routeIdentityKey,
          isEligible: place => decisionAtFieldTime(place).eligible,
          scoreCandidate: place => routeBusinessHoursApi.applyHoursEligibilityToScore(
            place.googlePlaceId === christianPlaceId ? 1000 : 1,
            decisionAtFieldTime(place)
          ),
          now: "2026-07-11T21:21:59.331Z"
        })
      : null;
    const queue = activeProfile().activeRouteQueue;
    const entries = Array.isArray(queue?.entries) ? queue.entries : [];
    const cards = [...document.querySelectorAll("#routeList .route-card")];
    return {
      artifactAvailable: routeBusinessHoursArtifactAvailable,
      recordCount: routeBusinessHoursIndex?.recordCount || 0,
      fieldDecision,
      christianPermanentStatus: record?.permanentOperationalStatus || "",
      christianQueued: entries.some(entry => entry.identityKey === "google:" + christianPlaceId),
      fieldQueueIds: fieldQueue?.queue?.entries?.map(entry => entry.identityKey) || [],
      fieldQueueOpenAlternativeId: openAlternative ? routeIdentityKey(openAlternative) : "",
      queueCount: entries.length,
      queueStatuses: entries.map(entry => entry.eligibilitySnapshot?.status || ""),
      queueReasonCodes: entries.map(entry => entry.eligibilitySnapshot?.reasonCode || ""),
      queueScoringChanged: entries.some(entry => entry.eligibilitySnapshot?.scoringChanged === true),
      queueUnverifiedCount: entries.filter(entry => entry.eligibilitySnapshot?.internalMarker === "HOURS_NOT_VERIFIED").length,
      routeCardCount: cards.length,
      routeCardStatuses: cards.map(card => card.dataset.hoursStatus || ""),
      routeCardMarkers: cards.map(card => card.dataset.hoursMarker || ""),
      routeText: document.getElementById("routeList")?.textContent?.trim().replace(/\\s+/g, " ").slice(0, 1200) || "",
      debug: window.prometheusDebugState?.businessHours || {}
    };
  })()`);
}

async function mobileFitSnapshot(cdp) {
  return cdp.evaluate(`(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const visible = element => {
      if (!element) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const rectFor = selector => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        width: Math.round(rect.width),
        visible: visible(element)
      };
    };
    const offenders = [...document.body.querySelectorAll("*")]
      .filter(visible)
      .map(element => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          id: element.id || "",
          className: typeof element.className === "string" ? element.className : "",
          text: (element.textContent || "").trim().replace(/\\s+/g, " ").slice(0, 80),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width)
        };
      })
      .filter(item => item.left < -1 || item.right > viewportWidth + 1)
      .slice(0, 12);
    return {
      viewportWidth,
      docScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      bodyOverflowX: getComputedStyle(document.body).overflowX,
      htmlOverflowX: getComputedStyle(document.documentElement).overflowX,
      activeView: document.querySelector(".view.active")?.id || "",
      ownerTabs: [...document.querySelectorAll(".tab[data-tab]")].filter(visible).map(tab => tab.dataset.tab),
      modeButtonLabels: [...document.querySelectorAll('[data-mode-select]')].filter(visible).map(button => button.textContent.trim()),
      workspaceButtonLabels: [...document.querySelectorAll('[data-workspace-select]')].filter(visible).map(button => button.textContent.trim().replace(/\\s+/g, " ")),
      profileButtonLabels: [...document.querySelectorAll('[data-rep-select]')].filter(visible).map(button => button.textContent.trim()),
      rects: {
        header: rectFor("header"),
        topLine: rectFor(".topline"),
        workspaceSwitch: rectFor("#workspaceSwitch"),
        modeSwitch: rectFor(".mode-switch:not(#repProfileSwitch)"),
        repProfileSwitch: rectFor("#repProfileSwitch"),
        goalChip: rectFor(".goal-chip"),
        main: rectFor("main"),
        nav: rectFor("nav"),
        tabs: rectFor(".tabs")
      },
      offenders
    };
  })()`);
}

async function clickTab(cdp, tab) {
  await cdp.evaluate(`(() => {
    const target = document.querySelector('[data-tab="${tab}"]');
    if (!target) throw new Error('Missing tab ${tab}');
    target.click();
    return true;
  })()`);
  await wait(150);
}

async function waitForFounderDailyIntelligence(cdp, expectedStatus, timeoutMs = 8000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const state = await cdp.evaluate("window.prometheusDebugState?.founderDailyIntelligence || null");
    if (state?.status === expectedStatus) return state;
    await wait(100);
  }
  const state = await cdp.evaluate("window.prometheusDebugState?.founderDailyIntelligence || null");
  throw new Error(`Founder daily intelligence did not reach ${expectedStatus}: ${JSON.stringify(state)}`);
}

async function waitForFounderRevenueReadiness(cdp, expectedStatus, timeoutMs = 8000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const state = await cdp.evaluate("window.prometheusDebugState?.paidCustomerRevenueReadiness || null");
    if (state?.status === expectedStatus) return state;
    await wait(100);
  }
  const state = await cdp.evaluate("window.prometheusDebugState?.paidCustomerRevenueReadiness || null");
  throw new Error(`Founder revenue readiness did not reach ${expectedStatus}: ${JSON.stringify(state)}`);
}

async function waitForPlacesRenderComplete(cdp, timeoutMs = 8000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const state = await cdp.evaluate(`(() => {
      const debug = window.prometheusDebugState?.placesRender || {};
      return {
        complete: Boolean(debug.complete),
        rendered: Number(debug.rendered || 0),
        total: Number(debug.total || 0),
        initialMs: Number(debug.initialMs || 0),
        durationMs: Number(debug.durationMs || debug.initialMs || 0),
        visibleCards: document.querySelectorAll("#placesList .item").length,
        loading: Boolean(document.querySelector("#placesList [data-places-loading]"))
      };
    })()`);
    if (state.complete && state.total && state.visibleCards === state.total) return state;
    await wait(100);
  }
  const diagnostic = await cdp.evaluate(`(() => window.prometheusDebugState?.placesRender || {})()`);
  throw new Error(`Places render did not complete: ${JSON.stringify(diagnostic)}`);
}

async function verifyMobileQuickLogging(cdp) {
  return cdp.evaluate(`(async () => {
    const visible = element => {
      if (!element) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const openButton = document.querySelector('[data-open="quick"]');
    if (!openButton) throw new Error("Missing quick logging entry point.");
    openButton.click();
    await new Promise(resolve => requestAnimationFrame(resolve));
    const modal = document.getElementById("modal");
    const modalBody = document.getElementById("modalBody");
    const saleButton = document.querySelector('[data-quick-outcome="sale"]');
    if (!modal?.classList.contains("active")) throw new Error("Quick logging modal did not open.");
    if (!saleButton) throw new Error("Missing Sale quick outcome.");
    saleButton.click();
    await new Promise(resolve => requestAnimationFrame(resolve));
    const saveButton = document.querySelector("#quickCounts .btn[type='submit']");
    const unitsInput = document.querySelector("#quickForm [name='units']");
    if (!saveButton || !unitsInput) throw new Error("Quick logging submit controls are missing.");
    modalBody.scrollTop = modalBody.scrollHeight;
    await new Promise(resolve => requestAnimationFrame(resolve));
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight;
    const modalBodyRect = modalBody.getBoundingClientRect();
    const saveRect = saveButton.getBoundingClientRect();
    const modalBodyClientHeight = Math.round(modalBody.clientHeight);
    const modalBodyScrollHeight = Math.round(modalBody.scrollHeight);
    const beforeUnits = Number(document.getElementById("unitsToday")?.textContent || 0);
    const reachable = visible(saveButton)
      && saveRect.top >= -1
      && saveRect.left >= -1
      && saveRect.right <= viewportWidth + 1
      && saveRect.bottom <= viewportHeight + 1;
    saveButton.click();
    const completionDeadline = Date.now() + 15000;
    while (modal.classList.contains("active") && Date.now() < completionDeadline) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    const afterUnits = Number(document.getElementById("unitsToday")?.textContent || 0);
    return {
      modalActiveAfterSubmit: modal.classList.contains("active"),
      viewportWidth,
      viewportHeight,
      documentScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      modalBodyClientHeight,
      modalBodyScrollHeight,
      modalBodyRect: {
        top: Math.round(modalBodyRect.top),
        bottom: Math.round(modalBodyRect.bottom),
        height: Math.round(modalBodyRect.height)
      },
      saveButtonRect: {
        top: Math.round(saveRect.top),
        bottom: Math.round(saveRect.bottom),
        left: Math.round(saveRect.left),
        right: Math.round(saveRect.right),
        height: Math.round(saveRect.height)
      },
      reachable,
      beforeUnits,
      afterUnits,
      unitsInputValue: unitsInput.value,
      routeLoopStatus: document.getElementById("routeLoopStatusToday")?.textContent?.trim() || "",
      routeQueueCount: activeProfile().activeRouteQueue?.entries?.length || 0
    };
  })()`);
}

async function verifyNearbyOpportunitiesFlow(cdp) {
  return cdp.evaluate(`(async () => {
    const waitFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
    const emptyBefore = document.querySelector("#nearbyOpportunities .empty")?.textContent?.trim() || "";
    const target = (typeof routeVisiblePlaces === "function" ? routeVisiblePlaces() : [])
      .find(place => typeof nearbyOpportunitiesForPlace === "function" && nearbyOpportunitiesForPlace(place, 4).length > 0);
    if (!target) throw new Error("No representative route target has nearby opportunities.");
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition(success) {
          success({
            coords: {
              latitude: Number(target.latitude),
              longitude: Number(target.longitude),
              accuracy: 9
            }
          });
        }
      }
    });
    const beforeRuntimePool = window.prometheusDebugState?.runtimeDataPool || "";
    document.querySelector('[data-open="quick"]')?.click();
    await waitFrame();
    const form = document.getElementById("quickForm");
    if (!form) throw new Error("Quick logging form did not open.");
    form.elements.placeId.value = target.id;
    form.querySelector("[data-verify-location]")?.click();
    await waitFrame();
    const locationButtonLabel = form.querySelector("[data-verify-location]")?.textContent?.trim() || "";
    const locationStatus = form.querySelector("[data-location-status]")?.textContent?.trim() || "";
    form.querySelector('[data-quick-outcome="talk"]')?.click();
    await waitFrame();
    form.querySelector("#quickCounts .btn[type='submit']")?.click();
    await new Promise(resolve => setTimeout(resolve, 150));
    const cards = [...document.querySelectorAll("#nearbyOpportunities .nearby-card")].map(card => card.textContent.trim().replace(/\\s+/g, " "));
    const countLabel = document.getElementById("nearbyOpportunitiesCount")?.textContent?.trim() || "";
    const debug = window.prometheusDebugState?.nearbyOpportunities || {};
    const latestVisit = state.visits.slice().sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))[0] || {};
    return {
      emptyBefore,
      target: {
        id: target.id,
        name: target.name,
        latitude: target.latitude,
        longitude: target.longitude
      },
      locationStatus,
      locationButtonLabel,
      latestVisitHasLocation: Boolean(latestVisit.location),
      latestVisitPlaceId: latestVisit.placeId || "",
      beforeRuntimePool,
      runtimePool: window.prometheusDebugState?.runtimeDataPool || "",
      nearbyDebug: debug,
      countLabel,
      cardCount: cards.length,
      firstCard: cards[0] || "",
      noEmptyAfter: !document.querySelector("#nearbyOpportunities .empty")
    };
  })()`);
}

async function verifyRouteNearbyInteraction(cdp) {
  return cdp.evaluate(`(() => {
    const badge = document.querySelector("#routeList .decision-chip.nearby");
    const card = badge?.closest(".route-card");
    if (!badge || !card) throw new Error("Route nearby badge was not rendered.");
    const before = {
      activeView: document.querySelector(".view.active")?.id || "",
      modalActive: document.getElementById("modal")?.classList.contains("active") || false,
      detailsOpen: card.querySelector(".compact-details")?.hasAttribute("open") || false
    };
    badge.click();
    const style = getComputedStyle(badge);
    const modal = document.getElementById("modal");
    const modalText = document.getElementById("modalBody")?.textContent?.trim().replace(/\\s+/g, " ") || "";
    const after = {
      activeView: document.querySelector(".view.active")?.id || "",
      modalActive: modal?.classList.contains("active") || false,
      detailsOpen: card.querySelector(".compact-details")?.hasAttribute("open") || false
    };
    document.getElementById("closeModal")?.click();
    return {
      tagName: badge.tagName.toLowerCase(),
      text: badge.textContent.trim(),
      className: badge.className,
      nearbyPlace: badge.getAttribute("data-nearby-place") || "",
      role: badge.getAttribute("role") || "",
      dataOpen: badge.getAttribute("data-open") || "",
      dataTab: badge.getAttribute("data-tab") || "",
      dataQuickPlace: badge.getAttribute("data-quick-place") || "",
      title: badge.getAttribute("title") || "",
      ariaLabel: badge.getAttribute("aria-label") || "",
      cursor: style.cursor,
      pointerEvents: style.pointerEvents,
      borderStyle: style.borderStyle,
      backgroundColor: style.backgroundColor,
      color: style.color,
      modalTitle: document.getElementById("modalTitle")?.textContent?.trim() || "",
      modalText,
      whyText: card.querySelector(".compact-details")?.textContent?.trim().replace(/\\s+/g, " ").slice(0, 1000) || "",
      before,
      after
    };
  })()`);
}

async function verifyTerritoryPermissionModel(cdp) {
  return cdp.evaluate(`(() => {
    if (typeof territoryPolicyFor !== "function") throw new Error("Territory policy engine is unavailable.");
    const before = territoryPolicyFor(activeRepId);
    updateOwnerTerritoryPolicy("allowed", 10);
    updateOwnerTerritoryPolicy("assigned", 5);
    updateOwnerTerritoryPolicy("allowRepChanges", true);
    updateOwnerTerritoryPolicy("lockAssigned", false);
    const afterOwner = territoryPolicyFor(activeRepId);
    const ownerStatus = document.getElementById("territoryPolicyStatus")?.textContent?.trim() || "";
    setMode("rep");
    render();
    const repControl = document.getElementById("territoryRepRadiusInput");
    const repDisabledBefore = repControl?.disabled ?? null;
    if (repControl) {
      repControl.value = "10";
      repControl.dispatchEvent(new Event("change", { bubbles: true }));
    }
    const afterRep = territoryPolicyFor(activeRepId);
    const repStatus = document.getElementById("territoryRepRadiusStatus")?.textContent?.trim() || "";
    setMode("owner");
    render();
    return {
      activeRepId,
      before,
      afterOwner,
      afterRep,
      ownerStatus,
      repDisabledBefore,
      repStatus,
      assignedRadiusText: document.getElementById("territoryAssignedRadius")?.textContent?.trim() || "",
      routePoolMaxMiles: typeof routePool === "function" && typeof routeVisiblePlaces === "function"
        ? Math.max(...routePool(routeVisiblePlaces()).map(place => Number(String(place.distance || "").match(/\\d+(?:\\.\\d+)?/)?.[0] || 0)))
        : null
    };
  })()`);
}

async function verifyRouteWindowOptions(cdp) {
  const result = {};
  for (const windowName of ["morning", "evening"]) {
    await cdp.evaluate(`(() => {
      const button = document.querySelector('[data-window="${windowName}"]');
      if (!button) throw new Error("Missing ${windowName} route window button.");
      button.click();
    })()`);
    await wait(100);
    result[windowName] = await cdp.evaluate(`(() => ({
      activeView: document.querySelector(".view.active")?.id || "",
      routeCards: document.querySelectorAll("#routeList .route-card").length,
      routeCountLabel: document.getElementById("routeCount")?.textContent?.trim() || "",
      routeText: document.getElementById("routeList")?.textContent?.trim().replace(/\\s+/g, " ").slice(0, 800) || "",
      fallback: window.prometheusDebugState?.routeWindowFallback || {}
    }))()`);
  }
  return result;
}

async function verifyRouteStateSynchronization(cdp) {
  return cdp.evaluate(`(() => {
    const latestVisit = state.visits.slice().sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))[0] || {};
    const place = state.places.find(item => item.id === latestVisit.placeId);
    if (!place || typeof routeIdentityKey !== "function") throw new Error("No logged route place available for synchronization check.");
    const key = routeIdentityKey(place);
    render();
    const routeCards = [...document.querySelectorAll("#routeList .route-card")].map(card => ({
      heading: card.querySelector("h3")?.textContent?.trim() || "",
      text: card.textContent.trim().replace(/\\s+/g, " ")
    }));
    const dailyCards = [...document.querySelectorAll("#dailyRoute .route-card")].map(card => ({
      heading: card.querySelector("h3")?.textContent?.trim() || "",
      text: card.textContent.trim().replace(/\\s+/g, " ")
    }));
    const listedRouteKeys = typeof activeRouteItems === "function"
      ? activeRouteItems().map(item => routeIdentityKey(item.place))
      : [];
    const bestNext = typeof routeRecommendation === "function" ? routeRecommendation() : null;
    return {
      loggedPlaceId: place.id,
      loggedName: place.name,
      routeKey: key,
      latestVisitPlaceId: latestVisit.placeId || "",
      routeCardCount: routeCards.length,
      dailyCardCount: dailyCards.length,
      routeCards: routeCards.slice(0, 12).map(card => card.text),
      dailyCards: dailyCards.slice(0, 12).map(card => card.text),
      routePoolStillContainsLogged: listedRouteKeys.includes(key),
      routeListStillContainsLogged: routeCards.some(card => card.heading === place.name),
      dailyRouteStillContainsLogged: dailyCards.some(card => card.heading === place.name),
      bestNextStillLogged: bestNext ? routeIdentityKey(bestNext) === key : false,
      bestNextName: bestNext?.name || ""
    };
  })()`);
}

async function verifyContinuousAdaptiveReplenishment(cdp) {
  return cdp.evaluate(`(async () => {
    const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
    const profile = activeProfile();
    const beforeQueue = profile.activeRouteQueue?.entries?.map(entry => ({ ...entry })) || [];
    if (beforeQueue.length !== 15) throw new Error("Expected 15 active stops before completion, found " + beforeQueue.length + ".");
    const completedEntry = beforeQueue[0];
    const completedPlace = state.places.find(place => routeIdentityKey(place) === completedEntry.identityKey);
    if (!completedPlace) throw new Error("Unable to resolve the first active route stop.");
    const beforeVisitCount = state.visits.length;
    const beforeRevision = Number(profile.activeRouteQueue?.revision || 0);
    document.querySelector('[data-open="quick"]')?.click();
    await wait(0);
    const form = document.getElementById("quickForm");
    if (!form) throw new Error("Quick Result form did not open.");
    form.elements.placeId.value = completedPlace.id;
    form.querySelector('[data-quick-outcome="sale"]')?.click();
    await wait(0);
    form.querySelector('#quickCounts .btn[type="submit"]')?.click();
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      const queue = activeProfile().activeRouteQueue;
      if (!document.getElementById("modal")?.classList.contains("active")
        && Number(queue?.revision || 0) > beforeRevision
        && window.prometheusDebugState?.routeReplenishment?.state !== "loading") break;
      await wait(50);
    }
    const afterProfile = activeProfile();
    const afterQueue = afterProfile.activeRouteQueue?.entries?.map(entry => ({ ...entry })) || [];
    const beforeIdentityKeys = new Set(beforeQueue.map(entry => entry.identityKey));
    const governedIdentityKeys = new Set(routeVisiblePlaces().map(routeIdentityKey));
    const stored = JSON.parse(localStorage.getItem(storeKey) || "{}");
    const storedProfile = stored.repProfiles?.[activeRepId] || {};
    const status = document.getElementById("routeLoopStatusToday")?.textContent?.trim() || "";
    const beforeFlight = routeReplenishmentCoordinator.status();
    const firstFlight = requestAdaptiveRouteReplenishment({ force: false, trigger: "concurrency-check" });
    const secondFlight = requestAdaptiveRouteReplenishment({ force: false, trigger: "concurrency-check" });
    await Promise.all([firstFlight, secondFlight]);
    const afterFlight = routeReplenishmentCoordinator.status();
    return {
      beforeQueueIds: beforeQueue.map(entry => entry.identityKey),
      afterQueueIds: afterQueue.map(entry => entry.identityKey),
      beforeVisitCount,
      afterVisitCount: state.visits.length,
      completedIdentity: completedEntry.identityKey,
      completedPlaceId: completedPlace.id,
      status,
      queueState: afterProfile.activeRouteQueue?.state || "",
      queueTarget: Number(afterProfile.activeRouteQueue?.targetSize || 0),
      queueThreshold: Number(afterProfile.activeRouteQueue?.threshold || 0),
      queueRevision: Number(afterProfile.activeRouteQueue?.revision || 0),
      latestEvidenceCount: Number(afterProfile.adaptiveIntelligence?.evidenceCount || 0),
      persistedVisitCount: Array.isArray(storedProfile.visits) ? storedProfile.visits.length : 0,
      persistedQueueIds: storedProfile.activeRouteQueue?.entries?.map(entry => entry.identityKey) || [],
      completedStillActive: afterQueue.some(entry => entry.identityKey === completedEntry.identityKey),
      allAfterGoverned: afterQueue.every(entry => governedIdentityKeys.has(entry.identityKey)),
      retainedCount: afterQueue.filter(entry => beforeIdentityKeys.has(entry.identityKey)).length,
      addedReplacementCount: afterQueue.filter(entry => !beforeIdentityKeys.has(entry.identityKey)).length,
      duplicateCount: afterQueue.length - new Set(afterQueue.map(entry => entry.identityKey)).size,
      debug: window.prometheusDebugState?.routeReplenishment || {},
      beforeFlight,
      afterFlight,
      concurrencyCoalesced: afterFlight.coalesced > beforeFlight.coalesced
    };
  })()`);
}

async function verifyHamzaRepeatRecommendation(cdp) {
  return cdp.evaluate(`(() => {
    if (typeof routeVisiblePlaces !== "function" || typeof buildRouteList !== "function") throw new Error("Route engine is unavailable.");
    const hamza = routeVisiblePlaces().find(place => /Hamza/i.test(place.name || ""));
    if (!hamza) throw new Error("Hamza's Barbershop is not visible in the active route pool.");
    const need = Math.max(0, GOAL - sumVisits(todayVisits()).units);
    const beforeRoute = buildRouteList(routeVisiblePlaces(), 10, { need, expandRadius: shouldExpandRadius(need) });
    const beforeIndex = beforeRoute.findIndex(item => routeIdentityKey(item.place) === routeIdentityKey(hamza));
    recordRouteRecommendation(hamza, "beta-sprint-2-hamza-regression");
    const afterRoute = buildRouteList(routeVisiblePlaces(), 10, { need, expandRadius: shouldExpandRadius(need) });
    const afterIndex = afterRoute.findIndex(item => routeIdentityKey(item.place) === routeIdentityKey(hamza));
    const afterAnalysis = routeAnalysis(hamza);
    const bestNext = routeRecommendation();
    return {
      hamzaId: hamza.id,
      hamzaName: hamza.name,
      routeKey: routeIdentityKey(hamza),
      beforeIndex,
      afterIndex,
      daysSinceRecommendation: afterAnalysis.daysSinceRecommendation,
      reasons: afterAnalysis.reasons,
      bestNextName: bestNext?.name || "",
      bestNextIsHamza: bestNext ? routeIdentityKey(bestNext) === routeIdentityKey(hamza) : false,
      routeHistoryEvidence: (state.routeHistory || []).filter(item => item.routeKey === routeIdentityKey(hamza)).slice(-3)
    };
  })()`);
}

async function verifyFieldSessionCompletion(cdp, completionAction) {
  return cdp.evaluate(`(async () => {
    const visible = element => {
      if (!element) return false;
      const style = getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden" && element.offsetParent !== null;
    };
    localStorage.removeItem(fieldSessionArchiveStoreKey);
    const place = routeVisiblePlaces()[0];
    if (!place) throw new Error("No route place is available for the field-session producer check.");
    state.visits = state.visits.filter(visit => visit.date !== todayKey());
    state.visits.push({
      id: id(),
      placeId: place.id,
      placeName: place.name,
      workspaceId: currentRouteWorkspaceId(),
      date: todayKey(),
      window: "Midday",
      conversations: 1,
      leads: 1,
      units: 0,
      laterUnits: 0,
      quality: "Lead",
      notes: "Dashboard runtime producer validation.",
      location: null,
      createdAt: Date.now() - 1000
    });
    persistStateWithoutRender();
    render();
    window.confirm = () => true;
    const result = await endFieldSession(${JSON.stringify(completionAction)});
    const record = currentFinalizedFieldSession();
    const frozenReport = JSON.parse(record?.rawReportText || "{}");
    const beforeBlockedVisitCount = state.visits.length;
    openModal("quick");
    const blockedModalOpen = document.getElementById("modal")?.classList.contains("active") || false;
    const blockedSave = await persistCompletedVisitAndRefreshRoute({
      id: id(),
      placeId: place.id,
      placeName: place.name,
      workspaceId: currentRouteWorkspaceId(),
      date: todayKey(),
      window: "Midday",
      conversations: 0,
      leads: 0,
      units: 0,
      laterUnits: 0,
      quality: "No contact",
      notes: "Must not persist after finalization.",
      location: null,
      createdAt: Date.now()
    });
    const duplicateResult = await endFieldSession(${JSON.stringify(completionAction === "end_route" ? "end_day" : "end_route")});
    return {
      resultStatus: result?.status || "",
      recordStatus: record?.status || "",
      completionAction: record?.completionAction || "",
      attempts: Number(record?.attempts || 0),
      acknowledgment: record?.acknowledgment || null,
      frozenReportType: frozenReport.reportType || "",
      frozenReportRep: frozenReport.rep?.id || "",
      frozenVisitCount: frozenReport.visits?.length || 0,
      localRawPreserved: Boolean(record?.rawReportText),
      handoffStatus: document.getElementById("handoffStatus")?.textContent?.trim() || "",
      endRouteDisabled: document.getElementById("endRoute")?.disabled ?? null,
      endDayDisabled: document.getElementById("endDay")?.disabled ?? null,
      retryVisible: visible(document.getElementById("retryFieldSessionArchive")),
      manualExportVisible: visible(document.getElementById("exportTodayReport")),
      manualExportDisabled: document.getElementById("exportTodayReport")?.disabled ?? null,
      blockedModalOpen,
      blockedSave,
      beforeBlockedVisitCount,
      afterBlockedVisitCount: state.visits.length,
      duplicateReturnedExisting: duplicateResult?.recordKey === record?.recordKey
    };
  })()`);
}

async function verifyDecisionContextProducer(cdp) {
  return cdp.evaluate(`(async () => {
    const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
    localStorage.removeItem(fieldSessionArchiveStoreKey);
    state.visits = state.visits.filter(visit => visit.date !== todayKey());
    persistStateWithoutRender();
    render();
    const recommendation = routeRecommendation();
    const alternative = routeVisiblePlaces().find(place => place.id !== recommendation?.id);
    if (!recommendation || !alternative) throw new Error("Decision context validation requires a recommendation and an alternative business.");
    const recommendationId = routeIdentityKey(recommendation);
    const sourceIds = Object.keys(visitDecisionSourceDefinitions);
    const routeOrderBeforeEvidence = activeRouteItems().map(item => routeIdentityKey(item.place));
    const visitsBeforeEvidence = state.visits.length;
    const generated = Object.fromEntries(sourceIds.map((sourceId, index) => {
      const placeId = sourceId === "route_iq_recommendation" ? recommendation.id : alternative.id;
      return [sourceId, createVisitDecisionEvidence({
        sourceId,
        visitId: "decision-source-validation-" + index,
        placeId,
        capturedAt: "2026-07-12T18:" + String(index).padStart(2, "0") + ":00.000Z",
        recommendationPlaceId: recommendation.id,
        recommendationId,
        workspaceId: currentRouteWorkspaceId()
      })];
    }));
    const unknown = createVisitDecisionEvidence({
      sourceId: "unknown",
      visitId: "decision-source-validation-unknown",
      placeId: alternative.id,
      capturedAt: "2026-07-12T18:59:00.000Z",
      recommendationPlaceId: recommendation.id,
      recommendationId,
      workspaceId: currentRouteWorkspaceId()
    });
    const legacyVisit = {
      id: "legacy-decision-source-visit",
      placeId: alternative.id,
      visitDecisionSource: null,
      recommendationDecisionContext: null,
      createdAt: Date.parse("2026-07-12T17:00:00.000Z")
    };
    const legacyReportGeneratedAt = "2026-07-12T19:00:00.000Z";
    const legacyReportContext = visitDecisionContextForReport(legacyVisit, legacyReportGeneratedAt);
    let workspaceBlocked = false;
    try {
      createVisitDecisionEvidence({
        sourceId: "manual_selection",
        visitId: "decision-source-cross-workspace",
        placeId: alternative.id,
        capturedAt: Date.now(),
        workspaceId: "retired_customer_workspace"
      });
    } catch (error) {
      workspaceBlocked = /outside (?:the active|the authenticated) workspace/i.test(error.message);
    }

    openModal("quick", { placeId: recommendation.id });
    const form = document.getElementById("quickForm");
    if (!form) throw new Error("Quick Result decision source form did not open.");
    form.elements.placeId.value = recommendation.id;
    form.querySelector('[data-quick-outcome="none"]')?.click();
    await wait(0);
    const noContactState = {
      visitsBefore: visitsBeforeEvidence,
      visitsAfterOutcomeSelection: state.visits.length,
      saveRequired: Boolean(form.querySelector('#quickCounts .btn[type="submit"]')),
      countsVisible: form.querySelector("#quickCounts")?.classList.contains("active") === true
    };
    form.querySelector('[data-quick-outcome="talk"]')?.click();
    await wait(0);
    const labels = [...form.querySelectorAll('.decision-source-option')].map(label => label.textContent.trim());
    const routeRadio = form.querySelector('[name="visitDecisionSourceId"][value="route_iq_recommendation"]');
    routeRadio.click();
    form.querySelector('[data-decision-source-skip]')?.click();
    const skipState = {
      selected: form.querySelector('[name="visitDecisionSourceId"]:checked')?.value || "unknown",
      status: form.querySelector('[data-decision-source-status]')?.textContent?.trim() || ""
    };
    routeRadio.click();
    const evidenceOnlyState = {
      routeOrderBefore: routeOrderBeforeEvidence,
      routeOrderAfter: activeRouteItems().map(item => routeIdentityKey(item.place)),
      visitsBefore: visitsBeforeEvidence,
      visitsAfter: state.visits.length,
      decisionSourceRequired: form.querySelector('[name="visitDecisionSourceId"][required]') !== null,
      capturedAtControlPresent: form.elements.namedItem("capturedAt") !== null,
      recommendationContextFields: [...form.querySelectorAll('input[type="hidden"]')]
        .map(input => input.name)
        .filter(name => name.startsWith("recommendation"))
        .sort(),
      representativeShadowOutputVisible: /shadow decision|recommendation readiness/i.test(form.innerText)
    };
    const submit = form.querySelector('#quickCounts .btn[type="submit"]');
    const modalBody = document.getElementById("modalBody");
    submit.scrollIntoView({ block: "end" });
    await wait(0);
    const submitRect = submit.getBoundingClientRect();
    const layout = {
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
      documentScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      modalOverflowY: getComputedStyle(modalBody).overflowY,
      submitTop: submitRect.top,
      submitBottom: submitRect.bottom,
      submitLeft: submitRect.left,
      submitRight: submitRect.right
    };
    form.requestSubmit();
    const deadline = Date.now() + 15000;
    while (document.getElementById("modal")?.classList.contains("active") && Date.now() < deadline) await wait(50);
    const visit = state.visits.find(item => item.date === todayKey());
    const reloaded = normalizeState(JSON.parse(localStorage.getItem(storeKey) || "{}"));
    const reloadedVisit = reloaded.repProfiles?.[activeRepId]?.visits?.find(item => item.id === visit?.id) || null;
    const activeLegacyVisit = {
      ...visit,
      id: "legacy-active-session-visit",
      placeId: alternative.id,
      placeName: alternative.name,
      visitDecisionSource: null,
      recommendationDecisionContext: null,
      createdAt: Number(visit.createdAt) + 1
    };
    state.visits.push(activeLegacyVisit);
    persistStateWithoutRender();
    const report = todayReportPayload();
    const legacyReportVisit = report.visits.find(item => item.visitId === activeLegacyVisit.id) || null;
    const legacyOriginalAfterReport = state.visits.find(item => item.id === activeLegacyVisit.id) || null;
    const completionActionsValid = ["end_route", "end_day"].every(completionAction => {
      const finalizedAt = new Date(Date.parse(report.generatedAt) + 1).toISOString();
      try {
        validateFieldSessionPayload({
          completionAction,
          workspaceId: currentRouteWorkspaceId(),
          operatingProfileId: activeOperatingProfile.profileId,
          finalExportConfirmed: true,
          sourceFinalizedAt: finalizedAt,
          rawReportText: JSON.stringify(report)
        });
        return true;
      } catch (error) {
        return false;
      }
    });
    window.confirm = () => true;
    const archive = await endFieldSession("end_route");
    return {
      sourceIds,
      generated,
      unknown,
      labels,
      skipState,
      noContactState,
      evidenceOnlyState,
      workspaceBlocked,
      visit,
      decisionSourceKeys: Object.keys(visit?.visitDecisionSource || {}).sort(),
      recommendationContextKeys: Object.keys(visit?.recommendationDecisionContext || {}).sort(),
      capturedAtMatchesVisitCreatedAt: Date.parse(visit?.visitDecisionSource?.capturedAt || "") === Number(visit?.createdAt),
      legacyMissingContext: {
        visitDecisionSource: normalizeVisitDecisionSource(undefined),
        recommendationDecisionContext: normalizeRecommendationDecisionContext(undefined),
        reportContext: legacyReportContext,
        originalVisitUnchanged: legacyVisit.visitDecisionSource === null && legacyVisit.recommendationDecisionContext === null,
        capturedAfterOutcome: Date.parse(legacyReportContext.visitDecisionSource.capturedAt) > Number(legacyVisit.createdAt)
      },
      legacyFinalization: {
        completionActionsValid,
        reportVisit: legacyReportVisit,
        originalVisitUnchanged: legacyOriginalAfterReport?.visitDecisionSource === null && legacyOriginalAfterReport?.recommendationDecisionContext === null,
        capturedAfterOutcome: Date.parse(legacyReportVisit?.visitDecisionSource?.capturedAt || "") > Number(activeLegacyVisit.createdAt)
      },
      reloadedVisit,
      reportVisit: report.visits.find(item => item.visitId === visit?.id) || null,
      archiveStatus: archive?.status || "",
      acknowledgment: archive?.acknowledgment || null,
      layout
    };
  })()`);
}

async function verifyDecisionContextDesktopLayout(cdp) {
  return cdp.evaluate(`(() => {
    openModal("quick");
    const quickForm = document.getElementById("quickForm");
    const quickInitiallyHidden = quickForm.querySelector("#quickCounts")?.classList.contains("active") !== true;
    quickForm.querySelector('[data-quick-outcome="talk"]')?.click();
    const fieldset = quickForm.querySelector('[data-decision-source-capture]');
    const rect = fieldset?.getBoundingClientRect() || {};
    const quickCount = quickForm.querySelectorAll('.decision-source-option').length;
    const quickOptional = quickForm.querySelector('[name="visitDecisionSourceId"][required]') === null;
    closeModal();

    openModal("visit");
    const visitForm = document.getElementById("visitForm");
    const visitCount = visitForm.querySelectorAll('.decision-source-option').length;
    closeModal();

    openModal("place");
    const placeForm = document.getElementById("placeForm");
    const initialVisitFields = document.getElementById("initialVisitFields");
    const addPlaceInitiallyHidden = initialVisitFields?.hidden === true;
    placeForm.elements.recordInitialVisit.click();
    const addPlaceCount = placeForm.querySelectorAll('.decision-source-option').length;
    const addPlaceVisibleWithVisit = initialVisitFields?.hidden === false;
    const result = {
      viewportWidth: innerWidth,
      quickCount,
      visitCount,
      addPlaceCount,
      quickInitiallyHidden,
      quickOptional,
      addPlaceInitiallyHidden,
      addPlaceVisibleWithVisit,
      left: Number(rect.left || 0),
      right: Number(rect.right || 0),
      scrollWidth: document.documentElement.scrollWidth
    };
    closeModal();
    return result;
  })()`);
}

async function verifyFieldSessionRetry(cdp) {
  return cdp.evaluate(`(async () => {
    const visible = element => {
      if (!element) return false;
      const style = getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden" && element.offsetParent !== null;
    };
    localStorage.removeItem(fieldSessionArchiveStoreKey);
    const place = routeVisiblePlaces()[0];
    if (!place) throw new Error("No route place is available for the field-session retry check.");
    state.visits = state.visits.filter(visit => visit.date !== todayKey());
    state.visits.push({
      id: id(),
      placeId: place.id,
      placeName: place.name,
      workspaceId: currentRouteWorkspaceId(),
      date: todayKey(),
      window: "Evening",
      conversations: 1,
      leads: 0,
      units: 0,
      laterUnits: 0,
      quality: "Conversation",
      notes: "Dashboard runtime retry validation.",
      location: null,
      createdAt: Date.now() - 1000
    });
    persistStateWithoutRender();
    render();
    window.confirm = () => true;
    await endFieldSession("end_day");
    const failed = currentFinalizedFieldSession();
    const failureState = {
      status: failed?.status || "",
      attempts: Number(failed?.attempts || 0),
      retryable: failed?.retryable,
      rawReportText: failed?.rawReportText || "",
      handoffStatus: document.getElementById("handoffStatus")?.textContent?.trim() || "",
      retryVisible: visible(document.getElementById("retryFieldSessionArchive"))
    };
    await retryFieldSessionArchive();
    const archived = currentFinalizedFieldSession();
    return {
      failureState,
      finalStatus: archived?.status || "",
      attempts: Number(archived?.attempts || 0),
      rawReportUnchanged: archived?.rawReportText === failureState.rawReportText,
      acknowledgment: archived?.acknowledgment || null,
      handoffStatus: document.getElementById("handoffStatus")?.textContent?.trim() || "",
      retryVisible: visible(document.getElementById("retryFieldSessionArchive")),
      manualExportVisible: visible(document.getElementById("exportTodayReport")),
      manualExportDisabled: document.getElementById("exportTodayReport")?.disabled ?? null
    };
  })()`);
}

async function verifyPostVisitOutcomeEditing(cdp) {
  return cdp.evaluate(`(async () => {
    const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
    localStorage.removeItem(fieldSessionArchiveStoreKey);
    state.visits = state.visits.filter(visit => visit.date !== todayKey());
    state.visitCorrections = [];
    const place = routeVisiblePlaces()[0];
    if (!place) throw new Error("No route place is available for visit correction validation.");
    const seededVisitId = id();
    state.visits.push({
      id: seededVisitId,
      placeId: place.id,
      placeName: place.name,
      workspaceId: currentRouteWorkspaceId(),
      date: todayKey(),
      window: "Midday",
      conversations: 1,
      leads: 0,
      units: 0,
      laterUnits: 0,
      quality: "Conversation",
      notes: "Original visit evidence.",
      location: null,
      createdAt: Date.now() - 2000
    });
    persistStateWithoutRender();
    render();
    const visitId = seededVisitId;
    const originalBefore = JSON.stringify(state.visits.find(visit => visit.id === visitId));
    const routeStatsBefore = placeStats(place.id);
    setTab("places");
    const placesBefore = {
      activeView: document.querySelector(".view.active")?.id || "",
      title: document.getElementById("placesTitle")?.textContent?.trim() || "",
      cards: document.querySelectorAll("#placesList .item").length,
      viewVisitVisible: Boolean(document.querySelector('[data-view-visit="' + visitId + '"]'))
    };
    document.querySelector('[data-view-visit="' + visitId + '"]')?.click();
    const originalAuditText = document.getElementById("modalBody")?.textContent?.trim().replace(/\\s+/g, " ") || "";

    let mobileFormReachability = null;
    const submitCorrection = async values => {
      document.querySelector('[data-update-visit="' + visitId + '"]')?.click();
      const form = document.getElementById("visitCorrectionForm");
      if (!form) throw new Error("Visit correction form did not open.");
      if (!mobileFormReachability) {
        const modalBody = document.getElementById("modalBody");
        const submit = form.querySelector('button[type="submit"]');
        submit?.scrollIntoView({ block: "end" });
        await wait(0);
        const submitRect = submit?.getBoundingClientRect() || {};
        mobileFormReachability = {
          modalClientHeight: modalBody?.clientHeight || 0,
          modalScrollHeight: modalBody?.scrollHeight || 0,
          modalOverflowY: modalBody ? getComputedStyle(modalBody).overflowY : "",
          submitTop: Number(submitRect.top || 0),
          submitBottom: Number(submitRect.bottom || 0),
          submitLeft: Number(submitRect.left || 0),
          submitRight: Number(submitRect.right || 0),
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight
        };
      }
      for (const [name, value] of Object.entries(values)) {
        if (form.elements[name]) form.elements[name].value = String(value);
      }
      form.requestSubmit();
      await wait(50);
      return document.getElementById("modalBody")?.textContent?.trim().replace(/\\s+/g, " ") || "";
    };

    const firstAuditText = await submitCorrection({
      quality: "Appointment",
      leads: 1,
      appointments: 1,
      followUp: "Call tomorrow at 10 AM",
      manager: "Jordan Manager",
      contactName: "Taylor Contact",
      contactPhone: "713-555-0100",
      contactEmail: "taylor@example.com"
    });
    const firstCount = state.visitCorrections.length;
    const secondAuditText = await submitCorrection({
      quality: "Membership/Unit",
      units: 1,
      notes: "Employee came outside and completed signup."
    });
    const secondCount = state.visitCorrections.length;
    const eventIds = state.visitCorrections.map(event => event.eventId);
    const sequences = state.visitCorrections.map(event => event.sequence);
    const reloadedState = normalizeState(JSON.parse(localStorage.getItem(storeKey) || "{}"));
    const reloadedCorrections = reloadedState.repProfiles?.[activeRepId]?.visitCorrections || [];

    document.querySelector('[data-update-visit="' + visitId + '"]')?.click();
    const duplicateForm = document.getElementById("visitCorrectionForm");
    duplicateForm?.requestSubmit();
    await wait(30);
    const duplicateStatus = document.getElementById("visitCorrectionStatus")?.textContent?.trim() || "";
    const countAfterDuplicate = state.visitCorrections.length;

    openModal("visit-detail", { visitId });
    const finalAuditText = document.getElementById("modalBody")?.textContent?.trim().replace(/\\s+/g, " ") || "";
    const originalAfter = JSON.stringify(state.visits.find(visit => visit.id === visitId));
    const verified = effectiveVisitOutcome(state.visits.find(visit => visit.id === visitId));
    const routeStatsAfter = placeStats(place.id);
    const report = todayReportPayload();
    const evidence = report.visitOutcomeEvidence;
    const finalReportVisit = report.visits.find(visit => visit.visitId === visitId);

    window.confirm = () => true;
    const archiveResult = await endFieldSession("end_route");
    openModal("visit-detail", { visitId });
    const correctionButtonAfterArchive = Boolean(document.querySelector('[data-update-visit="' + visitId + '"]'));
    let archivedMutationBlocked = false;
    try {
      appendVisitCorrection(visitId, { ...verified, units: 2 });
    } catch (error) {
      archivedMutationBlocked = /Archived sessions/.test(error.message);
    }

    return {
      placesBefore,
      originalAuditText,
      firstAuditText,
      secondAuditText,
      finalAuditText,
      firstCount,
      secondCount,
      countAfterDuplicate,
      duplicateStatus,
      eventIds,
      sequences,
      reloadedCorrectionCount: reloadedCorrections.length,
      reloadedFinalOutcome: reloadedCorrections.at(-1)?.finalVerifiedOutcome || null,
      mobileFormReachability,
      originalUnchanged: originalBefore === originalAfter,
      verified,
      routeStatsBefore,
      routeStatsAfter,
      report: {
        finalVisit: finalReportVisit,
        originalVisit: evidence?.originalVisits?.find(visit => visit.visitId === visitId) || null,
        correctionCount: evidence?.correctionEvents?.length || 0,
        finalOutcome: evidence?.finalVerifiedOutcomes?.find(outcome => outcome.visitId === visitId) || null,
        auditModel: evidence?.auditModel || ""
      },
      archiveStatus: archiveResult?.status || "",
      acknowledgment: archiveResult?.acknowledgment || null,
      correctionButtonAfterArchive,
      archivedMutationBlocked,
      documentScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      viewportWidth: window.innerWidth
    };
  })()`);
}

async function verifyAddPlaceImmediateOutcomeCapture(cdp) {
  return cdp.evaluate(`(async () => {
    const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
    const visible = element => {
      if (!element) return false;
      const style = getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden" && element.offsetParent !== null;
    };
    localStorage.removeItem(fieldSessionArchiveStoreKey);
    state.visits = state.visits.filter(visit => visit.date !== todayKey());
    state.visitCorrections = [];
    state.places = state.places.filter(place => !String(place.name || "").startsWith("Immediate Outcome Harness"));
    persistStateWithoutRender();
    render();
    const addPlaceButtonVisible = visible(document.querySelector('[data-open="location"]'));
    const routeIdentityBefore = routeVisiblePlaces().map(routeIdentityKey);
    let outcomeOptions = [];
    let mobileReachability = null;

    const submitPlace = async ({ key, outcome = "", manager = "", followUp = "", notes = "" }) => {
      openModal("location");
      const form = document.getElementById("placeForm");
      if (!form) throw new Error("Add Place form did not open.");
      form.elements.name.value = "Immediate Outcome Harness " + key;
      form.elements.address.value = (1000 + key.length) + " Test Way, Houston, TX 77001";
      form.elements.category.value = "Business";
      form.elements.window.value = "Midday";
      if (!outcomeOptions.length) outcomeOptions = [...form.elements.initialOutcome.options].map(option => option.textContent.trim());
      if (outcome) {
        form.elements.recordInitialVisit.checked = true;
        form.elements.recordInitialVisit.dispatchEvent(new Event("change", { bubbles: true }));
        form.elements.initialOutcome.value = outcome;
        form.elements.initialManagerContact.value = manager;
        form.elements.initialFollowUp.value = followUp;
        form.elements.initialVisitNotes.value = notes;
      }
      if (!mobileReachability && outcome) {
        const modalBody = document.getElementById("modalBody");
        const submit = form.querySelector('button[type="submit"]');
        submit.scrollIntoView({ block: "end" });
        await wait(0);
        const rect = submit.getBoundingClientRect();
        mobileReachability = {
          fieldsVisible: !document.getElementById("initialVisitFields").hidden,
          modalClientHeight: modalBody.clientHeight,
          modalScrollHeight: modalBody.scrollHeight,
          modalOverflowY: getComputedStyle(modalBody).overflowY,
          submitTop: rect.top,
          submitBottom: rect.bottom,
          submitLeft: rect.left,
          submitRight: rect.right,
          viewportWidth: innerWidth,
          viewportHeight: innerHeight
        };
      }
      form.requestSubmit();
      form.requestSubmit();
      const deadline = Date.now() + 15000;
      while (Date.now() < deadline) {
        const modalClosed = !document.getElementById("modal").classList.contains("active");
        const status = document.getElementById("placeFormStatus")?.textContent?.trim() || "";
        if (modalClosed || status) break;
        await wait(50);
      }
      const place = state.places.find(item => item.name === "Immediate Outcome Harness " + key) || null;
      const visit = place ? state.visits.find(item => item.placeId === place.id) || null : null;
      const status = document.getElementById("placeFormStatus")?.textContent?.trim() || "";
      return { place, visit, status };
    };

    const businessOnly = await submitPlace({ key: "Business Only" });
    const conversation = await submitPlace({
      key: "Conversation",
      outcome: "conversation",
      manager: "Jordan Manager 713-555-0110",
      notes: "Initial conversation captured during business creation."
    });
    const lead = await submitPlace({ key: "Lead", outcome: "lead" });
    const membership = await submitPlace({ key: "Membership", outcome: "membership_unit" });
    const appointment = await submitPlace({ key: "Appointment", outcome: "appointment" });
    const followUp = await submitPlace({
      key: "Follow Up",
      outcome: "follow_up_required",
      followUp: "Return Wednesday at 10 AM"
    });

    const beforeExactDuplicatePlaces = state.places.length;
    const beforeExactDuplicateVisits = state.visits.length;
    const exactDuplicate = await submitPlace({ key: "Business Only" });
    const duplicateProtection = {
      status: exactDuplicate.status,
      placeCountUnchanged: state.places.length === beforeExactDuplicatePlaces,
      visitCountUnchanged: state.visits.length === beforeExactDuplicateVisits
    };
    closeModal();

    const previousWorkspace = document.body.dataset.workspaceId;
    document.body.dataset.workspaceId = "retired_customer_workspace";
    const beforeIsolationPlaces = state.places.length;
    const isolated = await submitPlace({ key: "Cross Workspace", outcome: "lead" });
    const workspaceIsolation = {
      status: isolated.status,
      noPlaceCreated: state.places.length === beforeIsolationPlaces && !isolated.place,
      noVisitCreated: !isolated.visit
    };
    closeModal();
    document.body.dataset.workspaceId = previousWorkspace;

    const foreignSavedPlace = {
      id: id(),
      name: "Immediate Outcome Harness Other Rep",
      category: "Business",
      window: "Midday",
      address: "1999 Other Rep Way, Houston, TX 77001",
      permission: "Unknown",
      canRevisit: true,
      repProfileId: "cruz",
      workspaceId: currentRouteWorkspaceId(),
      sourceType: "Dashboard Manual Entry",
      notes: "Representative ownership regression fixture.",
      createdAt: Date.now()
    };
    state.places.push(foreignSavedPlace);
    persistStateWithoutRender();
    render();

    setTab("places");
    const businessOnlyVisibleInPlaces = document.getElementById("placesList")?.textContent?.includes(businessOnly.place?.name || "") || false;
    const visitedBeforePromotion = document.querySelector('[data-places-list="visited"]')?.textContent || "";
    const savedBeforePromotion = document.querySelector('[data-places-list="saved"]')?.textContent || "";
    const savedStatusCount = document.querySelectorAll('[data-places-list="saved"] [data-saved-place] .pill.yellow').length;
    const prePromotionReport = todayReportPayload();
    const founderBeforePromotionIds = founderProductionPlaces(state.places).map(place => place.id);
    const statisticsBeforePromotionIds = placesWithVerifiedVisits(state.places, teamVisits()).map(place => place.id);
    const prePromotionIntelligenceHasSavedPlace = Boolean(activeProfile().placePerformance?.[businessOnly.place?.id]);
    openModal("quick");
    const quickForm = document.getElementById("quickForm");
    const businessOnlyVisibleInQuickResult = [...(quickForm?.elements.placeId?.options || [])]
      .some(option => option.value === businessOnly.place?.id);
    quickForm.elements.placeId.value = businessOnly.place.id;
    quickForm.querySelector('[data-quick-outcome="talk"]')?.click();
    await wait(0);
    quickForm.requestSubmit();
    const promotionDeadline = Date.now() + 15000;
    while (Date.now() < promotionDeadline && document.getElementById("modal")?.classList.contains("active")) await wait(50);
    setTab("places");
    const visitedAfterPromotion = document.querySelector('[data-places-list="visited"]')?.textContent || "";
    const savedAfterPromotion = document.querySelector('[data-places-list="saved"]')?.textContent || "";
    const founderAfterPromotionIds = founderProductionPlaces(state.places).map(place => place.id);
    const statisticsAfterPromotionIds = placesWithVerifiedVisits(state.places, teamVisits()).map(place => place.id);
    const promotionVisit = state.visits.find(visit => visit.placeId === businessOnly.place.id) || null;
    setTab("today");

    const mappedOutcomes = Object.fromEntries(Object.entries(initialPlaceVisitOutcomes).map(([key, value]) => [key, { ...value }]));
    const originalConversation = conversation.visit ? visitOutcomeSnapshot(conversation.visit) : null;
    if (conversation.visit) {
      appendVisitCorrection(conversation.visit.id, {
        ...originalConversation,
        quality: "Lead",
        leads: 1
      });
    }
    const reportBeforeArchive = todayReportPayload();
    const reloaded = normalizeState(JSON.parse(localStorage.getItem(storeKey) || "{}"));
    const reloadedVisits = reloaded.repProfiles?.[activeRepId]?.visits || [];
    const routeIdentityAfter = routeVisiblePlaces().map(routeIdentityKey);
    window.confirm = () => true;
    const archive = await endFieldSession("end_route");
    openModal("location");
    const initialVisitDisabledAfterArchive = document.getElementById("placeForm")?.elements.recordInitialVisit?.disabled === true;
    closeModal();

    return {
      addPlaceButtonVisible,
      outcomeOptions,
      mobileReachability,
      businessOnly: { place: businessOnly.place, hasVisit: Boolean(businessOnly.visit) },
      conversation: conversation.visit,
      lead: lead.visit,
      membership: membership.visit,
      appointment: appointment.visit,
      followUp: followUp.visit,
      mappedOutcomes,
      duplicateProtection,
      workspaceIsolation,
      businessOnlyVisibleInPlaces,
      businessOnlyVisibleInQuickResult,
      representativePlacesGovernance: {
        visitedBeforePromotion,
        savedBeforePromotion,
        visitedAfterPromotion,
        savedAfterPromotion,
        savedStatusCount,
        foreignSavedVisible: savedBeforePromotion.includes(foreignSavedPlace.name),
        prePromotionReportContainsSaved: prePromotionReport.visits.some(visit => visit.placeId === businessOnly.place?.id),
        founderBeforePromotionContainsSaved: founderBeforePromotionIds.includes(businessOnly.place?.id),
        statisticsBeforePromotionContainsSaved: statisticsBeforePromotionIds.includes(businessOnly.place?.id),
        prePromotionIntelligenceHasSavedPlace,
        routeBeforePromotionContainsSaved: routeIdentityBefore.includes(routeIdentityKey(businessOnly.place)),
        activePoolClassified: Boolean(businessOnly.place?.runtimePool || businessOnly.place?.googlePlaceId),
        promotionVisit,
        founderAfterPromotionContainsVisited: founderAfterPromotionIds.includes(businessOnly.place?.id),
        statisticsAfterPromotionContainsVisited: statisticsAfterPromotionIds.includes(businessOnly.place?.id)
      },
      correctionCount: state.visitCorrections.length,
      correctedConversation: conversation.visit ? effectiveVisitOutcome(conversation.visit) : null,
      report: {
        visitCount: reportBeforeArchive.visits.length,
        businessCreationCount: reportBeforeArchive.visits.filter(visit => visit.businessCreation?.source === "dashboard_add_place").length,
        correctionCount: reportBeforeArchive.visitOutcomeEvidence?.correctionEvents?.length || 0,
        conversationOriginal: reportBeforeArchive.visitOutcomeEvidence?.originalVisits?.find(visit => visit.visitId === conversation.visit?.id) || null,
        conversationFinal: reportBeforeArchive.visits.find(visit => visit.visitId === conversation.visit?.id) || null
      },
      reload: {
        initialVisitCount: reloadedVisits.filter(visit => visit.businessCreatedWithVisit).length,
        appointment: reloadedVisits.find(visit => visit.id === appointment.visit?.id) || null,
        followUp: reloadedVisits.find(visit => visit.id === followUp.visit?.id) || null
      },
      routePoolUnchanged: JSON.stringify(routeIdentityBefore) === JSON.stringify(routeIdentityAfter),
      archiveStatus: archive?.status || "",
      acknowledgment: archive?.acknowledgment || null,
      initialVisitDisabledAfterArchive,
      documentScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      viewportWidth: innerWidth
    };
  })()`);
}

async function verifyDesktopRepresentativePlaces(cdp) {
  return cdp.evaluate(`(() => {
    const savedPlace = {
      id: id(),
      name: "Desktop Saved Places Harness",
      category: "Business",
      window: "Midday",
      address: "1888 Desktop Test Way, Houston, TX 77001",
      permission: "Unknown",
      canRevisit: true,
      repProfileId: activeRepId,
      workspaceId: currentRouteWorkspaceId(),
      operatingProfileId: activeOperatingProfile.profileId,
      candidateAdmission: "VERIFICATION_REQUIRED",
      sourceType: "Dashboard Manual Entry",
      notes: "Desktop rendering regression fixture.",
      createdAt: Date.now()
    };
    state.places.push(savedPlace);
    persistStateWithoutRender();
    render();
    setTab("places");
    const visited = document.querySelector('[data-places-section="visited"]');
    const saved = document.querySelector('[data-places-section="saved"]');
    const savedCard = document.querySelector('[data-saved-place="' + savedPlace.id + '"]');
    const result = {
      viewportWidth: innerWidth,
      title: document.getElementById("placesTitle")?.textContent?.trim() || "",
      visitedHeading: visited?.querySelector("h3")?.textContent?.trim() || "",
      savedHeading: saved?.querySelector("h3")?.textContent?.trim() || "",
      savedText: savedCard?.textContent?.trim().replace(/\\s+/g, " ") || "",
      savedLeft: savedCard?.getBoundingClientRect().left || 0,
      savedRight: savedCard?.getBoundingClientRect().right || 0,
      visitedCount: visited?.querySelectorAll(".item").length || 0,
      savedCount: saved?.querySelectorAll(".item").length || 0
    };
    state.places = state.places.filter(place => place.id !== savedPlace.id);
    persistStateWithoutRender();
    render();
    return result;
  })()`);
}

async function verifyEventbriteExpansion(cdp) {
  return cdp.evaluate(`(() => {
    const cards = [...document.querySelectorAll("#eventOpportunities .item")];
    const accessCards = cards.filter(card => [...card.querySelectorAll(".address-line")]
      .some(line => line.textContent.includes("Access:")));
    const mapLinks = cards.map(card => [...card.querySelectorAll("a")]
      .find(link => link.textContent.trim() === "Open map")).filter(Boolean);
    const eventbriteLinks = cards.map(card => [...card.querySelectorAll("a")]
      .find(link => link.textContent.trim() === "View Eventbrite")).filter(Boolean);
    const addButtons = cards.map(card => card.querySelector("[data-add-event]")).filter(Boolean);
    const firstCardName = cards[0]?.querySelector("h3")?.textContent?.trim() || "";
    const placeCountBefore = state.places.length;
    addButtons[0]?.click();
    const form = document.getElementById("placeForm");
    const result = {
      testClockNow: globalThis.__prometheusNoncanonicalTestClock?.now || "",
      testClockMode: globalThis.__prometheusNoncanonicalTestClock?.mode || "",
      localDate: todayKey(),
      eventCards: cards.length,
      accessCards: accessCards.length,
      mapLinks: mapLinks.length,
      mapLinksValid: mapLinks.every(link => link.href.startsWith("https://www.google.com/maps/search/?api=1&query=")),
      eventbriteLinks: eventbriteLinks.length,
      eventbriteLinksValid: eventbriteLinks.every(link => link.href.startsWith("https://www.eventbrite.com/")),
      addButtons: addButtons.length,
      firstCardName,
      addModalActive: document.getElementById("modal")?.classList.contains("active") === true,
      addModalTitle: document.getElementById("modalTitle")?.textContent?.trim() || "",
      addFormName: form?.elements.name?.value?.trim() || "",
      addFormCategory: form?.elements.category?.value || "",
      addFormAddress: form?.elements.address?.value?.trim() || "",
      placeCountUnchanged: state.places.length === placeCountBefore
    };
    closeModal();
    return result;
  })()`);
}

async function runPageScenario(chrome, server, path, name, options = {}) {
  const eventLog = { runtimeExceptions: [], consoleErrors: [], logErrors: [], network: [] };
  const cdp = await attachPage(chrome, eventLog);
  try {
    await setViewport(cdp, options.viewport);
    await setStandaloneMode(cdp, options.standalone);
    await setNoncanonicalTestClock(cdp, resolveRuntimeWorkflowScenarioClock(options));
    const url = `${server.origin}${path}`;
    await navigateAndWait(cdp, url);
    const routeLoadMs = await waitForDashboardReady(cdp, 60000);
    const initial = await snapshot(cdp);
    return { name, cdp, eventLog, routeLoadMs, initial };
  } catch (error) {
    const scenarioError = new Error(`${error.message}; events=${JSON.stringify(eventLog)}`, { cause: error });
    try {
      await cdp.close();
    } catch (cleanupError) {
      throw new AggregateError(
        [scenarioError, cleanupError],
        `${scenarioError.message}; target cleanup failed: ${errorCauseDiagnostic(cleanupError)}`,
        { cause: scenarioError }
      );
    }
    throw scenarioError;
  }
}

async function waitForGovernedProfileMismatch(cdp, expectedReason, timeoutMs = 10000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const status = await cdp.evaluate(`(() => {
      const debug = window.prometheusDebugState || {};
      return {
        startupCompleted: debug.startupCompleted === true,
        lastError: debug.lastError || "",
        lastUnhandledRejection: debug.lastUnhandledRejection || ""
      };
    })()`);
    if (status.startupCompleted) {
      throw new Error(`Dashboard unexpectedly completed startup for governed profile mismatch: ${JSON.stringify(status)}`);
    }
    if (status.lastError === expectedReason && status.lastUnhandledRejection === expectedReason) {
      return Date.now() - startedAt;
    }
    await wait(100);
  }
  const diagnostic = await cdp.evaluate(`(() => ({
    href: location.href,
    debug: window.prometheusDebugState || null,
    routeCards: document.querySelectorAll("#routeList .route-card").length,
    dailyRouteCards: document.querySelectorAll("#dailyRoute .route-card").length
  }))()`).catch(error => ({ diagnosticError: error.message }));
  throw new Error(`Dashboard did not record the governed profile mismatch before timeout: ${JSON.stringify(diagnostic)}`);
}

async function runGovernedProfileMismatchScenario(chrome, server, profileId) {
  const name = `operating-profile-${profileId}-mismatch`;
  const expectedReason = `Route replenishment operating profile is not authorized: ${profileId}`;
  const eventLog = { runtimeExceptions: [], consoleErrors: [], logErrors: [], network: [] };
  const cdp = await attachPage(chrome, eventLog);
  try {
    const path = `/?role=founder&debug=1&operatingProfile=${profileId}&harness=${name}`;
    await navigateAndWait(cdp, `${server.origin}${path}`);
    const mismatchMs = await waitForGovernedProfileMismatch(cdp, expectedReason);
    const initial = await snapshot(cdp);
    const boundary = await cdp.evaluate(`(() => {
      const workspaceId = currentRouteWorkspaceId();
      const queueEntries = state?.repProfiles?.[activeRepId]?.activeRouteQueue?.entries;
      return {
        selectedOperatingProfileId: activeOperatingProfile?.profileId || "",
        workspaceId,
        authorizedOperatingProfileId: dashboardWorkspaces[workspaceId]?.operatingProfileId || "",
        businessHoursWorkspaceId: routeBusinessHoursIndex?.workspaceId || "",
        businessHoursOperatingProfileId: routeBusinessHoursIndex?.operatingProfileId || "",
        activeQueueCount: Array.isArray(queueEntries) ? queueEntries.length : 0
      };
    })()`);
    return { name, cdp, eventLog, mismatchMs, expectedReason, initial, boundary };
  } catch (error) {
    const scenarioError = new Error(`${error.message}; events=${JSON.stringify(eventLog)}`, { cause: error });
    try {
      await cdp.close();
    } catch (cleanupError) {
      throw new AggregateError(
        [scenarioError, cleanupError],
        `${scenarioError.message}; target cleanup failed: ${errorCauseDiagnostic(cleanupError)}`,
        { cause: scenarioError }
      );
    }
    throw scenarioError;
  }
}

async function navigateExistingScenario(cdp, server, path) {
  await navigateAndWait(cdp, `${server.origin}${path}`);
  await waitForDashboardReady(cdp, 60000);
  return snapshot(cdp);
}

function verifyMobileFit(label, fit) {
  const scrollFits = fit.docScrollWidth <= fit.viewportWidth + 1 && fit.bodyScrollWidth <= fit.viewportWidth + 1;
  const controlsFit = Object.values(fit.rects).every(rect => !rect?.visible || (rect.left >= -1 && rect.right <= fit.viewportWidth + 1));
  const detail = `${fit.activeView}: viewport ${fit.viewportWidth}px, doc ${fit.docScrollWidth}px, body ${fit.bodyScrollWidth}px`;
  assertWorkflow(label, scrollFits && controlsFit && fit.offenders.length === 0, detail, JSON.stringify(fit));
}

function verifyRepOnly(label, snap) {
  const repOnly = snap.sessionRole === "rep"
    && snap.mode === "rep"
    && snap.activeRepId === customerPwaSessionFixture.representativeId
    && snap.visibleTabs.join(",") === "today,route,places"
    && snap.visibleOwnerControls.length === 0
    && snap.profileButtonLabels.length === 0
    && !snap.modeButtonLabels.includes("Owner");
  assertWorkflow(label, repOnly, `role ${snap.sessionRole}, mode ${snap.mode}, rep ${snap.activeRepId}, tabs ${snap.visibleTabs.join(", ")}`, JSON.stringify(snap));
}

function verifyOperatingProfileVocabulary(label, snap, expected) {
  const combinedText = `${snap.todayText} ${snap.routeText} ${snap.placesText} ${snap.statsText}`;
  const hasExpectedTerms = expected.terms.every(term => combinedText.includes(term));
  const detail = `${snap.operatingProfileId}: ${expected.terms.join(", ")}`;
  assertWorkflow(
    label,
    snap.operatingProfileId === expected.profileId
      && snap.debug.operatingProfile?.profileId === expected.profileId
      && snap.debug.operatingProfile?.source?.includes(expected.profileId)
      && hasExpectedTerms
      && snap.debug.operatingProfile?.scoringChanged === false
      && snap.debug.operatingProfile?.activePoolChanged === false
      && snap.debug.operatingProfile?.mobileBetaChanged === false,
    detail,
    JSON.stringify({
      expected,
      operatingProfileId: snap.operatingProfileId,
      operatingProfile: snap.debug.operatingProfile,
      todayText: snap.todayText.slice(0, 500),
      routeText: snap.routeText.slice(0, 500),
      statsText: snap.statsText.slice(0, 500)
    })
  );
}

function verifyNoErrors(label, eventLog, snap, { allow = [] } = {}) {
  const allErrors = [
    ...eventLog.runtimeExceptions,
    ...eventLog.consoleErrors,
    ...eventLog.logErrors,
    snap.debug.lastError,
    snap.debug.lastUnhandledRejection
  ].filter(Boolean).filter(error => !allow.some(pattern => error.includes(pattern)));
  assertWorkflow(`${label} JavaScript console/runtime errors`, allErrors.length === 0, "no page runtime or console errors", allErrors.join(" | "));
}

async function waitForProspectiveRequests(server, count, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (server.prospectiveRequests.length >= count) return;
    await wait(25);
  }
  throw new Error(`Expected ${count} prospective requests, received ${server.prospectiveRequests.length}.`);
}

async function verifyProspectiveShadowDashboardSeam(scenario, server) {
  await waitForProspectiveRequests(server, 1);
  const beforeCount = server.prospectiveRequests.length;
  const browserResult = await scenario.cdp.evaluate(`(async () => {
    const anchor = document.getElementById("bestMoveDirections");
    if (!anchor || !anchor.href || anchor.getAttribute("href") === "#") {
      throw new Error("The governed rank-one Directions action is unavailable.");
    }
    const marker = "DO_NOT_EXPOSE_SHADOW_PAYLOAD";
    const before = {
      bestNextMove: document.getElementById("bestNextMove")?.textContent?.trim() || "",
      routeQueueIds: activeProfile().activeRouteQueue?.entries?.map(entry => entry.identityKey) || [],
      visitCount: state.visits.length,
      modalActive: document.getElementById("modal")?.classList.contains("active") || false,
      activeView: document.querySelector(".view.active")?.id || ""
    };
    anchor.addEventListener("click", event => event.preventDefault(), { once: true });
    anchor.click();
    await new Promise(resolve => setTimeout(resolve, 100));
    const databaseNames = typeof indexedDB.databases === "function"
      ? (await indexedDB.databases()).map(database => database.name || "")
      : [];
    const cacheNames = typeof caches?.keys === "function" ? await caches.keys() : [];
    const localValues = Object.values(localStorage);
    const sessionValues = Object.values(sessionStorage);
    const bodyText = document.body.textContent || "";
    const debugText = JSON.stringify(window.prometheusDebugState || {});
    return {
      before,
      after: {
        bestNextMove: document.getElementById("bestNextMove")?.textContent?.trim() || "",
        routeQueueIds: activeProfile().activeRouteQueue?.entries?.map(entry => entry.identityKey) || [],
        visitCount: state.visits.length,
        modalActive: document.getElementById("modal")?.classList.contains("active") || false,
        activeView: document.querySelector(".view.active")?.id || ""
      },
      markerVisible: bodyText.includes(marker),
      markerInDebug: debugText.includes(marker),
      markerInStorage: localValues.concat(sessionValues, databaseNames, cacheNames).some(value => String(value).includes(marker)),
      databaseNames,
      cacheNames,
      shadowTermsVisible: /shadow decision|shadow probability|shadow confidence|recommendation readiness/i.test(bodyText)
    };
  })()`);
  await waitForProspectiveRequests(server, beforeCount + 1);
  return {
    browserResult,
    requests: server.prospectiveRequests.slice(),
    actionRequestsAdded: server.prospectiveRequests.length - beforeCount
  };
}

async function verifyProspectiveCollectionOffDashboardSeam(scenario, server) {
  const beforeWriteCount = server.prospectiveRequests.length;
  const browserResult = await scenario.cdp.evaluate(`(async () => {
    const anchor = document.getElementById("bestMoveDirections");
    if (!anchor || !anchor.href || anchor.getAttribute("href") === "#") {
      throw new Error("The governed rank-one Directions action is unavailable.");
    }
    const before = {
      bestNextMove: document.getElementById("bestNextMove")?.textContent?.trim() || "",
      routeQueueIds: activeProfile().activeRouteQueue?.entries?.map(entry => entry.identityKey) || [],
      visitCount: state.visits.length,
      activeView: document.querySelector(".view.active")?.id || ""
    };
    anchor.addEventListener("click", event => event.preventDefault(), { once: true });
    anchor.click();
    signalRouteIqProspectiveEvent("next_stop_requested");
    signalRouteIqProspectiveEvent("representative_action_observed");
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("pagehide"));
    window.dispatchEvent(new Event("pageshow"));
    window.dispatchEvent(new Event("offline"));
    window.dispatchEvent(new Event("online"));
    await new Promise(resolve => setTimeout(resolve, 150));
    const databaseNames = typeof indexedDB.databases === "function"
      ? (await indexedDB.databases()).map(database => database.name || "")
      : [];
    const cacheNames = typeof caches?.keys === "function" ? await caches.keys() : [];
    const storageKeys = Object.keys(localStorage).concat(Object.keys(sessionStorage));
    return {
      before,
      after: {
        bestNextMove: document.getElementById("bestNextMove")?.textContent?.trim() || "",
        routeQueueIds: activeProfile().activeRouteQueue?.entries?.map(entry => entry.identityKey) || [],
        visitCount: state.visits.length,
        activeView: document.querySelector(".view.active")?.id || ""
      },
      admissionActive: routeIqProspectiveAdmissionIsActive(),
      informationalSequence: routeIqProspectiveInformationalSequence,
      prospectiveStorage: storageKeys.concat(databaseNames, cacheNames).filter(value => /prospective|shadow/i.test(String(value))),
      shadowTermsVisible: /shadow decision|shadow probability|shadow confidence|recommendation readiness/i.test(document.body.textContent || "")
    };
  })()`);
  await wait(250);
  return {
    browserResult,
    writesAdded: server.prospectiveRequests.length - beforeWriteCount,
    writes: server.prospectiveRequests.slice(),
    networkLedger: server.prospectiveNetworkLedger.slice(),
    readCount: server.prospectiveBootstrapRequests.length
  };
}

async function verifyProspectiveBootstrapValidation(cdp) {
  return cdp.evaluate(`(() => {
    const now = Date.now();
    const scope = routeIqProspectiveCurrentScope();
    const base = {
      ok: true,
      acknowledged: true,
      status: "enabled",
      collection: "ON",
      recommendationInfluence: "OFF",
      bootstrapContractVersion: routeIqProspectiveBootstrapContractVersion,
      eventContractVersion: routeIqProspectiveEventContractVersion,
      issuedAt: new Date(now - 1000).toISOString(),
      expiresAt: new Date(now + 59 * 1000).toISOString(),
      workspaceId: scope.workspaceId,
      operatingProfileId: scope.operatingProfileId,
      representativeId: scope.representativeId,
      activeCohort: true,
      supportedOpportunityTypes: ["next_stop"],
      runtimeContextContractVersion: routeIqProspectiveRuntimeContextContractVersion,
      coordinatorContractVersion: routeIqProspectiveCoordinatorContractVersion
    };
    const admits = (body, { status = 200, cacheControl = "no-store", contentType = "application/json" } = {}) => Boolean(
      routeIqProspectiveBootstrapAdmission(
        new Response(JSON.stringify(body), {
          status,
          headers: { "Cache-Control": cacheControl, "Content-Type": contentType }
        }),
        body,
        scope,
        now
      )
    );
    const missing = { ...base };
    delete missing.expiresAt;
    return {
      valid: admits(base),
      missing: admits(missing),
      extra: admits({ ...base, extra: true }),
      malformed: admits({ ...base, supportedOpportunityTypes: "next_stop" }),
      stale: admits({
        ...base,
        issuedAt: new Date(now - 10 * 60 * 1000).toISOString(),
        expiresAt: new Date(now - 5 * 60 * 1000).toISOString()
      }),
      overlong: admits({ ...base, expiresAt: new Date(now + 60 * 1000).toISOString() }),
      future: admits({ ...base, issuedAt: new Date(now + 1000).toISOString() }),
      unauthorizedWorkspace: admits({ ...base, workspaceId: "unauthorized_synthetic_workspace" }),
      unauthorizedProfile: admits({ ...base, operatingProfileId: "unauthorized_synthetic_profile" }),
      unauthorizedRepresentative: admits({ ...base, representativeId: "cruz" }),
      inactiveCohort: admits({ ...base, activeCohort: false }),
      unsupportedOpportunity: admits({ ...base, supportedOpportunityTypes: ["other"] }),
      eventVersionMismatch: admits({ ...base, eventContractVersion: "route-iq-prospective-browser-event-v0" }),
      bootstrapVersionMismatch: admits({ ...base, bootstrapContractVersion: "route-iq-prospective-browser-bootstrap-v0" }),
      runtimeContextVersionMismatch: admits({ ...base, runtimeContextContractVersion: "route-iq-prospective-runtime-context-v0" }),
      coordinatorVersionMismatch: admits({ ...base, coordinatorContractVersion: "route-iq-prospective-coordinator-contract-v0" }),
      recommendationInfluenceOn: admits({ ...base, recommendationInfluence: "ON" }),
      cacheable: admits(base, { cacheControl: "private, max-age=60" }),
      wrongContentType: admits(base, { contentType: "text/plain" }),
      nonSuccess: admits(base, { status: 503 })
    };
  })()`);
}

function verifyRuntimePerformance(activeSnap, activeRouteLoadMs) {
  const governedPayload = JSON.stringify(customerPwaBusinessRoster);
  const governedBytes = Buffer.byteLength(governedPayload);
  const governedStarted = performance.now();
  JSON.parse(governedPayload);
  const governedParseMs = performance.now() - governedStarted;
  const detail = `governed roster ${governedBytes} bytes/${governedParseMs.toFixed(1)}ms parse, route ready ${activeRouteLoadMs}ms, nav ${activeSnap.performance.navigationDuration}ms`;
  assertWorkflow(
    "Route loading performance regressions",
    governedBytes < 1024 * 1024 && governedParseMs < 1000 && activeRouteLoadMs < 60000,
    detail,
    detail
  );
}

function trackHarnessResource(resources, name, resource) {
  resources.push({ name, close: resource.close });
  return resource;
}

export async function closeHarnessResources(resources) {
  const failures = [];
  for (const resource of [...resources].reverse()) {
    try {
      await resource.close();
    } catch (error) {
      failures.push({ name: resource.name, error });
    }
  }
  return failures;
}

function createHarnessCleanup(resources) {
  let cleanupPromise;
  return () => {
    cleanupPromise ||= (async () => {
      const failures = await closeHarnessResources(resources);
      if (localCertificate?.certDir) {
        try {
          rmSync(localCertificate.certDir, { recursive: true, force: true });
        } catch (error) {
          failures.push({ name: "local HTTPS certificate", error });
        }
        localCertificate = undefined;
      }
      return failures;
    })();
    return cleanupPromise;
  };
}

export function installHarnessSignalCleanup(cleanup, {
  processTarget = process,
  exitProcess = code => process.exit(code),
  reportError = message => console.error(message),
  onSignal = () => {}
} = {}) {
  let handlingSignal = false;
  const signals = ["SIGINT", "SIGTERM"];
  const handlers = new Map();
  const remove = () => {
    for (const [signal, handler] of handlers) processTarget.off(signal, handler);
  };
  for (const signal of signals) {
    const handler = () => {
      if (handlingSignal) return;
      handlingSignal = true;
      onSignal(signal);
      remove();
      void Promise.resolve()
        .then(cleanup)
        .then(failures => {
          for (const failure of failures || []) {
            reportError(`FAIL Harness ${failure.name} cleanup after ${signal}: ${errorCauseDiagnostic(failure.error)}`);
          }
          exitProcess(failures?.length ? 1 : signal === "SIGINT" ? 130 : 143);
        })
        .catch(error => {
          reportError(`FAIL Harness cleanup after ${signal}: ${errorCauseDiagnostic(error)}`);
          exitProcess(1);
        });
    };
    handlers.set(signal, handler);
    processTarget.once(signal, handler);
  }
  return remove;
}

async function runHarness() {
  const readinessFixture = founderRevenueReadinessResponse();
  createPaidCustomerRevenueReadinessViewModel(readinessFixture.body.snapshot, {
    session: readinessFixture.body.session,
    now: new Date(dashboardRuntimeWorkflowTestClock.now)
  });
  verifyRouteUpdateStatusContract();
  const customerPwaTerritory = customerPwaWorkspaceConfiguration.territories.find(
    territory => territory.territoryId === "synthetic_north_territory"
  );
  assertWorkflow(
    "Customer PWA governed ZIP fixture",
    customerPwaRuntimeRecords.every(record =>
      record.territoryId === customerPwaTerritory?.territoryId
        && record.postalCode === "77003"
        && customerPwaTerritory.zipCoverage.postalCodes.includes(record.postalCode)
    ),
    `${customerPwaRuntimeRecords.length} synthetic runtime records carry the Administration-authorized territory ZIP`,
    JSON.stringify({
      recordCount: customerPwaRuntimeRecords.length,
      territoryId: customerPwaTerritory?.territoryId || "",
      postalCodes: [...new Set(customerPwaRuntimeRecords.map(record => record.postalCode))]
    })
  );
  const chromeExecutable = resolveChromeExecutable();
  const resources = [];
  let interruptedSignal;
  const cleanupHarness = createHarnessCleanup(resources);
  const removeSignalHandlers = installHarnessSignalCleanup(cleanupHarness, {
    onSignal: signal => {
      interruptedSignal = signal;
    }
  });
  const startServer = async (name, options) => {
    if (interruptedSignal) throw new Error(`Dashboard harness interrupted by ${interruptedSignal}.`);
    const server = trackHarnessResource(resources, name, await startStaticServer(options));
    if (interruptedSignal) throw new Error(`Dashboard harness interrupted by ${interruptedSignal}.`);
    return server;
  };
  let harnessError;
  try {
    const server = await startServer("primary HTTPS server", {
      customerPwaSession: customerPwaFounderSessionFixture,
      founderDailyIntelligenceResponse: founderDailyIntelligenceResponse({
        snapshot: {
          workspaceId: customerPwaFounderSessionFixture.workspaceId,
          operatingProfileId: customerPwaFounderSessionFixture.operatingProfileId
        }
      })
    });
    const customerOwnerServer = await startServer("customer owner HTTPS server", {
      customerPwaSession: customerPwaOwnerSessionFixture
    });
    const managerServer = await startServer("manager HTTPS server", {
      customerPwaSession: customerPwaManagerSessionFixture
    });
    const representativeServer = await startServer("representative HTTPS server", {
      customerPwaSession: customerPwaSessionFixture
    });
    const mobileLoggingServer = await startServer("mobile logging HTTPS server", {
      customerPwaSession: customerPwaSessionFixture
    });
    const representativePwaServer = await startServer("representative PWA HTTPS server", {
      customerPwaSession: customerPwaSessionFixture
    });
    const legacyCatalogTrapServer = await startServer("legacy catalog trap HTTPS server", {
      customerPwaSession: customerPwaManagerSessionFixture,
      missingActive: true
    });
    const adaptiveReplenishmentServer = await startServer("adaptive replenishment HTTPS server", {
      customerPwaSession: customerPwaManagerSessionFixture
    });
    const fieldSessionServer = await startServer("field-session HTTPS server", {
      customerPwaSession: customerPwaSessionFixture
    });
    const fieldSessionRetryServer = await startServer("field-session retry HTTPS server", {
      customerPwaSession: customerPwaSessionFixture,
      fieldSessionResponses: [
        { status: 503, code: "field_session_store_unavailable", retryable: true },
        { status: 201 }
      ]
    });
    const visitCorrectionServer = await startServer("visit-correction HTTPS server", {
      customerPwaSession: customerPwaSessionFixture
    });
    const addPlaceServer = await startServer("add-place HTTPS server", {
      customerPwaSession: customerPwaSessionFixture
    });
    const decisionContextServer = await startServer("decision-context HTTPS server", {
      customerPwaSession: customerPwaSessionFixture
    });
    const prospectiveOffServer = await startServer("prospective-off HTTPS server", {
      customerPwaSession: customerPwaSessionFixture
    });
    const founderDailyIntelligenceServer = await startServer("Founder intelligence HTTPS server", {
      customerPwaSession: customerPwaFounderSessionFixture,
      founderDailyIntelligenceResponse: founderDailyIntelligenceResponse()
    });
    const founderDailyIntelligenceAnthonyServer = await startServer("Pending Founder intelligence HTTPS server", {
      customerPwaSession: customerPwaFounderSessionFixture,
      founderDailyIntelligenceResponse: founderDailyIntelligenceResponse({
        principal: {
          mappingId: "route-iq-founder-access-anthony-pending",
          immutablePrincipalId: "route-iq-principal-anthony-pending",
          mappingStatus: "pending_secure_authenticated_identity_mapping"
        }
      })
    });
    const founderDailyIntelligenceUnsafeServer = await startServer("unsafe intelligence HTTPS server", {
      customerPwaSession: customerPwaFounderSessionFixture,
      founderDailyIntelligenceResponse: founderDailyIntelligenceResponse({
        snapshot: {
          safety: {
            readOnly: true,
            founderOnly: true,
            representativeReadable: false,
            recommendationInfluence: "ON",
            routeOrderingChanged: false,
            routeScoringWeightsChanged: false,
            discoveryModeInfluenceChanged: false,
            nearbyContextInfluenceChanged: false,
            offRouteLearningInfluenceChanged: false,
            sourceEvidenceMutationAllowed: false
          }
        }
      })
    });
    const founderDailyIntelligenceInvalidConfigurationHashServer = await startServer("invalid intelligence configuration HTTPS server", {
      customerPwaSession: customerPwaFounderSessionFixture,
      founderDailyIntelligenceResponse: founderDailyIntelligenceResponse({
        snapshot: { businessConfigurationSha256: "A".repeat(64) }
      })
    });
    const customerPwaServer = await startServer("customer PWA HTTPS server", {
      customerPwaSession: customerPwaSessionFixture
    });
    const customerPwaMissingProfileServer = await startServer("customer PWA missing-profile HTTPS server", {
      customerPwaSession: Object.freeze({
        ...customerPwaSessionFixture,
        operatingProfileId: "northstar_missing_profile"
      })
    });
    const summitRehearsalServer = await startServer("Summit rehearsal HTTPS server", {
      summitRehearsal: true
    });
    const chrome = await launchChrome({
      executablePath: chromeExecutable,
      registerCleanup: close => resources.push({ name: "Chrome", close })
    });

    const summitAdministrationFixture = JSON.parse(readFileSync(
      resolve(root, summitRehearsalWorkspaceConfigurationPath),
      "utf8"
    ));
    const summitRosterFixture = JSON.parse(readFileSync(
      resolve(root, summitRehearsalBusinessRosterPath),
      "utf8"
    ));
    const reusableDashboardSource = [
      readFileSync(resolve(root, "index.html"), "utf8"),
      readFileSync(resolve(root, "dashboard/route-iq-dashboard-platform.mjs"), "utf8")
    ].join("\n");
    const summitFixtureLabels = [
      summitAdministrationFixture.workspaceConfiguration.company.displayName,
      ...summitRosterFixture.records.map(record => record.businessName)
    ];
    assertWorkflow(
      "Summit rehearsal generic Dashboard source isolation",
      summitFixtureLabels.every(label => !reusableDashboardSource.includes(label)),
      "the reusable PWA and Dashboard platform contain no rehearsal company or account labels",
      JSON.stringify({ checkedLabelCount: summitFixtureLabels.length })
    );

    const summitEventLog = { runtimeExceptions: [], consoleErrors: [], logErrors: [], network: [] };
    const summitPage = await attachPage(chrome, summitEventLog);
    await setViewport(summitPage, { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
    await navigateAndWait(summitPage, `${summitRehearsalServer.origin}/summit-rehearsal`);
    const summitReadyDeadline = Date.now() + 10000;
    let summitBoundary;
    while (Date.now() < summitReadyDeadline) {
      summitBoundary = await summitPage.evaluate(`window.__routeIqSummitRehearsal || null`);
      if (["READY", "FAIL"].includes(summitBoundary?.status)) break;
      await wait(50);
    }
    const summitJsonRequests = summitRehearsalServer.requests
      .filter(request => request.path.endsWith(".json"))
      .map(request => request.path);
    const summitJsonRequestSet = new Set(summitJsonRequests);
    assertWorkflow(
      "Summit rehearsal exact four runtime assets",
      summitBoundary?.status === "READY"
        && JSON.stringify(summitBoundary.runtimeAssetKeys) === JSON.stringify([
          "workspaceConfiguration",
          "businessManifestRegistry",
          "businessRoster",
          "businessHours"
        ])
        && Object.values(summitRehearsalRuntimeAssetPaths).every(path =>
          summitJsonRequestSet.has(path.slice(1))
        )
        && summitJsonRequestSet.size === 4,
      "the browser consumed one Administration configuration and three Data rehearsal assets",
      JSON.stringify({ boundary: summitBoundary, requestedJson: [...summitJsonRequestSet].sort() })
    );
    assertWorkflow(
      "Summit rehearsal role territory and ZIP isolation",
      summitBoundary?.workspaceId === "summit_outside_sales_rehearsal_synthetic"
        && summitBoundary?.companyId === "summit_service_supply_rehearsal_synthetic"
        && summitBoundary?.roleId === "summit_rehearsal_representative"
        && JSON.stringify(summitBoundary?.territoryIds) === JSON.stringify(["summit_dallas_rehearsal_territory"])
        && JSON.stringify(summitBoundary?.zipCodes) === JSON.stringify(["75201", "75202"])
        && summitBoundary?.recordCount === 4
        && summitBoundary?.roleIsolationRejected === true
        && summitBoundary?.territoryIsolationRejected === true
        && summitBoundary?.zipIsolationRejected === true,
      "the representative received only the configured Summit territory and ZIP-scoped roster",
      JSON.stringify(summitBoundary)
    );
    assertWorkflow(
      "Summit rehearsal operating-hours and visit-duration separation",
      summitBoundary?.cardCount === 4
        && summitBoundary?.operatingLabels.length === 4
        && summitBoundary?.visitDurationLabels.length === 4
        && summitBoundary.operatingLabels.every(label => !label.startsWith("Estimated visit:"))
        && summitBoundary.visitDurationLabels.every(label => label === "Estimated visit: 5–9 min")
        && summitBoundary.operatingLabels.some(label => label.startsWith("Open now · closes "))
        && summitBoundary.operatingLabels.includes("Hours outdated · verification required")
        && summitBoundary.operatingLabels.includes("Hours unavailable · not route eligible"),
      "operating availability and estimated visit duration render as distinct card fields",
      JSON.stringify({
        operatingLabels: summitBoundary?.operatingLabels,
        visitDurationLabels: summitBoundary?.visitDurationLabels
      })
    );
    assertWorkflow(
      "Summit rehearsal nonproduction fail-closed boundary",
      summitBoundary?.productionAuthorized === false
        && summitBoundary?.canonicalAdmissionAllowed === false
        && summitBoundary?.externalProviderEnabled === false
        && summitBoundary?.safety?.prospectiveCollection === "OFF"
        && summitBoundary?.safety?.activeCohorts === 0
        && summitBoundary?.safety?.recommendationInfluence === "OFF"
        && summitBoundary?.routeEligibleCount === 1
        && summitRehearsalServer.prospectiveRequests.length === 0
        && summitRehearsalServer.fieldSessionRequests.length === 0
        && summitRehearsalServer.requests.every(request => request.method === "GET"),
      "rehearsal-only evidence admitted one explicitly eligible stop without enabling production or writes",
      JSON.stringify({ boundary: summitBoundary, requests: summitRehearsalServer.requests })
    );
    verifyMobileFit(
      "Summit rehearsal exact 390x844 no-horizontal-scroll",
      await mobileFitSnapshot(summitPage)
    );
    await summitPage.evaluate(`document.getElementById("routeTab")?.click()`);
    await summitPage.evaluate(`document.querySelector("[data-directions]")?.click()`);
    const summitWorkflow = await summitPage.evaluate(`({
      routeWorkflowReached: window.__routeIqSummitRehearsal?.routeWorkflowReached === true,
      directionsWorkflowReached: window.__routeIqSummitRehearsal?.directionsWorkflowReached === true,
      workflowStatus: document.getElementById("workflowStatus")?.textContent || "",
      directionsVisible: (() => {
        const element = document.querySelector("[data-directions]");
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.left >= -1 && rect.right <= innerWidth + 1;
      })()
    })`);
    assertWorkflow(
      "Summit rehearsal browser workflow reachability",
      summitWorkflow.routeWorkflowReached
        && summitWorkflow.directionsWorkflowReached
        && summitWorkflow.directionsVisible,
      "Route and Directions controls are reachable in the exact mobile viewport",
      JSON.stringify(summitWorkflow)
    );
    verifyNoErrors("Summit rehearsal", summitEventLog, { debug: {} });
    await summitPage.close();

    const switcher = await runPageScenario(chrome, server, "/app?role=founder&debug=1&harness=workspace-switcher", "workspace-switcher");
    const switcherSnap = switcher.initial;
    const productFocus = await switcher.cdp.evaluate(`(() => ({
      title: document.querySelector(".brand h1")?.textContent?.trim() || "",
      bodyText: document.body.innerText,
      workspaceControls: document.querySelectorAll("[data-workspace-select]").length,
      retiredProductLinks: document.querySelectorAll("[data-retired-product], a[href*='/legacy-customer-dashboard/']").length
    }))()`);
    assertWorkflow("Route IQ authenticated workspace", switcherSnap.workspaceId === "northstar_outside_sales_synthetic" && switcherSnap.workspaceOperatingProfileId === "general_outside_sales", `workspace ${switcherSnap.workspaceId}, profile ${switcherSnap.workspaceOperatingProfileId}`, JSON.stringify({ workspaceId: switcherSnap.workspaceId, workspaceName: switcherSnap.workspaceName, debug: switcherSnap.debug.workspace }));
    assertWorkflow("Route IQ only active Dashboard product", productFocus.title === "Route IQ" && productFocus.workspaceControls === 0 && productFocus.retiredProductLinks === 0 && !/\bGaia\b|\bAthena\b/.test(productFocus.bodyText), "Route IQ renders without inactive-product navigation or current-product labels", JSON.stringify(productFocus));
    const switcherFounderRequests = server.founderDailyIntelligenceRequests.slice();
    const switcherFounderRequest = switcherFounderRequests[0];
    assertWorkflow(
      "Founder snapshot requires server principal",
      switcherSnap.debug.founderDailyIntelligence.authorized === true
        && switcherSnap.debug.founderDailyIntelligence.rendered === true
        && switcherFounderRequests.length >= 1
        && switcherFounderRequest?.method === "GET"
        && switcherFounderRequest?.serverPrincipalRole === "founder"
        && switcherFounderRequest?.serverAuthorizationState === "server_verified"
        && switcherFounderRequest?.founderIntelligence === true,
      "server admitted one read-only snapshot request from the verified Founder session",
      JSON.stringify({ state: switcherSnap.debug.founderDailyIntelligence, request: switcherFounderRequest })
    );
    await switcher.cdp.close();

    const founder = await runPageScenario(chrome, server, "/app?role=representative&rep=forged&debug=1&harness=runtime-workflows-founder", "founder");
    const founderSnap = founder.initial;
    assertWorkflow("Server-verified Founder Mode", founderSnap.sessionRole === "founder" && founderSnap.mode === "owner" && founderSnap.activeRepId === customerPwaFounderSessionFixture.representativeId && founderSnap.visibleTabs.includes("places") && founderSnap.visibleTabs.includes("stats") && founderSnap.visibleTabs.includes("find"), `Founder tabs visible: ${founderSnap.visibleTabs.join(", ")}`, JSON.stringify({ sessionRole: founderSnap.sessionRole, mode: founderSnap.mode, visibleTabs: founderSnap.visibleTabs }));
    const founderIntelligenceState = await waitForFounderDailyIntelligence(founder.cdp, "rendered");
    const founderRevenueState = await waitForFounderRevenueReadiness(founder.cdp, "rendered");
    const founderDailyRequests = server.founderDailyIntelligenceRequests.slice(switcherFounderRequests.length);
    const founderRevenueRequests = server.founderRevenueReadinessRequests.slice();
    const founderDailyRequest = founderDailyRequests[0];
    const founderRevenueRequest = founderRevenueRequests[0];
    assertWorkflow(
      "Founder operational panel reachability",
      founderIntelligenceState.authorized === true
        && founderIntelligenceState.rendered === true
        && founderRevenueState.authorized === true
        && founderRevenueState.rendered === true
        && founderDailyRequests.length >= 1
        && founderRevenueRequests.length >= 1
        && founderDailyRequests.every(request => request.serverPrincipalRole === "founder"
          && request.serverAuthorizationState === "server_verified"
          && request.founderIntelligence === true)
        && founderRevenueRequests.every(request => request.admitted === true)
        && founderDailyRequest?.serverPrincipalRole === "founder"
        && founderDailyRequest?.serverAuthorizationState === "server_verified"
        && founderRevenueRequest?.admitted === true,
      "server-verified Founder loaded one daily snapshot and one operational-status response",
      JSON.stringify({ dailyState: founderIntelligenceState, revenueState: founderRevenueState, dailyRequest: founderDailyRequest, revenueRequest: founderRevenueRequest })
    );
    assertWorkflow("Founder URL and display-name escalation denial", founderSnap.sessionRole === "founder" && founderSnap.activeRepId !== "forged", "server session overrode hostile role and representative parameters", JSON.stringify({ sessionRole: founderSnap.sessionRole, activeRepId: founderSnap.activeRepId }));
    verifyOperatingProfileVocabulary("Operating Profile general outside sales preserved", founderSnap, { profileId: "general_outside_sales", terms: ["Qualified Opportunities Today", "Northstar Field Supply (Synthetic) Route", "Verified Qualified Opportunities"] });
    assertWorkflow("Governed approved roster consumption", founderSnap.debug.runtimeDataPool === "governed" && founderSnap.debug.runtimeDataStatus === "READY" && founderSnap.debug.runtimeDataSource.includes("20 approved records"), founderSnap.debug.runtimeDataSource, JSON.stringify(founderSnap.debug));
    assertWorkflow("Route Intelligence rendering", founderSnap.debug.rendererReceived && founderSnap.bestNextMove && founderSnap.bestNextMove !== "Loading route signal" && founderSnap.dailyRouteCards > 0, `${founderSnap.bestNextMove} with ${founderSnap.dailyRouteCards} daily route cards`, JSON.stringify({ bestNextMove: founderSnap.bestNextMove, dailyRouteCards: founderSnap.dailyRouteCards, debug: founderSnap.debug }));
    assertWorkflow("Directions link generation", founderSnap.bestMoveDirections.startsWith("https://www.google.com/maps/dir/?api=1&destination="), founderSnap.bestMoveDirections, founderSnap.bestMoveDirections);
    assertWorkflow("Discovery Mode", founderSnap.todayText.includes("Discovery Mode") || founderSnap.routeRisk.includes("Discovery Mode") || founderSnap.statsText.includes("Discovery Mode"), founderSnap.routeRisk || "Discovery Mode visible in runtime text", JSON.stringify({ routeRisk: founderSnap.routeRisk, todayText: founderSnap.todayText.slice(0, 300) }));
    assertWorkflow("Prospective Founder/owner isolation", server.prospectiveRequests.length === 0, "Founder and owner route rendering produced no prospective signal", JSON.stringify(server.prospectiveRequests));
    verifyNoErrors("Founder", founder.eventLog, founderSnap);

    const customerOwner = await runPageScenario(chrome, customerOwnerServer, "/app?role=representative&rep=forged&harness=customer-owner", "customer-owner");
    await waitForFounderRevenueReadiness(customerOwner.cdp, "role_ineligible");
    const customerOwnerSnap = await snapshot(customerOwner.cdp);
    assertWorkflow("Server-verified customer owner Mode", customerOwnerSnap.sessionRole === "owner" && customerOwnerSnap.mode === "owner" && customerOwnerSnap.activeRepId === customerPwaOwnerSessionFixture.representativeId && customerOwnerSnap.visibleTabs.includes("stats") && customerOwnerSnap.visibleTabs.includes("find") && !customerOwnerSnap.founderDailyIntelligenceVisible, "customer owner remained distinct from manager and Founder", JSON.stringify({ sessionRole: customerOwnerSnap.sessionRole, mode: customerOwnerSnap.mode, tabs: customerOwnerSnap.visibleTabs }));
    assertWorkflow(
      "Customer owner direct-route and storage substitution denial",
      customerOwnerSnap.sessionRole === "owner"
        && customerOwnerSnap.activeRepId !== "forged"
        && customerOwnerSnap.debug.founderDailyIntelligence.status === "role_ineligible"
        && customerOwnerSnap.debug.paidCustomerRevenueReadiness.status === "role_ineligible"
        && customerOwnerServer.founderDailyIntelligenceRequests.length === 0
        && customerOwnerServer.founderRevenueReadinessRequests.length === 0,
      "server session defeated role substitution and issued no Founder-only status request",
      JSON.stringify({
        sessionRole: customerOwnerSnap.sessionRole,
        activeRepId: customerOwnerSnap.activeRepId,
        dailyState: customerOwnerSnap.debug.founderDailyIntelligence,
        revenueState: customerOwnerSnap.debug.paidCustomerRevenueReadiness,
        dailyRequests: customerOwnerServer.founderDailyIntelligenceRequests,
        revenueRequests: customerOwnerServer.founderRevenueReadinessRequests
      })
    );
    verifyNoErrors("Customer owner", customerOwner.eventLog, customerOwnerSnap);
    await customerOwner.cdp.close();

    const managerIntelligence = await runPageScenario(chrome, managerServer, "/app?role=founder&rep=cruz&harness=manager-founder-intelligence-denied", "manager-founder-intelligence-denied");
    const managerIntelligenceSnap = managerIntelligence.initial;
    assertWorkflow(
      "Founder daily intelligence customer-session isolation",
      !managerIntelligenceSnap.founderDailyIntelligenceVisible
        && managerIntelligenceSnap.debug.founderDailyIntelligence.status === "role_ineligible"
        && managerServer.founderDailyIntelligenceRequests.length === 0,
      "authenticated operational manager issued no Founder-intelligence request and rendered no snapshot",
      JSON.stringify({ debug: managerIntelligenceSnap.debug.founderDailyIntelligence, requests: managerServer.founderDailyIntelligenceRequests })
    );
    await managerIntelligence.cdp.close();

    const operationalCollectionOff = await runPageScenario(
      chrome,
      prospectiveOffServer,
      "/app?harness=governed-operational-collection-off",
      "governed-operational-collection-off"
    );
    const operationalCollectionOffResult = await verifyProspectiveCollectionOffDashboardSeam(
      operationalCollectionOff,
      prospectiveOffServer
    );
    assertWorkflow(
      "Authenticated PWA collection-OFF zero-write ledger",
      operationalCollectionOffResult.readCount === 1
        && operationalCollectionOffResult.writesAdded === 0
        && operationalCollectionOffResult.writes.length === 0
        && operationalCollectionOffResult.networkLedger.every(entry => entry.method === "GET"),
      "server-governed OFF session performed one read-only status check and initialized no listener, outbox, or write path",
      JSON.stringify(operationalCollectionOffResult)
    );
    assertWorkflow(
      "Authenticated PWA collection-OFF lifecycle isolation",
      !operationalCollectionOffResult.browserResult.admissionActive
        && operationalCollectionOffResult.browserResult.informationalSequence === 0
        && operationalCollectionOffResult.browserResult.prospectiveStorage.length === 0
        && !operationalCollectionOffResult.browserResult.shadowTermsVisible
        && JSON.stringify(operationalCollectionOffResult.browserResult.before) === JSON.stringify(operationalCollectionOffResult.browserResult.after),
      "foreground, background, offline, online, and Directions activity remained storage-free and non-influential",
      JSON.stringify(operationalCollectionOffResult.browserResult)
    );
    assertWorkflow(
      "Authenticated PWA collection-OFF 15-stop compatibility",
      operationalCollectionOff.initial.routeCards === 15
        && operationalCollectionOff.initial.routeCountLabel.includes("15 active stops"),
      `${operationalCollectionOff.initial.routeCards} route cards; ${operationalCollectionOff.initial.routeCountLabel}`,
      JSON.stringify(operationalCollectionOff.initial)
    );
    verifyNoErrors("Authenticated PWA collection-OFF", operationalCollectionOff.eventLog, await snapshot(operationalCollectionOff.cdp));
    await operationalCollectionOff.cdp.close();

    await clickTab(founder.cdp, "route");
    const routeSnap = await snapshot(founder.cdp);
    assertWorkflow("Build Route workflow", routeSnap.activeView === "view-route" && routeSnap.routeCards > 0 && /Route/.test(routeSnap.routeText), `${routeSnap.routeCards} route cards rendered`, JSON.stringify({ activeView: routeSnap.activeView, routeCards: routeSnap.routeCards, routeText: routeSnap.routeText.slice(0, 300) }));
    assertWorkflow("Owner 15-location route generation", routeSnap.routeCards === 15 && routeSnap.routeCountLabel.includes("15 active stops"), `${routeSnap.routeCards} route cards rendered; ${routeSnap.routeCountLabel}`, JSON.stringify({ routeCards: routeSnap.routeCards, routeCountLabel: routeSnap.routeCountLabel }));
    const businessHoursRuntime = await verifyRouteBusinessHoursRuntime(founder.cdp);
    assertWorkflow("Route IQ governed business-hours artifact consumption", businessHoursRuntime.artifactAvailable && businessHoursRuntime.recordCount === 20 && businessHoursRuntime.debug.status === "ready" && businessHoursRuntime.debug.scoringChanged === false && businessHoursRuntime.queueStatuses.every(status => status === "OPEN_VERIFIED"), `${businessHoursRuntime.recordCount} fresh governed test-only hours records loaded`, JSON.stringify(businessHoursRuntime));
    assertWorkflow("Route IQ active queue closed-now exclusion", businessHoursRuntime.queueCount === 15 && !businessHoursRuntime.queueStatuses.includes("CLOSED_VERIFIED") && businessHoursRuntime.queueStatuses.every(Boolean) && !businessHoursRuntime.queueScoringChanged, `${businessHoursRuntime.queueCount} queued stops; 0 verified-closed; score weights unchanged`, JSON.stringify(businessHoursRuntime));
    assertWorkflow("Route IQ mobile-compatible hours explainability", businessHoursRuntime.routeCardCount === 15 && !businessHoursRuntime.routeCardStatuses.includes("CLOSED_VERIFIED") && businessHoursRuntime.routeCardStatuses.every(Boolean) && businessHoursRuntime.routeText.includes("Business-hours eligibility") && (businessHoursRuntime.queueUnverifiedCount === 0 || businessHoursRuntime.routeCardMarkers.filter(marker => marker === "HOURS_NOT_VERIFIED").length === businessHoursRuntime.queueUnverifiedCount), `${businessHoursRuntime.routeCardCount} route cards expose additive hours status`, JSON.stringify(businessHoursRuntime));
    const ownerNearbyBadge = await verifyRouteNearbyInteraction(founder.cdp);
    assertWorkflow("Owner Nearby Context interaction", ownerNearbyBadge.tagName === "button" && ownerNearbyBadge.nearbyPlace && ownerNearbyBadge.after.modalActive && ownerNearbyBadge.modalTitle === "Nearby Context" && /Nearby Context|walkable|Directions|No verified/.test(ownerNearbyBadge.modalText), `${ownerNearbyBadge.text} opened ${ownerNearbyBadge.modalTitle}`, JSON.stringify(ownerNearbyBadge));

    await clickTab(founder.cdp, "today");
    const territoryPolicy = await verifyTerritoryPermissionModel(founder.cdp);
    assertWorkflow("Owner territory permission model", territoryPolicy.afterOwner.assignedRadiusMiles === 5 && territoryPolicy.afterOwner.allowedRadiusMiles === 10 && territoryPolicy.afterOwner.allowRepRadiusChanges === true && territoryPolicy.afterOwner.lockAssignedRadius === false && territoryPolicy.ownerStatus.includes("rep changes allowed"), territoryPolicy.ownerStatus, JSON.stringify(territoryPolicy));
    assertWorkflow("Representative territory adjustment", territoryPolicy.repDisabledBefore === false && territoryPolicy.afterRep.assignedRadiusMiles === 10 && territoryPolicy.repStatus.includes("Rep adjustment allowed"), territoryPolicy.repStatus, JSON.stringify(territoryPolicy));

    const activePageTargets = await listChromePageTargets(chrome.debugPort);
    assertWorkflow(
      "Harness page-target teardown",
      activePageTargets.length === 2,
      `${activePageTargets.length} page targets remain before Places rendering`,
      JSON.stringify(activePageTargets.map(target => ({ id: target.id, title: target.title, url: target.url })))
    );

    await clickTab(founder.cdp, "places");
    const placesSnap = await snapshot(founder.cdp);
    assertWorkflow("Places initial loading perception", placesSnap.activeView === "view-places" && placesSnap.placesItems > 0 && placesSnap.placesText.includes("Production Map") && Number(placesSnap.debug.placesRender.initialMs || 0) < 1000, `${placesSnap.placesItems}/${placesSnap.debug.placesRender.total || "?"} places visible in ${placesSnap.debug.placesRender.initialMs || 0}ms`, JSON.stringify({ activeView: placesSnap.activeView, placesItems: placesSnap.placesItems, placesRender: placesSnap.debug.placesRender }));
    const placesComplete = await waitForPlacesRenderComplete(founder.cdp);
    assertWorkflow("Places full loading completion", placesComplete.complete && placesComplete.visibleCards === placesComplete.total && placesComplete.durationMs < 8000, `${placesComplete.visibleCards}/${placesComplete.total} places rendered in ${placesComplete.durationMs}ms`, JSON.stringify(placesComplete));

    await clickTab(founder.cdp, "stats");
    const statsSnap = await snapshot(founder.cdp);
    assertWorkflow("Insights rendering", statsSnap.activeView === "view-stats" && statsSnap.statsText.includes("Executive Insight") && statsSnap.statsText.includes("Learning"), "Executive Insight and learning panels rendered", JSON.stringify({ activeView: statsSnap.activeView, statsText: statsSnap.statsText.slice(0, 300) }));

    await clickTab(founder.cdp, "find");
    const findSnap = await snapshot(founder.cdp);
    assertWorkflow("Find/Search functionality", findSnap.activeView === "view-find" && findSnap.findText.includes("Find Places") && (findSnap.searchItems > 0 || findSnap.targetIdeas > 0), `${findSnap.searchItems} searches and ${findSnap.targetIdeas} target ideas rendered`, JSON.stringify({ activeView: findSnap.activeView, searchItems: findSnap.searchItems, targetIdeas: findSnap.targetIdeas }));

    const mobileFounder = await runPageScenario(chrome, server, "/app?role=founder&rep=cruz&debug=1&pwa=founder&harness=mobile-founder-fit", "mobile-founder", {
      viewport: { width: 390, height: 844, deviceScaleFactor: 3, mobile: true }
    });
    const mobileFounderSnap = mobileFounder.initial;
    assertWorkflow("Mobile authenticated Founder controls", mobileFounderSnap.sessionRole === "founder" && mobileFounderSnap.mode === "owner" && mobileFounderSnap.activeRepId === customerPwaFounderSessionFixture.representativeId && mobileFounderSnap.visibleTabs.length === 5, `role ${mobileFounderSnap.sessionRole}, mode ${mobileFounderSnap.mode}, rep ${mobileFounderSnap.activeRepId}, tabs ${mobileFounderSnap.visibleTabs.join(", ")}`, JSON.stringify(mobileFounderSnap));
    verifyMobileFit("Mobile PWA Today no-horizontal-scroll", await mobileFitSnapshot(mobileFounder.cdp));
    await clickTab(mobileFounder.cdp, "route");
    verifyMobileFit("Mobile PWA Route no-horizontal-scroll", await mobileFitSnapshot(mobileFounder.cdp));
    await clickTab(mobileFounder.cdp, "places");
    verifyMobileFit("Mobile PWA Places no-horizontal-scroll", await mobileFitSnapshot(mobileFounder.cdp));
    await clickTab(mobileFounder.cdp, "stats");
    verifyMobileFit("Mobile PWA Insights no-horizontal-scroll", await mobileFitSnapshot(mobileFounder.cdp));
    await clickTab(mobileFounder.cdp, "find");
    verifyMobileFit("Mobile PWA Find no-horizontal-scroll", await mobileFitSnapshot(mobileFounder.cdp));
    verifyNoErrors("Mobile Founder", mobileFounder.eventLog, await snapshot(mobileFounder.cdp));

    const mobileOwner = await runPageScenario(chrome, customerOwnerServer, "/app?role=founder&rep=cruz&harness=mobile-owner-fit", "mobile-owner", {
      viewport: { width: 390, height: 844, deviceScaleFactor: 3, mobile: true }
    });
    const mobileOwnerSnap = mobileOwner.initial;
    assertWorkflow("Mobile authenticated customer-owner controls", mobileOwnerSnap.sessionRole === "owner" && mobileOwnerSnap.mode === "owner" && mobileOwnerSnap.activeRepId === customerPwaOwnerSessionFixture.representativeId && mobileOwnerSnap.visibleTabs.length === 5 && !mobileOwnerSnap.founderDailyIntelligenceVisible, `role ${mobileOwnerSnap.sessionRole}, mode ${mobileOwnerSnap.mode}, rep ${mobileOwnerSnap.activeRepId}`, JSON.stringify(mobileOwnerSnap));
    verifyMobileFit("Mobile customer owner Today no-horizontal-scroll", await mobileFitSnapshot(mobileOwner.cdp));
    await clickTab(mobileOwner.cdp, "stats");
    verifyMobileFit("Mobile customer owner Insights no-horizontal-scroll", await mobileFitSnapshot(mobileOwner.cdp));
    verifyNoErrors("Mobile customer owner", mobileOwner.eventLog, await snapshot(mobileOwner.cdp));
    await mobileOwner.cdp.close();

    const customerPwa = await runPageScenario(chrome, customerPwaServer, "/app", "customer-pwa", {
      viewport: { width: 390, height: 844, deviceScaleFactor: 3, mobile: true },
      standalone: true,
      noncanonicalTestClock: dashboardRuntimeWorkflowTestClock
    });
    const customerPwaSnap = customerPwa.initial;
    const customerPwaBoundary = await customerPwa.cdp.evaluate(`(() => {
      const keys = Object.keys(localStorage).sort();
      const unscoped = [
        "prometheus-v1",
        "prometheus-mode",
        "prometheus-active-rep",
        "prometheus-session-role",
        "prometheus-route-iq-finalized-sessions-v1"
      ];
      return {
        standalone: window.navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches,
        manifest: document.getElementById("prometheusManifest")?.getAttribute("href") || "",
        markerConsumed: document.getElementById("routeIqCustomerPwaSession")?.content?.textContent?.trim().startsWith("{") === true,
        scopedKeys: keys.filter(key => key.includes("northstar_outside_sales_synthetic:northstar_synthetic_user_01")),
        unscopedKeys: keys.filter(key => unscoped.includes(key)),
        betaVisible: /\\bbeta\\b/iu.test(document.body.innerText || ""),
        founderCrmVisible: /Founder CRM/iu.test(document.body.innerText || "")
      };
    })()`);
    assertWorkflow(
      "Customer PWA server-scoped identity",
      customerPwaSnap.sessionRole === "rep"
        && customerPwaSnap.mode === "rep"
        && customerPwaSnap.workspaceId === "northstar_outside_sales_synthetic"
        && customerPwaSnap.workspaceOperatingProfileId === "general_outside_sales"
        && customerPwaSnap.operatingProfileId === "general_outside_sales"
        && customerPwaSnap.activeRepId === "northstar_synthetic_rep_01"
        && customerPwaSnap.visibleTabs.join(",") === "today,route,places"
        && customerPwaSnap.visibleOwnerControls.length === 0,
      "synthetic non-fitness customer rendered from one generic server-scoped PWA session",
      JSON.stringify(customerPwaSnap)
    );
    assertWorkflow(
      "Customer PWA storage and presentation boundary",
      customerPwaBoundary.standalone
        && customerPwaBoundary.manifest === "manifest.webmanifest"
        && customerPwaBoundary.markerConsumed
        && customerPwaBoundary.scopedKeys.length > 0
        && customerPwaBoundary.unscopedKeys.length === 0
        && !customerPwaBoundary.betaVisible
        && !customerPwaBoundary.founderCrmVisible,
      "standalone session uses scoped storage, production language, and no Founder CRM surface",
      JSON.stringify(customerPwaBoundary)
    );
    verifyMobileFit("Customer PWA 390x844 Today no-horizontal-scroll", await mobileFitSnapshot(customerPwa.cdp));
    await clickTab(customerPwa.cdp, "route");
    const customerRouteSnap = await snapshot(customerPwa.cdp);
    verifyMobileFit("Customer PWA 390x844 Route no-horizontal-scroll", await mobileFitSnapshot(customerPwa.cdp));
    assertWorkflow(
      "Customer PWA collection-OFF 15-stop route",
      customerRouteSnap.routeCards === 15
        && customerRouteSnap.routeCountLabel.includes("15 active stops")
        && customerPwaServer.prospectiveRequests.length === 0,
      "15 route cards rendered with zero prospective writes",
      JSON.stringify({ routeCards: customerRouteSnap.routeCards, routeCountLabel: customerRouteSnap.routeCountLabel, writes: customerPwaServer.prospectiveRequests })
    );
    const customerPwaRequestedPaths = new Set(customerPwaServer.requests.map(request => request.path));
    const customerPwaScopeBoundary = await customerPwa.cdp.evaluate(`(async () => {
      const [dashboard, intelligence, governedRuntime, configuration, manifestRegistry, rosterResponse, artifact] = await Promise.all([
        import("/dashboard/route-iq-dashboard-platform.mjs"),
        import("/intelligence/route-business-hours-eligibility.mjs"),
        import("/intelligence/route-iq-governed-runtime-scope.mjs"),
        fetch("/${customerPwaWorkspaceConfigurationPath}", { cache: "no-store" }).then(response => response.json()),
        fetch("/${customerPwaManifestRegistryPath}", { cache: "no-store" }).then(response => response.json()),
        fetch("/${customerPwaBusinessRosterPath}", { cache: "no-store" }),
        fetch("/${customerPwaBusinessHoursPath}", { cache: "no-store" }).then(response => response.json())
      ]);
      const rosterBytes = await rosterResponse.arrayBuffer();
      const sourceArtifactSha256 = await dashboard.sha256Hex(rosterBytes);
      const governedScope = governedRuntime.createGovernedRouteRuntimeScopeFromConfiguration({
        workspaceRegistry: configuration,
        manifestRegistry,
        workspaceId: "northstar_outside_sales_synthetic",
        operatingProfileId: "general_outside_sales",
        sourceArtifactSha256,
        businessHoursArtifact: artifact,
        allowSynthetic: true
      });
      const accepted = intelligence.buildRouteBusinessHoursIndex(artifact, {
        workspaceId: "northstar_outside_sales_synthetic",
        operatingProfileId: "general_outside_sales",
        governedRuntimeScope: governedScope
      });
      let mismatchedProvenanceRejected = false;
      try {
        intelligence.buildRouteBusinessHoursIndex(artifact, {
          workspaceId: "northstar_outside_sales_synthetic",
          operatingProfileId: "fitness",
          governedRuntimeScope: governedScope
        });
      } catch (error) {
        mismatchedProvenanceRejected = true;
      }
      return {
        acceptedWorkspaceId: accepted.workspaceId,
        acceptedOperatingProfileId: accepted.operatingProfileId,
        eligibilityVersion: accepted.version,
        governedScopeVersion: accepted.governedRuntimeScope?.version || "",
        mismatchedProvenanceRejected
      };
    })()`);
    assertWorkflow(
      "Customer PWA governed Intelligence source and provenance",
      customerPwaScopeBoundary.acceptedWorkspaceId === "northstar_outside_sales_synthetic"
        && customerPwaScopeBoundary.acceptedOperatingProfileId === "general_outside_sales"
        && customerPwaScopeBoundary.eligibilityVersion === "route-iq-business-hours-eligibility-v2"
        && customerPwaScopeBoundary.governedScopeVersion === "route-iq-governed-runtime-scope-v1"
        && customerPwaScopeBoundary.mismatchedProvenanceRejected
        && customerPwaRequestedPaths.has("intelligence/continuous-adaptive-route-replenishment.mjs")
        && customerPwaRequestedPaths.has("intelligence/route-business-hours-eligibility.mjs")
        && customerPwaRequestedPaths.has("intelligence/route-iq-governed-runtime-scope.mjs")
        && customerPwaRequestedPaths.has(customerPwaWorkspaceConfigurationPath)
        && customerPwaRequestedPaths.has(customerPwaManifestRegistryPath)
        && customerPwaRequestedPaths.has(customerPwaBusinessRosterPath)
        && customerPwaRequestedPaths.has(customerPwaBusinessHoursPath)
        && !customerPwaRequestedPaths.has(activePoolPath)
        && !customerPwaRequestedPaths.has(fullPoolPath),
      "the generic PWA used exact v2 Intelligence and manifest-bound synthetic workspace assets; mismatched provenance failed closed",
      JSON.stringify({ scope: customerPwaScopeBoundary, requests: [...customerPwaRequestedPaths].sort() })
    );
    const customerRefreshSnap = await navigateExistingScenario(customerPwa.cdp, customerPwaServer, "/app");
    assertWorkflow(
      "Customer PWA authenticated refresh isolation",
      customerRefreshSnap.workspaceId === "northstar_outside_sales_synthetic"
        && customerRefreshSnap.activeRepId === "northstar_synthetic_rep_01"
        && customerRefreshSnap.sessionRole === "rep"
        && customerRefreshSnap.visibleOwnerControls.length === 0,
      "refresh preserved the exact customer workspace and least-privileged representative",
      JSON.stringify(customerRefreshSnap)
    );
    const customerExpiredBoundary = await customerPwa.cdp.evaluate(`(() => {
      const originalDateNow = Date.now;
      Date.now = () => Date.parse(routeIqCustomerPwaSession.expiresAt) + 1;
      window.dispatchEvent(new Event("focus"));
      const result = {
        sessionRole: document.body.dataset.sessionRole || "",
        sessionState: document.body.dataset.customerSessionState || "",
        blockedHeading: document.querySelector(".route-iq-customer-session-blocked h1")?.textContent?.trim() || "",
        scopedRecordPreserved: localStorage.getItem("prometheus-v2:northstar_outside_sales_synthetic:northstar_synthetic_user_01") !== null
      };
      Date.now = originalDateNow;
      return result;
    })()`);
    assertWorkflow(
      "Customer PWA open-session expiry lock",
      customerExpiredBoundary.sessionRole === "unauthorized"
        && customerExpiredBoundary.sessionState === "expired"
        && customerExpiredBoundary.blockedHeading === "Route IQ access unavailable"
        && customerExpiredBoundary.scopedRecordPreserved,
      "expired server session removed the operational UI without deleting scoped customer records",
      JSON.stringify(customerExpiredBoundary)
    );
    verifyNoErrors("Customer PWA", customerPwa.eventLog, customerRefreshSnap);
    await customerPwa.cdp.close();

    const missingProfileEventLog = { runtimeExceptions: [], consoleErrors: [], logErrors: [], network: [] };
    const missingProfilePage = await attachPage(chrome, missingProfileEventLog);
    await setViewport(missingProfilePage, { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
    await setStandaloneMode(missingProfilePage, true);
    await navigateAndWait(missingProfilePage, `${customerPwaMissingProfileServer.origin}/app`);
    const missingProfileDeadline = Date.now() + 5000;
    let missingProfileBoundary = null;
    while (Date.now() < missingProfileDeadline) {
      missingProfileBoundary = await missingProfilePage.evaluate(`(() => ({
        sessionRole: document.body?.dataset.sessionRole || "",
        sessionState: document.body?.dataset.customerSessionState || "",
        blockedHeading: document.querySelector(".route-iq-customer-session-blocked h1")?.textContent?.trim() || "",
        startupCompleted: window.prometheusDebugState?.startupCompleted === true,
        operatingProfileStatus: window.prometheusDebugState?.operatingProfile?.status || "",
        profileAccepted: window.prometheusDebugState?.customerStartup?.profileAccepted === true,
        operationalWorkflowStarted: window.prometheusDebugState?.customerStartup?.operationalWorkflowStarted === true,
        prospectiveBootstrapRequested: window.prometheusDebugState?.prospectiveCollection?.bootstrapRequested === true,
        prospectiveListenerAttached: window.prometheusDebugState?.prospectiveCollection?.listenerAttached === true,
        debug: {
          lastError: window.prometheusDebugState?.lastError || "",
          lastUnhandledRejection: window.prometheusDebugState?.lastUnhandledRejection || ""
        }
      }))()`);
      if (missingProfileBoundary.sessionState === "configuration_unavailable") break;
      await wait(50);
    }
    const missingProfileForbiddenRequests = new Set([
      "intelligence/continuous-adaptive-route-replenishment.mjs",
      "intelligence/route-business-hours-eligibility.mjs",
      "intelligence/route-iq-governed-runtime-scope.mjs",
      activePoolPath,
      fullPoolPath,
      customerPwaBusinessHoursPath,
      customerPwaBusinessRosterPath
    ]);
    assertWorkflow(
      "Customer PWA missing operating-profile fail-closed",
      missingProfileBoundary?.sessionRole === "unauthorized"
        && missingProfileBoundary?.sessionState === "configuration_unavailable"
        && missingProfileBoundary?.blockedHeading === "No paid-customer configuration selected"
        && missingProfileBoundary?.startupCompleted === false
        && missingProfileBoundary?.operatingProfileStatus === "configuration_unavailable"
        && missingProfileBoundary?.profileAccepted === false
        && missingProfileBoundary?.operationalWorkflowStarted === false
        && missingProfileBoundary?.prospectiveBootstrapRequested === false
        && missingProfileBoundary?.prospectiveListenerAttached === false
        && customerPwaMissingProfileServer.prospectiveBootstrapRequests.length === 0
        && customerPwaMissingProfileServer.prospectiveRequests.length === 0
        && !customerPwaMissingProfileServer.requests.some(request => missingProfileForbiddenRequests.has(request.path)),
      "missing server-authorized profile blocked startup before prospective bootstrap/listeners, Intelligence evidence, route modules, data pools, or workflow work",
      JSON.stringify({ boundary: missingProfileBoundary, requests: customerPwaMissingProfileServer.requests })
    );
    verifyNoErrors("Customer PWA missing operating profile", missingProfileEventLog, missingProfileBoundary || {});
    await missingProfilePage.close();

    const rep = await runPageScenario(chrome, representativeServer, "/app?harness=runtime-workflows-representative", "rep");
    const repSnap = rep.initial;
    assertWorkflow("Rep Mode", repSnap.sessionRole === "rep" && repSnap.mode === "rep" && repSnap.visibleTabs.includes("places") && !repSnap.visibleTabs.includes("stats") && !repSnap.visibleTabs.includes("find"), `rep tabs visible: ${repSnap.visibleTabs.join(", ")}`, JSON.stringify({ sessionRole: repSnap.sessionRole, mode: repSnap.mode, visibleTabs: repSnap.visibleTabs }));
    assertWorkflow("Add Place desktop availability", repSnap.todayText.includes("Add Place"), "representative Add Place command visible on desktop", JSON.stringify({ todayText: repSnap.todayText.slice(0, 500) }));
    assertWorkflow("Representative radius/ring visibility", repSnap.territoryVisible && repSnap.territoryRingCount > 0 && repSnap.territoryText.includes("Assigned Territory Radius") && repSnap.territoryText.includes("Ring"), `${repSnap.territoryRingCount} territory rings visible for ${repSnap.activeRepId}`, JSON.stringify({ territoryVisible: repSnap.territoryVisible, territoryRingCount: repSnap.territoryRingCount, territoryText: repSnap.territoryText.slice(0, 400) }));
    assertWorkflow("Representative governed territory boundary", repSnap.debug.territoryCoverage.assignedRadiusMiles <= repSnap.debug.territoryCoverage.allowedRadiusMiles && repSnap.debug.territoryCoverage.ringTotals[0] > 0 && repSnap.debug.territoryCoverage.routeUsesOnlyRingOne === true, `${repSnap.debug.territoryCoverage.assignedRadiusMiles}/${repSnap.debug.territoryCoverage.allowedRadiusMiles} mi governed boundary`, JSON.stringify({ coverage: repSnap.debug.territoryCoverage, ringTexts: repSnap.territoryRingTexts }));
    assertWorkflow("Rep startup defers owner-only views", repSnap.placesItems === 0 && repSnap.debug.deferredOwnerViews.places === false && repSnap.debug.deferredOwnerViews.stats === false && repSnap.debug.deferredOwnerViews.find === false, `owner-only views deferred; render total ${repSnap.debug.renderTimings.total || 0}ms`, JSON.stringify({ placesItems: repSnap.placesItems, renderTimings: repSnap.debug.renderTimings, deferredOwnerViews: repSnap.debug.deferredOwnerViews }));
    await rep.cdp.evaluate(`setTab("stats")`);
    const repAfterOwnerTab = await snapshot(rep.cdp);
    assertWorkflow("Rep owner-tab guard", repAfterOwnerTab.activeView === "view-today", "rep remains on Today when owner tab is requested", JSON.stringify({ activeView: repAfterOwnerTab.activeView }));
    assertWorkflow("Rep route quality", repSnap.debug.rendererReceived && repSnap.bestNextMove && repSnap.bestMoveDirections.startsWith("https://www.google.com/maps/dir/?api=1&destination=") && repSnap.dailyRouteCards > 0, `${repSnap.bestNextMove} with governed directions and ${repSnap.dailyRouteCards} route cards`, JSON.stringify({ bestNextMove: repSnap.bestNextMove, directions: repSnap.bestMoveDirections, dailyRouteCards: repSnap.dailyRouteCards }));
    assertWorkflow("Authenticated representative readiness", repSnap.sessionRole === "rep" && repSnap.mode === "rep" && repSnap.activeRepId === customerPwaSessionFixture.representativeId && repSnap.debug.runtimeDataPool === "governed" && repSnap.debug.runtimeDataStatus === "READY" && repSnap.appBuildVersion && repSnap.storedAppBuildVersion === repSnap.appBuildVersion, `synthetic representative ready on governed roster, build ${repSnap.appBuildVersion}`, JSON.stringify(repSnap));
    assertWorkflow("Dashboard performance", Number(founderSnap.debug.renderTimings.total || 0) < 5000 && Number(repSnap.debug.renderTimings.total || 0) < 5000 && Number(founderSnap.performance.activeResourceDuration || 0) < 5000 && founder.routeLoadMs < 10000, `founder render ${founderSnap.debug.renderTimings.total || 0}ms, rep render ${repSnap.debug.renderTimings.total || 0}ms, active fetch ${founderSnap.performance.activeResourceDuration || 0}ms, route ready ${founder.routeLoadMs}ms`, JSON.stringify({ founderRender: founderSnap.debug.renderTimings, repRender: repSnap.debug.renderTimings, founderPerformance: founderSnap.performance, routeLoadMs: founder.routeLoadMs }));
    const decisionDesktop = await verifyDecisionContextDesktopLayout(rep.cdp);
    assertWorkflow("Decision Context desktop rendering", decisionDesktop.viewportWidth > 390 && decisionDesktop.quickCount === 7 && decisionDesktop.visitCount === 7 && decisionDesktop.addPlaceCount === 7 && decisionDesktop.quickInitiallyHidden && decisionDesktop.quickOptional && decisionDesktop.addPlaceInitiallyHidden && decisionDesktop.addPlaceVisibleWithVisit && decisionDesktop.left >= -1 && decisionDesktop.right <= decisionDesktop.viewportWidth + 1 && decisionDesktop.scrollWidth <= decisionDesktop.viewportWidth + 1, "seven optional decision sources fit Quick Result, Add Visit, and Add Place initial-visit workflows", JSON.stringify(decisionDesktop));
    verifyNoErrors("Rep", rep.eventLog, repSnap);
    await clickTab(rep.cdp, "route");
    const repRouteSnap = await snapshot(rep.cdp);
    assertWorkflow("Representative 15-location route generation", repRouteSnap.routeCards === 15 && repRouteSnap.routeCountLabel.includes("15 active stops"), `${repRouteSnap.routeCards} representative route cards rendered; ${repRouteSnap.routeCountLabel}`, JSON.stringify({ routeCards: repRouteSnap.routeCards, routeCountLabel: repRouteSnap.routeCountLabel, routeText: repRouteSnap.routeText.slice(0, 500) }));
    const routeWindows = await verifyRouteWindowOptions(rep.cdp);
    assertWorkflow("Representative Morning route options", routeWindows.morning.routeCards > 0 && routeWindows.morning.routeCountLabel.includes("active stops"), `${routeWindows.morning.routeCards} Morning options; ${routeWindows.morning.routeCountLabel}`, JSON.stringify(routeWindows.morning));
    assertWorkflow("Representative Evening route options", routeWindows.evening.routeCards > 0 && routeWindows.evening.routeCountLabel.includes("active stops"), `${routeWindows.evening.routeCards} Evening options; ${routeWindows.evening.routeCountLabel}`, JSON.stringify(routeWindows.evening));
    assertWorkflow(
      "Representative route identity uniqueness",
      new Set(repRouteSnap.routeQueueIds).size === repRouteSnap.routeQueueIds.length,
      `${repRouteSnap.routeQueueIds.length} manifest-bound route identities are unique`,
      JSON.stringify(repRouteSnap.routeQueueIds)
    );
    const repNearbyBadge = await verifyRouteNearbyInteraction(rep.cdp);
    assertWorkflow("Representative Nearby Context interaction", repNearbyBadge.tagName === "button" && repNearbyBadge.nearbyPlace && repNearbyBadge.after.modalActive && repNearbyBadge.modalTitle === "Nearby Context" && /Nearby Context|walkable|Directions|No verified/.test(repNearbyBadge.modalText), `${repNearbyBadge.text} opened ${repNearbyBadge.modalTitle}`, JSON.stringify(repNearbyBadge));
    await clickTab(rep.cdp, "today");
    const nearbyFlow = await verifyNearbyOpportunitiesFlow(rep.cdp);
    assertWorkflow("Nearby Opportunities empty state", nearbyFlow.emptyBefore.includes("Log a governed route stop"), nearbyFlow.emptyBefore, JSON.stringify(nearbyFlow));
    assertWorkflow("Nearby Opportunities location acquisition", nearbyFlow.latestVisitHasLocation && nearbyFlow.locationButtonLabel === "Location Attached" && nearbyFlow.locationStatus.includes("Device-reported visit location attached"), nearbyFlow.locationStatus, JSON.stringify(nearbyFlow));
    assertWorkflow("Nearby Opportunities governed roster query", nearbyFlow.beforeRuntimePool === "governed" && nearbyFlow.runtimePool === "governed" && nearbyFlow.nearbyDebug.originSource === "visit-location", `${nearbyFlow.nearbyDebug.count} nearby from ${nearbyFlow.nearbyDebug.originSource}`, JSON.stringify(nearbyFlow));
    assertWorkflow("Nearby Opportunities rendering", nearbyFlow.cardCount > 0 && nearbyFlow.noEmptyAfter && nearbyFlow.countLabel.includes("within") && nearbyFlow.firstCard.includes("Directions"), `${nearbyFlow.cardCount} nearby cards for ${nearbyFlow.target.name}`, JSON.stringify(nearbyFlow));
    await clickTab(rep.cdp, "places");
    const repPlaces = await snapshot(rep.cdp);
    assertWorkflow("Rep Places visit review", repPlaces.activeView === "view-places" && repPlaces.placesText.includes("Rep Places") && repPlaces.placesText.includes("View Visit") && repPlaces.placesItems > 0, `${repPlaces.placesItems} visited places available on desktop`, JSON.stringify({ activeView: repPlaces.activeView, placesItems: repPlaces.placesItems, placesText: repPlaces.placesText.slice(0, 500) }));
    const desktopRepPlaces = await verifyDesktopRepresentativePlaces(rep.cdp);
    assertWorkflow("Representative Saved Places desktop rendering", desktopRepPlaces.viewportWidth > 390 && desktopRepPlaces.title === "Rep Places" && desktopRepPlaces.visitedHeading === "Visited Places" && desktopRepPlaces.savedHeading === "Saved Places" && desktopRepPlaces.savedText.includes("Not Yet Visited") && desktopRepPlaces.visitedCount > 0 && desktopRepPlaces.savedCount === 1 && desktopRepPlaces.savedLeft >= -1 && desktopRepPlaces.savedRight <= desktopRepPlaces.viewportWidth + 1, "Visited and Saved sections render distinctly on desktop", JSON.stringify(desktopRepPlaces));
    const routeSync = await verifyRouteStateSynchronization(rep.cdp);
    assertWorkflow("Representative route state synchronization", !routeSync.routePoolStillContainsLogged && !routeSync.routeListStillContainsLogged && !routeSync.dailyRouteStillContainsLogged && !routeSync.bestNextStillLogged, `${routeSync.loggedName} removed from route pool/list/daily/best-next after logging`, JSON.stringify(routeSync));
    verifyNoErrors("Nearby Opportunities", rep.eventLog, await snapshot(rep.cdp));

    const anthonyLog = await runPageScenario(chrome, mobileLoggingServer, "/app?harness=representative-mobile-quick-log", "representative-mobile-log", {
      standalone: true,
      viewport: { width: 390, height: 844, deviceScaleFactor: 3, mobile: true }
    });
    const quickLog = await verifyMobileQuickLogging(anthonyLog.cdp);
    const quickLogRouteStatus = inspectRouteUpdateStatus(quickLog.routeLoopStatus);
    assertWorkflow("Representative mobile pin-drop logging reachability", quickLog.reachable && !quickLog.modalActiveAfterSubmit && quickLog.afterUnits > quickLog.beforeUnits && quickLog.routeQueueCount === 15 && quickLogRouteStatus.hasStablePrefix && quickLog.documentScrollWidth <= quickLog.viewportWidth + 1 && quickLog.bodyScrollWidth <= quickLog.viewportWidth + 1, `submit reachable, units ${quickLog.beforeUnits} -> ${quickLog.afterUnits}, queue ${quickLog.routeQueueCount}, modal body ${quickLog.modalBodyClientHeight}/${quickLog.modalBodyScrollHeight}`, JSON.stringify({ ...quickLog, routeStatus: quickLogRouteStatus }));
    assertWorkflow("Representative mobile pin-drop governed hours detail", quickLogRouteStatus.hasGovernedHoursDetail, quickLogRouteStatus.detail || "no unverified-hours detail", JSON.stringify(quickLogRouteStatus));
    verifyNoErrors("Representative mobile logging", anthonyLog.eventLog, await snapshot(anthonyLog.cdp));

    const anthonyPwa = await runPageScenario(chrome, representativePwaServer, "/app?harness=representative-pwa-signin", "representative-pwa", {
      standalone: true,
      viewport: { width: 390, height: 844, deviceScaleFactor: 3, mobile: true }
    });
    verifyRepOnly("Representative PWA first launch Rep-only", anthonyPwa.initial);
    assertWorkflow("Representative mobile startup performance", Number(anthonyPwa.initial.debug.renderTimings.total || 0) < 5000 && Number(anthonyPwa.initial.performance.activeResourceDuration || 0) < 5000, `render ${anthonyPwa.initial.debug.renderTimings.total || 0}ms, active fetch ${anthonyPwa.initial.performance.activeResourceDuration || 0}ms`, JSON.stringify({ renderTimings: anthonyPwa.initial.debug.renderTimings, performance: anthonyPwa.initial.performance }));
    const anthonyReopen = await navigateExistingScenario(anthonyPwa.cdp, representativePwaServer, "/app?harness=representative-pwa-reopen");
    verifyRepOnly("Representative PWA reopen preserves Rep-only", anthonyReopen);
    const anthonyRefresh = await navigateExistingScenario(anthonyPwa.cdp, representativePwaServer, "/app?harness=representative-pwa-refresh");
    verifyRepOnly("Representative PWA refresh preserves Rep-only", anthonyRefresh);
    verifyNoErrors("Representative PWA", anthonyPwa.eventLog, anthonyRefresh);

    const decisionContext = await runPageScenario(chrome, decisionContextServer, "/app?role=rep&rep=anthony&debug=1&harness=decision-context-producer", "decision-context-producer", {
      standalone: true,
      viewport: { width: 390, height: 844, deviceScaleFactor: 3, mobile: true }
    });
    const decisionResult = await verifyDecisionContextProducer(decisionContext.cdp);
    const decisionRequest = decisionContextServer.fieldSessionRequests[0]?.payload || {};
    const decisionRawReport = decisionRequest.rawReportText ? JSON.parse(decisionRequest.rawReportText) : {};
    const decisionLegacyRawVisit = decisionRawReport.visits?.find(visit => visit.visitId === "legacy-active-session-visit") || null;
    const knownSourcesValid = decisionResult.sourceIds.every(sourceId => {
      const evidence = decisionResult.generated[sourceId]?.visitDecisionSource;
      return evidence?.sourceId === sourceId && evidence.reason && evidence.evidence?.length === 1 && evidence.confidence === 1 && !Number.isNaN(Date.parse(evidence.capturedAt));
    });
    const nonRouteDecisionsValid = decisionResult.sourceIds.filter(sourceId => sourceId !== "route_iq_recommendation")
      .every(sourceId => decisionResult.generated[sourceId]?.recommendationDecisionContext?.decision === "overridden");
    assertWorkflow("Decision Context supported sources", decisionResult.sourceIds.length === 7 && knownSourcesValid && decisionResult.labels.includes("Route IQ Recommendation") && decisionResult.labels.includes("Nearby Context") && decisionResult.labels.includes("Saved Place") && decisionResult.labels.includes("Discovery") && decisionResult.labels.includes("Existing Relationship") && decisionResult.labels.includes("Follow-up") && decisionResult.labels.includes("Manual"), "all seven governed decision sources produce complete structured evidence", JSON.stringify(decisionResult));
    assertWorkflow("Decision Context Route IQ acceptance", decisionResult.generated.route_iq_recommendation?.recommendationDecisionContext?.decision === "accepted" && decisionResult.generated.route_iq_recommendation?.recommendationDecisionContext?.recommendationAvailable === true, "explicit Route IQ selection records accepted recommendation context", JSON.stringify(decisionResult.generated.route_iq_recommendation));
    assertWorkflow("Decision Context off-route context", nonRouteDecisionsValid, "each explicit non-route source records governed override context when a different recommendation is present", JSON.stringify(decisionResult.generated));
    assertWorkflow("Decision Context Skip and Unknown", decisionResult.skipState.selected === "unknown" && decisionResult.skipState.status === "Unknown (default)" && decisionResult.unknown.visitDecisionSource?.sourceId === "unknown" && decisionResult.unknown.visitDecisionSource?.confidence === 0, "Skip remains optional and produces explicit Unknown evidence", JSON.stringify({ skip: decisionResult.skipState, unknown: decisionResult.unknown }));
    assertWorkflow("Decision Context No Contact workflow disclosure", decisionResult.noContactState.visitsAfterOutcomeSelection === decisionResult.noContactState.visitsBefore && decisionResult.noContactState.saveRequired && decisionResult.noContactState.countsVisible, "No Contact opens the optional Decision Source step and requires Save Result instead of auto-saving", JSON.stringify(decisionResult.noContactState));
    assertWorkflow("Decision Context zero influence before submission", JSON.stringify(decisionResult.evidenceOnlyState.routeOrderBefore) === JSON.stringify(decisionResult.evidenceOnlyState.routeOrderAfter) && decisionResult.evidenceOnlyState.visitsBefore === decisionResult.evidenceOnlyState.visitsAfter && !decisionResult.evidenceOnlyState.decisionSourceRequired && !decisionResult.evidenceOnlyState.capturedAtControlPresent && !decisionResult.evidenceOnlyState.representativeShadowOutputVisible, "choosing or skipping Decision Source changes no visit, route order, or representative-visible shadow state before Save Result", JSON.stringify(decisionResult.evidenceOnlyState));
    assertWorkflow("Decision Context post-action boundary", decisionResult.capturedAtMatchesVisitCreatedAt && JSON.stringify(decisionResult.decisionSourceKeys) === JSON.stringify(["capturedAt", "confidence", "evidence", "reason", "sourceId"]) && JSON.stringify(decisionResult.recommendationContextKeys) === JSON.stringify(["decision", "recommendationAvailable", "recommendationId"]) && JSON.stringify(decisionResult.evidenceOnlyState.recommendationContextFields) === JSON.stringify(["recommendationId", "recommendationPlaceId"]), "capturedAt equals visit creation time and the record contains source/outcome linkage only, not a frozen candidate set", JSON.stringify({ capturedAtMatchesVisitCreatedAt: decisionResult.capturedAtMatchesVisitCreatedAt, decisionSourceKeys: decisionResult.decisionSourceKeys, recommendationContextKeys: decisionResult.recommendationContextKeys, recommendationContextFields: decisionResult.evidenceOnlyState.recommendationContextFields }));
    assertWorkflow("Decision Context legacy load compatibility", decisionResult.legacyMissingContext.visitDecisionSource === null && decisionResult.legacyMissingContext.recommendationDecisionContext === null && decisionResult.legacyMissingContext.reportContext.visitDecisionSource?.sourceId === "unknown" && decisionResult.legacyMissingContext.reportContext.visitDecisionSource?.reason === null && decisionResult.legacyMissingContext.reportContext.visitDecisionSource?.confidence === 0 && decisionResult.legacyMissingContext.reportContext.visitDecisionSource?.capturedAt === "2026-07-12T19:00:00.000Z" && decisionResult.legacyMissingContext.reportContext.recommendationDecisionContext?.recommendationAvailable === null && decisionResult.legacyMissingContext.originalVisitUnchanged && decisionResult.legacyMissingContext.capturedAfterOutcome, "legacy visits remain unchanged in local state while report construction emits explicit post-action Unknown context", JSON.stringify(decisionResult.legacyMissingContext));
    assertWorkflow("Decision Context legacy End Route and End Day compatibility", decisionResult.legacyFinalization.completionActionsValid && decisionResult.legacyFinalization.originalVisitUnchanged && decisionResult.legacyFinalization.capturedAfterOutcome && decisionResult.legacyFinalization.reportVisit?.visitDecisionSource?.sourceId === "unknown" && decisionResult.legacyFinalization.reportVisit?.recommendationDecisionContext?.recommendationAvailable === null && decisionLegacyRawVisit?.visitDecisionSource?.sourceId === "unknown" && decisionLegacyRawVisit?.recommendationDecisionContext?.recommendationId === null, "legacy active-session visit validates for both completion actions and is acknowledged through the actual End Route handoff as post-action Unknown", JSON.stringify({ finalization: decisionResult.legacyFinalization, raw: decisionLegacyRawVisit }));
    assertWorkflow("Decision Context workspace isolation", decisionResult.workspaceBlocked, "unknown workspace failed closed", JSON.stringify(decisionResult));
    assertWorkflow("Decision Context local persistence", decisionResult.visit?.visitDecisionSource?.sourceId === "route_iq_recommendation" && decisionResult.reloadedVisit?.visitDecisionSource?.sourceId === "route_iq_recommendation" && decisionResult.reloadedVisit?.recommendationDecisionContext?.decision === "accepted", "decision evidence survives Dashboard state normalization and reload", JSON.stringify({ visit: decisionResult.visit, reloaded: decisionResult.reloadedVisit }));
    assertWorkflow("Decision Context canonical report", decisionResult.reportVisit?.visitDecisionSource?.sourceId === "route_iq_recommendation" && decisionResult.reportVisit?.recommendationDecisionContext?.decision === "accepted", "today report carries both governed decision fields", JSON.stringify(decisionResult.reportVisit));
    assertWorkflow("Decision Context Data acknowledgment", decisionResult.archiveStatus === "archived" && decisionResult.acknowledgment?.status === "archived" && decisionContextServer.fieldSessionRequests.length === 1 && decisionRawReport.visits?.[0]?.visitDecisionSource?.sourceId === "route_iq_recommendation" && decisionRawReport.visits?.[0]?.recommendationDecisionContext?.decision === "accepted", `${decisionResult.acknowledgment?.sessionId || "missing session"} acknowledged with decision context`, JSON.stringify({ result: decisionResult, request: decisionRequest }));
    assertWorkflow("Decision Context mobile reachability", decisionResult.layout.modalOverflowY === "auto" && decisionResult.layout.submitTop >= 0 && decisionResult.layout.submitBottom <= decisionResult.layout.viewportHeight + 1 && decisionResult.layout.submitLeft >= -1 && decisionResult.layout.submitRight <= decisionResult.layout.viewportWidth + 1 && decisionResult.layout.documentScrollWidth <= decisionResult.layout.viewportWidth + 1 && decisionResult.layout.bodyScrollWidth <= decisionResult.layout.viewportWidth + 1, `Decision Source and Save Result reachable within ${decisionResult.layout.viewportWidth}x${decisionResult.layout.viewportHeight}`, JSON.stringify(decisionResult.layout));
    verifyNoErrors("Decision Context producer", decisionContext.eventLog, await snapshot(decisionContext.cdp));

    const visitCorrection = await runPageScenario(chrome, visitCorrectionServer, "/app?role=rep&rep=anthony&debug=1&harness=post-visit-outcome-editing", "post-visit-outcome-editing", {
      standalone: true,
      viewport: { width: 390, height: 844, deviceScaleFactor: 3, mobile: true }
    });
    const correctionResult = await verifyPostVisitOutcomeEditing(visitCorrection.cdp);
    const correctionRequests = visitCorrectionServer.fieldSessionRequests;
    const correctionPayload = correctionRequests[0]?.payload || {};
    const correctionRawReport = correctionPayload.rawReportText ? JSON.parse(correctionPayload.rawReportText) : {};
    assertWorkflow("Post-visit outcome editing", correctionResult.placesBefore.activeView === "view-places" && correctionResult.placesBefore.title === "Rep Places" && correctionResult.placesBefore.cards === 1 && correctionResult.placesBefore.viewVisitVisible && correctionResult.firstCount === 1, "Rep opened a completed visit from Places and saved the first correction", JSON.stringify(correctionResult));
    assertWorkflow("Post-visit multiple corrections", correctionResult.secondCount === 2 && correctionResult.countAfterDuplicate === 2 && correctionResult.sequences.join(",") === "1,2" && new Set(correctionResult.eventIds).size === 2, "two ordered, uniquely identified correction events preserved", JSON.stringify(correctionResult));
    assertWorkflow("Post-visit correction persistence", correctionResult.reloadedCorrectionCount === 2 && correctionResult.reloadedFinalOutcome?.quality === "Membership/Unit" && correctionResult.reloadedFinalOutcome?.units === 1, "both corrections and the final verified outcome survive state normalization", JSON.stringify(correctionResult));
    assertWorkflow("Post-visit append-only audit", correctionResult.originalUnchanged && correctionResult.originalAuditText.includes("Original Visit") && correctionResult.firstAuditText.includes("Correction 1") && correctionResult.secondAuditText.includes("Correction 2") && correctionResult.finalAuditText.includes("Final Verified Outcome"), "original evidence remains unchanged alongside both corrections and the final projection", JSON.stringify(correctionResult));
    assertWorkflow("Post-visit final verified outcome", correctionResult.verified.quality === "Membership/Unit" && correctionResult.verified.leads === 1 && correctionResult.verified.appointments === 1 && correctionResult.verified.units === 1 && correctionResult.verified.followUp.includes("Call tomorrow") && correctionResult.verified.contactEmail === "taylor@example.com", "final verified outcome combines the ordered correction history", JSON.stringify(correctionResult.verified));
    assertWorkflow("Post-visit duplicate protection", correctionResult.duplicateStatus === "No outcome changes to save." && correctionResult.countAfterDuplicate === correctionResult.secondCount, "unchanged resubmission did not create another correction", JSON.stringify(correctionResult));
    assertWorkflow("Post-visit Route IQ scoring isolation", JSON.stringify(correctionResult.routeStatsBefore) === JSON.stringify(correctionResult.routeStatsAfter) && correctionResult.routeStatsAfter.units === 0 && correctionResult.verified.units === 1, "Route IQ continues to use original visit evidence while the verified display/report uses corrections", JSON.stringify({ before: correctionResult.routeStatsBefore, after: correctionResult.routeStatsAfter, verified: correctionResult.verified }));
    assertWorkflow("Post-visit canonical report audit", correctionResult.report.auditModel === "append_only_original_correction_final" && correctionResult.report.originalVisit.units === 0 && correctionResult.report.correctionCount === 2 && correctionResult.report.finalOutcome.units === 1 && correctionResult.report.finalVisit.units === 1, "canonical report contains original evidence, corrections, and final verified outcome", JSON.stringify(correctionResult.report));
    assertWorkflow("Post-visit Data acknowledgment", correctionResult.archiveStatus === "archived" && correctionResult.acknowledgment?.status === "archived" && correctionRequests.length === 1 && correctionRawReport.visitOutcomeEvidence?.correctionEvents?.length === 2, `${correctionResult.acknowledgment?.sessionId || "missing session"} acknowledged with correction evidence`, JSON.stringify({ result: correctionResult, request: correctionPayload }));
    assertWorkflow("Post-visit archived session guard", !correctionResult.correctionButtonAfterArchive && correctionResult.archivedMutationBlocked, "archived visit is read-only after Data acknowledgment", JSON.stringify(correctionResult));
    assertWorkflow("Post-visit mobile no-horizontal-scroll", correctionResult.documentScrollWidth <= correctionResult.viewportWidth + 1 && correctionResult.bodyScrollWidth <= correctionResult.viewportWidth + 1, `${correctionResult.documentScrollWidth}/${correctionResult.bodyScrollWidth}px within ${correctionResult.viewportWidth}px viewport`, JSON.stringify(correctionResult));
    assertWorkflow("Post-visit mobile form reachability", correctionResult.mobileFormReachability?.modalOverflowY === "auto" && correctionResult.mobileFormReachability.submitTop >= 0 && correctionResult.mobileFormReachability.submitBottom <= correctionResult.mobileFormReachability.viewportHeight + 1 && correctionResult.mobileFormReachability.submitLeft >= -1 && correctionResult.mobileFormReachability.submitRight <= correctionResult.mobileFormReachability.viewportWidth + 1, `Save Correction reachable within ${correctionResult.mobileFormReachability?.viewportWidth || 0}x${correctionResult.mobileFormReachability?.viewportHeight || 0}`, JSON.stringify(correctionResult.mobileFormReachability));
    verifyNoErrors("Post-visit outcome editing", visitCorrection.eventLog, await snapshot(visitCorrection.cdp));

    const addPlace = await runPageScenario(chrome, addPlaceServer, "/app?role=rep&rep=anthony&debug=1&harness=add-place-immediate-outcome", "add-place-immediate-outcome", {
      standalone: true,
      viewport: { width: 390, height: 844, deviceScaleFactor: 3, mobile: true }
    });
    const addPlaceResult = await verifyAddPlaceImmediateOutcomeCapture(addPlace.cdp);
    const addPlaceRequests = addPlaceServer.fieldSessionRequests;
    const addPlaceRawReport = addPlaceRequests[0]?.payload?.rawReportText ? JSON.parse(addPlaceRequests[0].payload.rawReportText) : {};
    assertWorkflow("Add Place business creation only", addPlaceResult.addPlaceButtonVisible && addPlaceResult.businessOnly.place?.sourceType === "Dashboard Manual Entry" && addPlaceResult.businessOnly.place?.workspaceId === customerPwaSessionFixture.workspaceId && !addPlaceResult.businessOnly.hasVisit, "representative created a workspace-bound business without recording a visit", JSON.stringify(addPlaceResult));
    assertWorkflow("Add Place later logging access", addPlaceResult.businessOnlyVisibleInPlaces && addPlaceResult.businessOnlyVisibleInQuickResult, "business-only creation remains available in Rep Places and Quick Result without entering Route IQ", JSON.stringify(addPlaceResult));
    assertWorkflow("Representative Saved Places rendering", addPlaceResult.representativePlacesGovernance.savedBeforePromotion.includes(addPlaceResult.businessOnly.place.name) && addPlaceResult.representativePlacesGovernance.savedBeforePromotion.includes("Not Yet Visited") && !addPlaceResult.representativePlacesGovernance.visitedBeforePromotion.includes(addPlaceResult.businessOnly.place.name) && addPlaceResult.representativePlacesGovernance.savedStatusCount === 1, "unvisited representative-owned business rendered only in Saved Places with required status", JSON.stringify(addPlaceResult.representativePlacesGovernance));
    assertWorkflow("Representative Saved Places ownership", !addPlaceResult.representativePlacesGovernance.foreignSavedVisible, "other representative's saved business remained hidden", JSON.stringify(addPlaceResult.representativePlacesGovernance));
    assertWorkflow("Representative Saved Places evidence isolation", !addPlaceResult.representativePlacesGovernance.prePromotionReportContainsSaved && !addPlaceResult.representativePlacesGovernance.founderBeforePromotionContainsSaved && !addPlaceResult.representativePlacesGovernance.statisticsBeforePromotionContainsSaved && !addPlaceResult.representativePlacesGovernance.prePromotionIntelligenceHasSavedPlace && !addPlaceResult.representativePlacesGovernance.routeBeforePromotionContainsSaved && !addPlaceResult.representativePlacesGovernance.activePoolClassified, "Saved Place absent from Data evidence, Founder map, statistics, Intelligence evidence, Route IQ, and Active Pool classification", JSON.stringify(addPlaceResult.representativePlacesGovernance));
    assertWorkflow("Representative Saved Places promotion rendering", addPlaceResult.representativePlacesGovernance.promotionVisit?.conversations === 1 && addPlaceResult.representativePlacesGovernance.visitedAfterPromotion.includes(addPlaceResult.businessOnly.place.name) && !addPlaceResult.representativePlacesGovernance.savedAfterPromotion.includes(addPlaceResult.businessOnly.place.name) && addPlaceResult.representativePlacesGovernance.founderAfterPromotionContainsVisited && addPlaceResult.representativePlacesGovernance.statisticsAfterPromotionContainsVisited, "verified visit moved presentation from Saved to Visited without mutating place ownership", JSON.stringify(addPlaceResult.representativePlacesGovernance));
    assertWorkflow("Add Place initial conversation", addPlaceResult.conversation?.quality === "Conversation" && addPlaceResult.conversation?.conversations === 1 && addPlaceResult.conversation?.manager.includes("Jordan Manager") && addPlaceResult.conversation?.notes.includes("Initial conversation"), "conversation and manager contact captured with business creation", JSON.stringify(addPlaceResult.conversation));
    assertWorkflow("Add Place initial lead", addPlaceResult.lead?.quality === "Lead" && addPlaceResult.lead?.conversations === 1 && addPlaceResult.lead?.leads === 1, "lead captured with business creation", JSON.stringify(addPlaceResult.lead));
    assertWorkflow("Add Place initial membership", addPlaceResult.membership?.quality === "Membership / Unit" && addPlaceResult.membership?.conversations === 1 && addPlaceResult.membership?.units === 1, "membership/unit captured with business creation", JSON.stringify(addPlaceResult.membership));
    assertWorkflow("Add Place initial appointment", addPlaceResult.appointment?.quality === "Appointment" && addPlaceResult.appointment?.leads === 1 && addPlaceResult.appointment?.appointments === 1, "appointment captured with business creation", JSON.stringify(addPlaceResult.appointment));
    assertWorkflow("Add Place initial follow-up", addPlaceResult.followUp?.quality === "Follow-up Required" && addPlaceResult.followUp?.followUp === "Return Wednesday at 10 AM", "follow-up requirement captured with business creation", JSON.stringify(addPlaceResult.followUp));
    assertWorkflow("Add Place supported outcomes", ["Visited", "Conversation", "Lead", "Appointment", "Membership / Unit", "Follow-up Required", "Decision Pending", "No Interest", "Closed"].every(label => addPlaceResult.outcomeOptions.includes(label)) && Object.keys(addPlaceResult.mappedOutcomes).length === 9, "all required initial outcomes are available", JSON.stringify({ options: addPlaceResult.outcomeOptions, mapped: addPlaceResult.mappedOutcomes }));
    assertWorkflow("Add Place duplicate protection", addPlaceResult.duplicateProtection.placeCountUnchanged && addPlaceResult.duplicateProtection.visitCountUnchanged && addPlaceResult.duplicateProtection.status === "This place already exists.", "duplicate submit created neither a business nor a visit", JSON.stringify(addPlaceResult.duplicateProtection));
    assertWorkflow("Add Place workspace isolation", addPlaceResult.workspaceIsolation.noPlaceCreated && addPlaceResult.workspaceIsolation.noVisitCreated && addPlaceResult.workspaceIsolation.status.includes("outside the authenticated workspace"), "cross-workspace creation failed closed", JSON.stringify(addPlaceResult.workspaceIsolation));
    assertWorkflow("Add Place append-only history", addPlaceResult.correctionCount === 1 && addPlaceResult.correctedConversation?.quality === "Lead" && addPlaceResult.report.correctionCount === 1 && addPlaceResult.report.conversationOriginal?.outcome === "Conversation" && addPlaceResult.report.conversationFinal?.outcome === "Lead", "business creation, initial visit, correction, and final verified outcome remain distinct", JSON.stringify(addPlaceResult));
    assertWorkflow("Add Place state persistence", addPlaceResult.reload.initialVisitCount === 5 && addPlaceResult.reload.appointment?.appointments === 1 && addPlaceResult.reload.followUp?.followUp === "Return Wednesday at 10 AM", "initial outcome fields survive state normalization", JSON.stringify(addPlaceResult.reload));
    assertWorkflow("Add Place canonical field-session contract", addPlaceResult.archiveStatus === "archived" && addPlaceResult.acknowledgment?.status === "archived" && addPlaceRequests.length === 1 && addPlaceResult.report.businessCreationCount === 5 && addPlaceRawReport.visits?.filter(visit => visit.businessCreation?.source === "dashboard_add_place").length === 5, `${addPlaceResult.acknowledgment?.sessionId || "missing session"} acknowledged with five business-creation snapshots`, JSON.stringify({ result: addPlaceResult, request: addPlaceRequests[0] }));
    assertWorkflow("Add Place Route IQ scoring isolation", addPlaceResult.routePoolUnchanged, "manual businesses stayed outside the governed Google-qualified route pool", JSON.stringify(addPlaceResult));
    assertWorkflow("Add Place archived session guard", addPlaceResult.initialVisitDisabledAfterArchive, "initial visit capture is disabled after session finalization", JSON.stringify(addPlaceResult));
    assertWorkflow("Add Place mobile form reachability", addPlaceResult.mobileReachability?.fieldsVisible && addPlaceResult.mobileReachability.modalOverflowY === "auto" && addPlaceResult.mobileReachability.submitTop >= 0 && addPlaceResult.mobileReachability.submitBottom <= addPlaceResult.mobileReachability.viewportHeight + 1 && addPlaceResult.mobileReachability.submitLeft >= -1 && addPlaceResult.mobileReachability.submitRight <= addPlaceResult.mobileReachability.viewportWidth + 1 && addPlaceResult.documentScrollWidth <= addPlaceResult.viewportWidth + 1 && addPlaceResult.bodyScrollWidth <= addPlaceResult.viewportWidth + 1, `Save Place + Visit reachable within ${addPlaceResult.mobileReachability?.viewportWidth || 0}x${addPlaceResult.mobileReachability?.viewportHeight || 0}`, JSON.stringify(addPlaceResult.mobileReachability));
    verifyNoErrors("Add Place immediate outcome", addPlace.eventLog, await snapshot(addPlace.cdp));

    const fieldSession = await runPageScenario(chrome, fieldSessionServer, "/app?role=rep&rep=anthony&debug=1&harness=field-session-end-route", "field-session-end-route");
    const fieldSessionResult = await verifyFieldSessionCompletion(fieldSession.cdp, "end_route");
    const fieldSessionRequest = fieldSessionServer.fieldSessionRequests[0]?.payload || {};
    assertWorkflow("End Route field-session producer", fieldSessionResult.recordStatus === "archived" && fieldSessionResult.completionAction === "end_route" && fieldSessionResult.attempts === 1 && fieldSessionResult.acknowledgment?.status === "archived", `${fieldSessionResult.acknowledgment?.sessionId || "missing session"} acknowledged`, JSON.stringify(fieldSessionResult));
    assertWorkflow("Field-session canonical payload", fieldSessionServer.fieldSessionRequests.length === 1 && fieldSessionRequest.workspaceId === customerPwaSessionFixture.workspaceId && fieldSessionRequest.operatingProfileId === customerPwaSessionFixture.operatingProfileId && fieldSessionRequest.finalExportConfirmed === true && fieldSessionRequest.completionAction === "end_route" && JSON.parse(fieldSessionRequest.rawReportText).reportType === "route-iq-daily-representative-report-v1", "final authenticated workspace report submitted once through the approved endpoint", JSON.stringify(fieldSessionServer.fieldSessionRequests));
    assertWorkflow("Field-session local finalization and duplicate protection", fieldSessionResult.localRawPreserved && fieldSessionResult.endRouteDisabled && fieldSessionResult.endDayDisabled && !fieldSessionResult.retryVisible && fieldSessionResult.duplicateReturnedExisting && fieldSessionServer.fieldSessionRequests.length === 1, "frozen locally; end actions disabled; repeat action did not resubmit", JSON.stringify(fieldSessionResult));
    assertWorkflow("Field-session finalized evidence guard", !fieldSessionResult.blockedModalOpen && fieldSessionResult.blockedSave === false && fieldSessionResult.afterBlockedVisitCount === fieldSessionResult.beforeBlockedVisitCount, "post-finalization visit mutation blocked", JSON.stringify(fieldSessionResult));
    assertWorkflow("Manual Export Today's Report preserved", fieldSessionResult.manualExportVisible && fieldSessionResult.manualExportDisabled === false, "manual JSON export remains available after archive", JSON.stringify(fieldSessionResult));
    verifyNoErrors("End Route field-session producer", fieldSession.eventLog, await snapshot(fieldSession.cdp));

    const fieldSessionRetry = await runPageScenario(chrome, fieldSessionRetryServer, "/app?role=rep&rep=anthony&debug=1&harness=field-session-end-day-retry", "field-session-end-day-retry", {
      standalone: true,
      viewport: { width: 390, height: 844, deviceScaleFactor: 3, mobile: true }
    });
    const retryResult = await verifyFieldSessionRetry(fieldSessionRetry.cdp);
    const retryRequests = fieldSessionRetryServer.fieldSessionRequests;
    assertWorkflow("End Day failed submission handling", retryResult.failureState.status === "failed" && retryResult.failureState.attempts === 1 && retryResult.failureState.retryable === true && retryResult.failureState.retryVisible && retryResult.failureState.handoffStatus.includes("preserved on this device"), "failed archive retained locally with retry visible", JSON.stringify(retryResult));
    assertWorkflow("Field-session retry behavior", retryResult.finalStatus === "archived" && retryResult.attempts === 2 && retryResult.rawReportUnchanged && retryResult.acknowledgment?.status === "archived" && retryRequests.length === 2 && retryRequests[0].payload.rawReportText === retryRequests[1].payload.rawReportText, "second attempt acknowledged using identical frozen report bytes", JSON.stringify({ retryResult, retryRequests }));
    assertWorkflow("Field-session retry completion state", retryResult.handoffStatus === "Session archived successfully." && !retryResult.retryVisible && retryResult.manualExportVisible && retryResult.manualExportDisabled === false, retryResult.handoffStatus, JSON.stringify(retryResult));
    verifyMobileFit("Field-session mobile End Day controls", await mobileFitSnapshot(fieldSessionRetry.cdp));
    verifyNoErrors("End Day field-session retry", fieldSessionRetry.eventLog, await snapshot(fieldSessionRetry.cdp), {
      allow: ["server responded with a status of 503"]
    });
    await Promise.all([
      fieldSession,
      fieldSessionRetry,
      visitCorrection,
      addPlace,
      decisionContext
    ].map(scenario => scenario.cdp.close()));

    const adaptive = await runPageScenario(chrome, adaptiveReplenishmentServer, "/app?harness=continuous-adaptive-replenishment", "adaptive-replenishment", {
      viewport: { width: 390, height: 844, deviceScaleFactor: 3, mobile: true }
    });
    const adaptiveResult = await verifyContinuousAdaptiveReplenishment(adaptive.cdp);
    const adaptiveRouteStatus = inspectRouteUpdateStatus(adaptiveResult.status);
    assertWorkflow("Continuous replenishment completion trigger", adaptiveResult.afterVisitCount === adaptiveResult.beforeVisitCount + 1 && adaptiveRouteStatus.hasStablePrefix, adaptiveResult.status, JSON.stringify({ ...adaptiveResult, routeStatus: adaptiveRouteStatus }));
    assertWorkflow("Continuous replenishment governed hours detail", adaptiveRouteStatus.hasGovernedHoursDetail, adaptiveRouteStatus.detail || "no unverified-hours detail", JSON.stringify(adaptiveRouteStatus));
    assertWorkflow("Continuous replenishment queue returns to 15", adaptiveResult.afterQueueIds.length === 15 && adaptiveResult.queueTarget === 15 && adaptiveResult.queueThreshold === 5 && adaptiveResult.queueState === "active" && adaptiveResult.addedReplacementCount > 0, `${adaptiveResult.afterQueueIds.length}/${adaptiveResult.queueTarget} active stops with ${adaptiveResult.addedReplacementCount} evidence-driven replacements`, JSON.stringify(adaptiveResult));
    assertWorkflow("Continuous replenishment record and duplicate protection", adaptiveResult.allAfterGoverned && adaptiveResult.retainedCount > 0 && adaptiveResult.duplicateCount === 0 && !adaptiveResult.completedStillActive, "reranked queue contains only governed unique stops and excludes the completed stop", JSON.stringify(adaptiveResult));
    assertWorkflow("Continuous replenishment evidence refresh", adaptiveResult.latestEvidenceCount >= adaptiveResult.afterVisitCount && adaptiveResult.debug.workspaceId === customerPwaManagerSessionFixture.workspaceId && adaptiveResult.debug.representativeId === customerPwaManagerSessionFixture.representativeId, `${adaptiveResult.latestEvidenceCount} evidence records for ${adaptiveResult.debug.workspaceId}/${adaptiveResult.debug.representativeId}`, JSON.stringify(adaptiveResult));
    assertWorkflow("Continuous replenishment durable persistence", adaptiveResult.persistedVisitCount === adaptiveResult.afterVisitCount && JSON.stringify(adaptiveResult.persistedQueueIds) === JSON.stringify(adaptiveResult.afterQueueIds), "visit outcome and active queue persisted together", JSON.stringify(adaptiveResult));
    assertWorkflow("Continuous replenishment concurrent job protection", adaptiveResult.concurrencyCoalesced && adaptiveResult.afterFlight.started === adaptiveResult.beforeFlight.started + 1, `${adaptiveResult.afterFlight.coalesced - adaptiveResult.beforeFlight.coalesced} overlapping job coalesced`, JSON.stringify({ before: adaptiveResult.beforeFlight, after: adaptiveResult.afterFlight }));
    verifyMobileFit("Continuous replenishment mobile rendering", await mobileFitSnapshot(adaptive.cdp));
    const adaptiveReload = await navigateExistingScenario(adaptive.cdp, adaptiveReplenishmentServer, "/app?harness=continuous-adaptive-replenishment-reload");
    assertWorkflow(
      "Continuous replenishment separate runtime restoration",
      adaptiveReload.visitCount === adaptiveResult.afterVisitCount
        && adaptiveReload.routeQueueIds.length === 15
        && new Set(adaptiveReload.routeQueueIds).size === 15
        && !adaptiveReload.routeQueueIds.includes(adaptiveResult.completedIdentity)
        && adaptiveReload.workspaceId === customerPwaManagerSessionFixture.workspaceId,
      `${adaptiveReload.visitCount} visits restored and 15 governed stops recomputed without the completed stop`,
      JSON.stringify({ before: adaptiveResult, reload: adaptiveReload })
    );
    verifyNoErrors("Continuous adaptive replenishment", adaptive.eventLog, adaptiveReload);

    const legacyCatalogTrap = await runPageScenario(
      chrome,
      legacyCatalogTrapServer,
      "/app?runtimePool=full&harness=legacy-catalog-override-denied",
      "legacy-catalog-override-denied"
    );
    const legacyCatalogRequests = legacyCatalogTrapServer.requests.filter(
      request => request.path === activePoolPath || request.path === fullPoolPath
    );
    assertWorkflow(
      "Authenticated PWA rejects legacy catalog override",
      legacyCatalogTrap.initial.debug.runtimeDataPool === "governed"
        && legacyCatalogTrap.initial.debug.runtimeDataStatus === "READY"
        && legacyCatalogRequests.length === 0,
      "caller query could not select active, full, demo, or fallback catalogs",
      JSON.stringify({ debug: legacyCatalogTrap.initial.debug, legacyCatalogRequests })
    );
    verifyNoErrors("Legacy catalog override denial", legacyCatalogTrap.eventLog, legacyCatalogTrap.initial);

    verifyRuntimePerformance(founderSnap, founder.routeLoadMs);

    await Promise.all([
      founder,
      mobileFounder,
      rep,
      anthonyLog,
      anthonyPwa,
      adaptive,
      legacyCatalogTrap
    ].map(scenario => scenario.cdp.close()));
  } catch (error) {
    harnessError = error;
  }

  const cleanupFailures = await cleanupHarness();
  removeSignalHandlers();
  if (harnessError && cleanupFailures.length) {
    throw new AggregateError(
      [harnessError, ...cleanupFailures.map(failure => failure.error)],
      `Dashboard harness failed and cleanup also failed: ${cleanupFailures.map(failure => failure.name).join(", ")}`,
      { cause: harnessError }
    );
  }
  if (harnessError) throw harnessError;
  if (cleanupFailures.length) {
    throw new AggregateError(
      cleanupFailures.map(failure => failure.error),
      `Dashboard harness cleanup failed: ${cleanupFailures.map(failure => failure.name).join(", ")}`
    );
  }
}

try {
  if (fileURLToPath(import.meta.url) === process.argv[1]) {
    await runHarness();
    const failed = results.filter(result => result.status === "FAIL");
    console.log(`Dashboard runtime workflow regression harness complete: ${results.length - failed.length}/${results.length} passed.`);
    if (failed.length) process.exitCode = 1;
  }
} catch (error) {
  console.error(`FAIL Harness infrastructure: ${error.stack || error.message || error}`);
  process.exitCode = 1;
}
