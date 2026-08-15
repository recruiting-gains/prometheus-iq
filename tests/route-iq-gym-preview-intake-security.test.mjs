import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  RouteIqGymRequestContractError,
  adaptRouteIqGymRequestForCrm,
  routeIqGymRequestAttributionFields,
  routeIqGymRequestCrmScope,
  routeIqGymRequestFormId,
  routeIqGymRequestVersion
} from "../crm/route-iq-gym-intake.mjs";
import {
  claimRouteIqRequestNotificationDelivery,
  persistRouteIqRequest,
  publicRouteIqRequestReceipt,
  retrieveRouteIqRequest,
  routeIqRequestCrmHttpBoundary,
  routeIqRequestFailureMetadata,
  routeIqRequestFounderAuthorization
} from "../crm/route-iq-request-crm.mjs";
import {
  ROUTE_IQ_REQUEST_CRM_FOUNDER_PATH,
  ROUTE_IQ_REQUEST_CRM_PATH,
  handleRouteIqRequestCrmRuntimeRequest
} from "../workers/infrastructure/route-iq-request-crm-runtime.js";
import { aegisRoutePolicy } from "../workers/infrastructure/aegis-security-controls.js";
import {
  ROUTE_IQ_GYM_PREVIEW_SECURITY_POLICY,
  assertRouteIqGymPreviewCsp,
  discoverRouteIqGymPreviewSecurityPaths,
  inspectRouteIqGymPreviewSource,
  verifyRouteIqGymPreviewIntakeSecurity
} from "../security/verify-route-iq-gym-preview-intake-boundary-v1.mjs";

const root = resolve(import.meta.dirname, "..");
const NOW = "2026-08-14T18:31:00.000Z";
const SUBMITTED_AT = "2026-08-14T18:30:00.000Z";
const GYM_FORM_PATH = "src/route-iq-gym-request-form.js";
const PREVIEW_ENTRY_PATH = "workers/infrastructure/prometheusrouteiq-website-gym-preview-entry.mjs";
const PREVIEW_CONFIG_PATH = "wrangler.prometheusrouteiq-website-gym-preview.jsonc";
const PREVIEW_WORKFLOW_PATH = ".github/workflows/preview-prometheus-route-iq-gym-first.yml";
const PII_VALUES = Object.freeze([
  "Security Canary Person",
  "Security Canary Gym",
  "Canary City, ZZ",
  "security-canary@example.invalid",
  "+1 555 010 9090",
  "security-source-canary",
  "security-medium-canary",
  "security-campaign-canary",
  "security-term-canary",
  "security-content-canary"
]);
const RUNTIME_SOURCE = readFileSync(
  resolve(root, "workers/infrastructure/route-iq-request-crm-runtime.js"),
  "utf8"
);

function memoryDurableStore() {
  const items = new Map();
  const writes = [];
  return {
    items,
    writes,
    async get(key) {
      return items.get(key)?.value ?? null;
    },
    async putIfAbsent(key, value, options = {}) {
      if (items.has(key)) return false;
      const entry = { value: String(value), options };
      items.set(key, entry);
      writes.push({ operation: "putIfAbsent", key, ...entry });
      return true;
    },
    async put(key, value, options = {}) {
      const entry = { value: String(value), options };
      items.set(key, entry);
      writes.push({ operation: "put", key, ...entry });
    },
    async list({ prefix }) {
      return {
        keys: [...items.keys()].filter(key => key.startsWith(prefix)).sort().map(name => ({ name }))
      };
    }
  };
}

function gymPayload(overrides = {}) {
  return {
    version: routeIqGymRequestVersion,
    formId: routeIqGymRequestFormId,
    fullName: PII_VALUES[0],
    gymName: PII_VALUES[1],
    cityState: PII_VALUES[2],
    outsideRepCount: 7,
    workEmail: PII_VALUES[3],
    cell: PII_VALUES[4],
    consent: true,
    submittedAt: SUBMITTED_AT,
    acquisitionSource: "route_iq_website",
    attribution: {
      utm_source: PII_VALUES[5],
      utm_medium: PII_VALUES[6],
      utm_campaign: PII_VALUES[7],
      utm_term: PII_VALUES[8],
      utm_content: PII_VALUES[9]
    },
    websiteUrl: "",
    ...overrides
  };
}

function adapt(payload = gymPayload()) {
  return adaptRouteIqGymRequestForCrm(payload, routeIqGymRequestCrmScope, { now: NOW });
}

function founderScope() {
  return {
    principal: {
      authenticated: true,
      identityProvider: routeIqRequestFounderAuthorization.identityProvider,
      immutablePrincipalId: routeIqRequestFounderAuthorization.immutablePrincipalId,
      workspaceId: routeIqRequestFounderAuthorization.workspaceId,
      identityImmutable: true
    },
    workspaceId: routeIqGymRequestCrmScope.workspaceId,
    operatingProfileId: routeIqGymRequestCrmScope.operatingProfileId
  };
}

function assertNoSubmittedValues(value) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  for (const pii of PII_VALUES) assert.equal(serialized.includes(pii), false, pii);
}

function capturedFailure(invoke) {
  try {
    invoke();
  } catch (error) {
    return error;
  }
  assert.fail("Expected the governed gym request to fail closed.");
}

test("Security records the exact protected CRM notification-only disposition", () => {
  const result = verifyRouteIqGymPreviewIntakeSecurity(root);
  const record = JSON.parse(readFileSync(
    resolve(root, "security/route-iq-gym-preview-intake-boundary-v1.json"),
    "utf8"
  ));

  assert.equal(result.status, "PASS");
  assert.equal(result.batchId, "BATCH-20260814-002");
  assert.equal(result.protectedState, "PROTECTED_CRM_NOTIFICATION_ONLY");
  assert.equal(result.disposition, "SECURITY_GOVERNANCE_RECORDED_UNDEPLOYED");
  assert.equal(result.externalTrackerCount, 0);
  assert.equal(result.previewProductionBindingCount, 0);
  assert.equal(result.deploymentPerformed, false);
  assert.equal(record.baseline.commit, "530808f3a730f76be8fc78e6bfa2f8b753741182");
  assert.equal(record.baseline.tree, "80801bdcab87aa8d7504b655d725dd46c25dfe34");
  assert.deepEqual(record.notificationBoundary.allowedRequestFields, [
    "receiptId",
    "submittedAt",
    "requestContractVersion"
  ]);
  assert.deepEqual(record.attributionBoundary.exactAllowlist, [...routeIqGymRequestAttributionFields]);
  assert.deepEqual(record.expectedFuturePaths, [...ROUTE_IQ_GYM_PREVIEW_SECURITY_POLICY.expectedFuturePaths]);
  assert.ok(discoverRouteIqGymPreviewSecurityPaths(root).length >= 10);
});

test("Security enforces the exact bounded UTM allowlist and rejects hostile or secret-like values", () => {
  const normalized = adapt(gymPayload({
    attribution: {
      utm_source: "  security source  ",
      utm_campaign: "",
      utm_content: "security content"
    }
  }));
  assert.deepEqual(normalized.attribution, {
    utm_source: "security source",
    utm_content: "security content"
  });
  assert.deepEqual(Object.keys(normalized.attribution), ["utm_source", "utm_content"]);
  assert.equal(Object.hasOwn(normalized, "websiteUrl"), false);
  assert.equal(Object.hasOwn(normalized, "landingUrl"), false);
  assert.equal(Object.hasOwn(normalized, "referrer"), false);

  const rejected = [
    { click_id: "unapproved-field" },
    { utm_source: "x".repeat(121) },
    { utm_medium: "<script src=https://tracker.invalid></script>" },
    { utm_campaign: "Bearer security-sensitive-token" },
    { utm_term: "api_key=security-sensitive-token" },
    { utm_content: `sk_live_${"1".repeat(24)}` }
  ];
  for (const attribution of rejected) {
    const error = capturedFailure(() => adapt(gymPayload({ attribution })));
    assert.ok(error instanceof RouteIqGymRequestContractError);
    assert.match(error.code, /^route_iq_request_/u);
    const observable = `${error.name}\n${error.code}\n${error.message}`;
    for (const value of Object.values(attribution)) assert.equal(observable.includes(value), false);
  }
});

test("Security keeps submitted PII in Founder-only CRM while public and notification records stay minimal", async () => {
  const store = memoryDurableStore();
  const accepted = await persistRouteIqRequest(store, adapt(), { now: "2026-08-14T18:31:02.000Z" });
  const receipt = publicRouteIqRequestReceipt(accepted);

  assert.equal(accepted.record.monitoring.storageStatus, "committed");
  assert.equal(accepted.record.request.fullName, PII_VALUES[0]);
  assert.equal(accepted.record.request.workEmail, PII_VALUES[3]);
  assert.equal(accepted.record.request.cell, PII_VALUES[4]);
  assert.deepEqual(accepted.record.request.attribution, gymPayload().attribution);
  assertNoSubmittedValues(receipt);
  assert.deepEqual(Object.keys(receipt).sort(), [
    "contractVersion",
    "duplicate",
    "ok",
    "receiptId",
    "status",
    "submittedAt",
    "version"
  ]);

  await assert.rejects(
    () => retrieveRouteIqRequest(store, {
      ...founderScope(),
      principal: { ...founderScope().principal, immutablePrincipalId: "riq_principal_untrusted" },
      receiptId: accepted.receiptId
    }),
    error => error.code === "founder_authorization_required" && error.status === 403
  );
  const founderRecord = await retrieveRouteIqRequest(store, {
    ...founderScope(),
    receiptId: accepted.receiptId
  });
  assert.equal(founderRecord.request.gymName, PII_VALUES[1]);
  assert.equal(founderRecord.request.cityState, PII_VALUES[2]);

  const writesBeforeNotification = store.writes.length;
  assert.equal(store.writes.some(write => write.key.includes("/notification")), false);
  const claim = await claimRouteIqRequestNotificationDelivery(store, accepted.receiptId, {
    now: "2026-08-14T18:31:03.000Z"
  });
  assert.equal(claim.state, "claimed");
  const requestWrite = store.writes.findIndex(write => write.key.includes("/requests/"));
  const notificationWrite = store.writes.findIndex(write => write.key.includes("/notification-attempts/"));
  assert.ok(requestWrite >= 0 && notificationWrite >= writesBeforeNotification && notificationWrite > requestWrite);
  assertNoSubmittedValues(store.writes[notificationWrite].value);
  assert.deepEqual(JSON.parse(store.writes[notificationWrite].value), {
    version: "route-iq-request-crm-v1",
    receiptId: accepted.receiptId,
    state: "delivery_claimed",
    claimedAt: "2026-08-14T18:31:03.000Z",
    containsContactPii: false
  });
});

test("Security failure metadata, errors, and observable runtime diagnostics contain no submitted values", async () => {
  const secret = "Bearer security-sensitive-token";
  const error = capturedFailure(() => adapt(gymPayload({ attribution: { utm_source: secret } })));
  const metadata = routeIqRequestFailureMetadata(error, {
    attemptId: "route_iq_attempt_security_0001",
    now: NOW
  });
  assert.equal(metadata.failureCode, "route_iq_request_gym_attribution_secret_rejected");
  assert.equal(metadata.containsRequestPii, false);
  assert.equal(JSON.stringify(metadata).includes(secret), false);
  assertNoSubmittedValues(metadata);

  const store = memoryDurableStore();
  const logs = [];
  const original = console.error;
  console.error = value => logs.push(String(value));
  let response;
  try {
    response = await handleRouteIqRequestCrmRuntimeRequest(new Request(
      `https://prometheusrouteiq.com${ROUTE_IQ_REQUEST_CRM_PATH}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "https://prometheusrouteiq.com" },
        body: JSON.stringify(gymPayload({ attribution: { utm_source: secret } }))
      }
    ), {}, {
      store,
      now: new Date(NOW),
      testHooks: { enabled: true, attemptId: "route_iq_attempt_security_runtime_0001" }
    });
  } finally {
    console.error = original;
  }
  const observable = `${logs.join("\n")}\n${await response.text()}\n${JSON.stringify([...store.items.values()])}`;
  assert.equal(observable.includes(secret), false);
  assertNoSubmittedValues(observable);
});

test("Security preserves same-origin, rate, abuse, CSP, Founder, and public-private controls", () => {
  const policy = aegisRoutePolicy(ROUTE_IQ_REQUEST_CRM_PATH);
  assert.equal(policy.id, "lead_intake");
  assert.equal(policy.limit, 10);
  assert.deepEqual(routeIqRequestCrmHttpBoundary.publicIntake, {
    path: ROUTE_IQ_REQUEST_CRM_PATH,
    methods: ["POST"],
    cloudflareAccessRequired: false
  });
  assert.equal(routeIqRequestCrmHttpBoundary.founderAccess.cloudflareAccessRequired, true);
  assert.equal(routeIqRequestCrmHttpBoundary.founderAccess.immutableSubjectClaim, "sub");
  assert.equal(routeIqRequestCrmHttpBoundary.founderAccess.everyonePolicyAllowed, false);
  assert.equal(routeIqRequestCrmHttpBoundary.founderAccess.bypassPolicyAllowed, false);
  assert.equal(routeIqRequestCrmHttpBoundary.founderAccess.paths.includes(
    `${ROUTE_IQ_REQUEST_CRM_FOUNDER_PATH}/{receiptId}`
  ), true);
  assert.throws(
    () => adapt(gymPayload({ websiteUrl: "https://abuse-canary.invalid" })),
    error => error.code === "route_iq_request_gym_spam_rejected" && error.status === 400
  );
  assert.doesNotMatch(RUNTIME_SOURCE, /Access-Control-Allow-Origin["']?\s*[:,]\s*["']\*["']/iu);
  assertRouteIqGymPreviewCsp(readFileSync(resolve(root, "landing.html"), "utf8"), "landing.html");
});

test("Security source guards reject trackers, preview side effects, social activation, and PII sinks", () => {
  const safePreview = [
    "export const reddit = { accountId: \"\", pixelId: \"\", enabled: false };",
    "export const meta = { accountId: \"\", pixelId: \"\", enabled: false };",
    "export function previewReceipt(receiptId) {",
    "  return Response.json({ ok: true, preview: true, receiptId });",
    "}"
  ].join("\n");
  assert.deepEqual(
    inspectRouteIqGymPreviewSource(PREVIEW_ENTRY_PATH, safePreview),
    []
  );

  const unsafe = [
    ["external_tracker_meta", "src/main.jsx", "fbq('track', 'Lead');"],
    ["external_tracker_reddit", GYM_FORM_PATH, "rdt('track', 'Lead');"],
    ["preview_production_binding", PREVIEW_CONFIG_PATH, "{ \"kv_namespaces\": [{ \"binding\": \"PRODUCTION_STORE\" }] }"],
    ["preview_production_crm_binding", PREVIEW_ENTRY_PATH, "env.ROUTE_IQ_REQUEST_CRM_COORDINATOR.get(id);"],
    ["preview_email_binding", PREVIEW_ENTRY_PATH, "await env.FOUNDER_EMAIL.send(message);"],
    ["preview_durable_write", PREVIEW_ENTRY_PATH, "await persistRouteIqRequest(store, payload);"],
    ["preview_durable_write", PREVIEW_ENTRY_PATH, "await store.put(key, payload);"],
    ["preview_production_intake_endpoint", GYM_FORM_PATH, "const endpoint = '/api/partner-intake';"],
    ["preview_browser_tracking_storage", "src/main.jsx", "localStorage.setItem('visitor', id);"],
    ["social_placeholder_enabled", "src/main.jsx", "const redditEnabled = true;"],
    ["social_placeholder_enabled", GYM_FORM_PATH, "const meta = { enabled: true };"],
    ["social_placeholder_identifier_nonempty", "src/main.jsx", "const META_PIXEL_ID = '123456';"],
    ["social_placeholder_identifier_nonempty", GYM_FORM_PATH, "const reddit = { pixelId: '123456' };"],
    ["social_placeholder_external_script", "src/main.jsx", "const meta = {}; document.createElement('script');"],
    ["social_placeholder_external_network", GYM_FORM_PATH, "const reddit = {}; fetch('https://ads.invalid/event');"],
    ["pii_url_sink", GYM_FORM_PATH, "url.searchParams.set('lead', payload.workEmail);"],
    ["pii_log_sink", PREVIEW_ENTRY_PATH, "console.log(payload.fullName);"],
    ["pii_analytics_sink", "src/main.jsx", "analytics.track('lead', payload.gymName);"],
    ["pii_error_sink", PREVIEW_ENTRY_PATH, "throw new Error(`bad ${payload.cell}`);"],
    ["pii_github_actions_sink", PREVIEW_WORKFLOW_PATH, "jobs:\n  leak:\n    steps:\n      - run: echo '${{ inputs.workEmail }}'"],
    ["origin_policy_expanded", PREVIEW_ENTRY_PATH, "headers: { 'Access-Control-Allow-Origin': '*' }"],
    ["notification_contains_forbidden_request_field", "workers/infrastructure/route-iq-request-crm-runtime.js", "async function notifyFounder() { return record.request.utm_campaign; }\nasync function next() {}"]
  ];
  for (const [code, path, source] of unsafe) {
    assert.equal(inspectRouteIqGymPreviewSource(path, source).includes(code), true, `${path}:${code}`);
  }

  const expandedCsp = readFileSync(resolve(root, "landing.html"), "utf8").replace(
    "connect-src 'self'",
    "connect-src 'self' https://www.facebook.com"
  );
  assert.throws(() => assertRouteIqGymPreviewCsp(expandedCsp, "unsafe-preview.html"));
});

test("Security future-path checks activate when the gym runtime integration appears", async () => {
  const integrated = /(?:routeIqGymRequest|route-iq-gym-request|route_iq_gym_request)/u.test(RUNTIME_SOURCE);
  if (!integrated) {
    const discovered = discoverRouteIqGymPreviewSecurityPaths(root);
    for (const path of ROUTE_IQ_GYM_PREVIEW_SECURITY_POLICY.expectedFuturePaths) {
      assert.equal(discovered.includes(path), existsSync(resolve(root, path)));
    }
    return;
  }

  const store = memoryDurableStore();
  const sent = [];
  const env = {
    FOUNDER_EMAIL: {
      async send(message) {
        assert.equal([...store.items.keys()].some(key => key.includes("/requests/")), true);
        sent.push(message);
      }
    }
  };
  const response = await handleRouteIqRequestCrmRuntimeRequest(new Request(
    `https://prometheusrouteiq.com${ROUTE_IQ_REQUEST_CRM_PATH}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://prometheusrouteiq.com",
        "Sec-Fetch-Site": "same-origin"
      },
      body: JSON.stringify(gymPayload())
    }
  ), env, { store, now: new Date(NOW) });
  assert.equal(response.status, 201);
  const receipt = await response.json();
  assert.equal(sent.length, 1);
  assertNoSubmittedValues(sent[0]);
  const email = JSON.stringify(sent[0]);
  assert.match(email, new RegExp(receipt.receiptId, "u"));
  assert.match(email, new RegExp(SUBMITTED_AT.replaceAll(".", "\\."), "u"));
  assert.match(email, /route-iq-gym-request\.v1/u);
});
