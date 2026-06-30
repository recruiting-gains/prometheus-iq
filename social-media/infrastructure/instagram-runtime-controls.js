import {
  SOCIAL_CONNECTION_STATES,
  SOCIAL_ERROR_CODES,
  createSocialIntegrationError
} from "../contracts/social-media-contract.js";

export const INSTAGRAM_RUNTIME_CONTROL_VERSION = "instagram-runtime-controls.v1";

export const INSTAGRAM_MINIMUM_ANALYTICS_PERMISSIONS = Object.freeze([
  "instagram_basic",
  "instagram_manage_insights",
  "pages_show_list",
  "pages_read_engagement"
]);

export const INSTAGRAM_RUNTIME_ENVIRONMENT = Object.freeze({
  META_APP_ID: "META_APP_ID",
  META_APP_SECRET: "META_APP_SECRET",
  META_OAUTH_CALLBACK_URL: "META_OAUTH_CALLBACK_URL",
  META_GRAPH_API_VERSION: "META_GRAPH_API_VERSION",
  INSTAGRAM_BUSINESS_ACCOUNT_ID: "INSTAGRAM_BUSINESS_ACCOUNT_ID",
  INSTAGRAM_ACCOUNT_HANDLE: "INSTAGRAM_ACCOUNT_HANDLE",
  INSTAGRAM_ACCESS_TOKEN: "INSTAGRAM_ACCESS_TOKEN",
  META_INSTAGRAM_ACCESS_TOKEN: "META_INSTAGRAM_ACCESS_TOKEN",
  INSTAGRAM_GRANTED_SCOPES: "INSTAGRAM_GRANTED_SCOPES",
  INSTAGRAM_TOKEN_EXPIRES_AT: "INSTAGRAM_TOKEN_EXPIRES_AT",
  INSTAGRAM_CONNECTION_VERIFIED_AT: "INSTAGRAM_CONNECTION_VERIFIED_AT"
});

const DEFAULT_GRAPH_VERSION = "v21.0";
const DEFAULT_ACCOUNT_HANDLE = "@prometheus.iq";

const REQUIRED_SETUP_VARS = Object.freeze([
  INSTAGRAM_RUNTIME_ENVIRONMENT.META_APP_ID,
  INSTAGRAM_RUNTIME_ENVIRONMENT.META_APP_SECRET,
  INSTAGRAM_RUNTIME_ENVIRONMENT.META_OAUTH_CALLBACK_URL,
  INSTAGRAM_RUNTIME_ENVIRONMENT.INSTAGRAM_BUSINESS_ACCOUNT_ID
]);

const TOKEN_VARS = Object.freeze([
  INSTAGRAM_RUNTIME_ENVIRONMENT.INSTAGRAM_ACCESS_TOKEN,
  INSTAGRAM_RUNTIME_ENVIRONMENT.META_INSTAGRAM_ACCESS_TOKEN
]);

function envValue(env, key) {
  return typeof env?.[key] === "string" ? env[key].trim() : "";
}

function missingVars(env, keys) {
  return keys.filter(key => !envValue(env, key));
}

function parseList(value) {
  return String(value || "")
    .split(/[\s,]+/)
    .map(item => item.trim())
    .filter(Boolean);
}

function isValidGraphVersion(value) {
  return /^v\d+\.\d+$/.test(value);
}

function isValidHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeIso(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function createRuntimeError(code, message, details = {}) {
  return createSocialIntegrationError({
    code,
    message,
    details
  });
}

export function resolveInstagramRuntimeConfig(env = process.env) {
  const accessToken = envValue(env, INSTAGRAM_RUNTIME_ENVIRONMENT.INSTAGRAM_ACCESS_TOKEN)
    || envValue(env, INSTAGRAM_RUNTIME_ENVIRONMENT.META_INSTAGRAM_ACCESS_TOKEN);

  return {
    appIdPresent: Boolean(envValue(env, INSTAGRAM_RUNTIME_ENVIRONMENT.META_APP_ID)),
    appSecretPresent: Boolean(envValue(env, INSTAGRAM_RUNTIME_ENVIRONMENT.META_APP_SECRET)),
    callbackUrl: envValue(env, INSTAGRAM_RUNTIME_ENVIRONMENT.META_OAUTH_CALLBACK_URL),
    graphVersion: envValue(env, INSTAGRAM_RUNTIME_ENVIRONMENT.META_GRAPH_API_VERSION) || DEFAULT_GRAPH_VERSION,
    businessAccountId: envValue(env, INSTAGRAM_RUNTIME_ENVIRONMENT.INSTAGRAM_BUSINESS_ACCOUNT_ID),
    accountHandle: envValue(env, INSTAGRAM_RUNTIME_ENVIRONMENT.INSTAGRAM_ACCOUNT_HANDLE) || DEFAULT_ACCOUNT_HANDLE,
    accessToken,
    accessTokenPresent: Boolean(accessToken),
    grantedPermissions: parseList(envValue(env, INSTAGRAM_RUNTIME_ENVIRONMENT.INSTAGRAM_GRANTED_SCOPES)),
    tokenExpiresAt: normalizeIso(envValue(env, INSTAGRAM_RUNTIME_ENVIRONMENT.INSTAGRAM_TOKEN_EXPIRES_AT)),
    tokenExpiresAtRaw: envValue(env, INSTAGRAM_RUNTIME_ENVIRONMENT.INSTAGRAM_TOKEN_EXPIRES_AT),
    connectionVerifiedAt: normalizeIso(envValue(env, INSTAGRAM_RUNTIME_ENVIRONMENT.INSTAGRAM_CONNECTION_VERIFIED_AT)),
    connectionVerifiedAtRaw: envValue(env, INSTAGRAM_RUNTIME_ENVIRONMENT.INSTAGRAM_CONNECTION_VERIFIED_AT)
  };
}

export function validateInstagramRuntimeEnvironment({
  env = process.env,
  now = new Date()
} = {}) {
  const config = resolveInstagramRuntimeConfig(env);
  const missingSetup = missingVars(env, REQUIRED_SETUP_VARS);
  const missingToken = TOKEN_VARS.every(key => !envValue(env, key));
  const missingPermissions = INSTAGRAM_MINIMUM_ANALYTICS_PERMISSIONS
    .filter(permission => !config.grantedPermissions.includes(permission));
  const errors = [];

  if (config.callbackUrl && !isValidHttpsUrl(config.callbackUrl)) {
    errors.push(createRuntimeError(
      SOCIAL_ERROR_CODES.VALIDATION_FAILED,
      "Meta OAuth callback URL must be HTTPS.",
      { variable: INSTAGRAM_RUNTIME_ENVIRONMENT.META_OAUTH_CALLBACK_URL }
    ));
  }

  if (!isValidGraphVersion(config.graphVersion)) {
    errors.push(createRuntimeError(
      SOCIAL_ERROR_CODES.VALIDATION_FAILED,
      "Meta Graph API version must use the form v{major}.{minor}.",
      { variable: INSTAGRAM_RUNTIME_ENVIRONMENT.META_GRAPH_API_VERSION }
    ));
  }

  if (config.tokenExpiresAtRaw && !config.tokenExpiresAt) {
    errors.push(createRuntimeError(
      SOCIAL_ERROR_CODES.VALIDATION_FAILED,
      "Instagram token expiration must be a valid ISO date.",
      { variable: INSTAGRAM_RUNTIME_ENVIRONMENT.INSTAGRAM_TOKEN_EXPIRES_AT }
    ));
  }

  if (config.connectionVerifiedAtRaw && !config.connectionVerifiedAt) {
    errors.push(createRuntimeError(
      SOCIAL_ERROR_CODES.VALIDATION_FAILED,
      "Instagram connection verification timestamp must be a valid ISO date.",
      { variable: INSTAGRAM_RUNTIME_ENVIRONMENT.INSTAGRAM_CONNECTION_VERIFIED_AT }
    ));
  }

  if (errors.length) {
    return {
      version: INSTAGRAM_RUNTIME_CONTROL_VERSION,
      provider: "instagram",
      state: SOCIAL_CONNECTION_STATES.ERROR,
      config,
      requiredSetupVars: [...REQUIRED_SETUP_VARS],
      missingSetup,
      missingToken,
      requiredPermissions: [...INSTAGRAM_MINIMUM_ANALYTICS_PERMISSIONS],
      missingPermissions,
      errors
    };
  }

  if (missingSetup.length) {
    return {
      version: INSTAGRAM_RUNTIME_CONTROL_VERSION,
      provider: "instagram",
      state: SOCIAL_CONNECTION_STATES.NOT_CONFIGURED,
      config,
      requiredSetupVars: [...REQUIRED_SETUP_VARS],
      missingSetup,
      missingToken,
      requiredPermissions: [...INSTAGRAM_MINIMUM_ANALYTICS_PERMISSIONS],
      missingPermissions,
      errors: [
        createRuntimeError(
          SOCIAL_ERROR_CODES.NOT_CONFIGURED,
          "Instagram/Meta analytics runtime is not configured.",
          { missingSetup }
        )
      ]
    };
  }

  if (missingToken) {
    return {
      version: INSTAGRAM_RUNTIME_CONTROL_VERSION,
      provider: "instagram",
      state: SOCIAL_CONNECTION_STATES.TOKEN_MISSING,
      config,
      requiredSetupVars: [...REQUIRED_SETUP_VARS],
      missingSetup,
      missingToken,
      requiredPermissions: [...INSTAGRAM_MINIMUM_ANALYTICS_PERMISSIONS],
      missingPermissions,
      errors: [
        createRuntimeError(
          SOCIAL_ERROR_CODES.TOKEN_MISSING,
          "Instagram/Meta runtime setup exists, but no backend access token is configured.",
          { missingTokenVars: [...TOKEN_VARS] }
        )
      ]
    };
  }

  if (config.tokenExpiresAt && new Date(config.tokenExpiresAt).getTime() <= new Date(now).getTime()) {
    return {
      version: INSTAGRAM_RUNTIME_CONTROL_VERSION,
      provider: "instagram",
      state: SOCIAL_CONNECTION_STATES.TOKEN_EXPIRED,
      config,
      requiredSetupVars: [...REQUIRED_SETUP_VARS],
      missingSetup,
      missingToken,
      requiredPermissions: [...INSTAGRAM_MINIMUM_ANALYTICS_PERMISSIONS],
      missingPermissions,
      errors: [
        createRuntimeError(
          SOCIAL_ERROR_CODES.TOKEN_EXPIRED,
          "Instagram/Meta backend access token is expired.",
          { tokenExpiresAt: config.tokenExpiresAt }
        )
      ]
    };
  }

  if (missingPermissions.length) {
    return {
      version: INSTAGRAM_RUNTIME_CONTROL_VERSION,
      provider: "instagram",
      state: SOCIAL_CONNECTION_STATES.PERMISSION_REQUIRED,
      config,
      requiredSetupVars: [...REQUIRED_SETUP_VARS],
      missingSetup,
      missingToken,
      requiredPermissions: [...INSTAGRAM_MINIMUM_ANALYTICS_PERMISSIONS],
      missingPermissions,
      errors: [
        createRuntimeError(
          SOCIAL_ERROR_CODES.PERMISSION_REQUIRED,
          "Instagram/Meta access token is missing required analytics permissions.",
          { missingPermissions }
        )
      ]
    };
  }

  if (!config.connectionVerifiedAt) {
    return {
      version: INSTAGRAM_RUNTIME_CONTROL_VERSION,
      provider: "instagram",
      state: SOCIAL_CONNECTION_STATES.VERIFICATION_PENDING,
      config,
      requiredSetupVars: [...REQUIRED_SETUP_VARS],
      missingSetup,
      missingToken,
      requiredPermissions: [...INSTAGRAM_MINIMUM_ANALYTICS_PERMISSIONS],
      missingPermissions,
      errors: [
        createRuntimeError(
          SOCIAL_ERROR_CODES.VERIFICATION_PENDING,
          "Instagram/Meta token and permissions are present, but backend verification has not completed.",
          { requiredVerification: INSTAGRAM_RUNTIME_ENVIRONMENT.INSTAGRAM_CONNECTION_VERIFIED_AT }
        )
      ]
    };
  }

  return {
    version: INSTAGRAM_RUNTIME_CONTROL_VERSION,
    provider: "instagram",
    state: SOCIAL_CONNECTION_STATES.CONNECTED,
    config,
    requiredSetupVars: [...REQUIRED_SETUP_VARS],
    missingSetup,
    missingToken,
    requiredPermissions: [...INSTAGRAM_MINIMUM_ANALYTICS_PERMISSIONS],
    missingPermissions,
    errors: []
  };
}

export function publicInstagramRuntimeStatus(runtime) {
  return {
    version: runtime.version,
    provider: runtime.provider,
    state: runtime.state,
    setupConfigured: runtime.missingSetup.length === 0,
    tokenPresent: !runtime.missingToken,
    tokenExpiresAt: runtime.config.tokenExpiresAt,
    connectionVerifiedAt: runtime.config.connectionVerifiedAt,
    graphVersion: runtime.config.graphVersion,
    accountId: runtime.config.businessAccountId || null,
    accountHandle: runtime.config.accountHandle,
    requiredPermissions: [...runtime.requiredPermissions],
    grantedPermissions: [...runtime.config.grantedPermissions],
    missingPermissions: [...runtime.missingPermissions],
    missingSetup: [...runtime.missingSetup],
    errors: runtime.errors
  };
}
