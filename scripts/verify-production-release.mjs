import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Script } from "node:vm";

const root = resolve(import.meta.dirname, "..");
const productionUrlDefault = "https://prometheus-iq.prometheusrouteiq.workers.dev";
const workerNameDefault = "prometheus-iq";
const activePoolPath = "/data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/active-pool.json";
const fullPoolPath = "/data/qualified-prospects/google-qualified-businesses-v2/runtime-pools.json";

const args = parseArgs(process.argv.slice(2));
const productionUrl = normalizeOrigin(args.productionUrl || process.env.PROMETHEUS_PRODUCTION_URL || productionUrlDefault);
const workerName = args.workerName || process.env.PROMETHEUS_WORKER_NAME || workerNameDefault;
const expectedWorkerVersion = args.expectedWorkerVersion || process.env.PROMETHEUS_EXPECTED_WORKER_VERSION || "";
const localOnly = Boolean(args.localOnly);
const skipExistingGates = Boolean(args.skipExistingGates);
const cdpEndpoint = args.cdp || process.env.PROMETHEUS_PRODUCTION_CDP || "";
const authCookie = args.authCookie || readEnvCookie();

const report = {
  status: "passed",
  productionUrl,
  workerName,
  expectedWorkerVersion: expectedWorkerVersion || null,
  checks: []
};

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--local-only") parsed.localOnly = true;
    else if (token === "--skip-existing-gates") parsed.skipExistingGates = true;
    else if (token === "--json") parsed.json = true;
    else if (token.startsWith("--production-url=")) parsed.productionUrl = token.slice("--production-url=".length);
    else if (token === "--production-url") parsed.productionUrl = argv[++index];
    else if (token.startsWith("--worker-name=")) parsed.workerName = token.slice("--worker-name=".length);
    else if (token === "--worker-name") parsed.workerName = argv[++index];
    else if (token.startsWith("--expected-worker-version=")) parsed.expectedWorkerVersion = token.slice("--expected-worker-version=".length);
    else if (token === "--expected-worker-version") parsed.expectedWorkerVersion = argv[++index];
    else if (token.startsWith("--cdp=")) parsed.cdp = token.slice("--cdp=".length);
    else if (token === "--cdp") parsed.cdp = argv[++index];
    else if (token.startsWith("--auth-cookie=")) parsed.authCookie = token.slice("--auth-cookie=".length);
    else if (token === "--auth-cookie") parsed.authCookie = argv[++index];
    else if (token === "--help") parsed.help = true;
    else throw new Error(`Unknown argument: ${token}`);
  }
  return parsed;
}

function readEnvCookie() {
  if (process.env.PROMETHEUS_ACCESS_COOKIE) return process.env.PROMETHEUS_ACCESS_COOKIE;
  const pairs = [];
  if (process.env.CF_AUTHORIZATION) pairs.push(`CF_Authorization=${process.env.CF_AUTHORIZATION}`);
  if (process.env.CF_APPSESSION) pairs.push(`CF_AppSession=${process.env.CF_APPSESSION}`);
  return pairs.join("; ");
}

function normalizeOrigin(value) {
  const url = new URL(value);
  return url.origin;
}

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function addCheck(name, status, details = {}) {
  const check = { name, status, ...details };
  report.checks.push(check);
  if (status === "failed") report.status = "failed";
  return check;
}

function failMessage(error) {
  return error?.stderr?.toString?.().trim() || error?.stdout?.toString?.().trim() || error?.message || String(error);
}

function runCommand(command, commandArgs, options = {}) {
  return execFileSync(command, commandArgs, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options
  });
}

function runExistingGate(name, command, commandArgs) {
  try {
    const output = runCommand(command, commandArgs);
    addCheck(name, "passed", { command: [command, ...commandArgs].join(" "), summary: summarizeOutput(output) });
  } catch (error) {
    addCheck(name, "failed", { command: [command, ...commandArgs].join(" "), error: failMessage(error) });
  }
}

function summarizeOutput(output) {
  return output.trim().split("\n").slice(-8).join("\n");
}

function getInlineScript(html) {
  const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
  return { scripts, script: scripts.length === 1 ? scripts[0][1] : "" };
}

function getConst(script, name) {
  return (script.match(new RegExp(`const\\s+${name}\\s+=\\s+"([^"]+)"`)) || [])[1] || "";
}

function parseHeaderFile(content) {
  const headers = new Map();
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s{2}([^:]+):\s*(.+)$/);
    if (match) headers.set(match[1].toLowerCase(), match[2]);
  }
  return headers;
}

function headerValue(headers, name) {
  if (!headers) return "";
  if (headers instanceof Map) return headers.get(name.toLowerCase()) || "";
  return headers.get(name) || headers.get(name.toLowerCase()) || "";
}

function assertLocalArtifacts() {
  const index = read("index.html");
  const deployIndex = read("deploy/cloudflare-pages/index.html");
  const serviceWorker = read("sw.js");
  const deployServiceWorker = read("deploy/cloudflare-pages/sw.js");
  const headers = read("_headers");
  const deployHeaders = read("deploy/cloudflare-pages/_headers");
  const activePool = read(`.${activePoolPath}`);
  const deployActivePool = read(`deploy/cloudflare-pages${activePoolPath}`);
  const fullPool = read(`.${fullPoolPath}`);
  const deployFullPool = read(`deploy/cloudflare-pages${fullPoolPath}`);
  const manifest = JSON.parse(read("deploy/cloudflare-pages/manifest.webmanifest"));
  const { scripts, script } = getInlineScript(index);
  const deployScript = getInlineScript(deployIndex).script;
  const hash = script ? `sha256-${createHash("sha256").update(script, "utf8").digest("base64")}` : "";
  const swCacheName = (serviceWorker.match(/CACHE_NAME\s*=\s*"([^"]+)"/) || [])[1] || "";
  const buildMarker = getConst(script, "appBuildVersion");
  const serviceWorkerCacheVersion = getConst(script, "serviceWorkerCacheVersion");
  const runtimeDatasetActivePath = getConst(script, "runtimeDatasetActivePath");
  const runtimeDatasetExpectedVersion = getConst(script, "runtimeDatasetExpectedVersion");
  const headersMap = parseHeaderFile(headers);
  const deployHeadersMap = parseHeaderFile(deployHeaders);
  const failures = [];

  if (index !== deployIndex) failures.push("index.html and deploy/cloudflare-pages/index.html differ.");
  if (serviceWorker !== deployServiceWorker) failures.push("sw.js and deploy/cloudflare-pages/sw.js differ.");
  if (headers !== deployHeaders) failures.push("_headers and deploy/cloudflare-pages/_headers differ.");
  if (activePool !== deployActivePool) failures.push("Active pool source and deploy asset differ.");
  if (fullPool !== deployFullPool) failures.push("Full runtime pool source and deploy asset differ.");
  if (scripts.length !== 1) failures.push(`Expected exactly one inline app script; found ${scripts.length}.`);
  if (script !== deployScript) failures.push("Source and deploy inline app scripts differ.");
  if (script) {
    try {
      new Script(script, { filename: "prometheus-production-inline.js" });
    } catch (error) {
      failures.push(`Inline app script does not parse: ${error.message}`);
    }
  }
  if (!headers.includes(`'${hash}'`) || !deployHeaders.includes(`'${hash}'`)) failures.push("CSP header hash does not match current inline script.");
  if (!buildMarker) failures.push("Build marker is missing.");
  if (!serviceWorkerCacheVersion) failures.push("Service worker cache marker is missing.");
  if (serviceWorkerCacheVersion !== swCacheName) failures.push("Service worker cache marker does not match sw.js CACHE_NAME.");
  if (runtimeDatasetActivePath !== `.${activePoolPath}`) failures.push("Runtime active dataset path does not point at the active pool asset.");
  if (runtimeDatasetExpectedVersion !== "google-qualified-businesses-v2") failures.push("Runtime dataset expected version is not google-qualified-businesses-v2.");
  if (!manifest.display || manifest.display !== "standalone") failures.push("PWA manifest display must remain standalone.");
  if (!index.includes('name="mobile-web-app-capable"')) failures.push("PWA mobile-web-app-capable meta is missing.");
  if (/<meta[^>]+Content-Security-Policy[^>]+frame-ancestors/i.test(index)) failures.push("Meta CSP must not include frame-ancestors; keep frame-ancestors in HTTP headers.");

  for (const [label, map] of [["root _headers", headersMap], ["deploy _headers", deployHeadersMap]]) {
    for (const required of ["cache-control", "content-security-policy", "x-content-type-options", "x-frame-options", "referrer-policy", "permissions-policy", "strict-transport-security", "x-robots-tag"]) {
      if (!headerValue(map, required)) failures.push(`${label} is missing ${required}.`);
    }
    const csp = headerValue(map, "content-security-policy");
    if (!csp.includes("frame-ancestors 'none'")) failures.push(`${label} CSP must include frame-ancestors 'none'.`);
    if (!/no-store/i.test(headerValue(map, "cache-control"))) failures.push(`${label} Cache-Control must include no-store.`);
  }

  addCheck("deployed artifact/build parity", failures.length ? "failed" : "passed", {
    buildMarker,
    serviceWorkerCacheVersion,
    runtimeDatasetActivePath,
    runtimeDatasetExpectedVersion,
    failures
  });

  return { index, deployIndex, serviceWorker, deployServiceWorker, headers, deployHeaders, script, hash, buildMarker, serviceWorkerCacheVersion, runtimeDatasetActivePath };
}

function parseLatestDeployment(output) {
  const blocks = output.split(/\n(?=Created:\s+)/).map(block => block.trim()).filter(Boolean);
  const deployments = blocks.map(block => {
    const created = (block.match(/Created:\s+(.+)/) || [])[1]?.trim() || "";
    const message = (block.match(/Message:\s+(.+)/) || [])[1]?.trim() || "";
    const version = (block.match(/Version\(s\):\s+\(100%\)\s+([0-9a-f-]+)/i) || [])[1] || "";
    return { created, message, version, rollout: version ? "100%" : "" };
  }).filter(deployment => deployment.created && deployment.version);
  deployments.sort((left, right) => new Date(right.created) - new Date(left.created));
  return deployments[0] || null;
}

function sha256(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function verifyWrangler() {
  if (localOnly) {
    addCheck("Wrangler deployment status and version consistency", "skipped", { reason: "--local-only" });
    return null;
  }
  try {
    const versionOutput = runCommand("npx", ["wrangler", "--version"]).trim();
    const deploymentsOutput = runCommand("npx", ["wrangler", "deployments", "list", "--name", workerName], { timeout: 45_000 });
    const versionsOutput = runCommand("npx", ["wrangler", "versions", "list", "--name", workerName], { timeout: 45_000 });
    const latest = parseLatestDeployment(deploymentsOutput);
    const failures = [];
    if (!latest) failures.push("No 100% Wrangler deployment was found.");
    if (latest && !versionsOutput.includes(latest.version)) failures.push(`Latest deployment version ${latest.version} was not found in wrangler versions list.`);
    if (expectedWorkerVersion && latest?.version !== expectedWorkerVersion) failures.push(`Expected Worker version ${expectedWorkerVersion}; latest is ${latest?.version || "unknown"}.`);
    addCheck("Wrangler deployment status and version consistency", failures.length ? "failed" : "passed", {
      wrangler: versionOutput,
      latestDeployment: latest,
      failures
    });
    return latest;
  } catch (error) {
    addCheck("Wrangler deployment status and version consistency", "failed", { error: failMessage(error) });
    return null;
  }
}

async function request(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 20_000);
  try {
    return await fetch(`${productionUrl}${path}`, {
      redirect: options.redirect || "manual",
      headers: options.headers || {},
      cache: "no-store",
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function verifyAccessProtection() {
  if (localOnly) {
    addCheck("authenticated Cloudflare Access protection", "skipped", { reason: "--local-only" });
    return;
  }
  const paths = ["/", "/sw.js", activePoolPath];
  const results = [];
  const failures = [];
  for (const path of paths) {
    try {
      const response = await request(path, { redirect: "manual" });
      const location = response.headers.get("location") || "";
      const protectedByAccess = response.status >= 300 && response.status < 400 && /cloudflareaccess\.com|\/cdn-cgi\/access\//i.test(location);
      results.push({ path, status: response.status, protectedByAccess, locationHost: location ? new URL(location, productionUrl).host : "" });
      if (!protectedByAccess) failures.push(`${path} did not redirect through Cloudflare Access.`);
    } catch (error) {
      failures.push(`${path} request failed: ${error.message}`);
    }
  }
  addCheck("authenticated Cloudflare Access protection", failures.length ? "failed" : "passed", { results, failures });
}

async function getCookieFromCdp() {
  if (!cdpEndpoint) return "";
  const targetListUrl = cdpEndpoint.replace(/\/$/, "") + "/json/list";
  const targets = await fetchJson(targetListUrl);
  const page = targets.find(target => target.type === "page" && target.webSocketDebuggerUrl) || targets.find(target => target.webSocketDebuggerUrl);
  if (!page) throw new Error("No CDP page target with a WebSocket debugger URL was found.");
  const client = await connectCdp(page.webSocketDebuggerUrl);
  try {
    await client.send("Network.enable");
    const cookies = await client.send("Network.getCookies", { urls: [`${productionUrl}/`] });
    return cookies.result.cookies
      .filter(cookie => ["CF_Authorization", "CF_AppSession"].includes(cookie.name))
      .map(cookie => `${cookie.name}=${cookie.value}`)
      .join("; ");
  } finally {
    client.close();
  }
}

async function fetchJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

async function connectCdp(webSocketDebuggerUrl) {
  if (typeof WebSocket !== "function") throw new Error("Global WebSocket is unavailable in this Node runtime.");
  const socket = new WebSocket(webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const listeners = new Map();
  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
    if (message.method && listeners.has(message.method)) {
      for (const listener of listeners.get(message.method)) listener(message.params);
    }
  });
  await new Promise((resolveOpen, rejectOpen) => {
    socket.addEventListener("open", resolveOpen, { once: true });
    socket.addEventListener("error", rejectOpen, { once: true });
  });
  return {
    send(method, params = {}) {
      return new Promise(resolveSend => {
        const messageId = ++id;
        pending.set(messageId, resolveSend);
        socket.send(JSON.stringify({ id: messageId, method, params }));
      });
    },
    on(method, listener) {
      if (!listeners.has(method)) listeners.set(method, []);
      listeners.get(method).push(listener);
    },
    close() {
      socket.close();
    }
  };
}

async function verifyAuthenticatedAssets(localContracts) {
  if (localOnly) {
    addCheck("authenticated production route availability and HTTP headers", "skipped", { reason: "--local-only" });
    return { cookie: "" };
  }

  let cookie = authCookie;
  if (!cookie && cdpEndpoint) {
    try {
      cookie = await getCookieFromCdp();
    } catch (error) {
      addCheck("authenticated cookie discovery", "failed", { error: error.message });
      return { cookie: "" };
    }
  }

  if (!cookie) {
    addCheck("authenticated production route availability and HTTP headers", "failed", {
      reason: "Set PROMETHEUS_ACCESS_COOKIE, CF_AUTHORIZATION/CF_APPSESSION, or --cdp http://127.0.0.1:<port> for authenticated production verification."
    });
    return { cookie: "" };
  }

  addCheck("authenticated cookie discovery", "passed", { source: authCookie ? "environment/argument" : "CDP", cookieNames: cookie.match(/\bCF_[A-Za-z]+=/g)?.map(value => value.replace("=", "")) || [] });

  const headers = { Cookie: cookie, "Cache-Control": "no-cache", Pragma: "no-cache" };
  const failures = [];
  const indexResponse = await request("/?releaseGate=production", { headers, redirect: "manual" });
  const serviceWorkerResponse = await request("/sw.js?releaseGate=production", { headers, redirect: "manual" });
  const activePoolResponse = await request(`${activePoolPath}?releaseGate=production`, { headers, redirect: "manual" });
  const manifestResponse = await request("/manifest.webmanifest?releaseGate=production", { headers, redirect: "manual" });
  const index = await indexResponse.text();
  const serviceWorker = await serviceWorkerResponse.text();
  const activePoolText = await activePoolResponse.text();
  const manifestText = await manifestResponse.text();
  const localDeployIndex = read("deploy/cloudflare-pages/index.html");
  const localDeployServiceWorker = read("deploy/cloudflare-pages/sw.js");
  const localDeployActivePool = read(`deploy/cloudflare-pages${activePoolPath}`);
  const localDeployManifest = read("deploy/cloudflare-pages/manifest.webmanifest");
  const liveScript = getInlineScript(index).script;
  const liveHash = liveScript ? `sha256-${createHash("sha256").update(liveScript, "utf8").digest("base64")}` : "";
  const liveBuildMarker = getConst(liveScript, "appBuildVersion");
  const liveServiceWorkerVersion = getConst(liveScript, "serviceWorkerCacheVersion");
  const liveActivePath = getConst(liveScript, "runtimeDatasetActivePath");
  const swCacheName = (serviceWorker.match(/CACHE_NAME\s*=\s*"([^"]+)"/) || [])[1] || "";
  let activePool = {};
  let manifest = {};

  try {
    activePool = JSON.parse(activePoolText);
  } catch (error) {
    failures.push(`Active pool response is not JSON: ${error.message}`);
  }
  try {
    manifest = JSON.parse(manifestText);
  } catch (error) {
    failures.push(`Manifest response is not JSON: ${error.message}`);
  }

  for (const [label, response] of [["index", indexResponse], ["service worker", serviceWorkerResponse], ["active pool", activePoolResponse], ["manifest", manifestResponse]]) {
    if (response.status !== 200) failures.push(`${label} returned HTTP ${response.status}.`);
  }

  const requiredLiveHeaders = ["cache-control", "content-security-policy", "x-content-type-options", "x-frame-options", "referrer-policy", "permissions-policy", "strict-transport-security", "x-robots-tag"];
  for (const header of requiredLiveHeaders) {
    if (!headerValue(indexResponse.headers, header)) failures.push(`Live index is missing ${header}.`);
  }
  const liveCsp = headerValue(indexResponse.headers, "content-security-policy");
  if (!/no-store/i.test(headerValue(indexResponse.headers, "cache-control"))) failures.push("Live index Cache-Control must include no-store.");
  if (!liveCsp.includes("frame-ancestors 'none'")) failures.push("Live CSP must include frame-ancestors 'none'.");
  if (!liveCsp.includes(`'${liveHash}'`)) failures.push("Live CSP hash does not match the live inline script.");
  if (sha256(index) !== sha256(localDeployIndex)) failures.push("Live index.html does not match the local deployment package.");
  if (sha256(serviceWorker) !== sha256(localDeployServiceWorker)) failures.push("Live sw.js does not match the local deployment package.");
  if (sha256(activePoolText) !== sha256(localDeployActivePool)) failures.push("Live Active pool does not match the local deployment package.");
  if (sha256(manifestText) !== sha256(localDeployManifest)) failures.push("Live PWA manifest does not match the local deployment package.");
  if (/<meta[^>]+Content-Security-Policy[^>]+frame-ancestors/i.test(index)) failures.push("Live meta CSP still includes frame-ancestors.");
  if (liveBuildMarker !== localContracts.buildMarker) failures.push(`Live build marker ${liveBuildMarker || "missing"} does not match local ${localContracts.buildMarker}.`);
  if (liveServiceWorkerVersion !== localContracts.serviceWorkerCacheVersion) failures.push(`Live service worker marker ${liveServiceWorkerVersion || "missing"} does not match local ${localContracts.serviceWorkerCacheVersion}.`);
  if (swCacheName !== localContracts.serviceWorkerCacheVersion) failures.push(`Live sw.js cache ${swCacheName || "missing"} does not match local ${localContracts.serviceWorkerCacheVersion}.`);
  if (liveActivePath !== localContracts.runtimeDatasetActivePath) failures.push("Live runtime active path does not match the deployed artifact.");
  if (activePool.pool !== "active") failures.push("Live active pool response does not declare pool=active.");
  if (activePool.sourceDatasetVersion !== "google-qualified-businesses-v2") failures.push("Live active pool sourceDatasetVersion mismatch.");
  if (!Array.isArray(activePool.records) || activePool.records.length !== activePool.count) failures.push("Live active pool records length does not match count.");
  if (manifest.display !== "standalone") failures.push("Live PWA manifest display must be standalone.");
  if (/maps\.googleapis\.com|places\.googleapis\.com|GOOGLE_(?:MAPS|PLACES)_API_KEY|AIza/.test(index)) failures.push("Live index contains a Google API endpoint/key reference.");

  addCheck("authenticated production route availability and HTTP headers", failures.length ? "failed" : "passed", {
    statuses: {
      index: indexResponse.status,
      serviceWorker: serviceWorkerResponse.status,
      activePool: activePoolResponse.status,
      manifest: manifestResponse.status
    },
    buildMarker: liveBuildMarker,
    serviceWorkerVersion: liveServiceWorkerVersion,
    swCacheName,
    activePool: {
      pool: activePool.pool || null,
      sourceDatasetVersion: activePool.sourceDatasetVersion || null,
      count: activePool.count || null,
      records: Array.isArray(activePool.records) ? activePool.records.length : null
    },
    pwa: {
      name: manifest.name || manifest.short_name || null,
      display: manifest.display || null,
      start_url: manifest.start_url || null
    },
    failures
  });

  return { cookie };
}

function runtimeSmokeExpression(role) {
  return `(() => {
    const text = document.body?.innerText || "";
    const scripts = Array.from(document.scripts).map(script => script.textContent || "").join("\\n");
    const get = re => (scripts.match(re) || [])[1] || null;
    const links = Array.from(document.querySelectorAll("a")).slice(0, 300).map(anchor => ({
      text: (anchor.innerText || anchor.textContent || "").trim(),
      href: anchor.href
    }));
    const directions = links.filter(link => /Directions/i.test(link.text) && /google\\.com\\/maps\\/dir/.test(link.href));
    return {
      role: ${JSON.stringify(role)},
      url: location.href,
      title: document.title,
      bodyDataset: { ...document.body.dataset },
      buildMarker: get(/const appBuildVersion = "([^"]+)"/),
      serviceWorkerVersion: get(/const serviceWorkerCacheVersion = "([^"]+)"/),
      activePath: get(/const runtimeDatasetActivePath = "([^"]+)"/),
      renderOk: text.includes("Prometheus IQ"),
      founderMode: document.body?.dataset?.sessionRole === "founder" || /Founder/i.test(text),
      repMode: document.body?.dataset?.sessionRole === "rep" || /\\bRep\\b/i.test(text),
      routeInitialized: /Today.?s Route|Route Intelligence|Build Route/i.test(text),
      routeIntelligence: /Route Intelligence/i.test(text),
      discoveryMode: /Discovery Mode|New Rep Discovery/i.test(text),
      buildRoute: /Build Route/i.test(text),
      directionsCount: directions.length
    };
  })()`;
}

async function verifyBrowserRuntime(localContracts) {
  if (localOnly) {
    addCheck("JavaScript/runtime startup health", "skipped", { reason: "--local-only" });
    return;
  }
  if (!cdpEndpoint) {
    addCheck("JavaScript/runtime startup health", "failed", { reason: "Provide --cdp http://127.0.0.1:<port> for authenticated browser runtime verification." });
    return;
  }
  try {
    const targets = await fetchJson(cdpEndpoint.replace(/\/$/, "") + "/json/list");
    const page = targets.find(target => target.type === "page" && target.webSocketDebuggerUrl);
    if (!page) throw new Error("No page target found for browser runtime verification.");
    const client = await connectCdp(page.webSocketDebuggerUrl);
    const token = `release-gate-${Date.now()}`;
    const events = { exceptions: [], console: [], logs: [], failed: [], badResponses: [], googleApiFailures: [] };
    const isCurrent = value => String(value || "").includes(token);

    client.on("Runtime.exceptionThrown", params => {
      events.exceptions.push(params.exceptionDetails?.exception?.description || params.exceptionDetails?.text || "runtime exception");
    });
    client.on("Runtime.consoleAPICalled", params => {
      if (["error", "warning", "warn"].includes(params.type)) {
        events.console.push({ type: params.type, text: (params.args || []).map(arg => arg.value || arg.description || "").join(" ") });
      }
    });
    client.on("Log.entryAdded", params => {
      if (["error", "warning"].includes(params.entry?.level) && isCurrent(params.entry?.url)) {
        events.logs.push({ level: params.entry.level, text: params.entry.text, url: params.entry.url });
      }
    });
    client.on("Network.loadingFailed", params => {
      if (!params.canceled) events.failed.push({ errorText: params.errorText, blockedReason: params.blockedReason || null });
    });
    client.on("Network.responseReceived", params => {
      const url = params.response?.url || "";
      if (/googleapis\.com/i.test(url) && params.response.status >= 400) events.googleApiFailures.push({ status: params.response.status, url });
      if (isCurrent(url) && params.response.status >= 400 && !/favicon|chrome-extension/.test(url)) {
        events.badResponses.push({ status: params.response.status, url });
      }
    });

    await client.send("Runtime.enable");
    await client.send("Log.enable");
    await client.send("Network.enable");
    await client.send("Page.enable");
    await client.send("Network.setCacheDisabled", { cacheDisabled: true });

    const founder = await navigateAndSmoke(client, `${productionUrl}/?role=founder&rep=cruz&verify=${token}`, "founder");
    const rep = await navigateAndSmoke(client, `${productionUrl}/?role=rep&rep=anthony&verify=${token}`, "rep");
    client.close();

    const failures = [];
    for (const smoke of [founder, rep]) {
      if (!smoke.renderOk) failures.push(`${smoke.role} render did not include Prometheus IQ.`);
      if (smoke.role === "founder" && !smoke.founderMode) failures.push("Founder smoke did not enter Founder mode.");
      if (smoke.role === "rep" && !smoke.repMode) failures.push("Rep smoke did not enter Rep mode.");
      if (smoke.buildMarker !== localContracts.buildMarker) failures.push(`${smoke.role} build marker mismatch.`);
      if (smoke.serviceWorkerVersion !== localContracts.serviceWorkerCacheVersion) failures.push(`${smoke.role} service worker marker mismatch.`);
      if (!smoke.routeInitialized || !smoke.routeIntelligence || !smoke.discoveryMode || !smoke.buildRoute || smoke.directionsCount < 1) failures.push(`${smoke.role} route startup feature checks failed.`);
    }
    if (events.exceptions.length) failures.push("Browser runtime exceptions were emitted.");
    if (events.console.length) failures.push("Browser console errors/warnings were emitted.");
    if (events.logs.length) failures.push("Browser log errors/warnings were emitted.");
    if (events.failed.length) failures.push("Network loading failures were emitted.");
    if (events.badResponses.length) failures.push("Production route returned bad HTTP responses.");
    if (events.googleApiFailures.length) failures.push("Google API production failures were emitted.");

    addCheck("JavaScript/runtime startup health", failures.length ? "failed" : "passed", {
      founder,
      rep,
      events,
      failures
    });
  } catch (error) {
    addCheck("JavaScript/runtime startup health", "failed", { error: error.message });
  }
}

async function navigateAndSmoke(client, url, role) {
  await client.send("Page.navigate", { url });
  await new Promise(resolve => setTimeout(resolve, 7_000));
  const result = await client.send("Runtime.evaluate", {
    expression: runtimeSmokeExpression(role),
    returnByValue: true
  });
  return result.result.result.value;
}

function printReport() {
  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log(`Production release verification: ${report.status.toUpperCase()}`);
  for (const check of report.checks) {
    console.log(`${check.status.toUpperCase().padEnd(7)} ${check.name}`);
    if (check.failures?.length) {
      for (const failure of check.failures) console.log(`        - ${failure}`);
    } else if (check.error) {
      console.log(`        - ${check.error}`);
    } else if (check.reason) {
      console.log(`        - ${check.reason}`);
    }
  }
  console.log(JSON.stringify(report, null, 2));
}

if (args.help) {
  console.log(`Usage: node scripts/verify-production-release.mjs [options]

Options:
  --production-url <url>             Production origin. Default: ${productionUrlDefault}
  --worker-name <name>               Cloudflare Worker name. Default: ${workerNameDefault}
  --expected-worker-version <id>     Require the latest Wrangler deployment to match this version.
  --auth-cookie <cookie-header>      Authenticated Cloudflare Access cookie header.
  --cdp <http://127.0.0.1:port>      Authenticated Chrome DevTools endpoint for cookie and browser runtime checks.
  --local-only                       Run local artifact and existing release gates only.
  --skip-existing-gates              Do not run existing npm verification gates.
  --json                             Emit JSON report only.
`);
  process.exit(0);
}

if (!skipExistingGates) {
  const scripts = JSON.parse(read("package.json")).scripts || {};
  const gates = [
    ["existing security gate", "security:check"],
    ["existing active runtime pool gate", "dashboard:runtime-pool:check"],
    ["existing dashboard runtime workflows gate", "dashboard:runtime-workflows:check"],
    ["existing zero live Google API gate", "verify:zero-google-api"]
  ];
  for (const [name, scriptName] of gates) {
    if (scripts[scriptName]) runExistingGate(name, "npm", ["run", scriptName]);
  }
}

const localContracts = assertLocalArtifacts();
verifyWrangler();
await verifyAccessProtection();
await verifyAuthenticatedAssets(localContracts);
await verifyBrowserRuntime(localContracts);
printReport();

if (report.status !== "passed") process.exitCode = 1;
