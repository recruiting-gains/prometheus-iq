import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import {
  defaultPaths,
  expandActivePool,
  generateGoldenRoute,
  gateVersion,
  requiredBusinessHoursContractVersion,
  requiredBusinessHoursRuntimeVersion,
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
    canonicalArtifactRegistry: readJson(defaultPaths.canonicalArtifactRegistry),
    workspaceConfigurationRegistry: readJson(defaultPaths.workspaceConfigurationRegistry),
    workspaceBusinessManifestRegistry: readJson(defaultPaths.workspaceBusinessManifestRegistry)
  };
}

function runWith(overrides = {}) {
  return runRouteIntelligenceQualityGate({
    ...fixtures(),
    ...overrides,
    evaluatedAt: overrides.evaluatedAt ?? "2026-07-23T12:00:00.000Z",
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
  assert.equal(result.report.artifactGovernance.owningSubsystem, "Prometheus Data");
  assert.equal(result.report.artifactGovernance.verificationWritesCanonicalArtifacts, false);
  assert.equal(result.report.artifactGovernance.canonicalWritesRequireExplicitGeneration, true);
  assert.equal(result.report.candidateValidation.status, "passed");
  assert.equal(result.report.orderingConsistency.status, "passed");
  assert.equal(result.report.dashboardCompatibility.status, "passed");
  assert.equal(result.report.businessHoursEligibility.status, "passed");
  assert.equal(result.report.businessHoursEligibility.implementation.recordCount, 398);
  assert.equal(gateVersion, "route-intelligence-golden-route-quality-gate-v2");
  assert.equal(
    result.report.businessHoursEligibility.implementation.eligibilityVersion,
    requiredBusinessHoursRuntimeVersion
  );
  assert.equal(
    result.report.businessHoursEligibility.implementation.consumerContractVersion,
    requiredBusinessHoursContractVersion
  );
  assert.equal(result.report.businessHoursEligibility.canonicalConsumer.registered, true);
  assert.equal(result.report.businessHoursEligibility.canonicalConsumer.identifierResolved, true);
  assert.equal(result.report.businessHoursEligibility.canonicalConsumer.exactVersionRequired, true);
  assert.equal(result.report.businessHoursEligibility.canonicalConsumer.legacyRuntimeAccepted, false);
  assert.equal(result.report.businessHoursEligibility.canonicalConsumer.legacyContractAccepted, false);
  assert.equal(result.report.businessHoursEligibility.canonicalConsumer.requiredReadPathsPresent, true);
  assert.equal(
    result.report.businessHoursEligibility.canonicalConsumer.administrationBinding.schemaVersion,
    "route-iq-workspace-configuration-v2"
  );
  assert.equal(
    result.report.businessHoursEligibility.canonicalConsumer.manifestBinding.manifestVersion,
    "route-iq-workspace-business-artifact-manifest-v1"
  );
  assert.match(
    result.report.businessHoursEligibility.canonicalConsumer.manifestBinding.artifactSha256,
    /^[a-f0-9]{64}$/
  );
  assert.deepEqual(result.report.businessHoursEligibility.statusPolicies.sourceStatusCounts, {
    HOURS_STALE: 353,
    HOURS_UNKNOWN: 45
  });
  for (const status of ["HOURS_UNKNOWN", "HOURS_STALE"]) {
    assert.equal(result.report.businessHoursEligibility.statusPolicies[status].eligible, false);
    assert.equal(result.report.businessHoursEligibility.statusPolicies[status].coverageEligible, false);
    assert.equal(result.report.businessHoursEligibility.statusPolicies[status].immediateRecommendationEligible, false);
    assert.equal(result.report.businessHoursEligibility.statusPolicies[status].coverageOnly, false);
    assert.equal(result.report.businessHoursEligibility.statusPolicies[status].internalMarker, "HOURS_NOT_VERIFIED");
  }
  assert.equal(result.report.businessHoursEligibility.christianBrothersRegression.status, "passed");
  assert.equal(result.report.businessHoursEligibility.queueValidation.initialStopCount, 0);
  assert.equal(result.report.businessHoursEligibility.queueValidation.replenishmentThreshold, 5);
  assert.equal(result.report.businessHoursEligibility.queueValidation.blockedNoFreshApprovedCandidates, true);
  assert.equal(result.report.businessHoursEligibility.queueValidation.safeEmptyRouteAccepted, true);
  assert.equal(result.report.businessHoursEligibility.queueValidation.nonImmediateStatusCount, 0);
  assert.equal(result.report.businessHoursEligibility.queueValidation.routeScoresUnchanged, true);
  assert.equal(result.report.businessHoursEligibility.explainability.status, "passed");
  assert.equal(result.report.runtimeSurface.status, "skipped");
});

test("command-line verification is read-only and observes the current runtime surface", () => {
  const reportPath = resolve(root, defaultPaths.qualityReport);
  const before = readFileSync(reportPath, "utf8");
  const result = spawnSync(process.execPath, ["scripts/verify-route-intelligence-quality-gate.mjs"], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" }
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const output = JSON.parse(result.stdout);
  assert.equal(output.mode, "read_only_verification");
  assert.equal(output.canonicalReportWritten, false);
  assert.equal(output.checkedRuntimeFiles, 32);
  assert.equal(output.dashboardFetches, 10);
  assert.equal(readFileSync(reportPath, "utf8"), before);
});

test("canonical quality evidence matches the governed runtime surface", () => {
  const report = readJson(defaultPaths.qualityReport);

  assert.equal(report.status, "passed");
  assert.equal(report.artifactGovernance.owningSubsystem, "Prometheus Data");
  assert.equal(report.artifactGovernance.verificationWritesCanonicalArtifacts, false);
  assert.equal(report.runtimeSurface.status, "passed");
  assert.equal(report.runtimeSurface.checkedRuntimeFiles, 32);
  assert.equal(report.runtimeSurface.expectedRuntimeFiles, 32);
  assert.equal(report.runtimeSurface.dashboardFetches, 10);
  assert.equal(report.runtimeSurface.deployDashboardFetches, 10);
  assert.equal(report.runtimeSurface.expectedDashboardFetches, 10);
  assert.equal(report.runtimeSurface.sourceDeployFetchParity, true);
  assert.equal(report.runtimeSurface.liveGoogleApiCalls, 0);
  assert.equal(report.governanceReuse.runtimeBehaviorChanged, false);
  assert.equal(report.governanceReuse.scoringChanged, false);
  assert.equal(report.businessHoursEligibility.implementation.eligibilityVersion, requiredBusinessHoursRuntimeVersion);
  assert.equal(report.businessHoursEligibility.implementation.consumerContractVersion, requiredBusinessHoursContractVersion);
  assert.equal(report.businessHoursEligibility.canonicalConsumer.legacyRuntimeAccepted, false);
  assert.equal(report.businessHoursEligibility.canonicalConsumer.legacyContractAccepted, false);
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

test("quality gate detects golden route baseline drift even for a safe empty roster", () => {
  const current = fixtures();
  const expectedBaseline = clone(current.expectedBaseline);
  expectedBaseline.routes.cruz.route = [{
    googlePlaceId: "forged_place_id",
    id: "forged_route_record"
  }];

  const result = runWith({ expectedBaseline });

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

test("quality gate rejects superseded v1 business-hours runtime and contract identifiers", () => {
  const current = fixtures();
  const businessHoursIntelligenceContract = clone(current.businessHoursIntelligenceContract);
  businessHoursIntelligenceContract.version = "route-iq-closed-now-eligibility-contracts-v1";
  businessHoursIntelligenceContract.runtimeVersion = "route-iq-closed-now-eligibility-v1";
  businessHoursIntelligenceContract.compatibility = {
    ...businessHoursIntelligenceContract.compatibility,
    legacyRuntimeVersionAccepted: true,
    legacyContractVersionAccepted: true
  };

  const result = runWith({ businessHoursIntelligenceContract });

  assert.equal(result.passed, false);
  assert.ok(result.report.failureReasons.includes("business_hours:business_hours_consumer_contract_version_not_v2"));
  assert.ok(result.report.failureReasons.includes("business_hours:business_hours_consumer_runtime_pin_mismatch"));
  assert.ok(result.report.failureReasons.includes("business_hours:business_hours_legacy_runtime_accepted"));
  assert.ok(result.report.failureReasons.includes("business_hours:business_hours_legacy_contract_accepted"));
  assert.equal(result.report.businessHoursEligibility.canonicalConsumer.status, "failed");
});

test("quality gate fails closed when Administration and Data manifest provenance diverge", () => {
  const current = fixtures();
  const workspaceBusinessManifestRegistry = clone(current.workspaceBusinessManifestRegistry);
  workspaceBusinessManifestRegistry.manifests[0].manifestId = "tampered_fitness_manifest";

  const result = runWith({ workspaceBusinessManifestRegistry });

  assert.equal(result.passed, false);
  assert.ok(result.report.failureReasons.includes("business_hours:business_hours_administration_manifest_id_mismatch"));
  assert.ok(result.report.failureReasons.includes("business_hours:business_hours_active_pool_manifest_id_mismatch"));
  assert.ok(result.report.failureReasons.includes("business_hours:business_hours_governed_runtime_scope_invalid"));
});

test("quality gate uses the injected authoritative time rather than the artifact timestamp", () => {
  const current = fixtures();
  const businessHoursArtifact = clone(current.businessHoursArtifact);
  businessHoursArtifact.statusEvaluatedAt = "2026-07-11T12:00:00.000Z";
  const result = runWith({
    businessHoursArtifact,
    evaluatedAt: "2026-07-25T12:00:00.000Z"
  });

  assert.equal(result.passed, true, result.report.failureReasons.join("; "));
  assert.equal(
    result.report.businessHoursEligibility.implementation.sourceStatusEvaluatedAt,
    "2026-07-11T12:00:00.000Z"
  );
  assert.equal(
    result.report.businessHoursEligibility.implementation.authoritativeStatusEvaluatedAt,
    "2026-07-25T12:00:00.000Z"
  );
  assert.equal(result.report.businessHoursEligibility.queueValidation.initialStopCount, 0);
  assert.equal(result.report.businessHoursEligibility.queueValidation.safeEmptyRouteAccepted, true);
});

test("incomplete runtime profile rows are skipped without route-generation failure", () => {
  const current = fixtures();
  const record = clone(current.quarantinePool.records.find(item => item.runtimeProfiles?.length));
  assert.ok(record, "fixture needs runtime profiles");
  record.runtimeProfiles = [];
  const result = expandActivePool({ records: [record] });
  assert.equal(result.routeRecords.length, 0);
  assert.deepEqual(result.skipped, [{
    googlePlaceId: record.googlePlaceId,
    reason: "missing_runtime_profiles"
  }]);
});
