import {
  FOUNDER_CONNECTION_STATES,
  FOUNDER_INTEGRATION_ERROR_CODES,
  createFounderIntegrationError,
  createFounderIntegrationStatus
} from "./founder-communications-contract.js";

const TOKEN_SAFETY_PATTERN = /(access_token|refresh_token|id_token|client_secret|authorization|password|credential)/i;

export function splitScopes(value = "") {
  return String(value || "")
    .split(/[,\s]+/)
    .map(scope => scope.trim())
    .filter(Boolean);
}

export function hasRequiredScopes(grantedScopes = [], requiredScopes = []) {
  const granted = new Set(grantedScopes);
  return requiredScopes.every(scope => granted.has(scope));
}

export function redactProviderPayload(value) {
  if (Array.isArray(value)) return value.map(redactProviderPayload);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(Object.entries(value).map(([key, child]) => [
    key,
    TOKEN_SAFETY_PATTERN.test(key) ? "[redacted]" : redactProviderPayload(child)
  ]));
}

export function missingConfigStatus({ provider, missing = [], requiredPermissions = [] }) {
  return createFounderIntegrationStatus({
    state: FOUNDER_CONNECTION_STATES.DISCONNECTED,
    provider,
    requiredPermissions,
    errors: [
      createFounderIntegrationError({
        code: FOUNDER_INTEGRATION_ERROR_CODES.NOT_CONNECTED,
        message: `${provider} founder integration is not configured.`,
        details: { missing }
      })
    ]
  });
}

export function permissionRequiredStatus({ provider, requiredPermissions = [], grantedPermissions = [] }) {
  return createFounderIntegrationStatus({
    state: FOUNDER_CONNECTION_STATES.PERMISSION_REQUIRED,
    provider,
    requiredPermissions,
    grantedPermissions,
    errors: [
      createFounderIntegrationError({
        code: FOUNDER_INTEGRATION_ERROR_CODES.PERMISSION_REQUIRED,
        message: `${provider} founder integration needs additional permissions.`,
        details: {
          requiredPermissions,
          grantedPermissions
        }
      })
    ]
  });
}

export function providerErrorStatus({ provider, code = FOUNDER_INTEGRATION_ERROR_CODES.PROVIDER_ERROR, message, retryable = true, details = {} }) {
  const state = code === FOUNDER_INTEGRATION_ERROR_CODES.PERMISSION_REQUIRED
    ? FOUNDER_CONNECTION_STATES.PERMISSION_REQUIRED
    : FOUNDER_CONNECTION_STATES.ERROR;

  return createFounderIntegrationStatus({
    state,
    provider,
    errors: [
      createFounderIntegrationError({
        code,
        message: message || `${provider} provider request failed.`,
        retryable,
        details: redactProviderPayload(details)
      })
    ]
  });
}

export function syncCompleteStatus({ provider, accountId = null, capabilities, requiredPermissions = [], grantedPermissions = [], lastSyncAt = new Date().toISOString() }) {
  return createFounderIntegrationStatus({
    state: FOUNDER_CONNECTION_STATES.SYNC_COMPLETE,
    provider,
    accountId,
    capabilities,
    requiredPermissions,
    grantedPermissions,
    lastSyncAt
  });
}

export function connectedStatus({ provider, accountId = null, capabilities, requiredPermissions = [], grantedPermissions = [] }) {
  return createFounderIntegrationStatus({
    state: FOUNDER_CONNECTION_STATES.CONNECTED,
    provider,
    accountId,
    capabilities,
    requiredPermissions,
    grantedPermissions
  });
}

export function syncPendingStatus({ provider, accountId = null, capabilities, requiredPermissions = [], grantedPermissions = [] }) {
  return createFounderIntegrationStatus({
    state: FOUNDER_CONNECTION_STATES.SYNC_PENDING,
    provider,
    accountId,
    capabilities,
    requiredPermissions,
    grantedPermissions
  });
}

export async function refreshOAuthAccessToken({
  fetchImpl = globalThis.fetch,
  tokenUrl,
  clientId,
  clientSecret,
  refreshToken,
  scope = "",
  provider
}) {
  if (typeof fetchImpl !== "function") {
    return {
      ok: false,
      status: providerErrorStatus({
        provider,
        message: "Fetch is unavailable for OAuth token refresh.",
        retryable: false
      })
    };
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token"
  });

  if (scope) body.set("scope", scope);

  const response = await fetchImpl(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });
  const json = await response.json().catch(() => ({}));

  if (!response.ok || !json.access_token) {
    return {
      ok: false,
      status: providerErrorStatus({
        provider,
        code: response.status === 400 || response.status === 401
          ? FOUNDER_INTEGRATION_ERROR_CODES.PERMISSION_REQUIRED
          : FOUNDER_INTEGRATION_ERROR_CODES.PROVIDER_ERROR,
        message: `${provider} OAuth token refresh failed.`,
        retryable: response.status >= 500 || response.status === 429,
        details: {
          httpStatus: response.status,
          response: json
        }
      })
    };
  }

  return {
    ok: true,
    accessToken: json.access_token,
    grantedPermissions: splitScopes(json.scope || scope),
    expiresIn: json.expires_in || null
  };
}

export async function fetchProviderJson({
  fetchImpl = globalThis.fetch,
  url,
  accessToken,
  provider,
  init = {}
}) {
  const headers = {
    Accept: "application/json",
    ...(init.headers || {}),
    Authorization: `Bearer ${accessToken}`
  };
  const response = await fetchImpl(url, {
    ...init,
    headers
  });
  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    const code = response.status === 401 || response.status === 403
      ? FOUNDER_INTEGRATION_ERROR_CODES.PERMISSION_REQUIRED
      : response.status === 429
        ? FOUNDER_INTEGRATION_ERROR_CODES.RATE_LIMITED
        : FOUNDER_INTEGRATION_ERROR_CODES.PROVIDER_ERROR;

    return {
      ok: false,
      status: providerErrorStatus({
        provider,
        code,
        message: `${provider} API request failed.`,
        retryable: response.status >= 500 || response.status === 429,
        details: {
          httpStatus: response.status,
          url: String(url).replace(/[?&](access_token|key)=[^&]+/gi, "$1=[redacted]"),
          response: json
        }
      })
    };
  }

  return {
    ok: true,
    data: json,
    httpStatus: response.status
  };
}
