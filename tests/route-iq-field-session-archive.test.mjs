import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  FieldSessionArchiveError,
  FieldSessionAdministrativeDispositionConflictError,
  FieldSessionAdministrativeExclusionError,
  FieldSessionConflictError,
  FieldSessionStoreBindingError,
  assertRouteIqFieldSessionConsumptionEligible,
  createCloudflareKvFieldSessionStore,
  createRouteIqFieldSessionArchivePackage,
  consumeRouteIqEndOfDayHandoff,
  deriveRouteIqCandidateIdFromGooglePlaceId,
  deterministicFieldSessionId,
  fieldSessionAdministrativeDispositionStorageKey,
  fieldSessionStorageKeys,
  getRouteIqFieldSessionConsumptionEligibility,
  partitionRouteIqFieldSessionArchivesForConsumption,
  persistRouteIqFieldSessionAdministrativeDisposition,
  persistRouteIqFieldSessionArchive,
  projectCommittedRouteIqFieldSessionOutcomes,
  projectRouteIqChronologicalEvidence,
  readRouteIqFieldSessionAdministrativeDisposition,
  readRouteIqFieldSessionArchive,
  routeIqFieldSessionAdministrativeDispositionAuthorizationBatchId,
  routeIqFieldSessionAdministrativeDispositionReason,
  routeIqFieldSessionAdministrativeDispositionState,
  routeIqFieldSessionAdministrativeDispositionVersion,
  routeIqFieldSessionAdministrativeExclusionDomains,
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
const EXPECTED_IMMUTABLE_ARTIFACT_HASHES = Object.freeze({
  [RAW_PATH]: EXPECTED_RAW_SHA,
  [NORMALIZED_PATH]: "b162ba286debf97461e2f2e172377ed00b07c6c755cd152678e7a944dbccafc8",
  [CALCULATED_PATH]: "71171b79aa725e533113f5cc1d040b13f6fc5cb3b5b4cdee993e8d4b836de911",
  [HISTORY_PATH]: "0d3f2508b92290b04a1d7b1cc979ee298eea97c9dda84061dbe66e2bea5b5c09",
  [FINDINGS_PATH]: "6030bd109659140b00c012fbf09e6a05d63c23f197a58daec8bc63dd2603179e",
  [MANIFEST_PATH]: "e0bc2cc65e1c67fb39784c3a1fe87732875b64b6f5f2365df1924da5083265ba",
  [SOURCE_EVIDENCE_PATH]: "f66db5694698dcc75728a16a506c5bab66aac559b9913d991df6a6ce9cdcd9f9"
});

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

function zeroVisitArchivePackage(date) {
  const report = canonicalPackageReport();
  report.date = date;
  report.generatedAt = `${date}T23:00:00.000Z`;
  report.visits = [];
  report.totals = { visits: 0, conversations: 0, leads: 0, units: 0, laterUnits: 0 };
  return archivePackage({
    rawReportText: JSON.stringify(report, null, 2),
    originalFileName: `zero-visit-${date}.json`,
    canonicalRawArtifactPath: `route-iq-field-sessions/v1/fixtures/${date}.json`,
    ingestedAt: `${date}T23:30:00.000Z`,
    stressTestEvidence: null
  });
}

function dispositionInput(archive, recordedAt = "2026-07-15T01:00:00.000Z") {
  return {
    workspaceId: archive.normalizedRecord.workspaceId,
    operatingProfileId: archive.normalizedRecord.operatingProfileId,
    sessionId: archive.sessionId,
    rawSha256: archive.rawSha256,
    reason: routeIqFieldSessionAdministrativeDispositionReason,
    state: routeIqFieldSessionAdministrativeDispositionState,
    recordedAt,
    authorizationBatchId: routeIqFieldSessionAdministrativeDispositionAuthorizationBatchId
  };
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
  for (const [path, expectedHash] of Object.entries(EXPECTED_IMMUTABLE_ARTIFACT_HASHES)) {
    assert.equal(sha(readFileSync(path)), expectedHash, `Historical artifact changed: ${path}`);
  }
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

  assert.deepEqual(
    completedVisits.slice(0, -1).map(visit => ({ ...visit.visitDecisionSource, temporalClassification: undefined })),
    report.visits.slice(0, -1).map(visit => ({ ...visit.visitDecisionSource, temporalClassification: undefined }))
  );
  assert.deepEqual(completedVisits.map(visit => visit.recommendationDecisionContext), report.visits.map(visit => visit.recommendationDecisionContext));
  assert.deepEqual(completedVisits.map(visit => visit.visitDecisionSource.sourceId), routeIqVisitDecisionSourceIds);
  assert.deepEqual(routeIqRecommendationDecisionValues, ["accepted", "overridden"]);
  assert.equal(completedVisits.at(-1).visitDecisionSource.sourceId, "unknown");
  assert.equal(completedVisits.at(-1).visitDecisionSource.confidence, 0);
  assert.equal(completedVisits.at(-1).visitDecisionSource.reason, null);
  assert.equal(completedVisits.every(visit => visit.visitDecisionSource.temporalClassification === "action_time_observation"), true);
  assert.equal(completedVisits.every(visit => !Object.hasOwn(visit.sourceReport, "visitDecisionSource")), true);
  assert.equal(completedVisits.every(visit => !Object.hasOwn(visit.sourceReport, "recommendationDecisionContext")), true);
});

test("known decision context is timestamp-bound to the completed visit and canonicalized", () => {
  const canonical = decisionContextReport();
  canonical.visits[0].timestamp = "2026-07-11T15:00:00-05:00";
  canonical.visits[0].visitDecisionSource.capturedAt = "2026-07-11T20:00:00.000Z";
  const normalized = archivePackage({ rawReportText: JSON.stringify(canonical) })
    .normalizedRecord.verifiedFields.completedVisits[0];
  assert.equal(normalized.sourceReport.timestamp, "2026-07-11T20:00:00.000Z");
  assert.equal(normalized.visitDecisionSource.capturedAt, normalized.sourceReport.timestamp);
  assert.equal(normalized.visitDecisionSource.temporalClassification, "action_time_observation");

  for (const capturedAt of ["2026-07-11T19:59:59.999Z", "2026-07-11T20:00:00.001Z"]) {
    const mismatched = decisionContextReport();
    mismatched.visits[0].visitDecisionSource.capturedAt = capturedAt;
    assert.throws(() => archivePackage({ rawReportText: JSON.stringify(mismatched) }), error => {
      assert.equal(error instanceof FieldSessionArchiveError, true);
      assert.equal(error.code, "field_session_decision_context_timestamp_mismatch");
      assert.equal(error.details.visitTimestamp, mismatched.visits[0].timestamp);
      assert.equal(error.details.capturedAt, capturedAt);
      return true;
    });
  }
});

test("legacy Unknown is accepted only as a truthful late report-finalization fallback", () => {
  const report = decisionContextReport();
  const visit = report.visits[0];
  visit.visitDecisionSource = {
    sourceId: "unknown",
    reason: "Decision source was unavailable in the legacy active session.",
    evidence: [],
    confidence: 0,
    capturedAt: report.generatedAt
  };
  visit.recommendationDecisionContext = {
    recommendationAvailable: null,
    recommendationId: null,
    decision: null
  };
  const normalized = archivePackage({ rawReportText: JSON.stringify(report) })
    .normalizedRecord.verifiedFields.completedVisits[0];
  assert.ok(normalized.visitDecisionSource.capturedAt > normalized.sourceReport.timestamp);
  assert.equal(normalized.visitDecisionSource.capturedAt, report.generatedAt);
  assert.equal(normalized.visitDecisionSource.temporalClassification, "late_report_finalization_unknown");
  assert.equal(normalized.visitDecisionSource.reason, null);

  for (const capturedAt of [
    "2026-07-11T19:59:59.999Z",
    "2026-07-11T20:30:00.000Z",
    "2026-07-11T21:00:00.001Z"
  ]) {
    const invalid = decisionContextReport();
    invalid.visits[0].visitDecisionSource = {
      sourceId: "unknown",
      reason: null,
      evidence: [],
      confidence: 0,
      capturedAt
    };
    invalid.visits[0].recommendationDecisionContext = {
      recommendationAvailable: null,
      recommendationId: null,
      decision: null
    };
    assert.throws(() => archivePackage({ rawReportText: JSON.stringify(invalid) }), error => {
      assert.equal(error.code, "field_session_decision_context_timestamp_mismatch");
      return true;
    });
  }

  const knownLate = decisionContextReport();
  knownLate.visits[0].visitDecisionSource.capturedAt = knownLate.generatedAt;
  assert.throws(() => archivePackage({ rawReportText: JSON.stringify(knownLate) }), error => {
    assert.equal(error.code, "field_session_decision_context_timestamp_mismatch");
    return true;
  });
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

test("available recommendations require a non-empty canonical recommendation ID", () => {
  const missingId = decisionContextReport();
  missingId.visits[0].recommendationDecisionContext = {
    recommendationAvailable: true,
    recommendationId: null,
    decision: null
  };
  assert.throws(() => archivePackage({ rawReportText: JSON.stringify(missingId) }), error => {
    assert.equal(error instanceof FieldSessionArchiveError, true);
    assert.equal(error.code, "field_session_recommendation_decision_context_invalid");
    return true;
  });

  const paddedId = decisionContextReport();
  paddedId.visits[0].recommendationDecisionContext.recommendationId = "  google:canonical-id  ";
  const normalized = archivePackage({ rawReportText: JSON.stringify(paddedId) }).normalizedRecord.verifiedFields.completedVisits[0];
  assert.equal(normalized.recommendationDecisionContext.recommendationId, "google:canonical-id");
});

test("whitespace-only and trim-empty recommendation IDs fail closed", () => {
  for (const recommendationId of ["   ", " \t\n "]) {
    const malformed = decisionContextReport();
    malformed.visits[0].recommendationDecisionContext = {
      recommendationAvailable: true,
      recommendationId,
      decision: null
    };
    assert.throws(() => archivePackage({ rawReportText: JSON.stringify(malformed) }), error => {
      assert.equal(error instanceof FieldSessionArchiveError, true);
      assert.equal(error.code, "field_session_recommendation_decision_context_invalid");
      return true;
    });
  }
});

test("accepted and overridden recommendations require a canonical recommendation ID", () => {
  for (const decision of ["accepted", "overridden"]) {
    for (const recommendationId of [null, "   "]) {
      const malformed = decisionContextReport();
      malformed.visits[0].recommendationDecisionContext = {
        recommendationAvailable: true,
        recommendationId,
        decision
      };
      assert.throws(() => archivePackage({ rawReportText: JSON.stringify(malformed) }), error => {
        assert.equal(error instanceof FieldSessionArchiveError, true);
        assert.equal(error.code, "field_session_recommendation_decision_context_invalid");
        return true;
      });
    }
  }
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

test("administrative disposition appends one audit record while preserving all seven existing archive records", async () => {
  const binding = kvBinding();
  const archive = zeroVisitArchivePackage("2026-07-14");
  await persistRouteIqFieldSessionArchive(archive, {
    env: { [routeIqFieldSessionStoreBinding]: binding },
    persistedAt: "2026-07-15T00:00:00.000Z"
  });
  assert.equal(binding.data.size, 7);
  const before = new Map([...binding.data].map(([key, stored]) => [key, stored.value]));
  const writesBefore = binding.writes.length;
  const key = fieldSessionAdministrativeDispositionStorageKey("fitness_connection", archive.sessionId);
  const absent = await readRouteIqFieldSessionAdministrativeDisposition({
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    sessionId: archive.sessionId
  }, { env: { [routeIqFieldSessionStoreBinding]: binding } });
  assert.equal(absent.found, false);

  const first = await persistRouteIqFieldSessionAdministrativeDisposition(dispositionInput(archive), {
    env: { [routeIqFieldSessionStoreBinding]: binding }
  });
  assert.equal(first.status, "administrative_disposition_recorded");
  assert.equal(first.duplicate, false);
  assert.equal(first.key, key);
  assert.equal(first.record.schemaVersion, routeIqFieldSessionAdministrativeDispositionVersion);
  assert.equal(first.record.protectedArtifactCount, 7);
  assert.equal(first.record.preservedArchiveArtifacts.length, 7);
  assert.equal(first.record.automaticZeroVisitExclusion, false);
  assert.deepEqual(first.record.excludedDomains, routeIqFieldSessionAdministrativeExclusionDomains);
  assert.equal(binding.data.size, 8);
  assert.equal(binding.writes.length, writesBefore + 1);
  for (const [existingKey, existingValue] of before) {
    assert.equal(binding.data.get(existingKey)?.value, existingValue, `Existing archive record changed: ${existingKey}`);
  }

  const readBack = await readRouteIqFieldSessionArchive({
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    sessionId: archive.sessionId
  }, { env: { [routeIqFieldSessionStoreBinding]: binding } });
  assert.equal(readBack.record.administrativeDisposition.recordSha256, first.record.recordSha256);
  assert.deepEqual(readBack.record.consumptionEligibility, {
    eligible: false,
    state: "EXCLUDED_FROM_ANALYTICS",
    reason: "AUTOMATION_SMOKE_TEST_ACCIDENTAL_FINALIZATION",
    auditOnly: true,
    excludedDomains: [...routeIqFieldSessionAdministrativeExclusionDomains],
    dispositionRecordSha256: first.record.recordSha256
  });
  assert.deepEqual(getRouteIqFieldSessionConsumptionEligibility(readBack.record), readBack.record.consumptionEligibility);
  for (const domain of routeIqFieldSessionAdministrativeExclusionDomains) {
    assert.throws(
      () => assertRouteIqFieldSessionConsumptionEligible(readBack.record, domain),
      error => error instanceof FieldSessionAdministrativeExclusionError
        && error.code === "field_session_administratively_excluded"
        && error.details.requestedDomain === domain
    );
    const partition = partitionRouteIqFieldSessionArchivesForConsumption([readBack.record], domain);
    assert.equal(partition.includedRecords.length, 0);
    assert.deepEqual(partition.excludedAuditRecords, [{
      sessionId: archive.sessionId,
      workspaceId: "fitness_connection",
      operatingProfileId: "fitness",
      state: "EXCLUDED_FROM_ANALYTICS",
      reason: "AUTOMATION_SMOKE_TEST_ACCIDENTAL_FINALIZATION",
      requestedDomain: domain,
      auditOnly: true,
      sourceRawSha256: archive.rawSha256,
      dispositionRecordSha256: first.record.recordSha256,
      protectedArtifactCount: 7
    }]);
    assert.equal(Object.hasOwn(partition.excludedAuditRecords[0], "rawReportText"), false);
    assert.equal(Object.hasOwn(partition.excludedAuditRecords[0], "normalizedRecord"), false);
  }
  assert.throws(
    () => projectCommittedRouteIqFieldSessionOutcomes({
      workspaceId: "fitness_connection",
      operatingProfileId: "fitness",
      representativeId: "cruz",
      archiveRecord: readBack.record
    }),
    error => error instanceof FieldSessionAdministrativeExclusionError
  );
  assert.throws(
    () => projectRouteIqChronologicalEvidence({
      workspaceId: "fitness_connection",
      operatingProfileId: "fitness",
      representativeId: "cruz",
      decisionTimestamp: "2026-07-16T00:00:00.000Z",
      archiveRecord: readBack.record
    }),
    error => error instanceof FieldSessionAdministrativeExclusionError
  );

  const writeCount = binding.writes.length;
  const retry = await persistRouteIqFieldSessionAdministrativeDisposition(
    dispositionInput(archive, "2026-07-15T02:00:00.000Z"),
    { env: { [routeIqFieldSessionStoreBinding]: binding } }
  );
  assert.equal(retry.status, "administrative_disposition_already_recorded");
  assert.equal(retry.duplicate, true);
  assert.equal(retry.record.recordedAt, "2026-07-15T01:00:00.000Z");
  assert.equal(binding.writes.length, writeCount);
});

test("administrative disposition rejects unauthorized values and changed source identity without overwrite", async () => {
  const binding = kvBinding();
  const archive = zeroVisitArchivePackage("2026-07-14");
  await persistRouteIqFieldSessionArchive(archive, {
    env: { [routeIqFieldSessionStoreBinding]: binding },
    persistedAt: "2026-07-15T00:00:00.000Z"
  });
  const initialSize = binding.data.size;
  await assert.rejects(
    () => persistRouteIqFieldSessionAdministrativeDisposition({
      ...dispositionInput(archive),
      reason: "ZERO_VISIT_SESSION"
    }, { env: { [routeIqFieldSessionStoreBinding]: binding } }),
    error => error instanceof FieldSessionArchiveError
      && error.code === "field_session_administrative_disposition_value_unauthorized"
  );
  await assert.rejects(
    () => persistRouteIqFieldSessionAdministrativeDisposition({
      ...dispositionInput(archive),
      zeroVisit: true
    }, { env: { [routeIqFieldSessionStoreBinding]: binding } }),
    error => error instanceof FieldSessionArchiveError
      && error.code === "field_session_administrative_disposition_input_invalid"
  );
  assert.equal(binding.data.size, initialSize);

  const first = await persistRouteIqFieldSessionAdministrativeDisposition(dispositionInput(archive), {
    env: { [routeIqFieldSessionStoreBinding]: binding }
  });
  const dispositionBytes = binding.data.get(first.key).value;
  await assert.rejects(
    () => persistRouteIqFieldSessionAdministrativeDisposition({
      ...dispositionInput(archive),
      rawSha256: "0".repeat(64)
    }, { env: { [routeIqFieldSessionStoreBinding]: binding } }),
    error => error instanceof FieldSessionAdministrativeDispositionConflictError
      && error.code === "field_session_administrative_disposition_conflict"
  );
  assert.equal(binding.data.get(first.key).value, dispositionBytes);
});

test("an undisposed zero-visit session remains eligible and is not caught by a broad rule", async () => {
  const binding = kvBinding();
  const disposed = zeroVisitArchivePackage("2026-07-14");
  const unaffected = zeroVisitArchivePackage("2026-07-15");
  await persistRouteIqFieldSessionArchive(disposed, {
    env: { [routeIqFieldSessionStoreBinding]: binding },
    persistedAt: "2026-07-15T00:00:00.000Z"
  });
  await persistRouteIqFieldSessionArchive(unaffected, {
    env: { [routeIqFieldSessionStoreBinding]: binding },
    persistedAt: "2026-07-16T00:00:00.000Z"
  });
  await persistRouteIqFieldSessionAdministrativeDisposition(dispositionInput(disposed), {
    env: { [routeIqFieldSessionStoreBinding]: binding }
  });

  const unaffectedRead = await readRouteIqFieldSessionArchive({
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    sessionId: unaffected.sessionId
  }, { env: { [routeIqFieldSessionStoreBinding]: binding } });
  assert.equal(unaffectedRead.record.administrativeDisposition, null);
  assert.deepEqual(unaffectedRead.record.consumptionEligibility, {
    eligible: true,
    state: "NOT_ADMINISTRATIVELY_EXCLUDED",
    reason: null,
    auditOnly: false,
    excludedDomains: []
  });
  assert.deepEqual(projectCommittedRouteIqFieldSessionOutcomes({
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    representativeId: "cruz",
    archiveRecord: unaffectedRead.record
  }).outcomes, []);
  const partition = partitionRouteIqFieldSessionArchivesForConsumption(
    [unaffectedRead.record],
    "productivity_counts"
  );
  assert.equal(partition.includedRecords.length, 1);
  assert.equal(partition.excludedAuditRecords.length, 0);
});

test("administrative disposition schema and Data contract pin only the explicitly authorized production target", () => {
  const schema = json("data/route-iq-field-sessions-v1/route-iq-field-session-administrative-disposition-v1.schema.json");
  const contract = json("overwatch/artifact-contracts/data/fitness-connection-runtime-artifact-contract-v1.json");
  const dispositionContract = contract.fieldSessionAdministrativeDispositionContract;
  assert.equal(schema.properties.reason.const, routeIqFieldSessionAdministrativeDispositionReason);
  assert.equal(schema.properties.state.const, routeIqFieldSessionAdministrativeDispositionState);
  assert.equal(schema.properties.authorization.properties.batchId.const, routeIqFieldSessionAdministrativeDispositionAuthorizationBatchId);
  assert.equal(schema.properties.automaticZeroVisitExclusion.const, false);
  assert.deepEqual(schema.properties.excludedDomains.const, routeIqFieldSessionAdministrativeExclusionDomains);
  assert.equal(dispositionContract.status, "source_implemented_pending_deployment_and_explicit_append");
  assert.equal(dispositionContract.authorizedProductionTarget.sessionId, "route-iq-field-session-fitness-connection-fitness-cruz-2026-07-14");
  assert.equal(dispositionContract.authorizedProductionTarget.rawSha256, "ceb72963ab4e98d6039c1a4a1a409d281bf9e41e6001bd78cca4c04364815765");
  assert.equal(dispositionContract.authorizedProductionTarget.existingRecordCount, 7);
  assert.equal(dispositionContract.persistenceRules.automaticZeroVisitExclusionAllowed, false);
  assert.equal(dispositionContract.persistenceRules.productionMutationAuthorizedBySourceCommit, false);
  assert.deepEqual(dispositionContract.excludedDomains, routeIqFieldSessionAdministrativeExclusionDomains);
  assert.equal(dispositionContract.consumerRules.centralDataConsumerPartitionFunction, "partitionRouteIqFieldSessionArchivesForConsumption");
  assert.equal(dispositionContract.consumerRules.everyExcludedDomainRequiresCentralPartition, true);
  assert.equal(dispositionContract.consumerRules.excludedAuditProjectionMayContainRawPayload, false);
  assert.equal(dispositionContract.consumerRules.excludedAuditProjectionMayCountTowardAnyConsumerMetric, false);
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

test("committed prospective handoff projects strict PII-free unscored outcome evidence", async () => {
  const binding = kvBinding();
  const input = archivePackage();
  await persistRouteIqFieldSessionArchive(input, {
    env: { [routeIqFieldSessionStoreBinding]: binding }
  });
  const archived = await readRouteIqFieldSessionArchive({
    workspaceId: input.normalizedRecord.workspaceId,
    operatingProfileId: input.normalizedRecord.operatingProfileId,
    sessionId: input.normalizedRecord.sessionId
  }, { env: { [routeIqFieldSessionStoreBinding]: binding } });
  const projection = projectCommittedRouteIqFieldSessionOutcomes({
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    representativeId: "cruz",
    archiveRecord: archived.record
  });
  assert.equal(projection.authority, "prometheus_data_committed_field_session");
  assert.equal(projection.recordOrigin, "prospective");
  assert.equal(projection.scoreableOutcomeDerivedByData, false);
  assert.deepEqual(projection.privacy, {
    namesIncluded: false,
    addressesIncluded: false,
    contactsIncluded: false,
    notesIncluded: false,
    preciseLocationIncluded: false
  });
  assert.equal(projection.outcomes.length, input.normalizedRecord.verifiedFields.completedVisits.length);
  for (const [index, outcome] of projection.outcomes.entries()) {
    const source = input.normalizedRecord.verifiedFields.completedVisits[index];
    assert.equal(outcome.outcomeEvidence.scoreableOutcome, null);
    assert.equal(outcome.outcomeEvidence.scoreableOutcomeDerivedByData, false);
    assert.equal(outcome.decisionSource.temporalClassification, "post_action_supporting_information");
    assert.equal(outcome.decisionSource.preActionEvidence, false);
    assert.equal(outcome.decisionSource.sameShadowDecisionInput, false);
    if (source.governedBusinessIdentity.matchStatus === "exact_runtime_id") {
      assert.equal(outcome.candidateId, deriveRouteIqCandidateIdFromGooglePlaceId(source.governedBusinessIdentity.googlePlaceId));
    } else {
      assert.equal(outcome.candidateId, null);
    }
  }
  const serialized = JSON.stringify(projection);
  for (const prohibited of ["notes", "managerName", "managerEmail", "managerPhone", "formattedAddress", "businessName"]) {
    assert.equal(serialized.includes(`\"${prohibited}\":`), false, prohibited);
  }
  assert.throws(
    () => deriveRouteIqCandidateIdFromGooglePlaceId("123 Main Street"),
    error => error instanceof FieldSessionArchiveError && error.code === "field_session_candidate_identity_invalid"
  );
});

test("historical or uncommitted field-session records cannot enter prospective outcome projection", async () => {
  const historical = {
    normalizedRecord: json(NORMALIZED_PATH),
    commit: {
      status: "committed",
      workspaceId: "fitness_connection",
      sessionId: SESSION_ID,
      rawSha256: EXPECTED_RAW_SHA,
      persistedAt: "2026-07-12T00:36:02.000Z"
    },
    sourceArtifacts: {
      normalized: {
        text: readFileSync(NORMALIZED_PATH, "utf8"),
        sha256: EXPECTED_IMMUTABLE_ARTIFACT_HASHES[NORMALIZED_PATH]
      }
    }
  };
  assert.throws(
    () => projectCommittedRouteIqFieldSessionOutcomes({
      workspaceId: "fitness_connection",
      operatingProfileId: "fitness",
      representativeId: "cruz",
      archiveRecord: historical
    }),
    error => error instanceof FieldSessionArchiveError && error.code === "field_session_outcome_projection_not_canonical"
  );
});

test("Data schema and contract govern decision context prospectively without mutating the historical archive", () => {
  const schema = json("data/route-iq-field-sessions-v1/route-iq-field-session-v1.schema.json");
  const contract = json("overwatch/artifact-contracts/data/fitness-connection-runtime-artifact-contract-v1.json");
  const archived = json(NORMALIZED_PATH);
  const decisionContract = contract.canonicalVisitDecisionContextContract;

  assert.deepEqual(schema.$defs.completedVisit.required, ["visitDecisionSource", "recommendationDecisionContext", "outcomeAudit"]);
  assert.deepEqual(schema.$defs.visitDecisionSource.properties.sourceId.enum, routeIqVisitDecisionSourceIds);
  assert.equal(schema.$defs.visitDecisionSource.required.includes("temporalClassification"), true);
  assert.deepEqual(schema.$defs.visitDecisionSource.properties.temporalClassification.enum, ["action_time_observation", "late_report_finalization_unknown"]);
  assert.equal(schema.$defs.completedVisit.allOf[0].then.properties.recommendationDecisionContext.properties.recommendationAvailable.const, null);
  assert.equal(schema.$defs.completedVisit.allOf[0].then.properties.recommendationDecisionContext.properties.recommendationId.const, null);
  assert.equal(schema.$defs.completedVisit.allOf[0].then.properties.recommendationDecisionContext.properties.decision.const, null);
  assert.equal(schema.$defs.visitDecisionSource.allOf[0].then.properties.confidence.const, 0);
  assert.equal(schema.$defs.visitDecisionSource.allOf[0].then.properties.reason.const, null);
  assert.deepEqual(schema.$defs.recommendationDecisionContext.properties.decision.enum, ["accepted", "overridden", null]);
  assert.equal(schema.$defs.recommendationDecisionContext.properties.recommendationId.pattern, ".*\\S.*");
  assert.equal(schema.$defs.recommendationDecisionContext.allOf[0].if.properties.recommendationAvailable.const, true);
  assert.equal(schema.$defs.recommendationDecisionContext.allOf[0].then.properties.recommendationId.pattern, ".*\\S.*");
  assert.equal(schema.allOf[0].if.properties.sessionId.const, SESSION_ID);
  assert.equal(schema.allOf[0].if.properties.sourceProvenance.properties.rawSha256.const, EXPECTED_RAW_SHA);
  assert.equal(decisionContract.status, "validation_final_repair_complete_for_newly_normalized_field_sessions");
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
  assert.equal(decisionContract.preservationRules.availableRecommendationRequiresCanonicalId, true);
  assert.equal(decisionContract.preservationRules.recommendationIdTrimmedBeforeValidation, true);
  assert.equal(decisionContract.preservationRules.whitespaceOnlyRecommendationIdRejected, true);
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
