import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildCurrentGoldenBaseline,
  defaultPaths,
  expandActivePool,
  generateGoldenRoute,
  runRouteIntelligenceQualityGate
} from "../scripts/lib/route-intelligence-quality-gate.mjs";

const root = resolve(import.meta.dirname, "..");
const readJson = path => JSON.parse(readFileSync(resolve(root, path), "utf8"));
const clone = value => JSON.parse(JSON.stringify(value));

function fixtures() {
  const activePool = readJson(defaultPaths.activePool);
  return {
    activePool,
    reservePool: readJson(defaultPaths.reservePool),
    quarantinePool: readJson(defaultPaths.quarantinePool),
    governanceReport: readJson(defaultPaths.governanceReport),
    promotionGate: readJson(defaultPaths.promotionGate),
    expectedBaseline: readJson(defaultPaths.goldenBaseline),
    businessHoursArtifact: readJson(defaultPaths.businessHoursArtifact),
    businessHoursDataContract: readJson(defaultPaths.businessHoursDataContract),
    businessHoursIntelligenceContract: readJson(defaultPaths.businessHoursIntelligenceContract),
    fitnessIntelligenceConsumerContract: readJson(defaultPaths.fitnessIntelligenceConsumerContract),
    canonicalArtifactRegistry: readJson(defaultPaths.canonicalArtifactRegistry)
  };
}

function runWith(overrides = {}) {
  return runRouteIntelligenceQualityGate({
    ...fixtures(),
    ...overrides,
    runZeroGoogleCheck: false
  });
}

test("golden route generation is stable for identical Active Pool inputs", () => {
  const { activePool } = fixtures();
  const { routeRecords } = expandActivePool(activePool);
  const first = generateGoldenRoute(routeRecords, "anthony");
  const second = generateGoldenRoute(routeRecords, "anthony");
  const third = generateGoldenRoute(routeRecords, "anthony");

  assert.deepEqual(second.map(item => item.id), first.map(item => item.id));
  assert.deepEqual(third.map(item => item.id), first.map(item => item.id));
  assert.equal(new Set(first.map(item => item.googlePlaceId)).size, first.length);
});

test("quality gate passes for the reviewed golden Active Pool baseline", () => {
  const result = runWith();

  assert.equal(result.passed, true, result.report.failureReasons.join("; "));
  assert.equal(result.report.routeStability.status, "passed");
  assert.equal(result.report.candidateValidation.status, "passed");
  assert.equal(result.report.orderingConsistency.status, "passed");
  assert.equal(result.report.dashboardCompatibility.status, "passed");
  assert.equal(result.report.businessHoursEligibility.status, "passed");
  assert.equal(result.report.businessHoursEligibility.implementation.recordCount, 398);
  assert.equal(result.report.businessHoursEligibility.canonicalConsumer.registered, true);
  assert.equal(result.report.businessHoursEligibility.canonicalConsumer.identifierResolved, true);
  assert.equal(result.report.businessHoursEligibility.canonicalConsumer.requiredReadPathsPresent, true);
  assert.equal(result.report.businessHoursEligibility.statusPolicies.OPEN_VERIFIED.eligible, true);
  assert.equal(result.report.businessHoursEligibility.statusPolicies.CLOSED_VERIFIED.eligible, false);
  for (const status of ["HOURS_UNKNOWN", "HOURS_STALE", "SPECIAL_HOURS_UNVERIFIED"]) {
    assert.equal(result.report.businessHoursEligibility.statusPolicies[status].coverageOnly, true);
    assert.equal(result.report.businessHoursEligibility.statusPolicies[status].internalMarker, "HOURS_NOT_VERIFIED");
  }
  assert.equal(result.report.businessHoursEligibility.christianBrothersRegression.status, "passed");
  assert.equal(result.report.businessHoursEligibility.queueValidation.initialStopCount, 15);
  assert.equal(result.report.businessHoursEligibility.queueValidation.replenishmentThreshold, 5);
  assert.equal(result.report.businessHoursEligibility.queueValidation.replenishedStopCount, 15);
  assert.equal(result.report.businessHoursEligibility.queueValidation.fullPoolFallbackExercised, true);
  assert.equal(result.report.businessHoursEligibility.queueValidation.routeScoresUnchanged, true);
  assert.equal(result.report.businessHoursEligibility.explainability.status, "passed");
  assert.equal(result.report.runtimeSurface.status, "skipped");
});

test("quality gate fails when a quarantined business appears in Active recommendations", () => {
  const current = fixtures();
  const activePool = clone(current.activePool);
  const quarantineCandidate = current.quarantinePool.records.find(record => record.runtimeProfiles?.length);
  assert.ok(quarantineCandidate, "fixture needs a quarantined record with runtime profiles");

  const injected = clone(quarantineCandidate);
  injected.qualityClass = "Excellent";
  injected.qualityScore = 99;
  injected.priority = 99;
  injected.poolAssignmentReasons = ["test_injected_quarantine_record"];
  injected.runtimeProfiles = injected.runtimeProfiles.map(profile => ({
    ...profile,
    qualityClass: "Excellent",
    qualityScore: 99,
    priority: 99,
    seedRouteOrder: 1
  }));
  activePool.records.unshift(injected);
  activePool.count = activePool.records.length;

  const result = runWith({ activePool });

  assert.equal(result.passed, false);
  assert.ok(result.report.failureReasons.some(reason => reason.includes("active_quarantine_overlap")));
});

test("quality gate detects golden route order drift", () => {
  const current = fixtures();
  const activePool = clone(current.activePool);
  const anthonyCandidate = activePool.records.find(record => record.runtimeProfiles?.some(profile => profile.repProfileId === "anthony"));
  assert.ok(anthonyCandidate, "fixture needs an Anthony runtime profile");

  anthonyCandidate.qualityScore = 100;
  anthonyCandidate.priority = 100;
  anthonyCandidate.runtimeProfiles = anthonyCandidate.runtimeProfiles.map(profile => profile.repProfileId === "anthony"
    ? { ...profile, qualityScore: 100, priority: 100, seedRouteOrder: 1 }
    : profile);

  const result = runWith({ activePool });

  assert.equal(result.passed, false);
  assert.ok(result.report.failureReasons.some(reason => reason.includes("golden_route_order_or_membership_changed")));
});

test("quality gate fails when the canonical business-hours Intelligence consumer is unregistered", () => {
  const current = fixtures();
  const canonicalArtifactRegistry = clone(current.canonicalArtifactRegistry);
  const fitnessWorkspace = canonicalArtifactRegistry.workspaces.find(workspace => workspace.workspaceId === "fitness_connection");
  fitnessWorkspace.canonicalArtifacts = fitnessWorkspace.canonicalArtifacts.filter(
    artifact => artifact.artifactId !== "fitness_connection_route_business_hours_intelligence_consumer_contract"
  );

  const result = runWith({ canonicalArtifactRegistry });

  assert.equal(result.passed, false);
  assert.ok(result.report.failureReasons.includes("business_hours:business_hours_consumer_not_registered"));
});

test("incomplete runtime profile rows are skipped without crashing route generation", () => {
  const current = fixtures();
  const activePool = clone(current.activePool);
  const record = activePool.records.find(item => item.runtimeProfiles?.length);
  assert.ok(record, "fixture needs runtime profiles");
  record.runtimeProfiles = [];

  const result = runWith({
    activePool,
    expectedBaseline: buildCurrentGoldenBaseline({ activePool })
  });

  assert.equal(result.passed, true, result.report.failureReasons.join("; "));
  assert.ok(result.report.incompleteDataHandling.skippedRuntimeProfiles >= 1);
  assert.equal(result.report.incompleteDataHandling.status, "passed");
});
