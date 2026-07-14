import { spawn, spawnSync } from "node:child_process";
import { createServer as createSecureServer } from "node:https";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const root = resolve(import.meta.dirname, "..");
const dashboardRoot = resolve(root, "deploy/cloudflare-pages");
const chromePath = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const activePoolPath = "data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/active-pool.json";
const fullPoolPath = "data/qualified-prospects/google-qualified-businesses-v2/runtime-pools.json";
const fieldSessionHandoffPath = "api/dashboard/route-iq/field-session";
const prospectiveEventPath = "api/dashboard/route-iq/prospective/event";

const results = [];
const errors = [];
let localCertificate;

function pass(name, detail) {
  results.push({ status: "PASS", name, detail });
  console.log(`PASS ${name}: ${detail}`);
}

function fail(name, detail) {
  results.push({ status: "FAIL", name, detail });
  console.error(`FAIL ${name}: ${detail}`);
}

function assertWorkflow(name, condition, detail, failureDetail = detail) {
  if (condition) pass(name, detail);
  else fail(name, failureDetail);
}

function contentType(pathname) {
  const ext = extname(pathname).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".js" || ext === ".mjs") return "text/javascript; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".png") return "image/png";
  if (ext === ".ico") return "image/x-icon";
  return "application/octet-stream";
}

function localHttpsCertificate() {
  if (localCertificate) return localCertificate;
  const certDir = mkdtempSync(join(tmpdir(), "prometheus-dashboard-cert-"));
  const keyPath = join(certDir, "key.pem");
  const certPath = join(certDir, "cert.pem");
  const result = spawnSync("openssl", [
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-sha256",
    "-days",
    "1",
    "-nodes",
    "-subj",
    "/CN=127.0.0.1",
    "-keyout",
    keyPath,
    "-out",
    certPath
  ], { stdio: "ignore" });
  if (result.status !== 0) throw new Error("Unable to create local HTTPS certificate with openssl.");
  localCertificate = {
    key: readFileSync(keyPath),
    cert: readFileSync(certPath),
    certDir
  };
  return localCertificate;
}

function startStaticServer({
  missingActive = false,
  fieldSessionResponses = [],
  prospectiveResponse = { status: 204 }
} = {}) {
  const requests = [];
  const fieldSessionRequests = [];
  const prospectiveRequests = [];
  let fieldSessionAttempt = 0;
  const certificate = localHttpsCertificate();
  const server = createSecureServer({ key: certificate.key, cert: certificate.cert }, (request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    const pathname = decodeURIComponent(
      url.pathname === "/"
        ? "/index.html"
        : url.pathname.endsWith("/")
        ? `${url.pathname}index.html`
        : url.pathname
    );
    const relativePath = pathname.replace(/^\/+/, "");
    requests.push({ path: relativePath, method: request.method });

    if (relativePath === prospectiveEventPath) {
      const chunks = [];
      let size = 0;
      request.on("data", chunk => {
        size += chunk.length;
        if (size <= 4096) chunks.push(chunk);
      });
      request.on("end", () => {
        let payload = null;
        try {
          payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        } catch (error) {}
        prospectiveRequests.push({
          method: request.method,
          payload,
          bytes: size,
          headers: request.headers
        });
        const status = Number(prospectiveResponse.status || 204);
        const body = prospectiveResponse.body === undefined ? "" : JSON.stringify(prospectiveResponse.body);
        response.writeHead(status, {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store"
        });
        response.end(status === 204 ? "" : body);
      });
      return;
    }

    if (relativePath === fieldSessionHandoffPath) {
      const chunks = [];
      let size = 0;
      request.on("data", chunk => {
        size += chunk.length;
        if (size <= 1024 * 1024) chunks.push(chunk);
      });
      request.on("end", () => {
        if (request.method !== "POST") {
          response.writeHead(405, { "content-type": "application/json; charset=utf-8", allow: "POST" });
          response.end(JSON.stringify({ ok: false, acknowledged: false, message: "Method not allowed." }));
          return;
        }
        let payload;
        try {
          payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        } catch (error) {
          response.writeHead(400, { "content-type": "application/json; charset=utf-8" });
          response.end(JSON.stringify({ ok: false, acknowledged: false, retryable: false, code: "invalid_json" }));
          return;
        }
        const configured = fieldSessionResponses[fieldSessionAttempt] || { status: 201 };
        fieldSessionAttempt += 1;
        fieldSessionRequests.push({ payload, configured, attempt: fieldSessionAttempt });
        if (configured.status >= 400) {
          response.writeHead(configured.status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
          response.end(JSON.stringify({
            ok: false,
            acknowledged: false,
            code: configured.code || "field_session_store_unavailable",
            message: configured.message || "Field-session archive is temporarily unavailable.",
            retryable: configured.retryable !== false
          }));
          return;
        }
        const report = JSON.parse(payload.rawReportText);
        const sessionId = `route-iq-field-session-fitness-connection-fitness-${report.rep.id}-${report.date}`;
        response.writeHead(configured.status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
        response.end(JSON.stringify({
          ok: true,
          acknowledged: true,
          acknowledgment: {
            contractId: "route-iq-end-of-day-data-handoff-v1",
            status: configured.archiveStatus || "archived",
            sessionId,
            workspaceId: payload.workspaceId,
            rawSha256: "runtime-harness-sha256",
            duplicate: configured.duplicate === true,
            persisted: true,
            sourceFinalizedAt: payload.sourceFinalizedAt
          }
        }));
      });
      return;
    }

    if (missingActive && relativePath === activePoolPath) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
      response.end("active pool intentionally unavailable for regression harness");
      return;
    }

    const resolvedPath = resolve(dashboardRoot, normalize(relativePath));
    if (!resolvedPath.startsWith(dashboardRoot)) {
      response.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
      response.end("Forbidden");
      return;
    }

    try {
      const body = readFileSync(resolvedPath);
      response.writeHead(200, { "content-type": contentType(resolvedPath), "cache-control": "no-store" });
      response.end(body);
    } catch (error) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
      response.end("Not found");
    }
  });

  return new Promise((resolveServer, rejectServer) => {
    server.once("error", rejectServer);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolveServer({
        origin: `https://127.0.0.1:${address.port}`,
        requests,
        fieldSessionRequests,
        prospectiveRequests,
        close: () => new Promise(resolveClose => server.close(resolveClose))
      });
    });
  });
}

function wait(ms) {
  return new Promise(resolveWait => setTimeout(resolveWait, ms));
}

async function waitForJson(url, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await wait(100);
  }
  throw lastError || new Error(`Timed out waiting for ${url}`);
}

async function createPage(debugPort) {
  const response = await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" });
  if (!response.ok) throw new Error(`Unable to create Chrome target: HTTP ${response.status}`);
  return response.json();
}

class CdpSession {
  constructor(webSocketUrl) {
    this.webSocketUrl = webSocketUrl;
    this.socket = null;
    this.nextId = 1;
    this.pending = new Map();
    this.handlers = new Map();
  }

  async connect() {
    this.socket = new WebSocket(this.webSocketUrl);
    await new Promise((resolveOpen, rejectOpen) => {
      const timer = setTimeout(() => rejectOpen(new Error("Timed out connecting to Chrome CDP.")), 8000);
      this.socket.onopen = () => {
        clearTimeout(timer);
        resolveOpen();
      };
      this.socket.onerror = event => {
        clearTimeout(timer);
        rejectOpen(new Error(`Chrome CDP websocket error: ${event.message || "unknown"}`));
      };
    });
    this.socket.onmessage = event => this.handleMessage(event.data);
    this.socket.onclose = () => {
      for (const { reject } of this.pending.values()) reject(new Error("Chrome CDP websocket closed."));
      this.pending.clear();
    };
  }

  handleMessage(data) {
    const message = JSON.parse(typeof data === "string" ? data : data.toString());
    if (message.id && this.pending.has(message.id)) {
      const { resolve: resolvePending, reject } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message || JSON.stringify(message.error)));
      else resolvePending(message.result || {});
      return;
    }
    if (message.method && this.handlers.has(message.method)) {
      for (const handler of this.handlers.get(message.method)) handler(message.params || {});
    }
  }

  on(method, handler) {
    const existing = this.handlers.get(method) || [];
    existing.push(handler);
    this.handlers.set(method, existing);
  }

  waitFor(method, timeoutMs = 10000) {
    return new Promise((resolveEvent, rejectEvent) => {
      const timer = setTimeout(() => rejectEvent(new Error(`Timed out waiting for ${method}`)), timeoutMs);
      const handler = params => {
        clearTimeout(timer);
        resolveEvent(params);
      };
      this.on(method, handler);
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    const payload = JSON.stringify({ id, method, params });
    return new Promise((resolveSend, rejectSend) => {
      this.pending.set(id, { resolve: resolveSend, reject: rejectSend });
      this.socket.send(payload);
    });
  }

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text || "Runtime.evaluate failed.");
    }
    return result.result?.value;
  }

  close() {
    if (!this.socket || this.socket.readyState === WebSocket.CLOSED) return;
    this.socket.onmessage = null;
    this.socket.onerror = null;
    this.socket.onclose = null;
    try {
      this.socket.close();
    } catch (error) {}
  }
}

async function launchChrome() {
  const debugPort = 9400 + Math.floor(Math.random() * 1000);
  const userDataDir = join(tmpdir(), `prometheus-dashboard-runtime-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const args = [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--disable-background-networking",
    "--disable-component-update",
    "--disable-sync",
    "--ignore-certificate-errors",
    "--no-first-run",
    "--no-default-browser-check",
    `--user-data-dir=${userDataDir}`,
    `--remote-debugging-port=${debugPort}`,
    "about:blank"
  ];
  const processHandle = spawn(chromePath, args, { stdio: ["ignore", "pipe", "pipe"] });
  let stderr = "";
  processHandle.stderr.on("data", chunk => {
    stderr += chunk.toString();
  });
  processHandle.on("error", error => {
    errors.push(`Chrome launch failed: ${error.message}`);
  });
  await waitForJson(`http://127.0.0.1:${debugPort}/json/version`);
  return {
    debugPort,
    close: async () => {
      if (!processHandle.killed) processHandle.kill("SIGTERM");
      await new Promise(resolveClose => {
        const timer = setTimeout(resolveClose, 1500);
        processHandle.once("exit", () => {
          clearTimeout(timer);
          resolveClose();
        });
      });
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          rmSync(userDataDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
          break;
        } catch (error) {
          if (attempt === 2) errors.push(`Chrome profile cleanup failed: ${error.message}`);
          await wait(200);
        }
      }
      if (stderr && process.env.PROMETHEUS_DASHBOARD_HARNESS_DEBUG) console.error(stderr);
    }
  };
}

async function attachPage(chrome, eventLog) {
  const page = await createPage(chrome.debugPort);
  const cdp = new CdpSession(page.webSocketDebuggerUrl);
  await cdp.connect();
  cdp.on("Runtime.exceptionThrown", params => {
    eventLog.runtimeExceptions.push(params.exceptionDetails?.text || "Runtime exception");
  });
  cdp.on("Runtime.consoleAPICalled", params => {
    if (params.type === "error") {
      const text = (params.args || []).map(arg => arg.value || arg.description || "").join(" ").trim();
      eventLog.consoleErrors.push(text || "console.error");
    }
  });
  cdp.on("Log.entryAdded", params => {
    if (params.entry?.level === "error") eventLog.logErrors.push(params.entry.text || "Chrome log error");
  });
  cdp.on("Network.requestWillBeSent", params => {
    if (params.request?.url?.includes("runtime") || params.request?.url?.includes("active-pool")) {
      eventLog.network.push({ event: "request", url: params.request.url });
    }
  });
  cdp.on("Network.responseReceived", params => {
    if (params.response?.url?.includes("runtime") || params.response?.url?.includes("active-pool")) {
      eventLog.network.push({ event: "response", url: params.response.url, status: params.response.status });
    }
  });
  cdp.on("Network.loadingFailed", params => {
    eventLog.network.push({ event: "failed", errorText: params.errorText, blockedReason: params.blockedReason || "" });
  });
  await cdp.send("Runtime.enable");
  await cdp.send("Log.enable");
  await cdp.send("Page.enable");
  await cdp.send("Network.enable");
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `Object.defineProperty(navigator, "serviceWorker", { value: {
      register: () => Promise.reject(new Error("Service worker disabled by runtime workflow harness.")),
      addEventListener: () => {}
    }, configurable: true });`
  });
  return cdp;
}

async function navigateAndWait(cdp, url, timeoutMs = 10000) {
  await cdp.send("Page.navigate", { url });
  await wait(Math.min(250, timeoutMs));
}

async function setViewport(cdp, viewport) {
  if (!viewport) return;
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: viewport.deviceScaleFactor || 1,
    mobile: Boolean(viewport.mobile)
  });
  await cdp.send("Emulation.setTouchEmulationEnabled", {
    enabled: Boolean(viewport.mobile),
    maxTouchPoints: viewport.mobile ? 5 : 0
  });
}

async function setStandaloneMode(cdp, enabled) {
  if (!enabled) return;
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `(() => {
      Object.defineProperty(window.navigator, "standalone", { value: true, configurable: true });
      const nativeMatchMedia = window.matchMedia.bind(window);
      window.matchMedia = query => {
        if (String(query).includes("display-mode: standalone")) {
          return {
            matches: true,
            media: query,
            onchange: null,
            addListener: () => {},
            removeListener: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => false
          };
        }
        return nativeMatchMedia(query);
      };
    })();`
  });
}

async function waitForDashboardReady(cdp, timeoutMs = 10000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const ready = await cdp.evaluate(`(() => {
      const debug = window.prometheusDebugState || {};
      return Boolean(
        debug.startupCompleted &&
        debug.runtimeDataStatus === "loaded" &&
        debug.renderRouteIntelligenceReceivedRecommendation &&
        document.getElementById("bestNextMove") &&
        document.getElementById("bestNextMove").textContent.trim() !== "Loading route signal"
      );
    })()`);
    if (ready) return Date.now() - startedAt;
    await wait(100);
  }
  const diagnostic = await cdp.evaluate(`(() => ({
    href: location.href,
    title: document.title,
    bodyClass: document.body?.className || "",
    bodyText: (document.body?.innerText || "").slice(0, 500),
    debug: window.prometheusDebugState || null,
    loaderType: typeof loadRuntimeProductionDataset,
    fetchType: typeof fetch,
    bestNextMove: document.getElementById("bestNextMove")?.textContent || "",
    resources: performance.getEntriesByType("resource")
      .filter(entry => entry.name.includes("runtime") || entry.name.includes("active-pool"))
      .map(entry => ({ name: entry.name, duration: Math.round(entry.duration), transferSize: entry.transferSize }))
  }))()`).catch(error => ({ diagnosticError: error.message }));
  if (
    diagnostic?.debug?.startupCompleted &&
    diagnostic?.debug?.runtimeDataStatus === "loaded" &&
    diagnostic?.debug?.renderRouteIntelligenceReceivedRecommendation &&
    diagnostic?.bestNextMove &&
    diagnostic.bestNextMove !== "Loading route signal"
  ) {
    return Date.now() - startedAt;
  }
  throw new Error(`Dashboard did not finish runtime route rendering before timeout: ${JSON.stringify(diagnostic)}`);
}

async function snapshot(cdp) {
  return cdp.evaluate(`(() => {
    const text = element => element ? element.textContent.trim() : "";
    const visible = element => {
      if (!element) return false;
      const style = getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden" && element.offsetParent !== null;
    };
    const debug = window.prometheusDebugState || {};
    return {
      mode: document.body.dataset.mode,
      sessionRole: document.body.dataset.sessionRole,
      activeRepId: typeof activeRepId === "string" ? activeRepId : "",
      workspaceId: document.body.dataset.workspaceId || "",
      workspaceName: document.body.dataset.workspaceName || "",
      workspaceOperatingProfileId: document.body.dataset.operatingProfileId || "",
      appBuildVersion: typeof appBuildVersion === "string" ? appBuildVersion : "",
      serviceWorkerCacheVersion: typeof serviceWorkerCacheVersion === "string" ? serviceWorkerCacheVersion : "",
      storedAppBuildVersion: localStorage.getItem("prometheus-app-build-version") || "",
      anthonyProfileExists: Boolean(state?.repProfiles?.anthony),
      anthonyPoolCount: typeof anthonyApprovedRoutePool === "function" ? anthonyApprovedRoutePool(state?.places || []).length : 0,
      visibleOwnerControls: [...document.querySelectorAll(".owner-only, .manager-only, .admin-only")]
        .filter(visible)
        .map(element => ({
          tag: element.tagName.toLowerCase(),
          id: element.id || "",
          text: element.textContent.trim().replace(/\\s+/g, " ").slice(0, 80)
        })),
      modeButtonLabels: [...document.querySelectorAll("[data-mode-select]")].filter(visible).map(button => button.textContent.trim()),
      workspaceButtonLabels: [...document.querySelectorAll("[data-workspace-select]")].filter(visible).map(button => button.textContent.trim().replace(/\\s+/g, " ")),
      activeWorkspaceButtons: [...document.querySelectorAll("[data-workspace-select].active")].filter(visible).map(button => button.dataset.workspaceSelect),
      profileButtonLabels: [...document.querySelectorAll("[data-rep-select]")].filter(visible).map(button => button.textContent.trim()),
      activeView: document.querySelector(".view.active")?.id || "",
      visibleTabs: [...document.querySelectorAll(".tab[data-tab]")].filter(visible).map(tab => tab.dataset.tab),
      bestNextMove: text(document.getElementById("bestNextMove")),
      bestMoveAddress: text(document.getElementById("bestMoveAddress")),
      bestMoveDirections: document.getElementById("bestMoveDirections")?.href || "",
      routeRisk: text(document.getElementById("routeRisk")),
      routeCountLabel: text(document.getElementById("routeCount")),
      dailyRouteCountLabel: text(document.getElementById("dailyRouteCount")),
      routeLoopStatus: text(document.getElementById("routeLoopStatusToday")),
      routeQueueIds: Array.isArray(state?.repProfiles?.[activeRepId]?.activeRouteQueue?.entries)
        ? state.repProfiles[activeRepId].activeRouteQueue.entries.map(entry => entry.identityKey)
        : [],
      routeQueueHours: Array.isArray(state?.repProfiles?.[activeRepId]?.activeRouteQueue?.entries)
        ? state.repProfiles[activeRepId].activeRouteQueue.entries.map(entry => ({
            identityKey: entry.identityKey,
            status: entry.eligibilitySnapshot?.status || "",
            marker: entry.eligibilitySnapshot?.internalMarker || "",
            reasonCode: entry.eligibilitySnapshot?.reasonCode || "",
            scoringChanged: entry.eligibilitySnapshot?.scoringChanged === true
          }))
        : [],
      routeQueueRevision: Number(state?.repProfiles?.[activeRepId]?.activeRouteQueue?.revision || 0),
      visitCount: Array.isArray(state?.repProfiles?.[activeRepId]?.visits) ? state.repProfiles[activeRepId].visits.length : 0,
      handoffStatus: text(document.getElementById("handoffStatus")),
      endRouteDisabled: document.getElementById("endRoute")?.disabled ?? null,
      endDayDisabled: document.getElementById("endDay")?.disabled ?? null,
      retryArchiveVisible: visible(document.getElementById("retryFieldSessionArchive")),
      manualExportVisible: visible(document.getElementById("exportTodayReport")),
      manualExportDisabled: document.getElementById("exportTodayReport")?.disabled ?? null,
      territoryText: text(document.getElementById("territoryOverview")),
      territoryVisible: visible(document.getElementById("territoryOverview")),
      territoryRingCount: document.querySelectorAll("#territoryRingList .territory-ring").length,
      territoryRingTexts: [...document.querySelectorAll("#territoryRingList .territory-ring")].map(ring => ring.textContent.trim().replace(/\\s+/g, " ")),
      territoryOwnerPolicyVisible: visible(document.getElementById("territoryPolicyForm")),
      territoryRepRadiusVisible: visible(document.getElementById("territoryRepRadiusForm")),
      territoryRepRadiusDisabled: document.getElementById("territoryRepRadiusInput")?.disabled ?? null,
      territoryPolicyStatus: text(document.getElementById("territoryPolicyStatus")),
      territoryRepRadiusStatus: text(document.getElementById("territoryRepRadiusStatus")),
      eventCards: document.querySelectorAll("#eventOpportunities .item").length,
      eventText: text(document.getElementById("eventOpportunities")),
      routeText: text(document.getElementById("view-route")),
      todayText: text(document.getElementById("view-today")),
      placesText: text(document.getElementById("view-places")),
      statsText: text(document.getElementById("view-stats")),
      findText: text(document.getElementById("view-find")),
      operatingProfileId: document.body.dataset.operatingProfile || "",
      routeCards: document.querySelectorAll("#routeList .route-card").length,
      routeCardHoursStatuses: [...document.querySelectorAll("#routeList .route-card")].map(card => card.dataset.hoursStatus || ""),
      routeCardHoursMarkers: [...document.querySelectorAll("#routeList .route-card")].map(card => card.dataset.hoursMarker || ""),
      dailyRouteCards: document.querySelectorAll("#dailyRoute .route-card").length,
      placesItems: document.querySelectorAll("#placesList .item").length,
      searchItems: document.querySelectorAll("#dailySearches .item").length,
      targetIdeas: document.querySelectorAll("#targetIdeas .item").length,
      debug: {
        startupCompleted: Boolean(debug.startupCompleted),
        runtimeDataStatus: debug.runtimeDataStatus || "",
        runtimeDataPool: debug.runtimeDataPool || "",
        runtimeDataSource: debug.runtimeDataSource || "",
        lastError: debug.lastError || "",
        lastUnhandledRejection: debug.lastUnhandledRejection || "",
        routeRecommendation: debug.routeRecommendation || null,
        rendererReceived: Boolean(debug.renderRouteIntelligenceReceivedRecommendation),
        renderTimings: debug.renderTimings || {},
        deferredOwnerViews: debug.deferredOwnerViews || {},
        placesRender: debug.placesRender || {},
        territoryCoverage: debug.territoryCoverage || {},
        routeWindowFallback: debug.routeWindowFallback || {},
        routeReplenishment: debug.routeReplenishment || {},
        businessHours: debug.businessHours || {},
        fieldSessionArchive: debug.fieldSessionArchive || {},
        runtimeFallback: debug.runtimeFallback || {},
        operatingProfile: debug.operatingProfile || {},
        workspace: debug.workspace || {}
      },
      performance: {
        navigationDuration: Math.round(performance.getEntriesByType("navigation")[0]?.duration || 0),
        activeResourceDuration: Math.round(performance.getEntriesByType("resource").find(entry => entry.name.includes("active-pool.json"))?.duration || 0),
        fullResourceDuration: Math.round(performance.getEntriesByType("resource").find(entry => entry.name.includes("runtime-pools.json"))?.duration || 0)
      }
    };
  })()`);
}

async function verifyRouteBusinessHoursRuntime(cdp) {
  return cdp.evaluate(`(() => {
    const christianPlaceId = "ChIJiduac7LCQIYR-sGBtIAjKR0";
    const record = routeBusinessHoursIndex?.recordsByPlaceId?.get(christianPlaceId) || null;
    const fieldDecision = record && routeBusinessHoursApi
      ? routeBusinessHoursApi.evaluateRouteBusinessHoursEligibility({
          record,
          evaluatedAt: "2026-07-11T21:21:59.331Z",
          policy: routeBusinessHoursIndex.freshnessPolicy,
          artifactAvailable: true,
          workspaceId: "fitness_connection",
          operatingProfileId: "fitness"
        })
      : null;
    const decisionAtFieldTime = place => {
      const hoursRecord = routeBusinessHoursIndex?.recordsByPlaceId?.get(place?.googlePlaceId) || null;
      return routeBusinessHoursApi.evaluateRouteBusinessHoursEligibility({
        record: hoursRecord,
        evaluatedAt: "2026-07-11T21:21:59.331Z",
        policy: routeBusinessHoursIndex.freshnessPolicy,
        artifactAvailable: true,
        workspaceId: "fitness_connection",
        operatingProfileId: "fitness"
      });
    };
    const christianPlace = state.places.find(place => place.googlePlaceId === christianPlaceId) || null;
    const openAlternative = state.places.find(place => place.googlePlaceId !== christianPlaceId && decisionAtFieldTime(place).status === "OPEN_VERIFIED") || null;
    const fieldQueue = christianPlace && openAlternative
      ? routeReplenishmentApi.maintainRouteQueue({
          queue: routeReplenishmentApi.createEmptyRouteQueue({
            workspaceId: "fitness_connection",
            representativeId: "field-regression",
            operatingProfileId: "fitness",
            routeDate: "2026-07-11",
            targetSize: 1,
            threshold: 1
          }),
          workspaceId: "fitness_connection",
          representativeId: "field-regression",
          operatingProfileId: "fitness",
          routeDate: "2026-07-11",
          primaryCandidates: [christianPlace, openAlternative],
          force: true,
          identityOf: routeIdentityKey,
          isEligible: place => decisionAtFieldTime(place).eligible,
          scoreCandidate: place => routeBusinessHoursApi.applyHoursEligibilityToScore(
            place.googlePlaceId === christianPlaceId ? 1000 : 1,
            decisionAtFieldTime(place)
          ),
          now: "2026-07-11T21:21:59.331Z"
        })
      : null;
    const queue = activeProfile().activeRouteQueue;
    const entries = Array.isArray(queue?.entries) ? queue.entries : [];
    const cards = [...document.querySelectorAll("#routeList .route-card")];
    return {
      artifactAvailable: routeBusinessHoursArtifactAvailable,
      recordCount: routeBusinessHoursIndex?.recordCount || 0,
      fieldDecision,
      christianPermanentStatus: record?.permanentOperationalStatus || "",
      christianQueued: entries.some(entry => entry.identityKey === "google:" + christianPlaceId),
      fieldQueueIds: fieldQueue?.queue?.entries?.map(entry => entry.identityKey) || [],
      fieldQueueOpenAlternativeId: openAlternative ? routeIdentityKey(openAlternative) : "",
      queueCount: entries.length,
      queueStatuses: entries.map(entry => entry.eligibilitySnapshot?.status || ""),
      queueReasonCodes: entries.map(entry => entry.eligibilitySnapshot?.reasonCode || ""),
      queueScoringChanged: entries.some(entry => entry.eligibilitySnapshot?.scoringChanged === true),
      queueUnverifiedCount: entries.filter(entry => entry.eligibilitySnapshot?.internalMarker === "HOURS_NOT_VERIFIED").length,
      routeCardCount: cards.length,
      routeCardStatuses: cards.map(card => card.dataset.hoursStatus || ""),
      routeCardMarkers: cards.map(card => card.dataset.hoursMarker || ""),
      routeText: document.getElementById("routeList")?.textContent?.trim().replace(/\\s+/g, " ").slice(0, 1200) || "",
      debug: window.prometheusDebugState?.businessHours || {}
    };
  })()`);
}

async function mobileFitSnapshot(cdp) {
  return cdp.evaluate(`(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const visible = element => {
      if (!element) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const rectFor = selector => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        width: Math.round(rect.width),
        visible: visible(element)
      };
    };
    const offenders = [...document.body.querySelectorAll("*")]
      .filter(visible)
      .map(element => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          id: element.id || "",
          className: typeof element.className === "string" ? element.className : "",
          text: (element.textContent || "").trim().replace(/\\s+/g, " ").slice(0, 80),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width)
        };
      })
      .filter(item => item.left < -1 || item.right > viewportWidth + 1)
      .slice(0, 12);
    return {
      viewportWidth,
      docScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      bodyOverflowX: getComputedStyle(document.body).overflowX,
      htmlOverflowX: getComputedStyle(document.documentElement).overflowX,
      activeView: document.querySelector(".view.active")?.id || "",
      ownerTabs: [...document.querySelectorAll(".tab[data-tab]")].filter(visible).map(tab => tab.dataset.tab),
      modeButtonLabels: [...document.querySelectorAll('[data-mode-select]')].filter(visible).map(button => button.textContent.trim()),
      workspaceButtonLabels: [...document.querySelectorAll('[data-workspace-select]')].filter(visible).map(button => button.textContent.trim().replace(/\\s+/g, " ")),
      profileButtonLabels: [...document.querySelectorAll('[data-rep-select]')].filter(visible).map(button => button.textContent.trim()),
      rects: {
        header: rectFor("header"),
        topLine: rectFor(".topline"),
        workspaceSwitch: rectFor("#workspaceSwitch"),
        modeSwitch: rectFor(".mode-switch:not(#repProfileSwitch)"),
        repProfileSwitch: rectFor("#repProfileSwitch"),
        goalChip: rectFor(".goal-chip"),
        main: rectFor("main"),
        nav: rectFor("nav"),
        tabs: rectFor(".tabs")
      },
      offenders
    };
  })()`);
}

async function clickTab(cdp, tab) {
  await cdp.evaluate(`(() => {
    const target = document.querySelector('[data-tab="${tab}"]');
    if (!target) throw new Error('Missing tab ${tab}');
    target.click();
    return true;
  })()`);
  await wait(150);
}

async function clickWorkspace(cdp, workspaceId) {
  await cdp.evaluate(`(() => {
    const target = document.querySelector('[data-workspace-select="${workspaceId}"]');
    if (!target) throw new Error('Missing workspace selector ${workspaceId}');
    target.click();
    return target.dataset.workspaceSelect;
  })()`);
  await wait(500);
}

async function waitForPath(cdp, pathname, timeoutMs = 8000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const currentPath = await cdp.evaluate("location.pathname");
    if (currentPath === pathname) return currentPath;
    await wait(100);
  }
  throw new Error(`Timed out waiting for path ${pathname}`);
}

async function waitForPlacesRenderComplete(cdp, timeoutMs = 8000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const state = await cdp.evaluate(`(() => {
      const debug = window.prometheusDebugState?.placesRender || {};
      return {
        complete: Boolean(debug.complete),
        rendered: Number(debug.rendered || 0),
        total: Number(debug.total || 0),
        initialMs: Number(debug.initialMs || 0),
        durationMs: Number(debug.durationMs || debug.initialMs || 0),
        visibleCards: document.querySelectorAll("#placesList .item").length,
        loading: Boolean(document.querySelector("#placesList [data-places-loading]"))
      };
    })()`);
    if (state.complete && state.total && state.visibleCards === state.total) return state;
    await wait(100);
  }
  const diagnostic = await cdp.evaluate(`(() => window.prometheusDebugState?.placesRender || {})()`);
  throw new Error(`Places render did not complete: ${JSON.stringify(diagnostic)}`);
}

async function verifyMobileQuickLogging(cdp) {
  return cdp.evaluate(`(async () => {
    const visible = element => {
      if (!element) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const openButton = document.querySelector('[data-open="quick"]');
    if (!openButton) throw new Error("Missing quick logging entry point.");
    openButton.click();
    await new Promise(resolve => requestAnimationFrame(resolve));
    const modal = document.getElementById("modal");
    const modalBody = document.getElementById("modalBody");
    const saleButton = document.querySelector('[data-quick-outcome="sale"]');
    if (!modal?.classList.contains("active")) throw new Error("Quick logging modal did not open.");
    if (!saleButton) throw new Error("Missing Sale quick outcome.");
    saleButton.click();
    await new Promise(resolve => requestAnimationFrame(resolve));
    const saveButton = document.querySelector("#quickCounts .btn[type='submit']");
    const unitsInput = document.querySelector("#quickForm [name='units']");
    if (!saveButton || !unitsInput) throw new Error("Quick logging submit controls are missing.");
    modalBody.scrollTop = modalBody.scrollHeight;
    await new Promise(resolve => requestAnimationFrame(resolve));
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight;
    const modalBodyRect = modalBody.getBoundingClientRect();
    const saveRect = saveButton.getBoundingClientRect();
    const modalBodyClientHeight = Math.round(modalBody.clientHeight);
    const modalBodyScrollHeight = Math.round(modalBody.scrollHeight);
    const beforeUnits = Number(document.getElementById("unitsToday")?.textContent || 0);
    const reachable = visible(saveButton)
      && saveRect.top >= -1
      && saveRect.left >= -1
      && saveRect.right <= viewportWidth + 1
      && saveRect.bottom <= viewportHeight + 1;
    saveButton.click();
    const completionDeadline = Date.now() + 15000;
    while (modal.classList.contains("active") && Date.now() < completionDeadline) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    const afterUnits = Number(document.getElementById("unitsToday")?.textContent || 0);
    return {
      modalActiveAfterSubmit: modal.classList.contains("active"),
      viewportWidth,
      viewportHeight,
      documentScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      modalBodyClientHeight,
      modalBodyScrollHeight,
      modalBodyRect: {
        top: Math.round(modalBodyRect.top),
        bottom: Math.round(modalBodyRect.bottom),
        height: Math.round(modalBodyRect.height)
      },
      saveButtonRect: {
        top: Math.round(saveRect.top),
        bottom: Math.round(saveRect.bottom),
        left: Math.round(saveRect.left),
        right: Math.round(saveRect.right),
        height: Math.round(saveRect.height)
      },
      reachable,
      beforeUnits,
      afterUnits,
      unitsInputValue: unitsInput.value,
      routeLoopStatus: document.getElementById("routeLoopStatusToday")?.textContent?.trim() || "",
      routeQueueCount: activeProfile().activeRouteQueue?.entries?.length || 0
    };
  })()`);
}

async function verifyNearbyOpportunitiesFlow(cdp) {
  return cdp.evaluate(`(async () => {
    const waitFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
    const emptyBefore = document.querySelector("#nearbyOpportunities .empty")?.textContent?.trim() || "";
    const target = (typeof routeVisiblePlaces === "function" ? routeVisiblePlaces() : [])
      .find(place => typeof nearbyOpportunitiesForPlace === "function" && nearbyOpportunitiesForPlace(place, 4).length > 0);
    if (!target) throw new Error("No Anthony Active Pool target has nearby opportunities.");
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition(success) {
          success({
            coords: {
              latitude: Number(target.latitude),
              longitude: Number(target.longitude),
              accuracy: 9
            }
          });
        }
      }
    });
    const beforeRuntimePool = window.prometheusDebugState?.runtimeDataPool || "";
    document.querySelector('[data-open="quick"]')?.click();
    await waitFrame();
    const form = document.getElementById("quickForm");
    if (!form) throw new Error("Quick logging form did not open.");
    form.elements.placeId.value = target.id;
    form.querySelector("[data-verify-location]")?.click();
    await waitFrame();
    const locationButtonLabel = form.querySelector("[data-verify-location]")?.textContent?.trim() || "";
    const locationStatus = form.querySelector("[data-location-status]")?.textContent?.trim() || "";
    form.querySelector('[data-quick-outcome="talk"]')?.click();
    await waitFrame();
    form.querySelector("#quickCounts .btn[type='submit']")?.click();
    await new Promise(resolve => setTimeout(resolve, 150));
    const cards = [...document.querySelectorAll("#nearbyOpportunities .nearby-card")].map(card => card.textContent.trim().replace(/\\s+/g, " "));
    const countLabel = document.getElementById("nearbyOpportunitiesCount")?.textContent?.trim() || "";
    const debug = window.prometheusDebugState?.nearbyOpportunities || {};
    const latestVisit = state.visits.slice().sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))[0] || {};
    return {
      emptyBefore,
      target: {
        id: target.id,
        name: target.name,
        latitude: target.latitude,
        longitude: target.longitude
      },
      locationStatus,
      locationButtonLabel,
      latestVisitHasLocation: Boolean(latestVisit.location),
      latestVisitPlaceId: latestVisit.placeId || "",
      beforeRuntimePool,
      runtimePool: window.prometheusDebugState?.runtimeDataPool || "",
      nearbyDebug: debug,
      countLabel,
      cardCount: cards.length,
      firstCard: cards[0] || "",
      noEmptyAfter: !document.querySelector("#nearbyOpportunities .empty")
    };
  })()`);
}

async function verifyRouteNearbyInteraction(cdp) {
  return cdp.evaluate(`(() => {
    const badge = document.querySelector("#routeList .decision-chip.nearby");
    const card = badge?.closest(".route-card");
    if (!badge || !card) throw new Error("Route nearby badge was not rendered.");
    const before = {
      activeView: document.querySelector(".view.active")?.id || "",
      modalActive: document.getElementById("modal")?.classList.contains("active") || false,
      detailsOpen: card.querySelector(".compact-details")?.hasAttribute("open") || false
    };
    badge.click();
    const style = getComputedStyle(badge);
    const modal = document.getElementById("modal");
    const modalText = document.getElementById("modalBody")?.textContent?.trim().replace(/\\s+/g, " ") || "";
    const after = {
      activeView: document.querySelector(".view.active")?.id || "",
      modalActive: modal?.classList.contains("active") || false,
      detailsOpen: card.querySelector(".compact-details")?.hasAttribute("open") || false
    };
    document.getElementById("closeModal")?.click();
    return {
      tagName: badge.tagName.toLowerCase(),
      text: badge.textContent.trim(),
      className: badge.className,
      nearbyPlace: badge.getAttribute("data-nearby-place") || "",
      role: badge.getAttribute("role") || "",
      dataOpen: badge.getAttribute("data-open") || "",
      dataTab: badge.getAttribute("data-tab") || "",
      dataQuickPlace: badge.getAttribute("data-quick-place") || "",
      title: badge.getAttribute("title") || "",
      ariaLabel: badge.getAttribute("aria-label") || "",
      cursor: style.cursor,
      pointerEvents: style.pointerEvents,
      borderStyle: style.borderStyle,
      backgroundColor: style.backgroundColor,
      color: style.color,
      modalTitle: document.getElementById("modalTitle")?.textContent?.trim() || "",
      modalText,
      whyText: card.querySelector(".compact-details")?.textContent?.trim().replace(/\\s+/g, " ").slice(0, 1000) || "",
      before,
      after
    };
  })()`);
}

async function verifyTerritoryPermissionModel(cdp) {
  return cdp.evaluate(`(() => {
    if (typeof territoryPolicyFor !== "function") throw new Error("Territory policy engine is unavailable.");
    const before = territoryPolicyFor(activeRepId);
    updateOwnerTerritoryPolicy("allowed", 10);
    updateOwnerTerritoryPolicy("assigned", 5);
    updateOwnerTerritoryPolicy("allowRepChanges", true);
    updateOwnerTerritoryPolicy("lockAssigned", false);
    const afterOwner = territoryPolicyFor(activeRepId);
    const ownerStatus = document.getElementById("territoryPolicyStatus")?.textContent?.trim() || "";
    setMode("rep");
    render();
    const repControl = document.getElementById("territoryRepRadiusInput");
    const repDisabledBefore = repControl?.disabled ?? null;
    if (repControl) {
      repControl.value = "10";
      repControl.dispatchEvent(new Event("change", { bubbles: true }));
    }
    const afterRep = territoryPolicyFor(activeRepId);
    const repStatus = document.getElementById("territoryRepRadiusStatus")?.textContent?.trim() || "";
    setMode("owner");
    render();
    return {
      activeRepId,
      before,
      afterOwner,
      afterRep,
      ownerStatus,
      repDisabledBefore,
      repStatus,
      assignedRadiusText: document.getElementById("territoryAssignedRadius")?.textContent?.trim() || "",
      routePoolMaxMiles: typeof routePool === "function" && typeof routeVisiblePlaces === "function"
        ? Math.max(...routePool(routeVisiblePlaces()).map(place => Number(String(place.distance || "").match(/\\d+(?:\\.\\d+)?/)?.[0] || 0)))
        : null
    };
  })()`);
}

async function verifyRouteWindowOptions(cdp) {
  const result = {};
  for (const windowName of ["morning", "evening"]) {
    await cdp.evaluate(`(() => {
      const button = document.querySelector('[data-window="${windowName}"]');
      if (!button) throw new Error("Missing ${windowName} route window button.");
      button.click();
    })()`);
    await wait(100);
    result[windowName] = await cdp.evaluate(`(() => ({
      activeView: document.querySelector(".view.active")?.id || "",
      routeCards: document.querySelectorAll("#routeList .route-card").length,
      routeCountLabel: document.getElementById("routeCount")?.textContent?.trim() || "",
      routeText: document.getElementById("routeList")?.textContent?.trim().replace(/\\s+/g, " ").slice(0, 800) || "",
      fallback: window.prometheusDebugState?.routeWindowFallback || {}
    }))()`);
  }
  return result;
}

async function verifyRouteStateSynchronization(cdp) {
  return cdp.evaluate(`(() => {
    const latestVisit = state.visits.slice().sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))[0] || {};
    const place = state.places.find(item => item.id === latestVisit.placeId);
    if (!place || typeof routeIdentityKey !== "function") throw new Error("No logged route place available for synchronization check.");
    const key = routeIdentityKey(place);
    render();
    const routeCards = [...document.querySelectorAll("#routeList .route-card")].map(card => card.textContent.trim().replace(/\\s+/g, " "));
    const dailyCards = [...document.querySelectorAll("#dailyRoute .route-card")].map(card => card.textContent.trim().replace(/\\s+/g, " "));
    const listedRouteKeys = typeof routePool === "function" && typeof routeVisiblePlaces === "function"
      ? routePool(routeVisiblePlaces()).map(routeIdentityKey)
      : [];
    const bestNext = typeof routeRecommendation === "function" ? routeRecommendation() : null;
    return {
      loggedPlaceId: place.id,
      loggedName: place.name,
      routeKey: key,
      latestVisitPlaceId: latestVisit.placeId || "",
      routeCardCount: routeCards.length,
      dailyCardCount: dailyCards.length,
      routeCards: routeCards.slice(0, 12),
      dailyCards: dailyCards.slice(0, 12),
      routePoolStillContainsLogged: listedRouteKeys.includes(key),
      routeListStillContainsLogged: routeCards.some(text => text.includes(place.name)),
      dailyRouteStillContainsLogged: dailyCards.some(text => text.includes(place.name)),
      bestNextStillLogged: bestNext ? routeIdentityKey(bestNext) === key : false,
      bestNextName: bestNext?.name || ""
    };
  })()`);
}

async function verifyContinuousAdaptiveReplenishment(cdp) {
  return cdp.evaluate(`(async () => {
    const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
    const profile = activeProfile();
    const beforeQueue = profile.activeRouteQueue?.entries?.map(entry => ({ ...entry })) || [];
    if (beforeQueue.length !== 15) throw new Error("Expected 15 active stops before completion, found " + beforeQueue.length + ".");
    const completedEntry = beforeQueue[0];
    const completedPlace = state.places.find(place => routeIdentityKey(place) === completedEntry.identityKey);
    if (!completedPlace) throw new Error("Unable to resolve the first active route stop.");
    const beforeVisitCount = state.visits.length;
    const beforeRevision = Number(profile.activeRouteQueue?.revision || 0);
    document.querySelector('[data-open="quick"]')?.click();
    await wait(0);
    const form = document.getElementById("quickForm");
    if (!form) throw new Error("Quick Result form did not open.");
    form.elements.placeId.value = completedPlace.id;
    form.querySelector('[data-quick-outcome="sale"]')?.click();
    await wait(0);
    form.querySelector('#quickCounts .btn[type="submit"]')?.click();
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      const queue = activeProfile().activeRouteQueue;
      if (!document.getElementById("modal")?.classList.contains("active")
        && Number(queue?.revision || 0) > beforeRevision
        && window.prometheusDebugState?.routeReplenishment?.state !== "loading") break;
      await wait(50);
    }
    const afterProfile = activeProfile();
    const afterQueue = afterProfile.activeRouteQueue?.entries?.map(entry => ({ ...entry })) || [];
    const stored = JSON.parse(localStorage.getItem("prometheus-v1") || "{}");
    const storedProfile = stored.repProfiles?.[activeRepId] || {};
    const status = document.getElementById("routeLoopStatusToday")?.textContent?.trim() || "";
    const beforeFlight = routeReplenishmentCoordinator.status();
    const firstFlight = requestAdaptiveRouteReplenishment({ force: false, trigger: "concurrency-check" });
    const secondFlight = requestAdaptiveRouteReplenishment({ force: false, trigger: "concurrency-check" });
    await Promise.all([firstFlight, secondFlight]);
    const afterFlight = routeReplenishmentCoordinator.status();
    return {
      beforeQueueIds: beforeQueue.map(entry => entry.identityKey),
      afterQueueIds: afterQueue.map(entry => entry.identityKey),
      beforeVisitCount,
      afterVisitCount: state.visits.length,
      completedIdentity: completedEntry.identityKey,
      completedPlaceId: completedPlace.id,
      status,
      queueState: afterProfile.activeRouteQueue?.state || "",
      queueTarget: Number(afterProfile.activeRouteQueue?.targetSize || 0),
      queueThreshold: Number(afterProfile.activeRouteQueue?.threshold || 0),
      queueRevision: Number(afterProfile.activeRouteQueue?.revision || 0),
      latestEvidenceCount: Number(afterProfile.adaptiveIntelligence?.evidenceCount || 0),
      persistedVisitCount: Array.isArray(storedProfile.visits) ? storedProfile.visits.length : 0,
      persistedQueueIds: storedProfile.activeRouteQueue?.entries?.map(entry => entry.identityKey) || [],
      completedStillActive: afterQueue.some(entry => entry.identityKey === completedEntry.identityKey),
      remainingOrderPreserved: beforeQueue.slice(1).every((entry, index) => afterQueue[index]?.identityKey === entry.identityKey),
      appendedReplacement: afterQueue.length === 15 && !beforeQueue.some(entry => entry.identityKey === afterQueue.at(-1)?.identityKey),
      duplicateCount: afterQueue.length - new Set(afterQueue.map(entry => entry.identityKey)).size,
      debug: window.prometheusDebugState?.routeReplenishment || {},
      beforeFlight,
      afterFlight,
      concurrencyCoalesced: afterFlight.coalesced > beforeFlight.coalesced
    };
  })()`);
}

async function verifyHamzaRepeatRecommendation(cdp) {
  return cdp.evaluate(`(() => {
    if (typeof routeVisiblePlaces !== "function" || typeof buildRouteList !== "function") throw new Error("Route engine is unavailable.");
    const hamza = routeVisiblePlaces().find(place => /Hamza/i.test(place.name || ""));
    if (!hamza) throw new Error("Hamza's Barbershop is not visible in the active route pool.");
    const need = Math.max(0, GOAL - sumVisits(todayVisits()).units);
    const beforeRoute = buildRouteList(routeVisiblePlaces(), 10, { need, expandRadius: shouldExpandRadius(need) });
    const beforeIndex = beforeRoute.findIndex(item => routeIdentityKey(item.place) === routeIdentityKey(hamza));
    recordRouteRecommendation(hamza, "beta-sprint-2-hamza-regression");
    const afterRoute = buildRouteList(routeVisiblePlaces(), 10, { need, expandRadius: shouldExpandRadius(need) });
    const afterIndex = afterRoute.findIndex(item => routeIdentityKey(item.place) === routeIdentityKey(hamza));
    const afterAnalysis = routeAnalysis(hamza);
    const bestNext = routeRecommendation();
    return {
      hamzaId: hamza.id,
      hamzaName: hamza.name,
      routeKey: routeIdentityKey(hamza),
      beforeIndex,
      afterIndex,
      daysSinceRecommendation: afterAnalysis.daysSinceRecommendation,
      reasons: afterAnalysis.reasons,
      bestNextName: bestNext?.name || "",
      bestNextIsHamza: bestNext ? routeIdentityKey(bestNext) === routeIdentityKey(hamza) : false,
      routeHistoryEvidence: (state.routeHistory || []).filter(item => item.routeKey === routeIdentityKey(hamza)).slice(-3)
    };
  })()`);
}

async function verifyFieldSessionCompletion(cdp, completionAction) {
  return cdp.evaluate(`(async () => {
    const visible = element => {
      if (!element) return false;
      const style = getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden" && element.offsetParent !== null;
    };
    localStorage.removeItem(fieldSessionArchiveStoreKey);
    const place = routeVisiblePlaces()[0];
    if (!place) throw new Error("No route place is available for the field-session producer check.");
    state.visits = state.visits.filter(visit => visit.date !== todayKey());
    state.visits.push({
      id: id(),
      placeId: place.id,
      placeName: place.name,
      workspaceId: "fitness_connection",
      date: todayKey(),
      window: "Midday",
      conversations: 1,
      leads: 1,
      units: 0,
      laterUnits: 0,
      quality: "Lead",
      notes: "Dashboard runtime producer validation.",
      location: null,
      createdAt: Date.now() - 1000
    });
    persistStateWithoutRender();
    render();
    window.confirm = () => true;
    const result = await endFieldSession(${JSON.stringify(completionAction)});
    const record = currentFinalizedFieldSession();
    const frozenReport = JSON.parse(record?.rawReportText || "{}");
    const beforeBlockedVisitCount = state.visits.length;
    openModal("quick");
    const blockedModalOpen = document.getElementById("modal")?.classList.contains("active") || false;
    const blockedSave = await persistCompletedVisitAndRefreshRoute({
      id: id(),
      placeId: place.id,
      placeName: place.name,
      workspaceId: "fitness_connection",
      date: todayKey(),
      window: "Midday",
      conversations: 0,
      leads: 0,
      units: 0,
      laterUnits: 0,
      quality: "No contact",
      notes: "Must not persist after finalization.",
      location: null,
      createdAt: Date.now()
    });
    const duplicateResult = await endFieldSession(${JSON.stringify(completionAction === "end_route" ? "end_day" : "end_route")});
    return {
      resultStatus: result?.status || "",
      recordStatus: record?.status || "",
      completionAction: record?.completionAction || "",
      attempts: Number(record?.attempts || 0),
      acknowledgment: record?.acknowledgment || null,
      frozenReportType: frozenReport.reportType || "",
      frozenReportRep: frozenReport.rep?.id || "",
      frozenVisitCount: frozenReport.visits?.length || 0,
      localRawPreserved: Boolean(record?.rawReportText),
      handoffStatus: document.getElementById("handoffStatus")?.textContent?.trim() || "",
      endRouteDisabled: document.getElementById("endRoute")?.disabled ?? null,
      endDayDisabled: document.getElementById("endDay")?.disabled ?? null,
      retryVisible: visible(document.getElementById("retryFieldSessionArchive")),
      manualExportVisible: visible(document.getElementById("exportTodayReport")),
      manualExportDisabled: document.getElementById("exportTodayReport")?.disabled ?? null,
      blockedModalOpen,
      blockedSave,
      beforeBlockedVisitCount,
      afterBlockedVisitCount: state.visits.length,
      duplicateReturnedExisting: duplicateResult?.recordKey === record?.recordKey
    };
  })()`);
}

async function verifyDecisionContextProducer(cdp) {
  return cdp.evaluate(`(async () => {
    const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
    localStorage.removeItem(fieldSessionArchiveStoreKey);
    state.visits = state.visits.filter(visit => visit.date !== todayKey());
    persistStateWithoutRender();
    render();
    const recommendation = routeRecommendation();
    const alternative = routeVisiblePlaces().find(place => place.id !== recommendation?.id);
    if (!recommendation || !alternative) throw new Error("Decision context validation requires a recommendation and an alternative business.");
    const recommendationId = routeIdentityKey(recommendation);
    const sourceIds = Object.keys(visitDecisionSourceDefinitions);
    const routeOrderBeforeEvidence = activeRouteItems().map(item => routeIdentityKey(item.place));
    const visitsBeforeEvidence = state.visits.length;
    const generated = Object.fromEntries(sourceIds.map((sourceId, index) => {
      const placeId = sourceId === "route_iq_recommendation" ? recommendation.id : alternative.id;
      return [sourceId, createVisitDecisionEvidence({
        sourceId,
        visitId: "decision-source-validation-" + index,
        placeId,
        capturedAt: "2026-07-12T18:" + String(index).padStart(2, "0") + ":00.000Z",
        recommendationPlaceId: recommendation.id,
        recommendationId,
        workspaceId: "fitness_connection"
      })];
    }));
    const unknown = createVisitDecisionEvidence({
      sourceId: "unknown",
      visitId: "decision-source-validation-unknown",
      placeId: alternative.id,
      capturedAt: "2026-07-12T18:59:00.000Z",
      recommendationPlaceId: recommendation.id,
      recommendationId,
      workspaceId: "fitness_connection"
    });
    const legacyVisit = {
      id: "legacy-decision-source-visit",
      placeId: alternative.id,
      visitDecisionSource: null,
      recommendationDecisionContext: null,
      createdAt: Date.parse("2026-07-12T17:00:00.000Z")
    };
    const legacyReportGeneratedAt = "2026-07-12T19:00:00.000Z";
    const legacyReportContext = visitDecisionContextForReport(legacyVisit, legacyReportGeneratedAt);
    let workspaceBlocked = false;
    try {
      createVisitDecisionEvidence({
        sourceId: "manual_selection",
        visitId: "decision-source-cross-workspace",
        placeId: alternative.id,
        capturedAt: Date.now(),
        workspaceId: "smoothie_depot"
      });
    } catch (error) {
      workspaceBlocked = /outside Fitness Connection/.test(error.message);
    }

    openModal("quick", { placeId: recommendation.id });
    const form = document.getElementById("quickForm");
    if (!form) throw new Error("Quick Result decision source form did not open.");
    form.elements.placeId.value = recommendation.id;
    form.querySelector('[data-quick-outcome="none"]')?.click();
    await wait(0);
    const noContactState = {
      visitsBefore: visitsBeforeEvidence,
      visitsAfterOutcomeSelection: state.visits.length,
      saveRequired: Boolean(form.querySelector('#quickCounts .btn[type="submit"]')),
      countsVisible: form.querySelector("#quickCounts")?.classList.contains("active") === true
    };
    form.querySelector('[data-quick-outcome="talk"]')?.click();
    await wait(0);
    const labels = [...form.querySelectorAll('.decision-source-option')].map(label => label.textContent.trim());
    const routeRadio = form.querySelector('[name="visitDecisionSourceId"][value="route_iq_recommendation"]');
    routeRadio.click();
    form.querySelector('[data-decision-source-skip]')?.click();
    const skipState = {
      selected: form.querySelector('[name="visitDecisionSourceId"]:checked')?.value || "unknown",
      status: form.querySelector('[data-decision-source-status]')?.textContent?.trim() || ""
    };
    routeRadio.click();
    const evidenceOnlyState = {
      routeOrderBefore: routeOrderBeforeEvidence,
      routeOrderAfter: activeRouteItems().map(item => routeIdentityKey(item.place)),
      visitsBefore: visitsBeforeEvidence,
      visitsAfter: state.visits.length,
      decisionSourceRequired: form.querySelector('[name="visitDecisionSourceId"][required]') !== null,
      capturedAtControlPresent: form.elements.namedItem("capturedAt") !== null,
      recommendationContextFields: [...form.querySelectorAll('input[type="hidden"]')]
        .map(input => input.name)
        .filter(name => name.startsWith("recommendation"))
        .sort(),
      representativeShadowOutputVisible: /shadow decision|recommendation readiness/i.test(form.innerText)
    };
    const submit = form.querySelector('#quickCounts .btn[type="submit"]');
    const modalBody = document.getElementById("modalBody");
    submit.scrollIntoView({ block: "end" });
    await wait(0);
    const submitRect = submit.getBoundingClientRect();
    const layout = {
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
      documentScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      modalOverflowY: getComputedStyle(modalBody).overflowY,
      submitTop: submitRect.top,
      submitBottom: submitRect.bottom,
      submitLeft: submitRect.left,
      submitRight: submitRect.right
    };
    form.requestSubmit();
    const deadline = Date.now() + 15000;
    while (document.getElementById("modal")?.classList.contains("active") && Date.now() < deadline) await wait(50);
    const visit = state.visits.find(item => item.date === todayKey());
    const reloaded = normalizeState(JSON.parse(localStorage.getItem(storeKey) || "{}"));
    const reloadedVisit = reloaded.repProfiles?.[activeRepId]?.visits?.find(item => item.id === visit?.id) || null;
    const activeLegacyVisit = {
      ...visit,
      id: "legacy-active-session-visit",
      placeId: alternative.id,
      placeName: alternative.name,
      visitDecisionSource: null,
      recommendationDecisionContext: null,
      createdAt: Number(visit.createdAt) + 1
    };
    state.visits.push(activeLegacyVisit);
    persistStateWithoutRender();
    const report = todayReportPayload();
    const legacyReportVisit = report.visits.find(item => item.visitId === activeLegacyVisit.id) || null;
    const legacyOriginalAfterReport = state.visits.find(item => item.id === activeLegacyVisit.id) || null;
    const completionActionsValid = ["end_route", "end_day"].every(completionAction => {
      const finalizedAt = new Date(Date.parse(report.generatedAt) + 1).toISOString();
      try {
        validateFieldSessionPayload({
          completionAction,
          workspaceId: "fitness_connection",
          operatingProfileId: "fitness",
          finalExportConfirmed: true,
          sourceFinalizedAt: finalizedAt,
          rawReportText: JSON.stringify(report)
        });
        return true;
      } catch (error) {
        return false;
      }
    });
    window.confirm = () => true;
    const archive = await endFieldSession("end_route");
    return {
      sourceIds,
      generated,
      unknown,
      labels,
      skipState,
      noContactState,
      evidenceOnlyState,
      workspaceBlocked,
      visit,
      decisionSourceKeys: Object.keys(visit?.visitDecisionSource || {}).sort(),
      recommendationContextKeys: Object.keys(visit?.recommendationDecisionContext || {}).sort(),
      capturedAtMatchesVisitCreatedAt: Date.parse(visit?.visitDecisionSource?.capturedAt || "") === Number(visit?.createdAt),
      legacyMissingContext: {
        visitDecisionSource: normalizeVisitDecisionSource(undefined),
        recommendationDecisionContext: normalizeRecommendationDecisionContext(undefined),
        reportContext: legacyReportContext,
        originalVisitUnchanged: legacyVisit.visitDecisionSource === null && legacyVisit.recommendationDecisionContext === null,
        capturedAfterOutcome: Date.parse(legacyReportContext.visitDecisionSource.capturedAt) > Number(legacyVisit.createdAt)
      },
      legacyFinalization: {
        completionActionsValid,
        reportVisit: legacyReportVisit,
        originalVisitUnchanged: legacyOriginalAfterReport?.visitDecisionSource === null && legacyOriginalAfterReport?.recommendationDecisionContext === null,
        capturedAfterOutcome: Date.parse(legacyReportVisit?.visitDecisionSource?.capturedAt || "") > Number(activeLegacyVisit.createdAt)
      },
      reloadedVisit,
      reportVisit: report.visits.find(item => item.visitId === visit?.id) || null,
      archiveStatus: archive?.status || "",
      acknowledgment: archive?.acknowledgment || null,
      layout
    };
  })()`);
}

async function verifyDecisionContextDesktopLayout(cdp) {
  return cdp.evaluate(`(() => {
    openModal("quick");
    const quickForm = document.getElementById("quickForm");
    const quickInitiallyHidden = quickForm.querySelector("#quickCounts")?.classList.contains("active") !== true;
    quickForm.querySelector('[data-quick-outcome="talk"]')?.click();
    const fieldset = quickForm.querySelector('[data-decision-source-capture]');
    const rect = fieldset?.getBoundingClientRect() || {};
    const quickCount = quickForm.querySelectorAll('.decision-source-option').length;
    const quickOptional = quickForm.querySelector('[name="visitDecisionSourceId"][required]') === null;
    closeModal();

    openModal("visit");
    const visitForm = document.getElementById("visitForm");
    const visitCount = visitForm.querySelectorAll('.decision-source-option').length;
    closeModal();

    openModal("place");
    const placeForm = document.getElementById("placeForm");
    const initialVisitFields = document.getElementById("initialVisitFields");
    const addPlaceInitiallyHidden = initialVisitFields?.hidden === true;
    placeForm.elements.recordInitialVisit.click();
    const addPlaceCount = placeForm.querySelectorAll('.decision-source-option').length;
    const addPlaceVisibleWithVisit = initialVisitFields?.hidden === false;
    const result = {
      viewportWidth: innerWidth,
      quickCount,
      visitCount,
      addPlaceCount,
      quickInitiallyHidden,
      quickOptional,
      addPlaceInitiallyHidden,
      addPlaceVisibleWithVisit,
      left: Number(rect.left || 0),
      right: Number(rect.right || 0),
      scrollWidth: document.documentElement.scrollWidth
    };
    closeModal();
    return result;
  })()`);
}

async function verifyFieldSessionRetry(cdp) {
  return cdp.evaluate(`(async () => {
    const visible = element => {
      if (!element) return false;
      const style = getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden" && element.offsetParent !== null;
    };
    localStorage.removeItem(fieldSessionArchiveStoreKey);
    const place = routeVisiblePlaces()[0];
    if (!place) throw new Error("No route place is available for the field-session retry check.");
    state.visits = state.visits.filter(visit => visit.date !== todayKey());
    state.visits.push({
      id: id(),
      placeId: place.id,
      placeName: place.name,
      workspaceId: "fitness_connection",
      date: todayKey(),
      window: "Evening",
      conversations: 1,
      leads: 0,
      units: 0,
      laterUnits: 0,
      quality: "Conversation",
      notes: "Dashboard runtime retry validation.",
      location: null,
      createdAt: Date.now() - 1000
    });
    persistStateWithoutRender();
    render();
    window.confirm = () => true;
    await endFieldSession("end_day");
    const failed = currentFinalizedFieldSession();
    const failureState = {
      status: failed?.status || "",
      attempts: Number(failed?.attempts || 0),
      retryable: failed?.retryable,
      rawReportText: failed?.rawReportText || "",
      handoffStatus: document.getElementById("handoffStatus")?.textContent?.trim() || "",
      retryVisible: visible(document.getElementById("retryFieldSessionArchive"))
    };
    await retryFieldSessionArchive();
    const archived = currentFinalizedFieldSession();
    return {
      failureState,
      finalStatus: archived?.status || "",
      attempts: Number(archived?.attempts || 0),
      rawReportUnchanged: archived?.rawReportText === failureState.rawReportText,
      acknowledgment: archived?.acknowledgment || null,
      handoffStatus: document.getElementById("handoffStatus")?.textContent?.trim() || "",
      retryVisible: visible(document.getElementById("retryFieldSessionArchive")),
      manualExportVisible: visible(document.getElementById("exportTodayReport")),
      manualExportDisabled: document.getElementById("exportTodayReport")?.disabled ?? null
    };
  })()`);
}

async function verifyPostVisitOutcomeEditing(cdp) {
  return cdp.evaluate(`(async () => {
    const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
    localStorage.removeItem(fieldSessionArchiveStoreKey);
    state.visits = state.visits.filter(visit => visit.date !== todayKey());
    state.visitCorrections = [];
    const place = routeVisiblePlaces()[0];
    if (!place) throw new Error("No route place is available for visit correction validation.");
    const seededVisitId = id();
    state.visits.push({
      id: seededVisitId,
      placeId: place.id,
      placeName: place.name,
      workspaceId: "fitness_connection",
      date: todayKey(),
      window: "Midday",
      conversations: 1,
      leads: 0,
      units: 0,
      laterUnits: 0,
      quality: "Conversation",
      notes: "Original visit evidence.",
      location: null,
      createdAt: Date.now() - 2000
    });
    persistStateWithoutRender();
    render();
    const visitId = seededVisitId;
    const originalBefore = JSON.stringify(state.visits.find(visit => visit.id === visitId));
    const routeStatsBefore = placeStats(place.id);
    setTab("places");
    const placesBefore = {
      activeView: document.querySelector(".view.active")?.id || "",
      title: document.getElementById("placesTitle")?.textContent?.trim() || "",
      cards: document.querySelectorAll("#placesList .item").length,
      viewVisitVisible: Boolean(document.querySelector('[data-view-visit="' + visitId + '"]'))
    };
    document.querySelector('[data-view-visit="' + visitId + '"]')?.click();
    const originalAuditText = document.getElementById("modalBody")?.textContent?.trim().replace(/\\s+/g, " ") || "";

    let mobileFormReachability = null;
    const submitCorrection = async values => {
      document.querySelector('[data-update-visit="' + visitId + '"]')?.click();
      const form = document.getElementById("visitCorrectionForm");
      if (!form) throw new Error("Visit correction form did not open.");
      if (!mobileFormReachability) {
        const modalBody = document.getElementById("modalBody");
        const submit = form.querySelector('button[type="submit"]');
        submit?.scrollIntoView({ block: "end" });
        await wait(0);
        const submitRect = submit?.getBoundingClientRect() || {};
        mobileFormReachability = {
          modalClientHeight: modalBody?.clientHeight || 0,
          modalScrollHeight: modalBody?.scrollHeight || 0,
          modalOverflowY: modalBody ? getComputedStyle(modalBody).overflowY : "",
          submitTop: Number(submitRect.top || 0),
          submitBottom: Number(submitRect.bottom || 0),
          submitLeft: Number(submitRect.left || 0),
          submitRight: Number(submitRect.right || 0),
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight
        };
      }
      for (const [name, value] of Object.entries(values)) {
        if (form.elements[name]) form.elements[name].value = String(value);
      }
      form.requestSubmit();
      await wait(50);
      return document.getElementById("modalBody")?.textContent?.trim().replace(/\\s+/g, " ") || "";
    };

    const firstAuditText = await submitCorrection({
      quality: "Appointment",
      leads: 1,
      appointments: 1,
      followUp: "Call tomorrow at 10 AM",
      manager: "Jordan Manager",
      contactName: "Taylor Contact",
      contactPhone: "713-555-0100",
      contactEmail: "taylor@example.com"
    });
    const firstCount = state.visitCorrections.length;
    const secondAuditText = await submitCorrection({
      quality: "Membership/Unit",
      units: 1,
      notes: "Employee came outside and completed signup."
    });
    const secondCount = state.visitCorrections.length;
    const eventIds = state.visitCorrections.map(event => event.eventId);
    const sequences = state.visitCorrections.map(event => event.sequence);
    const reloadedState = normalizeState(JSON.parse(localStorage.getItem(storeKey) || "{}"));
    const reloadedCorrections = reloadedState.repProfiles?.[activeRepId]?.visitCorrections || [];

    document.querySelector('[data-update-visit="' + visitId + '"]')?.click();
    const duplicateForm = document.getElementById("visitCorrectionForm");
    duplicateForm?.requestSubmit();
    await wait(30);
    const duplicateStatus = document.getElementById("visitCorrectionStatus")?.textContent?.trim() || "";
    const countAfterDuplicate = state.visitCorrections.length;

    openModal("visit-detail", { visitId });
    const finalAuditText = document.getElementById("modalBody")?.textContent?.trim().replace(/\\s+/g, " ") || "";
    const originalAfter = JSON.stringify(state.visits.find(visit => visit.id === visitId));
    const verified = effectiveVisitOutcome(state.visits.find(visit => visit.id === visitId));
    const routeStatsAfter = placeStats(place.id);
    const report = todayReportPayload();
    const evidence = report.visitOutcomeEvidence;
    const finalReportVisit = report.visits.find(visit => visit.visitId === visitId);

    window.confirm = () => true;
    const archiveResult = await endFieldSession("end_route");
    openModal("visit-detail", { visitId });
    const correctionButtonAfterArchive = Boolean(document.querySelector('[data-update-visit="' + visitId + '"]'));
    let archivedMutationBlocked = false;
    try {
      appendVisitCorrection(visitId, { ...verified, units: 2 });
    } catch (error) {
      archivedMutationBlocked = /Archived sessions/.test(error.message);
    }

    return {
      placesBefore,
      originalAuditText,
      firstAuditText,
      secondAuditText,
      finalAuditText,
      firstCount,
      secondCount,
      countAfterDuplicate,
      duplicateStatus,
      eventIds,
      sequences,
      reloadedCorrectionCount: reloadedCorrections.length,
      reloadedFinalOutcome: reloadedCorrections.at(-1)?.finalVerifiedOutcome || null,
      mobileFormReachability,
      originalUnchanged: originalBefore === originalAfter,
      verified,
      routeStatsBefore,
      routeStatsAfter,
      report: {
        finalVisit: finalReportVisit,
        originalVisit: evidence?.originalVisits?.find(visit => visit.visitId === visitId) || null,
        correctionCount: evidence?.correctionEvents?.length || 0,
        finalOutcome: evidence?.finalVerifiedOutcomes?.find(outcome => outcome.visitId === visitId) || null,
        auditModel: evidence?.auditModel || ""
      },
      archiveStatus: archiveResult?.status || "",
      acknowledgment: archiveResult?.acknowledgment || null,
      correctionButtonAfterArchive,
      archivedMutationBlocked,
      documentScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      viewportWidth: window.innerWidth
    };
  })()`);
}

async function verifyAddPlaceImmediateOutcomeCapture(cdp) {
  return cdp.evaluate(`(async () => {
    const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
    const visible = element => {
      if (!element) return false;
      const style = getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden" && element.offsetParent !== null;
    };
    localStorage.removeItem(fieldSessionArchiveStoreKey);
    state.visits = state.visits.filter(visit => visit.date !== todayKey());
    state.visitCorrections = [];
    state.places = state.places.filter(place => !String(place.name || "").startsWith("Immediate Outcome Harness"));
    persistStateWithoutRender();
    render();
    const addPlaceButtonVisible = visible(document.querySelector('[data-open="location"]'));
    const routeIdentityBefore = routeVisiblePlaces().map(routeIdentityKey);
    let outcomeOptions = [];
    let mobileReachability = null;

    const submitPlace = async ({ key, outcome = "", manager = "", followUp = "", notes = "" }) => {
      openModal("location");
      const form = document.getElementById("placeForm");
      if (!form) throw new Error("Add Place form did not open.");
      form.elements.name.value = "Immediate Outcome Harness " + key;
      form.elements.address.value = (1000 + key.length) + " Test Way, Houston, TX 77001";
      form.elements.category.value = "Business";
      form.elements.window.value = "Midday";
      if (!outcomeOptions.length) outcomeOptions = [...form.elements.initialOutcome.options].map(option => option.textContent.trim());
      if (outcome) {
        form.elements.recordInitialVisit.checked = true;
        form.elements.recordInitialVisit.dispatchEvent(new Event("change", { bubbles: true }));
        form.elements.initialOutcome.value = outcome;
        form.elements.initialManagerContact.value = manager;
        form.elements.initialFollowUp.value = followUp;
        form.elements.initialVisitNotes.value = notes;
      }
      if (!mobileReachability && outcome) {
        const modalBody = document.getElementById("modalBody");
        const submit = form.querySelector('button[type="submit"]');
        submit.scrollIntoView({ block: "end" });
        await wait(0);
        const rect = submit.getBoundingClientRect();
        mobileReachability = {
          fieldsVisible: !document.getElementById("initialVisitFields").hidden,
          modalClientHeight: modalBody.clientHeight,
          modalScrollHeight: modalBody.scrollHeight,
          modalOverflowY: getComputedStyle(modalBody).overflowY,
          submitTop: rect.top,
          submitBottom: rect.bottom,
          submitLeft: rect.left,
          submitRight: rect.right,
          viewportWidth: innerWidth,
          viewportHeight: innerHeight
        };
      }
      form.requestSubmit();
      form.requestSubmit();
      const deadline = Date.now() + 15000;
      while (Date.now() < deadline) {
        const modalClosed = !document.getElementById("modal").classList.contains("active");
        const status = document.getElementById("placeFormStatus")?.textContent?.trim() || "";
        if (modalClosed || status) break;
        await wait(50);
      }
      const place = state.places.find(item => item.name === "Immediate Outcome Harness " + key) || null;
      const visit = place ? state.visits.find(item => item.placeId === place.id) || null : null;
      const status = document.getElementById("placeFormStatus")?.textContent?.trim() || "";
      return { place, visit, status };
    };

    const businessOnly = await submitPlace({ key: "Business Only" });
    const conversation = await submitPlace({
      key: "Conversation",
      outcome: "conversation",
      manager: "Jordan Manager 713-555-0110",
      notes: "Initial conversation captured during business creation."
    });
    const lead = await submitPlace({ key: "Lead", outcome: "lead" });
    const membership = await submitPlace({ key: "Membership", outcome: "membership_unit" });
    const appointment = await submitPlace({ key: "Appointment", outcome: "appointment" });
    const followUp = await submitPlace({
      key: "Follow Up",
      outcome: "follow_up_required",
      followUp: "Return Wednesday at 10 AM"
    });

    const beforeExactDuplicatePlaces = state.places.length;
    const beforeExactDuplicateVisits = state.visits.length;
    const exactDuplicate = await submitPlace({ key: "Business Only" });
    const duplicateProtection = {
      status: exactDuplicate.status,
      placeCountUnchanged: state.places.length === beforeExactDuplicatePlaces,
      visitCountUnchanged: state.visits.length === beforeExactDuplicateVisits
    };
    closeModal();

    const previousWorkspace = document.body.dataset.workspaceId;
    document.body.dataset.workspaceId = "smoothie_depot";
    const beforeIsolationPlaces = state.places.length;
    const isolated = await submitPlace({ key: "Cross Workspace", outcome: "lead" });
    const workspaceIsolation = {
      status: isolated.status,
      noPlaceCreated: state.places.length === beforeIsolationPlaces && !isolated.place,
      noVisitCreated: !isolated.visit
    };
    closeModal();
    document.body.dataset.workspaceId = previousWorkspace;

    const foreignSavedPlace = {
      id: id(),
      name: "Immediate Outcome Harness Other Rep",
      category: "Business",
      window: "Midday",
      address: "1999 Other Rep Way, Houston, TX 77001",
      permission: "Unknown",
      canRevisit: true,
      repProfileId: "cruz",
      workspaceId: "fitness_connection",
      sourceType: "Dashboard Manual Entry",
      notes: "Representative ownership regression fixture.",
      createdAt: Date.now()
    };
    state.places.push(foreignSavedPlace);
    persistStateWithoutRender();
    render();

    setTab("places");
    const businessOnlyVisibleInPlaces = document.getElementById("placesList")?.textContent?.includes(businessOnly.place?.name || "") || false;
    const visitedBeforePromotion = document.querySelector('[data-places-list="visited"]')?.textContent || "";
    const savedBeforePromotion = document.querySelector('[data-places-list="saved"]')?.textContent || "";
    const savedStatusCount = document.querySelectorAll('[data-places-list="saved"] [data-saved-place] .pill.yellow').length;
    const prePromotionReport = todayReportPayload();
    const founderBeforePromotionIds = founderProductionPlaces(state.places).map(place => place.id);
    const statisticsBeforePromotionIds = placesWithVerifiedVisits(state.places, teamVisits()).map(place => place.id);
    const prePromotionIntelligenceHasSavedPlace = Boolean(activeProfile().placePerformance?.[businessOnly.place?.id]);
    openModal("quick");
    const quickForm = document.getElementById("quickForm");
    const businessOnlyVisibleInQuickResult = [...(quickForm?.elements.placeId?.options || [])]
      .some(option => option.value === businessOnly.place?.id);
    quickForm.elements.placeId.value = businessOnly.place.id;
    quickForm.querySelector('[data-quick-outcome="talk"]')?.click();
    await wait(0);
    quickForm.requestSubmit();
    const promotionDeadline = Date.now() + 15000;
    while (Date.now() < promotionDeadline && document.getElementById("modal")?.classList.contains("active")) await wait(50);
    setTab("places");
    const visitedAfterPromotion = document.querySelector('[data-places-list="visited"]')?.textContent || "";
    const savedAfterPromotion = document.querySelector('[data-places-list="saved"]')?.textContent || "";
    const founderAfterPromotionIds = founderProductionPlaces(state.places).map(place => place.id);
    const statisticsAfterPromotionIds = placesWithVerifiedVisits(state.places, teamVisits()).map(place => place.id);
    const promotionVisit = state.visits.find(visit => visit.placeId === businessOnly.place.id) || null;
    setTab("today");

    const mappedOutcomes = Object.fromEntries(Object.entries(initialPlaceVisitOutcomes).map(([key, value]) => [key, { ...value }]));
    const originalConversation = conversation.visit ? visitOutcomeSnapshot(conversation.visit) : null;
    if (conversation.visit) {
      appendVisitCorrection(conversation.visit.id, {
        ...originalConversation,
        quality: "Lead",
        leads: 1
      });
    }
    const reportBeforeArchive = todayReportPayload();
    const reloaded = normalizeState(JSON.parse(localStorage.getItem(storeKey) || "{}"));
    const reloadedVisits = reloaded.repProfiles?.[activeRepId]?.visits || [];
    const routeIdentityAfter = routeVisiblePlaces().map(routeIdentityKey);
    window.confirm = () => true;
    const archive = await endFieldSession("end_route");
    openModal("location");
    const initialVisitDisabledAfterArchive = document.getElementById("placeForm")?.elements.recordInitialVisit?.disabled === true;
    closeModal();

    return {
      addPlaceButtonVisible,
      outcomeOptions,
      mobileReachability,
      businessOnly: { place: businessOnly.place, hasVisit: Boolean(businessOnly.visit) },
      conversation: conversation.visit,
      lead: lead.visit,
      membership: membership.visit,
      appointment: appointment.visit,
      followUp: followUp.visit,
      mappedOutcomes,
      duplicateProtection,
      workspaceIsolation,
      businessOnlyVisibleInPlaces,
      businessOnlyVisibleInQuickResult,
      representativePlacesGovernance: {
        visitedBeforePromotion,
        savedBeforePromotion,
        visitedAfterPromotion,
        savedAfterPromotion,
        savedStatusCount,
        foreignSavedVisible: savedBeforePromotion.includes(foreignSavedPlace.name),
        prePromotionReportContainsSaved: prePromotionReport.visits.some(visit => visit.placeId === businessOnly.place?.id),
        founderBeforePromotionContainsSaved: founderBeforePromotionIds.includes(businessOnly.place?.id),
        statisticsBeforePromotionContainsSaved: statisticsBeforePromotionIds.includes(businessOnly.place?.id),
        prePromotionIntelligenceHasSavedPlace,
        routeBeforePromotionContainsSaved: routeIdentityBefore.includes(routeIdentityKey(businessOnly.place)),
        activePoolClassified: Boolean(businessOnly.place?.runtimePool || businessOnly.place?.googlePlaceId),
        promotionVisit,
        founderAfterPromotionContainsVisited: founderAfterPromotionIds.includes(businessOnly.place?.id),
        statisticsAfterPromotionContainsVisited: statisticsAfterPromotionIds.includes(businessOnly.place?.id)
      },
      correctionCount: state.visitCorrections.length,
      correctedConversation: conversation.visit ? effectiveVisitOutcome(conversation.visit) : null,
      report: {
        visitCount: reportBeforeArchive.visits.length,
        businessCreationCount: reportBeforeArchive.visits.filter(visit => visit.businessCreation?.source === "dashboard_add_place").length,
        correctionCount: reportBeforeArchive.visitOutcomeEvidence?.correctionEvents?.length || 0,
        conversationOriginal: reportBeforeArchive.visitOutcomeEvidence?.originalVisits?.find(visit => visit.visitId === conversation.visit?.id) || null,
        conversationFinal: reportBeforeArchive.visits.find(visit => visit.visitId === conversation.visit?.id) || null
      },
      reload: {
        initialVisitCount: reloadedVisits.filter(visit => visit.businessCreatedWithVisit).length,
        appointment: reloadedVisits.find(visit => visit.id === appointment.visit?.id) || null,
        followUp: reloadedVisits.find(visit => visit.id === followUp.visit?.id) || null
      },
      routePoolUnchanged: JSON.stringify(routeIdentityBefore) === JSON.stringify(routeIdentityAfter),
      archiveStatus: archive?.status || "",
      acknowledgment: archive?.acknowledgment || null,
      initialVisitDisabledAfterArchive,
      documentScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      viewportWidth: innerWidth
    };
  })()`);
}

async function verifyDesktopRepresentativePlaces(cdp) {
  return cdp.evaluate(`(() => {
    const savedPlace = {
      id: id(),
      name: "Desktop Saved Places Harness",
      category: "Business",
      window: "Midday",
      address: "1888 Desktop Test Way, Houston, TX 77001",
      permission: "Unknown",
      canRevisit: true,
      repProfileId: activeRepId,
      workspaceId: "fitness_connection",
      sourceType: "Dashboard Manual Entry",
      notes: "Desktop rendering regression fixture.",
      createdAt: Date.now()
    };
    state.places.push(savedPlace);
    persistStateWithoutRender();
    render();
    setTab("places");
    const visited = document.querySelector('[data-places-section="visited"]');
    const saved = document.querySelector('[data-places-section="saved"]');
    const savedCard = document.querySelector('[data-saved-place="' + savedPlace.id + '"]');
    const result = {
      viewportWidth: innerWidth,
      title: document.getElementById("placesTitle")?.textContent?.trim() || "",
      visitedHeading: visited?.querySelector("h3")?.textContent?.trim() || "",
      savedHeading: saved?.querySelector("h3")?.textContent?.trim() || "",
      savedText: savedCard?.textContent?.trim().replace(/\\s+/g, " ") || "",
      savedLeft: savedCard?.getBoundingClientRect().left || 0,
      savedRight: savedCard?.getBoundingClientRect().right || 0,
      visitedCount: visited?.querySelectorAll(".item").length || 0,
      savedCount: saved?.querySelectorAll(".item").length || 0
    };
    state.places = state.places.filter(place => place.id !== savedPlace.id);
    persistStateWithoutRender();
    render();
    return result;
  })()`);
}

async function runPageScenario(chrome, server, path, name, options = {}) {
  const eventLog = { runtimeExceptions: [], consoleErrors: [], logErrors: [], network: [] };
  const cdp = await attachPage(chrome, eventLog);
  try {
    await setViewport(cdp, options.viewport);
    await setStandaloneMode(cdp, options.standalone);
    const url = `${server.origin}${path}`;
    await navigateAndWait(cdp, url);
    const routeLoadMs = await waitForDashboardReady(cdp, 60000);
    const initial = await snapshot(cdp);
    return { name, cdp, eventLog, routeLoadMs, initial };
  } catch (error) {
    cdp.close();
    throw new Error(`${error.message}; events=${JSON.stringify(eventLog)}`);
  }
}

async function navigateExistingScenario(cdp, server, path) {
  await navigateAndWait(cdp, `${server.origin}${path}`);
  await waitForDashboardReady(cdp, 60000);
  return snapshot(cdp);
}

function verifyMobileFit(label, fit) {
  const scrollFits = fit.docScrollWidth <= fit.viewportWidth + 1 && fit.bodyScrollWidth <= fit.viewportWidth + 1;
  const controlsFit = Object.values(fit.rects).every(rect => !rect?.visible || (rect.left >= -1 && rect.right <= fit.viewportWidth + 1));
  const detail = `${fit.activeView}: viewport ${fit.viewportWidth}px, doc ${fit.docScrollWidth}px, body ${fit.bodyScrollWidth}px`;
  assertWorkflow(label, scrollFits && controlsFit && fit.offenders.length === 0, detail, JSON.stringify(fit));
}

function verifyRepOnly(label, snap) {
  const repOnly = snap.sessionRole === "rep"
    && snap.mode === "rep"
    && snap.activeRepId === "anthony"
    && snap.visibleTabs.join(",") === "today,route,places"
    && snap.visibleOwnerControls.length === 0
    && snap.profileButtonLabels.length === 0
    && !snap.modeButtonLabels.includes("Owner");
  assertWorkflow(label, repOnly, `role ${snap.sessionRole}, mode ${snap.mode}, rep ${snap.activeRepId}, tabs ${snap.visibleTabs.join(", ")}`, JSON.stringify(snap));
}

function verifyOperatingProfileVocabulary(label, snap, expected) {
  const combinedText = `${snap.todayText} ${snap.routeText} ${snap.placesText} ${snap.statsText}`;
  const hasExpectedTerms = expected.terms.every(term => combinedText.includes(term));
  const detail = `${snap.operatingProfileId}: ${expected.terms.join(", ")}`;
  assertWorkflow(
    label,
    snap.operatingProfileId === expected.profileId
      && snap.debug.operatingProfile?.profileId === expected.profileId
      && snap.debug.operatingProfile?.source?.includes(expected.profileId)
      && hasExpectedTerms
      && snap.debug.operatingProfile?.scoringChanged === false
      && snap.debug.operatingProfile?.activePoolChanged === false
      && snap.debug.operatingProfile?.mobileBetaChanged === false,
    detail,
    JSON.stringify({
      expected,
      operatingProfileId: snap.operatingProfileId,
      operatingProfile: snap.debug.operatingProfile,
      todayText: snap.todayText.slice(0, 500),
      routeText: snap.routeText.slice(0, 500),
      statsText: snap.statsText.slice(0, 500)
    })
  );
}

function verifyNoErrors(label, eventLog, snap, { allow = [] } = {}) {
  const allErrors = [
    ...eventLog.runtimeExceptions,
    ...eventLog.consoleErrors,
    ...eventLog.logErrors,
    snap.debug.lastError,
    snap.debug.lastUnhandledRejection
  ].filter(Boolean).filter(error => !allow.some(pattern => error.includes(pattern)));
  assertWorkflow(`${label} JavaScript console/runtime errors`, allErrors.length === 0, "no page runtime or console errors", allErrors.join(" | "));
}

async function waitForProspectiveRequests(server, count, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (server.prospectiveRequests.length >= count) return;
    await wait(25);
  }
  throw new Error(`Expected ${count} prospective requests, received ${server.prospectiveRequests.length}.`);
}

async function verifyProspectiveShadowDashboardSeam(scenario, server) {
  await waitForProspectiveRequests(server, 1);
  const beforeCount = server.prospectiveRequests.length;
  const browserResult = await scenario.cdp.evaluate(`(async () => {
    const anchor = document.getElementById("bestMoveDirections");
    if (!anchor || !anchor.href || anchor.getAttribute("href") === "#") {
      throw new Error("The governed rank-one Directions action is unavailable.");
    }
    const marker = "DO_NOT_EXPOSE_SHADOW_PAYLOAD";
    const before = {
      bestNextMove: document.getElementById("bestNextMove")?.textContent?.trim() || "",
      routeQueueIds: activeProfile().activeRouteQueue?.entries?.map(entry => entry.identityKey) || [],
      visitCount: state.visits.length,
      modalActive: document.getElementById("modal")?.classList.contains("active") || false,
      activeView: document.querySelector(".view.active")?.id || ""
    };
    anchor.addEventListener("click", event => event.preventDefault(), { once: true });
    anchor.click();
    await new Promise(resolve => setTimeout(resolve, 100));
    const databaseNames = typeof indexedDB.databases === "function"
      ? (await indexedDB.databases()).map(database => database.name || "")
      : [];
    const cacheNames = typeof caches?.keys === "function" ? await caches.keys() : [];
    const localValues = Object.values(localStorage);
    const sessionValues = Object.values(sessionStorage);
    const bodyText = document.body.textContent || "";
    const debugText = JSON.stringify(window.prometheusDebugState || {});
    return {
      before,
      after: {
        bestNextMove: document.getElementById("bestNextMove")?.textContent?.trim() || "",
        routeQueueIds: activeProfile().activeRouteQueue?.entries?.map(entry => entry.identityKey) || [],
        visitCount: state.visits.length,
        modalActive: document.getElementById("modal")?.classList.contains("active") || false,
        activeView: document.querySelector(".view.active")?.id || ""
      },
      markerVisible: bodyText.includes(marker),
      markerInDebug: debugText.includes(marker),
      markerInStorage: localValues.concat(sessionValues, databaseNames, cacheNames).some(value => String(value).includes(marker)),
      databaseNames,
      cacheNames,
      shadowTermsVisible: /shadow decision|shadow probability|shadow confidence|recommendation readiness/i.test(bodyText)
    };
  })()`);
  await waitForProspectiveRequests(server, beforeCount + 1);
  return {
    browserResult,
    requests: server.prospectiveRequests.slice(),
    actionRequestsAdded: server.prospectiveRequests.length - beforeCount
  };
}

function verifyRuntimePerformance(activeSnap, activeRouteLoadMs) {
  const activeBytes = statSync(resolve(dashboardRoot, activePoolPath)).size;
  const fullBytes = statSync(resolve(dashboardRoot, fullPoolPath)).size;
  const activeStarted = performance.now();
  JSON.parse(readFileSync(resolve(dashboardRoot, activePoolPath), "utf8"));
  const activeParseMs = performance.now() - activeStarted;
  const fullStarted = performance.now();
  JSON.parse(readFileSync(resolve(dashboardRoot, fullPoolPath), "utf8"));
  const fullParseMs = performance.now() - fullStarted;
  const activeResourceMs = activeSnap.performance.activeResourceDuration;
  const detail = `active ${activeBytes} bytes/${activeParseMs.toFixed(1)}ms parse/${activeResourceMs}ms fetch, full ${fullBytes} bytes/${fullParseMs.toFixed(1)}ms parse, route ready ${activeRouteLoadMs}ms, nav ${activeSnap.performance.navigationDuration}ms`;
  assertWorkflow("Route loading performance regressions", activeBytes < fullBytes && activeResourceMs < 5000 && activeRouteLoadMs < 60000, detail, detail);
}

async function runHarness() {
  const server = await startStaticServer();
  const fallbackServer = await startStaticServer({ missingActive: true });
  const fieldSessionServer = await startStaticServer();
  const fieldSessionRetryServer = await startStaticServer({
    fieldSessionResponses: [
      { status: 503, code: "field_session_store_unavailable", retryable: true },
      { status: 201 }
    ]
  });
  const visitCorrectionServer = await startStaticServer();
  const addPlaceServer = await startStaticServer();
  const decisionContextServer = await startStaticServer();
  const prospectiveServer = await startStaticServer({
    prospectiveResponse: {
      status: 202,
      body: {
        marker: "DO_NOT_EXPOSE_SHADOW_PAYLOAD",
        rankedCandidates: ["must-not-reach-the-representative"],
        probability: 0.99,
        confidence: "must-not-reach-the-representative"
      }
    }
  });
  const prospectiveOffServer = await startStaticServer({ prospectiveResponse: { status: 204 } });
  const prospectiveFailureServer = await startStaticServer({
    prospectiveResponse: {
      status: 503,
      body: { marker: "DO_NOT_EXPOSE_SHADOW_PAYLOAD", code: "prospective_runtime_unavailable" }
    }
  });
  const chrome = await launchChrome();

  try {
    const switcher = await runPageScenario(chrome, server, "/?role=founder&debug=1&harness=workspace-switcher", "workspace-switcher");
    const switcherSnap = switcher.initial;
    assertWorkflow("Founder workspace default", switcherSnap.workspaceId === "fitness_connection" && switcherSnap.workspaceOperatingProfileId === "fitness" && switcherSnap.activeWorkspaceButtons.includes("fitness_connection"), `workspace ${switcherSnap.workspaceId}, profile ${switcherSnap.workspaceOperatingProfileId}`, JSON.stringify({ workspaceId: switcherSnap.workspaceId, workspaceName: switcherSnap.workspaceName, activeWorkspaceButtons: switcherSnap.activeWorkspaceButtons, debug: switcherSnap.debug.workspace }));
    assertWorkflow("Founder workspace switcher visible", switcherSnap.workspaceButtonLabels.some(label => label.includes("Fitness Connection")) && switcherSnap.workspaceButtonLabels.some(label => label.includes("Smoothie Depot")), switcherSnap.workspaceButtonLabels.join(" | "), JSON.stringify(switcherSnap.workspaceButtonLabels));
    await clickWorkspace(switcher.cdp, "smoothie_depot");
    await waitForPath(switcher.cdp, "/smoothie-depot-dashboard/");
    const smoothieRouteSnap = await switcher.cdp.evaluate(`(() => ({
      pathname: location.pathname,
      workspaceId: document.body.dataset.workspaceId || "",
      operatingProfileId: document.body.dataset.operatingProfileId || "",
      owner: document.body.dataset.dashboardOwner || "",
      jrAccess: document.body.dataset.jrAccess || "",
      hasOperationsCenter: document.body.textContent.includes("Executive Intelligence Operations Center"),
      hasOpenPackage: document.body.textContent.includes("Open Executive Intelligence Package"),
      hasFounderReview: document.body.textContent.includes("Founder Review"),
      hasExportWorkflow: document.body.textContent.includes("Export Professional Executive Package"),
      hasIntelligenceLibrary: document.body.textContent.includes("Intelligence Library"),
      hasLocalNotes: document.body.textContent.includes("Local Founder Notes"),
      hasExecutivePackage: document.body.textContent.includes("Nutrition Depot Executive Intelligence Package v2"),
      hasFixturePipeline: document.body.textContent.includes("Candidate Pipeline"),
      hasSalesCommissionForecast: document.body.textContent.includes("Commission Forecast"),
      hasFitnessRuntimeTerms: /Units|Memberships|Territories/.test(document.body.textContent)
    }))()`);
    assertWorkflow("Founder workspace switcher Smoothie Depot route", smoothieRouteSnap.pathname === "/smoothie-depot-dashboard/" && smoothieRouteSnap.workspaceId === "smoothie_depot" && smoothieRouteSnap.operatingProfileId === "franchise_development" && smoothieRouteSnap.owner === "cruz" && smoothieRouteSnap.jrAccess === "false", `${smoothieRouteSnap.pathname} workspace ${smoothieRouteSnap.workspaceId}`, JSON.stringify(smoothieRouteSnap));
    assertWorkflow("Smoothie Depot workspace isolation from Fitness runtime", smoothieRouteSnap.hasOperationsCenter && smoothieRouteSnap.hasOpenPackage && smoothieRouteSnap.hasFounderReview && smoothieRouteSnap.hasExportWorkflow && smoothieRouteSnap.hasIntelligenceLibrary && smoothieRouteSnap.hasLocalNotes && smoothieRouteSnap.hasExecutivePackage && !smoothieRouteSnap.hasFixturePipeline && !smoothieRouteSnap.hasSalesCommissionForecast && !smoothieRouteSnap.hasFitnessRuntimeTerms, "operations center, package lifecycle, export, library, local notes, and Executive Intelligence Package visible without CRM sales workflow or Fitness runtime terms", JSON.stringify(smoothieRouteSnap));
    switcher.cdp.close();

    const founder = await runPageScenario(chrome, server, "/?role=founder&debug=1&harness=runtime-workflows-founder", "founder");
    const founderSnap = founder.initial;
    assertWorkflow("Founder Mode", founderSnap.sessionRole === "founder" && founderSnap.mode === "owner" && founderSnap.visibleTabs.includes("places") && founderSnap.visibleTabs.includes("stats") && founderSnap.visibleTabs.includes("find"), `owner tabs visible: ${founderSnap.visibleTabs.join(", ")}`, JSON.stringify({ sessionRole: founderSnap.sessionRole, mode: founderSnap.mode, visibleTabs: founderSnap.visibleTabs }));
    verifyOperatingProfileVocabulary("Operating Profile Fitness default preserved", founderSnap, { profileId: "fitness", terms: ["Units Today", "Conversations", "Leads", "Fitness Route", "Verified Units"] });
    assertWorkflow("Active Pool consumption", founderSnap.debug.runtimeDataPool === "active" && founderSnap.debug.runtimeDataSource.includes("runtime-pool-segmentation-v1 active") && founderSnap.debug.runtimeDataSource.includes("594 route records"), founderSnap.debug.runtimeDataSource, JSON.stringify(founderSnap.debug));
    assertWorkflow("Route Intelligence rendering", founderSnap.debug.rendererReceived && founderSnap.bestNextMove && founderSnap.bestNextMove !== "Loading route signal" && founderSnap.dailyRouteCards > 0, `${founderSnap.bestNextMove} with ${founderSnap.dailyRouteCards} daily route cards`, JSON.stringify({ bestNextMove: founderSnap.bestNextMove, dailyRouteCards: founderSnap.dailyRouteCards, debug: founderSnap.debug }));
    assertWorkflow("Directions link generation", founderSnap.bestMoveDirections.startsWith("https://www.google.com/maps/dir/?api=1&destination=") && founderSnap.bestMoveDirections.includes("destination_place_id="), founderSnap.bestMoveDirections, founderSnap.bestMoveDirections);
    assertWorkflow("Discovery Mode", founderSnap.todayText.includes("Discovery Mode") || founderSnap.routeRisk.includes("Discovery Mode") || founderSnap.statsText.includes("Discovery Mode"), founderSnap.routeRisk || "Discovery Mode visible in runtime text", JSON.stringify({ routeRisk: founderSnap.routeRisk, todayText: founderSnap.todayText.slice(0, 300) }));
    assertWorkflow("Prospective Founder/owner isolation", server.prospectiveRequests.length === 0, "Founder and owner route rendering produced no prospective signal", JSON.stringify(server.prospectiveRequests));
    verifyNoErrors("Founder", founder.eventLog, founderSnap);

    const prospective = await runPageScenario(chrome, prospectiveServer, "/?role=rep&rep=anthony&debug=1&harness=prospective-shadow-seam", "prospective-shadow-seam", {
      standalone: true,
      viewport: { width: 390, height: 844, deviceScaleFactor: 3, mobile: true }
    });
    const prospectiveResult = await verifyProspectiveShadowDashboardSeam(prospective, prospectiveServer);
    const prospectiveTrigger = prospectiveResult.requests.find(request => request.payload?.eventKind === "next_stop_requested");
    const prospectiveActions = prospectiveResult.requests.filter(request => request.payload?.eventKind === "representative_action_observed");
    const allowedPayloadKeys = ["eventKind", "informationalObservedAt", "informationalSequence"];
    assertWorkflow("Prospective next-stop opportunity boundary", prospectiveResult.requests[0]?.payload?.eventKind === "next_stop_requested" && prospectiveTrigger?.method === "POST", "the first signal follows governed route-queue generation", JSON.stringify(prospectiveResult.requests));
    assertWorkflow("Prospective rank-one representative action boundary", prospectiveActions.length === 1 && prospectiveResult.actionRequestsAdded === 1, "one click on Best Next Move Directions emitted one representative action signal", JSON.stringify(prospectiveResult.requests));
    assertWorkflow("Prospective strict opaque payload", prospectiveResult.requests.every(request => JSON.stringify(Object.keys(request.payload || {}).sort()) === JSON.stringify(allowedPayloadKeys) && request.bytes <= 256) && prospectiveTrigger?.payload?.informationalSequence === 1 && prospectiveActions[0]?.payload?.informationalSequence === 2, "payload contains only eventKind and informational sequence/time", JSON.stringify(prospectiveResult.requests));
    assertWorkflow("Prospective shadow response invisibility", !prospectiveResult.browserResult.markerVisible && !prospectiveResult.browserResult.markerInDebug && !prospectiveResult.browserResult.markerInStorage && !prospectiveResult.browserResult.shadowTermsVisible, "malicious shadow-shaped response reached no DOM, debug state, browser storage, IndexedDB, or cache", JSON.stringify(prospectiveResult.browserResult));
    assertWorkflow("Prospective zero influence", JSON.stringify(prospectiveResult.browserResult.before) === JSON.stringify(prospectiveResult.browserResult.after), "rank-one action signal changed no route, visit, modal, or view state", JSON.stringify(prospectiveResult.browserResult));
    verifyMobileFit("Prospective mobile/PWA rendering", await mobileFitSnapshot(prospective.cdp));
    verifyNoErrors("Prospective opaque seam", prospective.eventLog, await snapshot(prospective.cdp));

    const prospectiveOff = await runPageScenario(chrome, prospectiveOffServer, "/?role=rep&rep=anthony&debug=1&harness=prospective-shadow-off", "prospective-shadow-off");
    const prospectiveOffResult = await verifyProspectiveShadowDashboardSeam(prospectiveOff, prospectiveOffServer);
    assertWorkflow("Prospective default-OFF isolation", prospectiveOffResult.requests.length === 2 && JSON.stringify(prospectiveOffResult.browserResult.before) === JSON.stringify(prospectiveOffResult.browserResult.after), "204/OFF responses were ignored without changing the representative workflow", JSON.stringify(prospectiveOffResult));
    verifyNoErrors("Prospective default-OFF", prospectiveOff.eventLog, await snapshot(prospectiveOff.cdp));

    const prospectiveFailure = await runPageScenario(chrome, prospectiveFailureServer, "/?role=rep&rep=anthony&debug=1&harness=prospective-shadow-failure", "prospective-shadow-failure");
    const prospectiveFailureResult = await verifyProspectiveShadowDashboardSeam(prospectiveFailure, prospectiveFailureServer);
    assertWorkflow("Prospective failure isolation", prospectiveFailureResult.requests.length === 2 && JSON.stringify(prospectiveFailureResult.browserResult.before) === JSON.stringify(prospectiveFailureResult.browserResult.after), "503 responses were ignored without blocking route generation or Directions", JSON.stringify(prospectiveFailureResult));
    verifyNoErrors("Prospective failure isolation", prospectiveFailure.eventLog, await snapshot(prospectiveFailure.cdp), {
      allow: ["server responded with a status of 503"]
    });
    prospective.cdp.close();
    prospectiveOff.cdp.close();
    prospectiveFailure.cdp.close();

    for (const expected of [
      { profileId: "general_outside_sales", terms: ["Opportunities Today", "Appointments", "Leads", "Outside Sales Route", "Verified Opportunities"] },
      { profileId: "roofing", terms: ["Contracts Today", "Inspections", "Leads", "Roofing Route", "Verified Contracts"] },
      { profileId: "security", terms: ["Contracts Today", "Site Surveys", "Security Prospects", "Security Route", "Verified Contracts"] },
      { profileId: "medical", terms: ["Partnerships Today", "Meetings", "Referrals", "Medical Route", "Verified Partnerships"] }
    ]) {
      const profileScenario = await runPageScenario(chrome, server, `/?role=founder&debug=1&operatingProfile=${expected.profileId}&harness=operating-profile-${expected.profileId}`, `operating-profile-${expected.profileId}`);
      verifyOperatingProfileVocabulary(`Operating Profile ${expected.profileId} vocabulary`, profileScenario.initial, expected);
      verifyNoErrors(`Operating Profile ${expected.profileId}`, profileScenario.eventLog, profileScenario.initial);
      profileScenario.cdp.close();
    }

    await clickTab(founder.cdp, "route");
    const routeSnap = await snapshot(founder.cdp);
    assertWorkflow("Build Route workflow", routeSnap.activeView === "view-route" && routeSnap.routeCards > 0 && /Route/.test(routeSnap.routeText), `${routeSnap.routeCards} route cards rendered`, JSON.stringify({ activeView: routeSnap.activeView, routeCards: routeSnap.routeCards, routeText: routeSnap.routeText.slice(0, 300) }));
    assertWorkflow("Beta Route Controls Owner 15-location route generation", routeSnap.routeCards === 15 && routeSnap.routeCountLabel.includes("15 active stops"), `${routeSnap.routeCards} route cards rendered; ${routeSnap.routeCountLabel}`, JSON.stringify({ routeCards: routeSnap.routeCards, routeCountLabel: routeSnap.routeCountLabel }));
    const businessHoursRuntime = await verifyRouteBusinessHoursRuntime(founder.cdp);
    assertWorkflow("Route IQ governed business-hours artifact consumption", businessHoursRuntime.artifactAvailable && businessHoursRuntime.recordCount === 398 && businessHoursRuntime.debug.status === "ready" && businessHoursRuntime.debug.scoringChanged === false, `${businessHoursRuntime.recordCount} governed hours records loaded`, JSON.stringify(businessHoursRuntime));
    assertWorkflow("Route IQ Christian Brothers closed-now field regression", businessHoursRuntime.christianPermanentStatus === "OPERATIONAL" && businessHoursRuntime.fieldDecision?.status === "CLOSED_VERIFIED" && businessHoursRuntime.fieldDecision?.eligible === false && businessHoursRuntime.fieldDecision?.reasonCode === "VERIFIED_CURRENT_WINDOW_CLOSED" && businessHoursRuntime.fieldQueueIds.length === 1 && businessHoursRuntime.fieldQueueIds[0] === businessHoursRuntime.fieldQueueOpenAlternativeId, `Christian Brothers excluded and ${businessHoursRuntime.fieldQueueOpenAlternativeId} selected`, JSON.stringify(businessHoursRuntime));
    assertWorkflow("Route IQ active queue closed-now exclusion", businessHoursRuntime.queueCount === 15 && !businessHoursRuntime.queueStatuses.includes("CLOSED_VERIFIED") && businessHoursRuntime.queueStatuses.every(Boolean) && !businessHoursRuntime.queueScoringChanged, `${businessHoursRuntime.queueCount} queued stops; 0 verified-closed; score weights unchanged`, JSON.stringify(businessHoursRuntime));
    assertWorkflow("Route IQ mobile-compatible hours explainability", businessHoursRuntime.routeCardCount === 15 && !businessHoursRuntime.routeCardStatuses.includes("CLOSED_VERIFIED") && businessHoursRuntime.routeCardStatuses.every(Boolean) && businessHoursRuntime.routeText.includes("Business-hours eligibility") && (businessHoursRuntime.queueUnverifiedCount === 0 || businessHoursRuntime.routeCardMarkers.filter(marker => marker === "HOURS_NOT_VERIFIED").length === businessHoursRuntime.queueUnverifiedCount), `${businessHoursRuntime.routeCardCount} route cards expose additive hours status`, JSON.stringify(businessHoursRuntime));
    const ownerNearbyBadge = await verifyRouteNearbyInteraction(founder.cdp);
    assertWorkflow("Beta Route Controls Owner Nearby opens context", ownerNearbyBadge.tagName === "button" && ownerNearbyBadge.nearbyPlace && ownerNearbyBadge.after.modalActive && ownerNearbyBadge.modalTitle === "Nearby Context" && /Nearby Context|walkable|Directions|No verified/.test(ownerNearbyBadge.modalText), `${ownerNearbyBadge.text} opened ${ownerNearbyBadge.modalTitle}`, JSON.stringify(ownerNearbyBadge));

    await clickTab(founder.cdp, "today");
    const territoryPolicy = await verifyTerritoryPermissionModel(founder.cdp);
    assertWorkflow("Beta Stability Sprint 2 territory owner permission model", territoryPolicy.afterOwner.assignedRadiusMiles === 5 && territoryPolicy.afterOwner.allowedRadiusMiles === 10 && territoryPolicy.afterOwner.allowRepRadiusChanges === true && territoryPolicy.afterOwner.lockAssignedRadius === false && territoryPolicy.ownerStatus.includes("rep changes allowed"), territoryPolicy.ownerStatus, JSON.stringify(territoryPolicy));
    assertWorkflow("Beta Stability Sprint 2 territory rep allowed adjustment", territoryPolicy.repDisabledBefore === false && territoryPolicy.afterRep.assignedRadiusMiles === 10 && territoryPolicy.repStatus.includes("Rep adjustment allowed"), territoryPolicy.repStatus, JSON.stringify(territoryPolicy));

    await clickTab(founder.cdp, "places");
    const placesSnap = await snapshot(founder.cdp);
    assertWorkflow("Places initial loading perception", placesSnap.activeView === "view-places" && placesSnap.placesItems > 0 && placesSnap.placesText.includes("Production Map") && Number(placesSnap.debug.placesRender.initialMs || 0) < 1000, `${placesSnap.placesItems}/${placesSnap.debug.placesRender.total || "?"} places visible in ${placesSnap.debug.placesRender.initialMs || 0}ms`, JSON.stringify({ activeView: placesSnap.activeView, placesItems: placesSnap.placesItems, placesRender: placesSnap.debug.placesRender }));
    const placesComplete = await waitForPlacesRenderComplete(founder.cdp);
    assertWorkflow("Places full loading completion", placesComplete.complete && placesComplete.visibleCards === placesComplete.total && placesComplete.durationMs < 8000, `${placesComplete.visibleCards}/${placesComplete.total} places rendered in ${placesComplete.durationMs}ms`, JSON.stringify(placesComplete));

    await clickTab(founder.cdp, "stats");
    const statsSnap = await snapshot(founder.cdp);
    assertWorkflow("Insights rendering", statsSnap.activeView === "view-stats" && statsSnap.statsText.includes("Executive Insight") && statsSnap.statsText.includes("Learning"), "Executive Insight and learning panels rendered", JSON.stringify({ activeView: statsSnap.activeView, statsText: statsSnap.statsText.slice(0, 300) }));

    await clickTab(founder.cdp, "find");
    const findSnap = await snapshot(founder.cdp);
    assertWorkflow("Find/Search functionality", findSnap.activeView === "view-find" && findSnap.findText.includes("Find Places") && (findSnap.searchItems > 0 || findSnap.targetIdeas > 0), `${findSnap.searchItems} searches and ${findSnap.targetIdeas} target ideas rendered`, JSON.stringify({ activeView: findSnap.activeView, searchItems: findSnap.searchItems, targetIdeas: findSnap.targetIdeas }));
    assertWorkflow("Beta Route Controls Eventbrite expansion", findSnap.eventCards >= 6 && findSnap.eventText.includes("Access:") && findSnap.eventText.includes("Open map") && findSnap.eventText.includes("Add"), `${findSnap.eventCards} event cards rendered`, JSON.stringify({ eventCards: findSnap.eventCards, eventText: findSnap.eventText.slice(0, 800) }));

    const mobileFounder = await runPageScenario(chrome, server, "/?role=founder&rep=cruz&debug=1&pwa=founder&harness=mobile-founder-fit", "mobile-founder", {
      viewport: { width: 390, height: 844, deviceScaleFactor: 3, mobile: true }
    });
    const mobileFounderSnap = mobileFounder.initial;
    assertWorkflow("Mobile Founder Owner controls", mobileFounderSnap.sessionRole === "founder" && mobileFounderSnap.mode === "owner" && mobileFounderSnap.activeRepId === "cruz" && mobileFounderSnap.visibleTabs.length === 5, `role ${mobileFounderSnap.sessionRole}, mode ${mobileFounderSnap.mode}, rep ${mobileFounderSnap.activeRepId}, tabs ${mobileFounderSnap.visibleTabs.join(", ")}`, JSON.stringify(mobileFounderSnap));
    verifyMobileFit("Mobile PWA Today no-horizontal-scroll", await mobileFitSnapshot(mobileFounder.cdp));
    await clickTab(mobileFounder.cdp, "route");
    verifyMobileFit("Mobile PWA Route no-horizontal-scroll", await mobileFitSnapshot(mobileFounder.cdp));
    await clickTab(mobileFounder.cdp, "places");
    verifyMobileFit("Mobile PWA Places no-horizontal-scroll", await mobileFitSnapshot(mobileFounder.cdp));
    await clickTab(mobileFounder.cdp, "stats");
    verifyMobileFit("Mobile PWA Insights no-horizontal-scroll", await mobileFitSnapshot(mobileFounder.cdp));
    await clickTab(mobileFounder.cdp, "find");
    verifyMobileFit("Mobile PWA Find no-horizontal-scroll", await mobileFitSnapshot(mobileFounder.cdp));
    verifyNoErrors("Mobile Founder", mobileFounder.eventLog, await snapshot(mobileFounder.cdp));

    const rep = await runPageScenario(chrome, server, "/?role=rep&rep=anthony&debug=1&harness=runtime-workflows-rep", "rep");
    const repSnap = rep.initial;
    assertWorkflow("Rep Mode", repSnap.sessionRole === "rep" && repSnap.mode === "rep" && repSnap.visibleTabs.includes("places") && !repSnap.visibleTabs.includes("stats") && !repSnap.visibleTabs.includes("find"), `rep tabs visible: ${repSnap.visibleTabs.join(", ")}`, JSON.stringify({ sessionRole: repSnap.sessionRole, mode: repSnap.mode, visibleTabs: repSnap.visibleTabs }));
    assertWorkflow("Add Place desktop availability", repSnap.todayText.includes("Add Place"), "representative Add Place command visible on desktop", JSON.stringify({ todayText: repSnap.todayText.slice(0, 500) }));
    assertWorkflow("Beta Stability Sprint 2 Rep radius/ring visibility", repSnap.territoryVisible && repSnap.territoryRingCount > 0 && repSnap.territoryText.includes("Assigned Territory Radius") && repSnap.territoryText.includes("Ring"), `${repSnap.territoryRingCount} territory rings visible for ${repSnap.activeRepId}`, JSON.stringify({ territoryVisible: repSnap.territoryVisible, territoryRingCount: repSnap.territoryRingCount, territoryText: repSnap.territoryText.slice(0, 400) }));
    assertWorkflow("Beta Route Controls Rep radius adjustable by default", repSnap.territoryRepRadiusVisible && repSnap.territoryRepRadiusDisabled === false && repSnap.territoryRepRadiusStatus.includes("Rep adjustment allowed") && repSnap.debug.territoryCoverage.assignedRadiusMiles === 25 && repSnap.debug.territoryCoverage.allowedRadiusMiles === 25 && repSnap.debug.territoryCoverage.repCanAdjust === true, repSnap.territoryRepRadiusStatus, JSON.stringify({ territoryRepRadiusVisible: repSnap.territoryRepRadiusVisible, territoryRepRadiusDisabled: repSnap.territoryRepRadiusDisabled, status: repSnap.territoryRepRadiusStatus, coverage: repSnap.debug.territoryCoverage }));
    assertWorkflow("Beta Route Controls ring explanation", Array.isArray(repSnap.debug.territoryCoverage.ringTotals) && repSnap.debug.territoryCoverage.ringTotals[0] > 0 && repSnap.debug.territoryCoverage.routeUsesOnlyRingOne === true && repSnap.debug.territoryCoverage.outerRingEmptyReason.includes("Populate outer rings") && repSnap.territoryRingTexts.some(text => text.includes("Add verified Google-qualified businesses")), repSnap.debug.territoryCoverage.outerRingEmptyReason, JSON.stringify({ coverage: repSnap.debug.territoryCoverage, ringTexts: repSnap.territoryRingTexts }));
    assertWorkflow("Rep startup defers owner-only views", repSnap.placesItems === 0 && repSnap.debug.deferredOwnerViews.places === false && repSnap.debug.deferredOwnerViews.stats === false && repSnap.debug.deferredOwnerViews.find === false, `owner-only views deferred; render total ${repSnap.debug.renderTimings.total || 0}ms`, JSON.stringify({ placesItems: repSnap.placesItems, renderTimings: repSnap.debug.renderTimings, deferredOwnerViews: repSnap.debug.deferredOwnerViews }));
    await rep.cdp.evaluate(`setTab("stats")`);
    const repAfterOwnerTab = await snapshot(rep.cdp);
    assertWorkflow("Rep owner-tab guard", repAfterOwnerTab.activeView === "view-today", "rep remains on Today when owner tab is requested", JSON.stringify({ activeView: repAfterOwnerTab.activeView }));
    assertWorkflow("Rep route quality", repSnap.debug.rendererReceived && repSnap.bestNextMove && repSnap.bestMoveDirections.includes("destination_place_id=") && repSnap.dailyRouteCards > 0, `${repSnap.bestNextMove} with Google Place directions and ${repSnap.dailyRouteCards} route cards`, JSON.stringify({ bestNextMove: repSnap.bestNextMove, directions: repSnap.bestMoveDirections, dailyRouteCards: repSnap.dailyRouteCards }));
    assertWorkflow("Anthony beta readiness", repSnap.sessionRole === "rep" && repSnap.mode === "rep" && repSnap.activeRepId === "anthony" && repSnap.anthonyProfileExists && repSnap.anthonyPoolCount >= 6 && repSnap.debug.runtimeDataPool === "active" && repSnap.appBuildVersion && repSnap.storedAppBuildVersion === repSnap.appBuildVersion, `Anthony profile ready, ${repSnap.anthonyPoolCount} approved route targets, build ${repSnap.appBuildVersion}`, JSON.stringify(repSnap));
    assertWorkflow("Beta Stability Sprint 2 dashboard performance", Number(founderSnap.debug.renderTimings.total || 0) < 5000 && Number(repSnap.debug.renderTimings.total || 0) < 5000 && Number(founderSnap.performance.activeResourceDuration || 0) < 5000 && founder.routeLoadMs < 10000, `founder render ${founderSnap.debug.renderTimings.total || 0}ms, rep render ${repSnap.debug.renderTimings.total || 0}ms, active fetch ${founderSnap.performance.activeResourceDuration || 0}ms, route ready ${founder.routeLoadMs}ms`, JSON.stringify({ founderRender: founderSnap.debug.renderTimings, repRender: repSnap.debug.renderTimings, founderPerformance: founderSnap.performance, routeLoadMs: founder.routeLoadMs }));
    const decisionDesktop = await verifyDecisionContextDesktopLayout(rep.cdp);
    assertWorkflow("Decision Context desktop rendering", decisionDesktop.viewportWidth > 390 && decisionDesktop.quickCount === 7 && decisionDesktop.visitCount === 7 && decisionDesktop.addPlaceCount === 7 && decisionDesktop.quickInitiallyHidden && decisionDesktop.quickOptional && decisionDesktop.addPlaceInitiallyHidden && decisionDesktop.addPlaceVisibleWithVisit && decisionDesktop.left >= -1 && decisionDesktop.right <= decisionDesktop.viewportWidth + 1 && decisionDesktop.scrollWidth <= decisionDesktop.viewportWidth + 1, "seven optional decision sources fit Quick Result, Add Visit, and Add Place initial-visit workflows", JSON.stringify(decisionDesktop));
    verifyNoErrors("Rep", rep.eventLog, repSnap);
    await clickTab(rep.cdp, "route");
    const repRouteSnap = await snapshot(rep.cdp);
    assertWorkflow("Beta Route Controls Anthony 15-location route generation", repRouteSnap.routeCards === 15 && repRouteSnap.routeCountLabel.includes("15 active stops"), `${repRouteSnap.routeCards} Anthony route cards rendered; ${repRouteSnap.routeCountLabel}`, JSON.stringify({ routeCards: repRouteSnap.routeCards, routeCountLabel: repRouteSnap.routeCountLabel, routeText: repRouteSnap.routeText.slice(0, 500) }));
    const routeWindows = await verifyRouteWindowOptions(rep.cdp);
    assertWorkflow("Beta Route Controls Morning route options", routeWindows.morning.routeCards > 0 && routeWindows.morning.routeCountLabel.includes("active stops"), `${routeWindows.morning.routeCards} Morning options; ${routeWindows.morning.routeCountLabel}`, JSON.stringify(routeWindows.morning));
    assertWorkflow("Beta Route Controls Evening route options", routeWindows.evening.routeCards > 0 && routeWindows.evening.routeCountLabel.includes("active stops"), `${routeWindows.evening.routeCards} Evening options; ${routeWindows.evening.routeCountLabel}`, JSON.stringify(routeWindows.evening));
    const hamzaRouting = await verifyHamzaRepeatRecommendation(rep.cdp);
    assertWorkflow("Beta Stability Sprint 2 Hamza repeat recommendation evidence routing", hamzaRouting.daysSinceRecommendation === 0 && !hamzaRouting.bestNextIsHamza && hamzaRouting.reasons.some(reason => reason.includes("recently shown")), `${hamzaRouting.hamzaName} rotated off best-next after same-day route history; best next ${hamzaRouting.bestNextName}`, JSON.stringify(hamzaRouting));
    const repNearbyBadge = await verifyRouteNearbyInteraction(rep.cdp);
    assertWorkflow("Beta Route Controls Anthony Rep Nearby opens context", repNearbyBadge.tagName === "button" && repNearbyBadge.nearbyPlace && repNearbyBadge.after.modalActive && repNearbyBadge.modalTitle === "Nearby Context" && /Nearby Context|walkable|Directions|No verified/.test(repNearbyBadge.modalText), `${repNearbyBadge.text} opened ${repNearbyBadge.modalTitle}`, JSON.stringify(repNearbyBadge));
    await clickTab(rep.cdp, "today");
    const nearbyFlow = await verifyNearbyOpportunitiesFlow(rep.cdp);
    assertWorkflow("Nearby Opportunities empty state", nearbyFlow.emptyBefore.includes("Log a verified route stop"), nearbyFlow.emptyBefore, JSON.stringify(nearbyFlow));
    assertWorkflow("Nearby Opportunities location acquisition", nearbyFlow.latestVisitHasLocation && nearbyFlow.locationButtonLabel === "Location Attached" && nearbyFlow.locationStatus.includes("Device-reported visit location attached"), nearbyFlow.locationStatus, JSON.stringify(nearbyFlow));
    assertWorkflow("Nearby Opportunities Active Pool query", nearbyFlow.beforeRuntimePool === "active" && nearbyFlow.runtimePool === "active" && nearbyFlow.nearbyDebug.originSource === "visit-location", `${nearbyFlow.nearbyDebug.count} nearby from ${nearbyFlow.nearbyDebug.originSource}`, JSON.stringify(nearbyFlow));
    assertWorkflow("Nearby Opportunities rendering", nearbyFlow.cardCount > 0 && nearbyFlow.noEmptyAfter && nearbyFlow.countLabel.includes("within") && nearbyFlow.firstCard.includes("Directions"), `${nearbyFlow.cardCount} nearby cards for ${nearbyFlow.target.name}`, JSON.stringify(nearbyFlow));
    await clickTab(rep.cdp, "places");
    const repPlaces = await snapshot(rep.cdp);
    assertWorkflow("Rep Places visit review", repPlaces.activeView === "view-places" && repPlaces.placesText.includes("Rep Places") && repPlaces.placesText.includes("View Visit") && repPlaces.placesItems > 0, `${repPlaces.placesItems} visited places available on desktop`, JSON.stringify({ activeView: repPlaces.activeView, placesItems: repPlaces.placesItems, placesText: repPlaces.placesText.slice(0, 500) }));
    const desktopRepPlaces = await verifyDesktopRepresentativePlaces(rep.cdp);
    assertWorkflow("Representative Saved Places desktop rendering", desktopRepPlaces.viewportWidth > 390 && desktopRepPlaces.title === "Rep Places" && desktopRepPlaces.visitedHeading === "Visited Places" && desktopRepPlaces.savedHeading === "Saved Places" && desktopRepPlaces.savedText.includes("Not Yet Visited") && desktopRepPlaces.visitedCount > 0 && desktopRepPlaces.savedCount === 1 && desktopRepPlaces.savedLeft >= -1 && desktopRepPlaces.savedRight <= desktopRepPlaces.viewportWidth + 1, "Visited and Saved sections render distinctly on desktop", JSON.stringify(desktopRepPlaces));
    const routeSync = await verifyRouteStateSynchronization(rep.cdp);
    assertWorkflow("Beta Stability Sprint 2 route state synchronization", !routeSync.routePoolStillContainsLogged && !routeSync.routeListStillContainsLogged && !routeSync.dailyRouteStillContainsLogged && !routeSync.bestNextStillLogged, `${routeSync.loggedName} removed from route pool/list/daily/best-next after logging`, JSON.stringify(routeSync));
    verifyNoErrors("Nearby Opportunities", rep.eventLog, await snapshot(rep.cdp));

    const anthonyLog = await runPageScenario(chrome, server, "/?role=rep&rep=anthony&debug=1&harness=anthony-mobile-quick-log", "anthony-mobile-log", {
      standalone: true,
      viewport: { width: 390, height: 667, deviceScaleFactor: 3, mobile: true }
    });
    const quickLog = await verifyMobileQuickLogging(anthonyLog.cdp);
    assertWorkflow("Anthony mobile pin-drop logging reachability", quickLog.reachable && !quickLog.modalActiveAfterSubmit && quickLog.afterUnits > quickLog.beforeUnits && quickLog.routeQueueCount === 15 && quickLog.routeLoopStatus === "Route updated using your latest result." && quickLog.documentScrollWidth <= quickLog.viewportWidth + 1 && quickLog.bodyScrollWidth <= quickLog.viewportWidth + 1, `submit reachable, units ${quickLog.beforeUnits} -> ${quickLog.afterUnits}, queue ${quickLog.routeQueueCount}, modal body ${quickLog.modalBodyClientHeight}/${quickLog.modalBodyScrollHeight}`, JSON.stringify(quickLog));
    verifyNoErrors("Anthony mobile logging", anthonyLog.eventLog, await snapshot(anthonyLog.cdp));

    const anthonyPwa = await runPageScenario(chrome, server, "/?pwa=rep&debug=1&harness=anthony-pwa-signin", "anthony-pwa", {
      standalone: true,
      viewport: { width: 390, height: 844, deviceScaleFactor: 3, mobile: true }
    });
    verifyRepOnly("Anthony PWA first launch Rep-only", anthonyPwa.initial);
    assertWorkflow("Anthony mobile startup performance", Number(anthonyPwa.initial.debug.renderTimings.total || 0) < 5000 && Number(anthonyPwa.initial.performance.activeResourceDuration || 0) < 5000, `render ${anthonyPwa.initial.debug.renderTimings.total || 0}ms, active fetch ${anthonyPwa.initial.performance.activeResourceDuration || 0}ms`, JSON.stringify({ renderTimings: anthonyPwa.initial.debug.renderTimings, performance: anthonyPwa.initial.performance }));
    const anthonyReopen = await navigateExistingScenario(anthonyPwa.cdp, server, "/?pwa=founder&debug=1&harness=anthony-pwa-reopen");
    verifyRepOnly("Anthony PWA reopen preserves Rep-only", anthonyReopen);
    const anthonyRefresh = await navigateExistingScenario(anthonyPwa.cdp, server, "/?pwa=founder&debug=1&harness=anthony-pwa-refresh");
    verifyRepOnly("Anthony PWA refresh preserves Rep-only", anthonyRefresh);
    verifyNoErrors("Anthony PWA", anthonyPwa.eventLog, anthonyRefresh);

    const decisionContext = await runPageScenario(chrome, decisionContextServer, "/?role=rep&rep=anthony&debug=1&harness=decision-context-producer", "decision-context-producer", {
      standalone: true,
      viewport: { width: 390, height: 844, deviceScaleFactor: 3, mobile: true }
    });
    const decisionResult = await verifyDecisionContextProducer(decisionContext.cdp);
    const decisionRequest = decisionContextServer.fieldSessionRequests[0]?.payload || {};
    const decisionRawReport = decisionRequest.rawReportText ? JSON.parse(decisionRequest.rawReportText) : {};
    const decisionLegacyRawVisit = decisionRawReport.visits?.find(visit => visit.visitId === "legacy-active-session-visit") || null;
    const knownSourcesValid = decisionResult.sourceIds.every(sourceId => {
      const evidence = decisionResult.generated[sourceId]?.visitDecisionSource;
      return evidence?.sourceId === sourceId && evidence.reason && evidence.evidence?.length === 1 && evidence.confidence === 1 && !Number.isNaN(Date.parse(evidence.capturedAt));
    });
    const nonRouteDecisionsValid = decisionResult.sourceIds.filter(sourceId => sourceId !== "route_iq_recommendation")
      .every(sourceId => decisionResult.generated[sourceId]?.recommendationDecisionContext?.decision === "overridden");
    assertWorkflow("Decision Context supported sources", decisionResult.sourceIds.length === 7 && knownSourcesValid && decisionResult.labels.includes("Route IQ Recommendation") && decisionResult.labels.includes("Nearby Context") && decisionResult.labels.includes("Saved Place") && decisionResult.labels.includes("Discovery") && decisionResult.labels.includes("Existing Relationship") && decisionResult.labels.includes("Follow-up") && decisionResult.labels.includes("Manual"), "all seven governed decision sources produce complete structured evidence", JSON.stringify(decisionResult));
    assertWorkflow("Decision Context Route IQ acceptance", decisionResult.generated.route_iq_recommendation?.recommendationDecisionContext?.decision === "accepted" && decisionResult.generated.route_iq_recommendation?.recommendationDecisionContext?.recommendationAvailable === true, "explicit Route IQ selection records accepted recommendation context", JSON.stringify(decisionResult.generated.route_iq_recommendation));
    assertWorkflow("Decision Context off-route context", nonRouteDecisionsValid, "each explicit non-route source records governed override context when a different recommendation is present", JSON.stringify(decisionResult.generated));
    assertWorkflow("Decision Context Skip and Unknown", decisionResult.skipState.selected === "unknown" && decisionResult.skipState.status === "Unknown (default)" && decisionResult.unknown.visitDecisionSource?.sourceId === "unknown" && decisionResult.unknown.visitDecisionSource?.confidence === 0, "Skip remains optional and produces explicit Unknown evidence", JSON.stringify({ skip: decisionResult.skipState, unknown: decisionResult.unknown }));
    assertWorkflow("Decision Context No Contact workflow disclosure", decisionResult.noContactState.visitsAfterOutcomeSelection === decisionResult.noContactState.visitsBefore && decisionResult.noContactState.saveRequired && decisionResult.noContactState.countsVisible, "No Contact opens the optional Decision Source step and requires Save Result instead of auto-saving", JSON.stringify(decisionResult.noContactState));
    assertWorkflow("Decision Context zero influence before submission", JSON.stringify(decisionResult.evidenceOnlyState.routeOrderBefore) === JSON.stringify(decisionResult.evidenceOnlyState.routeOrderAfter) && decisionResult.evidenceOnlyState.visitsBefore === decisionResult.evidenceOnlyState.visitsAfter && !decisionResult.evidenceOnlyState.decisionSourceRequired && !decisionResult.evidenceOnlyState.capturedAtControlPresent && !decisionResult.evidenceOnlyState.representativeShadowOutputVisible, "choosing or skipping Decision Source changes no visit, route order, or representative-visible shadow state before Save Result", JSON.stringify(decisionResult.evidenceOnlyState));
    assertWorkflow("Decision Context post-action boundary", decisionResult.capturedAtMatchesVisitCreatedAt && JSON.stringify(decisionResult.decisionSourceKeys) === JSON.stringify(["capturedAt", "confidence", "evidence", "reason", "sourceId"]) && JSON.stringify(decisionResult.recommendationContextKeys) === JSON.stringify(["decision", "recommendationAvailable", "recommendationId"]) && JSON.stringify(decisionResult.evidenceOnlyState.recommendationContextFields) === JSON.stringify(["recommendationId", "recommendationPlaceId"]), "capturedAt equals visit creation time and the record contains source/outcome linkage only, not a frozen candidate set", JSON.stringify({ capturedAtMatchesVisitCreatedAt: decisionResult.capturedAtMatchesVisitCreatedAt, decisionSourceKeys: decisionResult.decisionSourceKeys, recommendationContextKeys: decisionResult.recommendationContextKeys, recommendationContextFields: decisionResult.evidenceOnlyState.recommendationContextFields }));
    assertWorkflow("Decision Context legacy load compatibility", decisionResult.legacyMissingContext.visitDecisionSource === null && decisionResult.legacyMissingContext.recommendationDecisionContext === null && decisionResult.legacyMissingContext.reportContext.visitDecisionSource?.sourceId === "unknown" && decisionResult.legacyMissingContext.reportContext.visitDecisionSource?.reason === null && decisionResult.legacyMissingContext.reportContext.visitDecisionSource?.confidence === 0 && decisionResult.legacyMissingContext.reportContext.visitDecisionSource?.capturedAt === "2026-07-12T19:00:00.000Z" && decisionResult.legacyMissingContext.reportContext.recommendationDecisionContext?.recommendationAvailable === null && decisionResult.legacyMissingContext.originalVisitUnchanged && decisionResult.legacyMissingContext.capturedAfterOutcome, "legacy visits remain unchanged in local state while report construction emits explicit post-action Unknown context", JSON.stringify(decisionResult.legacyMissingContext));
    assertWorkflow("Decision Context legacy End Route and End Day compatibility", decisionResult.legacyFinalization.completionActionsValid && decisionResult.legacyFinalization.originalVisitUnchanged && decisionResult.legacyFinalization.capturedAfterOutcome && decisionResult.legacyFinalization.reportVisit?.visitDecisionSource?.sourceId === "unknown" && decisionResult.legacyFinalization.reportVisit?.recommendationDecisionContext?.recommendationAvailable === null && decisionLegacyRawVisit?.visitDecisionSource?.sourceId === "unknown" && decisionLegacyRawVisit?.recommendationDecisionContext?.recommendationId === null, "legacy active-session visit validates for both completion actions and is acknowledged through the actual End Route handoff as post-action Unknown", JSON.stringify({ finalization: decisionResult.legacyFinalization, raw: decisionLegacyRawVisit }));
    assertWorkflow("Decision Context workspace isolation", decisionResult.workspaceBlocked, "unknown workspace failed closed", JSON.stringify(decisionResult));
    assertWorkflow("Decision Context local persistence", decisionResult.visit?.visitDecisionSource?.sourceId === "route_iq_recommendation" && decisionResult.reloadedVisit?.visitDecisionSource?.sourceId === "route_iq_recommendation" && decisionResult.reloadedVisit?.recommendationDecisionContext?.decision === "accepted", "decision evidence survives Dashboard state normalization and reload", JSON.stringify({ visit: decisionResult.visit, reloaded: decisionResult.reloadedVisit }));
    assertWorkflow("Decision Context canonical report", decisionResult.reportVisit?.visitDecisionSource?.sourceId === "route_iq_recommendation" && decisionResult.reportVisit?.recommendationDecisionContext?.decision === "accepted", "today report carries both governed decision fields", JSON.stringify(decisionResult.reportVisit));
    assertWorkflow("Decision Context Data acknowledgment", decisionResult.archiveStatus === "archived" && decisionResult.acknowledgment?.status === "archived" && decisionContextServer.fieldSessionRequests.length === 1 && decisionRawReport.visits?.[0]?.visitDecisionSource?.sourceId === "route_iq_recommendation" && decisionRawReport.visits?.[0]?.recommendationDecisionContext?.decision === "accepted", `${decisionResult.acknowledgment?.sessionId || "missing session"} acknowledged with decision context`, JSON.stringify({ result: decisionResult, request: decisionRequest }));
    assertWorkflow("Decision Context mobile reachability", decisionResult.layout.modalOverflowY === "auto" && decisionResult.layout.submitTop >= 0 && decisionResult.layout.submitBottom <= decisionResult.layout.viewportHeight + 1 && decisionResult.layout.submitLeft >= -1 && decisionResult.layout.submitRight <= decisionResult.layout.viewportWidth + 1 && decisionResult.layout.documentScrollWidth <= decisionResult.layout.viewportWidth + 1 && decisionResult.layout.bodyScrollWidth <= decisionResult.layout.viewportWidth + 1, `Decision Source and Save Result reachable within ${decisionResult.layout.viewportWidth}x${decisionResult.layout.viewportHeight}`, JSON.stringify(decisionResult.layout));
    verifyNoErrors("Decision Context producer", decisionContext.eventLog, await snapshot(decisionContext.cdp));

    const visitCorrection = await runPageScenario(chrome, visitCorrectionServer, "/?role=rep&rep=anthony&debug=1&harness=post-visit-outcome-editing", "post-visit-outcome-editing", {
      standalone: true,
      viewport: { width: 390, height: 844, deviceScaleFactor: 3, mobile: true }
    });
    const correctionResult = await verifyPostVisitOutcomeEditing(visitCorrection.cdp);
    const correctionRequests = visitCorrectionServer.fieldSessionRequests;
    const correctionPayload = correctionRequests[0]?.payload || {};
    const correctionRawReport = correctionPayload.rawReportText ? JSON.parse(correctionPayload.rawReportText) : {};
    assertWorkflow("Post-visit outcome editing", correctionResult.placesBefore.activeView === "view-places" && correctionResult.placesBefore.title === "Rep Places" && correctionResult.placesBefore.cards === 1 && correctionResult.placesBefore.viewVisitVisible && correctionResult.firstCount === 1, "Rep opened a completed visit from Places and saved the first correction", JSON.stringify(correctionResult));
    assertWorkflow("Post-visit multiple corrections", correctionResult.secondCount === 2 && correctionResult.countAfterDuplicate === 2 && correctionResult.sequences.join(",") === "1,2" && new Set(correctionResult.eventIds).size === 2, "two ordered, uniquely identified correction events preserved", JSON.stringify(correctionResult));
    assertWorkflow("Post-visit correction persistence", correctionResult.reloadedCorrectionCount === 2 && correctionResult.reloadedFinalOutcome?.quality === "Membership/Unit" && correctionResult.reloadedFinalOutcome?.units === 1, "both corrections and the final verified outcome survive state normalization", JSON.stringify(correctionResult));
    assertWorkflow("Post-visit append-only audit", correctionResult.originalUnchanged && correctionResult.originalAuditText.includes("Original Visit") && correctionResult.firstAuditText.includes("Correction 1") && correctionResult.secondAuditText.includes("Correction 2") && correctionResult.finalAuditText.includes("Final Verified Outcome"), "original evidence remains unchanged alongside both corrections and the final projection", JSON.stringify(correctionResult));
    assertWorkflow("Post-visit final verified outcome", correctionResult.verified.quality === "Membership/Unit" && correctionResult.verified.leads === 1 && correctionResult.verified.appointments === 1 && correctionResult.verified.units === 1 && correctionResult.verified.followUp.includes("Call tomorrow") && correctionResult.verified.contactEmail === "taylor@example.com", "final verified outcome combines the ordered correction history", JSON.stringify(correctionResult.verified));
    assertWorkflow("Post-visit duplicate protection", correctionResult.duplicateStatus === "No outcome changes to save." && correctionResult.countAfterDuplicate === correctionResult.secondCount, "unchanged resubmission did not create another correction", JSON.stringify(correctionResult));
    assertWorkflow("Post-visit Route IQ scoring isolation", JSON.stringify(correctionResult.routeStatsBefore) === JSON.stringify(correctionResult.routeStatsAfter) && correctionResult.routeStatsAfter.units === 0 && correctionResult.verified.units === 1, "Route IQ continues to use original visit evidence while the verified display/report uses corrections", JSON.stringify({ before: correctionResult.routeStatsBefore, after: correctionResult.routeStatsAfter, verified: correctionResult.verified }));
    assertWorkflow("Post-visit canonical report audit", correctionResult.report.auditModel === "append_only_original_correction_final" && correctionResult.report.originalVisit.units === 0 && correctionResult.report.correctionCount === 2 && correctionResult.report.finalOutcome.units === 1 && correctionResult.report.finalVisit.units === 1, "canonical report contains original evidence, corrections, and final verified outcome", JSON.stringify(correctionResult.report));
    assertWorkflow("Post-visit Data acknowledgment", correctionResult.archiveStatus === "archived" && correctionResult.acknowledgment?.status === "archived" && correctionRequests.length === 1 && correctionRawReport.visitOutcomeEvidence?.correctionEvents?.length === 2, `${correctionResult.acknowledgment?.sessionId || "missing session"} acknowledged with correction evidence`, JSON.stringify({ result: correctionResult, request: correctionPayload }));
    assertWorkflow("Post-visit archived session guard", !correctionResult.correctionButtonAfterArchive && correctionResult.archivedMutationBlocked, "archived visit is read-only after Data acknowledgment", JSON.stringify(correctionResult));
    assertWorkflow("Post-visit mobile no-horizontal-scroll", correctionResult.documentScrollWidth <= correctionResult.viewportWidth + 1 && correctionResult.bodyScrollWidth <= correctionResult.viewportWidth + 1, `${correctionResult.documentScrollWidth}/${correctionResult.bodyScrollWidth}px within ${correctionResult.viewportWidth}px viewport`, JSON.stringify(correctionResult));
    assertWorkflow("Post-visit mobile form reachability", correctionResult.mobileFormReachability?.modalOverflowY === "auto" && correctionResult.mobileFormReachability.submitTop >= 0 && correctionResult.mobileFormReachability.submitBottom <= correctionResult.mobileFormReachability.viewportHeight + 1 && correctionResult.mobileFormReachability.submitLeft >= -1 && correctionResult.mobileFormReachability.submitRight <= correctionResult.mobileFormReachability.viewportWidth + 1, `Save Correction reachable within ${correctionResult.mobileFormReachability?.viewportWidth || 0}x${correctionResult.mobileFormReachability?.viewportHeight || 0}`, JSON.stringify(correctionResult.mobileFormReachability));
    verifyNoErrors("Post-visit outcome editing", visitCorrection.eventLog, await snapshot(visitCorrection.cdp));

    const addPlace = await runPageScenario(chrome, addPlaceServer, "/?role=rep&rep=anthony&debug=1&harness=add-place-immediate-outcome", "add-place-immediate-outcome", {
      standalone: true,
      viewport: { width: 390, height: 844, deviceScaleFactor: 3, mobile: true }
    });
    const addPlaceResult = await verifyAddPlaceImmediateOutcomeCapture(addPlace.cdp);
    const addPlaceRequests = addPlaceServer.fieldSessionRequests;
    const addPlaceRawReport = addPlaceRequests[0]?.payload?.rawReportText ? JSON.parse(addPlaceRequests[0].payload.rawReportText) : {};
    assertWorkflow("Add Place business creation only", addPlaceResult.addPlaceButtonVisible && addPlaceResult.businessOnly.place?.sourceType === "Dashboard Manual Entry" && addPlaceResult.businessOnly.place?.workspaceId === "fitness_connection" && !addPlaceResult.businessOnly.hasVisit, "representative created a business without recording a visit", JSON.stringify(addPlaceResult));
    assertWorkflow("Add Place later logging access", addPlaceResult.businessOnlyVisibleInPlaces && addPlaceResult.businessOnlyVisibleInQuickResult, "business-only creation remains available in Rep Places and Quick Result without entering Route IQ", JSON.stringify(addPlaceResult));
    assertWorkflow("Representative Saved Places rendering", addPlaceResult.representativePlacesGovernance.savedBeforePromotion.includes(addPlaceResult.businessOnly.place.name) && addPlaceResult.representativePlacesGovernance.savedBeforePromotion.includes("Not Yet Visited") && !addPlaceResult.representativePlacesGovernance.visitedBeforePromotion.includes(addPlaceResult.businessOnly.place.name) && addPlaceResult.representativePlacesGovernance.savedStatusCount === 1, "unvisited representative-owned business rendered only in Saved Places with required status", JSON.stringify(addPlaceResult.representativePlacesGovernance));
    assertWorkflow("Representative Saved Places ownership", !addPlaceResult.representativePlacesGovernance.foreignSavedVisible, "other representative's saved business remained hidden", JSON.stringify(addPlaceResult.representativePlacesGovernance));
    assertWorkflow("Representative Saved Places evidence isolation", !addPlaceResult.representativePlacesGovernance.prePromotionReportContainsSaved && !addPlaceResult.representativePlacesGovernance.founderBeforePromotionContainsSaved && !addPlaceResult.representativePlacesGovernance.statisticsBeforePromotionContainsSaved && !addPlaceResult.representativePlacesGovernance.prePromotionIntelligenceHasSavedPlace && !addPlaceResult.representativePlacesGovernance.routeBeforePromotionContainsSaved && !addPlaceResult.representativePlacesGovernance.activePoolClassified, "Saved Place absent from Data evidence, Founder map, statistics, Intelligence evidence, Route IQ, and Active Pool classification", JSON.stringify(addPlaceResult.representativePlacesGovernance));
    assertWorkflow("Representative Saved Places promotion rendering", addPlaceResult.representativePlacesGovernance.promotionVisit?.quality === "Conversation" && addPlaceResult.representativePlacesGovernance.visitedAfterPromotion.includes(addPlaceResult.businessOnly.place.name) && !addPlaceResult.representativePlacesGovernance.savedAfterPromotion.includes(addPlaceResult.businessOnly.place.name) && addPlaceResult.representativePlacesGovernance.founderAfterPromotionContainsVisited && addPlaceResult.representativePlacesGovernance.statisticsAfterPromotionContainsVisited, "verified visit moved presentation from Saved to Visited without mutating place ownership", JSON.stringify(addPlaceResult.representativePlacesGovernance));
    assertWorkflow("Add Place initial conversation", addPlaceResult.conversation?.quality === "Conversation" && addPlaceResult.conversation?.conversations === 1 && addPlaceResult.conversation?.manager.includes("Jordan Manager") && addPlaceResult.conversation?.notes.includes("Initial conversation"), "conversation and manager contact captured with business creation", JSON.stringify(addPlaceResult.conversation));
    assertWorkflow("Add Place initial lead", addPlaceResult.lead?.quality === "Lead" && addPlaceResult.lead?.conversations === 1 && addPlaceResult.lead?.leads === 1, "lead captured with business creation", JSON.stringify(addPlaceResult.lead));
    assertWorkflow("Add Place initial membership", addPlaceResult.membership?.quality === "Membership / Unit" && addPlaceResult.membership?.conversations === 1 && addPlaceResult.membership?.units === 1, "membership/unit captured with business creation", JSON.stringify(addPlaceResult.membership));
    assertWorkflow("Add Place initial appointment", addPlaceResult.appointment?.quality === "Appointment" && addPlaceResult.appointment?.leads === 1 && addPlaceResult.appointment?.appointments === 1, "appointment captured with business creation", JSON.stringify(addPlaceResult.appointment));
    assertWorkflow("Add Place initial follow-up", addPlaceResult.followUp?.quality === "Follow-up Required" && addPlaceResult.followUp?.followUp === "Return Wednesday at 10 AM", "follow-up requirement captured with business creation", JSON.stringify(addPlaceResult.followUp));
    assertWorkflow("Add Place supported outcomes", ["Visited", "Conversation", "Lead", "Appointment", "Membership / Unit", "Follow-up Required", "Decision Pending", "No Interest", "Closed"].every(label => addPlaceResult.outcomeOptions.includes(label)) && Object.keys(addPlaceResult.mappedOutcomes).length === 9, "all required initial outcomes are available", JSON.stringify({ options: addPlaceResult.outcomeOptions, mapped: addPlaceResult.mappedOutcomes }));
    assertWorkflow("Add Place duplicate protection", addPlaceResult.duplicateProtection.placeCountUnchanged && addPlaceResult.duplicateProtection.visitCountUnchanged && addPlaceResult.duplicateProtection.status === "This place already exists.", "duplicate submit created neither a business nor a visit", JSON.stringify(addPlaceResult.duplicateProtection));
    assertWorkflow("Add Place workspace isolation", addPlaceResult.workspaceIsolation.noPlaceCreated && addPlaceResult.workspaceIsolation.noVisitCreated && addPlaceResult.workspaceIsolation.status.includes("outside Fitness Connection"), "cross-workspace creation failed closed", JSON.stringify(addPlaceResult.workspaceIsolation));
    assertWorkflow("Add Place append-only history", addPlaceResult.correctionCount === 1 && addPlaceResult.correctedConversation?.quality === "Lead" && addPlaceResult.report.correctionCount === 1 && addPlaceResult.report.conversationOriginal?.outcome === "Conversation" && addPlaceResult.report.conversationFinal?.outcome === "Lead", "business creation, initial visit, correction, and final verified outcome remain distinct", JSON.stringify(addPlaceResult));
    assertWorkflow("Add Place state persistence", addPlaceResult.reload.initialVisitCount === 5 && addPlaceResult.reload.appointment?.appointments === 1 && addPlaceResult.reload.followUp?.followUp === "Return Wednesday at 10 AM", "initial outcome fields survive state normalization", JSON.stringify(addPlaceResult.reload));
    assertWorkflow("Add Place canonical field-session contract", addPlaceResult.archiveStatus === "archived" && addPlaceResult.acknowledgment?.status === "archived" && addPlaceRequests.length === 1 && addPlaceResult.report.businessCreationCount === 5 && addPlaceRawReport.visits?.filter(visit => visit.businessCreation?.source === "dashboard_add_place").length === 5, `${addPlaceResult.acknowledgment?.sessionId || "missing session"} acknowledged with five business-creation snapshots`, JSON.stringify({ result: addPlaceResult, request: addPlaceRequests[0] }));
    assertWorkflow("Add Place Route IQ scoring isolation", addPlaceResult.routePoolUnchanged, "manual businesses stayed outside the governed Google-qualified route pool", JSON.stringify(addPlaceResult));
    assertWorkflow("Add Place archived session guard", addPlaceResult.initialVisitDisabledAfterArchive, "initial visit capture is disabled after session finalization", JSON.stringify(addPlaceResult));
    assertWorkflow("Add Place mobile form reachability", addPlaceResult.mobileReachability?.fieldsVisible && addPlaceResult.mobileReachability.modalOverflowY === "auto" && addPlaceResult.mobileReachability.submitTop >= 0 && addPlaceResult.mobileReachability.submitBottom <= addPlaceResult.mobileReachability.viewportHeight + 1 && addPlaceResult.mobileReachability.submitLeft >= -1 && addPlaceResult.mobileReachability.submitRight <= addPlaceResult.mobileReachability.viewportWidth + 1 && addPlaceResult.documentScrollWidth <= addPlaceResult.viewportWidth + 1 && addPlaceResult.bodyScrollWidth <= addPlaceResult.viewportWidth + 1, `Save Place + Visit reachable within ${addPlaceResult.mobileReachability?.viewportWidth || 0}x${addPlaceResult.mobileReachability?.viewportHeight || 0}`, JSON.stringify(addPlaceResult.mobileReachability));
    verifyNoErrors("Add Place immediate outcome", addPlace.eventLog, await snapshot(addPlace.cdp));

    const fieldSession = await runPageScenario(chrome, fieldSessionServer, "/?role=rep&rep=anthony&debug=1&harness=field-session-end-route", "field-session-end-route");
    const fieldSessionResult = await verifyFieldSessionCompletion(fieldSession.cdp, "end_route");
    const fieldSessionRequest = fieldSessionServer.fieldSessionRequests[0]?.payload || {};
    assertWorkflow("End Route field-session producer", fieldSessionResult.recordStatus === "archived" && fieldSessionResult.completionAction === "end_route" && fieldSessionResult.attempts === 1 && fieldSessionResult.acknowledgment?.status === "archived", `${fieldSessionResult.acknowledgment?.sessionId || "missing session"} acknowledged`, JSON.stringify(fieldSessionResult));
    assertWorkflow("Field-session canonical payload", fieldSessionServer.fieldSessionRequests.length === 1 && fieldSessionRequest.workspaceId === "fitness_connection" && fieldSessionRequest.operatingProfileId === "fitness" && fieldSessionRequest.finalExportConfirmed === true && fieldSessionRequest.completionAction === "end_route" && JSON.parse(fieldSessionRequest.rawReportText).reportType === "beta-daily-rep-report", "final Fitness report submitted once through the approved endpoint", JSON.stringify(fieldSessionServer.fieldSessionRequests));
    assertWorkflow("Field-session local finalization and duplicate protection", fieldSessionResult.localRawPreserved && fieldSessionResult.endRouteDisabled && fieldSessionResult.endDayDisabled && !fieldSessionResult.retryVisible && fieldSessionResult.duplicateReturnedExisting && fieldSessionServer.fieldSessionRequests.length === 1, "frozen locally; end actions disabled; repeat action did not resubmit", JSON.stringify(fieldSessionResult));
    assertWorkflow("Field-session finalized evidence guard", !fieldSessionResult.blockedModalOpen && fieldSessionResult.blockedSave === false && fieldSessionResult.afterBlockedVisitCount === fieldSessionResult.beforeBlockedVisitCount, "post-finalization visit mutation blocked", JSON.stringify(fieldSessionResult));
    assertWorkflow("Manual Export Today's Report preserved", fieldSessionResult.manualExportVisible && fieldSessionResult.manualExportDisabled === false, "manual JSON export remains available after archive", JSON.stringify(fieldSessionResult));
    verifyNoErrors("End Route field-session producer", fieldSession.eventLog, await snapshot(fieldSession.cdp));

    const fieldSessionRetry = await runPageScenario(chrome, fieldSessionRetryServer, "/?role=rep&rep=anthony&debug=1&harness=field-session-end-day-retry", "field-session-end-day-retry", {
      standalone: true,
      viewport: { width: 390, height: 844, deviceScaleFactor: 3, mobile: true }
    });
    const retryResult = await verifyFieldSessionRetry(fieldSessionRetry.cdp);
    const retryRequests = fieldSessionRetryServer.fieldSessionRequests;
    assertWorkflow("End Day failed submission handling", retryResult.failureState.status === "failed" && retryResult.failureState.attempts === 1 && retryResult.failureState.retryable === true && retryResult.failureState.retryVisible && retryResult.failureState.handoffStatus.includes("preserved on this device"), "failed archive retained locally with retry visible", JSON.stringify(retryResult));
    assertWorkflow("Field-session retry behavior", retryResult.finalStatus === "archived" && retryResult.attempts === 2 && retryResult.rawReportUnchanged && retryResult.acknowledgment?.status === "archived" && retryRequests.length === 2 && retryRequests[0].payload.rawReportText === retryRequests[1].payload.rawReportText, "second attempt acknowledged using identical frozen report bytes", JSON.stringify({ retryResult, retryRequests }));
    assertWorkflow("Field-session retry completion state", retryResult.handoffStatus === "Session archived successfully." && !retryResult.retryVisible && retryResult.manualExportVisible && retryResult.manualExportDisabled === false, retryResult.handoffStatus, JSON.stringify(retryResult));
    verifyMobileFit("Field-session mobile End Day controls", await mobileFitSnapshot(fieldSessionRetry.cdp));
    verifyNoErrors("End Day field-session retry", fieldSessionRetry.eventLog, await snapshot(fieldSessionRetry.cdp), {
      allow: ["server responded with a status of 503"]
    });
    fieldSession.cdp.close();
    fieldSessionRetry.cdp.close();
    visitCorrection.cdp.close();
    addPlace.cdp.close();
    decisionContext.cdp.close();

    const adaptive = await runPageScenario(chrome, server, "/?role=founder&rep=cruz&debug=1&harness=continuous-adaptive-replenishment", "adaptive-replenishment", {
      viewport: { width: 390, height: 844, deviceScaleFactor: 3, mobile: true }
    });
    const adaptiveResult = await verifyContinuousAdaptiveReplenishment(adaptive.cdp);
    assertWorkflow("Continuous replenishment completion trigger", adaptiveResult.afterVisitCount === adaptiveResult.beforeVisitCount + 1 && adaptiveResult.status === "Route updated using your latest result.", adaptiveResult.status, JSON.stringify(adaptiveResult));
    assertWorkflow("Continuous replenishment queue returns to 15", adaptiveResult.afterQueueIds.length === 15 && adaptiveResult.queueTarget === 15 && adaptiveResult.queueThreshold === 5 && adaptiveResult.queueState === "active" && adaptiveResult.appendedReplacement, `${adaptiveResult.afterQueueIds.length}/${adaptiveResult.queueTarget} active stops`, JSON.stringify(adaptiveResult));
    assertWorkflow("Continuous replenishment order and duplicate protection", adaptiveResult.remainingOrderPreserved && adaptiveResult.duplicateCount === 0 && !adaptiveResult.completedStillActive, "remaining order preserved; completed stop excluded; no duplicates", JSON.stringify(adaptiveResult));
    assertWorkflow("Continuous replenishment evidence refresh", adaptiveResult.latestEvidenceCount >= adaptiveResult.afterVisitCount && adaptiveResult.debug.workspaceId === "fitness_connection" && adaptiveResult.debug.representativeId === "cruz", `${adaptiveResult.latestEvidenceCount} evidence records for ${adaptiveResult.debug.workspaceId}/${adaptiveResult.debug.representativeId}`, JSON.stringify(adaptiveResult));
    assertWorkflow("Continuous replenishment durable persistence", adaptiveResult.persistedVisitCount === adaptiveResult.afterVisitCount && JSON.stringify(adaptiveResult.persistedQueueIds) === JSON.stringify(adaptiveResult.afterQueueIds), "visit outcome and active queue persisted together", JSON.stringify(adaptiveResult));
    assertWorkflow("Continuous replenishment concurrent job protection", adaptiveResult.concurrencyCoalesced && adaptiveResult.afterFlight.started === adaptiveResult.beforeFlight.started + 1, `${adaptiveResult.afterFlight.coalesced - adaptiveResult.beforeFlight.coalesced} overlapping job coalesced`, JSON.stringify({ before: adaptiveResult.beforeFlight, after: adaptiveResult.afterFlight }));
    verifyMobileFit("Continuous replenishment mobile rendering", await mobileFitSnapshot(adaptive.cdp));
    const adaptiveReload = await navigateExistingScenario(adaptive.cdp, server, "/?role=founder&rep=cruz&debug=1&harness=continuous-adaptive-replenishment-reload");
    assertWorkflow("Continuous replenishment separate runtime restoration", adaptiveReload.visitCount === adaptiveResult.afterVisitCount && JSON.stringify(adaptiveReload.routeQueueIds) === JSON.stringify(adaptiveResult.afterQueueIds), `${adaptiveReload.visitCount} visits and ${adaptiveReload.routeQueueIds.length} queued stops restored`, JSON.stringify({ before: adaptiveResult, reload: adaptiveReload }));
    verifyNoErrors("Continuous adaptive replenishment", adaptive.eventLog, adaptiveReload);

    const full = await runPageScenario(chrome, server, "/?role=founder&debug=1&runtimePool=full&harness=runtime-workflows-full", "full");
    const fullSnap = full.initial;
    assertWorkflow("Runtime pool selection logic", fullSnap.debug.runtimeDataPool === "full" && fullSnap.debug.runtimeDataSource.includes("789 route records"), fullSnap.debug.runtimeDataSource, JSON.stringify(fullSnap.debug));
    verifyNoErrors("Full pool", full.eventLog, fullSnap);

    const fallback = await runPageScenario(chrome, fallbackServer, "/?role=founder&debug=1&harness=runtime-workflows-fallback", "fallback");
    const fallbackSnap = fallback.initial;
    const sawActive = fallbackServer.requests.some(request => request.path === activePoolPath);
    const sawFull = fallbackServer.requests.some(request => request.path === fullPoolPath);
    assertWorkflow("Full Pool fallback behavior", sawActive && sawFull && fallbackSnap.debug.runtimeDataPool === "full" && fallbackSnap.debug.runtimeDataSource.includes("789 route records"), `active unavailable, full fallback loaded: ${fallbackSnap.debug.runtimeDataSource}`, JSON.stringify({ sawActive, sawFull, debug: fallbackSnap.debug }));
    verifyNoErrors("Fallback", fallback.eventLog, fallbackSnap, { allow: ["server responded with a status of 404"] });

    verifyRuntimePerformance(founderSnap, founder.routeLoadMs);

    founder.cdp.close();
    mobileFounder.cdp.close();
    rep.cdp.close();
    anthonyLog.cdp.close();
    anthonyPwa.cdp.close();
    adaptive.cdp.close();
    full.cdp.close();
    fallback.cdp.close();
  } finally {
    await chrome.close();
    await server.close();
    await fallbackServer.close();
    await fieldSessionServer.close();
    await fieldSessionRetryServer.close();
    await visitCorrectionServer.close();
    await addPlaceServer.close();
    await decisionContextServer.close();
    await prospectiveServer.close();
    await prospectiveOffServer.close();
    await prospectiveFailureServer.close();
    if (localCertificate?.certDir) {
      rmSync(localCertificate.certDir, { recursive: true, force: true });
      localCertificate = undefined;
    }
  }
}

try {
  if (fileURLToPath(import.meta.url) === process.argv[1]) {
    await runHarness();
    const failed = results.filter(result => result.status === "FAIL");
    if (errors.length) errors.forEach(error => fail("Harness infrastructure", error));
    const finalFailures = results.filter(result => result.status === "FAIL");
    console.log(`Dashboard runtime workflow regression harness complete: ${results.length - finalFailures.length}/${results.length} passed.`);
    if (failed.length || errors.length) process.exitCode = 1;
    process.exit(process.exitCode || 0);
  }
} catch (error) {
  console.error(`FAIL Harness infrastructure: ${error.stack || error.message || error}`);
  process.exit(1);
}
