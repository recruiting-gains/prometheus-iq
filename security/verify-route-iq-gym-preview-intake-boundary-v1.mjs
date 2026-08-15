import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(import.meta.dirname, "..");

export const ROUTE_IQ_GYM_PREVIEW_SECURITY_POLICY = Object.freeze({
  schemaVersion: "route-iq-gym-preview-intake-security-v1",
  batchId: "BATCH-20260814-002",
  owner: "Prometheus Security",
  ownerIdentity: "Prometheus Security <security@prometheus.local>",
  protectedState: "PROTECTED_CRM_NOTIFICATION_ONLY",
  baselineCommit: "530808f3a730f76be8fc78e6bfa2f8b753741182",
  baselineTree: "80801bdcab87aa8d7504b655d725dd46c25dfe34",
  requestContractVersion: "route-iq-gym-request.v1",
  formId: "route_iq_gym_request",
  workspaceId: "prometheus_route_iq",
  operatingProfileId: "route_iq_commercial",
  notificationFields: Object.freeze([
    "receiptId",
    "submittedAt",
    "requestContractVersion"
  ]),
  notificationForbiddenFields: Object.freeze([
    "fullName",
    "workEmail",
    "cell",
    "gymName",
    "cityState",
    "outsideRepCount",
    "attribution",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content"
  ]),
  attributionFields: Object.freeze([
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content"
  ]),
  founderRetainedFields: Object.freeze([
    "formId",
    "fullName",
    "gymName",
    "cityState",
    "outsideRepCount",
    "workEmail",
    "cell",
    "consent",
    "submittedAt",
    "acquisitionSource",
    "attribution"
  ]),
  expectedFuturePaths: Object.freeze([
    "src/main.jsx",
    "src/route-iq-gym-request-form.js",
    "workers/infrastructure/prometheusrouteiq-website-gym-preview-entry.mjs",
    "wrangler.prometheusrouteiq-website-gym-preview.jsonc",
    ".github/workflows/preview-prometheus-route-iq-gym-first.yml"
  ])
});

const CORE_SCAN_PATHS = Object.freeze([
  "crm/route-iq-gym-intake.mjs",
  "crm/route-iq-gym-request-contract-v1.json",
  "crm/route-iq-request-crm.mjs",
  "workers/infrastructure/route-iq-request-crm-runtime.js",
  "src/main.jsx",
  "src/route-iq-request-form.js",
  "landing.html",
  "public-site-static/_headers",
  "deploy/prometheusrouteiq-website/index.html",
  "deploy/prometheusrouteiq-website/_headers"
]);
const DISCOVERY_ROOTS = Object.freeze([
  ".github/workflows",
  "crm",
  "deploy/prometheusrouteiq-website",
  "src",
  "workers/infrastructure"
]);
const TEXT_EXTENSIONS = new Set([
  "", ".html", ".js", ".json", ".jsonc", ".jsx", ".mjs", ".ts", ".tsx", ".yaml", ".yml"
]);
const RELEVANT_PATH = /(?:gym[^/]*(?:intake|preview|request)|(?:intake|preview|request)[^/]*gym)/iu;
const RELEVANT_SOURCE = /(?:PROTECTED_CRM_NOTIFICATION_ONLY|route[-_]iq[-_]gym[-_](?:intake|preview|request)|route_iq_gym_request)/iu;
const PREVIEW_PATH = /(?:gym[^/]*preview|preview[^/]*gym)/iu;
const PREVIEW_INTEGRATION_PATHS = new Set(ROUTE_IQ_GYM_PREVIEW_SECURITY_POLICY.expectedFuturePaths);
const SENSITIVE_NAME = "(?:fullName|workEmail|cell|gymName|cityState|outsideRepCount|attribution|utm_(?:source|medium|campaign|term|content))";
const SENSITIVE_REFERENCE = "(?:\\$\\{[^}\\n]*" + SENSITIVE_NAME
  + "[^}\\n]*\\}|(?:input|payload|body|record|request|normalized|formData|fields)"
  + "(?:\\?\\.|\\.)" + SENSITIVE_NAME + ")";

const TRACKER_SIGNATURES = Object.freeze([
  ["external_tracker_meta", /(?:connect\.facebook\.net|www\.facebook\.com\/tr|graph\.facebook\.com|\bfbq\s*\(|\b_fbp\b|\b_fbc\b)/iu],
  ["external_tracker_reddit", /(?:pixel\.redditmedia\.com|events\.reddit\.com|alb\.reddit\.com|\brdt\s*\(|\bredditPixel\b)/iu],
  ["external_tracker_google", /(?:www\.googletagmanager\.com|google-analytics\.com|\bgtag\s*\(|\bdataLayer\b)/iu],
  ["external_tracker_other", /(?:cdn\.segment\.com|api\.segment\.io|\bposthog\b|\bmixpanel\b|static\.hotjar\.com|clarity\.ms)/iu]
]);

function read(repositoryRoot, path) {
  return readFileSync(resolve(repositoryRoot, path), "utf8");
}

function readJson(repositoryRoot, path) {
  return JSON.parse(read(repositoryRoot, path));
}

function relativePath(repositoryRoot, path) {
  return relative(repositoryRoot, path).split("\\").join("/");
}

function filesUnder(repositoryRoot, directory) {
  const absolute = resolve(repositoryRoot, directory);
  if (!existsSync(absolute)) return [];
  const output = [];
  const visit = current => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      const path = resolve(current, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile() && TEXT_EXTENSIONS.has(extname(entry.name))) output.push(relativePath(repositoryRoot, path));
    }
  };
  visit(absolute);
  return output;
}

function addViolation(violations, code) {
  if (!violations.includes(code)) violations.push(code);
}

function sourceHasSensitiveSink(source, sinkPattern) {
  const before = new RegExp(`${sinkPattern}[\\s\\S]{0,320}${SENSITIVE_REFERENCE}`, "iu");
  const after = new RegExp(`${SENSITIVE_REFERENCE}[\\s\\S]{0,320}${sinkPattern}`, "iu");
  return before.test(source) || after.test(source);
}

function notificationFunctionSource(source) {
  const start = source.search(/(?:async\s+)?function\s+notifyFounder\s*\(/u);
  if (start < 0) return "";
  const next = source.slice(start + 1).search(/\n(?:export\s+)?(?:async\s+)?function\s+[A-Za-z0-9_$]+\s*\(/u);
  return next < 0 ? source.slice(start) : source.slice(start, start + 1 + next);
}

export function inspectRouteIqGymPreviewSource(path, source) {
  assert.equal(typeof path, "string");
  assert.equal(typeof source, "string");
  const normalizedPath = path.split("\\").join("/");
  const violations = [];

  for (const [code, pattern] of TRACKER_SIGNATURES) {
    if (pattern.test(source)) addViolation(violations, code);
  }

  if (/Access-Control-Allow-Origin["']?\s*[:,]\s*["']\*["']/iu.test(source)
    || /Access-Control-Allow-Origin[\s\S]{0,160}headers\.get\(["']Origin["']\)/iu.test(source)) {
    addViolation(violations, "origin_policy_expanded");
  }
  if (sourceHasSensitiveSink(source, "(?:URLSearchParams|searchParams\\.(?:append|set)|location\\.(?:assign|replace)|href\\s*=)")) {
    addViolation(violations, "pii_url_sink");
  }
  if (sourceHasSensitiveSink(source, "(?:console\\.(?:debug|error|info|log|warn)|logger\\.(?:debug|error|info|log|warn))\\s*\\(")) {
    addViolation(violations, "pii_log_sink");
  }
  if (sourceHasSensitiveSink(source, "(?:analytics\\.(?:identify|track)|capture|identify|track|dataLayer\\.push)\\s*\\(")) {
    addViolation(violations, "pii_analytics_sink");
  }
  if (new RegExp(
    `(?:new\\s+Error|runtimeError|fail)\\s*\\([^;]{0,600}${SENSITIVE_REFERENCE}[^;]{0,600}\\)\\s*;`,
    "iu"
  ).test(source)) {
    addViolation(violations, "pii_error_sink");
  }

  const notificationSource = notificationFunctionSource(source);
  if (notificationSource) {
    for (const field of ROUTE_IQ_GYM_PREVIEW_SECURITY_POLICY.notificationForbiddenFields) {
      if (new RegExp(`\\b${field}\\b`, "u").test(notificationSource)) {
        addViolation(violations, "notification_contains_forbidden_request_field");
      }
    }
  }

  if (normalizedPath.startsWith(".github/workflows/")
    && new RegExp(`\\b${SENSITIVE_NAME}\\b`, "iu").test(source)) {
    addViolation(violations, "pii_github_actions_sink");
  }

  if (PREVIEW_PATH.test(normalizedPath) || PREVIEW_INTEGRATION_PATHS.has(normalizedPath)) {
    if (/"(?:d1_databases|durable_objects|hyperdrive|kv_namespaces|queues|r2_buckets|services|vectorize)"\s*:/u.test(source)
      || /env\.[A-Z0-9_]*(?:COORDINATOR|DATABASE|DB|EMAIL|KV|STORE)\b/u.test(source)) {
      addViolation(violations, "preview_production_binding");
    }
    if (/(?:ROUTE_IQ_REQUEST_CRM_COORDINATOR|CRM_WORKSPACE_LEAD_STORE|SHARED_LEAD_INTAKE_STORE)/u.test(source)) {
      addViolation(violations, "preview_production_crm_binding");
    }
    if (/(?:FOUNDER_EMAIL|FOUNDER_NOTIFICATION_(?:FROM|TO)|send_email|EmailMessage|(?:email|mailer|mailChannel)\.send\s*\()/iu.test(source)) {
      addViolation(violations, "preview_email_binding");
    }
    if (/(?:persistRouteIqRequest|claimRouteIqRequestNotificationDelivery|recordRouteIqRequestNotificationResult|\.(?:delete|put|putIfAbsent|write)\s*\(|\.(?:exec|prepare)\s*\(\s*["'`]\s*(?:INSERT|UPDATE|DELETE)\b)/iu.test(source)) {
      addViolation(violations, "preview_durable_write");
    }
    if (/[/"'`]api\/partner-intake["'`](?!\/preview)/u.test(source)
      || /["'`]\/api\/partner-intake["'`]/u.test(source)) {
      addViolation(violations, "preview_production_intake_endpoint");
    }
    if (/(?:document\.cookie|cookieStore|localStorage|sessionStorage|indexedDB)/u.test(source)) {
      addViolation(violations, "preview_browser_tracking_storage");
    }
    if (/(?:reddit|meta)[\s\S]{0,160}(?:enabled|active)\s*[:=]\s*true/iu.test(source)) {
      addViolation(violations, "social_placeholder_enabled");
    }
    if (/(?:REDDIT|META)_[A-Z0-9_]*(?:ACCOUNT|PIXEL|TRACKER|TRACKING)[A-Z0-9_]*\s*[:=]\s*["'][^"']+["']/u.test(source)
      || /(?:reddit|meta)[\s\S]{0,160}(?:accountId|pixelId)\s*:\s*["'][^"']+["']/iu.test(source)) {
      addViolation(violations, "social_placeholder_identifier_nonempty");
    }
    if (/(?:reddit|meta)/iu.test(source)
      && /(?:document\.createElement\(\s*["']script["']\s*\)|<script[^>]+src\s*=\s*["']https?:)/iu.test(source)) {
      addViolation(violations, "social_placeholder_external_script");
    }
    if (/(?:reddit|meta)/iu.test(source)
      && /(?:fetch\s*\(\s*["']https?:|sendBeacon\s*\(|new\s+(?:EventSource|WebSocket)\s*\(\s*["']https?:)/iu.test(source)) {
      addViolation(violations, "social_placeholder_external_network");
    }
    if ((/\.html$/u.test(normalizedPath) || /(?:^|\/)_headers$/u.test(normalizedPath))
      && /Content-Security-Policy/iu.test(source)) {
      try {
        assertRouteIqGymPreviewCsp(source, normalizedPath);
      } catch {
        addViolation(violations, "preview_csp_expanded");
      }
    }
  }

  return Object.freeze(violations);
}

function cspFrom(source, path) {
  const html = source.match(/<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]+content=(["'])(.*?)\1/iu)
    || source.match(/<meta[^>]+content=(["'])(.*?)\1[^>]+http-equiv=["']Content-Security-Policy["']/iu);
  const header = source.match(/^\s*Content-Security-Policy:\s*([^\r\n]+)$/imu);
  const value = html?.[2] || header?.[1];
  assert.ok(value, `${path}: Content-Security-Policy is required`);
  return value.trim();
}

function cspDirectives(value) {
  const directives = new Map();
  for (const entry of value.split(";").map(item => item.trim()).filter(Boolean)) {
    const [name, ...tokens] = entry.split(/\s+/u);
    assert.equal(directives.has(name), false, `duplicate CSP directive: ${name}`);
    directives.set(name, tokens);
  }
  return directives;
}

export function assertRouteIqGymPreviewCsp(source, path = "CSP source") {
  const directives = cspDirectives(cspFrom(source, path));
  assert.deepEqual([...directives.keys()].sort(), [
    "base-uri",
    "connect-src",
    "default-src",
    "form-action",
    "frame-ancestors",
    "img-src",
    "object-src",
    "script-src",
    "style-src",
    "upgrade-insecure-requests"
  ]);
  assert.deepEqual(directives.get("default-src"), ["'self'"]);
  assert.deepEqual(directives.get("style-src"), ["'self'", "'unsafe-inline'"]);
  assert.deepEqual(directives.get("img-src"), ["'self'", "data:"]);
  assert.deepEqual(directives.get("connect-src"), ["'self'"]);
  assert.deepEqual(directives.get("object-src"), ["'none'"]);
  assert.deepEqual(directives.get("base-uri"), ["'none'"]);
  assert.deepEqual(directives.get("frame-ancestors"), ["'none'"]);
  assert.deepEqual(directives.get("form-action"), ["'none'"]);
  assert.deepEqual(directives.get("upgrade-insecure-requests"), []);
  const scripts = directives.get("script-src");
  assert.equal(scripts[0], "'self'");
  assert.ok(scripts.length >= 2, `${path}: an inline bootstrap hash is required`);
  for (const token of scripts.slice(1)) {
    assert.match(token, /^'sha(?:256|384|512)-[A-Za-z0-9+/]+=*'$/u);
  }
  return true;
}

export function discoverRouteIqGymPreviewSecurityPaths(repositoryRoot = root) {
  const paths = new Set(CORE_SCAN_PATHS.filter(path => existsSync(resolve(repositoryRoot, path))));
  for (const path of ROUTE_IQ_GYM_PREVIEW_SECURITY_POLICY.expectedFuturePaths) {
    if (existsSync(resolve(repositoryRoot, path))) paths.add(path);
  }
  for (const directory of DISCOVERY_ROOTS) {
    for (const path of filesUnder(repositoryRoot, directory)) {
      if (paths.has(path)) continue;
      const source = read(repositoryRoot, path);
      if (RELEVANT_PATH.test(path) || RELEVANT_SOURCE.test(source)) paths.add(path);
    }
  }
  return Object.freeze([...paths].sort());
}

function verifyRecord(record) {
  const policy = ROUTE_IQ_GYM_PREVIEW_SECURITY_POLICY;
  assert.equal(record.schemaVersion, policy.schemaVersion);
  assert.equal(record.batchId, policy.batchId);
  assert.equal(record.owner, policy.owner);
  assert.equal(record.ownerIdentity, policy.ownerIdentity);
  assert.equal(record.baseline.commit, policy.baselineCommit);
  assert.equal(record.baseline.tree, policy.baselineTree);
  assert.equal(record.protectedState, policy.protectedState);
  assert.equal(record.requestBoundary.contractVersion, policy.requestContractVersion);
  assert.equal(record.requestBoundary.formId, policy.formId);
  assert.equal(record.requestBoundary.workspaceId, policy.workspaceId);
  assert.equal(record.requestBoundary.operatingProfileId, policy.operatingProfileId);
  assert.deepEqual(record.notificationBoundary.allowedRequestFields, [...policy.notificationFields]);
  assert.deepEqual(record.notificationBoundary.forbiddenRequestFields, [...policy.notificationForbiddenFields]);
  assert.equal(record.notificationBoundary.afterDurablePersistenceRequired, true);
  assert.equal(record.notificationBoundary.beforeDurablePersistenceAllowed, false);
  assert.equal(record.notificationBoundary.contactPiiAllowed, false);
  assert.equal(record.notificationBoundary.gymOrCityAllowed, false);
  assert.equal(record.notificationBoundary.attributionValuesAllowed, false);
  assert.deepEqual(record.founderCrmBoundary.allowedRetainedRequestFields, [...policy.founderRetainedFields]);
  assert.equal(record.founderCrmBoundary.authorization, "IMMUTABLE_FOUNDER_PRINCIPAL_ONLY");
  assert.equal(record.founderCrmBoundary.publicRetrievalAllowed, false);
  assert.equal(record.founderCrmBoundary.publicListingAllowed, false);
  assert.equal(record.founderCrmBoundary.publicExportAllowed, false);
  assert.deepEqual(record.attributionBoundary.exactAllowlist, [...policy.attributionFields]);
  assert.equal(record.attributionBoundary.additionalFieldsAllowed, false);
  assert.equal(record.attributionBoundary.maximumLengthPerValue, 120);
  assert.equal(record.attributionBoundary.secretLikeValuesRejected, true);
  for (const field of [
    "landingUrlRetained",
    "referrerUrlRetained",
    "piiInOutboundUrlsAllowed",
    "piiInLogsAllowed",
    "piiInAnalyticsAllowed",
    "piiInGithubActionsAllowed",
    "piiInErrorsAllowed"
  ]) assert.equal(record.attributionBoundary[field], false);
  assert.ok(Object.values(record.previewBoundary).slice(1).every(value => value === false));
  assert.deepEqual(record.socialPlaceholders.reddit, { accountId: "", pixelId: "", enabled: false });
  assert.deepEqual(record.socialPlaceholders.meta, { accountId: "", pixelId: "", enabled: false });
  assert.ok(Object.values(record.socialPlaceholders).slice(2).every(value => value === false));
  assert.ok(Object.values(record.preservedControls).every(value => value === true));
  assert.deepEqual(record.expectedFuturePaths, [...policy.expectedFuturePaths]);
  assert.equal(record.disposition.status, "SECURITY_GOVERNANCE_RECORDED_UNDEPLOYED");
  assert.equal(record.disposition.integrationAdmission, "SECURITY_TEST_PASS_REQUIRED");
  assert.equal(record.disposition.productionAuthorized, false);
  assert.equal(record.disposition.pushPerformed, false);
  assert.equal(record.disposition.deploymentPerformed, false);
  assert.equal(record.disposition.productionDataMutationPerformed, false);
}

export function verifyRouteIqGymPreviewIntakeSecurity(repositoryRoot = root) {
  const policy = ROUTE_IQ_GYM_PREVIEW_SECURITY_POLICY;
  const record = readJson(repositoryRoot, "security/route-iq-gym-preview-intake-boundary-v1.json");
  const crmContract = readJson(repositoryRoot, "crm/route-iq-gym-request-contract-v1.json");
  const gymIntake = read(repositoryRoot, "crm/route-iq-gym-intake.mjs");
  const crm = read(repositoryRoot, "crm/route-iq-request-crm.mjs");
  const runtime = read(repositoryRoot, "workers/infrastructure/route-iq-request-crm-runtime.js");
  const worker = read(repositoryRoot, "workers/prometheus-iq-worker.js");
  const aegis = read(repositoryRoot, "workers/infrastructure/aegis-security-controls.js");
  const requestForm = read(repositoryRoot, "src/route-iq-request-form.js");

  verifyRecord(record);
  assert.deepEqual(crmContract.publicPayload.attribution.allowedFields, [...policy.attributionFields]);
  assert.equal(crmContract.publicPayload.attribution.additionalProperties, false);
  assert.equal(crmContract.publicPayload.attribution.maximumLengthPerValue, 120);
  assert.equal(crmContract.publicPayload.attribution.hostileValuesRejected, true);
  assert.equal(crmContract.publicPayload.attribution.secretLikeValuesRejected, true);
  assert.deepEqual(crmContract.internalStorage.retainedGymFields, [...policy.founderRetainedFields]);
  assert.equal(crmContract.durability.notificationAfterDurablePersistence, true);
  assert.equal(crmContract.founderAccess.notificationContainsContactPii, false);
  assert.deepEqual(crmContract.notification.emailFields, [...policy.notificationFields]);
  assert.equal(crmContract.notification.contactPiiAllowed, false);
  assert.equal(crmContract.notification.gymOrAttributionValuesAllowed, false);

  assert.doesNotMatch(gymIntake, /\bconsole\./u);
  assert.doesNotMatch(gymIntake, /(?:landingUrl|referrerUrl|document\.cookie|localStorage|sessionStorage|indexedDB)/u);
  assert.match(gymIntake, /secretLikePattern/u);
  assert.match(gymIntake, /maximumLengthPerValue|1, 120/u);

  const handlerStart = runtime.indexOf("async function handlePublicPost");
  const persistence = runtime.indexOf("await persistRouteIqRequest", handlerStart);
  const notification = runtime.indexOf("await notifyFounder", handlerStart);
  assert.ok(handlerStart >= 0 && persistence > handlerStart && notification > persistence,
    "notification must follow durable persistence");
  const notificationSource = notificationFunctionSource(runtime);
  assert.ok(notificationSource);
  for (const field of policy.notificationForbiddenFields) assert.doesNotMatch(notificationSource, new RegExp(`\\b${field}\\b`, "u"));
  assert.match(notificationSource, /result\.receiptId/u);
  assert.match(notificationSource, /request\.submittedAt/u);
  assert.doesNotMatch(runtime, /Access-Control-Allow-Origin["']?\s*[:,]\s*["']\*["']/iu);

  assert.match(crm, /authorizeRouteIqRequestFounder\(input\.principal\)/u);
  assert.match(crm, /requireFounderScope\(input\)/u);
  assert.match(crm, /record\.workspace\?\.workspaceId !== input\.workspaceId/u);
  assert.match(aegis, /partner-intake/u);
  assert.match(aegis, /Content-Security-Policy/u);
  assert.match(worker, /enforceAegisControls\(request, env\)/u);
  assert.match(worker, /withAegisHeaders/u);
  assert.match(requestForm, /ROUTE_IQ_REQUEST_ENDPOINT = "\/api\/partner-intake"/u);
  assert.match(requestForm, /credentials: "same-origin"/u);
  assert.match(requestForm, /websiteUrl: ""/u);

  for (const path of [
    "landing.html",
    "public-site-static/_headers",
    "deploy/prometheusrouteiq-website/index.html",
    "deploy/prometheusrouteiq-website/_headers"
  ]) {
    if (existsSync(resolve(repositoryRoot, path))) assertRouteIqGymPreviewCsp(read(repositoryRoot, path), path);
  }

  const scannedPaths = discoverRouteIqGymPreviewSecurityPaths(repositoryRoot);
  const violations = [];
  for (const path of scannedPaths) {
    for (const code of inspectRouteIqGymPreviewSource(path, read(repositoryRoot, path))) {
      violations.push(`${path}:${code}`);
    }
  }
  assert.deepEqual(violations, []);

  return Object.freeze({
    status: "PASS",
    batchId: policy.batchId,
    protectedState: policy.protectedState,
    disposition: record.disposition.status,
    scannedPathCount: scannedPaths.length,
    presentExpectedFuturePathCount: policy.expectedFuturePaths.filter(path => existsSync(resolve(repositoryRoot, path))).length,
    notificationFieldCount: policy.notificationFields.length,
    attributionFieldCount: policy.attributionFields.length,
    externalTrackerCount: 0,
    previewProductionBindingCount: 0,
    deploymentPerformed: false
  });
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    process.stdout.write(`${JSON.stringify(verifyRouteIqGymPreviewIntakeSecurity(), null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error?.message || "Route IQ gym preview Security verification failed."}\n`);
    process.exitCode = 1;
  }
}
