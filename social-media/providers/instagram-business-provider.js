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

const DEFAULT_GRAPH_VERSION = "v21.0";

const INSTAGRAM_REQUIRED_PERMISSIONS = Object.freeze([
  "instagram_basic",
  "instagram_manage_insights",
  "pages_show_list",
  "pages_read_engagement"
]);

function getInstagramConfig(env = process.env) {
  return {
    accessToken: env.INSTAGRAM_ACCESS_TOKEN || env.META_INSTAGRAM_ACCESS_TOKEN || "",
    businessAccountId: env.INSTAGRAM_BUSINESS_ACCOUNT_ID || "",
    graphVersion: env.META_GRAPH_API_VERSION || DEFAULT_GRAPH_VERSION,
    accountHandle: env.INSTAGRAM_ACCOUNT_HANDLE || "@prometheus.iq"
  };
}

function missingInstagramConfig(config) {
  const missing = [];
  if (!config.accessToken) missing.push("INSTAGRAM_ACCESS_TOKEN");
  if (!config.businessAccountId) missing.push("INSTAGRAM_BUSINESS_ACCOUNT_ID");
  return missing;
}

function buildGraphUrl(config, path, params = {}) {
  const url = new URL(`https://graph.facebook.com/${config.graphVersion}/${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  url.searchParams.set("access_token", config.accessToken);
  return url;
}

async function fetchJson(fetchImpl, url) {
  const response = await fetchImpl(url);
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
  const config = getInstagramConfig(env);
  const missing = missingInstagramConfig(config);

  if (missing.length) {
    return createSocialProviderStatus({
      provider: SOCIAL_PROVIDER_IDS.INSTAGRAM,
      state: SOCIAL_CONNECTION_STATES.MOCK_SAMPLE,
      source: SOCIAL_DATA_SOURCES.MOCK_SAMPLE,
      accountHandle: config.accountHandle,
      checkedAt,
      requiredPermissions: [...INSTAGRAM_REQUIRED_PERMISSIONS],
      errors: [
        createSocialIntegrationError({
          code: SOCIAL_ERROR_CODES.NOT_CONNECTED,
          message: "Instagram Business analytics are using mock/sample data until Meta credentials are configured.",
          details: { missing }
        })
      ]
    });
  }

  return createSocialProviderStatus({
    provider: SOCIAL_PROVIDER_IDS.INSTAGRAM,
    state: SOCIAL_CONNECTION_STATES.CONNECTED,
    source: SOCIAL_DATA_SOURCES.PROVIDER_API,
    accountId: config.businessAccountId,
    accountHandle: config.accountHandle,
    checkedAt,
    requiredPermissions: [...INSTAGRAM_REQUIRED_PERMISSIONS],
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
  checkedAt = generatedAt
} = {}) {
  return createMarketingAnalyticsSnapshot({
    id: "social-media-instagram-sample-v1",
    generatedAt,
    window: {
      startsAt: "2026-06-01T00:00:00.000Z",
      endsAt: "2026-06-30T23:59:59.000Z",
      timezone: "America/Chicago"
    },
    providers: [getInstagramBusinessProviderStatus({ env: {}, checkedAt })],
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
  const missing = missingInstagramConfig(config);

  if (missing.length) {
    return createInstagramSampleSnapshot({ generatedAt });
  }

  if (typeof fetchImpl !== "function") {
    return createInstagramSampleSnapshot({ generatedAt });
  }

  const accountUrl = buildGraphUrl(config, config.businessAccountId, {
    fields: "username,followers_count,media_count"
  });
  const insightsUrl = buildGraphUrl(config, `${config.businessAccountId}/insights`, {
    metric: "reach,profile_views,website_clicks",
    period: "day"
  });

  const [accountResult, insightsResult] = await Promise.all([
    fetchJson(fetchImpl, accountUrl),
    fetchJson(fetchImpl, insightsUrl)
  ]);

  if (!accountResult.ok || !insightsResult.ok) {
    const status = createSocialProviderStatus({
      provider: SOCIAL_PROVIDER_IDS.INSTAGRAM,
      state: SOCIAL_CONNECTION_STATES.ERROR,
      source: SOCIAL_DATA_SOURCES.PROVIDER_API,
      accountId: config.businessAccountId,
      accountHandle: config.accountHandle,
      checkedAt: generatedAt,
      requiredPermissions: [...INSTAGRAM_REQUIRED_PERMISSIONS],
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
        requiredPermissions: [...INSTAGRAM_REQUIRED_PERMISSIONS],
        grantedPermissions: [...INSTAGRAM_REQUIRED_PERMISSIONS],
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
