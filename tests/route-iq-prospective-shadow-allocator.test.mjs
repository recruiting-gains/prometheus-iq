import test from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  computeRouteIqCandidateManifestDigests,
  initializeRouteIqProspectiveCoordinatorSchema,
  openRouteIqProspectiveCoordinator,
  routeIqCandidateManifestSchemaVersion,
  routeIqCandidateProducerContractVersion,
  routeIqCandidateProducerEnvelopeVersion,
  routeIqCandidateSourceSchemaVersion,
  routeIqCandidateSourceVersion,
  routeIqCommittedOutcomeProjectionReadContractVersion,
  routeIqEvaluationContextSchemaVersion,
  routeIqFieldSessionOutcomeProjectionContractVersion,
  routeIqIntelligenceEvaluationContractVersion,
  routeIqIntelligenceEvaluationRecordSchemaVersion,
  routeIqProspectiveRuntimeContextContractVersion,
  routeIqProspectiveServerAllocatorContractVersion
} from "../data/route-iq-field-sessions-v1/route-iq-prospective-shadow-coordinator.mjs";

const BASE_TIME = Date.parse("2026-07-13T18:00:00.000Z");

function iso(offset) {
  return new Date(BASE_TIME + offset).toISOString();
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function digest(value) {
  return createHash("sha256").update(typeof value === "string" ? value : stableJson(value)).digest("hex");
}

class NodeSqliteRepository {
  constructor(location = ":memory:") {
    this.db = new DatabaseSync(location);
    this.mutationCount = 0;
    this.failAtMutation = null;
  }

  executeSchema(sql) {
    this.db.exec(sql);
  }

  execute(sql, bindings = []) {
    if (/^\s*(?:INSERT|UPDATE|DELETE|REPLACE)\b/i.test(sql)) {
      this.mutationCount += 1;
      if (this.mutationCount === this.failAtMutation) throw new Error(`test_only_allocator_crash_${this.mutationCount}`);
    }
    return this.db.prepare(sql).all(...bindings);
  }

  transactionSync(callback) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = callback();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  one(sql, ...bindings) {
    return this.db.prepare(sql).get(...bindings) || null;
  }

  query(sql, ...bindings) {
    return this.db.prepare(sql).all(...bindings);
  }

  armCrash(relativeMutation) {
    this.failAtMutation = this.mutationCount + relativeMutation;
  }

  disarmCrash() {
    this.failAtMutation = null;
  }

  close() {
    this.db.close();
  }
}

class CloudflareCompatibleSqliteRepository extends NodeSqliteRepository {
  constructor(location = ":memory:") {
    super(location);
    this.maximumTimeQueryCount = 0;
  }

  execute(sql, bindings = []) {
    if (/\bUNION(?:\s+ALL)?\b/iu.test(sql)) {
      throw new Error("cloudflare_compatibility_too_many_terms_in_compound_select");
    }
    if (/SELECT\s+MAX\([^)]*\)\s+AS\s+maximum_record_time/iu.test(sql)) {
      this.maximumTimeQueryCount += 1;
    }
    return super.execute(sql, bindings);
  }
}

function canonicalDatabaseDump(repository) {
  const tables = [
    "coordinator_meta",
    "artifact_registry",
    "canonical_sessions",
    "canonical_session_events",
    "canonical_session_contexts",
    "opportunities",
    "operation_attempts",
    "operation_receipts",
    "lifecycle_events",
    "candidate_manifests",
    "field_session_outcome_links",
    "field_session_evaluation_contexts",
    "field_session_reconciliation_receipts",
    "field_session_reconciliation_conflicts",
    "projection_outbox",
    "projection_artifacts",
    "projection_commits"
  ];
  return stableJson(Object.fromEntries(tables.map(table => [table, repository.query(`SELECT * FROM ${table} ORDER BY rowid`)])));
}

function knownTerritoryContext(suffix = "default") {
  return {
    status: "known",
    territoryId: `riq_territory_${digest(`trusted-territory:${suffix}`)}`,
    sourceRecordSha256: digest(`trusted-territory-source:${suffix}`),
    sourceContractVersion: "route-iq-trusted-territory-context-v1",
    availableAt: iso(-1_000)
  };
}

function scopeClaims(representativeId = "cruz", issuedAt = iso(0), territoryContext = undefined) {
  return {
    purpose: "coordinator_scope",
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    representativeId,
    registryVersion: "fitness-representative-registry-v1",
    issuedAt,
    ...(territoryContext === undefined ? {} : { territoryContext })
  };
}

function createAuthority(secret = "route-iq-allocator-test-only-key") {
  const keyId = `riq_key_${digest(secret)}`;
  function sign(claims, channel = "infrastructure") {
    const signature = createHmac("sha256", secret)
      .update(stableJson({ channel, claims }))
      .digest("hex");
    return { channel, claims: structuredClone(claims), keyId, algorithm: "HMAC-SHA-256", signature };
  }
  return {
    sign,
    verifier: {
      async verify(envelope, { purpose }) {
        const expected = createHmac("sha256", secret)
          .update(stableJson({ channel: envelope.channel, claims: envelope.claims }))
          .digest("hex");
        if (envelope.signature !== expected || envelope.claims?.purpose !== purpose) throw new Error("test_only_signature_invalid");
        return {
          authenticated: true,
          verificationType: envelope.channel === "producer"
            ? "infrastructure_verified_producer_signature"
            : "infrastructure_keyed_attestation",
          keyId,
          algorithm: "HMAC-SHA-256",
          claims: structuredClone(envelope.claims)
        };
      }
    }
  };
}

async function openHarness({
  repository = new NodeSqliteRepository(),
  authority = createAuthority(),
  representativeId = "cruz",
  issuedAt = iso(0),
  territoryContext = undefined
} = {}) {
  initializeRouteIqProspectiveCoordinatorSchema(repository);
  const scope = scopeClaims(representativeId, issuedAt, territoryContext);
  const coordinator = await openRouteIqProspectiveCoordinator({
    repository,
    authorityVerifier: authority.verifier,
    scopeEnvelope: authority.sign(scope)
  });
  return { repository, authority, scope, coordinator };
}

function allocatorEvent(sequence = undefined, observedAt = undefined) {
  return {
    eventKind: "next_stop_requested",
    ...(sequence === undefined ? {} : { informationalSequence: sequence }),
    ...(observedAt === undefined ? {} : { informationalObservedAt: observedAt })
  };
}

function runtimeClaims(harness, purpose, authoritativeRecordTime, extra = {}) {
  return {
    purpose,
    workspaceId: harness.scope.workspaceId,
    operatingProfileId: harness.scope.operatingProfileId,
    representativeId: harness.scope.representativeId,
    authoritativeRecordTime,
    ...extra
  };
}

function exactOutcomeProjectionReadClaims(harness, outcomeReceipt, sourceOutcomeEvidenceSha256, authoritativeRecordTime) {
  return runtimeClaims(harness, "committed_outcome_projection_read", authoritativeRecordTime, {
    sourceOutcomeEvidenceSha256,
    outcomeReceipt: structuredClone(outcomeReceipt)
  });
}

function outcomeSignal(code, conversations = 0, leads = 0) {
  return {
    outcomeCode: code,
    conversations,
    leads,
    appointments: 0,
    units: 0,
    laterUnits: 0,
    scoreableOutcome: null,
    scoreableOutcomeDerivedByData: false
  };
}

function outcomeProjection(harness, {
  rawSha256,
  archiveCommittedAt,
  outcomes,
  sourceArchiveSessionSha256 = digest("canonical-source-field-session"),
  normalizedSha256 = digest("canonical-normalized-field-session")
}) {
  const normalizedOutcomes = outcomes.map((outcome, index) => {
    const canonical = {
      sourceVisitRecordSha256: outcome.sourceVisitRecordSha256 || digest(`source-visit:${index}:${outcome.candidateId}`),
      candidateId: outcome.candidateId,
      candidateIdentityStatus: "derived_from_exact_governed_google_place_identity",
      actionEventTime: outcome.actionEventTime,
      eventTimeAuthority: "dashboard_recorded_visit_time_in_committed_handoff",
      authoritativeRecordTime: archiveCommittedAt,
      outcomeEvidence: {
        status: "verified_unscored_signals",
        originalOutcomeSignal: outcome.originalOutcomeSignal || outcomeSignal("conversation", 1, 0),
        finalOutcomeSignal: outcome.finalOutcomeSignal || outcomeSignal("lead", 1, 1),
        corrections: outcome.corrections || [],
        correctionState: outcome.corrections?.length ? "corrected" : "uncorrected",
        conflictState: "none",
        scoreableOutcome: null,
        scoreableOutcomeDerivedByData: false
      },
      decisionSource: {
        sourceId: "unknown",
        confidence: 0,
        capturedAt: outcome.actionEventTime,
        temporalClassification: "post_action_supporting_information",
        preActionEvidence: false,
        sameShadowDecisionInput: false,
        scoreableOutcome: false
      },
      recommendationDecisionContext: null
    };
    return { ...canonical, evidenceSha256: digest(canonical) };
  });
  const body = {
    schemaVersion: "route-iq-field-session-outcome-projection-v1",
    authority: "prometheus_data_committed_field_session",
    recordOrigin: "prospective",
    scope: {
      workspaceId: harness.scope.workspaceId,
      operatingProfileId: harness.scope.operatingProfileId,
      representativeId: harness.scope.representativeId
    },
    sourceArchive: {
      handoffContractId: "route-iq-end-of-day-data-handoff-v1",
      sourceArchiveSessionSha256,
      rawSha256,
      normalizedSha256,
      archiveCommittedAt
    },
    outcomes: normalizedOutcomes,
    privacy: {
      namesIncluded: false,
      addressesIncluded: false,
      contactsIncluded: false,
      notesIncluded: false,
      preciseLocationIncluded: false
    },
    recommendationInfluence: "off",
    scoreableOutcomeDerivedByData: false
  };
  return { ...body, projectionSha256: digest(body) };
}

function identityFromReceipt(receipt) {
  return {
    territoryId: receipt.canonicalContext.territoryId,
    canonicalSessionRecordSha256: receipt.canonicalContext.canonicalSessionRecordSha256,
    sessionEventSequence: receipt.canonicalContext.sessionEventSequence,
    opportunityEventSequence: receipt.canonicalContext.opportunityEventSequence,
    triggerRecordSha256: receipt.canonicalContext.triggerRecordSha256
  };
}

function operationClaimsForIdentity(harness, identity, purpose, recordTime, clientEventSequence, extra = {}) {
  return {
    purpose,
    workspaceId: harness.scope.workspaceId,
    operatingProfileId: harness.scope.operatingProfileId,
    representativeId: harness.scope.representativeId,
    ...identity,
    canonicalEventBoundarySha256: digest(`${purpose}:${recordTime}:${clientEventSequence}`),
    clientEventSequence,
    clientContentSha256: digest(`${purpose}:content:${clientEventSequence}`),
    authoritativeRecordTime: recordTime,
    recordOrigin: "prospective",
    uncertainChronology: false,
    ...extra
  };
}

function operationClaims(harness, receipt, purpose, recordTime, clientEventSequence, extra = {}) {
  return operationClaimsForIdentity(
    harness,
    identityFromReceipt(receipt),
    purpose,
    recordTime,
    clientEventSequence,
    extra
  );
}

function receiptViewForIdentity(identity, canonicalEventBoundarySha256) {
  return {
    canonicalContext: {
      ...identity,
      canonicalEventBoundarySha256
    }
  };
}

function candidateManifest(harness, receipt, suffix, evidenceCutoff = iso(3_000)) {
  const identity = identityFromReceipt(receipt);
  const sourceId = `riq_source_${digest(`source:${suffix}`)}`;
  const candidateId = `riq_candidate_${digest(`candidate:${suffix}`)}`;
  const sourceManifest = [{
    sourceRecordId: sourceId,
    sourceSchemaVersion: routeIqCandidateSourceSchemaVersion,
    sourceVersion: routeIqCandidateSourceVersion,
    sourceRecordSha256: digest(`source-record:${suffix}`),
    availableAt: iso(1_000)
  }];
  const candidates = [{
    candidateId,
    sourceRecordIds: [sourceId],
    eligibility: {
      status: "eligible",
      reasonCodes: ["territory_permitted"],
      evaluatedAt: iso(2_000)
    },
    rankingContext: {
      producerSubsystem: "Prometheus Intelligence Engine",
      ordinal: 1,
      probability: 0.6,
      basisVersion: "route-iq-ranking-basis-v1"
    }
  }];
  const digestInput = {
    territoryId: identity.territoryId,
    evidenceCutoff,
    envelopeVersion: routeIqCandidateProducerEnvelopeVersion,
    producerSubsystem: "Prometheus Intelligence Engine",
    producerContractVersion: routeIqCandidateProducerContractVersion,
    schemaVersion: routeIqCandidateManifestSchemaVersion,
    dataProjectionVersion: "route-iq-chronological-evidence-projection-v1",
    candidates,
    sourceManifest
  };
  const hashes = computeRouteIqCandidateManifestDigests(digestInput);
  return {
    candidateId,
    hashes,
    claims: {
      purpose: "candidate_manifest",
      workspaceId: harness.scope.workspaceId,
      operatingProfileId: harness.scope.operatingProfileId,
      representativeId: harness.scope.representativeId,
      ...identity,
      ...digestInput,
      candidateCount: hashes.candidateCount,
      sourceCount: hashes.sourceCount,
      candidateManifestSha256: hashes.candidateManifestSha256,
      sourceManifestSha256: hashes.sourceManifestSha256,
      completeManifestSha256: hashes.completeManifestSha256
    }
  };
}

async function acceptManifest(harness, receipt, suffix, recordTime, clientSequence) {
  const manifest = candidateManifest(harness, receipt, suffix);
  const claims = operationClaims(harness, receipt, "candidate_manifest", recordTime, clientSequence, {
    expectedCandidateCount: manifest.hashes.candidateCount,
    expectedSourceCount: manifest.hashes.sourceCount,
    expectedCompleteManifestSha256: manifest.hashes.completeManifestSha256
  });
  const accepted = await harness.coordinator.acceptCandidateManifest({
    authorityEnvelope: harness.authority.sign(claims),
    producerEnvelope: harness.authority.sign(manifest.claims, "producer")
  });
  return { manifest, claims, receipt: accepted };
}

async function sealSnapshot(harness, allocation, accepted, recordTime, clientSequence) {
  const claims = operationClaims(harness, allocation, "snapshot_seal_record", recordTime, clientSequence);
  const sealClaims = {
    purpose: "snapshot_seal",
    workspaceId: harness.scope.workspaceId,
    operatingProfileId: harness.scope.operatingProfileId,
    representativeId: harness.scope.representativeId,
    sealId: `riq_seal_${digest(`snapshot:${allocation.opportunityId}`)}`,
    canonicalEventBoundarySha256: claims.canonicalEventBoundarySha256,
    sealedArtifactId: accepted.receipt.artifactId,
    sealedRecordSha256: accepted.receipt.recordSha256,
    candidateManifestSha256: accepted.manifest.hashes.candidateManifestSha256,
    sealedAt: recordTime
  };
  return harness.coordinator.sealSnapshot({
    authorityEnvelope: harness.authority.sign(claims),
    sealEnvelope: harness.authority.sign(sealClaims)
  });
}

async function sealShadowDecision(harness, allocation, accepted, snapshotSeal, recordTime, clientSequence) {
  const shadowDecisionRecordSha256 = digest(`shadow:${allocation.opportunityId}`);
  const claims = operationClaims(harness, allocation, "shadow_decision_seal_record", recordTime, clientSequence, {
    shadowDecisionRecordSha256
  });
  const sealClaims = {
    purpose: "shadow_decision_seal",
    workspaceId: harness.scope.workspaceId,
    operatingProfileId: harness.scope.operatingProfileId,
    representativeId: harness.scope.representativeId,
    sealId: `riq_seal_${digest(`shadow-seal:${allocation.opportunityId}`)}`,
    canonicalEventBoundarySha256: claims.canonicalEventBoundarySha256,
    sealedArtifactId: snapshotSeal.artifactId,
    sealedRecordSha256: snapshotSeal.recordSha256,
    candidateManifestSha256: accepted.manifest.hashes.candidateManifestSha256,
    shadowDecisionRecordSha256,
    sealedAt: recordTime
  };
  return harness.coordinator.sealShadowDecision({
    authorityEnvelope: harness.authority.sign(claims),
    sealEnvelope: harness.authority.sign(sealClaims)
  });
}

async function completeServerDerivedAction(harness, allocation, suffix, {
  manifestAt,
  snapshotAt,
  shadowAt,
  actionAt,
  sequence
}) {
  const accepted = await acceptManifest(harness, allocation, suffix, manifestAt, sequence);
  const snapshot = await sealSnapshot(harness, allocation, accepted, snapshotAt, sequence + 1);
  await sealShadowDecision(harness, allocation, accepted, snapshot, shadowAt, sequence + 2);
  const context = await harness.coordinator.readCanonicalRuntimeContext({
    authorityEnvelope: harness.authority.sign(runtimeClaims(harness, "runtime_context_read", shadowAt))
  });
  const actionClaims = runtimeClaims(harness, "server_action_signal", actionAt, {
    runtimeContextReceiptSha256: context.runtimeContextReceiptSha256,
    eventKind: "representative_action_observed"
  });
  const action = await harness.coordinator.linkServerDerivedNextStopAction({
    authorityEnvelope: harness.authority.sign(actionClaims)
  });
  return { accepted, snapshot, context, actionClaims, action };
}

function drainProjectionOutbox(harness) {
  while (harness.coordinator.recoverNextProjection().recovered) {
    // Projection commit markers are deliberately written last by the coordinator.
  }
}

function buildFullEvaluationRecord(harness, reconciliationReceipt, link, outcomeReceipt) {
  const context = link.evaluationContext;
  const projection = harness.repository.one(`
    SELECT p.projection_id, p.projection_sha256, p.as_of_record_sequence, p.as_of_record_time,
           c.commit_id
    FROM projection_outbox o
    JOIN projection_artifacts p ON p.outbox_id = o.outbox_id
    JOIN projection_commits c ON c.outbox_id = o.outbox_id AND c.projection_id = p.projection_id
    WHERE o.source_artifact_id = ?
  `, outcomeReceipt.artifactId);
  const sourceLink = harness.repository.one(
    "SELECT * FROM field_session_outcome_links WHERE evidence_sha256 = ?",
    link.evidenceSha256
  );
  const observedOutcome = { status: "observed", value: true };
  const body = {
    schemaVersion: routeIqIntelligenceEvaluationRecordSchemaVersion,
    evaluationContractVersion: routeIqIntelligenceEvaluationContractVersion,
    authority: "prometheus_intelligence_pure_evaluation",
    recordOrigin: "prospective",
    scope: {
      workspaceId: harness.scope.workspaceId,
      operatingProfileId: harness.scope.operatingProfileId,
      representativeId: harness.scope.representativeId
    },
    opportunityId: context.opportunityId,
    evaluationContextSha256: link.evaluationContextSha256,
    sourceProjection: {
      projectionId: projection.projection_id,
      projectionCommitId: projection.commit_id,
      projectionSha256: projection.projection_sha256,
      asOfRecordSequence: Number(projection.as_of_record_sequence),
      asOfRecordTime: projection.as_of_record_time
    },
    shadowContext: {
      sealArtifactId: context.shadowDecision.sealArtifactId,
      sealEventRecordSha256: context.shadowDecision.sealRecordSha256,
      sealedAt: context.shadowDecision.sealedAt
    },
    acceptedCandidate: {
      candidateId: context.candidate.candidateId,
      rank: context.candidate.acceptedRank,
      probability: context.candidate.probability,
      rankingBasisVersion: context.candidate.rankingBasisVersion,
      candidateManifestSha256: context.manifest.candidateManifestSha256,
      completeManifestSha256: context.manifest.completeManifestSha256
    },
    action: {
      candidateId: context.action.selectedCandidateId,
      actionArtifactId: context.action.artifactId,
      actionRecordSha256: context.action.recordSha256,
      linkedAt: context.action.linkedAt,
      selectionAuthority: "accepted_manifest_unique_ordinal_1"
    },
    scoreableOutcome: {
      outcomeArtifactId: outcomeReceipt.artifactId,
      outcomeRecordSha256: outcomeReceipt.recordSha256,
      sourceOutcomeEvidenceSha256: link.evidenceSha256,
      scoreableOutcomeRecordSha256: digest(`scoreable:${link.evidenceSha256}`),
      outcomeDerivationContractVersion: "route-iq-shadow-outcome-derivation-v1",
      observedOutcome,
      admittedAt: outcomeReceipt.authoritativeRecordTime
    },
    chronology: {
      snapshotAcceptedAt: context.acceptedSnapshotManifest.acceptedAt,
      shadowSealedAt: context.shadowDecision.sealedAt,
      actionLinkedAt: context.action.linkedAt,
      visitActionEventTime: sourceLink.visit_event_time,
      archiveCommittedAt: sourceLink.archive_committed_at,
      fieldEvidenceLinkedAt: sourceLink.linked_at,
      reconciledAt: reconciliationReceipt.createdAt,
      outcomeAdmittedAt: outcomeReceipt.authoritativeRecordTime
    },
    readinessObservation: {
      actualDecisionId: context.action.selectedCandidateId,
      evaluatedDecisionId: context.candidate.candidateId,
      selectedCandidateProbability: context.candidate.probability,
      selectedCandidateRank: context.candidate.acceptedRank,
      observedOutcome: { ...observedOutcome, evaluatedDecisionId: context.candidate.candidateId },
      scoreableSelectedCandidateOutcome: true,
      readinessCountEligible: true
    },
    boundaries: {
      decisionSourceUsed: false,
      futureEvidenceUsed: false,
      observationalOnly: true,
      causalClaimAllowed: false,
      upliftClaimAllowed: false,
      recommendationInfluenceAllowed: false
    },
    canonicalProductionEvidenceEligible: true,
    recommendationInfluence: "OFF",
    immutable: true
  };
  return { ...body, evaluationRecordSha256: digest(body) };
}

async function prepareReconciledEvaluationSource(suffix, { corrections = [] } = {}) {
  const h = await openHarness({ territoryContext: knownTerritoryContext(`evaluation-${suffix}`) });
  const allocation = await h.coordinator.allocateNextStopOpportunity({ event: allocatorEvent(1) });
  const lifecycle = await completeServerDerivedAction(h, allocation, `evaluation-${suffix}`, {
    manifestAt: iso(10_000),
    snapshotAt: iso(20_000),
    shadowAt: iso(30_000),
    actionAt: iso(40_000),
    sequence: 10
  });
  const rawSha256 = digest(`evaluation-handoff:${suffix}`);
  await h.coordinator.closeCanonicalSession({
    authorityEnvelope: h.authority.sign({
      purpose: "close_session",
      workspaceId: h.scope.workspaceId,
      operatingProfileId: h.scope.operatingProfileId,
      representativeId: h.scope.representativeId,
      closeReason: "end_day",
      handoffContractVersion: "route-iq-end-of-day-data-handoff-v1",
      endOfDayHandoffSha256: rawSha256,
      authoritativeRecordTime: iso(50_000)
    })
  });
  const projection = outcomeProjection(h, {
    rawSha256,
    archiveCommittedAt: iso(60_000),
    outcomes: [{
      candidateId: lifecycle.accepted.manifest.candidateId,
      actionEventTime: iso(45_000),
      corrections
    }]
  });
  const receipt = await h.coordinator.reconcileCommittedFieldSessionOutcomes({
    authorityEnvelope: h.authority.sign(runtimeClaims(h, "field_session_reconciliation", iso(70_000), {
      projectionSha256: projection.projectionSha256,
      sourceArchiveRawSha256: projection.sourceArchive.rawSha256,
      sourceArchiveSessionSha256: projection.sourceArchive.sourceArchiveSessionSha256
    })),
    projection
  });
  return { h, allocation, lifecycle, projection, receipt, link: receipt.linked[0] };
}

async function admitPreparedScoreable(source) {
  const outcomeReceipt = await source.h.coordinator.admitIntelligenceScoreableOutcome({
    authorityEnvelope: source.h.authority.sign(runtimeClaims(source.h, "scoreable_outcome_admission", iso(80_000), {
      sourceOutcomeEvidenceSha256: source.link.evidenceSha256,
      evaluationContextSha256: source.link.evaluationContextSha256,
      outcomeDerivationContractVersion: "route-iq-shadow-outcome-derivation-v1",
      observedOutcome: { status: "observed", value: true }
    }), "producer")
  });
  drainProjectionOutbox(source.h);
  return {
    ...source,
    outcomeReceipt,
    evaluationRecord: buildFullEvaluationRecord(source.h, source.receipt, source.link, outcomeReceipt)
  };
}

async function prepareTwoAdmittedOutcomeSources(h, suffix) {
  const first = await h.coordinator.allocateNextStopOpportunity({ event: allocatorEvent(1) });
  const firstLifecycle = await completeServerDerivedAction(h, first, `${suffix}-first`, {
    manifestAt: iso(10_000), snapshotAt: iso(20_000), shadowAt: iso(30_000), actionAt: iso(40_000), sequence: 10
  });
  const second = await h.coordinator.allocateNextStopOpportunity({ event: allocatorEvent(2) });
  const secondLifecycle = await completeServerDerivedAction(h, second, `${suffix}-second`, {
    manifestAt: iso(50_000), snapshotAt: iso(60_000), shadowAt: iso(70_000), actionAt: iso(80_000), sequence: 20
  });
  const rawSha256 = digest(`${suffix}-handoff`);
  await h.coordinator.closeCanonicalSession({
    authorityEnvelope: h.authority.sign({
      purpose: "close_session",
      workspaceId: h.scope.workspaceId,
      operatingProfileId: h.scope.operatingProfileId,
      representativeId: h.scope.representativeId,
      closeReason: "end_day",
      handoffContractVersion: "route-iq-end-of-day-data-handoff-v1",
      endOfDayHandoffSha256: rawSha256,
      authoritativeRecordTime: iso(90_000)
    })
  });
  const projection = outcomeProjection(h, {
    rawSha256,
    archiveCommittedAt: iso(100_000),
    outcomes: [
      { candidateId: firstLifecycle.accepted.manifest.candidateId, actionEventTime: iso(45_000) },
      { candidateId: secondLifecycle.accepted.manifest.candidateId, actionEventTime: iso(85_000) }
    ]
  });
  const reconciliationReceipt = await h.coordinator.reconcileCommittedFieldSessionOutcomes({
    authorityEnvelope: h.authority.sign(runtimeClaims(h, "field_session_reconciliation", iso(110_000), {
      projectionSha256: projection.projectionSha256,
      sourceArchiveRawSha256: projection.sourceArchive.rawSha256,
      sourceArchiveSessionSha256: projection.sourceArchive.sourceArchiveSessionSha256
    })),
    projection
  });
  const outcomeReceipts = [];
  for (const [index, link] of reconciliationReceipt.linked.entries()) {
    outcomeReceipts.push(await h.coordinator.admitIntelligenceScoreableOutcome({
      authorityEnvelope: h.authority.sign(runtimeClaims(h, "scoreable_outcome_admission", iso(130_000 + index * 10_000), {
        sourceOutcomeEvidenceSha256: link.evidenceSha256,
        evaluationContextSha256: link.evaluationContextSha256,
        outcomeDerivationContractVersion: "route-iq-shadow-outcome-derivation-v1",
        observedOutcome: { status: "observed", value: index === 0 }
      }), "producer")
    }));
  }
  return {
    allocations: [first, second],
    lifecycles: [firstLifecycle, secondLifecycle],
    projection,
    reconciliationReceipt,
    outcomeReceipts
  };
}

function evaluationAdmissionClaims(source, record, authoritativeRecordTime = iso(90_000)) {
  return runtimeClaims(source.h, "evaluation_admission", authoritativeRecordTime, {
    sourceOutcomeEvidenceSha256: source.link.evidenceSha256,
    evaluationContextSha256: source.link.evaluationContextSha256,
    evaluationRecordSha256: record.evaluationRecordSha256,
    evaluationContractVersion: routeIqIntelligenceEvaluationContractVersion,
    evaluationRecord: record
  });
}

function rehashEvaluationRecord(record) {
  const body = Object.fromEntries(Object.entries(record).filter(([key]) => key !== "evaluationRecordSha256"));
  return { ...body, evaluationRecordSha256: digest(body) };
}

test("server allocator contract and pending candidate boundary are explicit", async () => {
  assert.equal(routeIqProspectiveServerAllocatorContractVersion, "route-iq-prospective-server-allocator-v1");
  const h = await openHarness();
  const receipt = await h.coordinator.allocateNextStopOpportunity({ event: allocatorEvent(1, iso(0)) });
  assert.equal(receipt.serverDerivedCanonicalIdentity, true);
  assert.equal(receipt.candidateCompletenessStatus, "pending_authenticated_intelligence_manifest");
  assert.equal(receipt.snapshotAccepted, false);
  assert.match(receipt.sessionId, /^riq_session_[a-f0-9]{64}$/);
  assert.match(receipt.opportunityId, /^riq_opportunity_[a-f0-9]{64}$/);
  assert.equal(h.repository.one("SELECT COUNT(*) AS count FROM candidate_manifests").count, 0);
});

test("allocator adopts one retained trigger session without creating a second session or opportunity", async () => {
  const territoryContext = knownTerritoryContext("retained-trigger");
  const h = await openHarness({ territoryContext });
  const identity = {
    territoryId: territoryContext.territoryId,
    canonicalSessionRecordSha256: digest("retained-trigger-session-record"),
    sessionEventSequence: 0,
    opportunityEventSequence: 0,
    triggerRecordSha256: digest("retained-trigger-record")
  };
  const triggerClaims = operationClaimsForIdentity(h, identity, "trigger", iso(10_000), 1);
  const triggerReceipt = await h.coordinator.trigger({
    authorityEnvelope: h.authority.sign(triggerClaims)
  });

  const adopted = await h.coordinator.allocateNextStopOpportunity({ event: allocatorEvent(999, iso(90_000)) });
  const retry = await h.coordinator.allocateNextStopOpportunity({ event: allocatorEvent(1000, iso(120_000)) });
  assert.equal(adopted.sessionId, triggerReceipt.sessionId);
  assert.equal(adopted.opportunityId, triggerReceipt.opportunityId);
  assert.equal(adopted.operationKind, "server_allocate_next_stop");
  assert.equal(adopted.allocatorContractVersion, routeIqProspectiveServerAllocatorContractVersion);
  assert.equal(adopted.status, "adopted");
  assert.equal(adopted.legacyTriggerAdoptedWithoutRewrite, true);
  assert.equal(adopted.serverDerivedCanonicalIdentity, true);
  assert.equal(adopted.candidateCompletenessStatus, "pending_authenticated_intelligence_manifest");
  assert.equal(adopted.snapshotAccepted, false);
  assert.equal(adopted.canonicalContext.territoryId, identity.territoryId);
  assert.equal(adopted.canonicalContext.canonicalSessionRecordSha256, identity.canonicalSessionRecordSha256);
  assert.equal(adopted.canonicalContext.sessionEventSequence, identity.sessionEventSequence);
  assert.equal(adopted.canonicalContext.opportunityEventSequence, identity.opportunityEventSequence);
  assert.equal(adopted.canonicalContext.triggerRecordSha256, identity.triggerRecordSha256);
  assert.deepEqual(retry, adopted);
  assert.equal(h.repository.one("SELECT COUNT(*) AS count FROM canonical_sessions").count, 1);
  assert.equal(h.repository.one("SELECT COUNT(*) AS count FROM opportunities").count, 1);
  assert.equal(h.repository.one("SELECT COUNT(*) AS count FROM canonical_session_events").count, 0);
  assert.equal(h.repository.one("SELECT COUNT(*) AS count FROM operation_receipts WHERE operation_kind = 'trigger'").count, 1);
  assert.equal(h.repository.one("SELECT COUNT(*) AS count FROM operation_receipts WHERE operation_kind = 'server_allocate_next_stop'").count, 1);
});

test("concurrent requests, retries, and rotating informational metadata converge on one allocation", async () => {
  const h = await openHarness();
  const receipts = await Promise.all([
    h.coordinator.allocateNextStopOpportunity({ event: allocatorEvent(1, iso(0)) }),
    h.coordinator.allocateNextStopOpportunity({ event: allocatorEvent(999, iso(90_000)) }),
    h.coordinator.allocateNextStopOpportunity({ event: allocatorEvent() })
  ]);
  assert.ok(receipts.every(receipt => stableJson(receipt) === stableJson(receipts[0])));
  assert.equal(h.repository.one("SELECT COUNT(*) AS count FROM canonical_sessions").count, 1);
  assert.equal(h.repository.one("SELECT COUNT(*) AS count FROM opportunities").count, 1);
  assert.equal(h.repository.one("SELECT COUNT(*) AS count FROM operation_receipts WHERE operation_kind = 'server_allocate_next_stop'").count, 1);
});

test("separate SQLite adapter restart returns the original canonical receipt", async t => {
  const directory = mkdtempSync(join(tmpdir(), "route-iq-allocator-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const location = join(directory, "coordinator.sqlite");
  const authority = createAuthority("restart-key");
  const firstRepository = new NodeSqliteRepository(location);
  const first = await openHarness({ repository: firstRepository, authority });
  const receipt = await first.coordinator.allocateNextStopOpportunity({ event: allocatorEvent(2, iso(0)) });
  firstRepository.close();

  const secondRepository = new NodeSqliteRepository(location);
  const second = await openHarness({ repository: secondRepository, authority, issuedAt: iso(60_000) });
  const retry = await second.coordinator.allocateNextStopOpportunity({ event: allocatorEvent(500, iso(120_000)) });
  assert.deepEqual(retry, receipt);
  assert.equal(secondRepository.one("SELECT COUNT(*) AS count FROM opportunities").count, 1);
  secondRepository.close();
});

test("action before seal excludes permanently and a late browser retry cannot rehabilitate it", async () => {
  const h = await openHarness();
  const allocation = await h.coordinator.allocateNextStopOpportunity({ event: allocatorEvent(1) });
  const actionClaims = operationClaims(h, allocation, "action", iso(10_000), 7, {
    selectedCandidateId: `riq_candidate_${digest("premature-action")}`,
    decisionSource: null
  });
  const action = await h.coordinator.linkAction({ authorityEnvelope: h.authority.sign(actionClaims) });
  assert.equal(action.status, "excluded");
  assert.deepEqual(action.reasonCodes, ["invalid_state_transition"]);
  const retry = await h.coordinator.allocateNextStopOpportunity({ event: allocatorEvent(888, iso(120_000)) });
  assert.equal(retry.opportunityId, allocation.opportunityId);
  assert.equal(h.repository.one("SELECT COUNT(*) AS count FROM opportunities").count, 1);
  assert.equal(h.repository.one("SELECT state FROM opportunities").state, "EXCLUDED");
});

test("only an authenticated material manifest change rotates to a new pending opportunity", async () => {
  const h = await openHarness({ territoryContext: knownTerritoryContext("material-change") });
  const first = await h.coordinator.allocateNextStopOpportunity({ event: allocatorEvent(1) });
  const accepted = await acceptManifest(h, first, "manifest-a", iso(10_000), 10);
  assert.equal(accepted.receipt.state, "SNAPSHOT_PENDING_SEAL");
  const repeated = await acceptManifest(h, first, "manifest-a", iso(20_000), 11);
  assert.deepEqual(repeated.receipt, accepted.receipt);

  const changed = await acceptManifest(h, first, "manifest-b", iso(30_000), 12);
  assert.equal(changed.receipt.status, "excluded");
  assert.deepEqual(changed.receipt.reasonCodes, ["candidate_manifest_materially_changed"]);
  assert.equal(h.repository.one("SELECT COUNT(*) AS count FROM candidate_manifests").count, 1);

  const second = await h.coordinator.allocateNextStopOpportunity({ event: allocatorEvent(99, iso(40_000)) });
  assert.notEqual(second.opportunityId, first.opportunityId);
  assert.equal(second.sessionId, first.sessionId);
  assert.equal(second.canonicalContext.opportunityEventSequence, 1);
  assert.equal(h.repository.one("SELECT COUNT(*) AS count FROM candidate_manifests").count, 1);
  assert.equal(h.repository.one("SELECT state FROM opportunities WHERE opportunity_id = ?", first.opportunityId).state, "EXCLUDED");
});

test("malformed or incomplete producer evidence remains sticky and cannot rotate by retry", async () => {
  const h = await openHarness({ territoryContext: knownTerritoryContext("malformed") });
  const allocation = await h.coordinator.allocateNextStopOpportunity({ event: allocatorEvent(1) });
  const manifest = candidateManifest(h, allocation, "malformed");
  manifest.claims.candidateCount += 1;
  const claims = operationClaims(h, allocation, "candidate_manifest", iso(10_000), 10, {
    expectedCandidateCount: manifest.hashes.candidateCount,
    expectedSourceCount: manifest.hashes.sourceCount,
    expectedCompleteManifestSha256: manifest.hashes.completeManifestSha256
  });
  const excluded = await h.coordinator.acceptCandidateManifest({
    authorityEnvelope: h.authority.sign(claims),
    producerEnvelope: h.authority.sign(manifest.claims, "producer")
  });
  assert.equal(excluded.status, "excluded");
  assert.deepEqual(excluded.reasonCodes, ["candidate_manifest_incomplete_or_tampered"]);
  const retry = await h.coordinator.allocateNextStopOpportunity({ event: allocatorEvent(999, iso(120_000)) });
  assert.equal(retry.opportunityId, allocation.opportunityId);
  assert.equal(h.repository.one("SELECT COUNT(*) AS count FROM opportunities").count, 1);
  assert.equal(h.repository.one("SELECT COUNT(*) AS count FROM candidate_manifests").count, 0);
});

test("only ACTION_LINKED or later permits another next_stop opportunity in the open session", async () => {
  const h = await openHarness({ territoryContext: knownTerritoryContext("linked-action") });
  const first = await h.coordinator.allocateNextStopOpportunity({ event: allocatorEvent(1) });
  const accepted = await acceptManifest(h, first, "linked-action", iso(10_000), 10);
  const snapshotSeal = await sealSnapshot(h, first, accepted, iso(20_000), 11);
  await sealShadowDecision(h, first, accepted, snapshotSeal, iso(30_000), 12);
  const actionClaims = operationClaims(h, first, "action", iso(40_000), 13, {
    selectedCandidateId: accepted.manifest.candidateId,
    decisionSource: null
  });
  const action = await h.coordinator.linkAction({ authorityEnvelope: h.authority.sign(actionClaims) });
  assert.equal(action.state, "ACTION_LINKED");

  const second = await h.coordinator.allocateNextStopOpportunity({ event: allocatorEvent(2, iso(50_000)) });
  assert.notEqual(second.opportunityId, first.opportunityId);
  assert.equal(second.sessionId, first.sessionId);
  assert.equal(second.canonicalContext.opportunityEventSequence, 1);
  assert.equal(second.snapshotAccepted, false);
});

test("allocator time advances beyond the maximum canonical time across opportunities", async () => {
  const repository = new CloudflareCompatibleSqliteRepository();
  const h = await openHarness({
    repository,
    territoryContext: knownTerritoryContext("global-time")
  });
  const first = await h.coordinator.allocateNextStopOpportunity({ event: allocatorEvent(1) });
  const firstManifest = await acceptManifest(h, first, "global-time-first", iso(10_000), 10);
  const firstSnapshotSeal = await sealSnapshot(h, first, firstManifest, iso(20_000), 11);
  await sealShadowDecision(h, first, firstManifest, firstSnapshotSeal, iso(30_000), 12);
  const futureRecordTime = iso(3_600_000);
  const firstActionClaims = operationClaims(h, first, "action", futureRecordTime, 13, {
    selectedCandidateId: firstManifest.manifest.candidateId,
    decisionSource: null
  });
  await h.coordinator.linkAction({ authorityEnvelope: h.authority.sign(firstActionClaims) });

  const legacyIdentity = {
    territoryId: first.canonicalContext.territoryId,
    canonicalSessionRecordSha256: first.canonicalContext.canonicalSessionRecordSha256,
    sessionEventSequence: first.canonicalContext.sessionEventSequence,
    opportunityEventSequence: 1,
    triggerRecordSha256: digest("global-time-later-sequence-trigger")
  };
  const legacyTriggerClaims = operationClaimsForIdentity(h, legacyIdentity, "trigger", iso(40_000), 20);
  await h.coordinator.trigger({ authorityEnvelope: h.authority.sign(legacyTriggerClaims) });
  const legacyReceiptView = receiptViewForIdentity(
    legacyIdentity,
    legacyTriggerClaims.canonicalEventBoundarySha256
  );
  const legacyManifest = await acceptManifest(h, legacyReceiptView, "global-time-second", iso(50_000), 21);
  const legacySnapshotSeal = await sealSnapshot(h, legacyReceiptView, legacyManifest, iso(60_000), 22);
  await sealShadowDecision(h, legacyReceiptView, legacyManifest, legacySnapshotSeal, iso(70_000), 23);
  const legacyActionClaims = operationClaims(h, legacyReceiptView, "action", iso(80_000), 24, {
    selectedCandidateId: legacyManifest.manifest.candidateId,
    decisionSource: null
  });
  await h.coordinator.linkAction({ authorityEnvelope: h.authority.sign(legacyActionClaims) });

  const latestBySequence = h.repository.one(`
    SELECT authoritative_record_time FROM lifecycle_events
    ORDER BY record_sequence DESC LIMIT 1
  `).authoritative_record_time;
  assert.equal(latestBySequence, iso(80_000));
  assert.equal(h.repository.one("SELECT MAX(authoritative_record_time) AS maximum FROM lifecycle_events").maximum, futureRecordTime);

  const third = await h.coordinator.allocateNextStopOpportunity({ event: allocatorEvent(3, iso(90_000)) });
  assert.ok(Date.parse(third.authoritativeRecordTime) > Date.parse(futureRecordTime));
  assert.equal(third.canonicalContext.opportunityEventSequence, 2);
  assert.ok(repository.maximumTimeQueryCount >= 30);
});

test("unknown territory remains governed and cannot admit a selectable snapshot", async () => {
  const h = await openHarness();
  const allocation = await h.coordinator.allocateNextStopOpportunity({ event: allocatorEvent(1) });
  const manifest = await acceptManifest(h, allocation, "unknown-territory", iso(10_000), 10);
  assert.equal(manifest.receipt.status, "excluded");
  assert.deepEqual(manifest.receipt.reasonCodes, ["territory_context_unavailable"]);
  assert.equal(h.repository.one("SELECT COUNT(*) AS count FROM candidate_manifests").count, 0);
  const retry = await h.coordinator.allocateNextStopOpportunity({ event: allocatorEvent(2) });
  assert.equal(retry.opportunityId, allocation.opportunityId);
});

test("trusted session close is idempotent and the next signal opens a new isolated session", async () => {
  const authority = createAuthority("session-close-key");
  const h = await openHarness({ authority });
  const first = await h.coordinator.allocateNextStopOpportunity({ event: allocatorEvent(1) });
  const closeClaims = {
    purpose: "close_session",
    workspaceId: h.scope.workspaceId,
    operatingProfileId: h.scope.operatingProfileId,
    representativeId: h.scope.representativeId,
    closeReason: "end_route",
    handoffContractVersion: "route-iq-end-of-day-data-handoff-v1",
    endOfDayHandoffSha256: digest("trusted-end-route-record"),
    authoritativeRecordTime: iso(20_000)
  };
  const closed = await h.coordinator.closeCanonicalSession({ authorityEnvelope: authority.sign(closeClaims) });
  const retry = await h.coordinator.closeCanonicalSession({
    authorityEnvelope: authority.sign({ ...closeClaims, authoritativeRecordTime: iso(40_000) })
  });
  assert.deepEqual(retry, closed);

  const reopened = await openHarness({ repository: h.repository, authority, issuedAt: iso(60_000) });
  const second = await reopened.coordinator.allocateNextStopOpportunity({ event: allocatorEvent(2) });
  assert.notEqual(second.sessionId, first.sessionId);
  assert.notEqual(second.opportunityId, first.opportunityId);
  assert.equal(h.repository.one("SELECT COUNT(*) AS count FROM canonical_sessions").count, 2);
});

test("scope isolation and strict caller authority rejection preserve non-PII identities", async () => {
  const cruz = await openHarness({ authority: createAuthority("cruz-key"), representativeId: "cruz" });
  const anthony = await openHarness({ authority: createAuthority("anthony-key"), representativeId: "anthony" });
  const cruzReceipt = await cruz.coordinator.allocateNextStopOpportunity({ event: allocatorEvent(1) });
  const anthonyReceipt = await anthony.coordinator.allocateNextStopOpportunity({ event: allocatorEvent(1) });
  assert.notEqual(cruzReceipt.sessionId, anthonyReceipt.sessionId);
  assert.notEqual(cruzReceipt.opportunityId, anthonyReceipt.opportunityId);
  await assert.rejects(
    () => cruz.coordinator.allocateNextStopOpportunity({
      event: { ...allocatorEvent(2), sessionId: "caller-session" }
    }),
    error => error.code === "route_iq_coordinator_field_not_allowlisted"
  );
  await assert.rejects(
    () => cruz.coordinator.allocateNextStopOpportunity({
      event: { ...allocatorEvent(2), address: "123 Main Street" }
    }),
    error => error.code === "route_iq_coordinator_field_not_allowlisted"
  );
  await assert.rejects(
    () => cruz.coordinator.allocateNextStopOpportunity({
      event: { eventKind: "representative_action_observed" }
    }),
    error => error.code === "route_iq_server_allocator_event_not_supported"
  );
});

test("allocation chronology and committed as-of projections exclude future governance", async () => {
  const h = await openHarness();
  const allocation = await h.coordinator.allocateNextStopOpportunity({ event: allocatorEvent(1, iso(0)) });
  const initialSequence = allocation.recordSequence;
  const initialTime = allocation.authoritativeRecordTime;
  while (h.coordinator.recoverNextProjection().recovered) {
    // Drain deterministic commit-marker-last projections.
  }
  const actionClaims = operationClaims(h, allocation, "action", iso(20_000), 5, {
    selectedCandidateId: `riq_candidate_${digest("chronology-action")}`,
    decisionSource: null
  });
  await h.coordinator.linkAction({ authorityEnvelope: h.authority.sign(actionClaims) });
  while (h.coordinator.recoverNextProjection().recovered) {
    // Drain the later exclusion projection independently.
  }
  const projectionClaims = {
    purpose: "projection_read",
    workspaceId: h.scope.workspaceId,
    operatingProfileId: h.scope.operatingProfileId,
    representativeId: h.scope.representativeId,
    ...identityFromReceipt(allocation),
    asOfRecordSequence: initialSequence,
    asOfRecordTime: initialTime
  };
  const earlier = await h.coordinator.readCommittedProjectionAsOf({
    authorityEnvelope: h.authority.sign(projectionClaims)
  });
  assert.equal(earlier.record.projection.state, "TRIGGERED");
  assert.equal(earlier.record.projection.sourceArtifacts.some(source => source.eventKind === "EXCLUSION_RECORDED"), false);
  const events = h.repository.query("SELECT record_sequence, authoritative_record_time FROM lifecycle_events ORDER BY record_sequence");
  assert.ok(events.every((event, index) => index === 0
    || (event.record_sequence > events[index - 1].record_sequence
      && Date.parse(event.authoritative_record_time) > Date.parse(events[index - 1].authoritative_record_time))));
});

test("runtime context exposes trusted territory and only server-derived completed candidates", async () => {
  const territory = knownTerritoryContext("runtime-context");
  const h = await openHarness({ territoryContext: territory });
  const first = await h.coordinator.allocateNextStopOpportunity({ event: allocatorEvent(1, iso(0)) });
  const lifecycle = await completeServerDerivedAction(h, first, "runtime-context", {
    manifestAt: iso(10_000),
    snapshotAt: iso(20_000),
    shadowAt: iso(30_000),
    actionAt: iso(40_000),
    sequence: 10
  });
  assert.equal(lifecycle.context.runtimeContextContractVersion, routeIqProspectiveRuntimeContextContractVersion);
  assert.deepEqual(lifecycle.context.territorySource, {
    status: "known",
    sourceRecordSha256: territory.sourceRecordSha256,
    sourceContractVersion: territory.sourceContractVersion,
    availableAt: territory.availableAt
  });
  assert.equal(lifecycle.action.selectedCandidateId, lifecycle.accepted.manifest.candidateId);
  assert.equal(lifecycle.action.selectedCandidateDerivedFrom, "accepted_manifest_unique_ordinal_1");
  assert.equal(lifecycle.action.browserCandidateIdentityAccepted, false);

  const retry = await h.coordinator.linkServerDerivedNextStopAction({
    authorityEnvelope: h.authority.sign({
      ...lifecycle.actionClaims,
      authoritativeRecordTime: iso(50_000)
    })
  });
  assert.deepEqual(retry, lifecycle.action);
  assert.equal(h.repository.one("SELECT COUNT(*) AS count FROM lifecycle_events WHERE event_kind = 'ACTION_LINKED'").count, 1);

  const second = await h.coordinator.allocateNextStopOpportunity({ event: allocatorEvent(999, iso(90_000)) });
  const secondContext = await h.coordinator.readCanonicalRuntimeContext({
    authorityEnvelope: h.authority.sign(runtimeClaims(h, "runtime_context_read", iso(90_001)))
  });
  assert.equal(secondContext.opportunityId, second.opportunityId);
  assert.deepEqual(secondContext.completedCandidateIds, [lifecycle.accepted.manifest.candidateId]);
  assert.equal(secondContext.candidateCompletenessStatus, "pending_authenticated_intelligence_manifest");
  await assert.rejects(
    () => h.coordinator.linkServerDerivedNextStopAction({
      candidateId: lifecycle.accepted.manifest.candidateId,
      authorityEnvelope: h.authority.sign(runtimeClaims(h, "server_action_signal", iso(100_000), {
        runtimeContextReceiptSha256: secondContext.runtimeContextReceiptSha256,
        eventKind: "representative_action_observed"
      }))
    }),
    error => error.code === "route_iq_coordinator_field_not_allowlisted"
  );
});

test("server-derived action before seal and missing rank-one evidence fail closed", async t => {
  await t.test("action before seal", async () => {
    const h = await openHarness({ territoryContext: knownTerritoryContext("premature-server-action") });
    await h.coordinator.allocateNextStopOpportunity({ event: allocatorEvent(1) });
    const context = await h.coordinator.readCanonicalRuntimeContext({
      authorityEnvelope: h.authority.sign(runtimeClaims(h, "runtime_context_read", iso(1_000)))
    });
    const claims = runtimeClaims(h, "server_action_signal", iso(2_000), {
      runtimeContextReceiptSha256: context.runtimeContextReceiptSha256,
      eventKind: "representative_action_observed"
    });
    const excluded = await h.coordinator.linkServerDerivedNextStopAction({
      authorityEnvelope: h.authority.sign(claims)
    });
    assert.equal(excluded.status, "excluded");
    assert.deepEqual(excluded.reasonCodes, ["shadow_not_sealed_before_action"]);
    const retry = await h.coordinator.linkServerDerivedNextStopAction({
      authorityEnvelope: h.authority.sign({ ...claims, authoritativeRecordTime: iso(90_000) })
    });
    assert.deepEqual(retry, excluded);
  });

  await t.test("manifest without a unique rank one", async () => {
    const h = await openHarness({ territoryContext: knownTerritoryContext("missing-rank-one") });
    const allocation = await h.coordinator.allocateNextStopOpportunity({ event: allocatorEvent(1) });
    const manifest = candidateManifest(h, allocation, "missing-rank-one");
    manifest.claims.candidates[0].rankingContext.ordinal = 2;
    const excluded = await h.coordinator.acceptCandidateManifest({
      authorityEnvelope: h.authority.sign(operationClaims(h, allocation, "candidate_manifest", iso(10_000), 10, {
        expectedCandidateCount: manifest.hashes.candidateCount,
        expectedSourceCount: manifest.hashes.sourceCount,
        expectedCompleteManifestSha256: manifest.hashes.completeManifestSha256
      })),
      producerEnvelope: h.authority.sign(manifest.claims, "producer")
    });
    assert.equal(excluded.status, "excluded");
    assert.deepEqual(excluded.reasonCodes, ["candidate_manifest_incomplete_or_tampered"]);
    assert.equal(h.repository.one("SELECT COUNT(*) AS count FROM candidate_manifests").count, 0);
    assert.equal(h.repository.one("SELECT state FROM opportunities").state, "EXCLUDED");
  });
});

test("runtime exclusion is append-only, idempotent, and records changed content as conflict", async () => {
  const h = await openHarness({ territoryContext: knownTerritoryContext("runtime-exclusion") });
  await h.coordinator.allocateNextStopOpportunity({ event: allocatorEvent(1) });
  const context = await h.coordinator.readCanonicalRuntimeContext({
    authorityEnvelope: h.authority.sign(runtimeClaims(h, "runtime_context_read", iso(1_000)))
  });
  const base = runtimeClaims(h, "runtime_stage_exclusion", iso(2_000), {
    runtimeContextReceiptSha256: context.runtimeContextReceiptSha256,
    stage: "runtime_orchestration",
    reasonCodes: ["runtime_dependency_unavailable"],
    offendingDigest: digest("runtime-dependency-unavailable")
  });
  const first = await h.coordinator.recordRuntimeStageExclusion({
    authorityEnvelope: h.authority.sign(base)
  });
  const retry = await h.coordinator.recordRuntimeStageExclusion({
    authorityEnvelope: h.authority.sign({ ...base, authoritativeRecordTime: iso(90_000) })
  });
  assert.deepEqual(retry, first);
  assert.equal(h.repository.one("SELECT COUNT(*) AS count FROM lifecycle_events WHERE event_kind = 'EXCLUSION_RECORDED'").count, 1);
  await assert.rejects(
    () => h.coordinator.recordRuntimeStageExclusion({
      authorityEnvelope: h.authority.sign({
        ...base,
        authoritativeRecordTime: iso(90_001),
        reasonCodes: ["runtime_dependency_tampered"],
        offendingDigest: digest("runtime-dependency-tampered")
      })
    }),
    error => error.code === "route_iq_coordinator_conflict"
  );
  assert.equal(h.repository.one("SELECT COUNT(*) AS count FROM lifecycle_events WHERE event_kind = 'CONFLICT_RECORDED'").count, 1);
  assert.equal(h.repository.one("SELECT state FROM opportunities").state, "EXCLUDED");
});

test("committed handoff reconciliation binds multiple actions, appends corrections, and replays exactly once", async () => {
  const h = await openHarness({ territoryContext: knownTerritoryContext("field-handoff") });
  const first = await h.coordinator.allocateNextStopOpportunity({ event: allocatorEvent(1) });
  const firstLifecycle = await completeServerDerivedAction(h, first, "field-handoff-first", {
    manifestAt: iso(10_000), snapshotAt: iso(20_000), shadowAt: iso(30_000), actionAt: iso(40_000), sequence: 10
  });
  const second = await h.coordinator.allocateNextStopOpportunity({ event: allocatorEvent(2) });
  const secondLifecycle = await completeServerDerivedAction(h, second, "field-handoff-second", {
    manifestAt: iso(50_000), snapshotAt: iso(60_000), shadowAt: iso(70_000), actionAt: iso(80_000), sequence: 20
  });
  const rawSha256 = digest("committed-end-day-handoff");
  await h.coordinator.closeCanonicalSession({
    authorityEnvelope: h.authority.sign({
      purpose: "close_session",
      workspaceId: h.scope.workspaceId,
      operatingProfileId: h.scope.operatingProfileId,
      representativeId: h.scope.representativeId,
      closeReason: "end_day",
      handoffContractVersion: "route-iq-end-of-day-data-handoff-v1",
      endOfDayHandoffSha256: rawSha256,
      authoritativeRecordTime: iso(90_000)
    })
  });
  const correction = {
    sourceCorrectionRecordSha256: digest("first-outcome-correction"),
    sequence: 1,
    correctedAt: iso(65_000),
    previousOutcomeSignal: outcomeSignal("conversation", 1, 0),
    finalOutcomeSignal: outcomeSignal("lead", 1, 1),
    changedSignalFields: ["outcomeCode", "leads"],
    appendOnly: true
  };
  const projection = outcomeProjection(h, {
    rawSha256,
    archiveCommittedAt: iso(100_000),
    outcomes: [
      {
        candidateId: firstLifecycle.accepted.manifest.candidateId,
        actionEventTime: iso(45_000),
        corrections: [correction]
      },
      {
        candidateId: secondLifecycle.accepted.manifest.candidateId,
        actionEventTime: iso(85_000)
      }
    ]
  });
  const claims = runtimeClaims(h, "field_session_reconciliation", iso(110_000), {
    projectionSha256: projection.projectionSha256,
    sourceArchiveRawSha256: projection.sourceArchive.rawSha256,
    sourceArchiveSessionSha256: projection.sourceArchive.sourceArchiveSessionSha256
  });
  const receipt = await h.coordinator.reconcileCommittedFieldSessionOutcomes({
    authorityEnvelope: h.authority.sign(claims),
    projection
  });
  const restarted = await openHarness({
    repository: h.repository,
    authority: h.authority,
    issuedAt: iso(120_000),
    territoryContext: knownTerritoryContext("field-handoff")
  });
  const replay = await restarted.coordinator.reconcileCommittedFieldSessionOutcomes({
    authorityEnvelope: restarted.authority.sign({ ...claims, authoritativeRecordTime: iso(120_000) }),
    projection
  });
  assert.equal(receipt.contractVersion, routeIqFieldSessionOutcomeProjectionContractVersion);
  assert.deepEqual(replay, receipt);
  assert.equal(receipt.linked.length, 2);
  assert.deepEqual(receipt.exclusions, []);
  assert.equal(receipt.outcomeValuesInferredByData, false);
  assert.equal(h.repository.one("SELECT COUNT(*) AS count FROM field_session_outcome_links").count, 2);
  assert.equal(h.repository.one("SELECT COUNT(*) AS count FROM field_session_evaluation_contexts").count, 2);
  assert.equal(h.repository.one("SELECT COUNT(*) AS count FROM lifecycle_events WHERE event_kind = 'FIELD_SESSION_OUTCOME_CORRECTION_LINKED'").count, 1);
  assert.equal(h.repository.one("SELECT COUNT(*) AS count FROM field_session_reconciliation_receipts").count, 1);
  const evaluationContext = receipt.linked[0].evaluationContext;
  assert.equal(evaluationContext.schemaVersion, routeIqEvaluationContextSchemaVersion);
  assert.equal(receipt.linked[0].evaluationContextSha256, digest(evaluationContext));
  assert.equal(evaluationContext.opportunityId, first.opportunityId);
  assert.equal(evaluationContext.candidate.candidateId, firstLifecycle.accepted.manifest.candidateId);
  assert.equal(evaluationContext.candidate.acceptedRank, 1);
  assert.equal(evaluationContext.candidate.probability, 0.6);
  assert.equal(evaluationContext.action.selectedCandidateId, firstLifecycle.accepted.manifest.candidateId);
  assert.equal(evaluationContext.sourceOutcome.correctionState, "corrected");
  assert.deepEqual(evaluationContext.sourceOutcome.correctionRecordSha256s, [correction.sourceCorrectionRecordSha256]);
  assert.equal(evaluationContext.recommendationInfluence, "off");
  assert.throws(
    () => h.repository.db.exec("UPDATE field_session_evaluation_contexts SET context_sha256 = lower(hex(randomblob(32)))"),
    /field_session_evaluation_contexts_append_only/
  );
  assert.throws(
    () => h.repository.db.exec("DELETE FROM field_session_evaluation_contexts"),
    /field_session_evaluation_contexts_append_only/
  );
  const admitted = await restarted.coordinator.admitIntelligenceScoreableOutcome({
    authorityEnvelope: restarted.authority.sign(runtimeClaims(restarted, "scoreable_outcome_admission", iso(130_000), {
      sourceOutcomeEvidenceSha256: receipt.linked[0].evidenceSha256,
      evaluationContextSha256: receipt.linked[0].evaluationContextSha256,
      outcomeDerivationContractVersion: "route-iq-shadow-outcome-derivation-v1",
      observedOutcome: { status: "observed", value: true }
    }), "producer")
  });
  assert.equal(admitted.state, "OUTCOME_LINKED");
  assert.equal(admitted.evaluatedCandidateId, firstLifecycle.accepted.manifest.candidateId);
  assert.equal(admitted.evaluationContextSha256, receipt.linked[0].evaluationContextSha256);
  assert.equal(admitted.calculatedByData, false);
  await assert.rejects(
    () => restarted.coordinator.admitIntelligenceScoreableOutcome({
      candidateId: secondLifecycle.accepted.manifest.candidateId,
      authorityEnvelope: restarted.authority.sign(runtimeClaims(restarted, "scoreable_outcome_admission", iso(130_001), {
        sourceOutcomeEvidenceSha256: receipt.linked[0].evidenceSha256,
        evaluationContextSha256: receipt.linked[0].evaluationContextSha256,
        outcomeDerivationContractVersion: "route-iq-shadow-outcome-derivation-v1",
        observedOutcome: { status: "observed", value: true }
      }), "producer")
    }),
    error => error.code === "route_iq_coordinator_field_not_allowlisted"
  );
  drainProjectionOutbox(restarted);
  const evaluationRecord = buildFullEvaluationRecord(restarted, receipt, receipt.linked[0], admitted);
  const evaluated = await restarted.coordinator.admitIntelligenceEvaluation({
    authorityEnvelope: restarted.authority.sign(runtimeClaims(restarted, "evaluation_admission", iso(140_000), {
      sourceOutcomeEvidenceSha256: receipt.linked[0].evidenceSha256,
      evaluationContextSha256: receipt.linked[0].evaluationContextSha256,
      evaluationRecordSha256: evaluationRecord.evaluationRecordSha256,
      evaluationContractVersion: routeIqIntelligenceEvaluationContractVersion,
      evaluationRecord
    }), "producer")
  });
  assert.equal(evaluated.state, "EVALUATED");
  assert.equal(evaluated.sourceOutcomeEvidenceSha256, receipt.linked[0].evidenceSha256);
  assert.equal(evaluated.evaluationContextSha256, receipt.linked[0].evaluationContextSha256);
  assert.equal(evaluated.fullEvaluationPersisted, true);
  const replayedEvaluation = await restarted.coordinator.admitIntelligenceEvaluation({
    authorityEnvelope: restarted.authority.sign(runtimeClaims(restarted, "evaluation_admission", iso(150_000), {
      sourceOutcomeEvidenceSha256: receipt.linked[0].evidenceSha256,
      evaluationContextSha256: receipt.linked[0].evaluationContextSha256,
      evaluationRecordSha256: evaluationRecord.evaluationRecordSha256,
      evaluationContractVersion: routeIqIntelligenceEvaluationContractVersion,
      evaluationRecord
    }), "producer")
  });
  assert.deepEqual(replayedEvaluation, evaluated);
  drainProjectionOutbox(restarted);
  const evaluationProjection = h.repository.one(`
    SELECT p.projection_json
    FROM projection_outbox o
    JOIN projection_artifacts p ON p.outbox_id = o.outbox_id
    WHERE o.source_artifact_id = ?
  `, evaluated.artifactId);
  const projected = JSON.parse(evaluationProjection.projection_json);
  const projectedEvaluation = projected.evidence.find(item => item.evidenceKind === "prospective_opportunity_evaluation");
  assert.equal(projectedEvaluation.payload.evaluationRecordSha256, evaluationRecord.evaluationRecordSha256);
  assert.deepEqual(projectedEvaluation.payload.evaluationRecord, evaluationRecord);
  const events = h.repository.query("SELECT authoritative_record_time FROM lifecycle_events ORDER BY record_sequence");
  assert.ok(events.every((event, index) => index === 0
    || Date.parse(event.authoritative_record_time) > Date.parse(events[index - 1].authoritative_record_time)));
});

test("scoreable admission requires the exact immutable evaluation context", async () => {
  const source = await prepareReconciledEvaluationSource("context-binding");
  await assert.rejects(
    () => source.h.coordinator.admitIntelligenceScoreableOutcome({
      authorityEnvelope: source.h.authority.sign(runtimeClaims(source.h, "scoreable_outcome_admission", iso(80_000), {
        sourceOutcomeEvidenceSha256: source.link.evidenceSha256,
        evaluationContextSha256: digest("tampered-evaluation-context"),
        outcomeDerivationContractVersion: "route-iq-shadow-outcome-derivation-v1",
        observedOutcome: { status: "observed", value: true }
      }), "producer")
    }),
    error => error.code === "route_iq_scoreable_outcome_context_mismatch"
  );
  const admitted = await admitPreparedScoreable(source);
  assert.equal(admitted.outcomeReceipt.evaluationContextSha256, source.link.evaluationContextSha256);
});

test("producer-only exact outcome projection reads survive multi-opportunity recovery and SQLite restart", async t => {
  const directory = mkdtempSync(join(tmpdir(), "route-iq-exact-outcome-projection-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const location = join(directory, "coordinator.sqlite");
  const authority = createAuthority("exact-outcome-restart-key");
  const firstRepository = new NodeSqliteRepository(location);
  const firstHarness = await openHarness({
    repository: firstRepository,
    authority,
    territoryContext: knownTerritoryContext("exact-outcome-restart")
  });
  const prepared = await prepareTwoAdmittedOutcomeSources(firstHarness, "exact-outcome-restart");
  drainProjectionOutbox(firstHarness);
  assert.equal(firstRepository.one(`
    SELECT COUNT(*) AS count
    FROM projection_outbox o
    LEFT JOIN projection_commits c ON c.outbox_id = o.outbox_id
    WHERE c.outbox_id IS NULL
  `).count, 0);
  firstRepository.close();

  const restartedRepository = new NodeSqliteRepository(location);
  const restarted = await openHarness({
    repository: restartedRepository,
    authority,
    issuedAt: iso(170_000),
    territoryContext: knownTerritoryContext("exact-outcome-restart")
  });
  const records = [];
  for (const [index, outcomeReceipt] of prepared.outcomeReceipts.entries()) {
    const link = prepared.reconciliationReceipt.linked[index];
    const claims = exactOutcomeProjectionReadClaims(
      restarted,
      outcomeReceipt,
      link.evidenceSha256,
      iso(180_000 + index)
    );
    const firstRead = await restarted.coordinator.readCommittedProjectionForOutcomeArtifact({
      authorityEnvelope: restarted.authority.sign(claims, "producer")
    });
    const retry = await restarted.coordinator.readCommittedProjectionForOutcomeArtifact({
      authorityEnvelope: restarted.authority.sign({
        ...claims,
        authoritativeRecordTime: iso(190_000 + index)
      }, "producer")
    });
    assert.deepEqual(retry, firstRead);
    assert.equal(firstRead.ok, true);
    assert.equal(firstRead.found, true);
    assert.equal(firstRead.contractVersion, routeIqCommittedOutcomeProjectionReadContractVersion);
    assert.equal(firstRead.producerOnly, true);
    assert.deepEqual(Object.keys(firstRead.record).sort(), ["commit", "projection"]);
    assert.equal(firstRead.record.projection.opportunityId, prepared.allocations[index].opportunityId);
    assert.equal(firstRead.record.projection.asOfRecordSequence, outcomeReceipt.recordSequence);
    assert.equal(firstRead.record.projection.asOfRecordTime, outcomeReceipt.authoritativeRecordTime);
    assert.equal(firstRead.record.projection.state, "OUTCOME_LINKED");
    assert.equal(firstRead.record.projection.recommendationInfluence, "off");
    assert.equal(firstRead.record.projection.collectionDefault, "off");
    assert.equal(firstRead.record.commit.projectionCommitMarkerWrittenLast, true);
    assert.equal(firstRead.record.projection.sourceArtifacts.filter(source =>
      source.artifactId === outcomeReceipt.artifactId
      && source.eventKind === "OUTCOME_LINKED"
      && source.recordSha256 === outcomeReceipt.recordSha256
    ).length, 1);
    records.push(firstRead.record);
  }
  assert.notEqual(records[0].projection.opportunityId, records[1].projection.opportunityId);
  assert.ok(records[0].projection.asOfRecordSequence < records[1].projection.asOfRecordSequence);
  restartedRepository.close();
});

test("exact outcome projection read fails closed for pending, wrong, cross-coordinator, and tampered sources", async t => {
  await t.test("pending exact outcome outbox", async () => {
    const source = await prepareReconciledEvaluationSource("exact-read-pending");
    const outcomeReceipt = await source.h.coordinator.admitIntelligenceScoreableOutcome({
      authorityEnvelope: source.h.authority.sign(runtimeClaims(source.h, "scoreable_outcome_admission", iso(80_000), {
        sourceOutcomeEvidenceSha256: source.link.evidenceSha256,
        evaluationContextSha256: source.link.evaluationContextSha256,
        outcomeDerivationContractVersion: "route-iq-shadow-outcome-derivation-v1",
        observedOutcome: { status: "observed", value: true }
      }), "producer")
    });
    const claims = exactOutcomeProjectionReadClaims(
      source.h,
      outcomeReceipt,
      source.link.evidenceSha256,
      iso(100_000)
    );
    await assert.rejects(
      () => source.h.coordinator.readCommittedProjectionForOutcomeArtifact({
        authorityEnvelope: source.h.authority.sign(claims, "producer")
      }),
      error => error.code === "route_iq_coordinator_projection_recovery_pending"
    );
  });

  await t.test("wrong artifact and receipt binding", async () => {
    const source = await admitPreparedScoreable(await prepareReconciledEvaluationSource("exact-read-wrong"));
    drainProjectionOutbox(source.h);
    const wrongReceipt = {
      ...source.outcomeReceipt,
      artifactId: `riq_outcome_${digest("wrong-outcome-artifact")}`
    };
    await assert.rejects(
      () => source.h.coordinator.readCommittedProjectionForOutcomeArtifact({
        authorityEnvelope: source.h.authority.sign(exactOutcomeProjectionReadClaims(
          source.h,
          wrongReceipt,
          source.link.evidenceSha256,
          iso(100_000)
        ), "producer")
      }),
      error => error.code === "route_iq_exact_outcome_projection_source_missing"
    );
    await assert.rejects(
      () => source.h.coordinator.readCommittedProjectionForOutcomeArtifact({
        authorityEnvelope: source.h.authority.sign(exactOutcomeProjectionReadClaims(
          source.h,
          { ...source.outcomeReceipt, recordSha256: digest("tampered-outcome-record") },
          source.link.evidenceSha256,
          iso(100_001)
        ), "producer")
      }),
      error => error.code === "route_iq_exact_outcome_projection_receipt_binding_invalid"
    );
  });

  await t.test("different coordinator and representative", async () => {
    const cruz = await admitPreparedScoreable(await prepareReconciledEvaluationSource("exact-read-cruz"));
    const anthonyHarness = await openHarness({
      representativeId: "anthony",
      territoryContext: knownTerritoryContext("exact-read-anthony")
    });
    const anthonyAllocation = await anthonyHarness.coordinator.allocateNextStopOpportunity({ event: allocatorEvent(1) });
    const anthonyLifecycle = await completeServerDerivedAction(anthonyHarness, anthonyAllocation, "exact-read-anthony", {
      manifestAt: iso(10_000), snapshotAt: iso(20_000), shadowAt: iso(30_000), actionAt: iso(40_000), sequence: 10
    });
    const rawSha256 = digest("exact-read-anthony-handoff");
    await anthonyHarness.coordinator.closeCanonicalSession({
      authorityEnvelope: anthonyHarness.authority.sign({
        purpose: "close_session",
        workspaceId: anthonyHarness.scope.workspaceId,
        operatingProfileId: anthonyHarness.scope.operatingProfileId,
        representativeId: anthonyHarness.scope.representativeId,
        closeReason: "end_day",
        handoffContractVersion: "route-iq-end-of-day-data-handoff-v1",
        endOfDayHandoffSha256: rawSha256,
        authoritativeRecordTime: iso(50_000)
      })
    });
    const projection = outcomeProjection(anthonyHarness, {
      rawSha256,
      archiveCommittedAt: iso(60_000),
      outcomes: [{ candidateId: anthonyLifecycle.accepted.manifest.candidateId, actionEventTime: iso(45_000) }]
    });
    const reconciliation = await anthonyHarness.coordinator.reconcileCommittedFieldSessionOutcomes({
      authorityEnvelope: anthonyHarness.authority.sign(runtimeClaims(anthonyHarness, "field_session_reconciliation", iso(70_000), {
        projectionSha256: projection.projectionSha256,
        sourceArchiveRawSha256: projection.sourceArchive.rawSha256,
        sourceArchiveSessionSha256: projection.sourceArchive.sourceArchiveSessionSha256
      })),
      projection
    });
    const anthonyReceipt = await anthonyHarness.coordinator.admitIntelligenceScoreableOutcome({
      authorityEnvelope: anthonyHarness.authority.sign(runtimeClaims(anthonyHarness, "scoreable_outcome_admission", iso(80_000), {
        sourceOutcomeEvidenceSha256: reconciliation.linked[0].evidenceSha256,
        evaluationContextSha256: reconciliation.linked[0].evaluationContextSha256,
        outcomeDerivationContractVersion: "route-iq-shadow-outcome-derivation-v1",
        observedOutcome: { status: "observed", value: true }
      }), "producer")
    });
    await assert.rejects(
      () => cruz.h.coordinator.readCommittedProjectionForOutcomeArtifact({
        authorityEnvelope: cruz.h.authority.sign(exactOutcomeProjectionReadClaims(
          cruz.h,
          anthonyReceipt,
          reconciliation.linked[0].evidenceSha256,
          iso(100_000)
        ), "producer")
      }),
      error => error.code === "route_iq_exact_outcome_projection_source_missing"
    );
  });

  await t.test("tampered authority and non-producer channel", async () => {
    const source = await admitPreparedScoreable(await prepareReconciledEvaluationSource("exact-read-authority"));
    drainProjectionOutbox(source.h);
    const claims = exactOutcomeProjectionReadClaims(
      source.h,
      source.outcomeReceipt,
      source.link.evidenceSha256,
      iso(100_000)
    );
    const tampered = source.h.authority.sign(claims, "producer");
    tampered.claims.sourceOutcomeEvidenceSha256 = digest("tampered-authority-evidence");
    await assert.rejects(
      () => source.h.coordinator.readCommittedProjectionForOutcomeArtifact({ authorityEnvelope: tampered }),
      /test_only_signature_invalid/
    );
    await assert.rejects(
      () => source.h.coordinator.readCommittedProjectionForOutcomeArtifact({
        authorityEnvelope: source.h.authority.sign(claims)
      }),
      error => error.code === "route_iq_coordinator_keyed_authentication_required"
    );
  });
});

test("historical and synthetic field evidence cannot be promoted into exact outcome projections", async () => {
  for (const recordOrigin of ["historical", "synthetic"]) {
    const h = await openHarness({ territoryContext: knownTerritoryContext(`exact-read-${recordOrigin}`) });
    const allocation = await h.coordinator.allocateNextStopOpportunity({ event: allocatorEvent(1) });
    const lifecycle = await completeServerDerivedAction(h, allocation, `exact-read-${recordOrigin}`, {
      manifestAt: iso(10_000), snapshotAt: iso(20_000), shadowAt: iso(30_000), actionAt: iso(40_000), sequence: 10
    });
    const rawSha256 = digest(`exact-read-${recordOrigin}-handoff`);
    await h.coordinator.closeCanonicalSession({
      authorityEnvelope: h.authority.sign({
        purpose: "close_session",
        workspaceId: h.scope.workspaceId,
        operatingProfileId: h.scope.operatingProfileId,
        representativeId: h.scope.representativeId,
        closeReason: "end_day",
        handoffContractVersion: "route-iq-end-of-day-data-handoff-v1",
        endOfDayHandoffSha256: rawSha256,
        authoritativeRecordTime: iso(50_000)
      })
    });
    const projection = structuredClone(outcomeProjection(h, {
      rawSha256,
      archiveCommittedAt: iso(60_000),
      outcomes: [{ candidateId: lifecycle.accepted.manifest.candidateId, actionEventTime: iso(45_000) }]
    }));
    projection.recordOrigin = recordOrigin;
    const projectionBody = Object.fromEntries(Object.entries(projection).filter(([key]) => key !== "projectionSha256"));
    projection.projectionSha256 = digest(projectionBody);
    await assert.rejects(
      () => h.coordinator.reconcileCommittedFieldSessionOutcomes({
        authorityEnvelope: h.authority.sign(runtimeClaims(h, "field_session_reconciliation", iso(70_000), {
          projectionSha256: projection.projectionSha256,
          sourceArchiveRawSha256: projection.sourceArchive.rawSha256,
          sourceArchiveSessionSha256: projection.sourceArchive.sourceArchiveSessionSha256
        })),
        projection
      }),
      error => error.code === "route_iq_field_outcome_projection_not_canonical"
    );
    assert.equal(h.repository.one("SELECT COUNT(*) AS count FROM field_session_outcome_links").count, 0);
    assert.equal(h.repository.one("SELECT COUNT(*) AS count FROM lifecycle_events WHERE event_kind = 'OUTCOME_LINKED'").count, 0);
  }
});

test("full evaluation admission rejects context, rank, probability, candidate, chronology, scope, PII, and hash tampering", async t => {
  const cases = [
    {
      name: "context hash",
      mutate(record) {
        record.evaluationContextSha256 = digest("wrong-context");
      },
      mutateClaims(claims) {
        claims.evaluationContextSha256 = claims.evaluationRecord.evaluationContextSha256;
      },
      code: "route_iq_evaluation_context_mismatch"
    },
    {
      name: "accepted rank",
      mutate(record) {
        record.acceptedCandidate.rank = 2;
        record.readinessObservation.selectedCandidateRank = 2;
      },
      code: "route_iq_evaluation_record_binding_invalid"
    },
    {
      name: "probability",
      mutate(record) {
        record.acceptedCandidate.probability = 0.7;
        record.readinessObservation.selectedCandidateProbability = 0.7;
      },
      code: "route_iq_evaluation_record_binding_invalid"
    },
    {
      name: "unchosen candidate",
      mutate(record) {
        const candidateId = `riq_candidate_${digest("unchosen-candidate")}`;
        record.acceptedCandidate.candidateId = candidateId;
        record.action.candidateId = candidateId;
        record.readinessObservation.evaluatedDecisionId = candidateId;
        record.readinessObservation.observedOutcome.evaluatedDecisionId = candidateId;
      },
      code: "route_iq_evaluation_record_binding_invalid"
    },
    {
      name: "future chronology",
      mutate(record) {
        record.chronology.snapshotAcceptedAt = iso(200_000);
      },
      code: "route_iq_evaluation_record_binding_invalid"
    },
    {
      name: "cross scope",
      mutate(record) {
        record.scope.representativeId = "anthony";
      },
      code: "route_iq_evaluation_record_boundary_invalid"
    },
    {
      name: "PII field",
      mutate(record) {
        record.acceptedCandidate.customerName = "Prohibited Customer";
      },
      code: "route_iq_coordinator_privacy_field_prohibited",
      preserveHash: true
    },
    {
      name: "record hash",
      mutate(record) {
        record.readinessObservation.readinessCountEligible = false;
      },
      code: "route_iq_evaluation_record_hash_invalid",
      preserveHash: true
    }
  ];
  for (const entry of cases) {
    await t.test(entry.name, async () => {
      const source = await admitPreparedScoreable(await prepareReconciledEvaluationSource(`tamper-${entry.name.replaceAll(" ", "-")}`));
      const changed = structuredClone(source.evaluationRecord);
      entry.mutate(changed);
      const record = entry.preserveHash ? changed : rehashEvaluationRecord(changed);
      const claims = evaluationAdmissionClaims(source, record);
      entry.mutateClaims?.(claims);
      await assert.rejects(
        () => source.h.coordinator.admitIntelligenceEvaluation({
          authorityEnvelope: source.h.authority.sign(claims, "producer")
        }),
        error => error.code === entry.code
      );
    });
  }
});

test("evaluation admission is strictly later, idempotent across restart, and records changed content as a durable conflict", async () => {
  const source = await admitPreparedScoreable(await prepareReconciledEvaluationSource("evaluation-replay"));
  await assert.rejects(
    () => source.h.coordinator.admitIntelligenceEvaluation({
      authorityEnvelope: source.h.authority.sign(
        evaluationAdmissionClaims(source, source.evaluationRecord, source.outcomeReceipt.authoritativeRecordTime),
        "producer"
      )
    }),
    error => error.code === "route_iq_evaluation_chronology_invalid"
  );
  const first = await source.h.coordinator.admitIntelligenceEvaluation({
    authorityEnvelope: source.h.authority.sign(evaluationAdmissionClaims(source, source.evaluationRecord), "producer")
  });
  const restarted = await openHarness({
    repository: source.h.repository,
    authority: source.h.authority,
    issuedAt: iso(100_000),
    territoryContext: knownTerritoryContext("evaluation-evaluation-replay")
  });
  const replay = await restarted.coordinator.admitIntelligenceEvaluation({
    authorityEnvelope: restarted.authority.sign({
      ...evaluationAdmissionClaims({ ...source, h: restarted }, source.evaluationRecord, iso(100_000))
    }, "producer")
  });
  assert.deepEqual(replay, first);

  const changed = structuredClone(source.evaluationRecord);
  changed.scoreableOutcome.scoreableOutcomeRecordSha256 = digest("changed-scoreable-record");
  const changedRecord = rehashEvaluationRecord(changed);
  await assert.rejects(
    () => restarted.coordinator.admitIntelligenceEvaluation({
      authorityEnvelope: restarted.authority.sign(
        evaluationAdmissionClaims({ ...source, h: restarted }, changedRecord, iso(110_000)),
        "producer"
      )
    }),
    error => error.code === "route_iq_coordinator_conflict"
  );
  assert.equal(source.h.repository.one("SELECT COUNT(*) AS count FROM lifecycle_events WHERE event_kind = 'EVALUATED'").count, 1);
  assert.equal(source.h.repository.one("SELECT COUNT(*) AS count FROM lifecycle_events WHERE event_kind = 'CONFLICT_RECORDED'").count, 1);
  const original = source.h.repository.one("SELECT canonical_json FROM lifecycle_events WHERE event_kind = 'EVALUATED'");
  assert.equal(JSON.parse(original.canonical_json).payload.evaluationRecordSha256, source.evaluationRecord.evaluationRecordSha256);
});

test("missing shadow seal cannot produce an evaluation context", async () => {
  const h = await openHarness({ territoryContext: knownTerritoryContext("missing-seal-context") });
  const allocation = await h.coordinator.allocateNextStopOpportunity({ event: allocatorEvent(1) });
  const lifecycle = await completeServerDerivedAction(h, allocation, "missing-seal-context", {
    manifestAt: iso(10_000), snapshotAt: iso(20_000), shadowAt: iso(30_000), actionAt: iso(40_000), sequence: 10
  });
  const rawSha256 = digest("missing-seal-context-handoff");
  await h.coordinator.closeCanonicalSession({
    authorityEnvelope: h.authority.sign({
      purpose: "close_session",
      workspaceId: h.scope.workspaceId,
      operatingProfileId: h.scope.operatingProfileId,
      representativeId: h.scope.representativeId,
      closeReason: "end_day",
      handoffContractVersion: "route-iq-end-of-day-data-handoff-v1",
      endOfDayHandoffSha256: rawSha256,
      authoritativeRecordTime: iso(50_000)
    })
  });
  h.repository.db.exec("DROP TRIGGER lifecycle_events_no_update");
  h.repository.db.exec("UPDATE lifecycle_events SET event_kind = 'TEST_REMOVED_SHADOW_SEAL' WHERE event_kind = 'SHADOW_DECISION_SEALED'");
  const projection = outcomeProjection(h, {
    rawSha256,
    archiveCommittedAt: iso(60_000),
    outcomes: [{ candidateId: lifecycle.accepted.manifest.candidateId, actionEventTime: iso(45_000) }]
  });
  const receipt = await h.coordinator.reconcileCommittedFieldSessionOutcomes({
    authorityEnvelope: h.authority.sign(runtimeClaims(h, "field_session_reconciliation", iso(70_000), {
      projectionSha256: projection.projectionSha256,
      sourceArchiveRawSha256: projection.sourceArchive.rawSha256,
      sourceArchiveSessionSha256: projection.sourceArchive.sourceArchiveSessionSha256
    })),
    projection
  });
  assert.deepEqual(receipt.linked, []);
  assert.deepEqual(receipt.exclusions.map(item => item.reasonCode), ["action_outcome_chronology_invalid"]);
  assert.equal(h.repository.one("SELECT COUNT(*) AS count FROM field_session_evaluation_contexts").count, 0);
});

test("handoff reconciliation rejects unbound, wrong, equal-time, cross-scope, and changed evidence", async t => {
  await t.test("handoff before an action or with a wrong candidate is excluded", async () => {
    const h = await openHarness({ territoryContext: knownTerritoryContext("handoff-before-action") });
    const allocation = await h.coordinator.allocateNextStopOpportunity({ event: allocatorEvent(1) });
    const accepted = await acceptManifest(h, allocation, "handoff-before-action", iso(10_000), 10);
    const rawSha256 = digest("handoff-before-action");
    await h.coordinator.closeCanonicalSession({
      authorityEnvelope: h.authority.sign({
        purpose: "close_session",
        workspaceId: h.scope.workspaceId,
        operatingProfileId: h.scope.operatingProfileId,
        representativeId: h.scope.representativeId,
        closeReason: "end_route",
        handoffContractVersion: "route-iq-end-of-day-data-handoff-v1",
        endOfDayHandoffSha256: rawSha256,
        authoritativeRecordTime: iso(20_000)
      })
    });
    const projection = outcomeProjection(h, {
      rawSha256,
      archiveCommittedAt: iso(40_000),
      outcomes: [{ candidateId: accepted.manifest.candidateId, actionEventTime: iso(30_000) }]
    });
    const receipt = await h.coordinator.reconcileCommittedFieldSessionOutcomes({
      authorityEnvelope: h.authority.sign(runtimeClaims(h, "field_session_reconciliation", iso(50_000), {
        projectionSha256: projection.projectionSha256,
        sourceArchiveRawSha256: projection.sourceArchive.rawSha256,
        sourceArchiveSessionSha256: projection.sourceArchive.sourceArchiveSessionSha256
      })),
      projection
    });
    assert.deepEqual(receipt.linked, []);
    assert.deepEqual(receipt.exclusions.map(value => value.reasonCode), ["candidate_action_binding_missing"]);
  });

  await t.test("equal action/outcome chronology is excluded and changed archive projection is a durable conflict", async () => {
    const h = await openHarness({ territoryContext: knownTerritoryContext("handoff-conflict") });
    const allocation = await h.coordinator.allocateNextStopOpportunity({ event: allocatorEvent(1) });
    const lifecycle = await completeServerDerivedAction(h, allocation, "handoff-conflict", {
      manifestAt: iso(10_000), snapshotAt: iso(20_000), shadowAt: iso(30_000), actionAt: iso(40_000), sequence: 10
    });
    const rawSha256 = digest("handoff-conflict");
    await h.coordinator.closeCanonicalSession({
      authorityEnvelope: h.authority.sign({
        purpose: "close_session",
        workspaceId: h.scope.workspaceId,
        operatingProfileId: h.scope.operatingProfileId,
        representativeId: h.scope.representativeId,
        closeReason: "end_day",
        handoffContractVersion: "route-iq-end-of-day-data-handoff-v1",
        endOfDayHandoffSha256: rawSha256,
        authoritativeRecordTime: iso(50_000)
      })
    });
    const projection = outcomeProjection(h, {
      rawSha256,
      archiveCommittedAt: iso(60_000),
      outcomes: [{ candidateId: lifecycle.accepted.manifest.candidateId, actionEventTime: lifecycle.action.authoritativeRecordTime }]
    });
    const claims = runtimeClaims(h, "field_session_reconciliation", iso(70_000), {
      projectionSha256: projection.projectionSha256,
      sourceArchiveRawSha256: projection.sourceArchive.rawSha256,
      sourceArchiveSessionSha256: projection.sourceArchive.sourceArchiveSessionSha256
    });
    const first = await h.coordinator.reconcileCommittedFieldSessionOutcomes({
      authorityEnvelope: h.authority.sign(claims),
      projection
    });
    assert.deepEqual(first.exclusions.map(value => value.reasonCode), ["action_outcome_chronology_invalid"]);
    const changed = outcomeProjection(h, {
      rawSha256,
      archiveCommittedAt: iso(60_000),
      outcomes: [{
        candidateId: lifecycle.accepted.manifest.candidateId,
        actionEventTime: lifecycle.action.authoritativeRecordTime,
        finalOutcomeSignal: outcomeSignal("closed", 0, 0)
      }]
    });
    await assert.rejects(
      () => h.coordinator.reconcileCommittedFieldSessionOutcomes({
        authorityEnvelope: h.authority.sign(runtimeClaims(h, "field_session_reconciliation", iso(80_000), {
          projectionSha256: changed.projectionSha256,
          sourceArchiveRawSha256: changed.sourceArchive.rawSha256,
          sourceArchiveSessionSha256: changed.sourceArchive.sourceArchiveSessionSha256
        })),
        projection: changed
      }),
      error => error.code === "route_iq_coordinator_conflict"
    );
    assert.equal(h.repository.one("SELECT COUNT(*) AS count FROM field_session_reconciliation_conflicts").count, 1);
  });

  await t.test("cross-scope and PII-bearing caller fields are rejected without reconciliation", async () => {
    const h = await openHarness({ territoryContext: knownTerritoryContext("handoff-scope") });
    await h.coordinator.allocateNextStopOpportunity({ event: allocatorEvent(1) });
    const projection = outcomeProjection(h, {
      rawSha256: digest("handoff-scope"),
      archiveCommittedAt: iso(40_000),
      outcomes: [{ candidateId: `riq_candidate_${digest("scope-candidate")}`, actionEventTime: iso(30_000) }]
    });
    const crossScope = structuredClone(projection);
    crossScope.scope.representativeId = "anthony";
    const body = Object.fromEntries(Object.entries(crossScope).filter(([key]) => key !== "projectionSha256"));
    crossScope.projectionSha256 = digest(body);
    await assert.rejects(
      () => h.coordinator.reconcileCommittedFieldSessionOutcomes({
        authorityEnvelope: h.authority.sign(runtimeClaims(h, "field_session_reconciliation", iso(50_000), {
          projectionSha256: crossScope.projectionSha256,
          sourceArchiveRawSha256: crossScope.sourceArchive.rawSha256,
          sourceArchiveSessionSha256: crossScope.sourceArchive.sourceArchiveSessionSha256
        })),
        projection: crossScope
      }),
      error => error.code === "route_iq_field_outcome_projection_cross_scope"
    );
    await assert.rejects(
      () => h.coordinator.reconcileCommittedFieldSessionOutcomes({
        authorityEnvelope: h.authority.sign(runtimeClaims(h, "field_session_reconciliation", iso(50_000), {
          projectionSha256: projection.projectionSha256,
          sourceArchiveRawSha256: projection.sourceArchive.rawSha256,
          sourceArchiveSessionSha256: projection.sourceArchive.sourceArchiveSessionSha256
        })),
        projection,
        address: "123 Main Street"
      }),
      error => error.code === "route_iq_coordinator_field_not_allowlisted"
    );
  });
});

test("allocation and authenticated session close roll back at every SQLite persistence boundary", async t => {
  await t.test("allocation", async () => {
    const baseline = await openHarness();
    const beforeMutations = baseline.repository.mutationCount;
    await baseline.coordinator.allocateNextStopOpportunity({ event: allocatorEvent(1) });
    const boundaries = baseline.repository.mutationCount - beforeMutations;
    assert.ok(boundaries > 0);

    for (let boundary = 1; boundary <= boundaries; boundary += 1) {
      const h = await openHarness();
      const before = canonicalDatabaseDump(h.repository);
      h.repository.armCrash(boundary);
      await assert.rejects(
        () => h.coordinator.allocateNextStopOpportunity({ event: allocatorEvent(1) }),
        /test_only_allocator_crash_/
      );
      h.repository.disarmCrash();
      assert.equal(canonicalDatabaseDump(h.repository), before, `allocation boundary ${boundary}`);
      await h.coordinator.allocateNextStopOpportunity({ event: allocatorEvent(1) });
    }
  });

  await t.test("session close", async () => {
    const closeClaimsFor = h => ({
      purpose: "close_session",
      workspaceId: h.scope.workspaceId,
      operatingProfileId: h.scope.operatingProfileId,
      representativeId: h.scope.representativeId,
      closeReason: "end_day",
      handoffContractVersion: "route-iq-end-of-day-data-handoff-v1",
      endOfDayHandoffSha256: digest("crash-test-end-day-handoff"),
      authoritativeRecordTime: iso(20_000)
    });
    const baseline = await openHarness();
    await baseline.coordinator.allocateNextStopOpportunity({ event: allocatorEvent(1) });
    const beforeMutations = baseline.repository.mutationCount;
    await baseline.coordinator.closeCanonicalSession({
      authorityEnvelope: baseline.authority.sign(closeClaimsFor(baseline))
    });
    const boundaries = baseline.repository.mutationCount - beforeMutations;
    assert.ok(boundaries > 0);

    for (let boundary = 1; boundary <= boundaries; boundary += 1) {
      const h = await openHarness();
      await h.coordinator.allocateNextStopOpportunity({ event: allocatorEvent(1) });
      const before = canonicalDatabaseDump(h.repository);
      h.repository.armCrash(boundary);
      await assert.rejects(
        () => h.coordinator.closeCanonicalSession({
          authorityEnvelope: h.authority.sign(closeClaimsFor(h))
        }),
        /test_only_allocator_crash_/
      );
      h.repository.disarmCrash();
      assert.equal(canonicalDatabaseDump(h.repository), before, `session-close boundary ${boundary}`);
      await h.coordinator.closeCanonicalSession({
        authorityEnvelope: h.authority.sign(closeClaimsFor(h))
      });
    }
  });
});
