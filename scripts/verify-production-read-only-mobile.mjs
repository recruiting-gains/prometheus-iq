import { existsSync, readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export const MOBILE_VIEWPORT = Object.freeze({ width: 390, height: 844 });
export const CANONICAL_MOBILE_VIEWPORT_META = "width=device-width, initial-scale=1, viewport-fit=cover";

export const REQUIRED_COUNT_CATEGORIES = Object.freeze([
  "sessions",
  "visits",
  "actions",
  "outcomes",
  "prospectiveRecords",
  "conflicts",
  "exclusions",
  "evaluations"
]);

export const REQUIRED_GUARD_CONFIGURATION = Object.freeze({
  newBrowserContext: true,
  targetDiscoveryBeforeNavigation: true,
  canonicalPreflightViewportBeforeConfirmation: true,
  viewportAppliedBeforeProductionNavigation: true,
  viewportConfirmedBeforeProductionNavigation: true,
  defaultDenyProductionWrites: true,
  allowedProductionMethods: Object.freeze(["GET", "HEAD", "OPTIONS"]),
  bypassServiceWorkers: true,
  blockServiceWorkerRegistration: true,
  blockServiceWorkerFetch: true,
  blockFormSubmissions: true,
  denyDownloads: true,
  blockPopups: true,
  blockDialogs: true,
  blockProductionClicks: true,
  doNotReadCredentialsOrCookies: true
});

const productionUrlDefault = "https://prometheus-iq.prometheusrouteiq.workers.dev/";
const guardBindingName = "__prometheusReadOnlyGuardSignal";
const readMethods = new Set(REQUIRED_GUARD_CONFIGURATION.allowedProductionMethods);

function evaluation(failures, details = {}) {
  return {
    status: failures.length ? "FAIL" : "PASS",
    failures,
    ...details
  };
}

function own(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function finiteNonnegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

export function evaluatePreNavigationViewport(actual, expected = MOBILE_VIEWPORT) {
  const failures = [];
  const required = {
    windowInnerWidth: expected.width,
    windowInnerHeight: expected.height,
    documentClientWidth: expected.width,
    documentClientHeight: expected.height,
    screenWidth: expected.width,
    screenHeight: expected.height
  };

  for (const [field, expectedValue] of Object.entries(required)) {
    if (actual?.[field] !== expectedValue) {
      failures.push(`${field} must equal ${expectedValue}; received ${String(actual?.[field])}.`);
    }
  }

  return evaluation(failures, {
    navigationAllowed: failures.length === 0,
    expected: { ...expected },
    actual: actual && typeof actual === "object" ? { ...actual } : actual
  });
}

export function evaluateGuardConfiguration(configuration) {
  const failures = [];
  for (const [field, requiredValue] of Object.entries(REQUIRED_GUARD_CONFIGURATION)) {
    if (Array.isArray(requiredValue)) {
      if (!Array.isArray(configuration?.[field]) || !isDeepStrictEqual(configuration[field], requiredValue)) {
        failures.push(`${field} must equal ${JSON.stringify(requiredValue)}.`);
      }
    } else if (configuration?.[field] !== requiredValue) {
      failures.push(`${field} must be ${String(requiredValue)}.`);
    }
  }
  return evaluation(failures, { configuration });
}

export function evaluateProductionCounts(baseline, after) {
  const failures = [];
  for (const [label, counts] of [["baseline", baseline], ["after", after]]) {
    if (!counts || typeof counts !== "object" || Array.isArray(counts)) {
      failures.push(`${label} production counts must be a JSON object.`);
      continue;
    }
    for (const category of REQUIRED_COUNT_CATEGORIES) {
      if (!own(counts, category)) failures.push(`${label} production counts are missing ${category}.`);
      else if (!finiteNonnegativeInteger(counts[category])) failures.push(`${label}.${category} must be a nonnegative integer.`);
    }
  }
  if (!isDeepStrictEqual(baseline, after)) failures.push("Production counts changed during read-only verification.");
  return evaluation(failures, { baseline, after, deepEqual: isDeepStrictEqual(baseline, after) });
}

export function evaluateGuardEvidence(evidence) {
  const failures = [];
  const zeroRequired = [
    "attemptedApplicationWrites",
    "dialogAttempts",
    "controlActivationAttempts",
    "formSubmissionAttempts",
    "downloadAttempts",
    "popupAttempts",
    "bidirectionalChannelAttempts"
  ];
  for (const field of zeroRequired) {
    if (evidence?.[field] !== 0) failures.push(`${field} must be zero; received ${String(evidence?.[field])}.`);
  }
  if (evidence?.blockedApplicationWrites !== evidence?.attemptedApplicationWrites) {
    failures.push("Every attempted application write must be blocked.");
  }
  if (evidence?.blockedServiceWorkerRequests !== evidence?.serviceWorkerAttempts) {
    failures.push("Every service-worker registration or fetch attempt must be blocked.");
  }
  if (evidence?.serviceWorkerRegistrationsAfter !== 0) failures.push("No service-worker registration may remain active.");
  if (evidence?.guardInstalledBeforeNavigation !== true) failures.push("The read-only guard was not installed before navigation.");
  if (evidence?.networkBypassServiceWorkerEnabled !== true) failures.push("Network service-worker bypass was not enabled.");
  if (evidence?.downloadDenyEnabled !== true) failures.push("Browser-context download denial was not enabled.");
  if (Array.isArray(evidence?.guardAsyncErrors) && evidence.guardAsyncErrors.length) failures.push("The request guard emitted asynchronous errors.");
  return evaluation(failures, { evidence });
}

export function evaluateMobilePageEvidence(page) {
  const failures = [];
  if (page?.authenticated !== true) failures.push("The production app was not authenticated.");
  if (page?.rendered !== true) failures.push("Prometheus IQ did not render.");
  if (page?.routeIntelligenceVisible !== true) failures.push("Route Intelligence was not visible.");
  if (page?.directionsAvailable !== true) failures.push("Directions was not available.");
  if (page?.logResultAvailable !== true) failures.push("Log Result was not available.");
  if (page?.routeQueueCount !== 15) failures.push(`The active Route IQ queue must contain 15 stops; received ${String(page?.routeQueueCount)}.`);
  if (page?.windowInnerWidth !== MOBILE_VIEWPORT.width || page?.documentClientWidth !== MOBILE_VIEWPORT.width) {
    failures.push("The authenticated page did not remain exactly 390 CSS pixels wide.");
  }
  if (page?.windowInnerHeight !== MOBILE_VIEWPORT.height || page?.documentClientHeight !== MOBILE_VIEWPORT.height) {
    failures.push("The authenticated page did not remain exactly 844 CSS pixels high.");
  }
  if (page?.documentScrollWidth > MOBILE_VIEWPORT.width || page?.bodyScrollWidth > MOBILE_VIEWPORT.width) {
    failures.push("The authenticated mobile page has horizontal overflow.");
  }
  if (page?.serviceWorkerController !== false) failures.push("A service worker controlled the read-only verification page.");
  for (const field of ["consoleErrors", "consoleWarnings", "runtimeExceptions", "browserLogErrors", "networkFailures"]) {
    if (page?.[field] !== 0) failures.push(`${field} must be zero; received ${String(page?.[field])}.`);
  }
  return evaluation(failures, { page });
}

export function evaluateReadOnlyBrowserEvidence(input) {
  const viewport = evaluatePreNavigationViewport(input?.viewport);
  const guardConfiguration = evaluateGuardConfiguration(input?.guardConfiguration);
  const guard = evaluateGuardEvidence(input?.guardEvidence);
  const page = evaluateMobilePageEvidence(input?.pageEvidence);
  const failures = [
    ...viewport.failures,
    ...guardConfiguration.failures,
    ...guard.failures,
    ...page.failures
  ];
  if (input?.newBrowserContextCreated !== true) failures.push("A new browser context was not created.");
  if (input?.productionNavigationAttempted !== true) failures.push("Production navigation did not occur after guard installation.");
  if (input?.browserContextDisposed !== true) failures.push("The isolated browser context was not cleanly disposed.");
  if (input?.preflightViewportMetadataInstalled !== true) failures.push("Canonical mobile viewport metadata was not installed in the non-production preflight document.");
  const discoveryIndex = input?.verificationOrder?.indexOf("target_discovery_enabled") ?? -1;
  const preflightIndex = input?.verificationOrder?.indexOf("preflight_viewport_metadata_installed") ?? -1;
  const viewportConfirmationIndex = input?.verificationOrder?.indexOf("viewport_confirmed") ?? -1;
  const navigationIndex = input?.verificationOrder?.indexOf("production_navigation_attempted") ?? -1;
  if (discoveryIndex < 0 || navigationIndex < 0 || discoveryIndex >= navigationIndex) {
    failures.push("Target discovery must be enabled before production navigation.");
  }
  if (
    preflightIndex < 0 ||
    viewportConfirmationIndex < 0 ||
    navigationIndex < 0 ||
    preflightIndex >= viewportConfirmationIndex ||
    viewportConfirmationIndex >= navigationIndex
  ) {
    failures.push("Canonical mobile viewport metadata must be installed before viewport confirmation and production navigation.");
  }
  if (input?.verificationError) failures.unshift(String(input.verificationError));
  return evaluation(failures, {
    viewport,
    guardConfiguration,
    guard,
    page,
    newBrowserContextCreated: input?.newBrowserContextCreated === true,
    preflightViewportMetadataInstalled: input?.preflightViewportMetadataInstalled === true,
    productionNavigationAttempted: input?.productionNavigationAttempted === true,
    browserContextDisposed: input?.browserContextDisposed === true,
    verificationOrder: Array.isArray(input?.verificationOrder) ? [...input.verificationOrder] : []
  });
}

export function evaluateReadOnlyMobileVerification(input) {
  const browser = evaluateReadOnlyBrowserEvidence(input);
  const counts = evaluateProductionCounts(input?.baselineCounts, input?.afterCounts);
  return evaluation([...browser.failures, ...counts.failures], {
    browser,
    viewport: browser.viewport,
    guardConfiguration: browser.guardConfiguration,
    counts,
    guard: browser.guard,
    page: browser.page,
    newBrowserContextCreated: browser.newBrowserContextCreated,
    preflightViewportMetadataInstalled: browser.preflightViewportMetadataInstalled,
    productionNavigationAttempted: browser.productionNavigationAttempted,
    browserContextDisposed: browser.browserContextDisposed
  });
}

export function evaluateSavedBrowserEvidence(savedEvidence, baselineCounts, afterCounts) {
  const browserEvidence = savedEvidence?.browserEvidence || savedEvidence;
  return evaluateReadOnlyMobileVerification({
    ...browserEvidence,
    baselineCounts,
    afterCounts
  });
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = () => {
      const value = argv[++index];
      if (!value) throw new Error(`${token} requires a value.`);
      return value;
    };
    if (token === "--help") parsed.help = true;
    else if (token === "--json") parsed.json = true;
    else if (token === "--browser-only") parsed.browserOnly = true;
    else if (token === "--evaluate-evidence") parsed.evaluateEvidence = true;
    else if (token === "--cdp") parsed.cdp = next();
    else if (token.startsWith("--cdp=")) parsed.cdp = token.slice("--cdp=".length);
    else if (token === "--production-url") parsed.productionUrl = next();
    else if (token.startsWith("--production-url=")) parsed.productionUrl = token.slice("--production-url=".length);
    else if (token === "--baseline-counts") parsed.baselineCounts = next();
    else if (token.startsWith("--baseline-counts=")) parsed.baselineCounts = token.slice("--baseline-counts=".length);
    else if (token === "--after-counts") parsed.afterCounts = next();
    else if (token.startsWith("--after-counts=")) parsed.afterCounts = token.slice("--after-counts=".length);
    else if (token === "--browser-evidence") parsed.browserEvidence = next();
    else if (token.startsWith("--browser-evidence=")) parsed.browserEvidence = token.slice("--browser-evidence=".length);
    else if (token === "--auth-timeout-ms") parsed.authTimeoutMs = Number(next());
    else if (token.startsWith("--auth-timeout-ms=")) parsed.authTimeoutMs = Number(token.slice("--auth-timeout-ms=".length));
    else if (token === "--settle-ms") parsed.settleMs = Number(next());
    else if (token.startsWith("--settle-ms=")) parsed.settleMs = Number(token.slice("--settle-ms=".length));
    else throw new Error(`Unknown argument: ${token}`);
  }
  return parsed;
}

function readJsonInput(value, label) {
  if (!value) throw new Error(`${label} is required.`);
  const path = value.startsWith("@") ? value.slice(1) : value;
  const text = existsSync(path) ? readFileSync(path, "utf8") : value;
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
}

function sanitizedError(error) {
  return String(error?.message || error || "Unknown verification error.")
    .replace(/https?:\/\/[^\s)]+/gi, value => {
      try {
        return `${new URL(value).origin}/[redacted]`;
      } catch {
        return "[redacted-url]";
      }
    });
}

function wait(ms) {
  return new Promise(resolveWait => setTimeout(resolveWait, ms));
}

class RawCdpClient {
  constructor(webSocketUrl) {
    this.webSocketUrl = webSocketUrl;
    this.socket = null;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
  }

  async connect() {
    if (typeof WebSocket !== "function") throw new Error("This Node runtime does not provide WebSocket.");
    this.socket = new WebSocket(this.webSocketUrl);
    await new Promise((resolveOpen, rejectOpen) => {
      const timeout = setTimeout(() => rejectOpen(new Error("Timed out connecting to the browser CDP endpoint.")), 10_000);
      this.socket.addEventListener("open", () => {
        clearTimeout(timeout);
        resolveOpen();
      }, { once: true });
      this.socket.addEventListener("error", () => {
        clearTimeout(timeout);
        rejectOpen(new Error("The browser CDP WebSocket connection failed."));
      }, { once: true });
    });
    this.socket.addEventListener("message", event => this.handleMessage(event.data));
    this.socket.addEventListener("close", () => this.rejectPending(new Error("The browser CDP connection closed.")));
  }

  handleMessage(data) {
    const message = JSON.parse(typeof data === "string" ? data : Buffer.from(data).toString("utf8"));
    if (message.id && this.pending.has(message.id)) {
      const pending = this.pending.get(message.id);
      this.pending.delete(message.id);
      clearTimeout(pending.timeout);
      if (message.error) pending.reject(new Error(`${pending.method}: ${message.error.message}`));
      else pending.resolve(message.result || {});
      return;
    }
    const listeners = this.listeners.get(message.method) || [];
    for (const listener of listeners) {
      if (listener.sessionId === undefined || listener.sessionId === message.sessionId) {
        try {
          listener.handler(message.params || {}, message.sessionId);
        } catch {
          // Event handlers account for their own asynchronous failures in machine evidence.
        }
      }
    }
  }

  rejectPending(error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pending.clear();
  }

  on(method, handler, options = {}) {
    const listeners = this.listeners.get(method) || [];
    const listener = { handler, sessionId: options.sessionId };
    listeners.push(listener);
    this.listeners.set(method, listeners);
    return () => {
      const current = this.listeners.get(method) || [];
      this.listeners.set(method, current.filter(item => item !== listener));
    };
  }

  send(method, params = {}, sessionId, timeoutMs = 15_000) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return Promise.reject(new Error("The browser CDP connection is not open."));
    const id = this.nextId++;
    const message = { id, method, params };
    if (sessionId) message.sessionId = sessionId;
    return new Promise((resolveSend, rejectSend) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        rejectSend(new Error(`${method} timed out.`));
      }, timeoutMs);
      this.pending.set(id, { resolve: resolveSend, reject: rejectSend, timeout, method });
      this.socket.send(JSON.stringify(message));
    });
  }

  close() {
    this.rejectPending(new Error("The browser CDP connection was closed by the verifier."));
    if (this.socket && this.socket.readyState < WebSocket.CLOSING) this.socket.close();
  }
}

async function browserWebSocketUrl(cdpEndpoint) {
  if (/^wss?:\/\//i.test(cdpEndpoint)) return cdpEndpoint;
  const base = cdpEndpoint.replace(/\/$/, "");
  const response = await fetch(`${base}/json/version`, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`The browser-level CDP version endpoint returned HTTP ${response.status}.`);
  const version = await response.json();
  if (!version.webSocketDebuggerUrl) throw new Error("The CDP endpoint did not provide a browser-level WebSocket URL.");
  return version.webSocketDebuggerUrl;
}

async function evaluateInPage(client, sessionId, expression) {
  const response = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: false
  }, sessionId);
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text || "Runtime.evaluate failed.");
  return response.result?.value;
}

function viewportExpression() {
  return `(() => ({
    windowInnerWidth: window.innerWidth,
    windowInnerHeight: window.innerHeight,
    documentClientWidth: document.documentElement.clientWidth,
    documentClientHeight: document.documentElement.clientHeight,
    screenWidth: screen.width,
    screenHeight: screen.height
  }))()`;
}

function preflightDocument() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="${CANONICAL_MOBILE_VIEWPORT_META}">
  <title>Prometheus read-only mobile preflight</title>
</head>
<body data-prometheus-read-only-mobile-preflight="true"></body>
</html>`;
}

async function waitForCanonicalPreflightViewport(client, sessionId, productionOrigin, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const state = await evaluateInPage(client, sessionId, `(() => ({
      nonProduction: location.origin !== ${JSON.stringify(productionOrigin)},
      ready: document.readyState === "complete" || document.readyState === "interactive",
      marker: document.body?.dataset?.prometheusReadOnlyMobilePreflight === "true",
      viewport: document.querySelector('meta[name="viewport"]')?.getAttribute("content") || ""
    }))()`);
    if (state?.nonProduction && state?.ready && state?.marker && state?.viewport === CANONICAL_MOBILE_VIEWPORT_META) return state;
    await wait(25);
  }
  throw new Error("Canonical mobile viewport metadata did not become ready in the non-production preflight document.");
}

function guardBootstrapExpression(productionOrigin) {
  return `(() => {
    if (globalThis.__prometheusReadOnlyGuardInstalled) return;
    const productionOrigin = ${JSON.stringify(productionOrigin)};
    const inProduction = () => location.origin === productionOrigin;
    const signal = type => {
      if (!inProduction()) return;
      try {
        globalThis[${JSON.stringify(guardBindingName)}](JSON.stringify({ type }));
      } catch {}
    };
    const stop = event => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    };

    addEventListener("click", event => {
      if (!inProduction()) return;
      if (event.target?.closest?.("a[download]")) signal("download_attempt");
      signal("control_activation_attempt");
      stop(event);
    }, true);

    addEventListener("submit", event => {
      if (!inProduction()) return;
      signal("form_submission_attempt");
      stop(event);
    }, true);

    if (globalThis.HTMLFormElement) {
      const submit = HTMLFormElement.prototype.submit;
      const requestSubmit = HTMLFormElement.prototype.requestSubmit;
      HTMLFormElement.prototype.submit = function guardedSubmit(...args) {
        if (inProduction()) {
          signal("form_submission_attempt");
          return undefined;
        }
        return submit.apply(this, args);
      };
      if (requestSubmit) {
        HTMLFormElement.prototype.requestSubmit = function guardedRequestSubmit(...args) {
          if (inProduction()) {
            signal("form_submission_attempt");
            return undefined;
          }
          return requestSubmit.apply(this, args);
        };
      }
    }

    const nativeOpen = globalThis.open;
    globalThis.open = function guardedOpen(...args) {
      if (inProduction()) {
        signal("popup_attempt");
        return null;
      }
      return nativeOpen.apply(this, args);
    };

    for (const name of ["alert", "confirm", "prompt"]) {
      const nativeDialog = globalThis[name];
      globalThis[name] = function guardedDialog(...args) {
        if (inProduction()) {
          signal("dialog_attempt");
          return name === "confirm" ? false : name === "prompt" ? null : undefined;
        }
        return nativeDialog.apply(this, args);
      };
    }

    if (globalThis.ServiceWorkerContainer) {
      const prototype = ServiceWorkerContainer.prototype;
      const nativeRegister = prototype.register;
      prototype.register = function guardedServiceWorkerRegister(...args) {
        if (inProduction()) {
          signal("service_worker_attempt");
          return Promise.reject(new DOMException("Blocked by read-only production verification.", "SecurityError"));
        }
        return nativeRegister.apply(this, args);
      };
    }

    Object.defineProperty(globalThis, "__prometheusReadOnlyGuardInstalled", {
      value: true,
      configurable: false,
      enumerable: false,
      writable: false
    });
  })()`;
}

function pageEvidenceExpression(productionOrigin) {
  return `(() => {
    const bodyText = document.body?.innerText || "";
    const labels = Array.from(document.querySelectorAll("button, a"), element =>
      (element.innerText || element.textContent || "").trim()
    );
    let queueCount = null;
    try {
      const currentState = typeof state !== "undefined" ? state : globalThis.state;
      const currentRep = typeof activeRepId !== "undefined" ? activeRepId : globalThis.activeRepId;
      const entries = currentState?.repProfiles?.[currentRep]?.activeRouteQueue?.entries;
      queueCount = Array.isArray(entries) ? entries.length : null;
    } catch {}
    return {
      authenticated: location.origin === ${JSON.stringify(productionOrigin)} && !/cloudflareaccess/i.test(location.hostname),
      rendered: bodyText.includes("Prometheus IQ"),
      routeIntelligenceVisible: bodyText.includes("Route Intelligence"),
      directionsAvailable: labels.some(label => /Directions/i.test(label)),
      logResultAvailable: labels.some(label => /Log Result/i.test(label)),
      routeQueueCount: queueCount,
      windowInnerWidth: window.innerWidth,
      windowInnerHeight: window.innerHeight,
      documentClientWidth: document.documentElement.clientWidth,
      documentClientHeight: document.documentElement.clientHeight,
      documentScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body?.scrollWidth || 0,
      serviceWorkerController: Boolean(navigator.serviceWorker?.controller),
      guardInstalled: globalThis.__prometheusReadOnlyGuardInstalled === true,
      startupCompleted: globalThis.prometheusDebugState?.startupCompleted === true
    };
  })()`;
}

async function waitForAuthenticatedProduction(client, sessionId, productionOrigin, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const state = await evaluateInPage(client, sessionId, `(() => ({
        production: location.origin === ${JSON.stringify(productionOrigin)},
        rendered: (document.body?.innerText || "").includes("Prometheus IQ"),
        ready: document.readyState === "complete" || document.readyState === "interactive"
      }))()`);
      if (state?.production && state?.rendered && state?.ready) return;
    } catch {
      // Navigation can replace the execution context while authentication redirects settle.
    }
    await wait(250);
  }
  throw new Error("Authenticated production did not become ready before the configured timeout.");
}

function newGuardEvidence() {
  return {
    attemptedApplicationWrites: 0,
    blockedApplicationWrites: 0,
    serviceWorkerAttempts: 0,
    blockedServiceWorkerRequests: 0,
    dialogAttempts: 0,
    controlActivationAttempts: 0,
    formSubmissionAttempts: 0,
    downloadAttempts: 0,
    popupAttempts: 0,
    bidirectionalChannelAttempts: 0,
    serviceWorkerRegistrationsAfter: null,
    guardInstalledBeforeNavigation: false,
    networkBypassServiceWorkerEnabled: false,
    downloadDenyEnabled: false,
    guardAsyncErrors: []
  };
}

function recordBindingSignal(guard, payload) {
  let signal;
  try {
    signal = JSON.parse(payload);
  } catch {
    guard.guardAsyncErrors.push("invalid_guard_signal");
    return;
  }
  if (signal.type === "dialog_attempt") guard.dialogAttempts += 1;
  else if (signal.type === "control_activation_attempt") guard.controlActivationAttempts += 1;
  else if (signal.type === "form_submission_attempt") guard.formSubmissionAttempts += 1;
  else if (signal.type === "download_attempt") guard.downloadAttempts += 1;
  else if (signal.type === "popup_attempt") guard.popupAttempts += 1;
  else if (signal.type === "service_worker_attempt") {
    guard.serviceWorkerAttempts += 1;
    guard.blockedServiceWorkerRequests += 1;
  }
}

async function runBrowserVerification(options) {
  const productionUrl = new URL(options.productionUrl);
  if (productionUrl.protocol !== "https:") throw new Error("Production verification requires an HTTPS URL.");
  const productionOrigin = productionUrl.origin;
  const browserWs = await browserWebSocketUrl(options.cdp);
  const client = new RawCdpClient(browserWs);
  const guard = newGuardEvidence();
  const browserEvents = {
    consoleErrors: 0,
    consoleWarnings: 0,
    runtimeExceptions: 0,
    browserLogErrors: 0,
    networkFailures: 0
  };
  const order = [];
  const blockedNetworkIds = new Set();
  const seenDownloadGuids = new Set();
  let browserContextId;
  let targetId;
  let sessionId;
  let mainFrameId;
  let productionNavigationAttempted = false;
  let productionVerificationActive = false;
  let viewport;
  let page;
  let preflightViewportMetadataInstalled = false;
  let browserContextDisposed = false;
  let newBrowserContextCreated = false;
  let verificationError = null;

  try {
    await client.connect();
    await client.send("Target.setDiscoverTargets", { discover: true });
    order.push("target_discovery_enabled");
    ({ browserContextId } = await client.send("Target.createBrowserContext", { disposeOnDetach: false }));
    newBrowserContextCreated = true;
    order.push("new_browser_context_created");
    ({ targetId } = await client.send("Target.createTarget", { url: "about:blank", browserContextId, background: false }));
    order.push("about_blank_target_created");
    ({ sessionId } = await client.send("Target.attachToTarget", { targetId, flatten: true }));

    await Promise.all([
      client.send("Page.enable", {}, sessionId),
      client.send("Runtime.enable", {}, sessionId),
      client.send("Network.enable", {}, sessionId),
      client.send("Log.enable", {}, sessionId),
      client.send("ServiceWorker.enable", {}, sessionId)
    ]);
    const frameTree = await client.send("Page.getFrameTree", {}, sessionId);
    mainFrameId = frameTree.frameTree?.frame?.id;
    if (!mainFrameId) throw new Error("The non-production preflight frame was unavailable.");
    await client.send("Page.setDocumentContent", {
      frameId: mainFrameId,
      html: preflightDocument()
    }, sessionId);
    await waitForCanonicalPreflightViewport(client, sessionId, productionOrigin);
    preflightViewportMetadataInstalled = true;
    order.push("preflight_viewport_metadata_installed");

    await client.send("Emulation.setDeviceMetricsOverride", {
      width: MOBILE_VIEWPORT.width,
      height: MOBILE_VIEWPORT.height,
      deviceScaleFactor: 3,
      mobile: true,
      positionX: 0,
      positionY: 0,
      screenOrientation: { type: "portraitPrimary", angle: 0 }
    }, sessionId);
    await client.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 }, sessionId);
    await evaluateInPage(client, sessionId, "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))");
    order.push("viewport_applied");
    viewport = await evaluateInPage(client, sessionId, viewportExpression());
    const viewportCheck = evaluatePreNavigationViewport(viewport);
    if (!viewportCheck.navigationAllowed) throw new Error(`Pre-navigation viewport mismatch: ${viewportCheck.failures.join(" ")}`);
    order.push("viewport_confirmed");

    await client.send("Browser.setDownloadBehavior", {
      behavior: "deny",
      browserContextId,
      eventsEnabled: true
    });
    guard.downloadDenyEnabled = true;
    await client.send("Network.setBypassServiceWorker", { bypass: true }, sessionId);
    guard.networkBypassServiceWorkerEnabled = true;
    await client.send("ServiceWorker.disable", {}, sessionId);
    await client.send("Runtime.addBinding", { name: guardBindingName }, sessionId);
    const guardExpression = guardBootstrapExpression(productionOrigin);
    await client.send("Page.addScriptToEvaluateOnNewDocument", { source: guardExpression }, sessionId);
    await evaluateInPage(client, sessionId, guardExpression);
    await client.send("Fetch.enable", { patterns: [{ urlPattern: "*", requestStage: "Request" }] }, sessionId);

    client.on("Runtime.bindingCalled", params => {
      if (params.name === guardBindingName) recordBindingSignal(guard, params.payload);
    }, { sessionId });
    client.on("Runtime.exceptionThrown", () => {
      if (productionVerificationActive) browserEvents.runtimeExceptions += 1;
    }, { sessionId });
    client.on("Runtime.consoleAPICalled", params => {
      if (!productionVerificationActive) return;
      if (params.type === "error") browserEvents.consoleErrors += 1;
      if (["warning", "warn"].includes(params.type)) browserEvents.consoleWarnings += 1;
    }, { sessionId });
    client.on("Log.entryAdded", params => {
      if (productionVerificationActive && ["error", "warning"].includes(params.entry?.level)) browserEvents.browserLogErrors += 1;
    }, { sessionId });
    client.on("Network.loadingFailed", params => {
      if (!productionVerificationActive || params.canceled || blockedNetworkIds.has(params.requestId)) return;
      browserEvents.networkFailures += 1;
    }, { sessionId });
    client.on("Page.javascriptDialogOpening", () => {
      guard.dialogAttempts += 1;
      void client.send("Page.handleJavaScriptDialog", { accept: false }, sessionId).catch(() => {
        guard.guardAsyncErrors.push("dialog_dismissal_failed");
      });
    }, { sessionId });
    client.on("Browser.downloadWillBegin", params => {
      if (params.frameId !== mainFrameId || seenDownloadGuids.has(params.guid)) return;
      seenDownloadGuids.add(params.guid);
      guard.downloadAttempts += 1;
    });
    client.on("Target.targetCreated", params => {
      const info = params.targetInfo || {};
      if (!productionVerificationActive || info.targetId === targetId || info.browserContextId !== browserContextId) return;
      guard.popupAttempts += 1;
      void client.send("Target.closeTarget", { targetId: info.targetId }).catch(() => {
        guard.guardAsyncErrors.push("popup_close_failed");
      });
    });
    client.on("Fetch.requestPaused", params => {
      void (async () => {
        const method = String(params.request?.method || "").toUpperCase();
        let requestOrigin = "";
        let requestPath = "";
        try {
          const requestUrl = new URL(params.request?.url || "about:blank");
          requestOrigin = requestUrl.origin;
          requestPath = requestUrl.pathname;
        } catch {}
        const productionRequest = requestOrigin === productionOrigin;
        const serviceWorkerRequest = productionRequest && (
          params.resourceType === "ServiceWorker" || /(?:^|\/)(?:sw|service-worker)\.js$/i.test(requestPath)
        );
        const bidirectional = productionRequest && (
          params.resourceType === "WebSocket" || /^wss?:/i.test(params.request?.url || "")
        );
        if (serviceWorkerRequest) {
          guard.serviceWorkerAttempts += 1;
          guard.blockedServiceWorkerRequests += 1;
          if (params.networkId) blockedNetworkIds.add(params.networkId);
          await client.send("Fetch.failRequest", { requestId: params.requestId, errorReason: "BlockedByClient" }, sessionId);
          return;
        }
        if (bidirectional) {
          guard.bidirectionalChannelAttempts += 1;
          if (params.networkId) blockedNetworkIds.add(params.networkId);
          await client.send("Fetch.failRequest", { requestId: params.requestId, errorReason: "BlockedByClient" }, sessionId);
          return;
        }
        if (productionRequest && !readMethods.has(method)) {
          guard.attemptedApplicationWrites += 1;
          guard.blockedApplicationWrites += 1;
          if (params.networkId) blockedNetworkIds.add(params.networkId);
          await client.send("Fetch.failRequest", { requestId: params.requestId, errorReason: "BlockedByClient" }, sessionId);
          return;
        }
        await client.send("Fetch.continueRequest", { requestId: params.requestId }, sessionId);
      })().catch(() => {
        guard.guardAsyncErrors.push("request_interception_failed");
      });
    }, { sessionId });

    const guardInstalled = await evaluateInPage(client, sessionId, "globalThis.__prometheusReadOnlyGuardInstalled === true");
    if (!guardInstalled) throw new Error("The read-only guard did not install in the pre-navigation document.");
    guard.guardInstalledBeforeNavigation = true;
    order.push("default_deny_guard_installed");

    productionNavigationAttempted = true;
    order.push("production_navigation_attempted");
    await client.send("Page.navigate", { url: productionUrl.href }, sessionId);
    await client.send("Page.bringToFront", {}, sessionId);
    await waitForAuthenticatedProduction(client, sessionId, productionOrigin, options.authTimeoutMs);
    productionVerificationActive = true;
    await wait(options.settleMs);

    const appPage = await evaluateInPage(client, sessionId, pageEvidenceExpression(productionOrigin));
    const registrations = await evaluateInPage(client, sessionId, `navigator.serviceWorker?.getRegistrations
      ? navigator.serviceWorker.getRegistrations().then(items => items.length).catch(() => 0)
      : Promise.resolve(0)`);
    guard.serviceWorkerRegistrationsAfter = registrations;
    page = { ...appPage, ...browserEvents };
  } catch (error) {
    verificationError = sanitizedError(error);
  } finally {
    if (client.socket) {
      if (browserContextId) {
        try {
          await client.send("Target.disposeBrowserContext", { browserContextId }, undefined, 10_000);
          browserContextDisposed = true;
          order.push("browser_context_disposed");
        } catch {
          if (targetId) {
            try {
              await client.send("Target.closeTarget", { targetId }, undefined, 5_000);
            } catch {}
          }
        }
      }
      client.close();
    }
  }

  return {
    viewport,
    guardConfiguration: { ...REQUIRED_GUARD_CONFIGURATION, allowedProductionMethods: [...REQUIRED_GUARD_CONFIGURATION.allowedProductionMethods] },
    guardEvidence: guard,
    pageEvidence: page,
    newBrowserContextCreated,
    preflightViewportMetadataInstalled,
    productionNavigationAttempted,
    browserContextDisposed,
    verificationOrder: order,
    verificationError
  };
}

function usage() {
  return `Usage: node scripts/verify-production-read-only-mobile.mjs [options]

Options:
  --browser-only                Run only the guarded browser phase; no count inputs are read.
  --evaluate-evidence           Evaluate saved browser evidence and independent count snapshots; no browser opens.
  --browser-evidence <json|@file|file>
                                Browser-only evidence used by --evaluate-evidence.
  --cdp <endpoint>              Browser-level CDP HTTP or WebSocket endpoint.
  --production-url <url>       Authenticated production URL. Default: ${productionUrlDefault}
  --baseline-counts <json|@file|file>
                                Production counts captured before browser verification.
  --after-counts <json|@file|file>
                                Production counts read after browser verification.
  --auth-timeout-ms <ms>       Time allowed for an interactive Access redirect. Default: 120000.
  --settle-ms <ms>             Read-only app startup settling time. Default: 8000.
  --json                       Emit machine-readable JSON (the default output format).
  --help                       Show this help.

The verifier never reads browser cookies or credential values. Authentication may be
completed interactively in the newly created browser context before the production app loads.
Redirect browser-only JSON output to a file, capture fresh production counts afterward,
then use --evaluate-evidence for the final count-sensitive determination.`;
}

export async function runProductionReadOnlyMobileBrowserOnly(options) {
  const productionUrl = options.productionUrl || productionUrlDefault;
  const browserEvidence = await runBrowserVerification({
    cdp: options.cdp,
    productionUrl,
    authTimeoutMs: options.authTimeoutMs || 120_000,
    settleMs: options.settleMs ?? 8_000
  });
  const browserEvaluation = evaluateReadOnlyBrowserEvidence(browserEvidence);
  return {
    verifier: "production-read-only-mobile-verification-v1",
    mode: "browser-only",
    status: browserEvaluation.status,
    productionOrigin: new URL(productionUrl).origin,
    viewport: { ...MOBILE_VIEWPORT },
    authentication: "interactive_redirects_allowed_credentials_unread",
    browserEvidence,
    browserEvaluation
  };
}

export function runProductionReadOnlyMobileEvidenceEvaluation(options) {
  const savedBrowserEvidence = readJsonInput(options.browserEvidence, "--browser-evidence");
  const baselineCounts = readJsonInput(options.baselineCounts, "--baseline-counts");
  const afterCounts = readJsonInput(options.afterCounts, "--after-counts");
  const evidence = evaluateSavedBrowserEvidence(savedBrowserEvidence, baselineCounts, afterCounts);
  return {
    verifier: "production-read-only-mobile-verification-v1",
    mode: "evaluate-evidence",
    status: evidence.status,
    browserOpened: false,
    evidence
  };
}

export async function runProductionReadOnlyMobileVerification(options) {
  const baselineCounts = readJsonInput(options.baselineCounts, "--baseline-counts");
  const browser = await runBrowserVerification({
    cdp: options.cdp,
    productionUrl: options.productionUrl || productionUrlDefault,
    authTimeoutMs: options.authTimeoutMs || 120_000,
    settleMs: options.settleMs ?? 8_000
  });
  const afterCounts = readJsonInput(options.afterCounts, "--after-counts");
  const result = evaluateReadOnlyMobileVerification({
    ...browser,
    baselineCounts,
    afterCounts
  });
  return {
    verifier: "production-read-only-mobile-verification-v1",
    mode: "one-shot",
    status: result.status,
    productionOrigin: new URL(options.productionUrl || productionUrlDefault).origin,
    viewport: { ...MOBILE_VIEWPORT },
    authentication: "interactive_redirects_allowed_credentials_unread",
    evidence: result,
    verificationOrder: browser.verificationOrder,
    browserContextDisposed: browser.browserContextDisposed
  };
}

async function main() {
  let report;
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      console.log(usage());
      return;
    }
    if (args.browserOnly && args.evaluateEvidence) throw new Error("Choose either --browser-only or --evaluate-evidence, not both.");
    if (args.evaluateEvidence) {
      report = runProductionReadOnlyMobileEvidenceEvaluation(args);
    } else {
      if (!args.cdp) throw new Error("--cdp is required and must identify a browser-level CDP endpoint.");
      if (!Number.isFinite(args.authTimeoutMs ?? 120_000) || (args.authTimeoutMs ?? 120_000) <= 0) throw new Error("--auth-timeout-ms must be positive.");
      if (!Number.isFinite(args.settleMs ?? 8_000) || (args.settleMs ?? 8_000) < 0) throw new Error("--settle-ms must be nonnegative.");
      report = args.browserOnly
        ? await runProductionReadOnlyMobileBrowserOnly(args)
        : await runProductionReadOnlyMobileVerification(args);
    }
  } catch (error) {
    report = {
      verifier: "production-read-only-mobile-verification-v1",
      status: "FAIL",
      failures: [sanitizedError(error)]
    };
  }
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== "PASS") process.exitCode = 1;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) await main();
