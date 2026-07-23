import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import {
  FieldSessionConflictError,
  FieldSessionStoreBindingError,
  createCloudflareKvFieldSessionStore,
  fieldSessionStorageKeys,
  persistRouteIqFieldSessionArchive,
  readRouteIqFieldSessionArchive,
  routeIqFieldSessionStoreBinding
} from "../data/route-iq-field-sessions-v1/route-iq-field-session-archive.mjs";
import {
  inspectRouteIqFieldSessionStoreBinding
} from "../scripts/verify-route-iq-field-session-store-binding.mjs";

const SESSION_ID = "route-iq-field-session-fitness-connection-fitness-cruz-2026-07-11";
const SESSION_ROOT = `data/route-iq-field-sessions-v1/workspaces/fitness_connection/sessions/${SESSION_ID}`;

function read(path) {
  return readFileSync(path, "utf8");
}

function json(path) {
  return JSON.parse(read(path));
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalArchivePackage() {
  const rawReportText = read(`${SESSION_ROOT}/raw/prometheus-iq-cruz-daily-report-2026-07-11.json`);
  return {
    sessionId: SESSION_ID,
    rawReportText,
    rawSha256: sha256(rawReportText),
    rawByteLength: Buffer.byteLength(rawReportText, "utf8"),
    normalizedRecord: json(`${SESSION_ROOT}/normalized/field-session.json`),
    calculatedMetrics: json(`${SESSION_ROOT}/normalized/calculated-metrics.json`),
    stressTestEvidence: json(`${SESSION_ROOT}/evidence/stress-test-observations.json`),
    historyUpdates: json(`${SESSION_ROOT}/normalized/history-updates.json`)
  };
}

function kvBinding() {
  const data = new Map();
  const writes = [];
  return {
    data,
    writes,
    async get(key) {
      return data.get(key)?.value ?? null;
    },
    async put(key, value, options = {}) {
      data.set(key, { value: String(value), options });
      writes.push({ key, value: String(value), options });
    },
    async list(options = {}) {
      const prefix = options.prefix || "";
      return {
        keys: [...data.keys()].filter(key => key.startsWith(prefix)).sort().map(name => ({ name })),
        list_complete: true
      };
    }
  };
}

test("private Route IQ Worker owns one dedicated field-session binding", () => {
  const inspection = inspectRouteIqFieldSessionStoreBinding();
  assert.equal(inspection.report.status, "passed");
  assert.equal(inspection.report.worker, "prometheus-iq");
  assert.equal(inspection.report.binding, routeIqFieldSessionStoreBinding);
  assert.equal(inspection.report.publicWorkerBindingPresent, false);
  assert.deepEqual(inspection.report.workspaceScope, ["fitness_connection"]);
  assert.equal(inspection.report.dashboardProducerStatus, "ACTIVE");
  assert.equal(inspection.report.dashboardTriggerImplemented, true);
  assert.equal(inspection.report.dashboardTriggerActivated, true);
  assert.equal(inspection.report.dashboardProductionState, "dashboard_producer_verified_live");
  assert.equal(inspection.report.intelligenceConsumptionAuthorized, false);
});

test("missing or malformed runtime bindings fail closed before writes", () => {
  assert.throws(() => createCloudflareKvFieldSessionStore({}), error => {
    assert.equal(error instanceof FieldSessionStoreBindingError, true);
    assert.equal(error.code, "field_session_store_binding_missing");
    assert.deepEqual(error.missingMethods, ["get", "put", "list"]);
    return true;
  });
});

test("canonical archive is append-only, idempotent, and committed last", async () => {
  const binding = kvBinding();
  const archivePackage = canonicalArchivePackage();
  const writer = createCloudflareKvFieldSessionStore({ [routeIqFieldSessionStoreBinding]: binding });
  const first = await persistRouteIqFieldSessionArchive(archivePackage, {
    store: writer,
    persistedAt: "2026-07-12T01:00:00.000Z"
  });
  const keys = fieldSessionStorageKeys("fitness_connection", SESSION_ID);
  assert.equal(first.status, "archived");
  assert.equal(binding.writes[0].key, keys.raw);
  assert.equal(binding.writes[0].options.metadata.appendOnly, true);
  assert.equal(binding.writes.at(-1).key, keys.commit);

  const originalWriteCount = binding.writes.length;
  const originalRaw = binding.data.get(keys.raw).value;
  const replayStore = createCloudflareKvFieldSessionStore({ [routeIqFieldSessionStoreBinding]: binding });
  const replay = await persistRouteIqFieldSessionArchive(archivePackage, {
    store: replayStore,
    persistedAt: "2026-07-12T01:01:00.000Z"
  });
  assert.equal(replay.status, "already_archived");
  assert.equal(replay.duplicate, true);
  assert.equal(binding.writes.length, originalWriteCount);
  assert.equal(binding.data.get(keys.raw).value, originalRaw);

  const reader = createCloudflareKvFieldSessionStore({ [routeIqFieldSessionStoreBinding]: binding });
  const readBack = await readRouteIqFieldSessionArchive({
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    sessionId: SESSION_ID
  }, { store: reader });
  assert.equal(readBack.found, true);
  assert.equal(readBack.record.commit.status, "committed");
  assert.equal(readBack.record.rawReportText, originalRaw);
});

test("conflicting evidence and cross-workspace access fail closed without mutation", async () => {
  const binding = kvBinding();
  const archivePackage = canonicalArchivePackage();
  const first = await persistRouteIqFieldSessionArchive(archivePackage, {
    env: { [routeIqFieldSessionStoreBinding]: binding },
    persistedAt: "2026-07-12T01:02:00.000Z"
  });
  const originalRaw = binding.data.get(first.keys.raw).value;
  const conflictingRaw = `${archivePackage.rawReportText}\n`;
  const conflicting = {
    ...archivePackage,
    rawReportText: conflictingRaw,
    rawSha256: sha256(conflictingRaw),
    rawByteLength: Buffer.byteLength(conflictingRaw, "utf8")
  };
  await assert.rejects(() => persistRouteIqFieldSessionArchive(conflicting, {
    env: { [routeIqFieldSessionStoreBinding]: binding }
  }), error => {
    assert.equal(error instanceof FieldSessionConflictError, true);
    assert.equal(error.code, "field_session_duplicate_conflict");
    return true;
  });
  assert.equal(binding.data.get(first.keys.raw).value, originalRaw);

  const writesBeforeIsolationChecks = binding.writes.length;
  await assert.rejects(() => readRouteIqFieldSessionArchive({
    workspaceId: "synthetic_distribution",
    operatingProfileId: "outside_sales",
    sessionId: SESSION_ID
  }, { env: { [routeIqFieldSessionStoreBinding]: binding } }), /Unknown field-session workspace/);
  await assert.rejects(() => readRouteIqFieldSessionArchive({
    workspaceId: "unknown_workspace",
    operatingProfileId: "unknown",
    sessionId: SESSION_ID
  }, { env: { [routeIqFieldSessionStoreBinding]: binding } }), /Unknown field-session workspace/);
  assert.equal(binding.writes.length, writesBeforeIsolationChecks);
});

test("raw-only interrupted writes remain invisible until the commit marker exists", async () => {
  const binding = kvBinding();
  const archivePackage = canonicalArchivePackage();
  const keys = fieldSessionStorageKeys("fitness_connection", SESSION_ID);
  await binding.put(keys.raw, archivePackage.rawReportText, {
    metadata: { appendOnly: true }
  });
  const result = await readRouteIqFieldSessionArchive({
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    sessionId: SESSION_ID
  }, { env: { [routeIqFieldSessionStoreBinding]: binding } });
  assert.deepEqual(result, { ok: true, found: false, record: null });
});
