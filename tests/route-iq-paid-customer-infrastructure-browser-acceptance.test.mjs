import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_FAILURE_DIMENSION,
  ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_VIEWPORTS,
  RouteIqPrivateBrowserAcceptanceError,
  collectRouteIqPrivateBrowserPageEvidence,
  evaluateRouteIqPrivateBrowserAcceptance,
  runRouteIqPrivateProductionBrowserAcceptance
} from "../scripts/verify-route-iq-private-paid-customer-production-browser-acceptance.mjs";
import {
  formatPrivateWorkflowV2Failure
} from "../scripts/lib/github-actions-private-worker-workflow-v2.mjs";

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

function browserPage(getRegistrations) {
  return {
    document: {
      body: {
        innerText: "Route IQ paid-customer configuration is ready",
        dataset: { workspaceId: "workspace_1" },
        scrollWidth: 390
      },
      documentElement: { scrollWidth: 390 }
    },
    navigator: {
      serviceWorker: { getRegistrations }
    },
    prometheusDebugState: {
      paidCustomerConfigurationPreview: { status: "ready" }
    },
    __routeIqPrivateAcceptance: {
      formAttempts: 0,
      popupAttempts: 0,
      serviceWorkerAttempts: 0
    },
    innerWidth: 390,
    innerHeight: 844,
    setTimeout,
    clearTimeout
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
  }), { status: "PASS", failures: [], failureDimensions: [] });

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

test("browser page evidence awaits asynchronous service-worker registration counts", async () => {
  let resolved = false;
  const pending = collectRouteIqPrivateBrowserPageEvidence(browserPage(async () => {
    await Promise.resolve();
    resolved = true;
    return [];
  }));
  assert.equal(resolved, false);
  const evidence = await pending;
  assert.equal(resolved, true);
  assert.equal(evidence.registrations, 0);

  const positive = await collectRouteIqPrivateBrowserPageEvidence(
    browserPage(async () => [{ scope: "/" }])
  );
  assert.equal(positive.registrations, 1);

  const unresolved = await collectRouteIqPrivateBrowserPageEvidence(
    browserPage(() => new Promise(() => {})),
    5
  );
  assert.equal(unresolved.registrations, null);
});

test("service-worker registration evidence accepts only finite nonnegative integer zero", () => {
  const invalidValues = [
    {},
    undefined,
    null,
    "0",
    -1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Promise.resolve(0),
    { then() {} }
  ];
  for (const value of invalidValues) {
    const scenarios = ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_VIEWPORTS.map(passingScenario);
    scenarios[0].serviceWorkerRegistrations = value;
    const result = evaluateRouteIqPrivateBrowserAcceptance({
      expectedWorkerVersion: VERSION,
      publicIsolationVerified: true,
      scenarios
    });
    assert.equal(result.status, "FAIL");
    assert.deepEqual(result.failureDimensions, [
      ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_FAILURE_DIMENSION
        .SERVICE_WORKER_REGISTRATION_COUNT_INVALID
    ]);
  }
});

test("desktop and exact mobile evidence share strict service-worker count classification", () => {
  for (const viewport of ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_VIEWPORTS) {
    const malformed = ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_VIEWPORTS.map(passingScenario);
    malformed.find(item => item.viewport === viewport.name).serviceWorkerRegistrations = {};
    const malformedResult = evaluateRouteIqPrivateBrowserAcceptance({
      expectedWorkerVersion: VERSION,
      publicIsolationVerified: true,
      scenarios: malformed
    });
    assert.ok(malformedResult.failures.includes(
      `${viewport.name}_service_worker_registration_count_invalid`
    ));

    const positive = ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_VIEWPORTS.map(passingScenario);
    positive.find(item => item.viewport === viewport.name).serviceWorkerRegistrations = 1;
    const positiveResult = evaluateRouteIqPrivateBrowserAcceptance({
      expectedWorkerVersion: VERSION,
      publicIsolationVerified: true,
      scenarios: positive
    });
    assert.ok(positiveResult.failures.includes(
      `${viewport.name}_service_worker_registration_count_nonzero`
    ));
    assert.deepEqual(positiveResult.failureDimensions, [
      ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_FAILURE_DIMENSION
        .SERVICE_WORKER_REGISTRATION_COUNT_NONZERO
    ]);
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

test("runner exposes only safe dimensions and workflow preserves the fixed dimension", async () => {
  const canaryId = "classification-client-id-canary";
  const canarySecret = "classification-client-secret-canary";
  let captured;
  try {
    await runRouteIqPrivateProductionBrowserAcceptance({
      credentials: {
        clientId: canaryId,
        clientSecret: canarySecret
      },
      expectedWorkerVersion: VERSION,
      publicIsolationVerified: true,
      launchBrowser: async () => ({
        debugPort: 12345,
        async close() {}
      }),
      runScenario: async ({ viewport }) => ({
        ...passingScenario(viewport),
        serviceWorkerRegistrations: {}
      })
    });
  } catch (error) {
    captured = error;
  }
  assert.ok(captured instanceof RouteIqPrivateBrowserAcceptanceError);
  assert.deepEqual(captured.failureDimensions, [
    ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_FAILURE_DIMENSION
      .SERVICE_WORKER_REGISTRATION_COUNT_INVALID
  ]);
  assert.equal(
    formatPrivateWorkflowV2Failure(captured),
    "QUALIFICATION_FAILED|DIMENSION=SERVICE_WORKER_REGISTRATION_COUNT_INVALID"
  );
  const safeFailure = [
    captured.name,
    captured.message,
    captured.code,
    JSON.stringify(captured.failureDimensions)
  ].join("|");
  assert.equal(safeFailure.includes(canaryId), false);
  assert.equal(safeFailure.includes(canarySecret), false);
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
