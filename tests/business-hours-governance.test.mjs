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
  preserveBusinessHoursAfterRefreshFailure,
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
import { verifyCrossSubsystemArtifactContracts } from "../scripts/verify-cross-subsystem-artifact-contracts.mjs";

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
    ...overrides
  };
}

function artifactFor(record) {
  return {
    schemaVersion: "prometheus-data-business-hours-v1",
    artifactVersion: "business-hours-v1",
    generatedAt: MONDAY_OPEN,
    statusEvaluatedAt: MONDAY_OPEN,
    sourceRetrievedAt: VERIFIED_AT,
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    protectedWorkspaceIds: ["smoothie_depot"],
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
});

test("verified closed hours produce CLOSED_VERIFIED", () => {
  const result = evaluateBusinessHoursRecord(baseRecord(), MONDAY_CLOSED);
  assert.equal(result.status, "CLOSED_VERIFIED");
  assert.equal(result.reasonCode, "VERIFIED_REGULAR_PERIOD_CLOSED");
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
  const staleAt = "2026-07-21T13:00:00.000Z";
  const result = evaluateBusinessHoursRecord(baseRecord(), staleAt);
  assert.equal(result.status, "HOURS_STALE");
  assert.equal(result.hoursFreshnessStatus, "STALE");
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
  const contaminated = artifactFor({ ...baseRecord(), workspaceId: "smoothie_depot" });
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
    failedAt: "2026-07-14T12:00:00.000Z",
    evaluatedAt: "2026-07-14T12:00:00.000Z",
    failure: Object.assign(new Error("temporary provider failure"), { code: "provider_temporary" })
  });
  assert.deepEqual(preserved.regularWeeklyBusinessHours, previous.regularWeeklyBusinessHours);
  assert.deepEqual(preserved.hoursProvenance, previous.hoursProvenance);
  assert.equal(preserved.hoursVerifiedAt, previous.hoursVerifiedAt);
  assert.equal(preserved.lastSuccessfulRefreshAt, previous.lastSuccessfulRefreshAt);
  assert.equal(preserved.permanentOperationalStatus, previous.permanentOperationalStatus);
  assert.equal(preserved.lastFailedRefreshAt, "2026-07-14T12:00:00.000Z");
  assert.equal(preserved.refreshFailure.code, "provider_temporary");
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

test("production artifact records the reported business as operational and closed", () => {
  const artifact = readBusinessHoursArtifact(BUSINESS_HOURS_ARTIFACT);
  const record = artifact.records.find(item => item.googlePlaceId === "ChIJiduac7LCQIYR-sGBtIAjKR0");
  assert(record, "Expected the verified Christian Brothers Automotive Place ID in the hours artifact.");
  assert.equal(record.businessName, "Christian Brothers Automotive Pearland");
  assert.equal(record.permanentOperationalStatus, "OPERATIONAL");
  assert.equal(record.currentOpenClosedEligibilityStatus, "CLOSED_VERIFIED");
  assert.equal(record.businessTimezone, "America/Chicago");
  assert.ok(record.hoursProvenance.fieldEvidenceIds.includes("fitness-2026-07-11-christian-brothers-closed-observation"));
});

test("existing Data governance and canonical contract validation remain passing", () => {
  const governance = runGovernance({ writeReports: false });
  assert.equal(governance.status, "passed", JSON.stringify(governance.failures));
  const contracts = verifyCrossSubsystemArtifactContracts();
  assert.equal(contracts.ok, true, contracts.failures.join("\n"));
});
