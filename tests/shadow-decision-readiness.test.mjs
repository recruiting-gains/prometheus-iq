import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  appendOutcomeLink,
  buildFounderReadinessReport,
  buildProspectiveShadowLedger,
  createShadowExclusion,
  derivedSupport,
  generateShadowDecision,
  loadShadowDecisionConfig,
  requiredSampleSize,
  sealShadowLedger,
  validateChronologicalWindows,
  validateProspectiveLedgerCompleteness,
  validateRankedCandidates,
  validateShadowExclusion,
} from "../intelligence/shadow-decision-readiness.mjs";
import {
  requiredProtectedBehaviorBaselineKeys,
  validateShadowDecisionContractCoherence,
  verifyShadowDecisionReadiness,
} from "../scripts/verify-shadow-decision-readiness.mjs";

const fixture = JSON.parse(
  readFileSync(
    "intelligence/fixtures/shadow-decision-validation-only-v1.json",
    "utf8",
  ),
);
const config = loadShadowDecisionConfig();
const scope = {
  workspaceId: "fitness_connection",
  operatingProfileId: "fitness",
  representativeId: "cruz",
  territoryId: "north",
  customerContext: "auto",
  decisionType: "next_stop",
};
const digest = (value) => createHash("sha256").update(value).digest("hex");
const stableJson = (value) => {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  return JSON.stringify(value);
};
const rehashProjection = (value) => {
  const { projectionSha256: _ignored, ...body } = value;
  return { ...body, projectionSha256: digest(stableJson(body)) };
};
const projection = (timestamp) => ({
  ...(() => {
    const body = {
      projectionVersion: "route-iq-chronological-evidence-projection-v1",
      decisionTimestamp: timestamp,
      scope: {
        workspaceId: scope.workspaceId,
        operatingProfileId: scope.operatingProfileId,
        representativeId: scope.representativeId,
      },
      evidence: [
        {
          sourceRecordId: `projection-evidence-${timestamp}`,
          evidenceTimestamp: new Date(Date.parse(timestamp) - 1).toISOString(),
        },
      ],
      exclusions: [],
    };
    return { ...body, projectionSha256: digest(stableJson(body)) };
  })(),
});
const opportunity = (index, timestamp, overrides = {}) => {
  const sourceA = {
      sourceId: `evidence-a-${index}`,
      sha256: digest(`a-${index}`),
      availableAt: new Date(Date.parse(timestamp) - 3000).toISOString(),
    },
    sourceB = {
      sourceId: `evidence-b-${index}`,
      sha256: digest(`b-${index}`),
      availableAt: new Date(Date.parse(timestamp) - 2500).toISOString(),
    };
  return {
    opportunityId: `fixture-opportunity-${index}`,
    timestamp,
    sourceManifest: { sourceA, sourceB },
    candidateSnapshot: [
      {
        decisionId: "A",
        weight: 9,
        availableAt: new Date(Date.parse(timestamp) - 2000).toISOString(),
        evidenceSourceIds: [sourceA.sourceId],
        eligibilityReasons: ["governed_candidate"],
      },
      {
        decisionId: "B",
        weight: 1,
        availableAt: new Date(Date.parse(timestamp) - 1000).toISOString(),
        evidenceSourceHashes: [sourceB.sha256],
        eligibilityReasons: ["governed_candidate"],
      },
    ],
    evidenceSchemaVersion: "fixture-v1",
    scope,
    ...overrides,
  };
};

function record(index, timestamp, overrides = {}) {
  return generateShadowDecision({
    opportunity: opportunity(index, timestamp, overrides),
    projection: projection(timestamp),
    config,
  });
}
function exclusion(index, timestamp, overrides = {}) {
  return createShadowExclusion({
    opportunityId: `fixture-exclusion-${index}`,
    timestamp,
    reasonCodes: ["governed_fixture_exclusion"],
    projection: projection(timestamp),
    scope,
    evidenceSchemaVersion: "fixture-v1",
    config,
    ...overrides,
  });
}
function ledger(records, exclusions = []) {
  return sealShadowLedger({
    batchId: config.batchId,
    schemaVersion: "route-iq-shadow-ledger-v1",
    engineVersion: "route-iq-shadow-decision-readiness-v1",
    scope: config.scope,
    opportunityManifest: [...records, ...exclusions].map((item) => ({
      opportunityId: item.opportunityId,
      timestamp: item.timestamp,
    })),
    immutable: true,
    records: Object.freeze(records),
    exclusions,
    outcomeLinks: [],
    recommendationInfluence: "OFF",
    founderOnly: true,
    readOnly: true,
  });
}
function linkedFixture({
  badSegment = false,
  evaluationCount = 97,
  trainingCount = 97,
  unstable = false,
  unsupportedBin = false,
  futureTrainingOutcomes = false,
  noOutcomeTerritoryCount = 0,
  skipEvaluationTailCount = 0,
} = {}) {
  const records = [];
  for (let index = 0; index < trainingCount; index += 1)
    records.push(
      record(
        index,
        `2026-${String(1 + Math.floor(index / 28)).padStart(2, "0")}-${String((index % 28) + 1).padStart(2, "0")}T12:00:00.000Z`,
      ),
    );
  for (let index = 0; index < evaluationCount; index += 1) {
    const first = index < 49,
      day = first ? (index % 6) + 1 : (index % 6) + 9;
    const segment =
      badSegment && index < 10
        ? { scope: { ...scope, territoryId: "materially-failing" } }
        : noOutcomeTerritoryCount > 0 &&
            index >= evaluationCount - noOutcomeTerritoryCount
          ? { scope: { ...scope, territoryId: "no-outcome-territory" } }
          : {};
    const timestamp = `2026-07-${String(day).padStart(2, "0")}T${String(Math.floor(index / 6) % 24).padStart(2, "0")}:00:00.000Z`;
    const equalWeights =
      unsupportedBin && index === 0
        ? {
            candidateSnapshot: opportunity(
              trainingCount + index,
              timestamp,
            ).candidateSnapshot.map((candidate) => ({
              ...candidate,
              weight: 1,
            })),
          }
        : {};
    records.push(
      record(trainingCount + index, timestamp, { ...segment, ...equalWeights }),
    );
  }
  let result = ledger(records);
  for (let index = 0; index < records.length; index += 1) {
    const training = index < trainingCount,
      evaluationIndex = index - trainingCount,
      failing = badSegment && evaluationIndex >= 0 && evaluationIndex < 10,
      unstableFailure = unstable && evaluationIndex >= 49,
      noOutcomeTerritory =
        evaluationIndex >= evaluationCount - noOutcomeTerritoryCount,
      skippedTail =
        evaluationIndex >= evaluationCount - skipEvaluationTailCount;
    if (!training && (noOutcomeTerritory || skippedTail)) continue;
    result = appendOutcomeLink(result, {
      linkId: `fixture-outcome-${index}`,
      shadowDecisionId: records[index].shadowDecisionId,
      relation: "original",
      priorLinkId: null,
      observedAt: new Date(
        training && futureTrainingOutcomes
          ? Date.parse("2026-07-01T00:00:01.000Z")
          : Date.parse(records[index].timestamp) + 1000,
      ).toISOString(),
      actualDecisionId: training ? "off-list-action" : "A",
      observedOutcome: {
        status: "observed",
        value: !(training || failing || unstableFailure),
        evaluatedDecisionId: "A",
      },
      status: "observed",
      scope: records[index].scope,
    });
  }
  return result;
}

test("canonical archive remains four exclusions and fixture is never canonical", () => {
  assert.equal(
    fixture.fixtureClassification,
    "VALIDATION_ONLY_NON_PRODUCTION_NEVER_CANONICAL",
  );
  assert.equal(fixture.canonicalGenerationAllowed, false);
  const before = readFileSync(
    "intelligence/artifacts/shadow-decision-readiness-v1/fitness_connection/cruz/founder-readiness-report-v1.json",
    "utf8",
  );
  assert.deepEqual(verifyShadowDecisionReadiness(), {
    status: "passed",
    batchId: config.batchId,
    readinessState: "INSUFFICIENT_EVIDENCE",
    opportunities: 4,
    shadows: 0,
    exclusions: 4,
    recommendationInfluence: "OFF",
  });
  linkedFixture();
  assert.equal(
    readFileSync(
      "intelligence/artifacts/shadow-decision-readiness-v1/fitness_connection/cruz/founder-readiness-report-v1.json",
      "utf8",
    ),
    before,
  );
});

test("prospective generator is deterministic, internal, normalized, and leakage-safe", () => {
  const timestamp = "2026-07-02T12:00:00.000Z";
  const first = record(1, timestamp),
    second = record(1, timestamp);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(
    first.rankedCandidateDecisions.reduce(
      (sum, item) => sum + item.probability,
      0,
    ),
    1,
  );
  assert.equal(
    first.rankedCandidateDecisions[0].tieBreakRule,
    "probability_desc_then_decision_id_ascending",
  );
  assert.equal(first.rankedCandidateDecisions[0].evidenceSourceIds.length, 1);
  assert.throws(
    () =>
      record(8, timestamp, {
        candidateSnapshot: [
          {
            ...opportunity(8, timestamp).candidateSnapshot[0],
            availableAt: timestamp,
          },
        ],
      }),
    /candidate_temporal_leakage/,
  );
  assert.throws(
    () =>
      generateShadowDecision({
        opportunity: opportunity(2, timestamp),
        projection: rehashProjection({
          ...projection(timestamp),
          evidence: [{ evidenceTimestamp: timestamp }],
        }),
        config,
      }),
    /temporal_leakage/,
  );
  assert.throws(
    () =>
      generateShadowDecision({
        opportunity: opportunity(2, timestamp),
        projection: rehashProjection({
          ...projection(timestamp),
          evidence: [{ evidenceTimestamp: "2026-07-02T12:00:01.000Z" }],
        }),
        config,
      }),
    /temporal_leakage/,
  );
  assert.throws(
    () =>
      record(2, timestamp, {
        candidateSnapshot: [
          { ...opportunity(2, timestamp).candidateSnapshot[0] },
          { ...opportunity(2, timestamp).candidateSnapshot[0] },
        ],
      }),
    /candidate_decision_id_invalid/,
  );
});

test("scope contamination and incomplete opportunities fail closed", () => {
  const timestamp = "2026-07-02T12:00:00.000Z";
  for (const contaminated of [
    { ...scope, workspaceId: "smoothie_depot" },
    { ...scope, representativeId: "anthony" },
    { ...scope, territoryId: "unknown", representativeId: "unknown" },
  ])
    assert.throws(
      () => record(3, timestamp, { scope: contaminated }),
      /scope_not_authorized/,
    );
  assert.throws(
    () =>
      generateShadowDecision({
        opportunity: { timestamp, scope },
        projection: projection(timestamp),
        config,
      }),
    /opportunity_context_incomplete/,
  );
});

test("ranking rejects blank and duplicate IDs and invalid probability contracts", () => {
  assert.throws(
    () =>
      validateRankedCandidates([
        {
          rank: 1,
          decisionId: "",
          probability: 1,
          tieBreakRule: "probability_desc_then_decision_id_ascending",
        },
      ]),
    /candidate_decision_id_invalid/,
  );
  assert.throws(
    () =>
      validateRankedCandidates([
        {
          rank: 1,
          decisionId: "A",
          probability: 0.5,
          tieBreakRule: "probability_desc_then_decision_id_ascending",
        },
        {
          rank: 2,
          decisionId: "A",
          probability: 0.5,
          tieBreakRule: "probability_desc_then_decision_id_ascending",
        },
      ]),
    /candidate_decision_id_invalid/,
  );
  assert.throws(
    () =>
      validateRankedCandidates([
        {
          rank: 1,
          decisionId: "A",
          probability: NaN,
          tieBreakRule: "probability_desc_then_decision_id_ascending",
        },
      ]),
    /candidate_probability_invalid/,
  );
});

test("outcome relations are governed, chronological, scoped, and append-only", () => {
  const originalRecord = record(4, "2026-07-02T12:00:00.000Z"),
    originalBytes = JSON.stringify(originalRecord);
  let value = ledger([originalRecord]);
  const base = {
    shadowDecisionId: originalRecord.shadowDecisionId,
    actualDecisionId: "off-list-action",
    observedOutcome: {
      status: "observed",
      value: true,
      evaluatedDecisionId: "A",
    },
    scope: originalRecord.scope,
  };
  value = appendOutcomeLink(value, {
    ...base,
    linkId: "missing",
    relation: "missing",
    priorLinkId: null,
    observedAt: null,
    actualDecisionId: null,
    observedOutcome: {
      status: "missing",
      value: null,
      evaluatedDecisionId: null,
    },
    status: "missing",
  });
  value = appendOutcomeLink(value, {
    ...base,
    linkId: "late",
    relation: "late",
    priorLinkId: "missing",
    observedAt: "2026-07-03T12:00:00.000Z",
    status: "late",
  });
  assert.equal(value.outcomeLinks.at(-1).actionDisposition, "off_list");
  assert.equal(value.outcomeLinks.at(-1).decisionAgreement, false);
  value = appendOutcomeLink(value, {
    ...base,
    linkId: "correction",
    relation: "correction",
    priorLinkId: "late",
    observedAt: "2026-07-04T12:00:00.000Z",
    observedOutcome: {
      status: "observed",
      value: false,
      evaluatedDecisionId: "A",
    },
    status: "corrected",
  });
  value = appendOutcomeLink(value, {
    ...base,
    linkId: "conflict",
    relation: "conflict",
    priorLinkId: "correction",
    observedAt: "2026-07-05T12:00:00.000Z",
    observedOutcome: {
      status: "unresolved_conflict",
      value: null,
      evaluatedDecisionId: null,
    },
    status: "conflicting",
  });
  assert.equal(JSON.stringify(value.records[0]), originalBytes);
  assert.throws(
    () =>
      appendOutcomeLink(ledger([originalRecord]), {
        ...base,
        linkId: "rewrite",
        relation: "rewrite",
        priorLinkId: null,
        observedAt: "2026-07-03T00:00:00.000Z",
      }),
    /outcome_relation_invalid/,
  );
  assert.throws(
    () =>
      appendOutcomeLink(ledger([originalRecord]), {
        ...base,
        linkId: "early",
        relation: "original",
        priorLinkId: null,
        observedAt: "2020-01-01T00:00:00.000Z",
      }),
    /outcome_not_after/,
  );
  assert.throws(
    () =>
      appendOutcomeLink(
        appendOutcomeLink(ledger([originalRecord]), {
          ...base,
          linkId: "original-1",
          relation: "original",
          priorLinkId: null,
          observedAt: "2026-07-03T00:00:00.000Z",
        }),
        {
          ...base,
          linkId: "original-2",
          relation: "original",
          priorLinkId: null,
          observedAt: "2026-07-04T00:00:00.000Z",
        },
      ),
    /second_root/,
  );
  assert.throws(
    () =>
      appendOutcomeLink(value, {
        ...base,
        linkId: "out-of-order",
        relation: "correction",
        priorLinkId: "conflict",
        observedAt: "2026-07-04T00:00:00.000Z",
      }),
    /not_after_prior/,
  );
  assert.throws(
    () =>
      appendOutcomeLink(ledger([originalRecord]), {
        ...base,
        linkId: "foreign",
        relation: "original",
        priorLinkId: null,
        observedAt: "2026-07-06T00:00:00.000Z",
        scope: { ...scope, representativeId: "anthony" },
      }),
    /scope_contaminated/,
  );
});

test("support is mathematical and overlap fails closed", () => {
  assert.equal(requiredSampleSize(config), 97);
  assert.deepEqual(derivedSupport(config), {
    sample: 97,
    perCalibrationBin: 20,
    perSegment: 10,
    windowMinimums: [49, 48],
  });
  assert.throws(
    () =>
      validateChronologicalWindows([
        {
          id: "a",
          kind: "training",
          start: "2026-01-01T00:00:00.000Z",
          endExclusive: "2026-02-01T00:00:00.000Z",
        },
        {
          id: "b",
          kind: "evaluation",
          start: "2026-01-31T00:00:00.000Z",
          endExclusive: "2026-03-01T00:00:00.000Z",
        },
      ]),
    /evaluation_window_overlap/,
  );
});

test("prospective manifest enforces exactly one disposition", () => {
  const timestamp = "2026-07-02T12:00:00.000Z",
    generated = record(50, timestamp),
    manifest = [
      {
        opportunityId: generated.opportunityId,
        timestamp: generated.timestamp,
      },
    ];
  assert.equal(
    validateProspectiveLedgerCompleteness(manifest, [generated], []),
    true,
  );
  assert.throws(
    () => validateProspectiveLedgerCompleteness(manifest, [], []),
    /disposition_missing/,
  );
  assert.throws(
    () =>
      validateProspectiveLedgerCompleteness(
        manifest,
        [generated],
        [
          exclusion(50, timestamp, {
            opportunityId: generated.opportunityId,
          }),
        ],
      ),
    /dual_disposition/,
  );
  assert.throws(
    () =>
      validateProspectiveLedgerCompleteness(
        [...manifest, ...manifest],
        [generated],
        [],
      ),
    /manifest_id_invalid/,
  );
  assert.equal(
    buildProspectiveShadowLedger({
      opportunities: [
        {
          opportunity: opportunity(51, timestamp),
          projection: projection(timestamp),
        },
      ],
    }).records.length,
    1,
  );
});

test("all three states are executable and gate evidence is computed", () => {
  const insufficient = buildFounderReadinessReport(
    linkedFixture({ evaluationCount: 20, trainingCount: 20 }),
    config,
  );
  assert.equal(insufficient.state, "INSUFFICIENT_EVIDENCE");
  assert.ok(
    insufficient.reasonCodes.includes(
      "baseline_training_sample_below_required_97",
    ),
  );
  const observing = buildFounderReadinessReport(
    linkedFixture({ badSegment: true }),
    config,
  );
  assert.equal(observing.state, "OBSERVING");
  assert.equal(observing.gates.segment_safety, "NOT_MET");
  const eligible = buildFounderReadinessReport(linkedFixture(), config);
  assert.equal(eligible.state, "ELIGIBLE_FOR_FOUNDER_REVIEW");
  assert.equal(eligible.metrics.outcomeAccuracy, 1);
  assert.equal(eligible.metrics.decisionAgreement, 1);
  assert.ok(
    eligible.metrics.calibrationBrierScore <
      config.calibrationMaximumBrierScore,
  );
  assert.ok(eligible.metrics.calibrationEce <= config.calibrationMaximumEce);
  assert.ok(
    eligible.metrics.calibrationBins.some(
      (bin) =>
        bin.supported &&
        bin.predictedMean !== null &&
        bin.observedRate !== null,
    ),
  );
  assert.equal(eligible.metrics.performanceStability.accuracyDelta, 0);
  assert.ok(eligible.metrics.performanceAgainstObservationalBaseline > 0);
  assert.equal(
    Object.values(eligible.gates).every((value) => value === "PASS"),
    true,
  );
  assert.equal(eligible.recommendationInfluence, "OFF");
  assert.equal(eligible.eligibilityDoesNotAuthorizeActivation, true);
  const unstable = buildFounderReadinessReport(
    linkedFixture({ unstable: true }),
    config,
  );
  assert.equal(unstable.state, "OBSERVING");
  assert.equal(unstable.gates.calibration_stability, "NOT_MET");
});

test("missing outcomes remain unavailable and current evidence gates do not pass vacuously", () => {
  const noOutcomes = buildFounderReadinessReport(
    ledger([record(400, "2026-07-02T12:00:00.000Z")]),
    config,
  );
  assert.equal(noOutcomes.metrics.outcomeAccuracy, null);
  assert.equal(noOutcomes.metrics.calibrationEce, null);
  assert.equal(
    noOutcomes.evidenceReadinessGates.evaluation_validity,
    "NOT_MET",
  );
  const canonical = JSON.parse(
    readFileSync(
      "intelligence/artifacts/shadow-decision-readiness-v1/fitness_connection/cruz/founder-readiness-report-v1.json",
      "utf8",
    ),
  );
  assert.equal(canonical.state, "INSUFFICIENT_EVIDENCE");
  assert.equal(canonical.gates.statistical_sufficiency, "NOT_MET");
  assert.equal(canonical.gates.calibration_stability, "NOT_MET");
});

test("blank and unresolved candidate provenance fails closed", () => {
  const timestamp = "2026-07-02T12:00:00.000Z",
    baseOpportunity = opportunity(500, timestamp);
  assert.throws(
    () =>
      record(500, timestamp, {
        candidateSnapshot: [
          { ...baseOpportunity.candidateSnapshot[0], evidenceSourceIds: [""] },
        ],
      }),
    /reference_unresolved/,
  );
  assert.throws(
    () =>
      record(501, timestamp, {
        candidateSnapshot: [
          {
            ...opportunity(501, timestamp).candidateSnapshot[0],
            eligibilityReasons: [" "],
          },
        ],
      }),
    /eligibility_reasons/,
  );
  assert.throws(
    () =>
      record(502, timestamp, {
        candidateSnapshot: [
          {
            ...opportunity(502, timestamp).candidateSnapshot[0],
            evidenceSourceIds: ["does-not-exist"],
          },
        ],
      }),
    /reference_unresolved/,
  );
  assert.throws(
    () =>
      record(503, timestamp, {
        sourceManifest: { "": baseOpportunity.sourceManifest.sourceA },
      }),
    /source_manifest_entry_invalid/,
  );
});

test("source manifest equal and future availability fails closed", () => {
  const timestamp = "2026-07-02T12:00:00.000Z",
    baseOpportunity = opportunity(510, timestamp);
  assert.throws(
    () =>
      record(510, timestamp, {
        sourceManifest: {
          sourceA: {
            ...baseOpportunity.sourceManifest.sourceA,
            availableAt: timestamp,
          },
        },
      }),
    /source_manifest_entry_invalid/,
  );
  assert.throws(
    () =>
      record(511, timestamp, {
        sourceManifest: {
          sourceA: {
            ...opportunity(511, timestamp).sourceManifest.sourceA,
            availableAt: "2026-07-02T12:00:01.000Z",
          },
        },
      }),
    /source_manifest_entry_invalid/,
  );
});

test("projection digest is recomputed and frozen candidate snapshots are bound", () => {
  const timestamp = "2026-07-02T12:00:00.000Z";
  assert.throws(
    () =>
      generateShadowDecision({
        opportunity: opportunity(515, timestamp),
        projection: {
          ...projection(timestamp),
          projectionSha256: "0".repeat(64),
        },
        config,
      }),
    /projection_digest_mismatch/,
  );
  const generated = record(516, timestamp);
  const tampered = structuredClone(generated);
  tampered.rankedCandidateDecisions[0].weight += 1;
  assert.throws(
    () =>
      validateProspectiveLedgerCompleteness(
        [
          {
            opportunityId: tampered.opportunityId,
            timestamp: tampered.timestamp,
          },
        ],
        [tampered],
        [],
      ),
    /frozen_candidate_snapshot_digest_mismatch|shadow_record_digest_mismatch/,
  );
});

test("invalid hashes and blank versions fail closed", () => {
  const timestamp = "2026-07-02T12:00:00.000Z";
  assert.throws(
    () => record(520, timestamp, { evidenceSchemaVersion: "" }),
    /version_or_projection/,
  );
  const invalidProjection = {
    ...projection(timestamp),
    projectionSha256: "not-a-sha256",
  };
  assert.throws(
    () =>
      generateShadowDecision({
        opportunity: opportunity(521, timestamp),
        projection: invalidProjection,
        config,
      }),
    /version_or_projection/,
  );
  assert.throws(
    () =>
      record(522, timestamp, {
        sourceManifest: {
          sourceA: {
            ...opportunity(522, timestamp).sourceManifest.sourceA,
            sha256: "bad",
          },
        },
      }),
    /source_manifest_entry_invalid/,
  );
});

test("canonical tie replay is byte-identical", () => {
  const timestamp = "2026-07-02T13:00:00.000Z",
    baseOpportunity = opportunity(530, timestamp),
    tied = {
      ...baseOpportunity,
      candidateSnapshot: baseOpportunity.candidateSnapshot.map((candidate) => ({
        ...candidate,
        weight: 1,
      })),
    };
  const first = generateShadowDecision({
    opportunity: tied,
    projection: projection(timestamp),
    config,
  });
  const second = generateShadowDecision({
    opportunity: structuredClone(tied),
    projection: structuredClone(projection(timestamp)),
    config,
  });
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.deepEqual(
    first.rankedCandidateDecisions.map((item) => item.decisionId),
    ["A", "B"],
  );
});

test("off-list action outcome is preserved but excluded from candidate scoring", () => {
  const candidate = record(540, "2026-07-02T12:00:00.000Z");
  let value = ledger([candidate]);
  value = appendOutcomeLink(value, {
    linkId: "off-list",
    shadowDecisionId: candidate.shadowDecisionId,
    relation: "original",
    priorLinkId: null,
    observedAt: "2026-07-02T12:00:01.000Z",
    actualDecisionId: "OFF_LIST",
    observedOutcome: {
      status: "observed",
      value: true,
      evaluatedDecisionId: "OFF_LIST",
    },
    scope: candidate.scope,
  });
  const report = buildFounderReadinessReport(value, config);
  assert.equal(value.outcomeLinks[0].actionDisposition, "off_list");
  assert.equal(value.outcomeLinks[0].decisionAgreement, false);
  assert.equal(report.metrics.decisionAgreement, 0);
  assert.equal(report.metrics.outcomeAccuracy, null);
  assert.equal(report.metrics.actualActionLinkRate, 1);
  assert.equal(report.metrics.anyOutcomeLinkRate, 1);
  assert.equal(report.metrics.scoreableSelectedCandidateOutcomeRate, 0);
  assert.equal(report.segments.representativeId.cruz.actualActionLinkCount, 1);
  assert.equal(report.segments.representativeId.cruz.anyOutcomeLinkCount, 1);
  assert.equal(
    report.segments.representativeId.cruz
      .scoreableSelectedCandidateOutcomeCount,
    0,
  );
  assert.equal(report.segments.representativeId.cruz.offListActionCount, 1);
  assert.equal(
    report.segments.timeWindow["evaluation-2026-07a"].decisionAgreement,
    0,
  );
});

test("explicit positive and negative selected-candidate outcomes are scored", () => {
  const positive = record(550, "2026-07-02T12:00:00.000Z"),
    negative = record(551, "2026-07-03T12:00:00.000Z");
  let value = ledger([positive, negative]);
  for (const [index, candidate] of [positive, negative].entries())
    value = appendOutcomeLink(value, {
      linkId: `binary-${index}`,
      shadowDecisionId: candidate.shadowDecisionId,
      relation: "original",
      priorLinkId: null,
      observedAt: new Date(
        Date.parse(candidate.timestamp) + 1000,
      ).toISOString(),
      actualDecisionId: "A",
      observedOutcome: {
        status: "observed",
        value: index === 0,
        evaluatedDecisionId: "A",
      },
      scope: candidate.scope,
    });
  const report = buildFounderReadinessReport(value, config);
  assert.equal(report.metrics.outcomeAccuracy, 0.5);
  assert.ok(report.metrics.calibrationBrierScore > 0);
});

test("action-only link keeps candidate outcome unavailable", () => {
  const candidate = record(560, "2026-07-02T12:00:00.000Z");
  let value = ledger([candidate]);
  value = appendOutcomeLink(value, {
    linkId: "action-only",
    shadowDecisionId: candidate.shadowDecisionId,
    relation: "missing",
    priorLinkId: null,
    observedAt: null,
    actualDecisionId: "B",
    observedOutcome: {
      status: "missing",
      value: null,
      evaluatedDecisionId: null,
    },
    scope: candidate.scope,
  });
  const report = buildFounderReadinessReport(value, config);
  assert.equal(report.metrics.decisionAgreement, 0);
  assert.equal(report.metrics.outcomeAccuracy, null);
  assert.equal(report.metrics.actualActionLinkRate, 1);
  assert.equal(report.metrics.anyOutcomeLinkRate, 1);
  assert.equal(report.metrics.scoreableSelectedCandidateOutcomeRate, 0);
  assert.equal(report.segments.territoryId.north.actualActionLinkCount, 1);
  assert.equal(
    report.segments.territoryId.north.scoreableSelectedCandidateOutcomeCount,
    0,
  );
});

test("unsupported populated calibration bin makes ECE unavailable", () => {
  const report = buildFounderReadinessReport(
    linkedFixture({ unsupportedBin: true }),
    config,
  );
  assert.equal(report.metrics.calibrationEce, null);
  assert.equal(report.gates.calibration_stability, "NOT_MET");
  assert.ok(
    report.metrics.calibrationBins.some(
      (bin) => bin.support > 0 && !bin.supported,
    ),
  );
});

test("training and evaluation source overlap fails closed", () => {
  const trainingRecord = record(565, "2026-06-01T12:00:00.000Z");
  const sharedSources = structuredClone(trainingRecord.immutableSourceManifest);
  const evaluationTimestamp = "2026-07-02T12:00:00.000Z";
  const evaluationRecord = generateShadowDecision({
    opportunity: opportunity(566, evaluationTimestamp, {
      sourceManifest: sharedSources,
      candidateSnapshot: trainingRecord.rankedCandidateDecisions.map(
        (candidate) => ({
          decisionId: candidate.decisionId,
          weight: candidate.weight,
          availableAt: candidate.availableAt,
          evidenceSourceIds: candidate.evidenceSourceIds,
          evidenceSourceHashes: candidate.evidenceSourceHashes,
          eligibilityReasons: candidate.eligibilityReasons,
        }),
      ),
    }),
    projection: projection(evaluationTimestamp),
    config,
  });
  let value = ledger([trainingRecord, evaluationRecord]);
  for (const [index, candidate] of [trainingRecord, evaluationRecord].entries())
    value = appendOutcomeLink(value, {
      linkId: `overlap-${index}`,
      shadowDecisionId: candidate.shadowDecisionId,
      relation: "original",
      priorLinkId: null,
      observedAt: new Date(
        Date.parse(candidate.timestamp) + 1000,
      ).toISOString(),
      actualDecisionId: "A",
      observedOutcome: {
        status: "observed",
        value: true,
        evaluatedDecisionId: "A",
      },
      scope: candidate.scope,
    });
  assert.throws(
    () => buildFounderReadinessReport(value, config),
    /training_evaluation_source_overlap/,
  );
});

test("future-observed training outcomes fail closed before baseline eligibility", () => {
  const value = linkedFixture({ futureTrainingOutcomes: true });
  assert.throws(
    () => buildFounderReadinessReport(value, config),
    /training_outcome_after_evaluation_start/,
  );
});

test("material ten-record territory with no outcomes cannot disappear", () => {
  const report = buildFounderReadinessReport(
    linkedFixture({
      evaluationCount: 107,
      noOutcomeTerritoryCount: 10,
    }),
    config,
  );
  const segment = report.segments.territoryId["no-outcome-territory"];
  assert.equal(segment.eligibleDecisionCount, 10);
  assert.equal(segment.actualActionLinkCount, 0);
  assert.equal(segment.anyOutcomeLinkCount, 0);
  assert.equal(segment.scoreableSelectedCandidateOutcomeCount, 0);
  assert.equal(segment.materiallySupported, true);
  assert.equal(segment.scoreableSupportMet, false);
  assert.equal(segment.passes, false);
  assert.equal(report.gates.segment_safety, "NOT_MET");
  assert.notEqual(report.state, "ELIGIBLE_FOR_FOUNDER_REVIEW");
});

test("incomplete link coverage remains an unresolved readiness risk", () => {
  const report = buildFounderReadinessReport(
    linkedFixture({ evaluationCount: 98, skipEvaluationTailCount: 1 }),
    config,
  );
  assert.equal(report.gates.statistical_sufficiency, "PASS");
  assert.ok(report.metrics.actualActionLinkRate < 1);
  assert.ok(report.metrics.anyOutcomeLinkRate < 1);
  assert.ok(report.metrics.scoreableSelectedCandidateOutcomeRate < 1);
  assert.ok(
    report.reasonCodes.includes("actual_action_link_coverage_incomplete"),
  );
  assert.ok(report.reasonCodes.includes("outcome_link_coverage_incomplete"));
  assert.ok(
    report.reasonCodes.includes(
      "selected_candidate_outcome_coverage_incomplete",
    ),
  );
  assert.equal(report.state, "OBSERVING");
});

test("report requires explicit opportunity manifest", () => {
  const value = structuredClone(
    ledger([record(570, "2026-07-02T12:00:00.000Z")]),
  );
  delete value.opportunityManifest;
  assert.throws(
    () => buildFounderReadinessReport(value, config),
    /opportunity_manifest_missing/,
  );
});

test("undeclared prospective disposition fails closed", () => {
  const candidate = record(580, "2026-07-02T12:00:00.000Z");
  assert.throws(
    () =>
      validateProspectiveLedgerCompleteness(
        [
          {
            opportunityId: "declared",
            timestamp: candidate.timestamp,
          },
        ],
        [candidate],
        [],
      ),
    /disposition_missing|undeclared/,
  );
});

test("missing manifest disposition fails closed", () => {
  assert.throws(
    () =>
      validateProspectiveLedgerCompleteness(
        [
          {
            opportunityId: "missing",
            timestamp: "2026-07-02T12:00:00.000Z",
          },
        ],
        [],
        [],
      ),
    /disposition_missing/,
  );
});

test("duplicate manifest opportunity fails closed", () => {
  assert.throws(
    () =>
      validateProspectiveLedgerCompleteness(
        [
          {
            opportunityId: "duplicate",
            timestamp: "2026-07-02T12:00:00.000Z",
          },
          {
            opportunityId: "duplicate",
            timestamp: "2026-07-02T12:00:00.000Z",
          },
        ],
        [],
        [],
      ),
    /manifest_id_invalid/,
  );
});

test("dual shadow and exclusion disposition fails closed", () => {
  const candidate = record(581, "2026-07-02T12:00:00.000Z");
  assert.throws(
    () =>
      validateProspectiveLedgerCompleteness(
        [
          {
            opportunityId: candidate.opportunityId,
            timestamp: candidate.timestamp,
          },
        ],
        [candidate],
        [
          exclusion(581, candidate.timestamp, {
            opportunityId: candidate.opportunityId,
          }),
        ],
      ),
    /dual_disposition/,
  );
});

test("cross-shadow prior outcome link fails closed", () => {
  const first = record(582, "2026-07-02T12:00:00.000Z"),
    second = record(583, "2026-07-03T12:00:00.000Z"),
    base = {
      relation: "original",
      priorLinkId: null,
      observedAt: "2026-07-02T12:00:01.000Z",
      actualDecisionId: "A",
      observedOutcome: {
        status: "observed",
        value: true,
        evaluatedDecisionId: "A",
      },
      scope: first.scope,
    };
  let value = appendOutcomeLink(ledger([first, second]), {
    ...base,
    linkId: "first-root",
    shadowDecisionId: first.shadowDecisionId,
  });
  assert.throws(
    () =>
      appendOutcomeLink(value, {
        ...base,
        linkId: "cross",
        shadowDecisionId: second.shadowDecisionId,
        relation: "correction",
        priorLinkId: "first-root",
        observedAt: "2026-07-03T12:00:01.000Z",
        scope: second.scope,
      }),
    /prior_link_invalid/,
  );
});

test("relation and observed outcome status inconsistency fails closed", () => {
  const candidate = record(584, "2026-07-02T12:00:00.000Z");
  assert.throws(
    () =>
      appendOutcomeLink(ledger([candidate]), {
        linkId: "bad-missing",
        shadowDecisionId: candidate.shadowDecisionId,
        relation: "missing",
        priorLinkId: null,
        observedAt: null,
        actualDecisionId: null,
        observedOutcome: {
          status: "observed",
          value: true,
          evaluatedDecisionId: "A",
        },
        scope: candidate.scope,
      }),
    /relation_status_inconsistent/,
  );
});

test("outcome links update deterministic chain hashes and tampering fails", () => {
  const candidate = record(585, "2026-07-02T12:00:00.000Z");
  const initial = ledger([candidate]);
  const link = {
    linkId: "hashed-link",
    shadowDecisionId: candidate.shadowDecisionId,
    relation: "original",
    priorLinkId: null,
    observedAt: "2026-07-02T12:00:01.000Z",
    actualDecisionId: "A",
    observedOutcome: {
      status: "observed",
      value: true,
      evaluatedDecisionId: "A",
    },
    scope: candidate.scope,
  };
  const first = appendOutcomeLink(initial, link);
  const second = appendOutcomeLink(initial, structuredClone(link));
  assert.equal(first.shadowLedgerSha256, initial.shadowLedgerSha256);
  assert.notEqual(first.outcomeChainSha256, initial.outcomeChainSha256);
  assert.notEqual(first.evaluationLedgerSha256, initial.evaluationLedgerSha256);
  assert.equal(first.outcomeChainSha256, second.outcomeChainSha256);
  assert.equal(first.evaluationLedgerSha256, second.evaluationLedgerSha256);
  assert.match(first.outcomeLinks[0].outcomeLinkSha256, /^[a-f0-9]{64}$/);
  const report = buildFounderReadinessReport(first, config);
  assert.equal(report.shadowLedgerSha256, first.shadowLedgerSha256);
  assert.equal(report.outcomeChainSha256, first.outcomeChainSha256);
  assert.equal(report.evaluatedLedgerSha256, first.evaluationLedgerSha256);
  const tampered = structuredClone(first);
  tampered.outcomeLinks[0].observedOutcome.value = false;
  assert.throws(
    () => buildFounderReadinessReport(tampered, config),
    /outcome_link_digest_mismatch|outcome_chain_digest_mismatch/,
  );
});

test("exclusions require canonical provenance and deterministic hashes", () => {
  const timestamp = "2026-07-02T12:00:00.000Z";
  const first = exclusion(586, timestamp);
  const second = exclusion(586, timestamp);
  assert.equal(validateShadowExclusion(first, config), true);
  assert.equal(first.exclusionId, second.exclusionId);
  assert.equal(first.exclusionRecordSha256, second.exclusionRecordSha256);
  const malformedTimestamp = structuredClone(first);
  malformedTimestamp.timestamp = "not-a-timestamp";
  assert.throws(
    () => validateShadowExclusion(malformedTimestamp, config),
    /exclusion_contract_invalid|timestamp_invalid/,
  );
  const malformedReason = structuredClone(first);
  malformedReason.reasonCodes = { reason: "not-an-array" };
  assert.throws(
    () =>
      validateProspectiveLedgerCompleteness(
        [
          {
            opportunityId: malformedReason.opportunityId,
            timestamp: malformedReason.timestamp,
          },
        ],
        [],
        [malformedReason],
      ),
    /exclusion_contract_invalid/,
  );
});

test("declared artifact path incoherence fails closed", () => {
  const contract = JSON.parse(
    readFileSync(
      "intelligence/contracts/shadow-decision-readiness-contracts.json",
      "utf8",
    ),
  );
  contract.artifacts.engine = "intelligence/does-not-exist.mjs";
  assert.throws(
    () => validateShadowDecisionContractCoherence(contract, config),
    /Declared artifact path missing/,
  );
});

test("unresolved conflict is explicit and unscored", () => {
  const candidate = record(590, "2026-07-02T12:00:00.000Z");
  let value = ledger([candidate]);
  value = appendOutcomeLink(value, {
    linkId: "root",
    shadowDecisionId: candidate.shadowDecisionId,
    relation: "original",
    priorLinkId: null,
    observedAt: "2026-07-02T12:00:01.000Z",
    actualDecisionId: "A",
    observedOutcome: {
      status: "observed",
      value: true,
      evaluatedDecisionId: "A",
    },
    scope: candidate.scope,
  });
  value = appendOutcomeLink(value, {
    linkId: "conflicted",
    shadowDecisionId: candidate.shadowDecisionId,
    relation: "conflict",
    priorLinkId: "root",
    observedAt: "2026-07-02T12:00:02.000Z",
    actualDecisionId: "A",
    observedOutcome: {
      status: "unresolved_conflict",
      value: null,
      evaluatedDecisionId: null,
    },
    scope: candidate.scope,
  });
  assert.equal(
    buildFounderReadinessReport(value, config).metrics.outcomeAccuracy,
    null,
  );
});

test("protected hash mismatch and contract/config incoherence fail verifier", () => {
  const contract = JSON.parse(
    readFileSync(
      "intelligence/contracts/shadow-decision-readiness-contracts.json",
      "utf8",
    ),
  );
  const badHash = structuredClone(contract);
  badHash.protectedBehaviorBaselines.worker.sha256 = "0".repeat(64);
  assert.throws(
    () => verifyShadowDecisionReadiness({ contract: badHash, config }),
    /Protected zero-influence baseline changed/,
  );
  const badScope = structuredClone(contract);
  badScope.scope.representativeId = "anthony";
  assert.throws(() =>
    validateShadowDecisionContractCoherence(badScope, config),
  );
  for (const mutation of ["empty", "missing", "extra"]) {
    const value = structuredClone(contract);
    if (mutation === "empty") value.protectedBehaviorBaselines = {};
    if (mutation === "missing") delete value.protectedBehaviorBaselines.worker;
    if (mutation === "extra")
      value.protectedBehaviorBaselines.unapproved = {
        path: "package.json",
        sha256: digest(readFileSync("package.json")),
      };
    assert.throws(
      () => validateShadowDecisionContractCoherence(value, config),
      /Expected values to be strictly deep-equal/,
    );
  }
  assert.deepEqual(Object.keys(contract.protectedBehaviorBaselines).sort(), [
    ...requiredProtectedBehaviorBaselineKeys,
  ]);
  assert.equal(
    contract.protectedBehaviorBaselines.routeScoring.path,
    "scripts/build-route-intelligence-quality-engine.mjs",
  );
  assert.deepEqual(
    contract.protectedBehaviorBaselines.routeQualityGate,
    {
      path: "scripts/lib/route-intelligence-quality-gate.mjs",
      sha256:
        "1fe8a282ecc1e1394822b64d09aac0613763fb4cd94d43cbaa38ba20a6a25400",
      sourceCommit: "704537ded300cb674e53c047859eda19525a168d",
      sourceOwnerSubsystem: "Prometheus Data",
      provenance:
        "Hash computed from the Data-owned route-quality gate after canonical eight-fetch baseline synchronization; Intelligence verifies but never rewrites the quality gate.",
    },
  );
  assert.equal(
    contract.prospectiveRuntimeAdapter.currentState.sourceIntegrationStatus,
    "SOURCE_INTEGRATED_DEPLOYABLE_PRODUCTION_CONSUMER_INACTIVE",
  );
  assert.equal(
    contract.prospectiveRuntimeAdapter.currentState.productionConsumerActive,
    false,
  );
  assert.equal(
    contract.prospectiveRuntimeAdapter.currentState.productionDeploymentActive,
    false,
  );
  assert.equal(
    contract.prospectiveRuntimeAdapter.currentState.collectionActivation,
    "OFF",
  );
  assert.equal(
    contract.prospectiveRuntimeAdapter.currentState
      .canonicalProductionProspectiveRecords,
    0,
  );
  assert.equal(
    contract.committedOutcomeEvaluation.evaluation.productionConsumerActive,
    false,
  );
  assert.equal(
    contract.committedOutcomeEvaluation.evaluation.canonicalProductionEvaluations,
    0,
  );
  assert.equal(
    contract.prospectiveRuntimeAdapter.currentState.recommendationInfluence,
    "OFF",
  );
});

test("aggregate npm test runs both shadow verifier and focused suite", () => {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
  assert.match(
    packageJson.scripts.test,
    /npm run intelligence:shadow-readiness:check/,
  );
  assert.match(
    packageJson.scripts.test,
    /npm run test:intelligence:shadow-readiness/,
  );
});
