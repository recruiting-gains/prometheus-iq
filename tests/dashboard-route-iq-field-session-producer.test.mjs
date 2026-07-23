import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import worker, {
  ROUTE_IQ_FIELD_SESSION_HANDOFF_PATH
} from "../workers/prometheus-iq-worker.js";
import {
  routeIqEndOfDayHandoffContractId,
  routeIqFieldSessionStoreBinding
} from "../data/route-iq-field-sessions-v1/route-iq-field-session-archive.mjs";

const dashboardSource = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const serviceWorkerSource = readFileSync(new URL("../sw.js", import.meta.url), "utf8");

function sourceSection(start, end) {
  const startIndex = dashboardSource.indexOf(start);
  const endIndex = dashboardSource.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `Missing Dashboard source marker: ${start}`);
  assert.notEqual(endIndex, -1, `Missing Dashboard source marker: ${end}`);
  return dashboardSource.slice(startIndex, endIndex);
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
    visitDecisionSource: {
      sourceId: "route_iq_recommendation",
      reason: "The representative explicitly selected the active Route IQ recommendation.",
      evidence: [{ evidenceType: "route_selection", sourceRecordId: "dashboard-visit:dashboard-producer-test-visit" }],
      confidence: 1,
      capturedAt: "2026-07-11T20:00:00.000Z"
    },
    recommendationDecisionContext: {
      recommendationAvailable: true,
      recommendationId: "google:ChIJDashboardProducerTest",
      decision: "accepted"
    },
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

function correctedReport() {
  const visitId = "dashboard-visit-correction-test";
  const source = report({
    visit: {
      visitId,
      outcome: "Membership/Unit",
      leads: 1,
      units: 1,
      notes: "Employee came outside and completed signup."
    }
  });
  const originalVisit = {
    ...source.visits[0],
    outcome: "Conversation",
    leads: 0,
    units: 0,
    notes: "Original visit evidence."
  };
  source.visitOutcomeEvidence = {
    schemaVersion: "dashboard-visit-outcome-corrections-v1",
    auditModel: "append_only_original_correction_final",
    originalVisits: [originalVisit],
    correctionEvents: [{
      schemaVersion: "dashboard-visit-outcome-corrections-v1",
      eventId: "dashboard-correction-event-1",
      eventType: "visit_outcome_correction",
      workspaceId: "fitness_connection",
      operatingProfileId: "fitness",
      representativeId: "anthony",
      visitId,
      placeId: source.visits[0].placeId,
      sequence: 1,
      correctedAt: "2026-07-11T20:03:00.000Z",
      source: "representative_post_visit_update",
      previousOutcome: {
        quality: "Conversation",
        conversations: 1,
        leads: 0,
        appointments: 0,
        units: 0,
        laterUnits: 0,
        followUp: "",
        notes: "Original visit evidence.",
        manager: "",
        contactName: "",
        contactPhone: "",
        contactEmail: ""
      },
      changes: {
        quality: { before: "Conversation", after: "Membership/Unit" },
        leads: { before: 0, after: 1 },
        units: { before: 0, after: 1 },
        notes: { before: "Original visit evidence.", after: "Employee came outside and completed signup." }
      },
      finalVerifiedOutcome: {
        quality: "Membership/Unit",
        conversations: 1,
        leads: 1,
        appointments: 0,
        units: 1,
        laterUnits: 0,
        followUp: "",
        notes: "Employee came outside and completed signup.",
        manager: "",
        contactName: "",
        contactPhone: "",
        contactEmail: ""
      }
    }],
    finalVerifiedOutcomes: [{
      visitId,
      ...source.visits[0]
    }]
  };
  return source;
}

function manuallyCreatedBusinessReport() {
  return report({
    visit: {
      visitId: "dashboard-manual-business-visit",
      placeName: "Field-Created Test Business",
      placeId: "dashboard-manual-business-place",
      outcome: "Appointment",
      conversations: 1,
      leads: 1,
      appointments: 1,
      units: 0,
      followUp: "Return Wednesday at 10 AM",
      manager: "Jordan Manager",
      notes: "Created and logged from Add Place.",
      businessCreation: {
        source: "dashboard_add_place",
        workspaceId: "fitness_connection",
        placeId: "dashboard-manual-business-place",
        name: "Field-Created Test Business",
        address: "1010 Test Way, Houston, TX 77001",
        category: "Business",
        bestWindow: "Midday",
        permission: "Unknown",
        canRevisit: true,
        createdAt: "2026-07-11T19:59:00.000Z"
      }
    }
  });
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
  const rawKey = [...binding.data.keys()].find(key => key.endsWith("/raw-report.json"));
  const normalizedKey = [...binding.data.keys()].find(key => key.endsWith("/normalized-field-session.json"));
  const historyKey = [...binding.data.keys()].find(key => key.endsWith("/history-updates.json"));
  const storedRaw = JSON.parse(binding.data.get(rawKey).value);
  const normalized = JSON.parse(binding.data.get(normalizedKey).value);
  const history = JSON.parse(binding.data.get(historyKey).value);
  assert.equal(storedRaw.visits[0].visitDecisionSource.sourceId, "route_iq_recommendation");
  assert.equal(storedRaw.visits[0].recommendationDecisionContext.decision, "accepted");
  assert.equal(normalized.verifiedFields.completedVisits[0].governedBusinessIdentity.googlePlaceId, "ChIJDashboardProducerTest");
  assert.equal(history.customerOutcomeHistory.length, 1);
  assert.equal(history.categoryOutcomeHistory[0].category, "Business");
});

test("Dashboard correction ledger is archived verbatim with the final verified outcome", async () => {
  const binding = kvBinding();
  const source = correctedReport();
  const response = await submit(payload({ report: source }), productionEnv(binding));
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.acknowledged, true);
  const rawKey = [...binding.data.keys()].find(key => key.endsWith("/raw-report.json"));
  const normalizedKey = [...binding.data.keys()].find(key => key.endsWith("/normalized-field-session.json"));
  const storedRaw = JSON.parse(binding.data.get(rawKey).value);
  const normalized = JSON.parse(binding.data.get(normalizedKey).value);
  assert.deepEqual(storedRaw.visitOutcomeEvidence, source.visitOutcomeEvidence);
  assert.equal(storedRaw.visitOutcomeEvidence.originalVisits[0].units, 0);
  assert.equal(storedRaw.visitOutcomeEvidence.correctionEvents.length, 1);
  assert.equal(storedRaw.visitOutcomeEvidence.finalVerifiedOutcomes[0].units, 1);
  assert.equal(normalized.verifiedFields.completedVisits[0].sourceReport.outcome, "Membership/Unit");
  assert.equal(normalized.verifiedFields.completedVisits[0].sourceReport.units, 1);
  assert.equal(normalized.verifiedFields.totals.totalUnits, 1);
});

test("Dashboard Add Place business snapshot and initial visit use the canonical Data handoff", async () => {
  const binding = kvBinding();
  const source = manuallyCreatedBusinessReport();
  const response = await submit(payload({ report: source }), productionEnv(binding));
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.acknowledged, true);
  assert.equal(body.acknowledgment.contractId, routeIqEndOfDayHandoffContractId);
  const rawKey = [...binding.data.keys()].find(key => key.endsWith("/raw-report.json"));
  const normalizedKey = [...binding.data.keys()].find(key => key.endsWith("/normalized-field-session.json"));
  const storedRaw = JSON.parse(binding.data.get(rawKey).value);
  const normalized = JSON.parse(binding.data.get(normalizedKey).value);
  assert.deepEqual(storedRaw.visits[0].businessCreation, source.visits[0].businessCreation);
  assert.equal(storedRaw.visits[0].appointments, 1);
  assert.equal(storedRaw.visits[0].manager, "Jordan Manager");
  assert.equal(normalized.verifiedFields.completedVisits[0].governedBusinessIdentity, null);
  assert.equal(normalized.verifiedFields.completedVisits[0].sourceReport.outcome, "Appointment");
  assert.equal(normalized.verifiedFields.completedVisits[0].sourceReport.leads, 1);
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
    ["retired_customer_workspace", "retired_customer_profile"]
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

test("Dashboard Decision Source remains optional post-action evidence rather than frozen shadow context", () => {
  const definitions = sourceSection("const visitDecisionSourceDefinitions", "const visitDecisionSourceIds");
  const markup = sourceSection("function visitDecisionSourceMarkup", "function attachVisitDecisionSourceControl");
  const evidenceFactory = sourceSection("function createVisitDecisionEvidence", "const visitOutcomeFields");
  const recommendationSnapshot = sourceSection("function currentRecommendationDecisionSnapshot", "function visitDecisionSourceMarkup");
  const sourceLabels = [...definitions.matchAll(/label: "([^"]+)"/g)].map(match => match[1]);

  assert.deepEqual(sourceLabels, [
    "Route IQ Recommendation",
    "Nearby Context",
    "Saved Place",
    "Discovery",
    "Existing Relationship",
    "Follow-up",
    "Manual"
  ]);
  assert.match(markup, /Decision Source is optional/);
  assert.doesNotMatch(markup, /name="visitDecisionSourceId"[^>]*\brequired\b/);
  assert.equal((dashboardSource.match(/\$\{visitDecisionSourceMarkup\(\)\}/g) || []).length, 3);

  assert.match(dashboardSource, /const createdAt = Date\.now\(\);\s+const decisionEvidence = visitDecisionEvidenceFromForm\(quickForm, \{ visitId, placeId: values\.placeId, capturedAt: createdAt \}\)/);
  assert.match(dashboardSource, /const createdAt = Date\.now\(\);\s+const decisionEvidence = visitDecisionEvidenceFromForm\(event\.currentTarget, \{ visitId, placeId: data\.placeId, capturedAt: createdAt \}\)/);
  assert.match(dashboardSource, /const visitCreatedAt = Date\.now\(\);\s+const decisionEvidence = visitDecisionEvidenceFromValues\(data, \{ visitId, placeId: createdPlace\.id, capturedAt: visitCreatedAt \}\)/);
  assert.doesNotMatch(markup, /capturedAt/);

  for (const forbidden of [
    "rankedCandidates",
    "probabilities",
    "evidenceCutoffTimestamp",
    "schemaVersion",
    "modelVersion",
    "ruleVersion",
    "shadowDecisionId"
  ]) {
    assert.doesNotMatch(evidenceFactory, new RegExp(forbidden));
    assert.doesNotMatch(recommendationSnapshot, new RegExp(forbidden));
  }
  assert.doesNotMatch(dashboardSource, /intelligence\/shadow-decision-readiness|founder-readiness-report|shadowDecisionId|shadowRecordSha256/);
  assert.doesNotMatch(evidenceFactory, /contactName|contactPhone|contactEmail|manager|latitude|longitude/);
  assert.match(recommendationSnapshot, /placeId: recommendation\?\.id \|\| ""/);
  assert.match(recommendationSnapshot, /recommendationId: recommendation \? routeIdentityKey\(recommendation\) : ""/);
});

test("Dashboard prospective seam is opaque, nonblocking, and limited to the existing next-stop boundary", () => {
  const gate = sourceSection("function disableRouteIqProspectiveAdmission", "function signalRouteIqProspectiveEvent");
  const sender = sourceSection("function signalRouteIqProspectiveEvent", "const appUrlParams");
  const replenishment = sourceSection("async function performAdaptiveRouteReplenishment", "function requestAdaptiveRouteReplenishment");
  const clickBoundary = sourceSection('document.addEventListener("click"', 'document.addEventListener("change"');
  const prospectiveActionBoundary = sourceSection("function handleRouteIqProspectiveAction", "const appUrlParams");
  const reportBuilder = sourceSection("function todayReportPayload", "function fieldSessionScope");
  const startup = sourceSection("(async () => {", "</script>");

  assert.match(dashboardSource, /const routeIqProspectiveEventPath = "\/api\/dashboard\/route-iq\/prospective\/event"/);
  assert.match(dashboardSource, /new Set\(\["next_stop_requested", "representative_action_observed"\]\)/);
  assert.match(dashboardSource, /route-iq-prospective-browser-bootstrap-v1/);
  assert.match(dashboardSource, /route-iq-prospective-browser-event-v1/);
  assert.match(dashboardSource, /route-iq-prospective-runtime-context-v1/);
  assert.match(dashboardSource, /route-iq-prospective-coordinator-contract-v1/);
  assert.match(gate, /method: "GET"/);
  assert.match(gate, /credentials: "same-origin"/);
  assert.match(gate, /cache: "no-store"/);
  assert.match(gate, /redirect: "error"/);
  assert.match(gate, /AbortSignal\.timeout\(routeIqProspectiveBootstrapTimeoutMs\)/);
  assert.match(gate, /body\.collection !== "ON"/);
  assert.match(gate, /body\.recommendationInfluence !== "OFF"/);
  assert.match(gate, /body\.activeCohort !== true/);
  assert.match(gate, /body\.runtimeContextContractVersion !== routeIqProspectiveRuntimeContextContractVersion/);
  assert.match(gate, /body\.coordinatorContractVersion !== routeIqProspectiveCoordinatorContractVersion/);
  assert.match(gate, /body\.workspaceId !== requestedScope\.workspaceId/);
  assert.match(gate, /body\.operatingProfileId !== requestedScope\.operatingProfileId/);
  assert.match(gate, /body\.representativeId !== requestedScope\.representativeId/);
  assert.match(gate, /body\.supportedOpportunityTypes\[0\] !== routeIqProspectiveOpportunityType/);
  assert.match(gate, /expiresAtMs <= nowMs/);
  assert.match(dashboardSource, /routeIqProspectiveBootstrapMaximumLifetimeMs = 60 \* 1000/);
  assert.doesNotMatch(gate, /localStorage|sessionStorage|indexedDB|caches\.|WebSocket|sendBeacon|setTimeout|setInterval|addEventListener|outbox|retry/i);
  assert.match(gate, /routeIqProspectiveAdmission = admission;\s*startRouteIqProspectiveActionListener\(\);/);
  assert.match(sender, /if \(sessionRole !== "rep"\) return false/);
  assert.match(sender, /if \(!routeIqProspectiveAdmissionIsActive\(\)\) return false/);
  assert.match(sender, /const payload = \{\s*eventKind,\s*informationalSequence: \+\+routeIqProspectiveInformationalSequence,\s*informationalObservedAt: new Date\(\)\.toISOString\(\)\s*\}/);
  assert.match(sender, /keepalive: true/);
  assert.match(sender, /credentials: "same-origin"/);
  assert.match(sender, /redirect: "error"/);
  assert.match(sender, /void fetch\([\s\S]*\)\.catch\(\(\) => undefined\)/);
  assert.doesNotMatch(sender, /await|\.then\(|response|\.json\(|\.text\(|localStorage|sessionStorage|indexedDB|caches\./);

  assert.match(startup, /await loadRuntimeProductionDataset\(\)[\s\S]*const prospectiveBootstrapPromise = initializeRouteIqProspectiveClient\(\)[\s\S]*await loadRouteBusinessHoursEligibility\(\)[\s\S]*routeIqProspectiveBootstrapWindowOpen = false[\s\S]*await requestAdaptiveRouteReplenishment\(\{ force: true, trigger: "startup" \}\)/);

  assert.match(replenishment, /result\.metrics\.activeCount > 0 && \(result\.triggered \|\| options\.force === true\)[\s\S]*signalRouteIqProspectiveEvent\("next_stop_requested"\)/);
  assert.doesNotMatch(clickBoundary, /signalRouteIqProspectiveEvent\("representative_action_observed"\)/);
  assert.match(prospectiveActionBoundary, /event\.target\.closest\("#bestMoveDirections"\)[\s\S]*signalRouteIqProspectiveEvent\("representative_action_observed"\)/);
  assert.match(prospectiveActionBoundary, /if \(!routeIqProspectiveAdmission\.active \|\| routeIqProspectiveActionListenerAttached\) return false;[\s\S]*document\.addEventListener\("click", handleRouteIqProspectiveAction\)/);
  assert.equal((prospectiveActionBoundary.match(/signalRouteIqProspectiveEvent\("representative_action_observed"\)/g) || []).length, 1);

  for (const forbidden of [
    "workspaceId",
    "operatingProfileId",
    "representativeId",
    "fieldSessionId",
    "opportunityId",
    "candidateId",
    "candidateSet",
    "outcome",
    "visitDecisionSource",
    "hash",
    "ranking",
    "probability",
    "confidence",
    "eligibility",
    "readiness",
    "authoritative",
    "integrity"
  ]) {
    assert.doesNotMatch(sender, new RegExp(forbidden, "i"));
  }

  assert.doesNotMatch(dashboardSource, /representative_outcome_observed/);
  assert.doesNotMatch(reportBuilder, /routeIqProspective|shadowDecision|shadowRanking|shadowProbability|shadowConfidence|shadowReadiness/);
  assert.match(serviceWorkerSource, /if \(event\.request\.method !== "GET" && event\.request\.method !== "HEAD"\) return/);
  assert.doesNotMatch(serviceWorkerSource, /route-iq\/prospective|prospective\/event/);
});

test("Dashboard collection-OFF gate has no inactive outbox, retry, listener, or service-worker replay surface", () => {
  const gate = sourceSection("function disableRouteIqProspectiveAdmission", "function signalRouteIqProspectiveEvent");
  const listenerGate = sourceSection("function handleRouteIqProspectiveAction", "const appUrlParams");
  const startup = sourceSection("(async () => {", "</script>");

  assert.match(gate, /active: false/);
  assert.match(gate, /routeIqProspectiveBootstrapWindowOpen/);
  assert.match(gate, /return disableRouteIqProspectiveAdmission\("bootstrap_late"\)/);
  assert.match(gate, /return disableRouteIqProspectiveAdmission\("bootstrap_invalid"\)/);
  assert.match(gate, /return disableRouteIqProspectiveAdmission\("admission_expired_or_scope_changed"\)/);
  assert.doesNotMatch(gate, /localStorage|sessionStorage|indexedDB|caches\.|WebSocket|sendBeacon|setInterval|addEventListener|outbox|drain|reconnect|retry/i);
  assert.match(listenerGate, /if \(!routeIqProspectiveAdmission\.active \|\| routeIqProspectiveActionListenerAttached\) return false;[\s\S]*document\.addEventListener\("click", handleRouteIqProspectiveAction\)/);
  assert.doesNotMatch(startup, /await prospectiveBootstrapPromise/);
  assert.doesNotMatch(serviceWorkerSource, /route-iq\/prospective|prospective\/event/i);
  assert.equal((serviceWorkerSource.match(/event\.request\.method !== "GET"/g) || []).length, 1);
});

test("Dashboard source records the representative workflow change without silently auto-saving No Contact", () => {
  const quickWorkflow = sourceSection('} else if (type === "quick")', '} else if (type === "visit")');
  assert.match(quickWorkflow, /data-quick-outcome="none"/);
  assert.match(quickWorkflow, /<button class="btn" type="submit">Save Result<\/button>/);
  assert.doesNotMatch(quickWorkflow, /if \(outcome === "none"\) \{\s*await saveQuickResult/);
  assert.match(quickWorkflow, /quickForm\.addEventListener\("submit"/);
});

test("Dashboard report construction upgrades legacy missing context to post-action Unknown without rewriting the visit", () => {
  const reportBuilder = sourceSection("function visitDecisionContextForReport", "function todayReportPayload");
  const todayReport = sourceSection("function todayReportPayload", "function fieldSessionScope");

  assert.match(reportBuilder, /sourceId: "unknown"/);
  assert.match(reportBuilder, /reason: null/);
  assert.match(reportBuilder, /evidence: \[\]/);
  assert.match(reportBuilder, /confidence: 0/);
  assert.match(reportBuilder, /capturedAt: reportGeneratedAt/);
  assert.match(reportBuilder, /recommendationAvailable: null/);
  assert.match(reportBuilder, /recommendationId: null/);
  assert.match(reportBuilder, /decision: null/);
  assert.match(todayReport, /const reportGeneratedAt = new Date\(\)\.toISOString\(\)/);
  assert.match(todayReport, /\.\.\.visitDecisionContextForReport\(visit, reportGeneratedAt\)/);
  assert.match(todayReport, /generatedAt: reportGeneratedAt/);
  assert.doesNotMatch(reportBuilder, /visit\.visitDecisionSource\s*=|visit\.recommendationDecisionContext\s*=/);
  assert.doesNotMatch(reportBuilder, /rankedCandidates|probabilities|evidenceCutoffTimestamp|modelVersion|ruleVersion/);
});

test("Data persists Dashboard legacy fallback as late Unknown without pre-action candidate claims", async () => {
  const binding = kvBinding();
  const source = report({
    visit: {
      visitDecisionSource: {
        sourceId: "unknown",
        reason: null,
        evidence: [],
        confidence: 0,
        capturedAt: "2026-07-11T20:05:00.000Z"
      },
      recommendationDecisionContext: {
        recommendationAvailable: null,
        recommendationId: null,
        decision: null
      }
    }
  });
  const response = await submit(payload({ report: source }), productionEnv(binding));
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.acknowledged, true);
  const rawKey = [...binding.data.keys()].find(key => key.endsWith("/raw-report.json"));
  const normalizedKey = [...binding.data.keys()].find(key => key.endsWith("/normalized-field-session.json"));
  assert.equal(typeof rawKey, "string");
  assert.equal(typeof normalizedKey, "string");
  const raw = JSON.parse(binding.data.get(rawKey).value);
  const normalized = JSON.parse(binding.data.get(normalizedKey).value);
  const rawVisit = raw.visits[0];
  const visit = normalized.verifiedFields.completedVisits[0];

  assert.equal(rawVisit.visitDecisionSource.capturedAt, raw.generatedAt);
  assert.equal(Date.parse(rawVisit.visitDecisionSource.capturedAt) > Date.parse(rawVisit.timestamp), true);
  assert.deepEqual(Object.keys(rawVisit.visitDecisionSource).sort(), [
    "capturedAt",
    "confidence",
    "evidence",
    "reason",
    "sourceId"
  ]);
  assert.deepEqual(Object.keys(rawVisit.recommendationDecisionContext).sort(), [
    "decision",
    "recommendationAvailable",
    "recommendationId"
  ]);
  assert.equal("temporalClassification" in rawVisit.visitDecisionSource, false);
  for (const forbidden of [
    "candidateContext",
    "candidateSnapshot",
    "rankedCandidateDecisions",
    "rankedCandidates",
    "probabilities",
    "evidenceCutoffTimestamp",
    "modelVersion",
    "ruleVersion",
    "eligibilityReason",
    "exclusionReason",
    "shadowDecisionId"
  ]) {
    assert.equal(forbidden in rawVisit, false);
    assert.equal(forbidden in rawVisit.visitDecisionSource, false);
    assert.equal(forbidden in rawVisit.recommendationDecisionContext, false);
  }

  assert.equal(visit.visitDecisionSource.sourceId, "unknown");
  assert.equal(visit.visitDecisionSource.reason, null);
  assert.equal(visit.visitDecisionSource.confidence, 0);
  assert.equal(visit.visitDecisionSource.temporalClassification, "late_report_finalization_unknown");
  assert.deepEqual(visit.recommendationDecisionContext, {
    recommendationAvailable: null,
    recommendationId: null,
    decision: null
  });
});
