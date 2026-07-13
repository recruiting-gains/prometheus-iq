import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  appendOutcomeLink,
  buildFounderReadinessReport,
  buildProspectiveShadowLedger,
  derivedSupport,
  generateShadowDecision,
  loadShadowDecisionConfig,
  requiredSampleSize,
  validateChronologicalWindows,
  validateProspectiveLedgerCompleteness,
  validateRankedCandidates,
} from "../intelligence/shadow-decision-readiness.mjs";
import {
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
const projection = (timestamp) => ({
  projectionVersion: "route-iq-chronological-evidence-projection-v1",
  decisionTimestamp: timestamp,
  scope: {
    workspaceId: scope.workspaceId,
    operatingProfileId: scope.operatingProfileId,
    representativeId: scope.representativeId,
  },
  evidence: [
    { evidenceTimestamp: new Date(Date.parse(timestamp) - 1).toISOString() },
  ],
  exclusions: [],
  projectionSha256: digest(`projection-${timestamp}`),
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
function ledger(records, exclusions = []) {
  return {
    batchId: config.batchId,
    opportunityManifest: [...records, ...exclusions].map((item) => ({
      opportunityId: item.opportunityId,
      timestamp: item.timestamp,
    })),
    records: Object.freeze(records),
    exclusions,
    outcomeLinks: [],
    ledgerSha256: "fixture-only",
    recommendationInfluence: "OFF",
    founderOnly: true,
    readOnly: true,
  };
}
function linkedFixture({
  badSegment = false,
  evaluationCount = 97,
  trainingCount = 97,
  unstable = false,
  unsupportedBin = false,
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
      unstableFailure = unstable && evaluationIndex >= 49;
    result = appendOutcomeLink(result, {
      linkId: `fixture-outcome-${index}`,
      shadowDecisionId: records[index].shadowDecisionId,
      relation: "original",
      priorLinkId: null,
      observedAt: new Date(
        Date.parse(records[index].timestamp) + 1000,
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
        projection: {
          ...projection(timestamp),
          evidence: [{ evidenceTimestamp: timestamp }],
        },
        config,
      }),
    /temporal_leakage/,
  );
  assert.throws(
    () =>
      generateShadowDecision({
        opportunity: opportunity(2, timestamp),
        projection: {
          ...projection(timestamp),
          evidence: [{ evidenceTimestamp: "2026-07-02T12:00:01.000Z" }],
        },
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
    manifest = [{ opportunityId: generated.opportunityId }];
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
        [{ opportunityId: generated.opportunityId }],
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
  const value = structuredClone(linkedFixture());
  value.records[97].immutableSourceManifest = structuredClone(
    value.records[0].immutableSourceManifest,
  );
  assert.throws(
    () => buildFounderReadinessReport(value, config),
    /training_evaluation_source_overlap/,
  );
});

test("report requires explicit opportunity manifest", () => {
  const value = ledger([record(570, "2026-07-02T12:00:00.000Z")]);
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
        [{ opportunityId: "declared" }],
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
        [{ opportunityId: "missing" }],
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
        [{ opportunityId: "duplicate" }, { opportunityId: "duplicate" }],
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
        [{ opportunityId: candidate.opportunityId }],
        [candidate],
        [{ opportunityId: candidate.opportunityId }],
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
});
