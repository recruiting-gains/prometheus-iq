import {
  ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES,
  ROUTE_IQ_BUSINESS_AVAILABILITY_LIMITS,
  ROUTE_IQ_BUSINESS_AVAILABILITY_VERSIONS,
  RouteIqBusinessAvailabilityError,
  failRouteIqBusinessAvailability,
  routeIqBusinessAvailabilityCanonicalJson,
  routeIqBusinessAvailabilityExactKeys,
  routeIqBusinessAvailabilitySha256,
  routeIqBusinessAvailabilityUtf8Bytes,
  validateRouteIqBusinessAvailabilityScope,
  validateRouteIqBusinessAvailabilitySnapshot
} from "./route-iq-business-availability-contract.js";

const DurableObjectBase = globalThis.navigator?.userAgent === "Cloudflare-Workers"
  ? (await import("cloudflare:workers")).DurableObject
  : class NoncanonicalNodeDurableObjectShim {
    constructor(ctx, env) {
      this.ctx = ctx;
      this.env = env;
    }
  };

const NONCANONICAL_TEST_MODE = "ROUTE_IQ_BUSINESS_AVAILABILITY_NONCANONICAL_TEST";
const CRASH_BEFORE_CANONICAL = "before_canonical_transaction";
const CRASH_AFTER_CANONICAL = "after_canonical_before_projection_commit";
const CRASH_AFTER_PROJECTION_COMMIT = "after_projection_commit_before_response";
const FAILURE_CODES = new Set([
  "PROVIDER_TIMEOUT",
  "PROVIDER_NETWORK_FAILED",
  "PROVIDER_AUTHORIZATION_DENIED",
  "PROVIDER_RATE_LIMITED",
  "PROVIDER_UNAVAILABLE",
  "PROVIDER_RESPONSE_INVALID",
  "DATA_PROJECTION_INVALID",
  "DATA_PRODUCER_UNAVAILABLE"
]);

const SCHEMA = `
CREATE TABLE IF NOT EXISTS coordinator_scope (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  workspace_id TEXT NOT NULL,
  operating_profile_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS coordinator_counters (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  next_sequence INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS accepted_snapshots (
  snapshot_id TEXT PRIMARY KEY,
  sequence INTEGER NOT NULL UNIQUE,
  refresh_batch_id TEXT NOT NULL UNIQUE,
  canonical_payload_sha256 TEXT NOT NULL,
  manifest_id TEXT NOT NULL,
  manifest_version TEXT NOT NULL,
  manifest_artifact_sha256 TEXT NOT NULL,
  configuration_version TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  accepted_at TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  receipt_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS refresh_conflicts (
  conflict_id TEXT PRIMARY KEY,
  sequence INTEGER NOT NULL UNIQUE,
  refresh_batch_id TEXT NOT NULL,
  accepted_payload_sha256 TEXT NOT NULL,
  conflicting_payload_sha256 TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  UNIQUE (refresh_batch_id, conflicting_payload_sha256)
);
CREATE TABLE IF NOT EXISTS refresh_failures (
  failure_id TEXT PRIMARY KEY,
  sequence INTEGER NOT NULL UNIQUE,
  refresh_batch_id TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  UNIQUE (refresh_batch_id, reason_code)
);
CREATE TABLE IF NOT EXISTS transition_history (
  event_id TEXT PRIMARY KEY,
  sequence INTEGER NOT NULL UNIQUE,
  event_kind TEXT NOT NULL,
  refresh_batch_id TEXT NOT NULL,
  snapshot_id TEXT,
  reason_code TEXT,
  payload_sha256 TEXT,
  authoritative_record_time TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS projection_outbox (
  outbox_id TEXT PRIMARY KEY,
  sequence INTEGER NOT NULL UNIQUE,
  snapshot_id TEXT NOT NULL,
  payload_sha256 TEXT NOT NULL,
  authoritative_record_time TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS projection_commits (
  outbox_id TEXT PRIMARY KEY,
  committed_at TEXT NOT NULL,
  FOREIGN KEY (outbox_id) REFERENCES projection_outbox(outbox_id)
);
CREATE INDEX IF NOT EXISTS accepted_snapshots_manifest_sequence
  ON accepted_snapshots (
    manifest_id,
    manifest_version,
    manifest_artifact_sha256,
    configuration_version,
    sequence DESC
  );
`;

function nowIso(clock = () => new Date()) {
  const value = clock();
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    failRouteIqBusinessAvailability(ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.storageUnavailable);
  }
  return date.toISOString();
}

function consumeCursor(cursor, maximumRows = 10_000) {
  const rows = [];
  while (true) {
    const item = cursor.next();
    if (item.done) break;
    rows.push(item.value);
    if (rows.length > maximumRows) {
      failRouteIqBusinessAvailability(ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.storageBudgetExceeded, 429);
    }
  }
  return rows;
}

export class RouteIqBusinessAvailabilitySqliteRepository {
  constructor(storage) {
    if (!storage?.sql?.exec || typeof storage.transactionSync !== "function") {
      failRouteIqBusinessAvailability(ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.storageUnavailable);
    }
    this.storage = storage;
    this.sql = storage.sql;
  }

  initialize() {
    if (routeIqBusinessAvailabilityUtf8Bytes(SCHEMA) > 64 * 1024) {
      failRouteIqBusinessAvailability(ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.storageUnavailable);
    }
    consumeCursor(this.sql.exec(SCHEMA), 0);
    consumeCursor(this.sql.exec(`
      INSERT INTO coordinator_counters (singleton, next_sequence)
      VALUES (1, 1)
      ON CONFLICT(singleton) DO NOTHING
    `), 0);
  }

  rows(sql, bindings = []) {
    if (typeof sql !== "string"
      || routeIqBusinessAvailabilityUtf8Bytes(sql) > 64 * 1024
      || !Array.isArray(bindings)
      || bindings.length > 64) {
      failRouteIqBusinessAvailability(ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.storageUnavailable);
    }
    return consumeCursor(this.sql.exec(sql, ...bindings));
  }

  one(sql, bindings = []) {
    return this.rows(sql, bindings)[0] || null;
  }

  transaction(callback) {
    return this.storage.transactionSync(callback);
  }

  databaseSize() {
    const size = Number(this.sql.databaseSize);
    if (!Number.isSafeInteger(size) || size < 0) {
      failRouteIqBusinessAvailability(ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.storageUnavailable);
    }
    return size;
  }
}

function scopeKey(scope) {
  return `${scope.workspaceId}\u0000${scope.operatingProfileId}`;
}

function assertCommandSize(command) {
  if (routeIqBusinessAvailabilityUtf8Bytes(JSON.stringify(command))
    > ROUTE_IQ_BUSINESS_AVAILABILITY_LIMITS.commandBytes) {
    failRouteIqBusinessAvailability(ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.recordBudgetExceeded, 413);
  }
}

function assertRefreshBatchId(value) {
  if (typeof value !== "string" || !/^riq_refresh_[a-f0-9]{32}$/u.test(value)) {
    failRouteIqBusinessAvailability(ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.snapshotInvalid);
  }
}

function assertScope(repository, scope, authoritativeRecordTime) {
  const existing = repository.one(`
    SELECT workspace_id, operating_profile_id
    FROM coordinator_scope
    WHERE singleton = 1
  `);
  if (!existing) {
    repository.rows(`
      INSERT INTO coordinator_scope (
        singleton,
        workspace_id,
        operating_profile_id,
        created_at
      ) VALUES (1, ?, ?, ?)
    `, [scope.workspaceId, scope.operatingProfileId, authoritativeRecordTime]);
    return;
  }
  if (existing.workspace_id !== scope.workspaceId
    || existing.operating_profile_id !== scope.operatingProfileId) {
    failRouteIqBusinessAvailability(ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.scopeUnauthorized, 403);
  }
}

function nextSequence(repository) {
  const counter = repository.one(`
    SELECT next_sequence
    FROM coordinator_counters
    WHERE singleton = 1
  `);
  const sequence = Number(counter?.next_sequence);
  if (!Number.isSafeInteger(sequence) || sequence < 1) {
    failRouteIqBusinessAvailability(ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.storageUnavailable);
  }
  repository.rows(`
    UPDATE coordinator_counters
    SET next_sequence = ?
    WHERE singleton = 1
  `, [sequence + 1]);
  return sequence;
}

function snapshotCount(repository) {
  return Number(repository.one("SELECT COUNT(*) AS count FROM accepted_snapshots")?.count || 0);
}

function conflictCount(repository) {
  return Number(repository.one("SELECT COUNT(*) AS count FROM refresh_conflicts")?.count || 0);
}

function failureCount(repository) {
  return Number(repository.one("SELECT COUNT(*) AS count FROM refresh_failures")?.count || 0);
}

function pendingOutboxCount(repository) {
  return Number(repository.one(`
    SELECT COUNT(*) AS count
    FROM projection_outbox o
    LEFT JOIN projection_commits c ON c.outbox_id = o.outbox_id
    WHERE c.outbox_id IS NULL
  `)?.count || 0);
}

function assertStorageBudgets(repository, { accepting = false, conflict = false, failure = false } = {}) {
  if (repository.databaseSize() > ROUTE_IQ_BUSINESS_AVAILABILITY_LIMITS.storageBytesPerCoordinator) {
    failRouteIqBusinessAvailability(ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.storageBudgetExceeded, 429);
  }
  if (pendingOutboxCount(repository) >= ROUTE_IQ_BUSINESS_AVAILABILITY_LIMITS.pendingOutbox) {
    failRouteIqBusinessAvailability(ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.outboxBudgetExceeded, 429);
  }
  if (accepting && snapshotCount(repository) >= ROUTE_IQ_BUSINESS_AVAILABILITY_LIMITS.snapshotsPerCoordinator) {
    failRouteIqBusinessAvailability(ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.storageBudgetExceeded, 429);
  }
  if (conflict && conflictCount(repository) >= ROUTE_IQ_BUSINESS_AVAILABILITY_LIMITS.conflictsPerCoordinator) {
    failRouteIqBusinessAvailability(ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.storageBudgetExceeded, 429);
  }
  if (failure && failureCount(repository) >= ROUTE_IQ_BUSINESS_AVAILABILITY_LIMITS.failuresPerCoordinator) {
    failRouteIqBusinessAvailability(ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.storageBudgetExceeded, 429);
  }
}

function recoverPendingProjectionCommits(repository, authoritativeRecordTime) {
  const pending = repository.rows(`
    SELECT o.outbox_id
    FROM projection_outbox o
    LEFT JOIN projection_commits c ON c.outbox_id = o.outbox_id
    WHERE c.outbox_id IS NULL
    ORDER BY o.sequence ASC
    LIMIT ?
  `, [ROUTE_IQ_BUSINESS_AVAILABILITY_LIMITS.pendingOutbox]);
  for (const item of pending) {
    repository.transaction(() => {
      repository.rows(`
        INSERT INTO projection_commits (outbox_id, committed_at)
        VALUES (?, ?)
        ON CONFLICT(outbox_id) DO NOTHING
      `, [item.outbox_id, authoritativeRecordTime]);
    });
  }
  return pending.length;
}

function fixedMonitoringEvent(event, counters = {}) {
  const payload = {
    event,
    acceptedSnapshots: Number(counters.acceptedSnapshots || 0),
    conflicts: Number(counters.conflicts || 0),
    failures: Number(counters.failures || 0),
    pendingOutbox: Number(counters.pendingOutbox || 0),
    recoveredOutbox: Number(counters.recoveredOutbox || 0)
  };
  console.info(JSON.stringify(payload));
}

function monitoringSummary(repository, recoveredOutbox = 0) {
  return {
    acceptedSnapshots: snapshotCount(repository),
    conflicts: conflictCount(repository),
    failures: failureCount(repository),
    pendingOutbox: pendingOutboxCount(repository),
    recoveredOutbox
  };
}

export class RouteIqBusinessAvailabilityCoordinator extends DurableObjectBase {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      const repository = new RouteIqBusinessAvailabilitySqliteRepository(ctx.storage);
      repository.initialize();
    });
  }

  repository() {
    return new RouteIqBusinessAvailabilitySqliteRepository(this.ctx.storage);
  }

  async acceptNormalizedSnapshot(command) {
    const testMode = this.env?.[NONCANONICAL_TEST_MODE] === "ON";
    routeIqBusinessAvailabilityExactKeys(
      command,
      testMode ? ["scope", "snapshot", "noncanonicalCrashBoundary"] : ["scope", "snapshot"]
    );
    if (testMode && ![
      null,
      CRASH_BEFORE_CANONICAL,
      CRASH_AFTER_CANONICAL,
      CRASH_AFTER_PROJECTION_COMMIT
    ].includes(command.noncanonicalCrashBoundary)) {
      failRouteIqBusinessAvailability(ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.snapshotInvalid);
    }
    assertCommandSize(command);
    const scope = validateRouteIqBusinessAvailabilityScope(command.scope);
    const acceptedAt = nowIso();
    const snapshot = await validateRouteIqBusinessAvailabilitySnapshot(
      command.snapshot,
      scope,
      { now: new Date(acceptedAt) }
    );
    if (snapshot.refreshBatchId !== command.snapshot.refreshBatchId) {
      failRouteIqBusinessAvailability(ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.snapshotInvalid);
    }
    assertRefreshBatchId(snapshot.refreshBatchId);
    const repository = this.repository();
    const recoveredOutbox = recoverPendingProjectionCommits(repository, acceptedAt);
    assertScope(repository, scope, acceptedAt);

    const existing = repository.one(`
      SELECT
        snapshot_id,
        canonical_payload_sha256,
        receipt_json
      FROM accepted_snapshots
      WHERE refresh_batch_id = ?
    `, [snapshot.refreshBatchId]);
    if (existing?.canonical_payload_sha256 === snapshot.canonicalPayloadSha256) {
      recoverPendingProjectionCommits(repository, acceptedAt);
      const receipt = JSON.parse(existing.receipt_json);
      fixedMonitoringEvent("ROUTE_IQ_AVAILABILITY_IDEMPOTENT_RETRY", monitoringSummary(repository, recoveredOutbox));
      return receipt;
    }
    if (existing) {
      assertStorageBudgets(repository, { conflict: true });
      const conflictId = `riq_availability_conflict_${(
        await routeIqBusinessAvailabilitySha256(
          `${snapshot.refreshBatchId}\u0000${snapshot.canonicalPayloadSha256}`
        )
      ).slice(0, 32)}`;
      repository.transaction(() => {
        const priorConflict = repository.one(`
          SELECT conflict_id
          FROM refresh_conflicts
          WHERE refresh_batch_id = ? AND conflicting_payload_sha256 = ?
        `, [snapshot.refreshBatchId, snapshot.canonicalPayloadSha256]);
        if (priorConflict) return;
        const sequence = nextSequence(repository);
        repository.rows(`
          INSERT INTO refresh_conflicts (
            conflict_id,
            sequence,
            refresh_batch_id,
            accepted_payload_sha256,
            conflicting_payload_sha256,
            recorded_at
          ) VALUES (?, ?, ?, ?, ?, ?)
        `, [
          conflictId,
          sequence,
          snapshot.refreshBatchId,
          existing.canonical_payload_sha256,
          snapshot.canonicalPayloadSha256,
          acceptedAt
        ]);
        repository.rows(`
          INSERT INTO transition_history (
            event_id,
            sequence,
            event_kind,
            refresh_batch_id,
            snapshot_id,
            reason_code,
            payload_sha256,
            authoritative_record_time
          ) VALUES (?, ?, 'REFRESH_CONFLICT_RECORDED', ?, ?, ?, ?, ?)
        `, [
          `riq_availability_event_${String(sequence).padStart(16, "0")}`,
          sequence,
          snapshot.refreshBatchId,
          existing.snapshot_id,
          ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.snapshotConflict,
          snapshot.canonicalPayloadSha256,
          acceptedAt
        ]);
      });
      fixedMonitoringEvent("ROUTE_IQ_AVAILABILITY_CONFLICT", monitoringSummary(repository, recoveredOutbox));
      failRouteIqBusinessAvailability(ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.snapshotConflict, 409);
    }

    assertStorageBudgets(repository, { accepting: true });
    if (testMode && command.noncanonicalCrashBoundary === CRASH_BEFORE_CANONICAL) {
      throw new RouteIqBusinessAvailabilityError("noncanonical_crash_before_canonical", 599);
    }
    const snapshotId = `riq_availability_snapshot_${snapshot.canonicalPayloadSha256.slice(0, 32)}`;
    let receipt;
    repository.transaction(() => {
      const sequence = nextSequence(repository);
      const outboxId = `riq_availability_outbox_${String(sequence).padStart(16, "0")}`;
      receipt = {
        contractVersion: ROUTE_IQ_BUSINESS_AVAILABILITY_VERSIONS.coordinator,
        status: "ACCEPTED",
        snapshotId,
        refreshBatchId: snapshot.refreshBatchId,
        sequence,
        canonicalPayloadSha256: snapshot.canonicalPayloadSha256,
        acceptedAt
      };
      repository.rows(`
        INSERT INTO accepted_snapshots (
          snapshot_id,
          sequence,
          refresh_batch_id,
          canonical_payload_sha256,
          manifest_id,
          manifest_version,
          manifest_artifact_sha256,
          configuration_version,
          generated_at,
          expires_at,
          accepted_at,
          payload_json,
          receipt_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        snapshotId,
        sequence,
        snapshot.refreshBatchId,
        snapshot.canonicalPayloadSha256,
        snapshot.manifest.manifestId,
        snapshot.manifest.manifestVersion,
        snapshot.manifest.artifactSha256,
        snapshot.manifest.configurationVersion,
        snapshot.generatedAt,
        snapshot.expiresAt,
        acceptedAt,
        routeIqBusinessAvailabilityCanonicalJson(snapshot),
        routeIqBusinessAvailabilityCanonicalJson(receipt)
      ]);
      repository.rows(`
        INSERT INTO transition_history (
          event_id,
          sequence,
          event_kind,
          refresh_batch_id,
          snapshot_id,
          reason_code,
          payload_sha256,
          authoritative_record_time
        ) VALUES (?, ?, 'SNAPSHOT_ACCEPTED', ?, ?, NULL, ?, ?)
      `, [
        `riq_availability_event_${String(sequence).padStart(16, "0")}`,
        sequence,
        snapshot.refreshBatchId,
        snapshotId,
        snapshot.canonicalPayloadSha256,
        acceptedAt
      ]);
      repository.rows(`
        INSERT INTO projection_outbox (
          outbox_id,
          sequence,
          snapshot_id,
          payload_sha256,
          authoritative_record_time
        ) VALUES (?, ?, ?, ?, ?)
      `, [
        outboxId,
        sequence,
        snapshotId,
        snapshot.canonicalPayloadSha256,
        acceptedAt
      ]);
    });

    if (testMode && command.noncanonicalCrashBoundary === CRASH_AFTER_CANONICAL) {
      throw new RouteIqBusinessAvailabilityError("noncanonical_crash_after_canonical", 599);
    }
    recoverPendingProjectionCommits(repository, acceptedAt);
    if (testMode && command.noncanonicalCrashBoundary === CRASH_AFTER_PROJECTION_COMMIT) {
      throw new RouteIqBusinessAvailabilityError("noncanonical_crash_after_projection_commit", 599);
    }
    fixedMonitoringEvent("ROUTE_IQ_AVAILABILITY_ACCEPTED", monitoringSummary(repository, recoveredOutbox));
    return receipt;
  }

  async recordRefreshFailure(command) {
    routeIqBusinessAvailabilityExactKeys(command, ["scope", "refreshBatchId", "reasonCode"]);
    assertCommandSize(command);
    const scope = validateRouteIqBusinessAvailabilityScope(command.scope);
    assertRefreshBatchId(command.refreshBatchId);
    if (!FAILURE_CODES.has(command.reasonCode)) {
      failRouteIqBusinessAvailability(ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.producerContractInvalid);
    }
    const repository = this.repository();
    const recordedAt = nowIso();
    const recoveredOutbox = recoverPendingProjectionCommits(repository, recordedAt);
    assertScope(repository, scope, recordedAt);
    const existing = repository.one(`
      SELECT failure_id, sequence, recorded_at
      FROM refresh_failures
      WHERE refresh_batch_id = ? AND reason_code = ?
    `, [command.refreshBatchId, command.reasonCode]);
    if (existing) {
      return {
        contractVersion: ROUTE_IQ_BUSINESS_AVAILABILITY_VERSIONS.coordinator,
        status: "FAILURE_RECORDED",
        failureId: existing.failure_id,
        sequence: Number(existing.sequence),
        recordedAt: existing.recorded_at
      };
    }
    assertStorageBudgets(repository, { failure: true });
    let receipt;
    repository.transaction(() => {
      const sequence = nextSequence(repository);
      const failureId = `riq_availability_failure_${String(sequence).padStart(16, "0")}`;
      repository.rows(`
        INSERT INTO refresh_failures (
          failure_id,
          sequence,
          refresh_batch_id,
          reason_code,
          recorded_at
        ) VALUES (?, ?, ?, ?, ?)
      `, [failureId, sequence, command.refreshBatchId, command.reasonCode, recordedAt]);
      repository.rows(`
        INSERT INTO transition_history (
          event_id,
          sequence,
          event_kind,
          refresh_batch_id,
          snapshot_id,
          reason_code,
          payload_sha256,
          authoritative_record_time
        ) VALUES (?, ?, 'REFRESH_FAILURE_RECORDED', ?, NULL, ?, NULL, ?)
      `, [
        `riq_availability_event_${String(sequence).padStart(16, "0")}`,
        sequence,
        command.refreshBatchId,
        command.reasonCode,
        recordedAt
      ]);
      receipt = {
        contractVersion: ROUTE_IQ_BUSINESS_AVAILABILITY_VERSIONS.coordinator,
        status: "FAILURE_RECORDED",
        failureId,
        sequence,
        recordedAt
      };
    });
    fixedMonitoringEvent("ROUTE_IQ_AVAILABILITY_REFRESH_FAILED", monitoringSummary(repository, recoveredOutbox));
    return receipt;
  }

  async readLatestSnapshot(command) {
    routeIqBusinessAvailabilityExactKeys(command, ["scope", "authorizedTerritoryIds"]);
    assertCommandSize(command);
    const scope = validateRouteIqBusinessAvailabilityScope(command.scope);
    if (!Array.isArray(command.authorizedTerritoryIds)
      || command.authorizedTerritoryIds.length < 1
      || command.authorizedTerritoryIds.length > ROUTE_IQ_BUSINESS_AVAILABILITY_LIMITS.territoriesPerScope
      || command.authorizedTerritoryIds.some(territoryId => !scope.territoryIds.includes(territoryId))
      || new Set(command.authorizedTerritoryIds).size !== command.authorizedTerritoryIds.length
      || command.authorizedTerritoryIds.some((value, index) => (
        value !== [...command.authorizedTerritoryIds].sort()[index]
      ))) {
      failRouteIqBusinessAvailability(ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.territoryUnauthorized, 403);
    }
    const repository = this.repository();
    const readAt = nowIso();
    const recoveredOutbox = recoverPendingProjectionCommits(repository, readAt);
    assertScope(repository, scope, readAt);
    assertStorageBudgets(repository);
    const row = repository.one(`
      SELECT
        s.snapshot_id,
        s.sequence,
        s.canonical_payload_sha256,
        s.generated_at,
        s.expires_at,
        s.accepted_at,
        s.payload_json
      FROM accepted_snapshots s
      JOIN projection_outbox o ON o.snapshot_id = s.snapshot_id
      JOIN projection_commits c ON c.outbox_id = o.outbox_id
      WHERE s.manifest_id = ?
        AND s.manifest_version = ?
        AND s.manifest_artifact_sha256 = ?
        AND s.configuration_version = ?
      ORDER BY s.sequence DESC
      LIMIT 1
    `, [
      scope.manifestId,
      scope.manifestVersion,
      scope.manifestArtifactSha256,
      scope.configurationVersion
    ]);
    if (!row) {
      failRouteIqBusinessAvailability(ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.noSnapshot, 404);
    }
    const snapshot = JSON.parse(row.payload_json);
    const territorySet = new Set(command.authorizedTerritoryIds);
    const records = snapshot.records.filter(record => territorySet.has(record.territoryId));
    const result = {
      contractVersion: ROUTE_IQ_BUSINESS_AVAILABILITY_VERSIONS.read,
      workspaceId: scope.workspaceId,
      operatingProfileId: scope.operatingProfileId,
      manifest: {
        manifestId: scope.manifestId,
        manifestVersion: scope.manifestVersion,
        artifactSha256: scope.manifestArtifactSha256,
        configurationVersion: scope.configurationVersion
      },
      snapshot: {
        snapshotId: row.snapshot_id,
        sequence: Number(row.sequence),
        canonicalPayloadSha256: row.canonical_payload_sha256,
        generatedAt: row.generated_at,
        expiresAt: row.expires_at,
        acceptedAt: row.accepted_at,
        freshnessState: Date.parse(row.expires_at) > Date.parse(readAt) ? "FRESH" : "STALE",
        canonicalRecordCount: snapshot.recordCount,
        returnedRecordCount: records.length
      },
      authorizedTerritoryIds: [...command.authorizedTerritoryIds],
      records
    };
    fixedMonitoringEvent("ROUTE_IQ_AVAILABILITY_READ", monitoringSummary(repository, recoveredOutbox));
    return result;
  }

  async readMonitoringSummary(command) {
    routeIqBusinessAvailabilityExactKeys(command, ["scope"]);
    const scope = validateRouteIqBusinessAvailabilityScope(command.scope);
    const repository = this.repository();
    const readAt = nowIso();
    const recoveredOutbox = recoverPendingProjectionCommits(repository, readAt);
    assertScope(repository, scope, readAt);
    return {
      contractVersion: ROUTE_IQ_BUSINESS_AVAILABILITY_VERSIONS.coordinator,
      ...monitoringSummary(repository, recoveredOutbox)
    };
  }
}

export {
  CRASH_AFTER_PROJECTION_COMMIT,
  CRASH_AFTER_CANONICAL,
  CRASH_BEFORE_CANONICAL,
  NONCANONICAL_TEST_MODE
};
