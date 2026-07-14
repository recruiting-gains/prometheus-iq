import test from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";

import {
  initializeRouteIqProspectiveCoordinatorSchema,
  openRouteIqProspectiveCoordinator,
} from "../data/route-iq-field-sessions-v1/route-iq-prospective-shadow-coordinator.mjs";
import {
  buildCandidateManifestCoordinatorClaims,
  buildFounderShadowReadinessAggregate,
  buildShadowDecisionSealCoordinatorClaims,
  buildSnapshotSealCoordinatorClaims,
  computeShadowDecisionRuntimeSha256,
  createImmutableAcceptedCandidateSnapshot,
  produceRouteIqNextStopCandidateManifest,
  produceShadowDecisionFromAcceptedSnapshot,
  shadowDecisionRuntimeReasonCodes,
} from "../intelligence/shadow-decision-readiness-runtime.mjs";

const root = resolve(import.meta.dirname, "..");
const BASE_TIME = Date.parse("2026-07-13T18:00:00.000Z");
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
    Object.entries(SOURCE_PATHS).map(([kind, path]) => [
      kind,
      { path, rawText: readFileSync(resolve(root, path), "utf8") },
    ]),
  );
}

function knownTerritoryContext(suffix = "runtime") {
  return {
    status: "known",
    territoryId: `riq_territory_${digest(`territory:${suffix}`)}`,
    sourceRecordSha256: digest(`territory-source:${suffix}`),
    sourceContractVersion: "route-iq-trusted-territory-context-v1",
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

test("real governed artifacts produce a complete provenance-bound manifest without changing scores or order", async () => {
  const harness = await openHarness("real-sources");
  const opportunity = canonicalOpportunity(harness.allocation, harness.territoryContext);
  const input = producerInput(opportunity);
  const first = produceRouteIqNextStopCandidateManifest(input);
  const replay = produceRouteIqNextStopCandidateManifest(input);

  assert.deepEqual(replay, first);
  assert.equal(first.disposition, "MANIFEST_READY");
  assert.equal(first.producerClaims.candidateCount, 15);
  assert.equal(first.producerClaims.sourceCount, 5);
  assert.equal(first.governedAudit.scoresChanged, false);
  assert.equal(first.recommendationInfluence, "OFF");
  assert.equal(
    first.producerClaims.candidates.every(
      (candidate) => candidate.sourceRecordIds.length === 5,
    ),
    true,
  );

  const expectedArtifactHashes = new Set(
    Object.values(input.sourceArtifacts).map((source) => digest(source.rawText)),
  );
  const actualHashes = new Set(
    first.producerClaims.sourceManifest.map((source) => source.sourceRecordSha256),
  );
  for (const expected of expectedArtifactHashes) assert.equal(actualHashes.has(expected), true);
  assert.equal(actualHashes.has(harness.territoryContext.sourceRecordSha256), true);

  const full = JSON.parse(input.sourceArtifacts.fullPool.rawText).cruz;
  for (const definition of first.governedAudit.candidateDefinitions) {
    const source = full.find(
      (candidate) => candidate.seedRouteOrder === definition.sourceOrdinal,
    );
    assert.equal(definition.recommendationScore, source.qualityScore);
  }
  const definitions = first.governedAudit.candidateDefinitions;
  assert.equal(
    definitions.every(
      (candidate, index) =>
        index === 0 ||
        definitions[index - 1].recommendationScore >= candidate.recommendationScore,
    ),
    true,
  );

  const completed = definitions[0].candidateId;
  const refilled = produceRouteIqNextStopCandidateManifest(
    producerInput(opportunity, { completedCandidateIds: [completed] }),
  );
  assert.equal(refilled.producerClaims.candidateCount, 15);
  assert.equal(
    refilled.producerClaims.candidates.some(
      (candidate) => candidate.candidateId === completed,
    ),
    false,
  );
  assert.equal(new Set(refilled.producerClaims.candidates.map((candidate) => candidate.candidateId)).size, 15);
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

test("SQLite coordinator accepts, seals, and deterministically replays exactly one shadow decision", async () => {
  const harness = await openHarness("sealed");
  const opportunity = canonicalOpportunity(harness.allocation, harness.territoryContext);
  const manifest = produceRouteIqNextStopCandidateManifest(producerInput(opportunity));
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

test("future/action/outcome/Decision Source input cannot alter deterministic accepted-snapshot decisions", async () => {
  const harness = await openHarness("contamination");
  const opportunity = canonicalOpportunity(harness.allocation, harness.territoryContext);
  const manifest = produceRouteIqNextStopCandidateManifest(producerInput(opportunity));
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
      () =>
        produceShadowDecisionFromAcceptedSnapshot({
          ...structuredClone(snapshot),
          ...contamination,
        }),
      /route_iq_shadow_decision_input_contaminated/,
    );
  }
});

test("action before the keyed shadow seal is permanently excluded by Data", async () => {
  const harness = await openHarness("action-before-seal");
  const opportunity = canonicalOpportunity(harness.allocation, harness.territoryContext);
  const manifest = produceRouteIqNextStopCandidateManifest(producerInput(opportunity));
  await acceptManifest(harness, opportunity, manifest);
  const selectedCandidateId = manifest.producerClaims.candidates[0].candidateId;
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
