import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

import {
  ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_FAILURE_DIMENSION,
  ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_VIEWPORTS,
  RouteIqPrivateBrowserAcceptanceError,
  classifyRouteIqPrivateBrowserHttpPath,
  classifyRouteIqPrivateBrowserLogEntry,
  collectRouteIqPrivateBrowserPageEvidence,
  evaluateRouteIqPrivateBrowserAcceptance,
  fetchRouteIqPrivateBrowserManagedIcon,
  isGuardedRouteIqServiceWorkerRequest,
  isRouteIqPrivateBrowserManagedIconRequest,
  reconcileRouteIqPrivateBrowserNetworkEvents,
  routeIqPrivateBrowserGuardScript,
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
    networkHttpFailures: 0,
    networkHttpFailureClassifications: [],
    consoleErrorClassifications: [],
    attemptedWrites: 0,
    blockedWrites: 0,
    formAttempts: 0,
    popupAttempts: 0,
    serviceWorkerRequests: 1,
    blockedServiceWorkerRequests: 1,
    guardedServiceWorkerLogErrors: 0,
    browserManagedIconBridgeAttempts: 0,
    browserManagedIconBridgeSuccesses: 0,
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
  assert.deepEqual(contract.network.browserManagedIconAuthenticatedResourceBridge, {
    exactOrigin: "https://prometheus-iq.prometheusrouteiq.workers.dev",
    exactPath: "/icons/prometheus.svg",
    queryAllowed: false,
    resourceType: "Other",
    method: "GET",
    redirectMode: "manual",
    acceptedStatus: "2XX",
    acceptedContentType: "image/svg+xml",
    maximumResponseBytes: 16384,
    maximumAttemptsPerViewport: 1,
    retryAllowed: false,
    syntheticBodyAllowed: false,
    credentialLoggingAllowed: false,
    responseBodyLoggingAllowed: false,
    failedBridgeIsFatal: true,
    allOtherHttpOrBrowserErrorsAllowed: false
  });
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
  }), {
    status: "PASS",
    failures: [],
    failureDimensions: [],
    failureDiagnostics: []
  });

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

test("health diagnostics distinguish every cause and exact viewport", () => {
  const cases = [
    ["desktop", "consoleErrors", "DESKTOP_CONSOLE_ERROR"],
    ["desktop", "runtimeExceptions", "DESKTOP_RUNTIME_EXCEPTION"],
    ["desktop", "networkFailures", "DESKTOP_NETWORK_FAILURE"],
    ["desktop", "networkHttpFailures", "DESKTOP_NETWORK_HTTP_FAILURE"],
    ["desktop", "externalRequests", "DESKTOP_EXTERNAL_REQUEST"],
    ["mobile", "consoleErrors", "MOBILE_CONSOLE_ERROR"],
    ["mobile", "runtimeExceptions", "MOBILE_RUNTIME_EXCEPTION"],
    ["mobile", "networkFailures", "MOBILE_NETWORK_FAILURE"],
    ["mobile", "networkHttpFailures", "MOBILE_NETWORK_HTTP_FAILURE"],
    ["mobile", "externalRequests", "MOBILE_EXTERNAL_REQUEST"]
  ];
  for (const [viewport, counter, expectedDimension] of cases) {
    const scenarios = ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_VIEWPORTS.map(passingScenario);
    scenarios.find(scenario => scenario.viewport === viewport)[counter] = 1;
    const evaluation = evaluateRouteIqPrivateBrowserAcceptance({
      expectedWorkerVersion: VERSION,
      publicIsolationVerified: true,
      scenarios
    });
    assert.equal(evaluation.status, "FAIL");
    assert.deepEqual(evaluation.failureDimensions, [expectedDimension]);
  }
});

test("health diagnostics remain deterministic and contain no observed browser values", async () => {
  const canaries = [
    "https://credential-canary.invalid/private",
    "authorization-header-canary",
    "runtime-message-canary"
  ];
  let captured;
  try {
    await runRouteIqPrivateProductionBrowserAcceptance({
      credentials: {
        clientId: canaries[1],
        clientSecret: canaries[2]
      },
      expectedWorkerVersion: VERSION,
      publicIsolationVerified: true,
      launchBrowser: async () => ({
        debugPort: 12345,
        async close() {}
      }),
      runScenario: async ({ viewport }) => ({
        ...passingScenario(viewport),
        consoleErrors: viewport.name === "desktop" ? 1 : 0,
        runtimeExceptions: viewport.name === "desktop" ? 1 : 0,
        networkFailures: viewport.name === "mobile" ? 1 : 0,
        externalRequests: viewport.name === "mobile" ? 1 : 0,
        observedUrl: canaries[0],
        observedMessage: canaries[2]
      })
    });
  } catch (error) {
    captured = error;
  }
  assert.ok(captured instanceof RouteIqPrivateBrowserAcceptanceError);
  assert.deepEqual(captured.failureDimensions, [
    "DESKTOP_CONSOLE_ERROR",
    "DESKTOP_RUNTIME_EXCEPTION",
    "MOBILE_NETWORK_FAILURE",
    "MOBILE_EXTERNAL_REQUEST"
  ]);
  assert.deepEqual(captured.failureDiagnostics, []);
  assert.equal(
    formatPrivateWorkflowV2Failure(captured),
    "QUALIFICATION_FAILED|DIMENSIONS=DESKTOP_CONSOLE_ERROR,DESKTOP_RUNTIME_EXCEPTION,MOBILE_NETWORK_FAILURE,MOBILE_EXTERNAL_REQUEST|DETAILS=NONE"
  );
  const serialized = JSON.stringify({
    name: captured.name,
    message: captured.message,
    code: captured.code,
    failureDimensions: captured.failureDimensions
  });
  for (const canary of canaries) assert.equal(serialized.includes(canary), false);
});

test("browser log classification suppresses only a correlated exact service-worker guard event", () => {
  const requestId = "request-1";
  const blockedNetworkIds = new Set([requestId]);
  assert.deepEqual(classifyRouteIqPrivateBrowserLogEntry({
    level: "error",
    source: "network",
    url: "https://prometheus-iq.prometheusrouteiq.workers.dev/sw.js",
    networkRequestId: requestId
  }, { blockedNetworkIds }), {
    counted: false,
    classification: "GUARDED_SERVICE_WORKER_NETWORK_LOG"
  });

  for (const entry of [
    {
      level: "error",
      source: "network",
      url: "https://prometheus-iq.prometheusrouteiq.workers.dev/dashboard/module.mjs",
      networkRequestId: requestId
    },
    {
      level: "error",
      source: "security",
      url: "https://prometheus-iq.prometheusrouteiq.workers.dev/sw.js",
      networkRequestId: requestId
    },
    {
      level: "error",
      source: "network",
      url: "https://external.invalid/sw.js",
      networkRequestId: requestId
    }
  ]) {
    assert.equal(
      classifyRouteIqPrivateBrowserLogEntry(entry, { blockedNetworkIds }).counted,
      true
    );
  }
});

test("browser-managed icon bridge matches only the exact same-origin Other request", () => {
  const icon = new URL(
    "https://prometheus-iq.prometheusrouteiq.workers.dev/icons/prometheus.svg"
  );
  assert.equal(isRouteIqPrivateBrowserManagedIconRequest(icon, "Other"), true);
  for (const [url, resourceType] of [
    [new URL(`${icon.href}?v=1`), "Other"],
    [new URL("https://external.invalid/icons/prometheus.svg"), "Other"],
    [new URL("https://prometheus-iq.prometheusrouteiq.workers.dev/icons/other.svg"), "Other"],
    [icon, "Image"],
    [icon, "Manifest"],
    [icon, "Fetch"]
  ]) {
    assert.equal(isRouteIqPrivateBrowserManagedIconRequest(url, resourceType), false);
  }
});

test("browser-managed icon bridge fetches one authenticated real SVG without retry or leakage", async () => {
  const credentialCanaries = {
    clientId: "client-id-canary",
    clientSecret: "client-secret-canary"
  };
  const bodyBytes = Uint8Array.from([60, 115, 118, 103, 47, 62]);
  const calls = [];
  const result = await fetchRouteIqPrivateBrowserManagedIcon({
    credentials: credentialCanaries,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return {
        status: 200,
        redirected: false,
        headers: new Headers({
          "content-type": "image/svg+xml; charset=utf-8",
          "content-length": String(bodyBytes.byteLength)
        }),
        async arrayBuffer() {
          return bodyBytes.buffer;
        }
      };
    }
  });
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    "https://prometheus-iq.prometheusrouteiq.workers.dev/icons/prometheus.svg"
  );
  assert.equal(calls[0].options.method, "GET");
  assert.equal(calls[0].options.redirect, "manual");
  assert.equal(calls[0].options.cache, "no-store");
  assert.equal("body" in calls[0].options, false);
  assert.equal(result.responseCode, 200);
  assert.equal(result.body, Buffer.from(bodyBytes).toString("base64"));
  const serializedResult = JSON.stringify(result);
  assert.equal(serializedResult.includes(credentialCanaries.clientId), false);
  assert.equal(serializedResult.includes(credentialCanaries.clientSecret), false);
});

test("browser-managed icon bridge rejects status, redirect, type, length, and body failures once", async () => {
  const credentials = {
    clientId: "client-id-canary",
    clientSecret: "client-secret-canary"
  };
  const validBody = Uint8Array.from([60, 115, 118, 103, 47, 62]);
  const cases = [
    { status: 403 },
    { status: 503 },
    { status: 302 },
    { redirected: true },
    { contentType: "image/png" },
    { contentLength: "16385" },
    { contentLength: "invalid" },
    { body: new Uint8Array(16385) },
    { body: new Uint8Array(0) },
    { bodyFailure: true },
    { fetchFailure: true }
  ];
  for (const item of cases) {
    let calls = 0;
    let captured;
    try {
      await fetchRouteIqPrivateBrowserManagedIcon({
        credentials,
        fetchImpl: async () => {
          calls += 1;
          if (item.fetchFailure) throw new Error("credential-canary-must-not-escape");
          const body = item.body || validBody;
          return {
            status: item.status ?? 200,
            redirected: item.redirected ?? false,
            headers: new Headers({
              "content-type": item.contentType || "image/svg+xml",
              "content-length": item.contentLength ?? String(body.byteLength)
            }),
            async arrayBuffer() {
              if (item.bodyFailure) throw new Error("body-canary-must-not-escape");
              return body.buffer;
            }
          };
        }
      });
    } catch (error) {
      captured = error;
    }
    assert.equal(calls, 1);
    assert.match(captured?.message || "", /^route_iq_private_browser_icon_bridge_/u);
    assert.equal(String(captured).includes("canary-must-not-escape"), false);
  }
});

test("browser-managed icon bridge does not suppress any HTTP or network log failure", () => {
  const iconUrl = "https://prometheus-iq.prometheusrouteiq.workers.dev/icons/prometheus.svg";
  for (const status of [403, 503]) {
    const result = reconcileRouteIqPrivateBrowserNetworkEvents({
      httpFailures: [{
        requestId: "request-id",
        resourceType: "Other",
        status,
        url: iconUrl
      }],
      errorLogEntries: [{
        level: "error",
        source: "network",
        url: iconUrl,
        networkRequestId: "request-id"
      }]
    });
    assert.equal(result.networkHttpFailures, 1);
    assert.equal(result.consoleErrors, 1);
    assert.deepEqual(result.networkHttpFailureClassifications, [
      `HTTP_OTHER_${status === 403 ? "4XX" : "5XX"}_ICON`
    ]);
    assert.deepEqual(result.consoleErrorClassifications, ["LOG_NETWORK"]);
  }
});

test("browser-managed icon bridge evidence is bounded and failed or repeated bridges fail", () => {
  const accepted = ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_VIEWPORTS.map(passingScenario);
  Object.assign(accepted[0], {
    browserManagedIconBridgeAttempts: 1,
    browserManagedIconBridgeSuccesses: 1
  });
  assert.equal(evaluateRouteIqPrivateBrowserAcceptance({
    expectedWorkerVersion: VERSION,
    publicIsolationVerified: true,
    scenarios: accepted
  }).status, "PASS");

  for (const values of [
    { browserManagedIconBridgeAttempts: 1, browserManagedIconBridgeSuccesses: 0 },
    { browserManagedIconBridgeAttempts: 2, browserManagedIconBridgeSuccesses: 2 },
    { browserManagedIconBridgeAttempts: 0, browserManagedIconBridgeSuccesses: 1 }
  ]) {
    const scenarios = ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_VIEWPORTS.map(passingScenario);
    Object.assign(scenarios[0], values);
    const evaluation = evaluateRouteIqPrivateBrowserAcceptance({
      expectedWorkerVersion: VERSION,
      publicIsolationVerified: true,
      scenarios
    });
    assert.ok(evaluation.failureDimensions.includes(
      ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_FAILURE_DIMENSION
        .BROWSER_MANAGED_ICON_BRIDGE
    ));
  }

  const loadingFailure = ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_VIEWPORTS.map(passingScenario);
  Object.assign(loadingFailure[0], {
    networkFailures: 1,
    browserManagedIconBridgeAttempts: 1,
    browserManagedIconBridgeSuccesses: 1
  });
  assert.ok(evaluateRouteIqPrivateBrowserAcceptance({
    expectedWorkerVersion: VERSION,
    publicIsolationVerified: true,
    scenarios: loadingFailure
  }).failureDimensions.includes(
    ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_FAILURE_DIMENSION.DESKTOP_NETWORK_FAILURE
  ));
});

test("service-worker request guard covers Chromium Other classification by exact path", () => {
  assert.equal(isGuardedRouteIqServiceWorkerRequest(
    new URL("https://prometheus-iq.prometheusrouteiq.workers.dev/sw.js")
  ), true);
  assert.equal(isGuardedRouteIqServiceWorkerRequest(
    new URL("https://prometheus-iq.prometheusrouteiq.workers.dev/sw.js?update=1")
  ), true);
  assert.equal(isGuardedRouteIqServiceWorkerRequest(
    new URL("https://prometheus-iq.prometheusrouteiq.workers.dev/sw.js.map")
  ), false);
  assert.equal(isGuardedRouteIqServiceWorkerRequest(
    new URL("https://external.invalid/sw.js")
  ), false);
});

test("service-worker guard returns the complete inert registration interface", async () => {
  const serviceWorker = {};
  const context = {
    navigator: { serviceWorker },
    location: { origin: "https://prometheus-iq.prometheusrouteiq.workers.dev" },
    addEventListener() {},
    globalThis: null
  };
  context.globalThis = context;
  vm.runInNewContext(routeIqPrivateBrowserGuardScript(), context);
  const registration = await serviceWorker.register("sw.js");
  assert.equal(context.__routeIqPrivateAcceptance.serviceWorkerGuardInstalled, true);
  assert.equal(context.__routeIqPrivateAcceptance.serviceWorkerAttempts, 1);
  assert.equal(registration.waiting, null);
  assert.equal(registration.installing, null);
  assert.equal(typeof registration.addEventListener, "function");
  assert.equal(typeof registration.removeEventListener, "function");
  assert.equal(await registration.unregister(), true);
  assert.equal(await registration.update(), undefined);
});

test("fixed diagnostics distinguish browser source and same-origin HTTP class", () => {
  const scenarios = ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_VIEWPORTS.map(passingScenario);
  scenarios[0].consoleErrors = 2;
  scenarios[0].consoleErrorClassifications = ["LOG_NETWORK", "LOG_SECURITY"];
  scenarios[0].networkHttpFailures = 1;
  scenarios[0].networkHttpFailureClassifications = ["HTTP_MANIFEST_4XX_MANIFEST"];
  const result = evaluateRouteIqPrivateBrowserAcceptance({
    expectedWorkerVersion: VERSION,
    publicIsolationVerified: true,
    scenarios
  });
  assert.deepEqual(result.failureDimensions, [
    "DESKTOP_CONSOLE_ERROR",
    "DESKTOP_NETWORK_HTTP_FAILURE"
  ]);
  assert.deepEqual(result.failureDiagnostics, [
    "DESKTOP_LOG_NETWORK",
    "DESKTOP_LOG_SECURITY",
    "DESKTOP_HTTP_MANIFEST_4XX_MANIFEST"
  ]);
});

test("HTTP diagnostics disclose only fixed same-origin path classes", () => {
  const cases = [
    ["/", "ROOT"],
    ["/favicon.ico?cache=1", "FAVICON"],
    ["/sw.js", "SERVICE_WORKER"],
    ["/manifest.webmanifest", "MANIFEST"],
    ["/icons/prometheus.svg", "ICON"],
    ["/dashboard/runtime.mjs", "APP_ASSET"],
    ["/assets/runtime.js", "APP_ASSET"],
    ["/static/runtime.css", "APP_ASSET"],
    ["/api/route-iq", "API"],
    ["/private/credential-canary", "OTHER"]
  ];
  for (const [path, expected] of cases) {
    assert.equal(classifyRouteIqPrivateBrowserHttpPath(
      new URL(path, "https://prometheus-iq.prometheusrouteiq.workers.dev")
    ), expected);
  }
  assert.equal(classifyRouteIqPrivateBrowserHttpPath(
    new URL("https://external.invalid/favicon.ico")
  ), "OTHER");

  const scenarios = ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_VIEWPORTS.map(passingScenario);
  scenarios[0].networkHttpFailures = 1;
  scenarios[0].networkHttpFailureClassifications = ["HTTP_OTHER_4XX_OTHER"];
  const result = evaluateRouteIqPrivateBrowserAcceptance({
    expectedWorkerVersion: VERSION,
    publicIsolationVerified: true,
    scenarios
  });
  const serialized = JSON.stringify(result);
  assert.deepEqual(result.failureDiagnostics, ["DESKTOP_HTTP_OTHER_4XX_OTHER"]);
  assert.equal(serialized.includes("credential-canary"), false);
  assert.equal(serialized.includes("/private/"), false);
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
    "QUALIFICATION_FAILED|DIMENSIONS=SERVICE_WORKER_REGISTRATION_COUNT_INVALID|DETAILS=NONE"
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
