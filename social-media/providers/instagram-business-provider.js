import {
  SOCIAL_CONNECTION_STATES,
  SOCIAL_DATA_SOURCES,
  SOCIAL_ERROR_CODES,
  SOCIAL_PROVIDER_CAPABILITIES,
  SOCIAL_PROVIDER_IDS,
  createMarketingAnalyticsSnapshot,
  createSocialIntegrationError,
  createSocialProviderStatus
} from "../contracts/social-media-contract.js";
import {
  publicInstagramRuntimeStatus,
  resolveInstagramRuntimeConfig,
  validateInstagramRuntimeEnvironment
} from "../infrastructure/instagram-runtime-controls.js";

function getInstagramConfig(env = process.env) {
  return resolveInstagramRuntimeConfig(env);
}

function buildGraphUrl(config, path, params = {}) {
  const host = config.graphHost || "graph.facebook.com";
  const url = new URL(`https://${host}/${config.graphVersion}/${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  return url;
}

function accountResourcePath(config) {
  return config.businessAccountId || config.instagramUserId || "me";
}

function accountFields(config) {
  return config.apiMode === "instagram_login"
    ? "user_id,username,account_type"
    : "username,followers_count,media_count";
}

async function fetchJson(fetchImpl, url, accessToken) {
  const response = await fetchImpl(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: json?.error?.message || "Meta Graph API request failed."
    };
  }

  return { ok: true, status: response.status, data: json };
}

function metricValue(insights, name) {
  const metric = insights?.data?.find(item => item.name === name);
  const value = metric?.values?.[0]?.value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getInstagramBusinessProviderStatus({ env = process.env, checkedAt } = {}) {
  const runtime = validateInstagramRuntimeEnvironment({ env, now: checkedAt ? new Date(checkedAt) : new Date() });
  const config = runtime.config;

  if (runtime.state !== SOCIAL_CONNECTION_STATES.CONNECTED) {
    return createSocialProviderStatus({
      provider: SOCIAL_PROVIDER_IDS.INSTAGRAM,
      state: runtime.state,
      source: SOCIAL_DATA_SOURCES.MOCK_SAMPLE,
      accountHandle: config.accountHandle,
      accountId: config.businessAccountId || null,
      checkedAt,
      requiredPermissions: [...config.requiredPermissions],
      grantedPermissions: [...config.grantedPermissions],
      errors: runtime.errors
    });
  }

  return createSocialProviderStatus({
    provider: SOCIAL_PROVIDER_IDS.INSTAGRAM,
    state: SOCIAL_CONNECTION_STATES.CONNECTED,
    source: SOCIAL_DATA_SOURCES.PROVIDER_API,
    accountId: config.businessAccountId,
    accountHandle: config.accountHandle,
    checkedAt,
    requiredPermissions: [...config.requiredPermissions],
    grantedPermissions: [...config.grantedPermissions],
    capabilities: {
      [SOCIAL_PROVIDER_CAPABILITIES.READ_ACCOUNT_INSIGHTS]: true,
      [SOCIAL_PROVIDER_CAPABILITIES.READ_CONTENT_INSIGHTS]: true,
      [SOCIAL_PROVIDER_CAPABILITIES.READ_AUDIENCE_INSIGHTS]: true,
      [SOCIAL_PROVIDER_CAPABILITIES.READ_COMMENT_SUMMARY]: false,
      [SOCIAL_PROVIDER_CAPABILITIES.READ_CAMPAIGN_INSIGHTS]: false
    }
  });
}

export function createInstagramSampleSnapshot({
  generatedAt = "2026-06-30T12:00:00.000Z",
  checkedAt = generatedAt,
  env = {}
} = {}) {
  return createMarketingAnalyticsSnapshot({
    id: "social-media-instagram-sample-v1",
    generatedAt,
    window: {
      startsAt: "2026-06-01T00:00:00.000Z",
      endsAt: "2026-06-30T23:59:59.000Z",
      timezone: "America/Chicago"
    },
    providers: [getInstagramBusinessProviderStatus({ env, checkedAt })],
    campaigns: [{
      id: "founder-build-in-public-v1",
      name: "Founder Build In Public",
      platform: SOCIAL_PROVIDER_IDS.INSTAGRAM,
      objective: "founder_marketing_analytics",
      startsAt: "2026-06-01T00:00:00.000Z",
      utm: {
        source: "instagram",
        medium: "social",
        campaign: "founder-build-in-public-v1"
      }
    }],
    metrics: [
      {
        name: "reach",
        value: 0,
        source: SOCIAL_DATA_SOURCES.MOCK_SAMPLE,
        provider: SOCIAL_PROVIDER_IDS.INSTAGRAM,
        campaignId: "founder-build-in-public-v1",
        observedAt: generatedAt,
        metadata: { sample: true }
      },
      {
        name: "profile_views",
        value: 0,
        source: SOCIAL_DATA_SOURCES.MOCK_SAMPLE,
        provider: SOCIAL_PROVIDER_IDS.INSTAGRAM,
        campaignId: "founder-build-in-public-v1",
        observedAt: generatedAt,
        metadata: { sample: true }
      }
    ],
    attributionEvents: [
      {
        id: "sample-website-visit-1",
        type: "website_visit",
        target: "website_traffic",
        source: SOCIAL_DATA_SOURCES.MOCK_SAMPLE,
        provider: SOCIAL_PROVIDER_IDS.INSTAGRAM,
        campaignId: "founder-build-in-public-v1",
        occurredAt: generatedAt,
        confidence: 0,
        metadata: {
          sample: true,
          contractConsumer: "Prometheus Website"
        }
      }
    ],
    notes: [
      "Mock/sample analytics only. Replace with provider_api and subsystem contract inputs after OAuth and downstream integrations are connected."
    ]
  });
}

export async function fetchInstagramBusinessSnapshot({
  env = process.env,
  fetchImpl = globalThis.fetch,
  generatedAt = new Date().toISOString()
} = {}) {
  const config = getInstagramConfig(env);
  const runtime = validateInstagramRuntimeEnvironment({ env, now: new Date(generatedAt) });

  if (runtime.state !== SOCIAL_CONNECTION_STATES.CONNECTED) {
    return createInstagramSampleSnapshot({ generatedAt, env });
  }

  if (typeof fetchImpl !== "function") {
    return createInstagramSampleSnapshot({ generatedAt, env });
  }

  const accountPath = accountResourcePath(config);
  const accountUrl = buildGraphUrl(config, accountPath, {
    fields: accountFields(config)
  });
  const insightsUrl = buildGraphUrl(config, `${accountPath}/insights`, {
    metric: "reach,profile_views,website_clicks",
    period: "day"
  });

  const [accountResult, insightsResult] = await Promise.all([
    fetchJson(fetchImpl, accountUrl, config.accessToken),
    fetchJson(fetchImpl, insightsUrl, config.accessToken)
  ]);

  if (!accountResult.ok || !insightsResult.ok) {
    const status = createSocialProviderStatus({
      provider: SOCIAL_PROVIDER_IDS.INSTAGRAM,
      state: SOCIAL_CONNECTION_STATES.ERROR,
      source: SOCIAL_DATA_SOURCES.PROVIDER_API,
      accountId: config.businessAccountId,
      accountHandle: config.accountHandle,
      checkedAt: generatedAt,
      requiredPermissions: [...config.requiredPermissions],
      grantedPermissions: [...config.grantedPermissions],
      errors: [
        createSocialIntegrationError({
          code: SOCIAL_ERROR_CODES.PROVIDER_ERROR,
          message: "Meta Graph API returned an error for Instagram Business analytics.",
          details: {
            accountStatus: accountResult.status,
            insightsStatus: insightsResult.status,
            providerMessage: accountResult.error || insightsResult.error
          }
        })
      ]
    });

    return createMarketingAnalyticsSnapshot({
      id: "instagram-business-provider-error",
      generatedAt,
      providers: [status],
      notes: ["Provider error response is sanitized and does not expose tokens."]
    });
  }

  const handle = accountResult.data?.username ? `@${accountResult.data.username}` : config.accountHandle;

  return createMarketingAnalyticsSnapshot({
    id: "instagram-business-provider-api",
    generatedAt,
    providers: [
      createSocialProviderStatus({
        provider: SOCIAL_PROVIDER_IDS.INSTAGRAM,
        state: SOCIAL_CONNECTION_STATES.CONNECTED,
        source: SOCIAL_DATA_SOURCES.PROVIDER_API,
        accountId: config.businessAccountId,
        accountHandle: handle,
        checkedAt: generatedAt,
        requiredPermissions: [...config.requiredPermissions],
        grantedPermissions: [...config.grantedPermissions],
        capabilities: {
          [SOCIAL_PROVIDER_CAPABILITIES.READ_ACCOUNT_INSIGHTS]: true,
          [SOCIAL_PROVIDER_CAPABILITIES.READ_CONTENT_INSIGHTS]: true,
          [SOCIAL_PROVIDER_CAPABILITIES.READ_AUDIENCE_INSIGHTS]: true
        }
      })
    ],
    metrics: [
      {
        name: "reach",
        value: metricValue(insightsResult.data, "reach"),
        source: SOCIAL_DATA_SOURCES.PROVIDER_API,
        provider: SOCIAL_PROVIDER_IDS.INSTAGRAM,
        observedAt: generatedAt
      },
      {
        name: "profile_views",
        value: metricValue(insightsResult.data, "profile_views"),
        source: SOCIAL_DATA_SOURCES.PROVIDER_API,
        provider: SOCIAL_PROVIDER_IDS.INSTAGRAM,
        observedAt: generatedAt
      },
      {
        name: "website_clicks",
        value: metricValue(insightsResult.data, "website_clicks"),
        source: SOCIAL_DATA_SOURCES.PROVIDER_API,
        provider: SOCIAL_PROVIDER_IDS.INSTAGRAM,
        observedAt: generatedAt
      },
      {
        name: "followers_count",
        value: accountResult.data?.followers_count,
        source: SOCIAL_DATA_SOURCES.PROVIDER_API,
        provider: SOCIAL_PROVIDER_IDS.INSTAGRAM,
        observedAt: generatedAt
      }
    ],
    notes: ["Live provider data is account-level only until content-level and downstream attribution contracts are connected."]
  });
}

export function getInstagramRuntimeStatus({ env = process.env, now = new Date() } = {}) {
  return publicInstagramRuntimeStatus(validateInstagramRuntimeEnvironment({ env, now }));
}
