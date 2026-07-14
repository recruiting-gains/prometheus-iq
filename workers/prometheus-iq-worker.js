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
  PARTNER_INTAKE_PATH,
  handlePartnerIntakeRequest
} from "./infrastructure/shared-lead-intake-pipeline.js";
import {
  ROUTE_IQ_PROSPECTIVE_SHADOW_PATH,
  getRouteIqProspectiveActivation,
  handleRouteIqProspectiveShadowRequest,
  isRouteIqProspectiveShadowPath,
  reconcileAndCloseRouteIqProspectiveSessionFromHandoff
} from "./infrastructure/route-iq-prospective-shadow-runtime.js";
import {
  persistWorkspaceLeadIntakeWithProductionStore
} from "../crm/workspace-lead-production-runtime.mjs";
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

async function handlePartnerIntakeWithCrm(request, env) {
  const result = await handlePartnerIntakeRequest(request, env);
  if (!result.record) return result;

  try {
    const crmPersistence = await persistWorkspaceLeadIntakeWithProductionStore(result.record, { env });
    return {
      ...result,
      headers: {
        ...(result.headers || {}),
        "X-Prometheus-CRM-Persistence": crmPersistence.status
      }
    };
  } catch (error) {
    const code = error?.code || "crm_workspace_lead_persistence_failed";
    console.error(JSON.stringify({
      message: "CRM workspace lead persistence failed.",
      code,
      workspaceId: result.record.workspace.workspaceId,
      submissionId: result.record.submissionId
    }));
    return {
      body: {
        ok: false,
        code,
        message: "CRM durable lead persistence is unavailable.",
        submissionId: result.record.submissionId,
        workspaceId: result.record.workspace.workspaceId,
        infrastructurePersisted: true
      },
      status: error?.status || 500,
      headers: {
        "X-Prometheus-CRM-Persistence": "failed"
      }
    };
  }
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

async function handleApiRequest(request, env, executionContext) {
  const url = new URL(request.url);
  if (url.pathname === PARTNER_INTAKE_PATH) {
    const result = await handlePartnerIntakeWithCrm(request, env);
    return jsonResponse(result.body, result.status, result.headers || {});
  }
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

export default {
  async fetch(request, env, executionContext) {
    const url = new URL(request.url);
    try {
      if (isRouteIqProspectiveShadowPath(url.pathname)
        && (!getRouteIqProspectiveActivation(env).active || request.method === "GET")) {
        return handleRouteIqProspectiveShadowRequest(request, env, { executionContext });
      }
      if (url.pathname.startsWith("/api/")) {
        const aegis = await enforceAegisControls(request, env);
        if (!aegis.ok) return aegis.response;
        return withAegisHeaders(await handleApiRequest(request, env, executionContext), aegis);
      }
      return env.ASSETS.fetch(request);
    } catch {
      return jsonResponse({
        ok: false,
        message: "Internal server error."
      }, 500);
    }
  }
};

export {
  CALLBACK_PATH,
  CALLBACK_PATHS,
  FACEBOOK_BUSINESS_CALLBACK_PATH,
  INSTAGRAM_REPORT_PATH,
  INSTAGRAM_SNAPSHOT_PATH,
  ROUTE_IQ_FIELD_SESSION_HANDOFF_PATH,
  ROUTE_IQ_PROSPECTIVE_SHADOW_PATH,
  STATUS_PATH,
  TOKEN_STORE_KEY,
  handlePartnerIntakeWithCrm,
  handleRouteIqFieldSessionHandoff,
  handleRouteIqProspectiveShadowRequest,
  persistMetaInstagramTokenPatch,
  validateTokenStorage
};

export {
  RouteIqProspectiveShadowCoordinator
} from "./infrastructure/route-iq-prospective-shadow-durable-object.js";
