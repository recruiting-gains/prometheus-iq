import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_VIEWPORTS,
  evaluateRouteIqPrivateBrowserAcceptance,
  runRouteIqPrivateProductionBrowserAcceptance
} from "../scripts/verify-route-iq-private-paid-customer-production-browser-acceptance.mjs";

const VERSION = "16e40509-0173-4712-9138-0393a2ae1924";
const contract = JSON.parse(readFileSync(new URL(
  "../workers/infrastructure/route-iq-paid-customer-private-browser-acceptance-v1.json",
  import.meta.url
), "utf8"));

function passingScenario(viewport) {
  return {
    viewport: viewport.name,
    width: viewport.width,
    height: viewport.height,
    viewportExact: true,
    documentStatus: 200,
    workerVersion: VERSION,
    markerVerified: true,
    rendered: true,
    configuredOrSafeEmpty: true,
    horizontalOverflow: false,
    consoleErrors: 0,
    consoleWarnings: 0,
    runtimeExceptions: 0,
    networkFailures: 0,
    attemptedWrites: 0,
    blockedWrites: 0,
    formAttempts: 0,
    popupAttempts: 0,
    serviceWorkerRequests: 1,
    blockedServiceWorkerRequests: 1,
    serviceWorkerRegistrations: 0,
    externalRequests: 0
  };
}

test("browser contract fixes exact desktop/mobile, no-write, and isolation boundaries", () => {
  assert.equal(contract.ownerSubsystem, "Prometheus Infrastructure");
  assert.deepEqual(contract.viewports, [
    { name: "desktop", width: 1440, height: 900 },
    { name: "mobile", width: 390, height: 844 }
  ]);
  assert.deepEqual(contract.network.allowedMethods, ["GET", "HEAD", "OPTIONS"]);
  assert.equal(contract.network.writeAttemptsRequired, 0);
  assert.equal(contract.network.serviceWorkerPersistenceAllowed, false);
  assert.equal(contract.acceptance.publicWorkerIdentityMustRemainExact, true);
  assert.equal(contract.safety.collection, "OFF");
  assert.equal(contract.safety.activeCohorts, 0);
  assert.equal(contract.safety.recommendationInfluence, "OFF");
});

test("evaluator accepts only exact healthy configured-or-safe-empty evidence", () => {
  const scenarios = ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_VIEWPORTS.map(passingScenario);
  assert.deepEqual(evaluateRouteIqPrivateBrowserAcceptance({
    expectedWorkerVersion: VERSION,
    publicIsolationVerified: true,
    scenarios
  }), { status: "PASS", failures: [] });

  for (const mutation of [
    scenario => { scenario.attemptedWrites = 1; scenario.blockedWrites = 1; },
    scenario => { scenario.horizontalOverflow = true; },
    scenario => { scenario.workerVersion = "00000000-0000-4000-8000-000000000000"; },
    scenario => { scenario.serviceWorkerRegistrations = 1; },
    scenario => { scenario.configuredOrSafeEmpty = false; },
    scenario => { scenario.consoleErrors = 1; },
    scenario => { scenario.networkFailures = 1; }
  ]) {
    const adversarial = ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_VIEWPORTS.map(passingScenario);
    mutation(adversarial[0]);
    assert.equal(evaluateRouteIqPrivateBrowserAcceptance({
      expectedWorkerVersion: VERSION,
      publicIsolationVerified: true,
      scenarios: adversarial
    }).status, "FAIL");
  }
});

test("runner never returns or serializes service credential values", async () => {
  const canaryId = "client-id-secret-canary";
  const canarySecret = "client-secret-secret-canary";
  let closed = 0;
  const result = await runRouteIqPrivateProductionBrowserAcceptance({
    credentials: {
      clientId: canaryId,
      clientSecret: canarySecret
    },
    expectedWorkerVersion: VERSION,
    publicIsolationVerified: true,
    launchBrowser: async () => ({
      debugPort: 12345,
      async close() {
        closed += 1;
      }
    }),
    runScenario: async ({ viewport }) => passingScenario(viewport)
  });
  assert.equal(result.status, "PASS");
  assert.equal(closed, 1);
  assert.equal(JSON.stringify(result).includes(canaryId), false);
  assert.equal(JSON.stringify(result).includes(canarySecret), false);
});

test("public isolation or a failed viewport closes the browser and fails closed", async () => {
  await assert.rejects(
    runRouteIqPrivateProductionBrowserAcceptance({
      credentials: {
        clientId: "client-id",
        clientSecret: "client-secret"
      },
      expectedWorkerVersion: VERSION,
      publicIsolationVerified: false,
      launchBrowser: async () => {
        throw new Error("must not launch");
      }
    }),
    /input_invalid/u
  );

  let closed = 0;
  await assert.rejects(
    runRouteIqPrivateProductionBrowserAcceptance({
      credentials: {
        clientId: "client-id",
        clientSecret: "client-secret"
      },
      expectedWorkerVersion: VERSION,
      publicIsolationVerified: true,
      launchBrowser: async () => ({
        debugPort: 12345,
        async close() {
          closed += 1;
        }
      }),
      runScenario: async ({ viewport }) => ({
        ...passingScenario(viewport),
        configuredOrSafeEmpty: false
      })
    }),
    /acceptance_failed/u
  );
  assert.equal(closed, 1);
});
