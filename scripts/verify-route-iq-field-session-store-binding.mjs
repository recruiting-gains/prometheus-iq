import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

import {
  routeIqEndOfDayHandoffContractId,
  routeIqFieldSessionStoreBinding,
  routeIqFieldSessionStorageTechnology,
  supportedFieldSessionWorkspaces,
  validateFieldSessionStoreBinding
} from "../data/route-iq-field-sessions-v1/route-iq-field-session-archive.mjs";

const root = resolve(import.meta.dirname, "..");
const PRIVATE_CONFIG_PATH = "wrangler.jsonc";
const PUBLIC_CONFIG_PATH = "wrangler.prometheusrouteiq-website.jsonc";
const EXPECTED_NAMESPACE_TITLE = "DATA_ROUTE_IQ_FIELD_SESSION_STORE_FITNESS_CONNECTION_PRODUCTION";
const DISPOSABLE_PREFIX = "_infrastructure-verification/route-iq-field-session-store/v1";
const EXISTING_PRIVATE_BINDINGS = Object.freeze([
  "META_INSTAGRAM_TOKEN_STORE",
  "AEGIS_RATE_LIMITS",
  "SHARED_LEAD_INTAKE_STORE",
  "CRM_WORKSPACE_LEAD_STORE"
]);

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function stripJsonComments(source) {
  let output = "";
  let inString = false;
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (inString) {
      output += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      output += char;
      continue;
    }
    if (char === "/" && next === "/") {
      while (index < source.length && source[index] !== "\n") index += 1;
      output += "\n";
      continue;
    }
    if (char === "/" && next === "*") {
      index += 2;
      while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) index += 1;
      index += 1;
      continue;
    }
    output += char;
  }
  return output;
}

export function readJsonc(path) {
  return JSON.parse(stripJsonComments(read(path)));
}

function publicReport(inspection) {
  return {
    status: "passed",
    worker: inspection.privateConfig.name,
    wranglerConfig: PRIVATE_CONFIG_PATH,
    environment: "production_private_route_iq",
    binding: routeIqFieldSessionStoreBinding,
    bindingOwner: "Prometheus Infrastructure",
    namespaceOwner: "Prometheus Data / fitness_connection",
    namespaceConfigured: true,
    namespaceDedicated: true,
    namespaceIdRecordedOnlyInWranglerConfig: true,
    existingBindingsPreserved: true,
    publicWorkerBindingPresent: false,
    developmentStorage: "wrangler_local_kv",
    dataContract: "overwatch/artifact-contracts/data/fitness-connection-runtime-artifact-contract-v1.json",
    handoffContract: routeIqEndOfDayHandoffContractId,
    dashboardProducerStatus: "ACTIVE",
    dashboardTriggerImplemented: true,
    dashboardTriggerActivated: true,
    dashboardProductionState: "dashboard_producer_verified_live",
    intelligenceConsumptionAuthorized: false,
    missingBindingFailsClosed: true,
    workspaceScope: Object.keys(supportedFieldSessionWorkspaces)
  };
}

export function inspectRouteIqFieldSessionStoreBinding() {
  const privateConfig = readJsonc(PRIVATE_CONFIG_PATH);
  const publicConfig = readJsonc(PUBLIC_CONFIG_PATH);
  const dataContract = JSON.parse(read("overwatch/artifact-contracts/data/fitness-connection-runtime-artifact-contract-v1.json"));
  const workerSource = read("workers/prometheus-iq-worker.js");
  const privateBindings = privateConfig.kv_namespaces || [];
  const publicBindings = publicConfig.kv_namespaces || [];
  const binding = privateBindings.find(item => item.binding === routeIqFieldSessionStoreBinding);

  assert.equal(privateConfig.name, "prometheus-iq", "Field-session storage must bind to the private Route IQ Worker.");
  assert.equal(privateConfig.main, "workers/prometheus-iq-worker.js", "Private Worker composition changed unexpectedly.");
  assert.equal(privateConfig.assets?.directory, "./deploy/cloudflare-pages", "Private Route IQ asset ownership changed unexpectedly.");
  assert.ok(binding, `Missing ${routeIqFieldSessionStoreBinding} in ${PRIVATE_CONFIG_PATH}.`);
  assert.match(binding.id || "", /^[0-9a-f]{32}$/, "Field-session KV namespace ID is missing or malformed.");
  assert.equal(Object.hasOwn(binding, "preview_id"), false, "Preview KV must follow the existing local-emulation convention.");
  assert.equal(publicBindings.some(item => item.binding === routeIqFieldSessionStoreBinding), false, "Public Worker must not receive the private field-session archive binding.");
  for (const required of EXISTING_PRIVATE_BINDINGS) {
    assert.ok(privateBindings.some(item => item.binding === required), `Existing private Worker binding ${required} was not preserved.`);
  }
  for (const existing of privateBindings.filter(item => item.binding !== routeIqFieldSessionStoreBinding)) {
    assert.notEqual(binding.id, existing.id, `${routeIqFieldSessionStoreBinding} must use a dedicated namespace.`);
  }

  assert.equal(dataContract.owningSubsystem, "Prometheus Data");
  assert.equal(dataContract.workspaceId, "fitness_connection");
  assert.equal(dataContract.fieldSessionPersistenceContract.requiredBinding, routeIqFieldSessionStoreBinding);
  assert.equal(dataContract.fieldSessionPersistenceContract.bindingProvisioningOwner, "Prometheus Infrastructure");
  assert.equal(dataContract.fieldSessionPersistenceContract.missingBindingFailsClosedBeforeWrite, true);
  assert.equal(dataContract.fieldSessionPersistenceContract.crossWorkspaceReadsAndWritesAllowed, false);
  assert.equal(dataContract.fieldSessionPersistenceContract.appendOnlyRawEvidence, true);
  assert.equal(dataContract.fieldSessionPersistenceContract.commitMarkerWrittenLast, true);
  assert.equal(dataContract.automaticEndOfDayHandoffContract.dashboardTriggerImplemented, true);
  assert.equal(dataContract.automaticEndOfDayHandoffContract.dashboardTriggerActivated, true);
  assert.equal(dataContract.automaticEndOfDayHandoffContract.productionState, "dashboard_producer_verified_live");
  assert.equal(dataContract.fieldSessionPersistenceContract.productionBindingVerification.currentProductionState.dashboardTriggerActivated, true);
  assert.equal(dataContract.fieldSessionPersistenceContract.productionBindingVerification.currentProductionState.status, "dashboard_producer_verified_live");
  assert.equal(dataContract.consumerRules.intelligence.fieldSessionLearningConsumptionAuthorized, false);
  assert.equal(dataContract.automaticEndOfDayHandoffContract.productionActivationVerification.historicalReplayActivated, false);
  assert.equal(dataContract.automaticEndOfDayHandoffContract.productionActivationVerification.automaticReplayActivated, false);
  assert.equal(dataContract.automaticEndOfDayHandoffContract.productionActivationVerification.customerDataBackfillActivated, false);
  assert.deepEqual(Object.keys(supportedFieldSessionWorkspaces), ["fitness_connection"]);
  assert.deepEqual(supportedFieldSessionWorkspaces.fitness_connection.protectedWorkspaceIds, ["smoothie_depot"]);
  assert.equal(workerSource.includes("routeIqEndOfDayHandoffContractId"), true, "Dashboard field-session handoff contract must be active in the private Worker.");
  assert.equal(workerSource.includes("validateFieldSessionStoreBinding(env)"), true, "Dashboard field-session handoff must validate the production Data binding.");

  const validRuntime = validateFieldSessionStoreBinding({
    [routeIqFieldSessionStoreBinding]: {
      async get() { return null; },
      async put() {},
      async list() { return { keys: [], list_complete: true }; }
    }
  });
  const missingRuntime = validateFieldSessionStoreBinding({});
  assert.equal(validRuntime.ok, true);
  assert.equal(validRuntime.storageTechnology, routeIqFieldSessionStorageTechnology);
  assert.equal(missingRuntime.ok, false);
  assert.deepEqual(missingRuntime.missingMethods, ["get", "put", "list"]);

  return {
    privateConfig,
    publicConfig,
    binding,
    dataContract,
    report: publicReport({ privateConfig })
  };
}

function sanitizeWranglerOutput(value) {
  return String(value || "")
    .replaceAll(/[0-9a-f]{32}/gi, "[namespace-id]")
    .replaceAll(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[token]")
    .trim();
}

function runWrangler(args) {
  const executable = process.platform === "win32" ? "npx.cmd" : "npx";
  const result = spawnSync(executable, ["wrangler", ...args], {
    cwd: root,
    encoding: "utf8",
    env: process.env
  });
  if (result.status !== 0) {
    const details = sanitizeWranglerOutput(result.stderr || result.stdout);
    throw new Error(`Wrangler verification command failed${details ? `: ${details}` : "."}`);
  }
  return String(result.stdout || "").trim();
}

function parseJsonOutput(output) {
  const arrayStart = output.indexOf("[");
  const objectStart = output.indexOf("{");
  const starts = [arrayStart, objectStart].filter(index => index >= 0);
  assert.ok(starts.length, "Wrangler did not return JSON output.");
  return JSON.parse(output.slice(Math.min(...starts)));
}

async function pause(milliseconds) {
  await new Promise(resolvePromise => setTimeout(resolvePromise, milliseconds));
}

export async function verifyRemoteDisposableRecord() {
  const inspection = inspectRouteIqFieldSessionStoreBinding();
  const namespaces = parseJsonOutput(runWrangler([
    "kv", "namespace", "list", "--config", PRIVATE_CONFIG_PATH
  ]));
  const namespace = namespaces.find(item => item.id === inspection.binding.id);
  assert.ok(namespace, "Configured field-session KV namespace does not exist in the authenticated Cloudflare account.");
  assert.equal(namespace.title, EXPECTED_NAMESPACE_TITLE, "Configured namespace is not the dedicated Fitness Connection production archive.");

  const probeId = randomUUID();
  const prefix = `${DISPOSABLE_PREFIX}/${probeId}`;
  const key = `${prefix}/binding-probe.json`;
  const value = JSON.stringify({
    schemaVersion: "route-iq-field-session-store-binding-verification-v1",
    recordKind: "infrastructure_binding_probe",
    containsCustomerData: false,
    containsRouteData: false,
    containsRepresentativeData: false,
    nonce: probeId,
    createdAt: new Date().toISOString()
  });
  let removed = false;

  try {
    runWrangler([
      "kv", "key", "put", key, value,
      "--binding", routeIqFieldSessionStoreBinding,
      "--remote",
      "--ttl", "300",
      "--config", PRIVATE_CONFIG_PATH
    ]);
    const readBack = parseJsonOutput(runWrangler([
      "kv", "key", "get", key,
      "--binding", routeIqFieldSessionStoreBinding,
      "--remote",
      "--text",
      "--config", PRIVATE_CONFIG_PATH
    ]));
    assert.deepEqual(readBack, JSON.parse(value), "Separate-operation KV read-back did not match the disposable probe.");
    const listed = parseJsonOutput(runWrangler([
      "kv", "key", "list",
      "--binding", routeIqFieldSessionStoreBinding,
      "--remote",
      "--prefix", prefix,
      "--config", PRIVATE_CONFIG_PATH
    ]));
    assert.equal(listed.some(item => item.name === key), true, "Disposable verification key was not listable through the configured binding.");
    runWrangler([
      "kv", "key", "delete", key,
      "--binding", routeIqFieldSessionStoreBinding,
      "--remote",
      "--config", PRIVATE_CONFIG_PATH
    ]);
    removed = true;

    let remaining = [];
    for (const delay of [0, 250, 750]) {
      if (delay) await pause(delay);
      remaining = parseJsonOutput(runWrangler([
        "kv", "key", "list",
        "--binding", routeIqFieldSessionStoreBinding,
        "--remote",
        "--prefix", prefix,
        "--config", PRIVATE_CONFIG_PATH
      ]));
      if (remaining.length === 0) break;
    }
    assert.equal(remaining.length, 0, "Disposable verification key cleanup could not be confirmed.");
  } finally {
    if (!removed) {
      try {
        runWrangler([
          "kv", "key", "delete", key,
          "--binding", routeIqFieldSessionStoreBinding,
          "--remote",
          "--config", PRIVATE_CONFIG_PATH
        ]);
      } catch {
        // The five-minute TTL remains the final cleanup guard if an API call fails.
      }
    }
  }

  return {
    status: "passed",
    namespaceVerified: true,
    bindingResolvedByWrangler: true,
    separateOperationWriteReadBack: true,
    canonicalSessionKeyspaceTouched: false,
    customerDataWritten: false,
    disposableRecordRemoved: true,
    ttlFallbackSeconds: 300
  };
}

async function main() {
  const inspection = inspectRouteIqFieldSessionStoreBinding();
  const remoteProbe = process.argv.includes("--remote-probe")
    ? await verifyRemoteDisposableRecord()
    : { status: "skipped", reason: "Use --remote-probe for the disposable production KV verification." };
  console.log(JSON.stringify({ ...inspection.report, remoteProbe }, null, 2));
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  main().catch(error => {
    console.error(sanitizeWranglerOutput(error?.message || error));
    process.exitCode = 1;
  });
}
