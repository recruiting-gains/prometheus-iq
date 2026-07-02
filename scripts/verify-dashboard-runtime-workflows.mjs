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
  if (ext === ".js") return "text/javascript; charset=utf-8";
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

function startStaticServer({ missingActive = false } = {}) {
  const requests = [];
  const certificate = localHttpsCertificate();
  const server = createSecureServer({ key: certificate.key, cert: certificate.cert }, (request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    const pathname = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
    const relativePath = pathname.replace(/^\/+/, "");
    requests.push({ path: relativePath, method: request.method });

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
    if (this.socket && this.socket.readyState === WebSocket.OPEN) this.socket.close();
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
      profileButtonLabels: [...document.querySelectorAll("[data-rep-select]")].filter(visible).map(button => button.textContent.trim()),
      activeView: document.querySelector(".view.active")?.id || "",
      visibleTabs: [...document.querySelectorAll(".tab[data-tab]")].filter(visible).map(tab => tab.dataset.tab),
      bestNextMove: text(document.getElementById("bestNextMove")),
      bestMoveAddress: text(document.getElementById("bestMoveAddress")),
      bestMoveDirections: document.getElementById("bestMoveDirections")?.href || "",
      routeRisk: text(document.getElementById("routeRisk")),
      routeCountLabel: text(document.getElementById("routeCount")),
      dailyRouteCountLabel: text(document.getElementById("dailyRouteCount")),
      territoryText: text(document.getElementById("territoryOverview")),
      territoryVisible: visible(document.getElementById("territoryOverview")),
      territoryRingCount: document.querySelectorAll("#territoryRingList .territory-ring").length,
      territoryRingTexts: [...document.querySelectorAll("#territoryRingList .territory-ring")].map(ring => ring.textContent.trim().replace(/\\s+/g, " ")),
      territoryOwnerPolicyVisible: visible(document.getElementById("territoryPolicyForm")),
      territoryRepRadiusVisible: visible(document.getElementById("territoryRepRadiusForm")),
      territoryRepRadiusDisabled: document.getElementById("territoryRepRadiusInput")?.disabled ?? null,
      territoryPolicyStatus: text(document.getElementById("territoryPolicyStatus")),
      territoryRepRadiusStatus: text(document.getElementById("territoryRepRadiusStatus")),
      routeText: text(document.getElementById("view-route")),
      todayText: text(document.getElementById("view-today")),
      placesText: text(document.getElementById("view-places")),
      statsText: text(document.getElementById("view-stats")),
      findText: text(document.getElementById("view-find")),
      routeCards: document.querySelectorAll("#routeList .route-card").length,
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
        territoryCoverage: debug.territoryCoverage || {}
      },
      performance: {
        navigationDuration: Math.round(performance.getEntriesByType("navigation")[0]?.duration || 0),
        activeResourceDuration: Math.round(performance.getEntriesByType("resource").find(entry => entry.name.includes("active-pool.json"))?.duration || 0),
        fullResourceDuration: Math.round(performance.getEntriesByType("resource").find(entry => entry.name.includes("runtime-pools.json"))?.duration || 0)
      }
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
      profileButtonLabels: [...document.querySelectorAll('[data-rep-select]')].filter(visible).map(button => button.textContent.trim()),
      rects: {
        header: rectFor("header"),
        topLine: rectFor(".topline"),
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
    await new Promise(resolve => setTimeout(resolve, 100));
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
      unitsInputValue: unitsInput.value
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

async function verifyRouteNearbyBadgePassive(cdp) {
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
    const after = {
      activeView: document.querySelector(".view.active")?.id || "",
      modalActive: document.getElementById("modal")?.classList.contains("active") || false,
      detailsOpen: card.querySelector(".compact-details")?.hasAttribute("open") || false
    };
    return {
      tagName: badge.tagName.toLowerCase(),
      text: badge.textContent.trim(),
      className: badge.className,
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
    throw new Error(`${error.message}; network=${JSON.stringify(eventLog.network)}`);
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
    && snap.visibleTabs.join(",") === "today,route"
    && snap.visibleOwnerControls.length === 0
    && snap.profileButtonLabels.length === 0
    && !snap.modeButtonLabels.includes("Owner");
  assertWorkflow(label, repOnly, `role ${snap.sessionRole}, mode ${snap.mode}, rep ${snap.activeRepId}, tabs ${snap.visibleTabs.join(", ")}`, JSON.stringify(snap));
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
  const chrome = await launchChrome();

  try {
    const founder = await runPageScenario(chrome, server, "/?role=founder&debug=1&harness=runtime-workflows-founder", "founder");
    const founderSnap = founder.initial;
    assertWorkflow("Founder Mode", founderSnap.sessionRole === "founder" && founderSnap.mode === "owner" && founderSnap.visibleTabs.includes("places") && founderSnap.visibleTabs.includes("stats") && founderSnap.visibleTabs.includes("find"), `owner tabs visible: ${founderSnap.visibleTabs.join(", ")}`, JSON.stringify({ sessionRole: founderSnap.sessionRole, mode: founderSnap.mode, visibleTabs: founderSnap.visibleTabs }));
    assertWorkflow("Active Pool consumption", founderSnap.debug.runtimeDataPool === "active" && founderSnap.debug.runtimeDataSource.includes("runtime-pool-segmentation-v1 active") && founderSnap.debug.runtimeDataSource.includes("594 route records"), founderSnap.debug.runtimeDataSource, JSON.stringify(founderSnap.debug));
    assertWorkflow("Route Intelligence rendering", founderSnap.debug.rendererReceived && founderSnap.bestNextMove && founderSnap.bestNextMove !== "Loading route signal" && founderSnap.dailyRouteCards > 0, `${founderSnap.bestNextMove} with ${founderSnap.dailyRouteCards} daily route cards`, JSON.stringify({ bestNextMove: founderSnap.bestNextMove, dailyRouteCards: founderSnap.dailyRouteCards, debug: founderSnap.debug }));
    assertWorkflow("Directions link generation", founderSnap.bestMoveDirections.startsWith("https://www.google.com/maps/dir/?api=1&destination=") && founderSnap.bestMoveDirections.includes("destination_place_id="), founderSnap.bestMoveDirections, founderSnap.bestMoveDirections);
    assertWorkflow("Discovery Mode", founderSnap.todayText.includes("Discovery Mode") || founderSnap.routeRisk.includes("Discovery Mode") || founderSnap.statsText.includes("Discovery Mode"), founderSnap.routeRisk || "Discovery Mode visible in runtime text", JSON.stringify({ routeRisk: founderSnap.routeRisk, todayText: founderSnap.todayText.slice(0, 300) }));
    verifyNoErrors("Founder", founder.eventLog, founderSnap);

    await clickTab(founder.cdp, "route");
    const routeSnap = await snapshot(founder.cdp);
    assertWorkflow("Build Route workflow", routeSnap.activeView === "view-route" && routeSnap.routeCards > 0 && routeSnap.routeText.includes("Route Builder"), `${routeSnap.routeCards} route cards rendered`, JSON.stringify({ activeView: routeSnap.activeView, routeCards: routeSnap.routeCards, routeText: routeSnap.routeText.slice(0, 300) }));
    assertWorkflow("Beta Stability Sprint 2 Owner route minimum preserved", routeSnap.routeCards >= 6 && /(?:6|[7-9]|10) options/.test(routeSnap.routeCountLabel), `${routeSnap.routeCards} route cards rendered; ${routeSnap.routeCountLabel}`, JSON.stringify({ routeCards: routeSnap.routeCards, routeCountLabel: routeSnap.routeCountLabel }));
    const ownerNearbyBadge = await verifyRouteNearbyBadgePassive(founder.cdp);
    assertWorkflow("Beta Stability Sprint 2 Owner route nearby badge passive", ownerNearbyBadge.tagName === "span" && ownerNearbyBadge.className.includes("passive") && ownerNearbyBadge.pointerEvents === "none" && ownerNearbyBadge.borderStyle === "dashed" && ownerNearbyBadge.text.includes("Nearby context") && !ownerNearbyBadge.role && !ownerNearbyBadge.dataOpen && !ownerNearbyBadge.dataTab && !ownerNearbyBadge.dataQuickPlace && ownerNearbyBadge.before.activeView === ownerNearbyBadge.after.activeView && ownerNearbyBadge.before.modalActive === ownerNearbyBadge.after.modalActive && ownerNearbyBadge.before.detailsOpen === ownerNearbyBadge.after.detailsOpen && ownerNearbyBadge.whyText.includes("Nearby Opportunities"), `${ownerNearbyBadge.text} is passive metadata; nearby context remains in Why details`, JSON.stringify(ownerNearbyBadge));

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
    assertWorkflow("Rep Mode", repSnap.sessionRole === "rep" && repSnap.mode === "rep" && !repSnap.visibleTabs.includes("places") && !repSnap.visibleTabs.includes("stats") && !repSnap.visibleTabs.includes("find"), `rep tabs visible: ${repSnap.visibleTabs.join(", ")}`, JSON.stringify({ sessionRole: repSnap.sessionRole, mode: repSnap.mode, visibleTabs: repSnap.visibleTabs }));
    assertWorkflow("Beta Stability Sprint 2 Rep radius/ring visibility", repSnap.territoryVisible && repSnap.territoryRingCount > 0 && repSnap.territoryText.includes("Assigned Territory Radius") && repSnap.territoryText.includes("Ring"), `${repSnap.territoryRingCount} territory rings visible for ${repSnap.activeRepId}`, JSON.stringify({ territoryVisible: repSnap.territoryVisible, territoryRingCount: repSnap.territoryRingCount, territoryText: repSnap.territoryText.slice(0, 400) }));
    assertWorkflow("Beta Stability Sprint 2 Rep radius locked by default", repSnap.territoryRepRadiusVisible && repSnap.territoryRepRadiusDisabled === true && repSnap.territoryRepRadiusStatus.includes("locked"), repSnap.territoryRepRadiusStatus, JSON.stringify({ territoryRepRadiusVisible: repSnap.territoryRepRadiusVisible, territoryRepRadiusDisabled: repSnap.territoryRepRadiusDisabled, status: repSnap.territoryRepRadiusStatus }));
    assertWorkflow("Beta Stability Sprint 2 ring population evidence", Array.isArray(repSnap.debug.territoryCoverage.ringTotals) && repSnap.debug.territoryCoverage.ringTotals[0] > 0 && repSnap.debug.territoryCoverage.ringTotals.slice(1).every(total => total === 0) && repSnap.debug.territoryCoverage.outerRingEmptyReason.includes("Active Pool") && repSnap.territoryRingTexts.some(text => text.includes("not indexed in Active Pool")), repSnap.debug.territoryCoverage.outerRingEmptyReason, JSON.stringify({ coverage: repSnap.debug.territoryCoverage, ringTexts: repSnap.territoryRingTexts }));
    assertWorkflow("Rep startup defers owner-only views", repSnap.placesItems === 0 && repSnap.debug.deferredOwnerViews.places === false && repSnap.debug.deferredOwnerViews.stats === false && repSnap.debug.deferredOwnerViews.find === false, `owner-only views deferred; render total ${repSnap.debug.renderTimings.total || 0}ms`, JSON.stringify({ placesItems: repSnap.placesItems, renderTimings: repSnap.debug.renderTimings, deferredOwnerViews: repSnap.debug.deferredOwnerViews }));
    await clickTab(rep.cdp, "places");
    const repAfterOwnerTab = await snapshot(rep.cdp);
    assertWorkflow("Rep owner-tab guard", repAfterOwnerTab.activeView === "view-today", "rep remains on Today when owner tab is requested", JSON.stringify({ activeView: repAfterOwnerTab.activeView }));
    assertWorkflow("Rep route quality", repSnap.debug.rendererReceived && repSnap.bestNextMove && repSnap.bestMoveDirections.includes("destination_place_id=") && repSnap.dailyRouteCards > 0, `${repSnap.bestNextMove} with Google Place directions and ${repSnap.dailyRouteCards} route cards`, JSON.stringify({ bestNextMove: repSnap.bestNextMove, directions: repSnap.bestMoveDirections, dailyRouteCards: repSnap.dailyRouteCards }));
    assertWorkflow("Anthony beta readiness", repSnap.sessionRole === "rep" && repSnap.mode === "rep" && repSnap.activeRepId === "anthony" && repSnap.anthonyProfileExists && repSnap.anthonyPoolCount >= 6 && repSnap.debug.runtimeDataPool === "active" && repSnap.appBuildVersion && repSnap.storedAppBuildVersion === repSnap.appBuildVersion, `Anthony profile ready, ${repSnap.anthonyPoolCount} approved route targets, build ${repSnap.appBuildVersion}`, JSON.stringify(repSnap));
    assertWorkflow("Beta Stability Sprint 2 dashboard performance", Number(founderSnap.debug.renderTimings.total || 0) < 5000 && Number(repSnap.debug.renderTimings.total || 0) < 5000 && Number(founderSnap.performance.activeResourceDuration || 0) < 5000 && founder.routeLoadMs < 10000, `founder render ${founderSnap.debug.renderTimings.total || 0}ms, rep render ${repSnap.debug.renderTimings.total || 0}ms, active fetch ${founderSnap.performance.activeResourceDuration || 0}ms, route ready ${founder.routeLoadMs}ms`, JSON.stringify({ founderRender: founderSnap.debug.renderTimings, repRender: repSnap.debug.renderTimings, founderPerformance: founderSnap.performance, routeLoadMs: founder.routeLoadMs }));
    verifyNoErrors("Rep", rep.eventLog, repSnap);
    await clickTab(rep.cdp, "route");
    const repRouteSnap = await snapshot(rep.cdp);
    assertWorkflow("Beta Stability Sprint 2 Anthony route generation expands beyond six", repRouteSnap.routeCards > 6 && /(?:[7-9]|10) options/.test(repRouteSnap.routeCountLabel), `${repRouteSnap.routeCards} Anthony route cards rendered; ${repRouteSnap.routeCountLabel}`, JSON.stringify({ routeCards: repRouteSnap.routeCards, routeCountLabel: repRouteSnap.routeCountLabel, routeText: repRouteSnap.routeText.slice(0, 500) }));
    const hamzaRouting = await verifyHamzaRepeatRecommendation(rep.cdp);
    assertWorkflow("Beta Stability Sprint 2 Hamza repeat recommendation evidence routing", hamzaRouting.daysSinceRecommendation === 0 && !hamzaRouting.bestNextIsHamza && hamzaRouting.reasons.some(reason => reason.includes("recently shown")), `${hamzaRouting.hamzaName} rotated off best-next after same-day route history; best next ${hamzaRouting.bestNextName}`, JSON.stringify(hamzaRouting));
    const repNearbyBadge = await verifyRouteNearbyBadgePassive(rep.cdp);
    assertWorkflow("Beta Stability Sprint 2 Anthony Rep route nearby badge passive", repNearbyBadge.tagName === "span" && repNearbyBadge.className.includes("passive") && repNearbyBadge.pointerEvents === "none" && repNearbyBadge.borderStyle === "dashed" && repNearbyBadge.text.includes("Nearby context") && !repNearbyBadge.role && !repNearbyBadge.dataOpen && !repNearbyBadge.dataTab && !repNearbyBadge.dataQuickPlace && repNearbyBadge.before.activeView === repNearbyBadge.after.activeView && repNearbyBadge.before.modalActive === repNearbyBadge.after.modalActive && repNearbyBadge.before.detailsOpen === repNearbyBadge.after.detailsOpen && repNearbyBadge.whyText.includes("Nearby Opportunities"), `${repNearbyBadge.text} is passive metadata; nearby context remains in Why details`, JSON.stringify(repNearbyBadge));
    await clickTab(rep.cdp, "today");
    const nearbyFlow = await verifyNearbyOpportunitiesFlow(rep.cdp);
    assertWorkflow("Nearby Opportunities empty state", nearbyFlow.emptyBefore.includes("Log a verified route stop"), nearbyFlow.emptyBefore, JSON.stringify(nearbyFlow));
    assertWorkflow("Nearby Opportunities location acquisition", nearbyFlow.latestVisitHasLocation && nearbyFlow.locationButtonLabel === "Location Attached" && nearbyFlow.locationStatus.includes("Device-reported visit location attached"), nearbyFlow.locationStatus, JSON.stringify(nearbyFlow));
    assertWorkflow("Nearby Opportunities Active Pool query", nearbyFlow.beforeRuntimePool === "active" && nearbyFlow.runtimePool === "active" && nearbyFlow.nearbyDebug.originSource === "visit-location", `${nearbyFlow.nearbyDebug.count} nearby from ${nearbyFlow.nearbyDebug.originSource}`, JSON.stringify(nearbyFlow));
    assertWorkflow("Nearby Opportunities rendering", nearbyFlow.cardCount > 0 && nearbyFlow.noEmptyAfter && nearbyFlow.countLabel.includes("within") && nearbyFlow.firstCard.includes("Directions"), `${nearbyFlow.cardCount} nearby cards for ${nearbyFlow.target.name}`, JSON.stringify(nearbyFlow));
    const routeSync = await verifyRouteStateSynchronization(rep.cdp);
    assertWorkflow("Beta Stability Sprint 2 route state synchronization", !routeSync.routePoolStillContainsLogged && !routeSync.routeListStillContainsLogged && !routeSync.dailyRouteStillContainsLogged && !routeSync.bestNextStillLogged, `${routeSync.loggedName} removed from route pool/list/daily/best-next after logging`, JSON.stringify(routeSync));
    verifyNoErrors("Nearby Opportunities", rep.eventLog, await snapshot(rep.cdp));

    const anthonyLog = await runPageScenario(chrome, server, "/?role=rep&rep=anthony&debug=1&harness=anthony-mobile-quick-log", "anthony-mobile-log", {
      standalone: true,
      viewport: { width: 390, height: 667, deviceScaleFactor: 3, mobile: true }
    });
    const quickLog = await verifyMobileQuickLogging(anthonyLog.cdp);
    assertWorkflow("Anthony mobile pin-drop logging reachability", quickLog.reachable && !quickLog.modalActiveAfterSubmit && quickLog.afterUnits > quickLog.beforeUnits && quickLog.documentScrollWidth <= quickLog.viewportWidth + 1 && quickLog.bodyScrollWidth <= quickLog.viewportWidth + 1, `submit reachable, units ${quickLog.beforeUnits} -> ${quickLog.afterUnits}, modal body ${quickLog.modalBodyClientHeight}/${quickLog.modalBodyScrollHeight}`, JSON.stringify(quickLog));
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
    full.cdp.close();
    fallback.cdp.close();
  } finally {
    await chrome.close();
    await server.close();
    await fallbackServer.close();
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
  }
} catch (error) {
  console.error(`FAIL Harness infrastructure: ${error.stack || error.message || error}`);
  process.exitCode = 1;
}
