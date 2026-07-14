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

function canonicalDatabaseDump(repository) {
  const tables = [
    "coordinator_meta",
    "artifact_registry",
    "canonical_sessions",
    "canonical_session_events",
    "opportunities",
    "operation_attempts",
    "operation_receipts",
    "lifecycle_events",
    "candidate_manifests",
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
    sourceContractVersion: "route-iq-trusted-territory-context-v1"
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
  const h = await openHarness({ territoryContext: knownTerritoryContext("global-time") });
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
