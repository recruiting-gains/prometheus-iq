import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, createHmac } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";

import {
  computeRouteIqCandidateManifestDigests,
  initializeRouteIqProspectiveCoordinatorSchema,
  openRouteIqProspectiveCoordinator,
  routeIqCandidateManifestSchemaVersion,
  routeIqCandidateProducerContractVersion,
  routeIqCandidateProducerEnvelopeVersion,
  routeIqCandidateSourceSchemaVersion,
  routeIqCandidateSourceVersion,
} from "../data/route-iq-field-sessions-v1/route-iq-prospective-shadow-coordinator.mjs";
import {
  routeIqChronologicalEvidenceProjectionVersion,
} from "../data/route-iq-field-sessions-v1/route-iq-field-session-archive.mjs";
import {
  buildCandidateManifestCoordinatorClaims,
  buildFounderShadowReadinessAggregate,
  buildShadowDecisionSealCoordinatorClaims,
  buildSnapshotSealCoordinatorClaims,
  computeShadowDecisionRuntimeSha256,
  createImmutableAcceptedCandidateSnapshot,
  produceRouteIqNextStopCandidateManifest,
  produceShadowDecisionFromAcceptedSnapshot,
  shadowDecisionProspectiveDispositionSchemaVersion,
  shadowDecisionRankingBasisVersion,
  shadowDecisionRuntimeReasonCodes,
} from "../intelligence/shadow-decision-readiness-runtime.mjs";

const root = resolve(import.meta.dirname, "..");
const BASE_TIME = Date.parse("2026-07-13T18:00:00.000Z");
const HISTORICAL_EVIDENCE_COMMIT = "fd0f306387664e8cd3cb1d957b81d3d7dda5dc8e";
const SOURCE_PATHS = Object.freeze({
  activePool:
    "data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/active-pool.json",
  fullPool:
    "data/qualified-prospects/google-qualified-businesses-v2/runtime-pools.json",
  quarantinePool:
    "data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/quarantine-pool.json",
  businessHours:
    "data/qualified-prospects/google-qualified-businesses-v2/business-hours-v1/business-hours.json",
});

function iso(offset) {
  return new Date(BASE_TIME + offset).toISOString();
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function digest(value) {
  return createHash("sha256")
    .update(typeof value === "string" ? value : stableJson(value))
    .digest("hex");
}

function sourceArtifacts() {
  return Object.fromEntries(
    Object.entries(SOURCE_PATHS).map(([kind, path]) => {
      const historicalSource = execFileSync("git", [
          "show",
          `${HISTORICAL_EVIDENCE_COMMIT}:${path}`,
      ], { cwd: root, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
      if (kind !== "businessHours") {
        return [kind, { path, rawText: historicalSource }];
      }
      const hours = JSON.parse(historicalSource);
      for (const record of hours.records) {
        record.sourceRetrievedAt = iso(-3_600_000);
        record.hoursVerifiedAt = iso(-3_600_000);
        record.lastSuccessfulRefreshAt = iso(-3_600_000);
        record.lastFailedRefreshAt = null;
        record.refreshFailure = null;
      }
      return [kind, { path, rawText: JSON.stringify(hours) }];
    }),
  );
}

function syntheticManifestSourceRecords(opportunity) {
  const descriptors = [
    {
      key: "territory",
      sourceRecordSha256: opportunity.territorySource.sourceRecordSha256,
      availableAt: opportunity.territorySource.availableAt,
    },
    ...Object.keys(SOURCE_PATHS).map((kind) => ({
      key: kind,
      sourceRecordSha256: digest(`synthetic-shadow-source:${kind}`),
      availableAt: iso(-3_600_000),
    })),
  ];
  return descriptors
    .map((source) => ({
      sourceRecordId: `riq_source_${digest({
        key: source.key,
        sourceRecordSha256: source.sourceRecordSha256,
      })}`,
      sourceSchemaVersion: routeIqCandidateSourceSchemaVersion,
      sourceVersion: routeIqCandidateSourceVersion,
      sourceRecordSha256: source.sourceRecordSha256,
      availableAt: source.availableAt,
    }))
    .sort((left, right) => left.sourceRecordId.localeCompare(right.sourceRecordId));
}

function syntheticManifestCandidateDefinitions(opportunity) {
  return Array.from({ length: 16 }, (_, index) => {
    const sourceOrdinal = index + 1;
    return {
      candidateId: `riq_candidate_${digest({
        territoryId: opportunity.canonicalContext.territoryId,
        sourceOrdinal,
        fixtureVersion: "synthetic-shadow-manifest-ready-v1",
      })}`,
      sourcePool: index < 15 ? "active" : "full",
      sourceOrdinal,
      recommendationScore: 100 - index,
      hoursStatus: "OPEN_VERIFIED",
    };
  });
}

function buildSyntheticManifestReadyFixture(opportunity, { completedCandidateIds = [] } = {}) {
  const sourceManifest = syntheticManifestSourceRecords(opportunity);
  const sourceRecordIds = sourceManifest.map((source) => source.sourceRecordId);
  const completed = new Set(completedCandidateIds);
  const selected = syntheticManifestCandidateDefinitions(opportunity)
    .filter((candidate) => !completed.has(candidate.candidateId))
    .slice(0, 15);
  const totalScore = selected.reduce(
    (sum, candidate) => sum + candidate.recommendationScore,
    0,
  );
  const candidates = selected.map((candidate, index) => ({
    candidateId: candidate.candidateId,
    sourceRecordIds,
    eligibility: {
      status: "eligible",
      reasonCodes: [
        "business_hours_eligible",
        "canonical_candidate_source_complete",
        candidate.sourcePool === "active"
          ? "governed_active_pool_member"
          : "governed_full_pool_fallback",
        "territory_permitted",
      ].sort(),
      evaluatedAt: iso(500),
    },
    rankingContext: {
      producerSubsystem: "Prometheus Intelligence Engine",
      ordinal: index + 1,
      probability: candidate.recommendationScore / totalScore,
      basisVersion: shadowDecisionRankingBasisVersion,
    },
  }));
  const digestInput = {
    territoryId: opportunity.canonicalContext.territoryId,
    evidenceCutoff: iso(1_000),
    envelopeVersion: routeIqCandidateProducerEnvelopeVersion,
    producerSubsystem: "Prometheus Intelligence Engine",
    producerContractVersion: routeIqCandidateProducerContractVersion,
    schemaVersion: routeIqCandidateManifestSchemaVersion,
    dataProjectionVersion: routeIqChronologicalEvidenceProjectionVersion,
    candidates,
    sourceManifest,
  };
  const digests = computeRouteIqCandidateManifestDigests(digestInput);
  const producerClaims = {
    purpose: "candidate_manifest",
    ...opportunity.scope,
    ...structuredClone(opportunity.canonicalContext),
    ...digestInput,
    candidateCount: digests.candidateCount,
    sourceCount: digests.sourceCount,
    candidateManifestSha256: digests.candidateManifestSha256,
    sourceManifestSha256: digests.sourceManifestSha256,
    completeManifestSha256: digests.completeManifestSha256,
  };
  return Object.freeze({
    schemaVersion: shadowDecisionProspectiveDispositionSchemaVersion,
    disposition: "MANIFEST_READY",
    opportunityId: opportunity.opportunityId,
    producerClaims,
    operationExpectations: {
      expectedCandidateCount: digests.candidateCount,
      expectedSourceCount: digests.sourceCount,
      expectedCompleteManifestSha256: digests.completeManifestSha256,
    },
    governedAudit: {
      fixtureVersion: "synthetic-shadow-manifest-ready-v1",
      targetSize: 15,
      eligibleSourceCandidateCount: 16 - completed.size,
      completedCandidateCount: completed.size,
      candidateDefinitions: selected.map((candidate, index) => ({
        ...candidate,
        manifestOrdinal: index + 1,
      })),
      scoresChanged: false,
      recommendationInfluence: "OFF",
    },
    canonicalProductionEvidenceEligible: false,
    recommendationInfluence: "OFF",
  });
}

function knownTerritoryContext(suffix = "runtime") {
  return {
    status: "known",
    territoryId: `riq_territory_${digest(`territory:${suffix}`)}`,
    sourceRecordSha256: digest(`territory-source:${suffix}`),
    sourceContractVersion: "route-iq-trusted-territory-context-v1",
    availableAt: "2026-07-12T18:00:00.000Z",
  };
}

function canonicalOpportunity(allocation, territoryContext, overrides = {}) {
  return {
    opportunityId: allocation.opportunityId,
    opportunityType: "next_stop",
    recordOrigin: "prospective",
    scope: {
      workspaceId: "fitness_connection",
      operatingProfileId: "fitness",
      representativeId: "cruz",
    },
    canonicalContext: {
      territoryId: allocation.canonicalContext.territoryId,
      canonicalSessionRecordSha256:
        allocation.canonicalContext.canonicalSessionRecordSha256,
      sessionEventSequence: allocation.canonicalContext.sessionEventSequence,
      opportunityEventSequence:
        allocation.canonicalContext.opportunityEventSequence,
      triggerRecordSha256: allocation.canonicalContext.triggerRecordSha256,
    },
    territorySource: {
      sourceRecordSha256: territoryContext.sourceRecordSha256,
      sourceContractVersion: territoryContext.sourceContractVersion,
      availableAt: "2026-07-12T18:00:00.000Z",
    },
    ...overrides,
  };
}

function producerInput(opportunity, overrides = {}) {
  return {
    canonicalOpportunity: opportunity,
    sourceArtifacts: sourceArtifacts(),
    completedCandidateIds: [],
    eligibilityEvaluatedAt: iso(500),
    evidenceCutoff: iso(1_000),
    targetSize: 15,
    ...overrides,
  };
}

class NodeSqliteRepository {
  constructor() {
    this.db = new DatabaseSync(":memory:");
  }

  executeSchema(sql) {
    this.db.exec(sql);
  }

  execute(sql, bindings = []) {
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
}

function createAuthority(secret = "intelligence-runtime-test-key") {
  const keyId = `riq_key_${digest(secret)}`;
  function sign(claims, channel = "infrastructure") {
    return {
      channel,
      claims: structuredClone(claims),
      keyId,
      algorithm: "HMAC-SHA-256",
      signature: createHmac("sha256", secret)
        .update(stableJson({ channel, claims }))
        .digest("hex"),
    };
  }
  return {
    keyId,
    sign,
    verifier: {
      async verify(envelope, { purpose }) {
        const expected = createHmac("sha256", secret)
          .update(stableJson({ channel: envelope.channel, claims: envelope.claims }))
          .digest("hex");
        if (
          envelope.signature !== expected ||
          envelope.claims?.purpose !== purpose
        ) {
          throw new Error("test_signature_invalid");
        }
        return {
          authenticated: true,
          verificationType:
            envelope.channel === "producer"
              ? "infrastructure_verified_producer_signature"
              : "infrastructure_keyed_attestation",
          keyId,
          algorithm: "HMAC-SHA-256",
          claims: structuredClone(envelope.claims),
        };
      },
    },
  };
}

async function openHarness(suffix = "runtime") {
  const repository = new NodeSqliteRepository();
  const authority = createAuthority(`runtime-key:${suffix}`);
  const territoryContext = knownTerritoryContext(suffix);
  const scopeClaims = {
    purpose: "coordinator_scope",
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    representativeId: "cruz",
    registryVersion: "fitness-representative-registry-v1",
    issuedAt: iso(0),
    territoryContext,
  };
  initializeRouteIqProspectiveCoordinatorSchema(repository);
  const coordinator = await openRouteIqProspectiveCoordinator({
    repository,
    authorityVerifier: authority.verifier,
    scopeEnvelope: authority.sign(scopeClaims),
  });
  const allocation = await coordinator.allocateNextStopOpportunity({
    event: {
      eventKind: "next_stop_requested",
      informationalSequence: 1,
      informationalObservedAt: iso(0),
    },
  });
  return { repository, authority, territoryContext, coordinator, allocation };
}

async function acceptManifest(harness, opportunity, result, at = iso(2_000)) {
  const claims = buildCandidateManifestCoordinatorClaims({
    canonicalOpportunity: opportunity,
    manifestResult: result,
    authoritativeRecordTime: at,
  });
  return harness.coordinator.acceptCandidateManifest({
    authorityEnvelope: harness.authority.sign(claims.operationClaims),
    producerEnvelope: harness.authority.sign(claims.producerClaims, "producer"),
  });
}

test("the frozen historical source set is deterministically excluded by current admission", async () => {
  const harness = await openHarness("real-sources");
  const opportunity = canonicalOpportunity(harness.allocation, harness.territoryContext);
  const input = producerInput(opportunity);
  const first = produceRouteIqNextStopCandidateManifest(input);
  const replay = produceRouteIqNextStopCandidateManifest(input);

  assert.deepEqual(replay, first);
  assert.equal(first.disposition, "EXCLUDED");
  assert.deepEqual(first.reasonCodes, [
    shadowDecisionRuntimeReasonCodes.candidateSetIncomplete,
  ]);
  assert.equal(first.canonicalProductionEvidenceEligible, false);
  assert.equal(first.recommendationInfluence, "OFF");
});

test("synthetic governed admission produces a complete deterministic success manifest", async () => {
  const harness = await openHarness("synthetic-success");
  const opportunity = canonicalOpportunity(harness.allocation, harness.territoryContext);
  const first = buildSyntheticManifestReadyFixture(opportunity);
  const replay = buildSyntheticManifestReadyFixture(opportunity);

  assert.deepEqual(replay, first);
  assert.equal(first.disposition, "MANIFEST_READY");
  assert.equal(first.producerClaims.candidateCount, 15);
  assert.equal(first.producerClaims.sourceCount, 5);
  assert.equal(first.governedAudit.eligibleSourceCandidateCount, 16);
  assert.equal(first.governedAudit.scoresChanged, false);
  assert.equal(first.recommendationInfluence, "OFF");
  assert.equal(
    first.producerClaims.candidates.every(
      (candidate) => candidate.sourceRecordIds.length === 5,
    ),
    true,
  );

  const expectedArtifactHashes = new Set(
    [
      harness.territoryContext.sourceRecordSha256,
      ...Object.keys(SOURCE_PATHS).map(
        (kind) => digest(`synthetic-shadow-source:${kind}`),
      ),
    ],
  );
  const actualHashes = new Set(
    first.producerClaims.sourceManifest.map((source) => source.sourceRecordSha256),
  );
  for (const expected of expectedArtifactHashes) assert.equal(actualHashes.has(expected), true);
  assert.equal(actualHashes.has(harness.territoryContext.sourceRecordSha256), true);

  const sourceDefinitions = syntheticManifestCandidateDefinitions(opportunity);
  for (const definition of first.governedAudit.candidateDefinitions) {
    const source = sourceDefinitions.find(
      (candidate) => candidate.sourceOrdinal === definition.sourceOrdinal,
    );
    assert.equal(definition.recommendationScore, source.recommendationScore);
    assert.equal(definition.hoursStatus, "OPEN_VERIFIED");
  }
  const definitions = first.governedAudit.candidateDefinitions;
  assert.equal(
    definitions.every(
      (candidate, index) => index === 0
        || definitions[index - 1].recommendationScore >= candidate.recommendationScore,
    ),
    true,
  );

  const completed = definitions[0].candidateId;
  const refilled = buildSyntheticManifestReadyFixture(opportunity, {
    completedCandidateIds: [completed],
  });
  assert.equal(refilled.producerClaims.candidateCount, 15);
  assert.equal(
    refilled.producerClaims.candidates.some(
      (candidate) => candidate.candidateId === completed,
    ),
    false,
  );
  assert.equal(
    new Set(refilled.producerClaims.candidates.map((candidate) => candidate.candidateId)).size,
    15,
  );
});

test("missing territory, candidate sources, future sources, and historical origins yield exclusions", async () => {
  const harness = await openHarness("exclusions");
  const opportunity = canonicalOpportunity(harness.allocation, harness.territoryContext);

  const noTerritory = structuredClone(opportunity);
  noTerritory.territorySource = null;
  const territoryExcluded = produceRouteIqNextStopCandidateManifest(
    producerInput(noTerritory),
  );
  assert.equal(territoryExcluded.disposition, "EXCLUDED");
  assert.deepEqual(territoryExcluded.reasonCodes, [
    shadowDecisionRuntimeReasonCodes.territoryMissing,
  ]);

  const missingSources = sourceArtifacts();
  missingSources.businessHours = null;
  const sourceExcluded = produceRouteIqNextStopCandidateManifest(
    producerInput(opportunity, { sourceArtifacts: missingSources }),
  );
  assert.equal(sourceExcluded.disposition, "EXCLUDED");
  assert.deepEqual(sourceExcluded.reasonCodes, [
    shadowDecisionRuntimeReasonCodes.candidateSourceMissing,
  ]);

  const futureExcluded = produceRouteIqNextStopCandidateManifest(
    producerInput(opportunity, {
      eligibilityEvaluatedAt: "2026-07-01T05:00:00.000Z",
      evidenceCutoff: "2026-07-01T05:30:00.000Z",
    }),
  );
  assert.equal(futureExcluded.disposition, "EXCLUDED");
  assert.deepEqual(futureExcluded.reasonCodes, [
    shadowDecisionRuntimeReasonCodes.futureEvidence,
  ]);

  const historical = structuredClone(opportunity);
  historical.recordOrigin = "historical";
  const historicalExcluded = produceRouteIqNextStopCandidateManifest(
    producerInput(historical),
  );
  assert.equal(historicalExcluded.disposition, "EXCLUDED");
  assert.deepEqual(historicalExcluded.reasonCodes, [
    shadowDecisionRuntimeReasonCodes.syntheticOrHistorical,
  ]);
});

test("SQLite coordinator rejects the excluded historical manifest without lifecycle mutation", async () => {
  const harness = await openHarness("historical-manifest-rejection");
  const opportunity = canonicalOpportunity(harness.allocation, harness.territoryContext);
  const manifest = produceRouteIqNextStopCandidateManifest(producerInput(opportunity));
  assert.equal(manifest.disposition, "EXCLUDED");
  assert.throws(
    () => buildCandidateManifestCoordinatorClaims({
      canonicalOpportunity: opportunity,
      manifestResult: manifest,
      authoritativeRecordTime: iso(2_000),
    }),
    /route_iq_candidate_manifest_result_invalid/,
  );
  assert.equal(
    harness.repository.one(
      "SELECT COUNT(*) AS count FROM candidate_manifests",
    ).count,
    0,
  );
  assert.equal(
    harness.repository.one(
      "SELECT COUNT(*) AS count FROM lifecycle_events WHERE event_kind IN ('CANDIDATE_MANIFEST_ACCEPTED', 'SNAPSHOT_SEALED', 'SHADOW_DECISION_SEALED')",
    ).count,
    0,
  );
});

test("SQLite coordinator accepts, seals, and idempotently replays one governed shadow decision", async () => {
  const harness = await openHarness("synthetic-sealed");
  const opportunity = canonicalOpportunity(harness.allocation, harness.territoryContext);
  const manifest = buildSyntheticManifestReadyFixture(opportunity);
  const accepted = await acceptManifest(harness, opportunity, manifest);
  assert.equal(accepted.state, "SNAPSHOT_PENDING_SEAL");

  const snapshotClaims = buildSnapshotSealCoordinatorClaims({
    canonicalOpportunity: opportunity,
    manifestResult: manifest,
    candidateManifestReceipt: accepted,
    sealedAt: iso(3_000),
  });
  const snapshotSeal = await harness.coordinator.sealSnapshot({
    authorityEnvelope: harness.authority.sign(snapshotClaims.operationClaims),
    sealEnvelope: harness.authority.sign(snapshotClaims.sealClaims),
  });
  assert.equal(snapshotSeal.state, "SNAPSHOT_SEALED");

  const acceptedSnapshot = createImmutableAcceptedCandidateSnapshot({
    canonicalOpportunity: opportunity,
    manifestResult: manifest,
    candidateManifestReceipt: accepted,
    snapshotSealReceipt: snapshotSeal,
  });
  const decision = produceShadowDecisionFromAcceptedSnapshot(acceptedSnapshot);
  assert.deepEqual(produceShadowDecisionFromAcceptedSnapshot(acceptedSnapshot), decision);
  assert.equal(decision.rankedCandidates.length, 15);
  assert.equal(decision.recommendationInfluence, "OFF");

  const decisionClaims = buildShadowDecisionSealCoordinatorClaims({
    canonicalOpportunity: opportunity,
    acceptedSnapshot,
    shadowDecision: decision,
    snapshotSealReceipt: snapshotSeal,
    sealedAt: iso(4_000),
  });
  const sealed = await harness.coordinator.sealShadowDecision({
    authorityEnvelope: harness.authority.sign(decisionClaims.operationClaims),
    sealEnvelope: harness.authority.sign(decisionClaims.sealClaims),
  });
  const retry = await harness.coordinator.sealShadowDecision({
    authorityEnvelope: harness.authority.sign(decisionClaims.operationClaims),
    sealEnvelope: harness.authority.sign(decisionClaims.sealClaims),
  });
  assert.deepEqual(retry, sealed);
  assert.equal(sealed.state, "SHADOW_DECISION_SEALED");
  assert.equal(
    harness.repository.one(
      "SELECT COUNT(*) AS count FROM lifecycle_events WHERE event_kind = 'SHADOW_DECISION_SEALED'",
    ).count,
    1,
  );
  assert.equal(
    harness.repository.one(
      "SELECT COUNT(*) AS count FROM lifecycle_events WHERE event_kind = 'EXCLUSION_RECORDED'",
    ).count,
    0,
  );
});

test("accepted-snapshot decisions reject action, outcome, future, and decision-source contamination", async () => {
  const harness = await openHarness("synthetic-contamination");
  const opportunity = canonicalOpportunity(harness.allocation, harness.territoryContext);
  const manifest = buildSyntheticManifestReadyFixture(opportunity);
  const accepted = await acceptManifest(harness, opportunity, manifest);
  const snapshotClaims = buildSnapshotSealCoordinatorClaims({
    canonicalOpportunity: opportunity,
    manifestResult: manifest,
    candidateManifestReceipt: accepted,
    sealedAt: iso(3_000),
  });
  const snapshotSeal = await harness.coordinator.sealSnapshot({
    authorityEnvelope: harness.authority.sign(snapshotClaims.operationClaims),
    sealEnvelope: harness.authority.sign(snapshotClaims.sealClaims),
  });
  const snapshot = createImmutableAcceptedCandidateSnapshot({
    canonicalOpportunity: opportunity,
    manifestResult: manifest,
    candidateManifestReceipt: accepted,
    snapshotSealReceipt: snapshotSeal,
  });

  for (const contamination of [
    { action: "visited" },
    { outcome: 1 },
    { futureEvidence: { score: 999 } },
    { decisionSource: "route_iq_recommendation" },
  ]) {
    assert.throws(
      () => produceShadowDecisionFromAcceptedSnapshot({
        ...structuredClone(snapshot),
        ...contamination,
      }),
      /route_iq_shadow_decision_input_contaminated/,
    );
  }
});

test("future/action/outcome/Decision Source contamination fails before snapshot admission", () => {
  for (const contamination of [
    { action: "visited" },
    { outcome: 1 },
    { futureEvidence: { score: 999 } },
    { decisionSource: "route_iq_recommendation" },
  ]) {
    assert.throws(
      () =>
        produceShadowDecisionFromAcceptedSnapshot({
          nested: contamination,
        }),
      /route_iq_shadow_decision_input_contaminated/,
    );
  }
});

test("action before the keyed shadow seal is permanently excluded by Data", async () => {
  const harness = await openHarness("action-before-seal");
  const opportunity = canonicalOpportunity(harness.allocation, harness.territoryContext);
  const selectedCandidateId = `riq_candidate_${digest("action-before-seal-candidate")}`;
  const actionClaims = {
    purpose: "action",
    ...opportunity.scope,
    ...opportunity.canonicalContext,
    canonicalEventBoundarySha256: digest("action-before-shadow-seal"),
    clientEventSequence: 10,
    clientContentSha256: digest("action-before-shadow-seal-content"),
    authoritativeRecordTime: iso(3_000),
    recordOrigin: "prospective",
    uncertainChronology: false,
    selectedCandidateId,
    decisionSource: null,
  };
  const action = await harness.coordinator.linkAction({
    authorityEnvelope: harness.authority.sign(actionClaims),
  });
  assert.equal(action.status, "excluded");
  assert.equal(action.state, "EXCLUDED");
  assert.equal(
    harness.repository.one(
      "SELECT COUNT(*) AS count FROM lifecycle_events WHERE event_kind = 'SHADOW_DECISION_SEALED'",
    ).count,
    0,
  );
  assert.equal(
    harness.repository.one(
      "SELECT COUNT(*) AS count FROM lifecycle_events WHERE event_kind = 'EXCLUSION_RECORDED'",
    ).count,
    1,
  );
});

test("Founder report requires keyed authority, exposes aggregates only, and starts at zero production evidence", () => {
  assert.throws(
    () =>
      buildFounderShadowReadinessAggregate({
        verifiedAuthority: { requesterRole: "founder" },
      }),
    /route_iq_founder_authority_invalid/,
  );
  const authority = createAuthority("founder-aggregate-key");
  const aggregate = buildFounderShadowReadinessAggregate({
    verifiedAuthority: {
      verificationType: "infrastructure_keyed_attestation",
      algorithm: "HMAC-SHA-256",
      keyId: authority.keyId,
      claims: {
        purpose: "founder_shadow_read",
        principalType: "founder",
        workspaceId: "fitness_connection",
        operatingProfileId: "fitness",
      },
    },
    canonicalProductionProjections: [],
  });
  assert.equal(aggregate.state, "INSUFFICIENT_EVIDENCE");
  assert.equal(aggregate.counts.canonicalProductionProspectiveRecords, 0);
  assert.equal(aggregate.counts.linkedScoreableOutcomesAfterExclusions, 0);
  assert.equal(
    aggregate.methodology.requiredLinkedScoreableOutcomesAfterExclusions,
    97,
  );
  assert.equal(aggregate.methodology.calibrationBinCount, 5);
  assert.equal(aggregate.methodology.minimumSupportedObservationsPerBin, 20);
  assert.equal(aggregate.methodology.minimumObservationsToSupportAllBins, 100);
  assert.equal(aggregate.candidateRecordsExposed, false);
  assert.equal(aggregate.representativeRecordsExposed, false);
  assert.equal(aggregate.recommendationInfluence, "OFF");
  assert.equal(
    aggregate.aggregateSha256,
    computeShadowDecisionRuntimeSha256(
      Object.fromEntries(
        Object.entries(aggregate).filter(([key]) => key !== "aggregateSha256"),
      ),
    ),
  );
  assert.equal(/candidateId|representativeId/.test(JSON.stringify(aggregate)), false);
});
