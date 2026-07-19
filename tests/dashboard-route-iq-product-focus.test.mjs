import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const sha256 = value => createHash("sha256").update(value).digest("hex");

const source = read("index.html");
const deploy = read("deploy/cloudflare-pages/index.html");
const serviceWorker = read("sw.js");
const deployServiceWorker = read("deploy/cloudflare-pages/sw.js");
const historicalSmoothie = read("smoothie-depot-dashboard/index.html");
const historicalSmoothieDeploy = read("deploy/cloudflare-pages/smoothie-depot-dashboard/index.html");

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
  assert.match(source, /if \(sessionRole !== "founder"\)/);
  assert.match(source, /method: "GET"/);
  assert.match(source, /cache: "no-store"/);
  assert.match(source, /credentials: "same-origin"/);
  const consumerStart = source.indexOf("async function loadFounderDailyIntelligence()");
  const consumerEnd = source.indexOf("\n    let state = load();", consumerStart);
  assert.ok(consumerStart > -1 && consumerEnd > consumerStart);
  assert.doesNotMatch(source.slice(consumerStart, consumerEnd), /localStorage|sessionStorage|indexedDB|caches\./);
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
