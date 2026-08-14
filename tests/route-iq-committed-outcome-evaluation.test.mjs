import test from "node:test";
import assert from "node:assert/strict";

import {
  routeIqCandidateManifestSchemaVersion,
  routeIqCandidateProducerContractVersion,
  routeIqFieldSessionOutcomeProjectionContractVersion,
  routeIqProspectiveCollectionDefault,
  routeIqProspectiveCoordinatorContractVersion,
  routeIqProspectiveCoordinatorProjectionVersion,
  routeIqProspectiveCoordinatorSchemaVersion,
  routeIqProspectiveKvAuthority,
  routeIqProspectiveRecommendationInfluence,
} from "../data/route-iq-field-sessions-v1/route-iq-prospective-shadow-coordinator.mjs";
import {
  routeIqChronologicalEvidenceProjectionVersion,
  routeIqFieldSessionOutcomeProjectionVersion,
} from "../data/route-iq-field-sessions-v1/route-iq-field-session-archive.mjs";
import {
  routeIqProspectiveRetentionBoundaryContractVersion,
  routeIqProspectiveRetentionPolicyVersion,
} from "../data/route-iq-field-sessions-v1/route-iq-prospective-retention-policy.mjs";
import {
  calculateRouteIqRetentionBoundary,
  openRouteIqRetentionGovernanceLedger,
} from "../data/route-iq-field-sessions-v1/route-iq-retention-governance.mjs";
import {
  computeRouteIqProspectiveRetentionPolicySha256,
} from "../intelligence/route-iq-prospective-retention-admission.mjs";
import {
  buildRouteIqEvaluationAdmissionClaims,
  buildRouteIqEvaluationFromAdmittedOutcome,
  buildRouteIqScoreableOutcomeAdmissionClaims,
  computeRouteIqCommittedOutcomeSha256,
  deriveRouteIqScoreableOutcomeFromCommittedEvidence,
  isRouteIqEvaluationReadinessCountEligible,
  routeIqEvaluationContextSchemaVersion,
  routeIqEvaluationContractVersion,
  routeIqEvaluationRecordSchemaVersion,
  routeIqScoreableOutcomeDerivationContractVersion,
  routeIqScoreableOutcomeRecordSchemaVersion,
  validateRouteIqEvaluationContext,
  validateRouteIqEvaluationRecord,
  validateRouteIqScoreableOutcomeRecord,
} from "../intelligence/route-iq-committed-outcome-evaluation.mjs";
import {
  createRetentionAuthority,
  createRetentionStore,
} from "./route-iq-retention-test-support.mjs";

const TIMES = Object.freeze({
  snapshotAccepted: "2026-07-13T16:58:00.000Z",
  snapshotSealed: "2026-07-13T16:59:00.000Z",
  shadowSealed: "2026-07-13T17:00:00.000Z",
  actionLinked: "2026-07-13T17:01:00.000Z",
  actionEvent: "2026-07-13T17:02:00.000Z",
  corrected: "2026-07-13T17:03:00.000Z",
  archiveCommitted: "2026-07-13T17:04:00.000Z",
  fieldEvidenceLinked: "2026-07-13T17:05:00.000Z",
  reconciled: "2026-07-13T17:06:00.000Z",
  outcomeAdmitted: "2026-07-13T17:07:00.000Z",
  evaluationAdmitted: "2026-07-13T17:08:00.000Z",
});

const SCOPE = Object.freeze({
  workspaceId: "fitness_connection",
  operatingProfileId: "fitness",
  representativeId: "cruz",
});

const retentionSubject = Object.freeze({
  workspaceId: SCOPE.workspaceId,
  operatingProfileId: SCOPE.operatingProfileId,
  recordClass: "prospective_shadow_evidence",
  sourceRecordSha256: "e98ec40fb12f4ab97a0ab482073b1cc0fe7e4cbb3a5b96a52bd6e4c5a8bd133a",
});
const retentionAuthority = createRetentionAuthority(
  "committed-outcome-retention-test-authority-key-material-v1",
);
const retentionGovernanceLedger = await openRouteIqRetentionGovernanceLedger({
  store: createRetentionStore(),
  subject: retentionSubject,
  authorityVerifier: retentionAuthority.verifier,
});
const canonicalRetentionBoundary = calculateRouteIqRetentionBoundary({
  subject: retentionSubject,
  customerAccountId: "fitness_connection",
  createdAt: TIMES.snapshotAccepted,
  customerContractExpiresAt: null,
  customerOverrideAuthority: null,
});

function digest(value) {
  return computeRouteIqCommittedOutcomeSha256(value);
}

function id(kind, label) {
  return "riq_" + kind + "_" + digest(kind + ":" + label);
}

function withHash(body, hashField) {
  return { ...body, [hashField]: digest(body) };
}

function signal(overrides = {}) {
  return {
    outcomeCode: null,
    outcomeCodeStatus: "unsupported",
    conversations: 0,
    leads: 0,
    appointments: 0,
    units: 0,
    laterUnits: 0,
    scoreableOutcome: null,
    scoreableOutcomeDerivedByData: false,
    ...overrides,
  };
}

function allowlistedSignal(outcomeCode, overrides = {}) {
  return signal({
    outcomeCode,
    outcomeCodeStatus: "verified_allowlisted",
    ...overrides,
  });
}

function rebuildEvidenceHash(outcome) {
  const body = Object.fromEntries(
    Object.entries(outcome).filter(([key]) => key !== "evidenceSha256"),
  );
  outcome.evidenceSha256 = digest(body);
}

function rebuildProjectionHash(projection) {
  const body = Object.fromEntries(
    Object.entries(projection).filter(([key]) => key !== "projectionSha256"),
  );
  projection.projectionSha256 = digest(body);
}

function immutableEvaluationContext({
  opportunityId,
  candidateId,
  actionArtifactId,
  outcome,
}) {
  const context = {
    schemaVersion: routeIqEvaluationContextSchemaVersion,
    opportunityId,
    acceptedSnapshotManifest: {
      artifactId: id("snapshot", "accepted"),
      recordSha256: digest("accepted-snapshot-record"),
      manifestRecordSha256: digest("accepted-manifest-record"),
      acceptedAt: TIMES.snapshotAccepted,
    },
    snapshotSeal: {
      artifactId: id("snapshot_seal", "accepted"),
      recordSha256: digest("snapshot-seal-record"),
      sealedAt: TIMES.snapshotSealed,
    },
    manifest: {
      candidateManifestSha256: digest("candidate-manifest"),
      completeManifestSha256: digest("complete-candidate-manifest"),
      producerContractVersion: routeIqCandidateProducerContractVersion,
      candidateSchemaVersion: routeIqCandidateManifestSchemaVersion,
      dataProjectionVersion: routeIqChronologicalEvidenceProjectionVersion,
    },
    candidate: {
      candidateId,
      acceptedRank: 1,
      probability: 0.625,
      rankingBasisVersion: "route-iq-governed-score-ranking-v1",
    },
    shadowDecision: {
      shadowDecisionRecordSha256: digest("shadow-decision-record"),
      sealArtifactId: id("shadow_seal", "selected"),
      sealRecordSha256: digest("shadow-decision-seal-record"),
      sealedAt: TIMES.shadowSealed,
    },
    action: {
      artifactId: actionArtifactId,
      recordSha256: digest("action-record"),
      selectedCandidateId: candidateId,
      linkedAt: TIMES.actionLinked,
    },
    sourceOutcome: {
      evidenceSha256: outcome.evidenceSha256,
      correctionState: outcome.outcomeEvidence.correctionState,
      correctionCount: outcome.outcomeEvidence.corrections.length,
      correctionRecordSha256s: outcome.outcomeEvidence.corrections.map(
        (correction) => correction.sourceCorrectionRecordSha256,
      ),
    },
    recommendationInfluence: routeIqProspectiveRecommendationInfluence,
    immutable: true,
  };
  return {
    evaluationContextArtifactId: id("evaluation_context", "selected"),
    evaluationContextSha256: digest(context),
    evaluationContext: context,
  };
}

function committedEvidenceFixture(options = {}) {
  const finalSignal = options.finalSignal ?? options.originalSignal ?? signal();
  const originalSignal = options.originalSignal ?? finalSignal;
  const corrected = options.corrected ?? false;
  const sourceVisitRecordSha256 = digest("visit-record");
  const candidateId = id("candidate", "selected");
  const opportunityId = id("opportunity", "next-stop");
  const actionArtifactId = id("action", "selected");
  const outcomeEvidenceArtifactId = id("field_outcome", "selected");
  const corrections = corrected
    ? [
        {
          sourceCorrectionRecordSha256: digest("correction-record-1"),
          sequence: 1,
          correctedAt: TIMES.corrected,
          previousOutcomeSignal: structuredClone(originalSignal),
          finalOutcomeSignal: structuredClone(finalSignal),
          changedSignalFields: ["outcomeCode", "outcomeCodeStatus", "leads"],
          appendOnly: true,
        },
      ]
    : [];
  const outcomeBody = {
    sourceVisitRecordSha256,
    candidateId,
    candidateIdentityStatus:
      "derived_from_exact_governed_google_place_identity",
    actionEventTime: TIMES.actionEvent,
    eventTimeAuthority: "dashboard_recorded_visit_time_in_committed_handoff",
    authoritativeRecordTime: TIMES.archiveCommitted,
    outcomeEvidence: {
      status: "verified_unscored_signals",
      originalOutcomeSignal: structuredClone(originalSignal),
      finalOutcomeSignal: structuredClone(finalSignal),
      corrections,
      correctionState: corrected ? "corrected" : "uncorrected",
      conflictState: "none",
      scoreableOutcome: null,
      scoreableOutcomeDerivedByData: false,
    },
    decisionSource: options.decisionSource ?? null,
    recommendationDecisionContext:
      options.recommendationDecisionContext ?? null,
  };
  const outcome = withHash(outcomeBody, "evidenceSha256");
  const projectionBody = {
    schemaVersion: routeIqFieldSessionOutcomeProjectionVersion,
    authority: "prometheus_data_committed_field_session",
    recordOrigin: "prospective",
    scope: structuredClone(SCOPE),
    sourceArchive: {
      handoffContractId: "route-iq-end-of-day-data-handoff-v1",
      sourceArchiveSessionSha256: digest("archive-session"),
      rawSha256: digest("archive-raw"),
      normalizedSha256: digest("archive-normalized"),
      archiveCommittedAt: TIMES.archiveCommitted,
    },
    outcomes: [outcome],
    privacy: {
      namesIncluded: false,
      addressesIncluded: false,
      contactsIncluded: false,
      notesIncluded: false,
      preciseLocationIncluded: false,
    },
    recommendationInfluence: routeIqProspectiveRecommendationInfluence,
    scoreableOutcomeDerivedByData: false,
  };
  const fieldSessionOutcomeProjection = withHash(
    projectionBody,
    "projectionSha256",
  );
  const contextReceipt = immutableEvaluationContext({
    opportunityId,
    candidateId,
    actionArtifactId,
    outcome,
  });
  const reconciliationReceipt = {
    contractVersion: routeIqFieldSessionOutcomeProjectionContractVersion,
    reconciliationId: id("reconciliation", "selected"),
    status: "reconciled",
    coordinatorId: "route-iq-test-coordinator",
    sourceProjectionSha256: fieldSessionOutcomeProjection.projectionSha256,
    sourceArchiveRawSha256: projectionBody.sourceArchive.rawSha256,
    sourceArchiveSessionSha256:
      projectionBody.sourceArchive.sourceArchiveSessionSha256,
    linked: [
      {
        sourceVisitRecordSha256,
        opportunityId,
        candidateId,
        evidenceSha256: outcome.evidenceSha256,
        actionArtifactId,
        outcomeEvidenceArtifactId,
        ...contextReceipt,
      },
    ],
    exclusions: [],
    outcomeValuesInferredByData: false,
    recommendationInfluence: routeIqProspectiveRecommendationInfluence,
    createdAt: TIMES.reconciled,
  };
  return {
    input: {
      fieldSessionOutcomeProjection,
      reconciliationReceipt,
      sourceVisitRecordSha256,
    },
    opportunityId,
    candidateId,
    actionArtifactId,
  };
}

function deriveFixture(options) {
  const fixture = committedEvidenceFixture(options);
  return {
    ...fixture,
    scoreableOutcome: deriveRouteIqScoreableOutcomeFromCommittedEvidence(
      fixture.input,
    ),
  };
}

function outcomeAdmissionReceipt(scoreableOutcome) {
  return {
    coordinatorContractVersion: routeIqProspectiveCoordinatorContractVersion,
    status: "recorded",
    coordinatorId: "route-iq-test-coordinator",
    sessionId: id("session", "coordinator"),
    opportunityId: scoreableOutcome.opportunityId,
    operationKey: "scoreable-outcome:test",
    operationKind: "scoreable_outcome_admission",
    requestSha256: digest("scoreable-outcome-request"),
    artifactId: id("outcome", "selected"),
    recordSha256: digest("admitted-scoreable-outcome-record"),
    recordSequence: 8,
    authoritativeRecordTime: TIMES.outcomeAdmitted,
    state: "OUTCOME_LINKED",
    recoveryOutboxPersisted: true,
    recommendationInfluence: routeIqProspectiveRecommendationInfluence,
    collectionDefault: routeIqProspectiveCollectionDefault,
    sourceOutcomeEvidenceSha256:
      scoreableOutcome.sourceOutcomeEvidenceSha256,
    evaluationContextSha256: scoreableOutcome.evaluationContextSha256,
    evaluatedCandidateId: scoreableOutcome.candidateId,
    calculatedByData: false,
  };
}

function committedProjection(scoreableOutcome, outcomeReceipt) {
  const outcomeEvidence = {
    sourceRecordId: outcomeReceipt.artifactId,
    evidenceKind: "prospective_opportunity_outcome",
    evidenceTimestamp: outcomeReceipt.authoritativeRecordTime,
    recordSequence: outcomeReceipt.recordSequence,
    recordSha256: outcomeReceipt.recordSha256,
    payload: {
      evaluatedCandidateId: scoreableOutcome.candidateId,
      actionArtifactId: scoreableOutcome.actionArtifactId,
      sourceOutcomeEvidenceSha256:
        scoreableOutcome.sourceOutcomeEvidenceSha256,
      evaluationContextSha256: scoreableOutcome.evaluationContextSha256,
      outcomeDerivationContractVersion:
        scoreableOutcome.outcomeDerivationContractVersion,
      observedOutcome: structuredClone(scoreableOutcome.observedOutcome),
      calculatedByData: false,
      unchosenCandidateOutcomeAssignmentAllowed: false,
    },
    canonicalEvidenceEligible: true,
    recommendationInfluence: routeIqProspectiveRecommendationInfluence,
  };
  const projection = {
    schemaVersion: routeIqProspectiveCoordinatorSchemaVersion,
    projectionVersion: routeIqProspectiveCoordinatorProjectionVersion,
    authority: "sqlite_durable_object_coordinator",
    coordinatorId: "route-iq-test-coordinator",
    scope: structuredClone(scoreableOutcome.scope),
    canonicalSessionRecordSha256: digest("canonical-session-record"),
    territoryId: id("territory", "selected"),
    opportunityId: scoreableOutcome.opportunityId,
    opportunityType: "next_stop",
    asOfRecordSequence: outcomeReceipt.recordSequence,
    asOfRecordTime: outcomeReceipt.authoritativeRecordTime,
    state: "OUTCOME_LINKED",
    readinessEvidenceEligible: true,
    evidence: [outcomeEvidence],
    exclusions: [],
    sourceArtifacts: [
      {
        artifactId: scoreableOutcome.outcomeEvidenceArtifactId,
        artifactKind: "field_session_outcome_evidence",
        eventKind: "FIELD_SESSION_OUTCOME_EVIDENCE_LINKED",
        recordSequence: 7,
        authoritativeRecordTime: TIMES.fieldEvidenceLinked,
        recordSha256: digest("field-evidence-event-record"),
      },
      {
        artifactId: outcomeReceipt.artifactId,
        artifactKind: "outcome",
        eventKind: "OUTCOME_LINKED",
        recordSequence: outcomeReceipt.recordSequence,
        authoritativeRecordTime: outcomeReceipt.authoritativeRecordTime,
        recordSha256: outcomeReceipt.recordSha256,
      },
    ],
    recommendationInfluence: routeIqProspectiveRecommendationInfluence,
    collectionDefault: routeIqProspectiveCollectionDefault,
    kvAuthority: routeIqProspectiveKvAuthority,
  };
  const commitBody = {
    commitId: id("projection_commit", "outcome"),
    projectionId: id("projection", "outcome"),
    outboxId: id("projection_outbox", "outcome"),
    status: "committed",
    projectionSha256: digest(projection),
    committedSequence: projection.asOfRecordSequence,
    committedAt: projection.asOfRecordTime,
    projectionCommitMarkerWrittenLast: true,
  };
  return {
    projection,
    commit: {
      ...commitBody,
      commitSha256: digest(commitBody),
    },
  };
}

function evaluationInput(derived) {
  const outcomeReceipt = outcomeAdmissionReceipt(derived.scoreableOutcome);
  return {
    reconciliationReceipt: structuredClone(
      derived.input.reconciliationReceipt,
    ),
    committedProjection: committedProjection(
      derived.scoreableOutcome,
      outcomeReceipt,
    ),
    scoreableOutcome: derived.scoreableOutcome,
    outcomeReceipt,
    retentionGovernanceLedger,
    retentionEnvelope: {
      dataAdmission: {
        dataPolicySha256: computeRouteIqProspectiveRetentionPolicySha256(),
        envelope: {
          policyVersion: routeIqProspectiveRetentionPolicyVersion,
          collectionState: "on",
          recommendationInfluence: "off",
          recordOrigin: "prospective",
          workspaceId: SCOPE.workspaceId,
          operatingProfileId: SCOPE.operatingProfileId,
          representativeId: SCOPE.representativeId,
          evaluatedAt: outcomeReceipt.authoritativeRecordTime,
          retentionBoundary: {
            contractVersion: routeIqProspectiveRetentionBoundaryContractVersion,
            authorizationState: "founder_authorized_18_month_maximum",
            source: "authenticated_data_retention_contract",
            ...canonicalRetentionBoundary,
          },
          derivedProjectionExpiresAt: "2027-01-13T17:07:00.000Z",
        },
        sourceSession: {
          coordinatorSessionId: outcomeReceipt.sessionId,
          fieldSessionId:
            "route-iq-field-session-fitness-connection-fitness-cruz-2026-07-13",
          rawSha256: derived.scoreableOutcome.sourceArchiveRawSha256,
        },
      },
    },
  };
}

function assertErrorCode(callback, code) {
  assert.throws(callback, (error) => error?.code === code);
}

test("explicit verified positive thresholds are the only positive derivation inputs", () => {
  for (const field of ["leads", "appointments", "units", "laterUnits"]) {
    const { scoreableOutcome } = deriveFixture({
      finalSignal: allowlistedSignal("conversation", { [field]: 1 }),
    });
    assert.deepEqual(scoreableOutcome.observedOutcome, {
      status: "observed",
      value: true,
    });
    assert.equal(scoreableOutcome.positiveEvidence[0].signal, field);
    assert.equal(scoreableOutcome.readinessCountEligible, true);
  }
  const { scoreableOutcome } = deriveFixture({
    finalSignal: allowlistedSignal("no_interest", { leads: 1 }),
  });
  assert.equal(scoreableOutcome.observedOutcome.value, true);
});

test("only final allowlisted no_interest or closed with zero positives derives false", () => {
  for (const outcomeCode of ["no_interest", "closed"]) {
    const { scoreableOutcome } = deriveFixture({
      finalSignal: allowlistedSignal(outcomeCode),
    });
    assert.deepEqual(scoreableOutcome.observedOutcome, {
      status: "observed",
      value: false,
    });
    assert.equal(scoreableOutcome.readinessCountEligible, true);
  }
});

test("pending, conversation, follow-up, decision-pending, unsupported, absent, and label-only signals remain missing", () => {
  const missingSignals = [
    signal(),
    allowlistedSignal("visited"),
    allowlistedSignal("conversation", { conversations: 1 }),
    allowlistedSignal("follow_up_required"),
    allowlistedSignal("decision_pending"),
    allowlistedSignal("lead"),
    allowlistedSignal("appointment"),
    allowlistedSignal("membership_or_unit"),
  ];
  for (const finalSignal of missingSignals) {
    const { scoreableOutcome } = deriveFixture({ finalSignal });
    assert.deepEqual(scoreableOutcome.observedOutcome, {
      status: "missing",
      value: null,
    });
    assert.equal(scoreableOutcome.readinessCountEligible, false);
  }

  const fixture = committedEvidenceFixture();
  delete fixture.input.fieldSessionOutcomeProjection.outcomes[0].outcomeEvidence
    .finalOutcomeSignal.leads;
  rebuildEvidenceHash(fixture.input.fieldSessionOutcomeProjection.outcomes[0]);
  rebuildProjectionHash(fixture.input.fieldSessionOutcomeProjection);
  fixture.input.reconciliationReceipt.sourceProjectionSha256 =
    fixture.input.fieldSessionOutcomeProjection.projectionSha256;
  fixture.input.reconciliationReceipt.linked[0].evidenceSha256 =
    fixture.input.fieldSessionOutcomeProjection.outcomes[0].evidenceSha256;
  assertErrorCode(
    () => deriveRouteIqScoreableOutcomeFromCommittedEvidence(fixture.input),
    "route_iq_committed_outcome_final_signal_invalid",
  );
});

test("the final append-only correction controls while the complete chain remains bound", () => {
  const originalSignal = allowlistedSignal("no_interest");
  const finalSignal = allowlistedSignal("lead", { leads: 1 });
  const { scoreableOutcome } = deriveFixture({
    originalSignal,
    finalSignal,
    corrected: true,
  });
  assert.equal(scoreableOutcome.observedOutcome.value, true);
  assert.deepEqual(scoreableOutcome.originalOutcomeSignal, originalSignal);
  assert.deepEqual(scoreableOutcome.finalOutcomeSignal, finalSignal);
  assert.equal(scoreableOutcome.correctionChain.state, "corrected");
  assert.equal(scoreableOutcome.correctionChain.correctionCount, 1);
  assert.equal(
    scoreableOutcome.correctionChain.finalSignalSha256,
    digest(finalSignal),
  );
  assert.equal(Object.isFrozen(scoreableOutcome), true);
});

test("Decision Source and recommendation context are excluded from derivation and output", () => {
  const { scoreableOutcome } = deriveFixture({
    finalSignal: allowlistedSignal("closed"),
    decisionSource: {
      sourceId: "rep_observation",
      confidence: "high",
      capturedAt: TIMES.corrected,
      temporalClassification: "post_action_supporting_information",
      preActionEvidence: false,
      sameShadowDecisionInput: false,
      scoreableOutcome: false,
    },
    recommendationDecisionContext: {
      recommendationAvailable: true,
      decision: "overridden",
      temporalClassification: "post_action_supporting_information",
    },
  });
  assert.deepEqual(scoreableOutcome.observedOutcome, {
    status: "observed",
    value: false,
  });
  assert.equal(scoreableOutcome.boundaries.decisionSourceUsed, false);
  assert.equal(
    scoreableOutcome.boundaries.recommendationDecisionContextUsed,
    false,
  );
  assert.equal(JSON.stringify(scoreableOutcome).includes("rep_observation"), false);
  assert.equal(JSON.stringify(scoreableOutcome).includes("overridden"), false);
});

test("derivation rejects scope, hash, context, candidate, and chronology tampering", () => {
  const hashFixture = committedEvidenceFixture();
  hashFixture.input.fieldSessionOutcomeProjection.projectionSha256 =
    digest("tamper");
  assertErrorCode(
    () => deriveRouteIqScoreableOutcomeFromCommittedEvidence(hashFixture.input),
    "route_iq_committed_outcome_projection_hash_invalid",
  );

  const scopeFixture = committedEvidenceFixture();
  scopeFixture.input.fieldSessionOutcomeProjection.scope.representativeId =
    "browser";
  rebuildProjectionHash(scopeFixture.input.fieldSessionOutcomeProjection);
  scopeFixture.input.reconciliationReceipt.sourceProjectionSha256 =
    scopeFixture.input.fieldSessionOutcomeProjection.projectionSha256;
  assertErrorCode(
    () => deriveRouteIqScoreableOutcomeFromCommittedEvidence(scopeFixture.input),
    "route_iq_committed_outcome_scope_invalid",
  );

  const candidateFixture = committedEvidenceFixture();
  candidateFixture.input.reconciliationReceipt.linked[0].candidateId = id(
    "candidate",
    "unchosen",
  );
  assertErrorCode(
    () =>
      deriveRouteIqScoreableOutcomeFromCommittedEvidence(
        candidateFixture.input,
      ),
    "route_iq_committed_outcome_reconciliation_binding_invalid",
  );

  const contextFixture = committedEvidenceFixture();
  contextFixture.input.reconciliationReceipt.linked[0].evaluationContext
    .candidate.probability = 0.9;
  assertErrorCode(
    () =>
      deriveRouteIqScoreableOutcomeFromCommittedEvidence(contextFixture.input),
    "route_iq_committed_outcome_evaluation_context_invalid",
  );

  const chronologyFixture = committedEvidenceFixture();
  chronologyFixture.input.fieldSessionOutcomeProjection.outcomes[0].actionEventTime =
    TIMES.archiveCommitted;
  rebuildEvidenceHash(
    chronologyFixture.input.fieldSessionOutcomeProjection.outcomes[0],
  );
  rebuildProjectionHash(chronologyFixture.input.fieldSessionOutcomeProjection);
  chronologyFixture.input.reconciliationReceipt.sourceProjectionSha256 =
    chronologyFixture.input.fieldSessionOutcomeProjection.projectionSha256;
  chronologyFixture.input.reconciliationReceipt.linked[0].evidenceSha256 =
    chronologyFixture.input.fieldSessionOutcomeProjection.outcomes[0].evidenceSha256;
  assertErrorCode(
    () =>
      deriveRouteIqScoreableOutcomeFromCommittedEvidence(
        chronologyFixture.input,
      ),
    "route_iq_committed_outcome_chronology_invalid",
  );
});

test("scoreable derivation and exact Data producer claims replay deterministically", () => {
  const fixture = committedEvidenceFixture({
    finalSignal: allowlistedSignal("appointment", { appointments: 1 }),
  });
  const first = deriveRouteIqScoreableOutcomeFromCommittedEvidence(
    fixture.input,
  );
  const replay = deriveRouteIqScoreableOutcomeFromCommittedEvidence(
    structuredClone(fixture.input),
  );
  assert.deepEqual(replay, first);
  assert.equal(validateRouteIqScoreableOutcomeRecord(first), true);
  assert.equal(first.schemaVersion, routeIqScoreableOutcomeRecordSchemaVersion);
  const claimsInput = {
    scope: structuredClone(SCOPE),
    scoreableOutcome: first,
    authoritativeRecordTime: TIMES.outcomeAdmitted,
  };
  const claims = buildRouteIqScoreableOutcomeAdmissionClaims(claimsInput);
  assert.deepEqual(
    buildRouteIqScoreableOutcomeAdmissionClaims(claimsInput),
    claims,
  );
  assert.equal(
    claims.evaluationContextSha256,
    first.evaluationContextSha256,
  );
  assert.equal(
    claims.outcomeDerivationContractVersion,
    routeIqScoreableOutcomeDerivationContractVersion,
  );
});

test("canonical nonproduction fixture matches Data full evaluation record and producer claims", () => {
  const derived = deriveFixture({
    finalSignal: allowlistedSignal("lead", { leads: 1 }),
  });
  const input = evaluationInput(derived);
  const contextReceipt = input.reconciliationReceipt.linked[0];
  assert.equal(
    validateRouteIqEvaluationContext({
      evaluationContextArtifactId:
        contextReceipt.evaluationContextArtifactId,
      evaluationContextSha256: contextReceipt.evaluationContextSha256,
      evaluationContext: contextReceipt.evaluationContext,
    }),
    true,
  );
  const first = buildRouteIqEvaluationFromAdmittedOutcome(input);
  const replay = buildRouteIqEvaluationFromAdmittedOutcome({
    ...input,
    retentionEnvelope: structuredClone(input.retentionEnvelope),
  });
  assert.deepEqual(replay, first);
  assert.equal(first.schemaVersion, routeIqEvaluationRecordSchemaVersion);
  assert.equal(first.evaluationContractVersion, routeIqEvaluationContractVersion);
  assert.equal(
    first.evaluationContextSha256,
    contextReceipt.evaluationContextSha256,
  );
  assert.equal(first.sourceProjection.projectionCommitId, input.committedProjection.commit.commitId);
  assert.equal(first.acceptedCandidate.rank, 1);
  assert.equal(first.acceptedCandidate.probability, 0.625);
  assert.equal(first.action.selectionAuthority, "accepted_manifest_unique_ordinal_1");
  assert.equal(first.scoreableOutcome.outcomeRecordSha256, input.outcomeReceipt.recordSha256);
  assert.equal(first.boundaries.observationalOnly, true);
  assert.equal(first.boundaries.causalClaimAllowed, false);
  assert.equal(first.boundaries.upliftClaimAllowed, false);
  assert.equal(first.recommendationInfluence, "OFF");
  assert.equal(validateRouteIqEvaluationRecord(first), true);
  assert.equal(isRouteIqEvaluationReadinessCountEligible(first), true);

  const claimsInput = {
    scope: structuredClone(SCOPE),
    evaluation: first,
    authoritativeRecordTime: TIMES.evaluationAdmitted,
  };
  const claims = buildRouteIqEvaluationAdmissionClaims(claimsInput);
  assert.deepEqual(buildRouteIqEvaluationAdmissionClaims(claimsInput), claims);
  assert.equal(claims.evaluationContextSha256, first.evaluationContextSha256);
  assert.equal(claims.evaluationRecordSha256, first.evaluationRecordSha256);
  assert.deepEqual(claims.evaluationRecord, first);
});

test("evaluation admission fails closed on invalid retention or disposed source evidence", () => {
  const derived = deriveFixture({
    finalSignal: allowlistedSignal("lead", { leads: 1 }),
  });
  const cases = [
    (input) => {
      input.retentionEnvelope.dataAdmission.envelope.retentionBoundary = null;
    },
    (input) => {
      input.retentionEnvelope.dataAdmission.envelope.retentionBoundary.expiresAt =
        input.retentionEnvelope.dataAdmission.envelope.evaluatedAt;
    },
    (input) => {
      input.retentionEnvelope.dataAdmission.envelope.recordOrigin = "historical";
    },
    (input) => {
      input.retentionGovernanceLedger = undefined;
    },
    (input) => {
      input.retentionEnvelope.dataAdmission.envelope.derivedProjectionExpiresAt =
        "2028-02-13T17:07:00.001Z";
    },
    (input) => {
      input.retentionEnvelope.dataAdmission.sourceSession.fieldSessionId =
        "route-iq-field-session-fitness-connection-fitness-cruz-2026-07-14";
      input.retentionEnvelope.dataAdmission.sourceSession.rawSha256 =
        "ceb72963ab4e98d6039c1a4a1a409d281bf9e41e6001bd78cca4c04364815765";
    },
  ];
  for (const mutate of cases) {
    const input = evaluationInput(derived);
    mutate(input);
    assertErrorCode(
      () => buildRouteIqEvaluationFromAdmittedOutcome(input),
      "route_iq_evaluation_retention_admission_blocked",
    );
  }
});

test("missing scoreable outcomes never enter evaluation or readiness counts", () => {
  const derived = deriveFixture({
    finalSignal: allowlistedSignal("conversation", { conversations: 1 }),
  });
  assert.equal(derived.scoreableOutcome.readinessCountEligible, false);
  assertErrorCode(
    () => buildRouteIqEvaluationFromAdmittedOutcome(evaluationInput(derived)),
    "route_iq_evaluation_scoreable_outcome_missing",
  );
});

test("evaluation rejects context, projection, unchosen candidate, and chronology tampering", () => {
  const unchosenFixture = committedEvidenceFixture({
    finalSignal: allowlistedSignal("closed"),
  });
  const unchosenLink = unchosenFixture.input.reconciliationReceipt.linked[0];
  unchosenLink.evaluationContext.action.selectedCandidateId = id(
    "candidate",
    "unchosen",
  );
  unchosenLink.evaluationContextSha256 = digest(
    unchosenLink.evaluationContext,
  );
  assertErrorCode(
    () =>
      deriveRouteIqScoreableOutcomeFromCommittedEvidence(
        unchosenFixture.input,
      ),
    "route_iq_committed_outcome_evaluation_context_binding_invalid",
  );

  const derived = deriveFixture({
    finalSignal: allowlistedSignal("closed"),
  });
  const contextInput = evaluationInput(derived);
  contextInput.reconciliationReceipt.linked[0].evaluationContext
    .candidate.probability = 0.9;
  assertErrorCode(
    () => buildRouteIqEvaluationFromAdmittedOutcome(contextInput),
    "route_iq_committed_outcome_evaluation_context_invalid",
  );

  const projectionInput = evaluationInput(derived);
  projectionInput.committedProjection.projection.state = "EVALUATED";
  assertErrorCode(
    () => buildRouteIqEvaluationFromAdmittedOutcome(projectionInput),
    "route_iq_evaluation_projection_invalid",
  );

  const chronologyInput = evaluationInput(derived);
  chronologyInput.committedProjection.projection.sourceArtifacts[0]
    .authoritativeRecordTime = TIMES.reconciled;
  const projection = chronologyInput.committedProjection.projection;
  const commit = chronologyInput.committedProjection.commit;
  commit.projectionSha256 = digest(projection);
  const commitBody = Object.fromEntries(
    Object.entries(commit).filter(([key]) => key !== "commitSha256"),
  );
  commit.commitSha256 = digest(commitBody);
  assertErrorCode(
    () => buildRouteIqEvaluationFromAdmittedOutcome(chronologyInput),
    "route_iq_evaluation_projection_field_source_invalid",
  );
});

test("record tampering fails and emitted evaluation has no PII, causal, uplift, or superiority claim", () => {
  const derived = deriveFixture({
    finalSignal: allowlistedSignal("closed"),
  });
  const tamperedOutcome = structuredClone(derived.scoreableOutcome);
  tamperedOutcome.observedOutcome.value = true;
  assertErrorCode(
    () => validateRouteIqScoreableOutcomeRecord(tamperedOutcome),
    "route_iq_scoreable_outcome_record_invalid",
  );

  const evaluation = buildRouteIqEvaluationFromAdmittedOutcome(
    evaluationInput(derived),
  );
  const serialized = JSON.stringify(evaluation).toLowerCase();
  assert.equal(serialized.includes("address"), false);
  assert.equal(serialized.includes("decision source"), false);
  assert.equal(serialized.includes("causalclaimallowed\":true"), false);
  assert.equal(serialized.includes("upliftclaimallowed\":true"), false);
  assert.equal(serialized.includes("superiority"), false);
  const tamperedEvaluation = structuredClone(evaluation);
  tamperedEvaluation.acceptedCandidate.probability = 0.1;
  assertErrorCode(
    () => validateRouteIqEvaluationRecord(tamperedEvaluation),
    "route_iq_evaluation_record_invalid",
  );
  const retentionTamper = structuredClone(evaluation);
  retentionTamper.retentionAdmission.retentionBoundary.expiresAt =
    retentionTamper.retentionAdmission.evaluatedAt;
  assertErrorCode(
    () => validateRouteIqEvaluationRecord(retentionTamper),
    "route_iq_evaluation_record_invalid",
  );
});
