import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";

import {
  closeHarnessResources,
  createNoncanonicalTestClockSource,
  eventbriteExpansionContract,
  eventbriteExpansionFixture,
  launchChrome,
  parseDevToolsActivePort,
  resolveChromeExecutable
} from "../scripts/verify-dashboard-runtime-workflows.mjs";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const sha256 = value => createHash("sha256").update(value).digest("hex");

const source = read("index.html");
const deploy = read("deploy/cloudflare-pages/index.html");
const serviceWorker = read("sw.js");
const deployServiceWorker = read("deploy/cloudflare-pages/sw.js");
const runtimeWorkflowVerifier = read("scripts/verify-dashboard-runtime-workflows.mjs");
const canonicalFounderSnapshot = JSON.parse(read("intelligence/artifacts/route-iq-commercial-readiness-v1/fitness_connection/founder-daily-intelligence-snapshot-v1.json"));
const historicalSmoothie = read("smoothie-depot-dashboard/index.html");
const historicalSmoothieDeploy = read("deploy/cloudflare-pages/smoothie-depot-dashboard/index.html");

function createHarnessFixture(t) {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "prometheus-dashboard-harness-test-"));
  const profileRoot = join(fixtureRoot, "profiles");
  mkdirSync(profileRoot);
  t.after(() => rmSync(fixtureRoot, { recursive: true, force: true }));
  return { fixtureRoot, profileRoot };
}

function createFakeChrome(fixtureRoot, { exitEarly = false, ignoreSigterm = false } = {}) {
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
        "if (!userDataArg || !args.includes('--remote-debugging-address=127.0.0.1') || !args.includes('--remote-debugging-port=0')) {",
        "  console.error('expected OS-assigned DevTools port');",
        "  process.exit(41);",
        "}",
        "const userDataDir = userDataArg.slice('--user-data-dir='.length);",
        "const server = createServer((request, response) => {",
        "  if (request.url !== '/json/version') {",
        "    response.writeHead(404, { connection: 'close' });",
        "    response.end();",
        "    return;",
        "  }",
        "  const port = server.address().port;",
        "  response.writeHead(200, { 'content-type': 'application/json', connection: 'close' });",
        "  response.end(JSON.stringify({ webSocketDebuggerUrl: 'ws://127.0.0.1:' + port + '/devtools/browser/fake' }));",
        "});",
        "server.listen(0, '127.0.0.1', () => {",
        "  const port = server.address().port;",
        "  setTimeout(() => writeFileSync(join(userDataDir, 'DevToolsActivePort'), String(port) + '\\n/devtools/browser/fake\\n'), 75);",
        "});",
        ignoreSigterm
          ? "process.on('SIGTERM', () => {});"
          : "process.on('SIGTERM', () => server.close(() => process.exit(0)));"
      ];
  writeFileSync(executablePath, `${lines.join("\n")}\n`);
  chmodSync(executablePath, 0o755);
  return executablePath;
}

test("Route IQ is the only active Dashboard product", () => {
  assert.equal(source, deploy);
  assert.match(source, /<title>Route IQ<\/title>/);
  assert.match(source, /apple-mobile-web-app-title" content="Route IQ"/);
  assert.match(source, /<h1>Route IQ<\/h1>/);
  assert.doesNotMatch(source, /data-workspace-select|workspaceSwitch|smoothie_depot|smoothie-depot-dashboard|Smoothie Depot/);
  assert.doesNotMatch(source, /\bGaia\b|\bAthena\b/);
  assert.match(source, /const dashboardWorkspaces = Object\.freeze\(\{\s*fitness_connection:/);
});

test("historical Smoothie Depot Dashboard remains byte-preserved and isolated", () => {
  const expectedHistoricalSha256 = "2ff668f76454deb843179852e07d6b4633e2f3929edf324df53e56b8a4140129";
  assert.equal(sha256(historicalSmoothie), expectedHistoricalSha256);
  assert.equal(sha256(historicalSmoothieDeploy), expectedHistoricalSha256);
  assert.equal(historicalSmoothie, historicalSmoothieDeploy);
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

test("source and deploy service-worker markers remain synchronized", () => {
  assert.equal(serviceWorker, deployServiceWorker);
  assert.match(source, /serviceWorkerCacheVersion = "prometheus-v48-route-iq-product-focus"/);
  assert.match(serviceWorker, /CACHE_NAME = "prometheus-v48-route-iq-product-focus"/);
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
