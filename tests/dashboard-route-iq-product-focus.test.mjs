import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";

import {
  closeHarnessResources,
  createNoncanonicalTestClockSource,
  eventbriteExpansionContract,
  eventbriteExpansionFixture,
  installHarnessSignalCleanup,
  launchChrome,
  parseDevToolsActivePort,
  resolveChromeExecutable
} from "../scripts/verify-dashboard-runtime-workflows.mjs";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const source = read("index.html");
const serviceWorker = read("sw.js");
const runtimeWorkflowVerifier = read("scripts/verify-dashboard-runtime-workflows.mjs");
const canonicalFounderSnapshot = JSON.parse(read("intelligence/artifacts/route-iq-commercial-readiness-v1/fitness_connection/founder-daily-intelligence-snapshot-v1.json"));

function createHarnessFixture(t) {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "prometheus-dashboard-harness-test-"));
  const profileRoot = join(fixtureRoot, "profiles");
  mkdirSync(profileRoot);
  t.after(() => rmSync(fixtureRoot, { recursive: true, force: true }));
  return { fixtureRoot, profileRoot };
}

function createFakeChrome(fixtureRoot, {
  exitEarly = false,
  ignoreSigterm = false,
  neverRespond = false,
  versionDelayMs = 0
} = {}) {
  const executablePath = join(fixtureRoot, "fake-chrome.mjs");
  const lines = exitEarly
    ? [
        "#!/usr/bin/env node",
        "console.error('synthetic Chrome startup failure');",
        "process.exit(23);"
      ]
    : [
        "#!/usr/bin/env node",
        "import { writeFileSync } from 'node:fs';",
        "import { createServer } from 'node:http';",
        "import { join } from 'node:path';",
        "const args = process.argv.slice(2);",
        "const userDataArg = args.find(argument => argument.startsWith('--user-data-dir='));",
        "if (!userDataArg || !args.includes('--remote-debugging-address=127.0.0.1') || !args.includes('--remote-debugging-port=0') || !args.includes('--disable-default-apps') || !args.includes('--disable-extensions')) {",
        "  console.error('expected isolated OS-assigned DevTools launch');",
        "  process.exit(41);",
        "}",
        "const userDataDir = userDataArg.slice('--user-data-dir='.length);",
        "const sockets = new Set();",
        "const server = createServer((request, response) => {",
        "  if (request.url !== '/json/version') {",
        "    response.writeHead(404, { connection: 'close' });",
        "    response.end();",
        "    return;",
        "  }",
        neverRespond ? "  return;" : `  setTimeout(() => {`,
        ...(neverRespond ? [] : [
        "  const port = server.address().port;",
        "  response.writeHead(200, { 'content-type': 'application/json', connection: 'close' });",
        "  response.end(JSON.stringify({ webSocketDebuggerUrl: 'ws://127.0.0.1:' + port + '/devtools/browser/fake' }));",
        `  }, ${Number(versionDelayMs)});`
        ]),
        "});",
        "server.on('connection', socket => {",
        "  sockets.add(socket);",
        "  socket.on('close', () => sockets.delete(socket));",
        "});",
        "server.listen(0, '127.0.0.1', () => {",
        "  const port = server.address().port;",
        "  setTimeout(() => writeFileSync(join(userDataDir, 'DevToolsActivePort'), String(port) + '\\n/devtools/browser/fake\\n'), 75);",
        "});",
        ignoreSigterm
          ? "process.on('SIGTERM', () => {});"
          : "process.on('SIGTERM', () => { for (const socket of sockets) socket.destroy(); server.close(() => process.exit(0)); });"
      ];
  writeFileSync(executablePath, `${lines.join("\n")}\n`);
  chmodSync(executablePath, 0o755);
  return executablePath;
}

test("Route IQ is the only active Dashboard product", () => {
  assert.match(source, /<title>Route IQ<\/title>/);
  assert.match(source, /apple-mobile-web-app-title" content="Route IQ"/);
  assert.match(source, /<h1>Route IQ<\/h1>/);
  assert.doesNotMatch(source, /data-workspace-select|workspaceSwitch|retired_customer_catalog/u);
  assert.doesNotMatch(source, /\bGaia\b|\bAthena\b/);
  assert.match(source, /const dashboardWorkspaces = Object\.freeze\(routeIqCustomerPwaSession/);
  assert.match(source, /\[routeIqCustomerPwaSession\.workspaceId\]: Object\.freeze\(\{/);
  assert.doesNotMatch(source, /workspaceId: "fitness_connection",\s*label:/u);
  assert.match(source, /workspaceId: routeIqCustomerPwaSession\.workspaceId/u);
});

test("obsolete customer-specific Dashboard entry points are absent from current source", () => {
  assert.equal(existsSync(new URL("../retired-customer-dashboard/index.html", import.meta.url)), false);
  assert.equal(existsSync(new URL("../retired-customer-dashboard/command-center.js", import.meta.url)), false);
  assert.equal(existsSync(new URL("../demo-dashboard/index.html", import.meta.url)), false);
});

test("daily intelligence consumer requires exact server-authenticated Cruz mapping", () => {
  assert.match(source, /founderDailyIntelligencePath = "\.\/api\/dashboard\/route-iq\/intelligence\/daily-snapshot"/);
  assert.match(source, /founderDailyIntelligencePrincipalMappingId = "route-iq-founder-access-cruz-v1"/);
  assert.match(source, /founderDailyIntelligencePrincipalId = "riq_principal_7250bf2f7db15371eea3173c4f25953cffd6adf5b29f093ce8f9f0977a70e3c4"/);
  assert.match(source, /principal\.identityContextSource !== "server_verified_identity_mapping"/);
  assert.match(source, /principal\.authenticationAuthority !== "cloudflare_access"/);
  assert.match(source, /principal\.callerSupplied !== false/);
  assert.match(source, /"businessConfigurationVersion", "businessConfigurationSha256"/);
  assert.match(source, /\^\[a-f0-9\]\{64\}\$\/u\.test\(String\(snapshot\.businessConfigurationSha256/);
  assert.match(source, /if \(sessionRole !== "founder"\)/);
  assert.match(source, /method: "GET"/);
  assert.match(source, /cache: "no-store"/);
  assert.match(source, /credentials: "same-origin"/);
  const consumerStart = source.indexOf("async function loadFounderDailyIntelligence()");
  const consumerEnd = source.indexOf("\n    let state = load();", consumerStart);
  assert.ok(consumerStart > -1 && consumerEnd > consumerStart);
  assert.doesNotMatch(source.slice(consumerStart, consumerEnd), /localStorage|sessionStorage|indexedDB|caches\./);
});

test("Dashboard harness consumes the checked-in canonical Intelligence snapshot shape", () => {
  assert.match(runtimeWorkflowVerifier, /intelligence\/artifacts\/route-iq-commercial-readiness-v1\/fitness_connection\/founder-daily-intelligence-snapshot-v1\.json/);
  assert.match(runtimeWorkflowVerifier, /\.\.\.canonicalFounderDailyIntelligenceSnapshot/);
  assert.match(canonicalFounderSnapshot.businessConfigurationSha256, /^[a-f0-9]{64}$/u);
  assert.equal(canonicalFounderSnapshot.safety.recommendationInfluence, "OFF");
  assert.equal(canonicalFounderSnapshot.safety.representativeReadable, false);
});

test("daily snapshot remains read-only and recommendation influence stays off", () => {
  assert.match(source, /id="founderDailyIntelligence" class="owner-only" hidden/);
  assert.match(source, /snapshot\.safety\?\.representativeReadable !== false/);
  assert.match(source, /snapshot\.safety\?\.recommendationInfluence !== "OFF"/);
  assert.match(source, /snapshot\.safety\?\.routeOrderingChanged !== false/);
  assert.match(source, /snapshot\.safety\?\.routeScoringWeightsChanged !== false/);
  assert.match(source, /snapshot\.evidenceClassification !== "FOUNDER_FIELD_RESEARCH"/);
  assert.match(source, /This is governed observation, not a recommendation or prediction/);
});

test("source service worker uses the v50 generic shell and never caches governed runtime data", () => {
  assert.match(source, /serviceWorkerCacheVersion = "prometheus-v50-route-iq-configurable-dashboard"/);
  assert.match(serviceWorker, /CACHE_NAME = "prometheus-v50-route-iq-configurable-dashboard"/);
  assert.match(serviceWorker, /\/administration\/workspace-configurations\//u);
  assert.match(serviceWorker, /\/data\/route-iq-commercial-readiness-v1\//u);
  assert.match(serviceWorker, /fetch\(event\.request, \{ cache: "no-store" \}\)/u);
  assert.doesNotMatch(serviceWorker, /APP_SHELL[\s\S]*index\.html/u);
});

test("Eventbrite expansion uses an explicit advancing clock instead of the wall-clock date", () => {
  const context = {};
  runInNewContext(createNoncanonicalTestClockSource(eventbriteExpansionFixture.now), context);
  const clock = runInNewContext(`({
    now: Date.now(),
    iso: new Date().toISOString(),
    explicit: new Date("2030-01-02T03:04:05.000Z").toISOString(),
    marker: globalThis.__prometheusNoncanonicalTestClock
  })`, context);
  const fixtureEpochMs = Date.parse(eventbriteExpansionFixture.now);
  assert.ok(clock.now >= fixtureEpochMs && clock.now < fixtureEpochMs + 1000);
  assert.match(clock.iso, /^2026-07-19T17:00:00\./u);
  assert.equal(clock.explicit, "2030-01-02T03:04:05.000Z");
  assert.equal(clock.marker.now, eventbriteExpansionFixture.now);
  assert.equal(clock.marker.mode, "advancing-offset");
  assert.equal(eventbriteExpansionFixture.timezoneId, "America/Chicago");
  assert.equal(eventbriteExpansionFixture.localDate, "2026-07-19");
});

test("Eventbrite expansion contract rejects count, access, map, Add, and state regressions", () => {
  const valid = {
    testClockNow: eventbriteExpansionFixture.now,
    testClockMode: "advancing-offset",
    localDate: eventbriteExpansionFixture.localDate,
    eventCards: eventbriteExpansionFixture.expectedCardCount,
    accessCards: eventbriteExpansionFixture.expectedCardCount,
    mapLinks: eventbriteExpansionFixture.expectedCardCount,
    mapLinksValid: true,
    eventbriteLinks: eventbriteExpansionFixture.expectedCardCount,
    eventbriteLinksValid: true,
    addButtons: eventbriteExpansionFixture.expectedCardCount,
    firstCardName: "Houston Biggest Business, Tech & Entrepreneur Networking Soiree",
    addModalActive: true,
    addModalTitle: "Add Place",
    addFormName: "Houston Biggest Business, Tech & Entrepreneur Networking Soiree",
    addFormCategory: "Event",
    addFormAddress: "Bungalow Heights, Houston, TX",
    placeCountUnchanged: true
  };
  assert.equal(eventbriteExpansionContract(valid), true);

  const regressions = [
    ["wall-clock rollover count", { eventCards: 5 }],
    ["empty expansion", { eventCards: 0, accessCards: 0, mapLinks: 0, eventbriteLinks: 0, addButtons: 0 }],
    ["missing access disclosure", { accessCards: 5 }],
    ["missing map action", { mapLinks: 5 }],
    ["unsafe map action", { mapLinksValid: false }],
    ["missing Eventbrite access", { eventbriteLinks: 5 }],
    ["unsafe Eventbrite access", { eventbriteLinksValid: false }],
    ["missing Add action", { addButtons: 5 }],
    ["Add modal did not open", { addModalActive: false }],
    ["Add selected a different event", { addFormName: "Different event" }],
    ["Add lost event category", { addFormCategory: "Business" }],
    ["Add lost event address", { addFormAddress: "" }],
    ["Add mutated state before save", { placeCountUnchanged: false }]
  ];
  for (const [label, change] of regressions) {
    assert.equal(eventbriteExpansionContract({ ...valid, ...change }), false, label);
  }
});

test("Dashboard harness resolves Ubuntu Chrome deterministically and fails closed on invalid configuration", () => {
  const executable = "/usr/bin/google-chrome";
  const isExecutable = candidate => candidate === executable;
  assert.equal(resolveChromeExecutable({
    environment: { PATH: "/usr/local/bin:/usr/bin" },
    platform: "linux",
    isExecutable
  }), executable);
  assert.equal(resolveChromeExecutable({
    environment: { CHROME_PATH: "google-chrome", PATH: "/usr/local/bin:/usr/bin" },
    platform: "linux",
    isExecutable
  }), executable);
  assert.throws(
    () => resolveChromeExecutable({
      environment: { CHROME_PATH: "/missing/chrome", PATH: "/usr/bin" },
      platform: "linux",
      isExecutable
    }),
    /Configured CHROME_PATH is not executable/u
  );
});

test("Dashboard harness validates Chrome's OS-assigned DevTools port record", () => {
  assert.deepEqual(parseDevToolsActivePort("41235\n/devtools/browser/runtime-test\n"), {
    debugPort: 41235,
    browserWebSocketPath: "/devtools/browser/runtime-test"
  });
  assert.throws(() => parseDevToolsActivePort("0\n/devtools/browser/runtime-test\n"), /valid TCP port/u);
  assert.throws(() => parseDevToolsActivePort("41235\n/devtools/page/runtime-test\n"), /browser websocket path/u);
});

test("Dashboard harness waits for DevTools readiness on an OS-assigned loopback port and tears down", async t => {
  const { fixtureRoot, profileRoot } = createHarnessFixture(t);
  const executablePath = createFakeChrome(fixtureRoot);
  const chrome = await launchChrome({
    executablePath,
    tempRoot: profileRoot,
    readinessTimeoutMs: 3000,
    gracefulShutdownTimeoutMs: 500,
    forceShutdownTimeoutMs: 500
  });
  assert.ok(Number.isInteger(chrome.debugPort) && chrome.debugPort > 0);
  assert.equal(readdirSync(profileRoot).length, 1);
  const response = await fetch(`http://127.0.0.1:${chrome.debugPort}/json/version`, {
    signal: AbortSignal.timeout(1000)
  });
  assert.equal(response.status, 200);
  assert.match((await response.json()).webSocketDebuggerUrl, /\/devtools\/browser\/fake$/u);
  await chrome.close();
  await chrome.close();
  assert.deepEqual(readdirSync(profileRoot), []);
});

test("Dashboard harness gives concurrent DevTools readiness one bounded transaction and isolates ports", async t => {
  const { fixtureRoot, profileRoot } = createHarnessFixture(t);
  const executablePath = createFakeChrome(fixtureRoot, { versionDelayMs: 2250 });
  const launches = await Promise.all(Array.from({ length: 4 }, () => launchChrome({
    executablePath,
    tempRoot: profileRoot,
    readinessTimeoutMs: 5000,
    gracefulShutdownTimeoutMs: 500,
    forceShutdownTimeoutMs: 500
  })));
  try {
    assert.equal(new Set(launches.map(chrome => chrome.debugPort)).size, launches.length);
    assert.equal(readdirSync(profileRoot).length, launches.length);
  } finally {
    await Promise.all(launches.map(chrome => chrome.close()));
  }
  assert.deepEqual(readdirSync(profileRoot), []);
});

test("Dashboard harness preserves the DevTools endpoint and timeout cause in readiness diagnostics", async t => {
  const { fixtureRoot, profileRoot } = createHarnessFixture(t);
  const executablePath = createFakeChrome(fixtureRoot, { neverRespond: true });
  await assert.rejects(
    launchChrome({
      executablePath,
      tempRoot: profileRoot,
      readinessTimeoutMs: 1500,
      gracefulShutdownTimeoutMs: 250,
      forceShutdownTimeoutMs: 500
    }),
    error => {
      assert.match(error.message, /Chrome published DevToolsActivePort but its readiness transaction failed/u);
      assert.match(error.message, /endpoint=http:\/\/127\.0\.0\.1:\d+\/json\/version/u);
      assert.match(error.message, /cause=(?:TimeoutError|AbortError)(?: \[\d+\])?: .*timeout/iu);
      assert.ok(["TimeoutError", "AbortError"].includes(error.cause?.name));
      return true;
    }
  );
  assert.deepEqual(readdirSync(profileRoot), []);
});

test("Dashboard harness registers Chrome cleanup before readiness completes", async t => {
  const { fixtureRoot, profileRoot } = createHarnessFixture(t);
  const executablePath = createFakeChrome(fixtureRoot, { versionDelayMs: 3000 });
  let registeredClose;
  const launchOutcome = launchChrome({
    executablePath,
    tempRoot: profileRoot,
    readinessTimeoutMs: 5000,
    gracefulShutdownTimeoutMs: 500,
    forceShutdownTimeoutMs: 500,
    registerCleanup: close => {
      registeredClose = close;
    }
  }).then(chrome => chrome, error => error);
  assert.equal(typeof registeredClose, "function");
  await registeredClose();
  const outcome = await launchOutcome;
  assert.ok(outcome instanceof Error);
  assert.match(outcome.message, /Chrome exited before DevTools readiness/u);
  assert.deepEqual(readdirSync(profileRoot), []);
});

test("Dashboard harness reports premature Chrome exit without waiting for a fetch timeout", async t => {
  const { fixtureRoot, profileRoot } = createHarnessFixture(t);
  const executablePath = createFakeChrome(fixtureRoot, { exitEarly: true });
  const startedAt = Date.now();
  await assert.rejects(
    launchChrome({
      executablePath,
      tempRoot: profileRoot,
      readinessTimeoutMs: 8000,
      gracefulShutdownTimeoutMs: 100,
      forceShutdownTimeoutMs: 100
    }),
    /Chrome exited before DevTools readiness \(code 23\)/u
  );
  assert.ok(Date.now() - startedAt < 3000, "premature exit must beat the readiness deadline");
  assert.deepEqual(readdirSync(profileRoot), []);
});

test("Dashboard harness escalates shutdown and removes the Chrome profile", async t => {
  const { fixtureRoot, profileRoot } = createHarnessFixture(t);
  const executablePath = createFakeChrome(fixtureRoot, { ignoreSigterm: true });
  const chrome = await launchChrome({
    executablePath,
    tempRoot: profileRoot,
    readinessTimeoutMs: 3000,
    gracefulShutdownTimeoutMs: 100,
    forceShutdownTimeoutMs: 1000
  });
  await chrome.close();
  assert.deepEqual(readdirSync(profileRoot), []);
});

test("Dashboard harness closes every acquired resource in reverse order after failure", async () => {
  const closed = [];
  const cleanupFailure = new Error("synthetic cleanup failure");
  const failures = await closeHarnessResources([
    { name: "first server", close: async () => closed.push("first server") },
    { name: "second server", close: async () => { closed.push("second server"); throw cleanupFailure; } },
    { name: "Chrome", close: async () => closed.push("Chrome") }
  ]);
  assert.deepEqual(closed, ["Chrome", "second server", "first server"]);
  assert.deepEqual(failures, [{ name: "second server", error: cleanupFailure }]);
});

test("Dashboard harness completes cleanup once before exiting on an interrupt signal", async () => {
  const processTarget = new EventEmitter();
  const events = [];
  let resolveExit;
  const exited = new Promise(resolve => {
    resolveExit = resolve;
  });
  const remove = installHarnessSignalCleanup(async () => {
    events.push("cleanup:start");
    await Promise.resolve();
    events.push("cleanup:end");
    return [];
  }, {
    processTarget,
    onSignal: signal => events.push(`signal:${signal}`),
    reportError: message => events.push(`error:${message}`),
    exitProcess: code => {
      events.push(`exit:${code}`);
      resolveExit();
    }
  });

  processTarget.emit("SIGTERM");
  processTarget.emit("SIGINT");
  await exited;
  remove();
  assert.deepEqual(events, ["signal:SIGTERM", "cleanup:start", "cleanup:end", "exit:143"]);
});
