import { createRemoteJWKSet, jwtVerify } from "jose";

import routeIqFounderDailySnapshot from "../intelligence/artifacts/route-iq-commercial-readiness-v1/fitness_connection/founder-daily-intelligence-snapshot-v1.json" with { type: "json" };
import {
  completeMetaInstagramOAuthConnection,
  verifyMetaInstagramOAuthState
} from "../social-media/infrastructure/meta-instagram-oauth-workflow.js";
import {
  INSTAGRAM_RUNTIME_ENVIRONMENT,
  publicInstagramRuntimeStatus,
  validateInstagramRuntimeEnvironment
} from "../social-media/infrastructure/instagram-runtime-controls.js";
import {
  fetchInstagramBusinessSnapshot
} from "../social-media/providers/instagram-business-provider.js";
import {
  createFounderInstagramAnalyticsReportingView
} from "../social-media/reporting/founder-instagram-analytics-reporting-view.js";
import {
  AEGIS_API_HEADERS,
  enforceAegisControls,
  withAegisHeaders
} from "./infrastructure/aegis-security-controls.js";
import {
  ROUTE_IQ_REQUEST_CRM_PATH,
  handleRouteIqRequestCrmRuntimeRequest,
  isRouteIqRequestCrmPath
} from "./infrastructure/route-iq-request-crm-runtime.js";
import {
  assertRouteIqCustomerPwaFieldSessionScope,
  authorizeRouteIqCustomerPwaRequest,
  getRouteIqCustomerPwaLaunchMode,
  handleRouteIqCustomerPwaRequest,
  isRouteIqCustomerPwaAppNamespace,
  isRouteIqCustomerPwaSessionPath,
  routeIqCustomerPwaErrorResponse
} from "./infrastructure/route-iq-august-1-customer-pwa-runtime.js";
import {
  ROUTE_IQ_BUSINESS_AVAILABILITY_PATH,
  handleRouteIqBusinessAvailabilityRequest,
  handleRouteIqBusinessAvailabilityScheduled,
  isRouteIqBusinessAvailabilityPath
} from "./infrastructure/route-iq-business-availability-runtime.js";
import {
  ROUTE_IQ_PROSPECTIVE_SHADOW_PATH,
  getRouteIqProspectiveActivation,
  handleRouteIqProspectiveShadowRequest,
  isRouteIqProspectiveShadowPath,
  reconcileAndCloseRouteIqProspectiveSessionFromHandoff
} from "./infrastructure/route-iq-prospective-shadow-runtime.js";
import {
  ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_ROOT,
  handleRouteIqPaidCustomerOnboardingRequest,
  isRouteIqPaidCustomerOnboardingPath
} from "./infrastructure/route-iq-paid-customer-onboarding-runtime.js";
import {
  ROUTE_IQ_PAID_CUSTOMER_DASHBOARD_PREVIEW_PATH,
  handleRouteIqPaidCustomerDashboardPreviewRequest,
  isRouteIqPaidCustomerDashboardPreviewPath
} from "./infrastructure/route-iq-paid-customer-dashboard-preview-runtime.js";
import {
  handleControlledPaidCustomerOnboardingRehearsalRequest,
  isControlledPaidCustomerOnboardingRehearsalPath
} from "./infrastructure/route-iq-controlled-paid-customer-onboarding-rehearsal-runtime.js";
import {
  handlePaidCustomerRevenueReadinessRequest,
  isPaidCustomerRevenueReadinessPath
} from "./infrastructure/route-iq-paid-customer-revenue-readiness-runtime.js";
import {
  authorizeCloudflareUnattendedSmokeRequest,
  markCloudflareUnattendedSmokeResponse,
  sanitizeCloudflareUnattendedSmokeAssetRequest
} from "./infrastructure/cloudflare-unattended-smoke-guard.js";
import {
  FieldSessionArchiveError,
  consumeRouteIqEndOfDayHandoff,
  routeIqEndOfDayHandoffContractId,
  supportedFieldSessionWorkspaces,
  validateFieldSessionStoreBinding
} from "../data/route-iq-field-sessions-v1/route-iq-field-session-archive.mjs";

const CALLBACK_PATH = "/api/oauth/meta/instagram/callback";
const FACEBOOK_BUSINESS_CALLBACK_PATH = "/api/oauth/facebook-business/instagram/callback";
const STATUS_PATH = "/api/oauth/meta/instagram/status";
const INSTAGRAM_SNAPSHOT_PATH = "/api/social/instagram/snapshot";
const INSTAGRAM_REPORT_PATH = "/api/social/instagram/report";
const ROUTE_IQ_FIELD_SESSION_HANDOFF_PATH = "/api/dashboard/route-iq/field-session";
const ROUTE_IQ_FOUNDER_DAILY_SNAPSHOT_PATH = "/api/dashboard/route-iq/intelligence/daily-snapshot";
const ROUTE_IQ_FOUNDER_OPERATIONAL_SESSION_PATH = "/api/dashboard/route-iq/founder/session";
const ROUTE_IQ_FOUNDER_SYSTEM_STATUS_PATH = "/api/dashboard/route-iq/founder/system-status";
const ROUTE_IQ_FOUNDER_DAILY_SNAPSHOT_CONTRACT_VERSION = "route-iq-commercial-readiness-intelligence-v1";
const ROUTE_IQ_FOUNDER_DAILY_SNAPSHOT_PRINCIPAL_ID = "riq_principal_7250bf2f7db15371eea3173c4f25953cffd6adf5b29f093ce8f9f0977a70e3c4";
const ROUTE_IQ_FOUNDER_DAILY_SNAPSHOT_ENV = Object.freeze({
  enabled: "ROUTE_IQ_FOUNDER_DAILY_SNAPSHOT_ENABLED",
  workerName: "ROUTE_IQ_FOUNDER_DAILY_SNAPSHOT_WORKER_NAME",
  accessAudience: "ROUTE_IQ_FOUNDER_DAILY_SNAPSHOT_ACCESS_AUDIENCE",
  accessTeamDomain: "ROUTE_IQ_FOUNDER_DAILY_SNAPSHOT_ACCESS_TEAM_DOMAIN",
  founderSubjectSha256: "ROUTE_IQ_FOUNDER_DAILY_SNAPSHOT_FOUNDER_SUBJECT_SHA256"
});
const ROUTE_IQ_FIELD_SESSION_MAX_BODY_BYTES = 512 * 1024;
const ROUTE_IQ_FIELD_SESSION_MAX_ASSET_BYTES = 4 * 1024 * 1024;
const ROUTE_IQ_FIELD_SESSION_ACTIONS = Object.freeze(["end_route", "end_day"]);
const ROUTE_IQ_FIELD_SESSION_RUNTIME_ASSETS = Object.freeze({
  runtimePools: "/data/qualified-prospects/google-qualified-businesses-v2/runtime-pools.json",
  activePool: "/data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/active-pool.json",
  businessHours: "/data/qualified-prospects/google-qualified-businesses-v2/business-hours-v1/business-hours.json"
});
const CALLBACK_PATHS = Object.freeze([
  CALLBACK_PATH,
  FACEBOOK_BUSINESS_CALLBACK_PATH
]);
const TOKEN_STORE_KEY = "meta-instagram/oauth/runtime-env-patch";
const TOKEN_STORE_VERSION = "meta-instagram-token-store.v1";
const REQUIRED_TOKEN_PATCH_KEYS = Object.freeze([
  "INSTAGRAM_ACCESS_TOKEN",
  "INSTAGRAM_GRANTED_SCOPES",
  "INSTAGRAM_TOKEN_EXPIRES_AT",
  "INSTAGRAM_CONNECTION_VERIFIED_AT"
]);
const ROUTE_IQ_FOUNDER_DAILY_SNAPSHOT_KEYS = Object.freeze([
  "audience",
  "businessConfigurationSha256",
  "businessConfigurationVersion",
  "changesSincePrevious",
  "classificationAuthority",
  "confidence",
  "dataQuality",
  "evidenceClassification",
  "evidenceCollected",
  "evidenceFreshness",
  "generatedFromEvidenceAt",
  "governedEvidenceSha256",
  "governedInputSha256",
  "learningCoverage",
  "operatingProfileId",
  "ownerSubsystem",
  "retentionPolicyVersion",
  "safety",
  "schemaVersion",
  "snapshotId",
  "snapshotSha256",
  "visitAndOutcomeTrends",
  "workspaceId"
].sort());

let routeIqFounderSnapshotJwksOrigin = null;
let routeIqFounderSnapshotJwks = null;

const SECURITY_HEADERS = Object.freeze({
  ...AEGIS_API_HEADERS
});

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      ...SECURITY_HEADERS,
      ...headers,
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

function htmlResponse({ title, message, status = 200 }) {
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  return new Response(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${safeTitle}</title>
</head>
<body>
  <main>
    <h1>${safeTitle}</h1>
    <p>${safeMessage}</p>
  </main>
</body>
</html>`, {
    status,
    headers: {
      ...SECURITY_HEADERS,
      "Content-Type": "text/html; charset=utf-8"
    }
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function routeIqFounderSnapshotError(code, status) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  return error;
}

function routeIqFounderSnapshotResponse(body, status = 200, headers = {}) {
  return jsonResponse(body, status, {
    "Cache-Control": "no-store",
    "Cross-Origin-Resource-Policy": "same-origin",
    "X-Content-Type-Options": "nosniff",
    ...headers
  });
}

function routeIqFounderSnapshotConfigString(value, max) {
  if (typeof value !== "string"
    || value.length < 1
    || value.length > max
    || /[\u0000-\u001F\u007F\s]/u.test(value)) {
    throw routeIqFounderSnapshotError("route_iq_founder_snapshot_config_invalid", 503);
  }
  return value;
}

function routeIqFounderSnapshotTeamDomain(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw routeIqFounderSnapshotError("route_iq_founder_snapshot_config_invalid", 503);
  }
  if (url.protocol !== "https:"
    || !/^[a-z0-9-]+\.cloudflareaccess\.com$/u.test(url.hostname)
    || (url.pathname !== "/" && url.pathname !== "")
    || url.search
    || url.hash
    || url.username
    || url.password
    || url.port) {
    throw routeIqFounderSnapshotError("route_iq_founder_snapshot_config_invalid", 503);
  }
  return url.origin;
}

function routeIqFounderSnapshotJwksFor(issuer) {
  if (routeIqFounderSnapshotJwksOrigin !== issuer || !routeIqFounderSnapshotJwks) {
    routeIqFounderSnapshotJwksOrigin = issuer;
    routeIqFounderSnapshotJwks = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`), {
      timeoutDuration: 5000,
      cooldownDuration: 30000
    });
  }
  return routeIqFounderSnapshotJwks;
}

async function routeIqFounderSnapshotSha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value)));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function canonicalRouteIqFounderSnapshotJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalRouteIqFounderSnapshotJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalRouteIqFounderSnapshotJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function routeIqFounderSnapshotHasForbiddenOutput(value) {
  if (Array.isArray(value)) return value.some(routeIqFounderSnapshotHasForbiddenOutput);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, child]) => (
    /(?:shadow|ranked.?candidate|candidate.?manifest|probabilit|sealed.?decision|model.?version|engine.?version|rule.?version)/iu.test(key)
      || routeIqFounderSnapshotHasForbiddenOutput(child)
  ));
}

function routeIqFounderSnapshotExactKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

export async function validateRouteIqFounderDailySnapshot(snapshot) {
  if (!routeIqFounderSnapshotExactKeys(snapshot, ROUTE_IQ_FOUNDER_DAILY_SNAPSHOT_KEYS)
    || snapshot.schemaVersion !== "route-iq-daily-intelligence-snapshot-v1"
    || snapshot.ownerSubsystem !== "Prometheus Intelligence Engine"
    || snapshot.audience !== "founder_only"
    || snapshot.workspaceId !== "fitness_connection"
    || snapshot.operatingProfileId !== "fitness"
    || snapshot.evidenceClassification !== "FOUNDER_FIELD_RESEARCH"
    || snapshot.classificationAuthority !== "Prometheus Data"
    || snapshot.businessConfigurationVersion !== "route-iq-commercial-workspace-registry-v1"
    || !/^[a-f0-9]{64}$/u.test(String(snapshot.businessConfigurationSha256 || ""))
    || snapshot.retentionPolicyVersion !== "route-iq-founder-retention-18-month-v1"
    || snapshot.snapshotId !== `route-iq-daily-snapshot-${String(snapshot.governedInputSha256 || "").slice(0, 24)}`
    || !/^[a-f0-9]{64}$/u.test(String(snapshot.snapshotSha256 || ""))
    || !/^[a-f0-9]{64}$/u.test(String(snapshot.governedEvidenceSha256 || ""))
    || !/^[a-f0-9]{64}$/u.test(String(snapshot.governedInputSha256 || ""))
    || !Array.isArray(snapshot.evidenceCollected?.sourceRecordHashes)
    || snapshot.evidenceCollected.sourceRecordHashes.length !== snapshot.evidenceCollected?.totalRecords
    || snapshot.evidenceCollected.sourceRecordHashes.some(hash => !/^[a-f0-9]{64}$/u.test(String(hash)))
    || snapshot.dataQuality?.exclusionRecordsAdmitted !== 0
    || snapshot.dataQuality?.rawNotesConsumed !== false
    || snapshot.dataQuality?.contactInformationConsumed !== false
    || snapshot.dataQuality?.preciseLocationTrailsConsumed !== false
    || !["INSUFFICIENT_EVIDENCE", "OBSERVING"].includes(snapshot.confidence?.state)
    || snapshot.confidence?.insufficiencyIsRecommendation !== false
    || snapshot.confidence?.predictionClaimed !== false
    || snapshot.confidence?.causalClaimed !== false
    || snapshot.learningCoverage?.coverageState !== snapshot.confidence?.state
    || snapshot.safety?.readOnly !== true
    || snapshot.safety?.founderOnly !== true
    || snapshot.safety?.representativeReadable !== false
    || snapshot.safety?.recommendationInfluence !== "OFF"
    || snapshot.safety?.routeOrderingChanged !== false
    || snapshot.safety?.routeScoringWeightsChanged !== false
    || snapshot.safety?.discoveryModeInfluenceChanged !== false
    || snapshot.safety?.nearbyContextInfluenceChanged !== false
    || snapshot.safety?.offRouteLearningInfluenceChanged !== false
    || snapshot.safety?.sourceEvidenceMutationAllowed !== false
    || routeIqFounderSnapshotHasForbiddenOutput(snapshot)) {
    throw routeIqFounderSnapshotError("route_iq_founder_snapshot_artifact_invalid", 503);
  }
  const copy = JSON.parse(JSON.stringify(snapshot));
  delete copy.snapshotSha256;
  const computed = await routeIqFounderSnapshotSha256(canonicalRouteIqFounderSnapshotJson(copy));
  if (computed !== snapshot.snapshotSha256) {
    throw routeIqFounderSnapshotError("route_iq_founder_snapshot_artifact_invalid", 503);
  }
  return JSON.parse(JSON.stringify(snapshot));
}

async function authorizeRouteIqFounderDailySnapshot(request, env, testHooks) {
  if (env?.[ROUTE_IQ_FOUNDER_DAILY_SNAPSHOT_ENV.enabled] !== "ON"
    || env?.[ROUTE_IQ_FOUNDER_DAILY_SNAPSHOT_ENV.workerName] !== "prometheus-iq") {
    throw routeIqFounderSnapshotError("route_iq_founder_snapshot_not_configured", 404);
  }
  const issuer = routeIqFounderSnapshotTeamDomain(env?.[ROUTE_IQ_FOUNDER_DAILY_SNAPSHOT_ENV.accessTeamDomain]);
  const audience = routeIqFounderSnapshotConfigString(env?.[ROUTE_IQ_FOUNDER_DAILY_SNAPSHOT_ENV.accessAudience], 256);
  const expectedSubjectSha256 = routeIqFounderSnapshotConfigString(
    env?.[ROUTE_IQ_FOUNDER_DAILY_SNAPSHOT_ENV.founderSubjectSha256],
    64
  );
  if (!/^[a-f0-9]{64}$/u.test(expectedSubjectSha256)) {
    throw routeIqFounderSnapshotError("route_iq_founder_snapshot_config_invalid", 503);
  }
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token || token.length > 16 * 1024) {
    throw routeIqFounderSnapshotError("route_iq_founder_snapshot_auth_required", 403);
  }
  try {
    const currentDate = testHooks?.enabled === true ? testHooks.currentDate : undefined;
    const keyResolver = testHooks?.enabled === true ? testHooks.keyResolver : routeIqFounderSnapshotJwksFor(issuer);
    const { payload } = await jwtVerify(token, keyResolver, {
      issuer,
      audience,
      algorithms: ["RS256"],
      requiredClaims: ["sub", "iat", "exp"],
      clockTolerance: 5,
      ...(currentDate ? { currentDate } : {})
    });
    if (typeof payload.sub !== "string"
      || payload.sub.length < 1
      || payload.sub.length > 512
      || await routeIqFounderSnapshotSha256(payload.sub) !== expectedSubjectSha256) {
      throw routeIqFounderSnapshotError("route_iq_founder_snapshot_principal_unmapped", 403);
    }
    return Object.freeze({
      identityContextSource: "server_verified_identity_mapping",
      authenticationAuthority: "cloudflare_access",
      authenticated: true,
      callerSupplied: false,
      role: "founder",
      mappingId: "route-iq-founder-access-cruz-v1",
      immutablePrincipalId: ROUTE_IQ_FOUNDER_DAILY_SNAPSHOT_PRINCIPAL_ID,
      mappingStatus: "securely_mapped"
    });
  } catch (error) {
    if (error?.code?.startsWith?.("route_iq_founder_snapshot_")) throw error;
    throw routeIqFounderSnapshotError("route_iq_founder_snapshot_auth_invalid", 403);
  }
}

function requestedRouteIqFounderWorkspace(request) {
  const workspaceId = new URL(request.url).searchParams.get("workspace_id");
  if (typeof workspaceId !== "string"
    || !/^[a-z0-9][a-z0-9_]{0,63}$/u.test(workspaceId)
    || !Object.hasOwn(supportedFieldSessionWorkspaces, workspaceId)) {
    throw routeIqFounderSnapshotError("route_iq_founder_workspace_not_found", 404);
  }
  return supportedFieldSessionWorkspaces[workspaceId];
}

function routeIqFounderOperationalSession(workspace) {
  return Object.freeze({
    contractVersion: "route-iq-founder-operational-session-v1",
    authorization: "SERVER_VERIFIED_CLOUDFLARE_ACCESS",
    workspace: Object.freeze({
      workspaceId: workspace.workspaceId,
      operatingProfileId: workspace.operatingProfileId
    }),
    roleProjection: "founder_operator",
    administratorRoleProjected: false,
    customerActivationRequired: false,
    customerPwaLaunch: "OFF",
    capabilities: Object.freeze([
      "dashboard_read",
      "daily_snapshot_read",
      "workspace_switch_read"
    ]),
    mutationCapabilities: Object.freeze([])
  });
}

function routeIqFounderDeploymentIdentity(env) {
  const id = env?.CF_VERSION_METADATA?.id;
  return typeof id === "string" && /^[0-9a-f-]{36}$/u.test(id)
    ? Object.freeze({ state: "AVAILABLE", worker: "prometheus-iq", versionId: id })
    : Object.freeze({ state: "UNKNOWN", worker: "prometheus-iq", versionId: "UNKNOWN" });
}

function routeIqFounderSystemStatus(workspace, env) {
  return Object.freeze({
    contractVersion: "route-iq-founder-system-status-v1",
    workspace: Object.freeze({
      workspaceId: workspace.workspaceId,
      operatingProfileId: workspace.operatingProfileId,
      classification: workspace.workspaceId === "fitness_connection"
        ? "FOUNDER_FIELD_RESEARCH"
        : "UNKNOWN"
    }),
    customer: Object.freeze({
      state: workspace.workspaceId === "fitness_connection" ? "NOT_A_CUSTOMER" : "UNKNOWN",
      onboarding: "NO_PAID_CUSTOMER_CONFIGURATION"
    }),
    commercial: Object.freeze({ readiness: "NOT_APPLICABLE", bindingTerms: "UNKNOWN" }),
    billing: Object.freeze({ state: "BLOCKED", liveActivityAllowed: false }),
    activation: Object.freeze({ state: "OFF", permittedByThisResponse: false }),
    roster: Object.freeze({ users: "UNKNOWN", locations: "UNKNOWN" }),
    routeReadiness: Object.freeze({ state: "NOT_READY", reason: "VERIFIED_BUSINESSES_UNAVAILABLE" }),
    crm: Object.freeze({ state: "UNKNOWN", followUpState: "UNKNOWN" }),
    providers: Object.freeze({ refresh: "OFF", scheduler: "OFF" }),
    protectedState: Object.freeze({
      collection: "OFF",
      activeCohorts: 0,
      recommendationInfluence: "OFF",
      customerPwaLaunch: "OFF"
    }),
    privateDeployment: routeIqFounderDeploymentIdentity(env),
    next: Object.freeze({
      action: workspace.workspaceId === "fitness_connection"
        ? "CONTINUE_FOUNDER_FIELD_RESEARCH"
        : "SELECT_GOVERNED_PAID_CUSTOMER_CONFIGURATION",
      actor: "FOUNDER"
    }),
    audit: Object.freeze({ availability: "AVAILABLE", mutationPerformed: false })
  });
}

async function handleRouteIqFounderOperationalSession(request, env = {}, { testHooks } = {}) {
  try {
    await authorizeRouteIqFounderDailySnapshot(request, env, testHooks);
    if (request.method !== "GET") {
      return routeIqFounderSnapshotResponse({
        ok: false,
        code: "route_iq_founder_session_method_not_allowed"
      }, 405, { Allow: "GET" });
    }
    const workspace = requestedRouteIqFounderWorkspace(request);
    return routeIqFounderSnapshotResponse({
      ok: true,
      session: routeIqFounderOperationalSession(workspace)
    });
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : 500;
    const code = typeof error?.code === "string" && /^route_iq_founder_[a-z0-9_]+$/u.test(error.code)
      ? error.code
      : "route_iq_founder_session_unavailable";
    return routeIqFounderSnapshotResponse({ ok: false, code }, status);
  }
}

async function handleRouteIqFounderSystemStatus(request, env = {}, { testHooks } = {}) {
  try {
    await authorizeRouteIqFounderDailySnapshot(request, env, testHooks);
    if (request.method !== "GET") {
      return routeIqFounderSnapshotResponse({
        ok: false,
        code: "route_iq_founder_system_status_method_not_allowed"
      }, 405, { Allow: "GET" });
    }
    const workspace = requestedRouteIqFounderWorkspace(request);
    return routeIqFounderSnapshotResponse({
      ok: true,
      status: routeIqFounderSystemStatus(workspace, env)
    });
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : 500;
    const code = typeof error?.code === "string" && /^route_iq_founder_[a-z0-9_]+$/u.test(error.code)
      ? error.code
      : "route_iq_founder_system_status_unavailable";
    return routeIqFounderSnapshotResponse({ ok: false, code }, status);
  }
}

async function handleRouteIqFounderDailySnapshot(request, env = {}, { testHooks } = {}) {
  try {
    const principal = await authorizeRouteIqFounderDailySnapshot(request, env, testHooks);
    if (request.method !== "GET") {
      return routeIqFounderSnapshotResponse({ ok: false, code: "route_iq_founder_snapshot_method_not_allowed" }, 405, {
        Allow: "GET"
      });
    }
    const workspace = requestedRouteIqFounderWorkspace(request);
    const snapshots = testHooks?.enabled === true && testHooks.snapshots
      ? testHooks.snapshots
      : testHooks?.enabled === true && testHooks.snapshot
        ? Object.freeze({ [workspace.workspaceId]: testHooks.snapshot })
        : Object.freeze({ fitness_connection: routeIqFounderDailySnapshot });
    const source = snapshots[workspace.workspaceId];
    if (!source) {
      throw routeIqFounderSnapshotError("route_iq_founder_snapshot_not_found", 404);
    }
    const snapshot = await validateRouteIqFounderDailySnapshot(source);
    if (snapshot.workspaceId !== workspace.workspaceId
      || snapshot.operatingProfileId !== workspace.operatingProfileId) {
      throw routeIqFounderSnapshotError("route_iq_founder_snapshot_workspace_mismatch", 503);
    }
    return routeIqFounderSnapshotResponse({
      ok: true,
      authorized: true,
      contractVersion: ROUTE_IQ_FOUNDER_DAILY_SNAPSHOT_CONTRACT_VERSION,
      principal,
      snapshot
    });
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : 500;
    const code = typeof error?.code === "string" && /^route_iq_founder_[a-z0-9_]+$/u.test(error.code)
      ? error.code
      : "route_iq_founder_snapshot_unavailable";
    return routeIqFounderSnapshotResponse({ ok: false, code }, status);
  }
}

function wantsJson(request) {
  return (request.headers.get("accept") || "").toLowerCase().includes("application/json");
}

function safeCallbackResponse(request, body, status = 200) {
  if (wantsJson(request)) return jsonResponse(body, status);
  return htmlResponse({
    title: body.ok ? "Instagram connection received" : "Instagram connection blocked",
    message: body.ok
      ? "The Instagram authorization callback was processed through backend-only controls. No token material was returned to this browser."
      : body.message || "The Instagram authorization callback could not be processed.",
    status
  });
}

function safeError(error, fallbackMessage) {
  return {
    code: error?.code || "error",
    message: error?.message || fallbackMessage,
    retryable: Boolean(error?.retryable),
    details: error?.details || {}
  };
}

function fieldSessionRequestError(message, code, status = 400, details = {}) {
  return new FieldSessionArchiveError(message, { code, status, details });
}

async function readBoundedJsonRequest(request, maxBytes = ROUTE_IQ_FIELD_SESSION_MAX_BODY_BYTES) {
  const contentType = (request.headers.get("content-type") || "").toLowerCase();
  if (!contentType.includes("application/json")) {
    throw fieldSessionRequestError(
      "Field-session handoff requires application/json.",
      "field_session_content_type_invalid",
      415
    );
  }

  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw fieldSessionRequestError(
      "Field-session handoff exceeds the maximum request size.",
      "field_session_request_too_large",
      413,
      { maxBytes }
    );
  }
  if (!request.body) {
    throw fieldSessionRequestError("Field-session handoff body is required.", "field_session_request_body_missing");
  }

  const reader = request.body.getReader();
  const chunks = [];
  let byteLength = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > maxBytes) {
        await reader.cancel("Field-session handoff request is too large.");
        throw fieldSessionRequestError(
          "Field-session handoff exceeds the maximum request size.",
          "field_session_request_too_large",
          413,
          { maxBytes }
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let body;
  try {
    body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw fieldSessionRequestError("Field-session handoff body is not valid JSON.", "field_session_request_json_invalid");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw fieldSessionRequestError("Field-session handoff body must be a JSON object.", "field_session_request_shape_invalid");
  }
  return body;
}

async function readFieldSessionRuntimeAsset(request, env, pathname) {
  if (typeof env?.ASSETS?.fetch !== "function") {
    throw fieldSessionRequestError(
      "Dashboard runtime assets are unavailable.",
      "field_session_runtime_assets_unavailable",
      503
    );
  }
  const assetResponse = await env.ASSETS.fetch(new Request(new URL(pathname, request.url), {
    method: "GET",
    headers: { Accept: "application/json" }
  }));
  if (!assetResponse.ok) {
    throw fieldSessionRequestError(
      "A required Dashboard runtime asset is unavailable.",
      "field_session_runtime_asset_missing",
      503,
      { pathname, status: assetResponse.status }
    );
  }
  const declaredLength = Number(assetResponse.headers.get("content-length") || 0);
  if (Number.isFinite(declaredLength) && declaredLength > ROUTE_IQ_FIELD_SESSION_MAX_ASSET_BYTES) {
    throw fieldSessionRequestError(
      "A required Dashboard runtime asset exceeds the supported size.",
      "field_session_runtime_asset_too_large",
      503,
      { pathname }
    );
  }
  const text = await assetResponse.text();
  if (new TextEncoder().encode(text).byteLength > ROUTE_IQ_FIELD_SESSION_MAX_ASSET_BYTES) {
    throw fieldSessionRequestError(
      "A required Dashboard runtime asset exceeds the supported size.",
      "field_session_runtime_asset_too_large",
      503,
      { pathname }
    );
  }
  try {
    return JSON.parse(text);
  } catch {
    throw fieldSessionRequestError(
      "A required Dashboard runtime asset is invalid.",
      "field_session_runtime_asset_invalid",
      503,
      { pathname }
    );
  }
}

async function loadFieldSessionRuntimeContext(request, env) {
  const [runtimePools, activePool, businessHours] = await Promise.all([
    readFieldSessionRuntimeAsset(request, env, ROUTE_IQ_FIELD_SESSION_RUNTIME_ASSETS.runtimePools),
    readFieldSessionRuntimeAsset(request, env, ROUTE_IQ_FIELD_SESSION_RUNTIME_ASSETS.activePool),
    readFieldSessionRuntimeAsset(request, env, ROUTE_IQ_FIELD_SESSION_RUNTIME_ASSETS.businessHours)
  ]);
  return { runtimePools, activePool, businessHours };
}

function publicStorageStatus(env) {
  return {
    tokenStoreBinding: Boolean(env.META_INSTAGRAM_TOKEN_STORE?.put),
    encryptionKeyConfigured: typeof env.META_INSTAGRAM_TOKEN_ENCRYPTION_KEY === "string" && env.META_INSTAGRAM_TOKEN_ENCRYPTION_KEY.trim().length >= 32,
    storageKey: TOKEN_STORE_KEY
  };
}

function validateTokenStorage(env) {
  const status = publicStorageStatus(env);
  const missing = [];
  if (!status.tokenStoreBinding) missing.push("META_INSTAGRAM_TOKEN_STORE");
  if (!status.encryptionKeyConfigured) missing.push("META_INSTAGRAM_TOKEN_ENCRYPTION_KEY");
  return {
    ok: missing.length === 0,
    missing,
    status
  };
}

function validateTokenPatch(envPatch = {}) {
  const missing = REQUIRED_TOKEN_PATCH_KEYS.filter(key => !envPatch[key]);
  return {
    ok: missing.length === 0,
    missing
  };
}

async function importEncryptionKey(secret) {
  const material = new TextEncoder().encode(secret);
  const digest = await crypto.subtle.digest("SHA-256", material);
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt"]);
}

function base64Encode(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function encryptJson(value, secret) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await importEncryptionKey(secret);
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return {
    algorithm: "AES-GCM",
    iv: base64Encode(iv),
    ciphertext: base64Encode(new Uint8Array(encrypted))
  };
}

async function persistMetaInstagramTokenPatch({ env, envPatch, now = new Date() }) {
  const storage = validateTokenStorage(env);
  if (!storage.ok) {
    return {
      ok: false,
      status: 503,
      message: "Meta Instagram token storage is not configured.",
      storage
    };
  }

  const patch = validateTokenPatch(envPatch);
  if (!patch.ok) {
    return {
      ok: false,
      status: 502,
      message: "Meta Instagram OAuth workflow did not return the required backend token fields.",
      missing: patch.missing
    };
  }

  const encrypted = await encryptJson(envPatch, env.META_INSTAGRAM_TOKEN_ENCRYPTION_KEY);
  const record = {
    version: TOKEN_STORE_VERSION,
    updatedAt: new Date(now).toISOString(),
    tokenFields: Object.keys(envPatch).sort(),
    encrypted
  };

  await env.META_INSTAGRAM_TOKEN_STORE.put(TOKEN_STORE_KEY, JSON.stringify(record), {
    metadata: {
      version: TOKEN_STORE_VERSION,
      updatedAt: record.updatedAt
    }
  });

  return {
    ok: true,
    storageKey: TOKEN_STORE_KEY,
    updatedAt: record.updatedAt,
    tokenFields: record.tokenFields
  };
}

function baseRuntimeStatus(env) {
  const runtime = validateInstagramRuntimeEnvironment({ env });
  return {
    runtime: publicInstagramRuntimeStatus(runtime),
    storage: publicStorageStatus(env),
    callbackUrl: env[INSTAGRAM_RUNTIME_ENVIRONMENT.META_OAUTH_CALLBACK_URL] || null,
    requiredSecrets: [
      "META_APP_ID",
      "META_APP_SECRET",
      "META_OAUTH_STATE_SECRET",
      "META_INSTAGRAM_TOKEN_ENCRYPTION_KEY"
    ],
    requiredBindings: ["META_INSTAGRAM_TOKEN_STORE"]
  };
}

async function handleMetaInstagramStatus(env) {
  return jsonResponse({
    ok: true,
    provider: "instagram",
    ...baseRuntimeStatus(env)
  });
}

async function handleMetaInstagramSnapshot(request, env) {
  if (request.method !== "GET") {
    return jsonResponse({ ok: false, message: "Method not allowed." }, 405);
  }

  const snapshot = await fetchInstagramBusinessSnapshot({
    env,
    fetchImpl: fetch,
    generatedAt: new Date().toISOString()
  });

  return jsonResponse({
    ok: true,
    provider: "instagram",
    snapshot
  });
}

async function handleMetaInstagramReport(request, env) {
  if (request.method !== "GET") {
    return jsonResponse({ ok: false, message: "Method not allowed." }, 405);
  }

  const snapshot = await fetchInstagramBusinessSnapshot({
    env,
    fetchImpl: fetch,
    generatedAt: new Date().toISOString()
  });
  const report = createFounderInstagramAnalyticsReportingView({
    instagramSnapshot: snapshot,
    websiteAttributionEvents: [],
    crmAttributionEvents: [],
    generatedAt: snapshot.generatedAt
  });

  return jsonResponse({
    ok: true,
    provider: "instagram",
    report
  });
}

async function handleMetaInstagramCallback(request, env) {
  if (request.method !== "GET") {
    return jsonResponse({ ok: false, message: "Method not allowed." }, 405);
  }

  const url = new URL(request.url);
  const providerError = url.searchParams.get("error");
  if (providerError) {
    return safeCallbackResponse(request, {
      ok: false,
      message: "Meta returned an OAuth error.",
      error: {
        code: providerError,
        description: url.searchParams.get("error_description") || ""
      }
    }, 400);
  }

  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  if (!code || !state) {
    return safeCallbackResponse(request, {
      ok: false,
      message: "Meta Instagram OAuth callback requires code and state parameters."
    }, 400);
  }

  const storage = validateTokenStorage(env);
  if (!storage.ok) {
    return safeCallbackResponse(request, {
      ok: false,
      message: "Meta Instagram token storage is not configured. Authorization code was not exchanged.",
      missing: storage.missing,
      storage: storage.status
    }, 503);
  }

  const stateCheck = verifyMetaInstagramOAuthState({ env, state });
  if (!stateCheck.ok) {
    return safeCallbackResponse(request, {
      ok: false,
      message: "Meta Instagram OAuth state validation failed.",
      error: safeError(stateCheck.error, "Invalid OAuth state.")
    }, 400);
  }

  const result = await completeMetaInstagramOAuthConnection({
    env,
    fetchImpl: fetch,
    code,
    state
  });

  if (!result.ok) {
    return safeCallbackResponse(request, {
      ok: false,
      message: "Meta Instagram OAuth connection failed.",
      error: safeError(result.error, "OAuth connection failed.")
    }, result.error?.retryable ? 503 : 400);
  }

  const persisted = await persistMetaInstagramTokenPatch({
    env,
    envPatch: result.envPatch
  });

  if (!persisted.ok) {
    return safeCallbackResponse(request, {
      ok: false,
      message: persisted.message,
      missing: persisted.missing || persisted.storage?.missing || []
    }, persisted.status || 500);
  }

  return safeCallbackResponse(request, {
    ok: true,
    provider: "instagram",
    state: result.state,
    storage: {
      persisted: true,
      storageKey: persisted.storageKey,
      updatedAt: persisted.updatedAt,
      tokenFields: persisted.tokenFields
    },
    status: result.safeStatus
  });
}

function logRouteIqProspectiveCloseFailure(error, phase = "close") {
  const status = Number.isInteger(error?.status) ? error.status : 500;
  const code = typeof error?.code === "string" && /^route_iq_[a-z0-9_]+$/u.test(error.code)
    ? error.code
    : "route_iq_prospective_session_close_failed";
  console.error(JSON.stringify({
    message: "Route IQ prospective session close failed after canonical handoff success.",
    metric: "route_iq_prospective_session_close_failure",
    phase,
    code,
    status,
    retryable: status === 429 || status >= 500
  }));
}

function scheduleRouteIqProspectiveSessionClose(request, env, {
  completionAction,
  handoffResult,
  executionContext,
  prospectiveTestHooks
}) {
  if (!getRouteIqProspectiveActivation(env, {
    now: prospectiveTestHooks?.enabled === true
      ? prospectiveTestHooks.currentDate
      : undefined
  }).active) return null;
  const closePromise = Promise.resolve()
    .then(() => reconcileAndCloseRouteIqProspectiveSessionFromHandoff(request, env, {
      completionAction,
      handoffResult,
      noncanonicalTestHooks: prospectiveTestHooks
    }))
    .catch(error => {
      logRouteIqProspectiveCloseFailure(error);
      return { status: "failure_isolated" };
    });
  if (typeof executionContext?.waitUntil === "function") {
    try {
      executionContext.waitUntil(closePromise);
    } catch (error) {
      logRouteIqProspectiveCloseFailure(error, "wait_until_registration");
    }
  }
  return closePromise;
}

async function handleRouteIqFieldSessionHandoff(request, env, {
  customerPwaAuthorization,
  executionContext,
  prospectiveTestHooks
} = {}) {
  if (request.method !== "POST") {
    return jsonResponse({ ok: false, acknowledged: false, message: "Method not allowed." }, 405, { Allow: "POST" });
  }

  try {
    const binding = validateFieldSessionStoreBinding(env);
    if (!binding.ok) {
      throw fieldSessionRequestError(
        "Data field-session storage is unavailable.",
        "field_session_store_binding_missing",
        503,
        { bindingName: binding.bindingName, missingMethods: binding.missingMethods }
      );
    }

    const body = await readBoundedJsonRequest(request);
    if (customerPwaAuthorization) {
      assertRouteIqCustomerPwaFieldSessionScope(customerPwaAuthorization, body);
    }
    if (!ROUTE_IQ_FIELD_SESSION_ACTIONS.includes(body.completionAction)) {
      throw fieldSessionRequestError(
        "Field-session completion action must be End Route or End Day.",
        "field_session_completion_action_invalid",
        400,
        { completionAction: body.completionAction || null }
      );
    }
    const workspace = supportedFieldSessionWorkspaces[body.workspaceId];
    if (!workspace) {
      throw fieldSessionRequestError(
        `Unknown field-session workspace: ${body.workspaceId || "missing"}.`,
        "field_session_workspace_unknown",
        400
      );
    }
    if (body.operatingProfileId !== workspace.operatingProfileId) {
      throw fieldSessionRequestError(
        `Operating profile ${body.operatingProfileId || "missing"} is not valid for ${body.workspaceId}.`,
        "field_session_operating_profile_mismatch",
        400
      );
    }
    const runtimeContext = await loadFieldSessionRuntimeContext(request, env);

    const result = await consumeRouteIqEndOfDayHandoff({
      handoffContractId: routeIqEndOfDayHandoffContractId,
      producerSubsystem: "Prometheus Dashboard",
      completionAction: body.completionAction,
      workspaceId: body.workspaceId,
      operatingProfileId: body.operatingProfileId,
      finalExportConfirmed: body.finalExportConfirmed,
      sourceFinalizedAt: body.sourceFinalizedAt,
      rawReportText: body.rawReportText
    }, { env, ...runtimeContext });

    try {
      scheduleRouteIqProspectiveSessionClose(request, env, {
        completionAction: body.completionAction,
        handoffResult: result,
        executionContext,
        prospectiveTestHooks
      });
    } catch (error) {
      logRouteIqProspectiveCloseFailure(error, "schedule");
    }

    const acknowledgment = {
      contractId: result.handoffContractId,
      status: result.status,
      sessionId: result.sessionId,
      workspaceId: result.workspaceId,
      rawSha256: result.rawSha256,
      duplicate: result.duplicate,
      persisted: result.persisted,
      sourceFinalizedAt: result.sourceFinalizedAt
    };
    console.log(JSON.stringify({
      message: "Dashboard Route IQ field session acknowledged.",
      completionAction: body.completionAction,
      sessionId: acknowledgment.sessionId,
      workspaceId: acknowledgment.workspaceId,
      status: acknowledgment.status,
      duplicate: acknowledgment.duplicate
    }));
    return jsonResponse({ ok: true, acknowledged: true, acknowledgment }, result.duplicate ? 200 : 201);
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : 500;
    const retryable = status === 429 || status >= 500;
    const code = error?.code || "field_session_archive_failed";
    console.error(JSON.stringify({
      message: "Dashboard Route IQ field-session handoff failed.",
      code,
      status,
      retryable
    }));
    return jsonResponse({
      ok: false,
      acknowledged: false,
      code,
      message: status >= 500 ? "Field-session archive is temporarily unavailable." : error.message,
      retryable
    }, status);
  }
}

async function handleRouteIqCustomerAwareFieldSessionRequest(request, env, executionContext, {
  customerPwaTestHooks
} = {}) {
  let customerPwaAuthorization = null;
  if (request.method === "POST") {
    try {
      if (getRouteIqCustomerPwaLaunchMode(env) === "ON") {
        customerPwaAuthorization = await authorizeRouteIqCustomerPwaRequest(request, env, {
          testHooks: customerPwaTestHooks
        });
      }
    } catch (error) {
      return routeIqCustomerPwaErrorResponse(error);
    }
  }
  return handleRouteIqFieldSessionHandoff(request, env, {
    customerPwaAuthorization,
    executionContext
  });
}

async function handleApiRequest(request, env, executionContext, {
  dailySnapshotTestHooks,
  paidCustomerOnboardingTestHooks,
  paidCustomerDashboardPreviewTestHooks,
  paidCustomerRevenueReadinessTestHooks
} = {}) {
  const url = new URL(request.url);
  if (isPaidCustomerRevenueReadinessPath(url.pathname)) {
    try {
      const founderPrincipal = await authorizeRouteIqFounderDailySnapshot(
        request,
        env,
        paidCustomerRevenueReadinessTestHooks?.founderAuthentication
      );
      return handlePaidCustomerRevenueReadinessRequest(
        request,
        founderPrincipal,
        { now: paidCustomerRevenueReadinessTestHooks?.now || new Date() }
      );
    } catch {
      return routeIqFounderSnapshotResponse({
        ok: false,
        code: "route_iq_resource_unavailable"
      }, 404);
    }
  }
  if (isRouteIqPaidCustomerDashboardPreviewPath(url.pathname)) {
    return handleRouteIqPaidCustomerDashboardPreviewRequest(
      request,
      env,
      paidCustomerDashboardPreviewTestHooks
    );
  }
  if (isRouteIqPaidCustomerOnboardingPath(url.pathname)) {
    return handleRouteIqPaidCustomerOnboardingRequest(
      request,
      env,
      paidCustomerOnboardingTestHooks
    );
  }
  if (isRouteIqBusinessAvailabilityPath(url.pathname)) {
    return handleRouteIqBusinessAvailabilityRequest(request, env);
  }
  if (url.pathname === ROUTE_IQ_FOUNDER_DAILY_SNAPSHOT_PATH) {
    return handleRouteIqFounderDailySnapshot(request, env, { testHooks: dailySnapshotTestHooks });
  }
  if (url.pathname === ROUTE_IQ_FOUNDER_OPERATIONAL_SESSION_PATH) {
    return handleRouteIqFounderOperationalSession(request, env, { testHooks: dailySnapshotTestHooks });
  }
  if (url.pathname === ROUTE_IQ_FOUNDER_SYSTEM_STATUS_PATH) {
    return handleRouteIqFounderSystemStatus(request, env, { testHooks: dailySnapshotTestHooks });
  }
  if (isRouteIqRequestCrmPath(url.pathname)) return handleRouteIqRequestCrmRuntimeRequest(request, env);
  if (CALLBACK_PATHS.includes(url.pathname)) return handleMetaInstagramCallback(request, env);
  if (url.pathname === STATUS_PATH) return handleMetaInstagramStatus(env);
  if (url.pathname === INSTAGRAM_SNAPSHOT_PATH) return handleMetaInstagramSnapshot(request, env);
  if (url.pathname === INSTAGRAM_REPORT_PATH) return handleMetaInstagramReport(request, env);
  if (url.pathname === ROUTE_IQ_FIELD_SESSION_HANDOFF_PATH) {
    return handleRouteIqFieldSessionHandoff(request, env, { executionContext });
  }
  if (isRouteIqProspectiveShadowPath(url.pathname)) {
    return handleRouteIqProspectiveShadowRequest(request, env, { executionContext });
  }
  return jsonResponse({ ok: false, message: "Not found." }, 404);
}

export async function handlePrometheusIqWorkerRequest(request, env, executionContext, {
  customerPwaTestHooks,
  unattendedSmokeTestHooks,
  dailySnapshotTestHooks,
  paidCustomerOnboardingTestHooks,
  paidCustomerDashboardPreviewTestHooks,
  paidCustomerRevenueReadinessTestHooks,
  controlledPaidCustomerRehearsalTestHooks
} = {}) {
  const smokeAuthorization = await authorizeCloudflareUnattendedSmokeRequest(request, env, {
    noncanonicalTestHooks: unattendedSmokeTestHooks
  });
  if (smokeAuthorization.kind === "denied") return smokeAuthorization.response;

  let response;
  try {
    const url = new URL(request.url);
    if (isControlledPaidCustomerOnboardingRehearsalPath(url.pathname)) {
      response = await handleControlledPaidCustomerOnboardingRehearsalRequest(
        request,
        smokeAuthorization,
        { testHooks: controlledPaidCustomerRehearsalTestHooks }
      );
    } else if (isRouteIqCustomerPwaAppNamespace(url.pathname)
      || isRouteIqCustomerPwaSessionPath(url.pathname)) {
      response = await handleRouteIqCustomerPwaRequest(request, env, { testHooks: customerPwaTestHooks });
    } else if (isRouteIqProspectiveShadowPath(url.pathname)
      && (!getRouteIqProspectiveActivation(env).active || request.method === "GET")) {
      response = await handleRouteIqProspectiveShadowRequest(request, env, { executionContext });
    } else if (url.pathname.startsWith("/api/")) {
      const aegis = await enforceAegisControls(request, env);
      if (!aegis.ok) {
        response = aegis.response;
      } else if (url.pathname === ROUTE_IQ_FIELD_SESSION_HANDOFF_PATH) {
        response = withAegisHeaders(
          await handleRouteIqCustomerAwareFieldSessionRequest(request, env, executionContext, {
            customerPwaTestHooks
          }),
          aegis
        );
      } else {
        response = withAegisHeaders(await handleApiRequest(request, env, executionContext, {
          dailySnapshotTestHooks,
          paidCustomerOnboardingTestHooks,
          paidCustomerDashboardPreviewTestHooks,
          paidCustomerRevenueReadinessTestHooks
        }), aegis);
      }
    } else {
      response = await env.ASSETS.fetch(
        sanitizeCloudflareUnattendedSmokeAssetRequest(request, smokeAuthorization)
      );
    }
  } catch {
    response = jsonResponse({
      ok: false,
      message: "Internal server error."
    }, 500);
  }

  return markCloudflareUnattendedSmokeResponse(response, smokeAuthorization, env);
}

export default {
  async fetch(request, env, executionContext) {
    return handlePrometheusIqWorkerRequest(request, env, executionContext);
  },
  async scheduled(event, env, executionContext) {
    return handleRouteIqBusinessAvailabilityScheduled(event, env, executionContext);
  }
};

export {
  CALLBACK_PATH,
  CALLBACK_PATHS,
  FACEBOOK_BUSINESS_CALLBACK_PATH,
  INSTAGRAM_REPORT_PATH,
  INSTAGRAM_SNAPSHOT_PATH,
  ROUTE_IQ_FIELD_SESSION_HANDOFF_PATH,
  ROUTE_IQ_FOUNDER_DAILY_SNAPSHOT_CONTRACT_VERSION,
  ROUTE_IQ_FOUNDER_DAILY_SNAPSHOT_ENV,
  ROUTE_IQ_FOUNDER_DAILY_SNAPSHOT_PATH,
  ROUTE_IQ_FOUNDER_DAILY_SNAPSHOT_PRINCIPAL_ID,
  ROUTE_IQ_FOUNDER_OPERATIONAL_SESSION_PATH,
  ROUTE_IQ_FOUNDER_SYSTEM_STATUS_PATH,
  ROUTE_IQ_PAID_CUSTOMER_DASHBOARD_PREVIEW_PATH,
  ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_ROOT,
  ROUTE_IQ_BUSINESS_AVAILABILITY_PATH,
  ROUTE_IQ_PROSPECTIVE_SHADOW_PATH,
  ROUTE_IQ_REQUEST_CRM_PATH,
  STATUS_PATH,
  TOKEN_STORE_KEY,
  handleRouteIqRequestCrmRuntimeRequest,
  handleRouteIqBusinessAvailabilityRequest,
  handleRouteIqBusinessAvailabilityScheduled,
  handleRouteIqFounderDailySnapshot,
  handleRouteIqFounderOperationalSession,
  handleRouteIqFounderSystemStatus,
  handleRouteIqPaidCustomerDashboardPreviewRequest,
  handleRouteIqPaidCustomerOnboardingRequest,
  handleRouteIqFieldSessionHandoff,
  handleRouteIqProspectiveShadowRequest,
  persistMetaInstagramTokenPatch,
  validateTokenStorage
};

export {
  RouteIqProspectiveShadowCoordinator
} from "./infrastructure/route-iq-prospective-shadow-durable-object.js";

export {
  RouteIqRequestCrmCoordinator
} from "./infrastructure/route-iq-request-crm-durable-object.js";

export {
  RouteIqBusinessAvailabilityCoordinator
} from "./infrastructure/route-iq-business-availability-durable-object.js";
