import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  governedRuntimeNetworkOnlyPath,
  routeIqPaidCustomerPreviewPath
} from "../dashboard/route-iq-dashboard-platform.mjs";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const dashboard = read("index.html");
const serviceWorker = read("sw.js");
const runtimeHarness = read("scripts/verify-dashboard-runtime-workflows.mjs");

test("paid-customer preview is an accessible read-only internal view", () => {
  const preview = dashboard.match(
    /<section class="paid-customer-preview"[\s\S]*?<\/section>\s*<div id="founderDailyIntelligence"/u
  )?.[0] || "";
  assert.match(preview, /aria-labelledby="paidCustomerConfigurationPreviewTitle"/u);
  assert.match(preview, /aria-live="polite"/u);
  assert.match(preview, /Read-only and non-activating/u);
  assert.match(preview, /Representative and manager terms/u);
  assert.match(preview, /Metrics and goals/u);
  assert.match(preview, /Authorized territories/u);
  assert.match(preview, /Verification and freshness/u);
  assert.doesNotMatch(preview, /<(?:button|form|input|select|textarea)\b/iu);
});

test("exact 390x844 mobile contract keeps the preview single-column and overflow-safe", () => {
  assert.match(runtimeHarness, /width:\s*390,\s*height:\s*844/gu);
  assert.match(runtimeHarness, /Customer PWA 390x844 Today no-horizontal-scroll/u);
  assert.match(dashboard, /@media \(max-width: 520px\)[\s\S]*?\.paid-customer-preview-summary,[\s\S]*?\.paid-customer-preview-sections\s*\{\s*grid-template-columns: 1fr;/u);
  assert.match(dashboard, /\.paid-customer-preview-summary div,[\s\S]*?min-width: 0;/u);
  assert.match(dashboard, /\.paid-customer-preview-summary b,[\s\S]*?overflow-wrap: anywhere;/u);
});

test("preview fetch is network-only and never receives an offline cached response", () => {
  assert.equal(governedRuntimeNetworkOnlyPath(routeIqPaidCustomerPreviewPath), true);
  assert.match(
    dashboard,
    /dashboardPlatformModulePath = "\.\/dashboard\/route-iq-dashboard-platform\.mjs\?paid-customer-preview-v1"/u
  );
  assert.match(serviceWorker, /"\/api\/dashboard\/"/u);
  assert.match(serviceWorker, /fetch\(event\.request, \{ cache: "no-store" \}\)\.catch/u);
  assert.doesNotMatch(serviceWorker, /caches\.match\(event\.request\).*\/api\/dashboard/su);
});

test("expired sessions and missing paid-customer configuration have distinct safe states", () => {
  assert.match(dashboard, /renderRouteIqCustomerPwaSessionBlocked\("expired"\)/u);
  assert.match(dashboard, /state === "configuration_unavailable"/u);
  assert.match(dashboard, /No paid-customer configuration selected/u);
  assert.match(dashboard, /No paid-customer configuration is selected or activated for this secure session/u);
  assert.match(dashboard, /Your secure session is missing, expired, or outside the authorized workspace/u);
});

test("active private interface contains no test-era customer or person assumptions", () => {
  const activeMarkup = dashboard.slice(0, dashboard.indexOf("<script>"));
  assert.doesNotMatch(activeMarkup, /\bbeta\b|\btester\b|Anthony|Fitness Connection/iu);
  assert.match(activeMarkup, /Route IQ/u);
  assert.match(activeMarkup, /Paid-customer configuration preview/u);
});

test("the preview render path uses text nodes and cannot trigger customer activation", () => {
  assert.match(dashboard, /item\.textContent = String\(value\)/u);
  assert.match(dashboard, /paidCustomerPreviewCompany"\)\.textContent/u);
  assert.match(dashboard, /loadPaidCustomerConfigurationPreview\(\{[\s\S]*?fetchFn: fetch/u);
  assert.match(dashboard, /activationEffect: "NONE"/u);
  assert.doesNotMatch(
    dashboard.match(/async function initializePaidCustomerConfigurationPreview\(\)[\s\S]*?\n    \}/u)?.[0] || "",
    /method:\s*"POST"|method:\s*"PUT"|method:\s*"PATCH"|method:\s*"DELETE"/u
  );
});
