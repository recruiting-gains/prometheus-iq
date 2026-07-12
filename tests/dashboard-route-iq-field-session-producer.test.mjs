import test from "node:test";
import assert from "node:assert/strict";
import worker, {
  ROUTE_IQ_FIELD_SESSION_HANDOFF_PATH
} from "../workers/prometheus-iq-worker.js";
import {
  routeIqEndOfDayHandoffContractId,
  routeIqFieldSessionStoreBinding
} from "../data/route-iq-field-sessions-v1/route-iq-field-session-archive.mjs";

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
        list_complete: true,
        cacheStatus: null
      };
    }
  };
}

function runtimeAssetsBinding() {
  const runtimePlace = {
    id: "dashboard-producer-test-place",
    repProfileId: "anthony",
    name: "Dashboard Producer Test Business",
    googlePlaceId: "ChIJDashboardProducerTest",
    address: "100 Producer Test Way, Houston, TX 77001",
    category: "Business",
    qualityScore: 100,
    qualityReason: "Synthetic Dashboard contract test identity."
  };
  const assets = new Map([
    ["/data/qualified-prospects/google-qualified-businesses-v2/runtime-pools.json", {
      dataset_version: "google-qualified-businesses-v2",
      cruz: [],
      anthony: [runtimePlace]
    }],
    ["/data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/active-pool.json", {
      records: [{ googlePlaceId: runtimePlace.googlePlaceId }]
    }],
    ["/data/qualified-prospects/google-qualified-businesses-v2/business-hours-v1/business-hours.json", {
      records: []
    }]
  ]);
  return {
    async fetch(request) {
      const pathname = new URL(request.url).pathname;
      if (!assets.has(pathname)) return new Response("Not found", { status: 404 });
      return new Response(JSON.stringify(assets.get(pathname)), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
  };
}

function productionEnv(binding = kvBinding()) {
  return {
    [routeIqFieldSessionStoreBinding]: binding,
    ASSETS: runtimeAssetsBinding()
  };
}

function report(overrides = {}) {
  const visit = {
    placeName: "Dashboard Producer Test Business",
    placeId: "dashboard-producer-test-place",
    timestamp: "2026-07-11T20:00:00.000Z",
    date: "2026-07-11",
    timeWindow: "Midday",
    outcome: "Lead",
    conversations: 1,
    leads: 1,
    units: 0,
    laterUnits: 0,
    notes: "Synthetic Dashboard contract test only.",
    gpsAttached: true,
    ...(overrides.visit || {})
  };
  return {
    app: "Prometheus IQ",
    reportType: "beta-daily-rep-report",
    generatedAt: "2026-07-11T20:05:00.000Z",
    date: "2026-07-11",
    rep: { id: "anthony", name: "Anthony" },
    totals: {
      visits: 1,
      conversations: visit.conversations,
      leads: visit.leads,
      units: visit.units,
      laterUnits: visit.laterUnits
    },
    visits: [visit],
    ...overrides,
    visit: undefined
  };
}

function payload(overrides = {}) {
  const source = overrides.report || report();
  return {
    completionAction: "end_route",
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    finalExportConfirmed: true,
    sourceFinalizedAt: "2026-07-11T20:06:00.000Z",
    rawReportText: JSON.stringify(source, null, 2),
    ...overrides,
    report: undefined
  };
}

function handoffRequest(body, method = "POST") {
  return new Request(`https://prometheus-iq.example${ROUTE_IQ_FIELD_SESSION_HANDOFF_PATH}`, {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: method === "POST" ? JSON.stringify(body) : undefined
  });
}

async function withMutedWorkerLogs(callback) {
  const originalLog = console.log;
  const originalError = console.error;
  console.log = () => {};
  console.error = () => {};
  try {
    return await callback();
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

async function submit(body, env) {
  return withMutedWorkerLogs(() => worker.fetch(handoffRequest(body), env));
}

test("Dashboard End Route producer receives a committed Data acknowledgment", async () => {
  const binding = kvBinding();
  const response = await submit(payload(), productionEnv(binding));
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.ok, true);
  assert.equal(body.acknowledged, true);
  assert.equal(body.acknowledgment.contractId, routeIqEndOfDayHandoffContractId);
  assert.equal(body.acknowledgment.status, "archived");
  assert.equal(body.acknowledgment.workspaceId, "fitness_connection");
  assert.equal(body.acknowledgment.sessionId, "route-iq-field-session-fitness-connection-fitness-anthony-2026-07-11");
  assert.equal(body.acknowledgment.duplicate, false);
  assert.equal(binding.writes.at(-1).key.endsWith("/commit.json"), true);
  const normalizedKey = [...binding.data.keys()].find(key => key.endsWith("/normalized-field-session.json"));
  const historyKey = [...binding.data.keys()].find(key => key.endsWith("/history-updates.json"));
  const normalized = JSON.parse(binding.data.get(normalizedKey).value);
  const history = JSON.parse(binding.data.get(historyKey).value);
  assert.equal(normalized.verifiedFields.completedVisits[0].governedBusinessIdentity.googlePlaceId, "ChIJDashboardProducerTest");
  assert.equal(history.customerOutcomeHistory.length, 1);
  assert.equal(history.categoryOutcomeHistory[0].category, "Business");
});

test("Dashboard End Day retry is idempotent and does not write a duplicate archive", async () => {
  const binding = kvBinding();
  const body = payload({ completionAction: "end_day" });
  const env = productionEnv(binding);
  const first = await submit(body, env);
  const writeCount = binding.writes.length;
  const second = await submit(body, env);
  const acknowledgment = await second.json();

  assert.equal(first.status, 201);
  assert.equal(second.status, 200);
  assert.equal(acknowledgment.ok, true);
  assert.equal(acknowledgment.acknowledgment.status, "already_archived");
  assert.equal(acknowledgment.acknowledgment.duplicate, true);
  assert.equal(binding.writes.length, writeCount);
});

test("Dashboard duplicate conflict is rejected without overwriting completed evidence", async () => {
  const binding = kvBinding();
  const original = payload();
  const env = productionEnv(binding);
  const first = await submit(original, env);
  assert.equal(first.status, 201);
  const writeCount = binding.writes.length;
  const changed = report({ visit: { notes: "Different finalized evidence." } });
  const conflict = await submit(payload({ report: changed }), env);
  const body = await conflict.json();

  assert.equal(conflict.status, 409);
  assert.equal(body.ok, false);
  assert.equal(body.acknowledged, false);
  assert.equal(body.code, "field_session_duplicate_conflict");
  assert.equal(body.retryable, false);
  assert.equal(binding.writes.length, writeCount);
});

test("Dashboard producer fails closed when the Data binding is missing", async () => {
  const response = await submit(payload(), { ASSETS: runtimeAssetsBinding() });
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(body.ok, false);
  assert.equal(body.acknowledged, false);
  assert.equal(body.code, "field_session_store_binding_missing");
  assert.equal(body.retryable, true);
});

test("Dashboard producer rejects unknown and protected workspaces before writes", async () => {
  for (const [workspaceId, operatingProfileId] of [
    ["unknown_workspace", "fitness"],
    ["smoothie_depot", "franchise_development"]
  ]) {
    const binding = kvBinding();
    const response = await submit(payload({ workspaceId, operatingProfileId }), productionEnv(binding));
    const body = await response.json();
    assert.equal(response.status, 400, workspaceId);
    assert.equal(body.ok, false, workspaceId);
    assert.equal(body.code, "field_session_workspace_unknown", workspaceId);
    assert.equal(binding.writes.length, 0, workspaceId);
  }
});

test("Dashboard producer accepts only intentional completion actions and final reports", async () => {
  const binding = kvBinding();
  const env = productionEnv(binding);
  const invalidAction = await submit(payload({ completionAction: "background_sync" }), env);
  const invalidActionBody = await invalidAction.json();
  assert.equal(invalidAction.status, 400);
  assert.equal(invalidActionBody.code, "field_session_completion_action_invalid");
  assert.equal(binding.writes.length, 0);

  const partial = await submit(payload({ finalExportConfirmed: false }), env);
  const partialBody = await partial.json();
  assert.equal(partial.status, 409);
  assert.equal(partialBody.code, "field_session_final_export_unconfirmed");
  assert.equal(binding.writes.length, 0);
});

test("Dashboard field-session endpoint rejects unsupported methods", async () => {
  const response = await withMutedWorkerLogs(() => worker.fetch(
    handoffRequest({}, "GET"),
    productionEnv()
  ));
  const body = await response.json();

  assert.equal(response.status, 405);
  assert.equal(response.headers.get("Allow"), "POST");
  assert.equal(body.acknowledged, false);
});

test("Dashboard producer fails retryably when canonical runtime assets are unavailable", async () => {
  const binding = kvBinding();
  const response = await submit(payload(), { [routeIqFieldSessionStoreBinding]: binding });
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(body.ok, false);
  assert.equal(body.code, "field_session_runtime_assets_unavailable");
  assert.equal(body.retryable, true);
  assert.equal(binding.writes.length, 0);
});
