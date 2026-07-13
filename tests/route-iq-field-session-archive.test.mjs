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
  routeIqRecommendationDecisionValues,
  routeIqVisitDecisionSourceIds,
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
    rawReportText: JSON.stringify(canonicalPackageReport(), null, 2),
    originalFileName: "canonical-decision-context-test-report.json",
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

function canonicalPackageReport() {
  const report = JSON.parse(readFileSync(RAW_PATH, "utf8"));
  report.visits = report.visits.map(visit => ({
    ...visit,
    visitDecisionSource: {
      sourceId: "unknown",
      reason: "The historical test fixture supplies an explicit unknown source.",
      evidence: [],
      confidence: 0,
      capturedAt: visit.timestamp
    },
    recommendationDecisionContext: {
      recommendationAvailable: null,
      recommendationId: null,
      decision: null
    }
  }));
  return report;
}

async function seedHistoricalArchive(binding) {
  const keys = fieldSessionStorageKeys("fitness_connection", SESSION_ID);
  const rawReportText = readFileSync(RAW_PATH, "utf8");
  const artifacts = [
    [keys.raw, rawReportText],
    [keys.normalized, readFileSync(NORMALIZED_PATH, "utf8")],
    [keys.calculated, readFileSync(CALCULATED_PATH, "utf8")],
    [keys.stressTestEvidence, readFileSync(FINDINGS_PATH, "utf8")],
    [keys.historyUpdates, readFileSync(HISTORY_PATH, "utf8")]
  ];
  for (const [key, value] of artifacts) await binding.put(key, value);
  await binding.put(keys.commit, JSON.stringify({
    schemaVersion: routeIqFieldSessionArchiveVersion,
    sessionId: SESSION_ID,
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    rawSha256: EXPECTED_RAW_SHA,
    status: "committed",
    keys: { ...keys, historyEntries: [] }
  }));
}

function decisionContextReport() {
  const report = JSON.parse(readFileSync(RAW_PATH, "utf8"));
  const template = report.visits[0];
  report.generatedAt = "2026-07-11T21:00:00.000Z";
  report.visits = routeIqVisitDecisionSourceIds.map((sourceId, index) => {
    const timestamp = `2026-07-11T20:${String(index).padStart(2, "0")}:00.000Z`;
    return {
      ...template,
      timestamp,
      conversations: 0,
      leads: 0,
      units: 0,
      laterUnits: 0,
      notes: `Decision context preservation fixture: ${sourceId}`,
      visitDecisionSource: {
        sourceId,
        reason: sourceId === "unknown" ? "Decision source was explicitly unknown." : `Verified ${sourceId} source.`,
        evidence: sourceId === "unknown" ? [] : [{ evidenceType: `${sourceId}_selection`, sourceRecordId: `decision-source-${index}` }],
        confidence: sourceId === "unknown" ? 0 : 0.9,
        capturedAt: timestamp
      },
      recommendationDecisionContext: index === 0 ? {
        recommendationAvailable: true,
        recommendationId: "google:decision-context-test",
        decision: "accepted"
      } : index === 1 ? {
        recommendationAvailable: true,
        recommendationId: "google:decision-context-test",
        decision: "overridden"
      } : {
        recommendationAvailable: null,
        recommendationId: null,
        decision: null
      }
    };
  });
  report.totals = {
    visits: report.visits.length,
    conversations: 0,
    leads: 0,
    units: 0,
    laterUnits: 0
  };
  return report;
}

test("actual Founder final report remains byte-preserved with its deterministic historical identity", () => {
  const raw = readFileSync(RAW_PATH, "utf8");
  const report = JSON.parse(raw);
  const manifest = json(MANIFEST_PATH);

  assert.equal(sha(raw), EXPECTED_RAW_SHA);
  assert.equal(Buffer.byteLength(raw, "utf8"), 1934);
  assert.equal(report.generatedAt, "2026-07-12T00:25:44.676Z");
  assert.deepEqual(report.totals, {
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

test("historical archive remains readable without weakening new normalization", async () => {
  const binding = kvBinding();
  await seedHistoricalArchive(binding);
  const result = await readRouteIqFieldSessionArchive({
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    sessionId: SESSION_ID
  }, { env: { [routeIqFieldSessionStoreBinding]: binding } });

  assert.equal(result.ok, true);
  assert.equal(result.found, true);
  assert.equal(result.record.commit.rawSha256, EXPECTED_RAW_SHA);
  assert.equal(result.record.normalizedRecord.verifiedFields.completedVisits.length, 4);
  assert.equal(result.record.normalizedRecord.verifiedFields.completedVisits.every(visit => !Object.hasOwn(visit, "visitDecisionSource")), true);
  assert.equal(result.record.normalizedRecord.verifiedFields.completedVisits.every(visit => !Object.hasOwn(visit, "recommendationDecisionContext")), true);
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

test("newly normalized visits preserve known sources and canonicalize explicit Unknown", () => {
  const report = decisionContextReport();
  const result = archivePackage({ rawReportText: JSON.stringify(report, null, 2) });
  const completedVisits = result.normalizedRecord.verifiedFields.completedVisits;

  assert.deepEqual(completedVisits.slice(0, -1).map(visit => visit.visitDecisionSource), report.visits.slice(0, -1).map(visit => visit.visitDecisionSource));
  assert.deepEqual(completedVisits.map(visit => visit.recommendationDecisionContext), report.visits.map(visit => visit.recommendationDecisionContext));
  assert.deepEqual(completedVisits.map(visit => visit.visitDecisionSource.sourceId), routeIqVisitDecisionSourceIds);
  assert.deepEqual(routeIqRecommendationDecisionValues, ["accepted", "overridden"]);
  assert.equal(completedVisits.at(-1).visitDecisionSource.sourceId, "unknown");
  assert.equal(completedVisits.at(-1).visitDecisionSource.confidence, 0);
  assert.equal(completedVisits.at(-1).visitDecisionSource.reason, null);
  assert.equal(completedVisits.every(visit => !Object.hasOwn(visit.sourceReport, "visitDecisionSource")), true);
  assert.equal(completedVisits.every(visit => !Object.hasOwn(visit.sourceReport, "recommendationDecisionContext")), true);
});

test("new normalization rejects omitted or null canonical decision-context fields", () => {
  for (const field of ["visitDecisionSource", "recommendationDecisionContext"]) {
    const omitted = decisionContextReport();
    delete omitted.visits[0][field];
    assert.throws(() => archivePackage({ rawReportText: JSON.stringify(omitted) }), error => {
      assert.equal(error instanceof FieldSessionArchiveError, true);
      assert.equal(error.code, "field_session_decision_context_required");
      return true;
    });

    const nullValue = decisionContextReport();
    nullValue.visits[0][field] = null;
    assert.throws(() => archivePackage({ rawReportText: JSON.stringify(nullValue) }), error => {
      assert.equal(error instanceof FieldSessionArchiveError, true);
      assert.equal(error.code, "field_session_decision_context_required");
      return true;
    });
  }

  assert.throws(() => validateFinalRouteIqReport(readFileSync(RAW_PATH, "utf8"), {
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    finalExportConfirmed: true
  }), error => {
    assert.equal(error.code, "field_session_decision_context_required");
    return true;
  });
});

test("non-canonical decision sources fail before archival", () => {
  const unsupported = decisionContextReport();
  unsupported.visits[0].visitDecisionSource.sourceId = "personal_hunch";
  assert.throws(() => archivePackage({ rawReportText: JSON.stringify(unsupported) }), error => {
    assert.equal(error instanceof FieldSessionArchiveError, true);
    assert.equal(error.code, "field_session_visit_decision_source_invalid");
    return true;
  });
});

test("unavailable or unknown recommendations reject non-null recommendation IDs", () => {
  for (const recommendationAvailable of [false, null]) {
    const malformed = decisionContextReport();
    malformed.visits[0].recommendationDecisionContext = {
      recommendationAvailable,
      recommendationId: "google:must-not-survive",
      decision: null
    };
    assert.throws(() => archivePackage({ rawReportText: JSON.stringify(malformed) }), error => {
      assert.equal(error instanceof FieldSessionArchiveError, true);
      assert.equal(error.code, "field_session_recommendation_decision_context_invalid");
      return true;
    });
  }

  const validUnavailable = decisionContextReport();
  validUnavailable.visits[0].recommendationDecisionContext = {
    recommendationAvailable: false,
    recommendationId: null,
    decision: null
  };
  const normalized = archivePackage({ rawReportText: JSON.stringify(validUnavailable) }).normalizedRecord.verifiedFields.completedVisits[0];
  assert.deepEqual(normalized.recommendationDecisionContext, validUnavailable.visits[0].recommendationDecisionContext);
});

test("accepted or overridden decisions still require an available identified recommendation", () => {
  const malformed = decisionContextReport();
  malformed.visits[0].recommendationDecisionContext = {
    recommendationAvailable: false,
    recommendationId: null,
    decision: "accepted"
  };
  assert.throws(() => archivePackage({ rawReportText: JSON.stringify(malformed) }), error => {
    assert.equal(error instanceof FieldSessionArchiveError, true);
    assert.equal(error.code, "field_session_recommendation_decision_context_invalid");
    return true;
  });
});

test("whitespace-only decision evidence fails closed", () => {
  for (const field of ["evidenceType", "sourceRecordId"]) {
    const malformed = decisionContextReport();
    malformed.visits[0].visitDecisionSource.evidence[0][field] = "   \t";
    assert.throws(() => archivePackage({ rawReportText: JSON.stringify(malformed) }), error => {
      assert.equal(error instanceof FieldSessionArchiveError, true);
      assert.equal(error.code, "field_session_visit_decision_source_invalid");
      return true;
    });
  }
});

test("Unknown rejects positive confidence and normalizes its reason to null", () => {
  const invalid = decisionContextReport();
  invalid.visits.at(-1).visitDecisionSource.confidence = 0.1;
  assert.throws(() => archivePackage({ rawReportText: JSON.stringify(invalid) }), error => {
    assert.equal(error instanceof FieldSessionArchiveError, true);
    assert.equal(error.code, "field_session_visit_decision_source_invalid");
    return true;
  });

  const valid = decisionContextReport();
  const normalized = archivePackage({ rawReportText: JSON.stringify(valid) }).normalizedRecord.verifiedFields.completedVisits.at(-1);
  assert.deepEqual({
    sourceId: normalized.visitDecisionSource.sourceId,
    confidence: normalized.visitDecisionSource.confidence,
    reason: normalized.visitDecisionSource.reason
  }, {
    sourceId: "unknown",
    confidence: 0,
    reason: null
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
    assert.equal(error.details.existingSha256, original.rawSha256);
    return true;
  });
  assert.equal(binding.data.size, 12);
  assert.equal(binding.data.get(first.keys.raw)?.value, originalRaw);
  assert.equal(sha(originalRaw), original.rawSha256);
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
  assert.equal(result.record.commit.rawSha256, input.rawSha256);
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

test("Data schema and contract govern decision context prospectively without mutating the historical archive", () => {
  const schema = json("data/route-iq-field-sessions-v1/route-iq-field-session-v1.schema.json");
  const contract = json("overwatch/artifact-contracts/data/fitness-connection-runtime-artifact-contract-v1.json");
  const archived = json(NORMALIZED_PATH);
  const decisionContract = contract.canonicalVisitDecisionContextContract;

  assert.deepEqual(schema.$defs.completedVisit.required, ["visitDecisionSource", "recommendationDecisionContext"]);
  assert.deepEqual(schema.$defs.visitDecisionSource.properties.sourceId.enum, routeIqVisitDecisionSourceIds);
  assert.equal(schema.$defs.visitDecisionSource.allOf[0].then.properties.confidence.const, 0);
  assert.equal(schema.$defs.visitDecisionSource.allOf[0].then.properties.reason.const, null);
  assert.deepEqual(schema.$defs.recommendationDecisionContext.properties.decision.enum, ["accepted", "overridden", null]);
  assert.equal(schema.allOf[0].if.properties.sessionId.const, SESSION_ID);
  assert.equal(schema.allOf[0].if.properties.sourceProvenance.properties.rawSha256.const, EXPECTED_RAW_SHA);
  assert.equal(decisionContract.status, "validation_hardened_for_newly_normalized_field_sessions");
  assert.equal(decisionContract.canonicalContainer, "verifiedFields.completedVisits[]");
  assert.deepEqual(decisionContract.canonicalFields, ["visitDecisionSource", "recommendationDecisionContext"]);
  assert.deepEqual(decisionContract.visitDecisionSourceValues.map(value => value.sourceId), routeIqVisitDecisionSourceIds);
  assert.equal(decisionContract.preservationRules.unknownRemainsCanonical, true);
  assert.equal(decisionContract.preservationRules.canonicalFieldsRequired, true);
  assert.equal(decisionContract.preservationRules.missingInputFailsClosed, true);
  assert.equal(decisionContract.preservationRules.nullCanonicalFieldsAllowed, false);
  assert.deepEqual(decisionContract.preservationRules.unknownCanonicalOutput, {
    sourceId: "unknown",
    label: "Unknown",
    confidence: 0,
    reason: null
  });
  assert.equal(decisionContract.preservationRules.unavailableRecommendationRequiresNullId, true);
  assert.equal(decisionContract.preservationRules.whitespaceOnlyEvidenceRejected, true);
  assert.equal(decisionContract.preservationRules.historicalArchivesMutated, false);
  assert.equal(decisionContract.historicalCompatibility.sessionId, SESSION_ID);
  assert.equal(decisionContract.historicalCompatibility.rawSha256, EXPECTED_RAW_SHA);
  assert.equal(decisionContract.historicalCompatibility.newNormalizationExemptionAllowed, false);
  assert.equal(decisionContract.behaviorAuthorization.recommendationInfluenceActivated, false);
  assert.equal(decisionContract.behaviorAuthorization.routeScoringMutationAllowed, false);
  assert.equal(archived.verifiedFields.completedVisits.every(visit => !Object.hasOwn(visit, "visitDecisionSource")), true);
  assert.equal(archived.verifiedFields.completedVisits.every(visit => !Object.hasOwn(visit, "recommendationDecisionContext")), true);
});

test("existing Data contract records the live Dashboard producer without activating Intelligence behavior", () => {
  const contract = json("overwatch/artifact-contracts/data/fitness-connection-runtime-artifact-contract-v1.json");
  const manifest = json(MANIFEST_PATH);
  const routeQuality = json("data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/route-intelligence-golden-route-quality-report.json");

  assert.equal(contract.status, "active");
  assert.equal(contract.owningSubsystem, "Prometheus Data");
  assert.equal(contract.automaticEndOfDayHandoffContract.contractId, routeIqEndOfDayHandoffContractId);
  assert.equal(contract.automaticEndOfDayHandoffContract.dashboardTriggerImplemented, true);
  assert.equal(contract.automaticEndOfDayHandoffContract.dashboardTriggerActivated, true);
  assert.equal(contract.automaticEndOfDayHandoffContract.productionState, "dashboard_producer_verified_live");
  assert.equal(contract.automaticEndOfDayHandoffContract.productionActivationVerification.verifiedAt, "2026-07-12T02:50:47Z");
  assert.equal(contract.automaticEndOfDayHandoffContract.productionActivationVerification.verifiedWorker, "prometheus-iq");
  assert.equal(contract.automaticEndOfDayHandoffContract.productionActivationVerification.verifiedWorkerVersion, "a376d0fa-bddc-498c-8f15-32eb025ee08c");
  assert.equal(contract.automaticEndOfDayHandoffContract.productionActivationVerification.verifiedDeploymentCommit, "796f59ce7ee91538211f3050dc0b3050889ee935");
  assert.equal(contract.automaticEndOfDayHandoffContract.productionActivationVerification.activationStatus, "ACTIVE");
  assert.equal(contract.automaticEndOfDayHandoffContract.manualExportBackupMustRemainAvailable, true);
  assert.equal(contract.fieldSessionPersistenceContract.requiredBinding, routeIqFieldSessionStoreBinding);
  assert.equal(contract.fieldSessionPersistenceContract.bindingProvisionedInCurrentRuntimeConfiguration, true);
  assert.equal(contract.fieldSessionPersistenceContract.productionBindingStatus, "verified_live");
  assert.equal(contract.fieldSessionPersistenceContract.productionBindingVerification.verifiedAt, "2026-07-12T01:31:32Z");
  assert.equal(contract.fieldSessionPersistenceContract.productionBindingVerification.verifiedWorker, "prometheus-iq");
  assert.equal(contract.fieldSessionPersistenceContract.productionBindingVerification.verifiedWorkerVersion, "c7fa9d9b-843e-4080-a6ee-5d15d9bab003");
  assert.equal(contract.fieldSessionPersistenceContract.productionBindingVerification.bindingVerificationStatus, "passed");
  assert.equal(contract.fieldSessionPersistenceContract.productionBindingVerification.disposableVerification.status, "passed_and_cleaned_up");
  assert.equal(contract.fieldSessionPersistenceContract.productionBindingVerification.workspaceIsolationVerification.status, "passed");
  assert.equal(contract.fieldSessionPersistenceContract.productionBindingVerification.currentProductionState.dashboardTriggerActivated, true);
  assert.equal(contract.fieldSessionPersistenceContract.productionBindingVerification.currentProductionState.intelligenceLearningActivated, false);
  assert.equal(contract.fieldSessionPersistenceContract.productionBindingVerification.currentProductionState.automaticReplayActivated, false);
  assert.equal(contract.fieldSessionPersistenceContract.productionBindingVerification.currentProductionState.customerDataBackfillActivated, false);
  assert.equal(contract.automaticEndOfDayHandoffContract.status, "dashboard_producer_verified_live");
  assert.equal(contract.consumerRules.dashboard.automaticEndOfDayTriggerImplemented, true);
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
