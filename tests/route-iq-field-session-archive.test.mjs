import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  FieldSessionArchiveError,
  FieldSessionConflictError,
  FieldSessionStoreBindingError,
  createCloudflareKvFieldSessionStore,
  createRouteIqFieldSessionArchivePackage,
  consumeRouteIqEndOfDayHandoff,
  deterministicFieldSessionId,
  fieldSessionStorageKeys,
  persistRouteIqFieldSessionArchive,
  readRouteIqFieldSessionArchive,
  routeIqEndOfDayHandoffContractId,
  routeIqFieldSessionArchiveVersion,
  routeIqFieldSessionStoreBinding,
  validateFieldSessionStoreBinding,
  validateFinalRouteIqReport
} from "../data/route-iq-field-sessions-v1/route-iq-field-session-archive.mjs";

const SESSION_ID = "route-iq-field-session-fitness-connection-fitness-cruz-2026-07-11";
const SESSION_ROOT = `data/route-iq-field-sessions-v1/workspaces/fitness_connection/sessions/${SESSION_ID}`;
const RAW_PATH = `${SESSION_ROOT}/raw/prometheus-iq-cruz-daily-report-2026-07-11.json`;
const NORMALIZED_PATH = `${SESSION_ROOT}/normalized/field-session.json`;
const CALCULATED_PATH = `${SESSION_ROOT}/normalized/calculated-metrics.json`;
const HISTORY_PATH = `${SESSION_ROOT}/normalized/history-updates.json`;
const FINDINGS_PATH = `${SESSION_ROOT}/evidence/stress-test-observations.json`;
const MANIFEST_PATH = `${SESSION_ROOT}/manifest.json`;
const SOURCE_EVIDENCE_PATH = "data/route-iq-field-sessions-v1/source-evidence/july-11-2026-founder-stress-test-findings.json";
const EXPECTED_RAW_SHA = "a62ec0643d61c8280e0e23dcd8616894a30a421dc9150281fb7cad334f5c0e6a";

function json(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function sha(value) {
  return createHash("sha256").update(value).digest("hex");
}

function kvBinding() {
  const data = new Map();
  const writes = [];
  return {
    data,
    writes,
    async get(key) {
      return data.get(key)?.value ?? null;
    },
    async put(key, value, options = {}) {
      data.set(key, { value: String(value), options });
      writes.push({ key, value: String(value), options });
    },
    async list(options = {}) {
      const prefix = options.prefix || "";
      return {
        keys: [...data.keys()].filter(key => key.startsWith(prefix)).sort().map(name => ({ name })),
        list_complete: true
      };
    }
  };
}

function packageInput(overrides = {}) {
  return {
    rawReportText: readFileSync(RAW_PATH, "utf8"),
    originalFileName: "prometheus-iq-cruz-daily-report-2026-07-11.json",
    canonicalRawArtifactPath: RAW_PATH,
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    finalExportConfirmed: true,
    finalityBasis: "Founder-designated final Today report.",
    ingestedAt: "2026-07-12T00:36:02.000Z",
    runtimePools: json("data/qualified-prospects/google-qualified-businesses-v2/runtime-pools.json"),
    activePool: json("data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/active-pool.json"),
    businessHours: json("data/qualified-prospects/google-qualified-businesses-v2/business-hours-v1/business-hours.json"),
    stressTestEvidence: json(SOURCE_EVIDENCE_PATH),
    ...overrides
  };
}

function archivePackage(overrides = {}) {
  return createRouteIqFieldSessionArchivePackage(packageInput(overrides));
}

test("actual Founder final report is archived with its exact bytes and deterministic identity", () => {
  const raw = readFileSync(RAW_PATH, "utf8");
  const manifest = json(MANIFEST_PATH);
  const result = validateFinalRouteIqReport(raw, {
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    finalExportConfirmed: true
  });

  assert.equal(sha(raw), EXPECTED_RAW_SHA);
  assert.equal(result.rawSha256, EXPECTED_RAW_SHA);
  assert.equal(result.rawByteLength, 1934);
  assert.equal(result.normalizedReport.generatedAt, "2026-07-12T00:25:44.676Z");
  assert.deepEqual(result.normalizedReport.totals, {
    visits: 4,
    conversations: 4,
    leads: 3,
    units: 0,
    laterUnits: 0
  });
  assert.equal(manifest.rawSha256, EXPECTED_RAW_SHA);
  assert.equal(manifest.sourceFinality, "founder_designated_final");
  assert.equal(deterministicFieldSessionId({
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    representativeId: "cruz",
    date: "2026-07-11"
  }), SESSION_ID);
});

test("unconfirmed exports fail before normalization so partial reports cannot substitute", () => {
  assert.throws(() => validateFinalRouteIqReport(readFileSync(RAW_PATH, "utf8"), {
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    finalExportConfirmed: false
  }), error => {
    assert.equal(error instanceof FieldSessionArchiveError, true);
    assert.equal(error.code, "field_session_final_export_unconfirmed");
    return true;
  });
});

test("normalized record preserves all four visits and exact governed identity joins", () => {
  const normalized = json(NORMALIZED_PATH);
  assert.equal(normalized.schemaVersion, routeIqFieldSessionArchiveVersion);
  assert.equal(normalized.handoffContractId, routeIqEndOfDayHandoffContractId);
  assert.equal(normalized.sessionId, SESSION_ID);
  assert.equal(normalized.verifiedFields.completedVisits.length, 4);
  assert.equal(normalized.verifiedFields.completedVisits.every(visit => visit.governedBusinessIdentity?.matchStatus === "exact_runtime_id"), true);
  assert.deepEqual(normalized.verifiedFields.completedVisits.map(visit => visit.governedBusinessIdentity.googlePlaceId), [
    "ChIJ5QnzguGXQIYRBj3DRt1qxSU",
    "ChIJG2VxAUibQIYR4ayVbntYkiY",
    "ChIJI13UBweRQIYRmwr6qAnoIz0",
    "ChIJiduac7LCQIYR-sGBtIAjKR0"
  ]);
  const christian = normalized.verifiedFields.completedVisits.find(visit => visit.sourceReport.placeName === "Christian Brothers Automotive Pearland");
  assert.equal(christian.sourceReport.notes, "Business was closed");
  assert.equal(christian.governedHoursSnapshot.status, "CLOSED_VERIFIED");
  assert.equal(christian.governedHoursSnapshot.statusAppliesAtVisitTimestamp, false);
});

test("missing export evidence remains unavailable and notes do not become inferred follow-ups", () => {
  const normalized = json(NORMALIZED_PATH);
  const expectedMissing = [
    "sessionStartTime",
    "sessionEndTime",
    "initialRoute",
    "completeRecommendationHistory",
    "recommendationScores",
    "recommendationExplanations",
    "routeReplenishmentEvents",
    "replacementRecommendations",
    "completedStopExclusionEvents",
    "duplicatePreventionEvents",
    "recommendationPoolSource",
    "territoryId",
    "distanceAndTravelMetrics",
    "observationTimestamps",
    "screenshots"
  ];
  for (const field of expectedMissing) assert.equal(normalized.unavailableFields.includes(field), true, field);
  assert.equal(normalized.verifiedFields.totals.totalStops, null);
  assert.equal(normalized.verifiedFields.totals.totalMemberships, null);
  const galachy = normalized.verifiedFields.completedVisits[0];
  assert.equal(galachy.sourceReport.notes, "Comeback today at 6pm");
  assert.equal(galachy.followUpRequirement, null);
  assert.equal(galachy.recommendationEvidence.recommendationScore, null);
  assert.equal(galachy.recommendationEvidence.recommendationExplanation, null);
});

test("verified values and calculated metrics are stored in separate records", () => {
  const normalized = json(NORMALIZED_PATH);
  const calculated = json(CALCULATED_PATH);
  assert.equal(normalized.recordKind, "verified_field_session");
  assert.equal(Object.hasOwn(normalized, "calculations"), false);
  assert.equal(calculated.recordKind, "calculated_field_session_metrics");
  assert.equal(calculated.calculations.loggedVisitWindowMinutes, 61.73);
  assert.equal(calculated.calculations.conversationPerVisitRatePercent, 100);
  assert.equal(calculated.calculations.leadPerVisitRatePercent, 75);
  assert.equal(calculated.calculations.unitPerLeadRatePercent, 0);
  assert.equal(calculated.calculationProvenance.sessionStartOrEndInferred, false);
  assert.equal(calculated.calculationProvenance.membershipCountInferredFromOutcomeLabel, false);

  const texans = normalized.verifiedFields.completedVisits.find(visit => visit.sourceReport.placeName === "Texans Auto Repair - Blackhawk");
  assert.equal(texans.sourceReport.outcome, "Membership");
  assert.equal(texans.sourceReport.units, 0);
  assert.equal(normalized.verifiedFields.totals.totalMemberships, null);
});

test("all six Founder stress-test findings and separate remediation evidence are preserved", () => {
  const evidence = json(FINDINGS_PATH);
  assert.equal(evidence.workspaceId, "fitness_connection");
  assert.equal(evidence.observations.length, 6);
  assert.deepEqual(evidence.observations.map(observation => observation.title), [
    "Discovery Mode category imbalance",
    "Nearby Context false negative",
    "Premature category conclusion",
    "Possible duplicate business entry",
    "Closed-business recommendation",
    "Repeated Nearby Context false negative"
  ]);
  assert.equal(evidence.observations.every(observation => observation.observedAt === null), true);
  assert.equal(evidence.observations.every(observation => observation.screenshots.length === 0), true);
  assert.equal(evidence.observations[3].identityConfirmation, "unconfirmed");
  assert.equal(evidence.subsequentRemediation.reportedStatus, "deployed_and_production_verified");
  assert.equal(evidence.subsequentRemediation.findingErasedOrSilentlyResolved, false);
  assert.equal(evidence.subsequentRemediation.repositoryEvidence.canonicalEvidenceCommit, "d4878f9202e01d697f36aa0d3f953432a6ea8aba");
});

test("history updates preserve representative and customer outcomes while territory stays unavailable", () => {
  const history = json(HISTORY_PATH);
  assert.equal(history.representativeHistory.representativeId, "cruz");
  assert.equal(history.representativeHistory.totals.totalVisits, 4);
  assert.equal(history.customerOutcomeHistory.length, 4);
  assert.equal(history.categoryOutcomeHistory.length, 1);
  assert.equal(history.categoryOutcomeHistory[0].category, "Auto");
  assert.equal(history.territoryHistory.status, "unavailable");
  assert.equal(history.territoryHistory.territoryId, null);
  assert.equal(history.intelligenceLearningHandoff.status, "not_authorized");
  assert.equal(history.intelligenceLearningHandoff.scoringMutationAllowed, false);
});

test("exact re-ingestion is idempotent and performs no second write", async () => {
  const binding = kvBinding();
  const input = archivePackage();
  const firstStore = createCloudflareKvFieldSessionStore({ [routeIqFieldSessionStoreBinding]: binding });
  const first = await persistRouteIqFieldSessionArchive(input, {
    store: firstStore,
    persistedAt: "2026-07-12T00:40:00.000Z"
  });
  const writeCount = binding.writes.length;
  const secondStore = createCloudflareKvFieldSessionStore({ [routeIqFieldSessionStoreBinding]: binding });
  const second = await persistRouteIqFieldSessionArchive(input, {
    store: secondStore,
    persistedAt: "2026-07-12T00:41:00.000Z"
  });

  assert.equal(first.status, "archived");
  assert.equal(first.duplicate, false);
  assert.equal(second.status, "already_archived");
  assert.equal(second.duplicate, true);
  assert.equal(binding.writes.length, writeCount);
  assert.equal(binding.data.size, 12);
  assert.equal(first.keys.historyEntries.length, 6);
});

test("same deterministic session with different raw evidence is rejected without overwrite", async () => {
  const binding = kvBinding();
  const original = archivePackage();
  const first = await persistRouteIqFieldSessionArchive(original, {
    env: { [routeIqFieldSessionStoreBinding]: binding },
    persistedAt: "2026-07-12T00:42:00.000Z"
  });
  const originalRaw = binding.data.get(first.keys.raw)?.value;
  const changedReport = JSON.parse(original.rawReportText);
  changedReport.visits[0].notes = "A conflicting later export";
  const conflicting = archivePackage({ rawReportText: JSON.stringify(changedReport, null, 2) + "\n" });

  await assert.rejects(() => persistRouteIqFieldSessionArchive(conflicting, {
    env: { [routeIqFieldSessionStoreBinding]: binding }
  }), error => {
    assert.equal(error instanceof FieldSessionConflictError, true);
    assert.equal(error.code, "field_session_duplicate_conflict");
    assert.equal(error.details.existingSha256, EXPECTED_RAW_SHA);
    return true;
  });
  assert.equal(binding.data.size, 12);
  assert.equal(binding.data.get(first.keys.raw)?.value, originalRaw);
  assert.equal(sha(originalRaw), EXPECTED_RAW_SHA);
});

test("automatic end-of-day handoff validates and persists without requiring stress-test evidence", async () => {
  const binding = kvBinding();
  const source = packageInput();
  const result = await consumeRouteIqEndOfDayHandoff({
    handoffContractId: routeIqEndOfDayHandoffContractId,
    producerSubsystem: "Prometheus Dashboard",
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    finalExportConfirmed: true,
    sourceFinalizedAt: "2026-07-12T00:30:00.000Z",
    rawReportText: source.rawReportText
  }, {
    env: { [routeIqFieldSessionStoreBinding]: binding },
    ingestedAt: "2026-07-12T00:31:00.000Z",
    runtimePools: source.runtimePools,
    activePool: source.activePool,
    businessHours: source.businessHours
  });

  assert.equal(result.status, "archived");
  assert.equal(result.handoffContractId, routeIqEndOfDayHandoffContractId);
  assert.equal(result.normalizedRecord.sessionId, SESSION_ID);
  assert.equal(result.historyUpdates.territoryHistory.status, "unavailable");
  const evidenceKey = fieldSessionStorageKeys("fitness_connection", SESSION_ID).stressTestEvidence;
  const storedEvidence = JSON.parse(binding.data.get(evidenceKey).value);
  assert.equal(storedEvidence.availability, "no_stress_test_evidence_submitted");
  assert.deepEqual(storedEvidence.observations, []);
});

test("a separate runtime adapter reads back the complete committed session", async () => {
  const binding = kvBinding();
  const input = archivePackage();
  const writer = createCloudflareKvFieldSessionStore({ [routeIqFieldSessionStoreBinding]: binding });
  await persistRouteIqFieldSessionArchive(input, {
    store: writer,
    persistedAt: "2026-07-12T00:43:00.000Z"
  });

  const reader = createCloudflareKvFieldSessionStore({ [routeIqFieldSessionStoreBinding]: binding });
  assert.notEqual(reader, writer);
  const result = await readRouteIqFieldSessionArchive({
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    sessionId: SESSION_ID
  }, { store: reader });

  assert.equal(result.ok, true);
  assert.equal(result.found, true);
  assert.equal(result.record.commit.status, "committed");
  assert.equal(result.record.commit.rawSha256, EXPECTED_RAW_SHA);
  assert.equal(result.record.rawReportText, input.rawReportText);
  assert.equal(result.record.normalizedRecord.verifiedFields.completedVisits.length, 4);
  assert.equal(result.record.stressTestEvidence.observations.length, 6);
  assert.equal(result.record.historyIndexEntries.length, 6);
  assert.equal(result.record.historyIndexEntries.filter(entry => entry.recordKind === "customer_field_session_history_entry").length, 4);
});

test("raw-only interrupted writes are not readable as committed sessions", async () => {
  const binding = kvBinding();
  const input = archivePackage();
  const prefix = `route-iq-field-sessions/v1/workspaces/fitness_connection/sessions/${SESSION_ID}`;
  await binding.put(`${prefix}/raw-report.json`, input.rawReportText);
  const result = await readRouteIqFieldSessionArchive({
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    sessionId: SESSION_ID
  }, { env: { [routeIqFieldSessionStoreBinding]: binding } });
  assert.deepEqual(result, { ok: true, found: false, record: null });
});

test("missing bindings, unknown workspaces, and cross-workspace evidence fail closed", async () => {
  const bindingStatus = validateFieldSessionStoreBinding({});
  assert.deepEqual(bindingStatus, {
    ok: false,
    bindingName: "DATA_ROUTE_IQ_FIELD_SESSION_STORE",
    storageTechnology: "cloudflare_workers_kv",
    missingMethods: ["get", "put", "list"]
  });
  assert.throws(() => createCloudflareKvFieldSessionStore({}), error => {
    assert.equal(error instanceof FieldSessionStoreBindingError, true);
    assert.equal(error.status, 503);
    return true;
  });

  assert.throws(() => archivePackage({ workspaceId: "unknown_workspace" }), /Unknown field-session workspace/);
  const contaminatedEvidence = json(SOURCE_EVIDENCE_PATH);
  contaminatedEvidence.workspaceId = "smoothie_depot";
  assert.throws(() => archivePackage({ stressTestEvidence: contaminatedEvidence }), /missing or cross-workspace/);

  const binding = kvBinding();
  await assert.rejects(() => readRouteIqFieldSessionArchive({
    workspaceId: "smoothie_depot",
    operatingProfileId: "franchise_development",
    sessionId: SESSION_ID
  }, { env: { [routeIqFieldSessionStoreBinding]: binding } }), /Unknown field-session workspace/);
  assert.equal(binding.data.size, 0);
});

test("existing Data contract remains canonical and does not activate Dashboard or Intelligence behavior", () => {
  const contract = json("overwatch/artifact-contracts/data/fitness-connection-runtime-artifact-contract-v1.json");
  const manifest = json(MANIFEST_PATH);
  const routeQuality = json("data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/route-intelligence-golden-route-quality-report.json");

  assert.equal(contract.status, "active");
  assert.equal(contract.owningSubsystem, "Prometheus Data");
  assert.equal(contract.automaticEndOfDayHandoffContract.contractId, routeIqEndOfDayHandoffContractId);
  assert.equal(contract.automaticEndOfDayHandoffContract.dashboardTriggerImplemented, false);
  assert.equal(contract.automaticEndOfDayHandoffContract.manualExportBackupMustRemainAvailable, true);
  assert.equal(contract.fieldSessionPersistenceContract.requiredBinding, routeIqFieldSessionStoreBinding);
  assert.equal(contract.fieldSessionPersistenceContract.bindingProvisionedInCurrentRuntimeConfiguration, false);
  assert.equal(contract.consumerRules.intelligence.fieldSessionLearningConsumptionAuthorized, false);
  assert.equal(contract.consumerRules.intelligence.fieldSessionHistoryMutationAllowed, false);
  assert.equal(contract.workspaceIsolationRules.smoothieDepotMayConsumeFitnessFieldSessions, false);
  assert.equal(contract.inventionGovernance.classification, "operational_improvement");
  assert.equal(manifest.invariants.dashboardBehaviorChanged, false);
  assert.equal(manifest.invariants.intelligenceScoringChanged, false);
  assert.equal(manifest.invariants.intelligenceRecommendationsChanged, false);
  assert.equal(routeQuality.governanceReuse.scoringChanged, false);
  assert.equal(routeQuality.businessHoursEligibility.implementation.scoringWeightsChanged, false);
});
