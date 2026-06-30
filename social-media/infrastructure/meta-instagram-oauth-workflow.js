import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import {
  SOCIAL_CONNECTION_STATES,
  SOCIAL_ERROR_CODES,
  createSocialIntegrationError,
  stripSensitiveSocialDetails
} from "../contracts/social-media-contract.js";
import {
  INSTAGRAM_MINIMUM_ANALYTICS_PERMISSIONS,
  INSTAGRAM_RUNTIME_ENVIRONMENT,
  publicInstagramRuntimeStatus,
  resolveInstagramRuntimeConfig,
  validateInstagramRuntimeEnvironment
} from "./instagram-runtime-controls.js";

export const META_INSTAGRAM_OAUTH_WORKFLOW_VERSION = "meta-instagram-oauth-workflow.v1";

export const META_INSTAGRAM_OAUTH_ENDPOINTS = Object.freeze({
  AUTHORIZE: "https://www.instagram.com/oauth/authorize",
  SHORT_LIVED_TOKEN: "https://api.instagram.com/oauth/access_token",
  LONG_LIVED_TOKEN: "https://graph.instagram.com/access_token",
  REFRESH_LONG_LIVED_TOKEN: "https://graph.instagram.com/refresh_access_token",
  ME: "https://graph.instagram.com/me"
});

const DEFAULT_STATE_TTL_SECONDS = 10 * 60;
const DEFAULT_REFRESH_EARLY_SECONDS = 7 * 24 * 60 * 60;

function envValue(env, key) {
  return typeof env?.[key] === "string" ? env[key].trim() : "";
}

function nowDate(value = new Date()) {
  return value instanceof Date ? value : new Date(value);
}

function secondsToIso(now, seconds) {
  return new Date(nowDate(now).getTime() + Number(seconds || 0) * 1000).toISOString();
}

function base64UrlEncode(value) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function oauthScopes(env = {}) {
  const configured = envValue(env, "INSTAGRAM_OAUTH_SCOPES") || envValue(env, "META_INSTAGRAM_OAUTH_SCOPES");
  if (configured) {
    return configured
      .split(/[\s,]+/)
      .map(scope => scope.trim())
      .filter(Boolean);
  }
  return [...INSTAGRAM_MINIMUM_ANALYTICS_PERMISSIONS];
}

function stateSecret(env = {}) {
  return envValue(env, "META_OAUTH_STATE_SECRET") || envValue(env, INSTAGRAM_RUNTIME_ENVIRONMENT.META_APP_SECRET);
}

function createError(code, message, details = {}, retryable = false) {
  return createSocialIntegrationError({
    code,
    message,
    retryable,
    details
  });
}

function safeErrorResult(code, message, details = {}, retryable = false) {
  return {
    ok: false,
    version: META_INSTAGRAM_OAUTH_WORKFLOW_VERSION,
    error: createError(code, message, details, retryable)
  };
}

function sanitizeProviderUrl(url) {
  const safe = new URL(String(url));
  for (const key of ["access_token", "client_secret", "appsecret_proof"]) {
    if (safe.searchParams.has(key)) safe.searchParams.set(key, "[redacted]");
  }
  return safe.toString();
}

async function readProviderJson(response) {
  return response.json().catch(() => ({}));
}

async function fetchJson(fetchImpl, url, init = {}, providerLabel = "Meta Instagram") {
  if (typeof fetchImpl !== "function") {
    return safeErrorResult(
      SOCIAL_ERROR_CODES.PROVIDER_UNAVAILABLE,
      "Fetch is unavailable for Meta Instagram OAuth workflow.",
      {},
      false
    );
  }

  const response = await fetchImpl(url, init);
  const json = await readProviderJson(response);

  if (!response.ok) {
    return safeErrorResult(
      response.status === 429 ? SOCIAL_ERROR_CODES.RATE_LIMITED : SOCIAL_ERROR_CODES.PROVIDER_ERROR,
      `${providerLabel} request failed.`,
      {
        httpStatus: response.status,
        url: sanitizeProviderUrl(url),
        response: json
      },
      response.status === 429 || response.status >= 500
    );
  }

  return {
    ok: true,
    data: json,
    httpStatus: response.status
  };
}

export function createMetaInstagramOAuthState({
  env = process.env,
  now = new Date(),
  nonce = randomBytes(16).toString("hex"),
  redirectAfter = "/",
  ttlSeconds = DEFAULT_STATE_TTL_SECONDS
} = {}) {
  const secret = stateSecret(env);
  if (!secret) {
    return safeErrorResult(
      SOCIAL_ERROR_CODES.NOT_CONFIGURED,
      "Meta Instagram OAuth state secret is not configured.",
      { required: ["META_OAUTH_STATE_SECRET", INSTAGRAM_RUNTIME_ENVIRONMENT.META_APP_SECRET] }
    );
  }

  const issuedAt = nowDate(now).toISOString();
  const expiresAt = secondsToIso(now, ttlSeconds);
  const payload = {
    nonce,
    issuedAt,
    expiresAt,
    redirectAfter
  };
  const encoded = base64UrlEncode(JSON.stringify(payload));
  const signature = createHmac("sha256", secret).update(encoded).digest("base64url");

  return {
    ok: true,
    version: META_INSTAGRAM_OAUTH_WORKFLOW_VERSION,
    state: `${encoded}.${signature}`,
    expiresAt
  };
}

export function verifyMetaInstagramOAuthState({
  env = process.env,
  state,
  now = new Date()
} = {}) {
  const secret = stateSecret(env);
  if (!secret) {
    return safeErrorResult(
      SOCIAL_ERROR_CODES.NOT_CONFIGURED,
      "Meta Instagram OAuth state secret is not configured.",
      { required: ["META_OAUTH_STATE_SECRET", INSTAGRAM_RUNTIME_ENVIRONMENT.META_APP_SECRET] }
    );
  }

  const [encoded, signature] = String(state || "").split(".");
  if (!encoded || !signature) {
    return safeErrorResult(SOCIAL_ERROR_CODES.VALIDATION_FAILED, "Meta Instagram OAuth state is malformed.");
  }

  const expected = createHmac("sha256", secret).update(encoded).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    return safeErrorResult(SOCIAL_ERROR_CODES.VALIDATION_FAILED, "Meta Instagram OAuth state signature is invalid.");
  }

  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(encoded));
  } catch {
    return safeErrorResult(SOCIAL_ERROR_CODES.VALIDATION_FAILED, "Meta Instagram OAuth state payload is invalid.");
  }

  if (!payload.expiresAt || new Date(payload.expiresAt).getTime() <= nowDate(now).getTime()) {
    return safeErrorResult(SOCIAL_ERROR_CODES.VALIDATION_FAILED, "Meta Instagram OAuth state has expired.");
  }

  return {
    ok: true,
    version: META_INSTAGRAM_OAUTH_WORKFLOW_VERSION,
    payload
  };
}

export function createMetaInstagramAuthorizationUrl({
  env = process.env,
  state,
  forceAuthentication = true
} = {}) {
  const config = resolveInstagramRuntimeConfig(env);
  const missing = [];
  if (!config.appIdPresent) missing.push(INSTAGRAM_RUNTIME_ENVIRONMENT.META_APP_ID);
  if (!config.callbackUrl) missing.push(INSTAGRAM_RUNTIME_ENVIRONMENT.META_OAUTH_CALLBACK_URL);
  if (!state) missing.push("oauth_state");

  if (missing.length) {
    return safeErrorResult(
      SOCIAL_ERROR_CODES.NOT_CONFIGURED,
      "Meta Instagram OAuth authorization URL cannot be created until required configuration is present.",
      { missing }
    );
  }

  const url = new URL(META_INSTAGRAM_OAUTH_ENDPOINTS.AUTHORIZE);
  url.searchParams.set("client_id", envValue(env, INSTAGRAM_RUNTIME_ENVIRONMENT.META_APP_ID));
  url.searchParams.set("redirect_uri", config.callbackUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", oauthScopes(env).join(","));
  url.searchParams.set("state", state);
  if (forceAuthentication) url.searchParams.set("force_authentication", "1");

  return {
    ok: true,
    version: META_INSTAGRAM_OAUTH_WORKFLOW_VERSION,
    url: url.toString(),
    scopes: oauthScopes(env),
    callbackUrl: config.callbackUrl
  };
}

export async function exchangeMetaInstagramAuthorizationCode({
  env = process.env,
  fetchImpl = globalThis.fetch,
  code
} = {}) {
  const config = resolveInstagramRuntimeConfig(env);
  const missing = [];
  if (!code) missing.push("code");
  if (!config.appIdPresent) missing.push(INSTAGRAM_RUNTIME_ENVIRONMENT.META_APP_ID);
  if (!config.appSecretPresent) missing.push(INSTAGRAM_RUNTIME_ENVIRONMENT.META_APP_SECRET);
  if (!config.callbackUrl) missing.push(INSTAGRAM_RUNTIME_ENVIRONMENT.META_OAUTH_CALLBACK_URL);
  if (missing.length) {
    return safeErrorResult(
      SOCIAL_ERROR_CODES.NOT_CONFIGURED,
      "Meta Instagram OAuth code exchange is missing required inputs.",
      { missing }
    );
  }

  const body = new URLSearchParams({
    client_id: envValue(env, INSTAGRAM_RUNTIME_ENVIRONMENT.META_APP_ID),
    client_secret: envValue(env, INSTAGRAM_RUNTIME_ENVIRONMENT.META_APP_SECRET),
    grant_type: "authorization_code",
    redirect_uri: config.callbackUrl,
    code
  });

  const result = await fetchJson(fetchImpl, META_INSTAGRAM_OAUTH_ENDPOINTS.SHORT_LIVED_TOKEN, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  }, "Meta Instagram OAuth code exchange");

  if (!result.ok) return result;
  if (!result.data.access_token) {
    return safeErrorResult(
      SOCIAL_ERROR_CODES.PROVIDER_ERROR,
      "Meta Instagram OAuth code exchange did not return an access token.",
      { response: result.data }
    );
  }

  return {
    ok: true,
    version: META_INSTAGRAM_OAUTH_WORKFLOW_VERSION,
    tokenType: "short_lived",
    accessToken: result.data.access_token,
    userId: result.data.user_id || null,
    grantedPermissions: result.data.permissions || oauthScopes(env),
    providerResponse: stripSensitiveSocialDetails(result.data)
  };
}

export async function exchangeMetaInstagramLongLivedToken({
  env = process.env,
  fetchImpl = globalThis.fetch,
  shortLivedAccessToken,
  now = new Date()
} = {}) {
  const config = resolveInstagramRuntimeConfig(env);
  const missing = [];
  if (!shortLivedAccessToken) missing.push("shortLivedAccessToken");
  if (!config.appSecretPresent) missing.push(INSTAGRAM_RUNTIME_ENVIRONMENT.META_APP_SECRET);
  if (missing.length) {
    return safeErrorResult(
      SOCIAL_ERROR_CODES.NOT_CONFIGURED,
      "Meta Instagram long-lived token exchange is missing required inputs.",
      { missing }
    );
  }

  const url = new URL(META_INSTAGRAM_OAUTH_ENDPOINTS.LONG_LIVED_TOKEN);
  url.searchParams.set("grant_type", "ig_exchange_token");
  url.searchParams.set("client_secret", envValue(env, INSTAGRAM_RUNTIME_ENVIRONMENT.META_APP_SECRET));
  url.searchParams.set("access_token", shortLivedAccessToken);

  const result = await fetchJson(fetchImpl, url, {}, "Meta Instagram long-lived token exchange");
  if (!result.ok) return result;
  if (!result.data.access_token) {
    return safeErrorResult(
      SOCIAL_ERROR_CODES.PROVIDER_ERROR,
      "Meta Instagram long-lived token exchange did not return an access token.",
      { response: result.data }
    );
  }

  return {
    ok: true,
    version: META_INSTAGRAM_OAUTH_WORKFLOW_VERSION,
    tokenType: "long_lived",
    accessToken: result.data.access_token,
    expiresIn: result.data.expires_in || null,
    expiresAt: result.data.expires_in ? secondsToIso(now, result.data.expires_in) : null
  };
}

export async function refreshMetaInstagramLongLivedToken({
  env = process.env,
  fetchImpl = globalThis.fetch,
  accessToken,
  now = new Date()
} = {}) {
  const token = accessToken || resolveInstagramRuntimeConfig(env).accessToken;
  if (!token) {
    return safeErrorResult(
      SOCIAL_ERROR_CODES.TOKEN_MISSING,
      "Meta Instagram long-lived token refresh requires an existing backend token."
    );
  }

  const url = new URL(META_INSTAGRAM_OAUTH_ENDPOINTS.REFRESH_LONG_LIVED_TOKEN);
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", token);

  const result = await fetchJson(fetchImpl, url, {}, "Meta Instagram long-lived token refresh");
  if (!result.ok) return result;
  if (!result.data.access_token) {
    return safeErrorResult(
      SOCIAL_ERROR_CODES.PROVIDER_ERROR,
      "Meta Instagram long-lived token refresh did not return an access token.",
      { response: result.data }
    );
  }

  return {
    ok: true,
    version: META_INSTAGRAM_OAUTH_WORKFLOW_VERSION,
    tokenType: "long_lived_refreshed",
    accessToken: result.data.access_token,
    expiresIn: result.data.expires_in || null,
    expiresAt: result.data.expires_in ? secondsToIso(now, result.data.expires_in) : null,
    refreshedAt: nowDate(now).toISOString()
  };
}

export async function verifyMetaInstagramToken({
  env = process.env,
  fetchImpl = globalThis.fetch,
  accessToken,
  now = new Date()
} = {}) {
  const token = accessToken || resolveInstagramRuntimeConfig(env).accessToken;
  if (!token) {
    return safeErrorResult(
      SOCIAL_ERROR_CODES.TOKEN_MISSING,
      "Meta Instagram token verification requires an existing backend token."
    );
  }

  const url = new URL(META_INSTAGRAM_OAUTH_ENDPOINTS.ME);
  url.searchParams.set("fields", "user_id,username,account_type");
  url.searchParams.set("access_token", token);

  const result = await fetchJson(fetchImpl, url, {}, "Meta Instagram token verification");
  if (!result.ok) return result;

  return {
    ok: true,
    version: META_INSTAGRAM_OAUTH_WORKFLOW_VERSION,
    verifiedAt: nowDate(now).toISOString(),
    instagramUser: {
      userId: result.data.user_id || result.data.id || null,
      username: result.data.username || null,
      accountType: result.data.account_type || null
    }
  };
}

export async function completeMetaInstagramOAuthConnection({
  env = process.env,
  fetchImpl = globalThis.fetch,
  code,
  state,
  now = new Date()
} = {}) {
  const stateResult = verifyMetaInstagramOAuthState({ env, state, now });
  if (!stateResult.ok) return stateResult;

  const shortToken = await exchangeMetaInstagramAuthorizationCode({ env, fetchImpl, code });
  if (!shortToken.ok) return shortToken;

  const longToken = await exchangeMetaInstagramLongLivedToken({
    env,
    fetchImpl,
    shortLivedAccessToken: shortToken.accessToken,
    now
  });
  if (!longToken.ok) return longToken;

  const verification = await verifyMetaInstagramToken({
    env,
    fetchImpl,
    accessToken: longToken.accessToken,
    now
  });
  if (!verification.ok) return verification;

  const grantedPermissions = shortToken.grantedPermissions.length ? shortToken.grantedPermissions : oauthScopes(env);
  const envPatch = {
    INSTAGRAM_ACCESS_TOKEN: longToken.accessToken,
    INSTAGRAM_GRANTED_SCOPES: grantedPermissions.join(","),
    INSTAGRAM_TOKEN_EXPIRES_AT: longToken.expiresAt,
    INSTAGRAM_CONNECTION_VERIFIED_AT: verification.verifiedAt
  };

  if (verification.instagramUser.userId) envPatch.INSTAGRAM_USER_ID = verification.instagramUser.userId;
  if (verification.instagramUser.username) envPatch.INSTAGRAM_ACCOUNT_HANDLE = `@${verification.instagramUser.username}`;

  return {
    ok: true,
    version: META_INSTAGRAM_OAUTH_WORKFLOW_VERSION,
    state: SOCIAL_CONNECTION_STATES.CONNECTED,
    token: {
      accessToken: longToken.accessToken,
      expiresAt: longToken.expiresAt,
      refreshedAt: null
    },
    grantedPermissions,
    instagramUser: verification.instagramUser,
    envPatch,
    safeStatus: publicInstagramRuntimeStatus(validateInstagramRuntimeEnvironment({
      env: {
        ...env,
        ...envPatch
      },
      now
    }))
  };
}

export function shouldRefreshMetaInstagramToken({
  env = process.env,
  now = new Date(),
  refreshEarlySeconds = DEFAULT_REFRESH_EARLY_SECONDS
} = {}) {
  const config = resolveInstagramRuntimeConfig(env);
  if (!config.accessTokenPresent) {
    return {
      shouldRefresh: false,
      reason: "token_missing"
    };
  }

  if (!config.tokenExpiresAt) {
    return {
      shouldRefresh: true,
      reason: "expiration_unknown"
    };
  }

  const refreshAt = new Date(new Date(config.tokenExpiresAt).getTime() - refreshEarlySeconds * 1000);
  return {
    shouldRefresh: refreshAt.getTime() <= nowDate(now).getTime(),
    reason: refreshAt.getTime() <= nowDate(now).getTime() ? "inside_refresh_window" : "outside_refresh_window",
    refreshAt: refreshAt.toISOString(),
    tokenExpiresAt: config.tokenExpiresAt
  };
}
