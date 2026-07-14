import test from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { projectRouteIqChronologicalEvidence } from "../data/route-iq-field-sessions-v1/route-iq-field-session-archive.mjs";

import {
  RouteIqProspectiveCoordinatorConflictError,
  RouteIqProspectiveCoordinatorError,
  computeRouteIqCandidateManifestDigests,
  initializeRouteIqProspectiveCoordinatorSchema,
  openRouteIqProspectiveCoordinator,
  routeIqCandidateManifestSchemaVersion,
  routeIqCandidateProducerContractVersion,
  routeIqCandidateProducerEnvelopeVersion,
  routeIqCandidateSourceSchemaVersion,
  routeIqCandidateSourceVersion,
  routeIqProspectiveCollectionDefault,
  routeIqProspectiveCoordinatorContractVersion,
  routeIqProspectiveCoordinatorProjectionVersion,
  routeIqProspectiveCoordinatorSchemaVersion,
  routeIqProspectiveKvAuthority,
  routeIqProspectiveRecommendationInfluence
} from "../data/route-iq-field-sessions-v1/route-iq-prospective-shadow-coordinator.mjs";

const TIMES = Object.freeze({
  scope: "2026-07-13T13:00:00.000Z",
  trigger: "2026-07-13T13:00:01.000Z",
  manifest: "2026-07-13T13:00:02.000Z",
  snapshotSeal: "2026-07-13T13:00:03.000Z",
  shadowSeal: "2026-07-13T13:00:04.000Z",
  action: "2026-07-13T13:00:05.000Z",
  outcome: "2026-07-13T13:00:06.000Z",
  evaluation: "2026-07-13T13:00:07.000Z",
  correction: "2026-07-13T13:00:08.000Z",
  future: "2026-07-13T13:00:09.000Z"
});

const ARCHIVE_ROOT = "data/route-iq-field-sessions-v1/workspaces/fitness_connection/sessions/route-iq-field-session-fitness-connection-fitness-cruz-2026-07-11";
const ARCHIVE_PATHS = Object.freeze({
  raw: `${ARCHIVE_ROOT}/raw/prometheus-iq-cruz-daily-report-2026-07-11.json`,
  normalized: `${ARCHIVE_ROOT}/normalized/field-session.json`,
  calculated: `${ARCHIVE_ROOT}/normalized/calculated-metrics.json`,
  stressTestEvidence: `${ARCHIVE_ROOT}/evidence/stress-test-observations.json`,
  historyUpdates: `${ARCHIVE_ROOT}/normalized/history-updates.json`
});

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

function clone(value) {
  return structuredClone(value);
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
    const mutation = /^\s*(?:INSERT|UPDATE|DELETE|REPLACE)\b/i.test(sql);
    if (mutation) {
      this.mutationCount += 1;
      if (this.failAtMutation === this.mutationCount) throw new Error(`test_only_sqlite_crash_${this.mutationCount}`);
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

  query(sql, ...bindings) {
    return this.db.prepare(sql).all(...bindings);
  }

  one(sql, ...bindings) {
    return this.db.prepare(sql).get(...bindings) || null;
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

function scopeClaims(representativeId = "cruz") {
  return {
    purpose: "coordinator_scope",
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    representativeId,
    registryVersion: "fitness-representative-registry-v1",
    issuedAt: TIMES.scope
  };
}

function createAuthority(secret = "route-iq-test-only-key-material") {
  const keyId = `riq_key_${digest(secret)}`;
  function sign(claims, channel = "infrastructure") {
    const body = { channel, claims };
    return {
      channel,
      claims: clone(claims),
      keyId,
      algorithm: "HMAC-SHA-256",
      signature: createHmac("sha256", secret).update(stableJson(body)).digest("hex")
    };
  }
  function unkeyed(claims, channel = "infrastructure") {
    return {
      channel,
      claims: clone(claims),
      keyId,
      algorithm: "SHA-256",
      signature: digest({ channel, claims })
    };
  }
  const verifier = {
    async verify(envelope, { purpose }) {
      if (envelope.algorithm === "SHA-256") {
        return {
          authenticated: true,
          verificationType: "unkeyed_digest",
          keyId,
          algorithm: "SHA-256",
          claims: clone(envelope.claims)
        };
      }
      const expected = createHmac("sha256", secret)
        .update(stableJson({ channel: envelope.channel, claims: envelope.claims }))
        .digest("hex");
      if (envelope.signature !== expected || envelope.claims?.purpose !== purpose) {
        throw new RouteIqProspectiveCoordinatorError("Test verifier rejected a tampered envelope.", {
          code: "test_only_signature_invalid",
          status: 403
        });
      }
      return {
        authenticated: true,
        verificationType: envelope.channel === "producer"
          ? "infrastructure_verified_producer_signature"
          : "infrastructure_keyed_attestation",
        keyId,
        algorithm: "HMAC-SHA-256",
        claims: clone(envelope.claims)
      };
    }
  };
  return { keyId, sign, unkeyed, verifier };
}

function baseIdentity(suffix = "base") {
  return {
    territoryId: `riq_territory_${digest(`territory:${suffix}`)}`,
    canonicalSessionRecordSha256: digest(`session:${suffix}`),
    sessionEventSequence: 41,
    opportunityEventSequence: 17,
    triggerRecordSha256: digest(`trigger:${suffix}`)
  };
}

function operationClaims(identity, purpose, authoritativeRecordTime, clientEventSequence, extras = {}, scope = scopeClaims()) {
  return {
    purpose,
    workspaceId: scope.workspaceId,
    operatingProfileId: scope.operatingProfileId,
    representativeId: scope.representativeId,
    ...identity,
    canonicalEventBoundarySha256: digest(`${purpose}:boundary:${identity.triggerRecordSha256}`),
    clientEventSequence,
    clientContentSha256: digest(`${purpose}:content:${clientEventSequence}`),
    authoritativeRecordTime,
    recordOrigin: "prospective",
    uncertainChronology: false,
    ...extras
  };
}

function candidateManifest(identity, suffix = "base") {
  const sourceAlpha = `riq_source_${digest(`source-alpha:${suffix}`)}`;
  const sourceBeta = `riq_source_${digest(`source-beta:${suffix}`)}`;
  const candidateAlpha = `riq_candidate_${digest(`candidate-alpha:${suffix}`)}`;
  const candidateBeta = `riq_candidate_${digest(`candidate-beta:${suffix}`)}`;
  const sourceManifest = [
    {
      sourceRecordId: sourceAlpha,
      sourceSchemaVersion: routeIqCandidateSourceSchemaVersion,
      sourceVersion: routeIqCandidateSourceVersion,
      sourceRecordSha256: digest(`source-record-alpha:${suffix}`),
      availableAt: "2026-07-13T12:59:54.000Z"
    },
    {
      sourceRecordId: sourceBeta,
      sourceSchemaVersion: routeIqCandidateSourceSchemaVersion,
      sourceVersion: routeIqCandidateSourceVersion,
      sourceRecordSha256: digest(`source-record-beta:${suffix}`),
      availableAt: "2026-07-13T12:59:55.000Z"
    }
  ];
  const candidates = [
    {
      candidateId: candidateAlpha,
      sourceRecordIds: [sourceAlpha],
      eligibility: {
        status: "eligible",
        reasonCodes: ["territory_permitted"],
        evaluatedAt: "2026-07-13T12:59:56.000Z"
      },
      rankingContext: {
        producerSubsystem: "Prometheus Intelligence Engine",
        ordinal: 1,
        probability: 0.62,
        basisVersion: "route-iq-ranking-basis-v1"
      }
    },
    {
      candidateId: candidateBeta,
      sourceRecordIds: [sourceBeta],
      eligibility: {
        status: "eligible",
        reasonCodes: ["source_eligible"],
        evaluatedAt: "2026-07-13T12:59:57.000Z"
      },
      rankingContext: {
        producerSubsystem: "Prometheus Intelligence Engine",
        ordinal: 2,
        probability: null,
        basisVersion: "route-iq-ranking-basis-v1"
      }
    }
  ];
  const digestInput = {
    territoryId: identity.territoryId,
    evidenceCutoff: "2026-07-13T13:00:00.000Z",
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
    candidateIds: [candidateAlpha, candidateBeta],
    claims: {
      purpose: "candidate_manifest",
      workspaceId: "fitness_connection",
      operatingProfileId: "fitness",
      representativeId: "cruz",
      ...identity,
      ...digestInput,
      candidateCount: hashes.candidateCount,
      sourceCount: hashes.sourceCount,
      candidateManifestSha256: hashes.candidateManifestSha256,
      sourceManifestSha256: hashes.sourceManifestSha256,
      completeManifestSha256: hashes.completeManifestSha256
    },
    hashes
  };
}

async function createHarness(suffix = "base", representativeId = "cruz") {
  const repository = new NodeSqliteRepository();
  initializeRouteIqProspectiveCoordinatorSchema(repository);
  const authority = createAuthority(`route-iq-test-key:${suffix}:${representativeId}`);
  const scope = scopeClaims(representativeId);
  const scopeEnvelope = authority.sign(scope);
  const coordinator = await openRouteIqProspectiveCoordinator({
    repository,
    authorityVerifier: authority.verifier,
    scopeEnvelope
  });
  return { repository, authority, scope, scopeEnvelope, coordinator, identity: baseIdentity(suffix) };
}

async function triggerOpportunity(h, overrides = {}) {
  const claims = operationClaims(h.identity, "trigger", TIMES.trigger, 10, overrides, h.scope);
  const receipt = await h.coordinator.trigger({ authorityEnvelope: h.authority.sign(claims) });
  return { claims, receipt };
}

async function acceptManifest(h, overrides = {}) {
  const manifest = candidateManifest(h.identity, overrides.suffix || "base");
  if (overrides.mutateManifest) overrides.mutateManifest(manifest);
  const claims = operationClaims(h.identity, "candidate_manifest", TIMES.manifest, 11, {
    expectedCandidateCount: overrides.expectedCandidateCount ?? manifest.hashes.candidateCount,
    expectedSourceCount: overrides.expectedSourceCount ?? manifest.hashes.sourceCount,
    expectedCompleteManifestSha256: overrides.expectedCompleteManifestSha256 ?? manifest.hashes.completeManifestSha256,
    ...(overrides.claims || {})
  }, h.scope);
  const producerEnvelope = h.authority.sign(manifest.claims, "producer");
  if (overrides.tamperProducer) overrides.tamperProducer(producerEnvelope);
  const receipt = await h.coordinator.acceptCandidateManifest({
    authorityEnvelope: h.authority.sign(claims),
    producerEnvelope
  });
  return { claims, manifest, producerEnvelope, receipt };
}

async function sealSnapshot(h, snapshot, overrides = {}) {
  const claims = operationClaims(h.identity, "snapshot_seal_record", overrides.time || TIMES.snapshotSeal, 12, overrides.claims || {}, h.scope);
  const sealClaims = {
    purpose: "snapshot_seal",
    workspaceId: h.scope.workspaceId,
    operatingProfileId: h.scope.operatingProfileId,
    representativeId: h.scope.representativeId,
    sealId: `riq_seal_${digest(`snapshot-seal:${h.identity.triggerRecordSha256}`)}`,
    canonicalEventBoundarySha256: claims.canonicalEventBoundarySha256,
    sealedArtifactId: snapshot.receipt.artifactId,
    sealedRecordSha256: snapshot.receipt.recordSha256,
    candidateManifestSha256: snapshot.manifest.hashes.candidateManifestSha256,
    sealedAt: claims.authoritativeRecordTime
  };
  let sealEnvelope = overrides.unkeyed ? h.authority.unkeyed(sealClaims) : h.authority.sign(sealClaims);
  if (overrides.tamperSeal) overrides.tamperSeal(sealEnvelope);
  const receipt = await h.coordinator.sealSnapshot({
    authorityEnvelope: h.authority.sign(claims),
    sealEnvelope
  });
  return { claims, sealClaims, sealEnvelope, receipt };
}

async function sealShadowDecision(h, snapshot, snapshotSeal) {
  const shadowDecisionRecordSha256 = digest(`shadow-decision:${h.identity.triggerRecordSha256}`);
  const claims = operationClaims(h.identity, "shadow_decision_seal_record", TIMES.shadowSeal, 13, {
    shadowDecisionRecordSha256
  }, h.scope);
  const sealClaims = {
    purpose: "shadow_decision_seal",
    workspaceId: h.scope.workspaceId,
    operatingProfileId: h.scope.operatingProfileId,
    representativeId: h.scope.representativeId,
    sealId: `riq_seal_${digest(`shadow-seal:${h.identity.triggerRecordSha256}`)}`,
    canonicalEventBoundarySha256: claims.canonicalEventBoundarySha256,
    sealedArtifactId: snapshotSeal.receipt.artifactId,
    sealedRecordSha256: snapshotSeal.receipt.recordSha256,
    candidateManifestSha256: snapshot.manifest.hashes.candidateManifestSha256,
    sealedAt: claims.authoritativeRecordTime,
    shadowDecisionRecordSha256
  };
  const receipt = await h.coordinator.sealShadowDecision({
    authorityEnvelope: h.authority.sign(claims),
    sealEnvelope: h.authority.sign(sealClaims)
  });
  return { claims, sealClaims, receipt };
}

async function linkAction(h, candidateId, overrides = {}) {
  const claims = operationClaims(h.identity, "action", overrides.time || TIMES.action, overrides.clientEventSequence || 14, {
    selectedCandidateId: candidateId,
    decisionSource: overrides.decisionSource ?? { sourceId: "route_iq_recommendation" },
    ...(overrides.claims || {})
  }, h.scope);
  const receipt = await h.coordinator.linkAction({ authorityEnvelope: h.authority.sign(claims) });
  return { claims, receipt };
}

async function linkOutcome(h, candidateId, overrides = {}) {
  const claims = operationClaims(h.identity, "outcome", overrides.time || TIMES.outcome, overrides.clientEventSequence || 15, {
    evaluatedCandidateId: candidateId,
    observedOutcome: overrides.observedOutcome || { status: "observed", value: true },
    ...(overrides.claims || {})
  }, h.scope);
  const receipt = await h.coordinator.linkOutcome({ authorityEnvelope: h.authority.sign(claims) });
  return { claims, receipt };
}

async function evaluate(h) {
  const claims = operationClaims(h.identity, "evaluation", TIMES.evaluation, 16, {
    evaluationRecordSha256: digest(`evaluation:${h.identity.triggerRecordSha256}`)
  }, h.scope);
  const receipt = await h.coordinator.evaluate({ authorityEnvelope: h.authority.sign(claims) });
  return { claims, receipt };
}

async function fullLifecycle(h) {
  const trigger = await triggerOpportunity(h);
  const snapshot = await acceptManifest(h, { suffix: h.identity.triggerRecordSha256.slice(0, 8) });
  const snapshotSeal = await sealSnapshot(h, snapshot);
  const shadowSeal = await sealShadowDecision(h, snapshot, snapshotSeal);
  const action = await linkAction(h, snapshot.manifest.candidateIds[0]);
  const outcome = await linkOutcome(h, snapshot.manifest.candidateIds[0]);
  const evaluation = await evaluate(h);
  return { trigger, snapshot, snapshotSeal, shadowSeal, action, outcome, evaluation };
}

async function throughShadowSeal(h) {
  const trigger = await triggerOpportunity(h);
  const snapshot = await acceptManifest(h, { suffix: h.identity.triggerRecordSha256.slice(0, 8) });
  const snapshotSeal = await sealSnapshot(h, snapshot);
  const shadowSeal = await sealShadowDecision(h, snapshot, snapshotSeal);
  return { trigger, snapshot, snapshotSeal, shadowSeal };
}

async function readProjection(h, asOfRecordSequence, asOfRecordTime) {
  const claims = {
    purpose: "projection_read",
    workspaceId: h.scope.workspaceId,
    operatingProfileId: h.scope.operatingProfileId,
    representativeId: h.scope.representativeId,
    ...h.identity,
    asOfRecordSequence,
    asOfRecordTime
  };
  return h.coordinator.readCommittedProjectionAsOf({ authorityEnvelope: h.authority.sign(claims) });
}

function drainProjections(h) {
  const committed = [];
  while (true) {
    const result = h.coordinator.recoverNextProjection();
    if (result.status === "idle") return committed;
    committed.push(result);
  }
}

function tableCounts(repository) {
  return Object.fromEntries([
    "canonical_sessions", "opportunities", "operation_attempts", "operation_receipts",
    "lifecycle_events", "candidate_manifests", "projection_outbox",
    "projection_artifacts", "projection_commits", "artifact_registry"
  ].map(table => [table, Number(repository.one(`SELECT COUNT(*) AS count FROM ${table}`).count)]));
}

function committedHistoricalArchive() {
  const texts = Object.fromEntries(Object.entries(ARCHIVE_PATHS).map(([name, path]) => [name, readFileSync(path, "utf8")]));
  const normalizedRecord = JSON.parse(texts.normalized);
  return {
    commit: {
      status: "committed",
      workspaceId: normalizedRecord.workspaceId,
      sessionId: normalizedRecord.sessionId,
      operatingProfileId: normalizedRecord.operatingProfileId,
      rawSha256: digest(texts.raw)
    },
    rawReportText: texts.raw,
    normalizedRecord,
    calculatedMetrics: JSON.parse(texts.calculated),
    stressTestEvidence: JSON.parse(texts.stressTestEvidence),
    historyUpdates: JSON.parse(texts.historyUpdates),
    sourceArtifacts: Object.fromEntries(Object.entries(texts).map(([name, text]) => [name, {
      key: ARCHIVE_PATHS[name],
      text,
      sha256: digest(text),
      byteLength: Buffer.byteLength(text)
    }]))
  };
}

function canonicalDatabaseDump(repository) {
  const tables = [
    "coordinator_meta", "artifact_registry", "canonical_sessions", "opportunities",
    "canonical_session_contexts", "canonical_session_events",
    "operation_attempts", "operation_receipts", "lifecycle_events", "candidate_manifests",
    "field_session_outcome_links", "field_session_reconciliation_receipts", "field_session_reconciliation_conflicts",
    "projection_outbox", "projection_artifacts", "projection_commits"
  ];
  return stableJson(Object.fromEntries(tables.map(table => [
    table,
    repository.query(`SELECT * FROM ${table} ORDER BY rowid`).map(row => ({ ...row }))
  ])));
}

async function assertEveryMutationBoundaryAtomic({ label, setup, invoke }) {
  const baseline = await setup();
  const beforeMutations = baseline.repository.mutationCount;
  await invoke(baseline);
  const mutationBoundaries = baseline.repository.mutationCount - beforeMutations;
  assert.ok(mutationBoundaries > 0, `${label} must exercise SQLite mutations`);

  for (let boundary = 1; boundary <= mutationBoundaries; boundary += 1) {
    const h = await setup();
    const before = canonicalDatabaseDump(h.repository);
    h.repository.armCrash(boundary);
    await assert.rejects(() => invoke(h), new RegExp(`test_only_sqlite_crash_`), `${label} boundary ${boundary}`);
    h.repository.disarmCrash();
    assert.equal(canonicalDatabaseDump(h.repository), before, `${label} boundary ${boundary} must fully roll back`);
    await invoke(h);
  }
  return mutationBoundaries;
}

test("coordinator schema and authority posture are fixed", () => {
  assert.equal(routeIqProspectiveCoordinatorSchemaVersion, "route-iq-prospective-coordinator-schema-v1");
  assert.equal(routeIqProspectiveCoordinatorContractVersion, "route-iq-prospective-coordinator-contract-v1");
  assert.equal(routeIqProspectiveCoordinatorProjectionVersion, "route-iq-prospective-coordinator-projection-v1");
  assert.equal(routeIqProspectiveKvAuthority, "non_authoritative_cache_only");
  assert.equal(routeIqProspectiveCollectionDefault, "off");
  assert.equal(routeIqProspectiveRecommendationInfluence, "off");
});

test("full transactional lifecycle reaches EVALUATED with append-only history and recoverable outbox", async () => {
  const h = await createHarness("full-lifecycle");
  const lifecycle = await fullLifecycle(h);
  assert.equal(lifecycle.evaluation.receipt.state, "EVALUATED");
  assert.match(lifecycle.trigger.receipt.sessionId, /^riq_session_[a-f0-9]{64}$/);
  assert.match(lifecycle.trigger.receipt.opportunityId, /^riq_opportunity_[a-f0-9]{64}$/);
  assert.match(lifecycle.action.receipt.artifactId, /^riq_action_[a-f0-9]{64}$/);
  assert.match(lifecycle.outcome.receipt.artifactId, /^riq_outcome_[a-f0-9]{64}$/);
  assert.equal(h.repository.one("SELECT state FROM opportunities").state, "EVALUATED");
  const events = h.repository.query("SELECT * FROM lifecycle_events ORDER BY record_sequence");
  assert.deepEqual(events.map(row => row.event_kind), [
    "TRIGGERED", "SNAPSHOT_PENDING_SEAL", "SNAPSHOT_SEALED", "SHADOW_DECISION_SEALED",
    "ACTION_LINKED", "OUTCOME_LINKED", "EVALUATED"
  ]);
  assert.ok(events.every((row, index) => index === 0 || row.record_sequence > events[index - 1].record_sequence));
  assert.equal(h.repository.one("SELECT COUNT(*) AS count FROM projection_outbox").count, 7);
  assert.equal(h.repository.one("SELECT COUNT(*) AS count FROM projection_commits").count, 0);
  const committed = drainProjections(h);
  assert.equal(committed.length, 7);
  assert.equal(h.repository.one("SELECT COUNT(*) AS count FROM projection_commits").count, 7);
});

test("SQLite guards reject direct scope mutation, state skips, and canonical deletes", async () => {
  const h = await createHarness("sqlite-state-guards");
  await triggerOpportunity(h);
  assert.throws(() => h.repository.execute(`
    UPDATE opportunities
    SET state = 'EVALUATED', last_record_sequence = last_record_sequence + 1
  `), /opportunity_state_transition_invalid/);
  assert.throws(() => h.repository.execute(`
    UPDATE coordinator_meta
    SET representative_id = 'anthony', next_record_sequence = next_record_sequence + 1
  `), /coordinator_meta_scope_immutable/);
  assert.throws(() => h.repository.execute(`
    UPDATE opportunities
    SET last_record_sequence = last_record_sequence + 1,
      last_record_time = last_record_time
  `), /opportunity_state_transition_invalid/);
  assert.throws(() => h.repository.execute("DELETE FROM opportunities"), /opportunities_canonical_state_immutable/);
  const sessionForeignKeyColumns = h.repository.query("PRAGMA foreign_key_list(opportunities)")
    .filter(row => row.table === "canonical_sessions")
    .map(row => [row.from, row.to])
    .sort((left, right) => left[0].localeCompare(right[0]));
  assert.deepEqual(sessionForeignKeyColumns, [
    ["canonical_session_record_sha256", "canonical_session_record_sha256"],
    ["session_id", "session_id"]
  ]);
  assert.equal(h.repository.one("SELECT state FROM opportunities").state, "TRIGGERED");
  assert.equal(h.repository.one("SELECT representative_id FROM coordinator_meta").representative_id, "cruz");
});

test("identical retries and concurrent coordinator instances converge on one receipt", async () => {
  const h = await createHarness("concurrent-retry");
  await triggerOpportunity(h);
  const isolatedModule = await import(new URL(`../data/route-iq-field-sessions-v1/route-iq-prospective-shadow-coordinator.mjs?isolate=${Date.now()}`, import.meta.url));
  const second = await isolatedModule.openRouteIqProspectiveCoordinator({
    repository: h.repository,
    authorityVerifier: h.authority.verifier,
    scopeEnvelope: h.scopeEnvelope
  });
  const manifest = candidateManifest(h.identity, "concurrent");
  const claims = operationClaims(h.identity, "candidate_manifest", TIMES.manifest, 11, {
    expectedCandidateCount: manifest.hashes.candidateCount,
    expectedSourceCount: manifest.hashes.sourceCount,
    expectedCompleteManifestSha256: manifest.hashes.completeManifestSha256
  }, h.scope);
  const request = {
    authorityEnvelope: h.authority.sign(claims),
    producerEnvelope: h.authority.sign(manifest.claims, "producer")
  };
  const [left, right] = await Promise.all([
    h.coordinator.acceptCandidateManifest(clone(request)),
    second.acceptCandidateManifest(clone(request))
  ]);
  assert.deepEqual(left, right);
  assert.equal(h.repository.one("SELECT COUNT(*) AS count FROM candidate_manifests").count, 1);
  assert.equal(h.repository.one("SELECT COUNT(*) AS count FROM operation_receipts WHERE operation_kind = 'candidate_manifest'").count, 1);
  assert.equal(h.repository.one("SELECT COUNT(*) AS count FROM lifecycle_events WHERE event_kind = 'CONFLICT_RECORDED'").count, 0);
});

test("a separate SQLite adapter restart reads the original receipt and committed projection", async () => {
  const directory = mkdtempSync(join(tmpdir(), "route-iq-coordinator-"));
  const databasePath = join(directory, "coordinator.sqlite");
  let repository = new NodeSqliteRepository(databasePath);
  try {
    initializeRouteIqProspectiveCoordinatorSchema(repository);
    const authority = createAuthority("route-iq-restart-key");
    const scope = scopeClaims();
    const identity = baseIdentity("sqlite-restart");
    const scopeEnvelope = authority.sign(scope);
    let coordinator = await openRouteIqProspectiveCoordinator({
      repository,
      authorityVerifier: authority.verifier,
      scopeEnvelope
    });
    const claims = operationClaims(identity, "trigger", TIMES.trigger, 10, {}, scope);
    const authorityEnvelope = authority.sign(claims);
    const original = await coordinator.trigger({ authorityEnvelope });
    coordinator.recoverNextProjection();
    repository.close();

    repository = new NodeSqliteRepository(databasePath);
    coordinator = await openRouteIqProspectiveCoordinator({
      repository,
      authorityVerifier: authority.verifier,
      scopeEnvelope
    });
    const retry = await coordinator.trigger({ authorityEnvelope });
    assert.deepEqual(retry, original);
    const projectionClaims = {
      purpose: "projection_read",
      workspaceId: scope.workspaceId,
      operatingProfileId: scope.operatingProfileId,
      representativeId: scope.representativeId,
      ...identity,
      asOfRecordSequence: original.recordSequence,
      asOfRecordTime: original.authoritativeRecordTime
    };
    const projection = await coordinator.readCommittedProjectionAsOf({
      authorityEnvelope: authority.sign(projectionClaims)
    });
    assert.equal(projection.found, true);
    assert.equal(projection.record.projection.state, "TRIGGERED");
    assert.equal(projection.record.projection.readinessEvidenceEligible, false);
  } finally {
    try { repository.close(); } catch {}
    rmSync(directory, { recursive: true, force: true });
  }
});

test("canonical session hash continuity rejects manifest, action, and projection claims for hash B", async () => {
  const manifestHarness = await createHarness("session-hash-manifest");
  await triggerOpportunity(manifestHarness);
  const changedIdentity = {
    ...manifestHarness.identity,
    canonicalSessionRecordSha256: digest("canonical-session-hash-b")
  };
  const manifest = candidateManifest(changedIdentity, "session-hash-b");
  const manifestClaims = operationClaims(changedIdentity, "candidate_manifest", TIMES.manifest, 11, {
    expectedCandidateCount: manifest.hashes.candidateCount,
    expectedSourceCount: manifest.hashes.sourceCount,
    expectedCompleteManifestSha256: manifest.hashes.completeManifestSha256
  }, manifestHarness.scope);
  await assert.rejects(
    manifestHarness.coordinator.acceptCandidateManifest({
      authorityEnvelope: manifestHarness.authority.sign(manifestClaims),
      producerEnvelope: manifestHarness.authority.sign(manifest.claims, "producer")
    }),
    error => error.code === "route_iq_coordinator_opportunity_identity_mismatch"
  );
  assert.equal(manifestHarness.repository.one("SELECT COUNT(*) AS count FROM candidate_manifests").count, 0);
  assert.equal(manifestHarness.repository.one("SELECT COUNT(*) AS count FROM operation_attempts").count, 1);

  const actionHarness = await createHarness("session-hash-action");
  const lifecycle = await throughShadowSeal(actionHarness);
  const actionIdentity = {
    ...actionHarness.identity,
    canonicalSessionRecordSha256: digest("canonical-session-action-hash-b")
  };
  const actionClaims = operationClaims(actionIdentity, "action", TIMES.action, 14, {
    selectedCandidateId: lifecycle.snapshot.manifest.candidateIds[0],
    decisionSource: { sourceId: "route_iq_recommendation" }
  }, actionHarness.scope);
  await assert.rejects(
    actionHarness.coordinator.linkAction({ authorityEnvelope: actionHarness.authority.sign(actionClaims) }),
    error => error.code === "route_iq_coordinator_opportunity_identity_mismatch"
  );
  assert.equal(actionHarness.repository.one("SELECT state FROM opportunities").state, "SHADOW_DECISION_SEALED");
  assert.equal(actionHarness.repository.one("SELECT COUNT(*) AS count FROM lifecycle_events WHERE event_kind = 'ACTION_LINKED'").count, 0);

  drainProjections(actionHarness);
  const projectionClaims = {
    purpose: "projection_read",
    workspaceId: actionHarness.scope.workspaceId,
    operatingProfileId: actionHarness.scope.operatingProfileId,
    representativeId: actionHarness.scope.representativeId,
    ...actionIdentity,
    asOfRecordSequence: lifecycle.shadowSeal.receipt.recordSequence,
    asOfRecordTime: lifecycle.shadowSeal.receipt.authoritativeRecordTime
  };
  await assert.rejects(
    actionHarness.coordinator.readCommittedProjectionAsOf({
      authorityEnvelope: actionHarness.authority.sign(projectionClaims)
    }),
    error => error.code === "route_iq_coordinator_projection_opportunity_mismatch"
  );
});

test("same-time changed trigger retry durably records a monotonic governance conflict", async () => {
  const h = await createHarness("changed-trigger-identity");
  const original = await triggerOpportunity(h);
  const changedIdentity = {
    ...h.identity,
    canonicalSessionRecordSha256: digest("changed-trigger-session-identity")
  };
  const changedClaims = operationClaims(changedIdentity, "trigger", TIMES.trigger, 10, {}, h.scope);
  await assert.rejects(
    h.coordinator.trigger({ authorityEnvelope: h.authority.sign(changedClaims) }),
    error => error instanceof RouteIqProspectiveCoordinatorConflictError
      && error.details.originalReceipt.artifactId === original.receipt.artifactId
      && error.details.overwritePerformed === false
  );
  assert.equal(h.repository.one("SELECT state FROM opportunities").state, "EXCLUDED");
  assert.equal(h.repository.one("SELECT COUNT(*) AS count FROM operation_attempts WHERE operation_kind = 'trigger'").count, 2);
  assert.equal(h.repository.one("SELECT COUNT(*) AS count FROM operation_receipts WHERE operation_kind = 'trigger'").count, 1);
  assert.equal(h.repository.one("SELECT COUNT(*) AS count FROM lifecycle_events WHERE event_kind = 'CONFLICT_RECORDED'").count, 1);
  const events = h.repository.query("SELECT * FROM lifecycle_events ORDER BY record_sequence");
  const conflict = events[1];
  const conflictRecordTime = new Date(Date.parse(TIMES.trigger) + 1).toISOString();
  assert.deepEqual(events.map(event => event.event_kind), ["TRIGGERED", "CONFLICT_RECORDED"]);
  assert.equal(conflict.authoritative_record_time, conflictRecordTime);
  assert.ok(Date.parse(conflict.authoritative_record_time) > Date.parse(events[0].authoritative_record_time));
  const conflictRecord = JSON.parse(conflict.canonical_json);
  assert.equal(conflictRecord.payload.incomingAuthoritativeRecordTime, TIMES.trigger);
  assert.equal(conflictRecord.payload.governanceRecordTimeDerivation, "coordinator_prior_plus_one_millisecond");
  assert.equal(conflictRecord.payload.governanceRecordTimeOffsetMilliseconds, 1);

  drainProjections(h);
  const projectionRead = await readProjection(h, conflict.record_sequence, conflict.authoritative_record_time);
  const projection = projectionRead.record.projection;
  assert.equal(projection.state, "EXCLUDED");
  assert.equal(projection.readinessEvidenceEligible, false);
  assert.deepEqual(projection.sourceArtifacts.map(source => source.authoritativeRecordTime), [TIMES.trigger, conflictRecordTime]);
  assert.equal(projection.exclusions[0].sourceRecordId, conflict.artifact_id);
});

test("identical logical retries with refreshed server time return the original persisted receipt", async () => {
  const triggerHarness = await createHarness("refreshed-trigger-time");
  const originalTrigger = await triggerOpportunity(triggerHarness);
  const refreshedTriggerClaims = operationClaims(triggerHarness.identity, "trigger", TIMES.manifest, 10, {}, triggerHarness.scope);
  const triggerRetry = await triggerHarness.coordinator.trigger({
    authorityEnvelope: triggerHarness.authority.sign(refreshedTriggerClaims)
  });
  assert.deepEqual(triggerRetry, originalTrigger.receipt);
  assert.equal(triggerRetry.authoritativeRecordTime, TIMES.trigger);
  assert.equal(triggerHarness.repository.one("SELECT COUNT(*) AS count FROM operation_attempts WHERE operation_kind = 'trigger'").count, 1);
  assert.equal(triggerHarness.repository.one("SELECT COUNT(*) AS count FROM lifecycle_events WHERE event_kind = 'CONFLICT_RECORDED'").count, 0);

  const manifestHarness = await createHarness("refreshed-manifest-time");
  await triggerOpportunity(manifestHarness);
  const accepted = await acceptManifest(manifestHarness, { suffix: "refreshed-manifest-time" });
  const refreshedManifestClaims = {
    ...accepted.claims,
    authoritativeRecordTime: TIMES.snapshotSeal
  };
  const manifestRetry = await manifestHarness.coordinator.acceptCandidateManifest({
    authorityEnvelope: manifestHarness.authority.sign(refreshedManifestClaims),
    producerEnvelope: clone(accepted.producerEnvelope)
  });
  assert.deepEqual(manifestRetry, accepted.receipt);
  assert.equal(manifestRetry.authoritativeRecordTime, TIMES.manifest);
  assert.equal(manifestHarness.repository.one("SELECT COUNT(*) AS count FROM operation_attempts WHERE operation_kind = 'candidate_manifest'").count, 1);

  const actionHarness = await createHarness("refreshed-action-time");
  const lifecycle = await throughShadowSeal(actionHarness);
  const action = await linkAction(actionHarness, lifecycle.snapshot.manifest.candidateIds[0]);
  const refreshedActionClaims = {
    ...action.claims,
    authoritativeRecordTime: TIMES.outcome
  };
  const actionRetry = await actionHarness.coordinator.linkAction({
    authorityEnvelope: actionHarness.authority.sign(refreshedActionClaims)
  });
  assert.deepEqual(actionRetry, action.receipt);
  assert.equal(actionRetry.authoritativeRecordTime, TIMES.action);
  assert.equal(actionHarness.repository.one("SELECT COUNT(*) AS count FROM operation_attempts WHERE operation_kind = 'action'").count, 1);
});

test("changed retry is atomically preserved as conflict and rotating caller IDs cannot bypass it", async () => {
  const h = await createHarness("changed-retry");
  await triggerOpportunity(h);
  const accepted = await acceptManifest(h, { suffix: "changed-original" });
  const changed = candidateManifest(h.identity, "changed-competing");
  const changedClaims = operationClaims(h.identity, "candidate_manifest", TIMES.snapshotSeal, 11, {
    expectedCandidateCount: changed.hashes.candidateCount,
    expectedSourceCount: changed.hashes.sourceCount,
    expectedCompleteManifestSha256: changed.hashes.completeManifestSha256
  }, h.scope);
  await assert.rejects(
    h.coordinator.acceptCandidateManifest({
      authorityEnvelope: h.authority.sign(changedClaims),
      producerEnvelope: h.authority.sign(changed.claims, "producer")
    }),
    error => error instanceof RouteIqProspectiveCoordinatorConflictError
      && error.details.overwritePerformed === false
  );
  assert.equal(h.repository.one("SELECT state FROM opportunities").state, "EXCLUDED");
  assert.equal(h.repository.one("SELECT COUNT(*) AS count FROM operation_attempts WHERE operation_kind = 'candidate_manifest'").count, 2);
  assert.equal(h.repository.one("SELECT COUNT(*) AS count FROM lifecycle_events WHERE event_kind = 'CONFLICT_RECORDED'").count, 1);
  assert.equal(h.repository.one("SELECT COUNT(*) AS count FROM candidate_manifests").count, 1);
  assert.equal(accepted.receipt.artifactId, h.repository.one("SELECT snapshot_artifact_id FROM candidate_manifests").snapshot_artifact_id);
  await assert.rejects(
    h.coordinator.acceptCandidateManifest({
      opportunityId: `riq_opportunity_${digest("rotated")}`,
      authorityEnvelope: h.authority.sign(changedClaims),
      producerEnvelope: h.authority.sign(changed.claims, "producer")
    }),
    error => error.code === "route_iq_coordinator_field_not_allowlisted"
  );
});

test("rotating a trusted trigger boundary cannot duplicate a canonical opportunity", async () => {
  const h = await createHarness("rotated-trigger-boundary");
  const original = await triggerOpportunity(h);
  const rotatedClaims = operationClaims(h.identity, "trigger", TIMES.manifest, 10, {
    canonicalEventBoundarySha256: digest("rotated-trigger-boundary")
  }, h.scope);

  let firstConflict;
  await assert.rejects(
    h.coordinator.trigger({ authorityEnvelope: h.authority.sign(rotatedClaims) }),
    error => {
      firstConflict = error;
      return error instanceof RouteIqProspectiveCoordinatorConflictError
        && error.details.originalReceipt.artifactId === original.receipt.artifactId
        && error.details.overwritePerformed === false;
    }
  );
  await assert.rejects(
    h.coordinator.trigger({ authorityEnvelope: h.authority.sign(rotatedClaims) }),
    error => error instanceof RouteIqProspectiveCoordinatorConflictError
      && error.details.conflictArtifactId === firstConflict.details.conflictArtifactId
  );

  assert.equal(h.repository.one("SELECT state FROM opportunities").state, "EXCLUDED");
  assert.equal(h.repository.one("SELECT COUNT(*) AS count FROM opportunities").count, 1);
  assert.equal(h.repository.one("SELECT COUNT(*) AS count FROM operation_receipts WHERE operation_kind = 'trigger'").count, 1);
  assert.equal(h.repository.one("SELECT COUNT(*) AS count FROM operation_attempts WHERE operation_kind = 'trigger'").count, 2);
  assert.equal(h.repository.one("SELECT COUNT(*) AS count FROM lifecycle_events WHERE event_kind = 'TRIGGERED'").count, 1);
  assert.equal(h.repository.one("SELECT COUNT(*) AS count FROM lifecycle_events WHERE event_kind = 'CONFLICT_RECORDED'").count, 1);
});

test("Infrastructure-attested queue digest rejects a correctly rehashed signed candidate subset", async () => {
  const h = await createHarness("candidate-subset");
  await triggerOpportunity(h);
  const full = candidateManifest(h.identity, "candidate-subset-full");
  const subsetInput = {
    territoryId: full.claims.territoryId,
    evidenceCutoff: full.claims.evidenceCutoff,
    envelopeVersion: full.claims.envelopeVersion,
    producerSubsystem: full.claims.producerSubsystem,
    producerContractVersion: full.claims.producerContractVersion,
    schemaVersion: full.claims.schemaVersion,
    dataProjectionVersion: full.claims.dataProjectionVersion,
    candidates: [full.claims.candidates[0]],
    sourceManifest: [full.claims.sourceManifest.find(source => source.sourceRecordId === full.claims.candidates[0].sourceRecordIds[0])]
  };
  const subsetHashes = computeRouteIqCandidateManifestDigests(subsetInput);
  const subsetClaims = {
    ...full.claims,
    ...subsetInput,
    candidateCount: subsetHashes.candidateCount,
    sourceCount: subsetHashes.sourceCount,
    candidateManifestSha256: subsetHashes.candidateManifestSha256,
    sourceManifestSha256: subsetHashes.sourceManifestSha256,
    completeManifestSha256: subsetHashes.completeManifestSha256
  };
  const authorityClaims = operationClaims(h.identity, "candidate_manifest", TIMES.manifest, 11, {
    expectedCandidateCount: full.hashes.candidateCount,
    expectedSourceCount: full.hashes.sourceCount,
    expectedCompleteManifestSha256: full.hashes.completeManifestSha256
  }, h.scope);
  const result = await h.coordinator.acceptCandidateManifest({
    authorityEnvelope: h.authority.sign(authorityClaims),
    producerEnvelope: h.authority.sign(subsetClaims, "producer")
  });
  assert.equal(result.status, "excluded");
  assert.deepEqual(result.reasonCodes, ["candidate_manifest_incomplete_or_tampered"]);
  assert.equal(h.repository.one("SELECT state FROM opportunities").state, "EXCLUDED");
  assert.equal(h.repository.one("SELECT COUNT(*) AS count FROM candidate_manifests").count, 0);
});

test("missing or tampered candidate provenance and PII-like identifier values become privacy-redacted exclusions", async t => {
  await t.test("tampered producer signature", async () => {
    const h = await createHarness("tampered-producer");
    await triggerOpportunity(h);
    const result = await acceptManifest(h, {
      suffix: "tampered-producer",
      tamperProducer(envelope) {
        envelope.claims.sourceManifest[0].sourceRecordSha256 = digest("tampered-source");
      }
    });
    assert.equal(result.receipt.status, "excluded");
    assert.equal(h.repository.one("SELECT COUNT(*) AS count FROM candidate_manifests").count, 0);
  });

  await t.test("address-like candidate identifier", async () => {
    const h = await createHarness("pii-identifier");
    await triggerOpportunity(h);
    const manifest = candidateManifest(h.identity, "pii-identifier");
    manifest.claims.candidates[0].candidateId = "123 Main Street";
    const authorityClaims = operationClaims(h.identity, "candidate_manifest", TIMES.manifest, 11, {
      expectedCandidateCount: manifest.hashes.candidateCount,
      expectedSourceCount: manifest.hashes.sourceCount,
      expectedCompleteManifestSha256: manifest.hashes.completeManifestSha256
    }, h.scope);
    const result = await h.coordinator.acceptCandidateManifest({
      authorityEnvelope: h.authority.sign(authorityClaims),
      producerEnvelope: h.authority.sign(manifest.claims, "producer")
    });
    assert.equal(result.status, "excluded");
    const persisted = h.repository.query("SELECT canonical_json FROM lifecycle_events").map(row => row.canonical_json).join("\n");
    assert.doesNotMatch(persisted, /Main Street/i);
    assert.equal(h.repository.one("SELECT privacy_redacted FROM operation_attempts WHERE operation_kind = 'candidate_manifest'").privacy_redacted, 1);
  });
});

test("keyed seal boundary rejects missing, tampered, and unkeyed seals", async t => {
  for (const mode of ["missing", "tampered", "unkeyed"]) {
    await t.test(mode, async () => {
      const h = await createHarness(`seal-${mode}`);
      await triggerOpportunity(h);
      const snapshot = await acceptManifest(h, { suffix: `seal-${mode}` });
      let receipt;
      if (mode === "missing") {
        const claims = operationClaims(h.identity, "snapshot_seal_record", TIMES.snapshotSeal, 12, {}, h.scope);
        receipt = await h.coordinator.sealSnapshot({ authorityEnvelope: h.authority.sign(claims) });
      } else {
        const result = await sealSnapshot(h, snapshot, mode === "unkeyed"
          ? { unkeyed: true }
          : { tamperSeal(envelope) { envelope.claims.sealedRecordSha256 = digest("forged-seal"); } });
        receipt = result.receipt;
      }
      assert.equal(receipt.status, "excluded");
      assert.deepEqual(receipt.reasonCodes, ["keyed_seal_missing_or_tampered"]);
      assert.equal(h.repository.one("SELECT state FROM opportunities").state, "EXCLUDED");
      assert.equal(h.repository.one("SELECT COUNT(*) AS count FROM lifecycle_events WHERE event_kind = 'SNAPSHOT_SEALED'").count, 0);
    });
  }
});

test("synthetic, test, replay, and historical trigger origins remain permanently noncanonical", async t => {
  for (const origin of ["synthetic", "test", "demo", "fixture", "historical", "backfill", "replay"]) {
    await t.test(origin, async () => {
      const h = await createHarness(`origin-${origin}`);
      const result = await triggerOpportunity(h, { recordOrigin: origin });
      assert.equal(result.receipt.status, "excluded");
      assert.equal(result.receipt.state, "EXCLUDED");
      drainProjections(h);
      const last = h.repository.one("SELECT MAX(record_sequence) AS sequence FROM lifecycle_events");
      const projection = await readProjection(h, Number(last.sequence), TIMES.future);
      assert.equal(projection.record.projection.readinessEvidenceEligible, false);
      assert.equal(projection.record.projection.evidence.length, 0);
    });
  }
});

test("caller authoritative fields and cross-representative access fail before canonical mutation", async () => {
  const h = await createHarness("scope-isolation");
  const before = tableCounts(h.repository);
  const triggerClaims = operationClaims(h.identity, "trigger", TIMES.trigger, 10, {}, h.scope);
  await assert.rejects(
    h.coordinator.trigger({ authorityEnvelope: h.authority.unkeyed(triggerClaims) }),
    error => error.code === "route_iq_coordinator_keyed_authentication_required"
  );
  await assert.rejects(
    h.coordinator.trigger({
      authorityEnvelope: h.authority.sign(triggerClaims),
      authoritativeTimestamp: TIMES.trigger
    }),
    error => error.code === "route_iq_coordinator_field_not_allowlisted"
  );
  await assert.rejects(
    h.coordinator.trigger({
      authorityEnvelope: h.authority.sign(triggerClaims),
      receiptSha256: digest("caller-forged-receipt")
    }),
    error => error.code === "route_iq_coordinator_field_not_allowlisted"
  );
  assert.deepEqual(tableCounts(h.repository), before);

  const anthonyScope = scopeClaims("anthony");
  await assert.rejects(
    openRouteIqProspectiveCoordinator({
      repository: h.repository,
      authorityVerifier: h.authority.verifier,
      scopeEnvelope: h.authority.sign(anthonyScope)
    }),
    error => error.code === "route_iq_coordinator_route_scope_mismatch"
  );
  const anthonyClaims = operationClaims(h.identity, "trigger", TIMES.trigger, 10, {}, anthonyScope);
  await assert.rejects(
    h.coordinator.trigger({ authorityEnvelope: h.authority.sign(anthonyClaims) }),
    error => error.code === "route_iq_coordinator_cross_scope"
  );
  assert.deepEqual(tableCounts(h.repository), before);

  const trigger = await triggerOpportunity(h);
  drainProjections(h);
  const beforeRead = tableCounts(h.repository);
  const anthonyReadClaims = {
    purpose: "projection_read",
    workspaceId: anthonyScope.workspaceId,
    operatingProfileId: anthonyScope.operatingProfileId,
    representativeId: anthonyScope.representativeId,
    ...h.identity,
    asOfRecordSequence: trigger.receipt.recordSequence,
    asOfRecordTime: trigger.receipt.authoritativeRecordTime
  };
  await assert.rejects(
    h.coordinator.readCommittedProjectionAsOf({ authorityEnvelope: h.authority.sign(anthonyReadClaims) }),
    error => error.code === "route_iq_coordinator_projection_scope_invalid"
  );
  assert.deepEqual(tableCounts(h.repository), beforeRead);

  const anthony = await createHarness("scope-isolation", "anthony");
  const anthonyTrigger = await triggerOpportunity(anthony);
  assert.notEqual(anthony.coordinator.coordinatorId, h.coordinator.coordinatorId);
  assert.notEqual(anthonyTrigger.receipt.sessionId, trigger.receipt.sessionId);
  assert.notEqual(anthonyTrigger.receipt.opportunityId, trigger.receipt.opportunityId);
});

test("earlier or equal seal and exclusion times fail closed without backdating history", async t => {
  for (const [label, time] of [["earlier", TIMES.trigger], ["equal", TIMES.manifest]]) {
    await t.test(`snapshot seal ${label}`, async () => {
      const h = await createHarness(`seal-chronology-${label}`);
      await triggerOpportunity(h);
      const snapshot = await acceptManifest(h, { suffix: `seal-chronology-${label}` });
      const before = canonicalDatabaseDump(h.repository);
      await assert.rejects(
        sealSnapshot(h, snapshot, { time }),
        error => error.code === "route_iq_coordinator_chronology_not_monotonic"
      );
      assert.equal(canonicalDatabaseDump(h.repository), before);
      assert.equal(h.repository.one("SELECT state FROM opportunities").state, "SNAPSHOT_PENDING_SEAL");
      assert.equal(h.repository.one("SELECT last_record_time FROM opportunities").last_record_time, TIMES.manifest);
    });
  }

  await t.test("governed exclusion equal to prior state", async () => {
    const h = await createHarness("exclusion-chronology-equal");
    const lifecycle = await throughShadowSeal(h);
    const before = canonicalDatabaseDump(h.repository);
    await assert.rejects(
      linkAction(h, `riq_candidate_${digest("candidate-outside-manifest")}`, { time: TIMES.shadowSeal }),
      error => error.code === "route_iq_coordinator_chronology_not_monotonic"
    );
    assert.equal(canonicalDatabaseDump(h.repository), before);
    assert.equal(h.repository.one("SELECT state FROM opportunities").state, "SHADOW_DECISION_SEALED");
    assert.equal(h.repository.one("SELECT COUNT(*) AS count FROM lifecycle_events WHERE event_kind = 'EXCLUSION_RECORDED'").count, 0);
    assert.equal(h.repository.one("SELECT last_record_time FROM opportunities").last_record_time, lifecycle.shadowSeal.receipt.authoritativeRecordTime);
  });

  await t.test("same-time changed retry uses monotonic conflict governance time", async () => {
    const h = await createHarness("conflict-chronology-equal");
    await triggerOpportunity(h);
    await acceptManifest(h, { suffix: "conflict-chronology-original" });
    const competing = candidateManifest(h.identity, "conflict-chronology-competing");
    const competingClaims = operationClaims(h.identity, "candidate_manifest", TIMES.manifest, 11, {
      expectedCandidateCount: competing.hashes.candidateCount,
      expectedSourceCount: competing.hashes.sourceCount,
      expectedCompleteManifestSha256: competing.hashes.completeManifestSha256
    }, h.scope);
    await assert.rejects(
      h.coordinator.acceptCandidateManifest({
        authorityEnvelope: h.authority.sign(competingClaims),
        producerEnvelope: h.authority.sign(competing.claims, "producer")
      }),
      error => error instanceof RouteIqProspectiveCoordinatorConflictError
    );
    assert.equal(h.repository.one("SELECT state FROM opportunities").state, "EXCLUDED");
    assert.equal(h.repository.one("SELECT COUNT(*) AS count FROM operation_attempts WHERE operation_kind = 'candidate_manifest'").count, 2);
    const conflict = h.repository.one("SELECT * FROM lifecycle_events WHERE event_kind = 'CONFLICT_RECORDED'");
    assert.equal(conflict.authoritative_record_time, new Date(Date.parse(TIMES.manifest) + 1).toISOString());
    assert.equal(JSON.parse(conflict.canonical_json).payload.incomingAuthoritativeRecordTime, TIMES.manifest);
  });
});

test("projection rejects inconsistent as-of sequence and time pairs", async () => {
  const h = await createHarness("projection-as-of-pair");
  const lifecycle = await fullLifecycle(h);
  drainProjections(h);
  await assert.rejects(
    readProjection(h, lifecycle.evaluation.receipt.recordSequence, lifecycle.snapshot.receipt.authoritativeRecordTime),
    error => error.code === "route_iq_coordinator_projection_as_of_mismatch"
  );
  await assert.rejects(
    readProjection(h, lifecycle.snapshot.receipt.recordSequence, TIMES.future),
    error => error.code === "route_iq_coordinator_projection_as_of_mismatch"
  );
});

test("future exclusions do not leak into an earlier committed as-of projection", async () => {
  const h = await createHarness("future-leakage");
  const lifecycle = await throughShadowSeal(h);
  drainProjections(h);
  const earlier = await readProjection(
    h,
    lifecycle.shadowSeal.receipt.recordSequence,
    lifecycle.shadowSeal.receipt.authoritativeRecordTime
  );
  assert.equal(earlier.found, true);
  assert.equal(earlier.record.projection.state, "SHADOW_DECISION_SEALED");
  assert.equal(earlier.record.projection.readinessEvidenceEligible, true);
  assert.equal(earlier.record.projection.exclusions.length, 0);
  assert.ok(earlier.record.projection.evidence.some(item => item.evidenceKind === "prospective_opportunity_snapshot"));
  assert.doesNotMatch(stableJson(earlier.record.projection.evidence), /decisionSource/);

  const invalidAction = await linkAction(h, `riq_candidate_${digest("future-invalid-candidate")}`);
  assert.equal(invalidAction.receipt.status, "excluded");
  const latestSequence = Number(h.repository.one("SELECT MAX(record_sequence) AS sequence FROM lifecycle_events").sequence);
  await assert.rejects(
    readProjection(h, latestSequence, TIMES.future),
    error => error.code === "route_iq_coordinator_projection_recovery_pending"
  );
  const earlierWhileGovernancePending = await readProjection(
    h,
    lifecycle.shadowSeal.receipt.recordSequence,
    lifecycle.shadowSeal.receipt.authoritativeRecordTime
  );
  assert.deepEqual(earlierWhileGovernancePending, earlier);
  drainProjections(h);
  const latest = await readProjection(h, latestSequence, TIMES.future);
  assert.equal(latest.record.projection.state, "EXCLUDED");
  assert.equal(latest.record.projection.readinessEvidenceEligible, false);
  assert.equal(latest.record.projection.evidence.length, 0);
  assert.equal(latest.record.projection.exclusions.at(-1).reason, "governed_prospective_exclusion");

  const earlierAgain = await readProjection(
    h,
    lifecycle.shadowSeal.receipt.recordSequence,
    lifecycle.shadowSeal.receipt.authoritativeRecordTime
  );
  assert.deepEqual(earlierAgain, earlier);
});

test("outcome chronology and corrections are append-only and candidate-bound", async t => {
  await t.test("outcome before action", async () => {
    const h = await createHarness("outcome-before-action");
    const lifecycle = await throughShadowSeal(h);
    const result = await linkOutcome(h, lifecycle.snapshot.manifest.candidateIds[0]);
    assert.equal(result.receipt.status, "excluded");
    assert.deepEqual(result.receipt.reasonCodes, ["invalid_state_transition"]);
    assert.equal(h.repository.one("SELECT COUNT(*) AS count FROM lifecycle_events WHERE event_kind = 'OUTCOME_LINKED'").count, 0);
  });

  await t.test("correction preserves outcome", async () => {
    const h = await createHarness("correction-history");
    const lifecycle = await fullLifecycle(h);
    const claims = operationClaims(h.identity, "correction", TIMES.correction, 17, {
      targetKind: "outcome",
      targetClientEventSequence: lifecycle.outcome.claims.clientEventSequence,
      replacement: {
        evaluatedCandidateId: lifecycle.snapshot.manifest.candidateIds[0],
        observedOutcome: { status: "observed", value: false }
      },
      reasonCode: "verified_followup"
    }, h.scope);
    const receipt = await h.coordinator.appendCorrection({ authorityEnvelope: h.authority.sign(claims) });
    assert.match(receipt.artifactId, /^riq_correction_[a-f0-9]{64}$/);
    assert.equal(h.repository.one("SELECT COUNT(*) AS count FROM lifecycle_events WHERE event_kind = 'OUTCOME_LINKED'").count, 1);
    assert.equal(h.repository.one("SELECT COUNT(*) AS count FROM lifecycle_events WHERE event_kind = 'CORRECTION_APPENDED'").count, 1);
    assert.equal(h.repository.one("SELECT state FROM opportunities").state, "EVALUATED");
  });
});

test("artifact registry prevents cross-kind reuse and poisoned committed projections fail closed", async () => {
  const h = await createHarness("artifact-poison");
  const lifecycle = await throughShadowSeal(h);
  drainProjections(h);
  const artifactId = lifecycle.shadowSeal.receipt.artifactId;
  assert.throws(() => h.repository.execute(`
    INSERT INTO artifact_registry (artifact_id, artifact_kind, opportunity_id, registered_sequence, registered_at)
    VALUES (?, 'outcome', ?, ?, ?)
  `, [artifactId, lifecycle.shadowSeal.receipt.opportunityId, 999, TIMES.future]));

  h.repository.db.exec("DROP TRIGGER projection_artifacts_no_update");
  h.repository.db.prepare("UPDATE projection_artifacts SET projection_json = ? WHERE projection_id = (SELECT projection_id FROM projection_artifacts ORDER BY as_of_record_sequence DESC LIMIT 1)")
    .run("{poison");
  await assert.rejects(
    readProjection(h, lifecycle.shadowSeal.receipt.recordSequence, lifecycle.shadowSeal.receipt.authoritativeRecordTime),
    error => error.code === "route_iq_coordinator_poison_record"
  );
});

test("existing chronological projection consumes only committed SQLite coordinator evidence", async () => {
  const h = await createHarness("chronological-integration");
  const lifecycle = await fullLifecycle(h);
  drainProjections(h);
  const coordinatorProjection = await readProjection(
    h,
    lifecycle.evaluation.receipt.recordSequence,
    lifecycle.evaluation.receipt.authoritativeRecordTime
  );
  const projected = projectRouteIqChronologicalEvidence({
    archiveRecord: committedHistoricalArchive(),
    prospectiveCoordinatorProjectionRecord: coordinatorProjection.record,
    decisionTimestamp: TIMES.correction,
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    representativeId: "cruz"
  });
  const prospective = projected.evidence.filter(item => item.evidenceKind.startsWith("prospective_"));
  assert.deepEqual(prospective.map(item => item.evidenceKind), [
    "prospective_opportunity_snapshot",
    "prospective_opportunity_action",
    "prospective_opportunity_outcome"
  ]);
  assert.ok(prospective.every(item => item.provenance.storageAuthority === "sqlite_durable_object_coordinator"));
  assert.ok(prospective.every(item => item.context.territoryId === h.identity.territoryId));
  assert.equal(prospective.every(item => item.evidenceTimestamp < projected.decisionTimestamp), true);
  assert.equal(prospective.find(item => item.evidenceKind === "prospective_opportunity_snapshot").payload.manifest.candidates.some(candidate => Object.hasOwn(candidate, "decisionSource")), false);
  assert.equal(prospective.find(item => item.evidenceKind === "prospective_opportunity_action").payload.decisionSource.scoreable, false);

  const tampered = clone(coordinatorProjection.record);
  tampered.commit.projectionSha256 = digest("tampered-projection");
  assert.throws(() => projectRouteIqChronologicalEvidence({
    archiveRecord: committedHistoricalArchive(),
    prospectiveCoordinatorProjectionRecord: tampered,
    decisionTimestamp: TIMES.correction,
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    representativeId: "cruz"
  }), error => error.code === "field_session_prospective_coordinator_commit_invalid");

  const pending = await createHarness("unsealed-integration");
  const trigger = await triggerOpportunity(pending);
  drainProjections(pending);
  const unsealed = await readProjection(pending, trigger.receipt.recordSequence, trigger.receipt.authoritativeRecordTime);
  const unsealedProjection = projectRouteIqChronologicalEvidence({
    archiveRecord: committedHistoricalArchive(),
    prospectiveCoordinatorProjectionRecord: unsealed.record,
    decisionTimestamp: TIMES.manifest,
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    representativeId: "cruz"
  });
  assert.equal(unsealedProjection.evidence.some(item => item.evidenceKind.startsWith("prospective_")), false);
  assert.ok(unsealedProjection.exclusions.some(item => item.reason === "unsealed_or_incomplete_at_cutoff"));
});

test("every SQLite persistence boundary rolls back canonical state and leaves recoverable outbox work", async t => {
  await t.test("trigger transaction", async () => {
    const boundaries = await assertEveryMutationBoundaryAtomic({
      label: "trigger",
      setup: () => createHarness("crash-trigger"),
      invoke: h => triggerOpportunity(h)
    });
    assert.ok(boundaries >= 8);
  });

  await t.test("candidate manifest transaction", async () => {
    const boundaries = await assertEveryMutationBoundaryAtomic({
      label: "candidate manifest",
      setup: async () => {
        const h = await createHarness("crash-manifest");
        await triggerOpportunity(h);
        return h;
      },
      invoke: h => acceptManifest(h, { suffix: "crash-manifest" })
    });
    assert.ok(boundaries >= 8);
  });

  await t.test("snapshot seal transaction", async () => {
    const boundaries = await assertEveryMutationBoundaryAtomic({
      label: "snapshot seal",
      setup: async () => {
        const h = await createHarness("crash-seal");
        await triggerOpportunity(h);
        h.snapshot = await acceptManifest(h, { suffix: "crash-seal" });
        return h;
      },
      invoke: h => sealSnapshot(h, h.snapshot)
    });
    assert.ok(boundaries >= 7);
  });

  await t.test("shared action transition", async () => {
    const boundaries = await assertEveryMutationBoundaryAtomic({
      label: "action transition",
      setup: async () => {
        const h = await createHarness("crash-action");
        h.lifecycle = await throughShadowSeal(h);
        return h;
      },
      invoke: h => linkAction(h, h.lifecycle.snapshot.manifest.candidateIds[0])
    });
    assert.ok(boundaries >= 7);
  });

  await t.test("governed exclusion transaction", async () => {
    const boundaries = await assertEveryMutationBoundaryAtomic({
      label: "governed exclusion",
      setup: async () => {
        const h = await createHarness("crash-exclusion");
        h.lifecycle = await throughShadowSeal(h);
        return h;
      },
      invoke: h => linkAction(h, `riq_candidate_${digest("crash-exclusion-candidate")}`)
    });
    assert.ok(boundaries >= 7);
  });

  await t.test("changed-retry conflict transaction", async () => {
    const boundaries = await assertEveryMutationBoundaryAtomic({
      label: "changed retry conflict",
      setup: async () => {
        const h = await createHarness("crash-conflict");
        await triggerOpportunity(h);
        await acceptManifest(h, { suffix: "crash-conflict-original" });
        h.competingManifest = candidateManifest(h.identity, "crash-conflict-competing");
        h.competingClaims = operationClaims(h.identity, "candidate_manifest", TIMES.snapshotSeal, 11, {
          expectedCandidateCount: h.competingManifest.hashes.candidateCount,
          expectedSourceCount: h.competingManifest.hashes.sourceCount,
          expectedCompleteManifestSha256: h.competingManifest.hashes.completeManifestSha256
        }, h.scope);
        return h;
      },
      invoke: async h => {
        try {
          await h.coordinator.acceptCandidateManifest({
            authorityEnvelope: h.authority.sign(h.competingClaims),
            producerEnvelope: h.authority.sign(h.competingManifest.claims, "producer")
          });
        } catch (error) {
          if (error instanceof RouteIqProspectiveCoordinatorConflictError) return error;
          throw error;
        }
        assert.fail("changed retry must conflict");
      }
    });
    assert.ok(boundaries >= 6);
  });

  await t.test("correction transaction", async () => {
    const boundaries = await assertEveryMutationBoundaryAtomic({
      label: "correction",
      setup: async () => {
        const h = await createHarness("crash-correction");
        h.lifecycle = await fullLifecycle(h);
        h.correctionClaims = operationClaims(h.identity, "correction", TIMES.correction, 17, {
          targetKind: "outcome",
          targetClientEventSequence: h.lifecycle.outcome.claims.clientEventSequence,
          replacement: {
            evaluatedCandidateId: h.lifecycle.snapshot.manifest.candidateIds[0],
            observedOutcome: { status: "observed", value: false }
          },
          reasonCode: "verified_followup"
        }, h.scope);
        return h;
      },
      invoke: h => h.coordinator.appendCorrection({ authorityEnvelope: h.authority.sign(h.correctionClaims) })
    });
    assert.ok(boundaries >= 7);
  });

  await t.test("projection artifact and commit-last marker", async () => {
    const boundaries = await assertEveryMutationBoundaryAtomic({
      label: "projection recovery",
      setup: async () => {
        const h = await createHarness("crash-projection");
        await triggerOpportunity(h);
        return h;
      },
      invoke: async h => h.coordinator.recoverNextProjection()
    });
    assert.equal(boundaries, 4);
    const h = await createHarness("projection-retry-proof");
    await triggerOpportunity(h);
    h.repository.armCrash(4);
    assert.throws(() => h.coordinator.recoverNextProjection(), /test_only_sqlite_crash_/);
    h.repository.disarmCrash();
    assert.equal(h.repository.one("SELECT COUNT(*) AS count FROM projection_outbox").count, 1);
    assert.equal(h.repository.one("SELECT COUNT(*) AS count FROM projection_artifacts").count, 0);
    assert.equal(h.repository.one("SELECT COUNT(*) AS count FROM projection_commits").count, 0);
    const recovered = h.coordinator.recoverNextProjection();
    assert.equal(recovered.status, "committed");
    assert.equal(h.repository.one("SELECT COUNT(*) AS count FROM projection_commits").count, 1);
  });
});
