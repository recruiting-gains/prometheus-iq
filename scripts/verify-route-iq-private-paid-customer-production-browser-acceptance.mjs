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

export const ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_VERSION =
  "route-iq-private-paid-customer-browser-acceptance-v1";
export const ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_VIEWPORTS = Object.freeze([
  Object.freeze({ name: "desktop", width: 1440, height: 900, mobile: false }),
  Object.freeze({ name: "mobile", width: 390, height: 844, mobile: true })
]);

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
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

function headersWithCredentials(headers, credentials, { marker = false } = {}) {
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
    { name: "CF-Access-Client-Secret", value: credentials.clientSecret }
  );
  if (marker) {
    sanitized.push({
      name: CLOUDFLARE_UNATTENDED_SMOKE_MARKER.requestHeader,
      value: CLOUDFLARE_UNATTENDED_SMOKE_MARKER.requestValue
    });
  }
  return sanitized;
}

function lowerHeaders(headers) {
  return Object.fromEntries(
    Object.entries(headers || {}).map(([name, value]) => [name.toLowerCase(), String(value)])
  );
}

function guardScript() {
  return `(() => {
    globalThis.__routeIqPrivateAcceptance = {
      serviceWorkerAttempts: 0,
      formAttempts: 0,
      popupAttempts: 0
    };
    if (navigator.serviceWorker) {
      try {
        Object.defineProperty(navigator.serviceWorker, "register", {
          configurable: true,
          value: async () => {
            globalThis.__routeIqPrivateAcceptance.serviceWorkerAttempts += 1;
            return Object.freeze({ unregister: async () => true });
          }
        });
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
    attemptedWrites: 0,
    blockedWrites: 0,
    serviceWorkerRequests: 0,
    blockedServiceWorkerRequests: 0,
    serviceWorkerRegistrations: null,
    externalRequests: 0,
    publicIsolationVerified: true
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
        patterns: [{ urlPattern: "*", requestStage: "Request" }]
      }, sessionId),
      client.send("Network.setBypassServiceWorker", { bypass: true }, sessionId),
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
      source: guardScript()
    }, sessionId);

    client.on("Runtime.exceptionThrown", () => {
      evidence.runtimeExceptions += 1;
    }, { sessionId });
    client.on("Runtime.consoleAPICalled", params => {
      if (params.type === "error") evidence.consoleErrors += 1;
      if (params.type === "warning") evidence.consoleWarnings += 1;
    }, { sessionId });
    client.on("Log.entryAdded", params => {
      if (params.entry?.level === "error") evidence.consoleErrors += 1;
      if (params.entry?.level === "warning") evidence.consoleWarnings += 1;
    }, { sessionId });
    client.on("Network.loadingFailed", params => {
      if (!blockedNetworkIds.has(params.requestId)) evidence.networkFailures += 1;
    }, { sessionId });
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
      evidence.workerVersion =
        headers[CLOUDFLARE_UNATTENDED_SMOKE_VERSION.responseHeader.toLowerCase()] || null;
      evidence.markerVerified =
        headers[CLOUDFLARE_UNATTENDED_SMOKE_MARKER.responseHeader.toLowerCase()]
          === CLOUDFLARE_UNATTENDED_SMOKE_MARKER.responseValue;
    }, { sessionId });
    client.on("Fetch.requestPaused", (params, eventSessionId) => {
      const task = (async () => {
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
        if (params.resourceType === "ServiceWorker") {
          evidence.serviceWorkerRequests += 1;
          evidence.blockedServiceWorkerRequests += 1;
          if (params.networkId) blockedNetworkIds.add(params.networkId);
          await client.send("Fetch.failRequest", {
            requestId: params.requestId,
            errorReason: "BlockedByClient"
          }, eventSessionId);
          return;
        }
        if (url.origin === CLOUDFLARE_UNATTENDED_SMOKE_ORIGIN) {
          const marker = params.resourceType === "Document" && url.pathname === "/";
          await client.send("Fetch.continueRequest", {
            requestId: params.requestId,
            headers: headersWithCredentials(params.request.headers, credentials, { marker })
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
    await waitForReadyPage(client, sessionId);
    await wait(250);
    if (pendingInterceptions.size > 0) {
      await Promise.allSettled([...pendingInterceptions]);
    }
    const page = await evaluate(client, sessionId, `(() => {
      const text = document.body?.innerText || "";
      const preview = globalThis.prometheusDebugState?.paidCustomerConfigurationPreview;
      const workspaceId = document.body?.dataset?.workspaceId || "";
      const safeEmpty = workspaceId === "route_iq_unconfigured"
        || preview?.status === "unavailable"
        || text.includes("No paid-customer configuration selected");
      const configured = preview?.status === "ready"
        || (workspaceId && workspaceId !== "route_iq_unconfigured");
      return {
        rendered: /Route IQ|Prometheus/u.test(text) && text.trim().length > 20,
        configuredOrSafeEmpty: configured || safeEmpty,
        windowWidth: innerWidth,
        windowHeight: innerHeight,
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body?.scrollWidth || 0,
        registrations: navigator.serviceWorker?.getRegistrations
          ? navigator.serviceWorker.getRegistrations().then(items => items.length).catch(() => 0)
          : Promise.resolve(0),
        guard: globalThis.__routeIqPrivateAcceptance || null
      };
    })()`);
    evidence.rendered = page.rendered === true;
    evidence.configuredOrSafeEmpty = page.configuredOrSafeEmpty === true;
    evidence.horizontalOverflow = page.documentWidth > viewport.width + 1
      || page.bodyWidth > viewport.width + 1;
    evidence.serviceWorkerRegistrations = page.registrations;
    evidence.viewportExact = page.windowWidth === viewport.width
      && page.windowHeight === viewport.height;
    evidence.formAttempts = page.guard?.formAttempts ?? 0;
    evidence.popupAttempts = page.guard?.popupAttempts ?? 0;
    evidence.serviceWorkerRegistrationAttempts = page.guard?.serviceWorkerAttempts ?? 0;
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
  if (!UUID.test(expectedWorkerVersion || "") || publicIsolationVerified !== true) {
    failures.push("identity");
  }
  if (!Array.isArray(scenarios)
    || scenarios.length !== ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_VIEWPORTS.length) {
    failures.push("viewport_count");
  } else {
    for (const expected of ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_VIEWPORTS) {
      const scenario = scenarios.find(item => item.viewport === expected.name);
      if (!scenario
        || scenario.width !== expected.width
        || scenario.height !== expected.height
        || scenario.viewportExact !== true) failures.push(`${expected.name}_viewport`);
      if (scenario?.documentStatus < 200 || scenario?.documentStatus >= 300) {
        failures.push(`${expected.name}_status`);
      }
      if (scenario?.workerVersion !== expectedWorkerVersion
        || scenario?.markerVerified !== true) failures.push(`${expected.name}_worker_identity`);
      if (scenario?.rendered !== true
        || scenario?.configuredOrSafeEmpty !== true
        || scenario?.horizontalOverflow !== false) failures.push(`${expected.name}_render`);
      if (scenario?.consoleErrors !== 0
        || scenario?.runtimeExceptions !== 0
        || scenario?.networkFailures !== 0
        || scenario?.externalRequests !== 0) failures.push(`${expected.name}_health`);
      if (scenario?.attemptedWrites !== 0
        || scenario?.blockedWrites !== 0
        || scenario?.formAttempts !== 0
        || scenario?.popupAttempts !== 0) failures.push(`${expected.name}_write_attempt`);
      if (scenario?.serviceWorkerRegistrations !== 0
        || scenario?.blockedServiceWorkerRequests !== scenario?.serviceWorkerRequests) {
        failures.push(`${expected.name}_service_worker`);
      }
    }
  }
  return Object.freeze({
    status: failures.length === 0 ? "PASS" : "FAIL",
    failures: Object.freeze(failures)
  });
}

export async function runRouteIqPrivateProductionBrowserAcceptance({
  credentials,
  expectedWorkerVersion,
  publicIsolationVerified,
  launchBrowser = launchIsolatedChrome,
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
    || publicIsolationVerified !== true) {
    fail("route_iq_private_browser_input_invalid");
  }
  const browser = await launchBrowser();
  try {
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
    if (evaluation.status !== "PASS") fail("route_iq_private_browser_acceptance_failed");
    return Object.freeze({
      contractVersion: ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_VERSION,
      status: "PASS",
      viewportCount: scenarios.length,
      publicIsolationVerified: true
    });
  } finally {
    await browser.close();
  }
}
