import assert from "node:assert/strict";
import fs from "node:fs";
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
  routeBusinessHoursEligibilityVersion,
  summarizeRouteBusinessHours
} from "../intelligence/route-business-hours-eligibility.mjs";

const artifactPath = new URL("../data/qualified-prospects/google-qualified-businesses-v2/business-hours-v1/business-hours.json", import.meta.url);
const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
const index = buildRouteBusinessHoursIndex(artifact);
const evaluatedAt = artifact.statusEvaluatedAt;
const christianPlaceId = "ChIJiduac7LCQIYR-sGBtIAjKR0";
const christianRecord = index.recordsByPlaceId.get(christianPlaceId);

function decisionFor(record, overrides = {}) {
  return evaluateRouteBusinessHoursEligibility({
    record,
    evaluatedAt,
    policy: index.freshnessPolicy,
    ...overrides
  });
}

const openRecords = artifact.records.filter(record => record.activePoolMember && decisionFor(record).status === "OPEN_VERIFIED");
const unknownRecord = artifact.records.find(record => decisionFor(record).status === "HOURS_UNKNOWN");

function candidate(record, score, overrides = {}) {
  return {
    id: `route-${record.googlePlaceId}`,
    googlePlaceId: record.googlePlaceId,
    name: record.businessName,
    address: record.address,
    workspaceId: record.workspaceId,
    score,
    record,
    eligible: true,
    ...overrides
  };
}

function maintainWithHours({ queue = null, primaryCandidates = [], fallbackCandidates = [], completedIdentityKeys = [], targetSize = 15 } = {}) {
  const scopedQueue = queue || createEmptyRouteQueue({
    workspaceId: "fitness_connection",
    representativeId: "cruz",
    operatingProfileId: "fitness",
    routeDate: "2026-07-11",
    targetSize,
    threshold: Math.min(5, targetSize)
  });
  return maintainRouteQueue({
    queue: scopedQueue,
    workspaceId: "fitness_connection",
    representativeId: "cruz",
    operatingProfileId: "fitness",
    routeDate: "2026-07-11",
    primaryCandidates,
    fallbackCandidates,
    completedIdentityKeys,
    force: true,
    trigger: "business-hours-regression",
    identityOf: routeQueueIdentity,
    isEligible: place => place.eligible && decisionFor(place.record).eligible,
    scoreCandidate: place => applyHoursEligibilityToScore({ score: place.score, signals: ["existing route intelligence"] }, decisionFor(place.record)),
    now: evaluatedAt
  });
}

test("business-hours artifact is indexed under the isolated Fitness Connection scope", () => {
  assert.equal(index.version, routeBusinessHoursEligibilityVersion);
  assert.equal(index.workspaceId, "fitness_connection");
  assert.equal(index.operatingProfileId, "fitness");
  assert.equal(index.recordCount, 398);
  assert.equal(index.recordsByPlaceId.size, artifact.recordCount);
});

test("OPEN_VERIFIED remains eligible without changing its recommendation score", () => {
  const eligibility = decisionFor(openRecords[0]);
  const ranked = applyHoursEligibilityToScore({ score: 87.625, influence: 2.5, signals: ["existing evidence"] }, eligibility);
  assert.equal(eligibility.status, "OPEN_VERIFIED");
  assert.equal(eligibility.eligible, true);
  assert.equal(eligibility.selectionTier, 0);
  assert.equal(eligibility.internalMarker, null);
  assert.equal(ranked.score, 87.625);
  assert.equal(ranked.influence, 2.5);
  assert.equal(ranked.eligibility.scoringChanged, false);
});

test("Christian Brothers remains operational but is excluded during its verified closed period", () => {
  const eligibility = decisionFor(christianRecord);
  assert.equal(christianRecord.permanentOperationalStatus, "OPERATIONAL");
  assert.equal(eligibility.status, "CLOSED_VERIFIED");
  assert.equal(eligibility.eligible, false);
  assert.equal(eligibility.reasonCode, "VERIFIED_CURRENT_WINDOW_CLOSED");
  assert.ok(eligibility.reason.includes("closed"));
  assert.ok(eligibility.provenance.fieldEvidenceIds.includes("fitness-2026-07-11-christian-brothers-closed-observation"));
});

test("closed businesses cannot enter the initial 15-stop queue and an open alternative is selected", () => {
  assert.ok(openRecords.length >= 15);
  const primaryCandidates = [
    candidate(christianRecord, 1000),
    ...openRecords.slice(0, 15).map((record, position) => candidate(record, 100 - position))
  ];
  const result = maintainWithHours({ primaryCandidates });
  assert.equal(result.queue.entries.length, 15);
  assert.equal(result.queue.entries.some(entry => entry.identityKey === `google:${christianPlaceId}`), false);
  assert.equal(result.queue.entries.every(entry => entry.eligibilitySnapshot?.status === "OPEN_VERIFIED"), true);
  assert.equal(result.queue.entries[0].scoreSnapshot, 100);
});

test("adaptive replenishment re-evaluates and skips a closed replacement candidate", () => {
  const initialCandidates = openRecords.slice(0, 15).map((record, position) => candidate(record, 100 - position));
  const initial = maintainWithHours({ primaryCandidates: initialCandidates });
  const completedIdentity = initial.queue.entries[0].identityKey;
  const replacement = candidate(openRecords[15], 1);
  const replenished = maintainWithHours({
    queue: initial.queue,
    primaryCandidates: [candidate(christianRecord, 1000), ...initialCandidates, replacement],
    completedIdentityKeys: [completedIdentity]
  });
  assert.equal(replenished.queue.entries.length, 15);
  assert.equal(replenished.queue.entries.some(entry => entry.identityKey === completedIdentity), false);
  assert.equal(replenished.queue.entries.some(entry => entry.identityKey === `google:${christianPlaceId}`), false);
  assert.equal(replenished.queue.entries.at(-1).identityKey, routeQueueIdentity(replacement));
  assert.equal(new Set(replenished.queue.entries.map(entry => entry.identityKey)).size, 15);
});

test("HOURS_UNKNOWN is coverage-only and is never represented as verified open", () => {
  assert.ok(unknownRecord);
  const eligibility = decisionFor(unknownRecord);
  assert.equal(eligibility.status, "HOURS_UNKNOWN");
  assert.equal(eligibility.eligible, true);
  assert.equal(eligibility.coverageOnly, true);
  assert.equal(eligibility.internalMarker, hoursNotVerifiedMarker);
  assert.equal(eligibility.displayLabel, "Hours not verified");
  assert.notEqual(eligibility.displayLabel, "Verified open");
});

test("a missing governed record remains attributable to the candidate identity", () => {
  const eligibility = evaluateRouteBusinessHoursEligibility({
    candidate: {
      googlePlaceId: "missing-hours-place-id",
      workspaceId: "fitness_connection",
      operatingProfileId: "fitness",
      businessStatus: "OPERATIONAL"
    },
    evaluatedAt,
    artifactAvailable: true
  });
  assert.equal(eligibility.status, "HOURS_UNKNOWN");
  assert.equal(eligibility.eligible, true);
  assert.equal(eligibility.googlePlaceId, "missing-hours-place-id");
  assert.equal(eligibility.reasonCode, "BUSINESS_HOURS_RECORD_UNAVAILABLE");
});

test("HOURS_STALE remains coverage-only and preserves an attributable stale reason", () => {
  const staleRecord = { ...openRecords[0], hoursVerifiedAt: "2026-06-01T00:00:00.000Z" };
  const eligibility = decisionFor(staleRecord);
  assert.equal(eligibility.status, "HOURS_STALE");
  assert.equal(eligibility.eligible, true);
  assert.equal(eligibility.selectionTier, 1);
  assert.equal(eligibility.internalMarker, hoursNotVerifiedMarker);
  assert.equal(eligibility.reasonCode, "HOURS_SOURCE_STALE");
});

test("SPECIAL_HOURS_UNVERIFIED remains uncertain and is not silently converted to open", () => {
  const specialRecord = {
    ...openRecords[0],
    specialOrHolidayHours: [{
      date: "2026-07-11",
      verificationStatus: "UNVERIFIED",
      periods: null,
      source: "GOOGLE_PLACES_CURRENT_OPENING_HOURS"
    }]
  };
  const eligibility = decisionFor(specialRecord);
  assert.equal(eligibility.status, "SPECIAL_HOURS_UNVERIFIED");
  assert.equal(eligibility.eligible, true);
  assert.equal(eligibility.internalMarker, hoursNotVerifiedMarker);
  assert.equal(eligibility.reasonCode, "SPECIAL_HOURS_NOT_VERIFIED");
});

test("verified-open fallback candidates are selected before uncertain Active Pool coverage", () => {
  const activeOpen = candidate(openRecords[0], 10);
  const activeUnknown = candidate(unknownRecord, 999);
  const fallbackOpen = candidate(openRecords[1], 5, { id: `fallback-${openRecords[1].googlePlaceId}` });
  const result = maintainWithHours({
    primaryCandidates: [activeUnknown, activeOpen],
    fallbackCandidates: [fallbackOpen],
    targetSize: 3
  });
  assert.deepEqual(result.queue.entries.map(entry => entry.identityKey), [
    routeQueueIdentity(activeOpen),
    routeQueueIdentity(fallbackOpen),
    routeQueueIdentity(activeUnknown)
  ]);
  assert.deepEqual(result.queue.entries.map(entry => entry.sourcePool), ["active", "full", "active"]);
  assert.equal(result.queue.entries.at(-1).eligibilitySnapshot.internalMarker, hoursNotVerifiedMarker);
});

test("completed-stop exclusion and duplicate prevention remain active with hours eligibility", () => {
  const open = candidate(openRecords[0], 10);
  const duplicate = { ...open, id: "duplicate-runtime-id", score: 1000 };
  const result = maintainWithHours({
    primaryCandidates: [open, duplicate],
    completedIdentityKeys: [routeQueueIdentity(open)],
    targetSize: 2
  });
  assert.equal(result.queue.entries.length, 0);
  assert.equal(result.exhausted, true);
});

test("an all-closed eligible pool produces a safe exhausted state", () => {
  const result = maintainWithHours({ primaryCandidates: [candidate(christianRecord, 1000)], targetSize: 1 });
  assert.equal(result.exhausted, true);
  assert.equal(result.queue.state, "exhausted");
  assert.equal(result.queue.entries.length, 0);
});

test("missing artifacts and cross-workspace records fail closed", () => {
  const artifactMissing = evaluateRouteBusinessHoursEligibility({
    record: openRecords[0],
    evaluatedAt,
    artifactAvailable: false
  });
  const crossWorkspace = evaluateRouteBusinessHoursEligibility({
    record: { ...openRecords[0], workspaceId: "smoothie_depot" },
    evaluatedAt
  });
  const unknownWorkspace = evaluateRouteBusinessHoursEligibility({
    record: openRecords[0],
    evaluatedAt,
    workspaceId: "unknown_workspace"
  });
  assert.equal(artifactMissing.eligible, false);
  assert.equal(artifactMissing.failClosed, true);
  assert.equal(crossWorkspace.eligible, false);
  assert.equal(crossWorkspace.reasonCode, "HOURS_RECORD_SCOPE_MISMATCH");
  assert.equal(unknownWorkspace.eligible, false);
  assert.equal(unknownWorkspace.reasonCode, "HOURS_WORKSPACE_SCOPE_REJECTED");
});

test("hours explanation keeps score, eligibility, confidence, freshness, reason, and provenance separate", () => {
  const eligibility = decisionFor(openRecords[0]);
  assert.equal(eligibility.explanation.recommendationScore, "UNCHANGED");
  assert.equal(eligibility.explanation.businessHoursEligibility, "OPEN_VERIFIED");
  assert.equal(eligibility.explanation.hoursConfidence, eligibility.hoursConfidence);
  assert.equal(eligibility.explanation.hoursFreshness, eligibility.hoursFreshness);
  assert.equal(eligibility.explanation.reasonCode, eligibility.reasonCode);
  assert.ok(eligibility.explanation.reason.length > 20);
  assert.equal(eligibility.explanation.provenance.sourcePlaceId, openRecords[0].googlePlaceId);
});

test("queue serialization preserves additive hours metadata for Dashboard and Mobile consumers", () => {
  const result = maintainWithHours({ primaryCandidates: [candidate(openRecords[0], 50)], targetSize: 1 });
  const serialized = JSON.parse(JSON.stringify(serializeRouteQueue(result.queue)));
  assert.equal(serialized.entries[0].eligibilitySnapshot.status, "OPEN_VERIFIED");
  assert.equal(serialized.entries[0].eligibilitySnapshot.scoringChanged, false);
  assert.equal(serialized.entries[0].scoreSnapshot, 50);
  assert.equal(serialized.entries[0].placeId, `route-${openRecords[0].googlePlaceId}`);
  assert.equal(serialized.entries[0].identityKey, `google:${openRecords[0].googlePlaceId}`);
});

test("hours summaries report uncertain and excluded decisions without false open claims", () => {
  const summary = summarizeRouteBusinessHours([
    decisionFor(openRecords[0]),
    decisionFor(christianRecord),
    decisionFor(unknownRecord)
  ]);
  assert.equal(summary.evaluated, 3);
  assert.equal(summary.eligible, 2);
  assert.equal(summary.excluded, 1);
  assert.equal(summary.hoursUnverified, 1);
  assert.equal(summary.statuses.OPEN_VERIFIED, 1);
  assert.equal(summary.statuses.CLOSED_VERIFIED, 1);
  assert.equal(summary.statuses.HOURS_UNKNOWN, 1);
});
