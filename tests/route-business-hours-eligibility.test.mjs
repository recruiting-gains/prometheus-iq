import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  createEmptyRouteQueue,
  maintainRouteQueue,
  routeQueueIdentity,
  serializeRouteQueue
} from "../intelligence/continuous-adaptive-route-replenishment.mjs";
import {
  applyHoursEligibilityToScore,
  buildRouteBusinessHoursIndex,
  evaluateRouteBusinessHoursEligibility,
  hoursNotVerifiedMarker,
  isCanonicalRouteBusinessHoursEligibility,
  routeBusinessHoursEligibilityVersion,
  summarizeRouteBusinessHours
} from "../intelligence/route-business-hours-eligibility.mjs";
import {
  createGovernedRouteRuntimeScopeFromConfiguration
} from "../intelligence/route-iq-governed-runtime-scope.mjs";
import {
  resolveConfiguredIntelligenceProfile
} from "../intelligence/operating-profile-engine.mjs";

const administrationRegistry = JSON.parse(readFileSync(
  new URL("../administration/workspace-configurations/route-iq-cross-industry-workspaces-v2.json", import.meta.url),
  "utf8"
));
const canonicalManifestRegistry = JSON.parse(readFileSync(
  new URL("../data/route-iq-commercial-readiness-v1/route-iq-workspace-business-artifact-manifest-registry-v1.json", import.meta.url),
  "utf8"
));
const eligibilityContract = JSON.parse(readFileSync(
  new URL("../intelligence/contracts/route-business-hours-eligibility-contracts.json", import.meta.url),
  "utf8"
));
const sourceHash = "a".repeat(64);
const evaluatedAt = "2026-07-23T16:00:00.000Z";

function clone(value) {
  return structuredClone(value);
}

function weeklyPeriod(openDay, openHour, closeDay, closeHour) {
  return {
    open: { date: null, day: openDay, hour: openHour, minute: 0, truncated: null },
    close: { date: null, day: closeDay, hour: closeHour, minute: 0, truncated: null }
  };
}

function datedPeriod(date, openHour, closeHour, closeDate = date) {
  return {
    open: { date, day: null, hour: openHour, minute: 0, truncated: null },
    close: { date: closeDate, day: null, hour: closeHour, minute: 0, truncated: null }
  };
}

function baseHoursRecord(workspace, identity, overrides = {}) {
  const identityFields = workspace.operatingProfile.profileId === "fitness"
    ? { googlePlaceId: identity }
    : { recordId: identity };
  return {
    workspaceId: workspace.workspaceId,
    operatingProfileId: workspace.operatingProfile.profileId,
    ...identityFields,
    businessName: `Synthetic governed business ${identity}`,
    address: "100 Validation Way, Example City, TX 77001",
    permanentOperationalStatus: "OPERATIONAL",
    regularWeeklyBusinessHours: {
      periods: [
        weeklyPeriod(1, 9, 1, 17),
        weeklyPeriod(2, 9, 2, 17),
        weeklyPeriod(3, 9, 3, 17),
        weeklyPeriod(4, 9, 4, 17),
        weeklyPeriod(5, 9, 5, 17)
      ]
    },
    specialOrHolidayHours: [],
    currentOpeningHoursWindow: null,
    appointmentAccessRequired: false,
    appointmentAccessWindows: [],
    businessTimezone: "America/Chicago",
    sourceRetrievedAt: "2026-07-23T15:00:00.000Z",
    hoursVerifiedAt: "2026-07-23T15:00:00.000Z",
    hoursFreshnessStatus: "FRESH",
    hoursConfidence: "HIGH",
    hoursProvenance: {
      sourceSystem: "GOVERNED_TEST_PROVIDER",
      sourceMethod: "fixture",
      sourcePlaceId: identity,
      retrievedAt: "2026-07-23T15:00:00.000Z",
      normalizedAt: "2026-07-23T15:00:00.000Z",
      fieldEvidenceIds: []
    },
    lastSuccessfulRefreshAt: "2026-07-23T15:00:00.000Z",
    lastFailedRefreshAt: null,
    refreshFailure: null,
    ...overrides
  };
}

function governedContext(workspaceIndex, records) {
  const registry = clone(administrationRegistry);
  const workspace = registry.workspaces[workspaceIndex];
  const identityField = workspace.operatingProfile.profileId === "fitness" ? "google_place_id" : "recordId";
  const identities = records.map(record => String(record.googlePlaceId ?? record.recordId));
  const source = workspace.opportunitySources[0];
  const approvalState = workspace.lifecycle === "synthetic_validation_only"
    ? "APPROVED_SYNTHETIC_VALIDATION"
    : "APPROVED";
  source.manifestApprovalState = approvalState;
  const manifest = {
    manifestId: source.manifestId,
    manifestVersion: "route-iq-workspace-business-artifact-manifest-v1",
    workspaceId: workspace.workspaceId,
    operatingProfileId: workspace.operatingProfile.profileId,
    configurationVersion: "route-iq-commercial-workspace-registry-v1",
    artifactType: "approved_business_opportunity_roster",
    artifactPath: source.artifactPath,
    artifactSha256: sourceHash,
    recordIdentityField: identityField,
    recordCount: identities.length,
    approvedRecordCount: identities.length,
    approvedRecordIds: identities,
    approvalState,
    classification: workspace.lifecycle === "synthetic_validation_only" ? "SYNTHETIC_NONCANONICAL" : "FOUNDER_FIELD_RESEARCH",
    sourceProvenance: {
      producer: "Prometheus Data",
      producerVersion: "governed-test-v1",
      sourceSystem: "deterministic_fixture",
      sourceRetrievedAt: "2026-07-23T15:00:00.000Z"
    },
    freshness: {
      maximumAgeHours: 24,
      evaluatedAt,
      expiresAt: "2026-07-24T15:00:00.000Z",
      state: workspace.lifecycle === "synthetic_validation_only" ? "SYNTHETIC" : "FRESH"
    },
    productionUseAuthorized: false,
    demoFallbackAllowed: false,
    crossWorkspaceFallbackAllowed: false
  };
  const businessHoursArtifact = {
    schemaVersion: "prometheus-data-business-hours-v1",
    artifactVersion: "business-hours-v2-test",
    generatedAt: evaluatedAt,
    statusEvaluatedAt: evaluatedAt,
    sourceDatasetVersion: "governed-test-v1",
    workspaceId: workspace.workspaceId,
    operatingProfileId: workspace.operatingProfile.profileId,
    recordCount: records.length,
    freshnessPolicy: { freshnessThresholdHours: 24 },
    records
  };
  const manifestRegistry = {
    schemaVersion: "route-iq-workspace-business-artifact-manifest-v1",
    registryVersion: "route-iq-workspace-business-artifact-manifest-registry-v1",
    generatedAt: evaluatedAt,
    fallbackPolicy: "FAIL_CLOSED_NO_DEMO_OR_CROSS_WORKSPACE_FALLBACK",
    manifests: [manifest]
  };
  const scope = createGovernedRouteRuntimeScopeFromConfiguration({
    workspaceRegistry: registry,
    manifestRegistry,
    workspaceId: workspace.workspaceId,
    operatingProfileId: workspace.operatingProfile.profileId,
    sourceArtifactSha256: sourceHash,
    businessHoursArtifact,
    allowFounderResearch: workspace.lifecycle === "founder_research",
    allowSynthetic: workspace.lifecycle === "synthetic_validation_only"
  });
  return { registry, workspace, manifest, manifestRegistry, businessHoursArtifact, scope };
}

function candidateFor(context, identity, overrides = {}) {
  const profileId = context.workspace.operatingProfile.profileId;
  return {
    id: `candidate_${identity}`,
    ...(profileId === "fitness" ? { googlePlaceId: identity } : { recordId: identity }),
    name: `Synthetic governed business ${identity}`,
    address: "100 Validation Way, Example City, TX 77001",
    workspaceId: context.workspace.workspaceId,
    operatingProfileId: profileId,
    territoryId: context.workspace.territories[0].territoryId,
    sourceManifestId: context.manifest.manifestId,
    sourceManifestVersion: context.manifest.manifestVersion,
    sourceArtifactSha256: context.manifest.artifactSha256,
    sourceConfigurationVersion: context.workspace.provenance.configurationVersion,
    sourceManifestConfigurationVersion: context.manifest.configurationVersion,
    sourceClassification: context.manifest.classification,
    estimatedVisitDurationMinutes: { minimum: 5, maximum: 9 },
    score: 50,
    ...overrides
  };
}

function decisionFor(context, record, at = evaluatedAt, candidateOverrides = {}) {
  const identity = String(record.googlePlaceId ?? record.recordId);
  const candidate = candidateFor(context, identity, candidateOverrides);
  return evaluateRouteBusinessHoursEligibility({
    record,
    candidate,
    evaluatedAt: at,
    policy: { freshnessThresholdHours: 24 },
    workspaceId: context.workspace.workspaceId,
    operatingProfileId: context.workspace.operatingProfile.profileId,
    territoryId: candidate.territoryId,
    governedRuntimeScope: context.scope
  });
}

function queueScore(context, record, at) {
  return candidate => applyHoursEligibilityToScore(
    { score: candidate.score, signals: ["existing route intelligence"] },
    decisionFor(context, record, at)
  );
}

test("v2 contract identity rejects legacy eligibility snapshots at consumer boundaries", () => {
  const workspace = administrationRegistry.workspaces[0];
  const record = baseHoursRecord(workspace, "versioned_open");
  const context = governedContext(0, [record]);
  const current = decisionFor(context, record);
  const legacy = { ...current, version: "route-iq-closed-now-eligibility-v1" };

  assert.equal(routeBusinessHoursEligibilityVersion, "route-iq-business-hours-eligibility-v2");
  assert.equal(eligibilityContract.version, "route-iq-business-hours-eligibility-contracts-v2");
  assert.equal(eligibilityContract.runtimeVersion, routeBusinessHoursEligibilityVersion);
  assert.equal(eligibilityContract.compatibility.exactVersionRequired, true);
  assert.equal(eligibilityContract.compatibility.legacyRuntimeVersionAccepted, false);
  assert.equal(isCanonicalRouteBusinessHoursEligibility(current), true);
  assert.equal(isCanonicalRouteBusinessHoursEligibility(legacy), false);
  assert.throws(
    () => applyHoursEligibilityToScore({ score: 50, signals: [] }, legacy),
    /exact governed v2 contract/
  );
  const candidate = candidateFor(context, record.googlePlaceId);
  const queue = createEmptyRouteQueue({
    workspaceId: context.workspace.workspaceId,
    operatingProfileId: context.workspace.operatingProfile.profileId,
    representativeId: "synthetic_rep",
    routeDate: "2026-07-23",
    governedRuntimeScope: context.scope
  });
  const result = maintainRouteQueue({
    queue,
    workspaceId: context.workspace.workspaceId,
    operatingProfileId: context.workspace.operatingProfile.profileId,
    representativeId: "synthetic_rep",
    routeDate: "2026-07-23",
    primaryCandidates: [candidate],
    scoreCandidate: () => ({ score: 50, signals: [], eligibility: legacy }),
    now: evaluatedAt,
    governedRuntimeScope: context.scope,
    force: true
  });
  assert.equal(result.exhausted, true);
  assert.deepEqual(result.queue.entries, []);
  assert.ok(result.failureReasons.some(reason => reason.includes("eligibility_missing")));
});

test("canonical Administration and Data registries align while the pending roster admits no business identity", () => {
  const workspace = administrationRegistry.workspaces[0];
  const record = baseHoursRecord(workspace, "fixture_identity");
  const scope = createGovernedRouteRuntimeScopeFromConfiguration({
    workspaceRegistry: administrationRegistry,
    manifestRegistry: canonicalManifestRegistry,
    workspaceId: workspace.workspaceId,
    operatingProfileId: workspace.operatingProfile.profileId,
    sourceArtifactSha256: canonicalManifestRegistry.manifests[0].artifactSha256,
    businessHoursArtifact: {
      schemaVersion: "prometheus-data-business-hours-v1",
      artifactVersion: "test",
      workspaceId: workspace.workspaceId,
      operatingProfileId: workspace.operatingProfile.profileId,
      recordCount: 1,
      records: [record]
    },
    allowFounderResearch: true
  });
  assert.equal(scope.workspaceId, "fitness_connection");
  assert.equal(scope.classification, "FOUNDER_FIELD_RESEARCH");
  const candidate = {
    ...candidateFor({ workspace, manifest: canonicalManifestRegistry.manifests[0] }, "fixture_identity"),
    sourceConfigurationVersion: workspace.provenance.configurationVersion
  };
  const rejected = evaluateRouteBusinessHoursEligibility({
    record,
    candidate,
    evaluatedAt,
    workspaceId: workspace.workspaceId,
    operatingProfileId: workspace.operatingProfile.profileId,
    territoryId: candidate.territoryId,
    governedRuntimeScope: scope
  });
  assert.equal(rejected.immediateRecommendationEligible, false);
  assert.equal(rejected.reasonCode, "BUSINESS_MANIFEST_ADMISSION_REJECTED");
});

test("fresh verified open is immediate-route eligible without changing score or visit-duration semantics", () => {
  const workspace = administrationRegistry.workspaces[0];
  const record = baseHoursRecord(workspace, "fitness_open");
  const context = governedContext(0, [record]);
  const decision = decisionFor(context, record);
  const scored = applyHoursEligibilityToScore({ score: 87.625, signals: [] }, decision);
  assert.equal(decision.version, routeBusinessHoursEligibilityVersion);
  assert.equal(decision.status, "OPEN_VERIFIED");
  assert.equal(decision.coverageEligible, true);
  assert.equal(decision.immediateRecommendationEligible, true);
  assert.equal(decision.eligible, true);
  assert.equal(decision.displayLabel, "Open now · closes 5:00 PM");
  assert.equal(decision.visitDuration.display, "Estimated visit: 5\u20139 min");
  assert.equal(scored.score, 87.625);
  assert.equal(scored.eligibility.scoringChanged, false);
});

test("fresh verified closed retains next opening and is not immediate-route eligible", () => {
  const workspace = administrationRegistry.workspaces[0];
  const record = baseHoursRecord(workspace, "fitness_closed");
  const context = governedContext(0, [record]);
  const decision = decisionFor(context, record, "2026-07-24T02:00:00.000Z");
  assert.equal(decision.status, "CLOSED_VERIFIED");
  assert.equal(decision.coverageEligible, true);
  assert.equal(decision.immediateRecommendationEligible, false);
  assert.equal(decision.nextOpening.displayTime, "9:00 AM");
  assert.match(decision.displayLabel, /^Closed · opens Friday at 9:00 AM$/);
});

test("stale, missing, invalid, and provider-failure evidence never authorizes an immediate stop", () => {
  const workspace = administrationRegistry.workspaces[0];
  const records = [
    baseHoursRecord(workspace, "stale", { hoursVerifiedAt: "2026-07-21T00:00:00.000Z" }),
    baseHoursRecord(workspace, "missing", { hoursVerifiedAt: null }),
    baseHoursRecord(workspace, "invalid", { businessTimezone: "Invalid/Zone" }),
    baseHoursRecord(workspace, "provider_failure", {
      lastFailedRefreshAt: "2026-07-23T15:30:00.000Z",
      refreshFailure: { code: "provider_timeout", message: "sanitized" }
    })
  ];
  const context = governedContext(0, records);
  const decisions = records.map(record => decisionFor(context, record));
  assert.deepEqual(decisions.map(item => item.immediateRecommendationEligible), [false, false, false, false]);
  assert.deepEqual(decisions.map(item => item.sourceState), ["STALE", "UNAVAILABLE", "INVALID", "PROVIDER_FAILURE"]);
  assert.equal(decisions[0].internalMarker, hoursNotVerifiedMarker);
  assert.equal(decisions[0].displayLabel, "Hours outdated · verification required");
  assert.equal(decisions[1].displayLabel, "Hours unavailable · not route eligible");
});

test("24-hour, overnight, split, and verified holiday schedules evaluate in business-local time", () => {
  const workspace = administrationRegistry.workspaces[0];
  const records = [
    baseHoursRecord(workspace, "always_open", {
      regularWeeklyBusinessHours: {
        periods: [{
          open: { date: null, day: 0, hour: 0, minute: 0, truncated: null },
          close: null
        }]
      }
    }),
    baseHoursRecord(workspace, "overnight", {
      regularWeeklyBusinessHours: { periods: [weeklyPeriod(4, 20, 5, 2)] }
    }),
    baseHoursRecord(workspace, "split", {
      regularWeeklyBusinessHours: {
        periods: [weeklyPeriod(4, 8, 4, 11), weeklyPeriod(4, 14, 4, 18)]
      }
    }),
    baseHoursRecord(workspace, "holiday", {
      specialOrHolidayHours: [{
        date: "2026-07-23",
        verificationStatus: "VERIFIED",
        periods: [datedPeriod("2026-07-23", 10, 13)]
      }]
    })
  ];
  const context = governedContext(0, records);
  assert.equal(decisionFor(context, records[0]).displayLabel, "Open 24 hours");
  assert.equal(decisionFor(context, records[1], "2026-07-24T05:00:00.000Z").status, "OPEN_VERIFIED");
  assert.equal(decisionFor(context, records[2], "2026-07-23T18:00:00.000Z").status, "CLOSED_VERIFIED");
  assert.equal(decisionFor(context, records[2], "2026-07-23T20:00:00.000Z").status, "OPEN_VERIFIED");
  assert.equal(decisionFor(context, records[3], "2026-07-23T17:00:00.000Z").status, "OPEN_VERIFIED");
});

test("DST wall-clock evaluation and special-hour uncertainty fail safely", () => {
  const workspace = administrationRegistry.workspaces[0];
  const dst = baseHoursRecord(workspace, "dst", {
    hoursVerifiedAt: "2026-03-08T07:30:00.000Z",
    sourceRetrievedAt: "2026-03-08T07:30:00.000Z",
    lastSuccessfulRefreshAt: "2026-03-08T07:30:00.000Z",
    regularWeeklyBusinessHours: { periods: [weeklyPeriod(0, 1, 0, 4)] }
  });
  const specialUnknown = baseHoursRecord(workspace, "holiday_unknown", {
    specialOrHolidayHours: [{
      date: "2026-07-23",
      verificationStatus: "UNVERIFIED",
      periods: null
    }]
  });
  const dstContext = governedContext(0, [dst]);
  const specialContext = governedContext(0, [specialUnknown]);
  assert.equal(decisionFor(dstContext, dst, "2026-03-08T08:30:00.000Z").status, "OPEN_VERIFIED");
  const uncertain = decisionFor(specialContext, specialUnknown);
  assert.equal(uncertain.status, "SPECIAL_HOURS_UNVERIFIED");
  assert.equal(uncertain.immediateRecommendationEligible, false);
});

test("appointment-only businesses require a current verified access window", () => {
  const workspace = administrationRegistry.workspaces[0];
  const verified = baseHoursRecord(workspace, "appointment_verified", {
    appointmentAccessRequired: true,
    appointmentAccessWindows: [{
      appointmentId: "appointment_001",
      verificationStatus: "VERIFIED",
      start: datedPeriod("2026-07-23", 10, 12).open,
      end: datedPeriod("2026-07-23", 10, 12).close,
      source: "governed_fixture",
      verifiedAt: "2026-07-23T15:00:00.000Z"
    }]
  });
  const unverified = baseHoursRecord(workspace, "appointment_unverified", {
    appointmentAccessRequired: true,
    appointmentAccessWindows: [{
      appointmentId: "appointment_002",
      verificationStatus: "UNVERIFIED",
      start: datedPeriod("2026-07-23", 10, 12).open,
      end: datedPeriod("2026-07-23", 10, 12).close
    }]
  });
  const context = governedContext(0, [verified, unverified]);
  assert.equal(decisionFor(context, verified).displayLabel, "Appointment window verified");
  assert.equal(decisionFor(context, verified).immediateRecommendationEligible, true);
  assert.equal(decisionFor(context, unverified).immediateRecommendationEligible, false);
});

test("manifest, hash, configuration, workspace, profile, territory, and approved-roster substitutions fail closed", () => {
  const workspace = administrationRegistry.workspaces[0];
  const record = baseHoursRecord(workspace, "admitted");
  const context = governedContext(0, [record]);
  const variants = [
    { sourceManifestId: "other_manifest" },
    { sourceArtifactSha256: "b".repeat(64) },
    { sourceConfigurationVersion: "v2.9.9" },
    { workspaceId: "other_workspace" },
    { operatingProfileId: "general_outside_sales" },
    { territoryId: "other_territory" },
    { googlePlaceId: "unapproved_identity" }
  ];
  for (const variant of variants) {
    const decision = decisionFor(context, record, evaluatedAt, variant);
    assert.equal(decision.immediateRecommendationEligible, false);
    assert.equal(decision.reasonCode, "BUSINESS_MANIFEST_ADMISSION_REJECTED");
    assert.equal(decision.failClosed, true);
  }
});

test("the same configuration-driven path supports Fitness and general outside sales without cross-profile records", () => {
  const fitnessWorkspace = administrationRegistry.workspaces[0];
  const salesWorkspace = administrationRegistry.workspaces[1];
  const fitnessRecord = baseHoursRecord(fitnessWorkspace, "fitness_profile_record");
  const salesRecord = baseHoursRecord(salesWorkspace, "sales_profile_record");
  const fitnessContext = governedContext(0, [fitnessRecord]);
  const salesContext = governedContext(1, [salesRecord]);
  const fitnessProfile = resolveConfiguredIntelligenceProfile({
    workspaceRegistry: fitnessContext.registry,
    workspaceId: fitnessWorkspace.workspaceId,
    operatingProfileId: "fitness",
    territoryId: fitnessWorkspace.territories[0].territoryId,
    allowFounderResearch: true
  });
  const salesProfile = resolveConfiguredIntelligenceProfile({
    workspaceRegistry: salesContext.registry,
    workspaceId: salesWorkspace.workspaceId,
    operatingProfileId: "general_outside_sales",
    territoryId: salesWorkspace.territories[0].territoryId,
    allowSynthetic: true
  });
  assert.equal(fitnessProfile.safety.recommendationInfluence, "OFF");
  assert.equal(salesProfile.safety.recommendationInfluence, "OFF");
  assert.equal(decisionFor(fitnessContext, fitnessRecord).immediateRecommendationEligible, true);
  assert.equal(decisionFor(salesContext, salesRecord).immediateRecommendationEligible, true);
  const crossProfile = evaluateRouteBusinessHoursEligibility({
    record: fitnessRecord,
    candidate: candidateFor(salesContext, "sales_profile_record"),
    evaluatedAt,
    workspaceId: salesWorkspace.workspaceId,
    operatingProfileId: salesWorkspace.operatingProfile.profileId,
    governedRuntimeScope: salesContext.scope
  });
  assert.equal(crossProfile.immediateRecommendationEligible, false);
  assert.equal(crossProfile.failClosed, true);
});

test("queue re-evaluates persisted rank one at authoritative time and safely exhausts when it becomes stale", () => {
  const workspace = administrationRegistry.workspaces[0];
  const record = baseHoursRecord(workspace, "persisted_open");
  const context = governedContext(0, [record]);
  const candidate = candidateFor(context, "persisted_open");
  const queueContext = {
    workspaceId: workspace.workspaceId,
    operatingProfileId: workspace.operatingProfile.profileId,
    representativeId: "representative_cruz_founder",
    routeDate: "2026-07-23",
    governedRuntimeScope: context.scope
  };
  const initial = maintainRouteQueue({
    queue: createEmptyRouteQueue({ ...queueContext, targetSize: 1, threshold: 1 }),
    ...queueContext,
    primaryCandidates: [candidate],
    force: true,
    scoreCandidate: queueScore(context, record, evaluatedAt),
    now: evaluatedAt
  });
  assert.equal(initial.queue.entries.length, 1);
  assert.equal(initial.queue.entries[0].eligibilitySnapshot.immediateRecommendationEligible, true);

  const later = "2026-07-25T16:00:00.000Z";
  const restored = maintainRouteQueue({
    queue: serializeRouteQueue(initial.queue),
    ...queueContext,
    primaryCandidates: [candidate],
    force: true,
    scoreCandidate: queueScore(context, record, later),
    now: later
  });
  assert.equal(restored.queue.entries.length, 0);
  assert.equal(restored.queue.state, "exhausted");
  assert.equal(restored.removed[0].identityKey, routeQueueIdentity(candidate));
});

test("an empty approved active pool is a valid safe result", () => {
  const workspace = administrationRegistry.workspaces[1];
  const context = governedContext(1, []);
  const result = maintainRouteQueue({
    queue: createEmptyRouteQueue({
      workspaceId: workspace.workspaceId,
      operatingProfileId: workspace.operatingProfile.profileId,
      representativeId: "synthetic_rep",
      governedRuntimeScope: context.scope
    }),
    workspaceId: workspace.workspaceId,
    operatingProfileId: workspace.operatingProfile.profileId,
    representativeId: "synthetic_rep",
    governedRuntimeScope: context.scope,
    primaryCandidates: [],
    force: true,
    now: evaluatedAt
  });
  assert.equal(result.exhausted, true);
  assert.equal(result.queue.entries.length, 0);
});

test("index and summary expose approved counts and separate coverage from immediate eligibility", () => {
  const workspace = administrationRegistry.workspaces[0];
  const open = baseHoursRecord(workspace, "summary_open");
  const stale = baseHoursRecord(workspace, "summary_stale", { hoursVerifiedAt: "2026-07-20T00:00:00.000Z" });
  const context = governedContext(0, [open, stale]);
  const index = buildRouteBusinessHoursIndex(context.businessHoursArtifact, {
    governedRuntimeScope: context.scope
  });
  const summary = summarizeRouteBusinessHours([
    decisionFor(context, open),
    decisionFor(context, stale)
  ]);
  assert.equal(index.recordCount, 2);
  assert.equal(index.approvedRecordCount, 2);
  assert.equal(summary.evaluated, 2);
  assert.equal(summary.coverageEligible, 2);
  assert.equal(summary.immediateRecommendationEligible, 1);
  assert.equal(summary.excludedFromImmediateRecommendation, 1);
});
