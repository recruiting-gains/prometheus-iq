import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  ROUTE_IQ_BUSINESS_AVAILABILITY_BINDING,
  ROUTE_IQ_BUSINESS_AVAILABILITY_CLASS,
  ROUTE_IQ_BUSINESS_AVAILABILITY_ENV,
  ROUTE_IQ_BUSINESS_AVAILABILITY_MIGRATION,
  ROUTE_IQ_BUSINESS_AVAILABILITY_PRODUCER_BINDING,
  ROUTE_IQ_BUSINESS_AVAILABILITY_SCHEDULE
} from "../workers/infrastructure/route-iq-business-availability-contract.js";

const root = resolve(import.meta.dirname, "..");
const packagePath = "workers/infrastructure/route-iq-business-availability-refresh-package-v1.json";
const activationPath = "workers/infrastructure/route-iq-business-availability-activation-template-v1.json";
const runtimePath = "workers/infrastructure/route-iq-business-availability-runtime.js";
const durableObjectPath = "workers/infrastructure/route-iq-business-availability-durable-object.js";
const documentationPath = "docs/route-iq-business-availability-infrastructure-v1.md";
const workerPath = "workers/prometheus-iq-worker.js";
const wranglerPath = "wrangler.jsonc";

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function readJson(path) {
  return JSON.parse(read(path));
}

function stripJsonComments(source) {
  let output = "";
  let inString = false;
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    if (inString) {
      output += character;
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === "\"") inString = false;
      continue;
    }
    if (character === "\"") {
      inString = true;
      output += character;
      continue;
    }
    if (character === "/" && next === "/") {
      while (index < source.length && source[index] !== "\n") index += 1;
      output += "\n";
      continue;
    }
    if (character === "/" && next === "*") {
      index += 2;
      while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) index += 1;
      index += 1;
      continue;
    }
    output += character;
  }
  return output;
}

function readJsonc(path) {
  return JSON.parse(stripJsonComments(read(path)));
}

export function verifyRouteIqBusinessAvailabilityRefreshPackage() {
  const refreshPackage = readJson(packagePath);
  const activation = readJson(activationPath);
  const runtime = read(runtimePath);
  const durableObject = read(durableObjectPath);
  const documentation = read(documentationPath);
  const worker = read(workerPath);
  const wrangler = readJsonc(wranglerPath);

  assert.equal(refreshPackage.schemaVersion, "route-iq-business-availability-refresh-package-v1");
  assert.equal(refreshPackage.ownerSubsystem, "Prometheus Infrastructure");
  assert.equal(refreshPackage.targetWorker, "prometheus-iq");
  assert.equal(refreshPackage.defaultState, "OFF");
  assert.equal(refreshPackage.productionActivationAuthorized, false);
  assert.equal(refreshPackage.noCredentialProvisioningPerformed, true);

  assert.equal(refreshPackage.runtime.modeVariable, ROUTE_IQ_BUSINESS_AVAILABILITY_ENV.mode);
  assert.equal(refreshPackage.runtime.activationVariable, ROUTE_IQ_BUSINESS_AVAILABILITY_ENV.activation);
  assert.equal(refreshPackage.runtime.coordinatorBinding, ROUTE_IQ_BUSINESS_AVAILABILITY_BINDING);
  assert.equal(refreshPackage.runtime.coordinatorClass, ROUTE_IQ_BUSINESS_AVAILABILITY_CLASS);
  assert.equal(refreshPackage.runtime.migrationTag, ROUTE_IQ_BUSINESS_AVAILABILITY_MIGRATION);
  assert.equal(refreshPackage.runtime.dataProducerBinding, ROUTE_IQ_BUSINESS_AVAILABILITY_PRODUCER_BINDING);
  assert.equal(refreshPackage.runtime.scheduledHandler, "handleRouteIqBusinessAvailabilityScheduled");

  assert.equal(refreshPackage.schedule.cron, ROUTE_IQ_BUSINESS_AVAILABILITY_SCHEDULE);
  assert.equal(refreshPackage.schedule.declaredInWrangler, false);
  assert.equal(refreshPackage.schedule.automaticRefreshActive, false);
  assert.equal(refreshPackage.schedule.maximumRefreshIntervalHours, 24);

  assert.deepEqual(refreshPackage.monitoring.reasonCodes, [
    "PROVIDER_TIMEOUT",
    "PROVIDER_NETWORK_FAILED",
    "PROVIDER_AUTHORIZATION_DENIED",
    "PROVIDER_RATE_LIMITED",
    "PROVIDER_UNAVAILABLE",
    "PROVIDER_RESPONSE_INVALID",
    "DATA_PROJECTION_INVALID",
    "DATA_PRODUCER_UNAVAILABLE"
  ]);
  assert.equal(refreshPackage.failureHandling.providerFailureCannotPromoteStaleData, true);
  assert.equal(refreshPackage.failureHandling.runtimeRetryPolicy, "NONE");
  assert.equal(refreshPackage.failureHandling.durableConflictsRecorded, true);
  assert.equal(refreshPackage.failureHandling.projectionCommitMarkerWrittenLast, true);
  assert.equal(refreshPackage.failureHandling.refreshOutboxRecoveryIdempotent, true);

  assert.equal(refreshPackage.activationInstructions.documentation, documentationPath);
  assert.equal(refreshPackage.activationInstructions.template, activationPath);
  assert.equal(refreshPackage.activationInstructions.separateFounderAuthorizationRequired, true);
  assert.equal(refreshPackage.activationInstructions.separateCredentialProvisioningRequired, true);
  assert.equal(refreshPackage.activationInstructions.separateSchedulerActivationRequired, true);
  assert.equal(refreshPackage.activationInstructions.separateDeploymentRequired, true);

  assert.equal(refreshPackage.tests.verifier, "scripts/verify-route-iq-business-availability-refresh-package.mjs");
  assert.equal(refreshPackage.tests.regression, "tests/route-iq-business-availability-refresh-package.test.mjs");
  assert.equal(refreshPackage.tests.dryRun, "tests/route-iq-business-availability-infrastructure.test.mjs");

  assert.equal(refreshPackage.safety.prospectiveCollection, "OFF");
  assert.equal(refreshPackage.safety.activeCohorts, 0);
  assert.equal(refreshPackage.safety.recommendationInfluence, "OFF");
  assert.equal(refreshPackage.safety.publicWorkerAffected, false);
  assert.equal(refreshPackage.safety.demoFallbackAllowed, false);
  assert.equal(refreshPackage.safety.crossWorkspaceFallbackAllowed, false);

  assert.equal(activation.defaultState, "OFF");
  assert.equal(activation.schedule.cron, ROUTE_IQ_BUSINESS_AVAILABILITY_SCHEDULE);
  assert.equal(activation.schedule.declaredInWrangler, false);
  assert.equal(activation.schedule.automaticRefreshActive, false);
  assert.equal(activation.runtime.modeVariable, ROUTE_IQ_BUSINESS_AVAILABILITY_ENV.mode);
  assert.equal(activation.runtime.activationVariable, ROUTE_IQ_BUSINESS_AVAILABILITY_ENV.activation);
  assert.equal(activation.runtime.coordinatorBinding, ROUTE_IQ_BUSINESS_AVAILABILITY_BINDING);
  assert.equal(activation.runtime.coordinatorClass, ROUTE_IQ_BUSINESS_AVAILABILITY_CLASS);
  assert.equal(activation.runtime.migrationTag, ROUTE_IQ_BUSINESS_AVAILABILITY_MIGRATION);
  assert.equal(activation.runtime.dataProducerBinding, ROUTE_IQ_BUSINESS_AVAILABILITY_PRODUCER_BINDING);

  assert.match(runtime, /ROUTE_IQ_AVAILABILITY_SCHEDULED_REFRESH/u);
  assert.match(runtime, /recordRefreshFailure/u);
  assert.match(runtime, /refreshBatchId/u);
  assert.match(runtime, /method:\s*"GET"/u);
  assert.match(runtime, /redirect:\s*"manual"/u);
  assert.match(runtime, /cache:\s*"no-store"/u);
  assert.doesNotMatch(runtime, /method:\s*"(?:POST|PUT|PATCH|DELETE)"/u);

  assert.match(durableObject, /projection_commits/u);
  assert.match(durableObject, /refresh_conflicts/u);
  assert.match(durableObject, /recordRefreshFailure/u);
  assert.match(durableObject, /readMonitoringSummary/u);

  assert.match(worker, /handleRouteIqBusinessAvailabilityScheduled/u);
  assert.match(worker, /RouteIqBusinessAvailabilityCoordinator/u);
  assert.match(read(wranglerPath), /ROUTE_IQ_BUSINESS_AVAILABILITY_MODE/u);
  assert.doesNotMatch(read(wranglerPath), /"triggers"\s*:/u);

  assert.match(documentation, /default-OFF business-availability runtime/u);
  assert.match(documentation, /maximum 24-hour freshness ceiling/u);
  assert.match(documentation, /automatic daily refresh/u);
  assert.match(documentation, /separately authorized scheduler/u);

  return Object.freeze({
    status: "PASS",
    packagePath,
    activationPath,
    targetWorker: refreshPackage.targetWorker,
    defaultState: refreshPackage.defaultState,
    scheduleCron: refreshPackage.schedule.cron
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.stdout.write(`${JSON.stringify(verifyRouteIqBusinessAvailabilityRefreshPackage(), null, 2)}\n`);
}
