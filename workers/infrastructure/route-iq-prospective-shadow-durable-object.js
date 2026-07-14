import {
  initializeRouteIqProspectiveCoordinatorSchema,
  openRouteIqProspectiveCoordinator
} from "../../data/route-iq-field-sessions-v1/route-iq-prospective-shadow-coordinator.mjs";
import {
  ROUTE_IQ_PROSPECTIVE_BROWSER_EVENT_KINDS,
  ROUTE_IQ_PROSPECTIVE_SHADOW_BUDGETS,
  assertExactKeys,
  canonicalIsoTimestamp,
  failRouteIqProspective,
  stableJson,
  utf8ByteLength
} from "./route-iq-prospective-shadow-contract.js";
import {
  createRouteIqProspectiveAuthorityVerifier
} from "./route-iq-prospective-shadow-authority.js";

const DurableObjectBase = globalThis.navigator?.userAgent === "Cloudflare-Workers"
  ? (await import("cloudflare:workers")).DurableObject
  : class NoncanonicalNodeDurableObjectShim {
    constructor(ctx, env) {
      this.ctx = ctx;
      this.env = env;
    }
  };

function requireSqlBinding(value, path) {
  if (value !== null && typeof value !== "string" && typeof value !== "number" && !(value instanceof ArrayBuffer)) {
    failRouteIqProspective(`${path} is not a supported SQLite binding.`, "route_iq_prospective_sql_binding_invalid", 500);
  }
  return value;
}

export class CloudflareRouteIqProspectiveSqliteRepository {
  constructor(storage, budgets = ROUTE_IQ_PROSPECTIVE_SHADOW_BUDGETS) {
    if (!storage?.sql?.exec || typeof storage.transactionSync !== "function") {
      failRouteIqProspective(
        "SQLite Durable Object storage is unavailable.",
        "route_iq_prospective_sqlite_storage_missing",
        500
      );
    }
    this.storage = storage;
    this.sql = storage.sql;
    this.budgets = budgets;
    this.statements = 0;
    this.rowsRead = 0;
    this.rowsWritten = 0;
  }

  executeSchema(sql) {
    if (typeof sql !== "string" || utf8ByteLength(sql) > 512 * 1024) {
      failRouteIqProspective("Coordinator schema is invalid.", "route_iq_prospective_schema_invalid", 500);
    }
    const cursor = this.sql.exec(sql);
    while (!cursor.next().done) {
      // Schema initialization must fully consume the final statement cursor.
    }
  }

  execute(sql, bindings = []) {
    if (typeof sql !== "string" || !Array.isArray(bindings) || bindings.length > 512) {
      failRouteIqProspective("SQLite operation is invalid.", "route_iq_prospective_sql_operation_invalid", 500);
    }
    this.statements += 1;
    if (this.statements > this.budgets.sqlStatementsPerRpc) {
      failRouteIqProspective("SQLite statement budget exceeded.", "route_iq_prospective_sql_budget_exceeded", 429);
    }
    const cursor = this.sql.exec(sql, ...bindings.map((binding, index) => requireSqlBinding(binding, `bindings[${index}]`)));
    const rows = [];
    let cursorRowsRead = 0;
    while (true) {
      const entry = cursor.next();
      cursorRowsRead = cursor.rowsRead || 0;
      if (this.rowsRead + cursorRowsRead > this.budgets.rowsReadPerRpc) {
        failRouteIqProspective("SQLite row-read budget exceeded.", "route_iq_prospective_sql_read_budget_exceeded", 429);
      }
      if (entry.done) break;
      rows.push(entry.value);
    }
    this.rowsRead += cursorRowsRead;
    this.rowsWritten += cursor.rowsWritten || 0;
    if (this.rowsRead > this.budgets.rowsReadPerRpc) {
      failRouteIqProspective("SQLite row-read budget exceeded.", "route_iq_prospective_sql_read_budget_exceeded", 429);
    }
    if (this.rowsWritten > this.budgets.rowsWrittenPerRpc) {
      failRouteIqProspective("SQLite row-write budget exceeded.", "route_iq_prospective_sql_write_budget_exceeded", 429);
    }
    return rows;
  }

  transactionSync(callback) {
    if (typeof callback !== "function") {
      failRouteIqProspective("SQLite transaction callback is invalid.", "route_iq_prospective_sql_transaction_invalid", 500);
    }
    return this.storage.transactionSync(callback);
  }

  one(sql, bindings = []) {
    return this.execute(sql, bindings)[0] || null;
  }

  assertOperationalBudgets({ claims = null, now = new Date(), recovery = false, allocation = false } = {}) {
    const databaseSize = Number(this.sql.databaseSize);
    if (!Number.isSafeInteger(databaseSize)
      || databaseSize < 0
      || databaseSize > this.budgets.storageBytesPerCoordinator) {
      failRouteIqProspective("Coordinator storage budget exceeded.", "route_iq_prospective_storage_budget_exceeded", 429);
    }

    const pendingOutbox = Number(this.one(`
      SELECT COUNT(*) AS count
      FROM projection_outbox o
      LEFT JOIN projection_commits c ON c.outbox_id = o.outbox_id
      WHERE c.outbox_id IS NULL
    `)?.count || 0);
    if (!recovery && pendingOutbox >= this.budgets.pendingOutbox) {
      failRouteIqProspective("Projection outbox budget exceeded.", "route_iq_prospective_outbox_budget_exceeded", 429);
    }

    const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const eventsToday = Number(this.one(`
      SELECT COUNT(*) AS count
      FROM lifecycle_events
      WHERE authoritative_record_time >= ? AND authoritative_record_time < ?
    `, [dayStart.toISOString(), dayEnd.toISOString()])?.count || 0);
    if (!recovery && eventsToday >= this.budgets.eventsPerDay) {
      failRouteIqProspective("Daily coordinator event budget exceeded.", "route_iq_prospective_daily_budget_exceeded", 429);
    }

    if (claims?.purpose === "trigger"
      && claims?.canonicalSessionRecordSha256 !== undefined
      && claims?.sessionEventSequence !== undefined) {
      const opportunities = Number(this.one(`
        SELECT COUNT(*) AS count
        FROM opportunities o
        JOIN canonical_sessions s ON s.session_id = o.session_id
        WHERE s.canonical_session_record_sha256 = ? AND s.session_event_sequence = ?
      `, [claims.canonicalSessionRecordSha256, claims.sessionEventSequence])?.count || 0);
      if (opportunities >= this.budgets.opportunitiesPerSession) {
        failRouteIqProspective("Session opportunity budget exceeded.", "route_iq_prospective_session_budget_exceeded", 429);
      }
    }

    if (allocation) {
      const activeSession = this.one(`
        SELECT s.session_id
        FROM canonical_sessions s
        LEFT JOIN canonical_session_events closed
          ON closed.session_id = s.session_id AND closed.event_kind = 'CLOSED'
        WHERE closed.event_id IS NULL
        ORDER BY s.created_sequence DESC
        LIMIT 1
      `);
      if (activeSession) {
        const current = this.one(`
          SELECT state
          FROM opportunities
          WHERE session_id = ?
          ORDER BY opportunity_event_sequence DESC
          LIMIT 1
        `, [activeSession.session_id]);
        const opportunities = Number(this.one(`
          SELECT COUNT(*) AS count
          FROM opportunities
          WHERE session_id = ?
        `, [activeSession.session_id])?.count || 0);
        const retryableOpenState = [
          "TRIGGERED",
          "SNAPSHOT_PENDING_SEAL",
          "SNAPSHOT_SEALED",
          "SHADOW_DECISION_SEALED"
        ].includes(current?.state);
        if (opportunities >= this.budgets.opportunitiesPerSession && !retryableOpenState) {
          failRouteIqProspective("Session opportunity budget exceeded.", "route_iq_prospective_session_budget_exceeded", 429);
        }
      }
    }
  }
}

function assertCommandBytes(command) {
  if (utf8ByteLength(stableJson(command)) > ROUTE_IQ_PROSPECTIVE_SHADOW_BUDGETS.domainCommandBytes) {
    failRouteIqProspective("Durable Object command exceeds its byte budget.", "route_iq_prospective_domain_command_too_large", 413);
  }
}

function assertManifestBudgets(claims, producerEnvelope) {
  if (claims?.purpose !== "candidate_manifest") return;
  if (!Number.isInteger(claims.expectedCandidateCount)
    || claims.expectedCandidateCount < 1
    || claims.expectedCandidateCount > ROUTE_IQ_PROSPECTIVE_SHADOW_BUDGETS.candidateCount) {
    failRouteIqProspective("Candidate budget exceeded.", "route_iq_prospective_candidate_budget_exceeded", 429);
  }
  if (!Number.isInteger(claims.expectedSourceCount)
    || claims.expectedSourceCount < 1
    || claims.expectedSourceCount > ROUTE_IQ_PROSPECTIVE_SHADOW_BUDGETS.sourceCount) {
    failRouteIqProspective("Candidate source budget exceeded.", "route_iq_prospective_source_budget_exceeded", 429);
  }
  const producerClaims = producerEnvelope?.claims;
  if (producerClaims && typeof producerClaims === "object") {
    if ((Number.isInteger(producerClaims.candidateCount)
        && producerClaims.candidateCount > ROUTE_IQ_PROSPECTIVE_SHADOW_BUDGETS.candidateCount)
      || (Array.isArray(producerClaims.candidates)
        && producerClaims.candidates.length > ROUTE_IQ_PROSPECTIVE_SHADOW_BUDGETS.candidateCount)) {
      failRouteIqProspective("Candidate budget exceeded.", "route_iq_prospective_candidate_budget_exceeded", 429);
    }
    if ((Number.isInteger(producerClaims.sourceCount)
        && producerClaims.sourceCount > ROUTE_IQ_PROSPECTIVE_SHADOW_BUDGETS.sourceCount)
      || (Array.isArray(producerClaims.sourceManifest)
        && producerClaims.sourceManifest.length > ROUTE_IQ_PROSPECTIVE_SHADOW_BUDGETS.sourceCount)) {
      failRouteIqProspective("Candidate source budget exceeded.", "route_iq_prospective_source_budget_exceeded", 429);
    }
  }
}

function validateBrowserEvent(event) {
  assertExactKeys(event, ["eventKind", "informationalSequence", "informationalObservedAt"], "browserEvent");
  if (!ROUTE_IQ_PROSPECTIVE_BROWSER_EVENT_KINDS.includes(event.eventKind)) {
    failRouteIqProspective("Browser event kind is invalid.", "route_iq_prospective_event_kind_invalid", 400);
  }
  if (event.informationalSequence !== undefined
    && (!Number.isSafeInteger(event.informationalSequence)
      || event.informationalSequence < 0
      || event.informationalSequence > 1_000_000_000)) {
    failRouteIqProspective("Browser informational sequence is invalid.", "route_iq_prospective_sequence_invalid", 400);
  }
  if (event.informationalObservedAt !== undefined) {
    canonicalIsoTimestamp(event.informationalObservedAt, "browserEvent.informationalObservedAt");
  }
}

export class RouteIqProspectiveShadowCoordinator extends DurableObjectBase {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      const repository = new CloudflareRouteIqProspectiveSqliteRepository(ctx.storage);
      initializeRouteIqProspectiveCoordinatorSchema(repository);
    });
  }

  async openCoordinator(scopeEnvelope, repository) {
    const authorityVerifier = createRouteIqProspectiveAuthorityVerifier(this.env);
    const coordinator = await openRouteIqProspectiveCoordinator({
      repository,
      authorityVerifier,
      scopeEnvelope
    });
    return { authorityVerifier, coordinator };
  }

  async invokeDataDomain(command, { method, purpose }) {
    assertExactKeys(command, ["scopeEnvelope", "input"], `${method}Command`);
    assertCommandBytes(command);
    const repository = new CloudflareRouteIqProspectiveSqliteRepository(this.ctx.storage);
    const { authorityVerifier, coordinator } = await this.openCoordinator(command.scopeEnvelope, repository);
    const verification = await authorityVerifier.verify(command.input?.authorityEnvelope, { purpose });
    assertManifestBudgets(verification.claims, command.input?.producerEnvelope);
    repository.assertOperationalBudgets({ claims: verification.claims });
    return coordinator[method](command.input);
  }

  async allocateNextStopOpportunity(command) {
    assertExactKeys(command, ["scopeEnvelope", "event"], "browserSignalCommand");
    assertCommandBytes(command);
    validateBrowserEvent(command.event);
    if (command.event.eventKind !== "next_stop_requested") {
      failRouteIqProspective(
        "Only next-stop requests may allocate an opportunity.",
        "route_iq_prospective_allocator_event_invalid",
        400
      );
    }
    const repository = new CloudflareRouteIqProspectiveSqliteRepository(this.ctx.storage);
    const { coordinator } = await this.openCoordinator(command.scopeEnvelope, repository);
    repository.assertOperationalBudgets({ allocation: true });
    return coordinator.allocateNextStopOpportunity({ event: command.event });
  }

  async noteGovernedRepresentativeSignal(command) {
    assertExactKeys(command, ["scopeEnvelope", "event"], "governedRepresentativeSignalCommand");
    assertCommandBytes(command);
    validateBrowserEvent(command.event);
    if (![
      "representative_action_observed",
      "representative_outcome_observed"
    ].includes(command.event.eventKind)) {
      failRouteIqProspective(
        "Representative signal kind is invalid.",
        "route_iq_prospective_governed_noop_event_invalid",
        400
      );
    }
    const repository = new CloudflareRouteIqProspectiveSqliteRepository(this.ctx.storage);
    await this.openCoordinator(command.scopeEnvelope, repository);
    repository.assertOperationalBudgets();
    return { status: "governed_noop" };
  }

  async closeCanonicalSession(command) {
    assertExactKeys(command, ["scopeEnvelope", "authorityEnvelope"], "closeCanonicalSessionCommand");
    assertCommandBytes(command);
    const repository = new CloudflareRouteIqProspectiveSqliteRepository(this.ctx.storage);
    const { authorityVerifier, coordinator } = await this.openCoordinator(command.scopeEnvelope, repository);
    const verification = await authorityVerifier.verify(command.authorityEnvelope, { purpose: "close_session" });
    repository.assertOperationalBudgets({ claims: verification.claims });
    return coordinator.closeCanonicalSession({ authorityEnvelope: command.authorityEnvelope });
  }

  async applyTrustedTrigger(command) {
    return this.invokeDataDomain(command, { method: "trigger", purpose: "trigger" });
  }

  async applyTrustedCandidateManifest(command) {
    return this.invokeDataDomain(command, { method: "acceptCandidateManifest", purpose: "candidate_manifest" });
  }

  async applyTrustedSnapshotSeal(command) {
    return this.invokeDataDomain(command, { method: "sealSnapshot", purpose: "snapshot_seal_record" });
  }

  async applyTrustedShadowDecisionSeal(command) {
    return this.invokeDataDomain(command, { method: "sealShadowDecision", purpose: "shadow_decision_seal_record" });
  }

  async applyTrustedAction(command) {
    return this.invokeDataDomain(command, { method: "linkAction", purpose: "action" });
  }

  async applyTrustedOutcome(command) {
    return this.invokeDataDomain(command, { method: "linkOutcome", purpose: "outcome" });
  }

  async applyTrustedEvaluation(command) {
    return this.invokeDataDomain(command, { method: "evaluate", purpose: "evaluation" });
  }

  async applyTrustedCorrection(command) {
    return this.invokeDataDomain(command, { method: "appendCorrection", purpose: "correction" });
  }

  async recoverNextProjection(command) {
    assertExactKeys(command, ["scopeEnvelope"], "recoverProjectionCommand");
    assertCommandBytes(command);
    const repository = new CloudflareRouteIqProspectiveSqliteRepository(this.ctx.storage);
    const { coordinator } = await this.openCoordinator(command.scopeEnvelope, repository);
    repository.assertOperationalBudgets({ recovery: true });
    return coordinator.recoverNextProjection();
  }

  async readCommittedProjectionAsOf(command) {
    return this.invokeDataDomain(command, { method: "readCommittedProjectionAsOf", purpose: "projection_read" });
  }
}
