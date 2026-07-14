import { createHash } from "node:crypto";

import {
  routeIqCandidateManifestSchemaVersion,
  routeIqCandidateProducerContractVersion,
  routeIqEvaluationContextSchemaVersion as dataRouteIqEvaluationContextSchemaVersion,
  routeIqFieldSessionOutcomeProjectionContractVersion,
  routeIqIntelligenceEvaluationContractVersion,
  routeIqIntelligenceEvaluationRecordSchemaVersion,
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
export const routeIqScoreableOutcomeDerivationContractVersion =
  "route-iq-committed-scoreable-outcome-derivation-v1";
export const routeIqScoreableOutcomeRecordSchemaVersion =
  "route-iq-committed-scoreable-outcome-record-v1";
export const routeIqEvaluationContextSchemaVersion =
  dataRouteIqEvaluationContextSchemaVersion;
export const routeIqEvaluationContractVersion =
  routeIqIntelligenceEvaluationContractVersion;
export const routeIqEvaluationRecordSchemaVersion =
  routeIqIntelligenceEvaluationRecordSchemaVersion;

export const routeIqScoreableOutcomePolicy = Object.freeze({
  policyId: "fitness-off-route-success-policy-v1",
  positiveSignalThresholds: Object.freeze({
    appointments: 1,
    laterUnits: 1,
    leads: 1,
    units: 1,
  }),
  definitiveNegativeOutcomeCodes: Object.freeze(["closed", "no_interest"]),
  labelAloneCountsAsPositive: false,
  pendingOrUnsupportedRemainsMissing: true,
});

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const VERSION_PATTERN = /^[a-z0-9][a-z0-9._-]{1,127}$/;
const ARTIFACT_ID_PATTERN = /^riq_[a-z0-9_]+_[a-f0-9]{64}$/;
const ID_PATTERNS = Object.freeze({
  action: /^riq_action_[a-f0-9]{64}$/,
  candidate: /^riq_candidate_[a-f0-9]{64}$/,
  opportunity: /^riq_opportunity_[a-f0-9]{64}$/,
  outcome: /^riq_outcome_[a-f0-9]{64}$/,
  reconciliation: /^riq_reconciliation_[a-f0-9]{64}$/,
});
const SIGNAL_KEYS = Object.freeze([
  "outcomeCode",
  "outcomeCodeStatus",
  "conversations",
  "leads",
  "appointments",
  "units",
  "laterUnits",
  "scoreableOutcome",
  "scoreableOutcomeDerivedByData",
]);
const OUTCOME_CODES = new Set([
  "appointment",
  "closed",
  "conversation",
  "decision_pending",
  "follow_up_required",
  "lead",
  "membership_or_unit",
  "no_interest",
  "visited",
]);

export class RouteIqCommittedOutcomeEvaluationError extends Error {
  constructor(code, details = {}) {
    super(code);
    this.name = "RouteIqCommittedOutcomeEvaluationError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, details = {}) {
  throw new RouteIqCommittedOutcomeEvaluationError(code, details);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function computeRouteIqCommittedOutcomeSha256(value) {
  return createHash("sha256")
    .update(typeof value === "string" ? value : canonical(value))
    .digest("hex");
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertExactKeys(value, keys, code) {
  if (!isPlainObject(value)) fail(code);
  const allowed = new Set(keys);
  if (
    Object.keys(value).some((key) => !allowed.has(key)) ||
    keys.some((key) => !Object.hasOwn(value, key))
  ) {
    fail(code);
  }
}

function requireSha(value, code) {
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) fail(code);
  return value;
}

function requireVersion(value, code) {
  if (typeof value !== "string" || !VERSION_PATTERN.test(value)) fail(code);
  return value;
}

function requireId(value, pattern, code) {
  if (typeof value !== "string" || !pattern.test(value)) fail(code);
  return value;
}

function requireArtifactId(value, code) {
  return requireId(value, ARTIFACT_ID_PATTERN, code);
}

function requireSequence(value, code) {
  if (!Number.isSafeInteger(value) || value < 0) fail(code);
  return value;
}

function canonicalTimestamp(value, code) {
  const time = Date.parse(value);
  if (
    typeof value !== "string" ||
    !Number.isFinite(time) ||
    new Date(time).toISOString() !== value
  ) {
    fail(code);
  }
  return { iso: value, time };
}

function requireSingle(values, code) {
  if (values.length !== 1) fail(code, { count: values.length });
  return values[0];
}

function normalizeScope(scope) {
  assertExactKeys(
    scope,
    ["workspaceId", "operatingProfileId", "representativeId"],
    "route_iq_committed_outcome_scope_invalid",
  );
  if (
    scope.workspaceId !== "fitness_connection" ||
    scope.operatingProfileId !== "fitness" ||
    !["anthony", "cruz"].includes(scope.representativeId)
  ) {
    fail("route_iq_committed_outcome_scope_invalid");
  }
  return clone(scope);
}

function normalizeSignal(signal, code) {
  assertExactKeys(signal, SIGNAL_KEYS, code);
  if (
    !["unsupported", "verified_allowlisted"].includes(
      signal.outcomeCodeStatus,
    ) ||
    (signal.outcomeCodeStatus === "unsupported"
      ? signal.outcomeCode !== null
      : !OUTCOME_CODES.has(signal.outcomeCode)) ||
    signal.scoreableOutcome !== null ||
    signal.scoreableOutcomeDerivedByData !== false
  ) {
    fail(code);
  }
  for (const field of [
    "conversations",
    "leads",
    "appointments",
    "units",
    "laterUnits",
  ]) {
    if (!Number.isSafeInteger(signal[field]) || signal[field] < 0) fail(code);
  }
  return clone(signal);
}

function validateExcludedDecisionMetadata(outcome) {
  if (outcome.decisionSource !== null) {
    assertExactKeys(
      outcome.decisionSource,
      [
        "sourceId",
        "confidence",
        "capturedAt",
        "temporalClassification",
        "preActionEvidence",
        "sameShadowDecisionInput",
        "scoreableOutcome",
      ],
      "route_iq_committed_outcome_decision_source_invalid",
    );
    if (
      outcome.decisionSource.temporalClassification !==
        "post_action_supporting_information" ||
      outcome.decisionSource.preActionEvidence !== false ||
      outcome.decisionSource.sameShadowDecisionInput !== false ||
      outcome.decisionSource.scoreableOutcome !== false
    ) {
      fail("route_iq_committed_outcome_decision_source_invalid");
    }
    canonicalTimestamp(
      outcome.decisionSource.capturedAt,
      "route_iq_committed_outcome_decision_source_time_invalid",
    );
  }
  if (outcome.recommendationDecisionContext !== null) {
    assertExactKeys(
      outcome.recommendationDecisionContext,
      ["recommendationAvailable", "decision", "temporalClassification"],
      "route_iq_committed_outcome_recommendation_context_invalid",
    );
    if (
      outcome.recommendationDecisionContext.temporalClassification !==
      "post_action_supporting_information"
    ) {
      fail("route_iq_committed_outcome_recommendation_context_invalid");
    }
  }
}

function validateCorrections(evidence, actionTime, archiveTime) {
  if (!Array.isArray(evidence.corrections)) {
    fail("route_iq_committed_outcome_corrections_invalid");
  }
  let priorTime = actionTime;
  let priorSignal = normalizeSignal(
    evidence.originalOutcomeSignal,
    "route_iq_committed_outcome_original_signal_invalid",
  );
  for (const [index, correction] of evidence.corrections.entries()) {
    assertExactKeys(
      correction,
      [
        "sourceCorrectionRecordSha256",
        "sequence",
        "correctedAt",
        "previousOutcomeSignal",
        "finalOutcomeSignal",
        "changedSignalFields",
        "appendOnly",
      ],
      "route_iq_committed_outcome_correction_invalid",
    );
    requireSha(
      correction.sourceCorrectionRecordSha256,
      "route_iq_committed_outcome_correction_hash_invalid",
    );
    const corrected = canonicalTimestamp(
      correction.correctedAt,
      "route_iq_committed_outcome_correction_time_invalid",
    );
    const previousSignal = normalizeSignal(
      correction.previousOutcomeSignal,
      "route_iq_committed_outcome_correction_previous_invalid",
    );
    const finalSignal = normalizeSignal(
      correction.finalOutcomeSignal,
      "route_iq_committed_outcome_correction_final_invalid",
    );
    if (
      correction.sequence !== index + 1 ||
      correction.appendOnly !== true ||
      corrected.time <= priorTime ||
      corrected.time >= archiveTime ||
      canonical(previousSignal) !== canonical(priorSignal) ||
      !Array.isArray(correction.changedSignalFields) ||
      !correction.changedSignalFields.length ||
      new Set(correction.changedSignalFields).size !==
        correction.changedSignalFields.length
    ) {
      fail("route_iq_committed_outcome_correction_invalid");
    }
    priorTime = corrected.time;
    priorSignal = finalSignal;
  }
  const finalSignal = normalizeSignal(
    evidence.finalOutcomeSignal,
    "route_iq_committed_outcome_final_signal_invalid",
  );
  if (
    (evidence.corrections.length === 0 && evidence.correctionState !== "uncorrected") ||
    (evidence.corrections.length > 0 && evidence.correctionState !== "corrected") ||
    canonical(priorSignal) !== canonical(finalSignal)
  ) {
    fail("route_iq_committed_outcome_correction_final_mismatch");
  }
  return finalSignal;
}

function validateFieldSessionProjection(projection) {
  assertExactKeys(
    projection,
    [
      "schemaVersion",
      "authority",
      "recordOrigin",
      "scope",
      "sourceArchive",
      "outcomes",
      "privacy",
      "recommendationInfluence",
      "scoreableOutcomeDerivedByData",
      "projectionSha256",
    ],
    "route_iq_committed_outcome_projection_invalid",
  );
  if (
    projection.schemaVersion !== routeIqFieldSessionOutcomeProjectionVersion ||
    projection.authority !== "prometheus_data_committed_field_session" ||
    projection.recordOrigin !== "prospective" ||
    projection.recommendationInfluence !== routeIqProspectiveRecommendationInfluence ||
    projection.scoreableOutcomeDerivedByData !== false ||
    !Array.isArray(projection.outcomes)
  ) {
    fail("route_iq_committed_outcome_projection_invalid");
  }
  const scope = normalizeScope(projection.scope);
  assertExactKeys(
    projection.sourceArchive,
    [
      "handoffContractId",
      "sourceArchiveSessionSha256",
      "rawSha256",
      "normalizedSha256",
      "archiveCommittedAt",
    ],
    "route_iq_committed_outcome_archive_invalid",
  );
  if (projection.sourceArchive.handoffContractId !== "route-iq-end-of-day-data-handoff-v1") {
    fail("route_iq_committed_outcome_archive_invalid");
  }
  for (const field of [
    "sourceArchiveSessionSha256",
    "rawSha256",
    "normalizedSha256",
  ]) {
    requireSha(
      projection.sourceArchive[field],
      "route_iq_committed_outcome_archive_hash_invalid",
    );
  }
  const archive = canonicalTimestamp(
    projection.sourceArchive.archiveCommittedAt,
    "route_iq_committed_outcome_archive_time_invalid",
  );
  assertExactKeys(
    projection.privacy,
    [
      "namesIncluded",
      "addressesIncluded",
      "contactsIncluded",
      "notesIncluded",
      "preciseLocationIncluded",
    ],
    "route_iq_committed_outcome_privacy_invalid",
  );
  if (Object.values(projection.privacy).some((value) => value !== false)) {
    fail("route_iq_committed_outcome_privacy_invalid");
  }
  const body = Object.fromEntries(
    Object.entries(projection).filter(([key]) => key !== "projectionSha256"),
  );
  requireSha(
    projection.projectionSha256,
    "route_iq_committed_outcome_projection_hash_invalid",
  );
  if (computeRouteIqCommittedOutcomeSha256(body) !== projection.projectionSha256) {
    fail("route_iq_committed_outcome_projection_hash_invalid");
  }
  return { scope, archiveTime: archive.time };
}

function validateCommittedOutcome(outcome, archiveTime) {
  assertExactKeys(
    outcome,
    [
      "sourceVisitRecordSha256",
      "candidateId",
      "candidateIdentityStatus",
      "actionEventTime",
      "eventTimeAuthority",
      "authoritativeRecordTime",
      "outcomeEvidence",
      "decisionSource",
      "recommendationDecisionContext",
      "evidenceSha256",
    ],
    "route_iq_committed_outcome_evidence_invalid",
  );
  requireSha(
    outcome.sourceVisitRecordSha256,
    "route_iq_committed_outcome_visit_hash_invalid",
  );
  requireSha(
    outcome.evidenceSha256,
    "route_iq_committed_outcome_evidence_hash_invalid",
  );
  requireId(
    outcome.candidateId,
    ID_PATTERNS.candidate,
    "route_iq_committed_outcome_candidate_invalid",
  );
  if (
    outcome.candidateIdentityStatus !==
      "derived_from_exact_governed_google_place_identity" ||
    outcome.eventTimeAuthority !==
      "dashboard_recorded_visit_time_in_committed_handoff"
  ) {
    fail("route_iq_committed_outcome_evidence_invalid");
  }
  const action = canonicalTimestamp(
    outcome.actionEventTime,
    "route_iq_committed_outcome_action_time_invalid",
  );
  const recorded = canonicalTimestamp(
    outcome.authoritativeRecordTime,
    "route_iq_committed_outcome_record_time_invalid",
  );
  if (action.time >= recorded.time || recorded.time !== archiveTime) {
    fail("route_iq_committed_outcome_chronology_invalid");
  }
  assertExactKeys(
    outcome.outcomeEvidence,
    [
      "status",
      "originalOutcomeSignal",
      "finalOutcomeSignal",
      "corrections",
      "correctionState",
      "conflictState",
      "scoreableOutcome",
      "scoreableOutcomeDerivedByData",
    ],
    "route_iq_committed_outcome_signal_evidence_invalid",
  );
  if (
    outcome.outcomeEvidence.status !== "verified_unscored_signals" ||
    outcome.outcomeEvidence.conflictState !== "none" ||
    outcome.outcomeEvidence.scoreableOutcome !== null ||
    outcome.outcomeEvidence.scoreableOutcomeDerivedByData !== false
  ) {
    fail("route_iq_committed_outcome_signal_evidence_invalid");
  }
  const finalSignal = validateCorrections(
    outcome.outcomeEvidence,
    action.time,
    archiveTime,
  );
  validateExcludedDecisionMetadata(outcome);
  const body = Object.fromEntries(
    Object.entries(outcome).filter(([key]) => key !== "evidenceSha256"),
  );
  if (computeRouteIqCommittedOutcomeSha256(body) !== outcome.evidenceSha256) {
    fail("route_iq_committed_outcome_evidence_hash_invalid");
  }
  return { finalSignal };
}

function validateImmutableEvaluationContext(link, outcome = null) {
  requireArtifactId(
    link.evaluationContextArtifactId,
    "route_iq_committed_outcome_evaluation_context_artifact_invalid",
  );
  requireSha(
    link.evaluationContextSha256,
    "route_iq_committed_outcome_evaluation_context_hash_invalid",
  );
  const context = link.evaluationContext;
  assertExactKeys(
    context,
    [
      "schemaVersion",
      "opportunityId",
      "acceptedSnapshotManifest",
      "snapshotSeal",
      "manifest",
      "candidate",
      "shadowDecision",
      "action",
      "sourceOutcome",
      "recommendationInfluence",
      "immutable",
    ],
    "route_iq_committed_outcome_evaluation_context_invalid",
  );
  if (
    context.schemaVersion !== routeIqEvaluationContextSchemaVersion ||
    (link.opportunityId !== undefined &&
      context.opportunityId !== link.opportunityId) ||
    context.recommendationInfluence !== routeIqProspectiveRecommendationInfluence ||
    context.immutable !== true ||
    computeRouteIqCommittedOutcomeSha256(context) !==
      link.evaluationContextSha256
  ) {
    fail("route_iq_committed_outcome_evaluation_context_invalid");
  }
  assertExactKeys(
    context.acceptedSnapshotManifest,
    ["artifactId", "recordSha256", "manifestRecordSha256", "acceptedAt"],
    "route_iq_committed_outcome_evaluation_context_snapshot_invalid",
  );
  assertExactKeys(
    context.snapshotSeal,
    ["artifactId", "recordSha256", "sealedAt"],
    "route_iq_committed_outcome_evaluation_context_snapshot_seal_invalid",
  );
  assertExactKeys(
    context.manifest,
    [
      "candidateManifestSha256",
      "completeManifestSha256",
      "producerContractVersion",
      "candidateSchemaVersion",
      "dataProjectionVersion",
    ],
    "route_iq_committed_outcome_evaluation_context_manifest_invalid",
  );
  assertExactKeys(
    context.candidate,
    ["candidateId", "acceptedRank", "probability", "rankingBasisVersion"],
    "route_iq_committed_outcome_evaluation_context_candidate_invalid",
  );
  assertExactKeys(
    context.shadowDecision,
    [
      "shadowDecisionRecordSha256",
      "sealArtifactId",
      "sealRecordSha256",
      "sealedAt",
    ],
    "route_iq_committed_outcome_evaluation_context_shadow_invalid",
  );
  assertExactKeys(
    context.action,
    ["artifactId", "recordSha256", "selectedCandidateId", "linkedAt"],
    "route_iq_committed_outcome_evaluation_context_action_invalid",
  );
  assertExactKeys(
    context.sourceOutcome,
    [
      "evidenceSha256",
      "correctionState",
      "correctionCount",
      "correctionRecordSha256s",
    ],
    "route_iq_committed_outcome_evaluation_context_source_invalid",
  );
  for (const artifactId of [
    context.acceptedSnapshotManifest.artifactId,
    context.snapshotSeal.artifactId,
    context.shadowDecision.sealArtifactId,
    context.action.artifactId,
  ]) {
    requireArtifactId(
      artifactId,
      "route_iq_committed_outcome_evaluation_context_artifact_invalid",
    );
  }
  for (const hash of [
    context.acceptedSnapshotManifest.recordSha256,
    context.acceptedSnapshotManifest.manifestRecordSha256,
    context.snapshotSeal.recordSha256,
    context.manifest.candidateManifestSha256,
    context.manifest.completeManifestSha256,
    context.shadowDecision.shadowDecisionRecordSha256,
    context.shadowDecision.sealRecordSha256,
    context.action.recordSha256,
    context.sourceOutcome.evidenceSha256,
  ]) {
    requireSha(
      hash,
      "route_iq_committed_outcome_evaluation_context_hash_invalid",
    );
  }
  if (
    context.manifest.producerContractVersion !==
      routeIqCandidateProducerContractVersion ||
    context.manifest.candidateSchemaVersion !==
      routeIqCandidateManifestSchemaVersion ||
    context.manifest.dataProjectionVersion !==
      routeIqChronologicalEvidenceProjectionVersion ||
    context.candidate.acceptedRank !== 1 ||
    typeof context.candidate.probability !== "number" ||
    !Number.isFinite(context.candidate.probability) ||
    context.candidate.probability < 0 ||
    context.candidate.probability > 1 ||
    (link.actionArtifactId !== undefined &&
      context.action.artifactId !== link.actionArtifactId) ||
    context.action.selectedCandidateId !== context.candidate.candidateId
  ) {
    fail("route_iq_committed_outcome_evaluation_context_binding_invalid");
  }
  if (
    outcome &&
    (context.candidate.candidateId !== outcome.candidateId ||
      context.action.selectedCandidateId !== outcome.candidateId ||
      context.sourceOutcome.evidenceSha256 !== outcome.evidenceSha256 ||
      context.sourceOutcome.correctionState !==
        outcome.outcomeEvidence.correctionState ||
      context.sourceOutcome.correctionCount !==
        outcome.outcomeEvidence.corrections.length ||
      canonical(context.sourceOutcome.correctionRecordSha256s) !==
        canonical(
          outcome.outcomeEvidence.corrections.map(
            (correction) => correction.sourceCorrectionRecordSha256,
          ),
        ))
  ) {
    fail("route_iq_committed_outcome_evaluation_context_binding_invalid");
  }
  requireVersion(
    context.candidate.rankingBasisVersion,
    "route_iq_committed_outcome_evaluation_context_ranking_invalid",
  );
  const accepted = canonicalTimestamp(
    context.acceptedSnapshotManifest.acceptedAt,
    "route_iq_committed_outcome_evaluation_context_time_invalid",
  );
  const snapshotSealed = canonicalTimestamp(
    context.snapshotSeal.sealedAt,
    "route_iq_committed_outcome_evaluation_context_time_invalid",
  );
  const shadowSealed = canonicalTimestamp(
    context.shadowDecision.sealedAt,
    "route_iq_committed_outcome_evaluation_context_time_invalid",
  );
  const actionLinked = canonicalTimestamp(
    context.action.linkedAt,
    "route_iq_committed_outcome_evaluation_context_time_invalid",
  );
  if (
    !(
      accepted.time < snapshotSealed.time &&
      snapshotSealed.time < shadowSealed.time &&
      shadowSealed.time < actionLinked.time &&
      (!outcome || actionLinked.time < Date.parse(outcome.actionEventTime))
    )
  ) {
    fail("route_iq_committed_outcome_evaluation_context_chronology_invalid");
  }
  return clone(context);
}

function validateReconciliationReceipt(receipt, projection, outcome) {
  assertExactKeys(
    receipt,
    [
      "contractVersion",
      "reconciliationId",
      "status",
      "coordinatorId",
      "sourceProjectionSha256",
      "sourceArchiveRawSha256",
      "sourceArchiveSessionSha256",
      "linked",
      "exclusions",
      "outcomeValuesInferredByData",
      "recommendationInfluence",
      "createdAt",
    ],
    "route_iq_committed_outcome_reconciliation_invalid",
  );
  if (
    receipt.contractVersion !==
      routeIqFieldSessionOutcomeProjectionContractVersion ||
    receipt.status !== "reconciled" ||
    receipt.outcomeValuesInferredByData !== false ||
    receipt.recommendationInfluence !== routeIqProspectiveRecommendationInfluence ||
    receipt.sourceProjectionSha256 !== projection.projectionSha256 ||
    receipt.sourceArchiveRawSha256 !== projection.sourceArchive.rawSha256 ||
    receipt.sourceArchiveSessionSha256 !==
      projection.sourceArchive.sourceArchiveSessionSha256 ||
    !Array.isArray(receipt.linked) ||
    !Array.isArray(receipt.exclusions)
  ) {
    fail("route_iq_committed_outcome_reconciliation_invalid");
  }
  requireId(
    receipt.reconciliationId,
    ID_PATTERNS.reconciliation,
    "route_iq_committed_outcome_reconciliation_id_invalid",
  );
  const reconciled = canonicalTimestamp(
    receipt.createdAt,
    "route_iq_committed_outcome_reconciliation_time_invalid",
  );
  if (reconciled.time <= Date.parse(projection.sourceArchive.archiveCommittedAt)) {
    fail("route_iq_committed_outcome_reconciliation_chronology_invalid");
  }
  for (const exclusion of receipt.exclusions) {
    assertExactKeys(
      exclusion,
      ["sourceVisitRecordSha256", "reasonCode"],
      "route_iq_committed_outcome_reconciliation_exclusion_invalid",
    );
  }
  if (
    receipt.exclusions.some(
      (item) => item.sourceVisitRecordSha256 === outcome.sourceVisitRecordSha256,
    )
  ) {
    fail("route_iq_committed_outcome_reconciliation_excluded");
  }
  const matches = receipt.linked.filter((item) => {
    assertExactKeys(
      item,
      [
        "sourceVisitRecordSha256",
        "opportunityId",
        "candidateId",
        "evidenceSha256",
        "actionArtifactId",
        "outcomeEvidenceArtifactId",
        "evaluationContextArtifactId",
        "evaluationContextSha256",
        "evaluationContext",
      ],
      "route_iq_committed_outcome_reconciliation_link_invalid",
    );
    return item.sourceVisitRecordSha256 === outcome.sourceVisitRecordSha256;
  });
  const link = requireSingle(
    matches,
    "route_iq_committed_outcome_reconciliation_link_missing",
  );
  requireId(
    link.opportunityId,
    ID_PATTERNS.opportunity,
    "route_iq_committed_outcome_opportunity_invalid",
  );
  requireId(
    link.candidateId,
    ID_PATTERNS.candidate,
    "route_iq_committed_outcome_candidate_invalid",
  );
  requireId(
    link.actionArtifactId,
    ID_PATTERNS.action,
    "route_iq_committed_outcome_action_invalid",
  );
  requireArtifactId(
    link.outcomeEvidenceArtifactId,
    "route_iq_committed_outcome_evidence_artifact_invalid",
  );
  if (
    link.candidateId !== outcome.candidateId ||
    link.evidenceSha256 !== outcome.evidenceSha256
  ) {
    fail("route_iq_committed_outcome_reconciliation_binding_invalid");
  }
  const evaluationContext = validateImmutableEvaluationContext(link, outcome);
  return {
    link: clone(link),
    evaluationContext,
    reconciledAt: reconciled.iso,
  };
}

function classifyFinalSignal(signal) {
  const positiveEvidence = Object.entries(
    routeIqScoreableOutcomePolicy.positiveSignalThresholds,
  )
    .filter(([field, threshold]) => signal[field] >= threshold)
    .map(([field, threshold]) => ({
      signal: field,
      observed: signal[field],
      required: threshold,
    }));
  if (positiveEvidence.length) {
    return {
      observedOutcome: { status: "observed", value: true },
      reasonCodes: [
        "verified_positive_signal_threshold_met",
        ...positiveEvidence.map((item) => `positive_${item.signal}`),
      ].sort(),
      positiveEvidence,
    };
  }
  if (
    signal.outcomeCodeStatus === "verified_allowlisted" &&
    routeIqScoreableOutcomePolicy.definitiveNegativeOutcomeCodes.includes(
      signal.outcomeCode,
    )
  ) {
    return {
      observedOutcome: { status: "observed", value: false },
      reasonCodes: ["verified_definitive_negative_without_positive_signal"],
      positiveEvidence: [],
    };
  }
  return {
    observedOutcome: { status: "missing", value: null },
    reasonCodes: [
      signal.outcomeCodeStatus === "unsupported"
        ? "unsupported_or_absent_outcome_remains_missing"
        : "pending_conversation_follow_up_or_label_only_remains_missing",
    ],
    positiveEvidence: [],
  };
}

function scoreableRecordBody(record) {
  return Object.fromEntries(
    Object.entries(record).filter(
      ([key]) => key !== "scoreableOutcomeRecordSha256",
    ),
  );
}

export function validateRouteIqScoreableOutcomeRecord(record) {
  assertExactKeys(
    record,
    [
      "schemaVersion",
      "outcomeDerivationContractVersion",
      "authority",
      "recordOrigin",
      "scope",
      "opportunityId",
      "candidateId",
      "actionArtifactId",
      "outcomeEvidenceArtifactId",
      "sourceVisitRecordSha256",
      "sourceOutcomeEvidenceSha256",
      "sourceProjectionSha256",
      "sourceProjectionVersion",
      "sourceArchiveRawSha256",
      "sourceArchiveSessionSha256",
      "sourceReconciliationId",
      "evaluationContextArtifactId",
      "evaluationContextSha256",
      "originalOutcomeSignal",
      "finalOutcomeSignal",
      "correctionChain",
      "observedOutcome",
      "positiveEvidence",
      "reasonCodes",
      "chronology",
      "readinessCountEligible",
      "boundaries",
      "recommendationInfluence",
      "immutable",
      "scoreableOutcomeRecordSha256",
    ],
    "route_iq_scoreable_outcome_record_invalid",
  );
  requireSha(
    record.scoreableOutcomeRecordSha256,
    "route_iq_scoreable_outcome_record_hash_invalid",
  );
  if (
    record.schemaVersion !== routeIqScoreableOutcomeRecordSchemaVersion ||
    record.outcomeDerivationContractVersion !==
      routeIqScoreableOutcomeDerivationContractVersion ||
    record.authority !== "prometheus_intelligence_pure_derivation" ||
    record.recordOrigin !== "prospective" ||
    record.sourceProjectionVersion !==
      routeIqFieldSessionOutcomeProjectionVersion ||
    record.recommendationInfluence !== "OFF" ||
    record.immutable !== true ||
    record.boundaries?.decisionSourceUsed !== false ||
    record.boundaries?.recommendationDecisionContextUsed !== false ||
    record.boundaries?.observationalOnly !== true ||
    record.boundaries?.causalClaimAllowed !== false ||
    record.boundaries?.upliftClaimAllowed !== false ||
    !["observed", "missing"].includes(record.observedOutcome?.status) ||
    (record.observedOutcome.status === "observed"
      ? typeof record.observedOutcome.value !== "boolean"
      : record.observedOutcome.value !== null) ||
    record.readinessCountEligible !==
      (record.observedOutcome.status === "observed") ||
    computeRouteIqCommittedOutcomeSha256(scoreableRecordBody(record)) !==
      record.scoreableOutcomeRecordSha256
  ) {
    fail("route_iq_scoreable_outcome_record_invalid");
  }
  normalizeScope(record.scope);
  requireId(
    record.opportunityId,
    ID_PATTERNS.opportunity,
    "route_iq_scoreable_outcome_opportunity_invalid",
  );
  requireId(
    record.candidateId,
    ID_PATTERNS.candidate,
    "route_iq_scoreable_outcome_candidate_invalid",
  );
  requireSha(
    record.sourceOutcomeEvidenceSha256,
    "route_iq_scoreable_outcome_source_hash_invalid",
  );
  requireSha(
    record.evaluationContextSha256,
    "route_iq_scoreable_outcome_context_hash_invalid",
  );
  requireArtifactId(
    record.evaluationContextArtifactId,
    "route_iq_scoreable_outcome_context_artifact_invalid",
  );
  requireId(
    record.sourceReconciliationId,
    ID_PATTERNS.reconciliation,
    "route_iq_scoreable_outcome_reconciliation_invalid",
  );
  normalizeSignal(
    record.originalOutcomeSignal,
    "route_iq_scoreable_outcome_original_signal_invalid",
  );
  normalizeSignal(
    record.finalOutcomeSignal,
    "route_iq_scoreable_outcome_final_signal_invalid",
  );
  return true;
}

export function deriveRouteIqScoreableOutcomeFromCommittedEvidence(input = {}) {
  assertExactKeys(
    input,
    [
      "fieldSessionOutcomeProjection",
      "reconciliationReceipt",
      "sourceVisitRecordSha256",
    ],
    "route_iq_scoreable_outcome_input_invalid",
  );
  requireSha(
    input.sourceVisitRecordSha256,
    "route_iq_scoreable_outcome_visit_hash_invalid",
  );
  const projectionContext = validateFieldSessionProjection(
    input.fieldSessionOutcomeProjection,
  );
  const outcome = requireSingle(
    input.fieldSessionOutcomeProjection.outcomes.filter(
      (item) => item.sourceVisitRecordSha256 === input.sourceVisitRecordSha256,
    ),
    "route_iq_scoreable_outcome_source_missing",
  );
  const outcomeContext = validateCommittedOutcome(
    outcome,
    projectionContext.archiveTime,
  );
  const reconciliation = validateReconciliationReceipt(
    input.reconciliationReceipt,
    input.fieldSessionOutcomeProjection,
    outcome,
  );
  const classification = classifyFinalSignal(outcomeContext.finalSignal);
  const correction = outcome.outcomeEvidence.corrections.at(-1) || null;
  const body = {
    schemaVersion: routeIqScoreableOutcomeRecordSchemaVersion,
    outcomeDerivationContractVersion:
      routeIqScoreableOutcomeDerivationContractVersion,
    authority: "prometheus_intelligence_pure_derivation",
    recordOrigin: "prospective",
    scope: projectionContext.scope,
    opportunityId: reconciliation.link.opportunityId,
    candidateId: reconciliation.link.candidateId,
    actionArtifactId: reconciliation.link.actionArtifactId,
    outcomeEvidenceArtifactId: reconciliation.link.outcomeEvidenceArtifactId,
    sourceVisitRecordSha256: outcome.sourceVisitRecordSha256,
    sourceOutcomeEvidenceSha256: outcome.evidenceSha256,
    sourceProjectionSha256:
      input.fieldSessionOutcomeProjection.projectionSha256,
    sourceProjectionVersion: routeIqFieldSessionOutcomeProjectionVersion,
    sourceArchiveRawSha256:
      input.fieldSessionOutcomeProjection.sourceArchive.rawSha256,
    sourceArchiveSessionSha256:
      input.fieldSessionOutcomeProjection.sourceArchive
        .sourceArchiveSessionSha256,
    sourceReconciliationId: input.reconciliationReceipt.reconciliationId,
    evaluationContextArtifactId:
      reconciliation.link.evaluationContextArtifactId,
    evaluationContextSha256: reconciliation.link.evaluationContextSha256,
    originalOutcomeSignal: clone(outcome.outcomeEvidence.originalOutcomeSignal),
    finalOutcomeSignal: clone(outcomeContext.finalSignal),
    correctionChain: {
      state: outcome.outcomeEvidence.correctionState,
      correctionCount: outcome.outcomeEvidence.corrections.length,
      correctionRecordSha256s: outcome.outcomeEvidence.corrections.map(
        (item) => item.sourceCorrectionRecordSha256,
      ),
      finalCorrectionRecordSha256:
        correction?.sourceCorrectionRecordSha256 || null,
      chainSha256: computeRouteIqCommittedOutcomeSha256(
        outcome.outcomeEvidence.corrections,
      ),
      finalSignalSha256: computeRouteIqCommittedOutcomeSha256(
        outcomeContext.finalSignal,
      ),
    },
    observedOutcome: classification.observedOutcome,
    positiveEvidence: classification.positiveEvidence,
    reasonCodes: classification.reasonCodes,
    chronology: {
      actionEventTime: outcome.actionEventTime,
      archiveCommittedAt:
        input.fieldSessionOutcomeProjection.sourceArchive.archiveCommittedAt,
      reconciledAt: reconciliation.reconciledAt,
    },
    readinessCountEligible:
      classification.observedOutcome.status === "observed",
    boundaries: {
      decisionSourceUsed: false,
      recommendationDecisionContextUsed: false,
      labelAloneCountsAsPositive: false,
      observationalOnly: true,
      causalClaimAllowed: false,
      upliftClaimAllowed: false,
      piiIncluded: false,
    },
    recommendationInfluence: "OFF",
    immutable: true,
  };
  const record = deepFreeze({
    ...body,
    scoreableOutcomeRecordSha256:
      computeRouteIqCommittedOutcomeSha256(body),
  });
  validateRouteIqScoreableOutcomeRecord(record);
  return record;
}

function validateAdmissionTime(value, after, code) {
  const time = canonicalTimestamp(value, code);
  if (time.time <= Date.parse(after)) fail(code);
  return time.iso;
}

export function buildRouteIqScoreableOutcomeAdmissionClaims(input = {}) {
  assertExactKeys(
    input,
    ["scope", "scoreableOutcome", "authoritativeRecordTime"],
    "route_iq_scoreable_outcome_claim_input_invalid",
  );
  const scope = normalizeScope(input.scope);
  validateRouteIqScoreableOutcomeRecord(input.scoreableOutcome);
  if (canonical(scope) !== canonical(input.scoreableOutcome.scope)) {
    fail("route_iq_scoreable_outcome_claim_scope_invalid");
  }
  const authoritativeRecordTime = validateAdmissionTime(
    input.authoritativeRecordTime,
    input.scoreableOutcome.chronology.reconciledAt,
    "route_iq_scoreable_outcome_claim_time_invalid",
  );
  return deepFreeze({
    purpose: "scoreable_outcome_admission",
    ...scope,
    authoritativeRecordTime,
    sourceOutcomeEvidenceSha256:
      input.scoreableOutcome.sourceOutcomeEvidenceSha256,
    evaluationContextSha256:
      input.scoreableOutcome.evaluationContextSha256,
    outcomeDerivationContractVersion:
      routeIqScoreableOutcomeDerivationContractVersion,
    observedOutcome: clone(input.scoreableOutcome.observedOutcome),
  });
}

function validateOutcomeReceipt(receipt, scoreableOutcome) {
  assertExactKeys(
    receipt,
    [
      "coordinatorContractVersion",
      "status",
      "coordinatorId",
      "sessionId",
      "opportunityId",
      "operationKey",
      "operationKind",
      "requestSha256",
      "artifactId",
      "recordSha256",
      "recordSequence",
      "authoritativeRecordTime",
      "state",
      "recoveryOutboxPersisted",
      "recommendationInfluence",
      "collectionDefault",
      "sourceOutcomeEvidenceSha256",
      "evaluationContextSha256",
      "evaluatedCandidateId",
      "calculatedByData",
    ],
    "route_iq_evaluation_outcome_receipt_invalid",
  );
  if (
    receipt.coordinatorContractVersion !==
      routeIqProspectiveCoordinatorContractVersion ||
    receipt.status !== "recorded" ||
    receipt.operationKind !== "scoreable_outcome_admission" ||
    receipt.state !== "OUTCOME_LINKED" ||
    receipt.recoveryOutboxPersisted !== true ||
    receipt.recommendationInfluence !==
      routeIqProspectiveRecommendationInfluence ||
    receipt.collectionDefault !== routeIqProspectiveCollectionDefault ||
    receipt.calculatedByData !== false ||
    receipt.opportunityId !== scoreableOutcome.opportunityId ||
    receipt.evaluatedCandidateId !== scoreableOutcome.candidateId ||
    receipt.sourceOutcomeEvidenceSha256 !==
      scoreableOutcome.sourceOutcomeEvidenceSha256 ||
    receipt.evaluationContextSha256 !==
      scoreableOutcome.evaluationContextSha256
  ) {
    fail("route_iq_evaluation_outcome_receipt_invalid");
  }
  requireId(
    receipt.artifactId,
    ID_PATTERNS.outcome,
    "route_iq_evaluation_outcome_artifact_invalid",
  );
  requireSha(receipt.recordSha256, "route_iq_evaluation_outcome_hash_invalid");
  requireSequence(
    receipt.recordSequence,
    "route_iq_evaluation_outcome_sequence_invalid",
  );
  canonicalTimestamp(
    receipt.authoritativeRecordTime,
    "route_iq_evaluation_outcome_time_invalid",
  );
  return receipt;
}

export function validateRouteIqEvaluationContext(contextReceipt) {
  assertExactKeys(
    contextReceipt,
    [
      "evaluationContextArtifactId",
      "evaluationContextSha256",
      "evaluationContext",
    ],
    "route_iq_evaluation_context_receipt_invalid",
  );
  validateImmutableEvaluationContext(contextReceipt);
  return true;
}

function validateReconciliationForEvaluation(receipt, scoreableOutcome) {
  assertExactKeys(
    receipt,
    [
      "contractVersion",
      "reconciliationId",
      "status",
      "coordinatorId",
      "sourceProjectionSha256",
      "sourceArchiveRawSha256",
      "sourceArchiveSessionSha256",
      "linked",
      "exclusions",
      "outcomeValuesInferredByData",
      "recommendationInfluence",
      "createdAt",
    ],
    "route_iq_evaluation_reconciliation_invalid",
  );
  if (
    receipt.contractVersion !==
      routeIqFieldSessionOutcomeProjectionContractVersion ||
    receipt.status !== "reconciled" ||
    receipt.sourceProjectionSha256 !==
      scoreableOutcome.sourceProjectionSha256 ||
    receipt.sourceArchiveRawSha256 !==
      scoreableOutcome.sourceArchiveRawSha256 ||
    receipt.sourceArchiveSessionSha256 !==
      scoreableOutcome.sourceArchiveSessionSha256 ||
    receipt.outcomeValuesInferredByData !== false ||
    receipt.recommendationInfluence !==
      routeIqProspectiveRecommendationInfluence ||
    !Array.isArray(receipt.linked) ||
    !Array.isArray(receipt.exclusions) ||
    receipt.createdAt !== scoreableOutcome.chronology.reconciledAt
  ) {
    fail("route_iq_evaluation_reconciliation_invalid");
  }
  requireId(
    receipt.reconciliationId,
    ID_PATTERNS.reconciliation,
    "route_iq_evaluation_reconciliation_id_invalid",
  );
  if (receipt.reconciliationId !== scoreableOutcome.sourceReconciliationId) {
    fail("route_iq_evaluation_reconciliation_binding_invalid");
  }
  canonicalTimestamp(
    receipt.createdAt,
    "route_iq_evaluation_reconciliation_time_invalid",
  );
  for (const exclusion of receipt.exclusions) {
    assertExactKeys(
      exclusion,
      ["sourceVisitRecordSha256", "reasonCode"],
      "route_iq_evaluation_reconciliation_exclusion_invalid",
    );
  }
  if (
    receipt.exclusions.some(
      (exclusion) =>
        exclusion.sourceVisitRecordSha256 ===
        scoreableOutcome.sourceVisitRecordSha256,
    )
  ) {
    fail("route_iq_evaluation_reconciliation_excluded");
  }
  const link = requireSingle(
    receipt.linked.filter(
      (candidate) =>
        candidate.sourceVisitRecordSha256 ===
        scoreableOutcome.sourceVisitRecordSha256,
    ),
    "route_iq_evaluation_reconciliation_link_missing",
  );
  assertExactKeys(
    link,
    [
      "sourceVisitRecordSha256",
      "opportunityId",
      "candidateId",
      "evidenceSha256",
      "actionArtifactId",
      "outcomeEvidenceArtifactId",
      "evaluationContextArtifactId",
      "evaluationContextSha256",
      "evaluationContext",
    ],
    "route_iq_evaluation_reconciliation_link_invalid",
  );
  if (
    link.opportunityId !== scoreableOutcome.opportunityId ||
    link.candidateId !== scoreableOutcome.candidateId ||
    link.evidenceSha256 !==
      scoreableOutcome.sourceOutcomeEvidenceSha256 ||
    link.actionArtifactId !== scoreableOutcome.actionArtifactId ||
    link.outcomeEvidenceArtifactId !==
      scoreableOutcome.outcomeEvidenceArtifactId ||
    link.evaluationContextArtifactId !==
      scoreableOutcome.evaluationContextArtifactId ||
    link.evaluationContextSha256 !==
      scoreableOutcome.evaluationContextSha256
  ) {
    fail("route_iq_evaluation_reconciliation_binding_invalid");
  }
  validateRouteIqEvaluationContext({
    evaluationContextArtifactId: link.evaluationContextArtifactId,
    evaluationContextSha256: link.evaluationContextSha256,
    evaluationContext: link.evaluationContext,
  });
  return { link: clone(link), context: clone(link.evaluationContext) };
}

function validateCommittedOutcomeProjection(
  committedProjection,
  scoreableOutcome,
  outcomeReceipt,
) {
  assertExactKeys(
    committedProjection,
    ["projection", "commit"],
    "route_iq_evaluation_committed_projection_invalid",
  );
  const projection = committedProjection.projection;
  const commit = committedProjection.commit;
  assertExactKeys(
    projection,
    [
      "schemaVersion",
      "projectionVersion",
      "authority",
      "coordinatorId",
      "scope",
      "canonicalSessionRecordSha256",
      "territoryId",
      "opportunityId",
      "opportunityType",
      "asOfRecordSequence",
      "asOfRecordTime",
      "state",
      "readinessEvidenceEligible",
      "evidence",
      "exclusions",
      "sourceArtifacts",
      "recommendationInfluence",
      "collectionDefault",
      "kvAuthority",
    ],
    "route_iq_evaluation_projection_invalid",
  );
  if (
    projection.schemaVersion !== routeIqProspectiveCoordinatorSchemaVersion ||
    projection.projectionVersion !==
      routeIqProspectiveCoordinatorProjectionVersion ||
    projection.authority !== "sqlite_durable_object_coordinator" ||
    canonical(projection.scope) !== canonical(scoreableOutcome.scope) ||
    projection.opportunityId !== scoreableOutcome.opportunityId ||
    projection.opportunityType !== "next_stop" ||
    projection.asOfRecordSequence !== outcomeReceipt.recordSequence ||
    projection.asOfRecordTime !== outcomeReceipt.authoritativeRecordTime ||
    projection.state !== "OUTCOME_LINKED" ||
    projection.readinessEvidenceEligible !== true ||
    !Array.isArray(projection.evidence) ||
    !Array.isArray(projection.exclusions) ||
    !Array.isArray(projection.sourceArtifacts) ||
    projection.exclusions.length !== 0 ||
    projection.recommendationInfluence !==
      routeIqProspectiveRecommendationInfluence ||
    projection.collectionDefault !== routeIqProspectiveCollectionDefault ||
    projection.kvAuthority !== routeIqProspectiveKvAuthority
  ) {
    fail("route_iq_evaluation_projection_invalid");
  }
  normalizeScope(projection.scope);
  requireSha(
    projection.canonicalSessionRecordSha256,
    "route_iq_evaluation_projection_session_hash_invalid",
  );
  requireArtifactId(
    projection.territoryId,
    "route_iq_evaluation_projection_territory_invalid",
  );
  requireSequence(
    projection.asOfRecordSequence,
    "route_iq_evaluation_projection_sequence_invalid",
  );
  canonicalTimestamp(
    projection.asOfRecordTime,
    "route_iq_evaluation_projection_time_invalid",
  );
  const sourceIds = new Set();
  for (const source of projection.sourceArtifacts) {
    assertExactKeys(
      source,
      [
        "artifactId",
        "artifactKind",
        "eventKind",
        "recordSequence",
        "authoritativeRecordTime",
        "recordSha256",
      ],
      "route_iq_evaluation_projection_source_invalid",
    );
    requireArtifactId(
      source.artifactId,
      "route_iq_evaluation_projection_source_artifact_invalid",
    );
    requireSequence(
      source.recordSequence,
      "route_iq_evaluation_projection_source_sequence_invalid",
    );
    canonicalTimestamp(
      source.authoritativeRecordTime,
      "route_iq_evaluation_projection_source_time_invalid",
    );
    requireSha(
      source.recordSha256,
      "route_iq_evaluation_projection_source_hash_invalid",
    );
    if (sourceIds.has(source.artifactId)) {
      fail("route_iq_evaluation_projection_source_duplicate");
    }
    sourceIds.add(source.artifactId);
  }
  const outcomeSource = requireSingle(
    projection.sourceArtifacts.filter(
      (source) => source.artifactId === outcomeReceipt.artifactId,
    ),
    "route_iq_evaluation_projection_outcome_source_missing",
  );
  if (
    outcomeSource.eventKind !== "OUTCOME_LINKED" ||
    outcomeSource.recordSha256 !== outcomeReceipt.recordSha256 ||
    outcomeSource.recordSequence !== outcomeReceipt.recordSequence ||
    outcomeSource.authoritativeRecordTime !==
      outcomeReceipt.authoritativeRecordTime
  ) {
    fail("route_iq_evaluation_projection_outcome_source_invalid");
  }
  const fieldEvidenceSource = requireSingle(
    projection.sourceArtifacts.filter(
      (source) =>
        source.artifactId === scoreableOutcome.outcomeEvidenceArtifactId,
    ),
    "route_iq_evaluation_projection_field_source_missing",
  );
  if (
    fieldEvidenceSource.eventKind !==
      "FIELD_SESSION_OUTCOME_EVIDENCE_LINKED" ||
    Date.parse(fieldEvidenceSource.authoritativeRecordTime) <=
      Date.parse(scoreableOutcome.chronology.archiveCommittedAt) ||
    Date.parse(fieldEvidenceSource.authoritativeRecordTime) >=
      Date.parse(scoreableOutcome.chronology.reconciledAt)
  ) {
    fail("route_iq_evaluation_projection_field_source_invalid");
  }
  const outcomeEvidence = requireSingle(
    projection.evidence.filter(
      (evidence) => evidence.sourceRecordId === outcomeReceipt.artifactId,
    ),
    "route_iq_evaluation_projection_outcome_evidence_missing",
  );
  assertExactKeys(
    outcomeEvidence,
    [
      "sourceRecordId",
      "evidenceKind",
      "evidenceTimestamp",
      "recordSequence",
      "recordSha256",
      "payload",
      "canonicalEvidenceEligible",
      "recommendationInfluence",
    ],
    "route_iq_evaluation_projection_outcome_evidence_invalid",
  );
  assertExactKeys(
    outcomeEvidence.payload,
    [
      "evaluatedCandidateId",
      "actionArtifactId",
      "sourceOutcomeEvidenceSha256",
      "evaluationContextSha256",
      "outcomeDerivationContractVersion",
      "observedOutcome",
      "calculatedByData",
      "unchosenCandidateOutcomeAssignmentAllowed",
    ],
    "route_iq_evaluation_projection_outcome_payload_invalid",
  );
  assertExactKeys(
    outcomeEvidence.payload.observedOutcome,
    ["status", "value"],
    "route_iq_evaluation_projection_outcome_payload_invalid",
  );
  if (
    outcomeEvidence.evidenceKind !== "prospective_opportunity_outcome" ||
    outcomeEvidence.evidenceTimestamp !==
      outcomeReceipt.authoritativeRecordTime ||
    outcomeEvidence.recordSequence !== outcomeReceipt.recordSequence ||
    outcomeEvidence.recordSha256 !== outcomeReceipt.recordSha256 ||
    outcomeEvidence.canonicalEvidenceEligible !== true ||
    outcomeEvidence.recommendationInfluence !==
      routeIqProspectiveRecommendationInfluence ||
    outcomeEvidence.payload.evaluatedCandidateId !==
      scoreableOutcome.candidateId ||
    outcomeEvidence.payload.actionArtifactId !==
      scoreableOutcome.actionArtifactId ||
    outcomeEvidence.payload.sourceOutcomeEvidenceSha256 !==
      scoreableOutcome.sourceOutcomeEvidenceSha256 ||
    outcomeEvidence.payload.evaluationContextSha256 !==
      scoreableOutcome.evaluationContextSha256 ||
    outcomeEvidence.payload.outcomeDerivationContractVersion !==
      scoreableOutcome.outcomeDerivationContractVersion ||
    canonical(outcomeEvidence.payload.observedOutcome) !==
      canonical(scoreableOutcome.observedOutcome) ||
    outcomeEvidence.payload.calculatedByData !== false ||
    outcomeEvidence.payload.unchosenCandidateOutcomeAssignmentAllowed !==
      false
  ) {
    fail("route_iq_evaluation_projection_outcome_evidence_invalid");
  }
  assertExactKeys(
    commit,
    [
      "commitId",
      "projectionId",
      "outboxId",
      "status",
      "projectionSha256",
      "committedSequence",
      "committedAt",
      "projectionCommitMarkerWrittenLast",
      "commitSha256",
    ],
    "route_iq_evaluation_projection_commit_invalid",
  );
  for (const artifactId of [
    commit.commitId,
    commit.projectionId,
    commit.outboxId,
  ]) {
    requireArtifactId(
      artifactId,
      "route_iq_evaluation_projection_commit_artifact_invalid",
    );
  }
  requireSha(
    commit.projectionSha256,
    "route_iq_evaluation_projection_commit_hash_invalid",
  );
  requireSha(
    commit.commitSha256,
    "route_iq_evaluation_projection_commit_hash_invalid",
  );
  const commitBody = Object.fromEntries(
    Object.entries(commit).filter(([key]) => key !== "commitSha256"),
  );
  if (
    commit.status !== "committed" ||
    commit.projectionSha256 !==
      computeRouteIqCommittedOutcomeSha256(projection) ||
    commit.committedSequence !== projection.asOfRecordSequence ||
    commit.committedAt !== projection.asOfRecordTime ||
    commit.projectionCommitMarkerWrittenLast !== true ||
    computeRouteIqCommittedOutcomeSha256(commitBody) !== commit.commitSha256
  ) {
    fail("route_iq_evaluation_projection_commit_invalid");
  }
  return {
    sourceProjection: {
      projectionId: commit.projectionId,
      projectionCommitId: commit.commitId,
      projectionSha256: commit.projectionSha256,
      asOfRecordSequence: projection.asOfRecordSequence,
      asOfRecordTime: projection.asOfRecordTime,
    },
    fieldEvidenceLinkedAt: fieldEvidenceSource.authoritativeRecordTime,
  };
}

function evaluationRecordBody(record) {
  return Object.fromEntries(
    Object.entries(record).filter(([key]) => key !== "evaluationRecordSha256"),
  );
}

export function validateRouteIqEvaluationRecord(record) {
  assertExactKeys(
    record,
    [
      "schemaVersion",
      "evaluationContractVersion",
      "authority",
      "recordOrigin",
      "scope",
      "opportunityId",
      "evaluationContextSha256",
      "sourceProjection",
      "shadowContext",
      "acceptedCandidate",
      "action",
      "scoreableOutcome",
      "chronology",
      "readinessObservation",
      "boundaries",
      "canonicalProductionEvidenceEligible",
      "recommendationInfluence",
      "immutable",
      "evaluationRecordSha256",
    ],
    "route_iq_evaluation_record_invalid",
  );
  assertExactKeys(
    record.sourceProjection,
    [
      "projectionId",
      "projectionCommitId",
      "projectionSha256",
      "asOfRecordSequence",
      "asOfRecordTime",
    ],
    "route_iq_evaluation_record_source_projection_invalid",
  );
  assertExactKeys(
    record.shadowContext,
    ["sealArtifactId", "sealEventRecordSha256", "sealedAt"],
    "route_iq_evaluation_record_shadow_invalid",
  );
  assertExactKeys(
    record.acceptedCandidate,
    [
      "candidateId",
      "rank",
      "probability",
      "rankingBasisVersion",
      "candidateManifestSha256",
      "completeManifestSha256",
    ],
    "route_iq_evaluation_record_candidate_invalid",
  );
  assertExactKeys(
    record.action,
    [
      "candidateId",
      "actionArtifactId",
      "actionRecordSha256",
      "linkedAt",
      "selectionAuthority",
    ],
    "route_iq_evaluation_record_action_invalid",
  );
  assertExactKeys(
    record.scoreableOutcome,
    [
      "outcomeArtifactId",
      "outcomeRecordSha256",
      "sourceOutcomeEvidenceSha256",
      "scoreableOutcomeRecordSha256",
      "outcomeDerivationContractVersion",
      "observedOutcome",
      "admittedAt",
    ],
    "route_iq_evaluation_record_outcome_invalid",
  );
  assertExactKeys(
    record.scoreableOutcome.observedOutcome,
    ["status", "value"],
    "route_iq_evaluation_record_outcome_invalid",
  );
  assertExactKeys(
    record.chronology,
    [
      "snapshotAcceptedAt",
      "shadowSealedAt",
      "actionLinkedAt",
      "visitActionEventTime",
      "archiveCommittedAt",
      "fieldEvidenceLinkedAt",
      "reconciledAt",
      "outcomeAdmittedAt",
    ],
    "route_iq_evaluation_record_chronology_invalid",
  );
  assertExactKeys(
    record.readinessObservation,
    [
      "actualDecisionId",
      "evaluatedDecisionId",
      "selectedCandidateProbability",
      "selectedCandidateRank",
      "observedOutcome",
      "scoreableSelectedCandidateOutcome",
      "readinessCountEligible",
    ],
    "route_iq_evaluation_record_readiness_invalid",
  );
  assertExactKeys(
    record.readinessObservation.observedOutcome,
    ["status", "value", "evaluatedDecisionId"],
    "route_iq_evaluation_record_readiness_invalid",
  );
  assertExactKeys(
    record.boundaries,
    [
      "decisionSourceUsed",
      "futureEvidenceUsed",
      "observationalOnly",
      "causalClaimAllowed",
      "upliftClaimAllowed",
      "recommendationInfluenceAllowed",
    ],
    "route_iq_evaluation_record_boundaries_invalid",
  );
  normalizeScope(record.scope);
  for (const artifactId of [
    record.sourceProjection.projectionId,
    record.sourceProjection.projectionCommitId,
    record.shadowContext.sealArtifactId,
    record.action.actionArtifactId,
    record.scoreableOutcome.outcomeArtifactId,
  ]) {
    requireArtifactId(
      artifactId,
      "route_iq_evaluation_record_artifact_invalid",
    );
  }
  for (const hash of [
    record.evaluationContextSha256,
    record.sourceProjection.projectionSha256,
    record.shadowContext.sealEventRecordSha256,
    record.acceptedCandidate.candidateManifestSha256,
    record.acceptedCandidate.completeManifestSha256,
    record.action.actionRecordSha256,
    record.scoreableOutcome.outcomeRecordSha256,
    record.scoreableOutcome.sourceOutcomeEvidenceSha256,
    record.scoreableOutcome.scoreableOutcomeRecordSha256,
    record.evaluationRecordSha256,
  ]) {
    requireSha(hash, "route_iq_evaluation_record_hash_invalid");
  }
  requireSequence(
    record.sourceProjection.asOfRecordSequence,
    "route_iq_evaluation_record_projection_sequence_invalid",
  );
  requireVersion(
    record.acceptedCandidate.rankingBasisVersion,
    "route_iq_evaluation_record_ranking_version_invalid",
  );
  requireVersion(
    record.scoreableOutcome.outcomeDerivationContractVersion,
    "route_iq_evaluation_record_outcome_version_invalid",
  );
  const boundaries = {
    decisionSourceUsed: false,
    futureEvidenceUsed: false,
    observationalOnly: true,
    causalClaimAllowed: false,
    upliftClaimAllowed: false,
    recommendationInfluenceAllowed: false,
  };
  if (
    record.schemaVersion !== routeIqEvaluationRecordSchemaVersion ||
    record.evaluationContractVersion !== routeIqEvaluationContractVersion ||
    record.authority !== "prometheus_intelligence_pure_evaluation" ||
    record.recordOrigin !== "prospective" ||
    record.acceptedCandidate.rank !== 1 ||
    typeof record.acceptedCandidate.probability !== "number" ||
    !Number.isFinite(record.acceptedCandidate.probability) ||
    record.acceptedCandidate.probability < 0 ||
    record.acceptedCandidate.probability > 1 ||
    record.action.candidateId !== record.acceptedCandidate.candidateId ||
    record.action.selectionAuthority !==
      "accepted_manifest_unique_ordinal_1" ||
    record.scoreableOutcome.observedOutcome.status !== "observed" ||
    typeof record.scoreableOutcome.observedOutcome.value !== "boolean" ||
    record.readinessObservation.actualDecisionId !==
      record.acceptedCandidate.candidateId ||
    record.readinessObservation.evaluatedDecisionId !==
      record.acceptedCandidate.candidateId ||
    record.readinessObservation.selectedCandidateProbability !==
      record.acceptedCandidate.probability ||
    record.readinessObservation.selectedCandidateRank !== 1 ||
    record.readinessObservation.observedOutcome.status !== "observed" ||
    record.readinessObservation.observedOutcome.value !==
      record.scoreableOutcome.observedOutcome.value ||
    record.readinessObservation.observedOutcome.evaluatedDecisionId !==
      record.acceptedCandidate.candidateId ||
    record.readinessObservation.scoreableSelectedCandidateOutcome !== true ||
    record.readinessObservation.readinessCountEligible !== true ||
    canonical(record.boundaries) !== canonical(boundaries) ||
    record.canonicalProductionEvidenceEligible !== true ||
    record.recommendationInfluence !== "OFF" ||
    record.immutable !== true ||
    computeRouteIqCommittedOutcomeSha256(evaluationRecordBody(record)) !==
      record.evaluationRecordSha256
  ) {
    fail("route_iq_evaluation_record_invalid");
  }
  const orderedTimes = [
    record.chronology.snapshotAcceptedAt,
    record.chronology.shadowSealedAt,
    record.chronology.actionLinkedAt,
    record.chronology.visitActionEventTime,
    record.chronology.archiveCommittedAt,
    record.chronology.fieldEvidenceLinkedAt,
    record.chronology.reconciledAt,
    record.chronology.outcomeAdmittedAt,
  ].map((value) =>
    canonicalTimestamp(value, "route_iq_evaluation_record_chronology_invalid")
      .time,
  );
  if (
    orderedTimes.some(
      (time, index) => index > 0 && time <= orderedTimes[index - 1],
    ) ||
    record.sourceProjection.asOfRecordTime !==
      record.chronology.outcomeAdmittedAt ||
    record.scoreableOutcome.admittedAt !==
      record.chronology.outcomeAdmittedAt ||
    record.shadowContext.sealedAt !== record.chronology.shadowSealedAt ||
    record.action.linkedAt !== record.chronology.actionLinkedAt
  ) {
    fail("route_iq_evaluation_record_chronology_invalid");
  }
  return true;
}

export function buildRouteIqEvaluationFromAdmittedOutcome(input = {}) {
  assertExactKeys(
    input,
    [
      "reconciliationReceipt",
      "committedProjection",
      "scoreableOutcome",
      "outcomeReceipt",
    ],
    "route_iq_evaluation_input_invalid",
  );
  validateRouteIqScoreableOutcomeRecord(input.scoreableOutcome);
  if (input.scoreableOutcome.observedOutcome.status !== "observed") {
    fail("route_iq_evaluation_scoreable_outcome_missing");
  }
  const outcomeReceipt = validateOutcomeReceipt(
    input.outcomeReceipt,
    input.scoreableOutcome,
  );
  const reconciliation = validateReconciliationForEvaluation(
    input.reconciliationReceipt,
    input.scoreableOutcome,
  );
  const projection = validateCommittedOutcomeProjection(
    input.committedProjection,
    input.scoreableOutcome,
    outcomeReceipt,
  );
  const context = reconciliation.context;
  const outcome = input.scoreableOutcome;
  if (
    context.opportunityId !== outcome.opportunityId ||
    context.candidate.candidateId !== outcome.candidateId ||
    context.action.selectedCandidateId !== outcome.candidateId ||
    context.action.artifactId !== outcome.actionArtifactId ||
    context.sourceOutcome.evidenceSha256 !==
      outcome.sourceOutcomeEvidenceSha256 ||
    outcomeReceipt.opportunityId !== context.opportunityId ||
    outcomeReceipt.evaluatedCandidateId !== context.candidate.candidateId ||
    outcomeReceipt.evaluationContextSha256 !==
      reconciliation.link.evaluationContextSha256
  ) {
    fail("route_iq_evaluation_context_outcome_binding_invalid");
  }
  const chronology = {
    snapshotAcceptedAt: context.acceptedSnapshotManifest.acceptedAt,
    shadowSealedAt: context.shadowDecision.sealedAt,
    actionLinkedAt: context.action.linkedAt,
    visitActionEventTime: outcome.chronology.actionEventTime,
    archiveCommittedAt: outcome.chronology.archiveCommittedAt,
    fieldEvidenceLinkedAt: projection.fieldEvidenceLinkedAt,
    reconciledAt: outcome.chronology.reconciledAt,
    outcomeAdmittedAt: outcomeReceipt.authoritativeRecordTime,
  };
  const body = {
    schemaVersion: routeIqEvaluationRecordSchemaVersion,
    evaluationContractVersion: routeIqEvaluationContractVersion,
    authority: "prometheus_intelligence_pure_evaluation",
    recordOrigin: "prospective",
    scope: clone(outcome.scope),
    opportunityId: context.opportunityId,
    evaluationContextSha256: reconciliation.link.evaluationContextSha256,
    sourceProjection: projection.sourceProjection,
    shadowContext: {
      sealArtifactId: context.shadowDecision.sealArtifactId,
      sealEventRecordSha256: context.shadowDecision.sealRecordSha256,
      sealedAt: context.shadowDecision.sealedAt,
    },
    acceptedCandidate: {
      candidateId: context.candidate.candidateId,
      rank: context.candidate.acceptedRank,
      probability: context.candidate.probability,
      rankingBasisVersion: context.candidate.rankingBasisVersion,
      candidateManifestSha256: context.manifest.candidateManifestSha256,
      completeManifestSha256: context.manifest.completeManifestSha256,
    },
    action: {
      candidateId: context.action.selectedCandidateId,
      actionArtifactId: context.action.artifactId,
      actionRecordSha256: context.action.recordSha256,
      linkedAt: context.action.linkedAt,
      selectionAuthority: "accepted_manifest_unique_ordinal_1",
    },
    scoreableOutcome: {
      outcomeArtifactId: outcomeReceipt.artifactId,
      outcomeRecordSha256: outcomeReceipt.recordSha256,
      sourceOutcomeEvidenceSha256: outcome.sourceOutcomeEvidenceSha256,
      scoreableOutcomeRecordSha256:
        outcome.scoreableOutcomeRecordSha256,
      outcomeDerivationContractVersion:
        outcome.outcomeDerivationContractVersion,
      observedOutcome: clone(outcome.observedOutcome),
      admittedAt: outcomeReceipt.authoritativeRecordTime,
    },
    chronology,
    readinessObservation: {
      actualDecisionId: context.action.selectedCandidateId,
      evaluatedDecisionId: context.candidate.candidateId,
      selectedCandidateProbability: context.candidate.probability,
      selectedCandidateRank: context.candidate.acceptedRank,
      observedOutcome: {
        ...clone(outcome.observedOutcome),
        evaluatedDecisionId: context.candidate.candidateId,
      },
      scoreableSelectedCandidateOutcome: true,
      readinessCountEligible: true,
    },
    boundaries: {
      decisionSourceUsed: false,
      futureEvidenceUsed: false,
      observationalOnly: true,
      causalClaimAllowed: false,
      upliftClaimAllowed: false,
      recommendationInfluenceAllowed: false,
    },
    canonicalProductionEvidenceEligible: true,
    recommendationInfluence: "OFF",
    immutable: true,
  };
  const evaluation = deepFreeze({
    ...body,
    evaluationRecordSha256: computeRouteIqCommittedOutcomeSha256(body),
  });
  validateRouteIqEvaluationRecord(evaluation);
  return evaluation;
}

export function buildRouteIqEvaluationAdmissionClaims(input = {}) {
  assertExactKeys(
    input,
    ["scope", "evaluation", "authoritativeRecordTime"],
    "route_iq_evaluation_claim_input_invalid",
  );
  const scope = normalizeScope(input.scope);
  validateRouteIqEvaluationRecord(input.evaluation);
  if (canonical(scope) !== canonical(input.evaluation.scope)) {
    fail("route_iq_evaluation_claim_scope_invalid");
  }
  const authoritativeRecordTime = validateAdmissionTime(
    input.authoritativeRecordTime,
    input.evaluation.chronology.outcomeAdmittedAt,
    "route_iq_evaluation_claim_time_invalid",
  );
  return deepFreeze({
    purpose: "evaluation_admission",
    ...scope,
    authoritativeRecordTime,
    sourceOutcomeEvidenceSha256:
      input.evaluation.scoreableOutcome.sourceOutcomeEvidenceSha256,
    evaluationContextSha256: input.evaluation.evaluationContextSha256,
    evaluationRecordSha256: input.evaluation.evaluationRecordSha256,
    evaluationContractVersion: routeIqEvaluationContractVersion,
    evaluationRecord: clone(input.evaluation),
  });
}

export function isRouteIqEvaluationReadinessCountEligible(evaluation) {
  validateRouteIqEvaluationRecord(evaluation);
  return (
    evaluation.scoreableOutcome.observedOutcome.status === "observed" &&
    typeof evaluation.scoreableOutcome.observedOutcome.value === "boolean" &&
    evaluation.readinessObservation.readinessCountEligible === true
  );
}
