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

const CALLBACK_PATH = "/api/oauth/meta/instagram/callback";
const FACEBOOK_BUSINESS_CALLBACK_PATH = "/api/oauth/facebook-business/instagram/callback";
const STATUS_PATH = "/api/oauth/meta/instagram/status";
const INSTAGRAM_SNAPSHOT_PATH = "/api/social/instagram/snapshot";
const INSTAGRAM_REPORT_PATH = "/api/social/instagram/report";
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

async function handleApiRequest(request, env) {
  const url = new URL(request.url);
  if (url.pathname === PARTNER_INTAKE_PATH) {
    const result = await handlePartnerIntakeRequest(request, env);
    return jsonResponse(result.body, result.status, result.headers || {});
  }
  if (CALLBACK_PATHS.includes(url.pathname)) return handleMetaInstagramCallback(request, env);
  if (url.pathname === STATUS_PATH) return handleMetaInstagramStatus(env);
  if (url.pathname === INSTAGRAM_SNAPSHOT_PATH) return handleMetaInstagramSnapshot(request, env);
  if (url.pathname === INSTAGRAM_REPORT_PATH) return handleMetaInstagramReport(request, env);
  return jsonResponse({ ok: false, message: "Not found." }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith("/api/")) {
        const aegis = await enforceAegisControls(request, env);
        if (!aegis.ok) return aegis.response;
        return withAegisHeaders(await handleApiRequest(request, env), aegis);
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
  STATUS_PATH,
  TOKEN_STORE_KEY,
  persistMetaInstagramTokenPatch,
  validateTokenStorage
};
