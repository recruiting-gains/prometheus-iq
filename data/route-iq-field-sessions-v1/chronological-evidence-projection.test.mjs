import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  FieldSessionArchiveError,
  projectRouteIqChronologicalEvidence
} from "./route-iq-field-session-archive.mjs";

const ROOT = "data/route-iq-field-sessions-v1/workspaces/fitness_connection/sessions/route-iq-field-session-fitness-connection-fitness-cruz-2026-07-11";
const paths = {
  raw: `${ROOT}/raw/prometheus-iq-cruz-daily-report-2026-07-11.json`,
  normalized: `${ROOT}/normalized/field-session.json`,
  calculated: `${ROOT}/normalized/calculated-metrics.json`,
  stressTestEvidence: `${ROOT}/evidence/stress-test-observations.json`,
  historyUpdates: `${ROOT}/normalized/history-updates.json`
};

function hash(text) {
  return createHash("sha256").update(text).digest("hex");
}

function archive() {
  const texts = Object.fromEntries(Object.entries(paths).map(([name, path]) => [name, readFileSync(path, "utf8")]));
  return {
    commit: {
      status: "committed",
      workspaceId: "fitness_connection",
      sessionId: JSON.parse(texts.normalized).sessionId,
      operatingProfileId: "fitness",
      rawSha256: hash(texts.raw)
    },
    rawReportText: texts.raw,
    normalizedRecord: JSON.parse(texts.normalized),
    calculatedMetrics: JSON.parse(texts.calculated),
    stressTestEvidence: JSON.parse(texts.stressTestEvidence),
    historyUpdates: JSON.parse(texts.historyUpdates),
    sourceArtifacts: Object.fromEntries(Object.entries(texts).map(([name, text]) => [name, { key: paths[name], text, sha256: hash(text), byteLength: Buffer.byteLength(text) }]))
  };
}

function project(record, decisionTimestamp = "2026-07-12T01:00:00.000Z") {
  return projectRouteIqChronologicalEvidence({
    archiveRecord: record,
    decisionTimestamp,
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    representativeId: "cruz"
  });
}

function replaceHistory(record, mutate) {
  mutate(record.historyUpdates);
  const text = JSON.stringify(record.historyUpdates, null, 2) + "\n";
  record.sourceArtifacts.historyUpdates = { ...record.sourceArtifacts.historyUpdates, text, sha256: hash(text), byteLength: Buffer.byteLength(text) };
}

function replaceNormalized(record, mutate) {
  mutate(record.normalizedRecord);
  const text = JSON.stringify(record.normalizedRecord, null, 2) + "\n";
  record.sourceArtifacts.normalized = {
    ...record.sourceArtifacts.normalized,
    text,
    sha256: hash(text),
    byteLength: Buffer.byteLength(text)
  };
}

test("July 11 archive remains compatible and explicitly excludes unavailable timestamps", () => {
  const result = project(archive());
  assert.ok(result.evidence.length > 0);
  assert.ok(result.exclusions.some(item => item.reason === "missing_evidence_timestamp"));
  assert.equal(result.evidence.every(item => item.context.territoryId === null), true);
  assert.equal(result.evidence.every(item => item.schemaVersion && item.provenance.sourceRawSha256), true);
});

test("evidence at the decision timestamp is excluded unless prior availability is separately proven", () => {
  const record = archive();
  const visit = record.normalizedRecord.verifiedFields.completedVisits[0];
  const timestamp = visit.sourceReport.timestamp;
  const sourceRecordId = `${record.normalizedRecord.sessionId}:${visit.visitId}:observed-outcome`;
  const atCutoff = project(record, timestamp);
  assert.equal(atCutoff.evidence.some(item => item.evidenceTimestamp === timestamp), false);
  assert.deepEqual(atCutoff.exclusions.find(item => item.sourceRecordId === sourceRecordId), {
    sourceRecordId,
    evidenceKind: "visit_observed_outcome",
    evidenceTimestamp: timestamp,
    reason: "at_decision_timestamp_without_prior_availability"
  });
  assert.ok(atCutoff.exclusions.some(item => item.reason === "after_decision_timestamp"));
  assert.equal(atCutoff.evidence.every(item => item.evidenceTimestamp < timestamp), true);
});

test("visit-completion context remains post-action evidence rather than a frozen candidate snapshot", () => {
  const record = archive();
  const visit = record.normalizedRecord.verifiedFields.completedVisits[0];
  const timestamp = visit.sourceReport.timestamp;
  replaceNormalized(record, normalized => {
    const completed = normalized.verifiedFields.completedVisits[0];
    completed.visitDecisionSource = {
      sourceId: "route_iq_recommendation",
      reason: "The representative identified the source while logging the completed visit.",
      evidence: [{ evidenceType: "route_selection", sourceRecordId: `dashboard-visit:${completed.visitId}` }],
      confidence: 1,
      capturedAt: timestamp,
      temporalClassification: "action_time_observation"
    };
    completed.recommendationDecisionContext = {
      recommendationAvailable: true,
      recommendationId: "route-recommendation:historical-observation",
      decision: "accepted"
    };
  });

  const decisionContextId = `${record.normalizedRecord.sessionId}:${visit.visitId}:decision-context`;
  const observedOutcomeId = `${record.normalizedRecord.sessionId}:${visit.visitId}:observed-outcome`;
  const atAction = project(record, timestamp);
  assert.equal(atAction.decisionTimestamp, timestamp);
  assert.equal(atAction.evidence.some(item => [decisionContextId, observedOutcomeId].includes(item.sourceRecordId)), false);
  assert.deepEqual(
    atAction.exclusions.filter(item => [decisionContextId, observedOutcomeId].includes(item.sourceRecordId)),
    [
      { sourceRecordId: decisionContextId, evidenceKind: "visit_decision_context", evidenceTimestamp: timestamp, reason: "at_decision_timestamp_without_prior_availability" },
      { sourceRecordId: observedOutcomeId, evidenceKind: "visit_observed_outcome", evidenceTimestamp: timestamp, reason: "at_decision_timestamp_without_prior_availability" }
    ]
  );

  const afterAction = project(record, new Date(Date.parse(timestamp) + 1).toISOString());
  const decisionContext = afterAction.evidence.find(item => item.sourceRecordId === decisionContextId);
  const observedOutcome = afterAction.evidence.find(item => item.sourceRecordId === observedOutcomeId);
  assert.equal(decisionContext.evidenceKind, "visit_decision_context");
  assert.equal(observedOutcome.evidenceKind, "visit_observed_outcome");
  assert.ok(decisionContext.evidenceTimestamp < afterAction.decisionTimestamp);
  assert.equal(decisionContext.payload.visitDecisionSource.capturedAt, timestamp);
  assert.deepEqual(Object.keys(decisionContext.payload).sort(), ["recommendationDecisionContext", "visitDecisionSource", "visitId"]);
  for (const preActionField of ["candidateSnapshot", "rankedCandidateDecisions", "probabilities", "evidenceCutoffTimestamp", "modelVersion", "ruleVersion"]) {
    assert.equal(Object.hasOwn(decisionContext.payload, preActionField), false);
  }
});

test("legacy late Unknown enters projections only after its truthful finalization timestamp", () => {
  const record = archive();
  const visit = record.normalizedRecord.verifiedFields.completedVisits[0];
  const visitTimestamp = visit.sourceReport.timestamp;
  const capturedAt = new Date(Date.parse(visitTimestamp) + 60_000).toISOString();
  replaceNormalized(record, normalized => {
    const completed = normalized.verifiedFields.completedVisits[0];
    completed.visitDecisionSource = {
      sourceId: "unknown",
      reason: null,
      evidence: [],
      confidence: 0,
      capturedAt,
      temporalClassification: "late_report_finalization_unknown"
    };
    completed.recommendationDecisionContext = {
      recommendationAvailable: null,
      recommendationId: null,
      decision: null
    };
  });

  const sourceRecordId = `${record.normalizedRecord.sessionId}:${visit.visitId}:decision-context`;
  const beforeCapture = project(record, new Date(Date.parse(capturedAt) - 1).toISOString());
  assert.equal(beforeCapture.evidence.some(item => item.sourceRecordId === sourceRecordId), false);
  assert.equal(beforeCapture.exclusions.find(item => item.sourceRecordId === sourceRecordId).reason, "after_decision_timestamp");

  const atCapture = project(record, capturedAt);
  assert.equal(atCapture.evidence.some(item => item.sourceRecordId === sourceRecordId), false);
  assert.equal(atCapture.exclusions.find(item => item.sourceRecordId === sourceRecordId).reason, "at_decision_timestamp_without_prior_availability");

  const afterCapture = project(record, new Date(Date.parse(capturedAt) + 1).toISOString());
  const included = afterCapture.evidence.find(item => item.sourceRecordId === sourceRecordId);
  assert.equal(included.evidenceTimestamp, capturedAt);
  assert.equal(included.payload.visitDecisionSource.temporalClassification, "late_report_finalization_unknown");
  assert.equal(included.payload.recommendationDecisionContext.decision, null);
  assert.ok(included.evidenceTimestamp > visitTimestamp);
});

test("corrections and conflicts remain separate append-only outcome observations", () => {
  const record = archive();
  replaceHistory(record, history => {
    history.chronologicalEvidence = [
      {
        evidenceKind: "customer_outcome_observation",
        sourceRecordId: "original-outcome",
        evidenceTimestamp: "2026-07-12T01:59:00.000Z",
        context: { workspaceId: "fitness_connection", operatingProfileId: "fitness", representativeId: "cruz", territoryId: null, customerId: "customer-1", customerName: null },
        payload: { outcome: "original", units: 0 },
        relation: { type: "original", priorSourceRecordId: null }
      },
      {
        evidenceKind: "customer_outcome_observation",
        sourceRecordId: "outcome-correction-1",
        evidenceTimestamp: "2026-07-12T02:00:00.000Z",
        context: { workspaceId: "fitness_connection", operatingProfileId: "fitness", representativeId: "cruz", territoryId: null, customerId: "customer-1", customerName: null },
        payload: { outcome: "corrected", units: 1 },
        relation: { type: "correction", priorSourceRecordId: "original-outcome" }
      },
      {
        evidenceKind: "customer_outcome_observation",
        sourceRecordId: "outcome-conflict-1",
        evidenceTimestamp: "2026-07-12T02:01:00.000Z",
        context: { workspaceId: "fitness_connection", operatingProfileId: "fitness", representativeId: "cruz", territoryId: null, customerId: "customer-1", customerName: null },
        payload: { outcome: "conflicting", units: 0 },
        relation: { type: "conflict", priorSourceRecordId: "outcome-correction-1" }
      }
    ];
  });
  const result = project(record, "2026-07-12T03:00:00.000Z");
  assert.deepEqual(result.evidence.filter(item => item.sourceRecordId === "original-outcome" || item.sourceRecordId.startsWith("outcome-")).map(item => item.relation.type), ["original", "correction", "conflict"]);
  assert.ok(result.evidence.some(item => item.evidenceKind === "visit_observed_outcome"));
});

test("missing and late outcomes are explicit rather than inferred", () => {
  const record = archive();
  replaceHistory(record, history => {
    history.chronologicalEvidence = [{ evidenceKind: "customer_outcome_observation", sourceRecordId: "late-outcome", evidenceTimestamp: "2026-07-13T00:00:00.000Z", context: { workspaceId: "fitness_connection", operatingProfileId: "fitness", representativeId: "cruz" }, payload: { outcome: null }, relation: { type: "original", priorSourceRecordId: null } }];
  });
  const result = project(record);
  assert.ok(result.exclusions.some(item => item.sourceRecordId === "late-outcome" && item.reason === "after_decision_timestamp"));
  assert.equal(result.evidence.some(item => item.sourceRecordId === "late-outcome"), false);
});

test("projection is deterministic, deeply immutable, and verifies exact source bytes", () => {
  const record = archive();
  const first = project(record);
  const second = project(record);
  assert.deepEqual(first, second);
  assert.equal(Object.isFrozen(first.evidence[0].payload), true);
  assert.throws(() => { first.evidence.push({}); }, TypeError);
  record.sourceArtifacts.normalized.text += " ";
  assert.throws(() => project(record), error => error instanceof FieldSessionArchiveError && error.code === "field_session_evidence_source_hash_mismatch");
});

test("malformed timestamps and invalid or contaminated scopes fail closed", () => {
  assert.throws(() => project(archive(), "July 11"), error => error.code === "field_session_evidence_timestamp_invalid");
  const malformed = archive();
  replaceHistory(malformed, history => {
    history.chronologicalEvidence = [{ evidenceKind: "customer_outcome_observation", sourceRecordId: "malformed-time", evidenceTimestamp: "tomorrow", context: { workspaceId: "fitness_connection", operatingProfileId: "fitness", representativeId: "cruz" }, payload: null, relation: { type: "original", priorSourceRecordId: null } }];
  });
  assert.throws(() => project(malformed), error => error.code === "field_session_evidence_timestamp_invalid");
  const impossible = archive();
  replaceHistory(impossible, history => {
    history.chronologicalEvidence = [{ evidenceKind: "customer_outcome_observation", sourceRecordId: "impossible-time", evidenceTimestamp: "2026-02-31T00:00:00.000Z", context: { workspaceId: "fitness_connection", operatingProfileId: "fitness", representativeId: "cruz" }, payload: null, relation: { type: "original", priorSourceRecordId: null } }];
  });
  assert.throws(() => project(impossible), error => error.code === "field_session_evidence_timestamp_invalid");
  const contaminated = archive();
  replaceHistory(contaminated, history => {
    history.chronologicalEvidence = [{ evidenceKind: "customer_outcome_observation", sourceRecordId: "foreign", evidenceTimestamp: "2026-07-11T20:00:00.000Z", context: { workspaceId: "fitness_connection", operatingProfileId: "fitness", representativeId: "anthony" }, payload: null, relation: { type: "original", priorSourceRecordId: null } }];
  });
  assert.throws(() => project(contaminated), error => error.code === "field_session_evidence_scope_mismatch");
  assert.throws(() => projectRouteIqChronologicalEvidence({ archiveRecord: archive(), decisionTimestamp: "2026-07-12T01:00:00.000Z", workspaceId: "smoothie_depot", operatingProfileId: "fitness", representativeId: "cruz" }), error => error.code === "field_session_workspace_unknown");
});

test("unsupported evidence kinds are explicitly excluded", () => {
  const record = archive();
  replaceHistory(record, history => {
    history.chronologicalEvidence = [{ evidenceKind: "recommendation_score", sourceRecordId: "unsupported-1", evidenceTimestamp: "2026-07-11T20:00:00.000Z", context: { workspaceId: "fitness_connection", operatingProfileId: "fitness", representativeId: "cruz" }, payload: { score: 99 } }];
  });
  const result = project(record);
  assert.deepEqual(result.exclusions.find(item => item.sourceRecordId === "unsupported-1"), { sourceRecordId: "unsupported-1", evidenceKind: "recommendation_score", reason: "unsupported_evidence_kind" });
});

test("unsupported evidence cannot hide foreign scope", () => {
  const record = archive();
  replaceHistory(record, history => {
    history.chronologicalEvidence = [{ evidenceKind: "recommendation_score", sourceRecordId: "foreign-unsupported", evidenceTimestamp: "2026-07-11T20:00:00.000Z", context: { workspaceId: "foreign_workspace", operatingProfileId: "fitness", representativeId: "anthony" }, payload: null }];
  });
  assert.throws(() => project(record), error => error.code === "field_session_evidence_scope_mismatch");
});

test("projection requires a committed marker matching scope and raw provenance", () => {
  for (const mutate of [
    record => { record.commit.status = "pending"; },
    record => { record.commit.workspaceId = "smoothie_depot"; },
    record => { record.commit.sessionId = "another-session"; },
    record => { record.commit.operatingProfileId = "another-profile"; },
    record => { record.commit.rawSha256 = "0".repeat(64); }
  ]) {
    const record = archive();
    mutate(record);
    assert.throws(() => project(record), error => error.code === "field_session_evidence_commit_mismatch");
  }
});

test("append-only relation types, prior IDs, and self-reference fail closed", () => {
  for (const relation of [
    null,
    { type: "replacement", priorSourceRecordId: "prior" },
    { type: "correction", priorSourceRecordId: "" },
    { type: "correction", priorSourceRecordId: " prior " },
    { type: "conflict", priorSourceRecordId: null },
    { type: "late", priorSourceRecordId: "relation-test" },
    { type: "original", priorSourceRecordId: "prior" }
  ]) {
    const record = archive();
    replaceHistory(record, history => {
      history.chronologicalEvidence = [{ evidenceKind: "customer_outcome_observation", sourceRecordId: "relation-test", evidenceTimestamp: "2026-07-11T20:00:00.000Z", context: { workspaceId: "fitness_connection", operatingProfileId: "fitness", representativeId: "cruz" }, payload: null, relation }];
    });
    assert.throws(() => project(record), error => error.code === "field_session_evidence_relation_invalid");
  }
});

test("valid late and correction records may reference a prior record outside the cutoff", () => {
  const record = archive();
  replaceHistory(record, history => {
    history.chronologicalEvidence = [
      { evidenceKind: "customer_outcome_observation", sourceRecordId: "prior-outside-projection", evidenceTimestamp: "2026-07-13T00:00:00.000Z", context: { workspaceId: "fitness_connection", operatingProfileId: "fitness", representativeId: "cruz" }, payload: { outcome: "future" }, relation: { type: "original", priorSourceRecordId: null } },
      { evidenceKind: "customer_outcome_observation", sourceRecordId: "late-chain", evidenceTimestamp: "2026-07-11T20:00:00.000Z", context: { workspaceId: "fitness_connection", operatingProfileId: "fitness", representativeId: "cruz" }, payload: { outcome: "late" }, relation: { type: "late", priorSourceRecordId: "prior-outside-projection" } },
      { evidenceKind: "customer_outcome_observation", sourceRecordId: "correction-chain", evidenceTimestamp: "2026-07-11T21:00:00.000Z", context: { workspaceId: "fitness_connection", operatingProfileId: "fitness", representativeId: "cruz" }, payload: { outcome: "corrected" }, relation: { type: "correction", priorSourceRecordId: "late-chain" } }
    ];
  });
  const result = project(record);
  assert.deepEqual(result.evidence.filter(item => item.sourceRecordId.endsWith("-chain")).map(item => item.relation), [
    { type: "late", priorSourceRecordId: "prior-outside-projection" },
    { type: "correction", priorSourceRecordId: "late-chain" }
  ]);
  assert.ok(result.exclusions.some(item => item.sourceRecordId === "prior-outside-projection" && item.reason === "after_decision_timestamp"));
});

test("correction, conflict, and late relations reject nonexistent source records", () => {
  for (const type of ["correction", "conflict", "late"]) {
    const record = archive();
    replaceHistory(record, history => {
      history.chronologicalEvidence = [{
        evidenceKind: "customer_outcome_observation",
        sourceRecordId: `${type}-missing-prior`,
        evidenceTimestamp: "2026-07-11T20:00:00.000Z",
        context: { workspaceId: "fitness_connection", operatingProfileId: "fitness", representativeId: "cruz" },
        payload: { outcome: type },
        relation: { type, priorSourceRecordId: "does-not-exist" }
      }];
    });
    assert.throws(() => project(record), error => error.code === "field_session_evidence_relation_source_missing"
      && error.details.priorSourceRecordId === "does-not-exist");
  }

  const unsupported = archive();
  replaceHistory(unsupported, history => {
    history.chronologicalEvidence = [{
      evidenceKind: "unsupported_outcome_kind",
      sourceRecordId: "unsupported-correction-missing-prior",
      evidenceTimestamp: "2026-07-11T20:00:00.000Z",
      context: { workspaceId: "fitness_connection", operatingProfileId: "fitness", representativeId: "cruz" },
      payload: null,
      relation: { type: "correction", priorSourceRecordId: "does-not-exist" }
    }];
  });
  assert.throws(() => project(unsupported), error => error.code === "field_session_evidence_relation_source_missing");
});
