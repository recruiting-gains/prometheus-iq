import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, createHmac } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";

import {
  initializeRouteIqProspectiveCoordinatorSchema,
  openRouteIqProspectiveCoordinator,
} from "../data/route-iq-field-sessions-v1/route-iq-prospective-shadow-coordinator.mjs";
import {
  buildCandidateManifestCoordinatorClaims,
  buildFounderShadowReadinessAggregate,
  computeShadowDecisionRuntimeSha256,
  produceRouteIqNextStopCandidateManifest,
  produceShadowDecisionFromAcceptedSnapshot,
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
