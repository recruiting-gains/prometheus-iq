import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

import {
  FieldSessionArchiveError,
  fieldSessionRetentionDeletionStateStorageKey,
  fieldSessionStorageKeys,
  persistRouteIqFieldSessionArchive,
  readRouteIqFieldSessionArchive
} from "../data/route-iq-field-sessions-v1/route-iq-field-session-archive.mjs";
import {
  RouteIqRetentionDeletionError,
  createRouteIqRetentionDeletionPlan,
  executeRouteIqRetentionDeletion,
  routeIqRetentionDeletionPlanVersion,
  routeIqRetentionMaintenanceCapabilityVersion,
  validateRouteIqRetentionDeletionPlan
} from "../data/route-iq-field-sessions-v1/route-iq-retention-deletion-runtime.mjs";
import {
  calculateRouteIqRetentionBoundary,
  openRouteIqRetentionGovernanceLedger,
  readRouteIqRetentionDeletionStatus,
  readRouteIqRetentionLedgerRecords,
  routeIqRetentionDeletionEventVersion
} from "../data/route-iq-field-sessions-v1/route-iq-retention-governance.mjs";
import {
  initializeRouteIqProspectiveCoordinatorSchema
} from "../data/route-iq-field-sessions-v1/route-iq-prospective-shadow-coordinator.mjs";
import {
  createRetentionAuthority,
  createRetentionStore,
  legalHoldAuthorityClaims,
  retentionOperationAuthorityClaims,
  retentionSha256
} from "./route-iq-retention-test-support.mjs";

const SESSION_ID = "route-iq-field-session-fitness-connection-fitness-cruz-2026-01-01";
const SUBJECT_SOURCE = createHash("sha256").update("retention-runtime-raw-source").digest("hex");
const SUBJECT = Object.freeze({
  workspaceId: "fitness_connection",
  operatingProfileId: "fitness",
  recordClass: "field_session_raw_evidence",
  sourceRecordSha256: SUBJECT_SOURCE
});
const CREATED_AT = "2026-01-01T00:00:00.000Z";
const EXPIRES_AT = "2027-07-01T00:00:00.000Z";

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

class MaintenanceKvStore {
  constructor() {
    this.data = new Map();
    this.deleteCount = 0;
    this.failDeleteAt = null;
    this.retentionMaintenanceCapability = routeIqRetentionMaintenanceCapabilityVersion;
  }

  async get(key) {
    return this.data.get(key) ?? null;
  }

  async put(key, value) {
    this.data.set(key, String(value));
  }

  async delete(key) {
    this.deleteCount += 1;
    if (this.failDeleteAt === this.deleteCount) throw new Error("test_only_kv_delete_failure");
    this.data.delete(key);
  }

  async list({ prefix = "" } = {}) {
    return {
      keys: [...this.data.keys()].filter(key => key.startsWith(prefix)).sort().map(name => ({ name })),
      list_complete: true
    };
  }
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

  close() {
    this.db.close();
  }
}

function archiveBytes(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function seedArchive(store, { sourceRecordSha256 = SUBJECT_SOURCE } = {}) {
  const keys = fieldSessionStorageKeys(SUBJECT.workspaceId, SESSION_ID);
  const historyEntries = [
    `${keys.historyRoot}/representatives/cruz/sessions/${SESSION_ID}.json`,
    `${keys.historyRoot}/categories/synthetic/sessions/${SESSION_ID}.json`
  ];
  const raw = sourceRecordSha256 === SUBJECT_SOURCE ? "retention-runtime-raw-source" : "different-source";
  const artifacts = {
    [keys.raw]: raw,
    [keys.normalized]: archiveBytes({
      workspaceId: SUBJECT.workspaceId,
      operatingProfileId: SUBJECT.operatingProfileId,
      sessionId: SESSION_ID,
      verifiedFields: { representative: { id: "cruz" } }
    }),
    [keys.calculated]: archiveBytes({
      workspaceId: SUBJECT.workspaceId,
      operatingProfileId: SUBJECT.operatingProfileId,
      sessionId: SESSION_ID,
      visits: 1
    }),
    [keys.stressTestEvidence]: archiveBytes({
      workspaceId: SUBJECT.workspaceId,
      operatingProfileId: SUBJECT.operatingProfileId,
      sessionId: SESSION_ID,
      evidence: []
    }),
    [keys.historyUpdates]: archiveBytes({
      workspaceId: SUBJECT.workspaceId,
      operatingProfileId: SUBJECT.operatingProfileId,
      sessionId: SESSION_ID,
      historyEntryCount: historyEntries.length
    }),
    [historyEntries[0]]: archiveBytes({
      workspaceId: SUBJECT.workspaceId,
      sessionId: SESSION_ID,
      recordKind: "representative_history"
    }),
    [historyEntries[1]]: archiveBytes({
      workspaceId: SUBJECT.workspaceId,
      sessionId: SESSION_ID,
      recordKind: "category_history"
    })
  };
  for (const [key, value] of Object.entries(artifacts)) await store.put(key, value);
  await store.put(keys.commit, archiveBytes({
    schemaVersion: "route-iq-field-session-archive-v1",
    sessionId: SESSION_ID,
    workspaceId: SUBJECT.workspaceId,
    operatingProfileId: SUBJECT.operatingProfileId,
    rawSha256: sourceRecordSha256,
    rawByteLength: Buffer.byteLength(raw),
    persistedAt: "2026-01-01T01:00:00.000Z",
    status: "committed",
    appendOnlyRawEvidence: true,
    keys: { ...keys, historyEntries }
  }));
  return { keys, historyEntries };
}

async function retentionContext({ shortenedExpiry = null } = {}) {
  const authority = createRetentionAuthority();
  const store = createRetentionStore();
  let customerOverrideAuthority = null;
  if (shortenedExpiry) {
    const unsigned = {
      subject: SUBJECT,
      customerAccountId: "fitness_connection",
      createdAt: CREATED_AT,
      customerContractExpiresAt: shortenedExpiry
    };
    const policyMaximumExpiresAt = "2027-07-01T00:00:00.000Z";
    customerOverrideAuthority = authority.sign({
      purpose: "customer_retention_override",
      authorityVersion: "route-iq-customer-retention-override-authority-v1",
      subject: SUBJECT,
      customerAccountId: "fitness_connection",
      sourceCreatedAt: CREATED_AT,
      customerContractExpiresAt: shortenedExpiry,
      policyMaximumExpiresAt
    }, { authority: "prometheus_data_customer_contract_authority", seed: `shorten:${shortenedExpiry}` });
  }
  const boundary = calculateRouteIqRetentionBoundary({
    subject: SUBJECT,
    customerAccountId: "fitness_connection",
    createdAt: CREATED_AT,
    customerContractExpiresAt: shortenedExpiry,
    customerOverrideAuthority
  }, { authorityVerifier: authority.verifier });
  const ledger = await openRouteIqRetentionGovernanceLedger({
    store,
    subject: SUBJECT,
    authorityVerifier: authority.verifier
  });
  return { authority, store, boundary, ledger };
}

async function createPlan(context, archiveStore, overrides = {}, options = {}) {
  return createRouteIqRetentionDeletionPlan({
    workspaceId: SUBJECT.workspaceId,
    operatingProfileId: SUBJECT.operatingProfileId,
    representativeId: "cruz",
    sessionId: SESSION_ID,
    recordClass: SUBJECT.recordClass,
    sourceRecordSha256: SUBJECT.sourceRecordSha256,
    retentionBoundary: context.boundary,
    authoritativeEvaluationTime: EXPIRES_AT,
    mode: "execution",
    ...overrides
  }, {
    archiveStore,
    coordinatorRepositories: [],
    retentionGovernanceLedger: context.ledger,
    maximumArtifactCount: 1000,
    ...options
  });
}

function signExecution(context, plan, requestedExecutionTime, seed = "execute") {
  const unsigned = {
    operation: "physical_deletion",
    requestedAt: requestedExecutionTime,
    subject: SUBJECT,
    retentionBoundary: context.boundary,
    administrativeDispositionTarget: null,
    deletionPlanSha256: plan.planSha256
  };
  return context.authority.sign(retentionOperationAuthorityClaims(unsigned), { seed });
}

async function execute(context, store, plan, requestedExecutionTime, overrides = {}, options = {}) {
  return executeRouteIqRetentionDeletion({
    plan,
    requestedExecutionTime,
    authorization: signExecution(context, plan, requestedExecutionTime, overrides.seed || "execute"),
    maximumOperationCount: overrides.maximumOperationCount || 100
  }, {
    archiveMaintenanceStore: store,
    coordinatorRepositories: [],
    retentionGovernanceLedger: context.ledger,
    ...options
  });
}

async function appendHold(context, eventType, recordedAt, seed) {
  return context.ledger.appendLegalHold({
    eventType,
    recordedAt,
    authority: context.authority.sign(legalHoldAuthorityClaims({ eventType, recordedAt, subject: SUBJECT }), {
      authority: "prometheus_founder",
      seed
    })
  });
}

function seedCoordinator(repository) {
  initializeRouteIqProspectiveCoordinatorSchema(repository);
  const sessionId = `riq_session_${"1".repeat(64)}`;
  const opportunityId = `riq_opportunity_${"2".repeat(64)}`;
  const actionId = `riq_action_${"3".repeat(64)}`;
  const linkId = `riq_field_outcome_${"4".repeat(64)}`;
  const contextId = `riq_evaluation_context_${"5".repeat(64)}`;
  const reconciliationId = `riq_reconciliation_${"6".repeat(64)}`;
  repository.execute("INSERT INTO coordinator_meta VALUES (1, ?, ?, ?, ?, ?, ?, ?, 1)", [
    "route-iq-prospective-shadow-coordinator-sqlite-v1",
    `riq_coord_${"7".repeat(64)}`,
    SUBJECT.workspaceId,
    SUBJECT.operatingProfileId,
    "cruz",
    "route-iq-prospective-shadow-registry-v1",
    "2026-01-01T00:00:00.000Z"
  ]);
  repository.execute("INSERT INTO canonical_sessions VALUES (?, ?, ?, ?, 0, 1, ?)", [
    sessionId,
    `riq_coord_${"7".repeat(64)}`,
    "8".repeat(64),
    `riq_territory_${"9".repeat(64)}`,
    "2026-01-01T00:00:00.000Z"
  ]);
  repository.execute("INSERT INTO opportunities VALUES (?, ?, ?, ?, ?, 'next_stop', 0, ?, ?, 'ACTION_LINKED', 1, NULL, 2, ?)", [
    opportunityId,
    `riq_coord_${"7".repeat(64)}`,
    sessionId,
    "8".repeat(64),
    `riq_territory_${"9".repeat(64)}`,
    "a".repeat(64),
    "b".repeat(64),
    "2026-01-01T00:00:02.000Z"
  ]);
  for (const [artifactId, kind, sequence] of [
    [actionId, "representative_action", 1],
    [linkId, "field_session_outcome_evidence", 2],
    [contextId, "field_session_evaluation_context", 3],
    [reconciliationId, "field_session_reconciliation_receipt", 4]
  ]) {
    repository.execute("INSERT INTO artifact_registry VALUES (?, ?, ?, ?, ?)", [
      artifactId,
      kind,
      artifactId === reconciliationId ? null : opportunityId,
      sequence,
      `2026-01-01T00:00:0${sequence}.000Z`
    ]);
  }
  const lifecycle = (artifactId, eventKind, sequence) => repository.execute(`
    INSERT INTO lifecycle_events VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, 0, 'off')
  `, [
    artifactId,
    eventKind === "ACTION_LINKED" ? "representative_action" : "field_session_outcome_evidence",
    eventKind,
    `riq_coord_${"7".repeat(64)}`,
    sessionId,
    opportunityId,
    `riq_idempotency_${String(sequence).repeat(64).slice(0, 64)}`,
    String(sequence).repeat(64).slice(0, 64),
    String(sequence + 1).repeat(64).slice(0, 64),
    sequence,
    `2026-01-01T00:00:0${sequence}.000Z`,
    stableJson({ artifactId, eventKind }),
    createHash("sha256").update(stableJson({ artifactId, eventKind })).digest("hex")
  ]);
  lifecycle(actionId, "ACTION_LINKED", 1);
  lifecycle(linkId, "FIELD_SESSION_OUTCOME_EVIDENCE_LINKED", 2);
  const evidence = stableJson({ source: SUBJECT_SOURCE, synthetic: true });
  repository.execute(`
    INSERT INTO field_session_outcome_links VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 2, ?)
  `, [
    linkId,
    opportunityId,
    actionId,
    `riq_candidate_${"c".repeat(64)}`,
    "d".repeat(64),
    SUBJECT_SOURCE,
    "e".repeat(64),
    "f".repeat(64),
    "2026-01-01T00:00:01.000Z",
    "2026-01-01T01:00:00.000Z",
    evidence,
    createHash("sha256").update(evidence).digest("hex"),
    "2026-01-01T00:00:02.000Z"
  ]);
  const contextJson = stableJson({ synthetic: true });
  repository.execute("INSERT INTO field_session_evaluation_contexts VALUES (?, ?, ?, ?, ?, ?, 3, ?)", [
    contextId,
    linkId,
    opportunityId,
    createHash("sha256").update(evidence).digest("hex"),
    contextJson,
    createHash("sha256").update(contextJson).digest("hex"),
    "2026-01-01T00:00:03.000Z"
  ]);
  const receipt = stableJson({ linked: [{ opportunityId }], exclusions: [] });
  repository.execute("INSERT INTO field_session_reconciliation_receipts VALUES (?, ?, ?, ?, ?, ?, 4, ?)", [
    reconciliationId,
    "d".repeat(64),
    SUBJECT_SOURCE,
    "e".repeat(64),
    receipt,
    createHash("sha256").update(receipt).digest("hex"),
    "2026-01-01T00:00:04.000Z"
  ]);
  return { sessionId, opportunityId };
}

test("deletion plan is deterministic, content-minimal, and dry run performs zero mutation", async () => {
  const store = new MaintenanceKvStore();
  await seedArchive(store);
  const context = await retentionContext();
  const plan = await createPlan(context, store, { mode: "dry_run" });
  assert.equal(plan.schemaVersion, routeIqRetentionDeletionPlanVersion);
  assert.deepEqual(validateRouteIqRetentionDeletionPlan(plan), plan);
  assert.equal(plan.totalArtifactCount, 8);
  assert.equal(plan.artifacts.every(artifact => !Object.hasOwn(artifact, "value")), true);
  assert.equal(stableJson(plan).includes("retention-runtime-raw-source"), false);
  const before = new Map(store.data);
  await assert.rejects(
    () => executeRouteIqRetentionDeletion({
      plan,
      requestedExecutionTime: EXPIRES_AT,
      authorization: {},
      maximumOperationCount: 100
    }, {
      archiveMaintenanceStore: store,
      coordinatorRepositories: [],
      retentionGovernanceLedger: context.ledger
    }),
    error => error.code === "route_iq_retention_dry_run_not_authorized"
  );
  assert.deepEqual(store.data, before);
});

test("expiry is exclusive and an authorized exact-boundary fixture deletion removes every manifest artifact", async () => {
  const store = new MaintenanceKvStore();
  const seeded = await seedArchive(store);
  const context = await retentionContext();
  const beforePlan = await createPlan(context, store, {
    authoritativeEvaluationTime: "2027-06-30T23:59:59.999Z"
  });
  const blocked = await execute(
    context,
    store,
    beforePlan,
    "2027-06-30T23:59:59.999Z",
    { seed: "before-expiry" }
  );
  assert.equal(blocked.state, "DELETION_BLOCKED");
  assert.deepEqual(blocked.reasons, ["retention_not_expired"]);
  assert.equal(store.deleteCount, 0);

  const plan = await createPlan(context, store);
  const result = await execute(context, store, plan, EXPIRES_AT, { seed: "exact-expiry" });
  assert.equal(result.state, "DELETION_COMPLETED");
  assert.equal(result.completedArtifactCount, plan.totalArtifactCount);
  for (const artifact of plan.artifacts) assert.equal(await store.get(artifact.key), null);
  for (const historyKey of seeded.historyEntries) assert.equal(await store.get(historyKey), null);
  const unavailable = await readRouteIqFieldSessionArchive({
    workspaceId: SUBJECT.workspaceId,
    operatingProfileId: SUBJECT.operatingProfileId,
    sessionId: SESSION_ID
  }, { store });
  assert.deepEqual(unavailable.status, "retention_deleted");
  assert.equal(unavailable.found, false);
  const deletionStateText = await store.get(fieldSessionRetentionDeletionStateStorageKey(SUBJECT.workspaceId, SESSION_ID));
  assert.equal(JSON.parse(deletionStateText).state, "DELETION_COMPLETED");
  await assert.rejects(
    () => persistRouteIqFieldSessionArchive({
      sessionId: SESSION_ID,
      rawReportText: "retention-runtime-raw-source",
      rawSha256: SUBJECT_SOURCE,
      normalizedRecord: {
        workspaceId: SUBJECT.workspaceId,
        operatingProfileId: SUBJECT.operatingProfileId,
        sessionId: SESSION_ID,
        verifiedFields: { representative: { id: "cruz" } }
      },
      calculatedMetrics: { workspaceId: SUBJECT.workspaceId, sessionId: SESSION_ID },
      stressTestEvidence: { workspaceId: SUBJECT.workspaceId, sessionId: SESSION_ID },
      historyUpdates: { workspaceId: SUBJECT.workspaceId, sessionId: SESSION_ID }
    }, { store }),
    error => error instanceof FieldSessionArchiveError
      && error.code === "field_session_retention_deletion_lifecycle_required"
  );
  const retry = await execute(context, store, plan, EXPIRES_AT, { seed: "exact-expiry" });
  assert.equal(retry.idempotent, true);
  assert.equal(retry.completionReceiptSha256, result.completionReceiptSha256);
});

test("customer shortening, active holds, missing authority, and released holds enforce exact deletion eligibility", async () => {
  const shortened = "2026-12-01T00:00:00.000Z";
  const shortenedStore = new MaintenanceKvStore();
  await seedArchive(shortenedStore);
  const shortenedContext = await retentionContext({ shortenedExpiry: shortened });
  const shortenedPlan = await createPlan(shortenedContext, shortenedStore, {
    authoritativeEvaluationTime: shortened
  });
  assert.equal(shortenedPlan.retentionBoundary.expiresAt, shortened);
  assert.equal((await execute(shortenedContext, shortenedStore, shortenedPlan, shortened, {
    seed: "shortened"
  })).state, "DELETION_COMPLETED");

  const heldStore = new MaintenanceKvStore();
  await seedArchive(heldStore);
  const heldContext = await retentionContext();
  await appendHold(heldContext, "LEGAL_HOLD_APPLIED", "2027-06-01T00:00:00.000Z", "hold");
  await assert.rejects(
    () => createPlan(heldContext, heldStore),
    error => error.code === "route_iq_retention_legal_hold_active"
  );
  await appendHold(heldContext, "LEGAL_HOLD_RELEASED", "2027-06-30T00:00:00.000Z", "release");
  const releasedPlan = await createPlan(heldContext, heldStore);
  assert.equal(releasedPlan.retentionBoundary.expiresAt, EXPIRES_AT);
  assert.equal((await execute(heldContext, heldStore, releasedPlan, EXPIRES_AT, {
    seed: "released"
  })).state, "DELETION_COMPLETED");

  await assert.rejects(
    () => createRouteIqRetentionDeletionPlan({
      workspaceId: SUBJECT.workspaceId,
      operatingProfileId: SUBJECT.operatingProfileId,
      representativeId: "cruz",
      sessionId: SESSION_ID,
      recordClass: SUBJECT.recordClass,
      sourceRecordSha256: SUBJECT.sourceRecordSha256,
      retentionBoundary: heldContext.boundary,
      authoritativeEvaluationTime: EXPIRES_AT,
      mode: "execution"
    }, {
      archiveStore: heldStore,
      coordinatorRepositories: [],
      retentionGovernanceLedger: null,
      maximumArtifactCount: 1000
    }),
    error => /ledger|required/i.test(error.message)
  );
});

test("changed legal hold, cross-representative scope, changed hashes, and unmanifested artifacts fail closed", async () => {
  const changedHoldStore = new MaintenanceKvStore();
  await seedArchive(changedHoldStore);
  const changedHoldContext = await retentionContext();
  const plan = await createPlan(changedHoldContext, changedHoldStore);
  await appendHold(changedHoldContext, "LEGAL_HOLD_APPLIED", "2027-07-01T00:00:00.001Z", "changed-hold");
  await assert.rejects(
    () => execute(changedHoldContext, changedHoldStore, plan, "2027-07-01T00:00:00.002Z", {
      seed: "changed-hold-execute"
    }),
    error => error.code === "route_iq_retention_legal_hold_active"
  );
  assert.equal(changedHoldStore.deleteCount, 0);

  const store = new MaintenanceKvStore();
  const seeded = await seedArchive(store);
  const context = await retentionContext();
  await assert.rejects(
    () => createPlan(context, store, { representativeId: "different-representative" }),
    error => error.code === "route_iq_retention_source_scope_mismatch"
  );
  const tamperPlan = await createPlan(context, store);
  await store.put(seeded.keys.calculated, "tampered");
  await assert.rejects(
    () => execute(context, store, tamperPlan, EXPIRES_AT, { seed: "tamper" }),
    error => new Set([
      "route_iq_retention_artifact_graph_changed",
      "field_session_stored_artifact_corrupt"
    ]).has(error.code)
  );
  assert.equal(store.deleteCount, 0);

  const unmanifestedStore = new MaintenanceKvStore();
  await seedArchive(unmanifestedStore);
  await unmanifestedStore.put(`${seeded.keys.base}/unexpected-derived.json`, "{}");
  const unmanifestedContext = await retentionContext();
  await assert.rejects(
    () => createPlan(unmanifestedContext, unmanifestedStore),
    error => error.code === "route_iq_retention_unmanifested_artifact_blocked"
  );

  const missingStore = new MaintenanceKvStore();
  const missingSeed = await seedArchive(missingStore);
  await missingStore.delete(missingSeed.historyEntries[0]);
  const missingContext = await retentionContext();
  await assert.rejects(
    () => createPlan(missingContext, missingStore),
    error => new Set([
      "field_session_history_index_incomplete",
      "route_iq_retention_unmanifested_artifact_blocked"
    ]).has(error.code)
  );
});

test("partial non-atomic deletion stays unavailable, resumes deterministically, and emits content-free receipts", async () => {
  const store = new MaintenanceKvStore();
  await seedArchive(store);
  const context = await retentionContext();
  const plan = await createPlan(context, store);
  const partial = await execute(context, store, plan, EXPIRES_AT, {
    seed: "partial",
    maximumOperationCount: 2
  });
  assert.equal(partial.state, "DELETION_IN_PROGRESS");
  assert.equal(partial.completedArtifactCount, 2);
  assert.match(partial.continuationCursor, /^riq_retention_cursor_[a-f0-9]{64}$/);
  assert.equal(readRouteIqRetentionDeletionStatus(context.ledger, SUBJECT).state, "DELETION_IN_PROGRESS");
  const unavailable = await readRouteIqFieldSessionArchive({
    workspaceId: SUBJECT.workspaceId,
    operatingProfileId: SUBJECT.operatingProfileId,
    sessionId: SESSION_ID
  }, { store });
  assert.equal(unavailable.status, "retention_deletion_in_progress");
  const resumed = await execute(context, store, plan, EXPIRES_AT, {
    seed: "partial",
    maximumOperationCount: 100
  });
  assert.equal(resumed.state, "DELETION_COMPLETED");
  assert.equal(readRouteIqRetentionDeletionStatus(context.ledger, SUBJECT).state, "DELETION_COMPLETED");
  const ledgerRecords = readRouteIqRetentionLedgerRecords(context.ledger);
  const ledgerText = stableJson(ledgerRecords);
  assert.equal(ledgerText.includes("retention-runtime-raw-source"), false);
  assert.equal(ledgerText.includes("verifiedFields"), false);
  assert.equal(ledgerRecords
    .filter(record => record.schemaVersion === routeIqRetentionDeletionEventVersion).length, plan.totalArtifactCount + 2);
});

test("an injected non-atomic failure remains blocked and resumes without duplicating accepted deletion progress", async () => {
  const store = new MaintenanceKvStore();
  await seedArchive(store);
  const context = await retentionContext();
  const plan = await createPlan(context, store);
  store.failDeleteAt = 2;
  await assert.rejects(
    () => execute(context, store, plan, EXPIRES_AT, { seed: "injected-failure" }),
    /test_only_kv_delete_failure/
  );
  const blockedRead = await readRouteIqFieldSessionArchive({
    workspaceId: SUBJECT.workspaceId,
    operatingProfileId: SUBJECT.operatingProfileId,
    sessionId: SESSION_ID
  }, { store });
  assert.equal(blockedRead.status, "retention_deletion_in_progress");
  const progressBefore = readRouteIqRetentionLedgerRecords(context.ledger)
    .filter(record => record.eventType === "ARTIFACT_DELETED");
  assert.equal(progressBefore.length, 1);
  store.failDeleteAt = null;
  const resumed = await execute(context, store, plan, EXPIRES_AT, { seed: "injected-failure" });
  assert.equal(resumed.state, "DELETION_COMPLETED");
  const progressAfter = readRouteIqRetentionLedgerRecords(context.ledger)
    .filter(record => record.eventType === "ARTIFACT_DELETED");
  assert.equal(progressAfter.length, plan.totalArtifactCount);
  assert.equal(new Set(progressAfter.map(record => record.artifact.ordinal)).size, plan.totalArtifactCount);
});

test("unsigned or plan-replayed authority fails before mutation", async () => {
  const store = new MaintenanceKvStore();
  await seedArchive(store);
  const context = await retentionContext();
  const plan = await createPlan(context, store);
  await assert.rejects(
    () => executeRouteIqRetentionDeletion({
      plan,
      requestedExecutionTime: EXPIRES_AT,
      authorization: {},
      maximumOperationCount: 100
    }, {
      archiveMaintenanceStore: store,
      coordinatorRepositories: [],
      retentionGovernanceLedger: context.ledger
    }),
    error => /assertion|fields/i.test(error.message)
  );
  const changed = structuredClone(plan);
  changed.artifacts[0].artifactSha256 = "0".repeat(64);
  changed.planSha256 = retentionSha256(Object.fromEntries(Object.entries(changed).filter(([key]) => key !== "planSha256")));
  await assert.rejects(
    () => executeRouteIqRetentionDeletion({
      plan: changed,
      requestedExecutionTime: EXPIRES_AT,
      authorization: signExecution(context, plan, EXPIRES_AT, "replay"),
      maximumOperationCount: 100
    }, {
      archiveMaintenanceStore: store,
      coordinatorRepositories: [],
      retentionGovernanceLedger: context.ledger
    }),
    error => error.code === "route_iq_retention_authority_signature_invalid"
  );
  assert.equal(store.deleteCount, 0);
});

test("transaction-scoped coordinator purge removes derived rows while ordinary append-only deletion remains prohibited", async () => {
  const store = new MaintenanceKvStore();
  await seedArchive(store);
  const repository = new NodeSqliteRepository();
  const seeded = seedCoordinator(repository);
  assert.throws(
    () => repository.execute("DELETE FROM opportunities WHERE opportunity_id = ?", [seeded.opportunityId]),
    /immutable/
  );
  const context = await retentionContext();
  const plan = await createPlan(context, store, {}, { coordinatorRepositories: [repository] });
  assert.equal(plan.artifacts.some(artifact => artifact.storageClass === "prospective_coordinator_sqlite"), true);
  const result = await execute(context, store, plan, EXPIRES_AT, {
    seed: "sqlite-maintenance"
  }, { coordinatorRepositories: [repository] });
  assert.equal(result.state, "DELETION_COMPLETED");
  assert.equal(repository.one("SELECT COUNT(*) AS count FROM opportunities").count, 0);
  assert.equal(repository.one("SELECT COUNT(*) AS count FROM field_session_outcome_links").count, 0);
  assert.equal(repository.one("SELECT COUNT(*) AS count FROM field_session_evaluation_contexts").count, 0);
  assert.equal(repository.one("SELECT COUNT(*) AS count FROM canonical_sessions").count, 1);
  assert.throws(
    () => repository.execute("DELETE FROM canonical_sessions WHERE session_id = ?", [seeded.sessionId]),
    /append_only/
  );
  repository.close();
});

test("schemas expose no scheduler or public deletion route and historical archive bytes remain unchanged", () => {
  const runtimeSource = readFileSync("data/route-iq-field-sessions-v1/route-iq-retention-deletion-runtime.mjs", "utf8");
  assert.doesNotMatch(runtimeSource, /scheduled\s*\(|alarm\s*\(|queue\s*\(|\/api\//);
  const ordinaryArchiveSource = readFileSync("data/route-iq-field-sessions-v1/route-iq-field-session-archive.mjs", "utf8");
  const ordinaryStoreBody = ordinaryArchiveSource.match(/export function createCloudflareKvFieldSessionStore[\s\S]*?\n}\n/)?.[0];
  assert.equal(ordinaryStoreBody.includes("delete("), false);
  const historicalPath = "data/route-iq-field-sessions-v1/workspaces/fitness_connection/sessions/route-iq-field-session-fitness-connection-fitness-cruz-2026-07-11/manifest.json";
  assert.equal(createHash("sha256").update(readFileSync(historicalPath)).digest("hex"), "e0bc2cc65e1c67fb39784c3a1fe87732875b64b6f5f2365df1924da5083265ba");
});
