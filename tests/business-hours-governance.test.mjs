import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import {
  DEFAULT_BUSINESS_HOURS_POLICY,
  assertBusinessHoursWorkspace,
  evaluateBusinessHoursRecord,
  normalizeGoogleBusinessHours,
  normalizeHoursPeriods,
  preserveBusinessHoursAfterRefreshFailure,
  recalculateBusinessHoursArtifact,
  readBusinessHoursArtifact,
  unknownBusinessHoursRecord,
  validateBusinessHoursArtifact,
  writeBusinessHoursArtifactAtomic
} from "../scripts/lib/business-hours-governance.mjs";
import {
  GOOGLE_BUSINESS_HOURS_FIELD_MASK,
  resolveGoogleBusinessHoursApiKey,
  validateBusinessHoursFieldEvidence
} from "../scripts/refresh-google-business-hours.mjs";
import { runGovernance } from "../scripts/govern-runtime-pool-refresh.mjs";

const MONDAY_OPEN = "2026-07-13T15:00:00.000Z";
const MONDAY_CLOSED = "2026-07-14T00:00:00.000Z";
const VERIFIED_AT = "2026-07-13T12:00:00.000Z";
const BUSINESS_HOURS_ARTIFACT = "data/qualified-prospects/google-qualified-businesses-v2/business-hours-v1/business-hours.json";

function candidate(overrides = {}) {
  return {
    google_place_id: "place-fixture-1",
    business_name: "Fixture Business",
    full_address: "100 Main St, Houston, TX 77002, USA",
    category: "Auto",
    accessType: "Walk-in ready",
    appointmentAccessRequired: false,
    appointmentAccessWindows: [],
    latitude: 29.75,
    longitude: -95.36,
    business_status: "OPERATIONAL",
    ...overrides
  };
}

function weeklyPeriod(openDay, openHour, openMinute, closeDay, closeHour, closeMinute) {
  return {
    open: { date: null, day: openDay, hour: openHour, minute: openMinute, truncated: null },
    close: { date: null, day: closeDay, hour: closeHour, minute: closeMinute, truncated: null }
  };
}

function baseRecord(overrides = {}) {
  return {
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    googlePlaceId: "place-fixture-1",
    businessName: "Fixture Business",
    address: "100 Main St, Houston, TX 77002, USA",
    category: "Auto",
    accessType: "Walk-in ready",
    appointmentAccessRequired: false,
    appointmentAccessWindows: [],
    latitude: 29.75,
    longitude: -95.36,
    activePoolMember: true,
    sourceDatasetVersion: "google-qualified-businesses-v2",
    permanentOperationalStatus: "OPERATIONAL",
    regularWeeklyBusinessHours: {
      periods: [weeklyPeriod(1, 7, 0, 1, 18, 0)],
      sourceOpenNowAtRetrieval: null
    },
    specialOrHolidayHours: [],
    currentOpeningHoursWindow: null,
    businessTimezone: "America/Chicago",
    currentHoursSource: "GOOGLE_PLACES_API_NEW",
    sourceRetrievedAt: VERIFIED_AT,
    hoursVerifiedAt: VERIFIED_AT,
    hoursFreshnessStatus: "FRESH",
    hoursConfidence: "MEDIUM",
    hoursProvenance: {
      sourceSystem: "GOOGLE_PLACES_API_NEW",
      sourceMethod: "places.get",
      sourcePlaceId: "place-fixture-1",
      fieldMask: [...GOOGLE_BUSINESS_HOURS_FIELD_MASK],
      retrievedAt: VERIFIED_AT,
      normalizedAt: VERIFIED_AT,
      providerBusinessName: "Fixture Business",
      providerAddress: "100 Main St, Houston, TX 77002, USA",
      fieldEvidenceIds: []
    },
    lastSuccessfulRefreshAt: VERIFIED_AT,
    lastFailedRefreshAt: null,
    refreshFailure: null,
    currentOpenClosedEligibilityStatus: "HOURS_UNKNOWN",
    currentStatusReasonCode: "NOT_EVALUATED",
    currentStatusReason: "Not evaluated.",
    currentStatusEvaluatedAt: null,
    currentStatusBusinessLocalDate: null,
    currentStatusBusinessLocalTime: null,
    currentEffectiveInterval: null,
    currentNextOpening: null,
    currentNextClosing: null,
    currentAvailabilityDisplay: "Hours unavailable · not route eligible",
    ...overrides
  };
}

function artifactFor(record) {
  return {
    schemaVersion: "prometheus-data-business-hours-v1",
    artifactVersion: "business-hours-v1",
    projectionVersion: "route-iq-business-availability-v2",
    generatedAt: MONDAY_OPEN,
    statusEvaluatedAt: MONDAY_OPEN,
    sourceRetrievedAt: VERIFIED_AT,
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    protectedWorkspaceIds: [],
    sourceDatasetVersion: "google-qualified-businesses-v2",
    sourceArtifact: "fixture",
    sourceCandidateCount: 1,
    recordCount: 1,
    refreshMode: "offline-scheduled-google-places-details",
    provider: "GOOGLE_PLACES_API_NEW",
    freshnessPolicy: { ...DEFAULT_BUSINESS_HOURS_POLICY },
    routeEligibilityActivated: false,
    runtimeBehaviorChanged: false,
    scoringChanged: false,
    records: [record]
  };
}

test("permanently operational and currently closed remain distinguishable", () => {
  const record = baseRecord();
  const result = evaluateBusinessHoursRecord(record, MONDAY_CLOSED);
  assert.equal(record.permanentOperationalStatus, "OPERATIONAL");
  assert.equal(result.status, "CLOSED_VERIFIED");
});

test("verified regular hours produce OPEN_VERIFIED", () => {
  const result = evaluateBusinessHoursRecord(baseRecord(), MONDAY_OPEN);
  assert.equal(result.status, "OPEN_VERIFIED");
  assert.equal(result.reasonCode, "VERIFIED_REGULAR_PERIOD_OPEN");
  assert.equal(result.displayStatus, "Open now · closes 6:00 PM");
  assert.equal(result.effectiveInterval.end.localTime, "18:00");
});

test("verified closed hours produce CLOSED_VERIFIED", () => {
  const result = evaluateBusinessHoursRecord(baseRecord(), MONDAY_CLOSED);
  assert.equal(result.status, "CLOSED_VERIFIED");
  assert.equal(result.reasonCode, "VERIFIED_REGULAR_PERIOD_CLOSED");
  assert.match(result.displayStatus, /^Closed · opens Monday at 7:00 AM$/);
});

test("missing hours produce HOURS_UNKNOWN without false certainty", () => {
  const record = unknownBusinessHoursRecord({ candidate: candidate(), evaluatedAt: MONDAY_OPEN });
  assert.equal(record.currentOpenClosedEligibilityStatus, "HOURS_UNKNOWN");
  assert.equal(record.regularWeeklyBusinessHours, null);
  assert.equal(record.currentOpeningHoursWindow, null);
  assert.equal(record.businessTimezone, null);
  assert.notEqual(record.regularWeeklyBusinessHours, false);
  assert.notEqual(record.currentOpenClosedEligibilityStatus, false);
});

test("stale hours produce HOURS_STALE", () => {
  const staleAt = "2026-07-14T13:00:00.001Z";
  const result = evaluateBusinessHoursRecord(baseRecord(), staleAt);
  assert.equal(result.status, "HOURS_STALE");
  assert.equal(result.hoursFreshnessStatus, "STALE");
  assert.equal(result.displayStatus, "Hours outdated · verification required");
});

test("unverified holiday hours never become verified open", () => {
  const record = baseRecord({
    specialOrHolidayHours: [{
      date: "2026-07-13",
      verificationStatus: "UNVERIFIED",
      periods: [{
        open: { date: "2026-07-13", day: 1, hour: 0, minute: 0, truncated: null },
        close: { date: "2026-07-14", day: 2, hour: 0, minute: 0, truncated: null }
      }],
      source: null
    }]
  });
  const result = evaluateBusinessHoursRecord(record, MONDAY_OPEN);
  assert.equal(result.status, "SPECIAL_HOURS_UNVERIFIED");
});

test("overnight weekly hours evaluate across midnight", () => {
  const record = baseRecord({
    regularWeeklyBusinessHours: {
      periods: [weeklyPeriod(1, 22, 0, 2, 6, 0)],
      sourceOpenNowAtRetrieval: null
    }
  });
  assert.equal(evaluateBusinessHoursRecord(record, "2026-07-14T06:00:00.000Z").status, "OPEN_VERIFIED");
  assert.equal(evaluateBusinessHoursRecord(record, "2026-07-14T12:00:00.000Z").status, "CLOSED_VERIFIED");
});

test("split schedules and canonical 24-hour periods are handled explicitly", () => {
  const split = baseRecord({
    regularWeeklyBusinessHours: {
      periods: [
        weeklyPeriod(1, 7, 0, 1, 11, 0),
        weeklyPeriod(1, 13, 0, 1, 18, 0)
      ],
      sourceOpenNowAtRetrieval: null
    }
  });
  assert.equal(evaluateBusinessHoursRecord(split, "2026-07-13T15:00:00.000Z").status, "OPEN_VERIFIED");
  assert.equal(evaluateBusinessHoursRecord(split, "2026-07-13T17:00:00.000Z").status, "CLOSED_VERIFIED");
  const alwaysOpen = baseRecord({
    regularWeeklyBusinessHours: {
      periods: [{
        open: { date: null, day: 0, hour: 0, minute: 0, truncated: null },
        close: null
      }],
      sourceOpenNowAtRetrieval: null
    }
  });
  const result = evaluateBusinessHoursRecord(alwaysOpen, MONDAY_OPEN);
  assert.equal(result.status, "OPEN_VERIFIED");
  assert.equal(result.displayStatus, "Open 24 hours");
});

test("malformed periods fail closed and cannot masquerade as 24-hour schedules", () => {
  assert.equal(normalizeHoursPeriods([{
    open: { day: 2, hour: 0, minute: 0 },
    close: null
  }], "weekly"), null);
  const invalid = baseRecord({
    regularWeeklyBusinessHours: {
      periods: [{
        open: { date: null, day: 2, hour: 0, minute: 0, truncated: null },
        close: null
      }],
      sourceOpenNowAtRetrieval: null
    }
  });
  const result = evaluateBusinessHoursRecord(invalid, MONDAY_OPEN);
  assert.equal(result.status, "HOURS_UNKNOWN");
  assert.equal(result.reasonCode, "REGULAR_HOURS_MISSING");
});

test("permanent closure takes precedence over stale schedule evidence", () => {
  const result = evaluateBusinessHoursRecord(baseRecord({
    permanentOperationalStatus: "CLOSED_PERMANENTLY",
    hoursVerifiedAt: "2026-01-01T00:00:00.000Z"
  }), MONDAY_OPEN);
  assert.equal(result.status, "CLOSED_VERIFIED");
  assert.equal(result.reasonCode, "PERMANENT_STATUS_CLOSED_PERMANENTLY");
});

test("verified appointment-only access is open only inside the governed window", () => {
  const record = baseRecord({
    accessType: "Appointment only",
    appointmentAccessRequired: true,
    appointmentAccessWindows: [{
      appointmentId: "appointment_fixture",
      verificationStatus: "VERIFIED",
      start: { date: "2026-07-13", day: 1, hour: 9, minute: 0, truncated: null },
      end: { date: "2026-07-13", day: 1, hour: 11, minute: 0, truncated: null },
      source: "governed_test_fixture",
      verifiedAt: VERIFIED_AT
    }]
  });
  const inside = evaluateBusinessHoursRecord(record, "2026-07-13T15:00:00.000Z");
  const outside = evaluateBusinessHoursRecord(record, "2026-07-13T18:00:00.000Z");
  assert.equal(inside.status, "OPEN_VERIFIED");
  assert.equal(inside.displayStatus, "Appointment window verified");
  assert.equal(outside.status, "CLOSED_VERIFIED");
});

test("America/Chicago evaluation uses business-local date and daylight offset", () => {
  const record = baseRecord({
    regularWeeklyBusinessHours: {
      periods: [weeklyPeriod(1, 7, 0, 1, 8, 0)],
      sourceOpenNowAtRetrieval: null
    }
  });
  const result = evaluateBusinessHoursRecord(record, "2026-07-13T12:30:00.000Z");
  assert.equal(result.status, "OPEN_VERIFIED");
  assert.equal(result.businessLocalDate, "2026-07-13");
  assert.equal(result.businessLocalTime, "07:30");
});

test("business-local evaluation remains deterministic across daylight-saving transitions", () => {
  const spring = baseRecord({
    hoursVerifiedAt: "2026-03-07T12:00:00.000Z",
    sourceRetrievedAt: "2026-03-07T12:00:00.000Z",
    regularWeeklyBusinessHours: {
      periods: [weeklyPeriod(0, 3, 0, 0, 4, 0)],
      sourceOpenNowAtRetrieval: null
    }
  });
  assert.equal(evaluateBusinessHoursRecord(spring, "2026-03-08T08:30:00.000Z").status, "OPEN_VERIFIED");
  const fall = baseRecord({
    hoursVerifiedAt: "2026-10-31T12:00:00.000Z",
    sourceRetrievedAt: "2026-10-31T12:00:00.000Z",
    regularWeeklyBusinessHours: {
      periods: [weeklyPeriod(0, 1, 0, 0, 2, 0)],
      sourceOpenNowAtRetrieval: null
    }
  });
  assert.equal(evaluateBusinessHoursRecord(fall, "2026-11-01T07:30:00.000Z").status, "OPEN_VERIFIED");
});

test("provider normalization preserves provenance and nullable source values", () => {
  const normalized = normalizeGoogleBusinessHours({
    candidate: candidate(),
    place: {
      id: "place-fixture-1",
      displayName: { text: "Fixture Business" },
      formattedAddress: "100 Main St, Houston, TX 77002, USA",
      businessStatus: "OPERATIONAL",
      timeZone: { id: "America/Chicago" },
      regularOpeningHours: { periods: [] }
    },
    retrievedAt: VERIFIED_AT,
    evaluatedAt: MONDAY_OPEN,
    fieldMask: GOOGLE_BUSINESS_HOURS_FIELD_MASK,
    fieldEvidence: [{ evidenceId: "field-evidence-1" }]
  });
  assert.equal(normalized.sourceRetrievedAt, VERIFIED_AT);
  assert.equal(normalized.hoursVerifiedAt, VERIFIED_AT);
  assert.equal(normalized.lastSuccessfulRefreshAt, VERIFIED_AT);
  assert.equal(normalized.lastFailedRefreshAt, null);
  assert.equal(normalized.hoursProvenance.sourcePlaceId, "place-fixture-1");
  assert.deepEqual(normalized.hoursProvenance.fieldEvidenceIds, ["field-evidence-1"]);
  assert.equal(normalized.regularWeeklyBusinessHours.sourceOpenNowAtRetrieval, null);
});

test("provider hours objects without periods remain unknown instead of closed", () => {
  const normalized = normalizeGoogleBusinessHours({
    candidate: candidate(),
    place: {
      id: "place-fixture-1",
      displayName: { text: "Fixture Business" },
      formattedAddress: "100 Main St, Houston, TX 77002, USA",
      businessStatus: "OPERATIONAL",
      timeZone: { id: "America/Chicago" },
      regularOpeningHours: { openNow: false },
      currentOpeningHours: { openNow: false }
    },
    retrievedAt: VERIFIED_AT,
    evaluatedAt: MONDAY_OPEN,
    fieldMask: GOOGLE_BUSINESS_HOURS_FIELD_MASK
  });
  assert.equal(normalized.regularWeeklyBusinessHours.periods, null);
  assert.equal(normalized.currentOpeningHoursWindow.periods, null);
  assert.equal(normalized.hoursVerifiedAt, null);
  assert.equal(normalized.currentOpenClosedEligibilityStatus, "HOURS_UNKNOWN");
});

test("workspace isolation rejects contamination and unknown workspaces", () => {
  assert.throws(() => assertBusinessHoursWorkspace("unknown_workspace"), error => error.code === "business_hours_unknown_workspace");
  const contaminated = artifactFor({ ...baseRecord(), workspaceId: "unauthorized_workspace" });
  assert(validateBusinessHoursArtifact(contaminated).some(failure => failure.includes("Cross-workspace")));
});

test("missing provider bindings fail closed", () => {
  assert.throws(
    () => resolveGoogleBusinessHoursApiKey({}),
    error => error.code === "business_hours_provider_binding_missing"
  );
});

test("field evidence must match a verified production Place ID and identity", () => {
  const evidence = {
    workspaceId: "fitness_connection",
    evidence: [{
      evidenceId: "evidence-1",
      workspaceId: "fitness_connection",
      googlePlaceId: "place-fixture-1",
      businessName: "Fixture Business",
      address: "100 Main St, Houston, TX 77002, USA"
    }]
  };
  assert.equal(validateBusinessHoursFieldEvidence(evidence, [candidate()], "fitness_connection").length, 1);
  assert.throws(
    () => validateBusinessHoursFieldEvidence({ ...evidence, evidence: [{ ...evidence.evidence[0], googlePlaceId: "invented" }] }, [candidate()], "fitness_connection"),
    error => error.code === "business_hours_evidence_place_id_unverified"
  );
});

test("refresh failures preserve the last verified schedule and provenance", () => {
  const previous = baseRecord();
  const preserved = preserveBusinessHoursAfterRefreshFailure({
    candidate: candidate({ business_status: "CLOSED_PERMANENTLY" }),
    previousRecord: previous,
    failedAt: "2026-07-14T13:00:00.000Z",
    evaluatedAt: "2026-07-14T13:00:00.000Z",
    failure: Object.assign(new Error("temporary provider failure"), { code: "provider_temporary" })
  });
  assert.deepEqual(preserved.regularWeeklyBusinessHours, previous.regularWeeklyBusinessHours);
  assert.deepEqual(preserved.hoursProvenance, previous.hoursProvenance);
  assert.equal(preserved.hoursVerifiedAt, previous.hoursVerifiedAt);
  assert.equal(preserved.lastSuccessfulRefreshAt, previous.lastSuccessfulRefreshAt);
  assert.equal(preserved.permanentOperationalStatus, previous.permanentOperationalStatus);
  assert.equal(preserved.lastFailedRefreshAt, "2026-07-14T13:00:00.000Z");
  assert.equal(preserved.refreshFailure.code, "provider_temporary");
  assert.equal(preserved.currentOpenClosedEligibilityStatus, "HOURS_STALE");
});

test("offline recalculation is deterministic and enforces the 24-hour ceiling", () => {
  const recalculated = recalculateBusinessHoursArtifact(artifactFor(baseRecord()), "2026-07-23T12:00:00.000Z", {
    activePlaceIds: new Set()
  });
  assert.equal(recalculated.generatedAt, "2026-07-23T12:00:00.000Z");
  assert.equal(recalculated.freshnessPolicy.freshnessThresholdHours, 24);
  assert.equal(recalculated.records[0].activePoolMember, false);
  assert.equal(recalculated.records[0].currentOpenClosedEligibilityStatus, "HOURS_STALE");
});

test("evaluate-only command is non-mutating unless the explicit write flag is present", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "prometheus-business-hours-evaluate-"));
  const outputPath = path.join(root, "business-hours.json");
  const activePoolPath = path.join(root, "active-pool.json");
  fs.copyFileSync(BUSINESS_HOURS_ARTIFACT, outputPath);
  fs.writeFileSync(activePoolPath, JSON.stringify({ records: [] }));
  const before = fs.readFileSync(outputPath);
  const readOnly = spawnSync(process.execPath, [
    "scripts/refresh-google-business-hours.mjs",
    "--evaluate-only",
    `--output=${outputPath}`,
    `--active-pool=${activePoolPath}`,
    "--at=2026-07-24T12:00:00.000Z"
  ], { cwd: process.cwd(), encoding: "utf8" });
  assert.equal(readOnly.status, 0, readOnly.stderr);
  assert.equal(JSON.parse(readOnly.stdout).writePerformed, false);
  assert.deepEqual(fs.readFileSync(outputPath), before);
  const write = spawnSync(process.execPath, [
    "scripts/refresh-google-business-hours.mjs",
    "--evaluate-only",
    "--write",
    `--output=${outputPath}`,
    `--active-pool=${activePoolPath}`,
    "--at=2026-07-24T12:00:00.000Z"
  ], { cwd: process.cwd(), encoding: "utf8" });
  assert.equal(write.status, 0, write.stderr);
  assert.equal(JSON.parse(write.stdout).writePerformed, true);
  assert.notDeepEqual(fs.readFileSync(outputPath), before);
});

test("business-hours artifacts persist across a separate runtime write/read", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "prometheus-business-hours-"));
  const filePath = path.join(root, "business-hours.json");
  const record = baseRecord({
    currentOpenClosedEligibilityStatus: "OPEN_VERIFIED",
    currentStatusReasonCode: "VERIFIED_REGULAR_PERIOD_OPEN",
    currentStatusReason: "Verified open.",
    currentStatusEvaluatedAt: MONDAY_OPEN,
    currentStatusBusinessLocalDate: "2026-07-13",
    currentStatusBusinessLocalTime: "10:00"
  });
  writeBusinessHoursArtifactAtomic(filePath, artifactFor(record));
  const child = spawnSync(process.execPath, [
    "--input-type=module",
    "-e",
    `import { readBusinessHoursArtifact } from "./scripts/lib/business-hours-governance.mjs"; const artifact = readBusinessHoursArtifact(${JSON.stringify(filePath)}, "fitness_connection"); console.log(JSON.stringify({ count: artifact.recordCount, status: artifact.records[0].currentOpenClosedEligibilityStatus, provenance: artifact.records[0].hoursProvenance.sourcePlaceId }));`
  ], { cwd: process.cwd(), encoding: "utf8" });
  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(JSON.parse(child.stdout), { count: 1, status: "OPEN_VERIFIED", provenance: "place-fixture-1" });
  const readBack = readBusinessHoursArtifact(filePath);
  assert.equal(readBack.records[0].hoursVerifiedAt, VERIFIED_AT);
});

test("production artifact honestly records the reported business as operational and stale", () => {
  const artifact = readBusinessHoursArtifact(BUSINESS_HOURS_ARTIFACT);
  const record = artifact.records.find(item => item.googlePlaceId === "ChIJiduac7LCQIYR-sGBtIAjKR0");
  assert(record, "Expected the verified Christian Brothers Automotive Place ID in the hours artifact.");
  assert.equal(record.businessName, "Christian Brothers Automotive Pearland");
  assert.equal(record.permanentOperationalStatus, "OPERATIONAL");
  assert.equal(record.currentOpenClosedEligibilityStatus, "HOURS_STALE");
  assert.equal(record.currentAvailabilityDisplay, "Hours outdated · verification required");
  assert.equal(record.businessTimezone, "America/Chicago");
  assert.ok(record.hoursProvenance.fieldEvidenceIds.includes("fitness-2026-07-11-christian-brothers-closed-observation"));
});

test("existing Data governance and canonical availability validation remain passing", () => {
  const governance = runGovernance({ writeReports: false });
  assert.equal(governance.status, "passed", JSON.stringify(governance.failures));
  const artifact = readBusinessHoursArtifact(BUSINESS_HOURS_ARTIFACT);
  assert.deepEqual(validateBusinessHoursArtifact(artifact), []);
});
