import { createHash } from "node:crypto";

import {
  FieldSessionArchiveError,
  fieldSessionAdministrativeDispositionStorageKey,
  fieldSessionRetentionDeletionStateStorageKey,
  fieldSessionStorageKeys,
  readRouteIqFieldSessionArchive,
  routeIqFieldSessionRetentionDeletionStateVersion
} from "./route-iq-field-session-archive.mjs";
import {
  readAuthoritativeRouteIqRetentionLegalHoldSnapshot,
  readRouteIqRetentionLedgerRecords,
  validateRouteIqRetentionBoundaryForLedger,
  validateRouteIqRetentionDeletionEvent,
  validateRouteIqRetentionOperationReceipt
} from "./route-iq-retention-governance.mjs";
import { routeIqProspectiveRetentionPolicyVersion } from "./route-iq-prospective-retention-policy.mjs";

export const routeIqRetentionDeletionPlanVersion = "route-iq-retention-deletion-plan-v1";
export const routeIqRetentionDeletionRuntimeVersion = "route-iq-retention-deletion-runtime-v1";
export const routeIqRetentionMaintenanceCapabilityVersion = "authenticated_retention_maintenance_v1";
export const routeIqRetentionDeletionMaximumArtifactCount = 1000;
export const routeIqRetentionDeletionMaximumOperationCount = 100;

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const PLAN_MODES = new Set(["dry_run", "execution"]);
const STORAGE_CLASSES = new Set(["field_session_kv", "prospective_coordinator_sqlite"]);

const COORDINATOR_TABLES = Object.freeze([
  { table: "field_session_evaluation_contexts", primaryKeyColumn: "context_id", order: 10 },
  { table: "field_session_outcome_links", primaryKeyColumn: "link_id", order: 20 },
  { table: "field_session_reconciliation_conflicts", primaryKeyColumn: "conflict_id", order: 30 },
  { table: "field_session_reconciliation_receipts", primaryKeyColumn: "reconciliation_id", order: 40 },
  { table: "projection_commits", primaryKeyColumn: "commit_id", order: 50 },
  { table: "projection_artifacts", primaryKeyColumn: "projection_id", order: 60 },
  { table: "projection_outbox", primaryKeyColumn: "outbox_id", order: 70 },
  { table: "candidate_manifests", primaryKeyColumn: "snapshot_artifact_id", order: 80 },
  { table: "operation_receipts", primaryKeyColumn: "operation_key", order: 90 },
  { table: "operation_attempts", primaryKeyColumn: "attempt_id", order: 100 },
  { table: "lifecycle_events", primaryKeyColumn: "artifact_id", order: 110 },
  { table: "artifact_registry", primaryKeyColumn: "artifact_id", order: 120 },
  { table: "opportunities", primaryKeyColumn: "opportunity_id", order: 130 }
]);
const COORDINATOR_TABLE_BY_NAME = new Map(COORDINATOR_TABLES.map(entry => [entry.table, entry]));

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  const bytes = typeof value === "string" ? value : stableJson(value);
  return createHash("sha256").update(bytes).digest("hex");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

export class RouteIqRetentionDeletionError extends FieldSessionArchiveError {
  constructor(message, { code = "route_iq_retention_deletion_invalid", status = 422, details = {} } = {}) {
    super(message, { code, status, details });
    this.name = "RouteIqRetentionDeletionError";
  }
}

function fail(code, message, details = {}, status = 422) {
  throw new RouteIqRetentionDeletionError(message, { code, status, details });
}

function canonicalIso(value, label) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    fail("route_iq_retention_deletion_time_invalid", `${label} must be canonical UTC.`);
  }
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) {
    fail("route_iq_retention_deletion_time_invalid", `${label} must be canonical UTC.`);
  }
  return { iso: value, milliseconds };
}

function requireSha(value, label) {
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) {
    fail("route_iq_retention_deletion_hash_invalid", `${label} must be a SHA-256 digest.`);
  }
  return value;
}

function assertExactKeys(value, expected, scope) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("route_iq_retention_deletion_structure_invalid", `${scope} must be an object.`);
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (stableJson(actual) !== stableJson(wanted)) {
    fail("route_iq_retention_deletion_fields_invalid", `${scope} has missing or unsupported fields.`, {
      scope,
      actualFieldCount: actual.length,
      expectedFieldCount: wanted.length
    });
  }
}

function validateArchiveStore(store, deleteRequired = false) {
  const methods = deleteRequired ? ["get", "put", "list", "delete"] : ["get", "list"];
  const missingMethods = methods.filter(method => typeof store?.[method] !== "function");
  if (missingMethods.length
    || (deleteRequired && store.retentionMaintenanceCapability !== routeIqRetentionMaintenanceCapabilityVersion)) {
    fail(
      "route_iq_retention_maintenance_store_invalid",
      deleteRequired
        ? "An authenticated retention-maintenance store is required."
        : "A field-session archive store is required.",
      { missingMethodCount: missingMethods.length },
      500
    );
  }
  return store;
}

function validateRepository(repository) {
  const missingMethods = ["executeSchema", "execute", "transactionSync"]
    .filter(method => typeof repository?.[method] !== "function");
  if (missingMethods.length) {
    fail("route_iq_retention_coordinator_repository_invalid", "A coordinator SQLite repository is required.", {
      missingMethodCount: missingMethods.length
    }, 500);
  }
  return repository;
}

function repositoryRows(repository, sql, bindings = []) {
  const rows = repository.execute(sql, bindings);
  if (!Array.isArray(rows)) {
    fail("route_iq_retention_coordinator_repository_invalid", "Coordinator queries must return row arrays.", {}, 500);
  }
  return rows;
}

function repositoryOne(repository, sql, bindings = []) {
  return repositoryRows(repository, sql, bindings)[0] || null;
}

function coordinatorRepositoryIdentitySha256(repository) {
  const meta = repositoryOne(repository, "SELECT * FROM coordinator_meta WHERE singleton = 1");
  if (!meta || [
    "schema_version",
    "coordinator_id",
    "workspace_id",
    "operating_profile_id",
    "representative_id",
    "registry_version"
  ].some(key => typeof meta[key] !== "string" || meta[key].length === 0)) {
    fail("route_iq_retention_coordinator_identity_invalid", "Coordinator repository identity is unavailable.", {}, 500);
  }
  return sha256({
    schemaVersion: meta.schema_version,
    coordinatorId: meta.coordinator_id,
    workspaceId: meta.workspace_id,
    operatingProfileId: meta.operating_profile_id,
    representativeId: meta.representative_id,
    registryVersion: meta.registry_version
  });
}

async function listAllKeys(store, prefix) {
  const keys = [];
  let cursor;
  for (let pageCount = 0; pageCount < 100; pageCount += 1) {
    const page = await store.list(cursor ? { prefix, cursor } : { prefix });
    if (!page || !Array.isArray(page.keys)) {
      fail("route_iq_retention_archive_listing_invalid", "Archive inventory listing is invalid.", {}, 500);
    }
    keys.push(...page.keys.map(entry => entry?.name).filter(name => typeof name === "string"));
    if (page.list_complete !== false) return [...new Set(keys)].sort();
    if (typeof page.cursor !== "string" || page.cursor.length === 0) {
      fail("route_iq_retention_archive_listing_incomplete", "Archive inventory listing did not provide a continuation cursor.", {}, 500);
    }
    cursor = page.cursor;
  }
  fail("route_iq_retention_archive_listing_unbounded", "Archive inventory exceeded the bounded listing limit.", {}, 500);
}

function descriptorForKv(key, value, relationship) {
  if (typeof value !== "string") {
    fail("route_iq_retention_artifact_missing", "A manifest-bound archive artifact is missing.", {
      artifactIdentitySha256: sha256({ storageClass: "field_session_kv", key })
    }, 409);
  }
  const identity = { storageClass: "field_session_kv", key };
  return {
    ordinal: 0,
    storageClass: "field_session_kv",
    key,
    rowIdentity: null,
    artifactIdentitySha256: sha256(identity),
    artifactSha256: sha256(value),
    byteLength: Buffer.byteLength(value),
    relationship
  };
}

function descriptorForRow(tableDefinition, row, relationship) {
  const primaryKey = row?.[tableDefinition.primaryKeyColumn];
  if (typeof primaryKey !== "string" || primaryKey.length === 0) {
    fail("route_iq_retention_coordinator_row_invalid", "A coordinator row has no canonical primary identity.", {
      table: tableDefinition.table
    }, 500);
  }
  const rowIdentity = {
    table: tableDefinition.table,
    primaryKeyColumn: tableDefinition.primaryKeyColumn,
    primaryKey
  };
  const bytes = stableJson(row);
  return {
    ordinal: 0,
    storageClass: "prospective_coordinator_sqlite",
    key: null,
    rowIdentity,
    artifactIdentitySha256: sha256({ storageClass: "prospective_coordinator_sqlite", rowIdentity }),
    artifactSha256: sha256(bytes),
    byteLength: Buffer.byteLength(bytes),
    relationship,
    _order: tableDefinition.order
  };
}

function coordinatorRowsForOpportunity(repository, table, opportunityId) {
  if (table === "projection_commits") {
    return repositoryRows(repository, `
      SELECT commits.* FROM projection_commits commits
      JOIN projection_artifacts artifacts ON artifacts.projection_id = commits.projection_id
      WHERE artifacts.opportunity_id = ?
      ORDER BY commits.commit_id
    `, [opportunityId]);
  }
  if (table === "artifact_registry") {
    return repositoryRows(repository, "SELECT * FROM artifact_registry WHERE opportunity_id = ? ORDER BY artifact_id", [opportunityId]);
  }
  return repositoryRows(
    repository,
    `SELECT * FROM ${table} WHERE opportunity_id = ? ORDER BY ${COORDINATOR_TABLE_BY_NAME.get(table).primaryKeyColumn}`,
    [opportunityId]
  );
}

function collectCoordinatorArtifacts(repositoryInput, source, representativeId) {
  const repository = validateRepository(repositoryInput);
  const links = repositoryRows(
    repository,
    "SELECT * FROM field_session_outcome_links WHERE source_archive_raw_sha256 = ? ORDER BY link_id",
    [source.sourceRecordSha256]
  );
  const reconciliations = repositoryRows(
    repository,
    "SELECT * FROM field_session_reconciliation_receipts WHERE source_archive_raw_sha256 = ? ORDER BY reconciliation_id",
    [source.sourceRecordSha256]
  );
  const conflicts = repositoryRows(
    repository,
    "SELECT * FROM field_session_reconciliation_conflicts WHERE source_archive_raw_sha256 = ? ORDER BY conflict_id",
    [source.sourceRecordSha256]
  );
  if (links.length === 0 && reconciliations.length === 0 && conflicts.length === 0) return [];

  const meta = repositoryOne(repository, "SELECT * FROM coordinator_meta WHERE singleton = 1");
  if (!meta
    || meta.workspace_id !== source.workspaceId
    || meta.operating_profile_id !== source.operatingProfileId
    || meta.representative_id !== representativeId) {
    fail("route_iq_retention_coordinator_scope_mismatch", "Source-bound coordinator evidence crosses retention scope.", {}, 403);
  }
  const opportunityIds = [...new Set(links.map(row => row.opportunity_id))].sort();
  const descriptors = [];
  const seenIdentities = new Set();
  const add = (tableName, rows, relationship) => {
    const definition = COORDINATOR_TABLE_BY_NAME.get(tableName);
    for (const row of rows) {
      const descriptor = descriptorForRow(definition, row, relationship);
      if (seenIdentities.has(descriptor.artifactIdentitySha256)) continue;
      seenIdentities.add(descriptor.artifactIdentitySha256);
      descriptors.push(descriptor);
    }
  };

  add("field_session_reconciliation_conflicts", conflicts, "source_reconciliation_conflict");
  add("field_session_reconciliation_receipts", reconciliations, "source_reconciliation_receipt");
  for (const opportunityId of opportunityIds) {
    const opportunity = repositoryOne(repository, "SELECT * FROM opportunities WHERE opportunity_id = ?", [opportunityId]);
    if (!opportunity) {
      fail("route_iq_retention_coordinator_orphan_invalid", "Source-bound coordinator evidence is orphaned.", {}, 500);
    }
    const opportunityLinks = coordinatorRowsForOpportunity(
      repository,
      "field_session_outcome_links",
      opportunityId
    );
    if (opportunityLinks.some(row => row.source_archive_raw_sha256 !== source.sourceRecordSha256)) {
      fail(
        "route_iq_retention_coordinator_cross_source_graph",
        "A source-bound opportunity graph is shared with another retention subject.",
        {},
        409
      );
    }
    for (const definition of COORDINATOR_TABLES) {
      if (new Set([
        "field_session_reconciliation_conflicts",
        "field_session_reconciliation_receipts",
        "opportunities"
      ]).has(definition.table)) continue;
      add(definition.table, coordinatorRowsForOpportunity(repository, definition.table, opportunityId), "source_bound_opportunity_graph");
    }
    add("opportunities", [opportunity], "source_bound_opportunity_root");
  }
  const detachedRegistryIds = [...reconciliations.map(row => row.reconciliation_id), ...conflicts.map(row => row.conflict_id)];
  for (const artifactId of detachedRegistryIds.sort()) {
    const row = repositoryOne(repository, "SELECT * FROM artifact_registry WHERE artifact_id = ?", [artifactId]);
    if (!row) {
      fail("route_iq_retention_coordinator_orphan_invalid", "A source reconciliation artifact is unregistered.", {}, 500);
    }
    add("artifact_registry", [row], "source_reconciliation_registry");
  }
  for (const reconciliation of reconciliations) {
    let receipt;
    try {
      receipt = JSON.parse(reconciliation.receipt_json);
    } catch {
      fail("route_iq_retention_coordinator_row_corrupt", "A source reconciliation receipt is corrupt.", {}, 500);
    }
    const linkedIds = Array.isArray(receipt.linked)
      ? receipt.linked.map(entry => entry?.opportunityId).filter(Boolean)
      : [];
    if (linkedIds.some(opportunityId => !opportunityIds.includes(opportunityId))) {
      fail("route_iq_retention_coordinator_graph_incomplete", "A reconciliation receipt names an unmanifested opportunity.", {}, 500);
    }
  }
  return descriptors;
}

async function collectArchiveArtifacts(input, store) {
  const archived = await readRouteIqFieldSessionArchive({
    workspaceId: input.workspaceId,
    operatingProfileId: input.operatingProfileId,
    sessionId: input.sessionId
  }, { store });
  if (!archived.found || archived.unavailable) {
    fail("route_iq_retention_source_archive_unavailable", "The exact source archive is unavailable for deletion planning.", {}, 409);
  }
  const record = archived.record;
  const representativeId = record.normalizedRecord?.verifiedFields?.representative?.id;
  if (typeof representativeId !== "string" || representativeId.length === 0
    || (input.representativeId && input.representativeId !== representativeId)
    || record.commit.rawSha256 !== input.sourceRecordSha256) {
    fail("route_iq_retention_source_scope_mismatch", "The source archive does not match the exact retention subject.", {}, 403);
  }
  const keys = fieldSessionStorageKeys(input.workspaceId, input.sessionId);
  const manifestKeys = record.commit?.keys;
  if (!manifestKeys
    || manifestKeys.raw !== keys.raw
    || manifestKeys.normalized !== keys.normalized
    || manifestKeys.calculated !== keys.calculated
    || manifestKeys.stressTestEvidence !== keys.stressTestEvidence
    || manifestKeys.historyUpdates !== keys.historyUpdates
    || manifestKeys.commit !== keys.commit
    || !Array.isArray(manifestKeys.historyEntries)
    || new Set(manifestKeys.historyEntries).size !== manifestKeys.historyEntries.length) {
    fail("route_iq_retention_source_manifest_invalid", "The field-session commit manifest is invalid.", {}, 500);
  }

  const descriptors = [];
  for (const [key, relationship] of [
    [keys.raw, "authoritative_source"],
    [keys.normalized, "source_normalization"],
    [keys.calculated, "source_calculated_metrics"],
    [keys.stressTestEvidence, "source_stress_evidence"],
    [keys.historyUpdates, "source_history_manifest"]
  ]) {
    descriptors.push(descriptorForKv(key, await store.get(key), relationship));
  }
  for (const key of [...manifestKeys.historyEntries].sort()) {
    descriptors.push(descriptorForKv(key, await store.get(key), "session_history_index"));
  }
  const dispositionKey = fieldSessionAdministrativeDispositionStorageKey(input.workspaceId, input.sessionId);
  const disposition = await store.get(dispositionKey);
  if (disposition !== null && disposition !== undefined) {
    descriptors.push(descriptorForKv(dispositionKey, disposition, "administrative_disposition"));
  }
  descriptors.push(descriptorForKv(keys.commit, await store.get(keys.commit), "source_commit_marker"));

  const baseKeys = await listAllKeys(store, `${keys.base}/`);
  const expectedBaseKeys = new Set(descriptors.filter(item => item.key?.startsWith(`${keys.base}/`)).map(item => item.key));
  const deletionStateKey = fieldSessionRetentionDeletionStateStorageKey(input.workspaceId, input.sessionId);
  const unknownBaseKeys = baseKeys.filter(key => key !== deletionStateKey && !expectedBaseKeys.has(key));
  const historyKeys = (await listAllKeys(store, `${keys.historyRoot}/`))
    .filter(key => key.includes(`/sessions/${input.sessionId}`));
  const expectedHistoryKeys = new Set(manifestKeys.historyEntries);
  const unknownHistoryKeys = historyKeys.filter(key => !expectedHistoryKeys.has(key));
  const missingHistoryKeys = [...expectedHistoryKeys].filter(key => !historyKeys.includes(key));
  if (unknownBaseKeys.length || unknownHistoryKeys.length || missingHistoryKeys.length) {
    fail("route_iq_retention_unmanifested_artifact_blocked", "Unmanifested or missing source artifacts block deletion.", {
      unknownArtifactCount: unknownBaseKeys.length + unknownHistoryKeys.length,
      missingArtifactCount: missingHistoryKeys.length
    }, 409);
  }
  return { descriptors, representativeId };
}

function legalHoldIdentity(records, snapshot, asOf) {
  const asOfMilliseconds = Date.parse(asOf);
  const legalHoldRecords = records.filter(record => record.recordKind === "route_iq_retention_legal_hold_event"
    && Date.parse(record.recordedAt) <= asOfMilliseconds);
  return sha256({
    state: snapshot.state,
    authoritative: snapshot.authoritative,
    subjectBound: snapshot.subjectBound,
    recordSha256s: legalHoldRecords.map(record => record.recordSha256)
  });
}

async function authoritativeLegalHoldIdentity(ledger, subject, asOf) {
  let snapshot;
  try {
    snapshot = await readAuthoritativeRouteIqRetentionLegalHoldSnapshot(ledger, subject, asOf);
  } catch {
    fail("route_iq_retention_legal_hold_unverified", "Authoritative legal-hold verification is required.", {}, 409);
  }
  if (!snapshot.authoritative || !snapshot.subjectBound || snapshot.state !== "none") {
    fail(
      snapshot.state === "active"
        ? "route_iq_retention_legal_hold_active"
        : "route_iq_retention_legal_hold_unverified",
      "Physical deletion requires an authoritative legal-hold result of none.",
      {},
      409
    );
  }
  const records = readRouteIqRetentionLedgerRecords(ledger);
  if (records.some(record => record.recordKind === "route_iq_retention_legal_hold_event"
    && Date.parse(record.recordedAt) > Date.parse(asOf))) {
    fail(
      "route_iq_retention_legal_hold_changed",
      "A legal-hold event newer than the authoritative evaluation time blocks deletion.",
      {},
      409
    );
  }
  return legalHoldIdentity(records, snapshot, asOf);
}

function planBody(plan) {
  const { planSha256: ignored, ...body } = plan;
  return body;
}

export function validateRouteIqRetentionDeletionPlan(plan) {
  const keys = new Set([
    "schemaVersion",
    "planId",
    "policyVersion",
    "mode",
    "workspaceId",
    "operatingProfileId",
    "recordClass",
    "sessionId",
    "representativeIdentitySha256",
    "sourceRecordSha256",
    "retentionBoundary",
    "authoritativeEvaluationTime",
    "legalHoldSnapshotIdentitySha256",
    "coordinatorRepositoryIdentitySha256s",
    "artifacts",
    "totalArtifactCount",
    "totalByteLength",
    "planSha256"
  ]);
  assertExactKeys(plan, keys, "retention deletion plan");
  canonicalIso(plan.authoritativeEvaluationTime, "Deletion plan evaluation time");
  if (plan.schemaVersion !== routeIqRetentionDeletionPlanVersion
    || plan.policyVersion !== routeIqProspectiveRetentionPolicyVersion
    || !PLAN_MODES.has(plan.mode)
    || plan.workspaceId !== "fitness_connection"
    || plan.operatingProfileId !== "fitness"
    || plan.recordClass !== "field_session_raw_evidence"
    || typeof plan.sessionId !== "string" || plan.sessionId.length === 0
    || !Array.isArray(plan.artifacts) || plan.artifacts.length < 1
    || plan.artifacts.length > routeIqRetentionDeletionMaximumArtifactCount
    || plan.totalArtifactCount !== plan.artifacts.length
    || plan.totalByteLength !== plan.artifacts.reduce((sum, item) => sum + item.byteLength, 0)) {
    fail("route_iq_retention_deletion_plan_invalid", "Retention deletion plan semantics are invalid.");
  }
  requireSha(plan.representativeIdentitySha256, "Representative identity hash");
  requireSha(plan.sourceRecordSha256, "Source record hash");
  requireSha(plan.legalHoldSnapshotIdentitySha256, "Legal-hold snapshot identity hash");
  requireSha(plan.planSha256, "Deletion plan hash");
  if (!Array.isArray(plan.coordinatorRepositoryIdentitySha256s)
    || plan.coordinatorRepositoryIdentitySha256s.some(value => !SHA256_PATTERN.test(value))
    || stableJson(plan.coordinatorRepositoryIdentitySha256s)
      !== stableJson([...new Set(plan.coordinatorRepositoryIdentitySha256s)].sort())) {
    fail("route_iq_retention_coordinator_identity_invalid", "Deletion plan coordinator identities are invalid.");
  }
  const identities = new Set();
  plan.artifacts.forEach((artifact, index) => {
    const artifactKeys = new Set([
      "ordinal",
      "storageClass",
      "key",
      "rowIdentity",
      "artifactIdentitySha256",
      "artifactSha256",
      "byteLength",
      "relationship"
    ]);
    assertExactKeys(artifact, artifactKeys, `retention deletion artifact ${index + 1}`);
    if (artifact.ordinal !== index + 1 || !STORAGE_CLASSES.has(artifact.storageClass)
      || !Number.isSafeInteger(artifact.byteLength) || artifact.byteLength < 0
      || typeof artifact.relationship !== "string" || !/^[a-z0-9_]+$/.test(artifact.relationship)
      || (artifact.storageClass === "field_session_kv") !== (typeof artifact.key === "string" && artifact.rowIdentity === null)
      || (artifact.storageClass === "prospective_coordinator_sqlite") !== (artifact.key === null && artifact.rowIdentity !== null)) {
      fail("route_iq_retention_deletion_artifact_invalid", "Retention deletion artifact semantics are invalid.", {
        ordinal: index + 1
      });
    }
    if (artifact.rowIdentity !== null) {
      assertExactKeys(
        artifact.rowIdentity,
        new Set(["table", "primaryKeyColumn", "primaryKey"]),
        `retention deletion row identity ${index + 1}`
      );
      const definition = COORDINATOR_TABLE_BY_NAME.get(artifact.rowIdentity.table);
      if (!definition
        || definition.primaryKeyColumn !== artifact.rowIdentity.primaryKeyColumn
        || typeof artifact.rowIdentity.primaryKey !== "string"
        || artifact.rowIdentity.primaryKey.length === 0) {
        fail("route_iq_retention_deletion_row_identity_invalid", "Retention deletion row identity is invalid.");
      }
    }
    requireSha(artifact.artifactIdentitySha256, "Artifact identity hash");
    requireSha(artifact.artifactSha256, "Artifact content hash");
    const expectedIdentitySha256 = sha256(artifact.storageClass === "field_session_kv"
      ? { storageClass: artifact.storageClass, key: artifact.key }
      : { storageClass: artifact.storageClass, rowIdentity: artifact.rowIdentity });
    if (artifact.artifactIdentitySha256 !== expectedIdentitySha256) {
      fail("route_iq_retention_deletion_artifact_identity_invalid", "Retention deletion artifact identity hash is invalid.");
    }
    if (identities.has(artifact.artifactIdentitySha256)) {
      fail("route_iq_retention_deletion_artifact_duplicate", "Retention deletion plan contains a duplicate artifact.");
    }
    identities.add(artifact.artifactIdentitySha256);
  });
  const expectedPlanId = `riq_retention_deletion_plan_${sha256({
    schemaVersion: plan.schemaVersion,
    sourceRecordSha256: plan.sourceRecordSha256,
    mode: plan.mode,
    coordinatorRepositoryIdentitySha256s: plan.coordinatorRepositoryIdentitySha256s,
    artifactIdentitySha256s: plan.artifacts.map(item => item.artifactIdentitySha256)
  })}`;
  if (plan.planId !== expectedPlanId || sha256(planBody(plan)) !== plan.planSha256) {
    fail("route_iq_retention_deletion_plan_integrity_invalid", "Retention deletion plan integrity verification failed.");
  }
  return deepFreeze(clone(plan));
}

export async function createRouteIqRetentionDeletionPlan(input = {}, options = {}) {
  assertExactKeys(input, new Set([
    "workspaceId",
    "operatingProfileId",
    "representativeId",
    "sessionId",
    "recordClass",
    "sourceRecordSha256",
    "retentionBoundary",
    "authoritativeEvaluationTime",
    "mode"
  ]), "retention deletion plan input");
  assertExactKeys(options, new Set([
    "archiveStore",
    "coordinatorRepositories",
    "retentionGovernanceLedger",
    "maximumArtifactCount"
  ]), "retention deletion plan options");
  const archiveStore = validateArchiveStore(options.archiveStore);
  const evaluatedAt = canonicalIso(input.authoritativeEvaluationTime, "Deletion plan evaluation time");
  if (!PLAN_MODES.has(input.mode)
    || input.workspaceId !== "fitness_connection"
    || input.operatingProfileId !== "fitness"
    || input.recordClass !== "field_session_raw_evidence") {
    fail("route_iq_retention_deletion_scope_invalid", "Retention deletion planning scope is invalid.", {}, 403);
  }
  requireSha(input.sourceRecordSha256, "Source record hash");
  const subject = {
    workspaceId: input.workspaceId,
    operatingProfileId: input.operatingProfileId,
    recordClass: input.recordClass,
    sourceRecordSha256: input.sourceRecordSha256
  };
  const retentionBoundary = validateRouteIqRetentionBoundaryForLedger(
    input.retentionBoundary,
    options.retentionGovernanceLedger,
    subject
  );
  const legalHoldSnapshotIdentitySha256 = await authoritativeLegalHoldIdentity(
    options.retentionGovernanceLedger,
    subject,
    evaluatedAt.iso
  );
  const archive = await collectArchiveArtifacts(input, archiveStore);
  const coordinatorDescriptors = [];
  const coordinatorRepositoryIdentitySha256s = [];
  for (const repository of options.coordinatorRepositories || []) {
    const descriptors = collectCoordinatorArtifacts(repository, subject, archive.representativeId);
    if (descriptors.length > 0) {
      coordinatorDescriptors.push(...descriptors);
      coordinatorRepositoryIdentitySha256s.push(coordinatorRepositoryIdentitySha256(repository));
    }
  }
  coordinatorRepositoryIdentitySha256s.sort();
  if (new Set(coordinatorRepositoryIdentitySha256s).size !== coordinatorRepositoryIdentitySha256s.length) {
    fail("route_iq_retention_coordinator_identity_ambiguous", "A coordinator repository identity was provided more than once.", {}, 409);
  }
  const artifacts = [
    ...coordinatorDescriptors.sort((left, right) => left._order - right._order
      || left.artifactIdentitySha256.localeCompare(right.artifactIdentitySha256)),
    ...archive.descriptors
  ].map(({ _order: ignored, ...artifact }, index) => ({ ...artifact, ordinal: index + 1 }));
  const maximumArtifactCount = options.maximumArtifactCount ?? routeIqRetentionDeletionMaximumArtifactCount;
  if (!Number.isSafeInteger(maximumArtifactCount) || maximumArtifactCount < 1
    || maximumArtifactCount > routeIqRetentionDeletionMaximumArtifactCount
    || artifacts.length > maximumArtifactCount) {
    fail("route_iq_retention_deletion_plan_bound_exceeded", "Retention deletion plan exceeds its artifact bound.", {
      artifactCount: artifacts.length,
      maximumArtifactCount
    }, 409);
  }
  const bodyWithoutId = {
    schemaVersion: routeIqRetentionDeletionPlanVersion,
    policyVersion: routeIqProspectiveRetentionPolicyVersion,
    mode: input.mode,
    workspaceId: input.workspaceId,
    operatingProfileId: input.operatingProfileId,
    recordClass: input.recordClass,
    sessionId: input.sessionId,
    representativeIdentitySha256: sha256(archive.representativeId),
    sourceRecordSha256: input.sourceRecordSha256,
    retentionBoundary,
    authoritativeEvaluationTime: evaluatedAt.iso,
    legalHoldSnapshotIdentitySha256,
    coordinatorRepositoryIdentitySha256s,
    artifacts,
    totalArtifactCount: artifacts.length,
    totalByteLength: artifacts.reduce((sum, artifact) => sum + artifact.byteLength, 0)
  };
  const planId = `riq_retention_deletion_plan_${sha256({
    schemaVersion: bodyWithoutId.schemaVersion,
    sourceRecordSha256: bodyWithoutId.sourceRecordSha256,
    mode: bodyWithoutId.mode,
    coordinatorRepositoryIdentitySha256s,
    artifactIdentitySha256s: artifacts.map(item => item.artifactIdentitySha256)
  })}`;
  const withId = { ...bodyWithoutId, planId };
  return validateRouteIqRetentionDeletionPlan({ ...withId, planSha256: sha256(withId) });
}

function eventTimestamp(requestedAt, offset) {
  return new Date(Date.parse(requestedAt) + offset).toISOString();
}

function continuationCursor(planSha256, completedArtifactCount) {
  return completedArtifactCount >= 0
    ? `riq_retention_cursor_${sha256({ planSha256, nextOrdinal: completedArtifactCount + 1 })}`
    : null;
}

function deletionState(plan, state, startedAt, updatedAt, completedArtifactCount) {
  return `${JSON.stringify({
    schemaVersion: routeIqFieldSessionRetentionDeletionStateVersion,
    workspaceId: plan.workspaceId,
    operatingProfileId: plan.operatingProfileId,
    sessionId: plan.sessionId,
    sourceRecordSha256: plan.sourceRecordSha256,
    deletionPlanSha256: plan.planSha256,
    state,
    startedAt,
    updatedAt,
    totalArtifactCount: plan.totalArtifactCount,
    completedArtifactCount
  }, null, 2)}\n`;
}

function operationInput(plan, requestedExecutionTime, authorization) {
  return {
    operation: "physical_deletion",
    requestedAt: requestedExecutionTime,
    subject: {
      workspaceId: plan.workspaceId,
      operatingProfileId: plan.operatingProfileId,
      recordClass: plan.recordClass,
      sourceRecordSha256: plan.sourceRecordSha256
    },
    retentionBoundary: plan.retentionBoundary,
    administrativeDispositionTarget: null,
    deletionPlanSha256: plan.planSha256,
    authorization
  };
}

function readRowForArtifact(repository, artifact) {
  const definition = COORDINATOR_TABLE_BY_NAME.get(artifact.rowIdentity?.table);
  if (!definition || definition.primaryKeyColumn !== artifact.rowIdentity.primaryKeyColumn) {
    fail("route_iq_retention_deletion_row_identity_invalid", "Deletion plan names an unsupported coordinator row.", {}, 409);
  }
  return repositoryOne(
    repository,
    `SELECT * FROM ${definition.table} WHERE ${definition.primaryKeyColumn} = ?`,
    [artifact.rowIdentity.primaryKey]
  );
}

function coordinatorRepositoryForArtifact(repositories, artifact) {
  const matches = repositories.filter(repository => readRowForArtifact(repository, artifact) !== null);
  if (matches.length > 1) {
    fail("route_iq_retention_coordinator_identity_ambiguous", "A coordinator row identity exists in multiple repositories.", {}, 500);
  }
  return matches[0] || null;
}

async function verifyArtifactsBeforeStart(plan, archiveStore, repositories) {
  const archive = await collectArchiveArtifacts({
    workspaceId: plan.workspaceId,
    operatingProfileId: plan.operatingProfileId,
    representativeId: null,
    sessionId: plan.sessionId,
    sourceRecordSha256: plan.sourceRecordSha256
  }, archiveStore);
  if (sha256(archive.representativeId) !== plan.representativeIdentitySha256) {
    fail("route_iq_retention_source_scope_mismatch", "The representative identity changed after deletion planning.", {}, 403);
  }
  const coordinatorArtifacts = [];
  const source = {
    workspaceId: plan.workspaceId,
    operatingProfileId: plan.operatingProfileId,
    recordClass: plan.recordClass,
    sourceRecordSha256: plan.sourceRecordSha256
  };
  for (const repository of repositories) {
    coordinatorArtifacts.push(...collectCoordinatorArtifacts(repository, source, archive.representativeId));
  }
  const currentArtifacts = [
    ...coordinatorArtifacts.sort((left, right) => left._order - right._order
      || left.artifactIdentitySha256.localeCompare(right.artifactIdentitySha256)),
    ...archive.descriptors
  ].map(({ _order: ignored, ...artifact }, index) => ({ ...artifact, ordinal: index + 1 }));
  if (stableJson(currentArtifacts) !== stableJson(plan.artifacts)) {
    fail("route_iq_retention_artifact_graph_changed", "The canonical deletion graph changed after planning.", {
      plannedArtifactCount: plan.artifacts.length,
      currentArtifactCount: currentArtifacts.length
    }, 409);
  }
}

function noDeleteTriggers(repository, tables) {
  const rows = repositoryRows(repository, `
    SELECT name, tbl_name, sql FROM sqlite_master
    WHERE type = 'trigger' AND name LIKE '%_no_delete'
    ORDER BY name
  `);
  const required = [...tables].sort();
  const selected = rows.filter(row => required.includes(row.tbl_name));
  const covered = new Set(selected.map(row => row.tbl_name));
  if (required.some(table => !covered.has(table)) || selected.some(row => typeof row.sql !== "string")) {
    fail("route_iq_retention_append_only_guard_missing", "Coordinator append-only deletion guards are missing.", {}, 500);
  }
  return selected;
}

function deleteCoordinatorArtifacts(repository, artifacts) {
  if (artifacts.length === 0) return;
  const tables = new Set(artifacts.map(artifact => artifact.rowIdentity.table));
  const triggers = noDeleteTriggers(repository, tables);
  repository.transactionSync(() => {
    for (const trigger of triggers) repository.executeSchema(`DROP TRIGGER ${trigger.name};`);
    for (const artifact of artifacts) {
      const row = readRowForArtifact(repository, artifact);
      if (row && sha256(stableJson(row)) !== artifact.artifactSha256) {
        fail("route_iq_retention_artifact_integrity_changed", "A coordinator artifact changed before deletion.", {
          artifactIdentitySha256: artifact.artifactIdentitySha256
        }, 409);
      }
      if (row) {
        const definition = COORDINATOR_TABLE_BY_NAME.get(artifact.rowIdentity.table);
        repositoryRows(
          repository,
          `DELETE FROM ${definition.table} WHERE ${definition.primaryKeyColumn} = ?`,
          [artifact.rowIdentity.primaryKey]
        );
      }
    }
    for (const trigger of triggers) repository.executeSchema(`${trigger.sql};`);
    for (const artifact of artifacts) {
      if (readRowForArtifact(repository, artifact)) {
        fail("route_iq_retention_coordinator_delete_incomplete", "Coordinator retention deletion was incomplete.", {}, 500);
      }
    }
    noDeleteTriggers(repository, tables);
  });
}

async function artifactIsAbsent(artifact, archiveStore, repositories) {
  if (artifact.storageClass === "field_session_kv") return (await archiveStore.get(artifact.key)) === null;
  return repositories.every(repository => readRowForArtifact(repository, artifact) === null);
}

export async function executeRouteIqRetentionDeletion(input = {}, options = {}) {
  assertExactKeys(input, new Set([
    "plan",
    "requestedExecutionTime",
    "authorization",
    "maximumOperationCount"
  ]), "retention deletion execution input");
  assertExactKeys(options, new Set([
    "archiveMaintenanceStore",
    "coordinatorRepositories",
    "retentionGovernanceLedger"
  ]), "retention deletion execution options");
  const plan = validateRouteIqRetentionDeletionPlan(input.plan);
  if (plan.mode !== "execution") {
    fail("route_iq_retention_dry_run_not_authorized", "A dry-run plan cannot grant mutation authority.", {}, 403);
  }
  const requested = canonicalIso(input.requestedExecutionTime, "Deletion requested execution time");
  const maximumOperationCount = input.maximumOperationCount ?? routeIqRetentionDeletionMaximumOperationCount;
  if (!Number.isSafeInteger(maximumOperationCount) || maximumOperationCount < 1
    || maximumOperationCount > routeIqRetentionDeletionMaximumOperationCount) {
    fail("route_iq_retention_deletion_operation_bound_invalid", "Deletion operation bound is invalid.");
  }
  const archiveStore = validateArchiveStore(options.archiveMaintenanceStore, true);
  const repositories = (options.coordinatorRepositories || []).map(validateRepository);
  const repositoryIdentitySha256s = repositories.map(coordinatorRepositoryIdentitySha256).sort();
  if (stableJson(repositoryIdentitySha256s) !== stableJson(plan.coordinatorRepositoryIdentitySha256s)) {
    fail(
      "route_iq_retention_coordinator_repository_set_mismatch",
      "Execution requires the exact coordinator repository set bound to the deletion plan.",
      {},
      409
    );
  }
  const subject = {
    workspaceId: plan.workspaceId,
    operatingProfileId: plan.operatingProfileId,
    recordClass: plan.recordClass,
    sourceRecordSha256: plan.sourceRecordSha256
  };
  if (requested.milliseconds < Date.parse(plan.authoritativeEvaluationTime)) {
    fail("route_iq_retention_deletion_time_invalid", "Execution cannot precede plan evaluation.");
  }
  const legalHoldSnapshotIdentitySha256 = await authoritativeLegalHoldIdentity(
    options.retentionGovernanceLedger,
    subject,
    requested.iso
  );
  if (legalHoldSnapshotIdentitySha256 !== plan.legalHoldSnapshotIdentitySha256) {
    fail("route_iq_retention_legal_hold_changed", "Legal-hold state changed after deletion planning.", {}, 409);
  }
  const receipt = await options.retentionGovernanceLedger.appendOperationReceipt(
    operationInput(plan, requested.iso, input.authorization)
  );
  validateRouteIqRetentionOperationReceipt(receipt, options.retentionGovernanceLedger);
  if (!receipt.decision.allowed) {
    return deepFreeze({
      ok: false,
      state: "DELETION_BLOCKED",
      reasons: [...receipt.decision.reasons],
      planSha256: plan.planSha256,
      operationReceiptSha256: receipt.recordSha256,
      physicalMutationPerformed: false
    });
  }
  const currentIdentity = await authoritativeLegalHoldIdentity(
    options.retentionGovernanceLedger,
    subject,
    requested.iso
  );
  if (currentIdentity !== plan.legalHoldSnapshotIdentitySha256) {
    fail("route_iq_retention_legal_hold_changed", "Legal-hold state changed before mutation.", {}, 409);
  }
  const records = readRouteIqRetentionLedgerRecords(options.retentionGovernanceLedger);
  let events = records.filter(record => record.recordKind === "route_iq_retention_deletion_event"
    && record.deletionPlanSha256 === plan.planSha256);
  const completed = events.find(event => event.eventType === "DELETION_COMPLETED");
  const stateKey = fieldSessionRetentionDeletionStateStorageKey(plan.workspaceId, plan.sessionId);
  if (completed) {
    for (const artifact of plan.artifacts) {
      if (!(await artifactIsAbsent(artifact, archiveStore, repositories))) {
        fail(
          "route_iq_retention_deleted_artifact_reappeared",
          "A completed deletion artifact reappeared after governed deletion.",
          { artifactIdentitySha256: artifact.artifactIdentitySha256 },
          409
        );
      }
    }
    await archiveStore.put(stateKey, deletionState(
      plan,
      "DELETION_COMPLETED",
      events[0].recordedAt,
      completed.recordedAt,
      plan.totalArtifactCount
    ));
    return deepFreeze({
      ok: true,
      state: "DELETION_COMPLETED",
      idempotent: true,
      planSha256: plan.planSha256,
      operationReceiptSha256: receipt.recordSha256,
      completionReceiptSha256: completed.recordSha256,
      totalArtifactCount: plan.totalArtifactCount,
      completedArtifactCount: plan.totalArtifactCount,
      continuationCursor: null
    });
  }
  if (events.length === 0) {
    await verifyArtifactsBeforeStart(plan, archiveStore, repositories);
    const immediatelyBeforeMutationIdentity = await authoritativeLegalHoldIdentity(
      options.retentionGovernanceLedger,
      subject,
      requested.iso
    );
    if (immediatelyBeforeMutationIdentity !== plan.legalHoldSnapshotIdentitySha256) {
      fail("route_iq_retention_legal_hold_changed", "Legal-hold state changed immediately before mutation.", {}, 409);
    }
    const startedAt = eventTimestamp(requested.iso, 1);
    const started = await options.retentionGovernanceLedger.appendDeletionEvent({
      eventType: "DELETION_STARTED",
      recordedAt: startedAt,
      deletionPlanSha256: plan.planSha256,
      operationReceiptSha256: receipt.recordSha256,
      legalHoldSnapshotIdentitySha256: plan.legalHoldSnapshotIdentitySha256,
      artifact: null,
      totalArtifactCount: plan.totalArtifactCount,
      completedArtifactCount: 0,
      continuationCursor: continuationCursor(plan.planSha256, 0)
    });
    validateRouteIqRetentionDeletionEvent(started, options.retentionGovernanceLedger);
    await archiveStore.put(stateKey, deletionState(plan, "DELETION_IN_PROGRESS", startedAt, startedAt, 0));
    events = [started];
  }
  const started = events[0];
  let completedArtifactCount = events.at(-1).completedArtifactCount;
  let remainingBudget = maximumOperationCount;
  const pending = plan.artifacts.slice(completedArtifactCount);
  const pendingSqlite = pending
    .slice(0, remainingBudget)
    .filter(artifact => artifact.storageClass === "prospective_coordinator_sqlite");
  if (pendingSqlite.length > 0) {
    const byRepository = new Map();
    for (const artifact of pendingSqlite) {
      const repository = coordinatorRepositoryForArtifact(repositories, artifact);
      if (repository) {
        const current = readRowForArtifact(repository, artifact);
        if (sha256(stableJson(current)) !== artifact.artifactSha256) {
          fail("route_iq_retention_artifact_integrity_changed", "A coordinator artifact changed before deletion.", {
            artifactIdentitySha256: artifact.artifactIdentitySha256
          }, 409);
        }
        if (!byRepository.has(repository)) byRepository.set(repository, []);
        byRepository.get(repository).push(artifact);
      }
    }
    for (const [repository, artifacts] of byRepository) deleteCoordinatorArtifacts(repository, artifacts);
  }

  while (completedArtifactCount < plan.totalArtifactCount && remainingBudget > 0) {
    const artifact = plan.artifacts[completedArtifactCount];
    if (artifact.storageClass === "prospective_coordinator_sqlite") {
      if (!(await artifactIsAbsent(artifact, archiveStore, repositories))) {
        break;
      }
    } else {
      const value = await archiveStore.get(artifact.key);
      if (value !== null) {
        if (sha256(value) !== artifact.artifactSha256 || Buffer.byteLength(value) !== artifact.byteLength) {
          fail("route_iq_retention_artifact_integrity_changed", "A planned archive artifact changed before deletion.", {
            artifactIdentitySha256: artifact.artifactIdentitySha256
          }, 409);
        }
        await archiveStore.delete(artifact.key);
      }
      if ((await archiveStore.get(artifact.key)) !== null) {
        fail("route_iq_retention_archive_delete_incomplete", "Archive retention deletion was incomplete.", {}, 500);
      }
    }
    completedArtifactCount += 1;
    remainingBudget -= 1;
    const cursor = completedArtifactCount < plan.totalArtifactCount
      ? continuationCursor(plan.planSha256, completedArtifactCount)
      : null;
    const event = await options.retentionGovernanceLedger.appendDeletionEvent({
      eventType: "ARTIFACT_DELETED",
      recordedAt: eventTimestamp(requested.iso, completedArtifactCount + 1),
      deletionPlanSha256: plan.planSha256,
      operationReceiptSha256: receipt.recordSha256,
      legalHoldSnapshotIdentitySha256: plan.legalHoldSnapshotIdentitySha256,
      artifact: {
        ordinal: artifact.ordinal,
        storageClass: artifact.storageClass,
        artifactIdentitySha256: artifact.artifactIdentitySha256,
        artifactSha256: artifact.artifactSha256,
        byteLength: artifact.byteLength
      },
      totalArtifactCount: plan.totalArtifactCount,
      completedArtifactCount,
      continuationCursor: cursor
    });
    validateRouteIqRetentionDeletionEvent(event, options.retentionGovernanceLedger);
    await archiveStore.put(stateKey, deletionState(
      plan,
      "DELETION_IN_PROGRESS",
      started.recordedAt,
      event.recordedAt,
      completedArtifactCount
    ));
  }

  if (completedArtifactCount < plan.totalArtifactCount) {
    return deepFreeze({
      ok: true,
      state: "DELETION_IN_PROGRESS",
      idempotent: false,
      planSha256: plan.planSha256,
      operationReceiptSha256: receipt.recordSha256,
      completionReceiptSha256: null,
      totalArtifactCount: plan.totalArtifactCount,
      completedArtifactCount,
      continuationCursor: continuationCursor(plan.planSha256, completedArtifactCount)
    });
  }
  for (const artifact of plan.artifacts) {
    if (!(await artifactIsAbsent(artifact, archiveStore, repositories))) {
      fail("route_iq_retention_deletion_verification_failed", "A targeted artifact remains after deletion.", {
        artifactIdentitySha256: artifact.artifactIdentitySha256
      }, 500);
    }
  }
  const completedAt = eventTimestamp(requested.iso, plan.totalArtifactCount + 2);
  const completion = await options.retentionGovernanceLedger.appendDeletionEvent({
    eventType: "DELETION_COMPLETED",
    recordedAt: completedAt,
    deletionPlanSha256: plan.planSha256,
    operationReceiptSha256: receipt.recordSha256,
    legalHoldSnapshotIdentitySha256: plan.legalHoldSnapshotIdentitySha256,
    artifact: null,
    totalArtifactCount: plan.totalArtifactCount,
    completedArtifactCount: plan.totalArtifactCount,
    continuationCursor: null
  });
  validateRouteIqRetentionDeletionEvent(completion, options.retentionGovernanceLedger);
  await archiveStore.put(stateKey, deletionState(
    plan,
    "DELETION_COMPLETED",
    started.recordedAt,
    completedAt,
    plan.totalArtifactCount
  ));
  return deepFreeze({
    ok: true,
    state: "DELETION_COMPLETED",
    idempotent: false,
    planSha256: plan.planSha256,
    operationReceiptSha256: receipt.recordSha256,
    completionReceiptSha256: completion.recordSha256,
    totalArtifactCount: plan.totalArtifactCount,
    completedArtifactCount: plan.totalArtifactCount,
    continuationCursor: null
  });
}
