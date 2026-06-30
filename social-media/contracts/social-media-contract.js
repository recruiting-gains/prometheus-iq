export const SOCIAL_MEDIA_CONTRACT_VERSION = "social-media-marketing-analytics-contract.v1";

export const SOCIAL_PROVIDER_IDS = Object.freeze({
  INSTAGRAM: "instagram",
  FACEBOOK: "facebook",
  LINKEDIN: "linkedin",
  X: "x",
  TIKTOK: "tiktok",
  YOUTUBE: "youtube"
});

export const SOCIAL_CONNECTION_STATES = Object.freeze({
  NOT_CONFIGURED: "not_configured",
  CONFIGURED: "configured",
  CONNECTED: "connected",
  DISCONNECTED: "disconnected",
  PERMISSION_REQUIRED: "permission_required",
  TOKEN_MISSING: "token_missing",
  TOKEN_EXPIRED: "token_expired",
  VERIFICATION_PENDING: "verification_pending",
  MOCK_SAMPLE: "mock_sample",
  ERROR: "error"
});

export const SOCIAL_DATA_SOURCES = Object.freeze({
  PROVIDER_API: "provider_api",
  MANUAL: "manual",
  MOCK_SAMPLE: "mock_sample",
  WEBSITE_CONTRACT: "website_contract",
  CRM_CONTRACT: "crm_contract",
  BETA_CONTRACT: "beta_contract"
});

export const SOCIAL_PROVIDER_CAPABILITIES = Object.freeze({
  READ_ACCOUNT_INSIGHTS: "read_account_insights",
  READ_CONTENT_INSIGHTS: "read_content_insights",
  READ_AUDIENCE_INSIGHTS: "read_audience_insights",
  READ_CAMPAIGN_INSIGHTS: "read_campaign_insights",
  READ_COMMENT_SUMMARY: "read_comment_summary"
});

export const SOCIAL_ATTRIBUTION_TARGETS = Object.freeze({
  WEBSITE_TRAFFIC: "website_traffic",
  CRM_LEAD: "crm_lead",
  BETA_SIGNUP: "beta_signup",
  FOUNDER_ANALYTICS: "founder_analytics",
  CAMPAIGN_PERFORMANCE: "campaign_performance"
});

export const SOCIAL_ATTRIBUTION_EVENT_TYPES = Object.freeze({
  SOCIAL_IMPRESSION: "social_impression",
  SOCIAL_ENGAGEMENT: "social_engagement",
  PROFILE_VISIT: "profile_visit",
  WEBSITE_VISIT: "website_visit",
  CTA_CLICK: "cta_click",
  CRM_LEAD_CREATED: "crm_lead_created",
  BETA_INTEREST: "beta_interest",
  BETA_SIGNUP: "beta_signup",
  CAMPAIGN_CONVERSION: "campaign_conversion"
});

export const SOCIAL_ERROR_CODES = Object.freeze({
  NOT_CONFIGURED: "not_configured",
  NOT_CONNECTED: "not_connected",
  PERMISSION_REQUIRED: "permission_required",
  TOKEN_MISSING: "token_missing",
  TOKEN_EXPIRED: "token_expired",
  VERIFICATION_PENDING: "verification_pending",
  PROVIDER_UNAVAILABLE: "provider_unavailable",
  PROVIDER_ERROR: "provider_error",
  UNSUPPORTED_PROVIDER: "unsupported_provider",
  VALIDATION_FAILED: "validation_failed",
  RATE_LIMITED: "rate_limited"
});

const SENSITIVE_KEY_PATTERN = /(token|secret|password|credential|authorization|api[_-]?key|app[_-]?secret)/i;

function nowIso() {
  return new Date().toISOString();
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function optionalArray(value) {
  return Array.isArray(value) ? value : [];
}

function optionalString(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function assertRequiredString(value, fieldName) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${fieldName} is required.`);
  }
}

function assertEnum(value, allowed, fieldName) {
  if (!Object.values(allowed).includes(value)) {
    throw new Error(`${fieldName} must be one of: ${Object.values(allowed).join(", ")}`);
  }
}

function normalizeIso(value, fieldName) {
  assertRequiredString(value, fieldName);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} must be a valid ISO date string.`);
  }
  return date.toISOString();
}

function optionalIso(value, fieldName) {
  return value ? normalizeIso(value, fieldName) : null;
}

function numberOrZero(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function stripSensitiveSocialDetails(value) {
  if (Array.isArray(value)) {
    return value.map(stripSensitiveSocialDetails);
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(Object.entries(value).map(([key, child]) => [
    key,
    SENSITIVE_KEY_PATTERN.test(key) ? "[redacted]" : stripSensitiveSocialDetails(child)
  ]));
}

export function createSocialIntegrationError({ code, message, retryable = false, details = {} }) {
  assertEnum(code, SOCIAL_ERROR_CODES, "error.code");
  assertRequiredString(message, "error.message");

  return {
    code,
    message,
    retryable: Boolean(retryable),
    details: stripSensitiveSocialDetails(details)
  };
}

export function createSocialProviderStatus({
  provider,
  state = SOCIAL_CONNECTION_STATES.DISCONNECTED,
  accountId = null,
  accountHandle = null,
  source = SOCIAL_DATA_SOURCES.MOCK_SAMPLE,
  capabilities = {},
  requiredPermissions = [],
  grantedPermissions = [],
  checkedAt = nowIso(),
  errors = []
} = {}) {
  assertEnum(provider, SOCIAL_PROVIDER_IDS, "status.provider");
  assertEnum(state, SOCIAL_CONNECTION_STATES, "status.state");
  assertEnum(source, SOCIAL_DATA_SOURCES, "status.source");

  return {
    contractVersion: SOCIAL_MEDIA_CONTRACT_VERSION,
    provider,
    state,
    source,
    accountId,
    accountHandle,
    capabilities: {
      [SOCIAL_PROVIDER_CAPABILITIES.READ_ACCOUNT_INSIGHTS]: false,
      [SOCIAL_PROVIDER_CAPABILITIES.READ_CONTENT_INSIGHTS]: false,
      [SOCIAL_PROVIDER_CAPABILITIES.READ_AUDIENCE_INSIGHTS]: false,
      [SOCIAL_PROVIDER_CAPABILITIES.READ_CAMPAIGN_INSIGHTS]: false,
      [SOCIAL_PROVIDER_CAPABILITIES.READ_COMMENT_SUMMARY]: false,
      ...capabilities
    },
    requiredPermissions: optionalArray(requiredPermissions),
    grantedPermissions: optionalArray(grantedPermissions),
    checkedAt: normalizeIso(checkedAt, "status.checkedAt"),
    errors: optionalArray(errors)
  };
}

export function createDisconnectedSocialProviderStatus({
  provider,
  message = "Social provider is not connected.",
  checkedAt = nowIso()
} = {}) {
  return createSocialProviderStatus({
    provider,
    state: SOCIAL_CONNECTION_STATES.DISCONNECTED,
    checkedAt,
    errors: [
      createSocialIntegrationError({
        code: SOCIAL_ERROR_CODES.NOT_CONNECTED,
        message
      })
    ]
  });
}

export function createCampaignDescriptor(input = {}) {
  assertRequiredString(input.id, "campaign.id");
  assertRequiredString(input.name, "campaign.name");

  return {
    id: input.id,
    name: input.name,
    platform: input.platform || "multi_platform",
    objective: optionalString(input.objective, "awareness"),
    owner: optionalString(input.owner, "prometheus-social-media"),
    startsAt: optionalIso(input.startsAt, "campaign.startsAt"),
    endsAt: optionalIso(input.endsAt, "campaign.endsAt"),
    utm: {
      source: optionalString(input.utm?.source),
      medium: optionalString(input.utm?.medium),
      campaign: optionalString(input.utm?.campaign, input.id),
      content: optionalString(input.utm?.content),
      term: optionalString(input.utm?.term)
    },
    metadata: stripSensitiveSocialDetails(input.metadata || {})
  };
}

export function createSocialMetric(input = {}) {
  assertRequiredString(input.name, "metric.name");

  return {
    name: input.name,
    value: numberOrZero(input.value),
    unit: optionalString(input.unit, "count"),
    source: input.source || SOCIAL_DATA_SOURCES.MOCK_SAMPLE,
    provider: input.provider || null,
    campaignId: input.campaignId || null,
    observedAt: normalizeIso(input.observedAt || nowIso(), "metric.observedAt"),
    metadata: stripSensitiveSocialDetails(input.metadata || {})
  };
}

export function createAttributionEvent(input = {}) {
  assertRequiredString(input.id, "attributionEvent.id");
  assertEnum(input.type, SOCIAL_ATTRIBUTION_EVENT_TYPES, "attributionEvent.type");
  assertEnum(input.target, SOCIAL_ATTRIBUTION_TARGETS, "attributionEvent.target");

  return {
    id: input.id,
    type: input.type,
    target: input.target,
    source: input.source || SOCIAL_DATA_SOURCES.MOCK_SAMPLE,
    provider: input.provider || null,
    campaignId: input.campaignId || null,
    occurredAt: normalizeIso(input.occurredAt || nowIso(), "attributionEvent.occurredAt"),
    visitorId: input.visitorId || null,
    leadId: input.leadId || null,
    betaParticipantId: input.betaParticipantId || null,
    value: numberOrZero(input.value),
    confidence: Math.max(0, Math.min(1, numberOrZero(input.confidence))),
    metadata: stripSensitiveSocialDetails(input.metadata || {})
  };
}

export function createMarketingAnalyticsSnapshot({
  id,
  generatedAt = nowIso(),
  window = {},
  providers = [],
  campaigns = [],
  metrics = [],
  attributionEvents = [],
  notes = []
} = {}) {
  assertRequiredString(id, "snapshot.id");

  return {
    contractVersion: SOCIAL_MEDIA_CONTRACT_VERSION,
    id,
    generatedAt: normalizeIso(generatedAt, "snapshot.generatedAt"),
    window: {
      startsAt: optionalIso(window.startsAt, "snapshot.window.startsAt"),
      endsAt: optionalIso(window.endsAt, "snapshot.window.endsAt"),
      timezone: optionalString(window.timezone, "America/Chicago")
    },
    providers: providers.map(createSocialProviderStatus),
    campaigns: campaigns.map(createCampaignDescriptor),
    metrics: metrics.map(createSocialMetric),
    attributionEvents: attributionEvents.map(createAttributionEvent),
    notes: optionalArray(notes).map(String)
  };
}
