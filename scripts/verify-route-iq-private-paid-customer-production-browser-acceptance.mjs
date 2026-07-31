import { spawn } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  CLOUDFLARE_UNATTENDED_SMOKE_MARKER,
  CLOUDFLARE_UNATTENDED_SMOKE_ORIGIN,
  CLOUDFLARE_UNATTENDED_SMOKE_VERSION
} from "../workers/infrastructure/cloudflare-unattended-smoke-contract.js";
import {
  ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_PATH,
  ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_RUNTIME_VERSION
} from "../workers/infrastructure/route-iq-controlled-paid-customer-onboarding-rehearsal-runtime.js";

export const ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_VERSION =
  "route-iq-private-paid-customer-browser-acceptance-v1";
export const ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_VIEWPORTS = Object.freeze([
  Object.freeze({ name: "desktop", width: 1440, height: 900, mobile: false }),
  Object.freeze({ name: "mobile", width: 390, height: 844, mobile: true })
]);
export const ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_STABILITY = Object.freeze({
  requiredConsecutiveExactProbes: 3,
  maximumAttempts: 10,
  delayMilliseconds: 1_500,
  probeTimeoutMilliseconds: 15_000
});
export const ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_FAILURE_DIMENSION = Object.freeze({
  IDENTITY: "IDENTITY",
  BROWSER_VERSION_STABILITY: "BROWSER_VERSION_STABILITY",
  VIEWPORT: "VIEWPORT",
  DOCUMENT_STATUS: "DOCUMENT_STATUS",
  WORKER_IDENTITY: "WORKER_IDENTITY",
  RENDER: "RENDER",
  CONTROLLED_REHEARSAL: "CONTROLLED_REHEARSAL",
  DESKTOP_CONSOLE_ERROR: "DESKTOP_CONSOLE_ERROR",
  DESKTOP_RUNTIME_EXCEPTION: "DESKTOP_RUNTIME_EXCEPTION",
  DESKTOP_NETWORK_FAILURE: "DESKTOP_NETWORK_FAILURE",
  DESKTOP_NETWORK_HTTP_FAILURE: "DESKTOP_NETWORK_HTTP_FAILURE",
  DESKTOP_EXTERNAL_REQUEST: "DESKTOP_EXTERNAL_REQUEST",
  MOBILE_CONSOLE_ERROR: "MOBILE_CONSOLE_ERROR",
  MOBILE_RUNTIME_EXCEPTION: "MOBILE_RUNTIME_EXCEPTION",
  MOBILE_NETWORK_FAILURE: "MOBILE_NETWORK_FAILURE",
  MOBILE_NETWORK_HTTP_FAILURE: "MOBILE_NETWORK_HTTP_FAILURE",
  MOBILE_EXTERNAL_REQUEST: "MOBILE_EXTERNAL_REQUEST",
  WRITE_ATTEMPT: "WRITE_ATTEMPT",
  SERVICE_WORKER_REGISTRATION_COUNT_INVALID: "SERVICE_WORKER_REGISTRATION_COUNT_INVALID",
  SERVICE_WORKER_REGISTRATION_COUNT_NONZERO: "SERVICE_WORKER_REGISTRATION_COUNT_NONZERO",
  SERVICE_WORKER_REQUEST_GUARD: "SERVICE_WORKER_REQUEST_GUARD",
  BROWSER_MANAGED_ICON_BRIDGE: "BROWSER_MANAGED_ICON_BRIDGE"
});

const HEALTH_FAILURES_BY_VIEWPORT = Object.freeze({
  desktop: Object.freeze([
    Object.freeze({
      counter: "consoleErrors",
      failure: "desktop_console_error",
      dimension:
        ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_FAILURE_DIMENSION.DESKTOP_CONSOLE_ERROR
    }),
    Object.freeze({
      counter: "runtimeExceptions",
      failure: "desktop_runtime_exception",
      dimension:
        ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_FAILURE_DIMENSION.DESKTOP_RUNTIME_EXCEPTION
    }),
    Object.freeze({
      counter: "networkFailures",
      failure: "desktop_network_failure",
      dimension:
        ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_FAILURE_DIMENSION.DESKTOP_NETWORK_FAILURE
    }),
    Object.freeze({
      counter: "networkHttpFailures",
      failure: "desktop_network_http_failure",
      dimension:
        ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_FAILURE_DIMENSION.DESKTOP_NETWORK_HTTP_FAILURE
    }),
    Object.freeze({
      counter: "externalRequests",
      failure: "desktop_external_request",
      dimension:
        ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_FAILURE_DIMENSION.DESKTOP_EXTERNAL_REQUEST
    })
  ]),
  mobile: Object.freeze([
    Object.freeze({
      counter: "consoleErrors",
      failure: "mobile_console_error",
      dimension:
        ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_FAILURE_DIMENSION.MOBILE_CONSOLE_ERROR
    }),
    Object.freeze({
      counter: "runtimeExceptions",
      failure: "mobile_runtime_exception",
      dimension:
        ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_FAILURE_DIMENSION.MOBILE_RUNTIME_EXCEPTION
    }),
    Object.freeze({
      counter: "networkFailures",
      failure: "mobile_network_failure",
      dimension:
        ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_FAILURE_DIMENSION.MOBILE_NETWORK_FAILURE
    }),
    Object.freeze({
      counter: "networkHttpFailures",
      failure: "mobile_network_http_failure",
      dimension:
        ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_FAILURE_DIMENSION.MOBILE_NETWORK_HTTP_FAILURE
    }),
    Object.freeze({
      counter: "externalRequests",
      failure: "mobile_external_request",
      dimension:
        ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_FAILURE_DIMENSION.MOBILE_EXTERNAL_REQUEST
    })
  ])
});

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const GUARDED_BROWSER_MANAGED_ICON_PATH = "/icons/prometheus.svg";
const GUARDED_BROWSER_MANAGED_ICON_URL =
  `${CLOUDFLARE_UNATTENDED_SMOKE_ORIGIN}${GUARDED_BROWSER_MANAGED_ICON_PATH}`;
const MAX_BROWSER_MANAGED_ICON_BRIDGE_ATTEMPTS_PER_VIEWPORT = 1;
const MAX_BROWSER_MANAGED_ICON_BYTES = 16 * 1024;
const BROWSER_MANAGED_ICON_TIMEOUT_MILLISECONDS = 10_000;
const MAX_CONTROLLED_REHEARSAL_RESPONSE_BYTES = 16 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const FAILURE_DIMENSIONS = new Set(
  Object.values(ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_FAILURE_DIMENSION)
);
const CONSOLE_ERROR_CLASSIFICATIONS = new Set([
  "CONSOLE_API",
  "LOG_NETWORK",
  "LOG_SECURITY",
  "LOG_JAVASCRIPT",
  "LOG_RENDERING",
  "LOG_WORKER",
  "LOG_DEPRECATION",
  "LOG_VIOLATION",
  "LOG_INTERVENTION",
  "LOG_RECOMMENDATION",
  "LOG_OTHER"
]);
const HTTP_RESOURCE_CLASSIFICATIONS = new Set([
  "DOCUMENT",
  "STYLESHEET",
  "IMAGE",
  "MEDIA",
  "FONT",
  "SCRIPT",
  "XHR",
  "FETCH",
  "MANIFEST",
  "OTHER"
]);
const HTTP_PATH_CLASSIFICATIONS = new Set([
  "ROOT",
  "FAVICON",
  "SERVICE_WORKER",
  "MANIFEST",
  "ICON",
  "APP_ASSET",
  "API",
  "OTHER"
]);
const FAILURE_DIAGNOSTICS = new Set(
  [
    "BROWSER_STABILITY_NOT_REACHED",
    "BROWSER_STABILITY_NON_READ_REQUEST",
    "BROWSER_STABILITY_EXTERNAL_REQUEST",
    ...ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_VIEWPORTS.flatMap(viewport => [
      ...[
        "STATUS",
        "VERSION",
        "MARKER",
        "TIMEOUT"
      ].map(value =>
        `${viewport.name.toUpperCase()}_DOCUMENT_GATE_${value}`),
      ...[...CONSOLE_ERROR_CLASSIFICATIONS].map(value =>
        `${viewport.name.toUpperCase()}_${value}`),
      ...[...HTTP_RESOURCE_CLASSIFICATIONS].flatMap(resource =>
        [...HTTP_PATH_CLASSIFICATIONS].flatMap(path =>
          [`${viewport.name.toUpperCase()}_HTTP_${resource}_4XX_${path}`,
            `${viewport.name.toUpperCase()}_HTTP_${resource}_5XX_${path}`]))
    ])
  ]
);
export const ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_FAILURE_DIAGNOSTICS =
  Object.freeze([...FAILURE_DIAGNOSTICS]);
const CHROME_CANDIDATES = Object.freeze([
  "/usr/bin/google-chrome-stable",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
]);

function fail(code) {
  throw new Error(code);
}

export class RouteIqPrivateBrowserAcceptanceError extends Error {
  constructor(failureDimensions, failureDiagnostics = []) {
    super("route_iq_private_browser_acceptance_failed");
    this.name = "RouteIqPrivateBrowserAcceptanceError";
    this.code = "route_iq_private_browser_acceptance_failed";
    this.failureDimensions = Object.freeze(
      [...new Set(failureDimensions)].filter(value => FAILURE_DIMENSIONS.has(value))
    );
    this.failureDiagnostics = Object.freeze(
      [...new Set(failureDiagnostics)].filter(value => FAILURE_DIAGNOSTICS.has(value))
    );
  }
}

function wait(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function chromeExecutable(environment) {
  const configured = environment.CHROME_PATH;
  if (typeof configured === "string" && configured.length > 0 && existsSync(configured)) {
    return configured;
  }
  const candidate = CHROME_CANDIDATES.find(existsSync);
  if (!candidate) fail("route_iq_private_browser_chrome_unavailable");
  return candidate;
}

async function waitForChromePort(userDataDirectory, processHandle) {
  const portFile = join(userDataDirectory, "DevToolsActivePort");
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (processHandle.exitCode !== null) fail("route_iq_private_browser_chrome_start_failed");
    if (existsSync(portFile)) {
      const [port] = readFileSync(portFile, "utf8").trim().split(/\r?\n/u);
      if (/^[1-9][0-9]{0,4}$/u.test(port)) return Number(port);
    }
    await wait(25);
  }
  fail("route_iq_private_browser_chrome_start_timeout");
}

async function launchIsolatedChrome({
  environment = process.env,
  spawnImpl = spawn,
  temporaryRoot = tmpdir()
} = {}) {
  const userDataDirectory = mkdtempSync(join(temporaryRoot, "route-iq-private-browser-"));
  const processHandle = spawnImpl(chromeExecutable(environment), [
    "--headless=new",
    "--disable-background-networking",
    "--disable-component-update",
    "--disable-default-apps",
    "--disable-extensions",
    "--disable-sync",
    "--no-first-run",
    "--no-default-browser-check",
    `--user-data-dir=${userDataDirectory}`,
    "--remote-debugging-address=127.0.0.1",
    "--remote-debugging-port=0",
    "about:blank"
  ], { stdio: "ignore" });
  try {
    const debugPort = await waitForChromePort(userDataDirectory, processHandle);
    return {
      debugPort,
      async close() {
        if (processHandle.exitCode === null) processHandle.kill("SIGTERM");
        const deadline = Date.now() + 2_000;
        while (processHandle.exitCode === null && Date.now() < deadline) await wait(25);
        if (processHandle.exitCode === null) processHandle.kill("SIGKILL");
        rmSync(userDataDirectory, { recursive: true, force: true });
      }
    };
  } catch (error) {
    if (processHandle.exitCode === null) processHandle.kill("SIGKILL");
    rmSync(userDataDirectory, { recursive: true, force: true });
    throw error;
  }
}

class CdpClient {
  constructor(webSocketUrl) {
    this.webSocketUrl = webSocketUrl;
    this.socket = null;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
  }

  async connect() {
    if (typeof WebSocket !== "function") fail("route_iq_private_browser_websocket_unavailable");
    this.socket = new WebSocket(this.webSocketUrl);
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("route_iq_private_browser_cdp_timeout")),
        10_000
      );
      this.socket.addEventListener("open", () => {
        clearTimeout(timeout);
        resolve();
      }, { once: true });
      this.socket.addEventListener("error", () => {
        clearTimeout(timeout);
        reject(new Error("route_iq_private_browser_cdp_failed"));
      }, { once: true });
    });
    this.socket.addEventListener("message", event => this.handle(event.data));
  }

  handle(data) {
    const message = JSON.parse(
      typeof data === "string" ? data : Buffer.from(data).toString("utf8")
    );
    if (message.id && this.pending.has(message.id)) {
      const pending = this.pending.get(message.id);
      this.pending.delete(message.id);
      clearTimeout(pending.timeout);
      if (message.error) pending.reject(new Error("route_iq_private_browser_cdp_command_failed"));
      else pending.resolve(message.result || {});
      return;
    }
    for (const listener of this.listeners.get(message.method) || []) {
      if (listener.sessionId === undefined || listener.sessionId === message.sessionId) {
        listener.handler(message.params || {}, message.sessionId);
      }
    }
  }

  on(method, handler, { sessionId } = {}) {
    const listeners = this.listeners.get(method) || [];
    listeners.push({ handler, sessionId });
    this.listeners.set(method, listeners);
  }

  send(method, params = {}, sessionId, timeoutMilliseconds = 15_000) {
    const id = this.nextId++;
    const message = { id, method, params };
    if (sessionId) message.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("route_iq_private_browser_cdp_command_timeout"));
      }, timeoutMilliseconds);
      this.pending.set(id, { resolve, reject, timeout });
      this.socket.send(JSON.stringify(message));
    });
  }

  close() {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("route_iq_private_browser_cdp_closed"));
    }
    this.pending.clear();
    if (this.socket?.readyState < WebSocket.CLOSING) this.socket.close();
  }
}

async function browserWebSocketUrl(debugPort, fetchImpl) {
  const response = await fetchImpl(`http://127.0.0.1:${debugPort}/json/version`, {
    signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) fail("route_iq_private_browser_cdp_version_failed");
  const value = await response.json();
  if (typeof value.webSocketDebuggerUrl !== "string") {
    fail("route_iq_private_browser_cdp_version_invalid");
  }
  return value.webSocketDebuggerUrl;
}

async function evaluate(client, sessionId, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: false
  }, sessionId);
  if (result.exceptionDetails) fail("route_iq_private_browser_page_evaluation_failed");
  return result.result?.value;
}

export function routeIqPrivateBrowserAuthenticatedRequestHeaders(headers, credentials) {
  const denied = new Set([
    "cf-access-client-id",
    "cf-access-client-secret",
    CLOUDFLARE_UNATTENDED_SMOKE_MARKER.requestHeader.toLowerCase()
  ]);
  const entries = Array.isArray(headers)
    ? headers
    : Object.entries(headers || {}).map(([name, value]) => ({ name, value: String(value) }));
  const sanitized = entries.filter(
    header => !denied.has(String(header.name).toLowerCase())
  );
  sanitized.push(
    { name: "CF-Access-Client-Id", value: credentials.clientId },
    { name: "CF-Access-Client-Secret", value: credentials.clientSecret },
    {
      name: CLOUDFLARE_UNATTENDED_SMOKE_MARKER.requestHeader,
      value: CLOUDFLARE_UNATTENDED_SMOKE_MARKER.requestValue
    }
  );
  return sanitized;
}

function lowerHeaders(headers) {
  return Object.fromEntries(
    Object.entries(headers || {}).map(([name, value]) => [name.toLowerCase(), String(value)])
  );
}

function lowerProtocolHeaders(headers) {
  if (!Array.isArray(headers)) return lowerHeaders(headers);
  return Object.fromEntries(headers.map(header => [
    String(header?.name || "").toLowerCase(),
    typeof header?.value === "string" ? header.value : ""
  ]));
}

export function classifyRouteIqPrivateBrowserDocumentResponse({
  url,
  resourceType,
  status,
  headers,
  expectedWorkerVersion
} = {}) {
  let parsedUrl;
  try {
    parsedUrl = url instanceof URL ? url : new URL(url);
  } catch {
    return Object.freeze({ target: false, exact: false, reason: null });
  }
  if (resourceType !== "Document"
    || parsedUrl.origin !== CLOUDFLARE_UNATTENDED_SMOKE_ORIGIN
    || parsedUrl.pathname !== "/") {
    return Object.freeze({ target: false, exact: false, reason: null });
  }
  const normalizedHeaders = lowerProtocolHeaders(headers);
  const workerVersion =
    normalizedHeaders[CLOUDFLARE_UNATTENDED_SMOKE_VERSION.responseHeader.toLowerCase()]
      || null;
  const markerVerified =
    normalizedHeaders[CLOUDFLARE_UNATTENDED_SMOKE_MARKER.responseHeader.toLowerCase()]
      === CLOUDFLARE_UNATTENDED_SMOKE_MARKER.responseValue;
  const reason = !Number.isInteger(status) || status < 200 || status >= 300
    ? "STATUS"
    : workerVersion !== expectedWorkerVersion
      ? "VERSION"
      : !markerVerified
        ? "MARKER"
        : null;
  return Object.freeze({
    target: true,
    exact: reason === null,
    reason,
    status: Number.isInteger(status) ? status : null,
    workerVersion,
    markerVerified
  });
}

export function routeIqPrivateBrowserGuardScript() {
  return `(() => {
    globalThis.__routeIqPrivateAcceptance = {
      serviceWorkerAttempts: 0,
      serviceWorkerGuardInstalled: false,
      formAttempts: 0,
      popupAttempts: 0
    };
    if (navigator.serviceWorker) {
      try {
        Object.defineProperty(navigator.serviceWorker, "register", {
          configurable: true,
          value: async () => {
            globalThis.__routeIqPrivateAcceptance.serviceWorkerAttempts += 1;
            return Object.freeze({
              waiting: null,
              installing: null,
              active: null,
              scope: location.origin + "/",
              updateViaCache: "none",
              addEventListener() {},
              removeEventListener() {},
              unregister: async () => true,
              update: async () => undefined
            });
          }
        });
        globalThis.__routeIqPrivateAcceptance.serviceWorkerGuardInstalled = true;
      } catch {}
    }
    addEventListener("submit", event => {
      globalThis.__routeIqPrivateAcceptance.formAttempts += 1;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
    globalThis.open = (...args) => {
      globalThis.__routeIqPrivateAcceptance.popupAttempts += 1;
      return null;
    };
  })();`;
}

function consoleLogClassification(source) {
  const value = String(source || "").toUpperCase();
  const classification = `LOG_${value}`;
  return CONSOLE_ERROR_CLASSIFICATIONS.has(classification)
    ? classification
    : "LOG_OTHER";
}

function httpResourceClassification(type) {
  const value = String(type || "").toUpperCase();
  return HTTP_RESOURCE_CLASSIFICATIONS.has(value) ? value : "OTHER";
}

function httpStatusClassification(status) {
  if (status >= 400 && status < 500) return "4XX";
  if (status >= 500 && status < 600) return "5XX";
  return null;
}

export function classifyRouteIqPrivateBrowserHttpPath(url) {
  if (!(url instanceof URL)
    || url.origin !== CLOUDFLARE_UNATTENDED_SMOKE_ORIGIN) return "OTHER";
  const path = url.pathname;
  if (path === "/") return "ROOT";
  if (path === "/favicon.ico") return "FAVICON";
  if (path === "/sw.js") return "SERVICE_WORKER";
  if (path === "/manifest.webmanifest" || path === "/manifest.json") return "MANIFEST";
  if (path.startsWith("/icons/")) return "ICON";
  if (path.startsWith("/dashboard/")
    || path.startsWith("/administration/")
    || path.startsWith("/intelligence/")
    || path.startsWith("/scripts/")
    || path.startsWith("/assets/")
    || path.startsWith("/static/")) return "APP_ASSET";
  if (path === "/api" || path.startsWith("/api/")) return "API";
  return "OTHER";
}

export function isGuardedRouteIqServiceWorkerRequest(url) {
  return url instanceof URL
    && url.origin === CLOUDFLARE_UNATTENDED_SMOKE_ORIGIN
    && url.pathname === "/sw.js";
}

export function classifyRouteIqPrivateBrowserLogEntry(
  entry,
  { blockedNetworkIds = new Set() } = {}
) {
  if (entry?.level !== "error") return Object.freeze({ counted: false, classification: null });
  let url;
  try {
    url = new URL(entry.url);
  } catch {
    url = null;
  }
  const exactServiceWorker = entry.source === "network"
    && url?.origin === CLOUDFLARE_UNATTENDED_SMOKE_ORIGIN
    && url.pathname === "/sw.js";
  const correlatedBlock = typeof entry.networkRequestId === "string"
    && blockedNetworkIds.has(entry.networkRequestId);
  if (exactServiceWorker && correlatedBlock) {
    return Object.freeze({
      counted: false,
      classification: "GUARDED_SERVICE_WORKER_NETWORK_LOG"
    });
  }
  return Object.freeze({
    counted: true,
    classification: consoleLogClassification(entry.source)
  });
}

function exactGuardedBrowserManagedIconUrl(value) {
  let url;
  try {
    url = value instanceof URL ? value : new URL(value);
  } catch {
    return false;
  }
  return url.origin === CLOUDFLARE_UNATTENDED_SMOKE_ORIGIN
    && url.pathname === GUARDED_BROWSER_MANAGED_ICON_PATH
    && url.search === ""
    && url.hash === "";
}

export function isRouteIqPrivateBrowserManagedIconRequest(url, resourceType) {
  return resourceType === "Other" && exactGuardedBrowserManagedIconUrl(url);
}

export async function fetchRouteIqPrivateBrowserManagedIcon({
  fetchImpl,
  credentials,
  timeoutMilliseconds = BROWSER_MANAGED_ICON_TIMEOUT_MILLISECONDS,
  maximumBytes = MAX_BROWSER_MANAGED_ICON_BYTES
}) {
  if (typeof fetchImpl !== "function"
    || typeof credentials?.clientId !== "string"
    || credentials.clientId.length < 1
    || credentials.clientId.length > 4096
    || typeof credentials?.clientSecret !== "string"
    || credentials.clientSecret.length < 1
    || credentials.clientSecret.length > 4096
    || !Number.isInteger(timeoutMilliseconds)
    || timeoutMilliseconds < 1
    || timeoutMilliseconds > BROWSER_MANAGED_ICON_TIMEOUT_MILLISECONDS
    || !Number.isInteger(maximumBytes)
    || maximumBytes < 1
    || maximumBytes > MAX_BROWSER_MANAGED_ICON_BYTES) {
    fail("route_iq_private_browser_icon_bridge_input_invalid");
  }
  let response;
  try {
    const headers = new Headers();
    headers.set(["CF-Access", "Client-Id"].join("-"), credentials.clientId);
    headers.set(["CF-Access", "Client-Secret"].join("-"), credentials.clientSecret);
    headers.set(
      CLOUDFLARE_UNATTENDED_SMOKE_MARKER.requestHeader,
      CLOUDFLARE_UNATTENDED_SMOKE_MARKER.requestValue
    );
    response = await fetchImpl(GUARDED_BROWSER_MANAGED_ICON_URL, {
      method: "GET",
      headers,
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMilliseconds)
    });
  } catch {
    fail("route_iq_private_browser_icon_bridge_fetch_failed");
  }
  if (!Number.isInteger(response?.status)
    || response.status < 200
    || response.status >= 300
    || response.redirected === true) {
    fail("route_iq_private_browser_icon_bridge_status_invalid");
  }
  const contentType = String(response.headers?.get?.("content-type") || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (contentType !== "image/svg+xml") {
    fail("route_iq_private_browser_icon_bridge_content_type_invalid");
  }
  const contentLength = response.headers?.get?.("content-length");
  if (contentLength !== null && contentLength !== undefined) {
    if (!/^[0-9]+$/u.test(contentLength)
      || Number(contentLength) < 1
      || Number(contentLength) > maximumBytes) {
      fail("route_iq_private_browser_icon_bridge_content_length_invalid");
    }
  }
  let body;
  try {
    body = Buffer.from(await response.arrayBuffer());
  } catch {
    fail("route_iq_private_browser_icon_bridge_body_failed");
  }
  if (body.length < 1 || body.length > maximumBytes) {
    fail("route_iq_private_browser_icon_bridge_body_size_invalid");
  }
  return Object.freeze({
    responseCode: response.status,
    responseHeaders: Object.freeze([
      Object.freeze({ name: "Content-Type", value: "image/svg+xml" }),
      Object.freeze({ name: "Content-Length", value: String(body.length) }),
      Object.freeze({ name: "Cache-Control", value: "no-store" })
    ]),
    body: body.toString("base64")
  });
}

export function reconcileRouteIqPrivateBrowserNetworkEvents({
  httpFailures = [],
  errorLogEntries = [],
  blockedNetworkIds = new Set()
} = {}) {
  const consoleErrorClassifications = new Set();
  const networkHttpFailureClassifications = new Set();
  const guardedServiceWorkerLogRequestIds = new Set();
  let consoleErrors = 0;
  let networkHttpFailures = 0;
  for (const item of httpFailures) {
    let url;
    try {
      url = item?.url instanceof URL ? item.url : new URL(item?.url);
    } catch {
      continue;
    }
    const statusClass = httpStatusClassification(item?.status);
    if (!statusClass
      || url.origin !== CLOUDFLARE_UNATTENDED_SMOKE_ORIGIN
      || item?.resourceType === "Document") continue;
    networkHttpFailures += 1;
    networkHttpFailureClassifications.add(
      `HTTP_${httpResourceClassification(item.resourceType)}_${statusClass}_`
        + classifyRouteIqPrivateBrowserHttpPath(url)
    );
  }
  for (const entry of errorLogEntries) {
    const result = classifyRouteIqPrivateBrowserLogEntry(entry, {
      blockedNetworkIds
    });
    if (result.classification === "GUARDED_SERVICE_WORKER_NETWORK_LOG") {
      guardedServiceWorkerLogRequestIds.add(entry.networkRequestId);
    } else if (result.counted) {
      consoleErrors += 1;
      consoleErrorClassifications.add(result.classification);
    }
  }
  return Object.freeze({
    consoleErrors,
    consoleErrorClassifications: Object.freeze([...consoleErrorClassifications]),
    networkHttpFailures,
    networkHttpFailureClassifications:
      Object.freeze([...networkHttpFailureClassifications]),
    guardedServiceWorkerLogErrors: guardedServiceWorkerLogRequestIds.size
  });
}

async function waitForBrowserQuiescence({
  pendingInterceptions,
  lastObservedEventAt,
  quietMilliseconds = 500,
  timeoutMilliseconds = 5_000
}) {
  const deadline = Date.now() + timeoutMilliseconds;
  while (Date.now() < deadline) {
    if (pendingInterceptions.size === 0
      && Date.now() - lastObservedEventAt() >= quietMilliseconds) return;
    await wait(25);
  }
  fail("route_iq_private_browser_event_quiescence_timeout");
}

async function waitForReadyPage(client, sessionId) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const state = await evaluate(client, sessionId, `(() => ({
      ready: document.readyState === "complete",
      rendered: (document.body?.innerText || "").trim().length > 20,
      booting: document.body?.classList.contains("booting") === true
    }))()`);
    if (state?.ready && state.rendered && !state.booting) return;
    await wait(50);
  }
  fail("route_iq_private_browser_page_readiness_timeout");
}

async function waitForDocumentIdentityGate(evidence, viewport) {
  const deadline = Date.now() + 15_000;
  while (evidence.documentIdentityGateChecked !== true && Date.now() < deadline) {
    await wait(25);
  }
  if (evidence.documentIdentityGateExact === true) return;
  const reason = [
    "STATUS",
    "VERSION",
    "MARKER"
  ].includes(evidence.documentIdentityGateReason)
    ? evidence.documentIdentityGateReason
    : "TIMEOUT";
  throw new RouteIqPrivateBrowserAcceptanceError(
    [ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_FAILURE_DIMENSION.WORKER_IDENTITY],
    [`${viewport.name.toUpperCase()}_DOCUMENT_GATE_${reason}`]
  );
}

async function runRouteIqPrivateBrowserVersionProbe({
  debugPort,
  credentials,
  expectedWorkerVersion,
  fetchImpl = globalThis.fetch,
  timeoutMilliseconds =
    ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_STABILITY.probeTimeoutMilliseconds
}) {
  const webSocketUrl = await browserWebSocketUrl(debugPort, fetchImpl);
  const client = new CdpClient(webSocketUrl);
  await client.connect();
  let browserContextId;
  const evidence = {
    documentStatus: null,
    workerVersionExact: false,
    markerExact: false,
    nonReadRequests: 0,
    externalRequests: 0,
    interceptionFailures: 0
  };
  try {
    ({ browserContextId } = await client.send("Target.createBrowserContext", {
      disposeOnDetach: true
    }));
    const { targetId } = await client.send("Target.createTarget", {
      url: "about:blank",
      browserContextId
    });
    const { sessionId } = await client.send("Target.attachToTarget", {
      targetId,
      flatten: true
    });
    await Promise.all([
      client.send("Page.enable", {}, sessionId),
      client.send("Network.enable", {}, sessionId),
      client.send("Fetch.enable", {
        patterns: [{ urlPattern: "*", requestStage: "Request" }]
      }, sessionId),
      client.send("Network.setBypassServiceWorker", { bypass: true }, sessionId),
      client.send("Network.setCacheDisabled", { cacheDisabled: true }, sessionId),
      client.send("Emulation.setScriptExecutionDisabled", { value: true }, sessionId)
    ]);

    client.on("Network.responseReceived", params => {
      let responseUrl;
      try {
        responseUrl = new URL(params.response?.url);
      } catch {
        return;
      }
      if (params.type !== "Document"
        || responseUrl.origin !== CLOUDFLARE_UNATTENDED_SMOKE_ORIGIN
        || responseUrl.pathname !== "/") return;
      const headers = lowerHeaders(params.response.headers);
      evidence.documentStatus = params.response.status;
      evidence.workerVersionExact =
        headers[CLOUDFLARE_UNATTENDED_SMOKE_VERSION.responseHeader.toLowerCase()]
          === expectedWorkerVersion;
      evidence.markerExact =
        headers[CLOUDFLARE_UNATTENDED_SMOKE_MARKER.responseHeader.toLowerCase()]
          === CLOUDFLARE_UNATTENDED_SMOKE_MARKER.responseValue;
    }, { sessionId });
    client.on("Fetch.requestPaused", (params, eventSessionId) => {
      void (async () => {
        const method = String(params.request?.method || "").toUpperCase();
        let url;
        try {
          url = new URL(params.request.url);
        } catch {
          evidence.interceptionFailures += 1;
          await client.send("Fetch.failRequest", {
            requestId: params.requestId,
            errorReason: "BlockedByClient"
          }, eventSessionId);
          return;
        }
        if (!READ_METHODS.has(method)) {
          evidence.nonReadRequests += 1;
          await client.send("Fetch.failRequest", {
            requestId: params.requestId,
            errorReason: "BlockedByClient"
          }, eventSessionId);
          return;
        }
        if (url.origin === CLOUDFLARE_UNATTENDED_SMOKE_ORIGIN) {
          await client.send("Fetch.continueRequest", {
            requestId: params.requestId,
            headers: routeIqPrivateBrowserAuthenticatedRequestHeaders(
              params.request.headers,
              credentials
            )
          }, eventSessionId);
          return;
        }
        if (["about:", "blob:", "data:"].includes(url.protocol)) {
          await client.send("Fetch.continueRequest", {
            requestId: params.requestId
          }, eventSessionId);
          return;
        }
        evidence.externalRequests += 1;
        await client.send("Fetch.failRequest", {
          requestId: params.requestId,
          errorReason: "BlockedByClient"
        }, eventSessionId);
      })().catch(() => {
        evidence.interceptionFailures += 1;
      });
    }, { sessionId });

    await client.send("Page.navigate", {
      url: `${CLOUDFLARE_UNATTENDED_SMOKE_ORIGIN}/`
    }, sessionId);
    const deadline = Date.now() + timeoutMilliseconds;
    while (evidence.documentStatus === null && Date.now() < deadline) await wait(25);
    try {
      await client.send("Page.stopLoading", {}, sessionId);
    } catch {}
    return Object.freeze({
      exact: evidence.documentStatus >= 200
        && evidence.documentStatus < 300
        && evidence.workerVersionExact
        && evidence.markerExact
        && evidence.nonReadRequests === 0
        && evidence.externalRequests === 0
        && evidence.interceptionFailures === 0,
      nonReadRequests: evidence.nonReadRequests,
      externalRequests: evidence.externalRequests
    });
  } finally {
    if (browserContextId) {
      try {
        await client.send("Target.disposeBrowserContext", { browserContextId });
      } catch {}
    }
    client.close();
  }
}

export async function waitForRouteIqPrivateBrowserVersionStability({
  debugPort,
  credentials,
  expectedWorkerVersion,
  fetchImpl = globalThis.fetch,
  probeImpl = runRouteIqPrivateBrowserVersionProbe,
  sleepImpl = wait
} = {}) {
  if (!Number.isInteger(debugPort)
    || debugPort < 1
    || debugPort > 65535
    || typeof credentials?.clientId !== "string"
    || credentials.clientId.length < 1
    || credentials.clientId.length > 4096
    || typeof credentials?.clientSecret !== "string"
    || credentials.clientSecret.length < 1
    || credentials.clientSecret.length > 4096
    || !UUID.test(expectedWorkerVersion || "")
    || typeof fetchImpl !== "function"
    || typeof probeImpl !== "function"
    || typeof sleepImpl !== "function") {
    fail("route_iq_private_browser_stability_input_invalid");
  }
  let consecutiveExactProbes = 0;
  for (let attempt = 1;
    attempt <= ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_STABILITY.maximumAttempts;
    attempt += 1) {
    const evidence = await probeImpl({
      debugPort,
      credentials,
      expectedWorkerVersion,
      fetchImpl,
      timeoutMilliseconds:
        ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_STABILITY.probeTimeoutMilliseconds
    });
    if (!evidence
      || typeof evidence.exact !== "boolean"
      || !Number.isInteger(evidence.nonReadRequests)
      || evidence.nonReadRequests < 0
      || !Number.isInteger(evidence.externalRequests)
      || evidence.externalRequests < 0) {
      throw new RouteIqPrivateBrowserAcceptanceError(
        [ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_FAILURE_DIMENSION.BROWSER_VERSION_STABILITY],
        ["BROWSER_STABILITY_NOT_REACHED"]
      );
    }
    if (evidence.nonReadRequests > 0) {
      throw new RouteIqPrivateBrowserAcceptanceError(
        [ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_FAILURE_DIMENSION.WRITE_ATTEMPT],
        ["BROWSER_STABILITY_NON_READ_REQUEST"]
      );
    }
    if (evidence.externalRequests > 0) {
      throw new RouteIqPrivateBrowserAcceptanceError(
        [ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_FAILURE_DIMENSION.BROWSER_VERSION_STABILITY],
        ["BROWSER_STABILITY_EXTERNAL_REQUEST"]
      );
    }
    consecutiveExactProbes = evidence.exact ? consecutiveExactProbes + 1 : 0;
    if (consecutiveExactProbes
      >= ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_STABILITY.requiredConsecutiveExactProbes) {
      return Object.freeze({
        status: "ready",
        attemptCount: attempt,
        consecutiveExactProbes
      });
    }
    if (attempt < ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_STABILITY.maximumAttempts) {
      await sleepImpl(ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_STABILITY.delayMilliseconds);
    }
  }
  throw new RouteIqPrivateBrowserAcceptanceError(
    [ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_FAILURE_DIMENSION.BROWSER_VERSION_STABILITY],
    ["BROWSER_STABILITY_NOT_REACHED"]
  );
}

export async function collectRouteIqPrivateBrowserPageEvidence(
  browserGlobal = globalThis,
  registrationTimeoutMilliseconds = 5_000
) {
  const documentValue = browserGlobal.document;
  const text = documentValue?.body?.innerText || "";
  const preview = browserGlobal.prometheusDebugState?.paidCustomerConfigurationPreview;
  const workspaceId = documentValue?.body?.dataset?.workspaceId || "";
  const safeEmpty = workspaceId === "route_iq_unconfigured"
    || preview?.status === "unavailable"
    || text.includes("No paid-customer configuration selected");
  const configured = preview?.status === "ready"
    || (workspaceId && workspaceId !== "route_iq_unconfigured");
  const timeoutMilliseconds = Number.isInteger(registrationTimeoutMilliseconds)
    && registrationTimeoutMilliseconds > 0
    ? registrationTimeoutMilliseconds
    : 5_000;
  let timeoutHandle;
  let registrations = null;
  try {
    const serviceWorker = browserGlobal.navigator?.serviceWorker;
    if (typeof serviceWorker?.getRegistrations === "function") {
      const items = await Promise.race([
        Promise.resolve(serviceWorker.getRegistrations()),
        new Promise(resolve => {
          timeoutHandle = browserGlobal.setTimeout(() => resolve(null), timeoutMilliseconds);
        })
      ]);
      if (Array.isArray(items)) registrations = items.length;
    }
  } catch {
    registrations = null;
  } finally {
    if (timeoutHandle !== undefined) browserGlobal.clearTimeout(timeoutHandle);
  }
  return {
    rendered: /Route IQ|Prometheus/u.test(text) && text.trim().length > 20,
    configuredOrSafeEmpty: configured || safeEmpty,
    windowWidth: browserGlobal.innerWidth,
    windowHeight: browserGlobal.innerHeight,
    documentWidth: documentValue?.documentElement?.scrollWidth,
    bodyWidth: documentValue?.body?.scrollWidth || 0,
    registrations,
    guard: browserGlobal.__routeIqPrivateAcceptance || null
  };
}

export function routeIqControlledRehearsalBrowserRequestContract(
  expectedWorkerVersion
) {
  if (!UUID.test(expectedWorkerVersion || "")) {
    fail("route_iq_private_browser_rehearsal_identity_invalid");
  }
  return Object.freeze({
    exactUrl:
      `${CLOUDFLARE_UNATTENDED_SMOKE_ORIGIN}`
        + ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_PATH,
    expectedWorkerVersion,
    expectedContractVersion:
      ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_RUNTIME_VERSION,
    markerHeader:
      CLOUDFLARE_UNATTENDED_SMOKE_MARKER.responseHeader.toLowerCase(),
    markerValue: CLOUDFLARE_UNATTENDED_SMOKE_MARKER.responseValue,
    versionHeader:
      CLOUDFLARE_UNATTENDED_SMOKE_VERSION.responseHeader.toLowerCase(),
    maximumBytes: MAX_CONTROLLED_REHEARSAL_RESPONSE_BYTES
  });
}

export async function collectRouteIqControlledRehearsalBrowserEvidence(
  browserGlobal,
  contract
) {
  const failed = () => ({
    status: "FAIL",
    responseStatus: null,
    markerVerified: false,
    workerVersionExact: false,
    lifecycleVerified: false,
    topologyVerified: false,
    authorizationVerified: false,
    operatingHoursVerified: false,
    safetyVerified: false,
    cleanupVerified: false
  });
  const exactKeys = (value, expected) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const actual = Object.keys(value).sort();
    const required = [...expected].sort();
    return actual.length === required.length
      && actual.every((key, index) => key === required[index]);
  };
  try {
    if (typeof browserGlobal?.fetch !== "function"
      || typeof contract?.exactUrl !== "string"
      || typeof contract?.expectedWorkerVersion !== "string"
      || typeof contract?.expectedContractVersion !== "string"
      || typeof contract?.markerHeader !== "string"
      || typeof contract?.markerValue !== "string"
      || typeof contract?.versionHeader !== "string"
      || !Number.isInteger(contract?.maximumBytes)
      || contract.maximumBytes < 1) return failed();
    const response = await browserGlobal.fetch(contract.exactUrl, {
      method: "GET",
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer"
    });
    const responseStatus = Number.isInteger(response?.status)
      ? response.status
      : null;
    const markerVerified =
      response?.headers?.get?.(contract.markerHeader) === contract.markerValue;
    const workerVersionExact =
      response?.headers?.get?.(contract.versionHeader)
        === contract.expectedWorkerVersion;
    const contentType = String(response?.headers?.get?.("content-type") || "")
      .split(";", 1)[0]
      .trim()
      .toLowerCase();
    if (responseStatus !== 200
      || response?.redirected === true
      || response?.url !== contract.exactUrl
      || markerVerified !== true
      || workerVersionExact !== true
      || contentType !== "application/json") return failed();
    const declaredLength = response.headers.get("content-length");
    if (declaredLength !== null
      && (!/^[0-9]+$/u.test(declaredLength)
        || Number(declaredLength) < 1
        || Number(declaredLength) > contract.maximumBytes)) return failed();
    const text = await response.text();
    if (text.length < 1 || text.length > contract.maximumBytes) return failed();
    const body = JSON.parse(text);
    if (!exactKeys(body, ["contractVersion", "evidence", "ok", "status"])
      || body.ok !== true
      || body.status !== "PASS"
      || body.contractVersion !== contract.expectedContractVersion
      || !exactKeys(body.evidence, [
        "authorization",
        "cleanup",
        "lifecycle",
        "operatingHours",
        "safeEmptyState",
        "safety",
        "topology"
      ])) return failed();
    const {
      lifecycle,
      topology,
      authorization,
      operatingHours,
      safety,
      cleanup
    } = body.evidence;
    const lifecycleVerified = exactKeys(lifecycle, [
      "activated",
      "controlledValidation",
      "draft",
      "failureEvidence",
      "finalState",
      "recovery",
      "validationFailure"
    ])
      && lifecycle.draft === "CREATED"
      && lifecycle.controlledValidation === "FAILED_AS_EXPECTED"
      && lifecycle.validationFailure === "CONTROLLED_LOCATION_SCOPE_INVALID"
      && lifecycle.failureEvidence === "PRESERVED"
      && lifecycle.recovery === "DRAFT_RESTORED"
      && lifecycle.finalState === "VALIDATED"
      && lifecycle.activated === false;
    const topologyVerified = exactKeys(topology, [
      "companyWorkspaceBinding",
      "locationCount",
      "managerCount",
      "representativeCount"
    ])
      && topology.companyWorkspaceBinding === "EXACT"
      && topology.locationCount === 2
      && topology.managerCount === 1
      && topology.representativeCount === 2;
    const authorizationVerified = exactKeys(authorization, [
      "crossCompanyAccess",
      "crossUserAccess",
      "crossWorkspaceAccess",
      "managerWorkspaceRead",
      "representativeOwnRecordRead",
      "representativePrivilegedAccess",
      "representativeWorkspaceRead"
    ])
      && authorization.managerWorkspaceRead === "AUTHORIZED"
      && authorization.representativeOwnRecordRead === "AUTHORIZED"
      && authorization.representativeWorkspaceRead === "DENIED"
      && authorization.representativePrivilegedAccess === "DENIED"
      && authorization.crossUserAccess === "DENIED"
      && authorization.crossCompanyAccess === "DENIED"
      && authorization.crossWorkspaceAccess === "DENIED";
    const operatingHoursVerified = exactKeys(operatingHours, [
      "closedLocation",
      "openLocation",
      "recommendationInfluence",
      "representativeRouting"
    ])
      && operatingHours.openLocation === "ADMISSION_ELIGIBLE_VALIDATION_ONLY"
      && operatingHours.closedLocation === "BUSINESS_NOT_OPEN_NOW"
      && operatingHours.representativeRouting === "BLOCKED"
      && operatingHours.recommendationInfluence === "OFF";
    const safetyVerified = exactKeys(safety, [
      "activeCohorts",
      "billing",
      "collection",
      "customerActivation",
      "invitations",
      "liveStripe",
      "persistence",
      "productionBindingAccess",
      "providerRefresh",
      "recommendationInfluence",
      "scheduler"
    ])
      && body.evidence.safeEmptyState === "PRESERVED"
      && safety.billing === "BLOCKED"
      && safety.liveStripe === "DISABLED"
      && safety.customerActivation === "OFF"
      && safety.invitations === "NOT_SENT"
      && safety.providerRefresh === "OFF"
      && safety.scheduler === "OFF"
      && safety.collection === "OFF"
      && safety.activeCohorts === 0
      && safety.recommendationInfluence === "OFF"
      && safety.persistence === "NONE"
      && safety.productionBindingAccess === "NONE";
    const cleanupVerified = exactKeys(cleanup, ["remainingRecords", "status"])
      && cleanup.status === "REMOVED"
      && cleanup.remainingRecords === 0;
    const status = lifecycleVerified
      && topologyVerified
      && authorizationVerified
      && operatingHoursVerified
      && safetyVerified
      && cleanupVerified
      ? "PASS"
      : "FAIL";
    return {
      status,
      responseStatus,
      markerVerified,
      workerVersionExact,
      lifecycleVerified,
      topologyVerified,
      authorizationVerified,
      operatingHoursVerified,
      safetyVerified,
      cleanupVerified
    };
  } catch {
    return failed();
  }
}

export function isRouteIqControlledRehearsalBrowserEvidencePassing(value) {
  return value?.status === "PASS"
    && value.responseStatus === 200
    && value.markerVerified === true
    && value.workerVersionExact === true
    && value.lifecycleVerified === true
    && value.topologyVerified === true
    && value.authorizationVerified === true
    && value.operatingHoursVerified === true
    && value.safetyVerified === true
    && value.cleanupVerified === true
    && Object.keys(value).length === 10;
}

async function runViewportScenario({
  debugPort,
  credentials,
  expectedWorkerVersion,
  viewport,
  fetchImpl = globalThis.fetch
}) {
  const webSocketUrl = await browserWebSocketUrl(debugPort, fetchImpl);
  const client = new CdpClient(webSocketUrl);
  await client.connect();
  let browserContextId;
  const pendingInterceptions = new Set();
  const blockedNetworkIds = new Set();
  const consoleErrorClassifications = new Set();
  const networkHttpFailureClassifications = new Set();
  const pendingHttpFailures = [];
  const pendingErrorLogEntries = [];
  let lastObservedEvent = Date.now();
  const observe = () => {
    lastObservedEvent = Date.now();
  };
  const evidence = {
    viewport: viewport.name,
    width: viewport.width,
    height: viewport.height,
    documentStatus: null,
    workerVersion: null,
    markerVerified: false,
    rendered: false,
    configuredOrSafeEmpty: false,
    horizontalOverflow: null,
    consoleErrors: 0,
    consoleWarnings: 0,
    runtimeExceptions: 0,
    networkFailures: 0,
    networkHttpFailures: 0,
    attemptedWrites: 0,
    blockedWrites: 0,
    serviceWorkerRequests: 0,
    blockedServiceWorkerRequests: 0,
    guardedServiceWorkerLogErrors: 0,
    browserManagedIconBridgeAttempts: 0,
    browserManagedIconBridgeSuccesses: 0,
    serviceWorkerRegistrations: null,
    externalRequests: 0,
    publicIsolationVerified: true,
    controlledRehearsal: null,
    documentIdentityGateChecked: false,
    documentIdentityGateExact: false,
    documentIdentityGateReason: null
  };
  try {
    ({ browserContextId } = await client.send("Target.createBrowserContext", {
      disposeOnDetach: true
    }));
    const { targetId } = await client.send("Target.createTarget", {
      url: "about:blank",
      browserContextId
    });
    const { sessionId } = await client.send("Target.attachToTarget", {
      targetId,
      flatten: true
    });
    await Promise.all([
      client.send("Page.enable", {}, sessionId),
      client.send("Runtime.enable", {}, sessionId),
      client.send("Network.enable", {}, sessionId),
      client.send("Log.enable", {}, sessionId),
      client.send("Fetch.enable", {
        patterns: [
          { urlPattern: "*", requestStage: "Request" },
          {
            urlPattern: `${CLOUDFLARE_UNATTENDED_SMOKE_ORIGIN}/`,
            resourceType: "Document",
            requestStage: "Response"
          }
        ]
      }, sessionId),
      client.send("Network.setBypassServiceWorker", { bypass: true }, sessionId),
      client.send("Network.setCacheDisabled", { cacheDisabled: true }, sessionId),
      client.send("Browser.setDownloadBehavior", {
        behavior: "deny",
        browserContextId
      })
    ]);
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: 1,
      mobile: viewport.mobile,
      screenWidth: viewport.width,
      screenHeight: viewport.height
    }, sessionId);
    await client.send("Page.addScriptToEvaluateOnNewDocument", {
      source: routeIqPrivateBrowserGuardScript()
    }, sessionId);

    client.on("Runtime.exceptionThrown", () => {
      observe();
      evidence.runtimeExceptions += 1;
    }, { sessionId });
    client.on("Runtime.consoleAPICalled", params => {
      observe();
      if (params.type === "error") {
        evidence.consoleErrors += 1;
        consoleErrorClassifications.add("CONSOLE_API");
      }
      if (params.type === "warning") evidence.consoleWarnings += 1;
    }, { sessionId });
    client.on("Log.entryAdded", params => {
      observe();
      if (params.entry?.level === "error") pendingErrorLogEntries.push(params.entry);
      if (params.entry?.level === "warning") evidence.consoleWarnings += 1;
    }, { sessionId });
    client.on("Network.loadingFailed", params => {
      observe();
      if (!blockedNetworkIds.has(params.requestId)) evidence.networkFailures += 1;
    }, { sessionId });
    client.on("Network.responseReceived", params => {
      observe();
      let responseUrl;
      try {
        responseUrl = new URL(params.response?.url);
      } catch {
        return;
      }
      if (responseUrl.origin === CLOUDFLARE_UNATTENDED_SMOKE_ORIGIN
        && params.type !== "Document") {
        const statusClass = httpStatusClassification(params.response?.status);
        if (statusClass) {
          pendingHttpFailures.push({
            requestId: params.requestId,
            resourceType: params.type,
            status: params.response?.status,
            url: responseUrl
          });
        }
      }
      if (params.type !== "Document"
        || responseUrl.origin !== CLOUDFLARE_UNATTENDED_SMOKE_ORIGIN
        || responseUrl.pathname !== "/") return;
      const headers = lowerHeaders(params.response.headers);
      evidence.documentStatus = params.response.status;
      evidence.workerVersion =
        headers[CLOUDFLARE_UNATTENDED_SMOKE_VERSION.responseHeader.toLowerCase()] || null;
      evidence.markerVerified =
        headers[CLOUDFLARE_UNATTENDED_SMOKE_MARKER.responseHeader.toLowerCase()]
          === CLOUDFLARE_UNATTENDED_SMOKE_MARKER.responseValue;
    }, { sessionId });
    client.on("Fetch.requestPaused", (params, eventSessionId) => {
      observe();
      const task = (async () => {
        if (Number.isInteger(params.responseStatusCode)) {
          const gate = classifyRouteIqPrivateBrowserDocumentResponse({
            url: params.request?.url,
            resourceType: params.resourceType,
            status: params.responseStatusCode,
            headers: params.responseHeaders,
            expectedWorkerVersion
          });
          if (!gate.target) {
            await client.send("Fetch.continueResponse", {
              requestId: params.requestId
            }, eventSessionId);
            return;
          }
          evidence.documentIdentityGateChecked = true;
          evidence.documentIdentityGateExact = gate.exact;
          evidence.documentIdentityGateReason = gate.reason;
          evidence.documentStatus = gate.status;
          evidence.workerVersion = gate.workerVersion;
          evidence.markerVerified = gate.markerVerified;
          if (!gate.exact) {
            if (params.networkId) blockedNetworkIds.add(params.networkId);
            await client.send("Fetch.failRequest", {
              requestId: params.requestId,
              errorReason: "BlockedByClient"
            }, eventSessionId);
            return;
          }
          await client.send("Fetch.continueResponse", {
            requestId: params.requestId
          }, eventSessionId);
          return;
        }
        const method = String(params.request?.method || "").toUpperCase();
        let url;
        try {
          url = new URL(params.request.url);
        } catch {
          await client.send("Fetch.failRequest", {
            requestId: params.requestId,
            errorReason: "BlockedByClient"
          }, eventSessionId);
          return;
        }
        if (!READ_METHODS.has(method)) {
          evidence.attemptedWrites += 1;
          evidence.blockedWrites += 1;
          if (params.networkId) blockedNetworkIds.add(params.networkId);
          await client.send("Fetch.failRequest", {
            requestId: params.requestId,
            errorReason: "BlockedByClient"
          }, eventSessionId);
          return;
        }
        if (params.resourceType === "ServiceWorker"
          || isGuardedRouteIqServiceWorkerRequest(url)) {
          evidence.serviceWorkerRequests += 1;
          evidence.blockedServiceWorkerRequests += 1;
          if (params.networkId) blockedNetworkIds.add(params.networkId);
          await client.send("Fetch.failRequest", {
            requestId: params.requestId,
            errorReason: "BlockedByClient"
          }, eventSessionId);
          return;
        }
        if (isRouteIqPrivateBrowserManagedIconRequest(url, params.resourceType)) {
          evidence.browserManagedIconBridgeAttempts += 1;
          if (evidence.browserManagedIconBridgeAttempts
            > MAX_BROWSER_MANAGED_ICON_BRIDGE_ATTEMPTS_PER_VIEWPORT) {
            evidence.networkFailures += 1;
            if (params.networkId) blockedNetworkIds.add(params.networkId);
            await client.send("Fetch.failRequest", {
              requestId: params.requestId,
              errorReason: "BlockedByClient"
            }, eventSessionId);
            return;
          }
          try {
            const icon = await fetchRouteIqPrivateBrowserManagedIcon({
              fetchImpl,
              credentials
            });
            await client.send("Fetch.fulfillRequest", {
              requestId: params.requestId,
              responseCode: icon.responseCode,
              responseHeaders: icon.responseHeaders,
              body: icon.body
            }, eventSessionId);
            evidence.browserManagedIconBridgeSuccesses += 1;
          } catch {
            evidence.networkFailures += 1;
            if (params.networkId) blockedNetworkIds.add(params.networkId);
            try {
              await client.send("Fetch.failRequest", {
                requestId: params.requestId,
                errorReason: "BlockedByClient"
              }, eventSessionId);
            } catch {}
          }
          return;
        }
        if (url.origin === CLOUDFLARE_UNATTENDED_SMOKE_ORIGIN) {
          await client.send("Fetch.continueRequest", {
            requestId: params.requestId,
            headers: routeIqPrivateBrowserAuthenticatedRequestHeaders(
              params.request.headers,
              credentials
            )
          }, eventSessionId);
          return;
        }
        if (["about:", "blob:", "data:"].includes(url.protocol)) {
          await client.send("Fetch.continueRequest", {
            requestId: params.requestId
          }, eventSessionId);
          return;
        }
        evidence.externalRequests += 1;
        if (params.networkId) blockedNetworkIds.add(params.networkId);
        await client.send("Fetch.failRequest", {
          requestId: params.requestId,
          errorReason: "BlockedByClient"
        }, eventSessionId);
      })().catch(() => {
        evidence.networkFailures += 1;
      }).finally(() => {
        pendingInterceptions.delete(task);
      });
      pendingInterceptions.add(task);
    }, { sessionId });

    await client.send("Page.navigate", {
      url: `${CLOUDFLARE_UNATTENDED_SMOKE_ORIGIN}/`
    }, sessionId);
    await waitForDocumentIdentityGate(evidence, viewport);
    await waitForReadyPage(client, sessionId);
    evidence.controlledRehearsal = await evaluate(
      client,
      sessionId,
      `(${collectRouteIqControlledRehearsalBrowserEvidence.toString()})(`
        + "globalThis,"
        + `${JSON.stringify(
          routeIqControlledRehearsalBrowserRequestContract(expectedWorkerVersion)
        )})`
    );
    await waitForBrowserQuiescence({
      pendingInterceptions,
      lastObservedEventAt: () => lastObservedEvent
    });
    const networkEvidence = reconcileRouteIqPrivateBrowserNetworkEvents({
      httpFailures: pendingHttpFailures,
      errorLogEntries: pendingErrorLogEntries,
      blockedNetworkIds
    });
    evidence.consoleErrors += networkEvidence.consoleErrors;
    for (const classification of networkEvidence.consoleErrorClassifications) {
      consoleErrorClassifications.add(classification);
    }
    evidence.networkHttpFailures += networkEvidence.networkHttpFailures;
    for (const classification of networkEvidence.networkHttpFailureClassifications) {
      networkHttpFailureClassifications.add(classification);
    }
    evidence.guardedServiceWorkerLogErrors =
      networkEvidence.guardedServiceWorkerLogErrors;
    const page = await evaluate(
      client,
      sessionId,
      `(${collectRouteIqPrivateBrowserPageEvidence.toString()})()`
    );
    evidence.rendered = page.rendered === true;
    evidence.configuredOrSafeEmpty = page.configuredOrSafeEmpty === true;
    evidence.horizontalOverflow = page.documentWidth > viewport.width + 1
      || page.bodyWidth > viewport.width + 1;
    evidence.serviceWorkerRegistrations = page.registrations;
    evidence.serviceWorkerGuardInstalled =
      page.guard?.serviceWorkerGuardInstalled === true;
    evidence.viewportExact = page.windowWidth === viewport.width
      && page.windowHeight === viewport.height;
    evidence.formAttempts = page.guard?.formAttempts ?? 0;
    evidence.popupAttempts = page.guard?.popupAttempts ?? 0;
    evidence.serviceWorkerRegistrationAttempts = page.guard?.serviceWorkerAttempts ?? 0;
    evidence.consoleErrorClassifications = Object.freeze([...consoleErrorClassifications]);
    evidence.networkHttpFailureClassifications =
      Object.freeze([...networkHttpFailureClassifications]);
    return Object.freeze(evidence);
  } finally {
    if (browserContextId) {
      try {
        await client.send("Target.disposeBrowserContext", { browserContextId });
      } catch {}
    }
    client.close();
  }
}

export function evaluateRouteIqPrivateBrowserAcceptance({
  expectedWorkerVersion,
  publicIsolationVerified,
  scenarios
}) {
  const failures = [];
  const failureDimensions = new Set();
  const failureDiagnostics = new Set();
  const recordFailure = (failure, dimension) => {
    failures.push(failure);
    failureDimensions.add(dimension);
  };
  if (!UUID.test(expectedWorkerVersion || "") || publicIsolationVerified !== true) {
    recordFailure(
      "identity",
      ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_FAILURE_DIMENSION.IDENTITY
    );
  }
  if (!Array.isArray(scenarios)
    || scenarios.length !== ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_VIEWPORTS.length) {
    recordFailure(
      "viewport_count",
      ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_FAILURE_DIMENSION.VIEWPORT
    );
  } else {
    for (const expected of ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_VIEWPORTS) {
      const scenario = scenarios.find(item => item.viewport === expected.name);
      if (!scenario
        || scenario.width !== expected.width
        || scenario.height !== expected.height
        || scenario.viewportExact !== true) {
        recordFailure(
          `${expected.name}_viewport`,
          ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_FAILURE_DIMENSION.VIEWPORT
        );
      }
      if (scenario?.documentStatus < 200 || scenario?.documentStatus >= 300) {
        recordFailure(
          `${expected.name}_status`,
          ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_FAILURE_DIMENSION.DOCUMENT_STATUS
        );
      }
      if (scenario?.workerVersion !== expectedWorkerVersion || scenario?.markerVerified !== true) {
        recordFailure(
          `${expected.name}_worker_identity`,
          ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_FAILURE_DIMENSION.WORKER_IDENTITY
        );
      }
      if (scenario?.rendered !== true
        || scenario?.configuredOrSafeEmpty !== true
        || scenario?.horizontalOverflow !== false) {
        recordFailure(
          `${expected.name}_render`,
          ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_FAILURE_DIMENSION.RENDER
        );
      }
      if (!isRouteIqControlledRehearsalBrowserEvidencePassing(
        scenario?.controlledRehearsal
      )) {
        recordFailure(
          `${expected.name}_controlled_rehearsal`,
          ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_FAILURE_DIMENSION.CONTROLLED_REHEARSAL
        );
      }
      for (const healthFailure of HEALTH_FAILURES_BY_VIEWPORT[expected.name]) {
        if (scenario?.[healthFailure.counter] !== 0) {
          recordFailure(healthFailure.failure, healthFailure.dimension);
        }
      }
      const diagnosticPrefix = expected.name.toUpperCase();
      for (const classification of scenario?.consoleErrorClassifications || []) {
        const diagnostic = `${diagnosticPrefix}_${classification}`;
        if (FAILURE_DIAGNOSTICS.has(diagnostic)) failureDiagnostics.add(diagnostic);
      }
      for (const classification of scenario?.networkHttpFailureClassifications || []) {
        const diagnostic = `${diagnosticPrefix}_${classification}`;
        if (FAILURE_DIAGNOSTICS.has(diagnostic)) failureDiagnostics.add(diagnostic);
      }
      if (scenario?.attemptedWrites !== 0
        || scenario?.blockedWrites !== 0
        || scenario?.formAttempts !== 0
        || scenario?.popupAttempts !== 0) {
        recordFailure(
          `${expected.name}_write_attempt`,
          ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_FAILURE_DIMENSION.WRITE_ATTEMPT
        );
      }
      const registrationCount = scenario?.serviceWorkerRegistrations;
      if (!Number.isFinite(registrationCount)
        || !Number.isInteger(registrationCount)
        || registrationCount < 0) {
        recordFailure(
          `${expected.name}_service_worker_registration_count_invalid`,
          ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_FAILURE_DIMENSION
            .SERVICE_WORKER_REGISTRATION_COUNT_INVALID
        );
      } else if (registrationCount !== 0) {
        recordFailure(
          `${expected.name}_service_worker_registration_count_nonzero`,
          ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_FAILURE_DIMENSION
            .SERVICE_WORKER_REGISTRATION_COUNT_NONZERO
        );
      }
      if (!Number.isFinite(scenario?.serviceWorkerRequests)
        || !Number.isInteger(scenario.serviceWorkerRequests)
        || scenario.serviceWorkerRequests < 0
        || !Number.isFinite(scenario?.blockedServiceWorkerRequests)
        || !Number.isInteger(scenario.blockedServiceWorkerRequests)
        || scenario.blockedServiceWorkerRequests < 0
        || scenario.blockedServiceWorkerRequests !== scenario.serviceWorkerRequests) {
        recordFailure(
          `${expected.name}_service_worker_request_guard`,
          ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_FAILURE_DIMENSION.SERVICE_WORKER_REQUEST_GUARD
        );
      }
      if (!Number.isFinite(scenario?.guardedServiceWorkerLogErrors)
        || !Number.isInteger(scenario.guardedServiceWorkerLogErrors)
        || scenario.guardedServiceWorkerLogErrors < 0
        || scenario.guardedServiceWorkerLogErrors > scenario.blockedServiceWorkerRequests) {
        recordFailure(
          `${expected.name}_service_worker_log_guard`,
          ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_FAILURE_DIMENSION.SERVICE_WORKER_REQUEST_GUARD
        );
      }
      if (!Number.isFinite(scenario?.browserManagedIconBridgeAttempts)
        || !Number.isInteger(scenario.browserManagedIconBridgeAttempts)
        || scenario.browserManagedIconBridgeAttempts < 0
        || scenario.browserManagedIconBridgeAttempts
          > MAX_BROWSER_MANAGED_ICON_BRIDGE_ATTEMPTS_PER_VIEWPORT
        || !Number.isFinite(scenario?.browserManagedIconBridgeSuccesses)
        || !Number.isInteger(scenario.browserManagedIconBridgeSuccesses)
        || scenario.browserManagedIconBridgeSuccesses < 0
        || scenario.browserManagedIconBridgeSuccesses
          > MAX_BROWSER_MANAGED_ICON_BRIDGE_ATTEMPTS_PER_VIEWPORT
        || scenario.browserManagedIconBridgeAttempts
          !== scenario.browserManagedIconBridgeSuccesses) {
        recordFailure(
          `${expected.name}_browser_managed_icon_bridge`,
          ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_FAILURE_DIMENSION
            .BROWSER_MANAGED_ICON_BRIDGE
        );
      }
    }
  }
  return Object.freeze({
    status: failures.length === 0 ? "PASS" : "FAIL",
    failures: Object.freeze(failures),
    failureDimensions: Object.freeze([...failureDimensions]),
    failureDiagnostics: Object.freeze([...failureDiagnostics])
  });
}

export async function runRouteIqPrivateProductionBrowserAcceptance({
  credentials,
  expectedWorkerVersion,
  publicIsolationVerified,
  launchBrowser = launchIsolatedChrome,
  stabilizeBrowser = waitForRouteIqPrivateBrowserVersionStability,
  runScenario = runViewportScenario,
  fetchImpl = globalThis.fetch
}) {
  if (typeof credentials?.clientId !== "string"
    || credentials.clientId.length < 1
    || credentials.clientId.length > 4096
    || typeof credentials?.clientSecret !== "string"
    || credentials.clientSecret.length < 1
    || credentials.clientSecret.length > 4096
    || !UUID.test(expectedWorkerVersion || "")
    || publicIsolationVerified !== true
    || typeof stabilizeBrowser !== "function") {
    fail("route_iq_private_browser_input_invalid");
  }
  const browser = await launchBrowser();
  try {
    await stabilizeBrowser({
      debugPort: browser.debugPort,
      credentials,
      expectedWorkerVersion,
      fetchImpl
    });
    const scenarios = [];
    for (const viewport of ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_VIEWPORTS) {
      scenarios.push(await runScenario({
        debugPort: browser.debugPort,
        credentials,
        expectedWorkerVersion,
        viewport,
        fetchImpl
      }));
    }
    const evaluation = evaluateRouteIqPrivateBrowserAcceptance({
      expectedWorkerVersion,
      publicIsolationVerified,
      scenarios
    });
    if (evaluation.status !== "PASS") {
      throw new RouteIqPrivateBrowserAcceptanceError(
        evaluation.failureDimensions,
        evaluation.failureDiagnostics
      );
    }
    return Object.freeze({
      contractVersion: ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_VERSION,
      status: "PASS",
      viewportCount: scenarios.length,
      controlledRehearsalViewportCount: scenarios.filter(scenario =>
        isRouteIqControlledRehearsalBrowserEvidencePassing(
          scenario.controlledRehearsal
        )).length,
      publicIsolationVerified: true
    });
  } finally {
    await browser.close();
  }
}
